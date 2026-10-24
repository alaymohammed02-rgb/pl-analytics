# PL Analytics: working notes

A static football analytics site on GitHub Pages. A Python sync (`sync.py`, run by `.github/workflows/sync.yml` on a schedule and on demand) fetches PitchAPI and FPL data into `data/` and generates `index.html`. Feature pages are plain JavaScript files in `assets/`, loaded after the main inline script.

## Rules agreed with the owner

- **Talk to the owner in Arabic** (Gulf Arabic is fine). Code, commits and PR descriptions are in English.
- **When the owner asks for a feature:** build it, test everything, merge it yourself, run the sync, then check the published files.
- **Never claim untested success.** Report honest results, including when a model or idea does not work. Pages must say so too.
- **Do not invent statistics or missing values.** Estimates are labelled as estimates on the page, with their tested error.
- **Secrets:**
  - never expose, request or change API keys or secrets without need;
  - no secret goes in browser JavaScript;
  - keys live in GitHub secrets (`PITCHAPI_KEY`).
- **Leave existing features alone:**
  - do not change login, permissions or the sync mechanism broadly;
  - do not remove existing features;
  - keep the site working on GitHub Pages.
- **StatsBomb Open Data terms:**
  - analysis only;
  - no redistribution of raw data;
  - no commercial use;
  - show the StatsBomb logo where it is used.
  - SkillCorner asks for credit.
- **Git:**
  - no force push;
  - stage specific files, never `git add -A` (tests touch `data/index.json`);
  - no model names in commits or PRs.

## How a feature page works

- **Registration:** add the file name to `FEATURES_JS` in `sync.py`, and **raise `FEATURES_V`** whenever an asset or `assets/fun.css` changes, because browsers cache by that version. Then rebuild `index.html` with `sh tests/regen.sh`.
- **Page setup:** each page calls `INS.addPage(key, name, section, after)` and ends with `if(typeof D==='object'&&D&&typeof route==='function')route();`. The sections are `home`, `league`, `players`, `analysis` and `fpl`.
- **Arabic:**
  - `two(en, ar)` makes paired spans (`.fx-en` / `.fx-ar`);
  - `nb(x)` wraps numbers and Latin text in Arabic sentences (`<bdi dir="ltr">`);
  - `nm(name)` wraps names;
  - `INS.ar({...})` adds translations for plain text nodes;
  - write ranges in words ("من 37 إلى 38"), because RTL reverses "37–38".
