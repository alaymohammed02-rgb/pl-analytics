/* ===== Who carries the team (#/carry, in Analysis after Club twins): how much of a club's attack rests on one player, and how much its XI changes =====
   Attack output of a player = his non-penalty xG + expected assists (xAG), added up over the matches where both are known (a match
   missing either number for a player is left out for him, so the two are never mixed with a zero). A club's shares are each player's
   output ÷ the club's total over the same player-matches: the top player's share, the top three's share, and the effective number of
   contributors = 1 ÷ Σ share² (10 equal contributors give 10; one player doing everything gives 1).
   Rotation = the average number of the 11 starters who were not in the club's previous starting XI (PitchAPI official line-ups);
   the core = players who started 70% or more of the club's matches.
   It says who the attack leans on and how settled the side is, over the few matches played so far. It does not say what happens when a
   player is missing: a club has too few matches with and without any one player to show that. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.poolOne!=='function')return;
 INS.addPage('carry','Who carries the team','analysis','clubtwins');
 const S={team:'',lg:'',m:'dep'},CORE=0.7;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const logo=t=>typeof logoOf==='function'&&logoOf(t)?`<img src="${esc(logoOf(t))}" alt="" width="16" height="16" class="lk-lg">`:'';
 const f1=v=>v==null?'–':(+v).toFixed(1),f2=v=>v==null?'–':(+v).toFixed(2),pc=v=>Math.round(v*100);
 async function calc(lid){
  const P=await INS.poolOne(lid,['pl','mx']);if(!P||!P.pl||!P.mx||!P.mx.m)return null;
  const ix={};P.pl.cols.forEach((c,k)=>ix[c]=k);const fin=new Set(P.ms.map(m=>m.id)),T=new Map();
  const team=n=>{let r=T.get(n);if(!r){r={t:n,pl:new Map(),rows:0,okRows:0,ms:new Set(),okMs:new Set(),xis:[]};T.set(n,r)}return r};
  P.pl.rows.forEach(r=>{if(!fin.has(r[ix.m]))return;const t=team(r[ix.c]);t.ms.add(r[ix.m]);t.rows++;
   const a=r[ix.npxg],b=r[ix.xag];if(a==null||b==null||!isFinite(a)||!isFinite(b))return;t.okRows++;t.okMs.add(r[ix.m]);
   const p=t.pl.get(r[ix.i])||{id:r[ix.i],name:r[ix.n],o:0,np:0,ag:0,mi:0,g:0};p.o+=a+b;p.np+=a;p.ag+=b;p.mi+=r[ix.mi]||0;p.g++;t.pl.set(r[ix.i],p)});
  P.ms.forEach(m=>{const e=P.mx.m[m.id],lu=e&&e.lu;if(!lu)return;[['h',m.home],['a',m.away]].forEach(([sd,n])=>{const L=lu[sd];if(L&&L.xi&&L.xi.length===11&&T.has(n))T.get(n).xis.push({id:m.id,xi:L.xi.map(p=>p[0]),names:new Map(L.xi.map(p=>[p[0],p[1]]))})})});
  const rows=[];
  T.forEach(t=>{const L=[...t.pl.values()].sort((a,b)=>b.o-a.o||a.name.localeCompare(b.name)),tot=L.reduce((s,p)=>s+p.o,0);
   if(t.xis.length<3||t.okMs.size<3||tot<=0||L.length<3)return;   /* xAG is missing for whole matches: the shares need 3 matches that have it */
   const sh=L.map(p=>p.o/tot),top=L[0],neff=1/sh.reduce((s,x)=>s+x*x,0);
   let ch=0;for(let i=1;i<t.xis.length;i++){const prev=new Set(t.xis[i-1].xi);ch+=t.xis[i].xi.filter(x=>!prev.has(x)).length}
   const starts=new Map();t.xis.forEach(x=>x.xi.forEach(p=>starts.set(p,(starts.get(p)||0)+1)));const n=t.xis.length,nm_=new Map();t.xis.forEach(x=>x.names.forEach((v,k)=>nm_.set(k,v)));
   const core=[...starts.entries()].filter(([,c])=>c/n>=CORE).map(([id])=>nm_.get(id));
   rows.push({t:t.t,n:t.ms.size,nok:t.okMs.size,nx:n,tot,top,top1:sh[0],top3:sh[0]+sh[1]+sh[2],neff,rot:ch/(n-1),core:core.length,coreNames:core,L,okRows:t.okRows,allRows:t.rows})});
  return {rows,id:lid};
 }
 R.carry=async function(el){
  el.innerHTML='<h2>Who carries the team</h2><div id="cyroot" class="ins lk cy"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#cyroot'),lg=D.id;if(S.lg!==lg){S.lg=lg;S.team=''}
  const C=await calc(lg);if(!root.isConnected||D.id!==lg)return;
  if(!C||C.rows.length<4){root.innerHTML=`<div class="empty">${two(`Not enough matches with player numbers and line-ups in ${esc(D.name)} yet.`,`ما فيه مباريات كفاية بأرقام اللاعبين والتشكيلات في ${nm(D.name)} للحين.`)}</div>`;return}
  const rows=C.rows;
  if(!S.team||!rows.some(r=>r.t===S.team)){const fv=typeof favOf==='function'?favOf():null;S.team=fv&&rows.some(r=>r.t===fv)?fv:rows.slice().sort((a,b)=>b.top1-a.top1)[0].t}
  const byD=rows.slice().sort((a,b)=>b.top1-a.top1||a.t.localeCompare(b.t)),byR=rows.slice().sort((a,b)=>b.rot-a.rot||a.t.localeCompare(b.t));
  const paint=()=>{
   const hi=byD[0],lo=byD[byD.length-1],ro=byR[0],st=byR[byR.length-1];
   root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Who does the attack lean on, and how settled is the side?</b> A player's attack output is his non-penalty xG plus his expected assists. A club's <b>top-player share</b> is how much of the club's output comes from its best contributor; <b>rotation</b> is how many starters change from one match to the next.`,
     `<b>على مين يعتمد الهجوم، وكم التشكيلة مستقرة؟</b> إنتاج اللاعب الهجومي هو xG بدون ركلات الجزاء زائد المساعدات المتوقعة. <b>حصة أفضل لاعب</b> هي نسبة إنتاج النادي اللي تجي من أفضل مساهم فيه؛ و<b>التدوير</b> هو كم لاعب يتغيّر في التشكيلة من مباراة لمباراة.`)}</p>
     <div class="lk-hl"><div class="lk-k"><span>${two('Most reliant on one player','الأكثر اعتمادًا على لاعب واحد')}</span>${logo(hi.t)}${nm(hi.t)}<b>${nb(pc(hi.top1)+'%')}</b><span>${nm(hi.top.name)}</span></div>
      <div class="lk-k"><span>${two('Most spread out','الأكثر توزيعًا')}</span>${logo(lo.t)}${nm(lo.t)}<b>${nb(pc(lo.top1)+'%')}</b><span>${nm(lo.top.name)}</span></div></div>
     <p class="mu">${two(`Only a few matches have been played, so a single big game moves a share a lot. This is who the attack leans on so far; it does not say what happens when that player is missing.`,`ما لعبوا إلا مباريات قليلة، فمباراة كبيرة وحدة تحرّك النسبة كثير. هذا على مين يعتمد الهجوم لين الحين؛ ما يقول وش يصير لو غاب هذا اللاعب.`)}</p></div>
    <div class="card"><div class="seg" role="group" aria-label="View"><button type="button" data-m="dep" aria-pressed="${S.m==='dep'}">${two('Top-player share','حصة أفضل لاعب')}</button><button type="button" data-m="rot" aria-pressed="${S.m==='rot'}">${two('Rotation','التدوير')}</button></div>
     ${S.m==='dep'?depBars(byD):rotBars(byR)}</div>
    <div class="card lk-me cy-me"><h3>${logo(S.team)}${nm(S.team)}</h3>${detail(rows.find(r=>r.t===S.team))}</div>`;
   root.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{S.m=b.dataset.m;paint()}));
   root.querySelectorAll('[data-tm]').forEach(b=>b.addEventListener('click',()=>{S.team=b.dataset.tm;paint();const d=root.querySelector('.cy-me');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest',behavior:'smooth'})}));
  };
  const depBars=L=>{const mx=Math.max(...L.map(r=>r.top1));return `<ol class="lk-bars cy-bars">${L.map(r=>`<li class="${r.t===S.team?'me':''}"><button type="button" data-tm="${esc(r.t)}"${INS.tipAttr([r.t,r.top.name+': '+pc(r.top1)+'% of the output','Top three: '+pc(r.top3)+'%','Effective contributors: '+f1(r.neff),r.nok+' matches with xG and xAG'])}><span class="lk-bn lk-tn">${logo(r.t)}${nm(r.t)}<small class="mu">${nm(r.top.name)}</small></span><span class="lk-bb cy-b"><i class="up" style="left:0;width:${(r.top1/mx*100).toFixed(1)}%"></i></span><b>${nb(pc(r.top1)+'%')}</b></button></li>`).join('')}</ol>
   <p class="mu ins-note">${two('Share of the club\'s non-penalty xG + xAG that comes from its best contributor. Tap a club for its players.','حصة xG بدون ركلات الجزاء + xAG للنادي اللي تجي من أفضل مساهم فيه. اضغط نادي تشوف لاعبيه.')}</p>`};
  const rotBars=L=>{const mx=Math.max(...L.map(r=>r.rot));return `<ol class="lk-bars cy-bars">${L.map(r=>`<li class="${r.t===S.team?'me':''}"><button type="button" data-tm="${esc(r.t)}"${INS.tipAttr([r.t,'Changes per match: '+f1(r.rot),'Core players (70%+ of starts): '+r.core,r.nx+' line-ups'])}><span class="lk-bn lk-tn">${logo(r.t)}${nm(r.t)}</span><span class="lk-bb cy-b"><i class="up" style="left:0;width:${(r.rot/mx*100).toFixed(1)}%"></i></span><b>${nb(f1(r.rot))}</b></button></li>`).join('')}</ol>
   <p class="mu ins-note">${two('Average number of starters (out of 11) who were not in the previous match\'s XI.','متوسط عدد اللاعبين (من 11) اللي ما كانوا في تشكيلة المباراة السابقة.')}</p>`};
  paint();
 };
 function detail(r){
  const top=r.L.slice(0,8),mx=top[0].o;
  return `<p>${two(`Top player <b>${nm(r.top.name)}</b>: <b>${pc(r.top1)}%</b> of the club's output; top three <b>${pc(r.top3)}%</b>. Effective contributors <b>${f1(r.neff)}</b>. XI changes per match <b>${f1(r.rot)}</b>; <b>${r.core}</b> players started 70% or more of ${r.nx} matches.`,
    `أفضل لاعب <b>${nm(r.top.name)}</b>: <b>${nb(pc(r.top1)+'%')}</b> من إنتاج النادي؛ وأفضل ثلاثة <b>${nb(pc(r.top3)+'%')}</b>. المساهمون الفعليون <b>${nb(f1(r.neff))}</b>. تغييرات التشكيلة لكل مباراة <b>${nb(f1(r.rot))}</b>؛ و<b>${nb(r.core)}</b> لاعبين بدأوا ${nb('70%')} أو أكثر من ${nb(r.nx)} مباراة.`)}</p>
   <div class="wrap"><table class="lk-t cy-t"><thead><tr><th>${two('Player','اللاعب')}</th><th class="n">xG</th><th class="n">xAG</th><th class="n">${two('Share','الحصة')}</th><th class="n lk-nm">${two('Minutes','الدقائق')}</th></tr></thead><tbody>
   ${top.map(p=>`<tr><td><a href="#/player/${encodeURIComponent(p.id)}">${nm(p.name)}</a></td><td class="n">${f2(p.np)}</td><td class="n">${f2(p.ag)}</td><td class="n">${nb(pc(p.o/r.tot)+'%')}<i class="cy-p" style="--w:${(p.o/mx*100).toFixed(0)}%"></i></td><td class="n lk-nm">${Math.round(p.mi)}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two(`xG here is without penalties. The shares use the ${r.nok} of the club's ${r.n} matches that have both xG and xAG (${r.okRows} of ${r.allRows} player-matches); only those are counted.`,`الـ xG هنا بدون ركلات الجزاء. النسب تستخدم ${nb(r.nok)} من ${nb(r.n)} مباراة للنادي فيها xG و xAG معًا (${nb(r.okRows)} من ${nb(r.allRows)} لاعب-مباراة)؛ هذي بس اللي تنحسب.`)}</p>`;
 }
 INS.ar({"Who carries the team":"مين يشيل الفريق","View":"العرض","Player":"اللاعب","Share":"الحصة","Minutes":"الدقائق"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
