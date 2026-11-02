"""Is a substitute's output a skill that repeats? Writes data/bench.json. Run offline: python3 tools/bench/fit.py

A substitute appearance = a player-match with minutes in a match that has line-ups, where the player is not in that match's starting XI (`xi` of either side
of data/<league>_<season>_mx.json). Per player and season: the minutes, non-penalty xG, shots, key passes, goals and assists of his substitute appearances
(PitchAPI's minutes include stoppage time). Four measures per 90 substitute minutes: non-penalty xG, shots, key passes, goals + assists.
Each number is first set against players of his position that season (z-score within the position he played most minutes in; positions with fewer than 8
qualifying players are left out), as the Stat stability page does, so that forwards are not simply compared with defenders.
The Premier League is the only league with five seasons of line-ups, so the test uses it:
  year to year: the same player's z in one season against the next (150+ substitute minutes in both), Spearman correlation, Fisher interval (1 / sqrt(n - 3));
  within a season: his substitute appearances in date order (then match id), odd against even (60+ minutes in each half, 200+ in the season), z computed
  separately for each half, corrected for halving (2r / (1 + r))."""
import json, os, sys, math, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
LEAGUE = "l_4WFCIZ"
SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]
MIN_YOY, MIN_SEASON, MIN_HALF, MIN_POS = 150, 200, 60, 8
MEASURES = [("xg", "Non-penalty xG per 90", "npxg"), ("sh", "Shots per 90", "sh"), ("kp", "Key passes per 90", "kp"), ("ga", "Goals + assists per 90", None)]


def appearances(pl, mx, dates):
    """{player id: [(date, match id, minutes, npxg, shots, key passes, goals + assists)]} of substitute appearances, and the position he played most minutes in."""
    c = {k: i for i, k in enumerate(pl["cols"])}
    lineups = set()
    start = set()
    for mid, v in mx.items():
        lu = v.get("lu") or {}
        got = False
        for side in ("h", "a"):
            for x in (lu.get(side) or {}).get("xi") or []:
                start.add((mid, x[0]))
                got = True
        if got:
            lineups.add(mid)
    subs = collections.defaultdict(list)
    pos = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in pl["rows"]:
        mid, pid, mi = r[c["m"]], r[c["i"]], r[c["mi"]]
        if not mi:
            continue
        if r[c["o"]]:
            pos[pid][r[c["o"]]] += mi
        if mid in lineups and (mid, pid) not in start:
            subs[pid].append((dates.get(mid, ""), mid, mi, r[c["npxg"]] or 0.0, r[c["sh"]] or 0.0, r[c["kp"]] or 0.0, (r[c["gl"]] or 0) + (r[c["ast"]] or 0)))
    main = {}
    for pid, d in pos.items():
        main[pid] = sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
    return subs, main


def rate(apps, k):
    """per 90 substitute minutes of measure k over a list of appearances"""
    mi = sum(a[2] for a in apps)
    idx = {"xg": 3, "sh": 4, "kp": 5, "ga": 6}[k]
    return sum(a[idx] for a in apps) / mi * 90 if mi else None


def zscores(items):
    """items = [(id, position, value)] -> {id: z within the position}; positions with fewer than MIN_POS players are left out"""
    by = collections.defaultdict(list)
    for pid, pos, v in items:
        by[pos].append((pid, v))
    out = {}
    for pos, l in by.items():
        if len(l) < MIN_POS:
            continue
        m = sum(v for _, v in l) / len(l)
        sd = math.sqrt(sum((v - m) ** 2 for _, v in l) / (len(l) - 1))
        for pid, v in l:
            out[pid] = (v - m) / sd if sd else 0.0
    return out


