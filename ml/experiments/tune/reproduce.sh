#!/bin/sh
# [exp_tune] recompute everything from scratch (node >= 18). Uses ../harness.js and ../seasons/ read-only.
set -e
cd "$(dirname "$0")"
node check.js                 # tunable copy reproduces production v1 on TRAIN (1.6951 / 1.7659)
node search.js > search.out   # coordinate descent on TRAIN mean MAE (~10 min on 2 cores); FINAL line = train-optimal config
node conservative.js          # TRAIN-only comparison of candidate configs (per-season agreement)
node paired.js                # TRAIN-only paired per-gameweek gains
node final.js 2               # VALIDATION: look 1 = original evaluation, look 2 = identical frozen config re-run as a reproducibility check (no choice depended on it) -> results.json
