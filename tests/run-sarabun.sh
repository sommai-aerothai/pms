#!/bin/sh
# รัน tests/sarabun-parse.test.html ใน Chrome headless · ผ่าน = exit 0
cd "$(dirname "$0")/.." || exit 1
PORT=${PORT:-8798}
python3 -m http.server "$PORT" >/dev/null 2>&1 & SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 1
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
OUT=$("$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$(mktemp -d)" --virtual-time-budget=30000 --dump-dom "http://localhost:$PORT/tests/sarabun-parse.test.html" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g')
echo "$OUT" | grep -v '^PASS'
echo "$OUT" | grep -q 'FAIL' && exit 1
echo "$OUT" | grep -Eq '^[0-9]+/[0-9]+ ผ่าน' || { echo 'ไม่จบการทดสอบ'; exit 1; }
