/* The overview for every league, your teams, league colours, "This round", and the weirdest facts */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));
const FX=J('facts.json'),FIX=J('fixtures.json');
const strip=s=>s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');
const dk=t=>new Date(t).toISOString().slice(0,10);
const SCHED=(()=>{const d={};for(const [lid,rows] of Object.entries(FIX.leagues))rows.forEach(f=>{const k=f.k?dk(Date.parse(f.k)):f.d;(d[k]=d[k]||[]).push([lid,f.i,f.k,f.h,f.a,null,null,'notstarted'])});return {t:'x',full:'x',L:{},C:{},d}})();
const V1={v:1,fav:{l_0ErfuF:'Real Madrid',l_4WFCIZ:'Chelsea'},skip:{},colors:true};   /* the user's case: two teams, "colours" on */
async function open(b,{vw=1280,lang='en',hash='#/overview',league='l_0ErfuF',fx=true,v1=V1,v2=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg,v1,v2])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l);
  if(v1)localStorage.setItem('plx_fav_v1',JSON.stringify(v1));if(v2)localStorage.setItem('plx_favs_v2',JSON.stringify(v2))}},[lang,league,v1,v2]);
 await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();j.sch=1;if(fx)j.fx=FX.h||'t';else delete j.fx;r.fulfill({json:j})});
 await ctx.route(/data\/schedule\.json/,r=>r.fulfill({json:SCHED}));await ctx.route(/data\/facts\.json/,r=>r.fulfill({json:FX}));
 const pg=await ctx.newPage(),errs=[],req=[];pg.on('request',r=>req.push(r.url()));pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs,req}}
