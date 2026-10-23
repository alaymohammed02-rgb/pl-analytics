"""Builds the data folder of the "trkweb" fixture site for trk/ui_track.js: a Track record with three saved gameweeks,
GW6 and GW7 already played and GW8 still open (its deadline is two days from now, so the scenario never goes stale).
The saved XIs are the repository's real saved record, copied under the three gameweek numbers; the test recomputes
their points independently from data/fpl.json.
Usage: mk_fixtures.py <fixtures dir>   (trkweb/data already holds symlinks to the repository's data files)"""
import os, sys, json, copy, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FIX = sys.argv[1]
J = lambda f: json.load(open(REPO + '/data/' + f, encoding='utf-8'))

def put(name, obj):
    p = os.path.join(FIX, 'trkweb', 'data', name)
    if os.path.islink(p) or os.path.exists(p):
        os.remove(p)                       # never write through the symlink into the repository
    json.dump(obj, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

t = J('fpl_track.json')
base = t['gws'][sorted(t['gws'], key=int)[-1]]
now = datetime.datetime.now(datetime.timezone.utc).replace(second=0, microsecond=0)
iso = lambda d: d.strftime('%Y-%m-%dT%H:%M:%SZ')
fpl = copy.deepcopy(J('fpl.json'))
ev = {e['id']: e for e in fpl['events']}
# GW8 open (deadline in two days), GW9 after it; GW6 and GW7 as in the real data (played)
ev[8]['dl'] = iso(now + datetime.timedelta(days=2))
ev[9]['dl'] = iso(now + datetime.timedelta(days=9))
gws = {}
for g in (6, 7, 8):
    r = copy.deepcopy(base)
    r['gw'] = g
    r['dl'] = ev[g]['dl']
    gws[str(g)] = r
put('fpl_track.json', {'season': t['season'], 'gws': gws})
put('fpl.json', fpl)
