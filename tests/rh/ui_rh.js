/* Replace him (assets/replace-him.js, #/replace): the raw pools are read from the page (INS.twins.pool: percentiles; INS.playerPool: values and ages) and the ten closest
   players are worked out again here with a loop of the test's own (similarity = 100 − the mean percentile gap over the measures both have, 10 at least, same position;
   budget, age and league filters; no-value players left out under a budget) for: the default (cheaper than him), €10m, 23 or younger, one league, any price; the values
   shown equal data/tm.json; the default player is the open league's most valuable one; a row opens its radar; search; no Transfermarkt file; failing player files;
   leaving early; the page in the Players room; Arabic and a 390 px phone. */
const T=require('../nf/lib.js');const {ok,J}=T;
const TM=J('tm.json');
const LG='l_4WFCIZ';
async function pools(pg){return pg.evaluate(async()=>{const [T,P]=await Promise.all([INS.twins.pool(),INS.playerPool()]);
 return {keys:INS.twins.KEYS,list:T.list.map(x=>({key:x.key,id:x.id,lid:x.lid,n:x.n,club:x.club,p:x.p,mi:x.mi,q:x.q,qo:x.qo})),info:Object.fromEntries([...P.by].map(([k,v])=>[k,{val:v.val,age:v.age}])),tm:!!P.tm}})}
function rank(D,key,o){
 const t=D.list.find(x=>x.key===key),f=t.p?'q':'qo',info=k=>D.info[k]||{},tv=info(key).val;
 const sim=(a,b)=>{let s=0,n=0;for(const k of D.keys){const x=a[f][k],y=b[f][k];if(x!=null&&y!=null){s+=Math.abs(x-y);n++}}return n>=10?100-s/n:null};
 const cap=o.bud==='any'?Infinity:o.bud==='cheaper'?(tv!=null?tv:Infinity):(+o.bud)*1e6,priced=o.bud!=='any'&&!(o.bud==='cheaper'&&tv==null);
 const out=[];let noval=0;
 for(const x of D.list){if(x.id===t.id||(t.p&&x.p!==t.p)||(o.lg&&x.lid!==o.lg))continue;const i=info(x.key);
  if(o.age!=='any'&&!(i.age!=null&&i.age<=+o.age))continue;if(priced){if(i.val==null){noval++;continue}if(!(i.val<cap))continue}
  const s=sim(t,x);if(s!=null)out.push({key:x.key,s,n:x.n})}
 out.sort((a,b)=>b.s-a.s||a.n.localeCompare(b.n));return {rows:out.slice(0,10),noval}}
