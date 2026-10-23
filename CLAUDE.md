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
