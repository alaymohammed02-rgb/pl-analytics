#!/bin/sh
# Recompute everything from data/ (the sync's PitchAPI Premier League seasons and the FPL archive):
# in-season PitchAPI rows per FPL player, the TRAIN calibration, the TRAIN grids (2022-23, 2023-24), the leak tests, the single
# validation/test table (final.json) and the post-decision control.
set -e
cd "$(dirname "$0")"
for s in 2022-23 2023-24 2024-25 2025-26; do node build_ins.js $s ins_$s.json; done
node calibrate.js > cal.json
python3 explore_train.py > explore_train.log
node grid.js G grid_G.jsonl > grid_G.log
node grid.js A grid_A.jsonl > grid_A.log
node grid.js C grid_C.jsonl '{"GA":0,"GB":1,"GS":0}' '{"AA":0.75,"AB":1,"AK":0.5}' > grid_C.log
EXPR='PM.GA=0.25;PM.GB=1;PM.GS=0;PM.AA=0.5;PM.AB=1;PM.AK=0.5' node leak_test.js 2023-24 4 5 10 20 30 38
node final.js
node control.js
# experiment 2 (needs the complete line-up and heat-map files of the TRAIN seasons)
for s in 2022-23 2023-24 2024-25 2025-26; do node build_lu.js $s lu_$s.json; done
node fit_sb.js > sb.json
node grid2.js S grid2_S.jsonl > grid2_S.log
node grid2.js R grid2_R.jsonl > grid2_R.log
EXPR='PM.RG=0.05;PM.RA=0.05;PM.RH=0.5' node leak_test.js 2023-24 4 5 10 20 30 38
node final2.js
