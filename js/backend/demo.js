import { FM202_FIELDS } from '../data/wi-scope.js';
import { SCHEDULE } from '../data/schedule-2569.js';
import { newPmJob } from '../flow.js';
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
  D('rx-stby', 2569, '2/69', 'PM DM RX Radio STBY ครั้งที่ 2/69', '2026-07-20T03:00:00Z', 17, 2, 'review', { dates: ['2026-07-18', '2026-07-19'], origin: 'app', by: ME, performers: [ME, 'วิทยา'] }),
  D('tx-stby', 2569, '1/69', 'PM DM TX Radio STBY ครั้งที่ 1/69', '2025-11-16T03:00:00Z', 20, 2, 'accepted', { dates: ['2025-11-13', '2025-11-15'], performers: [ME, 'ต่อเกียรติ'] }),
  D('tx-stby', 2568, '2/68', 'PM DM TX Radio STBY ครั้งที่ 2/68', '2025-08-08T03:00:00Z', 19, 2, 'accepted', { dates: ['2025-08-05', '2025-08-07'], performers: [ME, 'ต่อเกียรติ'] }),
  D('tx-bk1', 2569, '1/69', 'PM DM TX Radio Backup 1 ครั้งที่ 1/69', '2025-12-18T03:00:00Z', 14, 2, 'accepted', { dates: ['2025-12-16', '2025-12-17'], performers: ['ปริญญา', 'วิทยา'] }),
  D('tx-stby', 2568, '1/68', 'PM DM TX Radio STBY ครั้งที่ 1/68', '2024-11-14T03:00:00Z', 19, 2, 'accepted', { dates: ['2024-11-11', '2024-11-13'], performers: ['ปริญญา', 'วิทยา'] }),
];

const T = (code, rev, name, pages, size, extra = {}) => ({ schema: 1, code, rev, name, pages, size, fetchedAt: '2026-10-28T02:00:00Z',
  sourceUrl: `https://home.aerothai.co.th/cese/node/${extra.kind === 'WI' ? 524 : 526}`, sha256: '0'.repeat(64), kind: 'FM', ...extra });
const templates = [
  T('FM-CE.SE-202', '04', 'ค่าวัดเครื่องส่ง', 2, 0.4e6, { prev: '03', isNew: true, changed: '2026-07-20' }),
  T('FM-CE.SE-501', '01', 'PM สายอากาศ', 1, 0.2e6), T('FM-CE.SE-502', '01', 'PM ไฟฟ้าสำรอง', 1, 0.2e6),
  T('FM-CE.SE-402', '03', 'PM CIMC', 2, 0.3e6, { offline: false }), T('FM-CE.SE-204', '02', 'แพร่สัญญาณแปลกปลอม', 1, 0.2e6),
  T('WI-CE.SE-02', '06', 'เครื่องส่งวิทยุ', 60, 9e6, { kind: 'WI' }),
];


