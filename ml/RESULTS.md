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

## Previous-season priors from PitchAPI (23 October 2026): not adopted

Question: do PitchAPI's numbers for the previous Premier League season add information to the production model v3, above all early in the
season? The sync now fetches the Premier League seasons 2021-22 to 2024-25 from PitchAPI as "light" seasons: matches, player rows and
shots only, 1520 matches, all `ok`, 5 requests a match. Folder: `experiments/pitchapi_priors/` (`reproduce.sh` recomputes everything from
`data/`).

What was tried: the earlier `priors` mechanism, ported onto v3 (`model_pa.js`, edits marked `[s3]`; all new parameters 0 = v3 exactly).
- The previous season's PitchAPI xG and xAG per player enter as extra evidence for the xG/xA rates (`PW`). They are scaled to FPL's xG/xA
  with factors fitted on TRAIN 2023-24 only, from the same season in both sources: FPL xG = 0.99 × PitchAPI xG, FPL xA = 0.95 × PitchAPI xAG.
  Goals agree (1008 vs 1009).
- Playing-time pattern as pseudo-matches that fade during the season (`PK`, `PKD`).
- Team attack/defence ratios from the shots (`TR`), with promoted sides at the relegated sides' average (`TRP`).

Players are linked to FPL by the site's own name rule (`fpNz`: full name or web name, else surname and initial, one match only). Of the
FPL players with minutes in the previous season, 91% get a PitchAPI prior (2023-24: 382 of 420; 2024-25: 380 of 423). All 20 clubs link
within a season (after mapping "Sheffield Utd").

Protocol (`ml/README.md`): TRAIN 2022-23 + 2023-24. 2022-23 now has a previous season too (PitchAPI 2021-22; the FPL archive has none).
The grid had 66 settings. The rule, fixed before the grid: a setting counts only if it beats v3 on both TRAIN seasons in both MAE and
RMSE; the largest mean gain wins. Chosen: `PW=1, TR=0.5, PK=0, TRP=0`. Validation 2024-25 and test 2025-26 were each evaluated once,
after that choice.

| rounds 4+ | v3 MAE / RMSE | with PitchAPI priors | rounds 4-10 MAE | gameweeks better |
|---|---|---|---|---|
| 2022-23 (train) | 1.7075 / 2.5962 | 1.7057 / 2.5957 | 1.6933 → 1.6883 | 20 of 34 |
| 2023-24 (train) | 1.6759 / 2.6154 | 1.6627 / 2.6144 | 1.6625 → 1.6422 | 32 of 35 |
| 2024-25 (validation) | 1.6162 / 2.4937 | 1.6140 / 2.4901 | 1.5869 → 1.5788 | 21 of 35 |
| **2025-26 (test)** | **1.7382 / 2.6332** | 1.7409 / 2.6328 | 1.6835 → 1.6902 | **11 of 35** |

For comparison, the same prior built from the FPL archive on 2023-24 gives 1.6653 / 2.6143 (PitchAPI: 1.6627 / 2.6144). So PitchAPI's
previous season carries about the same information as FPL's own.

Verdict: the gain on TRAIN and validation is small (0.1–0.8% MAE) and does not hold on the unseen season. There, MAE is worse, RMSE is
equal, the early rounds are worse, and only 11 of 35 gameweeks improve. **The production model stays v3**; nothing on the site changed.
A likely reason is that v3's recency-weighted rates catch up within a few gameweeks, so last season only helps the first rounds, and it
helps less when many players change role or club.

## In-season PitchAPI evidence, 23 October 2026: not adopted

Question: does PitchAPI data from EARLIER ROUNDS OF THE SAME SEASON improve the production model v3? (The previous test used only the previous season.) Folder: `experiments/pitchapi_inseason/` (`reproduce.sh` recomputes everything from `data/`). Protocol as above: TRAIN 2022-23 + 2023-24, validation 2024-25 once, test 2025-26 once; a change counts only if it beats v3 on both TRAIN seasons in MAE and RMSE, and also on the test. **2025-26 has now served as the test three times** (v3 final test, the PitchAPI previous-season priors, and this); it is a weaker check than before.

Data link: each PitchAPI match is mapped to its FPL fixture (380 of 380 in every season); players are linked with the site's `fpLink` name rule within the clubs they played for (96-98% of FPL players with minutes get PitchAPI rows; a PitchAPI player linked to two FPL players is dropped). Only rows of rounds before the predicted round are used. Truncation leak test (data cut after round k, 2023-24, k = 4, 5, 10, 20, 30, 38): 2431 predictions identical for each experiment; a deliberately leaky copy (rounds <= r) is caught (about 250 different predictions per round). A first run of the test for experiment 2 failed because of a bug in the test itself (the cut run lacked the heat-map file); it was fixed and the test repeated.

