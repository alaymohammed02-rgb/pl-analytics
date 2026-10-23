


# ============================================================================
# إضافة: جودة البيانات — مراكز اللاعبين، وإعادة جلب المباريات اللي ناقصها xAG.
# المراكز: PitchAPI يعطي رقم مركز (position_id) لكل لاعب بدون شرح للأرقام. المزامنة تتعلّم معنى كل رقم من البيانات نفسها:
#   مراكز لاعبي الدوري الإنجليزي الرسمية في الفانتازي (حارس/مدافع/وسط/مهاجم) + الحراس المعروفين من "xG المواجَهة".
#   أي رقم ما له أدلة كافية يبقى بدون مركز (ما نخمّن). الجدول المتعلَّم ينحفظ في data/positions_map.json ويظهر في السجل.
# xAG: بعض المباريات انحفظت "مكتملة" وفيها xAG / xG chain / xG buildup فاضية لكل اللاعبين (PitchAPI يضيفها متأخر غالباً).
#   كل مزامنة نرجع لعدد محدود منها (مرة في اليوم لكل مباراة، خلال أول DQ_XAG_DAYS يوم بعد المباراة). أول تجربة بيّنت إن PitchAPI
#   ما عنده هذي الأرقام لهذي المباريات أصلاً (0 من 28)، فالصفحات تحسب لكل 90 من الدقائق اللي لها قيمة فقط.
# ============================================================================
import unicodedata

DQ_POS_MIN_N = 4                  # أقل عدد أدلة لرقم مركز
DQ_POS_MIN_SHARE = 0.6            # وأقل نسبة للمركز الغالب
DQ_XAG_PER_RUN = 4                # كم مباراة ناقصة نعيد جلبها لكل دوري في المزامنة الوحدة
DQ_XAG_RETRY_H = 24
DQ_XAG_DAYS = 14                  # أول تجربة (21 أكتوبر 2026): 0 من 28 مباراة رجع فيها xAG، فالمصدر ما يضيفه متأخر؛ نجرب فقط المباريات الحديثة
DQ_FPL_POS = {1: "GK", 2: "DF", 3: "MF", 4: "FW"}
DQ = dict(hub=None, map=None, q={}, done=set())


def _dq_norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z ]+", " ", s).split())


def dq_learn_positions(pos_ids, names, fpl, gk_ids):
    """pos_ids: {player_id: position_id}  names: {player_id: name}  fpl: data/fpl.json  gk_ids: لاعبين لهم xG مواجَهة.
    يرجّع (الجدول {position_id: "GK"/"DF"/"MF"/"FW"}, الأدلة)."""
    keys = {}
    if fpl and fpl.get("cols"):
        ix = {c: i for i, c in enumerate(fpl["cols"])}
        for r in fpl.get("rows", []):
            ty = DQ_FPL_POS.get(r[ix["ty"]])
            if not ty:
                continue
            for k in {_dq_norm(f"{r[ix['fn']]} {r[ix['sn']]}"), _dq_norm(r[ix["wn"]])}:
                if k:
                    keys.setdefault(k, set()).add(ty)
    uniq = {k: next(iter(v)) for k, v in keys.items() if len(v) == 1}
    ev = {}
    for p, pos in pos_ids.items():
        if pos is None:
            continue
        g = uniq.get(_dq_norm(names.get(p)))
        if p in gk_ids:
            g = "GK"
        if g:
            e = ev.setdefault(str(pos), {})
            e[g] = e.get(g, 0) + 1
    m = {}
    for pos, e in ev.items():
        n = sum(e.values())
        g, c = max(e.items(), key=lambda x: x[1])
        if n >= DQ_POS_MIN_N and c / n >= DQ_POS_MIN_SHARE:
            m[pos] = g
    return m, ev


def _dq_qfile(L):
    if L not in DQ["q"]:
        d = gh_get_json(DQ["hub"], f"data/photos_{safe_name(L)}.json") if DQ["hub"] is not None else None
        DQ["q"][L] = dict((d or {}).get("q") or {})
    return DQ["q"][L]


def dq_apply_positions(L):
    """يكتب المركز في جدول stats للاعبين اللي مركزهم فاضي (مرة لكل دوري في المزامنة)."""
    if L in DQ["done"] or not DQ["map"]:
        return 0
    DQ["done"].add(L)
    Q = _dq_qfile(L)
    rows = [(DQ["map"].get(str(pos)), L, p) for p, pos in Q.items() if DQ["map"].get(str(pos))]
    if not rows:
        return 0
    c = db()
    c.executemany("UPDATE stats SET pos=? WHERE league_id=? AND player_id=? AND (pos IS NULL OR pos='')", rows)
    n = c.total_changes
    c.commit()
    c.close()
    return n


_orig_build_league_payload_dq = build_league_payload


def build_league_payload(lg):
    try:
        dq_apply_positions(lg["id"])
    except Exception as e:
        log(f"  [المراكز] تعذر تطبيقها ({type(e).__name__}: {e})")
    return _orig_build_league_payload_dq(lg)


