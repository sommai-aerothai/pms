# คำสั่งลัด "ส่งเข้า PMS" (Apple Shortcuts)

ตัวอ่านหน้าสารบรรณเป็นไฟล์เดียวกับบุ๊กมาร์กเล็ต: `bookmarklet/sarabun-to-pms.js` (มี `completion()` = โหมดคำสั่งลัด)
คำสั่งลัดทำ 2 action: **Run JavaScript on Web Page** (ฝังสคริปต์) → **Open URLs** (เปิดลิงก์ `…/#/import?d=…`)
ลิงก์เกิน ~8 KB: ตัดข้อความบันทึกงาน เก็บช่องหลัก และหน้านำเข้าแจ้งผู้ใช้ · ไม่อ่านรหัสผ่าน/คุกกี้ · ข้อมูลไปที่ URL ของ PMS ในเครื่องผู้ใช้เท่านั้น

## สร้างไฟล์ใหม่
```
python3 shortcuts/build.py                                        # preview (ค่าเริ่มต้น)
python3 shortcuts/build.py https://sommai-aerothai.github.io/pms/ # main — เปลี่ยนแค่ที่อยู่แอป (ค่า APP บนสุดของสคริปต์)
shortcuts sign --mode anyone --input shortcuts/ส่งเข้า-PMS.unsigned.shortcut --output shortcuts/ส่งเข้า-PMS.shortcut
```
(ลงนามต้อง iCloud บน Mac · ไฟล์ .unsigned ไม่ต้อง commit) · **ก่อน release preview → main ให้สร้างใหม่ด้วยที่อยู่ main**

## ทำเองในแอปคำสั่งลัด (ถ้าไฟล์ใช้ไม่ได้)
1. คำสั่งลัด › + › ตั้งชื่อ "ส่งเข้า PMS"
2. แตะ (i) › เปิด "แสดงในแผ่นแชร์" › ชนิดที่รับ เลือกเฉพาะ "หน้าเว็บ Safari"
3. เพิ่ม action "Run JavaScript on Web Page"
4. วางสคริปต์จาก `bookmarklet/sarabun-to-pms.js` (ลบบรรทัดที่ขึ้นต้น `//` ก็ได้) · แก้ `var APP = '…'` เป็นที่อยู่ PMS ที่ใช้
5. เพิ่ม action "Open URLs" (เปิด URL)
6. ช่อง URL ใส่ตัวแปร "JavaScript Result" จาก action ก่อนหน้า
7. เปิด Safari ที่หน้า "พิมพ์บันทึกงาน" › แชร์ › "ส่งเข้า PMS" › อนุญาตรันสคริปต์ครั้งแรก
8. แอป PMS เปิดพร้อมข้อมูล ตรวจแล้วกด "บันทึกเข้างาน"
