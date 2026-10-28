// อนุมานโมเดลตัวเลข (MLP int8 · digits.bin) ในเครื่อง · classify(Float32Array(784) 0..1) → {digit, p, p2}
let net;
export async function loadDigits(url = new URL('./digits.bin', import.meta.url).href) {
  if (net) return net;
  const buf = await (await fetch(url)).arrayBuffer(), dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x44475431) throw new Error('digits.bin ไม่ถูกต้อง');   // 'DGT1'
  const nl = dv.getUint32(4, true), dims = []; for (let i = 0; i <= nl; i++) dims.push(dv.getUint32(8 + 4 * i, true));
  let off = 8 + 4 * (nl + 1); const layers = [];
  for (let l = 0; l < nl; l++) {
    const i = dims[l], o = dims[l + 1];
    const sc = new Float32Array(buf.slice(off, off + 4 * o)); off += 4 * o;
    const b = new Float32Array(buf.slice(off, off + 4 * o)); off += 4 * o;
    const w = new Int8Array(buf, off, o * i); off += o * i;
    layers.push({ i, o, sc, b, w });
  }
  return net = layers;
}
export function classify(x, layers = net) {
  let a = x;
  layers.forEach(({ i, o, sc, b, w }, l) => {
    const z = new Float32Array(o);
    for (let r = 0; r < o; r++) { let s = 0; const base = r * i; for (let k = 0; k < i; k++) s += w[base + k] * a[k]; s = s * sc[r] + b[r]; z[r] = l < layers.length - 1 && s < 0 ? 0 : s; }
    a = z;
  });
  let mx = -1e9, d = 0; for (let k = 0; k < 10; k++) if (a[k] > mx) { mx = a[k]; d = k; }
  let sum = 0; const e = Array.from(a, v => { const q = Math.exp(v - mx); sum += q; return q; }); const p = e.map(v => v / sum);
  const p2 = Math.max(...p.filter((_, k) => k !== d));
  return { digit: d, p: p[d], p2 };
}
