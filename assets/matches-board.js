/* ===== Matches board (top of the Overview): every league's matches by day, like a scores app =====
   Data: data/schedule.json, written by the sync from PitchAPI's matches-by-day (one request a day, all leagues of the site):
   kick-off time, status and score, from 7 days back to 7 days ahead. Until the sync has written it, the board falls back to the
   upcoming fixtures (data/fixtures.json) and the open league's results.
   PitchAPI publishes a match only after it has ended (in this site's logs 10–40 minutes after the final whistle), so a match
   that has kicked off shows "Awaiting result" until then: there is no live score in the data.
   Days are the viewer's own local days. A league can be folded; the folded leagues are remembered on this device only. */
(function(){
 if(typeof homeMount!=='function')return;
 window.MB_ON=true;            /* replaces the one-league matchday strip */
 const lc=()=>document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
 const dayKey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const fold={get(){try{return new Set(JSON.parse(localStorage.getItem('mb_fold')||'[]'))}catch(e){return new Set()}},set(s){try{localStorage.setItem('mb_fold',JSON.stringify([...s]))}catch(e){}}};
 let SCH=null,DAY=null;
 const schLoad=()=>{if(!(typeof ALL==='object'&&ALL&&ALL.sch))return Promise.resolve(null);if(!SCH)SCH=fetch('data/schedule.json?h='+Math.floor(Date.now()/3e5)).then(r=>r.ok?r.json():null).catch(()=>null);return SCH};
 /* every match as {lid,id,t (ms or null),day,h,a,sh,sa,st} */
 async function rows(){
  const s=await schLoad(),out=new Map();
  if(s&&s.d)Object.entries(s.d).forEach(([d,L])=>L.forEach(r=>{const t=Date.parse(r[2]);out.set(r[1],{lid:r[0],id:r[1],t:isNaN(t)?null:t,day:isNaN(t)?d:dayKey(t),h:r[3],a:r[4],sh:r[5],sa:r[6],st:r[7]})}));
  else{const fx=typeof fixLoad==='function'?await fixLoad().catch(()=>null):null;
   Object.entries((fx&&fx.leagues)||{}).forEach(([lid,L])=>(L||[]).forEach(f=>{const t=Date.parse(f.k);out.set(String(f.i),{lid,id:String(f.i),t:isNaN(t)?null:t,day:isNaN(t)?f.d:dayKey(t),h:f.h,a:f.a,sh:null,sa:null,st:''})}));
   D.matches.forEach(m=>{const g=wkSc(m.score);if(!g||out.has(m.match_id))return;out.set(m.match_id,{lid:D.id,id:m.match_id,t:null,day:String(m.date).slice(0,10),h:m.home,a:m.away,sh:g[0],sa:g[1],st:'finished'})})}
  /* a result the league file already has wins (it is what the match pages show) */
  D.matches.forEach(m=>{const x=out.get(m.match_id),g=wkSc(m.score);if(x&&g&&x.sh==null){x.sh=g[0];x.sa=g[1];x.st=x.st||'finished'}});
  return {list:[...out.values()],s};
 }
 const state=x=>{const s=String(x.st||'').toLowerCase().replace(/[\s_-]/g,'');if(/postpon|cancel|abandon|suspend/.test(s))return 'off';
  if(x.sh!=null&&x.sa!=null)return 'ft';if(x.t&&x.t<=Date.now())return 'wait';return 'pre'};
 const crest=(s,lid,name)=>{const d=typeof LOGO==='object'&&LOGO.d[lid],u=(d&&d.teams&&d.teams[name])||(s&&s.C&&s.C[name]);return u?`<img class="mb-cr" src="${esc(u)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:'<span class="mb-cr mb-nd"></span>'};
 const lgName=(s,lid)=>{const l=(ALL.leagues||[]).find(x=>x.id===lid);return l?l.name:(s&&s.L&&s.L[lid]&&s.L[lid].n)||lid};
 const lgImg=(s,lid)=>{const d=typeof LOGO==='object'&&LOGO.d[lid];return (d&&d.league)||(s&&s.L&&s.L[lid]&&s.L[lid].img)||null};
 async function board(home){
  if(home.dataset.mb||home.querySelector('#mb'))return;home.dataset.mb='1';   /* set before the await: two overlapping calls draw one board */
  let R_,LV;try{[R_,LV]=await Promise.all([rows(),typeof liveLoad==='function'?liveLoad():null])}catch(e){delete home.dataset.mb;throw e}
  if(!document.body.contains(home))return;
  const today=dayKey(Date.now()),off=k=>dayKey(Date.now()+k*864e5);
  const days=[...new Set(R_.list.map(x=>x.day))].filter(d=>d>=off(-7)&&d<=off(7));
  [off(-1),today,off(1)].forEach(d=>{if(!days.includes(d))days.push(d)});days.sort();
  if(!DAY||!days.includes(DAY))DAY=today;
  const sec=document.createElement('section');sec.className='hsec mb';sec.id='mb';
  const lab=d=>d===today?'Today':d===off(-1)?'Yesterday':d===off(1)?'Tomorrow':new Date(d+'T12:00:00').toLocaleDateString(lc(),{weekday:'short',day:'numeric',month:'short'});
  /* data/live.json (written by the sync when PitchAPI has it): official lineups (XI badge) and the state of a match */
  const live=x=>{const e=LV&&LV.m&&LV.m[String(x.id)];return e?{e,s:typeof lvState==='function'?lvState(e):'pre',xi:e.lu?'<span class="md-xi" title="Official lineups are out">XI</span>':''}:{e:null,s:'pre',xi:''}};
  const draw=(scroll=true)=>{
   const F=fold.get(),L=R_.list.filter(x=>x.day===DAY),order=(ALL.leagues||[]).map(l=>l.id),by=new Map();
   L.sort((a,b)=>(a.t||0)-(b.t||0)||a.h.localeCompare(b.h)).forEach(x=>{(by.get(x.lid)||by.set(x.lid,[]).get(x.lid)).push(x)});
   const lids=[...by.keys()].sort((a,b)=>(order.indexOf(a)+1||99)-(order.indexOf(b)+1||99));
   const allF=lids.length&&lids.every(l=>F.has(l));
   sec.innerHTML=`<h2 class="mb-h">Matches</h2><div class="mb-days" role="tablist">${days.map(d=>`<button type="button" role="tab" aria-selected="${d===DAY}" class="${d===DAY?'on':''}" data-d="${d}">${esc(lab(d))}</button>`).join('')}</div>
    ${lids.length?lids.map(lid=>{const img=lgImg(R_.s,lid),f=F.has(lid);return `<div class="mb-g${f?' f':''}"><button type="button" class="mb-lh" data-l="${esc(lid)}" aria-expanded="${!f}">${img?`<img src="${esc(img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:'<span class="mb-cr mb-nd"></span>'}<b>${esc(lgName(R_.s,lid))}</b><span class="mb-n mu">${by.get(lid).length}</span><span class="mb-ch" aria-hidden="true"></span></button>
     <div class="mb-rows">${by.get(lid).map(x=>{const st=state(x),tm=x.t?new Date(x.t).toLocaleTimeString(lc(),{hour:'numeric',minute:'2-digit'}):'',L_=st==='ft'||st==='off'?{e:null,s:'',xi:''}:live(x),e=L_.e,mn=e&&typeof lvMinute==='function'?lvMinute(e):null;
      /* a missing score is shown as –, never as 0 */
      const mid=st==='ft'?`<b class="mb-sc">${x.sh} – ${x.sa}</b><span class="mb-s">FT</span>`:st==='off'?`<b class="mb-t">–</b><span class="mb-s">${esc(x.st)}</span>`
       :L_.s==='live'?`<b class="mb-sc">${e.sh??'–'} – ${e.sa??'–'}</b><span class="mb-s md-live">● <span>Live</span>${mn?' '+esc(mn):''}</span>${L_.xi}`
       :L_.s==='ft'&&e.sh!=null&&e.sa!=null?`<b class="mb-sc">${e.sh} – ${e.sa}</b><span class="mb-s">FT</span>${L_.xi}`
       :st==='wait'?`<b class="mb-t">${esc(tm)}</b><span class="mb-s mb-w">Awaiting result</span>${L_.xi}`:`<b class="mb-t">${esc(tm||'–')}</b>${L_.xi}`;
      return `<a class="mb-r" href="#/${st==='ft'?'match':'preview'}/${encodeURIComponent(x.id)}" data-lid="${esc(x.lid)}"><span class="mb-tm h">${esc(x.h)}</span>${crest(R_.s,x.lid,x.h)}<span class="mb-m">${mid}</span>${crest(R_.s,x.lid,x.a)}<span class="mb-tm a">${esc(x.a)}</span></a>`}).join('')}</div></div>`}).join('')
     :(()=>{const prev=days.filter(d=>d<DAY&&R_.list.some(x=>x.day===d)).pop(),next=days.find(d=>d>DAY&&R_.list.some(x=>x.day===d));
       return `<div class="empty mb-empty"><span>No matches in the site's leagues on this day.</span>${prev||next?`<span class="mb-jump">${prev?`<button type="button" class="s" data-d="${prev}">← <span>${esc(lab(prev))}</span></button>`:''}${next?`<button type="button" class="s" data-d="${next}"><span>${esc(lab(next))}</span> →</button>`:''}</span>`:''}</div>`})()}
    ${lids.length?`<div class="mb-all"><button type="button" class="s" data-all="${allF?'show':'hide'}">${allF?'Show all':'Hide all'} <span aria-hidden="true">${allF?'⌄':'⌃'}</span></button></div>`:''}
    <p class="mu mb-note"><span>Times in your time zone.</span> <span>PitchAPI publishes a result after the match has ended, so there are no live scores here.</span></p>`;
   const on=sec.querySelector('.mb-days .on');if(scroll&&on&&on.scrollIntoView)on.scrollIntoView({block:'nearest',inline:'center'});
  };
  sec.addEventListener('click',async e=>{
   const d=e.target.closest('[data-d]');if(d){DAY=d.dataset.d;draw();return}
   const l=e.target.closest('[data-l]');if(l){const F=fold.get();F.has(l.dataset.l)?F.delete(l.dataset.l):F.add(l.dataset.l);fold.set(F);draw();return}
   const a=e.target.closest('[data-all]');if(a){const F=fold.get(),ids=[...sec.querySelectorAll('[data-l]')].map(x=>x.dataset.l);ids.forEach(i=>a.dataset.all==='hide'?F.add(i):F.delete(i));fold.set(F);draw();return}
   const r=e.target.closest('a.mb-r');if(r&&r.dataset.lid&&typeof D==='object'&&r.dataset.lid!==D.id&&typeof setLeague==='function'){
    /* another league's match: open that league first, then the page (the match and preview pages read the open league) */
    e.preventDefault();const h=r.getAttribute('href');$('#app').innerHTML='<div class="empty">Loading league…</div>';
    try{await setLeague(r.dataset.lid);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head();if(location.hash===h)route();else location.hash=h}catch(err){route()}}
  });
  draw();
  home.insertBefore(sec,home.firstElementChild);
  /* once a minute, while a match of the site's leagues is within 3 hours of kick-off: re-read data/live.json (no request when the sync has not announced it) */
  if(typeof liveLoad==='function'&&ALL.live){const T=setInterval(async()=>{if(!document.body.contains(sec)){clearInterval(T);return}
   if(!R_.list.some(x=>x.t&&Math.abs(x.t-Date.now())<3*36e5&&x.sh==null))return;const l=await liveLoad();if(l&&document.body.contains(sec)){LV=l;draw(false)}},60000)}
 }
 const hm=homeMount;
 homeMount=async function(){const r=await hm.apply(this,arguments);const home=document.getElementById('home');if(home&&home.querySelector('.hsec'))board(home).catch(e=>console.warn('matches board',e));return r};
 (function late(k){const home=document.getElementById('home');if(!home||home.dataset.mb||home.querySelector('#mb'))return;if(!home.querySelector('.hsec')){if(k<40)setTimeout(()=>late(k+1),250);return}board(home).catch(e=>console.warn('matches board',e))})(0);
 if(typeof INS==='object')INS.ar({"Matches":"المباريات","Today":"اليوم","Yesterday":"أمس","Tomorrow":"بكرة","Awaiting result":"بانتظار النتيجة","No matches in the site's leagues on this day.":"ما فيه مباريات لدوريات الموقع في هذا اليوم.",
  "Show all":"إظهار الكل","Hide all":"إخفاء الكل","Times in your time zone.":"الأوقات بتوقيتك.","PitchAPI publishes a result after the match has ended, so there are no live scores here.":"PitchAPI ينشر النتيجة بعد ما تخلص المباراة، فما فيه نتائج مباشرة هنا.","Loading league…":"نحمّل الدوري…"});
})();
