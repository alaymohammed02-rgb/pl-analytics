

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


_X_CMPCSS = "@@CSS@@"
_X_CMPJS = r"""@@JS@@"""


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


_AR_SEASON.update(@@AR@@)


INDEX = _x_cmp_index(INDEX)
# ======================== نهاية إضافة البطولات ========================
