"""XI Battle (the "XIB" block of sync.py). Offline helper:
  python3 tools/xib/fit.py --fit     grid of half-life and shrinkage, and the Poisson coefficients, on matches from 2022-08-01 to before 2025-08-01 only
                                     (the first year of the Premier League chain only builds the ratings); prints the best setting
  python3 tools/xib/fit.py --test    every match from 2025-08-01 with both official line-ups, predicted before it is played from its two real XIs;
                                     writes data/xib_test.json: Brier and accuracy against Elo from results (sync.py "ELO2") and the base rates, per league
  python3 tools/xib/fit.py --write   writes data/xib.json from the local data/ files, exactly as the sync does
The settings now in sync.py are the result of --fit on 28 Oct 2026 (half-life 365 days, Ka 2, Kt 3; the training Brier hardly moves across the grid:
0.5666 to 0.5676), and --test then gave Brier 0.5907 on 2,527 matches, against 0.5897 for Elo and 0.6494 for the base rates."""
import os, re, sys, json, math, hashlib, datetime, itertools

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src = open(os.path.join(ROOT, "sync.py"), encoding="utf-8").read()
cut = lambda a, b: src[src.index(a):src.index(b)]
LOG, PUT = [], {}
def gj(hub, p):
    f = os.path.join(ROOT, p)
    return json.load(open(f, encoding="utf-8")) if os.path.exists(f) else None
G = {"os": os, "re": re, "json": json, "hashlib": hashlib, "datetime": datetime, "log": lambda *a: LOG.append(" ".join(map(str, a))), "run_pipeline": lambda h, k: True,
     "gh_get_json": gj, "gh_put": lambda h, p, c, m: PUT.__setitem__(p, c)}
exec(cut("MK_LEAGUES = ", "MK_FD = "), G)
exec(cut("# ===== ELO2 START =====", "# ===== ELO2 END ====="), G)
exec(cut("# ===== XIB START =====", "# ===== XIB END ====="), G)
SPLIT, WARM = "2025-08-01", "2022-08-01"


def load():
    idx, sj = gj(None, "data/index.json"), gj(None, "data/seasons.json") or {}
    files = [(lid,) + f for lid in G["XIB_LEAGUES"] for f in G["xib_files"](sj, idx, lid)]
    return G["xib_load"](lambda p: gj(None, p), files)


def xis(M):
    """{match: {team: [11 player ids]}} from the official line-ups (both sides with 11)"""
    out, cache = {}, {}
    for mid, m in M.items():
        if not m["mx"]:
            continue
        if m["mx"] not in cache:
            cache[m["mx"]] = (gj(None, "data/" + m["mx"]) or {}).get("m") or {}
        lu = (cache[m["mx"]].get(mid) or {}).get("lu") or {}
        x = {t: [p[0] for p in ((lu.get(s) or {}).get("xi") or [])] for s, t in (("h", m["ht"]), ("a", m["at"]))}
        if all(len(v) == 11 for v in x.values()):
            out[mid] = x
    return out


def features(M, pos, XI, P):
    rows = []
    def probe(mid, m, rate):
        if mid in XI and len(rows) >= 0:
            a = G["xib_side"]([rate(p) for p in XI[mid][m["ht"]]])
            b = G["xib_side"]([rate(p) for p in XI[mid][m["at"]]])
            rows.append((mid, m["d"], m["lid"], a, b, m["hg"], m["ag"]))
    G["xib_stream"](M, pos, P, probe)
    return rows


def fit_b(rows):
    """Poisson regression of each side's goals on [1, home, log attack, log xG for, log opponent's xG against] (Newton steps)"""
    X, y = [], []
    for _, _, _, a, b, hg, ag in rows:
        X.append([1, 1, math.log(a[0]), math.log(a[1]), math.log(b[2])]); y.append(hg)
        X.append([1, 0, math.log(b[0]), math.log(b[1]), math.log(a[2])]); y.append(ag)
    k = len(X[0])
    beta = [math.log(sum(y) / len(y))] + [0.0] * (k - 1)
    for _ in range(60):
        g, H = [0.0] * k, [[0.0] * k for _ in range(k)]
        for x, t in zip(X, y):
            mu = math.exp(sum(bi * xi for bi, xi in zip(beta, x)))
            for i in range(k):
                g[i] += (t - mu) * x[i]
                for j in range(k):
                    H[i][j] += mu * x[i] * x[j]
        st = solve(H, g)
        beta = [b + s for b, s in zip(beta, st)]
        if max(abs(s) for s in st) < 1e-10:
            break
    return [round(b, 4) for b in beta]


