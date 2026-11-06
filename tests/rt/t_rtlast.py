# Loading order on the published site (RT_LAST in index.html): the sync runner downloads only sync.py (no assets/ folder), so the order must come from the baked copy in sync.py.
# Checks: the baked copy equals what the assets say now (run `sh tests/regen.sh` or `python3 tools/rt/bake.py` after adding or moving a page script), and an index.html
# generated from a copy of sync.py alone, with no assets next to it, has the same RT_LAST and RT_ORD as one generated in the repository.
import os, re, sys, json, shutil, tempfile, subprocess
REPO = os.environ.get('PLREPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
fails = 0


def ok(c, m):
    global fails
    print(('ok  ' if c else 'FAIL'), m)
    if not c:
        fails += 1


def gen(sync_path, out_path):
    subprocess.run([sys.executable, '-I', os.path.join(REPO, 'tests', 'gen_index.py'), sync_path, out_path], check=True, capture_output=True)
    h = open(out_path, encoding='utf-8').read()
    return json.loads(re.search(r'RT_LAST=(\{.*?\});let RT_HI', h).group(1)), json.loads(re.search(r'const RT_ORD=(\[.*?\]),RT_LAST', h).group(1))


here_last, here_ord = gen(os.path.join(REPO, 'sync.py'), os.path.join(tempfile.mkdtemp(), 'a.html'))
d = tempfile.mkdtemp()
shutil.copy(os.path.join(REPO, 'sync.py'), os.path.join(d, 'sync.py'))
alone_last, alone_ord = gen(os.path.join(d, 'sync.py'), os.path.join(d, 'b.html'))
ok(len(here_last) > 50, 'in the repository RT_LAST has %d pages' % len(here_last))
ok(alone_last == here_last, 'sync.py alone (no assets/ next to it, like the runner) gives the same RT_LAST: the baked copy is current (else run sh tests/regen.sh)')
ok(alone_ord == here_ord and len(here_ord) > 60, 'and the same script order (%d scripts)' % len(here_ord))
print('%d FAILED' % fails if fails else 'all passed')
sys.exit(1 if fails else 0)
