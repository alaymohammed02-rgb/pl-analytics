/* ===== Model report card (#/reportcard, in Analysis after Who carries the team): how good the match model really is =====
   The model is the Intelligence Lab's "xG Poisson" (INS.mm): a club's attack and defence strength = its xG for and against per match,
   pulled towards its starting point (last season's strengths, worth 12 matches, when data/priors.json has the league; else the league
   mean, worth 3); both sides' goals are Poisson; the result is the chance of a home win, a draw and an away win.
   Test: for every finished match of the six domestic leagues with xG for both sides, the model is asked for the result with that match
   LEFT OUT of every strength, so it never sees what it is predicting (a club needs 3 other matches). Judged by:
   - Brier score (sum over the three results of (chance − what happened)², lower is better, 0 perfect);
   - the same score for a model that only knows the league's home / draw / away shares in the other matches ("base rates");
   - skill = 1 − Brier ÷ Brier of the base rates (0 = no better than base rates, negative = worse);
   - accuracy of the most likely result, and a reliability table: of all the chances the model gave near X%, how often it happened. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.pool!=='function'||typeof INS.mm!=='function')return;
 INS.addPage('reportcard','Model report card','analysis','carry');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const f3=v=>v==null?'–':(+v).toFixed(3),pc=v=>Math.round(v*100);
 let CP=null,CK='';
 const brier=(p,o)=>p.reduce((s,x,i)=>s+Math.pow(x-(i===o?1:0),2),0);
 async function calc(){
  const P=await INS.pool(['sh']);if(P.miss.length)return {miss:P.miss};
  const out=[],bins=Array.from({length:10},()=>({n:0,p:0,h:0}));
  const all={n:0,b:0,bb:0,bu:0,ll:0,acc:0,accB:0,goalsP:0,goalsA:0};
  P.leagues.forEach(o=>{
   const mm=INS.mm(o.ms,o.xg,o.prior);if(!mm)return;
   const used=o.ms.filter(m=>o.xg.has(m.id+'|'+m.home)&&o.xg.has(m.id+'|'+m.away));
   const res=m=>m.hg>m.ag?0:m.hg===m.ag?1:2,cnt=[0,0,0];used.forEach(m=>cnt[res(m)]++);
   const L={l:o.l,n:0,b:0,bb:0,bu:0,acc:0,accB:0,goalsP:0,goalsA:0,skipped:0};
   used.forEach(m=>{const r=mm(m.home,m.away,m.id);if(!r){L.skipped++;return}
    const k=res(m),others=[cnt[0]-(k===0),cnt[1]-(k===1),cnt[2]-(k===2)],tot=others[0]+others[1]+others[2],base=others.map(x=>x/tot);
    const b=brier(r.p,k),bb=brier(base,k),bu=brier([1/3,1/3,1/3],k),pick=r.p.indexOf(Math.max(...r.p)),pickB=base.indexOf(Math.max(...base));
    L.n++;L.b+=b;L.bb+=bb;L.bu+=bu;L.acc+=pick===k?1:0;L.accB+=pickB===k?1:0;L.goalsP+=r.lh+r.la;L.goalsA+=m.hg+m.ag;
    all.n++;all.b+=b;all.bb+=bb;all.bu+=bu;all.ll+=-Math.log(Math.max(r.p[k],1e-9));all.acc+=pick===k?1:0;all.accB+=pickB===k?1:0;all.goalsP+=r.lh+r.la;all.goalsA+=m.hg+m.ag;
    r.p.forEach((p,i)=>{const q=bins[Math.min(9,Math.floor(p*10))];q.n++;q.p+=p;q.h+=i===k?1:0})});
   if(L.n)out.push(L)});
  return {rows:out,all,bins,P};
 }
 /* model against the bookmakers' closing odds, on the finished matches that have both: same leave-one-out model, same base rates */
 async function market(P){
  let M;try{M=await loadJson('market.json',ALL.generated)}catch(e){return {none:true}}
  if(!M||!M.leagues)return {none:true};
  const rows=[],A={n:0,b1:0,b2:0,m:0,bb:0,accB:0,accM:0,acc1:0,acc2:0,d12:0,d12s:0,d2m:0,d2ms:0,mg:0,priors:0};
  P.leagues.forEach(o=>{
   const K=M.leagues[o.l.id];if(!K||!K.rows)return;
   const mm1=INS.mm(o.ms,o.xg),mm2=INS.mm(o.ms,o.xg,o.prior);if(!mm1||!mm2)return;
   const byId=new Map(o.ms.map(m=>[m.id,m])),res=m=>m.hg>m.ag?0:m.hg===m.ag?1:2,cnt=[0,0,0];o.ms.forEach(m=>cnt[res(m)]++);
   const L={l:o.l,n:0,b1:0,b2:0,m:0,bb:0,prior:!!(o.prior&&o.prior.teams)};if(L.prior)A.priors++;
   K.rows.forEach(r=>{
    const m=byId.get(r.m);if(!m||!r.fin||!r.p||r.p.length!==3)return;
    const q1=mm1(m.home,m.away,m.id),q2=mm2(m.home,m.away,m.id);if(!q1||!q2)return;   /* the matches model 1 can predict: the same ones for every row of the table */
    const k=res(m),oth=[cnt[0]-(k===0),cnt[1]-(k===1),cnt[2]-(k===2)],tot=oth[0]+oth[1]+oth[2],base=oth.map(x=>x/tot);
    const b1=brier(q1.p,k),b2=brier(q2.p,k),bk=brier(r.p,k),bb=brier(base,k),mx=a=>a.indexOf(Math.max(...a));
    L.n++;L.b1+=b1;L.b2+=b2;L.m+=bk;L.bb+=bb;
    A.n++;A.b1+=b1;A.b2+=b2;A.m+=bk;A.bb+=bb;A.acc1+=mx(q1.p)===k?1:0;A.acc2+=mx(q2.p)===k?1:0;A.accM+=mx(r.p)===k?1:0;A.accB+=mx(base)===k?1:0;
    A.d12+=b2-b1;A.d12s+=(b2-b1)*(b2-b1);A.d2m+=b2-bk;A.d2ms+=(b2-bk)*(b2-bk);A.mg+=r.mg||0});
   if(L.n)rows.push(L)});
  return {rows,A,t:M.t,source:M.source};
 }
 R.reportcard=async function(el){
  el.innerHTML='<h2>Model report card</h2><div id="rcroot" class="ins lk rc"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#rcroot');
  if(!CP||CK!==INS.poolKey()){CK=INS.poolKey();const p=calc().then(r=>{if(r.miss&&CP===p)CP=null;return r},e=>{if(CP===p)CP=null;throw e});CP=p}
  let C;try{C=await CP}catch(e){C={miss:['?']}}
  if(!root.isConnected)return;
  if(C.miss||!C.all||C.all.n<30){root.innerHTML=`<div class="empty">${two('The match data is not available right now.','بيانات المباريات مو متوفرة الحين.')}</div>`;return}
  const A=C.all,skill=1-A.b/A.bb,skillU=1-A.b/A.bu;
  const vEn=skill>0.02?'a little better':skill>-0.02?'about the same':'worse',vAr=skill>0.02?'أحسن شوي':skill>-0.02?'تقريبًا نفس الشي':'أسوأ';
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Is the match model honest?</b> The model that predicts the matches on this site (xG Poisson${C.P.leagues.some(o=>o.prior)?', each club starting from its strengths last season':''}) was tested on ${A.n} finished matches of the six leagues. For each one it was asked for the result <b>with that match left out</b> of its numbers, so it never saw what it was predicting.`,
     `<b>هل نموذج المباريات صادق؟</b> النموذج اللي يتوقع المباريات في الموقع (xG Poisson${C.P.leagues.some(o=>o.prior)?'، كل نادي يبدأ من قوته في الموسم الماضي':''}) انختبر على ${nb(A.n)} مباراة منتهية من الدوريات الست. لكل مباراة سألناه عن النتيجة <b>وهو ما يشوف المباراة نفسها</b> في أرقامه، فما شاف اللي يتوقعه.`)}</p>
     <div class="lk-hl"><div class="lk-k ${skill>0?'up':skill<0?'dn':''}"><span>${two('Skill against league base rates','المهارة مقابل نسب الدوري العامة')}</span><b>${nb((skill>=0?'+':'−')+Math.abs(skill*100).toFixed(1)+'%')}</b></div>
      <div class="lk-k"><span>${two('Most likely result was right','النتيجة الأرجح طلعت صح')}</span><b>${nb(pc(A.acc/A.n)+'%')}</b></div></div>
     <p>${two(`Verdict: against a guess that only knows how often each league has home wins, draws and away wins, the model scores <b>${vEn}</b> (Brier ${f3(A.b/A.n)} against ${f3(A.bb/A.n)}; lower is better). Picking the most likely result right ${pc(A.acc/A.n)}% of the time, against ${pc(A.accB/A.n)}% for always picking the league's most common result.`,
       `الحكم: مقابل تخمين ما يعرف إلا كم مرة يكون في كل دوري فوز للأرض وتعادل وفوز للضيف، النموذج يسجّل <b>${vAr}</b> (${nb('Brier')} ${nb(f3(A.b/A.n))} مقابل ${nb(f3(A.bb/A.n))}؛ الأقل أحسن). واختار النتيجة الأرجح صح ${nb(pc(A.acc/A.n)+'%')}، مقابل ${nb(pc(A.accB/A.n)+'%')} لو اخترنا دايمًا النتيجة الأكثر شيوعًا في الدوري.`)}</p>
     <p class="mu">${two('Football results are hard to predict from a few matches per club: expect small gains. The point of this page is to show the real number, not to flatter the model.','نتائج كرة القدم صعبة التوقع من مباريات قليلة لكل نادي: توقّع مكاسب صغيرة. فكرة الصفحة نعرض الرقم الحقيقي، مو نجمّل النموذج.')}</p></div>
    <div class="card"><h3>${two('Does "60%" mean 60%?','هل «60%» تعني 60%؟')}</h3>${rel(C.bins)}</div>
    <div class="card"><h3>${two('League by league','دوري بدوري')}</h3>${table(C.rows)}</div>
    <div class="card rc-fx"><h3>${two('Goals','الأهداف')}</h3><p>${two(`The model expected ${(A.goalsP/A.n).toFixed(2)} goals per match; there were ${(A.goalsA/A.n).toFixed(2)}. Against the uniform guess (a third each) its skill is ${(skillU>=0?'+':'−')+Math.abs(skillU*100).toFixed(1)}%.`,`توقع النموذج ${nb((A.goalsP/A.n).toFixed(2))} هدف للمباراة؛ والفعلي ${nb((A.goalsA/A.n).toFixed(2))}. مقابل التخمين المتساوي (ثلث لكل نتيجة) مهارته ${nb((skillU>=0?'+':'−')+Math.abs(skillU*100).toFixed(1)+'%')}.`)}</p></div>`;
  const K=await market(C.P).catch(()=>({none:true}));if(!root.isConnected)return;
  root.insertAdjacentHTML('beforeend',mkCard(K));
 };

 /* the model's two versions against the bookmakers, on the finished matches that all three can be scored on */
 const zOf=(sum,sq,n)=>{const m=sum/n,v=Math.max(0,sq/n-m*m)*n/(n-1),se=Math.sqrt(v/n);return {m,se,z:se>0?m/se:0,sig:se>0&&Math.abs(m/se)>=1.96}};
 function mkCard(K){
  const hd=`<h3>${two('Model against the bookmakers','النموذج مقابل شركات المراهنات')}</h3>`;
  if(K.none||!K.A||K.A.n<30)return `<div class="card rc-mk">${hd}<p class="mu">${two('Bookmaker odds are not available for this view yet (they come from football-data.co.uk, only for the current season, and only for matches that have been played).','أسعار المراهنات مو متوفرة لهذا العرض الحين (تجي من football-data.co.uk، للموسم الحالي فقط، وللمباريات اللي انلعبت بس).')}</p></div>`;
  const A=K.A,n=A.n,v2=A.priors>0,zq=zOf(A.d12,A.d12s,n),zm=zOf(A.d2m,A.d2ms,n),better=K.rows.filter(r=>r.prior&&r.b2<r.b1).length,withP=K.rows.filter(r=>r.prior).length;
  const d12=Math.abs(zq.m).toFixed(4),dm=Math.abs(zm.m).toFixed(4);
  const s1En=!v2?`This view has no last-season numbers, so there is only one version of the model.`:
    !zq.sig?`Starting each club from its strengths last season makes <b>no clear difference</b> (Brier ${zq.m<0?'lower':'higher'} by ${d12} per match, within noise).`:
    zq.m<0?`Starting each club from its strengths last season (worth 12 matches) makes the model <b>better</b>: Brier ${f3(A.b1/n)} → ${f3(A.b2/n)}, ${d12} lower per match, beyond noise, and better in ${better} of ${withP} leagues.`:
    `Starting each club from its strengths last season makes the model <b>worse</b>: Brier ${f3(A.b1/n)} → ${f3(A.b2/n)}, ${d12} higher per match, beyond noise.`;
  const s1Ar=!v2?`ما فيه أرقام للموسم الماضي في هذا العرض، فالنموذج نسخة وحدة.`:
    !zq.sig?`بدء كل نادي من قوته في الموسم الماضي <b>ما يغيّر شي واضح</b> (${nb('Brier')} ${zq.m<0?'أقل':'أعلى'} بـ${nb(d12)} للمباراة، داخل الضجيج).`:
    zq.m<0?`بدء كل نادي من قوته في الموسم الماضي (بوزن ${nb(12)} مباراة) يخلّي النموذج <b>أحسن</b>: ${nb('Brier')} ${nb(f3(A.b1/n))} ← ${nb(f3(A.b2/n))}، أقل بـ${nb(d12)} للمباراة، وفرق أكبر من الضجيج، وأحسن في ${nb(better)} من ${nb(withP)} دوريات.`:
    `بدء كل نادي من قوته في الموسم الماضي يخلّي النموذج <b>أسوأ</b>: ${nb('Brier')} ${nb(f3(A.b1/n))} ← ${nb(f3(A.b2/n))}، أعلى بـ${nb(d12)} للمباراة، وفرق أكبر من الضجيج.`;
  const s2En=!zm.sig?`Against the bookmakers the model is <b>too close to separate</b> on ${n} matches (${dm} per match, within noise).`:
    zm.m>0?`The bookmakers are still <b>better</b> than the model: their Brier is lower by ${dm} per match, beyond noise on ${n} matches. Their closing odds know the line-ups and injuries, which the model never sees.`:
    `The model is <b>better</b> than the bookmakers: its Brier is lower by ${dm} per match, beyond noise on ${n} matches.`;
  const s2Ar=!zm.sig?`مقابل شركات المراهنات النموذج <b>قريب لدرجة ما نقدر نفرّق</b> على ${nb(n)} مباراة (${nb(dm)} للمباراة، داخل الضجيج).`:
    zm.m>0?`شركات المراهنات ما زالت <b>أحسن</b> من النموذج: ${nb('Brier')} عندها أقل بـ${nb(dm)} للمباراة، وفرق أكبر من الضجيج على ${nb(n)} مباراة. أسعار إغلاقها تعرف التشكيلات والإصابات، والنموذج ما يشوفها.`:
    `النموذج <b>أحسن</b> من شركات المراهنات: ${nb('Brier')} عنده أقل بـ${nb(dm)} للمباراة، وفرق أكبر من الضجيج على ${nb(n)} مباراة.`;
  const sk=(x,y)=>{const q=1-x/y;return nb((q>=0?'+':'−')+Math.abs(q*100).toFixed(1)+'%')};
  const row=(en,ar,b,acc)=>`<tr><td>${two(en,ar)}</td><td class="n">${f3(b/n)}</td><td class="n">${acc==null?'–':nb(pc(acc/n)+'%')}</td><td class="n">${sk(b,A.bb)}</td></tr>`;
  return `<div class="card rc-mk">${hd}
   <p>${two(`The bookmakers' closing odds, with their margin taken out, as a forecast of the same ${n} finished matches. Every model row is asked with each match left out, as above. ${s1En} ${s2En}`,
     `أسعار إغلاق شركات المراهنات، بعد شيل هامش الربح، كتوقع لنفس الـ${nb(n)} مباراة المنتهية. كل صف نموذج انسأل وهو ما يشوف المباراة، مثل فوق. ${s1Ar} ${s2Ar}`)}</p>
   <div class="wrap"><table class="lk-t rc-t rc-mkt"><thead><tr><th></th><th class="n">Brier</th><th class="n">${two('Right','صح')}</th><th class="n">${two('Skill','المهارة')}</th></tr></thead><tbody>
    ${row('Model 1 (this season only)','النموذج 1 (هذا الموسم فقط)',A.b1,A.acc1)}${v2?row('Model 2 (starts from last season)','النموذج 2 (يبدأ من الموسم الماضي)',A.b2,A.acc2):''}${row('Bookmakers','شركات المراهنات',A.m,A.accM)}${row('Base rates','النسب العامة',A.bb,A.accB)}</tbody></table></div>
   <div class="wrap"><table class="lk-t rc-t rc-mkl"><thead><tr><th>${two('League','الدوري')}</th><th class="n">${two('Matches','المباريات')}</th><th class="n">${two('Model 1','النموذج 1')}</th>${v2?`<th class="n">${two('Model 2','النموذج 2')}</th>`:''}<th class="n">${two('Bookmakers','المراهنات')}</th><th class="n lk-nm">${two('Base rates','النسب العامة')}</th></tr></thead><tbody>
    ${K.rows.map(r=>`<tr><td>${nm(r.l.name)}</td><td class="n">${r.n}</td><td class="n">${f3(r.b1/r.n)}</td>${v2?`<td class="n">${r.prior?f3(r.b2/r.n):'–'}</td>`:''}<td class="n">${f3(r.m/r.n)}</td><td class="n lk-nm">${f3(r.bb/r.n)}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two(`Brier: lower is better. Skill: against the league base rates. Model 2 is the one the site uses (Lab, match previews, Beat the model) when the league has last season's numbers; the first tables on this page score it. "Within noise" means the gap is under two standard errors of the per-match differences. The average margin removed from the odds was ${(A.mg/n*100).toFixed(1)}%. Odds: football-data.co.uk, closing average where it has it.`,
     `${nb('Brier')}: الأقل أحسن. المهارة: مقابل النسب العامة للدوري. النموذج 2 هو اللي يستخدمه الموقع (المختبر ومعاينات المباريات وتحدي النموذج) لما يكون للدوري أرقام الموسم الماضي؛ والجداول الأولى بهذي الصفحة تقيّمه. «داخل الضجيج» يعني الفرق أقل من خطأين معياريين لفروق كل مباراة. متوسط الهامش اللي انشال من الأسعار ${nb((A.mg/n*100).toFixed(1)+'%')}. الأسعار: football-data.co.uk، متوسط الإغلاق لو موجود.`)}</p></div>`;
 }
 /* every chance the model gave (three per match), grouped by size: what it said against how often it happened */
 function rel(B){
  return `<div class="wrap"><table class="lk-t rc-t"><thead><tr><th>${two('The model said','النموذج قال')}</th><th class="n">${two('Chances','احتمالات')}</th><th class="n">${two('Average said','متوسط ما قاله')}</th><th class="n">${two('Happened','صار فعلًا')}</th></tr></thead><tbody>
   ${B.map((b,i)=>b.n?`<tr><td>${nb(i*10+'–'+(i*10+10)+'%')}</td><td class="n">${b.n}</td><td class="n">${nb(pc(b.p/b.n)+'%')}</td><td class="n">${nb(pc(b.h/b.n)+'%')}<i class="rc-p" style="--w:${pc(b.h/b.n)}%"></i></td></tr>`:'').join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Each match gives three chances (home win, draw, away win). An honest model has "happened" close to "average said" in every row; with few chances in a row, expect it to wobble.','كل مباراة تعطي ثلاث احتمالات (فوز الأرض، تعادل، فوز الضيف). النموذج الصادق يكون «صار فعلًا» قريب من «متوسط ما قاله» في كل صف؛ والصف اللي فيه احتمالات قليلة يتذبذب.')}</p>`;
 }
 function table(L){
  return `<div class="wrap"><table class="lk-t rc-t"><thead><tr><th>${two('League','الدوري')}</th><th class="n">${two('Matches','المباريات')}</th><th class="n">${two('Right','صح')}</th><th class="n">Brier</th><th class="n lk-nm">${two('Base rates','النسب العامة')}</th><th class="n">${two('Skill','المهارة')}</th></tr></thead><tbody>
   ${L.map(r=>{const s=1-r.b/r.bb;return `<tr><td>${nm(r.l.name)}</td><td class="n">${r.n}</td><td class="n">${nb(pc(r.acc/r.n)+'%')}</td><td class="n">${f3(r.b/r.n)}</td><td class="n lk-nm">${f3(r.bb/r.n)}</td><td class="n"><b class="${s>=0?'lk-up':'lk-dn'}">${nb((s>=0?'+':'−')+Math.abs(s*100).toFixed(1)+'%')}</b></td></tr>`}).join('')}</tbody></table></div>
   <p class="mu ins-note">${two(`Brier: lower is better. Skill: how much lower than the base-rates guess (negative = worse). A league has only ${Math.min(...L.map(r=>r.n))} to ${Math.max(...L.map(r=>r.n))} matches tested so far, so its number moves a lot.`,`Brier: الأقل أحسن. المهارة: كم أقل من تخمين النسب العامة (سالب = أسوأ). الدوري ما فيه إلا من ${nb(Math.min(...L.map(r=>r.n)))} إلى ${nb(Math.max(...L.map(r=>r.n)))} مباراة مختبرة لين الحين، فرقمه يتحرك كثير.`)}</p>`;
 }
 INS.ar({"Model report card":"بطاقة تقييم النموذج","League":"الدوري","Chances":"احتمالات","Matches":"المباريات"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
