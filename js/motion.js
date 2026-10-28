// จังหวะเคลื่อนไหว: thumb เลื่อนใต้ปุ่มที่เลือก · สไลด์สลับแท็บ · stagger/collapse แถวรายการ · นับเลข/แถบ · ขอบจางแถบชิป
// ทุกค่าอ่านจาก token (ui/tokens.css) · reduced-motion = ไม่ขยับ (เรียกฟังก์ชันแล้วคืนทันที)
import { tok, tokRaw } from './tok.js';
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)'), ms = n => tok(n) * 1000;
const prev = new Map();   // ค่าเดิมของตัวเลข/แถบ (คีย์ = หน้า+ลำดับ) ไว้เล่นนับขึ้นหลังวาดหน้าใหม่

// thumb: องค์ประกอบเดียวต่อ control (seg / dock) เลื่อน+ขยายไปหาปุ่มที่เลือก — วางครั้งแรกไม่เล่นอนิเมชัน
function thumb(c) {
  let t = c.querySelector(':scope>.thumb');
  if (!t) { t = document.createElement('span'); t.className = 'thumb'; t.setAttribute('aria-hidden', 'true'); c.prepend(t); }
  const b = c.querySelector(':scope>[aria-pressed=true],:scope>[aria-current]');
  if (!b || !b.offsetWidth) return;
  const first = !t.dataset.on, s = t.style; t.dataset.on = 1; t.classList.toggle('nt', first);
  s.setProperty('--tx', b.offsetLeft + 'px'); s.setProperty('--ty', b.offsetTop + 'px'); s.setProperty('--tw', b.offsetWidth + 'px'); s.setProperty('--th', b.offsetHeight + 'px');
  if (first) { t.offsetWidth; requestAnimationFrame(() => t.classList.remove('nt')); }
}
const fade = s => { s.classList.toggle('fl', s.scrollLeft > 1); s.classList.toggle('fr', s.scrollLeft + s.clientWidth < s.scrollWidth - 1); };

// เลขนับขึ้น + แถบ progress: เล่นเมื่อค่าเปลี่ยนจากที่เห็นครั้งก่อน
function counts(root) {
  $$('.cnt,.bar2 i,.bar3 i', root).forEach((e, i) => {
    const sc = e.closest('.screen'), bar = e.tagName === 'I', v = bar ? parseFloat(e.style.width) || 0 : +e.dataset.v;
    const k = `${sc ? sc.id + (sc.dataset.a || '') : ''}|${e.tagName}${e.className}|${i}`, old = prev.get(k); prev.set(k, v);
    if (old === undefined || old === v || RM.matches) return;
    if (bar) { e.style.transition = 'none'; e.style.width = old + '%'; e.offsetWidth; e.style.transition = ''; e.style.width = v + '%'; return; }
    const t0 = performance.now(), d = ms('dur-count');
    (function f(n) { const p = Math.min(1, (n - t0) / d); e.textContent = Math.round(old + (v - old) * p); if (p < 1) requestAnimationFrame(f); })(t0);
  });
}
export function sync(root = document) {
  $$('.seg,.tabbar', root).forEach(thumb); $$('.strip', root).forEach(fade); counts(root);
  const n = $$('[data-new]', root); if (n.length) { stagger(n); n.forEach(x => x.removeAttribute('data-new')); }
}
// แถวใหม่/ผลค้นหาเลื่อนขึ้น+จางเข้าทีละแถว (สูงสุด --stagger-max แถว)
export function stagger(rows) {
  if (RM.matches) return;
  rows.slice(0, tok('stagger-max')).forEach((r, i) => r.animate([{ opacity: 0, transform: `translateY(${tok('space-2')}px)` }, { opacity: 1, transform: 'none' }], { duration: ms('dur-quick'), delay: i * tok('stagger-ms'), easing: tokRaw('ease'), fill: 'backwards' }));
}
// แถวที่ลบ: ยุบความสูงแล้วค่อยทำจริง
export function collapse(el, done) {
  if (RM.matches || !el) return done();
  const h = el.offsetHeight; el.style.overflow = 'hidden';
  el.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: ms('dur-quick'), easing: tokRaw('ease') }).finished.then(done, done);
}
// สลับแท็บ: หน้าใหม่สไลด์เข้าจากด้านที่ลำดับแท็บมากกว่า · หน้าเก่าเลื่อนออก --tab-out แล้วจาง
export function tabSwitch(from, to, dir) {
  if (RM.matches || !from || !to || from === to) return;
  const o = { duration: ms('dur-tab'), easing: tokRaw('ease') };
  from.style.display = 'block'; from.style.zIndex = 0; to.style.zIndex = 1;
  to.animate([{ transform: `translateX(${dir * tok('tab-in')}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], o);
  const b = from.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * tok('tab-out')}%)`, opacity: 0 }], { ...o, fill: 'forwards' });
  b.finished.then(() => { from.style.display = from.style.zIndex = to.style.zIndex = ''; b.cancel(); }, () => {});
}
export function init(app) {
  const again = () => requestAnimationFrame(() => sync());
  document.addEventListener('click', again); addEventListener('resize', again);
  app.addEventListener('transitionend', e => e.target.classList.contains('tabbar') && sync());
  app.addEventListener('scroll', e => e.target.classList && e.target.classList.contains('strip') && fade(e.target), true);
  document.addEventListener('contextmenu', e => e.target.closest && e.target.closest('.swr .row') && e.preventDefault());
}
