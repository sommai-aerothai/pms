// ตัวอ่านเดียวของ 2 ทาง: บุ๊กมาร์กเล็ต "ส่งเข้า PMS" และคำสั่งลัด Apple Shortcuts (shortcuts/build.py ฝังไฟล์นี้ใน "Run JavaScript on Web Page" · มี completion() = โหมดคำสั่งลัด)
// บุ๊กมาร์กเล็ต "ส่งเข้า PMS" — รันบนหน้า "พิมพ์บันทึกงาน" ของสารบรรณ (printactionmsg.aspx)
// อ่านหน้า → JSON → เปิดแอป PMS แล้วส่งด้วย postMessage (สำรอง: URL fragment) · ไม่แตะรหัสผ่าน/คุกกี้ · ไม่ส่งผ่านเซิร์ฟเวอร์ใคร
// กฎการเขียน (หน้าติดตั้งย่อไฟล์นี้เป็นบรรทัดเดียวด้วยการตัดบรรทัดคอมเมนต์เต็มบรรทัด + ต่อบรรทัดด้วยช่องว่าง):
//   - คอมเมนต์ต้องขึ้นต้นบรรทัดด้วย // เท่านั้น (ห้ามคอมเมนต์ท้ายบรรทัดโค้ด) · ทุกคำสั่งลงท้าย ; · ห้ามใช้ # และ % ในโค้ด
(function () {
  // ที่อยู่แอป PMS (หน้าติดตั้งแทนค่านี้ให้ตรงกับที่ผู้ใช้เปิดอยู่ เช่น /pms/ หรือ /pms/preview/)
  var APP = 'https://sommai-aerothai.github.io/pms/';
  var WAIT_MS = 10000, SHORTCUT_MAX = 8000, MAX_PDF = 3, MAX_PDF_BYTES = 10485760;
  var LABELS = { 'วันที่พิมพ์': 'printedAt', 'เลขทะเบียน': 'regNo', 'ประเภทเอกสาร': 'docType', 'เลขที่เอกสารที่': 'docNo', 'สถานะ': 'status', 'ลงวันที่': 'docDate', 'อ้างถึง': 'ref', 'จาก': 'from', 'ถึง': 'to', 'เรื่อง': 'subject' };
  var TH = '๐๑๒๓๔๕๖๗๘๙';
  var HEAD = /^วันที่\s+([0-9๐-๙]{1,2}\/[0-9๐-๙]{1,2}\/[0-9๐-๙]{4})\s+([0-9๐-๙]{1,2}:[0-9๐-๙]{2}:[0-9๐-๙]{2})\s+(.*)$/;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function digits(s) { return String(s).replace(/[๐-๙]/g, function (c) { return TH.indexOf(c); }); }
  function p2(n) { return ('0' + n).slice(-2); }
  // dd/mm/yyyy (พ.ศ. หรือ ค.ศ.) [+ hh:mm:ss] → ISO เวลาไทย · อ่านไม่ได้ = ''
  function iso(d, t) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(digits(d).trim()), x = t && /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(digits(t));
    if (!m) return '';
    var y = +m[3];
    if (y > 2400) y -= 543;
    return y + '-' + p2(m[2]) + '-' + p2(m[1]) + (x ? 'T' + p2(x[1]) + ':' + x[2] + ':' + x[3] + '+07:00' : '');
  }
  // ป้าย: <span>ป้าย</span>: <strong>ค่า</strong> (อ้างด้วยข้อความป้าย ไม่ใช้ id/class) · ไม่เจอ → หาจากข้อความ "ป้าย: ค่า" ต้นบรรทัด/หลังแท็บ
  function pairs(doc, text) {
    var o = {}, sp = doc.querySelectorAll('span'), i, s, k, re;
    for (i = 0; i < sp.length; i++) {
      s = sp[i].nextElementSibling;
      k = sp[i].textContent.trim();
      if (has(LABELS, k) && !has(o, LABELS[k]) && s && s.tagName === 'STRONG') o[LABELS[k]] = s.textContent.replace(/\s+/g, ' ').trim();
    }
    for (k in LABELS) {
      if (has(LABELS, k) && !has(o, LABELS[k])) {
        re = new RegExp('(?:^|\\t)' + k + '\\s*:[ \\t]*([^\\t\\n]*)', 'm');
        o[LABELS[k]] = (re.exec(text) || [0, ''])[1].trim();
      }
    }
    return o;
  }
  // ตัดข้อความเป็นรายการบันทึก: หัว "วันที่ dd/mm/yyyy hh:mm:ss <หน่วย>: <ชื่อ>" แล้วตามด้วย นำเสนอ/ผู้ปฏิบัติ · บันทึกงาน (หลายบรรทัด) · หมายเหตุ · (ลายเซ็น)
  function entries(text) {
    var L = text.replace(/\r/g, '').split('\n'), out = [], e = null, mode = '', i, l, m, c;
    for (i = 0; i < L.length; i++) {
      l = L[i].replace(/ /g, ' ').trim();
      m = HEAD.exec(l);
      if (m) {
        c = m[3].indexOf(':');
        e = { at: m[1] + ' ' + m[2], atISO: iso(m[1], m[2]), unit: (c < 0 ? m[3] : m[3].slice(0, c)).trim(), name: c < 0 ? '' : m[3].slice(c + 1).trim(), presenter: '', note: '', remark: '' };
        out.push(e);
        mode = '';
      } else if (!e) {
        continue;
      } else if ((m = /^นำเสนอ\/ผู้ปฏิบัติ\s*:\s*(.*)$/.exec(l))) {
        e.presenter = m[1];
        mode = '';
      } else if ((m = /^บันทึกงาน\s*:\s*(.*)$/.exec(l))) {
        e.note = m[1];
        mode = 'note';
      } else if ((m = /^หมายเหตุ\s*:\s*(.*)$/.exec(l))) {
        e.remark = m[1];
        mode = 'remark';
      } else if (mode === 'note') {
        e.note += '\n' + l;
      } else if (mode === 'remark') {
        // หมายเหตุต่อได้จนเจอบรรทัดว่าง/ลายเซ็น "(ชื่อ)"
        if (l && !/^\(.*\)$/.test(l)) e.remark += '\n' + l; else mode = '';
      }
    }
    out.forEach(function (x) { x.note = x.note.trim(); x.remark = x.remark.trim(); });
    return out;
  }
  // URL ที่เก็บ: คงค่าเฉพาะ curregno/wid (ตัวระบุหนังสือ) · พารามิเตอร์อื่นเหลือแค่ชื่อ ค่าว่าง
  function cleanUrl(href) {
    var u = new URL(href), q = [];
    u.searchParams.forEach(function (v, k) { q.push(encodeURIComponent(k) + '=' + (k === 'curregno' || k === 'wid' ? encodeURIComponent(v) : '')); });
    return u.origin + u.pathname + (q.length ? '?' + q.join('&') : '');
  }
  function parse(doc, href) {
    var text = doc.body ? doc.body.innerText || '' : '', p = pairs(doc, text), links = [], a = doc.querySelectorAll('a[href]'), i;
    if (!/รายงานการบันทึกงาน/.test(text) && !p.regNo) return null;
    for (i = 0; i < a.length && links.length < 10; i++) {
      if (/^https?:$/.test(a[i].protocol) && /\.pdf$/i.test(a[i].pathname) && links.indexOf(a[i].href) < 0) links.push(a[i].href);
    }
    return {
      schema: 1, source: 'sarabun', url: cleanUrl(href),
      printedAt: p.printedAt, printedAtISO: iso(p.printedAt),
      regNo: p.regNo, docType: p.docType, docNo: p.docNo, status: p.status,
      docDate: p.docDate, docDateISO: iso(p.docDate), ref: p.ref, from: p.from, to: p.to, subject: p.subject,
      entries: entries(text), pdfLinks: links
    };
  }

  function b64url(s) {
    var b = new TextEncoder().encode(s), r = '', i;
    for (i = 0; i < b.length; i++) r += String.fromCharCode(b[i]);
    return btoa(r).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // ลิงก์ APP#/import?d=… · เกิน max ตัวอักษร: ลดทีละขั้น (ตัดข้อความบันทึกงาน/หมายเหตุ → เหลือ 10/5/2/0 รายการ → ตัดช่องยาวให้สั้นลง) แล้วใส่ trimmed:true ให้หน้านำเข้าแจ้งผู้ใช้
  // approved คำนวณจากข้อความเต็มก่อนตัดเสมอ (แอปใช้ตัดสินว่า FM-040 อนุมัติแล้ว) · ลดจนสุดแล้วยังไม่พอ = ลิงก์สั้น #/import?e=too-big
  function link(d, max) {
    var t = JSON.parse(JSON.stringify(d)), e = b64url(JSON.stringify(t)), steps, k;
    function fits() { e = b64url(JSON.stringify(t)); return e.length <= max; }
    function cap(o, keys, n) { keys.forEach(function (x) { if (typeof o[x] === 'string') o[x] = o[x].slice(0, n); }); }
    t.approved = d.entries.some(function (x) { return /อนุมัติ/.test(x.note); });
    if (!fits()) {
      t.trimmed = true;
      t.entries.forEach(function (x) { x.note = ''; x.remark = ''; });
      steps = [10, 5, 2, 0];
      for (k = 0; k < steps.length && !fits(); k++) t.entries = t.entries.slice(0, steps[k]);
      if (!fits()) {
        cap(t, ['url', 'ref', 'from', 'to', 'subject', 'docType', 'docNo', 'status'], 200);
        t.entries.forEach(function (x) { cap(x, ['unit', 'name', 'presenter'], 60); });
      }
      if (!fits()) return APP + '\x23/import?e=too-big';
    }
    return APP + '\x23/import?d=' + e;
  }
  // PDF: ดึงเฉพาะลิงก์ออริจินเดียวกับหน้านี้ (ใช้คุกกี้ล็อกอินของผู้ใช้เอง) · พลาดข้อไหนข้ามเงียบ ๆ
  function pdfs(links) {
    return Promise.all(links.filter(function (u) { try { return new URL(u).origin === location.origin; } catch (e) { return false; } }).slice(0, MAX_PDF).map(function (u) {
      return fetch(u, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (b) { return b && b.size <= MAX_PDF_BYTES ? { name: decodeURIComponent(new URL(u).pathname.split('/').pop()), blob: b } : null; })
        .catch(function () { return null; });
    })).then(function (a) { return a.filter(Boolean); });
  }
  // ส่ง: เปิดแอป → รอ {type:'pms-ready'} → postMessage (ระบุ origin ปลายทาง) · ป๊อปอัปถูกบล็อก/รอเกิน 10 วิ → เปิดแอปในแท็บนี้ด้วย #/import?d=… (fragment ไม่ใช่ query)
  function send(d) {
    var origin = new URL(APP).origin, w = window.open(APP + '\x23/import'), done = false, t, sent;
    function fallback() {
      if (done) return;
      done = true;
      try { if (w) w.close(); } catch (e) { }
      location.href = link(d, Infinity);
    }
    // ตอบทุกครั้งที่แอปประกาศ pms-ready (แอปรีโหลดเองครั้งแรกตอน service worker เข้าควบคุม → ประกาศซ้ำ) · PDF ดึงครั้งเดียว
    function onMsg(e) {
      if (e.source !== w || !e.data || e.data.type !== 'pms-ready') return;
      done = true;
      clearTimeout(t);
      sent = sent || pdfs(d.pdfLinks);
      sent.then(function (b) { w.postMessage({ type: 'pms-import', data: d, pdfs: b }, origin); });
    }
    if (!w) return fallback();
    addEventListener('message', onMsg);
    t = setTimeout(fallback, WAIT_MS);
  }
  function run() {
    var d = parse(document, location.href);
    // โหมดคำสั่งลัด: ส่งลิงก์กลับให้ action "Open URLs" · ไม่ใช่หน้าสารบรรณ = ลิงก์ที่แอปแจ้งว่าข้อมูลไม่ถูกต้อง
    if (typeof completion === 'function') { completion(d ? link(d, SHORTCUT_MAX) : APP + '\x23/import?e=1'); return; }
    if (!d) { alert('หน้านี้ไม่ใช่หน้าพิมพ์บันทึกงานของสารบรรณ · เปิดหนังสือ → พิมพ์บันทึกงาน แล้วกดอีกครั้ง'); return; }
    send(d);
  }
  // โหมดทดสอบ: tests/sarabun-parse.test.html ตั้ง window.__pmsTest ก่อนโหลดไฟล์นี้ → ได้ parse/link โดยไม่เปิดแอป
  if (window.__pmsTest) { window.__pmsTest.parse = parse; window.__pmsTest.link = link; return; }
  run();
})();
