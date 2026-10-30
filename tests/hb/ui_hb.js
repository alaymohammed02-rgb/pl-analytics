/* League heartbeat (assets/heartbeat.js): a dot for every match of a season, from the chances Elo gave each result before it was played.
   Here the chances are worked out again from data/results.json with an implementation of its own (a rating table updated match by match, in order of
   date then id) and first compared with data/elo_own.json, which Python wrote (every match of the current season, to four decimals), so the page's
   numbers rest on two implementations. Then, for the current season and a finished one (every dot: its result, its bits; every week: matches and mean;
   the four counts, the calmest and wildest weeks, the eight biggest shocks), the selection panel (click a dot, press a shock in the list, hover),
   "Only shocks", another league and the first season's warning; the Season hub's last tab; Arabic, 390 px, leaving early, a failing file, reduced motion. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('results.json'),E=J('elo_own.json'),P=F.params,cmp=(a,b)=>a<b?-1:a>b?1:0;
const dayNo=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
const wk=d=>Math.floor((dayNo(d)+3)/7);
const seasonOf=d=>+d.slice(5,7)>=7?+d.slice(0,4):+d.slice(0,4)-1;
const iso=n=>new Date(n*864e5).toISOString().slice(0,10);
/* chances of every match of a league, from the matches before it */
function chances(id){const L=F.leagues[id],list=[];
 L.seasons.forEach(s=>s.m.forEach(x=>list.push({d:x[0],h:L.teams[x[1]],a:L.teams[x[2]],hg:x[3],ag:x[4],id:x[5],s:s.s})));
 list.sort((x,y)=>cmp(x.d,y.d)||cmp(x.id,y.id));
 const rate={};let prev=null;const avg=()=>{const v=Object.values(rate);return v.reduce((a,b)=>a+b,0)/v.length};
 for(const m of list){const yr=seasonOf(m.d);
  if(prev!==null&&yr!==prev&&Object.keys(rate).length){const mu=avg();for(const t in rate)rate[t]=mu+(rate[t]-mu)*(1-P.reg)}
  prev=yr;for(const t of [m.h,m.a])if(!(t in rate))rate[t]=Object.keys(rate).length?avg():1500;
  const gap=rate[m.h]-rate[m.a]+P.H,z=gap/P.s,home=1/(1+Math.exp(P.c-z)),notAway=1/(1+Math.exp(-(z+P.c)));
  m.p=[home,notAway-home,1-notAway];if(!(m.p[1]>0)){m.p=[home,1-home-(1-notAway),1-notAway]}
  m.o=m.hg>m.ag?0:m.hg===m.ag?1:2;m.q=m.p[m.o];m.bits=-Math.log2(m.q);m.fav=m.p.indexOf(Math.max(...m.p));
  const exp=1/(1+Math.pow(10,-gap/400)),res=[1,.5,0][m.o],g=Math.abs(m.hg-m.ag),mult=g<2?1:g===2?1.5:(11+g)/8,ch=P.K*mult*(res-exp);
  rate[m.h]+=ch;rate[m.a]-=ch}
 return list}
