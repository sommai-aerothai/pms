// รัน: node tests/report/fm202.test.mjs   (ต้องมี docstore ของกองในเครื่อง · ไม่มี = SKIP exit 0)
// เติมฟอร์มเปล่า FM-202 Rev.03 จริงด้วยงานสมมุติ (ค่าปลอมทั้งหมด) → เปิดกลับด้วยตัวอ่าน xlsx ของแอป → เทียบทุกช่อง
// ตั้ง OUT=โฟลเดอร์ เพื่อเก็บ .xlsx/.pdf/.png ไว้ดู · มี soffice+pdftoppm = แปลง PDF และเรนเดอร์หน้า 1
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fill202, SHEETS, PER_PAGE } from '../../js/report/fm202.js';
import { unzip } from '../../js/readers/zip.js';

const TPL = process.env.FM202 || fileURLToPath(new URL('../../../docstore/FM/FM-CE.SE-202 แบบฟอร์ม PM Tx Radio Rev.03.xlsx', import.meta.url));
if (!existsSync(TPL)) { console.log('SKIP ไม่มีฟอร์มเปล่าใน docstore:', TPL); process.exit(0); }

// DOMParser ขั้นต่ำสำหรับ node (เฉพาะที่ readers/xlsx.js ใช้: getElementsByTagName / getAttribute / textContent / parentNode.localName)
const ent = s => s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e]);
class El {
  constructor(tag, attrs, parentNode) { Object.assign(this, { tagName: tag, localName: tag.split(':').pop(), attrs, parentNode, kids: [] }); }
  getAttribute(n) { return this.attrs[n] ?? null; }
  getElementsByTagName(n) { const o = []; const w = e => { for (const k of e.kids) if (k instanceof El) { if (k.tagName === n) o.push(k); w(k); } }; w(this); return o; }
  get textContent() { return this.kids.map(k => k instanceof El ? k.textContent : k).join(''); }
}
globalThis.DOMParser = class { parseFromString(s) {
  const doc = new El('#document', {}, null); let cur = doc;
  for (const m of s.matchAll(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g)) {
    if (m[5] != null) { cur.kids.push(ent(m[5])); continue; } if (!m[2]) continue;
    if (m[1]) { cur = cur.parentNode; continue; }
    const a = {}; for (const x of (m[3] || '').matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) a[x[1]] = ent(x[2]);
    const e = new El(m[2], a, cur); cur.kids.push(e); if (!m[4]) cur = e;
  }
  return doc;
} };
const { readXlsx } = await import('../../js/readers/xlsx.js');

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.error('FAIL', m); } else console.log('PASS', m); };

// งานสมมุติ: 21 เครื่อง (ข้ามไปหน้า 2) + 1 เครื่องเกินฟอร์ม · ค่าวัดปลอมสร้างจากสูตร ไม่ใช่ค่าจริง
const tx = Array.from({ length: 21 }, (_, i) => ({ n: i + 1, freq: +(118 + i * 0.725).toFixed(3), model: 'DEMO-TX', reg: `TEST-${100 + i}`,
  v: { asset: i === 2 ? '' : `00${7000 + i}`, serial: `SN-TEST-${i}`, err: String((i % 7) - 3.5), osc: '5.01', pow: String(15 + i / 10), spur: String(-61 - i), mod: '88.5', sens: '-104', dist: '1.2', tout: i === 4 ? '' : '180' } }));
tx.push({ n: 40, freq: 140, model: 'X', reg: 'X', v: {} });
const job = { round: '9/99', pm: { base: 'DM TEST Radio (สถานีทดสอบ)', people: ['ทดสอบ หนึ่ง', 'ทดสอบ สอง'] }, tx };

const tpl = readFileSync(TPL), out = await fill202(tpl, job);
ok(out.pages === 2, 'ใช้ 2 หน้า');
ok(out.missing.some(s => s.startsWith('Tx 40')) && out.missing.some(s => s.startsWith('Tx 5 ') && /Time out/.test(s)) && out.missing.some(s => /Sensitivity/.test(s)), 'รายงานสิ่งที่วางไม่ได้: Tx 40 เกินฟอร์ม, Tx 5 ไม่มี Time out, sens ไม่มีช่อง');

