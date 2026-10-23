
# ============================================================================
# إضافة: حالات نادرة جدًا جدًا → data/rare.json (من بيانات PitchAPI المخزنة، بدون أي طلب جديد لـ PitchAPI)
# لكل نوع حدث (عودة من تأخر كبير، هدف من فرصة شبه معدومة، لاعب بعدد افتكاكات قياسي، ...) نحسب لكل مباراة أبعد قيمة فيها،
# وبعدين k = كم مباراة في الموسم (كل دوريات الموقع ما عدا كأس العالم) وصلت لنفس القيمة أو أبعد منها، من N مباراة.
# الحالة "نادرة جدًا جدًا" لو k/N ≤ 1/RR_EVERY: يعني ما تصير أكثر من مرة كل 380 مباراة (موسم دوري من 20 فريق).
# و"قريبة من النادرة" لو k/N ≤ 1/RR_NEAR. ما فيه تقدير ولا تخمين: كل رقم من التسديدات والنتائج وأرقام اللاعبين والتقييمات كما هي.
# ============================================================================
RR_PATH = "data/rare.json"
RR_EVERY = 380            # نادرة جدًا جدًا: مرة كل 380 مباراة أو أندر
RR_NEAR = 150             # قريبة: مرة كل 150 مباراة أو أندر
RR_MAX = 12               # أقصى عدد حالات لكل دوري
RR_NEAR_N = 3             # كم حالة "قريبة" نعرض لو الحالات النادرة أقل من 3
RR_SKIP = ("world cup",)  # بطولات خارج الحساب

# أرقام اللاعبين في المباراة: [المفتاح، أقل قيمة نبدأ نشوفها، الجملة بالإنجليزي، بالعربي]
RR_PL = [
    ("ast", 3, "{p} made {v} assists for {T} against {O}.", "{p} صنع {n} لـ{T} ضد {O}.", ("تمريرة حاسمة", "تمريرتين حاسمتين", "تمريرات حاسمة", "تمريرة حاسمة")),
    ("kp", 7, "{p} made {v} key passes for {T} against {O}.", "{p} مرّر {n} لـ{T} ضد {O}.", ("تمريرة مفتاحية", "تمريرتين مفتاحيتين", "تمريرات مفتاحية", "تمريرة مفتاحية")),
    ("sca", 12, "{p} made {v} shot-creating actions for {T} against {O}.", "{p} صنع {n} انتهت بتسديدة لـ{T} ضد {O}.", ("لعبة", "لعبتين", "لعبات", "لعبة")),
    ("pr", 13, "{p} made {v} progressive passes for {T} against {O}.", "{p} لعب {n} لـ{T} ضد {O}.", ("تمريرة تقدمية", "تمريرتين تقدميتين", "تمريرات تقدمية", "تمريرة تقدمية")),
    ("ps", 120, "{p} made {v} passes for {T} against {O}.", "{p} لعب {n} لـ{T} ضد {O}.", ("تمريرة", "تمريرتين", "تمريرات", "تمريرة")),
    ("tkw", 6, "{p} won {v} take-ons for {T} against {O}.", "{p} نجح في {n} لـ{T} ضد {O}.", ("مراوغة", "مراوغتين", "مراوغات", "مراوغة")),
    ("tk", 8, "{p} made {v} tackles for {T} against {O}.", "{p} قام بـ{n} لـ{T} ضد {O}.", ("افتكاك", "افتكاكين", "افتكاكات", "افتكاك")),
    ("ic", 7, "{p} made {v} interceptions for {T} against {O}.", "{p} قطع {n} لـ{T} ضد {O}.", ("كرة", "كرتين", "كرات", "كرة")),
    ("bl", 5, "{p} blocked {v} shots or passes for {T} against {O}.", "{p} صدّ {n} (تسديدات أو تمريرات) لـ{T} ضد {O}.", ("كرة", "كرتين", "كرات", "كرة")),
    ("cl", 15, "{p} made {v} clearances for {T} against {O}.", "{p} شتّت {n} لـ{T} ضد {O}.", ("كرة", "كرتين", "كرات", "كرة")),
    ("aerw", 10, "{p} won {v} aerial duels for {T} against {O}.", "{p} كسب {n} لـ{T} ضد {O}.", ("كرة هوائية", "كرتين هوائيتين", "كرات هوائية", "كرة هوائية")),
]


