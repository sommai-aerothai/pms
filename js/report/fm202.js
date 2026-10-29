// งาน → ช่องใน FM-CE.SE-202 Rev.03 (ฟอร์มเปล่าจากเว็บกอง docstore/FM/FM-CE.SE-202 แบบฟอร์ม PM Tx Radio Rev.03.xlsx)
// โครงจากไฟล์จริง: ชีต "Page 1" แถว 9-25 = NO 1-17 · "Page 2" แถว 9-25 = NO 18-34 (A พิมพ์เลขไว้แล้ว)
//   A4 (ผสาน A4:V4) "MaintID……." · A27 (ผสาน A27:V27) "ผู้ปฏิบัติ" · คอลัมน์ B Freq · C M/S · D Func · E Model · F Osc · G Asset · H Serial
//   I/J Error Ind/Adj · K/L Osc · M/N Power · O Spurious · P/Q Mod · R/S Sensitivity · T Distn · U/V Time out (คอลัมน์ค่าวัดตาม FM202_FIELDS.col)
// เลข: ฉบับที่ผู้ตรวจรับแล้ว (2-69) ใช้เลขอารบิกทั้งฟอร์ม (หัว "ครั้งที่ 2/69", ค่าวัด, "1. ชื่อ") → ไม่แปลงเลขไทยในฟอร์มนี้
import { FM202_FIELDS } from '../data/wi-scope.js';
import { fillXlsx } from './xlsx-fill.js';

// รูปแบบแสดงเลขต่อคอลัมน์ ตามฉบับที่ผู้ตรวจรับแล้ว (2-69 Page 1): B 0.000 · I/M/P 0.0 · T 0.00 · ที่เหลือ General ตามฟอร์มเปล่า
// (2-69 Page 2 ใช้ General ที่ P/T = ไม่สม่ำเสมอ → ใช้แบบ Page 1 ทั้งสองหน้า)
export const FMT = { B: '0.000', I: '0.0', M: '0.0', P: '0.0', T: '0.00' };
export const SHEETS = ['Page 1', 'Page 2'], FIRST = 9, PER_PAGE = 17, MAX = SHEETS.length * PER_PAGE;
const str = v => String(v ?? '').trim();
const val = v => { const s = String(v ?? '').trim(); return /^-?\d+(\.\d+)?$/.test(s) ? +s : s; };   // เก็บเป็นตัวเลขเมื่อเป็นตัวเลข

// คอลัมน์ที่หน้ากรอกค่าเดิมไม่มี: [ชื่อ, ตัวเลข?] · R = Squelch ตามรายงานที่ตรวจรับแล้ว (หัวฟอร์มเขียน Sensitivity แต่ sens ของแอปไม่ลง R)
export const EXTRA = { C: ['M/S', 0], D: ['Func', 0], F: ['Osc Type', 0], J: ['Error Adj', 1], L: ['Osc Adj', 1], N: ['Power Adj', 1], Q: ['Mod Adj', 1], R: ['Squelch', 1], S: ['Sensitivity Adj', 1], V: ['Time out Adj', 1] };

// ตำแหน่งช่องบน PDF ฟอร์มเปล่า (docstore/FM/FM-CE.SE-202 … Rev.03.pdf · 1 หน้า แนวนอน 792×612 pt · 20 แถว) วัดจากเส้นตาราง
// X = เส้นแบ่งคอลัมน์ A…V (23 เส้น) · Y = เส้นแบ่งแถว (หัวตารางล่าง 174 → แถว 20 ล่าง 460.7) · คอลัมน์ตรงกับ Excel ทุกตัว
export const PDF202 = { w: 792, h: 612, rows: 20,
  x: [50.7, 71.3, 108, 132.3, 160, 216.7, 242, 310.7, 352, 372, 392.7, 416, 440, 464, 487, 528.7, 558, 586.7, 620, 660, 686, 714, 740.7],
  y: [174, 188.7, 202.7, 217.3, 231.3, 245.7, 260, 274, 288.7, 302.7, 317.3, 331.3, 345.3, 360, 374, 388.7, 402.7, 417.3, 432, 446.7, 460.7],
  sens: [744, 44], sensHead: [744, 140, 44, 34],   // sens ไม่มีช่องในฟอร์ม → คอลัมน์เสริมที่ขอบขวา (บนจอเท่านั้น ไม่ลงรายงาน)
  head: [50, 102, 560, 16], crew: [50, 472, 690, 16] };   // [x, y, w, h] ทับข้อความ "MaintID……." และ "ผู้ปฏิบัติ" เดิม (ข้อความใหม่ขึ้นต้นด้วยคำเดิมอยู่แล้ว)
