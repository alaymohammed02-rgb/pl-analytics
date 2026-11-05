"""Age curves: how much a player's per-90 numbers change from one season to the next at each age. Writes data/age_curves.json. Run offline: python3 tools/age/fit.py
(not part of the sync: it reads the finished seasons of data/career.json and the dates of birth of data/tm.json, which is no longer updated).

Method (the delta method): for every player with 900+ minutes in two consecutive finished seasons and a date of birth in data/tm.json, each stat per 90 is first set against
the players of the same position, league and season with 900+ minutes (a z-score), then the change in z from the first season to the next is attributed to his age on 1 August
of the first season. The mean change per age (and its standard error) is the page's table; the curve is the running sum of the means, set to 0 at the age with the highest
level so the page can read "how far below the peak". Stats: non-penalty xG, xAG (his minutes in matches that have xAG), shots, key passes, tackles + interceptions per 90.
Tests, written into the file:
  * leave one season pair out: the curve is fitted on the other pairs and predicts the held-out pair's next-season z as "this season's z + the curve's change at his age";
    its squared error is set against "next season = this season" (paired difference, standard error);
  * the same with ages grouped in three bands (up to 23, 24-29, 30+), the number of pairs per band.
Caveats the page prints: only players who kept 900+ minutes are in (a player who declines may drop out: the curve is probably too kind to the old); dates of birth exist for
about 81% of players (matched by name); the Premier League has four season pairs, the other five leagues one; z-scores compare players within a league, not across.
Output: {"v":1,"t":date,"stats":[...],"pos":["DF","MF","FW","ALL"],"ages":[min,max],"curves":{stat:{pos:{"n":..,"age":{age:[n,mean,se]},"curve":{age:level},"peak":age}}},"test":{...}}"""
import json, os, math, datetime, collections
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
STATS = ["npxg", "xag", "sh", "kp", "tkic"]
# career row: [season, lg, club, pos, g, mi, gl, ast, xg, npxg, xag, xagmi, sh, kp, tkic]
IDX = {"s": 0, "lg": 1, "pos": 3, "mi": 5, "npxg": 9, "xag": 10, "xagmi": 11, "sh": 12, "kp": 13, "tkic": 14}
AMIN, AMAX = 18, 36
MIN_MI = 900


def per90(r, k):
    if k == "xag":
        return r[IDX["xag"]] * 90 / r[IDX["xagmi"]] if r[IDX["xagmi"]] >= r[IDX["mi"]] * 0.5 else None
    return r[IDX[k]] * 90 / r[IDX["mi"]]


def mean(a): return sum(a) / len(a)
def se(a): return math.sqrt(sum((x - mean(a)) ** 2 for x in a) / (len(a) - 1) / len(a)) if len(a) > 1 else float("nan")


