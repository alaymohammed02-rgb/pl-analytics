# Tests

Browser tests (Playwright, Chromium) and Python tests for the site, moved here from a temporary working folder so they are not lost. They are not yet wired to GitHub Actions; that is the next step (see `CLAUDE.md`).

## Run

```sh
sh tests/regen.sh                         # rebuild index.html from sync.py (gen_index.py)
JS="nf/ui_gs.js ph/ui_dlh.js" bash tests/runsome.sh   # some browser tests
bash tests/runall.sh > all.log 2>&1       # everything (about 40 minutes)
```

`runsome.sh` / `runall.sh` serve the repository on port 8765 and the fixture sites (`base3`, `trkweb`, `lgweb`, `cmpweb`, `labweb`, `preweb`, `homeweb`) on 8767–8777, then stop them. While testing they remove the photo entries from `data/index.json` (the test machine cannot reach the photo CDN) and restore the file with `git checkout data/index.json` at the end: never commit `data/index.json` from a test run.

## Where things are

- `nf/`: the seven pages of PR #44 (comebacks, likely line-ups, club twins, who carries, report card, league DNA, thrill), with a shared `nf/lib.js`.
- `ph/ui_dlh.js` and `ph/ui_ph.js`: Height (defensive line) and Pressing.
- Other folders hold one area of the site each. A test usually recomputes the page's numbers independently from the raw files in `data/` and compares them with what the page shows.
- `stub/`: a fake `pitchapi` module for the Python tests of sync sections.

## Known issues to fix when wiring CI

- Paths are absolute in places:
  - `/home/user/pl-analytics`
  - the Playwright install `/opt/node-tools/node_modules/playwright`
  - Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  - ten files still point to the old temporary folder (`grep -rl /tmp/claude-0 tests`)
- `ph/ui_dlh.js` reads `ext/sb_lines.json`, which is not in the repository (StatsBomb terms: no raw-data redistribution). Rebuild it with `tools/line-height/` or switch the test to `data/dlh.json`.
- Some older tests depend on the date or on fixed values in live data. For example, `px/ui_px.js` expects no match today, so it fails on match days and on `main` as well. Make them read the expected values from `data/`.
- External images (cdn.pitchapi.dev) cannot be loaded on the test machine. The console-error filters ignore `ERR_TUNNEL_CONNECTION_FAILED` and `cdn.pitchapi`.
- `ui_season.js`, `ui_test.js` and `ui_ar.js` print `ok` lines and FAIL lines but no final "all passed" line.
