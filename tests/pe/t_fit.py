"""Pressing estimate: the fit script (tools/sb-press/fit_press_est.py) on a made-up league set with a known rule, and the shape of
data/press_est.json (the fitted file the page reads). Run from tests/pe."""
import json, os, random, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FIT = os.path.join(ROOT, "tools", "sb-press", "fit_press_est.py")
fail = 0
def ok(c, m):
    global fail
    print(("ok   " if c else "FAIL ") + m)
    if not c: fail += 1

# ---- a made-up set: pressures = base[group] + 1.5 tackles + 0.5 interceptions (per 90), noise-free, four leagues of 300 matches
random.seed(7)
BASE = {"CB": 6.0, "FB": 9.0, "MID": 15.0, "WING": 12.0, "FWD": 11.0}
def mk(label, n):
    ms = []
    for i in range(n):
        rows = []
        for j in range(22):
            g = list(BASE)[j % 5] if j != 0 and j != 11 else "GK"
            mi = 90.0
            tk, ic = random.randint(0, 5), random.randint(0, 4)
            pr = round(BASE.get(g, 0) + 1.5 * tk + 0.5 * ic) if g != "GK" else 0
            rows.append([j + 1000 * (1 + (i % 7)), "p%d" % j, "T", mi, g, pr, tk, ic, random.randint(0, 3), 0, 0, 0, 0])
        ms.append({"id": label + str(i), "date": "2015-09-01", "home": "A", "away": "B", "hs": 1, "as": 0, "rows": rows})
    return label, ms
S = dict(mk("PL 2015-16", 300) for _ in [0])
S.update([mk("LaLiga 2015-16", 300), mk("SerieA 2015-16", 300), mk("Ligue1 2015-16", 300), mk("Bundesliga 2015-16", 34)])
d = tempfile.mkdtemp()
rows_p, out_p = os.path.join(d, "rows.json"), os.path.join(d, "out.json")
json.dump(S, open(rows_p, "w"))
r = subprocess.run([sys.executable, FIT, out_p, rows_p], capture_output=True, text=True)
ok(r.returncode == 0, "the fit script runs on the made-up set" + ("" if r.returncode == 0 else ": " + r.stderr[-200:]))
if r.returncode == 0:
    o = json.load(open(out_p))
    ok(sorted(o["leagues"]) == ["La Liga", "Ligue 1", "Premier League", "Serie A"], "the four full leagues are used; the 34-match Bundesliga is left out: " + ", ".join(o["leagues"]))
    ok(o["features"] == ["tk", "ic"] and all(len(c) == 3 for c in o["coef"].values()), "per position group: a constant and two weights (tackles, interceptions); no blocks, no clearances")
    good = all(abs(o["coef"][g][0] - BASE[g]) < .25 and abs(o["coef"][g][1] - 1.5) < .1 and abs(o["coef"][g][2] - .5) < .1 for g in BASE)
    ok(good, "the known rule is recovered (constants and 1.5 / 0.5): " + "; ".join("%s %.2f %.2f %.2f" % (g, *o["coef"][g]) for g in BASE))
    ok(all(v["season"]["corr"] > .99 and v["match"]["r2"] > .98 for v in o["cv"].values()), "each league, fitted on the other three, is predicted almost perfectly when the rule is exact")
    ok(all(v["season"]["corr"] > v["season_position_only"]["corr"] for v in o["cv"].values()), "the estimate beats the role alone on every held-out league")
    ok(abs(o["cv"]["Premier League"]["season"]["bias"]) < .2, "no bias on the held-out league (%.3f)" % o["cv"]["Premier League"]["season"]["bias"])

# ---- the fitted file the page reads
F = json.load(open(os.path.join(ROOT, "data", "press_est.json")))
ok(F["v"] == 1 and F["features"] == ["tk", "ic"] and set(F["coef"]) == set(BASE), "data/press_est.json: version 1, tackles and interceptions, five position groups")
ok(all(len(c) == 3 and c[1] > 0 and c[2] > -.5 for c in F["coef"].values()), "each group: three numbers, a positive weight on tackles, interceptions not strongly negative: " + "; ".join("%s %s" % (g, c) for g, c in F["coef"].items()))
ok(sorted(F["cv"]) == ["La Liga", "Ligue 1", "Premier League", "Serie A"] and all(v["season"]["n"] > 250 for v in F["cv"].values()), "tested on four leagues, 250+ players each at 900+ minutes")
ok(all(v["season"]["corr"] > v["season_position_only"]["corr"] and v["season"]["mae"] < v["season_position_only"]["mae"] for v in F["cv"].values()), "on every held-out league the estimate has a higher correlation and a smaller miss than the role alone")
ok(F["rows"] > 30000 and F["min_season_minutes"] == 900, "fitted on %d player-matches" % F["rows"])
ok("StatsBomb" in F["source"] and "derived" in F["source"], "the source line names StatsBomb and says only derived counts are kept")
print("all passed" if not fail else "%d failed" % fail)
sys.exit(1 if fail else 0)
