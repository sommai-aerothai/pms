// โครงข้อมูลเดียวที่หน้าจอเห็น — store.js ส่งผลของทุก backend (demo · supabase) ผ่านตัวแปลงในไฟล์นี้เสมอ
// รับได้ทั้งแถวจากฐานข้อมูลจริง (snake_case ตาม backend/supabase-schema.sql) และโครง demo (camelCase) · เรียกซ้ำได้ (idempotent)
// ไม่แตะ DOM/localStorage → ทดสอบใน node ได้ (tests/contract.test.mjs)
import { normJob } from './flow.js';
import { formsFor } from './data/wi-scope.js';

// ชนิดเอกสารในฐาน (documents.kind) → id หมวดในหน้า "เอกสาร" · ตารางเดียว ห้ามแปลงที่อื่น
export const KIND_CAT = { FM: 'fm', WI: 'wi', QP: 'qp', QM: 'qm', SD: 'sd', ANNOUNCE: 'ann', PLANPM: 'planpm', TABLEPM: 'tablepm', FLOWPM: 'flowpm', MANUAL: 'manual' };
// กลุ่มในหน้า "เอกสาร" (views.js ใช้ตารางนี้ตรง ๆ): [หัวข้อ, คำอธิบาย, [[หมวด, ชื่อ, คำอธิบาย, ไอคอน]]] · 'reports' = ตัวอย่างรายงาน (examples) ไม่ใช่ documents
export const DOC_GROUPS = [
  ['ใช้ทำงาน', 'ของที่เปิดใช้ระหว่างทำ PM ตั้งแต่เตรียมจนส่งรายงาน', [['fm', 'ฟอร์ม', 'แบบฟอร์มที่กรอกและแนบรายงาน (FM)', 'doc'], ['wi', 'WI', 'ขั้นตอนทำงานของอุปกรณ์แต่ละชนิด', 'book'], ['planpm', 'แผน PM', 'แผนบำรุงรักษาประจำปี', 'clip'], ['tablepm', 'ตาราง PM', 'ตารางงานรายเดือนตามหนังสือคำสั่ง', 'clip'], ['flowpm', 'ผังขั้นตอน PM', 'ผังลำดับงาน PM ของกอง', 'clip']]],
  ['ระบบคุณภาพ', 'เอกสาร ISO 9001 ของกอง ที่ผู้ตรวจอ้างอิง', [['qm', 'QM', 'คู่มือคุณภาพ', 'book'], ['qp', 'QP', 'ระเบียบปฏิบัติ (เช่น QP-01 งาน PM)', 'book'], ['sd', 'SD', 'เอกสารระบบและแบบวงจร', 'book'], ['ann', 'ประกาศ/หนังสือ ISO', 'ประกาศและหนังสือที่เกี่ยวกับระบบคุณภาพ', 'doc']]],
  ['อ้างอิง', 'เปิดดูเทียบเมื่อสงสัย ไม่ต้องกรอก', [['manual', 'คู่มืออุปกรณ์', 'คู่มือจากผู้ผลิต (Technical Manual)', 'book'], ['reports', 'ตัวอย่างรายงานของกอง', 'รายงาน PM ที่ผ่านมาของทั้งกอง', 'doc']]],
];
const CAT_NAME = Object.fromEntries(DOC_GROUPS.flatMap(g => g[2]).map(([id, name]) => [id, name]));
export const catOf = kind => KIND_CAT[String(kind || '').toUpperCase()] || String(kind || 'other').toLowerCase();   // ชนิดใหม่ที่ยังไม่มีในตาราง = หมวดแยก (หน้าเอกสารแสดงท้าย "อ้างอิง")
const httpUrl = u => /^https?:\/\//i.test(u || '') ? u : '';   // ลิงก์จากฐานข้อมูล = ข้อมูลภายนอก รับเฉพาะ http(s)
const pick = (...v) => { const x = v.slice(0, -1).find(y => y !== undefined && y !== null); return x === undefined ? v[v.length - 1] : x; };   // ตัวท้าย = ค่าเริ่มต้น