_orig_build_pl_payload_dq = build_pl_payload


def build_pl_payload(L):
    try:
        dq_apply_positions(L)
    except Exception as e:
        log(f"  [المراكز] تعذر تطبيقها ({type(e).__name__}: {e})")
    return _orig_build_pl_payload_dq(L)


def dq_xag_todo(L, t_now=None):
    """مباريات انحفظت مكتملة لكن xAG فاضي لكل لاعبيها: نعيدها مرة في اليوم، أول DQ_XAG_DAYS يوم."""
    t_now = t_now or datetime.datetime.now(datetime.timezone.utc)
    rows = q("SELECT m.match_id i, m.date d, e.fetched_at f FROM matches m JOIN pm e ON e.league_id=m.league_id AND e.match_id=m.match_id "
             "WHERE m.league_id=? AND e.status='ok' AND EXISTS(SELECT 1 FROM pl_adv p WHERE p.league_id=m.league_id AND p.match_id=m.match_id) "
             "AND NOT EXISTS(SELECT 1 FROM pl_adv p WHERE p.league_id=m.league_id AND p.match_id=m.match_id AND p.xag IS NOT NULL) "
             "ORDER BY m.date DESC", (L,))
    out = []
    for r in rows:
        played, last = _parse_ts(str(r["d"] or "")[:10] + " 00:00:00"), _parse_ts(r["f"])   # التاريخ محفوظ بدون وقت
        if played is None or (t_now - played).days > DQ_XAG_DAYS:
            continue
        if last is not None and (t_now - last).total_seconds() < DQ_XAG_RETRY_H * 3600:
            continue
        out.append(r["i"])
    return out, len(rows)


_orig_sync_pstats_dq = sync_pstats


def sync_pstats(client, league_id, on_progress=None):
    todo = []
    try:
        todo, total = dq_xag_todo(league_id)
        todo = todo[:DQ_XAG_PER_RUN]
        if total:
            log(f"  [xAG] مباريات ناقصها xAG: {total} | نعيد جلب {len(todo)} الحين")
        if todo:
            c = db()
            c.executemany("UPDATE pm SET status='pending' WHERE league_id=? AND match_id=?", [(league_id, m) for m in todo])
            c.commit()
            c.close()
    except Exception as e:
        log(f"  [xAG] تعذر تحديد المباريات ({type(e).__name__}: {e})")
    out = _orig_sync_pstats_dq(client, league_id, on_progress)
    if todo:
        got = q("SELECT COUNT(DISTINCT match_id) n FROM pl_adv WHERE league_id=? AND xag IS NOT NULL AND match_id IN (%s)"
                % ",".join("?" * len(todo)), (league_id, *todo))[0]["n"]
        log(f"  [xAG] بعد إعادة الجلب: {got} من {len(todo)} صار فيها xAG")
    return out


_orig_run_pipeline_dq = run_pipeline


def run_pipeline(hub, pit_key):
    DQ.update(hub=hub, q={}, done=set())
    try:
        DQ["map"] = ((gh_get_json(hub, "data/positions_map.json") or {}).get("map")) or None
    except Exception:
        DQ["map"] = None
    out = _orig_run_pipeline_dq(hub, pit_key)
    try:
        lids = list((globals().get("_LOGO_REFS") or {}).keys())
        DQ["q"].update(globals().get("PHOTO_POS_IDS") or {})
        pos_ids = {}
        for L in lids:
            pos_ids.update(_dq_qfile(L))
        names = {r["i"]: r["n"] for r in q("SELECT player_id i, MAX(player) n FROM pl_adv WHERE player_id IS NOT NULL GROUP BY player_id")}
        gk = {r["i"] for r in q("SELECT DISTINCT player_id i FROM stats WHERE xg_faced IS NOT NULL AND player_id IS NOT NULL")}
        m, ev = dq_learn_positions(pos_ids, names, gh_get_json(hub, "data/fpl.json"), gk)
        if m:
            log("  [المراكز] الجدول المتعلَّم: " + ", ".join(f"{k}→{v} ({ev[k]})" for k, v in sorted(m.items(), key=lambda x: int(x[0]))))
            skipped = {k: v for k, v in ev.items() if k not in m}
            if skipped:
                log("  [المراكز] أرقام بدون أدلة كافية (تبقى بدون مركز): " + ", ".join(f"{k} {v}" for k, v in skipped.items()))
            old = gh_get_json(hub, "data/positions_map.json") or {}
            if old.get("map") != m:
                gh_put(hub, "data/positions_map.json", json.dumps(dict(map=m, evidence=ev, at=now()), ensure_ascii=False, indent=1).encode("utf-8"),
                       "Update learned position map")
        else:
            log(f"  [المراكز] ما فيه أدلة كافية بعد ({len(pos_ids)} لاعب برقم مركز)")
    except Exception as e:      # المراكز اختيارية: ما توقف المزامنة
        log(f"  [المراكز] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return out
# ======================== نهاية إضافة جودة البيانات ========================