const COL = 'ABCDEFGHIJKLMNOPQRSTUV';
// ช่องของสำเนาหน้าที่ copy (0 = Tx 1–20): { n, k, x, y, w, h, num, ro, v } · ro = แสดงจากงาน แก้ที่หน้างาน (NO, Freq, Model)
export function cells202(job, copy = 0) {
  const G = PDF202, out = [], byCol = Object.fromEntries(FM202_FIELDS.filter(f => f.col).map(f => [f.col, f]));
  for (const t of job.tx || []) {
    const i = t.n - 1 - copy * G.rows; if (i < 0 || i >= G.rows) continue;
    const y = G.y[i], h = G.y[i + 1] - y, v = t.v || {};
    G.x.slice(0, -1).forEach((x, c) => {
      const L = COL[c], w = G.x[c + 1] - x, f = byCol[L], cell = { n: t.n, col: L, x, y, w, h };
      if (L === 'A') out.push({ ...cell, k: '', ro: true, v: String(t.n) });
      else if (L === 'B') out.push({ ...cell, k: '', ro: true, v: String(t.freq ?? '') });
      else if (L === 'E') out.push({ ...cell, k: '', ro: true, v: str(t.model) });
      else if (L === 'G' || L === 'H') out.push({ ...cell, k: L === 'G' ? 'asset' : 'serial', num: false, v: str(v[L === 'G' ? 'asset' : 'serial']) });
      else if (f) out.push({ ...cell, k: f.k, num: true, f, v: str(v[f.k]) });
      else if (EXTRA[L]) out.push({ ...cell, k: L, num: !!EXTRA[L][1], label: EXTRA[L][0], v: str(v[L]) });
    });
    const sf = FM202_FIELDS.find(f => f.k === 'sens');
    out.push({ n: t.n, col: '', x: G.sens[0], y, w: G.sens[1], h, k: 'sens', num: true, f: sf, v: str(v.sens) });
  }
  return out;
}

// คืน { edits: {ชีต: {ช่อง: ค่า}}, pages, missing: [ข้อความ] } · missing = สิ่งที่วางไม่ได้/ไม่มีข้อมูล ให้ผู้ใช้เห็นก่อนส่ง
export function map202(job) {
  const edits = {}, missing = [], tx = [...(job.tx || [])].sort((a, b) => a.n - b.n);
  const put = (n, ref, v) => { if (v === '' || v == null) return; const f = FMT[ref.replace(/\d+/, '')]; (edits[SHEETS[n]] ||= {})[ref] = f && typeof v === 'number' ? { v, fmt: f } : v; };
  let pages = 1;
  for (const t of tx) {
    if (!Number.isInteger(t.n) || t.n < 1 || t.n > MAX) { missing.push(`Tx ${t.n} (${t.freq}): ฟอร์มมี ${MAX} แถว (2 หน้า × ${PER_PAGE}) · วางไม่ได้`); continue; }
    const p = Math.floor((t.n - 1) / PER_PAGE), r = FIRST + (t.n - 1) % PER_PAGE, v = t.v || {};
    pages = Math.max(pages, p + 1);
    // รหัสเครื่องเป็นข้อความเสมอ (กันเลข 0 นำหน้าหาย) · Asset = ค่าที่ตรวจจากสติกเกอร์เท่านั้น ไม่ใช้ทะเบียนแทน
    put(p, 'B' + r, val(t.freq)); put(p, 'E' + r, str(t.model)); put(p, 'G' + r, str(v.asset)); put(p, 'H' + r, str(v.serial));
    const empty = [['Freq', t.freq], ['Model', t.model], ['Asset No (ยังไม่ตรวจสติกเกอร์)', v.asset], ['Serial', v.serial]].filter(([, x]) => !str(x)).map(([k]) => k);
    for (const f of FM202_FIELDS) {
      let x = val(v[f.k]);
      if (f.k === 'spur' && typeof x === 'number') x = Math.abs(x);   // แอปเก็บ −66 dBc · ฟอร์มที่ผู้ตรวจรับแล้วเขียนขนาด 66
      if (!f.col) { if (x !== '') missing.push(`Tx ${t.n}: ${f.n} = ${x} · ฟอร์มไม่มีช่อง (R = Squelch)`); continue; }
      if (x === '') empty.push(f.t); else put(p, f.col + r, x);
    }
    for (const c of Object.keys(EXTRA)) put(p, c + r, EXTRA[c][1] ? val(v[c]) : str(v[c]));   // ช่องที่กรอกได้เฉพาะหน้า "บนฟอร์ม" (เก็บที่ v[ตัวอักษรคอลัมน์])
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
  const blank = Object.keys(EXTRA).filter(c => tx.every(t => str((t.v || {})[c]) === ''));
  if (tx.length && blank.length) missing.push(`ทุกเครื่อง: ช่อง ${blank.join(', ')} ว่าง (${blank.map(c => EXTRA[c][0]).join(', ')}) · กรอกได้ที่หน้า "บนฟอร์ม"`);
  return { edits, pages, missing };
}

// templateBuf = ไบต์ของฟอร์มเปล่าจริง → { bytes: Uint8Array (.xlsx), pages, missing }
export async function fill202(templateBuf, job) {
  const m = map202(job);
  return { ...m, bytes: await fillXlsx(templateBuf, m.edits) };
}
