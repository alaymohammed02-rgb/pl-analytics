

# ============================================================================
# إضافة: أغرب حقائق الأسبوع وحقائق كل فريق → data/facts.json (من بيانات PitchAPI المخزنة، بدون أي طلب جديد)
# كل حقيقة لها "ندرة" محسوبة من الموسم كله في كل دوريات الموقع: كم مرة صار الشي نفسه أو أغرب منه (k من N).
# الأغرب = الأندر (k/N أصغر). ما فيه تقدير ولا تخمين: كل رقم من التسديدات والنتائج كما هي، والمباراة تدخل فقط إذا أهدافها
# في ملف التسديدات تساوي نتيجتها الرسمية.
# النص مكتوب بالإنجليزي والعربي (الأسماء مهربة) والصفحة تعرض لغتها.
# ============================================================================
import hashlib
import html as _fx_html
import math as _fx_math

FX_PATH = "data/facts.json"
FX_WEEK_DAYS = 7          # "الأسبوع": آخر 7 أيام (وإذا ما فيه مباريات كفاية، آخر 7 أيام فيها مباريات)
FX_WEEK_MIN_MATCHES = 5
FX_WEEK_N = 4             # كم حقيقة للأسبوع
FX_WEEK_MAX_P = 0.05      # ما تنعرض إلا لو صارت في 5% أو أقل من الحالات
FX_TEAM_N = 4             # كم حقيقة لكل فريق
FX_TEAM_MAX_P = 0.05
FX_TEAM_MIN_GOALS = 8     # نسب أهداف الفريق تحتاج 8 أهداف على الأقل
SET_PIECES = ("FromCorner", "SetPiece", "FreeKick", "ThrowInSetPiece")

_e = lambda s: _fx_html.escape(str(s or ""))
_nm = lambda s: f"<bdi>{_e(s)}</bdi>"
_nb = lambda s: f'<bdi dir="ltr">{s}</bdi>'
_xgb = lambda v: _nb("xG " + _x2(v))   # "xG 1.12" as one left-to-right unit (in Arabic the word and the number would swap places)
_x2 = lambda v: "<0.01" if 0 <= v < 0.005 else f"{v:.2f}"


def _ar_n(n, one, two, few, many):
    """العدد مع المعدود بالعربي: 1 هدف، هدفين، 3-10 أهداف، 11+ هدف."""
    n = int(n)
    return one if n == 1 else two if n == 2 else f"{_nb(n)} {few}" if 3 <= n <= 10 else f"{_nb(n)} {many}"


_ar_goals = lambda n: _ar_n(n, "هدف", "هدفين", "أهداف", "هدف")
_ar_pens = lambda n: _ar_n(n, "ركلة جزاء", "ركلتي جزاء", "ركلات جزاء", "ركلة جزاء")


def _fx_score(s):
    try:
        a, b = str(s).split("-")
        return int(a), int(b)
    except Exception:
        return None


def _fx_matches(matches, shots, club_of):
    """المباريات المنتهية اللي ملف تسديداتها فيه كل أهدافها: لكل مباراة التسديدات مع الفريق (h/a) وصاحب الهدف."""
    by = {}
    for r in shots:
        if r.get("pd") == "PenaltyShootout" or r.get("mn") is None:
            continue
        by.setdefault((r["l"], r["m"]), []).append(r)
    out = []
    for m in matches:
        sc = _fx_score(m.get("s"))
        rows = by.get((m["l"], m["m"]))
        if not sc or not rows:
            continue
        H, A = m["h"], m["a"]
        nm = lambda c: "h" if c == H else "a" if c == A else None
        tid = {}
        for r in rows:          # الفريق: بالاسم، أو برقم الفريق (نتعلمه من صفوف فيها الاسم أو من نادي اللاعب)
            s = nm(r.get("c"))
            if not s and not r.get("og"):
                s = nm(club_of.get((m["l"], m["m"], r.get("pid"))))
            if s and r.get("tid") and not r.get("og"):
                tid[r["tid"]] = s
        sh = []
        for r in rows:
            own = nm(r.get("c")) or tid.get(r.get("c")) or tid.get(r.get("tid"))
            if not own:
                continue
            side = ("a" if own == "h" else "h") if r.get("og") else own
            goal = r.get("ev") == "Goal" or bool(r.get("og"))
            sh.append(dict(r, own=own, side=side, goal=goal, xg=float(r.get("xg") or 0), ma=float(r.get("ma") or 0)))
        gh = sum(1 for r in sh if r["goal"] and r["side"] == "h")
        ga = sum(1 for r in sh if r["goal"] and r["side"] == "a")
        if (gh, ga) != sc:
            continue
        key = lambda r: (0 if r.get("pd") == "FirstHalf" else 1, r["mn"], r["ma"], 1 if r["goal"] else 0)
        sh.sort(key=key)
        out.append(dict(l=m["l"], m=m["m"], d=str(m.get("d") or "")[:10], h=H, a=A, sc=sc, sh=sh))
    return out


