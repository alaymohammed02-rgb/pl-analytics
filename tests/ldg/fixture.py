# Prints a ledger built by sync.py's own step from the real data/ files, as if the sync ran now (for tests/ldg/ui_ldg.js).
import os, re, sys, json, math, hashlib, datetime
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src = open(os.path.join(REPO, 'sync.py'), encoding='utf-8').read()
G = {'os': os, 're': re, 'json': json, 'math': math, 'hashlib': hashlib, 'datetime': datetime, 'log': lambda *a: None, 'run_pipeline': lambda h, k: True}
for a, b in (('# ===== ELO2 START =====', '# ===== ELO2 END ====='), ('# ===== XIB START =====', '# ===== XIB END ====='), ('# ===== LEDGER START =====', '# ===== LEDGER END =====')):
    exec(src[src.index(a):src.index(b)], G)


def get(p):
    try:
        return json.load(open(os.path.join(REPO, p), encoding='utf-8'))
    except Exception:
        return None


now = datetime.datetime.strptime(sys.argv[1], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc) if len(sys.argv) > 1 else datetime.datetime.now(datetime.timezone.utc)
print(json.dumps(G['ldg_step'](get, now, {}), ensure_ascii=False))
