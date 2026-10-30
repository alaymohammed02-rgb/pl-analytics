/* Time machine (assets/time-machine.js): every row of the projection table recomputed here from data/results.json with an implementation of its
   own (Elo from the matches before the day, the pull to the mean at a new season, expected points over the pairings left, 4,000 seeded simulated
   seasons for the title, the top four and the bottom three), the "then", "final" and "now" columns, the scorecard of a finished season (average
   error against points per game, the champion's chance, the surprises) and of the season under way (matches since the day, Brier), the quick
   buttons and the slider, another league, the test card against the file, the Season hub tab, Arabic, 390 px, leaving early, a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('results.json'),P=F.params,SIMS=4000,cmp=(a,b)=>a<b?-1:a>b?1:0;
const dec=id=>{const L=F.leagues[id];const ss=L.seasons.map(s=>({s:s.s,ms:s.m.map(x=>({d:x[0],h:L.teams[x[1]],a:L.teams[x[2]],hg:x[3],ag:x[4],id:x[5]}))}));return {id,ss,all:ss.flatMap(s=>s.ms).sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id))}};
const yr=d=>+d.slice(5,7)>=7?+d.slice(0,4):+d.slice(0,4)-1;
function elo(all,upto){let R={},last=null;
 for(const m of all){if(!(m.d<upto))break;const y=yr(m.d);if(last!==null&&y!==last){const mu=Object.values(R).reduce((s,x)=>s+x,0)/Object.keys(R).length;for(const t in R)R[t]=mu+(1-P.reg)*(R[t]-mu)}last=y;
  for(const t of [m.h,m.a])if(!(t in R)){const v=Object.values(R);R[t]=v.length?v.reduce((s,x)=>s+x,0)/v.length:1500}
  const e=1/(1+10**(-(R[m.h]-R[m.a]+P.H)/400)),gd=Math.abs(m.hg-m.ag),k=P.K*(gd<=1?1:gd===2?1.5:(11+gd)/8)*((m.hg>m.ag?1:m.hg===m.ag?.5:0)-e);R[m.h]+=k;R[m.a]-=k}
 if(last!==null&&last!==yr(upto)){const mu=Object.values(R).reduce((s,x)=>s+x,0)/Object.keys(R).length;for(const t in R)R[t]=mu+(1-P.reg)*(R[t]-mu)}return R}
const pr=dr=>{const z=dr/P.s,h=1/(1+Math.exp(-(z-P.c))),a=1-1/(1+Math.exp(-(z+P.c)));return [h,1-h-a,a]};
function tab(ms,clubs){const t={};clubs.forEach(c=>t[c]={c,p:0,g:0,gd:0,gf:0});for(const m of ms){const h=t[m.h],a=t[m.a];h.g++;a.g++;h.gf+=m.hg;a.gf+=m.ag;h.gd+=m.hg-m.ag;a.gd+=m.ag-m.hg;h.p+=m.hg>m.ag?3:m.hg===m.ag?1:0;a.p+=m.ag>m.hg?3:m.hg===m.ag?1:0}
 return Object.values(t).sort((x,y)=>y.p-x.p||y.gd-x.gd||y.gf-x.gf||cmp(x.c,y.c))}
function seed(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}let a=h;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function want(id,si,upto){const L=dec(id),sm=L.ss[si].ms,clubs=[...new Set(sm.flatMap(m=>[m.h,m.a]))].sort(cmp),n=clubs.length,R=elo(L.all,upto),v=Object.values(R),mu=v.length?v.reduce((s,x)=>s+x,0)/v.length:1500,r=c=>c in R?R[c]:mu;
 const done=sm.filter(m=>m.d<upto),then=tab(done,clubs),pl=new Set(done.map(m=>m.h+'|'+m.a)),ex={},fx=[];then.forEach(x=>ex[x.c]=x.p);
 for(const h of clubs)for(const a of clubs){if(h===a||pl.has(h+'|'+a))continue;const p=pr(r(h)-r(a)+P.H);fx.push([clubs.indexOf(h),clubs.indexOf(a),p[0],p[0]+p[1]]);ex[h]+=3*p[0]+p[1];ex[a]+=3*p[2]+p[1]}
 const rnd=seed(id+'|'+L.ss[si].s+'|'+upto),c=clubs.map(()=>[0,0,0]),base=clubs.map(x=>then.find(y=>y.c===x).p),R0=clubs.map(r);
 for(let s=0;s<SIMS;s++){const p=base.slice();for(const f of fx){const u=rnd();if(u<f[2])p[f[0]]+=3;else if(u<f[3]){p[f[0]]++;p[f[1]]++}else p[f[1]]+=3}
  const o=clubs.map((_,i)=>i).sort((x,y)=>p[y]-p[x]||R0[y]-R0[x]||cmp(clubs[x],clubs[y]));c[o[0]][0]++;for(let k=0;k<4;k++)c[o[k]][1]++;for(let k=n-3;k<n;k++)c[o[k]][2]++}
 const fin=sm.length===n*(n-1),final=fin?tab(sm,clubs):null,now=fin?null:tab(sm,clubs);
 const rows=clubs.map((x,i)=>({c:x,r:r(x),ex:ex[x],t:c[i][0]/SIMS,f:c[i][1]/SIMS,b:c[i][2]/SIMS})).sort((a,b)=>b.ex-a.ex||b.r-a.r||cmp(a.c,b.c));
 return {L,sm,clubs,n,G:2*(n-1),then,rows,final,now,done,later:sm.filter(m=>m.d>=upto),r,mu}}
const pcT=x=>x>0&&x<0.005?'<1%':x<1&&x>0.995?'>99%':Math.round(x*100)+'%',f1=x=>(+x).toFixed(1);
function rowsWant(W){const pos=(L,c)=>L.findIndex(x=>x.c===c)+1;return W.rows.map(x=>{const th=W.then.find(y=>y.c===x.c),f=W.final||W.now,fr=f.find(y=>y.c===x.c);
 return [x.c,pos(W.then,x.c)+'. '+th.p+' pts',String(Math.round(x.r)),f1(x.ex),pcT(x.t),pcT(x.f),pcT(x.b),pos(f,x.c)+'. '+fr.p+(W.final?'':' ('+fr.g+')')]})}
const shown=pg=>pg.evaluate(()=>[...document.querySelectorAll('.tmc-t tbody tr')].map(r=>[...r.cells].map(c=>{const k=c.cloneNode(true);k.querySelectorAll('.fx-ar').forEach(x=>x.remove());return k.textContent.replace(/[\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim()})));
const day=pg=>pg.evaluate(()=>document.querySelector('.tmc-sl b').textContent.trim());
const until=(pg,d)=>pg.waitForFunction(d=>{const b=document.querySelector('.tmc-sl b');return b&&b.textContent.trim()===d},d,{timeout:30000}).catch(()=>null);
const sc=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return e?e.querySelector('.fx-en').textContent.replace(/\s+/g,' ').trim():null},s);
(async()=>{const b=await T.launch(),LG='l_4WFCIZ';
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/timemachine'});await pg.waitForSelector('.tmc-t tbody tr',{timeout:90000});
 /* default: the season under way, half way through its match days */
 let L=dec(LG),si=L.ss.length-1,dates=[...new Set(L.ss[si].ms.map(m=>m.d))].sort(),D0=dates[Math.floor(dates.length/2)],W=want(LG,si,D0);
 ok(await day(pg)===D0,'opens on the season under way ('+L.ss[si].s+'), half way through its match days: '+D0);
 let got=await shown(pg),exp=rowsWant(W);if(JSON.stringify(got)!==JSON.stringify(exp))console.log(JSON.stringify(got[0]),JSON.stringify(exp[0]));ok(JSON.stringify(got)===JSON.stringify(exp),'all '+exp.length+' rows (then, Elo, expected, title, top 4, bottom 3, now) match an independent recomputation; top: '+exp[0].slice(0,5).join(' '));
 {const since=W.later,e={},a={};W.clubs.forEach(c=>{e[c]=0;a[c]=0});let br=0,bb=0;const pre=W.L.all.filter(m=>m.d<D0),rate=[0,1,2].map(k=>pre.filter(m=>(m.hg>m.ag?0:m.hg===m.ag?1:2)===k).length/pre.length);
  for(const m of since){const p=pr(W.r(m.h)-W.r(m.a)+P.H),o=m.hg>m.ag?0:m.hg===m.ag?1:2;e[m.h]+=3*p[0]+p[1];e[m.a]+=3*p[2]+p[1];a[m.h]+=o===0?3:o===1?1:0;a[m.a]+=o===2?3:o===1?1:0;br+=p.reduce((s,x,k)=>s+(x-(k===o?1:0))**2,0);bb+=rate.reduce((s,x,k)=>s+(x-(k===o?1:0))**2,0)}
  const mae=W.clubs.reduce((s,c)=>s+Math.abs(e[c]-a[c]),0)/W.n,t=await sc(pg,'.tmc-so');
  ok(t===`Since ${D0}, ${since.length} matches have been played. The points the model expected from them were ${f1(mae)} off per club on average. Brier score of those matches (lower is better): ${(br/since.length).toFixed(3)}, against ${(bb/since.length).toFixed(3)} for the league's usual win / draw / loss rates.`,'season under way: the matches since the day ('+since.length+'), points error '+f1(mae)+', Brier '+(br/since.length).toFixed(3)+' against '+(bb/since.length).toFixed(3))}
 /* a finished season, three quarters through (quick button) */
 const s2=L.ss.findIndex(s=>s.s==='2025-26');await pg.selectOption('#tms',String(s2));
 const sm2=L.ss[s2].ms.slice().sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id)),D2=sm2[Math.floor(.75*sm2.length)].d;
 await pg.click('.tmc-q button[data-f="0.75"]');await until(pg,D2);W=want(LG,s2,D2);
 ok(await day(pg)===D2,'2025-26, "Three quarters": the day of the match at three quarters of the season ('+D2+')');
 got=await shown(pg);exp=rowsWant(W);ok(JSON.stringify(got)===JSON.stringify(exp),'2025-26: all rows, with the real final table, match ('+exp[0].slice(0,5).join(' ')+')');
 {const fp=c=>W.final.find(x=>x.c===c).p,mE=W.rows.reduce((s,x)=>s+Math.abs(x.ex-fp(x.c)),0)/W.n,then=c=>W.then.find(x=>x.c===c),mP=W.clubs.reduce((s,c)=>s+Math.abs(then(c).p/then(c).g*W.G-fp(c)),0)/W.n;
  ok(await sc(pg,'.tmc-mae')===`From ${D2}, the model's final points were ${f1(mE)} points off per club on average; "points per game so far × ${W.G} games" was ${f1(mP)} off.`,'finished season: average error '+f1(mE)+' against '+f1(mP)+' for points per game');
  const ch=W.final[0].c,cr=W.rows.find(x=>x.c===ch);ok(await sc(pg,'.tmc-ch')===`The champion, ${ch}, had a ${pcT(cr.t)} title chance on that day.`,'the champion '+ch+' had '+pcT(cr.t));
  const su=W.rows.map(x=>({c:x.c,d:fp(x.c)-x.ex})).sort((a,b)=>b.d-a.d||cmp(a.c,b.c)),sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(1);
  ok(await sc(pg,'.tmc-su')===`Did better than expected: ${su.slice(0,2).map(x=>`${x.c} (${sg(x.d)})`).join(', ')}. Did worse: ${su.slice(-2).reverse().map(x=>`${x.c} (${sg(x.d)})`).join(', ')}.`,'surprises: '+su[0].c+' '+sg(su[0].d)+', '+su[su.length-1].c+' '+sg(su[su.length-1].d))}
 /* the slider: the first day of the season (no match played yet, ratings pulled to the mean) */
 await pg.$eval('#tmd',e=>{e.value='0';e.dispatchEvent(new Event('input'))});const D3=[...new Set(L.ss[s2].ms.map(m=>m.d))].sort()[0];await until(pg,D3);
 W=want(LG,s2,D3);got=await shown(pg);ok(JSON.stringify(got)===JSON.stringify(rowsWant(W))&&got.every(r=>/ 0 pts$/.test(r[1])),'the slider to the first day ('+D3+'): nothing played, the projection is the ratings alone, and it matches');
 /* another league */
 const L2='l_0ErfuF';await pg.selectOption('#tml',L2);const Lb=dec(L2),sb=Lb.ss.length-1,db=[...new Set(Lb.ss[sb].ms.map(m=>m.d))].sort(),Db=db[Math.floor(db.length/2)];await until(pg,Db);
 W=want(L2,sb,Db);ok(JSON.stringify(await shown(pg))===JSON.stringify(rowsWant(W)),'LaLiga '+Lb.ss[sb].s+' on '+Db+': all rows match');
 ok(JSON.stringify(await pg.$$eval('#tms option',a=>a.map(o=>o.textContent)))===JSON.stringify(Lb.ss.map(s=>s.s)),'LaLiga\'s seasons: '+Lb.ss.map(s=>s.s).join(', '));
 /* the test card */
 const t=F.test,tx=await sc(pg,'.tmc-test p'),rows=await pg.$$eval('.tmc-tt tbody tr',a=>a.map(r=>[r.dataset.k,...[...r.cells].slice(1).map(c=>c.textContent.trim())]));
 ok(tx.includes(`On ${t.all['0.5'].seasons} finished seasons`)&&tx.includes(`were ${t.all['0.5'].elo} points off per club, against ${t.all['0.5'].ppg}`)&&tx.includes(`${t.new['0.5'].elo} against ${t.new['0.5'].ppg}`),'the test sentence: half way '+t.all['0.5'].elo+' against '+t.all['0.5'].ppg+', from 2025-26 '+t.new['0.5'].elo+' against '+t.new['0.5'].ppg);
 ok(JSON.stringify(rows)===JSON.stringify(['0.25','0.5','0.75'].map(k=>[k,String(t.all[k].elo),String(t.all[k].ppg),String(t.all[k].n)])),'the test table: the three checkpoints as in the file');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a[a.length-2]==='#/timemachine'&&a[a.length-1]==='#/heartbeat'&&a.indexOf('#/luck')===a.indexOf('#/sim')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/timemachine'}),'the page is the tab before the League heartbeat, the last two of the Season hub (the Luck table stays after the simulator), marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/timemachine');await p2.waitForSelector('#tmroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#tmroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/results\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/timemachine');
  await p3.waitForSelector('#tmroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#tmroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/timemachine'});await p3.waitForSelector('.tmc-t',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.tmc-t')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/timemachine'});await pg.waitForSelector('.tmc-t tbody tr',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>{const t=document.querySelector('.tmc-t');return t.scrollWidth<=t.parentNode.clientWidth+1}),lang+' phone: the projection table fits without scrolling');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/آلة الزمن/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/tm_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
