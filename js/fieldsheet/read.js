// อ่านใบจดค่าหน้างานจากรูป: QR → มุม 4 จุด → homography → ตัดช่อง → ตัวเลข (MLP ในเครื่อง)
// readFieldSheet(src) → null ถ้าไม่ใช่ใบจดค่า (ให้ผู้เรียกไปทางอื่น) · ไม่ส่งข้อมูลออกนอกเครื่อง
import { loadLayout, cells } from './layout.js';
import { loadDigits, classify } from './digits.js';
import { solveH, applyH, scaleAt, toGray, sampleRect, pct, ink, components, norm28 } from './vision.js';

const JSQR = new URL('../../vendor/jsqr/jsQR.js', import.meta.url).href;
let jsqrP;
export const loadJsQR = () => jsqrP ||= new Promise((res, rej) => {
  if (globalThis.jsQR) return res(globalThis.jsQR);
  const s = document.createElement('script'); s.src = JSQR;
  s.onload = () => res(globalThis.jsQR); s.onerror = () => rej(new Error('โหลดตัวอ่าน QR ไม่ได้')); document.head.appendChild(s);
});

export async function toImageData(src, max = 2400) {
  if (typeof ImageData !== 'undefined' && src instanceof ImageData) return src;
  const bmp = src instanceof Blob ? await createImageBitmap(src) : src;
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, max / Math.max(w0, h0)), w = Math.round(w0 * k), h = Math.round(h0 * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
  if (bmp.close && src instanceof Blob) bmp.close();
  return g.getImageData(0, 0, w, h);
}

// 2 จุด = similarity · 3 จุด = affine · 4 จุด = homography (ทำนายตำแหน่งมุมทีละขั้น)
function fitPts(S, D) {
  if (S.length >= 4) return solveH(S.slice(-4), D.slice(-4));
  if (S.length === 2) {
    const dx = S[1][0] - S[0][0], dy = S[1][1] - S[0][1], ex = D[1][0] - D[0][0], ey = D[1][1] - D[0][1], n = dx * dx + dy * dy, a = (dx * ex + dy * ey) / n, b = (dx * ey - dy * ex) / n;
    return [a, -b, D[0][0] - (a * S[0][0] - b * S[0][1]), b, a, D[0][1] - (b * S[0][0] + a * S[0][1]), 0, 0];
  }
  const M = S.map(([x, y]) => [x, y, 1]), det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(M); if (Math.abs(d) < 1e-9) return null;
  const sol = k => [0, 1, 2].map(c => det(M.map((r, i) => r.map((v, j) => j === c ? D[i][k] : v))) / d);
  return [...sol(0), ...sol(1), 0, 0];
}
const confOf = p => p >= 0.9 ? 'high' : p >= 0.6 ? 'medium' : 'low';
const rank = { high: 2, medium: 1, low: 0 };

// หาจุดศูนย์กลางสี่เหลี่ยมทึบรอบตำแหน่งที่ทำนายไว้ (หยาบ→ละเอียด)
function findMarker(G, pred, s, sizeMm) {
  const R = Math.round(30 * s), x0 = Math.max(0, Math.round(pred[0] - R)), y0 = Math.max(0, Math.round(pred[1] - R)), x1 = Math.min(G.w, Math.round(pred[0] + R)), y1 = Math.min(G.h, Math.round(pred[1] + R));
  const ww = x1 - x0, wh = y1 - y0; if (ww < 8 || wh < 8) return null;
  const win = new Float32Array(ww * wh); for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) win[y * ww + x] = G.g[(y0 + y) * G.w + x0 + x];
  const lo = pct(win, 0.03), hi = pct(win, 0.9); if (hi - lo < 60) return null;
  const thr = (lo + hi) / 2, mask = new Uint8Array(win.length); for (let i = 0; i < win.length; i++) mask[i] = win[i] < thr ? 1 : 0;
  const exp = (sizeMm * s) ** 2; let best = null;
  for (const c of components(mask, ww, wh)) {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    if (c.n < exp * 0.5 || c.n > exp * 1.6 || c.n < 0.65 * bw * bh || bw / bh < 0.6 || bw / bh > 1.67) continue;
    let sx = 0, sy = 0; for (const p of c.idx) { sx += p % ww; sy += (p / ww) | 0; }
    const cx = x0 + sx / c.n + 0.5, cy = y0 + sy / c.n + 0.5, dist = Math.hypot(cx - pred[0], cy - pred[1]);
    if (!best || dist < best.dist) best = { x: cx, y: cy, dist, black: pct(c.idx.map(p => win[p]), 0.25) };
  }
  return best;
}

