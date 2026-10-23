import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy,datetime
sys.path.insert(0,REPO+'/tests/stub')
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fails=0
def ok(c,msg):
    global fails
    print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
store={};puts=[]
m.gh_get_json=lambda hub,path: copy.deepcopy(store.get(path))
def put(hub,path,content,message):
    store[path]=json.loads(content.decode());puts.append((path,message))
m._orig_gh_put_trk=put
m.log=lambda *a:print('   log:',*a)
import subprocess,tempfile
# The live data/fpl.json, with the times moved relative to now, so the test does not depend on today's date or on which gameweek is next:
# the next gameweek's deadline is in two days and the data were generated an hour ago.
UTC=datetime.timezone.utc;NOW=datetime.datetime.now(UTC)
iso=lambda t:t.strftime('%Y-%m-%dT%H:%M:%SZ');gen=lambda t:t.strftime('%Y-%m-%d %H:%M:%S')
base=json.loads(open(REPO+'/data/fpl.json','rb').read())
nx=next((e for e in base['events'] if e.get('nxt')),None) or next((e for e in base['events'] if not e.get('fin')),None)
if nx is None:
    print('FAIL data/fpl.json has no unfinished gameweek');sys.exit(1)
for e in base['events']:e['nxt']=e is nx
GW=nx['id'];G=str(GW);DL=NOW+datetime.timedelta(days=2);nx['dl']=iso(DL);base['generated']=gen(NOW-datetime.timedelta(hours=1))
SEASON=str(base['events'][0].get('dl') or '')[:4]
def run(d):
    m._TRK_FPL=json.dumps(d).encode();n=len(puts);m.sync_fpl_track(None);return len(puts)-n
# the expected record, computed independently: the test's own runner (trk/runner.js) on the page's Fantasy code (the page sync.py builds)
h=m.INDEX;a,b=h.find('/* ===== Fantasy (FPL) ===== */'),h.find('/* ===== Fantasy seasons:')
with tempfile.TemporaryDirectory() as td:
    open(td+'/code.js','w',encoding='utf-8').write(h[a:b]);json.dump(base,open(td+'/fpl.json','w'))
    pr=subprocess.run(['node',REPO+'/tests/trk/runner.js',td+'/code.js',td+'/fpl.json'],capture_output=True,text=True,timeout=900)
if pr.returncode!=0:
    print('FAIL trk/runner.js:',pr.stderr[:300]);sys.exit(1)
snap=json.loads(pr.stdout)
# a) before the deadline: saved
n=run(base);T=store.get('data/fpl_track.json')
ok(n==1 and T and T['season']==SEASON and G in T['gws'],'saves the GW%s prediction before the deadline (season %s)'%(G,SEASON))
r=T['gws'][G];ok(all(r[k]==snap[k] for k in ('xi','cap','vice','bench','exp','p10','p90','preds','ver','kappa')),'saved record = the page code\'s Optimal XI, range and predictions (exp %s, %s–%s)'%(r['exp'],r['p10'],r['p90']))
ok(r['dl']==iso(DL) and r['saved'],'deadline and save time recorded')
# b) same data again: no commit
ok(run(base)==0,'unchanged prediction: no new commit')
# c) newer data, same predictions: no commit
d=copy.deepcopy(base);d['generated']=gen(NOW-datetime.timedelta(minutes=30));ok(run(d)==0,'newer data with the same prediction: no new commit')
# d) changed prediction (a player ruled out) before the deadline: updated
d=copy.deepcopy(base);ix={c:i for i,c in enumerate(d['cols'])};cap=r['cap']
for row in d['rows']:
    if row[0]==cap:row[ix['st']]='i';row[ix['chance_of_playing_next_round']]=0
d['generated']=gen(NOW-datetime.timedelta(minutes=20));n=run(d);r2=store['data/fpl_track.json']['gws'][G]
ok(n==1 and cap not in r2['xi'],'captain ruled out before the deadline: record updated, he is no longer in the XI')
# e) after the deadline: locked
past=copy.deepcopy(base)
for e in past['events']:
    if e['id']==GW:e['dl']=iso(NOW-datetime.timedelta(days=1))
before=json.dumps(store['data/fpl_track.json']);ok(run(past)==0 and json.dumps(store['data/fpl_track.json'])==before,'after the deadline: nothing is saved')
store['data/fpl_track.json']['gws'][G]['dl']=iso(NOW-datetime.timedelta(days=1));before=json.dumps(store['data/fpl_track.json'])
ok(run(base)==0 and json.dumps(store['data/fpl_track.json'])==before,'a record whose deadline has passed is never overwritten')
# f) data fetched after the deadline is never used for that gameweek
d=copy.deepcopy(base);d['generated']=gen(DL+datetime.timedelta(hours=1));del store['data/fpl_track.json'];ok(run(d)==0,'data generated after the deadline is not used')
# g) new season: the old record is kept in its own file
OLD=str(int(SEASON)-1);store['data/fpl_track.json']={'season':OLD,'gws':{'38':{'gw':38}}};n=run(base)
ok(store.get('data/fpl_track_%s.json'%OLD,{}).get('gws',{}).get('38') and store['data/fpl_track.json']['season']==SEASON and list(store['data/fpl_track.json']['gws'])==[G],'new season: last season\'s record moved to data/fpl_track_%s.json'%OLD)
# h) interval near the deadline
o={'events':[{'id':GW,'nxt':True,'dl':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%SZ')}]}
o2={'events':[{'id':GW,'nxt':True,'dl':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=5)).strftime('%Y-%m-%dT%H:%M:%SZ')}]}
ok(m._fpl_interval(o)==15 and m._fpl_interval(o2)==55 and m._fpl_interval({})==55,'data refresh every 15 min in the last 3 h before a deadline, otherwise 55')
print('FAILED' if fails else 'all passed');sys.exit(1 if fails else 0)
