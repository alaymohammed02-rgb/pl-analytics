/* ===== Navigation, search, glossary and your team =====
   1. Five sections above the menu (a bar at the bottom of the screen on phones); the menu shows the pages of the open section.
      The menu itself is unchanged (every link stays in #nav); links of other sections are only hidden.
   2. One search box for players, clubs, matches and pages of the selected league.
   3. ⓘ next to the first appearance of each statistical term on a page, with a one-line explanation.
   4. Your team (per league, kept in this browser under 'plx_fav_v1'): a card on the overview, its row highlighted in tables,
      a star on its club page and, if you choose, the site in its colours.
   Everything runs after the page is drawn (a DOM observer), so no page's own code changes. */
const UI_SEC=[
 {k:'home',n:'Home',p:['overview','data','settings'],ic:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'},
 {k:'league',n:'League',p:['table','matches','teams'],ic:'<path d="M4 5h16v3H4zM4 10.5h16v3H4zM4 16h16v3H4z"/>'},
 {k:'players',n:'Players',p:['players','compare','rankings','looklike'],ic:'<circle cx="12" cy="7.5" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>'},
 {k:'analysis',n:'Analysis',p:['tactical','shots','passing','ppda','defense','heatmaps'],ic:'<path d="M4 20V10h3v10zM10.5 20V4h3v16zM17 20v-7h3v7z"/>'},
 {k:'fpl',n:'Fantasy',p:['fantasy','lab'],ic:'<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>'}];
const UI_ALIAS={club:'teams',player:'players',match:'matches'};
const uiPage=()=>((location.hash||'#/overview').split('/')[1]||'overview');
const uiSecOf=pg=>{pg=UI_ALIAS[pg]||pg;return UI_SEC.find(s=>s.p.includes(pg))||UI_SEC[0]};
const uiKey=a=>(a.getAttribute('href')||'').split('/')[1]||'';
let UI_LAST={};try{UI_LAST=JSON.parse(sessionStorage.getItem('plx_sec_last')||'{}')||{}}catch(e){}
function uiGo(k){const s=UI_SEC.find(x=>x.k===k);if(!s)return;const last=UI_LAST[k],pg=last&&s.p.includes(last)?last:s.p[0];location.hash='#/'+pg}
function uiNav(){
 const nav=document.getElementById('nav');if(!nav||!PAGES)return;
 const known=new Set(UI_SEC.flatMap(s=>s.p)),pg=uiPage(),sec=uiSecOf(pg);
 /* a section's pages in its own order (the league table first), by CSS order: the links themselves stay where they are */
 nav.querySelectorAll('a').forEach(a=>{const k=uiKey(a),s=known.has(k)?uiSecOf(k):UI_SEC[0];a.dataset.s=s.k;a.style.order=String(Math.max(0,s.p.indexOf(k)))});
 nav.dataset.sec=sec.k;
 const sp=UI_ALIAS[pg]||pg;if(sec.p.includes(sp)){UI_LAST[sec.k]=sp;try{sessionStorage.setItem('plx_sec_last',JSON.stringify(UI_LAST))}catch(e){}}
 /* the same five buttons twice: above the menu on wide screens, and as a bar at the bottom of the screen on phones (outside the
    header, whose glass effect would otherwise hold a fixed bar inside it) */
 const btns=UI_SEC.map(s=>`<button type="button" data-k="${s.k}" onclick="uiGo('${s.k}')"><svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor">${s.ic}</g></svg><span>${s.n}</span></button>`).join('');
 if(!document.getElementById('secnav')){const b=document.createElement('nav');b.id='secnav';b.setAttribute('aria-label','Sections');b.innerHTML=btns;nav.parentNode.insertBefore(b,nav)}
 if(!document.getElementById('secbar')){const b=document.createElement('nav');b.id='secbar';b.setAttribute('aria-label','Sections');b.innerHTML=btns;document.body.appendChild(b)}
 document.querySelectorAll('#secnav button,#secbar button').forEach(b=>{const on=b.dataset.k===sec.k;b.classList.toggle('on',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 if(typeof lglKick==='function')lglKick();
}

/* ---------- search ---------- */
const UI_Q={i:-1,items:[]};
function uiSearchBox(){
 const top=document.querySelector('header .top');if(!top||document.getElementById('gsrch'))return;
 const w=document.createElement('div');w.id='gsrch';w.className='srch';
 w.innerHTML=`<button type="button" class="s srchbtn" aria-label="Search" onclick="uiSearchOpen()"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg></button>
  <svg class="srchic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>
  <input id="gsq" type="search" placeholder="Search players, clubs, matches" aria-label="Search players, clubs, matches" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="gsres">
  <div id="gsres" role="listbox" hidden></div>`;
 top.insertBefore(w,top.children[1]||null);
 const q=w.querySelector('#gsq');
 q.addEventListener('input',()=>uiSearch(q.value));q.addEventListener('focus',()=>{if(q.value)uiSearch(q.value)});
 q.addEventListener('keydown',e=>{const n=UI_Q.items.length;
  if(e.key==='ArrowDown'&&n){UI_Q.i=(UI_Q.i+1)%n;uiQMark();e.preventDefault()}
  else if(e.key==='ArrowUp'&&n){UI_Q.i=(UI_Q.i-1+n)%n;uiQMark();e.preventDefault()}
  else if(e.key==='Enter'&&n){uiQGo(UI_Q.items[Math.max(0,UI_Q.i)].h);e.preventDefault()}
  else if(e.key==='Escape'){uiQClose();q.blur()}});
 document.addEventListener('click',e=>{if(!w.contains(e.target))uiQClose()});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||'')){e.preventDefault();uiSearchOpen()}});
}
function uiSearchOpen(){document.querySelector('header').classList.add('sopen');const q=document.getElementById('gsq');if(q)q.focus()}
function uiQClose(){const r=document.getElementById('gsres'),q=document.getElementById('gsq');if(r)r.hidden=true;if(q)q.setAttribute('aria-expanded','false');UI_Q.i=-1;
 if(q&&!q.value)document.querySelector('header').classList.remove('sopen')}
