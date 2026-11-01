# Notifications (the block between "NOTIFY START" and "NOTIFY END" in sync.py): the topic name of a team (accents, ø, ł, ß, "&" folded; at most 64 characters),
# the plan on made-up leagues and fixtures worked by hand (a result is sent to the topic of both teams with the score, the first run only marks the results,
# a match older than 2 days is never announced, a reminder is queued with ntfy's own delay an hour before the kick-off when the kick-off is between 15 minutes and
# 48 hours away and is sent at once when it is closer than an hour, nothing is sent twice, a moved kick-off is reminded again, old entries are dropped), the step with
# GitHub stubbed (what it writes, the limit of 80 per run, three failures in a row stop it and nothing failed is marked as sent, PLA_NOTIFY=0 and a missing
# data/notify.json do nothing), the real request against a fake ntfy server on this machine (a JSON body in UTF-8 that ntfy accepts: topic, title, message, tags,
# click, delay), and the real data/notify.json.
import os, re, sys, json, datetime, threading, unicodedata
from http.server import BaseHTTPRequestHandler, HTTPServer
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
cut = lambda a, b: src[src.index(a):src.index(b)]
LOG = []; PUT = {}; STORE = {}
G = {'os': os, 're': re, 'json': json, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))), 'run_pipeline': lambda hub, k: True,
     'gh_get_json': lambda hub, p: STORE.get(p), 'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(cut('# ===== NOTIFY START =====', '# ===== NOTIFY END ====='), G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
slug, topic, plan = G['notify_slug'], G['notify_topic'], G['notify_plan']
UTC = datetime.timezone.utc
NOW = datetime.datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
# ---- the name of a topic
CASES = {'Arsenal': 'arsenal', 'Brighton & Hove Albion': 'brighton-hove-albion', 'Atlético Madrid': 'atletico-madrid', 'FC Köln': 'fc-koln', 'Paris Saint-Germain': 'paris-saint-germain',
         'Brøndby IF': 'brondby-if', 'Łódź': 'lodz', 'Beşiktaş JK': 'besiktas-jk', 'Bayern München': 'bayern-munchen', 'Weiß-Rot': 'weiss-rot', 'Hull City': 'hull-city', '1. FC Union Berlin': '1-fc-union-berlin',
         'İstanbul': 'istanbul', '???': 'team', 'A' * 80: 'a' * 47}
