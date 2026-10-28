// Backend Supabase ด้วย fetch ล้วน (ไม่ใช้ supabase-js) · ชื่อฟังก์ชันตรงกับ demo.js · ข้อผิดพลาดทุกแบบ → { code, retryAfter }
import { CONFIG } from '../config.js';
import { genericJob } from './demo.js';
export { genericJob };

const SK = 'pms.session', PAGE = 50, TEMPLATE_KINDS = ['FM', 'WI', 'QP', 'QM'];
const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const fail = (code, retryAfter = 0) => { throw { code, retryAfter }; };
const session = () => ls.get(SK);

// ---- เรียก HTTP กลาง: ใส่ header, ต่ออายุ token, แปลง error ----
async function call(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
  if (!CONFIG.supabaseUrl || !CONFIG.anonKey) fail('server');
  if (navigator.onLine === false) fail('offline');
  let s = session();
  if (auth && s && s.expires_at * 1000 < Date.now() + 30000) s = await refresh();
  const h = { apikey: CONFIG.anonKey, Authorization: `Bearer ${(auth && s && s.access_token) || CONFIG.anonKey}`, ...headers };
  if (body !== undefined && !(body instanceof Blob)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  let r;
  try { r = await fetch(CONFIG.supabaseUrl + path, { method, headers: h, body }); } catch { fail('offline'); }
  if (r.ok) return raw ? r : (r.status === 204 ? null : r.json().catch(() => null));
  if (r.status === 401 || r.status === 403 || (!auth && r.status < 500 && r.status !== 429)) fail('auth');   // เข้าสู่ระบบ/refresh ที่ถูกปฏิเสธ (400 invalid_credentials) = auth
  if (r.status === 404) fail('notfound');
  if (r.status === 422) fail('invalid');   // เช่น รหัสผ่านใหม่ซ้ำกับรหัสเดิม/อ่อนเกิน
  if (r.status === 429) fail('throttled', +r.headers.get('Retry-After') || 30);
  fail('server');
}
const rest = (q, o) => call('/rest/v1/' + q, o);

// ---- เข้าสู่ระบบ (ชื่อผู้ใช้ = อีเมล + รหัสผ่าน · แอดมินสร้างบัญชี ไม่มีสมัครเอง) ----
const keep = j => { const s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + j.expires_in, user: j.user }; ls.set(SK, s); return s; };
export const signIn = async (email, password) => keep(await call('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));
export const changePassword = async password => { if (String(password).length < 8) fail('invalid'); await call('/auth/v1/user', { method: 'PUT', body: { password } }); };
export async function refresh() {
  const s = session(); if (!s) fail('auth');
  try { return keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } })); }
  catch (e) { if (e.code !== 'offline') localStorage.removeItem(SK); throw e; }   // offline = เก็บ session ไว้ · ปฏิเสธจริง = ล้าง
}
export const signOut = async () => { try { localStorage.removeItem(SK); } catch {} };
export const me = async () => { const s = session(); if (!s) fail('auth'); const [p] = await rest(`profiles?id=eq.${s.user.id}&select=*`); return p || fail('notfound'); };   // p.approved=false → หน้า "รออนุมัติ"

