/* Stat stability page (assets/stat-stability.js): every row, number, order, reading and note checked against data/stability.json
   (whose own computation is checked in t_stab.py against a second implementation), the group and "all players" choices, the league
   selector, Arabic, 390 px, leaving before the data arrives and a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('stability.json'),L=F.leagues.l_4WFCIZ;
const NAMES={gl:'Goals',npxg:'Non-penalty xG',xg:'xG',sh:'Shots',sot:'Shots on target',xag:'xAG',ast:'Assists',sca:'Shot-creating actions',gca:'Goal-creating actions',kp:'Key passes',tb:'Through balls',cr:'Crosses',xgc:'xG chain',xgb:'xG buildup',xt:'xT (expected threat)',vaep:'VAEP (value of actions)',ps:'Passes',pr:'Progressive passes',bx:'Passes into the box',ca:'Carries',pc:'Progressive carries',cb:'Carries into the box',tko:'Take-ons attempted',tkw:'Take-ons won',tk:'Tackles',ic:'Interceptions',bl:'Blocks',cl:'Clearances',duw:'Duels won',aer:'Aerial duels',aerw:'Aerial duels won'};
const GROUP={att:['gl','npxg','xg','sh','sot'],cre:['xag','ast','sca','gca','kp','tb','cr','xgc','xgb','xt','vaep'],mov:['ps','pr','bx','ca','pc','cb','tko','tkw'],def:['tk','ic','bl','cl','duw','aer','aerw']};
const band=r=>r>=.75?'repeats strongly':r>=.5?'repeats fairly':'mostly luck';
const f2=v=>v==null?'–':v.toFixed(2);
const order=(yk)=>Object.keys(NAMES).filter(k=>L.stats[k]&&L.stats[k][yk]!=null).sort((a,b)=>L.stats[b][yk]-L.stats[a][yk]||NAMES[a].localeCompare(NAMES[b]));
const rows=pg=>pg.evaluate(()=>[...document.querySelectorAll('.st-t tbody tr')].map(r=>({k:r.dataset.k,name:r.cells[0].innerText.trim(),y:r.cells[1].innerText.trim(),h:r.cells[2].innerText.trim(),n:r.cells[3].textContent.trim(),read:r.cells[4].innerText.trim(),w:r.cells[1].querySelector('i').style.cssText})));
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/stability'});await pg.waitForSelector('.st-t tbody tr',{timeout:60000});
 let R=await rows(pg),want=order('yoy');
 ok(JSON.stringify(R.map(r=>r.k))===JSON.stringify(want),'every stat of the file, most repeatable first ('+R.length+' rows: '+R.slice(0,3).map(r=>r.k).join(', ')+' … '+R.slice(-3).map(r=>r.k).join(', ')+')');
 ok(R.every(r=>r.name===NAMES[r.k]&&r.y===f2(L.stats[r.k].yoy)&&r.h===f2(L.stats[r.k].half)&&r.n===String(L.stats[r.k].n_yoy)),'name, year-to-year, within-a-season and pair count of every row are the file\'s numbers');
 ok(R.every(r=>r.read===band(L.stats[r.k].yoy)),'the reading follows the number: 0.75+ strongly, 0.5 to 0.75 fairly, under 0.5 mostly luck');
 ok(R.every(r=>r.w.replace(/\s+/g,'').includes('--w:'+Math.round(Math.max(0,L.stats[r.k].yoy)*100)+'%')),'bar length = the number');
 const intro=await pg.innerText('.lk-intro');
 const top=want.slice(0,3).map(k=>NAMES[k]+' '+f2(L.stats[k].yoy)).join(', '),low=want.slice(-3).reverse().map(k=>NAMES[k]+' '+f2(L.stats[k].yoy)).join(', ');
 ok(intro.includes('Most repeatable: '+top+'.')&&intro.includes('Mostly luck: '+low+'.'),'the summary names the three most and least repeatable: '+top+' | '+low);
 ok(intro.includes('over '+L.seasons.length+' Premier League seasons ('+L.seasons[0]+' to '+L.seasons[L.seasons.length-1]+')')&&intro.includes(F.min+'+ minutes'),'the intro says which seasons and the minutes (900+)');
 ok(!(await pg.$('#stl')),'one league in the file: no league selector');
 /* groups */
 for(const g of ['att','cre','mov','def']){await pg.selectOption('#stg',g);R=await rows(pg);const w=order('yoy').filter(k=>GROUP[g].includes(k));ok(JSON.stringify(R.map(r=>r.k))===JSON.stringify(w),'group '+g+': '+R.length+' stats, same order')}
 await pg.selectOption('#stg','all');
 /* all players: the raw numbers */
 await pg.selectOption('#stb','all');R=await rows(pg);want=order('yoy_all');
 ok(JSON.stringify(R.map(r=>r.k))===JSON.stringify(want)&&R.every(r=>r.y===f2(L.stats[r.k].yoy_all)&&r.h===f2(L.stats[r.k].half_all)),'"all players (raw)": the raw numbers and their order — always higher, because positions differ ('+f2(L.stats.sh.yoy_all)+' against '+f2(L.stats.sh.yoy)+' for shots)');
 ok(L.stats.sh.yoy_all>L.stats.sh.yoy&&L.stats.ast.yoy_all>L.stats.ast.yoy,'sanity: raw correlation is above the within-position one for shots and assists');
 /* the hub tabs: the page is in Players */
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/stability')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/stability'}),'the page is a tab of the Players hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving before the data arrives */
 {const c2=await b.newContext();await c2.route(/stability\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/stability');await p2.waitForSelector('#stroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#stroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 /* a failing file is not kept: a message, then the next visit loads again */
 {const c3=await b.newContext();let fail=true;await c3.route(/stability\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/stability');
  await p3.waitForSelector('#stroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#stroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/stability'});await p3.waitForSelector('.st-t',{timeout:60000});
  ok(/Could not load/.test(msg)&&!!(await p3.$('.st-t')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 /* a league the file does not have: the file's first league is shown */
 {const c4=await b.newContext();const p4=await c4.newPage(),e4=[];p4.on('pageerror',e=>e4.push(e.message));await c4.addInitScript(()=>{try{localStorage.setItem('league','l_0ErfuF')}catch(e){}});
  await p4.goto('http://127.0.0.1:8765/index.html#/stability');await p4.waitForSelector('.st-t tbody tr',{timeout:90000});
  ok(/Premier League/.test(await p4.innerText('.lk-intro'))&&!e4.length,'a league without two full past seasons (LaLiga): the Premier League\'s numbers are shown, saying which league');await c4.close()}
 /* phone and Arabic */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:'#/stability'});await pg.waitForSelector('.st-t tbody tr',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>{const t=document.querySelector('.st-t').getBoundingClientRect(),c=document.querySelector('.st-t').closest('.card').getBoundingClientRect();return t.left>=c.left-1&&t.right<=c.right+1}),lang+' phone: the table fits its card (the pair count and the reading are left out)');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));
   const n=await pg.evaluate(()=>[...document.querySelectorAll('.st-t tbody tr')].map(r=>r.cells[0].innerText.trim()));ok(n.slice(0,3).join('|')==='العرضيات|التمريرات|محاولات المراوغة','Arabic stat names: '+n.slice(0,3).join(' · '));
   ok(/ثبات الإحصائيات/.test(await pg.textContent('#app h2')),'Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/st_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
