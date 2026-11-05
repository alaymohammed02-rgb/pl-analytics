# Player roles (data/roles.json, written by tools/roles/fit.py): the file worked again from the raw player files with a second implementation (no numpy): the same
# player-seasons, the same z-scores (to the one decimal the file keeps), every role equal to the nearest frozen centre, the season-to-season numbers, the choice of k.
import json, math, os, collections, random
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
D = os.path.join(REPO, 'data')
J = lambda f: json.load(open(os.path.join(D, f), encoding='utf-8'))
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


R = J('roles.json')
FEAT = R['feat']
ok(len(FEAT) == 18 and R['k'] == len(R['roles']) and R['k'] == max(R['kscan'], key=lambda t: (t[1], -t[0]))[0], 'k = %d is the k whose half clusterings agree most, as the rule says' % R['k'])
ok(os.path.getsize(os.path.join(D, 'roles.json')) < 400 * 1024, 'the file is under 400 KB')
sj = J('seasons.json')['leagues']
ix = J('index.json')
names = {l['id']: l['name'] for l in ix['leagues']}
lids = [l['id'] for l in ix['leagues'] if l.get('pl_file') and l['id'] in sj and names[l['id']] in R['lg']]
lids = sorted(lids, key=lambda i: R['lg'].index(names[i]))
ok([names[i] for i in lids] == R['lg'], 'the six leagues are in the file in the index order')
recs = {}
for li, lid in enumerate(lids):
    for si, s in enumerate(R['seasons']):
        f = ((sj[lid]['seasons'].get(s) or {}).get('files') or {}).get('pl_file')
        if not f or not os.path.exists(os.path.join(D, f)):
            continue
        pl = J(f)
        c = {k: i for i, k in enumerate(pl['cols'])}
        by = {}
        for r in pl['rows']:
            mi = r[c['mi']]
            if not mi:
                continue
            a = by.setdefault(r[c['i']], {'mi': 0, 'xm': 0, 'club': collections.Counter(), 'pos': collections.Counter(), 'name': r[c['n']], 's': {k: 0 for k in FEAT}})
            a['mi'] += mi
            a['club'][r[c['c']]] += mi
            if r[c['o']]:
                a['pos'][r[c['o']]] += mi
            if r[c['xag']] is not None:
                a['xm'] += mi
            for k in FEAT:
                if r[c[k]] is not None:
                    a['s'][k] += r[c[k]]
        for pid, a in by.items():
            if a['mi'] < R['min_show'] or not a['pos']:
                continue
            pos = a['pos'].most_common(1)[0][0]
            if pos == 'GK' or a['xm'] < a['mi'] * 0.5:
                continue
            v = [math.sqrt(max(0, a['s'][k]) * 90 / (a['xm'] if k == 'xag' else a['mi'])) for k in FEAT]
            recs[(pid, si)] = {'lg': li, 'mi': a['mi'], 'v': v, 'pos': pos, 'club': a['club'].most_common(1)[0][0], 'name': a['name']}
mine = {}
for pid, L in R['p'].items():
    for e in L:
        mine[(pid, e[0])] = e
ok(set(mine) == set(recs), 'the same %d player-seasons as a recount from the raw files (outfield, 450+ minutes, xAG minutes at least half)' % len(recs))
# z-scores against the league-season's 900+ players
stat = {}
for (si, li) in {(k[1], r['lg']) for k, r in recs.items()}:
    base = [r['v'] for k, r in recs.items() if k[1] == si and r['lg'] == li and r['mi'] >= R['min_fit']]
    mu = [sum(x[i] for x in base) / len(base) for i in range(len(FEAT))]
    sd = [math.sqrt(sum((x[i] - mu[i]) ** 2 for x in base) / len(base)) or 1 for i in range(len(FEAT))]
    stat[(si, li)] = (mu, sd)
bad = 0
for k, r in recs.items():
    mu, sd = stat[(k[1], r['lg'])]
    z = [(r['v'][i] - mu[i]) / sd[i] for i in range(len(FEAT))]
    r['z'] = z
    if any(abs(round(z[i] * 10) - mine[k][8][i]) > 1 for i in range(len(FEAT))):
        bad += 1
ok(bad == 0, 'every z-score equals the file\'s to 0.1 (%d differ)' % bad)
ok(all(mine[k][2] == r['club'] and mine[k][3] == r['pos'] and mine[k][4] == round(r['mi']) and mine[k][1] == r['lg'] for k, r in recs.items()), 'club, position, minutes and league of every row equal the recount')
# roles = nearest frozen centre (centres are rounded to 2 decimals in the file: rows with a clear margin must agree)
C = [r['z'] for r in R['roles']]
d2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
wrong = clear = 0
for k, r in recs.items():
    ds = sorted((d2(r['z'], c), j) for j, c in enumerate(C))
    if ds[1][0] - ds[0][0] > 0.05:
        clear += 1
        wrong += ds[0][1] != mine[k][5]
ok(clear > 0.95 * len(recs) and wrong == 0, 'every role is the nearest centre (%d of %d rows with a clear margin, %d wrong)' % (clear, len(recs), wrong))
ok(all(r['n'] == sum(1 for k, e in mine.items() if k[1] == 0 and e[4] >= R['min_fit'] and e[5] == r['id']) for r in R['roles']), 'the size of each role = its 2024-25 players with 900+ minutes')
# season to season
pairs = [(mine[(p, 0)][5], mine[(p, 1)][5]) for (p, s) in mine if s == 0 and (p, 1) in mine and mine[(p, 0)][4] >= R['min_fit'] and mine[(p, 1)][4] >= R['min_fit']]
n = len(pairs)
po = sum(a == b for a, b in pairs) / n
pa, pb = collections.Counter(a for a, b in pairs), collections.Counter(b for a, b in pairs)
pe = sum(pa[k] * pb[k] for k in pa) / n / n
T = R['test']
ok(T['pairs'] == n and abs(T['agree'] - po) < 1e-3 and abs(T['chance'] - pe) < 1e-3 and abs(T['kappa'] - (po - pe) / (1 - pe)) < 1e-3, 'season to season: %d players, %.1f%% same role, chance %.1f%%, kappa %.3f' % (n, po * 100, pe * 100, (po - pe) / (1 - pe)))
ok(T['kappa_lo'] < T['kappa'] < T['kappa_hi'] and T['kappa_lo'] > 0, 'kappa interval brackets kappa and excludes 0')
ok(T['h_kappa'] > 0 and T['halves'] > 300 and T['fit'] == sum(r['n'] for r in R['roles']), 'odd against even: kappa %.2f over %d players; the fit has %d players' % (T['h_kappa'], T['halves'], T['fit']))
print('%d FAILED' % fails if fails else 'all passed')
raise SystemExit(1 if fails else 0)
