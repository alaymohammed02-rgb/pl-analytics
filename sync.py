# -*- coding: utf-8 -*-
# ============================================================
# PL Analytics — ملف واحد (الأجزاء 1+2+3 + إصلاحات Synchronize والأهداف) — يُلصق في خلية Colab واحدة
#
# يجلب xG / xT من PitchAPI ثم ينشرها كموقع دائم على GitHub Pages
#
# قبل أول تشغيل (مرة واحدة فقط) — Colab ← المفاتيح (🔑 Secrets):
#   PITCHAPI_KEY  = مفتاح PitchAPI
#   GITHUB_TOKEN  = GitHub Personal access token (classic) بصلاحية repo + workflow
#
# بعد أول تشغيل: التحديث يتم من زر Synchronize في صفحة Settings بالموقع
# (أو تلقائياً كل 5 دقايق). ما تحتاج ترجع تشغّل Colab إلا إذا غيّرت الكود نفسه.
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
BLOCKED_COUNTRIES = ("brazil", "brasil")   # دوريات مستبعدة نهائياً (الدوري البرازيلي محذوف)
LIST_LEAGUES = False          # True = يطبع أسماء الدوريات و IDs ثم يتوقف
REPO_NAME = "pl-analytics"    # اسم المستودع على GitHub (يُنشأ تلقائياً)
SETUP_AUTOMATION = True       # يجهّز زر Synchronize والتحديث التلقائي على GitHub Actions
COLAB_DOES_SYNC = False       # False = أول مزامنة تشتغل على GitHub بالخلفية (تقدر تقفل Colab)
SYNC_CRON = "3-59/5 * * * *"  # تحديث تلقائي كل 5 دقايق (أقل فاصل يسمح به GitHub)
RETRY_RECENT_MIN = 30         # مباراة لعبت قريباً وتحليلاتها ناقصة: أعد المحاولة كل N دقيقة
RETRY_OLD_MIN = 720           # مباراة قديمة ناقصة: أعد المحاولة كل N دقيقة (حتى لا نستنزف الـAPI)
# زر Synchronize في الموقع يشغّل المزامنة بوضع force: يعيد محاولة المباريات الناقصة
# اللي انلعبت خلال آخر FORCE_RECENT_DAYS يوم فوراً (بدون انتظار فاصل الإعادة).
FORCE_SYNC = os.environ.get("FORCE_SYNC", "").strip().lower() == "true"
FORCE_RECENT_DAYS = 14
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
    """هل نجلب هذه المباراة الآن؟ المكتملة لا تُعاد، والناقصة تُعاد بفاصل زمني (backoff).
    في وضع force (زر Synchronize): الناقصة اللي انلعبت خلال FORCE_RECENT_DAYS يوم تُعاد فوراً."""
    if r is None or r["status"] in (None, "pending") or not r["fetched_at"]:
        return True
    if r["status"] == "ok":
        return False
    t_now = datetime.datetime.now(datetime.timezone.utc)
    played = _parse_ts(r["date"])
    if FORCE_SYNC and played is not None and (t_now - played).days < FORCE_RECENT_DAYS:
        return True
    last = _parse_ts(r["fetched_at"])
    if last is None:
        return True
    age_min = (t_now - last).total_seconds() / 60
    recent = played is not None and (t_now - played).days < 3
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
def is_blocked(lg):
    """دوري مستبعد نهائياً (حسب الدولة أو الاسم)، مثل الدوري البرازيلي."""
    s = nrm(txt(getattr(lg, "country", None))) + "|" + nrm(getattr(lg, "name", ""))
    return any(b in s for b in BLOCKED_COUNTRIES)

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
        if is_blocked(lg):
            log(f"  ⊘ تم استبعاد {lg.name} [{lg.id}] (دوري محذوف)")
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
                     and not any(nrm(x) in nrm(l.name) for x in bad)
                     and not is_blocked(l)]
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
        elif is_blocked(lg):
            add(lg)                  # يطبع رسالة الاستبعاد فقط
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

def gh_delete(hub, path):
    """يحذف ملفاً من المستودع. ترجع True إذا انحذف."""
    url = f"{GH}/repos/{hub['repo']}/contents/{path}"
    r = requests.get(url, params={"ref": hub["branch"]}, timeout=60,
                     headers=gh_headers(hub["token"], "application/vnd.github.object+json"))
    if r.status_code != 200:
        return False
    sha = r.json().get("sha")
    r = requests.delete(url, json={"message": f"Remove {path}", "sha": sha, "branch": hub["branch"]},
                        headers=gh_headers(hub["token"]), timeout=60)
    return r.status_code == 200

def prune_blocked(hub):
    """يحذف من GitHub ملفات الدوريات المستبعدة (مثل البرازيلي) اللي نُشرت سابقاً.
    يقرأ الفهرس القديم ويحذف فقط الدوريات اللي دولتها/اسمها في BLOCKED_COUNTRIES."""
    old = gh_get_json(hub, "data/index.json")
    for lg in (old or {}).get("leagues", []):
        s = nrm(lg.get("country", "")) + "|" + nrm(lg.get("name", ""))
        if not any(b in s for b in BLOCKED_COUNTRIES):
            continue
        log(f"حذف بيانات {lg.get('name')} من GitHub (دوري مستبعد)...")
        for key in ("file", "adv_file", "heat_file", "pl_file", "sh_file"):
            fn = lg.get(key)
            if fn and gh_delete(hub, f"data/{fn}"):
                log(f"  تم حذف data/{fn}")

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
    inputs:
      force:
        description: "Retry incomplete recent matches immediately"
        required: false
        default: "false"
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
          FORCE_SYNC: ${{ github.event.inputs.force }}
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


def gh_dispatch(hub, force=True):
    """يشغّل المزامنة على GitHub Actions (force = يعيد محاولة المباريات الناقصة الحديثة فوراً)."""
    url = f"{GH}/repos/{hub['repo']}/actions/workflows/sync.yml/dispatches"
    r = None
    for _ in range(6):                      # أحياناً يتأخر GitHub ثواني قبل ما يشوف الملف الجديد
        body = {"ref": hub["branch"]}
        if force:
            body["inputs"] = {"force": "true"}
        r = requests.post(url, json=body, headers=gh_headers(hub["token"]), timeout=30)
        if r.status_code == 204:
            return True
        if r.status_code == 422 and force:  # الـworkflow القديم ما يعرف input اسمه force
            force = False
            continue
        if r.status_code != 404:
            break
        time.sleep(5)
    log(f"  تعذر تشغيل المزامنة على GitHub ({r.status_code}): {r.text[:150]}")
    return False


