// ZIP reader เล็ก ๆ: central directory + DecompressionStream('deflate-raw') · ไม่รองรับ zip64/เข้ารหัส (ไฟล์ ≤ 25 MB)
const MAX_ENTRY = 60 * 1024 * 1024;
const u16 = (d, o) => d.getUint16(o, true), u32 = (d, o) => d.getUint32(o, true);

export async function unzip(buf) {
  const b = new Uint8Array(buf), d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(d, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ไม่ใช่ไฟล์ ZIP');
  let n = u16(d, e + 10), p = u32(d, e + 16);
  const dec = new TextDecoder(), entries = new Map();
  while (n-- > 0 && u32(d, p) === 0x02014b50) {
    const flag = u16(d, p + 8), method = u16(d, p + 10), csize = u32(d, p + 20), nl = u16(d, p + 28), xl = u16(d, p + 30), cl = u16(d, p + 32), lho = u32(d, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
    entries.set(name, { name, method, csize, lho, flag });
    p += 46 + nl + xl + cl;
  }
  const read = async name => {
    const en = entries.get(name); if (!en) return null;
    if (en.flag & 1) throw new Error('ไฟล์ถูกเข้ารหัส');
    const o = en.lho, start = o + 30 + u16(d, o + 26) + u16(d, o + 28), raw = b.subarray(start, start + en.csize);
    if (en.method === 0) return raw;
    if (en.method !== 8) throw new Error('วิธีบีบอัด ZIP ไม่รองรับ');
    const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    // กัน zip bomb: นับไบต์ที่คลายจริง ไม่เชื่อขนาดในหัวไฟล์
    const rd = s.getReader(), parts = []; let total = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; total += value.length; if (total > MAX_ENTRY) { rd.cancel(); throw new Error('ไฟล์ข้างใน ZIP ใหญ่ผิดปกติ'); } parts.push(value); }
    return new Uint8Array(await new Blob(parts).arrayBuffer());
  };
  return { names: [...entries.keys()], has: n => entries.has(n), read, text: async n => { const r = await read(n); return r && dec.decode(r); } };
}

export const xml = s => new DOMParser().parseFromString(s, 'application/xml');   // ไม่ eval · ไม่โหลด external entity
