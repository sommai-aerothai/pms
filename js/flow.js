// ตรรกะ flow งาน PM (ไม่แตะ DOM/store → ทดสอบแยกได้ที่ tests/flow.test.mjs)
// ขั้นของงาน · ความพร้อม · ความคืบหน้าฟอร์ม · ตัวขัดขวาง (วันนี้) · ตารางงานเดือนนี้/เดือนหน้า
import { formsFor } from './data/wi-scope.js';
import { ORDER } from './data/schedule-2569.js';

export const STAGES = [['plan', 'แผน', 'งานโผล่จากตาราง PM · เปิดงาน'], ['notice', 'แจ้งซ่อม', 'นำเข้า FM-040 ที่อนุมัติ (QP 6.6)'], ['prep', 'เตรียม', 'เครื่องมือ FM-005 · WI/ฟอร์ม Rev ล่าสุด (QP 6.7)'],
  ['site', 'หน้างาน', 'ทำตาม WI ทีละอุปกรณ์ · ตรวจทรัพย์สิน · ทบทวนคู่มือ (QP 6.8)'], ['report', 'รายงาน', 'ออก FM-006 + แนบตามรายการ · ภายใน 20 วันทำการ (QP 6.9)'], ['send', 'ส่ง', 'ส่งผ่านสารบรรณ · ผู้ตรวจรับ (QP 6.9, 6.12)']];
