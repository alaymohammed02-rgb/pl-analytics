/* Matches that matter (assets/stakes.js). Three layers. 1) The simulation engine on a toy league of six clubs and three unplayed pairings, whose chances of the title, the
   top four and the bottom three are enumerated exactly over all 27 outcomes (and over the 9 outcomes left when one pairing is fixed): the engine's numbers agree within
   Monte Carlo error with 20,000 simulations, and the three fixed scenarios average (weighted by the pairing's own chances) back to the base chances. 2) The page's numbers for the
   next scheduled matches of the Premier League recomputed here with an engine of its own (different generator, fresh draws for every scenario, 20,000 simulations, ratings from sync.py's
   el2_run in Python, points from data/results.json): every "now", home-win, draw and away-win figure within 0.04, the swing equal to the largest minus the smallest shown, the
   headline the biggest swing, the order by stakes and by date, the fixtures that are chosen, Elo's chances. 3) The page: another league, the sort buttons, the Matches hub tab after
   Late show, Arabic, 390 px, leaving early, a failing results file, a failing schedule file. */
const T=require('../nf/lib.js');const {ok,J}=T;const {execFileSync}=require('child_process');const path=require('path');
const ROOT=path.join(__dirname,'..','..');
const F=J('results.json'),X=J('fixtures.json'),P=F.params,cmp=(a,b)=>a<b?-1:a>b?1:0;
const EL=JSON.parse(execFileSync('python3',['-c',`import re,json,sys,datetime,os,math
src=open(${JSON.stringify(path.join(ROOT,'sync.py'))},encoding='utf-8').read()
G={'re':re,'json':json,'datetime':datetime,'os':os,'math':math,'log':print,'run_pipeline':lambda *a,**k:1,'gh_get_json':None,'gh_put':None}
exec(src[src.index('# ===== ELO2 START ====='):src.index('# ===== ELO2 END =====')],G)
r=json.load(open(${JSON.stringify(path.join(ROOT,'data','results.json'))}))
out={}
for lid,L in r['leagues'].items():
    ms=[(x[0],L['teams'][x[1]],L['teams'][x[2]],x[3],x[4],x[5]) for s in L['seasons'] for x in s['m']]
    R,h,rows=G['el2_run'](ms,r['params'])
    out[lid]=R
print(json.dumps(out))`],{maxBuffer:1<<28}).toString());
const pr=dr=>{const z=dr/P.s,h=1/(1+Math.exp(-(z-P.c))),a=1-1/(1+Math.exp(-(z+P.c)));return [h,1-h-a,a]};
/* a generator that is not the page's: xorshift128 */
function xs(seed){let a=seed|0||123456789,b=362436069,c=521288629,d=88675123;return ()=>{let t=a^(a<<11);a=b;b=c;c=d;d=(d^(d>>>19))^(t^(t>>>8));return (d>>>0)/4294967296}}
/* exact chances for the toy league */
function exact(base,R0,names,pairs,fixed){
 const n=base.length,out=base.map(()=>[0,0,0]);
 const rank=pts=>{const o=[...Array(n).keys()].sort((x,y)=>pts[y]-pts[x]||R0[y]-R0[x]||cmp(names[x],names[y]));return o};
 const rec=(j,pts,w)=>{
  if(j===pairs.length){const o=rank(pts);out[o[0]][0]+=w;for(let k=0;k<4;k++)out[o[k]][1]+=w;for(let k=n-3;k<n;k++)out[o[k]][2]+=w;return}
  const [h,a,p]=pairs[j];
  for(let oc=0;oc<3;oc++){const w2=(fixed&&fixed.j===j)?(oc===fixed.o?w:0):w*p[oc];if(!w2)continue;const q=pts.slice();if(oc===0)q[h]+=3;else if(oc===1){q[h]++;q[a]++}else q[a]+=3;rec(j+1,q,w2)}};
 rec(0,base,1);return out}
const dayNum=0;
/* the page's engine's inputs for a league from the test's own data */
function inputs(id){const L=F.leagues[id],cur=L.seasons[L.seasons.length-1],names=[...new Set(cur.m.flatMap(x=>[L.teams[x[1]],L.teams[x[2]]]))].sort(cmp),ix={};names.forEach((t,i)=>ix[t]=i);
 const base=names.map(()=>0),played=new Set();
 for(const x of cur.m){const h=ix[L.teams[x[1]]],a=ix[L.teams[x[2]]];played.add(h+'|'+a);if(x[3]>x[4])base[h]+=3;else if(x[3]<x[4])base[a]+=3;else{base[h]++;base[a]++}}
 const R0=names.map(t=>EL[id][t]),pairs=[],pidx={};
 names.forEach((h,hi)=>names.forEach((a,ai)=>{if(hi===ai||played.has(hi+'|'+ai))return;pidx[h+'|'+a]=pairs.length;pairs.push([hi,ai,pr(R0[hi]-R0[ai]+P.H)])}));
 return {names,base,R0,pairs,pidx,cur,played:cur.m.length}}