ok(all(slug(k) == v for k, v in CASES.items()), 'a team name becomes a slug: ' + '; '.join('%s → %s' % (k[:22], v) for k, v in list(CASES.items())[:6]))
ok(topic('6f51372a0210', 'Brighton & Hove Albion') == 'pla-6f51372a0210-brighton-hove-albion', 'topic = pla-<namespace>-<slug>')
ok(len(topic('6f51372a0210', 'A' * 90)) <= 64 and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', topic('6f51372a0210', 'Łódź & Ñ')), 'a topic is at most 64 characters of A-Z a-z 0-9 _ - (what ntfy accepts)')
# ---- the plan, by hand
NS, BASE = 'abc123abc123', 'https://me.github.io/pla/'
L = [('l1', 'Premier League', [
  {'i': 'm1', 'd': '2026-10-30', 'h': 'Arsenal', 'a': 'Chelsea', 's': '2-1'},      # finished today
  {'i': 'm2', 'd': '2026-10-26', 'h': 'Everton', 'a': 'Fulham', 's': '0-0'},       # more than 2 days old: not announced
  {'i': 'm3', 'd': '2026-10-31', 'h': 'Leeds United', 'a': 'Hull City', 's': ''},  # not played
  {'i': 'm4', 'd': '2026-10-29', 'h': 'Aston Villa', 'a': 'Brentford', 's': '3-3'}])]  # yesterday
FX = {'l1': [{'i': 'f1', 'd': '2026-10-30', 'k': '2026-10-30T12:40:00Z', 'h': 'Leeds United', 'a': 'Hull City'},    # in 40 minutes: sent at once
             {'i': 'f2', 'd': '2026-10-30', 'k': '2026-10-30T12:10:00Z', 'h': 'Everton', 'a': 'Fulham'},           # in 10 minutes: too late
             {'i': 'f3', 'd': '2026-10-31', 'k': '2026-10-31T12:30:00Z', 'h': 'Chelsea', 'a': 'Manchester United'},  # in 24.5 hours: delayed
             {'i': 'f4', 'd': '2026-11-02', 'k': '2026-11-02T15:00:00Z', 'h': 'Arsenal', 'a': 'Brentford'}]}      # more than 48 hours away
M, st = plan(L, FX, {'v': 1, 'r': {}, 'm': {}}, NOW, BASE, NS)
by = {}
for p, k in M: by.setdefault((k[0], k[1].split('|')[0]), []).append((p, k))
ok(sorted(k for k in by) == [('m', 'f1'), ('m', 'f3'), ('r', 'm1'), ('r', 'm4')], 'a result today and one yesterday, a reminder in 40 minutes and one in 24 hours: nothing for the old match, the unplayed one, the one in 10 minutes or the one 3 days away')
r1 = by[('r', 'm1')]
ok(sorted(p['topic'] for p, _ in r1) == [topic(NS, 'Arsenal'), topic(NS, 'Chelsea')], 'a result goes to the topic of both teams')
p = r1[0][0]
ok(p['title'] == 'Arsenal 2–1 Chelsea' and p['click'] == BASE + '#/match/m1' and p['tags'] == ['soccer'] and 'Premier League' in p['message'] and 'delay' not in p, 'the result: title "Arsenal 2–1 Chelsea", the link to the match page, a soccer tag, the league, sent now')
f1 = by[('m', 'f1')][0][0]; f3 = by[('m', 'f3')][0][0]
ok('delay' not in f1 and f1['title'] == 'Leeds United v Hull City' and 'Kick-off 12:40 UTC' in f1['message'] and f1['click'] == BASE + '#/preview/f1' and f1['tags'] == ['alarm_clock'], 'a kick-off in 40 minutes: reminder sent now, with the time and the preview link')
ko3 = datetime.datetime(2026, 10, 31, 12, 30, tzinfo=UTC)
ok(f3['delay'] == str(int((ko3 - datetime.timedelta(minutes=60)).timestamp())) and {p['topic'] for p, _ in by[('m', 'f3')]} == {topic(NS, 'Chelsea'), topic(NS, 'Manchester United')}, 'a kick-off in 24.5 hours: queued with ntfy\'s delay = 11:30 UTC the day after, for both teams')
ok(all(k[2] == '2026-10-30' for _, k in r1) and all(k[0] == 'r' for _, k in r1), 'each message names the key it settles (match | team) and its date')
# a second run with that state: nothing again
S2 = st
for p, k in M: S2['r' if k[0] == 'r' else 'm'][k[1]] = k[2]
M2, _ = plan(L, FX, S2, NOW, BASE, NS)
ok(M2 == [], 'a second run with the state: nothing is sent twice')
FX2 = {'l1': [dict(FX['l1'][2], k='2026-10-31T14:00:00Z')]}
M3, _ = plan(L, FX2, S2, NOW, BASE, NS)
ok(len(M3) == 2 and all('delay' in p for p, _ in M3), 'a moved kick-off is reminded again at its new time')
# first run: results marked, reminders still queued
M4, st4 = plan(L, FX, None, NOW, BASE, NS)
ok(all(k[0] == 'm' for _, k in M4) and len(M4) == 4 and len(st4['r']) == 4, 'first run: the 4 results of the last 2 days (2 matches x 2 teams) are marked as announced and not sent, the old one is ignored; the 4 reminders are queued')
# old entries are dropped
OLD = {'v': 1, 'r': {'x|a': '2026-10-01', 'y|b': '2026-10-28'}, 'm': {'z|k|c': '2026-10-02'}}
_, st5 = plan([], {}, OLD, NOW, BASE, NS)
ok(list(st5['r']) == ['y|b'] and st5['m'] == {}, 'entries older than 10 days are dropped from the state')
# ---- the step with GitHub stubbed
IDX = {'leagues': [{'id': 'l1', 'name': 'Premier League', 'file': 'l1.json'}, {'id': 'l2', 'name': 'Cup', 'file': None}]}
def setup(state=None, cfg=True):
    STORE.clear(); PUT.clear(); LOG.clear()
    STORE.update({'data/index.json': IDX, 'data/l1.json': {'matches': L[0][2]}, 'data/fixtures.json': {'leagues': FX}})
    if cfg: STORE['data/notify.json'] = {'v': 1, 'ns': NS, 'server': 'http://ntfy.test'}
    if state is not None: STORE['data/notify_state.json'] = state
HUB = {'repo': 'me/pla', 'url': BASE}
SENT = []
setup({'v': 1, 'r': {}, 'm': {}})
G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append((srv, pl)), True)[1])
ok(len(SENT) == 8 and all(s == 'http://ntfy.test' for s, _ in SENT), 'the step sends 8 messages (2 results x 2 teams, 2 reminders x 2 teams) to the server in data/notify.json')
S = PUT['data/notify_state.json']
ok(len(S['r']) == 4 and len(S['m']) == 4, 'and writes the state with what it sent (4 results, 4 reminders)')
SENT.clear(); G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append(pl), True)[1])
ok(SENT == [], 'run again: nothing is sent')
# the step reads data/story.json: a result with a story goes out as the verdict
setup({'v': 1, 'r': {}, 'm': {}}); STORE['data/story.json'] = {'m': {'m1': {'tx': {'en': ['E1', None], 'ar': ['A1', None]}}}}; SENT.clear()
G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append(pl), True)[1])
sm1 = [pl for pl in SENT if pl['click'].endswith('#/recap/m1')]
ok(len(sm1) == 2 and all(pl['message'] == 'E1\nA1\nPremier League' for pl in sm1) and len(SENT) == 8, 'the step reads data/story.json: the result of m1 goes out as the verdict to both teams, the other messages are unchanged')
setup({'v': 1, 'r': {}, 'm': {}}); STORE['data/story.json'] = 'broken'; SENT.clear()
G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append(pl), True)[1])
ok(len(SENT) == 8 and not [1 for pl in SENT if '#/recap/' in pl['click']], 'a broken data/story.json: everything goes out as before')
# a failing host: nothing failed is marked, and three failures in a row stop the run
setup({'v': 1, 'r': {}, 'm': {}}); CALLS = []
def bad(srv, pl): CALLS.append(pl); raise OSError('down')
G['sync_notify'](HUB, NOW, post=bad)
ok(len(CALLS) == 3 and PUT['data/notify_state.json']['r'] == {} and PUT['data/notify_state.json']['m'] == {}, 'the host is down: it stops after 3 failures in a row and marks nothing as sent (the next sync tries again)')
# one failure in the middle does not stop it
setup({'v': 1, 'r': {}, 'm': {}}); n = [0]
def flaky(srv, pl):
    n[0] += 1
    return n[0] != 2