def ranks(v):
    o = sorted(range(len(v)), key=lambda i: v[i])
    r = [0.0] * len(v)
    i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        for k in range(i, j + 1):
            r[o[k]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(a, b):
    ra, rb = ranks(a), ranks(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    sa = sum((x - ma) ** 2 for x in ra)
    sb = sum((y - mb) ** 2 for y in rb)
    if not sa or not sb:
        return 0.0
    return sum((x - ma) * (y - mb) for x, y in zip(ra, rb)) / math.sqrt(sa * sb)


def interval(r, n):
    if n <= 3:
        return None, None
    z, se = math.atanh(max(-0.999999, min(0.999999, r))), 1 / math.sqrt(n - 3)
    return math.tanh(z - 1.96 * se), math.tanh(z + 1.96 * se)


def season_zs(S, k):
    """z of each player's per-90 value in every season: {season: {id: z}}"""
    out = {}
    for sea, (subs, main) in S.items():
        items = []
        for pid, ap in subs.items():
            if pid in main and sum(a[2] for a in ap) >= MIN_YOY:
                items.append((pid, main[pid], rate(ap, k)))
        out[sea] = zscores(items)
    return out


def year_to_year(S, k):
    Z = season_zs(S, k)
    xs, ys = [], []
    ss = sorted(S)
    for a, b in zip(ss, ss[1:]):
        for pid in sorted(Z[a]):
            if pid in Z[b]:
                xs.append(Z[a][pid])
                ys.append(Z[b][pid])
    n = len(xs)
    if n < 4:
        return {"n": n, "r": None, "lo": None, "hi": None}
    r = spearman(xs, ys)
    lo, hi = interval(r, n)
    return {"n": n, "r": r, "lo": lo, "hi": hi}


def within_season(S, k):
    xs, ys = [], []
    for sea in sorted(S):
        subs, main = S[sea]
        A, B = [], []
        for pid in sorted(subs):
            ap = sorted(subs[pid], key=lambda a: (a[0], a[1]))
            if pid not in main or sum(a[2] for a in ap) < MIN_SEASON:
                continue
            ha, hb = ap[0::2], ap[1::2]
            if sum(a[2] for a in ha) < MIN_HALF or sum(a[2] for a in hb) < MIN_HALF:
                continue
            A.append((pid, main[pid], rate(ha, k)))
            B.append((pid, main[pid], rate(hb, k)))
        za, zb = zscores(A), zscores(B)
        for pid in sorted(za):
            if pid in zb:
                xs.append(za[pid])
                ys.append(zb[pid])
    n = len(xs)
    if n < 4:
        return {"n": n, "r": None, "sb": None, "lo": None, "hi": None}
    r = spearman(xs, ys)
    lo, hi = interval(r, n)
    sb = lambda v: 2 * v / (1 + v) if v is not None else None
    return {"n": n, "r": r, "sb": sb(r), "lo": sb(lo), "hi": sb(hi)}


def load_season(sea):
    suf = "_" + sea
    pl = json.load(open(os.path.join(DATA, f"{LEAGUE}{suf}_pl.json"), encoding="utf-8"))
    mx = json.load(open(os.path.join(DATA, f"{LEAGUE}{suf}_mx.json"), encoding="utf-8"))["m"]
    lg = json.load(open(os.path.join(DATA, f"{LEAGUE}{suf}.json"), encoding="utf-8"))
    dates = {m["i"]: str(m.get("d") or "")[:10] for m in lg["matches"]}
    return appearances(pl, mx, dates)


def main():
    S = {s: load_season(s) for s in SEASONS}
    out = {"t": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), "league": LEAGUE, "seasons": SEASONS,
           "min_yoy": MIN_YOY, "min_season": MIN_SEASON, "min_half": MIN_HALF, "min_pos": MIN_POS,
           "players": {s: sum(1 for p, ap in S[s][0].items() if sum(a[2] for a in ap) >= MIN_YOY) for s in SEASONS}, "measures": {}}
    for k, label, _ in MEASURES:
        out["measures"][k] = {"label": label, "yoy": year_to_year(S, k), "half": within_season(S, k)}
    p = os.path.join(DATA, "bench.json")
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    for k, m in out["measures"].items():
        y, h = m["yoy"], m["half"]
        f = lambda v: "-" if v is None else "%.2f" % v
        print(f"{m['label']}: year to year r {f(y['r'])} [{f(y['lo'])}, {f(y['hi'])}] over {y['n']} pairs; odd/even {f(h['sb'])} over {h['n']}")
    return out


if __name__ == "__main__":
    main()
