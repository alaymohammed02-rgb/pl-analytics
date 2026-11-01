# Browser notifications (Web Push; the PUSH half of the NOTIFY block in sync.py). Everything but the real push services (Google, Mozilla, Apple), which cannot be
# reached from here, is run for real:
#  - the sealed mailbox: what a page seals with the public key is opened with the private one (ECDH P-256 + HKDF-SHA256 + AES-GCM, worked here with an
#    implementation of its own); a changed byte, another key, another version or junk gives nothing;
#  - the subscription messages are cleaned (an endpoint must be https, sizes are capped), the inbox topic of a fake ntfy server is read (open / keepalive
#    lines, junk and non-JSON messages are ignored, the oldest first), a later message for the same endpoint replaces the earlier, "remove" removes;
#  - a real Web Push through pywebpush to a fake push service on this machine: the request is decrypted here with http_ece using the device's own keys and the
#    VAPID signature is verified (ES256, audience, subject, expiry): a result and a reminder, in the device's language, only to the devices that follow the team;
#  - a subscription answered 410 is dropped, one answered 500 is tried again next time, nothing is sent twice, the first run only marks results, the reminder
#    window is 15 to 95 minutes, data/push_subs.json holds nothing readable, data/push_status.json says ready only with a matching secret and pywebpush.
import os, re, sys, json, base64, hashlib, datetime, threading, time
os.environ['NO_PROXY'] = os.environ['no_proxy'] = '127.0.0.1,localhost'   # the fake push service is on this machine
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import http_ece
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
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
unb = lambda s: base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
def newpair():
    k = ec.generate_private_key(ec.SECP256R1())
    return k, b64u(k.private_numbers().private_value.to_bytes(32, 'big')), b64u(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
VK, VS, VP = newpair(); BK, BS, BP = newpair()
KEYS = json.dumps({'vapid': VS, 'box': BS})
def seal(pub_b64u, obj, ver=1):
    """what the page does: an ephemeral key, ECDH with the server's public key, HKDF-SHA256 (info pla-push-v1), AES-256-GCM"""
    eph = ec.generate_private_key(ec.SECP256R1())
    srv = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), unb(pub_b64u))
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=b'', info=b'pla-push-v1').derive(eph.exchange(ec.ECDH(), srv))
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(obj, ensure_ascii=False).encode('utf-8'), None)
    return {'v': ver, 'e': b64u(eph.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)), 'i': b64u(iv), 'c': b64u(ct)}
# ---- the fake push service
SEEN = []; CODE = {}
class PS(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        SEEN.append((self.path, dict(self.headers), body))
        self.send_response(CODE.get(self.path.split('/')[-1], 201)); self.end_headers()
    def log_message(self, *a): pass
srv = HTTPServer(('127.0.0.1', 0), PS); threading.Thread(target=srv.serve_forever, daemon=True).start()
ORIGIN = 'http://127.0.0.1:%d' % srv.server_port
def device(name):
    k = ec.generate_private_key(ec.SECP256R1()); auth = os.urandom(16)
    return {'name': name, 'priv': k, 'auth': auth, 'sub': {'endpoint': '%s/push/%s' % (ORIGIN, name), 'keys': {'p256dh': b64u(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)), 'auth': b64u(auth)}}}
def decrypt(d, body): return json.loads(http_ece.decrypt(body, private_key=d['priv'], auth_secret=d['auth'], version='aes128gcm').decode('utf-8'))
def vapid_ok(h, aud, sub):
    h = {k.lower().title(): v for k, v in h.items()}
    m = re.fullmatch(r'vapid t=([\w.-]+),\s*k=([\w-]+)', h.get('Authorization', ''))
    if not m or m.group(2) != VP: return False
    head, payload, sig = m.group(1).split('.')
    claims = json.loads(unb(payload)); r, s = int.from_bytes(unb(sig)[:32], 'big'), int.from_bytes(unb(sig)[32:], 'big')
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), unb(VP)).verify(utils.encode_dss_signature(r, s), (head + '.' + payload).encode(), ec.ECDSA(hashes.SHA256()))
    except Exception: return False
    return claims.get('aud') == aud and claims.get('sub') == sub and claims.get('exp', 0) > time.time()
