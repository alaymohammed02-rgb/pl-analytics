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

`tests.yml` runs a Python job and several browser jobs in parallel (a matrix; the test lists are in the workflow). It rebuilds `index.html` into the job's workspace only. When you add a test, add it to one of the matrix lists.

## Where things are

- `nf/`: the seven pages of PR #44 (comebacks, likely line-ups, club twins, who carries, report card, league DNA, thrill), with a shared `nf/lib.js`.
- `ph/ui_dlh.js` and `ph/ui_ph.js`: Height (defensive line) and Pressing.
- Other folders hold one area of the site each. A test usually recomputes the page's numbers independently from the raw files in `data/` and compares them with what the page shows.
- `stub/`: a fake `pitchapi` module for the Python tests of sync sections.
- `ps/t_ps.py`: past seasons (sync section): per-run cap, one request per endpoint per match, resuming from the published files, index manifest, plan refusals (`cd tests/ps && python3 t_ps.py`).
- `ps/ui_ps.js` and `ps/ui_ps_crawl.js`: the season selector, banner, guarded pages, Arabic and a 390 px phone, and every page opened in the first past season listed in `data/index.json`.

## Notes

- Expected values are read from `data/` at run time. A check must not hard-code a value that a sync can change, and must not assume whether a match is played today.
- `ph/ui_dlh.js` reads the measured competitions from `data/dlh.json` (the raw StatsBomb files are not in the repository).
- External images (cdn.pitchapi.dev) may or may not load; the console-error filters ignore `ERR_TUNNEL_CONNECTION_FAILED` and `cdn.pitchapi`.
- `stub/pitchapi.py` stands in for the `pitchapi` package, so the tests need neither the package nor a key.

The workflow runs on every pull request and can also be started by hand from the Actions tab (Tests, Run workflow).
