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

// ---------- ชื่อเอกสาร · รวม PDF+ไฟล์แก้ได้ · ผู้ใช้ชื่อเต็มเทียบชื่อต้นในตาราง ----------
{
  const d = sh.doc({ code: 'FM-CE.SE-001', title: 'FM-CE.SE-001', file: 'ExFM-CESE-001ทะเบียนอุปกรณ์.pdf', rev: null, kind: 'FM' });
  ok(d.title === 'ทะเบียนอุปกรณ์' && d.rev === '' && sh.doc(d).title === d.title, 'doc: title = รหัสอย่างเดียว → ชื่อจากชื่อไฟล์ (ตัดรหัสนำหน้า/นามสกุล) · เรียกซ้ำได้');
  const x = sh.doc({ code: 'SD-CE.SE-86', title: 'SD-CE.SE-86 (ไฟล์แก้ได้ ไม่ได้ลิงก์บนหน้าเว็บ)', file: 'SD-CE.SE-86 แบบวงจร_Rev.04.docx', kind: 'SD' });
  ok(x.title === 'แบบวงจร' && x.rev === '04', 'doc: หมายเหตุ "(ไฟล์แก้ได้…)" ไม่นับเป็นชื่อ · Rev.04 จากชื่อไฟล์เข้า rev');
  ok(sh.doc({ code: 'WI-CE.SE-02', title: 'WI-CE.SE-02', file: 'WI-CESE-02วิธีตรวจ.pdf', rev: '07' }).rev === '07' && sh.doc({ code: 'QP-01', title: 'QP-01 งาน PM Rev.3' }).title === 'งาน PM', 'doc: rev ในฐานชนะ · title ที่มีชื่อแล้วตัดรหัสซ้ำ/Rev ออก');
  const c = sh.cat({ id: 'fm', rows: [
    { id: 1, code: 'FM-CE.SE-001', title: 'FM-CE.SE-001', file: 'ExFM-CESE-001ทะเบียนอุปกรณ์.pdf', storage_path: 'fm/001.pdf' },
    { id: 2, code: 'FM-CE.SE-001', title: 'FM-CE.SE-001 (ไฟล์แก้ได้ ไม่ได้ลิงก์บนหน้าเว็บ)', file: 'ExFM-CESE-001ทะเบียนอุปกรณ์.docx', storage_path: 'fm/001.docx' },
    { id: 3, code: 'FM-CE.SE-002', title: 'FM-CE.SE-002', file: 'ExFM-CESE-002ใบงาน.xlsx', storage_path: 'fm/002.xlsx' }] });
  ok(c.rows.length === 2 && c.total === 2 && c.rows[0].storagePath === 'fm/001.pdf' && c.rows[0].editable.storagePath === 'fm/001.docx' && c.rows[0].editable.bucket === 'docs' && !c.rows[1].editable, 'cat: PDF+docx ของเอกสารเดียวกัน → แถวเดียว ดูด้วย PDF · editable = ไฟล์แก้ได้ · จำนวนหมวดนับหลังรวม');
  const c2 = sh.cat({ id: 'fm', total: 95, rows: [{ id: 1, code: 'A', title: 'ก', file: 'a.pdf', storage_path: 'a.pdf' }, { id: 2, code: 'A', title: 'ก', file: 'a.doc', storage_path: 'a.doc' }] });
  ok(c2.total === 94, 'cat: total จาก backend ลดตามจำนวนที่รวม');
  const rows = [{ people: ['สมหมาย'], id: 'a', ym: '2026-07' }, { people: ['วิชัย'], id: 'b', ym: '2026-07' }];
  ok(F.isMe('สมหมาย', 'สมหมาย นุ๊ก สาสังข์') && F.isMe('นุ๊ก', 'สมหมาย นุ๊ก สาสังข์') && F.isMe('สมหมาย นุ๊ก สาสังข์', 'สมหมาย นุ๊ก สาสังข์') && F.isMe('สมหมาย', 'สมหมาย') && !F.isMe('วิชัย', 'สมหมาย นุ๊ก สาสังข์') && !F.isMe('สาสังข์', 'สมหมาย นุ๊ก สาสังข์') && !F.isMe('', ''), 'isMe: ชื่อเต็ม/ชื่อต้น/ชื่อเล่นตรง · คนอื่นและนามสกุลไม่ตรง');
  ok(F.scheduleGroups(rows, [], '2026-07-10', 'สมหมาย นุ๊ก สาสังข์')[0][2][0].id === 'a' && F.mine({ pm: { people: ['สมหมาย'] } }, 'สมหมาย นุ๊ก สาสังข์') && !F.mine({ pm: { people: ['วิชัย'] } }, 'สมหมาย นุ๊ก สาสังข์'), 'ผู้ใช้ชื่อเต็ม: ตรงแถวตารางชื่อต้น · mine ตรง · คนอื่นไม่ตรง');
}

