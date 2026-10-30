/* Run-in (assets/run-in.js, #/runin): for every club of a league, the pairings it has still to play this season, the points Elo expects from them (3 P(win) + P(draw), from
   data/elo_own.json's ratings and parameters), the same number of home and away games against an average opponent (the mean rating of the other clubs), the
   schedule effect, the projected final points, the next dated fixtures of data/fixtures.json and the card "Does the run-in matter?" from data/runin.json. All of it is
   recomputed here with loops of its own over ordered pairs of clubs: the rows and their data, the four orders, the squares of the next five, a club's lists (home,
   away, dated), the three tiles, the six leagues, a season with nothing left, the test card and its reading, the Season hub tab after Title race with the glass on its
   order choice, a missing fixtures file, leaving early, a failing file, Arabic, 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const F=J('results.json'),E=J('elo_own.json'),X=J('fixtures.json'),RT=J('runin.json'),cmp=(a,b)=>a<b?-1:a>b?1:0;
const P=E.params,cdf=z=>1/(1+Math.exp(-z));
/* P(home win), P(draw), P(away win) from a rating gap that already includes the home advantage */
const three=dr=>{const x=dr/P.s,w=cdf(x-P.c),l=1-cdf(x+P.c);return [w,1-w-l,l]};
const exp1=(own,opp,home)=>{const t=home?three(own-opp+P.H):three(opp-own+P.H);return home?3*t[0]+t[1]:3*t[2]+t[1]};
const win3=(own,opp,home)=>{const t=home?three(own-opp+P.H):three(opp-own+P.H);return home?t:[t[2],t[1],t[0]]};
function world(lg,FF){FF=FF||F;const L=FF.leagues[lg],cur=L.seasons[L.seasons.length-1],rt=E.leagues[lg].teams;
 const played=new Set(),pts={},seen=new Set();
 for(const m of cur.m){const h=L.teams[m[1]],a=L.teams[m[2]];played.add(h+'>'+a);seen.add(h);seen.add(a);pts[h]=(pts[h]||0)+(m[3]>m[4]?3:m[3]===m[4]?1:0);pts[a]=(pts[a]||0)+(m[4]>m[3]?3:m[3]===m[4]?1:0)}
 const teams=[...seen].filter(t=>rt[t]).sort(cmp),rate=Object.fromEntries(teams.map(t=>[t,rt[t].r])),sum=teams.reduce((s,t)=>s+rate[t],0);
 const fx=(X.leagues[lg]||[]);
 const rows=teams.map(t=>{const avg=(sum-rate[t])/(teams.length-1);let es=0,ef=0,hh=0,aa=0,os=0;const home=[],away=[];
  for(const u of teams){if(u===t)continue;
   if(!played.has(t+'>'+u)){hh++;es+=exp1(rate[t],rate[u],true);ef+=exp1(rate[t],avg,true);os+=rate[u];home.push({o:u,e:exp1(rate[t],rate[u],true),p:win3(rate[t],rate[u],true)})}
   if(!played.has(u+'>'+t)){aa++;es+=exp1(rate[t],rate[u],false);ef+=exp1(rate[t],avg,false);os+=rate[u];away.push({o:u,e:exp1(rate[t],rate[u],false),p:win3(rate[t],rate[u],false)})}}
  const next=fx.filter(f=>f.h===t||f.a===t).sort((a,b)=>cmp(a.k,b.k)||cmp(a.i,b.i)).slice(0,5).map(f=>{const hm=f.h===t,o=hm?f.a:f.h;return {i:f.i,d:f.d,o,home:hm,e:exp1(rate[t],rate[o],hm),ef:exp1(rate[t],avg,hm),p:win3(rate[t],rate[o],hm)}});
  const left=hh+aa;return {t,left,hh,aa,es,ef,sched:es-ef,now:pts[t]||0,proj:(pts[t]||0)+es,opp:left?os/left:null,home,away,next,n5:next.reduce((s,x)=>s+x.e-x.ef,0)}});
 return {rows,teams,np:played.size,name:L.name,season:cur.s}}