const shown=pg=>pg.$$eval('.rh-list li',a=>a.map(li=>({key:li.dataset.k,pct:li.querySelector('.tw-p').innerText.trim(),meta:li.querySelector('.rh-n .mu').innerText})));
function same(got,want){return got.length===want.rows.length&&got.every((g,i)=>g.key===want.rows[i].key&&g.pct===Math.round(want.rows[i].s)+'%')}
const money=v=>v>=1e6?'€'+(v/1e6).toFixed(v>=1e7?0:1)+'m':'€'+Math.round(v/1e3)+'k';
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/replace'});await pg.waitForSelector('.rh-me',{timeout:120000});await pg.waitForTimeout(300);
 const D=await pools(pg);
 ok(D.list.length>1000&&D.tm,'the pools: '+D.list.length+' outfield players of the six leagues with percentiles, and Transfermarkt values');
 const here=D.list.filter(x=>x.lid===LG&&D.info[x.key]&&D.info[x.key].val!=null).sort((a,b)=>D.info[b.key].val-D.info[a.key].val||a.n.localeCompare(b.n));
 const key0=await pg.$eval('.rh-list li',li=>null).catch(()=>null);
 const pickName=await pg.innerText('.rh-me h3');
 ok(pickName===here[0].n,'the page opens on the Premier League\'s most valuable player in the pool: '+here[0].n+' ('+money(D.info[here[0].key].val)+')');
 const K=here[0].key;
 const cases=[['cheaper than him',{bud:'cheaper',age:'any',lg:''},null],['under €10m',{bud:'10',age:'any',lg:''},['#rhb','b','10']],['23 or younger',{bud:'10',age:'23',lg:''},['#rha','a','23']],
  ['LaLiga only',{bud:'10',age:'23',lg:'l_0ErfuF'},['#rhlg',null,'l_0ErfuF']],['any price, any age, all leagues',{bud:'any',age:'any',lg:''},null]];
 for(const [name,o,act] of cases){
  if(act){if(act[1])await pg.click(`${act[0]} button[data-${act[1]}="${act[2]}"]`);else await pg.selectOption(act[0],act[2]);await pg.waitForTimeout(150)}
  if(name.startsWith('any price')){await pg.click('#rhb button[data-b="any"]');await pg.click('#rha button[data-a="any"]');await pg.selectOption('#rhlg','');await pg.waitForTimeout(150)}
  const want=rank(D,K,o),got=await shown(pg),nv=await pg.$('.rh-nv');
  ok(same(got,want)&&(want.noval?!!nv&&(await pg.innerText('.rh-nv')).includes(String(want.noval)):!nv),name+': the '+want.rows.length+' closest and their similarity match'+(want.noval?', '+want.noval+' without a value left out':''));
  const badV=got.filter(g=>{const id=g.key.split('|')[1],v=TM.p[id]?TM.p[id][1]:null;return v!=null&&!g.meta.includes(money(v))});
  if(name==='under €10m')ok(!badV.length&&got.every(g=>{const id=g.key.split('|')[1];return TM.p[id]&&TM.p[id][1]<1e7}),'under €10m: every value shown is the player\'s value in data/tm.json, all under €10m')}
 /* a row opens its radar */
 {const rows=await shown(pg);await pg.click(`.rh-list button[data-k="${rows[2].key}"]`);await pg.waitForTimeout(150);
  ok((await pg.$eval('.rh-list li.on',li=>li.dataset.k))===rows[2].key&&!!(await pg.$('.rh-cmp svg'))&&(await pg.innerText('.rh-cmp h3')).includes(D.list.find(x=>x.key===rows[2].key).n),'clicking the third row shows its radar against the chosen player')}
 /* search */
 {const other=D.list.filter(x=>x.lid==='l_1Isor4'&&x.p).sort((a,b)=>b.mi-a.mi)[0];await pg.fill('#rhq',other.n+' · '+other.club);await pg.dispatchEvent('#rhq','change');await pg.waitForTimeout(250);
  const want=rank(D,other.key,{bud:'any',age:'any',lg:''});ok((await pg.innerText('.rh-me h3'))===other.n&&same(await shown(pg),want),'search: '+other.n+' and his closest players')}
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='players'}),'the page is in the Players room');
 ok(!!(await pg.$('#rhb .lgx-g')),'the budget choice has the glass');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* no Transfermarkt file */
 {const c=await b.newContext({viewport:{width:1100,height:900}});await c.addInitScript(l=>{localStorage.setItem('league',l)},LG);await c.route(/\/data\/tm\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"t":"","p":{}}'}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/replace');await p.waitForSelector('.rh-me',{timeout:120000});
  ok(!(await p.$('#rhb'))&&/No market values/.test(await p.innerText('#rhroot'))&&(await p.$$('.rh-list li')).length===10&&!e.length,'without values: no budget choice, the page says so and still lists the ten closest');await c.close()}
 /* failing player files */
 {const c=await b.newContext();await c.route(/_pl\.json/,r=>r.fulfill({status:500,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/replace');
  await p.waitForSelector('#rhroot .empty:not(.skel)',{timeout:120000});ok(/not available/.test(await p.innerText('#rhroot'))&&!e.length,'failing player files: a message, no error');await c.close()}
 /* leaving before the data arrives */
 {const c=await b.newContext();await c.route(/_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));
  await p.goto('http://127.0.0.1:8765/index.html#/replace');await p.waitForSelector('#rhroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#rhroot'))&&!!(await p.$('.lt'))&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/replace'}));await pg.waitForSelector('.rh-me',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,svg,datalist,.ins-leg')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/ابحث عن بديل/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/rh_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
