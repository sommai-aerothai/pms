// หน้าจอทั้งหมด = ฟังก์ชันรับ state คืน HTML (template literal) · ไม่มี framework
import { yearsOf } from './backend/demo.js';
import * as store from './store.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (n, c = '') => `<svg class="ic ${c}"><use href="./ui/icons.svg#i-${n}"/></svg>`;
const MO = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const ymd = iso => iso.slice(0, 10).split('-').map(Number);
export const dShort = iso => { const [, m, d] = ymd(iso); return `${d} ${MO[m - 1]}`; };
export const dFull = iso => { const [y, m, d] = ymd(iso); return `${d} ${MO[m - 1]} ${y + 543}`; };
const dRange = ([a, b]) => { const [y, , d1] = ymd(a), [, m2, d2] = ymd(b); return `${d1}–${d2} ${MO[m2 - 1]} ${String(y + 543).slice(2)}`; };
const when = iso => { const days = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(iso.slice(0, 10))) / 864e5); return days <= 0 ? 'วันนี้' : days === 1 ? 'เมื่อวาน' : dShort(iso); };
const hhmm = iso => { const t = new Date(iso); return `${String((t.getUTCHours() + 7) % 24).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`; };

const ST = { ok: ['done', ''], todo: ['circle', ''], warn: ['warn', 'w'], dl: ['dl', ''], cloud: ['cloud', ''] };
const st = (k, text, c = '') => `<span class="st ${ST[k][1]} ${c}">${ic(ST[k][0])}${esc(text)}</span>`;
const DOC_ST = { draft: ['todo', 'ร่าง'], review: ['todo', 'รอตรวจ'], accepted: ['ok', 'ผู้ตรวจรับแล้ว'] };
const chev = ic('chev', 'ch');
const nav = (title, back, acts = '') => back == null
  ? `<div class="nav"><span></span><b class="nt">${esc(title)}</b><span></span></div>`
  : `<div class="nav"><a class="back" href="#" data-back>${ic('back')}<span>${esc(back)}</span></a><b class="nt">${esc(title)}</b><span class="acts">${acts}</span></div>`;
const ptr = `<div class="ptr">${ic('sync')}<span></span></div>`;
const sw = (on, attrs) => `<button class="sw" role="switch" aria-checked="${on}" ${attrs}><i></i><span>${on ? 'เปิด' : 'ปิด'}</span></button>`;
const swr = (row, id, on) => `<div class="swr">${row}<button class="swa" data-off-act="${esc(id)}">${ic(on ? 'trash' : 'dl')}${on ? 'ลบออก' : 'เก็บไว้ดู offline'}</button></div>`;
const camBtn = (key, photo, label) => `<button type="button" class="cam" data-cam="${key}" aria-label="${label}">${photo ? `<img src="${photo}" alt="">` : ic('cam')}</button>`;

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

