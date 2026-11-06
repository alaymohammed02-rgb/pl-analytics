# Live goals from api-football (the LIVEFEED block of sync.py): worked with a fake API that answers like the real one's documented shape, never the network. Name matching
# (spelling differences, no false match between clubs of the same town), the events (order, own goals read both ways, penalties, shoot-out ignored, goals that do not add up),
# the budget (one request for all matches, the 4-minute gap, the slow gear after 60, the stop at 90, the stop at 8 left, none without a match under way or without the key, a
# new UTC day resets), a refusal or a failure leaving the file as it was, the key never logged, and the whole way to a goal message through notify_plan.
import os, re, sys, json, math, hashlib, datetime, unicodedata, urllib.request, urllib.error, copy
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
lf = src[src.index('# ===== LIVEFEED START ====='):src.index('# ===== LIVEFEED END =====')]
ts = src[src.index('def _parse_ts(ts):'):src.index('def match_due(r):')]
LOGS = []
G = {'os': os, 're': re, 'json': json, 'datetime': datetime, 'unicodedata': unicodedata, 'urllib': urllib, 'log': lambda *a: LOGS.append(' '.join(map(str, a)))}
exec(ts, G)
exec(lf, G)
nb = src[src.index('# ===== NOTIFY START ====='):src.index('# ===== NOTIFY END =====')]
N = {'os': os, 're': re, 'json': json, 'math': math, 'hashlib': hashlib, 'datetime': datetime, 'unicodedata': unicodedata, 'urllib': urllib,
     'log': lambda *a: None, 'run_pipeline': lambda h, k: True, 'gh_get_json': lambda h, p: None, 'gh_put': lambda *a: None}
exec(nb, N)
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


utc = datetime.timezone.utc
same = G['lf_same']
for a, b, want in [('Manchester City', 'Manchester City', True), ('Brighton & Hove Albion', 'Brighton', True), ('Man United', 'Manchester United', True), ('Newcastle United', 'Newcastle', True),
                   ('Bayern Munich', 'Bayern München', True), ('Atlético Madrid', 'Atletico Madrid', True), ('Inter', 'Inter Milan', True), ('AC Milan', 'Milan', True),
                   ('Borussia Mönchengladbach', 'Borussia Mönchengladbach', True), ('Borussia Dortmund', 'Borussia Mönchengladbach', False), ('Manchester United', 'Newcastle United', False), ('Manchester City', 'Manchester United', False),
                   ('Real Madrid', 'Real Sociedad', False), ('Arsenal', 'Chelsea', False), ('Hamburger SV', 'Hamburg', True), ('RB Leipzig', 'RB Leipzig', True)]:
    ok(same(a, b) == want, f'names: "{a}" and "{b}" {"are" if want else "are not"} the same club')


def item(fid, home, away, kick, gh, ga, events, short='2H'):
    return {'fixture': {'id': fid, 'date': kick, 'status': {'short': short, 'elapsed': 60}}, 'teams': {'home': {'id': 1, 'name': home}, 'away': {'id': 2, 'name': away}},
            'goals': {'home': gh, 'away': ga}, 'events': events}


def ev(el, team, who, detail='Normal Goal', extra=None, comment=None, typ='Goal'):
    return {'time': {'elapsed': el, 'extra': extra}, 'team': {'id': team}, 'player': {'name': who}, 'type': typ, 'detail': detail, 'comment': comment}


# events: order, scorers, penalties, own goals both ways, missed penalty and shoot-out ignored
it = item(9, 'RB Leipzig', 'Manchester City', '2026-11-04T20:00:00+00:00', 2, 3,
          [ev(61, 1, 'Antonio Nusa'), ev(37, 1, 'Castello Lukeba', 'Own Goal'), ev(49, 1, 'Ridle Baku'), ev(58, 2, 'Enzo Fernández'), ev(90, 2, 'Erling Haaland', 'Penalty', 3),
           ev(80, 2, 'X', 'Missed Penalty'), ev(120, 2, 'Y', 'Penalty', None, 'Penalty Shootout'), ev(30, 1, 'Card', typ='Card', detail='Yellow Card')])
