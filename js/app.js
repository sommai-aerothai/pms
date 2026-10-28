// PMS · router (hash) + shell + เหตุการณ์ · หน้าจอจริงอยู่ใน views.js · ท่าทางอยู่ใน gestures.js
import * as store from './store.js';
import * as V from './views.js';
import { initGestures } from './gestures.js';
import * as photos from './photos.js';
import { tok } from './tok.js';
import { CONFIG } from './config.js';

const VERSION = 'v0.4';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), TABS = ['today', 'pm', 'reports', 'docs', 'me'];
const TITLES = { today: 'วันนี้', pm: 'งาน PM', reports: 'รายงาน', docs: 'เอกสาร', me: 'ฉัน' };
const S = { ph: {}, rev: 0, ui: {}, version: VERSION, user: null, docs: [], templates: [], catalog: null, cats: [], files: [], jobs: [], job: null };
const pad = matchMedia(`(min-width:${tok('bp-pad')}px)`);
let chain = [], tab = 'today', lastTab = null, lastHash = {}, saveT, toastT, tapFn = null, reveal = false;

// ---------- โหลดข้อมูล ----------
async function load() {
  [S.docs, S.templates, S.catalog, S.cats, S.jobs] = [(await store.listDocs()).items, await store.listTemplates(), await store.getCatalog(), await store.getFiles(), await store.listJobs()];
  S.files = S.cats.flatMap(c => c.rows); S.job = V.recent(S) || S.jobs[0];
  await loadPhotos();
}
const photoIds = () => S.jobs.flatMap(j => [...(j.tx || []).flatMap(t => Object.values(t.photos)), ...j.tools.map(t => t.photo), ...j.folder.photos.map(p => p.id)]).filter(Boolean);
async function loadPhotos() {
  for (const id of photoIds()) if (!S.ph[id]) { try { const b = await photos.get(id); if (b) S.ph[id] = URL.createObjectURL(b); } catch { /* IndexedDB ใช้ไม่ได้ → ไม่มี thumbnail */ } }
}
const errWord = e => ({ auth: 'ต้องเข้าสู่ระบบใหม่', server: 'เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง', conflict: 'มีคนแก้งานนี้ก่อน โหลดใหม่แล้วลองอีกครั้ง', offline: 'ออฟไลน์อยู่', notfound: 'ไม่พบข้อมูล', throttled: 'ระบบยุ่ง ลองใหม่อีกครั้ง' }[e.code] || 'เกิดข้อผิดพลาด');
async function refresh() {
  try { [S.docs, S.templates, S.cats] = [(await store.listDocs()).items, await store.listTemplates(), await store.getFiles()]; S.files = S.cats.flatMap(c => c.rows); S.rev++; draw(); toast('รีเฟรชแล้ว', 'ok'); }
  catch (e) { toast(errWord(e), 'warn'); }
}

