// รัน: node tests/report/fm202-pdf.test.mjs · ตำแหน่งช่องบน PDF FM-202 (หน้า "บนฟอร์ม") + ช่องเพิ่ม (EXTRA) ลง Excel
import { cells202, map202, PDF202, EXTRA } from '../../js/report/fm202.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const job = { round: '2/69', pm: { base: 'DM TX', people: ['ก'] },
  tx: Array.from({ length: 21 }, (_, i) => ({ n: i + 1, freq: 118 + i, model: 'PAE', v: i === 0 ? { asset: '007', spur: '-66', C: 'M', D: '01', J: '3' } : {} })) };
const c0 = cells202(job, 0), c1 = cells202(job, 1), G = PDF202;
ok(G.x.length === 23 && G.y.length === G.rows + 1, 'เส้นตาราง 23 คอลัมน์ (A–V) · 20 แถว');
ok(new Set(c0.map(x => x.n)).size === 20 && c1.every(x => x.n === 21) && c1[0].y === G.y[0], 'หน้า 1 = Tx 1–20 · สำเนาหน้า 2 เริ่ม Tx 21 ที่แถวบนสุด');
ok(c0.filter(x => x.col).every(x => x.x >= G.x[0] && x.x + x.w <= G.x[22] + .01 && x.y >= G.y[0] && x.y + x.h <= G.y[20] + .01), 'ทุกช่องอยู่ในตาราง');
const at = (n, k) => c0.find(x => x.n === n && x.k === k);
ok(at(1, 'spur').col === 'O' && at(1, 'spur').num && at(1, 'asset').col === 'G' && !at(1, 'asset').num && at(1, 'asset').v === '007', 'Spurious = O ตัวเลข · Asset = G ข้อความ (0 นำหน้าอยู่)');
ok(at(1, 'C').num === false && at(1, 'J').num === true && c0.filter(x => x.n === 1 && x.ro).map(x => x.col).join() === 'A,B,E', 'M/S ข้อความ · Adj ตัวเลข · NO/Freq/Model อ่านอย่างเดียว');
ok(c0.filter(x => x.n === 1).map(x => x.col).join('') === 'ABCDEFGHIJKLMNOPQRSTUV', 'แถวละ 22 ช่อง ครบ A–V ไม่ซ้ำ');
ok(at(1, 'sens') && at(1, 'sens').x >= G.x[22] && at(1, 'sens').x + at(1, 'sens').w <= G.w, 'Sensitivity (ไม่มีช่องในฟอร์ม) = คอลัมน์เสริมขอบขวา ในหน้ากระดาษ');
const e = map202(job).edits['Page 1'];
ok(e.C9 === 'M' && e.D9 === '01' && e.J9 === 3 && e.O9 === 66, 'ช่องเพิ่มลง Excel: C9 = M · D9 = "01" (ข้อความ 0 นำหน้าอยู่) · J9 = 3 · Spurious ขนาดบวก');
console.log(fail ? `FAIL ${fail}` : 'PASS'); process.exit(fail ? 1 : 0);
