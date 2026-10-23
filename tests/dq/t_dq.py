import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy,os,tempfile,datetime
from types import SimpleNamespace as N
sys.path.insert(0,REPO+'/tests/stub');os.environ['PITCHAPI_KEY']='SECRET'
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
logs=[];m.log=lambda *a:logs.append(' '.join(map(str,a)));m.time.sleep=lambda s:None
store={};m.gh_get_json=lambda hub,p:copy.deepcopy(store.get(p))
def put(hub,p,c,msg):store[p]=json.loads(c.decode());return True
m.gh_put=put
tmp=tempfile.mkdtemp();m.DB_PATH=os.path.join(tmp,'t.db');m.init_db()

# ---- learning the position numbers ----
fpl={'cols':['id','wn','fn','sn','ty'],'rows':[]}
pos_ids,names=dict(),dict()
def addp(pid,name,posid,ty=None,fn=None,sn=None):
    pos_ids[pid]=posid;names[pid]=name
    if ty:fpl['rows'].append([len(fpl['rows'])+1,(sn or name).split()[-1],fn or name.split()[0],sn or ' '.join(name.split()[1:]),ty])
for i in range(6):addp('d%d'%i,'Def Ender%d'%i if False else 'Défen Der%s'%chr(97+i),2,2)            # accents in PitchAPI names
for i in range(5):addp('m%d'%i,'Mid Fielder%s'%chr(97+i),3,3)
for i in range(4):addp('f%d'%i,'For Ward%s'%chr(97+i),4,4)
addp('f9','Mid Fieldertwo',4,3)                                                                       # one disagreement: 4 of 5 still FW
for i in range(2):addp('x%d'%i,'Rare One%s'%chr(97+i),9,2)                                            # only 2 samples
for i in range(3):addp('y%d'%i,'Split One%s'%chr(97+i),8,2 if i else 3)
for i in range(3):addp('y%d'%(i+3),'Split Two%s'%chr(97+i),8,3)                                       # 3 DF? no: 2 DF + 4 MF = 67% MF
for i in range(4):addp('g%d'%i,'Keep Er%s'%chr(97+i),1)                                               # goalkeepers known from xG faced only
addp('dup','John Smith',5,2);fpl['rows'].append([99,'Smith','John','Smith',4])                        # same name twice in FPL: ignored
for i in range(4):addp('z%d'%i,'John Smith',5)
mp,ev=m.dq_learn_positions(pos_ids,names,fpl,{'g0','g1','g2','g3'})
ok(mp.get('2')=='DF' and mp.get('3')=='MF' and mp.get('4')=='FW' and mp.get('1')=='GK','learned 1→GK (from xG faced), 2→DF, 3→MF, 4→FW: %s'%mp)
ok(ev['4']=={'FW':4,'MF':1},'a disagreeing player is counted but the majority wins (%s)'%ev['4'])
ok('9' not in mp,'a number with too little evidence stays without a position')
ok(mp.get('8')=='MF' and ev['8']=={'MF':4,'DF':2},'a 4-to-2 split is accepted at 67%')
ok('5' not in ev,'a name shared by two FPL players is not used as evidence')
ok(m._dq_norm('Défen  Dera')=='defen dera','names compared without accents, case or extra spaces')

# ---- applying positions to the published files ----
c=m.db()
for pid,mi in [('a1',90),('a2',80),('a3',70),('a4',60)]:
    c.execute("INSERT INTO stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",('L1','m1',pid,pid,'P '+pid,'Club',None,0.1,0.1,None,mi,'PitchAPI',None))
c.execute("INSERT INTO stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",('L1','m1','a5','a5','P a5','Club','FW',0.1,0.1,None,90,'PitchAPI',None))
c.execute("INSERT INTO matches(league_id,match_id,date,home,away,score,status,fetched_at) VALUES(?,?,?,?,?,?,?,?)",('L1','m1','2026-10-01','A','B','1-0','ok','x'))
c.commit();c.close()
store['data/photos_L1.json']={'p':{},'q':{'a1':2,'a2':4,'a3':9,'a5':2}}
m.DQ.update(hub='HUB',q={},done=set(),map={'2':'DF','4':'FW'})
pay=m.build_league_payload({'id':'L1','name':'L','country':''})
po={s['i']:s['o'] for s in pay['stats']}
ok(po=={'a1':'DF','a2':'FW','a3':None,'a4':None,'a5':'FW'},'positions written for known numbers only; an existing position is never overwritten: %s'%po)
m.DQ.update(map=None,done=set(),q={})
c=m.db();c.execute("UPDATE stats SET pos=NULL");c.commit();c.close()
pay=m.build_league_payload({'id':'L1','name':'L','country':''})
ok(all(s['o'] is None for s in pay['stats']),'without a learned table nothing is written (no guessing)')

