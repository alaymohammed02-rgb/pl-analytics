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
WRAP=m.gh_put
def put(hub,p,c,msg):
    old=store.get(p);new=json.loads(c.decode())
    if old==new:return False
    store[p]=new;puts.append(p);return True
m.gh_put=put
m._mx_status=lambda hub,p:'missing' if p not in store else 'ok'
tmp=tempfile.mkdtemp();m.DB_PATH=os.path.join(tmp,'t.db');m.init_db()

# ---- the rating ----
E=lambda k,v:N(key=k,stat=N(type='x',value=v,total=None))
G=lambda **kw:N(key='g',title='g',stats=kw)
pl=lambda i,*groups:N(player=N(id=i,name='P'+i),team_id='t',stats=list(groups))
ok(m.mx_rating(pl('a',G(Minutes=E('minutes_played',90)),G(Rating=E('rating',7.31))))==(7.31,'rating'),'the rating is the stat whose key is "rating"')
ok(m.mx_rating(pl('a',G(FR=E('fantasy_rating',55)),G(R=E('match_rating','6.9'))))==(6.9,'match_rating'),'another key with "rating" is used when its value is 0-10 (55 is not a rating)')
ok(m.mx_rating(pl('a',G(R=E('player_rating',8.0),R2=E('rating',7.0))))==(7.0,'rating'),'the exact key "rating" wins over a longer one')
ok(m.mx_rating(pl('a',G(R=E('rating',None))))==(None,None),'no value: no rating (nothing invented)')

# ---- matches in the database ----
c=m.db()
def match(L,mid,date,score='1-0',status='ok'):
    c.execute("INSERT INTO matches(league_id,match_id,date,home,away,score,status,fetched_at) VALUES(?,?,?,?,?,?,?,?)",(L,mid,date,'A','B',score,status,'x'))
for i in range(40):match('L1','a%02d'%i,'2026-09-%02d'%(1+i%28))
for i in range(30):match('L2','b%02d'%i,'2026-10-%02d'%(1+i%20))
match('L2','future','2026-10-30',score=None,status='pending')
match('L2','nodata','2026-10-19',status='no_data')
c.commit();c.close()

LP=lambda i,x,y,cap=False:N(player_id=i,name='N'+i,shirt_number='9',position_id=11,is_captain=cap,pitch_x=x,pitch_y=y)
side=lambda pre,ok_=True:N(formation='4-3-3',confirmed=ok_,lineup_type=None if ok_ else 'lastStarting11',coach=N(id='c',name='Coach '+pre),
    starters=[LP(pre+str(j),0.1*j,0.5,j==3) for j in range(11)],subs=[LP(pre+'s'+str(j),0,0) for j in range(7)])
calls=[];plan_mo=set();miss_mo=set();pred=set()
class M:
    def lineups(s,mid):calls.append(('lineups',mid));return N(match_id=mid,home_team=N(id='h',name='A'),away_team=N(id='a',name='B'),home=side('h',mid not in pred),away=side('a',mid not in pred))
    def momentum(s,mid):
        calls.append(('momentum',mid))
        if mid in plan_mo:raise m.PlanUpgradeRequiredError('plan')
        if mid in miss_mo:raise m.NotFoundError('nf')
        return N(match_id=mid,points=[N(minute=k,value=(-1)**k*k*1.234567) for k in range(1,91)])
    def players(s,mid):calls.append(('players',mid));return [pl('h%d'%j,G(R=E('rating',6+j/10))) for j in range(11)]+[pl('x',G(M=E('minutes',0)))]
class C:
    def __init__(s):s.matches=M()
