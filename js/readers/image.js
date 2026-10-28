// รูป: OCR ในเครื่อง (Tesseract.js) เฉพาะเมื่อจำเป็น · ไม่พยายามอ่านลายมือ
import { detectForm } from './forms.js';

const base = new URL('../../vendor/tesseract/', import.meta.url).href;
let lib, workers = {};

const loadLib = () => lib || (lib = new Promise((res, rej) => {
  if (window.Tesseract) return res(window.Tesseract);
  const s = document.createElement('script'); s.src = base + 'tesseract.min.js';
  s.onload = () => res(window.Tesseract); s.onerror = () => rej(new Error('โหลด OCR ไม่ได้')); document.head.appendChild(s);
}));

const getWorker = async langs => workers[langs] || (workers[langs] = loadLib().then(T => T.createWorker(langs, 1, {
  workerPath: base + 'worker.min.js', corePath: base + 'tesseract-core-simd-lstm.wasm.js', langPath: base + 'lang',
})));

export async function terminateOcr() { for (const p of Object.values(workers)) (await p).terminate(); workers = {}; }

// ลดขนาด/หมุน/ปรับคอนทราสต์ก่อน OCR (ภาพถ่ายจอ LCD และสติกเกอร์ถ่ายเอียงอ่านยาก)
export async function prep(file, { max = 2200, rot = 0, enhance = false } = {}) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = rot % 180 ? h : w; c.height = rot % 180 ? w : h;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
  if (enhance) g.filter = 'grayscale(1) contrast(1.6)';
  g.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close();
  return new Promise(r => c.toBlob(r, 'image/png'));
}

export async function ocr(blob, langs) {
  const w = await getWorker(langs);
  const { data } = await w.recognize(blob);
  return { text: data.text || '', conf: data.confidence || 0 };
}

const MHZ = '(\\d{2,4}(?:[.,]\\d+)?)\\s*MHz';
const loc = (s, re) => { const m = re.exec(s); return m ? parseFloat(m[1].replace(',', '.')) : null; };

