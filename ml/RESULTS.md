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

## Data fix: 2022-23 expected goals (after the above)

FPL published xG and xA only from gameweek 16 of 2022-23; the archive CSV has 0 for every player before that. The archive
builder now stores those values as missing (archive format version 2), and the model treats missing xG as missing: a player's xG
over the matches that have it is scaled to all his minutes, and team strength uses goals for matches without xG. Only 2022-23
changes (2023-24 to 2025-26 have xG for every gameweek; their numbers above are unchanged and were re-checked: 1.5879 / 1.7159).
2022-23 with the corrected data, rounds 4+: v1 MAE 1.8038, RMSE 2.6590, bias +0.08; v2 MAE **1.6891**, RMSE **2.5977**, bias −0.09.
(With the zeros the early-season predictions were about 1 point per player too low, which MAE alone had hidden.) The playing-time
parameters were fitted before this fix; v2 is still better than v1 on every season.

## Simulation (lineup ranges)

Each team's goals in a match are now drawn once, G ~ Poisson(Λ), and shared out to its players (one scorer per goal, assists
likewise) and thinned to the opponent's goals conceded. Λ is fixed per team and match from all its players, so each player's
own distribution is unchanged (Poisson thinning) and the simulated mean still equals the expected points. Team-mates' returns now
correlate (about +0.04 between attackers) and an attacker correlates negatively with the opposing defence (about −0.15).
Tests: `simulation/correlation_test.js` (plus the existing mean = expectation test on every player-gameweek).

The widening factor κ of lineup ranges was refitted on the archive with the same protocol (`simulation/`, numbers in
`simulation/results.json`): 60 random legal XIs per gameweek plus the model's optimal XI, leak-free replay, 500 simulations each.

| | role | κ (z-sd, random XIs) | 80% range coverage, random XIs, κ = 1.19 | optimal XI coverage, κ = 1.19 |
|---|---|---|---|---|
| 2022-23 | train | 1.175 | 81.1% | 94.4% (36 XIs) |
| 2023-24 | train | 1.204 | 81.0% | 86.5% (37) |
| 2024-25 | validation | 1.147 | 82.8% | 81.1% (37) |
| 2025-26 | test, once | 1.177 | **82.5%** | 73.0% (37) |

κ fitted on TRAIN = 1.189, shipped as 1.19 (was 1.25, fitted on GW2–4 of the live season; 1.25 gives 84.8% on validation, too wide).
The optimal XI's coverage is noisy (one XI per gameweek) and its projection is optimistic in some seasons (selection effect).

## Season review (site tab)

Before gameweek 6 the model picks a £100m squad of 15 with gameweeks 1–5 only (exact squad optimizer, next 6 gameweeks' expected
points); every later gameweek it sees only earlier gameweeks and picks XI, captain and vice; FPL auto-subs and vice-captaincy are
applied to real minutes. Fixed squad vs 1 free transfer a week (banked to 2 in 2022-24, 5 from 2024-25; no hits, no chips; a
transfer is made if it gains ≥ 1 expected point over 6 gameweeks, any gain when the bank is full). "Best XI in hindsight" = best
starting XI by real points of any budget-legal squad that gameweek. GW6–38 totals (`data/fpl_review.json`, `season_review/`):

| | fixed: actual / expected | free transfers: actual / expected | transfers | best XI in hindsight |
|---|---|---|---|---|
| 2022-23 | 1716 / 1649.7 | 2049 / 2018.2 | 31 | 4945 |
| 2023-24 | 1628 / 1486.4 | 2006 / 1823.4 | 32 | 5297 |
| 2024-25 | 1831 / 1685.6 | 1971 / 1944.9 | 32 | 5019 |
| 2025-26 | 1874 / 1711.6 | 1895 / 1887.8 | 31 | 5136 |

Checks (`season_review/check.js`, all four seasons): legal squads and XIs, club limit when buying, bank never negative, selling
prices, auto-subs, captaincy and every gameweek's points recomputed from the raw rows; the hindsight XI is legal and never below the
model's XI; truncation leak test (data cut after gameweek k gives identical decisions up to k). The page recomputes a season in
the browser in about 3 s and gets the same file.