// ---------- ผลอ่านใบจดค่า/ฟอร์มจริงลายมือ → inspect() → apply202 (เส้นทางเติมเดิม) ----------
{
  const { inspect, apply202 } = await import('../js/files.js');
  const mk = () => ({ id: 'dm-txm-2-69', title: 'DM TX Radio Main (สถานีเครื่องส่ง)', round: '2/69', pm: { base: 'DM TX Radio Main' }, tx: [118.1, 118.55, 119.3].map((freq, i) => ({ n: i + 1, freq, v: {}, photos: {} })) });
  const ctxFor = res => ({ templates: [], reader: async () => res });
  const val = (field, value) => ({ field, value, confidence: 'high' });
  const file = { name: 'ใบจดค่า.jpg', type: 'image/jpeg' };
  const sheet = job => ({ kind: 'image', subkind: 'fieldsheet', target: { form: 'FM-CE.SE-202', page: 1, job }, sheet: { job, page: 1, layout: 'fm202-v1' }, note: '',
    values: [val('tx[1].power_w', 27.5), val('tx[2].error_hz', -2.1), val('tx[3].spurious_dbc', 66), val('tx[3].mod_pct', null), { field: 'tx[1].mod_pct', value: 88.8, confidence: 'low' }, val('tx[99].power_w', 30)] });
  let j = mk(), r = await inspect(file, j, ctxFor(sheet('dm-txm-2-69')));
  ok(r.state === 'filled' && r.skipped === 1 && r.read.rows.length === 3, 'ใบจดค่า: งานตรง → filled · แถว 99 ที่ไม่มีในงานถูกข้ามและรายงาน');
  const nf = apply202(j, r.read);
  ok(j.tx[0].v.pow === '27.5' && j.tx[1].v.err === '-2.1' && j.tx[2].v.spur === '-66' && j.tx[2].v.mod === undefined && j.tx[0].v.mod === undefined && j.tx[2].pend.spur && nf === 3, 'ใบจดค่า: ค่าลงถูกแถว · spur เป็นลบ (ฟอร์ม=บวก) · ค่า null ไม่เติม · รอยืนยัน');
  j = mk(); r = await inspect(file, j, ctxFor(sheet('other-job')));
  ok(r.state === 'warn' && !r.read && /ไม่ตรงกับงานนี้/.test(r.text) && j.tx.every(t => !Object.keys(t.v).length), 'ใบจดค่า: job id ไม่ตรง → เตือน ไม่เติม');
  const off = (maint, f2) => ({ kind: 'image', subkind: 'official-handwriting', target: { form: 'FM-CE.SE-202', page: 1 }, text: 'A4: ' + maint, note: '',
    values: [val('tx[1].freq_mhz', 118.1), val('tx[1].power_w', 27.5), val('tx[2].freq_mhz', f2), val('tx[2].power_w', 30.1)] });
  j = mk(); r = await inspect(file, j, ctxFor(off('MaintID PM DM TX Radio Main ครั้งที่ 2/69', 118.5)));
  apply202(j, r.read);
  ok(r.state === 'filled' && r.skipped === 1 && j.tx[0].v.pow === '27.5' && j.tx[1].v.pow === undefined, 'ฟอร์มจริง: จับคู่ด้วยความถี่ที่อ่านได้ · ความถี่ไม่ตรง = เว้นว่าง');
  j = mk(); r = await inspect(file, j, ctxFor(off('MaintID PM DM TX Radio Main ครั้งที่ 1/69', 118.55)));
  ok(r.state === 'warn' && !r.read, 'ฟอร์มจริง: รอบไม่ตรง → เตือน ไม่เติม');
}

