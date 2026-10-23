import sys,importlib.util,json,copy,datetime
sys.path.insert(0,'stub')
spec=importlib.util.spec_from_file_location("m","/home/user/pl-analytics/sync.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
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
raw=open('/home/user/pl-analytics/data/fpl.json','rb').read()
base=json.loads(raw)
def run(d):
    m._TRK_FPL=json.dumps(d).encode();n=len(puts);m.sync_fpl_track(None);return len(puts)-n
# a) before the deadline: saved
n=run(base);T=store.get('data/fpl_track.json');snap=json.load(open('trk/snap.json'))
ok(n==1 and T and T['season']=='2026' and '8' in T['gws'],'saves the GW8 prediction before the deadline')
r=T['gws']['8'];ok(all(r[k]==snap[k] for k in ('xi','cap','vice','bench','exp','p10','p90','preds','ver','kappa')),'saved record = the page code\'s Optimal XI, range and predictions (exp %s, %s–%s)'%(r['exp'],r['p10'],r['p90']))
ok(r['dl']=='2026-10-23T17:30:00Z' and r['saved'],'deadline and save time recorded')
# b) same data again: no commit
ok(run(base)==0,'unchanged prediction: no new commit')
# c) newer data, same predictions: no commit
d=copy.deepcopy(base);d['generated']='2026-10-21 05:00:00';ok(run(d)==0,'newer data with the same prediction: no new commit')
# d) changed prediction (a player ruled out) before the deadline: updated
d=copy.deepcopy(base);ix={c:i for i,c in enumerate(d['cols'])};cap=r['cap']
for row in d['rows']:
    if row[0]==cap:row[ix['st']]='i';row[ix['chance_of_playing_next_round']]=0
d['generated']='2026-10-21 06:00:00';n=run(d);r2=store['data/fpl_track.json']['gws']['8']
ok(n==1 and cap not in r2['xi'],'captain ruled out before the deadline: record updated, he is no longer in the XI')
# e) after the deadline: locked
past=copy.deepcopy(base)
for e in past['events']:
    if e['id']==8:e['dl']='2026-10-20T10:00:00Z'
before=json.dumps(store['data/fpl_track.json']);ok(run(past)==0 and json.dumps(store['data/fpl_track.json'])==before,'after the deadline: nothing is saved')
store['data/fpl_track.json']['gws']['8']['dl']='2026-10-20T10:00:00Z';before=json.dumps(store['data/fpl_track.json'])
ok(run(base)==0 and json.dumps(store['data/fpl_track.json'])==before,'a record whose deadline has passed is never overwritten')
# f) data fetched after the deadline is never used for that gameweek
d=copy.deepcopy(base);d['generated']='2026-10-24 09:00:00';del store['data/fpl_track.json'];ok(run(d)==0,'data generated after the deadline is not used')
# g) new season: the old record is kept in its own file
store['data/fpl_track.json']={'season':'2025','gws':{'38':{'gw':38}}};n=run(base)
ok(store.get('data/fpl_track_2025.json',{}).get('gws',{}).get('38') and store['data/fpl_track.json']['season']=='2026' and list(store['data/fpl_track.json']['gws'])==['8'],'new season: last season\'s record moved to data/fpl_track_2025.json')
# h) interval near the deadline
o={'events':[{'id':8,'nxt':True,'dl':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%SZ')}]}
o2={'events':[{'id':8,'nxt':True,'dl':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=5)).strftime('%Y-%m-%dT%H:%M:%SZ')}]}
ok(m._fpl_interval(o)==15 and m._fpl_interval(o2)==55 and m._fpl_interval({})==55,'data refresh every 15 min in the last 3 h before a deadline, otherwise 55')
print('FAILED' if fails else 'all passed')
