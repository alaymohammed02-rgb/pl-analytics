# Time machine (the block between "TMACH START" and "TMACH END" in sync.py): points and ratings on made-up matches worked by hand (the day itself
# is left out, a new season's pull to the mean), expected final points over the remaining pairings worked by hand, the test's checkpoints and
# errors, the write / skip / failure behaviour of the step with GitHub stubbed, and the real data/results.json against the league files and a
# second implementation of the test (its own Elo and expected points).
import os, re, sys, json, math, hashlib, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
cut = lambda a, b: src[src.index(a):src.index(b)]
LOG = []; PUT = {}; STORE = {}
G = {'os': os, 're': re, 'json': json, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: True,
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(cut('MK_LEAGUES = ', 'MK_FD = '), G); exec(cut('# ===== ELO2 START =====', '# ===== ELO2 END ====='), G); exec(cut('# ===== TMACH START =====', '# ===== TMACH END ====='), G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
P = G['EL2']
ms = [('2026-08-01', 'A', 'B', 2, 0, 'm1'), ('2026-08-01', 'C', 'A', 1, 1, 'm2'), ('2026-08-08', 'B', 'C', 0, 3, 'm3')]
pts = G['tmach_points'](ms)
ok(pts == {'A': [4, 2, 2], 'B': [0, 2, -5], 'C': [4, 2, 3]}, 'points, games and goal difference: A 4 (2), B 0 (−5), C 4 (+3)')
R = G['tmach_ratings'](ms, '2026-08-08')
ok(R == G['el2_run'](ms[:2])[0], 'ratings on 8 Aug come from the matches before that day only (the 8 Aug match is not in them)')
R2 = G['tmach_ratings'](ms, '2027-08-01'); R3 = G['el2_run'](ms)[0]; mean = sum(R3.values()) / 3
ok(all(abs(R2[t] - (mean + 0.9 * (R3[t] - mean))) < 1e-9 for t in R3), 'a day in the next season: the 10% pull to the mean is applied before the first match of that season')
# expected points, by hand: before 8 Aug, A v B and C v A are played (A 4, B 0, C 1); the four pairings left are A v C, B v A, B v C, C v B
R = G['tmach_ratings'](ms, '2026-08-08')
exp, _ = G['tmach_expect'](ms, R, '2026-08-08')
LEFT = (('A', 'C'), ('B', 'A'), ('B', 'C'), ('C', 'B'))
w2 = {'A': 4.0, 'B': 0.0, 'C': 1.0}
for h, a in LEFT:
    p = G['el2_probs'](R[h] - R[a] + P['H'])
    w2[h] += 3 * p[0] + p[1]; w2[a] += 3 * p[2] + p[1]
ok(all(abs(exp[t] - w2[t]) < 1e-9 for t in w2), 'expected final points = points on the day + 3 × win + 1 × draw over the four pairings not yet played (%s)' % ', '.join('%s %.2f' % (t, w2[t]) for t in sorted(w2)))
ok(abs(sum(exp.values()) - (5 + sum(3 - G['el2_probs'](R[h] - R[a] + P['H'])[1] for h, a in LEFT))) < 1e-9, 'the points add up: 3 per decided match, 2 per draw')
# the test on a made-up finished season (3 clubs, 6 matches) in a chain of two seasons
s1 = [('2025-08-0%d' % (i + 1), h, a, 1, 0, 'x%d' % i) for i, (h, a) in enumerate([('A', 'B'), ('B', 'C'), ('C', 'A'), ('B', 'A'), ('C', 'B'), ('A', 'C')])]
s2 = [('2026-08-01', 'A', 'B', 0, 0, 'y1')]
T = G['tmach_test']({'L': [('2025-26', s1), ('2026-27', s2)]})
ok(T['all']['0.5']['n'] == 3 and T['all']['0.5']['seasons'] == 1, 'only the finished season is tested (3 clubs at each checkpoint); the season under way is left out')
up = sorted(s1)[3][0]; Rt = G['tmach_ratings'](s1 + s2, up); e, pp = G['tmach_expect'](s1, Rt, up); fin = G['tmach_points'](s1)
want = sum(abs(e[t] - fin[t][0]) for t in fin) / 3
ok(abs(T['all']['0.5']['elo'] - want) < 0.011, 'half way = before the match at index 3 (%s): average error %.2f points' % (up, want))
ppg = sum(abs(pp[t][0] / pp[t][1] * 4 - fin[t][0]) for t in fin) / 3
ok(abs(T['all']['0.5']['ppg'] - ppg) < 0.011, '"points per game so far × 4 games": average error %.2f' % ppg)
# ---- the step: write, skip, nothing
D = REPO + '/data/'
def real(p):
    f = os.path.join(REPO, p)
    return json.load(open(f, encoding='utf-8')) if os.path.exists(f) and p != G['TM_PATH'] else STORE.get(p)
G['gh_get_json'] = lambda hub, p: real(p)
G['sync_tmach']('hub', datetime.datetime(2026, 10, 28, 12, tzinfo=datetime.timezone.utc))
W = PUT.get(G['TM_PATH'])
ok(W and len(W['leagues']) == 6 and W['params'] == P, 'the step writes data/results.json: 6 leagues')
PUT.clear(); G['sync_tmach']('hub')
ok(not PUT, 'run again with the same files: nothing is written')
G['gh_get_json'] = lambda hub, p: None
try:
    G['sync_tmach']('hub'); ok(not PUT, 'no files: nothing is written and nothing raises')
except Exception as e:
    ok(False, 'no files raised %r' % e)
ok(json.load(open(D + 'results.json')).get('params') == P, 'the committed data/results.json was written with the Elo settings now in sync.py')
# ---- every match of the file against the league files
idx = json.load(open(D + 'index.json')); sj = json.load(open(D + 'seasons.json'))
bad = []
for lid, L in W['leagues'].items():
    v = sj['leagues'][lid]; labs = []
    y = int(v['cur'][:4]) - 1
    while True:
        lab = '%d-%02d' % (y, (y + 1) % 100); e = v['seasons'].get(lab)
        if not (e and e.get('complete') and e['files'].get('file')):
            break
        labs.insert(0, (lab, e['files']['file'])); y -= 1
    labs.append((v['cur'], [l for l in idx['leagues'] if l['id'] == lid][0]['file']))
    if [s['s'] for s in L['seasons']] != [x[0] for x in labs]:
        bad.append(lid + ' seasons')
    for s, (lab, f) in zip(L['seasons'], labs):
        got = sorted((m[0], L['teams'][m[1]], L['teams'][m[2]], m[3], m[4], m[5]) for m in s['m'])
        raw = sorted((m['d'][:10], m['h'], m['a'], int(m['s'].split('-')[0]), int(m['s'].split('-')[1]), m['i']) for m in json.load(open(D + f))['matches'] if re.fullmatch(r'\d+-\d+', str(m.get('s') or '').strip()) and m.get('d'))
        if got != raw:
            bad.append('%s %s' % (lid, lab))
ok(not bad, 'every season of every league holds exactly the finished matches of its league file (%d seasons) %s' % (sum(len(L['seasons']) for L in W['leagues'].values()), bad[:3]))
# ---- a second implementation of the test: its own Elo and expected points
def elo2(ms, upto):
    R, last = {}, None
    for d, h, a, g1, g2, mid in sorted(ms, key=lambda m: (m[0], m[5])):
        if d >= upto:
            break
        y = int(d[:4]) if int(d[5:7]) >= 7 else int(d[:4]) - 1
        if last is not None and y != last:
            mu = sum(R.values()) / len(R); R = {t: mu + 0.9 * (r - mu) for t, r in R.items()}
        last = y
        for t in (h, a):
            if t not in R:
                R[t] = sum(R.values()) / len(R) if R else 1500.0
        e = 1 / (1 + 10 ** (-(R[h] - R[a] + P['H']) / 400)); gd = abs(g1 - g2)
        k = P['K'] * (1 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8) * ((g1 > g2) + 0.5 * (g1 == g2) - e)
        R[h] += k; R[a] -= k
    yu = int(upto[:4]) if int(upto[5:7]) >= 7 else int(upto[:4]) - 1
    if R and last is not None and last != yu:
        mu = sum(R.values()) / len(R); R = {t: mu + 0.9 * (r - mu) for t, r in R.items()}
    return R
def pr(x):
    z = x / P['s']; ph = 1 / (1 + math.exp(-(z - P['c']))); pa = 1 - 1 / (1 + math.exp(-(z + P['c']))); return ph, 1 - ph - pa, pa
errs = {0.25: [], 0.5: [], 0.75: []}; perr = {0.25: [], 0.5: [], 0.75: []}
for lid, L in W['leagues'].items():
    T_ = L['teams']; allm = [(m[0], T_[m[1]], T_[m[2]], m[3], m[4], m[5]) for s in L['seasons'] for m in s['m']]
    for s in L['seasons']:
        sm = sorted([(m[0], T_[m[1]], T_[m[2]], m[3], m[4], m[5]) for m in s['m']], key=lambda m: (m[0], m[5]))
        clubs = sorted({x for m in sm for x in (m[1], m[2])}); n = len(clubs)
        if len(sm) != n * (n - 1):
            continue
        fin = {c: 0 for c in clubs}
        for m in sm:
            fin[m[1]] += 3 if m[3] > m[4] else 1 if m[3] == m[4] else 0; fin[m[2]] += 3 if m[4] > m[3] else 1 if m[3] == m[4] else 0
        for f in (0.25, 0.5, 0.75):
            up = sm[int(f * len(sm))][0]; R = elo2(allm, up); mu = sum(R.values()) / len(R)
            now = {c: [0, 0] for c in clubs}; seen = set()
            for m in sm:
                if m[0] < up:
                    seen.add((m[1], m[2])); now[m[1]][1] += 1; now[m[2]][1] += 1
                    now[m[1]][0] += 3 if m[3] > m[4] else 1 if m[3] == m[4] else 0; now[m[2]][0] += 3 if m[4] > m[3] else 1 if m[3] == m[4] else 0
            ex = {c: now[c][0] for c in clubs}
            for h in clubs:
                for a in clubs:
                    if h != a and (h, a) not in seen:
                        p = pr(R.get(h, mu) - R.get(a, mu) + P['H']); ex[h] += 3 * p[0] + p[1]; ex[a] += 3 * p[2] + p[1]
            for c in clubs:
                errs[f].append(abs(ex[c] - fin[c]))
                if now[c][1]:
                    perr[f].append(abs(now[c][0] / now[c][1] * 2 * (n - 1) - fin[c]))
good = all(abs(W['test']['all'][str(f)]['elo'] - sum(errs[f]) / len(errs[f])) < 0.011 and abs(W['test']['all'][str(f)]['ppg'] - sum(perr[f]) / len(perr[f])) < 0.011 and W['test']['all'][str(f)]['n'] == len(errs[f]) for f in errs)
ok(good, 'the test worked again by a second implementation: ' + '; '.join('%s Elo %.2f, points per game %.2f (%d)' % (f, sum(errs[f]) / len(errs[f]), sum(perr[f]) / len(perr[f]), len(errs[f])) for f in errs))
print('done' if not fails else '%d FAILED' % fails)
sys.exit(1 if fails else 0)
