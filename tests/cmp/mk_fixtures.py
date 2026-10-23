"""Builds the data folders of the two "cmp" fixture sites from the repository's own data:
   cmpweb: the real files with a fixed European / champions / fixtures scenario that tests/cmp/ui_cmp.js checks
           (the real files change with every sync; this scenario does not, and its dates are relative to today);
   preweb: the repository as it is before the first sync: empty europe / fixtures / champions files.
Usage: mk_fixtures.py <fixtures dir>   (each site folder already holds symlinks to the repository's files)"""
import os, sys, json, copy, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FIX = sys.argv[1]
D = REPO + '/data/'
J = lambda f: json.load(open(D + f, encoding='utf-8'))

def put(site, name, obj):
    p = os.path.join(FIX, site, 'data', name)
    if os.path.islink(p) or os.path.exists(p):
        os.remove(p)                     # never write through the symlink into the repository
    json.dump(obj, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---- europe: the clubs the test lists, whatever the real competitions look like today
eu = copy.deepcopy(J('europe.json'))
comp = {c['key']: c for c in eu['comps']}
for c in comp.values():
    c['teams'] = [t for t in c['teams'] if t not in ('Nottingham Forest', 'Crystal Palace', 'Chelsea')]
for t in ('Arsenal', 'Manchester City', 'Liverpool', 'Aston Villa', 'Manchester United', 'Paris Saint-Germain'):
    for c in comp.values():
        if t in c['teams'] and c is not comp['ucl']:
            c['teams'].remove(t)
    if t not in comp['ucl']['teams']:
        comp['ucl']['teams'].append(t)
comp['uel']['teams'].append('Nottingham Forest')
comp['uecl']['teams'].append('Crystal Palace')
for c in comp.values():
    c['teams'].sort()
put('cmpweb', 'europe.json', eu)

# ---- champions: Nottingham Forest hold the Europa League, PSG won the 2025-26 Champions League final, Argentina are World Cup holders
ch = copy.deepcopy(J('champions.json'))
ch['leagues']['l_38d9HA'] = dict(season='2025-26', next='2026-27', kind='cup', name='Europa League', src='test scenario', team='Nottingham Forest', final='Test scenario', date='2026-05-20', runner_up='Test')
ch['leagues']['l_2WZ2tt'] = dict(season='2025-26', next='2026-27', kind='cup', name='Conference League', src='test scenario', team='Rayo Vallecano', final='Test scenario', date='2026-05-27', runner_up='Test')
ch['leagues']['l_0bfbkO'] = dict(season='2025-26', next='2026-27', kind='cup', name='Champions League', src='test scenario', team='Paris Saint-Germain', final='Test scenario', date='2026-05-30', runner_up='Test')
ch['leagues']['l_1XLtP0'] = dict(season='2022', next='2026', kind='cup', name='World Cup', src='test scenario', team='Argentina', final='Test scenario', date='2022-12-18', runner_up='Test')
put('cmpweb', 'champions.json', ch)

# ---- fixtures: three match days ahead (dates relative to today, so the scenario never goes stale)
day = lambda n: (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=n)).strftime('%Y-%m-%d')
d1, d2, d3 = day(1), day(9), day(16)
fx = copy.deepcopy(J('fixtures.json'))
fx['leagues']['l_4WFCIZ'] = [
    dict(i='t_1', d=d1, k=d1 + 'T11:30:00Z', h='Aston Villa', a='Manchester City'),
    dict(i='t_2', d=d1, k=d1 + 'T14:00:00Z', h='Arsenal', a='Everton'),
    dict(i='t_3', d=d2, k=d2 + 'T16:30:00Z', h='Liverpool', a='Arsenal'),
    dict(i='t_4', d=d3, h='Chelsea', a='Fulham'),          # no kick-off time
]
put('cmpweb', 'fixtures.json', fx)

# ---- before the first sync
put('preweb', 'europe.json', {'comps': []})
put('preweb', 'champions.json', {'leagues': {}})
put('preweb', 'fixtures.json', {'leagues': {}})
