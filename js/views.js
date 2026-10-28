// หน้าจอทั้งหมด = ฟังก์ชันรับ state คืน HTML (template literal) · ไม่มี framework
import * as store from './store.js';
import { impTarget, norm, roundOf } from './import-sarabun.js';
import * as F from './flow.js';
import { ORDER } from './data/schedule-2569.js';
import { ATTACH_69 } from './data/wi-scope.js';
import { DOC_GROUPS } from './shapes.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ic = (n, c = '') => `<svg class="ic ${c}"><use href="./ui/icons.svg#i-${n}"/></svg>`;
const MO = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const ymd = iso => iso.slice(0, 10).split('-').map(Number);
export const dShort = iso => { const [, m, d] = ymd(iso); return `${d} ${MO[m - 1]}`; };
export const dFull = iso => { const [y, m, d] = ymd(iso); return `${d} ${MO[m - 1]} ${y + 543}`; };
const dRange = ([a, b]) => { const [y, m1, d1] = ymd(a), [, m2, d2] = ymd(b), yy = String(y + 543).slice(2); return a === b ? `${d1} ${MO[m1 - 1]} ${yy}` : m1 === m2 ? `${d1}–${d2} ${MO[m2 - 1]} ${yy}` : `${d1} ${MO[m1 - 1]}–${d2} ${MO[m2 - 1]} ${yy}`; };
const nDays = ([a, b]) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 864e5) + 1;
const hhmm = iso => { const t = new Date(iso); return `${String((t.getUTCHours() + 7) % 24).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`; };
export const { fiscal, txDone, bad, txDoneCount, formsDone } = F;

// ---------- ชิ้นส่วนร่วม ----------
const ST = { app: ['doc', ''], ok: ['done', ''], todo: ['circle', ''], warn: ['warn', 'w'], dl: ['dl', ''], cloud: ['cloud', ''], web: ['web', ''], sync: ['sync', ''] };
const st = (k, text, c = '') => `<span class="st ${ST[k][1]} ${c}">${ic(ST[k][0])}${esc(text)}</span>`;
const chev = ic('chev', 'ch');
// ค้นหา = ปุ่มวงกลมแว่นขยายมุมขวาบน → ช่องขยายใน nav แบบ iOS + "ยกเลิก" (ไม่มีช่องค้นหาในเนื้อหา) · attr = data-filter="docs" ฯลฯ
const nav = (title, back, acts = '', search = '', attr = '') => {
  const sb = search ? `<button class="sbtn" data-sopen aria-label="${esc(search)}">${ic('search')}</button>` : '', sf = search ? `<div class="nsr"><label class="search">${ic('search')}<input type="search" data-filter${attr} placeholder="${esc(search)}" aria-label="${esc(search)}"></label><button data-sx>ยกเลิก</button></div>` : '';
  return back == null
    ? `<div class="nav"><span></span><b class="nt">${esc(title)}</b><span class="acts">${acts}${sb}</span>${sf}</div>`
    : `<div class="nav"><a class="back" href="#" data-back>${ic('back')}<span>${esc(back)}</span></a><b class="nt">${esc(title)}</b><span class="acts">${acts}${sb}</span>${sf}</div>`;
};
const ptr = `<div class="ptr">${ic('sync')}<span></span></div>`;
const sw = (on, attrs) => `<button class="sw" role="switch" aria-checked="${on}" ${attrs}><i></i><span>${on ? 'เปิด' : 'ปิด'}</span></button>`;
const swrx = (row, attr, icon, label) => `<div class="swr">${row}<button class="swa" ${attr}>${ic(icon)}${label}</button></div>`;
const swr = (row, id, on) => swrx(row, `data-off-act="${esc(id)}"`, on ? 'trash' : 'dl', on ? 'ลบออก' : 'ตั้งเก็บ offline');
const skel = n => `<div class="grp sk">${'<div class="row"><span class="rt"><i class="l1"></i><i class="l2"></i></span></div>'.repeat(n)}</div>`;
const camBtn = (S, key, id, label) => S.ph[id] ? `<button type="button" class="cam" data-sheet="photo:${key}" aria-label="${label} (ดูรูป)"><img src="${S.ph[id]}" alt=""></button>` : `<button type="button" class="cam" data-cam="${key}" aria-label="${label}">${ic('cam')}</button>`;
// วงความคืบหน้า (component เดียวทั้งแอป): 0 = วงเปล่า · บางส่วน = ส่วนโค้งตามสัดส่วน (เคลื่อนเมื่อค่าเปลี่ยน: motion.js) · ครบ = วงเขียวทึบติ๊กขาว
export const ring = (frac, label = '') => frac >= 1
  ? `<span class="rg dn" role="img" aria-label="${esc(label || 'เสร็จแล้ว')}"><svg viewBox="0 0 24 24"><circle class="fl" cx="12" cy="12" r="11"/><path class="tk" d="M7 12.5l3.2 3.2L17 8.8"/></svg></span>`
  : `<span class="rg" role="img" aria-label="${esc(label || 'ยังไม่เสร็จ')}"><svg viewBox="0 0 24 24"><circle class="tr" cx="12" cy="12" r="9.5"/><circle class="ar" data-p="${Math.round(frac * 100)}" style="--p:${Math.round(frac * 100)}" cx="12" cy="12" r="9.5" pathLength="100" transform="rotate(-90 12 12)"/></svg></span>`;
// ป้ายที่มาของค่า (แคปซูล ไอคอน+คำ): แสดงเฉพาะค่าที่ระบบเติม/รอยืนยัน/ขัดกัน
const SRC = { sched: ['web', 'เว็บกอง'], sarabun: ['inbox', 'สารบรรณ'], prev: ['hist', 'รอบก่อน'], reg: ['book', 'ทะเบียน'] };
const srcTag = (v, wait = '') => wait ? `<span class="src w">${ic('warn')}${esc(wait)}</span>` : v && SRC[v.src] ? `<span class="src">${ic(SRC[v.src][0])}${SRC[v.src][1]}</span>` : '';
const fileTag = `<span class="src dash">${ic('copy')}อ่านจากไฟล์ · รอยืนยัน</span>`;
const bkk = S => S.today;
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const ctxOf = S => ({ templates: S.templates, docs: S.docs, today: S.today });
const sysName = (S, id) => (S.catalog.systems.find(s => s.id === id) || {}).name || id;
const isMine = (S, d) => (d.performers || []).some(p => F.isMe(p, S.user.name) || p === S.user.email) || (!!d.owner && d.owner === S.user.id);   // ฐานจริง: examples.uploaded_by = ผู้ใช้
export const recent = S => S.jobs.filter(j => j.status !== 'done').sort((a, b) => b.touched.localeCompare(a.touched))[0];

// ---------- วันนี้: แถวต่อหนึ่งงาน = เมื่อไร · งานไหน · ติดอะไร + แคปซูลเดียวพาไปจุดที่ติด (ไม่มีความคืบหน้าซ้ำ) ----------
const when = (S, j) => { if (!j.dates) return j.pm.ym ? F.ymLabel(j.pm.ym) : 'ยังไม่กำหนดวัน'; const [a, b] = j.dates, d = F.daysUntil(a, S.today); return d === 1 ? 'พรุ่งนี้' : d === 0 ? 'วันนี้' : d < 0 && F.daysUntil(b, S.today) >= 0 ? 'กำลังปฏิบัติงาน' : d < 0 ? 'เลยกำหนดวันงาน' : dShort(a); };
const tRow = (when_, title, kind, text, href, cap, spot = '') => `<div class="row tr"><span class="rt"><span class="cap">${esc(when_)}</span><b>${esc(F.fmtTitle(title))}</b>${st(kind, text)}</span><a class="btn sm" href="${href}"${spot ? ` data-spot="${esc(spot)}"` : ''}>${esc(cap)}</a></div>`;
export function today(S) {
  const cx = ctxOf(S), jobs = S.jobs.filter(j => F.mine(j, S.user.name) && j.status === 'doing').sort((a, b) => (a.dates ? a.dates[0] : '9').localeCompare(b.dates ? b.dates[0] : '9'));
  const opened = new Set(S.jobs.map(j => j.pm && j.pm.sched)), m0 = S.today.slice(0, 7);
  const mineRows = F.scheduleGroups(S.sched, [...opened], S.today, S.user.name)[0][2].filter(r => F.hasMe(r.people, S.user.name));
  const rows = jobs.map(j => { const b = F.blocker(j, cx), ok = b.spot === 'cta', od = F.overdue(j, S.today); return tRow(od ? `⚠︎ เลยกำหนด ${od} วัน` : when(S, j), j.title, ok ? 'ok' : 'warn', b.text, `#/pm/${j.id}`, b.cap, b.spot); })
    .concat(mineRows.map(r => tRow(F.ymLabel(r.ym), F.rowTitle(r), 'todo', 'ยังไม่ได้เปิดงาน', `#/pm/new/${r.id}`, 'เปิดงาน')));
  const wd = DAYS[new Date(S.today + 'T00:00:00Z').getUTCDay()];
  return `${nav('วันนี้')}<div class="in today"><h1 class="lt">วันนี้</h1>
 <p class="sec note">สวัสดี ${esc(S.user.name)} · ${wd} ${dShort(S.today)}${store.backendName() === 'demo' ? ' · <span class="src">ข้อมูลจำลอง · วันสมมติ</span>' : ''}</p>
 ${errCard(S, ['jobs'], 'งาน PM')}${rows.length ? `<div class="grp">${rows.join('')}</div>` : `<div class="grp"><div class="p16"><div class="big">ไม่มีงานที่ต้องทำตอนนี้</div><div class="sec">งานตามตารางที่ถึงรอบจะขึ้นที่นี่ · เลือกงานเองได้ที่แท็บ งาน PM</div></div></div>`}</div>`;
}

// ---------- รายงาน (ตัวอย่างของกอง) ----------
const RB = '#/docs/reports';
const BADGE = '<span class="bdg">ตัวอย่าง</span>';
const DOC_ST = { draft: ['todo', 'ร่าง'], review: ['todo', 'รอตรวจ'], accepted: ['ok', 'ผู้ตรวจรับแล้ว'] };
const origin = d => d.origin === 'app' ? st('app', 'ที่ออกจากแอป') : BADGE;
// ช่องที่ไม่รู้ (pages/crew/status = null จากฐานจริง) ไม่แสดง · ไม่เดาตัวเลข
const docRow = (S, d, base) => swr(`<a class="row" href="${base}/doc/${esc(d.id)}"><span class="rt"><span>${esc(F.fmtTitle(d.title))}</span><span class="sub">${esc([d.dates ? dRange(d.dates) : d.round && 'ครั้งที่ ' + d.round, d.pages != null && d.pages + ' หน้า', d.crew != null && `ผู้ปฏิบัติ ${d.crew} คน`].filter(Boolean).join(' · '))}</span><span class="stl">${DOC_ST[d.status] ? st(...DOC_ST[d.status]) : ''}${origin(d)}</span></span>${chev}</a>`, d.id, isOff(S, d.id));
// การ์ดโหลดไม่สำเร็จ (ต่อส่วน): ไอคอน+คำ · HTTP status · ลองใหม่ · รายละเอียด (path · status · ข้อความจากเซิร์ฟเวอร์) สำหรับวินิจฉัย
const ERRW = { auth: 'ต้องเข้าสู่ระบบใหม่', offline: 'ออฟไลน์อยู่', notfound: 'ไม่พบข้อมูลที่ขอ', server: 'เซิร์ฟเวอร์ตอบผิดพลาด', throttled: 'ระบบยุ่ง ลองใหม่อีกครั้ง', invalid: 'ข้อมูลไม่ถูกต้อง' };
const errBody = (e, retry) => `<div class="p16 errc">${st('warn', ERRW[e.code] || 'เกิดข้อผิดพลาด')}${e.status ? `<span class="sub">HTTP ${e.status}</span>` : ''}
 <button class="btn sm alt" data-retry="${esc(retry)}">${ic('sync')}ลองใหม่</button></div>`;
