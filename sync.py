# -*- coding: utf-8 -*-
# ============================================================
# PL Analytics — يجلب xG / xT من PitchAPI ثم ينشرها كموقع دائم على GitHub Pages
#
# الفكرة: Colab لتحديث البيانات فقط. الموقع نفسه ملف ثابت (HTML + data.json)
# مستضاف على GitHub، فيفتح بنفس الرابط من أي جهاز (آيباد، جوال، كمبيوتر)
# بدون Colab وبدون iframe.
#
# قبل أول تشغيل (مرة واحدة فقط) — Colab ← المفاتيح (🔑 Secrets):
#   PITCHAPI_KEY  = مفتاح PitchAPI
#   GITHUB_TOKEN  = GitHub Personal access token (classic) بصلاحية repo
# ثم الصق الملف كاملاً في خلية وشغّلها. يطبع لك رابط الموقع في الآخر.
# ============================================================
import os, re, sys, time, json, base64, hashlib, sqlite3, datetime, subprocess
from getpass import getpass

try:
    import pitchapi  # noqa: F401
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "-q", "install", "pitchapi"])

import requests
from pitchapi import PitchAPI, NotFoundError, PlanUpgradeRequiredError, RateLimitError

# ---------------- الإعدادات ----------------
# الدوريات المطلوبة. الكود يبحث عنها بالاسم في PitchAPI ويحدد الـID تلقائياً.
# words = كلمات من اسم الدوري بالإنجليزي | country = للتفريق بين دوريات بنفس الاسم
# known = ID معروف مسبقاً | exclude = كلمات تستبعد دوريات مشابهة
LEAGUE_TARGETS = [
    dict(label="الدوري الإنجليزي", words=["premier league"], country="england", known="l_4WFCIZ"),
    dict(label="الدوري الإسباني", words=["la liga", "laliga", "primera division"], country="spain"),
    dict(label="الدوري الألماني", words=["bundesliga"], country="germany"),
    dict(label="الدوري الفرنسي", words=["ligue 1"], country="france"),
    dict(label="الدوري الإيطالي", words=["serie a"], country="italy"),
    dict(label="الدوري البرتغالي", words=["primeira liga", "liga portugal"], country="portugal"),
    dict(label="دوري أبطال أوروبا", words=["champions league"],
         exclude=["afc", "caf", "concacaf", "conmebol", "asia", "africa", "oceania"]),
    dict(label="كأس العالم", words=["world cup"], exclude=["club", "beach", "futsal"]),
]
EXTRA_LEAGUE_IDS = []         # أي دوري ثاني تبغاه: حط الـID هنا (من LIST_LEAGUES)
GLOBAL_EXCLUDE = ("women", "feminin", "femenin", "qualif", "youth", "u17", "u18",
                  "u19", "u20", "u21", "u23", "reserve")
LIST_LEAGUES = False          # True = يطبع أسماء الدوريات و IDs ثم يتوقف
REPO_NAME = "pl-analytics"    # اسم المستودع على GitHub (يُنشأ تلقائياً)
SETUP_AUTOMATION = True       # يجهّز زر Synchronize والتحديث التلقائي على GitHub Actions
COLAB_DOES_SYNC = False       # False = أول مزامنة تشتغل على GitHub بالخلفية (تقدر تقفل Colab)
SYNC_CRON = "3-59/5 * * * *"  # تحديث تلقائي كل 5 دقايق (أقل فاصل يسمح به GitHub)
RETRY_RECENT_MIN = 30         # مباراة لعبت قريباً وتحليلاتها ناقصة: أعد المحاولة كل N دقيقة
RETRY_OLD_MIN = 720           # مباراة قديمة ناقصة: أعد المحاولة كل N دقيقة (حتى لا نستنزف الـAPI)
PUBLISH_EVERY = 40            # ينشر نسخة جزئية كل N مباراة (حتى لا يضيع التقدم)
DB_PATH = "/content/pl_app.db" if os.path.isdir("/content") else "pl_app.db"
RETRY_WAITS = (5, 15, 30, 60)
REQUEST_DELAY = 0.2
UNKNOWN = "Unknown"


def log(*a):
    print(*a, flush=True)


# ---------------- دوال مساعدة ----------------
def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def nrm(k):
    return str(k).lower().replace("_", "").replace(" ", "").replace("-", "")

def txt(x):
    return x if isinstance(x, str) else (getattr(x, "name", None) or "")

def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def call(fn, *a):
    """ترجع (النتيجة, الخطأ). تعيد المحاولة عند RateLimit."""
    for i in range(len(RETRY_WAITS) + 1):
        try:
            return fn(*a), None
        except RateLimitError as e:
            if i >= len(RETRY_WAITS):
                return None, "rate_limit"
            w = RETRY_WAITS[i]
            ra = num(getattr(e, "retry_after", None))
            if ra:
                w = max(w, min(ra, 120))
            log(f"  Rate limit: انتظار {w:.0f} ثانية...")
            time.sleep(w)
        except NotFoundError:
            return None, "not_found"
        except PlanUpgradeRequiredError:
            return None, "plan"
        except Exception as e:
            if "auth" in type(e).__name__.lower():
                return None, "auth"
            return None, f"error: {type(e).__name__}"
    return None, "rate_limit"

# ---------------- قاعدة البيانات (محلية مؤقتة، والمصدر الدائم هو GitHub) ----------------
def db():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS matches(
      league_id TEXT, match_id TEXT, date TEXT, home TEXT, away TEXT, score TEXT,
      status TEXT DEFAULT 'pending', fetched_at TEXT,
      PRIMARY KEY(league_id, match_id));
    CREATE TABLE IF NOT EXISTS stats(
      league_id TEXT, match_id TEXT, player_key TEXT, player_id TEXT, player TEXT,
      club TEXT, pos TEXT, xt REAL, xg REAL, xg_faced REAL, minutes REAL,
      source TEXT, fetched_at TEXT,
      PRIMARY KEY(league_id, match_id, player_key));
    """)
    c.commit()
    c.close()

def q(sql, args=(), one=False):
    c = db()
    try:
        rows = [dict(r) for r in c.execute(sql, args).fetchall()]
    finally:
        c.close()
    return (rows[0] if rows else None) if one else rows

# ---------------- استخراج بيانات مباراة ----------------
MINUTE_ATTRS = ("minutes_played", "minutes", "mins", "minutes_on_pitch", "time_played")
MINUTE_KEYS = ("minutesplayed", "minutes", "mins", "timeplayed")
POS_MAP = {
    "gk": "GK", "g": "GK", "goalkeeper": "GK", "keeper": "GK",
    "df": "DF", "d": "DF", "defender": "DF", "cb": "DF", "lb": "DF", "rb": "DF",
    "wb": "DF", "lwb": "DF", "rwb": "DF", "centreback": "DF", "centerback": "DF",
    "mf": "MF", "m": "MF", "midfielder": "MF", "cm": "MF", "dm": "MF", "am": "MF",
    "cdm": "MF", "cam": "MF", "lm": "MF", "rm": "MF",
    "fw": "FW", "f": "FW", "forward": "FW", "striker": "FW", "st": "FW", "cf": "FW",
    "lw": "FW", "rw": "FW", "winger": "FW", "attacker": "FW",
}
POS_WORDS = (("goalkeep", "GK"), ("defend", "DF"), ("midfield", "MF"),
             ("forward", "FW"), ("striker", "FW"), ("wing", "FW"), ("attack", "FW"))

def pname(p):
    return getattr(p, "name", None) or getattr(getattr(p, "player", None), "name", None) or "Unknown player"

def pid(p):
    for o in (p, getattr(p, "player", None)):
        if o is None:
            continue
        for a in ("player_id", "id"):
            v = getattr(o, a, None)
            if v:
                return str(v)
    return None

def get_pos(p):
    for o in (p, getattr(p, "player", None)):
        if o is None:
            continue
        for a in ("position", "pos", "role"):
            val = getattr(o, a, None)
            if val is None:
                continue
            v = nrm(txt(val) or getattr(val, "code", None) or "")
            if v in POS_MAP:
                return POS_MAP[v]
            for k, w in POS_WORDS:
                if k in v:
                    return w
    return None

def is_gk(p):
    return get_pos(p) == "GK"

def get_club(p):
    for path in (("team", "name"), ("club", "name"), ("player", "team", "name"),
                 ("team",), ("team_name",), ("club_name",)):
        o = p
        for a in path:
            o = getattr(o, a, None)
            if o is None:
                break
        if isinstance(o, str) and o:
            return o
    return None

def get_minutes(p):
    for o in (p, getattr(p, "player", None), getattr(p, "possession_value", None)):
        if o is None:
            continue
        for a in MINUTE_ATTRS:
            v = num(getattr(o, a, None))
            if v is not None:
                return v
    try:
        for g in getattr(p, "stats", None) or []:
            for _, en in g.stats.items():
                if nrm(en.key) in MINUTE_KEYS:
                    v = num(en.stat.value)
                    if v is not None:
                        return v
    except Exception:
        pass
    return None

def is_xg_key(k):
    k = nrm(k)
    return "xg" in k or ("expected" in k and "goal" in k)

def is_against(k):
    k = nrm(k)
    return any(w in k for w in ("conceded", "against", "faced", "allowed"))

def pick_xg(c):
    for k, v in c:
        if nrm(k) in ("expectedgoals", "xg"):
            return k, v
    bad = ("xgot", "ontarget", "nonpenalty", "np", "assist")
    for k, v in c:
        if not any(b in nrm(k) for b in bad):
            return k, v
    return c[0]

def club_map(client, m):
    out = {}
    try:
        lu = client.matches.lineups(m.id)
        for side, team in (("home", m.home_team), ("away", m.away_team)):
            side_lu = getattr(lu, side, None)
            if not side_lu:
                continue
            for grp in ("starters", "substitutes", "bench", "subs"):
                for pl in getattr(side_lu, grp, None) or []:
                    n = getattr(pl, "name", None)
                    if n:
                        out[n] = team.name
    except Exception:
        pass
    return out

def extract(client, m):
    """ترجع (الحالة, الصفوف). الحالة: ok / partial / no_data / failed"""
    adv, e1 = call(client.matches.advanced_players, m.id)
    pls, e2 = call(client.matches.players, m.id)
    recs, objs = {}, {}

    def rec(p):
        n = pname(p)
        r = recs.setdefault(n, dict(player=n, pid=None, club=None, pos=None,
                                    xt=None, xg=None, xgf=None, minutes=None))
        objs.setdefault(n, p)
        r["pid"] = r["pid"] or pid(p)
        if r["minutes"] is None:
            r["minutes"] = get_minutes(p)
        if r["pos"] is None:
            r["pos"] = get_pos(p)
        return r

    if adv is not None:
        for p in getattr(adv, "players", None) or []:
            r = rec(p)
            xt = num(getattr(getattr(p, "possession_value", None), "xt_total", None))
            if xt is not None:
                r["xt"] = xt
    for p in pls or []:
        cands = []
        for g in getattr(p, "stats", None) or []:
            for _, en in g.stats.items():
                if is_xg_key(en.key):
                    cands.append((en.key, num(en.stat.value)))
        if not cands:
            continue
        key, val = pick_xg(cands)
        r = rec(p)
        if val is None or "prevent" in nrm(key):
            continue                      # مقياس مختلف: لا نخلطه مع xG
        if is_against(key) or is_gk(p):
            r["xgf"] = abs(val)           # xG المواجه للحارس (عمود منفصل)
        else:
            r["xg"] = val

    hard = lambda e: e and e not in ("not_found", "plan")
    if not recs:
        return ("failed" if hard(e1) or hard(e2) else "no_data"), []
    cm = None
    for n, r in recs.items():
        r["club"] = get_club(objs[n])
        if not r["club"]:
            cm = cm if cm is not None else club_map(client, m)
            r["club"] = cm.get(n, UNKNOWN)
    return ("ok" if (e1 is None and e2 is None) else "partial"), list(recs.values())

# ---------------- المزامنة ----------------
def _parse_ts(ts):
    try:
        return datetime.datetime.strptime(str(ts)[:19].replace("T", " "), "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=datetime.timezone.utc)
    except Exception:
        return None

def match_due(r):
    """هل نجلب هذه المباراة الآن؟ المكتملة لا تُعاد، والناقصة تُعاد بفاصل زمني (backoff)."""
    if r is None or r["status"] in (None, "pending") or not r["fetched_at"]:
        return True
    if r["status"] == "ok":
        return False
    last = _parse_ts(r["fetched_at"])
    if last is None:
        return True
    age_min = (datetime.datetime.now(datetime.timezone.utc) - last).total_seconds() / 60
    played = _parse_ts(r["date"])
    recent = played is not None and (datetime.datetime.now(datetime.timezone.utc) - played).days < 3
    return age_min >= (RETRY_RECENT_MIN if recent else RETRY_OLD_MIN)

def sync_league(client, league_id, on_progress=None):
    log(f"\n[{league_id}] جلب قائمة المباريات...")
    res, err = call(lambda: client.leagues.matches(league_id, season=None, status="played"))
    if res is None:
        log(f"  فشل جلب المباريات: {err}")
        if err == "auth":
            raise SetupError(AUTH_HELP)
        if err == "plan":
            log("  هذا الدوري يحتاج خطة أعلى في PitchAPI — تخطيته.")
        return False
    ms = list(res.matches)
    c = db()
    for m in ms:
        c.execute(
            "INSERT INTO matches(league_id,match_id,date,home,away,score) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(league_id,match_id) DO UPDATE SET date=excluded.date, score=excluded.score",
            (league_id, str(m.id), str(getattr(m, "date", "")), m.home_team.name,
             m.away_team.name, f"{m.score_home}-{m.score_away}"))
    c.commit()
    c.close()
    info = {r["match_id"]: r for r in q(
        "SELECT match_id, status, fetched_at, date FROM matches WHERE league_id=?", (league_id,))}
    todo = [m for m in ms if match_due(info.get(str(m.id)))]
    n_ok = sum(1 for r in info.values() if r["status"] == "ok")
    log(f"  المباريات: {len(ms)} | مكتملة سابقاً: {n_ok} | المطلوب جلبها الآن: {len(todo)}")
    for i, m in enumerate(todo, 1):
        status, rows = extract(client, m)
        t = now()
        c = db()
        if rows:
            c.execute("DELETE FROM stats WHERE league_id=? AND match_id=?", (league_id, str(m.id)))
            c.executemany(
                "INSERT OR REPLACE INTO stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                [(league_id, str(m.id), r["pid"] or r["player"], r["pid"], r["player"],
                  r["club"], r["pos"], r["xt"], r["xg"], r["xgf"], r["minutes"],
                  "PitchAPI", t) for r in rows])
        c.execute("UPDATE matches SET status=?, fetched_at=? WHERE league_id=? AND match_id=?",
                  (status, t, league_id, str(m.id)))
        c.commit()
        c.close()
        log(f"  [{i}/{len(todo)}] {m.home_team.name} vs {m.away_team.name} -> {status} ({len(rows)} لاعب)")
        if on_progress and i % PUBLISH_EVERY == 0 and i < len(todo):
            on_progress()
        time.sleep(REQUEST_DELAY)
    return True

# ---------------- التصدير والاستعادة ----------------
AUTH_HELP = """
PitchAPI رفض المفتاح (AuthError).
غالباً المفتاح انكتب أو انلصق غلط (مسافة زائدة أو حرف ناقص)، أو انتهت صلاحيته أو انغيّر.
الحل: انسخ المفتاح من لوحة PitchAPI مرة ثانية، وحطه في Colab ← أيقونة 🔑 Secrets
باسم PITCHAPI_KEY (وفعّل Notebook access) بدل ما تكتبه كل مرة، ثم أعد التشغيل.
"""

def safe_name(league_id):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(league_id))

def league_has_data(L):
    return q("SELECT COUNT(*) n FROM matches WHERE league_id=?", (L,), True)["n"] > 0

def build_league_payload(lg):
    """محتوى ملف دوري واحد (بدون وقت توليد، حتى لا يتغير الملف بلا سبب)."""
    L = lg["id"]
    ms = q("SELECT match_id i, date d, home h, away a, score s, status t, fetched_at f "
           "FROM matches WHERE league_id=? ORDER BY date", (L,))
    st = q("SELECT match_id m, player_key k, player_id i, player p, club c, pos o, "
           "xt, xg, xg_faced xf, minutes mi FROM stats WHERE league_id=?", (L,))
    for r in st:
        for k in ("xt", "xg", "xf"):
            if r[k] is not None:
                r[k] = round(r[k], 4)
        if r["mi"] is not None:
            r["mi"] = round(r["mi"], 1)
    return dict(id=L, name=lg["name"], country=lg.get("country", ""), matches=ms, stats=st)

def restore_league(lg):
    """يرجّع دوري واحد من البيانات المحفوظة على GitHub إلى القاعدة المحلية."""
    L = lg["id"]
    c = db()
    for m in lg.get("matches", []):
        c.execute("INSERT OR REPLACE INTO matches"
                  "(league_id,match_id,date,home,away,score,status,fetched_at) "
                  "VALUES(?,?,?,?,?,?,?,?)",
                  (L, m["i"], m["d"], m["h"], m["a"], m["s"], m["t"], m.get("f")))
    c.executemany(
        "INSERT OR REPLACE INTO stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [(L, s["m"], s["k"], s["i"], s["p"], s["c"], s["o"], s["xt"], s["xg"],
          s["xf"], s["mi"], "PitchAPI", None) for s in lg.get("stats", [])])
    c.commit()
    c.close()

def restore_payload(payload):
    """الصيغة القديمة (ملف data.json واحد فيه كل الدوريات)."""
    for lg in payload.get("leagues", []):
        restore_league(lg)

# ---------------- تحديد الدوريات تلقائياً بالاسم ----------------
def resolve_leagues(client):
    res, err = call(client.leagues.list)
    items = list(getattr(res, "leagues", None) or res or []) if res is not None else []
    if not items:
        if err == "auth":
            raise SetupError(AUTH_HELP)
        log("تعذر جلب قائمة الدوريات:", err)
        return []
    by_id = {str(l.id): l for l in items}
    metas, seen = [], set()

    def add(lg):
        if str(lg.id) in seen:
            return
        seen.add(str(lg.id))
        metas.append(dict(id=str(lg.id), name=lg.name, country=txt(getattr(lg, "country", None))))

    log("\nتحديد الدوريات:")
    for t in LEAGUE_TARGETS:
        lg = by_id.get(t.get("known", ""))
        if lg is None:
            bad = GLOBAL_EXCLUDE + tuple(t.get("exclude", ()))
            cands = [l for l in items
                     if any(nrm(w) in nrm(l.name) for w in t["words"])
                     and not any(nrm(x) in nrm(l.name) for x in bad)]
            c = t.get("country")
            if len(cands) > 1 and c:
                pref = [l for l in cands if nrm(c) in nrm(txt(getattr(l, "country", None)))]
                cands = pref or cands
            def rank(l, words=t["words"]):
                # نفضّل الاسم الذي ليس فيه رقم بعد الكلمة (يتجنب LaLiga 2 و 2. Bundesliga)، ثم الأقصر
                rest = nrm(l.name)
                for w in words:
                    rest = rest.replace(nrm(w), "")
                return (any(ch.isdigit() for ch in rest), len(nrm(l.name)))
            cands.sort(key=rank)
            lg = cands[0] if cands else None
            if lg is not None and len(cands) > 1:
                alts = " | ".join(f"{l.name} [{l.id}]" for l in cands[1:4])
                log(f"  (بدائل لـ {t['label']}: {alts})")
        if lg is None:
            log(f"  ✘ {t['label']}: ما لقيته في PitchAPI (جرّب LIST_LEAGUES=True وحط الـID في EXTRA_LEAGUE_IDS)")
        else:
            log(f"  ✔ {t['label']} ← {lg.name} [{lg.id}] {txt(getattr(lg, 'country', None))}")
            add(lg)
    for lid_ in EXTRA_LEAGUE_IDS:
        lg = by_id.get(str(lid_))
        if lg is None:
            log(f"  ✘ الـID {lid_} غير موجود")
        else:
            log(f"  ✔ إضافي ← {lg.name} [{lg.id}]")
            add(lg)
    return metas

# ---------------- GitHub ----------------
GH = "https://api.github.com"

def gh_headers(token, accept="application/vnd.github+json"):
    return {"Authorization": f"Bearer {token}", "Accept": accept,
            "X-GitHub-Api-Version": "2022-11-28"}

class SetupError(Exception):
    """خطأ إعداد مفهوم: نطبع رسالته بدل Traceback."""


NO_CREATE_HELP = """
تعذر إنشاء المستودع تلقائياً (GitHub رجّع {code}).
السبب: توكنك من نوع Fine-grained (أو Classic بدون صلاحية repo)، وهذا النوع ما يقدر ينشئ مستودعات.

