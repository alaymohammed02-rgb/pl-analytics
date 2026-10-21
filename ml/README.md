# FPL model training workspace (read this fully before doing anything)

Goal: improve the PL Analytics Fantasy prediction model (expected FPL points per player per gameweek) using
archived seasons, without any information leakage, so that the improvement holds on an unseen season.

## Data (read-only — never modify files outside your own experiment folder)
- `seasons/<season>.json` for 2022-23, 2023-24, 2024-25: same format as the live site's data/fpl.json
  (players `cols`/`rows` with end-of-season totals and a stable cross-season player `code`; `teams` with stable team `code`;
  `fix` = [event, team_h, team_a, h_difficulty, a_difficulty, finished, h_score, a_score, kickoff];
  `hist[player_id]` = per-fixture rows with columns `hcols` (r=round, pts, val=price*10, min, xg, xa, bon, opp, h=home,
  st=started, gl, as, cs, gc, sv, yc, rc, og, pmi, psv, bps, xgc, dc=defensive contribution (null before 2025-26), fx=fixture id);
  `scoring` = that season's verified scoring rules, `rules` = squad rules).
  Player ids differ between seasons; link players across seasons by `code` (cols include "code"), teams by team `code`.
- `seasons/<season>.xp.json`: FPL's own published xP per "playerId|round" from the archive. Its leak-freeness is NOT verified;
  use it only as a reference number, never as a model input.
- The 2025-26 season is the final hold-out test. It is deliberately NOT in this workspace. Do not search for it, do not download
  it, do not use any data from 2025-26 or later, and do not use the internet for data.

## Protocol (mandatory)
- TRAIN seasons: 2022-23 and 2023-24. VALIDATION season: 2024-25.
- Fit/tune everything on TRAIN only. Evaluate the final chosen configuration on VALIDATION once, and report it. Do not iterate on
  VALIDATION (if you look at it several times, say so honestly in the report).
- Within a season, the prediction for round r may use only rows with round < r of that season (the replay `btRun` enforces this
  for the production model). Previous seasons may be used in full (they are complete before the season starts). Never use the
  same round's or later rounds' rows, end-of-season totals of the season being predicted (players `rows` totals!), final prices,
  or the `xP` column as inputs.
- Metric: mean absolute error (MAE) of predicted vs actual FPL points over replay rows with round >= 4 (as in `baseline.js`).
  Also report bias (mean pred − actual) and MAE by position (1 GKP, 2 DEF, 3 MID, 4 FWD). Lower MAE is better.

## Baseline (production model v1, from `node baseline.js fp_model.js <season>`)
  2022-23: 1.6951   2023-24: 1.7659   2024-25 (validation): 1.6936   (last-5 average baseline: 1.8803 / 1.8380 / 1.7627)

## Code
- `fp_model.js` = the production model JavaScript, exactly as on the site (functions pmCtx, pmPlayer, pmPredictAll, btRun, ...,
  constants `PM` = {N, PRIOR_MIN, K_FIN, N0, RECENT, ...}). Make your own copy inside your folder; never edit this file.
- `harness.js`: `const {load}=require('../harness.js'); const {ev,d}=load('<your model.js>','<season json>')` loads the model into a
  sandbox with the season data in `d`. `await ev('btRun')(d)` returns {rows:[{r,id,name,pos,club,pred,bs,b5,act,amin,eMin,mb,pp,pb,
  played,pr,price,n,q}],...}: one row per player-gameweek, pred = model expected points for that round, act = actual points.
  `ev(<expression>)` evaluates any expression inside the sandbox (e.g. `ev('PM.PRIOR_MIN=600')`).
- To see the model's internals per row (rates, per-fixture parameters), wrap `pmPlayer` before calling btRun, e.g.
  `ev("(function(o,cap){pmPlayer=function(p,C,dd){const m=o(p,C,dd);if(dd!==FPD)cap.push({r:C.next,p,m});return m}})")(ev('pmPlayer'),cap)`
  (`m.gws[0]` is the round being predicted: parts, pts, fx[], eMin; `m.rates`: lamG, lamA, R{bon,sv,dc,...}, pPlay0, q60, ePlay...).
- `baseline.js` shows how to compute the metric. Python with numpy + lightgbm: `venv/bin/python`.
- Machine: 4 CPUs shared with one other experiment running at the same time. A season replay takes ~2 s; keep searches modest
  (hundreds of replays at most) or work on cached features.

## Production constraints (your change must be shippable)
- The live model runs in the browser in JavaScript, over the current season's data (same fields as these season files) plus,
  if your change needs it, data derived from COMPLETE previous seasons (which we can publish as a small JSON file).
- Prefer changes that act on the model's rates/probabilities (lamG, lamA, pPlay, q60, R.*, team strengths, priors), because the
  site's Monte Carlo ranges simulate exactly those rates. A pure additive points correction is allowed only if it is expressed as an
  explicit extra component (so the per-component breakdown still adds up to the total); say how it would enter the simulation.
- Keep it reasonably simple; every added parameter must be justified by TRAIN evidence.

## Deliverable (in your folder `exp_<name>/`)
- `model.js`: complete model file with your change (a copy of fp_model.js plus your edits; mark edits with comments).
- `reproduce.sh`: one command sequence that recomputes your reported numbers from scratch.
- `results.json`: {"train":{"2022-23":mae,"2023-24":mae},"validation":{"2024-25":mae},"bias":{...},"byPos":{...},
  "baseline":{...same seasons...},"params":{...},"validation_looks":<how many times you evaluated on 2024-25>}
- Your final answer: a concise report (what you changed, why, numbers, risks, how to ship it).
