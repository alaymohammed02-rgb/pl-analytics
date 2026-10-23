import json,numpy as np
L=json.load(open('sb_lines.json'));F=json.load(open('ev_feats.json'))
rows=[]
for mid,f in F.items():
    m=L.get(mid)
    if not f or not m or 'c' not in m:continue
    for t,v in m['t'].items():
        x=f.get(t)
        if not x or None in (x['adx'],x['px'],x['tilt'],x['ppda'],x['poss']) or v['in'] is None or v['out'] is None:continue
        rows.append(dict(comp=m['c']+' '+m['s'],team=t,mid=mid,**x,yin=v['in'],yout=v['out'],yavg=(v['in']+v['out'])/2))
print(len(rows),'team-matches')
comps=sorted({r['comp'] for r in rows})
def cv(keys,y,level='match'):
    """leave-one-competition-out: fit on the other competitions, predict this one"""
    err=[];P=[];Y=[]
    for c in comps:
        tr=[r for r in rows if r['comp']!=c];te=[r for r in rows if r['comp']==c]
        X=np.c_[np.ones(len(tr)),[[r[k] for k in keys] for r in tr]];b=np.linalg.lstsq(X,[r[y] for r in tr],rcond=None)[0]
        p=np.c_[np.ones(len(te)),[[r[k] for k in keys] for r in te]]@b
        if level=='match':P+=list(p);Y+=[r[y] for r in te]
        else:  # season average per team, teams with 5+ matches
            g={}
            for r,q in zip(te,p):g.setdefault(r['team'],[]).append((q,r[y]))
            for v in g.values():
                if len(v)>=5:P.append(np.mean([a for a,_ in v]));Y.append(np.mean([b for _,b in v]))
    P,Y=np.array(P),np.array(Y);return np.mean(abs(P-Y)),np.max(abs(P-Y)),np.corrcoef(P,Y)[0,1],len(P)
for y in ('yavg','yin','yout'):
    sd=np.std([r[y] for r in rows]);base=np.mean(abs(np.array([r[y] for r in rows])-np.mean([r[y] for r in rows])))
    print(f'\n== {y}: spread sd {sd:.2f} m, "always the average" error {base:.2f} m')
    for keys in (['adx'],['tilt'],['ppda'],['poss'],['px'],['adx','tilt'],['adx','px'],['adx','tilt','ppda'],['adx','tilt','ppda','poss','px','hto']):
        a=cv(keys,y);s=cv(keys,y,'season')
        print(f'{"+".join(keys):34s} match: MAE {a[0]:.2f} max {a[1]:.2f} r {a[2]:.2f}   team season(5+): MAE {s[0]:.2f} max {s[1]:.2f} r {s[2]:.2f} n {s[3]}')
