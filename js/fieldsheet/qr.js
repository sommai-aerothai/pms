// QR encoder เล็ก ๆ (byte mode · ECC M · version 1–10 · เลือก mask เอง) · ส่งออก encodeQR(text) → boolean[][]
// ponytail: ไม่รองรับ >10 version (≈ 213 ไบต์) — payload ใบจดค่าสั้นกว่านั้นมาก
const ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], BLK = [1, 1, 2, 2, 4, 4, 4, 5, 5, 5];
const bit = (x, i) => (x >>> i) & 1;
const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = (v / 7 | 0) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataWords = v => (rawModules(v) >> 3) - ECC[v - 1] * BLK[v - 1];
const mul = (a, b) => { let r = 0; for (let i = 7; i >= 0; i--) { r = (r << 1) ^ ((r >>> 7) * 0x11d); r ^= ((b >>> i) & 1) * a; } return r; };
function rs(data, deg) {
  const g = new Array(deg).fill(0); g[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { g[j] = mul(g[j], root); if (j + 1 < deg) g[j] ^= g[j + 1]; } root = mul(root, 2); }
  const r = new Array(deg).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); g.forEach((c, i) => { r[i] ^= mul(c, f); }); }
  return r;
}
export function encodeQR(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1; while (ver <= 10 && bytes.length + 2 + (ver > 9) > dataWords(ver)) ver++;
  if (ver > 10) throw new Error('QR: ข้อความยาวเกิน');
  const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push(bit(v, i)); };
  put(4, 4); put(bytes.length, ver > 9 ? 16 : 8); bytes.forEach(b => put(b, 8));
  const cap = dataWords(ver) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < dataWords(ver); pad ^= 0xec ^ 0x11) data.push(pad);
  // แบ่งบล็อก + RS + interleave
  const nb = BLK[ver - 1], eb = ECC[ver - 1], raw = rawModules(ver) >> 3, short = nb - raw % nb, sl = (raw / nb | 0) - eb;
  const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + sl + (i < short ? 0 : 1)); k += d.length; blocks.push([d, rs(d, eb)]); }
  const out = [];
  for (let i = 0; i <= sl; i++) blocks.forEach(([d], j) => { if (i < sl || j >= short) out.push(d[i]); });
  for (let i = 0; i < eb; i++) blocks.forEach(([, e]) => out.push(e[i]));
  // เมทริกซ์
  const n = ver * 4 + 17, m = [], fn = [];
  for (let y = 0; y < n; y++) { m.push(new Array(n).fill(false)); fn.push(new Array(n).fill(false)); }
  const set = (x, y, d) => { m[y][x] = !!d; fn[y][x] = true; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  if (ver > 1) {
    const na = (ver / 7 | 0) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
    for (let p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
    pos.forEach((cx, i) => pos.forEach((cy, j) => { if (!((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0))) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  }
  const format = mask => {
    const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);   // ECC M = 00
    const b = (d << 10 | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i)); set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(b, i));
    set(8, n - 8, true);
  };
  format(0);
  if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = ver << 12 | r; for (let i = 0; i < 18; i++) { const a = n - 11 + i % 3, c = i / 3 | 0; set(a, c, bit(b, i)); set(c, a, bit(b, i)); } }
  // วางข้อมูลแบบซิกแซก
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - v : v;
      if (!fn[y][x] && i < out.length * 8) { m[y][x] = !!bit(out[i >>> 3], 7 - (i & 7)); i++; }
    }
  }
  const MASK = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => ((x / 3 | 0) + (y / 2 | 0)) % 2 === 0,
    (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const penalty = g => {   // N1 (แถว/คอลัมน์ซ้ำ) + N2 (บล็อก 2×2) + N4 (สมดุลสี) ; ข้าม N3
    let p = 0, dark = 0;
    for (let a = 0; a < n; a++) for (const t of [0, 1]) { let run = 1; for (let b = 1; b <= n; b++) { const c = b < n && (t ? g[b][a] : g[a][b]) === (t ? g[b - 1][a] : g[a][b - 1]); if (c) run++; else { if (run >= 5) p += run - 2; run = 1; } } }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (g[y][x]) dark++; if (x < n - 1 && y < n - 1 && g[y][x] === g[y][x + 1] && g[y][x] === g[y + 1][x] && g[y][x] === g[y + 1][x + 1]) p += 3; }
    return p + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  };
  let best = null, bm = 0, bp = 1e9;
  for (let k = 0; k < 8; k++) {
    const g = m.map((row, y) => row.map((v, x) => v !== (!fn[y][x] && MASK[k](x, y))));
    const p = penalty(g); if (p < bp) { bp = p; best = g; bm = k; }
  }
  best.forEach((r, y) => r.forEach((v, x) => { m[y][x] = v; })); format(bm);
  return m;
}
