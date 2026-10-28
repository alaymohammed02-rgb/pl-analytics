# XI Battle (the block between "XIB START" and "XIB END" in sync.py): a player's numbers on made-up matches worked by hand (decay, shrinkage,
# position mean, a player without minutes), ratings asked BEFORE a match day, the probabilities, the chain of seasons, the write / skip / failure
# behaviour of the step with GitHub stubbed, then the real data/xib.json and data/xib_test.json against a second implementation written differently
# (every player's three numbers; every tested match predicted again from its real XIs).
import os, re, sys, json, math, hashlib, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
cut = lambda a, b: src[src.index(a):src.index(b)]
LOG = []; PUT = {}; STORE = {}
G = {'os': os, 're': re, 'json': json, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: True,
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(cut('MK_LEAGUES = ', 'MK_FD = '), G); exec(cut('# ===== ELO2 START =====', '# ===== ELO2 END ====='), G); exec(cut('# ===== XIB START =====', '# ===== XIB END ====='), G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
P = G['XIB']; lam = math.log(2) / P['hl']
# ---- made-up matches: two teams, one match a week apart
def mt(d, rows_h, rows_a, hg=1, ag=0):
    return {'d': d, 'lid': 'L', 'ht': 'H', 'at': 'A', 'hg': hg, 'ag': ag, 'rows': {'H': rows_h, 'A': rows_a}, 'mx': None}
M = {'m1': mt('2026-08-01', [('p1', 90, 0.5, 0.2), ('p2', 45, 0.1, 0.0)], [('q1', 90, 0.3, 0.1)]),
     'm2': mt('2026-08-08', [('p1', 90, 0.0, 0.4)], [('q1', 90, 0.2, None)])}
pos = {'p1': 'FW', 'p2': 'MF', 'q1': 'FW'}
seen = {}
S, mu, t = G['xib_stream'](M, pos, P, lambda mid, m, rate: seen.__setitem__(mid, {p: rate(p) for p in ('p1', 'p2', 'q1', 'zz')}))
ok(seen['m1']['p1'][3] == 0 and seen['m1']['p1'][0] == 0.15 and seen['m1']['p1'][1] == 1.3, 'the first match is asked before anything is known: no minutes, the defaults (0.15 attack, 1.3 team xG)')
# after m1: FW mean = (0.7 + 0.4) / 2 = 0.55 per 90; team mean = (0.6 + 0.3) / 2 = 0.45; on day 8 the m1 sums are decayed by 2^(-7/365)
f = math.exp(-lam * 7)
fw = (0.7 + 0.4) / 2; tm = (0.6 + 0.3) / 2
att = (0.7 * f + P['Ka'] * fw) / (1 * f + P['Ka']); onf = (0.6 * f + P['Kt'] * tm) / (f + P['Kt']); ona = (0.3 * f + P['Kt'] * tm) / (f + P['Kt'])
r = seen['m2']['p1']
ok(abs(r[0] - att) < 1e-12 and abs(r[1] - onf) < 1e-12 and abs(r[2] - ona) < 1e-12 and abs(r[3] - f) < 1e-12, 'p1 before the second match, worked by hand: attack %.4f, xG for %.4f, against %.4f, %.4f weighted 90s' % (att, onf, ona, f))
r = seen['m2']['p2']; w2 = 0.5 * f
ok(abs(r[0] - (0.1 * f + P['Ka'] * 0.1 / 0.5) / (w2 + P['Ka'])) < 1e-12 and abs(r[1] - (0.6 * w2 + P['Kt'] * tm) / (w2 + P['Kt'])) < 1e-12, 'a 45-minute player counts half a match, pulled towards the midfield mean (0.2 per 90)')
r = seen['m2']['zz']
ok(r[3] == 0 and abs(r[0] - fw * 0 - (0.1 / 0.5)) < 1e-12 and abs(r[1] - tm) < 1e-12, 'a player with no minutes (unknown position counts as a midfielder) gets the position mean and the mean team')
ok(abs(S['q1'][1] - (1 * f + 0)) < 1e-12 and abs(S['q1'][3] - (1 * f + 1)) < 1e-12, 'a match without xAG counts for the team numbers but not for the attack number')
ok(t == G['xib_day']('2026-08-08'), 'the last day is the last match day')
# ---- probabilities
side = G['xib_side']([(0.3, 1.4, 1.2, 0)] * 11)
p, lh, la = G['xib_probs'](side, side, 0.5)
ok(abs(sum(p) - 1) < 1e-12 and abs(p[0] - p[2]) < 1e-12 and abs(lh - la) < 1e-12, 'the same XI on neutral ground: equal chances (%.3f / %.3f / %.3f)' % tuple(p))
ok(G['xib_probs'](side, side, 1.0)[0][0] > p[0] > G['xib_probs'](side, side, 0.0)[0][0], 'home advantage: at home more, away less')
strong = G['xib_side']([(0.5, 1.8, 0.9, 0)] * 11)
ok(G['xib_probs'](strong, side, 0.5)[0][0] > 0.5, 'a side with more attack, more xG for and less against is the favourite')
c = P['b']; exp_lh = math.exp(c[0] + c[1] + c[2] * math.log(side[0]) + c[3] * math.log(side[1]) + c[4] * math.log(side[2]))
ok(abs(G['xib_probs'](side, side, 1.0)[1] - exp_lh) < 1e-12, 'the home goals: exp(b0 + bh + b1 log attack + b2 log xG for + b3 log the other side\'s xG against) = %.3f' % exp_lh)
# ---- the chain of seasons
sj = {'leagues': {'L': {'cur': '2026-27', 'seasons': {s: {'complete': True, 'files': {'file': 'L_%s.json' % s, 'pl_file': 'L_%s_pl.json' % s}} for s in ('2021-22', '2024-25', '2025-26')}}}}
fl = G['xib_files'](sj, {'leagues': [{'id': 'L', 'file': 'L.json', 'pl_file': 'L_pl.json', 'mx_file': 'L_mx.json'}]}, 'L')
ok(fl == [('L_2024-25.json', 'L_2024-25_pl.json', None), ('L_2025-26.json', 'L_2025-26_pl.json', None), ('L.json', 'L_pl.json', 'L_mx.json')], 'the chain ends at the season before the current one and stops at a missing season (2023-24)')
del sj['leagues']['L']['seasons']['2025-26']['files']['pl_file']
ok(G['xib_files'](sj, {'leagues': [{'id': 'L', 'file': 'L.json', 'pl_file': 'L_pl.json'}]}, 'L') == [('L.json', 'L_pl.json', None)], 'a season without player rows breaks the chain')
# ---- the step on the real files, GitHub stubbed: write, skip when nothing changed, a broken file does not raise
D = REPO + '/data/'
def real(p):
    f = os.path.join(REPO, p)
    return json.load(open(f, encoding='utf-8')) if os.path.exists(f) and p != G['XIB_PATH'] else STORE.get(p)
G['gh_get_json'] = lambda hub, p: real(p)
G['sync_xib']('hub', datetime.datetime(2026, 10, 28, 12, tzinfo=datetime.timezone.utc))
W = PUT.get(G['XIB_PATH'])
ok(W and len(W['p']) > 1000 and W['params'] == P, 'the step writes data/xib.json: %d players, as of %s' % (len(W['p']) if W else 0, W and W['asof']))
PUT.clear(); G['sync_xib']('hub')
ok(not PUT, 'run again with the same files: nothing is written (the key %s is unchanged)' % W['key'])
G['gh_get_json'] = lambda hub, p: None
try:
    G['sync_xib']('hub'); ok(not PUT, 'no files at all: nothing is written and nothing raises')
except Exception as e:
    ok(False, 'no files at all raised %r' % e)
F = W      # the second implementation is checked against what the step writes from the files of this checkout
ok(json.load(open(D + 'xib.json')).get('params') == P, 'the committed data/xib.json was written with the settings now in sync.py')
# ---- a second implementation: every player's numbers straight from the rows (sums over all his earlier matches, each weighted 2^(-age/365))
idx = json.load(open(D + 'index.json')); sjr = json.load(open(D + 'seasons.json'))
LIDS = ['l_4WFCIZ', 'l_0ErfuF', 'l_1Isor4', 'l_3FJFUl', 'l_0ALvwF', 'l_4QexZg']
def chain2(lid):
    e = sjr['leagues'][lid]; y = int(e['cur'][:4]) - 1; out = []
    while True:
        lab = '%d-%02d' % (y, (y + 1) % 100); s = e['seasons'].get(lab)
        if not (s and s.get('complete') and s['files'].get('file') and s['files'].get('pl_file')):
            break
        out.insert(0, (s['files']['file'], s['files']['pl_file'], s['files'].get('mx_file'))); y -= 1
    l = [x for x in idx['leagues'] if x['id'] == lid][0]
    return out + [(l['file'], l['pl_file'], l.get('mx_file'))]
rows, mins, matches, teamxg = [], {}, {}, []
for lid in LIDS:
    for fl_, fp, fm in chain2(lid):
        L = json.load(open(D + fl_)); Pf = json.load(open(D + fp)); ix = {k: i for i, k in enumerate(Pf['cols'])}
        res = {m['i']: (m['d'][:10], m['s']) for m in L['matches'] if re.fullmatch(r'\d+-\d+', str(m.get('s') or '').strip()) and m.get('d')}
        home = {(t['m'], t['i']): t['s'] for t in Pf.get('team') or []}
        teams = {}
        for r in Pf['rows']:
            teams.setdefault(r[0], set()).add(r[ix['t']])
        good = {m for m, ts in teams.items() if m in res and len(ts) == 2 and sorted(str(home.get((m, t))) for t in ts) == ['away', 'home']}
        txg = {}
        for r in Pf['rows']:
            if r[0] in good:
                txg[(r[0], r[ix['t']])] = txg.get((r[0], r[ix['t']]), 0) + (r[ix['npxg']] or 0)
                if r[ix['o']] and r[ix['mi']]:
                    mins.setdefault(r[ix['i']], {}).setdefault(r[ix['o']], 0); mins[r[ix['i']]][r[ix['o']]] += r[ix['mi']]
        for (m, t), x in txg.items():
            teamxg.append((res[m][0], x))
        for r in Pf['rows']:
            if r[0] in good:
                opp = [t for t in teams[r[0]] if t != r[ix['t']]][0]
                rows.append((res[r[0]][0], r[ix['i']], r[ix['mi']] or 0, r[ix['npxg']], r[ix['xag']], txg[(r[0], r[ix['t']])], txg[(r[0], opp)]))
        for m in good:
            ht = [t for t in teams[m] if home[(m, t)] == 'home'][0]
            matches[m] = (res[m][0], lid, fm, ht, [int(x) for x in res[m][1].split('-')])
def grp(p):
    if p not in mins:
        return 'MF'
    g = max(mins[p].items(), key=lambda kv: kv[1])[0]
    return g if g in ('GK', 'DF', 'MF', 'FW') else 'MF'
day = lambda d: datetime.date.fromisoformat(d).toordinal()
by = {}
for r in rows:
    by.setdefault(r[1], []).append(r)
def means(before):
    """position means per 90 and the mean team xG, from every row / team-match of the days before `before` (no decay)"""
    s, n = {}, {}
    for d, p, mi, npx, xa, f_, _ in rows:
        if d < before and mi and npx is not None and xa is not None:
            g = grp(p); s[g] = s.get(g, 0) + npx + xa; n[g] = n.get(g, 0) + mi / 90
    t = [x for d, x in teamxg if d < before]
    return {g: s[g] / n[g] for g in s}, sum(t) / len(t)
def numbers(p, before, ref, pm, tmn):
    """p's numbers from his rows of the days before `before`, each weighted by its age on day `ref`"""
    a = am = f = fa = w = 0.0
    for d, _, mi, npx, xa, tf, ta in by.get(p, []):
        if d >= before or not mi:
            continue
        k = 2 ** (-(day(ref) - day(d)) / P['hl']); x = mi / 90
        if npx is not None and xa is not None:
            a += k * (npx + xa); am += k * x
        w += k * x; f += k * x * tf; fa += k * x * ta
    g = grp(p)
    return ((a + P['Ka'] * pm.get(g, 0.15)) / (am + P['Ka']), (f + P['Kt'] * tmn) / (w + P['Kt']), (fa + P['Kt'] * tmn) / (w + P['Kt']), w)
last = max(d for d, *_ in rows)
nxt = (datetime.date.fromisoformat(last) + datetime.timedelta(days=1)).isoformat()
pm, tmn = means(nxt)
ok(F['asof'] == last and F['n_matches'] == len(matches), 'as of the last match day %s, %d matches' % (last, len(matches)))
ok(all(abs(F['mu']['att'][g] - round(pm[g], 4)) < 1e-4 for g in pm) and abs(F['mu']['team'] - round(tmn, 4)) < 1e-4, 'the position means per 90 (%s) and the mean team xG %.3f' % (', '.join('%s %.3f' % (g, pm[g]) for g in sorted(pm)), tmn))
bad = []
for p, v in F['p'].items():
    want = numbers(p, nxt, last, pm, tmn)
    if any(abs(v[i] - want[i]) > (2e-4 if i < 3 else 0.06) for i in range(4)):
        bad.append((p, v, [round(x, 4) for x in want]))
ok(not bad, 'every player of the file (%d) against the second implementation: attack, xG for, xG against and weighted 90s %s' % (len(F['p']), bad[:2]))
cur = set()
for lid in LIDS:
    l = [x for x in idx['leagues'] if x['id'] == lid][0]
    cur.update(r[1] for r in json.load(open(D + l['pl_file']))['rows'])
ok(set(F['p']) == {p for p in cur if p in by}, 'the file holds exactly the players of this season\'s six league files that have minutes')
# ---- the test file: every match from the split up to its last day with both official XIs, predicted again from the second implementation's numbers
T = json.load(open(D + 'xib_test.json'))
mxc, todo = {}, []
for m, (d, lid, fm, ht, sc) in matches.items():
    if not (T['split'] <= d <= T['last']) or not fm:
        continue
    if fm not in mxc:
        mxc[fm] = json.load(open(D + fm)).get('m') or {}
    lu = (mxc[fm].get(m) or {}).get('lu') or {}
    xh, xa = [[e[0] for e in ((lu.get(s) or {}).get('xi') or [])] for s in ('h', 'a')]
    if len(xh) == 11 and len(xa) == 11:
        todo.append((d, m, lid, xh, xa, sc))
G['gh_get_json'] = lambda hub, p: real(p)
elo = {}
for lid in LIDS:
    ch, fl2 = G['el2_files'](sjr, idx, lid)
    for r in G['el2_run'](G['el2_matches'](None, fl2))[2]:
        elo[r[1]] = r[4]
todo = [t for t in todo if t[1] in elo]
cache = {}
def at(d):
    if d not in cache:
        cache[d] = means(d)
    return cache[d]
c = P['b']; bx = be = 0.0; hit = 0
def wdl(lh, la):
    ph = [math.exp(-lh) * lh ** k / math.factorial(k) for k in range(11)]; pa = [math.exp(-la) * la ** k / math.factorial(k) for k in range(11)]
    w = sum(ph[i] * pa[j] for i in range(11) for j in range(i)); dr = sum(ph[i] * pa[i] for i in range(11)); l = sum(ph[i] * pa[j] for j in range(11) for i in range(j))
    return [w / (w + dr + l), dr / (w + dr + l), l / (w + dr + l)]
for d, m, lid, xh, xa, sc in todo:
    pm_, tm_ = at(d)
    H = [numbers(p, d, d, pm_, tm_) for p in xh]; A = [numbers(p, d, d, pm_, tm_) for p in xa]
    sh = (sum(x[0] for x in H), sum(x[1] for x in H) / 11, sum(x[2] for x in H) / 11); sa = (sum(x[0] for x in A), sum(x[1] for x in A) / 11, sum(x[2] for x in A) / 11)
    lh = math.exp(c[0] + c[1] + c[2] * math.log(sh[0]) + c[3] * math.log(sh[1]) + c[4] * math.log(sa[2])); la = math.exp(c[0] + c[2] * math.log(sa[0]) + c[3] * math.log(sa[1]) + c[4] * math.log(sh[2]))
    p = wdl(lh, la); o = 0 if sc[0] > sc[1] else 1 if sc[0] == sc[1] else 2
    bx += sum((p[k] - (k == o)) ** 2 for k in range(3)); be += sum((elo[m][k] - (k == o)) ** 2 for k in range(3)); hit += max(range(3), key=lambda k: p[k]) == o
n = len(todo); A_ = T['all']
ok(abs(n - A_['n']) <= 0.02 * A_['n'] and abs(bx / n - A_['brier']) < 0.003 and abs(be / n - A_['elo']) < 0.003 and abs(hit / n - A_['acc']) < 0.01,
   'data/xib_test.json predicted again: %d matches (file %d), Brier %.4f (file %.4f), Elo %.4f (file %.4f), right %.1f%% (file %.1f%%)' % (n, A_['n'], bx / n, A_['brier'], be / n, A_['elo'], 100 * hit / n, 100 * A_['acc']))
ok(T['params'] == P, 'the test file was made with the settings now in sync.py')
ok(abs(sum(v['n'] for v in T['per_league'].values()) - A_['n']) == 0 and abs(A_['d_elo'] - (A_['brier'] - A_['elo'])) < 2e-4 and abs(A_['d_base'] - (A_['brier'] - A_['base'])) < 2e-4, 'the per-league counts add up and the paired differences agree with the means')
print('done' if not fails else '%d FAILED' % fails)
sys.exit(1 if fails else 0)
