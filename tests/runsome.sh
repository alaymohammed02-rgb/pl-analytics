#!/bin/bash
S="$(cd "$(dirname "$0")" && pwd)"
cd $S
R="${PLREPO:-$(cd "$S/.." && pwd)}"; export PLREPO="$R"
# Playwright from the repository's node_modules unless NODE_PATH is set; CHROME may point at a Chromium binary
if [ -z "$NODE_PATH" ] && [ -d "$R/node_modules" ]; then export NODE_PATH="$R/node_modules"; fi
PIDS=""
# the sandbox cannot reach the photo CDN: hide the photo entry from the repo index while testing, restore it after
python3 -c "
import json;p='$R/data/index.json';d=json.load(open(p))
for l in d['leagues']:l.pop('photo_file',None);l.pop('photo_v',None)
json.dump(d,open(p,'w'),ensure_ascii=False,separators=(',',':'))"
for pair in "$R:8765" "$S/base3:8767" "$S/trkweb:8770" "$S/lgweb:8771" "$S/cmpweb:8772" "$S/labweb:8773" "$S/preweb:8775" "$S/homeweb:8777"; do
  d=${pair%:*}; p=${pair##*:}; (cd $d && exec python3 -m http.server $p >/dev/null 2>&1) & PIDS="$PIDS $!"
done
sleep 2
for t in $JS; do
  echo "== $t"; timeout 900 node $t > one.log 2>&1; grep -E "^FAIL|passed|PASSED|FAILED|Error" one.log | tail -5; echo "oks: $(grep -c '^ok' one.log)"
done
for t in $PY; do echo "== $t"; (cd $(dirname $t) && timeout 600 python3 $(basename $t) 2>&1 | grep -E "^FAIL|passed|Traceback" | tail -3); done
kill $PIDS 2>/dev/null; wait 2>/dev/null
git -C $R checkout data/index.json; rm -rf $R/__pycache__; git -C $R status --short
echo "servers stopped"
