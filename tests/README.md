# ทดสอบ PMS

## ต้องผ่านก่อน merge
| คำสั่ง | ตรวจอะไร |
|---|---|
| `node tests/contract.test.mjs` | สัญญา store ↔ หน้าจอ: demo และ supabase (fetch ปลอม แถวรูปฐานจริงตาม `backend/supabase-schema.sql`) คืนโครงเดียวกันตาม `js/shapes.js` · หมวดเอกสารตรงกับตารางกลุ่มของหน้าเอกสาร · signed URL ใช้ bucket ตามชนิดข้อมูล · error มี path/status/detail ไม่มี token |
| `tests/run-e2e.sh` | เปิดแอปทั้งตัวใน Chrome headless (`tests/real-shapes.e2e.html`): demo และ supabase เดิน เอกสาร → ทุกหมวด → ไฟล์ในระบบ (`/storage/v1/object/sign/docs/…`) → ไฟล์ที่มีแค่บนเว็บกอง → รายงาน → งาน PM · แถวแตะได้ · ไม่มี error ที่ไม่ได้จับ · ชุดหนึ่งล้มแล้วหน้าอื่นยังใช้ได้ + ปุ่มลองใหม่ |
| `node tests/flow.test.mjs` | ตรรกะงาน PM + อ่าน FM-202 |

แก้ `supabase.js`/`demo.js`/`shapes.js` หรือหน้าที่อ่านข้อมูลจาก store → รันทั้งสามก่อนเปิด PR · เพิ่มคอลัมน์ในฐาน → เพิ่มใน `tests/fixtures/supabase-rows.mjs` ด้วย
อื่น ๆ: `tests/readers.test.html` (ตัวอ่านไฟล์ เปิดในเบราว์เซอร์) · `tests/supabase-contract.md` (เช็กมือกับโปรเจกต์จริงหลังล็อกอิน)
