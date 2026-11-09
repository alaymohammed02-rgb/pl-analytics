/* Prediction ledger (assets/ledger.js, #/ledger): a ledger made by sync.py's own step from the real data/ files (tests/ldg/fixture.py), with the first matches turned into
   finished ones (made-up results and closing odds, so the scoring can be checked) and the rest moved to the coming days. Checked against the test's own sums: the scoreboard
   (matches, Brier, most likely happened, the paired difference against Elo ± 1.96 SE and its reading), the bookmakers' table, every coming match's numbers, the finished
   list and "Show more", the league choice; the xG model numbers equal the site's own Intelligence Lab model (labMatchModel) run in the page; the empty placeholder, a
   failing file loaded again later, leaving before the file arrives, the page in the Play room, Arabic and a 390 px phone. */
const T=require('../nf/lib.js');const {ok,J}=T;const {execFileSync}=require('child_process');
const FX=J('fixtures.json').leagues,E=J('elo_own.json');
const LGS=['l_4WFCIZ','l_0ErfuF','l_1Isor4','l_3FJFUl','l_0ALvwF','l_4QexZg'];
/* "now" = six hours before a full round: the first coming fixture with 30 or more fixtures in its 8 days (a lone rearranged match in an international break has not) */
const KS=LGS.flatMap(l=>(FX[l]||[]).map(f=>f.k)).filter(k=>k>=E.leagues.l_4WFCIZ.last).sort();
const first=KS.find(k=>KS.filter(x=>x>=k&&Date.parse(x)-Date.parse(k)<8*864e5-6*36e5).length>=30)||KS[0];
const NOW=new Date(Date.parse(first)-6*36e5).toISOString().slice(0,19)+'Z';
const RAW=JSON.parse(execFileSync('python3',[__dirname+'/fixture.py',NOW],{maxBuffer:1<<26}).toString());
const ids=Object.keys(RAW.p).sort((a,b)=>RAW.p[a].k<RAW.p[b].k?-1:RAW.p[a].k>RAW.p[b].k?1:(a<b?-1:1));
const NF=Math.min(36,ids.length-12),real=Date.now(),L=JSON.parse(JSON.stringify(RAW));
/* finished: dates in the past, results 0/1/2 by a fixed pattern, closing odds on every third */
ids.forEach((id,i)=>{const v=L.p[id];
 if(i<NF){v.k=new Date(real-(NF-i)*36e5*20).toISOString().slice(0,19)+'Z';v.o=[0,2,1,0,0,2,1][i%7];v.s=['2-0','0-1','1-1','3-1','1-0','1-2','0-0'][i%7];if(i%3===0)v.mk=[0.45,0.27,0.28]}
 else v.k=new Date(real+(i-NF+1)*36e5*5).toISOString().slice(0,19)+'Z'});
const fin=ids.slice(0,NF).map(id=>Object.assign({id},L.p[id])),up=ids.slice(NF).map(id=>Object.assign({id},L.p[id]));
const brier=(p,o)=>p.reduce((s,x,i)=>s+(x-(i===o?1:0))**2,0),top=p=>p.indexOf(Math.max(...p));
function board(rows){const o={};for(const k of ['e','m2','xi','bl','b']){const r=rows.filter(x=>x[k]);if(!r.length){o[k]=null;continue}
  const bs=r.map(x=>brier(x[k],x.o)),b=bs.reduce((s,v)=>s+v,0)/r.length,acc=Math.round(r.filter(x=>top(x[k])===x.o).length/r.length*100);let d=null;
  if(k!=='e'){const ds=r.filter(x=>x.e).map(x=>brier(x[k],x.o)-brier(x.e,x.o)),m=ds.reduce((s,v)=>s+v,0)/ds.length,sd=Math.sqrt(ds.reduce((s,v)=>s+(v-m)**2,0)/(ds.length-1)),se=sd/Math.sqrt(ds.length);
   d={txt:(m>=0?'+':'−')+Math.abs(m).toFixed(3)+' ± '+(1.96*se).toFixed(3),read:Math.abs(m)<1.96*se?'within noise':m<0?'better than Elo':'worse than Elo'}}
  o[k]={n:r.length,b:b.toFixed(3),acc:acc+'%',d}}return o}
