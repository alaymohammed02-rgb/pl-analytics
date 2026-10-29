/* Title race (assets/title-race.js): the table of a season week by week. Every row recomputed here from data/results.json with an implementation of its own
   (weeks cut by day number, the table as of the end of each week: points, goal difference, goals scored, name): position, points, played / won / drawn /
   lost, goal difference, bar width, for the first, a middle and the last week, a finished season (its last week is the real final table and the champion),
   another league; the rows sit where the transform says; the move marks between two weeks; play (4×) goes forward and stops at the end, pause stops it;
   Bars and Table views; following a club (click and Enter); the Season hub tab; Arabic, 390 px, leaving early, a failing file, reduced motion. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('results.json'),cmp=(a,b)=>a<b?-1:a>b?1:0;
const dayNo=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
/* a Monday-based week number: the 1st of January 1970 was a Thursday */
const wk=d=>Math.floor((dayNo(d)+3)/7);
function season(id,s){const L=F.leagues[id],S=L.seasons.find(x=>x.s===s),ms=S.m.map(x=>({d:x[0],h:L.teams[x[1]],a:L.teams[x[2]],hg:x[3],ag:x[4]})),teams=[...new Set(ms.flatMap(m=>[m.h,m.a]))].sort(cmp);
 const weeks=[...new Set(ms.map(m=>wk(m.d)))].sort((a,b)=>a-b);return {ms,teams,weeks,N:ms.length,maxEnd:null}}
function tab(Q,fi){const up=Q.ms.filter(m=>wk(m.d)<=Q.weeks[fi]),t={};Q.teams.forEach(c=>t[c]={c,g:0,w:0,d:0,l:0,gf:0,ga:0,p:0});
 for(const m of up){const h=t[m.h],a=t[m.a];h.g++;a.g++;h.gf+=m.hg;h.ga+=m.ag;a.gf+=m.ag;a.ga+=m.hg;if(m.hg>m.ag){h.p+=3;h.w++;a.l++}else if(m.hg<m.ag){a.p+=3;a.w++;h.l++}else{h.p++;a.p++;h.d++;a.d++}}
 return Object.values(t).sort((x,y)=>y.p-x.p||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||cmp(x.c,y.c))}
