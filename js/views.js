// หน้าจอทั้งหมด = ฟังก์ชันรับ state คืน HTML (template literal) · ไม่มี framework
import * as store from './store.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ic = (n, c = '') => `<svg class="ic ${c}"><use href="./ui/icons.svg#i-${n}"/></svg>`;
const MO = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// ปีงบประมาณไทย (เริ่ม 1 ต.ค.) + รอบ: ต.ค.–มี.ค. = ครั้งที่ 1 · เม.ย.–ก.ย. = ครั้งที่ 2
export const fiscal = iso => { const [y, m] = ymd(iso); return { fy: y + 543 + (m >= 10 ? 1 : 0), round: m >= 10 || m <= 3 ? 1 : 2 }; };
const ymd = iso => iso.slice(0, 10).split('-').map(Number);
export const dShort = iso => { const [, m, d] = ymd(iso); return `${d} ${MO[m - 1]}`; };
export const dFull = iso => { const [y, m, d] = ymd(iso); return `${d} ${MO[m - 1]} ${y + 543}`; };
const dRange = ([a, b]) => { const [y, , d1] = ymd(a), [, m2, d2] = ymd(b); return `${d1}–${d2} ${MO[m2 - 1]} ${String(y + 543).slice(2)}`; };
const when = iso => { const days = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(iso.slice(0, 10))) / 864e5); return days <= 0 ? 'วันนี้' : days === 1 ? 'เมื่อวาน' : dShort(iso); };
const hhmm = iso => { const t = new Date(iso); return `${String((t.getUTCHours() + 7) % 24).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`; };

const ST = { app: ['doc', ''], ok: ['done', ''], todo: ['circle', ''], warn: ['warn', 'w'], dl: ['dl', ''], cloud: ['cloud', ''] };
const st = (k, text, c = '') => `<span class="st ${ST[k][1]} ${c}">${ic(ST[k][0])}${esc(text)}</span>`;
const DOC_ST = { draft: ['todo', 'ร่าง'], review: ['todo', 'รอตรวจ'], accepted: ['ok', 'ผู้ตรวจรับแล้ว'] };
const chev = ic('chev', 'ch');
const nav = (title, back, acts = '') => back == null
  ? `<div class="nav"><span></span><b class="nt">${esc(title)}</b><span></span></div>`
  : `<div class="nav"><a class="back" href="#" data-back>${ic('back')}<span>${esc(back)}</span></a><b class="nt">${esc(title)}</b><span class="acts">${acts}</span></div>`;
const ptr = `<div class="ptr">${ic('sync')}<span></span></div>`;
const sw = (on, attrs) => `<button class="sw" role="switch" aria-checked="${on}" ${attrs}><i></i><span>${on ? 'เปิด' : 'ปิด'}</span></button>`;
const swrx = (row, attr, icon, label) => `<div class="swr">${row}<button class="swa" ${attr}>${ic(icon)}${label}</button></div>`;
const swr = (row, id, on) => swrx(row, `data-off-act="${esc(id)}"`, on ? 'trash' : 'dl', on ? 'ลบออก' : 'ตั้งเก็บ offline');
const skel = n => `<div class="grp sk">${'<div class="row"><span class="rt"><i class="l1"></i><i class="l2"></i></span></div>'.repeat(n)}</div>`;
// ถ้ามีรูปแล้ว แตะ = เปิดดู/ถ่ายใหม่/ลบ · ยังไม่มี = เปิดกล้อง
const camBtn = (S, key, id, label) => S.ph[id] ? `<button type="button" class="cam" data-sheet="photo:${key}" aria-label="${label} (ดูรูป)"><img src="${S.ph[id]}" alt=""></button>` : `<button type="button" class="cam" data-cam="${key}" aria-label="${label}">${ic('cam')}</button>`;

// ---------- สถานะงาน (คำนวณจากค่าที่กรอกจริง) ----------
const MEASURE = j => j.fields.map(f => f.k);
export const txDone = (j, t) => MEASURE(j).every(k => String(t.v[k] ?? '').trim() !== '');
export const bad = (f, v) => { const x = parseFloat(v); return v !== '' && !isNaN(x) && (x < f.min || x > f.max); };
export const txDoneCount = j => j.tx.filter(t => txDone(j, t)).length;
const assetState = (t) => { const g = (t.v.asset || '').trim(); return !g ? ['todo', 'ยังไม่ตรวจ'] : g === t.reg ? ['ok', 'ตรงทะเบียน'] : ['warn', `ไม่ตรง ${g}`]; };
const assetOk = j => j.assetCheck.filter(n => assetState(j.tx[n - 1])[0] === 'ok').length;
export function formState(j, f) {
  if (f.kind === 'tx') { const k = txDoneCount(j); return k === j.tx.length ? [1, 'ok', 'เสร็จแล้ว'] : k ? [0, 'todo', `กำลังทำ ${k}/${j.tx.length}`] : [0, 'todo', 'ยังไม่เริ่ม']; }
  if (f.kind === 'asset') { const k = assetOk(j), n = j.assetCheck.length; return k === n ? [1, 'ok', 'เสร็จแล้ว'] : k ? [0, 'todo', `กำลังทำ ${k}/${n} รายการ`] : [0, 'todo', 'ยังไม่เริ่ม']; }
  return f.kind === 'done' ? [1, 'ok', 'เสร็จแล้ว'] : [0, 'todo', 'ยังไม่เริ่ม'];
}
export const formsDone = j => j.forms.filter(f => formState(j, f)[0]).length;
const expired = j => j.tools.filter(t => Date.parse(t.due) < Date.now());
const sysName = (S, id) => (S.catalog.systems.find(s => s.id === id) || {}).name || id;