def current_source():
    """نص الكود الحالي (من خلية Colab أو من الملف) لرفعه كـ sync.py."""
    try:
        ns = get_ipython().user_ns                       # noqa: F821
        src = ns["_ih"][-1]                              # خلية Colab الحالية
        if "def main(" in src and "WORKFLOW_YML" in src:
            return src
        ps = ns.get("_PL_PARTS")                         # النسخة المقسّمة على خلايا: الأجزاء السابقة محفوظة
        if ps and "def main(" in src:
            return "\n".join(ps) + "\n" + src
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
const tbl=(h,rows)=>rows.length?`<div class="wrap"><table><tr>${h.map(x=>`<th class="${x[1]?'n':''}">${x[0]}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${h[i][1]?'n':''}">${c}</td>`).join('')}</tr>`).join('')}</table></div>`:'<div class="empty">No data yet. Press Synchronize in Settings to update the data.</div>';
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
  <p class="mu">One press fetches every new match from PitchAPI, retries recent matches whose analytics were incomplete, and then refreshes this site by itself when the new data is published. It also runs automatically on a schedule.</p>
  <div class="ctl"><input id="ghrepo" value="${esc(GH_REPO())}" placeholder="owner/repo" style="flex:1;min-width:180px"></div>
  <div class="ctl"><input id="ghtok" type="password" placeholder="GitHub token (kept on this device only)" value="${ghTok()?'••••••••':''}" style="flex:1;min-width:180px"><button class="s" id="svtok">Save</button><button class="s" id="cltok">Clear</button></div>
  <p class="mu" style="font-size:12px">Create a fine-grained token for this repository only, with the permission Actions: Read and write. It is stored in this browser and only sent to GitHub.</p>
  <div class="ctl"><button id="sy">Synchronize now</button><button class="s" id="rl">Reload data</button></div><div id="ss" class="mu"></div></div>`;
  const msg=t=>{const e=$('#ss');if(e)e.textContent=t};
  const repo=()=>((($('#ghrepo')||{}).value)||GH_REPO()).trim();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  $('#svtok').onclick=()=>{try{const v=$('#ghtok').value.trim();if(v&&!v.startsWith('•'))localStorage.setItem('gh_token',v);localStorage.setItem('gh_repo',repo());msg('Saved on this device.')}catch(e){msg('Could not save: '+e.message)}};
  $('#cltok').onclick=()=>{try{localStorage.removeItem('gh_token')}catch(e){}$('#ghtok').value='';msg('Token removed from this device.')};
  const runs=async()=>{const r=await ghApi(`/repos/${repo()}/actions/workflows/sync.yml/runs?per_page=10`);if(!r.ok)throw new Error('HTTP '+r.status);return (await r.json()).workflow_runs||[]};
  const showRun=async()=>{
   try{
    const run=(await runs())[0];
    if(!run){msg('No sync has run yet.');return}
    const when=(run.created_at||'').replace('T',' ').replace('Z',' UTC');
    msg(run.status!=='completed'?'A sync is running now ('+run.status+'), started '+when:'Last sync '+(run.conclusion==='success'?'finished OK':run.conclusion)+' · '+when);
   }catch(e){msg('Could not read sync status ('+e.message+').')}};
  if(window.SYNC_NOTE){msg(window.SYNC_NOTE);window.SYNC_NOTE=''}else showRun();
  $('#sy').onclick=async()=>{
   if(!ghTok()){msg('Save a GitHub token first.');return}
   $('#sy').disabled=true;
   try{
    const before=await runs(),lastId=before.length?before[0].id:0,prev=ALL.generated||'';
    const info=await (await ghApi('/repos/'+repo())).json();
    const ref=info.default_branch||'main';
    const send=inputs=>ghApi(`/repos/${repo()}/actions/workflows/sync.yml/dispatches`,{method:'POST',body:JSON.stringify(inputs?{ref,inputs}:{ref})});
    let r=await send({force:'true'});
    if(r.status===422)r=await send(null);
    if(r.status===404){msg('Not found (404): check the repository name, or the token has no access to it.');return}
    if(r.status===403||r.status===401){msg('Token not allowed ('+r.status+'): it needs Actions: Read and write on this repository.');return}
    if(r.status!==204){msg('GitHub answered '+r.status+'.');return}
    msg('Sync requested. Waiting for GitHub to start it…');
    let run=null;const stop=Date.now()+45*60000;
    while(Date.now()<stop){
     await sleep(10000);
     if(!$('#ss'))return;
     run=(await runs()).find(x=>x.event==='workflow_dispatch'&&x.id>lastId)||null;
     if(!run){msg('Waiting for GitHub to start the sync…');continue}
     if(run.status==='completed')break;
     msg(['queued','pending','waiting'].includes(run.status)?'Queued: another sync is still running, yours starts right after it…':'Syncing matches from PitchAPI… you can leave this page and come back.');
    }
    if(!run||run.status!=='completed'){msg('Still running. Check the Actions tab of the repository, then press Reload data.');return}
    if(run.conclusion!=='success'){msg('Sync '+run.conclusion+'. Open the Actions tab of the repository to see why.');return}
    msg('Sync finished. Waiting for the site to publish the new data…');
    for(let i=0;i<24;i++){
     const x=await fetch('data/index.json?'+Date.now());
     if(x.ok){const j=await x.json();
      if((j.generated||'')!==prev){await reloadData();window.SYNC_NOTE='Updated. Data as of '+j.generated+' UTC.';await route();return}}
     await sleep(10000);
     if(!$('#ss'))return;
    }
    msg('Sync finished and nothing new was available. Everything PitchAPI has for now is already here.');
   }catch(e){msg('Failed: '+e.message)}
   finally{const b=$('#sy');if(b)b.disabled=false}};
  $('#rl').onclick=async()=>{try{msg('Reloading…');await reloadData();msg('Data reloaded.')}catch(e){msg('Reload failed: '+e.message)}};
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
  $('#app').innerHTML=`<div class="empty">No data yet. The first sync is running in the background, reload this page in a few minutes.<br><span class="mu">${esc(e.message)}</span></div>`}
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
        try:
            prune_blocked(hub)       # يشيل الدوريات المستبعدة (البرازيلي) من GitHub
        except Exception as e:
            log(f"  تعذر تنظيف الدوريات المستبعدة: {type(e).__name__}: {e}")
        if FORCE_SYNC:
            log(f"وضع force: إعادة محاولة المباريات الناقصة اللي انلعبت خلال آخر {FORCE_RECENT_DAYS} يوم.")
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
                log("  من الحين: التحديث بزر Synchronize في الموقع، ما تحتاج ترجع تشغّل Colab.")
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
# + الدفاع + Look Like + التسديدات.
# ما تغيّر أي سطر من الكود الأصلي أعلاه: الإضافة تلفّ دوال موجودة (تستدعيها كما هي) وتضيف فوقها.
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
    CREATE TABLE IF NOT EXISTS sm(
      league_id TEXT, match_id TEXT, status TEXT, fetched_at TEXT,
      PRIMARY KEY(league_id, match_id));
    CREATE TABLE IF NOT EXISTS shot_rows(
      league_id TEXT, match_id TEXT, shot_id TEXT, pd TEXT, pid TEXT, pn TEXT, tid TEXT,
      x REAL, y REAL, xg REAL, xo REAL, ot INTEGER, gy REAL, gz REAL, ib INTEGER,
      ev TEXT, st TEXT, ty TEXT, mn REAL, ma REAL, bl INTEGER, blx REAL, bly REAL,
      og INTEGER, sl INTEGER, kid TEXT, kn TEXT,
      PRIMARY KEY(league_id, match_id, shot_id));
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


# ======================== الجزء 2 ========================
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


# ---------------- صفحة التسديدات: كل تسديدة بكل حقولها (shots endpoint) ----------------
_SH_COLS = ["pd", "pid", "pn", "tid", "x", "y", "xg", "xo", "ot", "gy", "gz", "ib", "ev", "st", "ty", "mn", "ma",
            "bl", "blx", "bly", "og", "sl", "kid", "kn"]
_SH_SQL = ("INSERT OR REPLACE INTO shot_rows(league_id,match_id,shot_id,%s) VALUES(%s)"
           % (",".join(_SH_COLS), ",".join("?" * (3 + len(_SH_COLS)))))


def _x_bool(v):
    return None if v is None else (1 if v else 0)


def _x_shotrows(res):
    """كل تسديدة كما جاءت من PitchAPI: موقع الضربة، xG، xGOT، مكان عبور خط المرمى، النتيجة، الموقف، جزء الجسم، الحارس..."""
    out = []
    for per in _g(res, "periods") or []:
        pd_ = str(_g(per, "period") or "")
        for s in _g(per, "shots") or []:
            pl = _g(s, "player")
            kp = _g(s, "keeper")
            out.append(dict(
                sid=str(_g(s, "id") or f"n{len(out)}"), pd=pd_, pid=str(_g(pl, "id") or ""), pn=_g(pl, "name") or "",
                tid=str(_g(s, "team_id") or ""), x=num(_g(s, "x")), y=num(_g(s, "y")),
                xg=num(_g(s, "expected_goals")), xo=num(_g(s, "expected_goals_on_target")),
                ot=_x_bool(_g(s, "is_on_target")), gy=num(_g(s, "goal_crossed_y")), gz=num(_g(s, "goal_crossed_z")),
                ib=_x_bool(_g(s, "is_inside_box")), ev=str(_g(s, "event_type") or "").split(".")[-1],
                st=str(_g(s, "situation") or "").split(".")[-1], ty=str(_g(s, "shot_type") or "").split(".")[-1],
                mn=num(_g(s, "minute")), ma=num(_g(s, "minute_added")), bl=_x_bool(_g(s, "is_blocked")),
                blx=num(_g(s, "blocked_x")), bly=num(_g(s, "blocked_y")), og=_x_bool(_g(s, "is_own_goal")),
                sl=_x_bool(_g(s, "is_saved_off_line")), kid=str(_g(kp, "id") or ""), kn=_g(kp, "name") or ""))
    return out


def sync_shots(client, league_id, on_progress=None):
    """يجلب كل تسديدات كل مباراة (يشمل المباريات القديمة) ويحفظها تسديدة تسديدة."""
    api_m = client.matches
    if not hasattr(api_m, "shots"):
        return
    rows = q("SELECT m.match_id, m.date, m.home, m.away, e.status, e.fetched_at FROM matches m "
             "LEFT JOIN sm e ON e.league_id=m.league_id AND e.match_id=m.match_id "
             "WHERE m.league_id=?", (league_id,))
    todo = [r for r in rows if match_due(r)]
    log(f"  [إضافي: التسديدات] مكتملة سابقاً: {sum(1 for r in rows if r['status'] == 'ok')} | المطلوب الآن: {len(todo)}")
    for i, r in enumerate(todo, 1):
        mid = r["match_id"]
        res, e = call(api_m.shots, mid)
        srows = _x_shotrows(res) if res is not None else []
        if res is not None and (_g(res, "periods") or []) and not srows:
            log("    تنبيه: shots رجّع فترات لكن بدون تسديدات (شكل الرد يختلف عن المتوقع؟)")
        if srows:
            status = "ok"
        elif e and e not in ("not_found", "plan"):
            status = "failed"
        else:
            status = "no_data"
        t = now()
        c = db()
        L = league_id
        if srows:
            c.execute("DELETE FROM shot_rows WHERE league_id=? AND match_id=?", (L, mid))
            c.executemany(_SH_SQL, [(L, mid, x["sid"]) + tuple(x[k] for k in _SH_COLS) for x in srows])
        c.execute("INSERT OR REPLACE INTO sm VALUES(?,?,?,?)", (L, mid, status, t))
        c.commit()
        c.close()
        log(f"  [{i}/{len(todo)}] {r['home']} vs {r['away']} -> {status} (تسديدات {len(srows)})")
        if on_progress and i % PUBLISH_EVERY == 0 and i < len(todo):
            on_progress()
        time.sleep(REQUEST_DELAY)


def build_sh_payload(L):
    cols = ["m", "s"] + _SH_COLS + ["c"]
    rows = []
    for r in q("SELECT p.match_id m, p.shot_id s, " + ",".join("p." + c for c in _SH_COLS) +
               ", COALESCE(a.team, p.tid) c FROM shot_rows p "
               "LEFT JOIN team_adv a ON a.league_id=p.league_id AND a.match_id=p.match_id AND a.team_id=p.tid "
               "WHERE p.league_id=? ORDER BY p.match_id, p.shot_id", (L,)):
        rows.append([round(r[k], 3) if isinstance(r[k], float) else r[k] for k in cols])
    sm = q("SELECT match_id i, status t, fetched_at f FROM sm WHERE league_id=? ORDER BY match_id", (L,))
    return dict(cols=cols, rows=rows, sm=sm)


def restore_sh(L, d):
    c = db()
    for e in d.get("sm", []):
        c.execute("INSERT OR REPLACE INTO sm VALUES(?,?,?,?)", (L, e["i"], e["t"], e.get("f")))
    cols = d.get("cols", [])
    for row in d.get("rows", []):
        x = dict(zip(cols, row))
        c.execute(_SH_SQL, (L, x["m"], x["s"]) + tuple(x.get(k) for k in _SH_COLS))
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
            sync_shots(client, league_id, on_progress)
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
           "(SELECT COUNT(*) FROM pass_stats s WHERE s.league_id=e.league_id AND s.match_id=e.match_id) k, "
           "(SELECT COUNT(*) FROM shot_rows z WHERE z.league_id=e.league_id AND z.match_id=e.match_id) s "
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
            sh = build_sh_payload(L)
            if sh["rows"]:
                entry["sh_file"] = safe_name(L) + "_sh.json"
                gh_put(_x_hub, f"data/{entry['sh_file']}",
                       json.dumps(sh, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                       f"Update {lg['name']} shots")
                entry["sh_v"] = q("SELECT MAX(fetched_at) t FROM sm WHERE league_id=?", (L,), True)["t"]
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
        L = lg["id"]
        for tbl_, fn_ in (("extras", None), ("pm", restore_pl), ("sm", restore_sh)):
            try:
                if q(f"SELECT 1 FROM {tbl_} WHERE league_id=? LIMIT 1", (L,)):
                    continue
                if tbl_ == "extras":
                    adv = gh_get_json(hub, f"data/{safe_name(L)}_adv.json")
                    if adv:
                        restore_extras(L, adv, gh_get_json(hub, f"data/{safe_name(L)}_heat.json"))
                else:
                    d = gh_get_json(hub, f"data/{safe_name(L)}_{'pl' if tbl_ == 'pm' else 'sh'}.json")
                    if d:
                        fn_(L, d)
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

_X_JS += r'''
/* ---------- Shots (reads data/*_sh.json: one row per shot, every field PitchAPI gives) ---------- */
let SHD=null;
async function loadSh(){if(SHD)return SHD;const m=lgMeta();if(!m.sh_file)return null;const d=await loadJson(m.sh_file,m.sh_v);d.rows=d.rows.map(r=>{const o={};d.cols.forEach((c,k)=>o[c]=r[k]);return o});SHD=d;return d}
const SIT={RegularPlay:'Regular play',FromCorner:'From corner',SetPiece:'Set piece',FastBreak:'Fast break',FreeKick:'Free kick',ThrowInSetPiece:'Throw-in set piece',Penalty:'Penalty',IndividualPlay:'Individual play'};
const BODY={RightFoot:'Right foot',LeftFoot:'Left foot',Header:'Header',OtherBodyParts:'Other body part'};
const SHCOL={Goal:'#4cc38a',Saved:'#5aa9e6','Off target':'#8a9bb0',Post:'#e9b44c',Blocked:'#e5646b'};
const shCls=s=>s.og?'Own goal':s.ev==='Goal'?'Goal':s.bl?'Blocked':s.ev==='AttemptSaved'?'Saved':s.ev==='Post'?'Post':s.ev==='Miss'?'Off target':(s.ev||'Unknown');
const shDist=s=>(s.x!=null&&s.y!=null)?Math.hypot(105-s.x,34-s.y):null;
/* rows must exclude own goals. Goals-minus-xG uses only shots that have an xG, so numerator and denominator cover the same shots. */
function shStats(rows){
 let g=0,gx=0,ot=0,bl=0,sv=0,po=0,pe=0,xg=0,npxg=0,xo=0,xoN=0,ib=0,ibN=0,ds=0,dn=0,xgN=0;
 rows.forEach(s=>{const c=shCls(s);if(c==='Goal')g++;if(c==='Saved')sv++;if(c==='Post')po++;if(s.ot===1)ot++;if(s.bl===1)bl++;if(s.st==='Penalty')pe++;
  if(s.xg!=null){xgN++;xg+=s.xg;if(s.st!=='Penalty')npxg+=s.xg;if(c==='Goal')gx++}
  if(s.xo!=null){xoN++;xo+=s.xo}
  if(s.ib!=null){ibN++;if(s.ib===1)ib++}
  const d=shDist(s);if(d!=null){ds+=d;dn++}});
 const n=rows.length;
 return {n,g,ot,bl,sv,po,pe,xg:xgN?xg:null,npxg:xgN?npxg:null,xo:xoN?xo:null,ib:ibN?ib/ibN*100:null,dist:dn?ds/dn:null,
  conv:n?g/n*100:null,sot:n?ot/n*100:null,sotc:ot?g/ot*100:null,xgps:xgN?xg/xgN:null,gxg:xgN?gx-xg:null};
}
let SHCUR=[];
function shSel(i){
 const s=SHCUR[i],b=$('#shd');if(!s||!b)return;
 const mm=D.matches.find(m=>m.match_id===s.m),mn=s.mn==null?'N/A':s.mn+(s.ma?'+'+s.ma:'')+"'";
 b.innerHTML=`<b>${esc(s.pn)}</b> · ${esc(s.c)}<div class="mu">${mm?esc(mm.date.slice(0,10)+'  '+mm.home+' '+mm.score+' '+mm.away)+'<br>':''}Minute ${mn} · ${esc(s.pd||'')}<br>Outcome: ${shCls(s)} · ${esc(SIT[s.st]||s.st||'N/A')} · ${esc(BODY[s.ty]||s.ty||'N/A')}<br>xG ${f(s.xg,2)} · xGOT ${f(s.xo,2)} · ${s.ib==null?'box N/A':(s.ib?'inside the box':'outside the box')}<br>Struck at x ${f(s.x,1)} m, y ${f(s.y,1)} m (${f(shDist(s),1)} m from the goal centre, derived)<br>Goal-line crossing: y ${f(s.gy,1)} m, height ${f(s.gz,2)} m${s.blx!=null?'<br>Blocked at x '+f(s.blx,1)+' m, y '+f(s.bly,1)+' m':''}${s.kn?'<br>Goalkeeper: '+esc(s.kn):''}${s.sl?'<br>Cleared off the line':''}</div>`;
}
'''

_X_JS += r'''
R.shots=async function(el){
 el.innerHTML='<h2>Shots</h2>';
 let S=null;try{S=await loadSh()}catch(e){noData(el,'Could not load shot data: '+esc(e.message));return}
 if(!S||!S.rows.length){noData(el,'No shot data for this league yet. It appears after the next synchronization.');return}
 const ALLR=S.rows,have=[...new Set(ALLR.map(r=>r.m))],ms=D.matches.filter(m=>have.includes(m.match_id)).sort(byDate);
 const uniq=k=>[...new Set(ALLR.map(r=>r[k]).filter(Boolean))].sort();
 const OUT=['Goal','Saved','Blocked','Off target','Post'];
 el.innerHTML+=`<div class="mu" style="margin-bottom:8px">${ALLR.length} shots in ${have.length} of ${D.matches.length} matches. Every figure comes from PitchAPI's shot data; own goals are left out of shooting figures.</div>
 <div class="ctl"><select id="sm">${opts([['','All matches (season)'],...ms.map(m=>[m.match_id,mlabel(m.match_id)])],'')}</select><select id="st"></select><select id="sp"></select></div>
 <div class="ctl"><select id="so">${opts([['','All outcomes'],...OUT.map(x=>[x,x])],'')}</select><select id="ss">${opts([['','All situations'],...uniq('st').map(x=>[x,SIT[x]||x])],'')}</select><select id="sb">${opts([['','All body parts'],...uniq('ty').map(x=>[x,BODY[x]||x])],'')}</select><select id="sz">${opts([['','Any zone'],['in','Inside the box'],['out','Outside the box']],'')}</select></div>
 <div class="ctl"><input id="sf" type="number" min="0" placeholder="From minute" style="width:130px"><input id="sg" type="number" min="0" placeholder="To minute" style="width:130px"><select id="sx">${opts([['g','Table sort: goals'],['n','Shots'],['xg','xG'],['conv','Conversion %'],['gxg','Goals − xG'],['xgps','xG per shot']],'g')}</select><input id="sn" type="number" min="1" value="3" style="width:120px" placeholder="Min shots">${flipBox()}</div><div id="sout"></div>`;
 const base=()=>{const m=$('#sm').value;return ALLR.filter(s=>!s.og&&(!m||s.m===m))};
 const filt=()=>{const t=$('#st').value,p=$('#sp').value,o=$('#so').value,si=$('#ss').value,b=$('#sb').value,z=$('#sz').value,a=num($('#sf').value),c=num($('#sg').value);
  return base().filter(s=>(!t||s.c===t)&&(!p||s.pid===p)&&(!o||shCls(s)===o)&&(!si||s.st===si)&&(!b||s.ty===b)&&(!z||(z==='in'?s.ib===1:s.ib===0))&&(a==null||s.mn==null||s.mn>=a)&&(c==null||s.mn==null||s.mn<=c))};
 const grp=(rows,kf)=>{const g=new Map();rows.forEach(s=>{const k=kf(s);if(k==null)return;if(!g.has(k))g.set(k,[]);g.get(k).push(s)});return g};
 const pc=(v,d)=>v==null?'N/A':f(v,d);
 const brk=(title,rows,kf,lab)=>{const g=[...grp(rows,kf).entries()].map(([k,r])=>[k,shStats(r)]).sort((a,b)=>b[1].n-a[1].n);
  return `<h3>${title}</h3>`+tbl([[title.replace('By ','')],['Shots',1],['Goals',1],['Conv. %',1],['xG',1],['xG/shot',1]],g.map(([k,s])=>[esc(lab?lab(k):k),s.n,s.g,pc(s.conv,1),pc(s.xg,2),pc(s.xgps,3)]))};
 const mb=s=>s.mn==null?null:(s.mn<=15?'0-15':s.mn<=30?'16-30':s.mn<=45?'31-45':s.mn<=60?'46-60':s.mn<=75?'61-75':s.mn<=90?'76-90':'90+');
 const tableBy=(rows,kf,nameOf,clubOf,mn,sk)=>{
  const g=[...grp(rows,kf).entries()].map(([k,r])=>({k,r,s:shStats(r)})).filter(o=>o.s.n>=mn);
  const val=o=>({g:o.s.g,n:o.s.n,xg:o.s.xg,conv:o.s.conv,gxg:o.s.gxg,xgps:o.s.xgps})[sk];
  return g.sort((a,b)=>(val(b)??-1e18)-(val(a)??-1e18)).slice(0,40).map((o,i)=>[i+1,esc(nameOf(o)),esc(clubOf(o)),o.s.n,o.s.g,pc(o.s.conv,1),o.s.ot,pc(o.s.sot,0),pc(o.s.xg,2),pc(o.s.npxg,2),pc(o.s.xgps,3),pc(o.s.xo,2),pc(o.s.gxg,2),pc(o.s.ib,0),pc(o.s.dist,1)])};
 const HEAD=[['#',1],['Name'],['Club'],['Shots',1],['Goals',1],['Conv. %',1],['On target',1],['SoT %',1],['xG',1],['npxG',1],['xG/shot',1],['xGOT',1],['G − xG',1],['Box %',1],['Avg dist (m)',1]];
 const draw=()=>{
  const out=$('#sout'),rows=filt(),flip=$('#fl').checked,s=shStats(rows),mn=num($('#sn').value)||1,sk=$('#sx').value;
  const ogN=ALLR.filter(x=>x.og&&(!$('#sm').value||x.m===$('#sm').value)).length;
  const ogA=num($('#sf').value),ogB=num($('#sg').value);
  const ogIn=ALLR.filter(x=>x.og&&(!$('#sm').value||x.m===$('#sm').value)&&(ogA==null||x.mn==null||x.mn>=ogA)&&(ogB==null||x.mn==null||x.mn<=ogB)).length;
  const noF=!($('#st').value||$('#sp').value||$('#so').value||$('#ss').value||$('#sb').value||$('#sz').value);
  if(!rows.length){out.innerHTML='<div class="empty">No shots match this selection.</div>';return}
  const kp=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  SHCUR=[...rows].sort((a,b)=>(b.xg??-1)-(a.xg??-1)).slice(0,800);
  let g='',gv='';
  SHCUR.forEach((x,i)=>{if(x.x==null||x.y==null)return;const c=shCls(x),col=SHCOL[c]||'#8a9bb0',r=x.xg==null?.9:.7+2.2*Math.sqrt(x.xg),yy=flip?68-x.y:x.y,hollow=c==='Blocked';
   g+=`<circle onclick="shSel(${i})" style="cursor:pointer" cx="${x.x.toFixed(2)}" cy="${yy.toFixed(2)}" r="${r.toFixed(2)}" fill="${hollow?'none':col}" fill-opacity=".78" stroke="${hollow?col:'#e8eef5'}" stroke-width="${c==='Goal'?.45:.25}"><title>${esc(x.pn)} ${x.mn==null?'':x.mn+"'"} · ${c} · xG ${f(x.xg,2)}</title></circle>`;
   if(x.gy!=null&&x.gz!=null){const gx=flip?68-x.gy:x.gy,gz=Math.min(x.gz,6),rr=.25+.9*Math.sqrt(x.xo??x.xg??.05);
    gv+=`<circle onclick="shSel(${i})" style="cursor:pointer" cx="${gx.toFixed(2)}" cy="${(6-gz).toFixed(2)}" r="${rr.toFixed(2)}" fill="${col}" fill-opacity=".78" stroke="#e8eef5" stroke-width=".08"><title>${esc(x.pn)} · ${c} · y ${f(x.gy,1)} m, height ${f(x.gz,2)} m</title></circle>`}});
  const map=`<svg class="pitch" viewBox="50 -2 57 72" style="max-width:520px">${PITCH_BG}${pitchLines('#4d8f6b','1')}${g}<text x="78" y="70" text-anchor="middle" font-size="2.4" fill="#8a9bb0">Attack direction →</text></svg>`;
  const goal=`<svg class="pitch" viewBox="26 0 16 6.6" style="max-width:520px"><rect x="26" y="0" width="16" height="6.6" fill="#12301f"/><line x1="26" y1="6" x2="42" y2="6" stroke="#4d8f6b" stroke-width=".08"/><rect x="30.34" y="3.56" width="7.32" height="2.44" fill="#e8eef5" fill-opacity=".06" stroke="#e8eef5" stroke-width=".12"/>${gv}</svg>`;
  const nG=SHCUR.filter(x=>x.gy!=null&&x.gz!=null).length;
  const legend=Object.entries(SHCOL).map(([k,c])=>`<span style="margin-right:10px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${k==='Blocked'?'transparent':c};border:2px solid ${c};vertical-align:middle"></span> ${k}</span>`).join('');
  out.innerHTML=`<div class="grid">${kp(s.n,'Shots')}${kp(s.g,'Goals')}${noF?kp(s.g+ogIn,'Goals incl. '+ogIn+' own goals (matches the scores)'):''}${kp(pc(s.conv,1)+'%','Conversion (goals ÷ all shots)')}${kp(s.ot+' · '+pc(s.sot,0)+'%','On target (provider flag)')}${kp(pc(s.sotc,0)+'%','Goals ÷ on target')}${kp(s.sv,'Saved')}${kp(s.bl,'Blocked')}${kp(s.po,'Hit the post')}${kp(pc(s.xg,2),'xG')}${kp(pc(s.npxg,2),'npxG (no penalties)')}${kp(pc(s.xgps,3),'xG per shot')}${kp(pc(s.xo,2),'xGOT')}${kp(pc(s.gxg,2),'Goals − xG')}${kp(pc(s.ib,0)+'%','Inside the box')}${kp(pc(s.dist,1)+' m','Avg distance to goal (derived)')}${kp(s.pe,'Penalties')}</div>
   <div class="mu" style="margin:8px 0">${legend}<br>Marker size = xG. ${SHCUR.length<rows.length?'Showing the '+SHCUR.length+' highest-xG shots of '+rows.length+'; narrow the filters to see all. ':''}Tap a shot for details. Every team attacks to the right.</div>${map}
   <h3>Goal view (where shots crossed the goal line)</h3><div class="mu" style="font-size:12px;margin-bottom:4px">${nG} of ${SHCUR.length} shown shots have goal-line coordinates (posts at the white frame; height above 6 m is drawn at 6 m).</div>${goal}
   <div class="card" id="shd" style="font-size:13px">Tap a shot for its details.</div>`+
   brk('By situation',rows,x=>x.st||null,k=>SIT[k]||k)+brk('By body part',rows,x=>x.ty||null,k=>BODY[k]||k)+brk('By outcome',rows,shCls)+brk('By minute',rows,mb)+
   `<h3>Players</h3>`+tbl([...HEAD.slice(0,1),['Player'],...HEAD.slice(2)],tableBy(rows,x=>x.pid,o=>o.r[0].pn,o=>o.r[0].c,mn,sk))+
   `<h3>Teams</h3>`+tbl(HEAD,tableBy(rows,x=>x.c,o=>o.k,o=>'',mn,sk))+
   `<div class="mu" style="font-size:12px;margin-top:8px">On target is PitchAPI's flag (also true for blocked shots heading on target). Conversion divides goals by all shots, blocked ones included. Goals − xG uses only shots that have an xG. Average distance is computed here from the shot coordinates.${ogN?' '+ogN+' own goal(s) excluded.':''} Left/right: the team's left flank is at the top; untick "Flip left/right" if a shooter looks mirrored.</div>`};
 const fillPlayers=()=>{const old=$('#sp').value,t=$('#st').value,c=new Map();
  base().filter(s=>!t||s.c===t).forEach(s=>{if(!s.pid)return;const o=c.get(s.pid)||{n:s.pn,k:0};o.k++;c.set(s.pid,o)});
  const l=[...c.entries()].sort((a,b)=>b[1].k-a[1].k).map(([k,v])=>[k,v.n+' · '+v.k]);
  $('#sp').innerHTML=opts([['','All players'],...l],c.has(old)?old:'');draw()};
 const fillTeams=()=>{const old=$('#st').value,t=[...new Set(base().map(s=>s.c).filter(Boolean))].sort();
  $('#st').innerHTML=opts([['','All teams'],...t.map(x=>[x,x])],t.includes(old)?old:'');fillPlayers()};
 $('#sm').onchange=fillTeams;$('#st').onchange=fillPlayers;
 ['sp','so','ss','sb','sz','sx'].forEach(i=>$('#'+i).onchange=draw);['sf','sg','sn'].forEach(i=>$('#'+i).oninput=draw);
 $('#fl').onchange=()=>{flipSet($('#fl').checked);draw()};
 fillTeams();
};
'''

# ======================== الجزء 3: Comparison Lab ========================
_X_CSS += (".seg{display:inline-flex;border:1px solid var(--ln);border-radius:8px;overflow:hidden}"
           ".seg button{background:var(--sf);color:var(--tx);border:0;border-radius:0;min-width:92px}"
           ".seg button.on{background:var(--g);color:#06210f}"
           ".chips{display:flex;flex-wrap:wrap;gap:6px}"
           ".chp{display:inline-flex;align-items:center;gap:6px;background:var(--sf);border:1px solid var(--ln);border-radius:99px;padding:6px 11px;font-size:13px;cursor:pointer;min-height:34px;color:var(--tx)}"
           ".chp.on{border-color:var(--g);box-shadow:inset 0 0 0 1px var(--g)}.chp.z{opacity:.45}"
           ".ecard{display:flex;align-items:center;gap:8px;background:var(--sf);border:1px solid var(--ln);border-radius:10px;padding:8px 10px;flex:1 1 230px;max-width:100%}"
           ".badge{display:inline-flex;flex:none;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0d1520}"
           ".dd{position:absolute;top:46px;left:0;right:0;max-height:300px;overflow:auto;background:var(--sf);border:1px solid var(--ln);border-radius:8px;z-index:20;display:none}"
           ".dd div{padding:10px 12px;border-bottom:1px solid var(--ln);cursor:pointer}.dd div:hover{background:#1b2c40}"
           ".clb{color:var(--g);font-weight:700}.clw{color:var(--r);font-weight:700}"
           "summary{cursor:pointer;padding:4px 0}")

_X_JS += r'''
/* ===================== Comparison Lab (players / teams) =====================
   Data comes only from files the sync already stores (PitchAPI): data/*_pl.json, *_adv.json, league file.
   Percentiles are computed here against the loaded competition (not provider percentiles). */
const CL_LIM={p:11,t:8};
const CL_COL=['#E69F00','#56B4E9','#2BC48A','#F0E442','#6C8CFF','#FF6B5E','#E78AC3','#B8A1FF','#D9D9D9','#C98B5B','#1FB5C9'];
const CL_DASH=['','7 3','2 3','9 3 2 3','1 4','5 2 1 2','12 4','3 6','8 8','1 2','4 2 1 2 1 2'];
const CL_SHAPE=['c','s','d','t','c','s','d','t','c','s','d'];
const CL_DEF={p:['xt','xg','gl','xag','kp','pr','tk','ic'],t:['gf','ga','xg','xt','ppda','hto','cpr','tk']};
const CL_PRE={p:{ST:['npxg','gl','conv','ap','sh','xag','tkw','xt'],FW:['xg','gl','xag','sca','tkw','pc','xt'],CM:['kp','pr','pc','ps','tk','ic','duw','xt'],FB:['cr','pc','kp','tk','ic','duw','pr','xt'],CB:['cl','bl','ic','tk','aerw','ap','pr','ps'],GK:['xgf','ps','pr','cl']},
 t:{Attack:['gf','xg','xt','tilt','hto'],Defence:['ga','tk','ic','blk','clr','aerp'],Pressing:['ppda','hto','cpr','z','da','ch']}};
const CL={mode:'p',ids:{p:[],t:[]},mets:{p:null,t:null},norm:'pct',per:'p90',pop:'out',minMin:450,op:null,hid:new Set(),hcols:new Set(),open:new Set(['Attacking','Expected threat (xT)','Pressing']),mq:'',showPart:true,sort:{k:null,d:-1},msg:''};
let CLC={},CLM=null;
const clOk=v=>typeof v==='number'&&isFinite(v);
const clEid=s=>encodeURIComponent(s).replace(/'/g,'%27');
const clDe=s=>decodeURIComponent(s);
const clNz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/* ---------- metric registries (every entry names its real API field) ---------- */
function clPlReg(){
 if(CLC.rp)return CLC.rp;
 const L=[],add=(id,label,cat,src,kind,dir,get,calc)=>L.push({id,label,cat,src,kind,dir,get,calc:!!calc});
 const c=k=>(a,per)=>per==='p90'?a.p90(k):(a.has(k)?a.s[k]:null);
 const AP='advanced/players → ',SH='matches/{id}/shots → ';
 add('xt','Total xT','Expected threat (xT)',AP+'possession_value.xt_total','count','higher',c('xt'));
 add('vaep','VAEP total','Possession value',AP+'possession_value.vaep_total','count','higher',c('vaep'));
 add('xg','xG','Attacking',SH+'expected_goals (summed per player)','count','higher',c('xg'));
 add('npxg','npxG','Attacking',SH+'expected_goals, situation ≠ Penalty (summed)','count','higher',c('npxg'));
 add('gl','Goals','Attacking',SH+'event_type = Goal (own goals excluded)','count','higher',c('gl'));
 add('sh','Shots','Attacking',SH+'one row per shot (own goals excluded)','count','higher',c('sh'));
 add('sot','Shots on target','Attacking',SH+'is_on_target (provider flag)','count','higher',c('sot'));
 add('fin','Goals − xG','Attacking','calculated: goals − xG','count','higher',(a,per)=>(a.has('gl')&&a.has('xg'))?(per==='p90'?a.p90('gl')-a.p90('xg'):a.s.gl-a.s.xg):null,1);
 add('conv','Goal conversion %','Attacking','calculated: goals ÷ shots','pct','higher',a=>(a.has('gl')&&a.has('sh')&&a.s.sh>0)?a.s.gl/a.s.sh*100:null,1);
 add('ast','Assists','Creation',AP+'passing.assists','count','higher',c('ast'));
 add('xag','xAG','Creation',AP+'creation.xag','count','higher',c('xag'));
 add('sca','Shot-creating actions','Creation',AP+'creation.sca','count','higher',c('sca'));
 add('gca','Goal-creating actions','Creation',AP+'creation.gca','count','higher',c('gca'));
 add('xgc','xG chain','Creation',AP+'creation.xg_chain','count','higher',c('xgc'));
 add('xgb','xG buildup','Creation',AP+'creation.xg_buildup','count','higher',c('xgb'));
 add('kp','Key passes','Passing',AP+'passing.key_passes','count','higher',c('kp'));
 add('ps','Passes','Passing',AP+'passing.passes','count','higher',c('ps'));
 add('pr','Progressive passes','Passing',AP+'passing.progressive_passes','count','higher',c('pr'));
 add('bx','Passes into box','Passing',AP+'passing.passes_into_box','count','higher',c('bx'));
 add('tb','Through balls','Passing',AP+'passing.through_balls','count','higher',c('tb'));
 add('cr','Crosses','Passing',AP+'passing.crosses','count','higher',c('cr'));
 add('ca','Carries','Carrying',AP+'carrying.carries','count','higher',c('ca'));
 add('pc','Progressive carries','Carrying',AP+'carrying.progressive_carries','count','higher',c('pc'));
 add('cb','Carries into box','Carrying',AP+'carrying.carries_into_box','count','higher',c('cb'));
 add('tko','Take-ons','Dribbling',AP+'carrying.take_ons','count','higher',c('tko'));
 add('tkw','Take-ons won','Dribbling',AP+'carrying.take_ons_won','count','higher',c('tkw'));
 add('tkr','Take-on success %','Dribbling','calculated: take-ons won ÷ take-ons','pct','higher',a=>(a.has('tko')&&a.has('tkw')&&a.s.tko>0)?a.s.tkw/a.s.tko*100:null,1);
 add('tk','Tackles','Defensive',AP+'defending.tackles','count','higher',c('tk'));
 add('ic','Interceptions','Defensive',AP+'defending.interceptions','count','higher',c('ic'));
 add('bl','Blocks','Defensive',AP+'defending.blocks','count','higher',c('bl'));
 add('cl','Clearances','Defensive',AP+'defending.clearances','count','higher',c('cl'));
 add('dact','Defensive actions (tackles + interceptions + blocks + clearances)','Defensive','calculated: sum of the four fields above','count','higher',(a,per)=>['tk','ic','bl','cl'].every(k=>a.has(k))?['tk','ic','bl','cl'].reduce((x,k)=>x+(per==='p90'?a.p90(k):a.s[k]),0):null,1);
 add('duw','Duels won','Duels',AP+'defending.duels_won','count','higher',c('duw'));
 add('aer','Aerial duels','Duels',AP+'defending.aerials','count','ctx',c('aer'));
 add('aerw','Aerial duels won','Duels',AP+'defending.aerials_won','count','higher',c('aerw'));
 add('ap','Aerial win %','Duels','calculated: aerials won ÷ aerials','pct','higher',a=>(a.has('aer')&&a.has('aerw')&&a.s.aer>0)?a.s.aerw/a.s.aer*100:null,1);
 add('gdw','Ground duels won','Duels','calculated: duels won − aerials won (assumes duels_won includes aerials; not stated in the provider docs)','count','higher',(a,per)=>(a.has('duw')&&a.has('aerw'))?(per==='p90'?a.p90('duw')-a.p90('aerw'):a.s.duw-a.s.aerw):null,1);
 add('opp','Actions in opponent half %','Positioning','heatmaps: player cells with x ≥ half ÷ all cells','pct','ctx',a=>a.s.act>0?a.s.aco/a.s.act*100:null,1);
 add('xgf','xG faced','Goalkeeping','players → xG faced (goalkeeper rows only)','count','ctx',(a,per)=>{const o=clXgf().get(a.id);if(!o||!o.n)return null;return per==='p90'?(o.mi>0?o.s/o.mi*90:null):o.s});
 return CLC.rp=L;
}
function clXgf(){
 if(CLC.xgf)return CLC.xgf;
 const m=new Map();
 for(const s of D.stats){if(s.xg_faced==null||!s.player_id)continue;let o=m.get(s.player_id);if(!o){o={s:0,mi:0,n:0};m.set(s.player_id,o)}o.s+=s.xg_faced;o.n++;if(s.minutes!=null)o.mi+=s.minutes}
 return CLC.xgf=m;
}
function clTeamReg(){
 if(CLC.rt)return CLC.rt;
 const L=[],add=(id,label,cat,src,ut,dir,calc)=>L.push({id,label,cat,src,ut,kind:'avg',dir,calc:!!calc,get:e=>clOk(e.v[id])?e.v[id]:null});
 const AD='advanced → ',TD='advanced → ';
 add('gf','Goals scored','Results','matches → score (home/away goals)','per match','higher',0);
 add('ga','Goals conceded','Results','matches → score (home/away goals)','per match','lower',0);
 add('xg','xG','Attacking','calculated: sum of player xG (shots) per match, averaged','per match','higher',1);
 add('xt','xT','Expected threat (xT)','calculated: sum of player possession_value.xt_total per match, averaged','per match','higher',1);
 add('ppda','PPDA','Pressing',AD+'defending.ppda (Σ opponent passes ÷ Σ defensive actions)','ratio','lower',1);
 add('hto','High turnovers','Pressing',TD+'defending.high_turnovers','per match','higher',0);
 add('cpr','Counterpress regains (5 s)','Pressing',TD+'defending.counterpress_regains_5s','per match','higher',0);
 add('z','Press zone fraction','Pressing',AD+'defending.press_zone_fraction','as reported','ctx',0);
 add('op','Opponent passes (PPDA numerator)','Pressing',AD+'defending.opponent_passes','per match','ctx',0);
 add('da','Defensive actions (PPDA denominator)','Pressing',AD+'defending.defensive_actions','per match','ctx',0);
 add('ch','Challenges','Pressing',AD+'defending.challenges','per match','ctx',0);
 add('tk','Tackles','Defensive',AD+'defending.tackles','per match','ctx',0);
 add('ic','Interceptions','Defensive',AD+'defending.interceptions','per match','ctx',0);
 add('blk','Blocks','Defensive',TD+'defending.blocks','per match','ctx',0);
 add('clr','Clearances','Defensive',TD+'defending.clearances','per match','ctx',0);
 add('duw','Duels won','Duels',TD+'defending.duels_won','per match','higher',0);
 add('aer','Aerial duels','Duels',TD+'defending.aerials','per match','ctx',0);
 add('aerw','Aerial duels won','Duels',TD+'defending.aerials_won','per match','higher',0);
 add('aerp','Aerial win %','Duels','calculated: Σ aerials won ÷ Σ aerials','%','higher',1);
 add('tilt','Field tilt','Territory',TD+'territory.field_tilt','as reported','ctx',0);
 add('adx','Average defensive action x','Territory',TD+'defending.avg_defensive_action_x','m','ctx',0);
 add('brt','Ball recovery time','Recovery',TD+'defending.ball_recovery_time','s','ctx',0);
 return CLC.rt=L;
}
function clTeams(){
 if(CLC.tm)return CLC.tm;
 const T=new Map(),G=n=>{let t=T.get(n);if(!t){t={id:n,n,club:'',p:'',m:0,v:{},ac:{}};T.set(n,t)}return t};
 const ac=(t,k,x)=>{if(clOk(x)){const a=t.ac[k]||(t.ac[k]={s:0,n:0});a.s+=x;a.n++}};
 for(const m of D.matches){const p=String(m.score).split('-').map(Number);if(p.length!==2||p.some(x=>!clOk(x)))continue;
  const h=G(m.home),a=G(m.away);ac(h,'gf',p[0]);ac(h,'ga',p[1]);ac(a,'gf',p[1]);ac(a,'ga',p[0])}
 const cm=new Map();
 for(const s of D.stats){if(!s.club||s.club==='Unknown')continue;const k=s.club+'|'+s.match_id;let o=cm.get(k);if(!o){o={c:s.club,xg:null,xt:null};cm.set(k,o)}
  if(s.xg!=null)o.xg=(o.xg??0)+s.xg;if(s.xt!=null)o.xt=(o.xt??0)+s.xt}
 cm.forEach(o=>{const t=G(o.c);ac(t,'xg',o.xg);ac(t,'xt',o.xt)});
 const P=CLC.P,A=CLC.A;
 for(const r of (P&&P.team)||[]){const t=G(r.n);['hto','cpr','brt','adx','blk','clr','duw','aer','aerw','tilt'].forEach(k=>ac(t,k,r[k]));if(clOk(r.aer)&&clOk(r.aerw)){ac(t,'aerS',r.aer);ac(t,'aerwS',r.aerw)}}
 for(const r of (A&&A.team)||[]){const t=G(r.n);['op','da','ch','z','tk','ic'].forEach(k=>ac(t,k,r[k]));if(clOk(r.op)&&clOk(r.da)&&r.da>0){ac(t,'opS',r.op);ac(t,'daS',r.da)}}
 const mean=['gf','ga','xg','xt','hto','cpr','brt','adx','blk','clr','duw','aer','aerw','tilt','op','da','ch','z','tk','ic'];
 T.forEach(t=>{mean.forEach(k=>{const a=t.ac[k];if(a&&a.n)t.v[k]=a.s/a.n});
  const a1=t.ac.aerS,a2=t.ac.aerwS;if(a1&&a1.s>0&&a2)t.v.aerp=a2.s/a1.s*100;
  const o=t.ac.opS,d=t.ac.daS;if(o&&d&&d.s>0)t.v.ppda=o.s/d.s;
  t.m=t.ac.gf?t.ac.gf.n:0});
 return CLC.tm=[...T.values()].filter(t=>Object.keys(t.v).length).sort((a,b)=>a.n.localeCompare(b.n));
}
const clReg=()=>CL.mode==='p'?clPlReg():clTeamReg();
const clEnts=()=>CL.mode==='p'?(CLC.ag||[]):clTeams();
const clVal=(e,m)=>CL.mode==='p'?m.get(e,CL.per):m.get(e);
const clUnit=m=>m.ut||(m.kind==='pct'?'%':(CL.per==='p90'?'per 90':'total'));
function clFmt(v,m){
 if(!clOk(v))return '—';
 if(m.kind==='pct'||m.ut==='%')return v.toFixed(1);
 if(Number.isInteger(v))return String(v);
 return Math.abs(v)<10?v.toFixed(2):v.toFixed(1);
}

/* ---------- reference population, percentiles, normalization ---------- */
function clPoolKey(e){if(CL.mode==='t')return 't';if(CL.pop==='all')return 'all';if(CL.pop==='pos'&&e.p)return 'pos:'+e.p;return e.p==='GK'?'gk':'out'}
function clPool(e){
 const all=clEnts();if(CL.mode==='t')return all;
 const k=clPoolKey(e);let pool;
 if(k==='all')pool=all;else if(k.startsWith('pos:'))pool=all.filter(x=>x.p===e.p);else if(k==='gk')pool=all.filter(x=>x.p==='GK');else pool=all.filter(x=>x.p!=='GK');
 return pool.filter(x=>x.s.mi>=CL.minMin);
}
function clPopLabel(e){
 if(CL.mode==='t')return 'all teams with data in '+D.name;
 const k=clPoolKey(e),mm=CL.minMin+'+ min';
 return (k==='all'?'all players':k.startsWith('pos:')?'players listed as '+e.p:k==='gk'?'goalkeepers':'outfield players')+' with '+mm+' in '+D.name;
}
function clSorted(m,e){
 const key=[CL.mode,m.id,CL.per,clPoolKey(e),CL.minMin].join('|'),sv=CLC.sv||(CLC.sv={});
 if(!sv[key])sv[key]=clPool(e).map(x=>clVal(x,m)).filter(clOk).sort((a,b)=>a-b);
 return sv[key];
}
/* mid-rank percentile: share of the population below x, plus half of the ties */
function clRank(arr,x){
 let lo=0,hi=arr.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(arr[mid]<x)lo=mid+1;else hi=mid}
 const a=lo;hi=arr.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(arr[mid]<=x)lo=mid+1;else hi=mid}
 return (a+(lo-a)/2)/arr.length*100;
}
function clNorm(e,m,rg){
 const raw=clVal(e,m);
 if(!clOk(raw))return {raw:null,n:null,pct:null,why:'missing'};
 const arr=clSorted(m,e),pm=CL.mode==='p'?10:6,pct=arr.length>=pm?clRank(arr,raw):null;
 let n=null,why=null;
 if(CL.norm==='pct'){if(pct==null)why='reference population too small';else n=pct}
 else n=(rg&&rg.hi>rg.lo)?(raw-rg.lo)/(rg.hi-rg.lo)*100:50;
 if(n!=null&&m.dir==='lower')n=100-n;
 return {raw,n,pct,why};
}
function clAvail(){
 const k=CL.mode+'|'+CL.per,av=CLC.av||(CLC.av={});
 if(av[k])return av[k];
 const s=new Set(),es=clEnts();
 clReg().forEach(m=>{if(es.some(e=>clOk(clVal(e,m))))s.add(m.id)});
 return av[k]=s;
}
function clModel(){
 const all=clEnts(),by=new Map(all.map(e=>[e.id,e])),reg=clReg(),rm=new Map(reg.map(m=>[m.id,m])),av=clAvail();
 const ents=CL.ids[CL.mode].filter(i=>by.has(i)).map(i=>by.get(i));
 if(CL.mets[CL.mode]==null){let d=CL_DEF[CL.mode].filter(i=>av.has(i));if(d.length<3)d=reg.filter(m=>av.has(m.id)).slice(0,6).map(m=>m.id);CL.mets[CL.mode]=d}
 const mets=CL.mets[CL.mode].filter(i=>rm.has(i)&&av.has(i)).map(i=>rm.get(i));
 const cells=new Map(),cov=[];
 mets.forEach(m=>{
  const vs=ents.map(e=>clVal(e,m)).filter(clOk),rg={lo:Math.min(...vs),hi:Math.max(...vs)};
  ents.forEach(e=>cells.set(e.id+'|'+m.id,clNorm(e,m,rg)));
  cov.push({m,have:vs.length,n:ents.length});
 });
 const axes=[],excl=[];
 cov.forEach(c=>{
  if(!ents.length)return;
  const miss=ents.filter(e=>!clOk(cells.get(e.id+'|'+c.m.id).raw)),noN=ents.filter(e=>cells.get(e.id+'|'+c.m.id).raw!=null&&cells.get(e.id+'|'+c.m.id).n==null);
  if(!miss.length&&!noN.length)axes.push(c.m);
  else excl.push({m:c.m,why:miss.length?'no value from PitchAPI for '+miss.map(e=>e.n).join(', '):'reference population too small for a percentile'});
 });
 return {all,by,reg,ents,mets,cells,cov,axes,excl};
}
function clSimilar(M){
 if(!M.ents.length||M.axes.length<2)return null;
 const f0=M.ents[M.ents.length-1],sel=new Set(M.ents.map(e=>e.id));
 const arrs=M.axes.map(m=>clSorted(m,f0));
 if(arrs.some(a=>a.length<(CL.mode==='p'?10:6)))return null;
 const vec=e=>{const o=[];for(let j=0;j<M.axes.length;j++){const v=clVal(e,M.axes[j]);if(!clOk(v))return null;o.push(clRank(arrs[j],v))}return o};
 const base=vec(f0);if(!base)return null;
 const out=[];
 clPool(f0).forEach(e=>{if(sel.has(e.id))return;const v=vec(e);if(!v)return;out.push({e,gap:Math.sqrt(v.reduce((s,x,j)=>s+(x-base[j])*(x-base[j]),0)/v.length)})});
 out.sort((a,b)=>a.gap-b.gap);
 return {f:f0,list:out.slice(0,5)};
}

/* ---------- radar (inline SVG, no library) ---------- */
function clWrap(s,n){if(s.length<=n)return [s];let a='',b='';s.split(' ').forEach(x=>{if(!b&&(a+' '+x).trim().length<=n)a=(a+' '+x).trim();else b=(b+' '+x).trim()});return (a&&b)?[a,b]:[s]}
function clMark(s,x,y,col,att,tt){
 const r=4.6,f1=v=>v.toFixed(1);let sh;
 if(s==='s')sh=`<rect x="${f1(x-r)}" y="${f1(y-r)}" width="${2*r}" height="${2*r}" fill="${col}" stroke="#0d1520"/>`;
 else if(s==='d')sh=`<polygon points="${f1(x)},${f1(y-r-1.5)} ${f1(x+r+1.5)},${f1(y)} ${f1(x)},${f1(y+r+1.5)} ${f1(x-r-1.5)},${f1(y)}" fill="${col}" stroke="#0d1520"/>`;
 else if(s==='t')sh=`<polygon points="${f1(x)},${f1(y-r-1.5)} ${f1(x+r+1.5)},${f1(y+r)} ${f1(x-r-1.5)},${f1(y+r)}" fill="${col}" stroke="#0d1520"/>`;
 else sh=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${col}" stroke="#0d1520"/>`;
 return `<g ${att}>${sh}<title>${esc(tt)}</title></g>`;
}
function clRadar(M,leg){
 const ax=M.axes,n=ax.length,W=680,cx=340,cy=290,R=178;
 const E=M.ents.map((e,i)=>({e,i})).filter(o=>!CL.hid.has(o.e.id));
 const H=590+(leg?M.ents.length*22+10:0);
 const P=(j,r)=>{const a=-Math.PI/2+2*Math.PI*j/n;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]};
 const pt=p=>p[0].toFixed(1)+','+p[1].toFixed(1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 [25,50,75,100].forEach(p=>{g+=`<polygon points="${ax.map((_,j)=>pt(P(j,R*p/100))).join(' ')}" fill="${p===100?'#152130':'none'}" stroke="#25374d" stroke-width="1"/>`});
 ax.forEach((m,j)=>{const q=P(j,R);g+=`<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="#25374d"/>`});
 [25,50,75].forEach(p=>{g+=`<text x="${cx+3}" y="${(cy-R*p/100).toFixed(1)}" font-size="10" fill="#5d6f85">${p}</text>`});
 ax.forEach((m,j)=>{
  const a=-Math.PI/2+2*Math.PI*j/n,q=P(j,R+16),c=Math.cos(a),anc=c>.3?'start':c<-.3?'end':'middle',ls=clWrap(m.label+(m.dir==='lower'?' ↓':''),14);
  g+=`<text x="${q[0].toFixed(1)}" y="${(q[1]+5-(ls.length-1)*9.5).toFixed(1)}" text-anchor="${anc}" font-size="17" fill="#e8eef5">${ls.map((t,k)=>`<tspan x="${q[0].toFixed(1)}" dy="${k?19:0}">${esc(t)}</tspan>`).join('')}</text>`});
 const op=CL.op==null?Math.max(.05,.32/Math.sqrt(Math.max(1,E.length))):CL.op/100;
 const coords=o=>ax.map((m,j)=>P(j,R*Math.max(0,Math.min(100,M.cells.get(o.e.id+'|'+m.id).n))/100));
 E.forEach(o=>{const col=CL_COL[o.i];g+=`<polygon points="${coords(o).map(pt).join(' ')}" fill="${col}" fill-opacity="${op.toFixed(2)}" stroke="${col}" stroke-width="2" stroke-dasharray="${CL_DASH[o.i]}" stroke-linejoin="round"/>`});
 E.forEach(o=>{coords(o).forEach((q,j)=>{const m=ax[j],c=M.cells.get(o.e.id+'|'+m.id);
  g+=clMark(CL_SHAPE[o.i],q[0],q[1],CL_COL[o.i],`onclick="clPick(${o.i},${j})" style="cursor:pointer"`,`${o.e.n} · ${m.label}: ${clFmt(c.raw,m)} ${clUnit(m)} · chart value ${c.n.toFixed(1)}${c.pct!=null?' · percentile '+c.pct.toFixed(1):''}`)})});
 if(leg){M.ents.forEach((e,i)=>{const y=604+i*22;g+=`<line x1="24" y1="${y}" x2="62" y2="${y}" stroke="${CL_COL[i]}" stroke-width="2.5" stroke-dasharray="${CL_DASH[i]}"/>`+clMark(CL_SHAPE[i],43,y,CL_COL[i],'','')+`<text x="74" y="${y+4}" font-size="13" fill="#e8eef5">${i+1}. ${esc(e.n)}${e.club?' — '+esc(e.club):''}</text>`})}
 return g;
}
function clPick(i,j){
 const M=CLM,b=$('#cldet');if(!M||!b)return;
 const e=M.ents[i],m=M.axes[j],c=M.cells.get(e.id+'|'+m.id);
 b.innerHTML=`<b style="color:${CL_COL[i]}">${i+1}. ${esc(e.n)}</b> <span class="mu">${esc(e.club||'')}</span><div class="mu">${esc(m.label)}: <b style="color:var(--tx)">${clFmt(c.raw,m)}</b> ${esc(clUnit(m))}${c.pct!=null?' · percentile '+c.pct.toFixed(1)+' ('+esc(clPopLabel(e))+')':''} · chart value ${c.n.toFixed(1)}${m.dir==='lower'?' (inverted: lower is better)':''}<br>Source: ${esc(m.src)} · ${m.calc?'calculated':'direct'}</div>`;
}