export function classify(text, conf) {
  const t = text.replace(/\r/g, '');
  const values = [], res = { values, text: t };
  // 1) หน้าจอ Spectrum Analyzer
  {
    const start = loc(t, new RegExp('Start\\s*:?\\s*' + MHZ, 'i')), stop = loc(t, new RegExp('Stop\\s*:?\\s*' + MHZ, 'i'));
    if (start != null && stop != null && stop > start) {
      const slot = start >= 108 && stop <= 137.5 ? 'VHF' : start >= 225 && stop <= 400.5 ? 'UHF' : null;
      values.push({ field: 'start_mhz', value: start, unit: 'MHz', locator: 'OCR:Start', confidence: 'medium' }, { field: 'stop_mhz', value: stop, unit: 'MHz', locator: 'OCR:Stop', confidence: 'medium' });
      for (const m of t.matchAll(/\bM\s*([1-9])\s*[:;\s]\s*(\d{2,4}(?:[.,]\d+)?)\s*MHz\s*(-?\d+(?:[.,]\d+)?)\s*dBm?/gi))
        values.push({ field: `marker[${m[1]}]`, value: parseFloat(m[2].replace(',', '.')), unit: 'MHz', locator: 'OCR:M' + m[1], confidence: 'medium' },
          { field: `marker[${m[1]}].level_dbm`, value: parseFloat(m[3].replace(',', '.')), unit: 'dBm', locator: 'OCR:M' + m[1], confidence: 'medium' });
      res.kind = 'spectrum';
      res.target = { form: 'FM-CE.SE-204', ...(slot && { slot }) };
      res.confidence = slot ? 'high' : 'medium';
      res.note = slot ? `📈 Spectrum · ${slot} · ${start}–${stop} MHz` : `📈 Spectrum · ${start}–${stop} MHz · ไม่เข้า VHF/UHF`;
      return res;
    }
  }
  // 2) สติกเกอร์ asset / สติกเกอร์ calibration
  const ids = [...new Set([...t.matchAll(/\b(\d-\d{3}-\d{5}(?:-\d{4})?)\b/g)].map(m => m[1]))];
  const kw = /AERO|CALIB|\bCAL\b|DUE|CERT|ASSET/i.test(t);
  const MON = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const dates = [...t.matchAll(new RegExp('\\b(\\d{1,2})\\s*\\.?\\s*(' + MON + ')[a-z]*\\.?\\s*(\\d{4})\\b', 'gi'))]
    .map(m => ({ s: `${+m[1]} ${m[2][0].toUpperCase()}${m[2].slice(1, 3).toLowerCase()} ${m[3]}`, k: +m[3] * 400 + MON.split('|').findIndex(x => x.toLowerCase() === m[2].slice(0, 3).toLowerCase()) * 31 + +m[1] }))
    .sort((x, y) => x.k - y.k);
  const asset = /ASSET\W{0,4}(\d{5,7})\b/i.exec(t);
  if (ids.length || (kw && (dates.length || asset))) {
    ids.forEach((id, i) => values.push({ field: `asset[${i + 1}].no`, value: id, locator: 'OCR:asset', confidence: 'medium' }));
    if (!ids.length && asset) values.push({ field: 'asset[1].no', value: asset[1], locator: 'OCR:Asset', confidence: 'low' });   // เลขสั้นบนสติกเกอร์ calibration · OCR พลาดตัวเลขได้ → low
    const due = dates.length ? dates[dates.length - 1].s : null;   // วันที่ล่าสุดบนสติกเกอร์ = Due (วันที่ก่อนหน้า = Cal)
    if (due) values.push({ field: 'calibration_due', value: due, locator: 'OCR:due', confidence: 'medium' });
    if (dates.length > 1) values.push({ field: 'calibration_date', value: dates[0].s, locator: 'OCR:cal', confidence: 'medium' });
    res.kind = 'sticker'; res.confidence = (ids.length || asset) && due ? 'medium' : 'low';
    res.target = { slot: 'asset' };
    res.note = `🏷 ${ids[0] || (asset && 'Asset ' + asset[1]) || 'สติกเกอร์'}${due ? ' · Due ' + due : ''}`;
    return res;
  }
  // 3) หน้าฟอร์มพิมพ์
  const f = detectForm(t);
  if (f) {
    res.kind = 'form'; res.target = { form: f.form }; res.confidence = 'medium';
    const filled = (t.match(/\d+(?:[.,]\d+)?/g) || []).length > 40 && conf >= 60;   // ตัวพิมพ์เยอะ+อ่านมั่นใจ = ฟอร์มที่พิมพ์ค่ามาแล้ว
    res.note = filled ? `📄 ${f.form}` : '✍ ลายมือ · ต้องเปิด AI อ่านลายมือ (ปิดอยู่)';
    if (!filled) res.confidence = 'low';
    return res;
  }
  // 4) ข้อความน้อยมาก = ภาพถ่ายทั่วไป/ลายมือ
  res.kind = 'unknown'; res.confidence = 'low'; res.target = null;
  res.note = t.replace(/\s/g, '').length < 30 ? '🖼 รูป · ไม่พบข้อความที่อ่านได้' : '✍ ลายมือ · ต้องเปิด AI อ่านลายมือ (ปิดอยู่)';
  return res;
}

const score = c => (c.kind === 'unknown' ? 0 : 1) + c.values.length + (c.confidence === 'low' ? 0 : 5);

export async function readImage(file, ctx = {}) {
  let best = classify(...Object.values(await ocr(await prep(file), 'eng')));
  if (best.kind === 'spectrum' && best.confidence === 'high') return best;
  // ไม่เจออะไร: ลองคอนทราสต์สูง (หน้าจอ LCD) แล้วลองหมุน 270/90 (สติกเกอร์/ภาพตะแคง)
  for (const o of [{ enhance: true }, { rot: 270 }, { rot: 90 }]) {
    if (best.kind !== 'unknown' && best.kind !== 'form' && best.confidence !== 'low') break;
    ctx.onProgress?.(o);
    const c = classify(...Object.values(await ocr(await prep(file, o), 'eng')));
    if (score(c) > score(best)) best = c;
  }
  if (best.kind === 'unknown' || (best.kind === 'form' && best.confidence === 'low')) {   // ยังไม่เจอ → ไทย+อังกฤษ
    ctx.onProgress?.('tha+eng');
    const c = classify(...Object.values(await ocr(await prep(file), 'tha+eng')));
    if (score(c) > score(best)) best = c;
  }
  return best;
}
