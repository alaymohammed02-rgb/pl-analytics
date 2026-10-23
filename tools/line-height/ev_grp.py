"""Per team-match: starters' average event position (m from own goal) by role group, from StatsBomb events + lineups.
cb = centre-backs, df = all defenders incl. full/wing-backs, mf = midfielders, fw = forwards, out = all outfield starters."""
import json,urllib.request,concurrent.futures as cf,time
B='https://raw.githubusercontent.com/statsbomb/open-data/master/data/'
L=json.load(open('sb_lines.json'));SX=105/120
def grp(pos):
    if pos=='Goalkeeper':return None
    if 'Back' in pos:return 'cb' if 'Center' in pos else 'fb'
    if 'Midfield' in pos:return 'mf'
    return 'fw'
def get(p):
    for k in range(4):
        try:return json.load(urllib.request.urlopen(B+p,timeout=120))
        except Exception:
            if k==3:return None
            time.sleep(2+3*k)
def one(mid):
    E=get('events/'+mid+'.json');LU=get('lineups/'+mid+'.json')
    if not E or not LU:return mid,None
    xs={}
    for e in E:
        pid=e.get('player',{}).get('id')
        if pid and e.get('location'):xs.setdefault(pid,[]).append(e['location'][0]*SX)
    out={}
    for T in LU:
        G={'cb':[],'fb':[],'mf':[],'fw':[]}
        for p in T['lineup']:
            st=[q for q in p.get('positions',[]) if q['from']=='00:00']
            if not st:continue
            g=grp(st[0]['position']);v=xs.get(p['player_id'])
            if g and v and len(v)>=10:G[g].append(sum(v)/len(v))
        m=lambda a:sum(a)/len(a) if a else None
        allo=G['cb']+G['fb']+G['mf']+G['fw']
        out[T['team_name']]={'cb':m(G['cb']),'df':m(G['cb']+G['fb']),'mf':m(G['mf']),'fw':m(G['fw']),'out':m(allo),'n':len(allo)}
    return mid,out
ids=[k for k,v in L.items() if v and 'c' in v];R={}
with cf.ThreadPoolExecutor(8) as ex:
    for i,(mid,f) in enumerate(ex.map(one,ids)):
        R[mid]=f
json.dump(R,open('ev_grp.json','w'));print('done',sum(1 for v in R.values() if v),'of',len(ids))
