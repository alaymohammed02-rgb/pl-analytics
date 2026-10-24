/* ===== Goalkeepers (#/keepers, in Defence after Pressing maps): goals prevented, and whether it repeats =====
   A shot faced = a goal (own goals left out) or a saved attempt that no outfield player blocked. The keeper is the starting goalkeeper
   (slot 11 of the line-up) of the side that did not shoot; on the 2024-25 and later files, where a shot carries its keeper's id, the two
   agree on 99+% of shots (tools/gk/fit.py). Goals prevented = xGOT (expected goals of the shots on target, PitchAPI's xo) − goals conceded.
   The noise of one keeper's number is sqrt(Σ p(1 − p)) over his shots (p = each shot's xGOT): inside ±1.96 of that, the page says "within noise".
   data/gk_repeat.json (written offline by tools/gk/fit.py) holds the repeat test: the Premier League's five seasons, year to year and odd against
   even matches. It finds no sign that shot-stopping repeats, and the page says so, with how large a correlation the sample cannot rule out. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('keepers','Goalkeepers','analysis','sbpress');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const MIN=20,S={sort:'best',tok:0};
 let CF=null,CK='';
 async function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('gk_repeat.json').then(d=>{if(!d||!d.yoy)throw new Error('gk');return d}).catch(e=>{if(CF===p)CF=null;throw e});CF=p;return p;
 }
 /* every shot faced, with its keeper from the line-ups; {keepers, faced, total, goals, xg} */
 function faced(o){
  const M=new Map(o.L.matches.map(m=>[m.i,m])),gk=new Map(),starts=new Map();
  for(const mid in o.mx.m){const lu=(o.mx.m[mid]||{}).lu||{};
   for(const side of ['h','a']){const xi=((lu[side]||{}).xi)||[],g=xi.find(p=>p[3]===11);if(g){gk.set(mid+'|'+side,[g[0],g[1]]);starts.set(g[0],(starts.get(g[0])||0)+1)}}}
  const K=new Map();let total=0,used=0,goals=0,xg=0;
  for(const s of o.shots){if(s.og||s.bl||(s.ev!=='Goal'&&s.ev!=='AttemptSaved'))continue;total++;
   const m=M.get(s.m);if(!m)continue;const side=s.c===m.h?'a':s.c===m.a?'h':null,k=side&&gk.get(s.m+'|'+side);if(!k)continue;
   used++;const p=+s.xo||0,g=s.ev==='Goal'?1:0;goals+=g;xg+=p;
   let r=K.get(k[0]);if(!r){r={id:k[0],name:k[1],team:{},n:0,g:0,x:0,v:0,st:starts.get(k[0])||0};K.set(k[0],r)}
   r.n++;r.g+=g;r.x+=p;r.v+=p*(1-p);const tm=side==='a'?m.a:m.h;r.team[tm]=(r.team[tm]||0)+1}
  for(const r of K.values()){r.team=Object.keys(r.team).sort((a,b)=>r.team[b]-r.team[a])[0];r.d=r.x-r.g;r.se=Math.sqrt(r.v)}
  return {keepers:[...K.values()],total,used,goals,xg};
 }
 const sa=(v,d)=>(v<0?'سالب ':'')+nb(Math.abs(v).toFixed(d)),f1=v=>(+v).toFixed(1),f2=v=>(+v).toFixed(2),sg=(v,d)=>(v>=0?'+':'−')+Math.abs(v).toFixed(d);
 const reading=r=>r.d>1.96*r.se?['clearly above expected','أحسن من المتوقع بوضوح']:r.d<-1.96*r.se?['clearly below expected','أسوأ من المتوقع بوضوح']:['within noise','ضمن الحظ'];
 R.keepers=async function(el){
  el.innerHTML='<h2>Goalkeepers</h2><div id="gkroot" class="ins lk gk"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#gkroot'),lg=D.id,tok=++S.tok;
  let F,o;try{[F,o]=await Promise.all([load(),INS.poolOne(lg,['sh','mx'])]);if(!o||!o.shots)throw new Error('sh')}catch(e){if(!root.isConnected||tok!==S.tok||D.id!==lg)return;root.innerHTML=`<div class="empty">${two('Could not load the numbers. Try again later.','ما قدرنا نحمّل الأرقام. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!o.mx||!o.mx.m){root.innerHTML=`<div class="empty">${two('This season has no line-ups, so the keeper of each shot is not known.','هذا الموسم ما فيه تشكيلات، فما نعرف حارس كل تسديدة.')}</div>`;return}
  draw(root,F,faced(o),o);
 };
 function draw(root,F,A,o){
  const rows=A.keepers.filter(r=>r.n>=MIN).sort((a,b)=>S.sort==='best'?b.d-a.d||a.name.localeCompare(b.name):S.sort==='worst'?a.d-b.d||a.name.localeCompare(b.name):b.n-a.n||a.name.localeCompare(b.name));
  const y=F.yoy,h=F.half,hi=y.r+1.96*y.se,pct=a=>Math.round(a*100);
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>How many goals did the keeper save beyond what the shots deserved?</b> Every shot on target has an expected-goal value once it is struck (xGOT, which knows where it was aimed). Add up what a keeper faced, take away the goals that went in: that is his <b>goals prevented</b>. Plus means he conceded fewer than the shots deserved.`,
     `<b>كم هدف منع الحارس زيادة عمّا تستاهله التسديدات؟</b> كل تسديدة على المرمى لها قيمة أهداف متوقعة بعد ما تنطلق (xGOT، تعرف وين اتجهت). نجمع اللي واجهه الحارس ونطرح الأهداف اللي دخلت: هذا <b>الأهداف اللي منعها</b>. الزائد يعني دخل عليه أقل مما تستاهله التسديدات.`)}</p>
    <p>${two(`<b>Does it repeat?</b> We checked on the Premier League, ${nb(F.seasons.length)} seasons. A keeper's goals prevented per shot in one season against the next: correlation ${nb(sg(y.r,2))} ± ${nb(f2(y.se))} over ${nb(y.n)} pairs (${nb(y.min_shots+'+')} shots each season). His odd against even matches within a season: ${nb(sg(h.sb,2))} ± ${nb(f2(h.se))} over ${nb(h.n)} keeper-seasons. <b>No sign that it repeats</b>; with this many keepers we cannot rule out a correlation up to about ${nb(f2(hi))}. So one season of this number is mostly luck, and it should not be read as a keeper's quality.`,
     `<b>هل يتكرر؟</b> فحصنا الدوري الإنجليزي، ${nb(F.seasons.length)} مواسم. الأهداف اللي يمنعها الحارس لكل تسديدة في موسم مقابل الموسم اللي بعده: الارتباط ${sa(y.r,2)} ± ${nb(f2(y.se))} على ${nb(y.n)} زوج (${nb(y.min_shots+'+')} تسديدة في كل موسم). ومبارياته الفردية مقابل الزوجية داخل الموسم: ${sa(h.sb,2)} ± ${nb(f2(h.se))} على ${nb(h.n)} موسم حارس. <b>ما فيه دليل إنه يتكرر</b>؛ وبهالعدد من الحراس ما نقدر نستبعد ارتباطًا لين حوالي ${nb(f2(hi))}. فالرقم في موسم واحد أغلبه حظ، وما يُقرأ على إنه جودة الحارس.`)}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('Order','الترتيب')}</span><select id="gks"><option value="best"${S.sort==='best'?' selected':''}>${ar()?'الأكثر منعًا':'most prevented'}</option><option value="worst"${S.sort==='worst'?' selected':''}>${ar()?'الأقل منعًا':'least prevented'}</option><option value="faced"${S.sort==='faced'?' selected':''}>${ar()?'الأكثر تسديدات عليه':'most shots faced'}</option></select></label></div>
    <div class="wrap"><table class="lk-t gk-t"><thead><tr><th>${two('Keeper','الحارس')}</th><th>${two('Team','الفريق')}</th><th class="n">${two('Starts','المباريات')}</th><th class="n">${two('Shots faced','التسديدات عليه')}</th><th class="n">${two('Goals','الأهداف')}</th><th class="n">${nb('xGOT')}</th><th class="n">${two('Prevented','المنوع')}</th><th class="n">${two('Per 100 shots','لكل 100 تسديدة')}</th><th>${two('Reading','القراءة')}</th></tr></thead><tbody>
    ${rows.map(r=>{const w=reading(r);return `<tr data-id="${esc(r.id)}"><td>${nm(r.name)}</td><td>${nm(r.team||'')}</td><td class="n">${r.st}</td><td class="n gk-n">${r.n}</td><td class="n">${r.g}</td><td class="n">${f1(r.x)}</td><td class="n gk-d">${sg(r.d,1)}</td><td class="n gk-p">${sg(r.d/r.n*100,1)}</td><td class="mu">${two(w[0],w[1])}</td></tr>`}).join('')||`<tr><td colspan="9" class="mu">${two('No keeper has faced '+MIN+' shots yet.','ما فيه حارس واجه '+MIN+' تسديدة للحين.')}</td></tr>`}</tbody></table></div>
    <p class="mu ins-note">${two(`Keepers who faced ${MIN}+ shots. ${nb(A.used)} of ${nb(A.total)} shots on target (not blocked) are given to a keeper; the rest have no line-up. League total: ${nb(A.goals)} goals against ${nb(f1(A.xg))} expected from the shots on target. "Within noise" means the number is inside ±${nb('1.96')} of what luck alone moves it (the square root of the sum of each shot's p × (1 − p)). Saves by position, crosses claimed and sweeping are not in this number.`,
     `الحراس اللي واجهوا ${nb(MIN+'+')} تسديدة. ${nb(A.used)} من ${nb(A.total)} تسديدة على المرمى (غير المصدودة) انحسبت على حارس، والباقي ما له تشكيلة. مجموع الدوري: ${nb(A.goals)} هدف مقابل ${nb(f1(A.xg))} متوقع من التسديدات على المرمى. «ضمن الحظ» يعني الرقم داخل ${nb('±1.96')} من اللي يحرّكه الحظ وحده (الجذر التربيعي لمجموع p × (1 − p) لكل تسديدة). الإنقاذات من التمركز والكرات العالية المسيطر عليها والخروج من المرمى مو داخلة في الرقم.`)}</p></div>`;
  root.querySelector('#gks').onchange=e=>{S.sort=e.target.value;draw(root,F,A,o)};
 }
 INS.ar({'Goalkeepers':'الحراس'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
