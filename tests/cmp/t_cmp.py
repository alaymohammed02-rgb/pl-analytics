import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy,os,itertools,datetime
from types import SimpleNamespace as N
sys.path.insert(0,REPO+'/tests/stub')
os.environ['PITCHAPI_KEY']='SECRET'
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
logs=[];m.log=lambda *a:logs.append(' '.join(map(str,a)))
store={};puts=[]
m.gh_get_json=lambda hub,p:copy.deepcopy(store.get(p))
def put(hub,p,c,msg):store[p]=json.loads(c.decode());puts.append(p);return True
m.gh_put=put
m._logo_get=lambda u:('data:image/png;base64,AAAA',None)
m.time.sleep=lambda s:None

# --- seasons
ok(m._season_label('2025/2026')=='2025-26' and m._season_label('2026')=='2026' and m._season_label('x') is None,'season labels match the page (2025-26, 2026)')
ok(m._season_prev(['2023/2024','2025/2026','2024/2025','2026/2027'],'2026/2027')=='2025/2026','previous season from the list the API accepts')
ok(m._season_prev(['2018','2022','2026'],'2026')=='2022' and m._season_prev(['2026'],'2026') is None,'calendar-year competitions: the previous edition; none when there is none')

# --- league title from a full double round robin
T=lambda i,n:N(id='t%d'%i,name=n,image_url=None)
teams=[T(i,'Club %d'%i) for i in range(6)]
def season(score):
    out=[];k=0
    for a,b in itertools.permutations(range(6),2):
        h,g=score(a,b);out.append(N(id='m%d'%k,home_team=teams[a],away_team=teams[b],score_home=h,score_away=g,date='2026-05-%02d'%(1+k%28),status='played'));k+=1
    return out
strong=lambda a,b:(2,0) if a==0 else (0,1) if b==0 else (1,1)
rows=lambda ms:[(x.home_team.name,x.away_team.name,x.score_home,x.score_away) for x in ms]
r,why=m._league_title(rows(season(strong)))
ok(r and r['team']=='Club 0' and r['fixtures']==30 and r['margin']>0,'league champion from all 30 fixtures: '+str(r and r['team']))
po=rows(season(strong))+[('Club 5','Second Division FC',1,0),('Second Division FC','Club 5',0,2)]
r,why=m._league_title(po);ok(r and r['team']=='Club 0' and r['fixtures']==30,'relegation play-off against a second-division club is left out of the table')
r,why=m._league_title(rows(season(strong))[:-1]);ok(r is None and '29 of 30' in why,'an incomplete season gives no champion ('+why+')')
lvl=lambda a,b:(1,0) if (a,b) in ((0,2),(1,2),(0,3),(1,3),(0,4),(1,4),(0,5),(1,5),(2,0),(2,1)) else (1,1)
r,why=m._league_title(rows(season(lvl)));ok(r is None and 'level on points' in why,'top two level on points: no champion, the competition tiebreakers are not guessed ('+why+')')

# --- fake PitchAPI client
class Client:
    def __init__(s,data):s.data=data;s.calls=[];s.leagues=N(matches=s.lm);s.matches=N(get=s.get,events=s.events)
    def lm(s,lid,season=None,status=None):
        s.calls.append((lid,season,status));d=s.data[(lid,season,status)]
        if isinstance(d,Exception):raise d
        return d
    def get(s,mid):s.calls.append(('get',mid));return s.data[('get',mid)]
    def events(s,mid):s.calls.append(('events',mid));return s.data[('events',mid)]