g = G['lf_goals'](it)
ok(g is not None and [(x[0], x[3], x[4]) for x in g] == [(37, 'a', 'Castello Lukeba'), (49, 'h', 'Ridle Baku'), (58, 'a', 'Enzo Fernández'), (61, 'h', 'Antonio Nusa'), (90, 'a', 'Erling Haaland')],
   'events: only goals, in order, missed penalty, shoot-out and cards left out')
# the own goal's team read as the scorer's team (flip) must match the API's score; here the API says 2-3 so the flip (Lukeba is a Leipzig player: counts for City) is right
ok(g is not None and [x[3] for x in g] == ['a', 'h', 'a', 'h', 'a'] and (g[0][6], g[0][7]) == (0, 0) and g[0][8] == 1 and g[4][9] == 1 and g[4][1] == 3,
   'an own goal by a Leipzig player counts for City (read both ways, the one that adds up to 2-3 is kept); flags and added time kept; score before each goal')
it2 = item(9, 'A', 'B', '2026-11-04T20:00:00+00:00', 1, 0, [ev(10, 1, 'Own', 'Own Goal')])
g2 = G['lf_goals'](it2)
ok(g2 is not None and g2[0][3] == 'h' and g2[0][8] == 1, 'a lone own goal by the home team with the API saying 1-0: it counts for the home side only if the team is read as the beneficiary; the way that adds up is kept')
ok(G['lf_goals'](item(9, 'A', 'B', 'x', 2, 0, [ev(10, 1, 'P')])) is None, 'goals that do not add up to the API score: None (events are left as they were)')
ok(G['lf_goals'](item(9, 'A', 'B', 'x', 0, 0, [])) == [], 'a 0-0 match: no goals, an empty list')
ok(G['lf_goals']({'teams': {}, 'goals': {'home': None, 'away': None}, 'events': []}) is None, 'no score yet: None')

# matching
k0 = '2026-11-04T20:00:00Z'
F = {'i': 'm_1', 'k': k0, 'h': 'RB Leipzig', 'a': 'Manchester City'}
ok(G['lf_match'](F, [it]) is it, 'a fixture is matched to its live item by kick-off and both names')
ok(G['lf_match'](F, [item(9, 'RB Leipzig', 'Manchester City', '2026-11-04T21:30:00+00:00', 0, 0, [])]) is None, 'a kick-off 90 minutes away is another match')
ok(G['lf_match'](F, [it, copy.deepcopy(it)]) is None, 'two candidates: no guess')

# the budget and the writing
KEY = 'SECRET-KEY-123'
T0 = datetime.datetime(2026, 11, 4, 21, 0, tzinfo=utc)
win = [('l_x', F, -60.0)]
CALLS = []


def fake(body=None, rem=80, err=None):
    def f(key, *a, **k):
        CALLS.append(key)
        return body, rem, err
    return f


