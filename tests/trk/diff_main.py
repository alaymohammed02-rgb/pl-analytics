import sys,importlib.util,json,copy
sys.path.insert(0,'stub')
spec=importlib.util.spec_from_file_location("m","/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/trk/sync_main.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
store={};m.gh_get_json=lambda h,p:copy.deepcopy(store.get(p));m._orig_gh_put_trk=lambda h,p,c,msg:store.__setitem__(p,json.loads(c.decode()));m.log=lambda *a:None
m._TRK_FPL=open('/home/user/pl-analytics/data/fpl.json','rb').read();m.sync_fpl_track(None)
r=store['data/fpl_track.json']['gws']['8'];s=json.load(open('trk/snap.json'))
for k in ('xi','cap','vice','bench','exp','p10','p90','preds','ver','kappa'):
    if r[k]!=s[k]:
        print('DIFF',k, (str(r[k])[:200], str(s[k])[:200]) if k!='preds' else [ (x,r[k].get(x),s[k].get(x)) for x in set(r[k])|set(s[k]) if r[k].get(x)!=s[k].get(x)][:8])
