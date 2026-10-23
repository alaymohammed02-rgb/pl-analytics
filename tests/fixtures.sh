# Sourced by ci.sh. The tests of some pages open the site on extra ports (a "fixture site" per area).
# In the original working folder these were hand-made copies; here each one is a view of the repository (symlinks),
# so a fixture always matches the files under test. lgweb (logos) gets its own data folder with generated crests.
FIX="${FIXTURES_DIR:-$S/fixtures_tmp}"
rm -rf "$FIX"; mkdir -p "$FIX"
view(){ mkdir -p "$FIX/$1"; for f in index.html assets data sw.js manifest.webmanifest data.json; do [ -e "$R/$f" ] && ln -s "$R/$f" "$FIX/$1/$f"; done; }
for n in base3 trkweb cmpweb labweb preweb homeweb mainnow; do view $n; done
# lgweb: own data folder = links to every repository data file, except index.json which mk.py rewrites with logo entries
mkdir -p "$FIX/lgweb/data"; for f in index.html assets sw.js manifest.webmanifest data.json; do [ -e "$R/$f" ] && ln -s "$R/$f" "$FIX/lgweb/$f"; done
for f in "$R"/data/*; do b=$(basename "$f"); case "$b" in index.json|logos_*) ;; *) ln -s "$f" "$FIX/lgweb/data/$b";; esac; done
(cd "$FIX" && python3 "$S/logo/mk.py" >/dev/null)
for pair in "base3:8767" "trkweb:8770" "lgweb:8771" "cmpweb:8772" "labweb:8773" "preweb:8775" "homeweb:8777" "mainnow:8790" "cmpweb:8774"; do serve "$FIX/${pair%:*}" "${pair##*:}"; done
