# Full-time verdict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a match of a starred team, one notification (replacing the plain final-score one) carries a calm verdict and the turning point, and opens a card with the win-probability curve.

**Architecture:** A new sync block `STORY` (before `NOTIFY`) computes per finished match of the current season a verdict from the shots' xG, a win-probability curve from Elo's pre-match chances + score + time, a turning point, and bilingual sentences, and writes `data/story.json`. `notify_plan` and `push_text` take their text from that file; a new page `#/recap/<match id>` only draws what the file holds.

**Tech Stack:** Python (`sync.py`, tests run with `python3`), plain JavaScript page in `assets/`, Playwright tests (`tests/nf/lib.js`).

**Spec:** `docs/superpowers/specs/2026-11-01-full-time-verdict-design.md` (read its "Calls I made" section too).

## Global Constraints

- Talk to the owner in Arabic; code, comments' technical parts, commits and PR text in English. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01CpNi4r1hyqeTn99hNhbkBn`; no model names elsewhere.
- Stage specific files, never `git add -A` (tests touch `data/index.json`); no force push; branch `claude/pl-analytics-fpl-integration-5aw2h9`.
- Optional sync step between `# ===== STORY START =====` / `# ===== STORY END =====`, wrapped so a failure never stops the sync; it must run **before** the NOTIFY block (place it right before it, after TMACH).
- New asset: add its name to `FEATURES_JS` in `sync.py`, raise `FEATURES_V` (60 → 61), run `sh tests/regen.sh`.
- Nothing invented: a match whose goals (from shots, own goals for the other side) do not add up to the score, or without shots, gets no entry and the old plain notification.
- Current season only: `recap` in the past-season `NOT` list, `story` in `psCurOnly`.
- Arabic helpers on the page (`two`, `nb`, `nm`, `INS.ar`), ranges in words, 390 px, async safety (capture `D.id`, bail if `root.isConnected` is false, no cached failures).
- Every new test is added to the job lists in `.github/workflows/tests.yml` and described in `tests/README.md`; CLAUDE.md gets an entry.
- Verdict cut-offs are fixed here and not tuned afterwards: `VD_DESERVED = 0.50`, `VD_LUCKY = 0.25`, `VD_DRAW_FAIR = 0.45`.

## Review Focus

- Match with no shots / goals not adding to the score: no entry, plain notification (Task 3, 4).
- Own goal as the only goal: counts for the other side in the score and the curve (Task 1).
- 0–0 match: verdict only, no turning point, no crash on the card (Task 1, 5).
- No Elo prediction for the match: verdict without curve; the card says the curve is missing (Task 3, 5).
- Goal in added time (`mn` 90, `ma` 4; `mn` 45, `ma` 2): ordered by `mn` then `ma`, time-left never negative (Task 1).
- A team name with `&`, accents or Arabic-hostile characters in a sentence: escaped and wrapped on the card; notification payload stays valid UTF-8 JSON (Task 4, 5).
- Story entry arriving after the plain notification was already sent: no second message (Task 4).

---

## File Structure