const errMore = L => `<details class="rel errd"><summary>${ic('info')}รายละเอียด</summary>${L.map(([k, e]) => `<p class="sec">${esc(k)}: ${esc([e.path, e.status, e.code, e.detail].filter(Boolean).join(' · '))}</p>`).join('')}</details>`;
export const errCard = (S, keys, label) => { const L = keys.filter(k => S.err[k]).map(k => [k, S.err[k]]); if (!L.length) return '';
  return `<div class="sh">โหลด${esc(label)}ไม่สำเร็จ</div><div class="grp">${errBody(L[0][1], L.map(x => x[0]).join(','))}</div><div class="pad2">${errMore(L)}</div>`; };
export const isOff = (S, id) => { const t = S.files.find(x => x.id === id) || S.templates.find(x => x.code === id); return store.isOffline(id, t ? t.offline !== false : false); };
const roundsList = (S, list, base) => list.length ? list.map(d => docRow(S, d, base)).join('') : '<div class="empty">ไม่มีรายงานในหมวดนี้</div>';
const examples = S => S.docs.filter(d => !isMine(S, d));   // รายงานของฉันอยู่ที่ งาน PM › ย้อนหลัง เท่านั้น
const stamp = iso => iso ? `${dFull(iso)} ${hhmm(iso)}` : 'ยังไม่มีข้อมูล';
export function reports(S, _, back) {
  const u = S.ui, c = S.catalog, pane = u.p || 'p-sys', ex = examples(S), sel = u.sel || (c.systems.find(s => ex.some(d => d.system === s.id)) || c.systems[0] || {}).id;   // ระบบแรก (ตามลำดับ catalog) ที่มีรายงาน
  const yr = {}; c.systems.forEach(s => (s.years || []).forEach(y => yr[y.year] = (yr[y.year] || 0) + y.count));
  const row = (href, lead, t, v, x = '', sub = '') => `<a class="row ${x}" href="${href}">${lead}<span class="rt"><span>${esc(t)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span><span class="rv">${v} รายงาน</span>${chev}</a>`;
  const list = ex.filter(d => d.system === sel), seg = (id, t, cur) => `<button data-pane="${id}" aria-pressed="${cur === id}">${t}</button>`;
  const head = `${nav('ตัวอย่างรายงานของกอง', back, '', 'ค้นหารายงาน')}<div class="in">${ptr}<h1 class="lt">ตัวอย่างรายงานของกอง</h1><p class="sec note">รายงานที่ผ่านมาของทั้งกอง ใช้เป็นตัวอย่างโครงฟอร์ม · ไม่ใช่ฉบับมาตรฐาน · รายงานของฉันอยู่ที่ งาน PM › ย้อนหลัง</p></div>`;
  if (S.wait.has('reports')) return `${head}<div class="in"><div class="pane">${skel(5)}</div></div>`;
  return `${head}<div class="in">${errCard(S, ['docs', 'catalog'], 'ตัวอย่างรายงาน')}<div class="split"><div class="side">
 <div class="seg">${seg('p-sys', 'ระบบ', pane)}${seg('p-yr', 'ปี', pane)}</div>
 <div class="pane" id="p-sys" ${pane === 'p-sys' ? '' : 'hidden'}><div class="grp">${c.systems.map(s => row(`${RB}/${s.id}`, ic(s.icon, 'lead'), s.name, s.count, s.id === sel ? 'sel' : '', s.loc).replace('<a ', `<a data-sel="${s.id}" `)).join('')}</div></div>
 <div class="pane" id="p-yr" ${pane === 'p-yr' ? '' : 'hidden'}><div class="grp">${Object.keys(yr).sort((a, b) => b - a).map(y => row(`${RB}/by/yr/${y}`, '', y, yr[y])).join('')}</div></div></div>
 <div class="detail"><h1 class="lt">${esc(sysName(S, sel))}</h1><div class="grp">${roundsList(S, list, RB)}</div></div></div></div>`;
}

// ---------- เอกสารเว็บกอง: 3 กลุ่ม → หมวด → ไฟล์ → ตัวดู ----------
const fileRow = (S, f) => { const o = isOff(S, f.id), demo = store.backendName() === 'demo';   // สถานะ offline เป็นฟีเจอร์ตัวอย่าง: โหมดจริงไม่แสดง
  const row = `<a class="row" href="#/docs/k/${f.cat}/doc/${esc(f.id)}"><span class="rt"><span>${esc([f.code, f.title].filter(Boolean).join(' '))}</span><span class="sub">${[f.tag, f.rev && 'Rev.' + f.rev, f.fetchedAt && 'ดึง ' + dShort(f.fetchedAt)].filter(Boolean).join(' · ')}</span>${demo ? (o ? st('dl', 'ตั้งไว้ (ตัวอย่าง)') : st('cloud', 'ยังไม่ตั้ง')) : ''}</span>${chev}</a>`;
  return demo ? swr(row, f.id, o) : row; };