// ---------- วันนี้ ----------
const bkk = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());   // YYYY-MM-DD ตามเวลาไทย
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const act = (href, label, pre = '') => `<a class="btn" href="${href}"${pre ? ` data-pre="${pre}"` : ''}>${label}</a>`;
// งานที่แตะล่าสุดในกลุ่ม "กำลังทำ" (touched อัปเดตทุกครั้งที่บันทึก)
export const recent = S => S.jobs.filter(j => j.status === 'doing').sort((a, b) => b.touched.localeCompare(a.touched))[0];
export function today(S) {
  const j = recent(S), prev = S.docs.find(d => d.id === 'tx-stby-2569-2-69'), base = j && `#/pm/${j.id}`;
  const tx = j && j.tx, ft = tx && tx.find(t => !txDone(j, t)), loc = j && (S.catalog.systems.find(x => x.id === j.system) || {}).loc || '';
  const [k, n] = ft ? [txDoneCount(j), tx.length] : j ? [formsDone(j), j.forms.length] : [0, 1];
  const doing = j
    ? `<div class="p16"><div class="big">${esc(j.title)}</div><div class="sec">${[loc, dRange(j.dates)].filter(Boolean).join(' · ')}</div>
   <div class="mt3"><b>${ft ? 'เครื่องส่ง' : 'ฟอร์ม'} <span class="cnt" data-v="${k}">${k}</span>/${n}</b></div><div class="bar2"><i style="width:${100 * k / n}%"></i></div>${st('todo', 'กำลังทำ')}
   <div class="mt3">${ft ? act(base + '/fill', 'ทำต่อ', `cur:${ft.n}:${j.id}`) : act(base, 'ทำต่อ')}</div></div>`
    : `<div class="p16"><div class="big">ยังไม่มีงานที่เริ่ม</div><div class="sec">เลือกงานหรือเริ่มงานใหม่ในหน้างาน PM</div><div class="mt3">${act('#/pm', 'ไปที่งาน PM')}</div></div>`;
  const blk = [...(j ? (j.tools || []).filter(t => Date.parse(t.due) < Date.now()).map(t => [st('warn', `เครื่องมือหมดอายุ · ${t.name}`), base + '/tools']) : []),
    ...S.templates.filter(t => t.isNew).map(t => [st('todo', `ฟอร์ม ${t.code} Rev.${t.rev} ใหม่ ยังไม่โหลด`), `#/today/doc/${t.code}`])];
  const chk = blk.length ? `${blk.map(x => `<div class="srow">${x[0]}</div>`).join('')}<div class="p16">${act(blk[0][1], 'ตรวจรายการ')}</div>` : `<div class="srow">${st('ok', 'พร้อมทำงาน')}</div>`;
  const nt = ft && (tx.find(t => !txDone(j, t) && t.n !== ft.n) || ft);
  const nxt = !j
    ? !prev ? `<div class="p16"><div class="big">ยังไม่มีงาน PM</div><div class="sec">สร้างงานใหม่ที่แท็บ งาน PM</div></div>` : `<div class="p16"><div class="big">เปิดรายงานรอบก่อน</div><div class="sec">${esc(prev.title)} · ดูตัวอย่างก่อนเริ่มงาน</div><div class="mt3">${act('#/today/doc/' + prev.id, 'ไปขั้นถัดไป')}</div></div>`
    : !tx ? `<div class="p16"><div class="big">ทำฟอร์มที่เหลือ</div><div class="sec">ยังไม่เสร็จ ${j.forms.length - k} ฟอร์ม</div><div class="mt3">${act(base, 'ไปขั้นถัดไป')}</div></div>`
    : `<div class="p16">${ft ? `<div class="big">กรอกค่าเครื่องส่ง ${nt.n}</div><div class="sec">แล้วจึงตรวจเลขทรัพย์สิน · หลังกรอกครบ</div><div class="mt3">${act(base + '/fill', 'ไปขั้นถัดไป', `cur:${nt.n}:${j.id}`)}</div>` : `<div class="big">ตรวจเลขทรัพย์สิน</div><div class="sec">ค่าเครื่องส่งครบแล้ว</div><div class="mt3">${act(base + '/asset', 'ไปขั้นถัดไป')}</div>`}</div>`;
  return `${nav('วันนี้')}<div class="in today"><h1 class="lt">วันนี้</h1>
 <p class="sec note">สวัสดี ${esc(S.user.name)} · ${DAYS[new Date(bkk() + 'T00:00:00Z').getUTCDay()]} ${dShort(bkk())}</p>
 <div class="sh">กำลังทำ</div><div class="grp">${doing}</div>
 <div class="sh">ต้องตรวจ</div><div class="grp">${chk}</div>
 <div class="sh">ต่อไป</div><div class="grp">${nxt}</div></div>`;
}

