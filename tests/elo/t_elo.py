# Club Elo from results (the block between "ELO2 START" and "ELO2 END" in sync.py): the rating arithmetic on made-up matches worked by hand, the
# season boundary, a new club, the chain of seasons, the probabilities, the backtest, the write / skip / failure behaviour of the step with GitHub stubbed, and the
# real data/elo_own.json against a second implementation written differently (every club's rating, every history point's last value, the backtest).
import os, re, sys, json, math, hashlib, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
block = src[src.index('# ===== ELO2 START ====='):src.index('# ===== ELO2 END =====')]
mk = src[src.index('MK_LEAGUES = '):src.index('MK_FD = ')]
LOG = []; PUT = {}; STORE = {}
G = {'os': os, 're': re, 'json': json, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: True,
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(mk, G); exec(block, G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
run, probs, files, brier, backtest, sync = (G[k] for k in ('el2_run', 'el2_probs', 'el2_files', 'el2_brier', 'el2_backtest', 'sync_elo2'))
P = G['EL2']
# ---- the arithmetic, worked by hand
e = 1 / (1 + 10 ** (-P['H'] / 400))
R, hist, rows = run([('2026-08-01', 'A', 'B', 1, 0, 'm1')])
ok(abs(R['A'] - (1500 + P['K'] * (1 - e))) < 1e-9 and abs(R['B'] - (1500 - P['K'] * (1 - e))) < 1e-9, 'a 1-0 home win between two new clubs: the winner gains K × (1 − E) = %.3f, the loser loses the same' % (P['K'] * (1 - e)))
ok(abs(rows[0][2] - P['H']) < 1e-9 and rows[0][3] == 0, 'the match is asked BEFORE it is played: the rating gap is just the home advantage (%d)' % P['H'])
R2, _, _ = run([('2026-08-01', 'A', 'B', 2, 0, 'm1')]); R3, _, _ = run([('2026-08-01', 'A', 'B', 3, 0, 'm1')])
ok(abs((R2['A'] - 1500) - 1.5 * (R['A'] - 1500)) < 1e-9 and abs((R3['A'] - 1500) - 1.75 * (R['A'] - 1500)) < 1e-9, 'goal-difference multiplier: 2 goals × 1.5, 3 goals × 1.75')
Rd, _, _ = run([('2026-08-01', 'A', 'B', 1, 1, 'm1')])
ok(abs(Rd['A'] - (1500 + P['K'] * (0.5 - e))) < 1e-9 and Rd['A'] < 1500, 'a home draw: the home side loses a little (it was expected to win)')
ok(abs(sum(Rd.values()) - 3000) < 1e-9, 'ratings only move between the two clubs (the sum stays 3000)')
# new club starts at the league mean; the season boundary pulls 10% towards the mean
ms = [('2026-08-01', 'A', 'B', 1, 0, 'm1'), ('2026-08-08', 'A', 'C', 0, 0, 'm2')]
Rn, _, rn = run(ms)
mean_before = (1500 + P['K'] * (1 - e) + 1500 - P['K'] * (1 - e)) / 2
ok(abs(rn[1][2] - ((1500 + P['K'] * (1 - e)) - mean_before + P['H'])) < 1e-9, 'a new club (C) comes in at the mean of the league so far (1500 here)')
a0 = 1500 + P['K'] * (1 - e); b0 = 1500 - P['K'] * (1 - e)
Rs, _, rs = run([('2026-05-01', 'A', 'B', 1, 0, 'm1'), ('2026-08-20', 'B', 'A', 0, 0, 'm2')])
mean0 = (a0 + b0) / 2
a1 = mean0 + 0.9 * (a0 - mean0); b1 = mean0 + 0.9 * (b0 - mean0)
ok(abs(rs[1][2] - (b1 - a1 + P['H'])) < 1e-9, 'a new season (1 July): every rating is pulled 10%% towards the league mean before the first match (gap %.2f)' % (a0 - b0))
ok(abs(run([('2026-05-30', 'A', 'B', 1, 0, 'm1'), ('2026-06-30', 'B', 'A', 0, 0, 'm2')])[2][1][2] - (b0 - a0 + P['H'])) < 1e-9, '30 June is still the same season (no pull)')
# probabilities
pp = probs(0)
ok(abs(sum(pp) - 1) < 1e-12 and abs(pp[0] - pp[2]) < 1e-12 and 0.2 < pp[1] < 0.35, 'probabilities add to 1; at an equal rating the home and away chances are equal and the draw is about %.0f%%' % (pp[1] * 100))
ok(probs(300)[0] > probs(0)[0] > probs(-300)[0] and probs(300)[2] < probs(0)[2], 'a bigger rating gap, a bigger win chance for the stronger side')
ok(abs(brier([1, 0, 0], 0)) < 1e-12 and abs(brier([0, 0, 1], 0) - 2) < 1e-12 and abs(brier([1 / 3] * 3, 1) - 2 / 3) < 1e-12, 'Brier: perfect 0, worst 2, a third each 0.667')
# ---- the chain of seasons
sj = {'leagues': {'L': {'cur': '2026-27', 'seasons': {s: {'complete': True, 'files': {'file': 'L_%s.json' % s}} for s in ('2021-22', '2022-23', '2024-25', '2025-26')}}}}
ch, fl = files(sj, {'leagues': [{'id': 'L', 'file': 'L.json'}]}, 'L')
ok(ch == ['2024-25', '2025-26'] and fl == ['L_2024-25.json', 'L_2025-26.json', 'L.json'], 'the chain ends at the season before the current one and stops at a missing season (2023-24): %s' % ch)
sj['leagues']['L']['seasons']['2025-26']['complete'] = False
ok(files(sj, {'leagues': [{'id': 'L', 'file': 'L.json'}]}, 'L')[0] == [], 'a season that is not complete breaks the chain')
# ---- the backtest on made-up rows
rb = {'L': [('2025-05-01', 'x', 0, 0, [.5, .3, .2]), ('2025-06-01', 'x', 0, 2, [.5, .3, .2]), ('2025-09-01', 'x', 0, 0, [.7, .2, .1]), ('2025-10-01', 'x', 0, 1, [.2, .6, .2])]}
bt = backtest(rb)
ok(bt['n'] == 2 and bt['n_train'] == 2 and bt['base_rates'] == [0.5, 0, 0.5] and abs(bt['brier'] - (brier([.7, .2, .1], 0) + brier([.2, .6, .2], 1)) / 2) < 1e-4 and abs(bt['base'] - (brier([.5, 0, .5], 0) + brier([.5, 0, .5], 1)) / 2) < 1e-4 and bt['acc'] == 1.0, 'backtest: trained on the rows before 1 Aug 2025 (base rates 50 / 0 / 50), scored on the two after it: Brier %.4f against %.4f' % (bt['brier'], bt['base']))
# ---- the real data against a second implementation
D = REPO + '/data/'
idx = json.load(open(D + 'index.json')); S = json.load(open(D + 'seasons.json'))
names = {l['id']: l for l in idx['leagues']}
def second(lid):
    cur = S['leagues'][lid]['cur']; y = int(cur[:4]) - 1; got = []
    while True:
        lab = '%d-%02d' % (y, (y + 1) % 100); e_ = S['leagues'][lid]['seasons'].get(lab)
        if not e_ or not e_.get('complete') or not e_.get('files', {}).get('file'): break
        got.insert(0, e_['files']['file']); y -= 1
    got.append(names[lid]['file']); seen = set(); M = []
    for f in got:
        for m in json.load(open(D + f))['matches']:
            if m.get('s') and m.get('d') and m['i'] not in seen:
                seen.add(m['i']); a, b = m['s'].split('-'); M.append((m['d'][:10], m['i'], m['h'], m['a'], int(a), int(b)))
    M.sort(); rt = {}; yr = None; out = []
    for d, i, h, a, g, k in M:
        sea = int(d[:4]) if int(d[5:7]) >= 7 else int(d[:4]) - 1
        if yr is not None and sea != yr:
            mu = sum(rt.values()) / len(rt)
            rt = {t: mu + 0.9 * (v - mu) for t, v in rt.items()}
        yr = sea
        for t in (h, a):
            rt.setdefault(t, sum(rt.values()) / len(rt) if rt else 1500.0)
        dr = rt[h] - rt[a] + 50
        ex = 1 / (1 + math.exp(-dr * math.log(10) / 400))
        sc = 1 if g > k else 0.5 if g == k else 0
        mult = 1 if abs(g - k) <= 1 else 1.5 if abs(g - k) == 2 else (11 + abs(g - k)) / 8
        x = dr / 175; ph = 1 / (1 + math.exp(-(x - .55))); pa = 1 - 1 / (1 + math.exp(-(x + .55)))
        out.append((d, i, [ph, 1 - ph - pa, pa], 0 if g > k else 1 if g == k else 2))
        rt[h] += 30 * mult * (sc - ex); rt[a] -= 30 * mult * (sc - ex)
    return rt, out, M
if os.path.exists(D + 'elo_own.json'):
    F = json.load(open(D + 'elo_own.json')); allr = []; bad = []; n_teams = 0
    for lid, v in F['leagues'].items():
        rt, out, M = second(lid); allr += [(lid,) + o for o in out]
        for t, x in v['teams'].items():
            n_teams += 1
            if abs(x['r'] - rt[t]) > 0.06 or abs(x['h'][-1][1] - rt[t]) > 0.06: bad.append((lid, t, x['r'], round(rt[t], 1)))
        ok(v['n'] == len(M) and all(abs(v['pred'][i][0] - p[0]) < 6e-5 for d, i, p, o in out if i in v['pred']) and len(v['pred']) > 30, '%s: %d matches, %d clubs, every pre-match probability of this season worked again' % (v['name'], len(M), len(v['teams'])))
    ok(not bad and n_teams > 100, 'the rating of every one of the %d clubs matches the second implementation (largest gap allowed 0.06) %s' % (n_teams, bad[:3]))
    te = [r for r in allr if r[1] >= '2025-08-01']; tr = [r for r in allr if r[1] < '2025-08-01']
    base = [sum(1 for r in tr if r[4] == i) / len(tr) for i in range(3)]
    b = sum(sum((r[3][i] - (r[4] == i)) ** 2 for i in range(3)) for r in te) / len(te); bb = sum(sum((base[i] - (r[4] == i)) ** 2 for i in range(3)) for r in te) / len(te)
    ok(F['backtest']['n'] == len(te) and abs(F['backtest']['brier'] - b) < 6e-5 and abs(F['backtest']['base'] - bb) < 6e-5, 'the backtest worked again: %d matches, Brier %.4f against %.4f for the base rates' % (len(te), b, bb))
    ok(F['backtest']['brier'] < F['backtest']['base'] - 0.03, 'Elo beats the base rates by more than 0.03 Brier on the tested matches (%.4f < %.4f)' % (F['backtest']['brier'], F['backtest']['base']))
else:
    print('(no data/elo_own.json yet: the comparison with the real file is skipped)')
# ---- the step: write once, skip when nothing changed, a failure never stops the sync
def mini():
    st = {'data/index.json': {'leagues': [{'id': 'l_4WFCIZ', 'name': 'Premier League', 'file': 'cur.json'}]}, 'data/seasons.json': {'leagues': {'l_4WFCIZ': {'cur': '2026-27', 'seasons': {}}}}}
    teams = ['T%d' % i for i in range(10)]; ms = []
    k = 0
    for r in range(11):
        for i in range(0, 10, 2):
            ms.append({'i': 'm%d' % k, 'h': teams[(i + r) % 10], 'a': teams[(i + 1 + r) % 10], 's': '%d-%d' % ((k * 7) % 4, (k * 3) % 3), 'd': '2026-08-%02d' % (1 + r)}); k += 1
    st['data/cur.json'] = {'matches': ms}
    return st
STORE.clear(); STORE.update(mini()); PUT.clear()
sync('hub'); f = PUT.get('data/elo_own.json')
ok(f and list(f['leagues']) == ['l_4WFCIZ'] and f['leagues']['l_4WFCIZ']['n'] == 55 and len(f['leagues']['l_4WFCIZ']['teams']) == 10 and any('[Elo خاص]' in l for l in LOG), 'a league with 55 matches: written, 10 clubs, logged')
PUT.clear(); sync('hub'); ok(not PUT, 'the same matches again: nothing is written')
STORE['data/cur.json']['matches'].append({'i': 'mx', 'h': 'T0', 'a': 'T1', 's': '2-0', 'd': '2026-09-01'}); sync('hub'); ok('data/elo_own.json' in PUT and PUT['data/elo_own.json']['leagues']['l_4WFCIZ']['n'] == 56, 'one more match: written again (56)')
STORE.clear(); STORE.update(mini()); STORE['data/cur.json']['matches'] = STORE['data/cur.json']['matches'][:20]; PUT.clear(); sync('hub'); ok(not PUT, 'a league with fewer than 50 matches is left out, nothing is written')
G['sync_elo2'] = lambda hub: (_ for _ in ()).throw(RuntimeError('boom'))
LOG.clear(); out = G['run_pipeline']('hub', 'k')
ok(out is True and any('[Elo خاص] خطأ' in l and 'boom' in l for l in LOG), 'run_pipeline: an error in the step is logged and the sync goes on')
print('all passed' if not fails else '%d FAILED' % fails); sys.exit(1 if fails else 0)
