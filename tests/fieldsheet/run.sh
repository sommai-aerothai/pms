#!/bin/sh
# รัน: tests/fieldsheet/run.sh [pdf]   (ต้องมี Google Chrome; โหมด pdf ต้องมี pdftoppm)
cd "$(dirname "$0")/../.." || exit 1
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; UD=$(mktemp -d);   # โปรไฟล์ชั่วคราวต่อรอบ: ไม่ชนกับ Chrome ตัวอื่น (เคยทำให้ headless ค้าง/เงียบ)
 PORT=${PORT:-18731}; LOG=$(mktemp)
python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!; trap 'kill $SRV' EXIT; sleep 1
PAGE=${TEST:-fieldsheet}; URL="http://localhost:$PORT/tests/fieldsheet/$PAGE.test.html"
if [ "$1" = pdf ]; then
  mkdir -p tests/fieldsheet/.tmp
  for p in 1 2; do
    "$CH" --user-data-dir="$UD" --headless --virtual-time-budget=10000 --no-pdf-header-footer --print-to-pdf=tests/fieldsheet/.tmp/p$p.pdf "http://localhost:$PORT/fieldsheet.html?job=JOB-2569-02&n=21&page=$p" 2>/dev/null
    pdftoppm -r 170 -png -singlefile tests/fieldsheet/.tmp/p$p.pdf tests/fieldsheet/.tmp/p-$p
  done
  URL="$URL?pdf=1"; EXTRA="&${V:+v=1}"
fi

"$CH" --user-data-dir="$UD" --headless --disable-gpu --enable-logging=stderr --v=0 "$URL$EXTRA" 2>"$LOG" &
CP=$!; for i in $(seq 1 240); do grep -q FS-DONE "$LOG" && break; sleep 1; done; kill $CP 2>/dev/null
OUT=$(sed -n '/FS-DONE/,$p' "$LOG" | sed 's/", source:.*//;s/^\[.*INFO:CONSOLE[^"]*"//' | sed '/^$/d' | grep -v '^\[')
echo "$OUT" | head -${LINES_MAX:-40}
echo "$OUT" | grep -q FS-DONE || { echo "ทดสอบไม่จบ (ไม่พบ FS-DONE)"; exit 1; }
# exit code จริง: ชุด fieldsheet ต้องมี PASS · ชุด official รายงานตัวเลขอย่างเดียว (ต้องไม่มี ERROR)
if [ "$PAGE" = official ]; then echo "$OUT" | grep -q ERROR && exit 1; exit 0; fi
echo "$OUT" | grep -qx PASS
