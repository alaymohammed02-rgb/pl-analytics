# Sourced by ci.sh. The tests of some pages open the site on extra ports (a "fixture site" per area).
# In the original working folder these were hand-made copies; here each one is a view of the repository (symlinks),
# so a fixture always matches the files under test. lgweb (logos) gets its own data folder with generated crests.
FIX="${FIXTURES_DIR:-$S/fixtures_tmp}"
rm -rf "$FIX"; mkdir -p "$FIX"
view(){ mkdir -p "$FIX/$1"; for f in index.html assets data sw.js manifest.webmanifest data.json; do [ -e "$R/$f" ] && ln -s "$R/$f" "$FIX/$1/$f"; done; }
for n in base3 trkweb cmpweb labweb preweb mainnow; do view $n; done
# cmpweb / preweb: own data folders (links to every repository data file) so their europe / fixtures / champions files can be replaced
for n in cmpweb preweb; do rm "$FIX/$n/data"; mkdir -p "$FIX/$n/data"; for f in "$R"/data/*; do ln -s "$f" "$FIX/$n/data/$(basename "$f")"; done; done
python3 "$S/cmp/mk_fixtures.py" "$FIX"
rm "$FIX/trkweb/data"; mkdir -p "$FIX/trkweb/data"; for f in "$R"/data/*; do ln -s "$f" "$FIX/trkweb/data/$(basename "$f")"; done
python3 "$S/trk/mk_fixtures.py" "$FIX"
export FIXTURES_DIR="$FIX"
# homeweb keeps the photo entries in data/index.json (the home test checks the photo files); the other sites use the stripped index
mkdir -p "$FIX/homeweb/data"; for f in index.html assets sw.js manifest.webmanifest data.json; do [ -e "$R/$f" ] && ln -s "$R/$f" "$FIX/homeweb/$f"; done
for f in "$R"/data/*; do b=$(basename "$f"); [ "$b" = index.json ] || ln -s "$f" "$FIX/homeweb/data/$b"; done
python3 - "$PRISTINE_INDEX" "$FIX/homeweb/data/index.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
for l in d['leagues']:
    if l['id']=='l_0ErfuF':          # the home test expects LaLiga without a photo file
        l.pop('photo_file',None);l.pop('photo_v',None)
json.dump(d,open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
PY
# lgweb: own data folder = links to every repository data file, except index.json which mk.py rewrites with logo entries
mkdir -p "$FIX/lgweb/data"; for f in index.html assets sw.js manifest.webmanifest data.json; do [ -e "$R/$f" ] && ln -s "$R/$f" "$FIX/lgweb/$f"; done
for f in "$R"/data/*; do b=$(basename "$f"); case "$b" in index.json|logos_*) ;; *) ln -s "$f" "$FIX/lgweb/data/$b";; esac; done
(cd "$FIX" && python3 "$S/logo/mk.py" >/dev/null)
for pair in "base3:8767" "trkweb:8770" "lgweb:8771" "cmpweb:8772" "labweb:8773" "preweb:8775" "homeweb:8777" "mainnow:8790" "cmpweb:8774"; do serve "$FIX/${pair%:*}" "${pair##*:}"; done
