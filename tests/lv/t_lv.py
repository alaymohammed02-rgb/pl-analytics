import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy,os,tempfile,datetime
from types import SimpleNamespace as N
sys.path.insert(0,REPO+'/tests/stub');os.environ['PITCHAPI_KEY']='SECRET'
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
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
WRAP=m.gh_put
m.gh_put=put
m._mx_status=lambda hub,p:'missing' if p not in store else 'ok'
tmp=tempfile.mkdtemp();m.DB_PATH=os.path.join(tmp,'t.db');m.init_db()
T=datetime.datetime(2026,10,22,18,0,tzinfo=datetime.timezone.utc)
iso=lambda mins:(T+datetime.timedelta(minutes=mins)).strftime('%Y-%m-%dT%H:%M:%SZ')
store['data/fixtures.json']={'t':'x','leagues':{'L1':[dict(i='soon',d='2026-10-22',k=iso(50),h='A',a='B'),dict(i='later',d='2026-10-22',k=iso(300),h='C',a='D'),
  dict(i='live',d='2026-10-22',k=iso(-40),h='E',a='F'),dict(i='old',d='2026-10-22',k=iso(-200),h='G',a='H')],'L9':[dict(i='other',d='2026-10-22',k=iso(10),h='X',a='Y')]}}
ok([w[1]['i'] for w in m.lv_window(store['data/fixtures.json'],T)]==['soon','live','other'],'window: kick-off within 90 minutes, or started under 150 minutes ago')
LP=lambda i:N(player_id=i,name='N'+i,shirt_number='1',position_id=11,is_captain=False,pitch_x=.1,pitch_y=.5)
side=lambda conf:N(formation='4-3-3',confirmed=conf,lineup_type=None,coach=N(name='C'),starters=[LP('p%d'%j) for j in range(11)],subs=[])
CONF={'soon':False,'live':True,'other':True};calls=[]
class MT:
    def lineups(s,mid):calls.append(('lineups',mid));c=CONF[mid];return N(match_id=mid,home_team=N(id='th',name='h'),away_team=N(id='ta',name='a'),home=side(c),away=side(c))
    def events(s,mid):calls.append(('events',mid));return N(match_id=mid,events=[N(event_type='Goal',minute=12,minute_added=0,period='FirstHalf',team_id='th',player=N(id='p1',name='Scorer'),sub_in_player=None,score_home=1,score_away=0,is_own_goal=False,is_penalty=False),
        N(event_type='Card',minute=30,minute_added=0,period='FirstHalf',team_id='ta',player=N(id='p2',name='Booked'),sub_in_player=None,score_home=None,score_away=None,is_own_goal=False,is_penalty=False)])
    def get(s,mid):calls.append(('get',mid));return N(home_team=N(id='th'))
    def h2h(s,mid):calls.append(('h2h',mid));return N(match_id=mid,home_team=N(id='th'),away_team=N(id='ta'),home_wins=2,draws=1,away_wins=0,total_matches=3,
        recent_matches=[N(home=N(name='A'),away=N(name='B'),time_utc='2025-01-02T15:00:00Z',score_home=2,score_away=1,finished=True),N(home=N(name='B'),away=N(name='A'),time_utc='2027-01-02T15:00:00Z',score_home=None,score_away=None,finished=False)])
class DT:
    def get(s,d,status=None):calls.append(('date',d,status));return N(date=d,matches=[N(id='live',status='inprogress',score_home=1,score_away=0),N(id='soon',status='notstarted',score_home=None,score_away=None),N(id='other',status='notstarted',score_home=None,score_away=None)])
class C:
    def __init__(s):s.matches=MT();s.date=DT()
