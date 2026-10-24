"""Pressing numbers per player from StatsBomb Open Data (github.com/statsbomb/open-data), for data/sb_press.json.

Needs the internet. None of StatsBomb's raw event or lineup files is kept in this repository: each match is read, reduced to
per-player counts and a coarse pressure grid, and dropped. Run from a scratch folder (match results are cached next to the script
as sbp_cache/*.json so an interrupted run can be resumed):   python3 build_press.py ../../data/sb_press.json

Definitions (also printed on the page):
  pressure          an event of type Pressure; counterpress = its counterpress flag.
  regain            a pressure after which the pressing team has the ball (an event whose possession team is the pressing team)
                    within 5 seconds in the same period. This is OUR definition: StatsBomb's own regain flag is not in the open data.
  defensive action  pressure + tackle (Duel of type Tackle) + interception + block + clearance.
  ball recovery     an event of type Ball Recovery.
  possession        the share of the ball by time: the seconds between one event and the next belong to the possession team of the first.
  adjustment        a count is multiplied by 50 / (the opponent's share of the ball in that match, in %): a team that defends more
                    because it has less of the ball gets no extra credit. The same factor is applied to every count of the match.
  name              the lineups' common name (nickname) when there is one, otherwise the official name.
  minutes           from the lineups' position spells (a spell without an end lasts to the end of the match).
  position group    the position the player spent most minutes in: goalkeeper, centre-back, full-back, midfielder, winger (wide
                    midfielders and wide attacking midfielders too) and forward.
  grid              pressures counted in 12 × 8 cells of StatsBomb's 120 × 80 pitch (x along the pitch, the team attacking towards 120).
"""
import json, os, sys, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

B = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
CACHE = os.environ.get("SBP_CACHE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "sbp_cache")
os.makedirs(CACHE, exist_ok=True)
# (competition_id, season_id, minimum minutes for the percentile pool)
# Only complete tournaments: the open Bundesliga 2023/24 holds just the 34 Bayer Leverkusen matches, so a league-wide percentile there would
# compare Leverkusen's regulars with other clubs' players seen in one or two matches.
WANT = [(55, 282, 270), (43, 106, 270), (223, 282, 270), (1267, 107, 270)]
GROUPS = {
    "Goalkeeper": "GK",
    "Center Back": "CB", "Left Center Back": "CB", "Right Center Back": "CB",
    "Left Back": "FB", "Right Back": "FB", "Left Wing Back": "FB", "Right Wing Back": "FB",
    "Center Defensive Midfield": "MID", "Left Defensive Midfield": "MID", "Right Defensive Midfield": "MID",
    "Center Midfield": "MID", "Left Center Midfield": "MID", "Right Center Midfield": "MID", "Center Attacking Midfield": "MID",
    "Left Midfield": "WING", "Right Midfield": "WING", "Left Wing": "WING", "Right Wing": "WING",
    "Left Attacking Midfield": "WING", "Right Attacking Midfield": "WING",
    "Center Forward": "FWD", "Left Center Forward": "FWD", "Right Center Forward": "FWD", "Secondary Striker": "FWD",
}
GX, GY = 12, 8
MIN_MINUTES = 90   # players with fewer minutes in a competition are left out of the file
METRICS = ["pr", "prr", "cp", "cpr", "ti", "rec"]   # pressures, pressure regains, counterpressures, counterpress regains, tackles + interceptions, ball recoveries


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read())
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(2 * (k + 1))


def mmss(s):
    a = str(s).split(":")
    return int(a[0]) * 60 + float(a[1]) if len(a) == 2 else 0.0