- Modify `sync.py`: STORY block (engine + step + wrapper), `notify_plan`, `push_text`, `sync_notify`, `FEATURES_JS`, `FEATURES_V`, the `NOT` / `psCurOnly` lists.
- Create `data/story.json` (placeholder `{"t":"","m":{}}`, committed so the page's request does not 404).
- Create `assets/recap.js` (page) and append `.rc-*` rules to `assets/fun.css`.
- Create tests: `tests/story/t_story.py`, `tests/recap/ui_recap.js`; modify `tests/ntf/t_notify.py`, `tests/ntf/t_push.py`, `tests/ntf/ui_push.js`, `tests/ui/ui_ux.js` only if page counts change.
- Modify `.github/workflows/tests.yml`, `tests/README.md`, `CLAUDE.md`.

### Task 1: Story engine (pure functions)

**Files:** Modify `sync.py` (new STORY block, before `# ===== NOTIFY START =====`); Test `tests/story/t_story.py` (loads the block with `exec(cut('# ===== STORY START =====', '# ===== STORY END ====='), G)` exactly like `tests/ntf/t_notify.py`).

**Interfaces:**
- Produces:
  - `story_goals(rows, home, away) -> list[(minute:int, added:int, side:'h'|'a')] | None` — `rows` = dicts of one match's shot rows (`cols` zipped, fields `ev, og, c, mn, ma`); goals sorted by `(mn, ma or 0)`; own goal goes to the side other than `c`; `None` if a club name is neither `home` nor `away`.
  - `story_chances(rows, home, away) -> (xh:float, xa:float, ph:[p_win,p_draw,p_loss])` — from non-own-goal shots' `xg` (None skipped); each shot scores independently with probability xG (Poisson-binomial by dynamic programming, goals capped at 15); `ph` is from the home side's view.
  - `story_verdict(score:(int,int), xh, xa, ph) -> {"vs":'h'|'a'|'d', "vd":'deserved'|'close'|'lucky'|'fair'|'saved'}` using the three constants above: for a win, `q` = chance-based P(winner wins): `q >= VD_DESERVED` → deserved, `q < VD_LUCKY and xg of loser > xg of winner` → lucky, else close; for a draw: `g = max(P(h wins), P(a wins))`, `g < VD_DRAW_FAIR` → fair, else saved (the side with the lower chance-win took a point it did not earn).
  - `story_rates(pre:[pH,pD,pA], total:float) -> (lam_h, lam_a)` with `lam_h + lam_a == total` and Poisson-difference `P(home wins) − P(away wins)` equal to `pH − pA` (bisection on the share).
  - `story_curve(goals, pre, total) -> list[[minute:int, ph:float, pd:float]]` — points at minutes 0, 15, 30, 45, 60, 75 and at each goal (after it), last point at 90 (remaining time 0 → exactly the result); remaining fraction `(90 − min(90, minute)) / 90`; probabilities 3 decimals, away = `1 − ph − pd`.
  - `story_turn(curve, goals, vs) -> {"m":int,"side":'h'|'a'|None,"a":float,"b":float} | None` — the goal whose point changes the result side's probability most (for `vs=='d'` the draw's probability; first goal wins ties); `None` without goals.
  - `story_text(entry, home, away) -> {"en":[verdict_sentence, turning_sentence_or_None], "ar":[...]}` with the templates below.

Templates (`x` = one decimal; `W`/`L` = winner/loser name; `T` = side that gained; percentages whole numbers):
- deserved — en: `{W} deserved it: their chances were worth {xw} goals to {xl}.` ar: `{W} يستاهل الفوز: فرصه تساوي {xw} هدف مقابل {xl}.`
- close — en: `A close call: {W} won, but the chances ({xw} to {xl}) could have gone either way.` ar: `مباراة متقاربة: فاز {W}، لكن الفرص ({xw} مقابل {xl}) كان ممكن تروح للطرفين.`
- lucky — en: `A stolen win for {W}: {L}'s chances were worth {xl} goals to {xw}.` ar: `فوز مسروق لـ{W}: فرص {L} تساوي {xl} هدف مقابل {xw}.`
- fair — en: `A fair draw: the chances were close ({xh} to {xa}).` ar: `تعادل عادل: الفرص متقاربة ({xh} مقابل {xa}).`
- saved — en: `{S} took a point they did not earn: {O}'s chances were worth {xo} goals to {xs}.` ar: `{S} أخذ نقطة ما استحقها: فرص {O} تساوي {xo} هدف مقابل {xs}.`
- turning, win — en: `The match turned in minute {m}, when {T}'s chance of winning went from {a}% to {b}%.` ar: `انقلبت المباراة في الدقيقة {m} لما ارتفعت فرصة فوز {T} من {a}% إلى {b}%.`
- turning, draw — en: `The draw settled in minute {m}, when the chance of a draw went from {a}% to {b}%.` ar: `استقر التعادل في الدقيقة {m} لما تغيّرت فرصته من {a}% إلى {b}%.`
- turning sentence is `None` when there are no goals or no curve.