def solve(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [x - f * y for x, y in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] for i in range(n)]


def brier(p, o):
    return sum((p[k] - (1 if k == o else 0)) ** 2 for k in range(3))


def out_of(hg, ag):
    return 0 if hg > ag else 1 if hg == ag else 2


def mean_se(xs):
    n = len(xs)
    m = sum(xs) / n
    return m, (sum((x - m) ** 2 for x in xs) / (n - 1)) ** 0.5 / n ** 0.5


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--write":
        G["gh_get_json"] = lambda hub, p: None if p == G["XIB_PATH"] else gj(hub, p)
        G["sync_xib"]("hub")
        open(os.path.join(ROOT, G["XIB_PATH"]), "wb").write(PUT[G["XIB_PATH"]])
        print(LOG[-1])
    elif mode in ("--fit", "--test"):
        M, pos = load()
        XI = xis(M)
        if mode == "--fit":
            res = []
            for hl, Ka, Kt in itertools.product((270, 365, 450), (1, 2, 3, 5), (2, 3, 5)):
                P = dict(G["XIB"], hl=hl, Ka=Ka, Kt=Kt)
                tr = [r for r in features(M, pos, XI, P) if WARM <= r[1] < SPLIT]
                P["b"] = fit_b(tr)
                b = sum(brier(G["xib_probs"](r[3], r[4], 1.0, P)[0], out_of(r[5], r[6])) for r in tr) / len(tr)
                res.append((round(b, 4), hl, Ka, Kt, P["b"], len(tr)))
            res.sort(key=lambda r: r[0])
            for r in res[:8]:
                print("train Brier %s  half-life %s  Ka %s  Kt %s  b %s  (%s matches)" % r)
            print("worst:", res[-1][:4])
        else:
            P = G["XIB"]
            te = [r for r in features(M, pos, XI, P) if r[1] >= SPLIT]
            idx, sj = gj(None, "data/index.json"), gj(None, "data/seasons.json") or {}
            elo, rows_by = {}, {}
            for lid in G["MK_LEAGUES"]:
                chain, files = G["el2_files"](sj, idx, lid)
                rows_by[lid] = G["el2_run"](G["el2_matches"](None, files))[2]
                for r in rows_by[lid]:
                    elo[r[1]] = r[4]
            base = G["el2_backtest"](rows_by)["base_rates"]
            te = [r for r in te if r[0] in elo]
            def block(rs):
                px = [G["xib_probs"](r[3], r[4], 1.0, P)[0] for r in rs]
                o = [out_of(r[5], r[6]) for r in rs]
                bx = [brier(p, k) for p, k in zip(px, o)]
                be = [brier(elo[r[0]], k) for r, k in zip(rs, o)]
                bb = [brier(base, k) for k in o]
                d1, s1 = mean_se([x - y for x, y in zip(bx, be)])
                d2, s2 = mean_se([x - y for x, y in zip(bx, bb)])
                hit = lambda p, k: max(range(3), key=lambda i: p[i]) == k
                return {"n": len(rs), "brier": round(sum(bx) / len(bx), 4), "elo": round(sum(be) / len(be), 4), "base": round(sum(bb) / len(bb), 4),
                        "d_elo": round(d1, 4), "se_elo": round(s1, 4), "d_base": round(d2, 4), "se_base": round(s2, 4),
                        "acc": round(sum(hit(p, k) for p, k in zip(px, o)) / len(rs), 4), "acc_elo": round(sum(hit(elo[r[0]], k) for r, k in zip(rs, o)) / len(rs), 4),
                        "pred": [round(sum(p[i] for p in px) / len(px), 4) for i in range(3)], "real": [round(sum(1 for k in o if k == i) / len(o), 4) for i in range(3)]}
            out = {"t": datetime.date.today().isoformat(), "split": SPLIT, "last": max(r[1] for r in te), "params": P, "base_rates": base, "all": block(te),
                   "per_league": {lid: block([r for r in te if r[2] == lid]) for lid in G["XIB_LEAGUES"] if any(r[2] == lid for r in te)}}
            open(os.path.join(ROOT, "data/xib_test.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
            print(json.dumps(out["all"]))
            for lid, v in out["per_league"].items():
                print(lid, v["n"], v["brier"], v["elo"], v["base"])
    else:
        print(__doc__)
