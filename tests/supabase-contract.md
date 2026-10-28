# สัญญา supabase.js — เช็กมือหลังสร้างโปรเจกต์จริง

ตั้ง `js/config.js` (supabaseUrl, anonKey) แล้วรัน `schema` ใน SQL Editor · ใน ฉัน › เชื่อมต่อ กด "สลับเป็น Supabase"
ทุกคำขอมี `apikey` + `Authorization: Bearer <access_token | anon>` · error → `{code, retryAfter}`: 401/403=`auth` · 404=`notfound` · 429=`throttled` (ค่า Retry-After) · อื่นๆ=`server` · ไม่มีเน็ต/`navigator.onLine=false`=`offline`

| ฟังก์ชัน | Endpoint | สถานะที่ต้องได้ | ตรวจอะไร |
|---|---|---|---|
| signIn(email, password) | POST /auth/v1/token?grant_type=password `{email,password}` | 200 | `pms.session` มี access_token/refresh_token/expires_at/user · รหัสผิด = 400 `invalid_credentials` → `{code:'auth'}` → หน้า login ขึ้น "Wrong username or password" |
| changePassword(pw) | PUT /auth/v1/user `{password}` (token ผู้ใช้) | 200 | สั้นกว่า 8 ตัว = `{code:'invalid'}` ไม่ยิงเครือข่าย · 422 = `invalid` · สำเร็จ = toast "เปลี่ยนรหัสผ่านแล้ว" แล้วออก/เข้าใหม่ด้วยรหัสใหม่ได้ |
| refresh() | POST /auth/v1/token?grant_type=refresh_token | 200 | เรียกอัตโนมัติเมื่อเหลือ <30 วิ · refresh_token เสีย = ล้าง session แล้ว `auth` |
| signOut() | (ไม่เรียกเครือข่าย) | - | `pms.session` ถูกลบ |
| me() | GET /rest/v1/profiles?id=eq.<uid>&select=* | 200 | แถวเดียว · `approved=false` → หน้า "รออนุมัติ" + ปุ่ม "ตรวจสอบอีกครั้ง" · แอดมินกดอนุมัติแล้วกดปุ่มเข้าได้ |
| getCatalog() | GET /rest/v1/systems?order=seq&select=* | 200 | 10 ระบบ DM เรียงตาม seq · ยังไม่อนุมัติ = [] หรือ 401 |
| listDocs({kind,cursor}) | GET /rest/v1/documents?...&kind=eq.FM + `Range: 0-49`, `Prefer: count=exact` | 200 หรือ 206 | ≤50 แถว · `next` = null เมื่อครบ ตาม Content-Range · cursor=50 ได้หน้าถัดไป |
| listTemplates() | GET /rest/v1/documents?kind=in.(FM,WI,QP,QM)&is_current=eq.true | 200 | ไม่มี kind อื่นปน |
| listExamples({system_id}) | GET /rest/v1/examples?system_id=eq.<id> | 200 | กรองตามระบบ · ไม่ส่ง = ทั้งหมด |
| getFiles() | (ใช้ listDocs) | 200 | จัดกลุ่มตาม kind สำหรับหน้า "เอกสาร" |
| listJobs() | GET /rest/v1/jobs?order=updated_at.desc | 200 | ได้ `updated_at` ติดทุกงาน |
| getJob(id) | GET /rest/v1/jobs?id=eq.<id> | 200 | ไม่พบ id = `notfound` |
| putJob(job) | PATCH /rest/v1/jobs?id=eq.<id>&updated_at=eq.<known> (`Prefer: return=representation`) | 200 + 1 แถว | แก้ซ้ำด้วย updated_at เก่า = 200 + `[]` → `{code:'conflict'}` ห้ามเขียนทับ |
| getDocUrl(storage_path) | POST /storage/v1/object/sign/<bucket>/<path> `{expiresIn:600}` | 200 | URL เต็มเปิดไฟล์ได้ ~10 นาที แล้วหมดอายุ · storage_path รูป `<bucket>/<path>` เช่น `docs/FM/x.pdf` |
| getBlob(path) | GET <signed URL> | 200 | ได้ Blob ขนาดตรงไฟล์ |
| putAttachment(jobId,file,meta) | POST /storage/v1/object/jobs/<jobId>/<name> แล้ว POST /rest/v1/attachments | 200 + 201 | ไฟล์อยู่ใน bucket jobs · มีแถว attachments · ผู้ใช้ที่ยังไม่อนุมัติ = 403 `auth` |

หมายเหตุ: `putJob`/`putAttachment` ยังไม่ผูกกับหน้าจอ (store ยังเก็บงานในเครื่อง) — ผูกในขั้น sync
