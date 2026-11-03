/* ===== Club page: Overview and Matches tabs =====
   The club page (R.club, with the pieces other files add to it) stays as it was and becomes the "Overview" tab; a bar under the club's header (a `.seg` group, so it has the Liquid
   Glass) adds "Matches": two cards, as on a club page of a scores app.
   - Previous matches: every finished match of the club this season, oldest first, ending with the latest (the last 6 at first, "Show earlier results" adds 10 more): the date, the
     two names with their crests, the score in a pill coloured from the club's side (green win, grey draw, red defeat). The league's matches come from the open league's data; the
     club's European matches (Champions League) from that competition's file when the club plays in it this season, with the competition's name on the row.
   - Upcoming matches: the club's scheduled matches from data/fixtures.json in every competition the file lists, nearest first, with the kick-off in the viewer's time zone ("Today"
     for today); a match is dropped from here once it is in the results (same match id) or more than 2 hours past its kick-off without a result being in.
   Matches of the league open a match page (results) or the match preview (upcoming); other competitions are shown but not linked (their match pages are not in this league's data).
   Only what the data holds: a domestic cup is not in the data and is not listed. The tab is kept in the address (#/club/<name>/matches) without reloading the page.
   The crests of clubs from other leagues come from those leagues' logo files, loaded only when needed. */