export function readCells(G, H, L, page, { white, black }) {
  const out = [], scale = scaleAt(H, L.page.w / 2, L.page.h / 2), floorT = 0.3 * (white - black), inset = L.box.inset;
  const clampN = v => Math.max(10, Math.min(64, Math.round(v)));
  const digitCell = c => {
    const w = c.w - 2 * inset, h = c.h - 2 * inset, cw = clampN(w * scale), ch = clampN(h * scale);
    const g = sampleRect(G, H, c.x + inset, c.y + inset, w, h, cw, ch), { d, contrast, T } = ink(g, floorT);
    if (contrast < floorT * 1.1) return { empty: true };
    const mask = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) mask[i] = d[i] > T ? 1 : 0;
    const keep = components(mask, cw, ch).filter(k => {
      if (k.n < Math.max(6, 0.004 * cw * ch)) return false;
      const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1, edge = k.x0 === 0 || k.y0 === 0 || k.x1 === cw - 1 || k.y1 === ch - 1;
      return !(edge && ((bw >= 0.8 * cw && bh <= 0.2 * ch) || (bh >= 0.8 * ch && bw <= 0.2 * cw)));   // เส้นกรอบ
    });
    if (keep.reduce((s, k) => s + k.n, 0) / (cw * ch) < 0.02) return { empty: true };
    return { empty: false, ...classify(norm28(d, contrast, keep, cw)) };
  };
  const circleCell = c => {
    const n = clampN(c.w * scale), g = sampleRect(G, H, c.x, c.y, c.w, c.h, n, n), bg = pct(g, 0.9), r = 0.65 * n / 2;
    let on = 0, tot = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) <= r) { tot++; if (bg - g[y * n + x] > 0.5 * (white - black)) on++; }
    return on / tot >= 0.35;
  };
  for (let r = 0; r < L.rows.n; r++) {
    const no = (page - 1) * L.rows.n + r + 1, cs = cells(L, r), res = {};
    for (const c of cs) { if (c.t === 'b') (res[c.field] ||= []).push({ ...digitCell(c), t: 'b', dot: false }); else if (c.t === 'p' || c.t === 'm') (res[c.field] ||= []).push({ t: c.t, on: circleCell(c) }); else (res[c.field] ||= []).push({ t: c.t }); }
    L.fields.forEach((f, fi) => {
      const toks = res[f.id], boxes = toks.filter(t => t.t === 'b');
      if (boxes.every(b => b.empty)) return;
      let neg = toks.some(t => t.t === '-'), str = '', conf = 'high', seenDot = false, seenDigit = false, bad = false, raw = '';
      const sp = toks.find(t => t.t === 'p'), sm = toks.find(t => t.t === 'm');
      for (const t of toks) {
        if (t.t === '.') { str += '.'; raw += '.'; seenDot = true; continue; }
        if (t.t !== 'b') continue;
        if (t.empty) { if (!seenDigit && !seenDot) { str += '0'; raw += '0'; if (rank[conf] > 1) conf = 'medium'; }   // ช่องหน้าว่าง = 0 แต่ไม่ให้ high (อาจเป็นลายจางที่มองไม่เห็น) else { bad = true; raw += '?'; } continue; }
        seenDigit = true; str += t.digit; raw += t.digit;
        const c = confOf(t.p); if (rank[c] < rank[conf]) conf = c;
      }
      if (sp && sm) { if (sp.on && sm.on) { bad = true; raw = '±' + raw; } else if (sm.on) neg = true; else if (!sp.on && parseFloat(str) !== 0 && conf === 'high') conf = 'medium'; }
      if (neg && !sm) raw = '−' + raw;
      const low = bad || conf === 'low';
      out.push({ field: `tx[${no}].${f.id}`, value: low ? null : (neg ? -1 : 1) * parseFloat(str), unit: f.unit, locator: `fieldsheet p${page} r${r + 1} c${fi + 1}`, confidence: low ? 'low' : conf, raw });
    });
  }
  return out;
}

