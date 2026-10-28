// ข้อมูลจำลอง (โหมด demo) — โครง JSON ตาม spec §2: schema:1 · id ถาวร · เวลา ISO 8601 UTC
// ตัวเลขทั้งหมดเป็นตัวอย่างสำหรับดูหน้าตา ไม่ใช่ค่าวัดจริง
const D = (system, year, round, title, modified, pages, crew, status, extra = {}) => ({
  schema: 1, id: `${system}-${year}-${round.replace('/', '-')}`, title, system, year, round,
  path: `CE.SE/รายงาน PM/${system}/${year}/${title}.pdf`, modified, by: 'ตัวอย่าง', size: 1.7e6, status, pages, crew, ...extra });

export const catalog = {
  schema: 1,
  // ระบบ = ชนิดงาน PM จริงของ DM (ฟอร์มไฟฟ้า/สายอากาศ/CIMC อยู่ในงานวิทยุ ไม่ใช่ระบบแยก)
  systems: [['rx-main', 'DM RX Radio Main', 'หอฯ ด้านทิศใต้ ชั้น ๒', 'radio', 42], ['rx-stby', 'DM RX Radio STBY', 'หอฯ ด้านทิศเหนือ ชั้น ๕', 'radio', 40],
    ['tx-main', 'DM TX Radio Main', 'สถานี RADAR', 'radio', 38], ['tx-stby', 'DM TX Radio STBY', 'สถานีเครื่องส่ง', 'radio', 128],
    ['tx-bk1', 'DM TX Radio Backup 1', 'สถานี ILS', 'radio', 30], ['cctv', 'DM CCTV', '', 'cctv', 24],
    ['vr', 'DM Voice Recorder', 'หอฯ ทิศเหนือและทิศใต้', 'mic', 31], ['bk-atis', 'DM Radio Backup & ATIS', '', 'radio', 18],
    ['vccs-bk', 'DM VCCS Backup', 'หอฯ ด้านทิศเหนือ', 'headset', 22], ['vccs', 'DM VCCS', 'หอฯ ด้านทิศใต้', 'headset', 44]]
    .map(([id, name, loc, icon, count]) => ({ id, name, loc, icon, count })),
  // จำนวนรายงานต่อปี (ตัวอย่าง): radio ตามแล็บ · ระบบอื่นแบ่งตามสัดส่วน
  years: { 'tx-stby': { 2570: 1, 2569: 14, 2568: 41, 2567: 38, 2566: 35 }, 'tx-bk1': { 2570: 1, 2569: 12, 2568: 9, 2567: 8 } },
};
// ปีของแต่ละระบบอยู่ใน catalog (backend จริงส่งโครงเดียวกัน) · หน้าจอไม่เรียก demo ตรง
catalog.systems.forEach(sys => {
  const y = catalog.years[sys.id] || Object.fromEntries([2569, 2568, 2567].map((k, i) => [k, Math.round(sys.count * [.2, .4, .4][i])]));
  sys.years = Object.entries(y).sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year: +year, count }));
});

