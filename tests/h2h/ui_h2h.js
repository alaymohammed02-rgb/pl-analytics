/* Head to head (assets/head-to-head.js): two clubs of one league. The record, the goals, the biggest wins, the home records, the last five and every meeting are recomputed
   here from data/results.json with loops of their own. The Elo lines come from sync.py's own el2_run (run in Python: ratings after each match and final), first compared with
   data/elo_own.json (which Python wrote), then with the chart's polylines (number of points, a straight-line fit of y on the rating and of x on the day number, the ratings
   printed) and the chances of a meeting today on each ground and for the next scheduled match. Also: the pair the page opens with (the league's next match), a pair that has
   not met, swapping, another league, the Compare hub tab after XI Battle, Arabic, 390 px, leaving early, a failing results file and a failing schedule file. */
const T=require('../nf/lib.js');const {ok,J}=T;const {execFileSync}=require('child_process');const path=require('path');
const ROOT=path.join(__dirname,'..','..');
const F=J('results.json'),X=J('fixtures.json'),E=J('elo_own.json'),cmp=(a,b)=>a<b?-1:a>b?1:0,P=F.params;
const dayNo=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
const EL=JSON.parse(execFileSync('python3',['-c',`import re,json,sys,datetime,os,math
src=open(${JSON.stringify(path.join(ROOT,'sync.py'))},encoding='utf-8').read()
G={'re':re,'json':json,'datetime':datetime,'os':os,'math':math,'log':print,'run_pipeline':lambda *a,**k:1,'gh_get_json':None,'gh_put':None}
exec(src[src.index('# ===== ELO2 START ====='):src.index('# ===== ELO2 END =====')],G)
r=json.load(open(${JSON.stringify(path.join(ROOT,'data','results.json'))}))
out={}
for lid,L in r['leagues'].items():
    ms=[(x[0],L['teams'][x[1]],L['teams'][x[2]],x[3],x[4],x[5]) for s in L['seasons'] for x in s['m']]
    R,h,rows=G['el2_run'](ms,r['params'])
    out[lid]={'R':R,'h':h}
print(json.dumps(out))`],{maxBuffer:1<<28}).toString());
function league(id){const L=F.leagues[id],list=[];L.seasons.forEach(s=>s.m.forEach(x=>list.push({d:x[0],h:L.teams[x[1]],a:L.teams[x[2]],hg:x[3],ag:x[4],id:x[5],s:s.s})));return list.sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id))}
function clubs(id){const L=F.leagues[id],s=L.seasons[L.seasons.length-1],set=new Set();s.m.forEach(x=>{set.add(L.teams[x[1]]);set.add(L.teams[x[2]])});return [...set].sort(cmp)}
function rec(id,a,b){const ms=league(id).filter(m=>(m.h===a&&m.a===b)||(m.h===b&&m.a===a));
 const r={n:ms.length,aw:0,d:0,bw:0,ag:0,bg:0,ah:[0,0,0],bh:[0,0,0],ab:null,bb:null,list:ms.slice().reverse()};
 for(const m of ms){const ga=m.h===a?m.hg:m.ag,gb=m.h===a?m.ag:m.hg;r.ag+=ga;r.bg+=gb;ga>gb?r.aw++:ga<gb?r.bw++:r.d++;
  const H=m.h===a?r.ah:r.bh;m.hg>m.ag?H[0]++:m.hg===m.ag?H[1]++:H[2]++;
  const better=(c,f,x)=>!c||f-x>c.f-c.x||(f-x===c.f-c.x&&f>c.f);
  if(ga>gb&&better(r.ab,ga,gb))r.ab={f:ga,x:gb,m};if(gb>ga&&better(r.bb,gb,ga))r.bb={f:gb,x:ga,m}}
 return r}
