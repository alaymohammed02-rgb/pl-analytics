# Stat stability (the block between "STABILITY START" and "STABILITY END" in sync.py → data/stability.json):
#  - the rank and correlation helpers on small cases worked by hand;
#  - the per-90 numbers and the odd / even halves on made-up rows;
#  - the whole computation on made-up players whose answer is known (a stat that repeats exactly, a stat that is pure noise inside a
#    position but differs between positions, which must show up as a high raw and a low within-position correlation);
#  - the real Premier League seasons in data/ worked again here with a second, separately written implementation (shots and tackles);
#  - the sync step with GitHub stubbed: written, skipped when the files are unchanged, a league with a missing file left out, an error never
#    stopping the pipeline; and the published file's shape.
import os, re, sys, json, hashlib, datetime, random, statistics
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
block = src[src.index('# ===== STABILITY START ====='):src.index('# ===== STABILITY END =====')]
LOG = []; PUT = {}; STORE = {}
G = {'json': json, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: 'ran',
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(block, G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
close = lambda a, b, t=1e-9: a is not None and abs(a - b) < t
# ---- ranks and correlation
ok(G['st_ranks']([3, 1, 2]) == [3.0, 1.0, 2.0] and G['st_ranks']([1, 2, 2, 3]) == [1.0, 2.5, 2.5, 4.0] and G['st_ranks']([5, 5, 5]) == [2.0, 2.0, 2.0], 'ranks: plain, with a tie (1, 2.5, 2.5, 4) and all level (2, 2, 2)')
ok(close(G['st_spearman']([1, 2, 3, 4], [10, 20, 30, 40]), 1) and close(G['st_spearman']([1, 2, 3, 4], [4, 3, 2, 1]), -1), 'Spearman: a rising pair is 1, a falling pair is -1 (only the order counts)')
ok(close(G['st_spearman']([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]), 1), 'Spearman: a curve that only rises is still 1')
ok(G['st_spearman']([1, 2], [1, 2]) is None and G['st_spearman']([1, 1, 1], [1, 2, 3]) is None, 'Spearman: under 3 players, or one side all level: no number (None), never a guess')
# worked by hand: x = 1 2 3 4 5, y = 2 1 4 3 5 → ranks equal the values; d = (-1, 1, -1, 1, 0); 1 - 6 * 4 / (5 * 24) = 0.8
ok(close(G['st_spearman']([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]), 0.8), 'Spearman: 1 - 6·Σd²/(n(n²-1)) = 0.8 on a worked case')
# ---- per 90 and halves
cols = ['m', 'i', 'mi', 'o', 'sh', 'tk']
rows = [['m1', 'p1', 90, 'FW', 3, 1], ['m2', 'p1', 45, 'FW', 1, None], ['m3', 'p1', 90, 'FW', None, 2], ['m4', 'p1', 90, 'FW', 2, 0], ['m1', 'p2', 90, 'GK', 0, 0], ['m1', 'p3', None, 'MF', 5, 5]]
P = G['st_per90'](rows, cols, ['sh', 'tk'])
ok(close(P['p1']['mi'], 315) and close(P['p1']['sh'], (3 + 1 + 2) / (90 + 45 + 90) * 90) and close(P['p1']['tk'], (1 + 2 + 0) / (90 + 90 + 90) * 90), 'per 90 = total ÷ minutes of the matches that give the number × 90 (a match without the number does not count its minutes)')
ok(set(P) == {'p1', 'p2'} and P['p1']['pos'] == 'FW', 'a row without minutes is left out; the position is the one with most minutes')
dates = {'m1': '2024-01-01', 'm2': '2024-01-08', 'm3': '2024-01-15', 'm4': '2024-01-22'}
H = G['st_halves'](rows, cols, dates, ['sh'])
ok(H['p1'][0]['mi'] == 180 and H['p1'][1]['mi'] == 135 and close(H['p1'][0]['sh'], 3.0) and close(H['p1'][1]['sh'], 2.0), 'halves: a player\'s matches in date order, 1st and 3rd against 2nd and 4th (minutes 180 and 135, shots per 90 3.0 and 2.0)')
# ---- the whole computation on made-up players
random.seed(3)
def mk(seasons_n, f):
    out = []
    for si in range(seasons_n):
        rows, dts = [], {}
        for pid in range(120):
            pos = ['DF', 'MF', 'FW'][pid % 3]
            for mi_ in range(20):
                m = 's%d_m%d' % (si, mi_); dts[m] = '2024-%02d-%02d' % (1 + mi_ // 8, 1 + mi_ % 8)
                rows.append([m, 'p%d' % pid, 90, pos, f(pid, pos, si, mi_), 1.0])
        out.append(('202%d-2%d' % (si, si + 1), ['m', 'i', 'mi', 'o', 'sh', 'tk'], rows, dts))
    return out
G['ST_STATS'][:] = ['sh', 'tk']
exact = G['st_compute'](mk(3, lambda pid, pos, si, mi_: float(pid)))                      # every player's number is his id in every match: repeats exactly
ok(exact['sh']['yoy'] is not None and exact['sh']['yoy'] > .99 and exact['sh']['half'] > .99, 'a number that repeats exactly: year-to-year %s and odd-vs-even %s are both ≈ 1' % (exact['sh']['yoy'], exact['sh']['half']))
BASE = {'DF': 0.5, 'MF': 2.0, 'FW': 5.0}
noise = G['st_compute'](mk(3, lambda pid, pos, si, mi_: BASE[pos] + random.random() * 2))   # same level per position, pure luck inside it
ok(noise['sh']['yoy_all'] > .5, 'noise on top of position levels: the raw year-to-year correlation looks high (%s) only because positions differ' % noise['sh']['yoy_all'])
ok(abs(noise['sh']['yoy']) < .35, 'the same numbers compared within a position: (%s) close to zero, as luck should be' % noise['sh']['yoy'])
ok(noise['sh']['n_yoy'] == 2 * 120 and noise['sh']['n_half'] == 3 * 120, 'player counts: 2 season pairs × 120, 3 seasons × 120 (%s, %s)' % (noise['sh']['n_yoy'], noise['sh']['n_half']))
ok(G['st_compute'](mk(2, lambda pid, pos, si, mi_: 1.0))['sh']['yoy'] is None, 'a stat every player has the same value of: no number (None)')
# ---- the real seasons, worked again with a separate implementation (shots and tackles, within position, year to year)
D = REPO + '/data/'
idx = json.load(open(D + 'index.json'))
past = sorted([p for p in idx['seasons']['l_4WFCIZ']['past'] if p.get('complete') and p.get('pl_file')], key=lambda p: p['s'])
ok(len(past) >= 2, 'the Premier League has %d full past seasons in the index' % len(past))
def season_table(pf):
    d = json.load(open(D + pf)); c = {n: i for i, n in enumerate(d['cols'])}
    tab = {}
    for r in d['rows']:
        if r[c['mi']] is None: continue
        t = tab.setdefault(r[c['i']], {'mi': 0, 'pos': {}, 'sum': {}, 'min': {}})
        t['mi'] += r[c['mi']]
        if r[c['o']]: t['pos'][r[c['o']]] = t['pos'].get(r[c['o']], 0) + r[c['mi']]
        for k in ('sh', 'tk'):
            if r[c[k]] is not None:
                t['sum'][k] = t['sum'].get(k, 0) + r[c[k]]; t['min'][k] = t['min'].get(k, 0) + r[c['mi']]
    return tab
def avg_rank(v):
    s = sorted(v); first = {}
    for n, x in enumerate(s): first.setdefault(x, n)
    cnt = {x: s.count(x) for x in first}
    return [first[x] + (cnt[x] + 1) / 2 for x in v]
def pearson(a, b):
    ma, mb = statistics.fmean(a), statistics.fmean(b)
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) ** .5
def indep(k):
    tabs = [season_table(p['pl_file']) for p in past]
    def elig(t):
        if t['mi'] < 900 or not t['pos'] or k not in t['sum']: return None
        pos = max(t['pos'], key=t['pos'].get)
        return None if pos == 'GK' else (pos, t['sum'][k] / t['min'][k] * 90)
    zs = []
    for tab in tabs:
        e = {i: elig(t) for i, t in tab.items()}; e = {i: v for i, v in e.items() if v}
        grp = {}
        for i, (pos, v) in e.items(): grp.setdefault(pos, []).append(v)
        par = {pos: (statistics.fmean(v), statistics.pstdev(v)) for pos, v in grp.items() if len(v) >= 5 and statistics.pstdev(v) > 0}
        zs.append({i: (v - par[pos][0]) / par[pos][1] for i, (pos, v) in e.items() if pos in par})
    xs, ys = [], []
    for a, b in zip(zs, zs[1:]):
        for i in a:
            if i in b: xs.append(a[i]); ys.append(b[i])
    return pearson(avg_rank(xs), avg_rank(ys)), len(xs)
real = []
for p in past:
    d = json.load(open(D + p['pl_file'])); lg = json.load(open(D + p['file']))
    real.append((p['s'], d['cols'], d['rows'], {m['i']: m.get('d') for m in lg['matches']}))
G['ST_STATS'][:] = ['sh', 'tk']
R = G['st_compute'](real)
for k in ('sh', 'tk'):
    r, n = indep(k)
    ok(abs(r - R[k]['yoy']) < .0015 and n == R[k]['n_yoy'], 'Premier League %d seasons, %s: year-to-year within position %.3f on %d player pairs, the second implementation gives %.3f on %d' % (len(past), k, R[k]['yoy'], R[k]['n_yoy'], r, n))
ok(R['sh']['half'] is not None and 0 < R['sh']['half'] <= 1 and R['sh']['n_half'] > 300, 'odd-vs-even reliability of shots: %s on %d player-seasons' % (R['sh']['half'], R['sh']['n_half']))
# ---- the sync step with GitHub stubbed
G['ST_STATS'][:] = ['sh', 'tk', 'gl']
for p in past:
    for f in (p['pl_file'], p['file']): STORE['data/' + f] = json.load(open(D + f))
STORE['data/index.json'] = {'leagues': [{'id': 'l_4WFCIZ', 'name': 'Premier League'}], 'seasons': {'l_4WFCIZ': {'past': past}, 'l_0ErfuF': {'past': past[:1]}}}
G['sync_stability'](None)
S = PUT.get('data/stability.json')
ok(S and list(S['leagues']) == ['l_4WFCIZ'] and S['leagues']['l_4WFCIZ']['seasons'] == [p['s'] for p in past] and set(S['leagues']['l_4WFCIZ']['stats']) == {'sh', 'tk', 'gl'} and S['key'], 'sync_stability writes the file: the league with 2+ full seasons only (one season is not enough), its seasons in order, every stat, a key')
n = len(PUT); G['sync_stability'](None); ok(len(PUT) == n, 'unchanged season files: the file is not computed or written again (same key)')
STORE['data/index.json']['seasons']['l_4WFCIZ']['past'][0] = dict(past[0], pl_v='changed')
G['sync_stability'](None); ok(PUT['data/stability.json']['key'] != S['key'], 'a changed file version recomputes it')
PUT.clear(); STORE.pop('data/stability.json')
del STORE['data/' + past[0]['pl_file']]
G['sync_stability'](None); ok('data/stability.json' not in PUT and any('ملفات ناقصة' in l for l in LOG), 'a season file that cannot be read: the league is left out, nothing is written, it is logged')
G['sync_stability'] = lambda hub, now=None: (_ for _ in ()).throw(RuntimeError('boom'))
ok(G['run_pipeline'](None, 'k') == 'ran' and any('boom' in l for l in LOG), 'run_pipeline: an error in the step is logged and the sync goes on')
# ---- the published file
F = json.load(open(D + 'stability.json')) if os.path.exists(D + 'stability.json') else None
if F:
    L = F['leagues']['l_4WFCIZ']
    ok(L['seasons'] == [p['s'] for p in past] and F['min'] == 900 and len(L['stats']) >= 25, 'data/stability.json: %s, %d stats, minimum %d minutes' % (L['seasons'], len(L['stats']), F['min']))
    ok(all(v['yoy'] is None or -1 <= v['yoy'] <= 1 for v in L['stats'].values()) and L['stats']['ps']['yoy'] > L['stats']['ast']['yoy'], 'every correlation is between -1 and 1, and passes repeat more than assists')
else:
    print('(data/stability.json is written by the next sync; its shape is checked once it exists)')
print('all passed' if not fails else '%d failed' % fails)
sys.exit(1 if fails else 0)
