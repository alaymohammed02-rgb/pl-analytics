import json,itertools,numpy as np
exec(open('ev_formula.py').read().split("comps=sorted")[0])
G=json.load(open('ev_grp.json'))
for r in rows:
    g=(G.get(r['mid']) or {}).get(r['team']) or {}
    for k in ('cb','df','mf','fw','out'):r[k]=g.get(k)
rows=[r for r in rows if all(r[k] is not None for k in ('cb','df','mf','fw','out'))]
print(len(rows),'team-matches with every group')
comps=sorted({r['comp'] for r in rows})
def loco(keys,y,inter=False,lam=0.0):
    def X(d):
        M=np.array([[r[k] for k in keys] for r in d],float)
        if inter and len(keys)>=2:M=np.c_[M,M[:,0]*M[:,1]/50]
        return np.c_[np.ones(len(d)),M]
    mP=[];mY=[];sP=[];sY=[];per={}
    for c in comps:
        tr=[r for r in rows if r['comp']!=c];te=[r for r in rows if r['comp']==c]
        A=X(tr);b=np.linalg.solve(A.T@A+lam*np.eye(A.shape[1]),A.T@np.array([r[y] for r in tr]))
        p=X(te)@b;mP+=list(p);mY+=[r[y] for r in te];g={}
        for r,q in zip(te,p):g.setdefault(r['team'],[]).append((q,r[y]))
        e=[abs(np.mean([a for a,_ in v])-np.mean([b2 for _,b2 in v])) for v in g.values() if len(v)>=3];per[c]=(np.mean(e) if e else None,len(e))
        for v in g.values():
            if len(v)>=5:sP.append(np.mean([a for a,_ in v]));sY.append(np.mean([b2 for _,b2 in v]))
    mP,mY,sP,sY=map(np.array,(mP,mY,sP,sY))
    return np.mean(abs(mP-mY)),np.mean(abs(sP-sY)),np.max(abs(sP-sY)),np.corrcoef(sP,sY)[0,1],per
cands=[['cb','tilt'],['df','tilt'],['out','tilt'],['cb','out','tilt'],['cb','fw','tilt'],['cb','mf','tilt'],['cb','df','tilt'],['cb','mf','fw','tilt'],['df','mf','fw','tilt'],['out'],['cb']]
for y in ('yavg','yin','yout'):
    print('==',y)
    res=[]
    for k in cands:
        a=loco(k,y);res.append((a[1],k,a))
        print(f'{"+".join(k):18s} match MAE {a[0]:.2f}  season MAE {a[1]:.2f} max {a[2]:.2f} r {a[3]:.2f}')
    b=loco(['cb','tilt'],y,inter=True);print(f'{"cb*tilt interaction":18s} match MAE {b[0]:.2f}  season MAE {b[1]:.2f}')
    for lam in (1,10,100):
        b=loco(['cb','out','tilt'],y,lam=lam);print(f'ridge {lam:<4d} cb+out+tilt   match MAE {b[0]:.2f}  season MAE {b[1]:.2f}')
