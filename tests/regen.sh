#!/bin/sh
# Rebuild index.html from sync.py (into the repository checkout; never commit the result from a test run).
set -e
cd "$(dirname "$0")"
R="${PLREPO:-$(cd .. && pwd)}"; export R
python3 gen_index.py "$R/sync.py" "$R/index.html" | tail -1
python3 - <<'PY'
import os,sys,importlib.util
R=os.environ['R']
sys.path.insert(0,REPO+'/tests/stub')
spec=importlib.util.spec_from_file_location("m",R+"/sync.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
h=open(R+'/index.html',encoding='utf-8').read()
s=h.index(m._X_FPJS[:80]);e=h.index('/* ===== Fantasy seasons:')
open('fp_v2.js','w').write(h[s:e])
PY
python3 - <<'PY'
import os
R=os.environ['R']
h=open(R+'/index.html',encoding='utf-8').read()
s=h.index('/* ===== Season review:');e=min(i for i in (h.find('\nasync function route(){',s),h.find('/* =====',s+10)) if i>0)
open('fp_sr.js','w').write(open('fp_v2.js').read()+'\n'+h[s:e])
PY
