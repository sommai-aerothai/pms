// อ่านไฟล์แนบในเครื่อง (ไม่มีไลบรารี): .xlsx/.docx = zip + XML ด้วย DecompressionStream · ไม่ส่งไฟล์ออกนอกเครื่อง
// PDF/รูป: ตอนนี้จัดเข้าฟอร์มตามชื่อไฟล์/ชนิดเท่านั้น (pdf.js · OCR · QR = PR ถัดไป)
import { FM202_FIELDS } from './data/wi-scope.js';
import { formCodeFrom } from './flow.js';

const td = new TextDecoder(), MAX_UNZIP = 40e6, MAX_READ = 25e6;
export const isVideo = f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i.test(f.name);

export async function unzip(buf) {
  const v = new DataView(buf), u = new Uint8Array(buf); let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ไม่ใช่ไฟล์ zip');
  const n = v.getUint16(e + 10, true), ent = new Map(); let p = v.getUint32(e + 16, true);
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('zip เสีย');
    const nl = v.getUint16(p + 28, true);
    ent.set(td.decode(u.subarray(p + 46, p + 46 + nl)), { m: v.getUint16(p + 10, true), c: v.getUint32(p + 20, true), s: v.getUint32(p + 24, true), o: v.getUint32(p + 42, true) });
    p += 46 + nl + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return {
    has: name => ent.has(name),
    async text(name) {
      const x = ent.get(name); if (!x) return null; if (x.s > MAX_UNZIP) throw new Error('ไฟล์ใหญ่เกิน');
      const o = x.o + 30 + v.getUint16(x.o + 26, true) + v.getUint16(x.o + 28, true), d = u.subarray(o, o + x.c);
      if (x.m === 0) return td.decode(d);
      if (x.m !== 8) throw new Error('zip แบบบีบอัดนี้ไม่รองรับ');
      return td.decode(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    },
  };
}
const unx = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&amp;/g, '&');
const tText = x => unx([...x.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));

// ---- xlsx → [{ name, cell(ref) }] ----
export async function readXlsx(buf) {
  const z = await unzip(buf), wb = await z.text('xl/workbook.xml'); if (!wb) throw new Error('ไม่ใช่ xlsx');
  const ss = [...((await z.text('xl/sharedStrings.xml')) || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => tText(m[1]));
  const rel = Object.fromEntries([...((await z.text('xl/_rels/workbook.xml.rels')) || '').matchAll(/<Relationship\b[^>]*>/g)].map(m => [/Id="([^"]+)"/.exec(m[0])?.[1], /Target="([^"]+)"/.exec(m[0])?.[1]]));
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unx(/name="([^"]*)"/.exec(m[0])?.[1] || ''), hidden = /state="(hidden|veryHidden)"/.test(m[0]), t = rel[/r:id="([^"]+)"/.exec(m[0])?.[1]]; if (!t || hidden) continue;
    const xml = await z.text(t.startsWith('/') ? t.slice(1) : 'xl/' + t), cells = new Map(); if (!xml) continue;
    for (const c of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = c[3] || '', ty = /t="(\w+)"/.exec(c[2])?.[1], v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const val = ty === 's' ? ss[+v] : ty === 'inlineStr' ? tText(body) : v !== undefined ? unx(v) : '';
      if (val !== undefined && val !== '') cells.set(c[1], String(val).trim());
    }
    sheets.push({ name, cell: r => cells.get(r) ?? '' });
  }
  return sheets;
}
// ---- docx → ข้อความล้วน ----
export async function readDocx(buf) { const z = await unzip(buf), x = await z.text('word/document.xml'); if (!x) throw new Error('ไม่ใช่ docx'); return [...x.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(p => tText(p[0])).join('\n'); }

// ---- ฟอร์มทางการ: รหัส + Rev จากหัวฟอร์ม (แถว 1-3 ของ xlsx) ----
const idOf = s => { let code = '', rev = ''; for (let r = 1; r <= 3 && !code; r++) for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { const t = s.cell(c + r); if (!code && /^FM-CE\.SE-\d{3}$/.test(t)) code = t; } 
  for (let r = 1; r <= 3 && !rev; r++) for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (/^Rev\.?$/.test(s.cell(c + r))) { for (const d of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(c) + 1)) { const t = s.cell(d + r); if (t) { rev = t; break; } } break; }
  return { code, rev }; };
