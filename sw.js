// cache-first สำหรับไฟล์แอป · network-first สำหรับข้อมูล (/api/ /data/) · เปลี่ยน VERSION ทุกครั้งที่แก้ไฟล์
const VERSION = 'pms-v0.6.1';
const FILES = ['./', './index.html', './manifest.webmanifest', './ui/tokens.css', './ui/base.css', './ui/icons.svg',
  './js/app.js', './js/views.js', './js/gestures.js', './js/store.js', './js/photos.js', './js/tok.js', './js/motion.js', './js/config.js', './js/backend/supabase.js', './js/backend/demo.js', './js/backend/sharepoint.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

// precache ด้วย cache:'reload' — ข้าม HTTP cache ของเบราว์เซอร์/CDN ไม่งั้นเวอร์ชันใหม่จะเก็บไฟล์เก่าไว้ใต้ชื่อใหม่
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))));   // ไม่ skipWaiting เอง: รอผู้ใช้แตะ toast
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pms-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(api|data)\//.test(u.pathname)) {
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); e.waitUntil(caches.open(VERSION).then(c => c.put(r, cp))); }   // เก็บเฉพาะคำตอบ ok
      return res;
    }).catch(() => caches.match(r)));
  } else e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
