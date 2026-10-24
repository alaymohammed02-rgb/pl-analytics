# Tests

Browser tests (Playwright, Chromium) and Python tests for the site. They run on every pull request in GitHub Actions (`.github/workflows/tests.yml`).

## Run

```sh
sh tests/regen.sh                         # rebuild index.html from sync.py (gen_index.py); index.html is not changed by it unless sync.py changed
bash tests/ci.sh ph/ui_dlh.js nf/ui_gs.js fx/t_fx.py   # any mix of browser (.js) and Python (.py) tests
```

Setup: Node with Playwright (`NODE_PATH` pointing at its `node_modules`; `CHROME` may point at a Chromium binary, otherwise Playwright's own is used) and Python with `requests`. `PLREPO` overrides the repository root (default: the parent of `tests/`).

`ci.sh` serves the repository on port 8765 and, through `fixtures.sh`, the extra "fixture sites" some tests open on 8767–8790 (each one is a symlinked view of the repository; `lgweb` also gets generated test crests from `logo/mk.py`). It runs the tests one by one (a test that fails once and passes on a second try is reported as `FLAKY` with a CI warning, never silently; `TEST_RETRY=0` turns the retry off), prints `passed` / `FAILED` for each (logs in `tests/logs/`), and exits 1 if any failed. A test fails on a non-zero exit, a line starting with `FAIL`, or no `ok` line at all. While testing it removes the photo entries from `data/index.json` (the photo CDN may be unreachable) and restores the file with `git checkout data/index.json` at the end: never commit `data/index.json` from a test run.

`runall.sh` / `runsome.sh` are the older local runners (they print a summary but do not set an exit code).

## CI

`tests.yml` runs a Python job and several browser jobs in parallel (a matrix; the test lists are in the workflow). It rebuilds `index.html` into the job's workspace only. When you add a test, add it to one of the matrix lists. Chromium is cached between runs (keyed by the Playwright version). Debugging copies (`*_dbg*.js`, `*_old.js`, `*_main.js`) are not part of the suite.

## Where things are

- `nf/`: the seven pages of PR #44 (comebacks, likely line-ups, club twins, who carries, report card, league DNA, thrill), with a shared `nf/lib.js`.
- `ph/ui_dlh.js` and `ph/ui_ph.js`: Height (defensive line) and Pressing.
- `lg/ui_lg.js`: Liquid Glass on the Fantasy tabs and the menu drawer (the copy inside the lens lined up letter by letter with the page, a straight path and its time, two buttons in the lens at once, magnification inside the glass only, Arabic words, press, drag and let go with a mouse and a finger, the copy following label and theme changes, reduced motion, a lone button, the drawer closing on arrival).
- `dc/ui_dc.js`: the player card on the Defensive, Shots and Passing pages (values per 90, ratios, roles from the line-ups and percentiles recomputed from `data/` for the six leagues and one league, for the defending, attacking, passing and dribbling cards; bar colour and length, the heat map cells, no average-position dot, the 3-to-8 measure chips, the saved PNG, Arabic, 390 px, leaving early, a failing heat file and league file, a past season).
- `pc/ui_pc.js`: the match pressing card on the Pressing page (the six team numbers and their ranks, the bars' length and colour, heat cells, the players, the PNG, Arabic, 390 px, leaving early, a failing heat file, a past season).
- `sb/ui_sb.js` and `sb/t_press.py`: the Pressing maps page on a hand-made match in StatsBomb's format (no network) with hand-worked counts, the player card recomputed from `data/sb_press.json`, the logo and terms, and the offline builder on the same fixture.
- `nf/ui_rc.js` also recomputes the Model against the bookmakers card from `data/market.json`, and checks that a missing odds file leaves the report card whole.
- `stab/t_stab.py` and `stab/ui_stab.js`: the stat stability step of the sync (rank and correlation helpers on worked cases, per-90 and odd/even halves on made-up rows, made-up players with a known answer, the real Premier League seasons worked again with a second implementation, the write / skip / failure behaviour) and the page (every row, number, order, reading and note against `data/stability.json`, the group and "all players" choices, Arabic, 390 px, leaving early, a failing file).
- `pri/t_priors.py`: last season's strengths (`data/priors.json`): the sync step on a small made-up league worked by hand, the real past seasons worked again with a second implementation, the write / skip / failure behaviour. `nf/ui_rc.js` also scores model 2 (priors) against model 1, the bookmakers and the base rates, and checks `priors.json` again from the past season's files.
- `mk/t_market.py`: the sync's market and Elo steps (football-data.co.uk odds, ClubElo) on stubbed downloads with real team names: spelling aliases for all six leagues, de-vigging, column order, matching rules, write/skip/failure behaviour.
- Other folders hold one area of the site each. A test usually recomputes the page's numbers independently from the raw files in `data/` and compares them with what the page shows.
- `stub/`: a fake `pitchapi` module for the Python tests of sync sections.
- `ps/t_ps.py`: past seasons (sync section): per-run cap, one request per endpoint per match, resuming from the published files, index manifest, plan refusals (`cd tests/ps && python3 t_ps.py`).
- `ps/ui_ps.js` and `ps/ui_ps_crawl.js`: the season selector, banner, guarded pages, Arabic and a 390 px phone, and every page opened in the first past season listed in `data/index.json`.
- `trk/t_py.py`: the track record (sync section): the prediction saved before the deadline, unchanged data, an update before the deadline, locked after it, and a new season. It takes the live `data/fpl.json` and moves the next deadline to two days from now, so it does not depend on the date or on which gameweek is next.

## Notes

- Expected values are read from `data/` at run time. A check must not hard-code a value that a sync can change, and must not assume whether a match is played today.
- `ph/ui_dlh.js` reads the measured competitions from `data/dlh.json` (the raw StatsBomb files are not in the repository).
- External images (cdn.pitchapi.dev) may or may not load; the console-error filters ignore `ERR_TUNNEL_CONNECTION_FAILED` and `cdn.pitchapi`.
- `stub/pitchapi.py` stands in for the `pitchapi` package, so the tests need neither the package nor a key.

The workflow runs on every pull request and can also be started by hand from the Actions tab (Tests, Run workflow).
