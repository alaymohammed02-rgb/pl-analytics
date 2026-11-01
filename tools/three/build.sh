#!/bin/sh
# Rebuilds assets/vendor/three-st3.js: a tree-shaken, minified ES module with only the three.js classes that assets/stadium-gl.js imports.
# Needs network for npm (not part of the sync or the tests). Run from the repository root:  sh tools/three/build.sh
set -e
V=0.187.0
R="$(cd "$(dirname "$0")/../.." && pwd)"
W="$(mktemp -d)"
NAMES=$(grep -m1 "^import {" "$R/assets/stadium-gl.js" | sed 's/^import {\(.*\)} from.*/\1/')
echo "export {$NAMES} from 'three';" > "$W/entry.js"
cd "$W" && npm init -y >/dev/null && npm i --silent esbuild three@$V
npx esbuild entry.js --bundle --minify --format=esm --legal-comments=none --outfile=out.js
{ echo "/* three.js r${V#0.}, MIT licence (https://github.com/mrdoob/three.js/blob/dev/LICENSE), tree-shaken to the classes assets/stadium-gl.js imports. Rebuild: sh tools/three/build.sh */"; cat out.js; } > "$R/assets/vendor/three-st3.js"
cp "$W/node_modules/three/LICENSE" "$R/assets/vendor/LICENSE-three.txt"
# the import in stadium-gl.js carries the file's hash, so a browser never keeps an old copy
H=$(sha1sum "$R/assets/vendor/three-st3.js" | cut -c1-8)
sed -i "s#from './vendor/three-st3.js[^']*'#from './vendor/three-st3.js?v=$H'#" "$R/assets/stadium-gl.js"
wc -c "$R/assets/vendor/three-st3.js"; gzip -9 -c "$R/assets/vendor/three-st3.js" | wc -c
