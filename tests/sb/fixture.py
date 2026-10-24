"""A tiny hand-made match in StatsBomb Open Data's format (NOT StatsBomb data: made up here, so it can be kept in the repository).
Used by t_press.py (the offline builder) and ui_sb.js (the page). The numbers are worked out by hand in t_press.py."""
import json

def ev(i, t, poss, typ, team, pid=None, name=None, loc=None, cp=False, extra=None):
    h, rest = divmod(t, 3600); m, s = divmod(rest, 60)
    e = {"id": f"e{i}", "index": i, "period": 1, "timestamp": f"{h:02d}:{m:02d}:{s:06.3f}", "minute": m, "second": int(s),
         "type": {"id": 1, "name": typ}, "possession": 1, "possession_team": {"id": 1, "name": poss}, "team": {"id": 1, "name": team}}
    if pid:
        e["player"] = {"id": pid, "name": name}
    if loc:
        e["location"] = loc
    if cp:
        e["counterpress"] = True
    if extra:
        e.update(extra)
    return e

EVENTS = [
    ev(0, 0, "Alpha", "Pass", "Alpha", 1, "Alan Alpha One"),
    ev(1, 30, "Alpha", "Pass", "Alpha", 2, "Ben Alpha Two"),
    ev(2, 40, "Alpha", "Pressure", "Beta", 11, "Carl Beta One", [50, 10]),
    ev(3, 43, "Beta", "Pass", "Beta", 11, "Carl Beta One"),
    ev(4, 90, "Beta", "Ball Recovery", "Beta", 12, "Dan Beta Two"),
    ev(5, 100, "Beta", "Pressure", "Alpha", 1, "Alan Alpha One", [110, 40], cp=True),
    ev(6, 102, "Alpha", "Pass", "Alpha", 1, "Alan Alpha One"),
    ev(7, 150, "Alpha", "Interception", "Alpha", 2, "Ben Alpha Two", [60, 30]),
    ev(8, 160, "Alpha", "Half End", "Alpha"),
]
LINEUPS = [
    {"team_id": 1, "team_name": "Alpha", "lineup": [
        {"player_id": 1, "player_name": "Alan Alpha One", "player_nickname": "Ace", "jersey_number": 9,
         "positions": [{"position": "Center Forward", "from": "00:00", "to": None}]},
        {"player_id": 2, "player_name": "Ben Alpha Two", "player_nickname": None, "jersey_number": 4,
         "positions": [{"position": "Center Back", "from": "00:00", "to": "01:00"}]}]},
    {"team_id": 2, "team_name": "Beta", "lineup": [
        {"player_id": 11, "player_name": "Carl Beta One", "player_nickname": None, "jersey_number": 8,
         "positions": [{"position": "Center Midfield", "from": "00:00", "to": None}]},
        {"player_id": 12, "player_name": "Dan Beta Two", "player_nickname": "Dano", "jersey_number": 5,
         "positions": [{"position": "Left Back", "from": "00:00", "to": None}]}]},
]
MATCHES = [{"match_id": 1, "match_date": "2024-07-14", "home_score": 2, "away_score": 1,
            "competition": {"competition_id": 7, "competition_name": "Test Cup"}, "season": {"season_id": 3, "season_name": "2024"},
            "home_team": {"home_team_id": 1, "home_team_name": "Alpha"}, "away_team": {"away_team_id": 2, "away_team_name": "Beta"}}]
COMPETITIONS = [{"competition_id": 7, "season_id": 3, "competition_name": "Test Cup", "season_name": "2024", "competition_gender": "male"}]

if __name__ == "__main__":
    print(json.dumps({"events": EVENTS, "lineups": LINEUPS, "matches": MATCHES, "competitions": COMPETITIONS}))
