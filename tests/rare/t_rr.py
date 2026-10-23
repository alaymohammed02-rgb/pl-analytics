"""Very rare cases: rarity rules, cases recomputed independently from the raw files, the database path, the sync step."""
import json, math, re, datetime, sys, sqlite3, collections
sys.path.insert(0, '/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/rare')
import rr_local as RL
G = RL.G
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
strip = lambda s: re.sub('<[^>]+>', '', s).replace('&amp;', '&')
matches, shots, club, plrows, ratings, rnames, names, idx = RL.load()
now = datetime.datetime(2026, 10, 22, 12, tzinfo=datetime.timezone.utc)
out = G['rr_compute'](matches, shots, club, plrows, ratings, rnames, names, now)
allc = [c for v in out['leagues'].values() for c in v['rare'] + v['near']]
WC = [l for l, n in names.items() if 'World Cup' in n]
# ---- rules ----
ok(not any(l in out['leagues'] for l in WC), 'the World Cup is left out')
fin = [m for m in matches if m['l'] not in WC and re.match(r'^\d+-\d+$', m['s'] or '')]
ok(out['pools']['sh'] == len(fin) and out['pools']['rt'] <= len(fin), f"pools: {out['pools']} of {len(fin)} finished matches")
ok(all(c['n'] / c['N'] <= 1 / 380 for v in out['leagues'].values() for c in v['rare']), 'every "very rare" case: at most once every 380 matches')
ok(all(1 / 380 < c['n'] / c['N'] <= 1 / 150 for v in out['leagues'].values() for c in v['near']), '"almost": between once every 380 and once every 150 matches')
ok(all(v['rare'] == sorted(v['rare'], key=lambda c: (c['p'], c['k'], c['m'])) for v in out['leagues'].values()), 'rarest first')
ok(all(not v['near'] or len(v['rare']) < 3 for v in out['leagues'].values()), '"almost" only where a league has fewer than 3 very rare cases')
M = {(m['l'], m['m']): m for m in matches}
ok(all(c['d'] == str(M[(c['l'], c['m'])]['d'])[:10] for c in allc), 'each case dated by its match')
# ---- independent recomputation from the raw files ----
D = '/home/user/pl-analytics/data/'
def per_match(vals, up=True):     # {match: value} → k for a value
    L = list(vals.values())
    return lambda v: sum(1 for x in L if (x >= v - 1e-9 if up else x <= v + 1e-9))
# player numbers: per-match maximum over players, matches with player rows
pl = collections.defaultdict(list)
for r in plrows:
    if r['l'] in WC: continue
    if (r['l'], r['m']) in M and re.match(r'^\d+-\d+$', M[(r['l'], r['m'])]['s'] or ''): pl[(r['l'], r['m'])].append(r)
for f in ['ast', 'kp', 'sca', 'pr', 'ps', 'tkw', 'tk', 'ic', 'bl', 'cl', 'aerw']:
    mx = {k: max((r[f] for r in rows if r.get(f) is not None), default=None) for k, rows in pl.items()}
    mx = {k: v for k, v in mx.items() if v is not None}
    K = per_match(mx)
    for c in [c for c in allc if c['k'] == 'pl_' + f]:
        v = mx[(c['l'], c['m'])]
        who = [r for r in pl[(c['l'], c['m'])] if r.get(f) == v][0]
        ok(c['n'] == K(v) and c['N'] == len(pl) and who['n'] in strip(c['en']) and f" {int(v)} " in strip(c['en']), f"{f}: {strip(c['en'])} — {K(v)} of {len(pl)} matches")
dry = {k: max((r['sh'] for r in rows if r.get('sh') and not r.get('gl')), default=0) for k, rows in pl.items()}
for c in [c for c in allc if c['k'] == 'pl_shdry']:
    ok(c['n'] == per_match(dry)(dry[(c['l'], c['m'])]), 'shots without scoring: ' + strip(c['en']))
# ratings: per-match maximum
rt = collections.defaultdict(float)
for (l, m, p), v in ratings.items():
    if l not in WC and (l, m) in M and re.match(r'^\d+-\d+$', M[(l, m)]['s'] or ''): rt[(l, m)] = max(rt[(l, m)], v)
for c in [c for c in allc if c['k'] == 'rating']:
    v = rt[(c['l'], c['m'])]
    ok(c['n'] == per_match(rt)(v) and f"{v:.2f}" in strip(c['en']), f"rating: {strip(c['en'])} — {per_match(rt)(v)} of {len(rt)}")
# shots: team shots without a goal, long-range goals, latest goals (raw shot rows, the official score)
raw = collections.defaultdict(list)
for r in shots:
    if r['l'] not in WC and r.get('pd') != 'PenaltyShootout' and r.get('mn') is not None: raw[(r['l'], r['m'])].append(r)
side = lambda r, m: r['c'] if r['c'] in (m['h'], m['a']) else club.get((r['l'], r['m'], r.get('pid')))
dn, far, late = {}, {}, {}
for k, rows in raw.items():
    m = M[k]; g = [int(x) for x in m['s'].split('-')]
    v = 0
    for t, gg in ((m['h'], g[0]), (m['a'], g[1])):
        if gg == 0: v = max(v, sum(1 for r in rows if not r.get('og') and side(r, m) == t))
    dn[k] = v
    far[k] = max([math.hypot(105 - r['x'], 34 - r['y']) for r in rows if r.get('ev') == 'Goal' and not r.get('og') and r.get('st') != 'Penalty' and (r.get('xg') or 0) <= 0.1 and r.get('x') is not None] or [-1])
    late[k] = max([r.get('ma') or 0 for r in rows if (r.get('ev') == 'Goal' or r.get('og')) and r.get('pd') == 'SecondHalf' and r['mn'] >= 90 and not r.get('og')] or [-1])