// 1) ทุกค่าลงช่องที่ถูก (อ่านกลับด้วยตัวอ่านของแอป)
const back = await readXlsx(out.bytes), sh = Object.fromEntries(back.sheets.map(s => [s.name, s.cells]));
let n = 0, bad = [];
for (const [s, cells] of Object.entries(out.edits)) for (const [ref, v] of Object.entries(cells)) { n++; if (sh[s][ref] !== v) bad.push(`${s}!${ref}: ${sh[s][ref]} ≠ ${v}`); }
ok(!bad.length && n === 21 * 11 - 2 + 4, `ค่า ${n} ช่องลงตรงตำแหน่ง ${bad.slice(0, 3).join(' | ')}`);
ok(sh['Page 1'].O9 === 61 && sh['Page 1'].G9 === '007000' && sh['Page 1'].G11 === undefined && out.missing.some(s => s.startsWith('Tx 3 ') && /Asset/.test(s)), 'Spurious เขียนเป็นขนาดบวกตามฟอร์มจริง · Asset เป็นข้อความ (0 นำหน้าอยู่) · ไม่ตรวจ = ว่าง+รายงาน');
ok(sh['Page 1'].I9 === -3.5 && sh['Page 1'].B25 === tx[16].freq && sh['Page 2'].B9 === tx[17].freq && sh['Page 2'].A9 === 18 && sh['Page 2'].M12 === 17, 'Tx 1-17 หน้า 1 · Tx 18-21 หน้า 2 แถว 9-12 (NO เดิมของฟอร์ม)');
ok(sh['Page 1'].A4 === 'MaintID PM DM TEST Radio ครั้งที่ 9/99' && /^ผู้ปฏิบัติ\s+1\. ทดสอบ หนึ่ง\s+2\. ทดสอบ สอง$/.test(sh['Page 2'].A27), 'หัวฟอร์ม + ผู้ปฏิบัติ ทั้ง 2 หน้า (เลขอารบิก)');

// 2) ส่วนอื่นเหมือนต้นฉบับทุกไบต์: ไฟล์อื่นใน zip เท่ากัน · ในชีต ตัดช่องที่แก้ออกแล้วต้องเท่ากัน · s= ของช่องที่แก้คงเดิม
const a = await unzip(tpl), b = await unzip(out.bytes);
ok(a.names.join('|') === b.names.join('|'), 'ลำดับไฟล์ใน zip เท่าเดิม');
const wbx = await a.text('xl/workbook.xml'), sheetFile = { 'Page 1': 'xl/worksheets/sheet1.xml', 'Page 2': 'xl/worksheets/sheet2.xml' };
ok(SHEETS.every(s => new RegExp(`name="${s}"[^>]*r:id="rId${SHEETS.indexOf(s) + 1}"`).test(wbx)), 'ชีต Page 1/2 = sheet1/2.xml');
const changed = new Set(Object.values(sheetFile)); let same = true;
for (const nm of a.names) if (!changed.has(nm)) { const x = await a.read(nm), y = await b.read(nm); if (Buffer.compare(Buffer.from(x), Buffer.from(y))) { same = false; console.error('  ต่าง:', nm); } }
ok(same, 'ไฟล์อื่นทั้งหมด (styles, sharedStrings, drawings, printerSettings …) ไบต์เท่าเดิม');
const cellRe = /<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
for (const [s, p] of Object.entries(sheetFile)) {
  const ed = out.edits[s] || {}, X = await a.text(p), Y = await b.text(p);
  const strip = t => t.replace(cellRe, (c, r) => r in ed ? `<${r}/>` : c);
  ok(strip(X) === strip(Y), `${s}: ทุกส่วนนอกช่องที่แก้ ไบต์เท่าเดิม`);
  const sOf = t => Object.fromEntries([...t.matchAll(cellRe)].map(m => [m[1], (/ s="(\d+)"/.exec(m[0]) || [])[1]]));
  const sa = sOf(X), sb = sOf(Y); ok(Object.keys(ed).every(r => sa[r] !== undefined && sa[r] === sb[r]), `${s}: s= ของช่องที่แก้คงเดิม (${Object.keys(ed).length} ช่อง)`);
}
const xfs = async z => (/<cellXfs count="(\d+)"/.exec(await z.text('xl/styles.xml')) || [])[1];
ok(await xfs(a) === await xfs(b), `styles cellXfs เท่าเดิม (${await xfs(a)})`);

// 3) LibreOffice เปิดได้ + เรนเดอร์หน้า 1
const dir = process.env.OUT || mkdtempSync(join(tmpdir(), 'fm202-')), xf = join(dir, 'fm202-test.xlsx');
writeFileSync(xf, out.bytes); console.log('ไฟล์:', xf);
const has = c => { try { execFileSync('which', [c]); return true; } catch { return false; } };
if (has('soffice') && has('pdftoppm')) {
  let code = 0; try { execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, xf], { stdio: 'pipe', timeout: 120000 }); } catch (e) { code = e.status || 1; }
  const pdf = join(dir, 'fm202-test.pdf'); ok(code === 0 && existsSync(pdf), `soffice → PDF (exit ${code})`);
  if (existsSync(pdf)) { execFileSync('pdftoppm', ['-png', '-r', '80', '-f', '1', '-l', '1', pdf, join(dir, 'fm202-p')]); console.log('PNG หน้า 1:', join(dir, 'fm202-p-1.png')); }
} else console.log('SKIP soffice/pdftoppm ไม่มีในเครื่อง');

console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