def _fx_clock(r):
    if r["ma"] > 0:
        return f"{45 if r.get('pd') == 'FirstHalf' else 90}+{int(r['ma'])}'"
    return f"{int(r['mn'])}'"


def _fx_dist(r):
    if r.get("x") is None or r.get("y") is None:
        return None
    return _fx_math.hypot(105 - float(r["x"]), 34 - float(r["y"]))


def _fx_rar(pop, v, upper=True):
    """k = كم حالة في الموسم وصلت لنفس القيمة أو أبعد منها؛ N = كل الحالات."""
    N = len(pop)
    if not N:
        return None, 0, 0
    k = sum(1 for x in pop if (x >= v - 1e-9 if upper else x <= v + 1e-9))
    return k / N, k, N


def fx_compute(matches, shots, club_of, now, team_names=None):
    M = _fx_matches(matches, shots, club_of)
    TM, G, PM, MM = [], [], [], []
    for mt in M:
        sides = {}
        for s in ("h", "a"):
            o = "a" if s == "h" else "h"
            mine = [r for r in mt["sh"] if r["own"] == s and not r["og"]]
            gl = [r for r in mt["sh"] if r["goal"] and r["side"] == s]
            g, gc = mt["sc"][0 if s == "h" else 1], mt["sc"][1 if s == "h" else 0]
            # the score as it went: the biggest deficit this side came back from
            sh_, so_, worst = 0, 0, 0
            for r in mt["sh"]:
                if not r["goal"]:
                    continue
                if r["side"] == s:
                    sh_ += 1
                else:
                    so_ += 1
                worst = max(worst, so_ - sh_)
            sides[s] = dict(mt=mt, s=s, o=o, team=mt[s], opp=mt[o], g=g, gc=gc, n=len(mine), xg=sum(r["xg"] for r in mine),
                            head=sum(1 for r in gl if r.get("ty") == "Header" and not r["og"]),
                            penmiss=sum(1 for r in mine if r.get("st") == "Penalty" and r.get("ev") != "Goal"), deficit=worst)
        for s in ("h", "a"):
            sides[s]["xga"] = sides[sides[s]["o"]]["xg"]
            TM.append(sides[s])
        for r in mt["sh"]:
            if r["goal"] and not r["og"]:
                G.append(dict(r=r, mt=mt, team=mt[r["own"]], opp=mt["a" if r["own"] == "h" else "h"], dist=_fx_dist(r)))
        pl = {}
        for r in mt["sh"]:
            if r["og"] or not r.get("pid"):
                continue
            p = pl.setdefault(r["pid"], dict(pn=r.get("pn"), own=r["own"], g=0, xg=0.0, mt=mt))
            p["g"] += 1 if r["goal"] else 0
            p["xg"] += r["xg"]
        PM.extend(pl.values())
        MM.append(dict(mt=mt, og=sum(1 for r in mt["sh"] if r["og"]), stop=sum(1 for r in mt["sh"] if r["goal"] and r["ma"] > 0),
                       goals=sum(mt["sc"]), xg=sum(r["xg"] for r in mt["sh"] if not r["og"])))
    np_goals = [x for x in G if x["r"].get("st") != "Penalty"]

    F = []

    def add(kind, mt, team, p, k, N, en, ar, en_r, ar_r, extra=None):
        F.append(dict(k=kind, l=mt["l"], m=mt["m"], d=mt["d"], team=team, p=round(p, 5), n=k, N=N,
                      en=en, ar=ar, er=en_r, arr=ar_r, **(extra or {})))

    sc_ = lambda t: _nb(f"{t['g']}–{t['gc']}")
    # 1) a win while out-created
    pop = [t["xga"] - t["xg"] for t in TM if t["g"] > t["gc"]] + [-9] * sum(1 for t in TM if not t["g"] > t["gc"])
    for t in TM:
        d = t["xga"] - t["xg"]
        if t["g"] > t["gc"] and d >= 1.0:
            p, k, N = _fx_rar(pop, d)
            add("win_out", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} beat {_nm(t['opp'])} {sc_(t)} with xG of {_nb(_x2(t['xg']))} against {_nb(_x2(t['xga']))}.",
                f"{_nm(t['team'])} فاز على {_nm(t['opp'])} {sc_(t)} وهو صاحب {_xgb(t['xg'])} مقابل {_nb(_x2(t['xga']))}.",
                f"Only {k} of {N} team performances this season won while out-created by that much.",
                f"بس {_nb(k)} من {_nb(N)} أداء فريق هذا الموسم فاز وخصمه صنع أكثر منه بهالفارق.")
    # 2) a goal from almost nothing
    pop = [x["r"]["xg"] for x in np_goals]
    for x in np_goals:
        if x["r"]["xg"] <= 0.04:
            p, k, N = _fx_rar(pop, x["r"]["xg"], upper=False)
            add("tiny", x["mt"], x["team"], p, k, N,
                f"{_nm(x['r'].get('pn'))} scored for {_nm(x['team'])} against {_nm(x['opp'])} ({_nb(_fx_clock(x['r']))}) from a chance worth {_xgb(x['r']['xg'])}.",
                f"{_nm(x['r'].get('pn'))} سجّل لـ{_nm(x['team'])} ضد {_nm(x['opp'])} (الدقيقة {_nb(_fx_clock(x['r']).rstrip(chr(39)))}) من فرصة قيمتها {_xgb(x['r']['xg'])}.",
                f"{k} of {N} goals this season (penalties aside) came from a chance that small.",
                f"{_nb(k)} من {_nb(N)} هدف هذا الموسم (بدون ركلات الجزاء) جت من فرصة بهالصغر.")
    # 3) a goal from far out
    pop = [x["dist"] for x in G if x["dist"] is not None]
    for x in G:
        if x["dist"] is not None and x["dist"] >= 25 and x["r"].get("st") != "Penalty" and x["r"]["xg"] <= 0.1:   # a far shot is a small chance: a big xG would mean the place is wrong
            p, k, N = _fx_rar(pop, x["dist"])
            add("far", x["mt"], x["team"], p, k, N,
                f"{_nm(x['r'].get('pn'))} scored for {_nm(x['team'])} against {_nm(x['opp'])} from about {_nb(round(x['dist']))} metres.",
                f"{_nm(x['r'].get('pn'))} سجّل لـ{_nm(x['team'])} ضد {_nm(x['opp'])} من حوالي {_nb(round(x['dist']))} متر.",
                f"Only {k} of {N} goals this season were scored from that far.",
                f"بس {_nb(k)} من {_nb(N)} هدف هذا الموسم انسجلت من هالمسافة أو أبعد.")
    # 4) many shots, no goal  5) big xG, no goal
    pop_n = [t["n"] if t["g"] == 0 else -1 for t in TM]
    pop_x = [t["xg"] if t["g"] == 0 else -1 for t in TM]
    for t in TM:
        if t["g"] == 0 and t["n"] >= 15:
            p, k, N = _fx_rar(pop_n, t["n"])
            add("dry_n", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} took {_nb(t['n'])} shots against {_nm(t['opp'])} and did not score.",
                f"{_nm(t['team'])} سدّد {_nb(t['n'])} تسديدة ضد {_nm(t['opp'])} وما سجّل.",
                f"{k} of {N} team performances this season had that many shots without a goal.",
                f"{_nb(k)} من {_nb(N)} أداء فريق هذا الموسم فيه هالعدد من التسديدات بدون هدف.")
        if t["g"] == 0 and t["xg"] >= 2.0:
            p, k, N = _fx_rar(pop_x, t["xg"])
            add("dry_x", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} created {_xgb(t['xg'])} against {_nm(t['opp'])} and did not score.",
                f"{_nm(t['team'])} صنع {_xgb(t['xg'])} ضد {_nm(t['opp'])} وما سجّل.",
                f"{k} of {N} team performances this season reached that xG without a goal.",
                f"{_nb(k)} من {_nb(N)} أداء فريق هذا الموسم وصل هالـxG بدون هدف.")
    # 6) far more goals than xG
    pop = [t["g"] - t["xg"] for t in TM]
    for t in TM:
        v = t["g"] - t["xg"]
        if v >= 2.5:
            p, k, N = _fx_rar(pop, v)
            add("clinical", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} scored {_nb(t['g'])} against {_nm(t['opp'])} from {_xgb(t['xg'])}.",
                f"{_nm(t['team'])} سجّل {_ar_goals(t['g'])} ضد {_nm(t['opp'])} من {_xgb(t['xg'])}.",
                f"{k} of {N} team performances this season beat their xG by that much.",
                f"{_nb(k)} من {_nb(N)} أداء فريق هذا الموسم تجاوز الـxG بهالفارق.")
    # 7) very late goal  8) very early goal
    pop_l = [x["r"]["ma"] if (x["r"].get("pd") == "SecondHalf" and x["r"]["mn"] >= 90) else -1 for x in G]
    pop_e = [x["r"]["mn"] if (x["r"].get("pd") == "FirstHalf" and not x["r"]["ma"]) else 99 for x in G]
    for x in G:
        r = x["r"]
        if r.get("pd") == "SecondHalf" and r["mn"] >= 90 and r["ma"] >= 7:
            p, k, N = _fx_rar(pop_l, r["ma"])
            add("late", x["mt"], x["team"], p, k, N,
                f"{_nm(r.get('pn'))} scored for {_nm(x['team'])} against {_nm(x['opp'])} in the {_nb(_fx_clock(r))} minute.",
                f"{_nm(r.get('pn'))} سجّل لـ{_nm(x['team'])} ضد {_nm(x['opp'])} في الدقيقة {_nb(_fx_clock(r).rstrip(chr(39)))}.",
                f"Only {k} of {N} goals this season came that late.",
                f"بس {_nb(k)} من {_nb(N)} هدف هذا الموسم جت بهالتأخير.")
        if r.get("pd") == "FirstHalf" and not r["ma"] and r["mn"] <= 2:
            p, k, N = _fx_rar(pop_e, r["mn"], upper=False)
            add("early", x["mt"], x["team"], p, k, N,
                f"{_nm(r.get('pn'))} scored for {_nm(x['team'])} against {_nm(x['opp'])} in minute {_nb(int(r['mn']))}.",
                f"{_nm(r.get('pn'))} سجّل لـ{_nm(x['team'])} ضد {_nm(x['opp'])} في الدقيقة {_nb(int(r['mn']))}.",
                f"Only {k} of {N} goals this season came that early.",
                f"بس {_nb(k)} من {_nb(N)} هدف هذا الموسم جت بهالبكور.")
    # 9) headers  10) penalties missed  11) comeback
    pop_h = [t["head"] for t in TM]
    pop_p = [t["penmiss"] for t in TM]
    pop_c = [t["deficit"] if t["g"] > t["gc"] else -1 for t in TM]
    for t in TM:
        if t["head"] >= 3:
            p, k, N = _fx_rar(pop_h, t["head"])
            add("heads", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} scored {_nb(t['head'])} headers against {_nm(t['opp'])}.",
                f"{_nm(t['team'])} سجّل {_ar_goals(t['head'])} بالرأس ضد {_nm(t['opp'])}.",
                f"Only {k} of {N} team performances this season had that many headed goals.",
                f"بس {_nb(k)} من {_nb(N)} أداء فريق هذا الموسم فيه هالعدد من أهداف الرأس.")
        if t["penmiss"] >= 2:
            p, k, N = _fx_rar(pop_p, t["penmiss"])
            add("pens", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} missed {_nb(t['penmiss'])} penalties against {_nm(t['opp'])}.",
                f"{_nm(t['team'])} أضاع {_ar_pens(t['penmiss'])} ضد {_nm(t['opp'])}.",
                f"Only {k} of {N} team performances this season missed that many.",
                f"بس {_nb(k)} من {_nb(N)} أداء فريق هذا الموسم أضاع هالعدد.")
        if t["g"] > t["gc"] and t["deficit"] >= 2:
            p, k, N = _fx_rar(pop_c, t["deficit"])
            add("comeback", t["mt"], t["team"], p, k, N,
                f"{_nm(t['team'])} came from {_nb(t['deficit'])} goals down to beat {_nm(t['opp'])} {sc_(t)}.",
                f"{_nm(t['team'])} كان متأخر بـ{_ar_goals(t['deficit'])} وفاز على {_nm(t['opp'])} {sc_(t)}.",
                f"Only {k} of {N} team performances this season won from that far behind.",
                f"بس {_nb(k)} من {_nb(N)} أداء فريق هذا الموسم فاز بعد تأخر بهالفارق.")
    # 12) own goals  13) goals in added time  14) many goals from little xG (per match)
    pop_o = [x["og"] for x in MM]
    pop_s = [x["stop"] for x in MM]
    pop_g = [x["goals"] - x["xg"] for x in MM]
    for x in MM:
        mt = x["mt"]
        both = f"{_nm(mt['h'])} {_nb(str(mt['sc'][0]) + '–' + str(mt['sc'][1]))} {_nm(mt['a'])}"
        both_ar = f"{_nm(mt['h'])} {_nb(mt['sc'][0])} و{_nm(mt['a'])} {_nb(mt['sc'][1])}"
        if x["og"] >= 2:
            p, k, N = _fx_rar(pop_o, x["og"])
            add("ogs", mt, None, p, k, N, f"{both} had {_nb(x['og'])} own goals.", f"مباراة {both_ar} فيها {_ar_n(x['og'], 'هدف عكسي', 'هدفين عكسيين', 'أهداف عكسية', 'هدف عكسي')}.",
                f"Only {k} of {N} matches this season had that many.", f"بس {_nb(k)} من {_nb(N)} مباراة هذا الموسم فيها هالعدد.", dict(teams=[mt["h"], mt["a"]]))
        if x["stop"] >= 3:
            p, k, N = _fx_rar(pop_s, x["stop"])
            add("stop", mt, None, p, k, N, f"{both} had {_nb(x['stop'])} goals in added time.", f"مباراة {both_ar} فيها {_ar_goals(x['stop'])} في الوقت بدل الضائع.",
                f"Only {k} of {N} matches this season had that many.", f"بس {_nb(k)} من {_nb(N)} مباراة هذا الموسم فيها هالعدد.", dict(teams=[mt["h"], mt["a"]]))
        if x["goals"] >= 5 and x["goals"] - x["xg"] >= 3:
            p, k, N = _fx_rar(pop_g, x["goals"] - x["xg"])
            add("fest", mt, None, p, k, N, f"{both}: {_nb(x['goals'])} goals from a combined xG of {_nb(_x2(x['xg']))}.",
                f"مباراة {both_ar}: {_ar_goals(x['goals'])} من xG مجموعه {_nb(_x2(x['xg']))}.",
                f"Only {k} of {N} matches this season beat their xG by that much.", f"بس {_nb(k)} من {_nb(N)} مباراة هذا الموسم تجاوزت الـxG بهالفارق.",
                dict(teams=[mt["h"], mt["a"]]))
    # 15) a hat-trick from little
    pop = [p["xg"] if p["g"] >= 3 else 99 for p in PM]
    for pm in PM:
        if pm["g"] >= 3 and pm["xg"] <= 1.2:
            p, k, N = _fx_rar(pop, pm["xg"], upper=False)
            mt = pm["mt"]
            team, opp = mt[pm["own"]], mt["a" if pm["own"] == "h" else "h"]
            add("hat", mt, team, p, k, N,
                f"{_nm(pm['pn'])} scored {_nb(pm['g'])} for {_nm(team)} against {_nm(opp)} from {_xgb(pm['xg'])}.",
                f"{_nm(pm['pn'])} سجّل {_ar_goals(pm['g'])} لـ{_nm(team)} ضد {_nm(opp)} من {_xgb(pm['xg'])}.",
                f"Only {k} of {N} player performances this season scored that many from so little.",
                f"بس {_nb(k)} من {_nb(N)} أداء لاعب هذا الموسم سجّل هالعدد من xG بهالقلة.")

    # ---- the week: the rarest, one of each kind, at most two from one match ----
    days = sorted({mt["d"] for mt in M if mt["d"]})
    to = now.strftime("%Y-%m-%d")
    fr = (now - datetime.timedelta(days=FX_WEEK_DAYS - 1)).strftime("%Y-%m-%d")
    if sum(1 for mt in M if fr <= mt["d"] <= to) < FX_WEEK_MIN_MATCHES and days:
        to = days[-1]
        fr = (datetime.datetime.strptime(to, "%Y-%m-%d") - datetime.timedelta(days=FX_WEEK_DAYS - 1)).strftime("%Y-%m-%d")
    wk, seen_k, per_m = [], set(), {}
    for f in sorted((f for f in F if fr <= f["d"] <= to and f["p"] <= FX_WEEK_MAX_P), key=lambda f: (f["p"], f["k"], f["m"])):
        if f["k"] in seen_k or per_m.get(f["m"], 0) >= 2:
            continue
        wk.append(f)
        seen_k.add(f["k"])
        per_m[f["m"]] = per_m.get(f["m"], 0) + 1
        if len(wk) >= FX_WEEK_N:
            break

    # ---- each team over the season: its rarest moments, plus how its goals came compared with every other team ----
    teams = {}
    for t in TM:
        teams.setdefault((t["mt"]["l"], t["team"]), []).append(t)
    agg = []
    for (l, name), L in teams.items():
        gl = [x for x in G if x["mt"]["l"] == l and x["team"] == name]
        g, xg = sum(t["g"] for t in L), sum(t["xg"] for t in L)
        agg.append(dict(l=l, team=name, g=g, xg=xg, n=len(L), gl=gl,
                        sp=sum(1 for x in gl if x["r"].get("st") in SET_PIECES) / g if g else None,
                        hd=sum(1 for x in gl if x["r"].get("ty") == "Header") / g if g else None,
                        ob=sum(1 for x in gl if not x["r"].get("ib")) / g if g else None,
                        lt=sum(1 for x in gl if x["r"].get("pd") == "SecondHalf" and (x["r"]["mn"] >= 76 or x["r"]["ma"] > 0)) / g if g else None))
    TF = []

    def tadd(a, kind, p, k, N, en, ar, er, arr):
        TF.append(dict(k=kind, l=a["l"], team=a["team"], p=round(p, 5), n=k, N=N, en=en, ar=ar, er=er, arr=arr))
    big = [a for a in agg if a["g"] >= FX_TEAM_MIN_GOALS]
    pct = lambda v: _nb(f"{round(v * 100)}%")
    for key, en_t, ar_t, unit_en, unit_ar in (
            ("sp", "of {T}'s goals came from set pieces ({g} of {n}).", "من أهداف {T} جت من كرات ثابتة ({g} من {n}).", "a share that high", "نسبة بهالارتفاع"),
            ("hd", "of {T}'s goals were headers ({g} of {n}).", "من أهداف {T} كانت بالرأس ({g} من {n}).", "a share that high", "نسبة بهالارتفاع"),
            ("ob", "of {T}'s goals came from outside the box ({g} of {n}).", "من أهداف {T} جت من خارج منطقة الجزاء ({g} من {n}).", "a share that high", "نسبة بهالارتفاع"),
            ("lt", "of {T}'s goals came after the 75th minute ({g} of {n}).", "من أهداف {T} جت بعد الدقيقة 75 ({g} من {n}).", "a share that high", "نسبة بهالارتفاع")):
        pop = [a[key] for a in big]
        for a in big:
            v = a[key]
            if v is None or v < 0.3:
                continue
            p, k, N = _fx_rar(pop, v)
            cnt = round(v * a["g"])
            tadd(a, "s_" + key, p, k, N,
                 pct(v) + " " + en_t.format(T=_nm(a["team"]), g=_nb(cnt), n=_nb(a["g"])),
                 pct(v) + " " + ar_t.format(T=_nm(a["team"]), g=_nb(cnt), n=_nb(a["g"])),
                 f"Only {k} of {N} teams with {FX_TEAM_MIN_GOALS}+ goals in the site's leagues have {unit_en}.",
                 f"بس {_nb(k)} من {_nb(N)} فريق ({_nb(FX_TEAM_MIN_GOALS)}+ أهداف) في دوريات الموقع عندهم {unit_ar}.")
    pop_o = [a["g"] - a["xg"] for a in agg if a["n"] >= 3]
    for a in agg:
        if a["n"] < 3:
            continue
        v = a["g"] - a["xg"]
        if v >= 3 or v <= -3:
            p, k, N = _fx_rar(pop_o, v, upper=v > 0)
            word_en, word_ar = ("more", "أكثر") if v > 0 else ("fewer", "أقل")
            tadd(a, "s_over" if v > 0 else "s_under", p, k, N,
                 f"{_nm(a['team'])} have scored {_nb(a['g'])} goals from {_xgb(a['xg'])}: {_nb(_x2(abs(v)))} {word_en} than their chances suggest.",
                 f"{_nm(a['team'])} سجّل {_ar_goals(a['g'])} من {_xgb(a['xg'])}: {_nb(_x2(abs(v)))} {word_ar} مما توحي فيه فرصه.",
                 f"Only {k} of {N} teams in the site's leagues are that far from their xG.",
                 f"بس {_nb(k)} من {_nb(N)} فريق في دوريات الموقع بعيدين عن الـxG بهالفارق.")
    team_out = {}
    for (l, name) in teams:
        mine = [f for f in F if f["l"] == l and (f["team"] == name or name in (f.get("teams") or []))] + [f for f in TF if f["l"] == l and f["team"] == name]
        pick, seen_k = [], set()
        for f in sorted(mine, key=lambda f: (f["p"], f["k"])):
            if f["p"] > FX_TEAM_MAX_P or f["k"] in seen_k:
                continue
            pick.append({k: v for k, v in f.items() if k not in ("teams",)})
            seen_k.add(f["k"])
            if len(pick) >= FX_TEAM_N:
                break
        if pick:
            team_out[f"{l}|{name}"] = pick
    return dict(wk=dict(fr=fr, to=to), week=[{k: v for k, v in f.items() if k != "teams"} for f in wk], teams=team_out,
                n=dict(matches=len(M), goals=len(G)))