const big=(c,t)=>c?(c.m.h===t?`${c.m.hg}–${c.m.ag} ${c.m.a}`:`${c.m.h} ${c.m.hg}–${c.m.ag}`)+' · '+c.m.d:'–';
const probs=dr=>{const x=dr/P.s,ph=1/(1+Math.exp(-(x-P.c))),pa=1-1/(1+Math.exp(-(x+P.c)));return [ph,1-ph-pa,pa]};
const pc=x=>Math.round(x*100)+'%';
const strip=s=>s.replace(/[\u2066-\u2069\u200e\u200f]/g,'').replace(/\u2011/g,'-');
function line(pts){const n=pts.length,mx=pts.reduce((s,p)=>s+p[0],0)/n,my=pts.reduce((s,p)=>s+p[1],0)/n;let sxx=0,sxy=0,syy=0;for(const [x,y] of pts){sxx+=(x-mx)**2;sxy+=(x-mx)*(y-my);syy+=(y-my)**2}return sxy*sxy/(sxx*syy)}
const poly=(pg,c)=>pg.$eval('.h2-ln.'+c,e=>({n:+e.dataset.n,last:+e.dataset.last,pts:e.getAttribute('points').split(' ').map(p=>p.split(',').map(Number))}));
async function check(pg,id,a,b,label,lang){
 const R0=rec(id,a,b);
 const sc=await pg.$$eval('.h2-sc b',e=>e.map(x=>+x.textContent));
 if(R0.n){
  ok(sc.length===3&&sc[0]===R0.aw&&sc[1]===R0.d&&sc[2]===R0.bw,label+': '+a+' '+R0.aw+' wins, '+R0.d+' draws, '+b+' '+R0.bw+' wins over '+R0.n+' meetings');
  const t=await pg.$$eval('.h2-t tbody tr',a=>a.map(r=>({k:r.dataset.k,c:[...r.children].map(x=>x.textContent.replace(/[⁦-⁩‎‏]/g,'').trim())})));
  const g=k=>t.find(x=>x.k===k).c;
  ok(g('g')[0]===String(R0.ag)&&g('g')[2]===String(R0.bg)&&g('w')[0]===String(R0.aw)&&g('w')[2]===String(R0.bw)&&g('d')[0]===String(R0.d),label+': goals '+R0.ag+'–'+R0.bg+', wins and draws in the table');
  ok(g('h')[0]===R0.ah.join('-')&&g('h')[2]===R0.bh.join('-'),label+': home records '+R0.ah.join('-')+' and '+R0.bh.join('-'));
  const bg=(await pg.$$eval('.h2-bg',e=>e.map(x=>x.textContent))).map(x=>strip(x).replace(/\s+/g,' ').trim());
  ok(bg[0]===big(R0.ab,a)&&bg[1]===big(R0.bb,b),label+': biggest wins "'+bg[0]+'" and "'+bg[1]+'"');
  const m=await pg.$$eval('.h2-m',e=>e.map(r=>({id:r.dataset.id,k:r.dataset.k})));
  ok(m.length===R0.n&&R0.list.every((x,i)=>{const ga=x.h===a?x.hg:x.ag,gb=x.h===a?x.ag:x.hg;return m[i].id===x.id&&m[i].k===(ga>gb?'a':ga<gb?'b':'d')}),label+': every meeting, newest first, coloured by result');
  const l5=await pg.$$eval('.h2-f',e=>e.map(x=>({id:x.dataset.id,c:x.className})));
  ok(l5.length===Math.min(5,R0.n)&&l5.every((f,i)=>{const x=R0.list[i],ga=x.h===a?x.hg:x.ag,gb=x.h===a?x.ag:x.hg;return f.id===x.id&&f.c.includes(ga>gb?'w':ga<gb?'l':'d')}),label+': the last five from '+a+'\'s side');
  ok(await pg.$$eval('.h2-mk',e=>e.length)===R0.n,label+': a tick on the chart for each of the '+R0.n+' meetings');
 }else ok((lang==='ar'?/ما التقوا/:/have not met/).test(await pg.innerText('#h2rec'))&&!(await pg.$('.h2-m')),label+': a pair that has not met says so and lists nothing');
 /* Elo lines */
 const H=EL[id].h;
 for(const [c,t] of [['a',a],['b',b]]){const p=await poly(pg,c),hh=H[t];
  ok(p.n===hh.length&&p.pts.length===hh.length,label+': '+t+' line has '+hh.length+' points');
  ok(Math.abs(p.last-hh[hh.length-1][1])<0.06&&Math.abs(p.last-EL[id].R[t])<0.06,label+': '+t+' ends at '+EL[id].R[t].toFixed(1));
  ok(line(p.pts.map((q,i)=>[q[1],hh[i][1]]))>0.99999&&line(p.pts.map((q,i)=>[q[0],dayNo(hh[i][0])]))>0.99999,label+': '+t+' points sit on a straight line of rating (y) and of date (x)')}
 const ra=EL[id].R[a],rb=EL[id].R[b];
 ok((await pg.innerText('#h2ra'))===String(Math.round(ra))&&(await pg.innerText('#h2rb'))===String(Math.round(rb)),label+': printed ratings '+Math.round(ra)+' and '+Math.round(rb));
 const hA=probs(ra-rb+P.H),hB=probs(rb-ra+P.H),bars=await pg.$$eval('.h2-ch',e=>e.map(c=>({h:parseFloat(c.querySelector('.h2-cb').style.getPropertyValue('--h')),d:parseFloat(c.querySelector('.h2-cb').style.getPropertyValue('--d')),t:[...c.querySelectorAll('.h2-cl b')].map(x=>x.textContent)})));
 ok(Math.abs(bars[0].h-hA[0]*100)<0.01&&Math.abs(bars[0].d-hA[1]*100)<0.01&&bars[0].t.join()===[pc(hA[0]),pc(hA[1]),pc(hA[2])].join(),label+': chances at '+a+': '+bars[0].t.join(' / '));
 ok(Math.abs(bars[1].h-hB[0]*100)<0.01&&bars[1].t.join()===[pc(hB[0]),pc(hB[1]),pc(hB[2])].join(),label+': chances at '+b+': '+bars[1].t.join(' / '));
 const fx=X.leagues[id].filter(x=>(x.h===a&&x.a===b)||(x.h===b&&x.a===a)).sort((p,q)=>cmp(p.k||p.d,q.k||q.d))[0];
 const nx=await pg.$('.h2-nx');
 if(fx){const pr=fx.h===a?hA:[hB[0],hB[1],hB[2]],tx=nx?strip(await nx.innerText()):'';ok(!!nx&&(await nx.getAttribute('data-i'))===fx.i&&tx.includes(fx.d)&&(lang==='ar'?[0,1,2].every(k=>tx.includes(pc(pr[k]))):tx.includes(pc(pr[0])+', a draw '+pc(pr[1])+' and '+(fx.h===a?b:a)+' '+pc(pr[2]))),label+': the next scheduled meeting ('+fx.h+' v '+fx.a+', '+fx.d+') with its chances')}
 else ok(!nx&&/No meeting between them is in the schedule/.test(await pg.innerText('#h2pr')),label+': no scheduled meeting says so');
}
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',LL='l_0ErfuF';
 /* the reference first: Python's final ratings against the file Python wrote */
 {let worst=0,n=0;for(const id of Object.keys(E.leagues))for(const [t,o] of Object.entries(E.leagues[id].teams)){if(EL[id].R[t]!=null){n++;worst=Math.max(worst,Math.abs(EL[id].R[t]-o.r))}}
  ok(n>100&&worst<0.11,'the reference ratings equal data/elo_own.json for '+n+' clubs (largest difference '+worst.toFixed(3)+')')}
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/h2h'});await pg.waitForSelector('.h2-ln',{timeout:90000});await pg.waitForTimeout(500);
 const nxt=X.leagues[LG].slice().sort((p,q)=>cmp(p.k||p.d,q.k||q.d)).find(x=>clubs(LG).includes(x.h)&&clubs(LG).includes(x.a));
 ok(await pg.$eval('#h2a',e=>e.value)===nxt.h&&await pg.$eval('#h2b',e=>e.value)===nxt.a,'the page opens on the league\'s next match: '+nxt.h+' against '+nxt.a);
 await check(pg,LG,nxt.h,nxt.a,'next match');
 /* the pair with the most meetings among current clubs, and one pair that has not met */
 const cl=clubs(LG);let best=null,none=null;for(const x of cl)for(const y of cl){if(x>=y)continue;const n=rec(LG,x,y).n;if(!best||n>best.n)best={x,y,n};if(n===0&&!none)none={x,y}}
 await pg.selectOption('#h2a',best.x);await pg.selectOption('#h2b',best.y);await pg.waitForTimeout(300);await check(pg,LG,best.x,best.y,'most meetings');
 await pg.click('#h2sw');await pg.waitForTimeout(300);ok(await pg.$eval('#h2a',e=>e.value)===best.y&&await pg.$eval('#h2b',e=>e.value)===best.x,'swap: the two clubs change places');await check(pg,LG,best.y,best.x,'swapped');
 if(none){await pg.selectOption('#h2a',none.x);await pg.selectOption('#h2b',none.y);await pg.waitForTimeout(300);await check(pg,LG,none.x,none.y,'never met')}
 /* choosing the same club for both: the other one is changed, never two equal */
 await pg.selectOption('#h2b',best.x);await pg.selectOption('#h2a',best.x);await pg.waitForTimeout(300);ok(await pg.$eval('#h2a',e=>e.value)!==await pg.$eval('#h2b',e=>e.value),'the same club cannot be chosen twice');
 /* another league */
 await pg.selectOption('#h2g',LL);await pg.waitForTimeout(400);
 {const a=await pg.$eval('#h2a',e=>e.value),c=await pg.$eval('#h2b',e=>e.value);ok(clubs(LL).includes(a)&&clubs(LL).includes(c)&&a!==c,'LaLiga: two of its clubs ('+a+', '+c+')');await check(pg,LL,a,c,'LaLiga')}
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/h2h')===a.indexOf('#/battle')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/h2h'}),'the page is the Compare hub tab after XI Battle, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/h2h');await p2.waitForSelector('#h2root',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#h2root'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/h2h');
  await p3.waitForSelector('#h2root .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#h2root');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/h2h'});await p3.waitForSelector('.h2-ln',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.h2-ln')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 {const c4=await b.newContext();await c4.route(/fixtures\.json/,r=>r.fulfill({status:500,body:''}));const p4=await c4.newPage(),e4=[];p4.on('pageerror',e=>e4.push(e.message));await p4.goto('http://127.0.0.1:8765/index.html#/h2h');
  await p4.waitForSelector('.h2-ln',{timeout:90000});await p4.waitForTimeout(300);ok(!(await p4.$('.h2-nx'))&&/No meeting between them is in the schedule/.test(await p4.innerText('#h2pr'))&&!e4.length,'without the schedule file the page still works and says there is no scheduled meeting');await c4.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/h2h'}));await pg.waitForSelector('.h2-ln',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$eval('.h2-svg',e=>e.getBoundingClientRect().width<=innerWidth),lang+' phone: the chart fits the screen');
  await check(pg,LG,nxt.h,nxt.a,lang+' phone',lang);
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/المواجهات السابقة/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