G['sync_notify'](HUB, NOW, post=flaky)
ok(n[0] == 8 and len(PUT['data/notify_state.json']['r']) + len(PUT['data/notify_state.json']['m']) == 7, 'one message fails among 8: the other 7 are sent and marked, the failed one is left for the next run')
# the limit per run
big = [{'i': 'b%d' % i, 'd': '2026-10-30', 'h': 'Team %d' % i, 'a': 'Other %d' % i, 's': '1-0'} for i in range(60)]
setup({'v': 1, 'r': {}, 'm': {}}); STORE['data/l1.json'] = {'matches': big}; STORE['data/fixtures.json'] = {'leagues': {}}; SENT.clear()
G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append(pl), True)[1])
ok(len(SENT) == 80 and len(PUT['data/notify_state.json']['r']) == 80 and any('تبقّى' in m for m in LOG), '120 messages are due: 80 go out, the rest wait for the next sync (said in the log)')
setup({'v': 1, 'r': PUT['data/notify_state.json']['r'], 'm': {}}); STORE['data/l1.json'] = {'matches': big}; STORE['data/fixtures.json'] = {'leagues': {}}; SENT.clear()
G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append(pl), True)[1])
ok(len(SENT) == 40, 'the next run sends the other 40')
# off switches
setup({'v': 1, 'r': {}, 'm': {}}, cfg=False); SENT.clear()
G['sync_notify'](HUB, NOW, post=lambda srv, pl: SENT.append(pl) or True)
ok(SENT == [] and not PUT, 'no data/notify.json: nothing is sent, nothing is written')
setup({'v': 1, 'r': {}, 'm': {}}); os.environ['PLA_NOTIFY'] = '0'
G['sync_notify'](HUB, NOW, post=lambda srv, pl: SENT.append(pl) or True)
ok(SENT == [] and not PUT, 'PLA_NOTIFY=0: nothing is sent, nothing is written'); del os.environ['PLA_NOTIFY']
# the first real run: no state file at all
setup(None); SENT.clear()
G['sync_notify'](HUB, NOW, post=lambda srv, pl: (SENT.append(pl), True)[1])
ok(len(SENT) == 4 and all('alarm_clock' in p['tags'] for p in SENT) and len(PUT['data/notify_state.json']['r']) == 4, 'no state file yet: only the 4 reminders are sent, and the 4 results already there are marked')
# the wrapper: another name for the previous pipeline than the others (a repeated name made run_pipeline call itself once)
names = re.findall(r'^_orig_run_pipeline_(\w+) = run_pipeline', src, re.M)
ok(len(names) == len(set(names)) and 'notify' in names, 'the wrapped pipeline has its own name (%s)' % ', '.join(names))
# ---- with a story (data/story.json["m"]): the verdict replaces "Full time", the link opens the recap
TX = {'en': ['Arsenal deserved it: their chances were worth 2.4 goals to 0.9.', "The match turned in minute 78, when Arsenal's chance of winning went from 31% to 78%."],
      'ar': ['Arsenal يستاهل الفوز: فرصه تساوي 2.4 هدف مقابل 0.9.', 'انقلبت المباراة في الدقيقة 78 لما ارتفعت فرصة فوز Arsenal من 31% إلى 78%.']}