export const searchAll = (S, q) => {
  const rs = examples(S).filter(d => `${d.title} ${sysName(S, d.system)} ${d.round}`.toLowerCase().includes(q)), fs = S.files.filter(f => `${f.code} ${f.title} ${f.tag}`.toLowerCase().includes(q));
  return !rs.length && !fs.length ? '<div class="empty">ไม่พบเอกสาร</div>'
    : (rs.length ? `<div class="sh">ตัวอย่างรายงานของกอง</div><div class="grp">${rs.map(d => docRow(S, d, RB)).join('')}</div>` : '') + (fs.length ? `<div class="sh">เอกสารจากเว็บกอง</div><div class="grp">${fs.map(f => fileRow(S, f)).join('')}</div>` : '');
};
export function docs(S) {
  const at = S.files.map(f => f.fetchedAt).filter(Boolean).sort().pop(), cat = id => S.cats.find(c => c.id === id), nRep = examples(S).length;
  // หมวดที่ยังไม่มีในตาราง (ชนิดใหม่จากเว็บกอง) แสดงท้าย "อ้างอิง" ไม่ซ่อน
  const known = new Set(DOC_GROUPS.flatMap(g => g[2].map(x => x[0]))), extra = S.cats.filter(c => !known.has(c.id)).map(c => [c.id, c.name, 'หมวดจากเว็บกอง', 'doc']);
  const groups = DOC_GROUPS.map((g, i) => i === DOC_GROUPS.length - 1 ? [g[0], g[1], [...g[2], ...extra]] : g);
  const grp = ([t, ex, items]) => `<div class="sh">${t}</div><p class="gx">${ex}</p><div class="grp">${items.map(([id, name, sub, icon]) => { const c = cat(id), href = id === 'reports' ? RB : `#/docs/k/${id}`; if (id !== 'reports' && !c) return '';
    return `<a class="row" href="${href}">${ic(icon, 'lead')}<span class="rt"><span>${name}</span><span class="sub">${sub}</span></span><span class="rv">${id === 'reports' ? nRep + ' รายงาน' : c.total + ' ไฟล์'}</span>${chev}</a>`; }).join('')}</div>`;
  return `${nav('เอกสาร', null, '', 'ค้นหาเอกสาร (รหัสหรือชื่อ)', '="docs"')}<div class="in">${ptr}<h1 class="lt">เอกสาร</h1>
 <p class="sec note sync">${ic('sync')}เอกสารจากเว็บกอง · อัปเดตล่าสุด ${stamp(at)}</p>
 <div class="dhome" id="dhome">${errCard(S, ['cats'], 'เอกสารเว็บกอง')}${errCard(S, ['docs'], 'ตัวอย่างรายงาน')}${S.wait.has('docs') ? skel(6) : groups.map(grp).join('')}</div><div id="dres" hidden></div></div>`;
}
export function kind(S, id, back) {
  const c = S.cats.find(x => x.id === id);
  return `${nav(c.name, back, '', 'ค้นหาในหมวดนี้')}<div class="in"><h1 class="lt">${esc(c.name)}</h1>
 <p class="sec note">${store.backendName() === 'demo' ? `แสดงตัวอย่าง ${c.rows.length} จาก ${c.total} ไฟล์ · โหมดตัวอย่าง` : `${c.total} ไฟล์`}</p><div class="grp">${c.rows.map(f => fileRow(S, f)).join('')}</div></div>`;
}
export function years(S, sys, back) {
  const s = S.catalog.systems.find(x => x.id === sys) || {}, y = s.years || [];
  return `${nav(s.name, back, `<button data-toast="เรียงตามปีล่าสุดก่อน" aria-label="เรียง">${ic('sort')}</button>`)}<div class="in"><h1 class="lt">${esc(s.name)}</h1>
 <div class="grp">${y.map(x => `<a class="row" href="${RB}/${sys}/${x.year}"><span class="rt">${x.year}</span><span class="rv">${x.count} รายงาน</span>${chev}</a>`).join('')}</div></div>`;
}
export function rounds(S, arg, back) {
  const [sys, y, by, val] = arg;
  const list = examples(S).filter(d => by ? d.year === +val : d.system === sys && d.year === +y);
  const t = String(by ? val : y);
  return `${nav(t, back)}<div class="in"><h1 class="lt">${esc(t)}</h1><div class="grp">${roundsList(S, list, location.hash.split('/doc/')[0] || RB)}</div></div>`;
}
// ตัวดูไฟล์: storagePath = ไฟล์จริงจาก bucket ของชนิดข้อมูล (signed URL · app.js signView) · ไม่มีไฟล์ในระบบ = เปิดจากเว็บกอง (sourceUrl)
// iPhone/iPad แสดง PDF ใน iframe ได้แค่หน้าแรก → แคปซูลเปิดแท็บใหม่แทน · ไม่รู้จำนวนหน้า = ไม่แสดงเลขหน้า
export const viewItem = (S, id) => S.docs.find(x => x.id === id) || S.files.find(x => x.id === id) || S.templates.find(x => x.code === id);
const isIOS = () => typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)));
const WEB_NOTE = 'เปิดจากเว็บกอง (ต้องอยู่ในเน็ตบริษัท)';
const extLink = (href, label, c = '') => `<a class="btn ${c}" href="${esc(href)}" target="_blank" rel="noopener">${ic('ext')}${label}</a>`;
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fext = it => (/\.([A-Za-z0-9]+)$/.exec(it.file || it.storagePath || '') || [])[1]?.toLowerCase() || '';
const dlBtn = (href, label) => `<a class="btn" href="${esc(href)}" download>${ic('dl')}${label}</a>`;
const openBtn = (S, id, it) => { const u = S.urls[id];
  if (u && u.url) return extLink(u.url, 'เปิดไฟล์ต้นฉบับ');
  if (it.sourceUrl) return `${extLink(it.sourceUrl, 'เปิดบนเว็บกอง')}<p class="sec note c">${WEB_NOTE}</p>`;
  return `<button class="btn" data-toast="${it.storagePath ? 'กำลังเตรียมไฟล์ ลองอีกครั้ง' : 'ยังไม่มีไฟล์นี้ในระบบ'}">${ic('ext')}เปิดไฟล์ต้นฉบับ</button>`; };
export function view(S, id, back) {
  const d = S.docs.find(x => x.id === id), it = viewItem(S, id), u = S.urls[id] || {};
  const title = d ? F.fmtTitle(d.title) : [it.code, it.title || it.name, it.rev && 'Rev.' + it.rev].filter(Boolean).join(' '), pg = it.pages, code = d ? 'FM-CE.SE-006' : it.code || it.title;
  const fake = typeof pg === 'number' && pg > 0 ? Array.from({ length: Math.min(pg, 200) }, (_, i) => `<div class="page"><div class="hd"><i></i><span>${esc(code)}${i ? ` · แผ่นที่ ${i + 1}` : ''}</span></div><div class="ln"></div>${i ? '' : '<div class="ln s"></div>'}</div>`).join('') : '';
  const badge = d && d.origin !== 'app' ? `<div class="vbd">${BADGE}</div>` : '';
  let body;
  if (it.storagePath) body = `<div class="in" data-vfile>${badge}${u.url && fext(it) && fext(it) !== 'pdf' ? `<div class="grp"><div class="p16"><b>ไฟล์ ${esc(fext(it).toUpperCase())}</b>${it.size ? `<div class="sec">${kb(it.size)}</div>` : ''}<div class="sec">เปิดดูบนหน้าเว็บไม่ได้ · ดาวน์โหลดไปเปิดในเครื่อง</div></div></div><div class="pad2">${dlBtn(u.url, 'ดาวน์โหลด')}${it.sourceUrl ? extLink(it.sourceUrl, 'เปิดบนเว็บกอง', 'alt') : ''}</div>`
      : u.url ? (isIOS() ? `<div class="grp"><div class="p16">${st('app', 'ไฟล์พร้อมเปิด')}</div></div><div class="pad2">${extLink(u.url, 'เปิดไฟล์ในแท็บใหม่')}</div>`
      : `<iframe class="vfile" src="${esc(u.url)}" title="${esc(title)}"></iframe><div class="pad2">${extLink(u.url, 'เปิดในแท็บใหม่', 'alt')}</div>`)
    + (it.editable ? `<div class="pad2"><button class="btn alt" data-dl-ed="${esc(id)}">${ic('dl')}ดาวน์โหลดไฟล์แก้ได้ (Word/Excel)</button></div>` : '')
    : u.err ? `<div class="grp">${errBody(u.err, 'file:' + id)}</div><div class="pad2">${errMore([['ไฟล์', u.err]])}</div>${it.sourceUrl ? `<div class="pad2">${extLink(it.sourceUrl, 'เปิดบนเว็บกอง', 'alt')}<p class="sec note c">${WEB_NOTE}</p></div>` : ''}`
    : `<div class="grp"><div class="p16">${st('sync', 'กำลังเปิดไฟล์…')}</div></div>`}</div>`;
  else if (it.sourceUrl) body = `<div class="in"><div class="grp"><div class="p16">${st('web', WEB_NOTE)}</div></div><div class="pad2">${extLink(it.sourceUrl, 'เปิดบนเว็บกอง')}</div></div>${fake ? `<div class="pages" data-pg="${pg}">${badge}${fake}<div class="pgbar">หน้า <span id="pn">1</span>/${pg}</div></div>` : ''}`;
  else body = fake ? `<div class="pages" data-pg="${pg}">${badge}${fake}<div class="pgbar">หน้า <span id="pn">1</span>/${pg}</div></div>` : `<div class="in">${badge}<div class="empty">ยังไม่มีไฟล์นี้ในระบบ</div></div>`;
  return `${nav(title, back, `<button data-sheet="${d ? 'info' : 'src'}:${esc(id)}" aria-label="${d ? 'ข้อมูลรายงาน' : 'ที่มาเอกสาร'}">${ic('info')}</button><button data-share aria-label="แชร์">${ic('share')}</button>`)}${body}`;
}

// ---------- งาน PM: ปัจจุบัน | ย้อนหลัง ----------
const SITE = { DM: 'DM ดอนเมือง', SB: 'SB สุวรรณภูมิ', MK: 'MK ทุ่งมหาเมฆ', 'สถานี': 'สถานี (RCAG · หอฯ)' };
const schedRow = (r, extra = '', base = '#/pm/new') => `<a class="row" href="${base}/${r.id}"><span class="rt"><span>${esc(F.rowTitle(r))}</span><span class="sub">${[extra, r.rotate ? F.rowDur(r) : `ครั้งที่ ${r.round}/${String(ORDER.fy).slice(2)} · ${F.rowDur(r)}`, r.people.join(', ')].filter(Boolean).join(' · ')}</span><span class="src">${ic('web')}เว็บกอง</span></span>${chev}</a>`;
const jobRow = (j, S) => { const cx = ctxOf(S), p = F.jobProg(j), s = F.stageOf(j, cx);
  return `<a class="row" href="#/pm/${j.id}"${S.ui.added === j.id ? ' data-new' : ''}>${ring(j.status === 'done' ? 1 : p.frac, `ความคืบหน้าฟอร์ม ${F.formsDone(j)}/${j.forms.length}`)}<span class="rt"><span>${esc(F.fmtTitle(j.title))}</span><span class="sub">${j.dates ? dRange(j.dates) : j.pm.ym ? F.ymLabel(j.pm.ym) : ''}</span>${F.overdue(j, S.today) ? st('warn', `เลยกำหนด ${F.overdue(j, S.today)} วัน`) : ''}<span class="sub rsn">${esc(F.rowReason(j, cx))}</span></span>${chev}</a>`; };
const SCH_SHOW = 3;
export function pm(S) {
  const cx = ctxOf(S), me = S.user.name, top = S.ui.pmt || 'pm-cur', seg = (id, t) => `<button data-pane="${id}" aria-pressed="${top === id}">${t}</button>`;
  const my = S.jobs.filter(j => F.mine(j, me)), od = j => F.overdue(j, S.today), start = j => j.dates ? j.dates[0] : '9';
  const todo = my.filter(j => j.status === 'doing').sort((a, b) => od(b) - od(a) || start(a).localeCompare(start(b)));
  const wait = [...my.filter(j => j.status === 'submitted').map(j => jobRow(j, S)), ...S.docs.filter(d => isMine(S, d) && d.status !== 'accepted').map(d => docRow(S, d, '#/pm'))];
  const next = F.scheduleGroups(S.sched, S.jobs.map(j => j.pm && j.pm.sched), S.today, me).slice(0, 2).flatMap(g => g[2].filter(r => F.hasMe(r.people, me)));
  const more = n => n > SCH_SHOW ? `<button class="row more" data-more>${ic('plus', 'lead')}<span class="rt"><span>ดูทั้งหมด ${n} งาน</span></span></button>` : '';
  const grp = (t, rows) => rows.length ? `<div class="sh">${t}</div><div class="grp">${rows.join('')}</div>` : '';
  const cur = `${errCard(S, ['jobs', 'templates'], 'งาน PM')}${grp('ต้องทำ', todo.map(j => jobRow(j, S)))}${grp('รอผู้ตรวจ', wait)}
 ${next.length ? `<div class="sh">ถัดไป</div><div class="grp">${next.map((r, i) => i < SCH_SHOW ? schedRow(r, F.ymLabel(r.ym)) : schedRow(r, F.ymLabel(r.ym)).replace('<a ', '<a data-x hidden ')).join('')}${more(next.length)}</div>` : ''}
 ${!todo.length && !wait.length && !next.length ? '<div class="empty">ไม่มีงานค้าง · งานตามตารางของคุณที่ถึงรอบจะขึ้นที่นี่ · กด "+ งาน PM" เพื่อเลือกเอง</div>' : ''}`;
  const past = [...S.docs.filter(d => isMine(S, d) && d.status === 'accepted').map(d => [d.modified, docRow(S, d, '#/pm')]), ...my.filter(j => j.status === 'done').map(j => [j.touched, jobRow(j, S)])].sort((a, b) => b[0].localeCompare(a[0]));
  return `${nav('งาน PM', null, '', 'ค้นหางาน')}<div class="in">${ptr}<h1 class="lt">งาน PM</h1><div class="seg" role="group" aria-label="มุมมอง">${seg('pm-cur', 'ปัจจุบัน')}${seg('pm-past', 'ย้อนหลัง')}</div>
 <div class="pane" id="pm-cur" ${top === 'pm-cur' ? '' : 'hidden'}>${cur}</div>
 <div class="pane" id="pm-past" ${top === 'pm-past' ? '' : 'hidden'}><p class="sec note">งานของฉันที่ผู้ตรวจรับแล้ว · ใช้เป็นตัวอย่างในงานถัดไปได้</p>${past.length ? `<div class="grp">${past.map(x => x[1]).join('')}</div>` : '<div class="empty">ยังไม่มีงานที่ผู้ตรวจรับแล้ว</div>'}</div></div>`;
}
// เลือกงานจากตาราง (ทั้งปี) · กรองตามศูนย์ · งานนอกตาราง
export function pick(S, _, back) {
  const site = S.ui.site || '', seg = (v, t) => `<button data-site="${v}" aria-pressed="${site === v}">${t}</button>`;
  const gs = F.scheduleGroups(S.sched.filter(r => F.hasMe(r.people, S.user.name) && (!site || r.site === site)), S.jobs.map(j => j.pm && j.pm.sched), S.today, S.user.name);
  return `${nav('เลือกงาน', back, '', 'ค้นหางานในตาราง')}<div class="in"><h1 class="lt">เลือกงาน</h1><p class="sec note">เฉพาะงานที่คุณเป็นผู้ปฏิบัติ · ตาราง PM ปีงบ ${ORDER.fy} · ${ORDER.no}</p>
 <div class="seg scr" role="group" aria-label="ศูนย์">${seg('', 'ทั้งหมด')}${['DM', 'SB', 'MK', 'สถานี'].map(x => seg(x, x)).join('')}</div>
 ${gs.map(([t, ym, L]) => L.length ? `<div class="sh">${t}${ym ? ' · ' + F.ymLabel(ym) : ''} · ${L.length} งาน</div><div class="grp">${L.map(r => schedRow(r, t === 'ทั้งปี' ? F.ymLabel(r.ym) : '', '#/pm/pick')).join('')}</div>` : '').join('')}
 <div class="grp"><a class="row" href="#/pm/pick/off">${ic('plus', 'lead')}<span class="rt"><span>งานนอกตาราง</span><span class="sub">กรอกเอง · ต้องระบุเหตุผล</span></span>${chev}</a></div></div>`;
}

// ---------- ค่าที่เติม + ที่มา (ใช้ทั้งหน้าเปิดงานและการ์ดงาน) ----------
// state: wait = รอยืนยัน/รอข้อมูล · ว่าง = ปกติ · แตะแถว = sheet รายละเอียด (ที่มา ตำแหน่ง วันที่ดึง ค่าเดิม แก้ไข+เหตุผล)
export function valueRows(j, mode) {
  const V = j.vals || {}, p = j.pm || {}, out = [], add = (key, label, value, wait = '') => out.push({ key, label, value, v: V[key], wait });
  if (mode === 'open') {
    add('center', 'ศูนย์', SITE[j.site] || j.site); add('system', 'ระบบ · จุด', p.base); add('round', 'ครั้งที่ · ปีงบ', `ครั้งที่ ${j.round} · ปีงบ ${p.fy}`);
    add('plan', 'เดือนตามแผน · จำนวนวัน', V.plan ? V.plan.v : '');
  }
  const ppl = (V.people && V.people.v) || (p.people || []).join(', ');
  if (mode === 'open' || ppl) add('people', 'ผู้ปฏิบัติ', ppl || '—', V.people && V.people.pending ? 'รอยืนยันชื่อ' : '');
  if (mode === 'open') add('order', 'คำสั่งเลขที่ (ปกรายงาน)', p.order ? `${p.order} ลว. ${dFull(ORDER.date)}` : '—');
  if (mode === 'job') {
    add('dates', 'วันที่ปฏิบัติงาน', j.dates ? `${dRange(j.dates)} · ${nDays(j.dates)} วัน` : `${V.plan ? V.plan.v : 'ยังไม่กำหนด'} · ยังไม่มีวันจริง`, j.dates ? '' : 'รอวันที่จาก FM-040');
    add('eng', 'วิศวกรเฝ้าระวัง', j.eng || 'ยังไม่ระบุ', j.eng ? '' : 'รอระบุ'); add('travel', 'การเดินทาง', j.travel || 'ยังไม่ระบุ', j.travel ? '' : 'รอระบุ');
  }
  return out;
}
const vrow = (r, sc) => `<button class="row vr" data-sheet="val:${sc}:${r.key}"><span class="rt"><span class="cap">${r.label}</span><span class="vl"><span>${esc(r.value)}</span>${srcTag(r.v, r.wait)}</span></span>${chev}</button>`;

// ---------- เปิดงาน: หน้าเดียว ----------
const imMatch = S => S.imp && S.draft.row && F.matchRow([S.draft.row], S.imp.data.subject, norm, roundOf);
export function open(S, _, back) {
  const d = S.draft, j = d.job, off = d.off, rows = valueRows(j, 'open'), prev = S.prev, im = S.imp;
  const chips = [...new Set([...(prev.eng || []), ...(j.eng ? [j.eng] : [])])];
  const engBlock = `<div class="p16" data-spot-id="eng"><b>วิศวกรเฝ้าระวัง</b><div class="sub sec">ชื่อที่ประสานตอนทำงาน · เลือกจากรอบก่อน</div>
 <div class="chipr" role="radiogroup" aria-label="วิศวกรเฝ้าระวัง">${chips.map(n => `<button class="pill" role="radio" aria-checked="${j.eng === n}" data-eng="${esc(n)}">${ic('hist')}${esc(n)}</button>`).join('')}<button class="pill" aria-expanded="${d.other}" data-eng-other>${ic('plus')}คนอื่น</button></div>
 ${d.other ? `<label class="search"><input id="engOther" autocomplete="off" placeholder="ชื่อวิศวกรเฝ้าระวัง" value="${esc(chips.includes(j.eng) ? '' : j.eng)}" aria-label="ชื่อวิศวกรเฝ้าระวัง"></label>` : ''}</div>`;
  const trv = `<div class="p16" data-spot-id="travel"><b>การเดินทาง</b><div class="sub sec">จำต่อสถานี · ${esc(j.pm.base)}</div>
 <div class="seg" role="radiogroup" aria-label="การเดินทาง">${['รถยนต์', 'เครื่องบิน', 'อื่น ๆ'].map(t => `<button role="radio" data-travel="${t}" aria-pressed="${j.travel === t}">${t}</button>`).join('')}</div>${prev.travel && prev.travel === j.travel ? `<span class="src">${ic('hist')}รอบก่อน · จำไว้</span>` : ''}</div>`;
  const offBlock = off ? `<div class="sh">งานนอกตาราง · กรอกเอง</div><div class="grp"><div class="p16" data-spot-id="offname"><b>ชื่องาน</b><label class="search"><input data-off="name" autocomplete="off" placeholder="เช่น DM CCTV (งานพิเศษ)" value="${esc(off.name)}" aria-label="ชื่องาน"></label>
 <b>ครั้งที่</b><div class="seg" role="radiogroup" aria-label="ครั้งที่">${[1, 2].map(n => `<button role="radio" data-offrd="${n}" aria-pressed="${off.round === n}">ครั้งที่ ${n}</button>`).join('')}</div>
 <b>วันเริ่ม · จำนวนวัน</b><label class="search"><span class="cap">เริ่ม</span><input type="date" data-off="start" value="${off.start}" aria-label="วันเริ่ม"></label><label class="search"><span class="cap">วัน</span><input type="number" min="1" max="31" inputmode="numeric" data-off="days" value="${off.days}" aria-label="จำนวนวัน"></label></div>
 <div class="p16" data-spot-id="offwhy"><b>เหตุผลที่ไม่อยู่ในตาราง</b><label class="search"><input data-off="reason" autocomplete="off" placeholder="ต้องระบุเหตุผล" value="${esc(off.reason)}" aria-label="เหตุผลที่ไม่อยู่ในตาราง"></label></div></div>` : '';
  const m = imMatch(S), imRow = m ? `${st('ok', `พบบันทึกงานเลขทะเบียน ${im.data.regNo} ที่ตรงกับงานนี้`)}<div class="sec">${esc(im.data.subject.slice(0, 90))}</div>`
    : im ? `<div class="sec">มีข้อมูลสารบรรณค้างอยู่ แต่เป็นงานอื่น</div><div class="sec">${esc(im.data.subject.slice(0, 90))}</div>${d.useImp ? '' : `<button class="btn sm alt" data-use-imp>ใช้ข้อมูลนี้กับงานนี้</button>`}`
    : `<div class="sec">ไม่มี FM-040 ตอนนี้ก็เปิดเป็นร่างได้ · งานจะรอ FM-040 ที่อนุมัติ</div>`;
  
  const src = `<div class="grp"><div class="p16" data-spot-id="f040"><div class="rowh">${ic('inbox', 'lead')}<b>FM-040 + บันทึกงานจากสารบรรณ</b></div>${imRow}${im ? '' : `<a class="btn sm alt" href="#/me/sarabun">${ic('book')}วิธีส่งเข้า PMS จากสารบรรณ</a>`}${im && (m || d.useImp) ? `<span class="st">${ic('done')}จะนำเข้าตอนเปิดงาน</span>` : ''}</div></div>`;
  const fixed = rows.filter(r => !r.wait), ask = rows.filter(r => r.wait), has = im && (m || d.useImp);
  const sum = `<div class="p16"><div class="big">${esc(j.pm.base)}</div><div class="sec">${esc(`ครั้งที่ ${j.round} · ${j.vals.plan ? j.vals.plan.v : ''} · ${SITE[j.site] || j.site}`)}</div></div>`;
  return `${nav('เปิดงาน PM', back)}<div class="in"><h1 class="lt">เปิดงาน PM</h1><p class="sec note">${off ? 'งานนอกตาราง · กรอกเองทั้งหมด' : 'เติมให้จากตาราง PM · แตะค่าเพื่อดูที่มา หรือแก้ไข (ต้องระบุเหตุผล)'}</p>
 ${off ? offBlock : `<div class="grp">${sum}</div><div class="pad2"><details class="rel dv"${S.ui.vo ? ' open' : ''}><summary data-vo>${ic('doc')}ข้อมูลครบ ${fixed.length} ช่อง · แตะดูต้นทาง</summary><div class="grp">${fixed.map(r => vrow(r, 'd')).join('')}</div></details></div>
 ${ask.length ? `<div class="sh">ต้องยืนยัน</div><div class="grp">${ask.map(r => vrow(r, 'd')).join('')}</div>` : ''}`}
 ${src}
 <div class="sh">ต้องกรอก</div><div class="grp">${engBlock}${trv}</div>
 <div class="pad2"><button class="btn alt" data-open-draft>${ic('draft')}เปิดเป็นร่าง (รอ FM-040)</button></div></div>`;
}
export const openNeeds = S => { const d = S.draft, j = d.job; return [[j.eng, 'eng'], [j.travel, 'travel'], ...(d.off ? [[d.off.name.trim(), 'offname'], [d.off.reason.trim(), 'offwhy']] : [])].filter(x => !x[0]).map(x => x[1]); };

// ---------- หน้างาน: ขั้นปัจจุบัน + 3 การ์ด ----------
const FILE_ST = { filled: ['ok', 'done'], attached: ['app', 'doc'], unsorted: ['todo', 'circle'], warn: ['warn', 'warn'], rejected: ['warn', 'warn'], error: ['warn', 'warn'] };
const exampleOf = (S, j) => S.docs.find(d => d.id === j.example) || S.docs.filter(d => isMine(S, d) && d.status === 'accepted' && d.system === j.system).sort((a, b) => b.modified.localeCompare(a.modified))[0] || S.docs.find(d => d.system === j.system) || null;
const stageBar = (j, p) => `<button class="stg" data-sheet="stages" aria-label="ขั้น ${F.PHASES[p][1]} · ดูทั้ง 3 ขั้น"><span class="dots">${F.PHASES.map((_, i) => `<i class="d${i < p ? ' dn' : i === p ? ' cur' : ''}"></i>`).join('')}</span><b>${F.PHASES[p][1]}</b><span class="sa">${ic('chev')}</span><span class="sec">${F.PHASES[p + 1] ? F.PHASES[p + 1][1] : 'จบงาน'}</span><span class="sinfo">${ic('info')}</span></button>`;
const f040Row = (S, j) => j.f040 === 'approved'
  ? `<div class="row" data-spot-id="f040"><span class="rt"><span class="cap">FM-CE.SE-040 ใบแจ้งซ่อม</span>${st('ok', 'อนุมัติแล้ว')}${j.vals.f040 ? `<span class="tags">${srcTag(j.vals.f040)}</span>` : ''}</span></div>`
  : `<div class="row wrapr" data-spot-id="f040"><span class="rt"><span class="cap">FM-CE.SE-040 ใบแจ้งซ่อม</span>${st('warn', 'รอ FM-040 ที่อนุมัติ')}<span class="sub">${j.draft ? 'เปิดเป็นร่าง · ' : ''}ต้องมีก่อนไปขั้นเตรียม</span></span><span class="acts2"><a class="btn sm" href="#/import">นำเข้า</a>${store.backendName() === 'demo' ? `<button class="btn sm alt" data-sim040>จำลอง: อนุมัติ</button>` : ''}</span></div>`;
const prepRows = (S, j, onlyBad) => F.prepChecks(j, ctxOf(S)).filter(c => !onlyBad || !c.auto).map(c => c.auto ? `<div class="row">${st('ok', c.label)}${c.note ? `<span class="sub">${esc(c.note)}</span>` : ''}</div>`
  : c.manual ? `<button class="row" data-chk="${c.id}"><span class="rt"><span>${esc(c.label)}</span>${st('todo', 'ยังไม่ได้ทำ · แตะเมื่อทำแล้ว')}${c.note ? `<span class="sub">${esc(c.note)}</span>` : ''}</span></button>`
  : `<a class="row" href="#/pm/${j.id}/${c.go || ''}"><span class="rt"><span>${esc(c.label)}</span>${st('warn', c.note || 'ยังไม่ผ่าน')}</span>${chev}</a>`).join('');
const attachOk = (j, id) => ({ result: j.forms.filter(f => !['FM-CE.SE-041', 'FM-CE.SE-001', 'FM-CE.SE-039', ''].includes(f.code)).every(f => F.formOk(j, f)), '001': F.formOk(j, j.forms.find(f => f.code === 'FM-CE.SE-001') || {}), '005': !!j.ready.f005, '040': j.f040 === 'approved', '041': F.formOk(j, j.forms.find(f => f.code === 'FM-CE.SE-041') || {}) })[id];
const FILE_ICON = { filled: 'done', attached: 'doc', unsorted: 'circle', warn: 'warn', rejected: 'warn', error: 'warn' };
const fileRows = (S, j) => (j.files || []).map((f, i) => { const [k] = FILE_ST[f.state] || FILE_ST.unsorted, u = S.ph[f.id], img = u && /^image\//.test(f.type);
  return `<button class="row" data-sheet="file:${i}"><span class="tn ${img ? '' : 'no'}">${img ? `<img src="${u}" alt="">` : ic('doc')}</span><span class="rt"><span class="fn">${esc(f.name)}</span>${st(k, f.text)}${f.target ? `<span class="sub">${esc(f.target)}</span>` : ''}</span>${chev}</button>`; }).join('');
const goRow = (kind, text, sub, cap, attrs) => `<div class="row"><span class="rt"><span>${esc(text)}</span>${sub ? st(kind, sub) : ''}</span><a class="btn sm" ${attrs}>${esc(cap)}</a></div>`;
// การ์ด "ต้องทำตอนนี้": เฉพาะสิ่งที่ต้องลงมือของขั้นนี้ · ว่าง = ✓ พร้อม…
function todoCard(S, j, ph) {
  const cx = ctxOf(S), it = [], V0 = j.vals || {}, dl = F.deadline(j, S.today), od = F.overdue(j, S.today);
  const line = j.dates ? `${dRange(j.dates)} · กำหนดส่ง ${dFull(dl.due)}${dl.left >= 0 ? ` (เหลือ ${dl.left} วันทำการ)` : ''}` : 'ยังไม่มีวันปฏิบัติงานจริง · รอวันที่จาก FM-040';
  if (j.status === 'submitted') it.push(`<div class="row">${st('app', 'ส่งรายงานแล้ว · รอผู้ตรวจรับ')}</div>`);
  else {
    if (j.f040 !== 'approved') it.push(f040Row(S, j));
    else {
      if (!j.dates) it.push(`<button class="row" data-sheet="val:j:dates"><span class="rt"><span>ระบุวันที่ปฏิบัติงาน</span>${st('warn', 'ยังไม่มีวันจริง')}</span>${chev}</button>`);
      if (ph === 0) { const bad = prepRows(S, j, true); if (bad) it.push(`<div class="sh2" data-spot-id="prep">ความพร้อมก่อนออกสถานี (QP 6.7)</div>${bad}`); }
    }
    if (ph === 0 && V0.people && V0.people.pending) it.push(`<button class="row" data-sheet="val:j:people"><span class="rt"><span>ยืนยันรายชื่อผู้ปฏิบัติ</span>${st('warn', 'รอยืนยันชื่อ')}</span>${chev}</button>`);
    for (const [k, l] of [['eng', 'วิศวกรเฝ้าระวัง'], ['travel', 'การเดินทาง']]) if (!j[k]) it.push(`<button class="row" data-sheet="val:j:${k}"><span class="rt"><span>ระบุ${l}</span>${st('warn', 'ยังไม่ระบุ')}</span>${chev}</button>`);
    if (ph === 1) {
      const left = j.forms.filter(f => !F.formOk(j, f)), first = left[0], pf = j.forms.find(f => (F.formProg(j, f).pend || 0) > 0), np = j.forms.reduce((n, f) => n + (F.formProg(j, f).pend || 0), 0);
      if (first) it.push(goRow('todo', `ฟอร์มที่เหลือ ${left.length} จาก ${j.forms.length}`, `ถัดไป: ${first.name}`, 'ไปกรอก', `href="#/pm/${j.id}" data-spot="form:${first.code || 'review'}"`));
      if (pf) it.push(goRow('warn', `ยืนยันค่าที่อ่านจากไฟล์ ${np} ช่อง`, 'รอยืนยัน', 'ไปยืนยัน', `href="#/pm/${j.id}" data-spot="form:${pf.code || 'review'}"`));
    }
    if (ph === 2) { const bad = ATTACH_69.filter(a => !a.opt && !attachOk(j, a.id)); if (bad.length) it.push(`<div class="sh2">ยังไม่พร้อมแนบรายงาน (QP 6.9)</div>${bad.map(a => `<div class="row">${st('todo', `${a.code ? a.code + ' ' : ''}${a.name}`)}</div>`).join('')}`); }
  }
  if (!it.length) it.push(`<div class="row">${st('ok', ph === 0 ? 'พร้อมเข้าขั้นหน้างาน' : ph === 1 ? 'พร้อมไปขั้นส่งรายงาน' : 'พร้อมสร้างรายงาน')}</div>`);
  return `<div class="grp card"><div class="gh">ต้องทำตอนนี้<span class="sub">${esc(line)}</span>${od ? `<span class="st w mt1">${ic('warn')}เลยกำหนด ${od} วัน</span>` : ''}</div>${it.join('')}</div>`;
}
export function job(S, id, back) {
  const j = S.jobs.find(x => x.id === id), cx = ctxOf(S), ph = F.phaseOf(j, cx), pend = f => F.formProg(j, f).pend;
  const ex = exampleOf(S, j), rows = valueRows(j, 'job').map(r => vrow(r, 'j')).join('');
  const forms = j.forms.map(f => { const p = F.formProg(j, f), code = f.code || 'review', href = f.kind === 'tx' && j.tx ? `#/pm/${j.id}/fill` : f.kind === 'asset' && (j.assetCheck || []).length ? `#/pm/${j.id}/asset` : '', frac = p.total ? p.done / p.total : 0,
    nf = (j.files || []).filter(x => x.target && x.target === f.code).length, body = `${ring(frac, p.total > 1 ? `ยืนยันแล้ว ${p.done} จาก ${p.total}` : p.done ? 'ทำแล้ว' : 'ยังไม่ได้ทำ')}<span class="rt"><span>${f.code ? f.code + ' ' : ''}${esc(f.name)}${f.wi ? ` <span class="wic">(${esc(f.wi)})</span>` : ''}</span><span class="sub">${esc(p.text)}${nf ? ` · ไฟล์แนบ ${nf}` : ''}</span>${p.sub ? `<span class="sub">${esc(p.sub)}</span>` : ''}${f.sub ? `<span class="sub">${esc(f.sub)}</span>` : ''}${f.warn ? `<span class="src w">${ic('warn')}${esc(f.warn)}</span>` : ''}</span>${chev}`;
    const row = href ? `<a class="row" href="${href}" data-spot-id="form:${code}">${body}</a>` : `<button class="row" data-sheet="manual:${code}" data-spot-id="form:${code}">${body}</button>`;
    return row + (p.pend ? `<div class="row cf"><span class="rt">${fileTag}</span><button class="btn sm alt" data-confirm-form="${esc(code)}">${ic('done')}ยืนยันทั้งหมดในฟอร์มนี้ · ${p.pend} ช่อง</button></div>` : ''); }).join('');
  const nPend = j.forms.reduce((n, f) => n + (pend(f) || 0), 0);
  const detail = `<div class="pad2"><details class="rel dv"${S.ui.vo ? ' open' : ''}><summary data-vo>${ic('doc')}รายละเอียดงาน · ค่าที่ระบบกรอก</summary><div class="grp">${rows}${j.f040 === 'approved' ? f040Row(S, j) : ''}${prepRows(S, j, false)}</div></details></div>`;
  return `${nav(F.navTitle(j), back)}<div class="in pt2">${j.status === 'done' ? '' : stageBar(j, ph)}
 ${todoCard(S, j, ph)}
 <div class="grp card"><div class="gh">นำเข้าผลหน้างาน<span class="sub">ไฟล์ · รูป · กระดาษที่จดค่า ระบบเติมฟอร์มให้ · อ่านในเครื่อง ไม่ส่งออกนอกเครื่อง</span></div>
 <div class="row pr"><button class="btn alt" data-cam="attach">${ic('cam')}ถ่ายรูป</button><button class="btn alt" data-file="attach">${ic('doc')}เลือกไฟล์</button></div>
 ${(j.tx || []).length ? `<div class="row pr"><a class="btn alt" href="./fieldsheet.html?job=${encodeURIComponent(j.id)}&n=${j.tx.length}&freqs=${j.tx.map(t => +t.freq || '').join(',')}" target="_blank" rel="noopener">${ic('doc')}พิมพ์ใบจดค่า</a><span class="sec">จดลายมือหน้างาน แล้วถ่ายรูปกลับมา ระบบเติมให้</span></div>` : ''}
 ${(j.files || []).length ? fileRows(S, j) : `<div class="row"><span class="sec">ยังไม่มีไฟล์ · แนบฟอร์มที่กรอกในคอม (.xlsx .docx) รูป หรือ PDF · ไม่รับวิดีโอ</span></div>`}</div>
 <div class="grp card"><div class="gh">ฟอร์ม<span class="sub">ตามขอบเขต WI · ${nPend ? `เติมจากไฟล์แล้ว รอยืนยัน ${nPend} ช่อง` : 'ไฟล์เติมให้ก่อน ที่เหลือกรอกเอง'}</span></div>${forms}
 <button class="row" data-sheet="example"><span class="rt"><span class="cap">ตัวอย่างรายงานที่ใช้เทียบ</span><span>${ex ? esc(F.fmtTitle(ex.title)) : 'ยังไม่มีตัวอย่าง'} · <b class="lnk">เปลี่ยน</b></span></span>${chev}</button></div>
 ${detail}</div>`;
}

