// อ่านค่า design token จาก CSS (ui/tokens.css) — JS ไม่มีตัวเลขดีไซน์ของตัวเอง
const cs = getComputedStyle(document.documentElement);
export const tok = n => parseFloat(cs.getPropertyValue('--' + n));
export const tokRaw = n => cs.getPropertyValue('--' + n).trim();
