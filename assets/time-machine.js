/* ===== Time machine (#/timemachine, in Season after the simulator): go back to any day of a season and see what the model expected from there =====
   data/results.json (sync.py "TMACH") holds every result of each league's chain of seasons (the Elo chain: Premier League from 2021-22, the others
   from 2024-25), plus a test. On the chosen day the page works out, from the matches BEFORE that day only:
   - the table (points, then goal difference, then goals scored);
   - every club's Elo rating, exactly as sync.py el2_run (the same K, home advantage, goal-difference multiplier, 10% pull to the mean at a new
     season; a club not yet seen starts at the mean);
   - from there, with the ratings frozen: each remaining home/away pairing's win / draw / loss chances (the same ordered logit), every club's
     expected final points, and 4,000 simulated seasons (a seeded random generator, so the same day always gives the same numbers) for the title,
     the top four and the bottom three (ties on points broken by the rating on that day);
   and sets it against what really happened: the final table of a finished season, or, for the season under way, the matches played since that day.
   The test in the file: for every finished season, after a quarter, a half and three quarters of the matches, the average error of the final points
   from Elo against "points per game so far × all games". Not in the model: transfers, injuries, managers; the ratings do not move after the day. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('timemachine','Time machine','season','sim');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const SIMS=4000;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;     /* plain code-point order, as Python sorts: ids, dates and names */
 const S={lg:'',si:-1,di:-1,tok:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('results.json',ALL.generated).then(d=>{if(!d||!d.leagues||!Object.keys(d.leagues).length||!d.params)throw new Error('results');return d}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 /* ---- Elo, as sync.py el2_run / el2_probs / tmach_ratings ---- */
 const season=d=>{const y=+d.slice(0,4);return +d.slice(5,7)>=7?y:y-1};
 const probs=(dr,P)=>{const x=dr/P.s,ph=1/(1+Math.exp(-(x-P.c))),pa=1-1/(1+Math.exp(-(x+P.c)));return [ph,1-ph-pa,pa]};
 function ratings(all,upto,P){
  const Rt=new Map();let last=null,lastD=null;
  for(const m of all){if(m.d>=upto)break;const sea=season(m.d);
   if(last!=null&&sea!==last&&Rt.size){const mean=[...Rt.values()].reduce((s,x)=>s+x,0)/Rt.size;for(const [t,r] of Rt)Rt.set(t,mean+(1-P.reg)*(r-mean))}
   last=sea;lastD=m.d;
   for(const t of [m.h,m.a])if(!Rt.has(t))Rt.set(t,Rt.size?[...Rt.values()].reduce((s,x)=>s+x,0)/Rt.size:1500);
   const dr=Rt.get(m.h)-Rt.get(m.a)+P.H,e=1/(1+Math.pow(10,-dr/400)),sc=m.hg>m.ag?1:m.hg===m.ag?.5:0,gd=Math.abs(m.hg-m.ag),mult=gd<=1?1:gd===2?1.5:(11+gd)/8,ch=P.K*mult*(sc-e);
   Rt.set(m.h,Rt.get(m.h)+ch);Rt.set(m.a,Rt.get(m.a)-ch)}
  if(Rt.size&&lastD&&season(lastD)!==season(upto)){const mean=[...Rt.values()].reduce((s,x)=>s+x,0)/Rt.size;for(const [t,r] of Rt)Rt.set(t,mean+(1-P.reg)*(r-mean))}
  return Rt;
 }
 function table(ms,teams){const T=new Map(teams.map(t=>[t,{t,p:0,g:0,gd:0,gf:0,w:0,d:0,l:0}]));
  for(const m of ms){const h=T.get(m.h),a=T.get(m.a);h.g++;a.g++;h.gf+=m.hg;a.gf+=m.ag;h.gd+=m.hg-m.ag;a.gd+=m.ag-m.hg;
   if(m.hg>m.ag){h.p+=3;h.w++;a.l++}else if(m.hg<m.ag){a.p+=3;a.w++;h.l++}else{h.p++;a.p++;h.d++;a.d++}}
  return [...T.values()].sort((x,y)=>y.p-x.p||y.gd-x.gd||y.gf-x.gf||cmp(x.t,y.t))}
 /* a seeded generator (mulberry32) from the league, season and day, so a day always gives the same simulation */
 function rng(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}let a=h;
  return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
 function project(L,si,upto,P){
  const all=L.all,sm=L.seasons[si].ms,teams=[...new Set(sm.flatMap(m=>[m.h,m.a]))].sort(cmp),n=teams.length;
  const Rt=ratings(all,upto,P),mean=Rt.size?[...Rt.values()].reduce((s,x)=>s+x,0)/Rt.size:1500,r=t=>Rt.has(t)?Rt.get(t):mean;
  const done=sm.filter(m=>m.d<upto),later=sm.filter(m=>m.d>=upto),played=new Set(done.map(m=>m.h+'|'+m.a)),now=table(done,teams);
  const base=new Map(now.map(x=>[x.t,x.p])),exp=new Map(now.map(x=>[x.t,x.p])),fx=[];
  for(const h of teams)for(const a of teams){if(h===a||played.has(h+'|'+a))continue;const p=probs(r(h)-r(a)+P.H,P);fx.push([h,a,p]);exp.set(h,exp.get(h)+3*p[0]+p[1]);exp.set(a,exp.get(a)+3*p[2]+p[1])}
  /* simulations */
  const ti=new Map(teams.map((t,i)=>[t,i])),R0=teams.map(r),cnt=teams.map(()=>[0,0,0]),rnd=rng(L.id+'|'+L.seasons[si].s+'|'+upto),F=fx.map(([h,a,p])=>[ti.get(h),ti.get(a),p[0],p[0]+p[1]]);
  const pts=new Float64Array(n),ord=teams.map((_,i)=>i);
  for(let s=0;s<SIMS;s++){for(let i=0;i<n;i++)pts[i]=base.get(teams[i]);
   for(const f of F){const u=rnd();if(u<f[2])pts[f[0]]+=3;else if(u<f[3]){pts[f[0]]++;pts[f[1]]++}else pts[f[1]]+=3}
   ord.sort((x,y)=>pts[y]-pts[x]||R0[y]-R0[x]||cmp(teams[x],teams[y]));
   cnt[ord[0]][0]++;for(let k=0;k<4&&k<n;k++)cnt[ord[k]][1]++;for(let k=Math.max(0,n-3);k<n;k++)cnt[ord[k]][2]++}
  const rows=teams.map((t,i)=>({t,r:r(t),now:now.find(x=>x.t===t),exp:exp.get(t),title:cnt[i][0]/SIMS,top4:cnt[i][1]/SIMS,bot3:cnt[i][2]/SIMS}));
  /* what really happened after the day */
  const fin=sm.length===n*(n-1),final=fin?table(sm,teams):null,G=2*(n-1);
  const since=later.length?(()=>{const e=new Map(teams.map(t=>[t,0])),a=new Map(teams.map(t=>[t,0]));let b=0,bb=0;
   const pre=all.filter(m=>m.d<upto),br=pre.length?[0,1,2].map(k=>pre.filter(m=>(m.hg>m.ag?0:m.hg===m.ag?1:2)===k).length/pre.length):[1/3,1/3,1/3];
   for(const m of later){const p=probs(r(m.h)-r(m.a)+P.H,P),o=m.hg>m.ag?0:m.hg===m.ag?1:2;e.set(m.h,e.get(m.h)+3*p[0]+p[1]);e.set(m.a,e.get(m.a)+3*p[2]+p[1]);
    a.set(m.h,a.get(m.h)+(o===0?3:o===1?1:0));a.set(m.a,a.get(m.a)+(o===2?3:o===1?1:0));b+=p.reduce((s,x,k)=>s+(x-(k===o?1:0))**2,0);bb+=br.reduce((s,x,k)=>s+(x-(k===o?1:0))**2,0)}
   return {n:later.length,e,a,brier:b/later.length,base:bb/later.length}})():null;
  return {teams,n,G,rows,now,done,later,fin,final,since,upto};
 }
 R.timemachine=async function(el){
  el.innerHTML='<h2>Time machine</h2><div id="tmroot" class="ins lk tmc"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#tmroot'),lg=D.id,tok=++S.tok;
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The time machine is not available right now.','آلة الزمن مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!F.leagues[S.lg]){S.lg=F.leagues[lg]?lg:Object.keys(F.leagues)[0];S.si=-1;S.di=-1}
  draw(root,F);
 };
 const decoded=new Map();
 function league(F,id){const k=id+'|'+F.key;if(decoded.has(k))return decoded.get(k);const L=F.leagues[id],T=L.teams;
  const seasons=L.seasons.map(s=>({s:s.s,ms:s.m.map(x=>({d:x[0],h:T[x[1]],a:T[x[2]],hg:x[3],ag:x[4],id:x[5]}))}));
  const o={id,name:L.name,seasons,all:seasons.flatMap(s=>s.ms).sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id))};decoded.set(k,o);return o}
 const pc=x=>Math.round(x*100),f1=x=>(+x).toFixed(1),sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(1);
 const pcT=x=>x>0&&x<0.005?'<1%':x<1&&x>0.995?'>99%':pc(x)+'%';
 function draw(root,F){
  const L=league(F,S.lg),P=F.params;
  if(S.si<0||S.si>=L.seasons.length)S.si=L.seasons.length-1;
  const sm=L.seasons[S.si].ms,dates=[...new Set(sm.map(m=>m.d))].sort();
  if(!dates.length){root.innerHTML=`<div class="empty">${two('No matches in this season yet.','ما فيه مباريات في هالموسم للحين.')}</div>`;return}
  if(S.di<0||S.di>=dates.length)S.di=Math.floor(dates.length/2);
  const D_=dates[S.di],X=project(L,S.si,D_,P),lab=L.seasons[S.si].s,cur=S.si===L.seasons.length-1&&!X.fin;
  const rows=X.rows.slice().sort((a,b)=>b.exp-a.exp||b.r-a.r||cmp(a.t,b.t));
  const fpos=X.final?new Map(X.final.map((x,i)=>[x.t,{pos:i+1,p:x.p}])):null,npos=new Map(X.now.map((x,i)=>[x.t,i+1]));
  const nowT=cur?table(sm,X.teams):null,nowPos=nowT?new Map(nowT.map((x,i)=>[x.t,{pos:i+1,p:x.p,g:x.g}])):null;
  let card='';
  if(X.final){const err=X.rows.map(r=>Math.abs(r.exp-fpos.get(r.t).p)),ppg=X.rows.map(r=>r.now.g?Math.abs(r.now.p/r.now.g*X.G-fpos.get(r.t).p):null).filter(v=>v!=null);
   const champ=X.final[0].t,cr=X.rows.find(r=>r.t===champ),sur=X.rows.map(r=>({t:r.t,d:fpos.get(r.t).p-r.exp})).sort((a,b)=>b.d-a.d||cmp(a.t,b.t));
   const mE=err.reduce((s,x)=>s+x,0)/err.length,mP=ppg.length?ppg.reduce((s,x)=>s+x,0)/ppg.length:null;
   card=`<div class="card tmc-sc"><h3>${two('How right was it?','قد إيش صدق؟')}</h3>
    <p class="tmc-mae">${two(`From ${esc(D_)}, the model's final points were <b>${f1(mE)}</b> points off per club on average${mP!=null?`; "points per game so far × ${X.G} games" was ${f1(mP)} off`:''}.`,`من ${nb(esc(D_))}، نقاط النهاية اللي توقعها النموذج كانت بعيدة <b>${nb(f1(mE))}</b> نقطة عن الحقيقة لكل نادي بالمتوسط${mP!=null?`؛ و"معدل نقاطه للحين × ${nb(X.G)} مباراة" كان بعيد ${nb(f1(mP))}`:''}.`)}</p>
    <p class="tmc-ch">${two(`The champion, ${esc(champ)}, had a <b>${pcT(cr.title)}</b> title chance on that day.`,`البطل ${nm(champ)} كانت فرصته باللقب <b>${nb(pcT(cr.title))}</b> في ذاك اليوم.`)}</p>
    <p class="tmc-su">${two(`Did better than expected: ${sur.slice(0,2).map(x=>`${esc(x.t)} (${sg(x.d)})`).join(', ')}. Did worse: ${sur.slice(-2).reverse().map(x=>`${esc(x.t)} (${sg(x.d)})`).join(', ')}.`,`أحسن من المتوقع: ${sur.slice(0,2).map(x=>`${nm(x.t)} (${nb(sg(x.d))})`).join('، ')}. أسوأ: ${sur.slice(-2).reverse().map(x=>`${nm(x.t)} (${nb(sg(x.d))})`).join('، ')}.`)}</p></div>`}
  else if(X.since){const e=X.rows.map(r=>Math.abs(X.since.e.get(r.t)-X.since.a.get(r.t))),mE=e.reduce((s,x)=>s+x,0)/e.length;
   card=`<div class="card tmc-sc"><h3>${two('How right was it so far?','قد إيش صدق للحين؟')}</h3>
    <p class="tmc-so">${two(`Since ${esc(D_)}, <b>${X.since.n}</b> matches have been played. The points the model expected from them were <b>${f1(mE)}</b> off per club on average. Brier score of those matches (lower is better): <b>${X.since.brier.toFixed(3)}</b>, against ${X.since.base.toFixed(3)} for the league's usual win / draw / loss rates.`,`من ${nb(esc(D_))} انلعبت <b>${nb(X.since.n)}</b> مباراة. النقاط اللي توقعها النموذج منها كانت بعيدة <b>${nb(f1(mE))}</b> نقطة لكل نادي بالمتوسط. مقياس Brier لهالمباريات (الأقل أحسن): <b>${nb(X.since.brier.toFixed(3))}</b>، مقابل ${nb(X.since.base.toFixed(3))} لنسب الفوز والتعادل والخسارة المعتادة في الدوري.`)}</p></div>`}
  else card=`<div class="card tmc-sc"><p class="mu">${two('No match has been played after this day yet: there is nothing to compare with.','ما انلعبت ولا مباراة بعد هاليوم للحين: ما فيه شي نقارن فيه.')}</p></div>`;
  const t=F.test||{},tv=(t.all||{})['0.5'],tn=(t.new||{})['0.5'];
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Go back in time.</b> Pick a season and a day: the page rebuilds the table and the clubs\' Elo ratings from the matches before that day only, plays the rest of the season 4,000 times with the ratings frozen, and sets it against what really happened.','<b>ارجع بالزمن.</b> اختر موسم ويوم: الصفحة تبني الترتيب وتقييمات Elo للأندية من المباريات اللي قبل ذاك اليوم بس، وتلعب باقي الموسم 4,000 مرة والتقييمات ثابتة، وتقارن باللي صار فعلًا.')}</p></div>
   <div class="card tmc-pick"><div class="ctl"><select id="tml" aria-label="${ar()?'الدوري':'League'}">${Object.keys(F.leagues).map(id=>`<option value="${esc(id)}"${id===S.lg?' selected':''}>${esc(F.leagues[id].name||id)}</option>`).join('')}</select>
    <select id="tms" aria-label="${ar()?'الموسم':'Season'}">${L.seasons.map((s,i)=>`<option value="${i}"${i===S.si?' selected':''}>${esc(s.s)}</option>`).join('')}</select></div>
    <label class="tmc-sl"><span class="mu">${two('Day','اليوم')}: <b>${nb(esc(D_))}</b> · ${two(`${X.done.length} of ${sm.length} matches played${cur?' so far':''}`,`انلعبت ${nb(X.done.length)} من ${nb(sm.length)} مباراة${cur?' للحين':''}`)}</span>
     <input id="tmd" type="range" min="0" max="${dates.length-1}" value="${S.di}" aria-label="${ar()?'اليوم':'Day'}"></label>
    <div class="ctl tmc-q">${[[0,'Start','البداية'],[.25,'A quarter','الربع'],[.5,'Half way','النص'],[.75,'Three quarters','ثلاث أرباع']].map(([f,e,a])=>`<button type="button" class="xb-clear" data-f="${f}">${two(e,a)}</button>`).join('')}</div></div>
   ${card}
   <div class="card"><h3>${two(`What the model expected from ${esc(D_)}`,`اللي توقعه النموذج من ${nb(esc(D_))}`)}</h3>
    <div class="tmc-w"><table class="lk-t tmc-t"><thead><tr><th>${two('Club','النادي')}</th><th class="n">${two('Then','وقتها')}</th><th class="n">${two('Elo',nb('Elo'))}</th><th class="n">${two('Expected','المتوقع')}</th><th class="n">${two('Title','اللقب')}</th><th class="n">${two('Top 4','أول 4')}</th><th class="n">${two('Bottom 3','آخر 3')}</th><th class="n">${X.final?two('Final','النهاية'):two('Now','الحين')}</th></tr></thead>
     <tbody>${rows.map(r=>{const f=X.final?fpos.get(r.t):nowPos&&nowPos.get(r.t);return `<tr data-t="${esc(r.t)}"><td>${nm(r.t)}</td><td class="n">${nb(npos.get(r.t)+'.')} ${nb(r.now.p)} <span class="mu">${two('pts','ن')}</span></td><td class="n">${nb(Math.round(r.r))}</td><td class="n tmc-e"><b>${nb(f1(r.exp))}</b></td><td class="n">${nb(pcT(r.title))}</td><td class="n">${nb(pcT(r.top4))}</td><td class="n">${nb(pcT(r.bot3))}</td><td class="n tmc-f">${f?nb(f.pos+'.')+' '+nb(f.p)+(X.final?'':` <span class="mu">(${nb(f.g)})</span>`):'–'}</td></tr>`}).join('')}</tbody></table></div>
    <p class="mu ins-note">${two(`Expected = points on that day + 3 × win chance + 1 × draw chance over every remaining home and away pairing. Ties on points in a simulated season are broken by the rating on that day. ${X.final?'Final = the real final table (points, then goal difference, then goals).':'Now = the table today (games played in brackets).'}`,`المتوقع = نقاطه في ذاك اليوم + ${nb(3)} × فرصة الفوز + ${nb(1)} × فرصة التعادل في كل مباراة باقية ذهاب وإياب. التعادل بالنقاط في الموسم المحاكى ينحسم بالتقييم في ذاك اليوم. ${X.final?'النهاية = الترتيب النهائي الحقيقي (النقاط، بعدين فرق الأهداف، بعدين الأهداف).':'الحين = الترتيب اليوم (عدد المباريات بين قوسين).'}`)}</p></div>
   ${tv?`<div class="card tmc-test"><h3>${two('Tested on finished seasons','الاختبار على المواسم المنتهية')}</h3>
    <p>${two(`On ${tv.seasons} finished seasons of the six leagues (${tv.n} club-seasons), half way through, the model's final points were <b>${tv.elo}</b> points off per club, against ${tv.ppg} for "points per game so far × all games".${tn?` On the ${tn.seasons} seasons from 2025-26, which the Elo settings were not fitted on: ${tn.elo} against ${tn.ppg}.`:''}`,`على ${nb(tv.seasons)} مواسم منتهية في الدوريات الستة (${nb(tv.n)} نادي-موسم)، في نص الموسم، نقاط النهاية اللي توقعها النموذج كانت بعيدة <b>${nb(tv.elo)}</b> نقطة لكل نادي، مقابل ${nb(tv.ppg)} لـ"معدل نقاطه للحين × كل المباريات".${tn?` على ${nb(tn.seasons)} مواسم من ${nb('2025-26')}، اللي إعدادات Elo ما انضبطت عليها: ${nb(tn.elo)} مقابل ${nb(tn.ppg)}.`:''}`)}</p>
    <table class="lk-t tmc-tt"><thead><tr><th>${two('Point of the season','وين في الموسم')}</th><th class="n">${two('Model','النموذج')}</th><th class="n">${two('Points per game','معدل النقاط')}</th><th class="n">${two('Club-seasons','نادي-موسم')}</th></tr></thead><tbody>${[['0.25','A quarter','الربع'],['0.5','Half way','النص'],['0.75','Three quarters','ثلاث أرباع']].filter(x=>t.all[x[0]]).map(([k,e,a])=>`<tr data-k="${k}"><td>${two(e,a)}</td><td class="n">${nb(t.all[k].elo)}</td><td class="n">${nb(t.all[k].ppg)}</td><td class="n">${nb(t.all[k].n)}</td></tr>`).join('')}</tbody></table>
    <p class="mu ins-note">${two('Average points away from the real final total, per club. The model does not know about transfers, injuries or a new manager, and its ratings do not move after the chosen day. Elo settings were fitted on matches before 1 Aug 2025, so the seasons before that are partly in-sample.','بالمتوسط كم نقطة بعيد عن مجموع النقاط الحقيقي في النهاية، لكل نادي. النموذج ما يعرف عن الانتقالات ولا الإصابات ولا المدرب الجديد، وتقييماته ما تتحرك بعد اليوم المختار. إعدادات Elo انضبطت على مباريات قبل 1 أغسطس 2025، فالمواسم اللي قبلها داخلة جزئيًا في الضبط.')}</p></div>`:''}`;
  const q=s=>root.querySelector(s),re=()=>draw(root,F);
  q('#tml').onchange=e=>{S.lg=e.target.value;S.si=-1;S.di=-1;re()};
  q('#tms').onchange=e=>{S.si=+e.target.value;S.di=-1;re()};
  let tt=null;q('#tmd').oninput=e=>{S.di=+e.target.value;clearTimeout(tt);tt=setTimeout(()=>{re();const n=root.querySelector('#tmd');if(n)n.focus()},120)};
  root.querySelectorAll('.tmc-q button').forEach(b=>b.onclick=()=>{const f=+b.dataset.f;S.di=f===0?0:dates.indexOf(sm.slice().sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id))[Math.floor(f*sm.length)].d);re()});
 }
 INS.tmProject=(F,id,si,upto)=>project(league(F,id),si,upto,F.params);
 INS.ar({'Time machine':'آلة الزمن'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