/* ---------- actions ---------- */
function clRender(){
 CLM=clModel();
 const set=(id,fn)=>{const el=$(id);if(el)fn(el)};
 set('#clmsg',el=>el.textContent=CL.msg);
 set('#clmp',el=>el.className=CL.mode==='p'?'on':'');set('#clmt',el=>el.className=CL.mode==='t'?'on':'');
 clSelUI(CLM);clMetUI(CLM);clChartUI(CLM);clSimUI(CLM);clTblUI(CLM);
}
function clMode(m){CL.mode=m;CL.msg='';CL.sort={k:null,d:-1};const q=$('#clq');if(q){q.value='';q.placeholder=m==='p'?'Search a player or club…':'Search a team…'}const dd=$('#cldd');if(dd)dd.style.display='none';clCtl();clRender()}
function clAdd(eid){
 const id=clDe(eid),a=CL.ids[CL.mode],lim=CL_LIM[CL.mode];
 if(a.includes(id))CL.msg='Already selected.';
 else if(a.length>=lim)CL.msg='Maximum of '+lim+(CL.mode==='p'?' players':' teams')+' reached. Remove one to add another.';
 else{a.push(id);CL.msg=''}
 const q=$('#clq');if(q)q.value='';const dd=$('#cldd');if(dd)dd.style.display='none';
 clRender();
}
function clRm(eid){const id=clDe(eid);CL.ids[CL.mode]=CL.ids[CL.mode].filter(x=>x!==id);CL.hid.delete(id);CL.msg='';clRender()}
function clHide(eid){const id=clDe(eid);if(CL.hid.has(id))CL.hid.delete(id);else CL.hid.add(id);clRender()}
function clReset(){CL.ids[CL.mode]=[];CL.hid=new Set();CL.msg='';clRender()}
function clTogM(id){const a=CL.mets[CL.mode]||[];CL.mets[CL.mode]=a.includes(id)?a.filter(x=>x!==id):[...a,id];clRender()}
function clClearM(){CL.mets[CL.mode]=[];clRender()}
function clDefM(){CL.mets[CL.mode]=null;clRender()}
function clPreset(k){const av=clAvail();CL.mets[CL.mode]=CL_PRE[CL.mode][k].filter(i=>av.has(i));clRender()}
function clSet(k,v){
 if(k==='minMin')v=Math.max(0,Number(v)||0);
 if(k==='op')v=(v==null||v==='')?null:Number(v);
 CL[k]=v;if(k==='per'||k==='pop'||k==='minMin'){CLC.sv={};CLC.av={}}
 clCtl();clRender();
}
function clMq(v){CL.mq=v;const M=CLM;if(M)clMetUI(M)}
function clTog(c,o){if(o)CL.open.add(c);else CL.open.delete(c)}
function clSort(k){CL.sort=CL.sort.k===k?{k,d:-CL.sort.d}:{k,d:-1};if(CLM)clTblUI(CLM)}
function clCol(id,on){if(on)CL.hcols.delete(id);else CL.hcols.add(id);if(CLM)clTblUI(CLM)}
function clShowPart(on){CL.showPart=on;if(CLM)clTblUI(CLM)}
function clDd(){
 const qi=$('#clq'),dd=$('#cldd');if(!qi||!dd)return;
 const q=clNz(qi.value).trim();if(!q){dd.style.display='none';return}
 const sel=new Set(CL.ids[CL.mode]);
 const l=clEnts().filter(e=>!sel.has(e.id)&&clNz(e.n+' '+(e.club||'')).includes(q)).sort((a,b)=>CL.mode==='p'?b.s.mi-a.s.mi:a.n.localeCompare(b.n)).slice(0,12);
 dd.innerHTML=l.length?l.map(e=>`<div onmousedown="clAdd('${clEid(e.id)}')"><b>${esc(e.n)}</b> <span class="mu">${esc(e.club||'')}${e.p?' · '+esc(e.p):''}${CL.mode==='p'?' · '+Math.round(e.s.mi)+' min':''}</span></div>`).join(''):'<div class="mu">No match in this competition</div>';
 dd.style.display='block';
}