const MO = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MO[m - 1]} ${String(y + 543).slice(2)}`; };
export const addMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number), t = y * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
export const fiscal = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return { fy: y + 543 + (m >= 10 ? 1 : 0), round: m >= 10 || m <= 3 ? 1 : 2 }; };

// ---------- ตาราง PM ----------
export const rowTitle = r => r.rotate ? r.job : `${r.job} ${r.round}/${String(ORDER.fy).slice(2)}`;
export const rowBase = r => r.job.replace(/\s*\(.*?\)\s*/g, ' ').trim();   // ตัดวงเล็บ (จุด/ชั้น) ไว้จับคู่ชื่อระบบ
export const sysFor = (title, systems) => ((systems || []).filter(s => title.startsWith(s.name)).sort((a, b) => b.name.length - a.name.length)[0] || {}).id || '';
export const navTitle = j => j.pm && j.pm.base && !j.pm.off ? `${rowBase({ job: j.pm.base })} ${j.round}` : j.title;
export const rowDur = r => r.days ? `${r.days} วัน` : r.range || '';
// รายการตารางที่ยังไม่เปิด จัดกลุ่ม เดือนนี้ / เดือนหน้า / ทั้งปี (today = YYYY-MM-DD) · ของฉัน (me) ขึ้นก่อนในกลุ่ม
export function scheduleGroups(rows, opened, today, me = '') {
  const m0 = today.slice(0, 7), m1 = addMonth(m0, 1), open = new Set(opened), L = rows.filter(r => !open.has(r.id)), mine = r => r.people.includes(me) ? 0 : 1;
  const by = f => L.filter(f).sort((a, b) => mine(a) - mine(b));
  return [['เดือนนี้', m0, by(r => r.ym === m0)], ['เดือนหน้า', m1, by(r => r.ym === m1)], ['ทั้งปี', '', by(r => r.ym !== m0 && r.ym !== m1)]];
}
// จับคู่หัวเรื่องสารบรรณกับแถวตาราง: ชื่อ (ไม่รวมวงเล็บ) อยู่ในหัวเรื่อง + ครั้งที่/ปี ตรงกัน · norm/roundOf มาจาก import-sarabun.js
export const matchRow = (rows, subject, norm, roundOf) => {
  const s = norm(subject), r = roundOf(subject); let best = null, len = 0;
  for (const x of rows) { const n = norm(rowBase(x)); if (!x.rotate && r && `${x.round}/${String(ORDER.fy).slice(2)}` === r && s.includes(n) && n.length > len) { best = x; len = n.length; } }
  return best;
};

// ---------- สร้างงานจากแถวตาราง (หรืองานนอกตาราง) ----------
const V = (v, src, loc, at, x = {}) => ({ v, src, loc, at, ...x });
export function newPmJob({ id, row, off, system, eng, travel, draft, prev = {}, now }) {
  const base = row ? row.job : off.name, round = row ? row.round : off.round, fy = ORDER.fy, at = now.slice(0, 10);
  const vals = {};
  const R = `${ORDER.src}${row ? ' · แถว ' + row.id.slice(-2) : ''}`;
  if (row) {
    vals.center = V(row.site, 'sched', R, at); vals.system = V(base, 'sched', R, at); vals.round = V(`${round}/${String(fy).slice(2)}`, 'sched', R, at);
    vals.people = V(row.people.join(', '), 'sched', R, at, { pending: true });
    vals.order = V(ORDER.no, 'sched', `${ORDER.src}`, at);
    vals.plan = V(ymLabel(row.ym) + (row.days ? ` · ${row.days} วัน` : ''), 'sched', R, at);
  } else vals.plan = V(`นอกตาราง · ${off.days} วัน`, 'manual', 'กรอกเอง', at, { reason: off.reason });
  if (eng) vals.eng = V(eng, prev.eng && prev.eng.includes(eng) ? 'prev' : 'manual', prev.eng && prev.eng.includes(eng) ? 'วิศวกรเฝ้าระวังรอบก่อน' : 'กรอกเอง', at);
  if (travel) vals.travel = V(travel, prev.travel === travel ? 'prev' : 'manual', prev.travel === travel ? 'จำต่อสถานี' : 'กรอกเอง', at);
  const title = row ? rowTitle(row) : `${off.name} ${off.round}/${String(fy).slice(2)}`;
  return { schema: 2, id, title, round: `${round}/${String(fy).slice(2)}`, system: system || '', site: row ? row.site : 'อื่น ๆ', dates: off ? [off.start, addDays(off.start, off.days - 1)] : null, status: 'doing', touched: now,
    pm: { base, fy, ym: row ? row.ym : '', days: row ? row.days : off.days, people: row ? [...row.people] : [], sched: row ? row.id : '', off: !row, order: row ? ORDER.no : '' },
    f040: 'wait', draft: !!draft, eng: eng || '', travel: travel || '', vals, forms: formsFor(base), tools: (prev.tools || []).map(t => ({ ...t, photo: '' })), ready: {}, auto: true, files: [], cur: 1, letter: !!row };
}
// ให้งานเก่า/งานจาก backend (โครงเดิม) มีค่าตั้งต้นครบ — ไม่ทับค่าที่มี
export function normJob(j) {
  const x = { f040: j.status === 'done' ? 'approved' : 'wait', draft: false, eng: '', travel: '', vals: {}, ready: {}, auto: true, files: [], tools: [], pm: { base: j.title, days: null, people: [], off: false }, ...j };
  x.forms = (x.forms || []).map(f => ({ kind: 'manual', ...f, kind: ['tx', 'asset', 'review'].includes(f.kind) ? f.kind : 'manual', done: f.done ?? f.kind === 'done' }));
  return x;
}

// ---------- วันที่ ----------
export const addDays = (iso, n) => new Date(Date.parse(iso.slice(0, 10)) + n * 864e5).toISOString().slice(0, 10);
const dow = iso => new Date(iso.slice(0, 10) + 'T00:00:00Z').getUTCDay();
export function addWorkdays(iso, n) { let d = iso.slice(0, 10); while (n > 0) { d = addDays(d, 1); if (dow(d) % 6) n--; } return d; }   // ponytail: ข้ามเสาร์-อาทิตย์ ยังไม่รู้วันหยุดนักขัตฤกษ์
export function workdaysBetween(a, b) { let n = 0, d = a.slice(0, 10); const s = a <= b ? 1 : -1; while (d !== b.slice(0, 10)) { d = addDays(d, s); if (dow(d) % 6) n += s; } return n; }
export const deadline = (j, today) => { if (!j.dates) return null; const due = addWorkdays(j.dates[1], 20); return { due, left: workdaysBetween(today, due) }; };
export const daysUntil = (iso, today) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(today)) / 864e5);

// ---------- ความคืบหน้าฟอร์ม ----------
const MEASURE = j => (j.fields || []).map(f => f.k);
export const txDone = (j, t) => MEASURE(j).every(k => String(t.v[k] ?? '').trim() !== '');
export const bad = (f, v) => { const x = parseFloat(v); return v !== '' && !isNaN(x) && (x < f.min || x > f.max); };
export const txDoneCount = j => (j.tx || []).filter(t => txDone(j, t)).length;
export const assetState = t => { const g = (t.v.asset || '').trim(); return !g ? ['todo', 'ยังไม่ตรวจ'] : g === t.reg ? ['ok', 'ตรงทะเบียน'] : ['warn', `ไม่ตรง ${g}`]; };
export const assetOk = j => (j.assetCheck || []).filter(n => assetState(j.tx[n - 1])[0] === 'ok').length;
// → { done, total, text, sub } · done = ค่าที่ยืนยันแล้ว (ค่าที่เติมจากไฟล์และยังรอยืนยันไม่นับ) · ครบ = total>0 && done===total
export function formProg(j, f) {
  if (f.kind === 'tx') {
    const tx = j.tx || [], fl = j.fields || [], total = tx.length * fl.length;
    if (!total) return { done: 0, total: 0, text: 'ยังไม่มีไฟล์ · กรอกเอง', sub: '' };
    let filled = 0, pend = 0; tx.forEach(t => fl.forEach(x => { if (String(t.v[x.k] ?? '').trim() !== '') { filled++; if (t.pend && t.pend[x.k]) pend++; } }));
    return { done: filled - pend, total, filled, pend, text: `เติมจากไฟล์ ${j.fileFilled || 0}/${total} · เหลือกรอกเอง ${total - filled}`, sub: pend ? `รอยืนยัน ${pend} ช่อง` : '' };
  }
  if (f.kind === 'asset' && (j.assetCheck || []).length) { const n = j.assetCheck.length, k = assetOk(j); return { done: k, total: n, text: k === n ? 'ตรงทะเบียนครบ' : `ตรวจแล้ว ${k}/${n} รายการ`, sub: '' }; }
  return { done: f.done ? 1 : 0, total: 1, text: f.done ? 'ทำแล้ว' : 'ยังไม่ได้ทำ', sub: f.fileName ? `ไฟล์แนบ · ${f.fileName}` : '' };
}
export const formOk = (j, f) => { const p = formProg(j, f); return p.total > 0 && p.done === p.total; };
export const formsDone = j => j.forms.filter(f => formOk(j, f)).length;
export function jobProg(j) { let d = 0, t = 0; j.forms.forEach(f => { const p = formProg(j, f); if (p.total) { d += p.done / p.total; } t += 1; }); return { done: d, total: t, frac: t ? d / t : 0 }; }

// ---------- ความพร้อม (ขั้นเตรียม · QP 6.7) ----------
// auto = ระบบตรวจเอง · manual = ผู้ใช้ติ๊ก (j.ready[id]) · ok/needs: ตรวจจาก ctx = { templates, docs, today }
export function prepChecks(j, ctx) {
  const end = j.dates ? j.dates[1] : ctx.today, codes = new Set(j.forms.map(f => f.code)), fresh = ctx.templates.filter(t => t.isNew && codes.has(t.code));
  const exp = (j.tools || []).filter(t => t.due < end);
  return [
    { id: 'rev', label: 'ฟอร์ม/WI เป็น Rev ล่าสุด', auto: !fresh.length || !!j.ready.rev, manual: true, note: fresh.length && !j.ready.rev ? `${fresh.map(t => `${t.code} Rev.${t.rev}`).join(', ')} ใหม่ · แตะเมื่อโหลดแล้ว` : '' },
    { id: 'cal', label: 'เครื่องมือวัด calibration ไม่หมดอายุก่อนงานจบ', auto: !!(j.tools || []).length && !exp.length, note: !(j.tools || []).length ? 'ยังไม่ได้ลงเครื่องมือ' : exp.length ? `หมดอายุ: ${exp.map(t => t.name).join(', ')}` : '', go: 'tools' },
    { id: 'prev', label: 'รายงานรอบก่อน (FM-006) พร้อมดู', auto: true, note: ctx.docs.some(d => d.system === j.system) ? '' : 'ยังไม่มีรายงานรอบก่อนของระบบนี้ในระบบ' },
    { id: 'f005', label: 'FM-005 ผู้จัดการทบทวนและลงนาม', auto: !!j.ready.f005, manual: true },
    { id: 'man', label: 'FM-001/002 · คู่มือ · Technical Manual ตรวจแล้ว', auto: !!j.ready.man, manual: true },
  ];
}
export const prepOk = (j, ctx) => prepChecks(j, ctx).every(c => c.auto);
export const stageOf = (j, ctx) => j.status === 'done' ? 5 : j.f040 !== 'approved' ? 1 : !prepOk(j, ctx) ? 2 : j.forms.every(f => formOk(j, f)) ? 4 : 3;
export const isReady = (j, ctx) => stageOf(j, ctx) === 4;
// ตัวขัดขวางตัวแรก → { text, cap, spot } · spot ใช้เลื่อนไปที่จุดนั้นบนหน้างาน
export function blocker(j, ctx) {
  const f = j.forms.find(x => !formOk(j, x));
  if (j.f040 !== 'approved') return { text: 'รอ FM-040 ที่อนุมัติ', cap: 'นำเข้า FM-040', spot: 'f040' };
  const c = prepChecks(j, ctx).find(x => !x.auto); if (c) return { text: `ตรวจความพร้อม: ${c.label}`, cap: 'ไปตรวจ', spot: 'prep' };
  if (f) { const p = formProg(j, f); return { text: `${f.code ? f.code + ' ' : ''}${f.name}${p.total > 1 ? ` · เหลือ ${p.total - p.done} ช่อง` : ''}`, cap: 'ไปกรอก', spot: 'form:' + (f.code || 'review') }; }
  return { text: 'ฟอร์มครบแล้ว · พร้อมสร้างรายงาน', cap: 'สร้างรายงาน', spot: 'cta' };
}
// CTA "สร้างรายงาน" ไม่พร้อม → ไปฟอร์มแรกที่ยังไม่เสร็จ (ไม่มีฟอร์มค้าง = ข้อค้างของ 040/เตรียม)
export const firstGap = (j, ctx) => { const f = j.forms.find(x => !formOk(j, x)); return f ? 'form:' + (f.code || 'review') : blocker(j, ctx).spot; };
export const rowReason = (j, ctx) => { const s = stageOf(j, ctx); return `${STAGES[s][1]} · ${s === 4 ? 'พร้อมสร้างรายงาน' : blocker(j, ctx).text}`; };

// ---------- ไฟล์แนบ: ผลของแต่ละไฟล์ ----------
export const FM_RE = /FM[-\s_.]*(?:CE\.?\s*SE)?[-\s_.]*0*(\d{2,3})/i;
export const formCodeFrom = s => { const m = FM_RE.exec(String(s)); return m ? 'FM-CE.SE-' + m[1].padStart(3, '0') : ''; };