STORY = {'m1': {'tx': TX}, 'm4': {'tx': {'en': ['', None], 'ar': ['', None]}}}
Ms, _ = plan(L, FX, {'v': 1, 'r': {}, 'm': {}}, NOW, BASE, NS, story=STORY)
r1s = [(p, k) for p, k in Ms if k[0] == 'r' and k[1].startswith('m1|')]
ok(len(r1s) == 2 and all(p['message'] == TX['en'][0] + '\n' + TX['ar'][0] + '\nPremier League' and p['click'] == BASE + '#/recap/m1' and k[4] == TX for p, k in r1s), 'a result with a story: the English and Arabic verdict sentences and the league, the link to the recap, the sentences in the key')
ok(all(p['title'] == 'Arsenal 2–1 Chelsea' and p['tags'] == ['soccer'] and 'delay' not in p for p, _ in r1s), 'a result with a story keeps the score title and the tag')
r4s = [(p, k) for p, k in Ms if k[0] == 'r' and k[1].startswith('m4|')]
ok(len(r4s) == 2 and all('Full time' in p['message'] and p['click'] == BASE + '#/match/m4' and k[4] is None for p, k in r4s), 'a result whose story has an empty sentence is announced as before (no verdict, match link)')
ok([k for _, k in Ms if k[0] == 'm'] == [k for _, k in M if k[0] == 'm'], 'reminders are the same with or without stories')
done = {'v': 1, 'r': {'m1|arsenal': '2026-10-30', 'm1|chelsea': '2026-10-30'}, 'm': {}}
Md, _ = plan(L, FX, done, NOW, BASE, NS, story=STORY)
ok(not [1 for _, k in Md if k[1].startswith('m1|')], 'a result already announced plainly is not announced again when its story shows up')
# ---- the real request against a fake ntfy server
GOT = []
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        GOT.append((self.path, self.headers.get('Content-Type'), body))
        self.send_response(200); self.end_headers(); self.wfile.write(b'{}')
    def log_message(self, *a): pass
srv = HTTPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
pl = {'topic': topic(NS, 'Atlético Madrid'), 'title': 'Atlético Madrid 1–0 Sevilla', 'message': 'Full time · انتهت المباراة', 'tags': ['soccer'], 'click': BASE + '#/match/m9', 'delay': '1793448600'}
ok(G['notify_post']('http://127.0.0.1:%d' % srv.server_port, pl) is True, 'a real POST to a server on this machine succeeds')
path, ctype, body = GOT[0]
ok(path == '/' and ctype.startswith('application/json') and json.loads(body.decode('utf-8')) == pl, 'it is a POST to the server root with a UTF-8 JSON body that holds exactly the message (the Arabic survives)')
pl2 = r1s[0][0]
ok(G['notify_post']('http://127.0.0.1:%d' % srv.server_port, pl2) is True and json.loads(GOT[1][2].decode('utf-8')) == pl2, 'the story message also goes out as UTF-8 JSON with the Arabic intact')
srv.shutdown()
try:
    G['notify_post']('http://127.0.0.1:1', pl, timeout=1); bad_ok = False
except Exception:
    bad_ok = True
ok(bad_ok, 'a server that cannot be reached raises (the step counts it as a failure)')
# ---- the real file
cfg = json.load(open(os.path.join(REPO, 'data', 'notify.json'), encoding='utf-8'))
ok(re.fullmatch(r'[0-9a-f]{12}', cfg.get('ns', '')) and cfg.get('server') == 'https://ntfy.sh' and cfg.get('v') == 1, 'data/notify.json holds a 12-character namespace and the ntfy.sh server: ' + json.dumps(cfg))
IDXR = json.load(open(os.path.join(REPO, 'data', 'index.json'), encoding='utf-8'))
names = set()
for l in IDXR['leagues']:
    if l.get('file') and os.path.exists(os.path.join(REPO, 'data', l['file'])):
        for m in json.load(open(os.path.join(REPO, 'data', l['file']), encoding='utf-8')).get('matches') or []:
            names.update([m['h'], m['a']])
tp = {}
for n in names: tp.setdefault(topic(cfg['ns'], n), set()).add(n)
dup = {k: v for k, v in tp.items() if len(v) > 1}
ok(len(names) > 100 and all(re.fullmatch(r'[A-Za-z0-9_-]{1,64}', t) for t in tp), 'every team of every league in the data (%d) has a valid topic' % len(names))
ok(not dup, 'no two teams in the data share a topic' + (' — ' + str(dup) if dup else ''))
print('1 FAILED' if fails == 1 else ('%d FAILED' % fails if fails else 'all passed'))
sys.exit(1 if fails else 0)
