/* ===== Two new pages: season ratings, and first half against second half =====
   Ratings (#/ratings, in Players): the average PitchAPI match rating of every player this season (data/<league>_rt.json),
   with a minimum of rated matches, by position (the positions the sync learnt), and his last 3 rated matches against his average.
   Halves (#/halves, in Analysis):
   - clubs: xG and goals in the first and the second half, and points won from losing positions / lost from winning
     positions, from the shot file (goal times; own goals for the other side). A match whose goals in the shot file do not add up
     to its score is left out of the comebacks rather than guessed.
   - players: PitchAPI's per-half stats (matches.players_halves, data/<league>_hv.json), only matches where he played both halves:
     who does less after the break, and who does more. */
(function(){
 if(typeof R!=='object'||typeof PAGES==='undefined')return;
 const add=(k,n,sec,after)=>{if(!PAGES.some(p=>p[0]===k)){const i=PAGES.findIndex(p=>p[0]===after);PAGES.splice(i>=0?i+1:PAGES.length,0,[k,n])}
  if(typeof UI_SEC!=='undefined'){const s=UI_SEC.find(x=>x.k===sec);if(s&&!s.p.includes(k)){const i=s.p.indexOf(after);s.p.splice(i>=0?i+1:s.p.length,0,k)}}};
 add('ratings','Ratings','players','rankings');add('halves','Halves','analysis','heatmaps');
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)',f2=v=>v==null?'N/A':(+v).toFixed(2);
 const RT={pos:'',min:3,sort:'avg'};
 /* ---------------- ratings ---------------- */
 R.ratings=async function(el){
  el.innerHTML='<h2>Ratings</h2><div id="rtroot"><div class="empty skel">Loading…</div></div>';
  const [rt,P]=await Promise.all([rtLoad(),loadPl().catch(()=>null),phLoad()]);const root=document.getElementById('rtroot');if(!root)return;
  if(!rt||!rt.m||!Object.keys(rt.m).length){root.innerHTML='<div class="empty">No PitchAPI ratings for this league yet. The sync fetches them match by match.</div>';return}
  const ix=P&&P.ix,dates=new Map(D.matches.map(m=>[m.match_id,m.date])),A=new Map();
  const meta=new Map();if(P)P.rows.forEach(r=>{const k=r[ix.m]+'|'+r[ix.i];meta.set(k,{n:r[ix.n],c:r[ix.c],o:r[ix.o],mi:r[ix.mi]})});
  Object.entries(rt.m).forEach(([mid,R_])=>Object.entries(R_).forEach(([pid,v])=>{if(typeof v!=='number')return;const mt=meta.get(mid+'|'+pid);if(!mt)return;
   const o=A.get(pid)||{id:pid,n:mt.n,club:{},pos:{},L:[]};o.club[mt.c]=(o.club[mt.c]||0)+1;if(mt.o)o.pos[mt.o]=(o.pos[mt.o]||0)+(mt.mi||0);o.L.push({d:dates.get(mid)||'',v,mid});A.set(pid,o)}));
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0];
  const all=[...A.values()].map(o=>{o.L.sort((a,b)=>String(a.d).localeCompare(String(b.d)));const s=o.L.reduce((a,x)=>a+x.v,0);const l3=o.L.slice(-3);
   return {...o,c:(top(o.club)||[''])[0],p:(top(o.pos)||[null])[0],n_:o.L.length,avg:s/o.L.length,best:Math.max(...o.L.map(x=>x.v)),l3:l3.reduce((a,x)=>a+x.v,0)/l3.length}});
  const keyOf=new Map();(D.stats||[]).forEach(s=>{if(s.player_id)keyOf.set(s.player_id+'|'+s.club,s.key)});
  const draw=()=>{
   const L=all.filter(o=>o.n_>=RT.min&&(!RT.pos||o.p===RT.pos)).sort((a,b)=>RT.sort==='form'?(b.l3-b.avg)-(a.l3-a.avg):RT.sort==='best'?b.best-a.best:b.avg-a.avg||b.n_-a.n_).slice(0,100);
   root.querySelector('#rtout').innerHTML=L.length?`<div class="wrap"><table class="rt-t"><tr><th>#</th><th>Player</th><th>Pos</th><th class="n">Rated</th><th class="n">Average</th><th class="n">Best</th><th class="n">Last 3</th></tr>
    ${L.map((o,i)=>{const k=keyOf.get(o.id+'|'+o.c)||o.id,d=o.l3-o.avg;return `<tr><td class="mu">${i+1}</td><td><a class="rt-pl" href="#/player/${encodeURIComponent(k+'||'+o.c)}">${hAvatar(o.id,o.n,o.c)}<span><b>${esc(o.n)}</b><span class="mu">${esc(o.c)}</span></span></a></td><td>${esc(o.p||'–')}</td>
     <td class="n">${o.n_}</td><td class="n"><i class="rt-c" style="background:${rc(o.avg)}">${o.avg.toFixed(2)}</i></td><td class="n">${o.best.toFixed(1)}</td><td class="n">${o.l3.toFixed(2)} <span class="${d>=.15?'rt-up':d<=-.15?'rt-dn':'mu'}">${d>=.15?'▲':d<=-.15?'▼':'·'}</span></td></tr>`}).join('')}</table></div>`
    :'<div class="empty">No player has that many rated matches yet.</div>';
   root.querySelector('#rtn').textContent=String(L.length)};
  root.innerHTML=`<div class="ctl"><select id="rtpos" aria-label="Position">${opts([['','All positions'],['GK','Goalkeepers'],['DF','Defenders'],['MF','Midfielders'],['FW','Forwards']],RT.pos)}</select>
   <select id="rtmin" aria-label="Minimum rated matches">${opts([['1','1+ rated matches'],['3','3+ rated matches'],['5','5+ rated matches'],['8','8+ rated matches']],String(RT.min))}</select>
   <select id="rtsort" aria-label="Sort">${opts([['avg','Highest average'],['form','Best form (last 3 against average)'],['best','Best single match']],RT.sort)}</select></div>
   <p class="mu rt-note"><span>Average PitchAPI match rating this season</span> · <span id="rtn"></span> <span>players</span> · <span>${Object.keys(rt.m).length} of ${D.matches.filter(m=>wkSc(m.score)).length} matches rated so far</span>. <span>▲ / ▼: his last 3 rated matches are at least 0.15 above / below his average.</span></p><div id="rtout"></div>`;
  $('#rtpos').onchange=e=>{RT.pos=e.target.value;draw()};$('#rtmin').onchange=e=>{RT.min=+e.target.value;draw()};$('#rtsort').onchange=e=>{RT.sort=e.target.value;draw()};draw();
 };
 /* ---------------- halves ---------------- */
 const HV={pk:'tc',min:4},HV_FULL=44;
 R.halves=async function(el){
  el.innerHTML='<h2>First half vs second half</h2><div id="hvroot"><div class="empty skel">Loading…</div></div>';
  const [sh,hv]=await Promise.all([loadSh().catch(()=>null),hvLoad()]);const root=document.getElementById('hvroot');if(!root)return;
  root.innerHTML=hvClubs(sh)+hvPlayers(hv);
  const s=root.querySelector('#hvpk');if(s)s.onchange=e=>{HV.pk=e.target.value;root.querySelector('#hvpl').outerHTML=hvPlTable(hv)};
 };
 function hvClubs(sh){
  if(!sh||!sh.rows.length)return '<div class="card"><h3>Clubs</h3><div class="empty">No shot data for this league.</div></div>';
  const T=new Map(),get=t=>{let o=T.get(t);if(!o){o={t,n:0,x1:0,x2:0,a1:0,a2:0,g1:0,g2:0,c1:0,c2:0,cb:0,lost:0,trail:0,lead:0};T.set(t,o)}return o};
  const by=new Map();sh.rows.forEach(r=>{if(r.pd==='PenaltyShootout')return;(by.get(r.m)||by.set(r.m,[]).get(r.m)).push(r)});
  D.matches.filter(m=>wkSc(m.score)).forEach(m=>{const rows=by.get(m.match_id);if(!rows)return;
   /* the shot's team may be a name or a team id: INS.sideFn resolves both; a match none of whose shots get a side is left out, not read as 0 xG */
   const sd=typeof INS==='object'&&INS.sideFn?INS.sideFn(rows,m):(r=>r.c===m.home?'h':r.c===m.away?'a':null);
   const side=r=>{const s=sd(r);return s&&r.og?(s==='h'?'a':'h'):s};
   if(!rows.some(side))return;const g=wkSc(m.score),H=get(m.home),A=get(m.away);H.n++;A.n++;
   rows.forEach(r=>{const s=side(r);if(!s)return;const half=r.pd==='FirstHalf'?1:2,me=s==='h'?H:A,op=s==='h'?A:H;
    if(!r.og){me['x'+half]+=r.xg||0;op['a'+half]+=r.xg||0}if(r.ev==='Goal'||r.og){me['g'+half]++;op['c'+half]++}});
   /* comebacks: replay the goals in time order (only when they add up to the score) */
   const gl=rows.filter(r=>(r.ev==='Goal'||r.og)&&side(r)).sort((a,b)=>(a.mn+(a.ma||0)/100)-(b.mn+(b.ma||0)/100));
   if(gl.filter(r=>side(r)==='h').length!==g[0]||gl.filter(r=>side(r)==='a').length!==g[1])return;
   let h=0,a=0,hT=false,aT=false,hL=false,aL=false;gl.forEach(r=>{side(r)==='h'?h++:a++;if(h<a){hT=true;aL=true}if(a<h){aT=true;hL=true}});
   const pts=(f,x)=>f>x?3:f===x?1:0;
   if(hT){H.trail++;H.cb+=pts(g[0],g[1])}if(aT){A.trail++;A.cb+=pts(g[1],g[0])}if(hL){H.lead++;H.lost+=3-pts(g[0],g[1])}if(aL){A.lead++;A.lost+=3-pts(g[1],g[0])}});
  const L=[...T.values()].filter(o=>o.n>0).sort((a,b)=>(b.x2-b.x1)/b.n-(a.x2-a.x1)/a.n);
  const pm=(v,n)=>(v/n).toFixed(2);
  return `<div class="card"><h3>Clubs</h3><div class="wrap"><table class="hv-t"><tr><th>Club</th><th class="n">Matches</th><th class="n">xG 1st</th><th class="n">xG 2nd</th><th class="n">xGA 1st</th><th class="n">xGA 2nd</th><th class="n">Goals 1st–2nd</th><th class="n">Points won after trailing</th><th class="n">Points dropped after leading</th></tr>
   ${L.map(o=>`<tr><td><a class="clk" href="#/club/${encodeURIComponent(o.t)}">${hCrest(o.t)}${esc(o.t)}</a></td><td class="n">${o.n}</td><td class="n">${pm(o.x1,o.n)}</td><td class="n ${o.x2>o.x1?'hv-up':''}">${pm(o.x2,o.n)}</td><td class="n">${pm(o.a1,o.n)}</td><td class="n">${pm(o.a2,o.n)}</td><td class="n">${o.g1}–${o.g2}</td>
    <td class="n">${o.trail?`<b>${o.cb}</b> <span class="mu">(${o.trail})</span>`:'–'}</td><td class="n">${o.lead?`<b>${o.lost}</b> <span class="mu">(${o.lead})</span>`:'–'}</td></tr>`).join('')}</table></div>
   <p class="mu mc-note"><span>xG and xG against per match, by half; sorted by how much more xG a club makes after the break.</span> <span>In brackets: matches in which the club trailed / led at some point.</span> <span>From the shot file; a match whose goals there do not add up to the score is left out of the last two columns.</span></p></div>`;
 }
 const PK={tc:'Touches',xg:'xG',sh:'Shots',pa:'Accurate passes',dw:'Duels won',rc:'Recoveries',dr:'Successful dribbles',km:'Distance'};
 function hvAgg(hv){
  const A=new Map(),names=new Map(),club=new Map();(D.stats||[]).forEach(s=>{if(s.player_id){names.set(s.player_id,s.player);club.set(s.player_id,s.club);}});
  /* only halves he played in full (PitchAPI's minutes per half): a player taken off at 60 minutes would otherwise look as if he faded */
  Object.values(hv.m||{}).forEach(M=>{const i=(M.c||[]).indexOf(HV.pk),j=(M.c||[]).indexOf('mi');if(i<0||j<0)return;Object.entries(M.p||{}).forEach(([pid,v])=>{const a=v[1],b=v[2];if(!a||!b||a[i]==null||b[i]==null||!(a[j]>=HV_FULL)||!(b[j]>=HV_FULL))return;
   const o=A.get(pid)||{id:pid,n:names.get(pid)||pid,c:club.get(pid)||'',m:0,s1:0,s2:0};o.m++;o.s1+=a[i];o.s2+=b[i];A.set(pid,o)})});
  return [...A.values()].filter(o=>o.m>=HV.min&&o.s1+o.s2>0).map(o=>({...o,d:(o.s2-o.s1)/Math.max(1e-9,(o.s1+o.s2)/2)}));
 }
 function hvPlTable(hv){
  const L=hvAgg(hv);if(!L.length)return `<div id="hvpl" class="empty">No player has ${HV.min}+ matches with both halves for this measure yet.</div>`;
  const keyOf=new Map();(D.stats||[]).forEach(s=>{if(s.player_id)keyOf.set(s.player_id,s.key)});
  const row=o=>`<li><a href="#/player/${encodeURIComponent((keyOf.get(o.id)||o.id)+'||'+o.c)}">${esc(o.n)}</a><span class="mu">${esc(o.c)}</span><span class="hv-v">${f2(o.s1/o.m)} → ${f2(o.s2/o.m)}</span><b class="${o.d<0?'rt-dn':'rt-up'}">${o.d>0?'+':''}${Math.round(o.d*100)}%</b></li>`;
  const dn=[...L].sort((a,b)=>a.d-b.d).slice(0,10),up=[...L].sort((a,b)=>b.d-a.d).slice(0,10);
  return `<div id="hvpl" class="clx-g"><div><h4>Does less after the break</h4><ol class="hv-l">${dn.map(row).join('')}</ol></div><div><h4>Does more after the break</h4><ol class="hv-l">${up.map(row).join('')}</ol></div></div>`;
 }
 function hvPlayers(hv){
  if(hv&&hv.m&&!Object.values(hv.m).some(M=>(M.c||[]).includes('mi')))return '<div class="card"><h3>Players</h3><div class="empty">The sync is fetching PitchAPI\'s minutes per half, needed to compare full halves only. This part fills in as they arrive.</div></div>';
  if(!hv||!hv.m||!Object.keys(hv.m).length)return '<div class="card"><h3>Players</h3><div class="empty">PitchAPI\'s per-half player stats are being fetched by the sync, match by match. This part fills in as they arrive.</div></div>';
  const codes=[...new Set(Object.values(hv.m).flatMap(M=>M.c||[]))].filter(c=>c!=='mi');if(!codes.includes(HV.pk))HV.pk=codes[0];
  return `<div class="card"><h3>Players</h3><div class="ctl"><select id="hvpk" aria-label="Measure">${opts(codes.map(c=>[c,PK[c]||c]),HV.pk)}</select></div>${hvPlTable(hv)}
   <p class="mu mc-note"><span>Average per half, only matches in which he played both halves in full (${HV.min}+ such matches).</span> <span>The percentage is the second half against the first.</span> <span>From PitchAPI's per-half stats:</span> ${Object.keys(hv.m).length} <span>matches so far.</span></p></div>`;
 }
 if(typeof AR==='object')Object.entries({
  "Ratings":"التقييمات","Halves":"الشوطين","No PitchAPI ratings for this league yet. The sync fetches them match by match.":"ما فيه تقييمات PitchAPI لهذا الدوري للحين. المزامنة تجيبها مباراة مباراة.",
  "Rated":"مقيّمة","Average":"المتوسط","Best":"الأفضل","Last #":"آخر #","No player has that many rated matches yet.":"ما فيه لاعب عنده هالعدد من المباريات المقيّمة للحين.",
  "All positions":"كل المراكز","#+ rated matches":"#+ مباريات مقيّمة",
  "Highest average":"أعلى متوسط","Best form (last # against average)":"أفضل مستوى (آخر # مقابل المتوسط)","Best single match":"أفضل مباراة وحدة",
  "Average PitchAPI match rating this season":"متوسط تقييم PitchAPI للمباراة هذا الموسم","players":"لاعب","# of # matches rated so far":"# من # مباريات انقيّمت للحين",
  "▲ / ▼: his last # rated matches are at least # above / below his average.":"▲ / ▼: آخر # مباريات مقيّمة له أعلى / أقل من متوسطه بـ# على الأقل.",
  "First half vs second half":"الشوط الأول ضد الثاني","Clubs":"الأندية","No shot data for this league.":"ما فيه بيانات تسديدات لهذا الدوري.",
  "xG #st":"xG الشوط #","xG #nd":"xG الشوط #","xGA #st":"xG عليه، الشوط #","xGA #nd":"xG عليه، الشوط #","Goals #st–#nd":"الأهداف: الشوط #–#","Points won after trailing":"نقاط كسبها بعد ما كان متأخر","Points dropped after leading":"نقاط ضيّعها بعد ما كان متقدم",
  "xG and xG against per match, by half; sorted by how much more xG a club makes after the break.":"xG له وعليه لكل مباراة حسب الشوط؛ مرتبة حسب كم يزيد xG النادي بعد الاستراحة.",
  "In brackets: matches in which the club trailed / led at some point.":"بين القوسين: المباريات اللي كان فيها النادي متأخر / متقدم في وقت منها.",
  "From the shot file; a match whose goals there do not add up to the score is left out of the last two columns.":"من ملف التسديدات؛ المباراة اللي أهدافها هناك ما تطابق النتيجة ما تنحسب في آخر عمودين.",
  "Players":"اللاعبين","Does less after the break":"يقل بعد الاستراحة","Does more after the break":"يزيد بعد الاستراحة",
  "No player has #+ matches with both halves for this measure yet.":"ما فيه لاعب عنده #+ مباريات لعب فيها الشوطين لهذا المقياس للحين.",
  "PitchAPI's per-half player stats are being fetched by the sync, match by match. This part fills in as they arrive.":"المزامنة تجيب إحصائيات PitchAPI لكل شوط مباراة مباراة. هذا الجزء يكتمل أول ما توصل.",
  "Average per half, only matches in which he played both halves in full (#+ such matches).":"المتوسط لكل شوط، فقط المباريات اللي لعب فيها الشوطين كاملين (#+ مباريات).",
  "The percentage is the second half against the first.":"النسبة هي الشوط الثاني مقابل الأول.","From PitchAPI's per-half stats:":"من إحصائيات PitchAPI لكل شوط:","matches so far.":"مباراة للحين.",
  "The sync is fetching PitchAPI's minutes per half, needed to compare full halves only. This part fills in as they arrive.":"المزامنة تجيب دقائق كل شوط من PitchAPI، نحتاجها عشان نقارن الأشواط الكاملة بس. هذا الجزء يكتمل أول ما توصل.","Touches":"اللمسات","Shots":"التسديدات","Accurate passes":"التمريرات الدقيقة","Duels won":"الالتحامات المكسوبة","Recoveries":"الاستعادات","Successful dribbles":"المراوغات الناجحة","Distance":"المسافة"
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
