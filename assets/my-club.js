/* ===== My club (#/myclub, Home room): one club of the open league on one screen =====
   The club is one you starred (favOf: the first starred team of the open league) or the one chosen here (kept in plx_myclub). Everything comes from files the site already has:
   the league's results (D.matches) for the position, form and last results; data/fixtures.json for the next match; data/ledger.json (the frozen pre-match chances of Elo, the xG
   model, the XI model and the Elo + XI average) or, when the match is not in the ledger, data/elo_own.json's own pre-match chances; data/elo_own.json for the rating, its change over
   5 and 10 matches and its last 60 values; the league's player rows and ratings (pl, rt files) for the players in form (average PitchAPI rating over the club's last 5 matches,
   at least 3 rated) and the season's scorers. Nothing is estimated here beyond what those files say, and the page repeats what each number is. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('myclub','My club','home','overview');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const S={tok:0};
 const KEY='plx_myclub';
 const MODELS=[['e','Elo','إيلو'],['m2','xG model','نموذج xG'],['xi','XI model','نموذج التشكيلة'],['bl','Elo + XI','إيلو + التشكيلة']];
 const pct=v=>Math.round(v*100);
 const getSaved=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch(e){return {}}};
 const setSaved=o=>{try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}};
 const crestOf=n=>(typeof logoOf==='function'&&logoOf(n))||'';
 const crest=n=>{const u=crestOf(n);return u?`<img class="mc-c" src="${esc(u)}" alt="" aria-hidden="true">`:''};
 /* the club of the open league: starred, else the saved choice, else none (exported for the test) */
 function pickClub(teams,saved,fav){
  if(saved&&saved[D.id]&&teams.includes(saved[D.id]))return saved[D.id];
  if(fav&&teams.includes(fav))return fav;
  return null;
 }
 const sparkline=(h,w,ht)=>{
  if(!h||h.length<2)return '';
  const v=h.map(x=>x[1]),lo=Math.min(...v),hi=Math.max(...v),sx=i=>2+i/(h.length-1)*(w-4),sy=x=>ht-3-(x-lo)/((hi-lo)||1)*(ht-6);
  return `<svg class="mc-sp" viewBox="0 0 ${w} ${ht}" role="img" aria-label="Elo rating over the last ${h.length} matches"><polyline fill="none" stroke="var(--ac,#4cc9f0)" stroke-width="2" points="${v.map((x,i)=>sx(i).toFixed(1)+','+sy(x).toFixed(1)).join(' ')}"/><circle cx="${sx(h.length-1).toFixed(1)}" cy="${sy(v[v.length-1]).toFixed(1)}" r="3.5" fill="var(--ac,#4cc9f0)"/></svg>`;
 };
 const when=k=>{try{const d=new Date(k);return d.toLocaleString(ar()?'ar':'en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return k}};
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 /* everything for one club (exported for the test) */
 function summary(club,F){
  const fin=D.matches.filter(m=>wkSc(m.score)&&m.date);
  const tab=typeof ltTable==='function'&&(typeof ltOk!=='function'||ltOk(fin))?ltTable(fin,new Map()):null;
  const pos=tab?tab.findIndex(r=>r.t===club)+1:0,row=tab&&pos?tab[pos-1]:null;
  const mine=fin.filter(m=>m.home===club||m.away===club).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.match_id).localeCompare(String(a.match_id)));
  const res=m=>{const g=wkSc(m.score),h=m.home===club,f=h?g[0]:g[1],a=h?g[1]:g[0];return f>a?'W':f<a?'L':'D'};
  const fx=((F&&F.leagues&&F.leagues[D.id])||[]).filter(f=>f.h===club||f.a===club).sort((a,b)=>String(a.k).localeCompare(String(b.k)));
  return {fin,tab,pos,row,mine,res,next:fx[0]||null,later:fx.slice(1,5),n:tab?tab.length:0};
 }
 INS.myclub={pickClub,summary};
 async function leagueFiles(){
  const l=(ALL.leagues||[]).find(x=>x.id===D.id)||{};
  const get=async(f,v)=>{if(!f)return null;try{return await loadJson(f,v)}catch(e){return null}};
  const [F,E,L,P,RT]=await Promise.all([get('fixtures.json',ALL.generated),get('elo_own.json',ALL.generated),get('ledger.json',ALL.generated),get(l.pl_file,l.pl_v),get(l.rt_file,l.rt_v)]);
  return {F,E,L,P,RT};
 }
 /* the players in form and the scorers (exported for the test) */
 function players(club,S0,P,RT){
  if(!P||!P.rows)return {form:[],top:[]};
  const c={};P.cols.forEach((k,i)=>c[k]=i);
  const rows=P.rows.filter(r=>r[c.c]===club);
  const last=S0.mine.slice(0,5).map(m=>m.match_id);
  const rate={},cnt={};
  if(RT&&RT.m)for(const mid of last){const M=RT.m[mid];if(!M)continue;for(const [pid,v] of Object.entries(M)){if(v==null)continue;const r=rows.find(x=>x[c.m]===mid&&x[c.i]===pid);if(!r)continue;rate[pid]=(rate[pid]||0)+v;cnt[pid]=(cnt[pid]||0)+1}}
  const name={};rows.forEach(r=>{name[r[c.i]]=r[c.n]});
  const form=Object.keys(cnt).filter(p=>cnt[p]>=3).map(p=>({id:p,n:name[p],avg:rate[p]/cnt[p],k:cnt[p]})).sort((a,b)=>b.avg-a.avg||a.n.localeCompare(b.n)).slice(0,5);
  const agg={};rows.forEach(r=>{const a=agg[r[c.i]]||(agg[r[c.i]]={id:r[c.i],n:r[c.n],g:0,a:0,mi:0});a.g+=r[c.gl]||0;a.a+=r[c.ast]||0;a.mi+=r[c.mi]||0});
  const top=Object.values(agg).filter(x=>x.g+x.a>0).sort((a,b)=>(b.g+b.a)-(a.g+a.a)||b.g-a.g||a.n.localeCompare(b.n)).slice(0,5);
  return {form,top};
 }
 INS.myclub.players=players;
 function draw(root,club,files,teams){
  const Sm=summary(club,files.F),E=files.E&&files.E.leagues&&files.E.leagues[D.id],el=E&&E.teams&&E.teams[club];
  const sel=`<div class="card"><div class="ctl mc-ctl"><label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="mcs">${teams.map(t=>`<option${t===club?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
   <a class="s" href="#/club/${encodeURIComponent(club)}">${two('Club page','صفحة النادي')}</a><a class="s" href="#/club/${encodeURIComponent(club)}/matches">${two('All matches','كل المباريات')}</a></div></div>`;
  const head=`<div class="card mc-h">${crest(club)}<div><h3>${nm(club)}</h3><div class="mu">${nm(D.name)}${Sm.row?` · <span class="mc-pos">${two('Position','المركز')} ${nb(Sm.pos+'/'+Sm.n)}</span> · ${nb(Sm.row.pts)} ${two('points','نقطة')} · ${nb(Sm.row.p)} ${two('played','لعب')} · ${nb((Sm.row.f-Sm.row.a>0?'+':'')+(Sm.row.f-Sm.row.a))} ${two('goal difference','فارق الأهداف')}`:''}</div></div></div>`;
  /* next match and the chances */
  let next=`<div class="card"><h3>${two('Next match','المباراة القادمة')}</h3><div class="empty">${two('No coming match in the data.','ما فيه مباراة قادمة في البيانات.')}</div></div>`;
  if(Sm.next){
   const n=Sm.next,L=files.L&&files.L.p&&files.L.p[n.i],pr=files.E&&files.E.leagues&&files.E.leagues[D.id]&&files.E.leagues[D.id].pred&&files.E.leagues[D.id].pred[n.i];
   const home=n.h===club,opp=home?n.a:n.h;
   const mine=v=>home?v[0]:v[2],theirs=v=>home?v[2]:v[0];
   const rowsM=L?MODELS.filter(m=>L[m[0]]).map(m=>[m,L[m[0]]]):(pr?[[MODELS[0],pr]]:[]);
   next=`<div class="card mc-n"><h3>${two('Next match','المباراة القادمة')}</h3>
    <div class="mc-m"><span class="mu">${esc(when(n.k))}</span> <b>${home?two('Home','ملعبه'):two('Away','خارج ملعبه')}</b> ${two('against','ضد')} <a href="#/preview/${encodeURIComponent(n.i)}">${crest(opp)}${nm(opp)}</a></div>
    ${rowsM.length?`<table class="lk-t mc-tt"><thead><tr><th>${two('Model','النموذج')}</th><th class="n">${nm(club)}</th><th class="n">${two('Draw','تعادل')}</th><th class="n">${nm(opp)}</th></tr></thead><tbody>${rowsM.map(([m,v])=>`<tr data-m="${m[0]}"><td>${two(m[1],m[2])}</td><td class="n"><b>${nb(pct(mine(v))+'%')}</b></td><td class="n">${nb(pct(v[1])+'%')}</td><td class="n">${nb(pct(theirs(v))+'%')}</td></tr>`).join('')}</tbody></table>
     <p class="mu ins-note">${L?two('Chances written before kick-off and kept (the Prediction ledger scores them afterwards). They are chances, not a forecast of the score.','فرص انكتبت قبل الانطلاق وانحفظت (سجل التوقعات يقيّمها بعدين). هذي فرص مو توقع للنتيجة.'):two('Elo\'s chance for this match (the match is not in the ledger yet).','فرصة إيلو لهالمباراة (المباراة مو في السجل للحين).')}</p>`:`<p class="mu">${two('No model chances for this match yet.','ما فيه فرص من النماذج لهالمباراة للحين.')}</p>`}
    ${Sm.later.length?`<div class="mc-lat">${Sm.later.map(f=>`<span class="mu">${esc(f.d)}</span> ${f.h===club?two('vs','ضد')+' '+nm(f.a):two('at','عند')+' '+nm(f.h)}`).join(' · ')}</div>`:''}</div>`;
  }
  /* form and last results */
  const form=Sm.mine.slice(0,5).reverse().map(m=>{const r=Sm.res(m);return `<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`}).join('');
  const last=Sm.mine.slice(0,6).map(m=>{const g=wkSc(m.score),home=m.home===club,r=Sm.res(m);return `<tr data-m="${esc(m.match_id)}"><td class="mu">${esc(m.date)}</td><td>${home?nm(m.away):'@ '+nm(m.home)}</td><td class="n"><a href="#/match/${encodeURIComponent(m.match_id)}"><b>${nb(g[home?0:1]+' - '+g[home?1:0])}</b></a></td><td><i class="ltf ${r}"></i></td></tr>`}).join('');
  const results=`<div class="card"><h3>${two('Form and last results','الأداء وآخر النتائج')} <span class="mc-f">${form}</span></h3>${Sm.mine.length?`<table class="lk-t mc-lr"><tbody>${last}</tbody></table>`:`<div class="empty">${two('No finished match yet.','ما فيه مباراة منتهية للحين.')}</div>`}</div>`;
  /* Elo */
  const elo=el?`<div class="card mc-e"><h3>${two('Elo rating','تقييم إيلو')}</h3><div class="mc-er"><b class="mc-rt">${nb(Math.round(el.r))}</b><span class="mu">${two('last 5 matches','آخر 5 مباريات')} <b class="${el.d5>=0?'up':'dn'}">${nb((el.d5>=0?'+':'−')+Math.abs(el.d5).toFixed(0))}</b> · ${two('last 10','آخر 10')} <b class="${el.d10>=0?'up':'dn'}">${nb((el.d10>=0?'+':'−')+Math.abs(el.d10).toFixed(0))}</b></span></div>${sparkline(el.h,320,70)}<p class="mu ins-note">${two('Club Elo computed from the site\'s own results (not comparable between leagues); the line is the rating after each of the last matches.','تقييم إيلو محسوب من نتائج الموقع نفسها (ما ينقارن بين الدوريات)؛ الخط هو التقييم بعد كل مباراة من آخر المباريات.')}</p></div>`:'';
  /* players */
  const pl=players(club,Sm,files.P,files.RT);
  const plc=`<div class="card mc-p"><h3>${two('Players','اللاعبين')}</h3><div class="mc-pg"><div><h4>${two('In form','في أفضل حالاتهم')}</h4>${pl.form.length?`<table class="lk-t"><tbody>${pl.form.map(p=>`<tr data-p="${esc(p.id)}"><td>${nm(p.n)}</td><td class="n"><b>${nb(p.avg.toFixed(2))}</b> <span class="mu">${nb(p.k)} ${two('matches','مباريات')}</span></td></tr>`).join('')}</tbody></table>`:`<div class="mu">${two('No ratings for the last matches yet.','ما فيه تقييمات لآخر المباريات للحين.')}</div>`}</div>
   <div><h4>${two('Goals + assists this season','أهداف + تمريرات حاسمة هذا الموسم')}</h4>${pl.top.length?`<table class="lk-t"><tbody>${pl.top.map(p=>`<tr data-p="${esc(p.id)}"><td>${nm(p.n)}</td><td class="n"><b>${nb(p.g)}</b> + <b>${nb(p.a)}</b></td></tr>`).join('')}</tbody></table>`:`<div class="mu">${two('No goals or assists yet.','ما فيه أهداف ولا تمريرات حاسمة للحين.')}</div>`}</div></div>
   <p class="mu ins-note">${two('In form = average PitchAPI match rating over the club\'s last 5 matches, players rated in at least 3 of them. A few matches are a small sample.','في أفضل حالاتهم = متوسط تقييم PitchAPI في آخر 5 مباريات للنادي، للاعبين المقيَّمين في 3 منها على الأقل. عدد قليل من المباريات عينة صغيرة.')}</p></div>`;
  root.innerHTML=sel+head+`<div class="mc-g">`+next+results+elo+plc+`</div>`;
  const s=root.querySelector('#mcs');if(s)s.addEventListener('change',()=>{const o=getSaved();o[D.id]=s.value;setSaved(o);S.club=s.value;draw(root,s.value,files,teams)});
 }
 R.myclub=async function(el){
  el.innerHTML='<h2>My club</h2><div id="mcroot" class="ins mc"><div class="empty skel">Loading your club…</div></div>';
  const root=el.querySelector('#mcroot'),lg=D&&D.id,tok=++S.tok;
  const teams=[...new Set((D.matches||[]).flatMap(m=>[m.home,m.away]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const fav=typeof favOf==='function'?favOf():null;
  const club=pickClub(teams,getSaved(),fav);
  if(!club){root.innerHTML=`<div class="card"><p>${two('Pick your club in this league and this page becomes yours: its next match with the models\' chances, form, Elo, and the players in form. (Star a club on the Overview and it is picked for you.)','اختر ناديك في هذا الدوري وتصير الصفحة صفحتك: مباراته القادمة مع فرص النماذج، والأداء، وإيلو، واللاعبين في أفضل حالاتهم. (حط نجمة على نادي في الصفحة الرئيسية ويتم اختياره لك.)')}</p><label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="mcs"><option value="">—</option>${teams.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label></div>`;
   const s=root.querySelector('#mcs');if(s)s.addEventListener('change',()=>{if(!s.value)return;const o=getSaved();o[D.id]=s.value;setSaved(o);R.myclub(el)});return}
  const files=await leagueFiles();
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  draw(root,club,files,teams);
 };
 INS.ar({'My club':'ناديي'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
