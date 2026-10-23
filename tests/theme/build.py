import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import json
js=open('theme.js').read();css=open('theme.css').read().replace('\n','')
assert '"""' not in js and '"' not in css.replace('content:""','') and not js.rstrip().endswith('\\')
css=css.replace('content:""',"content:''")
D=json.load(open('ar.json'))
py='''


# ============================================================================
# إضافة: هوية الألوان — لون لكل دوري، ألوان النادي كلون ثانوي، والذهبي لحامل اللقب (فقط إذا ثبت من نتائج الموسم الماضي)
# الإعداد كله في مكان واحد (THEME في الصفحة). ألوان الإحصائيات والرسوم ما تتغير. "الزجاج السائل" صار على الأسطح كلها بخفة.
# ============================================================================
FPL_CHAMP_PATH = "data/champions.json"
FPL_CHAMP_LEAGUE = "l_4WFCIZ"         # الدوري الإنجليزي في PitchAPI: نتائج الموسم الماضي الموثقة متوفرة له من أرشيف FPL


def _champion_of(d):
    """بطل الموسم من نتائجه الموثقة (كل المباريات منتهية). None إذا الموسم ناقص أو الأول والثاني متساويين في النقاط والفارق والأهداف."""
    teams = {t["id"]: t["n"] for t in (d or {}).get("teams", [])}
    fx = [x for x in (d or {}).get("fix", []) if x[0]]
    n = len(teams)
    if n < 2 or len(fx) != n * (n - 1) or not all(x[5] and x[6] is not None and x[7] is not None for x in fx):
        return None
    T = {}
    for x in fx:
        for t, f, a in ((x[1], x[6], x[7]), (x[2], x[7], x[6])):
            r = T.setdefault(t, [0, 0, 0])
            r[0] += 3 if f > a else 1 if f == a else 0
            r[1] += f - a
            r[2] += f
    o = sorted(T.items(), key=lambda kv: (-kv[1][0], -kv[1][1], -kv[1][2]))
    (w, a), (u, b) = o[0], o[1]
    if a == b:
        return None
    return dict(team=teams[w], pts=a[0], gd=a[1], gf=a[2], runner_up=teams[u], margin=a[0] - b[0], fixtures=len(fx))


def sync_champions(hub):
    """يكتب data/champions.json لموسم ما قبل الحالي إذا أرشيفه موجود؛ مرة وحدة لكل موسم."""
    t = datetime.datetime.now(datetime.timezone.utc)
    y = t.year if t.month >= 7 else t.year - 1
    prev, cur = f"{y - 1}-{str(y)[2:]}", f"{y}-{str(y + 1)[2:]}"
    ch = gh_get_json(hub, FPL_CHAMP_PATH) or {}
    lg = ch.setdefault("leagues", {})
    if (lg.get(FPL_CHAMP_LEAGUE) or {}).get("season") == prev:
        return
    man = gh_get_json(hub, "data/fpl_archive.json") or {}
    if not any(x.get("season") == prev for x in man.get("seasons", [])):
        return                                          # أرشيف الموسم الماضي ما نُشر بعد: ما نخمّن
    res = _champion_of(gh_get_json(hub, f"data/fpl_{prev}.json"))
    if not res:
        log(f"  [Champions] ما قدرت أحدد بطل {prev} من نتائجه — بدون شارة")
        return
    lg[FPL_CHAMP_LEAGUE] = dict(season=prev, next=cur, src=f"FPL archive (vaastav/Fantasy-Premier-League): final table from all {res['fixtures']} fixtures", **res)
    ch["note"] = "Defending champions per league, from the previous season's verified results. 'next' is the season the title is defended in."
    gh_put(hub, FPL_CHAMP_PATH, json.dumps(ch, ensure_ascii=False, indent=1).encode("utf-8"), f"Defending champions: {res['team']} ({prev})")
    log(f"  [Champions] بطل {prev}: {res['team']} ({res['pts']} نقطة، بفارق {res['margin']})")


_orig_run_pipeline_ch = run_pipeline


def run_pipeline(hub, pit_key):
    out = _orig_run_pipeline_ch(hub, pit_key)
    try:
        sync_champions(hub)
    except Exception as e:      # الشارة اختيارية: ما توقف المزامنة
        log(f"  [Champions] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return out


# ---------------- الشعارات: من PitchAPI نفسه (image_url للفرق والدوري)، تُحفظ في المستودع ملف لكل دوري ----------------
LOGO_MAX_BYTES = 120_000          # شعار أكبر من كذا ما نحفظه (يبقى لون النادي فقط)
LOGO_PER_RUN = 80                 # أقصى عدد شعارات جديدة في المزامنة الوحدة
LOGO_RETRY_H = 24                 # شعار فشل تحميله: نعيد المحاولة بعد يوم
LOGO_INDEX = {}                   # يدخل في data/index.json: اسم ملف الشعارات ونسخته لكل دوري
_LOGO_DONE = set()


def _logo_get(url):
    """يرجع (data URI, None) أو (None, السبب). مفتاح PitchAPI يُرسل فقط لخادم PitchAPI نفسه."""
    from urllib.parse import urlparse
    hdr = {}
    if (urlparse(url).hostname or "").endswith("pitchapi.dev") and os.environ.get("PITCHAPI_KEY"):
        hdr["X-API-KEY"] = os.environ["PITCHAPI_KEY"]
    r = requests.get(url, headers=hdr, timeout=20)
    ct = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
    if r.status_code != 200 or not ct.startswith("image/") or not r.content:
        return None, f"HTTP {r.status_code} {ct or '?'}"
    if len(r.content) > LOGO_MAX_BYTES:
        return None, f"{len(r.content)} bytes"
    return f"data:{ct};base64," + base64.b64encode(r.content).decode("ascii"), None


def sync_logos(hub, league_id):
    refs = globals().get("_LOGO_REFS", {}).get(league_id)
    if not refs or league_id in _LOGO_DONE:
        return
    _LOGO_DONE.add(league_id)
    fn = f"logos_{safe_name(league_id)}.json"
    man = gh_get_json(hub, "data/logos_src.json") or {}
    src = dict((man.get(league_id) or {}).get("src") or {})
    fail = dict((man.get(league_id) or {}).get("fail") or {})
    want = {}
    for pair in refs:
        for t in pair:
            n, u = getattr(t, "name", None), getattr(t, "image_url", None)
            if n and u:
                want[n] = u
    lu = globals().get("_LEAGUE_IMG", {}).get(league_id)
    if lu:
        want["__league__"] = lu
    t_now = datetime.datetime.now(datetime.timezone.utc)
    def due(n, u):
        if src.get(n) == u:
            return False
        last = _parse_ts((fail.get(n) or {}).get("t"))
        return last is None or (t_now - last).total_seconds() > LOGO_RETRY_H * 3600 or (fail.get(n) or {}).get("u") != u
    todo = [(n, u) for n, u in want.items() if due(n, u)][:LOGO_PER_RUN]
    if todo:
        old = gh_get_json(hub, f"data/{fn}") or {}
        teams, league = dict(old.get("teams") or {}), old.get("league")
        bad = []
        for n, u in todo:
            try:
                d, err = _logo_get(u)
            except Exception as e:
                d, err = None, type(e).__name__
            if d:
                if n == "__league__":
                    league = d
                else:
                    teams[n] = d
                src[n] = u
                fail.pop(n, None)
            else:
                fail[n] = dict(u=u, t=now(), why=err)
                bad.append(f"{n}: {err}")
        if teams or league:
            gh_put(hub, f"data/{fn}", json.dumps(dict(league=league, teams=teams), ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                   f"Update logos ({league_id})")
        man[league_id] = dict(src=src, fail=fail)
        gh_put(hub, "data/logos_src.json", json.dumps(man, ensure_ascii=False, indent=1).encode("utf-8"), "Update logo list")
        log(f"  [Logos] {league_id}: {len(todo) - len(bad)} شعار جديد، {len(bad)} تعذّر" + (f" (مثل {bad[0]})" if bad else ""))
    if src:
        LOGO_INDEX[league_id] = _logo_entry(league_id, src)


def _logo_entry(league_id, src):
    return dict(logo_file=f"logos_{safe_name(league_id)}.json",
                logo_v=hashlib.sha1(json.dumps(src, sort_keys=True).encode("utf-8")).hexdigest()[:10])


_LOGO_MAN_READ = []


def _logo_index_all(hub):
    """مرة في كل مزامنة: كل الدوريات اللي لها شعارات محفوظة تبقى في الفهرس من أول نشر (ما تختفي لين يجي دورها)."""
    if _LOGO_MAN_READ:
        return
    _LOGO_MAN_READ.append(1)
    for lid, v in (gh_get_json(hub, "data/logos_src.json") or {}).items():
        if (v or {}).get("src") and lid not in LOGO_INDEX:
            LOGO_INDEX[lid] = _logo_entry(lid, v["src"])


_orig_publish_logo = publish


def publish(hub, metas, final=False):
    try:
        _logo_index_all(hub)
    except Exception as e:
        log(f"  [Logos] تعذر قراءة قائمة الشعارات ({type(e).__name__}: {e})")
    for m in metas:
        try:
            sync_logos(hub, m["id"])
        except Exception as e:      # الشعارات اختيارية: ما توقف النشر
            log(f"  [Logos] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return _orig_publish_logo(hub, metas, final)


_orig_gh_put_logo = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json" and LOGO_INDEX:
        try:
            d = json.loads(content.decode("utf-8"))
            for lg in d.get("leagues", []):
                lg.update(LOGO_INDEX.get(lg["id"], {}))
            content = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        except Exception as e:
            log(f"  تنبيه: ما قدرت أضيف الشعارات للفهرس: {e}")
    return _orig_gh_put_logo(hub, path, content, message)


_X_THCSS = "''' + css + '''"
_X_THJS = r"""''' + js + '''"""


def _x_theme_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (هوية الألوان): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_THCSS + "</style></head>")
    h = sub(h, '<div class="top"><b>PL Analytics</b>', '<div class="top"><span class="brand"><img id="lglogo" class="lglogo" alt="" hidden><b><i class="bm" aria-hidden="true"></i>PL Analytics</b></span>')
    h = sub(h, "try{localStorage.setItem('league',D.id)}catch(e){}\\n", "try{localStorage.setItem('league',D.id)}catch(e){}\\n applyTheme();\\n")
    h = sub(h, "(pg==='player'&&k==='players')?'on':''", "(pg==='player'&&k==='players')||(pg==='club'&&k==='teams')?'on':''")
    h = sub(h, "async teams(el){\\n  const r=await api('/api/teams');", "async teams(el){\\n  await champReady();const r=await api('/api/teams');")
    h = sub(h, "r.rows.map(x=>[esc(x.club),x.matches,x.players,f(x.xt),f(x.xg)])", "r.rows.map(x=>[clubLink(x.club),x.matches,x.players,f(x.xt),f(x.xg)])")
    h = sub(h, "<span class=\\"ltt\\">${esc(r.t)}</span>", "<span class=\\"ltt\\"><a href=\\"#/club/${encodeURIComponent(r.t)}\\">${clubDot(r.t)}${esc(r.t)}</a>${champMark(r.t)}${euroMarks(r.t)}</span>")
    h = sub(h, "R.table=async function(el){\\n", "R.table=async function(el){\\n await champReady();\\n")
    h = sub(h, "async player(el,arg){\\n  const [key,club]=decodeURIComponent(arg).split('||');", "async player(el,arg){\\n  await champReady();const [key,club]=decodeURIComponent(arg).split('||');")
    h = sub(h, "<h2>${esc(r.rows[0].player)}</h2><div class=\\"mu\\">${esc(club)} · ${r.rows[0].pos||'position N/A'}</div>",
            "<h2>${esc(r.rows[0].player)}</h2><div class=\\"mu\\" style=\\"${clubVars(club)}\\">${clubLink(club)} · ${r.rows[0].pos||'position N/A'}</div>${champBadge(club)?`<div style=\\"margin:8px 0\\">${champBadge(club)}</div>`:''}")
    h = sub(h, "async function route(){", _X_THJS + "\\nasync function route(){")
    h = sub(h, " const [,pg='overview',arg='']=(location.hash||'#/overview').split('/');\\n", " const [,pg='overview',arg='']=(location.hash||'#/overview').split('/');\\n applyTheme(pg==='club'?decodeURIComponent(arg):null);\\n")
    return h


_AR_SEASON.update(''' + json.dumps(D,ensure_ascii=False,indent=4) + ''')


INDEX = _x_theme_index(INDEX)
# ======================== نهاية إضافة هوية الألوان ========================'''
p=REPO+'/sync.py';t=open(p,encoding='utf-8').read()
start='\n\n\n# ============================================================================\n# إضافة: هوية الألوان'
endm="# ======================== نهاية إضافة هوية الألوان ========================"
a=t.find(start)
if a>=0:
    b=t.index(endm)+len(endm);t=t[:a]+t[b:]
anchor="# ======================== نهاية إضافة هذا الأسبوع وجدول الدوري ========================"
assert t.count(anchor)==1
t=t.replace(anchor,anchor+py);open(p,'w',encoding='utf-8').write(t);print('inserted')
