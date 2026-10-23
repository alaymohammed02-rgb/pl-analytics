import json,sys,os,glob,numpy as np
sys.path.insert(0,'.');from dlfeat import feats
rows=[]
for fn in sorted(glob.glob('sc/*_match.json')):
    mid=os.path.basename(fn).split('_')[0];M=json.load(open(fn));L=M['pitch_length'];W=M['pitch_width'];side=M['home_team_side']
    sx,sy=105/L,68/W;H,A=M['home_team']['id'],M['away_team']['id']
    team={p['id']:p['team_id'] for p in M['players']};gk={p['id'] for p in M['players'] if 'Goalkeeper' in str((p.get('player_role') or {}).get('name',''))}
    for i,line in enumerate(open(f'sc/{mid}.jsonl')):
        if i%10:continue
        f=json.loads(line);per=f.get('period');g=(f.get('possession') or {}).get('group')
        if per not in (1,2) or g not in ('home team','away team'):continue
        cam=f['image_corners_projection']
        if cam.get('x_top_left') is None:continue
        cx=[cam['x_'+k] for k in ('top_left','bottom_left','bottom_right','top_right')];cy=[cam['y_'+k] for k in ('top_left','bottom_left','bottom_right','top_right')]
        b=f['ball_data'];
        for t in (H,A):
            ltr=(side[per-1]=='left_to_right')==(t==H);dist=lambda x:((x+L/2) if ltr else (L/2-x))*sx
            ps=[p for p in f['player_data'] if team.get(p['player_id'])==t and p['player_id'] not in gk and p['x'] is not None]
            if len(ps)<10:continue
            vis=[p for p in ps if p.get('is_detected')]
            ph='in' if (g=='home team')==(t==H) else 'out'
            x=feats([dist(p['x']) for p in vis],[p['y']*sy for p in vis],[max(-20,min(125,dist(v))) for v in cx],[v*sy for v in cy],dist(b['x']) if b.get('x') is not None else None,ph)
            if x is None:continue
            rows.append([int(mid),t,ph=='in']+x+[min(dist(p['x']) for p in ps)])
np.save('sc_rows.npy',np.array(rows,dtype=float));print(len(rows),'team-frames from',len(glob.glob('sc/*_match.json')),'matches')