UTC = datetime.timezone.utc; NOW = datetime.datetime(2026, 10, 30, 12, 0, tzinfo=UTC)
NS = 'abc123abc123'; BASE = 'https://me.github.io/pla/'; HUB = {'repo': 'me/pla', 'url': BASE}
# ---- the sealed mailbox
obj = {'v': 1, 'sub': {'endpoint': 'https://push.example/x', 'keys': {'p256dh': 'a', 'auth': 'b'}}, 'teams': ['Arsenal', 'Atlético Madrid'], 'lang': 'ar'}
S = seal(BP, obj); opn = G['push_open']
ok(opn(BS, S) == obj, 'what is sealed with the public key is opened with the private key, Arabic text and accents intact')
bad = dict(S); c = bytearray(unb(S['c'])); c[3] ^= 1; bad['c'] = b64u(bytes(c))
ok(opn(BS, bad) is None and opn(VS, S) is None and opn(BS, seal(BP, obj, ver=2)) is None and opn(BS, {'v': 1}) is None and opn(BS, 'x') is None and opn('!!', S) is None, 'a changed byte, another key, another version, a missing part or junk gives nothing')
ok(G['push_public'](BS) == BP and G['push_public'](VS) == VP, 'the public key of a private key is worked out (the sync compares it with data/push.json)')
real = json.load(open(os.path.join(REPO, 'data', 'push.json'), encoding='utf-8'))
ok(real.get('v') == 1 and all(len(unb(real[k])) == 65 and unb(real[k])[0] == 4 for k in ('vapid', 'box')) and set(real) == {'v', 'vapid', 'box'}, 'the real data/push.json holds two public keys (65 bytes, uncompressed) and nothing else')
# ---- cleaning a subscription message
cl = G['push_clean']; good = {'sub': {'endpoint': 'https://fcm.googleapis.com/fcm/send/abc', 'keys': {'p256dh': 'x' * 87, 'auth': 'y' * 22}}, 'teams': ['Arsenal', 'Brighton & Hove Albion'] + ['T%d' % i for i in range(60)], 'lang': 'ar'}
c1 = cl(good)
ok(c1 and c1[0] == hashlib.sha256(good['sub']['endpoint'].encode()).hexdigest()[:16] and 'arsenal' in c1[2] and 'brighton-hove-albion' in c1[2] and len(c1[2]) == 30 and c1[3] == 'ar', 'a good subscription: an id from the endpoint, the teams as slugs (30 at most), the language')
ok(cl(dict(good, lang='fr'))[3] == 'en', 'any language but Arabic is English')
ok(all(cl(x) is None for x in [dict(good, sub=dict(good['sub'], endpoint='http://evil.example/x')), dict(good, sub=dict(good['sub'], endpoint='https://a/' + 'x' * 800)), dict(good, sub={'endpoint': 'https://a/b'}), dict(good, sub=dict(good['sub'], keys={'p256dh': 'x' * 300, 'auth': 'y'})), {}, 'x', None]), 'an endpoint that is not https, an oversize one, missing keys, oversize keys and junk are dropped')
# ---- the inbox topic of a fake ntfy
LINES = []
class NT(BaseHTTPRequestHandler):
    def do_GET(self):
        NT.path = self.path; self.send_response(200); self.end_headers(); self.wfile.write(('\n'.join(LINES) + '\n').encode('utf-8'))
    def log_message(self, *a): pass
nt = HTTPServer(('127.0.0.1', 0), NT); threading.Thread(target=nt.serve_forever, daemon=True).start()
A1 = seal(BP, dict(obj, teams=['Arsenal'])); A2 = seal(BP, dict(obj, teams=['Chelsea']))
LINES[:] = [json.dumps({'event': 'open'}), json.dumps({'event': 'message', 'time': 200, 'message': json.dumps(A2)}), 'not json', json.dumps({'event': 'keepalive'}),
            json.dumps({'event': 'message', 'time': 100, 'message': json.dumps(A1)}), json.dumps({'event': 'message', 'time': 150, 'message': 'plain text'})]