- **Async safety:** capture `D.id` before any `await`, and bail out if `root.isConnected` is false or `D.id` changed. Caches must not keep a failed result, and must be keyed by `INS.poolKey()` (data version).
- **Liquid Glass** (`assets/liquid-glass.js`, styles at the end of `assets/fun.css`): a true lens on the chosen button of the Fantasy tabs and the menu drawer.
  - The lens shows what is really under it: a copy of the group (button backgrounds, every letter, or every word in Arabic so letters stay joined, and the drawer's section titles and icons), each piece placed where the browser drew the real one (a `Range` per letter). The copy is drawn on the colour behind the group, so the real labels never show twice. It is rebuilt when the buttons, their text, the theme (`html` style/class), the language or the fonts change; colours are read with the buttons' own transitions off.
  - Pieces are `<i>` with the text in `data-c` and shown by `::before`, so `textContent`/`innerText` of the page are unchanged.
  - The glass is a spring (no fixed animation): a new choice sends it straight to the new button in any direction (about 0.35 s, small overshoot), stretching along its way; a new choice while it moves bends the path. The lens strength and the letter weight (a stroke, so nothing reflows) follow its speed; each letter is moved out by `1+A(1-d²)²` and scaled by the local stretch on each axis, so rim letters are squeezed, never overlap. Nearby buttons grow a little (Dock), the new label's letters land one by one.
  - Groups: the Fantasy tabs, the menu drawer, and the tab strips of Hidden Gems, Player DNA, Reality Check, Team DNA (`.ins-tabs`), the Intelligence Lab (`.labtabs`) and Pressing maps (`.sbp-tabs`). Only the first matching bar on a page gets a glass. `LGX.pose(id,x,y)` parks a glass for tests.
  - Press-and-drag (`drag:true`, every tab bar except the drawer): press the chosen tab to lift the glass, drag it (mouse or finger; `touch-action:none` on the chosen tab only) and let go to choose the tab under it; the browser's click after a drag is swallowed. A mouse over another tab makes the glass lean 5 px towards it.
  - The buttons are untouched: the glass is `aria-hidden` with pointer events off; the attribute `data-lgx-act` marks the chosen one, never a class (tests compare `className`). A group with one button gets no glass; reduced motion jumps, without lens, lift or drag.
  - The drawer closes once the glass arrives (`lgxHold()` in `assets/drawer.js`, from the spring's predicted arrival); the page itself opens at once.
  - More groups: add `{sel, items, on}` (and `deco`, `drag`) to `G`. Test: `tests/lg/ui_lg.js`.
- **Player card** (`assets/defense-card.js`, top of `#/defense`, `#/shots` and `#/passing`): four kinds (defending, attacking, passing and creating, dribbling and carrying; each page opens on its own kind). A player, 3 to 8 measures and who he is compared with (same role from the line-ups / same position / all outfield; six leagues or the league; 270/450/900+ minutes) give a card (one SVG, also saved as a PNG) with each measure per 90 beside its name ("1.76 /90"), a bar as long as his percentile coloured red → amber → green, and his heat map (all actions, no average-position dot). Ratios need 5+ attempts. Uses `aggPl` per league via `INS.pool(['pl','mx'])`. A past season compares within its league only. Test: `tests/dc/ui_dc.js`.
- **Pressing cards.**
  - Match pressing card (`assets/press-card.js`, top of `#/ppda`): PitchAPI's team numbers for one match (PPDA, defensive actions, high turnovers, counterpress regains, regain time, defensive action height), each ranked among every team-match of the league (green = more pressing), the team heat map, and the nine players with most defensive actions. PitchAPI has no pressure events, and the card says so. Test: `tests/pc/ui_pc.js`.
  - Pressing maps (`assets/sb-press.js`, `#/sbpress`): StatsBomb Open Data (analysis only, logo on page and cards, never committed raw).
    - **Match map:** the browser reads the match's events and lineups from StatsBomb's public files; every Pressure event is a dot, with thirds and the players' pressures by third.
    - **Player card:** percentiles from `data/sb_press.json`, built offline by `tools/sb-press/build_press.py` (per-player counts and a 12 × 8 pressure grid for Euro 2024, World Cup 2022, Copa América 2024 and AFCON 2023; definitions are in the script: a regain = the pressing team has the ball within 5 s, possession-adjusted = × 50 ÷ the opponent's share of the ball).
    - StatsBomb's open Bundesliga 2023/24 holds only Bayer Leverkusen's 34 matches, so there is no league-wide pool.
    - Tests: `tests/sb/ui_sb.js` (a hand-made fixture, no network) and `tests/sb/t_press.py` (the builder on the same fixture, and the shape of the data file).
  - **Estimated pressing** (`assets/press-est.js`, under the match card on `#/ppda`): PitchAPI has no pressure events, so a player's pressures per 90 are ESTIMATED from his line-up role, tackles and interceptions per 90 (a fit per role in `data/press_est.json`, built offline by `tools/sb-press/fit_press_est.py` from StatsBomb's full 2015/16 Premier League, La Liga, Serie A and Ligue 1; `overlap_ligue1.py` reduces the matches). Tested leave-one-league-out at player-season level (900+ min): correlation 0.81–0.88 with the real pressures (role alone 0.71–0.80), typical miss 2.4–2.9 pressures/90 (about 17%). Blocks and clearances are left out (PitchAPI counts blocks differently, StatsBomb tagged clearances differently in 2015/16). NOT tested, and the page says so: PitchAPI's numbers for the same players against real pressures. The only same-season overlap is Ligue 1 2022-23 (Paris matches); Ligue 1 2021-22 has no player rows in PitchAPI (24 Oct 2026), so `PS_JOBS` fetches only 2022-23 (light). Percentile is the safer reading. Tests: `tests/pe/ui_pe.js`, `tests/pe/t_fit.py`.
  - Both cards share the helpers `INS.cardKit` from `assets/defense-card.js`, so that file loads first.
- **Market and Elo** (`sync_market`, `sync_elo` in `sync.py`, between the `MARKET START/END` markers; each wrapped so a failure never stops the sync): `data/market.json` = bookmaker closing odds from football-data.co.uk matched to our matches (date ±1 day plus score, then names via `MK_ALIAS`), de-vigged into probabilities, with unmatched counts; `data/elo.json` = ClubElo ratings once a day with history from the first sync (no backtest possible before that). Neither host is reachable from the sandbox: check the Actions log for matched/unmatched names after a run and extend `MK_ALIAS`. Test: `tests/mk/t_market.py`.
  - **Model against the market** (card at the end of `#/reportcard`, `assets/report-card.js`): the leave-one-out model, the de-vigged closing odds and the league base rates on the same finished matches, Brier and accuracy per league, with the paired difference judged against its standard error ("within noise" under 1.96 SE). First result (24 Oct 2026, 410 matches): the bookmakers beat the model, Brier 0.564 against 0.601, a gap beyond noise. The odds file has only played matches, so there is no coming-fixtures comparison; `market.json`/`elo.json` are current-season only (`psCurOnly`). Elo is not shown on a page yet (the first Elo download failed with HTTP 502 and is retried on the next sync). A same-score match needs one agreeing team name, because a match missing from PitchAPI once took another game's odds.
- **Cross-league data:** `assets/league-pool.js` provides:
  - `INS.pool(need)`: the six domestic leagues;
  - `INS.poolOne(id, need)`: one league;
  - `INS.mm(ms, xg)`: the match model, with a leave-one-match-out option.

## Data facts that matter

- **Shots** (`*_sh.json`) carry goal minutes:
  - `ev === 'Goal'`;
  - `og` marks an own goal, which counts for the other side;
  - stoppage time is in `ma`, so sort by `mn` then `ma`.
  - The goal timeline adds up to the final score in every match checked.
- **Line-ups** (`*_mx.json`): `xi` entries are `[id, name, shirt, slot, depth, lateral, captain]`.
  - Slot 11 is the goalkeeper.
  - Slots 30–39 are the defensive line; centre-backs are the ones with lateral between 0.15 and 0.85.
  - A match can have a line-up but no player rows (status "partial").
- **Player rows** (`*_pl.json`): `xag` is missing for whole matches, not per player.
  - `duw` (duels won) does not include aerial duels: it is lower than `aerw` in about a third of player-matches, so "duels won − aerials won" is not ground duels (the Defensive table's "Ground won" column still derives it that way; reported to the owner, 23 Oct 2026).
  - `tko`/`tkw` are take-ons, not tackles (`tk`).
  - `*_px.json.gz` / `*_pxa.json` (recoveries, touches…) are old files the sync no longer writes (last 19 Oct 2026); nothing on the site reads them.
- **Heat maps** (`*_heat.json`): 16 cells along the pitch. A player's average position is the action-weighted cell centre (10+ actions).
- **Defensive line** (`data/dlh.json`, built offline by `tools/line-height/`):
  - StatsBomb 360 lines, corrected by a SkillCorner-trained model (0.31 m error);
  - plus the current-season estimate formula and its validation.

- **Past seasons** (`data/seasons.json`, sync section "المواسم السابقة"):
  - Finished seasons from PitchAPI under `<league>_<season>` (e.g. `data/l_4WFCIZ_2025-26_sh.json`), same formats as the current files.
  - Each match is fetched once; at most 1200 PitchAPI requests per sync run (`PS_REQ_PER_RUN`); jobs in `PS_JOBS`.
  - Full seasons cost 10 requests a match and about 49 KB; light seasons (matches, player rows, shots) cost 5 and about 16 KB.
  - PitchAPI lists 2021-22 to 2026-27 for all six leagues; the plan allows past seasons (measured 23 Oct 2026).
  - `data/index.json → seasons` lists the full past seasons per league (light ones are left out). Light seasons have team ids, not names, in `c`; the names are in the `team` rows.
  - Premier League 2021-22 to 2024-25 were fetched light, then switched to full (PR #52, 23 Oct 2026): the sync adds only the missing parts (advanced stats, heat maps, line-ups, ratings, halves), about 120 matches a run, before the other leagues' 2025-26. Until then the banner says the extras are still being added.
- **Season selector** (`assets/seasons.js` + `psView` inline): a past season keeps the league id and swaps the league's files.
  - A switch reloads the page.
  - Pages that need this season's Fantasy data, fixtures or live data are listed in `NOT` and say "not available for a past season".
  - Files that describe only the current season are answered "not found" in a past season (`psCurOnly`).

## Testing and merging

- **Tests:** see `tests/README.md`. They run on every PR (`.github/workflows/tests.yml`); a new test must be added to a job list there. Each page has a test that recomputes its numbers independently from `data/`, and checks Arabic, a 390 px phone, leaving before the data arrives, and a failing file.
- **Flow:** PR → merge → run the `sync.yml` workflow → compare the files on `main` (raw.githubusercontent.com) with the local copies → check that the Pages deployment succeeded. The published `github.io` site cannot be reached from the cloud sandbox.
- **Pitfalls:**
  - `pkill -f` with a pattern that matches your own command kills your shell: use `pgrep`, then `kill`.
  - The photo CDN is unreachable in the sandbox.

## Next steps (proposed to the owner, 23 Oct 2026)

1. ~~Wire the tests to GitHub Actions on every PR~~: done (`.github/workflows/tests.yml`, PR #47; past-season and track-record tests added, Chromium cached).
2. **A stronger match model** (Opus, high effort).
   - Use past seasons from PitchAPI as priors (now fetched by the sync: 2025-26 for six leagues, Premier League 2021-22 to 2024-25 full).
   - Note: previous-season PitchAPI priors did not improve the Fantasy model on the held-out 2025-26 (`ml/RESULTS.md`).
   - Weight recent matches more, and use a home advantage per league.
   - Possibly add ClubElo.
   - Measure it with the Model report card page.
3. **A faster site and a simpler menu** (Opus, high effort).
   - Load a page's script only when it opens (today about 1.3 MB of code loads on every visit).
   - Group the 39 pages into about 10 hubs with tabs.

The owner has not yet chosen among the free data sources offered (ClubElo, football-data.co.uk, Open-Meteo, API-Football, football-data.org). Any key goes into GitHub secrets.
