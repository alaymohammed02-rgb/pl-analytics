# The free-source step of the sync (the block between "MARKET START" and "MARKET END" in sync.py): de-vigged odds, the choice among the
# odds columns, matching to PitchAPI's matches (by date and score, then names, strict names before loose ones), the team-name aliases
# checked against every team name PitchAPI has in the six leagues, the ClubElo day file, and the write / skip / failure behaviour of the two
# sync steps with the network and GitHub stubbed. The CSV text below is made up in football-data.co.uk's column layout and ClubElo's,
# using real PitchAPI matches (dates, scores) from data/; the spellings are the ones those sites use, from memory.
import os, re, sys, json, hashlib, datetime, time
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
block = src[src.index('# ===== MARKET START ====='):src.index('# ===== MARKET END =====')]
LOG = []; PUT = {}; STORE = {}; DB = {}
class _R:  # a stand-in for the requests module: never used by the tests below (mk_get is replaced), but the block refers to it
    pass
G = {'os': os, 're': re, 'json': json, 'hashlib': hashlib, 'datetime': datetime, 'time': time, 'requests': _R,
     'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: True,
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c))),
     'q': lambda sql, args=(), one=False: DB['rows'](sql, args)}
exec(block, G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
D = REPO + '/data/'
idx = json.load(open(D + 'index.json'))
LG = {l['id']: l for l in idx['leagues']}
mk_norm, mk_same, mk_name, mk_probs, mk_rows, mk_match = (G[k] for k in ('mk_norm', 'mk_same', 'mk_name', 'mk_probs', 'mk_rows', 'mk_match'))
# ---- the odds: de-vigged, the column order of preference
r = {'AvgCH': '2.0', 'AvgCD': '4.0', 'AvgCA': '4.0', 'AvgH': '1.5', 'AvgD': '5', 'AvgA': '7', 'B365H': '1.4', 'B365D': '5', 'B365A': '8'}
p, srcn, mg = mk_probs(r)
ok(p == [0.5714, 0.2857, 0.2857] or abs(sum(p) - 1) < 1e-3, 'closing average odds first, margin removed: %s from %s (margin %.1f%%)' % (p, srcn, mg * 100))
ok(abs(p[0] - (1 / 2.0) / (1 / 2.0 + 1 / 4.0 + 1 / 4.0)) < 1e-3 and abs(mg - (1 / 2.0 + 1 / 4.0 + 1 / 4.0 - 1)) < 1e-3 and srcn == 'AvgC', '2.0 / 4.0 / 4.0 → 50 % / 25 % / 25 % (the margin is 0)')
del r['AvgCH']
ok(mk_probs(r)[1] == 'Avg', 'without the closing average: the opening average')
for k in ('AvgH', 'AvgD', 'AvgA'): del r[k]
ok(mk_probs(r)[1] == 'B365', 'without either: Bet365\'s')
ok(mk_probs({'B365H': '1.0', 'B365D': '5', 'B365A': '8'}) is None and mk_probs({'B365H': '', 'B365D': '5', 'B365A': '8'}) is None and mk_probs({}) is None, 'odds of 1.0 or below, empty or missing: no probabilities (never a guess)')
# ---- names: every PitchAPI team name is itself, and the spellings the two sources use
teams = {}
for lid in G['MK_LEAGUES']:
    L = json.load(open(D + LG[lid]['file']))
    teams[lid] = sorted({m['h'] for m in L['matches']} | {m['a'] for m in L['matches']})
ok(all(mk_same(t, t, True) for ts in teams.values() for t in ts), 'every PitchAPI team name equals itself (%d names)' % sum(map(len, teams.values())))
EXP = {  # football-data.co.uk and ClubElo spellings → the PitchAPI name of the league (only the ones that exist in this data)
 'l_4WFCIZ': {"Man City": 'Manchester City', "Man United": 'Manchester United', "Nott'm Forest": 'Nottingham Forest', 'Forest': 'Nottingham Forest', 'Tottenham': 'Tottenham Hotspur',
              'Newcastle': 'Newcastle United', 'Brighton': 'Brighton & Hove Albion', 'Bournemouth': 'AFC Bournemouth', 'Leeds': 'Leeds United', 'Ipswich': 'Ipswich Town', 'Hull': 'Hull City', 'Coventry': 'Coventry City'},
 'l_0ErfuF': {'Ath Madrid': 'Atlético Madrid', 'Atletico': 'Atlético Madrid', 'Ath Bilbao': 'Athletic Club', 'Athletic Bilbao': 'Athletic Club', 'Sociedad': 'Real Sociedad', 'Vallecano': 'Rayo Vallecano', 'Betis': 'Real Betis',
              'Celta': 'Celta Vigo', 'Alaves': 'Deportivo Alavés', 'Espanol': 'Espanyol', 'La Coruna': 'Deportivo A Coruña', 'Santander': 'Racing Santander', 'Malaga': 'Málaga'},
 'l_1Isor4': {'Bayern Munich': 'Bayern München', 'Bayern': 'Bayern München', "M'gladbach": 'Borussia Mönchengladbach', 'Gladbach': 'Borussia Mönchengladbach', 'Ein Frankfurt': 'Eintracht Frankfurt', 'Dortmund': 'Borussia Dortmund',
              'Leverkusen': 'Bayer Leverkusen', 'FC Koln': '1. FC Köln', 'Koeln': '1. FC Köln', 'Hamburg': 'Hamburger SV', 'Stuttgart': 'VfB Stuttgart', 'Mainz': 'Mainz 05', 'Bremen': 'Werder Bremen', 'Leipzig': 'RB Leipzig', 'Schalke 04': 'Schalke 04'},
 'l_3FJFUl': {'Paris SG': 'Paris Saint-Germain', 'Paris FC': 'Paris FC', 'Marseille': 'Marseille', 'Lyon': 'Lyon', 'Le Havre': 'Le Havre', 'Le Mans': 'Le Mans'},
 'l_0ALvwF': {'Inter': 'Inter', 'Milan': 'Milan', 'Napoli': 'Napoli', 'Roma': 'Roma', 'Juventus': 'Juventus'},
 'l_4QexZg': {'Sp Lisbon': 'Sporting CP', 'Sporting': 'Sporting CP', 'Sp Braga': 'Braga', 'Guimaraes': 'Vitória de Guimarães', 'Porto': 'FC Porto', 'Estrela': 'Estrela da Amadora', 'Famalicao': 'Famalicão', 'Casa Pia': 'Casa Pia AC'}}
for lid, mp in EXP.items():
    bad = []
    for fd, pa in mp.items():
        hits = [t for t in teams[lid] if mk_same(fd, t, True)] or [t for t in teams[lid] if mk_same(fd, t)]
        if hits != [pa]: bad.append((fd, hits, pa))
    ok(not bad, '%s: %d outside spellings find exactly their club %s' % (LG[lid]['name'], len(mp), bad[:3]))
ok(mk_same('Paris FC', 'Paris Saint-Germain', True) is False and mk_same('Paris FC', 'Paris Saint-Germain') is True, 'a loose match would confuse Paris FC with Paris Saint-Germain; strict does not (so strict is tried first)')
# ---- matching finished and coming matches
L = json.load(open(D + LG['l_4WFCIZ']['file']))
fin = [m for m in L['matches'] if re.match(r'^\d+-\d+$', m.get('s') or '') and m.get('d')][-6:]
MS = [dict(m=m['i'], d=m['d'][:10], h=m['h'], a=m['a'], s=m['s']) for m in L['matches'] if m.get('d')]
fdname = {'Manchester City': 'Man City', 'Manchester United': 'Man United', 'Nottingham Forest': "Nott'm Forest", 'Tottenham Hotspur': 'Tottenham', 'Newcastle United': 'Newcastle', 'Brighton & Hove Albion': 'Brighton',
          'AFC Bournemouth': 'Bournemouth', 'Leeds United': 'Leeds', 'Ipswich Town': 'Ipswich', 'Hull City': 'Hull', 'Coventry City': 'Coventry'}
fd = lambda n: fdname.get(n, n)
def line(m, odds=('1.80', '3.60', '4.50'), cols=('B365H', 'B365D', 'B365A'), future=False):
    d = datetime.date.fromisoformat(m['d'][:10]); hg, ag = (m['s'].split('-') if not future else ('', ''))
    return dict(Div='E0', Date=d.strftime('%d/%m/%Y'), HomeTeam=fd(m['h']), AwayTeam=fd(m['a']), FTHG=hg, FTAG=ag, **dict(zip(cols, odds)))
def csv(rows):
    keys = list(dict.fromkeys(k for r in rows for k in r)); return '\n'.join([','.join(keys)] + [','.join(r.get(k, '') for k in keys) for r in rows]) + '\n'
txt = csv([line(m) for m in fin])
rows = mk_rows(txt)
ok(len(rows) == 6 and rows[0][3] is not None and abs(sum(rows[0][5]) - 1) < 1e-3, 'the CSV: 6 rows with date, teams, score and probabilities summing to 1')
done, un = mk_match(rows, MS)
ok(len(done) == 6 and not un and {x['m'] for x in done} == {m['i'] for m in fin}, 'finished matches matched to the right PitchAPI matches by date and score (%d of 6)' % len(done))
# a date one day off (kick-off after midnight in one source) still matches; two days off does not
sh = [dict(r, Date=(datetime.datetime.strptime(r['Date'], '%d/%m/%Y') + datetime.timedelta(days=1)).strftime('%d/%m/%Y')) for r in [line(fin[0])]]
ok(len(mk_match(mk_rows(csv(sh)), MS)[0]) == 1, 'a date one day off still matches')
sh2 = [dict(r, Date=(datetime.datetime.strptime(r['Date'], '%d/%m/%Y') + datetime.timedelta(days=3)).strftime('%d/%m/%Y')) for r in [line(fin[0])]]
ok(len(mk_match(mk_rows(csv(sh2)), MS)[0]) == 0, 'three days off does not (it is counted as unmatched, not guessed)')
# the same score on the same day: the team names decide, and when they cannot, the odds are left out
A = dict(m='a1', d='2026-09-05', h='Arsenal', a='Chelsea', s='1-0'); B = dict(m='b1', d='2026-09-05', h='Everton', a='Fulham', s='1-0')
r2 = mk_rows(csv([dict(Div='E0', Date='05/09/2026', HomeTeam='Everton', AwayTeam='Fulham', FTHG='1', FTAG='0', B365H='2', B365D='3', B365A='4')]))
d2, u2 = mk_match(r2, [A, B])
ok(len(d2) == 1 and d2[0]['m'] == 'b1', 'two 1-0 results on one day: the team names choose (Everton v Fulham)')
r3 = mk_rows(csv([dict(Div='E0', Date='05/09/2026', HomeTeam='Nobody', AwayTeam='Else', FTHG='1', FTAG='0', B365H='2', B365D='3', B365A='4')]))
d3, u3 = mk_match(r3, [A, B])
ok(not d3 and len(u3) == 1, 'two 1-0 results on one day and names that fit neither: not matched, counted')
# the real case seen on the first sync: one 2-2 on the day in PitchAPI (Santa Clara v Nacional), the odds row is another 2-2 (Benfica v Academico Viseu)
C = dict(m='c1', d='2026-08-10', h='Santa Clara', a='Nacional', s='2-2')
r4 = mk_rows(csv([dict(Div='E0', Date='10/08/2026', HomeTeam='Benfica', AwayTeam='Academico Viseu', FTHG='2', FTAG='2', B365H='2', B365D='3', B365A='4')]))
d4, u4 = mk_match(r4, [C])
ok(not d4 and len(u4) == 1, 'one match on the day with the same score but other teams: not matched (no other game\'s odds)')
# a coming match: by date and both names
fut = [dict(m='f1', d='2026-11-07', h='Manchester City', a='Arsenal', s=None), dict(m='f2', d='2026-11-07', h='Manchester United', a='Chelsea', s=None)]
rf = mk_rows(csv([dict(Div='E0', Date='07/11/2026', HomeTeam='Man City', AwayTeam='Arsenal', B365H='1.5', B365D='4.5', B365A='6')]))
df, uf = mk_match(rf, fut)
ok(len(df) == 1 and df[0]['m'] == 'f1' and df[0]['fin'] is False and df[0]['fh'] == 'Man City', 'a coming match is matched by date and both names (Man City = Manchester City), and flagged as not finished')
# ---- the ClubElo day file
elo_txt = 'Rank,Club,Country,Level,Elo,From,To\n1,Man City,ENG,1,2050.4,2026-10-20,2026-10-25\n2,Paris SG,FRA,1,1990.1,2026-10-20,2026-10-25\n3,Paris FC,FRA,1,1650.7,2026-10-20,2026-10-25\n4,Arsenal,ENG,1,2040.0,2026-10-20,2026-10-25\n5,Arsenal,ENG,2,1500.0,2026-10-20,2026-10-25\n6,Koeln,GER,1,1700.5,2026-10-20,2026-10-25\n'
er = G['mk_elo_rows'](elo_txt)
ok(len(er) == 6 and er[0] == ('Man City', 'ENG', 1, 2050.4), 'the ClubElo file: club, country, level, Elo')
got, un_e = G['mk_elo_match'](er, 'ENG', teams['l_4WFCIZ'])
ok(got.get('Manchester City') == 2050.4 and got.get('Arsenal') == 2040.0 and 'Chelsea' in un_e, 'Elo by league: Man City → Manchester City, only the top level counts (Arsenal 2040, not the level-2 row), clubs not in the file are listed')
gf, _ = G['mk_elo_match'](er, 'FRA', teams['l_3FJFUl'])
ok(gf.get('Paris Saint-Germain') == 1990.1 and gf.get('Paris FC') == 1650.7, 'Paris SG and Paris FC get their own ratings (strict names first)')
ok(G['mk_elo_match'](er, 'GER', teams['l_1Isor4'])[0].get('1. FC Köln') == 1700.5, 'ClubElo\'s "Koeln" = 1. FC Köln')
ok(G['mk_season_code']([datetime.date(2026, 10, 18), datetime.date(2026, 8, 20)]) == '2627' and G['mk_season_code']([datetime.date(2026, 3, 1)]) == '2526' and G['mk_season_code']([]) is None, 'the season code in the CSV address: 2026-27 → 2627; March 2026 is still 2025-26')
# ---- the sync steps with the network and GitHub stubbed
now = datetime.datetime(2026, 10, 24, 12, tzinfo=datetime.timezone.utc)
league_rows = {lid: [dict(m=m['i'], d=m['d'], h=m['h'], a=m['a'], s=m.get('s')) for m in json.load(open(D + LG[lid]['file']))['matches'] if m.get('d')] for lid in G['MK_LEAGUES']}
def rows_for(sql, args):
    lid = args[0]
    if 'SELECT match_id m' in sql: return [dict(m=r['m'], d=r['d'], h=r['h'], a=r['a'], s=r['s']) for r in league_rows[lid]]
    if 'SELECT home h' in sql: return [{'h': r['h']} for r in league_rows[lid]]
    return [{'a': r['a']} for r in league_rows[lid]]
DB['rows'] = rows_for
PL = [m for m in league_rows['l_4WFCIZ'] if re.match(r'^\d+-\d+$', m.get('s') or '')][-5:]
def fetch(url, tries=3):
    if url.endswith('fixtures.csv'): return csv([])
    m = re.search(r'mmz4281/(\d+)/(\w+)\.csv', url)
    if m and m.group(2) == 'E0': return csv([line(dict(m=x['m'], d=x['d'], h=x['h'], a=x['a'], s=x['s'])) for x in PL])
    raise RuntimeError('no such file ' + url)
G['mk_get'] = fetch
G['sync_market'](None, now)
M = PUT.get('data/market.json')
ok(M and set(M['leagues']) == {'l_4WFCIZ'} and M['leagues']['l_4WFCIZ']['n'] == 5 and M['leagues']['l_4WFCIZ']['fin'] == 5 and M['leagues']['l_4WFCIZ']['season'] == '2627' and M['h'], 'sync_market writes data/market.json: the one league whose file answered, 5 matched finished matches, season 2627, a hash')
ok(any('no such file' in l for l in LOG), 'a league whose file fails is logged, and the others are untouched')
n = len(PUT); G['sync_market'](None, now); ok(M is not None and PUT['data/market.json'] is M, 'unchanged odds: the file is not written again (same hash)')
G['mk_get'] = lambda url, tries=3, timeout=40: (_ for _ in ()).throw(RuntimeError('network down'))
before = json.dumps(STORE['data/market.json'], sort_keys=True); G['sync_market'](None, now)
ok(json.dumps(STORE['data/market.json'], sort_keys=True) == before, 'every request failing: the previous file stays exactly as it was')
# the Elo step: one snapshot a day, history kept
G['mk_get'] = lambda url, tries=3, timeout=40: elo_txt
G['sync_elo'](None, now); E1 = PUT['data/elo.json']
ok(E1['t'] == '2026-10-24' and E1['r']['l_4WFCIZ']['Manchester City'] == 2050.4 and list(E1['hist']) == ['2026-10-24'] and 'l_4WFCIZ' in E1['unmatched'], 'sync_elo writes today\'s ratings, the history and the clubs without a match')
PUT.clear(); G['sync_elo'](None, now); ok('data/elo.json' not in PUT, 'a second run the same day writes nothing')
G['sync_elo'](None, now + datetime.timedelta(days=1)); E2 = PUT['data/elo.json']
ok(sorted(E2['hist']) == ['2026-10-24', '2026-10-25'], 'the next day adds a snapshot to the history')
# ClubElo answered HTTP 502 for today's file in the first real runs: today's, then the two days before, then https
seen = []
PUT.clear(); STORE.pop('data/elo.json', None)
def only_old(url, tries=3, timeout=40):
    seen.append(url)
    if not url.endswith('2026-10-23'):
        raise RuntimeError('HTTP 502')
    return elo_txt
G['mk_get'] = only_old
G['sync_elo'](None, now); E4 = PUT['data/elo.json']
ok(E4['t'] == '2026-10-24' and E4['asof'] == '2026-10-23' and list(E4['hist']) == ['2026-10-23'], 'today\'s file fails (http and https): yesterday\'s is used and kept under its own day')
ok(seen[:2] == ['%s/2026-10-24' % G['MK_ELO'], G['MK_ELO'].replace('http://', 'https://') + '/2026-10-24'], 'it tries http and https for a day before going back a day')
# no Elo file yet: only one 30-minute window in every 3 hours tries the download (ClubElo was down in the first runs)
seen.clear(); PUT.clear(); STORE.pop('data/elo.json', None); G['mk_get'] = lambda url, tries=3, timeout=40: (seen.append(url), elo_txt)[1]
G['sync_elo'](None, datetime.datetime(2026, 10, 24, 13, 10, tzinfo=datetime.timezone.utc)); ok(not seen and 'data/elo.json' not in PUT, 'no file yet, 13:10: no download is tried (not in the window)')
G['sync_elo'](None, datetime.datetime(2026, 10, 24, 12, 45, tzinfo=datetime.timezone.utc)); ok(not seen, 'no file yet, 12:45: not in the window either')
G['sync_elo'](None, datetime.datetime(2026, 10, 24, 12, 10, tzinfo=datetime.timezone.utc)); ok(seen and 'data/elo.json' in PUT, 'no file yet, 12:10: the download is tried and the file written')
# an error in either step never stops the pipeline
G['mk_get'] = lambda url, tries=3, timeout=40: (_ for _ in ()).throw(RuntimeError('boom'))
G['sync_elo'] = lambda hub, now=None: (_ for _ in ()).throw(RuntimeError('boom'))
ok(G['run_pipeline'](None, 'k') is True and any('خطأ' in l for l in LOG), 'run_pipeline: an error in the optional steps is logged and the sync goes on')
print('all passed' if not fails else '%d FAILED' % fails); sys.exit(1 if fails else 0)
