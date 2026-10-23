"""Per team and match: the starting centre-backs' average position from event data (all located events by that player),
in metres from the team's own goal. Same idea as the site's centre-backs' average position (PitchAPI heat maps)."""
import json,urllib.request,concurrent.futures as cf,time
B='https://raw.githubusercontent.com/statsbomb/open-data/master/data/'
L=json.load(open('sb_lines.json'));SX=105/120
CBPOS={'Right Center Back','Center Back','Left Center Back'}
def get(p):
    for k in range(4):
        try:return json.load(urllib.request.urlopen(B+p,timeout=120))
        except Exception:
            if k==3:return None
            time.sleep(2+3*k)
def one(mid):
    E=get('events/'+mid+'.json');LU=get('lineups/'+mid+'.json')
    if not E or not LU:return mid,None
    out={}
    for T in LU:
        cb={p['player_id'] for p in T['lineup'] if any(q['position'] in CBPOS and q['from']=='00:00' for q in p.get('positions',[]))}
        xs={}
        for e in E:
            if e.get('player',{}).get('id') in cb and e.get('location'):xs.setdefault(e['player']['id'],[]).append(e['location'][0]*SX)
        a=[sum(v)/len(v) for v in xs.values() if len(v)>=10]
        out[T['team_name']]={'cb':sum(a)/len(a) if a else None,'ncb':len(a)}
    return mid,out
ids=[k for k,v in L.items() if v and 'c' in v];R={}
with cf.ThreadPoolExecutor(8) as ex:
    for i,(mid,f) in enumerate(ex.map(one,ids)):
        R[mid]=f
        if i%50==0:print(i,flush=True)
json.dump(R,open('ev_cb.json','w'));print('done',sum(1 for v in R.values() if v),'of',len(ids))
