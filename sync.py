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
# clubs = أندية معروفة في الدوري: PitchAPI ما يرجع الدولة، فإذا فيه أكثر من دوري بنفس الاسم (مثل Serie A الإيطالي والإكوادوري)
#         نختار الدوري اللي مبارياته فيها هذي الأندية
LEAGUE_TARGETS = [
    dict(label="الدوري الإنجليزي", words=["premier league"], country="england", known="l_4WFCIZ"),
    dict(label="الدوري الإسباني", words=["la liga", "laliga", "primera division"], country="spain", known="l_0ErfuF",
         clubs=["real madrid", "barcelona", "atletico madrid", "sevilla", "valencia", "villarreal", "real sociedad", "athletic"]),
    dict(label="الدوري الألماني", words=["bundesliga"], country="germany", known="l_1Isor4",
         clubs=["bayern", "dortmund", "leverkusen", "leipzig", "frankfurt", "stuttgart", "wolfsburg", "freiburg"]),
    dict(label="الدوري الفرنسي", words=["ligue 1"], country="france", known="l_3FJFUl",
         clubs=["paris saint-germain", "marseille", "lyon", "monaco", "lille", "lens", "rennes", "nice"]),
    dict(label="الدوري الإيطالي", words=["serie a"], country="italy", known="l_0ALvwF",
         clubs=["juventus", "inter", "milan", "napoli", "roma", "lazio", "atalanta", "fiorentina", "bologna", "torino"]),
    dict(label="الدوري البرتغالي", words=["primeira liga", "liga portugal"], country="portugal", known="l_4QexZg",
         clubs=["benfica", "porto", "sporting", "braga", "vitoria", "guimaraes"]),
    dict(label="دوري أبطال أوروبا", words=["champions league"], known="l_0bfbkO",
         exclude=["afc", "caf", "concacaf", "conmebol", "asia", "africa", "oceania"]),
    dict(label="كأس العالم", words=["world cup"], known="l_1XLtP0", exclude=["club", "beach", "futsal"]),
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
    globals().setdefault("_LOGO_REFS", {})[league_id] = [(m.home_team, m.away_team) for m in ms]   # شعارات الفرق (إضافة الشعارات)
    globals().setdefault("_LEAGUE_SEASON", {})[league_id] = getattr(getattr(res, "league", None), "season", None)   # موسم البيانات (إضافة البطولات)
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

def _club_hits(client, lg, clubs):
    """كم نادي من الأندية المعروفة يظهر في مباريات الدوري (يميّز الدوريات اللي لها نفس الاسم)."""
    res, err = call(lambda: client.leagues.matches(str(lg.id), season=None, status="played"))
    if res is None:
        return 0
    names = set()
    for m in list(getattr(res, "matches", None) or [])[:400]:
        for side in ("home_team", "away_team"):
            names.add(nrm(getattr(getattr(m, side, None), "name", "") or ""))
    return sum(1 for c in clubs if any(nrm(c) in n for n in names))


def resolve_leagues(client):
    res, err = call(client.leagues.list)
    items = list(getattr(res, "leagues", None) or res or []) if res is not None else []
    if not items:
        if err == "auth":
            raise SetupError(AUTH_HELP)
        log("تعذر جلب قائمة الدوريات:", err)
        return []
    by_id = {str(l.id): l for l in items}
    globals()["_LEAGUE_LIST"] = items   # قائمة الدوريات كاملة: للبطولات الأوروبية ومواسمها (إضافة البطولات)
    metas, seen = [], set()

    def add(lg):
        if str(lg.id) in seen:
            return
        if is_blocked(lg):
            log(f"  ⊘ تم استبعاد {lg.name} [{lg.id}] (دوري محذوف)")
            return
        seen.add(str(lg.id))
        globals().setdefault("_LEAGUE_IMG", {})[str(lg.id)] = getattr(lg, "image_url", None)   # شعار الدوري (إضافة الشعارات)
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
            if cands and t.get("clubs"):
                # PitchAPI ما يرجع الدولة، والاسم قد يتكرر لأكثر من دولة: نختار الدوري اللي فيه الأندية المعروفة (على الأقل 3)
                hits = [(_club_hits(client, l, t["clubs"]), -i, l) for i, l in enumerate(cands[:5])]
                best = max(hits, key=lambda x: (x[0], x[1]))
                log(f"  [{t['label']}] أندية معروفة في كل مرشح: " + " | ".join(f"{l.name} [{l.id}]: {h}" for h, _, l in hits))
                if best[0] >= 3:
                    cands = [best[2]] + [l for l in cands if l is not best[2]]
                else:
                    log(f"  ✘ {t['label']}: ما لقيت دوري فيه أندية {t['label']} المعروفة — تخطيته بدل ما أختار دوري غلط")
                    cands = []
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
FPL_NEAR_DL_MIN, FPL_NEAR_DL_HOURS = 15, 3     # قبل الموعد النهائي بـ3 ساعات: كل 15 دقيقة (آخر أخبار الإصابات لسجل التوقعات)


def _fpl_interval(old):
    """الفاصل بين جلبتين: أقصر قرب الموعد النهائي للجولة القادمة."""
    ev = next((e for e in (old or {}).get("events", []) if e.get("nxt")), None)
    dl = _parse_ts(ev.get("dl")) if ev else None
    if dl is not None:
        h = (dl - datetime.datetime.now(datetime.timezone.utc)).total_seconds() / 3600
        if 0 < h <= FPL_NEAR_DL_HOURS:
            return FPL_NEAR_DL_MIN
    return FPL_MIN_INTERVAL_MIN
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
             "opponent_team", "was_home",
             # الأعمدة الإضافية (المرحلة 0): تُخزَّن إذا أرجعها FPL فعلاً، وإلا تبقى فاضية (None) ولا تتحول لصفر
             "starts", "goals_scored", "assists", "clean_sheets", "goals_conceded", "saves", "yellow_cards",
             "red_cards", "own_goals", "penalties_missed", "penalties_saved", "bps", "expected_goals_conceded",
             "defensive_contribution", "fixture"]
_FPL_HIST_SHORT = ["r", "pts", "val", "min", "xg", "xa", "bon", "opp", "h",
                   "st", "gl", "as", "cs", "gc", "sv", "yc", "rc", "og", "pmi", "psv", "bps", "xgc", "dc", "fx"]
FPL_HIST_VER = 2                   # رقم صيغة سجل المباريات (للعرض فقط؛ التحديث يعتمد على طول الصفوف)


def _fpl_hist_stale(old):
    """هل في بيانات قديمة محفوظة بصيغة أقصر (9 أعمدة)؟ إذا نعم نعيد جلب سجلها مرة وحدة."""
    for rs in ((old or {}).get("hist") or {}).values():
        if any(len(r) < len(_FPL_HIST) for r in rs):
            return True
    return False


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


def _fpl_fit_rule(ident, lst):
    """يستنتج قاعدة النقاط من ملاحظات (قيمة, نقاط): عتبة الدقائق، أو نقاط لكل step وحدة."""
    if ident == "minutes":
        lo = {p for v, p in lst if 0 < v < 60}
        hi = {p for v, p in lst if v >= 60}
        if len(lo) <= 1 and len(hi) <= 1 and (lo or hi):
            return dict(kind="threshold", at=60, lo=(lo.pop() if lo else None), hi=(hi.pop() if hi else None), n=len(lst))
        return None
    best = None
    for step in range(1, 16):                       # نختار أكبر step متسق مع كل الملاحظات
        pts, ok = set(), True
        for v, p in lst:
            k = int(v // step)
            if k == 0:
                if p != 0:
                    ok = False
                    break
            else:
                pts.add(round(p / k, 6))
        if ok and len(pts) == 1:
            best = dict(kind="step", step=step, pts=next(iter(pts)), n=len(lst))
    return best


def _fpl_derive_scoring(live, types):
    obs = {}
    for el in (live or {}).get("elements", []):
        t = types.get(el.get("id"))
        for ex in el.get("explain", []) or []:
            items = ex.get("stats") if isinstance(ex, dict) and isinstance(ex.get("stats"), list) else [ex]
            for s_ in items:
                ident, v, p = s_.get("identifier"), s_.get("value"), s_.get("points")
                if ident and isinstance(v, (int, float)) and isinstance(p, (int, float)) and t:
                    obs.setdefault((ident, t), []).append((v, p))
    out = {}
    for (ident, t), lst in obs.items():
        r = _fpl_fit_rule(ident, lst)
        if r:
            out.setdefault(ident, {})[str(t)] = r
    return out


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
        stale = any(len(x) < len(_FPL_HIST) for x in hist.get(str(pid_), []))
        if str(pid_) not in hist or not same or stale:
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
    n_hist, audit = 0, {}
    for rs in hist.values():
        for rw in rs:
            n_hist += 1
            for k_, v_ in zip(_FPL_HIST_SHORT, rw):
                if v_ is not None:
                    audit[k_] = audit.get(k_, 0) + 1
    absent = [k_ for k_ in _FPL_HIST_SHORT if n_hist and not audit.get(k_)]
    log(f"  [Fantasy] فحص حقول سجل المباريات: {n_hist} صف | حقول لم يرجعها FPL إطلاقاً: {absent or 'لا يوجد'}")
    teams = [dict(id=t["id"], n=t.get("name"), s=t.get("short_name"), st=t.get("strength")) for t in boot.get("teams", [])]
    events = [dict(id=e["id"], name=e.get("name"), fin=bool(e.get("finished")), cur=bool(e.get("is_current")),
                   nxt=bool(e.get("is_next")), dl=e.get("deadline_time"), avg=e.get("average_entry_score"))
              for e in boot.get("events", [])]
    fix = [[f.get("event"), f.get("team_h"), f.get("team_a"), f.get("team_h_difficulty"),
            f.get("team_a_difficulty"), 1 if f.get("finished") else 0,
            f.get("team_h_score"), f.get("team_a_score"), f.get("kickoff_time")]
           for f in (fixtures or []) if f.get("event")]
    postponed = sum(1 for f in (fixtures or []) if not f.get("event"))
    gs = boot.get("game_settings", {}) or {}
    rules = dict(squad=gs.get("squad_squadsize"), play=gs.get("squad_squadplay"), club=gs.get("squad_team_limit"),
                 budget=gs.get("squad_total_spend"), transfers_cap=gs.get("transfers_cap"),
                 types={str(t["id"]): dict(n=t.get("singular_name_short"), sel=t.get("squad_select"),
                                           mn=t.get("squad_min_play"), mx=t.get("squad_max_play"))
                        for t in boot.get("element_types", [])})
    # قواعد التسجيل الفعلية: تُستخرج من نقاط آخر جولة منتهية (event/{gw}/live: explain) بدل افتراضها
    done = [e["id"] for e in boot.get("events", []) if e.get("finished")]
    scoring, scoring_gw = (old or {}).get("scoring"), (old or {}).get("scoring_gw")
    if done and (not scoring or scoring_gw != max(done)):
        live = fetch(f"event/{max(done)}/live/")
        if live:
            types = {e["id"]: e.get("element_type") for e in boot.get("elements", [])}
            derived = _fpl_derive_scoring(live, types)
            if derived:
                scoring, scoring_gw = derived, max(done)
                log(f"  [Fantasy] قواعد التسجيل مستخرجة من الجولة {scoring_gw}: {len(derived)} فئة")
    return dict(generated=now(), cols=cols, rows=rows, teams=teams, events=events, fix=fix,
                hist=hist, hcols=list(_FPL_HIST_SHORT), hv=FPL_HIST_VER, haudit=dict(rows=n_hist, f=audit),
                rules=rules, scoring=scoring or {}, scoring_gw=scoring_gw, postponed=postponed)


def sync_fpl(hub):
    global FPL_INDEX
    if not FPL_ENABLED:
        return
    old = gh_get_json(hub, "data/fpl.json")
    if old and old.get("generated"):
        FPL_INDEX = dict(file="fpl.json", v=old["generated"])
        t = _parse_ts(old["generated"])
        if (not FORCE_SYNC and t is not None and not _fpl_hist_stale(old)
                and (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 60 < _fpl_interval(old)):
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
 const d=FPD,T=[['table','Table'],['pred','Predicted Points'],['best','Best Team'],['scatter','Scatter'],['value','Value'],['compare','Compare'],['teams','Teams'],['fixtures','Fixtures'],['backtest','Backtest']];
 $('#fproot').innerHTML=`<div class="ctl">${T.map(([k,n])=>`<button class="${k===FP.tab?'':'s'}" onclick="fpTab('${k}')">${n}</button>`).join('')}</div>`+fpHeader(d)+'<div id="fpbody"></div>';
 ({table:fpTTable,pred:fpTPred,best:fpTBest,scatter:fpTScatter,value:fpTValue,compare:fpTCompare,teams:fpTTeams,fixtures:fpTFix,backtest:fpTBack})[FP.tab]($('#fpbody'));
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


_X_FPJS2 = r"""/* ===== Predicted points + Best Team: model, optimizer, UI (extends the Fantasy page) ===== */
const PM={N:7,PRIOR_MIN:450,K_FIN:3,N0:4,RECENT:6,EPS:.001,MAXNODES:4000};
const pmAll=v=>({1:v,2:v,3:v,4:v});
/* Fallback scoring, used ONLY for a rule the live data did not reveal (the UI labels each rule live/default). [step, points] */
const PM_DEF={goals_scored:{1:[1,10],2:[1,6],3:[1,5],4:[1,4]},assists:pmAll([1,3]),clean_sheets:{1:[1,4],2:[1,4],3:[1,1],4:[1,0]},goals_conceded:{1:[2,-1],2:[2,-1]},saves:{1:[3,1]},
 penalties_saved:{1:[1,5]},penalties_missed:pmAll([1,-2]),yellow_cards:pmAll([1,-1]),red_cards:pmAll([1,-3]),own_goals:pmAll([1,-2]),bonus:pmAll([1,1]),defensive_contribution:{2:[10,2],3:[12,2],4:[12,2]}};
function pmRule(d,id,t){const r=((d.scoring||{})[id]||{})[String(t)];
 if(r&&r.kind==='step')return {step:r.step,pts:r.pts,src:'live'};
 const f=(PM_DEF[id]||{})[t];return f?{step:f[0],pts:f[1],src:'default'}:{step:1,pts:0,src:'none'}}
function pmMinRule(d,t){const r=((d.scoring||{}).minutes||{})[String(t)];
 if(r&&r.kind==='threshold'&&r.lo!=null&&r.hi!=null)return {lo:r.lo,hi:r.hi,src:'live'};return {lo:1,hi:2,src:'default'}}
function pmPois(l,kmax){const p=[Math.exp(-l)];for(let k=1;k<=kmax;k++)p.push(p[k-1]*l/k);return p}
/* E[floor(X/step)]*pts for X~Poisson(l) */
function pmEStep(l,step,pts){if(!(l>0)||!pts)return 0;const p=pmPois(l,Math.max(25,Math.ceil(l*5+15)));let e=0;for(let k=step;k<p.length;k++)e+=Math.floor(k/step)*p[k];return e*pts}
/* P(X>=k) for X~Poisson(l) */
function pmPGE(l,k){if(!(l>0))return 0;let s=0,p=Math.exp(-l);for(let i=0;i<k;i++){s+=p;p*=l/(i+1)}return Math.max(0,1-s)}
const PM_MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
/* Return date, ONLY when the FPL news text states one ("Expected back 12 Nov", "Suspended until 25 Oct") */
function pmReturn(p,gen){
 const m=/(?:expected back|suspended until|back on|return(?:s|ing)?(?: on| date)?)\D{0,12}(\d{1,2})\s+([A-Za-z]{3})/i.exec(p.nw||'');if(!m)return null;
 const mon=PM_MON[m[2].toLowerCase()];if(mon==null)return null;
 const base=Date.parse(String(gen).replace(' ','T')+'Z'),y=new Date(base).getUTCFullYear();let t=Date.UTC(y,mon,+m[1]);if(t<base-60*864e5)t=Date.UTC(y+1,mon,+m[1]);return t}
const PM_ST={a:'Available',d:'Doubtful',i:'Injured',s:'Suspended',u:'Unavailable',n:'Not in squad'};
const pmStLabel=p=>{const b=PM_ST[p.st]||p.st;return (p.st==='d'&&fpOk(p.chance_of_playing_next_round))?b+' ('+p.chance_of_playing_next_round+'%)':b};
const pmStCol=p=>p.st==='a'?'#4cc38a':p.st==='d'?'#e9b44c':'#e5646b';
/* probability the player is fit for ONE fixture, from published data only */
function pmAvail(p,x,C,d){
 if(p.st==='a')return {a:1,src:'available'};
 const ko=x.ko?Date.parse(x.ko):null,ret=pmReturn(p,d.generated);
 if(ret!=null&&ko!=null)return {a:ko>=ret?1:0,src:'return date in news',ret};
 if(p.st==='u'||p.st==='n')return {a:0,src:'unavailable'};
 const c=p.chance_of_playing_next_round;
 if(fpOk(c))return {a:c/100,src:x.ev===C.next?'published chance (next gameweek)':'published chance carried forward (no later data)'};
 return {a:0,src:'no chance or return date published: treated as unavailable'};
}
function pmCtx(d){
 if(d._pm)return d._pm;
 const H=d.hist||{},ev=d.events,nx=ev.find(e=>e.nxt)||ev.find(e=>!e.fin)||null,next=nx?nx.id:null;
 const gws=next==null?[]:Array.from({length:PM.N},(_,i)=>next+i).filter(g=>ev.some(e=>e.id===g));
 const tm=new Map();
 for(const p of d.P){const rows=H[String(p.id)];if(!rows)continue;
  /* a match with no xG published (2022-23 before gameweek 16) counts its goals instead */
  for(const r of rows){if(!(r[3]>0))continue;const xg=fpOk(r[4])?r[4]:fpOk(r[10])?r[10]:null;if(xg==null)continue;const k=p.tm+'|'+r[0]+'|'+r[7];let o=tm.get(k);if(!o){o={t:p.tm,o:r[7],r:r[0],h:r[8],xg:0};tm.set(k,o)}o.xg+=xg}}
 const T=new Map(d.teams.map(t=>[t.id,{n:0,f:0,a:0}]));let sA=0,nA=0,sH=0,nH=0,sW=0,nW=0;
 for(const o of tm.values()){const q=tm.get(o.o+'|'+o.r+'|'+o.t),t=T.get(o.t);if(!q||!t)continue;t.n++;t.f+=o.xg;t.a+=q.xg;sA+=o.xg;nA++;if(o.h===1){sH+=o.xg;nH++}else{sW+=o.xg;nW++}}
 const mu=nA?sA/nA:null,muH=nH?sH/nH:mu,muA=nW?sW/nW:mu,S=new Map();
 T.forEach((t,id)=>S.set(id,{n:t.n,A:mu?((t.f+mu*PM.N0)/(t.n+PM.N0))/mu:1,D:mu?((t.a+mu*PM.N0)/(t.n+PM.N0))/mu:1,xgf:t.n?t.f/t.n:null,xga:t.n?t.a/t.n:null}));
 let gl=0,xs=0,nSc=0;
 for(const x of d.fix){if(!x[5]||!fpOk(x[6])||!fpOk(x[7]))continue;const a=tm.get(x[1]+'|'+x[0]+'|'+x[2]),b=tm.get(x[2]+'|'+x[0]+'|'+x[1]);if(a&&b){gl+=x[6]+x[7];xs+=a.xg+b.xg;nSc++}}
 const pri={};
 for(const t of [1,2,3,4]){const L=d.P.filter(p=>p.ty===t&&p.minutes>0);
  const f=k=>{const v=L.filter(p=>fpOk(p[k])),n=v.reduce((s,p)=>s+p.minutes/90,0);return n>0?v.reduce((s,p)=>s+p[k],0)/n:null};
  pri[t]={xg:f('expected_goals'),xa:f('expected_assists'),g:f('goals_scored'),a:f('assists'),bon:f('bonus'),yc:f('yellow_cards'),rc:f('red_cards'),og:f('own_goals'),pm:f('penalties_missed'),ps:f('penalties_saved'),sv:f('saves'),dc:f('defensive_contribution')}}
 const fx=new Map();
 for(const x of d.fix){if(x[5])continue;for(const [tm_,home,opp] of [[x[1],true,x[2]],[x[2],false,x[1]]]){const k=tm_+'|'+x[0];if(!fx.has(k))fx.set(k,[]);fx.get(k).push({ev:x[0],opp,home,ko:x[8]||null})}}
 return d._pm={next,gws,S,mu,muH,muA,gr:xs>0?gl/xs:1,grN:nSc,pri,fx,nm:nx?nx.name:'',teamMatches:nA};
}
function pmPlayer(p,C,d){
 const t=p.ty,H=d.hist||{},rows=(H[String(p.id)]||[]).slice().sort((a,b)=>a[0]-b[0]),out={id:p.id,flags:[],gws:[],tot:null,avg:null,q:'low'};
 const fit=p.st!=='a',rec=fit?rows.filter(r=>r[3]>0).slice(-PM.RECENT):rows.slice(-PM.RECENT),pl=rec.filter(r=>r[3]>0);
 if(!(p.minutes>0)||!pl.length){out.q='nodata';out.flags.push(p.minutes>0?'No recent appearances to estimate playing time':'No minutes played this season: no rate can be estimated');return out}
 const n90=p.minutes/90,pm0=PM.PRIOR_MIN/90,P=C.pri[t];
 const shr=(x,pr)=>fpOk(x)&&fpOk(pr)?(x+pr*pm0)/(n90+pm0):null,fin=(g,x)=>fpOk(g)&&fpOk(x)?(g+PM.K_FIN)/(x+PM.K_FIN):null;
 let lamG,lamA;
 const xg90=shr(p.expected_goals,P.xg),fg=fin(p.goals_scored,p.expected_goals),xa90=shr(p.expected_assists,P.xa),fa_=fin(p.assists,p.expected_assists);
 if(xg90!=null&&fg!=null)lamG=xg90*fg;else{lamG=shr(p.goals_scored,P.g);out.flags.push('No xG in the data: goal rate uses goals only')}
 if(xa90!=null&&fa_!=null)lamA=xa90*fa_;else{lamA=shr(p.assists,P.a);out.flags.push('No xA in the data: assist rate uses assists only')}
 if(lamG==null||lamA==null){out.q='nodata';out.flags.push('Goal or assist data missing');return out}
 const R={bon:shr(p.bonus,P.bon),yc:shr(p.yellow_cards,P.yc),rc:shr(p.red_cards,P.rc),og:shr(p.own_goals,P.og),pmi:shr(p.penalties_missed,P.pm),psv:shr(p.penalties_saved,P.ps),sv:shr(p.saves,P.sv),dc:shr(p.defensive_contribution,P.dc)};
 const miss=[];if(R.bon==null)miss.push('bonus');if(R.yc==null)miss.push('cards');if(t===1&&R.sv==null)miss.push('saves');if(t!==1&&R.dc==null)miss.push('defensive contribution');
 if(miss.length)out.flags.push('Not in the data, excluded from the estimate: '+miss.join(', '));
 const pPlay0=fit?1:pl.length/rec.length,p60n=rec.filter(r=>r[3]>=60).length,q60=p60n/pl.length,ePlay=pl.reduce((s,r)=>s+r[3],0)/pl.length;
 const g60=rec.filter(r=>r[3]>=60),e60=g60.length?g60.reduce((s,r)=>s+r[3],0)/g60.length:90;
 if(rec.length<4)out.flags.push('Fewer than 4 recent matches to estimate playing time');
 if(p.minutes<270)out.flags.push('Under 270 minutes this season: rates lean on the position average');
 const mr=pmMinRule(d,t),rG=pmRule(d,'goals_scored',t),rA=pmRule(d,'assists',t),rCS=pmRule(d,'clean_sheets',t),rGC=pmRule(d,'goals_conceded',t),rSV=pmRule(d,'saves',t),rDC=pmRule(d,'defensive_contribution',t),rB=pmRule(d,'bonus',t),rY=pmRule(d,'yellow_cards',t),rR=pmRule(d,'red_cards',t),rO=pmRule(d,'own_goals',t),rM=pmRule(d,'penalties_missed',t),rP=pmRule(d,'penalties_saved',t);
 const venue=h=>h?C.muH:C.muA;
 const core=(a,x)=>{
  const St=C.S.get(p.tm),So=C.S.get(x.opp),pPlay=Math.min(1,pPlay0*a),p60=pPlay*q60,e=ePlay/90;
  let fa=1,lc=null,saveF=1;
  if(C.mu&&St&&So){fa=So.D*venue(x.home)/C.mu;lc=venue(!x.home)*So.A*St.D*C.gr;saveF=So.A*venue(!x.home)/C.mu}
  const parts={app:pPlay*(1-q60)*mr.lo+p60*mr.hi,goal:pPlay*e*lamG*fa*rG.pts,ast:pPlay*e*lamA*fa*rA.pts,cs:0,gc:0,sv:0,dc:0,bon:0,card:0};
  if(lc!=null){if(t<=3)parts.cs=rCS.pts*p60*Math.exp(-lc*e60/90);if(t<=2)parts.gc=pPlay*pmEStep(lc*e,rGC.step,rGC.pts)}
  if(t===1&&R.sv!=null)parts.sv=pPlay*pmEStep(R.sv*e*saveF,rSV.step,rSV.pts);
  if(t!==1&&R.dc!=null&&rDC.pts)parts.dc=rDC.pts*pPlay*pmPGE(R.dc*e,rDC.step);
  if(R.bon!=null)parts.bon=pPlay*e*R.bon*rB.pts;
  parts.card=pPlay*e*((R.yc||0)*rY.pts+(R.rc||0)*rR.pts+(R.og||0)*rO.pts+(R.pmi||0)*rM.pts+(t===1?(R.psv||0)*rP.pts:0));
  return {parts,pts:Object.values(parts).reduce((s,v)=>s+v,0),fa,lc,pPlay,e:pPlay*ePlay};
 };
 let anyFew=false,noTeam=!C.mu;
 for(const g of C.gws){const list=C.fx.get(p.tm+'|'+g)||[],items=[];let tot=0,fitTot=0,minE=0;const parts={};
  for(const x of list){const av=pmAvail(p,x,C,d),r=core(av.a,x),rf=core(1,x),So=C.S.get(x.opp),St=C.S.get(p.tm);
   if(So&&St&&(So.n<3||St.n<3))anyFew=true;
   items.push({opp:x.opp,home:x.home,ko:x.ko,av,pts:r.pts,fit:rf.pts,parts:r.parts,fa:r.fa,lc:r.lc,pPlay:r.pPlay,eMin:r.e});tot+=r.pts;fitTot+=rf.pts;minE+=r.e;for(const k in r.parts)parts[k]=(parts[k]||0)+r.parts[k]}
  out.gws.push({ev:g,fx:items,pts:tot,fit:fitTot,none:!list.length,eMin:minE,parts})}
 out.tot=out.gws.reduce((s,g)=>s+g.pts,0);out.fit=out.gws.reduce((s,g)=>s+g.fit,0);out.avg=C.gws.length?out.tot/C.gws.length:null;
 out.g1=out.gws.length?out.gws[0].pts:null;
 out.rates={lamG,lamA,xg90,xa90,finG:fg,finA:fa_,R,pPlay0,q60,ePlay,e60,recN:rec.length,fit};
 out.rules={mr,rG,rA,rCS,rGC,rSV,rDC,rB};
 if(noTeam)out.flags.push('No team xG data yet: opponent factors set to 1 and clean-sheet/goals-conceded points excluded');
 if(anyFew)out.flags.push('An opponent or own team has fewer than 3 matches of team data');
 let q='high';const why=[];
 if(p.st!=='a'){const cp=p.chance_of_playing_next_round;const known=pmReturn(p,d.generated)!=null||fpOk(cp);why.push('Availability: '+pmStLabel(p));q=known?'medium':'low'}
 if(p.minutes<270)q='low';else if(p.minutes<900&&q==='high')q='medium';
 if(rec.length<4&&q==='high')q='medium';
 out.q=q;out.why=why;return out;
}
function pmPredictAll(d){
 if(d._pmPred)return d._pmPred;const C=pmCtx(d);
 d.P.forEach(p=>{p.pm=pmPlayer(p,C,d)});
 return d._pmPred=true;
}

/* ---------- Optimizer ---------- */
function pmRules(d){
 const r=d.rules;if(!r||!r.types)return null;const T={};
 for(const k of [1,2,3,4]){const t=r.types[String(k)];if(!t||!fpOk(t.sel)||!fpOk(t.mn)||!fpOk(t.mx))return null;T[k]={sel:t.sel,mn:t.mn,mx:t.mx}}
 const squad=[1,2,3,4].reduce((s,k)=>s+T[k].sel,0);
 return {T,squad,play:fpOk(r.play)?r.play:11,playSrc:fpOk(r.play)?'game settings':'11, the standard value (not in the API response)',club:fpOk(r.club)?r.club:null,budget:fpOk(r.budget)?r.budget:null};
}
function pmForms(R){
 const o=[];
 for(let g=R.T[1].mn;g<=R.T[1].mx;g++)for(let df=R.T[2].mn;df<=R.T[2].mx;df++)for(let m=R.T[3].mn;m<=R.T[3].mx;m++)for(let f=R.T[4].mn;f<=R.T[4].mx;f++){
  if(g+df+m+f!==R.play||g>R.T[1].sel||df>R.T[2].sel||m>R.T[3].sel||f>R.T[4].sel)continue;o.push({g,d:df,m,f,name:df+'-'+m+'-'+f})}
 return o;
}
/* pool items: {id,t,c(cost, tenths),club,v}. A player is dropped only if at least sel_t+5 players of other clubs-or-same
   (counted by DISTINCT club) are at least as valuable and no more expensive: any squad using him can swap one of them in
   (at most sel_t-1 are already in the squad and at most 5 clubs can be at the club limit). */
function pmPrune(pool,R){
 const by={1:[],2:[],3:[],4:[]};pool.forEach(i=>by[i.t].push(i));const keep=[];
 for(const t of [1,2,3,4]){const L=by[t],need=R.T[t].sel+Math.floor(R.squad/R.club)+1;
  for(const i of L){const cl=new Set();
   for(const j of L){if(j===i)continue;if((j.v>i.v&&j.c<=i.c)||(j.v>=i.v&&j.c<i.c)||(j.v===i.v&&j.c===i.c&&j.id<i.id))cl.add(j.club)}
   if(cl.size<need)keep.push(i)}}
 return keep;
}
function pmDPpos(items,ks,kb,B,dbl,eps){
 const k=ks+kb,n=items.length;if(n<k)return null;
 const NEG=-Infinity,dp=[];for(let j=0;j<=k;j++)dp.push(new Float64Array(B+1).fill(NEG));dp[0][0]=0;
 const ch=new Uint8Array(n*(k+1)*(B+1));
 for(let it=0;it<n;it++){const c=items[it].c,v=items[it].v;
  for(let j=Math.min(k,it+1);j>=1;j--){const val=(j-1<ks)?((dbl&&j===1)?2*v:v):eps*v,prev=dp[j-1],cur=dp[j],base=(it*(k+1)+j)*(B+1);
   for(let b=B;b>=c;b--){const pv=prev[b-c];if(pv===NEG)continue;const cand=pv+val;if(cand>cur[b]){cur[b]=cand;ch[base+b]=1}}}}
 return {F:dp[k],ch,k,n,B,items};
}
function pmBack(r,b){const out=[];let j=r.k;for(let it=r.n-1;it>=0&&j>0;it--){if(r.ch[(it*(r.k+1)+j)*(r.B+1)+b]){out.push(r.items[it]);b-=r.items[it].c;j--}}return out}
function pmConv(F1,F2,B){
 const out=new Float64Array(B+1).fill(-Infinity),arg=new Int16Array(B+1);
 for(let b1=0;b1<=B;b1++){const v1=F1[b1];if(v1===-Infinity)continue;for(let b2=0;b1+b2<=B;b2++){const v2=F2[b2];if(v2===-Infinity)continue;const v=v1+v2;if(v>out[b1+b2]){out[b1+b2]=v;arg[b1+b2]=b1}}}
 return {F:out,arg};
}
function pmNode(P,R,form,tc,bans,cache){
 const ks={1:form.g,2:form.d,3:form.m,4:form.f},rs=[];
 for(const t of [1,2,3,4]){const kb=R.T[t].sel-ks[t],bk=[...bans].filter(id=>P.pos.get(id)===t).sort((a,b)=>a-b).join(','),key=t+'|'+ks[t]+'|'+kb+'|'+(t===tc?1:0)+'|'+bk;
  let r=cache.get(key);if(r===undefined){r=pmDPpos(P.byT[t].filter(i=>!bans.has(i.id)),ks[t],kb,R.budget,t===tc,PM.EPS);cache.set(key,r)}
  if(!r)return null;rs.push(r)}
 const c1=pmConv(rs[0].F,rs[1].F,R.budget),c2=pmConv(c1.F,rs[2].F,R.budget),c3=pmConv(c2.F,rs[3].F,R.budget);
 let bb=-1,bv=-Infinity;for(let b=0;b<=R.budget;b++)if(c3.F[b]>bv){bv=c3.F[b];bb=b}
 if(bv===-Infinity)return null;
 const b3=bb,b2f=b3-c3.arg[b3],b2=c2.arg[c3.arg[b3]],b1=c1.arg[b2],bG=b1,bD=b2-b1,bM=c3.arg[b3]-b2;
 const costs=[bG,bD,bM,b2f];
 const picks={};[1,2,3,4].forEach((t,i)=>{picks[t]=pmBack(rs[i],costs[i])});
 return {val:bv,picks,cost:bb,form,tc};
}
function pmSolveForm(P,R,form,cache){
 const open=[],seen=new Set();let nodes=0;
 const mk=(tc,bans)=>{const key=tc+':'+[...bans].sort((a,b)=>a-b).join(',');if(seen.has(key))return;seen.add(key);nodes++;const r=pmNode(P,R,form,tc,bans,cache);if(r){r.bans=bans;open.push(r)}};
 for(const tc of [1,2,3,4])mk(tc,new Set());
 while(open.length){
  let bi=0;for(let i=1;i<open.length;i++)if(open[i].val>open[bi].val)bi=i;const n=open.splice(bi,1)[0],cnt=new Map();
  for(const t of [1,2,3,4])for(const it of n.picks[t]){if(!cnt.has(it.club))cnt.set(it.club,[]);cnt.get(it.club).push(it)}
  let viol=null;cnt.forEach(a=>{if(a.length>R.club&&(!viol||a.length>viol.length))viol=a});
  if(!viol){n.nodes=nodes;return n}
  if(nodes>PM.MAXNODES)return null;
  for(const it of viol){const nb=new Set(n.bans);nb.add(it.id);mk(n.tc,nb)}
 }
 return null;
}
/* turns picked players into a team: starters = top k per position by value, bench = the rest, captain = best starter */
function pmTeam(picks,form,R,vOf){
 const ks={1:form.g,2:form.d,3:form.m,4:form.f},xi=[],bench=[];
 for(const t of [1,2,3,4]){const a=[...picks[t]].sort((x,y)=>vOf(y)-vOf(x)||x.id-y.id);a.forEach((it,i)=>(i<ks[t]?xi:bench).push(it))}
 bench.sort((x,y)=>(x.t===1?-1:0)-(y.t===1?-1:0)||vOf(y)-vOf(x));
 const ord=[...xi].sort((x,y)=>vOf(y)-vOf(x)||x.id-y.id),cap=ord[0],vice=ord[1]||null;
 const xiPts=xi.reduce((s,i)=>s+vOf(i),0);
 return {form,xi,bench,cap,vice,xiPts,capBonus:cap?vOf(cap):0,total:xiPts+(cap?vOf(cap):0),cost:[...xi,...bench].reduce((s,i)=>s+i.c,0)};
}
function pmValidate(team,R,forms){
 const bad=[],all=[...team.xi,...team.bench],ids=new Set(all.map(i=>i.id));
 if(ids.size!==all.length)bad.push('a player appears twice');
 if(all.length!==R.squad)bad.push('squad size '+all.length+' != '+R.squad);
 if(team.xi.length!==R.play)bad.push('starting XI size '+team.xi.length+' != '+R.play);
 for(const t of [1,2,3,4]){const n=all.filter(i=>i.t===t).length,s=team.xi.filter(i=>i.t===t).length;
  if(n!==R.T[t].sel)bad.push('position '+t+': '+n+' in squad, required '+R.T[t].sel);if(s<R.T[t].mn||s>R.T[t].mx)bad.push('position '+t+': '+s+' starters outside '+R.T[t].mn+'-'+R.T[t].mx)}
 if(forms&&!forms.some(f=>f.g===team.xi.filter(i=>i.t===1).length&&f.d===team.xi.filter(i=>i.t===2).length&&f.m===team.xi.filter(i=>i.t===3).length&&f.f===team.xi.filter(i=>i.t===4).length))bad.push('formation is not a legal one');
 const cc=new Map();all.forEach(i=>cc.set(i.club,(cc.get(i.club)||0)+1));cc.forEach((n,c)=>{if(n>R.club)bad.push('club '+c+' has '+n+' players (limit '+R.club+')')});
 if(team.cost>R.budget)bad.push('cost '+team.cost+' exceeds budget '+R.budget);
 if(!team.cap||!team.xi.includes(team.cap))bad.push('captain is not a starter');
 if(team.vice&&(team.vice===team.cap||!team.xi.includes(team.vice)))bad.push('vice-captain invalid');
 if(team.bench.length!==R.squad-R.play)bad.push('bench size '+team.bench.length);
 for(const t of [1,2,3,4]){const nb=team.bench.filter(i=>i.t===t).length,exp=R.T[t].sel-team.xi.filter(i=>i.t===t).length;if(nb!==exp)bad.push('bench has '+nb+' of position '+t+', expected '+exp)}
 return bad;
}
function pmPoolOf(d,valOf){
 const pool=[];d.P.forEach(p=>{if(!p.pm||p.pm.q==='nodata'||p.st==='u'||p.st==='n'||!fpOk(p.now_cost))return;const v=valOf(p);if(v==null||!isFinite(v))return;pool.push({id:p.id,t:p.ty,c:p.now_cost,club:p.tm,v})});
 return pool;
}
function pmPrep(pool,R){const P={byT:{1:[],2:[],3:[],4:[]},pos:new Map()};
 pmPrune(pool,R).forEach(i=>{P.byT[i.t].push(i);P.pos.set(i.id,i.t)});for(const t of [1,2,3,4])P.byT[t].sort((a,b)=>b.v-a.v||a.id-b.id);return P}
/* Mode 1: one gameweek (or any single value per player). Exact within the pruned pool, for every legal formation. */
function pmMode1(pool,R,forms){
 const P=pmPrep(pool,R),cache=new Map(),vOf=i=>i.v,res=[];
 for(const f of forms){const n=pmSolveForm(P,R,f,cache);if(n){const tm=pmTeam(n.picks,f,R,vOf);res.push({form:f,team:tm,nodes:n.nodes})}}
 res.sort((a,b)=>b.team.total+PM.EPS*0-a.team.total||b.team.cost-a.team.cost);
 return {all:res,best:res[0]||null,poolSize:P.pos.size,full:pool.length};
}
/* Mode 2: one fixed squad for several gameweeks, with the best lineup chosen each week (no transfers). Local search. */
function pmEvalSquad(sq,Vs,R,forms){
 let total=0;const per=[];
 for(let g=0;g<Vs.length;g++){const V=Vs[g],by={1:[],2:[],3:[],4:[]};sq.forEach(i=>by[i.t].push(V.get(i.id)||0));for(const t of [1,2,3,4])by[t].sort((a,b)=>b-a);
  let best=-Infinity,bf=null;
  for(const f of forms){const ks={1:f.g,2:f.d,3:f.m,4:f.f};let s=0,mx=-Infinity;for(const t of [1,2,3,4]){for(let i=0;i<ks[t];i++)s+=by[t][i];if(ks[t]>0&&by[t][0]>mx)mx=by[t][0]}const v=s+mx;if(v>best){best=v;bf=f}}
  per.push({v:best,form:bf});total+=best}
 return {total,per};
}
function pmMode2(d,R,forms,gwIdx){
 const Vs=gwIdx.map(g=>{const m=new Map();d.P.forEach(p=>{if(p.pm&&p.pm.q!=='nodata')m.set(p.id,p.pm.gws[g].pts)});return m});
 const sum=p=>gwIdx.reduce((s,g)=>s+p.pm.gws[g].pts,0),pool=pmPoolOf(d,sum),m1=pmMode1(pool,R,forms);
 if(!m1.best)return null;
 const byId=new Map(pool.map(i=>[i.id,i])),start=[...m1.best.team.xi,...m1.best.team.bench];
 let sq=start.map(i=>({...i})),ev=pmEvalSquad(sq,Vs,R,forms);const base=ev.total;
 const cand=pmPrune(pool,R).sort((a,b)=>b.v-a.v);
 for(let iter=0;iter<60;iter++){
  const cnt=new Map();sq.forEach(i=>cnt.set(i.club,(cnt.get(i.club)||0)+1));const cost=sq.reduce((s,i)=>s+i.c,0);let bestMove=null,bestV=ev.total+1e-9;
  for(let k=0;k<sq.length;k++){const m=sq[k];
   for(const c of cand){if(c.t!==m.t||sq.some(x=>x.id===c.id))continue;if(cost-m.c+c.c>R.budget)continue;
    const cc=(cnt.get(c.club)||0)-(c.club===m.club?1:0);if(cc+1>R.club)continue;
    const t=sq.slice();t[k]=c;const e=pmEvalSquad(t,Vs,R,forms);if(e.total>bestV){bestV=e.total;bestMove={k,c,e}}}}
  if(!bestMove)break;sq[bestMove.k]={...bestMove.c};ev=bestMove.e;
 }
 return {squad:sq,eval:ev,start:base,fixedLineupTeam:m1.best.team,improved:ev.total-base,poolSize:m1.poolSize};
}

/* ---------- UI: Predicted Points ---------- */
Object.assign(FP,{pq:'',ppos:'',pteam:'',pmax:'',pav:'',pqual:'',pshow:false,psort:{k:'tot',d:-1},pdet:null,bm:'gw1',bg:0});
let FPBEST={};
const pmQLab={high:'Higher',medium:'Medium',low:'Low',nodata:'No data'},pmQCol={high:'#4cc38a',medium:'#e9b44c',low:'#e5646b',nodata:'#8a9bb0'};
const pmTeamS=id=>((FPD.T.get(id)||{}).s)||'?';
const pmFxLab=g=>g.none?'—':g.fx.map(x=>pmTeamS(x.opp)+(x.home?' (H)':' (A)')).join(' + ');
const pmDot=p=>`<span title="${esc(pmStLabel(p)+(p.nw?' — '+p.nw:''))}" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${pmStCol(p)};margin-right:5px"></span>`;
const pmNote=()=>`<div class="card mu" style="font-size:12px"><b>Predicted points are model estimates</b> for the next ${pmCtx(FPD).gws.length} gameweeks. They are not historical points: <b>actual season points</b> appear only in the details panel and the Table tab. Estimates are expected values (probability-weighted), so a player who may miss a match carries a fraction of the points he would score if fit.</div>`;
function fpTPred(el){
 const d=FPD;
 if(!d.rules||!d.fix.length||d.fix[0].length<9){el.innerHTML='<div class="empty">Predictions need game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.</div>';return}
 pmPredictAll(d);const C=pmCtx(d);
 if(!C.gws.length){el.innerHTML='<div class="empty">No upcoming gameweek found in the data.</div>';return}
 el.innerHTML=pmNote()+`<div class="ctl"><input id="pq" placeholder="Search player" value="${esc(FP.pq)}"><select id="ppos">${fpPosOpts(FP.ppos)}</select><select id="ptm">${fpTeamOpts(FP.pteam)}</select><input id="pmx" type="number" step="0.1" placeholder="Max price" value="${esc(FP.pmax)}" style="width:110px"><select id="pav">${fpOpts([['','Any availability'],['ok','Available only'],['no','Doubtful, injured or suspended']],FP.pav)}</select><select id="pql">${fpOpts([['','Any data quality'],['high','Higher only'],['medium','Medium or higher']],FP.pqual)}</select><label class="mu" style="align-self:center"><input type="checkbox" id="psh" ${FP.pshow?'checked':''} style="min-height:0"> include players without data</label></div><div id="pout"></div><div id="pdet"></div><div id="pinfo"></div>`;
 const rd=()=>{FP.pq=$('#pq').value;FP.ppos=$('#ppos').value;FP.pteam=$('#ptm').value;FP.pmax=$('#pmx').value;FP.pav=$('#pav').value;FP.pqual=$('#pql').value;FP.pshow=$('#psh').checked;fpPredDraw()};
 ['pq','pmx'].forEach(i=>$('#'+i).oninput=rd);['ppos','ptm','pav','pql','psh'].forEach(i=>$('#'+i).onchange=rd);
 $('#pinfo').innerHTML=pmInfoHtml(d,C);fpPredDraw();if(FP.pdet!=null)fpPredPick(FP.pdet);
}
function fpPredSort(k){FP.psort=FP.psort.k===k?{k,d:-FP.psort.d}:{k,d:(k==='name'||k==='club')?1:-1};fpPredDraw()}
function fpPredDraw(){
 const d=FPD,C=pmCtx(d),rank={high:3,medium:2,low:1,nodata:0};
 let P=fpFilt(d.P,{q:FP.pq,pos:FP.ppos,team:FP.pteam,maxp:FP.pmax,av:FP.pav}).filter(p=>p.pm&&(FP.pshow||p.pm.q!=='nodata'));
 if(FP.pqual)P=P.filter(p=>rank[p.pm.q]>=rank[FP.pqual]);
 const ppm=p=>p.pm.tot!=null&&p.price>0?p.pm.tot/p.price:null,ppm1=p=>p.pm.g1!=null&&p.price>0?p.pm.g1/p.price:null;
 const key=k=>{const m=/^g(\d)$/.exec(k);if(m)return p=>p.pm.gws[+m[1]]?p.pm.gws[+m[1]].pts:null;
  return {name:p=>p.name,club:p=>p.tn,price:p=>p.price,tot:p=>p.pm.tot,avg:p=>p.pm.avg,ppm,ppm1,em:p=>p.pm.gws[0]?p.pm.gws[0].eMin:null,q:p=>rank[p.pm.q]}[k]};
 const kf=key(FP.psort.k),dir=FP.psort.d;
 const rows=[...P].sort((a,b)=>{const x=kf(a),y=kf(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;const c=typeof x==='string'?x.localeCompare(y):x-y;return dir>0?c:-c});
 const th=(k,t,n)=>`<th class="${n?'n':''}" style="cursor:pointer" onclick="fpPredSort('${k}')">${t}${FP.psort.k===k?(dir<0?' ↓':' ↑'):''}</th>`;
 const gh=C.gws.map((g,i)=>th('g'+i,'GW'+g+'<div class="mu" style="font-size:10px;font-weight:400">predicted</div>',1)).join('');
 const cell=g=>g?(g.none?'<span class="mu" title="No fixture in this gameweek">—</span>':`<div class="mu" style="font-size:10px">${esc(pmFxLab(g))}</div><b>${g.pts.toFixed(1)}</b>`):'';
 $('#pout').innerHTML=`<div class="mu" style="margin-bottom:6px">${rows.length} players. Tap a column to sort, tap a name for the factors behind the prediction. Value = predicted points ÷ price in £m.</div><div class="wrap"><table><tr>${th('name','Player')}${th('club','Club')}<th>Pos</th>${th('price','£',1)}${gh}${th('tot','Σ'+C.gws.length+' GW',1)}${th('avg','Avg / GW',1)}${th('ppm','Pts/£m<div class="mu" style="font-size:10px;font-weight:400">'+C.gws.length+' GW</div>',1)}${th('ppm1','Pts/£m<div class="mu" style="font-size:10px;font-weight:400">GW'+C.gws[0]+'</div>',1)}${th('em','Exp. min<div class="mu" style="font-size:10px;font-weight:400">GW'+C.gws[0]+'</div>',1)}${th('q','Data')}</tr>`+
  rows.slice(0,200).map(p=>`<tr><td>${pmDot(p)}<a href="javascript:void(0)" onclick="fpPredPick(${p.id})">${esc(p.name)}</a></td><td>${esc(p.tn)}</td><td>${FPPOS[p.pos]}</td><td class="n">${p.price==null?'N/A':p.price.toFixed(1)}</td>${p.pm.q==='nodata'?`<td colspan="${C.gws.length+5}" class="mu">${esc(p.pm.flags[0]||'No data')}</td>`:C.gws.map((g,i)=>`<td class="n">${cell(p.pm.gws[i])}</td>`).join('')+`<td class="n"><b>${p.pm.tot.toFixed(1)}</b></td><td class="n">${p.pm.avg.toFixed(2)}</td><td class="n">${f(ppm(p),2)}</td><td class="n">${f(ppm1(p),2)}</td><td class="n">${p.pm.gws[0].eMin>0?Math.round(p.pm.gws[0].eMin):'0'}</td>`}<td><span style="color:${pmQCol[p.pm.q]}">● ${pmQLab[p.pm.q]}</span></td></tr>`).join('')+'</table></div>'+(rows.length>200?'<div class="mu">Showing the first 200.</div>':'');
}
function fpPredPick(id){
 const d=FPD,p=d.PB.get(id),b=$('#pdet');FP.pdet=id;if(!p||!b||!p.pm)return;const m=p.pm,C=pmCtx(d);
 if(m.q==='nodata'){b.innerHTML=`<div class="card"><b>${esc(p.fn+' '+p.sn)}</b><div class="mu">${m.flags.map(esc).join('<br>')}</div></div>`;return}
 const r=m.rates,P=C.pri[p.ty],ts=C.S.get(p.tm)||{},pc=v=>v==null?'N/A':v.toFixed(2);
 const comp=['app','goal','ast','cs','gc','sv','dc','bon','card'],cl={app:'Appear.',goal:'Goals',ast:'Assists',cs:'Clean sheet',gc:'Goals conc.',sv:'Saves',dc:'Def. contr.',bon:'Bonus',card:'Cards/other'};
 const used=comp.filter(k=>m.gws.some(g=>Math.abs(g.parts[k]||0)>1e-9));
 const nextFx=m.gws.find(g=>g.fx.length),nf=nextFx?nextFx.fx[0]:null,so=nf?C.S.get(nf.opp):null;
 const str=[],weak=[];
 if(r.xg90!=null&&P.xg!=null){(r.xg90>P.xg*1.3?str:r.xg90<P.xg*.7?weak:[]).push('xG per 90 '+pc(r.xg90)+' vs '+pc(P.xg)+' for the position')}
 if(r.xa90!=null&&P.xa!=null){(r.xa90>P.xa*1.3?str:r.xa90<P.xa*.7?weak:[]).push('xA per 90 '+pc(r.xa90)+' vs '+pc(P.xa))}
 if(r.finG!=null)(r.finG>1.1?str:r.finG<.9?weak:[]).push('finishing ratio (goals+3)/(xG+3) = '+pc(r.finG));
 if(r.pPlay0<.8&&!r.fit)weak.push('played in '+Math.round(r.pPlay0*100)+'% of his last '+r.recN+' matches');else if(r.pPlay0>=.9&&r.q60>=.8)str.push('regular starter: '+Math.round(r.q60*100)+'% of appearances at 60+ minutes');
 if(so){(so.D>1.1?str:so.D<.9?weak:[]).push('next opponent '+pmTeamS(nf.opp)+' concedes '+pc(so.xga)+' xG per match (league average '+pc(C.mu)+')');(so.A>1.1&&p.ty<=3?weak:[]).push('next opponent '+pmTeamS(nf.opp)+' creates '+pc(so.xgf)+' xG per match')}
 const li=a=>a.length?a.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li class="mu">none notable</li>';
 b.innerHTML=`<div class="card" style="font-size:13px"><b style="font-size:15px">${esc(p.fn+' '+p.sn)}</b> · ${esc(p.tf)} · ${FPPOS[p.pos]} · £${f(p.price,1)}m
 <div style="margin:6px 0">${pmDot(p)}<b>${esc(pmStLabel(p))}</b>${p.nw?' — '+esc(p.nw):''} <span class="mu">(FPL status, updated at each synchronization; kept separate from ability)</span></div>
 <div class="grid" style="margin:8px 0"><div class="kpi"><b>${f(p.total_points,0)}</b><span>Actual season points (history)</span></div><div class="kpi"><b>${m.tot.toFixed(1)}</b><span>Predicted, next ${C.gws.length} GW (availability-adjusted)</span></div><div class="kpi"><b>${m.fit.toFixed(1)}</b><span>Predicted if fully fit</span></div><div class="kpi"><b style="color:${pmQCol[m.q]}">${pmQLab[m.q]}</b><span>Data quality</span></div></div>
 ${m.fit-m.tot>0.5?`<div style="color:var(--a);margin-bottom:6px">Availability lowers this player's prediction by ${(m.fit-m.tot).toFixed(1)} points over the period (${esc([...new Set(m.gws.flatMap(g=>g.fx.map(x=>x.av.src)))].join('; '))}).</div>`:''}
 <div class="wrap"><table><tr><th>GW</th><th>Opponent</th><th class="n">Fit prob.</th><th class="n">Exp. min</th>${used.map(k=>`<th class="n">${cl[k]}</th>`).join('')}<th class="n">Predicted</th><th class="n">If fit</th></tr>${m.gws.map(g=>`<tr><td>${g.ev}</td><td>${esc(pmFxLab(g))}</td><td class="n">${g.none?'—':g.fx.map(x=>Math.round(x.av.a*100)+'%').join(' + ')}</td><td class="n">${g.none?'0':Math.round(g.eMin)}</td>${used.map(k=>`<td class="n">${(g.parts[k]||0).toFixed(2)}</td>`).join('')}<td class="n"><b>${g.pts.toFixed(2)}</b></td><td class="n">${g.fit.toFixed(2)}</td></tr>`).join('')}</table></div>
 <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px"><div style="flex:1;min-width:200px"><b>Strengths</b><ul style="margin:4px 0 0 18px;padding:0">${li(str)}</ul></div><div style="flex:1;min-width:200px"><b>Weaknesses</b><ul style="margin:4px 0 0 18px;padding:0">${li(weak)}</ul></div></div>
 <div class="mu" style="margin-top:8px">Rates used (per 90, shrunk toward the position average): goals ${pc(r.lamG)}, assists ${pc(r.lamA)}${p.ty===1?', saves '+pc(r.R.sv):(r.R.dc!=null?', defensive contribution '+pc(r.R.dc):'')}, bonus ${pc(r.R.bon)}. Playing time: ${r.fit?'recent appearances while fit':'last '+r.recN+' matches'}; P(play) ${Math.round(r.pPlay0*100)}%, P(60+ | plays) ${Math.round(r.q60*100)}%, ${Math.round(r.ePlay)} min when playing.${p.px?` PitchAPI cross-check (not used in the prediction): xG/90 ${f(p.px.xg90,2)}, xT/90 ${f(p.px.xt90,2)}.`:''}</div>
 ${m.flags.length?`<div style="margin-top:8px;color:var(--a)"><b>Uncertainty</b><ul style="margin:4px 0 0 18px;padding:0">${m.flags.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></div>`:''}</div>`;
 b.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function pmInfoHtml(d,C){
 const rows=[['minutes','Appearance'],['goals_scored','Goal'],['assists','Assist'],['clean_sheets','Clean sheet'],['goals_conceded','Goals conceded'],['saves','Saves'],['defensive_contribution','Defensive contribution'],['bonus','Bonus'],['yellow_cards','Yellow card'],['red_cards','Red card'],['own_goals','Own goal'],['penalties_missed','Penalty missed'],['penalties_saved','Penalty saved']];
 const cellR=(id,t)=>{if(id==='minutes'){const m=pmMinRule(d,t);return m.lo+' / '+m.hi+(m.src==='default'?' (default)':'')}const r=pmRule(d,id,t);return r.src==='none'?'—':(r.step>1?r.pts+' per '+r.step:String(r.pts))+(r.src==='default'?' (default)':'')};
 const nSc=C.grN;
 return `<details class="card" style="font-size:12px"><summary class="mu"><b>How predictions are calculated, scoring rules and data limits</b></summary>
 <p>Each fixture is predicted separately: <b>expected points = Σ over scoring categories of (expected events × points per event)</b>. Expected events come from per-90 rates shrunk toward the position average (pseudo-evidence of ${PM.PRIOR_MIN} minutes), scaled by expected minutes, and adjusted for the opponent. Goals use xG once (no separate shot-conversion term), multiplied by a finishing ratio (goals+${PM.K_FIN})/(xG+${PM.K_FIN}). Opponent effect for attackers = the opponent's xG conceded per match relative to the league (team strengths shrunk with ${PM.N0} pseudo-matches), with a home/away league average. Clean sheets use a Poisson goal model: P(0 goals) with the opponent's expected xG, calibrated by league goals ÷ xG (${C.gr.toFixed(3)}, from ${nSc} matches). Saves, goals-conceded deductions and defensive-contribution points are expectations of stepwise rules under Poisson counts. A double gameweek adds both fixtures; a blank gameweek is 0 because there is no match.</p>
 <p><b>Scoring rules</b> (points; "(default)" = this rule was not observed in the live data, so the published FPL value is used; the rest were derived from gameweek ${d.scoring_gw==null?'—':d.scoring_gw} live data):</p>
 <div class="wrap"><table><tr><th>Category</th>${[1,2,3,4].map(t=>`<th>${FPPOS[t]}</th>`).join('')}</tr>${rows.map(([id,l])=>`<tr><td>${l}</td>${[1,2,3,4].map(t=>`<td>${cellR(id,t)}</td>`).join('')}</tr>`).join('')}</table></div>
 <p><b>Limits:</b> FPL data has no shots or shots-on-target per player and no opponent shot counts, so xG/xA and team xG (from per-match player xG) are used instead; PitchAPI shots are not used in the model. Defensive-contribution counts are modelled as Poisson from season totals. Injury data is FPL's own status, news text and published chance of playing (next gameweek only); a return date is used only when the news text states one. Beyond the next gameweek a published chance is carried forward unchanged, and a player with no chance or date published is treated as unavailable. Data quality: <i>Higher</i> = 900+ minutes and available; <i>Medium</i> = 270–899 minutes, doubtful with a published chance, or under 4 recent matches; <i>Low</i> = under 270 minutes, or unavailable without a return date. These are data-sufficiency labels, not accuracy percentages; the model has not been backtested here.${d.postponed?` ${d.postponed} postponed fixture(s) have no gameweek yet and are not counted.`:''}</p></details>`;
}

/* ---------- UI: Best Team ---------- */
const pmMoney=c=>'£'+(c/10).toFixed(1)+'m';
function pmCard(p,m,o){
 const sty=o.abs?`position:absolute;left:${o.x.toFixed(1)}%;top:${o.y}%;transform:translate(-50%,-50%);width:${o.w||19}%;min-width:60px;max-width:98px;`:'flex:1 1 0;min-width:62px;max-width:110px;';
 const badge=o.cap?'<span style="position:absolute;top:-7px;right:-5px;background:#e9b44c;color:#0d1520;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:800;line-height:17px">C</span>':o.vice?'<span style="position:absolute;top:-7px;right:-5px;background:#8a9bb0;color:#0d1520;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:800;line-height:17px">V</span>':'';
 return `<div style="${sty}${o.abs?'':'position:relative;'}background:rgba(13,21,32,.9);border:1.5px solid ${pmStCol(p)};border-radius:8px;padding:3px 3px 4px;font-size:11px;line-height:1.25;text-align:center;cursor:pointer" onclick="fpPredPick(${p.id})" title="${esc(pmStLabel(p)+(p.nw?' — '+p.nw:''))}">${badge}<div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div class="mu" style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.tn)} · ${o.abs?'':FPPOS[p.pos]+' · '}${pmMoney(p.now_cost)}</div><div><b style="color:var(--g)">${o.pts}</b>${o.sub?`<span class="mu" style="font-size:10px"> ${o.sub}</span>`:''}</div>${p.st!=='a'?`<div style="font-size:10px;color:${pmStCol(p)}">${esc(pmStLabel(p))}</div>`:''}</div>`;
}
function pmPitchHtml(team,d,ptsOf,subOf){
 const rows={1:[],2:[],3:[],4:[]};team.xi.forEach(i=>rows[i.t].push(i));const yp={4:15,3:40,2:65,1:88};let cards='';
 for(const t of [4,3,2,1]){const a=rows[t];a.forEach((i,k)=>{cards+=pmCard(d.PB.get(i.id),i,{abs:true,x:(k+.5)/a.length*100,y:yp[t],w:Math.min(19,92/Math.max(a.length,1)),cap:team.cap===i,vice:team.vice===i,pts:ptsOf(i),sub:subOf?subOf(i):''})})}
 const ln='position:absolute;border:1.5px solid rgba(255,255,255,.35);';
 return `<div style="position:relative;width:100%;max-width:560px;margin:8px auto;aspect-ratio:5/6;border-radius:10px;overflow:hidden;background:repeating-linear-gradient(0deg,#1d6b43 0 8.33%,#1a5f3b 8.33% 16.66%);border:2px solid rgba(255,255,255,.4)"><div style="${ln}left:0;right:0;top:50%;border-width:1.5px 0 0"></div><div style="${ln}left:35%;width:30%;top:38%;height:24%;border-radius:50%"></div><div style="${ln}left:22%;width:56%;top:0;height:16%;border-top:0"></div><div style="${ln}left:22%;width:56%;bottom:0;height:16%;border-bottom:0"></div>${cards}</div>`;
}
function pmBenchHtml(team,d,ptsOf,subOf){
 return `<div class="mu" style="margin:4px 0">Bench (in order; goalkeeper first)</div><div style="display:flex;gap:6px;flex-wrap:wrap">${team.bench.map((i,k)=>pmCard(d.PB.get(i.id),i,{pts:ptsOf(i),sub:subOf?subOf(i):'',abs:false})).join('')}</div>`;
}
function pmChecks(team,R,forms){
 const bad=pmValidate(team,R,forms),all=[...team.xi,...team.bench],cc=new Map();all.forEach(i=>cc.set(i.club,(cc.get(i.club)||0)+1));
 const mx=Math.max(...cc.values()),mc=[...cc].filter(([c,n])=>n===mx).map(([c])=>pmTeamS(c)).join(', '),cnt=t=>all.filter(i=>i.t===t).length;
 const ok=(b,t)=>`<div style="color:${b?'var(--g)':'var(--r)'}">${b?'✓':'✗'} ${t}</div>`;
 return `<div class="card" style="font-size:12px"><b>Rule checks (computed on this team)</b>${ok(all.length===R.squad&&[1,2,3,4].every(t=>cnt(t)===R.T[t].sel),'Squad of '+all.length+': '+[1,2,3,4].map(t=>cnt(t)+' '+FPPOS[t]).join(', '))}${ok(team.cost<=R.budget,'Cost '+pmMoney(team.cost)+' of '+pmMoney(R.budget)+' budget')}${ok(mx<=R.club,'At most '+mx+' from one club (limit '+R.club+'; '+mc+')')}${ok(team.xi.length===R.play&&!bad.some(x=>/formation|starters/.test(x)),'Legal formation '+team.form.name+' ('+R.play+' starters, source: '+R.playSrc+')')}${ok(!bad.some(x=>/captain|bench/.test(x)),'Captain and vice-captain are starters; bench of '+team.bench.length)}${bad.length?'<div style="color:var(--r)">'+bad.map(esc).join('<br>')+'</div>':''}</div>`;
}
function fpTBest(el){
 const d=FPD;
 if(!d.rules||!d.fix.length||d.fix[0].length<9){el.innerHTML='<div class="empty">The team builder needs game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.</div>';return}
 const R=pmRules(d);if(!R||R.club==null||R.budget==null){el.innerHTML='<div class="empty">The game constraints (budget, club limit, squad structure) are missing from the downloaded data, so no valid team can be built. They come from FPL\'s game settings; press Synchronize again.</div>';return}
 pmPredictAll(d);const C=pmCtx(d);if(!C.gws.length){el.innerHTML='<div class="empty">No upcoming gameweek found.</div>';return}
 el.innerHTML=pmNote()+`<div class="ctl"><select id="bm">${fpOpts([['gw1','Best team for the next gameweek (GW'+C.gws[0]+')'],['w7','Best squad for the next '+C.gws.length+' gameweeks']],FP.bm)}</select><select id="bgw" style="${FP.bm==='w7'?'':'display:none'}">${fpOpts(C.gws.map((g,i)=>[String(i),'Lineup for GW'+g]),String(FP.bg))}</select></div><div id="bout"><div class="empty">Optimizing every legal formation…</div></div>`;
 $('#bm').onchange=()=>{FP.bm=$('#bm').value;fpTBest($('#fpbody'))};$('#bgw').onchange=()=>{FP.bg=+$('#bgw').value;fpBestDraw()};
 setTimeout(fpBestDraw,30);
}
function fpBestDraw(){
 const d=FPD,R=pmRules(d),C=pmCtx(d),forms=pmForms(R),out=$('#bout');if(!out)return;
 const key=d.generated+'|'+FP.bm;let res=FPBEST[key];
 if(!res){
  if(FP.bm==='gw1'){const pool=pmPoolOf(d,p=>p.pm.gws[0].pts),r1=pmMode1(pool,R,forms),r2=pmMode1(pmPoolOf(d,p=>p.pm.gws[0].fit),R,forms);res={r1,r2}}
  else{const idx=C.gws.map((_,i)=>i);res={m2:pmMode2(d,R,forms,idx),idx}}
  FPBEST[key]=res;
 }
 if(FP.bm==='gw1')return pmDrawGw1(out,d,R,C,forms,res);
 return pmDrawW7(out,d,R,C,forms,res);
}
function pmDrawGw1(out,d,R,C,forms,res){
 const b=res.r1.best;if(!b){out.innerHTML='<div class="empty">No valid team exists under the rules with the players that have data.</div>';return}
 const t=b.team,g=C.gws[0],val=i=>d.PB.get(i.id).pm.gws[0].pts,fitv=i=>d.PB.get(i.id).pm.gws[0].fit;
 const second=res.r1.all[1],all=[...t.xi,...t.bench],adj=all.filter(i=>d.PB.get(i.id).st!=='a');
 let cf='';const c=res.r2.best;
 if(c){const ids=new Set(all.map(i=>i.id)),cids=[...c.team.xi,...c.team.bench],add=cids.filter(i=>!ids.has(i.id)),cset=new Set(cids.map(i=>i.id)),drop=all.filter(i=>!cset.has(i.id));
  const picks={1:[],2:[],3:[],4:[]};cids.forEach(i=>picks[i.t].push({...i,v:val(i)}));const blind=pmTeam(picks,c.team.form,R,i=>i.v);
  cf=add.length?`<div class="card" style="font-size:13px"><b>Availability changed the selection.</b> If injuries and doubts were ignored the optimizer would pick ${add.map(i=>esc(d.PB.get(i.id).name)+' ('+esc(pmStLabel(d.PB.get(i.id)))+')').join(', ')} instead of ${drop.map(i=>esc(d.PB.get(i.id).name)).join(', ')}. That availability-blind team is expected to score ${blind.total.toFixed(1)} points once their fitness is counted, against ${t.total.toFixed(1)} for the chosen team.</div>`:'<div class="card mu" style="font-size:13px">Availability did not change the selection: the same 15 players are optimal with and without the injury adjustment.</div>';}
 const sc=i=>val(i).toFixed(1),cap=d.PB.get(t.cap.id),vc=t.vice?d.PB.get(t.vice.id):null;
 const capPlay=(()=>{const gg=cap.pm.gws[0];return gg.fx.length?1-gg.fx.reduce((s,x)=>s*(1-x.pPlay),1):0})(),viceExtra=vc?(1-capPlay)*val(t.vice):0;
 out.innerHTML=`<div class="grid"><div class="kpi"><b>${t.form.name}</b><span>Formation chosen</span></div><div class="kpi"><b>${t.total.toFixed(1)}</b><span>Predicted points, starting XI incl. captain, GW${g}</span></div><div class="kpi"><b>${pmMoney(t.cost)}</b><span>Squad cost</span></div><div class="kpi"><b>${pmMoney(R.budget-t.cost)}</b><span>Budget remaining</span></div><div class="kpi"><b>${(all.reduce((s,i)=>s+val(i),0)).toFixed(1)}</b><span>Predicted, whole squad (bench included, no captain bonus)</span></div></div>
 <div class="mu" style="margin:8px 0">Period: gameweek ${g} only. Captain ${esc(cap.name)} scores double (expected extra ${val(t.cap).toFixed(1)}); vice-captain ${vc?esc(vc.name):'—'} takes over only if the captain does not play${vc?` (P(captain plays) ${Math.round(capPlay*100)}%, expected vice bonus ${viceExtra.toFixed(2)}, not included in the total)`:''}.</div>
 ${pmPitchHtml(t,d,sc,i=>'')}${pmBenchHtml(t,d,sc)}
 <h3>Formation comparison (each is the exact optimum for that formation)</h3>${tbl([['Formation'],['Predicted XI + captain',1],['Cost',1],['']],res.r1.all.map(r=>[r.form.name,r.team.total.toFixed(2),pmMoney(r.team.cost),r===res.r1.all[0]?'<span class="tag ok">chosen</span>':(r.team.total-res.r1.all[0].team.total).toFixed(2)]))}
 <div class="mu" style="font-size:12px;margin:6px 0">${esc(t.form.name)} is chosen because its best valid team has the highest predicted total${second?`; the next best, ${esc(second.form.name)}, is ${(t.total-second.team.total).toFixed(2)} points lower`:''}. The objective is total expected points within the budget and rules, not points per £.</div>
 ${cf}${adj.length?`<div class="card" style="font-size:12px"><b>Players with an availability flag in this squad</b><br>${adj.map(i=>{const p=d.PB.get(i.id);return esc(p.name)+' — '+esc(pmStLabel(p))+': '+val(i).toFixed(2)+' predicted vs '+fitv(i).toFixed(2)+' if fully fit'+(p.nw?' ('+esc(p.nw)+')':'')}).join('<br>')}</div>`:''}
 ${pmChecks(t,R,forms)}
 <h3>Squad value (period = GW${g})</h3>${tbl([['Player'],['Club'],['Pos'],['£',1],['Role'],['Predicted GW'+g,1],['Pts/£m (GW'+g+')',1]],[...t.xi,...t.bench].map(i=>{const p=d.PB.get(i.id);return [esc(p.name),esc(p.tn),FPPOS[p.pos],(p.now_cost/10).toFixed(1),t.xi.includes(i)?(t.cap===i?'XI · captain':t.vice===i?'XI · vice':'XI'):'Bench',val(i).toFixed(2),(val(i)/(p.now_cost/10)).toFixed(2)]}))}
 <div class="mu" style="font-size:12px;margin:6px 0">Optimization: exact for the candidate pool (${res.r1.poolSize} of ${res.r1.full} players after a lossless dominance prune), using dynamic programming over the budget with branch and bound for the club limit. Bench order breaks ties among equal-value squads (weight ${PM.EPS}); FPL automatic substitutions are not simulated.</div>`;
}
function pmDrawW7(out,d,R,C,forms,res){
 const m=res.m2;if(!m){out.innerHTML='<div class="empty">No valid squad exists under the rules with the players that have data.</div>';return}
 const gi=Math.min(FP.bg,C.gws.length-1),g=C.gws[gi],vOf=i=>d.PB.get(i.id).pm.gws[gi].pts,per=m.eval.per[gi],picks={1:[],2:[],3:[],4:[]};m.squad.forEach(i=>picks[i.t].push(i));
 const t=pmTeam(picks,per.form,R,vOf),sum7=i=>d.PB.get(i.id).pm.tot,all=[...t.xi,...t.bench];
 const adj=m.squad.filter(i=>d.PB.get(i.id).st!=='a');
 out.innerHTML=`<div class="grid"><div class="kpi"><b>${m.eval.total.toFixed(1)}</b><span>Predicted points over ${C.gws.length} GW (best lineup each week, incl. captain)</span></div><div class="kpi"><b>${pmMoney(t.cost)}</b><span>Squad cost</span></div><div class="kpi"><b>${pmMoney(R.budget-t.cost)}</b><span>Budget remaining</span></div><div class="kpi"><b>${t.form.name}</b><span>Formation for GW${g}</span></div><div class="kpi"><b>${t.total.toFixed(1)}</b><span>GW${g} starting XI incl. captain</span></div></div>
 <div class="mu" style="margin:8px 0">This mode picks <b>one fixed 15-player squad</b> and chooses the best legal lineup, formation and captain for every gameweek. <b>Transfers, chips, free-transfer limits and price changes are not modelled</b> because the app does not know your current team. Pitch: lineup for GW${g}. Cards show the GW${g} prediction and, in grey, the ${C.gws.length}-GW total.</div>
 ${pmPitchHtml(t,d,i=>vOf(i).toFixed(1),i=>'Σ'+sum7(i).toFixed(0))}${pmBenchHtml(t,d,i=>vOf(i).toFixed(1),i=>'Σ'+sum7(i).toFixed(0))}
 <h3>Lineup by gameweek</h3>${tbl([['GW'],['Formation'],['Predicted XI + captain',1]],C.gws.map((gw,k)=>[gw,m.eval.per[k].form.name,m.eval.per[k].v.toFixed(2)]))}
 ${adj.length?`<div class="card" style="font-size:12px"><b>Players with an availability flag in this squad</b><br>${adj.map(i=>{const p=d.PB.get(i.id);return esc(p.name)+' — '+esc(pmStLabel(p))+': '+p.pm.tot.toFixed(1)+' predicted vs '+p.pm.fit.toFixed(1)+' if fully fit over the period'}).join('<br>')}</div>`:''}
 ${pmChecks(t,R,forms)}
 <h3>Squad value (period = ${C.gws.length} GW)</h3>${tbl([['Player'],['Club'],['Pos'],['£',1],['Predicted '+C.gws.length+' GW',1],['Pts/£m ('+C.gws.length+' GW)',1],['Availability']],m.squad.map(i=>{const p=d.PB.get(i.id);return [esc(p.name),esc(p.tn),FPPOS[p.pos],(p.now_cost/10).toFixed(1),p.pm.tot.toFixed(1),(p.pm.tot/(p.now_cost/10)).toFixed(2),esc(pmStLabel(p))]}))}
 <div class="mu" style="font-size:12px;margin:6px 0">Optimization: the squad starts from the exact optimum when one lineup is used for all ${C.gws.length} weeks (${m.start.toFixed(1)} predicted points), then improves by single-player swaps with weekly rotation (+${m.improved.toFixed(1)}). This is a local search: it respects every rule but is not proven globally optimal. Predicted totals for ${C.gws.length} gameweeks carry more uncertainty than the next gameweek.</div>`;
}
"""


_X_FPJS3 = r"""/* ===== Backtest (leak-free): replays every finished gameweek using ONLY data from earlier gameweeks ===== */
const BT={start:4,key:'',res:null,busy:false,line:null,lineBusy:false};
/* [field name the live model reads on a player, short column name in the stored match history] */
const BT_MAP=[['minutes','min'],['expected_goals','xg'],['goals_scored','gl'],['expected_assists','xa'],['assists','as'],['bonus','bon'],['yellow_cards','yc'],['red_cards','rc'],['own_goals','og'],['penalties_missed','pmi'],['penalties_saved','psv'],['saves','sv'],['defensive_contribution','dc']];
const btIx=d=>{const m={};(d.hcols||[]).forEach((c,i)=>m[c]=i);return m};
/* sum of the values that exist; null (missing) when no row has the value. Missing is never turned into 0. */
/* xG and xA of matches where they were not published (2022-23 before gameweek 16) are missing, not zero: the player's xG over the
   matches that have it is scaled to all his minutes, so his per-90 rate is kept; with none, the model uses goals and assists only */
function btXgScale(o,prior,ix){
 for(const [pf,hc] of [['expected_goals','xg'],['expected_assists','xa']]){const j=ix[hc];if(j===undefined)continue;let mA=0,mX=0,s=0;
  for(const x of prior){const m=x[ix.min];if(!(m>0))continue;mA+=m;if(fpOk(x[j])){mX+=m;s+=x[j]}}
  if(mA>mX)o[pf]=mX>0?s*mA/mX:null}
}
const btSum=(rows,j)=>{let s=null;if(j===undefined)return s;for(const x of rows){const v=x[j];if(fpOk(v))s=(s||0)+v}return s};
const btAvg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const btYield=()=>new Promise(r=>setTimeout(r,0));
/* the club a player really played for in gameweek r (from his opponent + home flag in that round); falls back to his current club */
function btTeamAt(p,rr,fixR,ix){
 const x0=rr[0],o=x0[ix.opp],h=x0[ix.h];
 if(!fpOk(o)||(h!==0&&h!==1))return p.tm;
 const c=fixR.filter(x=>h===1?x[2]===o:x[1]===o).map(x=>h===1?x[1]:x[2]);
 if(!c.length)return p.tm;
 return c.includes(p.tm)?p.tm:c[0];
}
/* One gameweek r. Everything the model sees is rebuilt from rows with round < r:
   player totals, team strengths, league averages, position priors, finished fixtures. Round r fixtures are marked unplayed with no score. */
function btRound(d,P,H,ix,fixAll,r){
 const ev=d.events.filter(e=>e.id<=r).map(e=>Object.assign({},e,{fin:e.id<r,cur:false,nxt:e.id===r}));
 const fixR=fixAll.filter(x=>x[0]===r);
 const fix=fixAll.filter(x=>x[0]<r).concat(fixR.map(x=>{const y=x.slice();y[5]=0;y[6]=null;y[7]=null;return y}));
 const sh=[],tg=[],Hp={};
 for(const p of P){
  const rows=H[String(p.id)];if(!rows)continue;
  const rr=rows.filter(x=>x[0]===r),prior=rows.filter(x=>x[0]<r),tm=rr.length?btTeamAt(p,rr,fixR,ix):p.tm;
  const o={id:p.id,ty:p.ty,tm,st:'a',nw:'',chance_of_playing_next_round:null,name:p.name};
  for(const [pf,hc] of BT_MAP)o[pf]=btSum(prior,ix[hc]);btXgScale(o,prior,ix);
  Hp[String(p.id)]=prior;sh.push(o);
  if(rr.length)tg.push({p,o,rr,prior});
 }
 const dd=Object.assign({},d,{events:ev,fix,P:sh,hist:Hp});delete dd._pm;delete dd._pmPred;
 const C=pmCtx(dd),out=[];let excl=0,nofx=0;
 for(const t of tg){
  const m=pmPlayer(t.o,C,dd);
  if(m.q==='nodata'){excl++;continue}
  const g=m.gws[0];if(!g||g.none||!g.fx.length){nofx++;continue}
  const act=btSum(t.rr,ix.pts);if(act==null)continue;
  const amin=btSum(t.rr,ix.min),n=g.fx.length;
  const pts=t.prior.map(x=>x[ix.pts]).filter(fpOk),mins=t.prior.map(x=>x[ix.min]).filter(fpOk);
  const bs=btAvg(pts),b5=btAvg(pts.slice(-5)),m5=btAvg(mins.slice(-5)),l5=mins.slice(-5),q5=l5.length?l5.filter(x=>x>0).length/l5.length:null;
  if(bs==null||b5==null||m5==null||q5==null)continue;
  const pv=t.rr[t.rr.length-1][ix.val];
  out.push({r,id:t.p.id,name:t.p.name,pos:t.p.ty,club:t.o.tm,pred:g.pts,bs:bs*n,b5:b5*n,act,amin,eMin:g.eMin,mb:m5*n,
   pp:1-g.fx.reduce((s,x)=>s*(1-x.pPlay),1),pb:1-Math.pow(1-q5,n),played:amin==null?null:(amin>0?1:0),pr:t.o.minutes,price:fpOk(pv)?pv:null,n,q:m.q});
 }
 return {rows:out,excl,nofx,targets:tg.length};
}
async function btRun(d,onP){
 const ix=btIx(d);
 for(const k of ['r','pts','min','opp','h','val'])if(ix[k]===undefined)throw new Error('the stored match history has no "'+k+'" column: press Synchronize once');
 const H={};Object.keys(d.hist||{}).forEach(k=>{H[k]=d.hist[k].slice().sort((a,b)=>a[0]-b[0])});
 const fixAll=d.fix.filter(x=>x[0]),rounds=d.events.filter(e=>e.fin&&e.id>=2).map(e=>e.id).sort((a,b)=>a-b);
 const rows=[];let excl=0,nofx=0,targets=0;
 for(const r of rounds){
  const x=btRound(d,d.P,H,ix,fixAll,r);
  x.rows.forEach(y=>rows.push(y));excl+=x.excl;nofx+=x.nofx;targets+=x.targets;
  if(onP)onP(r);await btYield();
 }
 return {rows,rounds,excl,nofx,targets,at:d.generated};
}

/* ---------- metrics (pure functions) ---------- */
function btStat(rows,k){
 const v=rows.filter(x=>fpOk(x[k]));const n=v.length;if(!n)return null;
 let a=0,s=0,b=0;v.forEach(x=>{const e=x[k]-x.act;a+=Math.abs(e);s+=e*e;b+=e});
 return {n,mae:a/n,rmse:Math.sqrt(s/n),bias:b/n};
}
/* paired by gameweek: mean MAE gain of model a over baseline b (positive = a better), its standard error across gameweeks, and the number of gameweeks a won */
function btCmp(rows,a,b,minN){
 const by=new Map();
 rows.forEach(x=>{let o=by.get(x.r);if(!o){o={n:0,a:0,b:0};by.set(x.r,o)}o.n++;o.a+=Math.abs(x[a]-x.act);o.b+=Math.abs(x[b]-x.act)});
 const ds=[...by.values()].filter(o=>o.n>=minN).map(o=>(o.b-o.a)/o.n),k=ds.length;
 if(!k)return null;
 const mu=btAvg(ds),sd=k>1?Math.sqrt(ds.reduce((s,x)=>s+(x-mu)*(x-mu),0)/(k-1)):null;
 return {k,mu,se:sd==null?null:sd/Math.sqrt(k),wins:ds.filter(x=>x>0).length};
}
function btBrier(rows,k){
 const v=rows.filter(x=>x.played!=null&&fpOk(x[k]));
 return v.length?{n:v.length,b:v.reduce((s,x)=>s+(x[k]-x.played)*(x[k]-x.played),0)/v.length}:null;
}
function btCalib(rows){
 return [[0,.2],[.2,.4],[.4,.6],[.6,.8],[.8,1.0001]].map(([lo,hi])=>{
  const v=rows.filter(x=>x.played!=null&&x.pp>=lo&&x.pp<hi);
  return {lo,hi:Math.min(hi,1),n:v.length,pred:v.length?btAvg(v.map(x=>x.pp)):null,obs:v.length?btAvg(v.map(x=>x.played)):null};
 });
}
/* Captain: each gameweek every method picks the single highest-predicted player of a pool (players with enough earlier minutes). */
function btCaptain(rows,minPrior,minPool){
 const by=new Map();
 rows.forEach(x=>{if((x.pr||0)<minPrior)return;if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
 const keys=['pred','b5','bs'],res={};keys.forEach(k=>res[k]={n:0,pts:0,reg:0,top10:0});
 const detail=[];let rounds=0,orc=0;
 [...by.keys()].sort((a,b)=>a-b).forEach(r=>{
  const L=by.get(r);if(L.length<minPool)return;
  rounds++;
  const sorted=[...L].sort((a,b)=>b.act-a.act||a.id-b.id),best=sorted[0];orc+=best.act;
  const row={r,best};
  keys.forEach(k=>{
   const pick=L.reduce((a,b)=>(b[k]>a[k]||(b[k]===a[k]&&b.id<a.id))?b:a);
   const rank=sorted.findIndex(x=>x.id===pick.id)+1,o=res[k];
   o.n++;o.pts+=pick.act;o.reg+=best.act-pick.act;if(rank<=10)o.top10++;row[k]=pick;
  });
  detail.push(row);
 });
 return {rounds,oracle:rounds?orc/rounds:null,res,detail};
}
/* Team selection: each gameweek, build the best legal squad/XI from scratch with the real optimizer, valuing players by the model / last-5 average / (hindsight) actual points. Prices are the price recorded for that gameweek. */
async function btLineup(d,rows,start,onP){
 const R=pmRules(d);
 if(!R||R.club==null||R.budget==null)throw new Error('game constraints (budget / club limit / squad structure) are missing from the data');
 const forms=pmForms(R),by=new Map();
 rows.forEach(x=>{if(x.price==null)return;if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
 const out=[];
 for(const r of [...by.keys()].sort((a,b)=>a-b).filter(r=>r>=start)){
  const L=by.get(r),act=new Map(L.map(x=>[x.id,x.act])),res={r};
  for(const [k,key] of [['model','pred'],['b5','b5'],['oracle','act']]){
   const m=pmMode1(L.map(x=>({id:x.id,t:x.pos,c:x.price,club:x.club,v:x[key]})),R,forms);
   if(!m.best){res[k]=null;continue}
   const t=m.best.team;
   res[k]={pts:t.xi.reduce((s,i)=>s+act.get(i.id),0)+(t.cap?act.get(t.cap.id):0),form:t.form.name,bad:pmValidate(t,R,forms).length,cap:t.cap?t.cap.id:null};
  }
  out.push(res);if(onP)onP(r);await btYield();
 }
 return out;
}

/* ---------- UI ---------- */
function fpTBack(el){
 const d=FPD,ix=btIx(d),au=(d.haudit||{}).f||{},tot=(d.haudit||{}).rows||0;
 const done=d.events.filter(e=>e.fin).map(e=>e.id).filter(r=>r>=2),mx=done.length?Math.max(...done):0;
 const intro=`<div class="card mu" style="font-size:12px"><b>What this tests.</b> Every finished gameweek is replayed as if it had not been played: the model sees only matches from <b>earlier</b> gameweeks (player totals, team strengths, league averages and position priors are all rebuilt from those rows), then its prediction is compared with the points the player actually scored. Baselines: the player's average points per match over his last 5 matches, and over the season so far, multiplied by his number of fixtures. Model tested: <b>v1 = the model used in Predicted Points</b>, unchanged.</div>`;
 if(!Object.keys(d.hist||{}).length||ix.gl===undefined){el.innerHTML=intro+'<div class="empty">The stored match history is in the old short format, so most inputs of the model cannot be replayed. Press Synchronize in Settings once: it re-downloads every player history (a few minutes), then reopen this tab.</div>';return}
 if(mx<2){el.innerHTML=intro+'<div class="empty">A backtest needs at least 2 finished gameweeks (one to learn from, one to predict).</div>';return}
 const miss=BT_MAP.filter(([pf,hc])=>!(au[hc]>0)).map(([pf])=>pf);
 BT.start=Math.max(2,Math.min(BT.start,mx));
 el.innerHTML=intro+(miss.length?`<div class="card" style="font-size:12px;color:var(--a)">History fields FPL did not return at all (these inputs are missing, not zero): ${miss.map(esc).join(', ')}. Components that need them are left out of the replay, exactly as in the live model.</div>`:'')+
  `<div class="ctl"><select id="btst">${fpOpts(Array.from({length:mx-1},(_,i)=>[String(i+2),'Evaluate from GW'+(i+2)]),String(BT.start))}</select><button class="s" id="btrun">Re-run</button></div><div id="btout"><div class="empty">Replaying gameweeks…</div></div>`;
 $('#btst').onchange=()=>{BT.start=+$('#btst').value;btDraw()};
 $('#btrun').onclick=()=>{BT.res=null;BT.line=null;btGo()};
 btGo();
}
async function btGo(){
 const d=FPD,key=d.generated;
 if(BT.res&&BT.key===key){btDraw();return}
 if(BT.busy)return;
 BT.busy=true;
 try{
  BT.res=await btRun(d,r=>{const e=$('#btout');if(e)e.innerHTML=`<div class="empty">Replaying gameweek ${r}… (no future data is used)</div>`});
  BT.key=key;BT.line=null;
 }catch(e){const o=$('#btout');if(o)o.innerHTML=`<div class="empty">Backtest failed: ${esc(e.message)}</div>`;BT.busy=false;return}
 BT.busy=false;btDraw();
}
async function btLine(){
 if(BT.lineBusy||!BT.res)return;
 BT.lineBusy=true;
 try{const res=await btLineup(FPD,BT.res.rows,BT.start,r=>{const e=$('#btlmsg');if(e)e.textContent='Optimizing gameweek '+r+'…'});BT.line={start:BT.start,res}}
 catch(e){BT.line={start:BT.start,err:e.message}}
 BT.lineBusy=false;btDraw();
}
function btLineHtml(){
 const L=BT.line,head='<h3>Team selection test</h3>';
 const intro='<div class="mu" style="font-size:12px;margin-bottom:6px">Each gameweek the real Best Team optimizer (budget, 3-per-club rule, legal formations, captain) builds a team from scratch, once valuing players by the model and once by the last-5 average. "Hindsight" values players by the points they actually scored: an unreachable ceiling that shows how much is left. Team points = starting XI + captain bonus; the bench and automatic substitutions are not counted. The price used is the one recorded for that gameweek.</div>';
 if(!L||L.start!==BT.start)return head+intro+`<div class="ctl"><button class="s" onclick="btLine()" ${BT.lineBusy?'disabled':''}>Run team selection test</button></div><div class="mu" style="font-size:12px">This one is slow: about 5 seconds per gameweek on a computer in my synthetic test, probably longer on a phone. The page stays usable between gameweeks.</div><div class="ctl" style="display:none"></div><div id="btlmsg" class="mu">${BT.lineBusy?'Working…':''}</div>`;
 if(L.err)return head+`<div class="empty">Could not run: ${esc(L.err)}</div>`;
 const R=L.res.filter(x=>x.model&&x.b5&&x.oracle);
 if(!R.length)return head+'<div class="empty">No gameweek produced a valid team for all three methods.</div>';
 const m=a=>btAvg(R.map(x=>x[a].pts)),bad=R.reduce((s,x)=>s+x.model.bad+x.b5.bad+x.oracle.bad,0),w=R.filter(x=>x.model.pts>x.b5.pts).length,t=R.filter(x=>x.model.pts===x.b5.pts).length;
 return head+intro+`<div class="grid"><div class="kpi"><b>${f(m('model'),1)}</b><span>Model team, mean points per GW</span></div><div class="kpi"><b>${f(m('b5'),1)}</b><span>Last-5 average team</span></div><div class="kpi"><b>${f(m('oracle'),1)}</b><span>Hindsight ceiling</span></div><div class="kpi"><b>${w} / ${R.length}</b><span>GWs where the model team beat last-5${t?' ('+t+' ties)':''}</span></div></div>`+
  tbl([['GW',1],['Model',1],['Last-5',1],['Hindsight',1],['Model formation']],R.map(x=>[x.r,f(x.model.pts,0),f(x.b5.pts,0),f(x.oracle.pts,0),esc(x.model.form)]))+
  `<div class="mu" style="font-size:12px;margin-top:6px">Rule violations found by the validator in the ${R.length*3} teams: ${bad}.</div>`;
}
function btDraw(){
 const o=$('#btout');if(!o||!BT.res)return;
 const rows=BT.res.rows.filter(x=>x.r>=BT.start);
 if(!rows.length){o.innerHTML='<div class="empty">No player-gameweeks in this range.</div>';return}
 const rs=[...new Set(rows.map(x=>x.r))].sort((a,b)=>a-b),pl=new Set(rows.map(x=>x.id)).size;
 const S={pred:btStat(rows,'pred'),b5:btStat(rows,'b5'),bs:btStat(rows,'bs')};
 const c5=btCmp(rows,'pred','b5',20),cS=btCmp(rows,'pred','bs',20);
 const imp=(a,b)=>a&&b?(1-a.mae/b.mae)*100:null,sg=v=>v==null?'N/A':(v>0?'+':'')+v.toFixed(1)+'%';
 const sr=(n,s,b)=>[n,s.n,f(s.mae,3),f(s.rmse,3),(s.bias>0?'+':'')+f(s.bias,3),b?sg(imp(S.pred,s)):''];
 const cmpTxt=(c,n)=>c?`vs ${n}: the model had the lower average error in <b>${c.wins} of ${c.k}</b> gameweeks; mean MAE gain ${f(c.mu,3)} points${c.se!=null?' ± '+f(1.96*c.se,3)+' (95% interval across gameweeks)':''}.`:`vs ${n}: not enough data.`;
 const warn=rs.length<5?`<div class="card" style="font-size:13px;color:var(--a)"><b>Small sample:</b> only ${rs.length} gameweek${rs.length>1?'s':''}. Treat every number below as provisional; it becomes meaningful as the season grows.</div>`:'';
 const pos=[1,2,3,4].map(t=>{const L=rows.filter(x=>x.pos===t);if(!L.length)return null;const a=btStat(L,'pred'),b=btStat(L,'b5');return [FPPOS[t],a.n,f(a.mae,3),f(b.mae,3),sg(imp(a,b)),f(a.rmse,3),f(b.rmse,3),(a.bias>0?'+':'')+f(a.bias,3)]}).filter(Boolean);
 const byR=rs.map(r=>{const L=rows.filter(x=>x.r===r);return {r,n:L.length,a:btStat(L,'pred'),b:btStat(L,'b5'),c:btStat(L,'bs')}});
 /* minutes */
 const mr=rows.filter(x=>x.amin!=null),mm=btStat(mr.map(x=>({pred:x.eMin,b5:x.mb,act:x.amin})),'pred'),mb=btStat(mr.map(x=>({pred:x.eMin,b5:x.mb,act:x.amin})),'b5');
 const br=btBrier(rows,'pp'),bb=btBrier(rows,'pb'),pr0=mr.length?btAvg(mr.map(x=>x.played)):null,b0=pr0==null?null:btAvg(mr.map(x=>(pr0-x.played)*(pr0-x.played)));
 const cal=btCalib(rows).filter(x=>x.n>0);
 /* captain */
 const cp=btCaptain(rows,180,20),cr=cp.res;
 const ct=cp.rounds?tbl([['Method'],['Mean points of the pick',1],['Mean regret vs best player',1],['Pick in the actual top 10',1]],
  [['Model (v1)','pred'],['Last-5 average','b5'],['Season average','bs']].map(([n,k])=>[n,f(cr[k].pts/cr[k].n,2),f(cr[k].reg/cr[k].n,2),cr[k].top10+' / '+cr[k].n])
  .concat([['Hindsight best player',f(cp.oracle,2),'0.00','—']]))
  +`<div class="mu" style="font-size:12px;margin:6px 0">Pool: players with at least 180 minutes before that gameweek (at least 20 such players). Points are single (not doubled). The model is also compared with the last-5 pick gameweek by gameweek below.</div>`+
  tbl([['GW',1],['Model pick'],['Pts',1],['Last-5 pick'],['Pts',1],['Best in pool'],['Pts',1]],cp.detail.map(x=>[x.r,esc(x.pred.name),f(x.pred.act,0),esc(x.b5.name),f(x.b5.act,0),esc(x.best.name),f(x.best.act,0)]))
  :'<div class="empty">Not enough players in the pool to test captain picks yet.</div>';
 o.innerHTML=warn+`<div class="grid"><div class="kpi"><b>${rows.length}</b><span>Player-gameweeks tested</span></div><div class="kpi"><b>${pl}</b><span>Different players</span></div><div class="kpi"><b>GW${rs[0]}–${rs[rs.length-1]}</b><span>${rs.length} gameweeks</span></div><div class="kpi"><b style="font-size:13px">${esc(BT.res.at||'')}</b><span>Data version (UTC)</span></div></div>
 <div class="mu" style="font-size:12px;margin:6px 0">Not in the sample: ${BT.res.excl} player-gameweeks where the model had no estimate (no earlier minutes) and ${BT.res.nofx} where no matching fixture was found. Players with no minutes all season are not in the stored history.</div>
 <h3>Points accuracy (lower error is better)</h3>`+
 tbl([['Method'],['N',1],['MAE',1],['RMSE',1],['Bias (pred − actual)',1],['Model MAE gain',1]],[sr('Model v1',S.pred,false),sr('Last-5 average',S.b5,true),sr('Season average',S.bs,true)])+
 `<div class="mu" style="font-size:12px;margin:6px 0">${cmpTxt(c5,'last-5 average')}<br>${cmpTxt(cS,'season average')}<br>MAE = mean absolute error, RMSE = root mean squared error (punishes big misses), both in FPL points per player-gameweek. A positive "gain" means the model's average error is smaller than the baseline's. Errors are large for every method because single-match points are very noisy.</div>
 <h3>By position</h3>`+tbl([['Pos'],['N',1],['MAE model',1],['MAE last-5',1],['Gain',1],['RMSE model',1],['RMSE last-5',1],['Bias',1]],pos)+
 `<h3>By gameweek</h3>`+fpLines([{n:'Model',v:byR.map(x=>x.a?x.a.mae:null)},{n:'Last-5',v:byR.map(x=>x.b?x.b.mae:null)},{n:'Season avg',v:byR.map(x=>x.c?x.c.mae:null)}],rs,'MAE per gameweek (lower is better)',2)+
 `<div class="mu" style="font-size:12px;margin:4px 0">Colour order: model, last-5, season average.</div>`+tbl([['GW',1],['N',1],['MAE model',1],['MAE last-5',1],['MAE season',1],['RMSE model',1]],byR.map(x=>[x.r,x.n,f(x.a&&x.a.mae,3),f(x.b&&x.b.mae,3),f(x.c&&x.c.mae,3),f(x.a&&x.a.rmse,3)]))+
 `<h3>Minutes and playing probability</h3>`+(mm?tbl([['Method'],['N',1],['Minutes MAE',1],['Brier score (P(play))',1]],[['Model v1',mm.n,f(mm.mae,1),f(br&&br.b,4)],['Last-5 average',mb.n,f(mb.mae,1),f(bb&&bb.b,4)],['Constant (overall rate '+(pr0==null?'N/A':Math.round(pr0*100)+'%')+')','',' ',f(b0,4)]]):'<div class="empty">No minutes data.</div>')+
 `<div class="mu" style="font-size:12px;margin:6px 0">Minutes MAE: average gap between expected and actual minutes in the gameweek. Brier score: mean squared gap between the predicted probability of playing at all and what happened (0 = perfect; lower is better). Calibration: among players given about X% chance to play, how many played.</div>`+
 (cal.length?tbl([['Predicted chance'],['N',1],['Average predicted',1],['Played',1]],cal.map(x=>[Math.round(x.lo*100)+'–'+Math.round(x.hi*100)+'%',x.n,f(x.pred*100,0)+'%',f(x.obs*100,0)+'%'])):'')+
 `<h3>Captain picks</h3>`+ct+btLineHtml()+
 `<h3>Not tested here</h3><div class="card mu" style="font-size:12px">Injuries, suspensions and news: FPL keeps no historical record of them, so every player is treated as available in the replay (the live model does adjust for them). Transfers, chips and price changes are not tested. Scoring rules are assumed constant through the season. A player who changed club is placed in his real club for the gameweek being predicted, but his earlier matches count toward his current club's data. The replay uses FPL fields only (xG, xA, minutes, bonus and the other history columns); PitchAPI data is not used. No model version other than v1 exists yet, and the model has not been tuned on these results, so nothing here is an in-sample fit.</div>`;
}
"""


def _x_fpl_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (Fantasy): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "['rankings','Rankings'],", "['rankings','Rankings'],['fantasy','Fantasy'],")
    h = sub(h, "async function route(){", _X_FPJS + _X_FPJS2 + _X_FPJS3 + "\nasync function route(){")
    return h


INDEX = _x_fpl_index(INDEX)
# ======================== نهاية إضافة Fantasy ========================


# ============================================================================
# إضافة: التشكيلة المثالية (Optimal Starting XI) + بنّاء تشكيلتي + المقارنة + توقعات عدة جولات + الكرات الثابتة
# الصقها بعد إضافة Fantasy، قبل السطر:  if __name__ == "__main__":
# ما تغيّر أي سطر سابق: تضيف أعمدة FPL جديدة (ترتيب منفذي الكرات الثابتة) وتعدّل INDEX بتعديلات صغيرة متحقق منها.
# ============================================================================
# ترتيب منفذي ركلات الجزاء / الركلات الحرة المباشرة / الركنيات حسب FPL نفسه (حقول bootstrap-static).
# إذا ما أرجعها FPL تبقى فاضية (None) والموقع يكتب أنها غير متوفرة — ما نخترع منفذين.
_OX_SP = ["penalties_order", "direct_freekicks_order", "corners_and_indirect_freekicks_order"]
_FPL_NUM += [k for k in _OX_SP if k not in _FPL_NUM]

_orig_fpl_build_ox = _fpl_build


def _fpl_build(boot, fixtures, old, fetch):
    out = _orig_fpl_build_ox(boot, fixtures, old, fetch)
    try:
        ix = {c: i for i, c in enumerate(out["cols"])}
        got = {k: sum(1 for r in out["rows"] if r[ix[k]] is not None) for k in _OX_SP if k in ix}
        out["sp_audit"] = got
        log(f"  [Fantasy] الكرات الثابتة (FPL): لاعبين لهم ترتيب مسجّل = {got}")
    except Exception as e:      # الفحص للعرض فقط؛ ما يوقف بناء الملف
        log(f"  [Fantasy] تعذر فحص حقول الكرات الثابتة: {e}")
    return out


# ---------------- الواجهة ----------------
_X_OXJS = r"""/* ===== Optimal Starting XI · My XI builder · My XI vs Optimal XI · multi-gameweek forecast =====
   Extends the Fantasy page. Every number comes from the prediction model above (pmPlayer, availability-adjusted
   expected points per fixture) and the rules downloaded from FPL (pmRules). Nothing here is hardcoded. */
const OX={mode:'budget',gi:0,hz:3,src:'cur',ver:'v1',btVer:'v1',N:2000,cache:{},my:null,sel:null,pq:'',ppos:'',pteam:'',msg:'',pen:undefined,penBusy:null,bt:null,btBusy:false,fcSeq:0};
const OXCOL=['#3987e5','#d95926','#199e70'],OXDASH=['','7 4','2 3'];
const OX_LS={cur:'fpl_myxi_cur_v1',saved:'fpl_myxi_saved_v1',log:'fpl_ox_log_v1',cal:'fpl_ox_cal_v1'};
/* Lineup ranges are widened by kappa around their mean. Default 1.19: fitted on the leak-free replays of 2022-23 and 2023-24,
   validated on 2024-25 and tested once on 2025-26 (82.5% of real totals inside the 80% range; ml/RESULTS.md). Running the
   calibration in the Backtest tab refits kappa on this season's finished gameweeks and stores it on this device. */
const OX_KAPPA=1.19;
const oxKs=fm=>({1:fm.g,2:fm.d,3:fm.m,4:fm.f});
const oxYield=()=>new Promise(r=>setTimeout(r,0));
const oxLsGet=(k,def)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):def}catch(e){return def}};
const oxLsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const oxSeason=d=>{const e=(d.events||[])[0];return e&&e.dl?String(e.dl).slice(0,4):'?'};
const oxR1=v=>Math.round(v*10)/10;
const oxVerLabel=()=>(typeof PM_VERSION!=='undefined'?PM_VERSION:'v1')+(OX.ver==='v2'?' + penalty regression':'');
const oxP=v=>v==null?'N/A':Math.round(v*100)+'%';

/* ---------- inputs ---------- */
function oxReady(){
 const d=FPD;
 if(!d.rules||!d.fix.length||d.fix[0].length<9)return {err:'Projections need game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.'};
 const RU=pmRules(d);
 if(!RU||RU.club==null)return {err:'The game constraints (club limit, positions per formation) are missing from the downloaded data, so no valid lineup can be built. They come from FPL\'s game settings; press Synchronize again.'};
 pmPredictAll(d);const C=pmCtx(d);
 if(!C.gws.length)return {err:'No upcoming gameweek with fixtures was found in the data.'};
 if(RU.budget==null&&OX.mode==='budget')OX.mode='any';
 OX.gi=Math.max(0,Math.min(OX.gi,C.gws.length-1));
 return {d,C,RU,forms:pmForms(RU)};
}
const oxG=(p,gi)=>p&&p.pm&&p.pm.gws&&p.pm.gws[gi]?p.pm.gws[gi]:null;
const oxV=(p,gi)=>{const g=oxG(p,gi);return g?g.pts:null};
const oxHasPred=p=>!!(p&&p.pm&&p.pm.q!=='nodata'&&p.pm.gws&&p.pm.gws.length);
const oxPPlay=g=>g&&g.fx.length?1-g.fx.reduce((s,x)=>s*(1-x.pPlay),1):0;
function oxFdr(d,ev,tm,opp){const x=d.fix.find(y=>y[0]===ev&&((y[1]===tm&&y[2]===opp)||(y[2]===tm&&y[1]===opp)));return x?(x[1]===tm?x[3]:x[4]):null}
function oxFx(d,p,gi,long){const g=oxG(p,gi);if(!g)return '—';if(g.none)return long?'No fixture (blank)':'blank';
 return g.fx.map(x=>{const df=oxFdr(d,g.ev,p.tm,x.opp);return pmTeamS(x.opp)+(x.home?' (H)':' (A)')+(long&&df!=null?' · FDR '+df:'')}).join(' + ')}
/* share of the last 6 team matches the player started (FPL history "st" column) */
function oxStarts(d,p){const ix=btIx(d);if(ix.st===undefined)return null;const rows=((d.hist||{})[String(p.id)]||[]).slice().sort((a,b)=>a[0]-b[0]).slice(-6);
 if(!rows.length)return null;const v=rows.map(r=>r[ix.st]).filter(fpOk);return v.length?{k:v.filter(x=>x>0).length,n:v.length}:null}

/* ---------- optimizer: starting XI only (no bench, no budget) ----------
   Exact: maximise Σ expected points + captain's points (captain scores double) over every legal formation,
   with at most "club" players per club. Best-first branch and bound: the relaxation (top k per position,
   ignoring the club limit) is an upper bound; a node over the limit branches by banning one player of the
   offending club (any valid XI omits at least one of them), so the first valid node taken is optimal. */
function oxSolveXI(items,RU,forms){
 const byT={1:[],2:[],3:[],4:[]};items.forEach(i=>{if(byT[i.t])byT[i.t].push(i)});for(const t of [1,2,3,4])byT[t].sort((a,b)=>b.v-a.v||a.id-b.id);
 const all=[];let proven=true;
 for(const fm of forms){const ks=oxKs(fm);
  const relax=bans=>{const xi=[];for(const t of [1,2,3,4]){let n=0;for(const i of byT[t]){if(n>=ks[t])break;if(bans.has(i.id))continue;xi.push(i);n++}if(n<ks[t])return null}
   let s=0,mx=-Infinity;xi.forEach(i=>{s+=i.v;if(i.v>mx)mx=i.v});return {xi,val:s+mx,bans}};
  const open=[],seen=new Set();let nodes=0,sol=null;
  const push=b=>{const k=[...b].sort((x,y)=>x-y).join(',');if(seen.has(k))return;seen.add(k);nodes++;const r=relax(b);if(r)open.push(r)};
  push(new Set());
  while(open.length){
   let bi=0;for(let i=1;i<open.length;i++)if(open[i].val>open[bi].val)bi=i;const n=open.splice(bi,1)[0],cnt=new Map();
   n.xi.forEach(i=>{if(!cnt.has(i.club))cnt.set(i.club,[]);cnt.get(i.club).push(i)});
   let viol=null;cnt.forEach(a=>{if(a.length>RU.club&&(!viol||a.length>viol.length))viol=a});
   if(!viol){sol=n;break}
   if(nodes>20000){proven=false;break}
   for(const it of viol){const nb=new Set(n.bans);nb.add(it.id);push(nb)}
  }
  if(sol)all.push({form:fm,team:oxTeam(sol.xi,fm),nodes});
 }
 all.sort((a,b)=>b.team.total-a.team.total||a.team.cost-b.team.cost);
 return {all,best:all[0]||null,proven};
}
/* captain = highest expected starter, vice = second (ties: lower FPL id, so the result is reproducible) */
function oxTeam(xi,form){
 const ord=[...xi].sort((x,y)=>y.v-x.v||x.id-y.id),cap=ord[0]||null,vice=ord[1]||null,s=xi.reduce((a,i)=>a+i.v,0);
 return {form,xi,cap,vice,bench:[],xiPts:s,total:s+(cap?cap.v:0),cost:xi.reduce((a,i)=>a+i.c,0)};
}
/* the model's XI for gameweek index gi. mode 'any' = best XI at any price; 'budget' = XI of the best squad of 15 within the FPL budget
   (existing exact squad optimizer, bench valued only as a tie-break). Cached per data version, model version, mode and gameweek. */
function oxOptimal(X,gi,mode){
 const key=[X.d.generated,OX.ver,mode,gi].join('|');if(!OX.cache[key])OX.cache[key]=oxOptimal0(X,gi,mode);return OX.cache[key];
}
async function oxOptimal0(X,gi,mode){
 const {d,RU,forms}=X,pool=pmPoolOf(d,p=>{const g=oxG(p,gi);return g?g.pts:null});let res;
 if(mode==='budget'){await oxYield();const m=pmMode1(pool,RU,forms);
  if(!m.best)res={err:'No valid squad of '+RU.squad+' exists within the budget with the players that have projections.'};
  else{const b=m.best.team,xi=b.xi.map(i=>({...i}));const fm=b.form,t=oxTeam(xi,fm);
   t.cap=xi.find(i=>i.id===b.cap.id)||t.cap;t.vice=b.vice?xi.find(i=>i.id===b.vice.id)||t.vice:t.vice;t.total=t.xiPts+(t.cap?t.cap.v:0);
   t.bench=b.bench.map(i=>({...i}));t.squadCost=b.cost;
   res={team:t,all:m.all.map(r=>({form:r.form,team:{total:r.team.total,cost:r.team.cost}})),pool:m.poolSize,full:m.full,proven:true,mode,gi}}}
 else{const m=oxSolveXI(pool,RU,forms);res=m.best?{team:m.best.team,all:m.all,pool:pool.length,full:pool.length,proven:m.proven,mode,gi}:{err:'No legal starting XI exists with the players that have projections.'}}
 if(!res.err)res.bad=oxCheckXI(res.team.xi.map(i=>i.id),res.team.cap&&res.team.cap.id,res.team.vice&&res.team.vice.id,X);
 if(gi===0&&!res.err)oxLogRecord(X,res);return res;
}

/* ---------- validity of any XI (model or user) ---------- */
function oxFormOf(ids,d){const c={1:0,2:0,3:0,4:0};ids.forEach(id=>{const p=d.PB.get(id);if(p)c[p.ty]++});return c}
function oxCheckXI(ids,cap,vice,X){
 const {d,RU,forms}=X,bad=[],c=oxFormOf(ids,d);
 if(ids.length!==RU.play)bad.push(ids.length+' of '+RU.play+' starters selected');
 if(new Set(ids).size!==ids.length)bad.push('a player is selected twice');
 if(ids.some(id=>!d.PB.get(id)))bad.push('a selected player is no longer in the FPL data');
 if(ids.length===RU.play&&!forms.some(f=>f.g===c[1]&&f.d===c[2]&&f.m===c[3]&&f.f===c[4]))bad.push('formation '+c[1]+' GKP, '+c[2]+'-'+c[3]+'-'+c[4]+' is not legal');
 const cc=new Map();ids.forEach(id=>{const p=d.PB.get(id);if(p)cc.set(p.tm,(cc.get(p.tm)||0)+1)});cc.forEach((n,t)=>{if(n>RU.club)bad.push(n+' players from '+pmTeamS(t)+' (limit '+RU.club+')')});
 if(cap==null)bad.push('no captain chosen');else if(!ids.includes(cap))bad.push('captain is not in the XI');
 if(vice!=null&&(vice===cap||!ids.includes(vice)))bad.push('vice-captain must be a different starter');
 return bad;
}
/* cheapest legal bench that completes this XI into a squad of 15 (positions + club limit). Greedy by price; returns null if none. */
function oxCheapBench(ids,X){
 const {d,RU}=X,c=oxFormOf(ids,d),cc=new Map(),inX=new Set(ids),bench=[];
 ids.forEach(id=>{const p=d.PB.get(id);if(p)cc.set(p.tm,(cc.get(p.tm)||0)+1)});
 for(const t of [1,2,3,4]){let need=RU.T[t].sel-c[t];if(need<0)return null;
  const L=d.P.filter(p=>p.ty===t&&!inX.has(p.id)&&fpOk(p.now_cost)&&p.st!=='u'&&p.st!=='n').sort((a,b)=>a.now_cost-b.now_cost||a.id-b.id);
  for(const p of L){if(!need)break;if((cc.get(p.tm)||0)>=RU.club)continue;bench.push(p);cc.set(p.tm,(cc.get(p.tm)||0)+1);need--}
  if(need)return null}
 return {bench,cost:bench.reduce((s,p)=>s+p.now_cost,0)};
}

/* ---------- uncertainty: Monte Carlo of the same model ----------
   Each player-fixture is simulated with exactly the inputs pmPlayer used, so the simulated mean equals the expected points shown:
   plays ~ Bernoulli(P(play) incl. availability); 60+ min ~ Bernoulli(q60); goals, assists, saves, defensive actions, cards ~ Poisson;
   bonus = 2 × Poisson(rate/2) (same mean). Goals are drawn ONCE per team and fixture: the team's goals G ~ Poisson(Λ) are shared
   out to its players (multinomial, so one goal has one scorer; assists likewise) and thinned to the opponent's goals conceded, so
   team-mates' attacking returns move together and against the opposing defence. Λ is fixed per team and fixture from ALL its
   players (max of the opponent's conceded rate, the sum of the players' goal rates and the sum of their assist rates), so a player's
   own distribution does not depend on who else is simulated; Poisson thinning keeps his goals and assists exactly Poisson with
   his own rates, so the simulated mean still equals the expected points shown. The opponent's goals conceded are thinned again by each defender's share
   of the match, so his clean sheet and goals-conceded deductions follow his own minutes. */
function oxRng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
function oxBin(n,p,u){let k=0;for(let i=0;i<n;i++)if(u()<p)k++;return k}
function oxParams(p,gi,d,C){
 const m=p.pm;if(!m._ox)m._ox={};if(m._ox[gi])return m._ox[gi];
 const g=m.gws[gi];if(!g||!m.rates){m._ox[gi]=[];return []}
 const r=m.rates,t=p.ty,RL=m.rules,Rt=r.R,rr=id=>pmRule(d,id,t);
 const cards=[[Rt.yc,rr('yellow_cards').pts],[Rt.rc,rr('red_cards').pts],[Rt.og,rr('own_goals').pts],[Rt.pmi,rr('penalties_missed').pts]].concat(t===1?[[Rt.psv,rr('penalties_saved').pts]]:[]).filter(([a,b])=>a>0&&b);
 const out=g.fx.map(x=>{const So=C.S.get(x.opp),St=C.S.get(p.tm),saveF=(C.mu&&So&&St)?So.A*(x.home?C.muA:C.muH)/C.mu:1;
  const fk=g.ev+'|'+(x.home?p.tm+'|'+x.opp:x.opp+'|'+p.tm)+'|'+(x.ko||'');
  return {ak:fk+'|'+p.tm,ck:fk+'|'+x.opp,pPlay:x.pPlay,q60:r.q60,e:r.ePlay/90,e60:r.e60,lo:RL.mr.lo,hi:RL.mr.hi,
   lg:r.lamG*x.fa,la:r.lamA*x.fa,pG:RL.rG.pts,pA:RL.rA.pts,lc:x.lc,pCS:(x.lc!=null&&t<=3)?RL.rCS.pts:0,gcStep:(x.lc!=null&&t<=2)?RL.rGC.step:0,gcPts:RL.rGC.pts,
   sv:(t===1&&Rt.sv!=null)?Rt.sv*saveF:null,svStep:RL.rSV.step,svPts:RL.rSV.pts,dc:(t!==1&&Rt.dc!=null&&RL.rDC.pts)?Rt.dc:null,dcStep:RL.rDC.step,dcPts:RL.rDC.pts,
   bon:Rt.bon!=null?Rt.bon:0,bPts:RL.rB.pts,cards}});
 /* exp(-rate) of every Poisson count, computed once (null = rate 0, nothing to draw) */
 const ex=l=>l>0?Math.exp(-l):null;
 out.forEach(q=>{q.gl=q.e*q.lg;q.al=q.e*q.la;q.xG=ex(q.e*q.lg);q.xA=ex(q.e*q.la);q.xS=q.sv!=null?ex(q.sv*q.e):null;q.xD=q.dc!=null?ex(q.dc*q.e):null;q.xB=q.bon>0?ex(q.e*q.bon/2):null;q.xC=q.cards.map(([a,b])=>[ex(a*q.e),b]).filter(c=>c[0]!=null);q.xL=q.lc!=null?ex(q.lc):null});
 m._ox[gi]=out;return out;
}
/* Poisson draw from a precomputed exp(-rate) (Knuth); cap = stop counting at cap (only "at least cap" matters) */
function oxPx(L,u,cap){if(L==null)return 0;let k=0,p=u();while(p>L){k++;if(cap&&k>=cap)return k;p*=u()}return k}
/* ng/na: the player's goals and assists already shared out from his team's goals (oxDrawSet); null = draw them independently */
function oxDraw(q,G,u,ng,na){
 if(!(u()<q.pPlay))return 0;
 const s60=u()<q.q60;let v=s60?q.hi:q.lo;
 if(ng!=null)v+=ng*q.pG+na*q.pA;
 else{if(q.xG!=null)v+=oxPx(q.xG,u)*q.pG;if(q.xA!=null)v+=oxPx(q.xA,u)*q.pA}
 if(G){if(q.pCS&&s60&&oxBin(G,q.e60/90,u)===0)v+=q.pCS;if(q.gcStep)v+=Math.floor(oxBin(G,q.e,u)/q.gcStep)*q.gcPts}
 else if(q.pCS&&s60&&G===0)v+=q.pCS;
 if(q.xS!=null)v+=Math.floor(oxPx(q.xS,u)/q.svStep)*q.svPts;
 if(q.xD!=null&&oxPx(q.xD,u,q.dcStep)>=q.dcStep)v+=q.dcPts;
 if(q.xB!=null)v+=2*oxPx(q.xB,u)*q.bPts;
 for(let i=0;i<q.xC.length;i++)v+=oxPx(q.xC[i][0],u)*q.xC[i][1];
 return v;
}
/* joint draw of a set of players in one gameweek. pls: [{id,fx:oxParams(...)}]. oxPlan groups their fixtures by team and match
   (computed once); oxDrawSet(plan,u) then returns one simulated score per player, in the order of pls. */
/* team scale Λ per team and fixture, from the fixtures (oxParams) of every player with a prediction */
function oxLam(fxs){
 const M=new Map(),get=k=>{let o=M.get(k);if(!o){o={sg:0,sa:0,lc:0};M.set(k,o)}return o};
 for(const fx of fxs)for(const q of fx){const a=get(q.ak);a.sg+=q.gl;a.sa+=q.al;if(q.lc!=null){const c=get(q.ck);c.lc=Math.max(c.lc,q.lc)}}
 M.forEach(o=>o.L=Math.max(o.lc,o.sg,o.sa));return M;
}
function oxPlan(pls,lam){
 const F=[],grp=new Map(),get=k=>{let g=grp.get(k);if(!g){g={k,sc:[],as:[],lc:null,L:0,xL:null,G:0,c:0};grp.set(k,g)}return g};
 pls.forEach((pl,j)=>pl.fx.forEach(q=>{const i=F.length;F.push({j,q,ng:0,na:0,g:null});const a=get(q.ak);
  if(q.gl>0)a.sc.push([i,q.gl]);if(q.al>0)a.as.push([i,q.al]);
  if(q.lc!=null){const c=get(q.ck);c.lc=c.lc==null?q.lc:Math.max(c.lc,q.lc);F[i].g=c}}));
 const G=[...grp.values()];G.forEach(g=>{const sg=g.sc.reduce((x,y)=>x+y[1],0),sa=g.as.reduce((x,y)=>x+y[1],0);const T=lam&&lam.get(g.k);g.L=Math.max(T?T.L:0,g.lc||0,sg,sa);
  g.xL=g.L>0?Math.exp(-g.L):null;const sh=L=>L.map(([i,r])=>[i,r/g.L]);g.sc=sh(g.sc);g.as=sh(g.as);g.pc=g.lc!=null&&g.L>0?Math.min(1,g.lc/g.L):0});
 return {n:pls.length,F,G};
}
/* multinomial share-out of n goals over members [[index,share]] (shares sum to at most 1; the rest is "nobody in the set") */
function oxShare(n,M,F,f,u){let rem=n,mass=1;for(const [i,p] of M){if(!rem){F[i][f]=0;continue}const pr=mass>p?p/mass:1,k=pr>=1?rem:oxBin(rem,pr,u);F[i][f]=k;rem-=k;mass-=p}}
function oxDrawSet(P,u){
 for(const g of P.G){const n=g.xL==null?0:oxPx(g.xL,u);g.G=n;g.c=g.pc>0&&n?(g.pc>=1?n:oxBin(n,g.pc,u)):0;oxShare(n,g.sc,P.F,'ng',u);oxShare(n,g.as,P.F,'na',u)}
 const pts=new Float64Array(P.n);for(const f of P.F)pts[f.j]+=oxDraw(f.q,f.g?f.g.c:null,u,f.ng,f.na);return pts;
}
/* lineups: [{per:[{ids,cap}|null per gameweek of gis]}]. Common random numbers: each player's and each team's draws are shared by all lineups. */
function oxSim(d,C,lineups,gis,N,seed){
 const u=oxRng(seed),out=lineups.map(()=>({gw:gis.map(()=>new Float64Array(N)),tot:new Float64Array(N),ok:true}));
 lineups.forEach((L,j)=>{if(L.per.some(e=>!e))out[j].ok=false});
 const plan=gis.map((gi,k)=>{const s=new Set();lineups.forEach(L=>{const e=L.per[k];if(e)e.ids.forEach(id=>s.add(id))});const ids=[...s],ix=new Map(ids.map((id,i)=>[id,i]));
  const lam=oxLam(d.P.filter(oxHasPred).map(p=>oxParams(p,gi,d,C)));
  return {ix,P:oxPlan(ids.map(id=>({id,fx:oxParams(d.PB.get(id),gi,d,C)})),lam)}});
 for(let s=0;s<N;s++)for(let k=0;k<gis.length;k++){
  const {ix,P}=plan[k],pts=oxDrawSet(P,u);
  lineups.forEach((L,j)=>{const e=L.per[k];if(!e)return;let v=0;for(const id of e.ids)v+=pts[ix.get(id)];if(e.cap!=null&&e.ids.includes(e.cap))v+=pts[ix.get(e.cap)];out[j].gw[k][s]=v;out[j].tot[s]+=v});
 }
 return out;
}
function oxK(){const c=oxLsGet(OX_LS.cal,null);return c&&FPD&&c.season===oxSeason(FPD)&&fpOk(c.kappa)?Math.min(2,Math.max(1,c.kappa)):OX_KAPPA}
function oxWiden(a,k){let m=0;for(const v of a)m+=v;m/=a.length;return k===1?a:a.map(v=>m+k*(v-m))}
/* lineup-level quantiles and differences, with the calibrated widening */
const oxQs=a=>oxQ(oxWiden(a,oxK()));
function oxDiffS(a,b){const n=a.length,dd=new Float64Array(n);for(let i=0;i<n;i++)dd[i]=a[i]-b[i];const w=oxWiden(dd,oxK());let p=0,t=0;for(const v of w){if(v>1e-9)p++;else if(Math.abs(v)<=1e-9)t++}return Object.assign(oxQ(w),{pWin:p/n,pTie:t/n})}
function oxQ(a){const s=Float64Array.from(a).sort(),q=x=>s[Math.min(s.length-1,Math.max(0,Math.round(x*(s.length-1))))];let m=0;for(const v of a)m+=v;return {mean:m/a.length,p10:q(.1),p50:q(.5),p90:q(.9)}}
function oxDiff(a,b){const n=a.length,dd=new Float64Array(n);let w=0,t=0;for(let i=0;i<n;i++){dd[i]=a[i]-b[i];if(dd[i]>1e-9)w++;else if(Math.abs(dd[i])<=1e-9)t++}return Object.assign(oxQ(dd),{pWin:w/n,pTie:t/n})}
/* analytic expectation of a lineup in gameweek gi (the number shown everywhere; the simulation only supplies the range) */
function oxExp(d,ids,cap,gi){let s=0;for(const id of ids)s+=oxV(d.PB.get(id),gi)||0;if(cap!=null&&ids.includes(cap))s+=oxV(d.PB.get(cap),gi)||0;return s}

/* ---------- set pieces: verified evidence from PitchAPI shots (Premier League) + FPL's own taker order ---------- */
const oxNz=s=>fpNz(s);
function oxPLClubOverlap(names){const u=[...new Set(names)];return FPD.teams.filter(t=>u.some(n=>fpTeamEq(t.n,n))).length}
function oxTeamOf(name){const t=FPD.teams.filter(x=>fpTeamEq(x.n,name));return t.length===1?t[0].id:null}
/* FPL player for a PitchAPI name + club: unique match only (same rules as the PitchAPI link of the Table tab), else null */
function oxMatchName(name,tm){
 const P=FPD.P,n=oxNz(name),tk=n.split(' '),last=tk[tk.length-1],fi=n.charAt(0);
 const pick=(L)=>{const ex=L.filter(p=>oxNz(p.fn+' '+p.sn)===n||oxNz(p.name)===n);if(ex.length===1)return ex[0];
  const c2=L.filter(p=>{const sn=oxNz(p.sn).split(' ').pop(),wl=oxNz(p.name).split(' ').pop();return last===sn||last===wl});if(c2.length===1)return c2[0];
  if(c2.length>1){const c3=c2.filter(p=>oxNz(p.fn).charAt(0)===fi);if(c3.length===1)return c3[0]}return null};
 const inClub=tm!=null?pick(P.filter(p=>p.tm===tm)):null;if(inClub)return inClub;
 const ex=P.filter(p=>oxNz(p.fn+' '+p.sn)===n);return ex.length===1?ex[0]:null;   /* moved club: exact full name, unique in the whole game */
}
async function oxPenLoad(){
 if(OX.pen!==undefined)return OX.pen;if(OX.penBusy)return OX.penBusy;
 OX.penBusy=(async()=>{
  try{
   const L=(ALL.leagues||[]).filter(l=>/premier league/i.test(l.name)&&l.sh_file&&l.file);let best=null;
   for(const l of L){const r=await fetch('data/'+l.sh_file+'?v='+encodeURIComponent(l.sh_v||ALL.generated||''));if(!r.ok)continue;const sh=await r.json();
    const ix={};sh.cols.forEach((c,i)=>ix[c]=i);if(ix.st===undefined||ix.c===undefined)continue;
    const ov=oxPLClubOverlap(sh.rows.map(x=>x[ix.c]));if(ov>=15&&(!best||ov>best.ov))best={l,sh,ix,ov}}
   if(!best)return OX.pen={ok:false,why:'No PitchAPI Premier League shot file whose clubs match the FPL teams was found.'};
   const lr=await fetch('data/'+best.l.file+'?v='+encodeURIComponent(ALL.generated||''));if(!lr.ok)return OX.pen={ok:false,why:'Premier League match file missing (HTTP '+lr.status+').'};
   const lg=await lr.json(),round=new Map();let unm=0;
   for(const m of lg.matches||[]){const h=oxTeamOf(m.h),a=oxTeamOf(m.a);const x=h&&a?FPD.fix.filter(y=>y[1]===h&&y[2]===a):[];if(x.length===1)round.set(m.i,{r:x[0][0],h,a});else unm++}
   const {sh,ix}=best,cache=new Map(),idOf=(nm,tm)=>{const k=nm+'|'+tm;if(!cache.has(k)){const p=nm?oxMatchName(nm,tm):null;cache.set(k,p?p.id:null)}return cache.get(k)};
   const shots=[],nameMiss=new Set();
   for(const x of sh.rows){const st=x[ix.st];if(st!=='Penalty'&&st!=='FreeKick'&&st!=='FromCorner'&&st!=='SetPiece')continue;if(ix.og!==undefined&&x[ix.og])continue;
    /* kid/kn in this file is the goalkeeper facing the shot, not the passer, so shots say nothing about who took a corner */
    const mr=round.get(x[ix.m]);const tm=oxTeamOf(x[ix.c]);const fid=idOf(x[ix.pn],tm);
    if(fid==null&&st==='Penalty')nameMiss.add(x[ix.pn]+' ('+x[ix.c]+')');
    shots.push({r:mr?mr.r:null,m:x[ix.m],st,tm,fid,pn:x[ix.pn],xg:fpOk(x[ix.xg])?x[ix.xg]:null,goal:x[ix.ev]==='Goal'})}
   const by=new Map(),get=id=>{if(!by.has(id))by.set(id,{pen:[],fk:[],crn:[]});return by.get(id)};
   shots.forEach(s=>{if(s.fid==null)return;if(s.st==='Penalty')get(s.fid).pen.push(s);if(s.st==='FreeKick')get(s.fid).fk.push(s);if(s.st==='FromCorner')get(s.fid).crn.push(s)});
   const pens=shots.filter(s=>s.st==='Penalty');
   return OX.pen={ok:true,league:best.l.name,lid:best.l.id,matches:(lg.matches||[]).length,mapped:round.size,unmapped:unm,round,shots,pens,by,penUnlinked:[...nameMiss],
    penLinked:pens.filter(s=>s.fid!=null).length};
  }catch(e){return OX.pen={ok:false,why:'Could not read PitchAPI shot data: '+e.message}}
  finally{OX.penBusy=null}
 })();
 return OX.penBusy;
}
/* team-level penalty facts before round r (r = null: everything) */
function oxPenTeam(tm,r){const P=OX.pen;if(!P||!P.ok)return null;const L=P.pens.filter(s=>s.tm===tm&&(r==null||(s.r!=null&&s.r<r)));return L}
function oxSPText(p){
 const out=[],P=OX.pen,o=(k,l)=>{const v=p[k];if(fpOk(v))out.push(l+' #'+v+' (FPL)')};
 o('penalties_order','Penalties');o('direct_freekicks_order','Direct FKs');o('corners_and_indirect_freekicks_order','Corners/indirect FKs');
 if(P&&P.ok){const e=P.by.get(p.id);if(e){
  if(e.pen.length){const tp=oxPenTeam(p.tm,null).length,mine=e.pen.filter(s=>s.tm===p.tm).length;out.push('took '+e.pen.length+' penalt'+(e.pen.length>1?'ies':'y')+' ('+e.pen.filter(s=>s.goal).length+' scored)'+(tp?'; '+mine+' of '+tp+' '+pmTeamS(p.tm)+' penalties':''))}
  if(e.fk.length)out.push(e.fk.length+' direct free-kick shot'+(e.fk.length>1?'s':''));
}}
 return out;
}

/* ---------- model v2: penalty regression (optional; v1 stays the default) ----------
   FPL xG includes penalty xG, so a player who happened to take penalties carries his realised penalty xG as if it were a rate.
   v2 removes his observed penalty xG/goals (PitchAPI shots, situation "Penalty") and adds back the expected penalty xG of his
   minutes: league penalties per team-match × his observed share of his club's penalties × mean penalty xG.
   Only shots from rounds before the round being predicted are used, so the backtest stays leak-free. */
function oxPenAdj(p,r){
 const P=OX.pen;if(!P||!P.ok||(FPD&&FPD.archive)||!fpOk(p.expected_goals)||!fpOk(p.goals_scored)||!(p.minutes>0))return p;
 const e=P.by.get(p.id);if(!e)return p;const mine=e.pen.filter(s=>s.r!=null&&s.r<r);if(!mine.length)return p;
 const all=P.pens.filter(s=>s.r!=null&&s.r<r),nm=[...P.round.values()].filter(x=>x.r<r).length;if(!nm||!all.length)return p;
 const lam=all.length/(2*nm),xgs=all.map(s=>s.xg).filter(fpOk),xpen=xgs.length?xgs.reduce((a,b)=>a+b,0)/xgs.length:null;if(xpen==null)return p;
 const club=all.filter(s=>s.tm===p.tm),share=club.length?club.filter(s=>s.fid===p.id).length/club.length:0;
 const obsX=mine.reduce((a,s)=>a+(s.xg||0),0),obsG=mine.filter(s=>s.goal).length,E=p.minutes/90*lam*share*xpen;
 return Object.assign({},p,{expected_goals:Math.max(0,p.expected_goals-obsX)+E,goals_scored:Math.max(0,p.goals_scored-obsG)+E,_pen:{obsX,obsG,E,share,lam}});
}
const oxPmPlayer0=pmPlayer;
pmPlayer=function(p,C,dd){const v=dd===FPD?OX.ver:OX.btVer;return oxPmPlayer0(v==='v2'?oxPenAdj(p,C.next):p,C,dd)};
async function oxSetVer(v){
 if(v==='v2'){const P=await oxPenLoad();if(!P||!P.ok){OX.msg='Penalty regression needs PitchAPI Premier League shot data: '+((P&&P.why)||'not available');v='v1'}}
 OX.ver=v;FPD._pmPred=null;FPD.P.forEach(p=>{p.pm=null});FPBEST={};OX.cache={};fpRender();
}

/* ---------- explanations ---------- */
const OX_CL={app:'Minutes',goal:'Goals',ast:'Assists',cs:'Clean sheet',gc:'Goals conc.',sv:'Saves',dc:'Def. contr.',bon:'Bonus',card:'Cards/other'};
const OX_COMP=Object.keys(OX_CL);
function oxCS(p,gi){const g=oxG(p,gi);if(!g||p.ty>3)return null;const r=p.pm.rates;let any=false,pn=1;
 g.fx.forEach(x=>{if(x.lc==null)return;any=true;pn*=1-x.pPlay*r.q60*Math.exp(-x.lc*r.e60/90)});return any?1-pn:null}
function oxReason(d,C,p,gi){
 const g=oxG(p,gi);if(!g)return '';if(g.none)return 'No fixture this gameweek (blank): 0 expected.';
 const top=OX_COMP.map(k=>[k,g.parts[k]||0]).filter(x=>x[1]>0.05).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>OX_CL[k]+' '+v.toFixed(1));
 const s=[top.join(' · ')],x=g.fx[0],So=x?C.S.get(x.opp):null,r=p.pm.rates;
 if(g.fx.length>1)s.push('double gameweek ('+g.fx.length+' fixtures)');
 if(So&&C.mu){if(p.ty>=3&&So.xga!=null&&So.D>1.08)s.push(pmTeamS(x.opp)+' concede '+So.xga.toFixed(2)+' xG/match (avg '+C.mu.toFixed(2)+')');
  if(p.ty<=2&&So.xgf!=null&&So.A<0.92)s.push(pmTeamS(x.opp)+' create only '+So.xgf.toFixed(2)+' xG/match')}
 const cs=oxCS(p,gi);if(cs!=null&&p.ty<=2)s.push('clean-sheet chance '+oxP(cs));
 if(r&&r.xg90!=null&&C.pri[p.ty].xg!=null&&r.xg90>C.pri[p.ty].xg*1.5&&p.ty>=2)s.push('xG/90 '+r.xg90.toFixed(2)+' vs '+C.pri[p.ty].xg.toFixed(2)+' for the position');
 const sp=oxSPText(p).filter(t=>/penalt|Penalties/.test(t));if(sp.length)s.push(sp[0]);
 if(p.st!=='a')s.push('availability: '+pmStLabel(p));
 return s.filter(Boolean).join('; ');
}
function oxPartsRow(g){return OX_COMP.map(k=>(g.parts[k]||0))}

/* ---------- prediction log (this device): what the model recommended, and what those players then scored ---------- */
function oxLogRecord(X,res){
 const {d,C}=X,t=res.team,lg=oxLsGet(OX_LS.log,[]),gw=C.gws[0];
 if(lg.some(e=>e.gw===gw&&e.gen===d.generated&&e.ver===OX.ver&&e.mode===res.mode))return;
 lg.push({gw,gen:d.generated,ver:oxVerLabel(),mode:res.mode,at:new Date().toISOString().slice(0,16).replace('T',' ')+' UTC',ids:t.xi.map(i=>i.id),cap:t.cap?t.cap.id:null,total:+t.total.toFixed(2),form:t.form.name,season:oxSeason(d)});
 while(lg.length>60)lg.shift();oxLsSet(OX_LS.log,lg);
}
function oxActual(d,id,r){const ix=btIx(d);let s=null;((d.hist||{})[String(id)]||[]).forEach(h=>{if(h[0]===r&&fpOk(h[ix.pts]))s=(s||0)+h[ix.pts]});return s}
function oxLogHtml(d){
 const lg=oxLsGet(OX_LS.log,[]).filter(e=>e.season===oxSeason(d));if(!lg.length)return '';
 const fin=new Set(d.events.filter(e=>e.fin).map(e=>e.id)),rows=[...lg].reverse().slice(0,15).map(e=>{let act=null;
  if(fin.has(e.gw)){act=0;for(const id of e.ids){const a=oxActual(d,id,e.gw);act+=a||0}if(e.cap!=null)act+=oxActual(d,e.cap,e.gw)||0}
  return ['GW'+e.gw,esc(e.at),esc(e.gen),esc(e.ver),e.mode==='budget'?'budget':'any price',esc(e.form),e.total.toFixed(1),act==null?'<span class="mu">not played yet</span>':act.toFixed(0)]});
 return `<details class="card" style="font-size:12px"><summary class="mu"><b>Prediction log (kept on this device)</b> — ${lg.length} recorded recommendation${lg.length>1?'s':''}</summary><div class="mu" style="margin:6px 0">Each time an optimal XI for the next gameweek is computed with new data, it is recorded here with its time, data version and model version. After the gameweek finishes, "actual" adds the real points of those 11 players plus the captain's (no automatic substitutions). The leak-free Backtest tab is the systematic test.</div>${tbl([['GW'],['Recorded'],['Data version'],['Model'],['Constraint'],['Formation'],['Predicted',1],['Actual',1]],rows)}</details>`;
}

/* ---------- shared UI pieces ---------- */
function oxCtl(X,o){
 const {C,RU}=X,gw=o.gw!==false?`<select onchange="OX.gi=+this.value;fpRender()">${fpOpts(C.gws.map((g,i)=>[String(i),'GW'+g+(i===0?' (next)':'')]),String(OX.gi))}</select>`:'';
 const md=o.mode!==false?`<select onchange="OX.mode=this.value;fpRender()">${fpOpts([['budget','Fits a '+(RU.budget!=null?pmMoney(RU.budget):'')+' squad of '+RU.squad],['any','Any price (best possible XI)']].filter(x=>x[0]!=='budget'||RU.budget!=null),OX.mode)}</select>`:'';
 const v2=OX.pen&&OX.pen.ok;
 const vr=`<select onchange="oxSetVer(this.value)" title="Prediction model">${fpOpts([['v1','Model '+PM_VERSION+' (default)'],...(v2||OX.ver==='v2'?[['v2','Model '+PM_VERSION+' + penalty regression']]:[])],OX.ver)}</select>`;
 return `<div class="ctl">${gw}${md}${o.extra||''}${vr}</div>`+(OX.msg?`<div class="card" style="color:var(--a);font-size:13px">${esc(OX.msg)}</div>`:'');
}
function oxHead(X,gi,txt){
 const {d,C}=X,e=d.events.find(x=>x.id===C.gws[gi]),dl=e&&e.dl?new Date(e.dl):null;
 return `<div class="mu" style="font-size:12px;margin:-4px 0 8px">GW${C.gws[gi]}${dl?' · deadline '+esc(dl.toUTCString().slice(0,22))+' UTC':''} · data ${esc(d.generated)} UTC · model ${esc(oxVerLabel())} · ${txt||'all points are projections (expected values), not guarantees'}</div>`;
}
const oxNm=(d,id)=>{const p=d.PB.get(id);return p?`<a href="javascript:void(0)" onclick="fpPredPick(${id})">${esc(p.name)}</a>`:'?'};
const oxRange=s=>s?`${s.p10.toFixed(0)}–${s.p90.toFixed(0)}`:'N/A';
const oxTbl=(h,rows,empty)=>rows.length?tbl(h,rows):`<div class="mu" style="font-size:13px">${empty}</div>`;

/* PitchAPI set-piece evidence is read once, before the first draw (it decides whether model v2 can be offered), so nothing redraws later */
function oxWaitPen(el,tab,fn){if(OX.pen!==undefined)return false;el.innerHTML='<div class="empty">Loading…</div>';oxPenLoad().then(()=>{if(FP.tab===tab&&$('#fpbody'))fn($('#fpbody'))});return true}
/* ---------- tab: Optimal XI ---------- */
function oxTXI(el){
 if(oxWaitPen(el,'xi',oxTXI))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">Optimal Starting XI — Next Gameweek</h3>`+oxCtl(X,{})+oxHead(X,OX.gi)+`<div id="oxout"><div class="empty">Optimizing every legal formation${OX.mode==='budget'?' within the budget (a few seconds)':''}…</div></div><div id="pdet"></div>`;
 const gi=OX.gi,mode=OX.mode,seq=++OX.fcSeq;
 setTimeout(async()=>{const res=await oxOptimal(X,gi,mode);if(seq!==OX.fcSeq||!$('#oxout'))return;oxDrawXI(X,res,gi)},20);
}
function oxDrawXI(X,res,gi){
 const {d,C,RU,forms}=X,out=$('#oxout');if(!out)return;
 if(res.err){out.innerHTML=`<div class="empty">${esc(res.err)}</div>`;return}
 const t=res.team,ids=t.xi.map(i=>i.id),cap=d.PB.get(t.cap.id),vc=t.vice?d.PB.get(t.vice.id):null,g=C.gws[gi];
 const sim=oxSim(d,C,[{per:[{ids,cap:t.cap.id}]}],[gi],OX.N,7001)[0],st=oxQs(sim.tot);
 const capPlay=oxPPlay(oxG(cap,gi)),viceX=vc?(1-capPlay)*oxV(vc,gi):0;
 const second=res.all[1],omit=[];
 const sel=new Set(ids),byT={1:[],2:[],3:[],4:[]};t.xi.forEach(i=>byT[i.t].push(i));
 const minT=tt=>Math.min(...byT[tt].map(i=>i.v)),cc=new Map();t.xi.forEach(i=>cc.set(i.club,(cc.get(i.club)||0)+1));
 d.P.filter(p=>oxHasPred(p)&&!sel.has(p.id)&&p.st!=='u'&&p.st!=='n').map(p=>({p,v:oxV(p,gi)})).filter(o=>o.v!=null).sort((a,b)=>b.v-a.v).slice(0,40).forEach(o=>{
  const p=o.p,tt=p.ty;if(omit.length>=6)return;let why=null;
  if(byT[tt].length&&o.v>minT(tt)+1e-9){if((cc.get(p.tm)||0)>=RU.club)why='club limit: '+pmTeamS(p.tm)+' already has '+RU.club+' in the XI';else if(res.mode==='budget')why='budget: the squad cannot afford him together with the rest';else why='tie-break'}
  else if(!byT[tt].length||o.v>Math.min(...t.xi.map(i=>i.v))+1e-9)why='formation: '+t.form.name+' uses '+byT[tt].length+' '+FPPOS[tt]+(byT[tt].length>=RU.T[tt].mx?' (the maximum)':'')+'; his '+o.v.toFixed(1)+' beats the lowest starter elsewhere, but adding a '+FPPOS[tt]+' costs more at another position';
  if(why)omit.push([oxNm(d,p.id),esc(p.tn),FPPOS[tt],o.v.toFixed(2),esc(why)])});
 const ord=[...t.xi].sort((a,b)=>a.t-b.t||b.v-a.v);
 const rows=ord.map(i=>{const p=d.PB.get(i.id),gg=oxG(p,gi),stt=oxStarts(d,p),pr=oxPartsRow(gg),sum=pr.reduce((a,b)=>a+b,0);
  return [FPPOS[p.ty],oxNm(d,p.id)+(t.cap===i?' <b style="color:var(--a)">(C)</b>':t.vice===i?' <span class="mu">(V)</span>':''),esc(p.tn),f(p.price,1),esc(oxFx(d,p,gi,true)),Math.round(gg.eMin),oxP(oxPPlay(gg)),stt?stt.k+'/'+stt.n:'N/A',`<span style="color:${pmQCol[p.pm.q]}">${pmQLab[p.pm.q]}</span>`,esc(oxSPText(p).join('; ')||'—'),...pr.map(v=>v.toFixed(2)),`<b>${sum.toFixed(2)}</b>`,`<span style="white-space:normal;display:inline-block;min-width:260px">${esc(oxReason(d,C,p,gi))}</span>`]});
 const used=OX_COMP;
 const fmRows=res.all.map((r,k)=>[r.form.name,r.team.total.toFixed(2),pmMoney(r.team.cost),k===0?'<span class="tag ok">chosen</span>':(r.team.total-res.all[0].team.total).toFixed(2)]);
 const bad=res.bad||[];
 const bench=t.bench&&t.bench.length?`<div class="mu" style="font-size:12px;margin:6px 0">Budget check: this XI is the starting XI of the best ${RU.squad}-player squad within ${pmMoney(RU.budget)} (squad cost ${pmMoney(t.squadCost)}). The 4 bench players are chosen by the squad optimizer only to make the squad legal and affordable: ${t.bench.map(i=>esc(d.PB.get(i.id).name)+' '+pmMoney(i.c)).join(', ')}. Full squad and bench order: Best Team tab.</div>`:`<div class="mu" style="font-size:12px;margin:6px 0">Any-price mode: the best possible starting XI regardless of price (XI cost ${pmMoney(t.cost)}${RU.budget!=null?'; an FPL squad of '+RU.squad+' must cost at most '+pmMoney(RU.budget):''}). Bench and budget are not part of this answer.</div>`;
 const sumParts=ord.reduce((s,i)=>s+oxPartsRow(oxG(d.PB.get(i.id),gi)).reduce((a,b)=>a+b,0),0);
 out.innerHTML=`<div class="grid"><div class="kpi"><b>${t.form.name}</b><span>Formation</span></div><div class="kpi"><b style="color:var(--g)">${t.total.toFixed(1)}</b><span>Expected points, XI incl. captain, GW${g}</span></div><div class="kpi"><b>${oxRange(st)}</b><span>80% range (10th–90th percentile, simulated)</span></div><div class="kpi"><b>${pmMoney(t.cost)}</b><span>XI cost${t.squadCost?' · squad '+pmMoney(t.squadCost):''}</span></div><div class="kpi"><b style="font-size:16px">${esc(cap.name)} (C)</b><span>Captain · vice ${vc?esc(vc.name):'—'}</span></div></div>
 ${pmPitchHtml(t,d,i=>i.v.toFixed(1),i=>{const p=d.PB.get(i.id);return oxFx(d,p,gi,false)})}
 <div class="card" style="font-size:13px"><b>Key selection decisions</b><ul style="margin:6px 0 0 18px;padding:0">
 <li>Formation <b>${t.form.name}</b>: its best legal XI has the highest expected total${second?`; the next best formation, ${esc(second.form.name)}, is ${(t.total-second.team.total).toFixed(2)} points lower`:''}.</li>
 <li>Captain <b>${esc(cap.name)}</b> has the highest expected points of the XI (${oxV(cap,gi).toFixed(2)}, doubled); P(plays) ${oxP(capPlay)}. Vice-captain ${vc?'<b>'+esc(vc.name)+'</b> takes the armband only if the captain does not play (expected extra '+viceX.toFixed(2)+', not included in the total)':'—'}.</li>
 ${omit.length?'<li>Highest-projected players left out, and why: see the table below.</li>':''}
 ${t.xi.filter(i=>d.PB.get(i.id).st!=='a').map(i=>{const p=d.PB.get(i.id);return `<li style="color:var(--a)">${esc(p.name)}: ${esc(pmStLabel(p))}${p.nw?' — '+esc(p.nw):''}; expected ${i.v.toFixed(2)} vs ${oxG(p,gi).fit.toFixed(2)} if fully fit.</li>`}).join('')}
 </ul></div>${bench}
 <div class="card" style="font-size:12px">${bad.length?'<span style="color:var(--r)">✗ '+bad.map(esc).join('; ')+'</span>':`<span style="color:var(--g)">✓ ${t.xi.length} unique players · legal formation ${t.form.name} · at most ${Math.max(...cc.values())} per club (limit ${RU.club}) · captain and vice are starters</span>`}${res.proven===false?' <span style="color:var(--a)">· search limit reached: optimality not proven</span>':''}</div>
 <h3>Why each player (GW${g}; components add up to the player total)</h3>${tbl([['Pos'],['Player'],['Club'],['£m',1],['Fixture'],['Exp. min',1],['P(play)',1],['Started (last 6)',1],['Data'],['Set pieces'],...used.map(k=>[OX_CL[k],1]),['Total',1],['Main reasons']],rows)}
 <div class="mu" style="font-size:12px;margin:6px 0">Sum of the 11 player totals ${sumParts.toFixed(2)} + captain ${oxV(cap,gi).toFixed(2)} = ${(sumParts+oxV(cap,gi)).toFixed(2)} (shown rounded as ${t.total.toFixed(1)}). Component values are FPL scoring inputs (expected points per category); xG, xA, team xG and opponent strength are only the predictive signals behind them and earn no points by themselves. Tap a name for the full prediction details.</div>
 ${omit.length?`<h3>Notable players left out</h3>${oxTbl([['Player'],['Club'],['Pos'],['Expected',1],['Why not selected']],omit,'')}`:''}
 <h3>Formation comparison (exact optimum for each)</h3>${tbl([['Formation'],['Expected XI + captain',1],[res.mode==='budget'?'Squad cost':'XI cost',1],['']],fmRows)}
 ${oxLogHtml(d)}
 <details class="card" style="font-size:12px"><summary class="mu"><b>How the optimal XI and its range are calculated</b></summary>
 <p>Player values are the availability-adjusted expected points of the Predicted Points model for GW${g} (a double gameweek adds both fixtures; a blank gameweek is 0). ${res.mode==='budget'?`The XI comes from the exact squad optimizer of the Best Team tab (dynamic programming over the budget with branch and bound for the club limit, ${res.pool} of ${res.full} players after a lossless dominance prune): it maximises the XI's expected points plus the captain's, subject to a legal ${RU.squad}-player squad within the budget.`:`Every legal formation (${forms.map(x=>x.name).join(', ')}, from FPL's game settings) is solved exactly by branch and bound: maximise the XI's expected points plus the captain's, at most ${RU.club} players per club; ${res.pool} players with a projection are considered.`} Players marked unavailable or not in a squad are excluded.</p>
 <p>The 80% range comes from ${OX.N.toLocaleString()} simulations of the same model (fixed seed, so it does not change between visits): minutes, goals, assists, saves, defensive actions, bonus and cards are drawn per player; goals against are drawn once per team and fixture, so team-mates' clean sheets move together. Each team's goals are drawn once per match and shared out to its scorers and assisters, so team-mates' attacking returns move together and against the opposing defence. In the leak-free replay these lineup ranges came out too narrow, so they are widened by a factor of ${oxK().toFixed(2)} around the expected total (${oxK()===OX_KAPPA?'default fitted on the 2022-23 and 2023-24 seasons, validated on 2024-25 and tested on 2025-26':'refitted on this device in the Backtest tab'}); the Backtest tab shows the current check. Projections of the very top players have been optimistic (a selection effect: the highest projections include the largest over-estimates), so read the XI total as an upper-leaning estimate${(()=>{const c=oxLsGet(OX_LS.cal,null);return c&&c.season===oxSeason(FPD)&&c.top11?`: in the replay the 11 highest-projected players per gameweek averaged ${c.top11.pred.toFixed(2)} projected vs ${c.top11.act.toFixed(2)} actual points`:''})()}.</p>
 <p>Set pieces: FPL taker order (when the data has it) and PitchAPI shot evidence (penalties taken and scored, direct free-kick shots) are shown for information. PitchAPI shots do not record who took a corner or a free-kick cross, so corner duty is only known from FPL's own taker order. The base model counts penalty xG inside FPL xG; the penalty-regression option regresses each taker's realised penalty xG toward the league penalty rate (see Backtest).${OX.pen&&OX.pen.ok?` PitchAPI evidence: ${OX.pen.pens.length} penalties in ${OX.pen.matches} ${esc(OX.pen.league)} matches, ${OX.pen.penLinked} linked to an FPL player by club and name${OX.pen.penUnlinked.length?'; not linked: '+OX.pen.penUnlinked.map(esc).join(', '):''}.`:OX.pen&&!OX.pen.ok?' PitchAPI set-piece evidence unavailable: '+esc(OX.pen.why):''}${FPD.cols.includes('penalties_order')?'':' FPL taker order is not in the downloaded data yet; it is added at the next synchronization.'}</p></details>`;
}

/* ---------- My XI (builder) ---------- */
function oxMyInit(X){
 if(OX.my)return;const {d,forms}=X,s=oxLsGet(OX_LS.cur,null);
 const def={form:(forms.find(f=>f.name==='3-4-3')||forms[0]).name,ids:[],cap:null,vice:null};
 if(!s||s.season!==oxSeason(d)){OX.my=def;return}
 const ids=(s.ids||[]).filter(id=>d.PB.get(id)),lost=(s.ids||[]).length-ids.length;
 OX.my={form:forms.some(f=>f.name===s.form)?s.form:def.form,ids,cap:ids.includes(s.cap)?s.cap:null,vice:ids.includes(s.vice)?s.vice:null};
 if(lost)OX.msg=lost+' saved player(s) are no longer in the FPL data and were removed.';
}
function oxMyStore(){const d=FPD;oxLsSet(OX_LS.cur,Object.assign({season:oxSeason(d)},OX.my))}
const oxFormBy=(X,n)=>X.forms.find(f=>f.name===n)||X.forms[0];
function oxMyMsg(t){OX.msg='';const e=$('#oxmsg');if(e)e.textContent=t}
function oxMyAdd(id){
 const X=oxReady();if(X.err)return;const {d,RU}=X,p=d.PB.get(id),my=OX.my,ks=oxKs(oxFormBy(X,my.form));if(!p)return;
 if(my.ids.includes(id))return oxMyMsg(p.name+' is already in your XI.');
 const n=my.ids.filter(x=>d.PB.get(x).ty===p.ty).length;
 if(n>=ks[p.ty])return oxMyMsg('All '+ks[p.ty]+' '+FPPOS[p.ty]+' places of '+my.form+' are filled. Remove one, or pick a formation with more '+FPPOS[p.ty]+'.');
 const cl=my.ids.filter(x=>d.PB.get(x).tm===p.tm).length;if(cl>=RU.club)return oxMyMsg('You already have '+RU.club+' players from '+p.tf+' (FPL limit).');
 if(!oxHasPred(p))return oxMyMsg(p.name+' has no projection (no minutes this season), so he cannot be scored.');
 my.ids.push(id);oxMyStore();OX.sel=null;oxDrawMy(X);oxMyMsg(p.name+' added ('+my.ids.length+'/'+RU.play+').');
}
function oxMyRm(id){const my=OX.my;my.ids=my.ids.filter(x=>x!==id);if(my.cap===id)my.cap=null;if(my.vice===id)my.vice=null;OX.sel=null;oxMyStore();const X=oxReady();oxDrawMy(X)}
function oxMyRole(id,k){const my=OX.my;if(k==='cap'){if(my.vice===id)my.vice=my.cap;my.cap=id}else{if(my.cap===id)return oxMyMsg('The captain cannot also be vice-captain.');my.vice=id}OX.sel=null;oxMyStore();oxDrawMy(oxReady())}
function oxMyReplace(id){const p=FPD.PB.get(id);oxMyRm(id);OX.ppos=String(p.ty);const e=$('#oxpp');if(e)e.value=OX.ppos;oxPickDraw(oxReady());const q=$('#oxq');if(q){q.focus();q.scrollIntoView({behavior:'smooth',block:'center'})}oxMyMsg('Removed '+p.name+'. Pick a replacement '+FPPOS[p.ty]+' below.')}
function oxMyTap(id){OX.sel=OX.sel===id?null:id;oxDrawMy(oxReady())}
function oxMySlot(t){OX.ppos=String(t);const e=$('#oxpp');if(e)e.value=OX.ppos;oxPickDraw(oxReady());const q=$('#oxq');if(q)q.scrollIntoView({behavior:'smooth',block:'center'})}
function oxMyForm(n){
 const X=oxReady(),{d}=X,ks=oxKs(oxFormBy(X,n)),c=oxFormOf(OX.my.ids,d),over=[1,2,3,4].filter(t=>c[t]>ks[t]);
 if(over.length){fpRender();return oxMyMsg('Cannot switch to '+n+': remove '+over.map(t=>(c[t]-ks[t])+' '+FPPOS[t]).join(' and ')+' first.')}
 OX.my.form=n;oxMyStore();oxDrawMy(X);
}
async function oxMyFromOpt(){
 const X=oxReady();if(X.err)return;oxMyMsg('Computing the optimal XI…');const res=await oxOptimal(X,OX.gi,OX.mode);if(res.err)return oxMyMsg(res.err);
 const t=res.team;OX.my={form:t.form.name,ids:t.xi.map(i=>i.id),cap:t.cap.id,vice:t.vice?t.vice.id:null};OX.sel=null;oxMyStore();oxDrawMy(X);oxMyMsg('Loaded the model\'s optimal XI for GW'+X.C.gws[OX.gi]+'. Change any player to test your own ideas.');
}
function oxMyClear(){OX.my={form:OX.my.form,ids:[],cap:null,vice:null};OX.sel=null;oxMyStore();oxDrawMy(oxReady());oxMyMsg('Cleared.')}
function oxMySave(){
 const nm=($('#oxsn')&&$('#oxsn').value.trim())||('My XI '+new Date().toISOString().slice(0,10));const L=oxLsGet(OX_LS.saved,[]),i=L.findIndex(x=>x.name===nm);
 const e=Object.assign({name:nm,at:new Date().toISOString().slice(0,16).replace('T',' '),season:oxSeason(FPD)},JSON.parse(JSON.stringify(OX.my)));
 if(i>=0)L[i]=e;else L.push(e);while(L.length>20)L.shift();oxMyMsg(oxLsSet(OX_LS.saved,L)?'Saved "'+nm+'" on this device.':'Could not save (browser storage blocked).');oxDrawMy(oxReady());
}
function oxMyLoad(){const s=$('#oxsl');if(!s||s.value==='')return;const e=oxLsGet(OX_LS.saved,[])[+s.value];if(!e)return;const X=oxReady(),{d}=X;
 if(e.season!==oxSeason(d))return oxMyMsg('That lineup is from another season.');const ids=e.ids.filter(id=>d.PB.get(id));
 OX.my={form:e.form,ids,cap:ids.includes(e.cap)?e.cap:null,vice:ids.includes(e.vice)?e.vice:null};OX.sel=null;oxMyStore();oxDrawMy(X);oxMyMsg('Loaded "'+e.name+'"'+(ids.length<e.ids.length?' ('+(e.ids.length-ids.length)+' player(s) no longer in the data were dropped)':'')+'.')}
function oxMyDel(){const s=$('#oxsl');if(!s||s.value==='')return;const L=oxLsGet(OX_LS.saved,[]),e=L.splice(+s.value,1)[0];oxLsSet(OX_LS.saved,L);oxDrawMy(oxReady());if(e)oxMyMsg('Deleted "'+e.name+'".')}
function oxMyCard(p,i,o){
 const sel=OX.sel===p.id,badge=o.cap?'C':o.vice?'V':'';
 return `<div style="position:absolute;left:${o.x.toFixed(1)}%;top:${o.y}%;transform:translate(-50%,-50%);width:${o.w}%;min-width:60px;max-width:98px;background:rgba(13,21,32,.92);border:1.5px solid ${sel?'#e8eef5':pmStCol(p)};${sel?'box-shadow:0 0 0 2px #e8eef5;':''}border-radius:8px;padding:3px 3px 4px;font-size:11px;line-height:1.25;text-align:center;cursor:pointer" onclick="oxMyTap(${p.id})" title="${esc(pmStLabel(p)+(p.nw?' — '+p.nw:''))}">${badge?`<span style="position:absolute;top:-7px;right:-5px;background:${badge==='C'?'#e9b44c':'#8a9bb0'};color:#0d1520;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:800;line-height:17px">${badge}</span>`:''}<div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div class="mu" style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.tn)} · ${pmMoney(p.now_cost)}</div><div><b style="color:var(--g)">${o.pts}</b> <span class="mu" style="font-size:10px">${esc(o.sub)}</span></div>${p.st!=='a'?`<div style="font-size:10px;color:${pmStCol(p)}">${esc(pmStLabel(p))}</div>`:''}</div>`;
}
function oxMyPitch(X,gi){
 const {d}=X,my=OX.my,ks=oxKs(oxFormBy(X,my.form)),by={1:[],2:[],3:[],4:[]},yp={4:15,3:40,2:65,1:88};my.ids.forEach(id=>{const p=d.PB.get(id);if(p)by[p.ty].push(p)});
 let cards='';
 for(const t of [4,3,2,1]){const n=ks[t],w=Math.min(19,92/Math.max(n,1));for(let k=0;k<n;k++){const x=(k+.5)/n*100,p=by[t][k];
  if(p){const v=oxV(p,gi);cards+=oxMyCard(p,null,{x,y:yp[t],w,cap:my.cap===p.id,vice:my.vice===p.id,pts:v==null?'N/A':v.toFixed(1),sub:oxFx(d,p,gi,false)})}
  else cards+=`<div onclick="oxMySlot(${t})" style="position:absolute;left:${x.toFixed(1)}%;top:${yp[t]}%;transform:translate(-50%,-50%);width:${w}%;min-width:60px;max-width:98px;min-height:44px;border:1.5px dashed rgba(255,255,255,.6);border-radius:8px;background:rgba(13,21,32,.45);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:pointer">+ ${FPPOS[t]}</div>`}}
 const ln='position:absolute;border:1.5px solid rgba(255,255,255,.35);';
 return `<div style="position:relative;width:100%;max-width:560px;margin:8px auto;aspect-ratio:5/6;border-radius:10px;overflow:hidden;background:repeating-linear-gradient(0deg,#1d6b43 0 8.33%,#1a5f3b 8.33% 16.66%);border:2px solid rgba(255,255,255,.4)"><div style="${ln}left:0;right:0;top:50%;border-width:1.5px 0 0"></div><div style="${ln}left:35%;width:30%;top:38%;height:24%;border-radius:50%"></div><div style="${ln}left:22%;width:56%;top:0;height:16%;border-top:0"></div><div style="${ln}left:22%;width:56%;bottom:0;height:16%;border-bottom:0"></div>${cards}</div>`;
}
function oxTMy(el){
 if(oxWaitPen(el,'my',oxTMy))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 oxMyInit(X);const {d,C}=X,sv=oxLsGet(OX_LS.saved,[]);
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">My XI — starting-XI builder</h3>`+oxCtl(X,{mode:false,extra:`<select id="oxfm" onchange="oxMyForm(this.value)">${fpOpts(X.forms.map(f=>[f.name,'Formation '+f.name]),OX.my.form)}</select>`})+oxHead(X,OX.gi,'a starting XI of '+X.RU.play+' (not a full squad of '+X.RU.squad+'); points are projections')+
  `<div class="ctl"><button class="s" onclick="oxMyFromOpt()">Start from the optimal XI</button><button class="s" onclick="oxMyClear()">Clear</button><input id="oxsn" placeholder="Lineup name" style="width:150px"><button class="s" onclick="oxMySave()">Save</button><select id="oxsl">${fpOpts([['','Saved lineups ('+sv.length+')'],...sv.map((e,i)=>[String(i),e.name+' · '+e.at])],'')}</select><button class="s" onclick="oxMyLoad()">Load</button><button class="s" onclick="oxMyDel()">Delete</button></div>
  <div id="oxmsg" class="mu" style="min-height:20px;font-size:13px">${esc(OX.msg)}</div><div id="oxmy"></div>
  <h3>Add players</h3><div class="ctl"><input id="oxq" placeholder="Search player or club" value="${esc(OX.pq)}" style="flex:1;min-width:160px"><select id="oxpp">${fpPosOpts(OX.ppos)}</select><select id="oxpt">${fpTeamOpts(OX.pteam)}</select></div><div id="oxpick"></div><div id="pdet"></div>`;
 OX.msg='';
 const rd=()=>{OX.pq=$('#oxq').value;OX.ppos=$('#oxpp').value;OX.pteam=$('#oxpt').value;oxPickDraw(X)};$('#oxq').oninput=rd;$('#oxpp').onchange=rd;$('#oxpt').onchange=rd;
 oxDrawMy(X);oxPickDraw(X);
}
function oxDrawMy(X){
 const o=$('#oxmy');if(!o||X.err)return;const {d,C,RU}=X,my=OX.my,gi=OX.gi,ids=my.ids,bad=oxCheckXI(ids,my.cap,my.vice,X);
 const exp=oxExp(d,ids,my.cap,gi),full=ids.length===RU.play,st=ids.length?oxQs(oxSim(d,C,[{per:[{ids,cap:my.cap}]}],[gi],OX.N,7002)[0].tot):null;
 const cost=ids.reduce((s,id)=>s+(d.PB.get(id).now_cost||0),0),bn=full&&RU.budget!=null?oxCheapBench(ids,X):null;
 const sp=OX.sel!=null?d.PB.get(OX.sel):null;
 const act=sp?`<div class="card" style="font-size:13px"><b>${esc(sp.name)}</b> · ${esc(sp.tn)} · ${FPPOS[sp.ty]} · ${pmMoney(sp.now_cost)} · expected ${f(oxV(sp,gi),2)} in GW${C.gws[gi]}<div class="ctl" style="margin:8px 0 0"><button onclick="oxMyRole(${sp.id},'cap')" ${my.cap===sp.id?'disabled':''}>Make captain</button><button class="s" onclick="oxMyRole(${sp.id},'vice')" ${my.vice===sp.id||my.cap===sp.id?'disabled':''}>Make vice-captain</button><button class="s" onclick="oxMyReplace(${sp.id})">Replace</button><button class="s" onclick="oxMyRm(${sp.id})">Remove</button><button class="s" onclick="fpPredPick(${sp.id})">Details</button></div></div>`:'';
 const ok=(b,t)=>`<div style="color:${b?'var(--g)':'var(--r)'}">${b?'✓':'✗'} ${t}</div>`;
 o.innerHTML=`<div class="grid"><div class="kpi"><b>${ids.length} / ${RU.play}</b><span>Players selected (${my.form})</span></div><div class="kpi"><b style="color:var(--g)">${exp.toFixed(1)}</b><span>Expected points GW${C.gws[gi]}${my.cap!=null?' incl. captain':' (no captain yet)'}${full?'':' · partial XI'}</span></div><div class="kpi"><b>${st?oxRange(st):'—'}</b><span>80% range (simulated)</span></div><div class="kpi"><b>${pmMoney(cost)}</b><span>XI cost${bn?' · cheapest legal squad '+pmMoney(cost+bn.cost):''}</span></div></div>
 ${oxMyPitch(X,gi)}<div class="mu" style="text-align:center;font-size:12px">Tap a player for captain, vice-captain, replace or remove; tap an empty place to add a player of that position.</div>${act}
 <div class="card" style="font-size:12px"><b>Checks</b>${ok(full,ids.length+' of '+RU.play+' starters')}${ok(!bad.some(x=>/twice|no longer/.test(x)),'no duplicates; every player exists in the FPL data')}${ok(full&&!bad.some(x=>/formation/.test(x)),'legal formation '+my.form)}${ok(!bad.some(x=>/limit/.test(x)),'at most '+RU.club+' players per club')}${ok(my.cap!=null&&!bad.some(x=>/captain is/.test(x)),'captain chosen'+(my.cap!=null?' ('+esc(d.PB.get(my.cap).name)+')':''))}${ok(my.vice!=null&&!bad.some(x=>/vice/.test(x)),'vice-captain chosen'+(my.vice!=null?' ('+esc(d.PB.get(my.vice).name)+')':''))}
 ${RU.budget!=null?(full?(bn?(cost+bn.cost<=RU.budget?ok(true,'fits the budget: XI '+pmMoney(cost)+' + cheapest legal bench '+pmMoney(bn.cost)+' = '+pmMoney(cost+bn.cost)+' ≤ '+pmMoney(RU.budget)):`<div style="color:var(--a)">! over budget as a full squad: XI ${pmMoney(cost)} + cheapest legal bench ${pmMoney(bn.cost)} = ${pmMoney(cost+bn.cost)} > ${pmMoney(RU.budget)}. Fine for a what-if; compare it with the any-price optimum.</div>`):'<div style="color:var(--a)">! no legal bench completes this XI into a squad (club limit)</div>'):''):''}
 ${ids.some(id=>d.PB.get(id).st!=='a')?`<div style="color:var(--a)">! ${ids.filter(id=>d.PB.get(id).st!=='a').map(id=>esc(d.PB.get(id).name)+' ('+esc(pmStLabel(d.PB.get(id)))+')').join(', ')}: projection reduced for availability</div>`:''}</div>
 ${ids.length?tbl([['Pos'],['Player'],['Club'],['£m',1],['Fixture'],['Exp. min',1],['Expected',1]],[...ids].sort((a,b)=>d.PB.get(a).ty-d.PB.get(b).ty).map(id=>{const p=d.PB.get(id),g=oxG(p,gi);return [FPPOS[p.ty],oxNm(d,id)+(my.cap===id?' <b style="color:var(--a)">(C ×2)</b>':my.vice===id?' <span class="mu">(V)</span>':''),esc(p.tn),f(p.price,1),esc(oxFx(d,p,gi,false)),g?Math.round(g.eMin):'—',f(oxV(p,gi),2)]})):''}`;
}
function oxPickDraw(X){
 const o=$('#oxpick');if(!o||X.err)return;const {d,C}=X,gi=OX.gi,my=OX.my,q=fpNz(OX.pq);
 const L=d.P.filter(p=>oxHasPred(p)&&(!OX.ppos||p.ty===+OX.ppos)&&(!OX.pteam||p.tm===+OX.pteam)&&(!q||fpNz(p.fn+' '+p.sn+' '+p.name+' '+p.tf).includes(q))).sort((a,b)=>(oxV(b,gi)||0)-(oxV(a,gi)||0)).slice(0,60);
 o.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:4px">Sorted by expected points in GW${C.gws[gi]}. Players without a projection (no minutes this season) are not listed.</div>`+(L.length?`<div class="wrap"><table><tr><th></th><th>Player</th><th>Club</th><th>Pos</th><th class="n">£m</th><th>Fixture</th><th class="n">Exp. min</th><th class="n">Expected</th></tr>${L.map(p=>{const g=oxG(p,gi),inn=my.ids.includes(p.id);return `<tr><td><button class="${inn?'s':''}" ${inn?'disabled':''} onclick="oxMyAdd(${p.id})" style="min-height:34px;padding:2px 10px" aria-label="Add ${esc(p.name)}">${inn?'✓':'+'}</button></td><td>${pmDot(p)}<a href="javascript:void(0)" onclick="fpPredPick(${p.id})">${esc(p.name)}</a></td><td>${esc(p.tn)}</td><td>${FPPOS[p.ty]}</td><td class="n">${f(p.price,1)}</td><td>${esc(oxFx(d,p,gi,false))}</td><td class="n">${g?Math.round(g.eMin):'—'}</td><td class="n"><b>${f(oxV(p,gi),2)}</b></td></tr>`}).join('')}</table></div>`:'<div class="empty">No players match.</div>');
}

/* ---------- lineup sources (current builder XI or a saved one) ---------- */
function oxSrcOpts(){const sv=oxLsGet(OX_LS.saved,[]);return [['cur','My XI (current builder)'],...sv.map((e,i)=>['s'+i,'Saved: '+e.name])]}
function oxSrc(X){
 const {d}=X;if(OX.src==='cur'){oxMyInit(X);return Object.assign({name:'My XI'},OX.my)}
 const e=oxLsGet(OX_LS.saved,[])[+OX.src.slice(1)];if(!e||e.season!==oxSeason(d)){OX.src='cur';oxMyInit(X);return Object.assign({name:'My XI'},OX.my)}
 const ids=e.ids.filter(id=>d.PB.get(id));return {name:e.name,form:e.form,ids,cap:ids.includes(e.cap)?e.cap:null,vice:ids.includes(e.vice)?e.vice:null};
}
const oxSrcSel=()=>`<select onchange="OX.src=this.value;fpRender()">${fpOpts(oxSrcOpts(),OX.src)}</select>`;
function oxNeedXI(X,L){const bad=oxCheckXI(L.ids,L.cap,L.vice,X).filter(x=>!/vice/.test(x));return bad.length?`<div class="empty">${esc(L.name)} is not a complete, valid starting XI yet: ${esc(bad.join('; '))}. Build it in the <a href="javascript:void(0)" onclick="fpTab('my')">My XI</a> tab (or press "Start from the optimal XI" there and change players).</div>`:''}

/* ---------- tab: My XI vs Optimal XI ---------- */
function oxTVs(el){
 if(oxWaitPen(el,'vs',oxTVs))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 const L=oxSrc(X);
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">My XI vs Optimal XI</h3>`+oxCtl(X,{extra:oxSrcSel()})+oxHead(X,OX.gi,'both lineups use the same gameweek, predictions and scoring rules; projections, not guarantees')+`<div id="oxvs"></div><div id="pdet"></div>`;
 const nd=oxNeedXI(X,L);if(nd){$('#oxvs').innerHTML=nd;return}
 $('#oxvs').innerHTML='<div class="empty">Computing the optimal XI…</div>';
 const gi=OX.gi,mode=OX.mode,seq=++OX.fcSeq;
 setTimeout(async()=>{const res=await oxOptimal(X,gi,mode);if(seq!==OX.fcSeq||!$('#oxvs'))return;oxDrawVs(X,L,res,gi)},20);
}
function oxDrawVs(X,L,res,gi){
 const {d,C,RU}=X,o=$('#oxvs');if(res.err){o.innerHTML=`<div class="empty">${esc(res.err)}</div>`;return}
 const t=res.team,M={ids:t.xi.map(i=>i.id),cap:t.cap.id},U={ids:L.ids,cap:L.cap};
 const eU=oxExp(d,U.ids,U.cap,gi),eM=oxExp(d,M.ids,M.cap,gi),dU=oxR1(eU),dM=oxR1(eM),diff=oxR1(dM-dU);
 const sm=oxSim(d,C,[{per:[U]},{per:[M]}],[gi],OX.N,7003),sU=oxQs(sm[0].tot),sM=oxQs(sm[1].tot),sd=oxDiffS(sm[0].tot,sm[1].tot);
 const both=U.ids.filter(id=>M.ids.includes(id)),onlyU=U.ids.filter(id=>!M.ids.includes(id)),onlyM=M.ids.filter(id=>!U.ids.includes(id));
 const v=id=>oxV(d.PB.get(id),gi)||0,pos=id=>d.PB.get(id).ty;
 /* pair the differences by position, best first; leftovers are formation changes */
 const pairs=[],lu=[...onlyU].sort((a,b)=>v(b)-v(a)),lm=[...onlyM].sort((a,b)=>v(b)-v(a));
 for(const t of [1,2,3,4]){const a=lu.filter(id=>pos(id)===t),b=lm.filter(id=>pos(id)===t);for(let k=0;k<Math.max(a.length,b.length);k++)pairs.push({t,u:a[k]??null,m:b[k]??null})}
 pairs.sort((x,y)=>((x.m!=null?v(x.m):0)-(x.u!=null?v(x.u):0)<((y.m!=null?v(y.m):0)-(y.u!=null?v(y.u):0))?1:-1));
 const why=(a,b)=>{if(a==null||b==null)return 'formation change ('+L.form+' → '+t.form.name+')';const ga=oxG(d.PB.get(a),gi),gb=oxG(d.PB.get(b),gi);
  const ds=OX_COMP.map(k=>[k,(gb.parts[k]||0)-(ga.parts[k]||0)]).filter(x=>Math.abs(x[1])>=0.05).sort((x,y)=>Math.abs(y[1])-Math.abs(x[1])).slice(0,3);
  const s=ds.map(([k,x])=>OX_CL[k]+' '+(x>0?'+':'')+x.toFixed(2));const ea=ga.eMin,eb=gb.eMin;if(Math.abs(eb-ea)>=10)s.push('exp. minutes '+Math.round(ea)+' → '+Math.round(eb));
  return s.join(', ')||'about equal'};
 const capU=U.cap!=null?v(U.cap):0,capM=v(M.cap);
 let sumRows=0;const prow=pairs.map(x=>{const a=x.u!=null?v(x.u):0,b=x.m!=null?v(x.m):0;sumRows+=b-a;
  return [FPPOS[x.t],x.u!=null?oxNm(d,x.u)+' <span class="mu">'+esc(d.PB.get(x.u).tn)+'</span>':'<span class="mu">—</span>',x.u!=null?a.toFixed(2):'',x.m!=null?oxNm(d,x.m)+' <span class="mu">'+esc(d.PB.get(x.m).tn)+'</span>':'<span class="mu">—</span>',x.m!=null?b.toFixed(2):'',`<b>${(b-a>=0?'+':'')+(b-a).toFixed(2)}</b>`,`<span style="white-space:normal;display:inline-block;min-width:220px">${esc(why(x.u,x.m))}</span>`]});
 const capD=capM-capU;
 o.innerHTML=`<div class="grid"><div class="kpi"><b style="color:${OXCOL[0]}">■</b><b>${dU.toFixed(1)}</b><span>${esc(L.name)} · expected (80% range ${oxRange(sU)})</span></div><div class="kpi"><b style="color:${OXCOL[1]}">■</b><b>${dM.toFixed(1)}</b><span>Optimal XI (${res.mode==='budget'?'within budget':'any price'}) · expected (80% range ${oxRange(sM)})</span></div><div class="kpi"><b>${(diff>=0?'+':'')+diff.toFixed(1)}</b><span>Projected difference (optimal − yours)</span></div><div class="kpi"><b>${oxP(sd.pWin)}</b><span>Chance your XI outscores it${sd.pTie>0.005?' ('+oxP(sd.pTie)+' tie)':''} (simulated)</span></div></div>
 <div class="mu" style="font-size:12px;margin:8px 0">The difference is the difference of the two totals shown (${dM.toFixed(1)} − ${dU.toFixed(1)}). 80% of simulated outcomes of the difference lie between ${sd.p10.toFixed(0)} and ${sd.p90.toFixed(0)}: the optimal XI has the higher <i>expected</i> score, but it can lose in a single gameweek. Players common to both lineups are simulated once and cancel out.${res.mode==='budget'&&U.ids.length===RU.play?(()=>{const bn=oxCheapBench(U.ids,X),c=U.ids.reduce((s,id)=>s+d.PB.get(id).now_cost,0);return bn&&c+bn.cost>RU.budget?' <span style="color:var(--a)">Your XI would not fit the budget as part of a full squad, while the optimal XI does: switch the constraint to "Any price" for a like-for-like comparison.</span>':''})():''}</div>
 <h3>Where the ${(diff>=0?'+':'')+diff.toFixed(1)} comes from</h3>${pairs.length?tbl([['Pos'],['Yours'],['Exp.',1],['Model'],['Exp.',1],['Gain',1],['Main differences (model − yours)']],prow):'<div class="card">Both lineups have the same 11 players.</div>'}
 <div class="mu" style="font-size:12px;margin:6px 0">Captain: yours ${U.cap!=null?esc(d.PB.get(U.cap).name)+' (+'+capU.toFixed(2)+')':'—'}, model ${esc(d.PB.get(M.cap).name)} (+${capM.toFixed(2)}): ${(capD>=0?'+':'')+capD.toFixed(2)}. Player swaps ${(sumRows>=0?'+':'')+sumRows.toFixed(2)} + captain ${(capD>=0?'+':'')+capD.toFixed(2)} = ${(sumRows+capD>=0?'+':'')+(sumRows+capD).toFixed(2)} (unrounded difference ${(eM-eU).toFixed(2)}). Tap any name to see why the model rates him as it does.</div>
 <h3>In both lineups (${both.length})</h3>${oxTbl([['Pos'],['Player'],['Club'],['Expected',1]],[...both].sort((a,b)=>pos(a)-pos(b)).map(id=>[FPPOS[pos(id)],oxNm(d,id),esc(d.PB.get(id).tn),v(id).toFixed(2)]),'No player in common.')}
 <div class="grid" style="margin-top:8px"><div><h3>Only in ${esc(L.name)} (${onlyU.length})</h3>${oxTbl([['Player'],['Expected',1]],onlyU.map(id=>[oxNm(d,id)+(U.cap===id?' (C)':''),v(id).toFixed(2)]),'None.')}</div><div><h3>Only in the optimal XI (${onlyM.length})</h3>${oxTbl([['Player'],['Expected',1]],onlyM.map(id=>[oxNm(d,id)+(M.cap===id?' (C)':''),v(id).toFixed(2)]),'None.')}</div></div>`;
}

/* ---------- tab: multi-gameweek forecast ---------- */
function oxTFc(el){
 if(oxWaitPen(el,'fc',oxTFc))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 const {C}=X,hs=[1,3,5,7].filter(h=>h<=C.gws.length);if(C.gws.length>1&&!hs.includes(C.gws.length)&&C.gws.length<7)hs.push(C.gws.length);if(!hs.includes(OX.hz))OX.hz=hs.filter(h=>h<=OX.hz).pop()||1;
 const L=oxSrc(X);
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">Forecast — next ${OX.hz} gameweek${OX.hz>1?'s':''}</h3>`+oxCtl(X,{gw:false,extra:`<select onchange="OX.hz=+this.value;fpRender()">${fpOpts(hs.map(h=>[String(h),h===1?'Next gameweek':'Next '+h+' gameweeks']),String(OX.hz))}</select>`+oxSrcSel()})+oxHead(X,0,'GW'+C.gws[0]+'–GW'+C.gws[OX.hz-1]+' · projections; uncertainty grows with distance')+`<div id="oxfc"></div><div id="pdet"></div>`;
 const nd=oxNeedXI(X,L);if(nd){$('#oxfc').innerHTML=nd;return}
 const seq=++OX.fcSeq,hz=OX.hz,mode=OX.mode;
 (async()=>{const per=[];for(let k=0;k<hz;k++){const e=$('#oxfc');if(seq!==OX.fcSeq||!e)return;e.innerHTML=`<div class="empty">Optimizing GW${C.gws[k]} (${k+1} of ${hz})…</div>`;await oxYield();per.push(await oxOptimal(X,k,mode))}
  if(seq!==OX.fcSeq||!$('#oxfc'))return;oxDrawFc(X,L,per,hz)})();
}
function oxDrawFc(X,L,per,hz){
 const {d,C}=X,o=$('#oxfc'),gis=Array.from({length:hz},(_,k)=>k),gws=gis.map(k=>C.gws[k]);
 const U={per:gis.map(()=>({ids:L.ids,cap:L.cap}))},Mw={per:per.map(r=>r.err?null:{ids:r.team.xi.map(i=>i.id),cap:r.team.cap.id})},M0=per[0].err?null:{ids:per[0].team.xi.map(i=>i.id),cap:per[0].team.cap.id},Mf={per:gis.map(()=>M0)};
 const LS=[U,Mw,Mf],names=[L.name+' (fixed)','Optimal XI, re-picked each GW','GW'+gws[0]+' optimal XI kept fixed'];
 const ex=LS.map(x=>gis.map(k=>x.per[k]?oxExp(d,x.per[k].ids,x.per[k].cap,k):null));
 const sm=oxSim(d,C,LS,gis,OX.N,7004),q=sm.map(s=>s.gw.map(a=>oxQs(a))),qt=sm.map(s=>s.ok?oxQs(s.tot):null),tot=ex.map(a=>a.some(v=>v==null)?null:a.reduce((s,v)=>s+v,0));
 const dfx=sm[1].ok?oxDiffS(sm[0].tot,sm[1].tot):null;
 /* blanks and doubles touching any player in these lineups */
 const ids=new Set([...L.ids,...per.flatMap(r=>r.err?[]:r.team.xi.map(i=>i.id))]),bd=[];
 gis.forEach(k=>{const ts=new Map();ids.forEach(id=>{const p=d.PB.get(id),g=oxG(p,k);if(g&&(g.none||g.fx.length>1))ts.set(p.tm,g.none?'blank':'double')});ts.forEach((v,tm)=>bd.push('GW'+gws[k]+': '+pmTeamS(tm)+' '+v))});
 const S=[0,1,2].map(j=>({n:names[j],short:['Yours','Re-picked','Fixed opt.'][j],v:ex[j],lo:j<2?q[j].map((x,k)=>LS[j].per[k]?x.p10:null):null,hi:j<2?q[j].map((x,k)=>LS[j].per[k]?x.p90:null):null,c:OXCOL[j],dash:OXDASH[j]}));
 const chart=hz>1?oxChart('oxch',gws,S):oxRangePlot(S.map((s,j)=>({n:s.n,mean:ex[j][0],lo:qt[j]?qt[j].p10:null,hi:qt[j]?qt[j].p90:null,c:s.c})));
 const r1=x=>x==null?'N/A':x.toFixed(1);
 const dU=tot[0]==null?null:oxR1(tot[0]),dM=tot[1]==null?null:oxR1(tot[1]);
 o.innerHTML=`<div class="grid"><div class="kpi"><b>${r1(dU)}</b><span>${esc(L.name)}: expected over ${hz} GW (80% range ${qt[0]?oxRange(qt[0]):'N/A'})</span></div><div class="kpi"><b>${r1(dM)}</b><span>Optimal XI re-picked each GW (80% range ${qt[1]?oxRange(qt[1]):'N/A'})</span></div><div class="kpi"><b>${dU!=null&&dM!=null?((dM-dU>=0?'+':'')+(dM-dU).toFixed(1)):'N/A'}</b><span>Projected difference over the period</span></div><div class="kpi"><b>${r1(tot[2]==null?null:oxR1(tot[2]))}</b><span>GW${gws[0]} optimal XI if never changed</span></div></div>
 <div class="ctl" style="margin:10px 0 2px;font-size:13px;gap:14px">${S.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg>${esc(s.n)}</span>`).join('')}${hz>1?'<span class="mu">shaded = 80% range</span>':''}</div>
 ${chart}
 <h3>Per gameweek (expected, 80% range)</h3>${tbl([['GW'],...names.map(n=>[esc(n),1])],gis.map(k=>['GW'+gws[k],...[0,1,2].map(j=>ex[j][k]==null?'N/A':`${ex[j][k].toFixed(1)} <span class="mu">(${q[j][k].p10.toFixed(0)}–${q[j][k].p90.toFixed(0)})</span>`)]))}
 ${tbl([['Period total'],...names.map(n=>[esc(n),1])],[['GW'+gws[0]+'–'+gws[hz-1],...[0,1,2].map(j=>tot[j]==null?'N/A':`<b>${tot[j].toFixed(1)}</b> <span class="mu">(${qt[j].p10.toFixed(0)}–${qt[j].p90.toFixed(0)})</span>`)]])}
 <div class="mu" style="font-size:12px;margin:6px 0">${dfx?`Chance that ${esc(L.name)} outscores the re-picked optimal XI over the period: ${oxP(dfx.pWin)} (simulated). `:''}Your lineup and captain are held fixed for every gameweek (no transfers or captain changes); the re-picked optimum is a ceiling that assumes unlimited free changes, and the fixed GW${gws[0]} optimum is the like-for-like reference for an unchanged lineup. Period ranges are percentiles of the simulated <i>sum</i> over all ${hz} gameweeks, not ${hz} single-week ranges added up. ${bd.length?'Blank/double gameweeks for these players: '+esc(bd.join('; '))+'. ':''}Later gameweeks are less certain: injury news and FPL's chance of playing only exist for the next gameweek (carried forward unchanged), and fixtures can still move.</div>
 ${per.filter(r=>r.err).length?`<div class="card" style="color:var(--a)">${per.map((r,k)=>r.err?'GW'+gws[k]+': '+esc(r.err):'').filter(Boolean).join('<br>')}</div>`:''}`;
 if(hz>1)oxChartWire('oxch',gws,S);
}
/* line chart: expected points per gameweek, optional 80% band; missing values break the line */
function oxChart(id,gws,S){
 const W=680,H=270,L=42,B=30,T=14,Rr=84,vals=S.flatMap(s=>[...s.v,...(s.lo||[]),...(s.hi||[])]).filter(fpOk);
 if(!vals.length)return '<div class="empty">No values to draw.</div>';
 /* rounded ticks (1, 2, 2.5 or 5 × 10^k) on a domain fitted to the values and ranges */
 const v0=Math.min(...vals),v1=Math.max(...vals),raw=((v1-v0)||1)/4,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw);
 const lo=Math.max(0,Math.floor(v0/st)*st),hi=Math.ceil(v1/st)*st,sx=i=>L+(W-L-Rr)*(gws.length>1?i/(gws.length-1):.5),sy=v=>H-B-(H-B-T)*(v-lo)/((hi-lo)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let v=lo;v<=hi+1e-9;v+=st){g+=`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W-Rr}" y2="${sy(v).toFixed(1)}" stroke="#25374d" stroke-width=".6"/><text x="${L-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${+v.toFixed(2)}</text>`}
 gws.forEach((w,i)=>{g+=`<text x="${sx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#8a9bb0">GW${w}</text>`});
 S.forEach(s=>{if(!s.lo)return;let seg=[];const flush=()=>{if(seg.length>1)g+=`<path d="${seg.map((i,k)=>(k?'L':'M')+sx(i).toFixed(1)+' '+sy(s.hi[i]).toFixed(1)).join(' ')} ${[...seg].reverse().map(i=>'L'+sx(i).toFixed(1)+' '+sy(s.lo[i]).toFixed(1)).join(' ')} Z" fill="${s.c}" fill-opacity=".13" stroke="none"/>`;seg=[]};
  s.v.forEach((v,i)=>{if(fpOk(v)&&fpOk(s.lo[i]))seg.push(i);else flush()});flush()});
 S.forEach(s=>{let dd='',pen=false;s.v.forEach((v,i)=>{if(!fpOk(v)){pen=false;return}dd+=(pen?'L':'M')+sx(i).toFixed(1)+' '+sy(v).toFixed(1)+' ';pen=true});
  g+=`<path d="${dd}" fill="none" stroke="${s.c}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linejoin="round"/>`;
  s.v.forEach((v,i)=>{if(fpOk(v))g+=`<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="4" fill="${s.c}" stroke="#0d1520" stroke-width="2"/>`})});
 /* direct labels at the last value of each line, nudged apart so they never overlap */
 const lab=S.map(s=>{let i=s.v.length-1;while(i>=0&&!fpOk(s.v[i]))i--;return i<0?null:{s,i,y:sy(s.v[i])}}).filter(Boolean).sort((a,b)=>a.y-b.y);
 for(let k=1;k<lab.length;k++)if(lab[k].y-lab[k-1].y<13)lab[k].y=lab[k-1].y+13;
 lab.forEach(o=>{g+=`<text x="${(sx(o.i)+8).toFixed(1)}" y="${(o.y+4).toFixed(1)}" font-size="11" fill="#e8eef5">${esc(o.s.short||'')}</text>`});
 g+=`<line id="${id}x" x1="0" y1="${T}" x2="0" y2="${H-B}" stroke="#e8eef5" stroke-opacity=".5" stroke-width="1" style="display:none"/><rect id="${id}h" x="${L}" y="${T}" width="${W-L-Rr}" height="${H-B-T}" fill="transparent" style="cursor:crosshair"/>`;
 return `<div style="position:relative;max-width:760px;margin:0 auto" id="${id}"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;touch-action:pan-y" role="img" aria-label="Expected points per gameweek">${g}</svg><div id="${id}t" style="position:absolute;display:none;pointer-events:none;background:#152130;border:1px solid #25374d;border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.4;min-width:150px;z-index:2"></div></div><div class="mu" style="font-size:11px;text-align:center">Expected points per gameweek (y) by gameweek (x). Hover or tap for values; the tables below hold every number.</div>`;
}
function oxChartWire(id,gws,S){
 const box=document.getElementById(id);if(!box)return;const svg=box.querySelector('svg'),hit=document.getElementById(id+'h'),ln=document.getElementById(id+'x'),tip=document.getElementById(id+'t');
 const W=680,L=42,Rr=84,sx=i=>L+(W-L-Rr)*(gws.length>1?i/(gws.length-1):.5);
 const show=ev=>{const r=svg.getBoundingClientRect(),xv=(ev.clientX-r.left)/r.width*W;let bi=0,bd=1e9;gws.forEach((_,i)=>{const dd=Math.abs(sx(i)-xv);if(dd<bd){bd=dd;bi=i}});
  ln.setAttribute('x1',sx(bi));ln.setAttribute('x2',sx(bi));ln.style.display='';tip.textContent='';
  const h=document.createElement('div');h.style.cssText='color:#8a9bb0;margin-bottom:2px';h.textContent='GW'+gws[bi];tip.appendChild(h);
  S.forEach(s=>{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:6px';const k=document.createElementNS('http://www.w3.org/2000/svg','svg');k.setAttribute('width','16');k.setAttribute('height','6');k.innerHTML=`<line x1="0" y1="3" x2="16" y2="3" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/>`;
   const b=document.createElement('b');const v=s.v[bi];b.textContent=fpOk(v)?v.toFixed(1)+(s.lo&&fpOk(s.lo[bi])?' ('+s.lo[bi].toFixed(0)+'–'+s.hi[bi].toFixed(0)+')':''):'N/A';const n=document.createElement('span');n.style.color='#8a9bb0';n.textContent=s.n;row.append(k,b,n);tip.appendChild(row)});
  const px=sx(bi)/W*r.width;tip.style.display='block';tip.style.top='8px';tip.style.left=(px>r.width/2?Math.max(0,px-tip.offsetWidth-10):px+10)+'px'};
 hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',()=>{ln.style.display='none';tip.style.display='none'});
}
/* one-gameweek view: expected value (dot) and 80% range (bar) per lineup */
function oxRangePlot(rows){
 const W=680,rh=46,L=10,Rr=20,H=rows.length*rh+30,vals=rows.flatMap(r=>[r.mean,r.lo,r.hi]).filter(fpOk);if(!vals.length)return '';
 const hi=Math.max(...vals)*1.08,sx=v=>L+(W-L-Rr)*v/(hi||1);let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let i=0;i<=5;i++){const v=hi*i/5;g+=`<line x1="${sx(v).toFixed(1)}" y1="6" x2="${sx(v).toFixed(1)}" y2="${H-22}" stroke="#25374d" stroke-width=".6"/><text x="${sx(v).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="11" fill="#8a9bb0">${v.toFixed(0)}</text>`}
 rows.forEach((r,k)=>{const y=14+k*rh;g+=`<text x="${L}" y="${y}" font-size="12" fill="#e8eef5">${esc(r.n)}: ${fpOk(r.mean)?r.mean.toFixed(1):'N/A'}${fpOk(r.lo)?' (80% range '+r.lo.toFixed(0)+'–'+r.hi.toFixed(0)+')':''}</text>`;
  if(fpOk(r.lo))g+=`<line x1="${sx(r.lo).toFixed(1)}" y1="${y+16}" x2="${sx(r.hi).toFixed(1)}" y2="${y+16}" stroke="${r.c}" stroke-width="6" stroke-linecap="round" stroke-opacity=".55"/>`;
  if(fpOk(r.mean))g+=`<circle cx="${sx(r.mean).toFixed(1)}" cy="${y+16}" r="6" fill="${r.c}" stroke="#0d1520" stroke-width="2"/>`});
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;display:block;margin:0 auto" role="img" aria-label="Expected points and 80% range per lineup">${g}</svg>`;
}

/* ---------- Backtest additions: range calibration + penalty regression vs base model (same leak-free replay) ---------- */
async function oxBtRun(d,onP){
 await oxPenLoad();
 const cap=new Map(),orig=pmPlayer;
 const runV=async v=>{OX.btVer=v;cap.clear();try{
   pmPlayer=function(p,C,dd){const m=orig(p,C,dd);if(dd!==FPD)cap.set(C.next+'|'+p.id,{p,m,C,dd});return m};
   const r=await btRun(d,x=>onP&&onP(v,x));return {r,cap:new Map(cap)}}finally{pmPlayer=orig;OX.btVer='v1'}};
 const a=await runV('v1'),b=OX.pen&&OX.pen.ok&&!d.archive?await runV('v2'):null;
 /* calibration of v1 ranges: per player-gameweek, simulate his points and compare the actual with the 10th/90th percentiles */
 const u=oxRng(99),N=300,cal=[];let k=0;
 for(const x of a.r.rows){const c=a.cap.get(x.r+'|'+x.id);if(!c)continue;const q=oxParams(Object.assign({},c.p,{pm:c.m}),0,c.dd,c.C);
  const s=new Float64Array(N);for(let i=0;i<N;i++){let v=0;for(const z of q){const G=z.lc!=null?oxPx(z.xL,u):null;v+=oxDraw(z,G,u)}s[i]=v}
  const st=oxQ(s);let bl=0,ab=0;for(const v of s){if(v<st.p10)bl++;if(v>st.p90)ab++}
  cal.push({r:x.r,pos:x.pos,act:x.act,pred:x.pred,mean:st.mean,p10:st.p10,p90:st.p90,eb:bl/N,ea:ab/N});
  if(++k%300===0){onP&&onP('cal',k);await oxYield()}}
 /* lineup level: per finished gameweek, 60 random legal XIs of players with 90+ earlier minutes and the model's optimal XI */
 const X=oxReady(),RU=X.err?null:X.RU,forms=X.err?[]:X.forms,lin=[],by=new Map();a.r.rows.forEach(x=>{if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
 if(RU)for(const [rd,L] of [...by].sort((x,y)=>x[0]-y[0])){
  const pool=L.filter(x=>x.pr>=90),act=new Map(L.map(x=>[x.id,x.act])),ls=[];
  const opt=oxSolveXI(pool.map(x=>({id:x.id,t:x.pos,c:x.price||0,club:x.club,v:x.pred})),RU,forms).best;if(opt)ls.push({kind:'opt',ids:opt.team.xi.map(i=>i.id),cap:opt.team.cap.id});
  for(let j=0;j<60;j++){const fm=forms[Math.floor(u()*forms.length)],ks=oxKs(fm),ids=[];let okk=true;
   for(const t of [1,2,3,4]){const A=pool.filter(x=>x.pos===t);for(let i=0;i<ks[t];i++){if(!A.length){okk=false;break}ids.push(A.splice(Math.floor(u()*A.length),1)[0].id)}}
   if(okk)ls.push({kind:'rand',ids,cap:ids[Math.floor(u()*ids.length)]})}
  const fxOf=id=>{const c=a.cap.get(rd+'|'+id);return c?oxParams(Object.assign({},c.p,{pm:c.m}),0,c.dd,c.C):[]},lam=oxLam(L.map(x=>fxOf(x.id)));
  for(const Lx of ls){const q=Lx.ids.map(id=>({id,fx:fxOf(id)})),P=oxPlan(q,lam),ci=Lx.ids.indexOf(Lx.cap),M=500,s=new Float64Array(M);
   for(let i=0;i<M;i++){const v=oxDrawSet(P,u);let tot=0;for(let j=0;j<v.length;j++)tot+=v[j];if(ci>=0)tot+=v[ci];s[i]=tot}
   const st=oxQ(s);let v2=0;for(const v of s)v2+=(v-st.mean)**2;
   lin.push({r:rd,kind:Lx.kind,act:Lx.ids.reduce((x,id)=>x+(act.get(id)||0),0)+(act.get(Lx.cap)||0),mean:st.mean,p10:st.p10,p90:st.p90,sd:Math.sqrt(v2/M)})}
  onP&&onP('xi',rd);await oxYield()}
 const zsd=L=>L.length?Math.sqrt(L.reduce((x,o)=>x+((o.act-o.mean)/o.sd)**2,0)/L.length):null,rr=lin.filter(x=>x.kind==='rand');
 const kappa=zsd(rr),rows=a.r.rows,mx=rows.reduce((x,o)=>x+o.pred,0)/rows.length,my=rows.reduce((x,o)=>x+o.act,0)/rows.length;let sxy=0,sxx=0;rows.forEach(o=>{sxy+=(o.pred-mx)*(o.act-my);sxx+=(o.pred-mx)**2});
 const top=[];by.forEach(L=>[...L].sort((x,y)=>y.pred-x.pred||x.id-y.id).slice(0,11).forEach(o=>top.push(o)));
 const top11=top.length?{n:top.length,pred:top.reduce((x,o)=>x+o.pred,0)/top.length,act:top.reduce((x,o)=>x+o.act,0)/top.length}:null;
 const rs=[...by.keys()].sort((x,y)=>x-y),half=rs[Math.floor(rs.length/2)],fit=rr.filter(x=>x.r<half),val=rr.filter(x=>x.r>=half),kf=zsd(fit);
 const cov=(L,k)=>L.length?L.filter(o=>o.act>=o.mean-k*(o.mean-o.p10)&&o.act<=o.mean+k*(o.p90-o.mean)).length/L.length:null;
 const lc={n:rr.length,rounds:rs,kappa,cov1:cov(rr,1),covK:cov(rr,Math.min(2,Math.max(1,kappa||1))),split:fit.length&&val.length?{half,kf,cov1:cov(val,1),covK:cov(val,Math.min(2,Math.max(1,kf))),n:val.length}:null,opt:lin.filter(x=>x.kind==='opt')};
 if(fpOk(kappa)&&!d.archive)oxLsSet(OX_LS.cal,{season:oxSeason(d),gen:d.generated,kappa:Math.min(2,Math.max(1,kappa)),top11,slope:sxx>0?sxy/sxx:null,rounds:rs,n:rr.length});
 return {at:d.generated,v1:a.r,v2:b?b.r:null,cal,lc,slope:sxx>0?sxy/sxx:null,top11};
}
function oxBtHtml(){
 const head='<h3>Points range calibration and the penalty-regression option</h3>';
 if(!OX.bt)return head+`<div class="mu" style="font-size:12px;margin-bottom:6px">Checks the 80% ranges shown in Optimal XI, My XI and Forecast: in the same leak-free replay, how often did a player's actual points fall below the 10th or above the 90th percentile of his simulated distribution? Also replays the penalty-regression option (PitchAPI penalty shots) and compares it with the base model on the same player-gameweeks.</div><div class="ctl"><button class="s" onclick="oxBtGo()" ${OX.btBusy?'disabled':''}>Run calibration and penalty-regression comparison</button></div><div id="oxbtmsg" class="mu"></div>`;
 if(OX.bt.err)return head+`<div class="empty">Could not run: ${esc(OX.bt.err)}</div>`;
 const B=OX.bt,st=BT.start,cal=B.cal.filter(x=>x.r>=st);if(!cal.length)return head+'<div class="empty">No player-gameweeks in this range.</div>';
 const avg=a=>a.reduce((s,x)=>s+x,0)/a.length,below=avg(cal.map(x=>x.act<x.p10?1:0)),above=avg(cal.map(x=>x.act>x.p90?1:0)),eb=avg(cal.map(x=>x.eb)),ea=avg(cal.map(x=>x.ea));
 const pc=v=>(v*100).toFixed(1)+'%',mean=avg(cal.map(x=>x.mean)),pred=avg(cal.map(x=>x.pred));
 const byPos=[1,2,3,4].map(t=>{const L=cal.filter(x=>x.pos===t);if(!L.length)return null;return [FPPOS[t],L.length,pc(avg(L.map(x=>x.act<x.p10?1:0))),pc(avg(L.map(x=>x.eb))),pc(avg(L.map(x=>x.act>x.p90?1:0))),pc(avg(L.map(x=>x.ea)))]}).filter(Boolean);
 let v2='';
 if(B.v2){const k=x=>x.r+'|'+x.id,m2=new Map(B.v2.rows.map(x=>[k(x),x])),pr=B.v1.rows.filter(x=>x.r>=st&&m2.has(k(x))).map(x=>({r:x.r,id:x.id,act:x.act,a:x.pred,b:m2.get(k(x)).pred}));
  const mae=(L,f)=>L.length?avg(L.map(x=>Math.abs(x[f]-x.act))):null,ch=pr.filter(x=>Math.abs(x.a-x.b)>1e-6),by=new Map();
  ch.forEach(x=>{let o=by.get(x.r);if(!o){o={n:0,g:0};by.set(x.r,o)}o.n++;o.g+=Math.abs(x.a-x.act)-Math.abs(x.b-x.act)});
  const gs=[...by.values()].map(o=>o.g/o.n),wins=gs.filter(x=>x>0).length;
  v2=`<h3>Penalty regression vs base model</h3>`+tbl([['Sample'],['N',1],['MAE base',1],['MAE with penalty regression',1]],[['All player-gameweeks',pr.length,f(mae(pr,'a'),3),f(mae(pr,'b'),3)],['Only where the option changes the prediction (penalty takers)',ch.length,f(mae(ch,'a'),3),f(mae(ch,'b'),3)]])+
   `<div class="mu" style="font-size:12px;margin:6px 0">On the changed player-gameweeks the penalty-regression option had the lower average error in ${wins} of ${gs.length} gameweeks. ${ch.length<100?'<b>The sample is far too small to conclude anything</b> (penalties are rare), so the base model stays the default; the option can be selected in the Optimal XI tab.':'the base model stays the default until the option shows a consistent gain over more gameweeks.'} Penalty shots of round r are used only when predicting later rounds.</div>`}
 else v2=`<div class="mu" style="font-size:12px">Penalty regression not tested: ${esc((OX.pen&&OX.pen.why)||'no PitchAPI penalty data')}.</div>`;
 return head+tbl([['Check'],['Model says',1],['Actual',1]],[['Actual below the 10th percentile',pc(eb),pc(below)],['Actual above the 90th percentile',pc(ea),pc(above)],['Mean points per player-gameweek',mean.toFixed(3),avg(cal.map(x=>x.act)).toFixed(3)]])+
  `<div class="mu" style="font-size:12px;margin:6px 0">${cal.length} player-gameweeks from GW${st}. "Model says" is the share of the model's own simulated outcomes beyond each percentile (points are whole numbers, so it is not exactly 10%); a calibrated model matches it. Simulated mean ${mean.toFixed(3)} vs analytic expectation ${pred.toFixed(3)} (difference = Monte Carlo error). Single-player check only: lineup ranges also depend on correlations between team-mates.</div>`+
  tbl([['Pos'],['N',1],['Below P10: actual',1],['model',1],['Above P90: actual',1],['model',1]],byPos)+oxBtLineHtml(B)+v2;
}
function oxBtLineHtml(B){
 const L=B.lc;if(!L||!L.n)return '';const pc=v=>v==null?'N/A':(v*100).toFixed(1)+'%',S=L.split;
 const opt=L.opt.map(o=>['GW'+o.r,o.mean.toFixed(1),o.p10.toFixed(0)+'–'+o.p90.toFixed(0),o.act.toFixed(0)]);
 return `<h3>Lineup ranges (11 players + captain)</h3>`+tbl([['Check'],['Value',1]],[
  ['Random legal XIs tested (GW'+L.rounds[0]+'–'+L.rounds[L.rounds.length-1]+')',L.n],
  ['Real totals inside the unwidened 80% range',pc(L.cov1)],
  ['Spread of real totals vs simulated (sd of z; 1 = calibrated)',f(L.kappa,2)],
  ['Inside the 80% range after widening by that factor (same data)',pc(L.covK)],
  ...(S?[['Out-of-sample: factor fitted before GW'+S.half+' ('+f(S.kf,2)+'), coverage on GW'+S.half+'+ ('+S.n+' XIs)',pc(S.cov1)+' → '+pc(S.covK)]]:[]),
  ['Calibration slope of actual on predicted points (1 = calibrated; below 1 = too spread out)',f(B.slope,3)],
  ...(B.top11?[['11 highest-projected players per gameweek: mean projected vs actual',B.top11.pred.toFixed(2)+' vs '+B.top11.act.toFixed(2)]]:[])])+
  `<div class="mu" style="font-size:12px;margin:6px 0">The factor (${f(L.kappa,2)}, kept between 1 and 2) is now stored on this device and widens every lineup range in Optimal XI, My XI, the comparison and the forecast (default before this run: ${OX_KAPPA}). Random XIs are a stand-in for "any lineup": the XIs of one gameweek share fixtures, so the effective sample is closer to the number of gameweeks than to the number of XIs. Highest projections are optimistic on average (selection effect), so the model's own optimal XI usually scores below its projection:</div>`+
  tbl([['GW'],['Optimal XI projected',1],['Simulated 80% range',1],['Actual',1]],opt);
}
async function oxBtGo(){
 if(OX.btBusy)return;OX.btBusy=true;const m=()=>$('#oxbtmsg');if(m())m().textContent='Replaying…';
 try{OX.bt=await oxBtRun(FPD,(v,x)=>{const e=m();if(e)e.textContent=v==='cal'?'Simulating player ranges… '+x:v==='xi'?'Simulating lineup ranges, gameweek '+x+'…':'Replaying model '+v+', gameweek '+x+'…'})}
 catch(e){OX.bt={err:e.message}}
 OX.btBusy=false;if(FP.tab==='backtest')btDraw();
}
"""


def _x_ox_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (Optimal XI): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    # التبويبات الجديدة أول شي في صفحة Fantasy، والتشكيلة المثالية هي التبويب الافتراضي
    h = sub(h, "const FP={tab:'table',", "const FP={tab:'xi',")
    h = sub(h, "const d=FPD,T=[['table','Table'],",
            "const d=FPD,T=[['xi','★ Optimal XI'],['my','My XI'],['vs','My XI vs Optimal'],['fc','Forecast'],['table','Table'],")
    h = sub(h, "({table:fpTTable,", "({xi:oxTXI,my:oxTMy,vs:oxTVs,fc:oxTFc,table:fpTTable,")
    # ربط PitchAPI بـ FPL: الدوري الإنجليزي اسمه موجود لكن الدولة فاضية في PitchAPI، فنتحقق من أسماء الأندية بدلها
    h = sub(h, "if(!/premier league/i.test(D.name)||!/engl/i.test(pl.country||''))return out;",
            "if(!/premier league/i.test(D.name)||!(/engl/i.test(pl.country||'')||oxPLClubOverlap(D.stats.map(s=>s.club))>=15))return out;")
    h = sub(h, "+btLineHtml()+", "+btLineHtml()+oxBtHtml()+")
    h = sub(h, "async function route(){", _X_OXJS + "\nasync function route(){")
    return h


INDEX = _x_ox_index(INDEX)
# ======================== نهاية إضافة Optimal XI ========================


# ============================================================================
# إضافة: مواسم الفانتازي السابقة (2022/23 → 2025/26) — الصقها قبل إضافة الواجهة العربية
# المصدر: الأرشيف العام vaastav/Fantasy-Premier-League (بيانات FPL الرسمية لكل لاعب في كل جولة).
# المواسم المنتهية ما تتغير، فتُجلب مرة وحدة فقط وتُحفظ في data/fpl_<season>.json، وقائمتها في data/fpl_archive.json.
# قبل الحفظ نتحقق أن قوانين نقاط الموسم تعيد حساب نقاط FPL الرسمية لكل لاعب في كل جولة.
# ============================================================================
import csv as _csv, io as _io, collections as _collections

def _fpa_seasons(t=None):
    """المواسم المكتملة من 2022-23 لين الموسم اللي قبل الحالي (الموسم يبدأ في يوليو)، فالموسم المنتهي ينضاف تلقائياً."""
    t = t or datetime.datetime.now(datetime.timezone.utc)
    y = t.year if t.month >= 7 else t.year - 1
    return [f"{x}-{str(x + 1)[2:]}" for x in range(2022, y)]


FPL_ARCHIVE = _fpa_seasons()
FPL_ARCHIVE_RETRY_H = 20             # موسم ما نُشر بعد في الأرشيف: نحاول مرة كل 20 ساعة تقريباً بدل كل مزامنة
FPL_ARCHIVE_URL = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/{season}/{name}"
FPL_ARCHIVE_VER = 2                 # يتغير فقط إذا تغيرت طريقة التحويل (يعيد بناء الملفات)
FPL_SEASONS = []                    # يدخل في data/index.json → fpl.seasons
_FPL_NUM += [k for k in ["code"] if k not in _FPL_NUM]     # رقم اللاعب الثابت بين المواسم (لربط الموسم الحالي بالسابقة)
_FPA_HIST = ["round", "total_points", "value", "minutes", "expected_goals", "expected_assists", "bonus", "opponent_team", "was_home",
             "starts", "goals_scored", "assists", "clean_sheets", "goals_conceded", "saves", "yellow_cards", "red_cards", "own_goals",
             "penalties_missed", "penalties_saved", "bps", "expected_goals_conceded", "defensive_contribution", "fixture"]


def _fpa_num(v):
    if v is None or v == "" or v == "None":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return int(x) if x == int(x) and "." not in str(v) else x


def _fpa_rules(season):
    """قوانين نقاط الموسم: identifier → {نوع اللاعب: (كل كم, نقاط)}"""
    r = {"goals_scored": {1: (1, 6), 2: (1, 6), 3: (1, 5), 4: (1, 4)}, "assists": {t: (1, 3) for t in (1, 2, 3, 4)},
         "clean_sheets": {1: (1, 4), 2: (1, 4), 3: (1, 1)}, "goals_conceded": {1: (2, -1), 2: (2, -1)}, "saves": {1: (3, 1)},
         "penalties_saved": {1: (1, 5)}, "penalties_missed": {t: (1, -2) for t in (1, 2, 3, 4)},
         "yellow_cards": {t: (1, -1) for t in (1, 2, 3, 4)}, "red_cards": {t: (1, -3) for t in (1, 2, 3, 4)},
         "own_goals": {t: (1, -2) for t in (1, 2, 3, 4)}, "bonus": {t: (1, 1) for t in (1, 2, 3, 4)}}
    if season >= "2025-26":
        r["goals_scored"][1] = (1, 10)
        r["defensive_contribution"] = {2: (10, 2), 3: (12, 2), 4: (12, 2)}
    return r


def _fpa_score(h, t, R):
    m = h["minutes"] or 0
    p = 0 if m == 0 else (1 if m < 60 else 2)
    for ident, by in R.items():
        if t in by and h.get(ident) is not None:
            step, pts = by[t]
            p += int(h[ident] // step) * pts
    return p


def _fpa_build(season, get):
    """يبني ملف الموسم بنفس صيغة data/fpl.json. get(name) ترجع صفوف CSV (قائمة dict)."""
    teams, pr, fx, gw = get("teams.csv"), get("players_raw.csv"), get("fixtures.csv"), get("gws/merged_gw.csv")
    types = {int(p["id"]): int(p["element_type"]) for p in pr}
    pr = [p for p in pr if int(p["element_type"]) <= 4]                  # 2024-25: المدربون (Assistant Manager) ليسوا لاعبين
    cols = ["id", "wn", "fn", "sn", "tm", "ty", "st", "nw"] + _FPL_NUM
    rows = [[int(p["id"]), p["web_name"], p["first_name"], p["second_name"], int(p["team"]), int(p["element_type"]),
             p.get("status") or "a", p.get("news") or ""] + [_fpa_num(p.get(k)) for k in _FPL_NUM] for p in pr]
    keep = {r[0] for r in rows}
    hist, R, ok, bad = _collections.defaultdict(list), _fpa_rules(season), 0, 0
    for g in gw:
        e = int(g["element"])
        if e not in keep:
            continue
        h = {k: (_fpa_num(g.get(k)) if k != "was_home" else (1 if g.get("was_home") in ("True", "true", "1") else 0)) for k in _FPA_HIST}
        h["round"] = int(float(g["round"]))
        hist[str(e)].append([h[k] for k in _FPA_HIST])
        if _fpa_score(h, types[e], R) == h["total_points"]:
            ok += 1
        else:
            bad += 1
    for v in hist.values():
        v.sort(key=lambda x: (x[0], x[-1] or 0))
    # FPL published expected stats only from gameweek 16 of 2022-23: before that the CSV has 0 for everyone, which is missing, not zero
    im, ixs = _FPA_HIST.index("minutes"), [_FPA_HIST.index(k) for k in ("expected_goals", "expected_assists", "expected_goals_conceded")]
    pub = {r[0] for v in hist.values() for r in v if (r[im] or 0) > 0 and any((r[i] or 0) > 0 for i in ixs)}
    for v in hist.values():
        for r in v:
            if r[0] not in pub:
                for i in ixs:
                    r[i] = None
    ko = _collections.defaultdict(list)
    for f in fx:
        if f["event"]:
            ko[int(float(f["event"]))].append(f["kickoff_time"])
    events = []
    for e in sorted(ko):
        k0 = datetime.datetime.fromisoformat(min(ko[e]).replace("Z", "+00:00")) - datetime.timedelta(minutes=90)
        events.append(dict(id=e, name=f"Gameweek {e}", fin=True, cur=False, nxt=False, dl=k0.strftime("%Y-%m-%dT%H:%M:%SZ"), avg=None))
    fix = [[int(float(f["event"])), int(f["team_h"]), int(f["team_a"]), _fpa_num(f["team_h_difficulty"]), _fpa_num(f["team_a_difficulty"]),
            1 if f["finished"] == "True" else 0, _fpa_num(f["team_h_score"]), _fpa_num(f["team_a_score"]), f["kickoff_time"]]
           for f in fx if f["event"]]
    sc = {ident: {str(t): dict(kind="step", step=st, pts=float(pt), n=0) for t, (st, pt) in by.items()} for ident, by in R.items()}
    sc["minutes"] = {str(t): dict(kind="threshold", at=60, lo=1, hi=2, n=0) for t in (1, 2, 3, 4)}
    n_h = sum(len(v) for v in hist.values())
    audit = {k: sum(1 for v in hist.values() for r in v if r[i] is not None) for i, k in enumerate(_FPL_HIST_SHORT)}
    return dict(generated=f"{season} archive", archive=season, av=FPL_ARCHIVE_VER, source="vaastav/Fantasy-Premier-League",
                cols=cols, rows=rows,
                teams=[dict(id=int(t["id"]), n=t["name"], s=t["short_name"], st=_fpa_num(t.get("strength")), code=_fpa_num(t.get("code")))
                       for t in teams],
                events=events, fix=fix, hist=dict(hist), hcols=list(_FPL_HIST_SHORT), hv=FPL_HIST_VER, haudit=dict(rows=n_h, f=audit),
                rules=dict(squad=15, play=11, club=3, budget=1000, transfers_cap=20,
                           types={"1": dict(n="GKP", sel=2, mn=1, mx=1), "2": dict(n="DEF", sel=5, mn=3, mx=5),
                                  "3": dict(n="MID", sel=5, mn=2, mx=5), "4": dict(n="FWD", sel=3, mn=1, mx=3)}),
                scoring=sc, scoring_gw=None, postponed=sum(1 for f in fx if not f["event"]),
                check=dict(rows=ok + bad, reproduced=ok))


def _fpa_get(season):
    def get(name):
        url = FPL_ARCHIVE_URL.format(season=season, name=name)
        last = None
        for i in range(3):
            try:
                r = requests.get(url, timeout=60)
                if r.status_code == 200:
                    return list(_csv.DictReader(_io.StringIO(r.content.decode("utf-8", errors="replace"))))
                last = r.status_code
            except Exception as e:
                last = type(e).__name__
            time.sleep(5 * (i + 1))
        raise RuntimeError(f"{name}: {last}")
    return get


def sync_fpl_archive(hub):
    global FPL_SEASONS
    man = gh_get_json(hub, "data/fpl_archive.json") or {}
    have = {x["season"]: x for x in man.get("seasons", []) if x.get("av") == FPL_ARCHIVE_VER}
    tried, t_now = dict(man.get("tried") or {}), datetime.datetime.now(datetime.timezone.utc)
    added = dirty = False
    for s in FPL_ARCHIVE:
        if s in have:
            continue
        last = _parse_ts(tried.get(s))
        if last is not None and (t_now - last).total_seconds() < FPL_ARCHIVE_RETRY_H * 3600:
            continue
        try:
            d = _fpa_build(s, _fpa_get(s))
            chk = d["check"]
            if not chk["rows"] or chk["reproduced"] / chk["rows"] < 0.99:
                log(f"  [Fantasy archive] {s}: القوانين ما تطابق نقاط FPL ({chk}) — ما حفظته")
                continue
            gh_put(hub, f"data/fpl_{s}.json", json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
                   f"Add Fantasy season {s}")
            have[s] = dict(season=s, file=f"fpl_{s}.json", av=FPL_ARCHIVE_VER, rows=chk["rows"],
                           reproduced=round(chk["reproduced"] / chk["rows"] * 100, 2))
            added = True
            log(f"  [Fantasy archive] {s}: {chk['rows']} صف، القوانين تطابق {have[s]['reproduced']}% من نقاط FPL")
        except Exception as e:
            tried[s], dirty = now(), True
            log(f"  [Fantasy archive] تعذر جلب {s} ({type(e).__name__}: {e}) — نحاول بعد {FPL_ARCHIVE_RETRY_H} ساعة")
    FPL_SEASONS = [have[s] for s in FPL_ARCHIVE if s in have]
    tried = {k: v for k, v in tried.items() if k not in have}
    if added or dirty:
        gh_put(hub, "data/fpl_archive.json", json.dumps(dict(seasons=FPL_SEASONS, tried=tried), ensure_ascii=False).encode("utf-8"),
               "Update Fantasy archive list")


_orig_run_pipeline_fpa = run_pipeline


def run_pipeline(hub, pit_key):
    try:
        sync_fpl_archive(hub)
    except Exception as e:      # أي خطأ في الأرشيف ما يوقف بقية المزامنة
        log(f"  [Fantasy archive] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    return _orig_run_pipeline_fpa(hub, pit_key)


_orig_gh_put_fpa = gh_put


def gh_put(hub, path, content, message):
    if path == "data/index.json" and FPL_INDEX and FPL_SEASONS:
        FPL_INDEX["seasons"] = FPL_SEASONS      # إضافة Fantasy تكتب FPL_INDEX في الفهرس
    return _orig_gh_put_fpa(hub, path, content, message)


# ---------------- الواجهة: اختيار الموسم في صفحة الفانتازي ----------------
_X_SEASONJS = r"""/* ===== Fantasy seasons: the current season (live) or an archived season (2022-23 → 2025-26) ===== */
const FPS={cur:'',cache:{}};
const FPS_ARCH_TABS=new Set(['table','scatter','value','compare','teams','fixtures','backtest']);
const fpsList=()=>((ALL&&ALL.fpl&&ALL.fpl.seasons)||[]);
const fpsLabel=s=>s.replace('-','/');
const fpsTabOk=t=>!(FPD&&FPD.archive)||FPS_ARCH_TABS.has(t[0]);
async function fpsLoad(s){
 const m=fpsList().find(x=>x.season===s);if(!m)throw new Error('season '+s+' is not in the data');
 if(FPD&&FPK==='arch:'+s)return FPD;
 let d=FPS.cache[s];
 if(!d){const r=await fetch('data/'+m.file+'?v='+encodeURIComponent(m.av||''));if(!r.ok)throw new Error(m.file+' (HTTP '+r.status+')');d=await r.json();
  d.T=new Map(d.teams.map(t=>[t.id,t]));
  d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=d.T.get(o.tm)||{};
   o.tn=t.s||'?';o.tf=t.n||'?';o.pos=o.ty;o.name=o.wn;o.price=fpOk(o.now_cost)?o.now_cost/10:null;o.chg=fpOk(o.cost_change_start)?o.cost_change_start/10:null;return o});
  d.PB=new Map(d.P.map(p=>[p.id,p]));d.archive=s;FPS.cache[s]=d}
 FPD=d;FPK='arch:'+s;FPLINK=null;return d;
}
function fpsSet(v){
 FPS.cur=v;FP.sel=[];FP.pdet=null;FPBEST={};OX.cache={};OX.bt=null;BT.res=null;BT.line=null;
 if(v&&!FPS_ARCH_TABS.has(FP.tab))FP.tab='table';
 R.fantasy($('#app'));
}
function fpsSel(){
 const L=fpsList();if(!L.length)return '';
 return `<div class="ctl" style="margin-bottom:6px"><select onchange="fpsSet(this.value)" aria-label="Season">${fpOpts([['','Current season'],...[...L].reverse().map(x=>[x.season,'Season '+fpsLabel(x.season)])],FPS.cur)}</select></div>`;
}
function fpsHead(d){
 const m=fpsList().find(x=>x.season===d.archive)||{};
 return `<div class="mu" style="margin-bottom:8px">Archived season ${esc(fpsLabel(d.archive))}: official FPL data per player and gameweek from the public vaastav/Fantasy-Premier-League archive (prices, status and totals as at the end of that season). The season's scoring rules reproduce FPL's own points for ${m.reproduced!=null?esc(m.reproduced)+'%':'N/A'} of ${m.rows!=null?esc(m.rows):'N/A'} player-gameweeks. The Backtest tab replays the whole season with today's model, using only earlier gameweeks for each prediction. The Optimal XI, My XI, Forecast and prediction tabs belong to the current season.</div><div id="fpmsg" class="mu" style="min-height:18px"></div>`;
}
function fpsNoLink(){FPLINK={key:'arch:'+FPD.archive,map:new Map(),on:false,n:0,tot:0};FPD.P.forEach(p=>{p.px=null});return FPLINK}
"""

_AR_SEASON = {
    "Current season": "الموسم الحالي", "Season #/#": "موسم #/#", "Season": "الموسم",
    "## archive": "أرشيف ##",
    "Archived season #/#: official FPL data per player and gameweek from the public vaastav/Fantasy-Premier-League archive (prices, status and totals as at the end of that season). The season's scoring rules reproduce FPL's own points for #% of # player-gameweeks. The Backtest tab replays the whole season with today's model, using only earlier gameweeks for each prediction. The Optimal XI, My XI, Forecast and prediction tabs belong to the current season": "موسم مؤرشف #/#: بيانات FPL الرسمية لكل لاعب في كل جولة من الأرشيف العام vaastav/Fantasy-Premier-League (الأسعار والحالة والمجاميع كما كانت في نهاية الموسم). قوانين نقاط ذاك الموسم تعيد حساب نقاط FPL نفسها في #% من # (لاعب × جولة). تبويب الاختبار التاريخي يعيد الموسم كاملاً بموديل اليوم، وكل توقع يستخدم الجولات السابقة فقط. تبويبات التشكيلة المثالية وتشكيلتي والتوقعات تخص الموسم الحالي",
}


def _x_season_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (المواسم): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "async function fpLoad(){\n const m=ALL.fpl;", "async function fpLoad(){\n if(FPS.cur)return fpsLoad(FPS.cur);\n const m=ALL.fpl;")
    h = sub(h, "function fpLink(){\n", "function fpLink(){\n if(FPD&&FPD.archive)return fpsNoLink();\n")
    h = sub(h, "function fpHeader(d){\n", "function fpHeader(d){\n if(d.archive)return fpsSel()+fpsHead(d);\n")
    h = sub(h, " return `<div class=\"mu\" style=\"margin-bottom:8px\">Official Fantasy Premier League data, as of ",
            " return fpsSel()+`<div class=\"mu\" style=\"margin-bottom:8px\">Official Fantasy Premier League data, as of ")
    h = sub(h, "function fpRender(){\n const d=FPD,T=[", "function fpRender(){\n if(FPD&&FPD.archive&&!fpsTabOk([FP.tab]))FP.tab='table';\n const d=FPD,T=[")
    h = sub(h, "$('#fproot').innerHTML=`<div class=\"ctl\">${T.map(", "$('#fproot').innerHTML=`<div class=\"ctl\">${T.filter(fpsTabOk).map(")
    h = sub(h, "async function route(){", _X_SEASONJS + "\nasync function route(){")
    return h


INDEX = _x_season_index(INDEX)
# ======================== نهاية إضافة مواسم الفانتازي ========================


# ============================================================================
# إضافة: مؤشر "الزجاج السائل" (Liquid Glass) للقائمة العلوية فقط (#nav) — الصقها قبل إضافة الواجهة العربية
# عنصر واحد شفاف خلف الرابط المختار، ينزلق للرابط الجديد ويتمدد قليلاً أثناء الحركة ثم يرجع لشكله.
# الحركة بـ transform فقط (خفيفة على الجوال)، وتتوقف إذا الجهاز مفعّل فيه "تقليل الحركة".
# ============================================================================
_X_LGLCSS = ("#nav{position:relative}#nav.lg a{position:relative;z-index:1}#nav.lg a.on{background:transparent;box-shadow:none}"
             # كبسولة زجاجية مثل Apple Liquid Glass: تعبئة مصقولة شبه شفافة، حافة لامعة، لمعة علوية ناعمة، وظل خفيف
             "#nav .lgl{position:absolute;left:0;top:0;width:0;height:0;border-radius:999px;pointer-events:none;z-index:0;opacity:0;"
             "transform-origin:0 50%;will-change:transform;"
             "background:linear-gradient(180deg,rgba(255,255,255,.17),rgba(255,255,255,.08) 60%,rgba(255,255,255,.11));"
             "-webkit-backdrop-filter:blur(14px) saturate(180%);backdrop-filter:blur(14px) saturate(180%);"
             "box-shadow:inset 0 0 0 1px rgba(255,255,255,.16),inset 0 1.5px 1px rgba(255,255,255,.42),inset 0 -1.5px 1px rgba(255,255,255,.14),"
             "inset 0 -8px 14px rgba(255,255,255,.05),0 4px 14px rgba(0,0,0,.32)}"
             "#nav .lgl::after{content:\"\";position:absolute;inset:0;border-radius:inherit;"
             "background:radial-gradient(120% 70% at 30% 0%,rgba(255,255,255,.28),rgba(255,255,255,0) 60%)}")

_X_LGLJS = r"""/* ===== Liquid Glass indicator: top navigation (#nav) only ===== */
const LGL={el:null,x:null,w:null,anim:null,q:false};
function lglPlace(animate){
 const nav=document.getElementById('nav');if(!nav)return;
 let g=LGL.el;if(!g){g=LGL.el=document.createElement('div');g.className='lgl';g.setAttribute('aria-hidden','true')}
 if(g.parentNode!==nav)nav.insertBefore(g,nav.firstChild);
 nav.classList.add('lg');
 const a=nav.querySelector('a.on');if(!a){g.style.opacity='0';return}
 const x=a.offsetLeft,w=a.offsetWidth;g.style.opacity='1';g.style.top=a.offsetTop+'px';g.style.height=a.offsetHeight+'px';
 if(x===LGL.x&&w===LGL.w)return;
 const end='translateX('+x+'px) scaleX(1)',x0=LGL.x,w0=LGL.w;
 g.style.width=w+'px';if(LGL.anim)LGL.anim.cancel();
 if(animate&&x0!=null&&g.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  /* liquid stretch: halfway, the glass is wider (more for a longer trip) and a little flatter, centred between the two tabs */
  const d=Math.abs(x-x0),mw=(w0+w)/2*(1+Math.min(.18,d/1500)),mc=(x0+w0/2+x+w/2)/2;
  LGL.anim=g.animate([{transform:'translateX('+x0+'px) scaleX('+(w0/w)+')'},
   {transform:'translateX('+(mc-mw/2)+'px) scaleX('+(mw/w)+') scaleY(.93)',offset:.55},{transform:end}],
   {duration:Math.min(640,360+d*.35),easing:'cubic-bezier(.3,.7,.2,1)'});
 }
 g.style.transform=end;LGL.x=x;LGL.w=w;
}
/* the menu is redrawn on every page change: measure once per frame, after any text change (e.g. Arabic) has been applied */
const lglKick=()=>{if(LGL.q)return;LGL.q=true;requestAnimationFrame(()=>{LGL.q=false;lglPlace(true)})};
(function(){const nav=document.getElementById('nav');if(!nav)return;
 new MutationObserver(lglKick).observe(nav,{childList:true,subtree:true,characterData:true});
 if(window.ResizeObserver)new ResizeObserver(()=>lglPlace(false)).observe(nav);})();
"""


def _x_lgl_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (Liquid Glass): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_LGLCSS + "</style></head>")
    h = sub(h, "async function route(){", _X_LGLJS + "\nasync function route(){")
    return h


INDEX = _x_lgl_index(INDEX)
# ======================== نهاية إضافة Liquid Glass ========================


# ============================================================================
# إضافة: نموذج التوقع v2 — نموذج وقت اللعب المدرَّب على أرشيف المواسم (2022/23 → 2025/26)
# التدريب على 2022/23 + 2023/24، التحقق على 2024/25، والاختبار مرة وحدة على 2025/26 (خطأ 1.845 → 1.716، أفضل في 35 من 35 جولة).
# التفاصيل والأرقام: ml/RESULTS.md. التعديل في احتمال المشاركة ونسبة 60+ دقيقة والدقائق فقط؛ باقي النموذج كما هو.
# ============================================================================
_X_PM2_CONST = ("const PM={N:7,PRIOR_MIN:450,K_FIN:3,N0:4,RECENT:6,EPS:.001,MAXNODES:4000,\n"
                " /* v2 playing time (trained on the 2022-23 and 2023-24 archive, validated on 2024-25, tested on 2025-26):\n"
                "    P(play) = (sum w*played + PL_A*PL_MU)/(sum w + PL_A), w = PL_LAM^age over all earlier matches of the season (age 0 = latest),\n"
                "    i.e. recency weighting with a Beta prior, so a player who played every recent match gets about 0.90, not 1.00.\n"
                "    The 60+ share and the minutes when playing are weighted Q_LAM^age over his appearances. PT:0 restores v1. */\n"
                " PT:1,PL_LAM:.5,PL_A:.5,PL_MU:.5,Q_LAM:.8};\nconst PM_VERSION='v2';")
_X_PM2_PT = (" let pPlay0=fit?1:pl.length/rec.length,p60n=rec.filter(r=>r[3]>=60).length,q60=p60n/pl.length,ePlay=pl.reduce((s,r)=>s+r[3],0)/pl.length;\n"
             " /* v2: a flagged (not 'a') player uses only his appearances while fit, so pPlay0 is his residual rotation risk and the\n"
             "    published availability multiplies it as before (the injury is not counted twice) */\n"
             " if(PM.PT){const all=fit?rows.filter(r=>r[3]>0):rows;let sw=0,sy=0,qa=0,q6=0,qm=0;\n"
             "  for(let i=all.length-1,k=0;i>=0;i--,k++){const r=all[i],w=Math.pow(PM.PL_LAM,k),v=Math.pow(PM.Q_LAM,k);sw+=w;if(r[3]>0){sy+=w;qa+=v;qm+=v*r[3];if(r[3]>=60)q6+=v}}\n"
             "  pPlay0=(sy+PM.PL_A*PM.PL_MU)/(sw+PM.PL_A);q60=q6/qa;ePlay=qm/qa}")


def _x_pm2_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (نموذج v2): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "const PM={N:7,PRIOR_MIN:450,K_FIN:3,N0:4,RECENT:6,EPS:.001,MAXNODES:4000};", _X_PM2_CONST)
    h = sub(h, " const pPlay0=fit?1:pl.length/rec.length,p60n=rec.filter(r=>r[3]>=60).length,q60=p60n/pl.length,ePlay=pl.reduce((s,r)=>s+r[3],0)/pl.length;", _X_PM2_PT)
    h = sub(h, " out.rates={lamG,lamA,xg90,xa90,finG:fg,finA:fa_,R,pPlay0,q60,ePlay,e60,recN:rec.length,fit};",
            " out.rates={lamG,lamA,xg90,xa90,finG:fg,finA:fa_,R,pPlay0,q60,ePlay,e60,recN:PM.PT?(fit?rows.filter(r=>r[3]>0).length:rows.length):rec.length,fit};")
    h = sub(h, "Playing time: ${r.fit?'recent appearances while fit':'last '+r.recN+' matches'};",
            "Playing time: ${r.fit?'recent appearances while fit':PM.PT?'all '+r.recN+' matches this season, recent ones weighted most':'last '+r.recN+' matches'};")
    h = sub(h, "Model tested: <b>v1 = the model used in Predicted Points</b>, unchanged.",
            "Model tested: <b>v2 = the model used in Predicted Points</b> (playing-time model trained on archived seasons).")
    h = sub(h, "No model version other than v1 exists yet, and the model has not been tuned on these results, so nothing here is an in-sample fit.",
            "Model v2's five playing-time parameters were tuned on the 2022-23 and 2023-24 seasons, so replays of those two archived seasons are partly in-sample; 2024-25 was the validation season and 2025-26 the untouched test season (error 1.845 → 1.716 against v1).")
    h = sub(h, "sr('Model v1',S.pred,false)", "sr('Model '+PM_VERSION,S.pred,false)")
    h = sub(h, "[['Model v1',mm.n,", "[['Model '+PM_VERSION,mm.n,")
    h = sub(h, "[['Model (v1)','pred']", "[['Model ('+PM_VERSION+')','pred']")
    return h


_AR_SEASON.update({
    "Model # (default)": "النموذج # (الافتراضي)", "Model # + penalty regression": "النموذج # + ضبط ركلات الجزاء",
    "Model #": "النموذج #", "model #": "النموذج #", "model # + penalty regression": "النموذج # + ضبط ركلات الجزاء",
    "Model (#)": "النموذج (#)", "Model tested:": "النموذج المختبر:",
    "v# = the model used in Predicted Points": "v# = النموذج المستخدم في النقاط المتوقعة",
    "(playing-time model trained on archived seasons)": "(نموذج وقت اللعب المدرَّب على المواسم المؤرشفة)",
    "Model v#'s five playing-time parameters were tuned on the ## and ## seasons, so replays of those two archived seasons are partly in-sample": "معاملات وقت اللعب الخمسة في النموذج v# ضُبطت على موسمي ## و##، فإعادة هذين الموسمين داخل العينة جزئياً",
    "## was the validation season and ## the untouched test season (error # → # against v#)": "## موسم التحقق و## موسم الاختبار اللي ما لُمس (الخطأ # ← # مقارنة بـ v#)",
    "Points range calibration and the penalty-regression option": "معايرة نطاق النقاط وخيار ضبط ركلات الجزاء",
    "Penalty regression vs base model": "ضبط ركلات الجزاء مقابل النموذج الأساسي", "MAE base": "MAE الأساسي",
    "MAE with penalty regression": "MAE مع ضبط ركلات الجزاء",
    "Only where the option changes the prediction (penalty takers)": "فقط حيث يغيّر الخيار التوقع (منفذو ركلات الجزاء)",
    "all # matches this season, recent ones weighted most": "كل الـ# مباريات هذا الموسم، والأحدث لها وزن أكبر",
    "recent appearances while fit": "المشاركات الأخيرة وهو جاهز", "last # matches": "آخر # مباريات",
})


INDEX = _x_pm2_index(INDEX)
# ======================== نهاية إضافة نموذج v2 ========================


# ============================================================================
# إضافة: مراجعة الموسم — النموذج يدير فريقاً طوال الموسم (بدون تسريب بيانات) ويقارنه بأفضل تشكيلة لكل جولة بأثر رجعي
# القائمة تُبنى قبل الجولة 6 من بيانات الجولات 1–5 فقط. نسختان: القائمة ثابتة طوال الموسم، أو انتقال مجاني واحد كل جولة.
# نتائج المواسم المؤرشفة محسوبة مسبقاً في data/fpl_review.json (نفس الكود)؛ إذا تغير النموذج تنحسب على جهاز الزائر.
# ============================================================================
_X_SRJS = r"""/* ===== Season review: the model manages a team through the season (leak-free), against the best possible XI of each gameweek =====
   The squad of 15 is picked before gameweek SR_FROM with the data of the earlier gameweeks only, within the FPL budget, by the same
   exact squad optimizer as Optimal XI, valued on the expected points of the next SR_HZ gameweeks. Each later gameweek the model sees
   only rows of earlier gameweeks (as in Backtest) and picks its XI, captain and vice from the 15. FPL's automatic substitutions and
   vice-captaincy are applied to the real minutes. Two versions: the squad is kept all season, or 1 free transfer a gameweek is used
   (banked up to the season's limit, no points hits, no chips). The best XI of each gameweek in hindsight is the best starting XI by
   real points of any squad of 15 within the budget at that gameweek's prices. */
const SR={res:{},busy:false,msg:'',view:'fixed',open:false};
const SR_FROM=6,SR_HZ=6,SR_TH=1,SR_FT_CAP={'2022-23':2,'2023-24':2};
const srFtCap=d=>SR_FT_CAP[d.archive||'']||(d.rules&&fpOk(d.rules.transfers_cap)&&d.rules.transfers_cap<=5?d.rules.transfers_cap:5);
/* gameweek r with a horizon: fixtures of rounds r … r+hz−1 are unplayed, everything the model sees is from rounds before r */
function srRound(d,H,ix,fixAll,r,hz){
 const last=r+hz-1,ev=d.events.filter(e=>e.id<=last).map(e=>Object.assign({},e,{fin:e.id<r,cur:false,nxt:e.id===r}));
 const fixR=fixAll.filter(x=>x[0]===r),fix=fixAll.filter(x=>x[0]<r).concat(fixAll.filter(x=>x[0]>=r&&x[0]<=last).map(x=>{const y=x.slice();y[5]=0;y[6]=null;y[7]=null;return y}));
 const sh=[],tg=[],Hp={},club=new Map(),plays=t=>fixR.some(x=>x[1]===t||x[2]===t);
 for(const p of d.P){const rows=H[String(p.id)];if(!rows)continue;
  const rr=rows.filter(x=>x[0]===r),prior=rows.filter(x=>x[0]<r),lx=prior[prior.length-1];
  /* no row this gameweek: his club from his last match; he is still in the game only if that club has no fixture (a blank gameweek) */
  const tm=rr.length?btTeamAt(p,rr,fixR,ix):lx?btTeamAt(p,[lx],fixAll.filter(x=>x[0]===lx[0]),ix):p.tm,blank=!rr.length&&lx&&!plays(tm);
  const o={id:p.id,ty:p.ty,tm,st:'a',nw:'',chance_of_playing_next_round:null,name:p.name};
  for(const [pf,hc] of BT_MAP)o[pf]=btSum(prior,ix[hc]);btXgScale(o,prior,ix);
  Hp[String(p.id)]=prior;sh.push(o);club.set(p.id,tm);if(rr.length||blank)tg.push({p,o,rr:rr.length?rr:[lx],blank})}
 const dd=Object.assign({},d,{events:ev,fix,P:sh,hist:Hp});delete dd._pm;delete dd._pmPred;
 const C=pmCtx(dd),out=new Map();
 for(const t of tg){const m=pmPlayer(t.o,C,dd),pv=t.rr[t.rr.length-1][ix.val],gw=C.gws.map(g=>{const x=m.q==='nodata'?null:m.gws.find(y=>y.ev===g);return x?x.pts:0});
  out.set(t.p.id,{id:t.p.id,t:t.p.ty,club:t.o.tm,c:fpOk(pv)?pv:null,pred:gw,act:t.blank?0:btSum(t.rr,ix.pts)||0,min:t.blank?0:btSum(t.rr,ix.min)||0})}
 return {r,gws:C.gws,P:out,club};
}
/* best XI of a squad for one gameweek's values; captain = highest, vice = second (oxTeam) */
function srXI(sq,val,RU,forms){const it=sq.map(x=>({id:x.id,t:x.t,c:x.c||0,club:x.club,v:val(x)}));const b=oxSolveXI(it,RU,forms).best;return b?b.team:null}
/* FPL automatic substitutions: a starter with no minutes is replaced by the first bench player (in order) who played and keeps the formation legal */
function srAuto(xi,bench,minOf,RU){
 const out=xi.map(i=>i.id),cnt={1:0,2:0,3:0,4:0},ty=new Map();xi.concat(bench).forEach(i=>ty.set(i.id,i.t));
 out.forEach(id=>cnt[ty.get(id)]++);const used=new Set(),subs=[];
 for(let k=0;k<out.length;k++){const id=out[k];if(minOf(id)>0)continue;const t=ty.get(id);
  for(const b of bench){if(used.has(b.id)||!(minOf(b.id)>0))continue;
   if(t===1?b.t!==1:b.t===1)continue;const c={...cnt};c[t]--;c[b.t]++;
   if(b.t!==1&&[2,3,4].some(q=>c[q]<RU.T[q].mn))continue;
   out[k]=b.id;used.add(b.id);cnt[t]--;cnt[b.t]++;subs.push([id,b.id]);break}}
 return {ids:out,subs};
}
function srSell(h,now){return now==null?h.buy:now>h.buy?h.buy+Math.floor((now-h.buy)/2):now}
/* the value of a squad over the horizon: sum over gameweeks of its best XI incl. captain */
function srVal(sq,RU,forms,hz){let s=0;for(let k=0;k<hz;k++){const t=srXI(sq,x=>x.pred[k]||0,RU,forms);s+=t?t.total:0}return s}
async function srRun(d,onP){
 const ix=btIx(d);for(const k of ['r','pts','min','opp','h','val'])if(ix[k]===undefined)throw new Error('the stored match history has no "'+k+'" column');
 const RU=pmRules(d);if(!RU||RU.club==null||RU.budget==null)throw new Error('the game rules (budget, club limit, positions) are missing from the data');
 const forms=pmForms(RU),H={};Object.keys(d.hist||{}).forEach(k=>{H[k]=d.hist[k].slice().sort((a,b)=>a[0]-b[0])});
 const fixAll=d.fix.filter(x=>x[0]),rounds=d.events.filter(e=>e.fin&&e.id>=SR_FROM).map(e=>e.id).sort((a,b)=>a-b);
 if(!rounds.length)throw new Error('the season review needs gameweek '+SR_FROM+' or later to be finished');
 const cap=srFtCap(d),name=id=>{const p=d.PB.get(id);return p?p.name:'#'+id};
 /* squad: before gameweek SR_FROM, expected points of the next SR_HZ gameweeks, prices of gameweek SR_FROM */
 const R0=srRound(d,H,ix,fixAll,rounds[0],SR_HZ),pool=[...R0.P.values()].filter(x=>x.c!=null).map(x=>({id:x.id,t:x.t,c:x.c,club:x.club,v:x.pred.reduce((a,b)=>a+b,0)}));
 const m=pmMode1(pool,RU,forms);if(!m.best)throw new Error('no squad of 15 within the budget could be built');
 const b0=m.best.team,ids0=b0.xi.map(i=>i.id).concat(b0.bench.map(i=>i.id)),cost0=ids0.reduce((s,id)=>s+R0.P.get(id).c,0);
 const V={fixed:{hold:ids0.map(id=>({id,buy:R0.P.get(id).c})),bank:RU.budget-cost0,ft:0,rows:[]},ft:{hold:ids0.map(id=>({id,buy:R0.P.get(id).c})),bank:RU.budget-cost0,ft:0,rows:[]}};
 const opt=[],last={};
 for(const r of rounds){
  const Rr=r===rounds[0]?R0:srRound(d,H,ix,fixAll,r,SR_HZ),P=Rr.P;
  P.forEach((x,id)=>{if(x.c!=null)last[id]=x.c});
  const sqOf=hold=>hold.map(h=>P.get(h.id)||{id:h.id,t:d.PB.get(h.id)?d.PB.get(h.id).ty:4,club:Rr.club.get(h.id)??null,c:last[h.id]??null,pred:Rr.gws.map(()=>0),act:0,min:0,gone:true});
  /* free transfers: before every gameweek after the first, +1 free transfer (banked up to the limit); each transfer is the best single
     swap by the squad's expected points over the horizon, made only if it gains at least SR_TH point (any gain when the bank is full) */
  const S=V.ft;let made=[];
  if(r!==rounds[0]){S.ft=Math.min(cap,S.ft+1);
   while(S.ft>0){const sq=sqOf(S.hold),base=srVal(sq,RU,forms,Rr.gws.length),cc=new Map();sq.forEach(x=>{if(x.club!=null)cc.set(x.club,(cc.get(x.club)||0)+1)});
    const own=new Set(S.hold.map(h=>h.id)),hz=x=>x.pred.reduce((a,b)=>a+b,0),cand=[];
    sq.forEach((o,k)=>{const sell=srSell(S.hold[k],o.c),money=S.bank+sell;
     P.forEach(x=>{if(own.has(x.id)||x.t!==o.t||x.c==null||x.c>money)return;if(x.club!==o.club&&(cc.get(x.club)||0)>=RU.club)return;cand.push({k,o,x,g:hz(x)-hz(o),sell})})});
    cand.sort((a,b)=>b.g-a.g||a.x.id-b.x.id);let best=null;
    for(const c of cand.slice(0,40)){const sq2=sq.slice();sq2[c.k]=c.x;const g=srVal(sq2,RU,forms,Rr.gws.length)-base;if(!best||g>best.g+1e-9)best={...c,g}}
    if(!best||best.g<(S.ft>=cap?1e-9:SR_TH))break;
    S.bank+=best.sell-best.x.c;S.hold[best.k]={id:best.x.id,buy:best.x.c};S.ft--;made.push({out:best.o.id,in:best.x.id,g:Math.round(best.g*1000)/1000})}}
  for(const key of ['fixed','ft']){const Z=V[key],sq=sqOf(Z.hold),t=srXI(sq,x=>x.pred[0]||0,RU,forms);if(!t){Z.rows.push({r,err:true});continue}
   const xiS=new Set(t.xi.map(i=>i.id)),bench=sq.filter(x=>!xiS.has(x.id)).sort((a,b)=>(a.t===1)-(b.t===1)||(b.pred[0]||0)-(a.pred[0]||0)||a.id-b.id);
   const minOf=id=>(P.get(id)||{min:0}).min,actOf=id=>(P.get(id)||{act:0}).act,au=srAuto(t.xi,bench,minOf,RU);
   const capId=minOf(t.cap.id)>0?t.cap.id:(t.vice&&minOf(t.vice.id)>0?t.vice.id:null);
   const act=au.ids.reduce((s,id)=>s+actOf(id),0)+(capId!=null?actOf(capId):0);
   Z.rows.push({r,exp:t.total,act,xi:t.xi.map(i=>i.id),cap:t.cap.id,vice:t.vice?t.vice.id:null,capUsed:capId,subs:au.subs,form:t.form.name,tr:key==='ft'?made:[],ft:key==='ft'?Z.ft:null,
    value:sq.reduce((s,x)=>s+(x.c||0),0),bank:Z.bank})}
  /* best XI in hindsight: real points, any squad of 15 within the budget at this gameweek's prices */
  const op=pmMode1([...P.values()].filter(x=>x.c!=null).map(x=>({id:x.id,t:x.t,c:x.c,club:x.club,v:x.act})),RU,forms).best;
  opt.push(op?{r,pts:op.team.total,xi:op.team.xi.map(i=>i.id),cap:op.team.cap.id,form:op.form.name}:{r,pts:null});
  if(onP)onP(r,rounds[rounds.length-1]);await oxYield();
 }
 return {season:d.archive||'',ver:PM_VERSION,av:d.av||null,from:rounds[0],to:rounds[rounds.length-1],cap,budget:RU.budget,squad:ids0.map(id=>({id,c:R0.P.get(id).c,t:R0.P.get(id).t,v:R0.P.get(id).pred.reduce((a,b)=>a+b,0),xi:b0.xi.some(i=>i.id===id)})),
  cost0,fixed:V.fixed.rows,ft:V.ft.rows,opt,hz:SR_HZ};
}
/* ---------- Season review tab ---------- */
const SR_VER='sr1',SR_COL={act:'#3987e5',exp:'#d95926',opt:'#199e70',dlt:'#8a9bb0'};
const srKey=d=>(d.archive||'live:'+d.generated)+'|'+PM_VERSION+'|'+SR_VER;
async function srStored(d){
 if(!d.archive)return null;
 if(SR.file===undefined){try{const r=await fetch('data/fpl_review.json?v='+encodeURIComponent(SR_VER));SR.file=r.ok?await r.json():null}catch(e){SR.file=null}}
 const R=SR.file&&SR.file.seasons&&SR.file.seasons[d.archive];return R&&R.ver===PM_VERSION&&R.av===(d.av||null)&&SR.file.sr===SR_VER?R:null;
}
function fpTReview(el){
 const d=FPD,k=srKey(d);
 el.innerHTML=`<div class="card mu" style="font-size:12px"><b>How this works.</b> Before gameweek ${SR_FROM} the model picks its squad of 15 within the £${((d.rules&&d.rules.budget)||1000)/10}m budget using only gameweeks 1–${SR_FROM-1} (the same squad optimizer as Optimal XI, valued on the expected points of the next ${SR_HZ} gameweeks). In every later gameweek it sees only earlier gameweeks, as in Backtest, and picks its XI, captain and vice-captain from the squad; FPL's automatic substitutions and the vice-captain rule are applied to the real minutes. <b>Expected</b> = the model's projection for the XI it picked (captain doubled), <b>Actual</b> = the points that XI really scored, <b>Δ</b> = actual − expected. <b>Best XI in hindsight</b> = the highest-scoring starting XI (captain doubled) of any squad of 15 within the budget at that gameweek's prices, a ceiling no manager reaches. Prices are FPL's prices of each gameweek; chips and points hits are not used.</div>
 <div class="ctl"><select id="srv" aria-label="Version">${fpOpts([['fixed','Squad kept all season (no transfers)'],['ft','1 free transfer a week']],SR.view)}</select><label style="display:inline-flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="sro" ${SR.open?'checked':''}> Best XI in hindsight on the chart</label></div><div id="srout"><div class="empty">Loading…</div></div>`;
 $('#srv').onchange=()=>{SR.view=$('#srv').value;srDraw()};$('#sro').onchange=()=>{SR.open=$('#sro').checked;srDraw()};
 if(SR.res[k])return srDraw();
 srStored(d).then(R=>{if(R){SR.res[k]=R;srDraw()}else srAsk()});
}
function srAsk(){const o=$('#srout');if(!o)return;o.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:6px">The review replays the season on this device (a few seconds on a laptop, longer on a phone).</div><div class="ctl"><button onclick="srGo()" ${SR.busy?'disabled':''}>Run the season review</button></div><div id="srmsg" class="mu"></div>`}
async function srGo(){
 if(SR.busy)return;SR.busy=true;const d=FPD,k=srKey(d);srAsk();
 try{SR.res[k]=await srRun(d,(r,to)=>{const m=$('#srmsg');if(m)m.textContent='Replaying gameweek '+r+' of '+to+'… (no future data is used)'})}
 catch(e){SR.busy=false;const m=$('#srmsg');if(m)m.textContent='Could not run the season review: '+e.message;return}
 SR.busy=false;if(FPD===d&&FP.tab==='review')srDraw();
}
function srDraw(){
 const o=$('#srout'),d=FPD,R=SR.res[srKey(d)];if(!o||!R)return;
 const rows=R[SR.view].filter(x=>!x.err),om=new Map(R.opt.map(x=>[x.r,x])),nm=id=>{const p=d.PB.get(id);return p?p.name:'#'+id},tn=id=>{const p=d.PB.get(id);return p?p.tn:''};
 const sum=(L,f)=>L.reduce((s,x)=>s+(f(x)||0),0),A=sum(rows,x=>x.act),E=sum(rows,x=>x.exp),O=sum(rows,x=>{const q=om.get(x.r);return q&&q.pts}),f1=x=>x.toFixed(1);
 const alt=R[SR.view==='fixed'?'ft':'fixed'].filter(x=>!x.err),altA=sum(alt,x=>x.act),nT=sum(rows,x=>x.tr?x.tr.length:0);
 const gws=rows.map(x=>x.r),S=[{n:'Actual points',short:'Actual',v:rows.map(x=>x.act),c:SR_COL.act,dash:''},{n:'Expected points',short:'Expected',v:rows.map(x=>x.exp),c:SR_COL.exp,dash:'7 4'}].concat(SR.open?[{n:'Best XI in hindsight',short:'Best XI',v:rows.map(x=>{const q=om.get(x.r);return q?q.pts:null}),c:SR_COL.opt,dash:'2 3'}]:[]);
 const dl=rows.map(x=>x.act-x.exp);
 o.innerHTML=`<div class="grid"><div class="kpi"><b>${A}</b><span>Actual points, GW${R.from}–${R.to} (${SR.view==='fixed'?'squad kept':'with '+nT+' free transfer'+(nT===1?'':'s')})</span></div><div class="kpi"><b>${f1(E)}</b><span>Expected by the model for the XIs it picked</span></div><div class="kpi"><b>${(A-E>=0?'+':'')+f1(A-E)}</b><span>Actual − expected over the season (${f1((A-E)/rows.length)} a gameweek)</span></div><div class="kpi"><b>${O}</b><span>Best XI in hindsight, every gameweek (the team reached ${O?Math.round(A/O*100):0}% of it)</span></div><div class="kpi"><b>${altA}</b><span>${SR.view==='fixed'?'With 1 free transfer a week':'Squad kept all season'} (${(altA-A>=0?'+':'')+(altA-A)} points)</span></div></div>
 <div class="ctl" style="margin:10px 0 2px;font-size:13px;gap:14px">${S.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg>${esc(s.n)}</span>`).join('')}<span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="${SR_COL.dlt}" fill-opacity=".55"/></svg>Δ actual − expected</span></div>
 ${srChart('srch',gws,S,dl,Math.round(Math.max(340,Math.min(680,o.clientWidth||680))))}
 <h3>Squad picked before GW${R.from}</h3><div class="mu" style="font-size:12px;margin-bottom:6px">£${(R.cost0/10).toFixed(1)}m of £${(R.budget/10).toFixed(1)}m, chosen with gameweeks 1–${R.from-1} only. Expected points of GW${R.from}–${R.from+R.hz-1} as the model saw them then.</div>
 ${tbl([['Player'],['Team'],['Pos'],['Price',1],['Expected GW'+R.from+'–'+(R.from+R.hz-1),1]],[...R.squad].sort((a,b)=>b.xi-a.xi||a.t-b.t||b.v-a.v).map(x=>[esc(nm(x.id))+(x.xi?'':' <span class="mu">(bench)</span>'),esc(tn(x.id)),FPPOS[x.t],(x.c/10).toFixed(1),f1(x.v)]))}
 <h3>Gameweek by gameweek</h3>
 ${tbl([['GW'],['Captain'],['Expected',1],['Actual',1],['Δ',1],['Best XI in hindsight',1]].concat(SR.view==='ft'?[['Transfers']]:[]),rows.map(x=>{const q=om.get(x.r),cp=x.capUsed==null?'— <span class="mu">(captain and vice did not play)</span>':esc(nm(x.capUsed))+(x.capUsed!==x.cap?' <span class="mu">(vice)</span>':'');
  return ['GW'+x.r,cp,f1(x.exp),String(x.act),(x.act-x.exp>=0?'+':'')+f1(x.act-x.exp),q&&q.pts!=null?String(q.pts):'N/A'].concat(SR.view==='ft'?[x.tr.length?x.tr.map(t=>esc(nm(t.out))+' → '+esc(nm(t.in))).join('<br>'):'<span class="mu">none ('+x.ft+' banked)</span>']:[])}).concat([['<b>Total</b>','',`<b>${f1(E)}</b>`,`<b>${A}</b>`,`<b>${(A-E>=0?'+':'')+f1(A-E)}</b>`,`<b>${O}</b>`].concat(SR.view==='ft'?[`<b>${nT}</b>`]:[])]))}
 <div class="mu" style="font-size:12px;margin:6px 0">Model ${esc(R.ver)}. ${SR.view==='ft'?`Free transfers: 1 a gameweek from GW${R.from+1}, banked up to ${R.cap}; each is the best single swap by the squad's expected points over the next ${R.hz} gameweeks and is made when it gains at least ${SR_TH} point (any gain when the bank is full). Selling prices follow FPL (half of any rise, rounded down). `:''}Automatic substitutions: a starter with no minutes is replaced by the first bench player who played and keeps the formation legal. Fixtures of later gameweeks are known in advance, as in the game; their results are not.${d.archive==='2022-23'?' FPL published expected goals and assists only from gameweek 16 of 2022-23: before that the model uses goals and assists in their place.':''}</div>`;
 srChartWire('srch',gws,S,dl);
}
/* lines (points per gameweek) and Δ bars on the same points axis */
function srChart(id,gws,S,dl,W){
 /* drawn at the width of the page (340–680 px) so its text keeps its size on a phone */
 const H=W<500?260:290,L=42,B=30,T=14,Rr=66,vals=S.flatMap(s=>s.v).concat(dl).filter(fpOk);if(!vals.length)return '<div class="empty">No values to draw.</div>';
 const v0=Math.min(0,...vals),v1=Math.max(...vals),raw=((v1-v0)||1)/5,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw);
 const lo=Math.floor(v0/st)*st,hi=Math.ceil(v1/st)*st,n=gws.length,bw=(W-L-Rr)/n,sx=i=>L+bw*(i+.5),sy=v=>H-B-(H-B-T)*(v-lo)/((hi-lo)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let v=lo;v<=hi+1e-9;v+=st){g+=`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W-Rr}" y2="${sy(v).toFixed(1)}" stroke="${Math.abs(v)<1e-9?'#8a9bb0':'#25374d'}" stroke-width="${Math.abs(v)<1e-9?1:.6}"/><text x="${L-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${+v.toFixed(2)}</text>`}
 const every=Math.ceil(n/Math.max(4,Math.floor((W-L-Rr)/46))),lastTick=Math.floor((n-1)/every)*every,tick=i=>i===n-1||(i%every===0&&(i!==lastTick||n-1-i>=every*.7));gws.forEach((w,i)=>{if(tick(i))g+=`<text x="${sx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#8a9bb0">GW${w}</text>`});
 const z=sy(0),w=Math.max(2,Math.min(14,bw-2));
 dl.forEach((v,i)=>{if(!fpOk(v)||Math.abs(v)<1e-9)return;const y=sy(v),h=Math.abs(y-z),r=Math.min(3,h/2,w/2),x=sx(i)-w/2;
  /* rounded at the data end, square at the zero line */
  const pth=v>0?`M${x} ${z}V${y+r}Q${x} ${y} ${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${z}Z`:`M${x} ${z}V${y-r}Q${x} ${y} ${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y-r}V${z}Z`;
  g+=`<path d="${pth}" fill="${SR_COL.dlt}" fill-opacity=".55"/>`});
 S.forEach(s=>{let dd='',pen=false;s.v.forEach((v,i)=>{if(!fpOk(v)){pen=false;return}dd+=(pen?'L':'M')+sx(i).toFixed(1)+' '+sy(v).toFixed(1)+' ';pen=true});
  g+=`<path d="${dd}" fill="none" stroke="${s.c}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linejoin="round"/>`});
 const lab=S.map(s=>{let i=s.v.length-1;while(i>=0&&!fpOk(s.v[i]))i--;return i<0?null:{s,i,y:sy(s.v[i])}}).filter(Boolean).sort((a,b)=>a.y-b.y);
 for(let k=1;k<lab.length;k++)if(lab[k].y-lab[k-1].y<13)lab[k].y=lab[k-1].y+13;
 lab.forEach(q=>{g+=`<text x="${(sx(q.i)+8).toFixed(1)}" y="${(q.y+4).toFixed(1)}" font-size="11" fill="#e8eef5">${esc(q.s.short)}</text>`});
 g+=`<line id="${id}x" x1="0" y1="${T}" x2="0" y2="${H-B}" stroke="#e8eef5" stroke-opacity=".5" stroke-width="1" style="display:none"/><rect id="${id}h" x="${L}" y="${T}" width="${W-L-Rr}" height="${H-B-T}" fill="transparent" style="cursor:crosshair"/>`;
 return `<div style="position:relative;max-width:760px;margin:0 auto" id="${id}" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;touch-action:pan-y" role="img" aria-label="Actual and expected points per gameweek">${g}</svg><div id="${id}t" style="position:absolute;display:none;pointer-events:none;background:#152130;border:1px solid #25374d;border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.4;min-width:150px;z-index:2"></div></div><div class="mu" style="font-size:11px;text-align:center">Points per gameweek (y) by gameweek (x); bars = actual − expected. Hover or tap for values; the table below holds every number.</div>`;
}
function srChartWire(id,gws,S,dl){
 const box=document.getElementById(id);if(!box)return;const svg=box.querySelector('svg'),hit=document.getElementById(id+'h'),ln=document.getElementById(id+'x'),tip=document.getElementById(id+'t');
 const W=+box.dataset.w||680,L=42,Rr=66,bw=(W-L-Rr)/gws.length,sx=i=>L+bw*(i+.5);
 const row=(c,dash,val,name,bar)=>{const r=document.createElement('div');r.style.cssText='display:flex;align-items:center;gap:6px';const k=document.createElementNS('http://www.w3.org/2000/svg','svg');k.setAttribute('width','16');k.setAttribute('height','8');
  k.innerHTML=bar?`<rect x="4" y="0" width="8" height="8" rx="2" fill="${c}" fill-opacity=".55"/>`:`<line x1="0" y1="4" x2="16" y2="4" stroke="${c}" stroke-width="2.5" stroke-dasharray="${dash}"/>`;const b=document.createElement('b');b.textContent=val;const n=document.createElement('span');n.style.color='#8a9bb0';n.textContent=name;r.append(k,b,n);return r};
 const show=ev=>{const r=svg.getBoundingClientRect(),xv=(ev.clientX-r.left)/r.width*W,bi=Math.max(0,Math.min(gws.length-1,Math.floor((xv-L)/bw)));
  ln.setAttribute('x1',sx(bi));ln.setAttribute('x2',sx(bi));ln.style.display='';tip.textContent='';
  const h=document.createElement('div');h.style.cssText='color:#8a9bb0;margin-bottom:2px';h.textContent='GW'+gws[bi];tip.appendChild(h);
  S.forEach(s=>{const v=s.v[bi];tip.appendChild(row(s.c,s.dash,fpOk(v)?(Number.isInteger(v)?String(v):v.toFixed(1)):'N/A',s.n))});
  tip.appendChild(row(SR_COL.dlt,'',(dl[bi]>=0?'+':'')+dl[bi].toFixed(1),'Δ actual − expected',true));
  const px=sx(bi)/W*r.width;tip.style.display='block';tip.style.top='8px';tip.style.left=(px>r.width/2?Math.max(0,px-tip.offsetWidth-10):px+10)+'px'};
 hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',()=>{ln.style.display='none';tip.style.display='none'});
}
"""


def _x_sr_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (مراجعة الموسم): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "['backtest','Backtest']];", "['backtest','Backtest'],['review','Season review']];")
    h = sub(h, "backtest:fpTBack})[FP.tab]", "backtest:fpTBack,review:fpTReview})[FP.tab]")
    h = sub(h, "const FPS_ARCH_TABS=new Set(['table','scatter','value','compare','teams','fixtures','backtest']);",
            "const FPS_ARCH_TABS=new Set(['table','scatter','value','compare','teams','fixtures','backtest','review']);")
    h = sub(h, "async function route(){", _X_SRJS + "\nasync function route(){")
    return h


_AR_SEASON.update({
    "Season review": "مراجعة الموسم",
    "How this works.": "كيف تعمل.",
    "Before gameweek # the model picks its squad of # within the £#m budget using only gameweeks #–# (the same squad optimizer as Optimal XI, valued on the expected points of the next # gameweeks). In every later gameweek it sees only earlier gameweeks, as in Backtest, and picks its XI, captain and vice-captain from the squad": "قبل الجولة # يختار النموذج قائمته من # لاعباً ضمن ميزانية £#m باستخدام الجولات #–# فقط (نفس محسّن القائمة في التشكيلة المثالية، والتقييم على النقاط المتوقعة للجولات الـ# القادمة). وفي كل جولة بعدها يرى الجولات السابقة فقط، مثل الاختبار التاريخي، ويختار تشكيلته الأساسية والكابتن ونائبه من القائمة",
    "FPL's automatic substitutions and the vice-captain rule are applied to the real minutes": "وتُطبّق التبديلات التلقائية في FPL وقاعدة نائب الكابتن على الدقائق الفعلية",
    "= the model's projection for the XI it picked (captain doubled)": "= توقع النموذج للتشكيلة اللي اختارها (الكابتن مضاعف)",
    "= the points that XI really scored": "= النقاط اللي سجلتها هذه التشكيلة فعلاً",
    "= actual − expected": "= الفعلي − المتوقع",
    "Best XI in hindsight": "أفضل تشكيلة بأثر رجعي",
    "= the highest-scoring starting XI (captain doubled) of any squad of # within the budget at that gameweek's prices, a ceiling no manager reaches. Prices are FPL's prices of each gameweek": "= أعلى تشكيلة أساسية نقاطاً (الكابتن مضاعف) من أي قائمة من # لاعباً ضمن الميزانية بأسعار تلك الجولة، وهو سقف ما يوصله أي مدرب. الأسعار هي أسعار FPL في كل جولة",
    "chips and points hits are not used": "ولا تُستخدم الشرائح (Chips) ولا خصم النقاط مقابل الانتقالات",
    "Squad kept all season (no transfers)": "القائمة ثابتة طوال الموسم (بدون انتقالات)",
    "# free transfer a week": "انتقال مجاني واحد كل جولة",
    "Best XI in hindsight on the chart": "أفضل تشكيلة بأثر رجعي في الرسم",
    "Version": "النسخة",
    "Actual points, GW#–# (squad kept)": "النقاط الفعلية، ج#–# (القائمة ثابتة)",
    "Actual points, GW#–# (with # free transfers)": "النقاط الفعلية، ج#–# (مع # انتقالات مجانية)",
    "Actual points, GW#–# (with # free transfer)": "النقاط الفعلية، ج#–# (مع انتقال مجاني واحد)",
    "Expected by the model for the XIs it picked": "توقع النموذج للتشكيلات اللي اختارها",
    "Actual − expected over the season (# a gameweek)": "الفعلي − المتوقع خلال الموسم (# لكل جولة)",
    "Best XI in hindsight, every gameweek (the team reached #% of it)": "أفضل تشكيلة بأثر رجعي في كل جولة (الفريق وصل إلى #% منها)",
    "With # free transfer a week (+# points)": "مع # انتقال مجاني كل جولة (+# نقطة)",
    "With # free transfer a week (# points)": "مع # انتقال مجاني كل جولة (# نقطة)",
    "Squad kept all season (+# points)": "القائمة ثابتة طوال الموسم (+# نقطة)",
    "Squad kept all season (# points)": "القائمة ثابتة طوال الموسم (# نقطة)",
    "Actual points": "النقاط الفعلية",
    "Expected points": "النقاط المتوقعة",
    "Δ actual − expected": "Δ الفعلي − المتوقع",
    "Points per gameweek (y) by gameweek (x)": "النقاط في كل جولة (y) حسب الجولة (x)",
    "bars = actual − expected. Hover or tap for values": "الأعمدة = الفعلي − المتوقع. مرّر أو اضغط لرؤية القيم",
    "the table below holds every number": "والجدول بالأسفل فيه كل الأرقام",
    "Squad picked before GW#": "القائمة المختارة قبل ج#",
    "£#m of £#m, chosen with gameweeks #–# only. Expected points of GW#–# as the model saw them then": "£#m من £#m، اختيرت بالجولات #–# فقط. النقاط المتوقعة للجولات ج#–# كما رآها النموذج وقتها",
    "Price": "السعر",
    "Expected GW#–#": "المتوقع ج#–#",
    "(bench)": "(احتياط)",
    "(vice)": "(النائب)",
    "Gameweek by gameweek": "جولة بجولة",
    "Captain": "الكابتن",
    "Transfers": "الانتقالات",
    "Total": "المجموع",
    "Best XI": "أفضل تشكيلة",
    "none (# banked)": "لا يوجد (# مدّخرة)",
    "(captain and vice did not play)": "(الكابتن ونائبه لم يلعبا)",
    "Model v#. Automatic substitutions: a starter with no minutes is replaced by the first bench player who played and keeps the formation legal. Fixtures of later gameweeks are known in advance, as in the game": "النموذج v#. التبديلات التلقائية: اللاعب الأساسي اللي ما لعب يُستبدل بأول لاعب احتياط لعب ويحافظ على خطة نظامية. مباريات الجولات القادمة معروفة مسبقاً كما في اللعبة",
    "Model v#. Free transfers: # a gameweek from GW#, banked up to #": "النموذج v#. الانتقالات المجانية: # كل جولة من ج#، وتُدّخر حتى #",
    "each is the best single swap by the squad's expected points over the next # gameweeks and is made when it gains at least # point (any gain when the bank is full). Selling prices follow FPL (half of any rise, rounded down). Automatic substitutions: a starter with no minutes is replaced by the first bench player who played and keeps the formation legal. Fixtures of later gameweeks are known in advance, as in the game": "كل انتقال هو أفضل تبديل منفرد حسب النقاط المتوقعة للقائمة في الجولات الـ# القادمة، ويُنفّذ إذا زاد # نقطة على الأقل (أي زيادة إذا امتلأت المدّخرة). أسعار البيع حسب FPL (نصف أي ارتفاع، مقرّب للأسفل). التبديلات التلقائية: اللاعب الأساسي اللي ما لعب يُستبدل بأول لاعب احتياط لعب ويحافظ على خطة نظامية. مباريات الجولات القادمة معروفة مسبقاً كما في اللعبة",
    "their results are not": "لكن نتائجها لا",
    "their results are not. FPL published expected goals and assists only from gameweek # of ##: before that the model uses goals and assists in their place": "لكن نتائجها لا. FPL نشرت الأهداف والتمريرات الحاسمة المتوقعة من الجولة # في موسم ## فقط: قبلها يستخدم النموذج الأهداف والتمريرات الحاسمة مكانها",
    "Actual and expected points per gameweek": "النقاط الفعلية والمتوقعة في كل جولة",
    "The review replays the season on this device (a few seconds on a laptop, longer on a phone)": "المراجعة تعيد الموسم على هذا الجهاز (ثوانٍ على اللابتوب، وأطول على الجوال)",
    "Run the season review": "شغّل مراجعة الموسم",
    "Replaying gameweek # of #… (no future data is used)": "جارٍ إعادة الجولة # من #… (بدون أي بيانات مستقبلية)",
    "Could not run the season review:": "تعذر تشغيل مراجعة الموسم:",
    "Loading…": "جارٍ التحميل…",
})

INDEX = _x_sr_index(INDEX)
# ======================== نهاية إضافة مراجعة الموسم ========================


# ============================================================================
# إضافة: سجل التوقعات العلني — يحفظ توقع النموذج لكل جولة قبل الموعد النهائي في data/fpl_track.json
# يتحدّث مع كل تحديث للبيانات لين الموعد النهائي، وبعده ما يتغير أبداً (كل حفظ commit، فتاريخ الملف هو الإثبات).
# الحساب بنفس كود الصفحة (Node)، فالرقم المحفوظ هو نفس اللي يشوفه الزائر في التشكيلة المثالية. إذا Node مو موجود يتخطى بهدوء.
# ============================================================================
FPL_TRACK_PATH = "data/fpl_track.json"
_TRK_FPL = None                     # محتوى data/fpl.json اللي انرفع في هذه المزامنة
_TRK_NODE = r"""// Track record snapshot: runs the page's own Fantasy code (argv[2]) on data/fpl.json (argv[3]) and prints the model's
// Optimal XI (budget) for the next gameweek with its simulated range, and every player's expected points.
const fs=require('fs'),vm=require('vm');
const [codeF,dataF]=process.argv.slice(2);
const ctx={console:{log(){},warn(){},error(){}},Math,Date,JSON,Map,Set,Promise,setTimeout,Float64Array,Uint8Array,Int16Array,Uint32Array,Array,Object,String,Number,isFinite,parseInt,parseFloat,Error,RegExp,Infinity,NaN,
 document:{querySelector:()=>null,getElementById:()=>null,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>({ok:false,status:404})};
vm.createContext(ctx);
vm.runInContext("const $=s=>null;const esc=s=>String(s??'');const f=(v,d=3)=>v==null?'N/A':Number(v).toFixed(d);const tbl=()=>'';const R={};let ALL={leagues:[]},D=null;\n"+fs.readFileSync(codeF,'utf8')+"\n;globalThis.__ev=s=>eval(s);",ctx);
const ev=ctx.__ev;
(async()=>{
 const d=JSON.parse(fs.readFileSync(dataF,'utf8'));
 /* the same preparation as fpLoad on the page */
 d.T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=d.T.get(o.tm)||{};o.tn=t.s||'?';o.tf=t.n||'?';o.pos=o.ty;o.name=o.wn;
  o.price=typeof o.now_cost==='number'?o.now_cost/10:null;o.chg=typeof o.cost_change_start==='number'?o.cost_change_start/10:null;return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));ev('v=>{FPD=v}')(d);
 const X=ev('oxReady()');if(X.err)throw new Error(X.err);
 const res=await ev('oxOptimal')(X,0,'budget');if(res.err)throw new Error(res.err);
 const t=res.team,ids=t.xi.map(i=>i.id),C=X.C,g=C.gws[0];
 /* the same simulation (seed 7001, N 2000) and widening as the Optimal XI tab */
 const sim=ev('oxSim')(d,C,[{per:[{ids,cap:t.cap.id}]}],[0],ev('OX.N'),7001)[0],st=ev('oxQs')(sim.tot);
 const pv=p=>{const x=ev('oxG')(p,0);return x?x.pts:null};
 const bench=(t.bench||[]).map(i=>d.PB.get(i.id)).filter(Boolean).sort((a,b)=>(a.ty===1)-(b.ty===1)||(pv(b)||0)-(pv(a)||0)||a.id-b.id).map(p=>p.id);
 const preds={};d.P.forEach(p=>{const v=pv(p);if(v!=null&&ev('oxHasPred')(p))preds[p.id]=Math.round(v*100)/100});
 const r2=x=>Math.round(x*100)/100;
 process.stdout.write(JSON.stringify({gw:g,data:d.generated,ver:ev('PM_VERSION'),kappa:ev('oxK()'),mode:'budget',form:t.form.name,xi:ids,cap:t.cap.id,vice:t.vice?t.vice.id:null,bench,
  exp:r2(t.total),p10:r2(st.p10),p50:r2(st.p50),p90:r2(st.p90),cost:t.squadCost??null,preds}));
})().catch(e=>{process.stderr.write(String(e&&e.message||e));process.exit(1)});
"""


def _trk_snapshot(payload_bytes):
    """يشغّل كود الفانتازي من الصفحة على البيانات ويرجع التوقع، أو None."""
    import shutil, subprocess, tempfile
    node = shutil.which("node")
    if not node:
        log("  [Track record] Node غير موجود — تخطيت حفظ التوقع")
        return None
    a, b = INDEX.find("/* ===== Fantasy (FPL) ===== */"), INDEX.find("/* ===== Fantasy seasons:")
    if a < 0 or b < 0:
        log("  [Track record] ما لقيت كود الفانتازي في الصفحة — تخطيت")
        return None
    with tempfile.TemporaryDirectory() as td:
        paths = {k: os.path.join(td, k) for k in ("run.js", "code.js", "fpl.json")}
        open(paths["run.js"], "w", encoding="utf-8").write(_TRK_NODE)
        open(paths["code.js"], "w", encoding="utf-8").write(INDEX[a:b])
        open(paths["fpl.json"], "wb").write(payload_bytes)
        r = subprocess.run([node, paths["run.js"], paths["code.js"], paths["fpl.json"]], capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        log(f"  [Track record] تعذر حساب التوقع: {r.stderr.strip()[:300]}")
        return None
    return json.loads(r.stdout)


def sync_fpl_track(hub):
    if not _TRK_FPL:
        return
    d = json.loads(_TRK_FPL.decode("utf-8"))
    ev = next((e for e in d.get("events", []) if e.get("nxt")), None)
    if not ev or not ev.get("dl"):
        return
    dl, gen, t = _parse_ts(ev["dl"]), _parse_ts(d.get("generated")), datetime.datetime.now(datetime.timezone.utc)
    if dl is None or gen is None or not (t < dl and gen < dl):
        return                                       # بعد الموعد النهائي ما نحفظ شيء لهذي الجولة
    season = str((d.get("events") or [{}])[0].get("dl") or "")[:4]
    track = gh_get_json(hub, FPL_TRACK_PATH) or {}
    if track.get("season") and track["season"] != season:      # موسم جديد: السجل القديم يبقى في ملف باسمه
        gh_put(hub, f"data/fpl_track_{track['season']}.json", json.dumps(track, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
               f"Track record: keep season {track['season']}")
        track = {}
    track["season"] = season
    gws = track.setdefault("gws", {})
    old = gws.get(str(ev["id"]))
    if old and (_parse_ts(old.get("dl")) or t) <= t:
        return                                       # مقفول
    snap = _trk_snapshot(_TRK_FPL)
    if not snap or snap.get("gw") != ev["id"]:
        log(f"  [Track record] التوقع المحسوب ما يخص الجولة {ev['id']} — ما حفظته")
        return
    snap["dl"], snap["saved"] = ev["dl"], now()
    same = lambda x: {k: v for k, v in x.items() if k not in ("saved", "data")}
    if old and same(old) == same(snap):
        return                                       # نفس التوقع (حتى لو البيانات أحدث)، ما في داعي لـ commit
    gws[str(ev["id"])] = snap
    gh_put(hub, FPL_TRACK_PATH, json.dumps(track, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
           f"Track record: model prediction for GW{ev['id']} (saved before the deadline)")
    log(f"  [Track record] حُفظ توقع الجولة {ev['id']}: {snap['exp']} نقطة متوقعة ({snap['p10']}–{snap['p90']})، الموعد النهائي {ev['dl']}")


_orig_gh_put_trk = gh_put


def gh_put(hub, path, content, message):
    global _TRK_FPL
    if path == "data/fpl.json":
        _TRK_FPL = content
    return _orig_gh_put_trk(hub, path, content, message)


_orig_sync_fpl_trk = sync_fpl


def sync_fpl(hub):
    _orig_sync_fpl_trk(hub)
    try:
        sync_fpl_track(hub)
    except Exception as e:      # السجل ما يوقف بقية المزامنة
        log(f"  [Track record] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")


_X_TRKJS = r"""/* ===== Track record: the model's prediction saved before every deadline (data/fpl_track.json), against what happened =====
   The sync saves, for the next gameweek, the model's Optimal XI within the budget (the Optimal XI tab's default), its captain
   and vice, bench, the simulated 80% range and every player's expected points. It refreshes the record with each data update
   until the deadline and never changes it afterwards; each save is a commit, so the file's history shows when it was made.
   Actual points use FPL's automatic substitutions and captain/vice rule (srAuto, as in Season review). */
const TRK={data:null,key:''};
async function trkLoad(d){
 if(TRK.key===d.generated&&TRK.data)return TRK.data;
 let T={gws:{}};try{const r=await fetch('data/fpl_track.json?v='+encodeURIComponent(d.generated||''));if(r.ok)T=await r.json()}catch(e){}
 TRK.data=T;TRK.key=d.generated;return T;
}
function trkRows(d,T){
 const ix=btIx(d),RU=pmRules(d),now=Date.now(),ty=id=>{const p=d.PB.get(id);return p?p.ty:4};
 const at=(id,g,c)=>{let s=0;((d.hist||{})[String(id)]||[]).forEach(h=>{if(h[ix.r]===g&&fpOk(h[ix[c]]))s+=h[ix[c]]});return s};
 return Object.values(T.gws||{}).sort((a,b)=>a.gw-b.gw).map(s=>{
  const e=d.events.find(x=>x.id===s.gw)||{},locked=Date.parse(s.dl)<=now,fin=!!e.fin,minOf=id=>at(id,s.gw,'min'),ptsOf=id=>at(id,s.gw,'pts');
  const au=RU?srAuto(s.xi.map(id=>({id,t:ty(id)})),(s.bench||[]).map(id=>({id,t:ty(id)})),minOf,RU):{ids:s.xi,subs:[]};
  const capU=minOf(s.cap)>0?s.cap:(s.vice!=null&&minOf(s.vice)>0?s.vice:null),act=au.ids.reduce((a,id)=>a+ptsOf(id),0)+(capU!=null?ptsOf(capU):0);
  let n=0,ae=0,b=0;for(const [id,p] of Object.entries(s.preds||{})){const a=ptsOf(+id);n++;ae+=Math.abs(p-a);b+=p-a}
  return {s,e,locked,fin,act,capU,subs:au.subs,ids:au.ids,inR:act>=s.p10&&act<=s.p90,avg:fpOk(e.avg)&&e.avg>0?e.avg:null,mae:n?ae/n:null,bias:n?b/n:null,n,ptsOf,minOf};
 });
}
function fpTTrack(el){
 const d=FPD;el.innerHTML='<div class="empty">Loading…</div>';
 trkLoad(d).then(T=>{if(FPD===d&&FP.tab==='track')trkDraw(el,d,T)});
}
function trkDraw(el,d,T){
 const nm=id=>{const p=d.PB.get(id);return p?p.name:'#'+id},f1=x=>x.toFixed(1),hh=s=>String(s).slice(0,16).replace('T',' ')+' UTC';
 const repo=typeof GH_REPO==='function'?GH_REPO():'',link=repo?`https://github.com/${repo}/commits/main/data/fpl_track.json`:'';
 const nx=d.events.find(e=>e.nxt),rows=trkRows(d,T),done=rows.filter(r=>r.fin);
 const intro=`<div class="card mu" style="font-size:12px"><b>How this works.</b> Before every deadline the sync saves the model's prediction for that gameweek: the Optimal XI within the budget (as shown in the Optimal XI tab), captain, vice-captain and bench, the 80% range and every player's expected points. Until the deadline the record is refreshed with each data update (every 15 minutes in the last 3 hours); after the deadline it is never changed. Each save is a commit, so ${link?`<a href="${esc(link)}" target="_blank" rel="noopener">the history of the file on GitHub</a>`:'the history of the file on GitHub'} shows when every prediction was made. <b>Actual</b> = the points that XI scored with FPL's automatic substitutions and the captain/vice-captain rule. <b>FPL average</b> = the average score of all FPL managers that gameweek.</div>`;
 if(!rows.length){el.innerHTML=intro+`<div class="empty">No prediction saved yet. The first one is saved before the ${nx?'GW'+nx.id+' deadline ('+esc(hh(nx.dl))+')':'next deadline'} and scored once that gameweek is finished. The Backtest and Season review tabs replay earlier gameweeks.</div>`;return}
 const sum=(L,k)=>L.reduce((a,x)=>a+(x[k]||0),0),A=sum(done,'act'),E=done.reduce((a,x)=>a+x.s.exp,0),wA=done.filter(x=>x.avg!=null),AV=sum(wA,'avg'),AA=sum(wA,'act'),inR=done.filter(x=>x.inR).length;
 const mae=done.filter(x=>x.mae!=null);
 let h=intro;
 if(done.length){
  h+=`<div class="grid"><div class="kpi"><b>${done.length}</b><span>Gameweeks scored (${inR} of ${done.length} inside the 80% range)</span></div><div class="kpi"><b>${A}</b><span>Actual points of the saved XIs (expected ${f1(E)})</span></div><div class="kpi"><b>${wA.length?(AA-AV>=0?'+':'')+(AA-AV):'N/A'}</b><span>Against the FPL average manager${wA.length?' ('+((AA-AV)/wA.length>=0?'+':'')+f1((AA-AV)/wA.length)+' a gameweek)':''}</span></div><div class="kpi"><b>${mae.length?(mae.reduce((a,x)=>a+x.mae,0)/mae.length).toFixed(2):'N/A'}</b><span>Player prediction error (mean absolute, points per player)</span></div></div>`;
  if(done.length>=2){const gws=done.map(x=>x.s.gw),S=[{n:'Actual points',short:'Actual',v:done.map(x=>x.act),c:SR_COL.act,dash:''},{n:'Expected points',short:'Expected',v:done.map(x=>x.s.exp),c:SR_COL.exp,dash:'7 4'},{n:'FPL average',short:'FPL avg',v:done.map(x=>x.avg),c:SR_COL.opt,dash:'2 3'}];
   h+=`<div class="ctl" style="margin:10px 0 2px;font-size:13px;gap:14px">${S.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg>${esc(s.n)}</span>`).join('')}<span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="${SR_COL.dlt}" fill-opacity=".55"/></svg>Δ actual − expected</span></div><div id="trkch"></div>`;
   TRK.chart={gws,S,dl:done.map(x=>x.act-x.s.exp)}}else TRK.chart=null;
 }else TRK.chart=null;
 const st=r=>!r.locked?`<span class="mu">open until the deadline, ${esc(hh(r.s.dl))}</span>`:!r.fin?`<span class="mu">in progress (${r.act} so far)</span>`:String(r.act);
 h+=`<h3>Gameweek by gameweek</h3>`+tbl([['GW'],['Saved'],['Captain'],['Expected (80% range)',1],['Actual',1],['Δ',1],['In range'],['FPL average',1],['Player error',1]],rows.map(r=>{const bh=(Date.parse(r.s.dl)-Date.parse(String(r.s.saved).replace(' ','T')+'Z'))/36e5;
  return ['GW'+r.s.gw,`${esc(hh(r.s.saved))}<br><span class="mu">${bh>=0?f1(bh)+' h before the deadline':''}</span>`,esc(nm(r.s.cap))+(r.fin&&r.capU!==r.s.cap?(r.capU==null?' <span class="mu">(did not play, nor the vice-captain)</span>':' <span class="mu">(did not play, the vice-captain was doubled)</span>'):''),
   `${f1(r.s.exp)} <span class="mu">(${Math.round(r.s.p10)}–${Math.round(r.s.p90)})</span>`,st(r),r.fin?(r.act-r.s.exp>=0?'+':'')+f1(r.act-r.s.exp):'',r.fin?(r.inR?'✓ yes':'✗ no'):'',r.fin&&r.avg!=null?String(r.avg):'',r.fin&&r.mae!=null?r.mae.toFixed(2):'']}));
 h+=rows.slice().reverse().map(r=>`<details style="margin:6px 0"><summary>GW${r.s.gw}: the saved XI (${esc(r.s.form)}, model ${esc(r.s.ver)})</summary>`+
  tbl([['Player'],['Pos'],['Expected',1],['Minutes',1],['Points',1]],r.s.xi.concat(r.s.bench||[]).map(id=>{const p=d.PB.get(id),sub=r.subs.find(x=>x[1]===id),out=r.subs.find(x=>x[0]===id),bench=!r.s.xi.includes(id);
   return [esc(nm(id))+(id===r.s.cap?' <b>(C)</b>':id===r.s.vice?' <span class="mu">(V)</span>':'')+(bench?' <span class="mu">(bench'+(sub?', came on':'')+')</span>':'')+(out?' <span class="mu">(replaced)</span>':''),p?FPPOS[p.ty]:'',f1((r.s.preds||{})[id]??0),r.locked?String(r.minOf(id)):'',r.locked?String(r.ptsOf(id)):'']}))+'</details>').join('');
 h+=`<div class="mu" style="font-size:12px;margin:6px 0">Player error: mean absolute difference between expected and actual points over all ${rows.length&&rows[rows.length-1].n?rows[rows.length-1].n:''} players with a saved prediction (those who did not play count with 0). Earlier gameweeks of this season have no saved prediction; the Backtest and Season review tabs replay them without future data.</div>`;
 el.innerHTML=h;
 if(TRK.chart){const o=$('#trkch');o.innerHTML=srChart('trkc',TRK.chart.gws,TRK.chart.S,TRK.chart.dl,Math.round(Math.max(340,Math.min(680,el.clientWidth||680))));srChartWire('trkc',TRK.chart.gws,TRK.chart.S,TRK.chart.dl)}
}
"""


def _x_trk_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (سجل التوقعات): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "['review','Season review']];", "['review','Season review'],['track','Track record']];")
    h = sub(h, "review:fpTReview})[FP.tab]", "review:fpTReview,track:fpTTrack})[FP.tab]")
    h = sub(h, "async function route(){", _X_TRKJS + "\nasync function route(){")
    return h


_AR_SEASON.update({
    "Track record": "سجل التوقعات",
    "Before every deadline the sync saves the model's prediction for that gameweek: the Optimal XI within the budget (as shown in the Optimal XI tab), captain, vice-captain and bench, the #% range and every player's expected points. Until the deadline the record is refreshed with each data update (every # minutes in the last # hours)": "قبل كل موعد نهائي تحفظ المزامنة توقع النموذج لتلك الجولة: التشكيلة المثالية ضمن الميزانية (مثل ما تظهر في تبويب التشكيلة المثالية)، والكابتن ونائبه والاحتياط، ونطاق #%، والنقاط المتوقعة لكل لاعب. ولين الموعد النهائي يتحدّث السجل مع كل تحديث للبيانات (كل # دقيقة في آخر # ساعات)",
    "after the deadline it is never changed. Each save is a commit, so": "وبعد الموعد النهائي ما يتغير أبداً. كل حفظ هو commit، لذلك",
    "the history of the file on GitHub": "تاريخ الملف على GitHub",
    "shows when every prediction was made": "يبيّن متى انحفظ كل توقع",
    "= the points that XI scored with FPL's automatic substitutions and the captain/vice-captain rule": "= النقاط اللي سجلتها هذه التشكيلة مع التبديلات التلقائية في FPL وقاعدة الكابتن ونائبه",
    "FPL average": "متوسط FPL",
    "FPL avg": "متوسط FPL",
    "= the average score of all FPL managers that gameweek": "= متوسط نقاط كل مدربي FPL في تلك الجولة",
    "No prediction saved yet. The first one is saved before the GW# deadline (### #:# UTC) and scored once that gameweek is finished. The Backtest and Season review tabs replay earlier gameweeks": "ما انحفظ أي توقع للحين. أول توقع ينحفظ قبل الموعد النهائي للجولة # (### #:# UTC) ويُقيَّم بعد ما تخلص تلك الجولة. تبويبا الاختبار التاريخي ومراجعة الموسم يعيدان الجولات السابقة",
    "Gameweeks scored (# of # inside the #% range)": "جولات مُقيَّمة (# من # داخل نطاق #%)",
    "Actual points of the saved XIs (expected #)": "النقاط الفعلية للتشكيلات المحفوظة (المتوقع #)",
    "Against the FPL average manager (+# a gameweek)": "مقارنة بمتوسط مدربي FPL (+# لكل جولة)",
    "Against the FPL average manager (# a gameweek)": "مقارنة بمتوسط مدربي FPL (# لكل جولة)",
    "Against the FPL average manager": "مقارنة بمتوسط مدربي FPL",
    "Player prediction error (mean absolute, points per player)": "خطأ توقع اللاعبين (متوسط الفرق المطلق، نقاط لكل لاعب)",
    "Saved": "وقت الحفظ",
    "Expected (#% range)": "المتوقع (نطاق #%)",
    "In range": "داخل النطاق",
    "Player error": "خطأ اللاعبين",
    "# h before the deadline": "قبل الموعد النهائي بـ# ساعة",
    "### #:# UTC": "### #:# UTC",
    "open until the deadline, ### #:# UTC": "مفتوح لين الموعد النهائي، ### #:# UTC",
    "in progress (# so far)": "جارية (# للحين)",
    "yes": "نعم",
    "no": "لا",
    "(did not play, nor the vice-captain)": "(ما لعب، ولا نائبه)",
    "(did not play, the vice-captain was doubled)": "(ما لعب، فتضاعفت نقاط نائبه)",
    "GW#: the saved XI (###, model v#)": "ج#: التشكيلة المحفوظة (###، النموذج v#)",
    "(bench, came on)": "(احتياط، دخل بدل لاعب)",
    "(replaced)": "(خرج بالتبديل التلقائي)",
    "Player error: mean absolute difference between expected and actual points over all # players with a saved prediction (those who did not play count with #). Earlier gameweeks of this season have no saved prediction": "خطأ اللاعبين: متوسط الفرق المطلق بين النقاط المتوقعة والفعلية لكل الـ# لاعب اللي لهم توقع محفوظ (اللي ما لعبوا ينحسبون بـ#). الجولات السابقة من هذا الموسم ما لها توقع محفوظ",
    "the Backtest and Season review tabs replay them without future data": "وتبويبا الاختبار التاريخي ومراجعة الموسم يعيدانها بدون بيانات مستقبلية"
})

INDEX = _x_trk_index(INDEX)
# ======================== نهاية إضافة سجل التوقعات ========================


# ============================================================================
# إضافة: "هذا الأسبوع" ومعلومة اليوم في الصفحة الرئيسية، وصفحة جدول الدوري مع إعادة الموسم بالتحريك
# كل شيء من بيانات الدوري المحمّل (المباريات وإحصائيات اللاعبين والتسديدات)؛ ما في أي رقم مخترع.
# ============================================================================
_X_ENGCSS = ".wkg{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-bottom:6px}.wkc b{display:block;margin-top:4px}.wkc>span{color:var(--mu);font-size:12px}.wkfact{border-color:var(--g)}.lt{border:1px solid var(--ln);border-radius:10px;overflow:hidden}.ltr{display:grid;grid-template-columns:44px minmax(110px,1fr) 34px 30px 30px 30px 40px 40px 52px 120px;gap:4px;align-items:center;padding:7px 10px;border-top:1px solid var(--ln);background:var(--bg);position:relative;font-variant-numeric:tabular-nums}.ltr>span,.ltr>b{text-align:center}.ltr>.ltt{text-align:start;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lth{border-top:0;color:var(--mu);font-size:12px;background:var(--sf)}.ltm{font-style:normal;font-size:10px;margin-inline-start:3px}.ltm.up{color:var(--g)}.ltm.dn{color:var(--r)}.ltf{display:inline-block;width:17px;height:17px;line-height:17px;border-radius:4px;font-size:10px;font-style:normal;font-weight:700;margin:0 1px;color:#06210f}.ltf.W{background:var(--g)}.ltf.D{background:var(--mu)}.ltf.L{background:var(--r);color:#fff}@media(max-width:560px){.ltr{grid-template-columns:40px minmax(90px,1fr) 28px 38px 36px 96px;font-size:13px;padding:7px 6px}.ltx{display:none}.ltf{width:15px;height:15px;line-height:15px;margin:0}}.ltf.W::after{content:'W'}.ltf.D::after{content:'D'}.ltf.L::after{content:'L'}html[lang=ar] .ltf.W::after{content:'ف'}html[lang=ar] .ltf.D::after{content:'ت'}html[lang=ar] .ltf.L::after{content:'خ'}.ltl::after{content:attr(data-en)}html[lang=ar] .ltl::after{content:attr(data-ar)}html[dir=rtl] .ltr>.ltt{direction:ltr;text-align:right}"
_X_ENGJS = r"""/* ===== Overview "This week" highlights + fact of the day, and the League table with a season replay =====
   Everything comes from the loaded league data (matches, player stats, shots); nothing is invented. "This week" = the 7 days
   ending at the league's latest match in the data. */
const WK_GOAL={x:105,y:34};
const wkDist=s=>Math.hypot(WK_GOAL.x-s.x,WK_GOAL.y-s.y);
const wkSc=s=>{const m=/^(\d+)\s*-\s*(\d+)$/.exec(String(s||''));return m?[+m[1],+m[2]]:null};
const wkEv={Goal:'scored',Miss:'missed',AttemptSaved:'saved',Post:'hit the post'};
const wkPl=(key,club,name)=>`<a href="#/player/${encodeURIComponent(key+'||'+club)}">${esc(name)}</a>`;
const wkMl=id=>{const m=D.matches.find(x=>x.match_id===id);return m?mlink(m):''};
/* shots: per match and team, xG without own goals; goals from the score */
function wkTeamXg(sh){const o=new Map();for(const s of sh){if(s.og)continue;const k=s.m+'|'+s.c;o.set(k,(o.get(k)||0)+(fpOk(s.xg)?s.xg:0))}return o}
async function wkHL(el){
 if(!el||!D||!D.matches.length)return;
 const sh=await loadSh().catch(()=>null),S=sh?sh.rows:[];
 const fin=D.matches.filter(m=>wkSc(m.score)&&m.date),last=fin.map(m=>m.date.slice(0,10)).sort().pop();if(!last){el.innerHTML='';return}
 const from=new Date(Date.parse(last+'T00:00:00Z')-6*864e5).toISOString().slice(0,10),inW=new Set(fin.filter(m=>m.date.slice(0,10)>=from).map(m=>m.match_id));
 const W=S.filter(s=>inW.has(s.m)),cards=[];
 /* biggest chance (penalties excluded: they are all about the same xG) */
 const ch=W.filter(s=>s.st!=='Penalty'&&!s.og&&fpOk(s.xg)).sort((a,b)=>b.xg-a.xg)[0];
 if(ch)cards.push({k:'Biggest chance (no penalties)',v:'xG '+ch.xg.toFixed(2),t:`${esc(ch.pn)} <span class="mu">(${esc(ch.c)})</span><br><span>${wkEv[ch.ev]||esc(ch.ev)}, ${Math.round(wkDist(ch))} metres from goal</span>`,m:ch.m});
 /* longest-range goal */
 const lg=W.filter(s=>s.ev==='Goal'&&!s.og&&s.st!=='Penalty'&&fpOk(s.x)&&fpOk(s.y)).sort((a,b)=>wkDist(b)-wkDist(a))[0];
 if(lg)cards.push({k:'Longest-range goal',v:Math.round(wkDist(lg))+' metres',t:`${esc(lg.pn)} <span class="mu">(${esc(lg.c)})</span><br><span>xG ${fpOk(lg.xg)?lg.xg.toFixed(2):'N/A'}</span>`,m:lg.m});
 /* most threatening single-match performance (xT) */
 const xt=D.stats.filter(s=>inW.has(s.match_id)&&fpOk(s.xt)).sort((a,b)=>b.xt-a.xt)[0];
 if(xt)cards.push({k:'Most threatening performance',v:'xT '+xt.xt.toFixed(2),t:`${wkPl(xt.key,xt.club,xt.player)} <span class="mu">(${esc(xt.club)})</span>`,m:xt.match_id});
 /* finishing above expectation over the week (goals − xG from his shots) */
 const fp=new Map();W.forEach(s=>{if(s.og||!s.pid)return;const o=fp.get(s.pid)||{n:s.pn,c:s.c,g:0,x:0};o.g+=s.ev==='Goal'?1:0;o.x+=fpOk(s.xg)?s.xg:0;fp.set(s.pid,o)});
 const cl=[...fp.values()].filter(o=>o.g>0).sort((a,b)=>(b.g-b.x)-(a.g-a.x))[0];
 if(cl)cards.push({k:'Most clinical',v:'+'+(cl.g-cl.x).toFixed(2),t:`${esc(cl.n)} <span class="mu">(${esc(cl.c)})</span><br><span>${cl.g} goal${cl.g>1?'s':''} from xG ${cl.x.toFixed(2)}</span>`});
 /* the result that went most against the chances */
 if(S.length){const tx=wkTeamXg(W);let best=null;
  fin.filter(m=>inW.has(m.match_id)).forEach(m=>{const g=wkSc(m.score),xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null||g[0]===g[1])return;
   const w=g[0]>g[1]?0:1,gap=(w?xh-xa:xa-xh);if(gap>0&&(!best||gap>best.gap))best={m,gap,w,xh,xa}});
  if(best)cards.push({k:'Won against the chances',v:'xG '+(best.w?best.xa:best.xh).toFixed(1)+' v '+(best.w?best.xh:best.xa).toFixed(1),t:`<b>${esc(best.w?best.m.away:best.m.home)}</b> <span>won with less xG</span>`,m:best.m.match_id})}
 const facts=wkFacts(S);
 const day=Math.floor(Date.now()/864e5),fact=facts.length?facts[day%facts.length]:null;
 el.innerHTML=`<h3>This week <span class="mu" style="font-size:12px;font-weight:400">${esc(from)} – ${esc(last)}, ${inW.size} matches</span></h3>`+
  (fact?`<div class="card wkfact"><div class="mu" style="font-size:12px">Fact of the day</div><div style="font-size:16px;margin-top:4px">${fact}</div></div>`:'')+
  (cards.length?`<div class="wkg">${cards.map(c=>`<div class="kpi wkc"><span>${esc(c.k)}</span><b>${esc(c.v)}</b><div style="font-size:13px;margin-top:4px">${c.t}</div>${c.m?`<div class="mu" style="font-size:12px;margin-top:4px">${wkMl(c.m)}</div>`:''}</div>`).join('')}</div>`:'<div class="empty">No shot data for these matches.</div>');
}
/* season facts from the data; one is shown per day */
function wkFacts(S){
 const out=[],fin=D.matches.filter(m=>wkSc(m.score));if(!fin.length)return out;
 const A=agg().filter(p=>(p.minutes||0)>=270);
 const top=(k,lab,d)=>{const p=[...A].filter(x=>fpOk(x[k+'90'])).sort((a,b)=>b[k+'90']-a[k+'90'])[0];if(p)out.push(`${wkPl(p.key,p.club,p.player)} <span class="mu">(${esc(p.club)})</span> <span>has the league's highest ${lab} per 90 this season:</span> <b>${p[k+'90'].toFixed(d)}</b> <span>(at least 270 minutes)</span>`)};
 top('xt','xT',3);top('xg','xG',2);
 const tm=new Map(),tx=wkTeamXg(S);fin.forEach(m=>{const g=wkSc(m.score);[[m.home,g[0],g[1],m.away],[m.away,g[1],g[0],m.home]].forEach(([t,f,a,o])=>{const r=tm.get(t)||{t,f:0,a:0,xf:0,xa:0,n:0,nx:0};r.f+=f;r.a+=a;r.n++;
  const xf=tx.get(m.match_id+'|'+t),xa=tx.get(m.match_id+'|'+o);if(xf!=null&&xa!=null){r.xf+=xf;r.xa+=xa;r.nx++}tm.set(t,r)})});
 const T=[...tm.values()].filter(r=>r.nx>=3);
 if(T.length){const a=[...T].sort((x,y)=>y.xf/y.nx-x.xf/x.nx)[0];out.push(`<b>${esc(a.t)}</b> create the most chances in the league: <b>${(a.xf/a.nx).toFixed(2)}</b> xG a match`);
  const b=[...T].sort((x,y)=>x.xa/x.nx-y.xa/y.nx)[0];out.push(`<b>${esc(b.t)}</b> allow the fewest chances: <b>${(b.xa/b.nx).toFixed(2)}</b> xG against a match`);
  const c=[...T].sort((x,y)=>((y.f-y.xf)-(x.f-x.xf)))[0];if(c.f-c.xf>0)out.push(`<b>${esc(c.t)}</b> have scored <b>${(c.f-c.xf).toFixed(1)}</b> goals more than their xG this season (${c.f} goals from ${c.xf.toFixed(1)} xG)`);
  const e=[...T].sort((x,y)=>((x.f-x.xf)-(y.f-y.xf)))[0];if(e.f-e.xf<0)out.push(`<b>${esc(e.t)}</b> have scored <b>${(e.xf-e.f).toFixed(1)}</b> goals fewer than their xG this season (${e.f} goals from ${e.xf.toFixed(1)} xG)`)}
 const hm=[...fin].sort((a,b)=>{const x=wkSc(a.score),y=wkSc(b.score);return (y[0]+y[1])-(x[0]+x[1])||String(b.date).localeCompare(String(a.date))})[0],hg=wkSc(hm.score);
 if(hg[0]+hg[1]>=5)out.push(`The highest-scoring match of the season so far: ${mlink(hm)} (${hg[0]+hg[1]} goals)`);
 const lg=S.filter(s=>s.ev==='Goal'&&!s.og&&s.st!=='Penalty'&&fpOk(s.x)).sort((a,b)=>wkDist(b)-wkDist(a))[0];
 if(lg)out.push(`<span>The longest-range goal of the season:</span> <b>${Math.round(wkDist(lg))} metres</b>, ${esc(lg.pn)} <span class="mu">(${esc(lg.c)})</span>, ${wkMl(lg.m)}`);
 return out;
}

/* ---------- League table ---------- */
const LT={step:null,play:null,key:''};
/* a single table only fits a league: every pair meets at most twice and teams have played about as many games */
function ltOk(M){const pr=new Map(),n=new Map();M.forEach(m=>{const k=[m.home,m.away].sort().join('|');pr.set(k,(pr.get(k)||0)+1);n.set(m.home,(n.get(m.home)||0)+1);n.set(m.away,(n.get(m.away)||0)+1)});
 const c=[...n.values()];return c.length>=6&&Math.max(...pr.values())<=2&&Math.max(...c)-Math.min(...c)<=3}
function ltTable(M,tx){
 const T=new Map(),row=t=>{let r=T.get(t);if(!r){r={t,p:0,w:0,d:0,l:0,f:0,a:0,pts:0,xf:0,xa:0,nx:0,form:[]};T.set(t,r)}return r};
 [...M].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.match_id).localeCompare(String(b.match_id))).forEach(m=>{const g=wkSc(m.score);if(!g)return;
  [[m.home,g[0],g[1],m.away],[m.away,g[1],g[0],m.home]].forEach(([t,f,a,o])=>{const r=row(t);r.p++;r.f+=f;r.a+=a;const res=f>a?'W':f<a?'L':'D';r[res.toLowerCase()]++;r.pts+=f>a?3:f===a?1:0;r.form.push(res);
   const xf=tx.get(m.match_id+'|'+t),xa=tx.get(m.match_id+'|'+o);if(xf!=null&&xa!=null){r.xf+=xf;r.xa+=xa;r.nx++}})});
 return [...T.values()].sort((a,b)=>b.pts-a.pts||(b.f-b.a)-(a.f-a.a)||b.f-a.f||a.t.localeCompare(b.t));
}
R.table=async function(el){
 el.innerHTML='<h2>League table</h2><div id="ltroot"><div class="empty">Loading…</div></div>';
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),M=D.matches.filter(m=>wkSc(m.score)&&m.date),root=$('#ltroot');
 if(!M.length){root.innerHTML='<div class="empty">No results in the data yet.</div>';return}
 if(!ltOk(M)){root.innerHTML=`<div class="empty">${esc(D.name)} is a tournament (groups and knockout rounds), so it has no single league table.</div>`;return}
 const dates=[...new Set(M.map(m=>m.date.slice(0,10)))].sort(),key=D.id+'|'+dates.length;
 if(LT.key!==key){LT.key=key;LT.step=dates.length-1;ltStop()}
 root.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:8px"><b>${esc(D.name)}</b><span>, results in the data (${M.length} matches). Ordered by points, then goal difference, then goals scored; a competition's own tiebreakers (such as head-to-head) can differ. xGD = xG for − xG against, from the shot data.</span></div>
 <div class="ctl" style="align-items:center"><button id="ltplay" class="s" onclick="ltToggle()">▶ Replay the season</button><input id="ltrng" type="range" min="0" max="${dates.length-1}" value="${LT.step}" style="flex:1;min-width:140px" aria-label="Date"><span id="ltlab" class="mu" style="min-width:150px"></span></div>
 <div id="lt" class="lt"></div>`;
 LT.M=M;LT.dates=dates;LT.tx=tx;
 $('#ltrng').oninput=e=>{ltStop();ltGo(+e.target.value,true)};
 ltGo(LT.step,false);
};
function ltGo(step,anim){
 const el=$('#lt');if(!el)return;LT.step=step;const d=LT.dates[step],M=LT.M.filter(m=>m.date.slice(0,10)<=d),prev=step>0?ltTable(LT.M.filter(m=>m.date.slice(0,10)<=LT.dates[step-1]),LT.tx):null;
 const rows=ltTable(M,LT.tx),pp=new Map((prev||[]).map((r,i)=>[r.t,i])),old=new Map();
 el.querySelectorAll('.ltr[data-t]').forEach(x=>old.set(x.dataset.t,x.getBoundingClientRect().top));
 const nGames=M.length,fm=f=>f.slice(-5).map(r=>`<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`).join('');
 el.innerHTML=`<div class="ltr lth"><span>#</span><span>Team</span><span class="ltl" data-en="P" data-ar="لعب" title="Played"></span><span class="ltx ltl" data-en="W" data-ar="ف" title="Win"></span><span class="ltx ltl" data-en="D" data-ar="ت" title="Draw"></span><span class="ltx ltl" data-en="L" data-ar="خ" title="Loss"></span><span>GD</span><span>Pts</span><span class="ltx">xGD</span><span class="ltfm">Form</span></div>`+
  rows.map((r,i)=>{const mv=prev&&pp.has(r.t)?pp.get(r.t)-i:0;return `<div class="ltr" data-t="${esc(r.t)}"><span>${i+1}${mv?`<em class="ltm ${mv>0?'up':'dn'}">${mv>0?'▲':'▼'}${Math.abs(mv)}</em>`:''}</span><span class="ltt">${esc(r.t)}</span><span>${r.p}</span><span class="ltx">${r.w}</span><span class="ltx">${r.d}</span><span class="ltx">${r.l}</span><span>${r.f-r.a>0?'+':''}${r.f-r.a}</span><b>${r.pts}</b><span class="ltx">${r.nx?((r.xf-r.xa>0?'+':'')+(r.xf-r.xa).toFixed(1)):'N/A'}</span><span class="ltfm">${fm(r.form)}</span></div>`}).join('');
 $('#ltlab').textContent=`After ${d} (${nGames} matches)`;const rg=$('#ltrng');if(rg&&+rg.value!==step)rg.value=step;
 /* FLIP: each row slides from where it was to its new place (transform only, so it stays smooth on phones) */
 if(anim&&old.size&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.querySelectorAll('.ltr[data-t]').forEach(x=>{const o=old.get(x.dataset.t);if(o==null)return;const dy=o-x.getBoundingClientRect().top;if(Math.abs(dy)>1)x.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:560,easing:'cubic-bezier(.2,.8,.2,1)'})});
}
function ltStop(){if(LT.play){clearInterval(LT.play);LT.play=null}const b=$('#ltplay');if(b)b.textContent='▶ Replay the season'}
function ltToggle(){
 if(LT.play){ltStop();return}
 const b=$('#ltplay');if(b)b.textContent='❚❚ Pause';if(LT.step>=LT.dates.length-1)ltGo(0,false);
 LT.play=setInterval(()=>{if(!$('#lt')){ltStop();return}if(LT.step>=LT.dates.length-1){ltStop();return}ltGo(LT.step+1,true)},900);
}
"""


def _x_eng_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (هذا الأسبوع/جدول الدوري): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_ENGCSS + "</style></head>")
    h = sub(h, "['teams','Teams'],['matches','Matches']", "['teams','Teams'],['table','League table'],['matches','Matches']")
    h = sub(h, "<h3>Top xT</h3>${top(o.top_xt,'xT')}", "<div id=\"wkhl\"></div><h3>Top xT</h3>${top(o.top_xt,'xT')}")
    h = sub(h, "mlink(m),tag(m.status)]))}`},", "mlink(m),tag(m.status)]))}`;wkHL($('#wkhl'))},")
    h = sub(h, "async function route(){", _X_ENGJS + "\nasync function route(){")
    return h


_AR_SEASON.update({
    "League table": "جدول الدوري",
    "This week": "هذا الأسبوع",
    "Fact of the day": "معلومة اليوم",
    "Biggest chance (no penalties)": "أخطر فرصة (بدون ركلات جزاء)",
    "Longest-range goal": "أبعد هدف",
    "Most threatening performance": "أخطر أداء في مباراة",
    "Most clinical": "الأكثر حسماً",
    "Won against the chances": "فاز عكس الفرص",
    "xG #": "xG #",
    "xT #": "xT #",
    "xG # v #": "xG # مقابل #",
    "won with less xG": "فاز بـxG أقل",
    "No shot data for these matches.": "لا توجد بيانات تسديد لهذه المباريات.",
    "has the league's highest xT per 90 this season:": "عنده أعلى xT لكل 90 دقيقة في الدوري هذا الموسم:",
    "has the league's highest xG per 90 this season:": "عنده أعلى xG لكل 90 دقيقة في الدوري هذا الموسم:",
    "(at least # minutes)": "(# دقيقة على الأقل)",
    "create the most chances in the league:": "يصنعون أكثر الفرص في الدوري:",
    "xG a match": "xG لكل مباراة",
    "allow the fewest chances:": "يسمحون بأقل الفرص:",
    "xG against a match": "xG ضدهم لكل مباراة",
    "have scored": "سجّلوا",
    "goals more than their xG this season (# goals from # xG)": "أهداف أكثر من الـxG هذا الموسم (# هدف من # xG)",
    "goals fewer than their xG this season (# goals from # xG)": "أهداف أقل من الـxG هذا الموسم (# هدف من # xG)",
    "The highest-scoring match of the season so far:": "أكثر مباراة أهدافاً في الموسم للحين:",
    "(# goals)": "(# أهداف)",
    "The longest-range goal of the season:": "أبعد هدف في الموسم:",
    "▶ Replay the season": "▶ أعد الموسم",
    "❚❚ Pause": "❚❚ إيقاف مؤقت",
    "Date": "التاريخ",
    "After ### (# matches)": "بعد ### (# مباراة)",
    "Team": "الفريق",
    "Pts": "نقاط",
    "GD": "فارق",
    "Form": "آخر 5",
    "xGD": "فارق xG",
    "Win": "فوز",
    "Draw": "تعادل",
    "Loss": "خسارة",
    "No results in the data yet.": "لا توجد نتائج في البيانات للحين.",
    "is a tournament (groups and knockout rounds), so it has no single league table.": "بطولة (مجموعات وأدوار إقصائية)، فما لها جدول دوري واحد.",
    "results in the data (# matches). Ordered by points, then goal difference, then goals scored": "النتائج الموجودة في البيانات (# مباراة). الترتيب حسب النقاط، ثم فارق الأهداف، ثم الأهداف المسجلة",
    "scored": "سجّل",
    "missed": "أضاع",
    "saved": "تصدّى لها الحارس",
    "hit the post": "ارتطمت بالقائم",
    "Played": "لعب",
    "### – ###, # matches": "من ### إلى ###، # مباراة",
    "# metres": "# م",
    "scored, # metres from goal": "سجّل، على بعد # م من المرمى",
    "missed, # metres from goal": "أضاع، على بعد # م من المرمى",
    "saved, # metres from goal": "تصدّى لها الحارس، على بعد # م من المرمى",
    "hit the post, # metres from goal": "ارتطمت بالقائم، على بعد # م من المرمى",
    "# goal from xG #": "هدف # من xG #",
    "# goals from xG #": "# أهداف من xG #",
    "a competition's own tiebreakers (such as head-to-head) can differ. xGD = xG for − xG against, from the shot data": "وقد تختلف معايير كسر التعادل الخاصة بكل مسابقة (مثل المواجهات المباشرة). فارق xG = xG لهم − xG ضدهم، من بيانات التسديد"
})


INDEX = _x_eng_index(INDEX)
# ======================== نهاية إضافة هذا الأسبوع وجدول الدوري ========================


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


_X_THCSS = ":root{--th:#4cc38a;--th-ink:#06210f;--th-hi:#4cc38a;--th-link:#5aa9e6;--th-deep:#0f3b2c;--th-glow:rgba(76,195,138,.28);--th-soft:rgba(76,195,138,.10);--th-bd:rgba(76,195,138,.38);--th-amb:rgba(15,59,44,.55);--th-amb2:rgba(76,195,138,.07);--gold:#e2bd5a;--gold-bd:rgba(226,189,90,.55);--gold-soft:rgba(226,189,90,.12);--glass:var(--sf);--hdr:var(--bg);--glass-hl:rgba(255,255,255,.06);--glass-bd:rgba(255,255,255,.075)}@supports (color:color-mix(in srgb,red 50%,blue)){:root{--glass:color-mix(in srgb,var(--sf) 88%,transparent);--hdr:color-mix(in srgb,var(--bg) 80%,transparent)}}body{background-color:var(--bg);background-image:radial-gradient(1200px 620px at 100% -12%,var(--th-amb),transparent 60%),radial-gradient(1000px 600px at 0% -10%,var(--th-amb2),transparent 62%);background-attachment:fixed;transition:background-color .35s}header{background:var(--hdr);-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);border-bottom:1px solid transparent;border-image:linear-gradient(90deg,transparent,var(--th-bd),transparent) 1}@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){header{background:var(--bg)}#nav .lgl{background:rgba(255,255,255,.12)}}.bm{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:8px;vertical-align:1px;background:linear-gradient(135deg,#4cc38a,#5aa9e6);box-shadow:0 0 0 1px rgba(255,255,255,.18)}a{color:var(--th-link)}.card,.kpi{background:linear-gradient(180deg,var(--glass-hl),rgba(255,255,255,.012) 40%),var(--glass);border-color:var(--glass-bd);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 22px rgba(0,0,0,.18)}.kpi{background:linear-gradient(150deg,var(--th-kpi,var(--th-soft)),transparent 58%),linear-gradient(180deg,var(--glass-hl),rgba(255,255,255,.012) 40%),var(--glass);transition:border-color .3s,box-shadow .3s}.kpi:hover{border-color:var(--th-bd)}button{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 55%),var(--th);color:var(--th-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 4px 14px var(--th-soft);transition:background-color .35s,color .35s,box-shadow .35s,border-color .35s}button.s{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.015)),var(--sf);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}button.s:hover{border-color:var(--th-bd)}.seg button.on{background:var(--th);color:var(--th-ink)}.chp.on{border-color:var(--th-hi);box-shadow:inset 0 0 0 1px var(--th-hi)}nav a.on{box-shadow:inset 0 -2px var(--th-hi)}#nav .lgl{box-shadow:inset 0 0 0 1px rgba(255,255,255,.16),inset 0 1.5px 1px rgba(255,255,255,.42),inset 0 -1.5px 1px rgba(255,255,255,.14),inset 0 -8px 14px var(--th-soft),0 4px 16px var(--th-glow);transition:box-shadow .35s}input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--th-hi);outline-offset:2px}h2::after{content:'';display:block;width:44px;height:3px;border-radius:2px;margin-top:6px;background:linear-gradient(90deg,var(--th-hi),transparent)}.wkfact{border-color:var(--th-bd)}.cdot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:6px;vertical-align:-1px;background:var(--cldot,linear-gradient(135deg,var(--cl1) 50%,var(--cl2) 50%));box-shadow:0 0 0 1px rgba(255,255,255,.28)}.clk{color:inherit;text-decoration:none}.clk:hover{color:var(--th-link);text-decoration:underline}.ltt a{color:inherit;text-decoration:none}.trophy{width:14px;height:14px;flex:none}.chm{display:inline-flex;vertical-align:-2px;margin-inline-start:6px;color:var(--gold)}.champ{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;border:1px solid var(--gold-bd);background:linear-gradient(180deg,rgba(226,189,90,.18),rgba(226,189,90,.05));color:var(--gold);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;box-shadow:0 0 14px rgba(226,189,90,.12)}.champ .mu2{opacity:.8;font-weight:600;letter-spacing:0}.clubhd{position:relative;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px 14px 26px;margin-bottom:12px;border-radius:14px;border:1px solid var(--glass-bd);background:linear-gradient(135deg,var(--th-soft),rgba(255,255,255,.02) 60%),var(--glass);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 26px rgba(0,0,0,.22);overflow:hidden}.clubhd h2{margin:0 0 2px}.clubtx{flex:1;min-width:160px}.clubst{position:absolute;inset-block:0;inset-inline-start:0;width:10px;background:var(--clst,linear-gradient(180deg,var(--cl1,var(--th-hi)) 0 50%,var(--cl2,var(--th-hi)) 50% 100%));box-shadow:inset -1px 0 0 rgba(255,255,255,.14)}.clubhd.is-champ{border-color:var(--gold-bd);background:linear-gradient(135deg,var(--th-soft),var(--gold-soft) 70%),var(--glass);box-shadow:inset 0 1px 0 rgba(226,189,90,.35),0 0 26px rgba(226,189,90,.10),0 10px 26px rgba(0,0,0,.22)}.clubk .kpi{border-top:2px solid var(--th-hi)}html[dir=rtl] .clubhd{padding:14px 26px 14px 16px}html[dir=rtl] .clubst{box-shadow:inset 1px 0 0 rgba(255,255,255,.14)}@media(max-width:560px){.clubhd{padding-inline-start:22px}.champ{font-size:11px;padding:3px 9px}}@media(prefers-reduced-motion:reduce){button,.kpi,#nav .lgl{transition:none}}.nw{white-space:nowrap}input,progress{accent-color:var(--th)}.ltf.D{background:#8a9bb0}.brand{display:inline-flex;align-items:center;gap:10px}.lglogo{width:32px;height:32px;object-fit:contain;border-radius:8px;padding:3px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(0,0,0,.25)}.lglogo[hidden]{display:none}.clogo{width:18px;height:18px;object-fit:contain;vertical-align:-4px;margin-inline-end:7px;filter:drop-shadow(0 0 1px rgba(255,255,255,.55))}.clubimg{width:58px;height:58px;object-fit:contain;flex:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35)) drop-shadow(0 0 1px rgba(255,255,255,.5))}@media(max-width:560px){.lglogo{width:28px;height:28px}.clubimg{width:46px;height:46px}}"
_X_THJS = r"""/* ===== Theme: league colours, club colours and defending champions =====
   One configuration for every colour that carries identity. Layers:
   1. PL Analytics (wordmark, layout) — always the same; THEME.base is the original dark navy look;
   2. the selected league colours the whole page in its shades (THEME.leagues, by PitchAPI league ID); a league without a
      checked identity keeps THEME.base;
   3. a club's own page is drawn in the club's shades instead (THEME.clubs: up to four colours, each with its share); its stripe
      and dot show every colour at its share;
   4. gold, only for a defending champion that data/champions.json verifies for the current season.
   Statistical colours (chart panels and marks, form, heatmaps, status green/red/amber) are not part of the theme. */
const THEME={
 base:{key:'base',bg:'#0d1520',sf:'#152130',ln:'#25374d',tx:'#e8eef5',mu:'#8a9bb0',th:'#4cc38a',ink:'#06210f',hi:'#4cc38a',link:'#5aa9e6',deep:'#0f3b2c'},
 /* base = identity colour; the page shades are derived from it (thPalette). The Premier League shades follow its purple and
    magenta identity directly. */
 leagues:[
  {key:'pl',ids:['l_4WFCIZ'],label:'Premier League purple',base:'#c414dc',pal:{bg:'#2a0030',sf:'#3d0045',ln:'#5e1a6a',th:'#c414dc',hi:'#e05cf0',link:'#f0a6ff',mu:'#d9bfe0',deep:'#38003c'}},
  {key:'bund',ids:['l_1Isor4'],label:'Bundesliga red',base:'#d10214'},
  {key:'laliga',ids:['l_0ErfuF'],label:'LaLiga coral red',base:'#ff4b44'},
  {key:'seriea',ids:['l_0ALvwF'],label:'Serie A blue',base:'#0059d6'},
  {key:'ucl',ids:['l_0bfbkO'],label:'Champions League navy',base:'#3550c8'}
 ],
 /* each club's colours with their approximate share of its identity (home kit and crest together), largest first, up to four:
    'hex:share'. They are commonly used values, not official brand files. '!' marks the colour the club page is drawn in when it is
    not the first strong colour. A club not listed takes the colours of its crest, measured from the logo (thCrest). */
 clubs:{
  /* Premier League */
  'afc bournemouth':'da291c:45 000000:43 ffffff:12','arsenal':'ef0107:58 ffffff:30 063672:8 9c824a:4','aston villa':'670e36:58 95bfe5:30 fee505:12',
  'brentford':'e30613:45 ffffff:35 000000:20','brighton & hove albion':'0057b8:58 ffffff:42','chelsea':'034694:68 ffffff:20 dba111:8 ee242c:4',
  'coventry city':'59cbe8:70 ffffff:30','crystal palace':'1b458f:46 c4122e:42 ffffff:12','everton':'003399:62 ffffff:38',
  'fulham':'ffffff:62 000000:33 cc0000:5','hull city':'f5a12d:55 000000:45','ipswich town':'0044a9:62 ffffff:30 de2c37:8',
  'leeds united':'ffffff:68 1d428a:20 ffcd00:12','liverpool':'c8102e:84 ffffff:6 00b2a9:5 f6eb61:5','manchester city':'6cabdd:62 ffffff:25 1c2c5b:13',
  'manchester united':'da291c:55 ffffff:22 000000:15 fbe122:8','newcastle united':'ffffff:46 241f20:46 41b6e6:8','nottingham forest':'dd0000:65 ffffff:35',
  'sunderland':'eb172b:46 ffffff:40 000000:14','tottenham hotspur':'ffffff:62 132257:38',
  /* LaLiga */
  'athletic club':'ee2523:45 ffffff:40 000000:15','atlético madrid':'cb3524:45 ffffff:35 272e61:20','barcelona':'a50044:42 004d98:42 edbb00:16',
  'celta vigo':'8ac3ee:65 ffffff:25 e5254e:10','deportivo a coruña':'0045a8:50 ffffff:50','deportivo alavés':'0761af:55 ffffff:45',
  'elche':'ffffff:62 05642c:33 c3132d:5','espanyol':'0072ce:55 ffffff:45','getafe':'005999:75 ffffff:25','levante':'b4053f:45 0c4da2:45 ffffff:10',
  'málaga':'0099d8:52 ffffff:40 c69214:8','osasuna':'d91a21:62 0a346f:30 c9a43a:8','racing santander':'ffffff:60 009b48:30 000000:10',
  'rayo vallecano':'ffffff:72 e53027:28','real betis':'00954c:50 ffffff:45 c78912:5','real madrid':'ffffff:58 febe10:18 !00529f:14 ee3124:10',
  'real sociedad':'0067b1:52 ffffff:43 e2a03a:5','sevilla':'ffffff:65 d71920:35','valencia':'ffffff:55 000000:30 ee3524:8 fbd200:7',
  'villarreal':'ffe667:65 005187:25 e30613:10',
  /* Bundesliga */
  '1. fc köln':'ffffff:55 ed1c24:35 000000:10','augsburg':'ffffff:50 ba3733:30 46714d:20','bayer leverkusen':'e32221:50 000000:40 ffffff:10',
  'bayern münchen':'dc052d:62 ffffff:25 0066b2:13','borussia dortmund':'fde100:60 000000:40','borussia mönchengladbach':'ffffff:55 000000:30 00a14b:15',
  'eintracht frankfurt':'e1000f:40 000000:35 ffffff:25','elversberg':'000000:50 ffffff:50','freiburg':'e2001a:45 000000:35 ffffff:20',
  'hamburger sv':'ffffff:45 0a3f86:30 000000:15 e4002b:10','hoffenheim':'1961b5:62 ffffff:38','mainz 05':'c3141e:62 ffffff:38',
  'paderborn':'005ca9:45 000000:40 ffffff:15','rb leipzig':'ffffff:55 dd0741:27 0c2043:13 ffc200:5','schalke 04':'004d9d:62 ffffff:38',
  'union berlin':'eb1923:55 ffffff:35 f8e864:10','vfb stuttgart':'ffffff:60 e32219:30 fce20e:10','werder bremen':'1d9053:62 ffffff:38',
  /* Serie A */
  'atalanta':'1e71b8:45 000000:45 ffffff:10','bologna':'a21c26:45 1a2f48:45 ffffff:10','cagliari':'ad002a:45 002350:45 ffffff:10',
  'como':'0c4ea6:65 ffffff:35','fiorentina':'482e92:72 ffffff:20 e30613:8','frosinone':'ffd200:50 0047ab:45 ffffff:5',
  'genoa':'a51e36:46 002147:46 ffd100:8','inter':'010e80:45 000000:42 ffffff:13','juventus':'000000:50 ffffff:50',
  'lazio':'87d8f7:62 ffffff:28 d5ba61:10','lecce':'ffd200:50 e30613:50','milan':'fb090b:42 000000:42 ffffff:16','monza':'e4002b:62 ffffff:38',
  'napoli':'12a0d7:75 ffffff:25','parma':'ffffff:55 000000:20 ffd200:13 1b4093:12','roma':'8e1f2f:65 f0bc42:30 ffffff:5',
  'sassuolo':'00a752:50 000000:50','torino':'881f19:75 ffffff:25','udinese':'000000:50 ffffff:50','venezia':'000000:60 f36f21:15 00703c:15 ffffff:10',
  /* Ligue 1 */
  'angers':'000000:50 ffffff:50','auxerre':'ffffff:55 004c9f:45','brest':'ea1d25:65 ffffff:35','le havre':'86bee1:45 18315d:45 ffffff:10',
  'lens':'fcd116:50 ec1c24:45 000000:5','lille':'e01e13:55 20325f:35 ffffff:10','lorient':'f36f23:55 000000:35 ffffff:10',
  'lyon':'ffffff:60 da001a:20 0e23a7:20','marseille':'ffffff:65 2faee0:35','monaco':'e30613:50 ffffff:45 dfa843:5',
  'nice':'cc0000:45 000000:45 ffffff:10','paris fc':'0c052f:55 499cc9:30 ffffff:15','paris saint-germain':'004170:60 da291c:20 ffffff:20',
  'rennes':'e23327:50 000000:45 ffffff:5','strasbourg':'009fe3:60 ffffff:30 e30613:10','toulouse':'5b2d86:65 ffffff:35','troyes':'036bad:60 ffffff:40',
  /* Liga Portugal */
  'académico viseu':'000000:60 ffffff:40','arouca':'ffde00:55 0047ab:45','benfica':'e83030:62 ffffff:30 c8a659:8','braga':'d50f19:60 ffffff:35 c7a147:5',
  'estoril':'ffde00:55 0047ab:45','famalicão':'1d3c6e:50 ffffff:35 f1ca1e:15','fc porto':'003893:52 ffffff:43 f4c300:5',
  'marítimo':'d50f19:45 006b3f:45 ffffff:10','moreirense':'00843d:55 ffffff:45','nacional':'000000:50 ffffff:40 e9bf24:10',
  'rio ave':'00843d:55 ffffff:45','santa clara':'d7262f:62 ffffff:38','sporting cp':'008057:55 ffffff:45','vitória de guimarães':'ffffff:60 000000:40',
  /* other Champions League clubs */
  'aek athens':'fcd309:55 000000:45','bodø/glimt':'fcde00:65 000000:35','club brugge':'0063b3:45 000000:45 ffffff:10',
  'fenerbahçe':'ffed00:45 002d72:45 ffffff:10','feyenoord':'e30613:45 ffffff:40 000000:15','galatasaray':'a90432:50 fdb912:50',
  'lask':'000000:50 ffffff:50','psv eindhoven':'ed1c24:55 ffffff:40 000000:5','shakhtar donetsk':'f26522:60 000000:40',
  'slavia prague':'ffffff:50 e30613:50','slovan bratislava':'4fb3e8:60 ffffff:30 1e3e8c:10'
 },
 gold:'#e2bd5a'
};
const thRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const thA=(h,a)=>'rgba('+thRgb(h).join(',')+','+a+')';
const thLum=h=>{const c=thRgb(h).map(v=>v/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const thCr=(a,b)=>{const x=thLum(a),y=thLum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
/* shades for a whole page from one identity colour (HSL), each step checked for contrast; used for leagues and clubs */
const thHex=(h,s,l)=>{s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')};
const thHsl=hex=>{const [r,g,b]=thRgb(hex).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
 if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return [h,s,l]};
/* lightest/darkest version of (h,s) that reaches the contrast ratio c against every background in bgs */
function thReach(h,s,l,bgs,c,up=true){for(let i=0;i<=100;i++){const x=thHex(h,s,up?l+i/100:l-i/100);if(bgs.every(b=>thCr(x,b)>=c))return x}return up?'#ffffff':'#000000'}
function thPalette(base,o={},alt=null){
 /* neutral clubs (black and white): the lighter colour leads */
 if(alt&&thHsl(base)[1]<.12&&thHsl(alt)[1]<.12&&thLum(alt)>thLum(base))[base,alt]=[alt,base];
 const [h,s0,l0]=thHsl(base),s=Math.min(s0,.92),neutral=s0<.12;
 const bg=o.bg||thHex(h,neutral?0:s*.85,.085),sf=o.sf||thHex(h,neutral?0:s*.7,.135),ln=o.ln||thHex(h,neutral?0:s*.45,.26),B=[bg,sf];
 /* buttons: visible on the page (3:1) with readable text (4.5:1): the club's own colour, then a little darker or lighter, then its second colour */
 const okTh=x=>Math.min(thCr(x,bg),thCr(x,sf))>=3,inkOf=(x,other)=>[other,'#ffffff','#0b0b0b'].filter(Boolean).find(i=>thCr(i,x)>=4.5);
 let th=o.th,ink=th?inkOf(th):null;
 if(!th){const dk=Array.from({length:12},(_,i)=>[thHex(h,s0,l0-(i+1)/100),alt]),lt=n=>Array.from({length:n},(_,i)=>[thHex(h,s0,l0+(i+1)/100),alt]);
  const cands=[[base,alt],...dk,...lt(35),...(alt?[[alt,base]]:[]),...lt(70).slice(35)];
  for(const [c,other] of cands){const k=inkOf(c,other);if(okTh(c)&&k){th=c;ink=k;break}}
  if(!th){th=thReach(h,s,l0,B,3);ink=inkOf(th)||'#ffffff'}}
 return {bg,sf,ln,th,ink,tx:'#f3eef6',
  mu:o.mu||thReach(h,neutral?0:.25,.68,B,4.5),hi:o.hi||thReach(h,neutral?0:s,.55,B,3),link:o.link||thReach(h,neutral?0:Math.min(s,.85),.74,B,4.5),
  deep:o.deep||thHex(h,neutral?0:s,.2)};
}

const TH_CACHE=new Map();
function thLeague(id){return THEME.leagues.find(t=>t.ids.includes(id))||null}
function thLeaguePal(id){const t=thLeague(id);if(!t)return THEME.base;if(!TH_CACHE.has(t.key))TH_CACHE.set(t.key,Object.assign({key:t.key},thPalette(t.base,t.pal||{})));return TH_CACHE.get(t.key)}
/* a club's colours as [{c,w,lead}] (largest share first): configured, else measured from its crest; null when neither */
const TH_PARSE=new Map();
function thParse(v){if(!v)return null;if(Array.isArray(v))return v;if(!TH_PARSE.has(v))TH_PARSE.set(v,v.trim().split(/\s+/).map(x=>{const m=/^(!?)([0-9a-f]{6}):(\d+)$/i.exec(x);return m?{c:'#'+m[2].toLowerCase(),w:+m[3],lead:!!m[1]}:null}).filter(Boolean));return TH_PARSE.get(v)}
const clubCols=name=>thParse(THEME.clubs[String(name||'').toLowerCase().trim()])||crestOf(name);
const thNeutral=c=>thHsl(c)[1]<.12;
/* the page is drawn in the club's leading colour: the one marked '!', else its largest colour that is not white, black or grey
   and has at least a fifth of the share (a small accent does not colour a black-and-white club's page; those use the lighter
   neutral); the second colour is the next one that differs from it */
function thClubPal(name){
 const n=String(name||'').toLowerCase().trim(),L=clubCols(name);if(!L||!L.length)return null;
 const tot=L.reduce((a,x)=>a+x.w,0)||1,lead=(L.find(x=>x.lead)||L.find(x=>!thNeutral(x.c)&&x.w/tot>=.2)||L[0]).c,alt=(L.find(x=>x.c!==lead)||{c:null}).c,k='club:'+n+'|'+lead+'|'+alt;
 if(!TH_CACHE.has(k))TH_CACHE.set(k,Object.assign({key:'club'},thPalette(lead,{},alt)));
 return TH_CACHE.get(k);
}
/* applies the league's colours, or the club's when its own page is open (club = the club's name) */
function applyTheme(club){
 const r=document.documentElement,s=r.style,lp=thLeaguePal(D&&D.id),cp=club?thClubPal(club):null,t=cp||lp;
 r.dataset.league=lp.key;if(cp)r.dataset.club=String(club);else delete r.dataset.club;
 const v={'--bg':t.bg,'--sf':t.sf,'--ln':t.ln,'--tx':t.tx,'--mu':t.mu,'--th':t.th,'--th-ink':t.ink,'--th-hi':t.hi,'--th-link':t.link,'--th-deep':t.deep,
  '--th-glow':thA(t.hi,.30),'--th-kpi':thA(t.hi,t===THEME.base?.08:.22),'--th-soft':thA(t.hi,.12),'--th-bd':thA(t.hi,.40),'--th-amb':thA(t.hi,t===THEME.base?.06:.16),'--th-amb2':thA(t.deep,t===THEME.base?.5:.9)};
 for(const k in v)s.setProperty(k,v[k]);
 champLoad();logoLoad().then(logoHeader);
}
/* a club's colours for its stripe (top to bottom) and dot (clockwise), each band as wide as the colour's share; the accent is its
   first colour that reaches 3:1 on the page */
function clubColors(name){
 const L=clubCols(name);if(!L||!L.length)return null;const tot=L.reduce((a,x)=>a+x.w,0)||1;let acc=0;
 const stops=L.map(x=>{const a=acc;acc+=x.w/tot*100;return [x.c,+a.toFixed(2),+acc.toFixed(2)]});
 return {list:L,c1:L[0].c,c2:(L[1]||L[0]).c,hi:(L.find(x=>thCr(x.c,'#0d1520')>=3)||{c:null}).c,
  stripe:'linear-gradient(180deg,'+stops.map(([c,a,b])=>`${c} ${a}% ${b}%`).join(',')+')',
  dot:'conic-gradient('+stops.map(([c,a,b])=>`${c} ${a}% ${b}%`).join(',')+')',
  title:L.map(x=>x.c+' '+Math.round(x.w/tot*100)+'%').join(', ')};
}
const clubVars=name=>{const c=clubColors(name);return c?`--cl1:${c.c1};--cl2:${c.c2};--clhi:${c.hi||'var(--th-hi)'};--clst:${c.stripe};--cldot:${c.dot}`:''};
/* the club's logo when the data has one, else a dot in its colours */
const clubDot=name=>{const s=logoOf(name);if(s)return `<img class="clogo" src="${s}" alt="" aria-hidden="true" loading="lazy">`;const c=clubColors(name);return c?`<i class="cdot" aria-hidden="true" style="${clubVars(name)}"></i>`:''};
function clubLink(name){return `<a class="clk" href="#/club/${encodeURIComponent(name)}">${clubDot(name)}${esc(name)}</a>${champMark(name)}${euroMarks(name)}`}

/* ===== Logos and crest colours =====
   Club and league logos come from PitchAPI (the same provider as the data) and are stored by the sync in data/logos_<league>.json.
   A club without configured colours (THEME.clubs) takes the colours measured from its crest, with their shares; the page palette
   is then built and checked by thPalette exactly as for every other theme. Without a logo, nothing changes. */
const LOGO={p:{},d:{}},CREST=new Map();
function logoLoad(){
 const id=D&&D.id,m=(ALL.leagues||[]).find(l=>l.id===id)||{};if(!id||!m.logo_file)return Promise.resolve(null);
 if(!LOGO.p[id])LOGO.p[id]=fetch('data/'+m.logo_file+'?v='+encodeURIComponent(m.logo_v||'')).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{LOGO.d[id]=d;return d});
 return LOGO.p[id];
}
const logoOf=name=>{const d=LOGO.d[D&&D.id];return (d&&d.teams&&d.teams[name])||null};
const leagueLogo=()=>{const d=LOGO.d[D&&D.id];return (d&&d.league)||null};
function logoHeader(){const im=document.getElementById('lglogo');if(!im)return;const s=leagueLogo();if(s){im.src=s;im.alt=D.name;im.hidden=false}else{im.removeAttribute('src');im.hidden=true}}
/* the crest's colours with their shares: opaque pixels are grouped (k-means in Lab, from the most distant colours), groups
   closer than ΔE 16 are joined, and groups under 4% (anti-aliased edges, small details) are left out; up to four remain */
function thLab(r,g,b){const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)},R=f(r),G=f(g),B=f(b),F=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
 const X=F((R*.4124+G*.3576+B*.1805)/.95047),Y=F(R*.2126+G*.7152+B*.0722),Z=F((R*.0193+G*.1192+B*.9505)/1.08883);return [116*Y-16,500*(X-Y),200*(Y-Z)]}
function thClusters(P,k=6){
 const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;let C=[P[0].l];
 while(C.length<k){let far=null,fd=-1;for(const p of P){const d=Math.min(...C.map(c=>d2(c,p.l)));if(d>fd){fd=d;far=p.l}}if(fd<64)break;C.push(far)}
 let G=[];for(let it=0;it<10;it++){G=C.map(()=>({n:0,l:[0,0,0],r:[0,0,0]}));
  for(const p of P){let bi=0,bd=1e9;C.forEach((c,i)=>{const d=d2(c,p.l);if(d<bd){bd=d;bi=i}});const g=G[bi];g.n++;for(let j=0;j<3;j++){g.l[j]+=p.l[j];g.r[j]+=p.r[j]}}
  C=G.map((g,i)=>g.n?g.l.map(v=>v/g.n):C[i])}
 let out=G.filter(g=>g.n).map(g=>({n:g.n,l:g.l.map(v=>v/g.n),r:g.r.map(v=>v/g.n)})).sort((a,b)=>b.n-a.n);
 for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++)if(Math.sqrt(d2(out[i].l,out[j].l))<16){const a=out[i],b=out[j],n=a.n+b.n;a.r=a.r.map((v,q)=>(v*a.n+b.r[q]*b.n)/n);a.l=a.l.map((v,q)=>(v*a.n+b.l[q]*b.n)/n);a.n=n;out.splice(j,1);j=i}
 const tot=P.length;out=out.filter(g=>g.n/tot>=.04).sort((a,b)=>b.n-a.n).slice(0,4);const s=out.reduce((a,g)=>a+g.n,0);
 return out.map(g=>({c:'#'+g.r.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),w:Math.round(g.n/s*100),lead:false}));
}
function thCrest(src){return new Promise(res=>{const im=new Image();im.onload=()=>{try{
 const N=48,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,N,N);const p=x.getImageData(0,0,N,N).data,P=[];
 for(let i=0;i<p.length;i+=4)if(p[i+3]>=200)P.push({r:[p[i],p[i+1],p[i+2]],l:thLab(p[i],p[i+1],p[i+2])});
 res(P.length?thClusters(P):null)}catch(e){res(null)}};im.onerror=()=>res(null);im.src=src})}
/* colours of a club: configured kit colours first, else its crest (computed once) */
async function crestFor(name){
 if(THEME.clubs[String(name||'').toLowerCase().trim()])return;const k=(D&&D.id)+'|'+name;if(CREST.has(k))return;
 const s=logoOf(name);CREST.set(k,s?await thCrest(s):null);
}
const crestOf=name=>CREST.get((D&&D.id)+'|'+name)||null;

/* ---------- defending champions ---------- */
/* data/champions.json (written by the sync from verified results): {leagues:{<league id>:{season,next,team,...}}}.
   A club gets the gold treatment only when the entry is for the season before the one in the data (next = current season)
   and its name matches exactly one club of the league. Nothing is shown when the file or the entry is missing. */
const CHAMP={p:null,d:null};
function champLoad(){if(!CHAMP.p)CHAMP.p=fetch('data/champions.json?v='+encodeURIComponent((ALL&&ALL.generated)||'')).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{CHAMP.d=d;return d});return CHAMP.p}
const champReady=()=>Promise.all([champLoad(),logoLoad(),euroLoad()]);
/* season of the league's data from its first match: a season starting in July or later is "YYYY-YY", else the calendar year */
function curSeason(){const ds=D.matches.map(m=>String(m.date||'').slice(0,10)).filter(Boolean).sort();if(!ds.length)return null;const y=+ds[0].slice(0,4),mo=+ds[0].slice(5,7);return mo>=7?y+'-'+String(y+1).slice(2):String(y)}
function champInfo(){
 const e=CHAMP.d&&CHAMP.d.leagues&&CHAMP.d.leagues[D.id];if(!e||!e.team||e.next!==curSeason())return null;
 const teams=[...new Set(D.matches.flatMap(m=>[m.home,m.away]))],hit=teams.filter(t=>fpTeamEq(t,e.team));
 return hit.length===1?{team:hit[0],season:e.season,e}:null;
}
const isChamp=name=>{const c=champInfo();return !!c&&c.team===name};
const thTrophy='<svg class="trophy" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1.2 1.8A5 5 0 0 1 7 8.5V7zm10 0v1.5c0 .5-.1.9-.2 1.3A2 2 0 0 0 18 8V7h-1zM7 20h10v1H7z"/></svg>';
function champMark(name){if(!isChamp(name))return '';const s=champInfo().season;return `<span class="chm" title="Defending champions ${esc(s)}" aria-label="Defending champions ${esc(s)}">${thTrophy}</span>`}
function champBadge(name){if(!isChamp(name))return '';return `<span class="champ">${thTrophy}<span>Defending champions</span><span class="mu2">${esc(champInfo().season)}</span></span>`}

/* ---------- club page ---------- */
R.club=async function(el,arg){
 const name=decodeURIComponent(arg||''),M=D.matches.filter(m=>m.home===name||m.away===name);
 if(!M.length&&!D.stats.some(s=>s.club===name)){el.innerHTML='<div class="empty">Club not found.</div>';return}
 await champReady();await crestFor(name);applyTheme(name);
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),mine=fin.filter(m=>m.home===name||m.away===name);
 const lg=ltOk(fin)?ltTable(fin,tx):null,pos=lg?lg.findIndex(r=>r.t===name):-1,me=lg&&pos>=0?lg[pos]:ltTable(mine,tx).find(r=>r.t===name);
 const champ=isChamp(name),cv=clubVars(name),f1=x=>x.toFixed(2);
 const sq=agg().filter(p=>p.club===name).sort((a,b)=>(b.xt??-1)-(a.xt??-1)).slice(0,20);
 const rec=[...mine].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map(m=>{const g=wkSc(m.score),h=m.home===name,f=h?g[0]:g[1],a=h?g[1]:g[0],r=f>a?'W':f<a?'L':'D';
  return [`<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`,esc(m.date.slice(0,10)),mlink(m)]});
 el.innerHTML=`<div class="clubhd${champ?' is-champ':''}" style="${cv}"><div class="clubst" aria-hidden="true" title="${esc((clubColors(name)||{}).title||'')}"></div>${logoOf(name)?`<img class="clubimg" src="${logoOf(name)}" alt="" aria-hidden="true">`:''}<div class="clubtx"><h2>${esc(name)}</h2><div class="mu">${esc(D.name)}${curSeason()?'<span class="nw"> · '+esc(curSeason())+'</span>':''}</div>${clubComps(name)}</div>${champ?champBadge(name):''}</div>
 <div class="grid clubk" style="${cv}">${[
   [lg&&pos>=0?String(pos+1):'N/A',lg&&pos>=0?'Position of '+lg.length:'Position'],
   [me?String(me.pts):'N/A','Points'],[me?me.w+'-'+me.d+'-'+me.l:'N/A','Won-drawn-lost'],[me?me.f+'-'+me.a:'N/A','Goals for-against'],
   [me&&me.nx?f1(me.xf/me.nx):'N/A','xG for a match'],[me&&me.nx?f1(me.xa/me.nx):'N/A','xG against a match']
  ].map(([v,k])=>`<div class="kpi"><b>${v}</b><span>${esc(k)}</span></div>`).join('')}</div>
 ${champ?`<div class="mu" style="font-size:12px;margin:2px 0 12px" title="${esc(champInfo().e.src||'')}">${esc(name)} ${champInfo().e.kind==='cup'?`<span>won the ${esc(champInfo().season)} final, worked out from that season's verified results.</span>`:`<span>won the ${esc(champInfo().season)} league, worked out from that season's verified results. The current table is separate: being top now does not make a club champions.</span>`}</div>`:''}
 ${await fxSection(D.id,name)}
 <h3>Recent results</h3>${rec.length?tbl([[''],['Date'],['Match']],rec):'<div class="empty">No results in the data yet.</div>'}
 <h3>Players by xT</h3>${sq.length?tbl([['Player'],['Pos'],['Games',1],['Min',1],['xT',1],['xG',1]],sq.map(p=>[`<a href="#/player/${encodeURIComponent(p.key+'||'+p.club)}">${esc(p.player)}</a>`,p.pos||'N/A',p.games,p.minutes==null?'N/A':Math.round(p.minutes),f(p.xt),f(p.xg)])):'<div class="empty">No player data for this club yet.</div>'}`;
};
"""


def _x_theme_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (هوية الألوان): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_THCSS + "</style></head>")
    h = sub(h, '<div class="top"><b>PL Analytics</b>', '<div class="top"><span class="brand"><img id="lglogo" class="lglogo" alt="" hidden><b><i class="bm" aria-hidden="true"></i>PL Analytics</b></span>')
    h = sub(h, "try{localStorage.setItem('league',D.id)}catch(e){}\n", "try{localStorage.setItem('league',D.id)}catch(e){}\n applyTheme();\n")
    h = sub(h, "(pg==='player'&&k==='players')?'on':''", "(pg==='player'&&k==='players')||(pg==='club'&&k==='teams')?'on':''")
    h = sub(h, "async teams(el){\n  const r=await api('/api/teams');", "async teams(el){\n  await champReady();const r=await api('/api/teams');")
    h = sub(h, "r.rows.map(x=>[esc(x.club),x.matches,x.players,f(x.xt),f(x.xg)])", "r.rows.map(x=>[clubLink(x.club),x.matches,x.players,f(x.xt),f(x.xg)])")
    h = sub(h, "<span class=\"ltt\">${esc(r.t)}</span>", "<span class=\"ltt\"><a href=\"#/club/${encodeURIComponent(r.t)}\">${clubDot(r.t)}${esc(r.t)}</a>${champMark(r.t)}${euroMarks(r.t)}</span>")
    h = sub(h, "R.table=async function(el){\n", "R.table=async function(el){\n await champReady();\n")
    h = sub(h, "async player(el,arg){\n  const [key,club]=decodeURIComponent(arg).split('||');", "async player(el,arg){\n  await champReady();const [key,club]=decodeURIComponent(arg).split('||');")
    h = sub(h, "<h2>${esc(r.rows[0].player)}</h2><div class=\"mu\">${esc(club)} · ${r.rows[0].pos||'position N/A'}</div>",
            "<h2>${esc(r.rows[0].player)}</h2><div class=\"mu\" style=\"${clubVars(club)}\">${clubLink(club)} · ${r.rows[0].pos||'position N/A'}</div>${champBadge(club)?`<div style=\"margin:8px 0\">${champBadge(club)}</div>`:''}")
    h = sub(h, "async function route(){", _X_THJS + "\nasync function route(){")
    h = sub(h, " const [,pg='overview',arg='']=(location.hash||'#/overview').split('/');\n", " const [,pg='overview',arg='']=(location.hash||'#/overview').split('/');\n applyTheme(pg==='club'?decodeURIComponent(arg):null);\n")
    return h


_AR_SEASON.update({
    "Defending champions": "حامل اللقب",
    "Defending champions ##": "حامل لقب ##",
    "Club not found.": "النادي غير موجود.",
    "Position": "المركز",
    "Position of #": "المركز من #",
    "Won-drawn-lost": "فوز-تعادل-خسارة",
    "Goals for-against": "الأهداف له-عليه",
    "xG for a match": "xG له في المباراة",
    "xG against a match": "xG عليه في المباراة",
    "Recent results": "آخر النتائج",
    "Players by xT": "اللاعبون حسب xT",
    "No player data for this club yet.": "لا توجد بيانات لاعبين لهذا النادي للحين.",
    "won the ## league, worked out from that season's verified results. The current table is separate: being top now does not make a club champions.": "فاز بدوري ## حسب نتائج ذاك الموسم الموثقة. جدول الموسم الحالي شيء آخر: تصدّر الجدول الحالي لا يجعل النادي حامل اللقب."
})


INDEX = _x_theme_index(INDEX)
# ======================== نهاية إضافة هوية الألوان ========================

# ============================================================================
# إضافة: البطولات — أبطال الموسم الماضي لكل دوري وبطولة أوروبية (من نتائج PitchAPI الموثقة)، مشاركات الأندية هذا الموسم
# في دوري الأبطال والدوري الأوروبي ودوري المؤتمرات، ومواعيد المباريات القادمة لكل دوري.
# كل الطلبات هنا قليلة ومحفوظة: الأبطال مرة لكل موسم، المشاركات كل 12 ساعة، المواعيد كل ساعة.
# ============================================================================
TITLES_RETRY_H = 24               # بطل ما قدرنا نثبته: نعيد المحاولة بعد يوم
TITLES_METHOD = 2                 # يزيد كل ما تحسّنت طريقة الإثبات، فالمحاولات الفاشلة القديمة تُعاد فوراً
EURO_REFRESH_H = 12
FIX_REFRESH_MIN = 60
FIX_MAX = 80                      # أقصى عدد مباريات قادمة نحفظها لكل دوري
EURO_PATH = "data/europe.json"
FIX_PATH = "data/fixtures.json"
EURO_COMPS = (
    dict(key="ucl", label="Champions League", known="l_0bfbkO", words=("champions league",), exclude=("afc", "caf", "concacaf", "ofc", "asia", "africa")),
    dict(key="uel", label="Europa League", words=("europa league",), exclude=("conference",)),
    dict(key="uecl", label="Conference League", words=("conference league",), exclude=("concacaf",)),
)


def _season_label(s):
    """'2025/2026' → '2025-26'، '2026' → '2026' (نفس صيغة الموسم في الصفحة)."""
    s = str(s or "").strip()
    m = re.match(r"^(\d{4})\D+(\d{2,4})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)[-2:]}"
    return s if re.match(r"^\d{4}$", s) else None


def _season_prev(seasons, cur):
    """الموسم اللي قبل cur من قائمة المواسم اللي يقبلها PitchAPI للدوري."""
    ys = sorted({str(s) for s in (seasons or []) if re.match(r"^\d{4}", str(s))}, key=lambda s: s[:4])
    older = [s for s in ys if s[:4] < str(cur)[:4]]
    return older[-1] if older else None


def _league_title(rows):
    """rows = [(home, away, gh, ga)] لموسم دوري كامل (كل فريق لعب مع كل فريق ذهاباً وإياباً).
    البطل = صاحب أكثر النقاط بفارق واضح. إذا تساوى الأول والثاني بالنقاط ما نحكم (معايير كسر التعادل تختلف بين الدوريات)."""
    # الدوري نفسه = الأندية اللي لعبت الموسم كامل؛ مباريات الملحق مع نادٍ من الدرجة الثانية (لعب مباراة أو اثنتين) ما تدخل
    games = {}
    for r in rows:
        for t in r[:2]:
            games[t] = games.get(t, 0) + 1
    top = max(games.values()) if games else 0
    teams = sorted(t for t, g in games.items() if g * 2 >= top)
    rows = [r for r in rows if r[0] in teams and r[1] in teams]
    n = len(teams)
    if n < 4 or len(rows) != n * (n - 1):
        return None, f"{len(rows)} of {n * (n - 1)} fixtures"
    if len({(r[0], r[1]) for r in rows}) != len(rows):
        return None, "duplicate fixtures"
    T = {t: [0, 0, 0] for t in teams}
    for h, a, x, y in rows:
        for t, f, g in ((h, x, y), (a, y, x)):
            T[t][0] += 3 if f > g else 1 if f == g else 0
            T[t][1] += f - g
            T[t][2] += f
    o = sorted(T.items(), key=lambda kv: (-kv[1][0], -kv[1][1], -kv[1][2]))
    (w, a), (u, b) = o[0], o[1]
    if a[0] == b[0]:
        return None, f"{w} and {u} level on points"
    return dict(team=w, pts=a[0], gd=a[1], gf=a[2], runner_up=u, margin=a[0] - b[0], fixtures=len(rows)), None


_PEN_PERIOD = re.compile(r"pen|shoot|^ps$", re.I)


def _shootout(client, m):
    """الفائز بركلات الترجيح من أحداث المباراة (إذا موجودة)، وإلا None."""
    ev, err = call(client.matches.events, m.id)
    if ev is None:
        return None, f"events: {err}"
    evs = list(getattr(ev, "events", None) or [])
    pens = [e for e in evs if _PEN_PERIOD.search(str(getattr(e, "period", "") or "")) and "goal" in str(getattr(e, "event_type", "")).lower()
            and "miss" not in str(getattr(e, "event_type", "")).lower()]
    kinds = sorted({f"{getattr(e, 'period', '')}/{getattr(e, 'event_type', '')}" for e in evs})[:12]
    hid, aid = str(m.home_team.id), str(m.away_team.id)
    nh = sum(1 for e in pens if str(getattr(e, "team_id", "")) == hid)
    na = sum(1 for e in pens if str(getattr(e, "team_id", "")) == aid)
    if pens and nh != na and nh + na == len(pens):
        return (m.home_team.name if nh > na else m.away_team.name, f"{nh}-{na}"), None
    # الأحداث فيها فترة الترجيح بدون الأهداف: نعدّ تسديدات فترة الترجيح من بيانات التسديد
    sh, err = call(client.matches.shots, m.id)
    shots = [x for p in (getattr(sh, "periods", None) or []) if _PEN_PERIOD.search(str(getattr(p, "period", "") or ""))
             for x in (getattr(p, "shots", None) or [])] if sh is not None else []
    th = [x for x in shots if str(getattr(x, "team_id", "")) == hid]
    ta = [x for x in shots if str(getattr(x, "team_id", "")) == aid]
    goal = lambda x: "goal" in str(getattr(x, "event_type", "")).lower() and not getattr(x, "is_own_goal", False)
    gh, ga = sum(map(goal, th)), sum(map(goal, ta))
    if len(th) >= 3 and len(ta) >= 3 and len(th) + len(ta) == len(shots) and gh != ga:
        return (m.home_team.name if gh > ga else m.away_team.name, f"{gh}-{ga}"), None
    kinds_s = sorted({str(getattr(x, "event_type", "")) for x in shots})
    return None, f"no shootout in events ({', '.join(kinds)}) or shots ({len(th)}+{len(ta)} {', '.join(kinds_s)})"


def _cup_title(client, lid, season, ms):
    """بطل البطولة = الفائز في آخر مباراة من الموسم، بشرط أن PitchAPI يسمّيها النهائي وما بقي للموسم مباريات."""
    up, err = call(lambda: client.leagues.matches(lid, season=season, status="upcoming"))
    if up is None or list(up.matches):
        return None, "season not finished" if up is not None else f"upcoming: {err}"
    fin = [m for m in ms if m.score_home is not None and m.score_away is not None and m.date]
    if not fin:
        return None, "no results"
    last = max(str(m.date)[:10] for m in fin)
    on_last = [m for m in fin if str(m.date)[:10] == last]
    if len(on_last) != 1:
        return None, f"{len(on_last)} matches on the last day"
    m = on_last[0]
    det, err = call(client.matches.get, m.id)
    rn = str(getattr(det, "round_name", "") or "") if det is not None else ""
    if not re.search(r"\bfinal\b", rn, re.I) or re.search(r"semi|quarter|1/\d|round of|eighth|third|3rd", rn, re.I):
        return None, f"last match is not the final (round: {rn or err or '?'})"
    h, a = m.score_home, m.score_away
    info = dict(final=f"{m.home_team.name} {h}-{a} {m.away_team.name}", date=last, runner_up=None)
    if h != a:
        w = m.home_team.name if h > a else m.away_team.name
    else:
        so, why = _shootout(client, m)
        if not so:
            return None, f"final drawn {h}-{a}, {why}"
        w, info["pens"] = so
    info["runner_up"] = m.away_team.name if w == m.home_team.name else m.home_team.name
    return dict(team=w, **info), None


def sync_titles(client, hub, lids):
    """data/champions.json: بطل الموسم الماضي لكل دوري (جدول كامل) ولكل بطولة كأس (النهائي). مرة لكل موسم، وما نخمّن أبداً."""
    items = {str(l.id): l for l in (globals().get("_LEAGUE_LIST") or [])}
    ch = gh_get_json(hub, FPL_CHAMP_PATH) or {}
    lg, tried = ch.setdefault("leagues", {}), ch.setdefault("tried", {})
    t_now = datetime.datetime.now(datetime.timezone.utc)
    changed = False
    for lid in lids:
        L = items.get(lid)
        if L is None:
            continue
        cur = (globals().get("_LEAGUE_SEASON") or {}).get(lid)       # موسم البيانات الحالي (من مزامنة الدوري أو البطولة نفسها)
        prev = _season_prev(getattr(L, "seasons", None), cur) if cur else None
        nxt, pl = _season_label(cur), _season_label(prev)
        if not prev or not nxt or not pl:
            continue
        e = lg.get(lid) or {}
        if e.get("next") == nxt and e.get("team"):
            continue                                            # محسوب لهذا الموسم
        last = _parse_ts((tried.get(lid) or {}).get("t"))
        if (tried.get(lid) or {}).get("next") == nxt and (tried.get(lid) or {}).get("m") == TITLES_METHOD and last and (t_now - last).total_seconds() < TITLES_RETRY_H * 3600:
            continue
        res, err = call(lambda: client.leagues.matches(lid, season=prev, status="played"))
        ms = list(getattr(res, "matches", None) or []) if res is not None else []
        rows = [(m.home_team.name, m.away_team.name, m.score_home, m.score_away) for m in ms
                if m.score_home is not None and m.score_away is not None]
        out, why = _league_title(rows) if rows else (None, f"no results ({err})")
        kind = "league"
        if out is None and rows:
            out2, why2 = _cup_title(client, lid, prev, ms)
            if out2 is not None:
                out, kind = out2, "cup"
            else:
                why = f"league: {why}; cup: {why2}"
        if out is None:
            tried[lid] = dict(next=nxt, t=now(), why=why, m=TITLES_METHOD)
            log(f"  [Titles] {L.name} {pl}: ما قدرت أثبت البطل ({why}) — بدون شارة")
        else:
            src = (f"PitchAPI results of {pl}: final table from all {out['fixtures']} fixtures" if kind == "league"
                   else f"PitchAPI results of {pl}: the final, {out['final']}" + (f", penalties {out['pens']}" if out.get("pens") else ""))
            lg[lid] = dict(season=pl, next=nxt, kind=kind, name=L.name, src=src, **out)
            tried.pop(lid, None)
            log(f"  [Titles] بطل {L.name} {pl}: {out['team']} ({src})")
        changed = True
    if changed:
        ch["note"] = ("Last season's winner per competition, from verified results (a full league table, or the final of a cup). "
                      "'next' is the season the title is defended in.")
        gh_put(hub, FPL_CHAMP_PATH, json.dumps(ch, ensure_ascii=False, indent=1).encode("utf-8"), "Update title holders")


def _euro_phase(ms, season):
    """مباريات المرحلة الرئيسية: في موسم خريف-ربيع نستبعد يوليو وأغسطس (التصفيات والملحق)، فالفريق اللي خرج من التصفيات ما يُحسب."""
    if not re.match(r"^\d{4}-\d{2}$", season or ""):
        return ms
    return [m for m in ms if str(getattr(m, "date", "") or "")[5:7] not in ("07", "08")]


def sync_europe(client, hub):
    """data/europe.json: أندية هذا الموسم في البطولات الأوروبية الثلاث، من قوائم مبارياتها في PitchAPI (ما نكتب أي اسم يدوياً)."""
    old = gh_get_json(hub, EURO_PATH) or {}
    last = _parse_ts(old.get("t"))
    t_now = datetime.datetime.now(datetime.timezone.utc)
    for c in old.get("comps", []):
        if c.get("season_raw"):
            globals().setdefault("_LEAGUE_SEASON", {}).setdefault(c["id"], c["season_raw"])
    items = list(globals().get("_LEAGUE_LIST") or [])
    if (last and (t_now - last).total_seconds() < EURO_REFRESH_H * 3600) or not items:
        return [c["id"] for c in old.get("comps", [])]
    dom = set()
    for lid, refs in (globals().get("_LOGO_REFS") or {}).items():
        if lid in ("l_0bfbkO", "l_1XLtP0"):
            continue
        for pair in refs:
            dom.update(str(t.id) for t in pair)
    oldc = {c["key"]: c for c in old.get("comps", [])}
    comps, seen = [], {}
    for C in EURO_COMPS:
        cands = [l for l in items if str(l.id) == C.get("known")] or [
            l for l in items if any(w in nrm(l.name) for w in map(nrm, C["words"]))
            and not any(nrm(x) in nrm(l.name) for x in GLOBAL_EXCLUDE + C["exclude"])]
        best = None
        for l in cands[:5]:
            res, err = call(lambda: client.leagues.matches(str(l.id), season=None, status="all"))
            if res is None:
                continue
            raw = getattr(res.league, "season", None)
            season = _season_label(raw)
            ms = _euro_phase(list(res.matches), season)
            teams = {}
            for m in ms:
                for t in (m.home_team, m.away_team):
                    teams[t.name] = str(t.id)
            hits = len(set(teams.values()) & dom)
            log(f"  [Europe] {C['label']}: {l.name} [{l.id}] {season} — {len(teams)} فريق، {hits} منها في دورياتنا")
            if hits >= 3 and (best is None or hits > best[0]):
                best = (hits, l, season, teams, raw)
        if best is None:
            if C["key"] in oldc:
                comps.append(oldc[C["key"]])
            log(f"  [Europe] ✘ {C['label']}: ما لقيتها في PitchAPI بأندية أوروبية معروفة — بدون شارة")
            continue
        _, l, season, teams, raw = best
        globals().setdefault("_LEAGUE_SEASON", {})[str(l.id)] = raw
        logo, lu = (oldc.get(C["key"]) or {}).get("logo"), getattr(l, "image_url", None)
        if lu and (oldc.get(C["key"]) or {}).get("logo_src") != lu:
            try:
                logo = _logo_get(lu)[0] or logo
            except Exception:
                pass
        comps.append(dict(key=C["key"], id=str(l.id), name=l.name, label=C["label"], season=season, season_raw=raw, logo=logo, logo_src=lu,
                          teams=sorted(teams), ids=teams))
        for n in teams:
            seen.setdefault(n, []).append(C["key"])
    # فريق موجود في بطولتين (خرج من تصفيات الأعلى ونزل للأدنى): يبقى في الأدنى فقط
    order = [c["key"] for c in EURO_COMPS]
    for n, ks in seen.items():
        if len(ks) > 1:
            keep = max(ks, key=order.index)
            for c in comps:
                if c["key"] != keep and n in c.get("teams", []):
                    c["teams"].remove(n)
                    c["ids"].pop(n, None)
    seasons = {c["season"] for c in comps if c.get("season")}
    out = dict(t=now(), season=seasons.pop() if len(seasons) == 1 else None, comps=comps,
               note="Clubs in each UEFA competition this season, from PitchAPI's fixture lists (main phase; qualifying rounds in July and August are left out).")
    gh_put(hub, EURO_PATH, json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update European places")
    return [c["id"] for c in comps]


def sync_fixtures(client, hub, lids):
    """data/fixtures.json: المباريات القادمة لكل دوري (status=upcoming)، كل ساعة، أو أبكر إذا وحدة من المحفوظة صار وقتها."""
    old = gh_get_json(hub, FIX_PATH) or {}
    last = _parse_ts(old.get("t"))
    t_now = datetime.datetime.now(datetime.timezone.utc)
    today = t_now.strftime("%Y-%m-%d")
    fetched = str(old.get("t") or "")[:10]       # مباراة كان موعدها فات وقت الجلب (مؤجلة) ما تستدعي جلب جديد
    stale = any(fetched <= x.get("d", "9") < today for v in (old.get("leagues") or {}).values() for x in v)
    if last and (t_now - last).total_seconds() < FIX_REFRESH_MIN * 60 and not stale and set(lids) <= set(old.get("leagues") or {}):
        return
    out = dict(old.get("leagues") or {})
    for lid in lids:
        res, err = call(lambda: client.leagues.matches(lid, season=None, status="upcoming"))
        if res is None:
            log(f"  [Fixtures] {lid}: تعذر ({err})")
            continue
        rows = [dict(i=str(m.id), d=str(m.date or "")[:10], k=str(m.time_utc or ""), h=m.home_team.name, a=m.away_team.name)
                for m in res.matches if m.date]
        rows.sort(key=lambda x: (x["d"], x["k"], x["h"]))
        out[lid] = rows[:FIX_MAX]
    gh_put(hub, FIX_PATH, json.dumps(dict(t=now(), leagues=out), ensure_ascii=False, separators=(",", ":")).encode("utf-8"), "Update fixtures")
    log("  [Fixtures] " + ", ".join(f"{k}: {len(v)}" for k, v in out.items()))


_orig_run_pipeline_cmp = run_pipeline


def run_pipeline(hub, pit_key):
    out = _orig_run_pipeline_cmp(hub, pit_key)
    lids = list((globals().get("_LOGO_REFS") or {}).keys())
    try:
        with PitchAPI(api_key=pit_key) as client:
            euro = []
            for step, fn in (("Europe", lambda: euro.extend(sync_europe(client, hub) or [])),
                             ("Fixtures", lambda: sync_fixtures(client, hub, lids)),
                             ("Titles", lambda: sync_titles(client, hub, list(dict.fromkeys([l for l in lids + euro if l != FPL_CHAMP_LEAGUE]))))):
                try:
                    fn()
                except Exception as e:      # كلها إضافات: ما توقف المزامنة
                    log(f"  [{step}] خطأ ({type(e).__name__}: {e}) — بقية المزامنة ما تأثرت")
    except Exception as e:
        log(f"  [Competitions] خطأ ({type(e).__name__}: {e})")
    return out


_X_CMPCSS = ".eub{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-inline-start:5px;vertical-align:-4px;border-radius:5px;background:rgba(255,255,255,.94);padding:1.5px;flex:none;box-shadow:0 1px 3px rgba(0,0,0,.3)}.eub img{width:100%;height:100%;object-fit:contain;display:block}.eub b{font-size:6px;line-height:1;color:#0d1520;letter-spacing:-.03em;white-space:nowrap}.eub.hold{box-shadow:0 0 0 2px var(--gold),0 0 10px rgba(226,189,90,.45)}.eub.big{width:auto;height:auto;gap:7px;padding:4px 11px 4px 4px;margin:0;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid var(--glass-bd);vertical-align:middle;box-shadow:none}html[dir=rtl] .eub.big{padding:4px 4px 4px 11px}.eub.big img{width:22px;height:22px;padding:2px;border-radius:5px;background:#fff}.eub.big>span{font-size:12px;font-weight:600;color:var(--tx)}.eub.big.hold{border-color:var(--gold-bd);background:linear-gradient(180deg,rgba(226,189,90,.16),rgba(226,189,90,.04))}.euh{display:inline-flex;align-items:center;gap:4px;color:var(--gold);font-weight:700}.clubeu{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.eulg{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;font-size:12px;margin-top:10px}.eulg .eub{margin-inline:0 6px}.eulg .chm{margin-inline:0 6px}.fx{display:flex;flex-direction:column;gap:4px}.fxdh{font-size:12px;font-weight:700;color:var(--mu);margin:8px 0 4px;font-variant-numeric:tabular-nums}.fxr{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center;padding:8px 12px;margin-bottom:4px;border-radius:11px;border:1px solid var(--glass-bd);background:linear-gradient(180deg,var(--glass-hl),rgba(255,255,255,.01) 50%),var(--glass)}.fxh{text-align:end}.fxa{text-align:start}.fxh,.fxa{min-width:0;overflow-wrap:anywhere;line-height:1.35}.fxr .eub,.fxr .chm{vertical-align:-3px}.fxt{min-width:54px;padding:3px 8px;border-radius:7px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;background:var(--th-soft);border:1px solid var(--th-bd)}.ltgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,500px),1fr));gap:12px}.ltg h3{margin:6px 0 6px}.ltg .ltr{grid-template-columns:30px minmax(96px,1fr) 26px 24px 24px 24px 34px 32px 44px 94px;gap:3px;padding:7px 8px;font-size:13px}.ltg .ltf{width:16px;height:16px;line-height:16px;margin:0 1px}@media(max-width:560px){.ltg .ltr{grid-template-columns:34px minmax(90px,1fr) 28px 38px 36px 96px}}@media(max-width:560px){.fxr{padding:7px 8px;gap:6px;font-size:13px}.fxt{min-width:46px;padding:2px 5px}.eub.big>span{font-size:11px}}.ltr>.ltt{display:flex;align-items:center;min-width:0}.ltr>.ltt>a{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ltt .chm,.ltt .eub{flex:none}html[dir=rtl] .ltr>.ltt{justify-content:flex-end}@media(max-width:560px){.ltt .eub{width:14px;height:14px;margin-inline-start:3px;border-radius:4px;padding:1px;vertical-align:-2px}.ltt .chm{margin-inline-start:3px}.ltt .trophy{width:12px;height:12px}.ltt .clogo{margin-inline-end:4px}}"
_X_CMPJS = r"""/* ===== Competitions: European places, title holders, upcoming fixtures and tournament tables =====
   data/europe.json (sync): this season's clubs in the Champions League, Europa League and Conference League, read from each
   competition's fixture list in PitchAPI (qualifying rounds in July and August left out); data/champions.json: last season's
   winner of every competition, from verified results; data/fixtures.json: the upcoming fixtures of every league.
   Nothing is shown when a file, a season or a name does not match. */
const EURO={p:null,d:null},FIX={p:null,d:null},EURO_SHORT={ucl:'UCL',uel:'UEL',uecl:'UECL'};
const cmpV=()=>encodeURIComponent((ALL&&ALL.generated)||'');
function euroLoad(){if(!EURO.p)EURO.p=fetch('data/europe.json?v='+cmpV()).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{EURO.d=d;return d});return EURO.p}
function fixLoad(){if(!FIX.p)FIX.p=fetch('data/fixtures.json?v='+cmpV()).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{FIX.d=d;return d});return FIX.p}
/* the European competitions a club plays in this season: only for the same season as the league's data, and not the competition
   whose page is open */
function euroComps(){const d=EURO.d,s=D&&curSeason();return d&&d.comps&&s?d.comps.filter(c=>c.season===s&&c.id!==D.id):[]}
const euroOf=name=>euroComps().filter(c=>(c.teams||[]).includes(name));
/* last season's winner of a competition, when champions.json has it for the season being played now */
function holderOf(c){const e=CHAMP.d&&CHAMP.d.leagues&&CHAMP.d.leagues[c.id];return e&&e.team&&e.next===c.season?e:null}
const isHolder=(c,name)=>{const e=holderOf(c);return !!e&&e.team===name};
function euroBadge(c,name,big){
 const h=isHolder(c,name),t=c.label+' '+c.season+(h?' · holders':'');
 return `<span class="eub eub-${c.key}${h?' hold':''}${big?' big':''}" title="${esc(t)}" aria-label="${esc(t)}">${c.logo?`<img src="${c.logo}" alt="">`:`<b>${EURO_SHORT[c.key]||''}</b>`}${big?`<span>${esc(c.label)}</span>${h?`<span class="euh">${thTrophy}<span>Holders</span></span>`:''}`:''}</span>`;
}
const euroMarks=name=>euroOf(name).map(c=>euroBadge(c,name)).join('');
/* what the small marks next to the clubs mean, under the league table */
function euroLegend(M){
 const teams=new Set(M.flatMap(m=>[m.home,m.away])),cs=euroComps().filter(c=>(c.teams||[]).some(t=>teams.has(t))),ch=champInfo();
 if(!cs.length&&!ch)return '';
 return `<div class="eulg mu">${cs.map(c=>`<span class="nw">${euroBadge(c,'')}<span>${esc(c.label)}</span></span>`).join('')}${ch?`<span class="nw"><span class="chm">${thTrophy}</span><span>Defending champions</span></span>`:''}${cs.length?`<span class="nw">${esc(cs[0].season)}</span>`:''}</div>`;
}
const clubComps=name=>{const cs=euroOf(name);return cs.length?`<div class="clubeu">${cs.map(c=>euroBadge(c,name,true)).join('')}</div>`:''};

/* ---------- upcoming fixtures ---------- */
/* the date and kick-off in the viewer's time zone when the data has a time (PitchAPI gives it in UTC) */
function fxWhen(x){
 const m=/(\d{2}):(\d{2})/.exec(String(x.k||''));if(!m)return {d:x.d,t:''};
 const dt=new Date(x.d+'T'+m[1]+':'+m[2]+':00Z');if(isNaN(dt))return {d:x.d,t:''};
 const p=n=>String(n).padStart(2,'0');return {d:`${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`,t:`${p(dt.getHours())}:${p(dt.getMinutes())}`};
}
const fxTeam=n=>`<a class="clk" href="#/club/${encodeURIComponent(n)}">${clubDot(n)}<span>${esc(n)}</span></a>${champMark(n)}${euroMarks(n)}`;
async function fxSection(id,club){
 await Promise.all([fixLoad(),champReady()]);
 const L=((FIX.d&&FIX.d.leagues)||{})[id],head=`<h3>${club?'Next matches':'Upcoming fixtures'}</h3>`;
 if(!L)return club?'':head+'<div class="empty">No fixture list in the data yet.</div>';
 const today=new Date().toISOString().slice(0,10),rows=L.filter(x=>x.d>=today&&(!club||x.h===club||x.a===club)).slice(0,club?5:24);
 if(!rows.length)return club?'':head+'<div class="empty">No upcoming fixtures in the data (the season may be over).</div>';
 const by=new Map();rows.forEach(x=>{const w=fxWhen(x);if(!by.has(w.d))by.set(w.d,[]);by.get(w.d).push([x,w.t])});
 return head+'<div class="fx">'+[...by].map(([d,xs])=>`<div class="fxd"><div class="fxdh">${esc(d)}</div>${xs.map(([x,t])=>`<div class="fxr"><span class="fxh">${fxTeam(x.h)}</span><span class="fxt">${t?esc(t):'–'}</span><span class="fxa">${fxTeam(x.a)}</span></div>`).join('')}</div>`).join('')+
  `</div>${rows.some(x=>fxWhen(x).t)?'<div class="mu" style="font-size:11px;margin-top:4px">Kick-off times in your time zone.</div>':''}`;
}

/* ---------- tournaments: group tables, a league phase, knockout rounds ---------- */
const ltSort=M=>[...M].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.match_id).localeCompare(String(b.match_id)));
/* single round-robin groups and then knockouts (a World Cup): a match is a group match when it is among the first g of both teams;
   the groups are the sets of teams joined by those matches, and every group must be complete (g+1 teams, each played each once) */
function ltGroupsOf(M){
 const S=ltSort(M);
 for(const g of [3,2,4,5]){
  const cnt=new Map(),gm=[],ko=[];
  S.forEach(m=>{const a=cnt.get(m.home)||0,b=cnt.get(m.away)||0;(a<g&&b<g?gm:ko).push(m);cnt.set(m.home,a+1);cnt.set(m.away,b+1)});
  const par=new Map(),f=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x)}return x};
  gm.forEach(m=>{[m.home,m.away].forEach(t=>{if(!par.has(t))par.set(t,t)});par.set(f(m.home),f(m.away))});
  const G=new Map();gm.forEach(m=>{const r=f(m.home);if(!G.has(r))G.set(r,[]);G.get(r).push(m)});
  const groups=[...G.values()];
  if(groups.length>=2&&groups.every(x=>{const T=new Set(x.flatMap(m=>[m.home,m.away]));return T.size===g+1&&x.length===g*(g+1)/2&&new Set(x.map(m=>[m.home,m.away].sort().join('|'))).size===x.length}))
   return {groups,ko};
 }
 return null;
}
/* one league phase and then two-legged ties (the Champions League after January): the phase is the longest run of match days
   after which every club has played the same number of games, before any pairing repeats */
function ltPhaseOf(M){
 const S=ltSort(M),days=[...new Set(S.map(m=>m.date.slice(0,10)))],pairs=new Set(),cnt=new Map();let end=null;
 for(const d of days){
  const day=S.filter(m=>m.date.slice(0,10)===d);if(day.some(m=>pairs.has([m.home,m.away].sort().join('|'))))break;
  day.forEach(m=>{pairs.add([m.home,m.away].sort().join('|'));cnt.set(m.home,(cnt.get(m.home)||0)+1);cnt.set(m.away,(cnt.get(m.away)||0)+1)});
  const c=[...cnt.values()];if(c.length>=6&&Math.min(...c)===Math.max(...c))end=d;
 }
 if(!end)return null;const phase=S.filter(m=>m.date.slice(0,10)<=end),ko=S.filter(m=>m.date.slice(0,10)>end);
 return ko.length&&ltOk(phase)?{phase,ko}:null;
}
function ltStatic(rows){
 const fm=f=>f.slice(-5).map(r=>`<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`).join('');
 return `<div class="lt"><div class="ltr lth"><span>#</span><span>Team</span><span class="ltl" data-en="P" data-ar="لعب" title="Played"></span><span class="ltx ltl" data-en="W" data-ar="ف" title="Win"></span><span class="ltx ltl" data-en="D" data-ar="ت" title="Draw"></span><span class="ltx ltl" data-en="L" data-ar="خ" title="Loss"></span><span>GD</span><span>Pts</span><span class="ltx">xGD</span><span class="ltfm">Form</span></div>`+
  rows.map((r,i)=>`<div class="ltr" data-t="${esc(r.t)}"><span>${i+1}</span><span class="ltt"><a href="#/club/${encodeURIComponent(r.t)}">${clubDot(r.t)}${esc(r.t)}</a>${champMark(r.t)}${euroMarks(r.t)}</span><span>${r.p}</span><span class="ltx">${r.w}</span><span class="ltx">${r.d}</span><span class="ltx">${r.l}</span><span>${r.f-r.a>0?'+':''}${r.f-r.a}</span><b>${r.pts}</b><span class="ltx">${r.nx?((r.xf-r.xa>0?'+':'')+(r.xf-r.xa).toFixed(1)):'N/A'}</span><span class="ltfm">${fm(r.form)}</span></div>`).join('')+'</div>';
}
/* knockout matches by round: a match's round is one more than the knockout games either team had played before it, so rounds
   do not depend on the order of the dates; single matches are named by how many are in the round */
function ltKo(ko,named){
 if(!ko.length)return '';
 const k=new Map(),R=[];ltSort(ko).forEach(m=>{const r=Math.max(k.get(m.home)||0,k.get(m.away)||0);(R[r]=R[r]||[]).push(m);k.set(m.home,r+1);k.set(m.away,r+1)});
 const nm=(r,i)=>{const n=r.length;if(!named)return 'Knockout matches';if(i===R.length-1&&n===2&&i>0&&R[i-1].length===2)return 'Third place and final';
  if(i===R.length-1&&n===1)return 'Final';return n===2?'Semi-finals':n===4?'Quarter-finals':n>=8&&(n&(n-1))===0?'Round of '+2*n:'Knockout matches'};
 const out=[];R.forEach((r,i)=>{if(!r)return;const t=nm(r,i),last=out[out.length-1];if(last&&last[0]===t)last[1].push(...r);else out.push([t,[...r]])});
 return out.map(([t,ms])=>`<h3>${esc(t)}</h3>`+tbl([['Date'],['Match']],ltSort(ms).map(m=>[esc(String(m.date).slice(0,10)),mlink(m)]))).join('');
}
function ltTournament(M,tx,root){
 const g=ltGroupsOf(M);
 if(g){root.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:8px"><b>${esc(D.name)}</b><span>: group tables, worked out from who played whom. The data has no group names, so the groups are numbered in the order of their first match.</span></div>`+
  `<div class="ltgs">${g.groups.sort((a,b)=>String(ltSort(a)[0].date).localeCompare(String(ltSort(b)[0].date))||String(ltSort(a)[0].match_id).localeCompare(String(ltSort(b)[0].match_id))).map((x,i)=>`<div class="ltg"><h3>Group ${i+1}</h3>${ltStatic(ltTable(x,tx))}</div>`).join('')}</div>`+ltKo(g.ko,true);return true}
 const p=ltPhaseOf(M);
 if(p){root.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:8px"><b>${esc(D.name)}</b><span>: the league phase table, then the knockout matches.</span></div><h3>League phase</h3>${ltStatic(ltTable(p.phase,tx))}`+euroLegend(p.phase)+ltKo(p.ko,false);return true}
 return false;
}
"""


def _x_cmp_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (البطولات): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_CMPCSS + "</style></head>")
    h = sub(h, "async function route(){", _X_CMPJS + "\nasync function route(){")
    h = sub(h, " if(!M.length){root.innerHTML='<div class=\"empty\">No results in the data yet.</div>';return}\n",
            " if(!root)return;   /* the visitor opened another page while the data loaded */\n if(!M.length){root.innerHTML='<div class=\"empty\">No results in the data yet.</div>';return}\n")
    h = sub(h, "el.innerHTML='<h2>Matches</h2>'+tbl([['Date'],['Match'],['Data']],",
            "el.innerHTML='<h2>Matches</h2>'+await fxSection(D.id)+'<h3>Results</h3>'+tbl([['Date'],['Match'],['Data']],")
    h = sub(h, " if(!ltOk(M)){root.innerHTML=`<div class=\"empty\">${esc(D.name)} is a tournament (groups and knockout rounds), so it has no single league table.</div>`;return}\n",
            " if(!ltOk(M)){if(ltTournament(M,tx,root))return;root.innerHTML=`<div class=\"empty\">${esc(D.name)} is a tournament (groups and knockout rounds), so it has no single league table.</div>`;return}\n")
    h = sub(h, " $('#ltrng').oninput=e=>{ltStop();ltGo(+e.target.value,true)};\n", " $('#ltrng').oninput=e=>{ltStop();ltGo(+e.target.value,true)};\n root.insertAdjacentHTML('beforeend',euroLegend(LT.M));\n")
    return h


_AR_SEASON.update({
    "Champions League": "دوري أبطال أوروبا",
    "Europa League": "الدوري الأوروبي",
    "Conference League": "دوري المؤتمر الأوروبي",
    "Holders": "حامل اللقب",
    "Upcoming fixtures": "المباريات القادمة",
    "Next matches": "مبارياته القادمة",
    "Results": "النتائج",
    "No fixture list in the data yet.": "لا توجد قائمة مباريات في البيانات للحين.",
    "No upcoming fixtures in the data (the season may be over).": "لا توجد مباريات قادمة في البيانات (قد يكون الموسم انتهى).",
    "Kick-off times in your time zone.": "مواعيد الانطلاق بتوقيتك المحلي.",
    "group tables, worked out from who played whom. The data has no group names, so the groups are numbered in the order of their first match": "جداول المجموعات، مستنتجة من المواجهات نفسها. البيانات ما فيها أسماء المجموعات، لذلك رُقّمت حسب ترتيب أول مباراة في كل مجموعة",
    "the league phase table, then the knockout matches": "جدول مرحلة الدوري، ثم مباريات خروج المغلوب",
    "League phase": "مرحلة الدوري",
    "Group #": "المجموعة #",
    "Knockout matches": "مباريات خروج المغلوب",
    "Round of #": "دور الـ#",
    "Quarter-finals": "ربع النهائي",
    "Semi-finals": "نصف النهائي",
    "Final": "النهائي",
    "Third place and final": "المركز الثالث والنهائي",
    "won the ## final, worked out from that season's verified results.": "فاز بنهائي ## حسب نتائج ذاك الموسم الموثقة."
})


INDEX = _x_cmp_index(INDEX)
# ======================== نهاية إضافة البطولات ========================

# ============================================================================
# إضافة: Intelligence Lab — توقعاتك (نقاط الفانتازي ومين يجيب نقاط أكثر) قبل الموعد النهائي، تقييمها بالنقاط الرسمية،
# مقارنتها بتوقع النموذج المحفوظ قبل الموعد، أنماطك (Analytical DNA) لما تكفي البيانات، واكتشاف من بيانات حقيقية.
# كل شي في الصفحة فقط: التوقعات تنحفظ في متصفح المستخدم (localStorage: plx_lab_v1)، ولا تغيير في المزامنة أو البيانات.
# ============================================================================
_X_LABCSS = ".labtabs{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px}.labtabs button{min-height:36px}.labn{display:inline-block;min-width:18px;padding:0 5px;margin-inline-start:4px;border-radius:9px;background:var(--th-soft);font-size:11px}.labintro{border-color:var(--th-bd);background:linear-gradient(135deg,var(--th-soft),rgba(255,255,255,.02) 70%),var(--glass)}.labmsg{border-color:var(--th-bd)}.labforms{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px}.labforms h3{margin-top:0}.labf{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:13px}.labf>span{color:var(--mu)}.labf input,.labf select{width:100%;box-sizing:border-box}.labconf{display:flex;align-items:center;gap:10px}.labconf input{flex:1}.labst{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--ln);white-space:nowrap}.labst.g{color:var(--g);border-color:currentColor}.labst.w{color:var(--a);border-color:currentColor}.labst.o{color:var(--th-link);border-color:currentColor}.labst.x{color:var(--mu)}.labdel{min-height:26px;padding:0 8px;margin-inline-start:6px}.labwhy{font-size:12px;margin-top:3px;max-width:340px;overflow-wrap:anywhere}.labins .labinh{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.labins p{margin:8px 0}.labins.established{border-color:var(--g)}.labins.emerging{border-color:var(--a)}.labdisc h3{margin:6px 0}.labimp{display:inline-flex;align-items:center;cursor:pointer;border:1px solid var(--ln);border-radius:8px;padding:6px 12px;background:var(--sf)}.labins td,.labins th{white-space:normal}.labins .wrap{overflow-x:visible}.labul{margin:6px 0;padding-inline-start:18px}.labul li{margin:4px 0}.labopts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;margin-top:8px}.labopts button{text-align:start;white-space:normal;min-height:44px}.labev{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;margin:10px 0}.labev>div{border:1px solid var(--glass-bd);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.02)}.labev h4{margin:0 0 6px}.labev ul{margin:4px 0;padding-inline-start:18px;font-size:13px}.labms{list-style:none;margin:6px 0 12px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:6px}.labms li{display:flex;gap:8px;align-items:baseline;padding:8px 10px;border:1px solid var(--glass-bd);border-radius:10px;color:var(--mu)}.labms li.on{color:var(--tx);border-color:var(--th-bd)}.labmk{font-weight:700;color:var(--th-hi)}.labfeed{margin-bottom:8px}.labfeed.new{border-color:var(--th-bd);background:linear-gradient(135deg,var(--th-soft),rgba(255,255,255,.02) 70%),var(--glass)}.labfeed.case{border-color:var(--gold-bd)}.labhp h3{margin-top:0}.labcase h3{margin:6px 0}"
_X_LABJS = r"""/* ===== Intelligence Lab: your Premier League judgement against the model and the official results =====
   Your predictions stay in this browser only (localStorage key 'plx_lab_v1'); nothing is sent anywhere.
   Read-only data: data/fpl.json (players, fixtures, deadlines, official FPL points per gameweek), data/fpl_track.json (the
   model's points prediction for every player, saved by the sync before each deadline and locked after it), and the selected
   league's results and shot xG (the discovery).
   Rules: a prediction can be recorded or removed only before its gameweek's deadline; it is evaluated once the gameweek is
   finished (official points final) and the result is stored with it, so it never changes later. The model's figure stays
   hidden until the deadline, so your call is your own. Personal patterns are shown only with enough evaluated predictions. */
const LAB_KEY='plx_lab_v1',LAB={d:null,v:'',tab:'feed',msg:'',case:null};
const LAB_POS={1:'GKP',2:'DEF',3:'MID',4:'FWD'};
function labValid(r){if(!r||typeof r!=='object'||typeof r.dl!=='string'||typeof r.at!=='string'||typeof r.id!=='string')return false;
 if(r.type==='match')return typeof r.lid==='string'&&typeof r.mid==='string'&&typeof r.h==='string'&&typeof r.a==='string'&&['H','D','A'].includes(r.pick)&&Array.isArray(r.pr)&&r.pr.length===3&&r.pr.every(fpOk);
 return (r.type==='pts'||r.type==='h2h')&&Number.isInteger(r.gw)&&Array.isArray(r.p)&&r.p.length===(r.type==='pts'?1:2)&&r.p.every(Number.isInteger)&&Array.isArray(r.s)&&r.s.length===r.p.length}
const labObj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
/* stored records; unreadable data is kept aside (once) instead of being overwritten */
function labRead(){
 let raw=null,o=null;try{raw=localStorage.getItem(LAB_KEY)}catch(e){}
 if(raw){try{o=JSON.parse(raw)}catch(e){o=null}}
 if(!o||typeof o!=='object'||!Array.isArray(o.recs)){
  if(raw){try{if(!localStorage.getItem(LAB_KEY+'_unreadable'))localStorage.setItem(LAB_KEY+'_unreadable',raw)}catch(e){}}
  return {v:1,recs:[],cases:{},ms:{},seen:{},bad:!!raw};
 }
 const recs=o.recs.filter(labValid);return {v:1,recs,cases:labObj(o.cases),ms:labObj(o.ms),seen:labObj(o.seen),dropped:o.recs.length-recs.length};
}
/* recs: predictions; cases: your answers to case files; ms: when each milestone was first reached; seen: what the Lab showed on your last visit */
function labWrite(o){try{localStorage.setItem(LAB_KEY,JSON.stringify({v:1,recs:o.recs,cases:o.cases||{},ms:o.ms||{},seen:o.seen||{}}));return true}catch(e){return false}}
async function labData(){
 const m=ALL&&ALL.fpl;if(!m||!m.file)return null;
 if(LAB.d&&LAB.v===(m.v||''))return LAB.d;
 const r=await fetch('data/'+m.file+'?v='+encodeURIComponent(m.v||''));if(!r.ok)throw new Error(m.file+' (HTTP '+r.status+')');
 const d=await r.json(),T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=T.get(o.tm)||{};o.tn=t.s||'?';o.tf=t.n||'?';return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));d.T=T;d.ix=Object.fromEntries((d.hcols||[]).map((c,i)=>[c,i]));
 let tr={gws:{}};try{const x=await fetch('data/fpl_track.json?v='+encodeURIComponent(d.generated||''));if(x.ok)tr=await x.json()}catch(e){}
 d.track=tr&&tr.gws?tr:{gws:{}};LAB.d=d;LAB.v=m.v||'';return d;
}
const labN=v=>{const x=Number(v);return isFinite(x)?x:null};
const labSeason=d=>{const y=+String((d.events[0]||{}).dl||'').slice(0,4);return y?y+'-'+String(y+1).slice(2):''};
const labFx=(d,tm,gw)=>d.fix.filter(x=>x[0]===gw&&(x[1]===tm||x[2]===tm));
const labOpen=d=>d.events.filter(e=>Date.parse(e.dl)>Date.now()).sort((a,b)=>a.id-b.id)[0]||null;
const labName=(d,id)=>{const p=d.PB.get(id);return p?p.wn:'#'+id};
/* official points and minutes of a player in a gameweek (a double gameweek adds up) */
function labAt(d,id,gw){let pts=0,min=0;((d.hist||{})[String(id)]||[]).forEach(h=>{if(h[d.ix.r]===gw){if(fpOk(h[d.ix.pts]))pts+=h[d.ix.pts];if(fpOk(h[d.ix.min]))min+=h[d.ix.min]}});return {pts,min}}
/* what was known about the player when the prediction was saved */
function labSnap(d,p,gw){
 const fin=d.events.filter(e=>e.fin).length,fx=labFx(d,p.tm,gw),mi=labN(p.minutes)||0;
 return {tm:p.tm,ty:p.ty,c:labN(p.now_cost),form:labN(p.form),ppg:labN(p.points_per_game),min:mi,st:labN(p.starts),fin,ch:p.chance_of_playing_next_round==null?null:labN(p.chance_of_playing_next_round),
  xgi90:mi>=270?((labN(p.expected_goals)||0)+(labN(p.expected_assists)||0))/mi*90:null,nfx:fx.length,home:fx.some(x=>x[1]===p.tm)};
}
/* the model's prediction for a gameweek, only from a record saved before that gameweek's deadline */
function labModel(d,gw,id){const t=(d.track.gws||{})[String(gw)];if(!t||!t.preds)return null;const sv=Date.parse(String(t.saved||'').replace(' ','T')+'Z');
 if(!(sv<=Date.parse(t.dl)))return null;const v=t.preds[String(id)];return fpOk(v)?{v,ver:t.ver||null}:null}
/* evaluates finished gameweeks once and stores the outcome with the prediction */
function labEval(d,o){
 let ch=false;const season=labSeason(d);
 for(const r of o.recs){
  if(r.res||r.season!==season)continue;const e=d.events.find(x=>x.id===r.gw);if(!e||!e.fin)continue;
  const dl=Math.min(Date.parse(r.dl),Date.parse(e.dl));
  if(!(Date.parse(r.at)<dl)){r.res={st:'late'};ch=true;continue}
  if(r.s.some((s,i)=>!labFx(d,s.tm,r.gw).length)){r.res={st:'blank'};ch=true;continue}
  const A=r.p.map(id=>labAt(d,id,r.gw)),M=r.p.map(id=>labModel(d,r.gw,id));
  if(r.type==='pts'){const a=A[0].pts,m=M[0];r.res={st:'ok',a:[a],min:[A[0].min],e:Math.abs(r.pred-a),bias:r.pred-a,m:m?[m.v]:null,me:m?Math.abs(m.v-a):null,ver:m?m.ver:null}}
  else{const [a0,a1]=A.map(x=>x.pts);
   if(a0===a1)r.res={st:'tie',a:[a0,a1],min:A.map(x=>x.min)};
   else{const win=a0>a1?r.p[0]:r.p[1],ok=r.pick===win,mm=M[0]&&M[1]&&M[0].v!==M[1].v?(M[0].v>M[1].v?r.p[0]:r.p[1]):null;
    r.res={st:'ok',a:[a0,a1],min:A.map(x=>x.min),won:ok,b:Math.pow(r.conf-(ok?1:0),2),m:M[0]&&M[1]?[M[0].v,M[1].v]:null,mHit:mm==null?null:mm===win,ver:M[0]?M[0].ver:null}}}
  r.res.t=new Date().toISOString();ch=true;
 }
 if(ch)labWrite(o);return ch;
}

/* ---------- statistics for patterns: two groups, the difference and its standard error ---------- */
const labMean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const labVar=a=>{if(a.length<2)return 0;const m=labMean(a);return a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)};
function labCmp(g1,g2){const n1=g1.length,n2=g2.length;if(!n1||!n2)return {n1,n2,state:'none'};
 const m1=labMean(g1),m2=labMean(g2),se=Math.sqrt(labVar(g1)/n1+labVar(g2)/n2),dif=m1-m2;
 const state=n1>=15&&n2>=15&&n1+n2>=40&&Math.abs(dif)>2*se&&se>0?'established':n1>=8&&n2>=8&&Math.abs(dif)>se&&se>0?'emerging':'inconclusive';
 return {n1,n2,m1,m2,dif,se,state}}
const labGw=rs=>{const g=rs.map(r=>r.gw);if(!g.length)return '';const a=Math.min(...g),b=Math.max(...g);return a===b?'GW'+a:'GW'+a+'–'+b};
const labF=(x,k=1)=>x==null?'N/A':(x>0?'+':'')+x.toFixed(k),labF0=(x,k=2)=>x==null?'N/A':x.toFixed(k);
const LAB_STATE={established:'Established pattern',emerging:'Emerging pattern',inconclusive:'Inconclusive',none:'Not enough data'};

function labInsights(recs){
 const P=recs.filter(r=>r.type==='pts'&&r.res&&r.res.st==='ok'),PM=P.filter(r=>r.res.me!=null),H=recs.filter(r=>r.type==='h2h'&&r.res&&r.res.st==='ok'),out=[];
 const rel=r=>r.res.e-r.res.me;
 /* 1. attackers and defenders, measured against the model on the same predictions (so the different difficulty of positions cancels out) */
 {const a=PM.filter(r=>r.s[0].ty>=3),b=PM.filter(r=>r.s[0].ty<=2),c=labCmp(a.map(rel),b.map(rel));
  out.push({k:'pos',t:'Attackers and defenders',c,rs:a.concat(b),
   v:c.state==='none'||c.state==='inconclusive'?'No clear difference yet between your predictions for attackers and for defenders.':c.dif<0?'Compared with the model, your predictions have been more accurate for attackers (MID, FWD) than for defenders (GKP, DEF).':'Compared with the model, your predictions have been more accurate for defenders (GKP, DEF) than for attackers (MID, FWD).',
   rows:[['Attackers (MID, FWD)',a],['Defenders (GKP, DEF)',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 /* 2. recent form: players scoring well above their season average in the last 30 days */
 {const hot=r=>r.s[0].form!=null&&r.s[0].ppg!=null&&r.s[0].form-r.s[0].ppg>=2,a=P.filter(hot),b=P.filter(r=>!hot(r)),c=labCmp(a.map(r=>r.res.bias),b.map(r=>r.res.bias));
  out.push({k:'form',t:'Players in hot form',c,rs:P,bias:true,
   v:c.state==='none'||c.state==='inconclusive'?'No clear sign yet that recent form pulls your predictions up or down.':c.m1>0&&c.dif>0?'You have predicted more points than players in hot form went on to score, more so than for other players: recent form may weigh heavily in your predictions.':c.m1<0&&c.dif<0?'You have predicted fewer points than players in hot form went on to score, more so than for other players.':'Your predictions for players in hot form and for other players differ, without a consistent over- or underestimate.',
   rows:[['Hot form (last 30 days ≥ 2 points a match above season average)',a],['Other players',b]],how:'Your prediction minus the official points, on average; above 0 means you predicted too many.'})}
 /* 3. strong underlying attacking numbers against recent points without them */
 {const s=r=>r.s[0],a=PM.filter(r=>s(r).xgi90!=null&&s(r).xgi90>=.45),b=PM.filter(r=>s(r).xgi90!=null&&s(r).xgi90<.45&&s(r).form!=null&&s(r).ppg!=null&&s(r).form-s(r).ppg>=2),c=labCmp(a.map(rel),b.map(rel));
  out.push({k:'xgi',t:'Underlying numbers and recent points',c,rs:a.concat(b),
   v:c.state==='none'||c.state==='inconclusive'?'Not enough evidence yet on whether you read underlying numbers or recent points better.':c.dif<0?'Compared with the model, you have evaluated players with strong underlying attacking numbers (xG + xA) more accurately than players in hot form without them.':'Compared with the model, you have evaluated players in hot form without strong underlying numbers more accurately than players with strong xG + xA.',
   rows:[['xG + xA per 90 ≥ 0.45 (at least 270 minutes)',a],['Hot form, xG + xA per 90 < 0.45',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 /* 4. uncertain minutes: a flag on availability, or starting under 60% of the gameweeks played */
 {const unc=r=>{const s=r.s[0];return (s.ch!=null&&s.ch<100)||(s.fin>0&&s.st!=null&&s.st/s.fin<.6)},a=PM.filter(unc),b=PM.filter(r=>!unc(r)),c=labCmp(a.map(rel),b.map(rel));
  out.push({k:'min',t:'Uncertain minutes',c,rs:PM,
   v:c.state==='none'||c.state==='inconclusive'?'No clear difference yet between players with secure and uncertain minutes.':c.dif>0?'Compared with the model, your predictions have been less accurate when a player\'s minutes were uncertain.':'Compared with the model, your predictions have been more accurate when a player\'s minutes were uncertain.',
   rows:[['Uncertain minutes (availability flag, or started under 60% of gameweeks)',a],['Secure minutes',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 /* 5. confidence: stated probability against how often the pick was right */
 {const n=H.length,conf=n?labMean(H.map(r=>r.conf)):null,hit=n?labMean(H.map(r=>r.res.won?1:0)):null,se=n?Math.sqrt(hit*(1-hit)/n):null;
  const state=n<20?(n?'inconclusive':'none'):Math.abs(conf-hit)>2*se&&n>=40?'established':Math.abs(conf-hit)>se?'emerging':'inconclusive';
  out.push({k:'cal',t:'Confidence',c:{state,n1:n},rs:H,cal:{n,conf,hit},
   v:state==='none'||state==='inconclusive'?'Not enough evidence yet on whether your confidence matches your results.':conf>hit?'Your stated confidence has been higher than your hit rate: your head-to-head picks were right less often than you expected.':'Your hit rate has been higher than your stated confidence: you may be underconfident in your head-to-head picks.'})}
 /* 6. change over time: the last 10 predictions with a model figure against the ones before */
 {const s=[...PM].sort((a,b)=>a.gw-b.gw||String(a.at).localeCompare(String(b.at))),a=s.slice(-10),b=s.slice(0,-10),c=s.length>=20?labCmp(a.map(rel),b.map(rel)):{state:'none',n1:a.length,n2:b.length};
  out.push({k:'trend',t:'Your last 10 predictions',c,rs:s,
   v:c.state==='none'||c.state==='inconclusive'?'No clear change yet between your last 10 evaluated predictions and the earlier ones.':c.dif<0?'Compared with the model, your last 10 evaluated predictions were more accurate than your earlier ones.':'Compared with the model, your last 10 evaluated predictions were less accurate than your earlier ones.',
   rows:[['Last 10',a],['Earlier',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 return out;
}

/* ---------- discovery: points against the chances a team created and allowed ---------- */
/* expected points of a match from the two teams' xG, with each side's goals as a Poisson count (a common simplification) */
function labXPts(xf,xa){const P=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o},a=P(xf),b=P(xa);let w=0,dr=0;
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=a[i]*b[j];if(i>j)w+=q;else if(i===j)dr+=q}return 3*w+dr}
async function labDiscCalc(){
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),T=new Map();
 fin.forEach(m=>{const g=wkSc(m.score);[[m.home,g[0],g[1],m.away],[m.away,g[1],g[0],m.home]].forEach(([t,f,a,o])=>{const xf=tx.get(m.match_id+'|'+t),xa=tx.get(m.match_id+'|'+o);if(xf==null||xa==null)return;
  const r=T.get(t)||{t,n:0,pts:0,xp:0,xf:0,xa:0,f:0,a:0,d0:m.date,d1:m.date};r.n++;r.pts+=f>a?3:f===a?1:0;r.xp+=labXPts(xf,xa);r.xf+=xf;r.xa+=xa;r.f+=f;r.a+=a;
  if(m.date<r.d0)r.d0=m.date;if(m.date>r.d1)r.d1=m.date;T.set(t,r)})});
 return [...T.values()].filter(r=>r.n>=6).map(r=>Object.assign(r,{gap:r.pts-r.xp})).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
}
async function labDiscovery(){
 const R=await labDiscCalc();
 if(R.length<6)return `<div class="empty">Not enough matches with shot data in ${esc(D.name)} yet for a reliable discovery (each team needs at least 6).</div>`;
 const top=R[0],mean=labMean(R.map(r=>Math.abs(r.gap))),d0=R.reduce((a,r)=>r.d0<a?r.d0:a,R[0].d0).slice(0,10),d1=R.reduce((a,r)=>r.d1>a?r.d1:a,R[0].d1).slice(0,10);
 const tab=tbl([['Team'],['Matches',1],['Points',1],['Expected points',1],['Difference',1],['xG for',1],['xG against',1],['Goals',1]],
  [...R].sort((a,b)=>a.gap-b.gap).map(r=>[clubLink(r.t),r.n,r.pts,r.xp.toFixed(1),labF(r.gap),r.xf.toFixed(1),r.xa.toFixed(1),r.f+'-'+r.a]));
 if(Math.abs(top.gap)<4)return `<div class="card"><h3>Results in line with chance quality</h3><div class="mu">No team in ${esc(D.name)} has a points total more than 4 away from what its chances were worth (largest difference: <b>${esc(top.t)}</b>, ${labF(top.gap)}).</div></div>`+tab;
 const up=top.gap<0;
 return `<div class="card labdisc"><div class="mu" style="font-size:12px"><span>${esc(D.name)}</span> · <span class="nw">${esc(d0)} – ${esc(d1)}</span></div>
  <h3>${clubLink(top.t)} ${up?'<span>have fewer points than their chances were worth</span>':'<span>have more points than their chances were worth</span>'}</h3>
  <p><span>Points:</span> <b>${top.pts}</b> · <span>expected points from xG:</span> <b>${top.xp.toFixed(1)}</b> · <span>difference:</span> <b>${labF(top.gap)}</b> <span class="mu">(${top.n} <span>matches</span>)</span></p>
  <p class="mu">${up?'Their results have lagged behind the chances they created and allowed: if the chance quality holds, their results are more likely to improve than the table suggests.':'Their results have run ahead of the chances they created and allowed: finishing, goalkeeping or late goals have added points that the chance quality alone does not explain.'}</p>
  <p class="mu" style="font-size:12px"><b>Baseline.</b> <span>Across the ${R.length} teams with at least 6 matches with shot data, the average difference is ${mean.toFixed(1)} points either way.</span></p>
  <p class="mu" style="font-size:12px"><b>How it is worked out.</b> <span>For each match, expected points come from the two teams' xG with goals as independent Poisson counts: 3 × chance of winning + chance of a draw. This is a simplification: it ignores the game state (a team leading sits back), and penalties count in xG. A difference shows where results and chance quality disagree; it does not prove luck, and it does not predict the future on its own.</span></p></div>
  <h3>All teams</h3>${tab}`;
}

/* ---------- the page ---------- */
function labTab(t){LAB.tab=t;LAB.msg='';route()}
function labPlOptions(d,gw){
 const ok=new Set(d.fix.filter(x=>x[0]===gw).flatMap(x=>[x[1],x[2]]));
 return d.P.filter(p=>ok.has(p.tm)&&p.st!=='u').sort((a,b)=>(labN(b.total_points)||0)-(labN(a.total_points)||0)).map(p=>`<option value="${esc(p.wn+' · '+p.tn+' · '+LAB_POS[p.ty]+' · '+(p.now_cost/10).toFixed(1))}" data-id="${p.id}"></option>`).join('');
}
function labPick(id){const v=($('#'+id)||{}).value||'',o=[...document.querySelectorAll('#labpl option')].find(x=>x.value===v);return o?+o.dataset.id:null}
function labSave(type){
 const d=LAB.d,e=labOpen(d),o=labRead();if(o.bad){LAB.msg='Your saved predictions could not be read. Delete them in the Data tab before recording new ones.';route();return}
 if(!e){LAB.msg='There is no open gameweek.';route();return}
 const say=m=>{LAB.msg=m;route()};
 if(Date.now()>=Date.parse(e.dl))return say('The deadline has passed: predictions for this gameweek are closed.');
 const reason=String(($('#labwhy'+type)||{}).value||'').trim().slice(0,280),base={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),type,gw:e.id,season:labSeason(d),dl:e.dl,at:new Date().toISOString(),data:d.generated||'',mv:typeof PM_VERSION!=='undefined'?PM_VERSION:null,why:reason};
 if(type==='pts'){
  const id=labPick('labp1'),v=labN(($('#labpts')||{}).value);
  if(id==null)return say('Choose a player from the list.');if(v==null||v<-5||v>40)return say('Enter predicted points between -5 and 40.');
  if(o.recs.some(r=>r.type==='pts'&&r.gw===e.id&&r.p[0]===id))return say('You already have a points prediction for this player in this gameweek. Remove it first to record a new one.');
  o.recs.push(Object.assign(base,{p:[id],s:[labSnap(d,d.PB.get(id),e.id)],pred:Math.round(v*2)/2}));
 }else{
  const a=labPick('labh1'),b=labPick('labh2'),w=($('#labwin')||{}).value,c=labN(($('#labconf')||{}).value);
  if(a==null||b==null)return say('Choose two players from the list.');if(a===b)return say('Choose two different players.');if(c==null||c<50||c>100)return say('Confidence must be between 50% and 100%.');
  if(o.recs.some(r=>r.type==='h2h'&&r.gw===e.id&&new Set(r.p).has(a)&&new Set(r.p).has(b)))return say('You already have a prediction for this pair in this gameweek.');
  o.recs.push(Object.assign(base,{p:[a,b],s:[labSnap(d,d.PB.get(a),e.id),labSnap(d,d.PB.get(b),e.id)],pick:w==='2'?b:a,conf:c/100}));
 }
 if(!labWrite(o))return say('This browser did not allow saving (storage full or blocked).');
 LAB.msg='Saved. It can be removed until the deadline; after that it is locked.';route();
}
function labDel(id){const o=labRead(),r=o.recs.find(x=>x.id===id);if(!r)return;
 if(Date.now()>=Date.parse(r.dl)){LAB.msg='This prediction is locked: its deadline has passed.';route();return}
 o.recs=o.recs.filter(x=>x.id!==id);labWrite(o);route()}
function labExport(){const o=labRead(),b=new Blob([JSON.stringify({app:'PL Analytics Intelligence Lab',key:LAB_KEY,exported:new Date().toISOString(),v:1,recs:o.recs,cases:o.cases,ms:o.ms},null,1)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(b);a.download='pl-analytics-lab-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function labImport(inp){const f=inp.files&&inp.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{let o=null;try{o=JSON.parse(rd.result)}catch(e){}
 const recs=o&&Array.isArray(o.recs)?o.recs.filter(labValid):null;if(!recs){LAB.msg='That file is not a Lab export.';route();return}
 const cur=labRead(),ids=new Set(cur.recs.map(r=>r.id));let n=0;recs.forEach(r=>{if(!ids.has(r.id)){cur.recs.push(r);n++}});Object.entries(labObj(o.cases)).forEach(([k,v])=>{if(!cur.cases[k]&&v&&v.ans)cur.cases[k]=v});labWrite(cur);LAB.msg=n+' predictions imported.';route()};rd.readAsText(f)}
function labWipe(){if(!confirm('Delete all your Intelligence Lab predictions from this browser? This cannot be undone.'))return;try{localStorage.removeItem(LAB_KEY);localStorage.removeItem(LAB_KEY+'_unreadable')}catch(e){}LAB.msg='All Lab predictions deleted from this browser.';route()}

function labCall(d,r){
 if(r.type==='match')return `<span class="nw"><span>${esc(r.h)}</span> – <span>${esc(r.a)}</span></span>: <b>${r.pick==='H'?'<span>home win</span>':r.pick==='A'?'<span>away win</span>':'<span>draw</span>'}</b> <span class="mu">(${Math.round(r.conf*100)}%)</span> <div class="mu" style="font-size:11px">${esc(r.lname||'')}</div>`;
 const nm=i=>esc(labName(d,r.p[i]));
 if(r.type==='pts')return `<span class="nw">${nm(0)}</span>: <b>${r.pred}</b> <span>pts</span>`;
 return `<span class="nw">${esc(labName(d,r.pick))}</span> <span>over</span> <span class="nw">${esc(labName(d,r.p.find(x=>x!==r.pick)))}</span> <span class="mu">(${Math.round(r.conf*100)}%)</span>`;
}
function labStatus(d,r){
 const st=r.res?r.res.st:Date.now()<Date.parse(r.dl)?'open':'wait';
 return {open:'<span class="labst o">Open</span>',wait:r.type==='match'?'<span class="labst w">Locked, waiting for the result</span>':'<span class="labst w">Locked, waiting for official points</span>',late:'<span class="labst x">Saved after the deadline, not counted</span>',
  blank:'<span class="labst x">No fixture, not counted</span>',tie:'<span class="labst x">Level on points, not counted</span>',ok:'<span class="labst g">Evaluated</span>'}[st];
}
function labRows(d,recs){
 return tbl([['GW',1],['Your prediction'],['Model',1],['Official result'],['Status']],[...recs].sort((a,b)=>Date.parse(b.dl)-Date.parse(a.dl)||String(b.at).localeCompare(String(a.at))).map(r=>{
  const R=r.res,lk=Date.now()>=Date.parse(r.dl);let model='<span class="mu" title="Shown after the deadline">hidden</span>',act='';
  if(r.type==='match'){if(lk)model=r.model?r.model.p.map(x=>Math.round(x*100)+'%').join(' / '):'<span class="mu">N/A</span>';
   if(R&&R.st==='ok')act=`<b>${esc(R.score)}</b> · ${R.won?'<span style="color:var(--g)">right</span>':'<span style="color:var(--r)">wrong</span>'} · <span>Brier</span> ${R.b.toFixed(2)}${R.mb!=null?` <span class="mu">(<span>model</span> ${R.mb.toFixed(2)})</span>`:''}`;
   return [r.gw||'',labCall(d,r)+(r.why?`<div class="mu labwhy">“${esc(r.why)}”</div>`:''),model,act||'<span class="mu">–</span>',labStatus(d,r)+(!lk?` <button class="s labdel" onclick="labDel('${esc(r.id)}')" aria-label="Remove">✕</button>`:'')]}
  if(lk){const M=R&&R.m?R.m:r.p.map(id=>labModel(d,r.gw,id)).every(Boolean)?r.p.map(id=>labModel(d,r.gw,id).v):null;
   model=M?(r.type==='pts'?M[0].toFixed(1):M.map(x=>x.toFixed(1)).join(' – ')):'<span class="mu">N/A</span>'}
  if(R&&R.a)act=r.type==='pts'?`<b>${R.a[0]}</b> <span>pts</span> <span class="mu">(${R.min[0]} <span>min</span>)</span>${R.st==='ok'?` · <span>error</span> ${R.e.toFixed(1)}${R.me!=null?` <span class="mu">(<span>model</span> ${R.me.toFixed(1)})</span>`:''}`:''}`:
   `<b>${R.a[0]} – ${R.a[1]}</b> <span>pts</span>${R.st==='ok'?` · ${R.won?'<span style="color:var(--g)">right</span>':'<span style="color:var(--r)">wrong</span>'} · <span>Brier</span> ${R.b.toFixed(2)}${R.mHit!=null?` <span class="mu">(<span>model</span> ${R.mHit?'<span>right</span>':'<span>wrong</span>'})</span>`:''}`:''}`;
  return [r.gw,labCall(d,r)+(r.why?`<div class="mu labwhy">“${esc(r.why)}”</div>`:''),model,act||'<span class="mu">–</span>',labStatus(d,r)+(!lk?` <button class="s labdel" onclick="labDel('${esc(r.id)}')" aria-label="Remove">✕</button>`:'')];
 }));
}
function labProgress(d,recs){
 const P=recs.filter(r=>r.type==='pts'&&r.res&&r.res.st==='ok'),PM=P.filter(r=>r.res.me!=null),H=recs.filter(r=>r.type==='h2h'&&r.res&&r.res.st==='ok'),HM=H.filter(r=>r.res.mHit!=null);
 const ev=recs.filter(r=>r.res&&r.res.st==='ok').length,k=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
 let cmp='';
 if(PM.length){const u=labMean(PM.map(r=>r.res.e)),m=labMean(PM.map(r=>r.res.me));const se=PM.length>1?Math.sqrt(labVar(PM.map(r=>r.res.e-r.res.me))/PM.length):null;
  cmp+=`<p><span>Points predictions with a model figure:</span> <b>${PM.length}</b> · <span>your mean error</span> <b>${u.toFixed(2)}</b> · <span>model's mean error</span> <b>${m.toFixed(2)}</b> (MAE).</p>`+
   (PM.length<10?'<p class="mu">Fewer than 10: too few to compare you with the model.</p>':se!=null&&Math.abs(u-m)<=2*se?'<p class="mu">The difference is within the noise of this sample (less than two standard errors).</p>':`<p class="mu">${u<m?'Over this sample your predictions have been closer to the official points than the model\'s.':'Over this sample the model has been closer to the official points than your predictions.'}</p>`);}
 if(H.length){const b=labMean(H.map(r=>r.res.b)),hit=labMean(H.map(r=>r.res.won?1:0));
  cmp+=`<p><span>Head-to-head picks:</span> <b>${H.length}</b> · <span>right</span> <b>${Math.round(hit*100)}%</b> · <span>Brier score</span> <b>${b.toFixed(3)}</b> <span class="mu">(<span>0 is perfect; always saying 50% scores 0.25</span>)</span></p>`+
   (HM.length?`<p><span>On the same pairs, the model's pick (the player it predicted more points for) was right</span> <b>${Math.round(labMean(HM.map(r=>r.res.mHit?1:0))*100)}%</b> <span>of the time</span> <span class="mu">(${HM.length} <span>pairs; the model gives points, not probabilities, so only hit rates are compared</span>)</span></p>`:'');}
 const X=recs.filter(r=>r.type==='match'&&r.res&&r.res.st==='ok'),XM=X.filter(r=>r.res.mb!=null);
 if(X.length){const v=XM.map(r=>r.res.b-r.res.mb),se=v.length>1?Math.sqrt(labVar(v)/v.length):null;
  cmp+=`<p><span>Match results:</span> <b>${X.length}</b> · <span>right</span> <b>${Math.round(labMean(X.map(r=>r.res.won?1:0))*100)}%</b> · <span>Brier score</span> <b>${labMean(X.map(r=>r.res.b)).toFixed(3)}</b> <span class="mu">(<span>three outcomes: 0 is perfect, 2 is the worst; one-third each scores 0.667</span>)</span></p>`+
   (XM.length?`<p><span>On the same matches, the xG model's Brier score:</span> <b>${labMean(XM.map(r=>r.res.mb)).toFixed(3)}</b> <span class="mu">(${XM.length})</span></p>`+(XM.length<10?'<p class="mu">Fewer than 10: too few to compare you with the model.</p>':se!=null&&Math.abs(labMean(v))<=2*se?'<p class="mu">The difference is within the noise of this sample (less than two standard errors).</p>':`<p class="mu">${labMean(v)<0?'Over these matches your probabilities scored better than the model\'s.':'Over these matches the model\'s probabilities scored better than yours.'}</p>`):'')}
 return `<div class="grid">${k(recs.length,'Predictions recorded')}${k(ev,'Evaluated')}${k(P.length?labMean(P.map(r=>r.res.e)).toFixed(2):'N/A','Your mean error (points)')}${k(H.length?labMean(H.map(r=>r.res.b)).toFixed(3):'N/A','Your Brier score')}</div>${cmp?`<div class="card">${cmp}</div>`:''}`;
}
function labDNA(recs){
 const ev=recs.filter(r=>r.res&&r.res.st==='ok'),I=labInsights(recs);
 const head=ev.length<20?`<div class="card"><b>Your profile is still developing.</b> <span class="mu"><span>Patterns appear after at least 20 evaluated predictions, with at least 8 in each group being compared. Evaluated so far:</span> ${ev.length}.</span></div>`:'';
 return head+`<div class="mu" style="font-size:12px;margin:8px 0"><div>Each pattern compares two groups of your own evaluated predictions. These describe your past predictions, not you.</div><ul style="margin:4px 0;padding-inline-start:18px"><li>Established pattern: at least 15 in each group (40 in all) and a difference larger than two standard errors.</li><li>Emerging pattern: at least 8 in each group and a difference larger than one standard error.</li><li>Inconclusive: anything less.</li></ul></div>`+
  I.map(x=>{const c=x.c,rs=x.rs;
   const ev2=x.cal?(x.cal.n?`<p class="mu" style="font-size:12px"><span>Average stated confidence</span> <b>${Math.round(x.cal.conf*100)}%</b> · <span>picks right</span> <b>${Math.round(x.cal.hit*100)}%</b> · <span>evaluated picks:</span> ${x.cal.n}</p>`:''):
    x.rows?tbl([['Group'],['Predictions',1],[x.bias?'Average over- or underestimate':'You minus model',1]],x.rows.map(([n,g],i)=>[esc(n),g.length,g.length?labF(i===0?c.m1:c.m2,2):'N/A'])):'';
   return `<div class="card labins ${c.state}"><div class="labinh"><b>${esc(x.t)}</b><span class="labst ${c.state==='established'?'g':c.state==='emerging'?'w':'x'}">${LAB_STATE[c.state]}</span></div><p>${esc(x.v)}</p>${ev2}
    ${x.how?`<div class="mu" style="font-size:11px">${esc(x.how)}</div>`:''}${rs.length&&c.state!=='none'&&c.se!=null?`<div class="mu" style="font-size:11px"><span>Difference</span> ${labF(c.dif,2)} ± ${c.se.toFixed(2)} <span>(one standard error)</span> · ${esc(labGw(rs))}</div>`:''}</div>`}).join('');
}
function labArena(d,recs,extra){
 const e=labOpen(d);
 if(!e)return '<div class="empty">There is no open gameweek: the season\'s deadlines have all passed.</div>'+(extra?`<div class="labforms">${extra}</div>`:'');
 const mine=recs.filter(r=>r.gw===e.id||(r.type==='match'&&!r.res&&Date.now()<Date.parse(r.dl))),dlt=new Date(e.dl),opts=labPlOptions(d,e.id);
 return `<div class="card"><div><b>${esc(e.name)}</b> · <span>Deadline</span> <span class="nw">${esc(dlt.toLocaleString(document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</span></div>
  <div class="mu" style="font-size:12px">Record your call before the deadline. The model's figure for this gameweek is shown only after the deadline, so your judgement stays your own.</div></div>
  <datalist id="labpl">${opts}</datalist>
  <div class="labforms"><div class="card"><h3>How many FPL points will a player score?</h3>
   <label class="labf"><span>Player</span><input id="labp1" list="labpl" placeholder="Type a name" autocomplete="off"></label>
   <label class="labf"><span>Points</span><input id="labpts" type="number" min="-5" max="40" step="0.5" inputmode="decimal" placeholder="e.g. 6"></label>
   <label class="labf"><span>Why? (optional)</span><input id="labwhypts" maxlength="280" placeholder="e.g. strong xG, easy fixture"></label>
   <button onclick="labSave('pts')">Save prediction</button><div class="mu" style="font-size:11px;margin-top:6px">Evaluated with the official points (MAE). A double gameweek adds up.</div></div>
  <div class="card"><h3>Which of two players will score more points?</h3>
   <label class="labf"><span>Player 1</span><input id="labh1" list="labpl" placeholder="Type a name" autocomplete="off"></label>
   <label class="labf"><span>Player 2</span><input id="labh2" list="labpl" placeholder="Type a name" autocomplete="off"></label>
   <label class="labf"><span>Your pick</span><select id="labwin"><option value="1">Player 1</option><option value="2">Player 2</option></select></label>
   <label class="labf"><span>Confidence</span><span class="labconf"><input id="labconf" type="range" min="50" max="100" step="5" value="60" oninput="$('#labconfv').textContent=this.value+'%'"><b id="labconfv">60%</b></span></label>
   <label class="labf"><span>Why? (optional)</span><input id="labwhyh2h" maxlength="280"></label>
   <button onclick="labSave('h2h')">Save prediction</button><div class="mu" style="font-size:11px;margin-top:6px">Evaluated with the Brier score: your confidence against what happened. Level points are not counted.</div></div>${extra||''}</div>
  <h3><span>${esc(e.name)}</span> · <span>Your predictions</span></h3>${mine.length?labRows(d,mine):'<div class="empty">No predictions for this gameweek yet.</div>'}`;
}
R.lab=async function(el){
 await champReady();const d=await labData();
 if(!d||!d.events||!d.fix){el.innerHTML='<h2>Intelligence Lab</h2><div class="empty">The Fantasy Premier League data is not available yet.</div>';return}
 const o=labRead(),msg=LAB.msg;LAB.msg='';if(!o.bad){labEval(d,o);await labEvalMatches(o).catch(()=>false)}const recs=o.recs,ev=recs.filter(r=>r.res&&r.res.st==='ok').length;
 const tabs=[['feed','For you'],['arena','Decision Arena'],['review','Review and progress'],['dna','Analytical DNA'],['week','Weekly review'],['hidden','Hidden patterns'],['case','Case file'],['disc','Discovery'],['data','Your data']];
 if(!tabs.some(t=>t[0]===LAB.tab))LAB.tab='feed';
 let body='';
 if(LAB.tab==='feed')body=o.bad?'':await labFeed(d,o);
 else if(LAB.tab==='arena')body=labArena(d,recs,await labMatchCard());
 else if(LAB.tab==='review')body=labProgress(d,recs)+(o.bad?'':labMsHtml(o))+'<h3>All predictions</h3>'+(recs.length?labRows(d,recs):'<div class="empty">No predictions yet. Record one in the Decision Arena.</div>');
 else if(LAB.tab==='week')body=await labWeek(d,o);
 else if(LAB.tab==='hidden')body=labHiddenHtml(d);
 else if(LAB.tab==='case')body=await labCase(o);
 else if(LAB.tab==='dna')body=labDNA(recs);
 else if(LAB.tab==='disc')body=await labDiscovery();
 else body=`<div class="card"><p>Your predictions are stored only in this browser, on this device. They are not uploaded, do not follow you to another device or browser, and are lost if this browser's site data is cleared. Export them to keep a copy.</p>
  <p class="mu" style="font-size:12px"><span>Stored predictions:</span> ${recs.length}${o.dropped?' · <span>unreadable records skipped:</span> '+o.dropped:''}</p>
  <div class="ctl"><button onclick="labExport()">Export (JSON)</button><label class="s labimp"><span>Import</span><input type="file" accept="application/json,.json" onchange="labImport(this)" hidden></label><button class="s" onclick="labWipe()">Delete all</button></div></div>`;
 el.innerHTML=`<h2>Intelligence Lab</h2>
  ${!recs.length&&!o.bad?`<div class="card labintro"><b>Test your football judgement against the model.</b> <span>Predict FPL points before a gameweek, see how you did once the official points are in, and find out over time where your judgement is strongest. Everything stays in this browser.</span></div>`:''}
  ${o.bad?'<div class="card" style="border-color:var(--r)">Your saved Lab data could not be read, so nothing was changed. A copy was kept; delete it in Your data to start again.</div>':''}
  <div class="seg labtabs">${tabs.map(([k,n])=>`<button class="${LAB.tab===k?'on':''}" onclick="labTab('${k}')">${n}${k==='review'&&ev?` <span class="labn">${ev}</span>`:''}</button>`).join('')}</div>
  ${msg?`<div class="card labmsg" role="status">${esc(msg)}</div>`:''}${body}`;
};

/* ===== Intelligence Lab, part 2: match results, weekly review, hidden patterns, case file, milestones, the feed ===== */

/* ---------- match results in any league: your probabilities against a simple xG model ---------- */
/* Match model "xG Poisson 1": each team's attack and defence are its xG for and against a match this season, pulled toward the
   league average by 3 matches' worth; the home side scores the league's home xG average scaled by its attack and the
   opponent's defence, the away side likewise; goals are independent Poisson counts. It needs 3 matches with shot data for
   both teams. The probabilities are saved with your prediction, from the data of that moment, and stay hidden until kick-off. */
const LAB_MM='xg-poisson-1';
async function labMatchModel(){
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),T=new Map();let hs=0,as=0,n=0;
 fin.forEach(m=>{const xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null)return;n++;hs+=xh;as+=xa;
  [[m.home,xh,xa],[m.away,xa,xh]].forEach(([t,f,a])=>{const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=a;T.set(t,r)})});
 if(n<10)return null;
 const H=hs/n,A=as/n,mu=(H+A)/2,N0=3,str=t=>{const r=T.get(t);return r&&r.n>=3?{att:(r.f+N0*mu)/(r.n+N0)/mu,def:(r.a+N0*mu)/(r.n+N0)/mu,n:r.n}:null};
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 return (h,a)=>{const x=str(h),y=str(a);if(!x||!y)return null;const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,dr=0,l=0;
  for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)dr+=q;else l+=q}const s=w+dr+l;
  return {p:[w/s,dr/s,l/s],lh,la,n:[x.n,y.n],ver:LAB_MM}};
}
const labBrier3=(p,o)=>p.reduce((s,x,i)=>s+Math.pow(x-(i===o?1:0),2),0);
async function labMatchCard(){
 await fixLoad();const L=((FIX.d&&FIX.d.leagues)||{})[D.id]||[],now=Date.now(),soon=now+10*864e5;
 const fx=L.filter(x=>{const t=Date.parse(x.k||x.d);return t>now&&t<soon}).slice(0,40),mine=new Set(labRead().recs.filter(r=>r.type==='match').map(r=>r.mid));
 if(!fx.length)return `<div class="card"><h3>Who will win?</h3><div class="empty">No ${esc(D.name)} fixtures in the next 10 days in the data.</div></div>`;
 const lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
 return `<div class="card"><h3>Who will win? <span class="mu" style="font-weight:400">· <span>${esc(D.name)}</span></span></h3>
  <label class="labf"><span>Match</span><select id="labmx">${fx.map(x=>`<option value="${esc(x.i)}"${mine.has(x.i)?' disabled':''}>${esc(new Date(x.k||x.d).toLocaleString(lc,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))} · ${esc(x.h)} – ${esc(x.a)}</option>`).join('')}</select></label>
  <label class="labf"><span>Your pick</span><select id="labmp"><option value="H">Home win</option><option value="D">Draw</option><option value="A">Away win</option></select></label>
  <label class="labf"><span>Confidence</span><span class="labconf"><input id="labmc" type="range" min="35" max="100" step="5" value="50" oninput="$('#labmcv').textContent=this.value+'%'"><b id="labmcv">50%</b></span></label>
  <label class="labf"><span>Why? (optional)</span><input id="labwhymatch" maxlength="280"></label>
  <button onclick="labSaveMatch()">Save prediction</button><div class="mu" style="font-size:11px;margin-top:6px">Locked at kick-off. Your confidence goes to your pick and the rest is split evenly between the other two results; evaluated with the Brier score for three outcomes (0 is perfect, 2 is the worst), next to the site's xG model.</div></div>`;
}
async function labSaveMatch(){
 const say=m=>{LAB.msg=m;route()},o=labRead();if(o.bad)return say('Your saved predictions could not be read. Delete them in the Data tab before recording new ones.');
 const mid=($('#labmx')||{}).value,x=(((FIX.d&&FIX.d.leagues)||{})[D.id]||[]).find(f=>f.i===mid),pick=($('#labmp')||{}).value,c=labN(($('#labmc')||{}).value);
 if(!x)return say('Choose a match from the list.');if(Date.now()>=Date.parse(x.k||x.d))return say('This match has kicked off: predictions are closed.');
 if(!['H','D','A'].includes(pick)||c==null||c<35||c>100)return say('Confidence must be between #% and #%.'.replace('#',35).replace('#',100));
 if(o.recs.some(r=>r.type==='match'&&r.mid===mid))return say('You already have a prediction for this match.');
 const mm=await labMatchModel(),m=mm?mm(x.h,x.a):null,ix={H:0,D:1,A:2}[pick],pr=[0,1,2].map(i=>i===ix?c/100:(1-c/100)/2);
 o.recs.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:'match',lid:D.id,lname:D.name,mid,h:x.h,a:x.a,dl:new Date(Date.parse(x.k||x.d)).toISOString(),
  at:new Date().toISOString(),pick,conf:c/100,pr,model:m?{p:m.p,lh:m.lh,la:m.la,n:m.n,ver:m.ver}:null,why:String(($('#labwhymatch')||{}).value||'').trim().slice(0,280)});
 if(!labWrite(o))return say('This browser did not allow saving (storage full or blocked).');
 say('Saved. It can be removed until the deadline; after that it is locked.');
}
/* results come from each league's own data file; a league other than the one open is loaded only when one of its matches is due */
async function labEvalMatches(o){
 const due=o.recs.filter(r=>r.type==='match'&&!r.res&&Date.now()>=Date.parse(r.dl));if(!due.length)return false;let ch=false;
 for(const lid of [...new Set(due.map(r=>r.lid))]){
  let M=null;if(D&&D.id===lid)M=D.matches;else{const m=(ALL.leagues||[]).find(l=>l.id===lid);if(!m||!m.file)continue;
   try{const x=await fetch('data/'+m.file+'?v='+encodeURIComponent(ALL.generated||''));if(x.ok){const j=await x.json();M=(j.matches||[]).map(z=>({match_id:z.i,score:z.s,date:z.d}))}}catch(e){}}
  if(!M)continue;const by=new Map(M.map(m=>[m.match_id,m]));
  for(const r of due.filter(r=>r.lid===lid)){const m=by.get(r.mid),g=m&&wkSc(m.score);if(!g)continue;
   if(!(Date.parse(r.at)<Date.parse(r.dl))){r.res={st:'late',t:new Date().toISOString()};ch=true;continue}
   const oc=g[0]>g[1]?0:g[0]===g[1]?1:2,ix={H:0,D:1,A:2}[r.pick],mm=r.model?r.model.p:null,mx=mm?mm.indexOf(Math.max(...mm)):null;
   r.res={st:'ok',score:g[0]+'-'+g[1],o:oc,won:ix===oc,b:labBrier3(r.pr,oc),mb:mm?labBrier3(mm,oc):null,mHit:mm?mx===oc:null,t:new Date().toISOString()};ch=true}
 }
 if(ch)labWrite(o);return ch;
}

/* ---------- weekly review: the last finished gameweek ---------- */
function labWeekOf(d){const fin=d.events.filter(e=>e.fin).sort((a,b)=>b.id-a.id)[0];if(!fin)return null;const nx=d.events.find(e=>e.id===fin.id+1);
 return {e:fin,from:Date.parse(fin.dl),to:nx?Date.parse(nx.dl):Infinity}}
async function labWeek(d,o){
 const W=labWeekOf(d);if(!W)return '<div class="empty">No gameweek has finished yet this season.</div>';
 const inW=r=>r.res&&r.res.st==='ok'&&(r.type==='match'?Date.parse(r.dl)>=W.from&&Date.parse(r.dl)<W.to:r.gw===W.e.id&&r.season===labSeason(d));
 const now=o.recs.filter(inW),before=o.recs.filter(r=>r.res&&r.res.st==='ok'&&!inW(r)&&Date.parse(r.dl)<W.from);
 const R=await labDiscCalc().catch(()=>[]),disc=R.length>=6&&Math.abs(R[0].gap)>=4?`<p><b>${esc(R[0].t)}</b> ${R[0].gap<0?'<span>have fewer points than their chances were worth</span>':'<span>have more points than their chances were worth</span>'}: <b>${labF(R[0].gap)}</b> <span class="mu">(${R[0].n} <span>matches</span> · <span>${esc(D.name)}</span>)</span> · <a href="javascript:labTab('disc')">Discovery</a></p>`:'';
 const head=`<div class="card"><div class="mu" style="font-size:12px"><span>${esc(W.e.name)}</span> · <span class="nw">${esc(new Date(W.from).toISOString().slice(0,10))}</span></div>`;
 if(!now.length)return head+`<p>None of your predictions were evaluated in this gameweek, so there is no personal review this week.</p><p class="mu"><a href="javascript:labTab('arena')">Record a prediction</a> <span>for the next gameweek to get one.</span></p>${disc?'<h3>This week in the data</h3>'+disc:''}</div>`;
 const P=now.filter(r=>r.type==='pts'),PM=P.filter(r=>r.res.me!=null),H=now.filter(r=>r.type==='h2h'),X=now.filter(r=>r.type==='match');
 const lines=[];
 if(P.length)lines.push(`<li><span>Points predictions:</span> <b>${P.length}</b> · <span>your mean error</span> <b>${labMean(P.map(r=>r.res.e)).toFixed(2)}</b>${PM.length?` · <span>model's mean error</span> <b>${labMean(PM.map(r=>r.res.me)).toFixed(2)}</b> <span class="mu">(${PM.length})</span>`:''}</li>`);
 if(H.length)lines.push(`<li><span>Head-to-head picks:</span> <b>${H.length}</b> · <span>right</span> <b>${H.filter(r=>r.res.won).length}</b> · <span>Brier score</span> <b>${labMean(H.map(r=>r.res.b)).toFixed(3)}</b></li>`);
 if(X.length){const XM=X.filter(r=>r.res.mb!=null);lines.push(`<li><span>Match results:</span> <b>${X.length}</b> · <span>right</span> <b>${X.filter(r=>r.res.won).length}</b> · <span>Brier score</span> <b>${labMean(X.map(r=>r.res.b)).toFixed(3)}</b>${XM.length?` · <span>model</span> <b>${labMean(XM.map(r=>r.res.mb)).toFixed(3)}</b>`:''}</li>`)}
 /* most informative: where you and the model differed most, in your favour and against you */
 const gap=r=>r.type==='pts'&&r.res.me!=null?r.res.me-r.res.e:r.type==='match'&&r.res.mb!=null?(r.res.mb-r.res.b)*5:null,G=now.filter(r=>gap(r)!=null).sort((a,b)=>gap(b)-gap(a));
 const desc=r=>`${labCall(d,r)} → ${r.type==='pts'?`<b>${r.res.a[0]}</b> <span>pts</span> (<span>your error</span> ${r.res.e.toFixed(1)} · <span>model's error</span> ${r.res.me.toFixed(1)})`:`<b>${esc(r.res.score)}</b> (<span>Brier</span> ${r.res.b.toFixed(2)} · <span>model</span> ${r.res.mb.toFixed(2)})`}`;
 const best=G.length&&gap(G[0])>0?`<p><b>Most informative success.</b> ${desc(G[0])}</p>`:'',worst=G.length&&gap(G[G.length-1])<0?`<p><b>Most informative mistake.</b> ${desc(G[G.length-1])}</p>`:'';
 /* against your own earlier weeks, on points predictions with a model figure */
 const rel=rs=>rs.filter(r=>r.type==='pts'&&r.res.me!=null).map(r=>r.res.e-r.res.me),a=rel(now),b=rel(before);
 const prev=a.length&&b.length>=10?`<p class="mu"><span>Your error minus the model's this week:</span> <b>${labF(labMean(a),2)}</b> · <span>in earlier weeks:</span> <b>${labF(labMean(b),2)}</b> <span>(lower is better; one week is a small sample)</span></p>`:'';
 const ins=labInsights(o.recs).find(x=>x.c.state==='established'||x.c.state==='emerging');
 return head+`<ul class="labul">${lines.join('')}</ul>${best}${worst}${prev}${ins?`<p><b>Analytical DNA.</b> ${esc(ins.v)} <span class="labst ${ins.c.state==='established'?'g':'w'}">${LAB_STATE[ins.c.state]}</span></p>`:''}${disc?'<h3>This week in the data</h3>'+disc:''}</div>`;
}

/* ---------- hidden patterns in the FPL data ---------- */
function labHidden(d){
 const fin=d.events.filter(e=>e.fin).length,P=d.P.map(p=>Object.assign({},p,{mi:labN(p.minutes)||0,xg:labN(p.expected_goals)||0,xa:labN(p.expected_assists)||0,gl:labN(p.goals_scored)||0,st0:labN(p.starts)||0})),out=[];
 const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null},pos=p=>LAB_POS[p.ty]||'',f2=x=>x.toFixed(2);
 const row=p=>`<b>${esc(p.wn)}</b> <span class="mu">${esc(p.tn)} · ${pos(p)}</span>`;
 /* 1. per 90 against totals */
 {const cap=fin*90,att=P.filter(p=>p.ty>=3&&p.mi>=270),xgi=p=>(p.xg+p.xa)/p.mi*90,reg=att.filter(p=>p.mi>=.7*cap),base=med(reg.map(xgi));
  const L=att.filter(p=>p.mi<=.55*cap&&xgi(p)>=.5).sort((a,b)=>xgi(b)-xgi(a)).slice(0,8);
  out.push({t:'Strong per 90 minutes, limited minutes',why:'Season totals reward minutes. These midfielders and forwards produce chances at a high rate when they play, but have played little, so their totals hide it.',
   base:base!=null?`<span>Midfielders and forwards with at least 70% of the minutes:</span> <span>median xG + xA per 90</span> <b>${f2(base)}</b>`:'',
   rows:L.map(p=>[row(p),Math.round(p.mi),f2(xgi(p)),(p.xg+p.xa).toFixed(1),labN(p.total_points)]),head:[['Player'],['Minutes',1],['xG + xA per 90',1],['xG + xA',1],['FPL points',1]],
   lim:'Few minutes make a figure per 90 minutes noisy, and minutes off the bench can come against tired defences; the rate may not hold with more playing time.'})}
 /* 2. goals against xG */
 {const L=P.filter(p=>p.xg>=2),up=[...L].sort((a,b)=>(b.gl-b.xg)-(a.gl-a.xg)).slice(0,5),dn=[...L].sort((a,b)=>(a.gl-a.xg)-(b.gl-b.xg)).slice(0,5);
  out.push({t:'Goals against the quality of chances',why:'xG measures how good the chances were; goals measure how many went in. A large gap over a few matches says more about this season\'s finishing (and goalkeeping) than about chance quality.',
   base:`<span>Players with at least 2.0 xG:</span> <b>${L.length}</b>`,
   rows:up.concat(dn).map(p=>[row(p),p.gl,p.xg.toFixed(1),labF(p.gl-p.xg)]),head:[['Player'],['Goals',1],['xG',1],['Goals − xG',1]],
   lim:'Some players do finish better than average over many seasons, but over a few matches large gaps are mostly noise. This shows a difference, not its cause.'})}
 /* 3. the model's next-gameweek prediction per million, for players with secure minutes and low ownership */
 {const T=Object.values(d.track.gws||{}).filter(t=>Date.parse(t.dl)>Date.now()).sort((a,b)=>a.gw-b.gw)[0];
  if(T&&T.preds){const sec=p=>(p.chance_of_playing_next_round==null||labN(p.chance_of_playing_next_round)>=100)&&fin>0&&p.st0/fin>=.8,pr=p=>T.preds[String(p.id)],own=p=>labN(p.selected_by_percent);
   const L=P.filter(p=>sec(p)&&fpOk(pr(p))&&p.now_cost>0),pm=p=>pr(p)/(p.now_cost/10),base=L.length?labMean(L.map(pm)):null,V=L.filter(p=>own(p)!=null&&own(p)<10).sort((a,b)=>pm(b)-pm(a)).slice(0,8);
   out.push({t:'Possibly undervalued for Gameweek '+T.gw,why:'Predicted points per £1m from the site\'s model for the next gameweek, among players who start regularly and have no availability flag, owned by fewer than 10% of managers.',
    base:base!=null?`<span>All such regular starters:</span> <b>${base.toFixed(2)}</b> <span>predicted points per £1m</span> <span class="mu">(${L.length})</span>`:'',
    rows:V.map(p=>[row(p),(p.now_cost/10).toFixed(1),pr(p).toFixed(2),pm(p).toFixed(2),own(p).toFixed(1)+'%']),head:[['Player'],['Price',1],['Predicted points',1],['Per £1m',1],['Owned by',1]],
    lim:'A one-gameweek model prediction, not official points; prices and ownership change daily. Cheap players score more per million partly because they are cheap.'})}}
 return out;
}
function labHiddenHtml(d){
 return `<div class="mu" style="font-size:12px;margin-bottom:8px">Patterns in this season's Fantasy Premier League data that totals and tables can hide. Each says what it shows, the baseline, and its limits; none of them shows a cause.</div>`+
  labHidden(d).map(x=>`<div class="card labhp"><h3>${esc(x.t)}</h3><p class="mu">${esc(x.why)}</p>${x.base?`<p style="font-size:13px">${x.base}</p>`:''}${x.rows.length?tbl(x.head,x.rows):'<div class="empty">No player meets the conditions yet.</div>'}<p class="mu" style="font-size:11px"><b>Limits.</b> <span>${esc(x.lim)}</span></p></div>`).join('');
}

/* ---------- case file: a recent match the result did not follow the chances ---------- */
async function labCases(){
 const sh=await loadSh().catch(()=>null),S=sh?sh.rows:[],tx=wkTeamXg(S),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),last=fin.map(m=>m.date.slice(0,10)).sort().pop();if(!last)return [];
 const from=new Date(Date.parse(last+'T00:00:00Z')-20*864e5).toISOString().slice(0,10),out=[];
 fin.filter(m=>m.date.slice(0,10)>=from).forEach(m=>{const g=wkSc(m.score);if(g[0]===g[1])return;const xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null)return;
  const w=g[0]>g[1]?'h':'a',xw=w==='h'?xh:xa,xl=w==='h'?xa:xh;if(xl-xw>=.7)out.push({m,g,w,xw,xl,dx:xl-xw,sh:S.filter(s=>s.m===m.match_id)})});
 return out.sort((a,b)=>b.dx-a.dx||String(b.m.date).localeCompare(String(a.m.date))).slice(0,6);
}
const LAB_CASE_OPTS=[['fin','The winners finished their chances better than expected'],['miss','The losers missed big chances'],['set','The winners scored from set pieces or penalties'],['ot','The losers rarely hit the target']];
function labCaseEvidence(c){
 const W=c.w==='h'?c.m.home:c.m.away,L=c.w==='h'?c.m.away:c.m.home,gw=c.w==='h'?c.g[0]:c.g[1],gl=c.w==='h'?c.g[1]:c.g[0];
 const sW=c.sh.filter(s=>s.c===W&&!s.og),sL=c.sh.filter(s=>s.c===L&&!s.og),goal=s=>s.ev==='Goal',ot=s=>!!s.ot;
 const big=sL.filter(s=>!goal(s)&&s.xg>=.3).sort((a,b)=>b.xg-a.xg),wGoals=sW.filter(goal),setG=wGoals.filter(s=>!['RegularPlay','FastBreak','IndividualPlay'].includes(s.st)),ogs=c.sh.filter(s=>s.og).length;
 const over=gw-c.xw,under=c.xl-gl,f={fin:over>=1,miss:big.length>=2||(big.length>=1&&big[0].xg>=.5),set:setG.length>0&&setG.length*2>=wGoals.length,ot:sL.length>=6&&sL.filter(ot).length/sL.length<.35};
 const main=over>=under?'fin':'miss';
 return {W,L,gw,gl,sW,sL,big,wGoals,setG,ogs,over,under,f,main};
}
async function labCase(o){
 const C=await labCases();if(!C.length)return `<div class="empty">No recent ${esc(D.name)} match in the data where the team with clearly more xG (at least 0.7 more) lost. That is a finding too: recent results have followed the chances.</div>`;
 const pick=(LAB.case&&C.find(c=>c.m.match_id===LAB.case))||C.find(c=>!o.cases[c.m.match_id])||C[0],c=pick,E=labCaseEvidence(c),A=o.cases[c.m.match_id];
 const q=`<div class="mu" style="font-size:12px"><span>${esc(D.name)}</span> · <span class="nw">${esc(c.m.date.slice(0,10))}</span> · ${mlink(c.m)}</div><h3><span>Why did</span> <span>${esc(E.L)}</span> <span>lose to</span> <span>${esc(E.W)}</span> <span>despite creating more chances?</span></h3>
  <p class="mu"><span>xG:</span> <span>${esc(E.L)}</span> <b>${c.xl.toFixed(2)}</b> · <span>${esc(E.W)}</span> <b>${c.xw.toFixed(2)}</b> · <span>Score</span> <b>${esc(c.m.score)}</b></p>`;
 let body;
 if(!A)body=`<p>What do you think explains it? Pick one, then see the evidence.</p><div class="labopts">${LAB_CASE_OPTS.map(([k,t])=>`<button class="s" onclick="labCaseAnswer('${esc(c.m.match_id)}','${k}')">${esc(t)}</button>`).join('')}</div>`;
 else{const sup=Object.keys(E.f).filter(k=>E.f[k]),sh=s=>`${esc(s.pn||'?')} <span class="mu">${s.mn!=null?Math.round(s.mn)+'′':''} · xG ${s.xg.toFixed(2)}${s.st&&s.st!=='RegularPlay'?' · '+esc(SIT[s.st]||s.st):''}</span>`;
  body=`<p><span>Your answer:</span> <b>${esc((LAB_CASE_OPTS.find(x=>x[0]===A.ans)||['',''])[1])}</b> · ${E.f[A.ans]?'<span class="labst g">supported by the evidence</span>':'<span class="labst x">not supported by the evidence</span>'}</p>
   <div class="labev"><div><h4>${esc(E.W)}</h4><p><span>Goals</span> <b>${E.gw}</b> <span>from xG</span> <b>${c.xw.toFixed(2)}</b> (${labF(E.over)}) · <span>shots</span> ${E.sW.length}</p>${E.wGoals.length?'<ul>'+E.wGoals.map(s=>'<li>'+sh(s)+'</li>').join('')+'</ul>':''}</div>
    <div><h4>${esc(E.L)}</h4><p><span>Goals</span> <b>${E.gl}</b> <span>from xG</span> <b>${c.xl.toFixed(2)}</b> (${labF(-E.under)}) · <span>shots</span> ${E.sL.length}</p>${E.big.length?'<div class="mu" style="font-size:12px">Big chances missed (xG ≥ 0.3)</div><ul>'+E.big.slice(0,4).map(s=>'<li>'+sh(s)+'</li>').join('')+'</ul>':''}</div></div>
   <p><b>Conclusion.</b> ${E.main==='fin'?`<span>The bigger part of the gap is on the winners' side: they scored</span> <b>${E.over.toFixed(1)}</b> <span>goals more than their chances were worth.</span>`:`<span>The bigger part of the gap is on the losers' side: they scored</span> <b>${E.under.toFixed(1)}</b> <span>goals fewer than their chances were worth.</span>`}
    <span>Supported explanations:</span> ${sup.length?sup.map(k=>'<b>'+esc(LAB_CASE_OPTS.find(x=>x[0]===k)[1])+'</b>').join(' · '):'<span>none clearly; a small xG difference can go either way</span>'}.</p>
   ${E.ogs?`<p class="mu" style="font-size:12px"><span>Own goals in this match:</span> ${E.ogs} <span>(they count in the score, not in xG).</span></p>`:''}
   <p class="mu" style="font-size:11px"><b>How the evidence is read.</b> <span>Finishing: the winners scored at least 1 goal more than their xG. Big chances missed: two misses of xG 0.3 or more, or one of 0.5 or more. Set pieces: at least half of the winners' goals came from set pieces or penalties. Shooting: under 35% of the losers' shots (at least 6) were on target. xG is a measure of chance quality, not a verdict on the players.</span></p>`}
 const others=C.filter(x=>x!==c).map(x=>`<li><a href="javascript:labOpenCase('${esc(x.m.match_id)}')">${esc(x.m.home)} ${esc(x.m.score)} ${esc(x.m.away)}</a> <span class="mu">${esc(x.m.date.slice(0,10))} · xG ${x.xl.toFixed(2)} – ${x.xw.toFixed(2)}</span>${o.cases[x.m.match_id]?' <span class="labst g">done</span>':''}</li>`).join('');
 return `<div class="card labcase">${q}${body}</div>${others?`<h3>Other recent cases</h3><ul class="labul">${others}</ul>`:''}`;
}
function labOpenCase(id){LAB.case=id;route()}
function labCaseAnswer(id,ans){const o=labRead();if(o.bad)return;if(!o.cases[id]){o.cases[id]={ans,at:new Date().toISOString(),lid:D.id};labWrite(o)}LAB.case=id;route()}

/* ---------- milestones: things you did or measurably achieved; nothing for simply visiting ---------- */
function labMilestones(o){
 const ev=o.recs.filter(r=>r.res&&r.res.st==='ok').sort((a,b)=>String(a.res.t).localeCompare(String(b.res.t))),PM=o.recs.filter(r=>r.type==='pts'&&r.res&&r.res.st==='ok'&&r.res.me!=null);
 const H=o.recs.filter(r=>r.type==='h2h'&&r.res&&r.res.st==='ok').sort((a,b)=>String(a.dl).localeCompare(String(b.dl))),cs=Object.values(o.cases).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const first=[...o.recs].sort((a,b)=>String(a.at).localeCompare(String(b.at)))[0],ins=labInsights(o.recs).find(x=>x.c.state==='established'||x.c.state==='emerging');
 const beat=PM.length>=20?(()=>{const v=PM.map(r=>r.res.e-r.res.me),m=labMean(v),se=Math.sqrt(labVar(v)/v.length);return m<0&&-m>2*se})():false;
 const cal=H.length>=20?labMean(H.slice(-10).map(r=>r.res.b))<labMean(H.slice(0,10).map(r=>r.res.b)):false;
 const L=[['first','First prediction recorded',first&&first.at],['review','First prediction evaluated',ev[0]&&ev[0].res.t],['case','First case file investigated',cs[0]&&cs[0].at],
  ['e10','10 predictions evaluated',ev[9]&&ev[9].res.t],['e25','25 predictions evaluated',ev[24]&&ev[24].res.t],['e50','50 predictions evaluated',ev[49]&&ev[49].res.t],
  ['dna','First pattern in your Analytical DNA',ins?'now':null],['cal','Head-to-head Brier score better in your last 10 picks than your first 10',cal?'now':null],
  ['beat','Closer than the model over at least 20 points predictions (more than two standard errors)',beat?'now':null]];
 let ch=false;L.forEach(([k,,t])=>{if(t&&!o.ms[k]){o.ms[k]=t==='now'?new Date().toISOString():t;ch=true}});if(ch)labWrite(o);
 return L.map(([k,t])=>({k,t,at:o.ms[k]||null}));
}
function labMsHtml(o){const M=labMilestones(o);
 return `<h3>Milestones</h3><div class="mu" style="font-size:12px;margin-bottom:6px">Reached by what you did or measurably achieved; there are no streaks and nothing to lose by taking a break.</div><ul class="labms">${M.map(m=>`<li class="${m.at?'on':''}"><span class="labmk">${m.at?'✓':'·'}</span><span>${esc(m.t)}</span>${m.at?` <span class="mu nw">${esc(String(m.at).slice(0,10))}</span>`:''}</li>`).join('')}</ul>`}

/* ---------- the feed: what is new for you, then what is worth a look ---------- */
async function labFeed(d,o){
 const S=o.seen||{},since=S.t?Date.parse(S.t):null,items=[],e=labOpen(d),ins=labInsights(o.recs);
 const card=(k,html)=>items.push(`<div class="card labfeed ${k}">${html}</div>`);
 if(since){const nev=o.recs.filter(r=>r.res&&r.res.st==='ok'&&Date.parse(r.res.t)>since);
  if(nev.length)card('new',`<b>${nev.length} <span>predictions evaluated since your last visit</span></b> · <a href="javascript:labTab('review')">Review</a>`);
  const chg=ins.filter(x=>(x.c.state==='established'||x.c.state==='emerging')&&(S.dna||{})[x.k]!==x.c.state);
  chg.forEach(x=>card('new',`<b>${esc(LAB_STATE[x.c.state])}:</b> ${esc(x.v)} · <a href="javascript:labTab('dna')">Analytical DNA</a>`));
  const ms=labMilestones(o).filter(m=>m.at&&Date.parse(m.at)>since);if(ms.length)card('new',`<b>${ms.length>1?'Milestones reached':'Milestone reached'}:</b> `+ms.map(m=>`<span>${esc(m.t)}</span>`).join(' · ')+` · <a href="javascript:labTab('review')">Review and progress</a>`)}
 if(e){const n=o.recs.filter(r=>r.gw===e.id&&r.season===labSeason(d)).length;
  card('open',`<b>${esc(e.name)}</b> · <span>Deadline</span> <span class="nw">${esc(new Date(e.dl).toISOString().slice(0,16).replace('T',' '))} UTC</span><br>${n?`<span>Your predictions for this gameweek:</span> <b>${n}</b>`:'<span>You have no predictions for this gameweek yet.</span>'} · <a href="javascript:labTab('arena')">Decision Arena</a>`)}
 /* leagues you have predicted matches in come first */
 const lg=[...new Set(o.recs.filter(r=>r.type==='match').map(r=>r.lid))];await fixLoad();
 [...new Set([...lg,D.id])].slice(0,3).forEach(id=>{const L=(((FIX.d&&FIX.d.leagues)||{})[id]||[]).filter(x=>Date.parse(x.k||x.d)>Date.now()),nm=((ALL.leagues||[]).find(l=>l.id===id)||{}).name;
  if(L.length)card('open',`<b>${esc(nm||'')}</b> · <span>Next match</span> <span>${esc(L[0].h)}</span> – <span>${esc(L[0].a)}</span> <span class="mu nw">${esc(String(L[0].k||L[0].d).slice(0,16).replace('T',' '))} UTC</span>${id===D.id?` · <a href="javascript:labTab('arena')">Predict it</a>`:''}`)});
 const C=await labCases().catch(()=>[]),open=C.find(c=>!o.cases[c.m.match_id]);
 if(open)card('case',`<b>Case file.</b> <span>Why did</span> <span>${esc(open.w==='h'?open.m.away:open.m.home)}</span> <span>lose to</span> <span>${esc(open.w==='h'?open.m.home:open.m.away)}</span> <span>despite creating more chances?</span> · <a href="javascript:labOpenCase('${esc(open.m.match_id)}');labTab('case')">Investigate</a>`);
 const R=await labDiscCalc().catch(()=>[]);if(R.length>=6&&Math.abs(R[0].gap)>=4)card('disc',`<b>Discovery.</b> ${esc(R[0].t)} ${R[0].gap<0?'<span>have fewer points than their chances were worth</span>':'<span>have more points than their chances were worth</span>'} (${labF(R[0].gap)}) · <a href="javascript:labTab('disc')">Discovery</a>`);
 const hp=labHidden(d).find(x=>x.rows.length);if(hp)card('disc',`<b>Hidden pattern.</b> <span>${esc(hp.t)}</span> · <a href="javascript:labTab('hidden')">Hidden patterns</a>`);
 const dev=o.recs.filter(r=>r.res&&r.res.st==='ok').length<20;
 if(dev)card('tip',`<span>Your Analytical DNA appears after 20 evaluated predictions. Evaluated so far:</span> <b>${o.recs.filter(r=>r.res&&r.res.st==='ok').length}</b>`);
 /* remember what was shown, so the next visit can say what changed */
 o.seen={t:new Date().toISOString(),dna:Object.fromEntries(ins.map(x=>[x.k,x.c.state]))};labWrite(o);
 return (since?'':`<div class="mu" style="font-size:12px;margin-bottom:8px">From your next visit, this page starts with what changed since this one.</div>`)+items.join('');
}
"""


def _x_lab_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (Intelligence Lab): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    h = html
    h = sub(h, "</style></head>", _X_LABCSS + "</style></head>")
    h = sub(h, "async function route(){", _X_LABJS + "\nasync function route(){")
    h = sub(h, "['fantasy','Fantasy'],", "['fantasy','Fantasy'],['lab','Intelligence Lab'],")
    return h


_AR_SEASON.update({
    "Intelligence Lab": "مختبر التحليل",
    "Decision Arena": "ساحة القرار",
    "Review and progress": "المراجعة والتقدم",
    "Analytical DNA": "بصمتك التحليلية",
    "Discovery": "اكتشاف",
    "Your data": "بياناتك",
    "Gameweek #": "الجولة #",
    "Deadline": "الموعد النهائي",
    "Record your call before the deadline. The model's figure for this gameweek is shown only after the deadline, so your judgement stays your own.": "سجّل توقعك قبل الموعد النهائي. رقم النموذج لهذه الجولة ما يظهر إلا بعد الموعد، عشان يبقى حكمك من عندك.",
    "How many FPL points will a player score?": "كم نقطة فانتازي بيجيب اللاعب؟",
    "Which of two players will score more points?": "مين من اللاعبين بيجيب نقاط أكثر؟",
    "Player": "اللاعب",
    "Points": "النقاط",
    "Why? (optional)": "ليش؟ (اختياري)",
    "Save prediction": "احفظ التوقع",
    "Evaluated with the official points (MAE). A double gameweek adds up.": "يُقيَّم بالنقاط الرسمية (متوسط الخطأ المطلق). نقاط الجولة المزدوجة تُجمع.",
    "Player #": "اللاعب #",
    "Your pick": "اختيارك",
    "Confidence": "الثقة",
    "Evaluated with the Brier score: your confidence against what happened. Level points are not counted.": "يُقيَّم بمقياس Brier: ثقتك مقابل اللي صار. التعادل في النقاط ما يُحسب.",
    "Your predictions": "توقعاتك",
    "No predictions for this gameweek yet.": "ما فيه توقعات لهذه الجولة للحين.",
    "Type a name": "اكتب اسم اللاعب",
    "e.g. #": "مثلاً #",
    "e.g. strong xG, easy fixture": "مثلاً: xG قوي، مباراة سهلة",
    "GW": "الجولة",
    "Your prediction": "توقعك",
    "Model": "النموذج",
    "Official result": "النتيجة الرسمية",
    "Status": "الحالة",
    "over": "أكثر من",
    "hidden": "مخفي",
    "Shown after the deadline": "يظهر بعد الموعد النهائي",
    "Open": "مفتوح",
    "Remove": "احذف",
    "Locked, waiting for official points": "مقفل، بانتظار النقاط الرسمية",
    "Saved after the deadline, not counted": "حُفظ بعد الموعد النهائي، ما يُحسب",
    "No fixture, not counted": "ما عنده مباراة، ما يُحسب",
    "Level on points, not counted": "تعادل في النقاط، ما يُحسب",
    "Evaluated": "تم التقييم",
    "pts": "نقطة",
    "min": "دقيقة",
    "error": "الخطأ",
    "model": "النموذج",
    "right": "صح",
    "wrong": "خطأ",
    "Brier": "Brier",
    "Predictions recorded": "التوقعات المسجّلة",
    "Your mean error (points)": "متوسط خطئك (نقاط)",
    "Your Brier score": "درجة Brier لك",
    "Points predictions with a model figure:": "توقعات النقاط اللي لها رقم من النموذج:",
    "your mean error": "متوسط خطئك",
    "model's mean error": "متوسط خطأ النموذج",
    "(MAE)": "(متوسط الخطأ المطلق)",
    "The difference is within the noise of this sample (less than two standard errors).": "الفرق ضمن تذبذب هذه العينة (أقل من خطأين معياريين).",
    "Over this sample your predictions have been closer to the official points than the model's.": "في هذه العينة كانت توقعاتك أقرب للنقاط الرسمية من توقعات النموذج.",
    "Over this sample the model has been closer to the official points than your predictions.": "في هذه العينة كان النموذج أقرب للنقاط الرسمية من توقعاتك.",
    "Head-to-head picks:": "اختيارات المواجهة:",
    "Brier score": "درجة Brier",
    "# is perfect; always saying #% scores #": "# تعني توقعاً مثالياً؛ لو قلت #% دائماً تكون درجتك #",
    "On the same pairs, the model's pick (the player it predicted more points for) was right": "في نفس الأزواج، اختيار النموذج (اللاعب اللي توقع له نقاط أكثر) كان صحيحاً",
    "of the time": "من المرات",
    "pairs; the model gives points, not probabilities, so only hit rates are compared": "زوج؛ النموذج يعطي نقاطاً وليس احتمالات، لذلك نقارن نسبة الإصابة فقط",
    "All predictions": "كل التوقعات",
    "No predictions yet. Record one in the Decision Arena.": "ما فيه توقعات للحين. سجّل أول توقع في ساحة القرار.",
    "Your profile is still developing.": "بصمتك التحليلية للحين في طور التكوّن.",
    "Patterns appear after at least # evaluated predictions, with at least # in each group being compared. Evaluated so far:": "الأنماط تظهر بعد # توقعاً مقيّماً على الأقل، وفي كل مجموعة نقارنها # على الأقل. المقيّم حتى الآن:",
    "Each pattern compares two groups of your own evaluated predictions. These describe your past predictions, not you.": "كل نمط يقارن بين مجموعتين من توقعاتك المقيّمة. هذه الأنماط تصف توقعاتك السابقة، ولا تصفك أنت.",
    "Established pattern: at least # in each group (# in all) and a difference larger than two standard errors.": "نمط ثابت: # على الأقل في كل مجموعة (# إجمالاً) وفرق أكبر من خطأين معياريين.",
    "Emerging pattern: at least # in each group and a difference larger than one standard error.": "نمط ناشئ: # على الأقل في كل مجموعة وفرق أكبر من خطأ معياري واحد.",
    "Inconclusive: anything less.": "غير محسوم: أي شي أقل من كذا.",
    "Established pattern": "نمط ثابت",
    "Emerging pattern": "نمط ناشئ",
    "Inconclusive": "غير محسوم",
    "Not enough data": "البيانات غير كافية",
    "Group": "المجموعة",
    "Predictions": "التوقعات",
    "You minus model": "أنت ناقص النموذج",
    "Average over- or underestimate": "متوسط المبالغة أو التقليل",
    "Difference": "الفرق",
    "(one standard error)": "(خطأ معياري واحد)",
    "Attackers and defenders": "المهاجمون والمدافعون",
    "No clear difference yet between your predictions for attackers and for defenders.": "ما فيه فرق واضح للحين بين توقعاتك للمهاجمين وللمدافعين.",
    "Compared with the model, your predictions have been more accurate for attackers (MID, FWD) than for defenders (GKP, DEF).": "مقارنة بالنموذج، توقعاتك كانت أدق للمهاجمين (الوسط والهجوم) منها للمدافعين (الحراس والدفاع).",
    "Compared with the model, your predictions have been more accurate for defenders (GKP, DEF) than for attackers (MID, FWD).": "مقارنة بالنموذج، توقعاتك كانت أدق للمدافعين (الحراس والدفاع) منها للمهاجمين (الوسط والهجوم).",
    "Attackers (MID, FWD)": "المهاجمون (الوسط والهجوم)",
    "Defenders (GKP, DEF)": "المدافعون (الحراس والدفاع)",
    "Your error minus the model's error on the same predictions, in points; lower is better for you.": "خطؤك ناقص خطأ النموذج على نفس التوقعات، بالنقاط؛ الأقل أفضل لك.",
    "Players in hot form": "لاعبون في فورم عالي",
    "No clear sign yet that recent form pulls your predictions up or down.": "ما فيه دليل واضح للحين إن الفورم الأخير يرفع توقعاتك أو ينزلها.",
    "You have predicted more points than players in hot form went on to score, more so than for other players: recent form may weigh heavily in your predictions.": "توقعت للاعبين اللي في فورم عالي نقاطاً أكثر مما جابوا فعلاً، وبفارق أكبر من باقي اللاعبين: يمكن الفورم الأخير يأخذ وزناً كبيراً في توقعاتك.",
    "You have predicted fewer points than players in hot form went on to score, more so than for other players.": "توقعت للاعبين اللي في فورم عالي نقاطاً أقل مما جابوا فعلاً، وبفارق أكبر من باقي اللاعبين.",
    "Your predictions for players in hot form and for other players differ, without a consistent over- or underestimate.": "توقعاتك للاعبين اللي في فورم عالي تختلف عن باقي اللاعبين، بدون مبالغة أو تقليل ثابت.",
    "Hot form (last # days ≥ # points a match above season average)": "فورم عالي (آخر # يوم أعلى من متوسط الموسم بـ# نقاط على الأقل في المباراة)",
    "Other players": "باقي اللاعبين",
    "Your prediction minus the official points, on average; above # means you predicted too many.": "توقعك ناقص النقاط الرسمية، في المتوسط؛ فوق # يعني توقعت أكثر من اللازم.",
    "Underlying numbers and recent points": "الأرقام الأساسية والنقاط الأخيرة",
    "Not enough evidence yet on whether you read underlying numbers or recent points better.": "ما فيه دليل كافٍ للحين على إنك تقرأ الأرقام الأساسية أفضل من النقاط الأخيرة أو العكس.",
    "Compared with the model, you have evaluated players with strong underlying attacking numbers (xG + xA) more accurately than players in hot form without them.": "مقارنة بالنموذج، قيّمت اللاعبين اللي أرقامهم الهجومية الأساسية قوية (xG + xA) بدقة أكبر من اللاعبين اللي في فورم عالي بدونها.",
    "Compared with the model, you have evaluated players in hot form without strong underlying numbers more accurately than players with strong xG + xA.": "مقارنة بالنموذج، قيّمت اللاعبين اللي في فورم عالي بدون أرقام أساسية قوية بدقة أكبر من اللاعبين اللي عندهم xG + xA قوي.",
    "xG + xA per # ≥ # (at least # minutes)": "xG + xA لكل # دقيقة ≥ # (# دقيقة على الأقل)",
    "Hot form, xG + xA per # < #": "فورم عالي، وxG + xA لكل # دقيقة < #",
    "Uncertain minutes": "دقائق غير مضمونة",
    "No clear difference yet between players with secure and uncertain minutes.": "ما فيه فرق واضح للحين بين اللاعبين اللي دقائقهم مضمونة واللي دقائقهم غير مضمونة.",
    "Compared with the model, your predictions have been less accurate when a player's minutes were uncertain.": "مقارنة بالنموذج، توقعاتك كانت أقل دقة لما كانت دقائق اللاعب غير مضمونة.",
    "Compared with the model, your predictions have been more accurate when a player's minutes were uncertain.": "مقارنة بالنموذج، توقعاتك كانت أدق لما كانت دقائق اللاعب غير مضمونة.",
    "Uncertain minutes (availability flag, or started under #% of gameweeks)": "دقائق غير مضمونة (عليه تنبيه جاهزية، أو بدأ أقل من #% من الجولات)",
    "Secure minutes": "دقائق مضمونة",
    "Not enough evidence yet on whether your confidence matches your results.": "ما فيه دليل كافٍ للحين على إن ثقتك تطابق نتائجك.",
    "Your stated confidence has been higher than your hit rate: your head-to-head picks were right less often than you expected.": "ثقتك المعلنة كانت أعلى من نسبة إصابتك: اختياراتك في المواجهات صحّت أقل مما توقعت.",
    "Your hit rate has been higher than your stated confidence: you may be underconfident in your head-to-head picks.": "نسبة إصابتك كانت أعلى من ثقتك المعلنة: يمكن إنك تقلل من ثقتك في اختيارات المواجهات.",
    "Average stated confidence": "متوسط الثقة المعلنة",
    "picks right": "اختيارات صحيحة",
    "evaluated picks:": "الاختيارات المقيّمة:",
    "Your last # predictions": "آخر # توقعات لك",
    "No clear change yet between your last # evaluated predictions and the earlier ones.": "ما فيه تغيّر واضح للحين بين آخر # توقعات مقيّمة واللي قبلها.",
    "Compared with the model, your last # evaluated predictions were more accurate than your earlier ones.": "مقارنة بالنموذج، آخر # توقعات مقيّمة كانت أدق من اللي قبلها.",
    "Compared with the model, your last # evaluated predictions were less accurate than your earlier ones.": "مقارنة بالنموذج، آخر # توقعات مقيّمة كانت أقل دقة من اللي قبلها.",
    "Last #": "آخر #",
    "Earlier": "اللي قبلها",
    "have fewer points than their chances were worth": "عندهم نقاط أقل مما تستحقه فرصهم",
    "have more points than their chances were worth": "عندهم نقاط أكثر مما تستحقه فرصهم",
    "Points:": "النقاط:",
    "expected points from xG:": "النقاط المتوقعة من xG:",
    "difference:": "الفرق:",
    "matches": "مباراة",
    "Their results have lagged behind the chances they created and allowed: if the chance quality holds, their results are more likely to improve than the table suggests.": "نتائجهم متأخرة عن الفرص اللي صنعوها واللي سمحوا فيها: لو استمرت جودة الفرص، الأرجح إن نتائجهم تتحسن أكثر مما يوحي به الجدول.",
    "Their results have run ahead of the chances they created and allowed: finishing, goalkeeping or late goals have added points that the chance quality alone does not explain.": "نتائجهم سابقة الفرص اللي صنعوها واللي سمحوا فيها: إنهاء الهجمات أو الحارس أو الأهداف المتأخرة أضافت نقاطاً ما تفسرها جودة الفرص وحدها.",
    "Baseline.": "المرجع.",
    "Across the # teams with at least # matches with shot data, the average difference is # points either way.": "بين الـ# فريق اللي عندهم # مباريات على الأقل فيها بيانات تسديد، متوسط الفرق # نقطة بالزيادة أو النقص.",
    "How it is worked out.": "طريقة الحساب.",
    "For each match, expected points come from the two teams' xG with goals as independent Poisson counts: # × chance of winning + chance of a draw. This is a simplification: it ignores the game state (a team leading sits back), and penalties count in xG. A difference shows where results and chance quality disagree; it does not prove luck, and it does not predict the future on its own.": "في كل مباراة، النقاط المتوقعة تُحسب من xG الفريقين بافتراض إن الأهداف أعداد بواسون مستقلة: # × احتمال الفوز + احتمال التعادل. هذا تبسيط: يتجاهل حالة المباراة (الفريق المتقدم يتراجع)، وركلات الجزاء تدخل في xG. الفرق يبيّن وين تختلف النتائج عن جودة الفرص؛ ما يثبت الحظ، وما يتنبأ بالمستقبل لوحده.",
    "All teams": "كل الفرق",
    "Expected points": "النقاط المتوقعة",
    "xG for": "xG له",
    "xG against": "xG عليه",
    "Goals": "الأهداف",
    "Results in line with chance quality": "النتائج متماشية مع جودة الفرص",
    "Your predictions are stored only in this browser, on this device. They are not uploaded, do not follow you to another device or browser, and are lost if this browser's site data is cleared. Export them to keep a copy.": "توقعاتك محفوظة في هذا المتصفح على هذا الجهاز فقط. ما تُرفع لأي مكان، وما تنتقل لجهاز أو متصفح ثاني، وتضيع لو انمسحت بيانات الموقع في المتصفح. صدّرها عشان تحتفظ بنسخة.",
    "Stored predictions:": "التوقعات المحفوظة:",
    "unreadable records skipped:": "سجلات تالفة تم تجاهلها:",
    "Export (JSON)": "تصدير (JSON)",
    "Import": "استيراد",
    "Delete all": "احذف الكل",
    "Test your football judgement against the model.": "اختبر حكمك الكروي مقابل النموذج.",
    "Predict FPL points before a gameweek, see how you did once the official points are in, and find out over time where your judgement is strongest. Everything stays in this browser.": "توقّع نقاط الفانتازي قبل الجولة، وشوف نتيجتك لما تنزل النقاط الرسمية، واكتشف مع الوقت وين حكمك أقوى. كل شي يبقى في هذا المتصفح.",
    "Your saved Lab data could not be read, so nothing was changed. A copy was kept; delete it in Your data to start again.": "ما قدرنا نقرأ بيانات المختبر المحفوظة، فما غيّرنا شي. احتفظنا بنسخة منها؛ احذفها من بياناتك عشان تبدأ من جديد.",
    "Saved. It can be removed until the deadline; after that it is locked.": "تم الحفظ. تقدر تحذفه لين الموعد النهائي؛ بعدها يُقفل.",
    "Choose a player from the list.": "اختر لاعباً من القائمة.",
    "Choose two players from the list.": "اختر لاعبين من القائمة.",
    "Choose two different players.": "اختر لاعبين مختلفين.",
    "Enter predicted points between # and #.": "اكتب نقاطاً متوقعة بين # و#.",
    "Confidence must be between #% and #%.": "الثقة لازم تكون بين #% و#%.",
    "You already have a points prediction for this player in this gameweek. Remove it first to record a new one.": "عندك توقع نقاط لهذا اللاعب في هذه الجولة. احذفه أولاً عشان تسجّل توقعاً جديداً.",
    "You already have a prediction for this pair in this gameweek.": "عندك توقع لهذين اللاعبين في هذه الجولة.",
    "The deadline has passed: predictions for this gameweek are closed.": "الموعد النهائي فات: التوقعات لهذه الجولة مقفلة.",
    "There is no open gameweek.": "ما فيه جولة مفتوحة.",
    "There is no open gameweek: the season's deadlines have all passed.": "ما فيه جولة مفتوحة: كل مواعيد الموسم النهائية فاتت.",
    "This prediction is locked: its deadline has passed.": "هذا التوقع مقفل: موعده النهائي فات.",
    "This browser did not allow saving (storage full or blocked).": "المتصفح ما سمح بالحفظ (التخزين ممتلئ أو محظور).",
    "Your saved predictions could not be read. Delete them in the Data tab before recording new ones.": "ما قدرنا نقرأ توقعاتك المحفوظة. احذفها من تبويب بياناتك قبل ما تسجّل توقعات جديدة.",
    "That file is not a Lab export.": "هذا الملف مو ملف تصدير من المختبر.",
    "# predictions imported.": "تم استيراد # توقع.",
    "All Lab predictions deleted from this browser.": "انحذفت كل توقعات المختبر من هذا المتصفح.",
    "The Fantasy Premier League data is not available yet.": "بيانات فانتازي الدوري الإنجليزي غير متوفرة للحين.",
    "For you": "لك",
    "Weekly review": "المراجعة الأسبوعية",
    "Hidden patterns": "أنماط خفية",
    "Case file": "ملف القضية",
    "Milestone reached:": "إنجاز جديد:",
    "Milestones reached:": "إنجازات جديدة:",
    "You have no predictions for this gameweek yet.": "ما عندك توقعات لهذه الجولة للحين.",
    "Your predictions for this gameweek:": "توقعاتك لهذه الجولة:",
    "Next match": "المباراة القادمة",
    "Predict it": "توقّعها",
    "Hidden pattern.": "نمط خفي.",
    "Discovery.": "اكتشاف.",
    "Case file.": "ملف القضية.",
    "predictions evaluated since your last visit": "توقع تقيّم من آخر زيارة",
    "From your next visit, this page starts with what changed since this one.": "من زيارتك الجاية، هذه الصفحة تبدأ باللي تغيّر من هذي الزيارة.",
    "Your Analytical DNA appears after # evaluated predictions. Evaluated so far:": "بصمتك التحليلية تظهر بعد # توقعاً مقيّماً. المقيّم حتى الآن:",
    "Who will win?": "مين بيفوز؟",
    "Match": "المباراة",
    "Home win": "فوز صاحب الأرض",
    "Draw": "تعادل",
    "Away win": "فوز الضيف",
    "home win": "فوز صاحب الأرض",
    "away win": "فوز الضيف",
    "draw": "تعادل",
    "Locked at kick-off. Your confidence goes to your pick and the rest is split evenly between the other two results; evaluated with the Brier score for three outcomes (# is perfect, # is the worst), next to the site's xG model.": "يُقفل مع بداية المباراة. ثقتك تروح لاختيارك، والباقي يتقسّم بالتساوي على النتيجتين الثانيتين؛ يُقيَّم بمقياس Brier لثلاث نتائج (# مثالي، # الأسوأ)، جنب نموذج xG الخاص بالموقع.",
    "No # fixtures in the next # days in the data.": "ما فيه مباريات في البيانات خلال الأيام الـ# القادمة.",
    "Choose a match from the list.": "اختر مباراة من القائمة.",
    "This match has kicked off: predictions are closed.": "المباراة بدأت: التوقعات مقفلة.",
    "You already have a prediction for this match.": "عندك توقع لهذه المباراة.",
    "Locked, waiting for the result": "مقفل، بانتظار النتيجة",
    "Match results:": "نتائج المباريات:",
    "three outcomes: # is perfect, # is the worst; one-third each scores #": "ثلاث نتائج: # مثالي، # الأسوأ؛ الثلث لكل نتيجة يعطي #",
    "On the same matches, the xG model's Brier score:": "في نفس المباريات، درجة Brier لنموذج xG:",
    "Over these matches your probabilities scored better than the model's.": "في هذه المباريات كانت احتمالاتك أفضل من احتمالات النموذج.",
    "Over these matches the model's probabilities scored better than yours.": "في هذه المباريات كانت احتمالات النموذج أفضل من احتمالاتك.",
    "Milestones": "الإنجازات",
    "Reached by what you did or measurably achieved; there are no streaks and nothing to lose by taking a break.": "تتحقق باللي سويته أو حققته فعلاً بالأرقام؛ ما فيه سلاسل متتالية، وما تخسر شي لو أخذت استراحة.",
    "First prediction recorded": "أول توقع مسجّل",
    "First prediction evaluated": "أول توقع مقيّم",
    "First case file investigated": "أول ملف قضية حللته",
    "# predictions evaluated": "# توقع مقيّم",
    "First pattern in your Analytical DNA": "أول نمط في بصمتك التحليلية",
    "Head-to-head Brier score better in your last # picks than your first #": "درجة Brier في المواجهات أفضل في آخر # اختيارات من أول #",
    "Closer than the model over at least # points predictions (more than two standard errors)": "أقرب من النموذج في # توقع نقاط على الأقل (بأكثر من خطأين معياريين)",
    "Points predictions:": "توقعات النقاط:",
    "Most informative success.": "أكثر نجاح مفيد.",
    "Most informative mistake.": "أكثر خطأ مفيد.",
    "your error": "خطؤك",
    "model's error": "خطأ النموذج",
    "This week in the data": "هذا الأسبوع في البيانات",
    "No gameweek has finished yet this season.": "ما انتهت أي جولة للحين هذا الموسم.",
    "None of your predictions were evaluated in this gameweek, so there is no personal review this week.": "ما تقيّم أي توقع لك في هذه الجولة، فما فيه مراجعة شخصية هذا الأسبوع.",
    "Record a prediction": "سجّل توقعاً",
    "for the next gameweek to get one.": "للجولة القادمة عشان تحصل على مراجعة.",
    "Your error minus the model's this week:": "خطؤك ناقص خطأ النموذج هذا الأسبوع:",
    "in earlier weeks:": "في الأسابيع السابقة:",
    "(lower is better; one week is a small sample)": "(الأقل أفضل؛ أسبوع واحد عينة صغيرة)",
    "Analytical DNA.": "بصمتك التحليلية.",
    "Patterns in this season's Fantasy Premier League data that totals and tables can hide. Each says what it shows, the baseline, and its limits; none of them shows a cause.": "أنماط في بيانات فانتازي الدوري الإنجليزي هذا الموسم ممكن تخفيها المجاميع والجداول. كل نمط يوضح وش يبيّن، والمرجع، وحدوده؛ وما فيها شي يثبت السبب.",
    "Strong per # minutes, limited minutes": "قوي لكل # دقيقة، بدقائق قليلة",
    "Season totals reward minutes. These midfielders and forwards produce chances at a high rate when they play, but have played little, so their totals hide it.": "مجاميع الموسم تكافئ الدقائق. لاعبو الوسط والهجوم هؤلاء يصنعون فرصاً بمعدل عالٍ لما يلعبون، لكنهم لعبوا قليلاً، فمجاميعهم تخفي هذا.",
    "Midfielders and forwards with at least #% of the minutes:": "لاعبو الوسط والهجوم اللي لعبوا #% من الدقائق على الأقل:",
    "median xG + xA per #": "وسيط xG + xA لكل # دقيقة",
    "xG + xA per #": "xG + xA لكل # دقيقة",
    "xG + xA": "xG + xA",
    "Minutes": "الدقائق",
    "FPL points": "نقاط الفانتازي",
    "Limits.": "الحدود.",
    "Goals against the quality of chances": "الأهداف مقابل جودة الفرص",
    "xG measures how good the chances were; goals measure how many went in. A large gap over a few matches says more about this season's finishing (and goalkeeping) than about chance quality.": "xG يقيس جودة الفرص؛ والأهداف تقيس كم منها دخل. الفرق الكبير خلال مباريات قليلة يقول عن إنهاء الهجمات (وأداء الحراس) هذا الموسم أكثر مما يقول عن جودة الفرص.",
    "Players with at least # xG:": "اللاعبون اللي عندهم # xG على الأقل:",
    "Goals − xG": "الأهداف − xG",
    "Some players do finish better than average over many seasons, but over a few matches large gaps are mostly noise. This shows a difference, not its cause.": "بعض اللاعبين فعلاً ينهون الهجمات أفضل من المتوسط على مدى مواسم، لكن خلال مباريات قليلة الفروق الكبيرة غالباً تذبذب. هذا يبيّن فرقاً، مو سببه.",
    "Possibly undervalued for Gameweek #": "ممكن تكون قيمتهم أعلى من سعرهم في الجولة #",
    "Predicted points per £#m from the site's model for the next gameweek, among players who start regularly and have no availability flag, owned by fewer than #% of managers.": "النقاط المتوقعة لكل #م£ من نموذج الموقع للجولة القادمة، بين اللاعبين اللي يبدؤون بانتظام وما عليهم تنبيه جاهزية، ويملكهم أقل من #% من المدربين.",
    "All such regular starters:": "كل هؤلاء الأساسيين:",
    "predicted points per £#m": "نقطة متوقعة لكل #م£",
    "Predicted points": "النقاط المتوقعة",
    "Per £#m": "لكل #م£",
    "Owned by": "نسبة الامتلاك",
    "Price": "السعر",
    "A one-gameweek model prediction, not official points; prices and ownership change daily. Cheap players score more per million partly because they are cheap.": "توقع النموذج لجولة وحدة، مو نقاط رسمية؛ الأسعار ونسب الامتلاك تتغير يومياً. اللاعبون الرخيصون يجيبون نقاطاً أكثر لكل مليون جزئياً لأنهم رخيصون.",
    "No player meets the conditions yet.": "ما فيه لاعب يحقق الشروط للحين.",
    "Why did": "ليش",
    "lose to": "خسر قدام",
    "despite creating more chances?": "مع إنه صنع فرصاً أكثر؟",
    "xG:": "xG:",
    "Score": "النتيجة",
    "What do you think explains it? Pick one, then see the evidence.": "وش تتوقع السبب؟ اختر واحداً، وبعدها شوف الأدلة.",
    "The winners finished their chances better than expected": "الفائز أنهى فرصه أفضل من المتوقع",
    "The losers missed big chances": "الخاسر أضاع فرصاً كبيرة",
    "The winners scored from set pieces or penalties": "الفائز سجّل من كرات ثابتة أو ركلات جزاء",
    "The losers rarely hit the target": "الخاسر نادراً ما سدد على المرمى",
    "Your answer:": "إجابتك:",
    "supported by the evidence": "تدعمها الأدلة",
    "not supported by the evidence": "ما تدعمها الأدلة",
    "from xG": "من xG",
    "shots": "تسديدة",
    "Big chances missed (xG ≥ #)": "فرص كبيرة ضائعة (xG ≥ #)",
    "Conclusion.": "الخلاصة.",
    "The bigger part of the gap is on the winners' side: they scored": "الجزء الأكبر من الفرق عند الفائز: سجّل",
    "goals more than their chances were worth.": "أهداف أكثر مما تستحقه فرصه.",
    "The bigger part of the gap is on the losers' side: they scored": "الجزء الأكبر من الفرق عند الخاسر: سجّل",
    "goals fewer than their chances were worth.": "أهداف أقل مما تستحقه فرصه.",
    "Supported explanations:": "التفسيرات المدعومة:",
    "none clearly; a small xG difference can go either way": "ولا وحد بوضوح؛ فرق xG الصغير ممكن يروح لأي جهة",
    "Own goals in this match:": "الأهداف العكسية في هذه المباراة:",
    "(they count in the score, not in xG).": "(تُحسب في النتيجة، وما تدخل في xG).",
    "How the evidence is read.": "كيف نقرأ الأدلة.",
    "Finishing: the winners scored at least # goal more than their xG. Big chances missed: two misses of xG # or more, or one of # or more. Set pieces: at least half of the winners' goals came from set pieces or penalties. Shooting: under #% of the losers' shots (at least #) were on target. xG is a measure of chance quality, not a verdict on the players.": "الإنهاء: الفائز سجّل # هدف على الأقل أكثر من xG حقه. الفرص الكبيرة الضائعة: فرصتان بـxG # أو أكثر، أو فرصة وحدة بـ# أو أكثر. الكرات الثابتة: نصف أهداف الفائز على الأقل من كرات ثابتة أو ركلات جزاء. التسديد: أقل من #% من تسديدات الخاسر (# على الأقل) كانت على المرمى. xG مقياس لجودة الفرص، مو حكم على اللاعبين.",
    "Other recent cases": "قضايا حديثة أخرى",
    "done": "تم",
    "No recent # match in the data where the team with clearly more xG (at least # more) lost. That is a finding too: recent results have followed the chances.": "ما فيه مباراة حديثة في البيانات خسر فيها الفريق اللي عنده xG أكثر بوضوح (# على الأقل). وهذا بحد ذاته نتيجة: النتائج الأخيرة مشت مع الفرص.",
    "Few minutes make a figure per # minutes noisy, and minutes off the bench can come against tired defences; the rate may not hold with more playing time.": "الدقائق القليلة تخلي الرقم لكل # دقيقة متذبذباً، ودقائق البديل ممكن تجي ضد دفاعات تعبانة؛ المعدل ممكن ما يستمر مع دقائق أكثر.",
    "Fewer than #: too few to compare you with the model.": "أقل من #: قليلة جداً للمقارنة بينك وبين النموذج.",
    "Investigate": "حلّلها"
})


INDEX = _x_lab_index(INDEX)
# ======================== نهاية إضافة Intelligence Lab ========================





















# ============================================================================
# إضافة: الواجهة العربية (عربي / EN) — الصقها قبل السطر:  if __name__ == "__main__":
# ما تغيّر أي سطر سابق ولا أي صفحة: بعد ما ترسم الصفحة نصوصها بالإنجليزي، يترجم المتصفح النصوص الظاهرة
# من القاموس التالي ويقلب اتجاه الصفحة لليمين. الأسماء والأرقام والبيانات تبقى كما هي.
# في المفاتيح: # = أي رقم (يرجع في الترجمة بنفس الترتيب)، و № = علامة # الحرفية في النص الأصلي.
# ============================================================================
_AR_DICT = {
    # ---- التنقل والعناوين ----
    "Overview": "نظرة عامة", "Players": "اللاعبون", "Teams": "الفرق", "Matches": "المباريات",
    "Comparison Lab": "مختبر المقارنة", "Compare": "مقارنة", "Tactical": "التكتيك", "Shots": "التسديدات",
    "Passing": "التمريرات", "Defensive": "الدفاع", "Look Like": "لاعبون متشابهون", "Heatmaps": "خرائط الحرارة",
    "Rankings": "الترتيب", "Fantasy": "الفانتازي", "Data Availability": "توفر البيانات", "Settings": "الإعدادات",
    "· current season": "· الموسم الحالي", "current season": "الموسم الحالي", "Loading…": "جارٍ التحميل…",
    "Loading league…": "جارٍ تحميل الدوري…", "Tactical Analysis": "التحليل التكتيكي",
    # ---- حالات ----
    "Available": "متوفر", "Complete": "مكتمل", "Not yet integrated": "غير مدمج بعد", "Partial": "جزئي",
    "Medium": "متوسطة", "Low": "منخفضة", "Higher": "أعلى", "No data": "بدون بيانات", "Injured": "مصاب",
    "Doubtful": "مشكوك فيه", "Doubtful (#%)": "مشكوك فيه (#%)", "Suspended": "موقوف", "Unavailable": "غير متاح",
    "Not in squad": "خارج القائمة", "ok": "تم", "pending": "قيد الانتظار", "failed": "فشل",
    "Status": "الحالة", "Analysed": "المُحلّلة", "Leagues": "الدوريات", "League": "الدوري", "Country": "الدولة",
    # ---- مراكز ----
    "GKP": "حارس", "DEF": "مدافع", "MID": "وسط", "FWD": "مهاجم", "GK": "حارس", "DF": "مدافع", "MF": "وسط", "FW": "مهاجم",
    "ST": "مهاجم", "CM": "وسط", "FB": "ظهير", "CB": "قلب دفاع",
    # ---- عام ----
    "Player": "اللاعب", "Club": "النادي", "Team": "الفريق", "team": "الفريق", "Pos": "المركز", "Date": "التاريخ",
    "Match": "المباراة", "Data": "البيانات", "Name": "الاسم", "Metric": "المقياس", "Metrics": "المقاييس", "Games": "المباريات",
    "Minutes": "الدقائق", "Minutes #": "الدقائق #", "Min": "دقائق", "# min": "# د", "Min minutes": "أقل عدد دقائق",
    "Goals": "الأهداف", "Goals #": "أهداف #", "goals #": "أهداف #", "Goal": "هدف", "Assists": "التمريرات الحاسمة", "Assists #": "تمريرات حاسمة #",
    "Assist": "تمريرة حاسمة", "Shots on target": "تسديدات على المرمى", "On target": "على المرمى", "Penalties": "ركلات الجزاء",
    "Penalty": "ركلة جزاء", "Saves": "التصديات", "Saves #": "تصديات #", "Clean sheet": "شباك نظيفة", "Clean sheets": "شباك نظيفة",
    "Clean sheet #": "شباك نظيفة #", "CS": "شباك نظيفة", "Bonus": "البونص", "Bonus #": "بونص #", "Bonus points": "نقاط البونص",
    "Points": "النقاط", "Pts": "نقاط", "Total points": "مجموع النقاط", "Total": "المجموع", "Avg": "المعدل",
    "Expected": "المتوقع", "expected": "متوقع", "Predicted": "المتوقع", "predicted": "متوقع", "Actual": "الفعلي",
    "Value": "القيمة", "Form": "الفورمة", "Price (£m)": "السعر (£m)", "Max price": "أعلى سعر", "Cost": "التكلفة",
    "Search player": "ابحث عن لاعب", "Search player or club": "ابحث عن لاعب أو نادي", "Search a player or club…": "ابحث عن لاعب أو نادي…",
    "Search metrics…": "ابحث في المقاييس…", "All teams": "كل الفرق", "All positions": "كل المراكز", "All players": "كل اللاعبين",
    "Save": "حفظ", "Load": "تحميل", "Delete": "حذف", "Clear": "مسح", "Reset": "إعادة ضبط", "Details": "التفاصيل",
    "Replace": "استبدال", "Remove": "إزالة", "None": "لا يوجد", "None.": "لا يوجد.", "Checks": "الفحوصات", "Method": "الطريقة",
    "Re-run": "إعادة التشغيل", "season": "الموسم", "won": "المكسوبة", "sum": "مجموع",
    "# of #": "# من #", "per #": "لكل #", "# per #": "# لكل #", "Per # minutes": "لكل # دقيقة", "per # minutes": "لكل # دقيقة",
    "Season totals": "مجاميع الموسم", "Data updated (UTC)": "آخر تحديث للبيانات (UTC)",
    "Data updated (UTC): ### #:#:#": "آخر تحديث للبيانات (UTC): ### #:#:#",
    # ---- نظرة عامة / لاعب / مباراة ----
    "Matches played": "المباريات الملعوبة", "Fully analysed": "مُحللة بالكامل", "Partial, empty or failed": "جزئية أو فارغة أو فاشلة",
    "Players with data": "لاعبون لهم بيانات", "Teams with data": "فرق لها بيانات", "Top xT": "الأعلى في xT", "Top xG": "الأعلى في xG",
    "Recent matches": "آخر المباريات", "position N/A": "المركز غير متوفر", "xT per match": "xT لكل مباراة",
    "xG per match": "xG لكل مباراة", "Match by match": "مباراة بمباراة", "Other sections": "أقسام أخرى",
    "Player metrics": "مقاييس اللاعب", "Other tabs": "تبويبات أخرى", "season: current, as last synchronized": "الموسم: الحالي، حسب آخر مزامنة",
    "# of # players match. Sorted by xt": "# من # لاعب مطابق. مرتب حسب xt",
    "# of # players match. Sorted by xt#. Per# uses only matches that have minutes": "# من # لاعب مطابق. مرتب حسب xt#. معدل كل # يستخدم المباريات اللي فيها دقائق فقط",
    "Sync": "المزامنة", "Heatmap": "خريطة الحرارة", "Passing network": "شبكة التمريرات", "Lineups": "التشكيلات",
    "xG faced": "xG المواجَه", "xG faced (GK)": "xG المواجَه (حارس)", "Match not found.": "المباراة غير موجودة.",
    "Player not found.": "اللاعب غير موجود.",
    "Team xT and xG are sums of player values from the provider": "xT وxG للفريق مجموع قيم اللاعبين من المزود",
    "Formations, starting positions, build-up and defensive activity": "الخطط ومراكز البداية والبناء والنشاط الدفاعي",
    "Needs lineup positions and event data. Not inspected yet. Nothing is drawn until real data is connected": "يحتاج مراكز التشكيلة وبيانات الأحداث. لم يُفحص بعد. لا يُرسم شيء حتى تتوفر بيانات حقيقية",
    "Lineups, shot map, heatmaps, passing network and events:": "التشكيلات وخريطة التسديدات وخرائط الحرارة وشبكة التمرير والأحداث:",
    "Shot map, heatmap, passing involvement, radar:": "خريطة التسديدات وخريطة الحرارة والمشاركة في التمرير والرادار:",
    "Stable player ID found on #% of player rows. Rows without an ID are matched by name": "وُجد معرّف ثابت للاعب في #% من الصفوف. الصفوف بدون معرّف تُطابق بالاسم",
    # ---- مختبر المقارنة ----
    "players selected": "لاعبين مختارين", "Starting sets (not position limits):": "مجموعات للبداية (وليست قيود مراكز):",
    "Restore default": "استعادة الافتراضي", "Clear all": "مسح الكل", "Selected metrics (#)": "المقاييس المختارة (#)",
    "Total xT": "مجموع xT", "Expected threat (xT) (#)": "التهديد المتوقع xT (#)", "Possession value (#)": "قيمة الاستحواذ (#)",
    "VAEP total": "مجموع VAEP", "Attacking (#)": "الهجوم (#)", "Goal conversion %": "نسبة تحويل الأهداف %",
    "Creation (#)": "الصناعة (#)", "Passing (#)": "التمرير (#)", "Carrying (#)": "حمل الكرة (#)", "Carries": "حمل الكرة",
    "Progressive carries": "حمل الكرة التقدمي", "Carries into box": "حمل الكرة إلى المنطقة", "Dribbling (#)": "المراوغة (#)",
    "Take-ons": "المراوغات", "Take-ons won": "المراوغات الناجحة", "Defensive (#)": "الدفاع (#)", "Duels (#)": "الالتحامات (#)",
    "Aerial duels": "الالتحامات الهوائية", "Aerial duels won": "الالتحامات الهوائية المكسوبة", "Positioning (#)": "التمركز (#)",
    "Goalkeeping (#)": "حراسة المرمى (#)", "Chart value: relative to the selection": "قيمة الرسم: نسبةً للاعبين المختارين",
    "Chart value: percentile in the competition": "قيمة الرسم: المئين في المسابقة",
    "Reference: outfield players (GK vs GK)": "المرجع: لاعبو الميدان (الحارس مع الحراس)", "Reference: same position": "المرجع: نفس المركز",
    "Reference: all players": "المرجع: كل اللاعبين", "Fill": "تعبئة", "Auto fill": "تعبئة تلقائية", "Detailed comparison": "مقارنة تفصيلية",
    "Minimum minutes for players in the reference population": "أقل عدد دقائق للاعبين في مجموعة المرجع",
    "Search and add players above. Nothing is drawn until you select at least one": "ابحث وأضف لاعبين بالأعلى. لا يُرسم شيء حتى تختار لاعباً واحداً على الأقل",
    "calculated: goals − xG (calculated)": "محسوب: الأهداف − xG", "calculated: goals ÷ shots (calculated)": "محسوب: الأهداف ÷ التسديدات",
    "calculated: take-ons won ÷ take-ons (calculated)": "محسوب: المراوغات الناجحة ÷ المراوغات",
    "calculated: sum of the four fields above (calculated)": "محسوب: مجموع الحقول الأربعة أعلاه",
    "calculated: aerials won ÷ aerials (calculated)": "محسوب: الهوائية المكسوبة ÷ الهوائية",
    "calculated: duels won − aerials won (assumes duels_won includes aerials": "محسوب: الالتحامات المكسوبة − الهوائية المكسوبة (بافتراض أن duels_won يشمل الهوائية",
    "not stated in the provider docs) (calculated)": "وهذا غير مذكور في توثيق المزود)",
    "heatmaps: player cells with x ≥ half ÷ all cells (calculated)": "خرائط الحرارة: خلايا اللاعب في نصف الخصم ÷ كل الخلايا (محسوب)",
    "players → xG faced (goalkeeper rows only) (direct)": "players → xG المواجَه (صفوف الحراس فقط) (مباشر)",
    "Defensive actions (tackles + interceptions + blocks + clearances)": "الأفعال الدفاعية (افتكاك + اعتراض + صد + إبعاد)",
    "Open Players and press + next to 2 or more players.": "افتح صفحة اللاعبين واضغط + بجانب لاعبين أو أكثر.",
    "Pick at least one stat group.": "اختر مجموعة إحصائيات واحدة على الأقل.",
    "This player has no data for the selected stats.": "هذا اللاعب ليس له بيانات في الإحصائيات المختارة.",
    "No metric matches. Only metrics with real PitchAPI data in this competition are listed.": "لا يوجد مقياس مطابق. تظهر فقط المقاييس اللي لها بيانات PitchAPI حقيقية في هذه المسابقة.",
    # ---- مقاييس ----
    "xG/shot": "xG لكل تسديدة", "xG per shot": "xG لكل تسديدة", "Conv. %": "نسبة التحويل %", "Conversion %": "نسبة التحويل %",
    "Goals − xG": "الأهداف − xG", "G − xG": "أ − xG", "Crosses": "العرضيات", "Tackles": "الافتكاك", "Blocks": "الصدّات",
    "Duels won": "الالتحامات المكسوبة", "Ground duels won": "الالتحامات الأرضية المكسوبة", "Key passes": "التمريرات المفتاحية",
    "Passes": "التمريرات", "Progressive passes": "التمريرات التقدمية", "Passes into box": "التمريرات داخل المنطقة",
    "Through balls": "التمريرات البينية", "Take-on success %": "نجاح المراوغة %", "Interceptions": "الاعتراضات",
    "Clearances": "الإبعادات", "Actions in opponent half %": "الأفعال في نصف الخصم %", "Aerial win %": "نسبة الفوز بالهوائية %",
    "Aerials won": "الهوائية المكسوبة", "Aerials": "الهوائية", "Aerial %": "الهوائية %", "Def. actions": "أفعال دفاعية",
    "Opp-half %": "نصف الخصم %", "Switches": "تحويل اللعب", "Shot-creating actions": "أفعال صنع التسديد",
    "Goal-creating actions": "أفعال صنع الهدف", "xG chain": "سلسلة xG", "xG buildup": "بناء xG", "Box %": "داخل المنطقة %",
    "Avg dist (m)": "متوسط المسافة (م)", "SoT %": "على المرمى %", "Interc": "اعتراض", "Ground won": "الأرضية المكسوبة",
    "Acc %": "الدقة %", "Progr": "تقدمية", "Into box": "إلى المنطقة", "Key": "مفتاحية", "Through": "بينية",
    # ---- التسديدات ----
    "Off target": "خارج المرمى", "Saved": "تصدّى لها الحارس", "Blocked": "مصدودة", "Post": "القائم", "Hit the post": "ارتطمت بالقائم",
    "y # m, height # m": "y # م، الارتفاع # م", "Flip left/right": "اقلب يسار/يمين", "Attack direction →": "اتجاه الهجوم →",
    "Fast break": "هجمة مرتدة", "Free kick": "ركلة حرة", "From corner": "من ركنية", "Individual play": "مجهود فردي",
    "Regular play": "لعب مفتوح", "Set piece": "كرة ثابتة", "Throw-in set piece": "من رمية تماس", "Header": "رأسية",
    "Left foot": "القدم اليسرى", "Right foot": "القدم اليمنى", "Other body part": "جزء آخر من الجسم",
    "Inside the box": "داخل المنطقة", "Outside the box": "خارج المنطقة", "All matches (season)": "كل المباريات (الموسم)",
    "All outcomes": "كل النتائج", "All situations": "كل الحالات", "All body parts": "كل أجزاء الجسم", "Any zone": "أي منطقة",
    "Table sort: goals": "ترتيب الجدول: الأهداف", "Matches that do not reconcile": "مباريات لا تتطابق أهدافها",
    "Conversion (goals ÷ all shots)": "التحويل (الأهداف ÷ كل التسديدات)", "On target (provider flag)": "على المرمى (حسب المزود)",
    "Goals ÷ on target": "الأهداف ÷ على المرمى", "npxG (no penalties)": "npxG (بدون ركلات الجزاء)",
    "Avg distance to goal (derived)": "متوسط المسافة للمرمى (مشتق)", "height above # m is drawn at # m)": "الارتفاع فوق # م يُرسم عند # م)",
    "Tap a shot for its details": "اضغط على تسديدة لتفاصيلها", "By situation": "حسب الحالة", "situation": "الحالة",
    "By body part": "حسب جزء الجسم", "body part": "جزء الجسم", "By outcome": "حسب النتيجة", "outcome": "النتيجة",
    "By minute": "حسب الدقيقة", "minute": "الدقيقة", "Goal check": "مطابقة الأهداف", "From minute": "من الدقيقة",
    "To minute": "إلى الدقيقة", "Min shots": "أقل عدد تسديدات", "No shots match this selection.": "لا توجد تسديدات تطابق هذا الاختيار.",
    "# shots in # of # matches. Every figure comes from PitchAPI's shot data": "# تسديدة في # من # مباراة. كل رقم من بيانات تسديدات PitchAPI",
    "own goals are left out of shooting figures": "الأهداف العكسية مستبعدة من أرقام التسديد",
    "Goals from shots + own goals (own goals are credited to no player)": "أهداف من تسديدات + أهداف عكسية (العكسية لا تُحسب لأي لاعب)",
    "Shot-data goals / official score goals, same # matches": "أهداف بيانات التسديد / أهداف النتيجة الرسمية، لنفس الـ# مباراة",
    "Marker size = xG. Showing the # highest-xG shots of #": "حجم العلامة = xG. يُعرض أعلى # تسديدة xG من أصل #",
    "narrow the filters to see all. Tap a shot for details. Every team attacks to the right": "ضيّق الفلاتر لرؤية الكل. اضغط على تسديدة للتفاصيل. كل فريق يهاجم لليمين",
    "Goal view (where shots crossed the goal line)": "منظر المرمى (أين عبرت التسديدات خط المرمى)",
    "# of # shown shots have goal-line coordinates (posts at the white frame": "# من # تسديدة معروضة لها إحداثيات خط المرمى (القائمان عند الإطار الأبيض",
    "This table lists # of # players (top # with at least # shots) and accounts for # of the # goals from shots in the current selection. The other goals belong to players outside this list, so adding up a table will not reach the total": "الجدول يعرض # من # لاعب (أفضل # بحد أدنى # تسديدات) ويشمل # من # هدف من تسديدات في الاختيار الحالي. باقي الأهداف للاعبين خارج القائمة، فمجموع الجدول لن يصل للإجمالي",
    "This table lists # of # teams (top # with at least # shots) and accounts for # of the # goals from shots in the current selection": "الجدول يعرض # من # فريق (أفضل # بحد أدنى # تسديدات) ويشمل # من # هدف من تسديدات في الاختيار الحالي",
    "Every match with shot data reconciles with its official score (goals in shots + own goals = score)": "كل مباراة لها بيانات تسديد تتطابق مع نتيجتها الرسمية (أهداف التسديدات + العكسية = النتيجة)",
    "untick \"Flip left/right\" if a shooter looks mirrored": "ألغِ \"اقلب يسار/يمين\" إذا ظهر مسدد معكوساً",
    # ---- التمريرات ----
    "All players (sort by passes)": "كل اللاعبين (ترتيب بالتمريرات)", "Observation window:": "نافذة الرصد:",
    "What PitchAPI provides:": "ما يوفره PitchAPI:", "Not provided:": "غير متوفر:", "Min passes": "أقل عدد تمريرات",
    "Tap a player or a link for details": "اضغط على لاعب أو رابط للتفاصيل", "No pass network for this selection.": "لا توجد شبكة تمرير لهذا الاختيار.",
    "Pass categories (counts per player, this match)": "أنواع التمرير (عدد لكل لاعب، هذه المباراة)",
    "Showing # of # links (at least # passes). Tap a player or a link": "يُعرض # من # رابط (بحد أدنى # تمريرات). اضغط على لاعب أو رابط",
    "the arrow points from passer to receiver. Receivers are inferred, so a pass with no resolved receiver is in the node total but has no link": "السهم من الممرر إلى المستلم. المستلم مستنتج، فالتمريرة بدون مستلم معروف تُحسب للاعب لكن بدون رابط",
    "a pass network per team (player positions = average origin of completed passes, links = number of passes between two players) and per-player pass counts by category": "شبكة تمرير لكل فريق (موقع اللاعب = متوسط مكان تمريراته الناجحة، الرابط = عدد التمريرات بين لاعبين) وعدد التمريرات لكل لاعب حسب النوع",
    "individual passes with start/end coordinates, pass success per pass, and xT per pass, so a pass-by-pass map cannot be drawn and no pass xT is shown": "إحداثيات بداية ونهاية كل تمريرة ونجاحها وxT لكل تمريرة، فلا يمكن رسم خريطة تمريرة بتمريرة ولا يظهر xT للتمرير",
    "starting eleven until the team's first substitution (about minute #). Passes after that are not included, so this is not the whole match": "التشكيلة الأساسية حتى أول تبديل للفريق (حوالي الدقيقة #). التمريرات بعدها غير مشمولة، فهذا ليس كامل المباراة",
    # ---- PPDA والدفاع ----
    "Definition (PitchAPI):": "التعريف (PitchAPI):", "nothing is estimated here": "لا شيء مقدّر هنا",
    "PPDA (Σ passes ÷ Σ actions)": "PPDA (Σ التمريرات ÷ Σ الأفعال)", "Avg of match PPDA": "معدل PPDA للمباريات", "By match": "حسب المباراة",
    "Opp. passes": "تمريرات الخصم", "Check op÷da": "تحقق", "What this shows:": "ماذا يعرض:",
    "only (table below), not per player": "فقط (الجدول أدناه)، وليس لكل لاعب", "Sort: defensive actions": "الترتيب: الأفعال الدفاعية",
    "# players (top #)": "# لاعب (أفضل #)", "Team pressing": "ضغط الفريق", "High turnovers": "الافتكاك العالي",
    "Counterpress regains": "الاستعادة بالضغط العكسي", "Recovery time (s)": "وقت الاستعادة (ث)",
    "Avg def. action x (m)": "متوسط موقع الفعل الدفاعي x (م)", "Field tilt %": "ميلان الملعب %",
    "PPDA = opponent passes attempted ÷ defensive actions by the pressing team (fouls, tackles, interceptions, challenges, blocked passes), both counted only in the pressing zone, i.e. outside the pressing team's own defensive third. Clearances and shot blocks are excluded. Lower means more intense pressing. Values come from PitchAPI": "PPDA = تمريرات الخصم ÷ الأفعال الدفاعية للفريق الضاغط (أخطاء، افتكاك، اعتراض، التحامات، تمريرات مصدودة)، وكلاهما يُحسب فقط في منطقة الضغط خارج الثلث الدفاعي للفريق الضاغط. الإبعادات وصد التسديدات مستبعدة. الأقل = ضغط أشد. القيم من PitchAPI",
    "Season PPDA = total opponent passes ÷ total defensive actions over the matches with data (not an average of ratios)": "PPDA الموسم = مجموع تمريرات الخصم ÷ مجموع الأفعال الدفاعية في المباريات اللي لها بيانات (وليس معدل النسب)",
    "every defensive count PitchAPI reports per player. It reports duels": "كل الأرقام الدفاعية اللي يرسلها PitchAPI لكل لاعب. يرسل الالتحامات",
    "only (not duels lost), so total duels and duel win % are not available": "المكسوبة فقط (وليس الخاسرة)، فإجمالي الالتحامات ونسبة الفوز غير متوفرة",
    "\"Opp-half %\" is where the player's on-ball actions happen (from heatmaps), a position indicator, not a pressing stat": "\"نصف الخصم %\" مكان أفعال اللاعب بالكرة (من خرائط الحرارة)، مؤشر تمركز وليس إحصائية ضغط",
    "High turnovers = regains in the attacking third that lead to a shot or the box": "الافتكاك العالي = استعادة في الثلث الهجومي تؤدي لتسديدة أو دخول المنطقة",
    "counterpress = regains within # s of losing the ball (per match averages). PPDA: lower = more pressing": "الضغط العكسي = استعادة خلال # ث من فقدان الكرة (معدل لكل مباراة). PPDA: الأقل = ضغط أكثر",
    # ---- لاعبون متشابهون ----
    "How it works:": "كيف يعمل:", "style and output": "الأسلوب والإنتاج", "Same position only": "نفس المركز فقط",
    "Any outfield position": "أي مركز في الميدان", "Attacking": "الهجوم", "Creation": "الصناعة", "Passing & carrying": "التمرير وحمل الكرة",
    "Position (heatmap)": "التمركز (خريطة الحرارة)", "Team pressing context": "سياق ضغط الفريق", "Pick individual stats": "اختر إحصائيات بعينها",
    "Team PPDA": "PPDA الفريق", "Team high turnovers /match": "افتكاك عالٍ للفريق /مباراة",
    "Team counterpress regains /match": "استعادة بالضغط العكسي للفريق /مباراة", "compared with # players on # stats": "مقارنة مع # لاعب في # إحصائية",
    "Match %": "نسبة التشابه %", "Closest on": "الأقرب في", "Biggest gaps": "أكبر الفروقات", "the match % uses per# rates": "نسبة التشابه تستخدم معدلات لكل #",
    "Gap (SD)": "الفرق (انحراف معياري)", "not quality: a similar profile in a weaker league can look identical on paper. Values come from PitchAPI": "وليس الجودة: لاعب بنفس الأسلوب في دوري أضعف قد يبدو مطابقاً على الورق. القيم من PitchAPI",
    "Tap a name to see the full stat-by-stat comparison. xG and goals are season totals": "اضغط على اسم لمقارنة كل إحصائية. xG والأهداف مجاميع الموسم",
    "Gap in standard deviations of the comparison pool: # = identical, ±# = one SD apart": "الفرق بالانحراف المعياري لمجموعة المقارنة: # = متطابق، ±# = انحراف معياري واحد",
    "xG and goals are summed from its shot data": "xG والأهداف مجموعة من بيانات التسديد",
    # ---- خرائط الحرارة ----
    "Match-level heatmaps": "خرائط حرارة لكل مباراة", "Team or player (each attacks →)": "فريق أو لاعب (كلٌّ يهاجم →)",
    "Both teams on one pitch": "الفريقان في ملعب واحد", "Whole team": "الفريق كاملاً", "# actions": "# فعل", "# action": "# فعل",
    "# actions in one cell": "# فعل في خلية واحدة", "cell #: # actions": "الخلية #: # فعل", "No heatmap data for this selection.": "لا توجد بيانات خريطة حرارة لهذا الاختيار.",
    "PitchAPI provides no season heatmap. # of # matches have data": "PitchAPI لا يوفر خريطة حرارة للموسم. # من # مباراة لها بيانات",
    "Counts of on-the-ball actions binned by PitchAPI on a #×# grid (not raw coordinates)": "عدد الأفعال بالكرة مجمّعة من PitchAPI على شبكة #×# (وليست إحداثيات خام)",
    "The provider returned an empty grid for this match.": "المزود أرسل شبكة فارغة لهذه المباراة.",
    "The provider returned an empty grid for this selection.": "المزود أرسل شبكة فارغة لهذا الاختيار.",
    # ---- الفانتازي: التبويبات والترويسة ----
    "Optimal XI": "التشكيلة المثالية", "My XI": "تشكيلتي", "My XI vs Optimal": "تشكيلتي مقابل المثالية", "Forecast": "التوقعات",
    "Table": "الجدول", "Predicted Points": "النقاط المتوقعة", "Best Team": "أفضل فريق", "Scatter": "مخطط التوزيع",
    "Fixtures": "جدول المباريات", "Backtest": "الاختبار التاريخي",
    "Official Fantasy Premier League data, as of ### #:#:# UTC": "بيانات فانتازي الدوري الإنجليزي الرسمية، حتى ### #:#:# UTC",
    "Gameweek #. Prices in £m. A dash or N/A means the source gave no value (never zero). PitchAPI link: # of # players with minutes matched by team and name": "الجولة #. الأسعار بالمليون جنيه. الشرطة أو N/A تعني أن المصدر ما أعطى قيمة (وليست صفراً). ربط PitchAPI: # من # لاعب لهم دقائق تمت مطابقتهم بالفريق والاسم",
    "the rest have no PitchAPI value": "والباقي بدون قيم PitchAPI",
    "GW#": "ج#", "GW #": "الجولة #", "GW": "الجولة", "GW#–#": "ج#–#", "GW#–GW#": "ج#–ج#", "GW #: #": "الجولة #: #",
    "GW# (next)": "ج# (القادمة)", "Lineup for GW#": "التشكيلة في الجولة #", "Evaluate from GW#": "التقييم من الجولة #",
    "gameweeks": "جولات", "# gameweeks": "# جولات", "# GW": "# جولات", "Next gameweek": "الجولة القادمة", "Next Gameweek": "الجولة القادمة",
    "Next # gameweeks": "الجولات الـ# القادمة", "next # gameweeks": "الجولات الـ# القادمة",
    "deadline": "الموعد النهائي", "data ### #:#:# UTC": "البيانات ### #:#:# UTC", "model v#": "النموذج v#",
    "Model": "النموذج", "Model v#": "النموذج v#", "Model (v#)": "النموذج (v#)", "Model v# (default)": "النموذج v# (الافتراضي)",
    "Model v#: penalty-regressed": "النموذج v#: ضبط ركلات الجزاء", "Prediction model": "نموذج التوقع",
    "all points are projections (expected values), not guarantees": "كل النقاط توقعات (قيم متوقعة) وليست ضمانات",
    "Fits a £#m squad of #": "ضمن ميزانية £#m لقائمة من #", "Any price (best possible XI)": "بأي سعر (أفضل تشكيلة ممكنة)",
    "Fixture": "المباراة", "Opponent": "الخصم", "FDR #": "صعوبة #", "blank": "بدون مباراة", "No fixture (blank)": "لا توجد مباراة (جولة فارغة)",
    # ---- التشكيلة المثالية ----
    "Optimal Starting XI": "التشكيلة الأساسية المثالية", "Formation": "الخطة", "Formation ###": "الخطة ###",
    "Expected points, XI incl. captain, GW#": "النقاط المتوقعة للأساسيين مع الكابتن، ج#",
    "#% range (#th–#th percentile, simulated)": "نطاق #% (المئين #–#، بالمحاكاة)", "#% range (simulated)": "نطاق #% (بالمحاكاة)",
    "XI cost": "تكلفة التشكيلة", "squad £#m": "القائمة £#m", "Captain": "الكابتن", "Key selection decisions": "أهم قرارات الاختيار",
    ": its best legal XI has the highest expected total": ": أفضل تشكيلة نظامية فيها لها أعلى مجموع متوقع",
    "the next best formation, ###, is # points lower": "الخطة التالية، ###، أقل بـ# نقطة",
    "has the highest expected points of the XI (#, doubled)": "صاحب أعلى نقاط متوقعة في التشكيلة (#، مضاعفة)",
    "P(plays) #%. Vice-captain": "احتمال مشاركته #%. نائب الكابتن",
    "takes the armband only if the captain does not play (expected extra #, not included in the total)": "يأخذ الشارة فقط إذا ما لعب الكابتن (زيادة متوقعة #، غير محسوبة في المجموع)",
    "Highest-projected players left out, and why: see the table below": "أعلى اللاعبين توقعاً اللي ما اختيروا، والسبب: في الجدول أدناه",
    "Budget check: this XI is the starting XI of the best #-player squad within £#m (squad cost £#m). The # bench players are chosen by the squad optimizer only to make the squad legal and affordable": "فحص الميزانية: هذه التشكيلة هي أساسيو أفضل قائمة من # لاعب ضمن £#m (تكلفة القائمة £#m). الاحتياط الـ# اختارهم المحسّن فقط لتصير القائمة نظامية وضمن الميزانية",
    "Full squad and bench order": "القائمة الكاملة وترتيب الاحتياط", "Best Team tab": "تبويب أفضل فريق",
    "# unique players": "# لاعب بدون تكرار", "legal formation ###": "خطة نظامية ###", "at most # per club (limit #)": "بحد أقصى # من كل نادٍ (الحد #)",
    "captain and vice are starters": "الكابتن والنائب من الأساسيين", "Why each player (GW#": "لماذا كل لاعب (ج#",
    "components add up to the player total)": "مجموع المكونات = نقاط اللاعب)", "P(play)": "احتمال المشاركة",
    "Started (last #)": "أساسي (آخر #)", "Data": "البيانات", "Set pieces": "الكرات الثابتة", "Goals conc": "أهداف مستقبلة",
    "Goals conc. #": "أهداف مستقبلة #", "Def. contr": "مساهمة دفاعية", "Def. contr. #": "مساهمة دفاعية #", "Cards/other": "بطاقات/أخرى",
    "Cards/other #": "بطاقات/أخرى #", "Main reasons": "أهم الأسباب", "Exp. min": "الدقائق المتوقعة",
    "Sum of the # player totals # + captain # = # (shown rounded as #). Component values are FPL scoring inputs (expected points per category)": "مجموع نقاط الـ# لاعب # + الكابتن # = # (معروض مقرّباً #). قيم المكونات من قواعد نقاط FPL (النقاط المتوقعة لكل فئة)",
    "xG, xA, team xG and opponent strength are only the predictive signals behind them and earn no points by themselves. Tap a name for the full prediction details": "xG وxA وxG الفريق وقوة الخصم مجرد مؤشرات للتوقع ولا تعطي نقاطاً بنفسها. اضغط على اسم لتفاصيل التوقع الكاملة",
    "Notable players left out": "لاعبون بارزون لم يُختاروا", "Why not selected": "سبب عدم الاختيار",
    "budget: the squad cannot afford him together with the rest": "الميزانية: القائمة ما تقدر عليه مع باقي اللاعبين", "tie-break": "تساوٍ في النقاط",
    "Formation comparison (exact optimum for each)": "مقارنة الخطط (الأفضل بدقة لكل خطة)", "Expected XI + captain": "المتوقع للأساسيين + الكابتن",
    "Squad cost": "تكلفة القائمة", "chosen": "المختارة", "double gameweek (# fixtures)": "جولة مزدوجة (# مباريات)",
    "clean-sheet chance #%": "فرصة الشباك النظيفة #%", "xG/# # vs # for the position": "xG/# # مقابل # لمعدل المركز",
    "took # penalty (# scored)": "نفّذ # ركلة جزاء (سجّل #)", "took # penalties (# scored)": "نفّذ # ركلات جزاء (سجّل #)",
    "# direct free-kick shots": "# تسديدات من ركلات حرة مباشرة", "# direct free-kick shot": "# تسديدة من ركلة حرة مباشرة",
    "Penalties №# (FPL)": "منفّذ ركلات الجزاء رقم # (FPL)", "Direct FKs №# (FPL)": "منفّذ الركلات الحرة المباشرة رقم # (FPL)",
    "Corners/indirect FKs №# (FPL)": "منفّذ الركنيات والحرة غير المباشرة رقم # (FPL)",
    "Prediction log (kept on this device)": "سجل التوقعات (محفوظ على هذا الجهاز)", "— # recorded recommendation": "— # توصية مسجلة",
    "— # recorded recommendations": "— # توصيات مسجلة", "Recorded": "وقت التسجيل", "Data version": "نسخة البيانات", "Constraint": "القيد",
    "budget": "ضمن الميزانية", "any price": "بأي سعر", "not played yet": "لم تُلعب بعد",
    "Each time an optimal XI for the next gameweek is computed with new data, it is recorded here with its time, data version and model version. After the gameweek finishes, \"actual\" adds the real points of those # players plus the captain's (no automatic substitutions). The leak-free Backtest tab is the systematic test": "كل مرة تُحسب فيها التشكيلة المثالية للجولة القادمة ببيانات جديدة، تُسجل هنا مع وقتها ونسخة البيانات والنموذج. بعد نهاية الجولة يجمع \"الفعلي\" النقاط الحقيقية لهؤلاء الـ# لاعب مع الكابتن (بدون تبديلات تلقائية). الاختبار المنهجي في تبويب الاختبار التاريخي",
    "How the optimal XI and its range are calculated": "كيف تُحسب التشكيلة المثالية ونطاقها",
    "Player values are the availability-adjusted expected points of the Predicted Points model for GW# (a double gameweek adds both fixtures": "قيمة كل لاعب هي نقاطه المتوقعة بعد احتساب جاهزيته من نموذج النقاط المتوقعة للجولة # (الجولة المزدوجة تجمع المباراتين",
    "a blank gameweek is #). The XI comes from the exact squad optimizer of the Best Team tab (dynamic programming over the budget with branch and bound for the club limit, # of # players after a lossless dominance prune): it maximises the XI's expected points plus the captain's, subject to a legal #-player squad within the budget. Players marked unavailable or not in a squad are excluded": "والجولة الفارغة = #). التشكيلة من محسّن القائمة الدقيق في تبويب أفضل فريق (برمجة ديناميكية على الميزانية مع تفرّع وتقييد لحد النادي، # من # لاعب بعد تصفية بدون خسارة): يعظّم النقاط المتوقعة للأساسيين مع الكابتن، بشرط قائمة نظامية من # لاعب ضمن الميزانية. اللاعبون غير المتاحين أو خارج القوائم مستبعدون",
    "The #% range comes from # simulations of the same model (fixed seed, so it does not change between visits): minutes, goals, assists, saves, defensive actions, bonus and cards are drawn per player": "نطاق #% يأتي من # محاكاة لنفس النموذج (بذرة ثابتة فلا يتغير بين الزيارات): الدقائق والأهداف والتمريرات الحاسمة والتصديات والأفعال الدفاعية والبونص والبطاقات تُسحب لكل لاعب",
    "goals against are drawn once per team and fixture, so team-mates' clean sheets move together. Each team's goals are drawn once per match and shared out to its scorers and assisters, so team-mates' attacking returns move together and against the opposing defence. In the leak-free replay these lineup ranges came out too narrow, so they are widened by a factor of # around the expected total (default fitted on the ## and ## seasons, validated on ## and tested on ##)": "الأهداف المستقبلة تُسحب مرة لكل فريق ومباراة، فالشباك النظيفة لزملاء الفريق تتحرك معاً. وأهداف كل فريق تُسحب مرة لكل مباراة وتُوزّع على المسجلين وصنّاع الأهداف، فالمساهمات الهجومية للزملاء تتحرك معاً وعكس دفاع الخصم. في الإعادة التاريخية طلعت النطاقات أضيق من الواقع، فتُوسّع بمعامل # حول المجموع المتوقع (القيمة الافتراضية مضبوطة على موسمي ## و##، ومتحقق منها على ## ومختبرة على ##)",
    "goals against are drawn once per team and fixture, so team-mates' clean sheets move together. Each team's goals are drawn once per match and shared out to its scorers and assisters, so team-mates' attacking returns move together and against the opposing defence. In the leak-free replay these lineup ranges came out too narrow, so they are widened by a factor of # around the expected total (refitted on this device in the Backtest tab)": "الأهداف المستقبلة تُسحب مرة لكل فريق ومباراة، فالشباك النظيفة لزملاء الفريق تتحرك معاً. وأهداف كل فريق تُسحب مرة لكل مباراة وتُوزّع على المسجلين وصنّاع الأهداف، فالمساهمات الهجومية للزملاء تتحرك معاً وعكس دفاع الخصم. في الإعادة التاريخية طلعت النطاقات أضيق من الواقع، فتُوسّع بمعامل # حول المجموع المتوقع (أعيد ضبطها على هذا الجهاز في تبويب الاختبار التاريخي)",
    "the Backtest tab shows the current check. Projections of the very top players have been optimistic (a selection effect: the highest projections include the largest over-estimates), so read the XI total as an upper-leaning estimate": "وتبويب الاختبار التاريخي يعرض الفحص الحالي. توقعات أعلى اللاعبين كانت متفائلة (أثر الاختيار: أعلى التوقعات فيها أكبر المبالغات)، فاعتبر مجموع التشكيلة تقديراً مائلاً للأعلى",
    "FPL taker order (when the data has it) and PitchAPI shot evidence (penalties taken and scored, direct free-kick shots) are shown for information. PitchAPI shots do not record who took a corner or a free-kick cross, so corner duty is only known from FPL's own taker order. Model v# already counts penalty xG inside FPL xG": "ترتيب المنفذين من FPL (إذا توفر) وأدلة تسديدات PitchAPI (ركلات الجزاء المنفذة والمسجلة، والتسديدات من ركلات حرة مباشرة) معروضة للمعلومية. تسديدات PitchAPI لا تسجل من نفّذ الركنية أو العرضية من ركلة حرة، فمنفذ الركنيات يُعرف فقط من ترتيب FPL. النموذج v# يحسب xG ركلات الجزاء ضمن xG من FPL",
    "model v# regresses each taker's realised penalty xG toward the league penalty rate (see Backtest). PitchAPI evidence: # penalties in # Premier League matches, # linked to an FPL player by club and name": "والنموذج v# يقرّب xG ركلات الجزاء لكل منفذ من معدل الدوري (انظر الاختبار التاريخي). أدلة PitchAPI: # ركلة جزاء في # مباراة من الدوري الإنجليزي، # منها مربوطة بلاعب FPL بالنادي والاسم",
    # ---- تشكيلتي ----
    "starting-XI builder": "بنّاء التشكيلة الأساسية", "points are projections": "النقاط توقعات",
    "a starting XI of # (not a full squad of #)": "تشكيلة أساسية من # (وليست قائمة كاملة من #)",
    "Start from the optimal XI": "ابدأ من التشكيلة المثالية", "Saved lineups (#)": "التشكيلات المحفوظة (#)", "Lineup name": "اسم التشكيلة",
    "Players selected (###)": "اللاعبون المختارون (###)", "Expected points GW# incl. captain": "النقاط المتوقعة ج# مع الكابتن",
    "Expected points GW# (no captain yet)": "النقاط المتوقعة ج# (بدون كابتن بعد)", "partial XI": "تشكيلة ناقصة",
    "cheapest legal squad £#m": "أرخص قائمة نظامية £#m", "expected # in GW#": "متوقع # في ج#", "Make captain": "اجعله كابتن",
    "Make vice-captain": "اجعله نائب الكابتن", "# of # starters": "# من # أساسيين", "no duplicates": "بدون تكرار",
    "every player exists in the FPL data": "كل لاعب موجود في بيانات FPL", "at most # players per club": "بحد أقصى # لاعبين من كل نادٍ",
    "captain chosen": "تم اختيار الكابتن", "vice-captain chosen": "تم اختيار نائب الكابتن", "fits the budget": "ضمن الميزانية",
    "XI £#m + cheapest legal bench £#m = £#m ≤ £#m": "الأساسيون £#m + أرخص احتياط نظامي £#m = £#m ≤ £#m",
    "Add players": "أضف لاعبين", "Tap a player for captain, vice-captain, replace or remove": "اضغط على لاعب لاختياره كابتن أو نائباً أو لاستبداله أو إزالته",
    "tap an empty place to add a player of that position": "اضغط على مكان فارغ لإضافة لاعب في هذا المركز",
    "Sorted by expected points in GW#. Players without a projection (no minutes this season) are not listed": "مرتبون حسب النقاط المتوقعة في ج#. اللاعبون بدون توقع (بدون دقائق هذا الموسم) غير معروضين",
    "Loaded the model's optimal XI for GW#. Change any player to test your own ideas": "تم تحميل التشكيلة المثالية للجولة #. غيّر أي لاعب لتجرب أفكارك",
    "Computing the optimal XI…": "جارٍ حساب التشكيلة المثالية…", "Cleared": "تم المسح", "The captain cannot also be vice-captain": "الكابتن ما يقدر يكون نائب الكابتن أيضاً",
    "That lineup is from another season": "هذه التشكيلة من موسم آخر", "Could not save (browser storage blocked)": "تعذر الحفظ (تخزين المتصفح محظور)",
    "projection reduced for availability": "التوقع مخفّض بسبب الجاهزية",
    "no legal bench completes this XI into a squad (club limit)": "لا يوجد احتياط نظامي يكمّل هذه التشكيلة لقائمة (حد النادي)",
    "Fine for a what-if": "مناسب للتجربة", "compare it with the any-price optimum": "قارنها بالمثالية بأي سعر",
    # ---- المقارنة ----
    "My XI vs Optimal XI": "تشكيلتي مقابل التشكيلة المثالية", "projections, not guarantees": "توقعات وليست ضمانات",
    "both lineups use the same gameweek, predictions and scoring rules": "التشكيلتان بنفس الجولة والتوقعات وقواعد النقاط",
    "My XI (current builder)": "تشكيلتي (الحالية)", "Optimal XI (within budget)": "التشكيلة المثالية (ضمن الميزانية)",
    "Optimal XI (any price)": "التشكيلة المثالية (بأي سعر)", "Projected difference (optimal − yours)": "الفرق المتوقع (المثالية − تشكيلتك)",
    "Chance your XI outscores it (simulated)": "فرصة تفوق تشكيلتك عليها (بالمحاكاة)",
    "Chance your XI outscores it (#% tie) (simulated)": "فرصة تفوق تشكيلتك عليها (#% تعادل) (بالمحاكاة)",
    "The difference is the difference of the two totals shown (# − #). #% of simulated outcomes of the difference lie between # and #: the optimal XI has the higher": "الفرق هو الفرق بين المجموعين المعروضين (# − #). #% من نتائج المحاكاة للفرق بين # و#: التشكيلة المثالية لها المجموع",
    "score, but it can lose in a single gameweek. Players common to both lineups are simulated once and cancel out": "الأعلى، لكنها قد تخسر في جولة واحدة. اللاعبون المشتركون يُحاكون مرة واحدة ويلغون بعض",
    "Where the +# comes from": "من أين يأتي فرق +#", "Where the # comes from": "من أين يأتي فرق #",
    "Yours": "تشكيلتك", "Exp": "المتوقع", "Gain": "المكسب", "Main differences (model − yours)": "أهم الفروقات (النموذج − تشكيلتك)",
    "about equal": "متقاربان", "Both lineups have the same # players": "التشكيلتان فيهما نفس الـ# لاعب", "In both lineups (#)": "في التشكيلتين (#)",
    "Only in My XI (#)": "في تشكيلتي فقط (#)", "Only in the optimal XI (#)": "في المثالية فقط (#)", "No player in common": "لا يوجد لاعب مشترك",
    "Tap any name to see why the model rates him as it does": "اضغط على أي اسم لترى لماذا يقيّمه النموذج هكذا",
    # ---- التوقعات ----
    "projections": "توقعات", "uncertainty grows with distance": "عدم اليقين يزيد كلما ابتعدت الجولة",
    "My XI: expected over # GW (#% range #–#)": "تشكيلتي: المتوقع خلال # جولات (نطاق #%: #–#)",
    "Optimal XI re-picked each GW (#% range #–#)": "التشكيلة المثالية يُعاد اختيارها كل جولة (نطاق #%: #–#)",
    "Projected difference over the period": "الفرق المتوقع خلال الفترة", "GW# optimal XI if never changed": "مثالية ج# بدون أي تغيير",
    "My XI (fixed)": "تشكيلتي (ثابتة)", "Optimal XI, re-picked each GW": "التشكيلة المثالية، يُعاد اختيارها كل جولة",
    "GW# optimal XI kept fixed": "مثالية ج# بدون تغيير", "shaded = #% range": "المظلل = نطاق #%", "Re-picked": "يُعاد اختيارها",
    "Fixed opt": "المثالية الثابتة", "Expected points per gameweek (y) by gameweek (x). Hover or tap for values": "النقاط المتوقعة لكل جولة (المحور الرأسي) حسب الجولة (الأفقي). مرّر أو اضغط لترى القيم",
    "the tables below hold every number": "والجداول أدناه فيها كل الأرقام", "Per gameweek (expected, #% range)": "لكل جولة (المتوقع، نطاق #%)",
    "Period total": "مجموع الفترة", "Expected points per gameweek": "النقاط المتوقعة لكل جولة",
    "Chance that My XI outscores the re-picked optimal XI over the period: #% (simulated). Your lineup and captain are held fixed for every gameweek (no transfers or captain changes)": "فرصة تفوق تشكيلتي على المثالية المُعاد اختيارها خلال الفترة: #% (بالمحاكاة). تشكيلتك وكابتنك ثابتان في كل الجولات (بدون انتقالات أو تغيير كابتن)",
    "the re-picked optimum is a ceiling that assumes unlimited free changes, and the fixed GW# optimum is the like-for-like reference for an unchanged lineup. Period ranges are percentiles of the simulated": "المثالية المُعاد اختيارها سقف يفترض تغييرات مجانية بلا حد، ومثالية ج# الثابتة هي المقارنة العادلة لتشكيلة بدون تغيير. نطاقات الفترة مئينات",
    "over all # gameweeks, not # single-week ranges added up. Later gameweeks are less certain: injury news and FPL's chance of playing only exist for the next gameweek (carried forward unchanged), and fixtures can still move": "المجموع المُحاكى لكل الـ# جولات، وليست # نطاقات أسبوعية مجموعة. الجولات البعيدة أقل يقيناً: أخبار الإصابات واحتمال المشاركة من FPL متوفرة للجولة القادمة فقط (تُنقل كما هي)، والمباريات قد تتأجل",
    "Blank/double gameweeks for these players": "جولات فارغة/مزدوجة لهؤلاء اللاعبين",
    # ---- الجدول والتوقعات ----
    "Any status": "أي حالة", "Doubtful or out": "مشكوك فيه أو غائب", "Points per game": "النقاط لكل مباراة",
    "Points per £m": "النقاط لكل £m", "Ownership %": "نسبة الامتلاك %", "Points per #": "النقاط لكل #",
    "xG (FPL)": "xG (FPL)", "xGI per # (FPL)": "xGI لكل # (FPL)", "xGI per £m": "xGI لكل £m", "ICT index": "مؤشر ICT",
    "Influence": "التأثير", "Creativity": "الإبداع", "Threat": "الخطورة", "Price change since start (£m)": "تغير السعر منذ البداية (£m)",
    "Transfers in (this GW)": "الانتقالات للداخل (هذه الجولة)", "Transfers out (this GW)": "الانتقالات للخارج (هذه الجولة)",
    "xT per # (PitchAPI)": "xT لكل # (PitchAPI)", "xG per # (PitchAPI)": "xG لكل # (PitchAPI)", "xT per #*": "xT لكل #*",
    "xG per #*": "xG لكل #*", "* PitchAPI values per # minutes": "* قيم PitchAPI لكل # دقيقة", "# of # players (first #). Tap a column to sort": "# من # لاعب (أول #). اضغط على عمود للترتيب",
    "Any availability": "أي جاهزية", "Available only": "المتاحون فقط", "Doubtful, injured or suspended": "مشكوك فيه أو مصاب أو موقوف",
    "Any data quality": "أي جودة بيانات", "Higher only": "الأعلى فقط", "Medium or higher": "متوسطة أو أعلى",
    "include players without data": "اعرض اللاعبين بدون بيانات", "Σ# GW": "مجموع # جولات", "Avg / GW": "المعدل / جولة",
    "Pts/£m": "نقاط/£m", "Showing the first #": "يُعرض أول #",
    "Predicted points are model estimates": "النقاط المتوقعة تقديرات من النموذج",
    "for the next # gameweeks. They are not historical points:": "للجولات الـ# القادمة. وليست نقاطاً تاريخية:",
    "actual season points": "نقاط الموسم الفعلية",
    "appear only in the details panel and the Table tab. Estimates are expected values (probability-weighted), so a player who may miss a match carries a fraction of the points he would score if fit": "تظهر فقط في لوحة التفاصيل وتبويب الجدول. التقديرات قيم متوقعة (موزونة بالاحتمال)، فاللاعب اللي قد يغيب يحمل جزءاً من النقاط اللي كان بيسجلها لو كان جاهزاً",
    "# players. Tap a column to sort, tap a name for the factors behind the prediction. Value = predicted points ÷ price in £m": "# لاعب. اضغط على عمود للترتيب، وعلى اسم لأسباب التوقع. القيمة = النقاط المتوقعة ÷ السعر بالمليون",
    "(FPL status, updated at each synchronization": "(حالة FPL، تتحدث مع كل مزامنة", "kept separate from ability)": "ومنفصلة عن مستوى اللاعب)",
    "Actual season points (history)": "نقاط الموسم الفعلية (التاريخ)", "Predicted, next # GW (availability-adjusted)": "المتوقع، الـ# جولات القادمة (بعد الجاهزية)",
    "Predicted if fully fit": "المتوقع لو جاهز تماماً", "Data quality": "جودة البيانات", "Fit prob": "احتمال الجاهزية",
    "Appear": "المشاركة", "If fit": "لو جاهز", "Strengths": "نقاط القوة", "Weaknesses": "نقاط الضعف", "none notable": "لا شيء لافت",
    "xG per # # vs # for the position": "xG لكل # # مقابل # لمعدل المركز", "xA per # # vs #": "xA لكل # # مقابل #",
    "finishing ratio (goals+#)/(xG+#) = #": "نسبة الإنهاء (الأهداف+#)/(xG+#) = #",
    "regular starter: #% of appearances at #+ minutes": "أساسي منتظم: #% من مشاركاته #+ دقيقة",
    "Uncertainty": "عدم اليقين", "How predictions are calculated, scoring rules and data limits": "كيف تُحسب التوقعات، وقواعد النقاط، وحدود البيانات",
    "Each fixture is predicted separately:": "كل مباراة تُتوقع على حدة:",
    "expected points = Σ over scoring categories of (expected events × points per event)": "النقاط المتوقعة = مجموع (الأحداث المتوقعة × نقاط كل حدث) لكل فئات النقاط",
    "Scoring rules": "قواعد النقاط", "(points": "(النقاط", "Category": "الفئة", "Appearance": "المشاركة",
    "Goals conceded": "الأهداف المستقبلة", "Defensive contribution": "المساهمة الدفاعية", "# (default)": "# (افتراضي)",
    "# per # (default)": "# لكل # (افتراضي)", "Yellow card": "بطاقة صفراء", "Red card": "بطاقة حمراء", "Own goal": "هدف عكسي",
    "Penalty missed": "ركلة جزاء ضائعة", "Penalty saved": "ركلة جزاء متصدى لها", "Limits:": "الحدود:",
    "= #+ minutes and available;": "= #+ دقيقة ومتاح؛", "= #–# minutes, doubtful with a published chance, or under # recent matches;": "= #–# دقيقة، أو مشكوك فيه مع احتمال منشور، أو أقل من # مباريات حديثة؛",
    "= under # minutes, or unavailable without a return date. These are data-sufficiency labels, not accuracy percentages": "= أقل من # دقيقة، أو غير متاح بدون موعد عودة. هذه تسميات لكفاية البيانات وليست نسب دقة",
    "the model has not been backtested here": "النموذج لم يُختبر تاريخياً هنا",
    "\"(default)\" = this rule was not observed in the live data, so the published FPL value is used": "\"(افتراضي)\" = هذه القاعدة لم تظهر في البيانات المباشرة، فتُستخدم القيمة المنشورة من FPL",
    "the rest were derived from gameweek # live data):": "والباقي مستخرج من بيانات الجولة # المباشرة):",
    "a blank gameweek is # because there is no match": "والجولة الفارغة = # لعدم وجود مباراة",
    "Predictions need game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.": "التوقعات تحتاج قوانين اللعبة ونتائج ومواعيد المباريات اللي تجلبها المزامنة القادمة. اضغط \"زامن الآن\" في الإعدادات مرة، ثم افتح هذا التبويب.",
    "No upcoming gameweek found in the data.": "لا توجد جولة قادمة في البيانات.", "No upcoming gameweek found.": "لا توجد جولة قادمة.",
    "No upcoming gameweek with fixtures was found in the data.": "لا توجد جولة قادمة فيها مباريات في البيانات.",
    # ---- أفضل فريق ----
    "Best team for the next gameweek (GW#)": "أفضل فريق للجولة القادمة (ج#)", "Best squad for the next # gameweeks": "أفضل قائمة للجولات الـ# القادمة",
    "Formation chosen": "الخطة المختارة", "Budget remaining": "المتبقي من الميزانية",
    "Predicted points, starting XI incl. captain, GW#": "النقاط المتوقعة للأساسيين مع الكابتن، ج#",
    "Predicted, whole squad (bench included, no captain bonus)": "المتوقع للقائمة كاملة (مع الاحتياط، بدون مضاعفة الكابتن)",
    "Bench (in order": "الاحتياط (بالترتيب", "goalkeeper first)": "الحارس أولاً)", "Bench": "الاحتياط", "Predicted XI + captain": "المتوقع للأساسيين + الكابتن",
    "Availability changed the selection": "الجاهزية غيّرت الاختيار",
    "Availability did not change the selection: the same 15 players are optimal with and without the injury adjustment": "الجاهزية ما غيّرت الاختيار: نفس الـ15 لاعب هم الأفضل مع احتساب الإصابات وبدونها",
    "Rule checks (computed on this team)": "فحص القوانين (محسوب على هذا الفريق)", "Cost £#m of £#m budget": "التكلفة £#m من ميزانية £#m",
    "At most # from one club (limit #": "بحد أقصى # من نادٍ واحد (الحد #", "Captain and vice-captain are starters": "الكابتن والنائب من الأساسيين",
    "bench of #": "احتياط من #", "Squad of #: # GKP, # DEF, # MID, # FWD": "قائمة من #: # حارس، # مدافع، # وسط، # مهاجم",
    "Legal formation ### (# starters, source: game settings)": "خطة نظامية ### (# أساسيين، المصدر: إعدادات اللعبة)",
    "Squad value (period = GW#)": "قيمة القائمة (الفترة = ج#)", "Role": "الدور", "Predicted GW#": "المتوقع ج#",
    "Pts/£m (GW#)": "نقاط/£m (ج#)", "captain": "كابتن", "vice": "نائب", "XI": "أساسي",
    "Formation comparison (each is the exact optimum for that formation)": "مقارنة الخطط (كل واحدة الأفضل بدقة لخطتها)",
    "### is chosen because its best valid team has the highest predicted total": "اختيرت ### لأن أفضل فريق نظامي فيها له أعلى مجموع متوقع",
    "the next best, ###, is # points lower. The objective is total expected points within the budget and rules, not points per £": "والتالية، ###، أقل بـ# نقطة. الهدف هو مجموع النقاط المتوقعة ضمن الميزانية والقوانين، وليس النقاط لكل جنيه",
    "Optimization: exact for the candidate pool (# of # players after a lossless dominance prune), using dynamic programming over the budget with branch and bound for the club limit. Bench order breaks ties among equal-value squads (weight #)": "التحسين: دقيق لمجموعة المرشحين (# من # لاعب بعد تصفية بدون خسارة)، ببرمجة ديناميكية على الميزانية مع تفرّع وتقييد لحد النادي. ترتيب الاحتياط يفصل بين القوائم المتساوية (وزن #)",
    "FPL automatic substitutions are not simulated": "التبديلات التلقائية في FPL غير محاكاة",
    "Optimizing every legal formation": "جارٍ تحسين كل الخطط النظامية", "Optimizing every legal formation…": "جارٍ تحسين كل الخطط النظامية…",
    "within the budget (a few seconds)…": "ضمن الميزانية (ثوانٍ قليلة)…",
    "No valid team exists under the rules with the players that have data.": "لا يوجد فريق نظامي باللاعبين اللي لهم بيانات.",
    "No valid squad exists under the rules with the players that have data.": "لا توجد قائمة نظامية باللاعبين اللي لهم بيانات.",
    "The team builder needs game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.": "بنّاء الفريق يحتاج قوانين اللعبة ونتائج ومواعيد المباريات اللي تجلبها المزامنة القادمة. اضغط \"زامن الآن\" في الإعدادات مرة، ثم افتح هذا التبويب.",
    # ---- مخطط التوزيع والقيمة والمقارنة والفرق والمباريات ----
    "Price vs points": "السعر مقابل النقاط", "Price vs value": "السعر مقابل القيمة", "Ownership vs points": "الامتلاك مقابل النقاط",
    "xGI vs points": "xGI مقابل النقاط", "Price vs xGI/#": "السعر مقابل xGI/#", "Price vs xT (PitchAPI)": "السعر مقابل xT (PitchAPI)",
    "# of # players have a value for both metrics. Colours:": "# من # لاعب لهم قيمة في المقياسين. الألوان:",
    "The # best on both axes are named": "تظهر أسماء أفضل # على المحورين", "Tap a dot for details": "اضغط على نقطة للتفاصيل",
    "Not enough players with a value for both metrics.": "لا يوجد لاعبون كافون لهم قيمة في المقياسين.",
    "Biggest price rises since the start of the season (£m)": "أكبر ارتفاع في السعر منذ بداية الموسم (£m)",
    "Biggest price falls (£m)": "أكبر انخفاض في السعر (£m)", "No price changes yet.": "لا توجد تغييرات في الأسعار بعد.",
    "No players match.": "لا يوجد لاعبون مطابقون.", "Search a player to add (max #)": "ابحث عن لاعب لإضافته (بحد أقصى #)",
    "Search above, or press + next to a player in the Table tab. Selected players are compared on every metric, price over time and points per gameweek": "ابحث بالأعلى، أو اضغط + بجانب لاعب في تبويب الجدول. اللاعبون المختارون يُقارنون في كل مقياس، والسعر عبر الوقت، والنقاط لكل جولة",
    "Already in the comparison": "موجود في المقارنة أصلاً", "Maximum of # players. Remove one first": "الحد الأقصى # لاعبين. احذف واحداً أولاً",
    "Average price of regular players (£m)": "متوسط سعر اللاعبين المنتظمين (£m)", "Points per £m, regular players": "النقاط لكل £m، اللاعبون المنتظمون",
    "Avg £m": "متوسط £m", "Regular players = at least # minutes. Totals add the values the source gave": "اللاعبون المنتظمون = # دقيقة على الأقل. المجاميع تجمع قيم المصدر",
    "they include players who have since left": "وتشمل لاعبين غادروا بعدها",
    "Next # gameweeks, easiest run first. Difficulty is the official FPL rating from # (easiest) to #. Capital letters = home": "الجولات الـ# القادمة، الأسهل أولاً. الصعوبة تقييم FPL الرسمي من # (الأسهل) إلى #. الحروف الكبيرة = على أرضه",
    "Price (£m) after each match": "السعر (£m) بعد كل مباراة", "Points per gameweek": "النقاط لكل جولة", "Cumulative points": "النقاط التراكمية",
    # ---- الاختبار التاريخي ----
    "What this tests": "ماذا يختبر", "earlier": "سابقة", "v# = the model used in Predicted Points": "v# = النموذج المستخدم في النقاط المتوقعة",
    "unchanged": "بدون تغيير", "Small sample:": "عينة صغيرة:", "Player-gameweeks tested": "عدد (لاعب × جولة) المختبرة",
    "Different players": "لاعبون مختلفون", "Data version (UTC)": "نسخة البيانات (UTC)", "Points accuracy (lower error is better)": "دقة النقاط (الخطأ الأقل أفضل)",
    "Bias (pred − actual)": "الانحياز (المتوقع − الفعلي)", "Model MAE gain": "تحسن MAE للنموذج", "By position": "حسب المركز",
    "Bias": "الانحياز", "By gameweek": "حسب الجولة", "MAE model": "MAE النموذج", "MAE last#": "MAE آخر #", "MAE season": "MAE الموسم",
    "RMSE model": "RMSE النموذج", "RMSE last#": "RMSE آخر #", "Season average": "معدل الموسم", "Season avg": "معدل الموسم",
    "Last#": "آخر #", "Last# average": "معدل آخر #", "Minutes and playing probability": "الدقائق واحتمال المشاركة", "Minutes MAE": "MAE الدقائق",
    "Brier score (P(play))": "درجة Brier (احتمال المشاركة)", "Constant (overall rate #%)": "ثابت (المعدل العام #%)",
    "Predicted chance": "الاحتمال المتوقع", "Average predicted": "متوسط المتوقع", "Played": "شارك", "Captain picks": "اختيارات الكابتن",
    "Mean points of the pick": "متوسط نقاط الاختيار", "Mean regret vs best player": "متوسط الفارق عن أفضل لاعب",
    "Pick in the actual top #": "الاختيار ضمن أفضل # فعلياً", "Hindsight best player": "أفضل لاعب بأثر رجعي", "Model pick": "اختيار النموذج",
    "Last# pick": "اختيار آخر #", "Best in pool": "الأفضل في المجموعة", "Team selection test": "اختبار اختيار الفريق",
    "Model team, mean points per GW": "فريق النموذج، متوسط النقاط لكل جولة", "Last# average team": "فريق معدل آخر #",
    "Hindsight ceiling": "السقف بأثر رجعي", "GWs where the model team beat last#": "جولات تفوق فيها فريق النموذج على آخر #",
    "Hindsight": "بأثر رجعي", "Model formation": "خطة النموذج", "Run team selection test": "شغّل اختبار اختيار الفريق",
    "Run calibration and penalty-regression comparison": "شغّل المعايرة ومقارنة ضبط ركلات الجزاء", "Not tested here": "لم يُختبر هنا",
    "Injuries, suspensions and news": "الإصابات والإيقافات والأخبار", "Replaying gameweeks…": "جارٍ إعادة الجولات…",
    "only # gameweeks. Treat every number below as provisional": "# جولات فقط. اعتبر كل رقم أدناه مبدئياً",
    "it becomes meaningful as the season grows": "ويصير له معنى مع تقدم الموسم",
    "MAE per gameweek (lower is better) (gameweek on the x axis)": "MAE لكل جولة (الأقل أفضل) (الجولة على المحور الأفقي)",
    "Colour order: model, last#, season average": "ترتيب الألوان: النموذج، آخر #، معدل الموسم",
    "vs last# average: the model had the lower average error in": "مقابل معدل آخر #: النموذج كان أقل خطأً في",
    "vs season average: the model had the lower average error in": "مقابل معدل الموسم: النموذج كان أقل خطأً في",
    "Every finished gameweek is replayed as if it had not been played: the model sees only matches from": "كل جولة منتهية تُعاد كأنها ما لُعبت: النموذج يرى فقط مباريات الجولات",
    "Points range calibration and model v# (penalty regression)": "معايرة نطاق النقاط والنموذج v# (ضبط ركلات الجزاء)",
    "Lineup ranges (# players + captain)": "نطاقات التشكيلة (# لاعب + الكابتن)",
    "Model v# vs v#": "النموذج v# مقابل v#", "Check": "الفحص", "Model says": "حسب النموذج",
    "A backtest needs at least 2 finished gameweeks (one to learn from, one to predict).": "الاختبار التاريخي يحتاج جولتين منتهيتين على الأقل (واحدة للتعلم وواحدة للتوقع).",
    "No player-gameweeks in this range.": "لا توجد بيانات في هذا النطاق.", "No minutes data.": "لا توجد بيانات دقائق.",
    "Not enough players in the pool to test captain picks yet.": "لا يوجد لاعبون كافون لاختبار اختيارات الكابتن بعد.",
    "No gameweek produced a valid team for all three methods.": "لا توجد جولة أعطت فريقاً نظامياً للطرق الثلاث.",
    "Rule violations found by the validator in the # teams: #": "مخالفات القوانين في الـ# فريق: #",
    # ---- البيانات والإعدادات ----
    "Synchronize": "المزامنة", "Synchronize now": "زامن الآن", "Reload data": "إعادة تحميل البيانات", "owner/repo": "المالك/المستودع",
    "GitHub token (kept on this device only)": "توكن GitHub (يُحفظ على هذا الجهاز فقط)",
    "One press fetches every new match from PitchAPI, retries recent matches whose analytics were incomplete, and then refreshes this site by itself when the new data is published. It also runs automatically on a schedule": "ضغطة واحدة تجلب كل مباراة جديدة من PitchAPI، وتعيد محاولة المباريات الحديثة الناقصة، ثم تحدّث الموقع لوحده لما تُنشر البيانات. وتشتغل تلقائياً حسب الجدول أيضاً",
    "Create a fine-grained token for this repository only, with the permission Actions": "أنشئ توكن fine-grained لهذا المستودع فقط، بصلاحية Actions",
    "Read and write. It is stored in this browser and only sent to GitHub": "Read and write. يُحفظ في هذا المتصفح ويُرسل لـ GitHub فقط",
    "No data yet. Press Synchronize in Settings to update the data.": "لا توجد بيانات بعد. اضغط \"زامن الآن\" في الإعدادات لتحديثها.",
    "No data yet. The first sync is running in the background, reload this page in a few minutes.": "لا توجد بيانات بعد. أول مزامنة تشتغل بالخلفية، أعد تحميل الصفحة بعد دقائق.",
    "No player statistics for this competition yet. They appear after the next synchronization.": "لا توجد إحصائيات لاعبين لهذه المسابقة بعد. تظهر بعد المزامنة القادمة.",
    "No Fantasy data yet. It is fetched from the official Fantasy Premier League API during the next synchronization (at most once an hour). Press Synchronize in Settings.": "لا توجد بيانات فانتازي بعد. تُجلب من FPL الرسمي في المزامنة القادمة (مرة كل ساعة كحد أقصى). اضغط \"زامن الآن\" في الإعدادات.",
    "No values to draw.": "لا توجد قيم للرسم.",
    "No player matches this search and minutes filter.": "لا يوجد لاعب يطابق البحث وحد الدقائق.",
    # ---- أخبار FPL ----
    "#% chance of playing": "احتمال المشاركة #%", "Expected back # Jan": "يُتوقع عودته # يناير", "Expected back # Feb": "يُتوقع عودته # فبراير",
    "Expected back # Mar": "يُتوقع عودته # مارس", "Expected back # Apr": "يُتوقع عودته # أبريل", "Expected back # May": "يُتوقع عودته # مايو",
    "Expected back # Jun": "يُتوقع عودته # يونيو", "Expected back # Jul": "يُتوقع عودته # يوليو", "Expected back # Aug": "يُتوقع عودته # أغسطس",
    "Expected back # Sep": "يُتوقع عودته # سبتمبر", "Expected back # Oct": "يُتوقع عودته # أكتوبر", "Expected back # Nov": "يُتوقع عودته # نوفمبر",
    "Expected back # Dec": "يُتوقع عودته # ديسمبر", "Unknown return date": "موعد العودة غير معروف",
}
_AR_DICT.update({
    # رموز المقاييس تبقى كما هي (حتى تُترجم القوائم اللي فيها)
    "xG": "xG", "xT": "xT", "npxG": "npxG", "xA": "xA", "xAG": "xAG", "xGI": "xGI", "VAEP": "VAEP", "PPDA": "PPDA", "xGOT": "xGOT",
    "PL Analytics": "PL Analytics", "Premier League": "الدوري الإنجليزي",
    "FPL data has no shots or shots-on-target per player and no opponent shot counts, so xG/xA and team xG (from per-match player xG) are used instead": "بيانات FPL ما فيها تسديدات اللاعبين ولا تسديدات الخصم، فنستخدم xG وxA وxG الفريق (من xG اللاعبين في كل مباراة) بدلها",
    "PitchAPI shots are not used in the model. Defensive-contribution counts are modelled as Poisson from season totals. Injury data is FPL's own status, news text and published chance of playing (next gameweek only)": "تسديدات PitchAPI غير مستخدمة في النموذج. المساهمة الدفاعية تُنمذج بتوزيع بواسون من مجاميع الموسم. بيانات الإصابات من FPL نفسه: الحالة ونص الخبر واحتمال المشاركة المنشور (للجولة القادمة فقط)",
    "a return date is used only when the news text states one. Beyond the next gameweek a published chance is carried forward unchanged, and a player with no chance or date published is treated as unavailable. Data quality:": "موعد العودة يُستخدم فقط إذا ذكره نص الخبر. بعد الجولة القادمة يُنقل الاحتمال المنشور كما هو، واللاعب بدون احتمال أو موعد منشور يُعتبر غير متاح. جودة البيانات:",
    "pick a player and the stat groups you care about. Every stat is turned into a score relative to the other players in the pool (same position by default, goalkeepers excluded). Match % = # ÷ (# + average gap in standard deviations), so #% means about one SD apart on average. It compares playing": "اختر لاعباً ومجموعات الإحصائيات اللي تهمك. كل إحصائية تتحول لدرجة نسبةً لباقي اللاعبين في المجموعة (نفس المركز افتراضياً، بدون الحراس). نسبة التشابه = # ÷ (# + متوسط الفرق بالانحراف المعياري)، فـ#% تعني فرقاً بحدود انحراف معياري واحد في المتوسط. تقارن أسلوب",
    "Rates used (per #, shrunk toward the position average): goals #, assists #, defensive contribution #, bonus #. Playing time: last # matches": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، مساهمة دفاعية #، بونص #. وقت اللعب: آخر # مباريات",
    "Rates used (per #, shrunk toward the position average): goals #, assists #, saves #, bonus #. Playing time: last # matches": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، تصديات #، بونص #. وقت اللعب: آخر # مباريات",
    "Rates used (per #, shrunk toward the position average): goals #, assists #, bonus #. Playing time: last # matches": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، بونص #. وقت اللعب: آخر # مباريات",
    "Rates used (per #, shrunk toward the position average): goals #, assists #, defensive contribution #, bonus #. Playing time: recent appearances while fit": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، مساهمة دفاعية #، بونص #. وقت اللعب: المشاركات الأخيرة وهو جاهز",
    "plays) #%, # min when playing": "يشارك) #%، # دقيقة عند المشاركة",
    "plays) #%, # min when playing. PitchAPI cross-check (not used in the prediction): xG/# #, xT/# #": "يشارك) #%، # دقيقة عند المشاركة. مقارنة PitchAPI (غير مستخدمة في التوقع): xG/# #، xT/# #",
    "gameweeks (player totals, team strengths, league averages and position priors are all rebuilt from those rows), then its prediction is compared with the points the player actually scored. Baselines: the player's average points per match over his last # matches, and over the season so far, multiplied by his number of fixtures. Model tested:": "السابقة (مجاميع اللاعبين وقوة الفرق ومعدلات الدوري والمراكز كلها تُبنى من جديد من تلك الصفوف)، ثم يُقارن توقعه بالنقاط اللي سجلها اللاعب فعلاً. المقارنات: معدل نقاط اللاعب في آخر # مباريات، وفي الموسم حتى تلك الجولة، مضروباً في عدد مبارياته. النموذج المختبر:",
    "Not in the sample: # player-gameweeks where the model had no estimate (no earlier minutes) and # where no matching fixture was found. Players with no minutes all season are not in the stored history": "خارج العينة: # (لاعب × جولة) بدون تقدير من النموذج (بدون دقائق سابقة) و# بدون مباراة مطابقة. اللاعبون بدون دقائق طوال الموسم ليسوا في السجل المحفوظ",
    "MAE = mean absolute error, RMSE = root mean squared error (punishes big misses), both in FPL points per player-gameweek. A positive \"gain\" means the model's average error is smaller than the baseline's. Errors are large for every method because single-match points are very noisy": "MAE = متوسط الخطأ المطلق، RMSE = جذر متوسط مربع الخطأ (يعاقب الأخطاء الكبيرة)، وكلاهما بنقاط FPL لكل (لاعب × جولة). \"التحسن\" الموجب يعني أن خطأ النموذج أقل من المقارنة. الأخطاء كبيرة لكل الطرق لأن نقاط المباراة الواحدة متقلبة جداً",
    "Minutes MAE: average gap between expected and actual minutes in the gameweek. Brier score: mean squared gap between the predicted probability of playing at all and what happened (# = perfect": "MAE الدقائق: متوسط الفرق بين الدقائق المتوقعة والفعلية في الجولة. درجة Brier: متوسط مربع الفرق بين احتمال المشاركة المتوقع وما حدث (# = مثالي",
    "lower is better). Calibration: among players given about X% chance to play, how many played": "والأقل أفضل). المعايرة: من اللاعبين اللي أُعطوا احتمال مشاركة بحدود X%، كم واحد شارك فعلاً",
    "Pool: players with at least # minutes before that gameweek (at least # such players). Points are single (not doubled). The model is also compared with the last# pick gameweek by gameweek below": "المجموعة: لاعبون لهم # دقيقة على الأقل قبل تلك الجولة (# لاعب على الأقل). النقاط مفردة (بدون مضاعفة). ويُقارن النموذج باختيار آخر # جولة بجولة بالأسفل",
    "Each gameweek the real Best Team optimizer (budget, #-per-club rule, legal formations, captain) builds a team from scratch, once valuing players by the model and once by the last# average. \"Hindsight\" values players by the points they actually scored: an unreachable ceiling that shows how much is left. Team points = starting XI + captain bonus": "في كل جولة يبني محسّن أفضل فريق الحقيقي (الميزانية، قاعدة # من كل نادٍ، الخطط النظامية، الكابتن) فريقاً من الصفر، مرة بتقييم النموذج ومرة بمعدل آخر #. \"بأثر رجعي\" يقيّم اللاعبين بالنقاط اللي سجلوها فعلاً: سقف مستحيل يوضح كم بقي للتحسين. نقاط الفريق = الأساسيون + مضاعفة الكابتن",
    "the bench and automatic substitutions are not counted. The price used is the one recorded for that gameweek": "ولا يُحسب الاحتياط ولا التبديلات التلقائية. السعر المستخدم هو المسجل في تلك الجولة",
    "Checks the #% ranges shown in Optimal XI, My XI and Forecast: in the same leak-free replay, how often did a player's actual points fall below the #th or above the #th percentile of his simulated distribution? Also replays model v#, which regresses penalty xG (PitchAPI shots), and compares it with v# on the same player-gameweeks": "يفحص نطاقات #% المعروضة في التشكيلة المثالية وتشكيلتي والتوقعات: في نفس الإعادة التاريخية بدون تسريب، كم مرة جاءت نقاط اللاعب الفعلية تحت المئين # أو فوق المئين # من توزيعه المُحاكى؟ ويعيد أيضاً تشغيل النموذج v# اللي يضبط xG ركلات الجزاء (تسديدات PitchAPI) ويقارنه بـ v# على نفس البيانات",
    "Could not read sync status (Repository \"#/index.html\" was not found (HTTP #). Check the owner/repo field above. If the repository is private, the token must have access to it.)": "تعذرت قراءة حالة المزامنة (المستودع \"#/index.html\" غير موجود (HTTP #). تأكد من خانة المالك/المستودع بالأعلى. إذا المستودع خاص، لازم يكون للتوكن صلاحية عليه.)",
    "Shot-data goals / official score goals, same # matches": "أهداف بيانات التسديد / أهداف النتيجة الرسمية، لنفس الـ# مباراة",
    "Real totals inside the unwidened #% range": "المجاميع الفعلية داخل نطاق #% قبل التوسيع",
    "Spread of real totals vs simulated (sd of z; # = calibrated)": "انتشار المجاميع الفعلية مقابل المُحاكاة (انحراف z؛ # = معايَر)",
    "Inside the #% range after widening by that factor (same data)": "داخل نطاق #% بعد التوسيع بهذا المعامل (نفس البيانات)",
    "Calibration slope of actual on predicted points (# = calibrated": "ميل المعايرة للنقاط الفعلية على المتوقعة (# = معايَر",
    "below # = too spread out)": "أقل من # = متباعدة أكثر من اللازم)",
    "Actual below the #th percentile": "الفعلي تحت المئين #", "Actual above the #th percentile": "الفعلي فوق المئين #",
    "Mean points per player-gameweek": "متوسط النقاط لكل (لاعب × جولة)", "Optimal XI projected": "توقع التشكيلة المثالية",
    "Simulated #% range": "نطاق #% المُحاكى", "Below P#: actual": "تحت P#: الفعلي", "Above P#: actual": "فوق P#: الفعلي", "model": "النموذج",
    "All player-gameweeks": "كل (لاعب × جولة)", "Only where v# changes the prediction (penalty takers)": "فقط حيث يغيّر v# التوقع (منفذو ركلات الجزاء)",
    "MAE v#": "MAE v#",
})
_AR_DICT.update({
    "expected (#% range #–#)": "متوقع (نطاق #%: #–#)",
    "mean MAE gain # points ± # (#% interval across gameweeks)": "متوسط تحسن MAE # نقطة ± # (فترة #% عبر الجولات)",
    "Expected events come from per# rates shrunk toward the position average (pseudo-evidence of # minutes), scaled by expected minutes, and adjusted for the opponent. Goals use xG once (no separate shot-conversion term), multiplied by a finishing ratio (goals+#)/(xG+#). Opponent effect for attackers = the opponent's xG conceded per match relative to the league (team strengths shrunk with # pseudo-matches), with a home/away league average. Clean sheets use a Poisson goal model": "الأحداث المتوقعة من معدلات لكل # مقرّبة من معدل المركز (ما يعادل # دقيقة إضافية)، مضروبة في الدقائق المتوقعة ومعدّلة حسب الخصم. الأهداف تستخدم xG مرة واحدة (بدون عامل تحويل منفصل)، مضروبة في نسبة الإنهاء (الأهداف+#)/(xG+#). أثر الخصم على المهاجمين = xG اللي يستقبله الخصم في المباراة نسبةً للدوري (قوة الفرق مقرّبة بـ# مباريات افتراضية)، مع معدل الأرض/الخارج. الشباك النظيفة بنموذج بواسون للأهداف",
    "P(# goals) with the opponent's expected xG, calibrated by league goals ÷ xG (#, from # matches). Saves, goals-conceded deductions and defensive-contribution points are expectations of stepwise rules under Poisson counts. A double gameweek adds both fixtures": "احتمال (# أهداف) حسب xG المتوقع للخصم، معايَر بنسبة أهداف الدوري ÷ xG (#، من # مباراة). التصديات وخصم الأهداف المستقبلة ونقاط المساهمة الدفاعية توقعات لقواعد متدرجة بتوزيع بواسون. الجولة المزدوجة تجمع المباراتين",
    "On target is PitchAPI's flag (also true for blocked shots heading on target). Conversion divides goals by all shots, blocked ones included. Goals − xG uses only shots that have an xG. Average distance is computed here from the shot coordinates. # own goal(s) excluded. Left/right: the team's left flank is at the top": "\"على المرمى\" حسب علامة PitchAPI (تشمل التسديدات المصدودة المتجهة للمرمى). التحويل = الأهداف ÷ كل التسديدات بما فيها المصدودة. الأهداف − xG تستخدم فقط التسديدات اللي لها xG. متوسط المسافة محسوب هنا من إحداثيات التسديد. استُبعد # هدف عكسي. يسار/يمين: الجهة اليسرى للفريق في الأعلى",
    "Node position = average origin of that player's completed passes in the window (not their average position). Left/right: the team's left flank is at the top when it attacks to the right (untick \"Flip left/right\" if a player you know looks mirrored). Node size = passes played. Line width is proportional to the passes between the two players (thickest drawn: #)": "موقع اللاعب = متوسط مكان تمريراته الناجحة في النافذة (وليس متوسط مركزه). يسار/يمين: الجهة اليسرى للفريق في الأعلى لما يهاجم لليمين (ألغِ \"اقلب يسار/يمين\" إذا ظهر لاعب تعرفه معكوساً). حجم الدائرة = عدد التمريرات. سُمك الخط حسب عدد التمريرات بين اللاعبين (الأسمك: #)",
    "aerial win % uses aerials won ÷ aerials contested. \"Ground duels won\" = duels won − aerial duels won (derived). Pressing is reported per": "نسبة الفوز الهوائي = الهوائية المكسوبة ÷ الهوائية. \"الالتحامات الأرضية المكسوبة\" = الالتحامات المكسوبة − الهوائية المكسوبة (مشتقة). الضغط يُرسل لكل",
    "# of # cells active. Attacking frame (acting_ltr): cell # = own goal line, cell # = opponent's, so this team attacks to the right": "# من # خلية فيها نشاط. إطار الهجوم (acting_ltr): الخلية # = خط مرمى الفريق، والخلية # = مرمى الخصم، فهذا الفريق يهاجم لليمين",
    "empty cells had no recorded action. Raw match totals, not per#, so a substitute looks thinner because of minutes. Left/right: the team's left flank is at the top when it attacks to the right": "الخلايا الفارغة بدون أي فعل مسجل. مجاميع خام للمباراة وليست لكل #، فالبديل يبدو أخف بسبب دقائقه. يسار/يمين: الجهة اليسرى للفريق في الأعلى لما يهاجم لليمين",
    "PitchAPI does not document which touchline is y=#, so untick \"Flip left/right\" if a player you know looks mirrored": "PitchAPI لا يوضح أي خط تماس هو y=#، فألغِ \"اقلب يسار/يمين\" إذا ظهر لاعب تعرفه معكوساً",
    "FPL keeps no historical record of them, so every player is treated as available in the replay (the live model does adjust for them). Transfers, chips and price changes are not tested. Scoring rules are assumed constant through the season. A player who changed club is placed in his real club for the gameweek being predicted, but his earlier matches count toward his current club's data. The replay uses FPL fields only (xG, xA, minutes, bonus and the other history columns)": "FPL لا يحفظ سجلاً تاريخياً لها، فكل لاعب يُعتبر متاحاً في الإعادة (النموذج المباشر يأخذها بالحسبان). الانتقالات والشرائح وتغير الأسعار غير مختبرة. قواعد النقاط يُفترض أنها ثابتة طوال الموسم. اللاعب اللي غيّر ناديه يوضع في ناديه الفعلي للجولة المتوقعة، لكن مبارياته السابقة تُحسب لبيانات ناديه الحالي. الإعادة تستخدم حقول FPL فقط (xG وxA والدقائق والبونص وباقي أعمدة السجل)",
    "PitchAPI data is not used. No model version other than v# exists yet, and the model has not been tuned on these results, so nothing here is an in-sample fit": "وبيانات PitchAPI غير مستخدمة. النموذج v# ما عُدّل بناءً على هذه النتائج، فلا شيء هنا ملائمة على نفس العينة",
    "Players selected": "اللاعبون المختارون", "Fixed opt.": "المثالية الثابتة",
})
_AR_DICT.update(globals().get("_AR_SEASON", {}))     # نصوص إضافة المواسم
_AR_INJ = {"Calf": "إصابة في الساق", "Ankle": "إصابة في الكاحل", "Groin": "إصابة في الفخذ", "Hamstring": "إصابة في العضلة الخلفية",
           "Muscular": "إصابة عضلية", "Foot": "إصابة في القدم", "Knee": "إصابة في الركبة", "Unspecified": "إصابة غير محددة",
           "Back": "إصابة في الظهر", "Hip": "إصابة في الورك", "Thigh": "إصابة في الفخذ", "Shoulder": "إصابة في الكتف",
           "Head": "إصابة في الرأس", "Achilles": "إصابة في وتر أخيل", "Toe": "إصابة في إصبع القدم", "Heel": "إصابة في الكعب",
           "Hand": "إصابة في اليد", "Wrist": "إصابة في الرسغ", "Rib": "إصابة في الضلع", "Neck": "إصابة في الرقبة"}
_AR_MON = {"Jan": "يناير", "Feb": "فبراير", "Mar": "مارس", "Apr": "أبريل", "May": "مايو", "Jun": "يونيو", "Jul": "يوليو",
           "Aug": "أغسطس", "Sep": "سبتمبر", "Oct": "أكتوبر", "Nov": "نوفمبر", "Dec": "ديسمبر"}
_AR_DAY = {"Mon": "الإثنين", "Tue": "الثلاثاء", "Wed": "الأربعاء", "Thu": "الخميس", "Fri": "الجمعة", "Sat": "السبت", "Sun": "الأحد"}

_X_ARJS_CODE = r"""/* ===== Arabic interface (عربي / EN): translates visible text after each render; data, names and numbers stay as they are ===== */
const ARL={on:false,memo:new Map()};
const AR_NUM=/-?\d+(?:[.,]\d+)*/g,AR_SEP=/( · |; | — | \| |: (?=[A-Z]))/;
const AR_SEPT={' · ':' · ','; ':'؛ ',' — ':' — ',' | ':' | ',': ':': '};
const arPos=s=>AR[s]||s;
/* dictionary lookup: digits become #, a literal # becomes №; numbers go back in order */
function arDict(t){const nums=[];const key=t.replace(/#/g,'№').replace(AR_NUM,(m,o,s)=>{nums.push(m[0]==='-'&&/[A-Za-z]/.test(s[o-1]||'')?m.slice(1):m);return '#'});const v=AR[key];if(v==null)return null;let i=0;return v.replace(/#/g,()=>nums[i++]??'')}
const AR_RULES=[
 [/^Add (.+)$/,m=>'أضف '+m[1]],
 [/^(.+?) injury - (.+)$/,m=>(AR_INJ[m[1]]||('إصابة: '+m[1]))+' - '+(arT(m[2])||m[2])],
 [/^(Knock|Illness) - (.+)$/,m=>({Knock:'كدمة',Illness:'مرض'})[m[1]]+' - '+(arT(m[2])||m[2])],
 [/^Suspended until (\d+) (\w{3})$/,m=>'موقوف حتى '+m[1]+' '+(AR_MON[m[2]]||m[2])],
 [/^deadline (\w{3}), (\d+) (\w{3}) (\d+) ([\d:]+) UTC$/,m=>'الموعد النهائي '+(AR_DAY[m[1]]||m[1])+' '+m[2]+' '+(AR_MON[m[3]]||m[3])+' '+m[4]+' '+m[5]+' UTC'],
 [/^(.+) v (.+)$/,m=>m[1]+' ضد '+m[2]],
 [/^(.+) → (.+): (\d+) passes$/,m=>m[1]+' → '+m[2]+': '+m[3]+' تمريرة'],
 [/^(.+): (\d+) passes played, average pass origin \((.+)\) m$/,m=>m[1]+': '+m[2]+' تمريرة، متوسط موقع التمرير ('+m[3]+') م'],
 [/^vice (.+)$/,m=>'النائب '+m[1]],
 [/^(captain|vice-captain) chosen \((.+)\)$/,m=>(m[1]==='captain'?'تم اختيار الكابتن':'تم اختيار نائب الكابتن')+' ('+m[2]+')'],
 [/^Top (\d+) by (.+)$/,m=>'أفضل '+m[1]+' حسب '+(arT(m[2])||m[2])],
 [/^Only in (.+) \((\d+)\)$/,m=>'في '+(arT(m[1])||m[1])+' فقط ('+m[2]+')'],
 [/^(.+): (-?[\d.]+) vs (-?[\d.]+)$/,m=>(arT(m[1])||m[1])+': '+m[2]+' مقابل '+m[3]],
 [/^(.+) \/(\d+)$/,m=>{const r=arT(m[1]);return r==null?null:r+' /'+m[2]}],
 [/^(.+) vs (.+)$/,m=>m[1]+' مقابل '+m[2]],
 [/^([A-Z]{3}) concede ([\d.]+) xG\/match \(avg ([\d.]+)\)$/,m=>m[1]+' تستقبل '+m[2]+' xG/مباراة (المعدل '+m[3]+')'],
 [/^([A-Z]{3}) create only ([\d.]+) xG\/match$/,m=>m[1]+' تصنع '+m[2]+' xG/مباراة فقط'],
 [/^(\d+) of (\d+) ([A-Z]{3}) penalties$/,m=>m[1]+' من '+m[2]+' ركلات جزاء '+m[3]],
 [/^availability: (.+)$/,m=>'الجاهزية: '+(arT(m[1])||m[1])],
 [/^club limit: ([A-Z]{3}) already has (\d+) in the XI$/,m=>'حد النادي: '+m[1]+' عندها '+m[2]+' في التشكيلة'],
 [/^formation: (\S+) uses (\d+) (GKP|DEF|MID|FWD)( \(the maximum\))?$/,m=>'الخطة: '+m[1]+' فيها '+m[2]+' '+AR[m[3]]+(m[4]?' (الحد الأقصى)':'')],
 [/^his ([\d.]+) beats the lowest starter elsewhere, but adding a (GKP|DEF|MID|FWD) costs more at another position$/,m=>'نقاطه '+m[1]+' أعلى من أضعف أساسي في مركز آخر، لكن إضافة '+AR[m[2]]+' تكلّف أكثر في مركز آخر'],
 [/^(.+) added \((\d+)\/(\d+)\)$/,m=>'تمت إضافة '+m[1]+' ('+m[2]+'/'+m[3]+')'],
 [/^(.+) is already in your XI$/,m=>m[1]+' موجود في تشكيلتك أصلاً'],
 [/^(.+) has no projection \(no minutes this season\), so he cannot be scored$/,m=>m[1]+' بدون توقع (بدون دقائق هذا الموسم)، فلا يمكن حساب نقاطه'],
 [/^All (\d+) (GKP|DEF|MID|FWD) places of (\S+) are filled$/,m=>'كل أماكن '+AR[m[2]]+' ('+m[1]+') في خطة '+m[3]+' ممتلئة'],
 [/^Remove one, or pick a formation with more (GKP|DEF|MID|FWD)$/,m=>'احذف واحداً أو اختر خطة فيها '+AR[m[1]]+' أكثر'],
 [/^You already have (\d+) players from (.+) \(FPL limit\)$/,m=>'عندك '+m[1]+' لاعبين من '+m[2]+' أصلاً (حد FPL)'],
 [/^Removed (.+)$/,m=>'تمت إزالة '+m[1]],
 [/^Pick a replacement (GKP|DEF|MID|FWD) below$/,m=>'اختر '+AR[m[1]]+' بديلاً بالأسفل'],
 [/^Cannot switch to (\S+): remove (.+) first$/,m=>'لا يمكن التحويل إلى '+m[1]+': احذف '+m[2].replace(/(\d+) (GKP|DEF|MID|FWD)/g,(a,n,p)=>n+' '+AR[p]).replace(/ and /g,' و')+' أولاً'],
 [/^Saved "(.+)" on this device$/,m=>'تم حفظ "'+m[1]+'" على هذا الجهاز'],
 [/^Loaded "(.+)"(.*)$/,m=>'تم تحميل "'+m[1]+'"'+m[2]],
 [/^Deleted "(.+)"$/,m=>'تم حذف "'+m[1]+'"'],
 [/^(\d+) saved player\(s\) are no longer in the FPL data and were removed$/,m=>m[1]+' لاعب محفوظ لم يعد في بيانات FPL وتمت إزالته'],
 [/^Optimizing GW(\d+) \((\d+) of (\d+)\)…$/,m=>'جارٍ تحسين ج'+m[1]+' ('+m[2]+' من '+m[3]+')…'],
 [/^Replaying gameweek (\d+)… \(no future data is used\)$/,m=>'جارٍ إعادة الجولة '+m[1]+'… (بدون أي بيانات مستقبلية)'],
 [/^Forecast — next (\d+) gameweeks?$/,m=>'التوقعات — '+(m[1]==='1'?'الجولة القادمة':'الجولات الـ'+m[1]+' القادمة')],
 [/^Period: gameweek (\d+) only$/,m=>'الفترة: الجولة '+m[1]+' فقط'],
 [/^Period: gameweek (\d+) only\. Captain (.+) scores double \(expected extra ([\d.]+)\)$/,m=>'الفترة: الجولة '+m[1]+' فقط. الكابتن '+m[2]+' نقاطه مضاعفة (زيادة متوقعة '+m[3]+')'],
 [/^Captain (.+) scores double \(expected extra ([\d.]+)\)$/,m=>'الكابتن '+m[1]+' نقاطه مضاعفة (زيادة متوقعة '+m[2]+')'],
 [/^vice-captain (.+) takes over only if the captain does not play \(P\(captain plays\) (\d+)%, expected vice bonus ([\d.]+), not included in the total\)$/,m=>'نائب الكابتن '+m[1]+' يأخذ الشارة فقط إذا ما لعب الكابتن (احتمال مشاركة الكابتن '+m[2]+'%، زيادة متوقعة للنائب '+m[3]+'، غير محسوبة في المجموع)'],
 [/^Captain: yours (.+?) \(\+([-\d.]+)\), model (.+?) \(\+([-\d.]+)\): ([-+\d.]+)\. Player swaps ([-+\d.]+) \+ captain ([-+\d.]+) = ([-+\d.]+) \(unrounded difference ([-\d.]+)\)\. Tap any name to see why the model rates him as it does\.?$/,m=>'الكابتن: كابتنك '+m[1]+' (+'+m[2]+')، كابتن النموذج '+m[3]+' (+'+m[4]+'): '+m[5]+'. تبديل اللاعبين '+m[6]+' + الكابتن '+m[7]+' = '+m[8]+' (الفرق بدون تقريب '+m[9]+'). اضغط على أي اسم لترى لماذا يقيّمه النموذج هكذا'],
 [/^Captain: yours —, model (.+?) \(\+([-\d.]+)\): ([-+\d.]+)\. (.+)$/,m=>'الكابتن: كابتنك —، كابتن النموذج '+m[1]+' (+'+m[2]+'): '+m[3]+'. '+(arT(m[4])||m[4])],
 [/^If injuries and doubts were ignored the optimizer would pick (.+) instead of (.+)\. That availability-blind team is expected to score ([\d.]+) points once their fitness is counted, against ([\d.]+) for the chosen team\.?$/,m=>'لو تجاهلنا الإصابات والشكوك لاختار المحسّن '+m[1]+' بدل '+m[2]+'. ذلك الفريق متوقع له '+m[3]+' نقطة بعد احتساب جاهزيتهم، مقابل '+m[4]+' للفريق المختار'],
 [/^(.+) \(direct\)$/,m=>m[1]+' (مباشر)'],
 [/^formation change \((\S+) → (\S+)\)$/,m=>'تغيير الخطة ('+m[1]+' ← '+m[2]+')'],
 [/^exp\. minutes (\d+) → (\d+)$/,m=>'الدقائق المتوقعة '+m[1]+' ← '+m[2]],
 [/^(Minutes|Goals|Assists|Clean sheet|Goals conc\.|Saves|Def\. contr\.|Bonus|Cards\/other) ([-+][\d.]+)$/,m=>(arT(m[1])||m[1])+' '+m[2]],
 [/^(Minutes|Goals|Assists|Clean sheet|Goals conc\.|Saves|Def\. contr\.|Bonus|Cards\/other)$/,m=>({'Goals conc.':'أهداف مستقبلة','Def. contr.':'مساهمة دفاعية'})[m[1]]||null],
];
function arT(raw){
 if(raw==null)return null;const t=String(raw).replace(/\s+/g,' ').trim();if(!t||!/[A-Za-z]{2}/.test(t))return null;
 if(ARL.memo.has(t))return ARL.memo.get(t);
 let r=arDict(t);
 if(r==null){const m=/^([✓✗●!★■▲•+]\s*)(.+)$/.exec(t);if(m){const x=arT(m[2]);if(x!=null)r=m[1]+x}}
 if(r==null){const m=/^(.+?)(\s*[✕↓↑])$/.exec(t);if(m){const x=arT(m[1]);if(x!=null)r=x+m[2]}}
 if(r==null){const m=/^([\s.,]*)(.*?)([\s.,]*)$/.exec(t);if(m&&(m[1]||m[3])&&m[2]){const x=arT(m[2]);if(x!=null)r=m[1]+x+m[3].replace(/,/g,'،')}}
 if(r==null)for(const [re,f] of AR_RULES){const m=re.exec(t);if(m){const x=f(m);if(x!=null){r=x;break}}}
 if(r==null){const parts=t.split(AR_SEP);if(parts.length>1){let any=false;const o=parts.map((p,i)=>{if(i%2)return AR_SEPT[p]||p;const x=arT(p);if(x!=null){any=true;return x}return p});if(any)r=o.join('')}}
 if(r==null&&t.includes(', ')){const ps=t.split(', ');const o=ps.map(p=>arT(p));if(o.every(x=>x!=null))r=o.join('، ')}
 ARL.memo.set(t,r);return r;
}
/* in right-to-left text, signed numbers (+1.9), ranges (37–79), differences (57.3 − 55.1), dates and times would be shown
   reversed or broken: each such run is isolated as left-to-right, and the hyphens of a date never break a line */
const AR_RUN=/[+\-−£]?\d[\d.,:%]*(?:[ \-−–\/×:]+[+\-−£]?\d[\d.,:%]*)*(?: UTC)?/g;
const arBidi=s=>s.includes('⁦')?s:s.replace(AR_RUN,m=>{if(!/[+\-−–\/: ]/.test(m))return m;const t=m.replace(/(\d{4})-(\d{2})-(\d{2})/g,'$1‑$2‑$3');return '⁦'+t+'⁩'});
function arNode(n){
 const v=n.nodeValue;if(!v||!v.trim())return;const p=n.parentNode;if(p&&/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName))return;
 let o=v;const x=arT(v);if(x!=null){const lead=v.match(/^\s*/)[0],trail=v.match(/\s*$/)[0];o=lead+x+trail}
 o=arBidi(o);if(!o.includes('\u2066')&&o.includes('£')&&!/[\u0600-\u06FF]/.test(o))o='\u2066'+o+'\u2069';if(o!==v)n.nodeValue=o;
}
function arEl(e){for(const a of ['placeholder','title','aria-label']){const v=e.getAttribute&&e.getAttribute(a);if(v){const x=arT(v);if(x!=null)e.setAttribute(a,x)}}}
function arWalk(root){
 if(!ARL.on||!root)return;
 if(root.nodeType===3){arNode(root);return}
 if(root.nodeType!==1)return;arEl(root);
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;
 while(n=w.nextNode()){if(n.nodeType===3)arNode(n);else arEl(n)}
}
const arObs=new MutationObserver(ms=>{if(!ARL.on)return;for(const m of ms){if(m.type==='characterData')arNode(m.target);else if(m.type==='attributes')arEl(m.target);else m.addedNodes.forEach(arWalk)}});
function arApply(on){
 ARL.on=on;const h=document.documentElement;h.lang=on?'ar':'en';h.dir=on?'rtl':'ltr';
 const b=document.getElementById('langbtn');if(b){b.textContent=on?'EN':'عربي';b.title=on?'English':'العربية'}
 arObs.disconnect();if(on){arObs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});arWalk(document.body)}
}
function arToggle(){
 const on=!ARL.on;try{localStorage.setItem('lang',on?'ar':'en')}catch(e){}
 arApply(on);if(on)return;
 /* back to English: draw the header, menu and page again from their English source */
 if(ALL&&D){try{head()}catch(e){}route()}
}
(function(){let s=null;try{s=localStorage.getItem('lang')}catch(e){}
 const on=s?s==='ar':/^ar\b/i.test(navigator.language||'');arApply(on)})();
"""

_X_ARCSS = ("html[dir=rtl] body{font-family:system-ui,-apple-system,\"Segoe UI\",Tahoma,\"Noto Sans Arabic\",sans-serif}"
            "html[dir=rtl] th,html[dir=rtl] td{text-align:right}html[dir=rtl] td.n,html[dir=rtl] th.n{text-align:left}"
            "html[dir=rtl] svg{direction:ltr}html[dir=rtl] ul{margin-left:0!important;margin-right:18px!important}"
            "#langbtn{min-height:32px;padding:4px 10px;font-size:13px;color:var(--tx)}")


def _x_ar_index(html):
    def sub(h, old, new):
        if h.count(old) != 1:
            log(f"  تنبيه (عربي): ما لقيت نقطة التعديل بدقة، تخطيتها: {old[:60]}")
            return h
        return h.replace(old, new)
    js = ("const AR=" + json.dumps(_AR_DICT, ensure_ascii=False) + ";\nconst AR_INJ=" + json.dumps(_AR_INJ, ensure_ascii=False)
          + ";\nconst AR_MON=" + json.dumps(_AR_MON, ensure_ascii=False) + ";\nconst AR_DAY=" + json.dumps(_AR_DAY, ensure_ascii=False)
          + ";\n" + _X_ARJS_CODE)
    h = html
    h = sub(h, "</style></head>", _X_ARCSS + "</style></head>")
    h = sub(h, '<span id="lg">Loading…</span></div>',
            '<span style="display:flex;align-items:center;gap:8px"><span id="lg">Loading…</span>'
            '<button id="langbtn" class="s" onclick="arToggle()">عربي</button></span></div>')
    h = sub(h, "async function route(){", js + "\nasync function route(){")
    return h


INDEX = _x_ar_index(INDEX)
# ======================== نهاية إضافة الواجهة العربية ========================



if __name__ == "__main__":
    main()
