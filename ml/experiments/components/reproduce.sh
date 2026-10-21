#!/bin/bash
# Recomputes every number reported by exp_components from scratch (about 3-4 minutes on 1 CPU).
set -e
cd "$(dirname "$0")"
mkdir -p cache
# 1) component diagnostics of production v1 on TRAIN (predicted parts vs realised components from history + scoring rules)
for s in 2022-23 2023-24; do node capture.js ../fp_model.js $s cache/base_$s.json; done
../venv/bin/python ana.py base            # mean predicted vs realised per component and position
../venv/bin/python ana2.py base 20        # calibration by decile of each predicted component
../venv/bin/python ana3.py base 20        # rate calibration conditional on minutes actually played
../venv/bin/python ana_mae.py             # MAE of an appearance-points-only predictor / per-component scaling (metric check)
node ana_lc.js base 2023-24; node ana_lc.js base 2022-23   # lc vs season-to-date league scoring vs realised
node conv.js                              # pooled TRAIN goals/xG and assists/xA by position (source of GF0 / AF0)
# 2) TRAIN ablation of every tested change
rm -f ablation.jsonl; node eval.js model.js 2022-23,2023-24 ablation.json ablation.jsonl
# 3) paired TRAIN comparison v1 vs final (round-cluster bootstrap)
node paired.js 2022-23,2023-24
# 4) final evaluation: TRAIN + VALIDATION (the single validation evaluation), writes results.json
node final.js
node add_findings.js
