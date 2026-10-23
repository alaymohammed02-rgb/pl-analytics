import json,re,sys
src,dst=sys.argv[1],sys.argv[2]
L=json.load(open(src))
comps={}
for m in L.values():
    if not m or 'c' not in m:continue
    k=re.sub(r'[^a-z0-9]+','-',(m['c']+' '+m['s']+(' w' if m['g']=='female' else '')).lower()).strip('-')
    C=comps.setdefault(k,{'k':k,'c':m['c'],'s':m['s'],'g':m['g'],'matches':[]})
    t={n:{'in':v['in'],'out':v['out']} for n,v in m['t'].items() if v.get('in') is not None or v.get('out') is not None}
    if t:C['matches'].append({'d':m['d'],'h':m['h'],'a':m['a'],'sc':m['sc'],'t':t})
out=[]
for C in comps.values():
    acc={}
    for m in C['matches']:
        for n,v in m['t'].items():
            a=acc.setdefault(n,{'m':0,'in':[],'out':[]});a['m']+=1
            if v['in'] is not None:a['in'].append(v['in'])
            if v['out'] is not None:a['out'].append(v['out'])
    mean=lambda x:round(sum(x)/len(x),2) if x else None
    C['teams']=sorted(({'n':n,'m':a['m'],'in':mean(a['in']),'out':mean(a['out'])} for n,a in acc.items()),key=lambda t:t['n'])
    C['n']=len(C['matches']);C['matches'].sort(key=lambda m:m['d'])
    if C['n']>=3:out.append(C)
out.sort(key=lambda C:(C['g']!='male',-int(C['s'][:4]),C['c']))
est=json.load(open(sys.argv[3])) if len(sys.argv)>3 else None
json.dump({'comps':out,'est':est,'val':{'matches':20,'mae':0.31,'max':1.06,'raw':5.9},
  'src':'StatsBomb Open Data (360), derived per-team averages only; correction trained on SkillCorner Open Data'},open(dst,'w'),ensure_ascii=False,separators=(',',':'))
print(len(out),sum(C['n'] for C in out));[print(C['k'],C['n'],len(C['teams'])) for C in out]