// ---------- รายงาน (ตัวอย่าง = ติดป้าย เพราะไม่ใช่ฉบับมาตรฐาน · ที่ออกจากแอป = ไอคอน+คำ) ----------
const RB = '#/docs/reports';
const BADGE = '<span class="bdg">ตัวอย่าง</span>';
const origin = d => d.origin === 'app' ? st('app', 'ที่ออกจากแอป') : BADGE;
const docRow = (S, d, base) => swr(`<a class="row" href="${base}/doc/${d.id}"><span class="rt"><span>${esc(d.title)}</span><span class="sub">${d.dates ? dRange(d.dates) + ' · ' : ''}${d.pages} หน้า · ผู้ปฏิบัติ ${d.crew} คน</span><span class="stl">${st(...DOC_ST[d.status])}${origin(d)}</span></span>${chev}</a>`, d.id, isOff(S, d.id));
export const isOff = (S, id) => { const t = S.files.find(x => x.id === id) || S.templates.find(x => x.code === id); return store.isOffline(id, t ? t.offline !== false : false); };
const roundsList = (S, list, base) => list.length ? list.map(d => docRow(S, d, base)).join('') : '<div class="empty">ไม่มีรายงานในหมวดนี้</div>';
const mine = S => S.docs.filter(d => (d.performers || []).some(p => p === S.user.name || p === S.user.email));
const latestReport = S => S.docs.reduce((m, d) => d.modified > m ? d.modified : m, '');
const stamp = iso => iso ? `${dFull(iso)} ${hhmm(iso)}` : 'ยังไม่มีข้อมูล';
export function reports(S, _, back) {
  const u = S.ui, c = S.catalog, top = u.r || 'r-my', pane = u.p || 'p-sys', sel = u.sel || 'tx-stby', my = mine(S);
  const yr = {}; c.systems.forEach(s => (s.years || []).forEach(y => yr[y.year] = (yr[y.year] || 0) + y.count));
  const row = (href, lead, t, v, x = '', sub = '') => `<a class="row ${x}" href="${href}">${lead}<span class="rt"><span>${esc(t)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span><span class="rv">${v} รายงาน</span>${chev}</a>`;
  const list = S.docs.filter(d => d.system === sel), seg = (id, t, cur) => `<button data-pane="${id}" aria-pressed="${cur === id}">${t}</button>`;
  const head = `${nav('รายงาน', back)}<div class="in">${ptr}<h1 class="lt">รายงาน</h1><div class="seg">${seg('r-my', 'ของฉัน', top)}${seg('r-all', 'ทั้งกอง', top)}</div></div>`;
  if (S.wait.has('reports')) return `${head}<div class="pane">${skel(5)}</div>`;
  return `${head}
 <div class="pane" id="r-my" ${top === 'r-my' ? '' : 'hidden'}>${my.length ? `<div class="grp">${roundsList(S, my, RB)}</div>` : '<div class="empty">ยังไม่มีรายงานของคุณ</div>'}</div>
 <div class="pane" id="r-all" ${top === 'r-all' ? '' : 'hidden'}><div class="split"><div class="side">
 <label class="search">${ic('search')}<input type="search" data-filter placeholder="ค้นหารายงาน" aria-label="ค้นหารายงาน"></label>
 <div class="seg">${seg('p-sys', 'ระบบ', pane)}${seg('p-yr', 'ปี', pane)}</div>
 <div class="pane" id="p-sys" ${pane === 'p-sys' ? '' : 'hidden'}><div class="grp">${c.systems.map(s => row(`${RB}/${s.id}`, ic(s.icon, 'lead'), s.name, s.count, s.id === sel ? 'sel' : '', s.loc).replace('<a ', `<a data-sel="${s.id}" `)).join('')}</div></div>
 <div class="pane" id="p-yr" ${pane === 'p-yr' ? '' : 'hidden'}><div class="grp">${Object.keys(yr).sort((a, b) => b - a).map(y => row(`${RB}/by/yr/${y}`, '', y, yr[y])).join('')}</div></div></div>
 <div class="detail"><h1 class="lt">${esc(sysName(S, sel))}</h1><div class="grp">${roundsList(S, list, RB)}</div></div></div></div>`;
}

// ---------- เอกสารเว็บกอง: หมวด → ไฟล์ → ตัวดู ----------
const fileRow = (S, f) => { const o = isOff(S, f.id);
  return swr(`<a class="row" href="#/docs/k/${f.cat}/doc/${esc(f.id)}"><span class="rt"><span>${esc([f.code, f.title].filter(Boolean).join(' '))}</span><span class="sub">${[f.tag, f.rev && 'Rev.' + f.rev, 'ดึง ' + dShort(f.fetchedAt)].filter(Boolean).join(' · ')}</span>${o ? st('dl', 'ตั้งไว้ (ตัวอย่าง)') : st('cloud', 'ยังไม่ตั้ง')}</span>${chev}</a>`, f.id, o); };
