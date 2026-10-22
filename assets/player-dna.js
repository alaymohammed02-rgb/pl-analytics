/* ===== Player DNA (in the player page, replaces the radar card): the player's profile from his own numbers =====
   Reference group: players of his position (as learnt by the sync) with DNA_MIN+ minutes in this league this season, outfield
   only (all outfield players when his position is not known yet). Unit: per 90 minutes. Period: this season.
   Each dimension is the mean percentile of its measures (mid-rank percentile, 50 = middle of the group); a measure PitchAPI
   has no value for is left out of the mean, never read as zero.
   Descriptions follow fixed rules, listed in DNA_RULES: a description appears only when its dimension is at or above its
   threshold, and shows the numbers it comes from. "Better than N%" is the computed percentile; nothing else is claimed. */
(function(){
 if(typeof R!=='object'||typeof R.player!=='function'||typeof INS!=='object')return;
 const DNA_MIN=450;
 /* dimension: [label, measures (MET keys)] */
 const DIMS=[['Shooting',['npxg','sh']],['Creating',['xag','kp','sca']],['Passing forward',['pr','bx']],['Carrying',['pc','cb','tkw']],
  ['Defending',['tk','ic','bl']],['Duels',['duw','aerw']],['Involvement',['ps']],['Territory',['opp']]];
 const DNA_RULES=[['Shooting',80,'Gets into shooting positions often'],['Creating',80,'Creates chances for others'],['Passing forward',80,'Moves the ball forward with passes'],
  ['Carrying',80,'Carries the ball forward and beats players'],['Defending',80,'Wins the ball back often'],['Duels',80,'Wins many duels'],
  ['Involvement',80,'Heavily involved on the ball'],['Territory',80,'Acts high up the pitch']];
 window.DNA_AXES=p=>DIMS.map(([l,ks])=>[ks[0],l]);
 const grp=p=>({DF:'defenders',MF:'midfielders',FW:'forwards'})[p]||'outfield players';
 /* the computation, separate from the drawing */
 window.dnaCalc=function(A,a){
  const {pos,list}=INS.peers(A,a,DNA_MIN),peers=list.filter(x=>x.id!==a.id);
  const ms=DIMS.map(([l,ks])=>{const items=ks.map(k=>{const M=INS.met(k);if(!M)return null;const f=q=>M[3](q,{}),v=f(a);return {k,l:M[1],v,p:INS.pct(peers,f,v),avg:INS.mean(peers.map(f))}}).filter(Boolean);
   const ps=items.map(x=>x.p).filter(x=>x!=null);return {l,items,p:ps.length?ps.reduce((s,x)=>s+x,0)/ps.length:null}});
  const desc=DNA_RULES.map(([d,th,txt])=>{const m=ms.find(x=>x.l===d);return m&&m.p!=null&&m.p>=th?{txt,m}:null}).filter(Boolean).sort((x,y)=>y.m.p-x.m.p);
  const low=ms.filter(m=>m.p!=null&&m.p<=20);
  return {pos,peers,ms,desc,low};
 };
 const or=R.player;
 R.player=async function(el,arg){
  const out=await or.apply(this,arguments);
  const pp=el.querySelector('#pp');if(!pp||pp.querySelector('.dna'))return out;
  const [key,club]=decodeURIComponent(arg||'').split('||');const st=(D.stats||[]).find(s=>s.key===key&&s.club===club&&s.player_id);if(!st)return out;
  const d=await INS.players();if(!d||!document.body.contains(pp))return out;
  const a=d.A.find(x=>x.id===st.player_id);if(!a)return out;
  const card=document.createElement('div');card.className='card dna ins';
  /* full width under the heat map (the radar card it replaces sat in a half-width column) */
  const old=pp.querySelector('.pp-rad'),two=pp.querySelector('.pp-two');if(old)old.remove();if(two){two.classList.add('solo');two.after(card)}else pp.appendChild(card);
  draw(card,d.A,a);return out;
 };
 function draw(card,A,a){
  if(a.gk){card.innerHTML='<h3>Player DNA</h3><div class="empty">No profile for goalkeepers: these are outfield measures.</div>';return}
  if(a.s.mi<DNA_MIN){card.innerHTML=`<h3>Player DNA</h3><div class="empty">Profile from ${DNA_MIN} minutes: ${Math.round(a.s.mi)} so far.</div>`;return}
  const C=dnaCalc(A,a);if(C.peers.length<5){card.innerHTML='<h3>Player DNA</h3><div class="empty">Too few players in his position to compare with yet.</div>';return}
  const g=grp(C.pos);let tab='dna',vs='';
  const head=`<h3>Player DNA <span class="mu">· <span>${esc(POS_LONG[C.pos]||'All outfield')}</span> · ${C.peers.length} <span>${g}</span>, ${DNA_MIN}+ <span>min</span>, <span>this season</span>, <span>per 90</span></span></h3>`;
  const body=()=>{
   if(tab==='pct')return INS.pctBars(C.ms.flatMap(m=>m.items.map(x=>({label:x.l,raw:INS.f(x.v),unit:'',pct:x.p}))))+`<p class="mu ins-note"><span>Left: his value per 90 (raw). Bar and number: his percentile in the group (50 = middle, 100 = the best).</span></p>`;
   if(tab==='vs'){const peer=vs&&A.find(x=>x.id===vs);
    const rows=C.ms.flatMap(m=>m.items).map(x=>{const M=INS.met(x.k),o=peer?M[3](peer,{}):x.avg;return `<li><span class="ins-pl">${esc(x.l)}</span><span class="dna-vb"><i class="a" style="width:${bw(x.v,o)[0]}%"></i><i class="b" style="width:${bw(x.v,o)[1]}%"></i></span><b>${INS.f(x.v)}</b><b class="mu">${INS.f(o)}</b></li>`}).join('');
    return `<div class="ctl"><select id="dnavs" aria-label="Compare with">${opts([['','Average of the group'],...C.peers.filter(x=>x.id!==a.id).sort((x,y)=>x.n.localeCompare(y.n)).map(x=>[x.id,x.n+' · '+x.club])],vs)}</select></div>
     <div class="ins-leg"><span><i></i>${esc(a.n)}</span><span><i class="b"></i>${esc(peer?peer.n:'Average of the group')}</span></div><ul class="dna-vs">${rows}</ul><p class="mu ins-note"><span>Raw values per 90 minutes, this season.</span></p>`}
   return `<div class="dna-g">${INS.radar({axes:C.ms.map(m=>m.l),series:[{name:a.n,vals:C.ms.map(m=>m.p),raw:C.ms.map(m=>m.items.map(x=>x.l+' '+INS.f(x.v)).join(', '))}],aria:'Player DNA'})}
    <div>${C.desc.length?`<ul class="dna-d">${C.desc.map(x=>`<li><b>${esc(x.txt)}</b><span class="mu"><span>${esc(x.m.l)}</span>: <span>better than ${Math.round(x.m.p)}% of the group</span> (${x.m.items.map(i=>`${esc(i.l)} ${INS.f(i.v)}${i.p==null?'':' · '+Math.round(i.p)}`).join('; ')})</span></li>`).join('')}</ul>`
     :'<p class="mu">No dimension reaches the 80th percentile of his group, so no description is given.</p>'}
    ${C.low.length?`<p class="mu dna-low"><span>Lowest in his group:</span> ${C.low.map(m=>`<span>${esc(m.l)}</span> (${Math.round(m.p)})`).join(', ')}</p>`:''}
    <p class="mu ins-note"><span>Each dimension is the mean percentile of its measures. A description needs the dimension at the 80th percentile or above.</span></p></div></div>`};
  const bw=(x,y)=>{const m=Math.max(1e-9,x||0,y||0);return [Math.round((x||0)/m*100),Math.round((y||0)/m*100)]};
  const paint=()=>{card.innerHTML=head+INS.tabs('dnatabs',[{k:'dna',t:'Profile'},{k:'pct',t:'Percentiles'},{k:'vs',t:'Compare'}],tab)+`<div id="dnab">${body()}</div>`;
   INS.wireTabs(card,'dnatabs',k=>{tab=k;card.querySelector('#dnab').innerHTML=body();wire()});wire()};
  const wire=()=>{const s=card.querySelector('#dnavs');if(s)s.onchange=e=>{vs=e.target.value;card.querySelector('#dnab').innerHTML=body();wire()}};
  paint();
 }
 INS.ar({"Player DNA":"بصمة اللاعب","All outfield":"كل لاعبي الميدان","defenders":"مدافع","midfielders":"لاعب وسط","forwards":"مهاجم","outfield players":"لاعب ميدان","this season":"هذا الموسم","per #":"لكل #",
  "Shooting":"التسديد","Creating":"صناعة الفرص","Passing forward":"التمرير للأمام","Carrying":"حمل الكرة","Defending":"الدفاع","Duels":"الالتحامات","Involvement":"المشاركة","Territory":"المنطقة",
  "Gets into shooting positions often":"يوصل لمواقع التسديد كثير","Creates chances for others":"يصنع فرص لزملائه","Moves the ball forward with passes":"يتقدم بالكرة بالتمرير",
  "Carries the ball forward and beats players":"يتقدم بالكرة ويتخطى اللاعبين","Wins the ball back often":"يستعيد الكرة كثير","Wins many duels":"يكسب التحامات كثيرة","Heavily involved on the ball":"مشارك كثير بالكرة","Acts high up the pitch":"يلعب في مناطق متقدمة",
  "No profile for goalkeepers: these are outfield measures.":"ما فيه بصمة للحراس: هذي مقاييس لاعبي الميدان.","Profile from # minutes: # so far.":"البصمة تظهر من # دقيقة: لعب # للحين.",
  "Too few players in his position to compare with yet.":"عدد اللاعبين في مركزه قليل للمقارنة للحين.","Percentiles":"النسب المئوية","Compare":"مقارنة","Compare with":"قارن مع",
  "Left: his value per # (raw). Bar and number: his percentile in the group (# = middle, # = the best).":"يسار: قيمته لكل # (خام). الشريط والرقم: نسبته المئوية في المجموعة (# = المنتصف، # = الأفضل).",
  "Average of the group":"متوسط المجموعة","Raw values per # minutes, this season.":"قيم خام لكل # دقيقة، هذا الموسم.","better than #% of the group":"أفضل من #٪ من المجموعة",
  "No dimension reaches the #th percentile of his group, so no description is given.":"ما فيه جانب يوصل للنسبة المئوية # في مجموعته، فما نعطي وصف.","Lowest in his group:":"الأقل في مجموعته:",
  "Each dimension is the mean percentile of its measures. A description needs the dimension at the #th percentile or above.":"كل جانب هو متوسط النسب المئوية لمقاييسه. الوصف يحتاج الجانب يكون في النسبة # أو أعلى."});
})();
