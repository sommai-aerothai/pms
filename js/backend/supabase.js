// Backend Supabase ด้วย fetch ล้วน (ไม่ใช้ supabase-js) · ชื่อฟังก์ชันตรงกับ demo.js · คืนแถวดิบจากฐาน → store.js แปลงผ่าน shapes.js
// ข้อผิดพลาดทุกแบบ → { code, retryAfter, status, path, detail } · detail = ข้อความ PostgREST/Storage (ไม่มี token)
import { CONFIG } from '../config.js';
import { groupDocs } from '../shapes.js';

const SK = 'pms.session', PAGE = 50, TEMPLATE_KINDS = ['FM', 'WI', 'QP', 'QM'];
const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const fail = (code, retryAfter = 0, more = {}) => { throw { code, retryAfter, ...more }; };
// ข้อความผิดพลาดจากเซิร์ฟเวอร์ (PostgREST: code/message/details/hint · Auth: error/error_description · Storage: error/message) สั้นพอแสดงใน "รายละเอียด"
const why = async r => { const t = await r.text().catch(() => ''); let j = null; try { j = JSON.parse(t); } catch {}
  return (j ? [j.code, j.error, j.message || j.msg, j.error_description, j.details, j.hint].filter(Boolean).join(' · ') : t).slice(0, 300); };
const session = () => ls.get(SK);

