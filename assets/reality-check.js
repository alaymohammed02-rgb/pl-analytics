/* ===== Reality Check (#/reality, in Analysis): goals against xG for clubs, players and matches =====
   xG (PitchAPI, per shot) is the chance that a shot like that one is scored: an estimate of chance quality, not a forecast of
   the result. Goals come from the results (clubs) and from the shot file (players and the match list); own goals count for the
   other side and have no xG; penalty shoot-outs are left out. The page only says "scored more / fewer than xG"; it never calls a
   club lucky or a player a poor finisher. Filters: club and period (whole season, last 10, last 5 matches of each club).
   Only this season of this league is in the data, so there is no season filter. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('reality','Reality Check','analysis','shots');
 const S={team:'',per:'all',tab:'teams',side:'for',mid:''};
 const sgn=v=>v==null?'N/A':(v>0?'+':'')+(+v).toFixed(2);
 R.reality=async function(el){
  el.innerHTML='<h2>Reality Check</h2><div id="rcroot" class="ins"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#rcroot'),lg=D.id;
  const [T,sh,d]=await Promise.all([INS.teams(),loadSh().catch(()=>null),INS.players()]);if(!root.isConnected||D.id!==lg)return;  /* left the page, or another league opened meanwhile */
  if(!sh||!sh.rows.length){root.innerHTML='<div class="empty">No shot data for this league, so there is no xG to compare with.</div>';return}
  const clubs=T.map(t=>t.t).sort();if(S.team&&!clubs.includes(S.team)){S.team='';S.mid=''}  /* a club of another league */
  root.innerHTML=`<p class="mu ins-lead"><span>xG is the chance that a shot of that quality is scored: an estimate of how good the chances were, not a forecast.</span> <span>Over a few matches goals and xG often differ; the gap tends to shrink over a season.</span></p>
   <div class="ctl"><select id="rcteam" aria-label="Club">${opts([['','All clubs'],...clubs.map(t=>[t,t])],S.team)}</select><select id="rcper" aria-label="Period">${opts([['all','Whole season'],['10','Last 10 matches'],['5','Last 5 matches']],S.per)}</select></div>
   ${INS.tabs('rctabs',[{k:'teams',t:'Clubs'},{k:'players',t:'Players'},{k:'matches',t:'Matches'}],S.tab)}<div id="rcout"></div>`;
  root.querySelector('#rcteam').onchange=e=>{S.team=e.target.value;S.mid='';draw()};root.querySelector('#rcper').onchange=e=>{S.per=e.target.value;draw()};
  INS.wireTabs(root,'rctabs',k=>{S.tab=k;draw()});
  const draw=()=>{const out=root.querySelector('#rcout');out.innerHTML=S.tab==='players'?players(T,d,sh):S.tab==='matches'?matches(T,sh):teams(T);
   const sd=out.querySelector('#rcside');if(sd)sd.onchange=e=>{S.side=e.target.value;draw()};
   const sm=out.querySelector('#rcmid');if(sm)sm.onchange=e=>{S.mid=e.target.value;draw()};
   out.querySelectorAll('[data-rcm]').forEach(b=>b.onclick=()=>{S.mid=b.dataset.rcm;draw();const m=out.querySelector('#rcmap');if(m)m.scrollIntoView({block:'nearest'})})};
  draw();
 };
 /* the computation: a club's matches in the chosen period, and its totals */
 const games=t=>{const g=t.games.filter(x=>x.xg!=null);return S.per==='all'?g:g.slice(-(+S.per))};
 function tot(t){const g=games(t),s=k=>g.reduce((a,x)=>a+(x[k]||0),0);return {t:t.t,n:g.length,gf:s('gf'),xg:s('xg'),ga:s('ga'),xga:s('xga'),np:s('npxg'),g}}
 function teams(T){
  const L=T.map(tot).filter(x=>x.n>0),me=S.team&&L.find(x=>x.t===S.team);
  const side=S.side==='against',k1=side?'ga':'gf',k2=side?'xga':'xg';
  const kp=me?`<div class="grid rc-k">${[[me.gf,'Goals'],[INS.f(me.xg),'xG'],[sgn(me.gf-me.xg),'Goals − xG'],[me.ga,'Goals against'],[INS.f(me.xga),'xG against'],[sgn(me.ga-me.xga),'Goals against − xG against']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div>
   <p class="rc-say">${say(me)}</p>`:'';
  const pts=L.map(x=>({x:x[k2],y:x[k1],label:x.t,cls:me&&x.t===me.t?'hi':'',href:'#/club/'+encodeURIComponent(x.t),tip:[x.t,(side?'Goals against':'Goals')+': '+x[k1],(side?'xG against':'xG')+': '+INS.f(x[k2]),'Difference: '+sgn(x[k1]-x[k2]),x.n+' matches']}));
  const bars=[...L].sort((a,b)=>(b[k1]-b[k2])-(a[k1]-a[k2])).map(x=>({label:x.t,v:x[k1]-x[k2],cls:me&&x.t===me.t?'hi':'',href:'#/club/'+encodeURIComponent(x.t),tip:[x.t,(side?'Conceded ':'Scored ')+x[k1]+' · xG '+INS.f(x[k2]),'Difference: '+sgn(x[k1]-x[k2]),x.n+' matches']}));
  const trend=me?INS.line({series:[{name:'Goals (cumulative)',pts:cum(me.g,'gf')},{name:'xG (cumulative)',cls:'b',pts:cum(me.g,'xg')}],xl:'match by match →',aria:'Goals and xG over the matches'}):'';
  return kp+`<div class="ctl"><select id="rcside" aria-label="Side">${opts([['for','Scored: goals against xG'],['against','Conceded: goals against xG against']],S.side)}</select></div>
   <div class="rc-two"><div class="card"><h3>${side?'Conceded against xG against':'Goals against xG'}</h3>${INS.scatter({pts,xl:side?'xG against':'xG',yl:side?'Goals against':'Goals',diag:true,aria:'Goals and xG'})}<p class="mu ins-note"><span>Above the diagonal: more goals than xG; below: fewer.</span></p></div>
   <div class="card"><h3>${side?'Goals against − xG against':'Goals − xG'}</h3>${INS.hbars({rows:bars,fmt:sgn})}</div></div>
   ${me?`<div class="card"><h3>${esc(me.t)}: <span>goals and xG over the matches</span></h3>${trend}</div>`:''}`;
 }
 const cum=(g,k)=>{let s=0;return g.map(x=>{s+=x[k]||0;return {y:s,tip:[x.m.date.slice(0,10)+' · '+(x.home?'':'@ ')+x.opp,x.gf+'–'+x.ga,'xG '+INS.f(x.xg)+' – '+INS.f(x.xga),(k==='gf'?'Goals so far: ':'xG so far: ')+INS.f(s)]}})};
 function say(x){const d=x.gf-x.xg,a=x.ga-x.xga,r=v=>Math.abs(v)<.5?'about as many as':v>0?'more than':'fewer than';
  return `<span>${esc(x.t)} <span>scored ${x.gf} from ${INS.f(x.xg)} xG: ${r(d)} the chances were worth.</span></span> <span><span>They conceded ${x.ga} from ${INS.f(x.xga)} xG against: ${r(a)} the chances against were worth.</span></span> <span class="mu">${x.n} <span>matches</span>.</span>`}
 function players(T,d,sh){
  if(!d)return '<div class="empty">No per-match player data for this league yet.</div>';
  const ok=new Set(T.flatMap(t=>games(t).map(g=>g.m.match_id))),A=new Map(),mm=new Map(D.matches.map(m=>[m.match_id,m])),by=new Map();
  sh.rows.forEach(r=>{if(ok.has(r.m))(by.get(r.m)||by.set(r.m,[]).get(r.m)).push(r)});
  by.forEach((rows,mid)=>{const m=mm.get(mid),sd=INS.sideFn(rows,m);rows.forEach(r=>{if(r.og||r.pd==='PenaltyShootout')return;const s=sd(r);if(!s)return;const c=s==='h'?m.home:m.away;if(S.team&&c!==S.team)return;const o=A.get(r.pid)||{id:r.pid,n:r.pn,c,sh:0,xg:0,g:0};o.sh++;o.xg+=r.xg||0;if(r.ev==='Goal')o.g++;A.set(r.pid,o)})});
  const L=[...A.values()].filter(o=>o.sh>=(S.team?3:8)),href=new Map(d.A.map(a=>[a.id,a.href]));
  if(!L.length)return '<div class="empty">No player has enough shots in this period.</div>';
  const pts=L.map(o=>({x:o.xg,y:o.g,label:o.n,cls:Math.abs(o.g-o.xg)>=2?'hi':'',href:href.get(o.id),tip:[o.n,o.c,'Goals '+o.g+' · xG '+INS.f(o.xg),'Difference '+sgn(o.g-o.xg),o.sh+' shots']}));
  const top=[...L].sort((a,b)=>(b.g-b.xg)-(a.g-a.xg)),bars=[...top.slice(0,8),...top.slice(-8).filter(x=>!top.slice(0,8).includes(x))].map(o=>({label:o.n,sub:o.c,v:o.g-o.xg,href:href.get(o.id),tip:[o.n,'Goals '+o.g+' · xG '+INS.f(o.xg),o.sh+' shots']}));
  return `<div class="rc-two"><div class="card"><h3>Goals against xG <span class="mu">· ${S.team?esc(S.team)+', ':''}${S.team?3:8}+ <span>shots</span></span></h3>${INS.scatter({pts,xl:'xG',yl:'Goals',diag:true,aria:'Players: goals and xG'})}
   <p class="mu ins-note"><span>Highlighted: a gap of 2 goals or more.</span> <span>xG includes penalties.</span></p></div><div class="card"><h3>Most above and below xG</h3>${INS.hbars({rows:bars,fmt:sgn})}</div></div>`;
 }
 function matches(T,sh){
  const L=[];T.forEach(t=>{if(S.team&&t.t!==S.team)return;games(t).forEach(g=>{if(g.home||S.team)L.push({t:t.t,g,d:Math.abs(g.gf-g.xg)+Math.abs(g.ga-g.xga)})})});
  L.sort((a,b)=>b.d-a.d);const top=L.slice(0,12);
  if(!top.length)return '<div class="empty">No matches with shot data in this period.</div>';
  const cur=top.find(x=>x.g.m.match_id===S.mid)||top[0];S.mid=cur.g.m.match_id;
  const rows=sh.rows.filter(r=>r.m===S.mid&&r.pd!=='PenaltyShootout'),m=cur.g.m;
  const sd=INS.sideFn(rows,m);
  const dots=rows.filter(r=>!r.og&&r.x!=null&&r.y!=null&&sd(r)).map(r=>{const home=sd(r)==='h',x=home?r.x:105-r.x,y=home?r.y:68-r.y;return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(0.8+Math.sqrt(r.xg||0)*3.2).toFixed(2)}" class="rc-s ${home?'h':'a'}${r.ev==='Goal'?' g':''}"${INS.tipAttr([r.pn,r.c,(r.mn!=null?Math.round(r.mn)+"'":''),'xG '+INS.f(r.xg),r.ev==='Goal'?'Goal':''])}></circle>`}).join('');
  return `<div class="card"><h3>Results furthest from the xG</h3><ol class="rc-ml">${top.map(x=>{const g=x.g;return `<li class="${g.m.match_id===S.mid?'on':''}"><button type="button" class="s" data-rcm="${esc(g.m.match_id)}">${esc(g.m.home)} ${esc(g.m.score)} ${esc(g.m.away)}</button><span class="mu">xG ${INS.f(g.home?g.xg:g.xga)} – ${INS.f(g.home?g.xga:g.xg)} · ${esc(g.m.date.slice(0,10))}</span></li>`}).join('')}</ol>
   <p class="mu ins-note"><span>Sorted by how far both sides' goals were from their xG, added together.</span></p></div>
   <div class="card" id="rcmap"><h3>${esc(m.home)} ${esc(m.score)} ${esc(m.away)} <span class="mu">· xG ${INS.f(cur.g.home?cur.g.xg:cur.g.xga)} – ${INS.f(cur.g.home?cur.g.xga:cur.g.xg)}</span></h3>
   <div class="rc-pitch">${pitchSvg(dots,'','','r')}</div><div class="ins-leg"><span><i></i>${esc(m.home)} →</span><span><i class="b"></i>← ${esc(m.away)}</span><span><b class="rc-gk"></b><span>Goal</span></span></div>
   <p class="mu ins-note"><span>Each circle is a shot, sized by its xG; filled = goal. Own goals are not shots and are not drawn.</span> <a href="#/match/${encodeURIComponent(S.mid)}">Match centre →</a></p></div>`;
 }
 INS.ar({"Reality Check":"اختبار الواقع","xG is the chance that a shot of that quality is scored: an estimate of how good the chances were, not a forecast.":"xG هو احتمال إن تسديدة بهذي الجودة تصير هدف: تقدير لجودة الفرص، مو توقع للنتيجة.",
  "Over a few matches goals and xG often differ; the gap tends to shrink over a season.":"في مباريات قليلة غالبًا تختلف الأهداف عن xG؛ والفرق يميل يصغر على مدى الموسم.","Period":"الفترة","Whole season":"الموسم كامل","Last # matches":"آخر # مباريات",
  "Clubs":"الأندية","Players":"اللاعبين","Matches":"المباريات","Goals − xG":"الأهداف − xG","Goals against − xG against":"الأهداف عليه − xG عليه","Side":"الجهة",
  "Scored: goals against xG":"المسجّل: الأهداف مقابل xG","Conceded: goals against xG against":"المستقبل: الأهداف عليه مقابل xG عليه","Conceded against xG against":"المستقبل مقابل xG عليه","Goals against xG":"الأهداف مقابل xG",
  "Above the diagonal: more goals than xG; below: fewer.":"فوق القطر: أهداف أكثر من xG؛ وتحته: أقل.","goals and xG over the matches":"الأهداف و xG عبر المباريات","Goals (cumulative)":"الأهداف (تراكمي)","xG (cumulative)":"xG (تراكمي)",
  "scored # from # xG: more than the chances were worth.":"سجّل # من # xG: أكثر من قيمة الفرص.","scored # from # xG: fewer than the chances were worth.":"سجّل # من # xG: أقل من قيمة الفرص.","scored # from # xG: about as many as the chances were worth.":"سجّل # من # xG: تقريبًا نفس قيمة الفرص.",
  "They conceded # from # xG against: more than the chances against were worth.":"استقبل # من # xG عليه: أكثر من قيمة الفرص عليه.","They conceded # from # xG against: fewer than the chances against were worth.":"استقبل # من # xG عليه: أقل من قيمة الفرص عليه.",
  "They conceded # from # xG against: about as many as the chances against were worth.":"استقبل # من # xG عليه: تقريبًا نفس قيمة الفرص عليه.","matches":"مباريات",
  "No shot data for this league, so there is no xG to compare with.":"ما فيه بيانات تسديدات لهذا الدوري، فما فيه xG نقارن معه.","No player has enough shots in this period.":"ما فيه لاعب عنده تسديدات كافية في هذي الفترة.","shots":"تسديدات",
  "Highlighted: a gap of # goals or more.":"المميّز: فرق # أهداف أو أكثر.","xG includes penalties.":"xG يشمل ركلات الجزاء.","Most above and below xG":"الأكثر فوق وتحت xG","No matches with shot data in this period.":"ما فيه مباريات فيها بيانات تسديد في هذي الفترة.",
  "Results furthest from the xG":"النتائج الأبعد عن xG","Sorted by how far both sides' goals were from their xG, added together.":"مرتبة حسب مجموع ابتعاد أهداف الفريقين عن xG حقهم.",
  "Each circle is a shot, sized by its xG; filled = goal. Own goals are not shots and are not drawn.":"كل دائرة تسديدة، حجمها حسب xG؛ المعبّاة = هدف. الأهداف العكسية مو تسديدات وما تنرسم.","Match centre →":"مركز المباراة ←","Goal":"هدف"});
})();
