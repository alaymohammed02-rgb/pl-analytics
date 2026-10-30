/* Fortress (assets/fortress.js): home and away points per game of every club from data/results.json, recomputed here with a loop of its own: for the
   current season and a finished one, every club's home and away games, points per game and gap, the three orders (gap, home, away), the club's own
   table of seasons, the league table of home advantage by season, and "Does a fortress last?" (pooled correlation of the gap, centred on each season's
   league mean, between consecutive finished seasons, Fisher interval) with each league's own line; pressing a club; another league; the Teams hub tab after
   Halves; Arabic, 390 px, leaving early, a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('results.json'),cmp=(a,b)=>a<b?-1:a>b?1:0;
function season(id,s){const L=F.leagues[id],S=L.seasons.find(x=>x.s===s),t={};let hw=0,dr=0,aw=0,hg=0,ag=0;
 const g=n=>t[n]=t[n]||{t:n,hn:0,hp:0,hw:0,hd:0,hl:0,an:0,ap:0,aw:0,ad:0,al:0};
 for(const x of S.m){const h=g(L.teams[x[1]]),a=g(L.teams[x[2]]),gh=x[3],ga=x[4];h.hn++;a.an++;hg+=gh;ag+=ga;
  if(gh>ga){h.hp+=3;h.hw++;a.al++;hw++}else if(gh<ga){a.ap+=3;a.aw++;h.hl++;aw++}else{h.hp++;a.ap++;h.hd++;a.ad++;dr++}}
 const rows=Object.values(t).map(r=>({...r,hpg:r.hp/r.hn,apg:r.ap/r.an,gap:r.hp/r.hn-r.ap/r.an})),n=rows.length;
 return {s,rows,N:S.m.length,fin:S.m.length===n*(n-1),hw,dr,aw,hg,ag}}
const corr=(a,b)=>{const n=a.length,ma=a.reduce((s,x)=>s+x)/n,mb=b.reduce((s,x)=>s+x)/n;let c=0,x=0,y=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);x+=(a[i]-ma)**2;y+=(b[i]-mb)**2}return c/Math.sqrt(x*y)};
function repeat(){const A=[],B=[],per={};
 for(const id of Object.keys(F.leagues)){const ss=F.leagues[id].seasons.map(s=>season(id,s.s)),a=[],b=[];
  for(let i=0;i+1<ss.length;i++){if(!ss[i].fin||!ss[i+1].fin)continue;const m1=ss[i].rows.reduce((s,r)=>s+r.gap,0)/ss[i].rows.length,m2=ss[i+1].rows.reduce((s,r)=>s+r.gap,0)/ss[i+1].rows.length;
   for(const r of ss[i].rows){const q=ss[i+1].rows.find(x=>x.t===r.t);if(q){a.push(r.gap-m1);b.push(q.gap-m2)}}}
  per[id]={n:a.length,r:corr(a,b)};A.push(...a);B.push(...b)}
 const n=A.length,r=corr(A,B),z=Math.atanh(r),se=1/Math.sqrt(n-3);return {n,r,lo:Math.tanh(z-1.96*se),hi:Math.tanh(z+1.96*se),per}}
const order={gap:r=>r.gap,home:r=>r.hpg,away:r=>r.apg};
const rowsOf=pg=>pg.$$eval('.ft-row',a=>a.map(r=>({t:r.dataset.t,hp:+r.dataset.hp,ap:+r.dataset.ap,hn:+r.dataset.hn,an:+r.dataset.an,gap:r.querySelector('.ft-g').textContent.replace(/[\u2066-\u2069\u200e\u200f]/g,''),hx:parseFloat(r.querySelector('.ft-h').style.left),ax:parseFloat(r.querySelector('.ft-a').style.left),lx:parseFloat(r.querySelector('.ft-ln').style.left),lw:parseFloat(r.querySelector('.ft-ln').style.width)})));
const sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(2);
function want(S,k){return S.rows.slice().sort((a,b)=>order[k](b)-order[k](a)||cmp(a.t,b.t))}
function same(got,W){return got.length===W.length&&W.every((w,i)=>{const g=got[i];return g.t===w.t&&Math.abs(g.hp-w.hpg)<1e-3&&Math.abs(g.ap-w.apg)<1e-3&&g.hn===w.hn&&g.an===w.an&&g.gap===sg(w.gap)&&Math.abs(g.hx-w.hpg/3*100)<.02&&Math.abs(g.ax-w.apg/3*100)<.02&&Math.abs(g.lx-Math.min(w.hpg,w.apg)/3*100)<.02&&Math.abs(g.lw-Math.abs(w.hpg-w.apg)/3*100)<.02})}
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',cur=F.leagues[LG].seasons[F.leagues[LG].seasons.length-1].s;
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/fortress'});await pg.waitForSelector('.ft-row',{timeout:90000});await pg.waitForTimeout(400);
 let S=season(LG,cur),got=await rowsOf(pg);
 ok(same(got,want(S,'gap')),cur+' (under way): '+S.rows.length+' clubs, home and away games, points per game, the gap and the dots\' places match, ordered by the gap');
 ok(got.every(g=>g.hn<=8&&g.an<=8)&&!S.fin&&/so far/.test(await pg.innerText('.ft-c .ins-note')),'an unfinished season says so (so far) and each club has only its few games');
 for(const k of ['home','away']){await pg.click('#ftso button[data-k="'+k+'"]');await pg.waitForTimeout(200);ok(same(await rowsOf(pg),want(S,k)),'ordered by '+k+' points per game');}
 await pg.click('#ftso button[data-k="gap"]');await pg.waitForTimeout(150);
 /* a club's own table of seasons */
 const t=want(S,'gap')[4].t;await pg.click('.ft-row[data-t="'+t+'"]');await pg.waitForTimeout(250);
 {const ss=F.leagues[LG].seasons.map(s=>season(LG,s.s)),W=ss.map(x=>({s:x.s,r:x.rows.find(r=>r.t===t)})).filter(x=>x.r),got2=await pg.$$eval('.ft-t tbody tr',a=>a.map(r=>({s:r.dataset.s,c:[...r.querySelectorAll('td')].slice(1).map(x=>x.textContent.trim())})));
  ok(got2.length===W.length&&W.every((w,i)=>got2[i].s===w.s&&got2[i].c[0]===w.r.hw+'-'+w.r.hd+'-'+w.r.hl&&got2[i].c[1]===w.r.hpg.toFixed(2)&&got2[i].c[2]===w.r.aw+'-'+w.r.ad+'-'+w.r.al&&got2[i].c[3]===w.r.apg.toFixed(2)&&got2[i].c[4]===sg(w.r.gap)),t+': its '+W.length+' seasons with home and away W-D-L, points per game and gap match')}
 ok(await pg.$eval('.ft-row.on',e=>e.dataset.t)===t&&(await pg.innerText('#ftsel h3')).includes(t),'pressing a club marks it and opens its table');
 /* home advantage by season */
 {const ss=F.leagues[LG].seasons.map(s=>season(LG,s.s)).reverse(),got3=await pg.$$eval('.ft-y tbody tr',a=>a.map(r=>({s:r.dataset.s,c:[...r.querySelectorAll('td')].slice(1).map(x=>x.textContent.trim())})));
  ok(got3.length===ss.length&&ss.every((x,i)=>got3[i].s===x.s&&got3[i].c[0]===String(x.N)&&got3[i].c[1]===Math.round(x.hw/x.N*100)+'%'&&got3[i].c[2]===Math.round(x.dr/x.N*100)+'%'&&got3[i].c[3]===Math.round(x.aw/x.N*100)+'%'&&got3[i].c[4]===(x.hg/x.N).toFixed(2)+' / '+(x.ag/x.N).toFixed(2)),'home advantage by season: matches, home wins, draws, away wins and goals per match for '+ss.length+' seasons')}
 /* does a fortress last */
 {const rp=repeat(),txt=await pg.innerText('#ftrp .ft-rr'),per=await pg.$$eval('.ft-pt tbody tr',a=>a.map(r=>({l:r.dataset.l,n:+r.children[1].textContent,r:r.children[2].textContent.trim()})));
  ok(txt.includes('correlation of '+rp.r.toFixed(2)+' (95% interval '+rp.lo.toFixed(2)+' to '+rp.hi.toFixed(2)+') over '+rp.n+' club pairs'),'does a fortress last: r '+rp.r.toFixed(2)+' ('+rp.lo.toFixed(2)+' to '+rp.hi.toFixed(2)+') over '+rp.n+' pairs');
  ok((rp.lo<=0&&rp.hi>=0)===/within noise/.test(txt),'the reading ("within noise" or not) follows the interval');
  ok(per.length===6&&per.every(x=>x.n===rp.per[x.l].n&&x.r===rp.per[x.l].r.toFixed(2)),'each league\'s own pairs and correlation match ('+per.map(x=>x.n).join(', ')+')')}
 /* a finished season */
 const fin='2025-26';await pg.selectOption('#fts',String(F.leagues[LG].seasons.findIndex(s=>s.s===fin)));await pg.waitForTimeout(300);S=season(LG,fin);
 ok(same(await rowsOf(pg),want(S,'gap'))&&S.fin&&(await rowsOf(pg)).every(g=>g.hn===19&&g.an===19),fin+' (finished): 20 clubs, each with 19 home and 19 away games, all numbers match');
 ok(!/so far/.test(await pg.innerText('.ft-c .ins-note')),'a finished season does not say "so far"');
 /* another league */
 const L2='l_0ErfuF';await pg.selectOption('#ftg',L2);await pg.waitForTimeout(300);const c2=F.leagues[L2].seasons[F.leagues[L2].seasons.length-1].s;S=season(L2,c2);
 ok(same(await rowsOf(pg),want(S,'gap')),'LaLiga '+c2+': '+S.rows.length+' clubs match');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/fortress')===a.indexOf('#/halves')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/fortress'}),'the page is the Teams hub tab after Halves, marked open');
 ok(!!(await pg.$('#ftso .lgx-g')),'the order choice has the glass');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2_=await b.newContext();await c2_.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2_.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/fortress');await p2.waitForSelector('#ftroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#ftroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2_.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/fortress');
  await p3.waitForSelector('#ftroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#ftroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/fortress'});await p3.waitForSelector('.ft-row',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.ft-row')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/fortress'}));await pg.waitForSelector('.ft-row',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('.ft-row',a=>a.every(r=>r.scrollWidth<=r.clientWidth+1)),lang+' phone: every row fits');
  ok(same(await rowsOf(pg),want(season(LG,cur),'gap')),lang+' phone: the rows are the same');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/قلعة البيت/.test(await pg.textContent('#app h2')),'Arabic title');
   ok(/ضمن الضوضاء|فوق الصفر|تحت الصفر/.test(await pg.innerText('#ftrp .ft-rr')),'Arabic: the reading of the repeat test');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/fort_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
