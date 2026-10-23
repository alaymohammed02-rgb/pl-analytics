/* ===== Home extras: the matchday strip and the player of the round =====
   Matchday strip (top of the home): today's fixtures with a live countdown to kick-off, or the next matchday if there is
   no match today, then the latest results. Fixtures and kick-off times: data/fixtures.json (PitchAPI's upcoming matches,
   refreshed by the sync every hour); results: the league file. There is no live score in the data, so a match that has kicked
   off shows "Kicked off" until the sync brings its result.
   Player of the round: the highest PitchAPI match rating in the round shown on the home (the same days as "Stars of the
   round"), among players with at least POTR_MIN minutes in that match, from data/<league>_rt.json; nothing is shown until the
   sync has fetched ratings for the round. */
(function(){
 if(typeof homeMount!=='function'||typeof homeStars!=='function')return;
 const POTR_MIN=45,MD_DAYS=4;
 const lc=()=>document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const dayKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const crest=c=>typeof hCrest==='function'?hCrest(c):'';
 /* ---------- player of the round: a placeholder next to "Stars of the round", filled once the ratings are in ---------- */
 const hs=homeStars;
 homeStars=function(c){return '<section class="hsec" id="potr" hidden></section>'+hs.apply(this,arguments)};
 const hm=homeMount;
 homeMount=async function(){
  const r=await hm.apply(this,arguments);
  /* the home on the page now may be a newer one still being drawn (a language switch redraws it): only a finished one gets the extras; the newer one's own call adds them */
  const home=document.getElementById('home');if(!home||home.dataset.hx||!home.querySelector('.hsec'))return r;home.dataset.hx='1';
  let c=null;try{c=await homeData()}catch(e){}
  if(!c||!document.body.contains(home))return r;
  await Promise.all([mdStrip(home,c).catch(e=>console.warn('matchday strip',e)),potr(home,c).catch(e=>console.warn('player of the round',e))]);
  return r;
 };
 async function potr(home,c){
  const el=home.querySelector('#potr');if(!el)return;
  const rt=await rtLoad();if(!rt||!rt.m||!document.body.contains(el))return;
  const P=c.P,ix=P&&P.ix,gk=c.gk||new Set(),round=new Map((c.round||[]).map(m=>[m.match_id,m]));
  const C=[];round.forEach((m,mid)=>{const R=rt.m[mid];if(!R)return;Object.entries(R).forEach(([pid,v])=>{if(typeof v!=='number')return;
   const row=P&&P.rows.find(r=>r[ix.m]===mid&&r[ix.i]===pid),s=(D.stats||[]).find(s=>s.match_id===mid&&s.player_id===pid);
   const mi=row?row[ix.mi]:s?s.minutes:null;if(mi==null||mi<POTR_MIN)return;
   C.push({pid,mid,m,r:v,mi,n:row?row[ix.n]:s.player,club:row?row[ix.c]:s.club,key:s?s.key:null,row,gk:gk.has(pid)})})});
  if(!C.length)return;
  const B=new Map();C.forEach(x=>{const o=B.get(x.pid);if(!o||x.r>o.r||(x.r===o.r&&x.mi>o.mi))B.set(x.pid,x)});   /* a player's best match of the round */
  const U=[...B.values()].sort((a,b)=>b.r-a.r||b.mi-a.mi),W=U[0],rest=U.slice(1,5),rated=new Set(C.map(x=>x.mid)).size;
  const href=x=>'#/player/'+encodeURIComponent((x.key||x.pid)+'||'+x.club);
  const st=W.row?[['Goals','gl'],['Assists','ast'],['xG','xg'],['xAG','xag'],['Shots','sh'],['Key passes','kp']].map(([l,k])=>[l,W.row[ix[k]]]).filter(x=>x[1]!=null):[];
  const fx=v=>Number.isInteger(v)?String(v):(+v).toFixed(2);
  el.innerHTML=`<div class="hhd"><h2>Player of the round</h2><span class="mu nw">${esc(c.from)} – ${esc(c.last)} · <span>PitchAPI match rating</span></span></div>
   <div class="hcard potr-c" style="${clubVars(W.club)}"><a class="potr-a" href="${href(W)}">${hAvatar(W.pid,W.n,W.club,true)}<div class="potr-t"><div class="hk">Player of the round</div><div class="potr-n">${esc(W.n)}</div>
    <div class="hcl">${crest(W.club)}<span>${esc(W.club)}</span></div></div><b class="potr-r" style="background:${rc(W.r)}">${W.r.toFixed(1)}</b></a>
    <div class="potr-m"><a href="#/match/${encodeURIComponent(W.mid)}">${esc(W.m.home)} ${esc(W.m.score)} ${esc(W.m.away)}</a> <span class="mu">· ${Math.round(W.mi)} <span>min</span></span></div>
    ${st.length?`<div class="potr-k">${st.map(([l,v])=>`<div><span>${l}</span><b>${fx(v)}</b></div>`).join('')}</div>`:''}
    ${rest.length?`<ol class="potr-l" start="2">${rest.map(x=>`<li><i style="background:${rc(x.r)}">${x.r.toFixed(1)}</i><a href="${href(x)}">${esc(x.n)}</a><span class="mu">${esc(x.club)}</span></li>`).join('')}</ol>`:''}
    <div class="potr-f"><span class="mu"><span>Highest PitchAPI rating in the round</span> · ${POTR_MIN}+ <span>minutes</span> · <span>${rated} of ${round.size} matches rated</span></span>${typeof shareBtn==='function'?shareBtn('potr'):''}</div></div>`;
  el.hidden=false;
  if(typeof shareWire==='function')shareWire(el,()=>potrShare(W,st,c));
 }
 async function potrShare(W,st,c){
  return shareCard({name:'player-of-the-round-'+W.n,title:W.n,draw:async(ctx,U)=>{
   const X=U.PAD,tr=U.tr;
   U.text(tr('Player of the round'),X,110,{size:40,weight:800,color:U.hi});U.text(D.name+' · '+c.from+' – '+c.last,X,160,{size:28,color:U.mu});
   await U.avatar(W.pid,W.n,W.club,U.W/2,420,200);
   U.text(W.n,U.W/2,700,{size:64,weight:800,align:'center',max:U.W-2*X,fit:40});
   await U.crest(W.club,U.W/2-200,735,52);U.text(W.club,U.W/2-136,774,{size:34,max:420});
   U.badge(W.r.toFixed(1),U.W/2,820,{size:72,h:110,min:220,align:'center',fill:rc(W.r)});
   U.text(W.m.home+' '+W.m.score+' '+W.m.away,U.W/2,995,{size:34,align:'center',color:U.tx,max:U.W-2*X});
   const K=st.slice(0,6),gw=(U.W-2*X-(K.length-1)*16)/Math.max(1,K.length);K.forEach(([l,v],i)=>{const x=X+i*(gw+16);U.rr(x,1040,gw,120,18,'rgba(255,255,255,.05)');U.text(tr(l),x+gw/2,1080,{size:22,color:U.mu,align:'center',max:gw-12});U.text(Number.isInteger(v)?String(v):(+v).toFixed(2),x+gw/2,1138,{size:40,weight:800,align:'center'})});
  }});
 }
 /* ---------- matchday strip ---------- */
 let TICK=null;
 async function mdStrip(home,c){
  if(window.MB_ON)return;           /* the all-leagues matches board (assets/matches-board.js) replaces this strip */
  const [fx,lv0]=await Promise.all([typeof fixLoad==='function'?fixLoad().catch(()=>null):null,typeof liveLoad==='function'?liveLoad():null]);let LV=lv0;
  if(!document.body.contains(home))return;
  const now=Date.now(),L=((fx&&fx.leagues&&fx.leagues[D.id])||[]).filter(f=>f.k&&!isNaN(Date.parse(f.k))).map(f=>({...f,t:Date.parse(f.k)})).sort((a,b)=>a.t-b.t);
  const done=new Set((c.fin||[]).map(m=>m.home+'|'+m.away+'|'+String(m.date).slice(0,10)));
  const up=L.filter(f=>f.t>now-3*3600e3&&!done.has(f.h+'|'+f.a+'|'+f.d));
  const today=dayKey(now),tod=up.filter(f=>f.t<=now||dayKey(f.t)===today),later=up.filter(f=>f.t>now);
  /* no match today: the next matchday is every fixture within MD_DAYS days of the next kick-off (a weekend round runs Fri–Mon) */
  const first=later[0]?new Date(dayKey(later[0].t)+'T00:00:00').getTime():0,nxt=tod.length?tod:later.filter(f=>f.t<first+MD_DAYS*864e5);
  const multi=new Set(nxt.map(f=>dayKey(f.t))).size>1;
  const lastD=c.last,res=(c.round||(c.fin||[]).filter(m=>String(m.date).slice(0,10)===lastD)).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.home.localeCompare(b.home));
  if(!nxt.length&&!res.length)return;
  const fdate=t=>new Date(t).toLocaleDateString(lc(),{weekday:'short',day:'numeric',month:'short'}),ftime=t=>new Date(t).toLocaleTimeString(lc(),{hour:'2-digit',minute:'2-digit'});
  const card=(h,a,href,inner,cls)=>`<${href?'a href="'+href+'"':'div'} class="md-c${cls?' '+cls:''}"><span class="md-tm">${crest(h)}<span>${esc(h)}</span></span>${inner}<span class="md-tm">${crest(a)}<span>${esc(a)}</span></span></${href?'a':'div'}>`;
  /* an upcoming fixture: kick-off and countdown; once PitchAPI's data says it started, its score and minute; "XI" once the official lineups are out */
  const upCard=f=>{const e=LV&&LV.m&&LV.m[String(f.i)],st=typeof lvState==='function'?lvState(e):'pre',xi=e&&e.lu?'<span class="md-xi" title="Official lineups are out">XI</span>':'';
   const inner=st==='live'?`<span class="md-mid"><b class="md-sc">${e.sh??'–'} – ${e.sa??'–'}</b><span class="md-live">● <span>Live</span>${lvMinute(e)?' '+esc(lvMinute(e)):''}</span>${xi}</span>`
    :st==='ft'?`<span class="md-mid"><b class="md-sc">${e.sh??''} – ${e.sa??''}</b><span class="mu">FT</span>${xi}</span>`
    :`<span class="md-mid">${multi?`<span class="md-day">${esc(new Date(f.t).toLocaleDateString(lc(),{weekday:'short',day:'numeric'}))}</span>`:''}<b>${esc(ftime(f.t))}</b><span class="md-cd" data-t="${f.t}"></span>${xi}</span>`;
   return card(f.h,f.a,'#/preview/'+encodeURIComponent(f.i),inner,'up'+(st==='live'?' live':''))};
  const sec=document.createElement('section');sec.className='hsec md';sec.id='mds';
  sec.innerHTML=(nxt.length?`<div class="hhd"><h2>${tod.length?'Today':'Next matchday'}</h2><span class="mu nw">${esc(D.name)} · ${esc(fdate(tod.length?now:nxt[0].t))}${tod.length?'':` · <span>kick-off in</span> <b class="md-cd" data-t="${nxt[0].t}"></b>`}</span></div>
   <div class="md-row md-up">${nxt.map(upCard).join('')}</div>`:'')+
   (res.length?`<div class="hhd md-rh"><h2>Latest results</h2><span class="mu nw">${res.length>1&&c.from&&c.from!==lastD?esc(fdate(Date.parse(c.from+'T12:00:00Z')))+' – ':''}${esc(fdate(Date.parse(lastD+'T12:00:00Z')))}</span></div>
   <div class="md-row">${res.map(m=>{const s=wkSc(m.score);return card(m.home,m.away,'#/match/'+encodeURIComponent(m.match_id),`<span class="md-mid"><b class="md-sc">${s?s[0]+' – '+s[1]:esc(m.score)}</b><span class="mu">FT</span></span>`)}).join('')}</div>`:'');
  const hero=home.firstElementChild;home.insertBefore(sec,hero);
  tick();if(TICK)clearInterval(TICK);let n=0;
  TICK=setInterval(async()=>{if(!document.body.contains(sec)){clearInterval(TICK);TICK=null;return}tick();
   /* once a minute, while a fixture is within 2 hours of kick-off or under way: re-read data/live.json */
   if(++n%60===0&&nxt.some(f=>Math.abs(f.t-Date.now())<3*36e5)){const l=await liveLoad();if(l&&document.body.contains(sec)){LV=l;const row=sec.querySelector('.md-up');if(row){row.innerHTML=nxt.map(upCard).join('');tick()}}}},1000);
  /* the countdown is written in the page language here: the translator skips text like "3d 4h" (no two letters in a row) */
  function tick(){const n=Date.now(),ar=typeof ARL==='object'&&ARL.on,u=ar?['ي','س','د']:['d','h','m'];sec.querySelectorAll('.md-cd').forEach(e=>{const d=+e.dataset.t-n;let s;
   if(d<=0)s=e.closest('.md-c')?(ar?'انطلقت':'Kicked off'):(ar?'الحين':'now');
   else{const D_=Math.floor(d/864e5),H=Math.floor(d%864e5/36e5),M=Math.floor(d%36e5/6e4),S=Math.floor(d%6e4/1e3);s=D_>0?D_+u[0]+' '+H+u[1]:H>0?H+u[1]+' '+String(M).padStart(2,'0')+u[2]:M+':'+String(S).padStart(2,'0')}
   if(e.dataset.s!==s){e.dataset.s=s;e.textContent=s}})}
 }
 if(typeof AR==='object')Object.entries({
  "Player of the round":"لاعب الجولة","Key passes":"تمريرات مفتاحية","Highest PitchAPI rating in the round":"أعلى تقييم PitchAPI في الجولة","PitchAPI match rating":"تقييم PitchAPI للمباراة",
  "# of # matches rated":"# من # مباريات فيها تقييم","minutes":"دقيقة","min":"د",
  "Today":"اليوم","Next matchday":"الجولة القادمة","kick-off in":"تنطلق بعد","Latest results":"آخر النتائج","FT":"نهاية المباراة","Kicked off":"انطلقت","now":"الحين","Live":"مباشر","Official lineups are out":"نزلت التشكيلات الرسمية"
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
 /* the home may have been drawn before this file arrived (the scripts load while the data is fetched): add the extras to it */
 (function late(k){const home=document.getElementById('home');if(!home||home.dataset.hx)return;
  if(!home.querySelector('.hsec')){if(k<40)setTimeout(()=>late(k+1),250);return}
  if(!home.querySelector('#potr')){const st=home.querySelector('.hstar');const sec=st&&st.closest('.hsec');if(sec){const p=document.createElement('section');p.className='hsec';p.id='potr';p.hidden=true;sec.before(p)}}
  home.dataset.hx='1';homeData().then(c=>{if(c&&document.body.contains(home))return Promise.all([mdStrip(home,c),potr(home,c)])}).catch(e=>console.warn('home extras',e))})(0);
})();
