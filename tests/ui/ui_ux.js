const {chromium}=require('playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const U='http://127.0.0.1:8773/index.html';
const SEC={home:['overview','data','settings'],season:['table','sim','luck','rare'],matches:['matches','round','whatif','thrill','states','xi'],teams:['teams','tactical','halves','clubtwins','carry','leaguedna','elo'],players:['players','story','rankings','ratings','gems','stability','keepsup','prices','looklike'],compare:['compare','twins','cards','builder','battle'],attack:['shots','reality','passing','heatmaps'],defence:['defense','ppda','height','sbpress','keepers'],models:['lab','reportcard'],fpl:['fantasy','beat','share']};
const HUBN={home:'Home',season:'Season',matches:'Matches',teams:'Teams',players:'Players',compare:'Compare',attack:'Attack',defence:'Defence',models:'Models',fpl:'Fantasy'};
const SENT={flipy:'1',fpl_myxi_cur_v1:'{"keep":1}',gh_repo:'x/y'};
async function open(b,{vw=1280,lang='en',init=null,league='l_4WFCIZ'}={}){const ctx=await b.newContext({viewport:{width:vw,height:860}});
 await ctx.addInitScript(([a,S,init,lg])=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.clear();for(const k in S)localStorage.setItem(k,S[k]);localStorage.setItem('league',lg);localStorage.setItem('lang',a);if(init!=null)localStorage.setItem('plx_fav_v1',init)}},[lang,SENT,init,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.stack.split('\n').slice(0,3).join(' / ')));pg.on('response',r=>{if(r.status()===404&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(r.url()))errs.push('404 '+r.url())});pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/overview');await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(900);return {ctx,pg,errs}}