# ---- the matches that lack xAG ----
now=datetime.datetime(2026,10,21,12,tzinfo=datetime.timezone.utc)
c=m.db()
def match(mid,date,fetched,xag,status='ok'):
    c.execute("INSERT INTO matches(league_id,match_id,date,home,away,score,status,fetched_at) VALUES(?,?,?,?,?,?,?,?)",('L2',mid,date,'A','B','1-0','ok','x'))
    c.execute("INSERT INTO pm VALUES(?,?,?,?)",('L2',mid,status,fetched))
    for j,v in enumerate(xag):c.execute(m._PL_SQL,('L2',mid,'p%d'%j,'P','t',90)+tuple(v if k=='xag' else 1.0 for k,_,_ in m._PL_F)+tuple(0 for _ in m._PL_S))
match('new_null','2026-10-18','2026-10-18T20:00:00Z',[None,None])          # null, last fetched 3 days ago: due
match('fresh_null','2026-10-20','2026-10-21T06:00:00Z',[None,None])        # fetched 6 h ago: wait
match('old_null','2026-07-01','2026-07-02T00:00:00Z',[None,None])          # over 60 days: give up
match('has_xag','2026-10-18','2026-10-18T20:00:00Z',[0.2,None])            # has xAG for a player: fine
match('partial','2026-10-18','2026-10-18T20:00:00Z',[None],status='partial')  # not "ok": the normal retry handles it
c.commit();c.close()
todo,tot=m.dq_xag_todo('L2',now)
ok(todo==['new_null'] and tot==3,'due again: only the complete match without xAG, last tried a day ago, within 14 days (%s of %d)'%(todo,tot))
seen={}
def fake(client,L,on_progress=None):
    seen['st']={r['match_id']:r['status'] for r in m.q("SELECT match_id,status FROM pm WHERE league_id=?",(L,))}
    cc=m.db();cc.execute("UPDATE pl_adv SET xag=0.3 WHERE league_id=? AND match_id='new_null'",(L,));cc.execute("UPDATE pm SET status='ok',fetched_at=? WHERE league_id=? AND match_id='new_null'",(m.now(),L));cc.commit();cc.close()
m._orig_sync_pstats_dq=fake
m.dq_xag_todo=lambda L,t_now=None,_f=m.dq_xag_todo:_f(L,now)
logs.clear();m.sync_pstats(None,'L2')
ok(seen['st']['new_null']=='pending' and seen['st']['fresh_null']=='ok' and seen['st']['has_xag']=='ok','the due match is handed to the normal fetch as pending; the others are untouched')
ok(any('1 من 1 صار فيها xAG' in l for l in logs),'the log says how many came back with xAG')
todo,tot=m.dq_xag_todo('L2',now)
ok('new_null' not in todo and tot==2,'once it has xAG it is no longer counted')

# ---- the run: learning at the end, from the photo files and FPL ----
store.clear();m.DQ.update(q={},done=set(),map=None)
store['data/fpl.json']=fpl
m._LOGO_REFS={'L1':[],'L2':[]}
m.PHOTO_POS_IDS={'L1':{p:v for p,v in pos_ids.items()}}
m.q_orig=m.q
def q2(sql,args=()):
    if 'MAX(player)' in sql:return [{'i':p,'n':n} for p,n in names.items()]
    if 'xg_faced IS NOT NULL' in sql:return [{'i':'g%d'%i} for i in range(4)]
    return m.q_orig(sql,args)
m.q=q2
m._orig_run_pipeline_dq=lambda hub,key:'done'
logs.clear();out=m.run_pipeline('HUB','KEY')
ok(out=='done' and store.get('data/positions_map.json',{}).get('map',{}).get('2')=='DF','the learned table is saved to data/positions_map.json')
ok(any('الجدول المتعلَّم' in l for l in logs) and any('بدون أدلة كافية' in l for l in logs),'the log shows the table and the numbers left without a position')
n=len([1 for p in store]);logs.clear();m.run_pipeline('HUB','KEY')
ok(len(store)==n,'an unchanged table is not written again')
ok(not any('SECRET' in json.dumps(v) for v in store.values()),'the key is never written')
m._orig_run_pipeline_dq=lambda hub,key:(_ for _ in ()).throw(RuntimeError('x'))
try:m.run_pipeline('HUB','KEY');ok(False,'pipeline errors still raise')
except RuntimeError:ok(True,'an error in the main sync is not hidden')
print('FAILED' if fails else 'all passed')