// ---------- หน้ากรอกค่า (เครื่องส่ง FM-202) ----------
const fld = (S, f, t, n) => {
  const v = t.v[f.k] ?? '', b = bad(f, v), pd = t.pend && t.pend[f.k];
  return `<label class="fld${b ? ' bad' : ''}" data-lbl="${esc(f.n)}" data-min="${f.min}" data-max="${f.max}"><span class="rt"><span class="t">${esc(f.t)}</span><span class="sub">${esc(f.std)}</span>${pd ? fileTag : ''}<span class="wn">${ic('warn')}เกินช่วง</span></span>
  <input inputmode="decimal" enterkeyhint="next" value="${esc(v)}" data-n="${n}" data-k="${f.k}" aria-label="${esc(f.n)}"><span class="u">${f.u}</span>${f.cam ? camBtn(S, `${n}.${f.k}`, t.photos[f.k], 'ถ่ายรูป ' + f.t) : ''}</label>`;
};
const idFld = (S, t, n, k, title, sub) => `<label class="fld" data-lbl="${title}"><span class="rt"><span class="t">${title}</span><span class="sub">${sub}</span>${t.pend && t.pend[k] ? fileTag : ''}</span><input class="wide" enterkeyhint="next" autocapitalize="off" autocomplete="off" value="${esc(t.v[k] ?? '')}" data-n="${n}" data-k="${k}" aria-label="${title}">${camBtn(S, `${n}.${k}`, t.photos[k], 'ถ่ายรูป ' + title)}</label>`;
// รูปหลักฐานของงาน (กระดาษจดค่า/ลายมือ ที่อ่านไม่ได้) แสดงข้างฟอร์ม ให้พิมพ์ค่าเองโดยมองรูป
const evidence = (S, j) => { const L = (j.files || []).filter(f => S.ph[f.id] && /^image\//.test(f.type) && (!f.target || f.target === 'FM-CE.SE-202')); return L.length ? `<div class="sh">รูปประกอบ · ดูเทียบตอนพิมพ์ค่า</div><div class="ph">${L.map(f => `<button class="tile" data-sheet="file:${j.files.indexOf(f)}" aria-label="${esc(f.name)}"><img src="${S.ph[f.id]}" alt=""></button>`).join('')}</div>` : ''; };
const confirmBar = j => { const p = F.formProg(j, j.forms.find(f => f.kind === 'tx') || {}); return p.pend ? `<div class="pad2"><button class="btn alt" data-confirm-form="FM-CE.SE-202">${ic('done')}ยืนยันทั้งหมดในฟอร์มนี้ · ${p.pend} ช่อง</button></div>` : ''; };
export function fill(S, _, back) {
  const j = S.job, m = j.cur, t = j.tx[m - 1], k = txDoneCount(j);
  const chips = j.tx.map(x => { const d = txDone(j, x), c = x.n === m; return `<button class="chip ${c ? 'cur' : d ? 'dn' : ''}" data-m="${x.n}" aria-label="Tx ${x.n}, ${x.freq} MHz, ${c ? 'ปัจจุบัน' : d ? 'เสร็จแล้ว' : 'ยังไม่ทำ'}"><b>${d ? ic('done') : ''}Tx ${x.n}</b><small>${x.freq.toFixed(x.freq % 1 ? 2 : 1).replace(/(\.\d)0$/, '$1')} MHz</small></button>`; }).join('');
  return `${nav(`เครื่องส่ง ${m}/${j.tx.length}`, back)}<div class="in"><div class="strip-w"><div class="strip" id="strip">${chips}</div>
 <div class="prg"><span class="cap">${m} จาก ${j.tx.length} · เสร็จ <span class="cnt" data-v="${k}">${k}</span></span><div class="bar3"><i style="width:${100 * k / j.tx.length}%"></i></div></div></div>
 <div class="sh">ข้อมูลเครื่อง · อ่านจากสติกเกอร์</div><div class="grp">${idFld(S, t, m, 'asset', 'Asset No', 'จากสติกเกอร์ทรัพย์สิน')}${idFld(S, t, m, 'serial', 'Serial', 'จากแผ่นป้ายเครื่อง')}</div>
 <div class="sh">ค่าที่วัด</div><div class="grp">${j.fields.map(f => fld(S, f, t, m)).join('')}</div>${evidence(S, j)}${confirmBar(j)}</div>`;
}
const wiText = `<div class="grp"><div class="p16"><div class="cap">ขั้นตอน</div>ต่อ CMA180 เข้า Ant port ผ่าน Attn 30 dB ตั้ง… (ข้อความตัวอย่าง)</div></div>`;
export function table(S, _, back) {
  const j = S.job, m = j.cur, k = txDoneCount(j), cols = j.fields, pd = exampleOf(S, j) || S.docs[0];
  const body = j.tx.map(t => `<tr><td>${t.n}</td>${cols.map(f => `<td${bad(f, t.v[f.k] ?? '') ? ' class="bad"' : t.pend && t.pend[f.k] ? ' class="pd"' : ''}><input inputmode="decimal" enterkeyhint="next" value="${esc(t.v[f.k] ?? '')}" data-n="${t.n}" data-k="${f.k}" aria-label="Tx ${t.n} ${esc(f.n)}"></td>`).join('')}</tr>`).join('');
  return `${nav(`FM-CE.SE-202 · เครื่องส่ง ${j.tx.length} เครื่อง`, back)}<div class="tb2"><div class="tl"><div class="prg pt2"><span class="cap">${m} จาก ${j.tx.length} · เสร็จ <span class="cnt" data-v="${k}">${k}</span></span><div class="bar3"><i style="width:${100 * k / j.tx.length}%"></i></div></div>
 ${confirmBar(j)}<table><thead><tr><th>Tx</th>${cols.map(f => `<th>${esc(f.n).replace(' (', '<br>(')}</th>`).join('')}</tr></thead><tbody id="tbd">${body}</tbody></table><p class="sec">Apple Pencil เขียนลงช่องได้เลย (Scribble) · ช่องขอบประ = เติมจากไฟล์ รอยืนยัน (แก้ค่าหรือกดยืนยันทั้งหมด)</p></div>
 <div class="wi"><div class="grp">${idFld(S, j.tx[m - 1], m, 'asset', `Asset No · Tx ${m}`, 'จากสติกเกอร์ทรัพย์สิน').replace('<input ', '<input id="wiAsset" ')}</div>
 <div class="seg"><button data-pane="w-wi" aria-pressed="true">WI</button><button data-pane="w-pr" aria-pressed="false">รอบก่อน</button><button data-pane="w-pdf" aria-pressed="false">ฟอร์ม PDF</button></div>
 <div class="pane" id="w-wi"><div class="p16"><b>WI-CE.SE-002 Rev.06 · ภาคผนวก ข</b><div class="sec" id="wf">ช่องที่เลือก: ${esc(cols[2].n)} · Tx ${m}</div></div><div class="page w70"><div class="hd"><i></i><span>WI-CE.SE-002 · หน้า 50</span></div><div class="ln"></div></div>${wiText}</div>
 <div class="pane" id="w-pr" hidden><div class="p16"><a class="btn alt" href="#/pm/${j.id}/doc/${pd.id}">${ic('doc')}เปิดรายงานรอบก่อน (${esc(pd.title)})</a></div></div>
 <div class="pane" id="w-pdf" hidden><div class="page"><div class="hd"><i></i><span>FM-CE.SE-202 Rev.04</span></div><div class="ln"></div></div></div></div></div>`;
}
export function asset(S, _, back) {
  const j = S.job;
  const rows = j.assetCheck.map(n => { const t = j.tx[n - 1], a = F.assetState(t), p = S.ph[t.photos.asset];
    return `<div class="row"><span class="tn ${p ? '' : 'no'}">${p ? `<img src="${p}" alt="">` : ic('cam')}</span><span class="rt"><span>Tx ${n} · ${t.model}</span><span class="sub">ทะเบียน ${t.reg}</span>${st(...a)}</span>${camBtn(S, `${n}.asset`, t.photos.asset, 'ถ่ายรูปสติกเกอร์ Tx ' + n)}</div>`; }).join('');
  return `${nav('ตรวจเลขทรัพย์สิน', back)}<div class="in"><h1 class="lt">ตรวจเลขทรัพย์สิน</h1><p class="sec note">ถ่ายสติกเกอร์ทรัพย์สิน แล้วพิมพ์เลขในหน้ากรอกค่า แอปเทียบกับทะเบียนให้</p><div class="grp">${rows}</div></div>`;
}
export function tools(S, _, back) {
  const rows = S.job.tools.length ? S.job.tools.map((t, i) => { const ex = Date.parse(t.due) < Date.parse(S.today);
    return `<div class="row"><span class="rt"><span>${esc(t.name)}</span><span class="sub">Asset ${t.asset} · Due ${dFull(t.due)}</span>${ex ? st('warn', 'หมดอายุ') : st('ok', 'ยังไม่หมดอายุ')}</span>${camBtn(S, 'tool.' + i, t.photo, 'ถ่ายสติกเกอร์ calibration ' + esc(t.name))}</div>`; }).join('') : '<div class="empty">ยังไม่ได้ลงเครื่องมือ</div>';
  return `${nav('เครื่องมือวัด', back)}<div class="in"><h1 class="lt">เครื่องมือวัด</h1><p class="sec note">ถ่ายสติกเกอร์ calibration เก็บเป็นหลักฐานของงานนี้</p><div class="grp">${rows}</div></div>`;
}

// ---------- ฉัน (แท็บหลัก) ----------
export function me(S) {
  const r = (i, t, s) => `<button class="row" data-toast="โหมดตัวอย่าง · ยังไม่เปิดใช้">${ic(i, 'lead')}<span class="rt"><span>${t}</span><span class="sub">${s}</span></span>${chev}</button>`, auto = store.pref('auto') !== false;
  return `${nav('ฉัน')}<div class="in"><h1 class="lt">ฉัน</h1><div class="hero"><div class="avatar">${esc([...S.user.name][0])}</div><div class="big">${esc(S.user.name)}</div><div class="sec">${esc(S.user.email || 'CE.SE · AEROTHAI')}</div></div>
 <div class="grp">${r('ok', 'บัญชีบริษัท', store.backendName() === 'demo' ? 'โหมดตัวอย่าง · ยังไม่เชื่อมต่อ' : S.user.email || '')}${store.backendName() === 'demo' ? '' : `<button class="row" data-sheet="pw">${ic('lock', 'lead')}<span class="rt"><span>เปลี่ยนรหัสผ่าน</span></span>${chev}</button>`}${r('sig', 'ลายเซ็นของฉัน', 'ใช้ตอนออกรายงาน')}${S.user.is_admin ? `<a class="row" href="#/me/users">${ic('gear', 'lead')}<span class="rt"><span>ตั้งค่า</span><span class="sub">ผู้ใช้ · แจ้งเตือนรอบ PM · calibration</span></span>${chev}</a>` : r('gear', 'ตั้งค่า', 'แจ้งเตือนรอบ PM · calibration')}</div>
 <div class="sh">เชื่อมต่อ</div><div class="grp"><a class="row" href="#/me/sarabun">${ic('doc', 'lead')}<span class="rt"><span>เชื่อมสารบรรณ</span><span class="sub">ส่งบันทึกงานเข้า PMS ด้วยคำสั่งลัดหรือปุ่มใน Safari</span>${sarStat()}</span>${chev}</a><div class="kv"><span>เซิร์ฟเวอร์: ${store.backendName() === 'demo' ? 'ตัวอย่าง (demo)' : 'Supabase'}</span><button class="btn alt" data-be="${store.backendName() === 'demo' ? 'supabase' : 'demo'}">สลับเป็น ${store.backendName() === 'demo' ? 'Supabase' : 'demo'}</button></div></div>
 <div class="sh">พื้นที่ offline</div><div class="grp"><div class="kv"><span>ตั้งเก็บ offline อัตโนมัติ · ตัวอย่าง (ยังไม่โหลดไฟล์จริง)</span>${sw(auto, 'data-pref="auto" aria-label="ตั้งเก็บ offline อัตโนมัติ (ตัวอย่าง)"')}</div><div class="kv"><span>ตั้งไว้ในเครื่อง</span><span>${store.offlineCount()} รายการ</span></div></div>
 <div class="grp">${r('info', 'เกี่ยวกับ / เวอร์ชัน', `${S.version} (${store.backendName()})`)}</div>
 <div class="grp k"><button class="row red" data-signout>${ic('out')}ออกจากระบบ</button></div></div>`;
}

// ---------- นำเข้าจากสารบรรณ (ข้อมูลที่ bookmarklet ส่งมา = ข้อความไม่น่าเชื่อถือ → esc ทุกช่อง) ----------
const sarStat = () => { const s = store.pref('sarabun'); return s && s.last ? st('ok', `ติดตั้งแล้ว · ใช้ล่าสุด ${dFull(s.last)}`) : st('todo', 'ยังไม่ติดตั้ง'); };
const cut = (t, n) => { const a = [...t.replace(/\s+/g, ' ')]; return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };
function importScreen(S, _, back) {
  const I = S.imp, head = `${nav('นำเข้าจากสารบรรณ', back)}<div class="in"><h1 class="lt">นำเข้าจากสารบรรณ</h1>`;
  if (!I) return `${head}<div class="grp"><div class="p16"><div class="big">ยังไม่มีข้อมูลที่ส่งเข้ามา</div><div class="sec">เปิดหนังสือในสารบรรณ → พิมพ์บันทึกงาน → แตะแชร์ → "ส่งเข้า PMS"</div></div></div><div class="pad2"><a class="btn alt" href="#/me/sarabun">${ic('book')}วิธีติดตั้ง</a></div></div>`;
  const d = I.data, j = impTarget(S), row = !j && F.matchRow(S.sched.filter(r => !S.jobs.some(x => x.pm && x.pm.sched === r.id)), d.subject, norm, roundOf), kv = ([l, v]) => `<div class="kv"><span>${l}</span><span>${esc(v)}</span></div>`;
  const rows = [['เลขทะเบียน', d.regNo], ['เลขที่เอกสาร', d.docNo], ['ลงวันที่', d.docDate], ['ประเภทเอกสาร', d.docType], ['สถานะ', d.status], ['จาก', d.from], ['ถึง', d.to], ['อ้างถึง', d.ref], ['เรื่อง', d.subject]].filter(r => r[1]);
  const ents = d.entries.map(e => `<div class="row"><span class="rt"><span>${esc(e.unit || e.name)}</span><span class="sub">${esc(e.at)}${e.note ? ' · ' + esc(cut(e.note, 90)) : ''}</span></span></div>`).join('');
  const m = j ? `<button class="row" data-sheet="impjob">${ic('clip', 'lead')}<span class="rt"><span>จับคู่กับงาน: ${esc(F.fmtTitle(j.title))}</span><span class="sub">แตะเพื่อเปลี่ยน</span></span>${chev}</button>`
    : row ? `<a class="row" href="#/pm/new/${row.id}">${ic('plus', 'lead')}<span class="rt"><span>งานนี้ยังไม่ได้เปิด · ตรงกับตาราง PM</span><span class="sub">${esc(F.rowTitle(row))} · แตะเพื่อเปิดงานพร้อมข้อมูลนี้</span></span>${chev}</a>`
    : `<button class="row" data-sheet="impjob">${ic('warn', 'lead w')}<span class="rt"><span>ยังไม่พบงานที่ตรงกับหัวเรื่อง</span><span class="sub">แตะเพื่อเลือกงานเอง</span></span>${chev}</button>`;
  return `${head}${d.trimmed ? `<div class="grp"><div class="p16">${st('warn', 'ข้อมูลยาวเกิน · ตัดข้อความ/รายการบันทึกงานออกบางส่วน')}<div class="sec">ช่องหลักครบ แต่ข้อความหรือรายการท้าย ๆ ในบันทึกงานอาจหายไป · ต้องการครบทุกข้อความ ใช้บุ๊กมาร์กแทนคำสั่งลัด</div></div></div>` : ''}<div class="grp"><div class="kv"><span>ที่มา</span>${st('app', 'สารบรรณ')}</div>${rows.map(kv).join('')}${I.pdfs.length ? kv(['ไฟล์ PDF', I.pdfs.length + ' ไฟล์']) : ''}</div>
 ${d.entries.length ? `<div class="sh">บันทึกงาน ${d.entries.length} รายการ</div><div class="grp">${ents}</div>` : ''}
 <div class="grp">${m}</div>
 <div class="pad2">${j ? `<button class="btn" data-imp-save>${ic('ok')}บันทึกเข้างาน</button>` : row ? `<a class="btn" href="#/pm/new/${row.id}">${ic('plus')}เปิดงานจากตาราง</a>` : `<button class="btn alt" data-sheet="impjob">${ic('clip')}เลือกงานเพื่อบันทึก</button>`}</div>
 <p class="sec note c">บันทึกเฉพาะในเครื่องนี้ · ยังไม่ส่งขึ้นเซิร์ฟเวอร์</p></div>`;
}
const stp = (n, icon, title, sub, chip) => `<div class="stp"><span class="n">${n}</span><span class="rt"><span>${title}</span><span class="sub">${sub}</span>${chip ? `<span class="st mt1">${ic(icon)}${chip}</span>` : ''}</span></div>`;
function sarabun(S, _, back) {
  return `${nav('เชื่อมสารบรรณ', back)}<div class="in"><h1 class="lt">เชื่อมสารบรรณ</h1>
 <div class="grp"><div class="row"><span class="rt"><span>ส่งเข้า PMS</span>${sarStat()}</span></div></div>
 <p class="sec note">แอปไม่เห็นรหัสผ่านสารบรรณของคุณ · ใช้การล็อกอินใน Safari ของคุณเอง (iPhone เติมรหัสด้วย Face ID ได้)</p>
 <div class="sh">วิธีหลัก: คำสั่งลัด (iPhone / iPad / Mac)</div>
 <div class="pad2"><a class="btn" href="./shortcuts/ส่งเข้า-PMS.shortcut">${ic('dl')}เพิ่มคำสั่งลัด (iPhone/iPad/Mac)</a></div>
 <div class="grp">
  ${stp(1, 'dl', 'แตะปุ่มด้านบน แล้วกด "เพิ่มคำสั่งลัด"', 'แอปคำสั่งลัดเปิดขึ้นมาเอง · ครั้งแรก iPhone จะถามอนุญาตให้รันสคริปต์บนหน้าเว็บ ให้กดอนุญาต', 'ดาวน์โหลด › เพิ่มคำสั่งลัด')}
  ${stp(2, 'doc', 'เปิดหนังสือในสารบรรณ → "พิมพ์บันทึกงาน"', 'ใน Safari ล็อกอินสารบรรณด้วยบัญชีของคุณ', 'พิมพ์บันทึกงาน')}
  ${stp(3, 'share', 'แตะแชร์ → "ส่งเข้า PMS"', 'แอปเปิดพร้อมข้อมูล ตรวจแล้วกด "บันทึกเข้างาน" · ถ้าไม่เห็นในรายการ เลื่อนลงสุด › แก้ไขการดำเนินการ › เปิด "ส่งเข้า PMS"', 'แชร์ › ส่งเข้า PMS')}</div>
 <div class="sh">ทางเลือก: บุ๊กมาร์ก</div>
 <div class="pad2"><a class="btn" data-bm-link href="#/me/sarabun" draggable="true">${ic('book')}ส่งเข้า PMS</a><button class="btn alt" data-bm-copy>${ic('doc')}คัดลอกโค้ดปุ่ม</button></div>
 <p class="sec note c">คอมพิวเตอร์: ลากปุ่มบนขึ้นแถบบุ๊กมาร์ก · iPhone: แตะ "คัดลอกโค้ดปุ่ม" แล้วทำตามขั้นตอนด้านล่าง</p>
 <div class="seg" role="group" aria-label="อุปกรณ์"><button data-pane="bm-ph" aria-pressed="true">iPhone</button><button data-pane="bm-pc" aria-pressed="false">คอมพิวเตอร์</button></div>
 <div class="pane" id="bm-ph"><div class="grp">
  ${stp(1, 'share', 'คัดลอกโค้ด แล้วเพิ่มบุ๊กมาร์กใด ๆ', 'แตะ "คัดลอกโค้ดปุ่ม" ด้านบน · เปิดหน้าเว็บอะไรก็ได้ใน Safari · แตะแชร์ → เพิ่มบุ๊กมาร์ก → ตั้งชื่อ "ส่งเข้า PMS"', 'แชร์ › เพิ่มบุ๊กมาร์ก')}
  ${stp(2, 'book', 'แก้ที่อยู่ของบุ๊กมาร์กเป็นโค้ดที่คัดลอก', 'Safari › บุ๊กมาร์ก › แก้ไข › แตะ "ส่งเข้า PMS" › ลบที่อยู่เดิมแล้ววางโค้ด › เสร็จ', 'บุ๊กมาร์ก › แก้ไข › วาง')}
  ${stp(3, 'doc', 'ใช้งาน', 'ล็อกอินสารบรรณ → เปิดหนังสือ → "พิมพ์บันทึกงาน" → แตะแถบที่อยู่ เลือกบุ๊กมาร์ก "ส่งเข้า PMS" (หรือเปิดบุ๊กมาร์กแล้วแตะ)', 'พิมพ์บันทึกงาน › ส่งเข้า PMS')}</div></div>
 <div class="pane" id="bm-pc" hidden><div class="grp">
  ${stp(1, 'book', 'ลากปุ่ม "ส่งเข้า PMS" ขึ้นแถบบุ๊กมาร์ก', 'ถ้าไม่เห็นแถบ: Chrome/Edge กด Ctrl+Shift+B · Safari กด ⌘⇧B', 'ลาก › แถบบุ๊กมาร์ก')}
  ${stp(2, 'doc', 'เปิดหนังสือในสารบรรณ', 'ล็อกอินด้วยบัญชีของคุณ → เปิดหนังสือ → "พิมพ์บันทึกงาน"', 'พิมพ์บันทึกงาน')}
  ${stp(3, 'ok', 'คลิกบุ๊กมาร์ก "ส่งเข้า PMS"', 'หน้าต่างแอปเปิดพร้อมข้อมูล · ตรวจแล้วกด "บันทึกเข้างาน"', 'ส่งเข้า PMS › บันทึกเข้างาน')}</div></div></div>`;
}
// ---------- ฉัน › ตั้งค่า › ผู้ใช้ (เฉพาะแอดมิน · เซิร์ฟเวอร์ตรวจสิทธิ์ซ้ำเสมอ) ----------
function users(S, _, back) {
  const U = S.users || { st: 'load' }, head = `${nav('ผู้ใช้', back)}<div class="in"><h1 class="lt">ผู้ใช้</h1>`;
  if (U.st === 'nd') return `${head}<div class="grp"><div class="p16">${st('warn', 'ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์ · ดูวิธีใน backend/edge/README.md')}</div></div></div>`;
  if (U.st === 'err') return `${head}<div class="sh">โหลดผู้ใช้ไม่สำเร็จ</div><div class="grp">${errBody(U.e, 'users')}</div><div class="pad2">${errMore([['users', U.e]])}</div></div>`;
  if (U.st === 'load') return `${head}<div class="grp"><div class="p16">${st('sync', 'กำลังโหลด…')}</div></div></div>`;
  const rows = U.rows.map(u => { const id = esc(u.id), mine = u.id === S.user.id;
    return `<div class="p16" data-uid="${id}"><div class="big">${esc(u.name || u.username)}</div><div class="sec">${esc(u.username)}${u.is_admin ? ' · แอดมิน' : ''}${mine ? ' · บัญชีของคุณ' : ''}${u.last_sign_in_at ? ' · เข้าล่าสุด ' + dFull(u.last_sign_in_at) : ' · ยังไม่เคยเข้า'}</div>${u.approved ? st('ok', 'ใช้งานอยู่') : st('warn', 'ปิดใช้งาน')}
 ${mine || u.is_admin ? '' : `<div class="uact"><button class="btn sm alt" data-sheet="ureset:${id}">${ic('lock')}รีเซ็ตรหัส</button><button class="btn sm alt" data-u-set="${id}:${u.approved ? 0 : 1}">${ic(u.approved ? 'out' : 'done')}${u.approved ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}</button></div>`}</div>`; }).join('');
  return `${head}<div class="pad2"><button class="btn" data-sheet="uadd">${ic('plus')}เพิ่มผู้ใช้</button></div><div class="sh">${U.rows.length} บัญชี</div><div class="grp">${rows || '<div class="empty">ยังไม่มีผู้ใช้</div>'}</div></div>`;
}
export { importScreen as import, sarabun, users };

// ---------- sheet ----------
const frame = (t, body) => `<i class="grab"></i><div class="sh-h"><span>${t}</span><button data-close>เสร็จ</button></div>${body}`;
export const actSheet = (title, a) => frame(esc(title), `<div class="grp"><button class="row" ${[...a.attributes].filter(x => x.name.startsWith('data-')).map(x => `${x.name}="${esc(x.value)}"`).join(' ')}>${a.querySelector('svg').outerHTML.replace('class="ic ', 'class="ic lead ')}<span class="rt"><span>${esc(a.textContent)}</span></span></button></div>`);
const kvr = (l, v) => v ? `<div class="kv"><span>${l}</span><span>${v}</span></div>` : '';
// แก้ค่าได้เฉพาะคีย์เหล่านี้ (ค่าที่ระบบเติมจากตาราง/สารบรรณ แก้แล้วเก็บค่าเดิม + เหตุผล)
const EDIT = { dates: 'range', people: 'text', eng: 'text', travel: 'travel', order: 'text' };
function valSheet(S, sc, key) {
  const j = sc === 'd' ? S.draft.job : S.job, row = valueRows(j, sc === 'd' ? 'open' : 'job').find(r => r.key === key) || { label: key, value: '' }, v = j.vals[key] || {}, ty = EDIT[key];
  const cur = key === 'dates' ? (j.dates || ['', '']) : key === 'eng' ? j.eng : key === 'travel' ? j.travel : row.value;
  const input = ty === 'range' ? `<label class="search"><span class="cap">เริ่ม</span><input type="date" id="ev1" value="${cur[0]}" aria-label="วันเริ่ม"></label><label class="search"><span class="cap">ถึง</span><input type="date" id="ev2" value="${cur[1]}" aria-label="วันสิ้นสุด"></label>`
    : ty === 'travel' ? `<div class="seg" role="radiogroup" aria-label="การเดินทาง">${['รถยนต์', 'เครื่องบิน', 'อื่น ๆ'].map(t => `<button role="radio" data-evt="${t}" aria-pressed="${cur === t}">${t}</button>`).join('')}</div><input type="hidden" id="ev1" value="${esc(cur)}">`
      : `<label class="search"><input id="ev1" autocomplete="off" value="${esc(cur)}" aria-label="${row.label}"></label>`;
  return frame(esc(row.label), `<div class="grp">${kvr('ค่า', esc(row.value))}${v.src ? `<div class="kv"><span>ที่มา</span>${srcTag(v)}</div>` : kvr('ที่มา', row.wait ? esc(row.wait) : 'ยังไม่มี')}${kvr('ตำแหน่งอ้างอิง', esc(v.loc))}${kvr('ดึงเมื่อ', v.at ? dFull(v.at) : '')}${kvr('ค่าเดิม', v.orig !== undefined ? esc(v.orig) : '')}${kvr('เหตุผลที่แก้', esc(v.reason))}</div>
 ${v.pending ? `<div class="pad2"><button class="btn" data-val-ok="${sc}:${key}">${ic('done')}ยืนยันค่านี้</button></div>` : ''}
 ${ty ? `<div class="pad2"><button class="btn alt" data-val-edit aria-expanded="false">${ic('draft')}แก้ไข</button></div>
 <div id="valEd" hidden class="pad2"><div class="sh">ค่าใหม่</div>${input}<div class="sh">เหตุผลที่แก้ (จำเป็น)</div><label class="search"><input id="evr" autocomplete="off" placeholder="เช่น FM-040 ระบุวันตามจริง" aria-label="เหตุผลที่แก้"></label>
 <p class="st w lg-err" id="evErr" role="alert" hidden>${ic('warn')}<span></span></p><button class="btn" data-val-save="${sc}:${key}">บันทึก</button></div>` : ''}`);
}
export function sheet(S, kind, id) {
  const h = frame;
  if (kind === 'impjob') {
    const cur = impTarget(S);
    return h('เลือกงาน', `<div class="grp" role="radiogroup" aria-label="งาน">${S.jobs.map(x => `<button class="row" role="radio" aria-checked="${cur === x}" data-impjob="${esc(x.id)}"><span class="rt"><span>${esc(F.fmtTitle(x.title))}</span><span class="sub">${x.dates ? dRange(x.dates) : ''}</span></span>${ic('ok', 'ck')}</button>`).join('')}</div>`);
  }
  if (kind === 'val') { const [sc, key] = id.split(/:(.+)/); return valSheet(S, sc, key); }
  if (kind === 'stages') {
    const j = S.job, p = F.phaseOf(j, ctxOf(S));
    return h('3 ขั้นของงาน PM', `<div class="grp">${F.PHASES.map(([, n, ds], i) => `<div class="row">${ring(i < p ? 1 : 0, i < p ? 'ผ่านแล้ว' : i === p ? 'ขั้นนี้' : 'ยังไม่ถึง')}<span class="rt"><span${i === p ? ' class="cur"' : ''}>${i + 1}. ${n}${i === p ? ' · ขั้นนี้' : ''}</span><span class="sub">${ds}</span>${st(i < p ? 'ok' : 'todo', i < p ? 'ผ่านแล้ว' : i === p ? 'กำลังทำ' : 'ยังไม่ถึง')}</span></div>`).join('')}</div>`);
  }
  if (kind === 'example') {
    const j = S.job, cur = exampleOf(S, j), mineA = S.docs.filter(d => isMine(S, d) && d.status === 'accepted'), ex = examples(S);
    const list = L => `<div class="grp" role="radiogroup" aria-label="ตัวอย่าง">${L.map(d => `<button class="row" role="radio" aria-checked="${cur && cur.id === d.id}" data-ex="${esc(d.id)}"><span class="rt"><span>${esc(F.fmtTitle(d.title))}</span><span class="sub">${esc([d.dates ? dRange(d.dates) : d.round && 'ครั้งที่ ' + d.round, d.pages != null && d.pages + ' หน้า'].filter(Boolean).join(' · '))}</span></span>${ic('ok', 'ck')}</button>`).join('')}</div>`;
    return h('เลือกตัวอย่างรายงาน', `${mineA.length ? `<div class="sh">ย้อนหลังของฉัน (ผู้ตรวจรับแล้ว)</div>${list(mineA)}` : ''}<div class="sh">ตัวอย่างรายงานของกอง</div>${list(ex)}`);
  }
  if (kind === 'file') {
    const j = S.job, f = j.files[+id], u = S.ph[f.id], img = u && /^image\//.test(f.type), [k] = FILE_ST[f.state] || FILE_ST.unsorted;
    return h('ไฟล์แนบ', `${img ? `<img class="ph-view" src="${u}" alt="">` : ''}<div class="p16"><b class="fn">${esc(f.name)}</b><div class="sec">${esc(f.type || '')} · ${(f.size / 1024).toFixed(0)} KB</div>${st(k, f.text)}</div>
 <div class="sh">จัดเข้าฟอร์ม</div><div class="grp" role="radiogroup" aria-label="จัดเข้าฟอร์ม">${j.forms.filter(x => x.code).map(x => `<button class="row" role="radio" aria-checked="${f.target === x.code}" data-assign="${+id}:${esc(x.code)}"><span class="rt"><span>${esc(x.code)} ${esc(x.name)}</span></span>${ic('ok', 'ck')}</button>`).join('')}</div>
 <div class="pad2">${u && !img ? `<a class="btn" href="${u}" target="_blank" rel="noopener">${ic('ext')}เปิดไฟล์</a>` : ''}<button class="btn alt" data-file-del="${+id}">${ic('trash')}ลบไฟล์</button></div>`);
  }
  if (kind === 'manual') {
    const j = S.job, f = j.forms.find(x => (x.code || 'review') === id), p = F.formProg(j, f), nf = (j.files || []).filter(x => x.target && x.target === f.code);
    const note = f.kind === 'tx' ? 'ยังไม่มีรายการเครื่องส่ง · แนบไฟล์ FM-CE.SE-202 (.xlsx) ที่การ์ดไฟล์แนบเพื่อเติมให้' : f.kind === 'asset' ? 'ยังไม่มีรายการทรัพย์สินให้ตรวจ' : f.kind === 'review' ? 'เทียบคู่มือ SD As-Built Diagram กับของจริงทุกครั้ง แล้วบันทึกข้อแตกต่างลง FM-006' : 'หน้ากรอกของฟอร์มนี้ยังไม่มีในรุ่นนี้ (PR ถัดไป) · ระหว่างนี้แนบไฟล์ฟอร์มที่กรอกแล้ว แล้วทำเครื่องหมายว่าทำแล้ว';
    return h(esc((f.code ? f.code + ' ' : '') + f.name), `<div class="p16"><div class="sec">${note}</div>${f.wi ? `<div class="cap mt3">ตาม ${esc(f.wi)}</div>` : ''}${f.warn ? `<span class="src w mt3">${ic('warn')}${esc(f.warn)}</span>` : ''}</div>
 ${nf.length ? `<div class="sh">ไฟล์แนบ</div><div class="grp">${nf.map(x => `<div class="row"><span class="rt"><span class="fn">${esc(x.name)}</span><span class="sub">${esc(x.text)}</span></span></div>`).join('')}</div>` : ''}
 ${f.kind === 'tx' || f.kind === 'asset' && (j.assetCheck || []).length ? '' : `<div class="pad2"><button class="btn${f.done ? ' alt' : ''}" data-form-done="${esc(id)}">${ic('done')}${f.done ? 'ยกเลิกเครื่องหมาย' : 'ทำเครื่องหมายว่าทำแล้ว (ชั่วคราว)'}</button></div>`}`);
  }
  if (kind === 'pw') {
    const f = (id, l) => `<label class="search"><input type="password" id="${id}" autocomplete="new-password" placeholder="${l}" aria-label="${l}"><button class="peek" type="button" data-peek aria-label="Show password" aria-pressed="false">${ic('eye')}</button></label>`;
    return h('เปลี่ยนรหัสผ่าน', `<p class="sec note">อย่างน้อย 8 ตัวอักษร</p>${f('pw1', 'รหัสผ่านใหม่')}${f('pw2', 'ยืนยันรหัสผ่านใหม่')}
 <div class="pad2"><p class="st w lg-err" id="pwErr" role="alert" hidden>${ic('warn')}<span></span></p><button class="btn" data-pw-save>บันทึก</button></div>`);
  }
  if (kind === 'uadd' || kind === 'ureset') {
    const f = (i, l, ex = '') => `<label class="search"><input id="${i}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${l}" aria-label="${l}" ${ex}></label>`;
    const u = kind === 'ureset' ? (S.users?.rows || []).find(x => x.id === id) : null;
    return h(u ? 'รีเซ็ตรหัส · ' + esc(u.username) : 'เพิ่มผู้ใช้', `<p class="sec note">${u ? 'ตั้งรหัสชั่วคราวใหม่ให้พนักงาน · รหัสเดิมใช้ไม่ได้ทันที' : 'บัญชีใหม่ใช้งานได้ทันที · พนักงานล็อกอินด้วยชื่อผู้ใช้ + รหัสชั่วคราว (ไม่มีสมัครเอง)'}</p>
 ${u ? '' : `${f('uName', 'ชื่อ-นามสกุล', 'enterkeyhint="next"')}${f('uUser', 'ชื่อผู้ใช้ เช่น somchai.k (a-z 0-9 . _ -)', 'inputmode="email" enterkeyhint="next"')}`}${f('uPw', 'รหัสผ่านชั่วคราว (อย่างน้อย 10 ตัว)', 'class="mono"')}
 <div class="pad2"><button class="btn alt" data-u-gen>${ic('sync')}สุ่มรหัส</button><p class="st w lg-err" id="uErr" role="alert" hidden>${ic('warn')}<span></span></p>
 <button class="btn" ${u ? `data-u-reset="${esc(id)}"` : 'data-u-add'}>${u ? 'ตั้งรหัสใหม่' : 'สร้างบัญชี'}</button></div>`);
  }
  if (kind === 'photo') {
    const j = S.job, [a, b] = id.split('.'), pid = a === 'tool' ? j.tools[+b].photo : j.tx[a - 1].photos[b], u = S.ph[pid];
    return h('รูป', `${u ? `<img class="ph-view" src="${u}" alt="">` : ''}<div class="pad2"><button class="btn alt" data-cam="${id}">${ic('cam')}ถ่ายใหม่</button><button class="btn alt" data-photo-del="${id}">${ic('trash')}ลบรูป</button></div>`);
  }
  if (kind === 'wi') return h('WI-CE.SE-002 Rev.06 · ภาคผนวก ข', wiText.replace('<div class="p16"><div class="cap">ขั้นตอน', '<div class="p16"><div class="cap">ภาคผนวก ข · ขั้นตอน'));
  if (kind === 'info') {
    const d = S.docs.find(x => x.id === id), o = isOff(S, id);
    return h('ข้อมูลรายงาน', `<div class="p16"><b>${esc(F.fmtTitle(d.title))}.pdf</b><div class="chips"><span>CE.SE</span>›<span>รายงาน PM</span>›<span>${esc(sysName(S, d.system))}</span>${d.year ? `›<span>${d.year}</span>` : ''}${d.round ? `›<span>${esc(d.round.replace('/', '-'))}</span>` : ''}</div></div>
 <div class="grp">${d.modified ? `<div class="kv"><span>แก้ไขล่าสุด</span><span>${dFull(d.modified)}${d.by ? ` โดย ${esc(d.by)}` : ''}</span></div>` : ''}${d.size ? `<div class="kv"><span>ขนาด</span><span>${(d.size / 1e6).toFixed(1)} MB</span></div>` : ''}<div class="kv"><span>เก็บไว้ดู offline (ตัวอย่าง)</span>${sw(o, `data-off="${esc(d.id)}" aria-label="เก็บไว้ดู offline"`)}</div></div>
 <div class="pad2">${openBtn(S, id, d)}</div>
 <div class="pad2"><details class="rel"><summary>${ic('doc')}เอกสารที่เกี่ยวข้อง</summary><div class="kv"><span>หนังสือคำสั่งปฏิบัติงาน PM</span><span>PDF</span></div><div class="kv"><span>WI-CE.SE-002 Rev.06</span><span>WI</span></div></details></div>`);
  }
  const t = viewItem(S, id), o = isOff(S, id), u = t.sourceUrl ? new URL(t.sourceUrl) : null, last = u && u.pathname.split('/').pop();
  let src = u ? u.host + u.pathname : 'ไม่มีลิงก์เว็บกอง'; if (u && u.pathname.length > 30) { try { src = u.host + '/…/' + decodeURIComponent(last); } catch { src = u.host + '/…/' + last; } }
  return h('ที่มาเอกสาร', `<div class="grp"><div class="kv"><span>ที่มา</span><span>${esc(src)}</span></div>${t.fetchedAt ? `<div class="kv"><span>ดึงโดย</span><span>collector ${dShort(t.fetchedAt)}</span></div>` : ''}
 <div class="kv"><span>เก็บไว้ดู offline (ตัวอย่าง)</span>${sw(o, `data-off="${esc(id)}" aria-label="เก็บไว้ดู offline"`)}</div></div><div class="pad2">${t.sourceUrl ? `${extLink(t.sourceUrl, 'เปิดบนเว็บกอง')}<p class="sec note c">${WEB_NOTE}</p>` : openBtn(S, id, t)}</div>`);
}
// CTA ลอยของหน้า: [act, icon, label, soft?, frac?] · soft = ยังไม่พร้อม (เทาอ่อนสุด + วงความคืบหน้า) แตะแล้วพาไปจุดที่ค้าง
export const jobCta = (S, j) => j.status === 'done' ? null : F.isReady(j, ctxOf(S)) ? ['report', 'doc', 'สร้างรายงาน'] : ['gap', 'doc', 'สร้างรายงาน', true, F.jobProg(j).frac];
export const openCta = S => { const n = openNeeds(S); return n.length ? ['opengap', 'plus', 'เปิดงาน PM', true, 1 - n.length / (S.draft.off ? 4 : 2)] : ['open', 'plus', 'เปิดงาน PM']; };
// หลังสร้าง/รีเซ็ต: โชว์รหัสชั่วคราวครั้งเดียว (อยู่ใน DOM ของ sheet เท่านั้น · ไม่เก็บใน state/localStorage · app.js ล้าง sheet ตอนปิด)
export const newPwSheet = (username, pw) => frame('บัญชีพร้อมใช้งาน', `<div class="grp"><div class="kv"><span>ชื่อผู้ใช้</span><span>${esc(username)}</span></div>
 <div class="p16"><div class="cap">รหัสผ่านชั่วคราว</div><div class="big mono" id="tmpPw">${esc(pw)}</div></div></div>
 <p class="sec note">โชว์ครั้งนี้ครั้งเดียว ปิดแล้วดูอีกไม่ได้ (ลืมให้รีเซ็ตใหม่) · ส่งให้พนักงานแล้วแนะนำให้เปลี่ยนรหัสที่ ฉัน › เปลี่ยนรหัสผ่าน</p>
 <div class="pad2"><button class="btn" data-u-copy>${ic('copy')}คัดลอก</button></div>`);
