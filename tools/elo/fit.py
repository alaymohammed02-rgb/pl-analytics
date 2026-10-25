"""Club Elo from results (the "ELO2" block of sync.py). Offline helper:
  python3 tools/elo/fit.py --write   write data/elo_own.json from the local data/ files, exactly as the sync does
  python3 tools/elo/fit.py --fit     grid search of K, home advantage, season regression and the draw model on the matches BEFORE 2025-08-01 only,
                                     then the Brier of the best setting on the matches after it (what the sync's backtest repeats)
The settings now in sync.py (K 30, H 50, reg 0.1, s 175, c 0.55) are the result of --fit on 24 Oct 2026: training Brier 0.591 after the burn-in year,
test Brier 0.590 on 2,496 matches, against 0.649 for the league win/draw/loss rates."""
import os, re, sys, json, hashlib, datetime, itertools, math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src = open(os.path.join(ROOT, "sync.py"), encoding="utf-8").read()
block = src[src.index("# ===== ELO2 START ====="):src.index("# ===== ELO2 END =====")]
mk = src[src.index("MK_LEAGUES = "):src.index("MK_FD = ")]
LOG, PUT = [], {}
def gj(hub, p):
    f = os.path.join(ROOT, p)
    return json.load(open(f)) if os.path.exists(f) else None
G = {"os": os, "re": re, "json": json, "hashlib": hashlib, "datetime": datetime, "log": lambda *a: LOG.append(" ".join(map(str, a))), "run_pipeline": lambda h, k: True,
     "gh_get_json": gj, "gh_put": lambda h, p, c, m: PUT.__setitem__(p, c)}
exec(mk, G)
exec(block, G)

def histories():
    idx, sj = gj(None, "data/index.json"), gj(None, "data/seasons.json") or {}
    out = {}
    for lid in G["MK_LEAGUES"]:
        chain, files = G["el2_files"](sj, idx, lid)
        out[lid] = G["el2_matches"](None, files)
    return out

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--write":
        G["gh_get_json"] = lambda hub, p: None if p == G["EL2_PATH"] else gj(hub, p)      # always recompute
        G["sync_elo2"]("hub")
        open(os.path.join(ROOT, G["EL2_PATH"]), "wb").write(PUT[G["EL2_PATH"]])
        print(LOG[-1])
    elif mode == "--fit":
        H = histories()
        split = G["EL2_SPLIT"]
        def rows(P):
            return {lid: G["el2_run"](ms, P)[2] for lid, ms in H.items()}
        def fitsc(rs):
            best = None
            for s in (100, 125, 150, 175, 200, 250, 300, 400):
                for c in [x / 20 for x in range(2, 24)]:
                    ll = sum(math.log(max(G["el2_probs"](r[2], {"s": s, "c": c})[r[3]], 1e-9)) for r in rs)
                    if best is None or ll > best[0]:
                        best = (ll, s, c)
            return best[1], best[2]
        res = []
        for K, Hh, reg in itertools.product((20, 30, 40, 50), (30, 40, 50, 60), (0, 0.1, 0.2)):
            P = dict(G["EL2"], K=K, H=Hh, reg=reg)
            allr = [r for rs in rows(P).values() for r in rs]
            tr = [r for r in allr if r[0] < split]
            s, c = fitsc(tr)
            late = [r for r in tr if r[0] >= "2022-08-01"]       # after the first year, which only teaches the ratings
            b = sum(G["el2_brier"](G["el2_probs"](r[2], {"s": s, "c": c}), r[3]) for r in late) / len(late)
            res.append((b, K, Hh, reg, s, c))
        res.sort()
        for r in res[:5]:
            print("train Brier %.4f  K %s  H %s  reg %s  s %s  c %s" % r)
        b, K, Hh, reg, s, c = res[0]
        P = dict(G["EL2"], K=K, H=Hh, reg=reg, s=s, c=c)
        bt = G["el2_backtest"](rows(P))
        print("test:", json.dumps({k: bt[k] for k in ("n", "brier", "base", "acc")}))
    else:
        print(__doc__)
