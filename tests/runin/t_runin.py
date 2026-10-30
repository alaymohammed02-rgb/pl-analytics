"""Run-in test file (data/runin.json, written by tools/runin/fit.py): the whole back-test worked again from data/results.json with a second implementation (its own
Elo run, its own expectations, its own statistics), then the shape of the file: three checkpoints for all seasons and for 2025-26, the counts, the sign conventions
and that the schedule effect really is small."""
import os, sys, json, math
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
bad = []


def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c:
        bad.append(m)


R_ = json.load(open(os.path.join(ROOT, "data", "results.json"), encoding="utf-8"))
RT = json.load(open(os.path.join(ROOT, "data", "runin.json"), encoding="utf-8"))
K, H, REG, S, C = 30.0, 50.0, 0.1, 175.0, 0.55
assert R_["params"] == {"K": K, "H": H, "reg": REG, "s": S, "c": C}, R_["params"]


def season_of(d):
    return int(d[:4]) if int(d[5:7]) >= 7 else int(d[:4]) - 1


def logit3(dr):
    w = 1 / (1 + math.exp(-(dr / S - C)))
    l = 1 - 1 / (1 + math.exp(-(dr / S + C)))
    return w, 1 - w - l, l


def ratings_before(allm, upto):
    """Elo from the matches before `upto` (date, home, away, hg, ag, id), a new season's pull applied if `upto` is in a later season than the last match."""
    R, last = {}, None
    for d, h, a, g1, g2, mid in sorted((m for m in allm if m[0] < upto), key=lambda m: (m[0], m[5])):
        if last is not None and season_of(d) != last:
            mu = sum(R.values()) / len(R)
            R = {t: mu + (1 - REG) * (v - mu) for t, v in R.items()}
        last = season_of(d)
        for t in (h, a):
            if t not in R:
                R[t] = sum(R.values()) / len(R) if R else 1500.0
        e = 1 / (1 + 10 ** (-(R[h] - R[a] + H) / 400))
        sc = 1.0 if g1 > g2 else 0.5 if g1 == g2 else 0.0
        gd = abs(g1 - g2)
        mult = 1.0 if gd <= 1 else 1.5 if gd == 2 else (11 + gd) / 8
        R[h] += K * mult * (sc - e)
        R[a] -= K * mult * (sc - e)
    if R and last is not None and season_of(upto) != last:
        mu = sum(R.values()) / len(R)
        R = {t: mu + (1 - REG) * (v - mu) for t, v in R.items()}
    return R


rows = []
for lid, L in R_["leagues"].items():
    T = L["teams"]
    seasons = [(s["s"], [(m[0], T[m[1]], T[m[2]], m[3], m[4], m[5]) for m in s["m"]]) for s in L["seasons"]]
    allm = [m for _, ms in seasons for m in ms]
    for lab, ms in seasons:
        teams = sorted({t for m in ms for t in (m[1], m[2])})
        if not ms or len(ms) != len(teams) * (len(teams) - 1):
            continue
        ms = sorted(ms, key=lambda m: (m[0], m[5]))
        fin = {t: 0 for t in teams}
        for d, h, a, g1, g2, mid in ms:
            fin[h] += 3 if g1 > g2 else 1 if g1 == g2 else 0
            fin[a] += 3 if g2 > g1 else 1 if g1 == g2 else 0
        for f in RT["check"]:
            upto = ms[int(f * len(ms))][0]
            Rt = ratings_before(allm, upto)
            mu = sum(Rt.values()) / len(Rt)
            r = {t: Rt.get(t, mu) for t in teams}
            now = {t: 0 for t in teams}
            done = set()
            for d, h, a, g1, g2, mid in ms:
                if d < upto:
                    done.add((h, a))
                    now[h] += 3 if g1 > g2 else 1 if g1 == g2 else 0
                    now[a] += 3 if g2 > g1 else 1 if g1 == g2 else 0
            for t in teams:
                es = ef = 0.0
                others = [r[u] for u in teams if u != t]
                avg = sum(others) / len(others)
                for u in teams:
                    if u == t:
                        continue
                    if (t, u) not in done:                      # t at home against u
                        w, dr_, l = logit3(r[t] - r[u] + H); es += 3 * w + dr_
                        w, dr_, l = logit3(r[t] - avg + H); ef += 3 * w + dr_
                    if (u, t) not in done:                      # t away at u
                        w, dr_, l = logit3(r[u] - r[t] + H); es += 3 * l + dr_
                        w, dr_, l = logit3(avg - r[t] + H); ef += 3 * l + dr_
                rows.append((lid, lab, f, t, fin[t] - now[t], es, ef))