// ---------- รายการเอกสารจริง: เรียง · วันที่ดึง · หนังสือขออนุมัติ · ไม่ซ้ำ · ชื่อไฟล์ตกค้าง (ชื่อ placeholder) ----------
{
  const R = (id, kind, code, file, extra = {}) => ({ id, kind, code, title: code, file, storage_path: 'x/' + file, ...extra });
  const raw = [
    R(1, 'FM', 'FM-CE.SE-011', 'FM-CE.SE-011 แบบ ก.pdf', { fetched_at: null }), R(2, 'FM', 'FM-CE.SE-009', 'FM-CE.SE-009 แบบ ข.pdf'), R(3, 'FM', 'FM-CE.SE-008', 'FM-CE.SE-008 แบบ ค.pdf'),
    R(4, 'FM', 'FM-CE.SE-008', 'FM-CE.SE-008 แบบ ค.doc', { fetched_at: '2026-10-28T06:37:00Z' }),   // ไฟล์แก้ได้ได้ fetched_at แต่ PDF ไม่มี
    R(5, 'FM', 'FM-CE.SE-037', '2567 วส.บว-ชื่อ17-2567 ขออนุมัติใช้ ส่ง2 FM-037.pdf', { rev: '02' }), R(6, 'FM', 'FM-CE.SE-037', 'FM-CE.SE-037 ใบตรวจ Rev.02.pdf', { rev: '02' }),
    R(7, 'FM', 'FM-CE.SE-040', '2566 วส.บว-ชื่อ6-2566 ขออนุมัติใช้เอกสาร แบบฟอร์ม FM-40 ส่ง2.pdf'), R(8, 'FM', 'FM-CE.SE-041', 'FM-CE.SE-041 รายงาน Rev.1.pdf', { rev: '1' }), R(9, 'FM', 'FM-CE.SE-041', 'FM-CE.SE-041 รายงาน Rev.2.pdf', { rev: '2' }),
    R(10, 'FM', '', 'ใบเปล่า b.pdf'), R(11, 'FM', '', 'ก ใบเปล่า.pdf'), R(12, 'WI', 'WI-CE.SE-006', 'WI-CE.SE-006 วิธี.pdf'), R(13, 'WI', 'WI-CE.SE-004', 'WI-CE.SE-004 วิธี.pdf'),
    R(14, 'WI', 'WI-CE.SE-030', 'WI-CE.SE-030 signed.ผวส.บว.pdf'), R(15, 'WI', 'WI-CE.SE-031', '2561 วส.บว1849/2561 ขออนุมัติ WI.pdf')];
  const cats = Object.fromEntries(sh.groupDocs(raw).map(c => [c.id, c])), fm = cats.fm, wi = cats.wi, ann = cats.ann;
  const codes = c => c.rows.map(d => d.code);
  ok(codes(fm).slice(0, 5).join() === 'FM-CE.SE-008,FM-CE.SE-009,FM-CE.SE-011,FM-CE.SE-037,FM-CE.SE-041' && codes(wi).join() === 'WI-CE.SE-004,WI-CE.SE-006', 'เรียงตามรหัสแบบเลขธรรมชาติ (008 ก่อน 009 ก่อน 011)');
  ok(fm.rows.slice(-2).every(d => !d.code) && fm.rows.at(-2).title === 'ก ใบเปล่า', 'แถวไม่มีรหัสอยู่ท้ายสุด เรียงตามชื่อ');
  ok(sh.cat(fm).rows.at(-1).title === 'ใบเปล่า' && fm.rows.find(d => d.code === 'FM-CE.SE-008').fetchedAt === '2026-10-28T06:37:00Z', 'รวม PDF+doc แล้ว fetchedAt ไม่หาย (ได้ค่าที่ใหม่กว่า)');
  ok(Math.max(...[].concat(...Object.values(cats).map(c => c.rows.map(d => +new Date(d.fetchedAt || 0))))) === +new Date('2026-10-28T06:37:00Z'), 'หัวหน้าเอกสาร: max fetchedAt ของทุกแถวหลังรวมยังอยู่');
  ok(ann.rows.length === 4 && !fm.rows.some(d => /ขออนุมัติ/.test(d.file)) && !wi.rows.some(d => /ผวส|ขออนุมัติ/.test(d.file)) && ann.total === 4 && fm.total === 8, 'หนังสือขออนุมัติย้ายเข้า ann · ไม่เหลือในฟอร์ม/WI · จำนวนหมวดตาม');
  ok(Object.values(cats).every(c => { const k = c.rows.filter(d => d.code).map(d => d.code + '|' + d.rev); return new Set(k).size === k.length; }), 'ไม่มีรหัสซ้ำ (รหัส+Rev) ในหมวดเดียวกัน');
  const r41 = fm.rows.filter(d => d.code === 'FM-CE.SE-041'); ok(r41.length === 2 && r41[0].rev === '2' && r41[1].rev === '1', 'รหัสเดียว Rev ต่าง: แสดงทั้งคู่ Rev ใหม่ก่อน');
  const nm = (code, file, title = code) => sh.doc({ code, title, file, kind: 'FM' }).title;
  ok(nm('FM-CE.SE-009', 'FM-CE.SE-009 PM RCAG a.pdf') === 'PM RCAG' && nm('FM-CE.SE-002', 'FM-CE.SE-002 รายงาน ok.doc') === 'รายงาน' && nm('FM-CE.SE-002', 'FM-CE.SE-002 รายงาน edit.doc') === 'รายงาน', 'ชื่อจากไฟล์: ตัดนามสกุล/คำเดี่ยวท้าย');
  ok(nm('FM-CE.SE-005', 'FM-CE.SE-005 04 FM-CESE-005 รายการเครื่องมืออะไหล่ edit.doc') === 'รายการเครื่องมืออะไหล่' && nm('FM-CE.SE-009', 'FM-CE.SE-009 PM RCAG a.pdf') === 'PM RCAG', 'ชื่อจากไฟล์: ตัดรหัสซ้ำนำหน้า · คำท้าย edit/a');
  ok(nm('WI-CE.SE-005', 'WI-CE.SE-005 PM TX.pdf') === 'PM TX' && nm('WI-CE.SE-018', 'WI-CE.SE-018 CM PAE RX ok.pdf') === 'CM PAE RX', 'ชื่อจากไฟล์: TX/RX ตัวใหญ่ไม่ถูกตัด');
  ok(sh.doc({ id: 1, kind: 'TABLEPM', code: null, title: 'ตาราง', file: '2568 วส.บว513-2568 ตาราง PM.pdf' }).cat === 'tablepm' && sh.doc({ id: 2, kind: 'FM', code: 'FM-CE.SE-037', title: 'x', file: '2567 วส.บว-x17-2567 ขออนุมัติใช้.pdf' }).cat === 'ann', 'หนังสือ: ย้ายเฉพาะ FM/WI · ตาราง PM ที่เป็นหนังสือ วส.บว อยู่หมวดเดิม');
  ok(nm('FM-CE.SE-005', 'FM-CE.SE-005 ชื่อไฟล์เก่า.pdf', 'FM-CE.SE-005 ชื่อจริงจากฐาน') === 'ชื่อจริงจากฐาน' && nm('FM-CE.SE-005', 'FM-CE.SE-005 ชื่อไฟล์เก่า.pdf', 'งาน PM') === 'งาน PM', 'title ในฐานที่เป็นชื่อจริงชนะชื่อจากไฟล์ (และไม่โดนตัดคำท้าย)');
}

