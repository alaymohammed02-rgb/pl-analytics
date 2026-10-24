"""Fits the pressing ESTIMATE for data/press_est.json: pressures per 90 from tackles and interceptions, per position group.

Why an estimate: StatsBomb's free event data has the real pressures only for old league seasons and a few tournaments; the six current
leagues come from PitchAPI, which has no pressure events. The estimate is trained on StatsBomb's full 2015/16 seasons of the Premier
League, La Liga, Serie A and Ligue 1 (one row per player per match, from overlap_ligue1.py) and tested leave-one-league-out: fitted on
three leagues, scored on the fourth, so it is always judged on a league it never saw. Clearances and blocks are left out on purpose:
- StatsBomb tagged far more clearances in 2015/16 than in 2021-23 (a centre-back: 5.5 against 2.6 per 90);
- PitchAPI's blocks are a different count from StatsBomb's (a midfielder: 0.25 against 1.9 per 90), while tackles and interceptions are of the same size.

Needs the file overlap_ligue1.py writes ({season label: [match...]}) for StatsBomb 2015/16 (competition ids 2, 11, 12, 7 with season 27).
   python3 fit_press_est.py OUT.json ROWS.json
"""
import json, sys
import numpy as np

GROUPS = ["CB", "FB", "MID", "WING", "FWD"]
MIN_ROW = 30          # minutes in a match for the row to count
MIN_SEASON = 900      # minutes for the player-season check
LAM = 1.0             # ridge, in units of one player-match of 90 minutes
# columns of a reduced row: [id, name, team, minutes, group, pr, tk, ic, bl, cl, rec, du, fo]
PR, TK, IC, BL = 5, 6, 7, 8


def design(r):
    mi = r[4]
    return [1.0] + [r[6][k] / mi * 90 for k in (1, 2)]


def fit(rows):
    """One weighted ridge regression per position group: pressures per 90 on tackles and interceptions per 90."""
    coef = {}
    for g in GROUPS:
        G = [r for r in rows if r[5] == g]
        A = np.array([design(r) for r in G])
        y = np.array([r[6][0] / r[4] * 90 for r in G])
        w = np.array([r[4] / 90 for r in G])
        reg = LAM * np.eye(A.shape[1])
        reg[0, 0] = 0.0
        coef[g] = np.linalg.solve((A * w[:, None]).T @ A + reg, (A * w[:, None]).T @ y)
    return coef


def predict(coef, r):
    return float(np.array(design(r)) @ coef[r[5]])


def position_only(rows):
    return {g: sum(r[6][0] for r in rows if r[5] == g) / sum(r[4] for r in rows if r[5] == g) * 90 for g in GROUPS}


def season_table(rows, preds):
    ag = {}
    for r, p in zip(rows, preds):
        a = ag.setdefault((r[2], r[5]), [0.0, 0.0, 0.0])
        a[0] += r[6][0]
        a[1] += p * r[4] / 90
        a[2] += r[4]
    return [(a[0] / a[2] * 90, a[1] / a[2] * 90, g) for (pid, g), a in ag.items() if a[2] >= MIN_SEASON]


def score(y, p):
    y, p = np.array(y), np.array(p)
    return dict(n=int(len(y)), r2=float(1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum()), corr=float(np.corrcoef(y, p)[0, 1]),
                mae=float(np.abs(y - p).mean()), mean=float(y.mean()), bias=float((p - y).mean()))


def main():
    out_path, rows_path = sys.argv[1], sys.argv[2]
    R = {}
    for label, ms in json.load(open(rows_path)).items():
        if len(ms) < 300:       # a partial competition (the open Bundesliga 2015/16 holds only Bayer Leverkusen's 34 matches) is no league pool
            continue
        lg = {"PL": "Premier League", "LaLiga": "La Liga", "SerieA": "Serie A", "Ligue1": "Ligue 1"}.get(label.split(" ")[0], label.split(" ")[0])
        for m in ms:
            for r in m["rows"]:
                if r[3] >= MIN_ROW and r[4] != "GK":
                    R.setdefault(lg, []).append((lg, m["id"], r[0], r[2], r[3], r[4], [r[PR], r[TK], r[IC], r[BL]]))
    leagues = sorted(R)
    cv = {}
    for held in leagues:
        tr = [r for l in leagues if l != held for r in R[l]]
        te = R[held]
        c = fit(tr)
        base = position_only(tr)
        p = [predict(c, r) for r in te]
        pb = [base[r[5]] for r in te]
        y = [r[6][0] / r[4] * 90 for r in te]
        s_ = season_table(te, p)
        sb_ = season_table(te, pb)
        cv[held] = dict(match=score(y, p), season=score([a for a, _, _ in s_], [b for _, b, _ in s_]),
                        season_position_only=score([a for a, _, _ in sb_], [b for _, b, _ in sb_]),
                        by_group={g: score([a for a, b, gg in s_ if gg == g], [b for a, b, gg in s_ if gg == g]) for g in GROUPS
                                  if len([1 for a, b, gg in s_ if gg == g]) > 10})
    allrows = [r for l in leagues for r in R[l]]
    coef = fit(allrows)
    pool = {g: dict(mean_pr=float(sum(r[6][0] for r in allrows if r[5] == g) / sum(r[4] for r in allrows if r[5] == g) * 90),
                    minutes=float(sum(r[4] for r in allrows if r[5] == g))) for g in GROUPS}
    doc = dict(v=1, source="StatsBomb Open Data, full 2015/16 seasons (derived counts only)", leagues=leagues, features=["tk", "ic"],
               min_row_minutes=MIN_ROW, min_season_minutes=MIN_SEASON, lam=LAM,
               coef={g: [round(float(x), 5) for x in coef[g]] for g in GROUPS}, groups=pool, cv=cv,
               rows=len(allrows))
    json.dump(doc, open(out_path, "w"), indent=1)
    print(json.dumps({k: {kk: (round(vv["r2"], 3), round(vv["corr"], 3), round(vv["mae"], 2)) for kk, vv in v.items() if kk in ("match", "season", "season_position_only")} for k, v in cv.items()}, indent=1))


if __name__ == "__main__":
    main()
