/* ===== Prediction ledger (#/ledger, Play room, Predict group): the site's models asked BEFORE each match, scored after it =====
   data/ledger.json is written by the sync (sync.py, between LEDGER START and LEDGER END): for every fixture of the six domestic leagues in the next 8 days it stores the
   chances of a home win / draw / away win from Elo (data/elo_own.json), the xG model 2 of the Intelligence Lab, the XI Battle model with each club's latest official
   line-up, and the average of Elo and the XI model, plus the league's base rates, with the time they were made. While the kick-off is ahead the numbers follow the
   latest data; once the match has started they are never changed again (the file's history on GitHub shows when each one was written). After the match the sync adds
   the score and, where football-data.co.uk has it, the bookmakers' closing odds (for comparison only: those are not frozen by us).
   This page only reads the file and adds up: Brier score for three outcomes (0 perfect, 2 worst), the share of matches where the most likely result happened, and the
   paired difference of each model against Elo with its standard error ("within noise" under 1.96 standard errors). Nothing is estimated here. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('ledger','Prediction ledger','analysis','reportcard');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const MOD=[['e','Elo','<bdi dir="ltr">Elo</bdi>'],['m2','xG model','نموذج xG'],['xi','XI model','نموذج التشكيلات'],['bl','Elo + XI (average)','Elo + التشكيلات (متوسط)'],['b','League base rates','نسب الدوري العامة']];
 const MIN=30,PAGE=30;
 const S={lg:'all',more:PAGE,tok:0};
 try{const v=localStorage.getItem('plx_ldg');if(v)S.lg=v}catch(e){}
 const brier=(p,o)=>p.reduce((s,x,i)=>s+(x-(i===o?1:0))**2,0);
 const top=p=>p.indexOf(Math.max(...p));
 const pc=x=>Math.round(x*100)+'%';
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();
  const p=loadJson('ledger.json',ALL.generated).then(d=>{if(!d||typeof d.p!=='object'||d.p===null)throw new Error('ledger');return d}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 const lname=id=>{const l=(ALL.leagues||[]).find(x=>x.id===id);return l?l.name:id};
 /* the scores of each model over the scored matches it has */
 function scores(rows){
  const out={};
  MOD.forEach(([k])=>{const r=rows.filter(x=>Array.isArray(x[k]));const n=r.length;
   if(!n){out[k]={n:0};return}
   const b=r.reduce((s,x)=>s+brier(x[k],x.o),0)/n,acc=r.filter(x=>top(x[k])===x.o).length/n;
   let d=null;
   if(k!=='e'){const pr=r.filter(x=>Array.isArray(x.e));if(pr.length>=2){const ds=pr.map(x=>brier(x[k],x.o)-brier(x.e,x.o)),m=ds.reduce((s,v)=>s+v,0)/ds.length,sd=Math.sqrt(ds.reduce((s,v)=>s+(v-m)**2,0)/(ds.length-1));d={n:ds.length,m,se:sd/Math.sqrt(ds.length)}}}
   out[k]={n,b,acc,d}});
  return out;
 }
 function reading(d){
  if(!d||!(d.se>0))return two('–','–');
  if(Math.abs(d.m)<1.96*d.se)return two('within noise','ضمن الضجيج');
  return d.m<0?two('better than Elo','أفضل من Elo'):two('worse than Elo','أسوأ من Elo');
 }
 function board(rows){
  const sc=scores(rows),n=rows.length;
  const mk=rows.filter(x=>Array.isArray(x.mk));
  const row=([k,en,a])=>{const s=sc[k];if(!s.n)return `<tr data-k="${k}"><td>${two(en,a)}</td><td class="n">${nb(0)}</td><td class="n">–</td><td class="n">–</td><td class="n">–</td><td>–</td></tr>`;
   return `<tr data-k="${k}"><td>${two(en,a)}</td><td class="n">${nb(s.n)}</td><td class="n">${nb(s.b.toFixed(3))}</td><td class="n">${nb(pc(s.acc))}</td><td class="n">${s.d?nb((s.d.m>=0?'+':'−')+Math.abs(s.d.m).toFixed(3)+' ± '+(1.96*s.d.se).toFixed(3)):'–'}</td><td>${k==='e'?two('the reference','المرجع'):reading(s.d)}</td></tr>`};
  const few=n<MIN?`<p class="mu ins-note ldg-few">${two(`Only ${n} scored ${n===1?'match':'matches'} so far: too few to judge. Differences of this size are mostly luck until a few hundred matches are in.`,`للحين ${nb(n)} مباراة مقيّمة بس: قليلة على الحكم. الفروق بهالحجم أغلبها حظ لين تتجمع كم مية مباراة.`)}</p>`:'';
  let mkh='';
  if(mk.length){const cols=[['e','Elo','<bdi dir="ltr">Elo</bdi>'],['m2','xG model','نموذج xG'],['xi','XI model','نموذج التشكيلات'],['bl','Elo + XI','Elo + التشكيلات'],['mk','Bookmakers (closing)','المراهنات (الإغلاق)']];
   mkh=`<h3>${two('Against the bookmakers','مقابل المراهنات')}</h3><table class="lk-t ldg-mk"><thead><tr><th>${two('On the same matches','على نفس المباريات')}</th><th class="n">${two('Matches','مباريات')}</th><th class="n">Brier</th></tr></thead><tbody>
    ${cols.map(([k,en,a])=>{const r=mk.filter(x=>Array.isArray(x[k]));return `<tr data-k="${k}"><td>${two(en,a)}</td><td class="n">${nb(r.length)}</td><td class="n">${r.length?nb((r.reduce((s,x)=>s+brier(x[k],x.o),0)/r.length).toFixed(3)):'–'}</td></tr>`}).join('')}</tbody></table>
    <p class="mu ins-note">${two('Closing odds from football-data.co.uk with the bookmaker\'s margin taken out. They are added after the match and are not frozen by this site: they are only a yardstick.','احتمالات إغلاق المراهنات من football-data.co.uk بعد إزالة هامش المراهن. تنضاف بعد المباراة وما يثبّتها الموقع: هي مجرد مقياس.')}</p>`}
  return `<div class="card ldg-b"><h3>${two('Scoreboard','لوحة النتائج')}</h3>
   <div class="ldg-w"><table class="lk-t ldg-t"><thead><tr><th>${two('Model','النموذج')}</th><th class="n">${two('Matches','مباريات')}</th><th class="n">${two('Brier','Brier')}</th><th class="n">${two('Most likely happened','حصل الأرجح')}</th><th class="n">${two('Against Elo','مقابل Elo')}</th><th>${two('Reading','القراءة')}</th></tr></thead>
   <tbody>${MOD.map(row).join('')}</tbody></table></div>${few}
   <p class="mu ins-note">${two('Brier score for three outcomes: 0 is perfect, 2 is the worst; lower is better. "Against Elo" is the average difference on the same matches, ± 1.96 standard errors; a negative number means fewer errors than Elo.','مقياس Brier لثلاث نتائج: 0 مثالي و2 الأسوأ؛ الأقل أفضل. "مقابل Elo" هو متوسط الفرق على نفس المباريات ± 1.96 خطأ معياري؛ الرقم السالب يعني أخطاء أقل من Elo.')}</p>${mkh}</div>`;
 }
 const lc=()=>ar()?'ar-u-ca-gregory-nu-latn':'en-GB';
 const when=k=>{const t=new Date(k);return isNaN(t)?esc(k):esc(t.toLocaleString(lc(),{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))};
 const trip=p=>Array.isArray(p)?`<span class="ldg-p">${p.map(x=>`<b>${nb(pc(x))}</b>`).join('')}</span>`:'<span class="mu">–</span>';
 function upcoming(rows,now){
  const up=rows.filter(x=>Date.parse(x.k)>now).sort((a,b)=>a.k<b.k?-1:a.k>b.k?1:(a.id<b.id?-1:1));
  const wait=rows.filter(x=>Date.parse(x.k)<=now&&x.o==null);
  if(!up.length&&!wait.length)return `<div class="card"><h3>${two('Coming matches','المباريات الجاية')}</h3><div class="empty">${two('No predictions for the coming days yet.','ما فيه توقعات للأيام الجاية للحين.')}</div></div>`;
  const card=x=>`<li class="ldg-m" data-id="${esc(x.id)}"><div class="ldg-h"><span class="mu">${when(x.k)} · ${esc(lname(x.lg))}</span><b>${nm(x.h)} <span class="mu">–</span> ${nm(x.a)}</b></div>
   <table class="ldg-pt"><thead><tr><th></th><th class="n">${two('Home','أرضه')}</th><th class="n">${two('Draw','تعادل')}</th><th class="n">${two('Away','خارج')}</th></tr></thead><tbody>
   ${MOD.map(([k,en,a])=>`<tr data-k="${k}"><td>${two(en,a)}</td>${Array.isArray(x[k])?x[k].map(v=>`<td class="n">${nb(pc(v))}</td>`).join(''):'<td class="n" colspan="3">–</td>'}</tr>`).join('')}</tbody></table>
   <p class="mu ldg-at">${two('Written','انكتب')} ${nb(esc(String(x.t||'').replace('T',' ').replace('Z',' UTC')))}${x.xd?` · ${two('XI model uses the line-ups of','نموذج التشكيلات يستخدم تشكيلات')} ${nb(esc(x.xd[0]))} ${two('and','و')} ${nb(esc(x.xd[1]))}`:''}</p></li>`;
  return `<div class="card"><h3>${two('Coming matches','المباريات الجاية')} <span class="mu">${nb(up.length)}</span></h3>
   ${wait.length?`<p class="mu">${two(`${wait.length} ${wait.length===1?'match has':'matches have'} kicked off: ${wait.length===1?'its prediction is':'their predictions are'} locked and waiting for the result.`,`${nb(wait.length)} مباراة بدت: توقعاتها مقفلة وتنتظر النتيجة.`)}</p>`:''}
   <ul class="ldg-l">${up.map(card).join('')}</ul></div>`;
 }
 function finished(rows){
  const f=rows.filter(x=>x.o!=null).sort((a,b)=>a.k<b.k?1:a.k>b.k?-1:(a.id<b.id?1:-1));
  if(!f.length)return '';
  const res=o=>[two('home win','فوز صاحب الأرض'),two('draw','تعادل'),two('away win','فوز الضيف')][o];
  const li=x=>`<tr data-id="${esc(x.id)}"><td><span class="mu">${esc(String(x.k).slice(0,10))}</span><br>${nm(x.h)} ${nb(esc(x.s||''))} ${nm(x.a)} <span class="mu">· ${res(x.o)}</span></td>${MOD.map(([k])=>`<td class="n">${Array.isArray(x[k])?`<span class="${top(x[k])===x.o?'ldg-y':''}">${nb(pc(x[k][x.o]))}</span>`:'–'}</td>`).join('')}</tr>`;
  return `<div class="card"><h3>${two('Finished matches','المباريات المنتهية')} <span class="mu">${nb(f.length)}</span></h3>
   <div class="ldg-w"><table class="lk-t ldg-f"><thead><tr><th>${two('Match','المباراة')}</th>${MOD.map(([k,en,a])=>`<th class="n">${two(en,a)}</th>`).join('')}</tr></thead><tbody>${f.slice(0,S.more).map(li).join('')}</tbody></table></div>
   ${f.length>S.more?`<button type="button" class="ldg-more" id="ldgm">${two('Show more','عرض المزيد')}</button>`:''}
   <p class="mu ins-note">${two('Each number is the chance the model gave to what really happened; underlined when that result was the model\'s most likely one.','كل رقم هو الاحتمال اللي أعطاه النموذج للي صار فعلًا؛ وعليه خط إذا كانت هذي النتيجة الأرجح عنده.')}</p></div>`;
 }
 function draw(root,L){
  const now=Date.now(),all=Object.entries(L.p||{}).map(([id,v])=>Object.assign({id},v));
  const lgs=[...new Set(all.map(x=>x.lg))].sort((a,b)=>lname(a).localeCompare(lname(b)));
  if(S.lg!=='all'&&!lgs.includes(S.lg))S.lg='all';
  const rows=S.lg==='all'?all:all.filter(x=>x.lg===S.lg),scored=rows.filter(x=>x.o!=null);
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>The models, asked before kick-off.</b> Before every match of the six leagues the site writes down what each of its models expects, and after the final whistle it scores them. Nothing is changed once a match has started, so this is a fair test on matches no model has seen.','<b>النماذج، قبل صافرة البداية.</b> قبل كل مباراة في الدوريات الستة يكتب الموقع توقع كل نموذج عنده، وبعد صافرة النهاية يقيّمها. ما يتغيّر شي بعد ما تبدأ المباراة، فهذا اختبار عادل على مباريات ما شافها أي نموذج.')}</p>
   <p class="mu">${two(`Started ${esc(L.since||'')}. Elo comes from PitchAPI's results, the xG model from this season's chances with last season as a start, the XI model from each club's latest official line-up (the real line-up is known only an hour before kick-off), and the average of Elo and the XI model is the idea that looked best in an earlier test but was chosen after seeing that test, so it is tried here on new matches.`,`بدأ في ${nb(esc(L.since||''))}. Elo من نتائج PitchAPI، ونموذج xG من فرص هذا الموسم مع بداية من الموسم الماضي، ونموذج التشكيلات من آخر تشكيلة رسمية لكل نادي (التشكيلة الحقيقية تنعرف قبل المباراة بساعة بس)، ومتوسط Elo والتشكيلات هو الفكرة اللي طلعت الأفضل في اختبار سابق لكنها انختارت بعد ما شفنا الاختبار، فهنا تنجرّب على مباريات جديدة.`)}</p></div>
   <div class="card"><div class="seg ldg-lg" id="ldgl" role="group" aria-label="${ar()?'الدوري':'League'}"><button type="button" data-l="all" aria-pressed="${S.lg==='all'}" class="${S.lg==='all'?'on':''}">${two('All six','الستة كلها')}</button>${lgs.map(l=>`<button type="button" data-l="${esc(l)}" aria-pressed="${S.lg===l}" class="${S.lg===l?'on':''}">${esc(lname(l))}</button>`).join('')}</div></div>
   ${board(scored)}${upcoming(rows,now)}${finished(rows)}`;
  root.querySelectorAll('#ldgl button').forEach(b=>b.onclick=()=>{S.lg=b.dataset.l;S.more=PAGE;try{localStorage.setItem('plx_ldg',S.lg)}catch(e){}draw(root,L)});
  const m=root.querySelector('#ldgm');if(m)m.onclick=()=>{S.more+=PAGE;draw(root,L)};
 }
 R.ledger=async function(el){
  el.innerHTML='<h2>Prediction ledger</h2><div id="ldgroot" class="ins lk ldg"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#ldgroot'),lg=D.id,tok=++S.tok;
  let L;try{L=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The prediction ledger is not available right now.','سجل التوقعات مو متوفر الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!Object.keys(L.p).length){root.innerHTML=`<div class="empty">${two('No predictions yet: the first ones are written at the next data update.','ما فيه توقعات للحين: أول توقعات تنكتب مع التحديث الجاي للبيانات.')}</div>`;return}
  draw(root,L);
 };
 INS.ar({'Prediction ledger':'سجل التوقعات'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
