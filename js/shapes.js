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
// ชื่อเอกสาร: ฐานจริงเก็บ title = รหัส (บางแถวต่อท้ายหมายเหตุ "(ไฟล์แก้ได้…)") → ถ้า title ไม่มีชื่อ ดึงจากชื่อไฟล์ (ตัดนามสกุล · รหัสนำหน้า เช่น ExFM-CESE-001 / SD-CE.SE-86 / WI-CESE-02 · Rev.xx) · Rev อ่านจาก title/ไฟล์เมื่อฐานไม่มี
const REV_RE = /[\s_(\-]*Rev\.?\s*(\d+)\)?/i, CODE_PFX = /^(?:Ex)?(?:FM|WI|QP|QM|SD)[-_. ]*(?:CE\.?SE)?[-_. ]*\d+/i;
const tidy = t => t.replace(/[_\s]+/g, ' ').replace(/^[\s\-–.:()]+|[\s\-–.:(]+$/g, '').trim();
const extOf = f => (/\.([A-Za-z0-9]+)$/.exec(f || '') || [])[1]?.toLowerCase() || '';
// หนังสือขออนุมัติใช้เอกสาร (ไม่ใช่ตัวฟอร์ม/WI): ชื่อไฟล์ขึ้นต้นปี พ.ศ. 4 หลัก + วส.บว · มี "ขออนุมัติ" · หรือเป็นฉบับลงนาม ผวส.บว → หมวดประกาศ/หนังสือ (ann)
const isMemo = f => /^\d{4}\s*วส\.?บว|ขออนุมัติ|ผวส\.?บว/.test(String(f || '').split('/').pop());
// ส่วนที่ติดมาจากชื่อไฟล์ (ใช้เฉพาะชื่อที่ได้จากไฟล์ · ชื่อจากฐานเชื่อตามนั้น): นามสกุลท้าย · รหัสซ้ำนำหน้า "04 FM-CESE-005" · คำเดี่ยวท้าย a/b/ok/edit
const fromFile = t => tidy(tidy(t).replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(new RegExp('^(?:\\d+\\s+)?' + CODE_PFX.source.slice(1), 'i'), '').replace(/\s+(?:[A-Za-z]{1,2}|ok|edit)$/i, ''));
const nameOf = (title, code, file) => {
  const clean = t => tidy(t.replace(/\([^)]*ไฟล์แก้ได้[^)]*\)/g, '').replace(REV_RE, ' ').replace(code ? new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\-–:]*', 'i') : /$^/, ''));
  const t = clean(String(title || '')); if (t && t !== code) return t;
  const f = String(file || '').split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
  return fromFile(tidy(f.replace(REV_RE, ' ').replace(CODE_PFX, '')));
};
export const doc = r => {
  const file = pick(r.file, r.file_name, ''), code = r.code || '', raw = pick(r.title, r.name, ''), title = nameOf(raw, code, file) || (code ? '' : String(raw));
  const rev = r.rev || (REV_RE.exec(`${raw} ${file}`) || [])[1] || '';
  return { ...r, schema: 1, id: String(pick(r.id, r.code, '')), code, rev, title, name: title, tag: r.tag || '', kind: r.kind, cat: isMemo(file) ? 'ann' : r.cat || catOf(r.kind), file,
    sourceUrl: httpUrl(pick(r.sourceUrl, r.source_url)), storagePath: pick(r.storagePath, r.storage_path, null), bucket: 'docs', pages: pick(r.pages, null), size: pick(r.size, null), sha256: r.sha256 || '', fetchedAt: pick(r.fetchedAt, r.fetched_at, null), offline: r.offline ?? false };
};
// รวมไฟล์ชุดเดียวกัน (รหัส+ชื่อเดียวกัน) ที่มีทั้ง PDF และไฟล์แก้ได้ (doc/docx/xlsx) เป็นแถวเดียว: ดูด้วย PDF · ไฟล์แก้ได้เก็บที่ editable = { id, file, storagePath, bucket, size, sourceUrl }
const isPdf = d => extOf(d.file || d.storagePath) === 'pdf';
export const mergeFormats = rows => {
  const by = new Map(), out = [];
  for (const d of rows) {
    const k = d.code ? d.code.toLowerCase() : '', g = k && by.get(k);
    if (!g) { const x = { ...d }; out.push(x); if (k) by.set(k, x); continue; }
    const [pdf, other] = isPdf(g) && !isPdf(d) ? [g, d] : !isPdf(g) && isPdf(d) && !g.editable ? [d, g] : [null, null];
    if (!pdf || pdf.editable || !other.storagePath || (g.rev && d.rev && g.rev !== d.rev)) { out.push({ ...d }); continue; }   // ไม่รวมถ้าไฟล์แก้ได้ไม่มีในระบบ (เหลือแต่ลิงก์เว็บ) หรือคนละ Rev
    const at = [g.fetchedAt, d.fetchedAt].filter(Boolean).sort().pop() || null, ed = { id: other.id, file: other.file, storagePath: other.storagePath, bucket: other.bucket, size: other.size, sourceUrl: other.sourceUrl };
    if (pdf === g) Object.assign(g, { editable: ed, fetchedAt: at }); else Object.assign(out[out.indexOf(g)], { ...d, editable: ed, fetchedAt: at });
  }
  return out;
};
// ฟอร์ม/WI ล่าสุด (templates) = doc + ค้นด้วย code · isNew/prev/changed (เตือน Rev ใหม่) มีเฉพาะเมื่อ backend ส่งมา
export const template = r => { const d = doc(r); return { ...d, id: d.code || d.id }; };
// หมวดในหน้าเอกสาร: { id, name, total (จำนวนจริงในหมวด), rows: doc[] }
// เรียงในหมวด: รหัสตามเลขธรรมชาติ (FM-8 ก่อน FM-11) · Rev ใหม่ก่อนเมื่อรหัสซ้ำ · ไม่มีรหัสไว้ท้าย เรียงตามชื่อ
const byCode = (a, b) => !a.code - !b.code || (a.code ? a.code.localeCompare(b.code, 'en', { numeric: true }) || b.rev.localeCompare(a.rev, 'en', { numeric: true }) : a.title.localeCompare(b.title, 'th'));
export const cat = c => {   // total ที่ backend ให้ (ทั้งหมวดในฐาน) ลดตามจำนวนแถวที่รวมแล้ว
  const all = (c.rows || []).map(x => doc({ ...x, cat: c.id })), rows = mergeFormats(all).sort(byCode);
  return { id: c.id, name: CAT_NAME[c.id] || c.name || c.id, total: pick(c.total, all.length) - (all.length - rows.length), rows };
};
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
