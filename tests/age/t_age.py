# Age curves (data/age_curves.json, written by tools/age/fit.py): the file worked again from data/career.json and data/tm.json with a second implementation (a player-season table
# instead of row identities): the pairs, the z-scores against position / league / season, the mean change and standard error at each age for every stat and position, the
# running-sum curve, and the leave-one-season-pair-out test, plus the sentences the page prints about it (they must still be true of the file).
import json, os, math, datetime, collections, statistics
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
J = lambda f: json.load(open(os.path.join(REPO, 'data', f), encoding='utf-8'))
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


A, C, TM = J('age_curves.json'), J('career.json'), J('tm.json')
STATS = A['stats']
NAME = {'npxg': 9, 'sh': 12, 'kp': 13, 'tkic': 14}


def p90(r, k):
    if k == 'xag':
        return r[10] * 90 / r[11] if r[11] >= r[5] * .5 else None
    return r[NAME[k]] * 90 / r[5]


# player-season table: (pid, season, league) -> row
tab = {}
for pid, L in C['p'].items():
    for r in L:
        if r[5] >= 900 and r[3] in ('DF', 'MF', 'FW'):
            tab[(pid, r[0], r[1])] = r
z = {}
for k in STATS:
    grp = collections.defaultdict(list)
    for key, r in tab.items():
        v = p90(r, k)
        if v is not None:
            grp[(r[0], r[1], r[3])].append((key, v))
    for g, items in grp.items():
        if len(items) < 10:
            continue
        vals = [v for _, v in items]
        mu = statistics.fmean(vals)
        sd = statistics.pstdev(vals) or 1
        for key, v in items:
            z[(key, k)] = (v - mu) / sd
pairs = []
for (pid, s, lg), r in tab.items():
    d = TM['p'].get(pid)
    if not d or not d[0]:
        continue
    y = int(s[:4])
    nx = '%d-%02d' % (y + 1, (y + 2) % 100)
    r2 = tab.get((pid, nx, lg))
    if not r2 or r2[3] != r[3]:
        continue
    dob = datetime.date.fromisoformat(d[0])
    age = y - dob.year - (1 if (8, 1) < (dob.month, dob.day) else 0)
    if not 15 <= age <= 45:
        continue
    st = {k: (z[((pid, s, lg), k)], z[((pid, nx, lg), k)]) for k in STATS if ((pid, s, lg), k) in z and ((pid, nx, lg), k) in z}
    if st:
        pairs.append((pid, s, r[3], min(max(age, 18), 36), st))
ok(len(pairs) == A['pairs'] and len({p[0] for p in pairs}) == A['players'], 'the same %d season pairs of %d players as a recount' % (len(pairs), A['players']))
bad = 0
for k in STATS:
    for pos in A['pos']:
        by = collections.defaultdict(list)
        for pid, s, ps, age, st in pairs:
            if (pos == 'ALL' or ps == pos) and k in st:
                by[age].append(st[k][1] - st[k][0])
        c = A['curves'][k][pos]
        if c['n'] != sum(len(v) for v in by.values()) or set(map(int, c['age'])) != set(by):
            bad += 1
            continue
        for a, v in by.items():
            n, m, se = c['age'][str(a)]
            sed = statistics.stdev(v) / math.sqrt(len(v)) if len(v) > 1 else None
            if n != len(v) or abs(m - statistics.fmean(v)) > 1e-4 or (sed is None) != (se is None) or (sed is not None and abs(se - sed) > 1e-4):
                bad += 1
        # the curve: running sum of the means of ages with 8+ pairs, from the lowest such age, 0 at the highest level
        use = {a: statistics.fmean(v) for a, v in by.items() if len(v) >= 8}
        if use:
            lo, hi = min(use), max(use)
            lv, cur = {lo: 0.0}, 0.0
            for a in range(lo, hi):
                cur += use.get(a, 0.0)
                lv[a + 1] = cur
            top = max(lv.values())
            exp = {a: x - top for a, x in lv.items()}
            if set(map(int, c['curve'])) != set(exp) or any(abs(c['curve'][str(a)] - x) > 2e-4 for a, x in exp.items()):
                bad += 1
        elif c['curve']:
            bad += 1
ok(bad == 0, 'every age\'s count, mean change and standard error, and every curve, equal the recount for 5 stats x 4 position choices (%d differ)' % bad)
# leave one season pair out
seas = sorted({p[1] for p in pairs})
band = lambda a: 'u23' if a <= 23 else 'a24' if a <= 29 else 'a30'
for k in STATS:
    dA, dB = [], []
    for s in seas:
        tr = [p for p in pairs if p[1] != s and k in p[4]]
        byp, byb = collections.defaultdict(list), collections.defaultdict(list)
        for pid, s2, ps, age, st in tr:
            byp[(ps, age)].append(st[k][1] - st[k][0]); byb[band(age)].append(st[k][1] - st[k][0])
        for pid, s2, ps, age, st in pairs:
            if s2 != s or k not in st:
                continue
            z1, z2 = st[k]
            v = byp.get((ps, age), [])
            a1 = statistics.fmean(v) if len(v) >= 8 else 0.0
            a2 = statistics.fmean(byb[band(age)]) if byb[band(age)] else 0.0
            dA.append((z2 - z1) ** 2 - (z2 - z1 - a1) ** 2); dB.append((z2 - z1) ** 2 - (z2 - z1 - a2) ** 2)
    t = A['test'][k]
    ok(t['n'] == len(dA) and abs(t['gain'] - statistics.fmean(dA)) < 1e-4 and abs(t['se'] - statistics.stdev(dA) / math.sqrt(len(dA))) < 1e-4 and abs(t['gain_band'] - statistics.fmean(dB)) < 1e-4 and abs(t['se_band'] - statistics.stdev(dB) / math.sqrt(len(dB))) < 1e-4,
       '%s: leave-one-pair-out gain %.4f (age and position) and %.4f (band) equal the recount' % (k, t['gain'], t['gain_band']))
# the sentences the page prints must still be true of the file
T = A['test']
worse_age = [k for k in STATS if T[k]['gain'] < 0]
beyond = [k for k in STATS if T[k]['gain'] < -1.96 * T[k]['se']]
better_band = [k for k in STATS if T[k]['gain_band'] > 1.96 * T[k]['se_band']]
ok(len(worse_age) == 5 and len(beyond) == 4 and not better_band, 'the page says: worse per age and position for every stat (%d of 5), beyond noise for four (%d), never better by band beyond noise (%d)' % (len(worse_age), len(beyond), len(better_band)))
print('%d FAILED' % fails if fails else 'all passed')
raise SystemExit(1 if fails else 0)
