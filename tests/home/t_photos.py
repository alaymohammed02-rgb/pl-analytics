import sys,importlib.util,json,copy,os
from types import SimpleNamespace as N
sys.path.insert(0,'../stub');os.environ['PITCHAPI_KEY']='SECRET'
spec=importlib.util.spec_from_file_location("m","/home/user/pl-analytics/sync.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
store={};puts=[];m.log=lambda *a:None;m.time.sleep=lambda s:None
m.gh_get_json=lambda hub,p:copy.deepcopy(store.get(p))
def put(hub,p,c,msg):store[p]=json.loads(c.decode());puts.append(p);return True
WRAP=m.gh_put
m.gh_put=put
m.PHOTO_PER_RUN=100   # the budget logic is tested at 100 (production uses more)
rows={'L1':[{'i':'p%d'%i,'mi':900-i*10} for i in range(80)],'L2':[{'i':'q%d'%i,'mi':500} for i in range(30)]+[{'i':'q_few','mi':100}]}
m.q=lambda sql,args=():rows[args[0]]
calls=[];reqs=[]
class C:
    def __init__(s):s.players=N(get=s.get)
    def get(s,pid):calls.append(pid);return N(image_url=None if pid=='p3' else 'https://cdn.pitchapi.dev/players/%s.webp'%pid,position_id=(int(pid[1:]) if pid[1:].isdigit() else 7)%4,country_code='ENG' if pid.endswith('0') else None)
class R:
    def __init__(s,code,ct):s.status_code=code;s.headers={'content-type':ct};s.content=b'x'*50
def get(url,headers=None,timeout=None):reqs.append((url,dict(headers or {})));return R(200,'image/webp')
m.requests=N(get=get)
m.sync_photos(C(),None,['L1','L2'])
f=store.get('data/photos_L1.json') or {}
ok(len(calls)==100 and calls[0]=='p0' and calls[79]=='p79' and calls[80]=='q0','at most 100 players a run, those with the most minutes first (%d)'%len(calls))
ok(len(f.get('p',{}))==79 and 'p3' in f.get('fail',{}),'photo links stored for every profile that has one; a player without a photo is recorded')
ok(len(f.get('q',{}))==80 and f['q']['p5']==1,'the position number is stored for every player fetched, photo or not')
ok(len(f.get('c',{}))==80 and f['c']['p10']=='ENG' and f['c']['p5']=='','the nationality code is stored as given (empty when the profile has none, so it is not asked again)')
ok(f.get('public') is True and all('X-API-KEY' not in h for u,h in reqs),'checked that photos open without a key (no key sent)')
ok(m.PHOTO_INDEX['L1']['photo_file']=='photos_L1.json' and store['data/photos_index.json']['L1']['photo_file']=='photos_L1.json','index entry and manifest written')
calls.clear();m.PHOTO_INDEX.clear();m._PHOTO_READ.clear();m.sync_photos(C(),None,['L1','L2'])
ok(set(calls)=={'q%d'%i for i in range(20,30)}|{'q_few'},'next run: the remaining players; positions are fetched even under 270 minutes (%d calls)'%len(calls))
ok('q_few' in store['data/photos_L2.json']['q'] and 'q_few' in store['data/photos_L2.json']['p'],'a player under 270 minutes gets his position (and the photo that came with it)')
ok(set(store['data/photos_index.json'])=={'L1','L2'},'both leagues kept in the manifest')
calls.clear();m.sync_photos(C(),None,['L1','L2']);ok(calls==[],'nothing new: no requests (a profile without a photo waits a week)')
ok(not any('SECRET' in json.dumps(v) for v in store.values()),'the key is never written')
# index: entries from the manifest from the first publish
m.PHOTO_INDEX.clear();m._PHOTO_READ.clear();got={}
m._orig_gh_put_photo=lambda hub,p,c,msg:got.update(json.loads(c.decode()))
WRAP(None,'data/index.json',json.dumps({'leagues':[{'id':'L1'},{'id':'L9'}]}).encode(),'x')
ok(got['leagues'][0].get('photo_file')=='photos_L1.json' and 'photo_file' not in got['leagues'][1],'data/index.json lists the photo file only for leagues with photos')
print('FAILED' if fails else 'all passed')
