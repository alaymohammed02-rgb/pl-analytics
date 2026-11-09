# Positions from the official line-ups (the SLOTPOS block of sync.py). Hand-made cases for the rule (a striker labelled MF becomes FW, an attacking midfielder labelled FW
# becomes MF, a player with no label gets the line he started in most, defenders and goalkeepers keep their label, too few starts or a split record change nothing), the
# database step on a small made-up league (with a fake line-up file, never the network), then the real files of the six leagues: the labels a second implementation gives
# equal the step's, nobody labelled DF or GK is touched, the result does not change when the rule is applied to its own output, and it is skipped for a finished season.
import os, re, sys, json, sqlite3, collections, tempfile
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
blk = src[src.index('# SLOTPOS START'):src.index('# SLOTPOS END')]
J = lambda f: json.load(open(os.path.join(REPO, 'data', f), encoding='utf-8'))
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


TMP = tempfile.mkdtemp()
DBP = os.path.join(TMP, 't.db')
LOGS, FILES = [], {}


def db():
    c = sqlite3.connect(DBP)
    c.row_factory = sqlite3.Row
    return c


def q(sql, args=(), one=False):
    c = db()
    rows = [dict(r) for r in c.execute(sql, args).fetchall()]
    c.close()
    return (rows[0] if rows else None) if one else rows


G = {'re': re, 'json': json, 'db': db, 'q': q, 'log': lambda *a: LOGS.append(' '.join(map(str, a))), 'safe_name': lambda s: s,
     'gh_get_json': lambda hub, path: FILES.get(path), 'DQ': dict(hub={'x': 1}, map=None, q={}, done=set())}
exec(blk, G)
fix, line, changes = G['dq_slot_fix'], G['dq_slot_line'], G['dq_slot_changes']

