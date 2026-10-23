"""Checks the StatsBomb-360 method on SkillCorner full tracking: the true line (every player, every second) against the same
method applied only to players the camera sees, with the camera's view covering the space behind the deepest one."""
import json,sys,statistics as st
mid=sys.argv[1];M=json.load(open(f'sc/{mid}_match.json'));L=M['pitch_length'];side=M['home_team_side']
H,A=M['home_team']['id'],M['away_team']['id'];name={H:M['home_team']['short_name'],A:M['away_team']['short_name']}
team={p['id']:p['team_id'] for p in M['players']};gk={p['id'] for p in M['players'] if 'Goalkeeper' in str((p.get('player_role') or {}).get('name',''))}
R={t:{'true':{'in':[],'out':[]},'vis':{'in':[],'out':[]},'truesel':{'in':[],'out':[]}} for t in (H,A)}
with open(sys.argv[2]) as fh:
    for i,line in enumerate(fh):
        if i%10:continue                                  # one frame a second
        f=json.loads(line);per=f.get('period');g=(f.get('possession') or {}).get('group')
        if per not in (1,2) or g not in ('home team','away team'):continue
        cam=f['image_corners_projection'];cx=[cam[k] for k in cam if k.startswith('x_') and cam[k] is not None]
        for t in (H,A):
            ltr=(side[per-1]=='left_to_right')==(t==H)          # this team attacks left to right
            dist=lambda x:(x+L/2) if ltr else (L/2-x)            # metres from its own goal line
            ps=[p for p in f['player_data'] if team.get(p['player_id'])==t and p['player_id'] not in gk and p['x'] is not None]
            if len(ps)<8:continue
            ph='in' if (g=='home team')==(t==H) else 'out'
            d=min(dist(p['x']) for p in ps);R[t]['true'][ph].append(d)
            vis=[p for p in ps if p.get('is_detected')]
            if len(vis)>=3 and cx:
                dv=min(dist(p['x']) for p in vis);cmin=min(dist(x) for x in cx)
                if cmin<=dv-3:R[t]['vis'][ph].append(dv);R[t]['truesel'][ph].append(d)
for t in (H,A):
    r=R[t];m=lambda a:st.mean(a) if a else float('nan')
    print(f"{name[t]:16} TRUE in {m(r['true']['in']):5.1f} out {m(r['true']['out']):5.1f} | VISIBLE-METHOD in {m(r['vis']['in']):5.1f} ({len(r['vis']['in'])}) out {m(r['vis']['out']):5.1f} ({len(r['vis']['out'])}) | true on same frames in {m(r['truesel']['in']):5.1f} out {m(r['truesel']['out']):5.1f}")
