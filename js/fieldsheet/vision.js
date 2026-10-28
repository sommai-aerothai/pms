// เครื่องมือภาพล้วน ๆ (ไม่พึ่ง DOM) : homography · สุ่มตัดช่อง · Otsu · connected components · normalise 28×28 แบบ MNIST
export function solveH(src, dst) {   // 4 จุด src→dst คืน h[8] (h8=1)
  const A = [];
  for (let i = 0; i < src.length; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < A.length; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < A.length; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.slice(0, n).map((r, i) => r[n] / r[i]);
}
export const applyH = (h, x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
export const scaleAt = (h, x, y) => { const a = applyH(h, x, y), b = applyH(h, x + 1, y), c = applyH(h, x, y + 1); return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 2; };   // px ต่อ mm

export function toGray(id) {
  const { data, width: w, height: h } = id, g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  return { g, w, h };
}
const bil = (G, x, y) => {
  const { g, w, h } = G; x -= 0.5; y -= 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (i, j) => g[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
};
// ตัดสี่เหลี่ยม (mm ในเลย์เอาต์) ผ่าน h(mm→px) ออกมาเป็นภาพตรง ๆ ขนาด cw×ch
export function sampleRect(G, h, x, y, w, hh, cw, ch) {
  const o = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const p = applyH(h, x + (i + 0.5) / cw * w, y + (j + 0.5) / ch * hh); o[j * cw + i] = bil(G, p[0], p[1]); }
  return o;
}
export function pct(a, p) { const s = Float32Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
export function otsu(d) {   // d ค่า 0..255
  const hist = new Float64Array(256); for (const v of d) hist[Math.max(0, Math.min(255, v | 0))]++;
  let sum = 0, N = d.length; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wb = 0, sb = 0, best = 0, t = 0;
  for (let i = 0; i < 256; i++) { wb += hist[i]; if (!wb) continue; const wf = N - wb; if (!wf) break; sb += i * hist[i]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) ** 2; if (v > best) { best = v; t = i; } }
  return t;
}
// connected components 8 เพื่อนบ้าน → [{n,x0,y0,x1,y1,idx[]}]
export function components(mask, cw, ch) {
  const lab = new Int32Array(cw * ch), out = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || lab[s]) continue;
    const c = { n: 0, x0: cw, y0: ch, x1: -1, y1: -1, idx: [] }, st = [s]; lab[s] = out.length + 1;
    while (st.length) {
      const p = st.pop(), x = p % cw, y = (p / cw) | 0; c.idx.push(p);
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const q = ny * cw + nx; if (mask[q] && !lab[q]) { lab[q] = out.length + 1; st.push(q); }
      }
    }
    c.n = c.idx.length; out.push(c);
  }
  return out;
}
// ภาพความเข้มหมึก d = bg − gray → {d, contrast, T}   (bg = เปอร์เซ็นไทล์ 90 ของช่อง)
export function ink(g, floorT) {
  const bg = pct(g, 0.9), d = new Float32Array(g.length); let mx = 0;
  for (let i = 0; i < g.length; i++) { d[i] = Math.max(0, bg - g[i]); if (d[i] > mx) mx = d[i]; }
  const contrast = pct(d, 0.995);
  return { d, contrast, T: Math.max(otsu(d), floorT) };
}
// mask (Uint8) ของ component ที่เก็บไว้ → 28×28 (ตัวสูงสุด 20px · CoM ที่ 14,14 เหมือน MNIST)
export function norm28(d, contrast, comps, cw) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const c of comps) { x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = 20 / Math.max(bw, bh), tw = Math.max(1, Math.round(bw * k)), th = Math.max(1, Math.round(bh * k));
  const soft = new Map(); for (const c of comps) for (const p of c.idx) soft.set(p, Math.min(1, d[p] / contrast));
  const t = new Float32Array(tw * th), ch = d.length / cw;
  for (let v = 0; v < th; v++) for (let u = 0; u < tw; u++) {
    const sx0 = Math.floor(x0 + u * bw / tw), sx1 = Math.max(sx0 + 1, Math.ceil(x0 + (u + 1) * bw / tw)), sy0 = Math.floor(y0 + v * bh / th), sy1 = Math.max(sy0 + 1, Math.ceil(y0 + (v + 1) * bh / th));
    let s = 0, n = 0; for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { s += soft.get(y * cw + x) || 0; n++; }
    t[v * tw + u] = s / n;
  }
  let m = 0, mx = 0, my = 0; for (let v = 0; v < th; v++) for (let u = 0; u < tw; u++) { const a = t[v * tw + u]; m += a; mx += a * u; my += a * v; }
  const ox = Math.round(14 - mx / m), oy = Math.round(14 - my / m), out = new Float32Array(784);
  for (let v = 0; v < th; v++) for (let u = 0; u < tw; u++) { const X = u + ox, Y = v + oy; if (X >= 0 && X < 28 && Y >= 0 && Y < 28) out[Y * 28 + X] = t[v * tw + u]; }
  return out;
}