- [ ] **Step 1: Write failing tests** in `tests/story/t_story.py` (copy the `ok()` / `exec(cut(...))` scaffold of `tests/ntf/t_notify.py`; stub `G` with `json, math, re, datetime, os, log, hashlib`). Assertions, worked by hand:
  - `story_goals` on rows `[Goal c=A mn=11], [Goal og=1 c=A mn=30], [Goal c=B mn=90 ma=4], [Goal c=B mn=90 ma=1]` with home=A, away=B → `[(11,0,'h'),(30,0,'a'),(90,1,'a'),(90,4,'a')]`; a club name `"C"` → `None`.
  - `story_chances` with two shots of xG 0.5 and 0.5 (home) and none (away): `xh=1.0`, `ph == [0.75, 0.25, 0.0]` (±1e-9); a shot with `xg=None` is ignored; an own-goal row is ignored.
  - `story_verdict((2,1), 2.4, 0.9, [0.86,0.1,0.04])['vd']=='deserved'`; `((1,0), 0.4, 1.9, [0.07,0.2,0.73])` → `lucky`, `vs=='h'`; `((1,0), 1.1, 1.0, [0.40,0.3,0.30])` → `close`; `((1,1), 1.2, 1.1, [0.36,0.3,0.34])` → `fair`; `((0,0), 0.2, 2.1, [0.02,0.1,0.88])` → `saved`.
  - `story_rates([0.5,0.25,0.25], 2.6)`: sum is 2.6 and the resulting `P(h) − P(a)` equals `0.25` within 1e-6; `pH == pA` gives equal rates.
  - `story_curve([], [0.5,0.25,0.25], 2.6)`: first point is the pre-match chances (within 0.02 of 0.5/0.25 — the model's own `pd`), last point at 90 is `[90, 0.0, 1.0]` for a 0–0 (draw certain), and `[90, 1.0, 0.0]` for a 1–0 home lead (use goals `[(11,0,'h')]`); a goal at `mn=90, ma=4` does not give a negative time left.
  - `story_turn` on a hand-built curve returns the goal with the largest change, `None` for no goals; draw uses the draw column.
  - `story_text`: each template renders exactly the strings above for a worked entry (check one English and one Arabic string per verdict code and both turning forms, with `ar` containing the team names unchanged).
- [ ] **Step 2:** Run `python3 tests/story/t_story.py` → FAIL (names undefined).
- [ ] **Step 3:** Implement the functions above in the STORY block; Poisson tails summed to 12 goals each; `story_rates` finds the home share by bisection (60 iterations).
- [ ] **Step 4:** Run `python3 tests/story/t_story.py` → all `ok`.
- [ ] **Step 5:** Commit `sync.py tests/story/t_story.py` — `feat: full-time verdict engine (chances, curve, turning point, text)`.

### Task 2: Accuracy measurement

**Files:** Modify `sync.py` (STORY block); Test `tests/story/t_story.py` (add checks).

**Interfaces:**
- Consumes: Task 1 functions.
- Produces: `story_accuracy(items) -> dict`, where `items` = list of `{"score":(h,a), "rows":[...shot rows...], "home","away","pre":[pH,pD,pA]|None, "total":float}` (one per finished match with consistent goals):
  `{"n":int, "xg_goals":{"xg":float,"goals":int}, "shares":{"deserved":n,...,"saved":n}, "brier_chances":float, "brier_rates":float, "curve":{"30":{"n":int,"brier":float,"base":float,"bins":[[lo,hi,n,pred_mean,obs_rate],...]}, "60":{...}, "75":{...}}}`
  `brier_chances` = mean Brier of the shot-based `[p_win,p_draw,p_loss]` against the real result; `brier_rates` = the league win/draw/loss rates (same matches) as the baseline; `curve[m].brier` = Brier of the curve's `[ph,pd,pa]` at minute `m` (state of the score at minute `m`) against the final result, `base` = Brier of the pre-match `pre`; bins are ten equal bins of predicted home-win probability, skipping empty ones.
- League total goals per match used by the curve: `story_total(prev_scores) -> float` = mean total of matches before the match (a running mean in date order; 2.6 until 30 matches exist).

- [ ] **Step 1: Failing tests** — a hand-built set of 3 matches with known answers: `n==3`, `xg_goals` sums, the `shares` sum equals `n`, `curve["60"]["n"]` counts only matches with `pre`, and a calibration property: for a synthetic set of 4,000 matches generated with a fixed seed from the curve model's own rates (`story_rates` + Poisson goals at known minutes) the 60' bins have `|pred_mean − obs_rate| < 0.04` where `n >= 100` (model checked against its own world, not against the data).
- [ ] **Step 2:** Run the test → FAIL.
- [ ] **Step 3:** Implement `story_accuracy` and `story_total`.
- [ ] **Step 4:** Run → pass.
- [ ] **Step 5:** Commit `feat: accuracy measurement for the verdict and the curve`.

### Task 3: The sync step writes `data/story.json`

**Files:** Modify `sync.py` (STORY block: `sync_story`, wrapper); Create `data/story.json`; Test `tests/story/t_story.py` (add the step with GitHub stubbed, as `t_notify.py` does with `STORE`/`PUT`).

**Interfaces:**
- Produces: `sync_story(hub, now=None)` writing `data/story.json`:
  `{"t":"YYYY-MM-DD HH:MM:SS","v":1,"key":"<10 hex chars>","acc":{...story_accuracy of the current season's finished matches...},"acc25":{...same for the finished 2025-26 seasons of the six leagues, shots from the files `data/seasons.json` lists (read how `sync_stability` finds them)...},"m":{"<match id>":{"lg":"<league id>","s":"2-1","x":[xh,xa],"pv":[w,d,l],"vs":"h","vd":"deserved","c":[[min,ph,pd],...]|null,"tp":{"m":78,"side":"h","a":31,"b":78}|null,"tx":{"en":[...],"ar":[...]}}}}`
  — the current season's finished matches that have shots and consistent goals; `c`/`tp` are `null` (and `tx[*][1]` is `None`) when `data/elo_own.json` has no `pred` for the match; recomputed only when `key` (hash of per-league finished-match counts + `elo_own.json`'s `key`) changes; a failure is logged in Arabic like the other steps and never raises out of the wrapper.