const sgn=x=>(x>0?'+':x<0?'−':'')+Math.abs(x);
const shown=pg=>pg.$$eval('.rc-row',a=>a.map(r=>({c:r.dataset.t,pos:+r.dataset.pos,pts:+r.dataset.pts,tr:r.style.transform,g:r.querySelector('.rc-p').textContent,w:r.querySelector('.rc-w').textContent,d:r.querySelector('.rc-d').textContent,l:r.querySelector('.rc-lo').textContent,gd:r.querySelector('.rc-gd').textContent,bar:parseFloat(r.querySelector('.rc-b i').style.width),mv:r.querySelector('.rc-mv').textContent,rank:r.querySelector('.rc-r').textContent})).sort((x,y)=>x.pos-y.pos));
function want(Q,fi){const t=tab(Q,fi),max=Math.max(1,...Q.weeks.map((_,i)=>tab(Q,i)[0].p));return t.map((x,i)=>({c:x.c,pos:i+1,pts:x.p,tr:`translateY(${i*40}px)`,g:String(x.g),w:String(x.w),d:String(x.d),l:String(x.l),gd:sgn(x.gf-x.ga),bar:+(x.p/max*100).toFixed(2),rank:String(i+1)}))}
const slim=r=>({c:r.c,pos:r.pos,pts:r.pts,tr:r.tr,g:r.g,w:r.w,d:r.d,l:r.l,gd:r.gd,bar:r.bar,rank:r.rank});
const setWeek=async(pg,i)=>{await pg.$eval('#rcw',(e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input'))},i);await pg.waitForTimeout(200)};
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',cur=F.leagues[LG].seasons[F.leagues[LG].seasons.length-1].s;
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/race'});await pg.waitForSelector('.rc-row',{timeout:90000});await pg.waitForTimeout(900);
 /* the current season, last week */
 let Q=season(LG,cur),last=Q.weeks.length-1;
 ok(+await pg.$eval('#rcw',e=>e.max)===last&&+await pg.$eval('#rcw',e=>e.value)===last,'the slider has one step per week ('+(last+1)+' weeks of '+cur+'), on the last');
 let got=(await shown(pg)).map(slim),exp=want(Q,last);
 ok(JSON.stringify(got)===JSON.stringify(exp),'last week of '+cur+': position, points, played, won, drawn, lost, goal difference and bar of every club match ('+exp[0].c+' '+exp[0].pts+')');
 ok(await pg.$$eval('.rc-row',a=>a.every(r=>{const p=+r.dataset.pos;return Math.abs(r.getBoundingClientRect().top-a.find(x=>x.dataset.pos==='1').getBoundingClientRect().top-(p-1)*40)<=1.5})),'every row sits at its place in the list (40 px apart, in order of position)');
 ok(/Week to \d{4}-\d\d-\d\d · \d+ of \d+ matches/.test(await pg.innerText('#rcl'))&&(await pg.innerText('#rcl')).includes(Q.N+' of '+Q.N+' matches'),'the label names the week and the matches played ('+Q.N+' of '+Q.N+')');
 ok(!/champions/.test(await pg.innerText('#rce'))&&/lead with/.test(await pg.innerText('#rce')),'an unfinished season says who leads, not who won');
 /* a middle week, then the next one: the move marks */
 const mid=Math.floor(last/2);await setWeek(pg,mid);got=(await shown(pg)).map(slim);exp=want(Q,mid);
 ok(JSON.stringify(got)===JSON.stringify(exp),'week '+(mid+1)+': every row matches');
 await setWeek(pg,mid+1);const before=want(Q,mid),after=want(Q,mid+1),sh=await shown(pg),mvOk=sh.every(r=>{const d=before.find(x=>x.c===r.c).pos-after.find(x=>x.c===r.c).pos;return r.mv===(d>0?'▲'+d:d<0?'▼'+(-d):'')});
 ok(mvOk&&sh.some(r=>r.mv),'move marks between week '+(mid+1)+' and '+(mid+2)+': ▲ n / ▼ n equals the places gained or lost ('+sh.filter(r=>r.mv).length+' clubs moved)');
 /* a finished season ends in its real final table, with the champion */
 const fin='2025-26',Qf=season(LG,fin),lf=Qf.weeks.length-1;await pg.selectOption('#rcs',String(F.leagues[LG].seasons.findIndex(s=>s.s===fin)));await pg.waitForTimeout(500);
 got=(await shown(pg)).map(slim);exp=want(Qf,lf);ok(JSON.stringify(got)===JSON.stringify(exp),fin+' (finished): the last of '+(lf+1)+' weeks matches, '+exp[0].c+' on '+exp[0].pts);
 ok(Qf.N===Qf.teams.length*(Qf.teams.length-1),fin+': all '+Qf.N+' matches are in the last week, so it is the real final table');
 {const fl=(()=>{const t={};Qf.teams.forEach(c=>t[c]={c,p:0,gd:0,gf:0});for(const m of Qf.ms){const h=t[m.h],a=t[m.a];h.gf+=m.hg;a.gf+=m.ag;h.gd+=m.hg-m.ag;a.gd+=m.ag-m.hg;h.p+=m.hg>m.ag?3:m.hg===m.ag?1:0;a.p+=m.ag>m.hg?3:m.hg===m.ag?1:0}return Object.values(t).sort((x,y)=>y.p-x.p||y.gd-x.gd||y.gf-x.gf||cmp(x.c,y.c))})();
  ok(JSON.stringify(got.map(r=>r.c))===JSON.stringify(fl.map(x=>x.c)),'the last week lists the clubs in the order of the final table worked out from every match ('+fl[0].c+' first)');
  ok((await pg.innerText('#rce')).includes(fl[0].c+' are the champions with '+fl[0].p+' points'),'the champion is named: '+fl[0].c+', '+fl[0].p+' points')}
 /* play: 4× goes forward and stops at the end */
 await pg.click('#rcr');await pg.waitForTimeout(200);ok(+await pg.$eval('#rcw',e=>e.value)===0,'restart goes to the first week');
 await pg.click('#rcspd button[data-s="4"]');await pg.waitForTimeout(300);ok(await pg.$eval('#rcspd button[data-s="4"]',e=>e.getAttribute('aria-pressed'))==='true','4× is chosen');
 await pg.click('#rcp');await pg.waitForTimeout(1400);const v1=+await pg.$eval('#rcw',e=>e.value);ok(v1>=3&&v1<lf,'play at 4×: the week moves on by itself ('+v1+' after 1.4 s)');
 await pg.click('#rcp');const vp=+await pg.$eval('#rcw',e=>e.value);await pg.waitForTimeout(700);ok(+await pg.$eval('#rcw',e=>e.value)===vp,'pause stops it at week '+(vp+1));
 await pg.click('#rcp');await pg.waitForFunction(l=>+document.querySelector('#rcw').value===l,lf,{timeout:30000});await pg.waitForTimeout(500);
 ok(await pg.$eval('#rcp',e=>e.textContent)==='▶'&&+await pg.$eval('#rcw',e=>e.value)===lf,'it stops by itself on the last week and the button shows play again');
 /* views */
 ok(await pg.$eval('#rcl2',e=>e.classList.contains('rc-bars'))&&await pg.$eval('.rc-row .rc-b',e=>getComputedStyle(e).display!=='none')&&await pg.$eval('.rc-row .rc-w',e=>getComputedStyle(e).display==='none'),'Bars: the bar is shown, the won / drawn / lost columns are not');
 await pg.click('#rcvw button[data-v="table"]');await pg.waitForTimeout(400);
 ok(await pg.$eval('#rcl2',e=>e.classList.contains('rc-tab'))&&await pg.$eval('.rc-row .rc-b',e=>getComputedStyle(e).display==='none')&&await pg.$eval('.rc-row .rc-w',e=>getComputedStyle(e).display!=='none')&&await pg.$eval('.rc-h',e=>getComputedStyle(e).display!=='none'),'Table: the columns and their header are shown, the bar is not');
 ok(await pg.$eval('#rcvw button[data-v="table"]',e=>e.getAttribute('aria-pressed')==='true'&&e.classList.contains('on'))&&!!(await pg.$('#rcvw .lgx-g')),'the view choice is marked and has the glass');
 /* following a club */
 const t3=exp[2].c;await pg.click('.rc-row[data-t="'+t3+'"]');await pg.waitForTimeout(250);
 ok(await pg.evaluate(t=>[...document.querySelectorAll('.rc-row')].every(r=>r.classList.contains('rc-pin')===(r.dataset.t===t)&&r.classList.contains('rc-dim')===(r.dataset.t!==t)),t3),'clicking '+t3+' follows it: it is marked, the others fade');
 await pg.click('.rc-row[data-t="'+t3+'"]');await pg.waitForTimeout(200);ok(await pg.$$eval('.rc-row.rc-pin,.rc-row.rc-dim',a=>!a.length),'clicking it again lets it go');
 await pg.focus('.rc-row[data-t="'+t3+'"]');await pg.keyboard.press('Enter');await pg.waitForTimeout(200);ok(await pg.$$eval('.rc-row.rc-pin',a=>a.length)===1,'Enter on a focused row follows it too');
 ok(await pg.$$eval('.rc-row',a=>a.every(r=>r.getAttribute('role')==='row'&&+r.getAttribute('aria-rowindex')===+r.dataset.pos&&r.getAttribute('aria-label').startsWith(r.dataset.pos+'. '))),'the rows are a table for screen readers: row index = position, the label says position, club and points');
 /* another league */
 const L2='l_0ErfuF',c2=F.leagues[L2].seasons[F.leagues[L2].seasons.length-1].s;await pg.selectOption('#rcg',L2);await pg.waitForTimeout(700);
 const Q2=season(L2,c2);got=(await shown(pg)).map(slim);exp=want(Q2,Q2.weeks.length-1);ok(JSON.stringify(got)===JSON.stringify(exp),'LaLiga '+c2+': all '+exp.length+' rows match');
 ok(JSON.stringify(await pg.$$eval('#rcs option',a=>a.map(o=>o.textContent)))===JSON.stringify(F.leagues[L2].seasons.map(s=>s.s)),'LaLiga\'s seasons: '+F.leagues[L2].seasons.map(s=>s.s).join(', '));
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/race')===a.indexOf('#/table')+1&&a.indexOf('#/sim')===a.indexOf('#/race')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/race'}),'the page is the tab after the League table in the Season hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving while it plays stops the clock */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/race'}));await pg.waitForSelector('.rc-row',{timeout:90000});await pg.click('#rcr');await pg.click('#rcspd button[data-s="4"]');await pg.click('#rcp');await pg.waitForTimeout(500);
 await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('.lt',{timeout:60000});await pg.waitForTimeout(1500);ok(!(await pg.$('#rcroot'))&&!errs.length,'leaving the page while it plays: the table is shown, no error ('+errs.slice(0,1)+')');await ctx.close();
 {const c2_=await b.newContext();await c2_.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2_.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/race');await p2.waitForSelector('#rcroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#rcroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2_.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/race');
  await p3.waitForSelector('#rcroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#rcroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/race'});await p3.waitForSelector('.rc-row',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.rc-row')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 /* reduced motion: nothing slides, the page still plays */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/race'}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.waitForSelector('.rc-row',{timeout:90000});await pg.waitForTimeout(500);
 ok(await pg.$eval('.rc-row',e=>parseFloat(getComputedStyle(e).transitionDuration)===0)&&await pg.$eval('.rc-b i',e=>parseFloat(getComputedStyle(e).transitionDuration)===0),'reduced motion: rows and bars move at once, no slide');
 await setWeek(pg,3);Q=season(LG,cur);ok(JSON.stringify((await shown(pg)).map(slim))===JSON.stringify(want(Q,3)),'reduced motion: the week still changes the table correctly');await ctx.close();
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/race'}));await pg.waitForSelector('.rc-row',{timeout:90000});await pg.waitForTimeout(600);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  await pg.click('#rcvw button[data-v="table"]');await pg.waitForTimeout(300);ok(await T.noscroll(pg)&&await pg.$$eval('.rc-row',a=>a.every(r=>r.scrollWidth<=r.clientWidth+1)),lang+' phone: the Table view fits without scrolling');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/سباق اللقب/.test(await pg.textContent('#app h2')),'Arabic title');
   ok(/الأسبوع لين/.test(await pg.textContent('#rcl'))&&/من/.test(await pg.textContent('#rcl')),'Arabic: the week label');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/race_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
