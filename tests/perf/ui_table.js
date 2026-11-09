/* League table, drawn in steps (R.table in sync.py): with the shots file and the crest file held back, the table of results is on screen at once (rows marked data-e, the
   xGD column showing "…"), its points and order equal a table worked out here from the league file; once the files arrive the rows become data-t, xGD has numbers and the
   crests are in; leaving while the files are still on their way leaves no error and draws nothing on the next page; a tournament still gets its group tables. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ',LF=J(LG+'.json');
const sc=s=>{const m=/^(\d+)-(\d+)$/.exec(s||'');return m?[+m[1],+m[2]]:null};
function table(){const t={};for(const m of LF.matches){const g=sc(m.s);if(!g||!m.d)continue;for(const [n,f,a] of [[m.h,g[0],g[1]],[m.a,g[1],g[0]]]){const r=t[n]||(t[n]={t:n,p:0,pts:0,f:0,a:0});r.p++;r.f+=f;r.a+=a;r.pts+=f>a?3:f===a?1:0}}
 return Object.values(t).sort((x,y)=>y.pts-x.pts||(y.f-y.a)-(x.f-x.a)||y.f-x.f||x.t.localeCompare(y.t))}
(async()=>{const b=await T.launch();const want=table();
 {const ctx=await b.newContext({viewport:{width:390,height:844}});let release;const gate=new Promise(r=>release=r);
  await ctx.route(/_sh\.json|logos_/,async r=>{await gate;r.continue()});await ctx.addInitScript(l=>{localStorage.setItem('league',l)},LG);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/table');
  await pg.waitForSelector('#lt .ltr[data-e]',{timeout:60000});
  const early=await pg.$$eval('#lt .ltr[data-e]',a=>a.map(x=>[x.dataset.e,x.children[2].innerText.trim(),x.querySelector('b').innerText.trim(),x.querySelector('.ltx:last-of-type, .ltx').parentNode.children[8].innerText.trim()]));
  ok(early.length===want.length&&early.every((r,i)=>r[0]===want[i].t&&+r[1]===want[i].p&&+r[2]===want[i].pts),'with the shots and crest files held back: the table of '+early.length+' clubs is drawn, in the order and with the points of the league file');
  ok(early.every(r=>r[3]==='…')&&await pg.$$eval('#lt .ltr[data-t]',a=>a.length)===0&&(await pg.getAttribute('#lt','data-full'))==='0','xGD shows "…" and no row is marked finished (data-t) yet');
  ok(await pg.$$eval('#lt .ltt a',a=>a.length)===want.length,'every club already links to its page');
  release();await pg.waitForSelector('#lt .ltr[data-t]',{timeout:60000});
  const fin=await pg.$$eval('#lt .ltr[data-t]',a=>a.map(x=>[x.dataset.t,x.children[8].innerText.trim(),!!x.querySelector('img.clogo, .cdot')]));
  ok(fin.length===want.length&&fin.every((r,i)=>r[0]===want[i].t)&&fin.some(r=>/^[+\-−]?\d+\.\d$/.test(r[1]))&&fin.every(r=>r[1]!=='…')&&(await pg.getAttribute('#lt','data-full'))==='1','once the files arrive: same order, xGD in numbers, rows marked finished');
  ok(fin.filter(r=>r[2]).length>=want.length-2&&await pg.$$eval('#lt .ltr[data-e]',a=>a.length)===0,'and the crests are in ('+fin.filter(r=>r[2]).length+' of '+want.length+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {const ctx=await b.newContext();await ctx.route(/_sh\.json|logos_/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});await ctx.addInitScript(l=>{localStorage.setItem('league',l)},LG);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('#lt .ltr[data-e]',{timeout:60000});
  await pg.evaluate(()=>{location.hash='#/settings'});await pg.waitForFunction(()=>!document.getElementById('lt'),null,{timeout:30000});await pg.waitForTimeout(3500);
  ok(!(await pg.$('#lt'))&&!errs.length,'leaving before the files arrive: nothing of the table is drawn on the next page, no error');await ctx.close()}
 {const ctx=await b.newContext();await ctx.route(/_sh\.json/,r=>r.fulfill({status:500,body:''}));await ctx.addInitScript(l=>{localStorage.setItem('league',l)},LG);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('#lt .ltr[data-t]',{timeout:60000});
  ok(await pg.$$eval('#lt .ltr[data-t]',a=>a.every(x=>x.children[8].innerText.trim()==='N/A'))&&!errs.length,'a failing shots file: the table is finished with xGD "N/A", no error');await ctx.close()}
 {const wc=T.IDX.leagues.find(l=>/world cup/i.test(l.name));if(wc){const ctx=await b.newContext();await ctx.addInitScript(l=>{localStorage.setItem('league',l)},wc.id);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('.ltgs .ltg, #ltroot .empty',{timeout:90000});
  ok(await pg.$$eval('.ltgs .ltg',a=>a.length)>=4&&!errs.length,'a tournament ('+wc.name+') still gets its group tables');await ctx.close()}}
 await T.done(b)})();
