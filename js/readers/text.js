// .txt / .csv · csv: แถวแรก = ชื่อคอลัมน์ → field
const FIELD_ALIAS = [[/freq/i, 'freq_mhz'], [/power|กำลัง/i, 'power_w'], [/error/i, 'error_hz'], [/vswr/i, 'vswr'], [/asset/i, 'asset'], [/serial/i, 'serial']];

export function parseCsv(s) {   // รองรับ "…" ที่มี , และ "" ข้างใน
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

export function csvValues(rows, cap = 500) {
  const [head = [], ...body] = rows, out = [];
  const names = head.map(h => (FIELD_ALIAS.find(([re]) => re.test(h)) || [0, h.trim()])[1]);
  for (let r = 0; r < body.length && out.length < cap; r++) body[r].forEach((v, c) => {
    v = v.trim(); if (v === '' || !names[c] || out.length >= cap) return;
    const n = /^-?\d+(\.\d+)?$/.test(v) ? +v : v;
    out.push({ field: `row[${r + 1}].${names[c]}`, value: n, locator: `row ${r + 2}, col ${c + 1}`, confidence: 'medium' });
  });
  return out;
}
