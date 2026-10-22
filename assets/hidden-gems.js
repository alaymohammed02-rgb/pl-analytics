/* ===== Hidden Gems (#/gems, in Players): strong numbers that goals and assists do not show =====
   Rule (the same for every player, shown on the page): within his reference group (same position as learnt by the sync, outfield
   players only, GM_MIN+ minutes and GM_APPS+ appearances), a player is a gem for the chosen measure when
     his percentile in that measure (per 90) is at least GM_TOP, and
     it is at least GM_GAP points above his percentile in goals + assists per 90 (what the scoreboard shows).
   The list is ranked by that gap, then by the measure. Every number is per 90 minutes of this season in this league, from
   PitchAPI's per-match player file. Goalkeepers are left out: these are outfield measures. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 const GM_TOP=70,GM_GAP=25,GA=a=>{const g=a.p90('gl'),s=a.p90('ast');return g==null||s==null?null:g+s};  /* each per 90 of the minutes that have it; missing is not 0 */
 const S={pos:'',team:'',met:'xag',min:450,apps:3,tab:'rank',sel:null};
 INS.addPage('gems','Hidden Gems','players','ratings');
 const mets=()=>(typeof MET!=='undefined'?MET:[]).filter(m=>['att','cre','pas','def','pos'].includes(m[2])&&!['gl','ast','fin'].includes(m[0]));
 R.gems=async function(el){
  el.innerHTML='<h2>Hidden Gems</h2><div id="gmroot" class="ins"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#gmroot'),lg=D.id;
  const [d]=await Promise.all([INS.players(),phLoad()]);if(!root.isConnected||D.id!==lg)return;
  if(!d){root.innerHTML='<div class="empty">No per-match player data for this league yet.</div>';return}
  const teams=[...new Set(d.A.map(a=>a.club))].sort();if(S.team&&!teams.includes(S.team)){S.team='';S.sel=null}  /* a club of another league */
  root.innerHTML=`<p class="mu ins-lead"><span>Players whose numbers stand out in their position while their goals and assists do not.</span> <span>Pick a measure: the list explains every pick.</span></p>
   <div class="ctl">${sel('gmmet','Measure',mets().map(m=>[m[0],m[1]]),S.met)}${sel('gmpos','Position',[['','All positions'],['DF','Defenders'],['MF','Midfielders'],['FW','Forwards']],S.pos)}
   ${sel('gmteam','Club',[['','All clubs'],...teams.map(t=>[t,t])],S.team)}${sel('gmmin','Minimum minutes',[[450,'450+ minutes'],[900,'900+ minutes'],[1350,'1350+ minutes']].map(x=>[String(x[0]),x[1]]),String(S.min))}
   ${sel('gmapps','Minimum appearances',[['3','3+ appearances'],['5','5+ appearances'],['8','8+ appearances']],String(S.apps))}</div>
   ${INS.tabs('gmtabs',[{k:'rank',t:'Ranking'},{k:'scatter',t:'Scatter'},{k:'profile',t:'Player profile'}],S.tab)}<div id="gmout"></div>
   <details class="ins-how"><summary>How a gem is picked</summary><p><span>Reference group: players of the same position (as learnt from PitchAPI's position numbers), outfield only, with the minimum minutes and appearances chosen above.</span> <span>A gem is at least in the 70th percentile of that group for the measure, and at least 25 percentile points higher there than in goals + assists per 90.</span> <span>Ranked by that gap. Percentiles are recomputed whenever a filter changes.</span> <span>Per 90 uses only the minutes of matches where PitchAPI has the value; a missing value is never read as zero.</span></p></details>`;
  ['gmmet','gmpos','gmteam','gmmin','gmapps'].forEach(id=>root.querySelector('#'+id).onchange=e=>{const v=e.target.value;({gmmet:()=>S.met=v,gmpos:()=>S.pos=v,gmteam:()=>S.team=v,gmmin:()=>S.min=+v,gmapps:()=>S.apps=+v})[id]();S.sel=null;draw()});
  INS.wireTabs(root,'gmtabs',k=>{S.tab=k;draw()});
  const draw=()=>{const R_=calc(d.A);root.querySelector('#gmout').innerHTML=S.tab==='scatter'?scatter(R_):S.tab==='profile'?profile(R_,d.A):rank(R_);
   root.querySelectorAll('[data-gsel]').forEach(b=>b.onclick=()=>{S.sel=b.dataset.gsel;S.tab='profile';root.querySelectorAll('#gmtabs button').forEach(x=>{const on=x.dataset.k==='profile';x.className=on?'':'s';x.setAttribute('aria-selected',on)});draw()});
   const ps=root.querySelector('#gmpick');if(ps)ps.onchange=e=>{S.sel=e.target.value;draw()}};
  draw();
 };
 const sel=(id,lab,o,v)=>`<select id="${id}" aria-label="${lab}">${opts(o,v)}</select>`;
 /* the computation, separate from the drawing */
 function calc(A){
  const M=INS.met(S.met),f=a=>M?M[3](a,{}):null;
  const elig=A.filter(a=>!a.gk&&a.p&&a.p!=='GK'&&a.s.mi>=S.min&&a.games>=S.apps);
  const groups={};elig.forEach(a=>(groups[a.p]=groups[a.p]||[]).push(a));
  const rows=elig.filter(a=>(!S.pos||a.p===S.pos)&&(!S.team||a.club===S.team)).map(a=>{const g=groups[a.p],v=f(a),ga=GA(a),pm=INS.pct(g,f,v),pv=INS.pct(g,GA,ga);
   return {a,v,ga,pm,pv,gap:pm!=null&&pv!=null?pm-pv:null,n:g.length}});
  const gems=rows.filter(r=>r.pm!=null&&r.gap!=null&&r.pm>=GM_TOP&&r.gap>=GM_GAP).sort((x,y)=>y.gap-x.gap||y.pm-x.pm);
  return {M,rows,gems,pool:elig.filter(a=>!S.pos||a.p===S.pos)};
 }
 const grp=p=>({DF:'defenders',MF:'midfielders',FW:'forwards'})[p]||'players';
 const why=(r,M)=>`<span><span>${esc(M[1])}</span>: ${INS.f(r.v)} — <span>better than ${Math.round(r.pm)}% of ${r.n} ${grp(r.a.p)}.</span></span> <span><span>Goals + assists per 90</span>: ${INS.f(r.ga)} — <span>better than ${Math.round(r.pv)}%.</span></span>`;
 function rank(C){
  if(!C.M)return '<div class="empty">Pick a measure.</div>';
  if(!C.gems.length)return `<div class="empty">No player meets the rule with these filters. Try a lower minimum or another measure.</div>`;
  const top=C.gems.slice(0,15);
  return `<div class="card"><h3>${esc(C.M[1])} <span class="mu">· <span>gems, ranked by the gap</span></span></h3>
   ${INS.hbars({rows:top.map(r=>({label:r.a.n,sub:r.a.club+' · '+r.a.p,v:r.v,href:r.a.href,tip:[r.a.n,C.M[1]+': '+INS.f(r.v),Math.round(r.pm)+' percentile','G+A per 90: '+INS.f(r.ga)+' ('+Math.round(r.pv)+' percentile)']}))})}</div>
   <ol class="gm-l">${top.map((r,i)=>`<li class="card"><div class="gm-h">${hAvatar(r.a.id,r.a.n,r.a.club)}<div><a href="${r.a.href}"><b>${esc(r.a.n)}</b></a><div class="mu">${esc(r.a.club)} · ${esc(POS_LONG[r.a.p]||r.a.p)} · ${Math.round(r.a.s.mi)} <span>min</span> · ${r.a.games} <span>apps</span></div></div>
    <span class="gm-gap"${INS.tipAttr(['Gap','measure percentile − goals+assists percentile'])}>+${Math.round(r.gap)}</span></div><p class="gm-why">${why(r,C.M)}</p><button type="button" class="s" data-gsel="${esc(r.a.id)}">Profile →</button></li>`).join('')}</ol>`;
 }
 function scatter(C){
  if(!C.M)return '';const gem=new Set(C.gems.slice(0,15).map(r=>r.a.id));
  const pts=C.rows.filter(r=>r.v!=null&&r.ga!=null).map(r=>({x:r.v,y:r.ga,label:r.a.n,cls:gem.has(r.a.id)?'hi':'',href:r.a.href,tip:[r.a.n,r.a.club,C.M[1]+': '+INS.f(r.v),'G+A per 90: '+INS.f(r.ga),gem.has(r.a.id)?'Hidden gem':'']}));
  return `<div class="card"><h3><span>${esc(C.M[1])}</span> <span>against goals + assists per 90</span></h3>${INS.scatter({pts,xl:C.M[1],yl:'Goals + assists per 90',aria:'Scatter'})}
   <p class="mu ins-note"><span>Each dot is a player; the highlighted ones are the gems.</span> <span>Grey lines: the middle of the field.</span> <span>Bottom right = strong in the measure, little on the scoreboard.</span></p></div>`;
 }
 function profile(C,A){
  const L=C.gems.length?C.gems:C.rows.filter(r=>r.pm!=null).sort((x,y)=>y.pm-x.pm).slice(0,30);if(!L.length)return '<div class="empty">No player to show with these filters.</div>';
  const r=L.find(x=>x.a.id===S.sel)||L[0];S.sel=r.a.id;
  const peers=INS.peers(A,r.a,S.min).list,keys=(typeof DNA_AXES!=='undefined'?DNA_AXES(r.a.p):null)||[['npxg','Shooting'],['xag','Creating'],['pr','Passing'],['pc','Carrying'],['tk','Defending'],['duw','Duels']];
  const ax=keys.map(([k,l])=>{const M=INS.met(k);if(!M)return null;const v=M[3](r.a,{});return {l,v,p:INS.pct(peers,q=>M[3](q,{}),v),u:M[1]}}).filter(Boolean);
  return `<div class="card"><div class="ctl"><select id="gmpick" aria-label="Player">${opts(L.map(x=>[x.a.id,x.a.n+' · '+x.a.club]),r.a.id)}</select><a class="s gm-go" href="${r.a.href}">Player page →</a></div>
   <div class="gm-prof">${INS.radar({axes:ax.map(x=>x.l),series:[{name:r.a.n,vals:ax.map(x=>x.p),raw:ax.map(x=>x.u+' '+INS.f(x.v))}],aria:'Profile'})}
   <div><p class="gm-why">${why(r,C.M)}</p>${INS.pctBars(ax.map(x=>({label:x.u,raw:INS.f(x.v),unit:'',pct:x.p})))}
   <p class="mu ins-note"><span>Percentile among</span> ${peers.length} ${esc(grp(r.a.p))} <span>with the same minimum minutes, this season.</span></p></div></div></div>`;
 }
 INS.ar({"Hidden Gems":"الجواهر المخفية","Players whose numbers stand out in their position while their goals and assists do not.":"لاعبين أرقامهم بارزة في مركزهم بينما أهدافهم وتمريراتهم الحاسمة ما تبيّن هذا.",
  "Pick a measure: the list explains every pick.":"اختر مقياس: القائمة تشرح سبب كل اختيار.","Measure":"المقياس","Club":"النادي","All clubs":"كل الأندية","Minimum minutes":"أقل عدد دقائق","Minimum appearances":"أقل عدد مشاركات",
  "#+ minutes":"#+ دقيقة","#+ appearances":"#+ مشاركات","Ranking":"الترتيب","Scatter":"مخطط التشتت","Player profile":"ملف اللاعب","How a gem is picked":"كيف نختار الجوهرة",
  "Reference group: players of the same position (as learnt from PitchAPI's position numbers), outfield only, with the minimum minutes and appearances chosen above.":"المجموعة المرجعية: لاعبين بنفس المركز (من أرقام المراكز في PitchAPI)، لاعبي ميدان فقط، بالحد الأدنى للدقائق والمشاركات المختار فوق.",
  "A gem is at least in the #th percentile of that group for the measure, and at least # percentile points higher there than in goals + assists per #.":"الجوهرة لازم تكون في النسبة المئوية # أو أعلى في المقياس، وأعلى بـ# نقطة على الأقل من نسبتها في الأهداف + التمريرات الحاسمة لكل #.",
  "Ranked by that gap. Percentiles are recomputed whenever a filter changes.":"مرتبين حسب هذا الفرق. النسب المئوية تنحسب من جديد مع كل تغيير في الفلاتر.",
  "Per # uses only the minutes of matches where PitchAPI has the value; a missing value is never read as zero.":"لكل # تنحسب فقط من دقائق المباريات اللي فيها قيمة من PitchAPI؛ القيمة المفقودة ما تنحسب صفر أبدًا.",
  "No per-match player data for this league yet.":"ما فيه بيانات لاعبين لكل مباراة لهذا الدوري للحين.","Pick a measure.":"اختر مقياس.",
  "No player meets the rule with these filters. Try a lower minimum or another measure.":"ما فيه لاعب يحقق الشرط بهذي الفلاتر. جرّب حد أقل أو مقياس ثاني.",
  "gems, ranked by the gap":"الجواهر مرتبة حسب الفرق","apps":"مشاركات","Gap":"الفرق","measure percentile − goals+assists percentile":"نسبة المقياس − نسبة الأهداف والتمريرات الحاسمة","Profile →":"الملف ←",
  "better than #% of # defenders.":"أفضل من #٪ من # مدافع.","better than #% of # midfielders.":"أفضل من #٪ من # لاعب وسط.","better than #% of # forwards.":"أفضل من #٪ من # مهاجم.","better than #%.":"أفضل من #٪.",
  "against goals + assists per #":"مقابل الأهداف + التمريرات الحاسمة لكل #","Goals + assists per #":"الأهداف + التمريرات الحاسمة لكل #","Hidden gem":"جوهرة مخفية",
  "Each dot is a player; the highlighted ones are the gems.":"كل نقطة لاعب؛ المميّزة هي الجواهر.","Grey lines: the middle of the field.":"الخطوط الرمادية: منتصف المجموعة.",
  "Bottom right = strong in the measure, little on the scoreboard.":"تحت يمين = قوي في المقياس، وقليل في الأهداف والتمريرات.","No player to show with these filters.":"ما فيه لاعب نعرضه بهذي الفلاتر.","Player":"اللاعب","Player page →":"صفحة اللاعب ←",
  "Percentile among":"النسبة المئوية بين","with the same minimum minutes, this season.":"بنفس الحد الأدنى للدقائق، هذا الموسم.","Profile":"الملف","players":"لاعب"});
})();