(function(){
 if(typeof R!=='object'||typeof R.club!=='function'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const PAGE_P=6,PAGE_U=8,STEP=10,LIVE_MS=2*3600e3;
 const nameOf=a=>{try{return decodeURIComponent(String(a||''))}catch(e){return String(a||'')}};
 const loc=()=>ar()?'ar':'en-US';
 const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const dUTC=s=>new Date(s+'T12:00:00Z').toLocaleDateString(loc(),{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
 const EXTRA={};
 const crestOf=n=>(typeof logoOf==='function'&&logoOf(n))||EXTRA[n]||'';
 const crest=n=>{const u=crestOf(n);return u?`<img class="ctm-c" src="${esc(u)}" alt="" aria-hidden="true" loading="lazy">`:`<i class="ctm-c ctm-nc" aria-hidden="true"></i>`};
 const oc=R.club;
 R.club=async function(el,arg){
  const out=await oc.apply(this,arguments);
  const name=nameOf(arg),hd=el&&el.querySelector&&el.querySelector('.clubhd');
  if(!el||!el.isConnected||!hd||el.querySelector('#cttabs'))return out;
  setup(el,hd,name);return out;
 };
 function setup(el,hd,name){
  const wm=/\/(matches|table)\/?$/.exec(location.hash),want=wm?wm[1]:'overview';
  const bar=document.createElement('div');bar.id='cttabs';bar.className='seg ct-tabs';bar.setAttribute('role','group');bar.setAttribute('aria-label',ar()?'أقسام النادي':'Club sections');
  bar.innerHTML=[['overview','Overview','نظرة عامة'],['matches','Matches','المباريات'],['table','Table','الجدول']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${k===want}" class="${k===want?'on':''}">${two(e,a)}</button>`).join('');
  const ov=document.createElement('div');ov.id='ctov';const mt=document.createElement('div');mt.id='ctmt';mt.hidden=want!=='matches';ov.hidden=want!=='overview';const tb=document.createElement('div');tb.id='cttb';tb.hidden=want!=='table';
  /* the stadium's one-line note (assets/stadium3d.js) stays right under the header, above the tabs */
  const ctl=el.querySelector(':scope > .st3-ctl'),keep=n=>n===hd||n===bar||n===ov||n===mt||n===tb||n===ctl||(n.classList&&n.classList.contains('st3-ctl'));
  (ctl||hd).after(bar);bar.after(ov);ov.after(mt);mt.after(tb);
  [...el.children].forEach(n=>{if(!keep(n))ov.appendChild(n)});
  /* pieces that other files add to the club page after this point (they are awaited, but a late one must not end up outside the Overview) */
  const mo=new MutationObserver(ms=>{
   if(!bar.isConnected||!ov.isConnected){mo.disconnect();return}
   for(const m of ms)for(const n of m.addedNodes)if(n.parentNode===el&&!keep(n))ov.appendChild(n);
  });
  mo.observe(el,{childList:true});
  const pick=(k,hash)=>{
   bar.querySelectorAll('button').forEach(b=>{const on=b.dataset.k===k;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
   ov.hidden=k!=='overview';mt.hidden=k!=='matches';tb.hidden=k!=='table';
   if(k==='matches')build(mt,name);if(k==='table')buildTable(tb,name);
   if(hash!==false){try{history.replaceState(null,'','#/club/'+encodeURIComponent(name)+(k==='overview'?'':'/'+k))}catch(e){}}
  };
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>pick(b.dataset.k));
  if(want==='matches')build(mt,name);if(want==='table')buildTable(tb,name);
 }
 /* ---- the data ---- */
 async function gather(name){
  if(typeof euroLoad==='function')await euroLoad().catch(()=>null);
  const fx=await (typeof fixLoad==='function'?fixLoad().catch(()=>null):null),FXL=(fx&&fx.leagues)||{};
  const leagues=ALL.leagues||[],lname=id=>{const l=leagues.find(x=>x.id===id);return l?l.name:id};
  const past=[],up=[],ids=new Set();
  D.matches.forEach(m=>{if((m.home!==name&&m.away!==name)||!m.date)return;const g=wkSc(m.score);if(!g)return;past.push({id:m.match_id,d:String(m.date).slice(0,10),h:m.home,a:m.away,s:g,comp:'',link:'#/match/'+encodeURIComponent(m.match_id)})});
  /* the club's other competitions this season (Champions League etc.): results from that competition's file when this site has it */
  const comps=(typeof euroComps==='function'?euroComps():[]).filter(c=>(c.teams||[]).includes(name));
  const lids=new Set(comps.map(c=>c.id));Object.keys(FXL).forEach(id=>{if(id!==D.id&&FXL[id].some(x=>x.h===name||x.a===name))lids.add(id)});
  await Promise.all([...lids].map(async id=>{
   const l=leagues.find(x=>x.id===id);if(!l)return;
   if(l.file&&comps.some(c=>c.id===id)){try{const L=await loadJson(l.file,ALL.generated);(L.matches||[]).forEach(m=>{if((m.h!==name&&m.a!==name)||!m.d)return;const g=wkSc(m.s);if(g)past.push({id:m.i,d:String(m.d).slice(0,10),h:m.h,a:m.a,s:g,comp:l.name,link:''})})}catch(e){}}
   if(l.logo_file){try{const r=await fetch('data/'+l.logo_file+'?v='+encodeURIComponent(l.logo_v||''));const d=r.ok?await r.json():null;if(d&&d.teams)for(const n in d.teams)if(!EXTRA[n])EXTRA[n]=d.teams[n]}catch(e){}}
  }));
  past.forEach(p=>ids.add(p.id));
  const now=Date.now(),today=ymd(new Date());
  Object.keys(FXL).forEach(lid=>FXL[lid].forEach(x=>{
   if((x.h!==name&&x.a!==name)||ids.has(x.i))return;
   const t=x.k?Date.parse(x.k):NaN;
   if(isFinite(t)?t<now-LIVE_MS:String(x.d)<today)return;
   up.push({id:x.i,d:x.d,k:isFinite(t)?x.k:'',t:isFinite(t)?t:Date.parse(x.d+'T23:59:00Z'),h:x.h,a:x.a,comp:lid===D.id?'':lname(lid),link:lid===D.id?'#/preview/'+encodeURIComponent(x.i):''});
  }));
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  past.sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id));up.sort((a,b)=>a.t-b.t||cmp(a.id,b.id));
  return {past,up};
 }
 /* ---- the rows ---- */
 function row(x,name,kind){
  const tag=x.comp?`<span class="ctm-tag">${nm(x.comp)}</span>`:'';
  let date,mid,cls='';
  if(kind==='p'){
   const home=x.h===name,gf=home?x.s[0]:x.s[1],ga=home?x.s[1]:x.s[0];cls=gf>ga?'w':gf<ga?'l':'d';
   date=dUTC(x.d);mid=`<b class="ctm-s ${cls}">${nb(x.s[0]+' - '+x.s[1])}</b>`;
  }else{
   const dt=x.k?new Date(x.k):null;
   if(dt){const same=ymd(dt)===ymd(new Date());date=same?two('Today','اليوم'):dt.toLocaleDateString(loc(),{weekday:'short',month:'short',day:'numeric'});mid=`<b class="ctm-s t">${nb(dt.toLocaleTimeString(loc(),{hour:'numeric',minute:'2-digit'}))}</b>`}
   else{date=dUTC(x.d);mid=`<b class="ctm-s t">–</b>`}
  }
  const body=`<div class="ctm-d"><span class="ctm-dd">${date}</span>${tag}</div><div class="ctm-r"><span class="ctm-h">${nm(x.h)}</span>${crest(x.h)}${mid}${crest(x.a)}<span class="ctm-a">${nm(x.a)}</span></div>`;
  const att=`class="ctm-m ${kind}${cls?' '+cls:''}" data-id="${esc(x.id)}" data-d="${esc(kind==='p'?x.d:(x.k||x.d))}" data-h="${esc(x.h)}" data-a="${esc(x.a)}" data-comp="${esc(x.comp)}"${kind==='p'?` data-score="${x.s[0]}-${x.s[1]}" data-res="${cls}"`:''}`;
  return x.link?`<a ${att} href="${esc(x.link)}">${body}</a>`:`<div ${att}>${body}</div>`;
 }
 function render(mt,name){
  const {past,up}=mt._data,np=mt._np,nu=mt._nu,shownP=past.slice(Math.max(0,past.length-np)),shownU=up.slice(0,nu);
  mt.innerHTML=`<div class="card ctm" id="ctmp"><h3>${two('Previous matches','المباريات السابقة')}</h3>
    ${past.length>np?`<button type="button" class="s ctm-more" id="ctmE">${two('Show earlier results','أظهر نتائج أقدم')}</button>`:''}
    ${shownP.length?shownP.map(x=>row(x,name,'p')).join(''):`<div class="empty">${two('No finished matches in the data yet.','ما فيه مباريات منتهية في البيانات للحين.')}</div>`}</div>
   <div class="card ctm" id="ctmu"><h3>${two('Upcoming matches','المباريات القادمة')}</h3>
    ${shownU.length?shownU.map(x=>row(x,name,'u')).join(''):`<div class="empty">${two('No scheduled matches in the data (the season may be over).','ما فيه مباريات مجدولة في البيانات (يمكن الموسم انتهى).')}</div>`}
    ${up.length>nu?`<button type="button" class="s ctm-more" id="ctmM">${two('Show more','أظهر أكثر')}</button>`:''}
    ${shownU.some(x=>x.k)?`<p class="mu ins-note">${two('Kick-off times are in your time zone.','أوقات البداية بتوقيت جهازك.')}</p>`:''}</div>
   <p class="mu ins-note ctm-n">${two('Matches of the league and the Champions League where the data has them. A domestic cup is not in the data.','مباريات الدوري ودوري الأبطال حيث تتوفر في البيانات. كأس المحلي مو موجود في البيانات.')}</p>`;
  const e=mt.querySelector('#ctmE'),m=mt.querySelector('#ctmM');
  if(e)e.onclick=()=>{mt._np+=STEP;render(mt,name)};
  if(m)m.onclick=()=>{mt._nu+=STEP;render(mt,name)};
 }
 async function build(mt,name){
  if(mt._built)return;mt._built=true;
  mt.innerHTML=`<div class="card ctm"><div class="empty skel">${two('Loading…','نحمّل…')}</div></div>`;
  let data;try{data=await gather(name)}catch(e){data=null}
  if(!mt.isConnected)return;
  if(!data){mt._built=false;mt.innerHTML=`<div class="card ctm"><div class="empty">${two('The matches are not available right now.','المباريات مو متوفرة الحين.')}</div></div>`;return}
  mt._data=data;mt._np=PAGE_P;mt._nu=PAGE_U;render(mt,name);
 }

 /* ---- the league table, with this club's row marked ---- */
 function buildTable(tb,name){
  if(tb._built)return;tb._built=true;
  const fin=D.matches.filter(m=>wkSc(m.score)&&m.date);
  const note=`<p class="mu ins-note">${two('The league table from the finished matches in the data: points, then goal difference, then goals scored, then name. The full table, with its week-by-week replay, is on the League table page.','جدول الدوري من المباريات المنتهية في البيانات: النقاط، ثم فارق الأهداف، ثم الأهداف المسجّلة، ثم الاسم. الجدول الكامل مع إعادة الأسابيع في صفحة جدول الدوري.')} <a href="#/table">${two('Open the league table','افتح جدول الدوري')}</a></p>`;
  if(!fin.length){tb.innerHTML=`<div class="card ctt"><div class="empty">${two('No results in the data yet.','ما فيه نتائج في البيانات للحين.')}</div></div>`;return}
  if(typeof ltOk==='function'&&!ltOk(fin)){tb.innerHTML=`<div class="card ctt"><div class="empty">${two('This competition is a tournament (groups and knockout rounds), so it has no single league table.','هذي بطولة (مجموعات وأدوار إقصاء)، فما لها جدول واحد.')}</div></div>`;return}
  const T=ltTable(fin,new Map());
  const form=r=>r.form.slice(-5).map(x=>`<i class="ltf ${x}" title="${x==='W'?'Win':x==='D'?'Draw':'Loss'}"></i>`).join('');
  tb.innerHTML=`<div class="card ctt" id="cttt"><h3>${two('League table','جدول الدوري')} <span class="mu">${nm(D.name)}</span></h3><div class="ctt-w"><table class="lk-t ctt-t"><thead><tr><th class="n">#</th><th>${two('Club','النادي')}</th><th class="n">${two('P','لعب')}</th><th class="n">${two('W','ف')}</th><th class="n">${two('D','ت')}</th><th class="n">${two('L','خ')}</th><th class="n">${two('GD','فرق')}</th><th class="n">${two('Pts','نقاط')}</th><th>${two('Form','الشكل')}</th></tr></thead><tbody>${T.map((r,i)=>`<tr class="ctt-r${r.t===name?' me':''}" data-t="${esc(r.t)}" data-pos="${i+1}" data-pts="${r.pts}" data-p="${r.p}"><td class="n">${nb(i+1)}</td><td><a class="clk" href="#/club/${encodeURIComponent(r.t)}/table">${typeof clubDot==='function'?clubDot(r.t):''}<span>${nm(r.t)}</span></a></td><td class="n">${nb(r.p)}</td><td class="n">${nb(r.w)}</td><td class="n">${nb(r.d)}</td><td class="n">${nb(r.l)}</td><td class="n">${nb((r.f-r.a>0?'+':r.f-r.a<0?'−':'')+Math.abs(r.f-r.a))}</td><td class="n"><b>${nb(r.pts)}</b></td><td class="ctt-f">${form(r)}</td></tr>`).join('')}</tbody></table></div>${note}</div>`;
 }
 INS.clubMatches={gather};
 INS.ar({'Previous matches':'المباريات السابقة','Upcoming matches':'المباريات القادمة'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
