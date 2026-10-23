"""Features of one team in one frame, from what a broadcast camera shows (same for SkillCorner and StatsBomb 360):
the visible outfield players of the team, the camera's view on the pitch, and the ball. All distances in metres from the team's
own goal line on a 105 × 68 pitch. The target (SkillCorner only) is the true deepest outfield player."""
FEAT=['dv','dv2','nvis','mean','cmin','cmax','cyw','bx','ph']
def feats(vis_d,vis_y,cam_d,cam_y,ball_d,phase):
    if len(vis_d)<3 or not cam_d:return None
    s=sorted(vis_d)
    return [s[0],s[1],len(vis_d),sum(vis_d)/len(vis_d),min(cam_d),max(cam_d),max(cam_y)-min(cam_y),ball_d if ball_d is not None else -1,1 if phase=='in' else 0]