m.sync_live(C(),None,['L1'],T)
L=store['data/live.json']['m']
ok(set(L)=={'soon','live'},'only the leagues on the site, only the close matches')
ok(sum(1 for c in calls if c[0]=='date')==1 and ('date','2026-10-22','all') in calls,'one request for the status and score of all matches of the day')
ok('lu' not in L['soon'] and L['soon'].get('pred')==1,'a predicted (not confirmed) lineup is never stored')
ok(L['live']['lu']['h']['xi'][0][0]=='p0' and L['live'].get('lut'),'an official lineup is stored (with the time it was found)')
ok(L['live']['st']=='inprogress' and L['live']['sh']==1 and L['live']['sa']==0,'status and score stored exactly as PitchAPI gives them')
ok(L['live']['ev'][0][:5]==[12,0,'Goal','h','Scorer'] and L['live']['ev'][1][3]=='a','events with minute, type and the side (from the home team id)')
ok(not any(c==('events','soon') for c in calls),'no events asked before kick-off')
ok(any('قيم status' in l and 'inprogress (1)' in l for l in logs),'the log lists the status values PitchAPI used')
calls.clear();m.sync_live(C(),None,['L1'],T)
ok(('lineups','live') not in calls and ('lineups','soon') in calls,'next run: the official lineup is not asked again; the one still predicted is')
CONF['soon']=True;calls.clear();m.sync_live(C(),None,['L1'],T+datetime.timedelta(minutes=10))
ok('lu' in store['data/live.json']['m']['soon'],'as soon as PitchAPI confirms it, the official lineup is stored')
m.sync_live(C(),None,['L1'],T+datetime.timedelta(hours=9))
ok(store['data/live.json']['m']=={},'matches leave the file 8 hours after kick-off')
ok(not any('SECRET' in json.dumps(v) for v in store.values()),'the key is never written')
# head to head
# sync_h2h reads the real clock: the fixtures are re-dated relative to now, so the check does not depend on today's date
_now=datetime.datetime.now(datetime.timezone.utc);isoN=lambda mins:(_now+datetime.timedelta(minutes=mins)).strftime('%Y-%m-%dT%H:%M:%SZ')
store['data/fixtures.json']={'t':'x','leagues':{'L1':[dict(i='soon',d=isoN(50)[:10],k=isoN(50),h='A',a='B'),dict(i='later',d=isoN(300)[:10],k=isoN(300),h='C',a='D'),
  dict(i='live',d=isoN(-40)[:10],k=isoN(-40),h='E',a='F'),dict(i='old',d=isoN(-200)[:10],k=isoN(-200),h='G',a='H')],'L9':[dict(i='other',d=isoN(10)[:10],k=isoN(10),h='X',a='Y')]}}
calls.clear();m.sync_h2h(C(),None,['L1'])
H=store['data/h2h.json']['m']
ok(set(H)<= {'soon','later','live','old'} and H['soon']['hw']==2 and H['soon']['r']==[['2025-01-02','A','B',2,1]],'head to head stored once per upcoming match, finished meetings only')
n=len(calls);m.sync_h2h(C(),None,['L1']);ok(len(calls)==n,'not asked again')
# halves
c=m.db()
for i in range(3):c.execute("INSERT INTO matches(league_id,match_id,date,home,away,score,status,fetched_at) VALUES(?,?,?,?,?,?,?,?)",('L1','h%d'%i,'2026-10-1%d'%i,'A','B','1-0','ok','x'))
c.commit();c.close()
E=lambda k,v:N(key=k,stat=N(type='integer',value=v,total=None))
def per(name,v):return N(period=name,stats=[N(key='g',title='g',stats={'Touches':E('touches',v),'xG':E('expected_goals',v/100),'Passes':E('accurate_passes',v-5),'Rating':E('rating',7)})])
class MH(MT):
    def players_halves(s,mid):
        calls.append(('halves',mid))
        if mid=='h1':raise m.NotFoundError('HALVES_UNAVAILABLE')
        return N(match_id=mid,players=[N(player=N(id='p1',name='A'),team_id='th',periods=[per('FirstHalf',40),per('SecondHalf',30)]),N(player=N(id='p2',name='B'),team_id='ta',periods=[per('SecondHalf',12)])])
