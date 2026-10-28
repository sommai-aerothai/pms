#!/bin/sh
# รัน tests/real-shapes.e2e.html ใน Chrome headless (ไม่มี dependency) · ผ่าน = exit 0
cd "$(dirname "$0")/.." || exit 1
PORTF=$(mktemp)   # พอร์ตว่างจากระบบ (ไม่ชนรันอื่นที่ขนานกัน) · serve.py พิมพ์พอร์ตเมื่อพร้อมรับแล้ว (ไม่ต้อง sleep เดา)
python3 tests/serve.py >"$PORTF" & SRV=$!
trap "kill $SRV 2>/dev/null; rm -f $PORTF" EXIT
for _ in $(seq 1 50); do PORT=$(cat "$PORTF"); [ -n "$PORT" ] && break; sleep 0.1; done
[ -n "$PORT" ] || { echo 'เซิร์ฟเวอร์ไม่ขึ้น'; exit 1; }
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
OUT=$("$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$(mktemp -d)" --virtual-time-budget=120000 --dump-dom "http://localhost:$PORT/tests/real-shapes.e2e.html" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g')
echo "$OUT"
echo "$OUT" | grep -q 'DONE .* fail=0' || { echo 'e2e ไม่ผ่าน'; exit 1; }
