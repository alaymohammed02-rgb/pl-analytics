


# ============================================================================
# إضافة: مركز المباراة — التشكيلات على الملعب، زخم المباراة، وتقييم اللاعبين (كلها من PitchAPI)
# كل مزامنة نطلب لعدد محدود من المباريات المنتهية (الأحدث أولاً، لكل الدوريات): matches.lineups و matches.momentum
# و matches.players (نأخذ منه التقييم فقط). تنحفظ في data/<league>_mx.json (التشكيلات والزخم) و data/<league>_rt.json (التقييمات)،
# وتنضاف أسماء الملفات للفهرس (mx_file / rt_file). الجزء الناقص يُعاد بعد MX_RETRY_H ساعة، وبعد MX_TRIES محاولات نتركه.
# ============================================================================
MX_PER_RUN = 60                   # كم مباراة نطلب لها في المزامنة الوحدة (3 طلبات لكل مباراة، لكل الدوريات)
MX_RETRY_H = 24
MX_TRIES = 3
MX_FN = {"lu": "lineups", "mo": "momentum", "rt": "players"}
MX_INDEX = {}
_MX_READ = []


def _mx_r(v, d=2):
    v = num(v)
    return None if v is None else round(v, d)


def mx_rating(pl):
    """تقييم اللاعب في المباراة من صف matches.players: إحصائية مفتاحها فيه rating وقيمتها بين 0 و10. ترجع (القيمة, المفتاح)."""
    best = None
    for g in getattr(pl, "stats", None) or []:
        for label, en in (getattr(g, "stats", None) or {}).items():
            k = getattr(en, "key", None) or label
            if "rating" not in nrm(k) and "rating" not in nrm(label):
                continue
            v = num(getattr(getattr(en, "stat", None), "value", None))
            if v is None or not 0 < v <= 10:
                continue
            exact = nrm(k) == "rating"
            if best is None or (exact and not best[2]):
                best = (round(v, 2), str(k), exact)
    return (best[0], best[1]) if best else (None, None)


def _mx_side(s):
    if not s:
        return None
    def pl(x, xi):
        r = [str(getattr(x, "player_id", "") or ""), getattr(x, "name", "") or "", str(getattr(x, "shirt_number", "") or ""), getattr(x, "position_id", None)]
        if xi:
            r += [_mx_r(getattr(x, "pitch_x", None), 3), _mx_r(getattr(x, "pitch_y", None), 3), 1 if getattr(x, "is_captain", False) else 0]
        return r
    xi = [pl(x, True) for x in getattr(s, "starters", None) or []]
    if not xi:
        return None
    return dict(f=getattr(s, "formation", "") or "", ok=1 if getattr(s, "confirmed", False) else 0,
                c=txt(getattr(s, "coach", None)), xi=xi, sb=[pl(x, False) for x in getattr(s, "subs", None) or []])


def mx_fetch(client, mid, parts, blocked, keys, asked=None):
    """يطلب الأجزاء الناقصة لمباراة. ترجع {الجزء: القيمة} للي وصل. blocked: نقاط اتصال رفضها الاشتراك في هذي المزامنة
    ("*" = PitchAPI يحدّ الطلبات: نوقف الخطوة كلها). asked: الأجزاء اللي انطلبت فعلاً."""
    got = {}
    for part, fn in MX_FN.items():
        if part not in parts or fn in blocked or "*" in blocked:
            continue
        res, err = call(getattr(client.matches, fn), mid)
        time.sleep(REQUEST_DELAY)
        if err == "rate_limit":
            blocked.add("*")
            log("  [مركز المباراة] PitchAPI يحدّ الطلبات الحين: نوقف هذي الخطوة ونحفظ اللي وصل")
            break
        if asked is not None:
            asked.add(part)
        if err in ("plan", "auth"):
            blocked.add(fn)
            log(f"  [مركز المباراة] {fn}: غير متاح بهذا الاشتراك ({err})، تخطيته في هذي المزامنة")
            continue
        if res is None:
            continue
        if part == "lu":
            h, a = _mx_side(getattr(res, "home", None)), _mx_side(getattr(res, "away", None))
            if h or a:
                got["lu"] = dict(h=h, a=a)
        elif part == "mo":
            pts = [[_mx_r(getattr(p, "minute", None)), _mx_r(getattr(p, "value", None), 3)] for p in getattr(res, "points", None) or []]
            pts = [p for p in pts if p[0] is not None and p[1] is not None]
            if pts:
                got["mo"] = pts
        else:
            rt = {}
            for p in res or []:
                v, k = mx_rating(p)
                i = getattr(getattr(p, "player", None), "id", None)
                if v is not None and i:
                    rt[str(i)] = v
                    keys[k] = keys.get(k, 0) + 1
            if rt:
                got["rt"] = rt
    return got