const filterBar = (ph, a = '') => `<label class="search">${ic('search')}<input type="search" data-filter${a} placeholder="${ph}" aria-label="${ph}"></label>`;
export const searchAll = (S, q) => {
  const rs = S.docs.filter(d => `${d.title} ${sysName(S, d.system)} ${d.round}`.toLowerCase().includes(q)), fs = S.files.filter(f => `${f.code} ${f.title} ${f.tag}`.toLowerCase().includes(q));
  return !rs.length && !fs.length ? '<div class="empty">ไม่พบเอกสาร</div>'
    : (rs.length ? `<div class="sh">รายงาน</div><div class="grp">${rs.map(d => docRow(S, d, RB)).join('')}</div>` : '') + (fs.length ? `<div class="sh">เอกสารจากเว็บกอง</div><div class="grp">${fs.map(f => fileRow(S, f)).join('')}</div>` : '');
};
export function docs(S) {
  const at = S.cats[0]?.rows[0]?.fetchedAt, open = !S.ui.webClosed, nRep = S.catalog.systems.reduce((n, s) => n + s.count, 0), nFile = S.cats.reduce((n, c) => n + c.total, 0);
  return `${nav('เอกสาร')}<div class="in">${ptr}<h1 class="lt">เอกสาร</h1>${filterBar('ค้นหารายงานและเอกสาร (รหัสหรือชื่อ)', '="docs"')}
 <div class="dhome" id="dhome">${S.wait.has('docs') ? skel(6) : `
 <a class="dcard" href="${RB}"><span class="dic">${ic('doc')}</span><span class="rt"><b class="big">รายงาน</b><span class="sec">${nRep} รายงาน</span><span class="cap">อัปเดตล่าสุด ${stamp(latestReport(S))}</span></span>${chev}</a>
 <button class="dcard" data-web aria-expanded="${open}" aria-controls="dcats"><span class="dic">${ic('folder')}</span><span class="rt"><b class="big">เอกสารจากเว็บกอง</b><span class="sec">${nFile} ไฟล์</span><span class="cap">อัปเดตล่าสุด ${stamp(at)}</span>${st('ok', 'เป็นปัจจุบัน')}</span>${chev}</button>
 <div class="grp" id="dcats" ${open ? '' : 'hidden'}>${S.cats.map(c => `<a class="row" href="#/docs/k/${c.id}">${ic('folder', 'lead')}<span class="rt"><span>${esc(c.name)}</span></span><span class="rv">${c.total} ไฟล์</span>${chev}</a>`).join('')}</div>`}</div>
 <div id="dres" hidden></div></div>`;
}
export function kind(S, id, back) {
  const c = S.cats.find(x => x.id === id);
  return `${nav(c.name, back)}<div class="in"><h1 class="lt">${esc(c.name)}</h1>${filterBar('ค้นหาในหมวดนี้')}
 <p class="sec note">แสดงตัวอย่าง ${c.rows.length} จาก ${c.total} ไฟล์ · โหมดตัวอย่าง</p><div class="grp">${c.rows.map(f => fileRow(S, f)).join('')}</div></div>`;
}
export function years(S, sys, back) {
  const s = S.catalog.systems.find(x => x.id === sys) || {}, y = s.years || [];
  return `${nav(s.name, back, `<button data-toast="เรียงตามปีล่าสุดก่อน">${ic('sort')}เรียง</button>`)}<div class="in"><h1 class="lt">${esc(s.name)}</h1>
 <div class="grp">${y.map(x => `<a class="row" href="${RB}/${sys}/${x.year}"><span class="rt">${x.year}</span><span class="rv">${x.count} รายงาน</span>${chev}</a>`).join('')}</div></div>`;
}
export function rounds(S, arg, back) {
  const [sys, y, by, val] = arg;
  const list = S.docs.filter(d => by ? d.year === +val : d.system === sys && d.year === +y);
  const t = String(by ? val : y);
  return `${nav(t, back)}<div class="in"><h1 class="lt">${esc(t)}</h1><div class="grp">${roundsList(S, list, location.hash.split('/doc/')[0] || RB)}</div></div>`;
}

// ---------- ตัวดูรายงาน ----------
export function view(S, id, back) {
  const d = S.docs.find(x => x.id === id), t = S.files.find(x => x.id === id) || S.templates.find(x => x.code === id);
  const title = d ? d.title : [t.code, t.title || t.name, t.rev && 'Rev.' + t.rev].filter(Boolean).join(' '), pg = d ? d.pages : t.pages, code = d ? 'FM-CE.SE-006' : t.code || t.title;
  const pages = Array.from({ length: Math.min(pg, 200) }, (_, i) => `<div class="page"><div class="hd"><i></i><span>${esc(code)}${i ? ` · แผ่นที่ ${i + 1}` : ''}</span></div><div class="ln"></div>${i ? '' : '<div class="ln s"></div>'}</div>`).join('');
  return `${nav(title, back, `<button data-sheet="${d ? 'info' : 'src'}:${esc(id)}" aria-label="ข้อมูลรายงาน">${ic('info')}</button><button data-share aria-label="แชร์">${ic('share')}</button>`)}
 <div class="pages" data-pg="${pg}">${d && d.origin !== 'app' ? `<div class="vbd">${BADGE}</div>` : ''}${pages}<div class="pgbar">หน้า <span id="pn">1</span>/${pg}</div></div>`;
}

// ---------- งาน PM: รายการงาน (หลายระบบถึงรอบพร้อมกันได้) → หน้างาน ----------
const dShortY = iso => `${dShort(iso)} ${String(ymd(iso)[0] + 543).slice(2)}`;
const jstat = j => j.status === 'done' ? st('ok', `เสร็จแล้ว · ${dShortY(j.dates[1])}`) : st('todo', j.status === 'doing' ? 'กำลังทำ' : 'ยังไม่เริ่ม');
const jobRow = (j, S) => { const r = `<a class="row" href="#/pm/${j.id}"${S.ui.added === j.id ? ' data-new' : ''}><span class="rt"><span>${esc(j.title)}</span><span class="sub">${dRange(j.dates)}</span>${jstat(j)}</span><span class="rv">ฟอร์ม ${formsDone(j)}/${j.forms.length}</span>${chev}</a>`;
  return j.status === 'done' ? r : swrx(r, `data-job-act="${esc(j.id)}"`, j.status === 'todo' ? 'trash' : 'ok', j.status === 'todo' ? 'ลบ' : 'ปิดงาน'); };