for fam, tab, fmt in (('dry_n', dn, lambda v: f"took {v} shots"), ('far', far, lambda v: f"about {round(v)} metres"), ('late', late, lambda v: f"90+{int(v)}'")):
    for c in [c for c in allc if c['k'] == fam]:
        v = tab[(c['l'], c['m'])]
        ok(c['n'] == per_match(tab)(v) and fmt(v) in strip(c['en']), f"{fam}: {strip(c['en'])} — {per_match(tab)(v)} of {len(tab)} (raw shots)")
ok(len(allc) >= 10 and len({c['k'] for c in allc}) >= 10, f"{len(allc)} cases of {len({c['k'] for c in allc})} kinds across {len(out['leagues'])} competitions")
ok(all('<bdi' in c['ar'] and re.search('[؀-ۿ]', c['ar']) for c in allc), 'every case written in Arabic too, names isolated')
# ---- the database path gives the same answer ----
con = sqlite3.connect(':memory:'); con.row_factory = sqlite3.Row
con.executescript('''CREATE TABLE matches(league_id,match_id,date,home,away,score);CREATE TABLE stats(league_id,match_id,player_id,player,club);
CREATE TABLE shot_rows(league_id,match_id,pd,pid,pn,tid,x,y,xg,ev,st,ty,mn,ma,og,ib);CREATE TABLE team_adv(league_id,match_id,team_id,team);
CREATE TABLE pl_adv(league_id,match_id,player_id,player,team_id,ast,kp,sca,pr,ps,tkw,tk,ic,bl,cl,aerw,sh,gl);''')
con.executemany('INSERT INTO matches VALUES(?,?,?,?,?,?)', [(m['l'], m['m'], m['d'], m['h'], m['a'], m['s']) for m in matches])
con.executemany('INSERT INTO stats VALUES(?,?,?,?,?)', [(l, m, i, rnames.get((l, m, i), (None,))[0], c) for (l, m, i), c in club.items()])
tids = {}
for r in shots:
    con.execute('INSERT INTO shot_rows VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (r['l'], r['m'], r.get('pd'), r.get('pid'), r.get('pn'), r.get('c'), r.get('x'), r.get('y'), r.get('xg'), r.get('ev'), r.get('st'), r.get('ty'), r.get('mn'), r.get('ma'), r.get('og'), r.get('ib')))
for lg in idx['leagues']:
    if lg.get('adv_file'):
        con.executemany('INSERT INTO team_adv VALUES(?,?,?,?)', [(lg['id'], t['m'], t['i'], t['n']) for t in json.load(open(D + lg['adv_file']))['team']])
con.executemany('INSERT INTO pl_adv VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [(r['l'], r['m'], r['i'], r['n'], r.get('t'), r.get('ast'), r.get('kp'), r.get('sca'), r.get('pr'), r.get('ps'), r.get('tkw'), r.get('tk'), r.get('ic'), r.get('bl'), r.get('cl'), r.get('aerw'), r.get('sh'), r.get('gl')) for r in plrows])
G['q'] = lambda sql, args=(), one=False: [dict(x) for x in con.execute(sql, args).fetchall()]
files = {'data/index.json': idx}
for lg in idx['leagues']:
    if lg.get('rt_file'): files['data/' + lg['rt_file']] = json.load(open(D + lg['rt_file']))
written = []
G['gh_get_json'] = lambda hub, p: files.get(p)
G['gh_put'] = lambda hub, p, c, msg: written.append((p, c))
out2 = G['rr_compute'](*G['_rr_from_db'](None), now)
same = lambda a, b: json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
ok(same(out2['pools'], out['pools']) and same({l: [(c['k'], c['m'], c['n']) for c in v['rare']] for l, v in out2['leagues'].items()}, {l: [(c['k'], c['m'], c['n']) for c in v['rare']] for l, v in out['leagues'].items()}),
   'the database path (the sync) finds the same cases as the files')
# ---- the sync step: written once, skipped when unchanged, announced in the index ----
G['_rr_from_db'] = lambda hub: (matches, shots, club, plrows, ratings, rnames, names)
G['LV_HAVE'].clear(); written.clear(); G['sync_rare']({}, now)
ok(len(written) == 1 and written[0][0] == 'data/rare.json' and G['LV_HAVE'].get('rr') == json.loads(written[0][1])['h'], 'sync: data/rare.json written, its version announced for the index')
files['data/rare.json'] = json.loads(written[0][1]); written.clear(); G['LV_HAVE'].clear(); G['sync_rare']({}, now)
ok(not written and G['LV_HAVE'].get('rr') == files['data/rare.json']['h'], 'sync: unchanged data → nothing rewritten, same version announced')
json.dump(out, open('/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/rare/rare.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f"{fails} FAILED" if fails else 'all passed'); sys.exit(1 if fails else 0)