const num = t => { if (t === '' || t === '-') return t; const x = +t; return isNaN(x) ? t : String(+x.toFixed(4)); };
// FM-CE.SE-202: แถวข้อมูล = 1 เครื่องส่ง ตั้งแต่แถว 9 (คอลัมน์ A = เลขที่) · map ค่า Ind ตาม FM202_FIELDS.col
export function parse202(sheets) {
  const rows = []; let meta = null;
  for (const s of sheets) {
    const id = idOf(s); if (id.code !== 'FM-CE.SE-202') continue;
    if (!meta) meta = { rev: id.rev, maint: s.cell('A4'), crew: [s.cell('C27'), s.cell('F27')].map(x => x.replace(/^\d+\.\s*/, '')).filter(Boolean) };
    for (let r = 9; r <= 26; r++) {
      const n = +s.cell('A' + r); if (!n || isNaN(n)) continue;
      const v = { asset: s.cell('G' + r), serial: s.cell('H' + r) };
      FM202_FIELDS.forEach(f => { if (!f.col) return; let t = num(s.cell(f.col + r)); if (f.k === 'spur' && t !== '' && t !== '-' && +t > 0) t = String(-t); if (t !== '') v[f.k] = t; });
      rows.push({ n, freq: +s.cell('B' + r), ms: s.cell('C' + r), fn: s.cell('D' + r), model: s.cell('E' + r), v });
    }
  }
  return meta ? { ...meta, rows } : null;
}
// ชื่อสถานี+รอบในหัวฟอร์ม ("PM DM Tx Radio STBY ครั้งที่ 2/69") ตรงกับงานหรือไม่ — ไม่ตรง = ไม่เติม (ห้ามเอาค่ารอบอื่นมาใส่)
const nrm = s => String(s).toLowerCase().replace(/[ัำิ-ฺ็-๎]/g, '').replace(/[๐-๙]/g, c => '๐๑๒๓๔๕๖๗๘๙'.indexOf(c)).replace(/\s+/g, ' ').trim();
export function sameJob(maint, job) {
  const m = /(\d)\s*\/\s*(\d{2,4})\s*$/.exec(maint), base = nrm((job.pm && job.pm.base || job.title).replace(/\s*\(.*?\)\s*/g, ' '));
  return !!m && `${m[1]}/${m[2].slice(-2)}` === job.round && nrm(maint).includes(base);
}
// ใส่ลงงาน (คืนจำนวนช่องที่เติม) · ไม่ทับค่าที่ผู้ใช้กรอกแล้ว · ช่องที่เติม = รอยืนยัน (t.pend)
export function apply202(job, p) {
  job.fields ||= FM202_FIELDS.map(({ col, ...f }) => f); let filled = 0;
  if (!job.tx || !job.tx.length) job.tx = p.rows.map(r => ({ n: r.n, freq: r.freq, model: r.model, reg: r.v.asset, v: {}, photos: {}, ms: r.ms, fn: r.fn }));
  for (const r of p.rows) {
    const t = job.tx.find(x => x.n === r.n && x.freq === r.freq); if (!t) continue;
    t.pend ||= {};
    for (const [k, val] of Object.entries(r.v)) if (!String(t.v[k] ?? '').trim()) { t.v[k] = val; t.pend[k] = true; if (job.fields.some(f => f.k === k)) filled++; }
  }
  job.fileFilled = (job.fileFilled || 0) + filled; job.assetCheck ||= []; return filled;
}