def _rr_min(r):
    """الدقيقة على الساعة: 45+2 → 47 (تقريبي للترتيب والفوارق فقط)."""
    return float(r["mn"]) + float(r.get("ma") or 0)


def rr_compute(matches, shots, club_of, plrows, ratings, rnames, names, now):
    """matches/shots/club_of بنفس شكل الحقائق؛ plrows: صفوف أرقام اللاعبين في كل مباراة؛ ratings: {(l, m, pid): تقييم};
    rnames: {(l, m, pid): (اسم، نادي)}؛ names: {league_id: اسم البطولة}."""
    skip = {l for l, n in names.items() if any(s in str(n).lower() for s in RR_SKIP)}
    matches = [m for m in matches if m["l"] not in skip]
    shots = [r for r in shots if r["l"] not in skip]
    fin = {(m["l"], m["m"]): m for m in matches if _fx_score(m.get("s"))}
    M = _fx_matches(matches, shots, club_of)
    cand = []      # (family, pool, match key, value, upper, info)

    def put(fam, pool, mt, v, upper, info):
        cand.append(dict(f=fam, pool=pool, l=mt["l"], m=mt["m"], d=str(mt.get("d") or "")[:10], v=v, up=upper, **info))
    for mt in M:
        H, A = mt["h"], mt["a"]
        best = {}

        def keep(fam, v, upper, info):
            b = best.get(fam)
            if b is None or (v > b[0] if upper else v < b[0]):
                best[fam] = (v, upper, info)
        goals = [r for r in mt["sh"] if r["goal"]]
        for s in ("h", "a"):
            o = "a" if s == "h" else "h"
            T, O = mt[s], mt[o]
            mine = [r for r in mt["sh"] if r["own"] == s and not r["og"]]
            g, gc = mt["sc"][0 if s == "h" else 1], mt["sc"][1 if s == "h" else 0]
            xg = sum(r["xg"] for r in mine)
            xga = sum(r["xg"] for r in mt["sh"] if r["own"] == o and not r["og"])
            sc = _nb(f"{g}–{gc}")
            # the score as it went: the biggest deficit this side came back from
            a_, b_, worst = 0, 0, 0
            for r in goals:
                a_ += r["side"] == s
                b_ += r["side"] == o
                worst = max(worst, b_ - a_)
            if g > gc:
                keep("comeback", worst, True, dict(team=T, en=f"{_nm(T)} came from {_nb(worst)} goals down to beat {_nm(O)} {sc}.",
                                                   ar=f"{_nm(T)} كان متأخر بـ{_ar_goals(worst)} وفاز على {_nm(O)} {sc}."))
                keep("win_out", round(xga - xg, 4), True, dict(team=T, en=f"{_nm(T)} beat {_nm(O)} {sc} with {_xgb(xg)} against {_nb(_x2(xga))}.",
                                                              ar=f"{_nm(T)} فاز على {_nm(O)} {sc} وهو صاحب {_xgb(xg)} مقابل {_nb(_x2(xga))}."))
                keep("few_shots", len(mine), False, dict(team=T, en=f"{_nm(T)} beat {_nm(O)} {sc} with {_nb(len(mine))} shot{'s' if len(mine) != 1 else ''}.",
                                                         ar=f"{_nm(T)} فاز على {_nm(O)} {sc} بـ{_ar_n(len(mine), 'تسديدة', 'تسديدتين', 'تسديدات', 'تسديدة')} بس."))
            if g == 0:
                keep("dry_x", round(xg, 4), True, dict(team=T, en=f"{_nm(T)} created {_xgb(xg)} against {_nm(O)} and did not score.",
                                                       ar=f"{_nm(T)} صنع {_xgb(xg)} ضد {_nm(O)} وما سجّل."))
                keep("dry_n", len(mine), True, dict(team=T, en=f"{_nm(T)} took {_nb(len(mine))} shots against {_nm(O)} and did not score.",
                                                    ar=f"{_nm(T)} سدّد {_ar_n(len(mine), 'تسديدة', 'تسديدتين', 'تسديدات', 'تسديدة')} ضد {_nm(O)} وما سجّل."))
            keep("clinical", round(g - xg, 4), True, dict(team=T, en=f"{_nm(T)} scored {_nb(g)} against {_nm(O)} from {_xgb(xg)}.",
                                                          ar=f"{_nm(T)} سجّل {_ar_goals(g)} ضد {_nm(O)} من {_xgb(xg)}."))
            hd = sum(1 for r in goals if r["side"] == s and not r["og"] and r.get("ty") == "Header")
            keep("heads", hd, True, dict(team=T, en=f"{_nm(T)} scored {_nb(hd)} headers against {_nm(O)}.", ar=f"{_nm(T)} سجّل {_ar_goals(hd)} بالرأس ضد {_nm(O)}."))
            pm = sum(1 for r in mine if r.get("st") == "Penalty" and r.get("ev") != "Goal")
            keep("pens", pm, True, dict(team=T, en=f"{_nm(T)} missed {_nb(pm)} penalties against {_nm(O)}.", ar=f"{_nm(T)} أضاع {_ar_pens(pm)} ضد {_nm(O)}."))
            # three goals in the shortest time
            tg = [_rr_min(r) for r in goals if r["side"] == s]
            for i in range(len(tg) - 2):
                span = round(tg[i + 2] - tg[i], 1)
                mins_en = f"{_nb(int(span))} minute{'s' if int(span) != 1 else ''}" if span >= 1 else "less than a minute"
                mins_ar = _ar_n(int(span), "دقيقة", "دقيقتين", "دقائق", "دقيقة") if span >= 1 else "أقل من دقيقة"
                keep("quick3", span, False, dict(team=T, en=f"{_nm(T)} scored 3 goals against {_nm(O)} in {mins_en}.",
                                                 ar=f"{_nm(T)} سجّل 3 أهداف ضد {_nm(O)} في {mins_ar}."))
        both = f"{_nm(H)} {_nb(str(mt['sc'][0]) + '–' + str(mt['sc'][1]))} {_nm(A)}"
        both_ar = f"{_nm(H)} {_nb(mt['sc'][0])} و{_nm(A)} {_nb(mt['sc'][1])}"
        tot = sum(mt["sc"])
        mxg = sum(r["xg"] for r in mt["sh"] if not r["og"])
        keep("goals", tot, True, dict(team=None, en=f"{both}: {_nb(tot)} goals in one match.", ar=f"مباراة {both_ar}: {_ar_goals(tot)} في مباراة وحدة."))
        keep("fest", round(tot - mxg, 4), True, dict(team=None, en=f"{both}: {_nb(tot)} goals from a combined xG of {_nb(_x2(mxg))}.",
                                                    ar=f"مباراة {both_ar}: {_ar_goals(tot)} من xG مجموعه {_nb(_x2(mxg))}."))
        og = sum(1 for r in mt["sh"] if r["og"])
        keep("ogs", og, True, dict(team=None, en=f"{both} had {_nb(og)} own goals.", ar=f"مباراة {both_ar} فيها {_ar_n(og, 'هدف عكسي', 'هدفين عكسيين', 'أهداف عكسية', 'هدف عكسي')}."))
        st = sum(1 for r in goals if r["ma"] > 0)
        keep("stop", st, True, dict(team=None, en=f"{both} had {_nb(st)} goals in added time.", ar=f"مباراة {both_ar} فيها {_ar_goals(st)} في الوقت بدل الضائع."))
        for r in goals:
            if r["og"]:
                continue
            T, O = mt[r["own"]], mt["a" if r["own"] == "h" else "h"]
            who = _nm(r.get("pn"))
            if r.get("st") != "Penalty":
                keep("tiny", round(r["xg"], 4), False, dict(team=T, en=f"{who} scored for {_nm(T)} against {_nm(O)} ({_nb(_fx_clock(r))}) from a chance worth {_xgb(r['xg'])}.",
                                                            ar=f"{who} سجّل لـ{_nm(T)} ضد {_nm(O)} (الدقيقة {_nb(_fx_clock(r).rstrip(chr(39)))}) من فرصة قيمتها {_xgb(r['xg'])}."))
                dist = _fx_dist(r)
                if dist is not None and r["xg"] <= 0.1:
                    keep("far", round(dist, 2), True, dict(team=T, en=f"{who} scored for {_nm(T)} against {_nm(O)} from about {_nb(round(dist))} metres.",
                                                           ar=f"{who} سجّل لـ{_nm(T)} ضد {_nm(O)} من حوالي {_nb(round(dist))} متر."))
            if r.get("pd") == "SecondHalf" and r["mn"] >= 90:
                keep("late", r["ma"], True, dict(team=T, en=f"{who} scored for {_nm(T)} against {_nm(O)} in the {_nb(_fx_clock(r))} minute.",
                                                 ar=f"{who} سجّل لـ{_nm(T)} ضد {_nm(O)} في الدقيقة {_nb(_fx_clock(r).rstrip(chr(39)))}."))
            if r.get("pd") == "FirstHalf" and not r["ma"]:
                keep("early", r["mn"], False, dict(team=T, en=f"{who} scored for {_nm(T)} against {_nm(O)} in minute {_nb(int(r['mn']))}.",
                                                   ar=f"{who} سجّل لـ{_nm(T)} ضد {_nm(O)} في الدقيقة {_nb(int(r['mn']))}."))
        pl = {}
        for r in mt["sh"]:
            if r["og"] or not r.get("pid"):
                continue
            p = pl.setdefault(r["pid"], dict(pn=r.get("pn"), own=r["own"], g=0, xg=0.0))
            p["g"] += 1 if r["goal"] else 0
            p["xg"] += r["xg"]
        for p in pl.values():
            T, O = mt[p["own"]], mt["a" if p["own"] == "h" else "h"]
            keep("haul", p["g"], True, dict(team=T, en=f"{_nm(p['pn'])} scored {_nb(p['g'])} goals for {_nm(T)} against {_nm(O)}.",
                                            ar=f"{_nm(p['pn'])} سجّل {_ar_goals(p['g'])} لـ{_nm(T)} ضد {_nm(O)}."))
            if p["g"] >= 3:
                keep("hat_little", round(p["xg"], 4), False, dict(team=T, en=f"{_nm(p['pn'])} scored {_nb(p['g'])} for {_nm(T)} against {_nm(O)} from {_xgb(p['xg'])}.",
                                                                  ar=f"{_nm(p['pn'])} سجّل {_ar_goals(p['g'])} لـ{_nm(T)} ضد {_nm(O)} من {_xgb(p['xg'])}."))
        for fam, (v, up, info) in best.items():
            put(fam, "sh", mt, v, up, info)
    # player numbers in a match (per-match player file) and ratings
    by_pl = {}
    for r in plrows:
        if r["l"] in skip or (r["l"], r["m"]) not in fin:
            continue
        by_pl.setdefault((r["l"], r["m"]), []).append(r)
    for key, rows in by_pl.items():
        mt = fin[key]
        for f, lo, en, ar, forms in RR_PL:
            top = None
            for r in rows:
                v = r.get(f)
                if v is not None and (top is None or v > top[0]):
                    top = (v, r)
            if top is None:
                continue
            v, r = top
            T = r.get("c") or club_of.get((r["l"], r["m"], r.get("i")))
            O = mt["a"] if T == mt["h"] else mt["h"] if T == mt["a"] else None
            if not T or not O:
                continue
            vv = int(v) if float(v).is_integer() else round(v, 1)
            put("pl_" + f, "pl", mt, v, True, dict(team=T, en=en.format(p=_nm(r.get("n")), v=_nb(vv), T=_nm(T), O=_nm(O)),
                                                   ar=ar.format(p=_nm(r.get("n")), n=_ar_n(vv, *forms), T=_nm(T), O=_nm(O))))
        # shots by one player without a goal
        dr = [r for r in rows if r.get("sh") and not r.get("gl")]
        if dr:
            r = max(dr, key=lambda x: x["sh"])
            T = r.get("c") or club_of.get((r["l"], r["m"], r.get("i")))
            O = mt["a"] if T == mt["h"] else mt["h"] if T == mt["a"] else None
            if T and O:
                put("pl_shdry", "pl", mt, r["sh"], True, dict(team=T, en=f"{_nm(r.get('n'))} took {_nb(int(r['sh']))} shots for {_nm(T)} against {_nm(O)} and did not score.",
                                                              ar=f"{_nm(r.get('n'))} سدّد {_ar_n(int(r['sh']), 'تسديدة', 'تسديدتين', 'تسديدات', 'تسديدة')} لـ{_nm(T)} ضد {_nm(O)} وما سجّل."))
    by_rt = {}
    for (l, m, pid), v in ratings.items():
        if l in skip or (l, m) not in fin or not isinstance(v, (int, float)):
            continue
        b = by_rt.get((l, m))
        if b is None or v > b[0]:
            by_rt[(l, m)] = (v, pid)
    for key, (v, pid) in by_rt.items():
        mt = fin[key]
        nm_, T = rnames.get((key[0], key[1], pid), (None, None))
        if not nm_:
            continue
        O = mt["a"] if T == mt["h"] else mt["h"] if T == mt["a"] else None
        put("rating", "rt", mt, v, True, dict(team=T, en=f"{_nm(nm_)} was rated {_nb(f'{v:.1f}')}" + (f" for {_nm(T)} against {_nm(O)}." if O else "."),
                                              ar=f"{_nm(nm_)} أخذ تقييم {_nb(f'{v:.1f}')}" + (f" مع {_nm(T)} ضد {_nm(O)}." if O else ".")))
    # rarity: in how many matches of the same pool the same thing or more happened
    pools = {"sh": len(M), "pl": len(by_pl), "rt": len(by_rt)}
    fams = {}
    for c in cand:
        fams.setdefault(c["f"], []).append(c)
    out_cases = []
    for f, L in fams.items():
        N = pools[L[0]["pool"]]
        if not N:
            continue
        vals = [c["v"] for c in L]
        for c in L:
            if c["up"]:
                k = sum(1 for x in vals if x >= c["v"] - 1e-9)
            else:
                k = sum(1 for x in vals if x <= c["v"] + 1e-9)
            # a family's floor: no case is shown for a value that is not unusual in itself (e.g. 0 own goals)
            if not _rr_floor(f, c["v"]):
                continue
            if k / N <= 1 / RR_NEAR:
                out_cases.append(dict(k=f, l=c["l"], m=c["m"], d=c["d"], team=c["team"], n=k, N=N, p=round(k / N, 6), v=c["v"], en=c["en"], ar=c["ar"],
                                      tier="rare" if k / N <= 1 / RR_EVERY else "near"))
    leagues = {}
    for l in sorted({c["l"] for c in out_cases}):
        L = sorted((c for c in out_cases if c["l"] == l), key=lambda c: (c["p"], c["k"], c["m"]))
        rare = [c for c in L if c["tier"] == "rare"][:RR_MAX]
        near = [c for c in L if c["tier"] == "near"][:RR_NEAR_N] if len(rare) < 3 else []
        leagues[l] = dict(rare=rare, near=near)
    return dict(every=RR_EVERY, near=RR_NEAR, pools=pools, leagues=leagues)


