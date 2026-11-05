/* ===== Fantasy transfer planner (#/transfers, Play room, Fantasy group): which transfers add the most predicted points over the next gameweeks? =====
   Your squad is the starting XI of "My XI" in the Fantasy page (the site has no 15-man squad, and FPL's own team cannot be read from a browser). For every player of the XI the page tries
   every player of the same position that FPL lists as available and that you can afford (his price minus the price of the player who leaves must be inside your bank, and no club may have more
   than 3 players in the XI), and adds up the model's predicted points for the next 1 to 5 gameweeks (the same predictions as Predicted Points: availability-adjusted, opponent-adjusted).
   Gain = predicted points of the player coming in minus those of the player going out, minus 4 for each transfer beyond your free ones. It also looks for the best pair of transfers.
   TEST (data/transfers_test.json, tools/transfers/run_test.js): the planner's own code, run on the leak-free replay of a finished season (every gameweek is predicted from earlier gameweeks only),
   for many random legal XIs, one gameweek ahead (the replay predicts one gameweek ahead only, so a longer horizon is not tested separately): what the transfer it picked really gained, against the
   same ranking by the last-5 average and against a random affordable swap. The page prints that result as it is, including when the model is not better. */
(function(){
 if(typeof INS!=='object'||typeof INS.addPage!=='function')return;
 const T10=v=>Math.round(v*10);
 /* the planner: pure, used by the page and by the test. squad / pool: [{id, t (position 1-4), club, price (£m), v: [points per gameweek...], ...}] */
 function plan(o){
  const H=Math.max(1,o.H||1),val=p=>{let s=0;for(let i=0;i<H;i++)s+=p.v[i]||0;return s},bank=T10(o.bank||0),ft=o.ft==null?1:o.ft,hit=o.hit==null?4:o.hit,MC=o.maxClub||3,top=o.top||10;
  const inSq=new Set(o.squad.map(p=>p.id)),cnt=new Map();o.squad.forEach(p=>cnt.set(p.club,(cnt.get(p.club)||0)+1));
  const pool=o.pool.filter(p=>!inSq.has(p.id)&&p.price!=null&&Array.isArray(p.v)),byT={1:[],2:[],3:[],4:[]};pool.forEach(p=>{if(byT[p.t])byT[p.t].push(p)});
  const better=(a,b)=>b.gain-a.gain||(a.out.id-b.out.id)||(a.in.id-b.in.id);
  const singles=[],sq=o.squad,buckets=[];
  sq.forEach((out,oi)=>{
   const L=[],bk=new Map();
   byT[out.t].forEach(inn=>{
    const dp=T10(inn.price)-T10(out.price);
    const c={out,in:inn,gain:val(inn)-val(out)-(ft>=1?0:hit),raw:val(inn)-val(out),dp};
    if(dp<=bank&&(inn.club===out.club||(cnt.get(inn.club)||0)+1<=MC))L.push(c);   /* a single transfer must fit the bank and the club limit by itself */                                                      
    let a=bk.get(dp);if(!a){a=[];bk.set(dp,a)}a.push(c);                         /* a pair may be funded by the other transfer: kept for every price change */
   });
   L.sort(better);singles.push(...L.slice(0,top));
   bk.forEach(a=>a.sort(better));buckets[oi]=[...bk.entries()];
  });
  singles.sort(better);
  /* pairs, exactly: for every two outgoing players and every pair of price changes whose sum fits the bank, the best combination of two different incoming players that keeps the club limit */
  const extra=Math.max(0,2-ft)*hit,best=[],N=o.pairs==null?5:o.pairs,worse=(x,y)=>y.gain-x.gain||x.a.out.id-y.a.out.id||x.b.out.id-y.b.out.id||x.a.in.id-y.a.in.id||x.b.in.id-y.b.in.id;
  if(N>0)for(let i=0;i<sq.length;i++)for(let j=i+1;j<sq.length;j++)for(const [da,A] of buckets[i])for(const [db,B] of buckets[j]){
   if(da+db>bank)continue;
   for(const a of A){
    if(best.length>=N&&a.raw+B[0].raw-extra<best[best.length-1].gain)break;                     /* sorted: nothing later can reach the n-th best */
    for(const b of B){
     const g=a.raw+b.raw-extra;
     if(best.length>=N&&g<best[best.length-1].gain)break;
     if(a.in.id===b.in.id)continue;
     const c=new Map(cnt);[[a.out,a.in],[b.out,b.in]].forEach(([x,y])=>{c.set(x.club,c.get(x.club)-1);c.set(y.club,(c.get(y.club)||0)+1)});
     let bad=false;c.forEach(n=>{if(n>MC)bad=true});if(bad)continue;
     const pr={a,b,gain:g,raw:a.raw+b.raw};
     if(best.length<N||worse(pr,best[best.length-1])<0){best.push(pr);best.sort(worse);if(best.length>N)best.pop()}
    }}
  }
  return {singles:singles.slice(0,top),pairs:best,H,bank:o.bank||0,ft};
 }
 INS.transfers={plan,build:null};
 if(typeof fpLoad!=='function'||typeof pmPredictAll!=='function')return;
 INS.addPage('transfers','Transfer planner','fpl','fantasy');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const S={bank:'0.0',ft:1,H:5,tok:0};
 const f1=v=>v==null?'–':(+v).toFixed(1),sg=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1);
 let TEST=undefined;
 async function testFile(){if(TEST!==undefined)return TEST;try{TEST=await loadJson('transfers_test.json',ALL.generated)}catch(e){TEST=null}return TEST}
 const myXI=()=>{try{const s=JSON.parse(localStorage.getItem('fpl_myxi_cur_v1')||'null');return s&&Array.isArray(s.ids)?s:null}catch(e){return null}};
 function pv(p,gws){return gws.map(g=>g&&!g.none?(g.pts||0):0)}
 function build(d,H){
  pmPredictAll(d);const C=pmCtx(d),n=Math.min(H,C.gws.length);
  const mk=p=>({id:p.id,t:p.ty,club:p.tm,price:p.price,v:pv(p,(p.pm&&p.pm.gws||[]).slice(0,n)),name:p.name,tn:p.tn,st:p.st,nw:p.nw||'',q:p.pm&&p.pm.q});
  return {C,n,mk,pool:d.P.filter(p=>p.pm&&p.pm.q!=='nodata'&&p.st==='a'&&p.price!=null).map(mk)};
 }
 INS.transfers.build=build;
 function gwHead(C,n){return C.gws.slice(0,n).map(g=>'GW'+g).join(' · ')}
 const rowOut=(r,C,n)=>`<tr data-o="${r.out.id}" data-i="${r.in.id}"><td>${nm(r.out.name)} <span class="mu">${esc(r.out.tn)} · £${f1(r.out.price)}m</span></td><td>→ <b>${nm(r.in.name)}</b> <span class="mu">${esc(r.in.tn)} · £${f1(r.in.price)}m</span></td><td class="n">${nb((r.dp>=0?'+':'−')+(Math.abs(r.dp)/10).toFixed(1))}</td><td class="n">${nb(r.in.v.slice(0,n).map(f1).join(' · '))}</td><td class="n"><b>${nb(sg(r.gain))}</b></td></tr>`;
 R.transfers=async function(el){
  el.innerHTML='<h2>Transfer planner</h2><div id="trroot" class="ins lk tr"><div class="empty skel">Loading the Fantasy data…</div></div>';
  const root=el.querySelector('#trroot'),lg=D&&D.id,tok=++S.tok;
  let d;try{d=await fpLoad()}catch(e){d=null}
  if(!root.isConnected||tok!==S.tok)return;
  if(!d||!d.rules||!d.fix||!d.fix.length||(d.fix[0]||[]).length<9){root.innerHTML=`<div class="empty">${two('The Fantasy data (rules, fixtures and kick-off times) is not available right now.','بيانات الفانتزي (القواعد والمباريات وأوقاتها) مو متوفرة الحين.')}</div>`;return}
  if(d.archive){root.innerHTML=`<div class="empty">${two('The planner looks at the season under way; an archived Fantasy season has no coming gameweeks.','المخطط يشتغل على الموسم الجاري؛ موسم فانتزي مؤرشف ما فيه جولات قادمة.')}</div>`;return}
  const T=await testFile();if(!root.isConnected||tok!==S.tok)return;
  draw(root,d,T);
 };
 function draw(root,d,T){
  const b=build(d,S.H),{C,n}=b,xi=myXI(),ids=xi&&xi.season?xi.ids.filter(id=>d.PB.get(id)):[];
  const squad=ids.map(id=>b.mk(d.PB.get(id))).filter(p=>p.price!=null);
  const ctl=`<div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('Bank (£m)','الرصيد (£m)')}</span><input id="trb" type="number" step="0.1" min="0" max="20" value="${esc(S.bank)}" style="width:90px"></label>
    <label class="dcx-l"><span class="mu">${two('Free transfers','التحويلات المجانية')}</span><select id="trf">${[0,1,2].map(x=>`<option value="${x}"${S.ft===x?' selected':''}>${x}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Look ahead','كم جولة قدّام')}</span><select id="trh">${[1,2,3,4,5].filter(x=>x<=Math.max(1,C.gws.length)).map(x=>`<option value="${x}"${S.H===x?' selected':''}>${x} ${ar()?'جولة':(x===1?'gameweek':'gameweeks')}</option>`).join('')}</select></label></div></div>`;
  const intro=`<div class="card lk-intro"><p>${two('<b>Which transfer adds the most points?</b> Your starting XI from <b>My XI</b> (in the Fantasy page) against every available player of the same position you can afford: the model\'s predicted points over the next gameweeks, minus 4 for each transfer beyond your free ones.','<b>أي تحويل يضيف أكثر نقاط؟</b> تشكيلتك الأساسية من <b>My XI</b> (في صفحة الفانتزي) مقابل كل لاعب متاح بنفس المركز تقدر تشتريه: النقاط المتوقعة من النموذج للجولات القادمة، ناقص 4 لكل تحويل زيادة على المجاني.')}</p></div>`;
  if(squad.length<11){
   root.innerHTML=intro+`<div class="card"><div class="empty">${two(`Your XI is not complete here (${squad.length} of 11 players). Build it in <a href="#/fantasy">Fantasy → My XI</a> and come back.`,`تشكيلتك مو كاملة هنا (${nb(squad.length)} من 11 لاعب). كوّنها من <a href="#/fantasy">الفانتزي ← My XI</a> وارجع.`)}</div></div>`+testCard(T);return}
  const res=plan({squad,pool:b.pool,bank:+S.bank||0,ft:S.ft,H:n,top:10,pairs:5});
  const head=`<th>${two('Out','يطلع')}</th><th>${two('In','يدخل')}</th><th class="n">£m</th><th class="n">${esc(gwHead(C,n))}</th><th class="n">${two('Gain','المكسب')}</th>`;
  const skipped=d.P.filter(p=>p.pm&&p.pm.q!=='nodata'&&p.st!=='a').length;
  root.innerHTML=intro+ctl+`<div class="card"><h3>${two('Best single transfers','أفضل تحويل واحد')}</h3>${res.singles.length?`<div class="tr-w"><table class="lk-t tr-t"><thead><tr>${head}</tr></thead><tbody>${res.singles.map(r=>rowOut(r,C,n)).join('')}</tbody></table></div>`:`<div class="empty">${two('No transfer fits your bank.','ما فيه تحويل يناسب رصيدك.')}</div>`}
   <p class="mu ins-note">${two(`Gain = predicted points over ${n===1?'the next gameweek':'the next '+n+' gameweeks'} of the player in minus the player out${S.ft<1?', minus 4 for the transfer (no free transfer left)':''}. "£m" is the change in price. ${skipped} players FPL does not list as available are left out. Your XI only: the 3-per-club rule is checked on the XI, not on a full squad of 15.`,`المكسب = النقاط المتوقعة خلال ${n===1?'الجولة الجاية':nb(n)+' جولات قادمة'} للاعب الداخل ناقص الطالع${S.ft<1?'، ناقص 4 للتحويل (ما بقي تحويل مجاني)':''}. "£m" هو تغيّر السعر. ${nb(skipped)} لاعب ما يصنفهم FPL متاحين تم استبعادهم. على تشكيلتك الأساسية فقط: قاعدة 3 لاعبين من النادي تنفحص على التشكيلة مو على 15 لاعب كاملة.`)}</p></div>
   <div class="card"><h3>${two('Best pair of transfers','أفضل تحويلين')}</h3>${res.pairs.length?`<div class="tr-w"><table class="lk-t tr-p"><thead><tr><th>${two('Transfers','التحويلات')}</th><th class="n">${two('Gain','المكسب')}</th></tr></thead><tbody>${res.pairs.map(p=>`<tr><td>${[p.a,p.b].map(x=>`${nm(x.out.name)} → <b>${nm(x.in.name)}</b>`).join('<br>')}</td><td class="n"><b>${nb(sg(p.gain))}</b></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${two('No pair of transfers fits your bank.','ما فيه تحويلين يناسبون رصيدك.')}</div>`}
   <p class="mu ins-note">${two('Two transfers at once, checked together: the bank and the 3-per-club limit must hold after both. The second one costs 4 points unless you have two free transfers.','تحويلين مع بعض، ينفحصون مع بعض: الرصيد وحد 3 لاعبين من النادي لازم يتحقق بعد الاثنين. الثاني يكلّف 4 نقاط إلا إذا عندك تحويلين مجانيين.')}</p></div>`+testCard(T);
  const q=s=>root.querySelector(s);
  q('#trb').onchange=e=>{S.bank=e.target.value;draw(root,d,T)};q('#trf').onchange=e=>{S.ft=+e.target.value;draw(root,d,T)};q('#trh').onchange=e=>{S.H=+e.target.value;draw(root,d,T)};
 }
 function testCard(T){
  if(!T||!T.s)return `<div class="card"><h3>${two('How good are its picks?','قد إيش اختياراته جيدة؟')}</h3><div class="empty">${two('The test on last season is not available.','اختبار الموسم الماضي مو متوفر.')}</div></div>`;
  const s=T.s,r=v=>(+v).toFixed(2),ci=x=>`${r(x.m)} ± ${r(1.96*x.se)}`,v=(a,b)=>Math.abs(a.d)<1.96*a.se?two('within noise','ضمن الضجيج'):a.d>0?two('better','أفضل'):two('worse','أسوأ');
  return `<div class="card tr-test"><h3>${two('How good are its picks? A test on last season','قد إيش اختياراته جيدة؟ اختبار على الموسم الماضي')}</h3>
   <p>${two(`In the replay of <b>${esc(T.season)}</b> (every gameweek predicted from earlier gameweeks only), ${nb(s.n)} random legal XIs took the single transfer the planner picked, one gameweek ahead. What the transfer really gained (points of the player in minus the player out):`,`في إعادة موسم <b>${esc(T.season)}</b> (كل جولة تتوقّع من الجولات اللي قبلها بس)، ${nb(s.n)} تشكيلة قانونية عشوائية سوّت التحويل الواحد اللي اختاره المخطط، لجولة وحدة قدّام. وش كسب التحويل فعلاً (نقاط الداخل ناقص الطالع):`)}</p>
   <div class="tr-w"><table class="lk-t tr-tt"><thead><tr><th>${two('Rule used to pick the transfer','القاعدة اللي اختارت التحويل')}</th><th class="n">${two('Predicted gain','المكسب المتوقع')}</th><th class="n">${two('Real gain (± 1.96 SE)','المكسب الفعلي (± 1.96 خطأ)')}</th><th class="n">${two('Positive','موجب')}</th></tr></thead><tbody>
    <tr data-k="model"><td>${two('The model (this page)','النموذج (هذي الصفحة)')}</td><td class="n">${nb(r(s.model.pred))}</td><td class="n"><b>${nb(ci(s.model))}</b></td><td class="n">${nb(Math.round(s.model.pos*100)+'%')}</td></tr>
    <tr data-k="b5"><td>${two('Last-5 average','متوسط آخر 5')}</td><td class="n">${nb(r(s.b5.pred))}</td><td class="n">${nb(ci(s.b5))}</td><td class="n">${nb(Math.round(s.b5.pos*100)+'%')}</td></tr>
    <tr data-k="rand"><td>${two('A random affordable swap','تبديل عشوائي ضمن الميزانية')}</td><td class="n">–</td><td class="n">${nb(ci(s.rand))}</td><td class="n">${nb(Math.round(s.rand.pos*100)+'%')}</td></tr></tbody></table></div>
   <p>${two(`Model against the last-5 average: ${nb(sg(s.dB5.d))} ± ${nb((1.96*s.dB5.se).toFixed(2))} points a transfer (${v(s.dB5)}); against a random swap: ${nb(sg(s.dRand.d))} ± ${nb((1.96*s.dRand.se).toFixed(2))} (${v(s.dRand)}). The differences are averaged gameweek by gameweek (${nb(s.rounds)} gameweeks).`,`النموذج مقابل متوسط آخر 5: ${nb(sg(s.dB5.d))} ± ${nb((1.96*s.dB5.se).toFixed(2))} نقطة للتحويل (${v(s.dB5)})؛ ومقابل تبديل عشوائي: ${nb(sg(s.dRand.d))} ± ${nb((1.96*s.dRand.se).toFixed(2))} (${v(s.dRand)}). الفروق تتحسب جولة بجولة (${nb(s.rounds)} جولة).`)}</p>
   <p class="mu ins-note">${two('The replay predicts one gameweek ahead, so a longer horizon on this page uses the same model gameweek by gameweek but is not tested separately. Random XIs stand in for a typical manager\'s team; a real squad may differ. One gameweek of points is very noisy: only the averages mean anything.','الإعادة تتوقّع جولة وحدة قدّام، فالأفق الأطول في هذي الصفحة يستخدم نفس النموذج جولة بجولة لكن ما انختبر لوحده. التشكيلات العشوائية بديل عن فريق مدير عادي؛ فريقك الحقيقي ممكن يختلف. نقاط جولة وحدة ضجيجها كبير: بس المتوسطات لها معنى.')}</p></div>`;
 }
 INS.ar({'Transfer planner':'مخطط التحويلات'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
