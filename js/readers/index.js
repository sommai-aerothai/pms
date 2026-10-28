// readFile(file, ctx) → { kind, target, confidence, values, text?, note }
// อ่านในเครื่องทั้งหมด · ไม่มี network นอกจากโหลดไฟล์ vendor · ไม่ eval เนื้อหา
import { readXlsx } from './xlsx.js';
import { detectForm, detectXlsxForm, XLSX_MAPS } from './forms.js';
import { readDocx } from './docx.js';
import { parseCsv, csvValues } from './text.js';

export const MAX_BYTES = 25 * 1024 * 1024;
const NOTE_LEGACY = 'รูปแบบเก่า · บันทึกเป็น .docx/.xlsx ก่อน';
const res = (kind, o = {}) => ({ kind, target: null, confidence: 'low', values: [], note: '', ...o });

// รหัสฟอร์มในแอป (files.js/flow) เป็นรหัสเต็มของกอง · ฝั่ง fieldsheet ใช้ชื่อสั้น
const CANON = { 'FM-202': 'FM-CE.SE-202', 'FM-501': 'FM-CE.SE-501', 'FM-502': 'FM-CE.SE-502' };
const ext = n => (/\.([a-z0-9]+)$/i.exec(n) || [])[1]?.toLowerCase() || '';
const head = async f => new Uint8Array(await f.slice(0, 8).arrayBuffer());
const isZip = h => h[0] === 0x50 && h[1] === 0x4b, isOle = h => h[0] === 0xd0 && h[1] === 0xcf, isPdf = h => h[0] === 0x25 && h[1] === 0x50;