export function pm(S) {
  const g = [['doing', 'กำลังทำ'], ['todo', 'ยังไม่เริ่ม'], ['done', 'เสร็จแล้ว']].map(([k, t]) => { const L = S.jobs.filter(j => j.status === k).sort((a, b) => b.touched.localeCompare(a.touched));
    return L.length ? `<div class="sh">${t}</div><div class="grp">${L.map(j => jobRow(j, S)).join('')}</div>` : ''; }).join('');
  return `${nav('งาน PM')}<div class="in">${ptr}<h1 class="lt">งาน PM</h1>${g}</div>`;
}
// CTA ลอยของหน้างาน: ยังไม่เริ่ม = เริ่มงาน · กำลังทำ = ตรวจความพร้อม n/m หรือ ออกรายงาน · เสร็จแล้ว = ไม่มี
export const jobCta = j => j.status === 'todo' ? ['start', 'ok', 'เริ่มงาน'] : j.status === 'done' ? null : formsDone(j) === j.forms.length ? ['report', 'doc', 'ออกรายงาน'] : ['ready', 'clip', `ตรวจความพร้อม · ${formsDone(j)}/${j.forms.length}`];
export function job(S, id, back) {
  const j = S.jobs.find(x => x.id === id), n = j.forms.length, k = formsDone(j), ready = k === n, b = `#/pm/${j.id}`;
  const rows = j.forms.map(f => {
    const [, kind, text] = formState(j, f), body = `<span class="rt"><span>${f.code ? f.code + ' ' : ''}${esc(f.name)}</span>${st(kind, text)}</span>${f.go === 'cam' ? ic('cam', 'ch') : ''}${chev}`;
    const href = f.kind === 'tx' ? b + '/fill' : f.kind === 'asset' ? b + '/asset' : f.go === 'tools' ? b + '/tools' : '';
    return href ? `<a class="row" href="${href}">${body}</a>` : `<button class="row" data-toast="ฟอร์มนี้ทำในขั้น 2">${body}</button>`;
  }).join('');
  const cta = j.status === 'done' ? `<div class="mt3">${jstat(j)}</div>` : '';
  return `${nav(j.title, back)}<div class="in pt2">
 <div class="grp"><div class="p16"><div class="cap">${dRange(j.dates)}</div><div class="big">${esc(j.title)}</div><div class="bar2"><i style="width:${100 * k / n}%"></i></div><div class="sec">ฟอร์ม <span class="cnt" data-v="${k}">${k}</span>/${n} เสร็จ</div>${cta}</div></div>
 <div class="sh">ฟอร์มของงานนี้</div><div class="grp">${rows}</div>
 <div class="grp"><a class="row" href="${b}/folder">${ic('folder', 'lead')}<span class="rt"><span>ฟอร์มอื่น ๆ และรูปประกอบ</span><span class="sub">โฟลเดอร์ของงานนี้ · รูปสถานี รูปการทำงาน เอกสารเพิ่มเติม</span></span>${chev}</a></div></div>`;
}
const fld = (S, f, t, n) => {
  const v = t.v[f.k] ?? '', b = bad(f, v);
  return `<label class="fld${b ? ' bad' : ''}" data-lbl="${esc(f.n)}" data-min="${f.min}" data-max="${f.max}"><span class="rt"><span class="t">${esc(f.t)}</span><span class="sub">${esc(f.std)}</span><span class="wn">${ic('warn')}เกินช่วง</span></span>
  <input inputmode="decimal" enterkeyhint="next" value="${esc(v)}" data-n="${n}" data-k="${f.k}" aria-label="${esc(f.n)}"><span class="u">${f.u}</span>${f.cam ? camBtn(S, `${n}.${f.k}`, t.photos[f.k], 'ถ่ายรูป ' + f.t) : ''}</label>`;
};
const idFld = (S, t, n, k, title, sub) => `<label class="fld" data-lbl="${title}"><span class="rt"><span class="t">${title}</span><span class="sub">${sub}</span></span><input class="wide" enterkeyhint="next" autocapitalize="off" autocomplete="off" value="${esc(t.v[k] ?? '')}" data-n="${n}" data-k="${k}" aria-label="${title}">${camBtn(S, `${n}.${k}`, t.photos[k], 'ถ่ายรูป ' + title)}</label>`;
export function fill(S, _, back) {
  const j = S.job, m = j.cur, t = j.tx[m - 1], k = txDoneCount(j);
  const chips = j.tx.map(x => { const d = txDone(j, x), c = x.n === m; return `<button class="chip ${c ? 'cur' : d ? 'dn' : ''}" data-m="${x.n}" aria-label="Tx ${x.n}, ${x.freq} MHz, ${c ? 'ปัจจุบัน' : d ? 'เสร็จแล้ว' : 'ยังไม่ทำ'}"><b>${d ? ic('done') : ''}Tx ${x.n}</b><small>${x.freq.toFixed(x.freq % 1 ? 2 : 1).replace(/(\.\d)0$/, '$1')} MHz</small></button>`; }).join('');
  return `${nav(`เครื่องส่ง ${m}/${j.tx.length}`, back)}<div class="in"><div class="strip-w"><div class="strip" id="strip">${chips}</div>
 <div class="prg"><span class="cap">${m} จาก ${j.tx.length} · เสร็จ <span class="cnt" data-v="${k}">${k}</span></span><div class="bar3"><i style="width:${100 * k / j.tx.length}%"></i></div></div></div>
 <div class="sh">ข้อมูลเครื่อง · อ่านจากสติกเกอร์</div><div class="grp">${idFld(S, t, m, 'asset', 'Asset No', 'จากสติกเกอร์ทรัพย์สิน')}${idFld(S, t, m, 'serial', 'Serial', 'จากแผ่นป้ายเครื่อง')}</div>
 <div class="sh">ค่าที่วัด</div><div class="grp">${j.fields.map(f => fld(S, f, t, m)).join('')}</div></div>`;
}
export function table(S, _, back) {
  const j = S.job, m = j.cur, k = txDoneCount(j), cols = j.fields;
  const body = j.tx.map(t => `<tr><td>${t.n}</td>${cols.map(f => `<td${bad(f, t.v[f.k] ?? '') ? ' class="bad"' : ''}><input inputmode="decimal" enterkeyhint="next" value="${esc(t.v[f.k] ?? '')}" data-n="${t.n}" data-k="${f.k}" aria-label="Tx ${t.n} ${esc(f.n)}"></td>`).join('')}</tr>`).join('');
  return `${nav(`FM-CE.SE-202 · เครื่องส่ง ${j.tx.length} เครื่อง`, back)}<div class="tb2"><div class="tl"><div class="prg pt2"><span class="cap">${m} จาก ${j.tx.length} · เสร็จ <span class="cnt" data-v="${k}">${k}</span></span><div class="bar3"><i style="width:${100 * k / j.tx.length}%"></i></div></div>
 <table><thead><tr><th>Tx</th>${cols.map(f => `<th>${esc(f.n).replace(' (', '<br>(')}</th>`).join('')}</tr></thead><tbody id="tbd">${body}</tbody></table><p class="sec">Apple Pencil เขียนลงช่องได้เลย (Scribble)</p></div>
 <div class="wi"><div class="grp">${idFld(S, j.tx[m - 1], m, 'asset', `Asset No · Tx ${m}`, 'จากสติกเกอร์ทรัพย์สิน').replace('<input ', '<input id="wiAsset" ')}</div>
 <div class="seg"><button data-pane="w-wi" aria-pressed="true">WI</button><button data-pane="w-pr" aria-pressed="false">รอบก่อน</button><button data-pane="w-pdf" aria-pressed="false">ฟอร์ม PDF</button></div>
 <div class="pane" id="w-wi"><div class="p16"><b>WI-CE.SE-02 Rev.06 · หน้า 50 · ภาคผนวก ข</b><div class="sec" id="wf">ช่องที่เลือก: ${esc(cols[2].n)} · Tx ${m}</div></div><div class="page w70"><div class="hd"><i></i><span>WI-CE.SE-02 · หน้า 50</span></div><div class="ln"></div></div>${wiText}</div>
 <div class="pane" id="w-pr" hidden><div class="p16"><a class="btn alt" href="#/pm/${j.id}/doc/tx-stby-2569-2-69">${ic('doc')}เปิดรายงานรอบก่อน (PM DM TX Radio STBY 2/69)</a></div></div>
 <div class="pane" id="w-pdf" hidden><div class="page"><div class="hd"><i></i><span>FM-CE.SE-202 Rev.04</span></div><div class="ln"></div></div></div></div></div>`;
}
const wiText = `<div class="grp"><div class="p16"><div class="cap">ขั้นตอน</div>ต่อ CMA180 เข้า Ant port ผ่าน Attn 30 dB ตั้ง… (ข้อความตัวอย่าง)</div></div>`;
export function asset(S, _, back) {
  const j = S.job;
  const rows = j.assetCheck.map(n => { const t = j.tx[n - 1], a = assetState(t), p = S.ph[t.photos.asset];
    return `<div class="row"><span class="tn ${p ? '' : 'no'}">${p ? `<img src="${p}" alt="">` : ic('cam')}</span><span class="rt"><span>Tx ${n} · ${t.model}</span><span class="sub">ทะเบียน ${t.reg}</span>${st(...a)}</span>${camBtn(S, `${n}.asset`, t.photos.asset, 'ถ่ายรูปสติกเกอร์ Tx ' + n)}</div>`; }).join('');
  return `${nav('ตรวจเลขทรัพย์สิน', back)}<div class="in"><h1 class="lt">ตรวจเลขทรัพย์สิน</h1><p class="sec note">ถ่ายสติกเกอร์ทรัพย์สิน แล้วพิมพ์เลขในหน้ากรอกค่า แอปเทียบกับทะเบียนให้</p><div class="grp">${rows}</div></div>`;
}
export function tools(S, _, back) {
  const rows = S.job.tools.map((t, i) => { const ex = Date.parse(t.due) < Date.now();
    return `<div class="row"><span class="rt"><span>${esc(t.name)}</span><span class="sub">Asset ${t.asset} · Due ${dFull(t.due)}</span>${ex ? st('warn', 'หมดอายุ') : st('ok', 'ยังไม่หมดอายุ')}</span>${camBtn(S, 'tool.' + i, t.photo, 'ถ่ายสติกเกอร์ calibration ' + esc(t.name))}</div>`; }).join('');
  return `${nav('เครื่องมือวัด', back)}<div class="in"><h1 class="lt">เครื่องมือวัด</h1><p class="sec note">ถ่ายสติกเกอร์ calibration เก็บเป็นหลักฐานของงานนี้</p><div class="grp">${rows}</div></div>`;
}
export function folder(S, _, back) {
  const f = S.job.folder;
  const tiles = f.photos.map((p, i) => { const nm = esc(p.name || 'รูป ' + (i + 1)), u = S.ph[p.id], isImg = !p.type || p.type.startsWith('image/');
    return `<button class="tile" ${p.id ? `data-sheet="photo:folder.${i}"` : `data-toast="${nm}"`} aria-label="${nm}">${u && isImg ? `<img src="${u}" alt="">` : ic(p.id && !isImg ? 'doc' : 'img')}${p.name ? `<span>${nm}</span>` : ''}</button>`; }).join('');
  return `${nav('โฟลเดอร์งาน', back)}<div class="in"><h1 class="lt">โฟลเดอร์งาน ${esc(S.job.title)}</h1><div class="sh">รูปประกอบ (${f.photos.length})</div><div class="ph">${tiles}</div>
 <div class="sh">เอกสารเพิ่ม</div><div class="grp">${f.docs.map(d => `<button class="row" data-toast="ดูเอกสารเพิ่มทำในขั้น 2">${ic('doc', 'lead')}<span class="rt"><span>${esc(d.name)}</span>${st('todo', 'ร่าง')}</span>${chev}</button>`).join('')}</div>
 <div class="pad2"><button class="btn" data-cam="folder">${ic('cam')}ถ่ายรูป</button><button class="btn alt" data-file="folder">${ic('doc')}เพิ่มไฟล์</button><button class="btn alt" data-toast="แนบท้ายรายงานทำในขั้น 2">${ic('clip')}แนบท้ายรายงาน</button></div>
 <p class="sec note c">เก็บในเครื่องก่อน · ขั้นต่อไปส่งขึ้นโฟลเดอร์งานบนเซิร์ฟเวอร์กอง</p></div>`;
}

