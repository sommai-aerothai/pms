// รัน: node tests/flow.test.mjs   (ตรรกะ flow + อ่าน .xlsx ในเครื่อง · ไฟล์จริงใน Downloads ใช้ทดสอบเฉพาะในเครื่อง ไม่อยู่ใน git)
import { readFileSync, existsSync } from 'node:fs';
import { SCHEDULE } from '../js/data/schedule-2569.js';
import { formsFor } from '../js/data/wi-scope.js';
import * as F from '../js/flow.js';
import { parse202, sameJob, apply202, inspect } from '../js/files.js';
import { readFile } from '../js/readers/index.js';
let n = 0; const ok = (c, m) => { n++; if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('PASS', m); };
ok(SCHEDULE.length === 93 && new Set(SCHEDULE.map(r => r.id)).size === 93 && !SCHEDULE.some(r => /[-]/.test(r.job + r.people)), 'ตาราง 93 งาน (รวมหมุนเวียนตราด 13 รอบ) id ไม่ซ้ำ ไม่มีอักขระสระหาย');
ok(SCHEDULE.find(r => r.id === 's69-12').job.includes('ด้านทิศเหนือ'), 'ด้านทิศเหนือ ถูกต้อง');
const g = F.scheduleGroups(SCHEDULE, [], '2026-07-28', 'สมหมาย'); ok(g[0][2].every(r => r.ym === '2026-07') && g[1][2].every(r => r.ym === '2026-08') && g[0][2][0].people.includes('สมหมาย'), 'เดือนนี้/เดือนหน้า · ของฉันขึ้นก่อน');
ok(F.addWorkdays('2026-08-06', 20) === '2026-09-03', '20 วันทำการ');
ok(formsFor('DM TX Radio STBY (สถานีเครื่องส่ง)')[0].code === 'FM-CE.SE-202' && formsFor('DM CCTV').some(f => f.code === 'FM-CE.SE-603'), 'WI scope');
const row = SCHEDULE.find(r => r.job.startsWith('DM TX Radio STBY') && r.ym === '2026-08');
const j = F.newPmJob({ id: 't', row, system: 'tx-stby', eng: '', travel: '', draft: true, now: '2026-07-28T00:00:00Z' });
const ctx = { templates: [], docs: [{ system: 'tx-stby' }], today: '2026-07-28' };
ok(F.stageOf(j, ctx) === 1 && F.blocker(j, ctx).spot === 'f040', 'งานใหม่ = ขั้นแจ้งซ่อม รอ FM-040');
const f = '/Users/sommair/Downloads/69-1/69-2/04 FM-CE.SE-202 PM Tx Radio Rev.03 2-69.xlsx';
const fake = [['tx[1].freq_mhz', 118.1], ['tx[1].asset', 'A1'], ['tx[1].error_hz', -2.1], ['tx[1].spurious_dbc', 66], ['tx[1].sens_dbm', -26]].map(([field, value]) => ({ field, value }));
const q = parse202(fake, 'A4: MaintID PM DM Tx Radio STBY ครั้งที่ 2/69');
ok(q.rows[0].v.spur === '-66' && q.rows[0].v.sens === undefined && q.rows[0].v.err === '-2.1' && sameJob(q.maint, j), 'map ค่า FM-202 · spur ติดลบ · sens ไม่ map');
if (existsSync(f) && typeof DOMParser !== 'undefined') {   // reader ใช้ DOMParser = ทดสอบไฟล์จริงในเบราว์เซอร์ (e2e) ไม่ใช่ node
  const buf = readFileSync(f), rr = await readFile(new File([buf], 'x.xlsx'), {}), p = parse202(rr.values, rr.text);
  ok(p.rows.length === 21 && rr.target.rev === '03', 'อ่าน FM-202: 21 เครื่อง Rev.03');
  ok(sameJob(p.maint, j) && !sameJob(p.maint, { ...j, round: '1/69' }), 'ตรวจสถานี+รอบตรงกับงาน');
  ok(p.rows[1].v.spur === '-64' && p.rows[0].v.sens === undefined, 'spur เก็บเป็นค่าลบ · sens ไม่ map');
  const filled = apply202(j, p); ok(filled > 100 && j.tx.length === 21 && j.tx[0].pend.err, `เติม ${filled} ช่อง รอยืนยัน`);
  ok(F.formProg(j, j.forms[0]).done === 0 && F.formProg(j, j.forms[0]).total === 168, 'ยืนยันแล้ว 0 / 168');
  const r = await inspect(new File([buf], 'x.xlsx'), j, { templates: [{ code: 'FM-CE.SE-202', rev: '04' }] }); ok(r.state === 'filled' && r.text.includes('Rev.04'), 'ผลไฟล์: เติมได้ + เตือน Rev ใหม่กว่า');
} else console.log('SKIP ไม่มีไฟล์ตัวอย่างในเครื่องนี้');
{ const a = F.normJob({ id: 'j', title: 'T', folder: { photos: [{ id: 'p1', name: 'a.jpg' }] } }), b = F.normJob(a), c = F.normJob({ ...b, files: [] });
  ok(b.files.filter(f => f.id === 'p1').length === 1 && !('folder' in b) && c.files.length === 0, 'รูปโฟลเดอร์เดิม: ย้ายครั้งเดียว ไม่ซ้ำ · ลบแล้วไม่กลับมา'); }
console.log(n + ' checks');