function uiQGo(h){const q=document.getElementById('gsq');if(q){q.value='';q.blur()}uiQClose();document.querySelector('header').classList.remove('sopen');location.hash=h}
function uiQMark(){document.querySelectorAll('#gsres [role=option]').forEach((x,i)=>{x.classList.toggle('on',i===UI_Q.i);x.setAttribute('aria-selected',i===UI_Q.i?'true':'false');if(i===UI_Q.i)x.scrollIntoView({block:'nearest'})})}
/* letters of any script (Arabic too), without accents or Arabic diacritics, lower case */
const uiNz=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function uiSearch(raw){
 const r=document.getElementById('gsres'),q=document.getElementById('gsq'),t=uiNz(raw);UI_Q.i=-1;
 if(!r||!D||t.length<2){UI_Q.items=[];if(r)r.hidden=true;if(q)q.setAttribute('aria-expanded','false');return}
 /* every word you type must start a word of the name ("arsen" finds Arsenal, not Larsen) */
 const words=t.split(' ').filter(Boolean),hit=s=>{const n=' '+uiNz(s);return words.every(w=>n.includes(' '+w))},out=[];
 const lab=n=>(typeof ARL!=='undefined'&&ARL.on&&typeof arT==='function'&&arT(n))||n;
 PAGES.filter(([k,n])=>hit(n)||hit(lab(n))).slice(0,3).forEach(([k,n])=>out.push({g:'Pages',h:'#/'+k,t:esc(lab(n))}));
 const clubs=[...new Set(D.matches.flatMap(m=>[m.home,m.away]))].filter(hit).sort().slice(0,5);
 clubs.forEach(c=>out.push({g:'Clubs',h:'#/club/'+encodeURIComponent(c),t:`${clubDot(c)}${esc(c)}`}));
 agg().filter(p=>hit(p.player)).sort((a,b)=>(b.minutes||0)-(a.minutes||0)).slice(0,7).forEach(p=>out.push({g:'Players',h:'#/player/'+encodeURIComponent(p.key+'||'+p.club),t:`${esc(p.player)} <span class="mu">${esc(p.club)}${p.pos?' · '+esc(p.pos):''}</span>`}));
 if(words.length)D.matches.filter(m=>wkSc(m.score)&&hit(m.home+' '+m.away)).sort(byDate).slice(0,clubs.length?4:6).forEach(m=>out.push({g:'Matches',h:'#/match/'+encodeURIComponent(m.match_id),t:`${esc(m.home)} <b>${esc(m.score)}</b> ${esc(m.away)} <span class="mu nw">${esc(String(m.date).slice(0,10))}</span>`}));
 UI_Q.items=out;let g='';
 r.innerHTML=out.length?out.map((x,i)=>(x.g!==g?`<div class="qg">${(g=x.g)}</div>`:'')+`<a role="option" aria-selected="false" href="${x.h}" onclick="event.preventDefault();uiQGo('${x.h.replace(/'/g,'%27')}')">${x.t}</a>`).join(''):`<div class="qg">No results in ${esc(D.name)}</div>`;
 r.hidden=false;if(q)q.setAttribute('aria-expanded','true');
}