const readBoard=pg=>pg.$$eval('.ldg-t tbody tr',a=>Object.fromEntries(a.map(r=>{const t=[...r.querySelectorAll('td')].map(x=>x.innerText.trim());return [r.dataset.k,t]})));
function sameBoard(got,want){return Object.entries(want).every(([k,w])=>{const g=got[k];if(!g)return false;if(!w)return g[1]==='0';
 return g[1]===String(w.n)&&g[2]===w.b&&g[3]===w.acc&&(k==='e'?/reference/.test(g[5]):(w.d?g[4]===w.d.txt&&g[5]===w.d.read:g[4]==='–'))})}
async function openL(b,o,route){const ctx=await b.newContext({viewport:{width:o.vw||1280,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[o.lang||'en',o.league||'l_4WFCIZ']);
 if(route)await ctx.route(/\/data\/ledger\.json/,route);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/ledger');return {ctx,pg,errs}}
const serve=r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(L)});
(async()=>{const b=await T.launch();
 ok(ids.length>=30&&fin.length>=20&&up.length>=12,`the ledger from sync.py's own step at ${NOW}: ${ids.length} predictions, ${fin.length} made finished for the test, ${up.length} coming`);
 let {ctx,pg,errs}=await openL(b,{},serve);await pg.waitForSelector('.ldg-t',{timeout:90000});await pg.waitForTimeout(300);
 ok(sameBoard(await readBoard(pg),board(fin)),'all six: the scoreboard (matches, Brier, most likely happened, against Elo ± 1.96 SE, reading) equals the test\'s sums '+JSON.stringify(board(fin).bl));
 {const mk=fin.filter(x=>x.mk),got=await pg.$$eval('.ldg-mk tbody tr',a=>a.map(r=>[r.dataset.k,...[...r.querySelectorAll('td.n')].map(x=>x.innerText.trim())]));
  const want=['e','m2','xi','bl','mk'].map(k=>{const r=mk.filter(x=>x[k]);return [k,String(r.length),r.length?(r.reduce((s,x)=>s+brier(x[k],x.o),0)/r.length).toFixed(3):'–']});
  ok(JSON.stringify(got)===JSON.stringify(want),'against the bookmakers: '+mk.length+' matches with closing odds, each model\'s Brier on the same matches '+JSON.stringify(want.slice(-1)))}
 {const cards=await pg.$$eval('.ldg-m',a=>a.map(c=>({id:c.dataset.id,t:Object.fromEntries([...c.querySelectorAll('tbody tr')].map(r=>[r.dataset.k,[...r.querySelectorAll('td.n')].map(x=>x.innerText.trim())]))})));
  const pc=x=>Math.round(x*100)+'%',bad=up.filter(u=>{const c=cards.find(x=>x.id===u.id);return !c||['e','m2','xi','bl','b'].some(k=>JSON.stringify(c.t[k])!==JSON.stringify(u[k]?u[k].map(pc):['–']))});
  ok(cards.length===up.length&&!bad.length&&cards.map(c=>c.id).join()===up.map(u=>u.id).join(),'coming matches: '+cards.length+' cards in kick-off order, every model\'s three chances as written'+(bad.length?' — '+bad.slice(0,3).map(x=>x.id):''))}
 {const rows=await pg.$$eval('.ldg-f tbody tr',a=>a.map(r=>r.dataset.id)),want=fin.slice().sort((a,b)=>a.k<b.k?1:-1).map(x=>x.id);
  ok(rows.join()===want.slice(0,30).join(),'finished matches: the latest 30 first');
  const cell=await pg.$$eval('.ldg-f tbody tr',a=>a.map(r=>[r.dataset.id,[...r.querySelectorAll('td.n')].map(x=>[x.innerText.trim(),!!x.querySelector('.ldg-y')])]));
  const bad=cell.filter(([id,c])=>{const x=fin.find(f=>f.id===id);return ['e','m2','xi','bl','b'].some((k,i)=>c[i][0]!==Math.round(x[k][x.o]*100)+'%'||c[i][1]!==(top(x[k])===x.o))});
  ok(!bad.length,'each finished row: the chance every model gave the real result, underlined when it was the model\'s favourite');
  await pg.click('#ldgm');await pg.waitForTimeout(150);ok((await pg.$$('.ldg-f tbody tr')).length===fin.length&&!(await pg.$('#ldgm')),'"Show more" shows the rest ('+fin.length+')')}
 /* the xG model equals the site's own Intelligence Lab model, run in the page for the Premier League */
 {const pl=ids.map(id=>Object.assign({id},RAW.p[id])).filter(x=>x.lg==='l_4WFCIZ'&&x.m2);
  const got=await pg.evaluate(async ps=>{const mm=await labMatchModel();return ps.map(p=>{const r=mm&&mm(p.h,p.a);return r?{p:r.p,ver:r.ver}:null})},pl.map(x=>({h:x.h,a:x.a})));
  const bad=pl.filter((x,i)=>!got[i]||got[i].ver!=='xg-poisson-2'||got[i].p.some((v,j)=>Math.abs(v-x.m2[j])>1e-4));
  ok(pl.length>=5&&!bad.length,'the xG model numbers of the '+pl.length+' Premier League matches equal the Intelligence Lab\'s own model (labMatchModel, xg-poisson-2) run in the page')}
 /* the league choice */
 {const lg='l_0ALvwF';await pg.click(`#ldgl button[data-l="${lg}"]`);await pg.waitForTimeout(200);const f=fin.filter(x=>x.lg===lg);
  ok(sameBoard(await readBoard(pg),board(f))&&(await pg.$$('.ldg-m')).length===up.filter(x=>x.lg===lg).length,'Serie A only: its '+f.length+' finished matches on the scoreboard and its '+up.filter(x=>x.lg===lg).length+' coming ones');
  ok(!!(await pg.$('.ldg-few'))&&/too few/.test(await pg.innerText('.ldg-few')),'under 30 scored matches the page says it is too few to judge');
  ok(!!(await pg.$('#ldgl .lgx-g')),'the league choice has the glass');
  await pg.click('#ldgl button[data-l="all"]');await pg.waitForTimeout(150)}
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='play'}),'the page is in the Play room');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the committed placeholder */
 ({ctx,pg,errs}=await openL(b,{},r=>r.fulfill({status:200,contentType:'application/json',body:'{"v":1,"since":"","models":[],"p":{}}'})));await pg.waitForSelector('#ldgroot .empty:not(.skel)',{timeout:90000});
 ok(/No predictions yet/.test(await pg.innerText('#ldgroot')),'an empty ledger says the first predictions come with the next update');ok(!errs.length,'no page errors');await ctx.close();
 /* a failing file, then loaded again */
 {let fail=true;({ctx,pg,errs}=await openL(b,{},r=>fail?r.fulfill({status:500,body:''}):serve(r)));await pg.waitForSelector('#ldgroot .empty:not(.skel)',{timeout:90000});const msg=await pg.innerText('#ldgroot');fail=false;
  await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('.lt',{timeout:60000});await pg.evaluate(()=>location.hash='#/ledger');await pg.waitForSelector('.ldg-t',{timeout:60000});
  ok(/not available right now/.test(msg)&&!!(await pg.$('.ldg-t')),'a failing file shows a message and is loaded again on the next visit');await ctx.close()}
 /* leaving before the file arrives */
 {({ctx,pg,errs}=await openL(b,{},async r=>{await new Promise(z=>setTimeout(z,2500));serve(r)}));await pg.waitForSelector('#ldgroot',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('.lt',{timeout:60000});await pg.waitForTimeout(3500);
  ok(!(await pg.$('#ldgroot'))&&!!(await pg.$('.lt'))&&!errs.length,'leaving before the file arrives: the table stays, no error');await ctx.close()}
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await openL(b,{vw:390,lang},serve));await pg.waitForSelector('.ldg-t',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,.seg')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/سجل التوقعات/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ldg_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