// ---------- หน้าหลัก ----------
export function home(S) {
  const j = S.job, ex = expired(j), wi = store.isOffline('WI-CE.SE-02', true);
  const rows = [[1, 'ฟอร์ม Rev ล่าสุด · พร้อม'], [!ex.length, ex.length ? `เครื่องมือ calibration · ${ex[0].name} หมด ${dShort(ex[0].due)}` : 'เครื่องมือ calibration · ไม่หมดอายุ'],
    [wi, wi ? 'WI โหลด offline แล้ว' : 'WI ยังไม่ได้โหลด offline'], [j.letter, j.letter ? 'หนังสือคำสั่ง · ครบ' : 'หนังสือคำสั่ง · ยังไม่มี']]
    .map(([ok, t]) => `<div class="srow">${st(ok ? 'ok' : 'warn', t)}</div>`).join('');
  const rem = [...ex.map(t => `<a class="row" href="#/pm/tools">${ic('warn', 'lead w')}<span class="rt"><span>เครื่องมือต้อง calibrate</span><span class="sub">${esc(t.name)} หมดอายุ ${dFull(t.due)}</span></span>${chev}</a>`),
    ...S.templates.filter(t => t.isNew).map(t => `<a class="row" href="#/man">${ic('doc', 'lead')}<span class="rt"><span>${t.code} Rev.${t.rev} <span class="bdg">ใหม่</span></span><span class="sub">แก้ไขจาก Rev.${t.prev} · ${dShort(t.changed)}</span></span>${chev}</a>`)].join('');
  const recent = S.recent.map(([id, at]) => S.docs.find(d => d.id === id) && [S.docs.find(d => d.id === id), at]).filter(Boolean)
    .map(([d, at]) => `<a class="row" href="#/home/doc/${d.id}">${ic('doc', 'lead')}<span class="rt"><span>${esc(d.title)}</span><span class="sub">เปิด${/วัน|เมื่อ/.test(when(at)) ? '' : ' '}${when(at)} · ${d.pages} หน้า</span></span>${chev}</a>`).join('');
  return `${nav('หน้าหลัก')}<div class="in"><h1 class="lt">สวัสดี ${esc(S.user.name)}</h1>
 <div class="grp"><div class="p16"><div class="cap">งานถัดไป</div><div class="big">${esc(j.title.replace(/ (\d+\/\d+)$/, ' · ครั้งที่ $1'))}</div><div class="sec">${dRange(j.dates)}</div></div>${rows}
  <div class="p16"><a class="btn" href="#/pm">เริ่มงาน</a></div></div>
 ${rem ? `<div class="sh">เตือน</div><div class="grp">${rem}</div>` : ''}
 <div class="sh">ล่าสุด</div><div class="grp">${recent || '<div class="empty">ยังไม่เคยเปิดรายงาน</div>'}</div></div>`;
}

