/* ===== Overview for every league (#/overview), your teams, and the league's own page (#/round) =====
   - The overview is the site's, not a league's: its own colour (gold), the matches board of every league with your teams first,
     the weirdest facts of the week, and the weirdest facts of your teams.
   - A league's pages keep the league's colours (a club page its club's). The old option that showed every page in your team's
     colours is gone: with several teams in several leagues it hid the league colours (LaLiga's red, the Premier League's purple).
   - The league sections that were on the overview (discovery of the round, stars of the round, ...) are on the league page
     "This round" (#/round), the first page of the League section.
   - Your teams: as many as you like, from any league, kept on this device (plx_favs_v2; the one-team-per-league choice of
     plx_fav_v1 is carried over). A club is the same club in every competition it plays (by its name).
   - Facts: data/facts.json, written by the sync from PitchAPI data (see sync.py, "الحقائق"); each fact says how rare it is:
     k of N = how many times the same thing, or something more extreme, happened this season in the site's leagues. */
(function(){
 if(typeof R!=='object'||typeof R.overview!=='function')return;
 const OV_BASE='#e3a51a';
 /* ---------- your teams ---------- */
 const FK='plx_favs_v2';
 const save=t=>{try{localStorage.setItem(FK,JSON.stringify({v:2,t}))}catch(e){}};
 function load(){
  try{const o=JSON.parse(localStorage.getItem(FK)||'null');if(o&&Array.isArray(o.t))return o.t.filter(x=>x&&x.l&&x.t)}catch(e){}
  let old=null;try{old=JSON.parse(localStorage.getItem('plx_fav_v1')||'null')}catch(e){}
  const t=old&&old.fav&&typeof old.fav==='object'?Object.entries(old.fav).filter(([,n])=>n).map(([l,n])=>({l,t:String(n)})):[];
  if(t.length)save(t);   /* carried over once; nothing is stored until there is a team */
  return t;
 }
 window.favList=()=>load();
 window.favHas=name=>load().some(f=>f.t===name);
 window.favToggle=(l,name)=>{let t=load();t=t.some(f=>f.t===name)?t.filter(f=>f.t!==name):[...t,{l,t:name}];save(t);document.dispatchEvent(new CustomEvent('fav-change'));return t};
 /* the site's own "your team" functions, now for several teams */
 favOf=function(){if(!D)return null;const T=new Set(favTeams()),f=load().find(x=>T.has(x.t));return f?f.t:null};
 favThemeName=()=>null;
 favSet=function(name){if(name){if(!favHas(name))favToggle(D.id,name)}else{const f=favOf();if(f)favToggle(D.id,f)}route()};
 favCard=async function(){};
 favSkip=function(){};
 favColors=function(){};
 favCrest=async function(){};
 favMarks=function(){
  const app=document.getElementById('app');if(!app)return;
  app.querySelectorAll('.favrow').forEach(x=>x.classList.remove('favrow'));
  const T=new Set(load().map(f=>f.t));
  if(T.size){app.querySelectorAll('.ltr[data-t]').forEach(r=>{if(T.has(r.dataset.t))r.classList.add('favrow')});
   const hrefs=new Set([...T].map(t=>'#/club/'+encodeURIComponent(t)));
   app.querySelectorAll('tr,.fxr').forEach(r=>{if([...r.querySelectorAll('a')].some(a=>hrefs.has(a.getAttribute('href')))||[...r.children].some(c=>T.has(c.textContent.trim())))r.classList.add('favrow')})}
  /* the star on the club page: add or remove the club from your teams */
  const hd=app.querySelector('.clubhd .clubtx');
  if(hd){const name=decodeURIComponent(((location.hash||'').split('/')[2])||''),on=T.has(name);let b=hd.querySelector('.favstar');
   if(!b){b=document.createElement('button');b.type='button';hd.appendChild(b);b.onclick=()=>{favToggle(D.id,name);favMarks()}}
   b.className='s favstar'+(on?' on':'');b.setAttribute('aria-pressed',String(on));b.innerHTML=on?'★ <span>One of your teams</span>':'☆ <span>Add to your teams</span>'}
 };
 /* ---------- colours: the overview's own; a league page its league's ---------- */
 let OVP=null;
 function ovTheme(){
  if(typeof thPalette!=='function')return;if(!OVP)OVP=thPalette(OV_BASE,{});const t=OVP,r=document.documentElement,s=r.style;
  r.dataset.league='ov';delete r.dataset.club;
  const v={'--bg':t.bg,'--sf':t.sf,'--ln':t.ln,'--tx':t.tx,'--mu':t.mu,'--th':t.th,'--th-ink':t.ink,'--th-hi':t.hi,'--th-link':t.link,'--th-deep':t.deep,
   '--th-glow':thA(t.hi,.30),'--th-kpi':thA(t.hi,.22),'--th-soft':thA(t.hi,.12),'--th-bd':thA(t.hi,.40),'--th-amb':thA(t.hi,.16),'--th-amb2':thA(t.deep,.9)};
  for(const k in v)s.setProperty(k,v[k]);
 }
 /* the header shows the site's icon on the overview, the league's logo on a league page */
 if(typeof logoHeader==='function'){const lh=logoHeader;logoHeader=function(){if(uiPage()!=='overview')return lh.apply(this,arguments);
  const im=document.getElementById('lglogo');if(im){im.src='assets/icons/icon-192.png';im.alt='PL Analytics';im.hidden=false}}}
 const at=applyTheme;
 applyTheme=function(club){const out=at.apply(this,arguments);if(!club&&uiPage()==='overview')ovTheme();return out};
 /* ---------- pages: the league's own page, then the overview ---------- */
 const LEAGUE_HOME=R.overview;
 R.round=async function(el){const out=await LEAGUE_HOME.apply(this,arguments);const h=el.querySelector('h2');if(h)h.innerHTML=`<span>This round</span> <span class="mu">· ${esc(D.name)}</span>`;return out};
 if(typeof PAGES!=='undefined'&&!PAGES.some(p=>p[0]==='round')){const i=PAGES.findIndex(p=>p[0]==='table');PAGES.splice(i>=0?i:PAGES.length,0,['round','This round'])}
 if(typeof UI_SEC!=='undefined'){const s=UI_SEC.find(x=>x.k==='league');if(s&&!s.p.includes('round'))s.p.unshift('round')}
 const lgName=l=>{const x=(ALL.leagues||[]).find(z=>z.id===l);return x?x.name:l};
 const lgLogo=l=>{const d=typeof LOGO==='object'&&LOGO.d&&LOGO.d[l];return d&&d.league||null};
 R.overview=async function(el){
  el.innerHTML=`<h2>Overview</h2><p class="mu ov-lead"><span>Every league on the site: the matches by day with your teams first, and the strangest numbers of the week.</span></p>
   <div id="ovw" class="ovw"><div id="ovteams"></div><div id="ovmb"></div><div id="ovfx"></div><div id="ovft"></div></div>`;
  const w=el.querySelector('#ovw');
  teamsBar(w.querySelector('#ovteams'));
  if(typeof mbMount==='function')mbMount(w.querySelector('#ovmb'));
  const F=await fxLoad();if(!w.isConnected)return;
  week(w.querySelector('#ovfx'),F);teamFacts(w.querySelector('#ovft'),F);
  const re=()=>{if(!w.isConnected){document.removeEventListener('fav-change',re);return}
   teamsBar(w.querySelector('#ovteams'));teamFacts(w.querySelector('#ovft'),F);const mb=w.querySelector('#mb');if(mb)mb.dispatchEvent(new Event('mb-redraw'))};
  document.addEventListener('fav-change',re);
  /* a fact or a match of another league: open that league first (match pages read the open league) */
  w.addEventListener('click',async e=>{const a=e.target.closest('a[data-flid]');if(!a||!D||a.dataset.flid===D.id||typeof setLeague!=='function')return;
   e.preventDefault();const h=a.getAttribute('href');$('#app').innerHTML='<div class="empty">Loading league…</div>';
   try{await setLeague(a.dataset.flid);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head();if(location.hash===h)route();else location.hash=h}catch(err){route()}});
 };
 /* your teams: chips, and a way to add one from any league */
 async function teamsBar(box){
  const T=load();
  box.innerHTML=`<section class="hsec ovt"><div class="hhd"><h2>Your teams</h2>${T.length?`<span class="mu">${T.length}</span>`:''}</div>
   ${T.length?`<div class="ovt-l">${T.map(f=>`<span class="ovt-c"><span class="mb-star" aria-hidden="true">★</span><a href="#/club/${encodeURIComponent(f.t)}" data-flid="${esc(f.l)}">${esc(f.t)}</a><span class="mu rp-n">${esc(lgName(f.l))}</span><button type="button" class="ovt-x" data-x="${esc(f.t)}" data-l="${esc(f.l)}" aria-label="Remove ${esc(f.t)}">×</button></span>`).join('')}</div>`
    :'<p class="mu"><span>Add the teams you follow: their matches come first in the list below, and their strangest numbers get their own section.</span> <span>You can also use ☆ on a club\'s page.</span></p>'}
   <div class="ctl ovt-add"><select id="ovtl" aria-label="League">${(ALL.leagues||[]).map(l=>`<option value="${esc(l.id)}"${D&&l.id===D.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select><select id="ovtt" aria-label="Team"><option value="">Choose a team</option></select><button type="button" id="ovta">☆ <span>Add</span></button></div></section>`;
  const sl=box.querySelector('#ovtl'),st=box.querySelector('#ovtt');
  const fill=async()=>{const names=await teamsOf(sl.value);if(!box.isConnected)return;const have=new Set(load().map(f=>f.t));
   st.innerHTML='<option value="">Choose a team</option>'+names.filter(n=>!have.has(n)).map(n=>`<option>${esc(n)}</option>`).join('')};
  sl.onchange=fill;fill();
  box.querySelector('#ovta').onclick=()=>{if(st.value)favToggle(sl.value,st.value)};
  box.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>favToggle(b.dataset.l,b.dataset.x));
 }
 /* a league's teams: the open league's matches, else its fixtures and the schedule */
 async function teamsOf(l){
  const s=new Set();
  if(D&&l===D.id)D.matches.forEach(m=>{s.add(m.home);s.add(m.away)});
  try{const fx=typeof fixLoad==='function'?await fixLoad():null;((fx&&fx.leagues&&fx.leagues[l])||[]).forEach(f=>{s.add(f.h);s.add(f.a)})}catch(e){}
  return [...s].filter(Boolean).sort((a,b)=>a.localeCompare(b));
 }
 /* ---------- facts ---------- */
 let FXP=null;
 const fxLoad=()=>{if(!(typeof ALL==='object'&&ALL&&ALL.fx))return Promise.resolve(null);if(!FXP)FXP=fetch('data/facts.json?v='+encodeURIComponent(ALL.fx)).then(r=>r.ok?r.json():null).catch(()=>null);return FXP};
 const two=(en,ar,cls)=>`<span class="fx-en ${cls||''}" lang="en">${en}</span><span class="fx-ar ${cls||''}" lang="ar" dir="rtl">${ar}</span>`;
 const odds=f=>Math.max(1,Math.round(f.N/Math.max(1,f.n)));
 const card=(f,withLeague)=>`<li class="ovf-c"><div class="ovf-top">${withLeague?`${lgLogo(f.l)?`<img src="${esc(lgLogo(f.l))}" alt="" loading="lazy" onerror="this.remove()">`:''}<b class="rp-n">${esc(lgName(f.l))}</b>`:''}${f.d?`<span class="mu">${esc(f.d)}</span>`:''}<b class="ovf-b" title="${esc(f.n+' of '+f.N)}">1 in ${odds(f)}</b></div>
   <p class="ovf-t">${two(f.en,f.ar)}</p><p class="mu ovf-r">${two(esc(f.er).replace(/&lt;(\/?bdi[^&]*)&gt;/g,'<$1>'),f.arr)}</p>${f.m?`<a class="ovf-go" href="#/match/${encodeURIComponent(f.m)}" data-flid="${esc(f.l)}">Match centre →</a>`:''}</li>`;
 function week(box,F){
  if(!F){box.innerHTML='';return}
  box.innerHTML=`<section class="hsec ovf"><div class="hhd"><h2>Weirdest facts of the week</h2><span class="mu nw"><bdi dir="ltr">${esc(F.wk.fr)} – ${esc(F.wk.to)}</bdi> · <span>all the site's leagues</span></span></div>
   ${F.week.length?`<ol class="ovf-l">${F.week.map(f=>card(f,1)).join('')}</ol>`:'<div class="empty">Nothing rare enough this week: only what happened in 5% of cases or fewer is shown.</div>'}
   <p class="mu ov-note"><span>"1 in N": how often the same thing, or something more extreme, happened this season in all the site's leagues. Computed by the sync from PitchAPI's shots and results.</span></p></section>`;
 }
 function teamFacts(box,F){
  const T=load();if(!T.length||!F){box.innerHTML='';return}
  const names=new Set(T.map(f=>f.t)),keys=Object.keys(F.teams||{}).filter(k=>names.has(k.slice(k.indexOf('|')+1)));
  const by=new Map();keys.forEach(k=>{const n=k.slice(k.indexOf('|')+1);(by.get(n)||by.set(n,[]).get(n)).push(...F.teams[k])});
  box.innerHTML=`<section class="hsec ovf ovf-t2"><div class="hhd"><h2>Your teams' weirdest facts</h2><span class="mu"><span>this season</span></span></div>
   ${by.size?[...by].map(([n,L])=>{const S=L.slice().sort((a,b)=>a.p-b.p).slice(0,4);return `<div class="ovf-team"><h3><span class="mb-star" aria-hidden="true">★</span> <a href="#/club/${encodeURIComponent(n)}" data-flid="${esc(S[0].l)}">${esc(n)}</a></h3><ol class="ovf-l">${S.map(f=>card(f,1)).join('')}</ol></div>`}).join('')
    :'<div class="empty">Nothing rare enough for your teams yet: only what happened in 5% of cases or fewer is shown.</div>'}</section>`;
 }
 INS.ar({"This round":"الجولة","Overview":"نظرة عامة","Every league on the site: the matches by day with your teams first, and the strangest numbers of the week.":"كل دوريات الموقع: المباريات حسب اليوم وفرقك أولها، وأغرب أرقام الأسبوع.",
  "Your teams":"فرقك","Add the teams you follow: their matches come first in the list below, and their strangest numbers get their own section.":"أضف الفرق اللي تشجعها: مبارياتها تطلع أول القائمة تحت، وأغرب أرقامها لها قسم خاص.",
  "You can also use ☆ on a club's page.":"وتقدر تستخدم ☆ في صفحة النادي.","League":"الدوري","Team":"الفريق","Choose a team":"اختر فريق","Add":"إضافة",
  "Add to your teams":"أضفه لفرقك","One of your teams":"من فرقك","Weirdest facts of the week":"أغرب حقائق الأسبوع","all the site's leagues":"كل دوريات الموقع",
  "Your teams' weirdest facts":"أغرب حقائق فرقك","this season":"هذا الموسم","Match centre →":"مركز المباراة ←","# in #":"# من كل #",
  "Nothing rare enough this week: only what happened in #% of cases or fewer is shown.":"ما فيه شي نادر كفاية هالأسبوع: نعرض بس اللي صار في #% من الحالات أو أقل.",
  "Nothing rare enough for your teams yet: only what happened in #% of cases or fewer is shown.":"ما فيه شي نادر كفاية لفرقك للحين: نعرض بس اللي صار في #% من الحالات أو أقل.",
  "\"# in N\": how often the same thing, or something more extreme, happened this season in all the site's leagues. Computed by the sync from PitchAPI's shots and results.":"\"# من كل N\": كم مرة صار نفس الشي أو أغرب منه هذا الموسم في كل دوريات الموقع. محسوبة في المزامنة من تسديدات ونتائج PitchAPI.",
  "Loading league…":"نحمّل الدوري…"});
 /* this file can arrive after the site has drawn its first page (the data came first): draw it again with the overview, the
    league colours and your teams as above */
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
