# Prediction ledger (the block between "LEDGER START" and "LEDGER END" in sync.py): on the real data/ files, every prediction is worked out again with a second
# implementation written differently (Elo from data/elo_own.json, the xG model 2 from the league and shot files and data/priors.json, the XI model from data/xib.json and
# each club's latest line-up, the average, the base rates from data/results.json); then the rules: a prediction follows the data while its kick-off is ahead and never
# changes after it, results and closing odds are added only to locked predictions with the same two teams, a fixture that leaves the list is dropped only while unlocked,
# and the step writes only when something changed.
import os, re, sys, json, math, hashlib, datetime, copy
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
PUT = []
G = {'os': os, 're': re, 'json': json, 'math': math, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: None, 'run_pipeline': lambda h, k: True}
for a, b in (('# ===== ELO2 START =====', '# ===== ELO2 END ====='), ('# ===== XIB START =====', '# ===== XIB END ====='), ('# ===== LEDGER START =====', '# ===== LEDGER END =====')):
    exec(src[src.index(a):src.index(b)], G)
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


def J(p):
    try:
        return json.load(open(os.path.join(REPO, p), encoding='utf-8'))
    except Exception:
        return None


CACHE = {}


def get(p):
    if p not in CACHE:
        CACHE[p] = J(p)
    return copy.deepcopy(CACHE[p])


