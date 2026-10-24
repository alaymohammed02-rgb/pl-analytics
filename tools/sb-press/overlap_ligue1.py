"""Ligue 1 2021/22 and 2022/23 from StatsBomb Open Data, reduced to one row per player per match, to compare with PitchAPI's player rows.

Needs the internet. No raw StatsBomb file is kept: each match is read, reduced to the counts below and dropped (the reduced rows are
cached as SBL_CACHE/<match>.json so an interrupted run resumes).   python3 overlap_ligue1.py OUT.json

One row: [player_id, name, team, minutes, position group, pressures, tackles, interceptions, blocks, clearances, ball recoveries,
duels, fouls committed]. A match: {id, date, home, away, hs, as, rows}. The counts are StatsBomb's own event types:
  pressures = Pressure; tackles = Duel of type Tackle; interceptions = Interception; blocks = Block; clearances = Clearance;
  ball recoveries = Ball Recovery; duels = Duel (any type); fouls = Foul Committed.
"""
import json, os, sys, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

B = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
CACHE = os.environ.get("SBL_CACHE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "sbl_cache")
os.makedirs(CACHE, exist_ok=True)
SEASONS = [(7, 108, "2021-22"), (7, 235, "2022-23")]
if os.environ.get("SBL_SEASONS"):   # e.g. "2:27:PL 2015-16,11:27:LaLiga 2015-16"
    SEASONS = [(int(a), int(b), c) for a, b, c in (x.split(":", 2) for x in os.environ["SBL_SEASONS"].split(","))]
GROUPS = {
    "Goalkeeper": "GK", "Center Back": "CB", "Left Center Back": "CB", "Right Center Back": "CB",
    "Left Back": "FB", "Right Back": "FB", "Left Wing Back": "FB", "Right Wing Back": "FB",
    "Center Defensive Midfield": "MID", "Left Defensive Midfield": "MID", "Right Defensive Midfield": "MID",
    "Center Midfield": "MID", "Left Center Midfield": "MID", "Right Center Midfield": "MID", "Center Attacking Midfield": "MID",
    "Left Midfield": "WING", "Right Midfield": "WING", "Left Wing": "WING", "Right Wing": "WING",
    "Left Attacking Midfield": "WING", "Right Attacking Midfield": "WING",
    "Center Forward": "FWD", "Left Center Forward": "FWD", "Right Center Forward": "FWD", "Secondary Striker": "FWD",
}
KEYS = ["pr", "tk", "ic", "bl", "cl", "rec", "du", "fo"]


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return json.loads(r.read())
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(2 * (k + 1))


def mmss(s):
    a = str(s).split(":")
    return int(a[0]) * 60 + float(a[1]) if len(a) == 2 else 0.0


def one(m):
    cf = os.path.join(CACHE, f"{m['match_id']}.json")
    if os.path.exists(cf):
        return json.load(open(cf))
    E = get(f"{B}/events/{m['match_id']}.json")
    LU = get(f"{B}/lineups/{m['match_id']}.json")
    end = max((e["minute"] * 60 + e["second"] for e in E), default=5400)
    pl = {}
    for l in LU:
        for p in l["lineup"]:
            sp, mins = {}, 0.0
            for q in p.get("positions", []):
                a = mmss(q["from"]); b = mmss(q["to"]) if q.get("to") else end
                d = max(0.0, b - a) / 60
                mins += d
                sp[q["position"]] = sp.get(q["position"], 0.0) + d
            if mins > 0:
                top = max(sp.items(), key=lambda kv: kv[1])[0]
                pl[p["player_id"]] = [p["player_id"], p.get("player_nickname") or p["player_name"], l["team_name"], round(mins, 2), GROUPS.get(top, "MID")] + [0] * len(KEYS)
    for e in E:
        if not e.get("player"):
            continue
        r = pl.get(e["player"]["id"])
        if r is None:
            continue
        t = e["type"]["name"]
        if t == "Pressure":
            r[5] += 1
        elif t == "Duel":
            dt = e.get("duel", {}).get("type", {}).get("name")
            r[5 + KEYS.index("du")] += 1
            if dt == "Tackle":
                r[5 + KEYS.index("tk")] += 1
        elif t == "Interception":
            r[5 + KEYS.index("ic")] += 1
        elif t == "Block":
            r[5 + KEYS.index("bl")] += 1
        elif t == "Clearance":
            r[5 + KEYS.index("cl")] += 1
        elif t == "Ball Recovery":
            r[5 + KEYS.index("rec")] += 1
        elif t == "Foul Committed":
            r[5 + KEYS.index("fo")] += 1
    out = {"id": m["match_id"], "date": m["match_date"], "home": m["home_team"]["home_team_name"], "away": m["away_team"]["away_team_name"],
           "hs": m["home_score"], "as": m["away_score"], "rows": list(pl.values())}
    json.dump(out, open(cf, "w"))
    return out


def main():
    out = {}
    for cid, sid, lab in SEASONS:
        ms = get(f"{B}/matches/{cid}/{sid}.json")
        print(lab, len(ms), "matches", flush=True)
        done = [0]
        lock = threading.Lock()

        def work(m):
            r = one(m)
            with lock:
                done[0] += 1
                if done[0] % 40 == 0:
                    print(" ", done[0], flush=True)
            return r
        with ThreadPoolExecutor(8) as ex:
            out[lab] = list(ex.map(work, ms))
    json.dump(out, open(sys.argv[1], "w"))


if __name__ == "__main__":
    main()
