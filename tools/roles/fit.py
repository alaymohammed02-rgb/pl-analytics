"""Player roles: group the outfield players of the six domestic leagues by HOW they play, then test whether the groups mean anything.
Writes data/roles.json. Run offline: python3 tools/roles/fit.py   (not part of the sync: finished seasons never change; run it again when a season finishes)

Data: the finished seasons 2024-25 and 2025-26 of the six leagues (data/seasons.json -> the *_pl.json player files).
Per player-season (outfield only, by the position he played most minutes in; a goalkeeper is left out): the 16 measures of the Player twins page plus clearances and crosses per 90 minutes
(npxg sh xag kp sca pr bx ps pc cb tkw tk ic bl duw aerw cl cr; xAG per 90 uses only the minutes of the matches that have it), then sqrt (counts per 90 are skewed),
then a z-score against the players of the same league and season with 900+ minutes (so a role is a style relative to one's league).
Clusters: k-means (k-means++, 30 restarts, fixed seeds) on the 2024-25 players with 900+ minutes ONLY. k is chosen by a rule fixed before looking at any result:
the k in 6..10 whose clusterings of two random halves of those players agree most (adjusted Rand index, 12 repeats). The 2025-26 season is then assigned to the
FROZEN centroids (nearest centroid), never refitted: that is the out-of-sample season for the tests below.
Tests (all written into the file, nothing hidden):
  * season to season: players with 900+ minutes in both seasons: share with the same role, Cohen's kappa, and the same two numbers for the position label alone
    (DF / MF / FW as PitchAPI gives it) as the yardstick;
  * within a season: the matches of each 2025-26 player split into odd and even (by match id order), both halves 450+ minutes: share with the same role from each half.
Map: the first two principal components of the 2024-25 z-scores (2025-26 projected onto the same two axes).
Output: {"v":1,"t":..,"k":..,"feat":[..],"dims":..,"lg":[names],"seasons":[..],"roles":[{id,name,ar,top,n,pos}],"kscan":[[k,ari]],"test":{..},"n":{player id: name},
"p":{player id: [[season index, league index, club, position, minutes, role, x, y, [z*10 as ints]]...]}}"""
import json, os, sys, math, datetime, collections
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
FEAT = ["npxg", "sh", "xag", "kp", "sca", "pr", "bx", "ps", "pc", "cb", "tkw", "tk", "ic", "bl", "duw", "aerw", "cl", "cr"]
DIMS = [("Shooting", ["npxg", "sh"], "تسديد"), ("Creating", ["xag", "kp", "sca"], "صناعة فرص"), ("Passing forward", ["pr", "bx"], "تمرير للأمام"),
        ("Carrying", ["pc", "cb", "tkw"], "حمل الكرة"), ("Defending", ["tk", "ic", "bl", "cl"], "افتكاك"), ("Duels", ["duw", "aerw"], "صراعات"), ("Crossing", ["cr"], "عرضيات"), ("Involvement", ["ps"], "مشاركة")]
SEASONS = ["2024-25", "2025-26"]
MIN_FIT, MIN_SHOW = 900, 450


def load(f):
    with open(os.path.join(DATA, f), encoding="utf-8") as fh:
        return json.load(fh)


def season_rows(pl):
    """{player id: {name, club, pos, mi, per-measure sums, xagmi, parts: {half: sums}}} from one player file (matches in order of match id)."""
    c = {k: i for i, k in enumerate(pl["cols"])}
    out = {}
    for r in sorted(pl["rows"], key=lambda r: r[c["m"]]):
        mi = r[c["mi"]]
        if not mi:
            continue
        a = out.get(r[c["i"]])
        if a is None:
            a = out[r[c["i"]]] = {"name": r[c["n"]], "club": collections.defaultdict(float), "pos": collections.defaultdict(float), "g": 0,
                                  "h": [{"mi": 0.0, "xagmi": 0.0, **{k: 0.0 for k in FEAT}} for _ in range(2)]}
        a["name"] = r[c["n"]] or a["name"]
        a["club"][r[c["c"]]] += mi
        if r[c["o"]]:
            a["pos"][r[c["o"]]] += mi
        h = a["h"][a["g"] % 2]
        a["g"] += 1
        h["mi"] += mi
        for k in FEAT:
            v = r[c[k]]
            if v is not None:
                h[k] += v
        if r[c["xag"]] is not None:
            h["xagmi"] += mi
    return out


