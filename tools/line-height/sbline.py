"""Defensive line height from StatsBomb 360 freeze frames: the deepest outfield player of each team, in metres from its own goal line."""
import json,statistics as st,collections
SX=105/120   # StatsBomb pitch is 120 long; shown as metres of a 105 m pitch
def poly_xrange(v):
    xs=v[0::2];return min(xs),max(xs)
def match_lines(E,F,min_players=3,margin=3.0):
    ev={x['id']:x for x in E}
    out=collections.defaultdict(lambda:{'in':[],'out':[]})
    names=sorted({x['team']['name'] for x in E if 'team' in x})
    for f in F:
        e=ev.get(f['event_uuid'])
        if not e or 'team' not in e or 'possession_team' not in e:continue
        team=e['team']['name'];poss=e['possession_team']['name']
        opp=[n for n in names if n!=team][0] if len(names)==2 else None
        lo,hi=poly_xrange(f.get('visible_area') or [0,0])
        mates=[p['location'][0] for p in f['freeze_frame'] if p['teammate'] and not p['keeper']]
        opps=[p['location'][0] for p in f['freeze_frame'] if not p['teammate'] and not p['keeper']]
        # the event team defends the goal at x=0, the opponents the goal at x=120
        if len(mates)>=min_players:
            d=min(mates)
            if lo<=d-margin: out[team]['in' if poss==team else 'out'].append(d*SX)
        if opp and len(opps)>=min_players:
            d=max(opps)
            if hi>=d+margin: out[opp]['in' if poss==opp else 'out'].append((120-d)*SX)
    return out
if __name__=='__main__':
    import sys
    E=json.load(open(sys.argv[1]));F=json.load(open(sys.argv[2]))
    for t,v in match_lines(E,F).items():
        a,b=v['in'],v['out']
        print(f"{t:22} with ball {st.mean(a):5.1f} m ({len(a)} frames)  without {st.mean(b):5.1f} m ({len(b)})  both {(st.mean(a)+st.mean(b))/2:5.1f}")
