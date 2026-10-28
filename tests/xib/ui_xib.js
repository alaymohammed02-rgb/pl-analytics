/* XI Battle (assets/xi-battle.js): the win / draw / loss, expected goals, likely scores and every player's numbers recomputed here from data/xib.json
   (whose own arithmetic is checked in t_xib.py against a second implementation) and the league line-up files; the three grounds, swapping sides,
   another club and league, the share link opened by a friend (a player without minutes and a side without a goalkeeper are flagged), the test sentence
   and table against data/xib_test.json, the Compare hub tab, Arabic, 390 px, leaving early, a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const X=J('xib.json'),TS=J('xib_test.json'),LG='l_4WFCIZ',b=X.params.b;
/* the saved XI: the players with most minutes this season, by their most-played position (as the XI Builder works it out) */
const PL=J('l_4WFCIZ_pl.json'),c={};PL.cols.forEach((k,i)=>c[k]=i);const MM=new Map();
for(const r of PL.rows){let a=MM.get(r[c.i]);if(!a){a={id:r[c.i],name:r[c.n],mi:0,pos:{}};MM.set(r[c.i],a)}if(r[c.mi]==null)continue;a.mi+=r[c.mi];if(r[c.o])a.pos[r[c.o]]=(a.pos[r[c.o]]||0)+r[c.mi]}
const all=[...MM.values()].map(a=>({...a,p:Object.entries(a.pos).sort((x,y)=>y[1]-x[1])[0]?.[0]})).sort((a,b)=>b.mi-a.mi||a.name.localeCompare(b.name));
const pick=(g,n)=>all.filter(a=>a.p===g).slice(0,n);
const MY=[...pick('GK',1),...pick('FW',3),...pick('MF',3),...pick('DF',4)],XB=JSON.stringify({f:'4-3-3',ids:MY.map(a=>LG+'|'+a.id)});
/* a club's latest official XI, as the page finds it: newest match first (date, then id), the first side with eleven */
function clubXI(lid,club){const L=J(IDX(lid).file),M=J(IDX(lid).mx_file).m;
 const ms=L.matches.filter(m=>m&&m.d).slice().sort((a,b)=>String(b.d).localeCompare(String(a.d))||String(b.i).localeCompare(String(a.i)));
 for(const m of ms){const lu=(M[m.i]||{}).lu||{};for(const [s,cl] of [['h',m.h],['a',m.a]]){if(cl!==club)continue;const x=(lu[s]||{}).xi;if(Array.isArray(x)&&x.length===11)return {d:String(m.d).slice(0,10),ids:x.map(e=>e[0]),vs:s==='h'?m.a:m.h,home:s==='h'}}}return null}
function clubs(lid){const L=J(IDX(lid).file),M=J(IDX(lid).mx_file).m,s=new Set();for(const m of L.matches){const lu=(M[m.i]||{}).lu||{};for(const [k,cl] of [['h',m.h],['a',m.a]])if(cl&&Array.isArray((lu[k]||{}).xi)&&lu[k].xi.length===11)s.add(cl)}return [...s].sort((a,b)=>a.localeCompare(b))}
const IDX=id=>T.IDX.leagues.find(l=>l.id===id);
const rate=(id,g)=>{const r=X.p[id];if(r)return r;const ga=['GK','DF','MF','FW'].includes(g)?g:'MF';return [X.mu.att[ga]!=null?X.mu.att[ga]:0.15,X.mu.team,X.mu.team,0]};
const side=ids=>{const r=ids.map(i=>rate(i,'MF'));return [r.reduce((s,x)=>s+x[0],0),r.reduce((s,x)=>s+x[1],0)/11,r.reduce((s,x)=>s+x[2],0)/11]};
const L_=x=>Math.log(Math.max(x,1e-3));
function want(A,B,home){const lh=Math.exp(b[0]+b[1]*home+b[2]*L_(A[0])+b[3]*L_(A[1])+b[4]*L_(B[2])),la=Math.exp(b[0]+b[1]*(1-home)+b[2]*L_(B[0])+b[3]*L_(B[1])+b[4]*L_(A[2]));
 const P=(l,k)=>{let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p};let w=0,d=0,l=0;const sc=[];
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=P(lh,i)*P(la,j);if(i>j)w+=q;else if(i===j)d+=q;else l+=q;sc.push([i,j,q])}const s=w+d+l;sc.sort((x,y)=>y[2]-x[2]||x[0]-y[0]||x[1]-y[1]);
 return {p:[w,d,l].map(x=>Math.round(x/s*100)+'%'),lh:lh.toFixed(2),la:la.toFixed(2),top:sc.slice(0,5).map(x=>x[0]+'–'+x[1]+' '+Math.round(x[2]/s*100)+'%')}}