// ---- เอกสารจากเว็บกอง (หมวด) · total = จำนวนจริงจาก notes/cese-web-catalog.json · rows = ตัวอย่าง ~6 แถวจริงต่อหมวด (ยังไม่โหลดไฟล์จริง) ----
const PAGES = { form: 2, wi: 30, qp: 12, qm: 40, sd: 20, ann: 3, plan: 6, table: 8, manual: 24 };
const CATS = [["fm", "ฟอร์ม (FM)", 95, [["FM-CE.SE-001", "", "ทะเบียนอุปกรณ์", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-001%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%AD%E0%B8%B8%E0%B8%9B%E0%B8%81%E0%B8%A3%E0%B8%93%E0%B9%8C.pdf", ""], ["FM-CE.SE-002", "", "ประวัติอุปกรณ์", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-002%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%A7%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B8%AD%E0%B8%B8%E0%B8%9B%E0%B8%81%E0%B8%A3%E0%B8%93%E0%B9%8C.pdf", ""], ["FM-CE.SE-003", "", "ทะเบียนปัญหา", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-003%E0%B8%97%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%9B%E0%B8%B1%E0%B8%8D%E0%B8%AB%E0%B8%B2.pdf", ""], ["FM-CE.SE-004", "", "แผนบำรุงรักษา", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-004%E0%B9%81%E0%B8%9C%E0%B8%99%E0%B8%9A%E0%B8%B3%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B8%A3%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B8%B2.pdf", ""], ["FM-CE.SE-005", "04", "รายการเครื่องมืออะไหล่", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/04%20FM-CESE-005%20Rev.04%20%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%84%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%AD%E0%B8%B0%E0%B9%84%E0%B8%AB%E0%B8%A5%E0%B9%88%20edit.pdf", ""], ["FM-CE.SE-006", "", "รายงานการซ่อมบำรุง", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/FM/FM_ISO/pdf/ExFM-CESE-006%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%8B%E0%B9%88%E0%B8%AD%E0%B8%A1%E0%B8%9A%E0%B8%B3%E0%B8%A3%E0%B8%B8%E0%B8%87.pdf", ""]], "form"], ["wi", "WI", 66, [["WI-CE.SE-001", "06", "RX", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-01%20RX%20Rev.06.pdf", ""], ["WI-CE.SE-002", "06", "PM Tx", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-002%20PM%20Tx%20Rev.06.pdf", ""], ["WI-CE.SE-003", "07", "PM TRx", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-003%20PM%20TRx%20Rev.07.pdf", ""], ["WI-CE.SE-004", "03", "PM ระบบสายอากาศ", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-04%20PM%20%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%AA%E0%B8%B2%E0%B8%A2%E0%B8%AD%E0%B8%B2%E0%B8%81%E0%B8%B2%E0%B8%A8%20Rev.03.pdf", ""], ["WI-CE.SE-005", "03", "VCCS Freq", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-05%20Rev03%20VCCS%20Freq.pdf", ""], ["WI-CE.SE-006", "04", "PM VCCS Schmid", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/WI/master/WI-CE.SE-06%20PM%20VCCS%20Schmid%20Rev.04a.pdf", ""]], "wi"], ["qp", "QP", 6, [["QP-CE.SE-01", "09", "PM", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-01%20PM%20Rev.09.pdf", ""], ["QP-CE.SE-02", "07", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-02%20Rev.07.pdf", ""], ["QP-CE.SE-03", "08", "Watch", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-03%20Watch%20Rev.08.pdf", ""], ["QP-CE.SE-04", "08", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-04%20Rev.08.pdf", ""], ["QP-CE.SE-05", "06", "Mat Control", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QP/master/QP-CE.SE-05%20Mat%20Control%20Rev.06.pdf", ""], ["", "", "ผู้รับผิดชอบการดำเนินงานในระบบบริหารคุณภาพ QP-CE.SE", "https://home.aerothai.co.th/cese/sites/cese/files/documents/Announce/CESEAnnounce/%E0%B8%9B%E0%B8%81_%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A728_2569-0%E0%B9%81%E0%B8%95%E0%B9%88%E0%B8%87%E0%B8%95%E0%B8%B1%E0%B9%89%E0%B8%87%E0%B8%84%E0%B8%93%E0%B8%B0%E0%B8%97%E0%B8%B3%E0%B8%87%E0%B8%B2%E0%B8%99%20ISO9001.pdf", ""]], "qp"], ["qm", "QM", 1, [["QM-CE.SE", "09", "คู่มือคุณภาพ", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/QM/master/QM-CE.SE%20Rev.09.pdf", ""]], "qm"], ["sd", "SD", 151, [["SD-CE.SE-020", "02", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-20%20Rev.02.pdf", ""], ["SD-CE.SE-029", "02", "", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-029%20Rev02.pdf", ""], ["SD-CE.SE-061", "05", "SOM MK", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-061%20SOM%20MK%20Rev.05.pdf", ""], ["SD-CE.SE-062", "08", "SOM SB", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-062%20SOM%20SB%20Rev.08.pdf", ""], ["SD-CE.SE-063", "07", "SOM CMA", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-063%20SOM%20CMA%20Rev.07.pdf", ""], ["SD-CE.SE-064", "05", "SOM PUT", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/SD/SD-CE.SE-064%20SOM%20PUT%20Rev.05.pdf", ""]], "sd"], ["ann", "ประกาศ/หนังสือ ISO", 316, [["", "", "ปก/วส.บว463/2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%9B%E0%B8%81_%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7463_2567%20%E0%B8%84%E0%B8%93%E0%B8%B0%E0%B8%97%E0%B8%B3%E0%B8%87%E0%B8%B2%E0%B8%99%20ISO%209001%20%E0%B8%9B%E0%B8%B5%E0%B8%87%E0%B8%9A%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%A1%E0%B8%B2%E0%B8%93%202568.pdf", ""], ["", "", "จตุพงศ์1/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%88%E0%B8%95%E0%B8%B8%E0%B8%9E%E0%B8%87%E0%B8%A8%E0%B9%8C1_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "วส.บว25/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A725_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "จตุพงศ์4/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%88%E0%B8%95%E0%B8%B8%E0%B8%9E%E0%B8%87%E0%B8%A8%E0%B9%8C4_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "วส.บว25/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A757_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "จตุพงศ์6/2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%88%E0%B8%95%E0%B8%B8%E0%B8%9E%E0%B8%87%E0%B8%A8%E0%B9%8C6_2568-0a%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""]], "ann"], ["planpm", "แผน PM", 20, [["", "", "PM ส่วนกลาง 2570", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2570%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87.pdf", ""], ["", "", "PM ส่วนกลาง 2569", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2569%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C11-2568.pdf", ""], ["", "", "PM ส่วนกลาง 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2567%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C11-2567%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87.pdf", ""], ["", "", "PM ส่วนกลาง 2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2566%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C10-2566%20Plan%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "PM ส่วนกลาง 2566", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2565%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C3-2565%20%E0%B9%81%E0%B8%9C%E0%B8%99%20PM%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "PM ส่วนกลาง 2565", "https://home.aerothai.co.th/cese/sites/cese/files/documents/PlanPM/2564%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7-%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B9%8C%202-2564%20%E0%B9%81%E0%B8%9C%E0%B8%99%20PM%202565%20%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%81%E0%B8%A5%E0%B8%B2%E0%B8%87%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""]], "plan"], ["tablepm", "ตาราง PM", 23, [["", "", "ตาราง PM 2569", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2568%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7513_2568-3%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "ตาราง PM 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2568%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7237_2568-3%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file%20.pdf", ""], ["", "", "ตาราง PM 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2568%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A791_2568-0%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "ตาราง PM 2568", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2567%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7512_2567%20TablePM%20%E0%B8%87%E0%B8%9A68.pdf", ""], ["", "03", "ตาราง PM 2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/ISO9001/AnnounceISO/2567%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A720-2567%20Table%20PM%20Rev.03%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""], ["", "", "ตาราง PM 2567", "https://home.aerothai.co.th/cese/sites/cese/files/documents/TablePM/2566%20%E0%B8%A7%E0%B8%AA.%E0%B8%9A%E0%B8%A7812-2566%20Table%20PM%202567%20%E0%B8%A3%E0%B8%A7%E0%B8%A1%20file.pdf", ""]], "table"], ["manual", "คู่มืออุปกรณ์", 62, [["", "", "PM Eventide Nexlog", "https://home.aerothai.co.th/cese/sites/cese/files/documents/Manual/DVR/NexLog/PM%20Eventide%20Nexlog.pdf", "DVR"], ["", "", "Export and Save File DVR Nexlog Eventide ", "https://home.aerothai.co.th/cese/sites/cese/files/documents/DVR/Export%20and%20Save%20File%20DVR%20Nexlog%20Eventide%20.pdf", "DVR"], ["", "", "D12_PAE 50W VHF AM_T_1500", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/D12_PAE%2050W%20VHF%20AM_T_1500.pdf", "PAE"], ["", "", "D26_T6T VHF Circuit_68-60000671 WSM Processor Module", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/D26_T6T%20VHF%20Circuit_68-60000671%20WSM%20Processor%20Module.pdf", "T6T"], ["", "", "Manual Argus_Cordex 24-3.1 KW", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/Manual%20Argus_Cordex%2024-3.1%20KW.pdf", "CHARGER"], ["", "", "Manual ATS APC_AP7723  5-3-52", "https://home.aerothai.co.th/cese/sites/cese/files/master/files/Manual%20ATS%20APC_AP7723%20%205-3-52.pdf", "ATS"]], "manual"]];
const files = CATS.map(([id, name, total, rows, kind]) => ({ id, name, total, rows: rows.map(([code, rev, title, url, tag], i) => ({
  schema: 1, id: code || `${id}-${i + 1}`, code, rev, title, tag, kind, cat: id, pages: PAGES[kind], size: 1e6, fetchedAt: '2026-10-28T02:00:00Z', sourceUrl: url, offline: i < 3 })) }));

// ค่าที่ต้องวัด (ฟอร์ม FM-CE.SE-202) = config กลางใน data/wi-scope.js
const fields = FM202_FIELDS.map(({ col, ...f }) => f);
const FREQ = [118.1, 118.55, 119.3, 120.7, 121.9, 122.5, 126.4, 127.1, 128.35, 129.2, 131.45, 132.0, 133.6, 134.8, 135.95, 136.7, 225.0, 233.5, 236.2, 238.4, 240.0];
const reg = n => `1-160-${String(3143 + n).padStart(5, '0')}`;

// งานที่เปิดแล้วในตัวอย่าง: DM TX Radio Main 2/69 (ก.ค. 69 ในตาราง) · ขั้นหน้างาน · FM-040 อนุมัติแล้ว · ตรวจพร้อมแล้ว · กรอกค่า Tx 1-15 ไปแล้ว
function seedTx() {
  const row = SCHEDULE.find(r => r.job.startsWith('DM TX Radio Main') && r.ym === '2026-07');
  const j = newPmJob({ id: 'dm-txm-2-69', row, system: 'tx-main', eng: 'ตัวอย่าง ก.', travel: 'รถยนต์', draft: false, prev: prevRound('DM'), now: '2026-07-27T10:00:00Z' });
  const tx = FREQ.map((freq, i) => {
    const n = i + 1, v = {};
    if (n <= 15) {
      v.asset = reg(n); v.serial = `SN ${2204110 + n}`;
      fields.forEach((f, k) => { v[f.k] = String(+(f.base + ((i * 7 + k * 3) % 5 - 2) * f.step).toFixed(2)); });
    }
    if (n === 8) v.asset = '';
    if (n === 7) { v.asset = '1-160-03155'; v.pow = '27.2'; v.tout = ''; }
    return { n, freq, model: 'PAE T6T', reg: reg(n), v, photos: {} };
  });
  j.pm.people = ['ต่อเกียรติ', 'สมหมาย']; j.vals.people.v = 'ต่อเกียรติ, สมหมาย'; delete j.vals.people.pending;
  return Object.assign(j, { f040: 'approved', dates: ['2026-07-29', '2026-07-31'], touched: '2026-07-27T10:00:00Z', ready: { rev: true, f005: true, man: true }, fields, tx, cur: 7, assetCheck: [6, 7, 8],
    vals: { ...j.vals, f040: { v: 'อนุมัติแล้ว · วส.บว-ตัวอย่าง 13/2569', src: 'sarabun', loc: 'บันทึกงาน เลขทะเบียน ตัวอย่าง', at: '2026-07-27' }, dates: { v: '29–31 ก.ค. 69', src: 'sarabun', loc: 'FM-040 · วันเวลาเริ่ม–เสร็จ', at: '2026-07-27' } },
    forms: j.forms.map(f => f.kind === 'tx' || f.code === 'FM-CE.SE-202' ? { ...f, kind: 'tx' } : f.code === 'FM-CE.SE-001' ? { ...f, kind: 'asset' } : f.code === 'FM-CE.SE-041' ? { ...f, done: true } : f) });
}

// ---- สัญญา data layer (ตรงกับ supabase.js) ----
export const listExamples = async ({ system_id } = {}) => docs.filter(d => !system_id || d.system === system_id);
export const signUrl = async () => null;          // ไม่มีไฟล์จริง → viewer วาดหน้าตัวอย่าง / ลิงก์เว็บกอง
export const listTemplates = async () => templates;
export const getBlob = async () => new Blob([]);
export const getFiles = async () => files;
// วันนี้ของตัวอย่าง: ตารางปีงบ 2569 จบ ก.ย. 69 ส่วนปีงบ 2570 ยังไม่ขึ้นเว็บกอง → ตัวอย่างใช้วันสมมติให้เห็น "เดือนนี้/เดือนหน้า" (ป้าย "ข้อมูลจำลอง" ในหน้าวันนี้/ฉัน)
export const today = () => '2026-07-28';
// ข้อมูลรอบก่อน (ตัวอย่าง): วิศวกรเฝ้าระวัง + เครื่องมือวัดที่ใช้รอบก่อน · การเดินทางจำต่อสถานีฝั่งแอป (pref) ไม่ใช่ที่นี่
export const prevRound = site => ({ eng: ['ตัวอย่าง ก.', 'ตัวอย่าง ข.', 'ตัวอย่าง ค.'], travel: site === 'DM' ? 'รถยนต์' : '',
  tools: [['Test Set CMA180', '1-160-02231-0000', '2026-09-16'], ['ZVH8 Spectrum Analyzer', '1-160-03217-0000', '2026-12-01'], ['Digital Clamp Meter', '1-160-03155-0000', '2027-02-20'], ['Attenuator 30 dB', '1-160-02102', '2027-04-12']].map(([name, asset, due]) => ({ name, asset, due })) });
// งานเลยกำหนดส่ง (ตัวอย่าง): RCAG เขาพระบาท ลำปาง ทำเสร็จ 12 มิ.ย. → ครบ 20 วันทำการ 10 ก.ค. → เลยกำหนด
function seedLate() {
  const row = SCHEDULE.find(r => r.job.startsWith('สถานี RCAG เขาพระบาท') && r.ym === '2026-07');
  const j = newPmJob({ id: 'rcag-kpb-2-69', row, system: '', eng: 'ตัวอย่าง ข.', travel: 'เครื่องบิน', draft: false, prev: prevRound('สถานี'), now: '2026-06-09T10:00:00Z' });
  return Object.assign(j, { f040: 'approved', dates: ['2026-06-10', '2026-06-12'], touched: '2026-06-12T10:00:00Z', ready: { rev: true, f005: true, man: true } });
}
export const listJobs = async () => [seedTx(), seedLate()];
export const getCatalog = async () => catalog;