function season(id,s){return chances(id).filter(m=>m.s===s)}
function weeks(ms){const g={};ms.forEach(m=>{(g[wk(m.d)]=g[wk(m.d)]||[]).push(m)});return Object.keys(g).map(Number).sort((a,b)=>a-b).map(w=>({w,n:g[w].length,mean:g[w].reduce((s,m)=>s+m.bits,0)/g[w].length}))}
const LG='l_4WFCIZ',cur=F.leagues[LG].seasons[F.leagues[LG].seasons.length-1].s;
const dots=pg=>pg.$$eval('.hb-m1',a=>a.map(c=>({id:c.dataset.id,bits:+c.dataset.bits,o:+c.dataset.o,cx:+c.getAttribute('cx'),cy:+c.getAttribute('cy'),r:+c.getAttribute('r'),cls:c.getAttribute('class')})));
const wpts=pg=>pg.$$eval('.hb-wp',a=>a.map(c=>({w:+c.dataset.w,n:+c.dataset.n,mean:+c.dataset.mean,cy:+c.getAttribute('cy')})));
const kpi=pg=>pg.$$eval('.hb-t',a=>Object.fromEntries(a.map(t=>[t.dataset.k,t.querySelector('b').textContent])));
const sel=pg=>pg.evaluate(()=>({t:document.querySelector('#hbsel .hb-sm').textContent.replace(/\s+/g,' ').trim(),bars:[...document.querySelectorAll('#hbsel .hb-bar')].map(b=>({real:b.classList.contains('real'),pct:b.querySelector('b').textContent,w:parseFloat(b.querySelector('i').style.width)})),sr:document.querySelector('#hbsel .hb-sr').textContent}));
(async()=>{
 /* the test's own chances against the ones Python wrote */
 {let worst=0,n=0;for(const id of Object.keys(E.leagues)){const by=new Map(chances(id).map(m=>[m.id,m]));for(const [mid,p] of Object.entries(E.leagues[id].pred)){const m=by.get(mid);if(!m){worst=9;continue}for(let k=0;k<3;k++)worst=Math.max(worst,Math.abs(m.p[k]-p[k]));n++}}
  ok(n>400&&worst<2e-4,'the chances worked out here equal the ones Python wrote in elo_own.json for '+n+' matches of six leagues (largest difference '+worst.toExponential(1)+')')}
 const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/heartbeat'});await pg.waitForSelector('.hb-m1',{timeout:90000});await pg.waitForTimeout(2600);
 let ms=season(LG,cur),n=ms.length;
 /* every dot of the current season */
 let got=await dots(pg);const by=new Map(ms.map(m=>[m.id,m]));
 ok(got.length===n&&got.every(g=>by.has(g.id)),cur+': one dot per match ('+n+')');
 ok(got.every(g=>{const m=by.get(g.id);return g.o===m.o&&Math.abs(g.bits-m.bits)<2e-4}),'each dot has its real result and its bits (-log2 of the chance Elo gave it)');
 ok(got.every(g=>{const m=by.get(g.id);return g.cls.includes(['hb-h','hb-d','hb-a'][m.o])&&Math.abs(g.r-(2.4+Math.min(m.hg+m.ag,8)*.75))<.01}),'colour = the result, size = the goals in the match');
 {const s=got.slice().sort((a,b)=>a.bits-b.bits||a.cy-b.cy);let mono=true;for(let i=1;i<s.length;i++)if(s[i].cy>s[i-1].cy+.06)mono=false;ok(mono,'the more surprising the result, the higher the dot');
  const vb=await pg.$eval('.hb-svg',e=>({width:e.viewBox.baseVal.width,height:e.viewBox.baseVal.height}));ok(vb.width>=480&&got.every(g=>g.cx>=0&&g.cx<=vb.width&&g.cy>=0&&g.cy<=vb.height),'every dot is inside the chart');
  const byx=got.slice().sort((a,b)=>a.cx-b.cx).map(g=>by.get(g.id).d);ok(byx.every((d,i)=>!i||byx[i-1]<=d),'the dots run left to right in date order')}
 /* the weekly line */
 let W=weeks(ms),wp=await wpts(pg);
 ok(wp.length===W.length&&W.every((w,i)=>wp[i].w===w.w&&wp[i].n===w.n&&Math.abs(wp[i].mean-w.mean)<2e-4),cur+': '+W.length+' weeks, each with its number of matches and its mean bits');
 ok(W.reduce((s,w)=>s+w.n,0)===n,'the weeks hold every match once');
 const pathPts=(await pg.$eval('.hb-pl',e=>e.getAttribute('d').match(/[ML]/g).length));ok(pathPts===W.length,'the line has one point per week');
 /* the four counts, the calmest and wildest weeks, the eight biggest shocks */
 const fav=ms.filter(m=>m.o===m.fav).length,shocks=ms.filter(m=>m.bits>=3).length,avg=ms.reduce((s,m)=>s+m.bits,0)/n,k=await kpi(pg);
 ok(k.n===String(n)&&k.fav===Math.round(fav/n*100)+'%'&&k.shock===String(shocks)&&k.avg===avg.toFixed(2),'matches '+n+', favourite happened '+k.fav+' ('+fav+' of '+n+'), shocks '+shocks+', average '+k.avg+' bits');
 {const wl=W.filter(w=>w.n>=4),calm=wl.reduce((a,w)=>w.mean<a.mean?w:a),wild=wl.reduce((a,w)=>w.mean>a.mean?w:a),t=await pg.innerText('.hb-pu');
  ok(t.includes('Calmest week: '+iso(calm.w*7-3)+' ('+calm.n+' matches, '+calm.mean.toFixed(2)+' bits')&&t.includes('Wildest week: '+iso(wild.w*7-3)+' ('+wild.n+' matches, '+wild.mean.toFixed(2)+' bits'),'calmest week '+iso(calm.w*7-3)+' ('+calm.mean.toFixed(2)+'), wildest '+iso(wild.w*7-3)+' ('+wild.mean.toFixed(2)+')')}
 {const big=ms.slice().sort((a,b)=>b.bits-a.bits||cmp(a.d,b.d)||cmp(a.id,b.id)).slice(0,8),lst=await pg.$$eval('.hb-bl button',a=>a.map(x=>({id:x.dataset.id,pct:x.querySelector('b').textContent,txt:x.querySelector('.hb-n').textContent})));
  ok(JSON.stringify(lst.map(x=>[x.id,x.pct]))===JSON.stringify(big.map(m=>[m.id,Math.round(m.q*100)+'%'])),'the eight biggest shocks, in order, with the chance Elo gave each ('+big[0].h+' '+big[0].hg+'–'+big[0].ag+' '+big[0].a+', '+Math.round(big[0].q*100)+'%)');
  ok(lst.every((x,i)=>x.txt===big[i].h+' '+big[i].hg+'–'+big[i].ag+' '+big[i].a),'each line names the teams and the score');
  /* the panel starts on the biggest shock */
  let s=await sel(pg);ok(s.t.startsWith(big[0].h+' '+big[0].hg+'–'+big[0].ag+' '+big[0].a)&&s.bars.length===3&&s.bars.every((x,i)=>x.pct===Math.round(big[0].p[i]*100)+'%'&&Math.abs(x.w-big[0].p[i]*100)<.06)&&s.bars[big[0].o].real&&s.bars.filter(x=>x.real).length===1,'the panel opens on the biggest shock: three chances, the real result marked');
  ok(s.sr.includes('had a '+Math.round(big[0].q*100)+'% chance: '+big[0].bits.toFixed(2)+' bits'),'it says how many bits of surprise');
  /* press another shock in the list */
  await pg.click('.hb-bl button[data-id="'+big[3].id+'"]');await pg.waitForTimeout(150);s=await sel(pg);
  ok(s.t.startsWith(big[3].h+' '+big[3].hg+'–'+big[3].ag+' '+big[3].a)&&await pg.$$eval('.hb-m1.sel',a=>a.length===1&&a[0].dataset.id)===big[3].id&&await pg.$eval('.hb-bl button.on',e=>e.dataset.id)===big[3].id,'a shock in the list opens in the panel and its dot is marked');
  /* click a dot */
  const any=ms.find(m=>m.id!==big[3].id&&m.o===1);await pg.click('.hb-m1[data-id="'+any.id+'"]',{force:true});await pg.waitForTimeout(150);s=await sel(pg);
  ok(s.t.startsWith(any.h+' '+any.hg+'–'+any.ag+' '+any.a)&&s.bars.every((x,i)=>x.pct===Math.round(any.p[i]*100)+'%')&&s.bars[1].real,'clicking a dot opens its match (a draw: the draw bar is the real one)');
  /* hover another one, and let go */
  const other=ms.find(m=>m.id!==any.id&&m.o===2);await pg.hover('.hb-m1[data-id="'+other.id+'"]',{force:true});await pg.waitForTimeout(150);s=await sel(pg);
  ok(s.t.startsWith(other.h+' '+other.hg+'–'+other.ag+' '+other.a),'hovering a dot shows its match');
  await pg.mouse.move(2,2);await pg.waitForTimeout(150);s=await sel(pg);ok(s.t.startsWith(any.h+' '+any.hg+'–'+any.ag+' '+any.a),'moving away goes back to the match that was clicked')}
 /* Only shocks: the dots with 3+ bits stay, the weekly line is still every week */
 await pg.click('#hbsh button[data-k="shock"]');await pg.waitForTimeout(300);
 got=await dots(pg);ok(got.length===shocks&&got.every(g=>g.bits>=3),'Only shocks: '+shocks+' dots, all of them 3 bits or more');
 ok((await wpts(pg)).length===W.length,'the weekly line still has all '+W.length+' weeks');
 ok(await pg.$eval('#hbsh button[data-k="shock"]',e=>e.getAttribute('aria-pressed')==='true'&&e.classList.contains('on'))&&!!(await pg.$('#hbsh .lgx-g')),'the choice is marked and has the glass');
 await pg.click('#hbsh button[data-k="all"]');await pg.waitForTimeout(300);
 /* a finished season, and the first season's warning */
 ok(!(await pg.$('.hb-warm')),'the current season has no warm-up note');
 const fin='2025-26',si=F.leagues[LG].seasons.findIndex(s=>s.s===fin);await pg.selectOption('#hbs',String(si));await pg.waitForTimeout(2200);
 ms=season(LG,fin);n=ms.length;got=await dots(pg);const by2=new Map(ms.map(m=>[m.id,m]));
 ok(n===380&&got.length===380&&got.every(g=>{const m=by2.get(g.id);return m&&g.o===m.o&&Math.abs(g.bits-m.bits)<2e-4}),fin+': 380 dots, each with its result and its bits');
 W=weeks(ms);wp=await wpts(pg);ok(wp.length===W.length&&W.every((w,i)=>wp[i].n===w.n&&Math.abs(wp[i].mean-w.mean)<2e-4),fin+': '+W.length+' weeks, matches and mean bits recomputed');
 {const k2=await kpi(pg),f2=ms.filter(m=>m.o===m.fav).length,s2=ms.filter(m=>m.bits>=3).length;ok(k2.n==='380'&&k2.fav===Math.round(f2/380*100)+'%'&&k2.shock===String(s2),fin+': favourite happened '+k2.fav+', shocks '+s2);
  ok(!/so far/.test(await pg.innerText('.hb-t[data-k="n"]')),'a finished season does not say "so far"')}
 const first=F.leagues[LG].seasons[0].s;await pg.selectOption('#hbs','0');await pg.waitForTimeout(2200);ms=season(LG,first);
 ok((await dots(pg)).length===ms.length&&!!(await pg.$('.hb-warm'))&&/first season/.test(await pg.innerText('.hb-warm')),first+': the first season of the chain says its early chances are guesses');
 {const e0=ms.slice(0,40).reduce((s,m)=>s+m.bits,0)/40;ok(e0>0,'(its first 40 matches average '+e0.toFixed(2)+' bits)')}
 /* another league, with its own seasons */
 const L2='l_0ErfuF',c2=F.leagues[L2].seasons[F.leagues[L2].seasons.length-1].s;await pg.selectOption('#hbg',L2);await pg.waitForTimeout(2200);
 ms=season(L2,c2);got=await dots(pg);const by3=new Map(ms.map(m=>[m.id,m]));
 ok(JSON.stringify(await pg.$$eval('#hbs option',a=>a.map(o=>o.textContent)))===JSON.stringify(F.leagues[L2].seasons.map(s=>s.s)),'LaLiga\'s seasons: '+F.leagues[L2].seasons.map(s=>s.s).join(', '));
 ok(got.length===ms.length&&got.every(g=>{const m=by3.get(g.id);return m&&g.o===m.o&&Math.abs(g.bits-m.bits)<2e-4}),'LaLiga '+c2+': '+ms.length+' dots recomputed');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a[a.length-1]==='#/heartbeat'&&a.indexOf('#/timemachine')===a.length-2&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/heartbeat'}),'the page is the last tab of the Season hub, after Time machine, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving before the data arrives */
 {const c2_=await b.newContext();await c2_.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2_.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/heartbeat');await p2.waitForSelector('#hbroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#hbroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2_.close()}
 /* a failing file is not kept */
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/heartbeat');
  await p3.waitForSelector('#hbroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#hbroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/heartbeat'});await p3.waitForSelector('.hb-m1',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.hb-m1')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 /* reduced motion: nothing is animated, nothing is missing */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/heartbeat'}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.waitForSelector('.hb-m1',{timeout:90000});await pg.waitForTimeout(400);
 ok(await pg.$eval('.hb-pl',e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).strokeDashoffset!=='1')&&await pg.$eval('.hb-m1',e=>getComputedStyle(e).animationName==='none')&&await pg.$eval('.hb-beat',e=>getComputedStyle(e).animationName==='none'),'reduced motion: the line and dots are there at once, the beat does not pulse');
 await ctx.close();
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/heartbeat'}));await pg.waitForSelector('.hb-m1',{timeout:90000});await pg.waitForTimeout(2500);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok((await dots(pg)).length===season(LG,cur).length,lang+' phone: every dot is drawn');
  ok(await pg.$$eval('.hb-bl button',a=>a.every(x=>x.scrollWidth<=x.clientWidth+1)),lang+' phone: the list of shocks fits');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/نبض الدوري/.test(await pg.textContent('#app h2')),'Arabic title');
   ok(/أهدأ أسبوع/.test(await pg.innerText('.hb-pu'))&&/أجنن أسبوع/.test(await pg.innerText('.hb-pu')),'Arabic: calmest and wildest week');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/hb_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
