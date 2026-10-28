// รูป/ไฟล์ของงาน เก็บใน IndexedDB (ไม่ใช้ localStorage) · job เก็บแค่ id
const open = () => new Promise((ok, no) => {
  const r = indexedDB.open('pms-photos', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('p');
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (mode, fn) => { const db = await open(); return new Promise((ok, no) => { const t = db.transaction('p', mode), q = fn(t.objectStore('p')); t.oncomplete = () => { db.close(); ok(q.result); }; t.onerror = t.onabort = () => { db.close(); no(t.error); }; }); };
export const put = async blob => { const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await tx('readwrite', s => s.put(blob, id)); return id; };
export const del = id => tx('readwrite', s => s.delete(id));
export const get = id => tx('readonly', s => s.get(id));
export const wipe = () => new Promise(ok => { const r = indexedDB.deleteDatabase('pms-photos'); r.onsuccess = r.onerror = r.onblocked = () => ok(); });
