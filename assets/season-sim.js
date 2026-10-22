/* ===== Season simulator (#/sim, in League after the table): the rest of the season played 10,000 times =====
   Fixtures left: in a league where every club plays every other once at home and once away (the six domestic leagues), the
   matches still to play are exactly the (home, away) pairs not played yet, so the whole rest of the season is known without
   a calendar (PitchAPI's fixture list only reaches a few rounds ahead). Cups and the Champions League are left out.
   Each match: the site's "xG Poisson 1" model (as in the Intelligence Lab and the match preview): each club's attack and
   defence are its xG for and against per match this season, pulled toward the league average by 3 matches' worth; the home
   side scores the league's home xG average × its attack × the opponent's defence, the away side likewise; goals are
   independent Poisson counts. Strengths stay as they are today for the whole simulation.
   Order: points, then goal difference, then goals scored, then a coin toss (a league's own tiebreakers can differ).
   Random numbers come from a fixed seed, so the same data gives the same numbers on every visit. Nothing is a forecast of
   what will happen: injuries, transfers, form and the schedule's timing are not in the model.
   Results you pick for the next fixtures are kept as picked (the score inside a picked result still comes from the model). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('sim','Season simulator','league','table');
 const N=10000,SEED=20261022,TOP=4,BOT=3,N0=3;
 const S={lock:{},team:'',lg:''};let RES=null,RUN=0;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const pc=v=>v>=.995?'>99%':v>0&&v<.005?'<1%':Math.round(v*100)+'%';
 const okComp=()=>!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(D.name||'');
 /* seeded uniform numbers in [0,1) (mulberry32) */
 const rng=s=>()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
 const cdf=l=>{const o=[];let p=Math.exp(-l),c=0;for(let k=0;k<=10;k++){c+=p;o.push(c);p*=l/(k+1)}o[10]=1;return o};
 const draw=(c,u)=>{let k=0;while(u>c[k])k++;return k};
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};

 async function setup(){
  const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]);
  const played=D.matches.filter(m=>wkSc(m.score));
  const teams=[...new Set(D.matches.flatMap(m=>[m.home,m.away]))].sort((a,b)=>a.localeCompare(b));
  const done=new Set(played.map(m=>m.home+'|'+m.away));
  if(played.some((m,i)=>played.findIndex(x=>x.home===m.home&&x.away===m.away)!==i))return {err:'pairs'};
  const left=[];teams.forEach(h=>teams.forEach(a=>{if(h!==a&&!done.has(h+'|'+a))left.push({h,a})}));
  /* strengths: the same numbers as the xG Poisson 1 model */
  const T=new Map();let hs=0,as=0,n=0;
  played.forEach(m=>{const xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null)return;n++;hs+=xh;as+=xa;
   [[m.home,xh,xa],[m.away,xa,xh]].forEach(([t,f,a])=>{const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=a;T.set(t,r)})});
  if(n<10)return {err:'few',n};
  const H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T.get(t)||{n:0,f:0,a:0};return {att:(r.f+N0*mu)/(r.n+N0)/mu,def:(r.a+N0*mu)/(r.n+N0)/mu,n:r.n}};
  const lam=(h,a)=>{const x=str(h),y=str(a);return [H*x.att*y.def,A*y.att*x.def]};
  const base=ltTable(played,tx);
  return {teams,left,lam,str,base,played,n,H,A};
 }
 const outcome=(g,h)=>g>h?'H':g<h?'A':'D';
 function probs(lh,la){const a=pois(lh),b=pois(la);let w=0,d=0,l=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=a[i]*b[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}const s=w+d+l;return [w/s,d/s,l/s]}

 /* the simulation: in slices, so the page stays responsive */
 async function simulate(M,lock,onStep){
  const T=M.teams,ix=new Map(T.map((t,i)=>[t,i])),nT=T.length;
  const b0=new Float64Array(nT),g0=new Float64Array(nT),f0=new Float64Array(nT);
  M.base.forEach(r=>{const i=ix.get(r.t);if(i==null)return;b0[i]=r.pts;g0[i]=r.f-r.a;f0[i]=r.f});
  const F=M.left.map(x=>{const [lh,la]=M.lam(x.h,x.a);return {h:ix.get(x.h),a:ix.get(x.a),ch:cdf(lh),ca:cdf(la),lock:lock[x.h+'|'+x.a]||''}});
  const pos=T.map(()=>new Float64Array(nT)),sum=new Float64Array(nT),fin=T.map(()=>[]);
  const r=rng(SEED),pts=new Float64Array(nT),gd=new Float64Array(nT),gf=new Float64Array(nT),tb=new Float64Array(nT),ord=[...Array(nT).keys()];
  for(let s=0;s<N;s++){
   pts.set(b0);gd.set(g0);gf.set(f0);
   for(const x of F){let g,h,k=0;do{g=draw(x.ch,r());h=draw(x.ca,r());k++}while(x.lock&&outcome(g,h)!==x.lock&&k<60);
    if(x.lock&&outcome(g,h)!==x.lock){g=x.lock==='H'?1:0;h=x.lock==='A'?1:0;if(x.lock==='D'){g=h=1}}
    gf[x.h]+=g;gf[x.a]+=h;gd[x.h]+=g-h;gd[x.a]+=h-g;if(g>h)pts[x.h]+=3;else if(g<h)pts[x.a]+=3;else{pts[x.h]++;pts[x.a]++}}
   for(let i=0;i<nT;i++)tb[i]=r();
   ord.sort((a,b)=>pts[b]-pts[a]||gd[b]-gd[a]||gf[b]-gf[a]||tb[b]-tb[a]);
   for(let p=0;p<nT;p++){const i=ord[p];pos[i][p]++;sum[i]+=pts[i];fin[i].push(pts[i])}
   if(s%1000===999){if(onStep&&onStep(s+1)===false)return null;await new Promise(z=>setTimeout(z,0))}
  }
  const q=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))]};
  return T.map((t,i)=>{const P=[...pos[i]].map(v=>v/N),b=M.base.find(r=>r.t===t)||{p:0,pts:0,f:0,a:0};
   return {t,P,now:b.pts,pl:b.p,gd:b.f-b.a,mean:sum[i]/N,lo:q(fin[i],.1),hi:q(fin[i],.9),win:P[0],top:P.slice(0,TOP).reduce((a,b)=>a+b,0),bot:P.slice(nT-BOT).reduce((a,b)=>a+b,0),
    best:P.indexOf(Math.max(...P))+1}}).sort((a,b)=>b.mean-a.mean||a.t.localeCompare(b.t));
 }

 R.sim=async function(el){
  el.innerHTML='<h2>Season simulator</h2><div id="smroot" class="ins sm"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#smroot'),lg=D.id,run=++RUN;
  if(S.lg!==lg){S.lg=lg;S.lock={};S.team='';RES=null}
  if(!okComp()){root.innerHTML=`<div class="empty">${two(`${esc(D.name)} is not a league where every club plays every other home and away, so it has no season to simulate here. Choose a domestic league.`,`${nm(D.name)} مو دوري يلعب فيه كل نادي مع الثاني ذهاب وإياب، فما فيه موسم نحاكيه هنا. اختر دوري محلي.`)}</div>`;return}
  const M=await setup();if(!root.isConnected||D.id!==lg||run!==RUN)return;
  if(M.err){root.innerHTML=`<div class="empty">${M.err==='few'?two(`Too few matches with shot data in ${esc(D.name)} yet (${M.n}; 10 needed) for the model.`,`مباريات قليلة ببيانات التسديد في ${nm(D.name)} للحين (${nb(M.n)}؛ نحتاج ${nb(10)}) للنموذج.`):two('The results in the data do not form a home-and-away league, so the fixtures left cannot be worked out.','النتائج في البيانات ما تشكّل دوري ذهاب وإياب، فما نقدر نطلع المباريات الباقية.')}</div>`;return}
  if(!M.left.length){root.innerHTML=`<div class="empty">${two('Every match of the season has been played: the table is final.','كل مباريات الموسم انلعبت: الترتيب نهائي.')}</div>`;return}
  /* the next fixtures, to pick results for: PitchAPI's fixture list, only those still to play */
  await (typeof fixLoad==='function'?fixLoad():null);
  const left=new Set(M.left.map(x=>x.h+'|'+x.a));
  const next=((((typeof FIX==='object'&&FIX.d&&FIX.d.leagues)||{})[lg])||[]).filter(x=>left.has(x.h+'|'+x.a)&&Date.parse(x.k||x.d)>Date.now()).sort((a,b)=>String(a.k||a.d).localeCompare(String(b.k||b.d))).slice(0,10);
  const key=()=>lg+'|'+M.played.length+'|'+JSON.stringify(S.lock);
  const paint=()=>{
   const nT=M.teams.length,lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
   root.innerHTML=`<div class="card sm-intro"><p>${two(`<b>The rest of the season, played ${N.toLocaleString('en')} times.</b> ${M.left.length} matches are left: every home-and-away pair not played yet. Each one is played with the site's xG model (each club's chances created and allowed this season), and the final tables are counted.`,`<b>باقي الموسم، ينلعب ${nb(N.toLocaleString('en'))} مرة.</b> باقي ${nb(M.left.length)} مباراة: كل مواجهة ذهاب أو إياب ما انلعبت للحين. كل وحدة تنلعب بنموذج xG حق الموقع (الفرص اللي صنعها كل نادي واللي سمح فيها هالموسم)، وبعدين نعد الترتيب النهائي.`)}</p>
     <p class="mu">${two('A model, not a forecast: injuries, transfers and changes of form are not in it.','نموذج، مو توقع أكيد: الإصابات والانتقالات وتغيّر المستوى مو داخلة فيه.')}</p></div>
    ${next.length?`<div class="card"><h3>Pick the next results</h3><p class="mu sm-h">${two('Tap a result to fix it in every simulation; tap it again to let the model play it. The model\'s chances are shown under each match.','اضغط نتيجة تثبتها في كل المحاكاة؛ اضغطها مرة ثانية يرجع النموذج يلعبها. فرص النموذج تحت كل مباراة.')}</p>
     <div class="sm-fx">${next.map(x=>{const k=x.h+'|'+x.a,[lh,la]=M.lam(x.h,x.a),p=probs(lh,la),v=S.lock[k]||'';
      return `<div class="sm-f" data-k="${esc(k)}"><div class="sm-fd mu">${esc(new Date(x.k||x.d).toLocaleDateString(lc,{weekday:'short',day:'numeric',month:'short'}))}</div>
       <div class="sm-fb">${[['H',x.h,p[0]],['D','Draw',p[1]],['A',x.a,p[2]]].map(([o,t,q])=>`<button type="button" data-o="${o}" class="${v===o?'on':''}" aria-pressed="${v===o}">${o==='D'?'<span>Draw</span>':nm(t)}<small>${nb(pc(q))}</small></button>`).join('')}</div></div>`}).join('')}</div>
     <div class="ctl"><button type="button" class="s" id="smclr"${Object.keys(S.lock).length?'':' disabled'}>Clear picks</button></div></div>`:''}
    <div class="card"><h3>Final table: chances</h3><div id="smout"><div class="empty skel">Simulating…</div></div></div>`;
   root.querySelectorAll('.sm-f').forEach(f=>f.addEventListener('click',e=>{const b=e.target.closest('button[data-o]');if(!b)return;const k=f.dataset.k;S.lock[k]=S.lock[k]===b.dataset.o?'':b.dataset.o;if(!S.lock[k])delete S.lock[k];paint()}));
   const c=root.querySelector('#smclr');if(c)c.onclick=()=>{S.lock={};paint()};
   go();
  };
  const go=async()=>{
   const out=root.querySelector('#smout'),k=key(),my=++RUN;
   if(!RES||RES.k!==k){const r=await simulate(M,S.lock,s=>{if(my!==RUN||!out.isConnected)return false;out.innerHTML=`<div class="empty">${two(`Simulating… ${s.toLocaleString('en')} / ${N.toLocaleString('en')}`,`نحاكي… ${nb(s.toLocaleString('en')+' / '+N.toLocaleString('en'))}`)}</div>`});
    if(!r||my!==RUN||!out.isConnected)return;RES={k,rows:r}}
   table(out,RES.rows,M);
  };
  paint();
 };

 function table(out,rows,M){
  const nT=rows.length;
  if(!S.team||!rows.some(r=>r.t===S.team)){const fv=typeof favOf==='function'?favOf():null;S.team=fv&&rows.some(r=>r.t===fv)?fv:rows[0].t}
  const me=rows.find(r=>r.t===S.team);
  const strip=r=>`<span class="sm-st" style="--n:${nT}">${r.P.map(p=>`<i style="opacity:${p<.005?.08:(.2+.8*Math.min(1,p/.5)).toFixed(2)}"></i>`).join('')}</span>`;
  out.innerHTML=`<div class="wrap"><table class="sm-t"><thead><tr><th class="n">#</th><th>Team</th><th class="n sm-now" title="Points now">Pts</th><th class="n"><span class="sm-wide">Expected final points</span><span class="sm-narrow">Expected</span></th><th class="n">Title</th><th class="n">Top ${TOP}</th><th class="n">Bottom ${BOT}</th><th class="sm-pc">Final position</th></tr></thead><tbody>
   ${rows.map((r,i)=>`<tr data-t="${esc(r.t)}" class="${r.t===S.team?'me':''}" tabindex="0"><td class="n">${i+1}</td><td class="sm-tn">${typeof logoOf==='function'&&logoOf(r.t)?`<img src="${esc(logoOf(r.t))}" alt="" width="16" height="16" class="sm-lg">`:''}${nm(r.t)}</td><td class="n sm-now">${r.now}</td><td class="n"><b>${r.mean.toFixed(1)}</b> <span class="mu sm-rg">${nb(r.lo+'–'+r.hi)}</span></td>
    <td class="n">${nb(pc(r.win))}</td><td class="n">${nb(pc(r.top))}</td><td class="n">${nb(pc(r.bot))}</td><td class="sm-pc"${INS.tipAttr([r.t,...r.P.map((p,j)=>j+1+': '+pc(p)).filter((x,j)=>r.P[j]>=.005)])}>${strip(r)}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two(`Expected final points: the average over the simulations, with the range of 80% of them. Final position: each square is a place in the table (1st on the left), darker = more likely. Top ${TOP} and bottom ${BOT} are places in the table; which places qualify or go down differs by league. Ties: goal difference, then goals scored.`,`النقاط النهائية المتوقعة: متوسط المحاكاة، ومعها المدى اللي يغطي 80% منها. المركز النهائي: كل مربع مركز في الترتيب (الأول على اليسار)، الأغمق = أرجح. أول ${nb(TOP)} وآخر ${nb(BOT)} مراكز في الترتيب؛ أي المراكز تتأهل أو تهبط يختلف من دوري لدوري. التعادل بالنقاط: فارق الأهداف، ثم الأهداف المسجلة.`)}</p>
   <div class="sm-me card"><h3>${typeof logoOf==='function'&&logoOf(me.t)?`<img src="${esc(logoOf(me.t))}" alt="" width="20" height="20" class="sm-lg">`:''}${nm(me.t)}</h3>${detail(me,nT,M)}</div>`;
  out.querySelectorAll('tr[data-t]').forEach(tr=>{const f=()=>{S.team=tr.dataset.t;table(out,rows,M);const d=out.querySelector('.sm-me');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest',behavior:'smooth'})};tr.addEventListener('click',f);tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}})});
 }
 function detail(r,nT,M){
  const W=640,H=200,Lm=30,Rm=8,T=14,B=26,bw=(W-Lm-Rm)/nT,mx=Math.max(...r.P,.01),Y=v=>T+(1-v/mx)*(H-T-B);
  const s=M.str(r.t);
  return `<p>${two(`Most likely final place: <b>${r.best}</b> (${pc(r.P[r.best-1])}). Expected final points <b>${r.mean.toFixed(1)}</b> (80% of simulations between ${r.lo} and ${r.hi}); ${r.now} points now from ${r.pl} matches.`,`المركز النهائي الأرجح: <b>${nb(r.best)}</b> (${nb(pc(r.P[r.best-1]))}). النقاط النهائية المتوقعة <b>${nb(r.mean.toFixed(1))}</b> (80% من المحاكاة بين ${nb(r.lo)} و${nb(r.hi)})؛ عنده الحين ${nb(r.now)} نقطة من ${nb(r.pl)} مباراة.`)}</p>
   <div class="ph-svg"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Final position chances">${r.P.map((p,i)=>`<rect x="${(Lm+i*bw+1).toFixed(1)}" y="${Y(p).toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${(H-B-Y(p)).toFixed(1)}" class="sm-b${i+1===r.best?' on':''}"${INS.tipAttr([(i+1)+'',pc(p)])}/>${p>=.03?`<text x="${(Lm+i*bw+bw/2).toFixed(1)}" y="${(Y(p)-4).toFixed(1)}" class="ins-ax" text-anchor="middle">${Math.round(p*100)}</text>`:''}<text x="${(Lm+i*bw+bw/2).toFixed(1)}" y="${H-B+14}" class="ins-ax" text-anchor="middle">${i+1}</text>`).join('')}
    <line x1="${Lm}" x2="${W-Rm}" y1="${H-B}" y2="${H-B}" class="ins-axl"/></svg></div>
   <p class="mu ins-note">${two(`Bars: chance (%) of finishing in each place. Model strengths: attack ${s.att.toFixed(2)}, defence ${s.def.toFixed(2)} (1 = league average; defence below 1 = concedes fewer chances), from ${s.n} matches with shot data.`,`الأعمدة: فرصة (%) إنه ينهي في كل مركز. قوة النموذج: هجوم ${nb(s.att.toFixed(2))}، دفاع ${nb(s.def.toFixed(2))} (1 = متوسط الدوري؛ الدفاع تحت 1 = يسمح بفرص أقل)، من ${nb(s.n)} مباراة ببيانات التسديد.`)}</p>`;
 }
 INS.ar({"Season simulator":"محاكي الموسم","Pick the next results":"اختر نتائج المباريات الجاية","Clear picks":"امسح الاختيارات","Final table: chances":"الترتيب النهائي: الاحتمالات",
  "Expected final points":"النقاط النهائية المتوقعة","Title":"البطولة","Top #":"أول #","Bottom #":"آخر #","Final position":"المركز النهائي","Pts":"النقاط","Points now":"النقاط الحين","Draw":"تعادل","Simulating…":"نحاكي…","Final position chances":"احتمالات المركز النهائي","Expected":"المتوقع"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
