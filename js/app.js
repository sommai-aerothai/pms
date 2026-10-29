// PMS · router (hash) + shell + เหตุการณ์ · หน้าจอจริงอยู่ใน views.js · ตรรกะ flow อยู่ใน flow.js · อ่านไฟล์อยู่ใน files.js · ท่าทางอยู่ใน gestures.js
import * as store from './store.js';
import * as V from './views.js';
import * as F from './flow.js';
import * as files from './files.js';
import { SCHEDULE } from './data/schedule-2569.js';
import { initGestures } from './gestures.js';
import * as photos from './photos.js';
import { tok } from './tok.js';
import * as M from './motion.js';
import { CONFIG } from './config.js';
import * as imp from './import-sarabun.js';
import { renderPdf, sweep } from './pdfview.js';

const VERSION = 'v0.9.0';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), TABS = ['today', 'pm', 'docs', 'me'];
const TITLES = { today: 'วันนี้', pm: 'งาน PM', docs: 'เอกสาร', me: 'ฉัน' };
const S = { ph: {}, rev: 0, ui: {}, wait: new Set(), seen: new Set(), version: VERSION, user: null, docs: [], templates: [], catalog: null, cats: [], files: [], jobs: [], job: null, err: {}, urls: {}, sched: SCHEDULE, today: '', prev: {}, draft: null };
const pad = matchMedia(`(min-width:${tok('bp-pad')}px)`);
let chain = [], tab = 'today', lastTab = null, lastHash = {}, saveT, toastT, tapFn = null, reveal = false;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const nowIso = () => S.today + new Date().toISOString().slice(10);   // วันตาม store.today() (demo = วันสมมติ) + เวลาจริง
const ctx = () => ({ templates: S.templates, docs: S.docs, today: S.today });

// ---------- โหลดข้อมูล ----------
// แต่ละชุดโหลดแยกกัน (allSettled): ชุดไหนล้ม = เก็บ error ไว้ที่ S.err[ชื่อ] ให้หน้านั้นแสดงการ์ด "ลองใหม่" · ชุดอื่นยังวาด/แตะได้ตามปกติ
const SETS = { docs: store.listReports, templates: store.listTemplates, catalog: store.getCatalog, cats: store.getFiles, jobs: store.listJobs };
const EMPTY = { docs: [], templates: [], catalog: { schema: 1, systems: [] }, cats: [], jobs: [] };
async function load(keys = Object.keys(SETS)) {
  keys = keys.filter(k => SETS[k]);
  if (saveT) save();   // บันทึกค่าค้างก่อน ไม่งั้นโหลดทับของเก่า
  const cur = S.job && S.job.id, res = await Promise.allSettled(keys.map(k => SETS[k]()));
  res.forEach((r, i) => { const k = keys[i]; if (r.status === 'fulfilled') { S[k] = r.value; delete S.err[k]; } else { S.err[k] = r.reason || {}; if (!S[k]) S[k] = EMPTY[k]; } });
  S.files = S.cats.flatMap(c => c.rows); S.job = S.jobs.find(j => j.id === cur) || V.recent(S) || S.jobs[0]; S.today = store.today();
  const dead = res.find(r => r.status === 'rejected' && r.reason && r.reason.code === 'auth'); if (dead) throw dead.reason;   // session หมดอายุ/ถูกปฏิเสธ = ล็อกอินใหม่
  await loadPhotos();
}
const photoIds = () => S.jobs.flatMap(j => [...(j.tx || []).flatMap(t => Object.values(t.photos)), ...j.tools.map(t => t.photo), ...(j.files || []).map(f => f.id)]).filter(Boolean);
async function loadPhotos() {
  for (const id of photoIds()) if (!S.ph[id]) { try { const b = await photos.get(id); if (b) S.ph[id] = URL.createObjectURL(b); } catch { /* IndexedDB ใช้ไม่ได้ → ไม่มี thumbnail */ } }
}
const errWord = e => ({ auth: 'ต้องเข้าสู่ระบบใหม่', server: 'เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง', conflict: 'มีคนแก้งานนี้ก่อน โหลดใหม่แล้วลองอีกครั้ง', offline: 'ออฟไลน์อยู่', invalid: 'ข้อมูลไม่ถูกต้อง', notfound: 'ไม่พบข้อมูล', throttled: 'ระบบยุ่ง ลองใหม่อีกครั้ง' }[e.code] || 'เกิดข้อผิดพลาด');
async function refresh(keys) {
  try { await load(keys); S.rev++; draw(); const n = Object.keys(S.err).length; toast(n ? 'โหลดได้บางส่วน · ดูการ์ดในหน้า' : 'รีเฟรชแล้ว', n ? 'warn' : 'ok'); }
  catch (e) { if (e.code === 'auth') { store.pref('user', null); app.classList.add('login'); } toast(errWord(e), 'warn'); }
}
// ตัวดูไฟล์: ขอ signed URL (bucket ตามชนิดข้อมูล) แล้วใส่ลง iframe/ลิงก์ของหน้าที่วาดแล้ว · เก็บไว้ใน S.urls ~9 นาที (URL อายุ 10 นาที)
async function signView(el, id) {
  const it = V.viewItem(S, id), u = S.urls[id]; if (!it || !it.storagePath) return;
  if (u && (u.err || u.wait || u.exp > Date.now())) return;   // ล้มแล้ว = รอผู้ใช้กด "ลองใหม่" (ไม่วนขอซ้ำเอง) · กำลังขอ = ไม่ขอซ้ำ
  S.urls[id] = { wait: true, exp: 0 };
  try { const url = await store.fileUrl(it); if (!url) throw { code: 'notfound' }; S.urls[id] = { url, exp: Date.now() + 54e4 }; }
  catch (e) { S.urls[id] = { err: e && e.code ? e : { code: 'server', detail: String((e && e.message) || e) }, exp: 0 }; }
  el.dataset.k = '';   // วาดใหม่ครั้งหน้าที่เปิดหน้านี้ (ออกไปแล้วกลับมา ต้องไม่ค้าง "กำลังเปิดไฟล์…")
  const c = chain[chain.length - 1]; if ($('#' + c.id) === el) paint(c, chain.length - 1);   // ยังอยู่หน้าเดิม = วาดใหม่ทันที
}