// รอบ PM มีแค่ 2 ครั้ง/ปีงบประมาณ: ครั้งที่ 1 = ต.ค.–มี.ค. · ครั้งที่ 2 = เม.ย.–ก.ย. (ปีงบฯ 2570 เริ่ม 1 ต.ค. 2569)
const ME = 'สมหมาย';
const docs = [
  D('tx-stby', 2570, '1/70', 'PM DM TX Radio STBY ครั้งที่ 1/70', '2026-10-26T03:00:00Z', 19, 2, 'draft', { dates: ['2026-11-12', '2026-11-14'], origin: 'app', by: ME, performers: [ME, 'วิทยา'] }),
  D('tx-stby', 2569, '2/69', 'PM DM TX Radio STBY ครั้งที่ 2/69', '2026-10-24T03:00:00Z', 21, 2, 'accepted', { dates: ['2026-08-04', '2026-08-06'], performers: [ME, 'ปริญญา'] }),
  D('rx-stby', 2569, '2/69', 'PM DM RX Radio STBY ครั้งที่ 2/69', '2026-07-20T03:00:00Z', 17, 2, 'review', { dates: ['2026-07-18', '2026-07-19'], performers: ['ปริญญา', 'วิทยา'] }),
  D('tx-stby', 2569, '1/69', 'PM DM TX Radio STBY ครั้งที่ 1/69', '2025-11-16T03:00:00Z', 20, 2, 'accepted', { dates: ['2025-11-13', '2025-11-15'], performers: ['ปริญญา', 'วิทยา'] }),
  D('tx-stby', 2568, '2/68', 'PM DM TX Radio STBY ครั้งที่ 2/68', '2025-08-08T03:00:00Z', 19, 2, 'accepted', { dates: ['2025-08-05', '2025-08-07'], performers: ['ปริญญา', 'วิทยา'] }),
  D('tx-bk1', 2570, '1/70', 'PM DM TX Radio Backup 1 ครั้งที่ 1/70', '2026-10-08T03:00:00Z', 14, 2, 'accepted', { dates: ['2026-10-06', '2026-10-07'], performers: ['ปริญญา', 'วิทยา'] }),
];

const T = (code, rev, name, pages, size, extra = {}) => ({ schema: 1, code, rev, name, pages, size, fetchedAt: '2026-10-28T02:00:00Z',
  sourceUrl: `https://home.aerothai.co.th/cese/node/${extra.kind === 'wi' ? 524 : 526}`, sha256: '0'.repeat(64), kind: 'form', ...extra });
const templates = [
  T('FM-CE.SE-202', '04', 'ค่าวัดเครื่องส่ง', 2, 0.4e6, { prev: '03', isNew: true, changed: '2026-10-27' }),
  T('FM-CE.SE-501', '01', 'PM สายอากาศ', 1, 0.2e6), T('FM-CE.SE-502', '01', 'PM ไฟฟ้าสำรอง', 1, 0.2e6),
  T('FM-CE.SE-402', '03', 'PM CIMC', 2, 0.3e6, { offline: false }), T('FM-CE.SE-204', '02', 'แพร่สัญญาณแปลกปลอม', 1, 0.2e6),
  T('WI-CE.SE-02', '06', 'เครื่องส่งวิทยุ', 60, 9e6, { kind: 'wi' }),
];