// เอกสารเว็บกอง (documents) — ช่องที่ UI อ่าน:
// id (string ไม่ซ้ำในหมวดเอกสาร) · code ('' ได้) · rev · title · name (= title) · tag · kind · cat (id หมวด) · sourceUrl (http(s) หรือ '')
// storagePath (path ใน bucket 'docs' หรือ null = ยังไม่มีไฟล์ในระบบ) · bucket ('docs') · pages (null = ไม่รู้ ห้ามเดา) · size · sha256 · fetchedAt (ISO หรือ null) · offline (ค่าเริ่ม ตั้งเก็บ offline)
export const doc = r => {
  const title = pick(r.title, r.name, '');
  return { ...r, schema: 1, id: String(pick(r.id, r.code, '')), code: r.code || '', rev: r.rev || '', title, name: pick(r.name, title), tag: r.tag || '', kind: r.kind, cat: r.cat || catOf(r.kind),
    sourceUrl: httpUrl(pick(r.sourceUrl, r.source_url)), storagePath: pick(r.storagePath, r.storage_path, null), bucket: 'docs', pages: pick(r.pages, null), size: pick(r.size, null), sha256: r.sha256 || '', fetchedAt: pick(r.fetchedAt, r.fetched_at, null), offline: r.offline ?? false };
};
// ฟอร์ม/WI ล่าสุด (templates) = doc + ค้นด้วย code · isNew/prev/changed (เตือน Rev ใหม่) มีเฉพาะเมื่อ backend ส่งมา
export const template = r => { const d = doc(r); return { ...d, id: d.code || d.id }; };
// หมวดในหน้าเอกสาร: { id, name, total (จำนวนจริงในหมวด), rows: doc[] }
export const cat = c => ({ id: c.id, name: CAT_NAME[c.id] || c.name || c.id, total: pick(c.total, (c.rows || []).length), rows: (c.rows || []).map(x => doc({ ...x, cat: c.id })) });
export const groupDocs = rows => { const by = {}; rows.map(doc).forEach(d => (by[d.cat] ||= []).push(d)); return Object.entries(by).map(([id, L]) => cat({ id, total: L.length, rows: L })); };

// ตัวอย่างรายงาน (examples) — ช่องที่ UI อ่าน:
// id ('ex-<id>' ไม่ชนกับ id เอกสาร) · title · system (id ระบบ) · year (ปีงบ พ.ศ.) · round ('1/69') · pages|null · crew|null · status ('draft'|'review'|'accepted'|null = ไม่รู้)
// modified (ISO · '' ได้) · owner (uuid ผู้อัปโหลด|null) · by · size|null · origin ('sharepoint'|'upload'|'app') · performers [] · dates [ก, ข]|null · storagePath|null · bucket ('examples')
export const report = r => {
  const db = r.schema !== 1, year = pick(r.year, r.fiscal_year, null), rd = pick(r.round, ''), round = String(rd).includes('/') || rd === '' ? String(rd) : `${rd}/${String(year ?? '').slice(-2)}`, system = pick(r.system, r.system_id, '');
  return { ...(db ? {} : r), schema: 1, id: db ? 'ex-' + r.id : String(r.id), title: r.title || `PM ${system} ครั้งที่ ${round}`, system, year: year == null ? null : +year, round, pages: pick(r.pages, null), crew: pick(r.crew, null),
    status: r.status || null, modified: pick(r.modified, r.created_at, ''), by: pick(r.by, r.uploaded_by_name, ''), size: pick(r.size, null), origin: r.origin || 'upload', owner: pick(r.owner, r.uploaded_by, null), performers: r.performers || [], dates: r.dates || null,
    storagePath: pick(r.storagePath, r.storage_path, null), bucket: 'examples', sourceUrl: httpUrl(r.sourceUrl) };
};

// catalog: { schema, systems: [{ id, name, loc, icon, count, years: [{year,count}] }] } · count/years คิดจาก examples เมื่อ backend ไม่ได้ให้มา
const ICON = n => /cctv/i.test(n) ? 'cctv' : /voice recorder/i.test(n) ? 'mic' : /vccs/i.test(n) ? 'headset' : 'radio';
export const catalog = ({ systems = [], examples = [] } = {}) => {
  const ex = examples.map(report);
  return { schema: 1, systems: systems.map(s => {
    const mine = ex.filter(e => e.system === s.id), y = {}; mine.forEach(e => { if (e.year != null) y[e.year] = (y[e.year] || 0) + 1; });
    return { id: s.id, name: s.name || s.id, loc: pick(s.loc, s.location, ''), icon: s.icon || ICON(s.name || ''), count: pick(s.count, mine.length), years: s.years || Object.entries(y).sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year: +year, count })) };
  }) };
};

// งาน PM: โครง schema 2 (flow.js) · แถว jobs จากฐาน: ชื่อจากระบบใน catalog (systems(name) ที่ฝังมา) · สถานะ DB → UI แต่เก็บขั้นเดิมไว้ที่ stage
// draft = เปิดเป็นร่าง รอ FM-040 · field = หน้างาน · review = ตรวจภายในก่อนส่ง → ยังทำอยู่ (doing) · submitted = รอผู้ตรวจ · accepted = เสร็จ (done)
export const JOB_ST = { draft: 'doing', field: 'doing', review: 'doing', submitted: 'submitted', accepted: 'done' };
export const job = r => {
  if (r.schema === 2) return normJob(r);
  const name = (r.systems && r.systems.name) || r.system_id || '', round = `${r.round ?? ''}/${String(r.fiscal_year ?? '').slice(-2)}`, title = `PM ${name} ครั้งที่ ${round}`, data = r.data || {};
  return normJob({ schema: 2, title, round, system: r.system_id || '', dates: r.date_start && r.date_end ? [r.date_start, r.date_end] : null, touched: r.updated_at || r.created_at || '', cur: 1, letter: false, forms: formsFor(name),
    ...data, id: String(r.id), status: JOB_ST[r.status] || 'doing', stage: r.status || 'draft', draft: r.status === 'draft', updated_at: r.updated_at });
};