LM=lambda season,ms:N(league=N(id='x',name='x',season=season),matches=ms)
fin=lambda h,a,sh,sa,d='2026-05-30',i='F':N(id=i,home_team=h,away_team=a,score_home=sh,score_away=sa,date=d,status='played')
psg,inter,ars=T(10,'Paris Saint-Germain'),T(11,'Inter'),T(12,'Arsenal')
cup=[fin(ars,inter,1,0,'2026-05-01','S1'),fin(psg,ars,2,1,'2026-05-06','S2'),fin(psg,inter,3,1)]
c=Client({('C',None,'upcoming'):None,('C','2025/2026','upcoming'):LM('2025/2026',[]),('get','F'):N(round_name='Final')})
r,why=m._cup_title(c,'C','2025/2026',cup);ok(r and r['team']=='Paris Saint-Germain' and r['runner_up']=='Inter','cup winner = winner of the final ('+str(r)+')')
c.data[('get','F')]=N(round_name='Semi-finals');r,why=m._cup_title(c,'C','2025/2026',cup);ok(r is None and 'not the final' in why,'last match not named the final: no champion ('+why+')')
c.data[('get','F')]=N(round_name='Final');c.data[('C','2025/2026','upcoming')]=LM('2025/2026',[cup[0]]);r,why=m._cup_title(c,'C','2025/2026',cup);ok(r is None and 'not finished' in why,'season with fixtures still to play: no champion')
c.data[('C','2025/2026','upcoming')]=LM('2025/2026',[])
drawn=cup[:2]+[fin(psg,inter,1,1)]
E=lambda per,t,team:N(period=per,event_type=t,team_id=team,minute=120,minute_added=0)
c.data[('events','F')]=N(events=[E('2H','goal','t10'),E('2H','goal','t11'),E('PEN','goal','t10'),E('PEN','goal','t11'),E('PEN','goal','t10'),E('PEN','missed_penalty','t11')])
r,why=m._cup_title(c,'C','2025/2026',drawn);ok(r and r['team']=='Paris Saint-Germain' and r.get('pens')=='2-1','drawn final decided by the shoot-out in the events ('+str(r and r.get('pens'))+')')
c.data[('events','F')]=N(events=[E('2H','goal','t10'),E('2H','goal','t11'),E('Penalties','yellowcard','t11')])
SH=lambda team,t:N(team_id=team,event_type=t,is_own_goal=False)
c.matches.shots=lambda mid:c.data[('shots',mid)]
c.data[('shots','F')]=N(periods=[N(period='SecondHalf',shots=[SH('t10','goal')]),N(period='Penalties',shots=[SH('t10','goal'),SH('t11','goal'),SH('t10','goal'),SH('t11','save'),SH('t10','miss'),SH('t11','goal'),SH('t10','goal'),SH('t11','post')])])
r,why=m._cup_title(c,'C','2025/2026',drawn);ok(r and r['team']=='Paris Saint-Germain' and r.get('pens')=='3-2','shoot-out goals missing from the events: counted from the shots of the penalties period ('+str(r and r.get('pens'))+')')
c.data[('shots','F')]=N(periods=[N(period='SecondHalf',shots=[SH('t10','goal')])])
r,why=m._cup_title(c,'C','2025/2026',drawn);ok(r is None and 'no shootout' in why,'drawn final without shoot-out data: no champion ('+why[:60]+')')

