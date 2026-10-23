"""Imports sync.py (without running main) and writes the generated INDEX html to argv[2]."""
import sys, importlib.util, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "stub"))
spec = importlib.util.spec_from_file_location("syncmod", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
open(sys.argv[2], "w", encoding="utf-8").write(m.INDEX)
print("INDEX chars", len(m.INDEX))
