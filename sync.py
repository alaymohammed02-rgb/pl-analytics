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
 passing:['Passing Analysis','Passing network, pass maps and pass completion by zone.','Pass maps need start and end coordinates for each pass. Not confirmed from the provider.'],
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


if __name__ == "__main__":
    main()