import os as _os; REPO=_os.environ.get('PLREPO') or _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'..','..'))
"""Runs the facts engine on the local data files (the same shapes the sync's database holds)."""
import json, datetime, sys, re
D=REPO+'/data/'
def load():
    idx=json.load(open(D+'index.json'));matches=[];shots=[];club={}
    for lg in idx['leagues']:
        l=lg['id'];L=json.load(open(D+lg['file']))
        for m in L['matches']:matches.append(dict(l=l,m=m['i'],d=m.get('d'),h=m['h'],a=m['a'],s=m.get('s')))
        for s in L['stats']:
            if s.get('i'):club[(l,s['m'],s['i'])]=s['c']
        if lg.get('sh_file'):
            S=json.load(open(D+lg['sh_file']));c=S['cols']
            for r in S['rows']:
                o=dict(zip(c,r));o['l']=l;shots.append(o)
    return matches,shots,club,idx
G={'datetime':datetime,'json':json,'q':None,'log':print,'gh_get_json':None,'gh_put':lambda *a:None,'run_pipeline':lambda *a:None,'LV_HAVE':{}}
exec(open(REPO+'/tests/fx/section.py',encoding='utf-8').read(),G)
if __name__=='__main__':
    matches,shots,club,idx=load()
    now=datetime.datetime(2026,10,22,12,tzinfo=datetime.timezone.utc)
    out=G['fx_compute'](matches,shots,club,now)
    strip=lambda s:re.sub('<[^>]+>','',s)
    print('week',out['wk'],out['n'],'teams with facts',len(out['teams']),'size KB',len(json.dumps(out,ensure_ascii=False))//1024)
    for f in out['week']:print(' -',f['k'],f['l'],'p=%.4f'%f['p'],strip(f['en']),'|',f['er']);print('   ',strip(f['ar']))
    for key in list(out['teams'])[:0]+[k for k in out['teams'] if k.split('|')[1] in ('Real Madrid','Chelsea','Barcelona')]:
        print('TEAM',key);[print('   ',f['k'],'p=%.4f'%f['p'],strip(f['en']),'|',f['er']) for f in out['teams'][key]]
    json.dump(out,open(_os.path.join(__import__('tempfile').gettempdir(),'facts.json'),'w'),ensure_ascii=False,separators=(',',':'))