const go=async(pg,h,sel)=>{await pg.evaluate(h=>location.hash=h,h);await pg.waitForSelector(sel,{timeout:30000,state:'attached'});await pg.waitForTimeout(600)};
const th=pg=>pg.evaluate(()=>({lg:document.documentElement.dataset.league,club:document.documentElement.dataset.club||'',th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),logo:(document.getElementById('lglogo')||{}).src||''}));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---- colours: the reported bug, and the overview's own ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/table'});await pg.waitForSelector('.ltr',{timeout:60000});await pg.waitForTimeout(800);
  const la=await th(pg);ok(la.lg==='laliga'&&la.th==='#ff4b44'&&!la.club,'LaLiga with Real Madrid as your team: LaLiga\'s red ('+la.th+'), not the club\'s colours');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.ltr.favrow')].map(r=>r.dataset.t).join())==='Real Madrid','your team still stands out in the table');
  await pg.selectOption('#lgpick','l_4WFCIZ');await pg.waitForSelector('.ltr',{timeout:30000});await pg.waitForTimeout(800);
  const pl=await th(pg);ok(pl.lg==='pl'&&pl.th==='#c414dc','Premier League with Chelsea as your team: its purple ('+pl.th+')');
  await pg.selectOption('#lgpick','l_0ALvwF');await pg.waitForTimeout(1500);ok((await th(pg)).lg==='seriea','Serie A: its blue');
  await go(pg,'#/overview','#mb .mb-days');const ov=await th(pg);ok(ov.lg==='ov'&&ov.th==='#e3a51a'&&/icon-192/.test(ov.logo),'the overview: its own gold and the site\'s icon in the header ('+ov.th+')');
  await go(pg,'#/table','.ltr');const back=await th(pg);ok(back.lg==='seriea'&&!/icon-192/.test(back.logo),'into a league again: the league\'s colour and logo');
  await go(pg,'#/club/'+encodeURIComponent('Inter'),'.clubhd');ok((await th(pg)).club==='Inter','a club page keeps its club\'s colours');
  ok(!(await pg.$('.favcol')),'no "show the site in my team\'s colours" option any more');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- the overview: your teams, the board, the facts ---- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForSelector('#ovfx .ovf-c',{timeout:20000}).catch(()=>{});await pg.waitForTimeout(500);
  const st=await pg.evaluate(()=>({v2:JSON.parse(localStorage.getItem('plx_favs_v2')),home:!!document.getElementById('home'),chips:[...document.querySelectorAll('.ovt-c a')].map(a=>a.textContent),h2:document.querySelector('#app h2').textContent}));
  ok(st.v2&&st.v2.t.map(x=>x.l+'|'+x.t).sort().join()==='l_0ErfuF|Real Madrid,l_4WFCIZ|Chelsea','your teams carried over from the one-team-per-league choice');
  ok(!st.home&&st.h2==='Overview'&&st.chips.join()==='Real Madrid,Chelsea','the overview: your teams, the board and the facts only (no league sections)');
  const wk=await pg.$$eval('#ovfx .ovf-c',L=>L.map(c=>({t:c.querySelector('.ovf-t .fx-en').textContent,b:c.querySelector('.ovf-b').textContent})));
  ok(wk.length===FX.week.length&&wk.every((c,i)=>c.t===strip(FX.week[i].en)&&c.b==='1 in '+Math.max(1,Math.round(FX.week[i].N/FX.week[i].n))),'weirdest facts of the week: '+wk.length+', as computed, rarest first ('+wk.map(c=>c.b).join(', ')+')');
  ok(new Set(FX.week.map(f=>f.l)).size>=2||FX.week.length<=3,'from several leagues ('+[...new Set(FX.week.map(f=>f.l))].join(', ')+')');
  const tf=await pg.$$eval('#ovft .ovf-team',L=>L.map(t=>({n:t.querySelector('h3 a').textContent,c:t.querySelectorAll('.ovf-c').length})));
  const exp=n=>Object.keys(FX.teams).filter(k=>k.endsWith('|'+n)).flatMap(k=>FX.teams[k]);
  ok(tf.map(t=>t.n).sort().join()==='Chelsea,Real Madrid'&&tf.every(t=>t.c===Math.min(4,exp(t.n).length)),'your teams\' facts: one block per team, up to 4 each, from every competition ('+tf.map(t=>t.n+' '+t.c).join(', ')+')');
  /* the board: your teams first on a day they play */
  const rm=Object.entries(FIX.leagues).flatMap(([l,L])=>L.map(f=>({...f,l}))).filter(f=>(f.h==='Real Madrid'||f.a==='Real Madrid')&&Date.parse(f.k)>Date.now()).sort((a,b)=>Date.parse(a.k)-Date.parse(b.k))[0];
  if(rm){const day=new Date(Date.parse(rm.k)).toLocaleDateString('sv-SE');await pg.evaluate(d=>{const x=document.querySelector(`#mb [data-d="${d}"]`);if(x)x.click()},day);await pg.waitForTimeout(300);
   const g=await pg.evaluate(()=>{const f=document.querySelector('#mb .mb-g.mb-fav');return f&&{first:document.querySelector('#mb .mb-g')===f,rows:[...f.querySelectorAll('.mb-r')].map(r=>r.textContent)}});
   ok(g&&g.first&&g.rows.some(t=>t.includes('Real Madrid'))&&await pg.$$eval('#mb .mb-g:not(.mb-fav) .mb-r.mine',a=>a.length)>=1,'the board: "Your teams" first on '+day+' ('+(g?g.rows[0].replace(/\s+/g,' ').trim():'none')+'), and the match stays in its league')}
  /* add and remove a team from any league */
  await pg.selectOption('#ovtl','l_0ALvwF');await pg.waitForFunction(()=>document.querySelectorAll('#ovtt option').length>2);const pick=await pg.$eval('#ovtt option:nth-child(2)',o=>o.value);
  await pg.selectOption('#ovtt',pick);await pg.click('#ovta');await pg.waitForTimeout(400);
  ok(await pg.evaluate(p=>[...document.querySelectorAll('.ovt-c a')].some(a=>a.textContent===p)&&JSON.parse(localStorage.getItem('plx_favs_v2')).t.some(x=>x.t===p&&x.l==='l_0ALvwF'),pick),'add a Serie A team from the overview ('+pick+'): kept on this device');
  const hasF=Object.keys(FX.teams).some(k=>k.endsWith('|'+pick));ok(!hasF||await pg.evaluate(p=>[...document.querySelectorAll('.ovf-team h3 a')].some(a=>a.textContent===p),pick),'its facts appear when it has any ('+hasF+')');
  await pg.click(`.ovt-x[data-x="${pick}"]`);await pg.waitForTimeout(300);ok(!(await pg.evaluate(p=>[...document.querySelectorAll('.ovt-c a')].some(a=>a.textContent===p),pick)),'and remove it');
  /* a fact of another league opens that league first */
  const f=FX.week.find(x=>x.l!=='l_0ErfuF');if(f){await pg.click(`#ovfx a.ovf-go[href="#/match/${f.m}"]`);await pg.waitForFunction(id=>D.id===id&&!!document.querySelector('#mc .mc-score'),f.l,{timeout:30000}).catch(()=>{});
   ok(await pg.evaluate(id=>D.id===id&&!!document.querySelector('#mc .mc-score'),f.l),'a fact from another league: that league opens, then its match centre')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- the club page star, several teams per league ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/club/Barcelona'});await pg.waitForSelector('.clubhd .favstar',{timeout:60000});
  ok(/Add to your teams/.test(await pg.textContent('.favstar')),'club page: "☆ Add to your teams"');await pg.click('.favstar');await pg.waitForTimeout(200);
  ok(/One of your teams/.test(await pg.textContent('.favstar'))&&await pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_favs_v2')).t.filter(x=>x.l==='l_0ErfuF').length)===2,'a second LaLiga team: both kept');
  await go(pg,'#/table','.ltr');ok(await pg.evaluate(()=>[...document.querySelectorAll('.ltr.favrow')].map(r=>r.dataset.t).sort().join())==='Barcelona,Real Madrid','both stand out in the table');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- "This round": the league's own sections ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/table',league:'l_4WFCIZ'});await pg.waitForSelector('.ltr',{timeout:60000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));ok(nav.indexOf('#/round')>=0&&nav.indexOf('#/round')<nav.indexOf('#/table'),'League section: "This round" first');
  await go(pg,'#/round','#home .hsec');await pg.waitForTimeout(1500);
  const r=await pg.evaluate(()=>({h2:document.querySelector('#app h2').textContent,secs:[...document.querySelectorAll('#home .hsec .hhd h2')].map(x=>x.textContent),mds:!!document.getElementById('mds'),mb:!!document.getElementById('mb'),lg:document.documentElement.dataset.league}));
  ok(/This round/.test(r.h2)&&r.secs.includes('Discovery of the round')&&r.mds&&!r.mb&&r.lg==='pl','"This round": the league\'s sections and its matchday strip, in its colours ('+r.secs.slice(0,4).join(' | ')+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- a slow connection: the page is drawn before assets/overview.js arrives ---- */
 {const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(v1=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','en');localStorage.setItem('plx_fav_v1',JSON.stringify(v1))}},V1);
  await ctx.route(u=>/assets\/overview\.js/.test(u.href),async r=>{await new Promise(z=>setTimeout(z,4000));r.continue()});
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+'#/table',{waitUntil:'commit'});
  await pg.waitForFunction(()=>typeof D==='object'&&D&&document.querySelector('.ltr'),null,{timeout:30000}).catch(()=>{});
  const early=await pg.evaluate(()=>({fl:typeof favList,th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim()}));
  ok(early.fl==='undefined'&&early.th==='#ff4b44','before the file arrives: LaLiga already in its red, not your team\'s colours ('+early.th+')');
  await pg.evaluate(()=>location.hash='#/overview');await pg.waitForSelector('#mb .mb-days',{timeout:30000}).catch(()=>{});
  ok(await pg.evaluate(()=>document.documentElement.dataset.league==='ov'&&!!document.querySelector('#mb')&&[...document.querySelectorAll('#nav a')].some(a=>a.getAttribute('href')==='#/round')||location.hash!=='#/overview'),'once it arrives, the page is drawn again: the overview, its colour, "This round" in the menu');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- no facts file announced: no request, no section ---- */
 {const {ctx,pg,errs,req}=await open(b,{fx:false,v1:null});await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForTimeout(800);
  ok(!req.some(u=>/facts\.json/.test(u))&&!(await pg.$('.ovf'))&&/Add the teams you follow/.test(await pg.textContent('#ovteams')),'before the sync has written the facts: no request, no empty section; with no team yet, an invitation to add one');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- phones, Arabic ---- */
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('svg,select,option,a,.fx-en,.rp-n,.mb-tm,.mb-lh b,bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI|FT)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('#ovfx .ovf-c',{timeout:60000});await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone overview: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#ovw');ok(!u.length,'Arabic: overview translated '+u.slice(0,4).join(' | '));
   ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.ovf-c .fx-ar')).display!=='none'&&getComputedStyle(document.querySelector('.ovf-c .fx-en')).display==='none'),'Arabic: the facts in Arabic')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
