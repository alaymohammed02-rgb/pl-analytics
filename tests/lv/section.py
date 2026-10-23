


# ============================================================================
# إضافة: التشكيلات الرسمية، حالة المباريات أثناء اللعب، وإحصائيات الشوطين (كلها من PitchAPI)
# أول خطوة في كل مزامنة (قبل الجلب الثقيل، عشان تنزل بسرعة):
#   - لكل مباراة من data/fixtures.json موعدها خلال LV_BEFORE_MIN دقيقة الجاية (أو بدأت قبل أقل من LV_AFTER_MIN دقيقة):
#     matches.lineups — تنحفظ فقط إذا الفريقين "confirmed" (التشكيلة الرسمية)؛ المتوقعة ما تنعرض أبد.
#   - طلب واحد date.get(اليوم, status="all") لكل المباريات: الحالة والنتيجة كما يعطيها PitchAPI، و matches.events للمباريات اللي
#     بدأت وما خلصت (الأهداف والبطاقات والتبديلات بالدقيقة).
#   النتيجة في data/live.json. هذا مو بث مباشر: يتحدث مع كل مزامنة (كل 5-15 دقيقة تقريباً)، والصفحة تكتب وقت آخر تحديث.
#   السجل يكتب كل قيم "status" اللي شافها، عشان نعرف معانيها من البيانات نفسها.
# بعد المزامنة: matches.h2h للمباريات القادمة (مرة لكل مباراة) → data/h2h.json، و matches.players_halves لعدد محدود من المباريات المنتهية → data/<league>_hv.json (أرقام كل لاعب في كل شوط،
#   مجموعة صغيرة من المقاييس تنختار من أسماء مفاتيح PitchAPI، والسجل يكتب كل المفاتيح المتاحة مرة في كل مزامنة).
# ============================================================================
import copy

LV_PATH = "data/live.json"
LV_BEFORE_MIN = 90        # التشكيلة الرسمية تنزل عادة قبل المباراة بساعة تقريباً
LV_AFTER_MIN = 150        # مباراة بدأت: نتابع حالتها لين تخلص (بحد أقصى ساعتين ونص)
LV_KEEP_H = 8             # المباراة تبقى في الملف 8 ساعات بعد موعدها
HV_PER_RUN = 60           # كم مباراة نطلب لها إحصائيات الشوطين في المزامنة الوحدة (طلب واحد لكل مباراة)
HV_TRIES = 3
HV_WANT = (("tc", r"touch"), ("xg", r"^expectedgoals$|^xg$"), ("sh", r"^totalshots$|^shots$|^shotstotal$"),
           ("pa", r"^accuratepasses$|^successfulpasses$|^passesaccurate$"), ("dw", r"^duelswon$|^duelwon$"),
           ("rc", r"recover"), ("dr", r"^successfuldribbles$|^dribblessuccessful$|^dribblessucceeded$|^takeonswon$"), ("km", r"distance|sprint"),
           ("mi", r"^minutesplayed$"))
LV_INDEX = {}
_LV_DONE = []
LV_HAVE = {}              # الملفات المشتركة الموجودة (live / h2h): الفهرس يقول للصفحة إنها موجودة، فما تطلب ملف غير موجود


def _lv_kick(f):
    return _parse_ts(str(f.get("k") or "").replace("Z", ""))


def lv_window(fix, t_now):
    """المباريات القريبة من الملف: [(الدوري, المباراة, دقائق لموعدها)]."""
    out = []
    for lid, rows in ((fix or {}).get("leagues") or {}).items():
        for f in rows or []:
            k = _lv_kick(f)
            if k is None:
                continue
            mins = (k - t_now).total_seconds() / 60
            if -LV_AFTER_MIN <= mins <= LV_BEFORE_MIN:
                out.append((lid, f, mins))
    return out


