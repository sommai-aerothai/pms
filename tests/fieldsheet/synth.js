// ตัวช่วยทดสอบ: สุ่ม, วาดลายมือสังเคราะห์จาก MNIST, บิดภาพแบบถ่ายรูป (หมุน+perspective+แสง+noise)
import { solveH, applyH } from '../../js/fieldsheet/vision.js';
export const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export async function loadSprite() {
  const img = new Image(); img.src = new URL('./mnist-sprite.png', import.meta.url).href; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = 560; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const labels = await (await fetch(new URL('./mnist-labels.json', import.meta.url))).json(), by = Array.from({ length: 10 }, () => []);
  labels.forEach((l, i) => by[l].push(i));
  return { g, by, labels };
}
export async function rasterSvg(svg, w, h) {
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); return c;
}
// วางตัวเลข MNIST ลงช่อง · box = {x,y,w,h} mm · k = px/mm
export function paste(g, sprite, d, rect, k, R, { side = 8.6 } = {}) {
  const i = sprite.by[d][(R() * sprite.by[d].length) | 0], tx = (i % 20) * 28, ty = ((i / 20) | 0) * 28;
  const src = sprite.g.getImageData(tx, ty, 28, 28), t = document.createElement('canvas'); t.width = t.height = 28;
  const o = new ImageData(28, 28); for (let p = 0; p < 784; p++) { o.data[p * 4] = 25; o.data[p * 4 + 1] = 25; o.data[p * 4 + 2] = 70; o.data[p * 4 + 3] = src.data[p * 4]; }
  t.getContext('2d').putImageData(o, 0, 0);
  const s = side * (0.85 + 0.25 * R()) * k, cx = (rect.x + rect.w / 2 + (R() - 0.5) * 1.4) * k, cy = (rect.y + rect.h / 2 + (R() - 0.5) * 1.4) * k;
  g.save(); g.translate(cx, cy); g.rotate((R() - 0.5) * 0.12); g.imageSmoothingEnabled = true; g.drawImage(t, -s / 2, -s / 2, s, s); g.restore();
}
export function fillCircle(g, c, k, R) {
  g.save(); g.fillStyle = 'rgba(25,25,70,.92)'; g.beginPath(); g.arc((c.x + c.w / 2 + (R() - .5) * .4) * k, (c.y + c.h / 2) * k, c.w / 2 * k * (0.8 + 0.2 * R()), 0, 7); g.fill(); g.restore();
}
// บิดภาพ: หมุน ±rot° + perspective + แสงไล่ระดับ + noise · คืน ImageData ขนาด ow×oh
export function distort(canvas, R, { rot = 5, ow = 2200, oh = 1600, noise = 8, persp = 0.03 } = {}) {
  const W = canvas.width, H = canvas.height, th = (R() * 2 - 1) * rot * Math.PI / 180, sc = Math.min(ow / W, oh / H) * 0.9;
  const cx = ow / 2 + (R() - .5) * 40, cy = oh / 2 + (R() - .5) * 40, src = [[0, 0], [W, 0], [W, H], [0, H]];
  const dst = src.map(([x, y]) => { const px = (x - W / 2) * sc, py = (y - H / 2) * sc; return [cx + px * Math.cos(th) - py * Math.sin(th) + (R() - .5) * 2 * persp * W * sc, cy + px * Math.sin(th) + py * Math.cos(th) + (R() - .5) * 2 * persp * H * sc]; });
  const Hi = solveH(dst, src), sd = canvas.getContext('2d').getImageData(0, 0, W, H).data, out = new ImageData(ow, oh), gx = (R() - .5) * 0.3, gy = (R() - .5) * 0.3;
  const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(6.2832 * R());
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const [u, v] = applyH(Hi, x + .5, y + .5), o = (y * ow + x) * 4;
    let r = 150, g = 140, b = 130;   // พื้นโต๊ะ
    if (u >= 0 && v >= 0 && u < W - 1 && v < H - 1) {
      const u0 = u | 0, v0 = v | 0, fu = u - u0, fv = v - v0, i = (v0 * W + u0) * 4;
      const m = c => (sd[i + c] * (1 - fu) + sd[i + 4 + c] * fu) * (1 - fv) + (sd[i + W * 4 + c] * (1 - fu) + sd[i + W * 4 + 4 + c] * fu) * fv;
      r = m(0); g = m(1); b = m(2);
    }
    const light = 0.88 + 0.12 * (1 + gx * (x / ow - .5) * 4 + gy * (y / oh - .5) * 4) / 1, n = gauss() * noise;
    out.data[o] = r * light + n; out.data[o + 1] = g * light + n; out.data[o + 2] = b * light + n; out.data[o + 3] = 255;
  }
  return out;
}