// ---------- เอกสาร ----------
const docRow = (S, d, base) => swr(`<a class="row" href="${base}/doc/${d.id}"><span class="rt"><span>${esc(d.title)}</span><span class="sub">${d.dates ? dRange(d.dates) + ' · ' : ''}${d.pages} หน้า · ผู้ปฏิบัติ ${d.crew} คน</span>${st(...DOC_ST[d.status])}</span>${chev}</a>`, d.id, isOff(S, d.id));
export const isOff = (S, id) => { const t = S.templates.find(x => x.code === id); return store.isOffline(id, t ? t.offline !== false : false); };
const roundsList = (S, list, base) => list.length ? list.map(d => docRow(S, d, base)).join('') : '<div class="empty">ไม่มีรายงานตัวอย่างในหมวดนี้</div>';
export function docs(S) {
  const u = S.ui, c = S.catalog, pane = u.p || 'p-sys', sel = u.sel || 'radio';
  const yr = {}; c.systems.forEach(s => yearsOf(s).forEach(y => yr[y.year] = (yr[y.year] || 0) + y.count));
  const row = (href, lead, t, v, x = '') => `<a class="row ${x}" href="${href}">${lead}<span class="rt">${esc(t)}</span><span class="rv">${v} รายงาน</span>${chev}</a>`;
  const list = S.docs.filter(d => d.system === sel);
  return `${nav('เอกสาร')}<div class="split"><div class="side">${ptr}<h1 class="lt">เอกสาร</h1>
 <label class="search">${ic('search')}<input type="search" data-filter placeholder="ค้นหารายงาน" aria-label="ค้นหารายงาน"></label>
 <div class="seg"><button data-pane="p-sys" aria-pressed="${pane === 'p-sys'}">ระบบ</button><button data-pane="p-yr" aria-pressed="${pane === 'p-yr'}">ปี</button><button data-pane="p-stn" aria-pressed="${pane === 'p-stn'}">สถานี</button></div>
 <div class="pane" id="p-sys" ${pane === 'p-sys' ? '' : 'hidden'}><div class="grp">${c.systems.map(s => row(`#/docs/${s.id}`, ic(s.icon, 'lead'), s.name, s.count, s.id === sel ? 'sel' : '').replace('<a ', `<a data-sel="${s.id}" `)).join('')}</div></div>
 <div class="pane" id="p-yr" ${pane === 'p-yr' ? '' : 'hidden'}><div class="grp">${Object.keys(yr).sort((a, b) => b - a).map(y => row(`#/docs/by/yr/${y}`, '', y, yr[y])).join('')}</div></div>
 <div class="pane" id="p-stn" ${pane === 'p-stn' ? '' : 'hidden'}><div class="grp">${c.stations.map(s => row(`#/docs/by/stn/${s.id}`, '', s.name, s.count)).join('')}</div></div></div>
 <div class="detail"><h1 class="lt">${esc(sysName(S, sel))}</h1><div class="grp">${roundsList(S, list, '#/docs')}</div></div></div>`;
}
export function years(S, sys, back) {
  const s = S.catalog.systems.find(x => x.id === sys) || {}, y = yearsOf(s);
  return `${nav(s.name, back, `<button data-toast="เรียงตามปีล่าสุดก่อน">${ic('sort')}เรียง</button>`)}<div class="in"><h1 class="lt">${esc(s.name)}</h1>
 <div class="grp">${y.map(x => `<a class="row" href="#/docs/${sys}/${x.year}"><span class="rt">${x.year}</span><span class="rv">${x.count} รายงาน</span>${chev}</a>`).join('')}</div></div>`;
}
export function rounds(S, arg, back) {
  const [sys, y, by, val] = arg;
  const list = S.docs.filter(d => by ? (by === 'yr' ? d.year === +val : d.station === val || (val === 'dm' && d.station === 'dmrx')) : d.system === sys && d.year === +y);
  const t = by === 'stn' ? (S.catalog.stations.find(s => s.id === val) || {}).name : String(by ? val : y);
  return `${nav(t, back)}<div class="in"><h1 class="lt">${esc(t)}</h1><div class="grp">${roundsList(S, list, location.hash.split('/doc/')[0] || '#/docs')}</div></div>`;
}

// ---------- ตัวดูรายงาน ----------
export function view(S, id, back) {
  const d = S.docs.find(x => x.id === id), t = S.templates.find(x => x.code === id);
  const title = d ? d.title : `${t.code} Rev.${t.rev}`, pg = d ? d.pages : t.pages, code = d ? 'FM-CE.SE-006' : t.code;
  const pages = Array.from({ length: Math.min(pg, 40) }, (_, i) => `<div class="page"><div class="hd"><i></i><span>${code}${i ? ` · แผ่นที่ ${i + 1}` : ''}</span></div><div class="ln"></div>${i ? '' : '<div class="ln s"></div>'}</div>`).join('');
  return `${nav(title, back, `<button data-sheet="${d ? 'info' : 'src'}:${esc(id)}" aria-label="ข้อมูลรายงาน">${ic('info')}</button><button data-share aria-label="แชร์">${ic('share')}</button>`)}
 <div class="pages" data-pg="${pg}">${pages}<div class="pgbar">หน้า <span id="pn">1</span>/${pg}</div></div>`;
}

// ---------- งาน PM ----------
export function pm(S) {
  const j = S.job, n = j.forms.length, k = formsDone(j), ready = k === n;
  const rows = j.forms.map(f => {
    const [, kind, text] = formState(j, f), body = `<span class="rt"><span>${f.code ? f.code + ' ' : ''}${esc(f.name)}</span>${st(kind, text)}</span>${f.go === 'cam' ? ic('cam', 'ch') : ''}${chev}`;
    const href = f.kind === 'tx' ? '#/pm/fill' : f.kind === 'asset' ? '#/pm/asset' : f.go === 'tools' ? '#/pm/tools' : '';
    return href ? `<a class="row" href="${href}">${body}</a>` : `<button class="row" data-toast="ฟอร์มนี้ทำในขั้น 2">${body}</button>`;
  }).join('');
  return `${nav('งาน PM')}<div class="in"><h1 class="lt">งาน PM</h1>
 <div class="grp"><div class="p16"><div class="cap">งานปัจจุบัน</div><div class="big">${esc(j.title)}</div><div class="bar2"><i style="width:${100 * k / n}%"></i></div><div class="sec">ฟอร์ม ${k}/${n} เสร็จ</div>
  ${ready ? '<button class="btn mt3" data-toast="ออกรายงานทำในขั้น 2">ออกรายงาน</button>' : `<button class="btn alt mt3" data-sheet="ready">${ic('clip')}ตรวจความพร้อม · ${k}/${n}</button>`}</div></div>
 <div class="sh">ฟอร์มของงานนี้</div><div class="grp">${rows}</div>
 <div class="grp"><a class="row" href="#/pm/folder">${ic('folder', 'lead')}<span class="rt"><span>ฟอร์มอื่น ๆ และรูปประกอบ</span><span class="sub">โฟลเดอร์ของงานนี้ · รูปสถานี รูปการทำงาน เอกสารเพิ่มเติม</span></span>${chev}</a></div></div>`;
}
const fld = (f, t, n) => {
  const v = t.v[f.k] ?? '', b = bad(f, v);
  return `<label class="fld${b ? ' bad' : ''}" data-lbl="${esc(f.n)}" data-min="${f.min}" data-max="${f.max}"><span class="rt"><span class="t">${esc(f.t)}</span><span class="sub">${esc(f.std)}</span><span class="wn">${ic('warn')}เกินช่วง</span></span>
  <input inputmode="decimal" enterkeyhint="next" value="${esc(v)}" data-n="${n}" data-k="${f.k}" aria-label="${esc(f.n)}"><span class="u">${f.u}</span>${f.cam ? camBtn(`${n}.${f.k}`, t.photos[f.k], 'ถ่ายรูป ' + f.t) : ''}</label>`;
};
const idFld = (t, n, k, title, sub) => `<label class="fld" data-lbl="${title}"><span class="rt"><span class="t">${title}</span><span class="sub">${sub}</span></span><input class="wide" enterkeyhint="next" autocapitalize="off" autocomplete="off" value="${esc(t.v[k] ?? '')}" data-n="${n}" data-k="${k}" aria-label="${title}">${camBtn(`${n}.${k}`, t.photos[k], 'ถ่ายรูป ' + title)}</label>`;
export function fill(S, _, back) {
  const j = S.job, m = j.cur, t = j.tx[m - 1], k = txDoneCount(j);
  const chips = j.tx.map(x => { const d = txDone(j, x), c = x.n === m; return `<button class="chip ${c ? 'cur' : d ? 'dn' : ''}" data-m="${x.n}" aria-label="Tx ${x.n}, ${x.freq} MHz, ${c ? 'ปัจจุบัน' : d ? 'เสร็จแล้ว' : 'ยังไม่ทำ'}"><b>${d ? ic('done') : ''}Tx ${x.n}</b><small>${x.freq.toFixed(x.freq % 1 ? 2 : 1).replace(/(\.\d)0$/, '$1')} MHz</small></button>`; }).join('');
  return `${nav(`เครื่องส่ง ${m}/${j.tx.length}`, back)}<div class="in"><div class="strip-w"><div class="strip" id="strip">${chips}</div>
 <div class="prg"><span class="cap">${m} จาก ${j.tx.length} · เสร็จ ${k}</span><div class="bar3"><i style="width:${100 * k / j.tx.length}%"></i></div></div></div>
 <div class="sh">ข้อมูลเครื่อง · อ่านจากสติกเกอร์</div><div class="grp">${idFld(t, m, 'asset', 'Asset No', 'จากสติกเกอร์ทรัพย์สิน')}${idFld(t, m, 'serial', 'Serial', 'จากแผ่นป้ายเครื่อง')}</div>
 <div class="sh">ค่าที่วัด</div><div class="grp">${j.fields.map(f => fld(f, t, m)).join('')}</div></div>`;
}
export function table(S, _, back) {
  const j = S.job, m = j.cur, k = txDoneCount(j), cols = j.fields;
  const body = j.tx.map(t => `<tr><td>${t.n}</td>${cols.map(f => `<td${bad(f, t.v[f.k] ?? '') ? ' class="bad"' : ''}><input inputmode="decimal" enterkeyhint="next" value="${esc(t.v[f.k] ?? '')}" data-n="${t.n}" data-k="${f.k}" aria-label="Tx ${t.n} ${esc(f.n)}"></td>`).join('')}</tr>`).join('');
  return `${nav(`FM-CE.SE-202 · เครื่องส่ง ${j.tx.length} เครื่อง`, back)}<div class="tb2"><div class="tl"><div class="prg" style="padding-top:8px"><span class="cap">${m} จาก ${j.tx.length} · เสร็จ ${k}</span><div class="bar3"><i style="width:${100 * k / j.tx.length}%"></i></div></div>
 <table><thead><tr><th>Tx</th>${cols.map(f => `<th>${esc(f.n).replace(' (', '<br>(')}</th>`).join('')}</tr></thead><tbody id="tbd">${body}</tbody></table><p class="sec">Apple Pencil เขียนลงช่องได้เลย (Scribble)</p></div>
 <div class="wi"><div class="grp">${idFld(j.tx[m - 1], m, 'asset', `Asset No · Tx ${m}`, 'จากสติกเกอร์ทรัพย์สิน').replace('<input ', '<input id="wiAsset" ')}</div>
 <div class="seg"><button data-pane="w-wi" aria-pressed="true">WI</button><button data-pane="w-pr" aria-pressed="false">รอบก่อน</button><button data-pane="w-pdf" aria-pressed="false">ฟอร์ม PDF</button></div>
 <div class="pane" id="w-wi"><div class="p16"><b>WI-CE.SE-02 Rev.06 · หน้า 50 · ภาคผนวก ข</b><div class="sec" id="wf">ช่องที่เลือก: ${esc(cols[2].n)} · Tx ${m}</div></div><div class="page w70"><div class="hd"><i></i><span>WI-CE.SE-02 · หน้า 50</span></div><div class="ln"></div></div>${wiText}</div>
 <div class="pane" id="w-pr" hidden><div class="p16"><a class="btn alt" href="#/pm/doc/radio-dm-2569-2-69">${ic('doc')}เปิดรายงานรอบก่อน (PM DM TxS 2/69)</a></div></div>
 <div class="pane" id="w-pdf" hidden><div class="page"><div class="hd"><i></i><span>FM-CE.SE-202 Rev.04</span></div><div class="ln"></div></div></div></div></div>`;
}
const wiText = `<div class="grp"><div class="p16"><div class="cap">ขั้นตอน</div>ต่อ CMA180 เข้า Ant port ผ่าน Attn 30 dB ตั้ง… (ข้อความตัวอย่าง)</div></div>`;
export function asset(S, _, back) {
  const j = S.job;
  const rows = j.assetCheck.map(n => { const t = j.tx[n - 1], a = assetState(t), p = t.photos.asset;
    return `<div class="row"><span class="thumb ${p ? '' : 'no'}">${p ? `<img src="${p}" alt="">` : ic('cam')}</span><span class="rt"><span>Tx ${n} · ${t.model}</span><span class="sub">ทะเบียน ${t.reg}</span>${st(...a)}</span>${camBtn(`${n}.asset`, '', 'ถ่ายรูปสติกเกอร์ Tx ' + n)}</div>`; }).join('');
  return `${nav('ตรวจเลขทรัพย์สิน', back)}<div class="in"><h1 class="lt">ตรวจเลขทรัพย์สิน</h1><p class="sec note">ถ่ายสติกเกอร์ทรัพย์สิน แล้วพิมพ์เลขในหน้ากรอกค่า แอปเทียบกับทะเบียนให้</p><div class="grp">${rows}</div></div>`;
}
export function tools(S, _, back) {
  const rows = S.job.tools.map((t, i) => { const ex = Date.parse(t.due) < Date.now();
    return `<div class="row"><span class="rt"><span>${esc(t.name)}</span><span class="sub">Asset ${t.asset} · Due ${dFull(t.due)}</span>${ex ? st('warn', 'หมดอายุ') : st('ok', 'ยังไม่หมดอายุ')}</span>${camBtn('tool.' + i, t.photo, 'ถ่ายสติกเกอร์ calibration ' + esc(t.name))}</div>`; }).join('');
  return `${nav('เครื่องมือวัด', back)}<div class="in"><h1 class="lt">เครื่องมือวัด</h1><p class="sec note">ถ่ายสติกเกอร์ calibration เก็บเป็นหลักฐานของงานนี้</p><div class="grp">${rows}</div></div>`;
}
export function folder(S, _, back) {
  const f = S.job.folder;
  const tiles = f.photos.map((p, i) => `<button class="tile" data-toast="${esc(p.name || 'รูป ' + (i + 1))}" aria-label="${esc(p.name || 'รูป ' + (i + 1))}">${p.url ? `<img src="${p.url}" alt="">` : ic('img')}${p.name ? `<span>${esc(p.name)}</span>` : ''}</button>`).join('');
  return `${nav('โฟลเดอร์งาน', back)}<div class="in"><h1 class="lt">โฟลเดอร์งาน ${esc(S.job.title)}</h1><div class="sh">รูปประกอบ (${f.photos.length})</div><div class="ph">${tiles}</div>
 <div class="sh">เอกสารเพิ่ม</div><div class="grp">${f.docs.map(d => `<button class="row" data-toast="ดูเอกสารเพิ่มทำในขั้น 2">${ic('doc', 'lead')}<span class="rt"><span>${esc(d.name)}</span>${st('todo', 'ร่าง')}</span>${chev}</button>`).join('')}</div>
 <div class="pad2"><button class="btn" data-cam="folder">${ic('cam')}ถ่ายรูป / เพิ่มไฟล์</button><button class="btn alt" data-toast="แนบท้ายรายงานทำในขั้น 2">${ic('clip')}แนบท้ายรายงาน</button></div>
 <p class="sec note c">เก็บในเครื่องก่อน · ขั้นต่อไปส่งขึ้นโฟลเดอร์งานบน SharePoint</p></div>`;
}

// ---------- คู่มือ / ฉัน ----------
export function man(S) {
  const pane = S.ui.m || 'm-fm', T = S.templates, on = t => store.isOffline(t.code, t.offline !== false);
  const mb = (T.filter(on).reduce((a, t) => a + t.size, 0) / 1e6).toFixed(0), auto = store.pref('auto') !== false;
  const list = kind => T.filter(t => t.kind === kind).map(t => { const o = on(t);
    return swr(`<a class="row" href="#/man/doc/${t.code}"><span class="rt"><span>${t.code} Rev.${t.rev} ${t.isNew ? '<span class="bdg">ใหม่</span>' : ''}</span><span class="sub">${t.isNew ? `Rev.${t.prev} → ${t.rev} · ${dShort(t.changed)}` : esc(t.name)}</span>${o ? st('dl', 'โหลดแล้ว') : st('cloud', 'ยังไม่โหลด')}</span>${chev}</a>`, t.code, o); }).join('');
  return `${nav('คู่มือ')}<div class="in">${ptr}<h1 class="lt">คู่มือ</h1>
 <label class="search">${ic('search')}<input type="search" data-filter placeholder="ค้นหาฟอร์ม / WI (รหัสหรือชื่อ)" aria-label="ค้นหาฟอร์ม / WI"></label>
 <div class="grp"><div class="kv"><span>จากเว็บกอง ${dShort(T[0].fetchedAt)} ${hhmm(T[0].fetchedAt)}</span>${st('ok', 'เป็นปัจจุบัน')}</div><div class="kv"><span>โหลด offline อัตโนมัติ · ${mb} MB</span>${sw(auto, 'data-pref="auto" aria-label="โหลดเก็บ offline อัตโนมัติ"')}</div></div>
 <div class="seg"><button data-pane="m-fm" aria-pressed="${pane === 'm-fm'}">ฟอร์ม</button><button data-pane="m-wi" aria-pressed="${pane === 'm-wi'}">WI</button></div>
 <div class="pane" id="m-fm" ${pane === 'm-fm' ? '' : 'hidden'}><div class="grp">${list('form')}</div></div><div class="pane" id="m-wi" ${pane === 'm-wi' ? '' : 'hidden'}><div class="grp">${list('wi')}</div></div></div>`;
}
export function me(S) {
  const r = (i, t, s) => `<button class="row" data-toast="โหมดตัวอย่าง · ยังไม่เปิดใช้">${ic(i, 'lead')}<span class="rt"><span>${t}</span><span class="sub">${s}</span></span>${chev}</button>`;
  return `${nav('ฉัน')}<div class="in"><div class="hero"><div class="avatar">${esc([...S.user.name][0])}</div><div class="big">${esc(S.user.name)}</div><div class="sec">CE.SE · AEROTHAI</div></div>
 <div class="grp">${r('sig', 'ลายเซ็นของฉัน', 'ใช้ตอนออกรายงาน')}${r('dl', 'พื้นที่ offline', `รายการเก็บ offline ${store.offlineCount()} · ฟอร์ม/WI`)}${r('ok', 'บัญชี SharePoint', 'โหมดตัวอย่าง · ยังไม่เชื่อมต่อ')}${r('info', 'เกี่ยวกับ / เวอร์ชัน', `${S.version} (demo)`)}</div>
 <div class="grp k"><button class="row red" data-signout>${ic('out')}ออกจากระบบ</button></div></div>`;
}

// ---------- sheet ----------
export function sheet(S, kind, id) {
  const h = (t, body) => `<i class="grab"></i><div class="sh-h"><span>${t}</span><button data-close>เสร็จ</button></div>${body}`;
  if (kind === 'ready') {
    const j = S.job, miss = j.forms.length - formsDone(j);
    return h('ความพร้อมก่อนออกรายงาน', `<p class="sec note">${miss ? `ยังขาด ${miss} ฟอร์ม` : 'ครบทุกฟอร์มแล้ว'}</p><div class="grp">${j.forms.map(f => { const [, k, t] = formState(j, f); return `<div class="row"><span class="rt"><span>${f.code ? f.code + ' ' : ''}${esc(f.name)}</span>${st(k, t)}</span></div>`; }).join('')}</div>`);
  }
  if (kind === 'wi') return h('WI-CE.SE-02 Rev.06 · หน้า 50', wiText.replace('<div class="p16"><div class="cap">ขั้นตอน', '<div class="p16"><div class="cap">ภาคผนวก ข · ขั้นตอน'));
  if (kind === 'info') {
    const d = S.docs.find(x => x.id === id), o = isOff(S, id), s = S.catalog.systems.find(x => x.id === d.system);
    return h('ข้อมูลรายงาน', `<div class="p16"><b>${esc(d.title)}.pdf</b><div class="chips"><span>CE.SE</span>›<span>รายงาน PM</span>›<span>${esc(s.name)}</span>›<span>${d.year}</span>›<span>${d.round.replace('/', '-')}</span></div></div>
 <div class="grp"><div class="kv"><span>แก้ไขล่าสุด</span><span>${dFull(d.modified)} โดย ${esc(d.by)}</span></div><div class="kv"><span>ขนาด</span><span>${(d.size / 1e6).toFixed(1)} MB</span></div><div class="kv"><span>เก็บไว้ดู offline</span>${sw(o, `data-off="${d.id}" aria-label="เก็บไว้ดู offline"`)}</div></div>
 <div class="pad2"><button class="btn" data-toast="โหมดตัวอย่าง · ยังไม่เชื่อม SharePoint">${ic('ext')}เปิดใน SharePoint</button></div>
 <div class="pad2"><details class="rel"><summary>${ic('doc')}เอกสารที่เกี่ยวข้อง</summary><div class="kv"><span>หนังสือคำสั่งปฏิบัติงาน PM</span><span>PDF</span></div><div class="kv"><span>WI-CE.SE-02 Rev.06 (หน้า 50–54)</span><span>WI</span></div></details></div>`);
  }
  const t = S.templates.find(x => x.code === id), o = isOff(S, id);
  return h('ที่มาเอกสาร', `<div class="grp"><div class="kv"><span>ที่มา</span><span>${t.sourceUrl.replace('https://', '')}</span></div><div class="kv"><span>ดึงโดย</span><span>collector ${dShort(t.fetchedAt)}</span></div>
 <div class="kv"><span>เก็บไว้ดู offline</span>${sw(o, `data-off="${id}" aria-label="เก็บไว้ดู offline"`)}</div></div><div class="pad2"><button class="btn" data-toast="โหมดตัวอย่าง · ยังไม่เปิดเว็บกอง">${ic('ext')}เปิดบนเว็บกอง</button></div>`);
}