// ---- ข้อมูล ----
export const getCatalog = async () => {
  const rows = await rest('systems?order=seq&select=*');
  return { schema: 1, systems: rows.map(r => ({ id: r.id, name: r.name, loc: r.location || '', icon: 'radio', count: 0, years: [] })) };   // ponytail: ไอคอน/จำนวน/ปี รอ view ฝั่ง server
};
const docRow = d => ({ schema: 1, id: String(d.id), code: d.code, rev: d.rev, title: d.title, kind: d.kind, sha256: d.sha256, size: d.size, storage_path: d.storage_path, fetchedAt: d.fetched_at, sourceUrl: d.source_url });
export const listDocs = async ({ kind, cursor = 0 } = {}) => {
  const r = await rest(`documents?select=*&is_current=eq.true&order=code${kind ? `&kind=eq.${kind}` : ''}`, { headers: { Range: `${cursor}-${cursor + PAGE - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' }, raw: true });
  const items = (await r.json()).map(docRow), total = +(r.headers.get('Content-Range') || '').split('/')[1];
  return { items, next: cursor + PAGE < total ? cursor + PAGE : null };
};
export const listTemplates = async () => (await rest(`documents?select=*&is_current=eq.true&kind=in.(${TEMPLATE_KINDS.join(',')})&order=code`)).map(docRow);
export const listExamples = ({ system_id } = {}) => rest(`examples?select=*&order=created_at.desc${system_id ? `&system_id=eq.${encodeURIComponent(system_id)}` : ''}`);
export const getFiles = async () => {   // หมวดเอกสารหน้า "เอกสาร" — จัดกลุ่มตาม kind
  const all = []; let cur = 0;
  do { const p = await listDocs({ cursor: cur }); all.push(...p.items); cur = p.next; } while (cur);
  const by = {};
  all.forEach(d => (by[d.kind] ||= []).push({ ...d, cat: d.kind.toLowerCase(), offline: false }));
  return Object.entries(by).map(([k, rows]) => ({ id: k.toLowerCase(), name: k, total: rows.length, rows }));   // ponytail: หน้าแรก 50 แถว · เพิ่มหน้าเมื่อเอกสารเกิน
};

// ---- งาน PM ----  data = ก้อน job ทั้งหมด (schema:1) · updated_at ใช้ตรวจชนกัน
const jobRow = r => ({ ...genericJob(String(r.id), r.system_id, r.system_id, `${r.round}/${String(r.fiscal_year).slice(-2)}`, [r.date_start, r.date_end], { draft: 'todo', accepted: 'done', submitted: 'done' }[r.status] || 'doing', r.updated_at), ...r.data, id: String(r.id), updated_at: r.updated_at });
export const listJobs = async () => (await rest('jobs?select=*&order=updated_at.desc')).map(jobRow);
export const getJob = async id => { const [r] = await rest(`jobs?id=eq.${encodeURIComponent(id)}&select=*`); return r ? jobRow(r) : fail('notfound'); };
export const putJob = async job => {
  const { updated_at, ...data } = job, now = new Date().toISOString();
  const r = await rest(`jobs?id=eq.${encodeURIComponent(job.id)}&updated_at=eq.${encodeURIComponent(updated_at)}`, { method: 'PATCH', body: { data, updated_at: now }, headers: { Prefer: 'return=representation' } });
  if (!r.length) fail('conflict');   // มีคนแก้ก่อน (หรือไม่มีแถว) → ห้ามเขียนทับเงียบๆ
  return { ...job, updated_at: now };
};

// ---- ไฟล์ (bucket private → signed URL อายุ 10 นาที) ----
const bucketPath = p => { const i = p.indexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };   // storage_path = '<bucket>/<path>'
export const getDocUrl = async storage_path => {
  if (!storage_path) return null;
  const [b, p] = bucketPath(storage_path), j = await call(`/storage/v1/object/sign/${b}/${p}`, { method: 'POST', body: { expiresIn: 600 } });
  return CONFIG.supabaseUrl + '/storage/v1' + j.signedURL;
};
export const getBlob = async path => { const u = await getDocUrl(path); if (!u) fail('notfound'); try { const r = await fetch(u); if (!r.ok) fail(r.status === 404 ? 'notfound' : 'server'); return r.blob(); } catch (e) { throw e.code ? e : { code: 'offline', retryAfter: 0 }; } };
export const putAttachment = async (jobId, file, meta = {}) => {
  const name = `${Date.now()}-${file.name || 'file'}`.replace(/[^\w.-]/g, '_');
  await call(`/storage/v1/object/jobs/${jobId}/${name}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  const [row] = await rest('attachments', { method: 'POST', body: { job_id: +jobId, kind: meta.kind, label: meta.label, storage_path: `jobs/${jobId}/${name}`, created_by: session()?.user?.id }, headers: { Prefer: 'return=representation' } });
  return row;
};