الحل — اختر واحداً:
 1) الأسهل: توكن Classic بصلاحية repo
    GitHub ← Settings ← Developer settings ← Personal access tokens
    ← Tokens (classic) ← Generate new token (classic) ← علّم repo
    ثم حطه في Colab Secrets باسم GITHUB_TOKEN وأعد التشغيل.
 2) أو أنشئ المستودع بنفسك: github.com/new باسم {name} (Public)،
    ثم عدّل توكنك الـFine-grained واختر هذا المستودع بالصلاحيات:
      Contents = Read and write
      Pages    = Read and write
      Metadata = Read
    وأعد التشغيل. (إذا ما انفعّلت Pages تلقائياً: Settings ← Pages ← Branch main / root)
"""


NO_ACCESS_HELP = """
المستودع {repo} موجود، لكن توكنك ما عنده صلاحية عليه (GitHub يرجّع 404 للمستودعات المحجوبة).

الحل — اختر واحداً:
 1) توكن Classic بصلاحية repo (الأسهل).
 2) أو عدّل توكنك الـFine-grained: Repository access ← Only select repositories ← اختر {name}
    ثم الصلاحيات: Contents = Read and write ، Pages = Read and write ، Metadata = Read
ثم أعد التشغيل.
"""


def gh_hint(code):
    if code == 404:
        return ("404 غالباً = التوكن ما عنده صلاحية على المستودع (Fine-grained: Repository access ← "
                "اختر المستودع + Contents: Read and write) أو استخدم توكن Classic بصلاحية repo.")
    if code in (401, 403):
        return "التوكن ينقصه صلاحية الكتابة (Contents: Read and write) أو منتهي."
    if code == 422:
        return "GitHub رفض الطلب (422)، أعد التشغيل."
    return ""


def gh_setup(token, name):
    """يتحقق من التوكن، ثم يستخدم المستودع الموجود أو ينشئه."""
    h = gh_headers(token)
    r = requests.get(f"{GH}/user", headers=h, timeout=30)
    if r.status_code != 200:
        raise SetupError("GitHub token غير صالح أو منتهي. سوّ توكن جديد وحطه في Secrets باسم GITHUB_TOKEN.")
    login = r.json()["login"]
    repo = f"{login}/{name}"
    r = requests.get(f"{GH}/repos/{repo}", headers=h, timeout=30)
    if r.status_code == 404:
        r = requests.post(f"{GH}/user/repos", headers=h, timeout=30, json={
            "name": name, "private": False, "auto_init": True,
            "description": "PL Analytics (xG / xT)"})
        if r.status_code == 422:      # الاسم موجود، لكن التوكن لا يراه
            raise SetupError(NO_ACCESS_HELP.format(repo=repo, name=name))
        if r.status_code not in (200, 201):
            raise SetupError(NO_CREATE_HELP.format(code=r.status_code, name=name))
        log(f"تم إنشاء المستودع {repo}")
        time.sleep(3)
    elif r.status_code != 200:
        raise SetupError(f"GitHub {r.status_code}: {r.text[:200]}")
    info = r.json()
    perms = info.get("permissions")
    if perms is not None and not perms.get("push"):
        raise SetupError(NO_ACCESS_HELP.format(repo=repo, name=name))
    if info.get("private"):
        log("تنبيه: المستودع Private، وGitHub Pages في الحساب المجاني يحتاج مستودع Public.")
        log(f"  غيّره من: https://github.com/{repo}/settings ← Danger Zone ← Change visibility ← Public")
    branch = info.get("default_branch", "main")
    return dict(token=token, repo=repo, branch=branch, pages=False,
                url=f"https://{login}.github.io/{name}/")

def git_blob_sha(b):
    return hashlib.sha1(b"blob %d\0" % len(b) + b).hexdigest()

def gh_put(hub, path, content, message):
    """يرفع ملفاً (وينتقل بدون تغيير إذا المحتوى نفسه). ترجع True إذا تغيّر."""
    url = f"{GH}/repos/{hub['repo']}/contents/{path}"
    r = requests.get(url, params={"ref": hub["branch"]}, timeout=60,
                     headers=gh_headers(hub["token"], "application/vnd.github.object+json"))
    sha = r.json().get("sha") if r.status_code == 200 else None
    if sha and sha == git_blob_sha(content):
        return False
    # بدون تحديد branch: يستخدم الفرع الافتراضي (ويشتغل حتى لو المستودع فاضي تماماً)
    body = {"message": message, "content": base64.b64encode(content).decode("ascii")}
    if sha:
        body["sha"] = sha
    r = requests.put(url, json=body, headers=gh_headers(hub["token"]), timeout=300)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"GitHub {r.status_code} أثناء رفع {path}: {r.text[:150]}\n  {gh_hint(r.status_code)}")
    return True

def gh_get_json(hub, path):
    r = requests.get(f"{GH}/repos/{hub['repo']}/contents/{path}",
                     params={"ref": hub["branch"]}, timeout=300,
                     headers=gh_headers(hub["token"], "application/vnd.github.raw+json"))
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except Exception:
        return None

# ===== نهاية الجزء 1 من 5 — كمّل الصق الجزء 2 تحت هذا السطر مباشرة =====
def gh_restore(hub, metas):
    """يرجّع البيانات المحفوظة (لكل دوري ليس عنده بيانات محلية). ترجع عدد الدوريات."""
    n = 0
    for lg in metas:
        if league_has_data(lg["id"]):
            continue
        d = gh_get_json(hub, f"data/{safe_name(lg['id'])}.json")
        if d:
            try:
                restore_league(d)
                n += 1
            except Exception as e:
                log(f"  تعذر استعادة {lg['name']}: {type(e).__name__}")
    if n == 0 and not any(league_has_data(m["id"]) for m in metas):
        d = gh_get_json(hub, "data.json")       # الصيغة القديمة
        if d:
            try:
                restore_payload(d)
                n = len(d.get("leagues", []))
            except Exception as e:
                log(f"  تعذر استعادة البيانات القديمة: {type(e).__name__}")
    return n

def gh_enable_pages(hub):
    r = requests.post(f"{GH}/repos/{hub['repo']}/pages", timeout=30,
                      headers=gh_headers(hub["token"]),
                      json={"source": {"branch": hub["branch"], "path": "/"}})
    if r.status_code in (201, 409):      # تم التفعيل، أو مفعّل من قبل
        hub["pages"] = True
    else:
        log(f"  تنبيه: Pages ما انفعّل تلقائياً ({r.status_code}). {gh_hint(r.status_code)}")
        if r.status_code in (403, 422):
            log("  (تأكد أيضاً أن المستودع Public، وأن صلاحية Pages = Read and write إذا التوكن Fine-grained)")
        log(f"  فعّله يدوياً: https://github.com/{hub['repo']}/settings/pages")
        log(f"     Source: Deploy from a branch ← Branch: {hub['branch']} / (root) ← Save")


def gh_pages_status(hub, wait=120):
    """يتأكد أن الموقع انبنى فعلاً. يرجع (الرابط، الحالة) أو (None, None) إذا Pages غير مفعّل."""
    h = gh_headers(hub["token"])
    r = requests.get(f"{GH}/repos/{hub['repo']}/pages", headers=h, timeout=30)
    if r.status_code != 200:
        return None, None
    url = r.json().get("html_url") or hub["url"]
    status = None
    for _ in range(max(1, wait // 10)):
        b = requests.get(f"{GH}/repos/{hub['repo']}/pages/builds/latest", headers=h, timeout=30)
        status = b.json().get("status") if b.status_code == 200 else None
        if status in ("built", "errored"):
            break
        time.sleep(10)
    return url, status


WORKFLOW_YML = r"""name: Sync data
on:
  workflow_dispatch:
  schedule:
    - cron: "__CRON__"
concurrency:
  group: sync-data
  cancel-in-progress: false
permissions:
  contents: write
jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 350
    steps:
      - name: Get sync.py
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.raw+json" \
            "https://api.github.com/repos/$GITHUB_REPOSITORY/contents/sync.py" -o sync.py
      - name: Run sync
        env:
          PITCHAPI_KEY: ${{ secrets.PITCHAPI_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          python3 -m venv .venv
          . .venv/bin/activate
          pip install -q pitchapi requests
          python sync.py
"""


def gh_set_secret(hub, name, value):
    """يحفظ Secret مشفّراً في المستودع (يحتاج PyNaCl)."""
    try:
        from nacl import encoding, public
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "-q", "install", "pynacl"])
        from nacl import encoding, public
    h = gh_headers(hub["token"])
    r = requests.get(f"{GH}/repos/{hub['repo']}/actions/secrets/public-key", headers=h, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"GitHub {r.status_code}: {r.text[:120]}")
    k = r.json()
    box = public.SealedBox(public.PublicKey(k["key"].encode("utf-8"), encoding.Base64Encoder()))
    enc = base64.b64encode(box.encrypt(value.encode("utf-8"))).decode("ascii")
    r = requests.put(f"{GH}/repos/{hub['repo']}/actions/secrets/{name}", headers=h, timeout=30,
                     json={"encrypted_value": enc, "key_id": k["key_id"]})
    if r.status_code not in (201, 204):
        raise RuntimeError(f"GitHub {r.status_code}: {r.text[:120]}")


def gh_dispatch(hub):
    """يشغّل المزامنة على GitHub Actions."""
    url = f"{GH}/repos/{hub['repo']}/actions/workflows/sync.yml/dispatches"
    r = None
    for _ in range(6):                      # أحياناً يتأخر GitHub ثواني قبل ما يشوف الملف الجديد
        r = requests.post(url, json={"ref": hub["branch"]}, headers=gh_headers(hub["token"]), timeout=30)
        if r.status_code == 204:
            return True
        if r.status_code != 404:
            break
        time.sleep(5)
    log(f"  تعذر تشغيل المزامنة على GitHub ({r.status_code}): {r.text[:150]}")
    return False


def current_source():
    """نص الكود الحالي (من خلية Colab أو من الملف) لرفعه كـ sync.py."""
    try:
        src = get_ipython().user_ns["_ih"][-1]          # noqa: F821  (خلية Colab الحالية)
        if "def main(" in src and "WORKFLOW_YML" in src:
            return src
    except Exception:
        pass
    try:
        with open(__file__, encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def setup_automation(hub, pit_key):
    """يرفع sync.py + workflow ويحفظ المفتاح كـ Secret. ترجع True إذا تم كل شيء."""
    src = current_source()
    if not src:
        log("تنبيه: ما قدرت أقرأ نص الكود لرفعه (لازم يكون الكود كامل في خلية واحدة).")
        return False
    try:
        gh_put(hub, "sync.py", src.encode("utf-8"), "Update sync script")
        yml = WORKFLOW_YML.replace("__CRON__", SYNC_CRON)
        gh_put(hub, ".github/workflows/sync.yml", yml.encode("utf-8"), "Update sync workflow")
    except Exception as e:
        log(f"تعذر رفع ملفات المزامنة التلقائية: {e}")
        log("  إذا الخطأ يخص workflow: أضف للتوكن صلاحية workflow")
        log("  (Classic: علّم workflow مع repo | Fine-grained: Workflows = Read and write)")
        return False
    try:
        gh_set_secret(hub, "PITCHAPI_KEY", pit_key)
    except Exception as e:
        log(f"تعذر حفظ مفتاح PitchAPI كـ Secret تلقائياً: {e}")
        log(f"  أضفه يدوياً: https://github.com/{hub['repo']}/settings/secrets/actions/new")
        log("  الاسم: PITCHAPI_KEY  والقيمة: مفتاحك")
        return False
    log("تم إعداد المزامنة التلقائية على GitHub ✔")
    return True


def probe_site(url, tries=9):
    """يجرب فتح الرابط فعلياً (كل 10 ثواني) ويرجع True إذا ظهر الموقع."""
    for _ in range(tries):
        try:
            r = requests.get(url, timeout=20, headers={"Cache-Control": "no-cache"})
            if r.status_code == 200 and "PL Analytics" in r.text:
                return True
        except Exception:
            pass
        time.sleep(10)
    return False


def publish(hub, metas, final=False):
    try:
        active = [m for m in metas if league_has_data(m["id"])]
        if not active:
            log("  لا توجد بيانات للنشر بعد.")
            return False
        index, changed, total = dict(leagues=[]), False, 0
        for lg in active:
            data = json.dumps(build_league_payload(lg), ensure_ascii=False,
                              separators=(",", ":")).encode("utf-8")
            fn = safe_name(lg["id"]) + ".json"
            changed |= gh_put(hub, f"data/{fn}", data, f"Update {lg['name']}")
            total += len(data)
            st = {r["status"]: r["n"] for r in q(
                "SELECT status, COUNT(*) n FROM matches WHERE league_id=? GROUP BY status", (lg["id"],))}
            index["leagues"].append(dict(id=lg["id"], name=lg["name"], country=lg.get("country", ""),
                                         file=fn, matches=sum(st.values()), ok=st.get("ok", 0)))
        last = [q("SELECT MAX(fetched_at) t FROM matches WHERE league_id=?", (m["id"],), True)["t"]
                for m in active]
        index["generated"] = max([t for t in last if t] or [now()])
        idx = json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        changed |= gh_put(hub, "data/index.json", idx, "Update index")
        changed |= gh_put(hub, "index.html", INDEX.encode("utf-8"), "Update site")
        if not hub["pages"]:
            gh_enable_pages(hub)
        log(f"  تم النشر: {len(active)} دوري ({total / 1024:,.0f} KB){'' if changed else ' — لا تغييرات'}")
        return True
    except Exception as e:
        log(f"  فشل النشر: {e}")
        return False


# ---------------- الموقع (ملف ثابت يقرأ data.json) ----------------
INDEX = r"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PL Analytics</title>
<style>
:root{--bg:#0d1520;--sf:#152130;--ln:#25374d;--tx:#e8eef5;--mu:#8a9bb0;--g:#4cc38a;--b:#5aa9e6;--a:#e9b44c;--r:#e5646b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--ln)}
.top{display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px;gap:10px}
.top b{font-size:17px}.top span{color:var(--mu);font-size:13px}
nav{display:flex;gap:4px;overflow-x:auto;padding:4px 10px 8px}
nav a{white-space:nowrap;color:var(--mu);text-decoration:none;padding:8px 12px;border-radius:8px;min-height:40px}
nav a.on{background:var(--sf);color:var(--tx);box-shadow:inset 0 -2px var(--g)}
main{max-width:1100px;margin:0 auto;padding:14px}
h2{margin:6px 0 12px;font-size:20px}h3{margin:18px 0 8px;font-size:15px;color:var(--mu);font-weight:600}
.card{background:var(--sf);border:1px solid var(--ln);border-radius:10px;padding:12px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{background:var(--sf);border:1px solid var(--ln);border-radius:10px;padding:10px}.kpi b{display:block;font-size:22px}.kpi span{color:var(--mu);font-size:12px}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--ln);white-space:nowrap}th{color:var(--mu);font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
a{color:var(--b)}.bar{height:6px;background:var(--b);border-radius:3px}
.ctl{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
input,select,button{background:var(--sf);color:var(--tx);border:1px solid var(--ln);border-radius:8px;padding:10px;font:inherit;min-height:42px}
button{cursor:pointer;background:var(--g);color:#06210f;border:0;font-weight:600}button.s{background:var(--sf);color:var(--tx);border:1px solid var(--ln)}
button:disabled{opacity:.5}
.tag{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;border:1px solid var(--ln)}
.available,.ok{color:var(--g)}.partial{color:var(--a)}.missing,.failed,.no_data{color:var(--r)}.ni,.pending{color:var(--mu)}
.empty{border:1px dashed var(--ln);border-radius:10px;padding:18px;color:var(--mu)}
.chart{width:100%;height:140px}.mu{color:var(--mu)}
</style></head><body>
<header><div class="top"><b>PL Analytics</b><span id="lg">Loading…</span></div><nav id="nav"></nav></header>
<main id="app"></main>
<script>
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(v,d=3)=>v==null?'N/A':Number(v).toFixed(d);
const num=v=>{if(v==null||v==='')return null;const x=Number(v);return isNaN(x)?null:x};
const byDate=(a,b)=>String(b.date).localeCompare(String(a.date));
const NEG=-1e18;

/* ---------- البيانات (من data.json) ---------- */
let ALL=null,D=null,AGGC=null;
async function setLeague(id){
 const meta=ALL.leagues.find(l=>l.id===id)||ALL.leagues[0];
 const r=await fetch('data/'+meta.file+'?v='+encodeURIComponent(ALL.generated||Date.now()));
 if(!r.ok)throw new Error('league file not found (HTTP '+r.status+')');
 const L=await r.json();
 D={id:meta.id,name:meta.name,
  matches:L.matches.map(m=>({match_id:String(m.i),date:m.d||'',home:m.h,away:m.a,score:m.s,status:m.t||'pending',fetched_at:m.f})),
  stats:L.stats.map(s=>({match_id:String(s.m),key:String(s.k),player_id:s.i,player:s.p,club:s.c,pos:s.o,xt:s.xt,xg:s.xg,xg_faced:s.xf,minutes:s.mi}))};
 AGGC=null;try{localStorage.setItem('league',D.id)}catch(e){}
}
function head(){
 const one=ALL.leagues.length<2;
 $('#lg').innerHTML=(one?esc(D.name):`<select id="lgpick" style="min-height:32px;padding:4px 8px;max-width:200px">${ALL.leagues.map(l=>`<option value="${esc(l.id)}" ${l.id===D.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select>`)+' · current season';
 const p=$('#lgpick');
 if(p)p.onchange=async()=>{
  $('#app').innerHTML='<div class="empty">Loading league…</div>';
  try{await setLeague(p.value);CMP=[];route()}catch(e){$('#app').innerHTML=`<div class="empty">${esc(e.message)}</div>`}};
}
function agg(){
 if(AGGC)return AGGC;
 const g=new Map(),add=(r,k,v)=>{if(v!=null)r[k]=(r[k]??0)+v};
 for(const s of D.stats){
  const id=s.key+'||'+s.club;let r=g.get(id);
  if(!r){r={key:s.key,player:s.player,player_id:s.player_id,club:s.club,pos:null,games:0,minutes:null,xt:null,xg:null,xgf:null,_n:{xt:0,xg:0,xgf:0},_d:{xt:0,xg:0,xgf:0}};g.set(id,r)}
  r.games++;
  if(s.pos&&(!r.pos||s.pos>r.pos))r.pos=s.pos;
  if(s.player_id&&!r.player_id)r.player_id=s.player_id;
  add(r,'minutes',s.minutes);add(r,'xt',s.xt);add(r,'xg',s.xg);add(r,'xgf',s.xg_faced);
  if(s.minutes!=null){
   for(const [k,v] of [['xt',s.xt],['xg',s.xg],['xgf',s.xg_faced]]){if(v!=null){r._n[k]+=v;r._d[k]+=s.minutes}}
  }
 }
 AGGC=[...g.values()].map(r=>{
  for(const k of ['xt','xg','xgf'])r[k+'90']=r._d[k]>0?r._n[k]/r._d[k]*90:null;
  delete r._n;delete r._d;return r});
 return AGGC;
}
function overview(){
 const st={};D.matches.forEach(m=>st[m.status]=(st[m.status]||0)+1);
 const rows=agg(),top=k=>rows.filter(r=>r[k]!=null).sort((a,b)=>b[k]-a[k]).slice(0,5);
 return {status:st,matches:D.matches.length,players:new Set(rows.map(r=>r.key)).size,
  teams:new Set(rows.filter(r=>r.club!=='Unknown').map(r=>r.club)).size,
  last_sync:ALL.generated,top_xt:top('xt'),top_xg:top('xg'),
  recent:[...D.matches].sort(byDate).slice(0,8)};
}
function rankings(a){
 const metric=['xt','xg','xgf'].includes(a.metric)?a.metric:'xt';
 const p90=a.per90==='1',mn=num(a.min)||0,col=metric+(p90?'90':'');
 let rows=agg();const total=rows.length,s=(a.q||'').toLowerCase().trim();
 const teams=[...new Set(rows.map(r=>r.club).filter(Boolean))].sort();
 rows=rows.filter(r=>(!s||r.player.toLowerCase().includes(s))&&(!a.team||r.club===a.team)&&(!a.pos||r.pos===a.pos)&&(mn<=0||(r.minutes||0)>=mn));
 rows=rows.filter(r=>r[col]!=null).sort((x,y)=>y[col]-x[col]);
 return {rows:rows.slice(0,Math.floor(num(a.limit))||100),shown:rows.length,total,teams,col};
}
function teamsPage(){
 const g=new Map();
 for(const s of D.stats){
  if(s.club==='Unknown')continue;
  let t=g.get(s.club);if(!t){t={club:s.club,ms:new Set(),ps:new Set(),xt:null,xg:null};g.set(s.club,t)}
  t.ms.add(s.match_id);t.ps.add(s.key);
  if(s.xt!=null)t.xt=(t.xt??0)+s.xt;if(s.xg!=null)t.xg=(t.xg??0)+s.xg;
 }
 return {rows:[...g.values()].map(t=>({club:t.club,matches:t.ms.size,players:t.ps.size,xt:t.xt,xg:t.xg})).sort((a,b)=>(b.xt??NEG)-(a.xt??NEG))};
}
function matchPage(id){
 return {match:D.matches.find(x=>x.match_id===id)||null,
  rows:D.stats.filter(s=>s.match_id===id).sort((a,b)=>(b.xt??NEG)-(a.xt??NEG))};
}
function playerPage(a){
 const mm=new Map(D.matches.map(m=>[m.match_id,m]));
 return {rows:D.stats.filter(s=>s.key===a.key&&s.club===a.club).map(s=>{const m=mm.get(s.match_id)||{};
  return {...s,date:m.date||'',home:m.home||'',away:m.away||'',score:m.score||''}}).sort((x,y)=>x.date.localeCompare(y.date))};
}
function availability(){
 const by=new Map();
 for(const s of D.stats){let b=by.get(s.match_id);if(!b){b={n:0,xt:0,xg:0,mi:0};by.set(s.match_id,b)}
  b.n++;if(s.xt!=null)b.xt++;if(s.xg!=null)b.xg++;if(s.minutes!=null)b.mi++}
 const st=(c,n)=>(!n||!c)?'missing':(c===n?'available':'partial');
 const rows=[...D.matches].sort(byDate).map(m=>{const b=by.get(m.match_id)||{n:0,xt:0,xg:0,mi:0};
  return {...m,n:b.n,xt:st(b.xt,b.n),xg:st(b.xg,b.n),mi:st(b.mi,b.n)}});
 const n=D.stats.length,i=D.stats.filter(s=>s.player_id).length;
 return {rows,id_pct:n?100*i/n:null};
}
async function api(p){
 const u=new URL(p,'http://x'),a=Object.fromEntries(u.searchParams),path=u.pathname;
 if(path==='/api/overview')return overview();
 if(path==='/api/rankings')return rankings(a);
 if(path==='/api/teams')return teamsPage();
 if(path==='/api/matches')return {rows:[...D.matches].sort(byDate)};
 if(path.startsWith('/api/match/'))return matchPage(decodeURIComponent(path.slice(11)));
 if(path==='/api/player')return playerPage(a);
 if(path==='/api/availability')return availability();
 throw new Error('Unknown endpoint '+p);
}

/* ---------- الصفحات ---------- */
const PAGES=[['overview','Overview'],['players','Players'],['teams','Teams'],['matches','Matches'],['compare','Compare'],['tactical','Tactical'],['shots','Shots'],['passing','Passing'],['heatmaps','Heatmaps'],['rankings','Rankings'],['data','Data Availability'],['settings','Settings']];
const PLAN={
 tactical:['Tactical Analysis','Formations, starting positions, build-up and defensive activity.','Needs lineup positions and event data. Not inspected yet.'],
 shots:['Shot Analysis','Shot map, shot table, xG per shot and outcome filters.','PitchAPI lists a shots endpoint, but its response has not been inspected in this app yet.'],
 passing:['Passing Analysis','Pass maps and pass completion by zone.','Pass maps need start and end coordinates for each pass. Not confirmed from the provider.'],
 heatmaps:['Heatmaps','Player and team activity maps.','PitchAPI lists heatmap data, but the grid format has not been inspected yet.']};
let CMP=[];
const GH_REPO=()=>{try{const v=localStorage.getItem('gh_repo');if(v)return v}catch(e){}return location.hostname.split('.')[0]+'/'+(location.pathname.split('/')[1]||'')};
const ghTok=()=>{try{return localStorage.getItem('gh_token')||''}catch(e){return ''}};
const ghApi=(path,opt={})=>{const t=ghTok();return fetch('https://api.github.com'+path,{...opt,headers:{'Accept':'application/vnd.github+json',...(t?{'Authorization':'Bearer '+t}:{}),...(opt.headers||{})}})};
async function reloadData(){
 const r=await fetch('data/index.json?'+Date.now());
 if(!r.ok)throw new Error('index.json HTTP '+r.status);
 ALL=await r.json();
 await setLeague(D?D.id:ALL.leagues[0].id);
 head();
}
const tag=s=>`<span class="tag ${s}">${({ok:'Complete',partial:'Partial',no_data:'No data',failed:'Failed',pending:'Not checked',available:'Available',missing:'Missing',ni:'Not yet integrated'})[s]||s}</span>`;
const tbl=(h,rows)=>rows.length?`<div class="wrap"><table><tr>${h.map(x=>`<th class="${x[1]?'n':''}">${x[0]}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${h[i][1]?'n':''}">${c}</td>`).join('')}</tr>`).join('')}</table></div>`:'<div class="empty">No data yet. Run the Colab cell to update the data.</div>';
const mlink=m=>`<a href="#/match/${esc(m.match_id)}">${esc(m.home)} ${esc(m.score)} ${esc(m.away)}</a>`;
function bars(vals,labels,title){
 const v=vals.filter(x=>x!=null);if(!v.length)return `<div class="empty">${title}: no data</div>`;
 const w=Math.max(10,Math.min(26,560/vals.length)),H=110,lo=Math.min(0,...v),hi=Math.max(0,...v),sc=x=>H*(hi-x)/((hi-lo)||1),y0=sc(0);
 let s=`<div class="mu">${title} per match</div><svg class="chart" viewBox="0 0 ${vals.length*w+6} ${H+6}" preserveAspectRatio="none">`;
 vals.forEach((x,i)=>{if(x==null)return;const y=sc(x);s+=`<rect x="${i*w+3}" y="${Math.min(y,y0)}" width="${w-3}" height="${Math.max(1,Math.abs(y-y0))}" fill="${x<0?'#e5646b':'#5aa9e6'}"><title>${esc(labels[i])}: ${f(x)}</title></rect>`});
 return s+'</svg>'}
async function rankView(el,d){
 el.innerHTML=`<div class="ctl"><input id="q" placeholder="Search player" value=""><select id="team"><option value="">All teams</option></select>
 <select id="pos"><option value="">All positions</option><option>GK</option><option>DF</option><option>MF</option><option>FW</option></select>
 <select id="metric"><option value="xt">xT</option><option value="xg">xG</option><option value="xgf">xG faced (GK)</option></select>
 <label class="mu" style="align-self:center"><input type="checkbox" id="p90" ${d.p90?'checked':''} style="min-height:0"> per 90</label>
 <input id="min" type="number" placeholder="Min minutes" value="${d.min}" style="width:130px"></div><div id="out"></div>`;
 let teamsDone=false;
 const load=async()=>{
  const p=new URLSearchParams({q:$('#q').value,team:$('#team').value,pos:$('#pos').value,metric:$('#metric').value,per90:$('#p90').checked?'1':'0',min:$('#min').value,limit:200});
  const r=await api('/api/rankings?'+p);
  if(!teamsDone){$('#team').innerHTML='<option value="">All teams</option>'+r.teams.map(t=>`<option>${esc(t)}</option>`).join('');teamsDone=true}
  $('#out').innerHTML=`<div class="mu" style="margin-bottom:8px">${r.shown} of ${r.total} players match. Sorted by ${esc(r.col)}.${$('#p90').checked?' Per-90 uses only matches that have minutes.':''}</div>`+
  tbl([['#',1],['Player'],['Club'],['Pos'],['Games',1],['Min',1],['xT',1],['xT/90',1],['xG',1],['xG/90',1],['xG faced',1],['']],
   r.rows.map((x,i)=>[i+1,`<a href="#/player/${encodeURIComponent(x.key+'||'+x.club)}">${esc(x.player)}</a>`,esc(x.club),x.pos||'N/A',x.games,x.minutes==null?'N/A':Math.round(x.minutes),f(x.xt),f(x.xt90),f(x.xg),f(x.xg90),f(x.xgf),
   `<button class="s" onclick="addCmp('${encodeURIComponent(x.key+'||'+x.club)}')">+</button>`]))};
 ['q','team','pos','metric','p90','min'].forEach(i=>$('#'+i).addEventListener(i==='q'||i==='min'?'input':'change',load));
 await load()}
function addCmp(k){if(!CMP.includes(k)&&CMP.length<5)CMP.push(k);alert('Added to Compare ('+CMP.length+')')}
const R={
 async overview(el){
  const o=await api('/api/overview'),s=o.status;
  const top=(a,k)=>tbl([['Player'],['Club'],[k,1]],a.map(x=>[esc(x.player),esc(x.club),f(x[k.toLowerCase()])]));
  el.innerHTML=`<h2>Overview — current season</h2><div class="grid">
  <div class="kpi"><b>${o.matches}</b><span>Matches played</span></div>
  <div class="kpi"><b>${s.ok||0}</b><span>Fully analysed</span></div>
  <div class="kpi"><b>${(s.partial||0)+(s.no_data||0)+(s.failed||0)}</b><span>Partial, empty or failed</span></div>
  <div class="kpi"><b>${o.players}</b><span>Players with data</span></div>
  <div class="kpi"><b>${o.teams}</b><span>Teams with data</span></div>
  <div class="kpi"><b style="font-size:14px">${esc(o.last_sync||'Never')}</b><span>Data updated (UTC)</span></div></div>
  <h3>Top xT</h3>${top(o.top_xt,'xT')}<h3>Top xG</h3>${top(o.top_xg,'xG')}
  <h3>Recent matches</h3>${tbl([['Date'],['Match'],['Status']],o.recent.map(m=>[esc(m.date.slice(0,10)),mlink(m),tag(m.status)]))}`},
 players:el=>{el.innerHTML='<h2>Players</h2><div id="rv"></div>';return rankView($('#rv'),{p90:false,min:''})},
 rankings:el=>{el.innerHTML='<h2>Rankings</h2><div id="rv"></div>';return rankView($('#rv'),{p90:true,min:270})},
 async teams(el){
  const r=await api('/api/teams');
  el.innerHTML='<h2>Teams</h2><div class="mu" style="margin-bottom:8px">Team xT and xG are sums of player values from the provider.</div>'+
  tbl([['Team'],['Matches',1],['Players',1],['xT',1],['xG',1]],r.rows.map(x=>[esc(x.club),x.matches,x.players,f(x.xt),f(x.xg)]))},
 async matches(el){
  const r=await api('/api/matches');
  el.innerHTML='<h2>Matches</h2>'+tbl([['Date'],['Match'],['Data']],r.rows.map(m=>[esc(m.date.slice(0,10)),mlink(m),tag(m.status)]))},
 async match(el,id){
  const r=await api('/api/match/'+encodeURIComponent(id));if(!r.match){el.innerHTML='<div class="empty">Match not found.</div>';return}
  const m=r.match;
  el.innerHTML=`<h2>${esc(m.home)} ${esc(m.score)} ${esc(m.away)}</h2><div class="mu">${esc(m.date)} ${tag(m.status)}</div><h3>Player metrics</h3>`+
  tbl([['Player'],['Club'],['Pos'],['Min',1],['xT',1],['xG',1],['xG faced',1]],r.rows.map(x=>[esc(x.player),esc(x.club),x.pos||'N/A',x.minutes==null?'N/A':Math.round(x.minutes),f(x.xt),f(x.xg),f(x.xg_faced)]))+
  `<h3>Other tabs</h3><div class="empty">Lineups, shot map, heatmaps, passing network and events: ${tag('ni')}</div>`},
 async player(el,arg){
  const [key,club]=decodeURIComponent(arg).split('||');
  const r=await api('/api/player?key='+encodeURIComponent(key)+'&club='+encodeURIComponent(club));
  if(!r.rows.length){el.innerHTML='<div class="empty">Player not found.</div>';return}
  const L=r.rows.map(x=>x.date.slice(0,10)+' '+x.home+' '+x.score+' '+x.away);
  el.innerHTML=`<h2>${esc(r.rows[0].player)}</h2><div class="mu">${esc(club)} · ${r.rows[0].pos||'position N/A'}</div>
  <div class="card">${bars(r.rows.map(x=>x.xt),L,'xT')}</div><div class="card">${bars(r.rows.map(x=>x.xg),L,'xG')}</div>
  <h3>Match by match</h3>`+tbl([['Date'],['Match'],['Min',1],['xT',1],['xG',1]],r.rows.map(x=>[esc(x.date.slice(0,10)),mlink(x),x.minutes==null?'N/A':Math.round(x.minutes),f(x.xt),f(x.xg)]))+
  `<h3>Other sections</h3><div class="empty">Shot map, heatmap, passing involvement, radar: ${tag('ni')}</div>`},
 async compare(el){
  el.innerHTML='<h2>Compare</h2>';
  if(!CMP.length){el.innerHTML+='<div class="empty">Open Players and press + next to 2 or more players.</div>';return}
  const r=await api('/api/rankings?metric=xt&limit=100000');
  const rows=CMP.map(k=>r.rows.find(x=>encodeURIComponent(x.key+'||'+x.club)===k)).filter(Boolean);
  const M=[['Team','club'],['Position','pos'],['Games','games'],['Minutes','minutes'],['xT','xt'],['xT/90','xt90'],['xG','xg'],['xG/90','xg90']];
  el.innerHTML+=`<div class="wrap"><table><tr><th></th>${rows.map(x=>`<th>${esc(x.player)}</th>`).join('')}</tr>${M.map(([n,k])=>`<tr><td class="mu">${n}</td>${rows.map(x=>`<td>${k==='club'||k==='pos'?esc(x[k]||'N/A'):k==='games'||k==='minutes'?(x[k]==null?'N/A':Math.round(x[k])):f(x[k])}</td>`).join('')}</tr>`).join('')}</table></div>
  <p class="mu">N/A means the provider gave no value. It is never shown as zero.</p><button class="s" onclick="CMP=[];route()">Clear list</button>`},
 async settings(el){
  el.innerHTML=`<h2>Settings</h2>
  <div class="card"><h3>Leagues</h3>${tbl([['League'],['Country'],['Matches',1],['Analysed',1]],ALL.leagues.map(l=>[esc(l.name),esc(l.country||''),l.matches??'',l.ok??'']))}
  <div class="mu" style="margin-top:8px">Data updated (UTC): ${esc(ALL.generated||'N/A')}</div></div>
  <div class="card"><h3>Synchronize</h3>
  <p class="mu">Fetches new matches from PitchAPI and refreshes this site. It also runs automatically on a schedule.</p>
  <div class="ctl"><input id="ghrepo" value="${esc(GH_REPO())}" placeholder="owner/repo" style="flex:1;min-width:180px"></div>
  <div class="ctl"><input id="ghtok" type="password" placeholder="GitHub token (kept on this device only)" value="${ghTok()?'••••••••':''}" style="flex:1;min-width:180px"><button class="s" id="svtok">Save</button><button class="s" id="cltok">Clear</button></div>
  <p class="mu" style="font-size:12px">Create a fine-grained token for this repository only, with the permission Actions: Read and write. It is stored in this browser and only sent to GitHub.</p>
  <div class="ctl"><button id="sy">Synchronize now</button><button class="s" id="rl">Reload data</button></div><div id="ss" class="mu"></div></div>`;
  const msg=t=>{const e=$('#ss');if(e)e.textContent=t};
  const repo=()=>((($('#ghrepo')||{}).value)||GH_REPO()).trim();
  $('#svtok').onclick=()=>{try{const v=$('#ghtok').value.trim();if(v&&!v.startsWith('•'))localStorage.setItem('gh_token',v);localStorage.setItem('gh_repo',repo());msg('Saved on this device.')}catch(e){msg('Could not save: '+e.message)}};
  $('#cltok').onclick=()=>{try{localStorage.removeItem('gh_token')}catch(e){}$('#ghtok').value='';msg('Token removed from this device.')};
  const showRun=async(follow)=>{
   const r=await ghApi(`/repos/${repo()}/actions/workflows/sync.yml/runs?per_page=1`);
   if(!r.ok){msg('Could not read sync status (HTTP '+r.status+').');return}
   const run=((await r.json()).workflow_runs||[])[0];
   if(!run){msg('No sync has run yet.');return}
   const when=(run.created_at||'').replace('T',' ').replace('Z',' UTC');
   if(run.status!=='completed'){msg('Sync running ('+run.status+') · started '+when);if(follow&&$('#ss'))setTimeout(()=>showRun(true),15000);return}
   msg(run.conclusion==='success'?'Last sync finished OK · '+when+'. If you just ran it, wait about a minute, then press Reload data.':'Last sync '+run.conclusion+' · '+when+'. Open the Actions tab of the repository to see why.');
  };
  $('#sy').onclick=async()=>{
   if(!ghTok()){msg('Save a GitHub token first.');return}
   $('#sy').disabled=true;
   try{
    const info=await (await ghApi('/repos/'+repo())).json();
    const r=await ghApi(`/repos/${repo()}/actions/workflows/sync.yml/dispatches`,{method:'POST',body:JSON.stringify({ref:info.default_branch||'main'})});
    if(r.status===204){msg('Sync started…');setTimeout(()=>showRun(true),4000)}
    else if(r.status===404)msg('Not found (404): check the repository name, or the token has no access to it.');
    else if(r.status===403||r.status===401)msg('Token not allowed ('+r.status+'): it needs Actions: Read and write on this repository.');
    else msg('GitHub answered '+r.status+'.');
   }catch(e){msg('Failed: '+e.message)}
   $('#sy').disabled=false};
  $('#rl').onclick=async()=>{try{msg('Reloading…');await reloadData();msg('Data reloaded.')}catch(e){msg('Reload failed: '+e.message)}};
  showRun(false);
 },
 async data(el){
  const r=await api('/api/availability');
  el.innerHTML=`<h2>Data Availability</h2><div class="mu" style="margin-bottom:8px">Stable player ID found on ${r.id_pct==null?'N/A':r.id_pct.toFixed(0)+'%'} of player rows. Rows without an ID are matched by name.</div>`+
  tbl([['Date'],['Match'],['Sync'],['xT'],['xG'],['Minutes'],['Shots'],['Heatmap'],['Passing network'],['Lineups']],
   r.rows.map(m=>[esc(m.date.slice(0,10)),esc(m.home+' v '+m.away),tag(m.status),tag(m.xt),tag(m.xg),tag(m.mi),tag('ni'),tag('ni'),tag('ni'),tag('ni')]))}
};
async function route(){
 const [,pg='overview',arg='']=(location.hash||'#/overview').split('/');
 $('#nav').innerHTML=PAGES.map(([k,n])=>`<a href="#/${k}" class="${k===pg||(pg==='match'&&k==='matches')||(pg==='player'&&k==='players')?'on':''}">${n}</a>`).join('');
 const el=$('#app');el.innerHTML='<div class="empty">Loading…</div>';
 try{
  if(PLAN[pg]){const p=PLAN[pg];el.innerHTML=`<h2>${p[0]}</h2><div class="card">${tag('ni')}<p>${p[1]}</p><p class="mu">${p[2]} Nothing is drawn until real data is connected.</p></div>`;return}
  await (R[pg]||R.overview)(el,arg)
 }catch(e){el.innerHTML=`<div class="empty">Could not load this page: ${esc(e.message)}</div>`}}

/* ---------- التشغيل ---------- */
(async()=>{
 try{
  const r=await fetch('data/index.json?'+Date.now());
  if(!r.ok)throw new Error('data/index.json not found (HTTP '+r.status+')');
  ALL=await r.json();
  if(!ALL.leagues||!ALL.leagues.length)throw new Error('no leagues in index.json');
  let saved=null;try{saved=localStorage.getItem('league')}catch(e){}
  await setLeague(saved||ALL.leagues[0].id);head();
  window.onhashchange=route;route();
 }catch(e){
  $('#lg').textContent='';
  $('#app').innerHTML=`<div class="empty">No data yet. Run the Colab cell once (it starts the first sync), then reload this page.<br><span class="mu">${esc(e.message)}</span></div>`}
})();
</script></body></html>"""

# ===== نهاية الجزء 2 من 5 — كمّل الصق الجزء 3 تحت هذا السطر مباشرة =====
# ---------------- التشغيل ----------------
def get_secret(name, prompt):
    v = os.environ.get(name)
    if not v:
        try:
            from google.colab import userdata
            v = userdata.get(name)
        except Exception:
            v = None
    v = v or getpass(prompt)
    return v.strip().strip("'\"").strip()


def check_pitch_key(k):
    if not k:
        raise SetupError("مفتاح PitchAPI فاضي.")
    if k.startswith(("ghp_", "github_pat_", "gho_")):
        raise SetupError("اللي حطيته في خانة PitchAPI هو توكن GitHub مو مفتاح PitchAPI. "
                         "المفتاح الأول PitchAPI والثاني GitHub.")


def run_pipeline(hub, pit_key):
    """يحدد الدوريات، يرجّع المحفوظ، يجلب الجديد، وينشر. ترجع True إذا نجح النشر."""
    with PitchAPI(api_key=pit_key) as client:
        metas = resolve_leagues(client)
        if not metas:
            log("ما لقيت أي دوري. شغّل LIST_LEAGUES = True وحط الـIDs في EXTRA_LEAGUE_IDS.")
            return False
        n = gh_restore(hub, metas)
        if n:
            log(f"تم تحميل بيانات {n} دوري من GitHub (المزامنة تراكمية).")
        for meta in metas:
            log("\n" + "=" * 55 + f"\n{meta['name']}")
            sync_league(client, meta["id"], on_progress=lambda: publish(hub, metas))
            publish(hub, metas)      # ينشر كل دوري فور ما يخلص
    return publish(hub, metas, final=True)


def finish_pages(hub):
    log("جاري التأكد أن الموقع انبنى (قد ياخذ دقيقة أو دقيقتين)...")
    url, status = gh_pages_status(hub)
    if url is None:
        log("Pages غير مفعّل بعد، ولهذا الرابط يعطي 404. فعّله من:")
        log(f"  https://github.com/{hub['repo']}/settings/pages")
        log(f"  Source: Deploy from a branch ← Branch: {hub['branch']} / (root) ← Save")
        return
    hub["url"] = url
    if status == "built":
        log("الموقع جاهز ✔")
    elif status == "errored":
        log("GitHub فشل في بناء الموقع: افتح Settings ← Pages وشوف الخطأ.")
    else:
        log("الموقع قيد البناء. جرّب الرابط بعد دقيقة (404 مؤقتة طبيعية في أول مرة).")
    if status != "errored":
        log("أختبر الرابط فعلياً...")
        if probe_site(hub["url"]):
            log("الرابط يفتح فعلاً ✔")
        else:
            log("الرابط لسا يعطي 404. انتظر دقيقتين وجرّب، وإذا بقي:")
            log(f"  افتح https://github.com/{hub['repo']}/settings/pages")
            log(f"  Source: Deploy from a branch ← Branch: {hub['branch']} / (root) ← Save")
    log("\nافتح هذا الرابط كاملاً (مع اسم المستودع في الآخر):")
    log(hub["url"])


def main_actions():
    """يشتغل داخل GitHub Actions (زر Synchronize أو الجدولة)."""
    pit_key = os.environ.get("PITCHAPI_KEY", "").strip().strip("'\"")
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    try:
        check_pitch_key(pit_key)
        r = requests.get(f"{GH}/repos/{repo}", headers=gh_headers(token), timeout=30)
        branch = r.json().get("default_branch", "main") if r.status_code == 200 else "main"
        hub = dict(token=token, repo=repo, branch=branch, pages=True, url="")
        init_db()
        ok = run_pipeline(hub, pit_key)
    except SetupError as e:
        log(e)
        sys.exit(1)
    if not ok:
        sys.exit(1)


def main():
    if os.environ.get("GITHUB_ACTIONS") == "true":
        return main_actions()

    pit_key = get_secret("PITCHAPI_KEY", "PitchAPI key: ")
    try:
        check_pitch_key(pit_key)
    except SetupError as e:
        log(e)
        return
    init_db()

    if LIST_LEAGUES:
        with PitchAPI(api_key=pit_key) as client:
            res, err = call(client.leagues.list)
            if err == "auth":
                log(AUTH_HELP)
                return
            items = list(getattr(res, "leagues", None) or res or [])
            for lg in items:
                log(f"{lg.name}  -  {txt(getattr(lg, 'country', None))}  [{lg.id}]")
            if not items:
                log("لا توجد دوريات:", err)
        return

    gh_token = get_secret("GITHUB_TOKEN", "GitHub token: ")
    try:
        hub = gh_setup(gh_token, REPO_NAME)
    except SetupError as e:
        log(e)
        return
    log("رابط الموقع:", hub["url"])

    try:
        automation = SETUP_AUTOMATION and setup_automation(hub, pit_key)
        if automation and not COLAB_DOES_SYNC:
            gh_enable_pages(hub)
            if gh_dispatch(hub):
                log("\nبدأت أول مزامنة على GitHub (تشتغل بالخلفية، وتقدر تقفل Colab).")
                log(f"  تابع التقدم: https://github.com/{hub['repo']}/actions")
                log(f"  الموقع (يظهر بعد أول نشر، وفيه صفحة Settings فيها زر Synchronize): {hub['url']}")
                return
            log("سأكمل المزامنة من Colab...")
        log("\n" + "=" * 55)
        ok = run_pipeline(hub, pit_key)
    except SetupError as e:
        log(e)
        return
    log("\n" + "=" * 55)
    if not ok:
        log("النشر فشل. اقرأ رسالة الخطأ أعلاه (فيها الحل)، ثم أعد التشغيل.")
        return
    finish_pages(hub)


# ============================================================================
# إضافة (ADD-ON): PPDA + شبكة التمريرات (Passing) + خريطة الحرارة (Heatmaps)
# الصق هذه الكتلة كما هي في آخر الملف، قبل السطرين:
#     if __name__ == "__main__":
#         main()
# ما تغيّر أي سطر من كودك الأصلي: الإضافة تلفّ دوال موجودة (تستدعيها كما هي) وتضيف فوقها.
# ============================================================================
PROBE = False   # True = يطبع شكل ردود PitchAPI الحقيقية لمباراة واحدة ثم يتوقف (للتأكد من أسماء الحقول)
EXTRA_INDEX = {}                 # يُملأ عند النشر: أسماء ملفات الإضافة لكل دوري (تدخل في data/index.json)
_XGRID = {"l": 16, "w": 12}      # أبعاد شبكة الحرارة (PitchAPI: 16 × 12)


def _g(o, *names):
    """أول قيمة موجودة (attribute أو مفتاح dict) من الأسماء المعطاة، أو None."""
    for n in names:
        if o is None:
            return None
        v = o.get(n) if isinstance(o, dict) else getattr(o, n, None)
        if v is not None:
            return v
    return None


# ---------------- قاعدة البيانات: جداول جديدة فقط (لا نلمس الجداول القديمة) ----------------
_orig_init_db = init_db

def init_db():
    _orig_init_db()
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS extras(
      league_id TEXT, match_id TEXT, status TEXT, fetched_at TEXT,
      PRIMARY KEY(league_id, match_id));
    CREATE TABLE IF NOT EXISTS team_adv(
      league_id TEXT, match_id TEXT, team_id TEXT, team TEXT, side TEXT,
      ppda REAL, opp REAL, da REAL, ch REAL, zone REAL, tk REAL, ic REAL,
      PRIMARY KEY(league_id, match_id, team_id));
    CREATE TABLE IF NOT EXISTS pass_stats(
      league_id TEXT, match_id TEXT, player_id TEXT, player TEXT, team_id TEXT,
      minutes REAL, passes REAL, acc REAL, prog REAL, prog_dist REAL, box REAL,
      kp REAL, assists REAL, thru REAL, crs REAL, sw REAL,
      PRIMARY KEY(league_id, match_id, player_id));
    CREATE TABLE IF NOT EXISTS net(
      league_id TEXT, match_id TEXT, team_id TEXT, team TEXT, side TEXT,
      until_s REAL, central REAL, nodes TEXT, edges TEXT,
      PRIMARY KEY(league_id, match_id, team_id));
    CREATE TABLE IF NOT EXISTS heat(
      league_id TEXT, match_id TEXT, kind TEXT, pkey TEXT, name TEXT, club TEXT,
      side TEXT, actions REAL, cells TEXT,
      PRIMARY KEY(league_id, match_id, kind, pkey));
    CREATE TABLE IF NOT EXISTS pm(
      league_id TEXT, match_id TEXT, status TEXT, fetched_at TEXT,
      PRIMARY KEY(league_id, match_id));
    CREATE TABLE IF NOT EXISTS pl_adv(
      league_id TEXT, match_id TEXT, player_id TEXT, player TEXT, team_id TEXT, minutes REAL,
      ps REAL, pr REAL, bx REAL, kp REAL, ast REAL, tb REAL, cr REAL,
      ca REAL, pc REAL, cb REAL, tko REAL, tkw REAL,
      sca REAL, gca REAL, xag REAL, xgc REAL, xgb REAL,
      tk REAL, ic REAL, bl REAL, cl REAL, duw REAL, aer REAL, aerw REAL,
      xt REAL, vaep REAL, sh REAL, sot REAL, xg REAL, npxg REAL, gl REAL,
      PRIMARY KEY(league_id, match_id, player_id));
    CREATE TABLE IF NOT EXISTS team_def(
      league_id TEXT, match_id TEXT, team_id TEXT, team TEXT, side TEXT,
      hto REAL, cpr REAL, brt REAL, adx REAL, blk REAL, clr REAL, duw REAL, aer REAL, aerw REAL, tilt REAL,
      PRIMARY KEY(league_id, match_id, team_id));
    """)
    c.commit()
    c.close()


# ---------------- استخراج البيانات من ردود PitchAPI ----------------
def _x_teams(r, adv):
    """PPDA وما يلزمه لكل فريق (مباشرة من advanced، بدون أي حساب من عندنا)."""
    out = []
    for idx, t in enumerate(_g(adv, "teams") or []):
        team = _g(t, "team")
        name = _g(team, "name") or ""
        side = "home" if name == r["home"] else ("away" if name == r["away"] else ("home" if idx == 0 else "away"))
        d = _g(t, "defending")
        zone = num(_g(d, "press_zone_fraction"))
        if zone is None:
            zone = num(_g(t, "press_zone_fraction"))
        out.append(dict(tid=str(_g(team, "id") or name), team=name, side=side,
                        ppda=num(_g(d, "ppda")), opp=num(_g(d, "opponent_passes")),
                        da=num(_g(d, "defensive_actions")), ch=num(_g(d, "challenges")),
                        zone=zone, tk=num(_g(d, "tackles")), ic=num(_g(d, "interceptions"))))
    return out


def _x_pass(res):
    """عدّادات التمرير لكل لاعب (progressive / key / through / crosses ...)."""
    out = []
    for p in _g(res, "players") or []:
        pl = _g(p, "player")
        i = _g(pl, "id")
        ps = _g(p, "passing")
        if not i or ps is None or num(_g(ps, "passes")) is None:
            continue
        out.append(dict(pid=str(i), name=_g(pl, "name") or "Unknown player", tid=str(_g(p, "team_id") or ""),
                        mi=num(_g(p, "minutes_played")), ps=num(_g(ps, "passes")),
                        ac=num(_g(ps, "pass_accuracy")), pr=num(_g(ps, "progressive_passes")),
                        pd=num(_g(ps, "progressive_pass_distance")), bx=num(_g(ps, "passes_into_box")),
                        kp=num(_g(ps, "key_passes")), a=num(_g(ps, "assists")),
                        tb=num(_g(ps, "through_balls")), cr=num(_g(ps, "crosses")),
                        sw=num(_g(ps, "switches"))))
    return out


_EDGE_WARNED = []

def _x_names(o):
    import dataclasses
    if isinstance(o, dict):
        return list(o.keys())
    if dataclasses.is_dataclass(o):
        return [f.name for f in dataclasses.fields(o)]
    return [k for k in dir(o) if not k.startswith("_") and not callable(getattr(o, k, None))]

def _x_ends(e):
    """طرفا الضلع (من → إلى). الـAPI يسميهما from / to، والـSDK لازم يغيّر الاسم لأن from كلمة محجوزة."""
    a = _g(e, "from_player", "from_", "source", "frm", "from_node", "src")
    b = _g(e, "to_player", "to", "to_", "target", "dst", "to_node")
    ia = a if isinstance(a, str) else _g(a, "id")
    ib = b if isinstance(b, str) else _g(b, "id")
    if ia and ib:
        return ia, ib
    names = _x_names(e)
    fa = [n for n in names if re.match(r"^(from|src|source|frm)(_|$)", n.lower())]
    fb = [n for n in names if re.match(r"^(to|target|dst|dest|destination)(_|$)", n.lower())]
    a = _g(e, *fa) if fa else None
    b = _g(e, *fb) if fb else None
    return (a if isinstance(a, str) else _g(a, "id")), (b if isinstance(b, str) else _g(b, "id"))

def _x_net(r, res):
    """شبكة التمريرات: عقدة لكل لاعب (متوسط مكان بداية تمريراته) + ضلع لكل زوج لاعبين."""
    out = []
    for idx, t in enumerate(_g(res, "networks") or []):
        team = _g(t, "team")
        name = _g(team, "name") or ""
        side = "home" if name == r["home"] else ("away" if name == r["away"] else ("home" if idx == 0 else "away"))
        nodes = []
        for nd in _g(t, "nodes") or []:
            pl = _g(nd, "player")
            nodes.append(dict(i=str(_g(pl, "id") or ""), n=_g(pl, "name") or "",
                              x=num(_g(nd, "avg_x")), y=num(_g(nd, "avg_y")),
                              p=num(_g(nd, "passes")), r=num(_g(nd, "passes_received")),
                              d=num(_g(nd, "degree")), s=num(_g(nd, "strength")),
                              b=num(_g(nd, "betweenness")), c=num(_g(nd, "clustering"))))
        edges, es = [], _g(t, "edges") or []
        for e in es:
            ia, ib = _x_ends(e)
            if ia and ib:
                edges.append(dict(a=str(ia), b=str(ib), p=num(_g(e, "passes")) or 0))
        if es and not edges and not _EDGE_WARNED:
            _EDGE_WARNED.append(1)
            names = [f for f in dir(es[0]) if not f.startswith("_")]
            log(f"  تنبيه: ما قدرت أقرأ طرفَي الضلع في شبكة التمريرات. الحقول الموجودة: {names}")
        out.append(dict(tid=str(_g(team, "id") or name), team=name, side=side,
                        until=num(_g(_g(t, "window"), "until_seconds")),
                        central=num(_g(t, "centralization")), nodes=nodes, edges=edges))
    return out


def _x_cells(cells, gl, gw):
    flat = []
    for c in cells or []:
        try:
            if isinstance(c, (list, tuple)):
                x, y, n = c[0], c[1], c[2]
            else:
                x, y, n = _g(c, "cell_x", "x"), _g(c, "cell_y", "y"), _g(c, "actions", "count", "n")
            x, y, n = int(x), int(y), int(n)
        except Exception:
            continue
        if 0 <= x < gl and 0 <= y < gw and n > 0:
            flat += [x, y, n]
    return flat


_FRAME_WARNED = []

def _x_heat(res, frame="acting_ltr"):
    """صفوف الحرارة: فريق + لاعب. cells = [x,y,عدد, x,y,عدد, ...] على شبكة 16×12.
    frame="acting_ltr": كل فريق يهاجم نحو cell_x=15 (للاعبين والفرق).
    frame="home_ltr": فريقان فقط على ملعب مشترك (الخارج مقلوب من السيرفر)، يُحفظ باسم kind="hteam"."""
    if res is None:
        return []
    grid = _g(res, "grid")
    got = _g(grid, "frame")
    if got and got != frame:
        log(f"  تنبيه: heatmaps رجّع frame={got} بدل {frame} — تجاهلته حتى ما تنعرض الاتجاهات غلط")
        return []
    if not got and not _FRAME_WARNED:
        _FRAME_WARNED.append(1)
        log("  تنبيه: رد heatmaps ما فيه grid.frame — افترضت أنه acting_ltr (الافتراضي في التوثيق)")
    gl = int(num(_g(grid, "length")) or _XGRID["l"])
    gw = int(num(_g(grid, "width")) or _XGRID["w"])
    _XGRID["l"], _XGRID["w"] = gl, gw
    out = []
    for t in _g(res, "teams") or []:
        team = _g(t, "team")
        cells = _x_cells(_g(t, "cells"), gl, gw)
        if cells:
            out.append(dict(kind="team" if frame == "acting_ltr" else "hteam", key=str(_g(team, "id") or _g(team, "name") or ""),
                            name=_g(team, "name") or "", club=_g(team, "name") or "",
                            side=_g(t, "side"), actions=num(_g(t, "actions")), cells=cells))
    for p in (_g(res, "players") or []) if frame == "acting_ltr" else []:
        pl = _g(p, "player")
        i = _g(pl, "id")
        cells = _x_cells(_g(p, "cells"), gl, gw)
        if i and cells:
            out.append(dict(kind="player", key=str(i), name=_g(pl, "name") or "Unknown player",
                            club=_g(_g(p, "team"), "name") or "", side=_g(p, "side"),
                            actions=num(_g(p, "actions")), cells=cells))
    return out


# ---------------- المزامنة الإضافية (تشتغل بعد المزامنة الأصلية لكل دوري) ----------------
def sync_extras(client, league_id, on_progress=None):
    api_m = client.matches
    has_heat = hasattr(api_m, "heatmaps")
    if not has_heat:
        log("  تنبيه: نسخة pitchapi عندك قديمة وما فيها heatmaps. شغّل: pip install -U pitchapi (الحرارة تتخطى مؤقتاً)")
    rows = q("SELECT m.match_id, m.date, m.home, m.away, e.status, e.fetched_at FROM matches m "
             "LEFT JOIN extras e ON e.league_id=m.league_id AND e.match_id=m.match_id "
             "WHERE m.league_id=?", (league_id,))
    todo = [r for r in rows if match_due(r)]
    n_ok = sum(1 for r in rows if r["status"] == "ok")
    log(f"  [إضافي: PPDA/شبكة/حرارة] مكتملة سابقاً: {n_ok} | المطلوب الآن: {len(todo)}")
    hard = lambda e: e and e not in ("not_found", "plan")
    for i, r in enumerate(todo, 1):
        mid = r["match_id"]
        adv, e1 = call(api_m.advanced, mid)
        pls, e2 = call(api_m.advanced_players, mid)
        net, e3 = call(api_m.advanced_network, mid)
        hm, e4 = call(api_m.heatmaps, mid) if has_heat else (None, "sdk")
        parts = dict(team=_x_teams(r, adv) if adv is not None else [],
                     pas=_x_pass(pls) if pls is not None else [],
                     net=_x_net(r, net) if net is not None else [],
                     heat=_x_heat(hm))
        errs = (e1, e2, e3, e4)
        got = sum(1 for v in parts.values() if v)
        for nm_, data, e in (("advanced", adv, e1), ("advanced_players", pls, e2),
                             ("advanced_network", net, e3), ("heatmaps", hm, e4)):
            key = {"advanced": "team", "advanced_players": "pas", "advanced_network": "net", "heatmaps": "heat"}[nm_]
            if data is not None and not parts[key]:
                log(f"    تنبيه: {nm_} رجّع رد لكن ما طلع منه صفوف (شكل الرد يختلف عن المتوقع؟)")
        if got == 0:
            status = "failed" if any(hard(e) for e in errs) else "no_data"
        elif got == 4 and all(e is None for e in errs):
            status = "ok"
        else:
            status = "partial"
        t = now()
        c = db()
        L = league_id
        if parts["team"]:
            c.execute("DELETE FROM team_adv WHERE league_id=? AND match_id=?", (L, mid))
            c.executemany("INSERT OR REPLACE INTO team_adv VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                          [(L, mid, x["tid"], x["team"], x["side"], x["ppda"], x["opp"], x["da"], x["ch"],
                            x["zone"], x["tk"], x["ic"]) for x in parts["team"]])
        if parts["pas"]:
            c.execute("DELETE FROM pass_stats WHERE league_id=? AND match_id=?", (L, mid))
            c.executemany("INSERT OR REPLACE INTO pass_stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          [(L, mid, x["pid"], x["name"], x["tid"], x["mi"], x["ps"], x["ac"], x["pr"], x["pd"],
                            x["bx"], x["kp"], x["a"], x["tb"], x["cr"], x["sw"]) for x in parts["pas"]])
        if parts["net"]:
            c.execute("DELETE FROM net WHERE league_id=? AND match_id=?", (L, mid))
            c.executemany("INSERT OR REPLACE INTO net VALUES(?,?,?,?,?,?,?,?,?)",
                          [(L, mid, x["tid"], x["team"], x["side"], x["until"], x["central"],
                            json.dumps(x["nodes"], ensure_ascii=False), json.dumps(x["edges"], ensure_ascii=False))
                           for x in parts["net"]])
        if parts["heat"]:
            c.execute("DELETE FROM heat WHERE league_id=? AND match_id=?", (L, mid))
            c.executemany("INSERT OR REPLACE INTO heat VALUES(?,?,?,?,?,?,?,?,?)",
                          [(L, mid, x["kind"], x["key"], x["name"], x["club"], x["side"], x["actions"],
                            json.dumps(x["cells"])) for x in parts["heat"]])
        c.execute("INSERT OR REPLACE INTO extras VALUES(?,?,?,?)", (L, mid, status, t))
        c.commit()
        c.close()
        log(f"  [{i}/{len(todo)}] {r['home']} vs {r['away']} -> {status} "
            f"(ppda {len(parts['team'])} | pass {len(parts['pas'])} | net {len(parts['net'])} | heat {len(parts['heat'])})")
        if on_progress and i % PUBLISH_EVERY == 0 and i < len(todo):
            on_progress()
        time.sleep(REQUEST_DELAY)


def sync_home_frame(client, league_id):
    """يجلب شبكة الفريقين على ملعب مشترك (frame=home_ltr) للمباريات اللي ما عندها (يشمل المباريات القديمة)."""
    api_m = client.matches
    if not hasattr(api_m, "heatmaps"):
        return
    todo = q("SELECT DISTINCT h.match_id FROM heat h WHERE h.league_id=? AND h.kind='team' AND NOT EXISTS "
             "(SELECT 1 FROM heat x WHERE x.league_id=h.league_id AND x.match_id=h.match_id AND x.kind='hteam') "
             "ORDER BY h.match_id", (league_id,))
    if not todo:
        return
    log(f"  [إضافي: حرارة الفريقين على ملعب مشترك] المطلوب: {len(todo)}")
    for i, r in enumerate(todo, 1):
        mid = r["match_id"]
        hm, e = call(api_m.heatmaps, mid, "home_ltr")
        if hm is None:
            if e and e not in ("not_found", "plan"):
                log(f"    توقفت ({e}) — تكمل في المزامنة القادمة")
                return
            continue
        got = _g(_g(hm, "grid"), "frame")
        if got != "home_ltr":
            log(f"    تنبيه: طلبت frame=home_ltr ورجع {got} — ما حفظت شي (الإصدار أو المعامل غلط)")
            return
        rows = _x_heat(hm, "home_ltr")
        if not rows:
            continue
        c = db()
        c.executemany("INSERT OR REPLACE INTO heat VALUES(?,?,?,?,?,?,?,?,?)",
                      [(league_id, mid, x["kind"], x["key"], x["name"], x["club"], x["side"], x["actions"],
                        json.dumps(x["cells"])) for x in rows])
        c.commit()
        c.close()
        time.sleep(REQUEST_DELAY)


# ---------------- الدفاع + "لاعبين يشبهون بعض": إحصائيات اللاعب الكاملة (advanced/players + shots) ----------------
# (اسم العمود, المجموعة في الرد, الحقل) — كلها حقول موثقة في advanced/players
_PL_F = [("ps", "passing", "passes"), ("pr", "passing", "progressive_passes"), ("bx", "passing", "passes_into_box"),
         ("kp", "passing", "key_passes"), ("ast", "passing", "assists"), ("tb", "passing", "through_balls"),
         ("cr", "passing", "crosses"),
         ("ca", "carrying", "carries"), ("pc", "carrying", "progressive_carries"),
         ("cb", "carrying", "carries_into_box"), ("tko", "carrying", "take_ons"), ("tkw", "carrying", "take_ons_won"),
         ("sca", "creation", "sca"), ("gca", "creation", "gca"), ("xag", "creation", "xag"),
         ("xgc", "creation", "xg_chain"), ("xgb", "creation", "xg_buildup"),
         ("tk", "defending", "tackles"), ("ic", "defending", "interceptions"), ("bl", "defending", "blocks"),
         ("cl", "defending", "clearances"), ("duw", "defending", "duels_won"), ("aer", "defending", "aerials"),
         ("aerw", "defending", "aerials_won"),
         ("xt", "possession_value", "xt_total"), ("vaep", "possession_value", "vaep_total")]
_PL_S = ["sh", "sot", "xg", "npxg", "gl"]        # من shots: تسديدات، على المرمى (علم المزود)، xG، xG بدون ركلات جزاء، أهداف
_PL_COLS = [c for c, _, _ in _PL_F] + _PL_S
_TD_F = [("hto", "defending", "high_turnovers"), ("cpr", "defending", "counterpress_regains_5s"),
         ("brt", "defending", "ball_recovery_time"), ("adx", "defending", "avg_defensive_action_x"),
         ("blk", "defending", "blocks"), ("clr", "defending", "clearances"), ("duw", "defending", "duels_won"),
         ("aer", "defending", "aerials"), ("aerw", "defending", "aerials_won"), ("tilt", "territory", "field_tilt")]
_TD_COLS = [c for c, _, _ in _TD_F]


def _x_plrows(res):
    out = []
    for p in _g(res, "players") or []:
        pl = _g(p, "player")
        i = _g(pl, "id")
        if not i:
            continue
        d = dict(pid=str(i), name=_g(pl, "name") or "Unknown player", tid=str(_g(p, "team_id") or ""),
                 mi=num(_g(p, "minutes_played")))
        for col, grp, fld in _PL_F:
            d[col] = num(_g(_g(p, grp), fld))
        out.append(d)
    return out


def _x_shots(res):
    """لكل لاعب: تسديدات / على المرمى / xG / xG بدون جزاء / أهداف. الأهداف العكسية تُستبعد (ما هي تسديدة للاعب)."""
    acc = {}
    for per in _g(res, "periods") or []:
        for s in _g(per, "shots") or []:
            if _g(s, "is_own_goal"):
                continue
            i = _g(_g(s, "player"), "id")
            if not i:
                continue
            a = acc.setdefault(str(i), dict(sh=0, sot=0, xg=0.0, npxg=0.0, gl=0))
            xg = num(_g(s, "expected_goals")) or 0.0
            a["sh"] += 1
            if _g(s, "is_on_target"):
                a["sot"] += 1
            a["xg"] += xg
            if str(_g(s, "situation")).split(".")[-1] != "Penalty":
                a["npxg"] += xg
            if str(_g(s, "event_type")).split(".")[-1] == "Goal":
                a["gl"] += 1
    return acc

# ===== نهاية الجزء 3 من 5 — كمّل الصق الجزء 4 تحت هذا السطر مباشرة =====
def _x_teamdef(r, adv):
    out = []
    for idx, t in enumerate(_g(adv, "teams") or []):
        team = _g(t, "team")
        name = _g(team, "name") or ""
        side = "home" if name == r["home"] else ("away" if name == r["away"] else ("home" if idx == 0 else "away"))
        row = dict(tid=str(_g(team, "id") or name), team=name, side=side)
        for col, grp, fld in _TD_F:
            row[col] = num(_g(_g(t, grp), fld))
        out.append(row)
    return out


_PL_SQL = ("INSERT OR REPLACE INTO pl_adv(league_id,match_id,player_id,player,team_id,minutes,%s) VALUES(%s)"
           % (",".join(_PL_COLS), ",".join("?" * (6 + len(_PL_COLS)))))
_TD_SQL = ("INSERT OR REPLACE INTO team_def(league_id,match_id,team_id,team,side,%s) VALUES(%s)"
           % (",".join(_TD_COLS), ",".join("?" * (5 + len(_TD_COLS)))))


def sync_pstats(client, league_id, on_progress=None):
    """يجلب إحصائيات كل لاعب (دفاع/إبداع/تمرير/حمل + تسديدات) وإحصائيات الضغط لكل فريق. يشمل المباريات القديمة."""
    api_m = client.matches
    rows = q("SELECT m.match_id, m.date, m.home, m.away, e.status, e.fetched_at FROM matches m "
             "LEFT JOIN pm e ON e.league_id=m.league_id AND e.match_id=m.match_id "
             "WHERE m.league_id=?", (league_id,))
    todo = [r for r in rows if match_due(r)]
    log(f"  [إضافي: إحصائيات اللاعبين/الدفاع] مكتملة سابقاً: {sum(1 for r in rows if r['status'] == 'ok')} | المطلوب الآن: {len(todo)}")
    hard = lambda e: e and e not in ("not_found", "plan")
    for i, r in enumerate(todo, 1):
        mid = r["match_id"]
        adv, e1 = call(api_m.advanced, mid)
        pls, e2 = call(api_m.advanced_players, mid)
        sh, e3 = call(api_m.shots, mid) if hasattr(api_m, "shots") else (None, "sdk")
        plr = _x_plrows(pls) if pls is not None else []
        td = _x_teamdef(r, adv) if adv is not None else []
        sacc = _x_shots(sh) if sh is not None else None
        if sh is not None and (_g(sh, "periods") or []) and not sacc:
            log("    تنبيه: shots رجّع رد لكن ما طلع منه تسديدات (شكل الرد يختلف عن المتوقع؟)")
        if pls is not None and not plr:
            log("    تنبيه: advanced/players رجّع رد لكن ما طلع منه لاعبين (شكل الرد يختلف عن المتوقع؟)")
        if not plr and not td and sh is None:
            status = "failed" if any(hard(e) for e in (e1, e2, e3)) else "no_data"
        elif plr and td and sacc is not None and e1 is None and e2 is None and e3 is None:
            status = "ok"
        else:
            status = "partial"
        t = now()
        c = db()
        L = league_id
        if plr:
            c.execute("DELETE FROM pl_adv WHERE league_id=? AND match_id=?", (L, mid))
            for x in plr:
                s = sacc.get(x["pid"], dict(sh=0, sot=0, xg=0.0, npxg=0.0, gl=0)) if sacc is not None else {}
                c.execute(_PL_SQL, (L, mid, x["pid"], x["name"], x["tid"], x["mi"]) +
                          tuple(x[k] for k, _, _ in _PL_F) + tuple(s.get(k) for k in _PL_S))
        if td:
            c.execute("DELETE FROM team_def WHERE league_id=? AND match_id=?", (L, mid))
            c.executemany(_TD_SQL, [(L, mid, x["tid"], x["team"], x["side"]) + tuple(x[k] for k in _TD_COLS) for x in td])
        c.execute("INSERT OR REPLACE INTO pm VALUES(?,?,?,?)", (L, mid, status, t))
        c.commit()
        c.close()
        log(f"  [{i}/{len(todo)}] {r['home']} vs {r['away']} -> {status} (لاعبين {len(plr)} | فرق {len(td)} | "
            f"تسديدات {'-' if sacc is None else sum(v['sh'] for v in sacc.values())})")
        if on_progress and i % PUBLISH_EVERY == 0 and i < len(todo):
            on_progress()
        time.sleep(REQUEST_DELAY)


def build_pl_payload(L):
    gl_ = _XGRID["l"]
    heat = {}
    for r in q("SELECT match_id m, pkey k, cells FROM heat WHERE league_id=? AND kind='player'", (L,)):
        c = json.loads(r["cells"])
        tot = opp = 0
        for j in range(0, len(c) - 2, 3):
            tot += c[j + 2]
            if c[j] >= gl_ // 2:
                opp += c[j + 2]
        heat[(r["m"], r["k"])] = (tot, opp)
    cols = ["m", "i", "n", "t", "c", "o", "mi"] + _PL_COLS + ["act", "aco"]
    rows = []
    for r in q("SELECT p.match_id m, p.player_id i, p.player n, p.team_id t, COALESCE(a.team, p.team_id) c, "
               "(SELECT s.pos FROM stats s WHERE s.league_id=p.league_id AND s.match_id=p.match_id "
               "AND s.player_id=p.player_id) o, p.minutes mi, " + ",".join("p." + c for c in _PL_COLS) +
               " FROM pl_adv p LEFT JOIN team_adv a ON a.league_id=p.league_id AND a.match_id=p.match_id "
               "AND a.team_id=p.team_id WHERE p.league_id=? ORDER BY p.match_id, p.team_id, p.player_id", (L,)):
        h = heat.get((r["m"], r["i"]), (None, None))
        row = [r[k] if k in r else None for k in cols[:-2]] + [h[0], h[1]]
        rows.append([round(v, 3) if isinstance(v, float) else v for v in row])
    team = [_x_round(r, _TD_COLS) for r in q(
        "SELECT match_id m, team_id i, team n, side s, " + ",".join(_TD_COLS) +
        " FROM team_def WHERE league_id=? ORDER BY match_id, side, team_id", (L,))]
    pm = q("SELECT match_id i, status t, fetched_at f FROM pm WHERE league_id=? ORDER BY match_id", (L,))
    return dict(cols=cols, rows=rows, team=team, pm=pm)


def restore_pl(L, d):
    c = db()
    for e in d.get("pm", []):
        c.execute("INSERT OR REPLACE INTO pm VALUES(?,?,?,?)", (L, e["i"], e["t"], e.get("f")))
    cols = d.get("cols", [])
    for row in d.get("rows", []):
        x = dict(zip(cols, row))
        c.execute(_PL_SQL, (L, x["m"], x["i"], x["n"], x["t"], x["mi"]) + tuple(x.get(k) for k in _PL_COLS))
    for x in d.get("team", []):
        c.execute(_TD_SQL, (L, x["m"], x["i"], x["n"], x["s"]) + tuple(x.get(k) for k in _TD_COLS))
    c.commit()
    c.close()


_orig_sync_league = sync_league

def sync_league(client, league_id, on_progress=None):
    ok = _orig_sync_league(client, league_id, on_progress)
    if ok:
        try:
            sync_extras(client, league_id, on_progress)
            sync_home_frame(client, league_id)
            sync_pstats(client, league_id, on_progress)
        except Exception as e:      # أي خطأ في الإضافة ما يوقف المزامنة الأصلية
            log(f"  خطأ في المزامنة الإضافية ({type(e).__name__}: {e}) — المزامنة الأصلية ما تأثرت.")
    return ok


# ---------------- التصدير (ملفات منفصلة، ما نلمس ملفات الدوريات الأصلية) ----------------
def _x_round(d, keys):
    for k in keys:
        if d.get(k) is not None:
            d[k] = round(d[k], 4)
    return d


def build_adv_payload(L):
    ex = q("SELECT e.match_id i, e.status t, e.fetched_at f, "
           "(SELECT COUNT(*) FROM team_adv a WHERE a.league_id=e.league_id AND a.match_id=e.match_id) p, "
           "(SELECT COUNT(*) FROM heat h WHERE h.league_id=e.league_id AND h.match_id=e.match_id) h, "
           "(SELECT COUNT(*) FROM net n WHERE n.league_id=e.league_id AND n.match_id=e.match_id) n, "
           "(SELECT COUNT(*) FROM pass_stats s WHERE s.league_id=e.league_id AND s.match_id=e.match_id) k "
           "FROM extras e WHERE e.league_id=? ORDER BY e.match_id", (L,))
    team = [_x_round(r, ("pp", "op", "da", "ch", "z", "tk", "ic")) for r in q(
        "SELECT match_id m, team_id i, team n, side s, ppda pp, opp op, da, ch, zone z, tk, ic "
        "FROM team_adv WHERE league_id=? ORDER BY match_id, side, team_id", (L,))]
    pas = [_x_round(r, ("mi", "ps", "ac", "pr", "pd", "bx", "kp", "as", "tb", "cr", "sw")) for r in q(
        "SELECT match_id m, player_id i, player n, team_id t, minutes mi, passes ps, acc ac, prog pr, "
        "prog_dist pd, box bx, kp, assists \"as\", thru tb, crs cr, sw "
        "FROM pass_stats WHERE league_id=? ORDER BY match_id, team_id, player_id", (L,))]
    nets = []
    for r in q("SELECT match_id m, team_id i, team n, side s, until_s u, central cn, nodes, edges "
               "FROM net WHERE league_id=? ORDER BY match_id, side, team_id", (L,)):
        r["nodes"] = [_x_round(n, ("x", "y", "b", "c")) for n in json.loads(r["nodes"])]
        r["edges"] = json.loads(r["edges"])
        nets.append(_x_round(r, ("u", "cn")))
    return {"ex": ex, "team": team, "pass": pas, "net": nets}


def build_heat_payload(L):
    rows = []
    for r in q("SELECT match_id m, kind t, pkey k, name n, club c, side s, actions a, cells h "
               "FROM heat WHERE league_id=? ORDER BY match_id, kind, pkey", (L,)):
        r["t"] = {"team": "t", "hteam": "h"}.get(r["t"], "p")
        r["h"] = json.loads(r["h"])
        rows.append(r)
    return dict(grid=dict(_XGRID), rows=rows)


def publish_extras(metas):
    for lg in metas:
        L = lg["id"]
        try:
            if not league_has_data(L) or not q("SELECT 1 FROM extras WHERE league_id=? LIMIT 1", (L,)):
                continue
            adv = build_adv_payload(L)
            blob = json.dumps(adv, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            entry = dict(adv_file=safe_name(L) + "_adv.json")
            gh_put(_x_hub, f"data/{entry['adv_file']}", blob, f"Update {lg['name']} advanced")
            last = q("SELECT MAX(fetched_at) t FROM extras WHERE league_id=?", (L,), True)["t"]
            entry["adv_v"] = last
            heat = build_heat_payload(L)
            if heat["rows"]:
                entry["heat_file"] = safe_name(L) + "_heat.json"
                gh_put(_x_hub, f"data/{entry['heat_file']}",
                       json.dumps(heat, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                       f"Update {lg['name']} heatmaps")
            pl = build_pl_payload(L)
            if pl["rows"] or pl["team"]:
                entry["pl_file"] = safe_name(L) + "_pl.json"
                gh_put(_x_hub, f"data/{entry['pl_file']}",
                       json.dumps(pl, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                       f"Update {lg['name']} players")
                entry["pl_v"] = q("SELECT MAX(fetched_at) t FROM pm WHERE league_id=?", (L,), True)["t"]
            EXTRA_INDEX[L] = entry
        except Exception as e:
            log(f"  تعذر نشر ملفات الإضافة لـ {lg.get('name')}: {e}")


_x_hub = None
_orig_publish = publish

def publish(hub, metas, final=False):
    global _x_hub
    _x_hub = hub
    publish_extras(metas)
    return _orig_publish(hub, metas, final)


_orig_gh_put = gh_put

def gh_put(hub, path, content, message):
    """نفس الدالة الأصلية، لكن data/index.json يُضاف له أسماء ملفات الإضافة قبل الرفع."""
    if path == "data/index.json" and EXTRA_INDEX:
        try:
            d = json.loads(content.decode("utf-8"))
            for lg in d.get("leagues", []):
                lg.update(EXTRA_INDEX.get(lg["id"], {}))
            content = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        except Exception as e:
            log(f"  تنبيه: ما قدرت أضيف بيانات الإضافة للفهرس: {e}")
    return _orig_gh_put(hub, path, content, message)


# ---------------- الاستعادة من GitHub (حتى لا نعيد جلب ما اكتمل) ----------------
def restore_extras(L, adv, heat):
    c = db()
    for e in (adv or {}).get("ex", []):
        c.execute("INSERT OR REPLACE INTO extras VALUES(?,?,?,?)", (L, e["i"], e["t"], e.get("f")))
    for x in (adv or {}).get("team", []):
        c.execute("INSERT OR REPLACE INTO team_adv VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                  (L, x["m"], x["i"], x["n"], x["s"], x["pp"], x["op"], x["da"], x["ch"], x["z"], x["tk"], x["ic"]))
    for x in (adv or {}).get("pass", []):
        c.execute("INSERT OR REPLACE INTO pass_stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (L, x["m"], x["i"], x["n"], x["t"], x["mi"], x["ps"], x["ac"], x["pr"], x["pd"], x["bx"],
                   x["kp"], x["as"], x["tb"], x["cr"], x["sw"]))
    for x in (adv or {}).get("net", []):
        c.execute("INSERT OR REPLACE INTO net VALUES(?,?,?,?,?,?,?,?,?)",
                  (L, x["m"], x["i"], x["n"], x["s"], x["u"], x["cn"], json.dumps(x["nodes"]), json.dumps(x["edges"])))
    for x in (heat or {}).get("rows", []):
        c.execute("INSERT OR REPLACE INTO heat VALUES(?,?,?,?,?,?,?,?,?)",
                  (L, x["m"], {"t": "team", "h": "hteam"}.get(x["t"], "player"), x["k"], x["n"], x["c"], x["s"], x["a"],
                   json.dumps(x["h"])))
    c.commit()
    c.close()
    g = (heat or {}).get("grid")
    if g:
        _XGRID.update(g)


_orig_gh_restore = gh_restore

def gh_restore(hub, metas):
    n = _orig_gh_restore(hub, metas)
    for lg in metas:
        try:
            if q("SELECT 1 FROM extras WHERE league_id=? LIMIT 1", (lg["id"],)):
                continue
            adv = gh_get_json(hub, f"data/{safe_name(lg['id'])}_adv.json")
            if adv:
                restore_extras(lg["id"], adv, gh_get_json(hub, f"data/{safe_name(lg['id'])}_heat.json"))
        except Exception as e:
            log(f"  تعذر استعادة بيانات الإضافة لـ {lg.get('name')}: {type(e).__name__}")
        try:
            if q("SELECT 1 FROM pm WHERE league_id=? LIMIT 1", (lg["id"],)):
                continue
            pl = gh_get_json(hub, f"data/{safe_name(lg['id'])}_pl.json")
            if pl:
                restore_pl(lg["id"], pl)
        except Exception as e:
            log(f"  تعذر استعادة بيانات الإضافة لـ {lg.get('name')}: {type(e).__name__}")
    return n


# ---------------- الواجهة: تعديلات صغيرة على INDEX (كل تعديل يتحقق أن النص الأصلي موجود مرة واحدة) ----------------
_X_CSS = (".pitch{width:100%;max-width:840px;display:block;border-radius:8px;margin:6px 0}"
          ".card b{color:var(--tx)}")

_X_JS = r'''/* ===== Addon: Passing network / Heatmaps / PPDA (reads data/*_adv.json and data/*_heat.json) ===== */
let ADV=null,HEAT=null;
const lgMeta=()=>ALL.leagues.find(l=>l.id===D.id)||{};
async function loadJson(file,v){const r=await fetch('data/'+file+'?v='+encodeURIComponent(v||ALL.generated||''));if(!r.ok)throw new Error(file+' (HTTP '+r.status+')');return r.json()}
async function loadAdv(){if(ADV)return ADV;const m=lgMeta();if(!m.adv_file)return null;const a=await loadJson(m.adv_file,m.adv_v);a.exm=new Map((a.ex||[]).map(e=>[e.i,e]));ADV=a;return a}
async function loadHeat(){if(HEAT)return HEAT;const m=lgMeta();if(!m.heat_file)return null;HEAT=await loadJson(m.heat_file,m.adv_v);return HEAT}
const exTag=(m,k)=>{if(!ADV)return tag('ni');const e=ADV.exm.get(m.match_id);return tag(e&&e[k]>0?'available':'missing')};
const mlabel=id=>{const m=D.matches.find(x=>x.match_id===id);return m?m.date.slice(0,10)+'  '+m.home+' '+m.score+' '+m.away:id};
const opts=(arr,sel)=>arr.map(([v,t])=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(t)}</option>`).join('');
const PITCH_BG='<rect x="-2" y="-2" width="109" height="73" fill="#12301f"/>';
const pitchLines=(c,o)=>`<g fill="none" stroke="${c}" stroke-opacity="${o}" stroke-width=".35"><rect x="0" y="0" width="105" height="68"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/><rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/><rect x="-1.5" y="30.34" width="1.5" height="7.32"/><rect x="105" y="30.34" width="1.5" height="7.32"/></g><g fill="${c}" fill-opacity="${o}"><circle cx="11" cy="34" r=".45"/><circle cx="94" cy="34" r=".45"/><circle cx="52.5" cy="34" r=".45"/></g>`;
/* under = drawn beneath the pitch markings (heat cells); inner = drawn above them (network). bright = lighter markings so they stay visible over heat */
const pitchSvg=(inner,defs,under,dir,bright)=>`<svg class="pitch" viewBox="-2 -2 109 74">${defs||''}${PITCH_BG}${under||''}${bright?pitchLines('#e8eef5','.55'):pitchLines('#4d8f6b','1')}${inner||''}<text x="52.5" y="70" text-anchor="middle" font-size="2.4" fill="#8a9bb0">${dir==='l'?'← Attack direction':'Attack direction →'}</text></svg>`;
const noData=(el,msg)=>{el.innerHTML+=`<div class="empty">${msg}</div>`};
/* Left/right: the team's left flank is drawn at the TOP when it attacks to the right (the usual match view). The provider does not document which touchline y=0 is, so this is a switch, remembered on this device. */
const flipOn=()=>{try{const v=localStorage.getItem('flipy');return v===null?true:v==='1'}catch(e){return true}};
const flipSet=v=>{try{localStorage.setItem('flipy',v?'1':'0')}catch(e){}};
const flipBox=()=>`<label class="mu" style="align-self:center"><input type="checkbox" id="fl" ${flipOn()?'checked':''} style="min-height:0"> Flip left/right</label>`;

'''

_X_JS += r'''
/* ---------- Heatmaps ---------- */
const HSTOPS=[[255,230,109],[255,140,66],[229,36,43]];
const hcol=t=>{const x=Math.max(0,Math.min(1,t))*2,i=Math.min(1,Math.floor(x)),u=x-i,a=HSTOPS[i],b=HSTOPS[i+1];return 'rgb('+a.map((v,k)=>Math.round(v+(b[k]-v)*u)).join(',')+')'};
const hopa=t=>(.45+.4*t).toFixed(2);
/* sums the raw PitchAPI counts of the given rows (always rows of ONE match) into a dense GL x GW array; absent cells stay 0 */
function heatCells(rows,GL,GW){
 const acc=new Array(GL*GW).fill(0);let total=0;
 rows.forEach(r=>{const h=r.h||[];for(let i=0;i+2<h.length;i+=3){const x=h[i],y=h[i+1],n=h[i+2];if(x>=0&&x<GL&&y>=0&&y<GW&&n>0){acc[y*GL+x]+=n;total+=n}}});
 return {acc,total,max:Math.max(0,...acc),active:acc.filter(Boolean).length};
}
/* cell (cx,cy) covers x=[cx*105/GL,(cx+1)*105/GL] and y=[cy*68/GW,(cy+1)*68/GW] metres, so the grid fills the pitch exactly */
function heatRects(c,GL,GW,max,flip){
 const cw=105/GL,ch=68/GW;let g='';
 c.acc.forEach((n,i)=>{if(!n)return;const x=i%GL,y=Math.floor(i/GL),t=n/max,yy=flip?GW-1-y:y;
  g+=`<rect x="${(x*cw).toFixed(3)}" y="${(yy*ch).toFixed(3)}" width="${cw.toFixed(3)}" height="${ch.toFixed(3)}" fill="${hcol(t)}" fill-opacity="${hopa(t)}"><title>cell ${x},${y}: ${n} actions</title></rect>`});
 return g;
}
const heatSvg=(c,GL,GW,max,dir,flip)=>pitchSvg('',null,heatRects(c,GL,GW,max,flip),dir,true);
const heatLegend=max=>`<div style="max-width:420px;margin:4px 0 8px"><div style="height:8px;border-radius:4px;background:linear-gradient(90deg,${hcol(0)},${hcol(.5)},${hcol(1)})"></div><div class="mu" style="display:flex;justify-content:space-between;font-size:12px"><span>1 action</span><span>${max} actions in one cell</span></div></div>`;
R.heatmaps=async function(el){
 el.innerHTML='<h2>Heatmaps</h2>';
 let H=null;try{H=await loadHeat()}catch(e){noData(el,'Could not load heatmap data: '+esc(e.message));return}
 if(!H||!H.rows||!H.rows.length){noData(el,'No heatmap data for this league yet. It appears after the next synchronization. PitchAPI returns no heatmap for matches it never rated.');return}
 const GL=H.grid.l,GW=H.grid.w,have=[...new Set(H.rows.map(r=>r.m))];
 const ms=D.matches.filter(m=>have.includes(m.match_id)).sort(byDate);
 el.innerHTML+=`<div class="mu" style="margin-bottom:8px">Match-level heatmaps: PitchAPI provides no season heatmap. ${have.length} of ${D.matches.length} matches have data.</div>
 <div class="ctl"><select id="hm">${opts(ms.map(m=>[m.match_id,mlabel(m.match_id)]),ms[0]?ms[0].match_id:'')}</select><select id="hv">${opts([['p','Team or player (each attacks →)'],['b','Both teams on one pitch']],'p')}</select><select id="ht"></select><select id="hp"></select>${flipBox()}</div><div id="hout"></div>`;
 const scope=()=>H.rows.filter(r=>r.m===$('#hm').value&&r.t!=='h');
 const club=r=>r.t==='t'?r.n:r.c;
 const NOTE=`<p class="mu" style="font-size:12px">Counts of on-the-ball actions binned by PitchAPI on a ${GL}×${GW} grid (not raw coordinates); empty cells had no recorded action. Raw match totals, not per-90, so a substitute looks thinner because of minutes. Left/right: the team's left flank is at the top when it attacks to the right; PitchAPI does not document which touchline is y=0, so untick "Flip left/right" if a player you know looks mirrored.</p>`;
 const draw=()=>{
  const out=$('#hout'),mid=$('#hm').value,view=$('#hv').value,flip=$('#fl').checked;
  $('#ht').disabled=$('#hp').disabled=view==='b';
  if(view==='b'){
   const hr=H.rows.filter(r=>r.m===mid&&r.t==='h').sort((a,b)=>(a.s==='away'?1:0)-(b.s==='away'?1:0));
   if(!hr.length){out.innerHTML='<div class="empty">The shared match-frame grid (home_ltr) is not available for this match yet. It is fetched on the next synchronization.</div>';return}
   const cs=hr.map(r=>heatCells([r],GL,GW)),mx=Math.max(0,...cs.map(c=>c.max));
   if(!(mx>0)){out.innerHTML='<div class="empty">The provider returned an empty grid for this match.</div>';return}
   out.innerHTML=`<div class="mu" style="margin-bottom:4px">Both teams in PitchAPI's home_ltr frame: the home side attacks to the right, the away side to the left (already turned by the server). One colour scale for both pitches.</div>`+heatLegend(mx)+
    hr.map((r,i)=>`<h3>${esc(r.n)} — ${r.s==='away'?'away, attacks ←':'home, attacks →'} · ${cs[i].total} actions</h3>`+heatSvg(cs[i],GL,GW,mx,r.s==='away'?'l':'r',flip)).join('')+NOTE;
   return}
  const t=$('#ht').value,p=$('#hp').value;
  const rows=scope().filter(r=>club(r)===t&&(p?(r.t==='p'&&r.k===p):r.t==='t'));
  if(!rows.length){out.innerHTML='<div class="empty">No heatmap data for this selection.</div>';return}
  const c=heatCells(rows,GL,GW);
  if(!(c.max>0)){out.innerHTML='<div class="empty">The provider returned an empty grid for this selection.</div>';return}
  out.innerHTML=`<div class="mu" style="margin-bottom:4px">${esc(p?rows[0].n:t)} · ${c.total} actions · ${c.active} of ${GL*GW} cells active. Attacking frame (acting_ltr): cell 0 = own goal line, cell ${GL-1} = opponent's, so this team attacks to the right.</div>`+heatLegend(c.max)+heatSvg(c,GL,GW,c.max,'r',flip)+NOTE};
 const fillPlayers=()=>{const old=$('#hp').value,t=$('#ht').value,seen=new Map();
  scope().filter(r=>r.t==='p'&&club(r)===t).forEach(r=>{if(!seen.has(r.k))seen.set(r.k,{n:r.n,a:r.a||0})});
  const p=[...seen.entries()].sort((a,b)=>b[1].a-a[1].a).map(([k,v])=>[k,v.n+' · '+v.a]);
  $('#hp').innerHTML=opts([['','Whole team'],...p],seen.has(old)?old:'');draw()};
 const fillTeams=()=>{const old=$('#ht').value,t=[...new Set(scope().map(club))].filter(Boolean).sort();
  $('#ht').innerHTML=opts(t.map(x=>[x,x]),t.includes(old)?old:t[0]);fillPlayers()};
 $('#fl').onchange=()=>{flipSet($('#fl').checked);draw()};$('#hm').onchange=fillTeams;$('#hv').onchange=draw;$('#ht').onchange=fillPlayers;$('#hp').onchange=draw;
 fillTeams();
};

'''

_X_JS += r'''
/* ---------- Passing: pass network + pass-category counts ---------- */
const PF=[['','All players (sort by passes)'],['pr','Progressive passes'],['kp','Key passes'],['tb','Through balls'],['cr','Crosses'],['bx','Passes into box'],['sw','Switches'],['as','Assists']];
let NETCUR=null;
const PART=new Set(['de','van','von','da','di','dos','do','del','della','der','den','le','la','el','al','bin','ten','ter']);
/* "K. De Bruyne" -> "De Bruyne", "Erling Haaland" -> "Haaland", "Virgil van Dijk" -> "van Dijk" */
const nodeName=n=>{let t=String(n||'').trim().split(/\s+/).filter(Boolean);if(t.length>1&&/^[A-Z]\.?$/.test(t[0]))t=t.slice(1);
 if(t.length<2)return t.join(' ');const p=t[t.length-2];return (p===p.toLowerCase()||PART.has(p.toLowerCase()))?t.slice(-2).join(' '):t[t.length-1]};
const LFS=3,LCW=LFS*.56;
/* Chooses a label position for every node WITHOUT moving any node: tries above / below / right / left / farther, takes the first free one */
function placeLabels(items){
 const circ=items.map(o=>({x0:o.x-o.r,x1:o.x+o.r,y0:o.y-o.r,y1:o.y+o.r})),placed=[],out=[];
 const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
 items.map((o,i)=>i).sort((a,b)=>items[b].r-items[a].r).forEach(i=>{
  const o=items[i],w=o.t.length*LCW;
  const cand=[['middle',o.x,o.y-o.r-.9],['middle',o.x,o.y+o.r+LFS+.2],['start',o.x+o.r+.9,o.y+LFS*.35],['end',o.x-o.r-.9,o.y+LFS*.35],['middle',o.x,o.y-o.r-LFS-1.9],['middle',o.x,o.y+o.r+2*LFS+1.3]];
  let best=null;
  for(const [a,x,y] of cand){
   const x0=a==='middle'?x-w/2:(a==='start'?x:x-w),bx={x0,x1:x0+w,y0:y-LFS*.85,y1:y+LFS*.25};
   let s=0;placed.forEach(p=>{if(hit(bx,p))s++});circ.forEach((k,j)=>{if(j!==i&&hit(bx,k))s++});
   if(bx.x0<-1||bx.x1>106||bx.y0<-1||bx.y1>69)s+=2;
   if(!best||s<best.s)best={a,x,y,bx,s};
   if(s===0)break;
  }
  placed.push(best.bx);out[i]={x:best.x,y:best.y,a:best.a,s:best.s,bx:best.bx};
 });
 return out;
}
function netSel(kind,i){
 const r=NETCUR,box=$('#ndet');if(!r||!box)return;
 const na=id=>{const n=r.nodes.find(x=>x.i===id);return n?n.n:id};
 if(kind==='n'){const n=r.nodes[i];
  box.innerHTML=`<b>${esc(n.n)}</b><div class="mu">Passes played ${n.p==null?'N/A':n.p} · received ${n.r==null?'N/A':n.r} · partners ${n.d==null?'N/A':n.d} · strength ${n.s==null?'N/A':n.s}<br>Betweenness ${f(n.b)} · clustering ${f(n.c)}<br>Average pass origin: x ${f(n.x,1)} m, y ${f(n.y,1)} m</div>`}
 else{const e=r.edges[i];box.innerHTML=`<b>${esc(na(e.a))} → ${esc(na(e.b))}</b><div class="mu">${e.p} passes (receiver inferred from the next action by the same team)</div>`}
}
R.passing=async function(el){
 el.innerHTML='<h2>Passing</h2><div class="card mu" style="font-size:13px"><b>What PitchAPI provides:</b> a pass network per team (player positions = average origin of completed passes, links = number of passes between two players) and per-player pass counts by category. <b>Not provided:</b> individual passes with start/end coordinates, pass success per pass, and xT per pass, so a pass-by-pass map cannot be drawn and no pass xT is shown.</div>';
 let A=null;try{A=await loadAdv()}catch(e){noData(el,'Could not load passing data: '+esc(e.message));return}
 const nets=A?(A.net||[]):[];
 if(!nets.length){noData(el,'No pass-network data for this league yet. It appears after the next synchronization.');return}
 const have=[...new Set(nets.map(n=>n.m))],ms=D.matches.filter(m=>have.includes(m.match_id)).sort(byDate);
 el.innerHTML+=`<div class="ctl"><select id="nm">${opts(ms.map(m=>[m.match_id,mlabel(m.match_id)]),ms[0]?ms[0].match_id:'')}</select><select id="nt"></select><input id="nmin" type="number" min="1" value="3" style="width:120px" placeholder="Min passes"><select id="nf">${opts(PF,'')}</select>${flipBox()}</div><div id="nout"></div>`;
 const draw=()=>{
  const out=$('#nout'),mid=$('#nm').value,tid=$('#nt').value;
  const row=nets.find(n=>n.m===mid&&n.i===tid);NETCUR=row||null;
  if(!row){out.innerHTML='<div class="empty">No pass network for this selection.</div>';return}
  const min=Math.max(1,num($('#nmin').value)||1),by={},undrawn=[],flip=$('#fl').checked;
  row.nodes.forEach((n,i)=>{
   if(n.x==null||n.y==null)undrawn.push(n.n+' (no completed pass origin)');
   else if(n.x<0||n.x>105||n.y<0||n.y>68)undrawn.push(n.n+' (coordinates outside the pitch)');
   else by[n.i]={n,i,r:1.2+Math.sqrt(n.p||0)*.35,x:n.x,y:flip?68-n.y:n.y}});
  let maxP=0;row.edges.forEach(e=>{if(by[e.a]&&by[e.b])maxP=Math.max(maxP,e.p)});
  const seen=new Set();let dups=0,shown=0,g='';
  row.edges.forEach((e,i)=>{const a=by[e.a],b=by[e.b];if(!a||!b)return;
   const k=e.a+'>'+e.b;if(seen.has(k)){dups++;return}seen.add(k);if(e.p<min)return;
   const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<1)return;
   const ux=dx/L,uy=dy/L,px=-uy*.8,py=ux*.8,x1=a.x+ux*a.r+px,y1=a.y+uy*a.r+py,x2=b.x-ux*(b.r+.6)+px,y2=b.y-uy*(b.r+.6)+py;
   const w=Math.max(.25,3*e.p/maxP),op=(.35+.5*e.p/maxP).toFixed(2);shown++;
   g+=`<g onclick="netSel('e',${i})" style="cursor:pointer"><line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#8a9bb0" stroke-opacity="${op}" stroke-width="${w.toFixed(2)}" marker-end="url(#ah)"/><line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="transparent" stroke-width="3"/><title>${esc(a.n.n)} → ${esc(b.n.n)}: ${e.p} passes</title></g>`});
  const nl=Object.values(by),lp=placeLabels(nl.map(o=>({x:o.x,y:o.y,r:o.r,t:nodeName(o.n.n)})));
  nl.forEach(o=>{g+=`<g onclick="netSel('n',${o.i})" style="cursor:pointer"><circle cx="${+o.x.toFixed(2)}" cy="${+o.y.toFixed(2)}" r="${o.r.toFixed(2)}" fill="#5aa9e6" fill-opacity=".9" stroke="#e8eef5" stroke-width=".3"/><title>${esc(o.n.n)}: ${o.n.p==null?'N/A':o.n.p} passes played, average pass origin (${f(o.n.x,1)}, ${f(o.n.y,1)}) m</title></g>`});
  nl.forEach((o,j)=>{const l=lp[j];g+=`<text x="${l.x.toFixed(2)}" y="${l.y.toFixed(2)}" text-anchor="${l.a}" font-size="${LFS}" fill="#e8eef5" stroke="#0d1520" stroke-width=".8" paint-order="stroke" stroke-linejoin="round" style="pointer-events:none">${esc(nodeName(o.n.n))}</text>`});
  const defs='<defs><marker id="ah" viewBox="0 0 4 4" refX="3" refY="2" markerWidth="2" markerHeight="2" orient="auto"><path d="M0 0L4 2L0 4z" fill="#8a9bb0"/></marker></defs>';
  const win=row.u?`starting eleven until the team's first substitution (about minute ${Math.round(row.u/60)}). Passes after that are not included, so this is not the whole match.`:`PitchAPI documents it as the starting eleven until the team's first substitution; the end time was not reported for this match.`;
  const cat=$('#nf').value;
  let pr=(A.pass||[]).filter(r=>r.m===mid&&r.t===tid);
  const sk=cat||'ps';if(cat)pr=pr.filter(r=>(r[cat]||0)>0);pr.sort((a,b)=>(b[sk]||0)-(a[sk]||0));
  const cell=v=>v==null?'N/A':f(v,v%1?1:0);
  out.innerHTML=`<div class="card" style="font-size:13px"><b>Observation window:</b> ${win}<div class="mu" style="margin-top:4px">Node position = average origin of that player's completed passes in the window (not their average position). Left/right: the team's left flank is at the top when it attacks to the right (untick "Flip left/right" if a player you know looks mirrored). Node size = passes played. Line width is proportional to the passes between the two players (thickest drawn: ${maxP}); the arrow points from passer to receiver. Receivers are inferred, so a pass with no resolved receiver is in the node total but has no link.</div></div>`+
  `<div class="mu" style="margin-bottom:6px">${row.edges.length?`Showing ${shown} of ${row.edges.length} links (at least ${min} passes).${dups?' '+dups+' duplicate row(s) ignored.':''}`:'No links available for this team (none provided, or the response fields could not be read).'} Tap a player or a link.${undrawn.length?'<br>Not drawn: '+undrawn.map(esc).join('; ')+'.':''}</div>`+pitchSvg(g,defs)+`<div class="card" id="ndet" style="font-size:13px">Tap a player or a link for details.</div>`+
  `<h3>Pass categories (counts per player, this match)</h3>`+tbl([['Player'],['Min',1],['Passes',1],['Acc %',1],['Progr.',1],['Into box',1],['Key',1],['Assists',1],['Through',1],['Crosses',1],['Switches',1]],pr.map(r=>[esc(r.n),cell(r.mi),cell(r.ps),cell(r.ac),cell(r.pr),cell(r.bx),cell(r.kp),cell(r.as),cell(r.tb),cell(r.cr),cell(r.sw)]))};
 const fillTeams=()=>{const old=$('#nt').value,t=nets.filter(n=>n.m===$('#nm').value);
  $('#nt').innerHTML=opts(t.map(n=>[n.i,n.n]),t.some(n=>n.i===old)?old:(t[0]?t[0].i:''));draw()};
 $('#fl').onchange=()=>{flipSet($('#fl').checked);draw()};$('#nm').onchange=fillTeams;$('#nt').onchange=draw;$('#nmin').oninput=draw;$('#nf').onchange=draw;
 fillTeams();
};

'''

# ===== نهاية الجزء 4 من 5 — كمّل الصق الجزء 5 تحت هذا السطر مباشرة =====
_X_JS += r'''
/* ---------- PPDA ---------- */
R.ppda=async function(el){
 el.innerHTML='<h2>PPDA</h2><div class="card mu" style="font-size:13px"><b>Definition (PitchAPI):</b> PPDA = opponent passes attempted ÷ defensive actions by the pressing team (fouls, tackles, interceptions, challenges, blocked passes), both counted only in the pressing zone, i.e. outside the pressing team\'s own defensive third. Clearances and shot blocks are excluded. Lower means more intense pressing. Values come from PitchAPI; nothing is estimated here.</div>';
 let A=null;try{A=await loadAdv()}catch(e){noData(el,'Could not load PPDA data: '+esc(e.message));return}
 const T=A?(A.team||[]):[];
 if(!T.length){noData(el,'No PPDA data for this league yet. It appears after the next synchronization. PitchAPI returns no analytics for matches it never rated.');return}
 const g=new Map();
 T.forEach(r=>{let t=g.get(r.n);if(!t){t={n:r.n,m:0,op:0,da:0,pps:[]};g.set(r.n,t)}
  t.m++;if(r.op!=null&&r.da!=null&&r.da>0){t.op+=r.op;t.da+=r.da}if(r.pp!=null)t.pps.push(r.pp)});
 const S=[...g.values()].map(t=>({n:t.n,m:t.m,w:t.da>0?t.op/t.da:null,a:t.pps.length?t.pps.reduce((x,y)=>x+y,0)/t.pps.length:null})).sort((a,b)=>(a.w??1e9)-(b.w??1e9));
 const missing=D.matches.length-new Set(T.map(r=>r.m)).size;
 const teams=[...g.keys()].sort(),hasZ=T.some(r=>r.z!=null);
 el.innerHTML+=`<h3>Teams — season</h3>`+tbl([['#',1],['Team'],['Matches',1],['PPDA (Σ passes ÷ Σ actions)',1],['Avg of match PPDA',1]],S.map((s,i)=>[i+1,esc(s.n),s.m,f(s.w,2),f(s.a,2)]))+
 `<div class="mu" style="font-size:12px;margin-top:6px">Season PPDA = total opponent passes ÷ total defensive actions over the matches with data (not an average of ratios). ${missing>0?missing+' of '+D.matches.length+' matches have no PPDA data.':''}</div>
 <h3>By match</h3><div class="ctl"><select id="pt">${opts([['','All teams'],...teams.map(x=>[x,x])],'')}</select></div><div id="pout"></div>`;
 const draw=()=>{const t=$('#pt').value,mm=new Map(D.matches.map(m=>[m.match_id,m]));
  const rows=T.filter(r=>!t||r.n===t).sort((a,b)=>String((mm.get(b.m)||{}).date).localeCompare(String((mm.get(a.m)||{}).date)));
  $('#pout').innerHTML=tbl([['Date'],['Match'],['Team'],['PPDA',1],['Opp. passes',1],['Def. actions',1],['Check op÷da',1]].concat(hasZ?[['Zone',1]]:[]),
   rows.map(r=>{const m=mm.get(r.m)||{match_id:r.m,home:'',away:'',score:'',date:''},c=(r.op!=null&&r.da>0)?r.op/r.da:null,bad=c!=null&&r.pp!=null&&Math.abs(c-r.pp)>.02*c+.01;
    return [esc(String(m.date).slice(0,10)),mlink(m),esc(r.n),f(r.pp,2),r.op==null?'N/A':r.op,r.da==null?'N/A':r.da,f(c,2)+(bad?' ⚠':'')].concat(hasZ?[f(r.z,2)]:[])}))};
 $('#pt').onchange=draw;draw();
};

'''

_X_JS += r'''
/* ---------- Defensive + Look Like (read data/*_pl.json: one row per player per match) ---------- */
let PLD=null;
async function loadPl(){if(PLD)return PLD;const m=lgMeta();if(!m.pl_file)return null;const d=await loadJson(m.pl_file,m.pl_v);d.ix={};d.cols.forEach((c,k)=>d.ix[c]=k);PLD=d;return d}
const PL_SUM=['ps','pr','bx','kp','ast','tb','cr','ca','pc','cb','tko','tkw','sca','gca','xag','xgc','xgb','tk','ic','bl','cl','duw','aer','aerw','xt','vaep','sh','sot','xg','npxg','gl','act','aco'];
/* Season totals per player. A missing value is never turned into 0: per-90 uses only the minutes of matches where that value exists. */
function aggPl(P){
 const g=new Map(),ix=P.ix;
 for(const r of P.rows){
  const mi=r[ix.mi];if(mi==null)continue;
  const id=r[ix.i];let a=g.get(id);
  if(!a){a={id,n:r[ix.n],clubs:{},pos:{},games:0,s:{mi:0},d:{}};PL_SUM.forEach(k=>{a.s[k]=0;a.d[k]=0});g.set(id,a)}
  a.games++;a.s.mi+=mi;a.clubs[r[ix.c]]=(a.clubs[r[ix.c]]||0)+mi;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;
  for(const k of PL_SUM){const v=r[ix[k]];if(v!=null){a.s[k]+=v;a.d[k]+=mi}}
 }
 const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0];
 return [...g.values()].filter(a=>a.s.mi>0).map(a=>{a.club=(top(a.clubs)||['Unknown'])[0];a.p=(top(a.pos)||[null])[0];
  a.has=k=>a.d[k]>0;a.p90=k=>a.d[k]>0?a.s[k]/a.d[k]*90:null;return a});
}
/* Team pressing (PitchAPI reports pressing per team only): PPDA weighted over matches + per-match means */
function teamCtx(P,A){
 const g=new Map();
 P.team.forEach(r=>{let t=g.get(r.n);if(!t){t={n:r.n,m:0,s:{},c:{}};g.set(r.n,t)}t.m++;
  ['hto','cpr','brt','adx','tilt'].forEach(k=>{if(r[k]!=null){t.s[k]=(t.s[k]||0)+r[k];t.c[k]=(t.c[k]||0)+1}})});
 const pp=new Map();((A&&A.team)||[]).forEach(r=>{let t=pp.get(r.n);if(!t){t={op:0,da:0};pp.set(r.n,t)}if(r.op!=null&&r.da!=null&&r.da>0){t.op+=r.op;t.da+=r.da}});
 return [...g.values()].map(t=>{const o={n:t.n,m:t.m};['hto','cpr','brt','adx','tilt'].forEach(k=>o[k]=t.c[k]?t.s[k]/t.c[k]:null);
  const q=pp.get(t.n);o.ppda=q&&q.da>0?q.op/q.da:null;return o});
}
const cellN=(v,d)=>v==null?'N/A':f(v,d);
R.defense=async function(el){
 el.innerHTML='<h2>Defensive</h2>';
 let P=null,A=null;try{P=await loadPl()}catch(e){noData(el,'Could not load defensive data: '+esc(e.message));return}
 if(!P||!P.rows.length){noData(el,'No player data for this league yet. It appears after the next synchronization.');return}
 try{A=await loadAdv()}catch(e){A=null}
 const AG=aggPl(P),TC=teamCtx(P,A),teams=[...new Set(AG.map(a=>a.club))].sort();
 el.innerHTML+=`<div class="card mu" style="font-size:13px"><b>What this shows:</b> every defensive count PitchAPI reports per player. It reports duels <i>won</i> only (not duels lost), so total duels and duel win % are not available; aerial win % uses aerials won ÷ aerials contested. "Ground duels won" = duels won − aerial duels won (derived). Pressing is reported per <b>team</b> only (table below), not per player; "Opp-half %" is where the player's on-ball actions happen (from heatmaps), a position indicator, not a pressing stat.</div>
 <div class="ctl"><input id="dq" placeholder="Search player"><select id="dt">${opts([['','All teams'],...teams.map(t=>[t,t])],'')}</select><select id="dp">${opts([['','All positions'],['GK','GK'],['DF','DF'],['MF','MF'],['FW','FW']],'')}</select>
 <select id="ds">${opts([['da','Sort: defensive actions'],['tk','Tackles'],['ic','Interceptions'],['bl','Blocks'],['cl','Clearances'],['duw','Duels won'],['aerw','Aerials won'],['ap','Aerial win %'],['op','Opp-half %']],'da')}</select>
 <label class="mu" style="align-self:center"><input type="checkbox" id="d9" checked style="min-height:0"> per 90</label><input id="dm" type="number" value="270" style="width:130px" placeholder="Min minutes"></div><div id="dout"></div>
 <h3>Team pressing</h3><div class="mu" style="font-size:12px;margin-bottom:6px">High turnovers = regains in the attacking third that lead to a shot or the box; counterpress = regains within 5 s of losing the ball (per match averages). PPDA: lower = more pressing.</div>`+
 tbl([['Team'],['Matches',1],['PPDA',1],['High turnovers',1],['Counterpress regains',1],['Recovery time (s)',1],['Avg def. action x (m)',1],['Field tilt %',1]],
  [...TC].sort((a,b)=>(a.ppda??1e9)-(b.ppda??1e9)).map(t=>[esc(t.n),t.m,cellN(t.ppda,2),cellN(t.hto,2),cellN(t.cpr,2),cellN(t.brt,1),cellN(t.adx,1),cellN(t.tilt,1)]));
 const draw=()=>{
  const q=$('#dq').value.toLowerCase().trim(),t=$('#dt').value,ps=$('#dp').value,mn=num($('#dm').value)||0,p90=$('#d9').checked,sk=$('#ds').value;
  const v=(a,k)=>p90?a.p90(k):(a.has(k)?a.s[k]:null);
  const sum=(a,ks)=>ks.every(k=>a.has(k))?ks.reduce((x,k)=>x+v(a,k),0):null;
  const C={tk:a=>v(a,'tk'),ic:a=>v(a,'ic'),bl:a=>v(a,'bl'),cl:a=>v(a,'cl'),duw:a=>v(a,'duw'),aerw:a=>v(a,'aerw'),aer:a=>v(a,'aer'),
   gd:a=>(a.has('duw')&&a.has('aerw'))?v(a,'duw')-v(a,'aerw'):null,
   ap:a=>(a.has('aer')&&a.has('aerw')&&a.s.aer>0)?a.s.aerw/a.s.aer*100:null,
   da:a=>sum(a,['tk','ic','bl','cl']),op:a=>a.s.act>0?a.s.aco/a.s.act*100:null};
  const rows=AG.filter(a=>a.s.mi>=mn&&(!q||a.n.toLowerCase().includes(q))&&(!t||a.club===t)&&(!ps||a.p===ps))
   .sort((x,y)=>(C[sk](y)??-1e18)-(C[sk](x)??-1e18)).slice(0,150),d=p90?2:0;
  $('#dout').innerHTML=`<div class="mu" style="margin-bottom:6px">${rows.length} players${rows.length===150?' (top 150)':''} · ${p90?'per 90 minutes':'season totals'}</div>`+
   tbl([['#',1],['Player'],['Club'],['Pos'],['Min',1],['Tackles',1],['Interc.',1],['Blocks',1],['Clear.',1],['Duels won',1],['Ground won',1],['Aerials won',1],['Aerials',1],['Aerial %',1],['Def. actions',1],['Opp-half %',1]],
    rows.map((a,i)=>[i+1,esc(a.n),esc(a.club),a.p||'N/A',Math.round(a.s.mi),cellN(C.tk(a),d),cellN(C.ic(a),d),cellN(C.bl(a),d),cellN(C.cl(a),d),cellN(C.duw(a),d),cellN(C.gd(a),d),cellN(C.aerw(a),d),cellN(C.aer(a),d),cellN(C.ap(a),0),cellN(C.da(a),d),cellN(C.op(a),0)]))};
 ['dq','dm'].forEach(i=>$('#'+i).oninput=draw);['dt','dp','ds','d9'].forEach(i=>$('#'+i).onchange=draw);
 draw();
};

'''

_X_JS += r'''
/* ---------- Look Like: players with a similar profile ---------- */
const LG=[['att','Attacking'],['cre','Creation'],['pas','Passing & carrying'],['def','Defensive'],['pos','Position (heatmap)'],['tm','Team pressing context']];
const LG_ON={att:1,cre:1,def:1};
const p90m=k=>a=>a.p90(k);
const MET=[
 ['xg','xG /90','att',p90m('xg')],['npxg','npxG /90','att',p90m('npxg')],['gl','Goals /90','att',p90m('gl')],['sh','Shots /90','att',p90m('sh')],['sot','On target /90','att',p90m('sot')],
 ['fin','Goals − xG /90','att',a=>(a.has('gl')&&a.has('xg'))?a.p90('gl')-a.p90('xg'):null],['xt','xT /90','att',p90m('xt')],['vaep','VAEP /90','att',p90m('vaep')],
 ['kp','Key passes /90','cre',p90m('kp')],['xag','xAG /90','cre',p90m('xag')],['ast','Assists /90','cre',p90m('ast')],['sca','Shot-creating actions /90','cre',p90m('sca')],['gca','Goal-creating actions /90','cre',p90m('gca')],['xgc','xG chain /90','cre',p90m('xgc')],['xgb','xG buildup /90','cre',p90m('xgb')],
 ['ps','Passes /90','pas',p90m('ps')],['pr','Progressive passes /90','pas',p90m('pr')],['bx','Passes into box /90','pas',p90m('bx')],['tb','Through balls /90','pas',p90m('tb')],['cr','Crosses /90','pas',p90m('cr')],['pc','Progressive carries /90','pas',p90m('pc')],['cb','Carries into box /90','pas',p90m('cb')],['tko','Take-ons /90','pas',p90m('tko')],
 ['tkr','Take-on success %','pas',a=>a.s.tko>0&&a.has('tkw')?a.s.tkw/a.s.tko*100:null],
 ['tk','Tackles /90','def',p90m('tk')],['ic','Interceptions /90','def',p90m('ic')],['bl','Blocks /90','def',p90m('bl')],['cl','Clearances /90','def',p90m('cl')],['duw','Duels won /90','def',p90m('duw')],['aerw','Aerials won /90','def',p90m('aerw')],
 ['ap','Aerial win %','def',a=>a.s.aer>0&&a.has('aerw')?a.s.aerw/a.s.aer*100:null],
 ['gdw','Ground duels won /90','def',a=>(a.has('duw')&&a.has('aerw'))?a.p90('duw')-a.p90('aerw'):null],
 ['opp','Actions in opponent half %','pos',a=>a.s.act>0?a.s.aco/a.s.act*100:null],
 ['t_ppda','Team PPDA','tm',(a,T)=>(T[a.club]||{}).ppda??null],['t_hto','Team high turnovers /match','tm',(a,T)=>(T[a.club]||{}).hto??null],['t_cpr','Team counterpress regains /match','tm',(a,T)=>(T[a.club]||{}).cpr??null]];
let LK=null;
function lkSel(i){
 if(!LK||!LK.res[i])return;const r=LK.res[i],b=$('#lcmp');if(!b)return;
 b.innerHTML=`<h3>${esc(LK.t.n)} vs ${esc(r.a.n)}</h3>`+tbl([['Metric'],[esc(LK.t.n),1],[esc(r.a.n),1],['Gap (SD)',1]],r.det.map(x=>[esc(x.l),f(x.tv,2),f(x.cv,2),(x.dz>0?'+':'')+f(x.dz,2)]))+
  `<div class="mu" style="font-size:12px;margin-top:6px">Gap in standard deviations of the comparison pool: 0 = identical, ±1 = one SD apart.</div>`;
}
R.looklike=async function(el){
 el.innerHTML='<h2>Look Like</h2>';
 let P=null,A=null;try{P=await loadPl()}catch(e){noData(el,'Could not load player data: '+esc(e.message));return}
 if(!P||!P.rows.length){noData(el,'No player data for this league yet. It appears after the next synchronization.');return}
 try{A=await loadAdv()}catch(e){A=null}
 const AG=aggPl(P),T={};teamCtx(P,A).forEach(t=>T[t.n]=t);
 const ON={};MET.forEach(m=>ON[m[0]]=!!LG_ON[m[2]]);
 el.innerHTML+=`<div class="card mu" style="font-size:13px"><b>How it works:</b> pick a player and the stat groups you care about. Every stat is turned into a score relative to the other players in the pool (same position by default, goalkeepers excluded). Match % = 100 ÷ (1 + average gap in standard deviations), so 50% means about one SD apart on average. It compares playing <i>style and output</i>, not quality: a similar profile in a weaker league can look identical on paper. Values come from PitchAPI; xG and goals are summed from its shot data.</div>
 <div class="ctl"><input id="lq" placeholder="Search player"><select id="lp" style="max-width:100%"></select></div>
 <div class="ctl"><input id="lm" type="number" value="450" style="width:140px" placeholder="Min minutes"><select id="lx">${opts([['s','Same position only'],['a','Any outfield position']],'s')}</select></div>
 <div class="ctl" id="lgs">${LG.map(([k,n])=>`<label class="mu"><input type="checkbox" id="g_${k}" ${LG_ON[k]?'checked':''} style="min-height:0"> ${n}</label>`).join(' ')}</div>
 <details style="margin-bottom:10px"><summary class="mu">Pick individual stats</summary><div class="ctl" style="margin-top:8px">${MET.map(m=>`<label class="mu" style="font-size:13px"><input type="checkbox" id="m_${m[0]}" ${ON[m[0]]?'checked':''} style="min-height:0"> ${m[1]}</label>`).join(' ')}</div></details>
 <div id="lout"></div><div id="lcmp"></div>`;
 const fillPlayers=()=>{const old=$('#lp').value,q=$('#lq').value.toLowerCase().trim(),mn=num($('#lm').value)||0;
  const l=AG.filter(a=>a.p!=='GK'&&a.s.mi>=mn&&(!q||a.n.toLowerCase().includes(q))).sort((x,y)=>y.s.mi-x.s.mi).slice(0,300);
  $('#lp').innerHTML=opts(l.map(a=>[a.id,`${a.n} · ${a.club} · ${a.p||'?'} · ${Math.round(a.s.mi)}'`]),l.some(a=>a.id===old)?old:(l[0]?l[0].id:''));run()};
 const run=()=>{
  const out=$('#lout'),t=AG.find(a=>a.id===$('#lp').value);$('#lcmp').innerHTML='';LK=null;
  if(!t){out.innerHTML='<div class="empty">No player matches this search and minutes filter.</div>';return}
  const mn=num($('#lm').value)||0,same=$('#lx').value==='s',mets=MET.filter(m=>ON[m[0]]);
  if(!mets.length){out.innerHTML='<div class="empty">Pick at least one stat group.</div>';return}
  const pool=AG.filter(a=>a.p!=='GK'&&a.s.mi>=mn&&(!same||!t.p||a.p===t.p));
  if(pool.length<5){out.innerHTML=`<div class="empty">Only ${pool.length} players in the pool. Lower the minutes filter or allow any position.</div>`;return}
  const st=mets.map(m=>{const v=pool.map(a=>m[3](a,T)).filter(x=>x!=null);if(v.length<5)return null;
   const mu=v.reduce((x,y)=>x+y,0)/v.length,sd=Math.sqrt(v.reduce((x,y)=>x+(y-mu)*(y-mu),0)/v.length);return sd>0?{mu,sd}:null});
  const use=mets.map((m,i)=>i).filter(i=>st[i]&&mets[i][3](t,T)!=null);
  if(!use.length){out.innerHTML='<div class="empty">This player has no data for the selected stats.</div>';return}
  const res=[];
  pool.forEach(a=>{if(a.id===t.id)return;const det=[];
   use.forEach(i=>{const m=mets[i],tv=m[3](t,T),cv=m[3](a,T);if(cv==null)return;det.push({l:m[1],tv,cv,dz:(cv-tv)/st[i].sd})});
   if(det.length<Math.max(3,Math.ceil(use.length*.6)))return;
   const d=Math.sqrt(det.reduce((x,y)=>x+y.dz*y.dz,0)/det.length);
   res.push({a,det,sim:100/(1+d)})});
  res.sort((x,y)=>y.sim-x.sim);const top=res.slice(0,10);LK={t,res:top};
  const near=r=>[...r.det].sort((x,y)=>Math.abs(x.dz)-Math.abs(y.dz)).slice(0,3).map(x=>esc(x.l)).join(', ');
  const far=r=>[...r.det].sort((x,y)=>Math.abs(y.dz)-Math.abs(x.dz)).slice(0,2).map(x=>`${esc(x.l)}: ${f(x.tv,2)} vs ${f(x.cv,2)}`).join('; ');
  out.innerHTML=`<div class="card" style="font-size:13px"><b>${esc(t.n)}</b> · ${esc(t.club)} · ${t.p||'?'} · ${Math.round(t.s.mi)} min · xG ${cellN(t.has('xg')?t.s.xg:null,1)} · goals ${cellN(t.has('gl')?t.s.gl:null,0)} · compared with ${pool.length-1} players on ${use.length} stats</div>`+
   tbl([['#',1],['Player'],['Club'],['Pos'],['Min',1],['Match %',1],['xG',1],['Goals',1],['Closest on'],['Biggest gaps']],
    top.map((r,i)=>[i+1,`<a href="javascript:void(0)" onclick="lkSel(${i})">${esc(r.a.n)}</a>`,esc(r.a.club),r.a.p||'N/A',Math.round(r.a.s.mi),f(r.sim,0),cellN(r.a.has('xg')?r.a.s.xg:null,1),cellN(r.a.has('gl')?r.a.s.gl:null,0),near(r),far(r)]))+
   `<div class="mu" style="font-size:12px;margin-top:6px">Tap a name to see the full stat-by-stat comparison. xG and goals are season totals; the match % uses per-90 rates.</div>`;
  if(top.length)lkSel(0)};
 $('#lq').oninput=fillPlayers;$('#lm').oninput=fillPlayers;$('#lp').onchange=run;$('#lx').onchange=run;
 LG.forEach(([k])=>{$('#g_'+k).onchange=()=>{const on=$('#g_'+k).checked;MET.forEach(m=>{if(m[2]===k){ON[m[0]]=on;$('#m_'+m[0]).checked=on}});run()}});
 MET.forEach(m=>{$('#m_'+m[0]).onchange=()=>{ON[m[0]]=$('#m_'+m[0]).checked;run()}});
 fillPlayers();
};
'''


def _x_patch_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (إضافة): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:50]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, ".chart{width:100%;height:140px}.mu{color:var(--mu)}",
            ".chart{width:100%;height:140px}.mu{color:var(--mu)}" + _X_CSS)
    h = sub(h, "['passing','Passing'],", "['passing','Passing'],['ppda','PPDA'],['defense','Defensive'],['looklike','Look Like'],")
    h = sub(h, "AGGC=null;try{localStorage.setItem('league',D.id)}catch(e){}",
            "AGGC=null;ADV=null;HEAT=null;PLD=null;try{localStorage.setItem('league',D.id)}catch(e){}")
    h = sub(h, "async function route(){", _X_JS + "\nasync function route(){")
    h = sub(h, "if(PLAN[pg]){", "if(PLAN[pg]&&!R[pg]){")
    h = sub(h, "const r=await api('/api/availability');",
            "try{await loadAdv()}catch(e){}const r=await api('/api/availability');")
    h = sub(h, "tag('ni'),tag('ni'),tag('ni'),tag('ni')]))}",
            "tag('ni'),exTag(m,'h'),exTag(m,'n'),tag('ni')]))}")
    return h


INDEX = _x_patch_index(INDEX)


# ---------------- وضع الفحص: يطبع شكل الردود الحقيقية ----------------
def _x_describe(o, name="root", depth=0, maxd=4):
    import dataclasses
    pad = "  " * depth
    if o is None or isinstance(o, (str, int, float, bool)):
        log(f"{pad}{name}: {type(o).__name__} = {str(o)[:40]}")
    elif isinstance(o, (list, tuple)):
        log(f"{pad}{name}: list[{len(o)}]")
        if o and depth < maxd:
            _x_describe(o[0], "[0]", depth + 1, maxd)
    else:
        if isinstance(o, dict):
            names = list(o.keys())
        elif dataclasses.is_dataclass(o):
            names = [f.name for f in dataclasses.fields(o)]
        else:
            names = [k for k in dir(o) if not k.startswith("_") and not callable(getattr(o, k, None))]
        log(f"{pad}{name}: {type(o).__name__}")
        if depth < maxd:
            for k in names:
                _x_describe(_g(o, k), k, depth + 1, maxd)


def probe_api(pit_key):
    with PitchAPI(api_key=pit_key) as client:
        res, err = call(lambda: client.leagues.matches("l_4WFCIZ", season=None, status="played"))
        if res is None or not list(res.matches):
            log("ما قدرت أجلب مباراة للفحص:", err)
            return
        mid = list(res.matches)[0].id
        log(f"فحص المباراة {mid}")
        for nm_ in ("advanced", "advanced_network", "heatmaps"):
            fn = getattr(client.matches, nm_, None)
            log("\n" + "=" * 40 + f"\n{nm_}")
            if fn is None:
                log("  غير موجودة في نسخة pitchapi هذي — شغّل pip install -U pitchapi")
                continue
            r_, e_ = call(fn, mid)
            if r_ is None:
                log("  لا يوجد رد:", e_)
            else:
                _x_describe(r_)
        log("\nانسخ كل هذا الناتج وأرسله لي لنتأكد من أسماء الحقول.")


_orig_main = main

def main():
    if PROBE and os.environ.get("GITHUB_ACTIONS") != "true":
        return probe_api(get_secret("PITCHAPI_KEY", "PitchAPI key: "))
    return _orig_main()
# ======================== نهاية الإضافة ========================


if __name__ == "__main__":
    main()