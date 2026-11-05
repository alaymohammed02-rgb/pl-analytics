/* Age curves (assets/age-curves.js, #/age): the chart's dots and the table equal data/age_curves.json for every stat and position choice (ages with 8+ players are drawn, all ages are in
   the table, thin ones faded); the test table shows the file's gains and its readings (within noise / better / worse) recomputed here; the page prints no peak age; failing file;
   leaving early; the page in the Players room; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const A=J('age_curves.json');
const f2=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(2);
const read=(g,se)=>Math.abs(g/se)<1.96?'within noise':g>0?'better':'worse';
(async()=>{
 const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{hash:'#/age',league:'l_4WFCIZ'});
 await pg.waitForSelector('#agroot .ag-ch',{timeout:120000});
 for(const [stat,pos] of [['npxg','ALL'],['tkic','DF'],['kp','MF'],['sh','ALL'],['xag','DF']]){
  await pg.selectOption('#ags',stat);await pg.selectOption('#agp',pos);await pg.waitForTimeout(150);
  const c=A.curves[stat][pos],ages=Object.keys(c.age).map(Number).sort((a,b)=>a-b),big=ages.filter(a=>c.age[a][0]>=8),lo=big[0],hi=big[big.length-1];
  const drawn=await pg.$$eval('.ag-p',a=>a.map(x=>+x.dataset.age));
  ok(JSON.stringify(drawn)===JSON.stringify(ages.filter(a=>a>=lo&&a<=hi)),stat+' / '+pos+': the chart draws the ages '+lo+' to '+hi+' ('+drawn.length+' dots)');
  const rows=await pg.$$eval('.ag-t tbody tr',a=>a.map(r=>[+r.dataset.age,...[...r.querySelectorAll('td.n')].map(x=>x.innerText.trim()),r.className]));
  ok(JSON.stringify(rows.map(r=>r.slice(0,4)))===JSON.stringify(ages.map(a=>{const [n,m,se]=c.age[a];return [a,String(n),f2(m),se==null?'':'± '+(1.96*se).toFixed(2)]})),stat+' / '+pos+': the table has every age with its count, mean change and range as in the file');
  ok(rows.every(r=>(r[4]==='mu')===(c.age[r[0]][0]<8)),stat+' / '+pos+': ages with fewer than 8 players are faded');
 }
 const txt=await pg.innerText('#app');
 ok(!/peak age[: ]+\d|peaks? at \d|ذروة.*\d\d/i.test(txt.replace(/No peak age is read from them\./,'')),'the page names no peak age');
 const tt=await pg.$$eval('.ag-tt tbody tr',a=>a.map(r=>[r.dataset.k,...[...r.querySelectorAll('td.n')].map(x=>x.innerText.replace(/\s+/g,' ').trim())]));
 ok(tt.length===5&&tt.every(([k,n,a,bd])=>{const x=A.test[k];return n===String(x.n)&&a.startsWith(f2(x.gain))&&a.endsWith(read(x.gain,x.se))&&bd.startsWith(f2(x.gain_band))&&bd.endsWith(read(x.gain_band,x.se_band))}),'the test table shows the file\'s gains and readings for the five stats');
 ok((await pg.innerText('.ag-test')).includes(String(A.pairs)),'the test note names the '+A.pairs+' pairs');
 ok(/81%/.test(await pg.innerText('#app'))&&/900\+/.test(await pg.innerText('#app'))&&/drop out/.test(await pg.innerText('#app')),'the caveats say 81% matched, 900+ minutes, and players who drop out');
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='players'}),'the page is in the Players room');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c=await b.newContext();await c.route(/\/data\/age_curves\.json/,r=>r.fulfill({status:500,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/age');
  await p.waitForSelector('#agroot .empty:not(.skel)',{timeout:120000});ok(/not available/.test(await p.innerText('#agroot'))&&!e.length,'a failing file: a message, no error');await c.close()}
 {const c=await b.newContext();await c.route(/\/data\/age_curves\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));
  await p.goto('http://127.0.0.1:8765/index.html#/age');await p.waitForSelector('#agroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#agroot'))&&!!(await p.$('.lt'))&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:'#/age'}));await pg.waitForSelector('#agroot .ag-ch',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,svg,datalist,input')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/age_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