export async function readFieldSheet(src, opts = {}) {
  const t0 = performance.now(), id = await toImageData(src, opts.max || 2400), jsQR = await loadJsQR();
  let code = jsQR(id.data, id.width, id.height, { inversionAttempts: 'dontInvert' });
  if (!code) {   // รูปมี noise: ย่อครึ่ง (เฉลี่ย 2×2) แล้วลองใหม่ แล้วคูณพิกัดกลับ
    const w = id.width >> 1, h = id.height >> 1, d = new Uint8ClampedArray(w * h * 4), S = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) { const i = (2 * y * id.width + 2 * x) * 4 + c; d[(y * w + x) * 4 + c] = (S[i] + S[i + 4] + S[i + id.width * 4] + S[i + id.width * 4 + 4]) >> 2; }
    const c2 = jsQR(d, w, h, { inversionAttempts: 'dontInvert' });
    if (c2) { const l = c2.location; for (const k in l) if (l[k]?.x != null) { l[k] = { x: l[k].x * 2 + 0.5, y: l[k].y * 2 + 0.5 }; } code = c2; }
  }
  if (!code) return null;
  let meta; try { meta = JSON.parse(code.data); } catch { return null; }
  if (!meta || meta.v !== 1 || typeof meta.l !== 'string' || typeof meta.f !== 'string' || !Number.isInteger(meta.p)) return null;
  let L; try { L = await loadLayout(meta.l); } catch { return null; }
  const G = toGray(id), q = L.qr, loc = code.location;
  const H0 = solveH([[q.x, q.y], [q.x + q.size, q.y], [q.x + q.size, q.y + q.size], [q.x, q.y + q.size]],
    [loc.topLeftCorner, loc.topRightCorner, loc.bottomRightCorner, loc.bottomLeftCorner].map(p => [p.x, p.y]));
  let found = null;
  const fail = note => ({ meta, values: [], ok: false, note, dbg: found, ms: performance.now() - t0 });
  if (!H0) return fail('อ่านตำแหน่ง QR ไม่ได้');
  // หาทีละมุม เริ่มจากมุมใกล้ QR สุด · เจอแล้วใช้ปรับ homography ให้ทำนายมุมไกลได้แม่นขึ้น (QR มุมขวาล่างคลาดเคลื่อนได้)
  const qc = [q.x + q.size / 2, q.y + q.size / 2], qcp = [0, 1, 2, 3].map(i => [loc.topLeftCorner, loc.topRightCorner, loc.bottomRightCorner, loc.bottomLeftCorner][i]).reduce((a, p) => [a[0] + p.x / 4, a[1] + p.y / 4], [0, 0]);
  const order = L.marks.centres.map((c, i) => i).sort((i, j) => Math.hypot(...L.marks.centres[i].map((v, k) => v - qc[k])) - Math.hypot(...L.marks.centres[j].map((v, k) => v - qc[k])));
  found = new Array(4).fill(null); const srcP = [qc], dstP = [qcp]; let Hc = H0;
  for (const i of order) {
    const c = L.marks.centres[i], m = findMarker(G, applyH(Hc, c[0], c[1]), scaleAt(Hc, c[0], c[1]), L.marks.size);
    if (!m) return fail('มองไม่เห็นสี่เหลี่ยมมุมครบ 4 จุด · ถ่ายให้เห็นทั้งแผ่น');
    found[i] = m; srcP.push(c); dstP.push([m.x, m.y]); Hc = fitPts(srcP, dstP) || Hc;
  }
  const H = solveH(L.marks.centres, found.map(f => [f.x, f.y]));
  if (!H) return fail('คำนวณมุมภาพไม่ได้');
  const white = pct(G.g.filter((_, i) => i % 7 === 0), 0.9), black = found.reduce((s, f) => s + f.black, 0) / 4;
  if (white - black < 80) return fail('ภาพมืด/จางเกินไป');
  await loadDigits();
  const values = readCells(G, H, L, meta.p, { white, black });
  return { meta, values, ok: true, low: values.filter(v => v.confidence === 'low').length, ms: performance.now() - t0 };
}