def vec(h, both=None):
    """sqrt of per 90 for each measure from the summed half(s); None when too little xAG minutes."""
    hs = both if both is not None else [h]
    mi = sum(x["mi"] for x in hs)
    if mi <= 0:
        return None
    xm = sum(x["xagmi"] for x in hs)
    v = []
    for k in FEAT:
        if k == "xag":
            if xm < mi * 0.5:
                return None
            v.append(math.sqrt(max(0.0, sum(x[k] for x in hs)) * 90 / xm))
        else:
            v.append(math.sqrt(max(0.0, sum(x[k] for x in hs)) * 90 / mi))
    return v


def kmeans(X, k, seed, restarts):
    best = None
    for r in range(restarts):
        rng = np.random.default_rng(seed * 1000 + r)
        C = [X[rng.integers(len(X))]]
        for _ in range(k - 1):
            d2 = np.min(((X[:, None, :] - np.array(C)[None]) ** 2).sum(2), axis=1)
            C.append(X[rng.choice(len(X), p=d2 / d2.sum())])
        C = np.array(C)
        for _ in range(100):
            lab = ((X[:, None, :] - C[None]) ** 2).sum(2).argmin(1)
            N = np.array([X[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(k)])
            if np.allclose(N, C):
                break
            C = N
        lab = ((X[:, None, :] - C[None]) ** 2).sum(2).argmin(1)
        inertia = float(((X - C[lab]) ** 2).sum())
        if best is None or inertia < best[0]:
            best = (inertia, C.copy())
    return best[1]


def assign(X, C):
    return ((X[:, None, :] - C[None]) ** 2).sum(2).argmin(1)


def ari(a, b):
    n = len(a)
    tab = collections.Counter(zip(a, b))
    ra, rb = collections.Counter(a), collections.Counter(b)
    c2 = lambda x: x * (x - 1) / 2
    s = sum(c2(v) for v in tab.values()); sa = sum(c2(v) for v in ra.values()); sb = sum(c2(v) for v in rb.values())
    e = sa * sb / c2(n)
    return (s - e) / ((sa + sb) / 2 - e) if (sa + sb) / 2 != e else 1.0


def kappa(a, b):
    n = len(a)
    po = sum(1 for x, y in zip(a, b) if x == y) / n
    pa, pb = collections.Counter(a), collections.Counter(b)
    pe = sum(pa[k] * pb[k] for k in pa) / (n * n)
    return po, (po - pe) / (1 - pe) if pe < 1 else 1.0, pe


def main():
    sj = load("seasons.json")["leagues"]
    ix = load("index.json")
    nm = {l["id"]: l["name"] for l in ix["leagues"]}
    lids = [l["id"] for l in ix["leagues"] if l.get("pl_file") and l["id"] in sj and not any(w in l["name"].lower() for w in ("world cup", "champions", "europa", "conference", "cup", "copa", "coppa", "pokal", "coupe"))]
    lg_names = [nm[i] for i in lids]
    recs = []  # one per player-season: dict
    for li, lid in enumerate(lids):
        l = {"id": lid, "name": nm[lid]}
        for si, s in enumerate(SEASONS):
            e = sj[lid]["seasons"].get(s) or {}
            f = (e.get("files") or {}).get("pl_file")
            if not f or not os.path.exists(os.path.join(DATA, f)):
                print("missing", l["name"], s); continue
            p = {"pl_file": f}
            pl = load(p["pl_file"])
            if not pl.get("rows"):
                print("no rows", l["name"], s); continue
            for pid, a in season_rows(pl).items():
                mi = a["h"][0]["mi"] + a["h"][1]["mi"]
                pos = max(a["pos"], key=a["pos"].get) if a["pos"] else None
                if pos == "GK" or pos is None or mi < MIN_SHOW:
                    continue
                v = vec(None, a["h"])
                if v is None:
                    continue
                recs.append({"id": pid, "name": a["name"], "club": max(a["club"], key=a["club"].get), "pos": pos, "mi": mi, "s": si, "lg": li, "v": np.array(v),
                             "odd": vec(None, [a["h"][0]]) if a["h"][0]["mi"] >= 450 else None, "even": vec(None, [a["h"][1]]) if a["h"][1]["mi"] >= 450 else None})
    print(len(recs), "player-seasons")
    # z-score against the league-season's 900+ players
    for (si, li) in {(r["s"], r["lg"]) for r in recs}:
        grp = [r for r in recs if r["s"] == si and r["lg"] == li]
        base = np.array([r["v"] for r in grp if r["mi"] >= MIN_FIT])
        mu, sd = base.mean(0), base.std(0)
        sd[sd == 0] = 1
        for r in grp:
            r["z"] = (r["v"] - mu) / sd
            for h in ("odd", "even"):
                r[h] = None if r[h] is None else (np.array(r[h]) - mu) / sd
    tr = [r for r in recs if r["s"] == 0 and r["mi"] >= MIN_FIT]
    X = np.array([r["z"] for r in tr])
    print(len(tr), "players fit the clusters (2024-25, 900+ minutes)")
    # k by the half-agreement rule
    kscan = []
    rng = np.random.default_rng(7)
    for k in range(6, 11):
        sc = []
        for rep in range(12):
            perm = rng.permutation(len(X)); A, B = X[perm[:len(X) // 2]], X[perm[len(X) // 2:]]
            ca, cb = kmeans(A, k, 11 + rep, 6), kmeans(B, k, 51 + rep, 6)
            sc.append(ari(list(assign(X, ca)), list(assign(X, cb))))
        kscan.append([k, round(float(np.mean(sc)), 4)])
        print("k", k, "half agreement (ARI)", kscan[-1][1])
    K = max(kscan, key=lambda t: (t[1], -t[0]))[0]
    C = kmeans(X, K, 3, 30)
    lab_tr = assign(X, C)
    # order roles by size
    order = np.argsort(-np.bincount(lab_tr, minlength=K)); remap = {int(o): i for i, o in enumerate(order)}
    C = C[order]
    for r in recs:
        r["role"] = int(assign(r["z"][None], C)[0])
    # PCA of the fit players
    mu0 = X.mean(0); U, S, Vt = np.linalg.svd(X - mu0, full_matrices=False)
    ev = (S ** 2) / (S ** 2).sum()
    for r in recs:
        xy = (r["z"] - mu0) @ Vt[:2].T
        r["x"], r["y"] = float(xy[0]), float(xy[1])
    # roles: top measures and names
    roles = []
    cnt = collections.Counter(r["role"] for r in tr)
    for j in range(K):
        z = C[j]
        top = sorted(range(len(FEAT)), key=lambda i: -abs(z[i]))[:4]
        dz = [(float(np.mean([z[FEAT.index(k)] for k in ks])), en, ar) for en, ks, ar in DIMS]
        hi = sorted([d for d in dz if d[0] >= 0.35], key=lambda d: -d[0])[:2]
        lo = sorted([d for d in dz if d[0] <= -0.6], key=lambda d: d[0])[:1]
        if hi:
            nm_en = " + ".join(d[1].lower() for d in hi); nm_ar = " + ".join(d[2] for d in hi)
        else:
            nm_en, nm_ar = "all-round", "متوازن"
        if lo:
            nm_en += ", little " + lo[0][1].lower(); nm_ar += "، قليل " + lo[0][2]
        pc = collections.Counter(r["pos"] for r in tr if r["role"] == j)
        roles.append({"id": j, "name": nm_en[0].upper() + nm_en[1:], "ar": nm_ar, "n": cnt[j], "top": [[FEAT[i], round(float(z[i]), 2)] for i in top],
                      "z": [round(float(x), 2) for x in z], "pos": {k: round(v / cnt[j], 3) for k, v in pc.most_common()} })
        print(j, roles[-1]["name"], cnt[j], roles[-1]["pos"], roles[-1]["top"])
    # tests
    both = {}
    for r in recs:
        both.setdefault(r["id"], {})[r["s"]] = r
    pairs = [(d[0], d[1]) for d in both.values() if 0 in d and 1 in d and d[0]["mi"] >= MIN_FIT and d[1]["mi"] >= MIN_FIT]
    pa = [a["role"] for a, b in pairs]; pb = [b["role"] for a, b in pairs]
    po, ka, pe = kappa(pa, pb)
    qa = [a["pos"] for a, b in pairs]; qb = [b["pos"] for a, b in pairs]
    qo, kq, qe = kappa(qa, qb)
    # kappa interval by bootstrap
    rb = np.random.default_rng(5); ks = []
    for _ in range(500):
        ii = rb.integers(len(pairs), size=len(pairs)); ks.append(kappa([pa[i] for i in ii], [pb[i] for i in ii])[1])
    # within a season: odd against even matches (2025-26)
    oe = [(r["role"], int(assign(r["odd"][None], C)[0]), int(assign(r["even"][None], C)[0])) for r in recs if r["s"] == 1 and r["odd"] is not None and r["even"] is not None]
    o1 = [int(assign(r["odd"][None], C)[0]) for r in recs if r["s"] == 1 and r["odd"] is not None and r["even"] is not None]
    e1 = [int(assign(r["even"][None], C)[0]) for r in recs if r["s"] == 1 and r["odd"] is not None and r["even"] is not None]
    po2, k2, pe2 = kappa(o1, e1)
    # same-position pairs of different roles: how far apart (for the page)
    test = {"pairs": len(pairs), "agree": round(po, 4), "kappa": round(ka, 4), "kappa_lo": round(float(np.percentile(ks, 2.5)), 4), "kappa_hi": round(float(np.percentile(ks, 97.5)), 4), "chance": round(pe, 4),
            "pos_agree": round(qo, 4), "pos_kappa": round(kq, 4), "halves": len(o1), "h_agree": round(po2, 4), "h_kappa": round(k2, 4), "h_chance": round(pe2, 4),
            "fit": len(tr), "pc_var": [round(float(ev[0]), 4), round(float(ev[1]), 4)]}
    print(json.dumps(test))
    n = {}; p = {}
    for r in sorted(recs, key=lambda r: (r["id"], r["s"])):
        n[r["id"]] = r["name"]
        p.setdefault(r["id"], []).append([r["s"], r["lg"], r["club"], r["pos"], round(r["mi"]), r["role"], round(r["x"], 2), round(r["y"], 2), [int(round(x * 10)) for x in r["z"]]])
    out = {"v": 1, "t": datetime.date.today().isoformat(), "k": K, "feat": FEAT, "dims": [[a, b, c] for a, b, c in DIMS], "lg": lg_names, "seasons": SEASONS, "roles": roles,
           "kscan": kscan, "test": test, "n": n, "p": p, "min_fit": MIN_FIT, "min_show": MIN_SHOW}
    with open(os.path.join(DATA, "roles.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print("written", os.path.getsize(os.path.join(DATA, "roles.json")) // 1024, "KB")


if __name__ == "__main__":
    main()
