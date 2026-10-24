# The offline builder (tools/sb-press/build_press.py) on the hand-made fixture, with the numbers worked out by hand, and the shape and
# internal consistency of the committed data/sb_press.json.
import os, sys, json, tempfile, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(REPO, 'tools', 'sb-press'))
os.environ['SBP_CACHE'] = tempfile.mkdtemp()
import fixture as F, build_press as bp
fails = 0
def ok(c, m):
    global fails
    if not c: fails += 1; print('FAIL', m)
    else: print('ok  ', m)
def fake(url, tries=4):
    if url.endswith('/events/1.json'): return F.EVENTS
    if url.endswith('/lineups/1.json'): return F.LINEUPS
    if url.endswith('/matches/7/3.json'): return F.MATCHES
    if url.endswith('/competitions.json'): return F.COMPETITIONS
    raise RuntimeError(url)
bp.get = fake
r = bp.one_match(1)
# possession by time: Alpha 30+10+3 (events 0-2) + 48+10 (events 6-8) = 101 s, Beta 47+10+2 = 59 s; the last event adds nothing
ok(abs(r['share']['Alpha'] - 101 / 160 * 100) < 1e-9 and abs(r['share']['Beta'] - 59 / 160 * 100) < 1e-9, 'possession by time: Alpha 63.1 %, Beta 36.9 %')
P = {p['id']: p for p in r['players']}
ok(set(P) == {1, 2, 11, 12}, 'the four players of the lineups')
ok(P[1]['n'] == 'Ace' and P[2]['n'] == 'Ben Alpha Two' and P[12]['n'] == 'Dano', 'the common name when there is one, the official name otherwise')
ok(abs(P[1]['mi'] - 160 / 60) < 1e-2 and abs(P[2]['mi'] - 1.0) < 1e-9, 'minutes from the position spells (a spell without an end lasts to the last event, 160 s)')
ok(P[1]['pos'] == 'Center Forward' and P[2]['pos'] == 'Center Back', 'main position')
ok(abs(P[11]['adj'] - 50 / (101 / 160 * 100)) < 1e-3 and abs(P[1]['adj'] - 50 / (59 / 160 * 100)) < 1e-3, 'adjustment = 50 ÷ the opponent\'s share of the ball (Beta 0.792, Alpha 1.356)')
c = lambda i: P[i]['c']
ok(c(11) == {'pr': 1, 'prr': 1, 'cp': 0, 'cpr': 0, 'ti': 0, 'rec': 0}, 'Beta 1: a pressure, and Beta has the ball 3 s later: a regain, not a counterpress')
ok(c(1) == {'pr': 1, 'prr': 1, 'cp': 1, 'cpr': 1, 'ti': 0, 'rec': 0}, 'Alpha 1: a counterpress, Alpha has the ball 2 s later: a counterpress regain')
ok(c(2)['ti'] == 1 and c(2)['pr'] == 0, 'Alpha 2: an interception')
ok(c(12)['rec'] == 1, 'Beta 2: a ball recovery')
ok(P[11]['h'][5 * 8 + 1] == 1 and sum(P[11]['h']) == 1 and P[1]['h'][11 * 8 + 4] == 1 and sum(P[1]['h']) == 1, 'pressure grid: [50,10] in cell 5,1 and [110,40] in cell 11,4 of 12 × 8')
# a pressure with no ball for the pressing team within 5 s is not a regain: move the next event 8 s away
E2 = json.loads(json.dumps(F.EVENTS)); E2[3]['timestamp'] = '00:00:48.000'; E2[3]['second'] = 48
bp.get = lambda url, tries=4: E2 if url.endswith('/events/1.json') else fake(url)
bp.CACHE = tempfile.mkdtemp(); r2 = bp.one_match(1)
ok({p['id']: p for p in r2['players']}[11]['c']['prr'] == 0, 'a regain after 8 s is not counted (5 s rule)')
# the whole run on the fixture
bp.get = fake; bp.CACHE = tempfile.mkdtemp(); bp.WANT = [(7, 3, 1)]; bp.MIN_MINUTES = 0
out = os.path.join(tempfile.mkdtemp(), 'o.json'); bp.main(out); d = json.load(open(out))
pl = {p[0]: p for p in d['comps'][0]['players']}
ok(d['comps'][0]['name'] == 'Test Cup' and set(pl) == {1, 2, 11, 12}, 'the file has the competition and its four players')
ok(all(len(p) == 9 and p[3] in ('GK', 'CB', 'FB', 'MID', 'WING', 'FWD') for p in pl.values()), 'each player: 9 fields and a known position group')
ok(pl[1][3] == 'FWD' and pl[11][3] == 'MID' and pl[12][3] == 'FB', 'position groups from the position names')
ok(abs(pl[1][7][2] - 1 * 50 / (59 / 160 * 100)) < 1e-2, 'adjusted counts = the counts × the match\'s factor (Alpha 1 counterpress: 1.356)')
# the committed data file
D = json.load(open(os.path.join(REPO, 'data', 'sb_press.json')))
ok(D['metrics'] == ['pr', 'prr', 'cp', 'cpr', 'ti', 'rec'] and D['grid'] == [12, 8] and len(D['comps']) >= 4, 'data/sb_press.json: %d tournaments' % len(D['comps']))
bad = []
for C in D['comps']:
    for p in C['players']:
        id_, name, team, g, mi, gp, raw, adj, grid = p
        if mi < 90 or g not in ('GK', 'CB', 'FB', 'MID', 'WING', 'FWD') or len(raw) != 6 or len(adj) != 6 or len(grid) != 96: bad.append((C['name'], name, 'shape'))
        for a, b in zip(raw, adj):
            if a < 0 or b < 0 or (a == 0 and b != 0) or (a > 0 and not (a * 50 / 80 - 0.02 <= b <= a * 50 / 20 + 0.02)): bad.append((C['name'], name, 'adjusted vs raw'))
        if sum(grid) > raw[0] or sum(grid) < raw[0] * 0.97: bad.append((C['name'], name, 'grid vs pressures'))
        if raw[1] > raw[0] or raw[2] > raw[0] or raw[3] > raw[2] or raw[3] > raw[1]: bad.append((C['name'], name, 'regains and counterpresses within pressures'))
ok(not bad, 'every player: shape, adjusted within the 50/80..50/20 factor of raw, the grid adds up to his pressures, regains ≤ pressures %s' % bad[:3])
ok(all(len({p[0] for p in C['players']}) == len(C['players']) for C in D['comps']), 'no player twice in a tournament')
print('all passed' if not fails else '%d FAILED' % fails); sys.exit(1 if fails else 0)