got = G['push_inbox']('http://127.0.0.1:%d' % nt.server_port, NS)
ok(got == [A1, A2] and NT.path == '/pla-%s_inbox/json?poll=1&since=12h' % NS, 'the inbox topic pla-<namespace>_inbox is read (poll, last 12 hours): sealed messages only, oldest first, open / keepalive / junk ignored')
# ---- the league data for the run
IDX = {'leagues': [{'id': 'l1', 'name': 'Premier League', 'file': 'l1.json'}]}
MATCHES = [{'i': 'm1', 'd': '2026-10-30', 'h': 'Arsenal', 'a': 'Chelsea', 's': '2-1'}, {'i': 'm2', 'd': '2026-10-29', 'h': 'Everton', 'a': 'Fulham', 's': '0-0'}]
FX = {'l1': [{'i': 'f1', 'd': '2026-10-30', 'k': '2026-10-30T12:40:00Z', 'h': 'Leeds United', 'a': 'Hull City'}, {'i': 'f2', 'd': '2026-10-30', 'k': '2026-10-30T14:30:00Z', 'h': 'Everton', 'a': 'Fulham'}]}
def setup(subs=None, state=None, keys=KEYS):
    STORE.clear(); PUT.clear(); LOG.clear(); SEEN.clear(); CODE.clear()
    STORE.update({'data/index.json': IDX, 'data/l1.json': {'matches': MATCHES}, 'data/fixtures.json': {'leagues': FX}, 'data/notify.json': {'v': 1, 'ns': NS, 'server': 'http://ntfy.test'}, 'data/push.json': {'v': 1, 'vapid': VP, 'box': BP}})
    if subs is not None: STORE['data/push_subs.json'] = {'v': 1, 'subs': subs}
    if state is not None: STORE['data/notify_state.json'] = state
    if keys is None: os.environ.pop('PUSH_KEYS', None)
    else: os.environ['PUSH_KEYS'] = keys
def run(inbox=None, state_now=NOW):
    G['sync_notify'](HUB, state_now, post=lambda s, p: True, inbox=lambda srv, ns: inbox or [])
