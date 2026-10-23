import json,numpy as np
exec(open('est_search.py').read().split("cands=")[0])
SPEC={'yavg':['cb','out','tilt'],'yin':['cb','out','tilt'],'yout':['cb','tilt']}
def X(d,keys):return np.c_[np.ones(len(d)),[[r[k] for k in keys] for r in d]]
for y,keys in SPEC.items():
    print('==',y,'+'.join(keys))
    P=[];Y=[];bias={}
    for c in comps:
        tr=[r for r in rows if r['comp']!=c];te=[r for r in rows if r['comp']==c]
        b=np.linalg.lstsq(X(tr,keys),[r[y] for r in tr],rcond=None)[0];p=X(te,keys)@b
        P+=list(p);Y+=[r[y] for r in te];bias[c]=(np.mean(p-np.array([r[y] for r in te])),np.mean(abs(p-np.array([r[y] for r in te]))),len(te))
    P,Y=np.array(P),np.array(Y);sl,ic=np.polyfit(P,Y,1)
    print(f'  held-out calibration: actual = {ic:.2f} + {sl:.2f} x predicted (1.00 / 0 is perfect)')
    for c,(bi,ma,n) in bias.items():print(f'  {c:30s} n {n:3d} signed bias {bi:+.2f} m  match MAE {ma:.2f}')
    b=np.linalg.lstsq(X(rows,keys),[r[y] for r in rows],rcond=None)[0]
    print('  coef',dict(zip(['const']+keys,np.round(b,3))))
    # sensitivity: if the site's position values were off by +1 m (all of cb and out), predictions move by:
    mv=sum(b[1+i] for i,k in enumerate(keys) if k in('cb','out'));print(f'  +1 m in every position value moves the estimate by {mv:+.2f} m')
    # noise robustness: random error on position features, sd 1.5 m, 20 repeats, leave-one-comp-out season MAE
    rng=np.random.default_rng(1);ms=[]
    for _ in range(20):
        sP=[];sY=[]
        for c in comps:
            tr=[r for r in rows if r['comp']!=c];te=[r for r in rows if r['comp']==c]
            bb=np.linalg.lstsq(X(tr,keys),[r[y] for r in tr],rcond=None)[0]
            Xt=X(te,keys).copy()
            for j,k in enumerate(keys):
                if k in('cb','out'):Xt[:,1+j]+=rng.normal(0,1.5,len(te))
            p=Xt@bb;g={}
            for r,q in zip(te,p):g.setdefault(r['team'],[]).append((q,r[y]))
            for v in g.values():
                if len(v)>=5:sP.append(np.mean([a for a,_ in v]));sY.append(np.mean([b2 for _,b2 in v]))
        ms.append(np.mean(abs(np.array(sP)-np.array(sY))))
    print(f'  with 1.5 m random error on the position values, season MAE {np.mean(ms):.2f} (clean {loco(keys,y)[1]:.2f})')
