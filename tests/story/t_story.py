# Full-time verdict (the block between "STORY START" and "STORY END" in sync.py): the engine worked by hand (goals from shots with own goals for the other
# side and added time, chances from shot xG, the verdict words and their fixed cut-offs, the goal rates that match Elo's pre-match chances, the win-probability
# curve and its turning point, the bilingual sentences), the accuracy measurement, the sync step with GitHub stubbed, and the real data/story.json.
import os, re, sys, json, math, random, hashlib, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
cut = lambda a, b: src[src.index(a):src.index(b)]
LOG = []; PUT = {}; STORE = {}
G = {'os': os, 're': re, 'json': json, 'math': math, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: LOG.append(' '.join(map(str, a))),
     'run_pipeline': lambda hub, k: True, 'gh_get_json': lambda hub, p: STORE.get(p),
     'gh_put': lambda hub, p, c, m: (PUT.__setitem__(p, json.loads(c)), STORE.__setitem__(p, json.loads(c)))}
exec(cut('# ===== STORY START =====', '# ===== STORY END ====='), G)
fails = 0
def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c: fails += 1
near = lambda a, b, e=1e-6: abs(a - b) <= e

# ---- goals from shots
def row(ev='Goal', c='A', mn=10, ma=None, og=0, xg=0.1):
    return {'ev': ev, 'c': c, 'mn': float(mn), 'ma': ma, 'og': og, 'xg': xg}