def stats(rs):
    n = len(rs)
    d = [abs(x[5] - x[4]) - abs(x[6] - x[4]) for x in rs]
    md = sum(d) / n
    se = math.sqrt(sum((v - md) ** 2 for v in d) / (n - 1) / n)
    xs = [x[5] - x[6] for x in rs]
    ys = [x[4] - x[6] for x in rs]
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((v - mx) ** 2 for v in xs)
    b = sum((xs[i] - mx) * (ys[i] - my) for i in range(n)) / sxx
    res = sum((ys[i] - my - b * (xs[i] - mx)) ** 2 for i in range(n))
    return {"n": n, "seasons": len({(x[0], x[1]) for x in rs}), "sched": round(sum(abs(x[5] - x[4]) for x in rs) / n, 3), "flat": round(sum(abs(x[6] - x[4]) for x in rs) / n, 3),
            "d": round(md, 3), "se": round(se, 3), "slope": round(b, 3), "slope_se": round(math.sqrt(res / (n - 2) / sxx), 3), "spread": round(math.sqrt(sum(v * v for v in xs) / n), 2)}


def close(a, b):
    return a.keys() == b.keys() and all(abs(a[k] - b[k]) <= (0.0011 if isinstance(a[k], float) else 0) for k in a)


ok(RT["check"] == [0.25, 0.5, 0.75], "three checkpoints: a quarter, half and three quarters of the matches")
for f in RT["check"]:
    for key, sel in (("all", lambda x: True), ("new", lambda x: x[1] >= "2025-26")):
        mine = stats([x for x in rows if x[2] == f and sel(x)])
        ok(close(mine, RT[key][str(f)]), "%s at %d%%: %d club-seasons of %d seasons, errors %.3f / %.3f, difference %+.3f ± %.3f, slope %.2f ± %.2f: the file equals the second implementation" % (
            key, f * 100, mine["n"], mine["seasons"], mine["sched"], mine["flat"], mine["d"], mine["se"], mine["slope"], mine["slope_se"]))
a = RT["all"]
ok(all(a[str(f)]["n"] == 288 and a[str(f)]["seasons"] == 15 for f in RT["check"]), "15 finished seasons of six leagues, 288 club-seasons, at every checkpoint")
ok(all(RT["new"][str(f)]["seasons"] == 6 and RT["new"][str(f)]["n"] == 114 for f in RT["check"]), "2025-26 (not used to fit Elo): 6 leagues, 114 club-seasons")
ok(all(a[str(f)]["spread"] < 1.5 for f in RT["check"]), "the schedule effect is small: its root mean square is under 1.5 points at every checkpoint (%s)" % ", ".join(str(a[str(f)]["spread"]) for f in RT["check"]))
# the Elo error of this file is the Time machine's own number (same expectation, same days)
tm = R_["test"]["all"]
ok(all(abs(a[str(f)]["sched"] - tm[str(f)]["elo"]) < 0.011 for f in RT["check"]), "the error with the real opponents equals the Time machine's Elo error in data/results.json (%s)" % ", ".join("%s: %s" % (f, tm[str(f)]["elo"]) for f in RT["check"]))
print("%d FAILED" % len(bad) if bad else "all passed")
sys.exit(1 if bad else 0)
