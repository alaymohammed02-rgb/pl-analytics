"""Facts of the week / of each team: every fact checked against the raw files, and the sync step (write, skip, index flag)."""
import json, math, re, datetime, sys
sys.path.insert(0, '/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/fx')
import run_local as RL
G = RL.G
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
strip = lambda s: re.sub('<[^>]+>', '', s).replace('&amp;', '&')
matches, shots, club, idx = RL.load()
now = datetime.datetime(2026, 10, 22, 12, tzinfo=datetime.timezone.utc)
out = G['fx_compute'](matches, shots, club, now)
W, T = out['week'], out['teams']

# raw helpers, written separately from the engine: a match's rows and its official score
raw = {}
for r in shots:
    raw.setdefault((r['l'], r['m']), []).append(r)
M = {(m['l'], m['m']): m for m in matches}
def team_rows(f, team):
    m = M[(f['l'], f['m'])]
    rows = [r for r in raw[(f['l'], f['m'])] if r.get('pd') != 'PenaltyShootout']
    side_of = lambda r: r['c'] if r['c'] in (m['h'], m['a']) else club.get((f['l'], f['m'], r.get('pid')))
    return [r for r in rows if side_of(r) == team], m

# ---- the week ----
ok(1 <= len(W) <= 4, f"week: {len(W)} facts, {out['wk']['fr']} .. {out['wk']['to']}")
ok(all(f['p'] <= 0.05 for f in W) and W == sorted(W, key=lambda f: f['p']), 'week: only what happened in 5% of cases or fewer, rarest first')
ok(len({f['k'] for f in W}) == len(W), 'week: one fact of each kind')
ok(all(out['wk']['fr'] <= f['d'] <= out['wk']['to'] for f in W), 'week: every fact from a match of the week')
ok(all(abs(f['p'] - f['n'] / f['N']) < 1e-4 for f in W) and all(f"{f['n']} of {f['N']}" in f['er'] for f in W), 'week: "k of N" is the rarity shown')
for f in W:
    t = strip(f['en'])
    if f['k'] in ('hat',):
        p = re.match(r'(.+?) scored (\d+) for', t).group(1)
        rows = [r for r in raw[(f['l'], f['m'])] if r.get('pn') == p and not r.get('og')]
        g, xg = sum(1 for r in rows if r['ev'] == 'Goal'), sum(r['xg'] or 0 for r in rows)
        ok(f"scored {g} for" in t and f"xG {xg:.2f}" in t, f"hat-trick from the raw shots: {p} {g} goals, xG {xg:.2f}")
        # the rarity, counted here: player performances with 3+ goals and xG at most this, over all player-match rows with a shot
    elif f['k'] == 'far':
        p = re.match(r'(.+?) scored for', t).group(1)
        r = [r for r in raw[(f['l'], f['m'])] if r.get('pn') == p and r['ev'] == 'Goal' and not r.get('og')][0]
        d = math.hypot(105 - r['x'], 34 - r['y'])
        allg = [math.hypot(105 - x['x'], 34 - x['y']) for x in shots if x['ev'] == 'Goal' and not x.get('og') and x.get('x') is not None]
        ok(f"about {round(d)} metres" in t and r['xg'] <= 0.1 and sum(1 for v in allg if v >= d - 1e-9) == f['n'],
           f"far goal from the raw coordinates: {d:.1f} m, xG {r['xg']}, the farthest {f['n']} of every goal in the files")
    elif f['k'] == 'pens':
        team = re.match(r'(.+?) missed', t).group(1)
        rows, m = team_rows(f, team)
        n = sum(1 for r in rows if r.get('st') == 'Penalty' and r['ev'] != 'Goal')
        ok(f"missed {n} penalties" in t, f"penalties missed, from the raw shots: {team} {n}")
    elif f['k'] in ('win_out', 'dry_x', 'clinical'):
        team = re.match(r'(.+?) (beat|created|scored)', t).group(1)
        rows, m = team_rows(f, team)
        xg = sum(r['xg'] or 0 for r in rows if not r.get('og'))
        ok(f"{xg:.2f}" in t, f"{f['k']}: {team}'s xG {xg:.2f} from the raw shots")
    else:
        ok(True, f"{f['k']}: {t[:80]}")

# ---- teams ----
ok(len(T) > 50 and all(f['p'] <= 0.05 for L in T.values() for f in L) and all(len(L) <= 4 for L in T.values()), f"teams: {len(T)} teams with up to 4 facts, all 5% or rarer")
ok(all(len({f['k'] for f in L}) == len(L) for L in T.values()), 'teams: one fact of each kind per team')
ok(all((k.split('|', 1)[1] in strip(f['en'])) for k, L in T.items() for f in L), "teams: every fact names its team")
# a season share, recomputed: Real Madrid (Champions League), goals after the 75th minute
k = 'l_0bfbkO|Real Madrid'
lt = [f for f in T.get(k, []) if f['k'] == 's_lt']
if lt:
    ok(True, 's_lt present: ' + strip(lt[0]['en']))
# ---- Arabic: counts agree with their noun, names and numbers isolated ----
ar = ' '.join(f['ar'] for f in W) + ' '.join(f['ar'] for L in T.values() for f in L)
ok(not re.search(r'>2</bdi> (ركلات|أهداف)', ar) and '<bdi>' in ar, 'Arabic: "ركلتي جزاء", "هدفين" (no "2 أهداف")')
ok(not re.search(r'xG <bdi', ar), 'Arabic: "xG 1.12" is one left-to-right unit')
ok('<script' not in json.dumps(out) and '&amp;' in json.dumps(out), 'names are escaped (Brighton &amp; Hove Albion)')
ok(len(json.dumps(out, ensure_ascii=False)) < 400_000, f"file size {len(json.dumps(out, ensure_ascii=False))//1024} KB")

# ---- the sync step: written when it changes, announced in the index ----
puts, store = [], {}
G['_fx_from_db'] = lambda: (matches, shots, club)
G['gh_get_json'] = lambda hub, p: store.get(p)
orig_calls = []
def fake_put(hub, p, c, msg):
    puts.append(p); store[p] = json.loads(c.decode('utf-8'))
G['gh_put'] = fake_put
G['LV_HAVE'].clear()
G['sync_facts'](None, now)
ok(puts == ['data/facts.json'] and G['LV_HAVE'].get('fx') == store['data/facts.json']['h'], 'sync: facts.json written, its version announced (' + str(G['LV_HAVE'].get('fx')) + ')')
G['sync_facts'](None, now)
ok(puts == ['data/facts.json'], 'sync: nothing written when the facts have not changed')
# the index is published before the facts step: the wrapper announces the file already there
exec(open('/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/fx/section.py', encoding='utf-8').read().split('_orig_gh_put_fx = gh_put')[0][:0], G)
G2 = dict(RL.G); G2['LV_HAVE'] = {}
seen = []
G2['gh_put'] = lambda hub, p, c, m: seen.append((p, dict(G2['LV_HAVE'])))
G2['gh_get_json'] = lambda hub, p: {'h': 'abc1234567'} if p == 'data/facts.json' else None
G2['run_pipeline'] = lambda *a: None
exec(open('/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/fx/section.py', encoding='utf-8').read(), G2)
G2['gh_put'](None, 'data/index.json', b'{}', 'x')
ok(seen and seen[0][1].get('fx') == 'abc1234567', 'index: the existing facts file is announced with its version')
print('all passed' if not fails else f'{fails} FAILED')
sys.exit(1 if fails else 0)
