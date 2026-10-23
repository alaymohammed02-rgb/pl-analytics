import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy,datetime
sys.path.insert(0,REPO+'/tests/stub')
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.log=lambda *a:None
man={'seasons':[dict(season=s,file=f'fpl_{s}.json',av=m.FPL_ARCHIVE_VER,rows=1,reproduced=100.0) for s in ['2022-23','2023-24','2024-25','2025-26']]}
store={'data/fpl_archive.json':man};puts=[];tries=[]
m.gh_get_json=lambda hub,p:copy.deepcopy(store.get(p))
def put(hub,p,c,msg):store[p]=json.loads(c.decode());puts.append(p)
m.gh_put=put
def get(s):
    def g(name):tries.append(s);raise RuntimeError('404')
    return g
m._fpa_get=get
m.FPL_ARCHIVE=['2022-23','2023-24','2024-25','2025-26','2026-27']   # as in July 2027, before the archive publishes 2026-27
m.sync_fpl_archive(None);a=len(tries);t=store['data/fpl_archive.json'].get('tried',{})
m.sync_fpl_archive(None);b=len(tries)
store['data/fpl_archive.json']['tried']['2026-27']=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=48)).strftime('%Y-%m-%d %H:%M:%S');m.sync_fpl_archive(None);c=len(tries)
ok=lambda c_,s:print(('ok  ' if c_ else 'FAIL'),s)
ok(a==1 and '2026-27' in t,'unpublished season tried once and the attempt time stored')
ok(b==a,'next sync within 20 h: not tried again')
ok(c==a+1,'after 20 h: tried again')
ok(len(store['data/fpl_archive.json']['seasons'])==4,'existing seasons untouched')
