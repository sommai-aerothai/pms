// ข้อมูลจำลอง (โหมด demo) — โครง JSON ตาม spec §2: schema:1 · id ถาวร · เวลา ISO 8601 UTC
// ตัวเลขทั้งหมดเป็นตัวอย่างสำหรับดูหน้าตา ไม่ใช่ค่าวัดจริง
const D = (system, year, round, station, title, modified, pages, crew, status, extra = {}) => ({
  schema: 1, id: `${system}-${station}-${year}-${round.replace('/', '-')}`, title, system, year, round, station,
  path: `CE.SE/รายงาน PM/${system}/${year}/${title}.pdf`, modified, by: 'ตัวอย่าง', size: 1.7e6, status, pages, crew, ...extra });

export const catalog = {
  schema: 1,
  systems: [['radio', 'Radio Tx/Rx', 'radio', 128], ['ils', 'ILS', 'ils', 86], ['vccs', 'VCCS', 'mic', 44], ['dvr', 'DVR', 'disk', 31],
    ['rcag', 'RCAG', 'tower', 57], ['power', 'Power B/U', 'bat', 63], ['cimc', 'CIMC', 'cpu', 22], ['catis', 'C-ATIS', 'text', 18]]
    .map(([id, name, icon, count]) => ({ id, name, icon, count })),
  // จำนวนรายงานต่อปี (ตัวอย่าง): radio ตามแล็บ · ระบบอื่นแบ่งตามสัดส่วน
  years: { radio: { 2569: 14, 2568: 41, 2567: 38, 2566: 35 } },
  stations: [{ id: 'dm', name: 'สถานีส่งดอนเมือง (DM)', count: 52 }, { id: 'sv', name: 'สถานีส่งสุวรรณภูมิ', count: 47 }, { id: 'ils', name: 'สถานี ILS', count: 30 }],
};
export function yearsOf(sys) {
  const y = catalog.years[sys.id] || Object.fromEntries([2569, 2568, 2567].map((k, i) => [k, Math.round(sys.count * [.2, .4, .4][i])]));
  return Object.entries(y).sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year: +year, count }));
}

const docs = [
  D('radio', 2569, '3/69', 'dm', 'PM DM TxS ครั้งที่ 3/69', '2026-10-26T03:00:00Z', 19, 2, 'draft', { dates: ['2026-11-12', '2026-11-14'] }),
  D('radio', 2569, '2/69', 'dm', 'PM DM TxS ครั้งที่ 2/69', '2026-10-24T03:00:00Z', 21, 2, 'accepted', { dates: ['2026-08-04', '2026-08-06'] }),
  D('radio', 2569, '2/69', 'dmrx', 'PM DM RxS ครั้งที่ 2/69', '2026-07-20T03:00:00Z', 17, 2, 'review', { dates: ['2026-07-18', '2026-07-19'] }),
  D('radio', 2569, '1/69', 'dm', 'PM DM TxS ครั้งที่ 1/69', '2026-04-14T03:00:00Z', 20, 3, 'accepted', { dates: ['2026-04-10', '2026-04-12'] }),
  D('radio', 2568, '3/68', 'dm', 'PM DM TxS ครั้งที่ 3/68', '2025-11-16T03:00:00Z', 20, 2, 'accepted', { dates: ['2025-11-13', '2025-11-15'] }),
  D('radio', 2568, '2/68', 'dm', 'PM DM TxS ครั้งที่ 2/68', '2025-08-08T03:00:00Z', 19, 2, 'accepted', { dates: ['2025-08-05', '2025-08-07'] }),
  D('ils', 2569, '1/69', 'ils', 'DM TX Radio Backup 1 (สถานี ILS)', '2026-10-08T03:00:00Z', 14, 2, 'accepted', { dates: ['2026-10-06', '2026-10-07'] }),
];
export const recent = [['radio-dm-2569-2-69', '2026-10-27T05:00:00Z'], ['radio-dm-2569-1-69', '2026-10-24T05:00:00Z'], ['ils-ils-2569-1-69', '2026-10-20T05:00:00Z']];

const T = (code, rev, name, pages, size, extra = {}) => ({ schema: 1, code, rev, name, pages, size, fetchedAt: '2026-10-28T02:00:00Z',
  sourceUrl: `https://home.aerothai.co.th/cese/node/${extra.kind === 'wi' ? 524 : 526}`, sha256: '0'.repeat(64), kind: 'form', ...extra });
const templates = [
  T('FM-CE.SE-202', '04', 'ค่าวัดเครื่องส่ง', 2, 0.4e6, { prev: '03', isNew: true, changed: '2026-10-27' }),
  T('FM-CE.SE-501', '01', 'PM สายอากาศ', 1, 0.2e6), T('FM-CE.SE-502', '01', 'PM ไฟฟ้าสำรอง', 1, 0.2e6),
  T('FM-CE.SE-402', '03', 'PM CIMC', 2, 0.3e6, { offline: false }), T('FM-CE.SE-204', '02', 'แพร่สัญญาณแปลกปลอม', 1, 0.2e6),
  T('WI-CE.SE-02', '06', 'เครื่องส่งวิทยุ', 60, 9e6, { kind: 'wi' }),
];

