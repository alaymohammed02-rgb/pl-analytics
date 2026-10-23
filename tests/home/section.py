

# ============================================================================
# إضافة: الصفحة الرئيسية الذكية — اكتشاف الجولة، نجوم الجولة، قوة الأندية، من الأفضل؟، رادار الفانتازي، ترتيبات سريعة، ومركز الإحصائيات.
# المزامنة تضيف شي واحد فقط: رابط صورة كل لاعب من PitchAPI (players.get، مربوط برقم اللاعب نفسه)، في ملف صغير لكل دوري.
# الصفحة تعرض الصورة فقط إذا تأكدت المزامنة إن الصور تنفتح بدون مفتاح؛ وإلا تعرض الحروف الأولى وشعار النادي.
# ============================================================================
PHOTO_PER_RUN = 300               # أقصى عدد لاعبين نطلب ملفهم (صورة + مركز + جنسية) في المزامنة الوحدة (لكل الدوريات)، حوالي دقيقتين
PHOTO_RETRY_H = 24                # إعادة المحاولة بعد خطأ
PHOTO_NOIMG_H = 24 * 7            # لاعب ملفه ما فيه صورة: نرجع له بعد أسبوع
PHOTO_MIN_MIN = 270               # الصور: لاعبون لعبوا 270 دقيقة على الأقل (اللي ممكن يظهرون في البطاقات)
POS_MIN_MIN = 1                   # المراكز: كل لاعب لعب ولو دقيقة
PHOTO_INDEX = {}
PHOTO_POS_IDS = {}               # رقم المركز من PitchAPI لكل لاعب، لكل دوري (تستخدمه إضافة جودة البيانات)
_PHOTO_READ = []


def _photo_public(url):
    """هل تنفتح الصورة بدون أي مفتاح؟ (المتصفح ما يرسل المفتاح، فهذا هو اللي يهم)"""
    try:
        r = requests.get(url, timeout=20)
        ct = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        return r.status_code == 200 and ct.startswith("image/") and len(r.content) > 0
    except Exception:
        return False


def sync_photos(client, hub, lids):
    _photo_index_all(hub)          # الدوريات اللي ما يجي دورها في هذي المزامنة تبقى في القائمة
    budget = PHOTO_PER_RUN
    t_now = datetime.datetime.now(datetime.timezone.utc)
    public = None
    for lid in lids:
        fn = f"data/photos_{safe_name(lid)}.json"
        old = gh_get_json(hub, fn) or {}
        P, fail, Q, C = dict(old.get("p") or {}), dict(old.get("fail") or {}), dict(old.get("q") or {}), dict(old.get("c") or {})
        rows = q("SELECT player_id AS i, SUM(minutes) AS mi FROM pl_adv WHERE league_id=? AND player_id IS NOT NULL GROUP BY player_id", (lid,))
        mins = {r["i"]: (r["mi"] or 0) for r in rows}
        want = [r["i"] for r in sorted(rows, key=lambda r: -(r["mi"] or 0)) if (r["mi"] or 0) >= POS_MIN_MIN]
        def due(pid):
            need = (pid not in Q) or (pid not in C) or (pid not in P and mins.get(pid, 0) >= PHOTO_MIN_MIN)
            if not need:
                return False
            f = fail.get(pid) or {}
            last = _parse_ts(f.get("t"))
            wait = PHOTO_NOIMG_H if f.get("why") == "no image" and pid in Q else PHOTO_RETRY_H
            return last is None or (t_now - last).total_seconds() > wait * 3600
        todo = [p for p in want if due(p)][:max(0, budget)]
        got = gotq = 0
        for pid in todo:
            res, err = call(client.players.get, pid)
            url = getattr(res, "image_url", None) if res is not None else None
            pos = getattr(res, "position_id", None) if res is not None else None
            if res is not None:
                C[pid] = str(getattr(res, "country_code", None) or "")     # الجنسية (فاضي = الملف ما فيه جنسية)
            if pos is not None:
                Q[pid] = pos
                gotq += 1
            if url:
                P[pid] = url
                fail.pop(pid, None)
                got += 1
            else:
                fail[pid] = dict(t=now(), why=err or "no image")
            time.sleep(REQUEST_DELAY)
        budget -= len(todo)
        pub = old.get("public")
        if P and (pub is None or todo):
            if public is None:
                public = _photo_public(next(iter(P.values())))
            pub = public
        if todo or pub != old.get("public"):
            gh_put(hub, fn, json.dumps(dict(public=pub, p=P, q=Q, c=C, fail=fail), ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                   f"Update player photos ({lid})")
            log(f"  [Photos] {lid}: {got} صورة و{gotq} مركز جديد من {len(todo)} طلب، المجموع {len(P)} صورة و{len(Q)} مركز، تنفتح بدون مفتاح: {pub}")
        if Q:
            PHOTO_POS_IDS[lid] = Q
        if P:
            PHOTO_INDEX[lid] = dict(photo_file=fn[5:], photo_v=hashlib.sha1(json.dumps([pub, sorted(P.items()), sorted(C.items())]).encode()).hexdigest()[:10])
        if budget <= 0:
            break
    man = {k: v for k, v in PHOTO_INDEX.items()}
    if man and man != (gh_get_json(hub, "data/photos_index.json") or {}):
        gh_put(hub, "data/photos_index.json", json.dumps(man, ensure_ascii=False, indent=1).encode("utf-8"), "Update player photo index")


def _photo_index_all(hub):
    """مرة في كل مزامنة: الدوريات اللي لها صور محفوظة تبقى في الفهرس من أول نشر."""
    if _PHOTO_READ:
        return
    _PHOTO_READ.append(1)
    for lid, v in (gh_get_json(hub, "data/photos_index.json") or {}).items():
        if lid not in PHOTO_INDEX and (v or {}).get("photo_file"):
            PHOTO_INDEX[lid] = v


_orig_gh_put_photo = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json":
        try:
            _photo_index_all(hub)   # الصور تُجلب بعد آخر نشر في المزامنة، فتدخل الفهرس من أول نشر في المزامنة التالية
        except Exception as e:
            log(f"  [Photos] تعذر قراءة الفهرس ({type(e).__name__}: {e})")
        if PHOTO_INDEX:
            try:
                d = json.loads(content.decode("utf-8"))
                for lg in d.get("leagues", []):
                    lg.update(PHOTO_INDEX.get(lg["id"], {}))
                content = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            except Exception as e:
                log(f"  تنبيه: ما قدرت أضيف الصور للفهرس: {e}")
    return _orig_gh_put_photo(hub, path, content, message)


_orig_run_pipeline_photo = run_pipeline


def run_pipeline(hub, pit_key):
    out = _orig_run_pipeline_photo(hub, pit_key)
    lids = list((globals().get("_LOGO_REFS") or {}).keys())
    try:
        with PitchAPI(api_key=pit_key) as client:
            sync_photos(client, hub, lids)
    except Exception as e:      # الصور اختيارية: ما توقف المزامنة
        log(f"  [Photos] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return out


_X_HOMECSS = "@@CSS@@"
_X_HOMEJS = r"""@@JS@@"""


def _x_home_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (الصفحة الرئيسية): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_HOMECSS + "</style></head>")
    h = sub(h, "async function route(){", _X_HOMEJS + "\nasync function route(){")
    return h


_AR_SEASON.update(@@AR@@)


INDEX = _x_home_index(INDEX)
# ======================== نهاية إضافة الصفحة الرئيسية ========================
