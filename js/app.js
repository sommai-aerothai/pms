// PMS · router (hash) + shell + เหตุการณ์ · หน้าจอจริงอยู่ใน views.js · ท่าทางอยู่ใน gestures.js
import * as store from './store.js';
import * as V from './views.js';
import { initGestures } from './gestures.js';
import * as photos from './photos.js';
import { tok } from './tok.js';
import * as M from './motion.js';
import { CONFIG } from './config.js';

const VERSION = 'v0.6';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), TABS = ['today', 'pm', 'docs', 'me'];
const TITLES = { today: 'วันนี้', pm: 'งาน PM', docs: 'เอกสาร', me: 'ฉัน' };
const S = { ph: {}, rev: 0, ui: {}, wait: new Set(), seen: new Set(), version: VERSION, user: null, docs: [], templates: [], catalog: null, cats: [], files: [], jobs: [], job: null };
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
const errWord = e => ({ auth: 'ต้องเข้าสู่ระบบใหม่', server: 'เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง', conflict: 'มีคนแก้งานนี้ก่อน โหลดใหม่แล้วลองอีกครั้ง', offline: 'ออฟไลน์อยู่', invalid: 'ข้อมูลไม่ถูกต้อง', notfound: 'ไม่พบข้อมูล', throttled: 'ระบบยุ่ง ลองใหม่อีกครั้ง' }[e.code] || 'เกิดข้อผิดพลาด');
async function refresh() {
  try { [S.docs, S.templates, S.cats] = [(await store.listDocs()).items, await store.listTemplates(), await store.getFiles()]; S.files = S.cats.flatMap(c => c.rows); if (saveT) save();   /* บันทึกค่าค้างก่อน ไม่งั้นโหลดทับของเก่า */ const cur = S.job && S.job.id; S.jobs = await store.listJobs(); S.job = S.jobs.find(j => j.id === cur) || V.recent(S) || S.jobs[0]; S.rev++; draw(); toast('รีเฟรชแล้ว', 'ok'); }
  catch (e) { toast(errWord(e), 'warn'); }
}

