"""Bench impact (tools/bench/fit.py -> data/bench.json): which appearances are substitute appearances and the position he is counted in, on made-up files with a known
answer; the Spearman helper, the z-scores within a position, the year-to-year and odd/even tests on made-up seasons; then the real file worked again with a second
implementation (another way to find the substitutes, another correlation formula) and compared number by number."""
import json, os, sys, math, collections
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(ROOT, "tools", "bench"))
import fit

n = 0
def ok(c, m):
    global n
    if not c:
        print("FAIL", m); sys.exit(1)
    print("ok  ", m); n += 1

cols = ["m", "i", "o", "mi", "npxg", "sh", "kp", "gl", "ast"]
pl = {"cols": cols, "rows": [
    ["m1", "p1", "FW", 90, 0.5, 2, 1, 1, 0],     # starter
    ["m1", "p2", "DF", 90, 0.0, 0, 0, 0, 0],     # starter
    ["m1", "p3", "MF", 90, 0.1, 1, 2, 0, 0],     # starter of the away side
    ["m1", "p4", "FW", 30, 0.3, 2, 1, 1, 1],     # substitute: 30 minutes
    ["m1", "p5", "MF", 0, 0.0, 0, 0, 0, 0],      # on the bench, never played
    ["m2", "p4", "FW", 20, 0.2, 1, 0, 0, 0],     # match without line-ups: not counted as a substitute appearance, but his minutes count for his position
    ["m3", "p4", "MF", 60, 0.0, 0, 0, 0, 0],     # started m3 (in xi)
    ["m4", "p6", None, 25, 0.1, 1, 1, 0, 1],     # substitute with no position label
]}
mx = {"m1": {"lu": {"h": {"xi": [["p1", "A", "9", 100], ["p2", "B", "4", 34]]}, "a": {"xi": [["p3", "C", "8", 66]]}}},
      "m3": {"lu": {"h": {"xi": [["p4", "D", "9", 100]]}, "a": {"xi": []}}},
      "m4": {"lu": {"h": {"xi": [["p9", "E", "1", 11]]}, "a": {"xi": []}}}}
subs, main = fit.appearances(pl, mx, {"m1": "2026-01-01", "m3": "2026-01-10", "m4": "2026-01-20"})
ok(set(subs) == {"p4", "p6"}, "substitutes: p4 (m1) and p6 (m4); starters, a bench player with no minutes and a match without line-ups are not")
ok(subs["p4"] == [("2026-01-01", "m1", 30, 0.3, 2, 1, 2)], "p4's substitute appearance: date, match, minutes, npxG, shots, key passes, goals + assists = %s" % (subs["p4"],))
ok(main["p1"] == "FW" and "p6" not in main, "a player with no position label gets no position")
ok(main["p4"] == "MF", "p4: 50 minutes as FW and 60 as MF -> MF")
ok(fit.rate(subs["p4"], "xg") == 0.3 / 30 * 90 and fit.rate(subs["p4"], "ga") == 2 / 30 * 90, "per 90: npxG 0.9 and goals + assists 6.0 for 30 minutes")

