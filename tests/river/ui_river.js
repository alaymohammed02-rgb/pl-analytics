/* Elo river (assets/elo-river.js): one line per club from data/elo_own.json. For each of the four ranges (12 months, this season, 90 days, everything stored)
   every club's number of points, first and last rating recomputed here from the file; the path has one point per rating; the lines end in order of the
   current rating; a line keeps its place inside the chart; the chips are in order of rating with the rounded rating; hovering a line or a chip follows it,
   clicking keeps it (and again lets it go), Enter on a chip too; following a club draws nothing again; another league; the Teams hub tab after Club Elo;
   Arabic, 390 px, leaving early, a failing file, reduced motion. */
const T=require('../nf/lib.js');const {ok,J}=T;
const E=J('elo_own.json'),LG='l_4WFCIZ';
const dn=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5,iso=n=>new Date(n*864e5).toISOString().slice(0,10);
const since=(last,r)=>r==='90'?iso(dn(last)-90):r==='365'?iso(dn(last)-365):r==='season'?(+last.slice(5,7)>=7?last.slice(0,4):String(+last.slice(0,4)-1))+'-07-01':'0000-00-00';
function want(id,r){const L=E.leagues[id],f=since(L.last,r),o=[];for(const [t,x] of Object.entries(L.teams)){const h=(x.h||[]).filter(p=>p[0]>=f);if(h.length)o.push({t,r:x.r,n:h.length,first:h[0][1],last:h[h.length-1][1]})}
 return o.sort((a,b)=>b.r-a.r||(a.t<b.t?-1:1))}
