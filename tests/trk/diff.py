import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
import sys,importlib.util,json,copy
sys.path.insert(0,REPO+'/tests/stub')
spec=importlib.util.spec_from_file_location("m",REPO+'/sync.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
store={};m.gh_get_json=lambda h,p:copy.deepcopy(store.get(p));m._orig_gh_put_trk=lambda h,p,c,msg:store.__setitem__(p,json.loads(c.decode()));m.log=lambda *a:None
m._TRK_FPL=open(REPO+'/data/fpl.json','rb').read();m.sync_fpl_track(None)
r=store['data/fpl_track.json']['gws']['8'];s=json.load(open('trk/snap.json'))
for k in ('xi','cap','vice','bench','exp','p10','p90','preds','ver','kappa'):
    if r[k]!=s[k]:
        print('DIFF',k, (str(r[k])[:200], str(s[k])[:200]) if k!='preds' else [ (x,r[k].get(x),s[k].get(x)) for x in set(r[k])|set(s[k]) if r[k].get(x)!=s[k].get(x)][:8])