/* ---------- glossary ---------- */
const UI_GL={
 'xGD':['xG for minus xG against: whether a team creates better chances than it allows.','xG له ناقص xG عليه: هل الفريق يصنع فرصاً أفضل من اللي يسمح بها.'],
 'xGI':['Expected goal involvements: xG + xA.','المساهمة المتوقعة في الأهداف: xG + xA.'],
 'xGC':['Expected goals conceded: the xG of the shots a player\'s team allowed while he was on the pitch.','الأهداف المتوقعة المستقبَلة: xG التسديدات اللي سمح بها فريق اللاعب وهو في الملعب.'],
 'xG':['Expected goals: how likely each shot was to become a goal (0 to 1), from where and how it was taken. Added up, it measures the quality of the chances.','الأهداف المتوقعة: احتمال إن كل تسديدة تصير هدفاً (من 0 إلى 1)، حسب مكانها وطريقتها. مجموعها يقيس جودة الفرص.'],
 'xA':['Expected assists: the xG of the shots that a player\'s passes set up.','التمريرات الحاسمة المتوقعة: xG التسديدات اللي جات من تمريرات اللاعب.'],
 'xT':['Expected threat: how much a player\'s passes and carries move the ball to places where a goal is more likely soon.','التهديد المتوقع: كم تنقل تمريرات اللاعب ومراوغاته الكرة لأماكن يكون فيها الهدف أقرب.'],
 'PPDA':['Passes allowed per defensive action in the opponent\'s part of the pitch: the lower it is, the harder a team presses.','عدد التمريرات المسموحة لكل تدخل دفاعي في نصف ملعب الخصم: كل ما قلّ الرقم، كان الضغط أقوى.'],
 'Brier':['Brier score: the error of probability forecasts; 0 is perfect, and lower is better.','مقياس Brier: خطأ التوقعات بالاحتمالات؛ 0 مثالي، والأقل أفضل.'],
 'MAE':['Mean absolute error: the average distance between a prediction and what happened.','متوسط الخطأ المطلق: متوسط الفرق بين التوقع واللي صار فعلاً.'],
 'BPS':['Bonus Points System: the FPL score that decides who gets the 1 to 3 bonus points in each match.','نظام نقاط البونص: رقم الفانتازي اللي يحدد مين ياخذ من 1 إلى 3 نقاط بونص في كل مباراة.'],
 'ICT':['FPL\'s Influence, Creativity and Threat index.','مؤشر الفانتازي للتأثير والإبداع والخطورة (ICT).']};
const UI_GLRE=new RegExp('(^|[^A-Za-z])('+Object.keys(UI_GL).join('|')+')(?![A-Za-z])');
function uiGloss(){
 const app=document.getElementById('app');if(!app)return;const done=new Set([...app.querySelectorAll('.gli')].map(b=>b.dataset.t));
 app.querySelectorAll('th,.kpi>span,h3,.lth>span').forEach(el=>{
  if(el.querySelector('.gli')||el.closest('a,button,select,svg'))return;const m=UI_GLRE.exec(el.textContent);if(!m||done.has(m[2]))return;done.add(m[2]);
  const b=document.createElement('button');b.type='button';b.className='gli';b.dataset.t=m[2];b.textContent='ⓘ';b.setAttribute('aria-label',(document.documentElement.lang==='ar'?'ما معنى ':'What is ')+m[2]+'?');
  b.onclick=e=>{e.stopPropagation();uiGlPop(b)};el.appendChild(b)});
}
function uiGlPop(b){
 let p=document.getElementById('glpop');if(p&&p.dataset.t===b.dataset.t&&!p.hidden){p.hidden=true;return}
 if(!p){p=document.createElement('div');p.id='glpop';p.setAttribute('role','tooltip');document.body.appendChild(p);
  document.addEventListener('click',e=>{if(!e.target.closest('#glpop,.gli'))p.hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape')p.hidden=true});
  addEventListener('scroll',()=>{p.hidden=true},{passive:true})}
 const ar=document.documentElement.lang==='ar',d=UI_GL[b.dataset.t];p.dataset.t=b.dataset.t;p.dir=ar?'rtl':'ltr';
 p.innerHTML=`<b>${esc(b.dataset.t)}</b> ${esc(d[ar?1:0])}`;p.hidden=false;
 const r=b.getBoundingClientRect(),w=Math.min(300,innerWidth-24);p.style.width=w+'px';
 p.style.left=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2))+'px';p.style.top=(r.bottom+8)+'px';
}

