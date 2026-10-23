# TRAIN-only exploration (2022-23, 2023-24): do in-season PitchAPI per-90 numbers from earlier rounds predict a player's FPL goals,
# assists and bonus in round r beyond FPL's own xG/xA? Reads nothing from 2024-25 or 2025-26.
import json,sys,numpy as np
D='/home/user/pl-analytics/data/'
PC=['ev','mi','xg','xag','sot','kp','sca','bx','dfa','sh','gca','gl','ast','xt','vaep']
def rows(season):
    d=json.load(open(D+f'fpl_{season}.json'));ins=json.load(open(f'ins_{season}.json'))
    H={c:i for i,c in enumerate(d['hcols'])};C={c:i for i,c in enumerate(d['cols'])}
    ty={r[C['id']]:r[C['ty']] for r in d['rows']}
    out=[]
    for pid,h in d['hist'].items():
        pa=ins['players'].get(pid);
        if not pa: continue
        pa=np.array([[np.nan if v is None else v for v in r] for r in pa],float)
        h=sorted(h,key=lambda r:r[0])
        for rr in range(4,39):
            cur=[r for r in h if r[0]==rr and r[H['min']]>0]
            if not cur: continue
            pr=[r for r in h if r[0]<rr]
            m=sum(r[H['min']] for r in pr)
            if m<90: continue
            # FPL xG over matches that have it, scaled to all minutes (as btXgScale)
            def fx(k):
                mx=sum(r[H['min']] for r in pr if r[H['min']]>0 and r[H[k]] is not None); s=sum(r[H[k]] for r in pr if r[H['min']]>0 and r[H[k]] is not None)
                return s*m/mx if mx>0 else np.nan
            if season=='2022-23' and rr<17: continue   # FPL xG missing before GW16 there: v3 then uses goals; keep the clean comparison
            P=pa[pa[:,0]<rr]
            if not len(P): continue
            pm=P[:,1].sum()
            f={'n90':m/90,'xg':fx('xg'),'xa':fx('xa'),'g':sum(r[H['gl']] for r in pr),'a':sum(r[H['as']] for r in pr),'bon':sum(r[H['bon']] for r in pr),'pa90':pm/90}
            for j,k in enumerate(PC[2:],2):
                col=P[:,j];ok=~np.isnan(col);mm=P[ok,1].sum()
                f['pa_'+k]=col[ok].sum()*pm/mm if mm>0 else np.nan
            mins=sum(r[H['min']] for r in cur)
            out.append(dict(season=season,r=rr,pid=pid,ty=ty[int(pid)],mins=mins,G=sum(r[H['gl']] for r in cur),A=sum(r[H['as']] for r in cur),B=sum(r[H['bon']] for r in cur),**f))
    return out
R=rows('2022-23')+rows('2023-24')
print('rows',len(R))
def shr(x,n90,prior,pm0=5): return (x+prior*pm0)/(n90+pm0)
# position priors per 90 from the same rows (approximation of v3's position average)
for tgt,base,props in [('G','xg',['pa_xg','pa_sot','pa_bx','pa_sh','pa_xt']),('A','xa',['pa_xag','pa_kp','pa_sca','pa_gca','pa_xt'])]:
    print('\n== target',tgt,'base FPL',base)
    for ty in [2,3,4,0]:
        S=[x for x in R if (ty==0 or x['ty']==ty) and not np.isnan(x[base]) and all(not np.isnan(x[p]) for p in props)]
        y=np.array([x[tgt] for x in S]);e=np.array([x['mins']/90 for x in S])
        def feat(k,scale=None):
            v=np.array([x[k] for x in S]);n=np.array([x['n90'] if k==base else x['pa90'] for x in S])
            c=np.array([x[base] for x in S]).sum()/v.sum() if k!=base else 1.0   # calibrate the proxy to FPL units on these rows
            pri=(v*c).sum()/n.sum()
            return shr(v*c,n,pri)*e,c
        Xb,_=feat(base);res={}
        def fit(cols):
            X=np.column_stack(cols);w,*_=np.linalg.lstsq(X,y,rcond=None);p=X@w;return w,np.mean((y-p)**2)
        w0,m0=fit([Xb]);print(f' ty{ty} n={len(S)} FPL only: w={w0.round(3)} mse={m0:.5f}')
        for k in props:
            Xk,c=feat(k);w,m=fit([Xb,Xk]);wk,mk=fit([Xk])
            print(f'   +{k:7s} c={c:.4f} alone mse={mk:.5f} | with FPL w={w.round(3)} mse={m:.5f} gain={(m0-m)/m0*100:.2f}%')
        Xs=[feat(k)[0] for k in props];w,m=fit([Xb]+Xs);print(f'   all: w={w.round(3)} gain={(m0-m)/m0*100:.2f}%')