// ---------- examples เกิน max-rows ของ PostgREST (1000): listExamples/getCatalog ต้องดึงทุกหน้า ไม่ตกหล่นเงียบ ----------
{
  const be = await import('../js/backend/supabase.js'), ROWS = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1, system_id: 'S', fiscal_year: 2569 })), ranges = [];
  localStorage.setItem('pms.session', JSON.stringify({ access_token: 'T', refresh_token: 'R', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1' } }));
  globalThis.fetch = async (u, o) => {   // เซิร์ฟเวอร์ตัดหน้าที่ 1000 แถวเสมอ (max-rows) แม้ขอมากกว่า
    if (new URL(u).pathname !== '/rest/v1/examples') return json([]);
    const [a, b] = o.headers.Range.split('-').map(Number), page = ROWS.slice(a, Math.min(b, a + 999) + 1); ranges.push(o.headers.Range);
    return json(page, 206, { 'Content-Range': page.length ? `${a}-${a + page.length - 1}/${ROWS.length}` : `*/${ROWS.length}` });
  };
  const all = await be.listExamples();
  ok(all.length === 1500 && new Set(all.map(r => r.id)).size === 1500 && all[0].id === 1 && all.at(-1).id === 1500 && ranges.length === 2, 'listExamples: 2 หน้า (1000+500) ได้ครบ 1500 แถว ไม่ซ้ำ เรียงต่อกัน');
  ok((await be.getCatalog()).examples.length === 1500, 'getCatalog: นับ examples ครบทุกหน้า (จำนวน/ปีต่อระบบไม่ขาด)');
}

// ---------- แอดมินจัดการผู้ใช้ (Edge Function admin-users) ----------
{
  localStorage.setItem('pms.backend', 'supabase');
  localStorage.setItem('pms.session', JSON.stringify({ access_token: 'T', refresh_token: 'R', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1' } }));
  const calls = []; let mode = 'ok';
  globalThis.fetch = async (u, o) => {
    const p = new URL(u).pathname; calls.push({ p, h: o.headers, b: o.body && JSON.parse(o.body) });
    if (p !== '/functions/v1/admin-users') return json([]);
    if (mode === '404') return json({ code: 'NOT_FOUND', message: 'Requested function was not found' }, 404);
    if (mode === '403') return json({ error: 'forbidden' }, 403);
    if (mode === 'ta') return json({ error: 'target_admin' }, 403);
    if (mode === 'pt') return json({ error: 'partial' }, 500);
    if (mode === '409') return json({ error: 'exists' }, 409);
    if (mode === '400') return json({ error: 'username' }, 400);
    if (mode === 'nf') return json({ error: 'notfound' }, 404);
    const b = JSON.parse(o.body); return json(b.action === 'list' ? { users: [{ id: 'a', username: 'x.y', name: 'X', approved: true, is_admin: false, last_sign_in_at: null }] } : { ok: true });
  };
  const code = async f => { try { await f(); return 'none'; } catch (e) { return e.code + (e.field ? ':' + e.field : ''); } };
  const L = await store.adminUsers('list');
  ok(L.users.length === 1 && calls.at(-1).p === '/functions/v1/admin-users' && calls.at(-1).b.action === 'list' && calls.at(-1).h.Authorization === 'Bearer T' && calls.at(-1).h.apikey === CONFIG.anonKey, 'adminUsers list: POST /functions/v1/admin-users + apikey + Bearer');
  const n0 = calls.length;
  await store.adminUsers('create', { username: 'somchai.k', name: ' สมชาย ', password: 'abcdefghij' });
  ok(calls.length === n0 + 1 && calls.at(-1).b.action === 'create' && calls.at(-1).b.username === 'somchai.k', 'adminUsers create: ส่งถึงฟังก์ชัน');
  ok(await code(() => store.adminUsers('create', { username: 'Bad Name', name: 'x', password: 'abcdefghij' })) === 'invalid:username', 'create: ชื่อผู้ใช้ผิดรูป → invalid:username ฝั่งแอป');
  ok(await code(() => store.adminUsers('create', { username: 'ab', name: 'x', password: 'abcdefghij' })) === 'invalid:username', 'create: ชื่อผู้ใช้สั้นเกิน → invalid:username');
  ok(await code(() => store.adminUsers('create', { username: 'somchai.k', name: ' ', password: 'abcdefghij' })) === 'invalid:name', 'create: ไม่มีชื่อ → invalid:name');
  ok(await code(() => store.adminUsers('create', { username: 'somchai.k', name: 'x', password: '123456789' })) === 'invalid:password', 'create: รหัสสั้น (9) → invalid:password');
  ok(await code(() => store.adminUsers('reset', { id: 'a', password: 'short' })) === 'invalid:password', 'reset: รหัสสั้น → invalid:password');
  ok(calls.length === n0 + 1, 'ข้อมูลไม่ผ่านการตรวจ = ไม่ยิงเครือข่ายเลย');
  mode = '404'; ok(await code(() => store.adminUsers('list')) === 'notdeployed', '404 ของ gateway → notdeployed');
  mode = 'nf'; ok(await code(() => store.adminUsers('set', { id: 'a', approved: false })) === 'notfound', '404 ของฟังก์ชันเอง (ไม่พบบัญชี) ≠ notdeployed');
  mode = '403'; ok(await code(() => store.adminUsers('list')) === 'forbidden', '403 → forbidden (ไม่ใช่ auth: ห้ามเตะออกจากระบบ)');
  mode = 'ta'; ok(await code(() => store.adminUsers('reset', { id: 'a', password: 'abcdefghij' })) === 'target_admin', '403 + target_admin → target_admin (ไม่ใช่ forbidden)');
  mode = 'pt'; ok(await code(() => store.adminUsers('create', { username: 'a.b.c', name: 'x', password: 'abcdefghij' })) === 'partial', '500 + partial → partial');
  mode = '409'; ok(await code(() => store.adminUsers('list')) === 'exists', '409 → exists');
  mode = '400'; ok(await code(() => store.adminUsers('list')) === 'invalid:username', '400 + {error:username} → invalid:username');
  const pws = Array.from({ length: 200 }, () => store.genPassword());
  ok(pws.every(p => /^[A-HJ-NP-Za-km-z2-9]{12}$/.test(p)) && new Set(pws).size === 200, 'genPassword: 12 ตัว ไม่มีตัวสับสน ไม่ซ้ำ (200 ครั้ง)');
  // demo: จำลองในหน่วยความจำ
  localStorage.setItem('pms.backend', 'demo');
  const before = (await store.adminUsers('list')).users.length;
  await store.adminUsers('create', { username: 'new.user', name: 'ใหม่', password: 'abcdefghij' });
  const after = (await store.adminUsers('list')).users;
  ok(after.length === before + 1 && after.at(-1).username === 'new.user' && after.at(-1).approved && !JSON.stringify(after).includes('abcdefghij'), 'demo: สร้างแล้วอยู่ในรายการ · ไม่เก็บรหัสผ่าน');
  ok(await code(() => store.adminUsers('create', { username: 'new.user', name: 'x', password: 'abcdefghij' })) === 'exists', 'demo: ชื่อซ้ำ → exists');
  await store.adminUsers('set', { id: after.at(-1).id, approved: false }); ok((await store.adminUsers('list')).users.at(-1).approved === false, 'demo: ปิดการใช้งานได้');
}

console.log(`\n${n} ข้อ · ${process.exitCode ? 'มีข้อไม่ผ่าน' : 'ผ่านทั้งหมด'}`);