def _fx_from_db():
    matches = [dict(l=r["l"], m=r["m"], d=r["d"], h=r["h"], a=r["a"], s=r["s"])
               for r in q("SELECT league_id l, match_id m, date d, home h, away a, score s FROM matches WHERE score LIKE '%-%'")]
    shots = q("SELECT p.league_id l, p.match_id m, p.pd, p.pid, p.pn, p.tid, p.x, p.y, p.xg, p.ev, p.st, p.ty, p.mn, p.ma, p.og, p.ib, "
              "COALESCE(a.team, p.tid) c FROM shot_rows p "
              "LEFT JOIN team_adv a ON a.league_id=p.league_id AND a.match_id=p.match_id AND a.team_id=p.tid")
    club_of = {(r["l"], r["m"], r["i"]): r["c"] for r in q("SELECT league_id l, match_id m, player_id i, club c FROM stats WHERE player_id IS NOT NULL")}
    return matches, shots, club_of


def sync_facts(hub, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    out = fx_compute(*_fx_from_db(), now)
    body = json.dumps(out, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha1(body.encode("utf-8")).hexdigest()[:10]
    old = gh_get_json(hub, FX_PATH)
    if old and old.get("h") == h:
        LV_HAVE["fx"] = h
        return
    out["h"] = h
    out["t"] = now.strftime("%Y-%m-%d %H:%M:%S")
    gh_put(hub, FX_PATH, json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update facts")
    LV_HAVE["fx"] = h
    log(f"  [الحقائق] الأسبوع {out['wk']['fr']}..{out['wk']['to']}: {len(out['week'])} حقيقة؛ {len(out['teams'])} فريق؛ "
        f"من {out['n']['matches']} مباراة و{out['n']['goals']} هدف")


_orig_gh_put_fx = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json" and "fx" not in LV_HAVE:
        try:                       # الفهرس ينشر قبل خطوة الحقائق: نعلن عن الملف الموجود من قبل (بنسخته)
            old = gh_get_json(hub, FX_PATH)
            if old and old.get("h"):
                LV_HAVE["fx"] = old["h"]
        except Exception as e:
            log(f"  [الحقائق] تعذر قراءة الملف ({type(e).__name__}: {e})")
    return _orig_gh_put_fx(hub, path, content, message)


_orig_run_pipeline_fx = run_pipeline


def run_pipeline(hub, pit_key):
    out = _orig_run_pipeline_fx(hub, pit_key)
    try:
        sync_facts(hub)
    except Exception as e:      # اختيارية: ما توقف المزامنة
        log(f"  [الحقائق] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return out
# ======================== نهاية إضافة الحقائق ========================
