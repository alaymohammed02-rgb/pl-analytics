"""Fit and test the "who keeps it up" shrinkage, write data/regress.json. Run offline: python3 tools/regress/fit.py

A player's per-90 number in one season is partly the player and partly luck, so the best guess for next season is pulled towards
the average of his position, harder the fewer minutes he has:  guess = mu + (x - mu) * m / (m + K),  m = minutes, mu = the mean
of his position in that league that season, K fitted per stat.
  Fit:  Premier League pairs 2021-22 to 2022-23, 2022-23 to 2023-24, 2023-24 to 2024-25 (450+ minutes in the first season, 900+ in the next).
  Test: the same rule on the six leagues, 2024-25 to 2025-26, K and nothing else taken from the fit (mu from that league's own season).
        Scored against "next season = this season" (the raw number), by squared error, with the paired difference judged against its standard error.
Goalkeepers are left out. A stat is counted only in matches where PitchAPI has it (minutes of those matches)."""
import json, os, sys, datetime

STATS = ["gl", "xg", "npxg", "sh", "ast", "xag", "kp", "ps", "tk", "ic"]
LEAGUES = ["l_4WFCIZ", "l_0ErfuF", "l_1Isor4", "l_3FJFUl", "l_0ALvwF", "l_4QexZg"]
FIT_PAIRS = [("2021-22", "2022-23"), ("2022-23", "2023-24"), ("2023-24", "2024-25")]
TEST_PAIR = ("2024-25", "2025-26")
MIN_X, MIN_Y = 450, 900
KS = range(0, 6001, 100)


def per90(rows, cols, stats=STATS):
    ix = {c: i for i, c in enumerate(cols)}
    acc = {}
    for r in rows:
        mi = r[ix["mi"]]
        if mi is None:
            continue
        a = acc.setdefault(r[ix["i"]], {"mi": 0.0, "pos": {}, "t": {}, "d": {}})
        a["mi"] += mi
        if r[ix["o"]]:
            a["pos"][r[ix["o"]]] = a["pos"].get(r[ix["o"]], 0.0) + mi
        for k in stats:
            v = r[ix[k]] if k in ix else None
            if v is not None:
                a["t"][k] = a["t"].get(k, 0.0) + v
                a["d"][k] = a["d"].get(k, 0.0) + mi
    out = {}
    for pid, a in acc.items():
        pos = max(a["pos"].items(), key=lambda kv: kv[1])[0] if a["pos"] else None
        if pos in (None, "GK"):
            continue
        o = {"mi": a["mi"], "pos": pos}
        for k in stats:
            if a["d"].get(k, 0) > 0:
                o[k] = a["t"][k] / a["d"][k] * 90
                o["m_" + k] = a["d"][k]
        out[pid] = o
    return out


def pos_means(players, k, min_n=5):
    g = {}
    for x in players:
        if k in x:
            g.setdefault(x["pos"], []).append(x[k])
    return {p: sum(v) / len(v) for p, v in g.items() if len(v) >= min_n}


def guess(x, k, mu, K):
    m = x["m_" + k]
    return mu[x["pos"]] + (x[k] - mu[x["pos"]]) * m / (m + K)


def load(root, league, season):
    d = json.load(open(os.path.join(root, f"{league}_{season}_pl.json")))
    return per90(d["rows"], d["cols"])


def pairs(root, league, a, b):
    A, B = load(root, league, a), load(root, league, b)
    return [(x, B[p]) for p, x in A.items() if p in B and x["mi"] >= MIN_X and B[p]["mi"] >= MIN_Y]


def fit_k(P, k):
    mu = pos_means([x for x, _ in P], k)
    T = [(x, y) for x, y in P if k in x and k in y and x["pos"] in mu and y["pos"] in mu]
    return min(KS, key=lambda K: (sum((guess(x, k, mu, K) - y[k]) ** 2 for x, y in T), K)), len(T)


def score(by_league, k, K):
    d = []
    for P in by_league.values():
        mu = pos_means([x for x, _ in P], k)
        for x, y in P:
            if k in x and k in y and x["pos"] in mu:
                d.append(((x[k] - y[k]) ** 2, (guess(x, k, mu, K) - y[k]) ** 2))
    n = len(d)
    m0 = sum(a for a, _ in d) / n
    m1 = sum(b for _, b in d) / n
    diff = [a - b for a, b in d]
    md = sum(diff) / n
    se = (sum((v - md) ** 2 for v in diff) / (n - 1) / n) ** 0.5
    return {"n": n, "rmse_raw": round(m0 ** 0.5, 4), "rmse_shrunk": round(m1 ** 0.5, 4),
            "gain": round(md / m0, 4), "se": round(se / m0, 4)}


def build(root):
    fit = []
    for a, b in FIT_PAIRS:
        fit += pairs(root, LEAGUES[0], a, b)
    test = {L: pairs(root, L, *TEST_PAIR) for L in LEAGUES}
    stats = {}
    for k in STATS:
        K, nfit = fit_k(fit, k)
        stats[k] = dict(K=K, n_fit=nfit, **score(test, k, K))
    return {"t": datetime.date.today().isoformat(), "min_x": MIN_X, "min_y": MIN_Y,
            "fit": "Premier League " + ", ".join(f"{a} to {b}" for a, b in FIT_PAIRS), "test": "six leagues, %s to %s" % TEST_PAIR,
            "n_test": sum(len(v) for v in test.values()), "stats": stats}


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "data")
    out = build(root)
    json.dump(out, open(os.path.join(root, "regress.json"), "w"), separators=(",", ":"))
    for k, v in out["stats"].items():
        print(k, v)
