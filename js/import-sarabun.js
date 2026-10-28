// รับข้อมูลจากบุ๊กมาร์กเล็ต "ส่งเข้า PMS" (bookmarklet/sarabun-to-pms.js) จากหน้าพิมพ์บันทึกงานของสารบรรณ
// ไม่รู้โฮสต์สารบรรณ → pin origin ไม่ได้ · จุดตรวจความปลอดภัยคือ validate(): ทุกอย่างที่เข้ามาถือเป็นข้อความไม่น่าเชื่อถือ
//   (ตรวจชนิด/ความยาวทุกช่อง · คัดลอกเฉพาะช่องที่รู้จัก · ไม่แสดงด้วย innerHTML · แค่ "แสดงให้ดู" จนกว่าผู้ใช้กดบันทึกเอง)
// ไฟล์นี้ไม่แตะ DOM/store ตอนโหลด → ทดสอบแยกได้ (tests/sarabun-parse.test.html)
const CAP = 2000, MAX_ENTRIES = 50, MAX_PDF = 3, MAX_PDF_BYTES = 10 * 1024 * 1024, MAX_FRAG = 200000;
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const TOP = ['url', 'printedAt', 'regNo', 'docType', 'docNo', 'status', 'docDate', 'ref', 'from', 'to', 'subject'];
const ENTRY = ['at', 'unit', 'name', 'presenter', 'note', 'remark'];
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}\+07:00)?$/;

const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
const clean = v => v.replace(CTRL, '').slice(0, CAP);

// เช็คชนิดทุกช่อง · ผิดอย่างเดียว = ปฏิเสธทั้งก้อน (null) · รายการเกินเพดาน = ตัดทิ้ง
export function validate(m) {
  if (!plain(m) || m.type !== 'pms-import' || !plain(m.data)) return null;
  const d = m.data, out = { schema: 1, source: 'sarabun' };
  if (d.schema !== 1 || d.source !== 'sarabun') return null;
  for (const k of TOP) { if (typeof d[k] !== 'string') return null; out[k] = clean(d[k]); }
  for (const k of ['printedAtISO', 'docDateISO']) { const v = d[k] ?? ''; if (typeof v !== 'string' || (v && !ISO.test(v))) return null; out[k] = v; }
  if (!/^https?:\/\//.test(out.url) || !out.regNo.trim()) return null;
  if (!Array.isArray(d.entries) || !Array.isArray(d.pdfLinks ?? [])) return null;
  out.entries = [];
  for (const e of d.entries.slice(0, MAX_ENTRIES)) {
    if (!plain(e)) return null;
    const o = {};
    for (const k of ENTRY) { if (typeof e[k] !== 'string') return null; o[k] = clean(e[k]); }
    const a = e.atISO ?? ''; if (typeof a !== 'string' || (a && !ISO.test(a))) return null; o.atISO = a;
    out.entries.push(o);
  }
  out.pdfLinks = (d.pdfLinks || []).filter(u => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10).map(clean);
  const pdfs = Array.isArray(m.pdfs) ? m.pdfs.filter(p => plain(p) && typeof p.name === 'string' && p.blob instanceof Blob && p.blob.size > 0 && p.blob.size <= MAX_PDF_BYTES).slice(0, MAX_PDF)
    .map(p => ({ name: clean(p.name).slice(0, 200), blob: p.blob.slice(0, p.blob.size, 'application/pdf') })) : [];
  return { data: out, pdfs };
}

// สำรอง: #/import?d=<base64url(JSON UTF-8)>
export function decodeFragment(hash) {
  const m = /^#\/import\?d=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m || m[1].length > MAX_FRAG) return null;
  try {
    const b = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), u = Uint8Array.from(b, c => c.charCodeAt(0));
    return validate({ type: 'pms-import', data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(u)) });
  } catch { return null; }
}

// ---------- จับคู่งาน: ชื่อระบบ + ครั้งที่/ปี จากหัวเรื่อง ----------
// เลขไทย→อารบิก · ตัดสระ/วรรณยุกต์ไทย (PDF ทำสระหาย เช่น "ครั้งที่" ↔ "ครงท") · STBY/Stanby/Standby เป็นคำเดียว
export const norm = s => String(s).replace(/[๐-๙]/g, c => '๐๑๒๓๔๕๖๗๘๙'.indexOf(c)).replace(/[ัำิ-ฺ็-๎]/g, '')
  .toLowerCase().replace(/\bsta?n?d?by\b/g, 'stby').replace(/\s+/g, ' ');
