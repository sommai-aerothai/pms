// อ่านลายมือบนฟอร์มทางการที่พิมพ์ (ไม่มี QR) · FM-202 ก่อน
// 1) หาเส้นตาราง (Hough) → จับคู่กับเรขาคณิตของฟอร์ม (layouts/fm202-official.json จาก xlsx) → homography
// 2) ตัดช่อง → ตัดเส้นกรอบ → แยก ตัวเลข / จุดทศนิยม / ลบ → โมเดลตัวเลขเดียวกับใบจดค่า → ตรวจช่วงค่าที่เป็นไปได้
// readOfficial(src, {page, ocr}) → null ถ้าไม่พบตารางฟอร์ม
import { loadLayout } from './layout.js';
import { loadDigits, classify } from './digits.js';
import { toImageData } from './read.js';
import { toGray, applyH, scaleAt, sampleRect, pct, ink, components, norm28, hough, cross, distToLine, fitH } from './vision.js';

const confOf = p => p >= 0.9 ? 'high' : p >= 0.6 ? 'medium' : 'low', rank = { high: 2, medium: 1, low: 0 };

// ---------- จัดภาพ ----------
function detectLines(G) {
  const { g, w, h } = G, R = 12, I = new Float64Array((w + 1) * (h + 1));   // integral image → ค่าเฉลี่ยท้องถิ่น
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s; } }
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
    const m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    if (g[y * w + x] < m - 28) mask[y * w + x] = 1;
  }
  return { H: hough(mask, w, h, 'h'), V: hough(mask, w, h, 'v') };
}

function register(G, L) {
  const { H: hl, V: vl } = detectLines(G);
  if (hl.length < 8 || vl.length < 8) return null;
  const X = L.xEdges, Y = L.hLines, xa = X[0], xb = X[X.length - 1], ya = Y[0], yb = Y[Y.length - 1], yd = L.rowEdges[0];
  const pairs = [];   // จับคู่เส้นที่ตรวจพบกับเส้นของฟอร์มภายใต้ homography H → [{H, nm, hm, vm}]
  const match = (Hm, tol) => {
    const hm = [], vm = [];
    Y.forEach((y, k) => {
      const p = [X[0], (X[0] + X[X.length - 1]) / 2, X[X.length - 1]].map(x => applyH(Hm, x, y)); let best = null;
      for (const l of hl) { const d = Math.max(...p.map(q => distToLine(l, 'h', q[0], q[1]))); if (d < tol && (!best || d < best.d)) best = { l, d }; }
      if (best) hm.push([k, best.l]);
    });
    X.forEach((x, j) => {
      const p = [yd, (yd + yb) / 2, yb].map(y => applyH(Hm, x, y)); let best = null;
      for (const l of vl) { const d = Math.max(...p.map(q => distToLine(l, 'v', q[0], q[1]))); if (d < tol && (!best || d < best.d)) best = { l, d }; }
      if (best) vm.push([j, best.l]);
    });
    return { hm, vm, n: hm.length + vm.length };
  };
  let best = null;
  const K = 5, hs = [...hl.slice(0, K).map((l, i) => i), ...hl.slice(-K).map((l, i) => hl.length - K + i)].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
  const vs = [...vl.slice(0, K).map((l, i) => i), ...vl.slice(-K).map((l, i) => vl.length - K + i)].filter((v, i, a) => v >= 0 && a.indexOf(v) === i);
  for (const a of hs) for (const b of hs) if (b > a) for (const c of vs) for (const d of vs) if (d > c) {
    const P = [cross(hl[a], vl[c]), cross(hl[a], vl[d]), cross(hl[b], vl[d]), cross(hl[b], vl[c])];
    const Hm = fitH([[xa, ya], [xb, ya], [xb, yb], [xa, yb]], P); if (!Hm) continue;
    const s = scaleAt(Hm, (xa + xb) / 2, (ya + yb) / 2); if (!(s > 1.5 && s < 30)) continue;
    const m = match(Hm, Math.max(3, 0.7 * s)); if (!best || m.n > best.n) best = { ...m, Hm, s };
  }
  if (!best || best.n < 0.55 * (X.length + Y.length)) return null;
  // ปรับละเอียด: least-squares จากจุดตัดทุกเส้นที่จับคู่ได้ (สองรอบ)
  let Hm = best.Hm, m = best;
  for (let it = 0; it < 2; it++) {
    const S = [], D = [];
    for (const [k, h] of m.hm) for (const [j, v] of m.vm) { S.push([X[j], Y[k]]); D.push(cross(h, v)); }
    const H2 = S.length >= 8 ? fitH(S, D) : null; if (!H2) break; Hm = H2; m = match(Hm, Math.max(2.5, 0.5 * best.s));
  }
  let rs = 0, rn = 0, rmax = 0;   // ความคลาดเคลื่อนของเส้นที่จับคู่ (px ที่จุดกึ่งกลางเส้น)
  for (const [k, h] of m.hm) { const q = applyH(Hm, (X[0] + X[X.length - 1]) / 2, Y[k]), e = distToLine(h, 'h', q[0], q[1]); rs += e; rn++; rmax = Math.max(rmax, e); }
  for (const [j, v] of m.vm) { const q = applyH(Hm, X[j], (yd + yb) / 2), e = distToLine(v, 'v', q[0], q[1]); rs += e; rn++; rmax = Math.max(rmax, e); }
  return { H: Hm, matched: m.n, of: X.length + Y.length, resMean: rs / rn, resMax: rmax, hk: m.hm.map(a => a[0]), vk: m.vm.map(a => a[0]), hl: hl.length, vl: vl.length };
}

