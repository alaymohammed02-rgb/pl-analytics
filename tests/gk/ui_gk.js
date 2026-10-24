/* Goalkeepers (assets/goalkeepers.js): the table recomputed from the league's shot, line-up and match files (own code), the three orders,
   the noise reading, the repeat sentence against data/gk_repeat.json, the hub tab, Arabic, 390 px, leaving early and a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('gk_repeat.json'),LG='l_0ErfuF',L=T.lg(LG),SH=J(L.sh_file),MX=J(L.mx_file),LGF=J(L.file);
const sh={};SH.cols.forEach((c,i)=>sh[c]=i);
function calc(){const side={};LGF.matches.forEach(m=>side[m.i]=m);const K={};let total=0,used=0,goals=0,xg=0;
 for(const r of SH.rows){if(r[sh.og]||r[sh.bl]||(r[sh.ev]!=='Goal'&&r[sh.ev]!=='AttemptSaved'))continue;total++;const m=side[r[sh.m]];if(!m)continue;
  const d=r[sh.c]===m.h?'a':r[sh.c]===m.a?'h':null;if(!d)continue;const xi=(((MX.m[r[sh.m]]||{}).lu||{})[d]||{}).xi||[],g=xi.find(p=>p[3]===11);if(!g)continue;
  used++;const p=+r[sh.xo]||0,gl=r[sh.ev]==='Goal'?1:0;goals+=gl;xg+=p;const k=K[g[0]]||(K[g[0]]={id:g[0],name:g[1],n:0,g:0,x:0,v:0});k.n++;k.g+=gl;k.x+=p;k.v+=p*(1-p)}
 return {K:Object.values(K).filter(k=>k.n>=20).map(k=>({...k,d:k.x-k.g,se:Math.sqrt(k.v)})),total,used,goals,xg}}
const A=calc();
const ord=o=>A.K.slice().sort((a,b)=>o==='best'?b.d-a.d||a.name.localeCompare(b.name):o==='worst'?a.d-b.d||a.name.localeCompare(b.name):b.n-a.n||a.name.localeCompare(b.name));
const sg=(v,d)=>(v>=0?'+':'−')+Math.abs(v).toFixed(d),rd=k=>k.d>1.96*k.se?'clearly above expected':k.d<-1.96*k.se?'clearly below expected':'within noise';
const rows=pg=>pg.evaluate(()=>[...document.querySelectorAll('.gk-t tbody tr')].map(r=>({id:r.dataset.id,n:r.cells[3].textContent.trim(),g:r.cells[4].textContent.trim(),x:r.cells[5].textContent.trim(),d:r.cells[6].textContent.trim(),p:r.cells[7].textContent.trim(),r:r.cells[8].innerText.trim()})));
(async()=>{const b=await T.launch();
 ok(A.K.length>=10&&A.used/A.total>0.9,'sanity: '+A.K.length+' keepers with 20+ shots faced, '+A.used+' of '+A.total+' shots given to a keeper');
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/keepers'});await pg.waitForSelector('.gk-t tbody tr',{timeout:90000});
 for(const o of ['best','worst','faced']){await pg.selectOption('#gks',o);const R=await rows(pg),W=ord(o);
  ok(R.length===W.length&&R.every((r,i)=>r.id===W[i].id&&r.n===String(W[i].n)&&r.g===String(W[i].g)&&r.x===W[i].x.toFixed(1)&&r.d===sg(W[i].d,1)&&r.p===sg(W[i].d/W[i].n*100,1)&&r.r===rd(W[i])),o+': '+R.length+' keepers, same order, shots, goals, xGOT, prevented, per 100 and reading'+(o==='best'?' (top: '+W[0].name+' '+sg(W[0].d,1)+')':''))}
 await pg.selectOption('#gks','best');
 const R=await rows(pg);ok(R.some(r=>r.r==='within noise')&&R.every(r=>['clearly above expected','clearly below expected','within noise'].includes(r.r)),'every keeper has a reading; most are within noise: '+R.filter(r=>r.r==='within noise').length+' of '+R.length);
 const intro=await pg.innerText('.lk-intro'),y=F.yoy,h=F.half,hi=(y.r+1.96*y.se).toFixed(2);
 ok(intro.includes('correlation '+sg(y.r,2)+' ± '+y.se.toFixed(2)+' over '+y.n+' pairs')&&intro.includes(sg(h.sb,2)+' ± '+h.se.toFixed(2)+' over '+h.n+' keeper-seasons')&&intro.includes('No sign that it repeats')&&intro.includes('up to about '+hi),'the repeat sentence: '+sg(y.r,2)+' ± '+y.se.toFixed(2)+' ('+y.n+' pairs), '+sg(h.sb,2)+' within a season, "up to about '+hi+'"');
 const note=await pg.innerText('.ins-note');ok(note.includes(A.used+' of '+A.total+' shots')&&note.includes(A.goals+' goals against '+A.xg.toFixed(1)),'the note: '+A.used+' of '+A.total+' shots given to a keeper, '+A.goals+' goals against '+A.xg.toFixed(1)+' expected');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/keepers')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/keepers'}),'the page is a tab of the Defence hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/gk_repeat\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/keepers');await p2.waitForSelector('#gkroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#gkroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/gk_repeat\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/keepers');
  await p3.waitForSelector('#gkroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#gkroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/keepers'});await p3.waitForSelector('.gk-t',{timeout:60000});
  ok(/Could not load/.test(msg)&&!!(await p3.$('.gk-t')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/keepers'});await pg.waitForSelector('.gk-t tbody tr',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>{const t=document.querySelector('.gk-t').getBoundingClientRect(),c=document.querySelector('.gk-t').closest('.card').getBoundingClientRect();return t.left>=c.left-1&&t.right<=c.right+1}),lang+' phone: the table fits its card');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/الحراس/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined on the page')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/gk_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
