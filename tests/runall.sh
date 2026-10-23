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
for t in ui/ui_ux.js lab/ui_lab.js lab/ui_lab2.js theme/ui_theme.js logo/ui_logo.js eng/ui_eng.js ui_test.js ui_ar.js ui_season.js ui_review.js trk/ui_track.js cmp/ui_cmp.js home/ui_home.js fpx/ui_fpx.js feat/ui_feat.js px/ui_px.js px/ui_px2.js px/ui_ins.js rp/ui_rp.js rp/ui_ms.js ov/ui_ov.js ph/ui_ph.js fun/ui_sm.js fun/ui_lk.js fun/ui_tw.js fun/ui_pc.js fun/ui_bm.js rare/ui_rr.js fun/ui_as.js fun/ui_tap.js ph/ui_dlh.js nf/ui_gs.js nf/ui_xi.js nf/ui_ct.js nf/ui_cy.js nf/ui_rc.js nf/ui_ld.js nf/ui_th.js; do
  echo "== $t"; timeout 900 node $t > one.log 2>&1; grep -E "^FAIL|passed|PASSED|FAILED|Error" one.log | tail -5; echo "oks: $(grep -c '^ok' one.log)"
done
for t in cmp/t_cmp.py logo/t_logo.py theme/t_champ.py t_resolve.py home/t_photos.py dq/t_dq.py mx/t_mx.py lv/t_lv.py fx/t_fx.py rare/t_rr.py; do echo "== $t"; (cd $(dirname $t) && timeout 600 python3 $(basename $t) 2>&1 | grep -E "^FAIL|passed|Traceback" | tail -3); done
kill $PIDS 2>/dev/null; wait 2>/dev/null
git -C /home/user/pl-analytics checkout data/index.json; rm -rf /home/user/pl-analytics/__pycache__; git -C /home/user/pl-analytics status --short
echo "servers stopped"