export async function readFile(file, ctx = {}) {
  if (file.size > MAX_BYTES) return res('unknown', { note: `⛔ ไฟล์ใหญ่เกิน 25 MB (${(file.size / 1048576).toFixed(1)} MB)` });
  if (/^video\//.test(file.type) || /^(mp4|mov|m4v|avi|mkv|webm)$/.test(ext(file.name))) return res('unknown', { note: '🎬 วิดีโอ · เก็บไว้เป็นไฟล์แนบ ไม่อ่านเนื้อหา' });
  const h = await head(file), e = ext(file.name);
  try {
    if (isOle(h) || e === 'doc' || e === 'xls') return res('legacy', { note: NOTE_LEGACY });
    if (isPdf(h) || e === 'pdf') return await pdf(file);
    if (isZip(h) && (e === 'xlsx' || e === 'xlsm')) return await xlsx(file);
    if (isZip(h) && e === 'docx') return await docx(file);
    if (file.type.startsWith('image/') || /^(jpe?g|png|heic|heif|webp|gif|bmp)$/.test(e)) return await image(file, ctx);
    if (e === 'txt' || e === 'csv' || e === 'tsv' || file.type.startsWith('text/')) return await text(file, e);
    if (isZip(h)) return res('unknown', { note: '❔ ไฟล์ ZIP · ไม่รู้จักรูปแบบ' });
    return res('unknown', { note: '❔ ไม่รู้จักรูปแบบไฟล์' });
  } catch (err) {
    return res(e === 'xlsx' ? 'xlsx' : e === 'docx' ? 'docx' : e === 'pdf' ? 'pdf' : 'unknown', { note: '⚠ อ่านไฟล์ไม่ได้ · ' + (err.message || err) });
  }
}

async function xlsx(file) {
  const { sheets } = await readXlsx(await file.arrayBuffer());
  const vis = sheets.filter(s => !s.hidden);
  const det = vis.map(detectXlsxForm).find(Boolean);
  const text = vis.map(s => `## ${s.name}\n` + Object.entries(s.cells).map(([k, v]) => `${k}: ${v}`).join('\n')).join('\n');
  if (!det) return res('xlsx', { text, note: '📊 xlsx · ไม่รู้จักฟอร์ม (อ่านเป็นข้อความ)' });
  const map = XLSX_MAPS[det.form];
  const values = map ? map(vis) : [];
  const target = { form: det.form, ...(det.rev && { rev: det.rev }) };
  if (/^Page\s*(\d)/i.test(vis[0]?.name) && vis.length === 1) target.page = +/(\d)/.exec(vis[0].name)[1];
  return res('xlsx', { target, values, text, confidence: values.length ? 'high' : 'medium', note: `📊 ${det.form}${det.rev ? ' Rev.' + det.rev : ''}${values.length ? ' · ' + values.length + ' ค่า' : ' · ยังไม่อ่านค่า'}` });
}

async function docx(file) {
  const { text, headerText } = await readDocx(await file.arrayBuffer());
  const d = detectForm(headerText) || detectForm(text);
  return res('docx', { text, target: d ? { form: d.form, ...(d.rev && { rev: d.rev }) } : null, confidence: d ? 'medium' : 'low', note: d ? `📝 ${d.form}` : '📝 docx · ไม่รู้จักฟอร์ม (อ่านเป็นข้อความ)' });
}

async function pdf(file) {
  const { readPdf } = await import('./pdf.js');
  const r = await readPdf(await file.arrayBuffer());
  const f = r.forms[0];
  const target = f ? { form: f.form, page: f.page, ...(f.rev && { rev: f.rev }) } : null;
  const conf = r.values.length && f ? 'high' : f ? 'medium' : 'low';
  const note = !r.hasText && !r.values.length ? '🖨 PDF สแกน · ไม่มีข้อความ (ต้อง OCR ทีละหน้า)'
    : `📕 PDF ${r.numPages} หน้า${f ? ' · ' + f.form + ' หน้า ' + f.page : ''}${r.forms.length > 1 ? ` (+${r.forms.length - 1} ฟอร์ม)` : ''}${r.values.length ? ' · ' + r.values.length + ' ช่องกรอก' : ''}`;
  return res('pdf', { target, values: r.values, text: r.text, confidence: conf, forms: r.forms, note });
}

async function image(file, ctx) {
  // ใบจดค่าหน้างาน (มี QR ของเรา) → อ่านตัวเลขในเครื่อง · ไม่ใช่ → OCR เดิม
  const fs = await import('../fieldsheet/read.js').then(m => m.readFieldSheet(file)).catch(() => null);
  if (fs) {
    const n = fs.values.filter(v => v.value != null).length, low = fs.values.length - n, t = { form: CANON[fs.meta.f] || fs.meta.f, page: fs.meta.p, job: fs.meta.j };
    return res('image', { target: t, sheet: { job: fs.meta.j, page: fs.meta.p, layout: fs.meta.l }, values: fs.values, confidence: !fs.ok ? 'low' : low ? 'medium' : 'high', subkind: 'fieldsheet',
      note: fs.ok ? `✍ ใบจดค่าหน้างาน ${t.form} หน้า ${t.page} · อ่านได้ ${n} ค่า${low ? ` · ${low} ค่าต้องตรวจเอง` : ''}` : '⚠ ใบจดค่าหน้างาน · ' + fs.note + ' · ถ่ายใหม่' });   // ⚠ = inspect() แสดงเป็นคำเตือนพร้อมวิธีแก้
  }
  const { readImage } = await import('./image.js');
  const r = await readImage(file, ctx);
  if (!r.target || /202/.test(r.target.form || '')) {   // ไม่ใช่ใบจดค่า/สติกเกอร์/จอวัด → ลองฟอร์มทางการที่เขียนมือ (FM-202) · แม่นยำต่ำกว่าใบจดค่า จึงไม่ให้ confidence high
    const o = await import('../fieldsheet/official.js').then(m => m.readOfficial(file, { ocr: true })).catch(() => null);
    if (o?.ok && o.values.length) {
      const n = o.values.filter(v => v.value != null).length;
      return res('image', { target: { form: CANON[o.meta.form] || o.meta.form, rev: o.meta.rev, page: o.meta.page }, text: o.text, values: o.values, confidence: 'medium', subkind: 'official-handwriting',
        note: `✍ ${o.meta.form} หน้า ${o.meta.page} (ลายมือบนฟอร์มจริง) · อ่านได้ ${n} ค่า · ${o.values.length - n} ค่าต้องตรวจเอง · ตรวจทุกค่าก่อนใช้` });
    }
  }
  return res('image', { target: r.target, values: r.values, text: r.text, confidence: r.confidence, note: r.note, subkind: r.kind });
}

async function text(file, e) {
  const t = await file.text();
  const d = detectForm(t);
  let values = [];
  if (e === 'csv' || e === 'tsv') values = csvValues(parseCsv(t));
  return res('text', { text: t.slice(0, 200000), values, target: d ? { form: d.form } : null, confidence: values.length ? 'medium' : 'low', note: e === 'txt' ? '📄 ข้อความ' : `📄 CSV · ${values.length} ค่า` });
}
