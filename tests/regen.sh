#!/bin/sh
set -e
cd "$(dirname "$0")"
python3 gen_index.py /home/user/pl-analytics/sync.py /home/user/pl-analytics/index.html | tail -1
python3 - <<'PY'
import sys,importlib.util
sys.path.insert(0,'stub')
spec=importlib.util.spec_from_file_location("m","/home/user/pl-analytics/sync.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
h=open('/home/user/pl-analytics/index.html',encoding='utf-8').read()
s=h.index(m._X_FPJS[:80]);e=h.index('/* ===== Fantasy seasons:')
open('fp_v2.js','w').write(h[s:e])
PY
python3 - <<'PY'
h=open('/home/user/pl-analytics/index.html',encoding='utf-8').read()
s=h.index('/* ===== Season review:');e=min(i for i in (h.find('\nasync function route(){',s),h.find('/* =====',s+10)) if i>0)
open('fp_sr.js','w').write(open('fp_v2.js').read()+'\n'+h[s:e])
PY