lids=['L1','L2']
m.MX_PER_RUN=50
m.sync_match_centre(C(),None,lids)
mx1,mx2,rt2=store.get('data/L1_mx.json'),store.get('data/L2_mx.json'),store.get('data/L2_rt.json')
ids=[x[1] for x in calls if x[0]=='lineups']
dt={r['i']:r['d'] for r in m.q("SELECT match_id i,date d FROM matches")};ds=[dt[i] for i in ids]
ok(len(ids)==50 and ds==sorted(ds,reverse=True) and all(i.startswith('b') for i in ids[:30]),'at most 50 matches a run, newest first across leagues (October before September)')
ok('future' not in ids and 'nodata' not in ids,'only finished matches (with a score and fetched as ok/partial)')
ok(len(calls)==150,'three requests a match: lineups, momentum, players (%d)'%len(calls))
g=mx2['m']['b00'];lu=g['lu']['h']
ok(lu['f']=='4-3-3' and lu['ok']==1 and lu['c']=='Coach h' and len(lu['xi'])==11 and len(lu['sb'])==7,'lineup stored: formation, confirmed, coach, XI and substitutes')
ok(lu['xi'][3]==['h3','Nh3','9',11,0.3,0.5,1] and lu['sb'][0]==['hs0','Nhs0','9',11],'each starter: id, name, number, position number, pitch_x, pitch_y, captain; substitutes without coordinates')
ok(len(g['mo'])==90 and g['mo'][1]==[2,2.469] and g['mo'][0]==[1,-1.235],'momentum stored minute by minute as given (sign kept, 3 decimals)')
ok(rt2['m']['b00']=={'h%d'%j:round(6+j/10,2) for j in range(11)} and rt2['k']=={'rating':330},'ratings stored per player (a player without a rating is left out); the key found is recorded')
ok(any('مفتاح التقييم في PitchAPI: rating' in l for l in logs) and any('نطاق الأرقام: pitch_x 0.0..1.0' in l for l in logs),'the log names the rating key and the range of the numbers')
ok(m.MX_INDEX['L2']=={'mx_file':'L2_mx.json','mx_v':m._mx_v(json.dumps(mx2,ensure_ascii=False,separators=(',',':')).encode()),'rt_file':'L2_rt.json','rt_v':m._mx_v(json.dumps(rt2,ensure_ascii=False,separators=(',',':')).encode())},'index entry with a version that follows the file')
ok(store['data/mx_index.json']==m.MX_INDEX,'manifest written')
ok(any('باقي 20 مباراة' in l for l in logs),'the log says how many are left for later runs')

# second run: the rest, then nothing
calls.clear();logs.clear();m.sync_match_centre(C(),None,lids)
ok(len({x[1] for x in calls})==20 and all(x[1].startswith('a') for x in calls),'next run: the 20 left')
calls.clear();m.sync_match_centre(C(),None,lids);ok(calls==[],'all complete: no requests')

# missing parts: only those are asked again, after a day, at most 3 times
c=m.db();match('L1','z1','2026-10-21');match('L1','z2','2026-10-21');match('L1','z3','2026-10-21');c.commit();c.close()
miss_mo.add('z1');pred.add('z2')
calls.clear();m.sync_match_centre(C(),None,lids)
st=store['data/L1_mx.json']['st']
ok(st['z1'][0]==1 and st['z1'][2]=='mo' and 'z3' not in st,'momentum missing: recorded with the part that is missing')
ok(st['z2'][2]=='lu' and store['data/L1_mx.json']['m']['z2']['lu']['h']['ok']==0,'a predicted (not confirmed) lineup is kept but asked again for the real one')
calls.clear();m.sync_match_centre(C(),None,lids);ok(calls==[],'not again within 24 hours')
real=m.now
for k in range(2,6):
    m.now=lambda k=k:'2026-01-0%d 00:00:00'%k
    s=store['data/L1_mx.json'];s['st']['z1'][1]='2020-01-01 00:00:00';s['st']['z2'][1]='2020-01-01 00:00:00'
    calls.clear();m.sync_match_centre(C(),None,lids)
    if k==2:ok(calls==[('lineups','z2'),('momentum','z1')] or sorted(calls)==sorted([('lineups','z2'),('momentum','z1')]),'a day later: only the missing parts are asked (%s)'%calls)
m.now=real
st=store['data/L1_mx.json']['st']
ok(st['z1'][0]==3 and calls==[],'after 3 tries the part is left (PitchAPI does not have it)')
ok(any('تركناها' in l for l in logs),'the log counts what was left')

