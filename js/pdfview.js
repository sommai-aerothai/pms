// ตัวแสดง PDF ในหน้า (แทน iframe: iPhone/iPad แสดง iframe ได้แค่หน้าแรก) · pdf.js วาดทีละหน้าเป็น canvas เมื่อเลื่อนมาใกล้
// over(i, copy) = HTML ที่วางทับหน้า (ตำแหน่งเป็น % ของหน้า → ซูม/หมุนจอแล้วยังตรง) · copies = วาดหน้าเดิมซ้ำ (ฟอร์มที่เกิน 1 หน้า)
import { load } from './readers/pdf.js';

// url → Promise<PDFDocumentProxy> · เก็บแค่ KEEP ไฟล์ล่าสุด (มือถือหน่วยความจำน้อย) · เกิน = destroy ไฟล์เก่าสุด
const docs = new Map(), KEEP = 3;
function open(url) {
  let p = docs.get(url);
  if (p) { docs.delete(url); docs.set(url, p); return p; }   // ใช้ล่าสุด = ย้ายไปท้าย
  p = load().then(m => m.getDocument({ url, isEvalSupported: false }).promise).catch(e => { docs.delete(url); throw e; });
  docs.set(url, p);
  for (const [u, old] of docs) { if (docs.size <= KEEP) break; if ([...live].some(x => x[2] === u && x[0].isConnected)) continue; docs.delete(u); old.then(d => d.destroy(), () => {}); }   // ไฟล์ที่หน้าจอยังใช้อยู่ = ไม่ทิ้ง
  return p;
}

const live = new Set();   // [host, observer, url] · หน้าที่ถูกแทนที่แล้ว = ปลด observer (ไม่ค้างหน้า/canvas ไว้ในหน่วยความจำ)
const gone = (host, url) => !host.isConnected || host.dataset.pdf !== url;
export const sweep = () => { for (const x of live) if (!x[0].isConnected) { x[1].disconnect(); live.delete(x); } };   // app.js เรียกทุกครั้งที่วาดหน้าใหม่
export async function renderPdf(host, url, { over, copies = 1, max = 300 } = {}) {
  sweep();
  const doc = await open(url), n = Math.min(doc.numPages, max);
  if (gone(host, url)) return 0;   // ระหว่างโหลด หน้าถูกวาดใหม่/เปลี่ยนไฟล์ = ไม่ทับของใหม่
  // ใกล้จอ = วาด · ไกลจอ = คืนหน่วยความจำ canvas (เก็บกรอบหน้าไว้ ไม่กระตุก) · กัน PDF ยาวทำแอปถูกปิดบนมือถือ
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? paint(e.target) : release(e.target)), { rootMargin: '1200px 0px' }), me = [host, io, url];
  live.add(me); host.innerHTML = '';
  for (let c = 0; c < copies; c++) for (let i = 1; i <= n; i++) {   // ทีละหน้า: หน้าแรกขึ้นก่อน ไม่รอทั้งเล่ม
    const pg = await doc.getPage(i);
    if (gone(host, url)) { io.disconnect(); live.delete(me); return 0; }
    const v = pg.getViewport({ scale: 1 }), d = document.createElement('div');
    d.className = 'pp'; d.style.aspectRatio = `${v.width} / ${v.height}`; d.pg = pg;
    d.innerHTML = `<canvas aria-hidden="true"></canvas>${over ? over(i - 1, c, v) : ''}`;
    host.append(d); io.observe(d);
  }
  if (doc.numPages > n) host.insertAdjacentHTML('beforeend', `<p class="sec c">แสดง ${n} จาก ${doc.numPages} หน้า · เปิดในแท็บใหม่เพื่อดูทั้งหมด</p>`);
  return doc.numPages;
}
// want = ควรมีภาพ · gen = รุ่นคำขอ (คำขอล่าสุดชนะ: เลื่อนออก-กลับเร็วๆ ไม่ค้างหน้าว่าง) · pdf.js ห้ามวาดซ้อนบน canvas เดียว → รอรอบเก่าจบก่อน
const clear = cv => { cv.width = cv.height = 0; };
function release(d) { if (!d.want) return; d.want = false; d.gen = (d.gen || 0) + 1; if (d.task) d.task.cancel(); else clear(d.firstElementChild); }
async function paint(d) {
  if (d.want) return; d.want = true;
  const g = d.gen = (d.gen || 0) + 1, cv = d.firstElementChild;
  while (d.task) await d.task.promise.catch(() => {});
  if (d.gen !== g) return;
  const v1 = d.pg.getViewport({ scale: 1 }), v = d.pg.getViewport({ scale: Math.min(3, d.clientWidth * (devicePixelRatio || 1) / v1.width) });
  cv.width = Math.round(v.width); cv.height = Math.round(v.height);
  const t = d.task = d.pg.render({ canvasContext: cv.getContext('2d'), viewport: v });
  try { await t.promise; } catch { if (d.gen === g) d.want = false; }   // วาดไม่สำเร็จ = ลองใหม่เมื่อเลื่อนกลับมา
  finally { if (d.task === t) d.task = null; if (d.gen !== g || !d.want) clear(cv); }
}