# --- sync_titles: league and cup, cached once per season, retried after a day
m._LEAGUE_LIST=[N(id='L',name='Liga',seasons=['2024/2025','2025/2026','2026/2027'],image_url=None),N(id='C',name='Cup',seasons=['2025/2026','2026/2027'],image_url=None)]
m._LEAGUE_SEASON={'L':'2026/2027','C':'2026/2027'}
c.data.update({('L','2025/2026','played'):LM('2025/2026',season(strong)),('C','2025/2026','played'):LM('2025/2026',cup)})
store['data/champions.json']={'leagues':{'l_4WFCIZ':{'team':'Arsenal','season':'2025-26','next':'2026-27'}}}
m.sync_titles(c,None,['L','C'])
ch=store['data/champions.json']['leagues']
ok(ch['L']['team']=='Club 0' and ch['L']['kind']=='league' and ch['L']['next']=='2026-27' and ch['L']['season']=='2025-26','league entry: Club 0 won 2025-26, defended in 2026-27')
ok(ch['C']['team']=='Paris Saint-Germain' and ch['C']['kind']=='cup' and 'final' in ch['C']['src'],'cup entry from its final: '+ch['C']['src'])
ok(ch['l_4WFCIZ']['team']=='Arsenal','the Premier League entry from the FPL archive is kept')
n=len(c.calls);m.sync_titles(c,None,['L','C']);ok(len(c.calls)==n,'next runs make no requests (worked out once per season)')
store['data/champions.json']['leagues'].pop('C');c.data[('get','F')]=N(round_name='Round of 16');m.sync_titles(c,None,['C'])
ok('C' not in store['data/champions.json']['leagues'] and store['data/champions.json']['tried']['C']['next']=='2026-27','unverifiable cup: no entry, the attempt is recorded')
n=len(c.calls);m.sync_titles(c,None,['C']);ok(len(c.calls)==n,'and it is not tried again within a day')
store['data/champions.json']['tried']['C']['t']='2026-01-01 00:00:00';c.data[('get','F')]=N(round_name='Final');m.sync_titles(c,None,['C'])
ok(store['data/champions.json']['leagues']['C']['team']=='Paris Saint-Germain','after a day it is tried again')
m._LEAGUE_SEASON={};n=len(c.calls);m.sync_titles(c,None,['L','C']);ok(len(c.calls)==n,'without the current season from the data, nothing is guessed or fetched')

# --- sync_europe: participation from each competition's fixture list, verified against our leagues
dom=[T(i,n) for i,n in enumerate(['Arsenal','Chelsea','Real Madrid','Barcelona','Inter','Roma','Lyon','Porto'],20)]
m._LOGO_REFS={'L1':[(dom[0],dom[1]),(dom[2],dom[3]),(dom[4],dom[5]),(dom[6],dom[7])],'l_0bfbkO':[]}
x=lambda h,a,d:N(id=h.name+a.name,home_team=h,away_team=a,score_home=None,score_away=None,date=d,status='upcoming')
fake=[T(90+i,'Fake %d'%i) for i in range(4)]
qual=T(50,'Qualifier FC')
m._LEAGUE_LIST=[N(id='l_0bfbkO',name='Champions League',seasons=[],image_url='https://cdn.pitchapi.dev/l/ucl.webp'),
 N(id='E1',name='Europa League',seasons=[],image_url='https://cdn.pitchapi.dev/l/uel.webp'),N(id='E9',name='Europa League',seasons=[],image_url=None),
 N(id='K1',name='Conference League',seasons=[],image_url=None),N(id='W1',name='UEFA Europa League Women',seasons=[],image_url=None)]
c=Client({('l_0bfbkO',None,'all'):LM('2026/2027',[x(dom[0],dom[2],'2026-09-16'),x(dom[3],dom[4],'2026-09-17'),x(qual,dom[1],'2026-08-20')]),
 ('E1',None,'all'):LM('2026/2027',[x(dom[1],dom[5],'2026-08-27'),x(dom[6],qual,'2026-10-02'),x(dom[7],T(60,'Other'),'2026-10-02'),x(dom[5],T(61,'Other2'),'2026-10-23')]),
 ('E9',None,'all'):LM('2026',[x(fake[0],fake[1],'2026-05-01')]),
 ('K1',None,'all'):LM('2026/2027',[x(dom[1],T(70,'K'),'2026-10-02'),x(T(71,'K2'),T(72,'K3'),'2026-10-02'),x(dom[5],dom[7],'2026-10-09')])})