// ---------- router: hash → {tab, stack} ----------
const parts = () => decodeURIComponent(location.hash).replace(/^#\/?/, '').split('/').filter(Boolean);
function resolve() {
  let p = parts(); if (!TABS.includes(p[0])) p = ['today'];
  const t = p[0]; let rest = p.slice(1), doc = null;
  const di = rest.indexOf('doc'); if (di > -1) { doc = rest[di + 1]; rest = rest.slice(0, di); }
  const st = [], sysName = id => (S.catalog.systems.find(s => s.id === id) || {}).name || id;
  if (t === 'reports') {
    if (rest[0] === 'by' && rest.length > 2) st.push({ id: 's-rounds', arg: [0, 0, rest[1], rest[2]], title: rest[2] });
    else if (rest[0]) { st.push({ id: 's-years', arg: rest[0], title: sysName(rest[0]) }); if (rest[1]) st.push({ id: 's-rounds', arg: [rest[0], rest[1]], title: rest[1] }); }
  } else if (t === 'docs') {
    const c = rest[0] === 'k' && S.cats.find(x => x.id === rest[1]); if (c) st.push({ id: 's-kind', arg: c.id, title: c.name });
  } else if (t === 'pm') {
    const j = S.jobs.find(x => x.id === rest[0]);
    if (j) {
      if (saveT && S.job !== j) save();   // ยังมีค่าค้างบันทึกของงานก่อนหน้า → บันทึกก่อนสลับ
      S.job = j; st.push({ id: 's-job', arg: j.id, title: j.title });
      const m = { fill: [pad.matches ? 's-table' : 's-fill', 'เครื่องส่ง'], table: [pad.matches ? 's-table' : 's-fill', 'เครื่องส่ง'], asset: ['s-asset', 'ทะเบียนอุปกรณ์'], tools: ['s-tools', 'เครื่องมือวัด'], folder: ['s-folder', 'โฟลเดอร์งาน'] }[rest[1]];
      if (m && (m[0] !== 's-table' && m[0] !== 's-fill' || j.tx)) st.push({ id: m[0], arg: j.id, title: m[1] });
    }
  }
  const found = doc && (S.docs.find(d => d.id === doc) || S.files.find(d => d.id === doc) || S.templates.find(x => x.code === doc));
  if (found) st.push({ id: 's-view', arg: doc, title: found.title || found.code });
  return { tab: t, chain: [{ id: 's-' + t, title: TITLES[t] }, ...st] };
}
function paint(c, i) {
  const el = $('#' + c.id), a = c.id + JSON.stringify(c.arg), key = a + S.rev + pad.matches;
  if (el.dataset.k === key) return;
  const y = el.dataset.a === a ? el.scrollTop : 0, fresh = !el.classList.contains('on'), sp = $('#strip', el), x = sp ? sp.scrollLeft : 0;
  el.innerHTML = V[c.id.slice(2)](S, c.arg, i ? chain[i - 1].title : null);
  el.dataset.k = key; el.dataset.a = a; el.scrollTop = y; el.classList.toggle('sc', y > tok('collapse-y'));
  if (c.id === 's-fill') stripScroll(fresh, x);
}
function draw() {
  const r = resolve(), changed = r.tab !== lastTab; tab = r.tab; chain = r.chain;
  chain.forEach(paint);
  const ids = chain.slice(1).map(c => c.id), n = ids.length;
  if (changed) app.classList.add('nq');
  $$('.screen').forEach(s => { const k = ids.indexOf(s.id), root = s.classList.contains('root'), on = root ? s.id === 's-' + tab : k > -1;
    s.classList.toggle('on', on); s.classList.toggle('under', on && n > 0 && (root || k < n - 1)); if (k > -1) s.style.zIndex = 2 * (k + 1); });
  $('#dim').style.zIndex = 2 * n - 1; $('#dim').classList.toggle('on', n > 0);
  $$('.tabbar a').forEach((a, i) => TABS[i] === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('.tabbar').classList.remove('mini');
  if (changed) { app.offsetWidth; app.classList.remove('nq'); }
  lastTab = tab; lastHash[tab] = location.hash.split('/doc/')[0];
}
// ลิงก์เก่า: #/home → #/today · #/man → #/docs/k/fm · #/docs/<ระบบ…> (รายงาน) → #/reports/… · #/pm/fill → #/pm/<งานเดิม>/fill · #/me อยู่เหมือนเดิม
function migrate() {
  const h = location.hash; let n = null, m;
  if ((m = h.match(/^#\/home(\/.*)?$/))) n = '#/today' + (m[1] || '');
  else if ((m = h.match(/^#\/man(\/.*)?$/))) n = '#/docs/k/fm';
  else if ((m = h.match(/^#\/docs\/(?!k\/|doc\/)(.+)$/))) n = '#/reports/' + m[1];
  else if ((m = h.match(/^#\/pm\/(fill|table|asset|tools|folder)$/))) n = '#/pm/dm-txs-3-69/' + m[1];
  if (n) history.replaceState(null, '', n);
}
const go = h => { location.hash = h; };
function pop() {
  if (document.activeElement) document.activeElement.blur();
  const p = parts(), di = p.indexOf('doc');
  go('#/' + (di > -1 ? p.slice(0, di) : p[1] === 'by' ? ['reports'] : p.slice(0, -1)).join('/'));
}

// ---------- sheet / toast ----------
let opener = null;
const bg = () => [...app.children].filter(c => !['sheet', 'bd', 'toast'].includes(c.id));
function openSheet(kind, id) {
  opener = document.activeElement; const sh = $('#sheet');
  sh.innerHTML = V.sheet(S, kind, id); sh.classList.add('open'); $('#bd').classList.add('open');
  bg().forEach(c => c.inert = true); sh.setAttribute('tabindex', '-1'); $('.sh-h button', sh).focus();
}
function closeSheet() {
  if (!$('.sheet.open')) return;
  $$('.sheet.open,.bd.open').forEach(x => x.classList.remove('open')); bg().forEach(c => { c.inert = false; });
  if (opener && opener.isConnected) opener.focus(); opener = null;
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
  const j = S.job, k = V.txDoneCount(j);
  $$('.prg').forEach(p => { $('.cap', p).textContent = `${j.cur} จาก ${j.tx.length} · เสร็จ ${k}`; $('.bar3 i', p).style.width = 100 * k / j.tx.length + '%'; });
}
function setVal(n, k, v) {
  const t = S.job.tx[n - 1], f = S.job.fields.find(x => x.k === k); t.v[k] = v; later();
  if (f) { const b = V.bad(f, v); document.activeElement.closest('.fld, td')?.classList.toggle('bad', b); }
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

// ---------- กล้อง / ไฟล์: ย่อรูป แล้วเก็บใน IndexedDB (job เก็บแค่ id) ----------
let camTarget = null;
const slotOf = key => { const [a, b] = key.split('.'), j = S.job; return a === 'folder' ? { o: j.folder.photos[+b], k: 'id' } : a === 'tool' ? { o: j.tools[+b], k: 'photo' } : { o: j.tx[a - 1].photos, k: b }; };
async function shrink(file) {
  const bm = await createImageBitmap(file), r = Math.min(1, tok('photo-max') / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
  c.width = Math.round(bm.width * r); c.height = Math.round(bm.height * r); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(), 'image/jpeg', tok('photo-q')));
}
async function attach(f) {
  let blob = f, id;
  try { if (f.type.startsWith('image/')) blob = await shrink(f); } catch { toast('อ่านรูปไม่ได้ ลองถ่ายใหม่', 'warn'); return; }
  try { id = await photos.put(blob); } catch { toast('เก็บรูปไม่ได้ (พื้นที่เต็มหรือถูกปิดไว้)', 'warn'); return; }
  const j = S.job, isNew = camTarget === 'folder', sl = isNew ? null : slotOf(camTarget), old = isNew ? null : sl.o[sl.k];
  if (isNew) j.folder.photos.push({ name: f.name || 'รูป ' + (j.folder.photos.length + 1), type: blob.type, id }); else sl.o[sl.k] = id;
  if (!save()) {   // บันทึกงานไม่สำเร็จ → ย้อนกลับ ไม่แจ้งว่าสำเร็จ
    if (isNew) j.folder.photos.pop(); else sl.o[sl.k] = old; photos.del(id).catch(() => {}); return;
  }
  S.ph[id] = URL.createObjectURL(blob);
  if (old) { photos.del(old).catch(() => {}); URL.revokeObjectURL(S.ph[old]); delete S.ph[old]; }
  closeSheet(); S.rev++; draw(); toast('บันทึกแล้ว', 'cam');
}
async function removePhoto(key) {
  const sl = slotOf(key), id = sl.o[sl.k], j = S.job;
  if (key.startsWith('folder')) j.folder.photos.splice(+key.split('.')[1], 1); else sl.o[sl.k] = '';
  if (!save()) return;
  photos.del(id).catch(() => {}); URL.revokeObjectURL(S.ph[id]); delete S.ph[id];
  closeSheet(); S.rev++; draw(); toast('ลบแล้ว', 'trash');
}
['#cam', '#file'].forEach(q => $(q).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f && camTarget) attach(f); }));

// ---------- สร้างงานใหม่ (sheet เริ่มงานใหม่) ----------
async function createJob() {
  const sys = S.catalog.systems.find(x => x.id === ($('[data-sys][aria-checked=true]') || {}).dataset?.sys), round = $('#nrd').value.trim(), a = $('#nd1').value, b = $('#nd2').value;
  if (!sys) return toast('เลือกระบบก่อน', 'warn');
  if (!/^\d{1,2}\/\d{2}$/.test(round)) return toast('ใส่ครั้งที่ เช่น 3/69', 'warn');
  if (!a || !b || b < a) return toast('ตรวจช่วงวันที่อีกครั้ง', 'warn');
  const j = await store.newJob(sys, round, [a, b]); if (!j) return toast('พื้นที่เก็บเต็ม — สร้างงานไม่ได้', 'warn', null, 3500);
  S.jobs.push(j); closeSheet(); S.rev++; go('#/pm/' + j.id); toast('สร้างงานแล้ว', 'ok');
}

// ---------- เหตุการณ์ ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-back],.tabbar a,[data-sheet],[data-close],.sw,[data-off-act],[data-pane],[data-toast],[data-cam],[data-m],[data-nx],[data-done],[data-signout],[data-pre],[data-start],[data-sys],[data-create],[data-share],[data-resend],[data-recheck],[data-be],[data-file],[data-photo-del],[data-sel],#bd');
  if (!t) return; const d = t.dataset;
  if (d.pre) { const [k, v] = d.pre.split(':'); if (k === 'cur') { const jb = S.jobs.find(x => x.id === d.pre.split(':')[2]); if (jb) { jb.cur = +v; if (jb === S.job) sched(); else store.putJob(jb); } } else S.ui[k] = v; S.rev++; }
  if (d.start) { const jb = S.jobs.find(x => x.id === d.start); jb.status = 'doing'; jb.touched = new Date().toISOString(); store.putJob(jb); S.rev++; draw(); toast('เริ่มงานแล้ว', 'ok'); }
  else if (d.sys) { $$('[data-sys]').forEach(b => b.setAttribute('aria-checked', b === t)); }
  else if ('create' in d) createJob();
  else if ('resend' in d) { e.preventDefault(); if (real() && !notReady()) store.auth().requestOtp($('#email').value.trim()).then(() => toast('ส่งรหัสอีกครั้งแล้ว', 'ok'), x => toast(errWord(x), 'warn')); else toast(notReady() ? 'ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์' : 'Code sent again (demo)', notReady() ? 'warn' : 'ok'); }
  else if ('recheck' in d) finishLogin(true);
  else if (d.be) { store.setBackend(d.be); store.pref('user', null); location.reload(); }   // เปลี่ยน backend = ล็อกอินใหม่
  else if ('back' in d) { e.preventDefault(); pop(); }
  else if (t.closest('.tabbar')) { e.preventDefault(); const n = TABS[$$('.tabbar a').indexOf(t)]; if (t.closest('.mini')) $('.tabbar').classList.remove('mini'); else go(n === tab ? '#/' + n : lastHash[n] || '#/' + n); }
  else if (d.sheet) { const [k, id] = d.sheet.split(':'); openSheet(k, id); }
  else if (t.id === 'bd' || 'close' in d) closeSheet();
  else if (t.classList.contains('sw')) {
    const on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on); $('span', t).textContent = on ? 'เปิด' : 'ปิด';
    if (d.off) { store.setOffline(d.off, on); S.rev++; draw(); } else if (d.pref) store.pref(d.pref, on);
  }
  else if (d.offAct) { const on = !V.isOff(S, d.offAct); store.setOffline(d.offAct, on); S.rev++; draw(); toast(on ? 'เก็บไว้ดู offline แล้ว' : 'ลบออกจาก offline แล้ว', on ? 'dl' : 'trash'); }
  else if (d.pane) { $$('button', t.parentNode).forEach(b => b.setAttribute('aria-pressed', b === t)); $$(':scope > .pane', $('#' + d.pane).parentNode).forEach(p => { p.hidden = p.id !== d.pane; }); if (/^[pr]-/.test(d.pane)) S.ui[d.pane[0]] = d.pane; }
  else if ('toast' in d) toast(d.toast);
  else if ('cam' in d) { camTarget = d.cam; $('#cam').click(); }
  else if ('file' in d) { camTarget = d.file; $('#file').click(); }
  else if ('photoDel' in d) removePhoto(d.photoDel);
  else if (d.m) setM(+d.m);
  else if (d.nx) nx(+d.nx);
  else if ('done' in d) document.activeElement.blur();
  else if ('signout' in d) { store.signOut().then(() => { history.replaceState(null, '', location.pathname); location.reload(); }); }
  else if ('share' in d) { const u = location.href; navigator.share ? navigator.share({ url: u }).catch(() => {}) : toast('แชร์ยังไม่เปิดใช้ในเบราว์เซอร์นี้'); }
  else if (d.sel && pad.matches) { e.preventDefault(); S.ui.sel = d.sel; S.rev++; draw(); }
});
document.addEventListener('input', e => {
  const i = e.target;
  if (i.dataset.k) setVal(+i.dataset.n, i.dataset.k, i.value);
  else if (i.dataset.filter === 'docs') { const q = i.value.trim().toLowerCase(), r = $('#dres'); $('#dcats').hidden = !!q; r.hidden = !q; if (q) r.innerHTML = V.searchFiles(S, q); }
  else if ('filter' in i.dataset) { const q = i.value.trim().toLowerCase(); $$('.swr,.grp>.row', i.closest('.screen')).forEach(w => { w.hidden = !w.textContent.toLowerCase().includes(q); }); }
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
  if (e.key === 'Escape' && !app.classList.contains('login')) { if ($('.sheet.open')) closeSheet(); else if (chain.length > 1) pop(); }
  if (e.key === 'Enter' && e.target.closest && e.target.closest('#s-fill .fld')) { e.preventDefault(); nx(1); }
});
$('#kbar').addEventListener('pointerdown', e => e.preventDefault());   // ไม่ให้ช่องกรอกเสียโฟกัส
const vv = window.visualViewport;
if (vv) { const kb = () => { const r = document.documentElement.style; r.setProperty('--kbh', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px'); r.setProperty('--kbt', vv.offsetTop + vv.height - tok('kbar-h') + 'px'); }; vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb); }
// ไถลง = dock ย่อ · title ใหญ่ยุบเข้า nav
let sa = 0;
app.addEventListener('scroll', e => {
  const s = e.target.closest && e.target.closest('.screen'); if (!s) return;
  const y = e.target.scrollTop, d = y - (e.target._y || 0); e.target._y = y; s.classList.toggle('sc', y > tok('collapse-y'));
  if (s.id === 's-view') $('#pn', s).textContent = Math.min(+$('.pages', s).dataset.pg, Math.floor(y / ($('.page', s).offsetHeight + 14) + .5) + 1);
  if (!d) return; sa = sa * d > 0 ? sa + d : d; const mini = $('.tabbar').classList;
  // กฎเดียวทุกหน้า: dock ย่อได้เฉพาะหน้าที่เลื่อนได้เกิน --dock-min-scroll (หน้าสั้นไม่ย่อ)
  const long = e.target.scrollHeight - e.target.clientHeight > tok('dock-min-scroll');
  if (!long || y <= tok('slop') || sa < -tok('slop')) mini.remove('mini'); else if (sa > tok('dock-shrink')) mini.add('mini');
}, true);

// ---------- ล็อกอิน (อังกฤษ · ตัวอย่าง): อีเมลบริษัท → รหัส 6 หลัก · demo รับเลข 6 หลักอะไรก็ได้ ----------
const boxes = () => $$('#codeBoxes input');
const real = () => store.backendName() !== 'demo';
const notReady = () => real() && !(CONFIG.supabaseUrl && CONFIG.anonKey);
async function sendCode() {
  const m = $('#email'); if (!m.value.trim() || !m.checkValidity()) { m.reportValidity(); return; }
  if (notReady()) return toast('ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์', 'warn');
  if (real()) { try { await store.auth().requestOtp(m.value.trim()); } catch (e) { return toast(errWord(e), 'warn'); } }
  $('#s-login').classList.add('code'); $('#sentTo').textContent = m.value.trim(); boxes()[0].focus();
}
let busy = false;
async function finishLogin(recheck = false) {
  if (busy) return; busy = true;
  try {
    let u = { name: 'สมหมาย', email: $('#email').value.trim() };
    if (real()) {
      try {
        const em = $('#email').value.trim(), a = store.auth();
        if (!recheck) await a.verifyOtp(em, boxes().map(x => x.value).join(''));
        const p = await a.me(); $('#s-login').classList.toggle('wait', !p.approved);
        if (!p.approved) return;
        u = { name: p.name || p.email, email: p.email }; await load();
      } catch (e) { boxes().forEach(x => { x.value = ''; }); boxes()[0].focus(); return toast(e.code === 'auth' ? 'รหัสไม่ถูกหรือหมดอายุ' : errWord(e), 'warn'); }
    }
    enter(u);
  } finally { busy = false; }
}
function enter(u) {
  store.pref('user', u); S.user = u; app.classList.remove('login'); S.rev++; location.hash.length > 2 ? draw() : go('#/today');
}
// ใส่ตัวเลขหลายตัวตั้งแต่ช่อง n (วาง / autofill "จากข้อความ") → ช่องถัดไปที่ว่าง หรือส่งเมื่อครบ 6
function fillCode(d, n) {
  const b = boxes(); d.split('').slice(0, 6 - n).forEach((c, k) => { b[n + k].value = c; });
  const e = b.find(x => !x.value); if (e) e.focus(); else finishLogin();
}
$('#codeBoxes').addEventListener('input', e => {
  const i = e.target, b = boxes(), n = b.indexOf(i), d = i.value.replace(/\D/g, '');
  if (d.length > 1) fillCode(d, n); else { i.value = d; if (d && b[n + 1]) b[n + 1].focus(); if (b.every(x => x.value)) finishLogin(); }
});
$('#codeBoxes').addEventListener('paste', e => { e.preventDefault(); fillCode((e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6), boxes().indexOf(e.target)); });
$('#codeBoxes').addEventListener('keydown', e => { const b = boxes(), n = b.indexOf(e.target); if (e.key === 'Backspace' && !e.target.value && b[n - 1]) b[n - 1].focus(); });
$('#emailForm').addEventListener('submit', e => { e.preventDefault(); sendCode(); });

// ---------- เริ่มทำงาน ----------
function themeColor() { $('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); }
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', themeColor); themeColor();
const setPad = () => { document.body.classList.toggle('pad', pad.matches); if (S.job) draw(); };
pad.addEventListener('change', setPad); document.body.classList.toggle('pad', pad.matches);
addEventListener('hashchange', () => { migrate(); closeSheet(); draw(); });
initGestures({ app, depth: () => chain.length - 1, top: () => $('#' + chain[chain.length - 1].id), parent: () => $('#' + chain[chain.length - 2].id), pop, closeSheet, setM: n => setM(n, true), cur: () => S.job.cur, refresh, isPad: () => pad.matches });
(async () => {
  const u = store.pref('user'); S.user = u || { name: 'สมหมาย' }; app.classList.toggle('login', !u);
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
