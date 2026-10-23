#!/bin/sh
# Recompute everything: priors from the previous PitchAPI Premier League season (data/l_4WFCIZ_<season>*.json, written by the sync),
# the TRAIN grid (2022-23, 2023-24), then the table of all four seasons (validation 2024-25 and test 2025-26 were each looked at once).
set -e
cd "$(dirname "$0")"
node build_pa.js 2021-22 2022-23 pa_2022-23.json
node build_pa.js 2022-23 2023-24 pa_2023-24.json
node build_pa.js 2023-24 2024-25 pa_2024-25.json
node build_pa.js 2024-25 2025-26 pa_2025-26.json
node build_fp.js 2023-24 fp_2023-24.json          # the same prior from the FPL archive, for the 2023-24 comparison
node grid.js ./pa_ grid_pa.jsonl > grid_pa.log
node final.js                                      # writes final.json