ids=m.sync_europe(c,None);eu=store['data/europe.json'];C={k['key']:k for k in eu['comps']}
ok(set(C)=={'ucl','uel','uecl'} and C['uel']['id']=='E1','Europa League found by name and verified by its clubs (not the women\'s one or the namesake with unknown clubs)')
ok(C['ucl']['teams']==['Arsenal','Barcelona','Inter','Real Madrid'],'Champions League clubs from its main phase; the August qualifier is left out: '+','.join(C['ucl']['teams']))
ok('Qualifier FC' in C['uel']['teams'] and 'Qualifier FC' not in C['ucl']['teams'],'a club that dropped from the Champions League qualifiers is only in the Europa League')
ok('Chelsea' not in C['uel']['teams'] and 'Chelsea' in C['uecl']['teams'],'Europa League play-off in August is not counted: Chelsea is in the Conference League only')
ok('Porto' in C['uecl']['teams'] and 'Porto' not in C['uel']['teams'],'a club in two main-phase lists stays only in the lower one: '+','.join(C['uel']['teams'])+' | '+','.join(C['uecl']['teams']))
ok(eu['season']=='2026-27' and C['uel']['logo'].startswith('data:image') and m._LEAGUE_SEASON['E1']=='2026/2027','season label, competition logo, and the season kept for the titles step')
n=len(c.calls);m.sync_europe(c,None);ok(len(c.calls)==n,'refreshed at most every 12 hours')

# --- fixtures: every league, hourly, earlier when a stored fixture's day has passed
c=Client({('L1',None,'upcoming'):LM('2026/2027',[x(dom[0],dom[1],'2026-10-25'),x(dom[2],dom[3],'2026-10-24')]),('L2',None,'upcoming'):LM('2026',[])})
for k in list(c.data):c.data[k].matches and [setattr(mm,'time_utc','19:00:00') for mm in c.data[k].matches]
store.pop('data/fixtures.json',None);m.sync_fixtures(c,None,['L1','L2']);fx=store['data/fixtures.json']['leagues']
ok([r['h'] for r in fx['L1']]==['Real Madrid','Arsenal'] and fx['L1'][0]['k']=='19:00:00' and fx['L2']==[],'upcoming fixtures stored per league, in date order, with the UTC kick-off')
n=len(c.calls);m.sync_fixtures(c,None,['L1','L2']);ok(len(c.calls)==n,'not fetched again within the hour')
store['data/fixtures.json']['leagues']['L1'][0]['d']='2000-01-01'
m.sync_fixtures(c,None,['L1','L2']);ok(len(c.calls)==n,'a postponed fixture already overdue when fetched does not cause refetching')
store['data/fixtures.json']['t']='2026-01-01 10:00:00';store['data/fixtures.json']['leagues']['L1'][0]['d']='2026-01-02'
m.sync_fixtures(c,None,['L1','L2']);ok(len(c.calls)==n+2,'a fixture whose day passed since the last fetch triggers a refresh')
n=len(c.calls);m.sync_fixtures(c,None,['L1','L2','L3']) if False else None
# --- run_pipeline: the three steps run after the original pipeline and never stop it
order=[];m._orig_run_pipeline_cmp=lambda hub,k:order.append('pipeline') or True
m.PitchAPI=lambda api_key:N(__enter__=lambda s=None:Client({}),__exit__=lambda *a:False)
class Ctx:
    def __init__(s,api_key):pass
    def __enter__(s):return 'client'
    def __exit__(s,*a):return False
m.PitchAPI=Ctx
m.sync_europe=lambda cl,hub:order.append('europe') or ['E1']
def bad(*a):order.append('fixtures');raise RuntimeError('boom')
m.sync_fixtures=bad
got=[];m.sync_titles=lambda cl,hub,l:order.append('titles') or got.extend(l)
m._LOGO_REFS={'l_4WFCIZ':[],'L1':[],'l_0bfbkO':[]}
r=m.run_pipeline(None,'k')
ok(r is True and order==['pipeline','europe','fixtures','titles'],'after the pipeline: Europe, fixtures, titles; an error in one does not stop the rest ('+','.join(order)+')')
ok(got==['L1','l_0bfbkO','E1'],'titles for every league except the Premier League (FPL archive), plus the European competitions: '+','.join(got))
ok(any('[Fixtures] خطأ' in l for l in logs),'the error is logged')
ok(not any('SECRET' in json.dumps(v) for v in store.values()),'the PitchAPI key is never written to any file')
print('FAILED' if fails else 'all passed')