const lines=pg=>pg.$$eval('.er-l',a=>a.map(g=>({t:g.dataset.t,n:+g.dataset.n,first:+g.dataset.first,last:+g.dataset.last,pts:(g.querySelector('.er-p').getAttribute('d').match(/[ML]/g)||[]).length,cy:+g.querySelector('circle').getAttribute('cy'),cx:+g.querySelector('circle').getAttribute('cx'),ty:+g.querySelector('.er-t').getAttribute('y'),hi:g.classList.contains('hi'),dim:g.classList.contains('dim')})));
const chips=pg=>pg.$$eval('.er-chip',a=>a.map(c=>({t:c.dataset.t,txt:c.textContent.trim(),on:c.getAttribute('aria-pressed')})));
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/river'});await pg.waitForSelector('.er-l',{timeout:90000});await pg.waitForTimeout(1500);
 for(const [r,name] of [['365','12 months'],['season','this season'],['90','90 days'],['all','everything stored']]){
  if(r!=='365'){await pg.click('#err button[data-r="'+r+'"]');await pg.waitForTimeout(500)}
  const W=want(LG,r),got=await lines(pg),by=new Map(got.map(g=>[g.t,g]));
  ok(got.length===W.length&&W.every(w=>{const g=by.get(w.t);return g&&g.n===w.n&&g.first===w.first&&g.last===w.last&&g.pts===w.n}),name+': '+W.length+' clubs, and for each the number of ratings, the first and the last match the file ('+W.reduce((s,x)=>s+x.n,0)+' points)');
  const ranked=got.slice().sort((a,b)=>a.cy-b.cy).map(g=>g.t),byRating=got.slice().sort((a,b)=>b.last-a.last||(a.t<b.t?-1:1)).map(g=>g.t);
  ok(JSON.stringify(ranked)===JSON.stringify(byRating),name+': the lines end in order of the current rating (higher is higher up)');
  ok(got.every(g=>g.cx>=46&&g.cx<=760-124+0.5&&g.cy>=14&&g.cy<=440-30),name+': every line ends inside the chart');
  ok(await pg.$$eval('.er-t',a=>{const y=a.map(t=>+t.getAttribute('y')).sort((x,z)=>x-z);return y.every((v,i)=>!i||v-y[i-1]>=10.9)}),name+': the end labels never overlap')}
 /* the chips */
 await pg.click('#err button[data-r="365"]');await pg.waitForTimeout(500);const W=want(LG,'365'),ch=await chips(pg);
 ok(JSON.stringify(ch.map(c=>c.t))===JSON.stringify(W.map(w=>w.t))&&ch.every((c,i)=>c.txt.endsWith(String(Math.round(W[i].r)))),'the chips are in order of rating with the rounded rating ('+ch[0].t+' '+Math.round(W[0].r)+')');
 /* following a club */
 const A=W[0].t,B=W[3].t;await pg.$eval('.er-svg',e=>e.classList.add('er-draw'));
 const box=await pg.evaluate(t=>{const p=document.querySelector('.er-l[data-t="'+CSS.escape(t)+'"] .er-hit')||document.querySelector('.er-l[data-t="'+t+'"] .er-hit'),L=p.getTotalLength(),ct=p.ownerSVGElement.getScreenCTM();
  for(let k=1;k<200;k++){const m=p.getPointAtLength(L*k/200),x=m.x*ct.a+ct.e,y=m.y*ct.d+ct.f,e=document.elementFromPoint(x,y);if(e&&e===p)return [x,y]}return null},A);
 ok(!!box,'a point of the line of '+A+' can be pressed');
 await pg.mouse.move(box[0],box[1]);await pg.waitForTimeout(300);let g=await lines(pg);
 ok(g.filter(x=>x.hi).length===1&&g.find(x=>x.hi).t===A&&g.filter(x=>x.dim).length===g.length-1,'hovering the line of '+A+' follows it: it is thick, the other '+(g.length-1)+' fade');
 ok(!(await pg.$eval('.er-svg',e=>e.classList.contains('er-draw'))),'following a club draws nothing again');
 await pg.mouse.move(5,5);await pg.waitForTimeout(300);g=await lines(pg);ok(g.every(x=>!x.hi&&!x.dim),'moving away lets it go');
 await pg.click('.er-chip[data-t="'+B+'"]');await pg.waitForTimeout(300);g=await lines(pg);const c2=await chips(pg);
 ok(g.find(x=>x.hi).t===B&&c2.filter(c=>c.on==='true').length===1&&c2.find(c=>c.on==='true').t===B,'clicking the chip of '+B+' keeps it followed, and the chip is marked pressed');
 await pg.mouse.move(5,5);await pg.waitForTimeout(250);ok((await lines(pg)).find(x=>x.hi).t===B,'a kept club stays followed when the pointer leaves');
 await pg.click('.er-chip[data-t="'+B+'"]');await pg.mouse.move(5,5);await pg.waitForTimeout(250);ok((await lines(pg)).every(x=>!x.hi&&!x.dim)&&(await chips(pg)).every(c=>c.on==='false'),'clicking it again lets it go');
 await pg.focus('.er-chip[data-t="'+A+'"]');await pg.waitForTimeout(250);ok((await lines(pg)).find(x=>x.hi).t===A,'focusing a chip with the keyboard follows it');
 await pg.keyboard.press('Enter');await pg.mouse.move(5,5);await pg.waitForTimeout(250);await pg.evaluate(()=>document.activeElement.blur());await pg.waitForTimeout(250);ok((await lines(pg)).find(x=>x.hi).t===A,'Enter on the chip keeps it');
 await pg.click('.er-chip[data-t="'+A+'"]');await pg.waitForTimeout(150);
 ok(await pg.$$eval('#err button',a=>a.length===4&&a.filter(x=>x.getAttribute('aria-pressed')==='true').length===1)&&!!(await pg.$('#err .lgx-g')),'the range choice has one chosen button and the glass');
 /* another league */
 const L2='l_0ErfuF';await pg.selectOption('#erg',L2);await pg.waitForTimeout(600);const W2=want(L2,'365'),g2=await lines(pg);
 ok(g2.length===W2.length&&W2.every(w=>{const x=g2.find(y=>y.t===w.t);return x&&x.n===w.n&&x.last===w.last}),'LaLiga, 12 months: '+W2.length+' clubs match the file');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/river')===a.indexOf('#/elo')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/river'}),'the page is the tab after Club Elo in the Teams hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2_=await b.newContext();await c2_.route(/elo_own\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2_.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/river');await p2.waitForSelector('#errot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#errot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2_.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/elo_own\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/river');
  await p3.waitForSelector('#errot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#errot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/river'});await p3.waitForSelector('.er-l',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.er-l')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/river'}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.waitForSelector('.er-l',{timeout:90000});await pg.waitForTimeout(500);
 ok(await pg.$eval('.er-p',e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).strokeDashoffset==='0px'),'reduced motion: the lines are simply there, not drawn in');await ctx.close();
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/river'}));await pg.waitForSelector('.er-l',{timeout:90000});await pg.waitForTimeout(500);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');ok(await pg.$eval('.er-svg',e=>e.getBoundingClientRect().width<=390),lang+' phone: the chart fits the width');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,svg')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/نهر/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/river_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
