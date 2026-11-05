/* Player roles (assets/player-roles.js, #/roles): the file data/roles.json read here with the test's own loops: the map has one dot per player of the choice (season, league,
   minutes) and each chip's count equals the file's; the closest players of a clicked dot equal a brute force over the file's z-scores; the deep link and the search open a
   player; his role in each season is the file's; the role cards and the test table equal the file; lighting a role fades the others; failing file; leaving early; the
   page in the Players room; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const R=J('roles.json');
const rows=[];for(const [id,L] of Object.entries(R.p))for(const e of L)rows.push({id,name:R.n[id],s:e[0],lg:e[1],club:e[2],pos:e[3],mi:e[4],role:e[5],z:e[8]});
const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++){const t=(a[i]-b[i])/10;s+=t*t}return Math.sqrt(s)};
const near=(id,s,n)=>{const me=rows.find(r=>r.id===id&&r.s===s);return rows.filter(r=>r.s===s&&r.id!==id).map(r=>({id:r.id,d:dist(me.z,r.z)})).sort((a,b)=>a.d-b.d||R.n[a.id].localeCompare(R.n[b.id])).slice(0,n)};
const fold=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
(async()=>{
 const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{hash:'#/roles',league:'l_4WFCIZ'});
 await pg.waitForSelector('#rlroot .rl-map',{timeout:120000});
 const dots=()=>pg.$$eval('.rl-d',a=>a.map(c=>c.dataset.id));
 let sel=rows.filter(r=>r.s===1&&r.mi>=900);
 ok(JSON.stringify((await dots()).sort())===JSON.stringify(sel.map(r=>r.id).sort()),'the map has one dot for each of the '+sel.length+' players of 2025-26 with 900+ minutes, all six leagues');
 const chips=()=>pg.$$eval('.rl-chip',a=>a.map(c=>+c.querySelector('bdi').textContent));
 ok(JSON.stringify(await chips())===JSON.stringify(R.roles.map(r=>sel.filter(x=>x.role===r.id).length)),'each role chip counts its players of the choice');
 ok((await pg.$$('.rl-r')).length===R.k&&(await pg.$$eval('.rl-r',a=>a.every(x=>x.querySelectorAll('.rl-m').length===4))),'the role cards: '+R.k+', each with its four strongest measures');
 ok(JSON.stringify(await pg.$$eval('.rl-r .rl-rh bdi',a=>a.map(x=>+x.textContent)))===JSON.stringify(R.roles.map(r=>r.n)),'each role card says how many players it was fitted on');
 /* league and minutes */
 await pg.selectOption('#rll','Serie A');await pg.waitForTimeout(150);
 sel=rows.filter(r=>r.s===1&&r.mi>=900&&R.lg[r.lg]==='Serie A');ok((await dots()).length===sel.length&&sel.length>50,'league choice: '+sel.length+' players of Serie A');
 await pg.selectOption('#rlm','450');await pg.waitForTimeout(150);
 sel=rows.filter(r=>r.s===1&&r.mi>=450&&R.lg[r.lg]==='Serie A');ok((await dots()).length===sel.length,'450+ minutes: '+sel.length);
 await pg.selectOption('#rls','0');await pg.waitForTimeout(150);
 sel=rows.filter(r=>r.s===0&&r.mi>=450&&R.lg[r.lg]==='Serie A');ok((await dots()).length===sel.length,'season 2024-25: '+sel.length);
 await pg.selectOption('#rls','1');await pg.selectOption('#rll','');await pg.selectOption('#rlm','900');await pg.waitForTimeout(150);
 /* light up a role */
 await pg.click('.rl-chip[data-role="2"]');await pg.waitForTimeout(100);
 const op=await pg.$$eval('.rl-d',a=>a.map(c=>[c.dataset.role,+c.getAttribute('opacity')]));
 ok(op.every(([r,o])=>r==='2'?o>0.5:o<0.2)&&(await pg.$eval('.rl-chip[data-role="2"]',c=>c.getAttribute('aria-pressed')))==='true','a chosen role stays lit and fades the other dots');
 await pg.click('.rl-chip[data-role="2"]');
 /* click a dot: the player, his seasons, his closest players */
 const withBoth=rows.filter(r=>r.s===1&&r.mi>=900&&rows.some(x=>x.id===r.id&&x.s===0)).sort((a,b)=>b.mi-a.mi)[0];
 await pg.dispatchEvent(`.rl-d[data-id="${withBoth.id}"]`,'click');await pg.waitForSelector('.rl-who');
 ok((await pg.innerText('.rl-who h3')).includes(withBoth.name),'clicking a dot shows '+withBoth.name);
 const ss=await pg.$$eval('.rl-s',a=>a.map(x=>x.dataset.s));ok(JSON.stringify(ss)==='["0","1"]','his role in both seasons is listed');
 const mineRoles=await pg.$$eval('.rl-s b .fx-en',a=>a.map(x=>x.textContent));
 ok(JSON.stringify(mineRoles)===JSON.stringify([0,1].map(s=>R.roles[rows.find(r=>r.id===withBoth.id&&r.s===s).role].name)),'the roles shown are the file\'s');
 const got=await pg.$$eval('.rl-nn tbody tr',a=>a.map(r=>r.dataset.id));
 ok(JSON.stringify(got)===JSON.stringify(near(withBoth.id,1,8).map(x=>x.id)),'the 8 closest players equal a brute force over the z-scores');
 const ds=await pg.$$eval('.rl-nn tbody td.n',a=>a.map(x=>+x.textContent));const want=near(withBoth.id,1,8).map(x=>x.d);
 ok(ds.every((d,i)=>Math.abs(d-want[i])<0.006),'and so do the distances');
 ok(!got.includes(withBoth.id),'a player is never his own neighbour');
 /* a neighbour opens by its link */
 const nb1=near(withBoth.id,1,8)[0];await pg.click(`.rl-nn tr[data-id="${nb1.id}"] a`);await pg.waitForTimeout(300);
 ok((await pg.innerText('.rl-who h3')).includes(R.n[nb1.id]),'clicking a neighbour opens him');
 /* the deep link and the search */
 await pg.evaluate(id=>{location.hash='#/roles/'+encodeURIComponent(id)},withBoth.id);await pg.waitForFunction(n=>document.querySelector('.rl-who h3')&&document.querySelector('.rl-who h3').innerText.includes(n),withBoth.name,{timeout:20000});
 ok(true,'#/roles/<id> opens the player');
 const other=rows.filter(r=>r.s===1&&r.mi>=900&&fold(r.name)!==r.name.toLowerCase())[0]||rows.filter(r=>r.s===1&&r.mi>=900)[5];
 await pg.fill('#rlq',fold(other.name));await pg.dispatchEvent('#rlq','change');await pg.waitForTimeout(250);
 ok((await pg.innerText('.rl-who h3')).includes(other.name),'search without accents finds '+other.name);
 /* the test table equals the file */
 const T0=R.test,row=async k=>pg.$$eval(`.rl-tt tr[data-k="${k}"] td`,a=>a.map(x=>x.innerText.trim()));
 const s1=await row('seasons'),s2=await row('halves');
 ok(s1[1]===String(T0.pairs)&&s1[2]===Math.round(T0.agree*100)+'%'&&s1[3]===Math.round(T0.chance*100)+'%'&&s1[4].startsWith(T0.kappa.toFixed(2))&&s2[1]===String(T0.halves)&&s2[2]===Math.round(T0.h_agree*100)+'%'&&s2[4]===T0.h_kappa.toFixed(2),'the test table shows the file: '+s1[2]+' of '+s1[1]+' players keep their role, kappa '+s1[4]);
 ok(/fixed beforehand/.test(await pg.innerText('.rl-test'))&&(await pg.innerText('.rl-test')).includes('k = '+R.k),'the note says how k was chosen');
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='players'}),'the page is in the Players room');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* failing file */
 {const c=await b.newContext();await c.route(/\/data\/roles\.json/,r=>r.fulfill({status:500,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/roles');
  await p.waitForSelector('#rlroot .empty:not(.skel)',{timeout:120000});ok(/not available/.test(await p.innerText('#rlroot'))&&!e.length,'a failing file: a message, no error');await c.close()}
 /* leaving before the data arrives */
 {const c=await b.newContext();await c.route(/\/data\/roles\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));
  await p.goto('http://127.0.0.1:8765/index.html#/roles');await p.waitForSelector('#rlroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#rlroot'))&&!!(await p.$('.lt'))&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:'#/roles/'+encodeURIComponent(withBoth.id)}));await pg.waitForSelector('.rl-who',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,svg,datalist,input')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/roles_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
