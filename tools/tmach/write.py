"""Time machine (the "TMACH" block of sync.py). Offline helper: python3 tools/tmach/write.py   writes data/results.json from the local data/ files, exactly as the sync does."""
import os, re, json, hashlib, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src = open(os.path.join(ROOT, "sync.py"), encoding="utf-8").read()
cut = lambda a, b: src[src.index(a):src.index(b)]
LOG, PUT = [], {}
def gj(hub, p):
    f = os.path.join(ROOT, p)
    return json.load(open(f, encoding="utf-8")) if os.path.exists(f) and p != "data/results.json" else None
G = {"os": os, "re": re, "json": json, "hashlib": hashlib, "datetime": datetime, "log": lambda *a: LOG.append(" ".join(map(str, a))), "run_pipeline": lambda h, k: True,
     "gh_get_json": gj, "gh_put": lambda h, p, c, m: PUT.__setitem__(p, c)}
exec(cut("MK_LEAGUES = ", "MK_FD = "), G)
exec(cut("# ===== ELO2 START =====", "# ===== ELO2 END ====="), G)
exec(cut("# ===== TMACH START =====", "# ===== TMACH END ====="), G)
if __name__ == "__main__":
    G["sync_tmach"]("hub")
    open(os.path.join(ROOT, G["TM_PATH"]), "wb").write(PUT[G["TM_PATH"]])
    print(LOG[-1])
    print(json.dumps(json.loads(PUT[G["TM_PATH"]])["test"], indent=1))
