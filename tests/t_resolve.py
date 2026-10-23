import sys,importlib.util,itertools
from types import SimpleNamespace as N
sys.path.insert(0,'stub')
spec=importlib.util.spec_from_file_location("m","/home/user/pl-analytics/sync.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
logs=[];m.log=lambda *a:logs.append(' '.join(map(str,a)))
fails=0
def ok(c,msg):
    global fails;print(('ok  ' if c else 'FAIL'),msg);fails+=0 if c else 1
T={'l_ecu':['Aucas','Barcelona','Emelec','LDU Quito','Independiente Valle'],'l_0ALvwF':['Juventus','Inter','AC Milan','Napoli','Roma','Lazio','Atalanta'],
   'l_bra':['Flamengo','Palmeiras','Corinthians']}
def L(i,n,c=None):return N(id=i,name=n,country=c)
base=[L('l_4WFCIZ','Premier League'),L('l_0ErfuF','LaLiga'),L('l_1Isor4','Bundesliga'),L('l_3zsMpo','Bundesliga'),L('l_3FJFUl','Ligue 1'),L('l_4QexZg','Liga Portugal'),L('l_0bfbkO','Champions League'),L('l_1XLtP0','World Cup')]
sa=[L('l_ecu','Serie A'),L('l_0ALvwF','Serie A'),L('l_bra','Serie A','Brazil')]
class C:
    def __init__(s,items):s.calls=0;s.leagues=N(list=lambda:N(leagues=items),matches=s.matches)
    def matches(s,lid,season=None,status=None):
        s.calls+=1;t=T.get(lid,['X','Y']);return N(matches=[N(home_team=N(name=a),away_team=N(name=b)) for a,b in zip(t,t[1:]+t[:1])])
for perm in itertools.permutations(sa):
    c=C(base+list(perm));r=m.resolve_leagues(c);ids=[x['id'] for x in r]
    ok('l_0ALvwF' in ids and 'l_ecu' not in ids and 'l_bra' not in ids,'order '+','.join(x.id for x in perm)+': Italian Serie A chosen ('+str(c.calls)+' list calls)')
ok(all(x in ids for x in ['l_4WFCIZ','l_0ErfuF','l_1Isor4','l_3FJFUl','l_4QexZg','l_0bfbkO','l_1XLtP0']) and 'l_3zsMpo' not in ids,'pinned leagues kept; the other "Bundesliga" never replaces the German one')
c=C(base+[L('l_ecu','Serie A')]);ids=[x['id'] for x in m.resolve_leagues(c)]
ok('l_ecu' not in ids,'only one league named Serie A and it is not the Italian one: skipped')
c=C(base+[L('l_ecu','Serie A'),L('l_x','Serie A')]);ids=[x['id'] for x in m.resolve_leagues(c)]
ok('l_ecu' not in ids and 'l_x' not in ids and any('تخطيته بدل ما أختار دوري غلط' in x for x in logs),'several Serie A but none Italian: skipped instead of picking a wrong one')
print('FAILED' if fails else 'all passed')
