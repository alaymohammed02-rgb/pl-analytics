/* ===== Team DNA (in the club page): the club's numbers against the league, and against another club =====
   Unit: per match (a match is 90 minutes for both sides, so per match = per 90); the same season and league for both clubs.
   Sources (PitchAPI): goals from the results; xG, npxG, shots for and against from the shot file (own goals left out); passing,
   creation, carrying and defending counts summed over the club's players in each match (per-match player file); high turnovers,
   counterpress regains, average defensive action height and field tilt from PitchAPI's team table; PPDA = opponent passes /
   defensive actions over the season (advanced file). A measure is averaged over the matches that have it (the count is shown).
   Dimensions are mean percentiles among the league's clubs; lower-is-better measures (against) are turned round first.
   No tactical label is given: the page shows where the numbers stand, not a style name. */
(function(){
 if(typeof R!=='object'||typeof R.club!=='function'||typeof INS!=='object')return;
 const DIMS=[['Attack',['xg','sh','xt']],['Creation',['kp','sca','bx']],['Progression',['pr','pc','tkw']],['Defence',['xga','sha','ga']],
  ['Ball winning',['tk','ic','duw']],['Pressing data',['hto','cpr','ppda']],['Territory',['tilt','adx']]];
 const LOW=new Set(['xga','sha','ga','ppda']);
 const lab=k=>k==='ppda'?'PPDA':(INS.TM.find(x=>x[0]===k)||[k,k])[1];
 const cnt=(t,k)=>k==='ppda'?t.games.filter(g=>g.av&&g.av.da>0).length:t.games.filter(g=>{const M=INS.TM.find(x=>x[0]===k);const v=M&&M[3](g);return v!=null&&isFinite(v)}).length;
 /* the computation, separate from the drawing */
 window.tdnaCalc=function(T,name){
  const val=(t,k)=>INS.tval(t,k),me=T.find(t=>t.t===name);if(!me)return null;
  const pc=(t,k)=>{const v=val(t,k);if(v==null)return null;const p=INS.pct(T,q=>val(q,k),v);return p==null?null:LOW.has(k)?100-p:p};
  const dims=t=>DIMS.map(([l,ks])=>{const ps=ks.map(k=>pc(t,k)).filter(x=>x!=null);return {l,ks,p:ps.length?ps.reduce((s,x)=>s+x,0)/ps.length:null}});
  const avg=k=>INS.mean(T.map(t=>val(t,k)));
  return {me,dims,val,pc,avg,T};
 };
 const oc=R.club;
 R.club=async function(el,arg){
  const out=await oc.apply(this,arguments);
  const name=decodeURIComponent(arg||''),anchor=el.querySelector('#clx')||el.querySelector('.clubk');if(!anchor||el.querySelector('.tdna'))return out;
  const card=document.createElement('div');card.className='card tdna ins';card.innerHTML='<div class="empty skel">Loading…</div>';anchor.after(card);
  const T=await INS.teams();if(!document.body.contains(card))return out;
  const C=tdnaCalc(T,name);if(!C||C.me.games.length<3){card.innerHTML='<h3>Team DNA</h3><div class="empty">Team DNA needs 3 finished matches of the club.</div>';return out}
  draw(card,C,name);return out;
 };
 function draw(card,C,name){
  let tab='dna',vs='';const others=C.T.filter(t=>t.t!==name).map(t=>t.t).sort();
  const other=()=>vs?C.T.find(t=>t.t===vs):null;
  const body=()=>{const o=other(),dm=C.dims(C.me),dv=o?C.dims(o):null;
   if(tab==='bars'){const keys=['gf','xg','npxg','sh','xt','kp','sca','pr','pc','ga','xga','sha','tk','ic','duw','hto','cpr','ppda','tilt'];
    return `<ul class="dna-vs">${keys.map(k=>{const a=C.val(C.me,k),b=o?C.val(o,k):C.avg(k),m=Math.max(1e-9,a||0,b||0);return `<li${INS.tipAttr([lab(k),name+': '+INS.f(a),(o?o.t:'League average')+': '+INS.f(b),'per match'+(k==='ppda'?' (season ratio)':''),cnt(C.me,k)+' matches with data'])}><span class="ins-pl">${esc(lab(k))}${LOW.has(k)?' <span class="mu">↓</span>':''}</span><span class="dna-vb"><i class="a" style="width:${Math.round((a||0)/m*100)}%"></i><i class="b" style="width:${Math.round((b||0)/m*100)}%"></i></span><b>${INS.f(a)}</b><b class="mu">${INS.f(b)}</b></li>`}).join('')}</ul>
     <p class="mu ins-note"><span>Per match, this season.</span> <span>↓ = lower is better.</span> <span>PPDA: opponent passes per defensive action over the season (lower = fewer passes allowed before a defensive action).</span></p>`}
   if(tab==='scatter'){const pts=C.T.map(t=>({x:C.val(t,'xg'),y:C.val(t,'xga'),label:t.t,cls:t.t===name?'hi':o&&t.t===o.t?'hi2':'',href:'#/club/'+encodeURIComponent(t.t),tip:[t.t,'xG for a match: '+INS.f(C.val(t,'xg')),'xG against a match: '+INS.f(C.val(t,'xga')),t.games.length+' matches']}));
    return INS.scatter({pts,xl:'xG for a match',yl:'xG against a match',aria:'xG for and against'})+`<p class="mu ins-note"><span>Each dot is a club. Right = more xG created, lower = less xG allowed.</span> <span>Grey lines: the middle of the league.</span></p>`}
   if(tab==='trend'){const roll=(t,k)=>t.games.map((g,i)=>{const w=t.games.slice(Math.max(0,i-2),i+1).map(x=>x[k]).filter(v=>v!=null);return {y:w.length?w.reduce((s,x)=>s+x,0)/w.length:null,tip:[t.t+' · '+g.m.date.slice(0,10),(g.home?'':'@ ')+g.opp+' '+g.gf+'–'+g.ga,k==='xg'?'xG for':'xG against',INS.f(g[k])+' · 3-match average '+INS.f(w.length?w.reduce((s,x)=>s+x,0)/w.length:null)]}});
    const S=[{name:name+' · xG for',cls:'',pts:roll(C.me,'xg')},{name:name+' · xG against',cls:'b',pts:roll(C.me,'xga')}];
    if(o)S.push({name:o.t+' · xG for',cls:'c',pts:roll(o,'xg')});
    return INS.line({series:S,xl:'match by match →',aria:'Trend'})+`<p class="mu ins-note"><span>Average of the last 3 matches at each point.</span>${o?' <span>The other club\'s line follows its own matches.</span>':''}</p>`}
   const ser=[{name,vals:dm.map(x=>x.p),raw:dm.map(x=>x.ks.map(k=>lab(k)+' '+INS.f(C.val(C.me,k))).join(', '))}];
   if(dv)ser.push({name:o.t,cls:'b',vals:dv.map(x=>x.p),raw:dv.map(x=>x.ks.map(k=>lab(k)+' '+INS.f(C.val(o,k))).join(', '))});
   const hi=dm.filter(x=>x.p!=null&&x.p>=75),lo=dm.filter(x=>x.p!=null&&x.p<=25);
   return `<div class="dna-g">${INS.radar({axes:dm.map(x=>x.l),series:ser,aria:'Team DNA'})}<div>
    ${hi.length?`<p><b>Highest in the league:</b> ${hi.map(x=>`<span>${esc(x.l)}</span> (${Math.round(x.p)})`).join(', ')}</p>`:''}${lo.length?`<p><b>Lowest in the league:</b> ${lo.map(x=>`<span>${esc(x.l)}</span> (${Math.round(x.p)})`).join(', ')}</p>`:''}
    <ul class="tdna-k">${dm.map(x=>`<li${INS.tipAttr([x.l,x.ks.map(k=>lab(k)+': '+INS.f(C.val(C.me,k))+(C.pc(C.me,k)==null?'':' ('+Math.round(C.pc(C.me,k))+')')).join(' · ')])}><span>${esc(x.l)}</span><span class="ins-pt2"><i style="width:${x.p==null?0:Math.round(x.p)}%"></i></span><b>${x.p==null?'N/A':Math.round(x.p)}</b></li>`).join('')}</ul>
    <p class="mu ins-note"><span>Percentile among the league's</span> ${C.T.length} <span>clubs, per match, this season (100 = the most; for defence the fewest goals, xG and shots against).</span> <span>"Pressing data" uses PitchAPI's high turnovers, counterpress regains and PPDA; it is a measure, not a style label.</span></p></div></div>`};
  const paint=()=>{card.innerHTML=`<h3>Team DNA <span class="mu">· <span>per match, this season</span></span></h3><div class="ctl"><select id="tdvs" aria-label="Compare with">${opts([['','League average'],...others.map(t=>[t,t])],vs)}</select></div>`+
   INS.tabs('tdtabs',[{k:'dna',t:'Fingerprint'},{k:'bars',t:'Numbers'},{k:'scatter',t:'xG for vs against'},{k:'trend',t:'Trend'}],tab)+`<div id="tdb">${body()}</div>`;
   INS.wireTabs(card,'tdtabs',k=>{tab=k;card.querySelector('#tdb').innerHTML=body()});card.querySelector('#tdvs').onchange=e=>{vs=e.target.value;card.querySelector('#tdb').innerHTML=body()}};
  paint();
 }
 INS.ar({"Team DNA":"بصمة الفريق","Team DNA needs # finished matches of the club.":"بصمة الفريق تحتاج # مباريات منتهية للنادي.","per match, this season":"لكل مباراة، هذا الموسم","League average":"متوسط الدوري",
  "Fingerprint":"البصمة","Numbers":"الأرقام","xG for vs against":"xG له مقابل عليه","Trend":"الاتجاه","Attack":"الهجوم","Creation":"صناعة الفرص","Progression":"التقدم بالكرة","Defence":"الدفاع","Ball winning":"استعادة الكرة","Pressing data":"بيانات الضغط",
  "Per match, this season.":"لكل مباراة، هذا الموسم.","↓ = lower is better.":"↓ = الأقل أفضل.","PPDA: opponent passes per defensive action over the season (lower = fewer passes allowed before a defensive action).":"PPDA: تمريرات الخصم لكل فعل دفاعي على مدى الموسم (الأقل = تمريرات أقل مسموحة قبل الفعل الدفاعي).",
  "xG for a match":"xG له في المباراة","xG against a match":"xG عليه في المباراة","Each dot is a club. Right = more xG created, lower = less xG allowed.":"كل نقطة نادي. اليمين = xG أكثر صُنع، والأسفل = xG أقل مسموح.","Grey lines: the middle of the league.":"الخطوط الرمادية: منتصف الدوري.",
  "match by match →":"مباراة بمباراة ←","Average of the last # matches at each point.":"متوسط آخر # مباريات عند كل نقطة.","The other club's line follows its own matches.":"خط النادي الثاني يمشي على مبارياته هو.",
  "Highest in the league:":"الأعلى في الدوري:","Lowest in the league:":"الأقل في الدوري:","Percentile among the league's":"النسبة المئوية بين أندية الدوري الـ",
  "clubs, per match, this season (# = the most; for defence the fewest goals, xG and shots against).":"، لكل مباراة، هذا الموسم (# = الأكثر؛ وفي الدفاع الأقل أهداف و xG وتسديدات عليه).",
  "\"Pressing data\" uses PitchAPI's high turnovers, counterpress regains and PPDA; it is a measure, not a style label.":"\"بيانات الضغط\" تستخدم أرقام PitchAPI للاستعادة المتقدمة والاستعادة بعد الفقدان و PPDA؛ هي مقياس، مو وصف لأسلوب."});
})();
