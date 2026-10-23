"""Event-only features (no tracking, no 360) per team and match, for the matches with a known line height (sb_lines.json).
Same ideas as the site's PitchAPI numbers: adx (mean height of defensive actions, m from own goal), tilt (share of the
two teams' final-third passes), ppda, hto (ball wins within 40 m of the opponent goal), poss (share of passes), and the
mean height of the team's own passes. Raw StatsBomb files are not kept."""
import json,urllib.request,concurrent.futures as cf,time
B='https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/'
L=json.load(open('sb_lines.json'));SX=105/120
DEF={'Pressure','Interception','Ball Recovery','Block','Clearance','Foul Committed','Duel','Dribbled Past'}
def feats(mid):
    for k in range(4):
        try:E=json.load(urllib.request.urlopen(B+mid+'.json',timeout=120));break
        except Exception as e:
            if k==3:return mid,None
            time.sleep(2+3*k)
    teams=sorted({e['team']['name'] for e in E if 'team' in e});out={}
    for t in teams:
        o=[x for x in teams if x!=t][0]
        mine=[e for e in E if e.get('team',{}).get('name')==t and e.get('location')]
        opp=[e for e in E if e.get('team',{}).get('name')==o and e.get('location')]
        d=[e['location'][0]*SX for e in mine if e['type']['name'] in DEF]
        p=[e['location'][0]*SX for e in mine if e['type']['name']=='Pass']
        po=[e for e in opp if e['type']['name']=='Pass']
        ft=sum(1 for x in p if x>70);fto=sum(1 for e in po if e['location'][0]*SX>70)
        # PPDA: opponent passes in its own 60 % / our tackles, interceptions, fouls, duels there (x > 42 m from our goal)
        da=sum(1 for e in mine if e['type']['name'] in ('Interception','Foul Committed','Duel') and e['location'][0]*SX>42)
        op=sum(1 for e in po if e['location'][0]*SX<63)
        hto=sum(1 for e in mine if e['type']['name'] in ('Ball Recovery','Interception') and e['location'][0]*SX>65)
        out[t]={'adx':sum(d)/len(d) if d else None,'px':sum(p)/len(p) if p else None,'tilt':100*ft/(ft+fto) if ft+fto else None,
                'ppda':op/da if da else None,'hto':hto,'poss':100*len(p)/(len(p)+len(po)) if p or po else None}
    return mid,out
ids=[k for k,v in L.items() if v and 'c' in v];R={}
with cf.ThreadPoolExecutor(8) as ex:
    for i,(mid,f) in enumerate(ex.map(feats,ids)):
        R[mid]=f
        if i%50==0:print(i,flush=True)
json.dump(R,open('ev_feats.json','w'));print('done',sum(1 for v in R.values() if v),'of',len(ids))