RR_FLOOR = {"comeback": (2, True), "win_out": (1.0, True), "few_shots": (3, False), "dry_x": (1.5, True), "dry_n": (12, True),
            "clinical": (2.0, True), "heads": (2, True), "pens": (2, True), "quick3": (10, False), "goals": (6, True), "fest": (2.5, True),
            "ogs": (2, True), "stop": (2, True), "tiny": (0.03, False), "far": (25, True), "late": (5, True), "early": (2, False),
            "haul": (3, True), "hat_little": (1.5, False), "rating": (9.0, True), "pl_shdry": (6, True)}


def _rr_floor(f, v):
    if f.startswith("pl_") and f[3:] in {x[0] for x in RR_PL}:
        lo = next(x[1] for x in RR_PL if x[0] == f[3:])
        return v >= lo
    lo, up = RR_FLOOR.get(f, (None, True))
    if lo is None:
        return False
    return v >= lo if up else v <= lo


def _rr_from_db(hub):
    matches, shots, club_of = _fx_from_db()
    plrows = q("SELECT a.league_id l, a.match_id m, a.player_id i, a.player n, a.team_id t, a.ast, a.kp, a.sca, a.pr, a.ps, a.tkw, a.tk, a.ic, a.bl, a.cl, a.aerw, a.sh, a.gl "
               "FROM pl_adv a")
    for r in plrows:
        r["c"] = club_of.get((r["l"], r["m"], r["i"]))
    idx = gh_get_json(hub, "data/index.json") or {}
    names = {lg["id"]: lg.get("name", "") for lg in idx.get("leagues", [])}
    ratings, rnames = {}, {}
    who = {(r["l"], r["m"], r["i"]): (r["n"], r["c"]) for r in plrows}
    for r in q("SELECT league_id l, match_id m, player_id i, player n, club c FROM stats WHERE player_id IS NOT NULL"):
        who.setdefault((r["l"], r["m"], r["i"]), (r["n"], r["c"]))
    for lg in idx.get("leagues", []):
        if not lg.get("rt_file"):
            continue
        rt = gh_get_json(hub, "data/" + lg["rt_file"]) or {}
        for m, d in (rt.get("m") or {}).items():
            for pid, v in (d or {}).items():
                ratings[(lg["id"], m, pid)] = v
                if (lg["id"], m, pid) in who:
                    rnames[(lg["id"], m, pid)] = who[(lg["id"], m, pid)]
    return matches, shots, club_of, plrows, ratings, rnames, names