- Reads: `data/index.json` (leagues → `file`), `data/<league file>`, `data/<league>_sh.json` (`cols` / `rows`), `data/elo_own.json` (`leagues[lid].pred[match id] = [pH,pD,pA]`).
- Placeholder `data/story.json` committed as `{"t":"","m":{}}`; the step treats it as no file.

- [ ] **Step 1: Failing tests** — step with a stubbed hub on a 3-match fixture: writes one entry per consistent match, none for a match without shots and none for a match whose goals do not add to the score; `c` is `null` for the match without `pred`; a second run with unchanged inputs writes nothing; a raised exception inside is logged and not re-raised by the wrapper; the real `data/story.json` after Step 5's local run has every entry's `vd` in the five codes, `tx` strings non-empty in both languages and the `c` last point equal to the real result.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `sync_story` and the wrapper (`_orig_run_pipeline_story = run_pipeline` pattern as TMACH/NOTIFY); `acc25` may be `null` if the 2025-26 files are missing.
- [ ] **Step 4:** Run the test → pass. Run the step once locally against the repo's own `data/` (stubbed `gh_get_json` reading files, `gh_put` writing to a scratch path) and read the printed `acc`: record the numbers for Task 6.
- [ ] **Step 5:** Commit `sync.py data/story.json tests/story/t_story.py` — `feat: story sync step writes data/story.json`.

### Task 4: Notifications carry the story

**Files:** Modify `sync.py` (`notify_plan`, `push_text`, `sync_notify`); Test `tests/ntf/t_notify.py`, `tests/ntf/t_push.py`, `tests/ntf/ui_push.js` (only where they assert the old result text).

**Interfaces:**
- Changes: `notify_plan(leagues, fixtures, state, now, base_url, ns, channel="ntfy", story=None)`; `story` = `data/story.json["m"]` (or `None`). For a result whose match id is in `story`: payload `title` unchanged (`"{h} {g}–{g} {a}"`), `message` = `f"{tx['en'][0]}\n{tx['ar'][0]}\n{lname}"` (ntfy), `click` = `f"{base_url}#/recap/{id}"`, and the key's 5th element (`key[4]`, `None` for results today) = `tx` so `push_text` can read it. A match without an entry is exactly as before.
- `push_text(payload, key, lang)`: for kind `"r"` with `key[4]` a dict, `body = " ".join(s for s in key[4][lang] if s) + f" · {lname}"`; otherwise unchanged.
- `sync_notify` passes `story=(gh_get_json(hub, "data/story.json") or {}).get("m")` to both `notify_plan` calls (ntfy and `push_run` → its `notify_plan(..., channel="push", story=...)`; add a `story` parameter to `push_run`).
- State keys, first-run rule, the 80-message cap and the failure stop are unchanged; a result already marked as announced is never re-sent when its story appears later.

- [ ] **Step 1: Failing tests** — extend `t_notify.py`: with `story={'m1': {...tx...}}` the Arsenal–Chelsea result has the story message, click `#/recap/m1`, `key[4]` is the `tx` dict; a result without an entry keeps the old text and `#/match/` link; a result already in state is not re-sent when its story shows up; a real POST to the fake ntfy server keeps the Arabic intact (reuse the existing server test with the story message). Extend `t_push.py`: `push_text` gives the Arabic pair for `lang='ar'`, the English pair for `'en'`, drops a `None` second sentence, and the old text without `key[4]`.
- [ ] **Step 2:** Run `python3 tests/ntf/t_notify.py` and `python3 tests/ntf/t_push.py` → the new checks FAIL.
- [ ] **Step 3:** Implement the changes.
- [ ] **Step 4:** Run both tests plus `node tests/ntf/ui_push.js` (via `bash tests/ci.sh ...` — see `tests/README.md`) → pass.
- [ ] **Step 5:** Commit `sync.py tests/ntf/*` — `feat: final-score notifications carry the verdict and link to the recap`.

