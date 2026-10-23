"""Which visibility rule makes the visible-only line match the true line? Tried on SkillCorner full tracking."""
import json,sys,statistics as st
def pip(x,y,P):
    c=False;n=len(P)
    for i in range(n):
        x1,y1=P[i];x2,y2=P[(i+1)%n]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1+1e-12)+x1:c=not c
    return c
res={}
for mid in sys.argv[1:]:
    M=json.load(open(f'sc/{mid}_match.json'));L=M['pitch_length'];W=M['pitch_width'];side=M['home_team_side']
    H,A=M['home_team']['id'],M['away_team']['id']
    team={p['id']:p['team_id'] for p in M['players']};gk={p['id'] for p in M['players'] if 'Goalkeeper' in str((p.get('player_role') or {}).get('name',''))}
    for i,line in enumerate(open(f'sc/{mid}.jsonl')):
        if i%10:continue
        f=json.loads(line);per=f.get('period');g=(f.get('possession') or {}).get('group')
        if per not in (1,2) or g not in ('home team','away team'):continue
        cam=f['image_corners_projection'];P=[(cam['x_'+k],cam['y_'+k]) for k in ('top_left','bottom_left','bottom_right','top_right')] if cam.get('x_top_left') is not None else None
        for t in (H,A):
            ltr=(side[per-1]=='left_to_right')==(t==H);dist=lambda x:(x+L/2) if ltr else (L/2-x);back=lambda d:(d-L/2) if ltr else (L/2-d)
            ps=[p for p in f['player_data'] if team.get(p['player_id'])==t and p['player_id'] not in gk and p['x'] is not None]
            if len(ps)<10:continue
            ph='in' if (g=='home team')==(t==H) else 'out';d=min(dist(p['x']) for p in ps)
            vis=[p for p in ps if p.get('is_detected')]
            rules={'any3':len(vis)>=3,'n9':len(vis)>=9,'n10':len(vis)>=10}
            if vis and P:
                dv=min(dist(p['x']) for p in vis);xb=back(max(0,dv-3))
                rules['width']=len(vis)>=3 and all(pip(xb,y,P) for y in (-W/2+6,-W/4,0,W/4,W/2-6))
            for k,okk in rules.items():
                if not okk:continue
                dv=min(dist(p['x']) for p in vis)
                r=res.setdefault((k,ph),{'err':[],'vis':[],'true':[]});r['err'].append(dv-d);r['vis'].append(dv);r['true'].append(d)
            r=res.setdefault(('TRUE',ph),{'err':[],'vis':[],'true':[]});r['true'].append(d)
for (k,ph),r in sorted(res.items()):
    if k=='TRUE':print(f"TRUE {ph:3}: mean line {st.mean(r['true']):5.1f} m over {len(r['true'])} team-seconds");continue
    print(f"{k:6} {ph:3}: frames {len(r['err']):6}  mean bias {st.mean(r['err']):+5.2f} m  mean |err| {st.mean(abs(e) for e in r['err']):4.2f}  method mean {st.mean(r['vis']):5.1f} vs true on those frames {st.mean(r['true']):5.1f}")