def sync_rare(hub, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    out = rr_compute(*_rr_from_db(hub), now)
    body = json.dumps(out, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    h = hashlib.sha1(body.encode("utf-8")).hexdigest()[:10]
    old = gh_get_json(hub, RR_PATH)
    if old and old.get("h") == h:
        LV_HAVE["rr"] = h
        return
    out["h"] = h
    out["t"] = now.strftime("%Y-%m-%d %H:%M:%S")
    gh_put(hub, RR_PATH, json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update rare cases")
    LV_HAVE["rr"] = h
    log(f"  [الحالات النادرة] {sum(len(v['rare']) for v in out['leagues'].values())} حالة نادرة جدًا في {len(out['leagues'])} بطولة "
        f"(مباريات: {out['pools']})")


_orig_gh_put_rr = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json" and "rr" not in LV_HAVE:
        try:                       # الفهرس ينشر قبل خطوة الحالات النادرة: نعلن عن الملف الموجود من قبل (بنسخته)
            old = gh_get_json(hub, RR_PATH)
            if old and old.get("h"):
                LV_HAVE["rr"] = old["h"]
        except Exception as e:
            log(f"  [الحالات النادرة] تعذر قراءة الملف ({type(e).__name__}: {e})")
    return _orig_gh_put_rr(hub, path, content, message)


_orig_run_pipeline_rr = run_pipeline


def run_pipeline(hub, pit_key):
    out = _orig_run_pipeline_rr(hub, pit_key)
    try:
        sync_rare(hub)
    except Exception as e:      # اختيارية: ما توقف المزامنة
        log(f"  [الحالات النادرة] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return out
# ======================== نهاية إضافة الحالات النادرة ========================
