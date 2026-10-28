// แถวรูปเดียวกับฐานจริง (backend/supabase-schema.sql: snake_case · id ตัวเลข · null ได้) + fetch ปลอมของ Supabase REST/Storage
// ใช้ทั้ง tests/contract.test.mjs (node) และ tests/real-shapes.e2e.html (เบราว์เซอร์)
export const SYSTEMS = [['DM-RX-RADIO-MAIN', 1, 'DM RX Radio Main', 'หอฯ ด้านทิศใต้ ชั้น ๒'], ['DM-TX-RADIO-STBY', 4, 'DM TX Radio STBY', 'สถานีเครื่องส่ง'], ['DM-CCTV', 6, 'DM CCTV', null], ['DM-VCCS', 10, 'DM VCCS', 'หอฯ ด้านทิศใต้']]
  .map(([id, seq, name, location]) => ({ id, site: 'DM', seq, name, location, forms: [] }));
const KINDS = ['FM', 'WI', 'QP', 'QM', 'SD', 'ANNOUNCE', 'PLANPM', 'TABLEPM', 'FLOWPM', 'MANUAL'];
export const DOCUMENTS = Array.from({ length: 60 }, (_, i) => {   // 60 แถว = 2 หน้า (PAGE 50) · ทุก kind · code/storage_path/title/fetched_at null ปน
  const kind = KINDS[i % KINDS.length], noCode = ['ANNOUNCE', 'PLANPM', 'TABLEPM', 'FLOWPM', 'MANUAL'].includes(kind) || i === 3;
  return { id: 1000 + i, kind, code: noCode ? null : `${kind}-CE.SE-${String(i).padStart(3, '0')}`, rev: i % 3 ? String(i % 9).padStart(2, '0') : null, title: i === 7 ? null : `เอกสาร ${kind} ${i}`, file: `x${i}.pdf`,
    source_url: i === 11 ? 'javascript:alert(1)' : `https://home.aerothai.co.th/cese/sites/cese/files/documents/${kind}/x${i}.pdf`, sha256: 'a'.repeat(64), size: 1234 + i,
    storage_path: i % 4 === 0 ? null : `${kind}/${'a'.repeat(12)}-ไฟล์ ${i}.pdf`, fetched_at: i === 5 ? null : '2026-10-28T02:00:00+00:00', is_current: true };
});
export const EXAMPLES = [
  { id: 5, system_id: 'DM-TX-RADIO-STBY', fiscal_year: 2569, round: 2, title: 'PM DM TX Radio STBY ครั้งที่ 2/69', pages: 21, storage_path: 'DM-TX-RADIO-STBY/2569-2.pdf', origin: 'sharepoint', uploaded_by: 'u1', created_at: '2026-10-28T03:00:00+00:00' },
  { id: 6, system_id: 'DM-TX-RADIO-STBY', fiscal_year: 2568, round: 1, title: null, pages: null, storage_path: null, origin: 'upload', uploaded_by: null, created_at: '2026-10-27T03:00:00+00:00' },
];
export const JOBS = [];
export const SIGNED = [];   // path ที่ขอ signed URL (ตรวจ bucket)
export const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
export async function fakeFetch(url, opt = {}) {
  const u = new URL(url), p = u.pathname, q = u.searchParams, h = opt.headers || {};
  if (p.startsWith('/storage/v1/object/sign/')) {
    if (opt.method === 'POST') { SIGNED.push(decodeURIComponent(p)); return json({ signedURL: p.replace('/storage/v1', '') + '?token=fake' }); }
    return new Response(PDF, { headers: { 'Content-Type': 'application/pdf' } });   // เปิด signed URL = ไฟล์ PDF
  }
  if (p === '/rest/v1/systems') return json(SYSTEMS);
  if (p === '/rest/v1/examples') return json(q.get('select') === 'system_id,fiscal_year' ? EXAMPLES.map(({ system_id, fiscal_year }) => ({ system_id, fiscal_year })) : EXAMPLES);
  if (p === '/rest/v1/jobs') return json(JOBS);
  if (p === '/rest/v1/documents') {
    let rows = DOCUMENTS.filter(d => d.is_current); const k = q.get('kind');
    if (k && k.startsWith('in.(')) { const L = k.slice(4, -1).split(','); rows = rows.filter(d => L.includes(d.kind)); } else if (k && k.startsWith('eq.')) rows = rows.filter(d => d.kind === k.slice(3));
    if (q.get('order') === 'id') rows = [...rows].sort((a, b) => a.id - b.id);
    if (!h.Range) return json(rows);
    const [a, b] = h.Range.split('-').map(Number), page = rows.slice(a, b + 1);
    return json(page, page.length < rows.length ? 206 : 200, { 'Content-Range': page.length ? `${a}-${a + page.length - 1}/${rows.length}` : `*/${rows.length}` });
  }
  return json({ code: 'PGRST205', message: `Could not find the table 'public.${p.split('/').pop()}' in the schema cache`, details: null, hint: null }, 404);
}