def ts(e):
    h, m, s = str(e["timestamp"]).split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def one_match(mid):
    cache_file = os.path.join(CACHE, f"{mid}.json")
    if os.path.exists(cache_file):
        return json.load(open(cache_file))
    E = get(f"{B}/events/{mid}.json")
    LU = get(f"{B}/lineups/{mid}.json")
    # possession time by team
    poss = {}
    for a, b in zip(E, E[1:]):
        if a["period"] == b["period"] and a.get("possession_team"):
            poss[a["possession_team"]["name"]] = poss.get(a["possession_team"]["name"], 0.0) + max(0.0, min(60.0, ts(b) - ts(a)))
    teams = [l["team_name"] for l in LU]
    tot = sum(poss.get(t, 0.0) for t in teams) or 1.0
    share = {t: poss.get(t, 0.0) / tot * 100 for t in teams}
    end = max((e["minute"] * 60 + e["second"] for e in E), default=5400)
    # minutes and main position from the lineups
    pl = {}
    for l in LU:
        for p in l["lineup"]:
            sp = {}
            mins = 0.0
            for q in p.get("positions", []):
                a = mmss(q["from"])
                b = mmss(q["to"]) if q.get("to") else end
                d = max(0.0, b - a) / 60
                mins += d
                sp[q["position"]] = sp.get(q["position"], 0.0) + d
            if mins > 0:
                top = max(sp.items(), key=lambda kv: kv[1])[0]
                pl[p["player_id"]] = {"n": p.get("player_nickname") or p["player_name"], "t": l["team_name"], "mi": mins, "pos": top, "jn": p.get("jersey_number")}
    # per-player counts
    out = {}
    def rec(pid, name, team):
        r = out.get(pid)
        if r is None:
            r = {"n": name, "t": team, "c": {k: 0 for k in METRICS}, "h": [0] * (GX * GY)}
            out[pid] = r
        return r
    idx_by_period = {}
    for i, e in enumerate(E):
        t = e["type"]["name"]
        if not e.get("player"):
            continue
        pid = e["player"]["id"]
        team = e["team"]["name"]
        r = None
        if t == "Pressure":
            r = rec(pid, e["player"]["name"], team)
            r["c"]["pr"] += 1
            cpf = bool(e.get("counterpress"))
            if cpf:
                r["c"]["cp"] += 1
            # regain: the pressing team has the ball within 5 s in the same period
            t0 = ts(e)
            got = False
            for f in E[i + 1:i + 40]:
                if f["period"] != e["period"] or ts(f) - t0 > 5:
                    break
                if f.get("possession_team", {}).get("name") == team and e.get("possession_team", {}).get("name") != team:
                    got = True
                    break
            if got:
                r["c"]["prr"] += 1
                if cpf:
                    r["c"]["cpr"] += 1
            loc = e.get("location")
            if loc:
                gx = min(GX - 1, max(0, int(loc[0] / 120 * GX)))
                gy = min(GY - 1, max(0, int(loc[1] / 80 * GY)))
                r["h"][gx * GY + gy] += 1
        elif t == "Interception" or (t == "Duel" and e.get("duel", {}).get("type", {}).get("name") == "Tackle"):
            rec(pid, e["player"]["name"], team)["c"]["ti"] += 1
        elif t == "Ball Recovery":
            rec(pid, e["player"]["name"], team)["c"]["rec"] += 1
    res = {"id": mid, "share": share, "players": []}
    for pid, p in pl.items():
        o = out.get(pid)
        opp = [t for t in teams if t != p["t"]]
        opps = share.get(opp[0], 50.0) if opp else 50.0
        f_adj = 50.0 / max(20.0, min(80.0, opps))
        c = o["c"] if o else {k: 0 for k in METRICS}
        res["players"].append({"id": pid, "n": p["n"], "t": p["t"], "mi": round(p["mi"], 2), "pos": p["pos"], "adj": round(f_adj, 4), "c": c, "h": o["h"] if o else [0] * (GX * GY)})
    json.dump(res, open(cache_file, "w"))
    return res


def main(outp):
    comps = []
    allc = get(f"{B}/competitions.json")
    for cid, sid, minmi in WANT:
        info = next((c for c in allc if c["competition_id"] == cid and c["season_id"] == sid), None)
        if not info:
            print("missing", cid, sid)
            continue
        ms = get(f"{B}/matches/{cid}/{sid}.json")
        print(info["competition_name"], info["season_name"], len(ms), "matches", flush=True)
        done = 0
        lock = threading.Lock()
        def work(m):
            nonlocal done
            r = one_match(m["match_id"])
            with lock:
                done += 1
                if done % 25 == 0:
                    print("  ", done, "/", len(ms), flush=True)
            return r
        with ThreadPoolExecutor(8) as ex:
            R = list(ex.map(work, ms))
        P = {}
        for r in R:
            for p in r["players"]:
                a = P.setdefault(p["id"], {"id": p["id"], "n": p["n"], "t": p["t"], "mi": 0.0, "gp": 0, "pos": {}, "raw": {k: 0 for k in METRICS}, "adj": {k: 0.0 for k in METRICS}, "h": [0] * (GX * GY)})
                a["mi"] += p["mi"]
                a["gp"] += 1
                a["t"] = p["t"]
                a["pos"][p["pos"]] = a["pos"].get(p["pos"], 0.0) + p["mi"]
                for k in METRICS:
                    a["raw"][k] += p["c"][k]
                    a["adj"][k] += p["c"][k] * p["adj"]
                a["h"] = [x + y for x, y in zip(a["h"], p["h"])]
        out = []
        for a in P.values():
            if a["mi"] < MIN_MINUTES:
                continue
            top = max(a["pos"].items(), key=lambda kv: kv[1])[0]
            g = GROUPS.get(top)
            if not g:
                continue
            out.append([a["id"], a["n"], a["t"], g, round(a["mi"], 1), a["gp"], [a["raw"][k] for k in METRICS], [round(a["adj"][k], 2) for k in METRICS], a["h"]])
        out.sort(key=lambda r: (-r[4], r[1]))
        comps.append({"id": cid, "sid": sid, "name": info["competition_name"], "season": info["season_name"], "matches": len(ms), "min": minmi, "players": out})
    doc = {"v": 1, "source": "StatsBomb Open Data (github.com/statsbomb/open-data)", "metrics": METRICS, "grid": [GX, GY],
           "fields": ["id", "name", "team", "group", "minutes", "matches", "raw", "adjusted", "grid"], "comps": comps}
    json.dump(doc, open(outp, "w"), ensure_ascii=False, separators=(",", ":"))
    print("wrote", outp, os.path.getsize(outp) // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sb_press.json")
