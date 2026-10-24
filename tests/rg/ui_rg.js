/* Who keeps it up? (assets/keeps-up.js): the table recomputed from the league's player file and data/regress.json, the three choices,
   the test card, the hub tab, Arabic, 390 px, leaving before the data arrives and a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('regress.json'),LG='l_0ErfuF',PL=J(LG+'_pl.json');
const NAMES={gl:'Goals',npxg:'Non-penalty xG',xg:'xG',sh:'Shots',ast:'Assists',xag:'xAG',kp:'Key passes',tk:'Tackles',ic:'Interceptions',ps:'Passes'};
/* own implementation */
function players(){const ix={};PL.cols.forEach((c,i)=>ix[c]=i);const M=new Map();
 for(const r of PL.rows){if(r[ix.mi]==null)continue;let a=M.get(r[ix.i]);if(!a)M.set(r[ix.i],a={id:r[ix.i],name:r[ix.n],mi:0,pos:{},s:{},m:{}});a.mi+=r[ix.mi];if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+r[ix.mi];
  for(const k in NAMES){const v=r[ix[k]];if(v!=null){a.s[k]=(a.s[k]||0)+v;a.m[k]=(a.m[k]||0)+r[ix.mi]}}}
 return [...M.values()].map(a=>({...a,p:Object.keys(a.pos).sort((x,y)=>a.pos[y]-a.pos[x])[0]})).filter(a=>a.p&&a.p!=='GK'&&a.mi>=F.min_x)}
function calc(k){const P=players().filter(a=>a.m[k]>0),g={};P.forEach(a=>(g[a.p]=g[a.p]||[]).push(a.s[k]/a.m[k]*90));
 const mu={};for(const q in g)if(g[q].length>=5)mu[q]=g[q].reduce((x,y)=>x+y,0)/g[q].length;const K=F.stats[k].K;
 return P.filter(a=>mu[a.p]!=null).map(a=>{const x=a.s[k]/a.m[k]*90,e=mu[a.p]+(x-mu[a.p])*a.m[k]/(a.m[k]+K);return {id:a.id,name:a.name,p:a.p,mi:a.mi,x,e,d:x-e}})}
const sortD=(L,dir)=>L.slice().sort((a,b)=>dir==='hot'?b.d-a.d||a.name.localeCompare(b.name):a.d-b.d||a.name.localeCompare(b.name));
const f2=v=>v.toFixed(2),sg=v=>(v>=0?'+':'−')+f2(Math.abs(v));
const rows=pg=>pg.evaluate(()=>[...document.querySelectorAll('.ku-t tbody tr')].map(r=>({id:r.dataset.id,name:r.cells[0].innerText.trim(),mi:r.cells[2].textContent.trim(),x:r.cells[3].textContent.trim(),e:r.cells[4].textContent.trim(),d:r.cells[5].textContent.trim()})));
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/keepsup'});await pg.waitForSelector('.ku-t tbody tr',{timeout:90000});
 let R=await rows(pg),W=sortD(calc('gl'),'hot').slice(0,20);
 ok(R.length===20&&R.every((r,i)=>r.id===W[i].id),'goals, above what lasts: the same 20 players in the same order as the independent calculation (top: '+R.slice(0,3).map(r=>r.name.replace(/ [A-Z]{2}$/,'')).join(', ')+')');
 ok(R.every((r,i)=>r.x===f2(W[i].x)&&r.e===f2(W[i].e)&&r.d===sg(W[i].d)&&r.mi===String(Math.round(W[i].mi))),'minutes, number per 90, likely number and gap of every row match');
 ok(R.every(r=>parseFloat(r.d.replace('−','-'))>=0)&&+R[0].d.replace('+','')>=+R[19].d.replace('+',''),'"above what lasts": every gap is plus, biggest first');
 ok(R.every(r=>+r.e<=+r.x+1e-9),'the likely number is never above the number for a plus gap (it is pulled towards the mean)');
 for(const k of Object.keys(NAMES)){await pg.selectOption('#kus',k);R=await rows(pg);W=sortD(calc(k),'hot').slice(0,20);ok(R.length===W.length&&R.every((r,i)=>r.id===W[i].id&&r.d===sg(W[i].d)),NAMES[k]+': table matches ('+R.length+' rows)')}
 await pg.selectOption('#kus','xg');await pg.selectOption('#kud','cold');R=await rows(pg);W=sortD(calc('xg'),'cold').slice(0,20);
 ok(R.every((r,i)=>r.id===W[i].id)&&R.every(r=>r.d.startsWith('−')||r.d==='+0.00'||r.d==='−0.00'),'xG, below what lasts: smallest gap first, minus signs');
 for(const pos of ['DF','MF','FW']){await pg.selectOption('#kup',pos);R=await rows(pg);W=sortD(calc('xg').filter(a=>a.p===pos),'cold').slice(0,20);ok(R.length===W.length&&R.every((r,i)=>r.id===W[i].id),'position '+pos+': '+R.length+' players, same order')}
 await pg.selectOption('#kup','all');await pg.selectOption('#kus','gl');
 const intro=await pg.innerText('.lk-intro');const s=F.stats.gl,pc=x=>Math.round(x*100);
 ok(intro.includes('better than the raw number')&&intro.includes('down '+Math.abs(pc(s.gain))+'%')&&intro.includes(String(F.n_test)),'the test sentence: goals "better than the raw number", gain '+pc(s.gain)+'% ± '+pc(s.se)+'%, '+F.n_test+' players');
 await pg.selectOption('#kus','ps');const ip=await pg.innerText('.lk-intro');ok(/no better than the raw number \(within noise\)/.test(ip),'passes: the page says the rule is no better than the raw number');
 const B=await pg.evaluate(()=>[...document.querySelectorAll('.ku-b tbody tr')].map(r=>({k:r.dataset.k,K:r.cells[1].textContent.trim(),a:r.cells[2].textContent.trim(),b:r.cells[3].textContent.trim(),g:r.cells[4].textContent.trim(),r:r.cells[5].innerText.trim()})));
 ok(B.length===10&&B.every(r=>{const t=F.stats[r.k];return r.K===String(t.K)&&r.a===String(t.rmse_raw)&&r.b===String(t.rmse_shrunk)&&r.g===(t.gain>=0?'+':'−')+Math.abs(pc(t.gain))+'% ± '+pc(t.se)+'%'}),'the test table lists all 10 stats with the file\'s numbers');
 ok(B.find(r=>r.k==='ps').r==='no better than the raw number (within noise)'&&B.find(r=>r.k==='gl').r==='better than the raw number','readings: passes within noise, goals better');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/keepsup')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/keepsup'}),'the page is a tab of the Players hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/regress\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/keepsup');await p2.waitForSelector('#kuroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#kuroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/regress\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/keepsup');
  await p3.waitForSelector('#kuroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#kuroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/keepsup'});await p3.waitForSelector('.ku-t',{timeout:60000});
  ok(/Could not load/.test(msg)&&!!(await p3.$('.ku-t')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/keepsup'});await pg.waitForSelector('.ku-t tbody tr',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.ku-t,.ku-b')].every(t=>{const a=t.getBoundingClientRect(),c=t.closest('.card').getBoundingClientRect();return a.left>=c.left-1&&a.right<=c.right+1})),lang+' phone: both tables fit their cards');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/مين يكمّل على مستواه/.test(await pg.textContent('#app h2')),'Arabic title');
   ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined on the page')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ku_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
