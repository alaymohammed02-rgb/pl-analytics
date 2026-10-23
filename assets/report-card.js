/* ===== Model report card (#/reportcard, in Analysis after Who carries the team): how good the match model really is =====
   The model is the Intelligence Lab's "xG Poisson 1" (INS.mm): a club's attack and defence strength = its xG for and against per match,
   pulled towards the league mean; both sides' goals are Poisson; the result is the chance of a home win, a draw and an away win.
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
   const mm=INS.mm(o.ms,o.xg);if(!mm)return;
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
  return {rows:out,all,bins};
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
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Is the match model honest?</b> The model that predicts the matches on this site (xG Poisson) was tested on ${A.n} finished matches of the six leagues. For each one it was asked for the result <b>with that match left out</b> of its numbers, so it never saw what it was predicting.`,
     `<b>هل نموذج المباريات صادق؟</b> النموذج اللي يتوقع المباريات في الموقع (xG Poisson) انختبر على ${nb(A.n)} مباراة منتهية من الدوريات الست. لكل مباراة سألناه عن النتيجة <b>وهو ما يشوف المباراة نفسها</b> في أرقامه، فما شاف اللي يتوقعه.`)}</p>
     <div class="lk-hl"><div class="lk-k ${skill>0?'up':skill<0?'dn':''}"><span>${two('Skill against league base rates','المهارة مقابل نسب الدوري العامة')}</span><b>${nb((skill>=0?'+':'−')+Math.abs(skill*100).toFixed(1)+'%')}</b></div>
      <div class="lk-k"><span>${two('Most likely result was right','النتيجة الأرجح طلعت صح')}</span><b>${nb(pc(A.acc/A.n)+'%')}</b></div></div>
     <p>${two(`Verdict: against a guess that only knows how often each league has home wins, draws and away wins, the model scores <b>${vEn}</b> (Brier ${f3(A.b/A.n)} against ${f3(A.bb/A.n)}; lower is better). Picking the most likely result right ${pc(A.acc/A.n)}% of the time, against ${pc(A.accB/A.n)}% for always picking the league's most common result.`,
       `الحكم: مقابل تخمين ما يعرف إلا كم مرة يكون في كل دوري فوز للأرض وتعادل وفوز للضيف، النموذج يسجّل <b>${vAr}</b> (${nb('Brier')} ${nb(f3(A.b/A.n))} مقابل ${nb(f3(A.bb/A.n))}؛ الأقل أحسن). واختار النتيجة الأرجح صح ${nb(pc(A.acc/A.n)+'%')}، مقابل ${nb(pc(A.accB/A.n)+'%')} لو اخترنا دايمًا النتيجة الأكثر شيوعًا في الدوري.`)}</p>
     <p class="mu">${two('Football results are hard to predict from a few matches per club: expect small gains. The point of this page is to show the real number, not to flatter the model.','نتائج كرة القدم صعبة التوقع من مباريات قليلة لكل نادي: توقّع مكاسب صغيرة. فكرة الصفحة نعرض الرقم الحقيقي، مو نجمّل النموذج.')}</p></div>
    <div class="card"><h3>${two('Does "60%" mean 60%?','هل «60%» تعني 60%؟')}</h3>${rel(C.bins)}</div>
    <div class="card"><h3>${two('League by league','دوري بدوري')}</h3>${table(C.rows)}</div>
    <div class="card rc-fx"><h3>${two('Goals','الأهداف')}</h3><p>${two(`The model expected ${(A.goalsP/A.n).toFixed(2)} goals per match; there were ${(A.goalsA/A.n).toFixed(2)}. Against the uniform guess (a third each) its skill is ${(skillU>=0?'+':'−')+Math.abs(skillU*100).toFixed(1)}%.`,`توقع النموذج ${nb((A.goalsP/A.n).toFixed(2))} هدف للمباراة؛ والفعلي ${nb((A.goalsA/A.n).toFixed(2))}. مقابل التخمين المتساوي (ثلث لكل نتيجة) مهارته ${nb((skillU>=0?'+':'−')+Math.abs(skillU*100).toFixed(1)+'%')}.`)}</p></div>`;
 };
 /* every chance the model gave (three per match), grouped by size: what it said against how often it happened */
 function rel(B){
  return `<div class="wrap"><table class="lk-t rc-t"><thead><tr><th>${two('The model said','النموذج قال')}</th><th class="n">${two('Chances','احتمالات')}</th><th class="n">${two('Average said','متوسط ما قاله')}</th><th class="n">${two('Happened','صار فعلًا')}</th></tr></thead><tbody>
   ${B.map((b,i)=>b.n?`<tr><td>${nb(i*10+'–'+(i*10+10)+'%')}</td><td class="n">${b.n}</td><td class="n">${nb(pc(b.p/b.n)+'%')}</td><td class="n">${nb(pc(b.h/b.n)+'%')}<i class="rc-p" style="--w:${pc(b.h/b.n)}%"></i></td></tr>`:'').join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Each match gives three chances (home win, draw, away win). An honest model has "happened" close to "average said" in every row; with few chances in a row, expect it to wobble.','كل مباراة تعطي ثلاث احتمالات (فوز الأرض، تعادل، فوز الضيف). النموذج الصادق يكون «صار فعلًا» قريب من «متوسط ما قاله» في كل صف؛ والصف اللي فيه احتمالات قليلة يتذبذب.')}</p>`;
 }
 function table(L){
  return `<div class="wrap"><table class="lk-t rc-t"><thead><tr><th>${two('League','الدوري')}</th><th class="n">${two('Matches','المباريات')}</th><th class="n">${two('Right','صح')}</th><th class="n">Brier</th><th class="n lk-nm">${two('Base rates','النسب العامة')}</th><th class="n">${two('Skill','المهارة')}</th></tr></thead><tbody>
   ${L.map(r=>{const s=1-r.b/r.bb;return `<tr><td>${nm(r.l.name)}</td><td class="n">${r.n}</td><td class="n">${nb(pc(r.acc/r.n)+'%')}</td><td class="n">${f3(r.b/r.n)}</td><td class="n lk-nm">${f3(r.bb/r.n)}</td><td class="n"><b class="${s>=0?'lk-up':'lk-dn'}">${nb((s>=0?'+':'−')+Math.abs(s*100).toFixed(1)+'%')}</b></td></tr>`}).join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Brier: lower is better. Skill: how much lower than the base-rates guess (negative = worse). A league has only ${Math.min(...L.map(r=>r.n))} to ${Math.max(...L.map(r=>r.n))} matches tested so far, so its number moves a lot.','Brier: الأقل أحسن. المهارة: كم أقل من تخمين النسب العامة (سالب = أسوأ). الدوري ما فيه إلا من ${nb(Math.min(...L.map(r=>r.n)))} إلى ${nb(Math.max(...L.map(r=>r.n)))} مباراة مختبرة لين الحين، فرقمه يتحرك كثير.')}</p>`;
 }
 INS.ar({"Model report card":"بطاقة تقييم النموذج","League":"الدوري","Chances":"احتمالات","Matches":"المباريات"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
