"""Bake the page-loading order into sync.py (RT_LAST_BAKED). Run after adding or reordering a page script: python3 tools/rt/bake.py (tests/regen.sh does it).
The sync runner downloads only sync.py (no assets/ folder), so without the baked copy it would write index.html with RT_LAST = {} and the loading order of 5 Nov 2026 (the open page
drawn once, not once per script) would be silently off on the published site."""
import os, re, sys, json, importlib.util
R = os.environ.get("R") or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(R, "tests", "stub"))
spec = importlib.util.spec_from_file_location("m", os.path.join(R, "sync.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
cur = m.rt_last_compute(os.path.join(R, "assets"))
src = open(os.path.join(R, "sync.py"), encoding="utf-8").read()
a, b = src.index("# ===== RTLAST START =====\n"), src.index("# ===== RTLAST END =====")
new = src[:a] + "# ===== RTLAST START =====\nRT_LAST_BAKED = " + json.dumps(cur, sort_keys=True) + "\n" + src[b:]
if new != src:
    open(os.path.join(R, "sync.py"), "w", encoding="utf-8").write(new)
    print("baked", len(cur), "pages into sync.py")
else:
    print("already baked", len(cur), "pages")
