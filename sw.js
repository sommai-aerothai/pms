// cache-first สำหรับไฟล์แอป · network-first สำหรับข้อมูล (/api/ /data/) · เปลี่ยน VERSION ทุกครั้งที่แก้ไฟล์
const VERSION = 'pms-v0.7.1';
const FILES = ['./', './index.html', './manifest.webmanifest', './ui/tokens.css', './ui/base.css', './ui/icons.svg',
  './js/app.js', './js/views.js', './js/gestures.js', './js/store.js', './js/photos.js', './js/tok.js', './js/motion.js', './js/config.js', './js/import-sarabun.js', './bookmarklet/sarabun-to-pms.js', './js/backend/supabase.js', './js/backend/demo.js', './js/backend/sharepoint.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

FILES.push('./js/readers/index.js', './js/readers/zip.js', './js/readers/xlsx.js', './js/readers/forms.js', './js/readers/docx.js', './js/readers/text.js', './js/readers/pdf.js', './js/readers/image.js');   // file readers (lazy: vendor/pdfjs + vendor/tesseract โหลดเมื่อใช้ ไม่ precache)
FILES.push('./fieldsheet.html', './js/fieldsheet/layout.js', './js/fieldsheet/print.js', './js/fieldsheet/qr.js', './js/fieldsheet/read.js', './js/fieldsheet/vision.js', './js/fieldsheet/digits.js', './js/fieldsheet/digits.bin', './js/fieldsheet/official.js', './js/fieldsheet/layouts/fm202-v1.json', './js/fieldsheet/layouts/fm202-official.json', './vendor/jsqr/jsQR.js');   // ใบจดค่าหน้างาน (อ่านออฟไลน์ได้)
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
