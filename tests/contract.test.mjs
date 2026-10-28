// รัน: node tests/contract.test.mjs   (ไม่มี dependency)
// สัญญา store ↔ หน้าจอ: ทั้ง demo และ supabase ต้องคืนโครงเดียวกัน (js/shapes.js)
// supabase ใช้ fetch ปลอมที่คืนแถว "รูปเดียวกับฐานจริง" ตาม backend/supabase-schema.sql (snake_case · id ตัวเลข · null ได้)
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, key: i => Object.keys(mem)[i], get length() { return Object.keys(mem).length; } };
const store = await import('../js/store.js');
const sh = await import('../js/shapes.js');
const F = await import('../js/flow.js');
const { CONFIG } = await import('../js/config.js');
const { fakeFetch, SIGNED, json } = await import('./fixtures/supabase-rows.mjs');

let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('PASS', m); };
const VIEW_CATS = new Set(sh.DOC_GROUPS.flatMap(g => g[2].map(x => x[0])).filter(id => id !== 'reports'));   // หมวดที่หน้า "เอกสาร" แสดง

// ---------- ตรวจโครง ----------
const isStr = x => typeof x === 'string', isNumOrNull = x => x === null || typeof x === 'number', isStrOrNull = x => x === null || typeof x === 'string';
const docOk = (d, catId) => isStr(d.id) && d.id && isStr(d.title) && isStr(d.name) && isStr(d.code) && isStr(d.rev) && isStr(d.tag) && d.cat === catId && isStr(d.sourceUrl) && (d.sourceUrl === '' || /^https?:/.test(d.sourceUrl))
  && isStrOrNull(d.storagePath) && d.bucket === 'docs' && isNumOrNull(d.pages) && isStrOrNull(d.fetchedAt) && typeof d.offline === 'boolean';
const reportOk = r => isStr(r.id) && isStr(r.title) && r.title && isStr(r.system) && isNumOrNull(r.year) && isStr(r.round) && isNumOrNull(r.pages) && isNumOrNull(r.crew) && (r.status === null || ['draft', 'review', 'accepted'].includes(r.status))
  && isStr(r.modified) && Array.isArray(r.performers) && (r.dates === null || Array.isArray(r.dates)) && isStrOrNull(r.storagePath) && r.bucket === 'examples';
const sysOk = s => isStr(s.id) && isStr(s.name) && isStr(s.loc) && isStr(s.icon) && typeof s.count === 'number' && Array.isArray(s.years) && s.years.every(y => typeof y.year === 'number' && typeof y.count === 'number');
const jobOk = j => j.schema === 2 && isStr(j.id) && isStr(j.title) && ['doing', 'submitted', 'done'].includes(j.status) && isStr(j.touched) && Array.isArray(j.forms) && j.pm && Array.isArray(j.files);

async function contract(be) {
  localStorage.setItem('pms.backend', be);
  const [reports, templates, catalog, cats, jobs] = await Promise.all([store.listReports(), store.listTemplates(), store.getCatalog(), store.getFiles(), store.listJobs()]);
  ok(Array.isArray(reports) && reports.every(reportOk), `${be}: listReports = รายงานโครงเดียว (${reports.length})`);
  ok(templates.every(t => docOk(t, t.cat) && t.id === (t.code || t.id)), `${be}: listTemplates = doc + id=code (${templates.length})`);
  ok(catalog.schema === 1 && catalog.systems.length && catalog.systems.every(sysOk), `${be}: getCatalog = ระบบ + count/years`);
  ok(cats.every(c => isStr(c.id) && isStr(c.name) && typeof c.total === 'number' && c.rows.every(d => docOk(d, c.id))), `${be}: getFiles = หมวด + แถวเอกสารโครงเดียว`);
  ok(cats.every(c => VIEW_CATS.has(c.id)), `${be}: ทุกหมวดอยู่ในตารางกลุ่มของหน้าเอกสาร (${cats.map(c => c.id).join(',')})`);
  const ids = cats.flatMap(c => c.rows.map(d => d.id)); ok(new Set(ids).size === ids.length && !ids.some(id => reports.some(r => r.id === id)), `${be}: id เอกสารไม่ซ้ำ และไม่ชนกับ id รายงาน`);
  ok(jobs.every(jobOk), `${be}: listJobs = งาน schema 2 (${jobs.length})`);
  return { reports, templates, catalog, cats, jobs };
}

// ---------- demo ----------
const demo = await contract('demo');
ok(await store.fileUrl(demo.cats[0].rows[0]) === null, 'demo: ไม่มีไฟล์จริง → fileUrl = null (viewer ใช้ sourceUrl/หน้าตัวอย่าง)');

