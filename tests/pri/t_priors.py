# Last season's strengths (the block between "PRIORS START" and "PRIORS END" in sync.py → data/priors.json): the per-club numbers worked
# by hand on a small made-up league (own goals left out, a match counts only when both sides have xG, unfinished matches left out),
# the real past seasons worked again with a separate implementation, and the sync step with GitHub stubbed (written, skipped when the
# season files are unchanged, cups left out, a season whose files cannot be read left out, an error never stopping the pipeline).
import os, re, sys, json, hashlib, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
block = src[src.index('# ===== PRIORS START ====='):src.index('# ===== PRIORS END =====')]
LOG = []; PUT = {}; STORE = {}
G = {'json': json, 're': re, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: 'ran',
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(block, G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
close = lambda a, b, t=1e-6: a is not None and abs(a - b) < t
# ---- worked by hand: 10 matches between A, B, C; shots (m, c, xg, og)
cols = ['m', 'c', 'xg', 'og']
teams = ['A', 'B', 'C']
matches, rows = [], []
for i in range(10):
    h, a = teams[i % 3], teams[(i + 1) % 3]
    matches.append({'i': 'm%d' % i, 'd': '2025-08-%02d' % (i + 1), 'h': h, 'a': a, 's': '1-0'})
    rows += [['m%d' % i, h, 1.0, 0], ['m%d' % i, a, 0.5, 0]]
rows.append(['m0', 'A', 9.0, 1])                     # an own goal's xG is not counted
rows.append(['m1', 'B', None, 0])                    # a shot without xG adds nothing
R = G['pr_compute']({'matches': matches}, {'cols': cols, 'rows': rows})
# A is home in m0, m3, m6, m9 (4 matches) and away in m2, m5, m8 (3): xG for = 4*1.0 + 3*0.5 = 5.5, against = 4*0.5 + 3*1.0 = 5.0
ok(R and R['n'] == 10 and close(R['teams']['A'][1], 5.5) and close(R['teams']['A'][2], 5.0) and R['teams']['A'][0] == 7, 'per club: 7 matches, xG for 5.5 and against 5.0 (own goal and the shot without xG left out)')
ok(close(R['mu'], (10 * 1.0 + 10 * 0.5) / 20), 'the league mean is the xG per team-match: %s' % R['mu'])
ok(sum(t[0] for t in R['teams'].values()) == 20, 'every match counts for both clubs (20 team-matches)')
m2 = matches + [{'i': 'x1', 'd': None, 'h': 'A', 'a': 'B', 's': '2-0'}, {'i': 'x2', 'd': '2025-09-01', 'h': 'A', 'a': 'B', 's': None}, {'i': 'x3', 'd': '2025-09-02', 'h': 'A', 'a': 'B', 's': '1-1'}]
R2 = G['pr_compute']({'matches': m2}, {'cols': cols, 'rows': rows + [['x3', 'A', 2.0, 0]]})
ok(R2['n'] == 10, 'no date, no score, or only one side with xG: the match is left out')
ok(G['pr_compute']({'matches': matches[:9]}, {'cols': cols, 'rows': rows}) is None, 'under 10 usable matches: nothing (None), never a guess')
ok(G['pr_score']('2–1') == (2, 1) and G['pr_score']('2-1') == (2, 1) and G['pr_score']('') is None and G['pr_score'](None) is None, 'scores: 2-1 and 2–1, empty and missing are not finished matches')
# ---- the real seasons, worked again
D = REPO + '/data/'
idx = json.load(open(D + 'index.json'))
def indep(lg_file, sh_file):
    L = json.load(open(D + lg_file)); S = json.load(open(D + sh_file)); c = {n: i for i, n in enumerate(S['cols'])}
    x = {}
    for r in S['rows']:
        if not r[c['og']] and r[c['xg']] is not None: x[(r[c['m']], r[c['c']])] = x.get((r[c['m']], r[c['c']]), 0) + r[c['xg']]
    tot = {}; n = 0; sh = sa = 0
    for m in L['matches']:
        g = re.match(r'^(\d+)-(\d+)$', (m.get('s') or '').replace('–', '-'))
        if not g or not m.get('d'): continue
        a, b = x.get((m['i'], m['h'])), x.get((m['i'], m['a']))
        if a is None or b is None: continue
        n += 1; sh += a; sa += b
        for t, f, ag in ((m['h'], a, b), (m['a'], b, a)):
            e = tot.setdefault(t, [0, 0.0, 0.0]); e[0] += 1; e[1] += f; e[2] += ag
    return n, (sh + sa) / (2 * n), tot
P = json.load(open(D + 'priors.json')); bad = []
six = [l for l in idx['leagues'] if l.get('sh_file') and not re.search(r'world cup|champions|europa|conference|cup', l['name'], re.I)]
for l in six:
    past = max([p for p in idx['seasons'][l['id']]['past'] if p.get('complete')], key=lambda p: p['s'])
    n, mu, tot = indep(past['file'], past['sh_file']); g = P['leagues'].get(l['id'])
    if not g or g['n'] != n or abs(g['mu'] - mu) > 1e-4 or g['season'] != past['s'] or set(g['teams']) != set(tot): bad.append(l['name']); continue
    for t, v in tot.items():
        if g['teams'][t][0] != v[0] or abs(g['teams'][t][1] - v[1]) > 1e-3 or abs(g['teams'][t][2] - v[2]) > 1e-3: bad.append(l['name'] + ' ' + t)
ok(not bad and len(six) == 6 and len(P['leagues']) == 6, 'data/priors.json: six leagues, last season\'s matches, mean and every club\'s xG for and against equal a second implementation %s' % bad[:3])
ok(all(l['cur'] == '2026-27' and l['season'] == '2025-26' for l in P['leagues'].values()), 'it says which season the numbers are from (2025-26) and which season they start (2026-27)')
# ---- the sync step with GitHub stubbed
past_by = {}
for l in six:
    past_by[l['id']] = [p for p in idx['seasons'][l['id']]['past']]
    for p in past_by[l['id']]:
        if p.get('complete') and p.get('file') and p.get('sh_file'):
            for f in (p['file'], p['sh_file']):
                if 'data/' + f not in STORE: STORE['data/' + f] = json.load(open(D + f))
cup = {'id': 'l_cup', 'name': 'Champions League', 'sh_file': 'x.json'}
STORE['data/index.json'] = {'leagues': [dict(l) for l in six] + [cup], 'seasons': dict({l['id']: {'cur': '2026-27', 'past': past_by[l['id']]} for l in six}, l_cup={'cur': '2026-27', 'past': past_by[six[0]['id']]})}
G['sync_priors'](None)
S = PUT.get('data/priors.json')
ok(S and set(S['leagues']) == {l['id'] for l in six} and 'l_cup' not in S['leagues'] and S['key'], 'sync_priors writes the six domestic leagues (not the cup) with a key')
ok(all(S['leagues'][k] == P['leagues'][k] for k in P['leagues']), 'and the numbers are the published file\'s')
n = len(PUT); G['sync_priors'](None); ok(len(PUT) == n, 'unchanged season files: nothing is computed or written again (same key)')
STORE['data/index.json']['seasons'][six[0]['id']]['past'] = [dict(p, sh_v='changed') if p.get('complete') else p for p in past_by[six[0]['id']]]
G['sync_priors'](None); ok(PUT['data/priors.json']['key'] != S['key'], 'a changed shot-file version recomputes it')
PUT.clear(); STORE.pop('data/priors.json')
lost = max([p for p in past_by[six[1]['id']] if p.get('complete')], key=lambda p: p['s'])['sh_file']
del STORE['data/' + lost]
G['sync_priors'](None); ok(set(PUT['data/priors.json']['leagues']) == {l['id'] for l in six} - {six[1]['id']} and any('ملفات الموسم ناقصة' in l for l in LOG), 'a season whose shot file cannot be read: that league is left out, the others are written, it is logged')
G['sync_priors'] = lambda hub, now=None: (_ for _ in ()).throw(RuntimeError('boom'))
ok(G['run_pipeline'](None, 'k') == 'ran' and any('boom' in l for l in LOG), 'run_pipeline: an error in the step is logged and the sync goes on')
print('all passed' if not fails else '%d failed' % fails)
sys.exit(1 if fails else 0)
