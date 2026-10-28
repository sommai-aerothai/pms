// PDF: AcroForm ก่อน แล้วข้อความทีละหน้า · pdf.js (legacy build) โหลดเมื่อใช้จริงเท่านั้น
import { detectForm } from './forms.js';

let lib;
const load = () => lib || (lib = import('../../vendor/pdfjs/pdf.min.mjs').then(m => {
  m.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  return m;
}));

const MAX_PAGES = 40;

export async function readPdf(buf) {
  const pdfjs = await load();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: false }).promise;
  try {
    const values = [];
    const fo = await doc.getFieldObjects().catch(() => null);
    if (fo) for (const [name, arr] of Object.entries(fo)) for (const f of arr) {
      const v = f.value; if (v == null || v === '' || v === 'Off') continue;
      values.push({ field: name, value: Array.isArray(v) ? v.join(', ') : v, locator: `AcroForm:${name}`, confidence: 'high' });
    }
    const pages = [], forms = [], fieldPage = {};
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      const pg = await doc.getPage(i);
      if (values.length) for (const a of await pg.getAnnotations()) if (a.fieldName) fieldPage[a.fieldName] ??= i;
      const tc = await pg.getTextContent();
      let s = '';
      for (const it of tc.items) s += it.str + (it.hasEOL ? '\n' : ' ');
      pages.push(s);
      const d = detectForm(s); if (d) forms.push({ form: d.form, rev: d.rev, page: i });
    }
    for (const v of values) {   // ผูกค่า AcroForm กับหน้า/ฟอร์มของมัน (PDF รวมหลายฟอร์ม)
      const pg = fieldPage[v.field]; if (!pg) continue;
      v.page = pg; v.form = forms.filter(f => f.page <= pg).pop()?.form;
    }
    return { values, forms, text: pages.map((s, i) => `--- หน้า ${i + 1} ---\n${s}`).join('\n'), numPages: doc.numPages, hasText: pages.some(s => s.trim().length > 20) };
  } finally { doc.destroy(); }
}
