import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy,os,base64
from types import SimpleNamespace as N
sys.path.insert(0,REPO+'/tests/stub')
os.environ['PITCHAPI_KEY']='SECRET'
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
logs=[];m.log=lambda *a:logs.append(' '.join(map(str,a)))
store={};puts=[];reqs=[]
m.gh_get_json=lambda hub,p:copy.deepcopy(store.get(p))
def put(hub,p,c,msg):
    if p=='data/index.json':
        store[p]=json.loads(c.decode())
    else:store[p]=json.loads(c.decode())
    puts.append(p);return True
m._orig_gh_put_logo=put
PNG=b'\x89PNG\r\n\x1a\n'+b'x'*100
class R:
    def __init__(s,code,ct,body):s.status_code=code;s.headers={'content-type':ct};s.content=body
def get(url,headers=None,timeout=None):
    reqs.append((url,dict(headers or {})))
    if 'big' in url:return R(200,'image/png',b'x'*(m.LOGO_MAX_BYTES+1))
    if 'gone' in url:return R(404,'text/html',b'no')
    return R(200,'image/png',PNG)
m.requests=N(get=get)
T=lambda n,u:N(name=n,image_url=u)
m._LOGO_REFS={'L1':[(T('Arsenal','https://img.pitchapi.dev/t/1.png'),T('Chelsea','https://cdn.example.com/t/2.png')),(T('Big FC','https://img.pitchapi.dev/big.png'),T('Gone FC','https://img.pitchapi.dev/gone.png'))]}
m._LEAGUE_IMG={'L1':'https://img.pitchapi.dev/l/1.png'}
m.sync_logos(None,'L1')
f=store.get('data/logos_L1.json') or {}
ok(set(f.get('teams',{}))=={'Arsenal','Chelsea'} and f['teams']['Arsenal'].startswith('data:image/png;base64,') and f.get('league','').startswith('data:image/png'),'logos stored as images for Arsenal, Chelsea and the league; the oversized and the missing one are skipped')
k={u:h.get('X-API-KEY') for u,h in reqs}
ok(k['https://img.pitchapi.dev/t/1.png']=='SECRET' and k['https://cdn.example.com/t/2.png'] is None,'the PitchAPI key goes only to PitchAPI\'s own host')
ok(not any('SECRET' in json.dumps(v) for v in store.values()),'the key is never written to any file')
man=store['data/logos_src.json']['L1'];ok(set(man['fail'])=={'Big FC','Gone FC'},'failures recorded with their reason: '+'; '.join(f"{n}: {v['why']}" for n,v in man['fail'].items()))
ok(m.LOGO_INDEX.get('L1',{}).get('logo_file')=='logos_L1.json','index entry prepared')
# second run in the same sync: nothing; a new sync: nothing new to download, failed ones wait 24 h
n=len(reqs);m.sync_logos(None,'L1');m._LOGO_DONE.clear();m.sync_logos(None,'L1');ok(len(reqs)==n,'already stored logos and recent failures are not downloaded again')
# a club's logo changes upstream: it is downloaded again
m._LOGO_REFS['L1'][0]=(T('Arsenal','https://img.pitchapi.dev/t/1b.png'),m._LOGO_REFS['L1'][0][1]);m._LOGO_DONE.clear();v0=m.LOGO_INDEX['L1']['logo_v'];m.sync_logos(None,'L1')
ok(reqs[-1][0].endswith('1b.png') and m.LOGO_INDEX['L1']['logo_v']!=v0,'a changed logo URL is downloaded again and the version changes (browsers reload it)')
# the index written by publish carries the logo file
m._orig_gh_put_logo=put
m.gh_put(None,'data/index.json',json.dumps({'leagues':[{'id':'L1','name':'x'},{'id':'L2','name':'y'}]}).encode(),'Update index')
ix=store['data/index.json'];ok(ix['leagues'][0].get('logo_file')=='logos_L1.json' and 'logo_file' not in ix['leagues'][1],'data/index.json gets the logo file only for leagues that have logos')
print('FAILED' if fails else 'all passed')
# every league with stored logos is in the index from the first publish of a sync (not only after its turn)
m.LOGO_INDEX.clear();m._LOGO_MAN_READ.clear();store['data/logos_src.json']={'L1':{'src':{'A':'u1'}},'L9':{'src':{'B':'u2'}},'L8':{'src':{}}}
calls=[];m._orig_publish_logo=lambda hub,metas,final=False:calls.append(dict(m.LOGO_INDEX))
m._LOGO_REFS={};m.publish(None,[{'id':'L1'}])
ok(set(calls[0])=={'L1','L9'},'first publish of a sync already lists every league with stored logos ('+','.join(sorted(calls[0]))+')')
print('FAILED' if fails else 'all passed')
