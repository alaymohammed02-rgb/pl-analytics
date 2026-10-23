"""Builds the data folder of the "labweb" fixture site for lab/ui_lab.js: the repository's data plus a sample model record
for GW7 (the model predicts 3.0 points for every player, saved before the GW7 deadline), which the test uses to check that
the Lab keeps the model's figure apart from the user's prediction. A test fixture, not a real prediction.
Usage: mk_fixtures.py <fixtures dir>   (labweb/data already holds symlinks to the repository's data files)"""
import os, sys, json, copy
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FIX = sys.argv[1]
J = lambda f: json.load(open(REPO + '/data/' + f, encoding='utf-8'))
t = J('fpl_track.json')
fpl = J('fpl.json')
base = t['gws'][sorted(t['gws'], key=int)[-1]]
r = copy.deepcopy(base)
r['gw'] = 7
r['dl'] = '2026-10-17T10:00:00Z'
r['saved'] = '2026-10-16 12:00:00'
r['preds'] = {str(row[0]): 3.0 for row in fpl['rows']}
gws = dict(t['gws'])
gws['7'] = r
p = os.path.join(FIX, 'labweb', 'data', 'fpl_track.json')
if os.path.islink(p) or os.path.exists(p):
    os.remove(p)                        # never write through the symlink into the repository
json.dump({'season': t['season'], 'gws': gws}, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
