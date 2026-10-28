// รูปทรงใบจดค่า: อ่านจาก layouts/<id>.json (หน่วย mm) ที่เดียว · ทั้งตัวพิมพ์ (print.js) และตัวอ่าน (read.js) ใช้ฟังก์ชันนี้
export const layoutUrl = id => new URL(`./layouts/${id}.json`, import.meta.url).href;
const cache = {};
export async function loadLayout(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('layout id ไม่ถูกต้อง');
  return cache[id] ||= fetch(layoutUrl(id)).then(r => { if (!r.ok) throw new Error('ไม่พบ layout ' + id); return r.json(); });
}
export const rowTop = (L, r) => L.rows.y0 + r * L.rows.pitch;
// ช่อง/วงกลม/ของที่พิมพ์ไว้ ของแถว r · t: b=ช่องตัวเลข p/m=วงกลม +/− · '.' '-' = พิมพ์ไว้แล้ว
export function cells(L, r) {
  const out = [], top = rowTop(L, r);
  for (const f of L.fields) {
    let x = f.x0, i = 0;
    for (const t of f.parts) {
      const w = L.partW[t];
      if (t === 'b') out.push({ field: f.id, i: i++, t, x, y: top + L.box.dy, w: L.box.w, h: L.box.h });
      else if (t === 'p' || t === 'm') out.push({ field: f.id, i: i++, t, x: x + (w - L.circle.d) / 2, y: top + (L.rows.pitch - L.circle.d) / 2, w: L.circle.d, h: L.circle.d });
      else out.push({ field: f.id, t, x, y: top + L.box.dy, w, h: L.box.h });
      x += w;
    }
  }
  return out;
}
