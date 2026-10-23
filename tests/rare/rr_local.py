"""Runs the rare-cases engine on the local data files (the same shapes the sync's database holds)."""
import json, datetime, sys, re
sys.path.insert(0,'/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/fx')
import importlib.util as _iu
_sp=_iu.spec_from_file_location("fx_local","/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/fx/run_local.py");FX=_iu.module_from_spec(_sp);_sp.loader.exec_module(FX)
G=FX.G
_S=open('/home/user/pl-analytics/sync.py',encoding='utf-8').read();_a=_S.index('RR_PATH = ');_b=_S.index('# ======================== نهاية إضافة الحالات النادرة')
exec(_S[_a:_b],G)   # the section as it is in sync.py
D='/home/user/pl-analytics/data/'
def load():
    matches,shots,club,idx=FX.load();plrows=[];ratings={};rnames={};names={}
    for lg in idx['leagues']:
        l=lg['id'];names[l]=lg['name']
        P=json.load(open(D+lg['pl_file']));c=P['cols']
        for r in P['rows']:
            o=dict(zip(c,r));o['l']=l;plrows.append(o);rnames[(l,o['m'],o['i'])]=(o['n'],o['c'])
        L=json.load(open(D+lg['file']))
        for s in L['stats']:
            if s.get('i'):rnames.setdefault((l,s['m'],s['i']),(s['p'],s['c']))
        if lg.get('rt_file'):
            R=json.load(open(D+lg['rt_file']))
            for m,d in R['m'].items():
                for p,v in d.items():ratings[(l,m,p)]=v
    return matches,shots,club,plrows,ratings,rnames,names,idx
if __name__=='__main__':
    matches,shots,club,plrows,ratings,rnames,names,idx=load()
    now=datetime.datetime(2026,10,22,12,tzinfo=datetime.timezone.utc)
    out=G['rr_compute'](matches,shots,club,plrows,ratings,{k:v for k,v in rnames.items()},names,now)
    strip=lambda s:re.sub('<[^>]+>','',s)
    print('pools',out['pools'])
    for l,v in out['leagues'].items():
        print('==',names[l],len(v['rare']),'rare',len(v['near']),'near')
        for c in v['rare']+v['near']:print('  ',c['tier'],c['k'],'%d/%d'%(c['n'],c['N']),c['d'],strip(c['en']));print('      ',strip(c['ar']))
    json.dump(out,open('/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/rare/rare.json','w'),ensure_ascii=False,separators=(',',':'))