const go=async(pg,h,w=900)=>{await pg.evaluate(x=>location.hash=x,h);await pg.waitForTimeout(w)};
const vis=pg=>pg.$$eval('#nav a',a=>a.filter(x=>x.offsetParent).map(x=>x.getAttribute('href').slice(2)));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---- sections ---- */
 {const {ctx,pg,errs}=await open(b);
  const all=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href').slice(2)));ok(all.length===48&&Object.values(SEC).flat().every(k=>all.includes(k)),'all 48 menu links (XI Battle and Player story added; Club Elo added; Player prices added; XI Builder added; Goalkeepers added; Who keeps it up? added; Stat stability added; Pressing maps added; Comebacks & collapses, Likely line-ups, Thrill index, Club twins, Who carries the team, Model report card and League DNA added; Attack share, Very rare cases, Match What-If, Ratings, Halves, Hidden Gems, Reality Check, This round, Height, Season simulator, Luck table, Player twins, Player cards and Beat the model added) stay in the menu; each belongs to one of 10 hubs');
  /* the menu drawer: ten hubs, one link each, the open page's hub marked; the pages of the open hub are the tabs above the page */
  const drw=()=>pg.evaluate(()=>{drwOpen(true);const hubs=[...document.querySelectorAll('#drw .drw-s a')].map(a=>[a.dataset.hub,a.textContent.trim(),a.getAttribute('href').slice(2)]);const on=document.querySelector('#drw a.on');const r={hubs,on:on&&on.dataset.hub};drwOpen(false);return r});
  const tabs=()=>pg.evaluate(()=>{const h=document.getElementById('hubbar');return {hidden:!h||h.hidden,links:h?[...h.querySelectorAll('a')].map(a=>a.getAttribute('href').slice(2)):[],on:h&&h.querySelector('a.on')?h.querySelector('a.on').getAttribute('href').slice(2):null}});
  let bad=[],badT=[];for(const [s,ps] of Object.entries(SEC))for(const p of ps){await go(pg,'#/'+p,400);const d=await drw();const t=await tabs();
   if(d.on!==s||d.hubs.length!==10||JSON.stringify(d.hubs.map(x=>x[0]))!==JSON.stringify(Object.keys(SEC))||JSON.stringify(d.hubs.map(x=>x[1]))!==JSON.stringify(Object.values(HUBN)))bad.push(p+':'+d.on);
   if(ps.length>1?(t.hidden||JSON.stringify(t.links)!==JSON.stringify(ps)||t.on!==p):!t.hidden)badT.push(p+':'+JSON.stringify(t))}
  ok(!bad.length,'on every page, the menu lists the 10 hubs in order, one link each, and marks the open page\'s hub '+bad.slice(0,3).join(' ; '));
  ok(!badT.length,'on every page, the tabs above the page are its hub\'s pages in order with the open one marked (none for a hub of one page) '+badT.slice(0,2).join(' ; '));
  {await go(pg,'#/table',500);await go(pg,'#/luck',500);await go(pg,'#/overview',500);const d=await pg.evaluate(()=>{drwOpen(true);const a=document.querySelector('#drw a[data-hub="season"]').getAttribute('href');drwOpen(false);return a});ok(d==='#/luck','a hub link goes to the page last open in that hub ('+d+')')}
  for(const [h,k] of [['#/club/Arsenal','teams'],['#/player/x||y','players'],['#/match/m_x','matches']]){await go(pg,h,500);ok((await drw()).on===k,h.split('/')[1]+' pages are marked under '+k)}
  ok(await pg.evaluate(()=>['secnav','nav','secbar'].every(i=>{const e=document.getElementById(i);return !e||getComputedStyle(e).display==='none'})),'the old top section buttons, page links and bottom bar are hidden');
  await go(pg,'#/overview',600);await pg.click('#mnubtn');await pg.waitForTimeout(350);
  ok(await pg.evaluate(()=>!document.getElementById('drw').hidden&&document.documentElement.classList.contains('dr-open')&&document.getElementById('mnubtn').getAttribute('aria-expanded')==='true'&&document.activeElement.closest('#drw')!==null),'☰ opens the menu, focus moves into it');
  /* the menu closes once its Liquid Glass has reached the link (assets/liquid-glass.js), at most about a second later */
  await pg.click('#drw a[data-hub="attack"]');await pg.waitForFunction(()=>!document.documentElement.classList.contains('dr-open'),null,{timeout:2000}).catch(()=>{});await pg.waitForTimeout(250);
  ok(await pg.evaluate(()=>location.hash==='#/heatmaps'&&!document.documentElement.classList.contains('dr-open')),'a hub link opens the page last open in that hub (Heatmaps, visited last above) and closes the menu');
  await pg.click('#mnubtn');await pg.waitForTimeout(300);await pg.keyboard.press('Escape');await pg.waitForTimeout(350);
  ok(await pg.evaluate(()=>document.getElementById('drw').hidden&&document.activeElement===document.getElementById('mnubtn')),'Escape closes it and focus returns to ☰');
  await pg.click('#mnubtn');await pg.waitForTimeout(300);await pg.mouse.click(1200,500);await pg.waitForTimeout(350);ok(await pg.evaluate(()=>document.getElementById('drw').hidden),'a tap on the dimmed page closes it');
  await pg.click('header .brand');await pg.waitForTimeout(600);ok(await pg.evaluate(()=>location.hash)==='#/overview','the site name goes home: the matches overview');
  await go(pg,'#/players',1500);await pg.fill('#q','Haaland');await pg.waitForTimeout(1500);const pr=await pg.$$eval('#app table tr',a=>a.slice(1).map(t=>t.innerText));ok(pr.length>0&&pr.every(t=>/Haaland/.test(t)),'the Players page\'s own search still filters its table ('+pr.length+' rows)');
  ok(await pg.$eval('#secbar',e=>getComputedStyle(e).display==='none'),'wide screen: no bottom bar');
  /* ---- search ---- */
  await pg.click('#gsq');await pg.keyboard.type('arsen');await pg.waitForTimeout(300);let R=await pg.$$eval('#gsres a',a=>a.map(x=>[x.getAttribute('href'),x.textContent]));
  ok(R[0][0]==='#/club/Arsenal'&&!R.some(r=>/Larsen/.test(r[1]))&&R.filter(r=>r[0].startsWith('#/match/')).every(r=>/Arsenal/.test(r[1])),'"arsen": Arsenal first, its matches, and no player whose name merely contains it (Larsen)');
  await pg.fill('#gsq','haala');await pg.waitForTimeout(300);R=await pg.$$eval('#gsres a',a=>a.map(x=>[x.getAttribute('href'),x.textContent]));
  await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Enter');await pg.waitForTimeout(1500);
  ok(/^#\/player\//.test(R[0][0])&&/Haaland/.test(R[0][1])&&/Haaland/.test(await pg.$eval('#app h2',e=>e.textContent))&&await pg.$eval('#gsq',e=>e.value)==='','keyboard: ↓ and Enter open Haaland\'s page, and the box clears');
  const pair=await pg.evaluate(()=>{const m=D.matches.find(m=>wkSc(m.score));return [m.home,m.away]});await pg.click('#gsq');await pg.keyboard.type(pair.join(' ').toLowerCase());await pg.waitForTimeout(300);R=await pg.$$eval('#gsres a',a=>a.map(x=>x.textContent));
  ok(R.length>0&&R.every(t=>t.includes(pair[0])&&t.includes(pair[1])),'two clubs: the matches between '+pair.join(' and ')+' ('+R.length+')');
  await pg.keyboard.press('Escape');ok(await pg.$eval('#gsres',e=>e.hidden),'Escape closes the results');
  await pg.fill('#gsq','');await pg.keyboard.press('Escape');await pg.click('#app h2');await pg.keyboard.press('/');ok(await pg.evaluate(()=>document.activeElement.id)==='gsq','"/" puts the cursor in the search box');
  await pg.keyboard.type('shot');await pg.waitForTimeout(300);ok((await pg.$$eval('#gsres a',a=>a.map(x=>x.getAttribute('href')))).includes('#/shots'),'pages can be found too ("shot" → Shots)');
  await pg.keyboard.press('Escape');
  /* ---- glossary ---- */
  await go(pg,'#/players',1500);const G=await pg.$$eval('.gli',a=>a.map(x=>x.dataset.t));ok(G.length>0&&new Set(G).size===G.length,'ⓘ once per term on a page: '+G.join(', '));
  ok(await pg.$$eval('.gli',a=>a.every(x=>!x.parentElement.closest('a,button'))),'never inside a link or button');
  await pg.click('.gli[data-t="xT"]');ok(/Expected threat/.test(await pg.$eval('#glpop',e=>e.textContent))&&await pg.$eval('#glpop',e=>!e.hidden),'click: a one-line explanation of xT');
  await pg.keyboard.press('Escape');ok(await pg.$eval('#glpop',e=>e.hidden),'Escape closes it');
  /* ---- your teams (several, from any league; the league keeps its colours) ---- */
  await go(pg,'#/overview',1500);ok(/Add the teams you follow/.test(await pg.textContent('#ovteams')),'first visit: the overview invites you to add your teams');
  const th0=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim());
  await pg.selectOption('#ovtl','l_4WFCIZ');await pg.waitForFunction(()=>[...document.querySelectorAll('#ovtt option')].some(o=>o.value==='Liverpool'));await pg.selectOption('#ovtt','Liverpool');await pg.click('#ovta');await pg.waitForTimeout(600);
  const st=await pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_favs_v2')));
  ok(st.t.some(x=>x.l==='l_4WFCIZ'&&x.t==='Liverpool')&&await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim())===th0,'Liverpool added and kept; the colours do not change');
  await go(pg,'#/table',1500);ok(JSON.stringify(await pg.$$eval('.favrow',a=>a.map(x=>x.dataset.t)))==='["Liverpool"]'&&await pg.evaluate(()=>document.documentElement.dataset.league)==='pl','league table: Liverpool\'s row stands out, in the league\'s colours');
  await go(pg,'#/club/Liverpool',1800);ok(await pg.$eval('.favstar',e=>e.classList.contains('on')&&/One of your teams/.test(e.textContent)),'Liverpool\'s page: ★ One of your teams');
  await go(pg,'#/club/Arsenal',1800);ok(await pg.$eval('.favstar',e=>!e.classList.contains('on')&&/Add to your teams/.test(e.textContent)),'another club\'s page: ☆ Add to your teams');
  await pg.selectOption('#lgpick','l_0bfbkO');await pg.waitForFunction(()=>D.id==='l_0bfbkO');await go(pg,'#/table',300);await pg.waitForFunction(()=>document.querySelectorAll('#lt .ltr[data-t]').length>30&&document.querySelector('.favrow'),null,{timeout:20000}).catch(()=>{});
  const ucl=await pg.evaluate(()=>({rows:[...document.querySelectorAll('.favrow')].map(x=>x.dataset.t||x.tagName)}));ok(JSON.stringify(ucl.rows)==='["Liverpool"]','Champions League: your Premier League team is recognised there too '+JSON.stringify(ucl));
  await pg.selectOption('#lgpick','l_4WFCIZ');await pg.waitForFunction(()=>D.id==='l_4WFCIZ');await go(pg,'#/overview',1500);await pg.click('.ovt-x[data-x="Liverpool"]');await pg.waitForTimeout(600);
  ok(!(await pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_favs_v2')).t.length))&&/Add the teams you follow/.test(await pg.textContent('#ovteams')),'× removes it and the invitation comes back');
  const keys=await pg.evaluate(S=>Object.keys(S).filter(k=>localStorage.getItem(k)!==S[k]).map(k=>k+'='+localStorage.getItem(k)),SENT);ok(!keys.length,'other stored keys untouched (Lab, Fantasy XI, settings) '+keys.join(' ; ').slice(0,200));
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 /* ---- smoothness ---- */
 {const {ctx,pg,errs}=await open(b,{vw:390});
  await go(pg,'#/players',1800);const rows=await pg.$$eval('#out table tr',a=>a.length);ok(rows===201,'a 200-row table ends up complete, in order ('+(rows-1)+' rows)');
  const ord=await pg.$$eval('#out table tr',a=>a.slice(1).map(t=>+t.cells[0].textContent));ok(ord.every((x,i)=>x===i+1),'rows numbered 1…200 in order after progressive drawing');
  await pg.evaluate(()=>scrollTo(0,3000));await pg.waitForTimeout(200);await go(pg,'#/table',1200);ok(await pg.evaluate(()=>scrollY)===0,'opening another page starts at the top');
  await go(pg,'#/lab',1500);await pg.evaluate(()=>scrollTo(0,400));const y0=await pg.evaluate(()=>scrollY);await pg.evaluate(()=>labTab('hidden'));await pg.waitForTimeout(1200);
  ok(y0>0&&await pg.evaluate(()=>scrollY)>0,'switching a tab inside the Lab keeps your place');
  const sk=await pg.evaluate(()=>{const a=document.getElementById('app');a.innerHTML='<div class="empty">Loading…</div>';return new Promise(r=>setTimeout(()=>r(a.firstElementChild.classList.contains('skel')),50))});ok(sk,'"Loading…" is drawn as a page-shaped placeholder');
  const ska=await pg.evaluate(()=>{const a=document.getElementById('app');a.innerHTML='<div class="empty">جارٍ التحميل…</div>';return new Promise(r=>setTimeout(()=>r(a.firstElementChild.classList.contains('skel')),50))});ok(ska,'and its Arabic version too');
  ok(await pg.evaluate(()=>getComputedStyle(document.body).backgroundAttachment!=='fixed'&&getComputedStyle(document.body,'::before').position==='fixed'),'the page background is its own fixed layer (no repaint of the whole screen while scrolling)');
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 {const {ctx,pg,errs}=await open(b,{init:'{bad json'});await go(pg,'#/table',1200);ok(!errs.length&&!!(await pg.$('#lt')),'unreadable saved team: ignored safely');await ctx.close()}
 /* ---- phone, Arabic ---- */
 {const {ctx,pg,errs}=await open(b,{vw:390,lang:'ar',init:JSON.stringify({fav:{l_4WFCIZ:'Arsenal'}})});
  const ph=await pg.evaluate(()=>({bar:getComputedStyle(document.getElementById('secbar')).display,pad:parseFloat(getComputedStyle(document.body).paddingBottom),btn:document.getElementById('mnubtn').getBoundingClientRect().width>0}));
  ok(ph.bar==='none'&&ph.pad<30&&ph.btn,'phone: no bottom bar (and no space kept for it), the ☰ button instead');
  await pg.click('#mnubtn');await pg.waitForTimeout(400);const side=await pg.evaluate(()=>{const r=document.getElementById('drw').getBoundingClientRect();return {r:Math.round(r.right),w:innerWidth,l:Math.round(r.left),labels:[...document.querySelectorAll('#drw .drw-s a')].map(s=>s.textContent.trim())}});
  ok(side.r===side.w&&side.l>0,'in Arabic the menu opens from the right');ok(side.labels.join('|')==='الرئيسية|الموسم|المباريات|الفرق|اللاعبون|مقارنة|الهجوم|الدفاع|النماذج|الفانتازي','in Arabic: '+side.labels.join(' · '));
  await pg.keyboard.press('Escape');await pg.waitForTimeout(350);
  for(const h of ['#/overview','#/table','#/matches','#/players','#/fantasy','#/lab','#/club/Arsenal']){await go(pg,h,1500);const s=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);if(s>1)ok(false,'390px '+h+': horizontal scroll '+s)}
  ok(true,'390px Arabic: no horizontal scroll on overview, table, matches, players, fantasy, lab, club (the Shots page was already wider before this change)');
  await go(pg,'#/overview',1000);await pg.click('#mnubtn');await pg.waitForTimeout(400);await pg.click('#drw a[data-hub="players"]');await pg.waitForTimeout(1500);ok(await pg.evaluate(()=>location.hash)==='#/looklike'||await pg.evaluate(()=>location.hash)==='#/players','phone: a page from the menu opens');
  await pg.click('.srchbtn');await pg.keyboard.type('التسديدات');await pg.waitForTimeout(300);ok((await pg.$$eval('#gsres a',a=>a.map(x=>x.getAttribute('href')))).includes('#/shots'),'search: a page found by its Arabic name');
  await pg.keyboard.press('Escape');await go(pg,'#/players',1500);await pg.click('.gli[data-t="xT"]');ok(/التهديد المتوقع/.test(await pg.$eval('#glpop',e=>e.textContent)),'ⓘ explains in Arabic');
  await go(pg,'#/table',1500);ok(JSON.stringify(await pg.$$eval('.favrow',a=>a.map(x=>x.dataset.t)))==='["Arsenal"]','your team stands out on the phone too');
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