def _lv_ev(e, home_id):
    side = "h" if getattr(e, "team_id", None) == home_id else "a" if getattr(e, "team_id", None) else ""
    pl = getattr(e, "player", None)
    sub = getattr(e, "sub_in_player", None)
    return [getattr(e, "minute", None), getattr(e, "minute_added", 0) or 0, str(getattr(e, "event_type", "") or ""), side,
            getattr(pl, "name", "") if pl else "", getattr(sub, "name", "") if sub else "",
            getattr(e, "score_home", None), getattr(e, "score_away", None), 1 if getattr(e, "is_own_goal", False) else 0,
            1 if getattr(e, "is_penalty", False) else 0]


def sync_live(client, hub, lids, t_now=None):
    t_now = t_now or datetime.datetime.now(datetime.timezone.utc)
    fix = gh_get_json(hub, FIX_PATH) or {}
    old = gh_get_json(hub, LV_PATH)
    if old is not None:
        LV_HAVE["live"] = 1
    if "h2h" not in LV_HAVE and gh_get_json(hub, H2H_PATH) is not None:   # الفهرس ينشر قبل خطوة H2H: نعرف من الحين إن الملف موجود
        LV_HAVE["h2h"] = 1
    old = old or {}
    before = json.dumps(old.get("m") or {}, sort_keys=True)       # للمقارنة: M تعدّل نفس القواميس
    M = {k: v for k, v in copy.deepcopy(old.get("m") or {}).items()
         if _lv_kick(v) is not None and (t_now - _lv_kick(v)).total_seconds() < LV_KEEP_H * 3600}
    win = [w for w in lv_window(fix, t_now) if not lids or w[0] in lids]
    if not win and len(M) == len(old.get("m") or {}):
        return
    # الحالة والنتيجة: طلب واحد لكل يوم فيه مباراة قريبة (بتوقيت UTC)
    days = sorted({_lv_kick(f).strftime("%Y-%m-%d") for _, f, _ in win})
    rows, seen = {}, {}
    for d in days:
        res, err = call(lambda d=d: client.date.get(d, status="all"))
        time.sleep(REQUEST_DELAY)
        if res is None:
            log(f"  [Live] {d}: تعذر ({err})")
            continue
        for s in getattr(res, "matches", None) or []:
            rows[str(s.id)] = s
    lu_n = ev_n = 0
    for lid, f, mins in win:
        mid = str(f.get("i"))
        e = M.setdefault(mid, dict(l=lid, k=f.get("k"), h=f.get("h"), a=f.get("a")))
        s = rows.get(mid)
        if s is not None:
            st = str(getattr(s, "status", "") or "")
            seen[st] = seen.get(st, 0) + 1
            e.update(st=st, sh=getattr(s, "score_home", None), sa=getattr(s, "score_away", None))
        # التشكيلة الرسمية فقط
        if not e.get("lu"):
            lu, err = call(client.matches.lineups, mid)
            time.sleep(REQUEST_DELAY)
            if lu is not None:
                e["hid"] = getattr(getattr(lu, "home_team", None), "id", None) or e.get("hid")
                h, a = getattr(lu, "home", None), getattr(lu, "away", None)
                if h and a and getattr(h, "confirmed", False) and getattr(a, "confirmed", False):
                    e["lu"] = dict(h=_mx_side(h), a=_mx_side(a))
                    e["lut"] = now()
                    lu_n += 1
                    log(f"  [Live] تشكيلة رسمية: {f.get('h')} – {f.get('a')} (قبل الموعد بـ{round(mins)} دقيقة)")
                else:
                    e["pred"] = 1         # PitchAPI عنده تشكيلة متوقعة بس: ما نعرضها
        # أحداث المباراة بعد ما تبدأ (الأهداف، البطاقات، التبديلات)
        if mins <= 0:
            ev, err = call(client.matches.events, mid)
            time.sleep(REQUEST_DELAY)
            if ev is not None:
                if not e.get("hid"):                 # الفريق صاحب الأرض (عشان نعرف جهة كل حدث)
                    mf, _ = call(client.matches.get, mid)
                    e["hid"] = getattr(getattr(mf, "home_team", None), "id", None) if mf is not None else None
                e["ev"] = [_lv_ev(x, e.get("hid")) for x in getattr(ev, "events", None) or []]
                e["evt"] = now()
                ev_n += 1
    if seen:
        log("  [Live] قيم status من PitchAPI للمباريات القريبة: " + ", ".join(f"{k or '—'} ({v})" for k, v in sorted(seen.items())))
    out = dict(t=now(), m=M)
    if json.dumps(M, sort_keys=True) != before:
        gh_put(hub, LV_PATH, json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update live")
        LV_HAVE["live"] = 1
        log(f"  [Live] {len(win)} مباراة قريبة: {lu_n} تشكيلة رسمية جديدة، أحداث {ev_n} مباراة")


# ---------- إحصائيات الشوطين ----------
def hv_pick(keys):
    """من مفاتيح PitchAPI: المقاييس اللي نحفظها لكل شوط (بالترتيب الثابت HV_WANT)."""
    out = {}
    for code, rx in HV_WANT:
        for k in keys:
            if re.search(rx, nrm(k)) and code not in out:
                out[code] = k
    return out


def hv_fetch(client, mid, keymap, allkeys):
    res, err = call(client.matches.players_halves, mid)
    time.sleep(REQUEST_DELAY)
    if res is None:
        return None, err
    rows = {}
    for p in getattr(res, "players", None) or []:
        pid = getattr(getattr(p, "player", None), "id", None)
        if not pid:
            continue
        per = {}
        for h in getattr(p, "periods", None) or []:
            vals = {}
            for g in getattr(h, "stats", None) or []:
                for label, en in (getattr(g, "stats", None) or {}).items():
                    k = getattr(en, "key", None) or label
                    allkeys.add(k)
                    vals[k] = num(getattr(getattr(en, "stat", None), "value", None))
            per[1 if "first" in str(getattr(h, "period", "")).lower() else 2] = vals
        rows[str(pid)] = (str(getattr(p, "team_id", "") or ""), per)
    keymap.update({c: k for c, k in hv_pick(sorted(allkeys)).items() if c not in keymap})   # مقاييس جديدة تنضاف، القديمة ثابتة
    codes = [c for c, _ in HV_WANT if c in keymap]
    out = {pid: [tid] + [[per.get(n, {}).get(keymap[c]) for c in codes] if n in per else None for n in (1, 2)]
           for pid, (tid, per) in rows.items()}
    return dict(c=codes, p=out), None


def sync_halves(client, hub, lids):
    t_now = datetime.datetime.now(datetime.timezone.utc)
    budget, allkeys = HV_PER_RUN, set()
    for L in lids:
        if budget <= 0:
            break
        fn = f"data/{safe_name(L)}_hv.json"
        d = gh_get_json(hub, fn)
        if d is None and _mx_status(hub, fn) != "missing":
            log(f"  [الشوطين] {L}: تعذرت قراءة الملف، تخطيته")
            continue
        d = d or {}
        H, st, keymap = dict(d.get("m") or {}), dict(d.get("st") or {}), dict(d.get("km") or {})
        todo = []
        for r in q("SELECT match_id i, date d FROM matches WHERE league_id=? AND score IS NOT NULL AND score<>'' AND status IN ('ok','partial') ORDER BY date DESC", (L,)):
            if r["i"] in H and set(keymap) <= set(H[r["i"]].get("c") or []):
                continue                      # محفوظة بكل المقاييس (لو انضاف مقياس جديد، نجيبها مرة ثانية)
            n, t = (st.get(r["i"]) or [0, None])[:2]
            last = _parse_ts(t)
            if n >= HV_TRIES or (last is not None and (t_now - last).total_seconds() < MX_RETRY_H * 3600):
                continue
            todo.append(r["i"])
        todo.sort(key=lambda i: i in H)        # الجديدة قبل إعادة جلب المحفوظة
        todo = todo[:budget]
        got = 0
        for mid in todo:
            res, err = hv_fetch(client, mid, keymap, allkeys)
            if err == "rate_limit":
                log("  [الشوطين] PitchAPI يحدّ الطلبات: وقفنا")
                budget = 0
                break
            if res and res["p"]:
                H[mid] = res
                st.pop(mid, None)
                got += 1
            else:
                st[mid] = [(st.get(mid) or [0])[0] + 1, now(), err or "empty"]
        budget -= len(todo)
        if todo:
            b = json.dumps(dict(km=keymap, m=H, st=st), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            gh_put(hub, fn, b, f"Update halves ({L})")
            log(f"  [الشوطين] {L}: {got} من {len(todo)} مباراة، المحفوظ {len(H)} | المقاييس: {keymap}")
        if H:
            LV_INDEX[L] = dict(hv_file=fn[5:], hv_v=_mx_v(json.dumps(sorted(H)).encode()))
    if allkeys:
        log("  [الشوطين] كل مفاتيح PitchAPI في إحصائيات الشوط: " + ", ".join(sorted(allkeys)))
    man = dict(LV_INDEX)
    if man and man != (gh_get_json(hub, "data/hv_index.json") or {}):
        gh_put(hub, "data/hv_index.json", json.dumps(man, ensure_ascii=False, indent=1).encode("utf-8"), "Update halves index")


# ---------- المواجهات السابقة للمباريات القادمة (matches.h2h)، مرة وحدة لكل مباراة ----------
H2H_PATH = "data/h2h.json"
H2H_DAYS = 8
H2H_PER_RUN = 25


def sync_h2h(client, hub, lids):
    t_now = datetime.datetime.now(datetime.timezone.utc)
    fix = gh_get_json(hub, FIX_PATH) or {}
    old = gh_get_json(hub, H2H_PATH)
    if old is not None:
        LV_HAVE["h2h"] = 1
    old = old or {}
    up = {}
    for lid, rows in (fix.get("leagues") or {}).items():
        if lids and lid not in lids:
            continue
        for f in rows or []:
            k = _lv_kick(f)
            if k is not None and -0.5 <= (k - t_now).total_seconds() / 86400 <= H2H_DAYS:
                up[str(f["i"])] = f
    M = {k: v for k, v in (old.get("m") or {}).items() if k in up}
    todo = [i for i in up if i not in M][:H2H_PER_RUN]
    for mid in todo:
        res, err = call(client.matches.h2h, mid)
        time.sleep(REQUEST_DELAY)
        if err == "rate_limit":
            break
        if res is None:
            continue
        hid = getattr(getattr(res, "home_team", None), "id", None)
        M[mid] = dict(n=getattr(res, "total_matches", 0), hw=getattr(res, "home_wins", 0), d=getattr(res, "draws", 0), aw=getattr(res, "away_wins", 0),
                      r=[[str(getattr(x, "time_utc", "") or "")[:10], getattr(getattr(x, "home", None), "name", ""), getattr(getattr(x, "away", None), "name", ""),
                          getattr(x, "score_home", None), getattr(x, "score_away", None)] for x in (getattr(res, "recent_matches", None) or []) if getattr(x, "finished", False)][:10])
    if M != (old.get("m") or {}):
        gh_put(hub, H2H_PATH, json.dumps(dict(t=now(), m=M), ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update head-to-head")
        LV_HAVE["h2h"] = 1
        log(f"  [H2H] {len(todo)} مباراة جديدة، المحفوظ {len(M)}")


# ---------- جدول المباريات لكل الدوريات (صفحة النظرة العامة): طلب واحد date.get لكل يوم ----------
SCH_PATH = "data/schedule.json"
SCH_BACK, SCH_AHEAD = 7, 7       # من 7 أيام قبل لـ7 أيام بعد
SCH_FULL_MIN = 60                # كل الأيام مرة في الساعة؛ أمس واليوم وبكرة كل مزامنة


def sync_schedule(client, hub, lids, t_now=None):
    t_now = t_now or datetime.datetime.now(datetime.timezone.utc)
    old = gh_get_json(hub, SCH_PATH)
    if old is not None:
        LV_HAVE["sch"] = 1
    old = old or {}
    day = lambda k: (t_now + datetime.timedelta(days=k)).strftime("%Y-%m-%d")
    want = [day(k) for k in range(-SCH_BACK, SCH_AHEAD + 1)]
    last = _parse_ts(old.get("full"))
    full = last is None or (t_now - last).total_seconds() > SCH_FULL_MIN * 60
    ask = want if full else [day(-1), day(0), day(1)]
    D_ = {k: v for k, v in (old.get("d") or {}).items() if k in want}
    Lg, Cr = dict(old.get("L") or {}), dict(old.get("C") or {})
    keep = set(lids or [])
    for d in ask:
        res, err = call(lambda d=d: client.date.get(d, status="all"))
        time.sleep(REQUEST_DELAY)
        if err == "rate_limit":
            break
        if res is None:
            continue
        rows = []
        for x in getattr(res, "matches", None) or []:
            lg = getattr(x, "league", None)
            lid = str(getattr(lg, "id", "") or "")
            if keep and lid not in keep:
                continue
            h, a = getattr(x, "home_team", None), getattr(x, "away_team", None)
            if lid not in Lg:
                Lg[lid] = dict(n=getattr(lg, "name", ""), img=getattr(lg, "image_url", None))
            for t in (h, a):
                if t is not None and getattr(t, "image_url", None):
                    Cr[getattr(t, "name", "")] = t.image_url
            rows.append([lid, str(x.id), str(getattr(x, "time_utc", "") or ""), getattr(h, "name", ""), getattr(a, "name", ""),
                         getattr(x, "score_home", None), getattr(x, "score_away", None), str(getattr(x, "status", "") or "")])
        rows.sort(key=lambda r: (r[0], r[2], r[3]))
        D_[d] = rows
    stamp = t_now.strftime("%Y-%m-%d %H:%M:%S")
    out = dict(t=stamp, full=stamp if full else old.get("full"), L=Lg, C=Cr, d=D_)
    if json.dumps(dict(L=Lg, C=Cr, d=D_), sort_keys=True) != json.dumps(dict(L=old.get("L") or {}, C=old.get("C") or {}, d=old.get("d") or {}), sort_keys=True) or full:
        gh_put(hub, SCH_PATH, json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update schedule")
        LV_HAVE["sch"] = 1
        log(f"  [الجدول] {len(ask)} يوم، {sum(len(v) for v in D_.values())} مباراة في {len(D_)} يوم")


def _lv_index_all(hub):
    if _LV_DONE:
        return
    _LV_DONE.append(1)
    for lid, v in (gh_get_json(hub, "data/hv_index.json") or {}).items():
        if lid not in LV_INDEX and (v or {}).get("hv_file"):
            LV_INDEX[lid] = v


_orig_gh_put_lv = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json":
        try:
            _lv_index_all(hub)
            if LV_INDEX or LV_HAVE:
                d = json.loads(content.decode("utf-8"))
                for lg in d.get("leagues", []):
                    lg.update(LV_INDEX.get(lg["id"], {}))
                d.update(LV_HAVE)
                content = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        except Exception as e:
            log(f"  تنبيه: ما قدرت أضيف ملفات الشوطين للفهرس: {e}")
    return _orig_gh_put_lv(hub, path, content, message)


_orig_run_pipeline_lv = run_pipeline


def run_pipeline(hub, pit_key):
    try:                                  # أول شي: التشكيلات الرسمية وحالة المباريات (خفيفة وسريعة)
        with PitchAPI(api_key=pit_key) as client:
            sync_live(client, hub, None)
            try:
                sync_schedule(client, hub, [l["id"] for l in (gh_get_json(hub, "data/index.json") or {}).get("leagues", [])])
            except Exception as e:
                log(f"  [الجدول] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    except Exception as e:
        log(f"  [Live] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    out = _orig_run_pipeline_lv(hub, pit_key)
    lids = list((globals().get("_LOGO_REFS") or {}).keys())
    try:
        with PitchAPI(api_key=pit_key) as client:
            for name, fn in (("الشوطين", lambda: sync_halves(client, hub, lids)), ("H2H", lambda: sync_h2h(client, hub, lids))):
                try:
                    fn()
                except Exception as e:
                    log(f"  [{name}] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    except Exception as e:
        log(f"  [الشوطين/H2H] خطأ ({type(e).__name__}: {e})")
    return out
# ======================== نهاية إضافة المباشر والشوطين ========================
