"""Season-by-season totals for every player of the finished past seasons. Writes data/career.json. Run offline: python3 tools/career/write.py

Past seasons never change, so this is not part of the sync: run it again only when a season finishes (or a past season is added). The current season is added by the page
in the browser from the league's current player file, with the same sums (assets/player-career.js).
For each finished past season of data/seasons.json that has a player file with rows (a light season that came back with no player rows, such as Ligue 1 2021-22 and
2022-23, is left out) and for each player in it, summed over the matches he has a row in:
  matches (rows with minutes), minutes, goals, assists, xG, non-penalty xG, xAG and the minutes of the matches that HAVE xAG (xAG is missing for whole matches, so a per 90
  figure divides by those minutes only), shots, key passes, tackles + interceptions, and the position and club he played most minutes in.
Output: {"v":1,"t":date,"lgs":[league ids],"n":{player id: name},"p":{player id: [[season, league index, club, position, matches, minutes, goals, assists, xG, npxG,
xAG, xAG minutes, shots, key passes, tackles + interceptions], ...oldest first]}}. Numbers are rounded to two decimals; nothing is estimated."""
import json, os, sys, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
FIELDS = ["s", "lg", "c", "pos", "g", "mi", "gl", "ast", "xg", "npxg", "xag", "xagmi", "sh", "kp", "tkic"]


def season_sums(pl):
    """{player id: {name, club, pos, g, mi, gl, ast, xg, npxg, xag, xagmi, sh, kp, tkic}} of one player file."""
    c = {k: i for i, k in enumerate(pl["cols"])}
    out = {}
    for r in pl["rows"]:
        mi = r[c["mi"]]
        if not mi:
            continue
        a = out.get(r[c["i"]])
        if a is None:
            a = out[r[c["i"]]] = {"name": r[c["n"]], "club": collections.defaultdict(float), "pos": collections.defaultdict(float), "g": 0, "mi": 0.0, "gl": 0.0, "ast": 0.0, "xg": 0.0,
                                  "npxg": 0.0, "xag": 0.0, "xagmi": 0.0, "sh": 0.0, "kp": 0.0, "tkic": 0.0}
        a["name"] = r[c["n"]] or a["name"]
        a["g"] += 1
        a["mi"] += mi
        a["club"][r[c["c"]]] += mi
        if r[c["o"]]:
            a["pos"][r[c["o"]]] += mi
        for k, col in (("gl", "gl"), ("ast", "ast"), ("xg", "xg"), ("npxg", "npxg"), ("sh", "sh"), ("kp", "kp")):
            a[k] += r[c[col]] or 0
        a["tkic"] += (r[c["tk"]] or 0) + (r[c["ic"]] or 0)
        if r[c["xag"]] is not None:
            a["xag"] += r[c["xag"]]
            a["xagmi"] += mi
    return out


def top(d):
    return max(d.items(), key=lambda kv: (kv[1], kv[0]))[0] if d else None


def row(season, li, a):
    r2 = lambda v: round(v, 2)
    return [season, li, top(a["club"]), top(a["pos"]), a["g"], round(a["mi"]), int(a["gl"]), int(a["ast"]), r2(a["xg"]), r2(a["npxg"]), r2(a["xag"]), round(a["xagmi"]),
            int(a["sh"]), int(a["kp"]), int(a["tkic"])]


def main():
    sj = json.load(open(os.path.join(DATA, "seasons.json"), encoding="utf-8"))["leagues"]
    lgs = sorted(sj)
    names, players, used = {}, collections.defaultdict(list), []
    for li, lid in enumerate(lgs):
        for s, e in sorted(sj[lid]["seasons"].items()):
            f = (e.get("files") or {}).get("pl_file")
            if not f or not os.path.exists(os.path.join(DATA, f)):
                continue
            pl = json.load(open(os.path.join(DATA, f), encoding="utf-8"))
            sums = season_sums(pl)
            if not sums:
                print("  skipped (no player rows):", lid, s)
                continue
            used.append((lid, s, len(sums)))
            for pid, a in sums.items():
                names[pid] = a["name"]
                players[pid].append(row(s, li, a))
    for pid in players:
        players[pid].sort(key=lambda r: (r[0], r[1]))
    out = {"v": 1, "t": datetime.date.today().isoformat(), "lgs": lgs, "n": names, "p": players}
    path = os.path.join(DATA, "career.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print("seasons:", used)
    print("players:", len(players), "player-seasons:", sum(len(v) for v in players.values()), "bytes:", os.path.getsize(path))


if __name__ == "__main__":
    main()