# --- the rule, by hand
ok([line(s) for s in (11, 30, 34, 39, 40, 64, 86, 99, 100, 105, 115, 'x', None)] == ['GK', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', None, None],
   'slots: 11 goalkeeper, 30-39 defence, other slots below 100 midfield, 100+ the front line')
ok(fix('MF', {'FW': 10}) == 'FW' and fix('MF', {'FW': 6, 'MF': 4}) == 'FW', 'a striker labelled MF with 10 of 10 (or 6 of 10) starts up front becomes FW')
ok(fix('MF', {'FW': 5, 'MF': 5}) is None and fix('MF', {'FW': 59, 'MF': 41}) is None, 'under 60% of the starts up front: the label stays')
ok(fix('MF', {'FW': 2}) is None and fix(None, {'FW': 2}) is None, 'two starts are too few to change anything')
ok(fix('FW', {'MF': 9}) == 'MF' and fix('FW', {'FW': 9}) is None, 'labelled FW but starting in midfield: MF; a forward who starts up front keeps FW')
ok(fix('DF', {'MF': 12}) is None and fix('DF', {'FW': 12}) is None and fix('GK', {'MF': 5}) is None, 'a defender (a wing-back in a midfield slot) and a goalkeeper keep their label')
ok(fix(None, {'DF': 4}) == 'DF' and fix(None, {'MF': 3, 'FW': 1}) == 'MF' and fix('', {'GK': 3}) == 'GK', 'a player with no label gets the line he started in most')
ok(fix('MF', {'MF': 20}) is None and fix('MF', {}) is None and fix('MF', None) is None, 'nothing to change: no change')
xi = lambda *a: [[p, 'n', '9', s, 0.5, 0.5, 0] for p, s in a]
MXT = {'m%d' % i: {'lu': {'h': {'xi': xi(('st', 115), ('am', 86), ('wb', 62), ('new', 34), ('gk', 11))}, 'a': {'xi': xi(('sub', 105))}}} for i in range(4)}
MXT['m9'] = {'mo': [1, 2]}                                    # a match with no line-up
MXT['m8'] = {'lu': {'h': {'xi': [['st'], None, ['am', 'n', '8', 'x']]}, 'a': None}}   # broken entries are passed over
cur = {'st': 'MF', 'am': 'FW', 'wb': 'DF', 'new': None, 'gk': 'GK', 'sub': 'MF', 'bench': 'MF'}
ok(changes(cur, MXT) == {'st': 'FW', 'am': 'MF', 'new': 'DF', 'sub': 'FW'}, 'a made-up league: the striker, the number ten, the unlabelled defender and the winger change; the wing-back, the keeper and a player who never started do not')
ok(changes({'st': 'MF'}, {'m1': MXT['m1'], 'm2': MXT['m2']}) == {}, 'the same striker with two line-ups only: no change yet')
ok(changes(dict(cur, **changes(cur, MXT)), MXT) == {}, 'applying the rule to its own result changes nothing')

# --- the database step
c = db()
c.execute('CREATE TABLE stats(league_id TEXT, match_id TEXT, player_id TEXT, pos TEXT)')
rows = []
for L in ('LG', 'LG_2025-26'):
    for p, o in cur.items():
        for i in range(5):
            rows.append((L, 'm%d' % i, p, None if (p == 'st' and i == 4) else o))   # one row of the striker has no label: his label is the commonest one
c.executemany('INSERT INTO stats VALUES(?,?,?,?)', rows)
c.commit(); c.close()
FILES['data/LG_mx.json'] = {'m': MXT}
FILES['data/LG_2025-26_mx.json'] = {'m': MXT}
n = G['dq_apply_slot_positions']('LG')
got = {r['player_id']: r['pos'] for r in q("SELECT DISTINCT player_id, pos FROM stats WHERE league_id='LG'")}
ok(n == 4 and got == {'st': 'FW', 'am': 'MF', 'wb': 'DF', 'new': 'DF', 'gk': 'GK', 'sub': 'FW', 'bench': 'MF'}, 'the step writes the four new labels on every row of those players (%d changed)' % n)
ok(len(LOGS) == 1 and '4' in LOGS[0], 'and logs one line with the count')
ok(G['dq_apply_slot_positions']('LG') == 0, 'a second call in the same run does nothing')
G['DQ']['done'].clear()
ok(G['dq_apply_slot_positions']('LG') == 0, 'a new run on the corrected table changes nothing')
ok(G['dq_apply_slot_positions']('LG_2025-26') == 0 and {r['pos'] for r in q("SELECT pos FROM stats WHERE league_id='LG_2025-26' AND player_id='st'")} == {'MF', None},
   'a finished season (id ending in a season) is left alone')
G['DQ']['done'].clear(); FILES['data/LG_mx.json'] = None
ok(G['dq_apply_slot_positions']('LG') == 0, 'a line-up file that cannot be read: nothing happens')
G['DQ']['done'].clear(); G['DQ']['hub'] = None; FILES['data/LG_mx.json'] = {'m': MXT}
ok(G['dq_apply_slot_positions']('LG') == 0, 'no hub (a local run): nothing happens')

# --- the real files, against a second implementation (a table of player-starts instead of nested counts)
IDX = J('index.json')
tot = collections.Counter()
bad = touched_dfgk = notidem = 0
names = []
for l in IDX['leagues']:
    if not l.get('pl_file') or not l.get('mx_file') or not l.get('sh_file') or re.search(r'cup|champions|europa|conference', l['name'], re.I):
        continue
    d, mx = J(l['pl_file']), J(l['mx_file'])['m']
    ix = {k: i for i, k in enumerate(d['cols'])}
    lab = collections.defaultdict(collections.Counter)
    nm = {}
    for r in d['rows']:
        nm[r[ix['i']]] = r[ix['n']]
        if r[ix['o']]:
            lab[r[ix['i']]][r[ix['o']]] += 1
        else:
            lab[r[ix['i']]]
    cur = {p: (sorted(e.items(), key=lambda x: (-x[1], x[0]))[0][0] if e else None) for p, e in lab.items()}
    starts = [(x[0], x[3]) for m in mx.values() for s in 'ha' for x in (((m.get('lu') or {}).get(s) or {}).get('xi') or [])]
    exp = {}
    for p in cur:
        mine = [s for q_, s in starts if q_ == p]
        if len(mine) < 3:
            continue
        cnt = collections.Counter('GK' if s == 11 else 'DF' if 30 <= s <= 39 else 'FW' if s >= 100 else 'MF' for s in mine)
        top, c2 = sorted(cnt.items(), key=lambda x: (-x[1], x[0]))[0]
        if c2 < 0.6 * len(mine):
            continue
        new = top if cur[p] is None else 'FW' if (top, cur[p]) == ('FW', 'MF') else 'MF' if (top, cur[p]) == ('MF', 'FW') else None
        if new and new != cur[p]:
            exp[p] = new
    ch = changes(cur, mx)
    if ch != exp:
        bad += 1
    touched_dfgk += sum(1 for p in ch if cur[p] in ('DF', 'GK'))
    if changes(dict(cur, **ch), mx):
        notidem += 1
    for p, g in ch.items():
        tot[(cur[p] or 'none', g)] += 1
    if l['id'] == 'l_4WFCIZ':
        names = sorted(nm[p] for p, g in ch.items() if g == 'FW' and cur[p] == 'MF')[:6]
ok(bad == 0, 'the six leagues: the step gives the labels of a second implementation (%d leagues differ)' % bad)
ok(touched_dfgk == 0 and notidem == 0, 'nobody labelled DF or GK is changed, and the rule applied to its own result changes nothing')
after = sum(tot.values())
print('     with today\'s files the rule would change: ' + (', '.join('%s -> %s: %d' % (a, b, n) for (a, b), n in sorted(tot.items())) or 'nothing (already applied)'))
if names:
    print('     Premier League, MF -> FW: ' + ', '.join(names))
ok(all(b in ('GK', 'DF', 'MF', 'FW') for (_, b) in tot), 'every new label is one of the four (%d players would change today)' % after)
print('%d FAILED' % fails if fails else 'all passed')
raise SystemExit(1 if fails else 0)