// ---------- อ่านช่อง ----------
function splitWide(c, cw, ch, mask) {   // ตัวเลขสองตัวติดกัน → ตัดที่หุบเขาของ projection แนวตั้ง
  const w = c.x1 - c.x0 + 1, proj = new Array(w).fill(0); for (const p of c.idx) proj[(p % cw) - c.x0]++;
  let cut = -1, mv = 1e9; for (let i = Math.floor(w * 0.3); i <= Math.ceil(w * 0.7); i++) if (proj[i] < mv) { mv = proj[i]; cut = i; }
  if (cut <= 0) return [c];
  const mk = side => { const idx = c.idx.filter(p => ((p % cw) - c.x0 < cut) === side), o = { idx, n: idx.length, x0: cw, y0: ch, x1: -1, y1: -1 }; for (const p of idx) { const x = p % cw, y = (p / cw) | 0; o.x0 = Math.min(o.x0, x); o.x1 = Math.max(o.x1, x); o.y0 = Math.min(o.y0, y); o.y1 = Math.max(o.y1, y); } return o; };
  return [mk(true), mk(false)].filter(o => o.n);
}
export function readCell(G, H, rect, floorT, inset = 0.45) {
  const s = scaleAt(H, rect.x0, rect.y0), w = rect.x1 - rect.x0 - 2 * inset, h = rect.y1 - rect.y0 - 2 * inset;
  const cw = Math.max(16, Math.min(160, Math.round(w * s))), ch = Math.max(12, Math.min(120, Math.round(h * s)));
  const g = sampleRect(G, H, rect.x0 + inset, rect.y0 + inset, w, h, cw, ch), { d, contrast, T } = ink(g, floorT);
  if (contrast < floorT * 1.1) return { empty: true };
  const mask = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) mask[i] = d[i] > T ? 1 : 0;
  let comps = components(mask, cw, ch).filter(k => {
    if (k.n < Math.max(4, 0.0015 * cw * ch)) return false;
    const bw = k.x1 - k.x0 + 1, bh = k.y1 - k.y0 + 1, edge = k.x0 <= 0 || k.y0 <= 0 || k.x1 >= cw - 1 || k.y1 >= ch - 1;
    return !(edge && ((bw >= 0.7 * cw && bh <= 0.25 * ch) || (bh >= 0.9 * ch && bw <= 0.2 * cw)));   // เส้นกรอบตาราง
  });
  if (comps.reduce((a, k) => a + k.n, 0) / (cw * ch) < 0.008) return { empty: true };
  comps.sort((a, b) => a.x0 - b.x0);
  const merged = [];   // รวมชิ้นที่ทับกันแนวนอน (เช่น 5, 4 ที่ขาดเป็นสองชิ้น)
  for (const c of comps) { const p = merged[merged.length - 1]; if (p && Math.min(p.x1, c.x1) - Math.max(p.x0, c.x0) > 0.5 * Math.min(p.x1 - p.x0 + 1, c.x1 - c.x0 + 1)) { p.idx = p.idx.concat(c.idx); p.n += c.n; p.x0 = Math.min(p.x0, c.x0); p.x1 = Math.max(p.x1, c.x1); p.y0 = Math.min(p.y0, c.y0); p.y1 = Math.max(p.y1, c.y1); } else merged.push({ ...c, idx: c.idx.slice() }); }
  const Hc = Math.max(...merged.map(c => c.y1 - c.y0 + 1)), toks = [];
  for (let c of merged) {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    if (bh < 0.3 * Hc && bw < 0.45 * Hc && c.y1 > ch * 0.55 && merged.length > 1) { toks.push({ t: '.', x: c.x0 }); continue; }
    if (bh < 0.3 * Hc && bw >= 1.1 * bh && bw > 0.2 * Hc && merged.length > 1 && (c.y0 + c.y1) / 2 > ch * 0.25 && (c.y0 + c.y1) / 2 < ch * 0.75) { toks.push({ t: '-', x: c.x0 }); continue; }
    if (bh < 0.3 * ch && bw < 0.3 * ch && merged.length === 1) return { empty: true };
    for (const part of bw > 1.05 * bh && bh > 0.4 * ch ? splitWide(c, cw, ch, mask) : [c]) toks.push({ t: 'd', x: part.x0, ...classify(norm28(d, contrast, [part], cw)) });
  }
  return { empty: false, toks: toks.sort((a, b) => a.x - b.x), dbg: { g, cw, ch, merged: merged.map(c => [c.x0, c.y0, c.x1, c.y1]) } };
}

