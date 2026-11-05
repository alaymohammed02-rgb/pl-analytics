# Transfer planner back-test file (data/transfers_test.json, written by tools/transfers/run_test.js): every aggregate recomputed from the per-gameweek rows
# with a second implementation (mean over gameweeks, standard error of that mean, share positive, paired differences against last-5 and random).
import json, math, os
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
d = json.load(open(os.path.join(REPO, 'data', 'transfers_test.json'), encoding='utf-8'))
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


def mean(a): return sum(a) / len(a)
def se(a):
    m = mean(a)
    return math.sqrt(sum((x - m) ** 2 for x in a) / (len(a) - 1) / len(a))
def close(a, b, t=1e-6): return abs(a - b) <= t * max(1, abs(b))


R, S = d['rounds'], d['s']
ok(d['horizon'] == 1 and S['rounds'] == len(R) and len(R) >= 20, 'one gameweek ahead, %d gameweeks, count equals the file\'s' % len(R))
ok(S['n'] == sum(r['n'] for r in R), 'n = the squads of all gameweeks (%d)' % S['n'])
w = [r['n'] for r in R]
for k, (key, fld, pred, pos) in {'model': ('model', 'model', 'pred', 'mpos'), 'b5': ('b5', 'b5', 'b5pred', 'bpos'), 'rand': ('rand', 'rand', None, 'gpos')}.items():
    xs = [r[fld] for r in R]
    ok(close(S[key]['m'], mean(xs)) and close(S[key]['se'], se(xs)), '%s: mean %.4f and standard error %.4f are those of the gameweek rows' % (k, S[key]['m'], S[key]['se']))
    ok(close(S[key]['pos'], mean([r[pos] for r in R])), '%s: share positive = mean of the rows' % k)
    if pred:
        ok(close(S[key]['pred'], mean([r[pred] for r in R])), '%s: predicted gain = mean of the rows' % k)
dB = [r['model'] - r['b5'] for r in R]
dR = [r['model'] - r['rand'] for r in R]
ok(close(S['dB5']['d'], mean(dB)) and close(S['dB5']['se'], se(dB)), 'model minus last-5: %.3f ± %.3f' % (S['dB5']['d'], S['dB5']['se']))
ok(close(S['dRand']['d'], mean(dR)) and close(S['dRand']['se'], se(dR)), 'model minus random: %.3f ± %.3f' % (S['dRand']['d'], S['dRand']['se']))
print('%d FAILED' % fails if fails else 'all passed')
raise SystemExit(1 if fails else 0)
