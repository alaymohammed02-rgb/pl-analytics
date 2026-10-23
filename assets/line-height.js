/* ===== Height (#/height, in Analysis): defensive line height, with the ball, without it, and the two together =====
   Definition: the distance between a team's own goal line and its deepest outfield player, in metres on a 105 m pitch.
   Data: data/dlh.json, made offline (see the method below) from free open data:
   - StatsBomb Open Data 360 (github.com/statsbomb/open-data): for every event, the positions of the players the broadcast camera
     shows, and the area it shows. Used under its terms: analysis only, the raw data is not republished here, credited with the
     StatsBomb logo, not for commercial use. Competitions: the ones StatsBomb publishes with 360 frames (past seasons and
     tournaments); free current-season line data does not exist.
   - SkillCorner Open Data (github.com/SkillCorner/opendata): full tracking of 20 matches (every player, every frame). The deepest
     defender is often outside the camera's view, so the deepest visible one overstates the line (by about 6 m in those 20 matches).
     A model trained on SkillCorner frames (what the camera shows → where the deepest outfield player really is) corrects that:
     tested on matches it had not seen, a team's match average is off by 0.31 m on average (1.06 m at most).
   Current season of the selected league (first choice): an ESTIMATE, not a measurement. line = a + b·CB (+ c·ALL) + d·tilt per measure, fitted on the
   833 team-matches above (CB = the starting centre-backs' average position, ALL = the starting outfield players' average position, both from PitchAPI's heat maps, tilt = field tilt); data/dlh.json
   holds the coefficients and the leave-one-competition-out errors, which the page prints next to the numbers.
   Current season also has a MEASURED fourth choice, the defenders' average position: for every starter in the defensive line (official
   line-up slots 30-39: centre-backs and full- or wing-backs), the average place of his actions in the match (PitchAPI heat maps, in m from
   his own goal), then the mean of the team's defenders (3 or more with data), then the mean of the team's matches. It is where the
   defenders were when they did something, like the "average positions" of other sites; it is not split with / without the ball.
   With the ball / without it: the team in possession at that event. Together: the mean of the two (as asked), shown with both. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 const S={c:'',m:'avg',team:''};let DP=null;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const f1=v=>v==null?'–':(+v).toFixed(1);
 const lbl={get cur(){return document.documentElement.lang==='ar'?'الموسم الحالي':'current season'}};   /* the line under the menu says, per measure, estimate or measured */
 const M={avg:['Both together','الاثنين مع بعض'],in:['With the ball','مع الكرة'],out:['Without the ball','بدون الكرة'],def:["Defenders' average (measured)",'متوسط المدافعين (مقاس)']};
 const load=()=>{if(!DP)DP=fetch('data/dlh.json?v='+encodeURIComponent((typeof ALL==='object'&&ALL&&ALL.generated)||'')).then(r=>r.ok?r.json():null).catch(()=>null);return DP};
 const val=(t,m)=>m==='avg'?(t.in!=null&&t.out!=null?(t.in+t.out)/2:null):t[m];
 const cnt=t=>S.m==='def'?t.dm:t.m;   /* matches behind the number shown */
 /* The current season of the selected league: an estimate from a formula (a + b·centre-backs' average position + c·field tilt, fitted
    on the past competitions below), per match and per team. Needs the league's PitchAPI files; null when it has none. */
 let EST=null;
 async function estimate(X){
  const lg=D&&D.id;if(!X.est||typeof INS.phRows!=='function')return null;
  if(EST&&EST.id===lg)return EST.v;
  let v=null;
  try{
   const K=X.est.coef;
   /* a measure's terms (cb, out, tilt) are looked up on the row; a term the row lacks makes the match unusable for that measure */
   const at=(k,r)=>{const c=K[k];let v=c.b[0];for(let i=0;i<c.t.length;i++){const x=r[c.t[i]==='out'?'ox':c.t[i]];if(x==null||!isFinite(x))return null;v+=c.b[i+1]*x}return v},T=new Map(),Mt=new Map();
   const all=(await INS.phRows(true));
   all.forEach(r=>{const ok=r.cb!=null&&isFinite(r.cb)&&r.tilt!=null&&isFinite(r.tilt),o={in:ok?at('in',r):null,out:ok?at('out',r):null,def:r.dx!=null&&isFinite(r.dx)?r.dx:null};
    const est=o.in!=null&&o.out!=null;if(!est&&o.def==null)return;
    const t=T.get(r.n)||{n:r.n,m:0,i:0,o:0,dm:0,ds:0};if(est){t.m++;t.i+=o.in;t.o+=o.out}if(o.def!=null){t.dm++;t.ds+=o.def}T.set(r.n,t);
    const m=Mt.get(r.m)||{d:r.d,h:r.match.home,a:r.match.away,sc:String(r.match.score||''),t:{}};m.t[r.n]=o;Mt.set(r.m,m)});
   const teams=[...T.values()].filter(t=>t.m>=3||t.dm>=3).map(t=>({n:t.n,m:t.m,dm:t.dm,in:t.m>=3?t.i/t.m:null,out:t.m>=3?t.o/t.m:null,def:t.dm>=3?t.ds/t.dm:null}));
   if(teams.filter(t=>t.in!=null).length>=4)v={k:'cur',cur:true,c:(typeof lgMeta==='function'&&lgMeta().name)||'Current league',s:'',g:'male',n:Mt.size,teams,matches:[...Mt.values()]};
  }catch(e){v=null}
  if(D&&D.id===lg)EST={id:lg,v};
  return v;
 }
 R.height=async function(el){
  el.innerHTML='<h2>Defensive line height</h2><div id="dlroot" class="ins dl"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#dlroot'),lg0=D&&D.id,X0=await load(),CUR=X0?await estimate(X0):null;if(!root.isConnected||(D&&D.id!==lg0))return;
  const X=X0&&CUR?{...X0,comps:[CUR,...X0.comps]}:X0;
  if(!X||!X.comps||!X.comps.length){root.innerHTML='<div class="empty">The defensive line data is not available.</div>';return}
  if(!S.c||!X.comps.some(c=>c.k===S.c))S.c=CUR?'cur':(X.comps.find(c=>/Bundesliga/.test(c.c))||X.comps[0]).k;
  const draw=()=>{
   const C=X.comps.find(c=>c.k===S.c);if(S.m==='def'&&!C.cur)S.m='avg';
   const T=C.teams.filter(t=>val(t,S.m)!=null).sort((a,b)=>val(b,S.m)-val(a,S.m)),MS=Object.keys(M).filter(k=>k!=='def'||C.cur);
   if(!S.team||!T.some(t=>t.n===S.team))S.team=(T.slice().sort((a,b)=>cnt(b)-cnt(a))[0]||{}).n;
   const me=C.teams.find(t=>t.n===S.team);
   root.innerHTML=`<div class="card dl-intro"><p>${two(`<b>How high does a team defend?</b> The distance between its own goal line and its deepest outfield player, in metres (pitch 105 m), measured <b>with the ball</b>, <b>without it</b>, and the two together.`,`<b>كم يدافع الفريق عاليًا؟</b> المسافة بين خط مرماه وآخر لاعب ميدان عنده، بالمتر (الملعب 105 م)، <b>مع الكرة</b> و<b>بدون الكرة</b> والاثنين مع بعض.`)}</p>
     <p class="mu">${CUR?two(`The first choice is this league's current season: the line is an <b>estimate</b>, since no free source measures it, and <b>Defenders' average</b> is measured (where the starting defenders did their actions). The other choices are <b>measured</b>, from free open data of past competitions (StatsBomb 360).`,`أول خيار هو الموسم الحالي لهذا الدوري: الخط <b>تقدير</b>، لأن ما فيه مصدر مجاني يقيسه، و<b>متوسط المدافعين</b> مقاس (وين سوّى المدافعين الأساسيين أفعالهم). باقي الخيارات <b>مقاسة</b> من بيانات مفتوحة مجانية لبطولات سابقة (StatsBomb 360).`):two(`From free open data of past competitions (StatsBomb 360). Free line data for the current season does not exist, so the site's leagues are not here.`,`من بيانات مفتوحة مجانية لبطولات سابقة (StatsBomb 360). ما فيه بيانات خط دفاع مجانية للموسم الحالي، فدوريات الموقع مو هنا.`)}</p></div>
    <div class="card ctl dl-ctl"><select id="dlc" aria-label="Competition">${X.comps.map(c=>`<option value="${esc(c.k)}"${c.k===S.c?' selected':''}>${c.cur?esc(c.c)+' · '+esc(lbl.cur):esc(c.c)+' '+esc(c.s)+(c.g==='female'?' (W)':'')}</option>`).join('')}</select>
     <div class="seg" role="group" aria-label="Measure">${MS.map(k=>[k,M[k]]).map(([k,v])=>`<button type="button" data-m="${k}" aria-pressed="${k===S.m}">${two(v[0],v[1])}</button>`).join('')}</div>
     <p class="mu dl-cov">${C.cur&&S.m==='def'?two(`${C.n} matches · ${T.length} teams (3+ matches each). Measured from PitchAPI heat maps.`,`${nb(C.n)} مباراة · ${nb(T.length)} فريق (3 مباريات أو أكثر لكل فريق). مقاس من خرائط PitchAPI.`):C.cur?two(`${C.n} matches · ${T.length} teams (3+ matches each). Estimated, not measured.`,`${nb(C.n)} مباراة · ${nb(T.length)} فريق (3 مباريات أو أكثر لكل فريق). تقدير مو قياس.`):two(`${C.n} matches · ${T.length} teams. In a club season only some clubs' matches are published (the opponents appear once or twice).`,`${nb(C.n)} مباراة · ${nb(T.length)} فريق. في مواسم الأندية تنشر StatsBomb مباريات أندية محددة بس (والخصوم يظهرون مرة أو مرتين).`)}</p></div>
    <div class="dl-two"><div class="card"><h3>${two(M[S.m][0]+', every team',M[S.m][1]+' لكل الفرق')}</h3>${pitch(T)}</div>
     <div class="card"><h3>${two('Ranking','الترتيب')}</h3>${bars(T)}</div></div>
    ${me?`<div class="card dl-me"><h3>${nm(me.n)}</h3>${detail(me,C)}</div>`:''}
    ${C.cur?(S.m==='def'?defCard(T):estCard(X,S.m)):''}
    <div class="card dl-src"><h3>${two(C.cur?'The measured part: where it comes from':'Where the numbers come from',C.cur?'الجزء المقاس: من وين يجي':'من وين الأرقام')}</h3>
     <p>${two(`StatsBomb's free 360 data gives, for every event, the players the TV camera shows. The deepest defender is often outside the picture, so the deepest <i>visible</i> player overstates the line. A correction model was trained on SkillCorner's free full-tracking data (${X.val.matches} matches, every player in every frame): from what the camera shows, it estimates where the deepest outfield player really is. Tested on matches it had not seen, a team's average in a match is off by <b>${X.val.mae.toFixed(2)} m</b> on average (${X.val.max.toFixed(2)} m at most); the uncorrected deepest-visible player is off by ${X.val.raw.toFixed(1)} m.`,
       `بيانات 360 المجانية من StatsBomb تعطي في كل لقطة اللاعبين اللي تشوفهم كاميرا البث. آخر مدافع كثير يكون برا الصورة، فآخر لاعب <i>ظاهر</i> يبالغ في ارتفاع الخط. دربنا نموذج تصحيح على بيانات التتبع الكاملة المجانية من SkillCorner (${nb(X.val.matches)} مباراة، كل لاعب في كل لقطة): من اللي تشوفه الكاميرا، يقدّر وين آخر لاعب ميدان فعلًا. على مباريات ما شافها، يخطئ في متوسط الفريق بالمباراة بـ<b>${nb(X.val.mae.toFixed(2)+' م')}</b> بالمتوسط (أقصى ${nb(X.val.max.toFixed(2)+' م')})؛ بدون التصحيح الخطأ ${nb(X.val.raw.toFixed(1)+' م')}.`)}</p>
     <p class="mu">${two('The model learnt from Australian league broadcasts; StatsBomb\'s competitions are filmed the same way, but its error there could not be measured (no full tracking of those matches is free).','النموذج تعلّم من بث الدوري الأسترالي؛ بطولات StatsBomb تتصور بنفس الطريقة، لكن خطأه عليها ما ينقاس (ما فيه تتبع كامل مجاني لهالمباريات).')}</p>
     <div class="dl-att"><a href="https://github.com/statsbomb/open-data" target="_blank" rel="noopener"><img src="assets/statsbomb-logo.svg" alt="Hudl StatsBomb" width="170" height="22"></a><span class="mu">${two('Data: StatsBomb Open Data (360). Correction trained on SkillCorner Open Data.','البيانات: StatsBomb Open Data (360). التصحيح مدرّب على SkillCorner Open Data.')}</span></div></div>`;
   const q=s=>root.querySelector(s);
   q('#dlc').onchange=e=>{S.c=e.target.value;S.team='';draw()};
   root.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{S.m=b.dataset.m;draw()}));
   root.querySelectorAll('[data-tm]').forEach(b=>b.addEventListener('click',()=>{S.team=b.dataset.tm;draw();const d=q('.dl-me');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest',behavior:'smooth'})}));
  };
  draw();
 };
 /* how the estimate is made, how well it did on data with a known answer, and what is not proven */
 function estCard(X,m){
  const E=X.est,V=E.val[m],K=E.coef[m],fx=n=>(+n).toFixed(2),nm2={avg:['both together','الاثنين مع بعض'],in:['with the ball','مع الكرة'],out:['without the ball','بدون الكرة']}[m];
  const TN={cb:['CB','CB'],out:['ALL','الكل'],tilt:['tilt','الميل']};
  const fe=`${fx(K.b[0])}${K.t.map((t,i)=>` + ${fx(K.b[i+1])} × ${TN[t][0]}`).join('')}`,fa=`${nb(fx(K.b[0]))}${K.t.map((t,i)=>` + ${nb(fx(K.b[i+1]))} × ${TN[t][1]}`).join('')}`;
  const usesPos=K.t.some(t=>t==='cb'||t==='out'),sh=Math.abs(V.shift1);
  return `<div class="card dl-est"><h3>${two('An estimate, not a measurement','تقدير مو قياس')}</h3>
   <p>${two(`No free source measures the line in the current season, so this is a formula fitted on the ${E.n} team-matches of the ${E.comps} past competitions, where the line is known. ${nm2[0][0].toUpperCase()+nm2[0].slice(1)}: <b dir="ltr">line = ${fe}</b>. <b>CB</b> = the starting centre-backs' average position, <b>ALL</b> = the average position of the starting outfield players (both in m from their own goal, from PitchAPI's heat maps), <b>tilt</b> = field tilt (%).`,
    `ما فيه مصدر مجاني يقيس الخط في الموسم الحالي، فهذي معادلة مبنية على ${nb(E.n)} فريق-مباراة من ${nb(E.comps)} بطولة سابقة نعرف فيها الخط. ${nm2[1]}: <b dir="rtl">الخط = ${fa}</b>. <b>CB</b> = متوسط مكان قلبي الدفاع الأساسيين، <b>الكل</b> = متوسط مكان لاعبي الميدان الأساسيين (الاثنين بالمتر من مرماهم، من خرائط PitchAPI)، <b>الميل</b> = ميل الملعب Field Tilt (%).`)}</p>
   <p>${two(`Tested by hiding one competition at a time, a team's season average is off by <b>${V.season_mae} m</b> on average (${V.season_max} m at most) — against ${V.base_mae} m if the same value is guessed for every team. A single match is off by ${V.match_mae} m. The estimates are not squeezed or stretched (held-out slope ${V.slope}), and a whole competition can sit up to about ${V.bias_max} m too high or too low.`,
    `باختبار تخبّي فيه بطولة وحدة كل مرة، متوسط الفريق في الموسم يخطئ بـ<b>${nb(V.season_mae+' م')}</b> بالمتوسط (أقصى ${nb(V.season_max+' م')}) — مقابل ${nb(V.base_mae+' م')} لو خمّنا نفس القيمة لكل الفرق. والمباراة الوحدة تخطئ بـ${nb(V.match_mae+' م')}. التقدير ما هو مضغوط ولا ممدود (الميل ${nb(V.slope)})، وبطولة كاملة ممكن تكون أعلى أو أدنى بحوالي ${nb(V.bias_max+' م')}.`)}</p>
   <p class="mu">${two(`Not proven: it was not tested inside one club league (too few club teams have enough matches in the open data), and PitchAPI's positions are assumed to be measured like StatsBomb's (the levels are close: about 37 to 38 m for centre-backs in the site's leagues, 35 to 40 m in StatsBomb's club competitions). ${usesPos?`If PitchAPI measured every position 1 m differently, all the numbers would move by ${sh.toFixed(2)} m together and the order of teams would hardly change.`:`This measure hardly depends on the positions (1 m of difference moves it by ${sh.toFixed(2)} m).`} Use it to compare teams, not as an exact value.`,
    `غير مثبت: ما انختبرت داخل دوري أندية واحد (فرق الأندية في البيانات المفتوحة ما عندها مباريات كافية)، ونفترض إن مواقع PitchAPI تقاس مثل StatsBomb (المستويات قريبة: حوالي ${nb('37')} إلى ${nb('38')} م لقلبي الدفاع في دوريات الموقع، ومن ${nb('35')} إلى ${nb('40')} م في بطولات الأندية عند StatsBomb). ${usesPos?`لو PitchAPI يقيس كل المواقع بفرق متر، كل الأرقام تتحرك مع بعض بـ${nb(sh.toFixed(2)+' م')} وترتيب الفرق ما يتغير تقريبًا.`:`هذا المقياس ما يعتمد تقريبًا على المواقع (فرق متر يحركه ${nb(sh.toFixed(2)+' م')}).`} استخدمه للمقارنة بين الفرق، مو كقيمة دقيقة.`)}</p></div>`;
 }
 /* the teams on a pitch: a line at each team's height (own goal at the bottom) */
 function pitch(T){
  if(!T.length)return '<div class="empty">No team with this measure.</div>';
  const show=T.slice(0,24),W=360,pw=150,ph=300,px=14,py=16,yv=v=>py+(1-v/105)*ph,H=Math.max(py+ph+20,py+show.length*13+10),LX=px+pw+44;
  const ly=i=>py+6+i*((H-py-16)/Math.max(1,show.length-1));
  return `<div class="ph-svg dl-map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Defensive line heights on a pitch">
   <g class="ph-pitch"><rect x="${px}" y="${py}" width="${pw}" height="${ph}"/><line x1="${px}" x2="${px+pw}" y1="${yv(52.5)}" y2="${yv(52.5)}"/><circle cx="${px+pw/2}" cy="${yv(52.5)}" r="${9.15/68*pw}"/>
    <rect x="${px+pw*(13.84/68)}" y="${yv(16.5)}" width="${pw*(40.32/68)}" height="${yv(0)-yv(16.5)}"/><rect x="${px+pw*(13.84/68)}" y="${yv(105)}" width="${pw*(40.32/68)}" height="${yv(105-16.5)-yv(105)}"/>
    <text x="${px+pw/2}" y="${yv(0)+13}" class="ins-ax" text-anchor="middle">own goal · 0 m</text></g>
   ${show.map((t,i)=>[t,i]).sort((x,y)=>(x[0].n===S.team)-(y[0].n===S.team)).map(([t,i])=>{const v=val(t,S.m),y=yv(v),yy=ly(i),me=t.n===S.team;return `<g class="dl-ln${me?' me':''}" data-tm="${esc(t.n)}"${INS.tipAttr([t.n,f1(v)+' m',cnt(t)+' match'+(cnt(t)===1?'':'es')])}><line x1="${px}" x2="${px+pw}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><polyline points="${px+pw},${y.toFixed(1)} ${px+pw+12},${y.toFixed(1)} ${LX-6},${yy.toFixed(1)}" fill="none"/>
    <text x="${LX}" y="${(yy+4).toFixed(1)}" class="ph-lt"><tspan class="dl-v">${f1(v)}</tspan> ${esc(t.n.length>20?t.n.slice(0,19)+'…':t.n)}</text></g>`}).join('')}</svg></div>
   ${T.length>show.length?`<p class="mu ins-note">${two(`The ${show.length} highest are drawn; all ${T.length} are in the ranking.`,`مرسوم أعلى ${nb(show.length)}؛ كلهم (${nb(T.length)}) في الترتيب.`)}</p>`:''}`;
 }
 function bars(T){
  const mx=Math.max(...T.map(t=>val(t,S.m)));
  return `<ol class="ph-bars dl-bars">${T.map((t,i)=>`<li class="${t.n===S.team?'me':''}"><button type="button" data-tm="${esc(t.n)}"><span class="ph-br">${i+1}</span><span></span><span class="ph-bn">${nm(t.n)}</span><span class="ph-bb"><i style="width:${(val(t,S.m)/mx*100).toFixed(1)}%;background:var(--th-hi)"></i></span><b>${f1(val(t,S.m))}</b></button></li>`).join('')}</ol>
   <p class="mu ins-note">${two('Metres from the own goal line, averaged over the team\'s matches. Tap a team for its matches.','بالمتر من خط المرمى، متوسط مباريات الفريق. اضغط فريق تشوف مبارياته.')}</p>`;
 }
 function detail(t,C){
  const ms=C.matches.filter(m=>m.t[t.n]).sort((a,b)=>a.d.localeCompare(b.d)),ap=C.cur?'≈ ':'',dv=C.cur&&t.def!=null;
  const est=t.in!=null&&t.out!=null;
  return `<p>${two(`${est?`With the ball <b>${ap}${f1(t.in)} m</b> · without it <b>${ap}${f1(t.out)} m</b> · together <b>${ap}${f1(val(t,'avg'))} m</b>, over ${t.m} match${t.m===1?'':'es'}.`:''}${dv?` Defenders' average <b>${f1(t.def)} m</b> (measured, ${t.dm} match${t.dm===1?'':'es'}).`:''}`,
    `${est?`مع الكرة <b>${nb(ap+f1(t.in)+' م')}</b> · بدون الكرة <b>${nb(ap+f1(t.out)+' م')}</b> · الاثنين <b>${nb(ap+f1(val(t,'avg'))+' م')}</b>، في ${nb(t.m)} مباراة.`:''}${dv?` متوسط المدافعين <b>${nb(f1(t.def)+' م')}</b> (مقاس، ${nb(t.dm)} مباراة).`:''}`)}</p>
   <div class="wrap"><table class="dl-t"><thead><tr><th>Date</th><th>Match</th><th class="n">With the ball</th><th class="n">Without the ball</th>${C.cur?'<th class="n">Defenders</th>':''}</tr></thead><tbody>
    ${ms.map(m=>{const v=m.t[t.n];return `<tr><td>${esc(m.d)}</td><td>${nm(m.h)} ${nb(esc(m.sc))} ${nm(m.a)}</td><td class="n">${f1(v.in)}</td><td class="n">${f1(v.out)}</td>${C.cur?`<td class="n">${f1(v.def)}</td>`:''}</tr>`}).join('')}</tbody></table></div>`;
 }
 /* the defenders' average: a measurement, what it is and what it is not */
 function defCard(T){
  const v=T.map(t=>t.def),mean=v.reduce((a,b)=>a+b,0)/v.length,hi=T[0],lo=T[T.length-1];
  return `<div class="card dl-est dl-def"><h3>${two("Defenders' average: measured","متوسط المدافعين: مقاس")}</h3>
   <p>${two(`For every starter in the defensive line (centre-backs and full- or wing-backs, from the official line-up), PitchAPI's heat map gives where he did his actions in the match. The page takes the average place of each defender's actions, in metres from his own goal, then the mean of the team's defenders, then the mean of its matches. Across the league: <b>${f1(mean)} m</b>, from ${f1(lo.def)} m (${esc(lo.n)}) to ${f1(hi.def)} m (${esc(hi.n)}).`,
    `لكل لاعب أساسي في خط الدفاع (قلوب الدفاع والأظهرة، من التشكيلة الرسمية)، خريطة PitchAPI الحرارية تعطي وين سوّى أفعاله في المباراة. الصفحة تاخذ متوسط مكان أفعال كل مدافع، بالمتر من مرماه، وبعدين متوسط مدافعي الفريق، وبعدين متوسط مبارياته. في الدوري كله: <b>${nb(f1(mean)+' م')}</b>، من ${nb(f1(lo.def)+' م')} (${nm(lo.n)}) إلى ${nb(f1(hi.def)+' م')} (${nm(hi.n)}).`)}</p>
   <p class="mu">${two(`It is where the defenders were <b>when they did something</b> (passes, tackles, clearances…), like the "average positions" of other sites, not where they stood every second, so a defender who steps up to pass in midfield raises it. It cannot be split with / without the ball. It is higher than the line above (the deepest outfield player), by about 7 to 8 m, because it averages all the defenders, full-backs included.`,
    `هو وين كانوا المدافعين <b>لما سوّوا شي</b> (تمرير، افتكاك، تشتيت…)، مثل «متوسط المراكز» في المواقع الثانية، مو وين وقفوا كل ثانية، فالمدافع اللي يتقدم يمرر في نص الملعب يرفعه. ما ينقسم مع الكرة / بدون الكرة. وهو أعلى من الخط فوق (آخر لاعب ميدان) بحوالي ${nb('7')} إلى ${nb('8')} م، لأنه متوسط كل المدافعين ومعهم الأظهرة.`)}</p></div>`;
 }
 INS.ar({"Defensive line height":"ارتفاع خط الدفاع","An estimate, not a measurement":"تقدير مو قياس","Ranking":"الترتيب","Measure":"المقياس","Competition":"البطولة","With the ball":"مع الكرة","Without the ball":"بدون الكرة","Defenders":"المدافعين","Date":"التاريخ","Match":"المباراة",
  "The defensive line data is not available.":"بيانات خط الدفاع مو متوفرة.","No team with this measure.":"ما فيه فريق بهالمقياس.","own goal · # m":"المرمى · # م"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
