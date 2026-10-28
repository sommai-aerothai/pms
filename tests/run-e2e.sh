#!/bin/sh
# รัน tests/real-shapes.e2e.html ใน Chrome headless (ไม่มี dependency) · ผ่าน = exit 0
cd "$(dirname "$0")/.." || exit 1
PORT=${PORT:-8799}
python3 -m http.server "$PORT" >/dev/null 2>&1 & SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 1
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
OUT=$("$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$(mktemp -d)" --virtual-time-budget=120000 --dump-dom "http://localhost:$PORT/tests/real-shapes.e2e.html" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g')
echo "$OUT"
echo "$OUT" | grep -q 'DONE .* fail=0' || { echo 'e2e ไม่ผ่าน'; exit 1; }