/* ---------- your team ---------- */
const FAV_KEY='plx_fav_v1';
function favRead(){let o=null;try{o=JSON.parse(localStorage.getItem(FAV_KEY)||'null')}catch(e){}o=o&&typeof o==='object'?o:{};
 return {fav:o.fav&&typeof o.fav==='object'?o.fav:{},skip:o.skip&&typeof o.skip==='object'?o.skip:{},colors:o.colors!==false}}
function favWrite(o){try{localStorage.setItem(FAV_KEY,JSON.stringify({v:1,fav:o.fav,skip:o.skip,colors:o.colors}))}catch(e){}}
let FAV_T={d:null,t:[]};
const favTeams=()=>{if(!D)return [];if(FAV_T.d!==D)FAV_T={d:D,t:[...new Set(D.matches.flatMap(m=>[m.home,m.away]))].sort()};return FAV_T.t};
/* your team in the open league: the one you chose here, else a team you chose in another league that plays in this one */
function favOf(){if(!D)return null;const o=favRead(),T=new Set(favTeams());if(o.fav[D.id]&&T.has(o.fav[D.id]))return o.fav[D.id];return Object.values(o.fav).find(t=>T.has(t))||null}
function favThemeName(){const o=favRead();return o.colors?favOf():null}
function favSet(name){const o=favRead();if(name)o.fav[D.id]=name;else delete o.fav[D.id];delete o.skip[D.id];favWrite(o);applyTheme(uiPage()==='club'?decodeURIComponent(((location.hash||'').split('/')[2])||''):null);route()}
function favSkip(){const o=favRead();o.skip[D.id]=1;favWrite(o);const c=document.getElementById('favcard');if(c)c.remove()}
function favColors(on){const o=favRead();o.colors=!!on;favWrite(o);applyTheme(null)}
async function favCard(){
 const app=document.getElementById('app');if(!app||uiPage()!=='overview'||document.getElementById('favcard'))return;const h2=app.querySelector('h2');if(!h2)return;
 const o=favRead(),fv=favOf(),box=document.createElement('div');box.id='favcard';box.className='card favcard';(app.querySelector('#home .hhero-s')||h2).after(box);
 if(!fv){if(o.skip[D.id]){box.remove();return}
  box.innerHTML=`<b>Which team do you support?</b> <span class="mu">Its page comes first here, its row stands out in tables, and the site can take its colours.</span>
   <div class="ctl" style="margin-top:8px"><select id="favpick" aria-label="Your team"><option value="">Choose a team</option>${favTeams().map(t=>`<option>${esc(t)}</option>`).join('')}</select>
   <button onclick="favSet(document.getElementById('favpick').value)">Save</button><button class="s" onclick="favSkip()">Not now</button></div>`;return}
 await champReady().catch(()=>{});
 const fin=D.matches.filter(m=>wkSc(m.score)&&m.date),mine=fin.filter(m=>m.home===fv||m.away===fv).sort(byDate),tab=typeof ltOk==='function'&&ltOk(fin)?ltTable(fin,new Map()):null,pos=tab?tab.findIndex(r=>r.t===fv):-1;
 const form=mine.slice(0,5).reverse().map(m=>{const g=wkSc(m.score),h=m.home===fv,f=h?g[0]:g[1],a=h?g[1]:g[0],r=f>a?'W':f<a?'L':'D';return `<i class="ltf ${r}" title="${esc(m.home+' '+m.score+' '+m.away)}"></i>`}).join('');
 let nx='';try{await fixLoad();const L=((FIX.d&&FIX.d.leagues)||{})[D.id]||[],x=L.find(x=>Date.parse(x.k||x.d)>Date.now()&&(x.h===fv||x.a===fv));
  if(x)nx=`<div><span class="mu">Next match</span> <b><span>${esc(x.h)}</span> – <span>${esc(x.a)}</span></b> <span class="mu nw">${esc(String(x.k||x.d).slice(0,16).replace('T',' '))} UTC</span></div>`}catch(e){}
 const top=agg().filter(p=>p.club===fv&&p.xt!=null).sort((a,b)=>b.xt-a.xt)[0];
 box.innerHTML=`<div class="favhd">${clubLink(fv)}<span class="mu">· <span>Your team</span></span><button class="s favx" onclick="favSet('')">Change team</button></div>
  <div class="favgrid">${pos>=0?`<div><span class="mu">Position</span> <b>${pos+1}</b> <span class="mu">· ${tab[pos].pts} <span>pts</span></span></div>`:''}${form?`<div><span class="mu">Form</span> ${form}</div>`:''}${nx}
  ${top?`<div><span class="mu">Most threatening player (xT)</span> <a href="#/player/${encodeURIComponent(top.key+'||'+top.club)}">${esc(top.player)}</a> <b>${top.xt.toFixed(2)}</b></div>`:''}</div>
  <label class="mu favcol"><input type="checkbox" ${o.colors?'checked':''} onchange="favColors(this.checked)"> <span>Show the site in my team's colours</span></label>`;
}
function favMarks(){
 const fv=favOf(),app=document.getElementById('app');if(!app)return;
 app.querySelectorAll('.favrow').forEach(x=>x.classList.remove('favrow'));if(!fv)return;
 app.querySelectorAll('.ltr[data-t]').forEach(r=>{if(r.dataset.t===fv)r.classList.add('favrow')});
 const href='#/club/'+encodeURIComponent(fv);
 app.querySelectorAll('tr,.fxr').forEach(r=>{if([...r.querySelectorAll('a')].some(a=>a.getAttribute('href')===href)||[...r.children].some(c=>c.textContent.trim()===fv))r.classList.add('favrow')});
 /* the star on the club page */
 const hd=app.querySelector('.clubhd .clubtx');if(hd&&!hd.querySelector('.favstar')){const name=decodeURIComponent(((location.hash||'').split('/')[2])||''),on=name===fv;
  const b=document.createElement('button');b.type='button';b.className='s favstar'+(on?' on':'');b.innerHTML=on?'★ <span>My team</span>':'☆ <span>Make it my team</span>';b.onclick=()=>favSet(on?'':name);hd.appendChild(b)}
}
async function favCrest(){const fv=favThemeName();if(fv&&!THEME.clubs[fv.toLowerCase()]&&!crestOf(fv)&&typeof crestFor==='function'){await logoLoad();await crestFor(fv);if(uiPage()!=='club')applyTheme(null)}}