R = [row(c='A', mn=11), row(c='A', mn=30, og=1), row(c='B', mn=90, ma=4), row(c='B', mn=90, ma=1), row('Miss', 'A', 5)]
ok(G['story_goals'](R, 'A', 'B') == [(11, 0, 'h'), (30, 0, 'a'), (90, 1, 'a'), (90, 4, 'a')], 'goals: own goal goes to the other side, sorted by minute then added minute, misses ignored')
ok(G['story_goals']([row(c='C')], 'A', 'B') is None, 'goals: a club that is neither side -> None')
# ---- chances
x, y, ph = G['story_chances']([row('Miss', 'A', xg=0.5), row('Goal', 'A', xg=0.5), row('Miss', 'A', xg=None), row('Goal', 'A', og=1, xg=0.9)], 'A', 'B')
ok(near(x, 1.0) and y == 0 and all(near(a, b) for a, b in zip(ph, [0.75, 0.25, 0.0])), 'chances: two 0.5 shots -> xG 1.0, P(win) 0.75, draw 0.25; xg None and own goals ignored')
x, y, ph = G['story_chances']([row('Miss', 'A', xg=0.2), row('Miss', 'B', xg=0.6)], 'A', 'B')
ok(near(sum(ph), 1.0), 'chances: probabilities add to 1')
ok(near(ph[0], 0.2 * 0.4) and near(ph[2], 0.8 * 0.6), 'chances: 0.2 against 0.6 -> home wins only if home scores and away does not (0.08), away wins 0.48')
# ---- verdict
V = G['story_verdict']
ok(V((2, 1), 2.4, 0.9, [0.86, 0.1, 0.04]) == {'vs': 'h', 'vd': 'deserved'}, 'verdict: 2-1 on 2.4 v 0.9 -> deserved')
ok(V((1, 0), 0.4, 1.9, [0.07, 0.2, 0.73]) == {'vs': 'h', 'vd': 'lucky'}, 'verdict: 1-0 on 0.4 v 1.9 -> lucky')
ok(V((1, 0), 1.1, 1.0, [0.40, 0.3, 0.30])['vd'] == 'close', 'verdict: 1-0 on 1.1 v 1.0 -> close')
ok(V((0, 1), 1.0, 1.1, [0.30, 0.3, 0.40]) == {'vs': 'a', 'vd': 'close'}, 'verdict: away win mirrors')
ok(V((1, 0), 1.5, 1.2, [0.10, 0.3, 0.60])['vd'] == 'close', 'verdict: low win chance but the winner had more xG -> close, not lucky')
ok(V((1, 1), 1.2, 1.1, [0.36, 0.3, 0.34]) == {'vs': 'd', 'vd': 'fair'}, 'verdict: 1-1 level chances -> fair')
ok(V((0, 0), 0.2, 2.1, [0.02, 0.1, 0.88]) == {'vs': 'd', 'vd': 'saved'}, 'verdict: 0-0 against a side with the chances -> saved')
# ---- goal rates and probabilities
lh, la = G['story_rates']([0.5, 0.25, 0.25], 2.6)
p = G['story_p'](0, 1.0, lh, la)
ok(near(lh + la, 2.6) and near(p[0] - p[2], 0.25, 1e-5), 'rates: add up to 2.6 and reproduce P(home) - P(away) = 0.25')
lh, la = G['story_rates']([0.3, 0.3, 0.3], 2.6)
ok(near(lh, la), 'rates: equal chances -> equal rates')
ok(G['story_p'](1, 0.0, 1.3, 1.3) == (1.0, 0.0, 0.0) and G['story_p'](-1, 0.0, 1.3, 1.3) == (0.0, 0.0, 1.0), 'p: nothing left to play -> the leader wins')
# ---- curve
pre = [0.5, 0.25, 0.25]
C0 = G['story_curve']([], pre, 2.6)
ok(C0[0][0] == 0 and near(C0[0][1] - (1 - C0[0][1] - C0[0][2]), 0.25, 2e-3), 'curve: the first point repeats the pre-match chances')
ok(C0[-1] == [90, 0.0, 1.0], 'curve: 0-0 ends on a certain draw')
C1 = G['story_curve']([(11, 0, 'h')], pre, 2.6)
ok(C1[-1] == [90, 1.0, 0.0] and any(c[0] == 11 for c in C1) and [c[0] for c in C1] == sorted(c[0] for c in C1), 'curve: 1-0 ends on a certain home win, minutes ascend, the goal has a point')
i = [c[0] for c in C1].index(11)
ok(C1[i][1] > C1[i - 1][1] + 0.1, 'curve: a home goal lifts the home chance')
C2 = G['story_curve']([(90, 4, 'a')], pre, 2.6)
ok(C2[-1] == [90, 0.0, 0.0] and all(0 <= c[1] <= 1 and 0 <= c[2] <= 1 for c in C2), 'curve: added-time goal never gives a negative time left (away win -> 0, 0 at 90)')
# ---- turning point
T = G['story_turn']
tp = T([(11, 0, 'h'), (60, 0, 'a'), (80, 0, 'a')], pre, 2.6, 'a')
ok(tp is not None and tp['m'] in (60, 80) and tp['side'] == 'a' and tp['b'] > tp['a'], 'turning: the goal that lifted the winner most (a 1-0 lead turned by the away goals)')
ok(T([], pre, 2.6, 'd') is None, 'turning: no goals -> None')
tp = T([(20, 0, 'h'), (70, 0, 'a')], pre, 2.6, 'd')
ok(tp['m'] == 70 and tp['side'] is None and tp['b'] > tp['a'], 'turning: a draw settles with the equaliser')
# ---- text
E = {'s': '2-1', 'x': [2.4, 0.9], 'pv': [0.86, 0.1, 0.04], 'vs': 'h', 'vd': 'deserved', 'tp': {'m': 78, 'side': 'h', 'a': 31, 'b': 78}}
t = G['story_text'](E, 'Barcelona', 'Real Madrid')
ok(t['en'] == ['Barcelona deserved it: their chances were worth 2.4 goals to 0.9.', 'The match turned in minute 78, when Barcelona\'s chance of winning went from 31% to 78%.'], 'text: deserved + turning (English)')
ok(t['ar'][0] == 'Barcelona يستاهل الفوز: فرصه تساوي 2.4 هدف مقابل 0.9.' and t['ar'][1] == 'انقلبت المباراة في الدقيقة 78 لما ارتفعت فرصة فوز Barcelona من 31% إلى 78%.', 'text: deserved + turning (Arabic)')
E2 = dict(E, x=[0.4, 1.9], vd='lucky', tp=None)
t = G['story_text'](E2, 'Barcelona', 'Real Madrid')
ok(t['en'] == ["A stolen win for Barcelona: Real Madrid's chances were worth 1.9 goals to 0.4.", None] and t['ar'][0] == 'فوز مسروق لـBarcelona: فرص Real Madrid تساوي 1.9 هدف مقابل 0.4.' and t['ar'][1] is None, 'text: lucky, no turning sentence')
t = G['story_text'](dict(E, vd='close', x=[1.1, 1.0], tp=None), 'Barcelona', 'Real Madrid')
ok(t['en'][0] == 'A close call: Barcelona won, but the chances (1.1 to 1.0) could have gone either way.' and t['ar'][0] == 'مباراة متقاربة: فاز Barcelona، لكن الفرص (1.1 مقابل 1.0) كان ممكن تروح للطرفين.', 'text: close')
t = G['story_text']({'s': '1-1', 'x': [1.2, 1.1], 'pv': [0.36, 0.3, 0.34], 'vs': 'd', 'vd': 'fair', 'tp': {'m': 70, 'side': None, 'a': 22, 'b': 61}}, 'A', 'B')
ok(t['en'] == ['A fair draw: the chances were close (1.2 to 1.1).', 'The draw settled in minute 70, when the chance of a draw went from 22% to 61%.'] and t['ar'] == ['تعادل عادل: الفرص متقاربة (1.2 مقابل 1.1).', 'استقر التعادل في الدقيقة 70 لما تغيّرت فرصته من 22% إلى 61%.'], 'text: fair draw + draw turning')
t = G['story_text']({'s': '0-0', 'x': [0.2, 2.1], 'pv': [0.02, 0.1, 0.88], 'vs': 'd', 'vd': 'saved', 'tp': None}, 'A', 'B')
ok(t['en'][0] == "A took a point they did not earn: B's chances were worth 2.1 goals to 0.2." and t['ar'][0] == 'A أخذ نقطة ما استحقها: فرص B تساوي 2.1 هدف مقابل 0.2.', 'text: saved')