// ---- ใช้กับฟอร์มทางการ (ไม่มี QR) ----
// least-squares homography จากหลายจุด (normalise พิกัดก่อน) · คืน h[8]
export function fitH(src, dst) {
  const norm = P => { const n = P.length, cx = P.reduce((s, p) => s + p[0], 0) / n, cy = P.reduce((s, p) => s + p[1], 0) / n; const d = P.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n / Math.SQRT2 || 1; return { T: [1 / d, 0, -cx / d, 0, 1 / d, -cy / d], P: P.map(p => [(p[0] - cx) / d, (p[1] - cy) / d]) }; };
  const S = norm(src), D = norm(dst), N = Array.from({ length: 8 }, () => new Float64Array(9));
  for (let i = 0; i < S.P.length; i++) {
    const [x, y] = S.P[i], [u, v] = D.P[i];
    for (const r of [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]]) for (let a = 0; a < 8; a++) for (let b = 0; b < 9; b++) N[a][b] += r[a] * r[b];
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(N[r][c]) > Math.abs(N[p][c])) p = r;
    if (Math.abs(N[p][c]) < 1e-12) return null;
    [N[c], N[p]] = [N[p], N[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = N[r][c] / N[c][c]; for (let k = c; k < 9; k++) N[r][k] -= f * N[c][k]; }
  }
  const h = N.map((r, i) => r[8] / r[i]);   // ในพิกัด normalise: Dn = Hn · Sn → ย้อนกลับด้วย Td⁻¹ · Hn · Ts
  const m = (A, B) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += A[i * 3 + k] * B[k * 3 + j]; o.push(s); } return o; };
  const Hn = [...h, 1], t = D.T, Tinv = [1 / t[0], 0, -t[2] / t[0], 0, 1 / t[4], -t[5] / t[4], 0, 0, 1];
  const Ts = [...S.T, 0, 0, 1], R = m(Tinv, m(Hn, Ts)); return R.slice(0, 8).map(v => v / R[8]);
}
// Hough หาเส้นเกือบนอน (kind 'h') / เกือบตั้ง (kind 'v') · mask Uint8 · คืน [{th,rho,votes}] เรียงตามตำแหน่ง · เส้น: h: −x·sinθ + y·cosθ = ρ ; v: x·cosθ + y·sinθ = ρ
export function hough(mask, w, h, kind, { maxDeg = 10, step = 0.25, minFrac = 0.35, sep = 6 } = {}) {
  const nth = Math.round(2 * maxDeg / step) + 1, off = w + h, nr = 2 * off + 1, acc = new Uint16Array(nth * nr);
  const sn = [], cs = []; for (let t = 0; t < nth; t++) { const th = (-maxDeg + t * step) * Math.PI / 180; sn.push(Math.sin(th)); cs.push(Math.cos(th)); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) for (let t = 0; t < nth; t++) {
    const r = Math.round(kind === 'h' ? -x * sn[t] + y * cs[t] : x * cs[t] + y * sn[t]) + off; acc[t * nr + r]++;
  }
  let mx = 0; for (let i = 0; i < acc.length; i++) if (acc[i] > mx) mx = acc[i];
  const cand = []; for (let t = 0; t < nth; t++) for (let r = 1; r < nr - 1; r++) { const v = acc[t * nr + r]; if (v >= mx * minFrac && v >= acc[t * nr + r - 1] && v >= acc[t * nr + r + 1]) cand.push({ th: (-maxDeg + t * step) * Math.PI / 180, rho: r - off, votes: v }); }
  cand.sort((a, b) => b.votes - a.votes);
  const out = []; for (const c of cand) if (!out.some(o => Math.abs(o.rho - c.rho) <= sep)) out.push(c);
  return out.sort((a, b) => a.rho - b.rho);
}
// จุดตัดของเส้น h กับเส้น v
export function cross(hl, vl) {
  const a = -Math.sin(hl.th), b = Math.cos(hl.th), c = Math.cos(vl.th), d = Math.sin(vl.th), det = a * d - b * c;
  return [(hl.rho * d - b * vl.rho) / det, (a * vl.rho - c * hl.rho) / det];
}
export const distToLine = (l, kind, x, y) => Math.abs(kind === 'h' ? -x * Math.sin(l.th) + y * Math.cos(l.th) - l.rho : x * Math.cos(l.th) + y * Math.sin(l.th) - l.rho);
