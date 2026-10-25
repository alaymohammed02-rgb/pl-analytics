# The Transfermarkt step of the sync (the block between "TRANSFERMARKT START" and "TRANSFERMARKT END" in sync.py): name folding, age, reading the open
# dataset's players table, the name matching (exact, accents, word order, same name twice, nothing found, an impossible age), which PitchAPI players are
# asked about (the six leagues and the World Cup, not the Champions League), and the write / skip / failure behaviour of the step with the download and
# GitHub stubbed. The CSV below is made up in the dataset's column layout (player_id, name, date_of_birth, market_value_in_eur, current_club_name, last_season...).
import os, re, sys, json, gzip, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
block = src[src.index('# ===== TRANSFERMARKT START ====='):src.index('# ===== TRANSFERMARKT END =====')]
LOG = []; PUT = {}; STORE = {}; FETCH = []
class _R: pass
G = {'os': os, 're': re, 'json': json, 'datetime': datetime, 'requests': _R,
     'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: True,
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(block, G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
norm, age, rows_of, match, players, sync = (G[k] for k in ('tm_norm', 'tm_age', 'tm_rows', 'tm_match', 'tm_players', 'sync_tm'))
# ---- names
ok(norm('Vinícius Júnior') == 'vinicius junior' and norm('Martin Ødegaard') == 'martin odegaard' and norm("N'Golo Kanté") == 'n golo kante' and norm('Łukasz Fabiański') == 'lukasz fabianski' and norm('Heung-min  Son') == 'heung min son', 'names fold accents, ø, ł, apostrophes and hyphens to plain lower-case words')
ok(norm(None) == '' and norm('') == '', 'no name: empty')
ok(age('2000-06-15', datetime.date(2026, 6, 14)) == 25 and age('2000-06-15', datetime.date(2026, 6, 15)) == 26 and age('2000-02-29', datetime.date(2026, 2, 28)) == 25, 'age: the day before the birthday is still the old age; leap-day birthdays')
# ---- the table
HEAD = 'player_id,name,date_of_birth,market_value_in_eur,current_club_name,last_season,position\n'
CSV = HEAD + '\n'.join([
 '1,Vinícius Júnior,2000-07-12,150000000.0,Real Madrid Club de Fútbol,2025,Attack',
 '2,Martin Ødegaard,1998-12-17,70000000.0,Arsenal Football Club,2025,Midfield',
 '3,Heung-min Son,1992-07-08,25000000.0,Los Angeles FC,2025,Attack',
 '4,José Gómez,1999-01-01,5000000.0,Real Madrid Club de Fútbol,2025,Defender',
 '5,José Gómez,1995-05-05,2000000.0,Sevilla Fútbol Club,2025,Defender',
 '6,Old Timer,1980-01-01,100000.0,Retired FC,2023,Attack',
 '7,No Value,2001-03-03,,Brighton and Hove Albion Football Club,2025,Attack',
 '8,Bad Date,not a date,1000000.0,Fulham Football Club,2025,Attack',
 '9,Ghost Player,1900-01-01,1000000.0,Fulham Football Club,2025,Attack',
 '10,Twin Name,1990-01-01,1000000.0,Club A,2025,Attack',
 '11,Twin Name,1991-01-01,1000000.0,Club B,2025,Attack',
 '12,Rodri,1996-06-22,110000000.0,Manchester City Football Club,2025,Midfield',
])
R = rows_of(CSV)
ok(len(R) == 11 and not any(r['n'] == 'old timer' for r in R), 'the table: 12 rows, the one who last played in 2023 is left out (11 active)')
ok([r['val'] for r in R if r['n'] == 'no value'] == [None] and [r['dob'] for r in R if r['n'] == 'bad date'] == [None] and [r['val'] for r in R if r['n'] == 'rodri'] == [110000000], 'an empty value is None, a bad date is None, a value is a whole number of euros')
try:
    rows_of('player_id,name\n1,x\n'); ok(False, 'a table without the date and value columns is refused')
except ValueError as e:
    ok('date_of_birth' in str(e) and 'market_value_in_eur' in str(e), 'a table without the date and value columns is refused, naming them')
# ---- matching
T = datetime.date(2026, 10, 24)
P = [dict(id='p1', name='Vinicius Junior', club='Real Madrid', lgs=['L1']), dict(id='p2', name='Martin Odegaard', club='Arsenal', lgs=['L1']),
     dict(id='p3', name='Son Heung Min', club='LAFC', lgs=['L2']), dict(id='p4', name='Jose Gomez', club='Real Madrid', lgs=['L1']),
     dict(id='p5', name='Jose Gomez', club='Sevilla', lgs=['L2']), dict(id='p6', name='Twin Name', club='Nowhere', lgs=['L1']),
     dict(id='p7', name='Nobody Atall', club='X', lgs=['L1']), dict(id='p8', name='Ghost Player', club='Fulham', lgs=['L1']),
     dict(id='p9', name='Rodri', club='Manchester City', lgs=['L1']), dict(id='p10', name='No Value', club='Brighton', lgs=['L1']), dict(id='p11', name='Bad Date', club='Fulham', lgs=['L1'])]
got, st = match(P, R, T)
ok(got['p1'] == ['2000-07-12', 150000000] and got['p2'] == ['1998-12-17', 70000000], 'accents folded: "Vinicius Junior" and "Martin Odegaard" find their rows')
ok(got['p3'] == ['1992-07-08', 25000000], 'word order: "Son Heung Min" finds "Heung-min Son"')
ok(got['p4'] == ['1999-01-01', 5000000] and got['p5'] == ['1995-05-05', 2000000], 'the same name twice: the club decides (Real Madrid / Sevilla)')
ok('p6' not in got and st['ambiguous'] == 1, 'the same name twice with no club that fits: no number (ambiguous), not a guess')
ok('p7' not in got and st['unmatched'] == 1, 'a name that is not in the table: unmatched')
ok('p8' not in got and st['implausible'] == 2, 'born in 1900, or no usable date: no number (implausible)')
ok(got['p10'] == ['2001-03-03', None] and got['p9'][1] == 110000000, 'a player with a date but no value keeps the date')
ok(st['matched'] == 7 and st['by_league']['L1'] == {'players': 9, 'matched': 5} and st['by_league']['L2'] == {'players': 2, 'matched': 2}, 'counts: 7 matched; per league L1 5 of 9, L2 2 of 2 %s' % st['by_league'])
# ---- which players are asked about
STORE['data/index.json'] = {'leagues': [
 {'id': 'WC', 'name': 'World Cup', 'pl_file': 'WC_pl.json'},
 {'id': 'L1', 'name': 'Premier League', 'pl_file': 'L1_pl.json', 'sh_file': 's'},
 {'id': 'CL', 'name': 'Champions League', 'pl_file': 'CL_pl.json', 'sh_file': 's'}]}
C = ['i', 'n', 'c', 'mi']
STORE['data/L1_pl.json'] = {'cols': C, 'rows': [['a', 'Rodri', 'Manchester City', 90], ['a', 'Rodri', 'Manchester City', 45], ['b', 'Bench', 'Fulham', None]]}
STORE['data/WC_pl.json'] = {'cols': C, 'rows': [['a', 'Rodri', 'Spain', 90], ['w', 'Only Nation', 'Spain', 90]]}
STORE['data/CL_pl.json'] = {'cols': C, 'rows': [['z', 'Champion Only', 'X', 90]]}
pl = {p['id']: p for p in players('hub')}
ok(set(pl) == {'a', 'w'}, 'asked about: the league and World Cup players with minutes (a player on the bench with no minutes and Champions League-only players are not)')
ok(pl['a']['club'] == 'Manchester City' and pl['a']['lgs'] == ['L1', 'WC'] and pl['w']['club'] == '', 'a player in both keeps his club from the league; a World Cup-only player has no club (name only)')
# ---- the step
def fetch_ok():
    FETCH.append(1); return gzip.compress(CSV.encode()), 'Mon, 06 Jul 2026 04:00:00 GMT'
G['tm_fetch'] = fetch_ok
STORE['data/L1_pl.json'] = {'cols': C, 'rows': [['p1', 'Vinicius Junior', 'Real Madrid', 90], ['p2', 'Martin Odegaard', 'Arsenal', 90], ['p7', 'Nobody Atall', 'X', 90]]}
STORE['data/WC_pl.json'] = {'cols': C, 'rows': []}
at = lambda h, m, d=datetime.datetime(2026, 10, 24): d.replace(hour=h, minute=m, tzinfo=datetime.timezone.utc)
sync('hub', at(13, 10)); ok(not FETCH and not PUT, 'no file yet, 13:10: not in the window, nothing downloaded')
sync('hub', at(12, 45)); ok(not FETCH and not PUT, 'no file yet, 12:45: not in the window')
sync('hub', at(12, 10))
f = PUT.get('data/tm.json')
ok(len(FETCH) == 1 and f and f['p'] == {'p1': ['2000-07-12', 150000000], 'p2': ['1998-12-17', 70000000]} and f['asof'] == '2026-07-06' and f['t'] == '2026-10-24', 'no file, 12:10: downloaded and written: two players matched, the dataset dated 2026-07-06 (its Last-Modified)')
ok(f['matched'] == 2 and f['unmatched'] == 1 and f['n_players'] == 3 and f['by_league']['L1'] == {'players': 3, 'matched': 2} and any('طابقنا 2 من 3' in l for l in LOG), 'the file counts matched / unmatched and the log says how many of how many (%s)' % LOG[-1:])
FETCH.clear(); PUT.clear(); sync('hub', at(12, 10, datetime.datetime(2026, 10, 28))); ok(not FETCH and not PUT, 'a file from 4 days ago: not downloaded again')
sync('hub', at(12, 10, datetime.datetime(2026, 11, 2))); ok(len(FETCH) == 1 and PUT['data/tm.json']['t'] == '2026-11-02', 'a file from 9 days ago: downloaded again in the window')
# the empty placeholder file kept in the repo (so the page's request does not 404 before the first download) counts as no file
STORE['data/tm.json'] = {'t': '', 'p': {}}; FETCH.clear(); PUT.clear()
sync('hub', at(13, 10)); ok(not FETCH, 'placeholder file, 13:10: outside the window, nothing downloaded')
sync('hub', at(12, 10)); ok(len(FETCH) == 1 and PUT['data/tm.json']['matched'] == 2, 'placeholder file, 12:10: treated as no file, downloaded and replaced')
F = json.load(open(os.path.join(REPO, 'data', 'tm.json')))
if F.get('p'):   # the real file the sync wrote: its own counts add up and every entry is [date of birth, value]
    ok(F['matched'] == len(F['p']) and F['matched'] + F['ambiguous'] + F['unmatched'] + F['implausible'] == F['n_players'] and all(re.fullmatch(r'\d{4}-\d{2}-\d{2}', v[0]) and (v[1] is None or v[1] >= 0) for v in F['p'].values()), 'data/tm.json: %d matched of %d players, the counts add up and every entry is [date, value]' % (F['matched'], F['n_players']))
else:
    ok(F == {'t': '', 'p': {}}, 'data/tm.json in the repo is the empty placeholder until the first download')
# ---- failures never stop the sync and never overwrite
STORE.pop('data/tm.json'); PUT.clear(); LOG.clear()
def fetch_bad():
    raise RuntimeError('HTTP 502, 0 bytes')
G['tm_fetch'] = fetch_bad
real = G['run_pipeline']
now0 = datetime.datetime.now(datetime.timezone.utc)
try:
    sync('hub', at(12, 10)); ok(False, 'a failed download raises inside the step')
except RuntimeError:
    ok(not PUT, 'a failed download raises inside the step and writes nothing')
G['tm_fetch'] = lambda: (gzip.compress(b'player_id,name\n1,x\n'), None)
try:
    sync('hub', at(12, 10)); ok(False, 'a table without the columns raises')
except ValueError:
    ok(not PUT, 'a table without the date and value columns raises and writes nothing')
G['tm_fetch'] = lambda: (gzip.compress((HEAD + '1,Somebody Else,1990-01-01,1.0,X,2025,A\n').encode()), None)
try:
    sync('hub', at(12, 10)); ok(False, 'nobody matches raises')
except RuntimeError as e:
    ok(not PUT and 'ما انطبق' in str(e), 'a table that matches nobody raises and writes nothing')
# the pipeline wrapper logs an error and carries on
G['sync_tm'] = lambda hub: (_ for _ in ()).throw(RuntimeError('boom'))
LOG.clear(); out = G['run_pipeline']('hub', 'k')
ok(out is True and any('[Transfermarkt] خطأ' in l and 'boom' in l for l in LOG), 'run_pipeline: an error in the step is logged and the sync goes on')
print('all passed' if not fails else '%d FAILED' % fails); sys.exit(1 if fails else 0)
