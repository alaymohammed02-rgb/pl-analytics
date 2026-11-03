"""data/career.json (tools/career/write.py) worked again with a second implementation: for every finished past season of data/seasons.json that has a player file with rows, every player's
matches, minutes, goals, assists, xG, non-penalty xG, xAG and its minutes, shots, key passes, tackles + interceptions, club and position, grouped differently from the tool (rows are
collected per player first, then summed with sum()). Also: the Premier League has its five seasons, the leagues with only a light 2024-25 season have two, Ligue 1 2021-22 and 2022-23
(no player rows) are absent, every row has the right shape, names exist for every id, the seasons of a player are in order."""
import json, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
fails = 0
def ok(c, m):
    global fails
    if not c:
        fails += 1
        print("FAIL", m)
    else:
        print("ok  ", m)
C = json.load(open(os.path.join(DATA, "career.json"), encoding="utf-8"))
SJ = json.load(open(os.path.join(DATA, "seasons.json"), encoding="utf-8"))["leagues"]
ok(C["v"] == 1 and C["lgs"] == sorted(SJ), "version 1 and the leagues are the sorted ids of seasons.json")

def pick(m):
    return sorted(m.items(), key=lambda kv: (kv[1], kv[0]))[-1][0] if m else None

want, used = {}, []
for li, lid in enumerate(C["lgs"]):
    for s in sorted(SJ[lid]["seasons"]):
        f = (SJ[lid]["seasons"][s].get("files") or {}).get("pl_file")
        if not f or not os.path.exists(os.path.join(DATA, f)):
            continue
        pl = json.load(open(os.path.join(DATA, f), encoding="utf-8"))
        ix = {k: i for i, k in enumerate(pl["cols"])}
        per = collections.defaultdict(list)
        for r in pl["rows"]:
            if r[ix["mi"]]:
                per[r[ix["i"]]].append(r)
        if not per:
            continue
        used.append((lid, s))
        for pid, rs in per.items():
            clubs, poss = collections.defaultdict(float), collections.defaultdict(float)
            for r in rs:
                clubs[r[ix["c"]]] += r[ix["mi"]]
                if r[ix["o"]]:
                    poss[r[ix["o"]]] += r[ix["mi"]]
            xr = [r for r in rs if r[ix["xag"]] is not None]
            g = lambda k: sum((r[ix[k]] or 0) for r in rs)
            want.setdefault(pid, []).append([s, li, pick(clubs), pick(poss), len(rs), round(sum(r[ix["mi"]] for r in rs)), int(g("gl")), int(g("ast")), round(g("xg"), 2), round(g("npxg"), 2),
                round(sum(r[ix["xag"]] for r in xr), 2), round(sum(r[ix["mi"]] for r in xr)), int(g("sh")), int(g("kp")), int(sum((r[ix["tk"]] or 0) + (r[ix["ic"]] or 0) for r in rs))])
            want[pid][-1].append(rs[-1][ix["n"]])
for v in want.values():
    v.sort(key=lambda r: (r[0], r[1]))
names = {pid: v[-1][-1] for pid, v in want.items()}
for v in want.values():
    for r in v:
        r.pop()
ok(len(used) == 15 and ("l_3FJFUl", "2021-22") not in used and ("l_3FJFUl", "2022-23") not in used, "15 seasons with player rows (Ligue 1 2021-22 and 2022-23 have none and are left out)")
ok(sorted(C["p"]) == sorted(want), "the same players: %d" % len(want))
def same(a, b):
    """equal rows; the three float sums may differ by one rounding step (0.01) because the two implementations add the matches in a different order"""
    return a is not None and len(a) == len(b) and all(len(x) == len(y) and all((abs(u - v) <= 0.0101 if i in (8, 9, 10) else u == v) for i, (u, v) in enumerate(zip(x, y))) for x, y in zip(a, b))
bad = [pid for pid in want if not same(C["p"].get(pid), want[pid])]
ok(not bad, "every player's seasons agree with the second implementation (integers and text equal, xG / npxG / xAG sums within one rounding step) (%d players, %d player-seasons)%s" % (len(want), sum(len(v) for v in want.values()), " first bad: %s" % bad[:3] if bad else ""))
badn = [pid for pid in want if C["n"].get(pid) != names[pid]]
ok(not badn and set(C["n"]) == set(want), "a name for every player, the one of his last row of his last season")
pl = collections.Counter(r[0] for v in C["p"].values() for r in v if C["lgs"][r[1]] == "l_4WFCIZ")
ok(sorted(pl) == ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"], "Premier League: five seasons " + str(sorted(pl)))
for lid in C["lgs"]:
    if lid in ("l_4WFCIZ", "l_3FJFUl"):
        continue
    ok(sorted({r[0] for v in C["p"].values() for r in v if C["lgs"][r[1]] == lid}) == ["2024-25", "2025-26"], "%s: 2024-25 and 2025-26" % lid)
ok(all(len(r) == 15 and r[5] > 0 and r[4] > 0 and r[4] <= 60 for v in C["p"].values() for r in v), "every row has 15 fields, minutes and matches above zero, at most 60 matches")
ok(all(v == sorted(v, key=lambda r: (r[0], r[1])) for v in C["p"].values()), "a player's seasons are in order")
ok(all(r[11] <= r[5] for v in C["p"].values() for r in v), "the minutes of the matches with xAG never exceed his minutes")
print("all passed" if not fails else "%d FAILED" % fails)
sys.exit(1 if fails else 0)