// ---------- ฉัน (แท็บหลัก) ----------
export function me(S) {
  const r = (i, t, s) => `<button class="row" data-toast="โหมดตัวอย่าง · ยังไม่เปิดใช้">${ic(i, 'lead')}<span class="rt"><span>${t}</span><span class="sub">${s}</span></span>${chev}</button>`, auto = store.pref('auto') !== false;
  return `${nav('ฉัน')}<div class="in"><h1 class="lt">ฉัน</h1><div class="hero"><div class="avatar">${esc([...S.user.name][0])}</div><div class="big">${esc(S.user.name)}</div><div class="sec">${esc(S.user.email || 'CE.SE · AEROTHAI')}</div></div>
 <div class="grp">${r('ok', 'บัญชีบริษัท', store.backendName() === 'demo' ? 'โหมดตัวอย่าง · ยังไม่เชื่อมต่อ' : S.user.email || '')}${store.backendName() === 'demo' ? '' : `<button class="row" data-sheet="pw">${ic('lock', 'lead')}<span class="rt"><span>เปลี่ยนรหัสผ่าน</span></span>${chev}</button>`}${r('sig', 'ลายเซ็นของฉัน', 'ใช้ตอนออกรายงาน')}${r('gear', 'ตั้งค่า', 'แจ้งเตือนรอบ PM · calibration')}</div>
 <div class="sh">เชื่อมต่อ</div><div class="grp"><div class="kv"><span>เซิร์ฟเวอร์: ${store.backendName() === 'demo' ? 'ตัวอย่าง (demo)' : 'Supabase'}</span><button class="btn alt" data-be="${store.backendName() === 'demo' ? 'supabase' : 'demo'}">สลับเป็น ${store.backendName() === 'demo' ? 'Supabase' : 'demo'}</button></div></div>
 <div class="sh">พื้นที่ offline</div><div class="grp"><div class="kv"><span>ตั้งเก็บ offline อัตโนมัติ · ตัวอย่าง (ยังไม่โหลดไฟล์จริง)</span>${sw(auto, 'data-pref="auto" aria-label="ตั้งเก็บ offline อัตโนมัติ (ตัวอย่าง)"')}</div><div class="kv"><span>ตั้งไว้ในเครื่อง</span><span>${store.offlineCount()} รายการ</span></div></div>
 <div class="grp">${r('info', 'เกี่ยวกับ / เวอร์ชัน', `${S.version} (${store.backendName()})`)}</div>
 <div class="grp k"><button class="row red" data-signout>${ic('out')}ออกจากระบบ</button></div></div>`;
}