def sealed(d, teams, lang='en'): return seal(BP, {'v': 1, 'sub': d['sub'], 'teams': teams, 'lang': lang})
DA, DB, DC, DD = device('a'), device('b'), device('c'), device('d')
OLD = {'v': 1, 'pv': 1, 'r': {}, 'm': {}, 'pr': {}, 'pm': {}}
# ---- a full run: two devices follow the teams of today's match, one follows Leeds, one nothing that happens
setup(state=OLD)
run([sealed(DA, ['Arsenal'], 'ar'), sealed(DB, ['Chelsea', 'Brentford'], 'en'), sealed(DC, ['Leeds United'], 'en'), sealed(DD, ['Wolves'], 'en')])
by = {}
for path, h, body in SEEN: by.setdefault(path.split('/')[-1], []).append((h, body))
ok(sorted((k, len(v)) for k, v in by.items()) == [('a', 1), ('b', 1), ('c', 1)], 'a result goes to the devices that follow one of its teams (a: Arsenal, b: Chelsea), a reminder to the one that follows Leeds (c): 3 pushes, none to d')
pa, pb, pc = decrypt(DA, by['a'][0][1]), decrypt(DB, by['b'][0][1]), decrypt(DC, by['c'][0][1])
ok(pa == {'title': 'Arsenal 2–1 Chelsea', 'body': 'انتهت المباراة · Premier League', 'url': BASE + '#/match/m1', 'tag': 'm1|arsenal'}, 'device a (Arabic) gets "Arsenal 2–1 Chelsea", the Arabic body, the match link and a tag')
ok(pb['body'] == 'Full time · Premier League' and pb['title'] == pa['title'] and pb['tag'] == 'm1|chelsea', 'device b (English) gets the English body for the same match')
TXP = {'en': ['A stolen win for Arsenal: Chelsea\'s chances were worth 1.9 goals to 0.4.', None], 'ar': ['فوز مسروق لـArsenal: فرص Chelsea تساوي 1.9 هدف مقابل 0.4.', 'انقلبت المباراة في الدقيقة 70.']}
KEYS = ('r', 'm1|arsenal', '2026-10-30', 'Premier League', TXP)
PL_ = {'title': 'Arsenal 2–1 Chelsea', 'click': BASE + '#/recap/m1'}
ptx = G['push_text']
ok(ptx(PL_, KEYS, 'en') == {'title': 'Arsenal 2–1 Chelsea', 'body': TXP['en'][0] + ' · Premier League', 'url': BASE + '#/recap/m1', 'tag': 'm1|arsenal'}, 'push_text: the English verdict (a missing second sentence is dropped), the league, the recap link')
ok(ptx(PL_, KEYS, 'ar')['body'] == TXP['ar'][0] + ' ' + TXP['ar'][1] + ' · Premier League', 'push_text: the Arabic device gets both Arabic sentences')
ok(ptx(PL_, KEYS[:4] + (None,), 'ar')['body'] == 'انتهت المباراة · Premier League', 'push_text: a result without a story keeps the old text')
ok(pc['title'] == 'Leeds United v Hull City' and pc['body'] == 'Kick-off 12:40 UTC · Premier League' and pc['url'] == BASE + '#/preview/f1', 'device c gets the reminder 40 minutes before kick-off, with the time and the preview link')
ok(all(vapid_ok(h, ORIGIN, 'https://me.github.io') for k in by for h, _ in by[k]), 'every request carries a valid VAPID signature (ES256, audience = the push service, subject = the origin of the site, not expired) made with the sender key')
ok(all({a.lower(): b for a, b in h.items()}.get('content-encoding') == 'aes128gcm' and int({a.lower(): b for a, b in h.items()}.get('ttl', 0)) > 0 for k in by for h, _ in by[k]), 'the body is aes128gcm and has a time to live')
S1 = STORE['data/notify_state.json']
ok(set(S1['pr']) == {'m1|arsenal', 'm1|chelsea', 'm2|everton', 'm2|fulham'} and set(S1['pm']) == {'f1|2026-10-30T12:40:00Z|leeds-united', 'f1|2026-10-30T12:40:00Z|hull-city'} and S1['pv'] == 1, 'the state remembers what went out (results and reminders, for both teams, even the one nobody follows)')
txt = json.dumps(STORE['data/push_subs.json'])
ok(len(STORE['data/push_subs.json']['subs']) == 4 and '127.0.0.1' not in txt and 'Arsenal' not in txt and 'p256dh' not in txt, 'data/push_subs.json holds 4 sealed subscriptions and nothing readable (no endpoint, no key, no team name)')
ok(STORE['data/push_status.json'] == {'v': 1, 'ready': True}, 'data/push_status.json says ready')
n0 = len(SEEN); run(); ok(len(SEEN) == n0, 'run again with the stored subscriptions and the state: nothing is sent twice')
# a later message for the same device replaces the earlier one; remove removes
n0 = len(SEEN); MATCHES.append({'i': 'm3', 'd': '2026-10-30', 'h': 'Fulham', 'a': 'Wolves', 's': '1-1'})
run([sealed(DD, ['Fulham'], 'ar')])
ok([p for p, _, _ in SEEN[n0:]] == ['/push/d'] and decrypt(DD, SEEN[n0][2])['title'] == 'Fulham 1–1 Wolves', 'a newer message from device d (now following Fulham) replaces its old one: it gets the Fulham match')
MATCHES.append({'i': 'm4', 'd': '2026-10-30', 'h': 'Fulham', 'a': 'Brentford', 's': '2-0'}); n0 = len(SEEN)
run([{'v': 1, 'e': 'x', 'i': 'y', 'c': 'z'}, seal(BP, {'v': 1, 'remove': DD['sub']['endpoint']})])
ok(all(p != '/push/d' for p, _, _ in SEEN[n0:]) and len(STORE['data/push_subs.json']['subs']) == 3, 'a "remove" message drops the device and junk in the inbox is ignored: d gets nothing more (3 devices left)')
MATCHES.pop(); MATCHES.pop()
# ---- the browser door has its own memory: the ntfy door already announced m1, the browsers still get it
setup(state={'v': 1, 'pv': 1, 'r': {'m1|arsenal': '2026-10-30', 'm1|chelsea': '2026-10-30'}, 'm': {}, 'pr': {}, 'pm': {}})
run([sealed(DA, ['Arsenal'], 'en')])
ok([decrypt(DA, b)['title'] for _, _, b in SEEN] == ['Arsenal 2\u20131 Chelsea'], 'the browser door has its own memory: a result the ntfy door already announced is still sent to browsers')
# ---- the first run of this door marks results and sends only reminders
setup(state={'v': 1, 'r': {}, 'm': {}})
run([sealed(DA, ['Arsenal', 'Leeds United'], 'en')])
ok([decrypt(DA, b)['title'] for _, _, b in SEEN] == ['Leeds United v Hull City'] and set(STORE['data/notify_state.json']['pr']) == {'m1|arsenal', 'm1|chelsea', 'm2|everton', 'm2|fulham'} and STORE['data/notify_state.json']['pv'] == 1,
   'first run (no browser history yet): the 4 results already there are marked, not sent; the reminder is sent')
