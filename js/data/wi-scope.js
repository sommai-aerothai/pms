// ขอบเขต WI ต่องาน (config เล็ก ๆ) · ที่มา: notes/flow-research.md (อ่านจาก WI จริง) + QP-CE.SE-01 Rev.09
// เลข Rev ใส่เฉพาะที่ยืนยันแล้ว (WI-002 · WI-04 · WI-12) · ที่เหลือไม่ใส่ Rev ดีกว่าเดา
// where: form = กรอกในการ์ด 3 · prep = ขั้นเตรียม (005) · notice = FM-040 · report = FM-006 (ปุ่มสร้างรายงาน)
export const COMMON = [
  { code: 'FM-CE.SE-005', name: 'เครื่องมือวัด + calibration', where: 'prep' },
  { code: 'FM-CE.SE-040', name: 'ใบแจ้งซ่อมบำรุง', where: 'notice' },
  { code: 'FM-CE.SE-041', name: 'ก่อน/หลัง ทดสอบแจ้งเตือนระบบสำรอง', where: 'form' },
  { code: 'FM-CE.SE-001', name: 'ตรวจทรัพย์สิน (ทะเบียนอุปกรณ์)', where: 'form' },
  { code: 'FM-CE.SE-039', name: 'สมุดบันทึกประจำสถานี', where: 'form' },
  { code: 'FM-CE.SE-006', name: 'ปกรายงาน', where: 'report' },
];
export const REVIEW = { code: '', name: 'ทบทวนคู่มือ / As-Built (QP 6.8.7)', sub: 'เทียบคู่มือ SD As-Built Diagram กับของจริง · บันทึกข้อแตกต่างลง FM-006', where: 'form', kind: 'review' };

