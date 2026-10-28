// ตรวจรหัสฟอร์ม + map ช่องของฟอร์มทางการ (cell map จาก notes/form-inventory-2-69.md)
import { num, rnd } from './xlsx.js';

// pdf.js บางไฟล์แยกตัวอักษรด้วยช่องว่าง ("FM - CE. S E - 005", "Rev. 0 4") → ยอมช่องว่างระหว่างตัวอักษร
const FORM_RE = /(FM|WI|QP|QM)\s*-\s*C\s*E\s*\.\s*S\s*E\s*-\s*(\d{2,3})/i, FORM_SPACED = /(FM|WI|QP|QM)\s*-\s*C\s*E\s*\.\s*S\s*E\s*-\s*(\d(?:\s?\d){1,2})/i;
export function detectForm(text) {
  const m = FORM_RE.exec(text || '') || FORM_SPACED.exec(text || ''); if (!m) return null;
  const form = `${m[1].toUpperCase()}-CE.SE-${m[2].replace(/\s/g, '')}`;
  const rev = /Rev\.?\s*0?\s?(\d{1,2})/i.exec(text.slice(m.index, m.index + 300));
  return { form, rev: rev ? rev[1].padStart(2, '0') : undefined };
}

const colN = c => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const splitRef = r => { const m = /^([A-Z]+)(\d+)$/.exec(r); return [m[1], +m[2]]; };

// หัวฟอร์มอยู่แถว 1-3: เซลล์ที่มีรหัส FM-… และเลข Rev. ที่อยู่หลังเซลล์ 'Rev.'
export function detectXlsxForm(sheet) {
  let form, rev;
  for (const [ref, v] of Object.entries(sheet.cells)) {
    const [c, r] = splitRef(ref); if (r > 3 || typeof v !== 'string') continue;
    const d = detectForm(v); if (d && !form) form = d.form;
    if (/^Rev\.?$/i.test(v.trim())) {
      const next = Object.keys(sheet.cells).filter(k => { const [c2, r2] = splitRef(k); return r2 === r && colN(c2) > colN(c); }).sort((a, b) => colN(splitRef(a)[0]) - colN(splitRef(b)[0]))[0];
      if (next) rev = String(sheet.cells[next]).padStart(2, '0');
    }
  }
  return form ? { form, rev } : null;
}

const val = (out, cells, sheet, ref, field, unit, { text = false } = {}) => {
  const raw = cells[ref]; if (raw == null) return;
  const n = num(raw);
  if (n != null && !text) out.push({ field, value: rnd(n), ...(unit && { unit }), locator: `${sheet}!${ref}`, confidence: 'high' });
  else if (typeof raw === 'string' && raw.trim() !== '' && raw.trim() !== '-') out.push({ field, value: raw.trim(), locator: `${sheet}!${ref}`, confidence: 'high' });
};

// FM-202: 1 แถว = 1 เครื่องส่ง; Page 1 แถว 9..23, Page 2 แถว 9..14; ดัชนี tx[n] = เลข NO ในคอลัมน์ A
const TX = [['B', 'freq_mhz', 'MHz'], ['G', 'asset'], ['H', 'serial'], ['I', 'error_hz', 'Hz'], ['J', 'error_adj_hz', 'Hz'], ['K', 'osc_vdc', 'V'], ['L', 'osc_adj_vdc', 'V'],
  ['M', 'power_w', 'W'], ['N', 'power_adj_w', 'W'], ['O', 'spurious_dbc', 'dBc'], ['P', 'mod_pct', '%'], ['Q', 'mod_adj_pct', '%'],
  ['R', 'sens_dbm', 'dBm'], ['S', 'sens_adj_dbm', 'dBm'], ['T', 'distn_pct', '%']];
function fm202(sheets) {
  const out = [];
  for (const s of sheets) {
    const m = /Page\s*(\d)/i.exec(s.name); if (!m) continue;
    const last = m[1] === '1' ? 23 : 14;
    for (let r = 9; r <= last; r++) {
      const no = num(s.cells['A' + r]); if (no == null) continue;
      for (const [c, f, u] of TX) val(out, s.cells, s.name, c + r, `tx[${no}].${f}`, u, { text: f === 'asset' || f === 'serial' });
    }
  }
  return out;
}

// FM-501: VSWR ที่คอลัมน์ I แถว 10..30
function fm501(sheets) {
  const s = sheets.find(x => !x.hidden); if (!s) return [];
  const out = [];
  let k = 0;
  for (let r = 10; r <= 30; r++) {
    const v = num(s.cells['I' + r]); if (v == null) continue;
    k++;
    val(out, s.cells, s.name, 'A' + r, `ant[${k}].name`, null, { text: true });
    val(out, s.cells, s.name, 'G' + r, `ant[${k}].freq_mhz`, 'MHz');
    val(out, s.cells, s.name, 'I' + r, `ant[${k}].vswr`);
  }
  return out;
}

// FM-502: ตารางแบตเตอรี่ E28:I31 (+ M ถ้ามี) และเซลล์ข้อความ "235.4 V"
function fm502(sheets) {
  const s = sheets[0]; if (!s) return [];
  const out = [], c = s.cells;
  [[28, 'test_load_v', 'V'], [29, 'test_load_a', 'A'], [30, 'charge_v', 'V'], [31, 'charge_a', 'A']].forEach(([r, f, u]) =>
    'EFGHIJKLM'.split('').forEach((col, i) => { const v = num(c[col + r]); if (v != null) out.push({ field: `battery.${f}[${i}]`, value: v, unit: u, locator: `${s.name}!${col}${r}`, confidence: 'high' }); }));
  for (const [ref, f] of [['D13', 'ac_in'], ['I14', 'charger_out_v'], ['J14', 'charger_out_v2'], ['I16', 'charger_out_a'], ['O14', 'inverter_out_v'], ['O15', 'inverter_out_a']]) {
    const m = /^\s*(-?\d+(\.\d+)?)\s*([VA])\b/i.exec(String(c[ref] ?? '')); if (!m) continue;
    out.push({ field: f === 'ac_in' ? 'ac_in_v' : f, value: +m[1], unit: m[3].toUpperCase(), locator: `${s.name}!${ref}`, confidence: 'medium' });   // medium: ตำแหน่งแต่ละช่องอ่านจากตัวอย่าง 2-69
  }
  return out;
}

// FM-001: ทะเบียนอุปกรณ์ แถวข้อมูล 7..26 ต่อหน้า (ลำดับ A, ชื่อ B, ความถี่ C, สถานะ D, ยี่ห้อ E, รุ่น F, asset G, serial H)
function fm001(sheets) {
  const out = [];
  for (const s of sheets) {
    if (s.hidden || !/Page/i.test(s.name)) continue;
    for (let r = 7; r <= 26; r++) {
      const no = num(s.cells['A' + r]); if (no == null) continue;
      [['B', 'name'], ['C', 'freq'], ['D', 'status'], ['E', 'brand'], ['F', 'model'], ['G', 'asset'], ['H', 'serial']].forEach(([col, f]) => val(out, s.cells, s.name, col + r, `asset[${no}].${f}`, null, { text: true }));
    }
  }
  return out;
}

export const XLSX_MAPS = { 'FM-CE.SE-202': fm202, 'FM-CE.SE-501': fm501, 'FM-CE.SE-502': fm502, 'FM-CE.SE-001': fm001 };