# ---- accuracy
ok(G['story_total']([]) == 2.6 and G['story_total']([(1, 1)] * 29) == 2.6 and near(G['story_total']([(2, 1)] * 20 + [(1, 0)] * 10), 2.333333333), 'total: 2.6 until 30 matches, then the mean total goals')
def item(sc, rows, pre=[0.5, 0.25, 0.25]):
    return {'score': sc, 'rows': rows, 'home': 'A', 'away': 'B', 'pre': pre, 'total': 2.6}
IT = [item((1, 0), [row('Goal', 'A', 11, xg=0.4), row('Miss', 'B', 20, xg=0.9)]),
      item((0, 0), [row('Miss', 'A', 20, xg=0.3)], None),
      item((1, 2), [row('Goal', 'A', 30, xg=0.5), row('Goal', 'B', 50, xg=0.2), row('Goal', 'B', 88, xg=0.1)])]
acc = G['story_accuracy'](IT)
ok(acc['n'] == 3 and near(acc['xg_goals']['xg'], 0.4 + 0.9 + 0.3 + 0.5 + 0.2 + 0.1) and acc['xg_goals']['goals'] == 4, 'accuracy: counts, total xG and goals')
ok(sum(acc['shares'].values()) == 3 and set(acc['shares']) == {'deserved', 'close', 'lucky', 'fair', 'saved'}, 'accuracy: every match gets one verdict word')
ok(acc['curve']['60']['n'] == 2 and acc['curve']['30']['n'] == 2 and acc['curve']['75']['n'] == 2, 'accuracy: the curve is scored only on matches with an Elo prediction')
# worked by hand: match 2 (0-0, chance-based [0, ...]) -> its Brier is (p_h)^2 + (1-p_d)^2 + p_a^2 with p from one 0.3 shot: home wins 0.3, draw 0.7, away 0
b2 = 0.3 ** 2 + 0.3 ** 2 + 0
b1 = G['story_chances'](IT[0]['rows'], 'A', 'B')[2]; b3 = G['story_chances'](IT[2]['rows'], 'A', 'B')[2]
br = lambda p, o: sum((p[i] - (1 if i == o else 0)) ** 2 for i in range(3))
ok(near(acc['brier_chances'], (br(b1, 0) + b2 + br(b3, 2)) / 3, 1e-4), 'accuracy: Brier of the shot-based chances worked by hand')
rates = [1 / 3, 1 / 3, 1 / 3]
ok(near(acc['brier_rates'], sum(br(rates, o) for o in (0, 1, 2)) / 3, 1e-4), 'accuracy: Brier of the league rates on the same matches (one home win, one draw, one away win)')
# a model checked against its own world: goals drawn at random minutes from the same rates the curve assumes
rnd = random.Random(7)
def pois(l):
    k, t, L = 0, rnd.random(), math.exp(-l)
    p = L; c = L
    while t > c and k < 20:
        k += 1; p *= l / k; c += p
    return k
SYN = []
for _ in range(6000):
    lh_, la_ = rnd.uniform(0.7, 2.1), rnd.uniform(0.5, 1.8)
    pp = G['story_p'](0, 1.0, lh_, la_)
    gl = [(rnd.randint(1, 90), 'h') for _ in range(pois(lh_))] + [(rnd.randint(1, 90), 'a') for _ in range(pois(la_))]
    rws = [row('Goal', 'A' if sd == 'h' else 'B', mn, xg=0.2) for mn, sd in gl]
    SYN.append({'score': (sum(1 for g in gl if g[1] == 'h'), sum(1 for g in gl if g[1] == 'a')), 'rows': rws, 'home': 'A', 'away': 'B', 'pre': list(pp), 'total': lh_ + la_})
sa = G['story_accuracy'](SYN)
good = True
for m in ('30', '60', '75'):
    for lo, hi, n, pm, obs in sa['curve'][m]['bins']:
        if n >= 300 and abs(pm - obs) > 3 * math.sqrt(max(pm * (1 - pm), 0.01) / n) + 0.01:
            good = False; print('   bin', m, lo, hi, n, pm, obs)
ok(good, 'curve: calibrated against its own world at minutes 30, 60 and 75 (6,000 synthetic matches, every bin with 300+ matches within 3 standard errors)')
ok(sa['curve']['75']['brier'] < sa['curve']['60']['brier'] < sa['curve']['30']['brier'] < sa['curve']['30']['base'] + 1e-9, 'curve: later minutes are sharper (Brier falls from the pre-match chances at 30, 60, 75)')
print('FAILED' if fails else 'ALL OK', fails)
sys.exit(1 if fails else 0)
