"""Goalkeepers (tools/gk/fit.py -> data/gk_repeat.json): which shots a keeper faces and who the keeper is on made-up files with a known answer,
the correlation helpers, the repeat test on two made-up seasons, then the real file worked again with a second implementation."""
import json, os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(ROOT, "tools", "gk"))
import fit

n = 0
def ok(c, m):
    global n
    if not c:
        print("FAIL", m); sys.exit(1)
    print("ok  ", m); n += 1

cols = ["m", "c", "ev", "og", "bl", "xo", "kid"]
sh = {"cols": cols, "rows": [
    ["m1", "A", "Goal", 0, 0, 0.6, "gB"],          # A scores on B's keeper
    ["m1", "A", "AttemptSaved", 0, 0, 0.3, "gB"],   # saved by B's keeper
    ["m1", "A", "AttemptSaved", 0, 1, 0.0, ""],     # blocked: not a shot faced
    ["m1", "A", "Miss", 0, 0, 0.0, ""],             # off target: not faced
    ["m1", "A", "Goal", 1, 0, 0.9, "gB"],           # own goal: left out
    ["m1", "B", "AttemptSaved", 0, 0, 0.5, ""],     # B's shot, A's keeper (no id in the shot)
    ["m2", "Z", "Goal", 0, 0, 0.5, ""],             # match not in the league file
    ["m3", "B", "Goal", 0, 0, 0.2, ""],             # no line-up
]}
matches = [{"i": "m1", "h": "A", "a": "B"}, {"i": "m3", "h": "A", "a": "B"}]
mx = {"m1": {"lu": {"h": {"xi": [["gA", "Keeper A", "1", 11], ["x", "Field", "9", 90]]}, "a": {"xi": [["gB", "Keeper B", "1", 11]]}}}}
S = fit.shots_faced(sh, matches, mx)
ok(len(S) == 3, "goal + save + the other side's save are faced; blocked, off target, own goal, unknown match and no line-up are not")
ok(S[0] == ("m1", "gB", "Keeper B", 1, 0.6, "gB") and S[2][1] == "gA" and S[2][2] == "Keeper A", "the keeper is the starting keeper of the side that did not shoot")
K = fit.per_keeper(S)
ok(K["gB"]["n"] == 2 and K["gB"]["g"] == 1 and abs(K["gB"]["x"] - 0.9) < 1e-12 and K["gA"]["n"] == 1, "per keeper: shots, goals, xGOT")
ok(abs(fit.spearman([1, 2, 3, 4], [10, 20, 30, 40]) - 1) < 1e-12 and abs(fit.spearman([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-12, "Spearman: 1 and −1")
ok(abs(fit.spearman([1, 2, 2, 4], [1, 3, 2, 4]) - 0.9486832980505138) < 1e-9, "Spearman with a tie (worked by hand: 0.9487)")

# build on two made-up seasons: two keepers whose prevented-per-shot goes the same way, then the opposite way
def mk(season, spec):
    rows, ms, mxs = [], [], {}
    for i, (k, shots) in enumerate(spec.items()):
        for j in range(2):                      # two matches of two shots for each keeper
            mid = f"{season}_{i}_{j}"; ms.append({"i": mid, "h": "H", "a": "V"})
            mxs[mid] = {"lu": {"h": {"xi": [["gH", "h", "1", 11]]}, "a": {"xi": [[k, k, "1", 11]]}}}
            for xo, goal in shots[2 * j:2 * j + 2]:
                rows.append([mid, "H", "Goal" if goal else "AttemptSaved", 0, 0, xo, k])
    return {"cols": cols, "rows": rows}, {"matches": ms}, {"m": mxs}
fit.SEASONS = ["s1", "s2"]; fit.MIN_YOY = 3; fit.MIN_SEASON = 4; fit.MIN_HALF = 2
d = tempfile.mkdtemp()
a = {f"k{i}": [(0.5, 1)] * i + [(0.5, 0)] * (4 - i) for i in range(5)}   # 0 to 4 goals from 4 shots of xGOT 0.5
b = {f"k{i}": [(0.6, 1)] * i + [(0.6, 0)] * (4 - i) for i in range(5)}   # the same order, different numbers
for s, spec in (("s1", a), ("s2", b)):
    sh2, lg2, mx2 = mk(s, spec)
    json.dump(sh2, open(f"{d}/{fit.LEAGUE}_{s}_sh.json", "w")); json.dump(lg2, open(f"{d}/{fit.LEAGUE}_{s}.json", "w")); json.dump(mx2, open(f"{d}/{fit.LEAGUE}_{s}_mx.json", "w"))
out = fit.build(d)
ok(out["yoy"]["n"] == 5 and out["yoy"]["r"] == 1.0 and out["half"]["n"] == 10, "made-up seasons: five keepers in the same order of goals prevented both seasons: year to year correlation 1.0, ten keeper-seasons in the odd/even test")
ok(out["agree"] == {"n": 40, "same": 40} and [s["shots"] for s in out["seasons"]] == [20, 20], "the id in the shot and the line-up agree on all 40 shots; 20 shots a season")

# the real file against a second implementation
D = os.path.join(ROOT, "data")
F = json.load(open(os.path.join(D, "gk_repeat.json")))
real = {}
for s in ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]:
    lg = json.load(open(f"{D}/l_4WFCIZ_{s}.json")); sh = json.load(open(f"{D}/l_4WFCIZ_{s}_sh.json")); mxm = json.load(open(f"{D}/l_4WFCIZ_{s}_mx.json"))["m"]
    ix = {c: i for i, c in enumerate(sh["cols"])}; side = {m["i"]: m for m in lg["matches"]}; tot = [0, 0, 0.0]; keep = {}
    for r in sh["rows"]:
        if r[ix["og"]] or r[ix["bl"]] or r[ix["ev"]] not in ("Goal", "AttemptSaved"): continue
        m = side.get(r[ix["m"]])
        if m is None: continue
        d_ = "a" if r[ix["c"]] == m["h"] else ("h" if r[ix["c"]] == m["a"] else None)
        if d_ is None: continue
        xi = (((mxm.get(r[ix["m"]]) or {}).get("lu") or {}).get(d_) or {}).get("xi") or []
        g = [p[0] for p in xi if p[3] == 11]
        if not g: continue
        tot[0] += 1; tot[1] += r[ix["ev"]] == "Goal"; tot[2] += r[ix["xo"]] or 0
        k = keep.setdefault(g[0], [0, 0, 0.0]); k[0] += 1; k[1] += r[ix["ev"]] == "Goal"; k[2] += r[ix["xo"]] or 0
    real[s] = (tot, keep)
sea = {x["s"]: x for x in F["seasons"]}
ok(all(sea[s]["shots"] == real[s][0][0] and sea[s]["goals"] == real[s][0][1] and abs(sea[s]["xgot"] - real[s][0][2]) < 0.06 for s in real), "shots faced, goals and xGOT of each of the five seasons worked again: " + ", ".join(f"{s} {real[s][0][0]}/{real[s][0][1]}/{real[s][0][2]:.1f}" for s in real))
xs, ys = [], []
S5 = list(real)
for s1, s2 in zip(S5, S5[1:]):
    for p, v in real[s1][1].items():
        w = real[s2][1].get(p)
        if w and v[0] >= 60 and w[0] >= 60:
            xs.append((v[2] - v[1]) / v[0]); ys.append((w[2] - w[1]) / w[0])
def rk(v):
    s = sorted(v); return [sum(i for i, t in enumerate(s) if t == x) / s.count(x) for x in v]
def pr(a, b):
    ra, rb = rk(a), rk(b); n_ = len(a); ma, mb = sum(ra) / n_, sum(rb) / n_
    return sum((x - ma) * (y - mb) for x, y in zip(ra, rb)) / (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** .5
ok(F["yoy"]["n"] == len(xs) and abs(F["yoy"]["r"] - pr(xs, ys)) < 6e-4, f"year to year worked again: {len(xs)} pairs, correlation {pr(xs, ys):.3f}")
ok(F["agree"]["same"] / F["agree"]["n"] > 0.99, "the line-up keeper is the shot's own keeper on more than 99%% of shots (%d of %d)" % (F["agree"]["same"], F["agree"]["n"]))
ok(abs(F["yoy"]["r"]) < 2 * F["yoy"]["se"] and abs(F["half"]["sb"]) < 2 * F["half"]["se"], "both correlations are within two standard errors of zero (the page says there is no sign it repeats)")
print("all passed")