/* ---------- run after every drawing of the menu or the page ---------- */
let UI_T=null;
/* while a page loads, its "Loading…" box is drawn as a placeholder in the shape of a page */
function uiSkel(){const app=document.getElementById('app');if(!app)return;const e=app.firstElementChild;
 if(app.children.length===1&&e.classList.contains('empty')&&/^\s*(Loading|جار)/.test(e.textContent))e.classList.add('skel')}
function uiAfter(){uiSkel();clearTimeout(UI_T);UI_T=setTimeout(()=>{try{uiSearchBox();uiGloss();favMarks();favCard();favCrest()}catch(e){}},60)}
(function(){const nav=document.getElementById('nav'),app=document.getElementById('app');
 if(nav)new MutationObserver(()=>uiNav()).observe(nav,{childList:true});
 if(app)new MutationObserver(uiAfter).observe(app,{childList:true,subtree:true});
 addEventListener('hashchange',e=>{const p=document.getElementById('glpop');if(p)p.hidden=true;
  /* a new page starts at the top (moving to another page used to keep the old page's scroll position) */
  const o=String(e.oldURL||'').split('#')[1]||'',n=String(e.newURL||'').split('#')[1]||'';if(o!==n)scrollTo({top:0,left:0,behavior:'instant'})});})();