// ---- เรียก HTTP กลาง: ใส่ header, ต่ออายุ token, แปลง error ----
async function call(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
  if (!CONFIG.supabaseUrl || !CONFIG.anonKey) fail('server');
  if (navigator.onLine === false) fail('offline');
  let s = session();
  if (auth && s && s.expires_at * 1000 < Date.now() + 30000) s = await refresh();
  const h = { apikey: CONFIG.anonKey, ...((auth && s && s.access_token) ? { Authorization: `Bearer ${s.access_token}` } : {}), ...headers };   // publishable key ส่งเฉพาะ apikey · Bearer เฉพาะเมื่อมี token ผู้ใช้
  if (body !== undefined && !(body instanceof Blob)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  let r;
  const at = path.split('?')[0];   // path ไม่รวม query (กันข้อมูลค้นหา/ตัวกรองหลุดไปในข้อความ)
  try { r = await fetch(CONFIG.supabaseUrl + path, { method, headers: h, body }); } catch { fail('offline', 0, { path: at }); }
  if (r.ok) return raw ? r : (r.status === 204 ? null : r.json().catch(() => null));
  const more = { status: r.status, path: at, detail: await why(r) };
  if (r.status === 401 || r.status === 403 || (!auth && r.status < 500 && r.status !== 429)) fail('auth', 0, more);   // เข้าสู่ระบบ/refresh ที่ถูกปฏิเสธ (400 invalid_credentials) = auth
  if (r.status === 404) fail('notfound', 0, more);
  if (r.status === 422) fail('invalid', 0, more);   // เช่น รหัสผ่านใหม่ซ้ำกับรหัสเดิม/อ่อนเกิน
  if (r.status === 429) fail('throttled', +r.headers.get('Retry-After') || 30, more);
  fail('server', 0, more);
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

// ---- ข้อมูล (แถวดิบ · shapes.js แปลงที่ store.js) ----
// catalog = ระบบ + examples (เฉพาะคอลัมน์ที่ใช้นับ) → shapes.catalog คิดจำนวน/ปีต่อระบบ
export const getCatalog = async () => {
  const [systems, examples] = await Promise.all([rest('systems?order=seq&select=*'), rest('examples?select=system_id,fiscal_year')]);
  return { systems, examples };
};
// เรียงตาม id (ไม่ซ้ำ ไม่เป็น null) → แบ่งหน้าคงที่ · Content-Range = "0-49/123" หรือ "*/0" · อ่านไม่ได้ = ดูจากจำนวนแถวที่ได้
const totalOf = r => { const m = /\/(\d+)\s*$/.exec(r.headers.get('Content-Range') || ''); return m ? +m[1] : null; };
export const listDocs = async ({ kind, cursor = 0 } = {}) => {
  const r = await rest(`documents?select=*&is_current=eq.true&order=id${kind ? `&kind=eq.${encodeURIComponent(kind)}` : ''}`, { headers: { Range: `${cursor}-${cursor + PAGE - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' }, raw: true });
  const items = (await r.json().catch(() => null)) || [], total = totalOf(r), more = total == null ? items.length === PAGE : cursor + items.length < total;
  return { items, next: more && items.length ? cursor + items.length : null };
};
export const listTemplates = async () => rest(`documents?select=*&is_current=eq.true&kind=in.(${TEMPLATE_KINDS.join(',')})&order=id`);
export const listExamples = ({ system_id } = {}) => rest(`examples?select=*&order=created_at.desc,id${system_id ? `&system_id=eq.${encodeURIComponent(system_id)}` : ''}`);
export const getFiles = async () => {   // หมวดเอกสารหน้า "เอกสาร" — ทุกหน้าจนครบ แล้วจัดกลุ่มด้วย KIND_CAT (shapes.js)
  const all = []; let cur = 0;
  do { const p = await listDocs({ cursor: cur }); all.push(...p.items); cur = p.next; } while (cur != null);
  return groupDocs(all);
};

// ---- งาน PM ----  data = ก้อน job ทั้งหมด (schema:1) · updated_at ใช้ตรวจชนกัน · systems(name) = ชื่อระบบ (FK system_id) → shapes.job
export const listJobs = async () => rest('jobs?select=*,systems(name)&order=updated_at.desc,id');
export const getJob = async id => { const [r] = await rest(`jobs?id=eq.${encodeURIComponent(id)}&select=*,systems(name)`); return r || fail('notfound'); };
export const putJob = async job => {
  const { updated_at, ...data } = job, now = new Date().toISOString();
  const r = await rest(`jobs?id=eq.${encodeURIComponent(job.id)}&updated_at=eq.${encodeURIComponent(updated_at)}`, { method: 'PATCH', body: { data, updated_at: now }, headers: { Prefer: 'return=representation' } });
  if (!r.length) fail('conflict');   // มีคนแก้ก่อน (หรือไม่มีแถว) → ห้ามเขียนทับเงียบๆ
  return { ...job, updated_at: now };
};

// ---- ไฟล์ (bucket private → signed URL อายุ 10 นาที) ----
// bucket มาจากชนิดข้อมูลเสมอ (docs = เอกสารเว็บกอง · examples = ตัวอย่างรายงาน · jobs = ไฟล์งาน) ห้ามเดาจากส่วนแรกของ storage_path
// (ตัวอัปโหลด sync/upload_supabase.py เก็บ storage_path = 'FM/<ไฟล์>' ใน bucket docs)
const enc = p => String(p).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
export const signUrl = async (bucket, path) => {
  if (!bucket || !path) return null;
  const j = await call(`/storage/v1/object/sign/${bucket}/${enc(path)}`, { method: 'POST', body: { expiresIn: 600 } });
  return j && j.signedURL ? CONFIG.supabaseUrl + '/storage/v1' + j.signedURL : fail('server', 0, { path: `/storage/v1/object/sign/${bucket}`, detail: 'ไม่มี signedURL ในคำตอบ' });
};
export const getDocUrl = path => signUrl('docs', path);
export const getBlob = async (bucket, path) => { const u = await signUrl(bucket, path); if (!u) fail('notfound'); try { const r = await fetch(u); if (!r.ok) fail(r.status === 404 ? 'notfound' : 'server', 0, { status: r.status, path: `/storage/v1/object/${bucket}` }); return r.blob(); } catch (e) { throw e.code ? e : { code: 'offline', retryAfter: 0 }; } };
export const putAttachment = async (jobId, file, meta = {}) => {
  const name = `${Date.now()}-${file.name || 'file'}`.replace(/[^\w.-]/g, '_');
  await call(`/storage/v1/object/jobs/${jobId}/${name}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  const [row] = await rest('attachments', { method: 'POST', body: { job_id: +jobId, kind: meta.kind, label: meta.label, storage_path: `${jobId}/${name}`, created_by: session()?.user?.id }, headers: { Prefer: 'return=representation' } });
  return row;
};