# ---- the reminder window: 15 to 95 minutes
setup(state=OLD, subs={}); FX['l1'] = [{'i': 'w1', 'd': '2026-10-30', 'k': '2026-10-30T13:30:00Z', 'h': 'Wolves', 'a': 'Brentford'}, {'i': 'w2', 'd': '2026-10-30', 'k': '2026-10-30T12:10:00Z', 'h': 'Wolves', 'a': 'Burnley'}, {'i': 'w3', 'd': '2026-10-30', 'k': '2026-10-30T13:40:00Z', 'h': 'Wolves', 'a': 'Leeds United'}]
run([sealed(DA, ['Wolves'], 'en')])
ok([decrypt(DA, b)['title'] for p, _, b in SEEN] == ['Wolves v Brentford'], 'reminders: 90 minutes away is sent, 10 minutes away is too late, 100 minutes away is too early (it waits for a later sync)')
FX['l1'] = [{'i': 'f1', 'd': '2026-10-30', 'k': '2026-10-30T12:40:00Z', 'h': 'Leeds United', 'a': 'Hull City'}, {'i': 'f2', 'd': '2026-10-30', 'k': '2026-10-30T14:30:00Z', 'h': 'Everton', 'a': 'Fulham'}]
# ---- a subscription that is gone, and one that fails
setup(state=OLD); CODE['b'] = 410
run([sealed(DA, ['Arsenal'], 'en'), sealed(DB, ['Chelsea'], 'en')])
ok(len(STORE['data/push_subs.json']['subs']) == 1 and 'm1|chelsea' in STORE['data/notify_state.json']['pr'], 'the push service answers 410 for device b: it is dropped, and the message is not kept waiting for it')
setup(state=OLD); CODE['b'] = 500
run([sealed(DB, ['Chelsea'], 'en')])
ok(len(STORE['data/push_subs.json']['subs']) == 1 and 'm1|chelsea' not in STORE['data/notify_state.json']['pr'] and 'm1|arsenal' in STORE['data/notify_state.json']['pr'], 'an answer of 500 keeps the device and leaves that message unsent (marked only when someone received it): the next sync tries again')
CODE.clear(); n0 = len(SEEN); run()
ok(len(SEEN) == n0 + 1 and decrypt(DB, SEEN[-1][2])['title'] == 'Arsenal 2–1 Chelsea' and 'm1|chelsea' in STORE['data/notify_state.json']['pr'], 'and it does, once the service answers again (one push, then marked)')
# ---- when it is not ready
setup(state=OLD, keys=None); run([sealed(DA, ['Arsenal'], 'en')])
ok(SEEN == [] and STORE['data/push_status.json'] == {'v': 1, 'ready': False} and 'data/push_subs.json' not in PUT and not STORE['data/notify_state.json'].get('pr') and any('مو جاهزة' in m for m in LOG), 'no PUSH_KEYS: nothing is sent or stored for browsers, the status says not ready, the ntfy door still saves its state')
setup(state=OLD, keys=json.dumps({'vapid': VS, 'box': newpair()[1]})); run([sealed(DA, ['Arsenal'], 'en')])
ok(SEEN == [] and STORE['data/push_status.json']['ready'] is False, 'keys that do not match data/push.json: not ready')
setup(state=OLD, keys='not json'); run()
ok(STORE['data/push_status.json']['ready'] is False, 'a secret that is not JSON: not ready, no error')
setup(state=OLD); sys.modules['pywebpush'] = None
run([sealed(DA, ['Arsenal'], 'en')]); del sys.modules['pywebpush']
ok(SEEN == [] and STORE['data/push_status.json']['ready'] is False and any('pywebpush' in m for m in LOG), 'pywebpush missing on the runner: not ready (the log says why), the sync goes on')
setup(state=OLD); os.environ['PLA_NOTIFY'] = '0'; run([sealed(DA, ['Arsenal'], 'en')]); del os.environ['PLA_NOTIFY']
ok(SEEN == [] and not PUT, 'PLA_NOTIFY=0: nothing happens')
# a failing inbox does not stop the run
setup(state=OLD); G['push_inbox'] = lambda s, n: (_ for _ in ()).throw(OSError('down'))
G['sync_notify'](HUB, NOW, post=lambda s, p: True)
ok(STORE['data/push_status.json']['ready'] is True and any('صندوق الوارد' in m for m in LOG) and 'data/notify_state.json' in PUT, 'an inbox that cannot be read is said in the log and the run goes on with the subscriptions it has')
# the cap
setup(state=OLD); many = {'k%03d' % i: {'s': sealed(device('x%d' % i), ['Arsenal']), 't': '2026-10-%02d' % (1 + i % 28)} for i in range(260)}
STORE['data/push_subs.json'] = {'v': 1, 'subs': many}
G['push_inbox'] = lambda s, n: []; G['sync_notify'](HUB, NOW, post=lambda s, p: True)
ok(len(STORE['data/push_subs.json']['subs']) <= 200, 'at most 200 subscriptions are kept (260 given)')
srv.shutdown(); nt.shutdown()
print('1 FAILED' if fails == 1 else ('%d FAILED' % fails if fails else 'all passed'))
sys.exit(1 if fails else 0)
