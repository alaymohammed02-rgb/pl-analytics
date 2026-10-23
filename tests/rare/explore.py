import sys,json,collections
sys.path.insert(0,'../fx');import run_local as RL
G=RL.G;matches,shots,club,idx=RL.load()
WC=[l['id'] for l in idx['leagues'] if 'World Cup' in l['name']]
matches=[m for m in matches if m['l'] not in WC];shots=[s for s in shots if s['l'] not in WC]
M=G['_fx_matches'](matches,shots,club)
print('matches with full shots',len(M),'of finished',sum(1 for m in matches if G['_fx_score'](m['s'])))
D='/home/user/pl-analytics/data/'
# player-match rows
PL=[];RT={}
for lg in idx['leagues']:
  if lg['id'] in WC:continue
  P=json.load(open(D+lg['pl_file']));c=P['cols']
  for r in P['rows']:
    o=dict(zip(c,r));o['l']=lg['id'];PL.append(o)
  R=json.load(open(D+lg['rt_file']))
  for m,d in R['m'].items():
    for p,v in d.items():RT[(lg['id'],m,p)]=v
Nm=len({(m['l'],m['m']) for m in matches if G['_fx_score'](m['s'])})
print('finished matches',Nm,'player rows',len(PL),'ratings',len(RT))
def top(name,vals,n=6):
  c=collections.Counter(vals);print(name,sorted(c.items(),reverse=True)[:n])
# per-match maxima for player stats
for k in ['gl','ast','sh','kp','tk','ic','tkw','cl','duw','aerw','bl','sca','pr','ps']:
  mx=collections.defaultdict(float)
  for r in PL:
    v=r.get(k)
    if v is not None:mx[(r['l'],r['m'])]=max(mx[(r['l'],r['m'])],v)
  top('max '+k+' per match (value: matches)',[int(v) if k!='ps' else int(v//10*10) for v in mx.values()])
mx=collections.defaultdict(float)
for (l,m,p),v in RT.items():mx[(l,m)]=max(mx[(l,m)],v)
top('max rating per match',[round(v,1) for v in mx.values()],10)
# shots without goal by a player
top('player shots with 0 goals',[int(r['sh']) for r in PL if r.get('sh') and not r.get('gl')])