const f = (code, name, extra = {}) => ({ code, name, where: 'form', ...extra });
const TX = [
  { wi: 'WI-CE.SE-002', rev: '06', name: 'PM เครื่องส่งวิทยุ', forms: [f('FM-CE.SE-202', 'ค่าวัดเครื่องส่ง', { kind: 'tx' })] },
  { wi: 'WI-CE.SE-04', rev: '03', name: 'สายอากาศ', forms: [f('FM-CE.SE-501', 'PM สายอากาศ'), f('FM-CE.SE-204', 'แพร่สัญญาณแปลกปลอม (spectrum)')] },
  { wi: 'WI-CE.SE-12', rev: '06', name: 'ไฟฟ้า', forms: [f('FM-CE.SE-502', 'PM ไฟฟ้าสำรอง')] },
  { wi: 'CIMC', rev: '', name: 'CIMC', forms: [f('FM-CE.SE-402', 'PM CIMC', { warn: 'WI-053 อ้าง FM-042 · รอยืนยัน' })] },
];
const RX = [{ wi: 'WI-CE.SE-01', rev: '', name: 'PM เครื่องรับวิทยุ', forms: [f('FM-CE.SE-201', 'ค่าวัดเครื่องรับ')] }, TX[2]];
const VCCS = [{ wi: 'WI-CE.SE-05', rev: '', name: 'VCCS', forms: [f('FM-CE.SE-101', 'PM VCCS'), f('FM-CE.SE-102', 'PM VCCS (ต่อ)')] }];
// ลำดับสำคัญ: ตัวแรกที่ตรงชนะ · ไม่ตรงอะไรเลย = ชุดทั่วไป (ขอบเขต WI รอกำหนด)
const RULES = [
  [/Radio Backup & ATIS/i, [{ wi: 'WI-CE.SE-11', rev: '', name: 'ATIS', forms: [f('FM-CE.SE-602', 'PM ATIS')] }]],
  [/TX Radio|T1 T2 T7/i, TX],
  [/RX Radio/i, RX],
  [/VCCS/i, VCCS],
  [/CCTV/i, [{ wi: 'WI-CE.SE-13', rev: '', name: 'CCTV', forms: [f('FM-CE.SE-603', 'PM CCTV')] }]],
  [/Voice Recorder|DVR/i, [{ wi: 'WI-CE.SE-50', rev: '', name: 'Voice Recorder / DVR', forms: [f('FM-CE.SE-047', 'PM Recorder')] }]],
  [/RCAG/i, [{ wi: 'WI-CE.SE-10', rev: '', name: 'RCAG', forms: [f('FM-CE.SE-401', 'PM RCAG')] }]],
];
export const wiScope = title => (RULES.find(([re]) => re.test(title)) || [null, []])[1];
// รายการฟอร์มในการ์ด 3 = ฟอร์มของ WI + ฟอร์มกลาง where:form + ทบทวนคู่มือ (QP 6.8.7)
export const formsFor = title => {
  const out = [];
  wiScope(title).forEach(w => w.forms.forEach(x => out.push({ ...x, wi: w.wi + (w.rev ? ` Rev.${w.rev}` : '') })));
  COMMON.filter(x => x.where === 'form').forEach(x => out.push({ ...x }));
  out.push({ ...REVIEW });
  return out.map(x => ({ kind: 'manual', ...x, done: false }));
};
// รายการแนบรายงานตาม QP 6.9 (opt = ถ้ามี/ถ้าเข้าเงื่อนไข)
export const ATTACH_69 = [
  { id: 'result', name: 'บันทึกผลการปฏิบัติงาน (ฟอร์มตาม WI)' }, { id: '001', code: 'FM-CE.SE-001', name: 'ทะเบียนอุปกรณ์' }, { id: '005', code: 'FM-CE.SE-005', name: 'เครื่องมือวัด' },
  { id: '040', code: 'FM-CE.SE-040', name: 'ใบแจ้งซ่อมบำรุง' }, { id: '041', code: 'FM-CE.SE-041', name: 'ก่อน/หลัง' },
  { id: '007', code: 'FM-CE.SE-007', name: 'ทรัพย์สินไม่ตรง', opt: 'ถ้าทรัพย์สินไม่ตรง' }, { id: '038', code: 'FM-CE.SE-038', name: 'ย้ายทรัพย์สิน', opt: 'ถ้าย้ายทรัพย์สิน' },
  { id: 'cost', name: 'สำเนาอนุมัติค่าใช้จ่าย / ใบเบิก / FM-033 / ใบซื้อฉุกเฉิน', opt: 'ถ้ามี' },
];
// ฟอร์ม FM-CE.SE-202: ช่องที่วัด (ช่วงมาตรฐานใช้เตือน "เกินช่วง") · map = คอลัมน์ในไฟล์ฟอร์มจริง (ค่า Ind) ตาม notes/form-inventory-2-69.md
//   ไม่ map: sens (คอลัมน์ R = squelch ไม่ใช่ Sensitivity) · spur ในไฟล์เป็นขนาด dB ใต้ carrier (เช่น 66) → แอปเก็บเป็นค่าลบ (−66 dBc)
export const FM202_FIELDS = [
  ['err', 'Error (Hz)', 'Error', 'มาตรฐาน ±50 Hz', -50, 50, 'Hz', 12, 3, 0, 'I'], ['osc', 'Oscillator (VDC)', 'Oscillator', 'มาตรฐาน 4.5–5.5 V', 4.5, 5.5, 'VDC', 5, .05, 1, 'K'],
  ['pow', 'Power (W)', 'Power', 'มาตรฐาน 10–25 W', 10, 25, 'W', 20, 1, 1, 'M'], ['spur', 'Spurious (dBc)', 'Spurious', 'มาตรฐาน ไม่เกิน −60 dBc', -999, -60, 'dBc', -68, 1, 0, 'O'],
  ['mod', 'Mod (%)', 'Mod', 'มาตรฐาน 80–95 %', 80, 95, '%', 85, 1, 0, 'P'], ['sens', 'Sensitivity (dBm)', 'Sensitivity', 'มาตรฐาน ไม่เกิน −100 dBm', -130, -100, 'dBm', -104, 1, 0, ''],
  ['dist', 'Distn (%)', 'Distn', 'มาตรฐาน ไม่เกิน 3 %', 0, 3, '%', 1.2, .2, 0, 'T'], ['tout', 'Time out (s)', 'Time out', 'มาตรฐาน 170–190 s', 170, 190, 's', 180, 2, 0, 'U'],
].map(([k, n, t, std, min, max, u, base, step, cam, col]) => ({ k, n, t, std, min, max, u, base, step, cam: !!cam, col }));
