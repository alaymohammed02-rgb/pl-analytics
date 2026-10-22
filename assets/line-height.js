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
   With the ball / without it: the team in possession at that event. Together: the mean of the two (as asked), shown with both. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 const S={c:'',m:'avg',team:''};let DP=null;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const f1=v=>v==null?'–':(+v).toFixed(1);
 const M={avg:['Both together','الاثنين مع بعض'],in:['With the ball','مع الكرة'],out:['Without the ball','بدون الكرة']};
 const load=()=>{if(!DP)DP=fetch('data/dlh.json?v='+encodeURIComponent((typeof ALL==='object'&&ALL&&ALL.generated)||'')).then(r=>r.ok?r.json():null).catch(()=>null);return DP};
 const val=(t,m)=>m==='avg'?(t.in!=null&&t.out!=null?(t.in+t.out)/2:null):t[m];
 R.height=async function(el){
  el.innerHTML='<h2>Defensive line height</h2><div id="dlroot" class="ins dl"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#dlroot'),X=await load();if(!root.isConnected)return;
  if(!X||!X.comps||!X.comps.length){root.innerHTML='<div class="empty">The defensive line data is not available.</div>';return}
  if(!S.c||!X.comps.some(c=>c.k===S.c))S.c=(X.comps.find(c=>/Bundesliga/.test(c.c))||X.comps[0]).k;
  const draw=()=>{
   const C=X.comps.find(c=>c.k===S.c),T=C.teams.filter(t=>val(t,S.m)!=null).sort((a,b)=>val(b,S.m)-val(a,S.m));
   if(!S.team||!T.some(t=>t.n===S.team))S.team=(T.slice().sort((a,b)=>b.m-a.m)[0]||{}).n;
   const me=C.teams.find(t=>t.n===S.team);
   root.innerHTML=`<div class="card dl-intro"><p>${two(`<b>How high does a team defend?</b> The distance between its own goal line and its deepest outfield player, in metres (pitch 105 m), measured <b>with the ball</b>, <b>without it</b>, and the two together.`,`<b>كم يدافع الفريق عاليًا؟</b> المسافة بين خط مرماه وآخر لاعب ميدان عنده، بالمتر (الملعب 105 م)، <b>مع الكرة</b> و<b>بدون الكرة</b> والاثنين مع بعض.`)}</p>
     <p class="mu">${two(`From free open data of past competitions (StatsBomb 360). Free line data for the current season does not exist, so the site's leagues are not here.`,`من بيانات مفتوحة مجانية لبطولات سابقة (StatsBomb 360). ما فيه بيانات خط دفاع مجانية للموسم الحالي، فدوريات الموقع مو هنا.`)}</p></div>
    <div class="card ctl dl-ctl"><select id="dlc" aria-label="Competition">${X.comps.map(c=>`<option value="${esc(c.k)}"${c.k===S.c?' selected':''}>${esc(c.c)} ${esc(c.s)}${c.g==='female'?' (W)':''}</option>`).join('')}</select>
     <div class="seg" role="group" aria-label="Measure">${Object.entries(M).map(([k,v])=>`<button type="button" data-m="${k}" aria-pressed="${k===S.m}">${two(v[0],v[1])}</button>`).join('')}</div>
     <p class="mu dl-cov">${two(`${C.n} matches · ${T.length} teams. In a club season only some clubs' matches are published (the opponents appear once or twice).`,`${nb(C.n)} مباراة · ${nb(T.length)} فريق. في مواسم الأندية تنشر StatsBomb مباريات أندية محددة بس (والخصوم يظهرون مرة أو مرتين).`)}</p></div>
    <div class="dl-two"><div class="card"><h3>${two(M[S.m][0]+', every team',M[S.m][1]+' لكل الفرق')}</h3>${pitch(T)}</div>
     <div class="card"><h3>${two('Ranking','الترتيب')}</h3>${bars(T)}</div></div>
    ${me?`<div class="card dl-me"><h3>${nm(me.n)}</h3>${detail(me,C)}</div>`:''}
    <div class="card dl-src"><h3>${two('Where the numbers come from','من وين الأرقام')}</h3>
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
 /* the teams on a pitch: a line at each team's height (own goal at the bottom) */
 function pitch(T){
  if(!T.length)return '<div class="empty">No team with this measure.</div>';
  const show=T.slice(0,24),W=360,pw=150,ph=300,px=14,py=16,yv=v=>py+(1-v/105)*ph,H=Math.max(py+ph+20,py+show.length*13+10),LX=px+pw+44;
  const ly=i=>py+6+i*((H-py-16)/Math.max(1,show.length-1));
  return `<div class="ph-svg dl-map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Defensive line heights on a pitch">
   <g class="ph-pitch"><rect x="${px}" y="${py}" width="${pw}" height="${ph}"/><line x1="${px}" x2="${px+pw}" y1="${yv(52.5)}" y2="${yv(52.5)}"/><circle cx="${px+pw/2}" cy="${yv(52.5)}" r="${9.15/68*pw}"/>
    <rect x="${px+pw*(13.84/68)}" y="${yv(16.5)}" width="${pw*(40.32/68)}" height="${yv(0)-yv(16.5)}"/><rect x="${px+pw*(13.84/68)}" y="${yv(105)}" width="${pw*(40.32/68)}" height="${yv(105-16.5)-yv(105)}"/>
    <text x="${px+pw/2}" y="${yv(0)+13}" class="ins-ax" text-anchor="middle">own goal · 0 m</text></g>
   ${show.map((t,i)=>[t,i]).sort((x,y)=>(x[0].n===S.team)-(y[0].n===S.team)).map(([t,i])=>{const v=val(t,S.m),y=yv(v),yy=ly(i),me=t.n===S.team;return `<g class="dl-ln${me?' me':''}" data-tm="${esc(t.n)}"${INS.tipAttr([t.n,f1(v)+' m',t.m+' match'+(t.m===1?'':'es')])}><line x1="${px}" x2="${px+pw}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><polyline points="${px+pw},${y.toFixed(1)} ${px+pw+12},${y.toFixed(1)} ${LX-6},${yy.toFixed(1)}" fill="none"/>
    <text x="${LX}" y="${(yy+4).toFixed(1)}" class="ph-lt"><tspan class="dl-v">${f1(v)}</tspan> ${esc(t.n.length>20?t.n.slice(0,19)+'…':t.n)}</text></g>`}).join('')}</svg></div>
   ${T.length>show.length?`<p class="mu ins-note">${two(`The ${show.length} highest are drawn; all ${T.length} are in the ranking.`,`مرسوم أعلى ${nb(show.length)}؛ كلهم (${nb(T.length)}) في الترتيب.`)}</p>`:''}`;
 }
 function bars(T){
  const mx=Math.max(...T.map(t=>val(t,S.m)));
  return `<ol class="ph-bars dl-bars">${T.map((t,i)=>`<li class="${t.n===S.team?'me':''}"><button type="button" data-tm="${esc(t.n)}"><span class="ph-br">${i+1}</span><span></span><span class="ph-bn">${nm(t.n)}</span><span class="ph-bb"><i style="width:${(val(t,S.m)/mx*100).toFixed(1)}%;background:var(--th-hi)"></i></span><b>${f1(val(t,S.m))}</b></button></li>`).join('')}</ol>
   <p class="mu ins-note">${two('Metres from the own goal line, averaged over the team\'s matches. Tap a team for its matches.','بالمتر من خط المرمى، متوسط مباريات الفريق. اضغط فريق تشوف مبارياته.')}</p>`;
 }
 function detail(t,C){
  const ms=C.matches.filter(m=>m.t[t.n]).sort((a,b)=>a.d.localeCompare(b.d));
  return `<p>${two(`With the ball <b>${f1(t.in)} m</b> · without it <b>${f1(t.out)} m</b> · together <b>${f1(val(t,'avg'))} m</b>, over ${t.m} match${t.m===1?'':'es'}.`,`مع الكرة <b>${nb(f1(t.in)+' م')}</b> · بدون الكرة <b>${nb(f1(t.out)+' م')}</b> · الاثنين <b>${nb(f1(val(t,'avg'))+' م')}</b>، في ${nb(t.m)} مباراة.`)}</p>
   <div class="wrap"><table class="dl-t"><thead><tr><th>Date</th><th>Match</th><th class="n">With the ball</th><th class="n">Without the ball</th></tr></thead><tbody>
    ${ms.map(m=>{const v=m.t[t.n];return `<tr><td>${esc(m.d)}</td><td>${nm(m.h)} ${nb(esc(m.sc))} ${nm(m.a)}</td><td class="n">${f1(v.in)}</td><td class="n">${f1(v.out)}</td></tr>`}).join('')}</tbody></table></div>`;
 }
 INS.ar({"Defensive line height":"ارتفاع خط الدفاع","Ranking":"الترتيب","Measure":"المقياس","Competition":"البطولة","With the ball":"مع الكرة","Without the ball":"بدون الكرة","Date":"التاريخ","Match":"المباراة",
  "The defensive line data is not available.":"بيانات خط الدفاع مو متوفرة.","No team with this measure.":"ما فيه فريق بهالمقياس.","own goal · # m":"المرمى · # م"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
