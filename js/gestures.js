// ท่าทาง: ปัดขอบซ้ายย้อนกลับ · ลากปิด sheet · ปัดแถวเปิดปุ่ม · ดึงเพื่อรีเฟรช · ปัดการ์ดเปลี่ยนเครื่อง
// ctx: {app, depth(), top(), parent(), pop(), closeSheet(), setM(n), cur(), refresh(), isPad()} · ตัวเลขทุกตัวอ่านจาก token
import { tok } from './tok.js';
export function initGestures(ctx) {
  const { app } = ctx, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let g = null, sup = 0;
  const bd = $('#bd'), dim = $('#dim');
  document.addEventListener('pointerdown', e => {
    g = null;
    if (!e.isPrimary || app.classList.contains('login') || !app.contains(e.target)) return;
    const t = e.target, n = ctx.depth(), gr = t.closest('.grab,.sh-h'), w = t.closest('.swr'), b = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const s = t.closest('#s-docs'), cd = t.closest('#s-fill') && !t.closest('.strip-w,button,input');
    if (gr && !t.closest('button')) { b.k = 'sh'; b.el = gr.closest('.sheet'); }
    else if ($('.sheet.open')) return;
    else if (n && e.clientX <= tok('edge-w') && !t.closest('input,textarea,select,.sw,.cam')) { b.k = 'bk'; b.top = ctx.top(); b.par = ctx.parent(); }
    else {
      if (w && t.closest('.row')) b.w = w;
      const pr = s && !ctx.isPad() && !n && s.scrollTop <= 0 && s.querySelector('.ptr');
      if (pr && !pr.classList.contains('spin')) b.pr = pr;
      if (cd) b.cd = 1;
      if (!b.w && !b.pr && !b.cd) return;
    }
    g = b;
  });
  document.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y, slop = tok('slop'), sw = tok('swipe-w');
    let k = g.k;
    if (!k) {
      if (Math.abs(dx) > slop && g.w) k = g.k = 'row';
      else if (dy > slop && Math.abs(dx) < dy && g.pr) k = g.k = 'pr';
      else if (Math.abs(dx) > slop && Math.abs(dx) > Math.abs(dy) && g.cd) k = g.k = 'cd';
      else { if (Math.abs(dx) > slop || Math.abs(dy) > slop) g = null; return; }
      if (k === 'row') { $$('.swr.open').forEach(o => o !== g.w && o.classList.remove('open')); g.base = g.w.classList.contains('open') ? -sw : 0; g.r = g.w.querySelector('.row'); g.r.style.transition = 'none'; }
      else if (k === 'pr') g.pr.style.transition = 'none';
    }
    g.dx = dx; g.dy = dy;
    if (k === 'bk') { const p = Math.max(0, Math.min(1, dx / innerWidth)); app.classList.add('nq'); g.top.style.transform = `translateX(${p * 100}%)`; g.par.style.transform = `translateX(${-30 * (1 - p)}%)`; dim.style.opacity = tok('opacity-dim') * (1 - p); }
    else if (k === 'sh') { const p = Math.max(0, dy); app.classList.add('nq'); g.el.style.transform = `translateY(${p}px)`; bd.style.opacity = 1 - p / g.el.offsetHeight; }
    else if (k === 'row') { g.tx = Math.max(-sw * 1.15, Math.min(0, g.base + dx)); g.r.style.transform = `translateX(${g.tx}px)`; }
    else if (k === 'pr') { g.pr.style.height = Math.min(Math.max(0, dy) * .5, tok('ptr-max')) + 'px'; g.pr.querySelector('span').textContent = dy > tok('ptr-go') ? 'ปล่อยเพื่อรีเฟรช' : 'ดึงเพื่อรีเฟรช'; }
  });
  // cancel = iOS ยกเลิกท่าทาง → คืนตำแหน่งเดิมอย่างเดียว ไม่ย้อนหน้า/ปิด sheet/เปลี่ยนเครื่อง
  const end = (e, cancel) => {
    if (!g || e.pointerId !== g.id) return;
    const { k, dx = 0, dy = 0, pr: q } = g; g.id = -1;
    if (k) { app.classList.remove('nq'); sup = 1; setTimeout(() => sup = 0, 60); }
    if (k === 'bk') { [g.top, g.par, dim].forEach(x => { x.style.transform = x.style.opacity = ''; }); if (!cancel && dx / innerWidth > 1 / 3) ctx.pop(); }
    else if (k === 'sh') { g.el.style.transform = bd.style.opacity = ''; if (!cancel && dy > tok('sheet-dismiss')) ctx.closeSheet(); }
    else if (k === 'row') { g.r.style.transition = g.r.style.transform = ''; g.w.classList.toggle('open', !cancel && g.tx < -tok('swipe-open')); }
    else if (k === 'cd') { if (!cancel && Math.abs(dx) > tok('card-swipe')) ctx.setM(ctx.cur() + (dx < 0 ? 1 : -1)); }
    else if (k === 'pr') {
      q.style.transition = '';
      if (!cancel && dy > tok('ptr-go')) { q.classList.add('spin'); q.querySelector('span').textContent = 'กำลังรีเฟรช…'; q.style.height = tok('ptr-open') + 'px';
        Promise.all([ctx.refresh(), new Promise(r => setTimeout(r, tok('refresh-ms')))]).finally(() => { q.classList.remove('spin'); q.style.height = ''; }); }
      else q.style.height = '';
    }
    g = null;
  };
  document.addEventListener('pointerup', e => end(e, false)); document.addEventListener('pointercancel', e => end(e, true));
  document.addEventListener('click', e => {
    const o = $('.swr.open');
    if (sup) { e.stopPropagation(); e.preventDefault(); return; }
    if (o && !e.target.closest('.swa')) { o.classList.remove('open'); if (e.target.closest('.row')) { e.stopPropagation(); e.preventDefault(); } }
  }, true);
}