def _mx_missing(mx, rt, mid):
    m = mx.get(mid) or {}
    miss = [p for p in ("lu", "mo") if p not in m]
    lu = m.get("lu") or {}
    if "lu" in m and not all((lu.get(s) or {}).get("ok") for s in ("h", "a")):
        miss.append("lu")          # التشكيلة المتوقعة قبل المباراة: نجرب مرة ثانية للرسمية
    if mid not in rt:
        miss.append("rt")
    return miss


def mx_todo(lids, t_now, files):
    """المباريات المنتهية اللي ناقصها جزء، الأحدث أولاً (اللي ما انطلبت أبد قبل اللي نعيدها). ترجع [(التاريخ, الدوري, المباراة, الأجزاء)]."""
    out = []
    for L in lids:
        mx, rt = files[L]
        st = mx.setdefault("st", {})
        for r in q("SELECT match_id i, date d FROM matches WHERE league_id=? AND score IS NOT NULL AND score<>'' "
                   "AND status IN ('ok','partial')", (L,)):
            miss = _mx_missing(mx["m"], rt["m"], r["i"])
            if not miss:
                continue
            n, t = (st.get(r["i"]) or [0, None])[:2]
            last = _parse_ts(t)
            if n >= MX_TRIES or (last is not None and (t_now - last).total_seconds() < MX_RETRY_H * 3600):
                continue
            out.append((0 if n == 0 else 1, str(r["d"] or ""), L, r["i"], miss))
    out.sort(key=lambda x: x[1], reverse=True)
    out.sort(key=lambda x: x[0])
    return [(d, L, i, miss) for _, d, L, i, miss in out]


def _mx_status(hub, path):
    """هل الملف موجود في GitHub؟ 'missing' (404) / 'ok' / 'error' (أي خطأ ثاني أو انقطاع)."""
    try:
        r = requests.get(f"{GH}/repos/{hub['repo']}/contents/{path}", params={"ref": hub["branch"]}, timeout=60,
                         headers=gh_headers(hub["token"], "application/vnd.github.object+json"))
        return "missing" if r.status_code == 404 else "ok" if r.status_code == 200 else "error"
    except Exception:
        return "error"


def _mx_v(b):
    return hashlib.sha1(b).hexdigest()[:10]


