/* Heatmaps: the Season average tab (assets/player-heat.js). The numbers are recomputed from the league's heat file by the test's own loops: for every club and every player of it, the matches
   he has a map for, his actions a match, the average position (the action-weighted centre in metres), the order (matches, then actions, then name), the link to his page, and the averaged cells
   (the cell values the map's hover titles carry add up to his actions a match); the ring sits at the average position and mirrors with "Flip left/right"; "At least n matches" keeps the players
   with n or more; every map is drawn (the smoothed image); the Match tab is still the page it was (controls, the match map) and opens first; the tab bar has the glass and the last tab is kept;
   a league without heat data and a failing heat file keep the page's own message (no tabs, no error); leaving the page before the data arrives; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const LG='l_4WFCIZ',LL='l_0ErfuF',WC='l_1XLtP0';
const lf=id=>IDX.leagues.find(l=>l.id===id);
function expect(id){
 const H=J(lf(id).heat_file),GL=H.grid.l,GW=H.grid.w,by=new Map();
 for(const r of H.rows){if(r.t!=='p'||!Array.isArray(r.h)||!r.k||!r.c)continue;const key=r.c+'|'+r.k;if(!by.has(key))by.set(key,{k:r.k,c:r.c,name:r.n,ms:new Set(),cells:new Map(),total:0});const g=by.get(key);g.ms.add(r.m);
  for(let i=0;i+2<r.h.length;i+=3){const x=r.h[i],y=r.h[i+1],n=r.h[i+2];if(x>=0&&x<GL&&y>=0&&y<GW&&n>0){g.cells.set(y*GL+x,(g.cells.get(y*GL+x)||0)+n);g.total+=n}}}
 const out=[];for(const g of by.values()){if(!(g.total>0))continue;let sx=0,sy=0;for(const [i,v] of g.cells){sx+=v*((i%GL)+.5)*105/GL;sy+=v*(Math.floor(i/GL)+.5)*68/GW}
  out.push({k:g.k,c:g.c,name:g.name,n:g.ms.size,total:g.total,per:g.total/g.ms.size,cx:sx/g.total,cy:sy/g.total})}
 out.sort((a,b)=>b.n-a.n||b.total-a.total||cmp(a.name,b.name)||cmp(a.k,b.k));return out}
const cards=pg=>pg.$$eval('#hsg .hs-c',a=>a.map(c=>({k:c.dataset.k,c:c.dataset.c,n:+c.dataset.n,act:c.dataset.act,cx:c.dataset.cx,cy:c.dataset.cy,href:c.getAttribute('href'),name:c.querySelector('.hs-nm').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),
 ring:(()=>{const e=c.querySelector('.hs-avgpos circle');return e?[+e.getAttribute('cx'),+e.getAttribute('cy')]:null})(),
 sum:[...c.querySelectorAll('svg rect title')].reduce((s,t)=>{const m=/: ([\d.]+)/.exec(t.textContent.replace(/[⁦-⁩‎‏]/g,''));return s+(m?+m[1]:0)},0),img:!!c.querySelector('image.heat-smooth')})));
function check(got,W,label,flip){
 ok(got.length===W.length&&got.length>0&&got.every((g,i)=>{const w=W[i];return g.k===w.k&&g.c===w.c&&g.n===w.n&&g.act===w.per.toFixed(1)&&Math.abs(+g.cx-w.cx)<=.051&&Math.abs(+g.cy-w.cy)<=.051&&g.href==='#/player/'+encodeURIComponent(w.k+'||'+w.c)&&g.name===w.name}),
  label+': '+got.length+' players match in order (matches, actions a match, average position, link)');
 ok(got.every((g,i)=>Math.abs(g.sum-W[i].per)<Math.max(.25,W[i].per*.01)),label+': the averaged cells of every map add up to his actions a match');
 ok(got.every((g,i)=>g.ring&&Math.abs(g.ring[0]-W[i].cx)<.01&&Math.abs(g.ring[1]-(flip?68-W[i].cy:W[i].cy))<.01),label+': the ring is at the average position ('+(flip?'flipped':'as stored')+')');
 ok(got.every(g=>g.img),label+': every map is drawn')}
const wait=pg=>pg.waitForSelector('#hsg[data-done="1"]',{timeout:90000});
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/heatmaps'});await pg.waitForSelector('#hstabs',{timeout:90000});await pg.waitForTimeout(500);
 ok(await pg.$$eval('#hstabs button',a=>a.map(x=>x.dataset.k+':'+x.getAttribute('aria-pressed')).join())==='match:true,season:false','the Match tab opens first');
 ok(await pg.evaluate(()=>/Heatmaps/.test(document.querySelector('#app h2').textContent)&&document.querySelector('#app').firstElementChild.tagName==='H2'&&document.querySelector('#hstabs').nextElementSibling.id==='hsM'&&!!document.querySelector('#hsM #hm')&&!!document.querySelector('#hsM #hout')&&document.querySelector('#hsS').hidden),'the title stays first and the old page (match choice, map) sits in the Match tab');
 ok(!!(await pg.$('#hstabs .lgx-g')),'the tab bar has the glass');
 await pg.click('#hstabs button[data-k="season"]');await wait(pg);
 ok(await pg.evaluate(()=>document.querySelector('#hsM').hidden&&!document.querySelector('#hsS').hidden&&localStorage.getItem('plx_hs')==='season'),'the Season average tab opens and is kept (plx_hs)');
 const E=expect(LG),clubs=[...new Set(E.map(p=>p.c))].sort(cmp);
 ok((await pg.$$eval('#hsc option',a=>a.map(o=>o.value))).join('|')===clubs.join('|'),'the club list is every club with player maps ('+clubs.length+')');
 for(const club of [clubs[0],clubs[7],clubs[clubs.length-1]]){await pg.selectOption('#hsc',club);await wait(pg);const W=E.filter(p=>p.c===club);check(await cards(pg),W,club,true);
  ok(+await pg.$eval('#hscount',e=>e.dataset.n)===W.length,club+': the count is '+W.length)}
 /* flip */
 const club=clubs[3];await pg.selectOption('#hsc',club);await wait(pg);await pg.uncheck('#hsf');await wait(pg);check(await cards(pg),E.filter(p=>p.c===club),club+' unflipped',false);await pg.check('#hsf');await wait(pg);
 /* at least n matches */
 for(const m of [3,5,10]){await pg.selectOption('#hsm',String(m));await wait(pg);const W=E.filter(p=>p.c===club&&p.n>=m);
  if(W.length)check(await cards(pg),W,club+' with '+m+'+ matches',true);else ok(/No player of this club/.test(await pg.innerText('#hsg'))&&!(await pg.$('.hs-c')),club+': '+m+'+ matches: no player, and the page says so')}
 await pg.selectOption('#hsm','1');await wait(pg);
 ok(await T.noscroll(pg),'desktop: no horizontal scroll');
 /* back to Match: the old page works; the tab is kept for the next visit */
 await pg.click('#hstabs button[data-k="match"]');await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>!document.querySelector('#hsM').hidden&&document.querySelector('#hsS').hidden&&document.querySelectorAll('#hout svg').length>0),'the Match tab still shows the match heat map');
 await pg.selectOption('#hv','b');await pg.waitForTimeout(500);ok(await pg.evaluate(()=>document.querySelectorAll('#hout svg').length===2),'the old "both teams" view still works');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* opens on the kept tab; another league */
 ({ctx,pg,errs}=await T.open(b,{vw:1100,league:LL,hash:'#/heatmaps',init:{plx_hs:'season'}}));await wait(pg);
 const EL=expect(LL),c0=await pg.$eval('#hsc',s=>s.value);check(await cards(pg),EL.filter(p=>p.c===c0),'LaLiga '+c0,true);ok(!errs.length,'LaLiga: no page errors');await ctx.close();
 /* a league without heat data keeps the page's own message */
 ({ctx,pg,errs}=await T.open(b,{vw:1100,league:WC,hash:'#/heatmaps'}));await pg.waitForTimeout(3000);
 ok(await pg.evaluate(()=>!document.getElementById('hstabs')&&/No heatmap data/.test(document.getElementById('app').innerText)),'World Cup (no heat file): no tabs, the page keeps its own message');ok(!errs.length,'World Cup: no page errors');await ctx.close();
 /* a failing heat file */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(l=>{localStorage.setItem('league',l);localStorage.setItem('lang','en')},LG);await c.route(/_heat\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/heatmaps');await p.waitForTimeout(4000);
  ok(await p.evaluate(()=>!document.getElementById('hstabs')&&/Could not load heatmap data/.test(document.getElementById('app').innerText))&&!e.length,'a failing heat file: the page says so, no tabs, no error');await c.close()}
 /* leaving before the data arrives */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(l=>{localStorage.setItem('league',l);localStorage.setItem('lang','en');localStorage.setItem('plx_hs','season')},LG);await c.route(/_heat\.json/,async r=>{await new Promise(x=>setTimeout(x,2500));r.continue()});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/heatmaps');await p.waitForTimeout(800);await p.evaluate(()=>{location.hash='#/table'});await p.waitForTimeout(5000);
  ok(await p.evaluate(()=>!document.getElementById('hsg')&&!!document.querySelector('.lt'))&&!e.length,'leaving the page before the heat file arrives: nothing is drawn on the other page, no error');await c.close()}
 /* Arabic and phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/heatmaps',init:{plx_hs:'season'}}));await wait(pg);
  const c0=await pg.$eval('#hsc',s=>s.value);check(await cards(pg),E.filter(p=>p.c===c0),lang+' phone '+c0,true);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('#hsg .hs-c',a=>a.every(r=>{const x=r.getBoundingClientRect();return x.left>=-1&&x.right<=innerWidth+1})),lang+' phone: every card fits the screen');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#hsS');ok(!u.length,'Arabic: the tab is translated '+u.slice(0,5).join(' | '));ok(/المباراة/.test(await pg.innerText('#hstabs'))&&/متوسط الموسم/.test(await pg.innerText('#hstabs')),'Arabic: the two tabs');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
