#!/bin/bash
# Recomputes every reported number of exp_gbm from scratch. Run from anywhere; ~1-2 min on 2 cores.
set -euo pipefail
cd "$(dirname "$0")"
PY=../venv/bin/python
mkdir -p feats
# 1) leak-free features from the v1 replay (TRAIN seasons only for fitting)
for s in 2022-23 2023-24; do node extract.js ../fp_model.js $s feats/$s.json; done
# 2) TRAIN-only model selection (two cross-season folds inside TRAIN)
$PY -W ignore cv.py   > logs_cv.txt
$PY -W ignore tune.py > logs_tune.txt
$PY -W ignore side.py > logs_side.txt
# 3) fit pre-registered configs on all of TRAIN, export trees to JSON, build model.js, check JS == Python, live smoke test
$PY -W ignore final.py
node build_model.js gbm.json model.js
node check_js.js model.js py_pred_train.json
node smoke_live.js
node eval.js model.js 2022-23 2023-24 > eval_train.json
# 4) the single VALIDATION evaluation (2024-25)
node extract.js ../fp_model.js 2024-25 feats/2024-25.json
node eval.js model.js 2024-25 > eval_val.json
$PY -W ignore validate.py eval_train.json eval_val.json