// ---------- router: hash → {tab, stack} ----------
const parts = () => decodeURIComponent(location.hash).replace(/^#\/?/, '').split('/').filter(Boolean);
function resolve() {
  let p = parts(); if (!TABS.includes(p[0])) p = ['today'];
  const t = p[0]; let rest = p.slice(1), doc = null;
  const di = rest.indexOf('doc'); if (di > -1) { doc = rest[di + 1]; rest = rest.slice(0, di); }
  const st = [], sysName = id => (S.catalog.systems.find(s => s.id === id) || {}).name || id;
  if (t === 'docs' && rest[0] === 'reports') {   // เอกสาร › รายงาน › ระบบ/ปี › รอบ
    const r = rest.slice(1); st.push({ id: 's-reports', title: 'รายงาน' });
    if (r[0] === 'by' && r.length > 2) st.push({ id: 's-rounds', arg: [0, 0, r[1], r[2]], title: r[2] });
    else if (r[0]) { st.push({ id: 's-years', arg: r[0], title: sysName(r[0]) }); if (r[1]) st.push({ id: 's-rounds', arg: [r[0], r[1]], title: r[1] }); }
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
  lastTab = tab; lastHash[tab] = location.hash.split('/doc/')[0];
}
// ลิงก์เก่า: #/home → #/today · #/man → #/docs/k/fm · #/reports/… และ #/docs/<ระบบ…> (รายงาน) → #/docs/reports/… · #/pm/fill → #/pm/<งานเดิม>/fill · #/me อยู่เหมือนเดิม
function migrate() {
  const h = location.hash; let n = null, m;
  if ((m = h.match(/^#\/home(\/.*)?$/))) n = '#/today' + (m[1] || '');
  else if ((m = h.match(/^#\/man(\/.*)?$/))) n = '#/docs/k/fm';
  else if ((m = h.match(/^#\/reports(\/.*)?$/))) n = '#/docs/reports' + (m[1] || '');
  else if ((m = h.match(/^#\/docs\/(?!k\/|doc\/|reports(\/|$))(.+)$/))) n = '#/docs/reports/' + m[1];
  else if ((m = h.match(/^#\/pm\/(fill|table|asset|tools|folder)$/))) n = '#/pm/dm-txs-1-70/' + m[1];
  if (n) history.replaceState(null, '', n);
}
const go = h => { location.hash = h; };
function pop() {
  if (document.activeElement) document.activeElement.blur();
  const p = parts(), di = p.indexOf('doc');
  go('#/' + (di > -1 ? p.slice(0, di) : p[2] === 'by' ? p.slice(0, 2) : p.slice(0, -1)).join('/'));
}

// ---------- sheet / toast ----------
let opener = null;
const bg = () => [...app.children].filter(c => !['sheet', 'bd', 'toast'].includes(c.id));
function openSheet(kind, id, html) {
  opener = document.activeElement; const sh = $('#sheet');
  sh.innerHTML = html ?? V.sheet(S, kind, id); M.sync(sh); sh.classList.add('open'); $('#bd').classList.add('open');
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
  $$('.prg').forEach(p => { $('.cap', p).innerHTML = `${j.cur} จาก ${j.tx.length} · เสร็จ <span class="cnt" data-v="${k}">${k}</span>`; $('.bar3 i', p).style.width = 100 * k / j.tx.length + '%'; });
  M.sync($('#s-fill,#s-table', document) || document);
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
  const sys = S.catalog.systems.find(x => x.id === ($('[data-sys][aria-checked=true]') || {}).dataset?.sys), a = $('#nd1').value, b = $('#nd2').value, rd = ($('[data-rd][aria-pressed=true]') || {}).dataset?.rd;
  if (!sys) return toast('เลือกระบบก่อน', 'warn');
  if (!a || !b || b < a) return toast('ตรวจช่วงวันที่อีกครั้ง', 'warn');
  const round = `${rd}/${String(V.fiscal(a).fy).slice(2)}`;   // ครั้งที่ที่เลือก + ปีงบฯ ของวันเริ่มงาน
  const j = await store.newJob(sys, round, [a, b]); if (!j) return toast('พื้นที่เก็บเต็ม — สร้างงานไม่ได้', 'warn', null, 3500);
  S.jobs.push(j); S.ui.added = j.id; closeSheet(); S.rev++; go('#/pm/' + j.id); toast('สร้างงานแล้ว', 'ok');
}

// ปัดแถวงาน: ลบ (ยังไม่เริ่ม) / ปิดงาน (กำลังทำ) — ตัวอย่างสำหรับ demo
function jobAct(id) {
  const jb = S.jobs.find(x => x.id === id); if (!jb) return;
  if (jb.status === 'todo') M.collapse($(`[data-job-act="${id}"]`)?.closest('.swr'), () => { store.dropJob(id); S.jobs = S.jobs.filter(x => x !== jb); if (S.job === jb) S.job = V.recent(S) || S.jobs[0]; S.rev++; draw(); toast('ลบงานแล้ว', 'trash'); });
  else { jb.status = 'done'; jb.touched = new Date().toISOString(); store.putJob(jb); S.rev++; draw(); toast('ปิดงานแล้ว', 'ok'); }
}

// ---------- CTA ลอยเหนือ dock: ปุ่มเดียวทุกหน้า · กว้างเท่ากันหมด (วัดจากป้ายที่กว้างสุดครั้งเดียว) ----------
const CTA = { new: ['plus', 'เริ่มงานใหม่'], newReport: ['doc', 'ออกรายงานใหม่'], start: ['ok', 'เริ่มงาน'], report: ['doc', 'ออกรายงาน'] };
const ctaHtml = (i, t) => `${V.ic(i)}<span>${t}</span>`;
function measureCta() {
  const m = $('#cta').cloneNode(), n = Math.max(10, ...S.jobs.map(j => j.forms.length)), labels = [...Object.values(CTA).map(x => x.slice()), ['clip', `ตรวจความพร้อม · ${n}/${n}`]];
  m.removeAttribute('id'); m.hidden = false; m.style.cssText = 'position:absolute;display:flex;visibility:hidden;width:auto;left:0;transform:none;max-width:none';
  app.append(m);
  const w = Math.ceil(Math.max(...labels.map(([i, t]) => { m.innerHTML = ctaHtml(i, t); return m.getBoundingClientRect().width; })));
  m.remove(); document.documentElement.style.setProperty('--cta-w', w + 'px');
}
let ctaMeasured = false;
function drawCta() {
  const top = chain[chain.length - 1], el = $('#cta'), j = top.id === 's-job' && S.jobs.find(x => x.id === top.arg);
  const c = top.id === 's-pm' ? ['new', ...CTA.new] : top.id === 's-reports' ? ['new', ...CTA.newReport] : j ? V.jobCta(j) : null;
  app.classList.toggle('cta-on', !!c); el.hidden = !c;
  if (!c) return;
  el.dataset.act = c[0]; el.innerHTML = ctaHtml(c[1], c[2]);
  if (!ctaMeasured) { ctaMeasured = true; (document.fonts ? document.fonts.ready : Promise.resolve()).then(measureCta); }
}
function ctaGo() {
  const a = $('#cta').dataset.act;
  if (a === 'new') openSheet('new', '');
  else if (a === 'ready') openSheet('ready');
  else if (a === 'report') toast('ออกรายงานทำในขั้น 2');
  else if (a === 'start') { S.job.status = 'doing'; S.job.touched = new Date().toISOString(); store.putJob(S.job); S.rev++; draw(); toast('เริ่มงานแล้ว', 'ok'); }
}

// ---------- เหตุการณ์ ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-back],.tabbar a,[data-sheet],[data-close],.sw,[data-off-act],[data-pane],[data-toast],[data-cam],[data-m],[data-nx],[data-done],[data-signout],[data-pre],[data-start],[data-sys],[data-job-act],[data-rd],[data-web],#cta,[data-create],[data-share],[data-peek],[data-pw-save],[data-recheck],[data-be],[data-file],[data-photo-del],[data-sel],#bd');
  if (!t) return; const d = t.dataset;
  if (d.pre) { const [k, v] = d.pre.split(':'); if (k === 'cur') { const jb = S.jobs.find(x => x.id === d.pre.split(':')[2]); if (jb) { jb.cur = +v; if (jb === S.job) sched(); else store.putJob(jb); } } else S.ui[k] = v; S.rev++; }
  if (t.id === 'cta') ctaGo();
  else if ('web' in d) { S.ui.webClosed = !S.ui.webClosed; t.setAttribute('aria-expanded', !S.ui.webClosed); $('#dcats').hidden = S.ui.webClosed; }
  else if (d.rd) $$('[data-rd]').forEach(b => b.setAttribute('aria-pressed', b === t));
  else if (d.sys) { $$('[data-sys]').forEach(b => b.setAttribute('aria-checked', b === t)); }
  else if ('create' in d) createJob();
  else if ('peek' in d) { const i = $('input', t.parentNode), on = i.type === 'password'; i.type = on ? 'text' : 'password'; t.setAttribute('aria-pressed', on); t.setAttribute('aria-label', on ? 'Hide password' : 'Show password'); $('use', t).setAttribute('href', `./ui/icons.svg#i-${on ? 'eyeoff' : 'eye'}`); }
  else if ('pwSave' in d) savePassword();
  else if ('recheck' in d) finishLogin(true);
  else if (d.be) { store.setBackend(d.be); store.pref('user', null); location.reload(); }   // เปลี่ยน backend = ล็อกอินใหม่
  else if ('back' in d) { e.preventDefault(); pop(); }
  else if (t.closest('.tabbar')) { e.preventDefault(); const n = TABS[$$('.tabbar a').indexOf(t)]; if (t.closest('.mini')) $('.tabbar').classList.remove('mini'); else if (n === tab) { const sc = $('#' + chain[chain.length - 1].id); if (sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); else if (chain.length > 1) go('#/' + n); } else go(lastHash[n] || '#/' + n); }
  else if (d.sheet) { const [k, id] = d.sheet.split(':'); openSheet(k, id); }
  else if (t.id === 'bd' || 'close' in d) closeSheet();
  else if (t.classList.contains('sw')) {
    const on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on); $('span', t).textContent = on ? 'เปิด' : 'ปิด';
    if (d.off) { store.setOffline(d.off, on); S.rev++; draw(); } else if (d.pref) store.pref(d.pref, on);
  }
  else if (d.jobAct) { closeSheet(); jobAct(d.jobAct); }
  else if (d.offAct) { closeSheet(); const on = !V.isOff(S, d.offAct); store.setOffline(d.offAct, on); S.rev++; draw(); toast(on ? 'เก็บไว้ดู offline แล้ว' : 'ลบออกจาก offline แล้ว', on ? 'dl' : 'trash'); }
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
  if (e.key === 'Escape' && !app.classList.contains('login')) { if ($('.sheet.open')) closeSheet(); else if (chain.length > 1) pop(); }
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
  if (s.id === 's-view') $('#pn', s).textContent = Math.min(+$('.pages', s).dataset.pg, Math.floor(y / ($('.page', s).offsetHeight + 14) + .5) + 1);
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
    let u = { name: 'สมหมาย', email: raw };
    if (real()) {
      if (notReady()) return loginErr(LOGIN_ERR.server);
      const em = raw.includes('@') ? raw : raw + '@aerothai.co.th', pw = pwRaw;   // พิมพ์ sommai.sa = sommai.sa@aerothai.co.th
      try {
        const a = store.auth();
        if (!recheck) { await a.signIn(em, pw); $('#pass').value = ''; $('#pass').type = 'password'; }   // ไม่ให้รหัสผ่านค้างในช่อง
        const p = await a.me(); $('#s-login').classList.toggle('wait', !p.approved);
        if (!p.approved) return;
        u = { name: p.name || p.email, email: p.email }; await load();
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
