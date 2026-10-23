#!/bin/bash
S="$(cd "$(dirname "$0")" && pwd)"
cd $S
PIDS=""
# the sandbox cannot reach the photo CDN: hide the photo entry from the repo index while testing, restore it after
python3 -c "
import json;p='/home/user/pl-analytics/data/index.json';d=json.load(open(p))
for l in d['leagues']:l.pop('photo_file',None);l.pop('photo_v',None)
json.dump(d,open(p,'w'),ensure_ascii=False,separators=(',',':'))"
for pair in "/home/user/pl-analytics:8765" "$S/base3:8767" "$S/trkweb:8770" "$S/lgweb:8771" "$S/cmpweb:8772" "$S/labweb:8773" "$S/preweb:8775" "$S/homeweb:8777"; do
  d=${pair%:*}; p=${pair##*:}; (cd $d && exec python3 -m http.server $p >/dev/null 2>&1) & PIDS="$PIDS $!"
done
sleep 2
for t in $JS; do
  echo "== $t"; timeout 900 node $t > one.log 2>&1; grep -E "^FAIL|passed|PASSED|FAILED|Error" one.log | tail -5; echo "oks: $(grep -c '^ok' one.log)"
done
for t in $PY; do echo "== $t"; (cd $(dirname $t) && timeout 600 python3 $(basename $t) 2>&1 | grep -E "^FAIL|passed|Traceback" | tail -3); done
kill $PIDS 2>/dev/null; wait 2>/dev/null
git -C /home/user/pl-analytics checkout data/index.json; rm -rf /home/user/pl-analytics/__pycache__; git -C /home/user/pl-analytics status --short
echo "servers stopped"
