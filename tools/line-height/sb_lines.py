"""Corrected defensive line height for every StatsBomb open-data match with 360 frames.
Per team-frame: the camera features (dlfeat.feats), then the model trained on SkillCorner full tracking predicts the deepest
outfield player. Per team and match: the mean with the ball and without it. Raw StatsBomb files are not kept."""
import json,urllib.request,concurrent.futures as cf,os,sys,time,numpy as np,pickle
sys.path.insert(0,'.');from dlfeat import feats
from sklearn.ensemble import HistGradientBoostingRegressor
R=np.load('sc_rows.npy');MODEL=HistGradientBoostingRegressor(max_iter=300,learning_rate=.06,max_leaf_nodes=31,min_samples_leaf=60,l2_regularization=1.0,random_state=0).fit(R[:,3:-1],R[:,-1])
B='https://raw.githubusercontent.com/statsbomb/open-data/master/data/';get=lambda p:json.load(urllib.request.urlopen(B+p,timeout=120))
SX,SY=105/120,68/80
C=[x for x in json.load(open('competitions.json')) if x.get('match_available_360')]
OUT='sb_lines.json';res=json.load(open(OUT)) if os.path.exists(OUT) else {}
def frames(E,F):
    ev={x['id']:x for x in E};names=sorted({x['team']['name'] for x in E if 'team' in x});rows=[]
    if len(names)!=2:return rows
    for f in F:
        e=ev.get(f['event_uuid'])
        if not e or 'team' not in e or 'possession_team' not in e:continue
        et=e['team']['name'];opp=names[0] if names[1]==et else names[1];poss=e['possession_team']['name']
        va=f.get('visible_area') or [];px,py=va[0::2],va[1::2]
        loc=e.get('location')
        for t,mate in ((et,True),(opp,False)):
            d=(lambda x:x*SX) if mate else (lambda x:(120-x)*SX)
            vis=[p['location'] for p in f['freeze_frame'] if p['teammate']==mate and not p['keeper']]
            x=feats([d(v[0]) for v in vis],[v[1]*SY for v in vis],[max(-20,min(125,d(v))) for v in px],[v*SY for v in py],d(loc[0]) if loc else None,'in' if poss==t else 'out')
            if x:rows.append((t,'in' if poss==t else 'out',x))
    return rows
def one(comp,m):
    mid=str(m['match_id'])
    if mid in res:return None
    for k in range(4):
        try:
            try:F=get(f'three-sixty/{mid}.json')
            except urllib.error.HTTPError as e:
                if e.code==404:return mid,None
                raise
            E=get(f'events/{mid}.json');break
        except Exception as e:
            if k==3:return mid,{'err':str(e)[:80]}
            time.sleep(2+3*k)
    rows=frames(E,F)
    if not rows:return mid,None
    P=MODEL.predict(np.array([r[2] for r in rows]))
    T={}
    for (t,ph,x),p in zip(rows,P):
        a=T.setdefault(t,{'in':[],'out':[],'bin':[],'bout':[]});a[ph].append(float(p));a['b'+ph].append(x[0])
    return mid,{'c':comp['competition_name'],'s':comp['season_name'],'g':comp['competition_gender'],'d':m['match_date'],'h':m['home_team']['home_team_name'],'a':m['away_team']['away_team_name'],'sc':f"{m['home_score']}-{m['away_score']}",
                't':{t:{'in':round(float(np.mean(v['in'])),2) if v['in'] else None,'out':round(float(np.mean(v['out'])),2) if v['out'] else None,'nin':len(v['in']),'nout':len(v['out']),
                        'raw_in':round(float(np.mean(v['bin'])),2) if v['bin'] else None,'raw_out':round(float(np.mean(v['bout'])),2) if v['bout'] else None} for t,v in T.items()}}
jobs=[(comp,m) for comp in C for m in get(f"matches/{comp['competition_id']}/{comp['season_id']}.json")]
print(len(jobs),'matches',flush=True)
with cf.ThreadPoolExecutor(6) as ex:
    for i,r in enumerate(ex.map(lambda j:one(*j),jobs)):
        if r:res[r[0]]=r[1]
        if i%25==0:json.dump(res,open(OUT,'w'));print(i,len(res),flush=True)
json.dump(res,open(OUT,'w'));print('done',sum(1 for v in res.values() if v and 'err' not in v),'with lines',sum(1 for v in res.values() if v is None),'without 360',sum(1 for v in res.values() if v and 'err' in v),'errors')
