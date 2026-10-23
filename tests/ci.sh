#!/bin/bash
# CI runner: ci.sh test1.js test2.py ...   (paths relative to tests/)
# Serves the repository on :8765 (and the fixture sites from tests/fixtures.sh), runs each test, exits 1 if any failed.
# A browser test fails on a non-zero exit or any line starting with FAIL; a Python test the same.
S="$(cd "$(dirname "$0")" && pwd)"
R="${PLREPO:-$(cd "$S/.." && pwd)}"; export PLREPO="$R"
if [ -z "$NODE_PATH" ] && [ -d "$R/node_modules" ]; then export NODE_PATH="$R/node_modules"; fi
cd "$S"
PIDS=""
cleanup(){ kill $PIDS 2>/dev/null; git -C "$R" checkout data/index.json 2>/dev/null; }
trap cleanup EXIT
PRISTINE_INDEX="$(mktemp)"; cp "$R/data/index.json" "$PRISTINE_INDEX"; export PRISTINE_INDEX
# the photo CDN may be unreachable: hide the photo entry from the index while testing (restored on exit, never committed)
python3 - <<PY
import json;p='$R/data/index.json';d=json.load(open(p))
for l in d['leagues']:l.pop('photo_file',None);l.pop('photo_v',None)
json.dump(d,open(p,'w'),ensure_ascii=False,separators=(',',':'))
PY
serve(){ (cd "$1" && exec python3 -m http.server "$2" >/dev/null 2>&1) & PIDS="$PIDS $!"; }
serve "$R" 8765
[ -f "$S/fixtures.sh" ] && . "$S/fixtures.sh"
sleep 2
LOGDIR="${TEST_LOGS:-$S/logs}"; mkdir -p "$LOGDIR"
bad=0
run_one(){
  t="$1"; log="$2"
  case "$t" in
    *.py) (cd "$(dirname "$t")" && timeout 900 python3 "$(basename "$t")") > "$log" 2>&1 ;;
    *) timeout 900 node "$t" > "$log" 2>&1 ;;
  esac
  rc=$?
  nf=$(grep -c '^FAIL' "$log"); nok=$(grep -c '^ok' "$log")
  [ $rc -eq 0 ] && [ "$nf" -eq 0 ] && [ "$nok" -gt 0 ]
}
for t in "$@"; do
  log="$LOGDIR/$(echo "$t" | tr '/' '_').log"
  s=$(date +%s)
  if run_one "$t" "$log"; then
    echo "passed  $t ($(grep -c '^ok' "$log") ok, $(( $(date +%s)-s ))s)"
  else
    # a browser test that fails once and then passes is reported as flaky, not hidden; a test that fails twice fails the job
    first="$(grep -E '^FAIL|Error|Traceback' "$log" | head -3)"
    cp "$log" "$log.first"
    if [ "${TEST_RETRY:-1}" = 1 ] && run_one "$t" "$log"; then
      echo "passed  $t on the second try ($(grep -c '^ok' "$log") ok, $(( $(date +%s)-s ))s); FLAKY, first try: $first" | tr '\n' ' '; echo
      [ -n "$GITHUB_ACTIONS" ] && echo "::warning::flaky test $t passed only on the second try"
    else
      bad=$((bad+1)); echo "FAILED  $t ($(grep -c '^FAIL' "$log") FAIL lines, $(grep -c '^ok' "$log") ok lines, $(( $(date +%s)-s ))s)"; grep -E '^FAIL|Error|Traceback' "$log" | head -12
    fi
  fi
done
echo "$bad failed"
[ $bad -eq 0 ]
