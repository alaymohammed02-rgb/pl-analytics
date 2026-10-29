/* ===== Player page: a profile card, form, season heat map, radar against the same position, and share as image =====
   Added above the existing player page (its charts and match table stay as they were). Everything comes from files the site
   already has, all from PitchAPI:
   - photo, nationality code: data/photos_<league>.json (players.get); shown only when PitchAPI has them
   - position, minutes, goals, xG, xAG and the radar measures: the per-match player file (loadPl, the same one the Comparison Lab uses)
   - match ratings: data/<league>_rt.json (matches.players); the form row uses them when the sync has fetched them, else xG + xAG
   - heat map: the sum of the player's match heat maps (PitchAPI gives no season heat map), each already turned so he attacks →
   Radar: percentile among players of the same position with at least PP_MIN minutes (all outfield players if the position is
   not known yet). A goalkeeper gets no radar: these are outfield measures. */
(function(){
 if(typeof R!=='object'||typeof R.player!=='function')return;
 const PP_MIN=450;
 const RADAR={FW:['npxg','sh','xag','sca','cb','duw'],MF:['xag','kp','pr','pc','tk','ic'],DF:['tk','ic','bl','cl','aerw','pr'],'':['xg','xag','sca','pr','tk','ic']};
 const f2=v=>v==null?'N/A':(+v).toFixed(2),f1=v=>v==null?'N/A':(+v).toFixed(1),n0=v=>v==null?'N/A':String(Math.round(v));
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const PPS={};
 const op=R.player;
 R.player=async function(el,arg){
  await op.apply(this,arguments);
  const [key,club]=decodeURIComponent(arg||'').split('||');
  /* the page wears his club's colours, as a club's own page does (the next page's route() puts the league's colours back) */
  if(club&&el.isConnected&&typeof applyTheme==='function'){try{if(typeof crestFor==='function')await crestFor(club);if(el.isConnected&&/^#\/player\//.test(location.hash))applyTheme(club)}catch(e){}}
  const st=(D.stats||[]).filter(s=>s.key===key&&s.club===club),pid=(st.find(s=>s.player_id)||{}).player_id;
  const h2=el.querySelector('h2');if(!pid||!h2)return;
  const mu=h2.nextElementSibling&&h2.nextElementSibling.classList.contains('mu')?h2.nextElementSibling:h2;
  const box=document.createElement('div');box.id='pp';box.className='pp';box.innerHTML='<div class="empty skel">Loading…</div>';
  (mu.nextElementSibling&&mu.nextElementSibling.querySelector&&mu.nextElementSibling.querySelector('.champ')?mu.nextElementSibling:mu).after(box);
  const [P,H,rt,ph]=await Promise.all([loadPl().catch(()=>null),loadHeat().catch(()=>null),rtLoad(),phLoad()]);
  if(!document.body.contains(box))return;
  const S=ppData(pid,club,P,H,rt,ph);PPS[pid]=S;
  if(!S.a&&!S.heat&&!S.form.length){box.remove();return}
  box.innerHTML=ppHead(S)+ppForm(S)+`<div class="pp-two">${ppHeat(S)}${ppRadar(S)}</div>`;
  /* the old "not available yet" line no longer holds for the heat map and radar */
  [...el.querySelectorAll('h3')].filter(x=>/^Other sections$/.test(x.textContent.trim())).forEach(x=>{const n=x.nextElementSibling;if(n&&n.classList.contains('empty'))n.remove();x.remove()});
  if(typeof shareWire==='function')shareWire(box,()=>ppShare(S));
 };
 function ppData(pid,club,P,H,rt,ph){
  const S={pid,club,name:'',a:null,peers:[],form:[],heat:null,rt:null,nat:'',photo:false};
  const mm=new Map(D.matches.map(m=>[m.match_id,m]));
  if(P&&P.rows){
   const all=aggPl(P);S.a=all.find(x=>x.id===pid)||null;
   if(S.a){S.name=S.a.n;const pos=S.a.p||'';S.peers=all.filter(x=>x.s.mi>=PP_MIN&&x.id!==pid&&x.p!=='GK'&&(pos&&pos!=='GK'?x.p===pos:true))}
   const ix=P.ix;
   S.games=P.rows.filter(r=>r[ix.i]===pid&&r[ix.mi]!=null).map(r=>({m:r[ix.m],mi:r[ix.mi],c:r[ix.c],gl:r[ix.gl],ast:r[ix.ast],xg:r[ix.xg],xag:r[ix.xag],sh:r[ix.sh]}));
  }
  if(!S.games||!S.games.length)S.games=(D.stats||[]).filter(s=>s.player_id===pid).map(s=>({m:s.match_id,mi:s.minutes,c:s.club,xg:s.xg}));
  if(!S.name){const s=(D.stats||[]).find(s=>s.player_id===pid);S.name=s?s.player:''}
  /* ratings: every match he has one for, then the last 10 matches he played */
  const rs=S.games.map(g=>rtOf(rt,g.m,pid)).filter(v=>v!=null);
  S.rt=rs.length?{avg:rs.reduce((a,b)=>a+b,0)/rs.length,n:rs.length}:null;
  S.hasRt=!!(rt&&rt.m&&Object.keys(rt.m).length);
  S.form=S.games.map(g=>{const m=mm.get(g.m);if(!m)return null;const home=m.home===g.c;return {...g,d:m.date.slice(0,10),home,opp:home?m.away:m.home,score:m.score,r:rtOf(rt,g.m,pid),mt:m}})
   .filter(Boolean).sort((x,y)=>x.d.localeCompare(y.d)).slice(-10);
  if(H&&H.rows){const rows=H.rows.filter(r=>r.t==='p'&&r.k===pid);if(rows.length){const c=heatCells(rows,H.grid.l,H.grid.w);if(c.max>0)S.heat={c,GL:H.grid.l,GW:H.grid.w,n:new Set(rows.map(r=>r.m)).size}}}
  S.nat=ph&&ph.c&&ph.c[pid]||'';S.photo=!!(ph&&ph.public&&ph.p&&ph.p[pid]);
  return S;
 }
 function ppHead(S){
  const a=S.a,pos=a&&a.p?POS_LONG[a.p]||a.p:null;
  const k=[['Matches',a?a.games:S.games.length],['Minutes',a?Math.round(a.s.mi):null],['Goals',a&&a.has('gl')?a.s.gl:null],['Assists',a&&a.has('ast')?a.s.ast:null],
   ['xG',a&&a.has('xg')?f2(a.s.xg):null],['xAG',a&&a.has('xag')?f2(a.s.xag):null]];
  return `<div class="card pp-head" style="${clubVars(S.club)}">
   <div class="pp-id">${hAvatar(S.pid,S.name,S.club,true)}<div class="pp-nm"><div class="pp-meta">${hCrest(S.club)}<span>${esc(S.club)}</span>${pos?`<span class="pp-dot">·</span><span>${esc(pos)}</span>`:''}${S.nat?`<span class="pp-dot">·</span><span class="pp-nat" title="Nationality (PitchAPI code)">${esc(S.nat)}</span>`:''}</div>
   ${shareBtn('player')}</div>
   ${S.rt?`<div class="pp-rt" style="--rc:${rc(S.rt.avg)}" title="Average PitchAPI match rating"><b>${S.rt.avg.toFixed(2)}</b><span>Average rating</span><span class="mu">${S.rt.n===1?'1 match':S.rt.n+' matches'}</span></div>`:''}</div>
   <div class="pp-k">${k.map(([l,v])=>`<div><span>${l}</span><b>${v==null?'N/A':esc(String(v))}</b></div>`).join('')}</div>
   ${!S.rt&&S.hasRt?'<p class="mu pp-note">No PitchAPI rating for this player yet.</p>':''}</div>`;
 }
 /* last 10 matches: PitchAPI's rating on top (when the sync has it), xG + xAG as a bar, the opponent's crest under it */
 function ppForm(S){
  const F=S.form;if(!F.length)return '';
  const anyR=F.some(g=>g.r!=null),v=g=>(g.xg==null&&g.xag==null)?null:(g.xg||0)+(g.xag||0),mx=Math.max(.3,...F.map(g=>v(g)||0));
  const col=g=>{const x=v(g),tip=`${g.d} · ${g.mt.home} ${g.score} ${g.mt.away} · ${Math.round(g.mi||0)} min`+(g.r!=null?` · rating ${g.r.toFixed(1)}`:'')+(g.xg!=null?` · xG ${f2(g.xg)}`:'')+(g.xag!=null?` · xAG ${f2(g.xag)}`:'');
   return `<a class="pp-fc" href="#/match/${encodeURIComponent(g.m)}" title="${esc(tip)}">${anyR?(g.r!=null?`<i class="pp-rc" style="background:${rc(g.r)}">${g.r.toFixed(1)}</i>`:'<i class="pp-rc na">–</i>'):''}
    <span class="pp-bw"><span class="pp-b" style="height:${x==null?0:Math.max(2,Math.round(x/mx*100))}%"></span></span><span class="pp-bv">${x==null?'–':f2(x)}</span>
    ${hCrest(g.opp)}<span class="pp-ha">${g.home?'H':'A'}</span></a>`};
  return `<div class="card pp-form"><h3>Last ${F.length} matches</h3>
   <div class="pp-fr" style="grid-template-columns:repeat(${F.length},minmax(0,1fr))">${F.map(col).join('')}</div>
   <p class="mu pp-note">${anyR?'<span>Top: PitchAPI match rating (0–10); a dash = not rated yet.</span> ':''}<span>Bars: xG + xAG in the match.</span> <span>H = home, A = away.</span></p></div>`;
 }
 function ppHeat(S){
  if(!S.heat)return `<div class="card pp-heat"><h3>Season heat map</h3><div class="empty">No heat map for this player in PitchAPI's data yet.</div></div>`;
  const h=S.heat;
  return `<div class="card pp-heat"><h3>Season heat map <span class="mu">· <span>${h.n===1?'1 match':h.n+' matches'}</span></span></h3>${heatLegend(h.c.max)}${heatSvg(h.c,h.GL,h.GW,h.c.max,'r',flipOn())}
   <p class="mu pp-note"><span>The sum of his match heat maps (PitchAPI gives no season heat map), each turned so he attacks →.</span> <span>${h.c.total} actions.</span></p></div>`;
 }
 function pct(peers,M,v){if(v==null)return null;let lo=0,eq=0,t=0;peers.forEach(q=>{const x=M[3](q,{});if(x==null)return;t++;if(x<v)lo++;else if(x===v)eq++});return t?(lo+eq/2)/t*100:null}
 function ppRadar(S){
  const a=S.a;
  if(!a)return '';
  if(a.p==='GK')return `<div class="card pp-rad"><h3>Radar</h3><div class="empty">No radar for goalkeepers: these are outfield measures.</div></div>`;
  if(a.s.mi<PP_MIN)return `<div class="card pp-rad"><h3>Radar</h3><div class="empty">Radar from ${PP_MIN} minutes: ${Math.round(a.s.mi)} so far.</div></div>`;
  const keys=RADAR[a.p||'']||RADAR[''],ms=keys.map(k=>(typeof MET!=='undefined'?MET:[]).find(m=>m[0]===k)).filter(Boolean);
  if(ms.length<3||S.peers.length<5)return '';
  const vals=ms.map(M=>{const v=M[3](a,{});return {M,v,p:pct(S.peers,M,v)}});
  const n=vals.length,cx=130,cy=112,Rr=80,P=(i,r)=>{const g=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(g)*r,cy+Math.sin(g)*r]},fp=p=>p.map(x=>x.toFixed(1)).join(',');
  const lab=s=>s;
  const svg=`<svg viewBox="-40 0 340 228" role="img" aria-label="Radar">${[25,50,75,100].map(r=>`<polygon class="rg" points="${vals.map((m,i)=>fp(P(i,Rr*r/100))).join(' ')}"></polygon>`).join('')}
   ${vals.map((m,i)=>`<line class="rg" x1="${cx}" y1="${cy}" x2="${fp(P(i,Rr)).split(',')[0]}" y2="${fp(P(i,Rr)).split(',')[1]}"></line>`).join('')}
   <polygon class="ra" points="${vals.map((m,i)=>fp(P(i,Rr*(m.p||0)/100))).join(' ')}"></polygon>
   ${vals.map((m,i)=>{const [x,y]=P(i,Rr*(m.p||0)/100);return `<circle class="a" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"><title>${esc(lab(m.M[1]))}: ${m.v==null?'N/A':f2(m.v)} per 90 · ${m.p==null?'N/A':Math.round(m.p)} percentile</title></circle>`}).join('')}
   ${vals.map((m,i)=>{const [x,y]=P(i,Rr+16),an=Math.abs(x-cx)<8?'middle':x<cx?'end':'start';return `<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="${an}">${esc(lab(m.M[1]))}</text>`}).join('')}</svg>`;
  const grp=a.p?(POS_LONG[a.p]||a.p)+'s':'outfield players';
  return `<div class="card pp-rad"><h3>Radar <span class="mu">· <span>${esc(grp)}</span> · <span>${PP_MIN}+ minutes</span></span></h3><div class="hrad pp-hrad">${svg}</div>
   <ul class="pp-pl">${vals.map(m=>`<li><span>${esc(lab(m.M[1]))}</span><b>${m.v==null?'N/A':f2(m.v)}</b><span class="pp-pb"><i style="width:${m.p==null?0:Math.round(m.p)}%"></i></span><span class="mu">${m.p==null?'N/A':Math.round(m.p)}</span></li>`).join('')}</ul>
   <p class="mu pp-note"><span>Per 90 minutes.</span> <span>The number is the percentile among ${S.peers.length} ${esc(grp.toLowerCase())} with ${PP_MIN}+ minutes in this league (50 = middle, 100 = the best).</span>${a.p?'':' <span>His position is not known yet, so the comparison is with all outfield players.</span>'}</p></div>`;
 }
 /* ---------- share as image ---------- */
 async function ppShare(S){
  return shareCard({name:S.name+'-'+(S.club||''),title:S.name,draw:async(ctx,U)=>{
   const a=S.a,X=U.PAD,tr=U.tr,rtl=U.rtl;
   await U.avatar(S.pid,S.name,S.club,X+120,250,120);
   const tx=X+280;U.text(S.name,tx,200,{size:62,weight:800,max:U.W-tx-(S.rt?260:X),fit:40});
   await U.crest(S.club,tx,232,48);U.text(S.club,tx+60,268,{size:34,color:U.tx,max:U.W-tx-60-(S.rt?260:X)});
   const pos=a&&a.p?tr(POS_LONG[a.p]||a.p):'';U.text([pos,S.nat].filter(Boolean).join(' · '),tx,322,{size:30,color:U.mu});
   if(S.rt){U.badge(S.rt.avg.toFixed(2),U.W-X,150,{size:60,h:96,min:190,align:'right',fill:rc(S.rt.avg)});U.text(tr('Average rating'),U.W-X-95,282,{size:24,color:U.mu,align:'center'});U.text(S.rt.n+' '+tr(S.rt.n===1?'match':'matches'),U.W-X-95,314,{size:22,color:U.mu,align:'center'})}
   /* key numbers */
   const k=[['Matches',a?a.games:S.games.length],['Minutes',a?Math.round(a.s.mi):null],['Goals',a&&a.has('gl')?a.s.gl:null],['Assists',a&&a.has('ast')?a.s.ast:null],['xG',a&&a.has('xg')?f2(a.s.xg):null],['xAG',a&&a.has('xag')?f2(a.s.xag):null]];
   const gw=(U.W-2*X-2*24)/3;k.forEach(([l,v],i)=>{const x=X+(i%3)*(gw+24),y=400+Math.floor(i/3)*134;U.rr(x,y,gw,112,20,'rgba(255,255,255,.05)');U.text(tr(l),x+24,y+42,{size:26,color:U.mu});U.text(v==null?'N/A':String(v),x+24,y+94,{size:48,weight:800})});
   /* form */
   const F=S.form.slice(-10);let y0=700;
   if(F.length){const useR=F.some(g=>g.r!=null);U.text(tr('Last '+F.length+' matches')+(useR?' · '+tr('Rating'):' · xG + xAG'),X,y0,{size:30,weight:700});
    const cw=(U.W-2*X)/10;for(let i=0;i<F.length;i++){const g=F[i],x=X+i*cw+cw/2,v=useR?g.r:(g.xg||0)+(g.xag||0);
     await U.crest(g.opp,x-22,y0+24,44);
     if(v!=null)U.badge(useR?v.toFixed(1):f2(v),x,y0+82,{size:28,h:46,min:76,align:'center',fill:useR?rc(v):'rgba(255,255,255,.14)',color:useR?'#0d1520':U.tx});
     else U.text('–',x,y0+114,{size:28,color:U.mu,align:'center'})}
    y0+=170}
   /* heat map */
   const im=document.querySelector('#pp .pp-heat image.heat-smooth');
   if(S.heat){U.text(tr('Season heat map')+' · '+S.heat.n+' '+tr(S.heat.n===1?'match':'matches'),X,y0+10,{size:30,weight:700});
    const ph=U.H-96-40-(y0+34),pw=Math.min(U.W-2*X,ph*105/68),px=(U.W-pw)/2,py=y0+34,s=pw/105;
    U.rr(px-6,py-6,pw+12,68*s+12,14,'#2b2f35');
    if(im){const src=im.getAttribute('href')||im.getAttribute('xlink:href');const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
     if(img){const x0=+im.getAttribute('x')||0,y1=+im.getAttribute('y')||0,w=+im.getAttribute('width')||105,h=+im.getAttribute('height')||68;ctx.drawImage(img,px+x0*s,py+y1*s,w*s,h*s)}}  /* left/right flip is already in the picture */
    ctx.strokeStyle='rgba(232,238,245,.55)';ctx.lineWidth=3;ctx.strokeRect(px,py,105*s,68*s);ctx.beginPath();ctx.moveTo(px+52.5*s,py);ctx.lineTo(px+52.5*s,py+68*s);ctx.stroke();
    ctx.beginPath();ctx.arc(px+52.5*s,py+34*s,9.15*s,0,7);ctx.stroke();ctx.strokeRect(px,py+13.84*s,16.5*s,40.32*s);ctx.strokeRect(px+(105-16.5)*s,py+13.84*s,16.5*s,40.32*s);
    U.text(U.rtl?'اتجاه الهجوم →':'Attack direction →',U.W/2,py+68*s+32,{size:22,color:U.mu,align:'center'})}
  }});
 }
 if(typeof AR==='object')Object.entries({
  "Average rating":"متوسط التقييم","# match":"# مباراة","# matches":"# مباريات","match":"مباراة","matches":"مباريات",
  "Nationality (PitchAPI code)":"الجنسية (رمز PitchAPI)","Average PitchAPI match rating":"متوسط تقييم PitchAPI للمباريات",
  "No PitchAPI rating for this player yet.":"ما فيه تقييم من PitchAPI لهذا اللاعب للحين.",
  "Last # matches":"آخر # مباريات","Rating":"التقييم","Top: PitchAPI match rating (#–#); a dash = not rated yet.":"فوق: تقييم PitchAPI للمباراة (#–#)؛ الشرطة = ما انقيّم للحين.",
  "Bars: xG + xAG in the match.":"الأعمدة: xG + xAG في المباراة.","H = home, A = away.":"H = على أرضه، A = خارج أرضه.","Season heat map":"خريطة الحرارة للموسم",
  "No heat map for this player in PitchAPI's data yet.":"ما فيه خريطة حرارة لهذا اللاعب في بيانات PitchAPI للحين.",
  "The sum of his match heat maps (PitchAPI gives no season heat map), each turned so he attacks →.":"مجموع خرائط الحرارة لمبارياته (PitchAPI ما يعطي خريطة للموسم)، وكل وحدة مقلوبة بحيث يهاجم →.",
  "# actions.":"# لمسة.","Radar":"الرادار","No radar for goalkeepers: these are outfield measures.":"ما فيه رادار للحراس: هذي مقاييس لاعبي الميدان.",
  "Radar from # minutes: # so far.":"الرادار يظهر من # دقيقة: لعب # للحين.","Defenders":"المدافعين","Midfielders":"لاعبي الوسط","Forwards":"المهاجمين","outfield players":"لاعبي الميدان",
  "#+ minutes":"#+ دقيقة","Per # minutes.":"لكل # دقيقة.",
  "The number is the percentile among # defenders with #+ minutes in this league (# = middle, # = the best).":"الرقم هو ترتيبه المئوي بين # مدافع لعبوا #+ دقيقة في هذا الدوري (# = المنتصف، # = الأفضل).",
  "The number is the percentile among # midfielders with #+ minutes in this league (# = middle, # = the best).":"الرقم هو ترتيبه المئوي بين # لاعب وسط لعبوا #+ دقيقة في هذا الدوري (# = المنتصف، # = الأفضل).",
  "The number is the percentile among # forwards with #+ minutes in this league (# = middle, # = the best).":"الرقم هو ترتيبه المئوي بين # مهاجم لعبوا #+ دقيقة في هذا الدوري (# = المنتصف، # = الأفضل).",
  "The number is the percentile among # outfield players with #+ minutes in this league (# = middle, # = the best).":"الرقم هو ترتيبه المئوي بين # من لاعبي الميدان لعبوا #+ دقيقة في هذا الدوري (# = المنتصف، # = الأفضل).",
  "His position is not known yet, so the comparison is with all outfield players.":"مركزه غير معروف للحين، فالمقارنة مع كل لاعبي الميدان.",
  "Attack direction →":"اتجاه الهجوم ←","Ratings":"التقييمات"
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
 if(/^#\/player\//.test(location.hash)&&!document.getElementById('pp')&&document.querySelector('#app h2')&&typeof route==='function')route();
})();
