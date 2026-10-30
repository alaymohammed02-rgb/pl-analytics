/* ===== Run-in (#/runin, in the Season hub after Title race): how hard the matches a club has left are =====
   Every club still has to play the pairings (home club, away club) that it has not yet played this season: in a double round robin those are known even
   though the dates are not (the next dated fixtures are the ones data/fixtures.json lists). Strength is the Club Elo rating of data/elo_own.json (ratings of
   today, frozen) with the same ordered logit as the sync: P(win), P(draw), P(loss) from the rating gap plus the home advantage, expected points = 3 P(win) + P(draw).
   For a club: Es = the points Elo expects from the pairings it has left; Ef = the points Elo expects from the same number of home and away games against an
   average opponent (the mean rating of the other clubs); the schedule effect = Es - Ef (negative: a harder run-in than average); projected final points = points now + Es.
   "Does it matter?" is data/runin.json, written offline by tools/runin/fit.py: on finished seasons, after 25%, 50% and 75% of the matches, does knowing the real
   opponents predict the points a club took in the rest of the season better than an average opponent does, and how big is the effect. Nothing here is a guess
   beyond Elo's own chances; the page says the order of the matches left is unknown and that the effect is small. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('runin','Run-in','season','race');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const S={lg:'',sort:'hard',pick:'',tok:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();
  const opt=n=>loadJson(n,ALL.generated).catch(()=>null);
  const p=Promise.all([loadJson('results.json',ALL.generated),loadJson('elo_own.json',ALL.generated),opt('fixtures.json'),opt('runin.json')]).then(([F,E,X,T])=>{
   if(!F||!F.leagues||!Object.keys(F.leagues).length||!E||!E.leagues||!E.params)throw new Error('runin');return {F,E,X,T}}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 const probs=(dr,P)=>{const x=dr/P.s,ph=1/(1+Math.exp(-(x-P.c))),pa=1-1/(1+Math.exp(-(x+P.c)));return [ph,1-ph-pa,pa]};
 /* the club's expected points in one match: home = it plays at home */
 const ep=(rc,ro,home,P)=>{const p=home?probs(rc-ro+P.H,P):probs(ro-rc+P.H,P);return home?3*p[0]+p[1]:3*p[2]+p[1]};
 const pw=(rc,ro,home,P)=>{const p=home?probs(rc-ro+P.H,P):probs(ro-rc+P.H,P);return home?p:[p[2],p[1],p[0]]};
 function calc(D0,lg){
  const {F,E,X}=D0,L=F.leagues[lg],EL=E.leagues&&E.leagues[lg];if(!L||!EL||!EL.teams)return null;
  const P=E.params,cur=L.seasons[L.seasons.length-1],T=L.teams;
  const pts=new Map(),played=new Set(),seen=new Set();
  for(const x of cur.m){const h=T[x[1]],a=T[x[2]];played.add(h+'|'+a);seen.add(h);seen.add(a);
   pts.set(h,(pts.get(h)||0)+(x[3]>x[4]?3:x[3]===x[4]?1:0));pts.set(a,(pts.get(a)||0)+(x[4]>x[3]?3:x[3]===x[4]?1:0))}
  const teams=Object.keys(EL.teams).filter(t=>seen.has(t)).sort(cmp);if(teams.length<4)return null;
  const rs=Object.values(EL.teams).map(x=>x.r),mean=rs.reduce((s,x)=>s+x,0)/rs.length,r=t=>EL.teams[t]?EL.teams[t].r:mean;
  const tot=teams.reduce((s,t)=>s+r(t),0),n=teams.length;
  const fix=X&&X.leagues&&X.leagues[lg]||[];
  const rows=teams.map(t=>{
   const ob=(tot-r(t))/(n-1),home=[],away=[];
   for(const u of teams){if(u===t)continue;
    if(!played.has(t+'|'+u))home.push({o:u,e:ep(r(t),r(u),true,P),p:pw(r(t),r(u),true,P)});
    if(!played.has(u+'|'+t))away.push({o:u,e:ep(r(t),r(u),false,P),p:pw(r(t),r(u),false,P)})}
   const es=home.reduce((s,x)=>s+x.e,0)+away.reduce((s,x)=>s+x.e,0),ef=home.length*ep(r(t),ob,true,P)+away.length*ep(r(t),ob,false,P);
   const left=home.length+away.length,opp=left?(home.reduce((s,x)=>s+r(x.o),0)+away.reduce((s,x)=>s+r(x.o),0))/left:null;
   const next=fix.filter(f=>f.h===t||f.a===t).sort((a,b)=>cmp(a.k,b.k)||cmp(a.i,b.i)).slice(0,5).map(f=>{const hm=f.h===t,o=hm?f.a:f.h;
    return {i:f.i,d:f.d,k:f.k,o,home:hm,e:ep(r(t),r(o),hm,P),ef:ep(r(t),ob,hm,P),p:pw(r(t),r(o),hm,P)}});
   return {t,r:r(t),now:pts.get(t)||0,home,away,left,es,ef,sched:es-ef,proj:(pts.get(t)||0)+es,opp,next,n5:next.reduce((s,x)=>s+x.e-x.ef,0)}});
  return {name:L.name,season:cur.s,rows,left:rows.reduce((s,x)=>s+x.left,0)/2};
 }
 R.runin=async function(el){
  el.innerHTML='<h2>Run-in</h2><div id="riroot" class="ins lk ri"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#riroot'),lg=D.id,tok=++S.tok;
  let D0;try{D0=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The results and ratings are not available right now.','النتائج والتقييمات مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  const ok=Object.keys(D0.F.leagues).filter(i=>D0.E.leagues[i]);
  if(!ok.includes(S.lg)){S.lg=ok.includes(lg)?lg:ok[0];S.pick=''}
  draw(root,D0);
 };
 const f1=x=>x==null?'–':x.toFixed(1),f2=x=>x==null?'–':x.toFixed(2),sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(2),pc=x=>Math.round(x*100)+'%';
 const lvl=e=>e>=2?'g':e>=1.2?'a':'r';
 const SORT={hard:(a,b)=>a.sched-b.sched,easy:(a,b)=>b.sched-a.sched,proj:(a,b)=>b.proj-a.proj,next:(a,b)=>a.n5-b.n5};
 function verdict(d,se){return se&&Math.abs(d)>=1.96*se?(d<0?'better':'worse'):'noise'}
 function testCard(T){
  if(!T||!T.all)return '';
  const rows=T.check.map(f=>[f,T.all[String(f)],T.new&&T.new[String(f)]]).filter(x=>x[1]);if(!rows.length)return '';
  const vtxt=(a)=>{const v=verdict(a.d,a.se);return v==='noise'?two('within noise','ضمن الضجيج'):v==='better'?two('better with the real opponents','أفضل بالخصوم الحقيقيين'):two('worse with the real opponents','أسوأ بالخصوم الحقيقيين')};
  const line=(f,a,lab)=>`<tr data-f="${f}" data-s="${lab}"><td>${two(lab==='all'?'All seasons':'2025-26 only',lab==='all'?'كل المواسم':'٢٠٢٥-٢٦ فقط')} · ${nb(Math.round(f*100)+'%')}</td><td class="n">${nb(a.n)}</td><td class="n">${nb(a.sched.toFixed(2))}</td><td class="n">${nb(a.flat.toFixed(2))}</td><td class="n">${nb(sg(a.d))} ± ${nb(a.se.toFixed(2))}</td><td>${vtxt(a)}</td><td class="n">${nb(a.slope.toFixed(2))} ± ${nb(a.slope_se.toFixed(2))}</td></tr>`;
  const w=T.all['0.5'],sp=w?w.spread:null;
  /* the reading of the paired differences, from the numbers */
  const bt=rows.filter(x=>verdict(x[1].d,x[1].se)==='better').map(x=>Math.round(x[0]*100)+'%'),wo=rows.filter(x=>verdict(x[1].d,x[1].se)==='worse').map(x=>Math.round(x[0]*100)+'%');
  const rd=bt.length?[`Knowing the real opponents predicts the rest of the season better than an average opponent beyond noise at ${bt.join(' and ')} of the season${bt.length<rows.length?'; at the other checkpoints the difference is within noise':''}.`,`معرفة الخصوم الحقيقيين تتوقع باقي الموسم أحسن من خصم متوسط بفرق أكبر من الضجيج عند ${bt.map(nb).join(' و')} من الموسم${bt.length<rows.length?'؛ وفي نقاط القياس الثانية الفرق ضمن الضجيج':''}.`]
   :wo.length?[`At ${wo.join(' and ')} the real opponents gave a larger error than an average opponent, beyond noise.`,`عند ${wo.map(nb).join(' و')} الخصوم الحقيقيون أعطوا خطأ أكبر من خصم متوسط، بفرق أكبر من الضجيج.`]
   :['Knowing the real opponents does not predict the rest of the season better than an average opponent at any checkpoint: the differences are within noise.','معرفة الخصوم الحقيقيين ما تتوقع باقي الموسم أحسن من خصم متوسط في أي نقطة قياس: الفروق ضمن الضجيج.'];
  return `<div class="card ri-t" id="ritest"><h3>${two('Does the run-in matter?','هل صعوبة الباقي تفرق؟')}</h3>
   <p class="ri-r">${two(`Tested on <b>${rows[0][1].seasons}</b> finished seasons of the six leagues: after a quarter, half and three quarters of the matches, the points a club really took in the rest of the season, against what Elo expected from its <b>real</b> remaining opponents and from an <b>average</b> opponent in the same home and away games. ${sp!=null?`The schedule moves a club's expected points by about <b>${sp.toFixed(1)}</b> points either way, against an error of ${w.sched.toFixed(1)} points at half time, so it is a small effect. `:''}${rd[0]} A slope near 1 means the schedule moved points as much as Elo says.`,`جرّبناها على <b>${nb(rows[0][1].seasons)}</b> موسم منتهي في الدوريات الستة: بعد ربع ونصف وثلاثة أرباع المباريات، قارنّا النقاط اللي أخذها النادي فعلاً في باقي الموسم بما توقعه Elo من خصومه <b>الحقيقيين</b> ومن خصم <b>متوسط</b> بنفس عدد مباريات البيت والخارج. ${sp!=null?`الجدول يحرّك نقاط النادي المتوقعة بحوالي <b>${nb(sp.toFixed(1))}</b> نقطة في أي اتجاه، مقابل خطأ ${nb(w.sched.toFixed(1))} نقطة في منتصف الموسم، فالأثر صغير. `:''}${rd[1]} ميل قريب من ${nb(1)} يعني إن الجدول حرّك النقاط بقدر ما يقول Elo.`)}</p>
   <div class="ri-w"><table class="lk-t ri-tt"><thead><tr><th>${two('Checkpoint','نقطة القياس')}</th><th class="n">${two('Clubs','أندية')}</th><th class="n">${two('Error, real opponents','خطأ، خصوم حقيقيون')}</th><th class="n">${two('Error, average opponent','خطأ، خصم متوسط')}</th><th class="n">${two('Difference','الفرق')}</th><th>${two('Reading','القراءة')}</th><th class="n">${two('Slope','الميل')}</th></tr></thead>
   <tbody>${rows.map(([f,a,b])=>line(f,a,'all')+(b?line(f,b,'new'):'')).join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Errors are the mean absolute gap, in points, between the points a club took in the rest of the season and Elo\'s expectation. A negative difference means the real opponents gave the smaller error. Ratings are frozen on the checkpoint day. 2025-26 was not used to fit Elo.','الأخطاء هي متوسط الفرق المطلق، بالنقاط، بين نقاط النادي في باقي الموسم وتوقع Elo. الفرق السالب يعني إن الخصوم الحقيقيين أعطوا خطأ أصغر. التقييمات مجمّدة في يوم نقطة القياس. موسم ٢٠٢٥-٢٦ ما استُخدم في ضبط Elo.')}</p></div>`;
 }
 function draw(root,D0){
  const ok=Object.keys(D0.F.leagues).filter(i=>D0.E.leagues[i]);
  const C=calc(D0,S.lg);
  const head=`<div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="rig">${ok.map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(D0.F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <div class="seg" id="riso" role="group" aria-label="${ar()?'الترتيب':'Order by'}">${[['hard','Hardest','الأصعب'],['easy','Easiest','الأسهل'],['proj','Points','النقاط'],['next','Next 5','الخمس']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${S.sort===k}" class="${S.sort===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div></div>`;
  if(!C){root.innerHTML=`<div class="card lk-intro"><p>${two('<b>How hard is the rest of the season?</b>','<b>قد إيش باقي الموسم صعب؟</b>')}</p></div>${head}<div class="empty">${two('This league has no ratings or results to work from yet.','هذا الدوري ما عنده تقييمات أو نتائج كافية للحين.')}</div>${testCard(D0.T)}`;wire(root,D0);return}
  const done=C.rows.every(x=>x.left===0);
  if(done){root.innerHTML=`<div class="card lk-intro"><p>${two('<b>How hard is the rest of the season?</b>','<b>قد إيش باقي الموسم صعب؟</b>')}</p></div>${head}<div class="empty">${two('Every club has played all its matches this season: nothing is left to rate.','كل الأندية لعبت كل مبارياتها هذا الموسم: ما بقي شي نقيّمه.')}</div>${testCard(D0.T)}`;wire(root,D0);return}
  const rows=C.rows.slice().sort((a,b)=>SORT[S.sort](a,b)||cmp(a.t,b.t));
  if(!rows.some(r=>r.t===S.pick))S.pick=rows[0].t;
  const mx=Math.max(0.01,...rows.map(r=>Math.abs(r.sched))),sel=rows.find(r=>r.t===S.pick),hard=C.rows.reduce((a,b)=>b.sched<a.sched?b:a),easy=C.rows.reduce((a,b)=>b.sched>a.sched?b:a);
  const chips=r=>`<span class="ri-n5" aria-hidden="true">${r.next.map(x=>`<i class="ri-c ${lvl(x.e)}" title="${esc(x.o)} (${x.home?'H':'A'}) ${f2(x.e)}"></i>`).join('')}</span>`;
  const oneM=(x,home)=>`<li data-o="${esc(x.o)}" data-e="${x.e.toFixed(4)}" data-v="${home?'h':'a'}"><span class="ri-o">${nm(x.o)}</span><span class="ri-p">${nb(pc(x.p[0])+' · '+pc(x.p[1])+' · '+pc(x.p[2]))}</span><b class="ri-e ${lvl(x.e)}">${nb(f2(x.e))}</b></li>`;
  const order=(a,home)=>a.slice().sort((p,q)=>p.e-q.e||cmp(p.o,q.o));
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>How hard is the rest of the season?</b> For each club, the points Elo expects from the matches it still has to play, set against the same number of home and away games against an average opponent. Negative means a harder run-in than average. It is a small effect (the last card says how small), and the order of the matches left is not known: only the next few have dates.','<b>قد إيش باقي الموسم صعب؟</b> لكل نادي، النقاط اللي يتوقعها Elo من المباريات اللي بقيت له، مقارنةً بنفس عدد مباريات البيت والخارج ضد خصم متوسط. السالب يعني جدول أصعب من المتوسط. الأثر صغير (البطاقة الأخيرة تقول قد إيش)، وترتيب المباريات الباقية مو معروف: بس الجاية القريبة لها تواريخ.')}</p></div>
   ${head}
   <div class="card hb-k ri-k"><div class="hb-t" data-k="hard"><b>${nm(hard.t)}</b><span>${two('hardest run-in','أصعب جدول')} · ${nb(sg(hard.sched))}</span></div><div class="hb-t" data-k="easy"><b>${nm(easy.t)}</b><span>${two('easiest run-in','أسهل جدول')} · ${nb(sg(easy.sched))}</span></div><div class="hb-t" data-k="left"><b>${nb(Math.round(C.left))}</b><span>${two('matches left in the league','مباراة باقية في الدوري')}</span></div></div>
   <div class="card ri-cd"><div class="ri-hd"><span>${two('Club','النادي')}</span><span class="ri-hl">${two('Left (H+A)','الباقي (بيت+خارج)')}</span><span class="ri-hl ri-qh">${two('Avg opp.','متوسط الخصم')}</span><span class="ri-bh">${two('Schedule effect (points)','أثر الجدول (نقاط)')}</span><span class="ri-hl">${two('Projected','المتوقعة')}</span><span class="ri-hl">${two('Next 5','الخمس الجاية')}</span></div>
    <div class="ri-list" role="list">${rows.map(r=>`<button type="button" role="listitem" class="ri-row${r.t===S.pick?' on':''}" data-t="${esc(r.t)}" data-left="${r.left}" data-h="${r.home.length}" data-a="${r.away.length}" data-es="${r.es.toFixed(4)}" data-ef="${r.ef.toFixed(4)}" data-now="${r.now}" data-opp="${r.opp==null?'':r.opp.toFixed(2)}" data-n5="${r.next.length}" aria-pressed="${r.t===S.pick}"><span class="ri-nm">${nm(r.t)}</span><span class="ri-l">${nb(r.home.length+'+'+r.away.length)}</span><span class="ri-q">${nb(r.opp==null?'–':Math.round(r.opp))}</span><span class="ri-b"><i class="${r.sched>=0?'p':'m'}" style="width:${(Math.abs(r.sched)/mx*50).toFixed(2)}%;${r.sched>=0?'left:50%':'right:50%'}"></i><b>${nb(sg(r.sched))}</b></span><span class="ri-pj"><b>${nb(f1(r.proj))}</b><small>${nb(r.now)}</small></span>${chips(r)}</button>`).join('')}</div>
    <p class="mu ins-note">${two(`${esc(C.season)}, ${esc(C.name)}. Ratings of today, frozen; expected points = 3 P(win) + P(draw). "Projected" = points now (small figure) plus what Elo expects from the matches left: an expectation, not a forecast of the table. The five squares are the next dated fixtures (green: 2 or more expected points, amber: 1.2 to 2, red: under 1.2).`,`${nb(esc(C.season))}، ${nm(C.name)}. تقييمات اليوم، مجمّدة؛ النقاط المتوقعة = ${nb('3')} × احتمال الفوز + احتمال التعادل. «المتوقعة» = نقاط النادي الحين (الرقم الصغير) مع اللي يتوقعه Elo من المباريات الباقية: توقع، مو تنبؤ بالجدول. المربعات الخمسة هي المباريات القادمة اللي لها تواريخ (أخضر: ${nb(2)} نقطة متوقعة أو أكثر، كهرماني: من ${nb('1.2')} إلى ${nb(2)}، أحمر: أقل من ${nb('1.2')}).`)}</p></div>
   <div class="card ri-s" id="risel"><h3>${nm(sel.t)}</h3>
    <p class="mu">${two(`${sel.left} matches left (${sel.home.length} at home, ${sel.away.length} away). Elo expects ${f1(sel.es)} points from them; ${f1(sel.ef)} against an average opponent. Projected final: ${f1(sel.proj)}.`,`باقي ${nb(sel.left)} مباراة (${nb(sel.home.length)} في البيت، ${nb(sel.away.length)} خارج). Elo يتوقع ${nb(f1(sel.es))} نقطة منها؛ و${nb(f1(sel.ef))} ضد خصم متوسط. النهاية المتوقعة: ${nb(f1(sel.proj))}.`)}</p>
    ${sel.next.length?`<h4>${two('Next fixtures (dated)','المباريات القادمة (بتواريخ)')}</h4><ul class="ri-nx">${sel.next.map(x=>`<li data-id="${esc(x.i)}" data-e="${x.e.toFixed(4)}"><span class="mu">${nb(esc(x.d))}</span><span class="ri-o">${two(x.home?'vs':'at',x.home?'ضد':'عند')} ${nm(x.o)}</span><span class="ri-p">${nb(pc(x.p[0])+' · '+pc(x.p[1])+' · '+pc(x.p[2]))}</span><b class="ri-e ${lvl(x.e)}">${nb(f2(x.e))}</b></li>`).join('')}</ul>`:''}
    <div class="ri-cols"><div><h4>${two('At home','في البيت')} (${nb(sel.home.length)})</h4><ul class="ri-ml" data-v="h">${order(sel.home).map(x=>oneM(x,true)).join('')||`<li class="mu">${two('none left','ما بقي')}</li>`}</ul></div>
     <div><h4>${two('Away','خارج')} (${nb(sel.away.length)})</h4><ul class="ri-ml" data-v="a">${order(sel.away).map(x=>oneM(x,false)).join('')||`<li class="mu">${two('none left','ما بقي')}</li>`}</ul></div></div>
    <p class="mu ins-note">${two('The three percentages are win · draw · loss for this club; the last number is its expected points. Hardest matches first.','النسب الثلاث هي فوز · تعادل · خسارة لهذا النادي؛ والرقم الأخير نقاطه المتوقعة. الأصعب أولاً.')}</p></div>
   ${testCard(D0.T)}`;
  wire(root,D0);
 }
 function wire(root,D0){
  const q=s=>root.querySelector(s);
  const g=q('#rig');if(g)g.onchange=e=>{S.lg=e.target.value;S.pick='';draw(root,D0)};
  root.querySelectorAll('#riso button').forEach(b=>b.onclick=()=>{S.sort=b.dataset.k;draw(root,D0)});
  root.querySelectorAll('.ri-row').forEach(b=>b.onclick=()=>{const y=scrollY;S.pick=b.dataset.t;draw(root,D0);scrollTo(0,y);const n=root.querySelector('.ri-row.on');if(n)n.focus({preventScroll:true})});
 }
 INS.ar({'Run-in':'باقي الموسم'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