# an endpoint the plan does not include: one request, then skipped for the rest of the run
c=m.db();[match('L2','p%d'%i,'2026-10-21') for i in range(5)];c.commit();c.close()
plan_mo.update({'p%d'%i for i in range(5)})
calls.clear();logs.clear();m.sync_match_centre(C(),None,lids)
ok(sum(1 for x in calls if x[0]=='momentum')==1 and sum(1 for x in calls if x[0]=='lineups')==5,'momentum not in the plan: asked once, then skipped this run; the rest still fetched')
ok(any('غير متاح بهذا الاشتراك' in l for l in logs),'and the log says so')

st2=store['data/L2_mx.json']['st'];ok(st2['p0'][0]==1 and all(st2['p%d'%i][0]==0 and st2['p%d'%i][1] for i in range(1,5)),'the matches that never asked for momentum do not lose a try, but wait a day like the rest')

# a file that exists but cannot be read this time: that league is skipped, nothing is overwritten
before=copy.deepcopy(store['data/L1_mx.json']);real_get=m.gh_get_json
m.gh_get_json=lambda hub,p:None if p=='data/L1_mx.json' else copy.deepcopy(store.get(p))
c=m.db();match('L1','r1','2026-10-21');c.commit();c.close()
calls.clear();logs.clear();m.sync_match_centre(C(),None,lids)
ok(store['data/L1_mx.json']==before and not any(x[1]=='r1' for x in calls) and any('تعذرت قراءة' in l for l in logs),'an unreadable saved file: the league is skipped this run and the file is left as it was')
m.gh_get_json=real_get

# rate limited: stop the step, keep what arrived
class RL(M):
    def players(s,mid):calls.append(('players',mid));raise m.RateLimitError('slow')
c=m.db();[match('L2','q%d'%i,'2026-10-21') for i in range(4)];c.commit();c.close()
calls.clear();logs.clear();cl=C();cl.matches=RL();m.sync_match_centre(cl,None,lids)
ok(len({x[1] for x in calls})==1 and any('يحدّ الطلبات' in l for l in logs),'rate limited: after the usual waits the step stops; no other match is asked (%d requests)'%len(calls))
ok(any(k in store['data/L1_mx.json']['m'] or k in store['data/L2_mx.json']['m'] for k in ('r1','q0','q1','q2','q3')),'and what arrived before is saved')

# the index: the entries are added to every publish, and the index is republished right away when they change
m.MX_INDEX.clear();m._MX_READ.clear();got={}
m._orig_gh_put_mx=lambda hub,p,c,msg:got.update(json.loads(c.decode()))
WRAP(None,'data/index.json',json.dumps({'leagues':[{'id':'L1'},{'id':'L9'}]}).encode(),'x')
ok(got['leagues'][0].get('mx_file')=='L1_mx.json' and got['leagues'][0].get('rt_file')=='L1_rt.json' and 'mx_file' not in got['leagues'][1],'data/index.json lists the files only for leagues that have them (from the manifest, first publish of a run)')
store['data/index.json']={'leagues':[{'id':'L1','name':'x'},{'id':'L2'}]}
m._orig_gh_put_mx=put;m.gh_put=WRAP
puts.clear();m.sync_match_centre(C(),None,lids)
ok('data/index.json' in puts and store['data/index.json']['leagues'][0]['mx_file']=='L1_mx.json','the index is republished when its entries are missing')
puts.clear();store['data/index.json']['leagues'][0].update(m.MX_INDEX['L1']);store['data/index.json']['leagues'][1].update(m.MX_INDEX['L2'])
m.sync_match_centre(C(),None,lids);ok('data/index.json' not in puts,'and not when they are already there')
ok(not any('SECRET' in json.dumps(v) for v in store.values()),'the key is never written')

# errors never stop the sync
m._orig_run_pipeline_mx=lambda hub,key:'done'
m.sync_match_centre=lambda *a:(_ for _ in ()).throw(RuntimeError('boom'))
class P:
    def __init__(s,**k):pass
    def __enter__(s):return C()
    def __exit__(s,*a):return False
m.PitchAPI=P;logs.clear()
ok(m.run_pipeline('HUB','KEY')=='done' and any('بقية المزامنة ما تأثرت' in l for l in logs),'an error here is logged and the sync carries on')
print('FAILED' if fails else 'all passed')
