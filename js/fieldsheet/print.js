// ตัวพิมพ์ใบจดค่าหน้างาน → SVG (หน่วย mm) ต่อหน้า · ใช้ในหน้า fieldsheet.html และทดสอบ rasterise
import { encodeQR } from './qr.js';
import { cells, rowTop } from './layout.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const payload = (L, job, page) => JSON.stringify({ v: 1, j: String(job), f: L.form, p: page, l: L.id });
export const rowsPerPage = L => L.rows.n;
export const pageCount = (L, n) => Math.max(1, Math.ceil(n / L.rows.n));

// txs: [{no, freq}] ทั้งงาน · คืน SVG ของหน้า page (เริ่มที่ 1)
export function sheetSvg(L, { job, page, txs, uid = 'fs' }) {
  const pages = pageCount(L, txs.length), rows = txs.slice((page - 1) * L.rows.n, page * L.rows.n);
  const { w, h } = L.page, m = L.marks, q = L.qr, o = [];
  // สีพิมพ์: ดำ/ขาวตายตัว (ต้องคงคอนทราสต์ให้เครื่องอ่าน) อ้าง token ถ้ามี
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" font-family="Noto Sans Thai, IBM Plex Sans Thai, Sarabun, Thonburi, Tahoma, sans-serif">`,
    `<style>.${uid}k{fill:var(--black,#000)}.${uid}w{fill:var(--white,#fff)}.${uid}l{fill:none;stroke:var(--paper-line,#c7c7cc);stroke-width:.3}.${uid}g{fill:var(--paper-line,#c7c7cc);font-size:3.4px;text-anchor:middle}.${uid}t{fill:var(--black,#000)}</style>`,
    `<rect class="${uid}w" width="${w}" height="${h}"/>`);
  for (const [cx, cy] of m.centres) o.push(`<rect class="${uid}k" x="${cx - m.size / 2}" y="${cy - m.size / 2}" width="${m.size}" height="${m.size}"/>`);
  const qm = encodeQR(payload(L, job, page)), n = qm.length, k = q.size / n;
  o.push(`<rect class="${uid}w" x="${q.x - q.quiet}" y="${q.y - q.quiet}" width="${q.size + 2 * q.quiet}" height="${q.size + 2 * q.quiet}"/>`);
  let d = ''; qm.forEach((row, y) => { let x = 0; while (x < n) { if (!row[x]) { x++; continue; } let e = x; while (e < n && row[e]) e++; d += `M${+(q.x + x * k).toFixed(3)} ${+(q.y + y * k).toFixed(3)}h${+((e - x) * k).toFixed(3)}v${+k.toFixed(3)}h-${+((e - x) * k).toFixed(3)}z`; x = e; } });
  o.push(`<path class="${uid}k" d="${d}"/>`);
  const T = (x, y, s, size, extra = '') => o.push(`<text class="${uid}t" x="${x}" y="${y}" font-size="${size}" ${extra}>${esc(s)}</text>`);
  T(24, 19, `ใบจดค่าหน้างาน · ${L.formName}`, 6, 'font-weight="700"');
  T(24, 27, `งาน: ${job}`, 4.2); T(24, 33, `หน้า ${page}/${pages}`, 4.2);
  T(24, 38.2, 'เขียนตัวเลขทีละช่อง · ติดวงกลม + หรือ − ให้ทึบ · ใช้จดหน้างานเท่านั้น (รายงานทางการออกจากฟอร์มจริง)', 2.8);
  const hdr = L.rows.y0 - 3;
  T(L.rows.txX, hdr, 'Tx / MHz', 3.4, 'font-weight="700"');
  for (const f of L.fields) T(f.x0, hdr, `${f.label} (${f.unit})`, 3.4, 'font-weight="700"');
  rows.forEach((tx, r) => {
    const top = rowTop(L, r), mid = top + L.rows.pitch / 2;
    T(L.rows.txX, mid - 0.4, `Tx ${tx.no}`, 4.4, 'font-weight="700"');
    if (tx.freq != null) T(L.rows.txX, mid + 4, Number(tx.freq).toFixed(3), 3.4);
    for (const c of cells(L, r)) {
      if (c.t === 'b') o.push(`<rect class="${uid}l" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"/>`);
      else if (c.t === 'p' || c.t === 'm') {
        o.push(`<circle class="${uid}l" cx="${c.x + c.w / 2}" cy="${c.y + c.h / 2}" r="${c.w / 2}"/>`);
        o.push(`<text class="${uid}g" x="${c.x + c.w / 2}" y="${c.y + c.h / 2 + 1.2}">${c.t === 'p' ? '+' : '−'}</text>`);
      } else if (c.t === '.') o.push(`<circle class="${uid}k" cx="${c.x + c.w / 2}" cy="${c.y + c.h - 1.2}" r=".55"/>`);
      else if (c.t === '-') o.push(`<rect class="${uid}k" x="${c.x + 0.8}" y="${c.y + c.h / 2 - 0.3}" width="${c.w - 1.6}" height=".6"/>`);
    }
  });
  o.push('</svg>');
  return o.join('');
}
