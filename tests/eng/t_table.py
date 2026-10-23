import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
# independent check of the Premier League table: the same results from FPL's own fixtures (data/fpl.json)
import json
ix=json.load(open(REPO+'/data/index.json'));pl=[l for l in ix['leagues'] if l['name']=='Premier League'][0]
L=json.load(open(REPO+'/data/'+pl['file']));F=json.load(open(REPO+'/data/fpl.json'))
tn={t['id']:t['n'] for t in F['teams']}
def tab(res):
    T={}
    for h,a,g1,g2 in res:
        for t,f,ag in ((h,g1,g2),(a,g2,g1)):
            r=T.setdefault(t,[0,0,0]);r[0]+=3 if f>ag else 1 if f==ag else 0;r[1]+=f;r[2]+=ag
    return T
A=tab([(m['h'],m['a'],*map(int,m['s'].split('-'))) for m in L['matches']])
B=tab([(tn[x[1]],tn[x[2]],x[6],x[7]) for x in F['fix'] if x[5]])
norm=lambda s:s.lower().replace('&','and').replace('.','').replace(' fc','')
al={'man city':'manchester city','man utd':'manchester united','spurs':'tottenham hotspur','nott\'m forest':'nottingham forest','wolves':'wolverhampton wanderers','newcastle':'newcastle united','brighton':'brighton and hove albion','west ham':'west ham united','leeds':'leeds united','ipswich':'ipswich town','hull':'hull city','coventry':'coventry city','bournemouth':'afc bournemouth'}
def find(n):
    n2=al.get(norm(n),norm(n))
    c=[k for k in A if norm(k)==n2 or norm(k).startswith(n2) or n2.startswith(norm(k))]
    return c[0] if len(c)==1 else None
bad=[]
for t,v in B.items():
    k=find(t)
    if k is None:bad.append('no match for '+t);continue
    if A[k]!=v:bad.append(f'{t}: PitchAPI {A[k]} vs FPL {v}')
print('teams',len(A),len(B),'| mismatches:',bad or 'none')
print(('ok  ' if not bad and len(A)==len(B) else 'FAIL'),'Premier League table: PitchAPI results equal FPL fixtures for every team (%d teams)'%len(A),bad or '')
