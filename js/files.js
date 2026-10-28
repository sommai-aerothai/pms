// ไฟล์แนบ → ผลต่อไฟล์ + เติมการ์ดฟอร์ม · อ่านไฟล์จริงด้วย readers/index.js (โหลดตอนใช้เท่านั้น: xlsx/docx/pdf.js/OCR)
// ที่นี่ทำแค่ "ตีความผล" เป็นแถวผลลัพธ์ + map ค่าฟอร์ม FM-202 เข้างาน
import { FM202_FIELDS } from './data/wi-scope.js';
import { formCodeFrom } from './flow.js';

export const isVideo = f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i.test(f.name);
// field ของ reader → คีย์ในแอป (sens ไม่ map: คอลัมน์ R ของฟอร์ม = squelch) · spur ในไฟล์เป็นขนาด dB ใต้ carrier (เช่น 66) → เก็บเป็นค่าลบ
const MAP = { error_hz: 'err', osc_vdc: 'osc', power_w: 'pow', spurious_dbc: 'spur', mod_pct: 'mod', distn_pct: 'dist', asset: 'asset', serial: 'serial' };
export function parse202(values, text = '') {
  const tx = {};
  for (const x of values) {
    const m = /^tx\[(\d+)\]\.(\w+)$/.exec(x.field); if (!m) continue;
    const t = (tx[m[1]] ||= { n: +m[1], freq: NaN, v: {} });
    if (m[2] === 'freq_mhz') t.freq = +x.value; else if (MAP[m[2]]) { let v = String(x.value); if (m[2] === 'spurious_dbc' && +v > 0) v = String(-v); t.v[MAP[m[2]]] = v; }
  }
  return { maint: ((/^A4:\s*(.+)$/m.exec(text) || [])[1] || '').trim(), rows: Object.values(tx).sort((a, b) => a.n - b.n) };
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
  if (!job.tx || !job.tx.length) job.tx = p.rows.map(r => ({ n: r.n, freq: r.freq, model: '', reg: r.v.asset || '', v: {}, photos: {} }));
  for (const r of p.rows) {
    const t = job.tx.find(x => x.n === r.n && x.freq === r.freq); if (!t) continue;
    t.pend ||= {};
    for (const [k, val] of Object.entries(r.v)) if (!String(t.v[k] ?? '').trim()) { t.v[k] = val; t.pend[k] = true; if (job.fields.some(f => f.k === k)) filled++; }
  }
  job.fileFilled = (job.fileFilled || 0) + filled; job.assetCheck ||= []; return filled;
}

// ผลของแต่ละไฟล์ → { state: filled|attached|unsorted|warn|rejected|error, target, text, read?, nvals?, warnRev? } · state เลือกไอคอน+คำ ไม่ใช้สีอย่างเดียว
export async function inspect(file, job, ctx) {
  const name = file.name || 'ไฟล์', byName = formCodeFrom(name);
  if (isVideo(file)) return { state: 'rejected', target: '', text: 'ไม่รับวิดีโอ · แนบรูปหรือเอกสารแทน' };
  let r;
  try { r = await (await import('./readers/index.js')).readFile(file, ctx); } catch { return { state: 'error', target: byName, text: 'อ่านไฟล์ไม่ได้ · แนบไว้เฉย ๆ' }; }
  const code = r.target && r.target.form || byName, tpl = ctx.templates.find(t => t.code === code), rev = r.target && r.target.rev, rv = rev && tpl && tpl.rev !== rev ? ` · ไฟล์ Rev.${rev} ล่าสุด Rev.${tpl.rev}` : '';
  const note = String(r.note || '').replace(/^\S+\s/, '');   // ตัดอีโมจิหน้าข้อความของ reader
  if (/^⚠|^⛔/.test(r.note || '')) return { state: 'warn', target: code, text: note + ' · แนบไว้' };
  if (code === 'FM-CE.SE-202' && r.values.length) {
    const p = parse202(r.values, r.text); if (!p.rows.length) return { state: 'warn', target: code, text: 'พบ FM-202 แต่ไม่เจอแถวเครื่องส่ง · แนบไว้' };
    if (!sameJob(p.maint, job)) return { state: 'warn', target: code, text: `ไฟล์ระบุ "${p.maint.replace(/^MaintID\s*/, '')}" ไม่ตรงกับงานนี้ · ไม่เติม` + rv };
    return { state: 'filled', target: code, text: `${p.rows.length} เครื่อง${rv}`, read: p, warnRev: !!rv };
  }
  if (code) return { state: 'attached', target: code, text: `จัดเข้า ${code}${rev ? ` Rev.${rev}` : ''}${r.values.length ? ` · อ่านได้ ${r.values.length} ค่า` : ' · ยังไม่มีค่าให้อ่าน'}${rv}`, nvals: r.values.length };
  return { state: 'unsorted', target: '', text: `${note || 'ยังไม่รู้ว่าเป็นฟอร์มไหน'} · เลือกเอง` };
}
