#!/bin/sh
# Recompute everything from scratch: priors JSON per season (from COMPLETE earlier seasons only), then the replay metrics.
set -e
cd "$(dirname "$0")"
for s in 2022-23 2023-24 2024-25; do node build_priors.js $s priors_$s.json; done
node final.js          # writes results.json (TRAIN 2022-23, 2023-24; VALIDATION 2024-25; baseline with prior weights 0)
