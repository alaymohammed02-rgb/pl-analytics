import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
"""Centre-backs' average position per team per match, from PitchAPI heat maps (acting frame) and the official lineup slots."""
import json,statistics as st,math,sys
from collections import defaultdict
D=REPO+'/data/'
def cb(lid):
    idx=json.load(open(D+'index.json'));lg=[l for l in idx['leagues'] if l['id']==lid][0]
    H=json.load(open(D+lg['heat_file']));X=json.load(open(D+lg['mx_file'])) if lg.get('mx_file') else json.load(open(D+lid+'_mx.json'))
    heat={(r['m'],r['k']):r for r in H['rows'] if r['t']=='p'}
    out=defaultdict(dict)   # (m,team) -> {pid: avg x}
    for mid,e in X['m'].items():
        lu=e.get('lu') or {}
        for s in ('h','a'):
            for p in (lu.get(s) or {}).get('xi') or []:
                code,y=p[3],p[5]
                if not(isinstance(code,int) and code//10==3 and y is not None and .15<y<.85):continue
                r=heat.get((mid,p[0]))
                if not r:continue
                h=r['h'];cells=[(h[i],h[i+2]) for i in range(0,len(h),3)];n=sum(c for _,c in cells)
                if n<10:continue
                out[(mid,r['c'])][p[0]]=sum((x+.5)*105/16*c for x,c in cells)/n
    return out
if __name__=='__main__':
    for lid in sys.argv[1:]:
        o=cb(lid);team=defaultdict(list)
        for (m,t),v in o.items():team[t].append(st.mean(v.values()))
        rows=sorted(((st.mean(v),len(v),min(v),max(v),k) for k,v in team.items() if len(v)>=3),reverse=True)
        print(lid,'team-matches',len(o),'teams',len(rows))
        for m,n,lo,hi,k in rows[:5]+rows[-3:]:print(f'   {k:22s} CB avg {m:5.1f} m  ({n} matches, {lo:.1f}-{hi:.1f})')