cl=C();cl.matches=MH();logs.clear();m.LV_INDEX.clear()
m.sync_halves(cl,None,['L1'])
hv=store['data/L1_hv.json']
ok(hv['km']=={'tc':'touches','xg':'expected_goals','pa':'accurate_passes'},'the measures are picked from PitchAPI\'s key names (%s)'%hv['km'])
ok(hv['m']['h0']['c']==['tc','xg','pa'] and hv['m']['h0']['p']['p1']==['th',[40,.4,35],[30,.3,25]],'per player: team, first-half values, second-half values')
ok(hv['m']['h0']['p']['p2'][1] is None and hv['m']['h0']['p']['p2'][2]==[12,.12,7],'a half-time substitute has only the second half')
ok('h1' not in hv['m'] and hv['st']['h1'][0]==1,'a match without halves is recorded and retried later (max 3)')
ok(any('كل مفاتيح PitchAPI' in l and 'rating' in l for l in logs),'the log lists every key PitchAPI has per half')
ok(m.LV_INDEX['L1']['hv_file']=='L1_hv.json' and store['data/hv_index.json']['L1']['hv_file']=='L1_hv.json','index entry and manifest')
calls.clear();m.sync_halves(cl,None,['L1']);ok(calls==[],'next run: nothing new to ask')
# a measure added later (e.g. minutes per half): the stored matches are fetched again, new ones first
s2=store['data/L1_hv.json'];s2['km']['mi']='minutes_played'
calls.clear();m.sync_halves(cl,None,['L1'])
ok(('halves','h0') in calls and ('halves','h2') in calls,'a new measure: the stored matches are fetched again so every match has it')
# unreadable halves file: skipped, not overwritten
before=copy.deepcopy(store['data/L1_hv.json']);rg=m.gh_get_json;m.gh_get_json=lambda hub,p:None if p=='data/L1_hv.json' else copy.deepcopy(store.get(p))
c=m.db();c.execute("INSERT INTO matches(league_id,match_id,date,home,away,score,status,fetched_at) VALUES(?,?,?,?,?,?,?,?)",('L1','h9','2026-10-20','A','B','1-0','ok','x'));c.commit();c.close()
m.sync_halves(cl,None,['L1']);m.gh_get_json=rg
ok(store['data/L1_hv.json']==before,'a halves file that exists but cannot be read is left as it was')
# the shared files are announced in data/index.json only once they exist (so the page never asks for a missing file)
m.LV_HAVE.clear();m.LV_INDEX.clear();m._LV_DONE.clear();store.pop('data/hv_index.json',None);got={}
m._orig_gh_put_lv=lambda hub,p,c,msg:got.update(json.loads(c.decode()))
WRAP(None,'data/index.json',json.dumps({'leagues':[{'id':'L1'}]}).encode(),'x')
ok('live' not in got and 'h2h' not in got,'no live.json / h2h.json yet: the index does not announce them')
m.LV_HAVE.clear();m.sync_live(C(),None,['L1'],T);m.sync_h2h(C(),None,['L1']);got.clear()
WRAP(None,'data/index.json',json.dumps({'leagues':[{'id':'L1'}]}).encode(),'x')
ok(got.get('live')==1 and got.get('h2h')==1,'once written, data/index.json says live: 1 and h2h: 1')
# the all-leagues schedule (Overview board)
sc_calls=[]
class DS:
    def get(s,d,status=None):
        sc_calls.append(d);T_=lambda n,img=None:N(id='t'+n,name=n,image_url=img)
        return N(date=d,matches=[N(id='x'+d,league=N(id='L1',name='League One',image_url='https://cdn/l1.png'),home_team=T_('Home','https://cdn/h.png'),away_team=T_('Away'),time_utc=d+'T19:00:00Z',status='finished',score_home=2,score_away=1),
                                N(id='o'+d,league=N(id='L9',name='Other',image_url=None),home_team=T_('P'),away_team=T_('Q'),time_utc=d+'T15:00:00Z',status='notstarted',score_home=None,score_away=None)])
cs=C();cs.date=DS();store.pop('data/schedule.json',None);logs.clear()
m.sync_schedule(cs,None,['L1'],T)
sch=store['data/schedule.json']
ok(len(sc_calls)==15 and len(sch['d'])==15,'first run: one request a day, 7 days back to 7 ahead (%d)'%len(sc_calls))
ok(all(len(v)==1 and v[0][0]=='L1' for v in sch['d'].values()),'only the leagues of the site are kept')
r=sch['d']['2026-10-22'][0];ok(r==['L1','x2026-10-22','2026-10-22T19:00:00Z','Home','Away',2,1,'finished'],'each match: league, id, kick-off, clubs, score, status as PitchAPI gives them')
ok(sch['C']=={'Home':'https://cdn/h.png'} and sch['L']['L1']['n']=='League One','crest links and league names kept once')
sc_calls.clear();m.sync_schedule(cs,None,['L1'],T+datetime.timedelta(minutes=10))
ok(sorted(sc_calls)==['2026-10-21','2026-10-22','2026-10-23'],'within the hour: only yesterday, today and tomorrow are asked again')
sc_calls.clear();m.sync_schedule(cs,None,['L1'],T+datetime.timedelta(minutes=70))
ok(len(sc_calls)==15,'every hour: all the days again')
# the index wrapper and the pipeline
got={};m._orig_gh_put_lv=lambda hub,p,c,msg:got.update(json.loads(c.decode()))
m.LV_INDEX.clear();m._LV_DONE.clear();m.gh_put=m.gh_put if False else None
spec2=None
print('FAILED' if fails else 'all passed')