utc = datetime.timezone.utc
IDX = J('data/index.json')
FX = J('data/fixtures.json')['leagues']
LGS = ("l_4WFCIZ", "l_0ErfuF", "l_1Isor4", "l_3FJFUl", "l_0ALvwF", "l_4QexZg")
# "now" = a moment before the first coming fixture, so the test does not depend on the day it runs
ks = sorted(f['k'] for l in LGS for f in FX.get(l) or [])
first = min(k for k in ks if k >= J('data/elo_own.json')['leagues']['l_4WFCIZ']['last'])
NOW = datetime.datetime.strptime(first[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=utc) - datetime.timedelta(hours=6)
L0 = G['ldg_step'](get, NOW, {})
P = L0['p']
ok(len(P) >= 30, f'{len(P)} predictions for the fixtures of the next 8 days from {NOW:%Y-%m-%d %H:%M}')
ok(all(v['lg'] in LGS for v in P.values()), 'only the six domestic leagues (no Champions League)')
win = NOW + datetime.timedelta(days=8)
want = {f['i'] for l in LGS for f in FX.get(l) or [] if NOW < datetime.datetime.strptime(f['k'][:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=utc) <= win}
ok(set(P) == want, f'exactly the fixtures with a kick-off in the next 8 days ({len(want)})')

# ---- second implementation: Elo
E = J('data/elo_own.json')
bad = []
for mid, v in P.items():
    T = E['leagues'][v['lg']]['teams']
    x = (T[v['h']]['r'] - T[v['a']]['r'] + E['params']['H']) / E['params']['s']
    sig = lambda z: 1 / (1 + math.exp(-z))
    want3 = [sig(x - E['params']['c']), None, 1 - sig(x + E['params']['c'])]
    want3[1] = 1 - want3[0] - want3[2]
    if max(abs(a - b) for a, b in zip(v['e'], want3)) > 6e-5:
        bad.append(mid)
ok(not bad, f'Elo: all {len(P)} match ordered logit of (home rating − away rating + {E["params"]["H"]}) / {E["params"]["s"]}' + (f' — {bad[:3]}' if bad else ''))


# ---- second implementation: the xG model 2, written with plain loops over dicts
def poisson_table(lam):
    return [math.exp(-lam) * lam ** k / math.factorial(k) for k in range(11)]


def model2(lid, h, a):
    meta = next(l for l in IDX['leagues'] if l['id'] == lid)
    lgf, sh, pri = J('data/' + meta['file']), J('data/' + meta['sh_file']), (J('data/priors.json')['leagues'] or {}).get(lid)
    cols = sh['cols']
    team_xg = {}
    for r in sh['rows']:
        d = dict(zip(cols, r))
        if d['og']:
            continue
        xg = d['xg'] if isinstance(d['xg'], (int, float)) else 0.0
        team_xg[d['m'] + '|' + d['c']] = team_xg.get(d['m'] + '|' + d['c'], 0.0) + xg
    games = []
    for m in lgf['matches']:
        if not re.fullmatch(r'\d+\s*[-–:]\s*\d+', str(m.get('s') or '').strip()) or not m.get('d'):
            continue
        k1, k2 = m['i'] + '|' + m['h'], m['i'] + '|' + m['a']
        if k1 in team_xg and k2 in team_xg:
            games.append((m['h'], m['a'], team_xg[k1], team_xg[k2]))
    if len(games) < 10:
        return None
    home_avg = sum(g[2] for g in games) / len(games)
    away_avg = sum(g[3] for g in games) / len(games)
    mu = (home_avg + away_avg) / 2
    start = {}
    if pri and pri.get('mu', 0) > 0:
        for t, (n0, f0, a0) in pri['teams'].items():
            if n0 >= 10:
                start[t] = ((f0 + 3 * pri['mu']) / (n0 + 3) / pri['mu'], (a0 + 3 * pri['mu']) / (n0 + 3) / pri['mu'])
    w = 12 if start else 3

    def strength(t):
        mine = [(g[2], g[3]) for g in games if g[0] == t] + [(g[3], g[2]) for g in games if g[1] == t]
        if not start and len(mine) < 3:
            return None
        s0 = start.get(t, (1.0, 1.0))
        return ((sum(x[0] for x in mine) + w * mu * s0[0]) / (len(mine) + w) / mu, (sum(x[1] for x in mine) + w * mu * s0[1]) / (len(mine) + w) / mu)
    x, y = strength(h), strength(a)
    if not x or not y:
        return None
    th, ta = poisson_table(home_avg * x[0] * y[1]), poisson_table(away_avg * y[0] * x[1])
    out = [0.0, 0.0, 0.0]
    for i in range(11):
        for j in range(11):
            out[0 if i > j else 1 if i == j else 2] += th[i] * ta[j]
    s = sum(out)
    return [q / s for q in out]


bad = [mid for mid, v in P.items() if (model2(v['lg'], v['h'], v['a']) is None) != (v['m2'] is None) or (v['m2'] and max(abs(a - b) for a, b in zip(v['m2'], model2(v['lg'], v['h'], v['a']))) > 6e-5)]
ok(not bad, f'xG model 2: all {len(P)} worked again with a second implementation' + (f' — {bad[:3]}' if bad else ''))

# ---- second implementation: the XI model, each club's latest official XI
X = J('data/xib.json')
b = X['params']['b']


def latest_xi(lid, club):
    meta = next(l for l in IDX['leagues'] if l['id'] == lid)
    lgf, mx = J('data/' + meta['file']), J('data/' + meta['mx_file'])['m']
    best = None
    for m in lgf['matches']:
        if club not in (m.get('h'), m.get('a')) or not m.get('d'):
            continue
        side = 'h' if m['h'] == club else 'a'
        xi = ((mx.get(m['i']) or {}).get('lu') or {}).get(side, {}).get('xi')
        if isinstance(xi, list) and len(xi) == 11 and (best is None or (str(m['d']), m['i']) > best[0]):
            best = ((str(m['d']), m['i']), xi)
    return best


def player(e):
    r = X['p'].get(e[0])
    if r:
        return r[:3]
    s = int(e[3])
    g = 'GK' if s == 11 else 'DF' if s < 50 else 'MF' if s < 100 else 'FW'
    return [X['mu']['att'].get(g, 0.15), X['mu']['team'], X['mu']['team']]


def xi_model(lid, h, a):
    A, B = latest_xi(lid, h), latest_xi(lid, a)
    if not A or not B:
        return None, None
    ra, rb = [player(e) for e in A[1]], [player(e) for e in B[1]]
    att = lambda r: max(sum(x[0] for x in r), 1e-3)
    f = lambda r: max(sum(x[1] for x in r) / 11, 1e-3)
    ag = lambda r: max(sum(x[2] for x in r) / 11, 1e-3)
    lh = math.exp(b[0] + b[1] + b[2] * math.log(att(ra)) + b[3] * math.log(f(ra)) + b[4] * math.log(ag(rb)))
    la = math.exp(b[0] + b[2] * math.log(att(rb)) + b[3] * math.log(f(rb)) + b[4] * math.log(ag(ra)))
    th, ta = poisson_table(lh), poisson_table(la)
    out = [0.0, 0.0, 0.0]
    for i in range(11):
        for j in range(11):
            out[0 if i > j else 1 if i == j else 2] += th[i] * ta[j]
    s = sum(out)
    return [q / s for q in out], [A[0][0][:10], B[0][0][:10]]


bad, nxi = [], 0
for mid, v in P.items():
    p, d = xi_model(v['lg'], v['h'], v['a'])
    if p:
        nxi += 1
    if (p is None) != (v['xi'] is None) or (p and (max(abs(x - y) for x, y in zip(p, v['xi'])) > 6e-5 or d != v['xd'])):
        bad.append(mid)
ok(not bad and nxi >= len(P) * 0.9, f'XI model: {nxi} of {len(P)} worked again from each club\'s latest official XI (and its date)' + (f' — {bad[:3]}' if bad else ''))
bad = [mid for mid, v in P.items() if (v['bl'] is None) != (v['e'] is None or v['xi'] is None) or (v['bl'] and max(abs(v['bl'][i] - (v['e'][i] + v['xi'][i]) / 2) for i in range(3)) > 1.1e-4)]
ok(not bad, 'the average is (Elo + XI model) ÷ 2, only when both exist')
ok(all(abs(sum(v[k]) - 1) < 3e-4 for v in P.values() for k in ('e', 'm2', 'xi', 'bl', 'b') if v.get(k)), 'every set of three chances adds up to 1')

# ---- base rates
RS = J('data/results.json')
bad = []
for mid, v in P.items():
    c = [0, 0, 0]
    for s in RS['leagues'][v['lg']]['seasons']:
        for m in s['m']:
            if m[0] < NOW.strftime('%Y-%m-%d'):
                c[(m[3] < m[4]) * 2 + (m[3] == m[4])] += 1
    if max(abs(v['b'][i] - c[i] / sum(c)) for i in range(3)) > 6e-5:
        bad.append(mid)
ok(not bad, 'base rates: home / draw / away shares of the league chain\'s matches before the day, from data/results.json')
ok(all(v['t'] == NOW.strftime('%Y-%m-%dT%H:%M:%SZ') for v in P.values()), 'each prediction carries the time it was written')

# ---- the rules
L1 = G['ldg_step'](get, NOW + datetime.timedelta(minutes=5), L0)
ok(L1['p'] == L0['p'], 'the next run with the same data changes nothing (not even the time)')
order = sorted(P.items(), key=lambda kv: kv[1]['k'])
k0 = order[0][1]['k']
T1 = datetime.datetime.strptime(k0[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=utc) + datetime.timedelta(minutes=1)
locked = {m for m, v in P.items() if v['k'] <= k0}
later = {m for m, v in P.items() if v['k'] > k0}


def get_shift(p):
    d = get(p)
    if p == 'data/elo_own.json':
        for lid in d['leagues']:
            for t in d['leagues'][lid]['teams']:
                d['leagues'][lid]['teams'][t]['r'] += (15 if t < 'M' else -15)
    return d


L2 = G['ldg_step'](get_shift, T1, L0)
ok(all(L2['p'][m] == L0['p'][m] for m in locked), f'after kick-off the {len(locked)} started {"match is" if len(locked) == 1 else "matches are"} locked: new ratings change nothing')
moved = {m for m in later if m in L2['p'] and L2['p'][m]['e'] != L0['p'][m]['e']}
shift = lambda t: 15 if t < 'M' else -15
expect = {m for m in later if shift(P[m]['h']) != shift(P[m]['a'])}
ok(moved == expect and expect and all(L2['p'][m]['t'] == T1.strftime('%Y-%m-%dT%H:%M:%SZ') for m in moved) and all(L2['p'][m] == L0['p'][m] for m in later - expect),
   f'before kick-off a prediction follows new data and gets the new time: the {len(expect)} whose rating gap changed moved, the {len(later - expect)} others kept their numbers and time')
# a result: same id and same two teams; closing odds from market.json
mid0, v0 = order[0]
lg0 = next(l for l in IDX['leagues'] if l['id'] == v0['lg'])


def get_res(p, teams=(v0['h'], v0['a']), score='2-1', mk=True):
    d = get_shift(p)
    if p == 'data/' + lg0['file']:
        d['matches'].append({'i': mid0, 'd': v0['k'][:10], 'h': teams[0], 'a': teams[1], 's': score})
    if p == 'data/market.json' and mk:
        d['leagues'].setdefault(v0['lg'], {'rows': []})['rows'].append({'m': mid0, 'h': v0['h'], 'a': v0['a'], 'p': [0.5, 0.3, 0.2]})
    return d


L3 = G['ldg_step'](get_res, T1 + datetime.timedelta(hours=3), L2)
r3 = L3['p'][mid0]
ok(r3.get('s') == '2-1' and r3.get('o') == 0 and r3.get('mk') == [0.5, 0.3, 0.2] and all(r3[k] == L0['p'][mid0][k] for k in ('e', 'm2', 'xi', 'bl', 'b', 't')), 'a result is added to a locked prediction (2-1 = home win), with the closing odds, and its numbers stay as written')
L4 = G['ldg_step'](lambda p: get_res(p, teams=(v0['a'], v0['h'])), T1 + datetime.timedelta(hours=3), L2)
ok('o' not in L4['p'][mid0], 'a result with the teams the other way round is not taken')
L5 = G['ldg_step'](lambda p: get_res(p, score='0-0'), T1 + datetime.timedelta(hours=5), L3)
ok(L5['p'][mid0]['s'] == '2-1', 'a result once taken is not replaced')


def get_nofx(p):
    d = get(p)
    if p == 'data/fixtures.json':
        for lid in d['leagues']:
            d['leagues'][lid] = []
    return d


L6 = G['ldg_step'](get_nofx, T1, L2)
ok(set(L6['p']) == locked, 'fixtures gone from the list: the locked predictions stay, the unlocked ones are dropped')
ok(L6['since'] == L0['since'] == NOW.strftime('%Y-%m-%d'), 'the start date is kept from the first run')

# ---- the step writes only on change; failures never stop the sync
STORE = {}
G['gh_get_json'] = lambda hub, p: copy.deepcopy(STORE[p]) if p in STORE else get(p)
G['gh_put'] = lambda hub, p, c, m: (PUT.append(p), STORE.__setitem__(p, json.loads(c)))
G['sync_ledger'](None, NOW)
G['sync_ledger'](None, NOW + datetime.timedelta(minutes=5))
ok(PUT == ['data/ledger.json'] and STORE['data/ledger.json']['p'] == P, 'sync_ledger writes the file once, and not again when nothing changed')
G['gh_get_json'] = lambda hub, p: (_ for _ in ()).throw(RuntimeError('down'))
logs = []
G['log'] = lambda *a: logs.append(' '.join(map(str, a)))
ok(G['run_pipeline'](None, 'k') is True and any('خطأ' in x for x in logs), 'an error inside the step is logged and the rest of the sync goes on')
# ---- the committed file
F = J('data/ledger.json')
ok(isinstance(F, dict) and isinstance(F.get('p'), dict), 'data/ledger.json is a ledger (the placeholder or a real one)')
print(f'{fails} FAILED' if fails else 'all passed')
sys.exit(1 if fails else 0)