const ORD={hard:(a,b)=>a.sched-b.sched,easy:(a,b)=>b.sched-a.sched,proj:(a,b)=>b.proj-a.proj,next:(a,b)=>a.n5-b.n5};
const want=(W,k)=>W.rows.slice().sort((a,b)=>ORD[k](a,b)||cmp(a.t,b.t));
const sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(2),pc=x=>Math.round(x*100)+'%',lv=e=>e>=2?'g':e>=1.2?'a':'r';
const clean=s=>s.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim();
const rowsOf=pg=>pg.$$eval('.ri-row',a=>a.map(r=>({t:r.dataset.t,left:+r.dataset.left,h:+r.dataset.h,a:+r.dataset.a,es:+r.dataset.es,ef:+r.dataset.ef,now:+r.dataset.now,opp:r.dataset.opp===''?null:+r.dataset.opp,n5:+r.dataset.n5,
 eff:r.querySelector('.ri-b b').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),proj:r.querySelector('.ri-pj b').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),now2:r.querySelector('.ri-pj small').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),
 lt:r.querySelector('.ri-l').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),q:r.querySelector('.ri-q').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),cls:[...r.querySelectorAll('.ri-c')].map(c=>c.className.replace('ri-c ','')),
 bar:(r.querySelector('.ri-b i')||{}).className})));
