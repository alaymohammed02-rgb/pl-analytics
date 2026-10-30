"""Run-in (the "Run-in" page, assets/run-in.js). Offline: python3 tools/runin/fit.py   writes data/runin.json from data/results.json.

Question: does the strength of the opponents a club still has to meet change the points it takes in the rest of the season, as Elo says it should?
For every finished season of every league's chain and for the checkpoints after 25%, 50% and 75% of the matches, each club has
  A  = the points it really took in the matches left,
  Es = the points Elo expects from the pairings really left (ratings frozen on that day: 3 P(win) + P(draw) over each remaining home / away pairing),
  Ef = the points Elo expects against an average opponent in the same number of home and away games (the opponent's rating = the mean rating of the other clubs).
The schedule effect is Es - Ef (negative = a harder run-in than average). Two readings, both from the same club-seasons:
  1. the mean absolute error of Es against A, against that of Ef: does knowing the real opponents help? (paired difference, standard error)
  2. the slope of (A - Ef) on (Es - Ef): 1 means the schedule moves points as much as Elo says, 0 means it moves them not at all (standard error of the slope).
The Elo functions are the sync's own (sync.py ELO2 and TMACH blocks) so the page, the sync and this test use one definition."""
import os, re, json, math, hashlib, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src = open(os.path.join(ROOT, "sync.py"), encoding="utf-8").read()
cut = lambda a, b: src[src.index(a):src.index(b)]
G = {"os": os, "re": re, "json": json, "hashlib": hashlib, "datetime": datetime, "log": print, "run_pipeline": lambda h, k: True,
     "gh_get_json": None, "gh_put": None}
exec(cut("MK_LEAGUES = ", "MK_FD = "), G)
exec(cut("# ===== ELO2 START =====", "# ===== ELO2 END ====="), G)
exec(cut("# ===== TMACH START =====", "# ===== TMACH END ====="), G)
CHECK = (0.25, 0.5, 0.75)


def chains_from(results):
    out = {}
    for lid, L in results["leagues"].items():
        T = L["teams"]
        out[lid] = [(s["s"], [(m[0], T[m[1]], T[m[2]], m[3], m[4], m[5]) for m in s["m"]]) for s in L["seasons"]]
    return out


def flat_expect(season_ms, R, upto, P):
    """per club: (points expected from the pairings left, points expected against an average opponent in the same home / away games, games left)"""
    teams = sorted({t for m in season_ms for t in (m[1], m[2])})
    played = {(m[1], m[2]) for m in season_ms if m[0] < upto}
    mean = sum(R.values()) / len(R) if R else 1500.0
    r = {t: R.get(t, mean) for t in teams}
    tot = sum(r.values())
    es, ef, left = {t: 0.0 for t in teams}, {t: 0.0 for t in teams}, {t: 0 for t in teams}
    for h in teams:
        for a in teams:
            if h == a or (h, a) in played:
                continue
            p = G["el2_probs"](r[h] - r[a] + P["H"], P)
            es[h] += 3 * p[0] + p[1]; es[a] += 3 * p[2] + p[1]
            left[h] += 1; left[a] += 1
            # an average opponent: the mean rating of the other clubs
            ph = G["el2_probs"](r[h] - (tot - r[h]) / (len(r) - 1) + P["H"], P)
            pa = G["el2_probs"]((tot - r[a]) / (len(r) - 1) - r[a] + P["H"], P)
            ef[h] += 3 * ph[0] + ph[1]; ef[a] += 3 * pa[2] + pa[1]
    return es, ef, left


def build(chains, P=None):
    P = P or G["EL2"]
    rows = []
    for lid, seasons in chains.items():
        allm = sorted([m for _, ms in seasons for m in ms], key=lambda m: (m[0], m[5]))
        for lab, ms in seasons:
            n_t = len({t for m in ms for t in (m[1], m[2])})
            if not ms or len(ms) != n_t * (n_t - 1):
                continue
            ms = sorted(ms, key=lambda m: (m[0], m[5]))
            final = G["tmach_points"](ms)
            for f in CHECK:
                upto = ms[int(f * len(ms))][0]
                R = G["tmach_ratings"](allm, upto, P)
                es, ef, left = flat_expect(ms, R, upto, P)
                pts = G["tmach_points"]([m for m in ms if m[0] < upto])
                for t in final:
                    a = final[t][0] - pts.get(t, [0])[0]
                    rows.append([lid, lab, f, t, a, es[t], ef[t], left[t]])
    return rows


def agg(rs):
    if len(rs) < 3:
        return None
    n = len(rs)
    mae_s = sum(abs(r[5] - r[4]) for r in rs) / n
    mae_f = sum(abs(r[6] - r[4]) for r in rs) / n
    d = [abs(r[5] - r[4]) - abs(r[6] - r[4]) for r in rs]
    md = sum(d) / n
    se = (sum((x - md) ** 2 for x in d) / (n - 1)) ** 0.5 / n ** 0.5
    x = [r[5] - r[6] for r in rs]
    y = [r[4] - r[6] for r in rs]
    mx, my = sum(x) / n, sum(y) / n
    sxx = sum((v - mx) ** 2 for v in x)
    b = sum((x[i] - mx) * (y[i] - my) for i in range(n)) / sxx
    res = [y[i] - my - b * (x[i] - mx) for i in range(n)]
    seb = (sum(v * v for v in res) / (n - 2) / sxx) ** 0.5
    return {"n": n, "seasons": len({(r[0], r[1]) for r in rs}), "sched": round(mae_s, 3), "flat": round(mae_f, 3), "d": round(md, 3), "se": round(se, 3),
            "slope": round(b, 3), "slope_se": round(seb, 3), "spread": round((sum(v * v for v in x) / n) ** 0.5, 2)}


def run(results):
    rows = build(chains_from(results))
    out = {"t": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), "source": "data/results.json", "check": list(CHECK),
           "all": {str(f): agg([r for r in rows if r[2] == f]) for f in CHECK},
           "new": {str(f): agg([r for r in rows if r[2] == f and r[1] >= "2025-26"]) for f in CHECK}}
    out["key"] = results.get("key")
    return out, rows


if __name__ == "__main__":
    res = json.load(open(os.path.join(ROOT, "data", "results.json"), encoding="utf-8"))
    out, rows = run(res)
    open(os.path.join(ROOT, "data", "runin.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps(out, indent=1))
