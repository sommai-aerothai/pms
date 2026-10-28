// อ่าน .docx → ข้อความ (ย่อหน้า + เซลล์ตาราง) + รหัสฟอร์มจากเนื้อหา/หัวกระดาษ
import { unzip, xml } from './zip.js';

const paras = doc => [...doc.getElementsByTagName('w:p')].map(p => [...p.getElementsByTagName('w:t')].map(t => t.textContent).join('')).filter(s => s.trim());

export async function readDocx(buf) {
  const z = await unzip(buf);
  if (!z.has('word/document.xml')) throw new Error('ไม่ใช่ docx');
  let lines = paras(xml(await z.text('word/document.xml')));
  const head = [];
  for (const n of z.names.filter(n => /^word\/header\d*\.xml$/.test(n))) head.push(...paras(xml(await z.text(n))));
  return { text: lines.join('\n'), headerText: head.join('\n') };
}