/* an independent Monte Carlo: fresh draws for every scenario */
function mc(inp,fixed,S,seed){const n=inp.names.length,rnd=xs(seed),c=inp.names.map(()=>[0,0,0]);
 for(let s=0;s<S;s++){const pts=inp.base.slice();
  inp.pairs.forEach(([h,a,p],j)=>{let oc;if(fixed&&fixed.j===j)oc=fixed.o;else{const u=rnd();oc=u<p[0]?0:u<p[0]+p[1]?1:2}if(oc===0)pts[h]+=3;else if(oc===1){pts[h]++;pts[a]++}else pts[a]+=3});
  const o=[...Array(n).keys()].sort((x,y)=>pts[y]-pts[x]||inp.R0[y]-inp.R0[x]||cmp(inp.names[x],inp.names[y]));c[o[0]][0]++;for(let k=0;k<4;k++)c[o[k]][1]++;for(let k=n-3;k<n;k++)c[o[k]][2]++}
 return c.map(r=>r.map(v=>v/S))}
const pcT=x=>x>0&&x<0.005?'<1%':x<1&&x>0.995?'>99%':Math.round(x*100)+'%';
const pts=x=>x>0&&x<0.005?'<1':String(Math.round(x*100));
const mdata=pg=>pg.$$eval('.sk-m',a=>a.map(m=>({i:m.dataset.i,swing:+m.dataset.swing,open:m.open,low:m.classList.contains('sk-lo'),t:m.querySelector('.sk-t').textContent,badge:m.querySelector('.sk-s').textContent.replace(/[⁦-⁩]/g,'').trim(),
 rows:[...m.querySelectorAll('.sk-r')].map(r=>({c:r.dataset.c,t:r.dataset.t,now:+r.dataset.now,h:+r.dataset.h,d:+r.dataset.d,a:+r.dataset.a,cells:[...r.children].slice(2).map(x=>x.textContent.replace(/[⁦-⁩]/g,'').trim())}))})));
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',LL='l_0ErfuF';
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/table'});await pg.waitForSelector('#app h2',{timeout:60000});await pg.evaluate(()=>{location.hash='#/stakes'});await pg.waitForSelector('.sk-m',{timeout:120000});await pg.waitForTimeout(300);
 /* 1) the engine on a toy league */
 {const names=['A','B','C','D','E','F'],base=[9,8,8,5,4,2],R0=[1600,1550,1500,1500,1450,1400];
  const mk=(h,a)=>{const p=pr(R0[h]-R0[a]+P.H);return [h,a,p[0],p[0]+p[1],p]};
  const prs=[mk(0,1),mk(2,3),mk(4,5)];
  const e=await pg.evaluate(async ([names,base,R0,prs])=>{const r=await INS.stakes.engine({n:6,names,base,R0,pairs:prs,fix:[0,1,2],sims:20000,seed:'toy',stop:null});return r},[names,base,R0,prs]);
  const pairs=prs.map(p=>[p[0],p[1],p[4]]);
  const ex=exact(base,R0,names,pairs,null);let worst=0;
  for(let i=0;i<6;i++)for(let t=0;t<3;t++)worst=Math.max(worst,Math.abs(e.base[i][t]-ex[i][t]));
  ok(worst<0.02,'toy league: the engine\'s base chances of title, top four and bottom three equal the exact enumeration of 27 outcomes (largest gap '+worst.toFixed(4)+')');
  let w2=0,w3=0;
  for(let k=0;k<3;k++)for(let oc=0;oc<3;oc++){const fx=exact(base,R0,names,pairs,{j:k,o:oc});for(let i=0;i<6;i++)for(let t=0;t<3;t++)w2=Math.max(w2,Math.abs(e.sc[k][oc][i][t]-fx[i][t]))}
  ok(w2<0.02,'toy league: with one pairing fixed as a home win, a draw and an away win, all 9 scenarios equal the exact enumeration (largest gap '+w2.toFixed(4)+')');
  for(let k=0;k<3;k++)for(let i=0;i<6;i++)for(let t=0;t<3;t++){let s=0;for(let oc=0;oc<3;oc++)s+=pairs[k][2][oc]*e.sc[k][oc][i][t];w3=Math.max(w3,Math.abs(s-e.base[i][t]))}
  ok(w3<0.02,'toy league: the three scenarios of a pairing, weighted by its own chances, average back to the base chances (largest gap '+w3.toFixed(4)+')');
  ok(e.base.every(r=>r.every(v=>v>=0&&v<=1))&&Math.abs(e.base.reduce((s,r)=>s+r[0],0)-1)<1e-9&&Math.abs(e.base.reduce((s,r)=>s+r[1],0)-4)<1e-9&&Math.abs(e.base.reduce((s,r)=>s+r[2],0)-3)<1e-9,'toy league: one champion, four clubs in the top four and three in the bottom three in every simulation')}
 /* 2) the page against an engine of the test's own */
 const inp=inputs(LG),fx=[];
 for(const x of X.leagues[LG].slice().sort((p,q)=>cmp(p.k||p.d,q.k||q.d)||cmp(p.i,q.i))){const j=inp.pidx[x.h+'|'+x.a];if(j!=null&&fx.length<12)fx.push({...x,j})}
 let md=await mdata(pg);
 ok(md.length===fx.length&&new Set(md.map(m=>m.i)).size===fx.length&&fx.every(f=>md.some(m=>m.i===f.i)),'the page lists the '+fx.length+' next scheduled matches that are still to be played ('+(X.leagues[LG].length)+' in the file)');
 ok(inp.pairs.length===380-inp.played,'pairings still to play = 380 − '+inp.played+' played = '+inp.pairs.length);
 {const bySwing=md.every((m,i)=>i===0||m.swing<=md[i-1].swing+1e-9);ok(bySwing,'ordered by the biggest swing, largest first');}
 {const base=mc(inp,null,20000,7);let worst=0,cnt=0;
  const pick=[...md.slice(0,3),md[md.length-1]];
  for(const m of pick){const f=fx.find(z=>z.i===m.i),sc=[0,1,2].map(o=>mc(inp,{j:f.j,o},20000,100+o+f.j));
   for(const r of m.rows){const ci=inp.names.indexOf(r.c),t={title:0,top4:1,bot3:2}[r.t];
    const want=[base[ci][t],sc[0][ci][t],sc[1][ci][t],sc[2][ci][t]],got=[r.now,r.h,r.d,r.a];
    for(let k=0;k<4;k++){worst=Math.max(worst,Math.abs(want[k]-got[k]));cnt++}}}
  ok(worst<0.04,'now / home win / draw / away win for '+cnt+' figures of 4 matches agree with an independent 20,000-simulation engine (largest gap '+worst.toFixed(4)+')')}
 ok(md.every(m=>{const f=fx.find(z=>z.i===m.i),sw=m.rows.map(r=>Math.max(r.h,r.d,r.a)-Math.min(r.h,r.d,r.a));return m.rows.length===6&&Math.abs(m.swing-Math.max(...sw))<1e-4&&m.badge===pts(Math.max(...sw))&&m.rows.every((r,i)=>r.cells[4]===pts(sw[i])&&r.cells[0]===pcT(r.now)&&r.cells[1]===pcT(r.h)&&r.cells[2]===pcT(r.d)&&r.cells[3]===pcT(r.a))}),'every match: six rows (two clubs, three targets), the swing = the largest minus the smallest of the three shown, the badge = the biggest swing, the cells = the stored numbers');
 ok(md.every(m=>m.rows.every(r=>r.now>=0&&r.now<=1&&r.h>=0&&r.h<=1)),'all chances are between 0 and 1');
 {let w=0;for(const m of md){const f=fx.find(z=>z.i===m.i),p=inp.pairs[f.j][2];for(const r of m.rows){const pH=r.c===inp.names[inp.pairs[f.j][0]]?p:[p[2],p[1],p[0]];const h=r.c===inp.names[inp.pairs[f.j][0]],ws=h?[r.h,r.d,r.a]:[r.a,r.d,r.h];void ws;}
   /* law of total probability from the club's own side */
   for(const r of m.rows){const s=p[0]*r.h+p[1]*r.d+p[2]*r.a;w=Math.max(w,Math.abs(s-r.now))}}
  ok(w<0.03,'in every row, the three scenarios weighted by Elo\'s chances of the match average back to the "now" figure (largest gap '+w.toFixed(4)+')')}
 {const t=await pg.$$eval('.sk-m .sk-p',e=>e.map(x=>x.textContent.replace(/[⁦-⁩]/g,'')));let good=0;md.forEach((m,i)=>{const f=fx.find(z=>z.i===m.i),p=inp.pairs[f.j][2];if(t[i].includes(pcT(p[0])+' · draw '+pcT(p[1])+' · ')&&t[i].includes(pcT(p[2])+'.'))good++});
  ok(good===md.length,'Elo\'s chances of each match (from sync.py\'s ratings) are printed: '+good+' of '+md.length)}
 ok(md.slice(0,3).every(m=>m.open||m.low)&&md.slice(3).every(m=>!m.open),'by stakes the first three matches are open and the rest folded');
 /* the headline names the club and target of the biggest swing */
 {const lines=await pg.$$eval('.sk-m .sk-l',e=>e.map(x=>x.textContent.replace(/[⁦-⁩]/g,'')));
  ok(md.every((m,i)=>{if(m.low)return /Little is at stake/.test(lines[i]);const top=m.rows.reduce((a,r)=>{const s=Math.max(r.h,r.d,r.a)-Math.min(r.h,r.d,r.a),as=Math.max(a.h,a.d,a.a)-Math.min(a.h,a.d,a.a);return s>as+1e-12?r:a});return lines[i].startsWith(top.c+':')}),'each headline names the club and target with the biggest swing')}
 /* sort by date */
 await pg.click('#skso button[data-k="date"]');await pg.waitForTimeout(300);md=await mdata(pg);
 ok(md.length===fx.length&&md.every((m,i)=>m.i===fx[i].i),'ordered by date, the matches follow the schedule');
 ok(await pg.$eval('#skso button[data-k="date"]',e=>e.classList.contains('on')&&e.getAttribute('aria-pressed')==='true'),'the chosen order is marked');
 /* another league */
 await pg.selectOption('#skg',LL);await pg.waitForFunction(()=>document.querySelector('#skg').value==='l_0ErfuF'&&document.querySelector('.sk-m'),null,{timeout:120000});await pg.waitForTimeout(600);
 {const i2=inputs(LL),f2=[];for(const x of X.leagues[LL].slice().sort((p,q)=>cmp(p.k||p.d,q.k||q.d)||cmp(p.i,q.i))){const j=i2.pidx[x.h+'|'+x.a];if(j!=null&&f2.length<12)f2.push(x)}
  const m2=await mdata(pg);ok(m2.length===f2.length&&f2.every((f,i)=>m2[i].i===f.i),'LaLiga: its '+f2.length+' next matches, by date');
  const c=mc(i2,null,20000,9);let w=0;for(const m of m2.slice(0,3))for(const r of m.rows){const ci=i2.names.indexOf(r.c),t={title:0,top4:1,bot3:2}[r.t];w=Math.max(w,Math.abs(c[ci][t]-r.now))}
  ok(w<0.04,'LaLiga: the "now" figures agree with the independent engine (largest gap '+w.toFixed(4)+')')}
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/stakes')===a.indexOf('#/late')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/stakes'}),'the page is the Matches hub tab after Late show, marked open');
 ok(!!(await pg.$('#skso .lgx-g')),'the order choice has the glass');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/stakes');await p2.waitForSelector('#skroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#skroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/stakes');
  await p3.waitForSelector('#skroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#skroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/stakes'});await p3.waitForSelector('.sk-m',{timeout:120000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.sk-m')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 {const c4=await b.newContext();await c4.route(/fixtures\.json/,r=>r.fulfill({status:500,body:''}));const p4=await c4.newPage(),e4=[];p4.on('pageerror',e=>e4.push(e.message));await p4.goto('http://127.0.0.1:8765/index.html#/stakes');
  await p4.waitForSelector('#skbody .empty:not(.skel)',{timeout:90000});ok(!(await p4.$('.sk-m'))&&/None of the next scheduled matches/.test(await p4.innerText('#skbody'))&&!e4.length,'without the schedule file the page says there is nothing to analyse');await c4.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/table'}));await pg.waitForSelector('#app h2',{timeout:60000});await pg.evaluate(()=>{location.hash='#/stakes'});await pg.waitForSelector('.sk-m',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  const m=await mdata(pg);ok(m.length===fx.length&&m.every((x,i)=>i===0||x.swing<=m[i-1].swing+1e-9),lang+' phone: the same matches in the same order');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/مباريات تهمّ/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
