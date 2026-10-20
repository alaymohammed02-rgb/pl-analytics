"""Converts the vaastav FPL archive (one season folder) into the site's data/fpl.json format and checks that the
season's scoring rules reproduce every player-gameweek's official points.
usage: python3 -I convert.py <archive_dir> <season> <out.json>"""
import csv, json, sys, collections, datetime

HIST = ["round", "total_points", "value", "minutes", "expected_goals", "expected_assists", "bonus", "opponent_team", "was_home",
        "starts", "goals_scored", "assists", "clean_sheets", "goals_conceded", "saves", "yellow_cards", "red_cards", "own_goals",
        "penalties_missed", "penalties_saved", "bps", "expected_goals_conceded", "defensive_contribution", "fixture"]
HSHORT = ["r", "pts", "val", "min", "xg", "xa", "bon", "opp", "h", "st", "gl", "as", "cs", "gc", "sv", "yc", "rc", "og", "pmi", "psv",
          "bps", "xgc", "dc", "fx"]
NUM = ["now_cost", "cost_change_start", "total_points", "event_points", "points_per_game", "form", "selected_by_percent", "minutes",
       "starts", "goals_scored", "assists", "clean_sheets", "goals_conceded", "saves", "bonus", "bps", "influence", "creativity", "threat",
       "ict_index", "expected_goals", "expected_assists", "expected_goal_involvements", "expected_goals_conceded", "transfers_in_event",
       "transfers_out_event", "yellow_cards", "red_cards", "own_goals", "penalties_missed", "penalties_saved", "defensive_contribution",
       "chance_of_playing_next_round", "ep_next", "penalties_order", "direct_freekicks_order", "corners_and_indirect_freekicks_order", "code"]


def num(v):
    if v is None or v == "" or v == "None":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return int(x) if x == int(x) and "." not in str(v) else x


def rules_for(season):
    """FPL scoring rules of the season: (identifier -> {type: (step, pts)}), minutes (lo, hi)."""
    r = {"goals_scored": {1: (1, 6), 2: (1, 6), 3: (1, 5), 4: (1, 4)}, "assists": {t: (1, 3) for t in (1, 2, 3, 4)},
         "clean_sheets": {1: (1, 4), 2: (1, 4), 3: (1, 1)}, "goals_conceded": {1: (2, -1), 2: (2, -1)}, "saves": {1: (3, 1)},
         "penalties_saved": {1: (1, 5)}, "penalties_missed": {t: (1, -2) for t in (1, 2, 3, 4)},
         "yellow_cards": {t: (1, -1) for t in (1, 2, 3, 4)}, "red_cards": {t: (1, -3) for t in (1, 2, 3, 4)},
         "own_goals": {t: (1, -2) for t in (1, 2, 3, 4)}, "bonus": {t: (1, 1) for t in (1, 2, 3, 4)}}
    if season >= "2025-26":
        r["goals_scored"][1] = (1, 10)
        r["defensive_contribution"] = {2: (10, 2), 3: (12, 2), 4: (12, 2)}
    return r


def score(row, t, R):
    m = row["minutes"] or 0
    p = 0 if m == 0 else (1 if m < 60 else 2)
    for ident, by in R.items():
        if t in by and row.get(ident) is not None:
            step, pts = by[t]
            p += int(row[ident] // step) * pts
    return p


def main(adir, season, out):
    teams = list(csv.DictReader(open(f"{adir}/{season}/teams.csv", encoding="utf-8")))
    pr = list(csv.DictReader(open(f"{adir}/{season}/players_raw.csv", encoding="utf-8")))
    fx = list(csv.DictReader(open(f"{adir}/{season}/fixtures.csv", encoding="utf-8")))
    gw = list(csv.DictReader(open(f"{adir}/{season}/merged_gw.csv", encoding="utf-8", errors="replace")))
    types = {int(p["id"]): int(p["element_type"]) for p in pr}
    pr = [p for p in pr if int(p["element_type"]) <= 4]                       # 2024-25 assistant managers are not players
    cols = ["id", "wn", "fn", "sn", "tm", "ty", "st", "nw"] + NUM
    rows = [[int(p["id"]), p["web_name"], p["first_name"], p["second_name"], int(p["team"]), int(p["element_type"]), p.get("status") or "a",
             p.get("news") or ""] + [num(p.get(k)) for k in NUM] for p in pr]
    keep = {r[0] for r in rows}
    hist = collections.defaultdict(list)
    R = rules_for(season)
    match = collections.Counter()
    for g in gw:
        e = int(g["element"])
        if e not in keep:
            continue
        h = {k: (num(g.get(k)) if k != "was_home" else (1 if g.get("was_home") in ("True", "true", "1") else 0)) for k in HIST}
        h["round"] = int(float(g["round"]))
        hist[str(e)].append([h[k] for k in HIST])
        ok = score(h, types[e], R) == h["total_points"]
        match[(types[e], ok)] += 1
    for v in hist.values():
        v.sort(key=lambda x: (x[0], x[-1] or 0))
    ev = collections.defaultdict(list)
    for f in fx:
        if f["event"]:
            ev[int(float(f["event"]))].append(f["kickoff_time"])
    events = []
    for e in sorted(ev):
        k0 = min(ev[e])
        dl = (datetime.datetime.fromisoformat(k0.replace("Z", "+00:00")) - datetime.timedelta(minutes=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
        events.append(dict(id=e, name=f"Gameweek {e}", fin=True, cur=False, nxt=False, dl=dl, avg=None))
    fix = [[int(float(f["event"])), int(f["team_h"]), int(f["team_a"]), num(f["team_h_difficulty"]), num(f["team_a_difficulty"]),
            1 if f["finished"] == "True" else 0, num(f["team_h_score"]), num(f["team_a_score"]), f["kickoff_time"]] for f in fx if f["event"]]
    sc = {}
    for ident, by in R.items():
        for t, (step, pts) in by.items():
            sc.setdefault(ident, {})[str(t)] = dict(kind="step", step=step, pts=float(pts), n=0)
    sc["minutes"] = {str(t): dict(kind="threshold", at=60, lo=1, hi=2, n=0) for t in (1, 2, 3, 4)}
    d = dict(generated=f"{season} archive", season=season, cols=cols, rows=rows,
             teams=[dict(id=int(t["id"]), n=t["name"], s=t["short_name"], st=num(t.get("strength")), code=num(t.get("code"))) for t in teams],
             events=events, fix=fix, hist=dict(hist), hcols=HSHORT, hv=2,
             haudit=dict(rows=sum(len(v) for v in hist.values()), f={}),
             rules=dict(squad=15, play=11, club=3, budget=1000, transfers_cap=20,
                        types={"1": dict(n="GKP", sel=2, mn=1, mx=1), "2": dict(n="DEF", sel=5, mn=3, mx=5),
                               "3": dict(n="MID", sel=5, mn=2, mx=5), "4": dict(n="FWD", sel=3, mn=1, mx=3)}),
             scoring=sc, scoring_gw=None, postponed=sum(1 for f in fx if not f["event"]))
    for k in HSHORT:
        i = HSHORT.index(k)
        d["haudit"]["f"][k] = sum(1 for v in hist.values() for r in v if r[i] is not None)
    json.dump(d, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    tot = sum(match.values())
    bad = {t: match[(t, False)] for t in (1, 2, 3, 4)}
    print(f"{season}: players {len(rows)} hist rows {d['haudit']['rows']} events {len(events)} fixtures {len(fix)} | "
          f"scoring rules reproduce official points for {(tot - sum(bad.values())) / tot * 100:.2f}% of rows; mismatches by type {bad}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
