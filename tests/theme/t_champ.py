import sys,importlib.util,json,copy,datetime
sys.path.insert(0,'stub')
spec=importlib.util.spec_from_file_location("m","/home/user/pl-analytics/sync.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
R='/home/user/pl-analytics/data/'
logs=[];m.log=lambda *a:logs.append(' '.join(map(str,a)))
# 1. champion of every archived season (known real champions)
exp={'2022-23':'Man City','2023-24':'Man City','2024-25':'Liverpool','2025-26':'Arsenal'}
got={s:(m._champion_of(json.load(open(R+f'fpl_{s}.json'))) or {}).get('team') for s in exp}
ok(got==exp,'champion from verified results for every archived season: '+str(got))
d=json.load(open(R+'fpl_2025-26.json'))
# 2. an unfinished season gives no champion
x=copy.deepcopy(d);x['fix'][-1][5]=0;ok(m._champion_of(x) is None,'one unfinished fixture: no champion')
x=copy.deepcopy(d);x['fix']=x['fix'][:-1];ok(m._champion_of(x) is None,'a missing fixture: no champion')
# 3. level on points, goal difference and goals: no champion (not decidable from results alone)
tiny={'teams':[{'id':1,'n':'A'},{'id':2,'n':'B'}],'fix':[[1,1,2,0,0,1,1,0,''],[2,2,1,0,0,1,1,0,'']]}
ok(m._champion_of(tiny) is None,'two clubs level on points, goal difference and goals: no champion')
# 4. sync_champions: writes once for the previous season, never guesses
store={};puts=[]
def get(hub,path):
    if path in store:return copy.deepcopy(store[path])
    try:return json.load(open(R+path[5:]))
    except FileNotFoundError:return None
m.gh_get_json=get
def put(hub,path,content,msg):store[path]=json.loads(content.decode());puts.append(path)
m.gh_put=put
store['data/champions.json']=None
m.sync_champions(None);c=store.get('data/champions.json')
e=(c or {}).get('leagues',{}).get('l_4WFCIZ',{})
ok(e.get('team')=='Arsenal' and e.get('season')=='2025-26' and e.get('next')=='2026-27' and e.get('pts')==85 and e.get('margin')==7,'2026-27 season: champions.json says Arsenal won 2025-26 (85 pts, 7 clear), defended in 2026-27')
n=len(puts);m.sync_champions(None);ok(len(puts)==n,'second run: nothing rewritten')
store['data/fpl_archive.json']={'seasons':[]};store['data/champions.json']=None;n=len(puts);m.sync_champions(None)
ok(len(puts)==n,'previous season not in the archive yet: no file, no guess')
# 5. archive seasons follow the date; a new completed season is added from July
ok(m._fpa_seasons(datetime.datetime(2026,10,21))==['2022-23','2023-24','2024-25','2025-26'],'Oct 2026: archive 2022-23 → 2025-26')
ok(m._fpa_seasons(datetime.datetime(2027,6,30))[-1]=='2025-26' and m._fpa_seasons(datetime.datetime(2027,7,1))[-1]=='2026-27','2026-27 joins the archive from July 2027')
print('FAILED' if fails else 'all passed')
# write the real file from the real data
store={'data/champions.json':None};m.gh_get_json=get;m.sync_champions(None)
out=json.dumps(store['data/champions.json'],ensure_ascii=False,indent=1)   # computed first: the file is only written with a result
open('champions_generated.json','w',encoding='utf-8').write(out)   # kept in the scratchpad: the repository file is the sync's
