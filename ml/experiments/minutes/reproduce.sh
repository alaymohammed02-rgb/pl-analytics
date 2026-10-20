#!/bin/sh
# exp_minutes: recomputes every reported number from scratch (~1-2 min, single process). Run from anywhere.
set -e
cd "$(dirname "$0")"
PY=../venv/bin/python
# 1) TRAIN-only estimator analysis on a leak-free per-fixture cache (rows of round < r only)
$PY feats.py 2022-23 2023-24          # -> feats_2022-23_2023-24.pkl
$PY ana_pplay.py                      # P(play): v1, last-6 share, recency+Beta grid, 'st'-weighted, previous-season prior
$PY ana_q60.py                        # q60 / ePlay recency and Beta prior; logistic upper bound for P(play)
$PY ana_lr2.py                        # compact logistic P(play) feature ablation (st, 60+ rate, position, last match)
# 2) TRAIN replays of the candidate configurations (selection by TRAIN points MAE)
: > train_cfgs.jsonl
for c in '{"PT":0}' '{"Q_A":0}' '{}' '{"PL_B":[0.325,0.786,0.285]}'; do
  node eval.js model_variants.js "$c" 2022-23 2023-24 | sed 's/^{/{"model":"model_variants.js",/' >> train_cfgs.jsonl
done
node eval.js model.js '{}' 2022-23 2023-24 | sed 's/^{/{"model":"model.js (final)",/' >> train_cfgs.jsonl
node scale_check.js                   # TRAIN: how much of the gain is plain downward scaling
node injury.js 2022-23 2023-24        # TRAIN: P(play) calibration with likely-injury absences removed (live-site proxy)
# 3) final numbers: production v1 vs final v2 on TRAIN and VALIDATION -> results.json
node make_results.js