// ค่าที่ต้องวัด (ฟอร์ม FM-CE.SE-202)
const fields = [
  ['err', 'Error (Hz)', 'Error', 'มาตรฐาน ±50 Hz', -50, 50, 'Hz', 12, 3], ['osc', 'Oscillator (VDC)', 'Oscillator', 'มาตรฐาน 4.5–5.5 V', 4.5, 5.5, 'VDC', 5, .05, 1],
  ['pow', 'Power (W)', 'Power', 'มาตรฐาน 10–25 W', 10, 25, 'W', 20, 1, 1], ['spur', 'Spurious (dBc)', 'Spurious', 'มาตรฐาน ไม่เกิน −60 dBc', -999, -60, 'dBc', -68, 1],
  ['mod', 'Mod (%)', 'Mod', 'มาตรฐาน 80–95 %', 80, 95, '%', 85, 1], ['sens', 'Sensitivity (dBm)', 'Sensitivity', 'มาตรฐาน ไม่เกิน −100 dBm', -130, -100, 'dBm', -104, 1],
  ['dist', 'Distn (%)', 'Distn', 'มาตรฐาน ไม่เกิน 3 %', 0, 3, '%', 1.2, .2], ['tout', 'Time out (s)', 'Time out', 'มาตรฐาน 170–190 s', 170, 190, 's', 180, 2],
].map(([k, n, t, std, min, max, u, base, step, cam]) => ({ k, n, t, std, min, max, u, base, step, cam: !!cam }));
const FREQ = [118.1, 118.55, 119.3, 120.7, 121.9, 122.5, 126.4, 127.1, 128.35, 129.2, 131.45, 132.0, 133.6, 134.8, 135.95, 136.7, 225.0, 233.5, 236.2, 238.4, 240.0];
const reg = n => `1-160-${String(3143 + n).padStart(5, '0')}`;

function seedJob() {
  const tx = FREQ.map((freq, i) => {
    const n = i + 1, v = {};
    if (n <= 15) {
      v.asset = reg(n); v.serial = `SN ${2204110 + n}`;
      fields.forEach((f, j) => { v[f.k] = String(+(f.base + ((i * 7 + j * 3) % 5 - 2) * f.step).toFixed(2)); });
    }
    if (n === 8) v.asset = '';
    if (n === 7) { v.asset = '1-160-03155'; v.pow = '27.2'; v.tout = ''; }
    return { n, freq, model: 'PAE T6T', reg: reg(n), v, photos: {} };
  });
  return {
    schema: 1, id: 'dm-txs-3-69', title: 'DM TxS 3/69', station: 'dm', dates: ['2026-11-12', '2026-11-14'], letter: true, cur: 7, fields, tx, assetCheck: [6, 7, 8],
    forms: [['FM-CE.SE-202', 'เครื่องส่ง (21 เครื่อง)', 'tx'], ['FM-CE.SE-501', 'สายอากาศ (19 ต้น)'], ['FM-CE.SE-502', 'ไฟฟ้าสำรอง'], ['FM-CE.SE-402', 'CIMC'],
      ['FM-CE.SE-204', 'Spurious (รูป 2)', 'todo', 'cam'], ['FM-CE.SE-041', 'ก่อน/หลัง', 'done'], ['FM-CE.SE-005', 'เครื่องมือวัด', 'done', 'tools'],
      ['FM-CE.SE-001', 'ทะเบียนอุปกรณ์', 'asset'], ['', 'ใบตรวจสอบหลัง PM'], ['FM-CE.SE-006', 'ปก', 'done']]
      .map(([code, name, kind = 'todo', go]) => ({ code, name, kind, go })),
    tools: [['Clamp Meter', '1-160-02011', '2026-10-14'], ['CMA180 Radio Tester', '1-160-02044', '2027-02-20'], ['Power Meter', '1-160-02078', '2027-03-05'], ['Attenuator 30 dB', '1-160-02102', '2027-04-12']]
      .map(([name, asset, due]) => ({ name, asset, due, photo: '' })),
    folder: { photos: [{ name: 'รูปสถานี' }, { name: 'ตู้ Rack 2' }, {}, {}, {}], docs: [{ name: 'รายงานซ่อม Tx 12 (ร่าง)' }] },
  };
}

// ---- สัญญา data layer (ตรงกับ sharepoint.js) ----
export const listDocs = async ({ system, year, station } = {}) => ({
  items: docs.filter(d => (!system || d.system === system) && (!year || d.year === +year) && (!station || d.station === station || (station === 'dm' && d.station === 'dmrx'))), next: null });
export const getDocUrl = async () => null;          // ไม่มีไฟล์จริง → viewer วาดหน้าตัวอย่าง
export const listTemplates = async () => templates;
export const getBlob = async () => new Blob([]);
export const getJob = async () => seedJob();
export const getCatalog = async () => catalog;
export const getRecent = async () => recent;
