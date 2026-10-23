"""Every StatsBomb open-data match with 360 frames: each team's defensive line height (deepest outfield player, metres from its
own goal line on a 105 m pitch) with and without the ball. Raw files are read and thrown away; only per-match results are kept."""
import json,urllib.request,statistics as st,concurrent.futures as cf,os,sys,time
sys.path.insert(0,os.path.dirname(__file__));from sbline import match_lines
B='https://raw.githubusercontent.com/statsbomb/open-data/master/data/'
get=lambda p:json.load(urllib.request.urlopen(B+p,timeout=120))
C=[x for x in json.load(open('competitions.json')) if x.get('match_available_360')]
OUT='sb_results.json';res=json.load(open(OUT)) if os.path.exists(OUT) else {}
def one(comp,m):
    mid=str(m['match_id'])
    if mid in res:return None
    for k in range(4):
        try:
            try:F=get(f'three-sixty/{mid}.json')
            except urllib.error.HTTPError as e:
                if e.code==404:return mid,{'no360':1}
                raise
            E=get(f'events/{mid}.json');break
        except Exception as e:
            if k==3:return mid,{'err':str(e)[:80]}
            time.sleep(2+3*k)
    L=match_lines(E,F)
    teams={t:{'in':[round(st.mean(v['in']),2),len(v['in'])] if v['in'] else None,'out':[round(st.mean(v['out']),2),len(v['out'])] if v['out'] else None} for t,v in L.items()}
    return mid,{'c':comp['competition_name'],'s':comp['season_name'],'g':comp['competition_gender'],'d':m['match_date'],'h':m['home_team']['home_team_name'],'a':m['away_team']['away_team_name'],
                'sc':f"{m['home_score']}-{m['away_score']}",'t':teams}
jobs=[]
for comp in C:
    for m in get(f"matches/{comp['competition_id']}/{comp['season_id']}.json"):jobs.append((comp,m))
print(len(jobs),'matches',flush=True)
with cf.ThreadPoolExecutor(6) as ex:
    for i,r in enumerate(ex.map(lambda j:one(*j),jobs)):
        if r:res[r[0]]=r[1]
        if i%20==0:json.dump(res,open(OUT,'w'));print(i,len(res),flush=True)
json.dump(res,open(OUT,'w'));print('done',len(res),sum(1 for v in res.values() if 'no360' in v),'without 360',sum(1 for v in res.values() if 'err' in v),'errors')
