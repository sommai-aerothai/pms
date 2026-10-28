# เซิร์ฟเวอร์ไฟล์สำหรับเทสต์เบราว์เซอร์: เลือกพอร์ตว่างเอง (พิมพ์พอร์ตออก stdout) · cwd = โฟลเดอร์ที่เสิร์ฟ
# backlog 128: http.server มาตรฐานรับคิวแค่ 5 → แอปโหลดโมดูล ~20 ไฟล์พร้อมกัน บางไฟล์ถูกปฏิเสธ (Chrome ได้ status 0) แอปไม่ขึ้นเป็นบางรอบ
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

class S(ThreadingHTTPServer):
    request_queue_size = 128

s = S(('127.0.0.1', 0), H)
print(s.server_address[1], flush=True)
s.serve_forever()