const shown=pg=>pg.evaluate(()=>({p:[...document.querySelectorAll('.bt-pp b')].map(x=>x.textContent.trim()),xg:document.querySelector('.bt-xg .fx-en').textContent,
 top:[...document.querySelectorAll('.bt-sc')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),vs:[...document.querySelectorAll('.bt-vs b')].map(x=>x.textContent.trim()),
 t:[...document.querySelectorAll('.bt-t')].map(t=>[...t.querySelectorAll('tbody tr')].map(r=>[...r.cells].slice(1,4).map(x=>x.textContent.trim()))),
 src:[...document.querySelectorAll('.bt-src .fx-en')].map(x=>x.textContent),warn:[...document.querySelectorAll('.bt-w .fx-en')].map(x=>x.textContent)}));
const rowsOf=ids=>ids.map(i=>rate(i,'MF').slice(0,3).map(v=>v.toFixed(2)));
const wait=pg=>pg.waitForFunction(()=>document.querySelector('.bt-res')&&!document.querySelector('#btroot .skel'),null,{timeout:90000});
/* after a change the old result stays on screen until the new line-ups arrive: wait for the names and chances the change should give */
const until=(pg,vs,p)=>pg.waitForFunction(([vs,p])=>{const v=[...document.querySelectorAll('.bt-vs b')].map(x=>x.textContent.trim()),q=[...document.querySelectorAll('.bt-pp b')].map(x=>x.textContent.trim());return JSON.stringify(v)===JSON.stringify(vs)&&(!p||JSON.stringify(q)===JSON.stringify(p))},[vs,p],{timeout:60000}).catch(()=>null);
(async()=>{const br=await T.launch();
 let {ctx,pg,errs}=await T.open(br,{vw:1280,league:LG,hash:'#/battle',init:{xb:XB}});await wait(pg);
 const cl=clubs(LG),B0=clubXI(LG,cl[0]),myIds=MY.map(a=>a.id);
 let s=await shown(pg),w=want(side(myIds),side(B0.ids),0.5);
 ok(s.vs[0]==='My XI'&&s.vs[1]===cl[0],'default: my XI against the first club of the league in name order ('+cl[0]+')');
 ok(JSON.stringify(s.p)===JSON.stringify(w.p)&&s.xg.includes('My XI '+w.lh)&&s.xg.includes(cl[0]+' '+w.la),'neutral ground: '+w.p.join(' / ')+', expected goals '+w.lh+' – '+w.la);
 ok(JSON.stringify(s.top)===JSON.stringify(w.top),'the five most likely scores: '+w.top.join(', '));
 ok(JSON.stringify(s.t[0])===JSON.stringify(rowsOf(myIds))&&JSON.stringify(s.t[1])===JSON.stringify(rowsOf(B0.ids)),'every player\'s attack, xG for and xG against in both tables match the file (22 players)');
 ok(s.src.some(x=>x.includes('Line-up of '+B0.d)&&x.includes(B0.vs)),'the club side says which match its XI is from ('+B0.d+', '+(B0.home?'home to ':'away at ')+B0.vs+')');
 for(const [v,h] of [['a',1],['b',0]]){w=want(side(myIds),side(B0.ids),h);await pg.selectOption('#btv',v);await until(pg,['My XI',cl[0]],w.p);s=await shown(pg);ok(JSON.stringify(s.p)===JSON.stringify(w.p),(v==='a'?'my XI at home: ':'the club at home: ')+w.p.join(' / '))}
 const pick2=cl.includes('Liverpool')?'Liverpool':cl[1];const B1=clubXI(LG,pick2);w=want(side(myIds),side(B1.ids),0);await pg.selectOption('#btbc',pick2);await until(pg,['My XI',pick2],w.p);s=await shown(pg);
 ok(s.vs[1]===pick2&&JSON.stringify(s.p)===JSON.stringify(w.p)&&s.src.some(x=>x.includes('Line-up of '+B1.d)),'another club ('+pick2+', XI of '+B1.d+'): '+w.p.join(' / '));
 w=want(side(B1.ids),side(myIds),1);await pg.click('#btsw');await until(pg,[pick2,'My XI'],w.p);s=await shown(pg);
 ok(s.vs[0]===pick2&&s.vs[1]==='My XI'&&await pg.$eval('#btv',x=>x.value)==='a'&&JSON.stringify(s.p)===JSON.stringify(w.p),'swap sides: the club is A and keeps its home ground: '+w.p.join(' / '));
 await pg.click('#btsw');await until(pg,['My XI',pick2]);
 const L2='l_0ErfuF';const c2=clubs(L2),B2=clubXI(L2,c2[0]);w=want(side(myIds),side(B2.ids),0);await pg.selectOption('#btbl',L2);await until(pg,['My XI',c2[0]],w.p);s=await shown(pg);
 ok(s.vs[1]===c2[0]&&JSON.stringify(s.p)===JSON.stringify(w.p),'another league (LaLiga): its first club '+c2[0]+', '+w.p.join(' / '));
 await pg.selectOption('#btas','club');await until(pg,[cl[0],c2[0]]);s=await shown(pg);
 ok(s.vs[0]===cl[0]&&s.vs[1]===c2[0],'side A can be a club too ('+cl[0]+' against '+c2[0]+')');
 await pg.selectOption('#btas','mine');await until(pg,['My XI',c2[0]]);
 /* the test */
 const pc=x=>Math.round(x*100),t=TS.all,intro=await pg.innerText('.bt-res ~ .card:last-child');
 ok(intro.includes(t.n.toLocaleString('en')+' matches')&&intro.includes('Brier score (lower is better): '+t.brier.toFixed(3))&&intro.includes(t.elo.toFixed(3)+' for Elo')&&intro.includes(t.base.toFixed(3)+' for the leagues')&&intro.includes('right result '+pc(t.acc)+'%')&&intro.includes('(Elo '+pc(t.acc_elo)+'%)'),'the test sentence: '+t.n+' matches, Brier '+t.brier.toFixed(3)+' against Elo '+t.elo.toFixed(3)+' and '+t.base.toFixed(3));
 ok(Math.abs(t.d_elo)<1.96*t.se_elo?intro.includes('within noise'):!intro.includes('within noise'),'the Elo comparison is judged with its standard error ('+t.d_elo+' ± '+t.se_elo+')');
 ok(/leagues are treated as equal/.test(intro)&&/every tested XI was a real XI/.test(intro)&&intro.includes('as of '+X.asof),'the page says leagues are treated as equal, that only real XIs were tested, and the date of the numbers ('+X.asof+')');
 await pg.click('.bt-res ~ .card:last-child summary');
 const tb=await pg.evaluate(()=>[...document.querySelectorAll('.bt-lg tbody tr')].map(r=>[...r.cells].slice(1).map(x=>x.textContent.trim())));
 ok(JSON.stringify(tb)===JSON.stringify(Object.values(TS.per_league).map(v=>[String(v.n),v.brier.toFixed(3),v.elo.toFixed(3),v.base.toFixed(3)])),'the per-league table: '+tb.length+' leagues as in the file');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/battle')&&a.includes('#/builder')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/battle'}),'the page is a tab of the Compare hub, marked open');
 /* sharing */
 await pg.click('#btsh');const link=await pg.$eval('#btlk input',x=>x.value);
 ok(!(await pg.$eval('#btlk',x=>x.hidden))&&link.endsWith('#/battle/'+myIds.join('.')),'share: a link with my eleven players ('+link.slice(-40)+')');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {/* a friend opens a link: a World Cup-only player (no minutes in the six leagues) and no goalkeeper */
  const WC=J(IDX('l_1XLtP0').pl_file),wi=WC.cols.indexOf('i'),wc=[...new Set(WC.rows.map(r=>r[wi]))].find(i=>!X.p[i]);
  const ids=[...pick('FW',3),...pick('MF',3),...pick('DF',4)].map(a=>a.id).concat(wc);
  const {ctx,pg,errs}=await T.open(br,{vw:1280,league:LG,hash:'#/battle/'+ids.join('.')});await wait(pg);const s=await shown(pg);
  const est=rate(wc,'MF');ok(s.vs[0]===cl[0]&&s.vs[1]==='Friend\'s XI','a friend\'s link without a saved XI: a club against the friend\'s XI');
  const wpos=(()=>{const r=WC.rows.filter(x=>x[wi]===wc),o=WC.cols.indexOf('o'),mi=WC.cols.indexOf('mi'),m={};for(const x of r)if(x[o])m[x[o]]=(m[x[o]]||0)+(x[mi]||0);return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]?.[0]||'MF'})();
  const r2=ids.map(i=>X.p[i]||[X.mu.att[wpos]??0.15,X.mu.team,X.mu.team,0]),sB=[r2.reduce((s,x)=>s+x[0],0),r2.reduce((s,x)=>s+x[1],0)/11,r2.reduce((s,x)=>s+x[2],0)/11];
  const w=want(side(clubXI(LG,cl[0]).ids),sB,0.5);
  ok(JSON.stringify(s.p)===JSON.stringify(w.p),'the friend\'s XI, with the World Cup player counted as the average '+wpos+': '+w.p.join(' / '));
  ok(s.warn.some(x=>/has 0 goalkeepers/.test(x))&&s.warn.some(x=>/1 player\(s\) of Friend's XI have no minutes/.test(x))&&(await pg.$$('.bt-est')).length===1,'flagged: no goalkeeper, and one player without minutes (his row is marked)');
  ok(!errs.length,'friend\'s link: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {const {ctx,pg,errs}=await T.open(br,{vw:1280,league:LG,hash:'#/battle/p_x.p_y'});await wait(pg);const s=await shown(pg);
  ok(s.vs[1]===cl[1]||s.vs[1]===cl[0],'a broken link: the page falls back to two clubs ('+s.vs.join(' v ')+')');ok(s.vs[0]!==s.vs[1],'two different clubs by default');ok(!errs.length,'no page errors');await ctx.close()}
 {const c2=await br.newContext();await c2.route(/xib\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/battle');await p2.waitForSelector('#btroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#btroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await br.newContext();let fail=true;await c3.route(/xib\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/battle');
  await p3.waitForSelector('#btroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#btroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/battle'});await p3.waitForSelector('.bt-res',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.bt-res')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(br,{vw:390,lang,league:LG,hash:'#/battle',init:{xb:XB}});await wait(pg);await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.bt-t')].every(t=>{const a=t.getBoundingClientRect(),c=t.closest('.card').getBoundingClientRect();return a.left>=c.left-1&&a.right<=c.right+1})),lang+' phone: both line-up tables fit their cards');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/معركة التشكيلات/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/bt_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(br)})();