// toks + รูปแบบของช่อง → ค่า (null ถ้าไม่มั่นใจ/นอกช่วง)
export function assemble(toks, f) {
  const { int, dec, signed, neg: alwaysNeg } = f.fmt;
  let neg = !!alwaysNeg, conf = 'high', note = '', digs = [], dot = -1;
  toks.forEach((t, i) => {
    if (t.t === '-' && digs.length === 0) { neg = true; return; }
    if (t.t === '.') { if (dot < 0 && digs.length) dot = digs.length; return; }
    if (t.t === 'd') { digs.push(t.digit); const c = confOf(t.p); if (rank[c] < rank[conf]) conf = c; }
  });
  if (alwaysNeg && !toks.some(t => t.t === '-')) { if (rank[conf] > 1) conf = 'medium'; }
  const raw = (neg ? '−' : '') + digs.slice(0, dot < 0 ? digs.length : dot).join('') + (dot >= 0 ? '.' + digs.slice(dot).join('') : '');
  const fail = why => ({ value: null, confidence: 'low', raw, note: why });
  if (!digs.length || digs.length > int + dec) return fail('จำนวนหลักไม่ตรง');
  if (dot < 0 && dec > 0) { if (digs.length !== int + dec) return fail('ไม่เห็นจุดทศนิยม'); dot = int; if (rank[conf] > 1) conf = 'medium'; }
  else if (dot < 0) dot = digs.length;
  if (dot > int || digs.length - dot > dec || dot === 0) return fail('ตำแหน่งจุดไม่ตรง');
  let v = parseFloat(digs.slice(0, dot).join('') + '.' + (digs.slice(dot).join('') || '0')); if (neg && !f.fmt.abs) v = -v;
  const lo = f.range[0], hi = f.range[1], vv = f.fmt.abs ? Math.abs(v) : v;
  if (vv < lo || vv > hi) return { value: null, confidence: 'low', raw, note: `นอกช่วง ${lo}…${hi}` };
  return { value: v, confidence: conf, raw };
}

// ระบุฟอร์ม/หน้าจากตัวพิมพ์ด้วย Tesseract เดิมของ readers: ช่องเลขที่เอกสาร (ต้องมี "202") + คอลัมน์ NO (1–15 = หน้า 1, 16+ = หน้า 2)
export async function identifyByOcr(G, H, L) {
  const { ocr } = await import('../readers/image.js');
  const blob = (x0, y0, x1, y1, k, pad = 0) => {
    const w = Math.round((x1 - x0) * k), h = Math.round((y1 - y0) * k), g = sampleRect(G, H, x0, y0, x1 - x0, y1 - y0, w, h);
    const c = document.createElement('canvas'); c.width = w + 2 * pad; c.height = h + 2 * pad; const cx = c.getContext('2d'), im = cx.createImageData(w, h);
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < g.length; i++) im.data.set([g[i], g[i], g[i], 255], i * 4); cx.putImageData(im, pad, pad);
    return new Promise(r => c.toBlob(r, 'image/png'));
  };
  const d = L.docNo, head = (await ocr(await blob(d.x0, d.y0, d.x1, d.y1, 14), 'eng')).text;
  const form = /20[2Z]/.test(head) ? 'FM-202' : null;
  // หน้า: อ่านเลข NO ของ 3 แถวแรกทีละช่อง (หน้า 1 = 1,2,3 · หน้า 2 = 16,17,18) แล้วโหวต
  const n = L.noCol, votes = [0, 0, 0], seen = [];
  for (let r = 0; r < 3; r++) {
    const t = (await ocr(await blob(n.x0 + 0.4, L.rowEdges[r] + 0.4, n.x1 - 0.4, L.rowEdges[r + 1] - 0.4, 16, 40), 'eng')).text.replace(/\D/g, ''); seen.push(t);
    for (const pg of [1, 2]) if (t === String(L.pages[pg].tx0 + r)) votes[pg]++;
  }
  return { form, head: head.trim(), nums: seen, page: votes[1] > votes[2] ? 1 : votes[2] > votes[1] ? 2 : null };
}