// ---------- router: hash → {tab, stack} ----------
const parts = () => decodeURIComponent(location.hash).replace(/^#\/?/, '').split('/').filter(Boolean);
// แบบร่างเปิดงาน (ยังไม่บันทึก): สร้างใหม่เมื่อเปลี่ยนแถวตาราง · ค่าตั้งต้นจากรอบก่อนของสถานี
function ensureDraft(id) {
  if (S.draft && S.draft.id === id) return;
  const row = id === 'off' ? null : S.sched.find(r => r.id === id); if (id !== 'off' && !row) { S.draft = null; return; }
  const off = row ? null : { name: '', round: F.fiscal(S.today).round, start: S.today, days: 1, reason: '' }, key = row ? row.job : 'off', prev = store.prevRound(key, row ? row.site : '');
  S.prev = prev;
  S.draft = { id, row, off, other: false, useImp: false, job: F.newPmJob({ id: row ? row.id : 'off-' + Date.now().toString(36), row, off: off && { ...off, name: 'งานนอกตาราง' }, system: row ? F.sysFor(row.job, S.catalog.systems) : '', eng: '', travel: prev.travel, draft: false, prev, now: nowIso(), me: S.user.name }) };
}
function resolve() {
  let p = parts();
  if (p[0] === 'import') return { tab: 'me', chain: [{ id: 's-me', title: TITLES.me }, { id: 's-import', title: 'นำเข้าจากสารบรรณ' }] };   // ปลายทางของบุ๊กมาร์กเล็ต สารบรรณ
  if (!TABS.includes(p[0])) p = ['today'];
  const t = p[0]; let rest = p.slice(1), doc = null;
  const di = rest.indexOf('doc'); if (di > -1) { doc = rest[di + 1]; rest = rest.slice(0, di); }
  const st = [], sysName = id => (S.catalog.systems.find(s => s.id === id) || {}).name || id;
  if (t === 'docs' && rest[0] === 'reports') {   // เอกสาร › ตัวอย่างรายงานของกอง › ระบบ/ปี › รอบ
    const r = rest.slice(1); st.push({ id: 's-reports', title: 'ตัวอย่างรายงานของกอง' });
    if (r[0] === 'by' && r.length > 2) st.push({ id: 's-rounds', arg: [0, 0, r[1], r[2]], title: r[2] });
    else if (r[0]) { st.push({ id: 's-years', arg: r[0], title: sysName(r[0]) }); if (r[1]) st.push({ id: 's-rounds', arg: [r[0], r[1]], title: r[1] }); }
  } else if (t === 'docs') {
    const c = rest[0] === 'k' && S.cats.find(x => x.id === rest[1]); if (c) st.push({ id: 's-kind', arg: c.id, title: c.name });
  } else if (t === 'me') {
    if (rest[0] === 'sarabun') st.push({ id: 's-sarabun', title: 'เชื่อมสารบรรณ' });
    else if (rest[0] === 'users' && S.user && S.user.is_admin) st.push({ id: 's-users', title: 'ผู้ใช้' });   // เฉพาะแอดมิน (เซิร์ฟเวอร์ตรวจซ้ำ)
  } else if (t === 'pm') {
    if (rest[0] === 'pick' || rest[0] === 'new') {   // #/pm/pick[/<แถว>] = เลือกจากตาราง › เปิดงาน · #/pm/new/<แถว> = เปิดงานตรง
      if (rest[0] === 'pick') st.push({ id: 's-pick', title: 'เลือกงาน' });
      if (rest[1]) { ensureDraft(rest[1]); if (S.draft) st.push({ id: 's-open', arg: rest[1], title: 'เปิดงาน PM' }); }
    } else {
      const j = S.jobs.find(x => x.id === rest[0]);
      if (j) {
        if (saveT && S.job !== j) save();   // ยังมีค่าค้างบันทึกของงานก่อนหน้า → บันทึกก่อนสลับ
        S.job = j; st.push({ id: 's-job', arg: j.id, title: F.fmtTitle(j.title) });
        const tx = store.pref('fmode') === 'form' ? 's-form' : pad.matches ? 's-table' : 's-fill';   // โหมดกรอกที่เลือกล่าสุด (ช่องกรอก | บนฟอร์ม)
        const m = { fill: [tx, 'เครื่องส่ง'], table: [tx, 'เครื่องส่ง'], form: ['s-form', 'เครื่องส่ง'], asset: ['s-asset', 'ทะเบียนอุปกรณ์'], tools: ['s-tools', 'เครื่องมือวัด'] }[rest[1]];
        if (m && (!/^s-(table|fill|form)$/.test(m[0]) || j.tx)) st.push({ id: m[0], arg: j.id, title: m[1] });
      }
    }
  }
  if (!st.some(c => c.id === 's-users')) S.users = null;   // ออกจากหน้าผู้ใช้ = ล้าง (เข้าใหม่โหลดใหม่)
  const found = doc && (S.docs.find(d => d.id === doc) || S.files.find(d => d.id === doc) || S.templates.find(x => x.code === doc));
  if (found) st.push({ id: 's-view', arg: doc, title: F.fmtTitle(found.title) || found.code });
  return { tab: t, chain: [{ id: 's-' + t, title: TITLES[t] }, ...st] };
}
function paint(c, i) {
  const el = $('#' + c.id), a = c.id + JSON.stringify(c.arg), key = a + S.rev + pad.matches;
  if (el.dataset.k === key) return;
  const y = el.dataset.a === a ? el.scrollTop : 0, fresh = !el.classList.contains('on'), sp = $('#strip', el), x = sp ? sp.scrollLeft : 0;
  el.innerHTML = V[c.id.slice(2)](S, c.arg, i ? chain[i - 1].title : null);
  el.dataset.k = key; el.dataset.a = a; el.scrollTop = y; el.classList.toggle('sc', y > tok('collapse-y'));
  if (c.id === 's-fill') stripScroll(fresh, x);
  if (c.id === 's-sarabun') bmFill(el);
  if (c.id === 's-users' && !S.users) { S.users = { st: 'load' }; fetchUsers(); }
  if (c.id === 's-view') signView(el, c.arg);
  if (c.id === 's-form') { const it = V.form202(S); if (it) signView(el, it.id); }
  mountPdf(el, c.id === 's-form');
}
// วาด PDF ลงที่ [data-pdf] ของหน้าที่เพิ่งวาด · หน้า "บนฟอร์ม" = วางช่องกรอกทับ และวาดหน้าซ้ำตามจำนวนเครื่อง (หน้าละ 20)
function mountPdf(el, form) {
  sweep(); const h = $('[data-pdf]', el); if (!h) return;
  renderPdf(h, h.dataset.pdf, form ? { over: (i, c) => i ? '' : V.formOver(S, c), copies: Math.max(1, Math.ceil(S.job.tx.length / 20)) } : {})
    .catch(() => { if (h.isConnected) h.innerHTML = `<div class="grp"><div class="p16 errc">${V.ic('warn')}เปิด PDF ในหน้านี้ไม่สำเร็จ · ${form ? 'ใช้ "ช่องกรอก" ด้านบนแทน (ค่าชุดเดียวกัน)' : 'ใช้ปุ่มเปิดในแท็บใหม่'}</div></div>`; });
}
function draw() {
  const r = resolve(), changed = r.tab !== lastTab, from = lastTab; tab = r.tab; chain = r.chain;
  // รายการเอกสาร/รายงาน: โหลดครั้งแรกแสดงโครง skeleton ก่อน (demo จำลองรอ --skel-ms)
  const wk = { 's-docs': 'docs', 's-reports': 'reports' }[chain[chain.length - 1].id];
  if (wk && !S.seen.has(wk)) { S.seen.add(wk); S.wait.add(wk); setTimeout(() => { S.wait.delete(wk); S.rev++; draw(); }, tok('skel-ms')); }
  chain.forEach(paint);
  const ids = chain.slice(1).map(c => c.id), n = ids.length;
  if (changed) app.classList.add('nq');
  $$('.screen').forEach(s => { const k = ids.indexOf(s.id), root = s.classList.contains('root'), on = root ? s.id === 's-' + tab : k > -1;
    s.classList.toggle('on', on); s.classList.toggle('under', on && n > 0 && (root || k < n - 1)); if (k > -1) s.style.zIndex = 2 * (k + 1); });
  $('#dim').style.zIndex = 2 * n - 1; $('#dim').classList.toggle('on', n > 0);
  $$('.tabbar a').forEach((a, i) => TABS[i] === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('.tabbar').classList.remove('mini'); drawCta();
  if (changed) { if (from) M.tabSwitch($('#s-' + from), $('#s-' + tab), Math.sign(TABS.indexOf(tab) - TABS.indexOf(from))); app.offsetWidth; app.classList.remove('nq'); }
  M.sync(); S.ui.added = null;
  lastTab = tab; if (!location.hash.startsWith('#/import')) lastHash[tab] = location.hash.split('/doc/')[0];
  if (S.ui.spot) { const id = S.ui.spot; S.ui.spot = null; setTimeout(() => spot(id), tok('dur-push') * 1000 + 50); }
}
// เลื่อนไปที่จุดบนหน้างาน/เปิดงาน แล้วไฮไลต์ชั่วครู่ (ไฮไลต์เป็นสไตล์นิ่ง ใช้ได้เมื่อปิดอนิเมชัน)
function spot(id) {
  const el = $(`#${chain[chain.length - 1].id} [data-spot-id="${CSS.escape(id)}"]`); if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: RM.matches ? 'auto' : 'smooth' }); el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 1800);
}
// ลิงก์เก่า: #/home → #/today · #/man → #/docs/k/fm · #/reports/… และ #/docs/<ระบบ…> (รายงาน) → #/docs/reports/… · #/pm/fill → #/pm/<งานล่าสุด>/fill · #/pm/<งาน>/folder → #/pm/<งาน>
function migrate() {
  const h = location.hash; let n = null, m;
  if ((m = h.match(/^#\/home(\/.*)?$/))) n = '#/today' + (m[1] || '');
  else if ((m = h.match(/^#\/man(\/.*)?$/))) n = '#/docs/k/fm';
  else if ((m = h.match(/^#\/reports(\/.*)?$/))) n = '#/docs/reports' + (m[1] || '');
  else if ((m = h.match(/^#\/docs\/(?!k\/|doc\/|reports(\/|$))(.+)$/))) n = '#/docs/reports/' + m[1];
  else if ((m = h.match(/^#\/pm\/(fill|table|asset|tools)$/))) { const j = V.recent(S); if (j) n = `#/pm/${j.id}/${m[1]}`; }
  else if ((m = h.match(/^#\/pm\/([^/]+)\/folder$/))) n = '#/pm/' + m[1];
  if (n) history.replaceState(null, '', n);
}
const go = h => { location.hash = h; };
function pop() {
  if (document.activeElement) document.activeElement.blur();
  const p = parts(), di = p.indexOf('doc');
  if (p[0] === 'import') return go('#/me');
  if (p[0] === 'pm' && p[1] === 'new') return go('#/pm');
  go('#/' + (di > -1 ? p.slice(0, di) : p[2] === 'by' ? p.slice(0, 2) : p.slice(0, -1)).join('/'));
}

// ---------- sheet / toast ----------
let opener = null;
const bg = () => [...app.children].filter(c => !['sheet', 'bd', 'toast'].includes(c.id));
function openSheet(kind, id, html) {
  opener = document.activeElement; const sh = $('#sheet');
  sh.innerHTML = html ?? V.sheet(S, kind, id); M.sync(sh); sh.classList.add('open'); $('#bd').classList.add('open');
  bg().forEach(c => c.inert = true); sh.setAttribute('tabindex', '-1'); $('.sh-h button', sh).focus();
  if (kind === 'ureset') $('#uPw', sh).value = store.genPassword();   // รีเซ็ต: ใส่รหัสสุ่มให้เลย (แก้เองหรือกดสุ่มใหม่ได้)
}
function closeSheet() {
  if (!$('.sheet.open')) return;
  $$('.sheet.open,.bd.open').forEach(x => x.classList.remove('open')); bg().forEach(c => { c.inert = false; });
  if (opener && opener.isConnected) opener.focus(); opener = null;
  if ($('#tmpPw')) setTimeout(() => { if (!$('.sheet.open')) $('#sheet').innerHTML = ''; }, 500);   // รหัสชั่วคราวห้ามค้างใน DOM หลังปิด
}
function toast(text, icon = 'info', fn = null, ms = tok('toast-ms')) {
  const x = $('#toast'); $('span', x).textContent = text; $('use', x).setAttribute('href', `./ui/icons.svg#i-${icon}`);
  x.classList.add('on'); tapFn = fn; clearTimeout(toastT); if (ms) toastT = setTimeout(() => x.classList.remove('on'), ms);
}
$('#toast').addEventListener('click', () => { if (tapFn) tapFn(); });

// ---------- บันทึกค่าที่กรอก ----------
function save() { clearTimeout(saveT); saveT = 0; S.job.touched = new Date().toISOString(); const ok = store.putJob(S.job); if (!ok) toast('พื้นที่เก็บเต็ม — บันทึกไม่ได้', 'warn', null, 3500); return ok; }
const sched = () => { clearTimeout(saveT); saveT = setTimeout(save, 300); };
const later = () => { S.rev++; sched(); };
addEventListener('pagehide', () => saveT && save());
document.addEventListener('visibilitychange', () => document.hidden && saveT && save());
function progress() {
  const j = S.job, k = F.txDoneCount(j);
  $$('.prg').forEach(p => { $('.cap', p).innerHTML = `${j.cur} จาก ${j.tx.length} · เสร็จ <span class="cnt" data-v="${k}">${k}</span>`; $('.bar3 i', p).style.width = 100 * k / j.tx.length + '%'; });
  M.sync($('#s-fill,#s-table', document) || document);
}
function setVal(n, k, v) {
  if (k === 'spur' && document.activeElement.dataset.neg !== undefined && /^\d/.test(v)) v = '-' + v;   // บนฟอร์มเขียนขนาด (66) · แอปเก็บ −66 dBc
  const t = S.job.tx[n - 1], f = S.job.fields.find(x => x.k === k); t.v[k] = v; if (t.pend) delete t.pend[k];   // แก้ค่าเอง = ยืนยันค่านั้นแล้ว
  later();
  const box = document.activeElement.closest('.fld, td, .fc'); if (box) { box.querySelector('.src')?.remove(); box.classList.remove('pd'); if (f) box.classList.toggle('bad', F.bad(f, v)); }
  progress();
}
function setM(n, rv = false) {   // rv = เปลี่ยนด้วยการเลื่อนการ์ด/ปุ่มถัดไป (ไม่ใช่แตะชิป)
  n = Math.max(1, Math.min(S.job.tx.length, n)); if (n === S.job.cur) return;
  S.job.cur = n; later(); reveal = rv; draw(); reveal = false;
}
// แถบชิปเครื่องส่ง — กฎ (เจ้าของสั่ง): แตะชิป = แถบอยู่ที่เดิม ห้ามเลื่อนเอง · เปิดหน้าครั้งแรก = จัดชิปปัจจุบันกลางแถบครั้งเดียว ·
// เลื่อนการ์ดเปลี่ยนเครื่อง (reveal) = เลื่อนเฉพาะเมื่อชิปใหม่อยู่นอกพื้นที่ที่เห็นทั้งชิป และเลื่อนแบบ nearest ไม่ใช่กลาง · วาดหน้าใหม่ต้องคืนตำแหน่งเดิม
function stripScroll(fresh, x) {
  const sp = $('#strip'), c = sp && $(`[data-m="${S.job.cur}"]`, sp); if (!c) return;
  if (fresh) { sp.scrollLeft = c.offsetLeft - (sp.clientWidth - c.offsetWidth) / 2; return; }
  sp.scrollLeft = x;
  if (reveal && (c.offsetLeft < sp.scrollLeft || c.offsetLeft + c.offsetWidth > sp.scrollLeft + sp.clientWidth)) c.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function nx(d) {
  const a = $$('#s-fill .fld input'), i = a.indexOf(document.activeElement) + d;
  if (i >= a.length) { setM(S.job.cur + 1, true); $$('#s-fill .fld input')[0].focus(); return; }
  a[Math.max(i, 0)].focus();
}
// ยืนยันค่าที่เติมจากไฟล์ทั้งฟอร์ม (ล้างป้าย "รอยืนยัน")
function confirmForm(code) {
  const j = S.job, f = j.forms.find(x => (x.code || 'review') === code); if (!f) return;
  let n = f.pend || 0; if (f.kind !== 'tx') { f.pend = 0; f.done = true; } if (f.kind === 'tx') (j.tx || []).forEach(t => { n += Object.keys(t.pend || {}).filter(k => j.fields.some(x => x.k === k)).length; t.pend = {}; });
  save(); S.rev++; draw(); toast(`ยืนยันแล้ว ${n} ช่อง`, 'ok');
}

// ---------- กล้อง / ไฟล์: ย่อรูป แล้วเก็บใน IndexedDB (job เก็บแค่ id) ----------
let camTarget = null;
const slotOf = key => { const [a, b] = key.split('.'), j = S.job; return a === 'tool' ? { o: j.tools[+b], k: 'photo' } : { o: j.tx[a - 1].photos, k: b }; };
async function shrink(file) {
  const bm = await createImageBitmap(file), r = Math.min(1, tok('photo-max') / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
  c.width = Math.round(bm.width * r); c.height = Math.round(bm.height * r); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(), 'image/jpeg', tok('photo-q')));
}
// รูปของช่องในฟอร์ม (สติกเกอร์ ฯลฯ): 1 ช่อง = 1 รูป
async function attach(f) {
  let blob = f, id;
  try { if (f.type.startsWith('image/')) blob = await shrink(f); } catch { toast('อ่านรูปไม่ได้ ลองถ่ายใหม่', 'warn'); return; }
  try { id = await photos.put(blob); } catch { toast('เก็บรูปไม่ได้ (พื้นที่เต็มหรือถูกปิดไว้)', 'warn'); return; }
  const j = S.job, sl = slotOf(camTarget), old = sl.o[sl.k]; sl.o[sl.k] = id;
  if (!save()) { sl.o[sl.k] = old; photos.del(id).catch(() => {}); return; }   // บันทึกงานไม่สำเร็จ → ย้อนกลับ ไม่แจ้งว่าสำเร็จ
  S.ph[id] = URL.createObjectURL(blob);
  if (old) { photos.del(old).catch(() => {}); URL.revokeObjectURL(S.ph[old]); delete S.ph[old]; }
  closeSheet(); S.rev++; draw(); toast('บันทึกแล้ว', 'cam');
}
async function removePhoto(key) {
  const sl = slotOf(key), id = sl.o[sl.k];
  sl.o[sl.k] = '';
  if (!save()) return;
  photos.del(id).catch(() => {}); URL.revokeObjectURL(S.ph[id]); delete S.ph[id];
  closeSheet(); S.rev++; draw(); toast('ลบแล้ว', 'trash');
}
// การ์ด "ไฟล์แนบและรูป": แนบได้ทุกไฟล์ยกเว้นวิดีโอ → เก็บ → อ่านในเครื่อง → เติมการ์ด 3 (ถ้าสวิตช์เปิด) → แสดงผลทีละไฟล์
async function attachFiles(list) {
  const j = S.job; let filled = 0, n = 0; j.files ||= [];
  for (const f of list) {
    const r = await files.inspect(f, j, ctx()), e = { name: f.name || 'รูป', type: f.type, size: f.size, at: nowIso(), state: r.state, target: r.target, text: r.text, id: '' };
    if (r.state === 'rejected') { j.files.push(e); continue; }
    let blob = f; try { if (/^image\//.test(f.type)) blob = await shrink(f); } catch { /* รูปย่อไม่ได้ = เก็บไฟล์เดิม */ }
    try { e.id = await photos.put(blob); } catch { toast('เก็บไฟล์ไม่ได้ (พื้นที่เต็มหรือถูกปิดไว้)', 'warn'); continue; }
    if (r.state === 'filled') { const k = files.apply202(j, r.read); filled += k; e.text = `เติม ${k} ช่องใน ${r.target} · ${r.read.rows.length} เครื่อง · รอยืนยัน${r.warnRev ? r.text.slice(r.text.indexOf(' · ไฟล์')) : ''}`; e.state = r.warnRev ? 'warn' : 'filled'; }
    else if (r.nvals) { const fm = j.forms.find(x => x.code === r.target && x.kind !== 'tx'); if (fm) { fm.pend = (fm.pend || 0) + r.nvals; fm.fileName = e.name; filled += r.nvals; e.text += ' · รอยืนยัน'; } }
    else if (r.state === 'unsorted' && /^image\//.test(f.type)) { e.state = 'attached'; e.text = 'ลายมือ · พิมพ์ค่าเองในฟอร์ม (รูปอยู่ข้างช่อง)'; }   // อ่านไม่ได้ = เก็บเป็นหลักฐาน ไม่ใช้ AI cloud
    j.files.push(e); n++; try { S.ph[e.id] = URL.createObjectURL(blob); } catch { /* ไม่มีรูปย่อ */ }
  }
  if (!save()) return; S.rev++; draw();
  toast(filled ? `เติมจากไฟล์ ${filled} ช่อง · รอยืนยัน` : n ? 'แนบไฟล์แล้ว' : 'ไม่รับไฟล์นี้', filled || n ? 'ok' : 'warn');
}
['#cam', '#file'].forEach(q => $(q).addEventListener('change', e => {
  const fs = [...e.target.files]; e.target.value = ''; if (!fs.length || !camTarget) return;
  if (camTarget === 'attach') attachFiles(fs); else attach(fs[0]);
}));

// ---------- เปิดงาน ----------
async function createFromDraft(asDraft) {
  const d = S.draft; if (!d) return; const now = nowIso();
  let j = d.off ? F.newPmJob({ id: d.job.id, off: d.off, system: '', eng: d.job.eng, travel: d.job.travel, draft: asDraft, prev: S.prev, now, me: S.user.name }) : { ...d.job, draft: asDraft, touched: now };
  if (!asDraft && !d.off && openNeeds().length) return spotNeed();
  if (d.off && (!d.off.name.trim() || !d.off.reason.trim() || !(d.off.days >= 1))) return spotNeed();
  const I = S.imp, use = I && (d.useImp || (d.row && F.matchRow([d.row], I.data.subject, imp.norm, imp.roundOf)));
  if (use) {
    const fl = [];
    try { for (const p of I.pdfs) fl.push({ name: p.name, type: 'application/pdf', size: p.blob.size, at: now, state: 'attached', target: 'FM-CE.SE-040', text: 'PDF จากสารบรรณ', id: await photos.put(p.blob) }); }
    catch { toast('เก็บไฟล์ PDF ไม่ได้ (พื้นที่เต็มหรือถูกปิดไว้)', 'warn'); }
    j = imp.applyImport(j, I.data, now); j.files = [...j.files, ...fl];
  }
  if (!store.addJob(j)) { (j.files || []).forEach(x => x.id && photos.del(x.id).catch(() => {})); return toast('พื้นที่เก็บเต็ม — เปิดงานไม่ได้', 'warn', null, 3500); }
  store.rememberRound(d.row ? d.row.job : 'off', j.eng, j.travel);
  if (use) { S.imp = null; imp.unstash(); await loadPhotos(); }
  S.jobs.push(j); S.job = j; S.ui.added = j.id; S.draft = null; closeSheet(); S.rev++; go('#/pm/' + j.id); toast(asDraft ? 'เปิดเป็นร่างแล้ว · รอ FM-040' : 'เปิดงานแล้ว', 'ok');
}
const openNeeds = () => V.openNeeds(S);
const spotNeed = () => { const n = S.draft.off ? V.openNeeds(S) : openNeeds(); spot(n[0]); toast('กรอกช่องที่ยังว่างก่อน', 'warn'); };
function setEng(name, manual) {
  const j = S.draft.job, prev = (S.prev.eng || []).includes(name); j.eng = name;
  if (name) j.vals.eng = { v: name, src: manual || !prev ? 'manual' : 'prev', loc: prev ? 'วิศวกรเฝ้าระวังรอบก่อน' : 'กรอกเอง', at: S.today }; else delete j.vals.eng;
}
function setTravel(t) { const j = S.draft.job; j.travel = t; j.vals.travel = { v: t, src: S.prev.travel === t ? 'prev' : 'manual', loc: S.prev.travel === t ? 'จำต่อสถานี' : 'กรอกเอง', at: S.today }; }

// ---------- แก้ค่าที่ระบบเติม (sheet รายละเอียดค่า) ----------
const valTarget = sc => sc === 'd' ? S.draft.job : S.job;
function valSave(sc, key) {
  const j = valTarget(sc), v = ($('#ev1') || {}).value || '', v2 = ($('#ev2') || {}).value || '', why = ($('#evr').value || '').trim(), err = t => { const x = $('#evErr'); x.hidden = !t; $('span', x).textContent = t || ''; };
  if (!why) return err('ต้องระบุเหตุผลที่แก้');
  if (key === 'dates' ? !v || !v2 || v2 < v : !v.trim()) return err(key === 'dates' ? 'ตรวจช่วงวันที่อีกครั้ง' : 'ค่าใหม่ว่างไม่ได้');
  const old = j.vals[key] || {}, prevV = key === 'dates' ? (j.dates ? j.dates.join(' – ') : old.v ?? '') : key === 'eng' ? j.eng : key === 'travel' ? j.travel : key === 'people' ? old.v ?? (j.pm.people || []).join(', ') : j.pm.order;
  if (key === 'dates') j.dates = [v, v2]; else if (key === 'eng') j.eng = v.trim(); else if (key === 'travel') j.travel = v; else if (key === 'people') { /* ชื่อเก็บใน vals */ } else j.pm.order = v.trim();
  j.vals[key] = { ...old, v: key === 'dates' ? `${v} – ${v2}` : v.trim(), src: 'manual', loc: 'แก้เอง', at: S.today, orig: old.orig !== undefined ? old.orig : prevV, reason: why, pending: false };
  closeSheet(); if (sc === 'j') { save(); }
  S.rev++; draw(); toast('บันทึกการแก้ไขแล้ว', 'ok');
}
function valOk(sc, key) { const j = valTarget(sc); if (j.vals[key]) j.vals[key].pending = false; closeSheet(); if (sc === 'j') save(); S.rev++; draw(); toast('ยืนยันแล้ว', 'ok'); }

// ---------- CTA ลอยเหนือ dock: ปุ่มเดียวทุกหน้า · กว้างเท่ากันหมด (วัดจากป้ายที่กว้างสุดครั้งเดียว) ----------
const ctaHtml = (i, t, soft, frac) => `${soft ? V.ring(frac, 'ความคืบหน้า') : V.ic(i)}<span>${t}</span>`;
function measureCta() {
  const m = $('#cta').cloneNode(), labels = [['plus', 'งาน PM'], ['plus', 'เปิดงาน PM'], ['doc', 'สร้างรายงาน']];
  m.removeAttribute('id'); m.hidden = false; m.style.cssText = 'position:absolute;display:flex;visibility:hidden;width:auto;left:0;transform:none;max-width:none';
  app.append(m);
  const w = Math.ceil(Math.max(...labels.map(([i, t]) => { m.innerHTML = ctaHtml(i, t); return m.getBoundingClientRect().width; })));
  m.remove(); document.documentElement.style.setProperty('--cta-w', w + 'px');
}
let ctaMeasured = false;
function drawCta() {
  const top = chain[chain.length - 1], el = $('#cta'), j = top.id === 's-job' && S.jobs.find(x => x.id === top.arg);
  const c = top.id === 's-pm' && (S.ui.pmt || 'pm-cur') === 'pm-cur' ? ['new', 'plus', 'งาน PM'] : top.id === 's-open' ? V.openCta(S) : j ? V.jobCta(S, j) : null;
  app.classList.toggle('cta-on', !!c); el.hidden = !c;
  if (!c) return;
  el.dataset.act = c[0]; el.classList.toggle('soft', !!c[3]); el.innerHTML = ctaHtml(c[1], c[2], c[3], c[4]);
  if (c[3]) M.sync(el);
  if (!ctaMeasured) { ctaMeasured = true; (document.fonts ? document.fonts.ready : Promise.resolve()).then(measureCta); }
}
function ctaGo() {
  const a = $('#cta').dataset.act;
  if (a === 'new') go('#/pm/pick');
  else if (a === 'open') createFromDraft(false);
  else if (a === 'opengap') spotNeed();
  else if (a === 'gap') spot(F.firstGap(S.job, ctx()));
  else if (a === 'report') toast('ขั้นถัดไป: ออกรายงานลงฟอร์มจริง (PR ถัดไป)', 'doc', null, 3000);
}

// ---------- เหตุการณ์ ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-fmode],[data-dl-ed],[data-retry],[data-back],.tabbar a,[data-sheet],[data-close],.sw,[data-off-act],[data-pane],[data-toast],[data-cam],[data-m],[data-nx],[data-done],[data-signout],[data-u-gen],[data-u-add],[data-u-reset],[data-u-set],[data-u-copy],[data-pre],[data-spot],[data-vo],[data-ex],[data-sopen],[data-sx],[data-more],[data-site],[data-eng],[data-eng-other],[data-travel],[data-offrd],[data-use-imp],[data-open-draft],[data-sim040],[data-chk],[data-confirm-form],[data-form-done],[data-assign],[data-file-del],[data-val-edit],[data-val-save],[data-val-ok],[data-evt],#cta,[data-share],[data-peek],[data-pw-save],[data-recheck],[data-be],[data-file],[data-photo-del],[data-sel],[data-impjob],[data-imp-save],[data-bm-link],[data-bm-copy],#bd');
  if (!t) return; const d = t.dataset;
  if (d.pre) { const [k, v] = d.pre.split(':'); S.ui[k] = v; S.rev++; }
  if ('vo' in d) { S.ui.vo = !t.parentNode.open; return; }
  if (d.spot) S.ui.spot = d.spot;   // แตะแคปซูลในหน้าวันนี้ → ไปหน้างานแล้วเลื่อนไปจุดที่ติด
  if (t.id === 'cta') ctaGo();
  else if (d.retry === 'users') { S.users = { st: 'load' }; S.rev++; draw(); fetchUsers(); }
  else if ('retry' in d) { if (d.retry.startsWith('file:')) { delete S.urls[d.retry.slice(5)]; S.rev++; draw(); } else refresh(d.retry.split(',')); }   // การ์ดโหลดไม่สำเร็จ → โหลดเฉพาะชุดนั้นใหม่
  else if ('ex' in d) { S.job.example = d.ex; save(); closeSheet(); S.rev++; draw(); toast('เปลี่ยนตัวอย่างแล้ว', 'ok'); }
  else if ('sopen' in d) { const n = t.closest('.nav'); n.classList.add('so'); $('input', n).focus(); }
  else if ('sx' in d) { const n = t.closest('.nav'), i = $('input', n); n.classList.remove('so'); if (i.value) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } }
  else if ('more' in d) { $$('[data-x]', t.closest('.grp')).forEach(x => x.removeAttribute('hidden')); t.remove(); }
  else if ('site' in d) { S.ui.site = d.site; S.rev++; draw(); }
  else if ('eng' in d) { setEng(d.eng); S.draft.other = false; S.rev++; draw(); }
  else if ('engOther' in d) { S.draft.other = !S.draft.other; S.rev++; draw(); if (S.draft.other) $('#engOther')?.focus(); }
  else if ('travel' in d) { setTravel(d.travel); S.rev++; draw(); }
  else if ('offrd' in d) { S.draft.off.round = +d.offrd; S.rev++; draw(); }
  else if ('useImp' in d) { S.draft.useImp = true; S.rev++; draw(); }
  else if ('openDraft' in d) createFromDraft(true);
  else if ('sim040' in d) { const j = S.job; j.f040 = 'approved'; j.draft = false; j.vals.f040 = { v: 'อนุมัติแล้ว (จำลองในโหมดตัวอย่าง)', src: 'manual', loc: 'ปุ่มจำลอง', at: S.today }; save(); S.rev++; draw(); toast('จำลองว่า FM-040 อนุมัติแล้ว', 'ok'); }
  else if ('chk' in d) { const r = S.job.ready; r[d.chk] = !r[d.chk]; save(); S.rev++; draw(); }
  else if ('confirmForm' in d) confirmForm(d.confirmForm);
  else if ('formDone' in d) { const f = S.job.forms.find(x => (x.code || 'review') === d.formDone); f.done = !f.done; save(); closeSheet(); S.rev++; draw(); toast(f.done ? 'ทำเครื่องหมายแล้ว' : 'ยกเลิกเครื่องหมายแล้ว', 'ok'); }
  else if ('assign' in d) { const [i, code] = d.assign.split(':'), f = S.job.files[+i]; f.target = code; f.text = `จัดเข้า ${code} เอง · ยังไม่อ่านค่า`; f.state = 'attached'; save(); closeSheet(); S.rev++; draw(); toast('จัดเข้าฟอร์มแล้ว', 'ok'); }
  else if ('fileDel' in d) { const j = S.job, f = j.files[+d.fileDel]; j.files.splice(+d.fileDel, 1); if (f.id) { photos.del(f.id).catch(() => {}); URL.revokeObjectURL(S.ph[f.id]); delete S.ph[f.id]; } save(); closeSheet(); S.rev++; draw(); toast('ลบไฟล์แล้ว (ค่าที่เติมจากไฟล์นี้ยังอยู่ในฟอร์ม)', 'trash', null, 2600); }
  else if ('valEdit' in d) { const x = $('#valEd'); x.hidden = !x.hidden; t.setAttribute('aria-expanded', !x.hidden); }
  else if ('evt' in d) { $('#ev1').value = d.evt; $$('[data-evt]').forEach(b => b.setAttribute('aria-pressed', b === t)); }
  else if ('valSave' in d) { const [sc, k] = d.valSave.split(/:(.+)/); valSave(sc, k); }
  else if ('valOk' in d) { const [sc, k] = d.valOk.split(/:(.+)/); valOk(sc, k); }
  else if ('peek' in d) { const i = $('input', t.parentNode), on = i.type === 'password'; i.type = on ? 'text' : 'password'; t.setAttribute('aria-pressed', on); t.setAttribute('aria-label', on ? 'Hide password' : 'Show password'); $('use', t).setAttribute('href', `./ui/icons.svg#i-${on ? 'eyeoff' : 'eye'}`); }
  else if ('pwSave' in d) savePassword();
  else if ('uGen' in d) $('#uPw').value = store.genPassword();
  else if ('uAdd' in d) addUser();
  else if (d.uReset) resetUser(d.uReset);
  else if (d.uSet) { const [id, on] = d.uSet.split(/:(.+)/); setUser(id, on === '1'); }
  else if ('uCopy' in d) copyPw();
  else if ('recheck' in d) finishLogin(true);
  else if (d.be) { store.setBackend(d.be); store.pref('user', null); location.reload(); }   // เปลี่ยน backend = ล็อกอินใหม่
  else if ('back' in d) { e.preventDefault(); pop(); }
  else if (t.closest('.tabbar')) { e.preventDefault(); const n = TABS[$$('.tabbar a').indexOf(t)]; if (t.closest('.mini')) $('.tabbar').classList.remove('mini'); else if (n === tab) { const sc = $('#' + chain[chain.length - 1].id); if (sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: RM.matches ? 'auto' : 'smooth' }); else if (chain.length > 1) go('#/' + n); } else go(lastHash[n] || '#/' + n); }
  else if (d.sheet) { const [k, id] = d.sheet.split(/:(.+)/); openSheet(k, id); }
  else if (t.id === 'bd' || 'close' in d) closeSheet();
  else if (t.classList.contains('sw')) {
    const on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on); $('span', t).textContent = on ? 'เปิด' : 'ปิด';
    if (d.off) { store.setOffline(d.off, on); S.rev++; draw(); } else if (d.pref) store.pref(d.pref, on); 
  }
  else if ('fmode' in d) { store.pref('fmode', d.fmode || null); history.replaceState(null, '', `#/pm/${S.job.id}/fill`); S.rev++; draw(); }   // ช่องกรอก | บนฟอร์ม (จำไว้ครั้งหน้า)
  else if (d.dlEd) {   // ไฟล์แก้ได้ (Word/Excel) ของเอกสารที่รวมกับ PDF: ขอ signed URL ตอนกดแล้วดาวน์โหลด
    const it = V.viewItem(S, d.dlEd);
    store.fileUrl(it && it.editable).then(url => url ? fetch(url) : Promise.reject()).then(r => r.ok ? r.blob() : Promise.reject())   // โหลดเป็น blob แล้วบันทึก: ไม่ออกจากแอป ไม่พึ่ง header ของ Storage
      .then(b => { const a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = it.editable.file || 'file'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000); })
      .catch(() => toast('ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง', 'warn'));
  }
  else if (d.offAct) { closeSheet(); const on = !V.isOff(S, d.offAct); store.setOffline(d.offAct, on); S.rev++; draw(); toast(on ? 'เก็บไว้ดู offline แล้ว' : 'ลบออกจาก offline แล้ว', on ? 'dl' : 'trash'); }
  else if (d.pane) { $$('button', t.parentNode).forEach(b => b.setAttribute('aria-pressed', b === t)); $$(':scope > .pane', $('#' + d.pane).parentNode).forEach(p => { p.hidden = p.id !== d.pane; }); if (/^[pr]-/.test(d.pane)) S.ui[d.pane[0]] = d.pane; if (/^pm-/.test(d.pane)) { S.ui.pmt = d.pane; drawCta(); } }
  else if ('toast' in d) toast(d.toast);
  else if ('cam' in d) { camTarget = d.cam; $('#cam').click(); }
  else if ('file' in d) { camTarget = d.file; const x = $('#file'); x.multiple = d.file === 'attach'; x.click(); }
  else if ('photoDel' in d) removePhoto(d.photoDel);
  else if (d.m) setM(+d.m);
  else if (d.nx) nx(+d.nx);
  else if ('done' in d) document.activeElement.blur();
  else if ('signout' in d) { store.signOut().then(() => { history.replaceState(null, '', location.pathname); location.reload(); }); }
  else if ('share' in d) { const u = location.href; navigator.share ? navigator.share({ url: u }).catch(() => {}) : toast('แชร์ยังไม่เปิดใช้ในเบราว์เซอร์นี้'); }
  else if (d.impjob) { S.imp.pick = d.impjob; closeSheet(); S.rev++; draw(); }
  else if ('impSave' in d) saveImport();
  else if ('bmLink' in d) { e.preventDefault(); toast('ลากปุ่มนี้ขึ้นแถบบุ๊กมาร์ก ไม่ต้องแตะ', 'info', null, 3000); }
  else if ('bmCopy' in d) copyBm();
  else if (d.sel && pad.matches) { e.preventDefault(); S.ui.sel = d.sel; S.rev++; draw(); }
});
document.addEventListener('input', e => {
  const i = e.target;
  if (i.dataset.k) setVal(+i.dataset.n, i.dataset.k, i.value);
  else if (i.dataset.off) { const o = S.draft.off; o[i.dataset.off] = i.dataset.off === 'days' ? +i.value : i.value; drawCta(); }
  else if (i.id === 'engOther') { setEng(i.value.trim(), true); drawCta(); }
  else if (i.dataset.filter === 'docs') { const q = i.value.trim().toLowerCase(), r = $('#dres'); $('#dhome').hidden = !!q; r.hidden = !q; if (q) { r.innerHTML = V.searchAll(S, q); M.stagger($$('.swr', r)); } }
  else if ('filter' in i.dataset) { const q = i.value.trim().toLowerCase(), shown = []; $$('.swr,.grp>.row', i.closest('.screen')).forEach(w => { const h = !w.textContent.toLowerCase().includes(q); if (w.hidden && !h) shown.push(w); w.hidden = h; }); M.stagger(shown); }
});
// แถบเหนือคีย์บอร์ด (หน้ากรอกค่า iPhone) + ตารางตัวเลือกช่องของ iPad
let kt;
document.addEventListener('focusin', e => {
  const i = e.target, f = i.closest && i.closest('#s-fill .fld');
  if (i.closest && i.closest('#tbd') && i.dataset.n) {
    const n = +i.dataset.n, j = S.job; j.cur = n; sched();
    $('#wf').textContent = `ช่องที่เลือก: ${j.fields.find(x => x.k === i.dataset.k).n} · Tx ${n}`; progress();
    const w = $('#wiAsset'); w.value = j.tx[n - 1].v.asset || ''; w.dataset.n = n; $('.t', w.closest('.fld')).textContent = `Asset No · Tx ${n}`;
  }
  if (!f) return; clearTimeout(kt); app.classList.add('kbd'); $('#kbl').textContent = f.dataset.lbl; i.scrollIntoView({ block: 'center' });
});
document.addEventListener('focusout', () => { kt = setTimeout(() => { if (!document.activeElement.closest('#s-fill .fld')) app.classList.remove('kbd'); }, 80); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !app.classList.contains('login')) { if ($('.sheet.open')) closeSheet(); else if ($('.nav.so')) $('.nav.so [data-sx]').click(); else if (chain.length > 1) pop(); }
  if (e.key === 'Enter' && e.target.closest && e.target.closest('#s-fill .fld')) { e.preventDefault(); nx(1); }
});
$('#kbar').addEventListener('pointerdown', e => e.preventDefault());   // ไม่ให้ช่องกรอกเสียโฟกัส
const vv = window.visualViewport;
if (vv) { const kb = () => { const r = document.documentElement.style, h = Math.max(0, innerHeight - vv.height - vv.offsetTop); r.setProperty('--kbh', h + 'px'); app.classList.toggle('kbo', h > tok('kbar-h')); r.setProperty('--kbt', vv.offsetTop + vv.height - tok('kbar-h') + 'px'); }; vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb); }
// ไถลง = dock ย่อ · title ใหญ่ยุบเข้า nav
let sa = 0;
app.addEventListener('scroll', e => {
  const s = e.target.closest && e.target.closest('.screen'); if (!s) return;
  const y = e.target.scrollTop, d = y - (e.target._y || 0); e.target._y = y; s.classList.toggle('sc', y > tok('collapse-y'));
  if (s.id === 's-view' && $('.pages[data-pg]', s)) $('#pn', s).textContent = Math.min(+$('.pages', s).dataset.pg, Math.floor(y / ($('.page', s).offsetHeight + 14) + .5) + 1);
  if (!d) return; sa = sa * d > 0 ? sa + d : d; const mini = $('.tabbar').classList;
  // กฎเดียวทุกหน้า: dock ย่อได้เฉพาะหน้าที่เลื่อนได้เกิน --dock-min-scroll (หน้าสั้นไม่ย่อ)
  const long = e.target.scrollHeight - e.target.clientHeight > tok('dock-min-scroll');
  if (!long || y <= tok('slop') || sa < -tok('slop')) mini.remove('mini'); else if (sa > tok('dock-shrink')) mini.add('mini');
}, true);

// ---------- ล็อกอิน (อังกฤษ): ชื่อผู้ใช้ (อีเมล) + รหัสผ่าน · demo รับอะไรก็ได้ ----------
const real = () => store.backendName() !== 'demo';
const notReady = () => real() && !(CONFIG.supabaseUrl && CONFIG.anonKey);
const LOGIN_ERR = { auth: 'Wrong username or password', offline: 'No connection', server: 'Server not configured' };
const loginErr = t => { const x = $('#lgErr'); x.hidden = !t; $('span', x).textContent = t || ''; };
let busy = false;
async function finishLogin(recheck = false) {
  if (busy) return; busy = true; loginErr('');
  try {
    const raw = $('#email').value.trim(), pwRaw = $('#pass').value;
    if (!recheck && (!raw || !pwRaw)) return loginErr(LOGIN_ERR.auth);   // ทั้ง demo และจริง: ต้องกรอกทั้งคู่
    let u = { name: 'สมหมาย', email: raw, id: 'demo-admin', is_admin: true };   // demo: เห็นหน้าผู้ใช้ได้ (ข้อมูลจำลอง)
    if (real()) {
      if (notReady()) return loginErr(LOGIN_ERR.server);
      const em = raw.includes('@') ? raw : raw + '@aerothai.co.th', pw = pwRaw;   // พิมพ์ sommai.sa = sommai.sa@aerothai.co.th
      try {
        const a = store.auth();
        if (!recheck) { await a.signIn(em, pw); $('#pass').value = ''; $('#pass').type = 'password'; }   // ไม่ให้รหัสผ่านค้างในช่อง
        const p = await a.me(); $('#s-login').classList.toggle('wait', !p.approved);
        if (!p.approved) return;
        u = { name: p.name || p.email, email: p.email, id: p.id, is_admin: p.is_admin === true }; S.user = u; await load();
      } catch (e) { $('#pass').value = ''; return loginErr(e.code === 'auth' ? LOGIN_ERR.auth : e.code === 'offline' ? LOGIN_ERR.offline : 'Something went wrong. Try again.'); }
    }
    enter(u);
  } finally { busy = false; }
}
function enter(u) {
  store.pref('user', u); S.user = u; app.classList.remove('login'); S.rev++; location.hash.length > 2 ? draw() : go('#/today');
}
$('#loginForm').addEventListener('submit', e => { e.preventDefault(); finishLogin(); });

// เปลี่ยนรหัสผ่าน (sheet จาก views.js · เฉพาะ backend จริง)
async function savePassword() {
  const a = $('#pw1').value, b = $('#pw2').value, x = $('#pwErr'), say = t => { x.hidden = !t; $('span', x).textContent = t || ''; };
  if (a.length < 8) return say('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว');
  if (a !== b) return say('รหัสผ่านสองช่องไม่ตรงกัน');
  say('');
  try { await store.auth().changePassword(a); } catch (e) { return say(e.code === 'invalid' ? 'รหัสผ่านนี้ใช้ไม่ได้ ลองตั้งใหม่' : errWord(e)); }
  closeSheet(); toast('เปลี่ยนรหัสผ่านแล้ว', 'ok');
}

// ---------- ผู้ใช้ (แอดมิน) ----------
const UERR = { exists: 'ชื่อผู้ใช้นี้มีอยู่แล้ว', target_admin: 'จัดการบัญชีแอดมินในแอปไม่ได้', partial: 'สร้างไม่สำเร็จ และลบบัญชีที่ค้างไม่ได้ · ตรวจใน Dashboard › Authentication', forbidden: 'บัญชีนี้ไม่มีสิทธิ์แอดมิน', notdeployed: 'ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์ · ดู backend/edge/README.md',
  username: 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3-40 ตัว', name: 'กรอกชื่อ-นามสกุล', password: 'รหัสผ่านต้องยาวอย่างน้อย 10 ตัว' };
const uerr = e => UERR[e.field] || UERR[e.code] || errWord(e);
let ubusy = false;
async function fetchUsers() {
  const mine = S.users;
  try { const r = await store.adminUsers('list'); if (S.users === mine) S.users = { st: 'ok', rows: r.users }; }
  catch (e) { if (S.users === mine) S.users = e.code === 'notdeployed' ? { st: 'nd' } : { st: 'err', e }; }
  S.rev++; draw();
}
// ทำคำสั่งผู้ใช้ 1 ครั้ง (กันกดซ้ำ) · ผิด = say(ข้อความ) ในช่องผิดพลาดของ sheet (ถ้ามี) ไม่งั้น toast
async function userCmd(action, body, say = t => toast(t, 'warn')) {
  if (ubusy) return null; ubusy = true;
  try { return await store.adminUsers(action, body) || {}; } catch (e) { say(uerr(e)); return null; } finally { ubusy = false; }
}
const uSay = t => { const x = $('#uErr'); if (!x) return t && toast(t, 'warn'); x.hidden = !t; $('span', x).textContent = t || ''; };
function showPw(username, pw) { closeSheet(); openSheet('newpw', null, V.newPwSheet(username, pw)); }
async function addUser() {
  const username = $('#uUser').value.trim().toLowerCase(), name = $('#uName').value.trim(), password = $('#uPw').value; uSay('');
  if (!await userCmd('create', { username, name, password }, uSay)) return;
  showPw(username, password); S.users = { st: 'load' }; fetchUsers();
}
async function resetUser(id) {
  const password = $('#uPw').value, u = ((S.users && S.users.rows) || []).find(x => x.id === id); uSay('');
  if (!await userCmd('reset', { id, password }, uSay)) return;
  showPw(u ? u.username : '', password);
}
async function setUser(id, approved) {
  if (!await userCmd('set', { id, approved })) return;
  const u = S.users && S.users.rows && S.users.rows.find(x => x.id === id); if (u) u.approved = approved; S.rev++; draw(); toast(approved ? 'เปิดการใช้งานแล้ว' : 'ปิดการใช้งานแล้ว', 'ok');
}
async function copyPw() {
  const t = $('#tmpPw').textContent;
  try { await navigator.clipboard.writeText(t); toast('คัดลอกรหัสแล้ว', 'ok'); } catch { const r = document.createRange(); r.selectNodeContents($('#tmpPw')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('เลือกรหัสแล้ว กดคัดลอกเอง', 'info'); }
}

// ---------- สารบรรณ: ติดตั้งปุ่ม + รับข้อมูลที่นำเข้า ----------
// โค้ดปุ่มอ่านจาก bookmarklet/sarabun-to-pms.js (ไฟล์เดียวเป็นต้นฉบับ) ย่อ+ใส่ที่อยู่แอปที่เปิดอยู่ (/pms/ หรือ /pms/preview/)
let bmCode = '', bmSrc = null;
function bmFill(el) {
  bmSrc ||= fetch('./bookmarklet/sarabun-to-pms.js').then(r => r.ok ? r.text() : Promise.reject());
  bmSrc.then(src => { bmCode = imp.bookmarklet(src, new URL('./', location.href).href); const a = $('[data-bm-link]', el); if (a) a.href = 'javascript:' + encodeURIComponent(bmCode.slice(11)); }).catch(() => { bmSrc = null; });
}
async function copyBm() {
  if (!bmCode) return toast('กำลังเตรียมโค้ด ลองกดอีกครั้ง', 'sync');
  try { await navigator.clipboard.writeText(bmCode); toast('คัดลอกโค้ดแล้ว', 'ok'); }
  catch { toast('คัดลอกไม่ได้ ลองใหม่อีกครั้ง', 'warn'); }
}
// บันทึกผลนำเข้าเข้างานที่เปิดแล้ว (งานที่ยังไม่เปิด = เปิดจากหน้าเปิดงาน ดู createFromDraft)
async function saveImport() {
  const I = S.imp, j = I && imp.impTarget(S); if (!j) return toast('เลือกงานก่อน', 'warn');
  const fl = [], now = nowIso();
  try { for (const p of I.pdfs) fl.push({ name: p.name, type: 'application/pdf', size: p.blob.size, at: now, state: 'attached', target: 'FM-CE.SE-040', text: 'PDF จากสารบรรณ', id: await photos.put(p.blob) }); }
  catch { toast('เก็บไฟล์ PDF ไม่ได้ (พื้นที่เก็บเต็มหรือถูกปิดไว้)', 'warn'); }
  const n = imp.applyImport(j, I.data, now); n.files = [...(n.files || []), ...fl];
  if (!store.putJob(n)) { fl.forEach(f => photos.del(f.id).catch(() => {})); return toast('พื้นที่เก็บเต็ม — บันทึกไม่ได้', 'warn', null, 3500); }
  Object.assign(j, n); S.job = j; S.imp = null; imp.unstash(); await loadPhotos(); S.rev++; go('#/pm/' + j.id); toast('นำเข้าบันทึกงานแล้ว', 'ok');
}
imp.init(v => {
  S.imp = { ...v, pick: null }; store.pref('sarabun', { last: new Date().toISOString() }); S.rev++;
  if (S.catalog && !app.classList.contains('login')) location.hash === '#/import' ? draw() : go('#/import');   // ยังโหลดไม่เสร็จ/ยังไม่ล็อกอิน: เก็บไว้ก่อน วาดตอนเริ่ม
}, why => toast(why === 'too-big' ? 'หนังสือยาวเกิน ใช้บุ๊กมาร์กแทน' : 'ข้อมูลจากสารบรรณไม่ถูกต้อง · ลองกดปุ่มอีกครั้ง', 'warn', null, 3500));

// ---------- เริ่มทำงาน ----------
function themeColor() { $('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); }
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', themeColor); themeColor();
const setPad = () => { document.body.classList.toggle('pad', pad.matches); if (S.job) draw(); };
pad.addEventListener('change', setPad); document.body.classList.toggle('pad', pad.matches);
addEventListener('hashchange', () => { migrate(); closeSheet(); draw(); });
initGestures({ app, hasTab: d => TABS[TABS.indexOf(tab) + d] !== undefined, goTab: d => { const n = TABS[TABS.indexOf(tab) + d]; if (n) go(lastHash[n] || '#/' + n); }, longPress: w => { const a = $('.swa', w); if (a) { navigator.vibrate?.(10); openSheet('act', '', V.actSheet($('.rt span', w).textContent, a)); } }, depth: () => chain.length - 1, top: () => $('#' + chain[chain.length - 1].id), parent: () => $('#' + chain[chain.length - 2].id), pop, closeSheet, setM: n => setM(n, true), cur: () => S.job.cur, refresh, isPad: () => pad.matches });
M.init(app);
(async () => {
  const u = store.pref('user'); S.user = u || { name: 'สมหมาย' }; app.classList.toggle('login', !u);
  $('#lgDemo')?.toggleAttribute('hidden', real());   // ป้าย demo เฉพาะโหมดตัวอย่าง · ?. กัน index.html เก่าจาก HTTP cache
  if (u && real() && !u.id) { try { u.id = JSON.parse(localStorage.getItem('pms.session')).user.id; } catch {} }   // ผู้ใช้ที่ล็อกอินก่อนรุ่นนี้: เติม id จาก session (ใช้แยกรายงานของฉัน)
  if (u && real() && u.is_admin === undefined) { try { u.is_admin = (await store.auth().me()).is_admin === true; store.pref('user', u); } catch { u.is_admin = false; } }   // ผู้ใช้ที่ล็อกอินก่อนรุ่นนี้: อ่านสิทธิ์จาก profiles (แค่ซ่อน/แสดงเมนู · เซิร์ฟเวอร์ตรวจจริง)
  let ok = false;   // ยังไม่มีข้อมูล (ยังไม่ล็อกอิน/โหลดไม่ได้) = ไม่วาดหน้าจอ ไม่งั้นพัง
  if (u || !real()) { try { await load(); ok = true; } catch (e) { if (e.code === 'auth') { store.pref('user', null); app.classList.add('login'); } toast(errWord(e), 'warn'); } }
  migrate(); if (ok) draw();
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const ready = w => toast('มีเวอร์ชันใหม่ แตะเพื่อโหลด', 'sync', () => w.postMessage('skip'), 0);
  navigator.serviceWorker.register('./sw.js').then(r => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); });
    if (r.waiting && navigator.serviceWorker.controller) ready(r.waiting);
    r.addEventListener('updatefound', () => { const w = r.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ready(w); }); });
  });
  let reloaded = 0; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = 1; saveT && save(); location.reload(); } });
}