export function roundOf(subject) {
  const s = norm(subject), m = /ค\s*ร\s*ง\s*ท\s*(\d)\s*\/\s*(\d{2,4})/.exec(s) || [...s.matchAll(/(\d)\s*\/\s*(\d{2,4})/g)].pop();
  return m ? `${m[1]}/${m[2].slice(-2)}` : '';
}
// ได้ job ที่ชื่อระบบอยู่ในหัวเรื่อง (ชื่อยาวสุดชนะ เช่น "DM VCCS Backup" > "DM VCCS") และรอบตรงกัน · ไม่เจอ = null
export function matchJob(jobs, systems, subject) {
  const s = norm(subject), r = roundOf(subject); let best = null, len = 0;
  for (const j of jobs) {
    // ชื่อระบบในแคตตาล็อก หรือชื่องานจากตาราง PM (ตัดวงเล็บ) — ใช้ตัวที่ยาวที่สุดที่อยู่ในหัวเรื่อง
    for (const raw of [(systems.find(x => x.id === j.system) || {}).name, j.pm && j.pm.base && j.pm.base.replace(/\s*\(.*?\)\s*/g, ' ').trim()]) {
      const n = norm(raw || '');
      if (n && r && j.round === r && s.includes(n) && n.length > len) { best = j; len = n.length; }
    }
  }
  return best;
}

// งานปลายทางของ S.imp: ที่ผู้ใช้เลือกเอง ก่อน แล้วค่อยที่จับคู่อัตโนมัติ
export const impTarget = S => S.imp && (S.jobs.find(j => j.id === S.imp.pick) || matchJob(S.jobs, S.catalog.systems, S.imp.data.subject));

// ใส่ผลนำเข้าลงงาน (คืน job ใหม่ · ผู้เรียกเป็นคนบันทึก) · field_meta บอกที่มาของทุกช่องใน notice
export function applyImport(job, d, now) {
  const keys = [...TOP, 'docDateISO'], notice = Object.fromEntries(keys.map(k => [k, d[k]])); notice.entries = d.entries;
  const meta = { source: 'sarabun', locator: `worklog regNo ${d.regNo}`, extracted_at: now };
  // FM-040 อนุมัติ = สถานะเอกสารเสร็จแล้ว หรือมีบันทึกคำว่า "อนุมัติ" · ไม่แน่ใจ = ยังรอ (ผู้ใช้กดจำลอง/ยืนยันเอง)
  const ok = /เสร็จ/.test(d.status) || d.entries.some(e => /อนุมัติ/.test(e.note));
  return { ...job, data: { ...job.data, notice }, field_meta: { ...job.field_meta, ...Object.fromEntries(Object.keys(notice).map(k => ['notice.' + k, meta])) },
    f040: ok ? 'approved' : job.f040, draft: ok ? false : job.draft,
    vals: { ...(job.vals || {}), f040: { v: `${ok ? 'อนุมัติแล้ว' : 'รออนุมัติ'} · ${d.docNo || d.regNo}`, src: 'sarabun', loc: `บันทึกงาน เลขทะเบียน ${d.regNo}`, at: now.slice(0, 10) } } };
}

// ---------- บุ๊กมาร์กเล็ต: ย่อเป็นบรรทัดเดียว + ใส่ที่อยู่แอปที่ผู้ใช้เปิดอยู่ ----------
export const minify = src => src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).join(' ');
export const bookmarklet = (src, base) => 'javascript:' + minify(src).replace(/'https:\/\/sommai-aerothai\.github\.io\/pms\/'/, `'${base.replace(/'/g, '%27')}'`);

// ---------- ตัวรับ ----------
// onImport({data,pdfs}) · onBad() เมื่อมีข้อความ pms-import แต่รูปแบบผิด · ข้อความอื่นเงียบ
// ข้อมูลที่รับแล้วพักไว้ใน sessionStorage (ไม่รวม PDF) กันหายเมื่อหน้ารีโหลดเอง — ครั้งแรกที่ service worker เข้าควบคุมแล้วรีโหลด · ล้างเมื่อบันทึก
const stash = d => { try { sessionStorage.setItem('pms.imp', JSON.stringify(d)); } catch { /* ไม่มีที่เก็บ = ข้ามได้ */ } };
export const unstash = () => { try { sessionStorage.removeItem('pms.imp'); } catch { /* ข้ามได้ */ } };
export function init(onImport, onBad) {
  const take = v => { stash(v.data); onImport(v); };
  const frag = decodeFragment(location.hash);
  if (/^#\/import\?/.test(location.hash)) { history.replaceState(null, '', '#/import'); frag ? take(frag) : onBad(); }   // ล้าง fragment ออกจาก URL ทันที
  else if (location.hash === '#/import') { try { const v = validate({ type: 'pms-import', data: JSON.parse(sessionStorage.getItem('pms.imp')) }); if (v) onImport(v); } catch { /* ไม่มีของพัก */ } }
  // รับเฉพาะจากหน้าต่างที่เปิดเรามา (บุ๊กมาร์กเล็ตเปิดหน้าใหม่ทุกครั้ง)
  addEventListener('message', e => {
    if (!window.opener || e.source !== window.opener || !e.data || e.data.type !== 'pms-import') return;
    const v = validate(e.data); v ? take(v) : onBad();
  });
  if (window.opener && location.hash.startsWith('#/import')) window.opener.postMessage({ type: 'pms-ready' }, '*');   // ไม่มีความลับ → '*' ได้
}