// ---------- supabase (fetch ปลอม · session ไม่หมดอายุ) ----------
globalThis.fetch = fakeFetch;
localStorage.setItem('pms.session', JSON.stringify({ access_token: 'T', refresh_token: 'R', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1' } }));
const sb = await contract('supabase');
ok(new Set(sb.cats.map(c => c.id)).size === VIEW_CATS.size && [...VIEW_CATS].every(id => sb.cats.some(c => c.id === id)), 'supabase: ชุดหมวดจากทุก kind = ชุดที่หน้าเอกสารรู้จักพอดี (ANNOUNCE→ann · FLOWPM→flowpm · MANUAL→manual)');
ok(new Set(Object.values(sh.KIND_CAT)).size === VIEW_CATS.size && Object.values(sh.KIND_CAT).every(id => VIEW_CATS.has(id)), 'KIND_CAT ครบทุกหมวดของหน้าเอกสาร');
ok(sb.cats.reduce((a, c) => a + c.rows.length, 0) === 60 && sb.cats.every(c => c.total === c.rows.length), 'supabase: แบ่งหน้าครบ 60 แถว (2 หน้า) · total = จำนวนจริง');
ok(sb.cats.flatMap(c => c.rows).some(d => d.code === '' && d.storagePath === null) && sb.cats.flatMap(c => c.rows).find(d => d.id === '1011').sourceUrl === '', 'supabase: code/storage_path null ได้ · ลิงก์ที่ไม่ใช่ http(s) ถูกตัด');
ok(sb.reports[0].owner === 'u1' && sb.reports[1].owner === null, 'supabase: รายงานเก็บ owner (uploaded_by) ไว้แยกของฉัน/ของกอง');
ok(sb.reports.length === 2 && sb.reports[0].id === 'ex-5' && sb.reports[0].round === '2/69' && sb.reports[0].year === 2569 && sb.reports[1].pages === null && sb.reports[1].title, 'supabase: S.docs มาจาก examples (ไม่ใช่ documents)');
const stby = sb.catalog.systems.find(s => s.id === 'DM-TX-RADIO-STBY');
ok(stby.count === 2 && stby.years.map(y => y.year).join() === '2569,2568' && sb.catalog.systems.find(s => s.id === 'DM-CCTV').icon === 'cctv', 'supabase: จำนวน/ปีต่อระบบคิดจาก examples · id ระบบจริง');
ok(sb.templates.every(t => ['FM', 'WI', 'QP', 'QM'].includes(t.kind)), 'supabase: templates เฉพาะ FM/WI/QP/QM');
const withFile = sb.cats.find(c => c.id === 'fm').rows.find(d => d.storagePath), url = await store.fileUrl(withFile);
ok(SIGNED.at(-1) === `/storage/v1/object/sign/docs/${withFile.storagePath}` && url.startsWith(CONFIG.supabaseUrl + '/storage/v1/object/sign/docs/'), 'signed URL ขอจาก bucket docs เสมอ (ไม่เดาจาก path)');
await store.fileUrl(sb.reports[0]); ok(SIGNED.at(-1).startsWith('/storage/v1/object/sign/examples/'), 'รายงานตัวอย่างขอจาก bucket examples');
ok(await store.fileUrl(sb.cats.flatMap(c => c.rows).find(d => !d.storagePath)) === null, 'storagePath null → ไม่ขอ signed URL (ใช้ sourceUrl)');

// งานจากฐาน: ชื่อจากระบบ · สถานะ field/review = ยังทำอยู่ แต่เก็บขั้นเดิม
const j = sh.job({ id: 9, system_id: 'DM-TX-RADIO-STBY', systems: { name: 'DM TX Radio STBY' }, fiscal_year: 2570, round: 1, date_start: '2026-11-03', date_end: '2026-11-05', status: 'review', data: { status: 'x' }, updated_at: '2026-10-28T03:00:00+00:00' });
ok(jobOk(j) && j.id === '9' && j.status === 'doing' && j.stage === 'review' && F.fmtTitle(j.title) === 'DM TX Radio STBY 1/70', 'jobRow: ชื่อจากระบบ · fmtTitle · review → doing (stage=review)');
ok(sh.job({ id: 1, system_id: 'X', status: 'accepted' }).status === 'done' && sh.job({ id: 2, system_id: 'X', status: 'submitted' }).status === 'submitted' && sh.job({ id: 3, system_id: 'X', status: 'draft' }).draft === true, 'jobRow: accepted→done · submitted→submitted · draft = ร่าง');

// error: เก็บ path (ไม่รวม query) · status · ข้อความ PostgREST · ไม่มี token
globalThis.fetch = async (u, o) => new URL(u).pathname === '/rest/v1/jobs' ? json({ code: 'PGRST200', message: "Could not find a relationship between 'jobs' and 'systems'", details: null, hint: null }, 400) : fakeFetch(u, o);
const e = await store.listJobs().catch(x => x);
ok(e.code === 'server' && e.status === 400 && e.path === '/rest/v1/jobs' && /relationship/.test(e.detail) && !JSON.stringify(e).includes('"T"'), 'error มี path/status/detail · ไม่มี token');

// ไม่มี session (เช่น refresh ถูกปฏิเสธแล้ว pms.user ยังค้าง) = auth ไม่ใช่ [] เงียบ
localStorage.removeItem('pms.session'); let hit = 0; globalThis.fetch = async (u, o) => { hit++; return fakeFetch(u, o); };
const na = await store.listJobs().catch(x => x);
ok(na.code === 'auth' && hit === 0, 'ไม่มี session → auth (ไม่ยิง anon)');

console.log(`\n${n} ข้อ · ${process.exitCode ? 'มีข้อไม่ผ่าน' : 'ผ่านทั้งหมด'}`);
