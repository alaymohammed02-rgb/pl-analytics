/* ===== Match replay (#/replay/<match id>): a finished match played again, minute by minute =====
   Not live: PitchAPI publishes a match after the final whistle, and this page replays what it published, through files the
   site already has (no new request to PitchAPI):
   - shots: data/<league>_sh.json — minute (+ added minute), half, place on the pitch, xG, outcome, shooter, set piece, body part;
     the shot's own coordinates are in the shooter's attacking direction (x 0 → 105 = towards the opponent's goal, own goals
     near the scorer's own goal), gy = where it crossed the goal line, blx/bly = where it was blocked;
   - momentum: data/<league>_mx.json — one value a minute, above zero = the home side on top (checked in match-centre.js);
     PitchAPI marks the breaks with half minutes (45.5 half-time, 90.5/90.75 full time, 105.5/120.5 in extra time).
   Time line: each half is drawn with its added time as long as the latest shot of that added time (PitchAPI gives no added
   time otherwise). A goal the shot file does not have (e.g. in extra time) cannot be replayed: the final whistle then shows
   the official score and says how many goals were missing. Nothing in the replay is estimated or invented.
   Spoiler free: the score, the charts and the goal marks on the time bar only show what has happened up to the replay's clock. */
(function(){
 if(typeof R!=='object'||typeof R.match!=='function'||typeof INS!=='object')return;
 const SPEEDS=[10,30,60,120],HOLD_GOAL=1.8,HOLD_HT=2.2,BIG=0.3,KEY_XG=0.15,SPELL_V=60,SPELL_N=3;
 const HC='var(--th-hi)',AC='#e6e3dc';
 const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
 const f2=v=>v==null?'N/A':(+v).toFixed(2);
 const SIT={Penalty:'Penalty',FreeKick:'Free kick',FastBreak:'Counter-attack',FromCorner:'From a corner',SetPiece:'Set piece',ThrowInSetPiece:'From a throw-in'};

 /* ---------- the time line: periods with their added time, and the mapping from (half, minute, added minute) to replay time ---------- */
 function periods(shots,mo){
  const addOf=(pd,end)=>Math.max(0,...shots.filter(r=>r.pd===pd&&r.mn>=end&&r.ma>0).map(r=>Math.ceil(r.ma)));
  /* extra time on the time line only when the shot file has shots from it; with momentum alone it would be minutes with nothing to show
     (and drawing them from kick-off would tell that the match was level after 90) */
  const et=shots.some(r=>r.pd==='SecondHalf'&&r.mn>90&&!(r.ma>0));
  const P=[{b:0,len:45,add:addOf('FirstHalf',45)},{b:45,len:45,add:addOf('SecondHalf',90)}];
  if(et)P.push({b:90,len:15,add:0},{b:105,len:15,add:0});
  let o=0;P.forEach(p=>{p.o=o;o+=p.len+p.add});
  return {P,END:o,at:(i,mn,ma)=>{const p=P[i];return p.o+Math.max(0,Math.min(p.len,mn-p.b))+(ma>0&&mn>=p.b+p.len?Math.min(p.add,ma):0)}};
 }
 /* period of a shot: half from the file; minutes past 90 with no added minute are extra time (when the match had it) */
 const shotPeriod=(r,TL)=>{if(r.pd==='FirstHalf')return 0;if(r.mn>90&&!(r.ma>0)&&TL.P.length>2)return r.mn>105?3:2;return 1};
 const clockOf=(TL,T)=>{if(T<=0)return "0'";const P=TL.P;let i=P.findIndex(p=>T<=p.o+p.len+p.add+1e-9);if(i<0)i=P.length-1;const p=P[i],u=T-p.o;
  return u<=p.len+1e-9?(p.b+Math.max(1,Math.ceil(u-1e-9)))+"'":(p.b+p.len)+'+'+Math.ceil(u-p.len-1e-9)+"'"};

 /* ---------- the match, from the files (kept apart from the drawing) ---------- */
 function build(m,S,X){
  const rows=(S&&S.rows||[]).filter(r=>r.m===m.match_id&&r.pd!=='PenaltyShootout'&&r.mn!=null);
  const sd=INS.sideFn(rows,m),flip=s=>s==='h'?'a':'h';
  const raw=rows.map(r=>{const own=sd(r);return own?{...r,own,side:r.og?flip(own):own}:null}).filter(Boolean);
  const e=X&&X.m&&X.m[m.match_id],mo=e&&e.mo&&e.mo.length?e.mo:null;
  const TL=periods(raw,mo),etGap=TL.P.length===2&&(mo||[]).some(p=>p[0]>100);   /* extra time played, none of it in the shot file */
  const shots=raw.map(r=>{const i=shotPeriod(r,TL),p=TL.P[i];return {...r,T:Math.max(p.o+.01,TL.at(i,r.mn,r.ma)-.5),goal:r.ev==='Goal'||!!r.og}}).sort((a,b)=>a.T-b.T||(a.goal-b.goal));
  shots.forEach(r=>r.clock=clockOf(TL,r.T));
  /* momentum: whole minutes only (the half minutes are PitchAPI's break marks), each placed in its period */
  const MO=[];(mo||[]).forEach(([t,v])=>{if(t!==Math.floor(t)||typeof v!=='number')return;
   const i=t<=45?0:t<=90?1:TL.P.length>2?(t<=105?2:t<=120?3:-1):-1;if(i<0)return;MO.push({t,i,T:Math.max(TL.P[i].o,TL.at(i,t,0)-.5),v})});
  /* spells on top: SPELL_N+ minutes in a row with momentum SPELL_V+ for the same side, within one period (about 2–3 a match in this site's data) */
  const spells=[];let run=null;const close=()=>{if(run&&run.n>=SPELL_N)spells.push(run);run=null};
  MO.forEach(p=>{const s=p.v>=SPELL_V?'h':p.v<=-SPELL_V?'a':null;if(s&&run&&run.side===s&&run.i===p.i&&p.t===run.t1+1){run.t1=p.t;run.T1=p.T;run.n++;return}close();if(s)run={side:s,i:p.i,t0:p.t,t1:p.t,T0:p.T,T1:p.T,n:1}});close();
  spells.forEach(s=>{s.T=s.T1+.5;s.from=clockOf(TL,s.T0);s.to=clockOf(TL,s.T1)});
  const off=wkSc(m.score),got={h:shots.filter(r=>r.goal&&r.side==='h').length,a:shots.filter(r=>r.goal&&r.side==='a').length};
  return {m,TL,shots,MO,spells,off,got,etGap,xgT:{h:sum(shots,'h'),a:sum(shots,'a')}};
 }
 const sum=(L,s,T=Infinity)=>L.filter(r=>r.side===s&&!r.og&&r.T<=T).reduce((a,r)=>a+(r.xg||0),0);
 /* the replay's events: kick-off, shots, spells on top, half-time, full time */
 function events(G){
  const E=[{T:0,k:'ko'}];
  G.shots.forEach((r,i)=>E.push({T:r.T,k:r.goal?'goal':'shot',r,i,key:r.goal||r.ev==='Post'||(r.xg||0)>=KEY_XG||r.st==='Penalty'}));
  G.spells.forEach(s=>E.push({T:s.T,k:'spell',s,key:true}));
  G.TL.P.slice(0,-1).forEach((p,i)=>E.push({T:p.o+p.len+p.add,k:i===0?'ht':'et',i,key:true}));
  E.push({T:G.TL.END,k:'ft',key:true});
  return E.sort((a,b)=>a.T-b.T||(a.k==='ko'?-1:0));
 }

 R.replay=async function(el,id){
  id=decodeURIComponent(id||'');
  const m=D&&D.matches&&D.matches.find(x=>x.match_id===id);
  if(!m){el.innerHTML=`<h2>Match replay</h2><div class="empty"><span>This match is not in the open league.</span> <a href="#/matches">Matches →</a></div>`;return}
  if(!wkSc(m.score)){el.innerHTML=`<h2>Match replay</h2><div class="empty"><span>This match has not been played yet.</span> <a href="#/preview/${encodeURIComponent(id)}">Match preview →</a></div>`;return}
  el.innerHTML=`<h2>Match replay</h2><p class="mu"><span class="rp-n">${esc(m.home)} – ${esc(m.away)}</span> · <span class="rp-n">${esc(D.name)}</span> · ${esc(String(m.date).slice(0,10))}</p><div id="rp" class="rp ins"><div class="empty skel">Loading…</div></div>`;
  const root=el.querySelector('#rp'),lg=D.id;
  const [S,X]=await Promise.all([loadSh().catch(()=>null),typeof mxLoad==='function'?mxLoad().catch(()=>null):null]);
  if(!root.isConnected||D.id!==lg)return;
  const G=build(m,S,X);
  if(!G.shots.length){root.innerHTML=`<div class="empty"><span>No shot data for this match, so it cannot be replayed.</span> <a href="#/match/${encodeURIComponent(id)}">Match centre →</a></div>`;return}
  play(root,G,events(G));
 };

 function play(root,G,E){
  const {m,TL}=G,END=TL.END;
  let T=0,on=false,hold=0,holdKind='',last=0,raf=0,drag=false,filt=store.get('rp_feed','key'),sp=+store.get('rp_speed','30');if(!SPEEDS.includes(sp))sp=30;
  let shown=-1,feedN=-1,goalsN=-1;
  const crest=c=>{const s=typeof logoOf==='function'&&logoOf(c);return s?`<img class="rp-cr" src="${esc(s)}" alt="" aria-hidden="true">`:`<span class="rp-cr rp-dot" style="${typeof clubVars==='function'?clubVars(c):''}"></span>`};
  root.innerHTML=`<div class="card rp-sb"><div class="rp-t">${crest(m.home)}<b class="rp-n">${esc(m.home)}</b></div>
    <div class="rp-mid"><span class="rp-badge"><span>Replay</span></span><b class="rp-sc" id="rpsc">0 – 0</b><b class="rp-clk" id="rpclk">0'</b><span class="mu rp-xg" id="rpxg"></span></div>
    <div class="rp-t">${crest(m.away)}<b class="rp-n">${esc(m.away)}</b></div>
    <div class="rp-ov" id="rpov" aria-hidden="true"></div><div class="rp-sr" id="rpsr" role="status" aria-live="polite" aria-atomic="true"></div></div>
   <div class="card rp-ctl"><div class="rp-btns">
     <button type="button" class="rp-pl" id="rpp" aria-label="Play">▶</button>
     <button type="button" class="s" id="rpprev" aria-label="Previous key moment" title="Previous key moment">⏮</button>
     <button type="button" class="s" id="rpnext" aria-label="Next key moment" title="Next key moment">⏭</button>
     <button type="button" class="s" id="rpre" aria-label="Restart" title="Restart">↺</button>
     <select id="rpsp" aria-label="Speed">${SPEEDS.map(s=>`<option value="${s}"${s===sp?' selected':''}>×${s}</option>`).join('')}</select>
     <span class="mu rp-sph" id="rpsph"></span></div>
    <div class="rp-bar"><div class="rp-trk" id="rptrk" aria-hidden="true"></div><input type="range" id="rpsk" min="0" max="${END}" step="0.05" value="0" aria-label="Match time"></div></div>
   <div class="rp-main"><div class="card rp-pitch"><h3>Shots <span class="mu">· <span>sized by xG</span></span></h3>${pitch(G,0)}${pitch(G,1)}
     <div class="ins-leg"><span><i></i><span class="rp-n">${esc(m.home)}</span> <b class="rp-ar"></b></span><span><i class="b"></i><span class="rp-n">${esc(m.away)}</span> <b class="rp-ar a"></b></span><span><b class="rc-gk"></b><span>Goal</span></span></div>
     <p class="mu rp-last" id="rplast"></p></div>
    <div class="card rp-feed"><div class="rp-fh"><h3>Key moments</h3><select id="rpf" aria-label="Show">${opts([['key','Key moments'],['all','Every shot']],filt)}</select></div><ol class="rp-l" id="rpl"></ol></div></div>
   <div class="card rp-chc"><h3>xG race and momentum <span class="mu">· <span>up to the replay's clock</span></span></h3><div id="rpchs"></div></div>
   <p class="mu ins-note"><span>Replayed from PitchAPI's data after the match: not live.</span> <span>Added time lasts until the last shot PitchAPI lists in it.</span> <a href="#/match/${encodeURIComponent(m.match_id)}">Match centre →</a></p>`;
  const $$=s=>root.querySelector(s),sc=$$('#rpsc'),clk=$$('#rpclk'),xg=$$('#rpxg'),ov=$$('#rpov'),btn=$$('#rpp'),sk=$$('#rpsk'),trk=$$('#rptrk'),lst=$$('#rpl'),lastEl=$$('#rplast');
  const dots=[...root.querySelectorAll('.rp-s')];let CHS=[],MX=0;
  /* the xG scale: half a goal of room above the higher line so far, at least 1 */
  const lvl=v=>Math.max(1,Math.ceil(v*2-1e-9)/2+.5);
  const charts=()=>{$$('#rpchs').innerHTML=chart(G,960,'w',MX)+chart(G,440,'n',MX);
   CHS=[...root.querySelectorAll('.rp-ch svg')].map(svg=>({svg,L:+svg.dataset.l,W:+svg.dataset.w,clip:svg.querySelector('.rp-clipr'),head:svg.querySelector('.rp-head'),gm:[...svg.querySelectorAll('.rp-gm')]}));
   CHS.forEach(c=>c.svg.addEventListener('click',e=>{const r=c.svg.getBoundingClientRect(),vb=c.svg.viewBox.baseVal,x=(e.clientX-r.left)/r.width*vb.width;seek((x-c.L)/c.W*END)}))};
  const alive=()=>root.isConnected&&/^#\/replay\//.test(location.hash);
  const speedNote=()=>{$$('#rpsph').textContent='';const s=document.createElement('span');s.textContent=`90' ≈ ${Math.round(90*60/sp)} s`;$$('#rpsph').appendChild(s)};
  const score=t=>({h:G.shots.filter(r=>r.goal&&r.side==='h'&&r.T<=t).length,a:G.shots.filter(r=>r.goal&&r.side==='a'&&r.T<=t).length});
  const setBtn=()=>{btn.textContent=on?'⏸':'▶';btn.setAttribute('aria-label',on?'Pause':'Play');btn.classList.toggle('on',on)};
  const say=(html,kind)=>{ov.innerHTML=html;ov.className='rp-ov on '+(kind||'');if(reduce())ov.classList.add('rm');$$('#rpsr').innerHTML=html};   /* the same spans, so the page translator reaches them */
  const hush=()=>{ov.className='rp-ov';ov.innerHTML=''};
  const W_={};const put=(el,k,v)=>{if(W_[k]!==v){W_[k]=v;el.textContent=v}};
  function render(){
   const s=score(T),ft=T>=END-1e-9,scT=ft&&G.off?`${G.off[0]} – ${G.off[1]}`:`${s.h} – ${s.a}`,ck=ft?'FT':holdKind==='ht'?'HT':clockOf(TL,T);
   put(sc,'sc',scT);put(clk,'clk',ck);put(xg,'xg',`xG ${f2(sum(G.shots,'h',T))} – ${f2(sum(G.shots,'a',T))}`);
   if(!drag){sk.value=T;sk.setAttribute('aria-valuetext',ck+', '+scT)}
   /* shots: the ones taken so far, the latest one marked with its path */
   let k=0;while(k<G.shots.length&&G.shots[k].T<=T)k++;
   if(k!==shown){dots.forEach(d=>{const i=+d.dataset.i;d.classList.toggle('on',i<k);d.classList.toggle('lt',i===k-1)});shown=k;
    const r=G.shots[k-1];lastEl.innerHTML=r?`<bdi dir="ltr"><b>${esc(r.clock)}</b></bdi> <span class="rp-n">${esc(r.pn||'')}</span> <span class="mu">(<span class="rp-n">${esc(r.own==='h'?m.home:m.away)}</span>)</span> · ${what(r)} · xG ${f2(r.xg)}`:'<span>Kick-off: the shots appear as they are taken.</span>'}
   const need=lvl(Math.max(sum(G.shots,'h',T),sum(G.shots,'a',T)));if(need!==MX){MX=need;charts()}
   CHS.forEach(c=>{c.clip.setAttribute('width',Math.max(0,T/END*c.W).toFixed(1));const x=(c.L+T/END*c.W).toFixed(1);c.head.setAttribute('x1',x);c.head.setAttribute('x2',x);
    c.gm.forEach(g=>{g.style.visibility=+g.dataset.t<=T?'visible':'hidden'})});
   /* goal marks on the time bar: only the goals already scored */
   const gs=G.shots.filter(r=>r.goal&&r.T<=T);if(gs.length!==goalsN){goalsN=gs.length;
    const at=t=>`left:calc(8px + (100% - 16px)*${(t/END).toFixed(4)})`;   /* the range thumb's centre runs 8 px in from each end */
    trk.innerHTML=TL.P.slice(1).map(p=>`<i class="ht" style="${at(p.o)}"></i>`).join('')+gs.map(r=>`<i class="g ${r.side}" style="${at(r.T)}"></i>`).join('')}
   feed();
  }
  function what(r){
   const tags=[];if(SIT[r.st])tags.push(`<span>${SIT[r.st]}</span>`);if(r.ty==='Header')tags.push('<span>Header</span>');
   const o=r.og?'<span>Own goal</span>':r.ev==='Goal'?'<span>Goal</span>':r.ev==='Post'?'<span>Off the post</span>':r.ev==='AttemptSaved'?(r.bl?'<span>Blocked</span>':'<span>Saved by the keeper</span>'):'<span>Off target</span>';
   return o+(tags.length?' · '+tags.join(' · '):'');
  }
  function feed(){
   const L=E.filter(e=>e.T<=T&&(filt==='all'||e.key||e.k==='ko'));
   if(L.length===feedN)return;feedN=L.length;
   lst.innerHTML=L.slice().reverse().slice(0,80).map(e=>{
    if(e.k==='ko')return `<li class="rp-e ko"><b>0'</b><span>Kick-off</span></li>`;
    if(e.k==='ht'){const s=score(e.T);return `<li class="rp-e br"><b>HT</b><span><span>Half-time</span> ${s.h} – ${s.a} · xG ${f2(sum(G.shots,'h',e.T))} – ${f2(sum(G.shots,'a',e.T))}</span></li>`}
    if(e.k==='et'){const s=score(e.T);return `<li class="rp-e br"><b>${esc(clockOf(TL,e.T))}</b><span><span>End of the period</span> ${s.h} – ${s.a}</span></li>`}
    if(e.k==='ft')return `<li class="rp-e br"><b>FT</b><span>${ftText()}</span></li>`;
    if(e.k==='spell'){const s=e.s;return `<li class="rp-e sp ${s.side}"><b>${esc(s.from)}–${esc(s.to)}</b><span><span class="rp-n">${esc(s.side==='h'?m.home:m.away)}</span> <span>on top</span> <span class="mu">(<span>PitchAPI momentum</span> ${SPELL_V}+)</span></span></li>`}
    const r=e.r,big=(r.xg||0)>=BIG&&!r.og;
    return `<li class="rp-e ${r.goal?'gl':'sh'} ${r.side}"><b>${esc(r.clock)}</b><span>${r.goal?'⚽ ':''}<span class="rp-n">${esc(r.pn||'')}</span> <span class="mu">(<span class="rp-n">${esc(r.own==='h'?m.home:m.away)}</span>)</span> · ${what(r)}${r.og?'':` · xG ${f2(r.xg)}`}${big?' <i class="rp-big"><span>Big chance</span></i>':''}</span></li>`}).join('');
  }
  function ftText(){
   const s=score(END),miss=G.off&&(G.off[0]!==s.h||G.off[1]!==s.a);
   const top=G.spells.slice().sort((a,b)=>b.n-a.n)[0];
   return `<span>Full time</span> ${G.off?G.off[0]+' – '+G.off[1]:s.h+' – '+s.a} · xG ${f2(G.xgT.h)} – ${f2(G.xgT.a)} · <span>Shots:</span> ${G.shots.filter(r=>r.own==='h'&&!r.og).length} – ${G.shots.filter(r=>r.own==='a'&&!r.og).length}`+
    (top?` · <span>longest spell on top:</span> <span class="rp-n">${esc(top.side==='h'?m.home:m.away)}</span> <bdi dir="ltr">${esc(top.from)}–${esc(top.to)}</bdi>`:'')+
    (G.etGap?`<br><span class="rp-miss"><span>This match went to extra time; PitchAPI's shot data has no shots from it, so the replay stops after the second half.</span></span>`:'')+
    (miss?`<br><span class="rp-miss"><span>PitchAPI's shot data has # – # of the goals; the others could not be replayed.</span></span>`.replace('# – #',`${s.h} – ${s.a}`):'');
  }
  /* crossing events while playing: goals and breaks hold the clock for a moment */
  function cross(t0,t1){
   for(const e of E){if(e.T<=t0||e.T>t1)continue;
    if(e.k==='goal'){const s=score(e.T),r=e.r;say(`<b class="rp-big-t">${r.og?'<span>Own goal!</span>':'<span>Goal!</span>'}</b><span class="rp-ovs">${s.h} – ${s.a}</span><span><span class="rp-n">${esc(r.pn||'')}</span> <bdi dir="ltr">${esc(r.clock)}</bdi>${r.og?'':' · xG '+f2(r.xg)}</span>`,'gl '+r.side);hold=HOLD_GOAL;holdKind='goal';return e.T}
    if(e.k==='ht'||e.k==='et'){const s=score(e.T);say(`<b class="rp-big-t">${e.k==='ht'?'<span>Half-time</span>':'<span>End of the period</span>'}</b><span class="rp-ovs">${s.h} – ${s.a}</span><span>xG ${f2(sum(G.shots,'h',e.T))} – ${f2(sum(G.shots,'a',e.T))}</span>`,'br');hold=HOLD_HT;holdKind=e.k==='ht'?'ht':'';return e.T}}
   return t1;
  }
  function frame(ts){
   raf=0;if(!alive()){on=false;return}
   const dt=last?Math.min(.25,(ts-last)/1000):0;last=ts;
   if(hold>0){hold-=dt;if(hold<=0){hold=0;holdKind='';hush()}}
   else if(on){const t1=Math.min(END,T+dt*sp/60);T=cross(T,t1);if(T>=END-1e-9){T=END;on=false;const s=score(END);say(`<b class="rp-big-t"><span>Full time</span></b><span class="rp-ovs">${G.off?G.off[0]+' – '+G.off[1]:s.h+' – '+s.a}</span>`,'br');hold=HOLD_HT;holdKind='ft';setBtn()}}
   render();if(on||hold>0)raf=requestAnimationFrame(frame);
  }
  const kick=()=>{if(!raf){last=0;raf=requestAnimationFrame(frame)}};
  const seek=t=>{T=Math.max(0,Math.min(END,t));hold=0;holdKind='';hush();render()};
  btn.onclick=()=>{if(!on&&T>=END-1e-9)seek(0);on=!on;setBtn();if(on)kick()};
  $$('#rpre').onclick=()=>{seek(0);on=true;setBtn();kick()};
  const keys=()=>E.filter(e=>e.key&&e.k!=='spell').map(e=>e.T);
  $$('#rpnext').onclick=()=>{const t=keys().find(x=>x>T+.01);seek(t==null?END:t)};
  $$('#rpprev').onclick=()=>{const L=keys().filter(x=>x<T-.01);seek(L.length?L[L.length-1]:0)};
  $$('#rpsp').onchange=e=>{sp=+e.target.value;store.set('rp_speed',String(sp));speedNote()};
  $$('#rpf').onchange=e=>{filt=e.target.value;store.set('rp_feed',filt);feedN=-1;feed()};
  sk.addEventListener('input',()=>{drag=true;seek(+sk.value)});sk.addEventListener('change',()=>{drag=false;render()});
  root.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;
   if(e.key===' '||e.key==='k'){if(e.target.closest('button'))return;e.preventDefault();btn.click()}
   else if(e.key==='ArrowRight'&&!e.target.closest('[data-tip]')){seek(T+1)}else if(e.key==='ArrowLeft'&&!e.target.closest('[data-tip]')){seek(T-1)}});
  speedNote();setBtn();render();
 }

 /* ---------- drawings ---------- */
 function pitch(G,v){
  /* each team in its own direction: home attacks →, away ←; a shot keeps the shooter's direction (own goals end at his own goal) */
  const pos=(r,x,y)=>r.own==='h'?[x,y]:[105-x,68-y];
  const g=G.shots.map((r,i)=>{if(r.x==null||r.y==null)return '';const [x,y]=pos(r,r.x,r.y);
   const [tx,ty]=r.bl&&r.blx!=null&&r.bly!=null?pos(r,r.blx,r.bly):r.og?pos(r,0,34):pos(r,105,r.gy!=null?r.gy:34);   /* blocked: to the block; else to where it crossed the goal line */
   const rad=(0.8+Math.sqrt(Math.max(0,r.xg||0))*3.2).toFixed(2);
   return `<g class="rp-s ${r.side}${r.goal?' g':''}" data-i="${i}"><line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}" class="rp-path"></line>
    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rad}" class="rp-dt"${INS.tipAttr([r.pn,r.own==='h'?G.m.home:G.m.away,r.clock,r.og?'Own goal':'xG '+f2(r.xg),r.og?'':r.ev==='Goal'?'Goal':r.ev==='Post'?'Off the post':r.ev==='AttemptSaved'?(r.bl?'Blocked':'Saved by the keeper'):'Off target'])}></circle>
    ${r.goal?`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rad}" class="rp-ring"></circle>`:''}</g>`}).join('');
  const inner=`${typeof PITCH_BG==='string'?PITCH_BG:''}${typeof pitchLines==='function'?pitchLines('#4d8f6b','1'):''}${g}`;
  return v?`<svg class="rp-pt v" viewBox="-2 -2 72 109" role="img" aria-label="Shots so far"><g transform="matrix(0,-1,1,0,0,105)">${inner}</g></svg>`
   :`<svg class="rp-pt h" viewBox="-2 -2 109 72" role="img" aria-label="Shots so far">${inner}</svg>`;
 }
 function chart(G,W,cls,mx){
  const {TL,shots,MO}=G,END=TL.END,L=W>500?34:26,Rm=W>500?12:8,CW=W-L-Rm,top=10,h1=W>500?118:96,m0=h1+32,h2=W>500?44:36,H=m0+h2*2+22,X=t=>L+t/END*CW;
  const Y=v=>top+(1-v/mx)*h1;
  const race=s=>{let v=0,d=`M${X(0).toFixed(1)},${Y(0).toFixed(1)}`;shots.filter(r=>r.side===s&&!r.og).forEach(r=>{d+=`H${X(r.T).toFixed(1)}`;v+=r.xg||0;d+=`V${Y(v).toFixed(1)}`});return `<path d="${d}H${X(END).toFixed(1)}" class="rp-race ${s}"></path>`};
  const goals=shots.filter(r=>r.goal).map(r=>`<circle cx="${X(r.T).toFixed(1)}" cy="${Y(sum(shots,r.side,r.T)).toFixed(1)}" r="5" class="rp-gm ${r.side}" data-t="${r.T}" style="visibility:hidden"></circle>`).join('');
  const bw=Math.max(1.5,CW/END*.8),K=h2/100,Y0=m0+h2;
  const bars=MO.map(p=>{if(!p.v)return '';const hh=Math.min(100,Math.abs(p.v))*K;return `<rect x="${(X(p.T)-bw/2).toFixed(1)}" y="${(p.v>0?Y0-hh:Y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${p.v>0?HC:AC}" opacity=".85"></rect>`}).join('');
  const tk=[],step=W>500?15:(TL.P.length>2?30:15);TL.P.forEach((p,i)=>{for(let mm=p.b;mm<=p.b+p.len;mm+=step){if(i>0&&mm===p.b)continue;tk.push([TL.at(i,mm,0),mm])}});
  const ticks=tk.map(([t,mm])=>`<text x="${X(t).toFixed(1)}" y="${H-6}" class="mc-ax">${mm}'</text>`).join('')+TL.P.slice(1).map(p=>`<line x1="${X(p.o).toFixed(1)}" x2="${X(p.o).toFixed(1)}" y1="${top}" y2="${H-20}" class="mc-gr ht"></line>`).join('');
  const ys=[0,.5,1,1.5,2,2.5,3,4,5].filter(v=>v<=mx).map(v=>`<text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" class="mc-ax e">${v}</text>`).join('');
  return `<div class="rp-ch ${cls}"><svg viewBox="0 0 ${W} ${H}" data-l="${L}" data-w="${CW}" role="img" aria-label="xG race and momentum up to the replay's clock"><defs><clipPath id="rpclip${cls}"><rect class="rp-clipr" x="${L}" y="0" width="0" height="${H}"></rect></clipPath></defs>
   ${ys}${ticks}<line x1="${L}" x2="${W-Rm}" y1="${Y(0)}" y2="${Y(0)}" class="mc-gr"></line><line x1="${L}" x2="${W-Rm}" y1="${Y0}" y2="${Y0}" class="mc-gr"></line>
   <text x="${L}" y="${m0-6}" class="rp-cl">${MO.length?'Momentum':'No momentum data for this match'}</text>
   <g clip-path="url(#rpclip${cls})">${race('h')}${race('a')}${bars}</g>${goals}
   <line x1="${L}" x2="${L}" y1="${top}" y2="${H-20}" class="rp-head"></line></svg></div>`;
 }

 /* the way in: a button on the match centre's scoreboard, when the match has shots */
 const om=R.match;
 R.match=async function(el,id){
  const h0=location.hash,out=await om.apply(this,arguments);
  if(location.hash!==h0)return out;   /* another match opened meanwhile: its own call adds its button */
  const f=el&&el.querySelector('#mc .mc-score .mc-foot');
  if(f&&el.querySelector('#mc .mc-race svg')&&!f.querySelector('.rp-go')){const a=document.createElement('a');a.className='rp-go';a.href='#/replay/'+encodeURIComponent(decodeURIComponent(id||''));a.innerHTML='▶ <span>Replay the match</span>';f.insertBefore(a,f.children[1]||null)}
  return out;
 };
 INS.ar({"Match replay":"إعادة المباراة","This match is not in the open league.":"هذي المباراة مو في الدوري المفتوح.","Matches →":"المباريات ←","This match has not been played yet.":"هذي المباراة ما انلعبت للحين.",
  "Match preview →":"معاينة المباراة ←","No shot data for this match, so it cannot be replayed.":"ما فيه بيانات تسديدات لهذي المباراة، فما نقدر نعيدها.","Match centre →":"مركز المباراة ←",
  "Replay":"إعادة","Play":"تشغيل","Pause":"إيقاف مؤقت","Previous key moment":"اللحظة المهمة السابقة","Next key moment":"اللحظة المهمة التالية","Restart":"من البداية","Speed":"السرعة","Match time":"وقت المباراة",
  "Shots":"التسديدات","sized by xG":"الحجم حسب xG","Goal":"هدف","Key moments":"اللحظات المهمة","Every shot":"كل التسديدات","Show":"عرض",
  "xG race and momentum":"سباق xG والزخم","up to the replay's clock":"لين وقت الإعادة","Replayed from PitchAPI's data after the match: not live.":"معادة من بيانات PitchAPI بعد المباراة: مو مباشر.",
  "Added time lasts until the last shot PitchAPI lists in it.":"الوقت بدل الضائع يمتد لين آخر تسديدة يذكرها PitchAPI فيه.","Kick-off: the shots appear as they are taken.":"البداية: التسديدات تظهر وقت ما تنسدد.",
  "Kick-off":"البداية","Half-time":"نهاية الشوط الأول","End of the period":"نهاية الفترة","Full time":"نهاية المباراة","on top":"مسيطر","PitchAPI momentum":"زخم PitchAPI","Big chance":"فرصة كبيرة",
  "Own goal":"هدف عكسي","Own goal!":"هدف عكسي!","Goal!":"هدف!","Off the post":"في القائم","Blocked":"اتصدّت","Saved by the keeper":"صدّها الحارس","Off target":"خارج المرمى","Header":"رأسية",
  "Penalty":"ركلة جزاء","Free kick":"ركلة حرة","Counter-attack":"هجمة مرتدة","From a corner":"من ركنية","Set piece":"كرة ثابتة","From a throw-in":"من رمية تماس",
  "Shots:":"التسديدات:","longest spell on top:":"أطول فترة سيطرة:","Momentum":"الزخم","No momentum data for this match":"ما فيه بيانات زخم لهذي المباراة",
  "PitchAPI's shot data has # – # of the goals; the others could not be replayed.":"بيانات تسديدات PitchAPI فيها # – # من الأهداف؛ الباقي ما قدرنا نعيده.",
  "This match went to extra time; PitchAPI's shot data has no shots from it, so the replay stops after the second half.":"هذي المباراة راحت لأشواط إضافية؛ بيانات تسديدات PitchAPI ما فيها شي منها، فالإعادة توقف بعد الشوط الثاني.",
  "Replay the match":"أعد المباراة","Shots so far":"التسديدات للحين","xG race and momentum up to the replay's clock":"سباق xG والزخم لين وقت الإعادة"});
})();
