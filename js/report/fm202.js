// งาน → ช่องใน FM-CE.SE-202 Rev.03 (ฟอร์มเปล่าจากเว็บกอง docstore/FM/FM-CE.SE-202 แบบฟอร์ม PM Tx Radio Rev.03.xlsx)
// โครงจากไฟล์จริง: ชีต "Page 1" แถว 9-25 = NO 1-17 · "Page 2" แถว 9-25 = NO 18-34 (A พิมพ์เลขไว้แล้ว)
//   A4 (ผสาน A4:V4) "MaintID……." · A27 (ผสาน A27:V27) "ผู้ปฏิบัติ" · คอลัมน์ B Freq · C M/S · D Func · E Model · F Osc · G Asset · H Serial
//   I/J Error Ind/Adj · K/L Osc · M/N Power · O Spurious · P/Q Mod · R/S Sensitivity · T Distn · U/V Time out (คอลัมน์ค่าวัดตาม FM202_FIELDS.col)
// เลข: ฉบับที่ผู้ตรวจรับแล้ว (2-69) ใช้เลขอารบิกทั้งฟอร์ม (หัว "ครั้งที่ 2/69", ค่าวัด, "1. ชื่อ") → ไม่แปลงเลขไทยในฟอร์มนี้
import { FM202_FIELDS } from '../data/wi-scope.js';
import { fillXlsx } from './xlsx-fill.js';

export const SHEETS = ['Page 1', 'Page 2'], FIRST = 9, PER_PAGE = 17, MAX = SHEETS.length * PER_PAGE;
const str = v => String(v ?? '').trim();
const val = v => { const s = String(v ?? '').trim(); return /^-?\d+(\.\d+)?$/.test(s) ? +s : s; };   // เก็บเป็นตัวเลขเมื่อเป็นตัวเลข

// คืน { edits: {ชีต: {ช่อง: ค่า}}, pages, missing: [ข้อความ] } · missing = สิ่งที่วางไม่ได้/ไม่มีข้อมูล ให้ผู้ใช้เห็นก่อนส่ง
export function map202(job) {
  const edits = {}, missing = [], tx = [...(job.tx || [])].sort((a, b) => a.n - b.n);
  const put = (n, ref, v) => { if (v !== '' && v != null) (edits[SHEETS[n]] ||= {})[ref] = v; };
  let pages = 1;
  for (const t of tx) {
    if (!Number.isInteger(t.n) || t.n < 1 || t.n > MAX) { missing.push(`Tx ${t.n} (${t.freq}): ฟอร์มมี ${MAX} แถว (2 หน้า × ${PER_PAGE}) · วางไม่ได้`); continue; }
    const p = Math.floor((t.n - 1) / PER_PAGE), r = FIRST + (t.n - 1) % PER_PAGE, v = t.v || {};
    pages = Math.max(pages, p + 1);
    // รหัสเครื่องเป็นข้อความเสมอ (กันเลข 0 นำหน้าหาย) · Asset = ค่าที่ตรวจจากสติกเกอร์เท่านั้น ไม่ใช้ทะเบียนแทน
    put(p, 'B' + r, val(t.freq)); put(p, 'E' + r, str(t.model)); put(p, 'G' + r, str(v.asset)); put(p, 'H' + r, str(v.serial));
    const empty = str(v.asset) ? [] : ['Asset No (ยังไม่ตรวจสติกเกอร์)'];
    for (const f of FM202_FIELDS) {
      let x = val(v[f.k]);
      if (f.k === 'spur' && typeof x === 'number') x = Math.abs(x);   // แอปเก็บ −66 dBc · ฟอร์มที่ผู้ตรวจรับแล้วเขียนขนาด 66
      if (!f.col) { if (x !== '') missing.push(`Tx ${t.n}: ${f.n} = ${x} · ฟอร์มไม่มีช่อง (R = Squelch)`); continue; }
      if (x === '') empty.push(f.t); else put(p, f.col + r, x);
    }
    if (empty.length) missing.push(`Tx ${t.n} (${t.freq}): ยังไม่มีค่า ${empty.join(', ')}`);
  }
  const base = String(job.pm && job.pm.base || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (!base || !job.round) missing.push('หัวฟอร์ม: งานไม่มีชื่อระบบหรือครั้งที่');
  const people = (job.pm && job.pm.people || []).filter(Boolean);
  if (!people.length) missing.push('ผู้ปฏิบัติ: งานยังไม่มีรายชื่อ');
  for (let p = 0; p < pages; p++) {
    if (base && job.round) put(p, 'A4', `MaintID PM ${base} ครั้งที่ ${job.round}`);
    if (people.length) put(p, 'A27', `ผู้ปฏิบัติ      ${people.map((n, i) => `${i + 1}. ${n}`).join('      ')}`);
  }
  if (tx.length) missing.push('ทุกเครื่อง: แอปยังไม่เก็บ M/S, Func, Osc Type และค่า Adj → ช่อง C, D, F, J, L, N, Q, S, V ว่างไว้');
  return { edits, pages, missing };
}

// templateBuf = ไบต์ของฟอร์มเปล่าจริง → { bytes: Uint8Array (.xlsx), pages, missing }
export async function fill202(templateBuf, job) {
  const m = map202(job);
  return { ...m, bytes: await fillXlsx(templateBuf, m.edits) };
}
