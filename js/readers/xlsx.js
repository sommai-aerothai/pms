// อ่าน .xlsx → { sheets:[{name, hidden, cells:{A1:value}}] } · ค่าเป็น number | string
import { unzip, xml } from './zip.js';

const txt = el => [...el.getElementsByTagName('t')].filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join('');   // รวม rich-text runs, ข้าม phonetic

export async function readXlsx(buf) {
  const z = await unzip(buf);
  if (!z.has('xl/workbook.xml')) throw new Error('ไม่ใช่ xlsx');
  const sst = z.has('xl/sharedStrings.xml') ? [...xml(await z.text('xl/sharedStrings.xml')).getElementsByTagName('si')].map(txt) : [];
  const wb = xml(await z.text('xl/workbook.xml'));
  const rels = {};
  for (const r of xml(await z.text('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  const sheets = [];
  for (const s of wb.getElementsByTagName('sheet')) {
    let t = rels[s.getAttribute('r:id')] || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
    const raw = await z.text(t); if (!raw) continue;
    const cells = {};
    for (const c of xml(raw).getElementsByTagName('c')) {
      const type = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent;
      let val;
      if (type === 'inlineStr') val = txt(c);
      else if (v == null) continue;
      else if (type === 's') val = sst[+v];
      else if (type === 'str' || type === 'e') val = v;
      else if (type === 'b') val = v === '1';
      else val = +v;
      if (val !== '' && val != null) cells[c.getAttribute('r')] = val;
    }
    sheets.push({ name: s.getAttribute('name'), hidden: s.getAttribute('state') === 'hidden' || s.getAttribute('state') === 'veryHidden', cells });
  }
  return { sheets };
}

export const num = v => typeof v === 'number' ? v : (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? +v : null);
export const rnd = v => Math.round(v * 1e6) / 1e6;   // 132.05000000000001 → 132.05