/* ---------- rendering ---------- */
function clCtl(){
 const p=CL.mode==='p',el=$('#clctl');if(!el)return;
 el.innerHTML=`<div class="ctl"><select onchange="clSet('norm',this.value)">${opts([['pct','Chart value: percentile in the competition'],['sel','Chart value: relative to the selection']],CL.norm)}</select>`+
 (p?`<select onchange="clSet('per',this.value)">${opts([['p90','Per 90 minutes'],['tot','Season totals']],CL.per)}</select><select onchange="clSet('pop',this.value)">${opts([['out','Reference: outfield players (GK vs GK)'],['pos','Reference: same position'],['all','Reference: all players']],CL.pop)}</select><input type="number" min="0" value="${CL.minMin}" onchange="clSet('minMin',this.value)" style="width:140px" title="Minimum minutes for players in the reference population" placeholder="Min minutes">`:'')+
 `<label class="mu" style="align-self:center">Fill <input type="range" min="2" max="60" value="${CL.op==null?20:CL.op}" onchange="clSet('op',this.value)" style="min-height:0;width:110px"></label><button class="s" onclick="clSet('op',null)">Auto fill</button></div>`;
}
function clSelUI(M){
 const lim=CL_LIM[CL.mode],p=CL.mode==='p',el=$('#clsel');if(!el)return;
 el.innerHTML=`<div class="mu" style="margin:6px 0"><b>${M.ents.length}/${lim}</b> ${p?'players':'teams'} selected <button class="s" onclick="clReset()" style="min-height:32px;padding:4px 10px;margin-left:8px">Reset</button></div><div class="chips">`+
 M.ents.map((e,i)=>`<div class="ecard" style="${CL.hid.has(e.id)?'opacity:.5':''}"><span class="badge" style="background:${CL_COL[i]}">${i+1}</span><div style="flex:1;min-width:0"><b>${esc(e.n)}</b><div class="mu" style="font-size:12px">${esc(e.club||'')}${e.p?' · '+esc(e.p):''}${p?' · '+Math.round(e.s.mi)+' min':' · '+e.m+' matches'}</div></div><button class="s" title="Show or hide on the chart" onclick="clHide('${clEid(e.id)}')" style="min-height:32px;padding:4px 8px">${CL.hid.has(e.id)?'Show':'Hide'}</button><button class="s" title="Remove" onclick="clRm('${clEid(e.id)}')" style="min-height:32px;padding:4px 8px">✕</button></div>`).join('')+'</div>';
}
function clMetUI(M){
 const el=$('#clmet');if(!el)return;
 const reg=clReg(),av=clAvail(),sel=new Set(CL.mets[CL.mode]||[]),q=clNz(CL.mq).trim(),N=M.ents.length;
 const cov=m=>N?M.ents.filter(e=>clOk(clVal(e,m))).length:null;
 const chip=m=>{const cv=cov(m),part=cv!=null&&cv<N;return `<span class="chp ${sel.has(m.id)?'on':''} ${cv===0?'z':''}" title="${esc(m.src+(m.calc?' (calculated)':' (direct)')+(part?' · missing for some selected':''))}" onclick="clTogM('${m.id}')">${esc(m.label)}${part?` <span class="mu">⚠ ${cv}/${N}</span>`:''}</span>`};
 const list=reg.filter(m=>av.has(m.id)&&(!q||clNz(m.label+' '+m.cat+' '+m.src).includes(q)));
 const cats=[...new Set(list.map(m=>m.cat))];
 const pre=Object.keys(CL_PRE[CL.mode]).map(k=>`<button class="s" onclick="clPreset('${k}')" style="min-height:34px;padding:4px 12px">${k}</button>`).join(' ');
 el.innerHTML=`<div class="ctl"><span class="mu" style="align-self:center">Starting sets (not position limits):</span>${pre}<button class="s" onclick="clDefM()">Restore default</button><button class="s" onclick="clClearM()">Clear all</button></div>`+
 `<div class="mu" style="margin-bottom:4px">Selected metrics (${(CL.mets[CL.mode]||[]).length})</div><div class="chips" style="margin-bottom:10px">${(CL.mets[CL.mode]||[]).map(id=>reg.find(m=>m.id===id)).filter(m=>m&&av.has(m.id)).map(m=>`<span class="chp on" onclick="clTogM('${m.id}')">${esc(m.label)} ✕</span>`).join('')||'<span class="mu">None selected</span>'}</div>`+
 `<input placeholder="Search metrics…" value="${esc(CL.mq)}" oninput="clMq(this.value)" style="width:100%;margin-bottom:8px">`+
 (cats.length?cats.map(c=>`<details ${(CL.open.has(c)||q)?'open':''} ontoggle="clTog('${esc(c).replace(/'/g,'&#39;')}',this.open)" style="margin-bottom:6px"><summary class="mu">${esc(c)} (${list.filter(m=>m.cat===c).length})</summary><div class="chips" style="margin:6px 0">${list.filter(m=>m.cat===c).sort((a,b)=>(cov(b)||0)-(cov(a)||0)).map(chip).join('')}</div></details>`).join(''):'<div class="empty">No metric matches. Only metrics with real PitchAPI data in this competition are listed.</div>');
}
function clChartUI(M){
 const el=$('#clchart');if(!el)return;
 const p=CL.mode==='p';
 if(p&&!(CLC.ag||[]).length){el.innerHTML='<div class="empty">No player statistics for this competition yet. They appear after the next synchronization.</div>';return}
 if(!M.ents.length){el.innerHTML=`<div class="empty">Search and add ${p?'players':'teams'} above. Nothing is drawn until you select at least one.</div>`;return}
 const warn=M.excl.length?`<div class="card mu" style="font-size:13px"><b>Not on the radar</b> (a radar cannot draw a missing value, and missing is never turned into 0):<br>${M.excl.map(x=>'• '+esc(x.m.label)+': '+esc(x.why)).join('<br>')}<br>They stay in the table below.</div>`:'';
 if(M.axes.length<3){el.innerHTML=`<div class="empty">A radar needs at least 3 metrics with complete data for every selected ${p?'player':'team'}. ${M.axes.length} qualify right now. Add more metrics, or use the table below.</div>`+warn;return}
 const note=CL.norm==='pct'?`Chart value = percentile among ${esc(clPopLabel(M.ents[0]))}${p&&CL.pop==='pos'?' (reference depends on each player)':''}. Computed here from PitchAPI data, not a provider percentile.`:'Chart value = position between the lowest and highest selected value (0–100). It only compares the selected '+(p?'players':'teams')+' with each other.';
 el.innerHTML=`<svg id="clsvg" viewBox="0 0 680 590" style="width:100%;max-width:760px;display:block;margin:0 auto">${clRadar(M,false)}</svg><div class="card" id="cldet" style="font-size:13px">Tap a point for its value, percentile and source.</div><div class="mu" style="font-size:12px;margin-bottom:8px">${note} ↓ marks a metric where lower is better (axis inverted). Colour, line style, marker shape and number together identify each ${p?'player':'team'}.</div>`+warn;
}
function clSimUI(M){
 const el=$('#clsim');if(!el)return;
 const s=clSimilar(M);if(!s||!s.list.length){el.innerHTML='';return}
 el.innerHTML=`<div class="card"><h3 style="margin-top:0">Similar to <span style="color:${CL_COL[M.ents.length-1]}">${esc(s.f.n)}</span></h3><div class="mu" style="font-size:12px;margin-bottom:6px">Closest by average percentile gap on the ${M.axes.length} radar metrics. Tap to add.</div><div class="chips">${s.list.map(o=>`<span class="chp" onclick="clAdd('${clEid(o.e.id)}')">${esc(o.e.n)} <span class="mu">${esc(o.e.club||'')} · gap ${o.gap.toFixed(1)}</span></span>`).join('')}</div></div>`;
}
const clCols=M=>(CL.showPart?M.mets:M.axes).filter(m=>!CL.hcols.has(m.id));
function clTblUI(M){
 const el=$('#cltbl');if(!el)return;
 if(!M.ents.length){el.innerHTML='';return}
 const p=CL.mode==='p',cols=clCols(M),sk=CL.sort.k;
 const cellRaw=(e,m)=>{const c=M.cells.get(e.id+'|'+m.id);return c?c.raw:null};
 const key=(e)=>sk==='n'?e.n:sk==='mi'?(p?e.s.mi:e.m):(()=>{const m=cols.find(x=>x.id===sk);return m?cellRaw(e,m):null})();
 const rows=M.ents.map((e,i)=>({e,i}));
 if(sk)rows.sort((a,b)=>{const x=key(a.e),y=key(b.e);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return CL.sort.d*(typeof x==='string'?x.localeCompare(y):x-y)*(-1)});
 const bw=cols.map(m=>{const v=M.ents.map(e=>cellRaw(e,m)).filter(clOk);if(v.length<2||m.dir==='ctx')return null;const hi=Math.max(...v),lo=Math.min(...v);if(hi===lo)return null;return m.dir==='higher'?{b:hi,w:lo}:{b:lo,w:hi}});
 const arrow=k=>sk===k?(CL.sort.d<0?' ↓':' ↑'):'';
 const th=(k,t,sub)=>`<th class="${k==='n'?'':'n'}" style="cursor:pointer" onclick="clSort('${k}')">${esc(t)}${arrow(k)}${sub?`<div class="mu" style="font-size:11px;font-weight:400">${esc(sub)}</div>`:''}</th>`;
 el.innerHTML=`<div class="ctl"><button class="s" onclick="clCsv()">Download CSV</button><button class="s" onclick="clCopy()">Copy table</button><button class="s" onclick="clPng()">Radar image (PNG)</button><label class="mu" style="align-self:center"><input type="checkbox" ${CL.showPart?'checked':''} onchange="clShowPart(this.checked)" style="min-height:0"> Show metrics with partial data</label></div>`+
 `<details style="margin-bottom:8px"><summary class="mu">Columns</summary><div class="chips" style="margin-top:6px">${M.mets.map(m=>`<label class="mu" style="font-size:13px"><input type="checkbox" ${CL.hcols.has(m.id)?'':'checked'} onchange="clCol('${m.id}',this.checked)" style="min-height:0"> ${esc(m.label)}</label>`).join(' ')}</div></details>`+
 `<div class="wrap"><table><tr><th>#</th>${th('n','Name')}<th>Club</th><th>Pos</th>${th('mi',p?'Minutes':'Matches')}${cols.map(m=>th(m.id,m.label,clUnit(m)+(m.dir==='lower'?' · lower is better':''))).join('')}</tr>`+
 rows.map(({e,i})=>`<tr><td><span class="badge" style="background:${CL_COL[i]}">${i+1}</span></td><td><b>${esc(e.n)}</b></td><td>${esc(e.club||'')}</td><td>${esc(e.p||'—')}</td><td class="n">${p?Math.round(e.s.mi):e.m}</td>${cols.map((m,k)=>{
  const c=M.cells.get(e.id+'|'+m.id);
  if(!c||c.raw==null)return '<td class="n mu" title="Missing: PitchAPI gave no value for this metric (this is not a zero)">—</td>';
  const b=bw[k],cls=b&&c.raw===b.b?'clb':b&&c.raw===b.w?'clw':'',mk=cls==='clb'?'▲ ':cls==='clw'?'▼ ':'';
  return `<td class="n ${cls}">${mk}${clFmt(c.raw,m)}${c.pct!=null?` <span class="mu" style="font-size:11px;font-weight:400">p${c.pct.toFixed(0)}</span>`:''}</td>`}).join('')}</tr>`).join('')+
 `</table></div><div class="mu" style="font-size:12px;margin-top:6px">p = percentile in ${esc(clPopLabel(M.ents[0]))}. ▲ best / ▼ worst among the selected, shown only where higher or lower has a clear meaning. A dash means missing data.</div>`;
}
const clCsvEsc=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
function clRows(M){
 const p=CL.mode==='p',cols=clCols(M),head=['Name','Club','Position',p?'Minutes':'Matches'];
 cols.forEach(m=>{head.push(m.label+' ('+clUnit(m)+')');head.push(m.label+' percentile')});
 return [head,...M.ents.map(e=>{const r=[e.n,e.club||'',e.p||'',p?Math.round(e.s.mi):e.m];cols.forEach(m=>{const c=M.cells.get(e.id+'|'+m.id);r.push(c&&c.raw!=null?c.raw:'');r.push(c&&c.pct!=null?c.pct.toFixed(1):'')});return r})];
}
function clCsv(){
 if(!CLM||!CLM.ents.length)return;
 const t=clRows(CLM).map(r=>r.map(clCsvEsc).join(',')).join('\n'),a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download='comparison.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function clCopy(){
 if(!CLM||!CLM.ents.length)return;
 const t=clRows(CLM).map(r=>r.join('\t')).join('\n'),done=()=>{CL.msg='Table copied.';const m=$('#clmsg');if(m)m.textContent=CL.msg};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,()=>{CL.msg='Copy was blocked by the browser. Use Download CSV.';const m=$('#clmsg');if(m)m.textContent=CL.msg});
 else{CL.msg='Copy is not available here. Use Download CSV.';const m=$('#clmsg');if(m)m.textContent=CL.msg}
}
function clPng(){
 const M=CLM;if(!M||M.axes.length<3)return;
 const H=590+M.ents.length*22+10,svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1360" height="${H*2}" viewBox="0 0 680 ${H}" font-family="system-ui,Segoe UI,Roboto,sans-serif">${clRadar(M,true)}</svg>`;
 const img=new Image();
 img.onload=()=>{const c=document.createElement('canvas');c.width=1360;c.height=H*2;c.getContext('2d').drawImage(img,0,0);c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='comparison-radar.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)})};
 img.onerror=()=>{CL.msg='Could not create the image in this browser.';const m=$('#clmsg');if(m)m.textContent=CL.msg};
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

/* ---------- page ---------- */
async function clLoad(){
 let P=null,A=null,err='';
 try{P=await loadPl()}catch(e){err='Could not load player data: '+e.message}
 try{A=await loadAdv()}catch(e){A=null}
 if(CLC.D!==D.id||CLC.P!==P){CLC={D:D.id,P,A};CL.ids={p:[],t:[]};CL.mets={p:null,t:null};CL.hid=new Set();CL.hcols=new Set();CL.sort={k:null,d:-1};CL.msg=''}
 if(P&&!CLC.ag)CLC.ag=aggPl(P);
 if(!CLC.seeded){CLC.seeded=1;(CLC.ag?CMP:[]).forEach(k=>{const id=decodeURIComponent(k).split('||')[0],a=CLC.ag.find(x=>x.id===id);if(a&&!CL.ids.p.includes(a.id)&&CL.ids.p.length<CL_LIM.p)CL.ids.p.push(a.id)})}
 return err;
}
R.compare=async function(el){
 el.innerHTML='<h2>Comparison Lab</h2><div id="clroot"><div class="empty">Loading…</div></div>';
 const err=await clLoad(),root=$('#clroot');
 root.innerHTML=(err?`<div class="empty">${esc(err)}</div>`:'')+
 `<div class="card"><div class="ctl"><div class="seg"><button id="clmp" onclick="clMode('p')">Players</button><button id="clmt" onclick="clMode('t')">Teams</button></div><span class="mu" style="align-self:center">${esc(D.name)} · season: current, as last synchronized</span></div>
 <div class="ctl" style="position:relative;margin-bottom:0"><input id="clq" autocomplete="off" placeholder="Search a player or club…" style="flex:1;min-width:200px"><div id="cldd" class="dd"></div></div><div id="clmsg" class="mu" style="margin-top:4px"></div><div id="clsel"></div></div>
 <div class="card"><h3 style="margin-top:0">Metrics</h3><div id="clmet"></div></div>
 <div class="card"><div id="clctl"></div><div id="clchart"></div></div><div id="clsim"></div><div class="card"><h3 style="margin-top:0">Detailed comparison</h3><div id="cltbl"></div></div>`;
 const q=$('#clq');q.oninput=clDd;q.onfocus=clDd;q.onblur=()=>setTimeout(()=>{const d=$('#cldd');if(d&&document.activeElement!==q)d.style.display='none'},150);
 q.onkeydown=ev=>{if(ev.key==='Enter'){const f=$('#cldd').querySelector('div[onmousedown]');if(f)f.dispatchEvent(new MouseEvent('mousedown'))}};
 clCtl();clRender();
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
    h = sub(h, "['compare','Compare']", "['compare','Comparison Lab']")
    h = sub(h, "['passing','Passing'],", "['passing','Passing'],['ppda','PPDA'],['defense','Defensive'],['looklike','Look Like'],")
    h = sub(h, "AGGC=null;try{localStorage.setItem('league',D.id)}catch(e){}",
            "AGGC=null;ADV=null;HEAT=null;PLD=null;SHD=null;try{localStorage.setItem('league',D.id)}catch(e){}")
    h = sub(h, "async function route(){", _X_JS + "\nasync function route(){")
    h = sub(h, "if(PLAN[pg]){", "if(PLAN[pg]&&!R[pg]){")
    h = sub(h, "const r=await api('/api/availability');",
            "try{await loadAdv()}catch(e){}const r=await api('/api/availability');")
    h = sub(h, "tag('ni'),tag('ni'),tag('ni'),tag('ni')]))}",
            "exTag(m,'s'),exTag(m,'h'),exTag(m,'n'),tag('ni')]))}")
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
        for nm_ in ("advanced", "advanced_players", "advanced_network", "heatmaps"):
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



# ============================================================================
# إصلاحات (FIX): 1) زر Synchronize (HTTP 404)   2) مطابقة الأهداف مع نتائج المباريات
# مكان اللصق: في آخر الجزء 3، مباشرة قبل السطر:  if __name__ == "__main__":
# (لا تغيّر أي سطر آخر. لا تكتب في هذا الجزء اسم المتغيّر الخاص بالـworkflow حتى لا يختلط رفع sync.py)
# ============================================================================

# ---------------- 1) التحقق الفعلي من إعداد المزامنة على GitHub ----------------
def _x_gh_get(hub, path):
    r = requests.get(f"{GH}/repos/{hub['repo']}/{path}", headers=gh_headers(hub["token"]), timeout=30)
    try:
        msg = (r.json() or {}).get("message", "")
    except Exception:
        msg = ""
    return r.status_code, msg, r


def verify_automation(hub):
    """يتحقق بطلبات حقيقية من كل ما يحتاجه زر Synchronize. يرجع قائمة مشاكل (فاضية = سليم). لا يطبع أي مفتاح."""
    probs = []
    src = current_source()
    if not src or "def sync_shots(" not in src or "def run_pipeline(" not in src:
        probs.append("نص الكود المرفوع كـ sync.py ناقص: لازم الأجزاء 1 و2 و3 تشتغل بالترتيب في نفس الجلسة (كل جزء في خلية).")
    r = requests.get(f"{GH}/user", headers=gh_headers(hub["token"]), timeout=30)
    scopes = r.headers.get("X-OAuth-Scopes")           # يظهر لتوكن Classic فقط
    if scopes is not None and "workflow" not in [s.strip() for s in scopes.split(",")]:
        probs.append("توكن Classic ما فيه صلاحية workflow، وبدونها GitHub يرفض رفع .github/workflows/sync.yml. "
                     "أنشئ توكن جديد وعلّم repo + workflow.")
    for path in ("sync.py", ".github/workflows/sync.yml"):
        code, msg, _ = _x_gh_get(hub, f"contents/{path}?ref={hub['branch']}")
        if code != 200:
            probs.append(f"الملف {path} غير موجود في المستودع (GitHub رجّع {code}: {msg}).")
    code, msg, r = 0, "", None
    for _ in range(6):                                  # GitHub يتأخر ثواني قبل ما يسجّل الـworkflow الجديد
        code, msg, r = _x_gh_get(hub, "actions/workflows/sync.yml")
        if code == 200:
            break
        time.sleep(5)
    if code != 200:
        probs.append(f"GitHub ما يعتبر sync.yml workflow (رجّع {code}: {msg}). تأكد أن Actions مسموح: Settings ← Actions ← General.")
    else:
        state = r.json().get("state")
        if state and state != "active":
            e = requests.put(f"{GH}/repos/{hub['repo']}/actions/workflows/sync.yml/enable",
                             headers=gh_headers(hub["token"]), timeout=30)
            if e.status_code != 204:
                probs.append(f"الـworkflow حالته {state} وما قدرت أفعّله (GitHub رجّع {e.status_code}). فعّله من تبويب Actions.")
            else:
                log(f"  الـworkflow كان {state}، فعّلته تلقائياً.")
    code, msg, r = _x_gh_get(hub, "actions/permissions")
    if code == 200 and r.json().get("enabled") is False:
        probs.append("GitHub Actions معطّل لهذا المستودع: Settings ← Actions ← General ← Allow all actions.")
    code, msg, _ = _x_gh_get(hub, "actions/secrets/PITCHAPI_KEY")   # يتحقق من الوجود فقط، القيمة لا تُقرأ أبداً
    if code == 404:
        probs.append("Secret باسم PITCHAPI_KEY غير موجود في المستودع (المزامنة ستفشل بدونه).")
    elif code not in (200, 403):
        probs.append(f"تعذر التحقق من Secret باسم PITCHAPI_KEY (GitHub رجّع {code}: {msg}).")
    return probs


_orig_setup_automation = setup_automation

def setup_automation(hub, pit_key):
    _orig_setup_automation(hub, pit_key)                # يرفع الملفات ويحفظ الـSecret (ويطبع أخطاءه)
    probs = verify_automation(hub)                      # ثم نتحقق فعلياً بدل الاعتماد على رسالة النجاح
    if probs:
        log("\n⚠ زر Synchronize في الموقع لن يعمل (سيعطي HTTP 404 أو يفشل) بسبب:")
        for p in probs:
            log("  - " + p)
        return False
    log("تم التحقق من GitHub: sync.py و sync.yml و PITCHAPI_KEY موجودة والـworkflow فعّال ✔")
    return True


# ---------------- 2) مطابقة الأهداف مع النتائج ----------------
_orig_x_shotrows = _x_shotrows

def _x_shotrows(res):
    """نفس الدالة الأصلية، لكن إذا تكرر shot_id داخل المباراة نجعله فريداً بدل أن تحذف INSERT OR REPLACE تسديدة (وربما هدف)."""
    out = _orig_x_shotrows(res)
    seen, dup = {}, 0
    for x in out:
        n = seen.get(x["sid"], 0)
        seen[x["sid"]] = n + 1
        if n:
            x["sid"] = f"{x['sid']}#{n}"
            dup += 1
    if dup:
        log(f"    تنبيه: {dup} تسديدة بنفس الـid داخل المباراة — حفظتها كلها بدل ما تنكتب فوق بعض")
    return out


def _x_goal_rows(L):
    """لكل مباراة: أهداف النتيجة الرسمية مقابل أهداف أحداث التسديد (بدون عكسية) وعدد الأهداف العكسية."""
    out = []
    for r in q("SELECT m.match_id, m.date, m.home, m.away, m.score, s.status st, "
               "(SELECT COUNT(*) FROM shot_rows z WHERE z.league_id=m.league_id AND z.match_id=m.match_id "
               " AND COALESCE(z.og,0)=0 AND z.ev='Goal') g, "
               "(SELECT COUNT(*) FROM shot_rows z WHERE z.league_id=m.league_id AND z.match_id=m.match_id "
               " AND COALESCE(z.og,0)=1) o, "
               "(SELECT COUNT(*) FROM shot_rows z WHERE z.league_id=m.league_id AND z.match_id=m.match_id) n "
               "FROM matches m LEFT JOIN sm s ON s.league_id=m.league_id AND s.match_id=m.match_id "
               "WHERE m.league_id=?", (L,)):
        mt = re.fullmatch(r"(\d+)-(\d+)", str(r["score"]))
        r["tot"] = int(mt.group(1)) + int(mt.group(2)) if mt else None
        out.append(r)
    return out


def _x_requeue_short(L):
    """مباراة 'ok' فيها أهداف أقل من النتيجة: نعتبرها ناقصة فتدخل في إعادة المحاولة (بنفس فواصل match_due)."""
    short = [r for r in _x_goal_rows(L) if r["st"] == "ok" and r["tot"] is not None and r["g"] + r["o"] < r["tot"]]
    if short:
        c = db()
        c.executemany("UPDATE sm SET status='short' WHERE league_id=? AND match_id=?",
                      [(L, r["match_id"]) for r in short])
        c.commit()
        c.close()
        log(f"  [فحص الأهداف] {len(short)} مباراة أهداف تسديداتها أقل من النتيجة — عُلّمت للمحاولة من جديد")


def _x_goal_audit(L):
    rows = _x_goal_rows(L)
    chk = [r for r in rows if r["tot"] is not None and r["n"] > 0]
    ok = [r for r in chk if r["g"] + r["o"] == r["tot"]]
    short = [r for r in chk if r["g"] + r["o"] < r["tot"]]
    over = [r for r in chk if r["g"] + r["o"] > r["tot"]]
    none = [r for r in rows if r["tot"] is not None and r["n"] == 0]
    log(f"  [فحص الأهداف] تطابق: {len(ok)} | أقل من النتيجة: {len(short)} | أكثر من النتيجة: {len(over)} | "
        f"بدون بيانات تسديد: {len(none)} | أهداف عكسية موجودة في الـfeed: {sum(r['o'] for r in chk)}")
    for r in (short + over)[:15]:
        log(f"    {r['home']} {r['score']} {r['away']}: تسديدات={r['g']} + عكسي={r['o']} (الصفوف {r['n']}) [{r['st']}]")


_orig_sync_shots = sync_shots

def sync_shots(client, league_id, on_progress=None):
    try:
        _x_requeue_short(league_id)
    except Exception as e:
        log(f"  تعذر فحص الأهداف قبل الجلب: {type(e).__name__}: {e}")
    _orig_sync_shots(client, league_id, on_progress)
    try:
        _x_goal_audit(league_id)
    except Exception as e:
        log(f"  تعذر فحص الأهداف: {type(e).__name__}: {e}")


def probe_goals(pit_key, match_id):
    """للتشخيص: يطبع من رد PitchAPI الحقيقي كل سطر هدف/هدف عكسي في مباراة معيّنة (وشكل events)."""
    with PitchAPI(api_key=pit_key) as client:
        res, err = call(client.matches.shots, match_id)
        if res is None:
            log("لا يوجد رد shots:", err)
        for per in _g(res, "periods") or []:
            for s in _g(per, "shots") or []:
                ev, og = str(_g(s, "event_type")).split(".")[-1], _g(s, "is_own_goal")
                if ev == "Goal" or og:
                    log(f"  period={_g(per, 'period')} min={_g(s, 'minute')} player={_g(_g(s, 'player'), 'name')} "
                        f"team_id={_g(s, 'team_id')} event_type={ev} is_own_goal={og}")
        ev_, e2 = call(client.matches.events, match_id)
        log("\nشكل events:" if ev_ is not None else f"events: {e2}")
        if ev_ is not None:
            _x_describe(ev_, "events", 0, 3)


# ---------------- واجهة الموقع: تعديلات صغيرة (كل تعديل يتحقق أن النص الأصلي موجود مرة واحدة) ----------------
_X_FIXJS = r"""/* ===== Fix 1: GitHub diagnostics for the Synchronize button ===== */
async function ghWhy(repo,status){
 try{
  if(status===401)return 'GitHub rejected the token (401): it is wrong, expired or revoked. Create a new one, paste it above and press Save.';
  if(status===403)return 'GitHub refused the request (403): the token needs "Actions: Read and write" on this repository (classic token: repo + workflow), or the rate limit was reached.';
  const a=await ghApi('/repos/'+repo);
  if(a.status===404)return 'Repository "'+repo+'" was not found (HTTP 404). Check the owner/repo field above. If the repository is private, the token must have access to it.';
  if(a.status===401||a.status===403)return 'GitHub refused access to the repository ('+a.status+'). Check the token.';
  if(!a.ok)return 'GitHub answered '+a.status+' when reading the repository.';
  const br=(await a.json()).default_branch||'main';
  const f=await ghApi('/repos/'+repo+'/contents/.github/workflows/sync.yml?ref='+encodeURIComponent(br));
  if(f.status===404)return 'The repository exists, but .github/workflows/sync.yml is NOT in it (branch '+br+'). The automatic-sync setup did not finish. Re-run the last Colab cell and read its log: it now states what failed (usually the token lacks the workflow permission).';
  const w=await ghApi('/repos/'+repo+'/actions/workflows/sync.yml');
  if(w.status===404)return 'sync.yml exists but GitHub does not list it as a workflow. Check Settings > Actions > General: Actions must be allowed for this repository.';
  if(w.ok){const j=await w.json();if(j.state&&j.state!=='active')return 'The workflow is "'+j.state+'". Open the Actions tab and enable it.'}
 }catch(e){return 'Could not diagnose the problem ('+e.message+').'}
 return 'GitHub answered '+status+', but the repository, the workflow file and the workflow all look fine. Open the Actions tab of the repository.';
}
async function ghFail(repo,id){
 try{
  const r=await ghApi('/repos/'+repo+'/actions/runs/'+id+'/jobs');if(!r.ok)return '';
  const st=[];((await r.json()).jobs||[]).forEach(j=>(j.steps||[]).forEach(s=>{if(s.conclusion==='failure')st.push(s.name)}));
  return st.length?'Failed step: '+st.join(', ')+'.':'';
 }catch(e){return ''}
}
/* ===== Fix 2: goals in shots vs official scores ===== */
let SHLAST=[];
function shRecon(S){
 const by=new Map();
 S.rows.forEach(r=>{let o=by.get(r.m);if(!o){o={n:0,g:0,og:0,pd:{}};by.set(r.m,o)}
  o.n++;
  if(r.og)o.og++;
  else if(r.ev==='Goal'){o.g++;const p=r.pd||'?';o.pd[p]=(o.pd[p]||0)+1}});
 const sm=new Map((S.sm||[]).map(e=>[e.i,e.t]));
 return D.matches.map(m=>{
  const mt=/^(\d+)-(\d+)$/.exec(String(m.score)),tot=mt?+mt[1]+ +mt[2]:null,o=by.get(m.match_id)||null,got=o?o.g+o.og:null;
  return {m,tot,o,got,sst:sm.get(m.match_id)||'not fetched',diff:(tot!=null&&got!=null)?got-tot:null,
   state:tot==null?'noscore':!o?'noshots':got===tot?'ok':got<tot?'short':'over'}});
}
function shReconSum(S,mid){
 const R=shRecon(S).filter(x=>!mid||x.m.match_id===mid),sc=R.filter(x=>x.tot!=null),cov=sc.filter(x=>x.o),miss=sc.filter(x=>!x.o);
 const sum=(a,f)=>a.reduce((t,x)=>t+f(x),0),og=sum(cov,x=>x.o.og),got=sum(cov,x=>x.got);
 return {cov,miss,bad:cov.filter(x=>x.diff!==0),off:sum(cov,x=>x.tot),got,og,gs:got-og,mg:sum(miss,x=>x.tot)};
}
function shReconKpi(S,mid,kp){
 const r=shReconSum(S,mid);
 return kp(r.gs+' + '+r.og,'Goals from shots + own goals (own goals are credited to no player)')+
  kp(r.got+' / '+r.off,'Shot-data goals / official score goals, same '+r.cov.length+' matches')+
  kp(r.bad.length,'Matches that do not reconcile')+
  (r.miss.length?kp(r.miss.length+' · '+r.mg,'Matches with no shot data · their official goals'):'');
}
function shReconHtml(S,mid){
 const r=shReconSum(S,mid),rows=[...r.bad,...r.miss];
 if(!rows.length)return '<h3>Goal check</h3><div class="card" style="font-size:13px">Every match with shot data reconciles with its official score (goals in shots + own goals = score).</div>';
 const why=x=>x.state==='noshots'?(x.sst==='not fetched'?'Shot data not fetched yet':'Shot data status: '+x.sst):
  x.state==='short'?(x.o.og?'Fewer goals than the score although own-goal rows exist':'Fewer goals than the score and no own-goal rows: the feed may not list own goals, or shots are missing'):
  'More goals in shots than in the score: see the periods column';
 const per=x=>x.o?(Object.entries(x.o.pd).map(([k,v])=>k+': '+v).join(', ')||'-'):'-';
 return '<h3>Goal check (shots vs official score)</h3>'+
  tbl([['Date'],['Match'],['Score',1],['Goals in shots',1],['Own goals',1],['Diff',1],['Shot data'],['Goals by period'],['Why']],
   rows.slice(0,60).map(x=>[esc(String(x.m.date).slice(0,10)),mlink(x.m),x.tot,x.o?x.o.g:'N/A',x.o?x.o.og:'N/A',x.diff==null?'N/A':(x.diff>0?'+':'')+x.diff,esc(x.sst),esc(per(x)),why(x)]))+
  '<div class="mu" style="font-size:12px;margin-top:6px">'+(rows.length>60?'Showing 60 of '+rows.length+' matches. ':'')+'Difference = (goals in shots + own goals) minus the official score. Nothing is estimated: a match that differs is listed as it is.</div>';
}
function shCover(rows,what,mn){
 const sh=SHLAST,sg=sh.reduce((a,o)=>a+o.s.g,0),n=new Set(rows.map(x=>what==='players'?x.pid:x.c)).size;
 return '<div class="mu" style="font-size:12px;margin:4px 0 10px">This table lists '+sh.length+' of '+n+' '+what+' (top 40 with at least '+mn+' shots) and accounts for '+sg+' of the '+shStats(rows).g+' goals from shots in the current selection.'+(sg<shStats(rows).g?' The other goals belong to '+what+' outside this list, so adding up a table will not reach the total.':'')+'</div>';
}
"""


def _x_fix_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (إصلاح): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "async function reloadData(){", _X_FIXJS + "\nasync function reloadData(){")
    h = sub(h, "if(!r.ok)throw new Error('HTTP '+r.status);return (await r.json()).workflow_runs||[]};",
            "if(!r.ok)throw new Error(await ghWhy(repo(),r.status));return (await r.json()).workflow_runs||[]};")
    h = sub(h, "if(r.status===404){msg('Not found (404): check the repository name, or the token has no access to it.');return}",
            "if(r.status===404){msg(await ghWhy(repo(),404));return}")
    h = sub(h, "if(r.status!==204){msg('GitHub answered '+r.status+'.');return}",
            "if(r.status!==204){let b='';try{b=(await r.json()).message||''}catch(e){}msg('GitHub answered '+r.status+(b?': '+b:'')+'.');return}")
    h = sub(h, "if(run.conclusion!=='success'){msg('Sync '+run.conclusion+'. Open the Actions tab of the repository to see why.');return}",
            "if(run.conclusion!=='success'){msg('Sync '+run.conclusion+'. '+await ghFail(repo(),run.id)+' Open the Actions tab of the repository for the full log.');return}")
    h = sub(h, "${noF?kp(s.g+ogIn,'Goals incl. '+ogIn+' own goals (matches the scores)'):''}",
            "${noF?((ogA==null&&ogB==null)?shReconKpi(S,$('#sm').value,kp):kp(ogIn,'Own goals in this minute range (credited to no player)')):''}")
    h = sub(h, "return g.sort((a,b)=>(val(b)??-1e18)-(val(a)??-1e18)).slice(0,40).map((o,i)=>[i+1,",
            "return (SHLAST=g.sort((a,b)=>(val(b)??-1e18)-(val(a)??-1e18)).slice(0,40)).map((o,i)=>[i+1,")
    h = sub(h, "tableBy(rows,x=>x.pid,o=>o.r[0].pn,o=>o.r[0].c,mn,sk))+",
            "tableBy(rows,x=>x.pid,o=>o.r[0].pn,o=>o.r[0].c,mn,sk))+shCover(rows,'players',mn)+")
    h = sub(h, "tableBy(rows,x=>x.c,o=>o.k,o=>'',mn,sk))+",
            "tableBy(rows,x=>x.c,o=>o.k,o=>'',mn,sk))+shCover(rows,'teams',mn)+"
            "((noF&&ogA==null&&ogB==null)?shReconHtml(S,$('#sm').value):'')+")
    return h


INDEX = _x_fix_index(INDEX)
# ======================== نهاية الإصلاحات ========================


# ============================================================================
# إضافة Fantasy (FPL — الدوري الإنجليزي) — الصقها في ملفك الموحّد قبل السطر:  if __name__ == "__main__":
# (بعد إضافة إصلاحات Synchronize/الأهداف). لا تحتاج مفتاح: واجهة FPL مجانية، لكن لازم تمر عبر المزامنة
# (المتصفح ما يقدر يطلبها مباشرة بسبب CORS). تُجلب مرة كل ساعة كحد أقصى، وزر Synchronize يفرض الجلب.
# ============================================================================
FPL_ENABLED = True
FPL_API = "https://fantasy.premierleague.com/api/"
FPL_MIN_INTERVAL_MIN = 55          # أقل فاصل بين جلبتين (الأسعار تتغير ليلاً فقط)
FPL_DELAY = 0.12
FPL_INDEX = {}                     # يدخل في data/index.json
_FPL_UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
_FPL_NUM = ["now_cost", "cost_change_start", "total_points", "event_points", "points_per_game", "form",
            "selected_by_percent", "minutes", "starts", "goals_scored", "assists", "clean_sheets", "goals_conceded",
            "saves", "bonus", "bps", "influence", "creativity", "threat", "ict_index", "expected_goals",
            "expected_assists", "expected_goal_involvements", "expected_goals_conceded", "transfers_in_event",
            "transfers_out_event", "yellow_cards", "red_cards", "own_goals", "penalties_missed", "penalties_saved",
            "defensive_contribution", "chance_of_playing_next_round", "ep_next"]
_FPL_HIST = ["round", "total_points", "value", "minutes", "expected_goals", "expected_assists", "bonus",
             "opponent_team", "was_home"]


def _fpl_get(path, tries=3):
    """(json, status). 503 = اللعبة تتحدّث، نعيد المحاولة ثم نكمل بالبيانات القديمة."""
    last = None
    for i in range(tries):
        try:
            r = requests.get(FPL_API + path, headers=_FPL_UA, timeout=40)
            if r.status_code == 200:
                return r.json(), 200
            last = r.status_code
            if r.status_code in (403, 404):
                break
        except Exception as e:
            last = type(e).__name__
        time.sleep(5 * (i + 1))
    return None, last


def _fpl_build(boot, fixtures, old, fetch):
    """يبني ملف data/fpl.json. fetch(path) ترجع json أو None (لتسهّل الاختبار)."""
    cols = ["id", "wn", "fn", "sn", "tm", "ty", "st", "nw"] + _FPL_NUM
    rows, ix = [], {}
    for e in boot.get("elements", []):
        row = [e.get("id"), e.get("web_name"), e.get("first_name"), e.get("second_name"), e.get("team"),
               e.get("element_type"), e.get("status"), e.get("news") or ""]
        for k in _FPL_NUM:
            row.append(num(e.get(k)))
        rows.append(row)
    for i, c in enumerate(cols):
        ix[c] = i
    old_rows = {r[0]: r for r in (old or {}).get("rows", [])}
    hist = dict((old or {}).get("hist", {}))
    todo = []
    for r in rows:
        pid_ = r[0]
        if not (r[ix["minutes"]] or 0) > 0:
            continue
        o = old_rows.get(pid_)
        same = o is not None and o[ix["minutes"]] == r[ix["minutes"]] and o[ix["total_points"]] == r[ix["total_points"]]
        if str(pid_) not in hist or not same:
            todo.append(pid_)
    log(f"  [Fantasy] لاعبين: {len(rows)} | سجل المباريات المطلوب جلبه: {len(todo)}")
    for n, pid_ in enumerate(todo, 1):
        d = fetch(f"element-summary/{pid_}/")
        if d is None:
            continue
        hist[str(pid_)] = [[num(h.get(k)) if k != "was_home" else (1 if h.get(k) else 0) for k in _FPL_HIST]
                           for h in d.get("history", [])]
        if n % 100 == 0:
            log(f"    {n}/{len(todo)}")
        time.sleep(FPL_DELAY)
    teams = [dict(id=t["id"], n=t.get("name"), s=t.get("short_name"), st=t.get("strength")) for t in boot.get("teams", [])]
    events = [dict(id=e["id"], name=e.get("name"), fin=bool(e.get("finished")), cur=bool(e.get("is_current")),
                   nxt=bool(e.get("is_next")), dl=e.get("deadline_time"), avg=e.get("average_entry_score"))
              for e in boot.get("events", [])]
    fix = [[f.get("event"), f.get("team_h"), f.get("team_a"), f.get("team_h_difficulty"),
            f.get("team_a_difficulty"), 1 if f.get("finished") else 0]
           for f in (fixtures or []) if f.get("event")]
    return dict(generated=now(), cols=cols, rows=rows, teams=teams, events=events, fix=fix,
                hist=hist, hcols=["r", "pts", "val", "min", "xg", "xa", "bon", "opp", "h"])


def sync_fpl(hub):
    global FPL_INDEX
    if not FPL_ENABLED:
        return
    old = gh_get_json(hub, "data/fpl.json")
    if old and old.get("generated"):
        FPL_INDEX = dict(file="fpl.json", v=old["generated"])
        t = _parse_ts(old["generated"])
        if (not FORCE_SYNC and t is not None
                and (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 60 < FPL_MIN_INTERVAL_MIN):
            log("  [Fantasy] البيانات حديثة — تخطيت الجلب")
            return
    boot, st = _fpl_get("bootstrap-static/")
    if boot is None:
        log(f"  [Fantasy] تعذر جلب FPL ({st}) — أبقيت آخر بيانات محفوظة")
        return
    fixtures, _ = _fpl_get("fixtures/")
    payload = _fpl_build(boot, fixtures, old, lambda p: _fpl_get(p, tries=2)[0])
    gh_put(hub, "data/fpl.json", json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
           "Update Fantasy data")
    FPL_INDEX = dict(file="fpl.json", v=payload["generated"])
    log(f"  [Fantasy] تم النشر: {len(payload['rows'])} لاعب، {len(payload['hist'])} سجل")


_orig_run_pipeline_fpl = run_pipeline

def run_pipeline(hub, pit_key):
    try:
        sync_fpl(hub)
    except Exception as e:      # أي خطأ في الفانتازي ما يوقف بقية المزامنة
        log(f"  [Fantasy] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return _orig_run_pipeline_fpl(hub, pit_key)


_orig_gh_put_fpl = gh_put

def gh_put(hub, path, content, message):
    if path == "data/index.json" and FPL_INDEX:
        try:
            d = json.loads(content.decode("utf-8"))
            d["fpl"] = FPL_INDEX
            content = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        except Exception as e:
            log(f"  تنبيه: ما قدرت أضيف Fantasy للفهرس: {e}")
    return _orig_gh_put_fpl(hub, path, content, message)


# ---------------- الواجهة ----------------
_X_FPJS = r"""/* ===== Fantasy (FPL) ===== */
let FPD=null,FPK='',FPLINK=null;
const FP={tab:'table',sel:[],sort:{k:'tp',d:-1},q:'',pos:'',team:'',maxp:'',minm:'0',av:'',sx:'price',sy:'tp',sp:'',sm:'90',vm:'pm',vp:'',vmin:'270',vmax:'',tm:'tp',cq:''};
const FPPOS={1:'GKP',2:'DEF',3:'MID',4:'FWD'},FPCOL={1:'#e9b44c',2:'#5aa9e6',3:'#4cc38a',4:'#e5646b'};
const FPPAL=['#E69F00','#56B4E9','#2BC48A','#F0E442','#FF6B5E','#B8A1FF'],FPDASH=['','7 3','2 3','9 3 2 3','1 4','5 2 1 2'];
const fpOk=v=>typeof v==='number'&&isFinite(v);
const fpNz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const FPAL={'man city':'manchester city','man utd':'manchester united','spurs':'tottenham','nott m forest':'nottingham forest','wolves':'wolverhampton'};
const fpTeamEq=(a,b)=>{a=fpNz(a);b=fpNz(b);a=FPAL[a]||a;b=FPAL[b]||b;return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))};
/* metric: [id, label, getter, digits]. A missing value stays null, it is never turned into 0 */
const FPM=[
 ['price','Price (£m)',p=>p.price,1],['tp','Total points',p=>p.total_points,0],['ppg','Points per game',p=>p.points_per_game,1],
 ['p90','Points per 90',p=>p.minutes>0&&fpOk(p.total_points)?p.total_points/p.minutes*90:null,2],
 ['pm','Points per £m',p=>p.price>0&&fpOk(p.total_points)?p.total_points/p.price:null,1],
 ['form','Form',p=>p.form,1],['min','Minutes',p=>p.minutes,0],['own','Ownership %',p=>p.selected_by_percent,1],
 ['g','Goals',p=>p.goals_scored,0],['a','Assists',p=>p.assists,0],['cs','Clean sheets',p=>p.clean_sheets,0],
 ['bon','Bonus',p=>p.bonus,0],['bps','BPS',p=>p.bps,0],
 ['xg','xG (FPL)',p=>p.expected_goals,2],['xa','xA (FPL)',p=>p.expected_assists,2],['xgi','xGI (FPL)',p=>p.expected_goal_involvements,2],
 ['xgi90','xGI per 90 (FPL)',p=>p.minutes>0&&fpOk(p.expected_goal_involvements)?p.expected_goal_involvements/p.minutes*90:null,2],
 ['xgipm','xGI per £m',p=>p.price>0&&fpOk(p.expected_goal_involvements)?p.expected_goal_involvements/p.price:null,2],
 ['ict','ICT index',p=>p.ict_index,1],['inf','Influence',p=>p.influence,1],['cre','Creativity',p=>p.creativity,1],['thr','Threat',p=>p.threat,1],
 ['chg','Price change since start (£m)',p=>p.chg,1],['tin','Transfers in (this GW)',p=>p.transfers_in_event,0],['tout','Transfers out (this GW)',p=>p.transfers_out_event,0],
 ['pxt','xT per 90 (PitchAPI)',p=>p.px?p.px.xt90:null,3],['pxg','xG per 90 (PitchAPI)',p=>p.px?p.px.xg90:null,3]];
const fpM=id=>FPM.find(m=>m[0]===id)||FPM[0];
async function fpLoad(){
 const m=ALL.fpl;if(!m||!m.file)return null;
 if(FPD&&FPK===(m.v||''))return FPD;
 const r=await fetch('data/'+m.file+'?v='+encodeURIComponent(m.v||''));
 if(!r.ok)throw new Error(m.file+' (HTTP '+r.status+')');
 const d=await r.json();d.T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=d.T.get(o.tm)||{};
  o.tn=t.s||'?';o.tf=t.n||'?';o.pos=o.ty;o.name=o.wn;o.price=fpOk(o.now_cost)?o.now_cost/10:null;o.chg=fpOk(o.cost_change_start)?o.cost_change_start/10:null;return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));FPD=d;FPK=m.v||'';FPLINK=null;return d;
}
/* Links FPL players to PitchAPI players of the loaded Premier League data (by team + name). Only unique matches are used. */
function fpLink(){
 const key=(D?D.id:'')+'|'+(ALL.generated||'')+'|'+FPK;if(FPLINK&&FPLINK.key===key)return FPLINK;
 const out={key,map:new Map(),on:false,n:0,tot:0},pl=ALL.leagues.find(l=>l.id===D.id)||{};
 FPLINK=out;
 if(!/premier league/i.test(D.name)||!/engl/i.test(pl.country||''))return out;
 out.on=true;const rows=agg();
 FPD.P.forEach(p=>{
  const wantsIt=(p.minutes||0)>0;if(wantsIt)out.tot++;
  const full=fpNz(p.fn+' '+p.sn),wn=fpNz(p.name),sn=fpNz(p.sn).split(' ').pop(),wl=wn.split(' ').pop(),fi=fpNz(p.fn).charAt(0);
  const cands=rows.filter(r=>fpTeamEq(p.tf,r.club));let hit=null;
  const ex=cands.filter(r=>{const n=fpNz(r.player);return n===full||n===wn});
  if(ex.length===1)hit=ex[0];
  else{
   const c2=cands.filter(r=>{const t=fpNz(r.player).split(' '),l=t[t.length-1];return l===sn||l===wl});
   if(c2.length===1)hit=c2[0];
   else if(c2.length>1){const c3=c2.filter(r=>fpNz(r.player).charAt(0)===fi);if(c3.length===1)hit=c3[0]}
  }
  if(hit){out.map.set(p.id,hit);p.px=hit;if(wantsIt)out.n++}else p.px=null;
 });
 return out;
}
function fpFilt(P,o){
 const q=fpNz(o.q||''),mm=+o.minm||0;
 return P.filter(p=>(!o.pos||p.pos===+o.pos)&&(!o.team||p.tm===+o.team)&&(o.maxp===''||o.maxp==null||(p.price!=null&&p.price<=+o.maxp))&&(mm<=0||(p.minutes||0)>=mm)&&(!q||fpNz(p.fn+' '+p.sn+' '+p.name).includes(q))&&(!o.av||(o.av==='ok'?p.st==='a':p.st!=='a')));
}
const fpOpts=(a,s)=>a.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(s)?'selected':''}>${esc(t)}</option>`).join('');
const fpPosOpts=s=>fpOpts([['','All positions'],...[1,2,3,4].map(k=>[String(k),FPPOS[k]])],s);
const fpTeamOpts=s=>fpOpts([['','All teams'],...FPD.teams.map(t=>[String(t.id),t.n])],s);
const fpMetOpts=s=>fpOpts(FPM.filter(m=>FPLINK.on||!/PitchAPI/.test(m[1])).map(m=>[m[0],m[1]]),s);
function fpMsg(t){const e=$('#fpmsg');if(e)e.textContent=t}
function fpAdd(id){
 if(FP.sel.includes(id))fpMsg('Already in the comparison.');
 else if(FP.sel.length>=6)fpMsg('Maximum of 6 players. Remove one first.');
 else{FP.sel.push(id);fpMsg((FPD.PB.get(id)||{}).name+' added to Compare ('+FP.sel.length+').')}
 if(FP.tab==='compare')fpRender();
}
function fpRm(id){FP.sel=FP.sel.filter(x=>x!==id);fpRender()}
function fpTab(k){FP.tab=k;fpRender()}
const fpBars=(items)=>{const mx=Math.max(...items.map(i=>Math.abs(i.v)),1e-9);
 return items.map(i=>`<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><div style="width:42%;min-width:110px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.l)} <span class="mu">${esc(i.s||'')}</span></div><div style="flex:1;background:var(--ln);border-radius:3px;height:12px"><div style="width:${(Math.abs(i.v)/mx*100).toFixed(1)}%;height:12px;border-radius:3px;background:${i.c||'#5aa9e6'}"></div></div><div style="width:64px;text-align:right;font-variant-numeric:tabular-nums">${esc(i.t)}</div></div>`).join('')};
function fpScatter(pts,xm,ym){
 if(pts.length<2)return '<div class="empty">Not enough players with a value for both metrics.</div>';
 const W=680,H=430,L=54,B=42,T=12,Rr=16,xs=pts.map(a=>a.x),ys=pts.map(a=>a.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 const sx=v=>L+(W-L-Rr)*(v-x0)/((x1-x0)||1),sy=v=>H-B-(H-B-T)*(v-y0)/((y1-y0)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let i=0;i<=5;i++){const xv=x0+(x1-x0)*i/5,yv=y0+(y1-y0)*i/5;
  g+=`<line x1="${sx(xv).toFixed(1)}" y1="${T}" x2="${sx(xv).toFixed(1)}" y2="${H-B}" stroke="#25374d" stroke-width=".6"/><text x="${sx(xv).toFixed(1)}" y="${H-B+15}" text-anchor="middle" font-size="11" fill="#8a9bb0">${xv.toFixed(xm[3])}</text>`+
  `<line x1="${L}" y1="${sy(yv).toFixed(1)}" x2="${W-Rr}" y2="${sy(yv).toFixed(1)}" stroke="#25374d" stroke-width=".6"/><text x="${L-6}" y="${(sy(yv)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${yv.toFixed(ym[3])}</text>`}
 g+=`<text x="${(L+W-Rr)/2}" y="${H-6}" text-anchor="middle" font-size="12" fill="#e8eef5">${esc(xm[1])}</text><text transform="translate(13 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#e8eef5">${esc(ym[1])}</text>`;
 pts.forEach(a=>{g+=`<circle onclick="fpPick(${a.p.id})" style="cursor:pointer" cx="${sx(a.x).toFixed(1)}" cy="${sy(a.y).toFixed(1)}" r="4.2" fill="${FPCOL[a.p.pos]||'#8a9bb0'}" fill-opacity=".75" stroke="#0d1520" stroke-width=".6"><title>${esc(a.p.name)} (${esc(a.p.tn)}): ${a.x.toFixed(xm[3])} / ${a.y.toFixed(ym[3])}</title></circle>`});
 const nx=v=>(v-x0)/((x1-x0)||1),ny=v=>(v-y0)/((y1-y0)||1);
 [...pts].sort((p,q)=>(nx(q.x)+ny(q.y))-(nx(p.x)+ny(p.y))).slice(0,8).forEach(a=>{g+=`<text x="${(sx(a.x)+6).toFixed(1)}" y="${(sy(a.y)-6).toFixed(1)}" font-size="10.5" fill="#e8eef5" stroke="#0d1520" stroke-width=".8" paint-order="stroke" style="pointer-events:none">${esc(a.p.name)}</text>`});
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;display:block;margin:0 auto">${g}</svg>`;
}
function fpPick(id){
 const p=FPD.PB.get(id),b=$('#fpd');if(!p||!b)return;
 b.innerHTML=`<b>${esc(p.fn+' '+p.sn)}</b> · ${esc(p.tf)} · ${FPPOS[p.pos]}<div class="mu">£${f(p.price,1)}m · ${f(p.total_points,0)} pts · form ${f(p.form,1)} · ${f(p.minutes,0)} min · owned ${f(p.selected_by_percent,1)}%${p.nw?'<br>News: '+esc(p.nw):''}</div><button class="s" onclick="fpAdd(${id})" style="margin-top:6px">Add to Compare</button>`;
}
function fpLines(series,gws,title,dig){
 const vals=series.flatMap(s=>s.v.filter(fpOk));
 if(!gws.length||!vals.length)return `<div class="empty">${esc(title)}: no match history yet.</div>`;
 const W=680,H=250,L=46,B=28,T=10,Rr=12,lo=Math.min(...vals),hi=Math.max(...vals),sx=i=>L+(W-L-Rr)*(gws.length>1?i/(gws.length-1):.5),sy=v=>H-B-(H-B-T)*(v-lo)/((hi-lo)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W-Rr}" y2="${sy(v).toFixed(1)}" stroke="#25374d" stroke-width=".6"/><text x="${L-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${v.toFixed(dig)}</text>`}
 const step=Math.max(1,Math.ceil(gws.length/12));gws.forEach((w,i)=>{if(i%step===0)g+=`<text x="${sx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#8a9bb0">${w}</text>`});
 series.forEach((s,k)=>{let d='',pen=false;s.v.forEach((v,i)=>{if(!fpOk(v)){pen=false;return}d+=(pen?'L':'M')+sx(i).toFixed(1)+' '+sy(v).toFixed(1)+' ';pen=true});
  g+=`<path d="${d}" fill="none" stroke="${FPPAL[k]}" stroke-width="2.2" stroke-dasharray="${FPDASH[k]}" stroke-linejoin="round"/>`;
  s.v.forEach((v,i)=>{if(fpOk(v))g+=`<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3" fill="${FPPAL[k]}"><title>${esc(s.n)} · GW ${gws[i]}: ${v.toFixed(dig)}</title></circle>`})});
 return `<div class="mu" style="margin:6px 0 2px">${esc(title)} (gameweek on the x axis)</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;display:block;margin:0 auto">${g}</svg>`;
}
/* per-gameweek values of one player from the stored history: points and minutes add up in a double gameweek, price takes the last row */
function fpHist(id,k){
 const idx={pts:1,val:2,min:3,xg:4,xa:5,bon:6}[k],m=new Map();
 ((FPD.hist||{})[String(id)]||[]).forEach(h=>{const v=h[idx];if(!fpOk(v))return;const r=h[0];
  m.set(r,(k==='val')?v/10:(m.get(r)||0)+v)});
 return m;
}
function fpSeries(ids,k){
 const ms=ids.map(id=>fpHist(id,k)),gws=[...new Set(ms.flatMap(m=>[...m.keys()]))].sort((a,b)=>a-b);
 let series=ids.map((id,i)=>({n:FPD.PB.get(id).name,v:gws.map(g=>ms[i].has(g)?ms[i].get(g):null)}));
 return {gws,series};
}
function fpHeader(d){
 const cur=d.events.find(e=>e.cur)||d.events.filter(e=>e.fin).slice(-1)[0];
 return `<div class="mu" style="margin-bottom:8px">Official Fantasy Premier League data, as of ${esc(d.generated)} UTC${cur?' · '+esc(cur.name):''}. Prices in £m. A dash or N/A means the source gave no value (never zero).${FPLINK.on?` PitchAPI link: ${FPLINK.n} of ${FPLINK.tot} players with minutes matched by team and name; the rest have no PitchAPI value.`:' PitchAPI metrics (xT, xG) appear when the Premier League is selected in the league picker.'}</div><div id="fpmsg" class="mu" style="min-height:18px"></div>`;
}
function fpRender(){
 const d=FPD,T=[['table','Table'],['scatter','Scatter'],['value','Value'],['compare','Compare'],['teams','Teams'],['fixtures','Fixtures']];
 $('#fproot').innerHTML=`<div class="ctl">${T.map(([k,n])=>`<button class="${k===FP.tab?'':'s'}" onclick="fpTab('${k}')">${n}</button>`).join('')}</div>`+fpHeader(d)+'<div id="fpbody"></div>';
 ({table:fpTTable,scatter:fpTScatter,value:fpTValue,compare:fpTCompare,teams:fpTTeams,fixtures:fpTFix})[FP.tab]($('#fpbody'));
}
function fpSort(k){FP.sort=FP.sort.k===k?{k,d:-FP.sort.d}:{k,d:(k==='name'||k==='tn')?1:-1};fpTTableDraw()}
function fpTTable(el){
 el.innerHTML=`<div class="ctl"><input id="fq" placeholder="Search player" value="${esc(FP.q)}"><select id="fpos">${fpPosOpts(FP.pos)}</select><select id="ftm">${fpTeamOpts(FP.team)}</select><input id="fmx" type="number" step="0.1" placeholder="Max price" value="${esc(FP.maxp)}" style="width:110px"><input id="fmm" type="number" placeholder="Min minutes" value="${esc(FP.minm)}" style="width:120px"><select id="fav">${fpOpts([['','Any status'],['ok','Available'],['no','Doubtful or out']],FP.av)}</select></div><div id="fout"></div>`;
 const rd=()=>{FP.q=$('#fq').value;FP.pos=$('#fpos').value;FP.team=$('#ftm').value;FP.maxp=$('#fmx').value;FP.minm=$('#fmm').value;FP.av=$('#fav').value;fpTTableDraw()};
 ['fq','fmx','fmm'].forEach(i=>$('#'+i).oninput=rd);['fpos','ftm','fav'].forEach(i=>$('#'+i).onchange=rd);fpTTableDraw();
}
function fpTTableDraw(){
 const P=fpFilt(FPD.P,FP),cols=['price','tp','ppg','form','pm','min','g','a','xgi','own'].concat(FPLINK.on?['pxt','pxg']:[]),k=FP.sort.k,dir=FP.sort.d;
 const gk=p=>k==='name'?p.name:k==='tn'?p.tn:fpM(k)[2](p);
 const rows=[...P].sort((a,b)=>{const x=gk(a),y=gk(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;const c=typeof x==='string'?x.localeCompare(y):x-y;return dir>0?c:-c});
 const th=(kk,t)=>`<th class="${kk==='name'||kk==='tn'?'':'n'}" style="cursor:pointer" onclick="fpSort('${kk}')">${esc(t)}${k===kk?(dir<0?' ↓':' ↑'):''}</th>`;
 $('#fout').innerHTML=`<div class="mu" style="margin-bottom:6px">${rows.length} of ${FPD.P.length} players${rows.length>150?' (first 150)':''}. Tap a column to sort.</div><div class="wrap"><table><tr><th></th>${th('name','Player')}${th('tn','Team')}<th>Pos</th>${cols.map(c=>th(c,fpM(c)[1].replace(' (PitchAPI)','*').replace(' (FPL)',''))).join('')}</tr>`+
  rows.slice(0,150).map(p=>`<tr><td><button class="s" onclick="fpAdd(${p.id})" style="min-height:30px;padding:2px 8px">+</button></td><td>${p.st!=='a'?`<span title="${esc(p.nw||'')}" style="color:var(--a)">⚠</span> `:''}${esc(p.name)}</td><td>${esc(p.tn)}</td><td>${FPPOS[p.pos]}</td>${cols.map(c=>{const m=fpM(c),v=m[2](p);return `<td class="n">${v==null?'N/A':v.toFixed(m[3])}</td>`}).join('')}</tr>`).join('')+`</table></div>${FPLINK.on?'<div class="mu" style="font-size:12px;margin-top:6px">* PitchAPI values per 90 minutes.</div>':''}`;
}
function fpTScatter(el){
 el.innerHTML=`<div class="ctl"><select id="sx">${fpMetOpts(FP.sx)}</select><select id="sy">${fpMetOpts(FP.sy)}</select><select id="sp">${fpPosOpts(FP.sp)}</select><input id="sm" type="number" placeholder="Min minutes" value="${esc(FP.sm)}" style="width:120px"></div><div class="ctl"><button class="s" onclick="fpPre('price','tp')">Price vs points</button><button class="s" onclick="fpPre('price','pm')">Price vs value</button><button class="s" onclick="fpPre('own','tp')">Ownership vs points</button><button class="s" onclick="fpPre('xgi','tp')">xGI vs points</button><button class="s" onclick="fpPre('price','xgi90')">Price vs xGI/90</button>${FPLINK.on?'<button class="s" onclick="fpPre(\'price\',\'pxt\')">Price vs xT (PitchAPI)</button>':''}</div><div id="sout"></div><div class="card" id="fpd" style="font-size:13px">Tap a dot for details.</div>`;
 const rd=()=>{FP.sx=$('#sx').value;FP.sy=$('#sy').value;FP.sp=$('#sp').value;FP.sm=$('#sm').value;draw()};
 const draw=()=>{const xm=fpM(FP.sx),ym=fpM(FP.sy),P=fpFilt(FPD.P,{pos:FP.sp,minm:FP.sm}),pts=P.map(p=>({p,x:xm[2](p),y:ym[2](p)})).filter(a=>fpOk(a.x)&&fpOk(a.y));
  $('#sout').innerHTML=`<div class="mu" style="margin-bottom:6px">${pts.length} of ${P.length} players have a value for both metrics. Colours: ${[1,2,3,4].map(k=>`<span style="color:${FPCOL[k]}">● ${FPPOS[k]}</span>`).join(' ')}. The 8 best on both axes are named.</div>`+fpScatter(pts,xm,ym)};
 ['sx','sy','sp'].forEach(i=>$('#'+i).onchange=rd);$('#sm').oninput=rd;draw();
}
function fpPre(x,y){FP.sx=x;FP.sy=y;fpTScatter($('#fpbody'))}
function fpTValue(el){
 el.innerHTML=`<div class="ctl"><select id="vm">${fpMetOpts(FP.vm)}</select><select id="vp">${fpPosOpts(FP.vp)}</select><input id="vn" type="number" placeholder="Min minutes" value="${esc(FP.vmin)}" style="width:120px"><input id="vx" type="number" step="0.1" placeholder="Max price" value="${esc(FP.vmax)}" style="width:110px"></div><div id="vout"></div>`;
 const rd=()=>{FP.vm=$('#vm').value;FP.vp=$('#vp').value;FP.vmin=$('#vn').value;FP.vmax=$('#vx').value;draw()};
 const draw=()=>{const m=fpM(FP.vm),P=fpFilt(FPD.P,{pos:FP.vp,minm:FP.vmin,maxp:FP.vmax}).filter(p=>fpOk(m[2](p))).sort((a,b)=>m[2](b)-m[2](a)),top=P.slice(0,20);
  const mv=fpFilt(FPD.P,{pos:FP.vp}).filter(p=>fpOk(p.chg)&&p.chg!==0),ris=[...mv].sort((a,b)=>b.chg-a.chg).slice(0,8),fal=[...mv].sort((a,b)=>a.chg-b.chg).slice(0,8);
  const mk=a=>a.map(p=>({l:p.name,s:p.tn,v:p.chg,t:(p.chg>0?'+':'')+p.chg.toFixed(1),c:p.chg>0?'#4cc38a':'#e5646b'}));
  $('#vout').innerHTML=`<h3>Top 20 by ${esc(m[1])}</h3>`+(top.length?fpBars(top.map(p=>({l:p.name,s:p.tn+' · £'+p.price.toFixed(1),v:m[2](p),t:m[2](p).toFixed(m[3]),c:FPCOL[p.pos]}))):'<div class="empty">No players match.</div>')+
   `<h3>Biggest price rises since the start of the season (£m)</h3>`+(ris.length?fpBars(mk(ris)):'<div class="empty">No price changes yet.</div>')+`<h3>Biggest price falls (£m)</h3>`+(fal.length?fpBars(mk(fal)):'<div class="empty">No price changes yet.</div>')};
 ['vm','vp'].forEach(i=>$('#'+i).onchange=rd);['vn','vx'].forEach(i=>$('#'+i).oninput=rd);draw();
}
function fpTCompare(el){
 el.innerHTML=`<div class="ctl" style="position:relative"><input id="cq" autocomplete="off" placeholder="Search a player to add (max 6)" value="" style="flex:1;min-width:200px"></div><div id="cres" class="chips"></div><div id="cout"></div>`;
 const res=()=>{const q=fpNz($('#cq').value);const r=q?FPD.P.filter(p=>!FP.sel.includes(p.id)&&fpNz(p.fn+' '+p.sn+' '+p.name+' '+p.tf).includes(q)).sort((a,b)=>(b.total_points||0)-(a.total_points||0)).slice(0,8):[];
  $('#cres').innerHTML=r.map(p=>`<span class="chp" onclick="fpAdd(${p.id})">${esc(p.name)} <span class="mu">${esc(p.tn)} · ${FPPOS[p.pos]} · £${f(p.price,1)}</span></span>`).join('')};
 $('#cq').oninput=res;
 if(!FP.sel.length){$('#cout').innerHTML='<div class="empty">Search above, or press + next to a player in the Table tab. Selected players are compared on every metric, price over time and points per gameweek.</div>';return}
 const S=FP.sel.map(id=>FPD.PB.get(id)).filter(Boolean),ids=S.map(p=>p.id);
 const ms=FPM.filter(m=>FPLINK.on||!/PitchAPI/.test(m[1])),noBest=new Set(['price','chg','tin','tout','min']);
 const best=m=>{if(noBest.has(m[0]))return null;const v=S.map(p=>m[2](p)).filter(fpOk);return v.length>1?Math.max(...v):null};
 const hd=`<div class="chips" style="margin:6px 0">${S.map((p,i)=>`<span class="chp on" style="border-color:${FPPAL[i]}" onclick="fpRm(${p.id})"><span style="color:${FPPAL[i]}">●</span> ${esc(p.name)} ✕</span>`).join('')}</div>`;
 const tb=`<div class="wrap"><table><tr><th></th>${S.map(p=>`<th>${esc(p.name)}<div class="mu" style="font-size:11px;font-weight:400">${esc(p.tn)} · ${FPPOS[p.pos]}</div></th>`).join('')}</tr>${ms.map(m=>{const b=best(m);return `<tr><td class="mu">${esc(m[1])}</td>${S.map(p=>{const v=m[2](p);return `<td class="n ${b!=null&&v===b?'clb':''}">${v==null?'N/A':(b!=null&&v===b?'▲ ':'')+v.toFixed(m[3])}</td>`}).join('')}</tr>`}).join('')}</table></div>`;
 const pr=fpSeries(ids,'val'),pt=fpSeries(ids,'pts'),cu={gws:pt.gws,series:pt.series.map(s=>{let t=0;return {n:s.n,v:s.v.map(v=>{if(v==null)return null;t+=v;return t})}})};
 $('#cout').innerHTML=hd+tb+fpLines(pr.series,pr.gws,'Price (£m) after each match',1)+fpLines(pt.series,pt.gws,'Points per gameweek',0)+fpLines(cu.series,cu.gws,'Cumulative points',0)+`<div class="mu" style="font-size:12px;margin:6px 0">${S.map((p,i)=>`<span style="color:${FPPAL[i]}">${'━ '}${esc(p.name)}</span>`).join(' · ')}. Price is the value recorded with each match, so a change between matches shows at the next one. ▲ marks the highest value among the selected players where higher is better.</div>`;
 res();
}
function fpTTeams(el){
 const ms=[['tp','Total points'],['g','Goals'],['a','Assists'],['cs','Clean sheets'],['bon','Bonus points'],['xgi','xGI (FPL)'],['ap','Average price of regular players (£m)'],['ppm','Points per £m, regular players']];
 el.innerHTML=`<div class="ctl"><select id="tmm">${fpOpts(ms,FP.tm)}</select></div><div id="tout"></div>`;
 const draw=()=>{FP.tm=$('#tmm').value;
  const T=FPD.teams.map(t=>{const P=FPD.P.filter(p=>p.tm===t.id),sum=k=>P.some(p=>fpOk(p[k]))?P.reduce((s,p)=>s+(fpOk(p[k])?p[k]:0),0):null,reg=P.filter(p=>(p.minutes||0)>=270&&p.price!=null);
   const rp=reg.reduce((s,p)=>s+p.price,0),rt=reg.reduce((s,p)=>s+(p.total_points||0),0);
   return {t,tp:sum('total_points'),g:sum('goals_scored'),a:sum('assists'),cs:sum('clean_sheets'),bon:sum('bonus'),xgi:sum('expected_goal_involvements'),ap:reg.length?rp/reg.length:null,ppm:rp>0?rt/rp:null,n:reg.length}});
  const k=FP.tm,dg=(k==='xgi'||k==='ap'||k==='ppm')?(k==='xgi'?1:2):0,L=T.filter(x=>fpOk(x[k])).sort((a,b)=>b[k]-a[k]);
  $('#tout').innerHTML=fpBars(L.map(x=>({l:x.t.n,v:x[k],t:x[k].toFixed(dg),c:'#5aa9e6'})))+
   `<div class="wrap" style="margin-top:10px"><table><tr><th>Team</th><th class="n">Points</th><th class="n">Goals</th><th class="n">Assists</th><th class="n">CS</th><th class="n">Bonus</th><th class="n">xGI</th><th class="n">Avg £m</th><th class="n">Pts/£m</th></tr>${[...T].sort((a,b)=>(b.tp??-1)-(a.tp??-1)).map(x=>`<tr><td>${esc(x.t.n)}</td><td class="n">${f(x.tp,0)}</td><td class="n">${f(x.g,0)}</td><td class="n">${f(x.a,0)}</td><td class="n">${f(x.cs,0)}</td><td class="n">${f(x.bon,0)}</td><td class="n">${f(x.xgi,1)}</td><td class="n">${f(x.ap,2)}</td><td class="n">${f(x.ppm,2)}</td></tr>`).join('')}</table></div><div class="mu" style="font-size:12px;margin-top:6px">Regular players = at least 270 minutes. Totals add the values the source gave; they include players who have since left.</div>`};
 $('#tmm').onchange=draw;draw();
}
function fpTFix(el){
 const d=FPD,nx=d.events.find(e=>e.nxt)||d.events.find(e=>!e.fin),s0=nx?nx.id:1,gws=[0,1,2,3,4].map(i=>s0+i).filter(g=>d.events.some(e=>e.id===g)),CL=['#2e7d4f','#4cc38a','#8a9bb0','#e9b44c','#e5646b'];
 const cell=(t,g)=>d.fix.filter(x=>x[0]===g&&(x[1]===t||x[2]===t)).map(x=>{const h=x[1]===t,o=d.T.get(h?x[2]:x[1])||{};return {o:o.s||'?',h,df:h?x[3]:x[4]}});
 const R=d.teams.map(t=>{const cs=gws.map(g=>cell(t.id,g)),ds=cs.flat().map(c=>c.df).filter(fpOk);return {t,cs,avg:ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:null}}).sort((a,b)=>(a.avg??9)-(b.avg??9));
 el.innerHTML=`<div class="mu" style="margin-bottom:6px">Next ${gws.length} gameweeks, easiest run first. Difficulty is the official FPL rating from 1 (easiest) to 5. Capital letters = home.</div><div class="wrap"><table><tr><th>Team</th>${gws.map(g=>`<th>GW ${g}</th>`).join('')}<th class="n">Avg</th></tr>${R.map(r=>`<tr><td>${esc(r.t.n)}</td>${r.cs.map(c=>`<td>${c.length?c.map(x=>`<span style="display:inline-block;padding:2px 7px;margin:1px;border-radius:6px;background:${CL[Math.min(4,Math.max(0,(x.df||3)-1))]};color:#06210f;font-weight:600;font-size:12px">${esc(x.h?x.o.toUpperCase():x.o.toLowerCase())}</span>`).join(''):'<span class="mu">—</span>'}</td>`).join('')}<td class="n">${f(r.avg,2)}</td></tr>`).join('')}</table></div>`;
}
R.fantasy=async function(el){
 el.innerHTML='<h2>Fantasy</h2><div id="fproot"><div class="empty">Loading…</div></div>';
 let d=null;try{d=await fpLoad()}catch(e){$('#fproot').innerHTML=`<div class="empty">Could not load Fantasy data: ${esc(e.message)}</div>`;return}
 if(!d){$('#fproot').innerHTML='<div class="empty">No Fantasy data yet. It is fetched from the official Fantasy Premier League API during the next synchronization (at most once an hour). Press Synchronize in Settings.</div>';return}
 fpLink();fpRender();
};
"""


def _x_fpl_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (Fantasy): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "['rankings','Rankings'],", "['rankings','Rankings'],['fantasy','Fantasy'],")
    h = sub(h, "async function route(){", _X_FPJS + "\nasync function route(){")
    return h


INDEX = _x_fpl_index(INDEX)
# ======================== نهاية إضافة Fantasy ========================



if __name__ == "__main__":
    main()