// ---------- sheet ----------
const frame = (t, body) => `<i class="grab"></i><div class="sh-h"><span>${t}</span><button data-close>เสร็จ</button></div>${body}`;
// เมนูกดค้างแถว: ทำงานเดียวกับปุ่มที่ปัดเปิดของแถว (คัดลอก data-* ของปุ่ม .swa)
export const actSheet = (title, a) => frame(esc(title), `<div class="grp"><button class="row" ${[...a.attributes].filter(x => x.name.startsWith('data-')).map(x => `${x.name}="${esc(x.value)}"`).join(' ')}>${a.querySelector('svg').outerHTML.replace('class="ic ', 'class="ic lead ')}<span class="rt"><span>${esc(a.textContent)}</span></span></button></div>`);
export function sheet(S, kind, id) {
  const h = frame;
  if (kind === 'new') {
    const t = bkk(), r0 = fiscal(t).round, e = new Date(Date.parse(t) + 2 * 864e5).toISOString().slice(0, 10);
    return h('เริ่มงานใหม่', `<div class="sh">ระบบ</div><div class="grp" role="radiogroup" aria-label="ระบบ">${S.catalog.systems.map(x => `<button class="row" role="radio" aria-checked="false" data-sys="${x.id}"><span class="rt"><span>${esc(x.name)}</span>${x.loc ? `<span class="sub">${esc(x.loc)}</span>` : ''}</span>${ic('ok', 'ck')}</button>`).join('')}</div>
 <div class="sh">ครั้งที่ (ปีงบประมาณ ${fiscal(t).fy})</div><div class="seg" role="group" aria-label="ครั้งที่"><button data-rd="1" aria-pressed="${r0 === 1}">ครั้งที่ 1</button><button data-rd="2" aria-pressed="${r0 === 2}">ครั้งที่ 2</button></div>
 <div class="sh">ช่วงวันที่ปฏิบัติงาน</div><label class="search"><span class="cap">เริ่ม</span><input type="date" id="nd1" value="${t}" aria-label="วันเริ่ม"></label><label class="search"><span class="cap">สิ้นสุด</span><input type="date" id="nd2" value="${e}" aria-label="วันสิ้นสุด"></label>
 <div class="pad2"><button class="btn" data-create>สร้างงาน</button></div>`);
  }
  if (kind === 'pw') {
    const f = (id, l) => `<label class="search"><input type="password" id="${id}" autocomplete="new-password" placeholder="${l}" aria-label="${l}"><button class="peek" type="button" data-peek aria-label="Show password" aria-pressed="false">${ic('eye')}</button></label>`;
    return h('เปลี่ยนรหัสผ่าน', `<p class="sec note">อย่างน้อย 8 ตัวอักษร</p>${f('pw1', 'รหัสผ่านใหม่')}${f('pw2', 'ยืนยันรหัสผ่านใหม่')}
 <div class="pad2"><p class="st w lg-err" id="pwErr" role="alert" hidden>${ic('warn')}<span></span></p><button class="btn" data-pw-save>บันทึก</button></div>`);
  }
  if (kind === 'ready') {
    const j = S.job, miss = j.forms.length - formsDone(j);
    return h('ความพร้อมก่อนออกรายงาน', `<p class="sec note">${miss ? `ยังขาด ${miss} ฟอร์ม` : 'ครบทุกฟอร์มแล้ว'}</p><div class="grp">${j.forms.map(f => { const [, k, t] = formState(j, f); return `<div class="row"><span class="rt"><span>${f.code ? f.code + ' ' : ''}${esc(f.name)}</span>${st(k, t)}</span></div>`; }).join('')}</div>`);
  }
  if (kind === 'photo') {
    const j = S.job, [a, b] = id.split('.'), pid = a === 'folder' ? j.folder.photos[+b].id : a === 'tool' ? j.tools[+b].photo : j.tx[a - 1].photos[b], p = a === 'folder' ? j.folder.photos[+b] : {}, u = S.ph[pid];
    const isImg = !p.type || p.type.startsWith('image/');
    return h('รูป', `${u && isImg ? `<img class="ph-view" src="${u}" alt="">` : `<div class="p16"><b>${esc(p.name || 'ไฟล์')}</b><div class="sec">${esc(p.type || '')}</div></div>`}
 <div class="pad2">${a === 'folder' ? '' : `<button class="btn alt" data-cam="${id}">${ic('cam')}ถ่ายใหม่</button>`}<button class="btn alt" data-photo-del="${id}">${ic('trash')}ลบรูป</button></div>`);
  }
  if (kind === 'wi') return h('WI-CE.SE-02 Rev.06 · หน้า 50', wiText.replace('<div class="p16"><div class="cap">ขั้นตอน', '<div class="p16"><div class="cap">ภาคผนวก ข · ขั้นตอน'));
  if (kind === 'info') {
    const d = S.docs.find(x => x.id === id), o = isOff(S, id), s = S.catalog.systems.find(x => x.id === d.system);
    return h('ข้อมูลรายงาน', `<div class="p16"><b>${esc(d.title)}.pdf</b><div class="chips"><span>CE.SE</span>›<span>รายงาน PM</span>›<span>${esc(s.name)}</span>›<span>${d.year}</span>›<span>${d.round.replace('/', '-')}</span></div></div>
 <div class="grp"><div class="kv"><span>แก้ไขล่าสุด</span><span>${dFull(d.modified)} โดย ${esc(d.by)}</span></div><div class="kv"><span>ขนาด</span><span>${(d.size / 1e6).toFixed(1)} MB</span></div><div class="kv"><span>เก็บไว้ดู offline (ตัวอย่าง)</span>${sw(o, `data-off="${d.id}" aria-label="เก็บไว้ดู offline"`)}</div></div>
 <div class="pad2"><button class="btn" data-toast="โหมดตัวอย่าง · ยังไม่เชื่อมเซิร์ฟเวอร์กอง">${ic('ext')}เปิดไฟล์ต้นฉบับ</button></div>
 <div class="pad2"><details class="rel"><summary>${ic('doc')}เอกสารที่เกี่ยวข้อง</summary><div class="kv"><span>หนังสือคำสั่งปฏิบัติงาน PM</span><span>PDF</span></div><div class="kv"><span>WI-CE.SE-02 Rev.06 (หน้า 50–54)</span><span>WI</span></div></details></div>`);
  }
  const t = S.files.find(x => x.id === id) || S.templates.find(x => x.code === id), o = isOff(S, id), u = new URL(t.sourceUrl), src = u.pathname.length > 30 ? u.host + '/…/' + decodeURIComponent(u.pathname.split('/').pop()) : u.host + u.pathname;
  return h('ที่มาเอกสาร', `<div class="grp"><div class="kv"><span>ที่มา</span><span>${esc(src)}</span></div><div class="kv"><span>ดึงโดย</span><span>collector ${dShort(t.fetchedAt)}</span></div>
 <div class="kv"><span>เก็บไว้ดู offline (ตัวอย่าง)</span>${sw(o, `data-off="${id}" aria-label="เก็บไว้ดู offline"`)}</div></div><div class="pad2"><button class="btn" data-toast="โหมดตัวอย่าง · ยังไม่เปิดเว็บกอง">${ic('ext')}เปิดบนเว็บกอง</button></div>`);
}