const near=(a,b,d)=>Math.abs(a-b)<(d||0.0007);
function same(got,list){return got.length===list.length&&list.every((w,i)=>{const g=got[i];return g.t===w.t&&g.left===w.left&&g.h===w.hh&&g.a===w.aa&&near(g.es,w.es)&&near(g.ef,w.ef)&&g.now===w.now&&(w.opp==null?g.opp==null:near(g.opp,w.opp,0.006))&&g.eff===sg(w.sched)&&g.proj===w.proj.toFixed(1)&&g.now2===String(w.now)&&g.lt===w.hh+'+'+w.aa&&g.q===String(Math.round(w.opp))&&g.n5===w.next.length&&g.cls.join()===w.next.map(x=>lv(x.e)).join()&&g.bar===(w.sched>=0?'p':'m')})}
const LG='l_4WFCIZ';
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/runin'});await pg.waitForSelector('.ri-row',{timeout:90000});await pg.waitForTimeout(400);
 let W=world(LG),got=await rowsOf(pg);
 ok(W.teams.length===20&&same(got,want(W,'hard')),W.name+' '+W.season+': 20 clubs, matches left (home + away), Elo points from them and against an average opponent, schedule effect, avg opponent, projected points and the five squares all match, hardest first');
 ok(W.rows.every(r=>r.hh+r.aa===r.left)&&W.rows.reduce((s,r)=>s+r.left,0)===2*(20*19-W.np),'every pairing not yet played is counted once for each club ('+W.rows.reduce((s,r)=>s+r.left,0)/2+' matches left of '+(20*19-W.np+W.np)+')');
 ok(W.rows.every(r=>Math.abs(r.sched)<4),'the schedule effect is small for every club (largest '+Math.max(...W.rows.map(r=>Math.abs(r.sched))).toFixed(2)+' points)');
 for(const k of ['easy','proj','next']){await pg.click('#riso button[data-k="'+k+'"]');await pg.waitForTimeout(200);ok(same(await rowsOf(pg),want(W,k)),'ordered by '+k);}
 await pg.click('#riso button[data-k="hard"]');await pg.waitForTimeout(150);
 /* the three tiles */
 {const h=W.rows.slice().sort((a,b)=>a.sched-b.sched)[0],e=W.rows.slice().sort((a,b)=>b.sched-a.sched)[0],tl=await pg.$$eval('.ri-k .hb-t',a=>a.map(x=>({k:x.dataset.k,b:x.querySelector('b').textContent.replace(/[⁦-⁩]/g,'').trim(),s:x.querySelector('span').textContent.replace(/[⁦-⁩]/g,'').replace(/\s+/g,' ')})));
  ok(tl.length===3&&tl[0].b===h.t&&tl[0].s.includes(sg(h.sched))&&tl[1].b===e.t&&tl[1].s.includes(sg(e.sched))&&+tl[2].b===W.rows.reduce((s,r)=>s+r.left,0)/2,'the tiles: hardest '+h.t+' '+sg(h.sched)+', easiest '+e.t+' '+sg(e.sched)+', matches left')}
 /* a club's lists */
 const t=want(W,'hard')[3].t,w=W.rows.find(r=>r.t===t);await pg.click('.ri-row[data-t="'+t+'"]');await pg.waitForTimeout(250);
 {const lst=async v=>pg.$$eval('.ri-ml[data-v="'+v+'"] li[data-o]',a=>a.map(x=>({o:x.dataset.o,e:+x.dataset.e,p:x.querySelector('.ri-p').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),s:x.querySelector('.ri-e').textContent.replace(/[⁦-⁩]/g,'').trim(),c:x.querySelector('.ri-e').className.replace('ri-e ','')})));
  for(const [v,A] of [['h',w.home],['a',w.away]]){const g=await lst(v),W2=A.slice().sort((p,q)=>p.e-q.e||cmp(p.o,q.o));
   ok(g.length===W2.length&&W2.every((x,i)=>g[i].o===x.o&&near(g[i].e,x.e)&&g[i].p===pc(x.p[0])+' · '+pc(x.p[1])+' · '+pc(x.p[2])&&g[i].s===x.e.toFixed(2)&&g[i].c===lv(x.e)),t+': '+(v==='h'?'home':'away')+' matches left ('+W2.length+'), hardest first, win · draw · loss and expected points')}
  const nx=await pg.$$eval('.ri-nx li',a=>a.map(x=>({i:x.dataset.id,e:+x.dataset.e,p:x.querySelector('.ri-p').textContent.replace(/[⁦-⁩‎‏]/g,'').trim(),d:x.querySelector('.mu').textContent.replace(/[⁦-⁩]/g,'').trim(),o:x.querySelector('.ri-o').textContent.replace(/[⁦-⁩]/g,'').replace(/\s+/g,' ').trim()})));
  ok(nx.length===w.next.length&&w.next.every((x,i)=>nx[i].i===x.i&&near(nx[i].e,x.e)&&nx[i].p===pc(x.p[0])+' · '+pc(x.p[1])+' · '+pc(x.p[2])&&nx[i].d===x.d&&nx[i].o.includes(x.o)&&nx[i].o.startsWith(x.home?'vs':'at')),t+': the '+nx.length+' dated fixtures from fixtures.json, in kick-off order')}
 ok((await pg.innerText('#risel .mu')).includes(w.left+' matches left')&&(await pg.innerText('#risel .mu')).includes(w.es.toFixed(1)+' points from them')&&(await pg.innerText('#risel .mu')).includes('Projected final: '+w.proj.toFixed(1)),'the club summary line: matches left, Elo points, projected final');
 ok(await pg.$eval('.ri-row.on',e=>e.dataset.t)===t&&(await pg.innerText('#risel h3')).includes(t),'pressing a club marks it and opens its lists');
 /* the test card */
 {const rows=await pg.$$eval('#ritest tbody tr',a=>a.map(r=>({f:+r.dataset.f,s:r.dataset.s,c:[...r.querySelectorAll('td')].map(x=>x.innerText.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim())})));
  const wantR=[];for(const f of RT.check){wantR.push([f,'all',RT.all[String(f)]]);if(RT.new[String(f)])wantR.push([f,'new',RT.new[String(f)]])}
  const vd=(d,se)=>Math.abs(d)>=1.96*se?(d<0?'better with the real opponents':'worse with the real opponents'):'within noise';
  ok(rows.length===wantR.length&&wantR.every(([f,s,a],i)=>rows[i].f===f&&rows[i].s===s&&rows[i].c[1]===String(a.n)&&rows[i].c[2]===a.sched.toFixed(2)&&rows[i].c[3]===a.flat.toFixed(2)&&rows[i].c[4]===(a.d>=0?'+':'−')+Math.abs(a.d).toFixed(2)+' ± '+a.se.toFixed(2)&&rows[i].c[5]===vd(a.d,a.se)&&rows[i].c[6]===a.slope.toFixed(2)+' ± '+a.slope_se.toFixed(2)),'the test card: '+rows.length+' rows (all seasons and 2025-26 at each checkpoint) equal data/runin.json, the reading follows difference and standard error');
  const txt=clean(await pg.innerText('#ritest .ri-r')),bt=RT.check.filter(f=>Math.abs(RT.all[String(f)].d)>=1.96*RT.all[String(f)].se&&RT.all[String(f)].d<0).map(f=>Math.round(f*100)+'%');
  ok(txt.includes('Tested on '+RT.all['0.5'].seasons+' finished seasons')&&txt.includes('about '+RT.all['0.5'].spread.toFixed(1)+' points')&&(bt.length?txt.includes('beyond noise at '+bt.join(' and ')):/within noise/.test(txt)),'the card\'s sentence follows the numbers ("beyond noise at '+bt.join(' and ')+'")')}
 /* the same numbers recomputed from the file by an independent Python-free pass: the test file itself says the schedule helps late, so the page must not claim it early */
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/runin')===a.indexOf('#/race')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/runin'}),'the page is the Season hub tab after Title race, marked open');
 ok(!!(await pg.$('#riso .lgx-g')),'the order choice has the glass');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
 /* every league */
 const ids=Object.keys(E.leagues).filter(i=>F.leagues[i]);ok(ids.length===6,'six leagues have ratings and results');
 for(const id of ids.slice(1)){await pg.selectOption('#rig',id);await pg.waitForTimeout(350);const W3=world(id);ok(same(await rowsOf(pg),want(W3,'hard')),W3.name+' '+W3.season+': '+W3.teams.length+' clubs match ('+W3.rows.reduce((s,r)=>s+r.left,0)/2+' matches left)')}
 await ctx.close();
 /* a missing fixtures file: the rows stay, no squares */
 {({ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/runin'}));await ctx.route(/fixtures\.json/,r=>r.fulfill({status:404,body:'{}'}));await pg.reload();await pg.waitForSelector('.ri-row',{timeout:90000});
  const g=await rowsOf(pg);ok(g.length===20&&g.every(r=>r.n5===0&&!r.cls.length),'no fixtures file: the 20 rows still show, with no squares');
  await pg.click('.ri-row[data-t="'+g[2].t+'"]');await pg.waitForTimeout(200);ok(!(await pg.$('.ri-nx'))&&!!(await pg.$('.ri-ml li[data-o]')),'and no dated list, but the home and away lists');await ctx.close()}
 /* a season with nothing left: every missing pairing added as a 0-0 */
 {const FF=JSON.parse(JSON.stringify(F)),L=FF.leagues[LG],cur=L.seasons[L.seasons.length-1],ix=Object.fromEntries(L.teams.map((n,i)=>[n,i])),have=new Set(cur.m.map(m=>m[1]+'>'+m[2])),tm=[...new Set(cur.m.flatMap(m=>[m[1],m[2]]))];
  let n=0;for(const h of tm)for(const a of tm)if(h!==a&&!have.has(h+'>'+a))cur.m.push(['2027-05-20',h,a,0,0,'m_fill'+(n++)]);
  ({ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/runin'}));await ctx.route(/results\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(FF)}));await pg.reload();await pg.waitForSelector('#riroot .empty:not(.skel)',{timeout:90000});
  ok(/nothing is left to rate/.test(await pg.innerText('#riroot'))&&!(await pg.$('.ri-row'))&&!!(await pg.$('#ritest'))&&!errs.length,'a season with every pairing played: "nothing is left to rate", the test card stays, no error');await ctx.close()}
 {const c2_=await b.newContext();await c2_.route(/results\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2_.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/runin');await p2.waitForSelector('#riroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#riroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2_.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/elo_own\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/runin');
  await p3.waitForSelector('#riroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#riroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/runin'});await p3.waitForSelector('.ri-row',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.ri-row')),'a failing ratings file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/runin'}));await pg.waitForSelector('.ri-row',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('.ri-row',a=>a.every(r=>r.scrollWidth<=r.clientWidth+1)),lang+' phone: every row fits');
  const g=await pg.$$eval('.ri-row',a=>a.map(r=>({t:r.dataset.t,es:+r.dataset.es,left:+r.dataset.left})));const Wp=want(W,'hard');
  ok(g.length===20&&Wp.every((x,i)=>g[i].t===x.t&&near(g[i].es,x.es)&&g[i].left===x.left),lang+' phone: the rows are the same');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/باقي الموسم/.test(await pg.textContent('#app h2')),'Arabic title');
   ok(/ضمن الضجيج|أفضل بالخصوم|أسوأ بالخصوم/.test(await pg.innerText('#ritest tbody')),'Arabic: the reading in the test table');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/runin_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