// ---- เอกสารจากเว็บกอง (หมวด) · total = จำนวนจริงจาก notes/cese-web-catalog.json · rows = ตัวอย่าง ~6 แถวจริงต่อหมวด (ยังไม่โหลดไฟล์จริง) ----
const PAGES = { form: 2, wi: 30, qp: 12, qm: 40, sd: 20, ann: 3, plan: 6, table: 8, manual: 24 };
const CATS = [["fm", "ฟอร์ม (FM)", 95, [["FM-CE.SE-001", "", "ทะเบียนอุปกรณ์", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-001%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%AD%E0%B8%B8%E0%B8%9B%E0%B8%81%E0%B8%A3%E0%B8%93%E0%B9%8C.pdf", ""], ["FM-CE.SE-002", "", "ประวัติอุปกรณ์", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-002%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%A7%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B8%AD%E0%B8%B8%E0%B8%9B%E0%B8%81%E0%B8%A3%E0%B8%93%E0%B9%8C.pdf", ""], ["FM-CE.SE-003", "", "ทะเบียนปัญหา", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-003%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%9B%E0%B8%B1%E0%B8%8D%E0%B8%AB%E0%B8%B2.pdf", ""], ["FM-CE.SE-004", "", "แผนบำรุงรักษา", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-004%E0%B9%81%E0%B8%9C%E0%B8%99%E0%B8%9A%E0%B8%B3%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B8%A3%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B8%B2.pdf", ""], ["FM-CE.SE-005", "04", "รายการเครื่องมืออะไหล่", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/04%20FM-CESE-005%20Rev.04%20%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%84%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%AD%E0%B8%B0%E0%B9%84%E0%B8%AB%E0%B8%A5%E0%B9%88%20edit.pdf", ""], ["FM-CE.SE-006", "", "รายงานการซ่อมบำรุง", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-006%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1%E0%B8%9A%E0%B8%B3%E0%B8%A3%E0%B8%B8%E0%B8%87.pdf", ""]], "form"], ["wi", "WI", 66, [["WI-CE.SE-001", "06", "RX", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-01%20RX%20Rev.06.pdf", ""], ["WI-CE.SE-002", "06", "PM Tx", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-002%20PM%20Tx%20Rev.06.pdf", ""], ["WI-CE.SE-003", "07", "PM TRx", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-003%20PM%20TRx%20Rev.07.pdf", ""], ["WI-CE.SE-004", "03", "PM ระบบสายอากาศ", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-04%20PM%20%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%AA%E0%B8%B2%E0%B8%A2%E0%B8%AD%E0%B8%B2%E0%B8%81%E0%B8%B2%E0%B8%A8%20Rev.03.pdf", ""], ["WI-CE.SE-005", "03", "VCCS Freq", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-05%20Rev03%20VCCS%20Freq.pdf", ""], ["WI-CE.SE-006", "04", "PM VCCS Schmid", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-06%20PM%20VCCS%20Schmid%20Rev.04a.pdf", ""]], "wi"], ["qp", "QP", 6, [["QP-CE.SE-01", "09", "PM", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-01%20PM%20Rev.09.pdf", ""], ["QP-CE.SE-02", "07", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-02%20Rev.07.pdf", ""], ["QP-CE.SE-03", "08", "Watch", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-03%20Watch%20Rev.08.pdf", ""], ["QP-CE.SE-04", "08", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-04%20Rev.08.pdf", ""], ["QP-CE.SE-05", "06", "Mat Control", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-05%20Mat%20Control%20Rev.06.pdf", ""], ["", "", "ผู้รับผิดชอบการดำเนินงานในระบบบริหารคุณภาพ QP-CE.SE", "https://home.aerothai.co.th/cese/sites/cese/files/documents/Announce/CESEAnnounce/%E0%B8%9B%E0%B8%81_%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A728_2569-0%E0%B9%81%E0%B8%95%E0%B9%88%E0%B8%87%E0%B8%95%E0%B8%B1%E0%B9%89%E0%B8%87%E0%B8%84%E0%B8%93%E0%B8%B0%E0%B8%97%E0%B8%B3%E0%B8%87%E0%B8%B2%E0%B8%99%20ISO9001.pdf", ""]], "qp"], ["qm", "QM", 1, [["QM-CE.SE", "09", "คู่มือคุณภาพ", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QM/master/QM-CE.SE%20Rev.09.pdf", ""]], "qm"], ["sd", "SD", 151, [["SD-CE.SE-020", "02", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-20%20Rev.02.pdf", ""], ["SD-CE.SE-029", "02", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-029%20Rev02.pdf", ""], ["SD-CE.SE-061", "05", "SOM MK", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-061%20SOM%20MK%20Rev.05.pdf", ""], ["SD-CE.SE-062", "08", "SOM SB", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-062%20SOM%20SB%20Rev.08.pdf", ""], ["SD-CE.SE-063", "07", "SOM CMA", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-063%20SOM%20CMA%20Rev.07.pdf", ""], ["SD-CE.SE-064", "05", "SOM PUT", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-064%20SOM%20PUT%20Rev.05.pdf", ""]], "sd"], ["ann", "ประกาศ/หนังสือ ISO", 316, [["", "", "ปก/วส.บว463/2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%9B%E0%B8%81_%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7463_2567%20%E0%B8%84%E0%B8%93%E0%B8%B0%E0%B8%97%E0%B8%B3%E0%B8%87%E0%B8%B2%E0%B8%99%20ISO%209001%20%E0%B8%9B%E0%B8%B5%E0%B8%87%E0%B8%9A%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%A1%E0%B8%B2%E0%B8%93%202568.pdf", ""], ["", "", "จตุพงศ์1/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%88%E0%B8%95%E0%B8%B8%E0%B8%9E%E0%B8%87%E0%B8%A8%E0%B9%8C1_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "วส.บว25/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A725_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "จตุพงศ์4/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%88%E0%B8%95%E0%B8%B8%E0%B8%9E%E0%B8%87%E0%B8%A8%E0%B9%8C4_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "วส.บว25/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A757_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "จตุพงศ์6/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%88%E0%B8%95%E0%B8%B8%E0%B8%9E%E0%B8%87%E0%B8%A8%E0%B9%8C6_2568-0a%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""]], "ann"], ["planpm", "แผน PM", 20, [["", "", "PM ส่วนกลาง 2570", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2570%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87.pdf", ""], ["", "", "PM ส่วนกลาง 2569", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2569%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C11-2568.pdf", ""], ["", "", "PM ส่วนกลาง 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2567%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C11-2567%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87.pdf", ""], ["", "", "PM ส่วนกลาง 2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2566%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C10-2566%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "PM ส่วนกลาง 2566", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2565%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C3-2565%20%E0%B9%81%E0%B8%9C%E0%B8%99%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "PM ส่วนกลาง 2565", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2564%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C%202-2564%20%E0%B9%81%E0%B8%9C%E0%B8%99%20PM%202565%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""]], "plan"], ["tablepm", "ตาราง PM", 23, [["", "", "ตาราง PM 2569", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2568%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7513_2568-3%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "ตาราง PM 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2568%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7237_2568-3%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file%20.pdf", ""], ["", "", "ตาราง PM 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2568%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A791_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "ตาราง PM 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2567%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7512_2567%20TablePM%20%E0%B8%87%E0%B8%9A68.pdf", ""], ["", "03", "ตาราง PM 2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/2567%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A720-2567%20Table%20PM%20Rev.03%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "ตาราง PM 2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2566%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7812-2566%20Table%20PM%202567%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""]], "table"], ["manual", "คู่มืออุปกรณ์", 62, [["", "", "PM Eventide Nexlog", "https://home.aerothai.co.th/cese/sites/cese/files/documents/Manual/DVR/NexLog/PM%20Eventide%20Nexlog.pdf", "DVR"], ["", "", "Export and Save File DVR Nexlog Eventide ", "https://home.aerothai.co.th/cese/sites/cese/files/documents/DVR/Export%20and%20Save%20File%20DVR%20Nexlog%20Eventide%20.pdf", "DVR"], ["", "", "D12_PAE 50W VHF AM_T_1500", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/D12_PAE%2050W%20VHF%20AM_T_1500.pdf", "PAE"], ["", "", "D26_T6T VHF Circuit_68-60000671 WSM Processor Module", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/D26_T6T%20VHF%20Circuit_68-60000671%20WSM%20Processor%20Module.pdf", "T6T"], ["", "", "Manual Argus_Cordex 24-3.1 KW", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/Manual%20Argus_Cordex%2024-3.1%20KW.pdf", "CHARGER"], ["", "", "Manual ATS APC_AP7723  5-3-52", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/Manual%20ATS%20APC_AP7723%20%205-3-52.pdf", "ATS"]], "manual"]];
const files = CATS.map(([id, name, total, rows, kind]) => ({ id, name, total, rows: rows.map(([code, rev, title, url, tag], i) => ({
  schema: 1, id: code || `${id}-${i + 1}`, code, rev, title, tag, kind, cat: id, pages: PAGES[kind], size: 1e6, fetchedAt: '2026-10-28T02:00:00Z', sourceUrl: url, offline: i < 3 })) }));

// ค่าที่ต้องวัด (ฟอร์ม FM-CE.SE-202)
const fields = [
  ['err', 'Error (Hz)', 'Error', 'มาตรฐาน ±50 Hz', -50, 50, 'Hz', 12, 3], ['osc', 'Oscillator (VDC)', 'Oscillator', 'มาตรฐาน 4.5–5.5 V', 4.5, 5.5, 'VDC', 5, .05, 1],
  ['pow', 'Power (W)', 'Power', 'มาตรฐาน 10–25 W', 10, 25, 'W', 20, 1, 1], ['spur', 'Spurious (dBc)', 'Spurious', 'มาตรฐาน ไม่เกิน −60 dBc', -999, -60, 'dBc', -68, 1],
  ['mod', 'Mod (%)', 'Mod', 'มาตรฐาน 80–95 %', 80, 95, '%', 85, 1], ['sens', 'Sensitivity (dBm)', 'Sensitivity', 'มาตรฐาน ไม่เกิน −100 dBm', -130, -100, 'dBm', -104, 1],
  ['dist', 'Distn (%)', 'Distn', 'มาตรฐาน ไม่เกิน 3 %', 0, 3, '%', 1.2, .2], ['tout', 'Time out (s)', 'Time out', 'มาตรฐาน 170–190 s', 170, 190, 's', 180, 2],
].map(([k, n, t, std, min, max, u, base, step, cam]) => ({ k, n, t, std, min, max, u, base, step, cam: !!cam }));
const FREQ = [118.1, 118.55, 119.3, 120.7, 121.9, 122.5, 126.4, 127.1, 128.35, 129.2, 131.45, 132.0, 133.6, 134.8, 135.95, 136.7, 225.0, 233.5, 236.2, 238.4, 240.0];
const reg = n => `1-160-${String(3143 + n).padStart(5, '0')}`;

function seedTx() {
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
    schema: 1, id: 'dm-txs-1-70', title: 'DM TX Radio STBY 1/70', round: '1/70', status: 'doing', touched: '2026-10-27T10:00:00Z', system: 'tx-stby', dates: ['2026-11-12', '2026-11-14'], letter: true, cur: 7, fields, tx, assetCheck: [6, 7, 8],
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
export const listDocs = async ({ system, year } = {}) => ({
  items: docs.filter(d => (!system || d.system === system) && (!year || d.year === +year)), next: null });
export const getDocUrl = async () => null;          // ไม่มีไฟล์จริง → viewer วาดหน้าตัวอย่าง
export const listTemplates = async () => templates;
export const getBlob = async () => new Blob([]);
export const getFiles = async () => files;
// งานของ PM (jobs[]): หลายระบบถึงรอบพร้อมกันได้ · ระบบที่ไม่ใช่ TX ในตัวอย่างมีฟอร์มชุดสั้น (ยังไม่มีรายละเอียดกรอกค่า)
export const GENERIC_FORMS = [['FM-CE.SE-005', 'เครื่องมือวัด'], ['FM-CE.SE-001', 'ทะเบียนอุปกรณ์'], ['FM-CE.SE-041', 'ก่อน/หลัง'], ['', 'ใบตรวจสอบหลัง PM'], ['FM-CE.SE-006', 'ปก']];
export const genericJob = (id, title, system, round, dates, status, touched) => ({ schema: 1, id, title, round, system, dates, status, touched, cur: 1, letter: false,
  forms: GENERIC_FORMS.map(([code, name]) => ({ code, name, kind: status === 'done' ? 'done' : 'todo' })), tools: [], folder: { photos: [], docs: [] } });
export const listJobs = async () => [seedTx(),
  genericJob('dm-cctv-1-70', 'DM CCTV 1/70', 'cctv', '1/70', ['2026-11-18', '2026-11-19'], 'todo', '2026-10-26T08:00:00Z'),
  genericJob('dm-txs-2-69', 'DM TX Radio STBY 2/69', 'tx-stby', '2/69', ['2026-08-04', '2026-08-06'], 'done', '2026-08-06T09:00:00Z'),
  genericJob('dm-vccs-2-69', 'DM VCCS (หอฯ ด้านทิศใต้) 2/69', 'vccs', '2/69', ['2026-08-10', '2026-08-12'], 'done', '2026-08-12T09:00:00Z')];
export const getCatalog = async () => catalog;
