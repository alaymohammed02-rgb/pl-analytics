# Fantasy model training on archived seasons

Data: the public vaastav/Fantasy-Premier-League archive, seasons 2022-23 to 2025-26 (official FPL data per player and
gameweek). For every season, that season's scoring rules reproduce FPL's own points for 100% of player-gameweeks
(2022-23 to 2024-25) and 99.92% (2025-26).

Protocol: train on 2022-23 + 2023-24, validate on 2024-25, final test on 2025-26. The test season was kept outside the
experiment workspace and was evaluated once, after the model had been chosen. Within a season, every prediction for round r
uses only rows of earlier rounds (the site's leak-free replay, `btRun`). Metric: error of predicted vs actual FPL points per
player-gameweek over rounds 4 and later.

## Experiments (each reproduced independently and passed a truncation leak test)

| Experiment | What it changes | Validation 2024-25 MAE (v1: 1.6936) | Verdict |
|---|---|---|---|
| minutes | playing-time model: recency-weighted P(play) with a Beta prior, recency-weighted 60+ share and minutes | **1.5879** | confirmed |
| gbm | LightGBM residual on top of v1 (150 trees, 59 features) | 1.6392 | confirmed |
| components | goals-against multiplier 1.05, per-position goal conversion | 1.6795 | confirmed |
| tune | no finishing ratio, position-average card rates | 1.6875 | confirmed |
| priors | previous-season priors per player | 1.6897 | confirmed |

Folders: `experiments/<name>/` (model.js, results.json, report.json, reproduce.sh) and `verification/<name>.json`.

## Combination (decided on TRAIN only)

Rule fixed before looking at validation: a change is added only if it improves both MAE and RMSE on the training seasons
(RMSE is the right metric for expected points; MAE alone rewards predictions that are too low).

| TRAIN 2022-23 / 2023-24 | MAE | RMSE |
|---|---|---|
| v1 | 1.6951 / 1.7659 | 2.7055 / 2.6809 |
| minutes (M) | 1.6178 / 1.6442 | **2.6846 / 2.6202** |
| M + tune | 1.6149 / 1.6398 | 2.7047 / 2.6251 (worse) |
| M + components | 1.6115 / 1.6311 | 2.6860 / 2.6209 (no gain) |
| M + LightGBM (out of fold) | 1.6516 / 1.7132 (worse) | 2.6218 / 2.6162 |

Chosen: **M** (`model_final.js`). Everything else was left out.

## Final test, 2025-26 (held out, evaluated once)

| | v1 | **new model** |
|---|---|---|
| MAE | 1.8449 | **1.7159** (−7.0%) |
| RMSE | 2.7068 | **2.6374** |
| Brier score of P(play) | 0.1735 | **0.1447** |
| expected-minutes MAE | 24.03 | **22.99** |
| gameweeks where it is better | | **35 of 35** (mean gain 0.129 ± 0.012) |
| MAE by position GKP/DEF/MID/FWD | 2.007/1.984/1.708/1.882 | **1.827/1.860/1.580/1.755** |
| bias (pred − actual) | +0.006 | −0.172 |

Baselines on the same rows: last-5 average 1.9397, season average 1.9033. The archive's FPL `xP` column is not usable as a
reference: on 2025-26 its bias is −1.68 points.

Caveats: the archive has no injury history, so the new P(play) learns absences of every kind; on the live site FPL's injury
status is also applied, so for players marked available the new model may be slightly pessimistic (bias −0.17 points per
player-gameweek in the test). `final_test.json` holds the full numbers; `final_test.js` recomputes them.