ok(abs(fit.spearman([1, 2, 3, 4], [10, 20, 30, 40]) - 1) < 1e-12 and abs(fit.spearman([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-12, "Spearman: +1 for the same order, -1 for the reverse")
ok(fit.ranks([5, 1, 5, 3]) == [3.5, 1.0, 3.5, 2.0], "ties take the average rank")
ok(0 < fit.spearman([1, 1, 2], [1, 2, 3]) < 1, "a tie in one list still gives a number between 0 and 1")
lo, hi = fit.interval(0.5, 103)
ok(abs(lo - math.tanh(math.atanh(0.5) - 1.96 / 10)) < 1e-12 and abs(hi - math.tanh(math.atanh(0.5) + 1.96 / 10)) < 1e-12 and fit.interval(0.5, 3) == (None, None), "Fisher interval: 1.96 / sqrt(n - 3), none under 4")

Z = fit.zscores([("a%d" % i, "FW", float(i)) for i in range(8)] + [("x", "DF", 1.0), ("y", "DF", 9.0)])
ok(len(Z) == 8 and "x" not in Z and abs(sum(Z.values())) < 1e-9 and abs(sum(v * v for v in Z.values()) - 7) < 1e-9, "z-scores within a position: mean 0, sd 1; a position with fewer than 8 players is left out")

def app(date, mid, mi, xg, sh=0.0, kp=0.0, ga=0):
    return (date, mid, mi, xg, sh, kp, ga)
def season(vals, pos="FW", mi=180):
    subs = {"p%d" % i: [app("2026-01-%02d" % (j + 1), "m%d_%d" % (i, j), mi / 2, v * mi / 2 / 90) for j in range(2)] for i, v in enumerate(vals)}
    return subs, {p: pos for p in subs}
S = {"2000-01": season([1, 2, 3, 4, 5, 6, 7, 8]), "2001-02": season([2, 3, 4, 5, 6, 7, 8, 9])}
y = fit.year_to_year(S, "xg")
ok(y["n"] == 8 and abs(y["r"] - 1) < 1e-9, "year to year: eight players in the same order in both seasons -> r = 1 over 8 pairs")
S2 = {"2000-01": season([1, 2, 3, 4, 5, 6, 7, 8]), "2001-02": season([8, 7, 6, 5, 4, 3, 2, 1])}
ok(abs(fit.year_to_year(S2, "xg")["r"] + 1) < 1e-9, "year to year: the reverse order -> r = -1")
S3 = {"2000-01": season([1, 2, 3, 4, 5, 6, 7, 8], mi=100), "2001-02": season([1, 2, 3, 4, 5, 6, 7, 8], mi=100)}
ok(fit.year_to_year(S3, "xg")["n"] == 0, "under 150 substitute minutes in a season: not counted")
# within a season: odd and even appearances with the same value -> r = 1; the corrected value is 1 too
S4 = {"2000-01": season([1, 2, 3, 4, 5, 6, 7, 8], mi=240)}
h = fit.within_season(S4, "xg")
ok(h["n"] == 8 and abs(h["r"] - 1) < 1e-9 and abs(h["sb"] - 1) < 1e-9, "odd against even: equal halves -> r = 1, corrected 1 over 8 players")
S5 = {"2000-01": season([1, 2, 3, 4, 5, 6, 7, 8], mi=150)}
ok(fit.within_season(S5, "xg")["n"] == 0, "under 200 substitute minutes in the season: not counted for the odd/even test")

# the real file against a second implementation
B = json.load(open(os.path.join(ROOT, "data", "bench.json"), encoding="utf-8"))
def second(sea):
    """substitutes found the other way round: for each match with line-ups, the players with minutes minus the starters of that match"""
    d = os.path.join(ROOT, "data")
    pl = json.load(open(os.path.join(d, "l_4WFCIZ_%s_pl.json" % sea)))
    mx = json.load(open(os.path.join(d, "l_4WFCIZ_%s_mx.json" % sea)))["m"]
    lg = json.load(open(os.path.join(d, "l_4WFCIZ_%s.json" % sea)))["matches"]
    date = {m["i"]: m["d"][:10] for m in lg}
    ix = {c: i for i, c in enumerate(pl["cols"])}
    played = collections.defaultdict(dict)
    posmin = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in pl["rows"]:
        if r[ix["mi"]]:
            played[r[ix["m"]]][r[ix["i"]]] = r
            if r[ix["o"]]:
                posmin[r[ix["i"]]][r[ix["o"]]] += r[ix["mi"]]
    res = collections.defaultdict(list)
    for mid, v in mx.items():
        xi = set()
        for side in "ha":
            xi |= {p[0] for p in ((v.get("lu") or {}).get(side) or {}).get("xi") or []}
        if not xi:
            continue
        for pid, r in played.get(mid, {}).items():
            if pid not in xi:
                res[pid].append((date.get(mid, ""), mid, r[ix["mi"]], r[ix["npxg"]], r[ix["sh"]], r[ix["kp"]], r[ix["gl"]] + r[ix["ast"]]))
    pos = {p: max(sorted(d), key=lambda k: d[k]) for p, d in posmin.items()}
    return res, pos
SS = {s: second(s) for s in B["seasons"]}
FF = {s: fit.load_season(s) for s in B["seasons"]}
ok(all(set(SS[s][0]) == set(FF[s][0]) for s in B["seasons"]), "both ways of finding the substitutes agree on who came on, in all five seasons")
ok(all(sorted(SS[s][0][p]) == sorted(FF[s][0][p]) for s in B["seasons"] for p in SS[s][0]), "and on every appearance: date, match, minutes, npxG, shots, key passes, goals + assists")
def pearson(a, b):
    k = len(a); ma = sum(a) / k; mb = sum(b) / k
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
def rk(v):
    return [sum(1 for y in v if y < x) + (sum(1 for y in v if y == x) + 1) / 2 for x in v]
def zpos(items):
    by = collections.defaultdict(list)
    for p, q, v in items: by[q].append((p, v))
    out = {}
    for q, l in by.items():
        if len(l) < 8: continue
        m = sum(v for _, v in l) / len(l); sd = math.sqrt(sum((v - m) ** 2 for _, v in l) / (len(l) - 1))
        for p, v in l: out[p] = (v - m) / sd
    return out
IDX = {"xg": 3, "sh": 4, "kp": 5, "ga": 6}
def per90(ap, k): return sum(a[IDX[k]] for a in ap) / sum(a[2] for a in ap) * 90
for k in ["xg", "sh", "kp", "ga"]:
    Z = {s: zpos([(p, SS[s][1][p], per90(ap, k)) for p, ap in SS[s][0].items() if p in SS[s][1] and sum(a[2] for a in ap) >= 150]) for s in B["seasons"]}
    xs, ys = [], []
    for a, b in zip(B["seasons"], B["seasons"][1:]):
        for p in Z[a]:
            if p in Z[b]: xs.append(Z[a][p]); ys.append(Z[b][p])
    r = pearson(rk(xs), rk(ys)); m = B["measures"][k]["yoy"]
    ok(len(xs) == m["n"] and abs(r - m["r"]) < 1e-9, "%s year to year: %d pairs, r %.3f equals the file's (second implementation)" % (k, len(xs), r))
    za, zb = [], []
    for s in B["seasons"]:
        A, Bh = [], []
        for p, ap in SS[s][0].items():
            ap = sorted(ap)
            if p not in SS[s][1] or sum(a[2] for a in ap) < 200: continue
            ha, hb = [a for i, a in enumerate(ap) if i % 2 == 0], [a for i, a in enumerate(ap) if i % 2 == 1]
            if sum(a[2] for a in ha) < 60 or sum(a[2] for a in hb) < 60: continue
            A.append((p, SS[s][1][p], per90(ha, k))); Bh.append((p, SS[s][1][p], per90(hb, k)))
        ZA, ZB = zpos(A), zpos(Bh)
        for p in ZA:
            if p in ZB: za.append(ZA[p]); zb.append(ZB[p])
    r = pearson(rk(za), rk(zb)); h = B["measures"][k]["half"]
    ok(len(za) == h["n"] and abs(2 * r / (1 + r) - h["sb"]) < 1e-9, "%s odd/even: %d players, corrected r %.3f equals the file's" % (k, len(za), 2 * r / (1 + r)))
ok(all(B["measures"][k]["yoy"]["lo"] < B["measures"][k]["yoy"]["r"] < B["measures"][k]["yoy"]["hi"] for k in B["measures"]), "each year-to-year r lies inside its own interval")
print("%d checks" % n)
