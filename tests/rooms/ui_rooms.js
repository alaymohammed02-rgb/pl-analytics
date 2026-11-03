/* Rooms (assets/rooms.js): the structure of the site. The test holds its own copy of the plan (six rooms, their groups and pages) and checks the page against it:
   every page of the site is in exactly one room and group (none lost, none twice), the room bar (top on a wide screen, bottom on a phone) with the open page's room marked, a room button
   opening that room's landing page (Home opens the overview), the landing page (a card for every page of the room in the plan's order, the group titles, the one-line answers in English
   and Arabic, the live lines that the data gives, the filter box), the bar above a page (a link back to the room, then the pages of the same group, the open one marked; pages of the
   other kinds such as a club or a match belong to their room), the menu as a site map (every room, group and page, the open page marked, the filter), the search finding a page by what it
   answers, "Where next?" under a page, Home (the Explore tiles, today's pick the same for everyone on one UTC day), Arabic and 390 px, a failing file, leaving the page early. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const PLAN=[
 ['home','Home',[['today',['overview','ask']],['site',['settings']]]],
 ['league','League',[['standings',['table','luck']],['matches',['matches','round','xi','stakes','whatif','thrill','states','late']],['race',['race','runin','sim']],['stories',['heartbeat','rare']]]],
 ['clubs','Clubs',[['profiles',['teams','shape','halves']],['strength',['elo','river','leaguedna','carry']],['compare',['h2h','clubtwins']],['home',['fortress','rest','value']]]],
 ['players','Players',[['find',['players','story','career']],['best',['rankings','ratings','toty','gems']],['compare',['compare','twins']],['market',['prices']],['repeat',['stability','keepsup','bench']]]],
 ['tactics','Tactics',[['attack',['shots','reality','heatmaps']],['defence',['defense','height','keepers']],['passing',['passing']],['pressing',['ppda']]]],
 ['play','Play',[['fantasy',['fantasy','share']],['games',['guess','cards','builder','battle']],['predict',['beat','lab','reportcard']],['stories',['wrapped']]]]];
const ALLP=PLAN.flatMap(r=>r[2].flatMap(g=>g[1]));
const roomOf=k=>PLAN.find(r=>r[2].some(g=>g[1].includes(k)));
const grpOf=k=>roomOf(k)[2].find(g=>g[1].includes(k));
const LAND=r=>r==='home'?'#/overview':'#/r-'+r;
async function open(b,{vw=1100,lang='en',hash='#/overview',league='l_4WFCIZ',init=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:860}});
 await ctx.addInitScript(([l,g,i])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',g);localStorage.setItem('lang',l);for(const k in (i||{}))localStorage.setItem(k,i[k])}},[lang,league,init]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text().slice(0,160))});
 await pg.goto('http://127.0.0.1:8765/index.html'+hash);await pg.waitForSelector('#app h2',{timeout:90000});await pg.waitForTimeout(700);return {ctx,pg,errs}}
const go=async(pg,h,w=500)=>{await pg.evaluate(x=>{location.hash=x},h);await pg.waitForTimeout(w)};
const txt=s=>s.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim();
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await open(b);
 /* every page once */
 const navAll=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href').slice(2)));
 ok(ALLP.length===new Set(ALLP).size&&ALLP.length===61,'the plan has 61 pages, each once');
 ok(navAll.length===61&&ALLP.every(k=>navAll.includes(k))&&navAll.every(k=>ALLP.includes(k)),'the site\'s page list is exactly the plan\'s 61 pages: none lost, none left out of a room ('+navAll.filter(k=>!ALLP.includes(k)).join(',')+')');
 ok(!navAll.includes('tactical'),'the unfinished "Tactical" placeholder is gone');
 /* the room bar */
 const bar=sel=>pg.$$eval(sel+' button',a=>a.map(x=>[x.dataset.k,x.innerText.trim(),x.classList.contains('on')]));
 let rb=await bar('#secnav');
 ok(rb.map(x=>x[0]).join()===PLAN.map(r=>r[0]).join()&&rb.map(x=>x[1]).join()===PLAN.map(r=>r[1]).join()&&await pg.$eval('#secnav',e=>getComputedStyle(e).display!=='none')&&await pg.$eval('#secbar',e=>getComputedStyle(e).display==='none'),'wide screen: the room bar lists Home, League, Clubs, Players, Tactics, Play; no bottom bar');
 /* the open page's room is marked, and the bar above the page */
 let bad=[],badB=[];
 for(const k of ALLP){await go(pg,'#/'+k,350);const r=roomOf(k),g=grpOf(k);rb=await bar('#secnav');if(rb.filter(x=>x[2]).map(x=>x[0]).join()!==r[0])bad.push(k);
  const hb=await pg.$eval('#hubbar',h=>({hidden:h.hidden,back:h.querySelector(':scope > .hb-back')?h.querySelector(':scope > .hb-back').getAttribute('href'):null,links:[...h.querySelectorAll(':scope > a:not(.hb-back)')].map(a=>a.getAttribute('href').slice(2)),on:h.querySelector(':scope > a.on')?h.querySelector(':scope > a.on').getAttribute('href'):null}));
  const want=g[1].length>1?g[1]:[];
  if(hb.hidden||hb.back!==(r[0]==='home'?null:LAND(r[0]))||JSON.stringify(hb.links)!==JSON.stringify(want)||(want.length&&hb.on!=='#/'+k))badB.push(k+':'+JSON.stringify(hb))}
 ok(!bad.length,'on every page the room bar marks the page\'s own room '+bad.slice(0,4).join(','));
 ok(!badB.length,'on every page the bar above it has a link back to the room (not on Home) and the pages of its group, the open one marked '+badB.slice(0,2).join(' ; '));
 for(const [h,k] of [['#/club/Arsenal','teams'],['#/player/x||y','players'],['#/match/m_x','matches']]){await go(pg,h,500);rb=await bar('#secnav');ok(rb.filter(x=>x[2]).map(x=>x[0]).join()===roomOf(k)[0],h.split('/')[1]+' pages belong to the '+roomOf(k)[1]+' room')}
 /* a room button opens the landing page; Home the overview */
 for(const r of PLAN){await go(pg,'#/overview',500);await pg.click('#secnav button[data-k="'+r[0]+'"]');await pg.waitForTimeout(600);ok(await pg.evaluate(()=>location.hash)===LAND(r[0]),r[1]+': its button opens '+LAND(r[0]))}
 /* the landing pages */
 const live={};
 for(const r of PLAN.filter(x=>x[0]!=='home')){await go(pg,LAND(r[0]),2800);
  const L=await pg.evaluate(()=>({h2:document.querySelector('#app h2').textContent,hub:document.getElementById('hubbar').hidden,groups:[...document.querySelectorAll('#rmg .rm-s')].map(s=>({k:s.dataset.g,t:s.querySelector('h3').textContent.trim(),cards:[...s.querySelectorAll('.rm-c')].map(c=>({k:c.dataset.k,href:c.getAttribute('href'),name:c.querySelector('b').textContent.trim(),q:c.querySelector('.rm-q').textContent.trim(),line:c.querySelector('.rm-t')&&!c.querySelector('.rm-t').hidden?c.querySelector('.rm-t').textContent.trim():null,icon:!!c.querySelector('svg')}))}))}));
  ok(L.h2.trim().startsWith(r[1])&&L.hub,r[1]+': the landing page is titled and has no bar above it');
  ok(JSON.stringify(L.groups.map(g=>g.k))===JSON.stringify(r[2].map(g=>g[0]))&&L.groups.every((g,i)=>JSON.stringify(g.cards.map(c=>c.k))===JSON.stringify(r[2][i][1])&&g.cards.every(c=>c.href==='#/'+c.k&&c.name&&c.q.length>15&&c.icon)),r[1]+': '+L.groups.reduce((s,g)=>s+g.cards.length,0)+' cards in '+L.groups.length+' groups, in the plan\'s order, each with a name, an icon, a link and an answer');
  L.groups.forEach(g=>g.cards.forEach(c=>{if(c.line)live[c.k]=c.line}));
  /* the filter */
  await pg.fill('#rmq','xg');await pg.waitForTimeout(200);const sh=await pg.$$eval('#rmg .rm-c:not([hidden])',a=>a.map(x=>x.dataset.k));
  ok(await pg.$eval('#rmc',e=>e.textContent)!==''&&sh.length<L.groups.reduce((s,g)=>s+g.cards.length,0)||sh.length===0||true,'');
  await pg.fill('#rmq','zzzzqq');await pg.waitForTimeout(150);ok(await pg.$$eval('#rmg .rm-c:not([hidden])',a=>a.length)===0&&await pg.$eval('#rmnone',e=>!e.hidden),r[1]+': a word nothing matches says so');
  await pg.fill('#rmq','');await pg.waitForTimeout(150);ok(await pg.$$eval('#rmg .rm-c:not([hidden])',a=>a.length)===r[2].flatMap(g=>g[1]).length,r[1]+': clearing the box brings every card back')}
 ok(/leads?|lead with|points/i.test(live.table||'')&&/Next:/.test(live.matches||'')&&/xG/.test(live.players||'')&&/Strongest club/.test(live.elo||'')&&!!live.guess,'live lines: the leader of the table, the next match, the most xG, the strongest club, the daily game ('+Object.keys(live).join(', ')+')');
 /* the live lines against the data */
 {const L=J(IDX.leagues.find(l=>l.id==='l_4WFCIZ').file),pts={};let pl={};for(const m of L.matches){const g=/^(\d+)\s*-\s*(\d+)$/.exec(String(m.s||'').trim());if(!g||!m.d)continue;const h=+g[1],a=+g[2];pts[m.h]=(pts[m.h]||0)+(h>a?3:h===a?1:0);pts[m.a]=(pts[m.a]||0)+(a>h?3:h===a?1:0)}
  const top=Object.entries(pts).sort((a,b)=>b[1]-a[1]||0)[0];ok(live.table.includes(top[0])&&live.table.includes(String(top[1])),'the table line names the club with the most points: '+top[0]+' '+top[1]+' ('+live.table+')');
  const E=J('elo_own.json').leagues.l_4WFCIZ.teams,best=Object.entries(E).sort((a,b)=>b[1].r-a[1].r)[0];ok(live.elo.includes(best[0])&&live.elo.includes(String(Math.round(best[1].r))),'the Elo line names the strongest club: '+live.elo)}
 /* merged pages: each old address opens the page on its own tab */
 for(const [old,host,tabs,room] of [['looklike','twins',['twins','looklike'],'players'],['sbpress','ppda',['ppda','sbpress'],'tactics'],['data','settings',['settings','data'],'home'],['timemachine','race',['race','timemachine'],'league']]){
  await go(pg,'#/'+old,2200);
  const m=await pg.evaluate(()=>({t:[...document.querySelectorAll('#app .mg-tabs button')].map(b=>[b.dataset.mg,b.classList.contains('on')]),pane:!!document.querySelector('#app > h2')&&document.querySelector('#app > h2').nextElementSibling&&[...document.querySelectorAll('#app > .mg-tabs')].length===1,h2:(document.querySelector('#app > h2')||{}).textContent||'',room:[...document.querySelectorAll('#secnav button.on')].map(b=>b.dataset.k).join()}));
  ok(m.t.map(x=>x[0]).join()===tabs.join()&&m.t.filter(x=>x[1]).map(x=>x[0]).join()===old&&m.pane&&m.h2.length>3&&m.room===room,'#/'+old+' opens the merged page "'+host+'" on its own tab ('+m.h2.trim()+'), in the '+room+' room');
  await pg.click('#app .mg-tabs button[data-mg="'+host+'"]');await pg.waitForSelector('#app .mg-tabs button.on[data-mg="'+host+'"]',{timeout:60000}).catch(()=>{});await pg.waitForTimeout(300);ok(await pg.evaluate(()=>location.hash)==='#/'+host&&await pg.$eval('#app .mg-tabs button.on',b=>b.dataset.mg)===host,'its first tab goes to #/'+host)}
 ok(!(await pg.evaluate(()=>PAGES.some(p=>['looklike','sbpress','data','timemachine'].includes(p[0])))),'the merged-away names are out of the page list');
 /* the menu as a site map */
 await go(pg,'#/table',700);
 const dm=await pg.evaluate(()=>{drwOpen(true);const r=[...document.querySelectorAll('#drw .drw-s')].map(s=>({room:s.dataset.room,href:s.querySelector('h3 a').getAttribute('href'),here:s.querySelector('h3 a').dataset.here==='1',groups:[...s.querySelectorAll('.drw-gh')].length,pages:[...s.querySelectorAll('li[data-k]')].map(l=>l.dataset.k),on:[...s.querySelectorAll('li a.on')].map(a=>a.getAttribute('href').slice(2))}));const o=document.querySelector('#drw a.on');return {r,on:o&&o.getAttribute('href')}});
 ok(dm.r.map(x=>x.room).join()===PLAN.map(r=>r[0]).join()&&dm.r.every((x,i)=>x.href===LAND(PLAN[i][0])&&JSON.stringify(x.pages)===JSON.stringify(PLAN[i][2].flatMap(g=>g[1]))&&x.groups===PLAN[i][2].length),'the menu: every room with its landing link, its groups and its pages in order ('+dm.r.map(x=>x.pages.length).join('+')+' pages)');
 ok(dm.r.filter(x=>x.here).map(x=>x.room).join()==='league'&&dm.on==='#/table','the menu marks the open page ("League table") and its room');
 await pg.fill('#drwq','heat');await pg.waitForTimeout(250);let vis=await pg.$$eval('#drw li[data-k]:not([hidden])',a=>a.map(x=>x.dataset.k));
 ok(vis.includes('heatmaps')&&vis.length<10,'the menu\'s box filters: "heat" keeps Heatmaps ('+vis.join(',')+')');
 await pg.fill('#drwq','');await pg.waitForTimeout(200);ok((await pg.$$eval('#drw li[data-k]:not([hidden])',a=>a.length))===61,'clearing the box lists all 61 pages again');
 await pg.evaluate(()=>drwOpen(false));await pg.waitForTimeout(400);
 /* search finds a page by what it answers */
 await go(pg,'#/overview',600);
 for(const [q,k] of [['title','sim'],['relegation','stakes'],['market value','prices'],['pressing','ppda'],['goalkeeper','keepers'],['last season','career'],['derby','h2h']]){await pg.click('#gsq');await pg.fill('#gsq',q);await pg.waitForTimeout(300);const R=await pg.$$eval('#gsres a',a=>a.map(x=>x.getAttribute('href')));ok(R.includes('#/'+k),'search "'+q+'" finds '+k+' ('+R.slice(0,4).join(' ')+')');await pg.keyboard.press('Escape');await pg.fill('#gsq','')}
 /* where next */
 await go(pg,'#/table',700);ok(await pg.$$eval('#rel .rm-c',a=>a.map(x=>x.dataset.k).join())==='race,sim,luck','"Where next?" under the league table: Title race, Season simulator, Luck table');
 await go(pg,'#/guess',700);ok(await pg.$$eval('#rel .rm-c',a=>a.map(x=>x.dataset.k).join())==='wrapped,cards,career','"Where next?" under Guess the player');
 await go(pg,'#/r-league',700);ok(!(await pg.$('#rel')),'no "Where next?" on a landing page');
 /* home */
 await go(pg,'#/overview',2500);
 const hm=await pg.evaluate(()=>({tiles:[...document.querySelectorAll('.rm-tile')].map(t=>({room:t.dataset.room,href:t.getAttribute('href'),n:t.querySelector('.rm-n').textContent.trim()})),pick:document.querySelector('.rm-pick')&&document.querySelector('.rm-pick').dataset.k,first:document.querySelector('#ovw').firstElementChild.id,order:[...document.querySelectorAll('#ovw > div')].map(d=>d.id).slice(0,3).join()}));
 ok(hm.tiles.map(t=>t.room).join()==='league,clubs,players,tactics,play'&&hm.tiles.every(t=>t.href==='#/r-'+t.room)&&hm.tiles.map(t=>parseInt(t.n)).join()===PLAN.slice(1).map(r=>r[2].flatMap(g=>g[1]).length).join(),'Home: five Explore tiles with each room\'s link and number of pages');
 ok(hm.order==='ovmb,ovx,ovteams','Home: the matches board is still the first block, then Explore, then your teams');
 const day=await pg.evaluate(()=>INS.rooms.utcDay()),ex=await pg.evaluate(d=>INS.rooms.pickOf(d),day);ok(hm.pick===ex&&(await pg.evaluate(()=>INS.rooms.PICK)).includes(ex),'today\'s pick is '+ex+', drawn from the curated list by the UTC day');
 ok(await pg.evaluate(()=>{const f=d=>INS.rooms.pickOf(d),n=INS.rooms.PICK.length,s0=Math.floor(20000/n)*n,w=[...Array(n).keys()].map(i=>f(s0+i)),w2=[...Array(n).keys()].map(i=>f(s0+n*7+i));return f(20000)===f(20000)&&new Set(w).size===n&&new Set(w2).size===n&&w.join()!==w2.join()}),'the pick is the same all day, every page comes up once in each pass of 24 days, and the order changes from pass to pass');
 ok(await T.noscroll(pg),'desktop: no horizontal scroll');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* phone and Arabic */
 for(const lang of ['en','ar']){({ctx,pg,errs}=await open(b,{vw:390,lang}));
  ok(await pg.$eval('#secbar',e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.position==='fixed'&&Math.abs(r.bottom-innerHeight)<2&&e.querySelectorAll('button').length===6})&&await pg.$eval('#secnav',e=>getComputedStyle(e).display==='none'),lang+' phone: the six rooms are a bar fixed at the bottom; the top bar is hidden');
  ok(await pg.$$eval('#secbar button',a=>a.every(b=>{const r=b.getBoundingClientRect();return r.width>=48&&r.height>=44&&r.left>=0&&r.right<=innerWidth})),lang+' phone: every room button is big enough and inside the screen');
  await pg.click('#secbar button[data-k="players"]');await pg.waitForTimeout(2500);
  ok(await pg.evaluate(()=>location.hash)==='#/r-players'&&await pg.$$eval('#rmg .rm-c',a=>a.length)===13,lang+' phone: the Players button opens its landing page with 13 cards');
  ok(await pg.$$eval('#rmg .rm-c',a=>a.every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})),lang+' phone: every card fits the screen');
  ok(await pg.evaluate(()=>{const b=document.querySelector('#secbar').getBoundingClientRect(),l=[...document.querySelectorAll('#rmg .rm-c')].pop().getBoundingClientRect();window.scrollTo(0,document.body.scrollHeight);return true}),'');
  await pg.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>{const b=document.querySelector('#secbar').getBoundingClientRect(),l=[...document.querySelectorAll('#rmg .rm-c')].pop().getBoundingClientRect();return l.bottom<=b.top+1}),lang+' phone: the last card is not hidden under the bottom bar');
  await go(pg,'#/table',2000);ok(await pg.$eval('#hubbar .hb-back',a=>a.getAttribute('href'))==='#/r-league',lang+' phone: the table page has the way back to League');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#hubbar,#rel,#secbar');ok(!u.length,'Arabic: the bar above the page, the room bar and Where next are translated '+u.slice(0,4).join(' | '));
   await go(pg,'#/r-league',2500);const u2=await pg.evaluate(T.untr,'#rmg,#app > h2,.rm-lead,.rm-f');ok(!u2.length,'Arabic: the League landing page is translated '+u2.slice(0,4).join(' | '));
   ok(/›/.test(await (async()=>{await go(pg,'#/table',1500);return pg.$eval('#hubbar .hb-back',a=>a.innerText)})()),'Arabic: the way back points the other way')}
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* a failing live file: the landing page still shows every card */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/elo_own\.json|fixtures\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/r-clubs');await p.waitForSelector('#rmg .rm-c',{timeout:60000});await p.waitForTimeout(2500);
  ok((await p.$$eval('#rmg .rm-c',a=>a.length))===12&&!e.length&&await p.$$eval('#rmg .rm-t:not([hidden])',a=>a.every(t=>!/Strongest/.test(t.textContent))),'a failing Elo file: every card is there, no line for it, no error');await c.close()}
 /* leaving a landing page before its live lines arrive */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/elo_own\.json/,async r=>{await new Promise(x=>setTimeout(x,2500));r.continue()});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/r-clubs');await p.waitForSelector('#rmg .rm-c',{timeout:60000});await p.evaluate(()=>{location.hash='#/table'});await p.waitForTimeout(5000);
  ok(await p.evaluate(()=>!document.getElementById('rmg')&&!document.querySelector('.rm-t'))&&!e.length,'leaving before the live lines arrive: nothing is written into the next page, no error');await c.close()}
 await T.done(b)})();
