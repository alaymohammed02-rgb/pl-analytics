# Goal notifications (notify_goals / notify_plan(live=...) / push_text in the NOTIFY block of sync.py): the goals of a live match in order with the score
# counted from them (own goals already on the side they count for, as PitchAPI's events give them: a real match, RB Leipzig 2-3 Manchester City with an own
# goal, is used as it came), FotMob's "[1] - 0" line, a goal sent once to the followers of both clubs, the first run that marks without sending (each door
# on its own), a finished match never announced goal by goal, goals before results and reminders, ntfy's high priority, the browser door's text in English
# and Arabic (penalty, own goal), its tag per match and club, and the crest field that never reaches ntfy.
import os, re, sys, json, math, hashlib, datetime, unicodedata, urllib.request, copy
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
block = src[src.index('# ===== NOTIFY START ====='):src.index('# ===== NOTIFY END =====')]
G = {'os': os, 're': re, 'json': json, 'math': math, 'hashlib': hashlib, 'datetime': datetime, 'unicodedata': unicodedata, 'urllib': urllib,
     'log': lambda *a: None, 'run_pipeline': lambda h, k: True, 'gh_get_json': lambda h, p: None, 'gh_put': lambda *a: None}
exec(block, G)
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


utc = datetime.timezone.utc
NOW = datetime.datetime(2026, 11, 4, 21, 30, tzinfo=utc)
NS, BASE = 'abc123def456', 'https://x.github.io/pl/'
LEAGUES = [('l_0bfbkO', 'Champions League', []), ('l_4WFCIZ', 'Premier League', [])]
# the real events of RB Leipzig 2-3 Manchester City (data/live.json, 4 Nov 2026): Lukeba's own goal is on the away side, as it counted
REAL = [[37, 0, 'goal', 'a', 'Castello Lukeba', '', 0, 0, 1, 0], [41, 0, 'yellowcard', 'h', 'Xavi Simons', '', None, None, 0, 0],
        [49, 0, 'goal', 'h', 'Ridle Baku', '', 0, 1, 0, 0], [58, 0, 'goal', 'a', 'Enzo Fernández', '', 1, 1, 0, 0],
        [61, 0, 'goal', 'h', 'Antonio Nusa', '', 1, 2, 0, 0], [70, 0, 'substitution', 'a', 'Phil Foden', 'Savinho', None, None, 0, 0],
        [90, 3, 'goal', 'a', 'Erling Haaland', '', 2, 2, 0, 1]]
g = G['notify_goals']({'ev': REAL})
ok([x[6:] for x in g] == [(0, 1), (1, 1), (1, 2), (2, 2), (2, 3)] and len(g) == 5, 'goals in order with the score counted from them: 0-1, 1-1, 1-2, 2-2, 2-3 (the final score)')
ok(g[0][4] is True and g[0][2] == 'a' and g[4][5] is True and g[4][1] == "90+3'" and g[2][1] == "58'", 'own goal and penalty flags kept; added time written 90+3\'')
ok(G['notify_goal_line']('RB Leipzig', 'Manchester City', 'a', 2, 3) == 'RB Leipzig 2 - [3] Manchester City' and G['notify_goal_line']('A', 'B', 'h', 1, 0) == 'A [1] - 0 B', 'FotMob\'s line: the scoring side\'s number in brackets')
ok(G['notify_goals']({'ev': [[5, 0, 'goal', '', 'X', '', 0, 0, 0, 0], [6, 0, 'goal', 'h', 'Y', '', 0, 0, 0, 0], 'junk']}) == [(1, "6'", 'h', 'Y', False, False, 1, 0)], 'a goal without a side and a malformed event are left out')

slug = G['notify_slug']
LIVE = {'m_3Bhlqj': {'l': 'l_0bfbkO', 'k': '2026-11-04T20:00:00Z', 'h': 'RB Leipzig', 'a': 'Manchester City', 'st': 'inprogress', 'ev': REAL[:3]}}
# first run with goals: nothing sent, the goals already there are marked (the result/reminder state already exists: not a first run for them)
OLD = {'v': 1, 'pv': 1, 'r': {}, 'm': {}, 'pr': {}, 'pm': {}}
m1, s1 = G['notify_plan'](LEAGUES, {}, OLD, NOW, BASE, NS, live=LIVE)
ok(m1 == [] and set(s1['g']) == {'m_3Bhlqj|0-1|rb-leipzig', 'm_3Bhlqj|0-1|manchester-city', 'm_3Bhlqj|1-1|rb-leipzig', 'm_3Bhlqj|1-1|manchester-city'} and 'pg' not in s1,
   'first run with goals: the 2 goals already there are marked for both clubs, nothing sent, and the browser door\'s own state is left for its own first run')
# a new goal: one message per club
LIVE2 = copy.deepcopy(LIVE); LIVE2['m_3Bhlqj']['ev'] = REAL[:4]
m2, s2 = G['notify_plan'](LEAGUES, {}, s1, NOW, BASE, NS, live=LIVE2)
ok(len(m2) == 2 and {p['topic'] for p, _ in m2} == {G['notify_topic'](NS, 'RB Leipzig'), G['notify_topic'](NS, 'Manchester City')}, 'a new goal (Enzo Fernández, 1-2) goes to the followers of both clubs')
p, k = m2[0]
ok(p['title'] == '⚽ Goal! Enzo Fernández' and p['message'].startswith("RB Leipzig 1 - [2] Manchester City · 58'") and 'Champions League' in p['message']
   and p['priority'] == 4 and p['click'] == BASE + '#/preview/m_3Bhlqj' and p['_crest'] == ['l_0bfbkO', 'Manchester City'], 'ntfy: "⚽ Goal! Enzo Fernández", "RB Leipzig 1 - [2] Manchester City · 58\'", high priority (a pop-up in the app), the match link, the scoring club\'s crest for the browser door')
