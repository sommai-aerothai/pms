// เติมค่าลงสำเนา xlsx ของฟอร์มจริง · แก้เฉพาะ <c> ที่ระบุ (คง s= เดิม) ส่วนอื่นของไฟล์คงเดิมทุกไบต์ · ไม่ใช้ไลบรารี
// edits = { 'Page 1': { A4: 'ข้อความ', I9: -2.1 } } · ค่า number → <v> · string → inlineStr · '' / null = ไม่แตะ
import { unzip } from '../readers/zip.js';

const enc = new TextEncoder(), dec = new TextDecoder();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ชื่อชีต → path ใน zip (อ่านด้วย regex ให้รันได้ทั้งเบราว์เซอร์และ node)
function sheetPaths(wb, rels) {
  const t = {}, out = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = /\bId="([^"]+)"/.exec(m[0]), tg = /\bTarget="([^"]+)"/.exec(m[0]); if (id && tg) t[id[1]] = tg[1]; }
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(m[0]), id = /\br:id="([^"]+)"/.exec(m[0]); if (!name || !id || !t[id[1]]) continue;
    const p = t[id[1]]; out[name[1].replace(/&amp;/g, '&')] = p.startsWith('/') ? p.slice(1) : 'xl/' + p;
  }
  return out;
}

// แทน 1 cell · ต้องมี cell นี้ในฟอร์มอยู่แล้ว (ไม่มี = โครงฟอร์มเปลี่ยน → โยน error ไม่สร้างเอง)
export function setCell(xml, ref, val) {
  const re = new RegExp(`<c r="${ref}"(?=[\\s/>])([^>]*?)(?:/>|>[\\s\\S]*?</c>)`), m = re.exec(xml);
  if (!m) throw new Error(`ไม่พบช่อง ${ref} ในฟอร์ม`);
  const s = /\bs="(\d+)"/.exec(m[1]), sa = s ? ` s="${s[1]}"` : '';
  const cell = typeof val === 'number'
    ? `<c r="${ref}"${sa}><v>${val}</v></c>`
    : `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
  return xml.slice(0, m.index) + cell + xml.slice(m.index + m[0].length);
}

export async function fillXlsx(buf, edits) {
  const z = await unzip(buf), files = new Map();
  for (const n of z.names) files.set(n, await z.read(n));
  const txt = n => dec.decode(files.get(n)), paths = sheetPaths(txt('xl/workbook.xml'), txt('xl/_rels/workbook.xml.rels'));
  let formulas = false;
  for (const [sheet, cells] of Object.entries(edits)) {
    const p = paths[sheet]; if (!p || !files.has(p)) throw new Error(`ไม่พบชีต "${sheet}" ในฟอร์ม`);
    let x = txt(p);
    for (const [ref, v] of Object.entries(cells)) {
      if (v == null || v === '') continue;
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`ค่า ${ref} ไม่ใช่ตัวเลข`);
      x = setCell(x, ref, v);
    }
    files.set(p, enc.encode(x));
  }
  for (const p of Object.values(paths)) if (/<f[\s>]/.test(txt(p))) formulas = true;
  if (formulas) {   // มีสูตร: ทิ้ง calcChain ให้ Excel/LO คำนวณใหม่ตอนเปิด
    files.delete('xl/calcChain.xml');
    files.set('[Content_Types].xml', enc.encode(txt('[Content_Types].xml').replace(/<Override[^>]*calcChain[^>]*\/>/, '')));
    files.set('xl/_rels/workbook.xml.rels', enc.encode(txt('xl/_rels/workbook.xml.rels').replace(/<Relationship[^>]*calcChain[^>]*\/>/, '')));
    let wb = txt('xl/workbook.xml');
    wb = /<calcPr\b/.test(wb) ? wb.replace(/<calcPr\b(?![^>]*fullCalcOnLoad)/, '<calcPr fullCalcOnLoad="1"') : wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    files.set('xl/workbook.xml', enc.encode(wb));
  }
  return zip([...files]);
}

// ---- zip writer เล็ก ๆ: deflate-raw (CompressionStream) + CRC32 · ลำดับไฟล์ตามต้นฉบับ · ไม่รองรับ zip64 (ฟอร์ม < 4 GB แน่นอน)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
const deflate = async b => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());

export async function zip(entries) {
  const parts = [], central = []; let off = 0;
  for (const [name, data] of entries) {
    const nb = enc.encode(name), comp = await deflate(data), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 8, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);   // 1980-01-01 00:00 เหมือนต้นฉบับ
    h.setUint32(14, crc, true); h.setUint32(18, comp.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 8, true);
    c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, comp.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nb, comp); central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + comp.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Uint8Array(await new Blob([...parts, ...central, new Uint8Array(e.buffer)]).arrayBuffer());
}
