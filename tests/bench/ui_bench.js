/* Bench impact (assets/bench-impact.js): substitutes found from the league's player rows and starting XIs, recomputed here with loops of their own (the players who played a match
   with line-ups and are not in its two starting XIs): every row of the table for the default choices (apps, minutes, goals, assists, npxG, per-90 figures over substitute minutes, a
   starter's npxG per 90 from 270 minutes), the three orders, the minutes choice, a position, a club, the search, "Show more", each club's bench (minutes, goals, share, npxG), the repeat-test
   card compared with data/bench.json, the count of matches with and without line-ups; LaLiga; the Players hub tab after Who keeps it up?; Arabic, 390 px, leaving early, a failing player file,
   a failing line-up file and a missing repeat-test file. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const B=J('bench.json'),cmp=(a,b)=>a<b?-1:a>b?1:0;
function ref(id){
 const l=IDX.leagues.find(x=>x.id===id),pl=J(l.pl_file),mx=J(l.mx_file).m,c={};pl.cols.forEach((k,i)=>c[k]=i);
 const start=new Set(),lu=new Set();
 for(const [mid,v] of Object.entries(mx)){for(const s of ['h','a'])for(const x of (((v.lu||{})[s]||{}).xi||[])){start.add(mid+'|'+x[0]);lu.add(mid)}}
 const P={},CL={},seen=new Set(),skip=new Set();
 for(const r of pl.rows){const mi=r[c.mi];if(!mi)continue;const pid=r[c.i],m=r[c.m];
  const p=P[pid]=P[pid]||{id:pid,name:r[c.n],club:r[c.c],posm:{},sn:0,smi:0,sgl:0,sast:0,sxg:0,tmi:0,txg:0};
  p.club=r[c.c]||p.club;if(r[c.o])p.posm[r[c.o]]=(p.posm[r[c.o]]||0)+mi;
  if(!lu.has(m)){skip.add(m);continue}seen.add(m);
  const cl=CL[r[c.c]]=CL[r[c.c]]||{club:r[c.c],gl:0,sgl:0,smi:0,sxg:0};cl.gl+=r[c.gl];
  if(start.has(m+'|'+pid)){p.tmi+=mi;p.txg+=r[c.npxg]}
  else{p.sn++;p.smi+=mi;p.sgl+=r[c.gl];p.sast+=r[c.ast];p.sxg+=r[c.npxg];cl.sgl+=r[c.gl];cl.smi+=mi;cl.sxg+=r[c.npxg]}}
 for(const p of Object.values(P)){const e=Object.entries(p.posm).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0]));p.pos=e.length?e[0][0]:null}
 return {P:Object.values(P),CL:Object.values(CL),lineups:seen.size,nolu:[...skip].filter(m=>!seen.has(m)).length}}
const f2=x=>x.toFixed(2);
const keys={xg90:p=>p.sxg/p.smi*90,ga90:p=>(p.sgl+p.sast)/p.smi*90,gl:p=>p.sgl,mi:p=>p.smi};
function want(R,o){const q=(o.q||'').toLowerCase();return R.P.filter(p=>p.smi>=(o.mi||90)&&(!o.pos||p.pos===o.pos)&&(!o.club||p.club===o.club)&&(!q||p.name.toLowerCase().includes(q)||p.club.toLowerCase().includes(q)))
 .sort((a,b)=>keys[o.sort||'xg90'](b)-keys[o.sort||'xg90'](a)||b.smi-a.smi||cmp(a.name,b.name)||cmp(a.id,b.id))}
const strip=s=>s.replace(/[⁦-⁩‎‏]/g,'').trim();
const rowsOf=pg=>pg.$$eval('.bn-r',a=>a.map(r=>({id:r.dataset.id,c:[...r.children].slice(1).map(x=>x.textContent.replace(/[⁦-⁩‎‏]/g,'').trim())})));
function same(got,W,label){
 const g=got.length===Math.min(W.length,40)&&got.every((r,i)=>{const p=W[i];return r.id===p.id&&r.c[1]===String(p.sn)&&r.c[2]===String(Math.round(p.smi))&&r.c[3]===String(p.sgl)&&r.c[4]===String(p.sast)&&r.c[5]===f2(p.sxg)&&r.c[6]===f2(p.sxg/p.smi*90)&&r.c[7]===f2((p.sgl+p.sast)/p.smi*90)&&r.c[8]===(p.tmi>=270?f2(p.txg/p.tmi*90):'–')});
 ok(g,label+': '+got.length+' of '+W.length+' substitutes, every figure and the order match'+(W[0]?' (first: '+W[0].name+')':''))}
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',LL='l_0ErfuF';
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/table'});await pg.waitForSelector('#app h2',{timeout:60000});await pg.evaluate(()=>{location.hash='#/bench'});await pg.waitForSelector('.bn-r',{timeout:90000});await pg.waitForTimeout(400);
 let R=ref(LG);
 ok(R.lineups>50&&R.P.filter(p=>p.smi>0).length>200,'reference: '+R.lineups+' matches with line-ups, '+R.P.filter(p=>p.smi>0).length+' players with substitute minutes');
 same(await rowsOf(pg),want(R,{}),'default (90+ minutes, by npxG per 90)');
 ok(+await pg.$eval('#bncount',e=>e.dataset.n)===want(R,{}).length,'the count says '+want(R,{}).length+' players');
 for(const k of ['ga90','gl']){await pg.click('#bnso button[data-k="'+k+'"]');await pg.waitForTimeout(150);same(await rowsOf(pg),want(R,{sort:k}),'ordered by '+k)}
 await pg.click('#bnso button[data-k="xg90"]');
 for(const m of [45,180,360]){await pg.selectOption('#bnm',String(m));await pg.waitForTimeout(150);ok(+await pg.$eval('#bncount',e=>e.dataset.n)===want(R,{mi:m}).length,'at least '+m+' substitute minutes: '+want(R,{mi:m}).length+' players');if(m===180)same(await rowsOf(pg),want(R,{mi:180}),'180+ minutes')}
 await pg.selectOption('#bnm','45');await pg.waitForTimeout(150);
 {const W=want(R,{mi:45});ok(W.length>40&&await pg.$('#bnmore')!==null&&(await rowsOf(pg)).length===40,'45+ minutes: more than 40 players, 40 shown with "Show more"');await pg.click('#bnmore');await pg.waitForTimeout(150);ok((await rowsOf(pg)).length===Math.min(80,W.length),'Show more adds up to 40 more ('+(await rowsOf(pg)).length+')')}
 await pg.selectOption('#bnm','90');
 await pg.selectOption('#bnp','FW');await pg.waitForTimeout(150);same(await rowsOf(pg),want(R,{pos:'FW'}),'position FW');await pg.selectOption('#bnp','');
 {const club=want(R,{})[0].club;await pg.selectOption('#bnc',club);await pg.waitForTimeout(150);same(await rowsOf(pg),want(R,{club}),'club '+club);await pg.selectOption('#bnc','')}
 {const nm=want(R,{})[3].name.split(' ').pop().slice(0,5);await pg.fill('#bnq',nm);await pg.waitForTimeout(200);same(await rowsOf(pg),want(R,{q:nm}),'search "'+nm+'"');await pg.fill('#bnq','');await pg.waitForTimeout(150);
  await pg.fill('#bnq','zzzzzqq');await pg.waitForTimeout(150);ok(/No substitute matches/.test(await pg.innerText('#bnroot'))&&!(await pg.$('.bn-r')),'a name nobody has: "No substitute matches these choices"');await pg.fill('#bnq','');await pg.waitForTimeout(150)}
 /* the clubs' benches */
 {const got=await pg.$$eval('.bn-cr',a=>a.map(r=>({c:r.dataset.c,smi:+r.dataset.smi,sgl:+r.dataset.sgl,gl:+r.dataset.gl,cells:[...r.children].map(x=>x.textContent.replace(/[⁦-⁩‎‏]/g,'').trim())})));
  const W=R.CL.slice().sort((a,b)=>b.sgl-a.sgl||b.smi-a.smi||cmp(a.club,b.club));
  ok(got.length===W.length&&got.every((g,i)=>g.c===W[i].club&&g.smi===Math.round(W[i].smi)&&g.sgl===W[i].sgl&&g.gl===W[i].gl&&g.cells[4]===(W[i].gl?Math.round(W[i].sgl/W[i].gl*100)+'%':'–')&&g.cells[5]===f2(W[i].sxg)),'each club\'s bench: '+W.length+' clubs, minutes, goals by substitutes, club goals, share and npxG match')}
 {const t=await pg.innerText('#bnroot .bn-t ~ .ins-note,#bnroot .ins-note');ok(new RegExp(R.lineups+' matches with line-ups').test(await pg.innerText('#bnroot')),R.lineups+' matches with line-ups is printed')}
 /* the repeat test */
 {const got=await pg.$$eval('.bn-sr',a=>a.map(r=>({k:r.dataset.k,r:r.dataset.r,n:+r.dataset.n,sb:r.dataset.sb,hn:+r.dataset.hn,cells:[...r.children].map(x=>x.textContent.replace(/[⁦-⁩‎‏]/g,'').trim())})));
  const K=Object.keys(B.measures);ok(got.length===K.length&&got.every((g,i)=>g.k===K[i]&&Math.abs(+g.r-B.measures[K[i]].yoy.r)<1e-5&&g.n===B.measures[K[i]].yoy.n&&Math.abs(+g.sb-B.measures[K[i]].half.sb)<1e-5&&g.hn===B.measures[K[i]].half.n&&g.cells[1]===f2(B.measures[K[i]].yoy.r)&&g.cells[2]===f2(B.measures[K[i]].yoy.lo)+' to '+f2(B.measures[K[i]].yoy.hi)),'the repeat-test card equals data/bench.json for '+K.length+' measures');
  const txt=await pg.innerText('#bnsk p');const rep=K.filter(k=>B.measures[k].yoy.lo>0),non=K.filter(k=>!(B.measures[k].yoy.lo>0));
  ok(rep.every(k=>txt.includes(B.measures[k].yoy.r.toFixed(2)))&&(non.length?/within noise/.test(txt):true)&&/Position is taken out first/.test(txt),'the reading names the measures that repeat beyond noise ('+rep.join(', ')+') and those that do not ('+non.join(', ')+')')}
 ok(await pg.evaluate(([k,r])=>{const on=document.querySelector('#secnav button.on'),h=document.getElementById('hubbar'),cur=h.querySelector(':scope > a.on'),back=h.querySelector(':scope > .hb-back');return !!on&&on.dataset.k===r&&(cur?cur.getAttribute('href')==='#/'+k:true)&&(r==='home'||(!!back&&back.getAttribute('href')==='#/r-'+r))},['bench','players']),'the page is in the players room: the room bar marks it, and the bar above it links back to the room and marks the page open');
 ok(!!(await pg.$('#bnso .lgx-g')),'the order choice has the glass');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
 /* another league */
 await pg.evaluate(()=>{localStorage.setItem('league','l_0ErfuF')});await ctx.close();
 ({ctx,pg,errs}=await T.open(b,{vw:1100,league:LL,hash:'#/table'}));await pg.waitForSelector('#app h2',{timeout:60000});await pg.evaluate(()=>{location.hash='#/bench'});await pg.waitForSelector('.bn-r',{timeout:90000});await pg.waitForTimeout(300);
 R=ref(LL);same(await rowsOf(pg),want(R,{}),'LaLiga');ok(!errs.length,'LaLiga: no page errors');await ctx.close();
 /* failing files, leaving early */
 {const c=await b.newContext();await c.route(/l_4WFCIZ_pl\.json/,r=>r.fulfill({status:500,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/bench');
  await p.waitForSelector('#bnroot .empty:not(.skel)',{timeout:90000});ok(/not available right now/.test(await p.textContent('#bnroot'))&&!e.length,'a failing player file shows a message and no error');await c.close()}
 {const c=await b.newContext();await c.route(/l_4WFCIZ_mx\.json/,r=>r.fulfill({status:500,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/bench');
  await p.waitForSelector('#bnroot .empty:not(.skel)',{timeout:90000});ok(/not available right now|no line-ups/.test(await p.textContent('#bnroot'))&&!e.length,'a failing line-up file shows a message and no error');await c.close()}
 {const c=await b.newContext();await c.route(/bench\.json/,r=>r.fulfill({status:404,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/bench');
  await p.waitForSelector('.bn-r',{timeout:90000});ok(!(await p.$('#bnsk'))&&!e.length,'without data/bench.json the table still shows and the repeat-test card is left out');await c.close()}
 {const c=await b.newContext();await c.route(/l_4WFCIZ_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));
  await p.goto('http://127.0.0.1:8765/index.html#/bench');await p.waitForSelector('#bnroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#bnroot'))&&await p.$('.lt')&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/table'}));await pg.waitForSelector('#app h2',{timeout:60000});await pg.evaluate(()=>{location.hash='#/bench'});await pg.waitForSelector('.bn-r',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');same(await rowsOf(pg),want(ref(LG),{}),lang+' phone');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/تأثير الدكة/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