// อ่านตัวพิมพ์เพิ่ม: ความถี่ (คอลัมน์ Freq) ต่อแถว + บรรทัด MaintID (ชื่อสถานี/รอบ) ไว้จับคู่กับงาน
export async function readPrinted(G, H, L, p) {
  const { ocr } = await import('../readers/image.js'), pg = L.pages[p];
  const blob = (x0, y0, x1, y1, k, pad) => {
    const w = Math.round((x1 - x0) * k), h = Math.round((y1 - y0) * k), g = sampleRect(G, H, x0, y0, x1 - x0, y1 - y0, w, h);
    const c = document.createElement('canvas'); c.width = w + 2 * pad; c.height = h + 2 * pad; const cx = c.getContext('2d'), im = cx.createImageData(w, h);
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); for (let i = 0; i < g.length; i++) im.data.set([g[i], g[i], g[i], 255], i * 4); cx.putImageData(im, pad, pad);
    return new Promise(r => c.toBlob(r, 'image/png'));
  };
  const f = L.freqCol, m = L.maintLine, freqs = [];
  for (let r = 0; r < pg.n; r++) {
    const t = (await ocr(await blob(f.x0 + 0.4, L.rowEdges[r] + 0.4, f.x1 - 0.4, L.rowEdges[r + 1] - 0.4, 16, 40), 'eng')).text, v = /(\d{2,3})[.,](\d{1,3})/.exec(t);
    freqs.push(v ? Math.round(parseFloat(v[1] + '.' + v[2]) * 1000) / 1000 : null);
  }
  const maint = (await ocr(await blob(m.x0, m.y0, m.x1, m.y1, 12, 20), 'eng')).text.replace(/\s+/g, ' ').trim();
  return { freqs, maint };
}

export async function readOfficial(src, { page, ocr, layoutId = 'fm202-official', max = 2200 } = {}) {
  const t0 = performance.now(), L = await loadLayout(layoutId), id = await toImageData(src, max), G = toGray(id);
  const reg = register(G, L); if (!reg) return null;
  const white = pct(G.g.filter((_, i) => i % 7 === 0), 0.9), black = pct(G.g.filter((_, i) => i % 7 === 0), 0.01), floorT = 0.3 * (white - black);
  if (white - black < 80) return { ok: false, values: [], note: 'ภาพมืด/จางเกินไป', ms: performance.now() - t0 };
  await loadDigits();
  let ident = null;
  if (ocr) { try { ident = await (typeof ocr === 'function' ? ocr : identifyByOcr)(G, reg.H, L, id); } catch (e) { ident = { error: String(e) }; } }
  if (ident && !ident.error && ident.form !== 'FM-202') return { ok: false, meta: { ident }, values: [], note: 'ตัวพิมพ์ไม่ใช่ FM-202 · ไม่อ่านค่า', ms: performance.now() - t0 };
  const p = ident?.page || page;
  const meta = { form: 'FM-202', rev: L.rev, page: p, ident };
  if (!p) return { ok: false, meta, values: [], note: 'ไม่รู้ว่าเป็นหน้าไหน (ส่ง page หรือเปิด OCR)', reg, ms: performance.now() - t0 };
  const pg = L.pages[p], values = [];
  for (let r = 0; r < pg.n; r++) L.fields.forEach((f, fi) => {
    const cell = readCell(G, reg.H, { x0: f.x0, x1: f.x1, y0: L.rowEdges[r], y1: L.rowEdges[r + 1] }, floorT);
    if (cell.empty) return;
    const a = assemble(cell.toks, f), no = pg.tx0 + r;
    values.push({ field: `tx[${no}].${f.id}`, value: a.value, unit: f.unit, locator: `official FM-202 p${p} r${r + 1} c${fi + 1}`, confidence: a.confidence, raw: a.raw, ...(globalThis.FS_DEBUG && { cell }), ...(a.note && { note: a.note }) });
  });
  let text = '';
  if (ocr) {   // ความถี่ที่อ่านจากตัวพิมพ์ → ให้ฝั่งแอปจับคู่แถวกับงาน (ไม่ตรง = ไม่เติม) · แถวที่อ่านความถี่ไม่ได้ไม่ถูกเติม
    try { const pr = await readPrinted(G, reg.H, L, p); text = 'A4: ' + pr.maint; pr.freqs.forEach((fq, r) => { if (fq != null) values.push({ field: `tx[${pg.tx0 + r}].freq_mhz`, value: fq, unit: 'MHz', locator: `official FM-202 p${p} r${r + 1} printed`, confidence: 'medium' }); }); } catch { /* ไม่มี OCR = ไม่มีความถี่ → ไม่เติม */ }
  }
  return { ok: true, meta, values, text, reg, ms: performance.now() - t0 };
}
