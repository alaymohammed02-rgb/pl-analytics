"""Fit the current-season line estimate and validate it leaving one competition out. Writes est.json (the 'est' block of data/dlh.json).
Terms per measure: avg and in use cb + out + tilt, out uses cb + tilt (adding 'out' did not help there). Rows need >=9 outfield starters with data,
the same rule the page applies."""
import json,numpy as np
exec(open('ev_formula.py').read().split("comps=sorted")[0])
G=json.load(open('ev_grp.json'))
for r in rows:
    g=(G.get(r['mid']) or {}).get(r['team']) or {};r['cb']=g.get('cb');r['out']=g.get('out');r['n']=g.get('n',0)
rows=[r for r in rows if r['cb'] is not None and r['out'] is not None and r['n']>=9]
comps=sorted({r['comp'] for r in rows})
SPEC={'avg':('yavg',['cb','out','tilt']),'in':('yin',['cb','out','tilt']),'out':('yout',['cb','tilt'])}
def X(d,K):return np.c_[np.ones(len(d)),[[r[k] for k in K] for r in d]]
est={'n':len(rows),'comps':len(comps),'min_players':9,'coef':{},'val':{}}
for m,(y,K) in SPEC.items():
    b=np.linalg.lstsq(X(rows,K),[r[y] for r in rows],rcond=None)[0]
    est['coef'][m]={'t':K,'b':[round(float(v),4) for v in b]}
    mP=[];mY=[];sP=[];sY=[];bias=[]
    for c in comps:
        tr=[r for r in rows if r['comp']!=c];te=[r for r in rows if r['comp']==c]
        bb=np.linalg.lstsq(X(tr,K),[r[y] for r in tr],rcond=None)[0];p=X(te,K)@bb;yy=np.array([r[y] for r in te])
        mP+=list(p);mY+=list(yy);g={}
        if len(te)>=50:bias.append(float(np.mean(p-yy)))
        for r,q in zip(te,p):g.setdefault(r['team'],[]).append((q,r[y]))
        for v in g.values():
            if len(v)>=5:sP.append(np.mean([a for a,_ in v]));sY.append(np.mean([b2 for _,b2 in v]))
    mP,mY,sP,sY=map(np.array,(mP,mY,sP,sY));sl=np.polyfit(mP,mY,1)[0]
    shift=sum(b[1+i] for i,k in enumerate(K) if k in('cb','out'))
    est['val'][m]={'match_mae':round(float(np.mean(abs(mP-mY))),2),'season_mae':round(float(np.mean(abs(sP-sY))),2),'season_max':round(float(np.max(abs(sP-sY))),2),
      'season_r':round(float(np.corrcoef(sP,sY)[0,1]),2),'teams':int(len(sP)),'base_mae':round(float(np.mean(abs(sY-sY.mean()))),2),
      'slope':round(float(sl),2),'bias_max':round(float(max(abs(v) for v in bias)),2),'shift1':round(float(shift),2)}
json.dump(est,open('est.json','w'));print(json.dumps(est['val'],indent=0)[:900]);print(est['n'],'rows',est['coef'])
