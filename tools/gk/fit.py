"""Does a goalkeeper's shot-stopping repeat? Writes data/gk_repeat.json. Run offline: python3 tools/gk/fit.py

Goals prevented = xGOT (expected goals of the shots on target, PitchAPI's `xo`) minus the goals that went in, over the shots the keeper faced.
A shot faced = a goal (own goals left out) or a saved attempt that was not blocked by an outfield player. The keeper is the starting goalkeeper
(slot 11 of the line-up) of the side that did not shoot; on the 2024-25 and 2025-26 files, where a shot carries its keeper's id, the two agree on
99+% of shots. The Premier League is the only league with five seasons of line-ups, so the repeat test uses it:
  year to year: the same keeper's goals prevented per shot faced in one season against the next (60+ shots faced in both), Spearman correlation;
  within a season: his matches in date order, odd against even (25+ shots in each half, 80+ in the season), corrected for halving (2r / (1 + r)).
The standard error of a correlation is taken as 1 / sqrt(n - 3)."""
import json, os, sys, datetime

LEAGUE = "l_4WFCIZ"
SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]
MIN_YOY, MIN_SEASON, MIN_HALF = 60, 80, 25


def shots_faced(sh, matches, mx):
    """[(match, keeper id, keeper name, goal 0/1, xGOT, keeper id in the shot or '')] from one season's files."""
    ix = {c: i for i, c in enumerate(sh["cols"])}
    M = {m["i"]: m for m in matches}
    gk = {}
    for mid, v in mx.items():
        for side in ("h", "a"):
            xi = ((v.get("lu") or {}).get(side) or {}).get("xi") or []
            g = [p for p in xi if p[3] == 11]
            if g:
                gk[(mid, side)] = (g[0][0], g[0][1])
    out = []
    for r in sh["rows"]:
        if r[ix["ev"]] not in ("Goal", "AttemptSaved") or r[ix["og"]] or r[ix["bl"]]:
            continue
        m = M.get(r[ix["m"]])
        if not m:
            continue
        side = "a" if r[ix["c"]] == m["h"] else "h" if r[ix["c"]] == m["a"] else None
        k = gk.get((r[ix["m"]], side)) if side else None
        if not k:
            continue
        out.append((r[ix["m"]], k[0], k[1], 1 if r[ix["ev"]] == "Goal" else 0, r[ix["xo"]] or 0.0, r[ix["kid"]] or ""))
    return out


def per_keeper(S):
    K = {}
    for mid, kid, nm, g, x, k2 in S:
        o = K.setdefault(kid, {"n": 0, "g": 0, "x": 0.0, "m": {}})
        o["n"] += 1; o["g"] += g; o["x"] += x
        a = o["m"].setdefault(mid, [0, 0, 0.0]); a[0] += 1; a[1] += g; a[2] += x
    return K


def ranks(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0] * len(v); i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        for k in range(i, j + 1):
            r[o[k]] = (i + j) / 2
        i = j + 1
    return r


def spearman(x, y):
    a, b = ranks(x), ranks(y); n = len(a); ma = sum(a) / n; mb = sum(b) / n
    return sum((p - ma) * (q - mb) for p, q in zip(a, b)) / (sum((p - ma) ** 2 for p in a) * sum((q - mb) ** 2 for q in b)) ** 0.5


def build(root):
    S = {}
    agree = [0, 0]
    for s in SEASONS:
        lg = json.load(open(os.path.join(root, f"{LEAGUE}_{s}.json")))
        sh = json.load(open(os.path.join(root, f"{LEAGUE}_{s}_sh.json")))
        mx = json.load(open(os.path.join(root, f"{LEAGUE}_{s}_mx.json")))["m"]
        S[s] = shots_faced(sh, lg["matches"], mx)
        for t in S[s]:
            if t[5]:
                agree[1] += 1; agree[0] += t[5] == t[1]
    K = {s: per_keeper(S[s]) for s in SEASONS}
    seasons = []
    for s in SEASONS:
        n = sum(len(v) for v in [S[s]]); g = sum(t[3] for t in S[s]); x = sum(t[4] for t in S[s])
        seasons.append({"s": s, "shots": n, "goals": g, "xgot": round(x, 1), "keepers": len(K[s]), "keepers_min": sum(1 for v in K[s].values() if v["n"] >= MIN_YOY)})
    pairs = []
    for a, b in zip(SEASONS, SEASONS[1:]):
        for p in K[a]:
            if p in K[b] and K[a][p]["n"] >= MIN_YOY and K[b][p]["n"] >= MIN_YOY:
                pairs.append(((K[a][p]["x"] - K[a][p]["g"]) / K[a][p]["n"], (K[b][p]["x"] - K[b][p]["g"]) / K[b][p]["n"]))
    r = spearman([a for a, _ in pairs], [b for _, b in pairs])
    halves = []
    for s in SEASONS:
        for p, v in K[s].items():
            if v["n"] < MIN_SEASON:
                continue
            h = [[0, 0, 0.0], [0, 0, 0.0]]
            for i, mid in enumerate(sorted(v["m"])):
                for t in range(3):
                    h[i % 2][t] += v["m"][mid][t]
            if h[0][0] >= MIN_HALF and h[1][0] >= MIN_HALF:
                halves.append(((h[0][2] - h[0][1]) / h[0][0], (h[1][2] - h[1][1]) / h[1][0]))
    rh = spearman([a for a, _ in halves], [b for _, b in halves])
    return {"t": datetime.date.today().isoformat(), "league": LEAGUE, "seasons": seasons,
            "agree": {"n": agree[1], "same": agree[0]},
            "yoy": {"n": len(pairs), "r": round(r, 3), "se": round(1 / (len(pairs) - 3) ** 0.5, 3), "min_shots": MIN_YOY},
            "half": {"n": len(halves), "r": round(rh, 3), "sb": round(2 * rh / (1 + rh), 3), "se": round(1 / (len(halves) - 3) ** 0.5, 3), "min_season": MIN_SEASON, "min_half": MIN_HALF}}


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "data")
    out = build(root)
    json.dump(out, open(os.path.join(root, "gk_repeat.json"), "w"), separators=(",", ":"))
    print(json.dumps(out, indent=1))