def main():
    career = json.load(open(os.path.join(DATA, "career.json"), encoding="utf-8"))
    tm = json.load(open(os.path.join(DATA, "tm.json"), encoding="utf-8"))
    # z-scores within position, league, season (900+ minutes)
    groups = collections.defaultdict(list)
    for pid, L in career["p"].items():
        for r in L:
            if r[IDX["mi"]] >= MIN_MI and r[IDX["pos"]] in ("DF", "MF", "FW"):
                groups[(r[0], r[1], r[3])].append(r)
    zs = {}
    for gk, rs in groups.items():
        for k in STATS:
            v = [per90(r, k) for r in rs]
            v2 = [x for x in v if x is not None]
            if len(v2) < 10:
                continue
            mu = mean(v2)
            sd = math.sqrt(sum((x - mu) ** 2 for x in v2) / len(v2)) or 1
            for r, x in zip(rs, v):
                if x is not None:
                    zs[(id(r), k)] = (x - mu) / sd
    pairs = []  # (pid, season, pos, age, {stat: (z1, z2)})
    for pid, L in career["p"].items():
        d = tm["p"].get(pid)
        if not d or not d[0]:
            continue
        dob = datetime.date.fromisoformat(d[0])
        by = {(r[0], r[1]): r for r in L if r[IDX["mi"]] >= MIN_MI and r[IDX["pos"]] in ("DF", "MF", "FW")}
        for (s, lg), r in by.items():
            y = int(s[:4]); nx = f"{y + 1}-{str(y + 2)[2:]}"
            r2 = by.get((nx, lg))
            if not r2 or r2[3] != r[3]:
                continue
            ref = datetime.date(y, 8, 1)
            age = ref.year - dob.year - ((ref.month, ref.day) < (dob.month, dob.day))
            if not (15 <= age <= 45):
                continue
            st = {k: (zs[(id(r), k)], zs[(id(r2), k)]) for k in STATS if (id(r), k) in zs and (id(r2), k) in zs}
            if st:
                pairs.append({"pid": pid, "s": s, "pos": r[3], "age": min(max(age, AMIN), AMAX), "st": st})
    print(len(pairs), "season pairs with an age")

    def curve(ps, k):
        by = collections.defaultdict(list)
        for p in ps:
            if k in p["st"]:
                by[p["age"]].append(p["st"][k][1] - p["st"][k][0])
        return by

    def level(by):
        """running sum of the mean change by age, 0 at the highest level"""
        ages = sorted(by)
        # the change from age a to a+1 is attributed to age a: level(a+1) = level(a) + mean(delta at a)
        lv, cur = {}, 0.0
        lv[ages[0]] = 0.0
        for a in range(ages[0], ages[-1]):
            cur += mean(by[a]) if a in by and by[a] else 0.0
            lv[a + 1] = cur
        return lv

    out = {"v": 1, "t": datetime.date.today().isoformat(), "stats": STATS, "pos": ["DF", "MF", "FW", "ALL"], "ages": [AMIN, AMAX], "curves": {}, "test": {}, "tm_asof": tm.get("asof") or tm.get("t")}
    for k in STATS:
        out["curves"][k] = {}
        for pos in ["DF", "MF", "FW", "ALL"]:
            ps = [p for p in pairs if (pos == "ALL" or p["pos"] == pos) and k in p["st"]]
            by = curve(ps, k)
            # ages with fewer than 8 pairs are merged into the neighbour on the inside of the range
            ages = {a: [len(v), round(mean(v), 4), round(se(v), 4) if len(v) > 1 else None] for a, v in sorted(by.items())}
            use = {a: v for a, v in by.items() if len(v) >= 8}
            lo, hi = (min(use), max(use)) if use else (None, None)
            lv = level({a: v for a, v in use.items()}) if use else {}
            # contiguous run only
            lv = {a: round(x, 4) for a, x in lv.items() if lo <= a <= hi + 1}
            peak = max(lv, key=lv.get) if lv else None
            if peak is not None:
                top = lv[peak]; lv = {a: round(x - top, 4) for a, x in lv.items()}
            out["curves"][k][pos] = {"n": len(ps), "age": ages, "curve": lv, "peak": peak}
            print(k, pos, len(ps), "peak", peak)
    # leave one season pair out: does adding the age change help predict the next season's z? Two ways: the mean change of the same position and age (8+ pairs),
    # or the mean change of the age band (up to 23, 24-29, 30+) over all positions
    seas = sorted({p["s"] for p in pairs})
    band = lambda a: "u23" if a <= 23 else "a24" if a <= 29 else "a30"
    for k in STATS:
        dA, dB, bands = [], [], {"u23": [], "a24": [], "a30": []}
        for s in seas:
            tr = [p for p in pairs if p["s"] != s and k in p["st"]]
            te = [p for p in pairs if p["s"] == s and k in p["st"]]
            by, bb = collections.defaultdict(list), collections.defaultdict(list)
            for p in tr:
                dl = p["st"][k][1] - p["st"][k][0]
                by[(p["pos"], p["age"])].append(dl); bb[band(p["age"])].append(dl)
            for p in te:
                z1, z2 = p["st"][k]
                v = by.get((p["pos"], p["age"]), [])
                a1 = mean(v) if len(v) >= 8 else 0.0
                a2 = mean(bb[band(p["age"])]) if bb[band(p["age"])] else 0.0
                d0 = (z2 - z1) ** 2
                dA.append(d0 - (z2 - (z1 + a1)) ** 2); dB.append(d0 - (z2 - (z1 + a2)) ** 2)
                bands[band(p["age"])].append(d0 - (z2 - (z1 + a2)) ** 2)
        out["test"][k] = {"n": len(dA), "mse0": None, "gain": round(mean(dA), 5), "se": round(se(dA), 5), "gain_band": round(mean(dB), 5), "se_band": round(se(dB), 5),
                          "bands": {b: [len(v), round(mean(v), 5) if v else None, round(se(v), 5) if len(v) > 1 else None] for b, v in bands.items()}}
        print(k, "age-and-position:", out["test"][k]["gain"], "+-", out["test"][k]["se"], "| band:", out["test"][k]["gain_band"], "+-", out["test"][k]["se_band"], out["test"][k]["bands"])
    # baseline error for context
    for k in STATS:
        d = [(p["st"][k][1] - p["st"][k][0]) ** 2 for p in pairs if k in p["st"]]
        out["test"][k]["mse0"] = round(mean(d), 4)
    out["pairs"] = len(pairs)
    out["players"] = len({p["pid"] for p in pairs})
    json.dump(out, open(os.path.join(DATA, "age_curves.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("written", os.path.getsize(os.path.join(DATA, "age_curves.json")) // 1024, "KB")


if __name__ == "__main__":
    main()
