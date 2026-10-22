/* ===== Match centre: scoreboard, xG race, momentum, lineups on the pitch, player ratings, share as image =====
   Added above the existing match page (its player table stays). All from PitchAPI, through files the site already has:
   - xG race: the shot file (data/<league>_sh.json); own goals count for the other side and have no xG; shoot-outs left out
   - momentum, lineups: data/<league>_mx.json (matches.momentum / matches.lineups), once the sync has fetched the match
   - ratings: data/<league>_rt.json (matches.players)
   Checked on the first 10 synced Premier League matches before drawing anything:
   - momentum: above zero = the home side on top (206 of the 263 shots taken in a minute with momentum came from the side the
     sign points to);
   - lineup pitch_x runs 0 → 1 from a team's own goal to the opponent's, pitch_y 0 → 1 from its left touchline to its right
     (left-backs ≈ 0.13, right-backs ≈ 0.88). Home is drawn on the left half attacking →, away on the right half attacking ←. */
(function(){
 if(typeof R!=='object'||typeof R.match!=='function')return;
 const HC='var(--th-hi)',AC='#e6e3dc';
 const f2=v=>v==null?'N/A':(+v).toFixed(2);
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const short=n=>{const w=String(n||'').split(/\s+/).filter(Boolean);if(w.length<2)return w[0]||'';const L=w[w.length-1],p=w[w.length-2];return /^(van|von|de|da|dos|del|der|di|le|la|ten|ter|el|al|ben)$/i.test(p)?p+' '+L:L};
 const lum=hex=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||'').trim());if(!m)return .2;const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
 const tmin=r=>r.mn+(r.ma?Math.min(.9,r.ma/10):0),mlab=r=>r.ma?`${Math.round(r.mn)}+${Math.round(r.ma)}'`:`${Math.round(r.mn)}'`;
 const MCS={};
 const om=R.match;
 R.match=async function(el,id){
  const out=await om.apply(this,arguments);
  const m=D&&D.matches&&D.matches.find(x=>x.match_id===id),h2=el&&el.querySelector('h2');
  if(!m||!h2||el.querySelector('#mc'))return out;
  const mu=h2.nextElementSibling&&h2.nextElementSibling.classList.contains('mu')?h2.nextElementSibling:h2;
  const box=document.createElement('div');box.id='mc';box.className='mc';box.innerHTML='<div class="empty skel">Loading…</div>';mu.after(box);
  const [S,X,RT,ph]=await Promise.all([loadSh().catch(()=>null),mxLoad(),rtLoad(),phLoad()]);
  if(!document.body.contains(box))return out;
  const C=mcData(m,S,X,RT);MCS[id]=C;
  box.innerHTML=mcScore(C)+mcRace(C)+mcMomentum(C)+mcLineups(C)+mcRatings(C);
  if(C.lu)[...el.querySelectorAll('h3')].filter(x=>/^Other tabs$/.test(x.textContent.trim())).forEach(x=>{const n=x.nextElementSibling;if(n&&n.classList.contains('empty'))n.remove();x.remove()});
  if(typeof shareWire==='function')shareWire(box,()=>mcShare(C));
  return out;
 };
 function mcData(m,S,X,RT){
  const C={m,home:m.home,away:m.away,sc:wkSc(m.score),shots:null,lu:null,mo:null,rt:null,link:new Map()};
  (D.stats||[]).filter(s=>s.match_id===m.match_id&&s.player_id).forEach(s=>C.link.set(s.player_id,{key:s.key,club:s.club,n:s.player}));
  if(S&&S.rows){const rows=S.rows.filter(r=>r.m===m.match_id&&r.pd!=='PenaltyShootout');
   /* the shot's team: by club name, or (some rows carry the team id instead) by the team id, learnt from rows that have the name or from the shooter's club */
   const tside=new Map(),nm=c=>c===m.home?'h':c===m.away?'a':null;
   rows.forEach(r=>{let s=nm(r.c);if(!s){const l=C.link.get(r.pid);s=l?nm(l.club):null;if(s&&r.og)s=null}if(s&&r.tid&&!r.og)tside.set(r.tid,s)});
   const sideOf=r=>{let s=nm(r.c)||tside.get(r.c)||tside.get(r.tid)||null;if(!s)return null;return r.og?(s==='h'?'a':'h'):s};
   const sh=rows.map(r=>({...r,t:tmin(r),side:sideOf(r)})).filter(r=>r.side);if(sh.length)C.shots=sh.sort((a,b)=>a.t-b.t)}
  const e=X&&X.m&&X.m[m.match_id];
  if(e&&e.lu&&(e.lu.h||e.lu.a))C.lu=e.lu;
  if(e&&e.mo&&e.mo.length)C.mo=e.mo;
  const r=RT&&RT.m&&RT.m[m.match_id];if(r&&Object.keys(r).length)C.rt=r;
  /* every rated player with his side, name and number, from the lineup when there is one, else from the stats */
  C.pl=[];
  if(C.lu)['h','a'].forEach(s=>{const L=C.lu[s];if(!L)return;(L.xi||[]).forEach(p=>C.pl.push({id:p[0],n:p[1],no:p[2],side:s,xi:1,x:p[4],y:p[5],cap:p[6],r:C.rt&&typeof C.rt[p[0]]==='number'?C.rt[p[0]]:null}));
   (L.sb||[]).forEach(p=>C.pl.push({id:p[0],n:p[1],no:p[2],side:s,xi:0,r:C.rt&&typeof C.rt[p[0]]==='number'?C.rt[p[0]]:null}))});
  /* rated players the lineup does not list (no lineup yet, one side missing, a late change): from the match's stats */
  if(C.rt){const seen=new Set(C.pl.map(p=>String(p.id)));Object.entries(C.rt).forEach(([id,v])=>{if(seen.has(id))return;const l=C.link.get(id);if(l&&(l.club===m.home||l.club===m.away))C.pl.push({id,n:l.n,side:l.club===m.home?'h':'a',xi:C.lu?0:1,r:v})})}
  const rated=C.pl.filter(p=>p.r!=null).sort((a,b)=>b.r-a.r);C.motm=rated[0]||null;
  if(C.shots){const xg=s=>C.shots.filter(r=>r.side===s&&!r.og).reduce((a,r)=>a+(r.xg||0),0);C.xg={h:xg('h'),a:xg('a')}}
  return C;
 }
 const plHref=(C,id)=>{const l=C.link.get(id);return l?'#/player/'+encodeURIComponent(l.key+'||'+l.club):null};
 /* ---------- scoreboard ---------- */
 function mcScore(C){
  const big=c=>{const s=logoOf(c);return s?`<img class="mc-cr" src="${s}" alt="" aria-hidden="true">`:`<span class="mc-cr mc-dot" style="${clubVars(c)}"></span>`};
  const mo=C.motm;
  return `<div class="card mc-score"><div class="mc-sb"><div class="mc-t">${big(C.home)}<a href="#/club/${encodeURIComponent(C.home)}">${esc(C.home)}</a></div>
   <div class="mc-res"><b>${C.sc?C.sc[0]+' – '+C.sc[1]:esc(C.m.score||'–')}</b>${C.xg?`<span class="mu">xG ${f2(C.xg.h)} – ${f2(C.xg.a)}</span>`:''}</div>
   <div class="mc-t">${big(C.away)}<a href="#/club/${encodeURIComponent(C.away)}">${esc(C.away)}</a></div></div>
   <div class="mc-foot">${mo?`<span class="mc-motm"><span>Player of the match</span> ${plHref(C,mo.id)?`<a href="${plHref(C,mo.id)}">${esc(mo.n)}</a>`:esc(mo.n)} <i style="background:${rc(mo.r)}">${mo.r.toFixed(1)}</i></span>`:'<span></span>'}${shareBtn('match')}</div></div>`;
 }
 /* ---------- xG race ---------- */
 function mcRace(C){
  if(!C.shots)return `<div class="card mc-race"><h3>xG race</h3><div class="empty">No shot data for this match.</div></div>`;
  const end=Math.max(90,...C.shots.map(r=>r.t))+1,mx=Math.max(.5,C.xg.h,C.xg.a)*1.12;
  const cum=(s,t)=>C.shots.filter(r=>r.side===s&&!r.og&&r.t<=t).reduce((a,r)=>a+(r.xg||0),0);
  /* drawn twice: a wide chart, and a narrower one with the same text size for phones (CSS shows one) */
  const svg=(W,H,cls)=>{const L=30,Rm=W>500?58:44,T=12,B=26,X=t=>L+t/end*(W-L-Rm),Y=v=>T+(1-v/mx)*(H-T-B);
   const path=s=>{let v=0,d=`M${X(0).toFixed(1)},${Y(0).toFixed(1)}`;C.shots.filter(r=>r.side===s&&!r.og).forEach(r=>{d+=`H${X(r.t).toFixed(1)}`;v+=r.xg||0;d+=`V${Y(v).toFixed(1)}`});return d+`H${X(end).toFixed(1)}`};
   const goals=C.shots.filter(r=>r.ev==='Goal'||r.og).map(r=>{const x=X(r.t),y=Y(cum(r.side,r.t));
    return `<g class="mc-g ${r.side}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"></circle><title>${esc(mlab(r))} ${esc(r.pn||'')}${r.og?' (own goal)':' · xG '+f2(r.xg)}</title></g>`}).join('');
   const ticks=[0,15,30,45,60,75,90].map(t=>`<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H-B}" class="mc-gr${t===45?' ht':''}"></line><text x="${X(t)}" y="${H-8}" class="mc-ax">${t}'</text>`).join('');
   const ys=[0,.5,1,1.5,2,2.5,3,3.5,4,5].filter(v=>v<=mx).map(v=>`<text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" class="mc-ax e">${v}</text>`).join('');
   const ly=[Y(C.xg.h),Y(C.xg.a)];if(Math.abs(ly[0]-ly[1])<14){if(C.xg.h>=C.xg.a){ly[0]-=7;ly[1]+=7}else{ly[0]+=7;ly[1]-=7}}
   return `<svg class="mc-ch ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="xG race">${ticks}${ys}<path d="${path('a')}" class="mc-ln" stroke="${AC}"></path><path d="${path('h')}" class="mc-ln" stroke="${HC}"></path>${goals}
    <text x="${W-Rm+6}" y="${(ly[0]+4).toFixed(1)}" class="mc-end" fill="${HC}">${f2(C.xg.h)}</text><text x="${W-Rm+6}" y="${(ly[1]+4).toFixed(1)}" class="mc-end" fill="${AC}">${f2(C.xg.a)}</text></svg>`};
  return `<div class="card mc-race"><h3>xG race</h3><div class="mc-leg"><span><i style="background:${HC}"></i>${esc(C.home)}</span><span><i style="background:${AC}"></i>${esc(C.away)}</span><span><b class="mc-gk"></b><span>Goal</span></span></div>
   ${svg(640,200,'w')}${svg(360,220,'n')}
   <p class="mu mc-note"><span>Each step is a shot: the line climbs by its xG (the chance a shot like it is scored).</span> <span>Own goals count for the other side and have no xG.</span></p></div>`;
 }
 /* ---------- momentum ---------- */
 function mcMomentum(C){
  if(!C.mo)return C.lu||C.rt?`<div class="card mc-mo"><h3>Momentum</h3><div class="empty">PitchAPI has no momentum for this match.</div></div>`:'';
  const end=Math.max(90,...C.mo.map(p=>p[0])),mx=Math.max(1,...C.mo.map(p=>Math.abs(p[1])));
  const svg=(W,H,cls)=>{const L=W>500?34:14,Rm=W>500?12:8,T=10,B=24,X=t=>L+t/end*(W-L-Rm),Y0=T+(H-T-B)/2,K=(H-T-B)/2/mx,bw=Math.max(1.2,(W-L-Rm)/C.mo.length*.8);
   const bars=C.mo.map(p=>{const v=p[1];if(!v)return '';const h=Math.abs(v)*K;return `<rect x="${(X(p[0])-bw/2).toFixed(1)}" y="${(v>0?Y0-h:Y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${v>0?HC:AC}" opacity=".85"><title>${Math.round(p[0])}' · ${v>0?esc(C.home):esc(C.away)} ${Math.abs(Math.round(v))}</title></rect>`}).join('');
   const goals=(C.shots||[]).filter(r=>r.ev==='Goal'||r.og).map(r=>{const x=X(Math.min(end,r.t)),up=r.side==='h';return `<g class="mc-g ${r.side}"><circle cx="${x.toFixed(1)}" cy="${(up?T+4:H-B-4).toFixed(1)}" r="4"></circle><title>${esc(mlab(r))} ${esc(r.pn||'')}${r.og?' (own goal)':''}</title></g>`}).join('');
   const ticks=[0,15,30,45,60,75,90].map(t=>`<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H-B}" class="mc-gr${t===45?' ht':''}"></line><text x="${X(t)}" y="${H-7}" class="mc-ax">${t}'</text>`).join('');
   return `<svg class="mc-ch ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Momentum">${ticks}<line x1="${L}" x2="${W-Rm}" y1="${Y0}" y2="${Y0}" class="mc-zero"></line>${bars}${goals}</svg>`};
  return `<div class="card mc-mo"><h3>Momentum</h3><div class="mc-leg"><span><i style="background:${HC}"></i>${esc(C.home)} <span class="mu">↑</span></span><span><i style="background:${AC}"></i>${esc(C.away)} <span class="mu">↓</span></span></div>
   ${svg(640,170,'w')}${svg(360,190,'n')}
   <p class="mu mc-note"><span>PitchAPI's momentum, minute by minute: above the line the home side is on top, below it the away side.</span> <span>Dots are goals.</span></p></div>`;
 }
 /* ---------- lineups ---------- */
 const PW=105,PH=68;
 function pitchLines(v){
  const w=v?PH:PW,h=v?PW:PH,R=(x,y,a,b)=>v?`<rect x="${y}" y="${x}" width="${b}" height="${a}"></rect>`:`<rect x="${x}" y="${y}" width="${a}" height="${b}"></rect>`;
  const box=(x0,len,wid)=>R(x0,(PH-wid)/2,len,wid);
  return `<g class="mc-pl">${R(0,0,PW,PH)}${v?`<line x1="0" x2="${PH}" y1="${PW/2}" y2="${PW/2}"></line>`:`<line x1="${PW/2}" x2="${PW/2}" y1="0" y2="${PH}"></line>`}<circle cx="${w/2}" cy="${h/2}" r="9.15"></circle>
   ${box(0,16.5,40.32)}${box(PW-16.5,16.5,40.32)}${box(0,5.5,18.32)}${box(PW-5.5,5.5,18.32)}</g>`;
 }
 function spot(C,p,v){
  /* pitch_x: own goal 0 → opponent 1; pitch_y: own left 0 → right 1 */
  const s=p.side,x=Math.max(.04,Math.min(.96,p.x)),y=Math.max(.04,Math.min(.96,p.y));
  let X=s==='h'?x*PW/2:PW-x*PW/2,Y=s==='h'?y*PH:(1-y)*PH;
  if(v)return [Y,PW-X];   /* vertical: the same pitch turned a quarter left, so home is at the bottom attacking ↑ with its left flank on the left */
  return [X,Y];
 }
 function marker(C,p,v){
  const [x,y]=spot(C,p,v),team=p.side==='h'?C.home:C.away,cc=typeof clubColors==='function'?clubColors(team):null,c1=cc?cc.c1:(p.side==='h'?'#4cc38a':'#e6e3dc'),c2=cc?cc.c2:'#0d1520';
  const fg=lum(c1)>.45?'#0d1520':'#fff',href=plHref(C,p.id),tip=`${p.n}${p.no?' · #'+p.no:''}${p.r!=null?' · rating '+p.r.toFixed(1):''}`;
  const body=`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.1" fill="${c1}" stroke="${c2}" stroke-width=".7"></circle><text x="${x.toFixed(2)}" y="${(y+1.05).toFixed(2)}" class="mc-no" fill="${fg}">${esc(p.no||'')}</text><title>${esc(tip)}</title>`;
  return {base:href?`<a href="${href}" class="mc-p">${body}</a>`:`<g class="mc-p">${body}</g>`,
   name:`<text x="${x.toFixed(2)}" y="${(y+6.1).toFixed(2)}" class="mc-nm">${esc(short(p.n))}</text>`,
   chip:(p.r!=null?`<rect x="${(x+1.6).toFixed(2)}" y="${(y-5.2).toFixed(2)}" width="5.6" height="2.9" rx=".8" fill="${rc(p.r)}"></rect><text x="${(x+4.4).toFixed(2)}" y="${(y-3.05).toFixed(2)}" class="mc-rt">${p.r.toFixed(1)}</text>`:'')+
    (p.cap?`<circle cx="${(x-3).toFixed(2)}" cy="${(y-3).toFixed(2)}" r="1.35" class="mc-cap"></circle><text x="${(x-3).toFixed(2)}" y="${(y-2.45).toFixed(2)}" class="mc-capt">C</text>`:'')};
 }
 function mcLineups(C){
  if(!C.lu)return C.mo||C.rt?`<div class="card mc-lu"><h3>Lineups</h3><div class="empty">PitchAPI has no lineup for this match yet.</div></div>`:'';
  const xi=C.pl.filter(p=>p.xi&&p.x!=null&&p.y!=null);
  const svg=v=>`<svg class="mc-pitch ${v?'v':'h'}" viewBox="${v?'-2 -2 72 109':'-2 -2 109 72'}" role="img" aria-label="Lineups"><rect x="-2" y="-2" width="${v?72:109}" height="${v?109:72}" class="mc-bg"></rect>${pitchLines(v)}${(M=>M.map(m=>m.base).join('')+'<g class="mc-lab">'+M.map(m=>m.name).join('')+M.map(m=>m.chip).join('')+'</g>')(xi.map(p=>marker(C,p,v)))}</svg>`;
  const side=s=>{const L=C.lu[s];if(!L)return '';const team=s==='h'?C.home:C.away,subs=C.pl.filter(p=>p.side===s&&!p.xi).sort((a,b)=>(b.r!=null)-(a.r!=null)||(b.r||0)-(a.r||0));
   return `<div class="mc-side"><div class="mc-sh">${hCrest(team)}<b>${esc(team)}</b>${L.f?`<span class="mc-f">${esc(L.f)}</span>`:''}</div>
    ${L.c?`<div class="mu mc-coach"><span>Coach</span>: <span class="mc-cn">${esc(L.c)}</span></div>`:''}${L.ok?'':'<div class="mc-pred">Predicted lineup (PitchAPI has not confirmed it)</div>'}
    ${subs.length?`<div class="mc-subs"><div class="mu">Substitutes</div><ul>${subs.map(p=>{const h=plHref(C,p.id);return `<li${p.r==null?' class="off"':''}><span class="mc-sn">${esc(p.no||'')}</span>${h?`<a href="${h}">${esc(p.n)}</a>`:`<span>${esc(p.n)}</span>`}${p.r!=null?`<i style="background:${rc(p.r)}">${p.r.toFixed(1)}</i>`:''}</li>`}).join('')}</ul></div>`:''}</div>`};
  return `<div class="card mc-lu"><h3>Lineups</h3><div class="mc-pw">${svg(false)}${svg(true)}</div><div class="mc-sides">${side('h')}${side('a')}</div>
   <p class="mu mc-note"><span>Positions as PitchAPI places the starting XI.</span>${C.rt?' <span>Coloured chips are PitchAPI match ratings (0–10).</span>':''} <span>Substitutes without a rating did not come on or were not rated.</span></p></div>`;
 }
 /* the lineup block for any two sides (the match preview uses it for the official lineups before kick-off) */
 window.mcLineupBlock=function(home,away,lu,link){
  const C={home,away,lu,rt:null,mo:null,link:link||new Map(),pl:[],m:{}};
  ['h','a'].forEach(s=>{const L=lu&&lu[s];if(!L)return;(L.xi||[]).forEach(p=>C.pl.push({id:p[0],n:p[1],no:p[2],side:s,xi:1,x:p[4],y:p[5],cap:p[6],r:null}));
   (L.sb||[]).forEach(p=>C.pl.push({id:p[0],n:p[1],no:p[2],side:s,xi:0,r:null}))});
  return mcLineups(C).replace('<h3>Lineups</h3>','<h3>Official lineups</h3>').replace(' <span>Substitutes without a rating did not come on or were not rated.</span>','');
 };
 /* ---------- ratings ---------- */
 function mcRatings(C){
  if(!C.rt)return C.lu||C.mo?`<div class="card mc-rts"><h3>Player ratings</h3><div class="empty">No PitchAPI ratings for this match yet.</div></div>`:'';
  const col=s=>{const team=s==='h'?C.home:C.away,L=C.pl.filter(p=>p.side===s&&p.r!=null).sort((a,b)=>b.r-a.r);
   return `<div><div class="mc-sh">${hCrest(team)}<b>${esc(team)}</b>${L.length?`<span class="mu">${(L.reduce((a,p)=>a+p.r,0)/L.length).toFixed(2)} <span>average</span></span>`:''}</div><ol class="mc-rl">${L.map(p=>{const h=plHref(C,p.id);
    return `<li${C.motm&&p.id===C.motm.id?' class="best"':''}><i style="background:${rc(p.r)}">${p.r.toFixed(1)}</i>${h?`<a href="${h}">${esc(p.n)}</a>`:`<span>${esc(p.n)}</span>`}${p.xi?'':'<span class="mu mc-in">sub</span>'}</li>`}).join('')}</ol></div>`};
  return `<div class="card mc-rts"><h3>Player ratings</h3><div class="mc-rc">${col('h')}${col('a')}</div><p class="mu mc-note"><span>PitchAPI's match ratings, on its 0–10 scale.</span></p></div>`;
 }
 /* ---------- share as image ---------- */
 async function mcShare(C){
  return shareCard({name:C.home+'-'+C.away+'-'+(C.m.date||'').slice(0,10),title:C.home+' – '+C.away,draw:async(ctx,U)=>{
   const X=U.PAD,tr=U.tr;
   U.text(D.name+' · '+(C.m.date||'').slice(0,10),U.W/2,96,{size:30,color:U.mu,align:'center'});
   await U.crest(C.home,X+70,140,190);await U.crest(C.away,U.W-X-260,140,190);
   U.text(C.home,X+165,385,{size:34,weight:700,align:'center',max:330});U.text(C.away,U.W-X-165,385,{size:34,weight:700,align:'center',max:330});
   U.text(C.sc?C.sc[0]+' – '+C.sc[1]:(C.m.score||''),U.W/2,280,{size:120,weight:800,align:'center'});
   if(C.xg)U.text('xG '+f2(C.xg.h)+' – '+f2(C.xg.a),U.W/2,345,{size:34,color:U.mu,align:'center'});
   let y=440;
   if(C.shots){U.text(tr('xG race'),X,y+20,{size:30,weight:700});const gx=X,gy=y+44,gw=U.W-2*X,gh=300,end=Math.max(90,...C.shots.map(r=>r.t))+1,mx=Math.max(.5,C.xg.h,C.xg.a)*1.12;
    U.rr(gx,gy,gw,gh,18,'rgba(255,255,255,.04)');const px=t=>gx+20+t/end*(gw-40),py=v=>gy+gh-20-v/mx*(gh-40);
    ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=2;[45].forEach(t=>{ctx.beginPath();ctx.moveTo(px(t),gy+14);ctx.lineTo(px(t),gy+gh-14);ctx.stroke()});
    [['h',U.hi],['a',AC]].forEach(([s,c])=>{let v=0;ctx.beginPath();ctx.moveTo(px(0),py(0));C.shots.filter(r=>r.side===s&&!r.og).forEach(r=>{ctx.lineTo(px(r.t),py(v));v+=r.xg||0;ctx.lineTo(px(r.t),py(v))});ctx.lineTo(px(end),py(v));ctx.strokeStyle=c;ctx.lineWidth=6;ctx.lineJoin='round';ctx.stroke()});
    C.shots.filter(r=>r.ev==='Goal'||r.og).forEach(r=>{const v=C.shots.filter(q=>q.side===r.side&&!q.og&&q.t<=r.t).reduce((a,q)=>a+(q.xg||0),0);ctx.beginPath();ctx.arc(px(r.t),py(v),12,0,7);ctx.fillStyle=r.side==='h'?U.hi:AC;ctx.fill();ctx.strokeStyle='#0d1520';ctx.lineWidth=4;ctx.stroke()});
    y=gy+gh+40}
   const top=C.pl.filter(p=>p.r!=null).sort((a,b)=>b.r-a.r).slice(0,3);
   if(top.length){U.text(tr('Top rated'),X,y+20,{size:30,weight:700});
    for(let i=0;i<top.length;i++){const p=top[i],yy=y+50+i*96,team=p.side==='h'?C.home:C.away;U.rr(X,yy,U.W-2*X,80,18,'rgba(255,255,255,.05)');
     await U.crest(team,X+18,yy+14,52);U.text(p.n,X+90,yy+52,{size:34,weight:700,max:U.W-2*X-300});U.badge(p.r.toFixed(1),U.W-X-18,yy+12,{size:34,h:56,min:100,align:'right',fill:rc(p.r)})}}
  }});
 }
 if(typeof AR==='object')Object.entries({
  "Player of the match":"أفضل لاعب في المباراة","xG race":"سباق xG","No shot data for this match.":"ما فيه بيانات تسديدات لهذي المباراة.","Goal":"هدف",
  "Each step is a shot: the line climbs by its xG (the chance a shot like it is scored).":"كل درجة تسديدة: الخط يرتفع بقيمة xG حقتها (احتمال إن تسديدة مثلها تصير هدف).",
  "Own goals count for the other side and have no xG.":"الأهداف العكسية تنحسب للفريق الثاني وما لها xG.",
  "Momentum":"زخم المباراة","PitchAPI has no momentum for this match.":"PitchAPI ما عنده زخم لهذي المباراة.",
  "PitchAPI's momentum, minute by minute: above the line the home side is on top, below it the away side.":"زخم المباراة من PitchAPI دقيقة بدقيقة: فوق الخط صاحب الأرض هو المسيطر، وتحته الضيف.",
  "Dots are goals.":"النقاط أهداف.","Lineups":"التشكيلات","PitchAPI has no lineup for this match yet.":"PitchAPI ما عنده تشكيلة لهذي المباراة للحين.",
  "Coach":"المدرب","Predicted lineup (PitchAPI has not confirmed it)":"تشكيلة متوقعة (PitchAPI ما أكدها)","Substitutes":"البدلاء",
  "Positions as PitchAPI places the starting XI.":"المراكز مثل ما يحطها PitchAPI للتشكيلة الأساسية.",
  "Coloured chips are PitchAPI match ratings (#–#).":"المربعات الملوّنة تقييمات PitchAPI للمباراة (#–#).",
  "Substitutes without a rating did not come on or were not rated.":"البديل اللي ما له تقييم ما نزل أو ما انقيّم.",
  "Player ratings":"تقييم اللاعبين","No PitchAPI ratings for this match yet.":"ما فيه تقييمات PitchAPI لهذي المباراة للحين.","average":"المتوسط","sub":"بديل",
  "PitchAPI's match ratings, on its #–# scale.":"تقييمات PitchAPI للمباراة على مقياسه من # إلى #.","Top rated":"الأعلى تقييمًا"," (own goal)":" (هدف عكسي)"
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
 /* the page may have been drawn before this file arrived: draw it again once */
 if(/^#\/match\//.test(location.hash)&&!document.getElementById('mc')&&document.querySelector('#app h2')&&typeof route==='function')route();
})();
