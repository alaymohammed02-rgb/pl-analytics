"""Who keeps it up? (tools/regress/fit.py -> data/regress.json): the shrinkage rule on made-up players with a known answer, then the real file
worked again with a second, plain implementation (own per-90, own K search, own paired error), and the shape of the file."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(ROOT, "tools", "regress"))
import fit

n = 0
def ok(c, m):
    global n
    if not c:
        print("FAIL", m); sys.exit(1)
    print("ok  ", m); n += 1

# the rule on made-up numbers
x = {"pos": "FW", "gl": 1.0, "m_gl": 900.0}
mu = {"FW": 0.4}
ok(abs(fit.guess(x, "gl", mu, 0) - 1.0) < 1e-12, "K = 0: the number itself")
ok(abs(fit.guess(x, "gl", mu, 900) - 0.7) < 1e-12, "m = K: halfway between the number and the position mean (0.4 + 0.6 / 2 = 0.7)")
ok(abs(fit.guess({"pos": "FW", "gl": 1.0, "m_gl": 100.0}, "gl", mu, 900) - 0.46) < 1e-12, "fewer minutes: pulled harder (100 / 1000 of the gap: 0.46)")
ok(fit.guess({"pos": "FW", "gl": 0.1, "m_gl": 900.0}, "gl", mu, 900) > 0.1, "a number below the mean is pulled up")

# per90: minutes of the matches that have the number, goalkeepers and no-position players left out
cols = ["i", "mi", "o", "gl", "xg"]
rows = [["a", 90, "FW", 1, 0.5], ["a", 90, "FW", 0, 0.5], ["a", 45, "FW", None, None], ["g", 90, "GK", 0, 0.0], ["z", 90, None, 1, 1.0], ["m", 60, "MF", 0, 0.1]]
P = fit.per90(rows, cols)
ok(set(P) == {"a", "m"}, "goalkeeper and a player without a position are left out")
ok(abs(P["a"]["gl"] - 0.5) < 1e-12 and P["a"]["m_gl"] == 180 and P["a"]["mi"] == 225, "per 90 = total ÷ minutes of the matches with the number × 90 (1 goal in 180 min = 0.5); minutes = all matches")

# the real file against a second implementation
D = os.path.join(ROOT, "data")
F = json.load(open(os.path.join(D, "regress.json")))
def table(f, k):
    d = json.load(open(f)); ix = {c: i for i, c in enumerate(d["cols"])}; T = {}
    for r in d["rows"]:
        if r[ix["mi"]] is None: continue
        t = T.setdefault(r[ix["i"]], {"mi": 0.0, "pos": {}, "s": 0.0, "m": 0.0})
        t["mi"] += r[ix["mi"]]
        if r[ix["o"]]: t["pos"][r[ix["o"]]] = t["pos"].get(r[ix["o"]], 0) + r[ix["mi"]]
        if r[ix[k]] is not None: t["s"] += r[ix[k]]; t["m"] += r[ix["mi"]]
    out = {}
    for p, t in T.items():
        if not t["pos"] or t["m"] == 0: continue
        pos = max(t["pos"], key=t["pos"].get)
        if pos != "GK": out[p] = (t["mi"], pos, t["s"] / t["m"] * 90, t["m"])
    return out
def pairs2(L, a, b, k):
    A = table(f"{D}/{L}_{a}_pl.json", k); B = table(f"{D}/{L}_{b}_pl.json", k)
    return [(A[p], B[p]) for p in A if p in B and A[p][0] >= 450 and B[p][0] >= 900]
def means(P):
    g = {}
    for x, _ in P: g.setdefault(x[1], []).append(x[2])
    return {q: sum(v) / len(v) for q, v in g.items() if len(v) >= 5}
for k in ("gl", "ast", "ps"):
    fitP = []
    for a, b in fit.FIT_PAIRS: fitP += pairs2("l_4WFCIZ", a, b, k)
    mu = means(fitP); T = [(x, y) for x, y in fitP if x[1] in mu and y[1] in mu]
    best = None
    for K in range(0, 6001, 100):
        e = sum((mu[x[1]] + (x[2] - mu[x[1]]) * x[3] / (x[3] + K) - y[2]) ** 2 for x, y in T)
        if best is None or e < best[0] - 1e-12: best = (e, K)
    K = best[1]
    d = []
    for L in fit.LEAGUES:
        P = pairs2(L, *fit.TEST_PAIR, k); m2 = means(P)
        for x, y in P:
            if x[1] in m2: d.append(((x[2] - y[2]) ** 2, (m2[x[1]] + (x[2] - m2[x[1]]) * x[3] / (x[3] + K) - y[2]) ** 2))
    N = len(d); m0 = sum(a for a, _ in d) / N; m1 = sum(b for _, b in d) / N
    S = F["stats"][k]
    ok(S["K"] == K and S["n"] == N and abs(S["rmse_raw"] - m0 ** .5) < 6e-5 and abs(S["rmse_shrunk"] - m1 ** .5) < 6e-5 and abs(S["gain"] - (m0 - m1) / m0) < 6e-5,
       f"{k}: K {K}, {N} test players, error {m0**.5:.4f} → {m1**.5:.4f}, gain {(m0-m1)/m0:.3f} — the file's numbers worked again")

# shape and sense
ok(list(F["stats"]) == fit.STATS and all(0 <= v["K"] <= 6000 and v["n"] > 300 and v["se"] > 0 for v in F["stats"].values()), "every stat has K, a test size and a standard error")
ok(F["stats"]["gl"]["gain"] > 1.96 * F["stats"]["gl"]["se"] and F["stats"]["ast"]["gain"] > 1.96 * F["stats"]["ast"]["se"], "goals and assists: the rule beats the raw number beyond noise")
ok(abs(F["stats"]["ps"]["gain"]) <= 1.96 * F["stats"]["ps"]["se"], "passes: no gain beyond noise (the page says so)")
print("all passed")
