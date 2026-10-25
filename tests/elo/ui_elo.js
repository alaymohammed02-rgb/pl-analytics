/* Club Elo (assets/club-elo.js): every row, number, order and sign against data/elo_own.json (whose own arithmetic is checked in t_elo.py against a
   second implementation), the three orders, the league selector, the test sentence and table, the hub tab, Arabic, 390 px, leaving early, a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('elo_own.json'),LG='l_4WFCIZ',L=F.leagues[LG],bt=F.backtest;
const sg=(v)=>v==null?'–':(v>=0?'+':'−')+Math.abs(v).toFixed(0);
const f3=v=>(+v).toFixed(3);
const mk=(lid)=>Object.entries(F.leagues[lid].teams).map(([t,x])=>({t,...x}));
const rows=pg=>pg.evaluate(()=>[...document.querySelectorAll('.el-t tbody tr')].map(r=>({t:r.dataset.t,r:r.querySelector('.el-r').textContent.trim(),d5:r.querySelector('.el-5').textContent.trim(),d10:r.querySelector('.el-10').textContent.trim(),sp:!!r.querySelector('svg.el-sp'),n:r.cells[6].textContent.trim()})));
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/elo'});await pg.waitForSelector('.el-t tbody tr',{timeout:90000});
 let R=await rows(pg),W=mk(LG).sort((a,c)=>c.r-a.r||a.t.localeCompare(c.t));
 ok(R.length===W.length&&R.every((r,i)=>r.t===W[i].t&&r.r===String(Math.round(W[i].r))),'Premier League: '+R.length+' clubs in rating order ('+R.slice(0,3).map(r=>r.t+' '+r.r).join(', ')+')');
 ok(R.every((r,i)=>r.d5===sg(W[i].d5)&&r.d10===sg(W[i].d10)&&r.n===String(W[i].n)&&r.sp===(W[i].h.length>=3)),'last 5, last 10, matches and the trend line of every row match the file');
 ok(R.every(r=>+r.r>1200&&+r.r<2100),'every rating is in a sane range (1200 to 2100)');
 ok((await pg.$$eval('.el-t tbody tr .el-5',a=>a.filter(x=>x.textContent.trim().startsWith('+')?x.classList.contains('lk-up'):x.classList.contains('lk-dn')).length))===R.length,'plus numbers are green, minus numbers red');
 await pg.selectOption('#els','d5');R=await rows(pg);W=mk(LG).sort((a,c)=>(c.d5==null)-(a.d5==null)||c.d5-a.d5||c.r-a.r);ok(R.every((r,i)=>r.t===W[i].t),'order: rising most over the last 5 ('+W[0].t+' '+sg(W[0].d5)+')');
 await pg.selectOption('#els','d5l');R=await rows(pg);W=mk(LG).sort((a,c)=>(a.d5==null)-(c.d5==null)||a.d5-c.d5||c.r-a.r);ok(R.every((r,i)=>r.t===W[i].t),'order: falling most over the last 5 ('+W[0].t+' '+sg(W[0].d5)+')');
 await pg.selectOption('#els','r');
 for(const lid of Object.keys(F.leagues)){await pg.selectOption('#ell',lid);R=await rows(pg);W=mk(lid).sort((a,c)=>c.r-a.r||a.t.localeCompare(c.t));ok(R.length===W.length&&R.every((r,i)=>r.t===W[i].t&&r.r===String(Math.round(W[i].r))),F.leagues[lid].name+': '+R.length+' clubs, top '+R[0].t+' '+R[0].r)}
 await pg.selectOption('#ell',LG);
 const intro=await pg.innerText('.lk-intro'),P=F.params;
 ok(intro.includes('home side gets '+P.H+' points')&&intro.includes('('+L.n+' matches)')&&intro.includes(L.seasons[0]+' to '+L.seasons[L.seasons.length-1])&&intro.includes('last match '+L.last),'the intro: the home advantage '+P.H+', '+L.n+' matches, seasons '+L.seasons[0]+' to '+L.seasons[L.seasons.length-1]+', last match '+L.last);
 ok(intro.includes('not ClubElo')&&/cannot be compared/.test(intro),'the intro says it is not ClubElo and that leagues cannot be compared');
 const pc=x=>Math.round(x*100);
 ok(intro.includes('on matches before '+bt.split)&&intro.includes('On the '+bt.n+' matches after it')&&intro.includes('Brier '+f3(bt.brier))&&intro.includes('against '+f3(bt.base))&&intro.includes('right '+pc(bt.acc)+'% of the time'),'the test sentence: '+bt.n+' matches, Brier '+f3(bt.brier)+' against '+f3(bt.base)+', '+pc(bt.acc)+'% right');
 const tb=await pg.evaluate(()=>[...document.querySelectorAll('.el-b tbody tr')].map(r=>[r.dataset.l,r.cells[1].textContent.trim(),r.cells[2].textContent.trim(),r.cells[3].textContent.trim()]));
 ok(JSON.stringify(tb)===JSON.stringify(Object.entries(bt.per_league).map(([i,v])=>[i,String(v.n),f3(v.brier),f3(v.base)])),'the test table: '+tb.length+' leagues, matches and Brier as in the file');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/elo')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/elo'}),'the page is a tab of the Teams hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/elo_own\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/elo');await p2.waitForSelector('#elroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#elroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/elo_own\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/elo');
  await p3.waitForSelector('#elroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#elroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/elo'});await p3.waitForSelector('.el-t',{timeout:60000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.el-t')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 {const {ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_0bfbkO',hash:'#/elo'});await pg.waitForSelector('.el-t tbody tr',{timeout:90000});ok(await pg.$eval('#ell',x=>x.value)===Object.keys(F.leagues)[0]&&!errs.length,'a league the file does not have (Champions League): the first league is shown');await ctx.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/elo'});await pg.waitForSelector('.el-t tbody tr',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.el-t,.el-b')].every(t=>{const a=t.getBoundingClientRect(),c=t.closest('.card').getBoundingClientRect();return a.left>=c.left-1&&a.right<=c.right+1})),lang+' phone: both tables fit their cards');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/تقييم Elo للأندية/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/el_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