def sync_match_centre(client, hub, lids):
    _mx_index_all(hub)
    t_now = datetime.datetime.now(datetime.timezone.utc)
    files = {}
    for L in list(lids):
        mx, rt = gh_get_json(hub, f"data/{safe_name(L)}_mx.json"), gh_get_json(hub, f"data/{safe_name(L)}_rt.json")
        # ملف ما انقرى: إذا موجود في GitHub (الخطأ مؤقت) نتخطى الدوري هذي المرة بدل ما نكتب فوقه ملف ناقص
        bad = [f for f, d in ((f"{safe_name(L)}_mx.json", mx), (f"{safe_name(L)}_rt.json", rt)) if d is None and _mx_status(hub, "data/" + f) != "missing"]
        if bad:
            log(f"  [مركز المباراة] {L}: تعذرت قراءة {', '.join(bad)}، تخطيت الدوري هذي المرة (المحفوظ ما تغيّر)")
            lids = [x for x in lids if x != L]
            continue
        mx, rt = mx or {}, rt or {}
        files[L] = (dict(m=dict(mx.get("m") or {}), st=dict(mx.get("st") or {})), dict(k=dict(rt.get("k") or {}), m=dict(rt.get("m") or {})))
    todo = mx_todo(lids, t_now, files)
    if not todo:
        log("  [مركز المباراة] كل المباريات المنتهية محدّثة")
    blocked, keys, touched = set(), {}, {}
    for d, L, mid, miss in todo[:MX_PER_RUN]:
        if "*" in blocked:
            break
        mx, rt = files[L]
        kl, asked = {}, set()
        got = mx_fetch(client, mid, miss, blocked, kl, asked)
        for k, n in kl.items():
            keys[k] = keys.get(k, 0) + n
            rt["k"][k] = rt["k"].get(k, 0) + n
        m = mx["m"].setdefault(mid, {})
        m.update({p: got[p] for p in ("lu", "mo") if p in got})
        if not m:
            mx["m"].pop(mid, None)
        if "rt" in got:
            rt["m"][mid] = got["rt"]
        left = _mx_missing(mx["m"], rt["m"], mid)
        if left:      # المحاولة تنحسب فقط إذا انطلب جزء ناقص فعلاً؛ وفي الحالتين ننتظر يوم قبل نرجع لها
            mx["st"][mid] = [(mx["st"].get(mid) or [0])[0] + (1 if set(left) & asked else 0), now(), ",".join(left)]
        else:
            mx["st"].pop(mid, None)
        c = touched.setdefault(L, dict(n=0, lu=0, mo=0, rt=0))
        c["n"] += 1
        for p in got:
            c[p] += 1
    if keys:
        log("  [مركز المباراة] مفتاح التقييم في PitchAPI: " + ", ".join(f"{k} ({n} لاعب)" for k, n in keys.items()))
    for L in lids:
        mx, rt = files[L]
        mb = json.dumps(mx, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        rb = json.dumps(rt, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if L in touched:
            c = touched[L]
            gh_put(hub, f"data/{safe_name(L)}_mx.json", mb, f"Update match centre ({L})")
            gh_put(hub, f"data/{safe_name(L)}_rt.json", rb, f"Update player ratings ({L})")
            log(f"  [مركز المباراة] {L}: {c['n']} مباراة طلبناها — وصل {c['lu']} تشكيلة و{c['mo']} زخم و{c['rt']} تقييمات | "
                f"المحفوظ: {sum(1 for v in mx['m'].values() if 'lu' in v)} تشكيلة، {sum(1 for v in mx['m'].values() if 'mo' in v)} زخم، "
                f"{len(rt['m'])} مباراة بتقييمات، {sum(1 for v in mx['st'].values() if v[0] >= MX_TRIES)} تركناها")
        if mx["m"] or rt["m"]:
            MX_INDEX[L] = dict(mx_file=f"{safe_name(L)}_mx.json", mx_v=_mx_v(mb), rt_file=f"{safe_name(L)}_rt.json", rt_v=_mx_v(rb))
    if len(todo) > MX_PER_RUN:
        log(f"  [مركز المباراة] باقي {len(todo) - MX_PER_RUN} مباراة للمزامنات الجاية")
    _mx_formats(files)
    man = dict(MX_INDEX)
    if man and man != (gh_get_json(hub, "data/mx_index.json") or {}):
        gh_put(hub, "data/mx_index.json", json.dumps(man, ensure_ascii=False, indent=1).encode("utf-8"), "Update match centre index")
    idx = gh_get_json(hub, "data/index.json")
    if idx and any({k: lg.get(k) for k in MX_INDEX.get(lg.get("id"), {})} != MX_INDEX.get(lg.get("id"), {}) for lg in idx.get("leagues", [])):
        gh_put(hub, "data/index.json", json.dumps(idx, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update index (match centre)")


def _mx_formats(files):
    """سطر في السجل يبيّن نطاق الأرقام (عشان نتأكد من معنى إحداثيات التشكيلة وإشارة الزخم)."""
    xs, ys, mo, mins = [], [], [], []
    for mx, _ in files.values():
        for v in mx["m"].values():
            for s in ((v.get("lu") or {}).get("h"), (v.get("lu") or {}).get("a")):
                for p in (s or {}).get("xi") or []:
                    if p[4] is not None:
                        xs.append(p[4])
                    if p[5] is not None:
                        ys.append(p[5])
            for p in v.get("mo") or []:
                mins.append(p[0])
                mo.append(p[1])
    if xs or mo:
        f = lambda a: f"{min(a)}..{max(a)}" if a else "—"
        log(f"  [مركز المباراة] نطاق الأرقام: pitch_x {f(xs)}، pitch_y {f(ys)}، دقيقة الزخم {f(mins)}، قيمة الزخم {f(mo)}")


def _mx_index_all(hub):
    """مرة في كل مزامنة: الدوريات اللي لها ملفات محفوظة تبقى في الفهرس من أول نشر."""
    if _MX_READ:
        return
    _MX_READ.append(1)
    for lid, v in (gh_get_json(hub, "data/mx_index.json") or {}).items():
        if lid not in MX_INDEX and (v or {}).get("mx_file"):
            MX_INDEX[lid] = v


_orig_gh_put_mx = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json":
        try:
            _mx_index_all(hub)
        except Exception as e:
            log(f"  [مركز المباراة] تعذر قراءة الفهرس ({type(e).__name__}: {e})")
        if MX_INDEX:
            try:
                d = json.loads(content.decode("utf-8"))
                for lg in d.get("leagues", []):
                    lg.update(MX_INDEX.get(lg["id"], {}))
                content = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            except Exception as e:
                log(f"  تنبيه: ما قدرت أضيف مركز المباراة للفهرس: {e}")
    return _orig_gh_put_mx(hub, path, content, message)


_orig_run_pipeline_mx = run_pipeline


def run_pipeline(hub, pit_key):
    out = _orig_run_pipeline_mx(hub, pit_key)
    lids = list((globals().get("_LOGO_REFS") or {}).keys())
    try:
        lids = lids or [r["l"] for r in q("SELECT DISTINCT league_id l FROM matches")]
    except Exception:
        pass
    try:
        with PitchAPI(api_key=pit_key) as client:
            sync_match_centre(client, hub, lids)
    except Exception as e:      # اختيارية: ما توقف المزامنة
        log(f"  [مركز المباراة] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return out
# ======================== نهاية إضافة مركز المباراة ========================
