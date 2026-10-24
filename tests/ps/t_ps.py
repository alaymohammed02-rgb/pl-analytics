"""Past seasons (sync section): a fake PitchAPI client; checks the batch cap, one request per endpoint per match, resuming on the next
run from the published files, the files and the index manifest, plan refusals, and that the current season's files are untouched."""
import sys,importlib.util,json,copy,os,tempfile
from types import SimpleNamespace as N
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0,os.path.join(HERE,'..','stub'));os.environ['PITCHAPI_KEY']='SECRET'
spec=importlib.util.spec_from_file_location("m",os.path.join(ROOT,'sync.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.PS_PROBE=0   # the probe of a new light season has its own tests below; the others keep their numbers
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
logs=[];m.log=lambda *a:logs.append(' '.join(map(str,a)));m.time.sleep=lambda s:None
store={};puts=[]
m.gh_get_json=lambda hub,p:copy.deepcopy(store.get(p))
def put(hub,p,c,msg):
    new=json.loads(c.decode())
    if store.get(p)==new:return False
    store[p]=new;puts.append(p);return True
m._orig_gh_put_ps=put          # the section's own wrapper (index manifest) stays on top of the fake GitHub
m._mx_status=lambda hub,p:'missing' if p not in store else 'ok'
def fresh_db():
    tmp=tempfile.mkdtemp();m.DB_PATH=os.path.join(tmp,'t.db');m.init_db()
fresh_db()
m._LEAGUE_LIST=[N(id='l_4WFCIZ',name='Premier League',seasons=['2026/2027','2025/2026','2024/2025']),N(id='l_0ErfuF',name='LaLiga',seasons=['2026/2027','2025/2026'])]
m._LEAGUE_SEASON={'l_4WFCIZ':'2026/2027','l_0ErfuF':'2026/2027'}
store['data/index.json']={'leagues':[{'id':'l_4WFCIZ','file':'l_4WFCIZ.json'}],'generated':'g'}
store['data/l_4WFCIZ.json']={'id':'l_4WFCIZ','matches':[],'stats':[]}
CUR=copy.deepcopy(store['data/l_4WFCIZ.json'])

E=lambda k,v:N(key=k,stat=N(type='x',value=v,total=None))
G=lambda **kw:N(key='g',title='g',stats=kw)
def prow(mid,j,side):return N(name='P%s%d'%(side,j),player=N(id='%s%d'%(side,j),name='P%s%d'%(side,j)),team=N(name='Home' if side=='h' else 'Away'),
    minutes_played=90,stats=[G(xg=E('expected_goals',0.1*j)),G(r=E('rating',6.5))])
LP=lambda i:N(player_id=i,name='N'+i,shirt_number='1',position_id=11,is_captain=False,pitch_x=.1,pitch_y=.5)
side=lambda:N(formation='4-3-3',confirmed=True,coach=N(name='C'),starters=[LP('p%d'%j) for j in range(11)],subs=[])
calls=[];PLAN=set();LISTPLAN=set();ROWS=set()   # ROWS: league tags (last 3 characters of the id) whose matches have advanced player rows; the others have none, like Ligue 1 before 2025-26 in PitchAPI
class MT:
    def __getattr__(s,name):
        def f(mid,*a,**kw):
            calls.append((name,mid)+a)
            if mid in PLAN:raise m.PlanUpgradeRequiredError('plan')
            if name=='players':return [prow(mid,j,sd) for sd in 'ha' for j in range(3)]
            if name=='advanced_players' and mid[:3] in ROWS:return N(players=[N(player=N(id='%s-ap%d'%(mid,j),name='AP%d'%j),team_id='t%d'%(j%2),minutes_played=90) for j in range(3)])
            if name=='lineups':return N(home=side(),away=side())
            if name=='momentum':return N(points=[N(minute=k,value=k/10) for k in range(1,5)])
            if name=='players_halves':return N(players=[N(player=N(id='h1'),team_id='t',periods=[N(period='FirstHalf',stats=[G(p=E('passes',10))])])])
            raise m.NotFoundError('analytics unavailable')
        return f
class LG:
    def matches(s,lid,season=None,status=None):
        calls.append(('list',lid,season,status))
        if (lid,season) in LISTPLAN:raise m.PlanUpgradeRequiredError('plan')
        return N(league=N(season=season),matches=[N(id='%s-m%03d'%(lid[-3:],i),date='2025-%02d-%02d'%(8+i//30,1+i%28),home_team=N(id='h',name='Home%d'%(i%10)),
            away_team=N(id='a',name='Away%d'%((i+3)%10)),score_home=i%3,score_away=1,status='finished') for i in range(100)]+
            [N(id='x-unplayed',date='2026-05-30',home_team=N(id='h',name='H'),away_team=N(id='a',name='A'),score_home=None,score_away=None)])
class C:
    def __init__(s):s.matches=MT();s.leagues=LG()

ok(m.ps_seasons('l_4WFCIZ')==[('2025/2026','2025-26')],'the previous season: the one before the current season in the league\'s list, named like the site (2025-26)')
ok(m.ps_seasons('l_4WFCIZ',back=2)==[('2025/2026','2025-26'),('2024/2025','2024-25')] and m.ps_seasons('nope')==[],'further back on request; unknown league: none')

m.PS_JOBS=[('l_4WFCIZ',1,'full')];m.PS_REQ_PER_RUN=400;m.PS_PROBE=0;ROWS.clear()
call0,due0=m.call,m.match_due
calls.clear();m.sync_past_seasons(C(),None)
ok(m.call is call0 and m.match_due is due0,'call() and match_due() are restored after the section')
P='l_4WFCIZ_2025-26'
L=store.get('data/%s.json'%P)
ok(L and L['id']==P and len(L['matches'])==40,'one season file with the first 40 matches (the per-run cap)')
allm=sorted(LG().matches('l_4WFCIZ').matches[:100],key=lambda x:(x.date,x.id));calls.pop()
ok({x['i'] for x in L['matches']}=={x.id for x in allm[:40]},'oldest matches first')
ok('x-unplayed' not in {x[1] for x in calls if len(x)>1},'a match without a score is not fetched')
per={}
for c in calls:
    if c[0]!='list':per.setdefault((c[0],)+c[2:],set()).add(c[1])
dup=[c for c in set(calls) if calls.count(c)>1]
ok(not dup,'no request is made twice in a run (advanced_players, advanced, players, shots are shared by the steps): %s'%dup[:3])
ok(sum(1 for c in calls if c[0]!='list')==m.PS['req']-1,'the request counter counts every request (%d + the match list)'%m.PS['req'])
eps=sorted({c[0]+('/'+c[2] if len(c)>2 else '') for c in calls if c[0]!='list'})
ok(eps==['advanced','advanced_network','advanced_players','heatmaps','lineups','momentum','players','players_halves','shots'],'endpoints asked: %s'%eps)
F=['%s%s.json'%(P,x) for x in ('','_adv','_pl','_sh','_mx','_rt','_hv')]
ok(all('data/'+f in store for f in F),'files: league, advanced, players, shots, line-ups, ratings, halves (same formats, season in the name)')
ok(store['data/l_4WFCIZ.json']==CUR and not any(p in ('data/l_4WFCIZ.json','data/l_4WFCIZ_pl.json','data/l_4WFCIZ_sh.json') for p in puts),'the current season\'s files are not touched')
st=store['data/seasons.json']['leagues']['l_4WFCIZ']
s1=st['seasons']['2025-26']
ok(st['cur']=='2026-27' and s1['n']==100 and s1['got']==40 and not s1['complete'] and s1['req']==m.PS['req']-1,'state: 100 played matches in PitchAPI, 40 fetched, requests recorded')
man=store['data/index.json'].get('seasons')
ok(man and man['l_4WFCIZ']['cur']=='2026-27' and man['l_4WFCIZ']['past'][0]['s']=='2025-26' and man['l_4WFCIZ']['past'][0]['file']==P+'.json'
   and man['l_4WFCIZ']['past'][0]['matches']==40 and man['l_4WFCIZ']['past'][0]['total']==100 and man['l_4WFCIZ']['past'][0]['complete'] is False,'index.json lists the season with its files')
ok(store['data/index.json']['leagues']==[{'id':'l_4WFCIZ','file':'l_4WFCIZ.json'}],'the rest of the index is unchanged')
ok(L['stats'] and all(x['c'] in ('Home','Away') for x in L['stats']),'player rows with their clubs')
mx=store['data/%s_mx.json'%P];rt=store['data/%s_rt.json'%P]
ok(len(mx['m'])==40 and len(rt['m'])==40 and len(store['data/%s_hv.json'%P]['m'])==40,'line-ups, ratings and halves for each fetched match')

# a later run: a fresh machine (empty database) continues from the published files
fresh_db();calls.clear();m.PS['state']=None
m.sync_past_seasons(C(),None)
L2=store['data/%s.json'%P]
got={c[1] for c in calls if c[0]=='advanced_players'}
ok(len(L2['matches'])==80 and len(got)==40 and not got&{x['i'] for x in L['matches']},'next run: the next 40, nothing fetched again')
ok(len(store['data/%s_mx.json'%P]['m'])==80,'line-ups kept and extended')
fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
s1=store['data/seasons.json']['leagues']['l_4WFCIZ']['seasons']['2025-26']
ok(s1['got']==100 and s1['complete'] and store['data/index.json']['seasons']['l_4WFCIZ']['past'][0]['complete'],'third run: the last 20, the season is complete')
fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
ok(calls==[],'complete season: no request at all')

# a new index written by the main sync keeps the seasons list
m.PS['state']=None
m.gh_put(None,'data/index.json',json.dumps({'leagues':[],'generated':'h'}).encode(),'x')
ok(store['data/index.json'].get('seasons',{}).get('l_4WFCIZ'),'every index.json write carries the seasons list')

# the plan refuses the season list: nothing published, retried after a week
m.PS_JOBS=[('l_0ErfuF',1,'full')];LISTPLAN.add(('l_0ErfuF','2025/2026'));fresh_db();calls.clear();m.PS['state']=None
m.sync_past_seasons(C(),None)
s2=store['data/seasons.json']['leagues']['l_0ErfuF']['seasons']['2025-26']
ok(s2['plan'] and not any(p.startswith('data/l_0ErfuF_2025-26') for p in store),'plan refusal of the match list: state says so, no files')
calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
ok(calls==[],'and it is not asked again within a week')
# the plan allows the list but not the matches
LISTPLAN.clear();store['data/seasons.json']['leagues']['l_0ErfuF']['seasons']['2025-26']['t']='2020-01-01 00:00:00'
PLAN.update('fuF-m%03d'%i for i in range(100));fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
s2=store['data/seasons.json']['leagues']['l_0ErfuF']['seasons']['2025-26']
ok(s2['plan'] and not any(p.startswith('data/l_0ErfuF_2025-26') for p in store),'plan refusal of the match data: nothing published')
ok(any('plan' in l for l in logs),'the log says the plan refused')
# a light season (two back): matches, players and shots only, for the Fantasy model; not listed in the season selector
m.PS_JOBS=[('l_4WFCIZ',2,'light')];PLAN.clear();fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
P2='l_4WFCIZ_2024-25';s3=store['data/seasons.json']['leagues']['l_4WFCIZ']['seasons']['2024-25']
eps=sorted({c[0] for c in calls if c[0]!='list'})
ok(eps==['advanced','advanced_players','players','shots'],'light season: four endpoints a match (%s)'%eps)
ok(s3['light'] and s3['got']==400//m.PS_COST['light'] and not s3['complete'] and s3['req']<=401,'light season: %d matches within the request budget of 400 (%d requests)'%(s3['got'],s3['req']))
fresh_db();m.PS['state']=None;m.sync_past_seasons(C(),None);s3=store['data/seasons.json']['leagues']['l_4WFCIZ']['seasons']['2024-25']
ok(s3['got']==100 and s3['complete'],'light season: the next run completes it')
ok(all('data/%s%s.json'%(P2,x) in store for x in ('','_pl','_sh')) and not any('data/%s%s.json'%(P2,x) in store for x in ('_adv','_heat','_mx','_rt','_hv')),'light season: league, players and shots files only')
ok([p['s'] for p in store['data/index.json']['seasons']['l_4WFCIZ']['past']]==['2025-26'],'light seasons are not offered in the season selector')
# a new light season whose matches have no advanced player rows: only the first PS_PROBE matches are fetched, nothing is published, and it is retried after a week
m.PS_PROBE=6;m.PS_JOBS=[('l_0ErfuF',1,'light')];fresh_db();calls.clear();logs.clear();m.PS['state']=None
store['data/seasons.json']['leagues'].setdefault('l_0ErfuF',{}).pop('seasons',None);m.PS_REQ_PER_RUN=1200;m.sync_past_seasons(C(),None)
sp=store['data/seasons.json']['leagues']['l_0ErfuF']['seasons']['2025-26']
fetched={c[1] for c in calls if c[0]!='list'}
ok(len(fetched)==m.PS_PROBE and sp['plan'] and sp['err']=='no player rows' and not sp.get('got'),'no player rows: only the first %d matches were fetched (%d requests), the season is marked and left alone'%(len(fetched),sum(1 for c in calls if c[0]!='list')))
ok(not any(p.startswith('data/l_0ErfuF_2025-26') for p in store) and any('إحصائيات لاعبين' in l for l in logs),'no player rows: nothing published, and the log says why')
calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
ok(not any(c[0]!='list' for c in calls),'the next run leaves it alone (retry after PS_PLAN_RETRY_D days)')
store['data/seasons.json']['leagues']['l_0ErfuF']['seasons']['2025-26']['t']='2020-01-01 00:00:00';ROWS.add('fuF');fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
sp=store['data/seasons.json']['leagues']['l_0ErfuF']['seasons']['2025-26']
ok(sp['got']==100 and sp['complete'] and not sp['plan'],'a week later, with player rows: the probe passes and the whole season is fetched in the same run (%s matches)'%sp['got'])
store['data/seasons.json']['leagues'].pop('l_0ErfuF',None);m.PS_REQ_PER_RUN=400

ok(store['data/seasons.json']['leagues']['l_4WFCIZ']['api_seasons']==['2026/2027','2025/2026','2024/2025'],'the seasons PitchAPI lists for the league are recorded')
# the light season becomes full: only the missing parts are fetched, within the request budget, and it joins the season selector
m.PS_JOBS=[('l_4WFCIZ',2,'full')];before=copy.deepcopy(store['data/%s.json'%P2]);runs=[]
for k in range(6):
    fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
    s4=store['data/seasons.json']['leagues']['l_4WFCIZ']['seasons']['2024-25'];runs.append((m.PS['req'],sorted({c[0] for c in calls if c[0]!='list'})))
    if s4.get('complete'):break
ok(not s4['light'] and s4['complete'] and len(runs)==3,'light to full: completes in %d runs (%s)'%(len(runs),[r[0] for r in runs]))
ok(all(r[0]<=401 for r in runs),'light to full: every run within the request budget of 400')
ok(not any('shots' in r[1] for r in runs),'light to full: shots are not fetched again')
ok(store['data/%s.json'%P2]['matches']==before['matches'],'light to full: the match list is unchanged')
ok(all('data/%s%s.json'%(P2,x) in store for x in ('_adv','_mx','_rt','_hv')) and len(store['data/%s_mx.json'%P2]['m'])==100 and len(store['data/%s_hv.json'%P2]['m'])==100
   and len(store['data/%s_adv.json'%P2]['ex'])==100,'light to full: advanced, line-ups, ratings and halves for all 100 matches')
ok([p['s'] for p in store['data/index.json']['seasons']['l_4WFCIZ']['past']]==['2025-26','2024-25'],'light to full: now offered in the season selector')
fresh_db();calls.clear();m.PS['state']=None;m.sync_past_seasons(C(),None)
ok(calls==[],'light to full, complete: no request at all')
# club names: a light season has no advanced team rows, so the player and shot files take the name from the team rows
fresh_db();c=m.db();P3='L_light'
c.execute(m._TD_SQL,(P3,'mm','t1','Leeds United','home')+(None,)*len(m._TD_COLS))
c.execute(m._PL_SQL,(P3,'mm','p1','A Player','t1',90.0)+(None,)*len(m._PL_COLS))
sh=dict(pd='FirstHalf',pid='p1',pn='A Player',tid='t1',xg=0.3,ev='Goal',mn=10)
c.execute(m._SH_SQL,(P3,'mm','s1')+tuple(sh.get(k) for k in m._SH_COLS));c.commit();c.close()
plp,shp=m.build_pl_payload(P3),m.build_sh_payload(P3)
ok(plp['rows'][0][plp['cols'].index('c')]=='Leeds United' and shp['rows'][0][shp['cols'].index('c')]=='Leeds United','without advanced team rows, the club name comes from the team rows (not the team id)')
c=m.db();c.execute("DELETE FROM team_def");c.commit();c.close()
ok(m.build_sh_payload(P3)['rows'][0][-1]=='t1','with no name anywhere the team id stays (nothing invented)')
print('all passed' if not fails else '%d FAILED'%fails)
