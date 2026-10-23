/* ===== Likely line-ups (#/xi, in League after Comebacks & collapses): who starts next, and how often this guess was right =====
   For each club, its starting elevens so far this season (PitchAPI official line-ups) and the minutes each player played.
   A player's chance to start = a logistic function of five things: did he start the last match, the one before and the one before
   that, his share of the club's starts, and how much of the last match he played (XI_COEF, five numbers plus a constant, fitted on
   the 476 club-matches of the six domestic leagues; fitted again with one league hidden at a time it gets XI_FIT[0] players of 11
   right against XI_FIT[1] for "the same XI as last match"). The likely XI is the best goalkeeper and the ten best outfield players.
   Honest test, shown on the page for the selected league: for every club and every match from its 4th on, the XI is guessed from the
   earlier matches only and compared with the real one. Two simple guesses are scored the same way: "the same XI as last match" and
   "the players who started most often, all matches equal". The page also checks its own percentages: of the players it gave 90%+,
   how many really started. A first try, weighting recent matches more, never beat "same as last match", which is why it is not used.
   No injury or suspension news is known here (only in Fantasy for the Premier League), so a missing player is a surprise to the guess. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.poolOne!=='function')return;
 INS.addPage('xi','Likely line-ups','league','states');
 const XI_COEF={b0:-2.183,b:[-0.818,0.554,0.051,0.901,3.483]},XI_FIT=[8.67,8.51,476],MIN_PRIOR=3,S={team:'',lg:''};
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const logo=t=>typeof logoOf==='function'&&logoOf(t)?`<img src="${esc(logoOf(t))}" alt="" width="16" height="16" class="lk-lg">`:'';
 const pcn=v=>Math.round(v*100);
 /* the guess from a club's earlier matches (oldest first): [{m, xi}], mins = Map 'match|player' → minutes. flat = true: share of starts only */
 function guess(prior,mins,flat){
  const n=prior.length,info=new Map(),gk=new Set(),starts=new Map();
  prior.forEach((h,i)=>h.xi.forEach(p=>{starts.set(p[0],(starts.get(p[0])||0)+1);if(p[3]===11)gk.add(p[0]);info.set(p[0],{id:p[0],name:p[1],code:p[3],x:p[4],y:p[5],last:i})}));
  const st=(pid,k)=>prior[n-k]&&prior[n-k].xi.some(p=>p[0]===pid)?1:0,c=XI_COEF;
  const rank=[...info.values()].map(r=>{const rate=starts.get(r.id)/n;
   const z=c.b0+c.b[0]*st(r.id,1)+c.b[1]*st(r.id,2)+c.b[2]*st(r.id,3)+c.b[3]*rate+c.b[4]*((mins.get(prior[n-1].m.id+'|'+r.id)||0)/90);
   return {...r,p:flat?rate:1/(1+Math.exp(-z))}}).sort((a,b)=>b.p-a.p||b.last-a.last||a.name.localeCompare(b.name));
  const g=rank.filter(r=>gk.has(r.id))[0],out=rank.filter(r=>!gk.has(r.id)).slice(0,g?10:11);
  return {xi:(g?[g]:[]).concat(out),rank};
 }
 async function calc(lid){
  const P=await INS.poolOne(lid,['mx','pl']);if(!P||!P.mx||!P.mx.m||!P.pl)return null;
  const ix={};P.pl.cols.forEach((c,k)=>ix[c]=k);const mins=new Map(),hasPl=new Set();P.pl.rows.forEach(r=>{mins.set(r[ix.m]+'|'+r[ix.i],r[ix.mi]||0);hasPl.add(r[ix.m])});
  const H=new Map();
  P.ms.forEach(m=>{const e=P.mx.m[m.id],lu=e&&e.lu;if(!lu||!hasPl.has(m.id))return;   /* a match without player rows has no minutes: it is left out */
   [['h',m.home],['a',m.away]].forEach(([sd,t])=>{const L=lu[sd];if(!L||!L.xi||L.xi.length!==11)return;(H.get(t)||H.set(t,[]).get(t)).push({m,xi:L.xi})})});
  const B={n:0,model:0,last:0,freq:0,beat:0,tie:0,bins:[[.9,1.01,0,0],[.7,.9,0,0],[.5,.7,0,0],[0,.5,0,0]]};
  H.forEach(h=>{for(let j=MIN_PRIOR;j<h.length;j++){const prior=h.slice(0,j),act=new Set(h[j].xi.map(p=>p[0])),g=guess(prior,mins),f=guess(prior,mins,true);
   const hit=g.xi.filter(p=>act.has(p.id)).length,lastHit=prior[j-1].xi.filter(p=>act.has(p[0])).length;
   B.n++;B.model+=hit;B.last+=lastHit;B.freq+=f.xi.filter(p=>act.has(p.id)).length;if(hit>lastHit)B.beat++;else if(hit===lastHit)B.tie++;
   g.xi.forEach(p=>{const b=B.bins.find(x=>p.p>=x[0]&&p.p<x[1]);if(b){b[2]++;if(act.has(p.id))b[3]++}})}});
  await fixLoad();const now=Date.now(),next=new Map();
  (((FIX.d&&FIX.d.leagues)||{})[lid]||[]).filter(x=>Date.parse(x.k||x.d)>now).sort((a,b)=>String(a.k||a.d).localeCompare(String(b.k||b.d))).forEach(x=>{if(!next.has(x.h))next.set(x.h,{opp:x.a,home:true,k:x.k||x.d,i:x.i});if(!next.has(x.a))next.set(x.a,{opp:x.h,home:false,k:x.k||x.d,i:x.i})});
  return {H,B,next,mins,id:lid};
 }
 R.xi=async function(el){
  el.innerHTML='<h2>Likely line-ups</h2><div id="lxroot" class="ins lk lx"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#lxroot'),lg=D.id;if(S.lg!==lg){S.lg=lg;S.team=''}
  const C=await calc(lg);if(!root.isConnected||D.id!==lg)return;
  const teams=C?[...C.H.keys()].filter(t=>C.H.get(t).length>=MIN_PRIOR).sort((a,b)=>a.localeCompare(b)):[];
  if(!C||teams.length<4||C.B.n<20){root.innerHTML=`<div class="empty">${two(`Not enough line-ups in ${esc(D.name)} yet to guess from.`,`ما فيه تشكيلات كفاية في ${nm(D.name)} للحين عشان نتوقع منها.`)}</div>`;return}
  if(!S.team||!teams.includes(S.team)){const fv=typeof favOf==='function'?favOf():null;S.team=fv&&teams.includes(fv)?fv:teams[0]}
  const B=C.B,avg=v=>(v/B.n).toFixed(2);
  const paint=()=>{
   const h=C.H.get(S.team),g=guess(h,C.mins),nx=C.next.get(S.team),lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
   root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Who starts next?</b> Each player's chance to start comes from five things: whether he started the last three matches, his share of the club's starts, and how much of the last match he played. Then the page checks itself: for every club and every match from its 4th on, it guessed the XI from the earlier matches only.`,
     `<b>مين يبدأ بعدها؟</b> فرصة كل لاعب يبدأ تجي من خمسة أشياء: هل بدأ آخر ثلاث مباريات، ونسبة بدايته من مباريات النادي، وكم لعب من المباراة الأخيرة. وبعدين الصفحة تختبر نفسها: لكل فريق ولكل مباراة من الرابعة، توقّعت التشكيلة من المباريات اللي قبلها بس.`)}</p>
     <div class="lk-hl"><div class="lk-k up"><span>${two('Players right, out of 11 (this guess)','لاعبين صح من 11 (هالتوقع)')}</span><b>${nb(avg(B.model))}</b></div>
      <div class="lk-k"><span>${two('Same XI as last match','نفس تشكيلة المباراة اللي قبلها')}</span><b>${nb(avg(B.last))}</b></div></div>
     <p class="mu">${two(`${B.n} guesses across ${teams.length} clubs of ${esc(D.name)}. It matched or beat "same as last match" in ${pcn((B.beat+B.tie)/B.n)}% of them (strictly better in ${pcn(B.beat/B.n)}%); "players who started most often, all matches equal" got ${avg(B.freq)}. The five numbers were fitted on all six leagues, so this figure is slightly flattering; with one league hidden at a time over ${XI_FIT[2]} guesses the model gets ${XI_FIT[0]} against ${XI_FIT[1]}. Rotation is hard to predict: the gain is small. No injury or suspension news is known here, so a missing player is a surprise to the guess.`,
      `${nb(B.n)} توقع عبر ${nb(teams.length)} نادي من ${nm(D.name)}. طابق أو غلب «نفس التشكيلة السابقة» في ${nb(pcn((B.beat+B.tie)/B.n))}% منها (وكان أفضل بالكامل في ${nb(pcn(B.beat/B.n))}%)؛ و«اللي بدأوا أكثر، كل المباريات سواء» جاب ${nb(avg(B.freq))}. الأرقام الخمسة انضبطت على الدوريات الست كلها، فهذا الرقم أحلى شوي من الواقع؛ وبإخفاء دوري كامل كل مرة على ${nb(XI_FIT[2])} توقع يجيب النموذج ${nb(XI_FIT[0])} مقابل ${nb(XI_FIT[1])}. التدوير صعب التوقع: المكسب صغير. ما نعرف أخبار الإصابات والإيقاف هنا، فغياب لاعب مفاجأة للتوقع.`)}</p></div>
    <div class="card lx-pick"><label class="ctl"><span>${two('Club','النادي')}</span><select id="lxt" aria-label="Club">${teams.map(t=>`<option value="${esc(t)}"${t===S.team?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
     <p class="mu lx-nx">${nx?two(`Next: ${nx.home?'vs':'at'} <b>${esc(nx.opp)}</b>, ${esc(new Date(nx.k).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}`,`القادم: ${nx.home?'ضد':'عند'} <b>${nm(nx.opp)}</b>، ${esc(new Date(nx.k).toLocaleString(lc,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}`):two('No upcoming match in the data; this is the guess for the next one.','ما فيه مباراة قادمة في البيانات؛ هذا التوقع للمباراة اللي بعدها.')}</p></div>
    <div class="lx-two"><div class="card"><h3>${logo(S.team)}${nm(S.team)} · ${two('likely XI','التشكيلة المحتملة')}</h3>${pitch(g)}</div>
     <div class="card"><h3>${two('Chance to start','احتمال البدء')}</h3>${list(g)}</div></div>
    <div class="card"><h3>${two('Does "90%" mean 90%?','هل «90%» تعني 90%؟')}</h3>${calib(B)}</div>`;
   root.querySelector('#lxt').onchange=e=>{S.team=e.target.value;paint()};
  };
  paint();
 };
 /* the XI on a pitch (own goal at the bottom, right side on the right) at each player's latest slot, nudged apart when two share one */
 function pitch(g){
  const W=300,H=380,placed=[];
  const dots=g.xi.map(p=>{let x=30+(p.y==null?.5:p.y)*(W-60),y=H-34-(p.x==null?.5:p.x)*(H-68);
   for(let k=0;k<6&&placed.some(q=>Math.abs(q[0]-x)<30&&Math.abs(q[1]-y)<22);k++)x+=k%2?-32:32;x=Math.max(24,Math.min(W-24,x));placed.push([x,y]);return {p,x,y}});
  return `<div class="lx-pitch"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Likely XI"><rect x="6" y="6" width="${W-12}" height="${H-12}" class="lx-pl"/><line x1="6" x2="${W-6}" y1="${H/2}" y2="${H/2}" class="lx-pl"/><circle cx="${W/2}" cy="${H/2}" r="30" class="lx-pl"/>
   <rect x="${W/2-60}" y="${H-6-62}" width="120" height="62" class="lx-pl"/><rect x="${W/2-60}" y="6" width="120" height="62" class="lx-pl"/>
   ${dots.map(({p,x,y})=>`<g class="lx-d ${p.p>=.9?'a':p.p>=.6?'b':'c'}"${INS.tipAttr([p.name,'Chance to start: '+pcn(p.p)+'%'])}><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10"/><text x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" class="lx-n" text-anchor="middle">${pcn(p.p)}</text><text x="${x.toFixed(1)}" y="${(y+22).toFixed(1)}" class="lx-t" text-anchor="middle">${esc((p.name.split(' ').slice(-1)[0]||p.name).slice(0,12))}</text></g>`).join('')}</svg></div>`;
 }
 function list(g){
  const xi=new Set(g.xi.map(p=>p.id)),bench=g.rank.filter(r=>!xi.has(r.id)).slice(0,5);
  const row=(p,cls)=>`<li class="${cls}"><span class="lx-pn">${nm(p.name)}</span><span class="lx-bar"><i style="width:${pcn(p.p)}%"></i></span><b>${nb(pcn(p.p)+'%')}</b></li>`;
  return `<ol class="lx-list">${g.xi.map(p=>row(p,p.p>=.9?'a':p.p>=.6?'b':'c')).join('')}</ol>
   <h4>${two('Next in line','التالي في الصف')}</h4><ol class="lx-list lx-bench">${bench.map(p=>row(p,'c')).join('')}</ol>
   <p class="mu ins-note">${two('The chance that he starts the next match, from the five things above. Under 60%: a rotation risk.','فرصة إنه يبدأ المباراة القادمة، من الأشياء الخمسة فوق. أقل من 60%: احتمال تدوير.')}</p>`;
 }
 /* the guess's own percentages against what happened */
 function calib(B){
  const nmn=['90% or more','70 to 89%','50 to 69%','under 50%'],nar=['90% أو أكثر','من 70 إلى 89%','من 50 إلى 69%','أقل من 50%'];
  return `<div class="wrap"><table class="lk-t"><thead><tr><th>${two('The page said','الصفحة قالت')}</th><th class="n">${two('Players','لاعبين')}</th><th class="n">${two('Really started','بدأوا فعلًا')}</th></tr></thead><tbody>
   ${B.bins.map((b,i)=>`<tr><td>${two(nmn[i],nar[i])}</td><td class="n">${b[2]}</td><td class="n">${b[2]?nb(pcn(b[3]/b[2])+'%'):'–'}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Only players the guess put in its XI. A percentage that is honest has a "really started" figure close to it.','بس اللاعبين اللي حطّهم التوقع في تشكيلته. النسبة الصادقة يكون رقم «بدأوا فعلًا» قريب منها.')}</p>`;
 }
 INS.ar({"Likely line-ups":"التشكيلات المحتملة","Club":"النادي","Players":"لاعبين"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