### Task 5: The recap page

**Files:** Create `assets/recap.js`; Modify `assets/fun.css` (append `.rc-*`), `sync.py` (`FEATURES_JS` + `FEATURES_V`, `NOT` and `psCurOnly` lists; then `sh tests/regen.sh`); Test `tests/recap/ui_recap.js`.

**Interfaces:**
- Consumes: `data/story.json` (Task 3 shape), `D.matches` (`match_id, home, away, score, date`), `INS.cardKit.savePng`.
- Produces: route `#/recap/<match id>` via `R.recap=async function(el,id)` (same pattern as `R.replay` in `assets/match-replay.js`); a link "Full-time story" added to the Match centre's foot of a finished match whose id is in `story.json` (wrap `R.match` as `match-replay.js:226-232` does; class `rc-go`).
- Page content: header (names, score, date), the curve as one SVG (home win, draw, away win as stacked bands or three lines — pick one and use the page's colours; goals marked with minute labels, the turning point ringed), the verdict sentence and turning sentence from `tx[lang]` (team names escaped and wrapped in `<bdi>` in Arabic), xG of both sides, the shares line "how accurate" from `acc`/`acc25` printed as numbers with a plain-words reading ("the shot-based probabilities explain results better than league rates: Brier a vs b"), a note "red cards are ignored" (the shot files have no card events; if you find card minutes in another file in `data/`, say so to the owner before using them), a one-line note "the curve follows the scoreboard, the verdict follows the chances", a save button (`INS.cardKit.savePng`, prefix `recap`, 1080 × 1350, Arabic right to left). Match not in `story.json` → "no story for this match" with the link to the Match centre; unfinished → link to the preview; past-season view → the usual "not available for a past season".

- [ ] **Step 1: Failing test** `tests/recap/ui_recap.js` (scaffold from `tests/toty/ui_toty.js` and `tests/nf/lib.js`): the page for 3 real finished matches (a win, a draw, a 0–0 if any) shows the sentences of the file verbatim, the last curve point equals the real result, goal markers = real goals (recomputed from `*_sh.json` in the test, not read from `story.json`), xG equals the recomputed sums, the saved PNG decodes at 1080 × 1350, missing/unfinished/no-entry cases, leaving before the data arrives, a failing `story.json` (503) and the placeholder file, Arabic RTL with team names in `<bdi>`, 390 px (no horizontal scroll), the Match centre link only for matches with an entry.
- [ ] **Step 2:** Run it → FAIL.
- [ ] **Step 3:** Implement `assets/recap.js` and the CSS; register and regenerate: `sh tests/regen.sh`.
- [ ] **Step 4:** Run `tests/recap/ui_recap.js` and the Match centre / replay / past-season tests (`tests/ui/ui_ux.js`, `tests/rp/ui_rp.js`) → pass.
- [ ] **Step 5:** Commit the new and changed files by name — `feat: recap page with win-probability curve and verdict`.

### Task 6: Wire up, verify, ship

**Files:** Modify `.github/workflows/tests.yml`, `tests/README.md`, `CLAUDE.md`.

- [ ] **Step 1:** Add `story/t_story.py` to the Python job list and `recap/ui_recap.js` to a browser shard in `tests.yml`; add entries to `tests/README.md` and a "Full-time verdict" entry to `CLAUDE.md` with the measured numbers from Task 3 Step 4 (honest, including weak ones).
- [ ] **Step 2:** Run the whole suite as CI does (`tests/README.md` has the commands; avoid concurrent runs, `tests/ci.sh` uses port 8765) → all pass.
- [ ] **Step 3:** Open a PR (body ends with the session lines), wait for green CI, merge (squash, full head SHA), run `sync.yml`, then compare `data/story.json` on `main` (raw.githubusercontent.com) with the local run and check that the Pages deployment succeeded; report to the owner in Arabic: what works, the measured accuracy, and what could not be checked from the sandbox (a real notification on a real match day).