// ---- ผลของแต่ละไฟล์ (แถวผลลัพธ์ในการ์ดไฟล์แนบ) ----
// คืน { state: filled|attached|unsorted|warn|rejected|error, target, text, read? } · state ใช้เลือกไอคอน+คำ ไม่ใช้สีอย่างเดียว
export async function inspect(file, job, ctx) {
  const name = file.name || 'ไฟล์', ext = (/\.(\w+)$/.exec(name) || [])[1]?.toLowerCase() || '', byName = formCodeFrom(name);
  if (isVideo(file)) return { state: 'rejected', target: '', text: 'ไม่รับวิดีโอ · แนบรูปหรือเอกสารแทน' };
  try {
    if (ext === 'xlsx' || ext === 'docx') {
      if (file.size > MAX_READ) return { state: 'attached', target: byName, text: 'ไฟล์ใหญ่เกินอ่านในเครื่อง · แนบไว้เฉย ๆ' };
      const buf = await file.arrayBuffer();
      if (ext === 'docx') { const t = await readDocx(buf), c = formCodeFrom(t.slice(0, 600)) || byName; return c ? { state: 'attached', target: c, text: `จัดเข้า ${c} · ยังไม่อ่านค่าจาก Word (PR ถัดไป)` } : { state: 'unsorted', target: '', text: 'ยังไม่รู้ว่าเป็นฟอร์มไหน · เลือกเอง' }; }
      const sh = await readXlsx(buf), id = sh.map(idOf).find(x => x.code) || { code: byName, rev: '' }, tpl = ctx.templates.find(t => t.code === id.code), rv = id.rev && tpl && tpl.rev !== id.rev ? ` · ไฟล์ Rev.${id.rev} ล่าสุด Rev.${tpl.rev}` : '';
      if (id.code === 'FM-CE.SE-202') {
        const p = parse202(sh); if (!p || !p.rows.length) return { state: 'warn', target: id.code, text: 'พบ FM-202 แต่ไม่เจอแถวเครื่องส่ง · แนบไว้' };
        if (!sameJob(p.maint, job)) return { state: 'warn', target: id.code, text: `ไฟล์ระบุ "${p.maint.replace(/^MaintID\s*/, '')}" ไม่ตรงกับงานนี้ · ไม่เติม` + rv };
        return { state: 'filled', target: id.code, text: `${p.rows.length} เครื่อง${rv}`, read: p, warnRev: !!rv };
      }
      return id.code ? { state: 'attached', target: id.code, text: `จัดเข้า ${id.code}${id.rev ? ` Rev.${id.rev}` : ''} · ยังไม่อ่านค่า (PR ถัดไป)${rv}` } : { state: 'unsorted', target: '', text: 'ยังไม่รู้ว่าเป็นฟอร์มไหน · เลือกเอง' };
    }
  } catch (e) { return { state: 'error', target: byName, text: 'อ่านไฟล์ไม่ได้ · แนบไว้เฉย ๆ' }; }
  if (byName) return { state: 'attached', target: byName, text: `จัดเข้า ${byName} จากชื่อไฟล์ · ${ext === 'pdf' ? 'อ่านค่าด้วย pdf.js ใน PR ถัดไป' : 'ยังไม่อ่านค่า'}` };
  if (/^image\//.test(file.type) || /^(jpe?g|png|heic|heif|webp)$/.test(ext)) {
    if (/spur|spectrum|สเปก/i.test(name)) return { state: 'attached', target: 'FM-CE.SE-204', text: 'จัดเข้า FM-CE.SE-204 (spectrum) จากชื่อไฟล์' };
    return { state: 'unsorted', target: '', text: 'รูป · ยังจัดเข้าฟอร์มไม่ได้ (อ่านจอ/ป้าย/QR ใน PR ถัดไป) · เลือกเอง' };
  }
  return { state: 'unsorted', target: '', text: 'แนบไว้ · ยังไม่รู้ว่าเป็นฟอร์มไหน · เลือกเอง' };
}
