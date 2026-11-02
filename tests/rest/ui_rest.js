/* Rest days (assets/rest-days.js): does the number of days since a club's last league match change its points against Elo's expectation? The chances before every
   match come from sync.py's own el2_run (run here in Python on data/results.json); the test then makes its own bands of rest and averages, so the page rests on a second
   implementation. Checked: every band's club-matches, average, standard error and reading for all leagues and for one league, the regression on the difference of rest,
   the verdict following those numbers, the shortest turnarounds before the next scheduled matches, the Teams hub tab after Fortress, Arabic, 390 px, leaving early and a
   failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;const {execFileSync}=require('child_process');const path=require('path');
const ROOT=path.join(__dirname,'..','..');
const F=J('results.json'),X=J('fixtures.json'),cmp=(a,b)=>a<b?-1:a>b?1:0;
const dayNo=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
const PRE=JSON.parse(execFileSync('python3',['-c',`import re,json,sys,datetime,os,math
src=open(${JSON.stringify(path.join(ROOT,'sync.py'))},encoding='utf-8').read()
G={'re':re,'json':json,'datetime':datetime,'os':os,'math':math,'log':print,'run_pipeline':lambda *a,**k:1,'gh_get_json':None,'gh_put':None}
exec(src[src.index('# ===== ELO2 START ====='):src.index('# ===== ELO2 END =====')],G)
r=json.load(open(${JSON.stringify(path.join(ROOT,'data','results.json'))}))
out={}
for lid,L in r['leagues'].items():
    ms=[(x[0],L['teams'][x[1]],L['teams'][x[2]],x[3],x[4],x[5]) for s in L['seasons'] for x in s['m']]
    R,h,rows=G['el2_run'](ms,r['params'])
    out[lid]={row[1]:row[4] for row in rows}
print(json.dumps(out))`],{maxBuffer:1<<28}).toString());
const BANDS=[[0,3],[4,4],[5,5],[6,6],[7,7],[8,10],[11,999]];
function league(id){const L=F.leagues[id],list=[];L.seasons.forEach(s=>s.m.forEach(x=>list.push({d:x[0],h:L.teams[x[1]],a:L.teams[x[2]],hg:x[3],ag:x[4],id:x[5],s:s.s})));
 return list.sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id))}
function expect(ids){
 const val=BANDS.map(()=>[]),xs=[],ys=[];let all=0,sum=0;
 for(const id of ids){const ms=league(id),first=F.leagues[id].seasons[0].s,last={};
  for(const m of ms){const p=PRE[id][m.id],eh=3*p[0]+p[1],ea=3*p[2]+p[1],ph=m.hg>m.ag?3:m.hg===m.ag?1:0,pa=m.ag>m.hg?3:m.hg===m.ag?1:0,dn=dayNo(m.d);
   const rest=t=>last[t]&&last[t].s===m.s?dn-last[t].d:null,rh=rest(m.h),ra=rest(m.a);
   if(m.s!==first){
    [[rh,ph-eh],[ra,pa-ea]].forEach(([r,res])=>{if(r==null)return;const k=BANDS.findIndex(b=>r>=b[0]&&r<=b[1]);val[k].push(res);all++;sum+=res});
    if(rh!=null&&ra!=null&&rh<=14&&ra<=14){xs.push(rh-ra);ys.push((ph-eh)-(pa-ea))}}
   last[m.h]={d:dn,s:m.s};last[m.a]={d:dn,s:m.s}}}
 const bands=val.map(v=>{const n=v.length,mean=n?v.reduce((a,b)=>a+b,0)/n:null,sd=n>1?Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/(n-1)):null;return {n,mean,se:sd==null?null:sd/Math.sqrt(n)}});
 const n=xs.length,mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;let sxx=0,sxy=0,syy=0;for(let i=0;i<n;i++){sxx+=(xs[i]-mx)**2;sxy+=(xs[i]-mx)*(ys[i]-my);syy+=(ys[i]-my)**2}
 const b=sxy/sxx,se=Math.sqrt((syy-b*sxy)/(n-2)/sxx);
 return {bands,sl:{n,b,se},all,mean:sum/all};
}
const rows=pg=>pg.$$eval('.rd-r',a=>a.map(r=>({lo:+r.dataset.lo,n:+r.dataset.n,m:r.dataset.m==null?null:+r.dataset.m,se:r.dataset.se==null?null:+r.dataset.se,read:r.lastElementChild.querySelector('.fx-en').textContent.trim(),out:!!r.querySelector('.rd-d.out')})));
const reading=(m,se)=>Math.abs(m)<1.96*se?'within noise':m>0?'above Elo':'below Elo';
function same(got,E,label){
 ok(got.length===7&&got.every((g,i)=>g.lo===BANDS[i][0]&&g.n===E.bands[i].n),label+': seven bands with '+E.bands.map(b=>b.n).join(', ')+' club-matches');
 ok(got.every((g,i)=>Math.abs(g.m-E.bands[i].mean)<1e-4&&Math.abs(g.se-E.bands[i].se)<1e-4),label+': average points above Elo '+E.bands.map(b=>(b.mean>=0?'+':'')+b.mean.toFixed(3)).join(', ')+' and standard errors match');
 ok(got.every((g,i)=>g.read===reading(E.bands[i].mean,E.bands[i].se)&&g.out===(g.read!=='within noise')),label+': each reading follows 1.96 standard errors ('+got.map(g=>g.read.replace(' Elo','')).join(', ')+')')}
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',LL='l_0ErfuF',ALL=Object.keys(F.leagues);
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/rest'});await pg.waitForSelector('.rd-r',{timeout:90000});await pg.waitForTimeout(500);
 let E=expect(ALL);
 same(await rows(pg),E,'all leagues');
 {const s=await pg.$eval('.rd-sl',e=>({b:+e.dataset.b,se:+e.dataset.se,n:+e.dataset.n}));
  ok(s.n===E.sl.n&&Math.abs(s.b-E.sl.b)<1e-4&&Math.abs(s.se-E.sl.se)<1e-4,'regression on the difference of rest: '+E.sl.b.toFixed(4)+' points per day ± '+E.sl.se.toFixed(4)+' over '+E.sl.n+' matches')}
 {const t=await pg.innerText('#rdv');ok(t.includes(E.all+' club-matches with a rest value')&&t.includes('close to zero'),'the card counts '+E.all+' club-matches and the overall average ('+E.mean.toFixed(3)+')');
  const anyOut=E.bands.some(b=>Math.abs(b.mean)>=1.96*b.se),slOut=Math.abs(E.sl.b)>=1.96*E.sl.se;
  ok(anyOut||slOut?/Something differs/.test(t):/No sign that the break matters/.test(t),'the verdict follows the numbers ('+(anyOut||slOut?'something differs':'no sign that the break matters')+')');
  if(!(anyOut||slOut))ok(t.includes('up to about '+(1.96*E.bands[0].se).toFixed(2)+' points'),'it names how large an effect the sample could miss ('+(1.96*E.bands[0].se).toFixed(2)+' points)')}
 ok(Math.abs(E.mean)<0.02,'Elo is calibrated on these club-matches: the overall average is '+E.mean.toFixed(4));
 /* another league */
 await pg.selectOption('#rdg',LL);await pg.waitForTimeout(400);E=expect([LL]);same(await rows(pg),E,'LaLiga');
 ok(/LaLiga/.test(await pg.innerText('#rdv h3')),'the result card names the league');
 /* the coming matches (facts) of the open league */
 await pg.selectOption('#rdg','all');await pg.waitForTimeout(300);
 {const L=F.leagues[LG],last={};for(const s of L.seasons)for(const x of s.m){for(const t of [L.teams[x[1]],L.teams[x[2]]])if(!last[t]||x[0]>last[t])last[t]=x[0]}
  const seen=new Set(),want=[];for(const x of X.leagues[LG].slice().sort((a,b)=>cmp(a.k||a.d,b.k||b.d)||cmp(a.i,b.i)))for(const t of [x.h,x.a]){if(seen.has(t))continue;seen.add(t);if(!last[t])continue;const days=dayNo(x.d)-dayNo(last[t]);if(days>=0)want.push({t,days,d:x.d})}
  want.sort((a,b)=>a.days-b.days||cmp(a.d,b.d)||cmp(a.t,b.t));
  const got=await pg.$$eval('.rd-cr',a=>a.map(r=>({t:r.dataset.t,days:+r.dataset.days})));
  ok(got.length===Math.min(8,want.length)&&got.every((g,i)=>g.t===want[i].t&&g.days===want[i].days),'the 8 shortest turnarounds before the next matches of the Premier League match: '+got.slice(0,3).map(g=>g.t+' '+g.days).join(', ')+'…')}
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/rest')===a.indexOf('#/fortress')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/rest'}),'the page is the Teams hub tab after Fortress, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/rest');await p2.waitForSelector('#rdroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#rdroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/rest');
  await p3.waitForSelector('#rdroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#rdroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/rest'});await p3.waitForSelector('.rd-r',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.rd-r')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 /* without the schedule file the coming-matches table says so and the rest still works */
 {const c4=await b.newContext();await c4.route(/fixtures\.json/,r=>r.fulfill({status:500,body:''}));const p4=await c4.newPage(),e4=[];p4.on('pageerror',e=>e4.push(e.message));await p4.goto('http://127.0.0.1:8765/index.html#/rest');
  await p4.waitForSelector('.rd-r',{timeout:90000});await p4.waitForTimeout(300);ok(!(await p4.$('.rd-cr'))&&/No scheduled match/.test(await p4.innerText('#rdroot'))&&!e4.length,'without the schedule the bands still show and the turnaround table says there is nothing to compare');await c4.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/rest'}));await pg.waitForSelector('.rd-r',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  same(await rows(pg),expect(ALL),lang+' phone');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/أيام الراحة/.test(await pg.textContent('#app h2')),'Arabic title');
   ok(/ما فيه دليل إن الراحة تفرق|فيه شي يختلف/.test(await pg.innerText('#rdv')),'Arabic: the verdict');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