ok(k[0] == 'g' and k[1].startswith('m_3Bhlqj|1-2|'), 'its state key is the match, the score after the goal and the club')
for p_, k_ in m2:
    s2[k_[0]][k_[1]] = k_[2]
m3, _ = G['notify_plan'](LEAGUES, {}, s2, NOW, BASE, NS, live=LIVE2)
ok(m3 == [], 'the same goal is not sent again')
# a finished match: its goals are marked, not sent
LIVE3 = copy.deepcopy(LIVE); LIVE3['m_3Bhlqj']['ev'] = REAL; LIVE3['m_3Bhlqj']['st'] = 'finished'
m4, s4 = G['notify_plan'](LEAGUES, {}, s2, NOW, BASE, NS, live=LIVE3)
ok(m4 == [] and 'm_3Bhlqj|2-3|rb-leipzig' in s4['g'], 'goals of a finished match are marked, never sent one by one (the result says it)')
# a match of a league that is not on the site is ignored
m5, _ = G['notify_plan'](LEAGUES, {}, s2, NOW, BASE, NS, live={'x': dict(LIVE2['m_3Bhlqj'], l='l_other')})
ok(m5 == [], 'a match of a league the site does not have is ignored')
# goals come before results
LG2 = [('l_0bfbkO', 'Champions League', [{'i': 'm9', 'd': '2026-11-04', 'h': 'Arsenal', 'a': 'Chelsea', 's': '2-1'}])]
st6 = dict(s1); st6['r'] = {}
m6, _ = G['notify_plan'](LG2, {}, st6, NOW, BASE, NS, live=LIVE2)
ok([k_[0] for _, k_ in m6] == ['g', 'g', 'r', 'r'], 'goals go first, then results')
# the browser door: its own first run, then the text in the device language
mp1, sp1 = G['notify_plan'](LEAGUES, {}, s1, NOW, BASE, NS, channel='push', live=LIVE2)
ok(mp1 == [] and len(sp1['pg']) == 6 and 'g' in sp1, 'the browser door\'s first run with goals marks the 3 goals for both clubs and sends nothing, even though the ntfy door already had its own')
LIVE4 = copy.deepcopy(LIVE); LIVE4['m_3Bhlqj']['ev'] = REAL[:5]
mp2, _ = G['notify_plan'](LEAGUES, {}, sp1, NOW, BASE, NS, channel='push', live=LIVE4)
ok(len(mp2) == 2 and all(k_[0] == 'g' for _, k_ in mp2), 'then a new goal (Nusa, 2-2) is two pushes, one per club')
pt = G['push_text'](*mp2[0], 'en')
ok(pt == {'title': '⚽ Goal! Antonio Nusa', 'body': "RB Leipzig [2] - 2 Manchester City · 61' · Champions League", 'url': BASE + '#/preview/m_3Bhlqj',
          'tag': 'g|m_3Bhlqj|' + mp2[0][1][1].split('|')[-1], 'crest': ['l_0bfbkO', 'RB Leipzig']}, 'push (English): "⚽ Goal! Antonio Nusa", "RB Leipzig [2] - 2 Manchester City · 61\' · Champions League", one tag per match and club (a later goal replaces it and alerts again), the scorer\'s crest')
pa = G['push_text'](*mp2[0], 'ar')
ok(pa['title'] == '⚽ هدف! Antonio Nusa' and pa['body'] == pt['body'], 'push (Arabic): "⚽ هدف! Antonio Nusa", the same score line')
pen = ({'click': BASE, '_crest': ['l_0bfbkO', 'Manchester City']}, ('g', 'm|2-3|x', '2026-11-04', 'Champions League', {'sc': 'Erling Haaland', 'mn': "90+3'", 'h': 'RB Leipzig', 'a': 'Manchester City', 'sh': 2, 'sa': 3, 'side': 'a', 'og': False, 'pen': True}))
og = ({'click': BASE}, ('g', 'm|0-1|x', '2026-11-04', 'Champions League', {'sc': 'Castello Lukeba', 'mn': "37'", 'h': 'RB Leipzig', 'a': 'Manchester City', 'sh': 0, 'sa': 1, 'side': 'a', 'og': True, 'pen': False}))
ok(G['push_text'](*pen, 'en')['title'] == '⚽ Goal! Erling Haaland (pen.)' and G['push_text'](*pen, 'ar')['title'] == '⚽ هدف! Erling Haaland (ركلة جزاء)'
   and G['push_text'](*og, 'en')['title'] == '⚽ Goal! Castello Lukeba (own goal)' and 'crest' not in G['push_text'](*og, 'en'), 'penalty and own goal are named in both languages; no crest field when the message has none')
# ntfy never receives the "_crest" field
GOT = []


class R:
    status = 200
    def __enter__(self): return self
    def __exit__(self, *a): return False


G['urllib'].request.urlopen = lambda req, timeout=8: (GOT.append(json.loads(req.data.decode('utf-8'))), R())[1]
ok(G['notify_post']('http://n', m2[0][0]) and '_crest' not in GOT[0] and GOT[0]['title'] == m2[0][0]['title'], 'ntfy gets the message without the browser door\'s "_crest" field')
print(f'{fails} FAILED' if fails else 'all passed')
sys.exit(1 if fails else 0)