### Experiment 1: PitchAPI player stats as extra evidence for the goal and assist rates

PitchAPI xG (or shots on target) and xAG (or key passes) of earlier rounds, scaled to FPL units with factors fitted on TRAIN by position, enter the xG/xA rate as extra evidence (`GA/GB/GS`, `AA/AB/AK`; all 0 = v3). A TRAIN-only look first (`explore_train.log`) showed small gains (about 1-2% of the squared error of a player's next-round goals or assists). Grid on TRAIN: goals 24 settings, assists 36, then the combination; chosen `GA=.25, GB=1, AA=.5, AB=1, AK=.5`.

| rounds 4+ | v3 MAE / RMSE | with PitchAPI in-season | rounds 4-10 MAE | gameweeks better |
|---|---|---|---|---|
| 2022-23 (train) | 1.7075 / 2.5962 | 1.7057 / 2.5959 | 1.6933 → 1.6933 | 16 of 34 |
| 2023-24 (train) | 1.6759 / 2.6154 | 1.6661 / 2.6145 | 1.6625 → 1.6487 | 35 of 35 |
| 2024-25 (validation) | 1.6162 / 2.4937 | 1.6104 / 2.4931 | 1.5869 → 1.5790 | 34 of 35 |
| **2025-26 (test)** | **1.7382 / 2.6332** | 1.7329 / **2.6343** | 1.6835 → 1.6805 | 32 of 35 |

MAE improves in every season (0.1-0.6%), but on the test **RMSE is worse** (2.6332 → 2.6343), so by the rule fixed beforehand the change is **not adopted**. Bias moves from -0.10 to -0.12 on the test. A control run after the decision, with FPL's own xG/xA counted twice instead of PitchAPI's (same weights), gives 1.7059 / 1.6732 / 1.6153 / 1.7383 (MAE, 2022-23 to 2025-26): PitchAPI's numbers do carry some information (the control is clearly worse on the two seasons where it matters), but only enough to move MAE slightly and not the squared error. The defensive-contribution rate could not be tested: FPL has no such column before 2025-26.

### Experiment 2: line-ups and heat maps of earlier rounds

Line-ups (`_mx`) and heat maps (`_heat`) are complete for all four seasons (380 of 380 matches; 253 / 188 / 73 / 29 player-matches per season where FPL has minutes but PitchAPI does not list the player, counted as "came on").
- **Squad state** (not in the squad / unused substitute / came on / started in his last match) as a logit shift of P(play), fitted on TRAIN (`sb.json`: -0.38 / +0.63 / -0.22 / +0.27). Every variant is worse than v3 on both TRAIN seasons in MAE (e.g. 1.7200 vs 1.7075 and 1.6886 vs 1.6759), because v3's recency-weighted P(play) already holds this information and the shift over-corrects. Decided before the run: the variant that includes "not in the squad" could not ship anyway, since on the live site FPL's own injury flag carries it; it was run for information only and is also worse. Not adopted, not evaluated on validation or test.
- **Role change** (a player's recent action-weighted average position from the heat maps against his season average, in cells; goal and assist rates multiplied by exp(RG or RA x change)). Grid of 15 settings on TRAIN; only 4 beat v3 on both seasons in MAE and RMSE and the best gain is 0.016%: `RG=.05, RA=.05, RH=.5`. Evaluated once afterwards:

| rounds 4+ | v3 MAE / RMSE | with role change | gameweeks better |
|---|---|---|---|
| 2022-23 (train) | 1.7075 / 2.5962 | 1.7073 / 2.5962 | 19 of 34 |
| 2023-24 (train) | 1.6759 / 2.6154 | 1.6754 / 2.6150 | 23 of 35 |
| 2024-25 (validation) | 1.6162 / 2.4937 | 1.6163 / 2.4938 | 15 of 35 |
| **2025-26 (test)** | **1.7382 / 2.6332** | 1.7380 / 2.6331 | 21 of 35 |

The test gain is 0.00012 MAE with a standard error of 0.00015 across gameweeks, and the validation season is slightly worse: this is noise, not an improvement. The letter of the rule (better on both TRAIN seasons and on the test) is met by a margin of 0.0002 points, but a change that is not distinguishable from zero, was not better on validation, and would need a new heat-map data file on the site is not worth shipping. **Not adopted.**

### Verdict

**The production model stays v3; the site did not change.** Both experiments were run to the end and reported. In-season PitchAPI player stats are a real but tiny signal: MAE -0.1% to -0.6% on every season, RMSE not better on the test. Line-up state and heat-map position add nothing that v3's recency-weighted rates do not already have. The remaining error of v3 (about 1.7 points per player-gameweek) is mostly the randomness of goals, assists and bonus points, not missing information of this kind.