M = {'m_1': dict(l='l_x', k=k0, h='RB Leipzig', a='Manchester City', st='not_started', ev=[])}
st = G['lf_apply'](M, win, T0, None, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(len(CALLS) == 1 and st['n'] == 1 and st['rem'] == 80 and M['m_1']['st'] == 'inprogress' and (M['m_1']['sh'], M['m_1']['sa']) == (2, 3) and len(M['m_1']['ev']) == 5 and M['m_1']['lf'] == 1,
   'one request: the match is in progress with its score and five goals in live.json')
ok(all(KEY not in l for l in LOGS), 'the key is never written to the log')
CALLS.clear()
st2 = G['lf_apply'](M, win, T0 + datetime.timedelta(minutes=2), st, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(not CALLS and st2['n'] == 1, 'a second call within 4 minutes is not made')
st3 = G['lf_apply'](M, win, T0 + datetime.timedelta(minutes=5), st, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(len(CALLS) == 1 and st3['n'] == 2, 'five minutes later: the next request')
CALLS.clear()
slow = dict(st, n=60)
G['lf_apply'](M, win, T0 + datetime.timedelta(minutes=5), slow, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(not CALLS, 'after 60 requests in a day: only one every 9 minutes (5 minutes is too soon)')
G['lf_apply'](M, win, T0 + datetime.timedelta(minutes=10), slow, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(len(CALLS) == 1, '... and one after 9 minutes')
CALLS.clear()
full = dict(st, n=90)
G['lf_apply'](M, win, T0 + datetime.timedelta(minutes=30), full, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(not CALLS and any('budget' in l for l in LOGS), 'at 90 requests a day: stop, and say so')
low = dict(st, rem=5)
G['lf_apply'](M, win, T0 + datetime.timedelta(minutes=30), low, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(not CALLS, 'the API says 5 requests are left: stop')
nd = G['lf_apply'](M, win, T0 + datetime.timedelta(days=1, minutes=-20), dict(st, n=90), KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(len(CALLS) == 1 and nd['n'] == 1 and nd['d'] == '2026-11-05', 'a new UTC day starts the count again')
CALLS.clear()
G['lf_apply'](M, win, T0, None, None, fetch=fake({'errors': [], 'response': [it]}))
ok(not CALLS, 'no key: no request')
G['lf_apply'](M, [('l_x', F, -200.0)], T0, None, KEY, fetch=fake({'errors': [], 'response': [it]}))
G['lf_apply'](M, [('l_x', F, 45.0)], T0, None, KEY, fetch=fake({'errors': [], 'response': [it]}))
ok(not CALLS, 'no match under way (over 150 minutes ago or not yet started): no request')
# a refusal (plan) or a failure leaves live.json as it was
M2 = {'m_1': dict(l='l_x', k=k0, h='RB Leipzig', a='Manchester City', st='not_started', ev=[])}
LOGS.clear()
s4 = G['lf_apply'](M2, win, T0, None, KEY, fetch=fake({'errors': {'plan': 'Free plans do not have access to this season'}, 'response': []}))
ok(M2['m_1']['st'] == 'not_started' and s4['n'] == 1 and any('Free plans' in l for l in LOGS), 'the API refusing (plan): nothing changed, the reason is in the log, the request is counted')
M2b = copy.deepcopy(M2)
G['lf_apply'](M2b, win, T0, None, KEY, fetch=fake(None, None, 'HTTP 429'))
ok(M2b == M2 and any('429' in l for l in LOGS), 'HTTP 429: nothing changed, logged')
boom = lambda key: (_ for _ in ()).throw(RuntimeError('x'))
ok(G['lf_apply'](M2b, win, T0, None, KEY, fetch=boom) is not None, 'an exception inside is caught: the sync goes on')
# a match that vanishes from the live list near the end is finished
M3 = {'m_1': dict(l='l_x', k=k0, h='RB Leipzig', a='Manchester City', st='inprogress', lf=1, ev=[])}
CALLS.clear()
G['lf_apply'](M3, [('l_x', F, -110.0)], T0, None, KEY, fetch=fake({'errors': [], 'response': []}))
ok(M3['m_1'].get('lfd') == 1, 'seen live before, now gone from the live list 110 minutes after kick-off: finished, no more requests for it')
G['lf_apply'](M3, [('l_x', F, -112.0)], T0 + datetime.timedelta(minutes=10), None, KEY, fetch=fake({'errors': [], 'response': []}))
ok(len(CALLS) == 1, 'and with only that match left, no request is made afterwards')
# whole way: live goals → notify_plan sends one message per club, and not twice
LEAGUES = [('l_x', 'Test League', [])]
LIVE = {'m_1': dict(M['m_1'], st='inprogress', ev=M['m_1']['ev'][:1])}
OLD = {'v': 1, 'pv': 1, 'r': {}, 'm': {}, 'pr': {}, 'pm': {}, 'g': {}}
NOW = datetime.datetime(2026, 11, 4, 21, 0, tzinfo=utc)
m1, s1 = N['notify_plan'](LEAGUES, {}, OLD, NOW, 'https://x/', 'abc123def456', live=LIVE)
ok(len(m1) == 2 and m1[0][0]['title'].startswith('⚽ Goal!') and 'Manchester City' in m1[0][0]['message'], 'through notify_plan: the first live goal is two messages, one per club')
for p, k in m1:
    s1[k[0]][k[1]] = k[2]
m2, s2 = N['notify_plan'](LEAGUES, {}, s1, NOW, 'https://x/', 'abc123def456', live=LIVE)
ok(m2 == [], 'the same goal is not sent again')
LIVE['m_1']['ev'] = M['m_1']['ev'][:2]
m3, _ = N['notify_plan'](LEAGUES, {}, s1, NOW, 'https://x/', 'abc123def456', live=LIVE)
ok(len(m3) == 2, 'the next goal is two more messages')
print(f'{fails} FAILED' if fails else 'all passed')
sys.exit(1 if fails else 0)
