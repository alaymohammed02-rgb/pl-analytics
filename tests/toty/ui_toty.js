/* Team of the season (assets/team-season.js, #/toty): the best XI of a league by the average PitchAPI match rating, recomputed here from data/<league>_pl.json and
   data/<league>_rt.json with a loop of its own: every rated player's average, rated matches, position (the one with most minutes) and club (the one he was rated for most),
   the minimum of rated matches (30%, 50%, 70% of the busiest player's), the best formation of the seven usual ones or a chosen one, the XI in order, the pitch and the list,
   the average, for the current season, the finished 2025-26 season (the one that matters most) and every league; the share image is downloaded as a real PNG; a season without
   enough rated players says so; the Players hub tab after Ratings with the glass on the minimum choice; leaving early, a failing file, Arabic, 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const FORMS=[[4,3,3],[4,4,2],[3,4,3],[3,5,2],[4,5,1],[5,3,2],[5,4,1]];
function world(plf,rtf){const P=J(plf),RT=J(rtf),c={};P.cols.forEach((n,i)=>c[n]=i);const A={},rated=new Set();
 for(const r of P.rows){const v=(RT.m[r[c.m]]||{})[r[c.i]];if(typeof v!=='number')continue;rated.add(r[c.m]);
  const o=A[r[c.i]]=A[r[c.i]]||{id:r[c.i],n:r[c.n],cl:{},ps:{},k:0,s:0};o.k++;o.s+=v;o.cl[r[c.c]]=(o.cl[r[c.c]]||0)+1;if(r[c.o])o.ps[r[c.o]]=(o.ps[r[c.o]]||0)+(r[c.mi]||0)}
 const best=m=>Object.entries(m).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0]))[0];
 const all=Object.values(A).map(o=>({id:o.id,n:o.n,club:(best(o.cl)||[''])[0],pos:(best(o.ps)||[null])[0],k:o.k,avg:o.s/o.k}));
 return {all,rated:rated.size,max:Math.max(...all.map(x=>x.k))}}
function xi(W,frac,form){const min=Math.max(1,Math.ceil(frac*W.max)),by={GK:[],DF:[],MF:[],FW:[]};
 for(const x of W.all)if(x.k>=min&&by[x.pos])by[x.pos].push(x);
 for(const k in by)by[k].sort((a,b)=>b.avg-a.avg||b.k-a.k||cmp(a.n,b.n)||cmp(a.id,b.id));
 let top=null;if(!by.GK.length)return {min,top};
 for(const f of FORMS){if(form&&f.join('-')!==form)continue;if(by.DF.length<f[0]||by.MF.length<f[1]||by.FW.length<f[2])continue;
  const t=[by.GK[0],...by.DF.slice(0,f[0]),...by.MF.slice(0,f[1]),...by.FW.slice(0,f[2])],s=t.reduce((a,x)=>a+x.avg,0);if(!top||s>top.s+1e-9)top={f,t,s}}
 return {min,top}}
const rowsOf=pg=>pg.$$eval('.ts-l li',a=>a.map(l=>({id:l.dataset.id,avg:+l.dataset.avg,k:+l.dataset.k,pos:l.querySelector('.tr-pos').textContent.trim(),bad:l.querySelector('i').textContent.trim(),n:l.querySelector('a').textContent.trim(),
 club:l.querySelector('span.mu').innerText.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim()})));
const same=(got,W)=>W.top&&got.length===11&&W.top.t.every((x,i)=>got[i].id===x.id&&Math.abs(got[i].avg-x.avg)<1e-4&&got[i].k===x.k&&got[i].n===x.n&&got[i].bad===x.avg.toFixed(2)&&got[i].club.startsWith(x.club+' · '+x.k+' rated'));
const head=pg=>pg.innerText('#tsc .hhd');
const files=(id,s)=>s?[id+'_'+s+'_pl.json',id+'_'+s+'_rt.json']:[id+'_pl.json',id+'_rt.json'];
const LG='l_4WFCIZ';
(async()=>{const b=await T.launch();
 /* the current season */
 let [pf,rf]=files(LG),W=world(pf,rf);
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/toty'});await pg.waitForSelector('.ts-l li',{timeout:90000});await pg.waitForTimeout(400);
 let X=xi(W,0.5);
 ok(same(await rowsOf(pg),X),'current season, 50% ('+X.min+'+ rated matches of the busiest '+W.max+'): the XI from the goal up, ratings, rated matches, positions and clubs match ('+X.top.f.join('-')+': '+X.top.t.slice(0,3).map(x=>x.n).join(', ')+'…)');
 ok((await head(pg)).includes(X.top.f.join('-'))&&(await head(pg)).includes((X.top.s/11).toFixed(2)),'the header says the formation and the average rating '+(X.top.s/11).toFixed(2));
 ok(await pg.$$eval('.tr-p',a=>a.length)===11&&await pg.$$eval('.tr-p',(a,ids)=>a.map(x=>x.dataset.id).join()===ids,X.top.t.map(x=>x.id).join()),'the pitch has the same 11 players in the same order, 4 rows from the goal up');
 {const rows=await pg.$$eval('.tr-p',a=>a.map(x=>+x.style.top.replace('%','')));const f=X.top.f;ok(JSON.stringify(rows.slice(0,1))==='[90]'&&rows.slice(1,1+f[0]).every(y=>y===68)&&rows.slice(1+f[0],1+f[0]+f[1]).every(y=>y===43)&&rows.slice(1+f[0]+f[1]).every(y=>y===17),'goalkeeper, '+f[0]+' defenders, '+f[1]+' midfielders, '+f[2]+' forwards stand in their own rows')}
 ok(/rated matches|rated/.test(await pg.innerText('#tsroot .ins-note'))&&(await pg.innerText('#tsroot .ins-note')).includes(W.rated+' of '),'the note says how many matches of the league are rated ('+W.rated+')');
 ok(await pg.$eval('.tr-p',e=>/^#\/player\//.test(e.getAttribute('href'))),'a player on the pitch links to his page');
 for(const f of [0.3,0.7]){await pg.click('#tsf button[data-f="'+f+'"]');await pg.waitForTimeout(250);const Y=xi(W,f);ok(same(await rowsOf(pg),Y)&&Y.min===Math.max(1,Math.ceil(f*W.max)),Math.round(f*100)+'%: minimum '+Y.min+' rated matches, the XI matches');}
 await pg.click('#tsf button[data-f="0.5"]');await pg.waitForTimeout(200);
 for(const f of ['4-4-2','3-5-2','5-4-1']){await pg.selectOption('#tsfm',f);await pg.waitForTimeout(250);const Y=xi(W,0.5,f);ok(Y.top&&same(await rowsOf(pg),Y)&&(await head(pg)).includes(f),'formation '+f+' chosen: the XI and the header match');}
 await pg.selectOption('#tsfm','');await pg.waitForTimeout(200);
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/toty')===a.indexOf('#/ratings')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/toty'}),'the page is the Players hub tab after Ratings, marked open');
 ok(!!(await pg.$('#tsf .lgx-g')),'the minimum choice has the glass');
 /* the share image: a real PNG */
 {const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('.shr-btn[data-share="toty"]')]);const path=await dl.path(),fs=require('fs'),buf=fs.readFileSync(path);
  ok(/^team-of-the-season-now-/.test(dl.suggestedFilename())&&buf.slice(0,8).toString('hex')==='89504e470d0a1a0a'&&buf.length>20000,'the share button saves a real PNG ('+dl.suggestedFilename()+', '+Math.round(buf.length/1000)+' kB)')}
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the finished 2025-26 season of every league (the season selector swaps the files) */
 const IDX=J('index.json'),lgs=Object.keys(IDX.seasons).filter(id=>IDX.seasons[id].past.some(s=>s.s==='2025-26'&&s.rt_file));
 ok(lgs.length===6,'six leagues have a finished 2025-26 season with ratings');
 for(const id of lgs){const [p1,r1]=files(id,'2025-26'),W2=world(p1,r1),Y=xi(W2,0.5);
  ({ctx,pg,errs}=await T.open(b,{vw:1100,league:id,hash:'#/toty',init:{season:'2025-26'}}));await pg.waitForSelector('.ts-l li',{timeout:90000});await pg.waitForTimeout(300);
  ok(same(await rowsOf(pg),Y)&&(await head(pg)).includes('2025-26'),id+' 2025-26: min '+Y.min+' of '+W2.max+' rated matches, '+Y.top.f.join('-')+', '+Y.top.t[0].n+' in goal… the XI matches and the header names the season');
  if(id===LG){const dl=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('.shr-btn[data-share="toty"]')]);ok(/team-of-the-season-2025-26-/.test(dl[0].suggestedFilename()),'the saved image carries the season in its name')}
  if(!errs.length)ok(true,id+': no page errors');else ok(false,'page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* not enough rated players: one rated goalkeeper only */
 {const P=J(pf),c={};P.cols.forEach((n,i)=>c[n]=i);const r=P.rows.find(x=>x[c.o]==='GK'),m={};m[r[c.m]]={};m[r[c.m]][r[c.i]]=7;
  ({ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:''}));await ctx.route(/_rt\.json/,x=>x.fulfill({status:200,contentType:'application/json',body:JSON.stringify({k:{},m})}));await pg.goto('http://127.0.0.1:8765/index.html#/toty');await pg.waitForSelector('#tsroot .empty:not(.skel)',{timeout:90000});
  ok(/Not enough rated players/.test(await pg.innerText('#tsroot'))&&!!(await pg.$('#tsf'))&&!errs.length,'one rated goalkeeper only: "Not enough rated players", the choices stay, no error');await ctx.close()}
 {({ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:''}));await ctx.route(/_rt\.json/,x=>x.fulfill({status:200,contentType:'application/json',body:JSON.stringify({k:{},m:{}})}));await pg.goto('http://127.0.0.1:8765/index.html#/toty');await pg.waitForSelector('#tsroot .empty:not(.skel)',{timeout:90000});
  ok(/No PitchAPI ratings/.test(await pg.innerText('#tsroot'))&&!errs.length,'a ratings file with no ratings: the page says so');await ctx.close()}
 {const c2_=await b.newContext();await c2_.route(/_rt\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2_.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/toty');await p2.waitForSelector('#tsroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#tsroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2_.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/_rt\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/toty');
  await p3.waitForSelector('#tsroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#tsroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/toty'});await p3.waitForSelector('.ts-l li',{timeout:90000});
  ok(/not available right now|No PitchAPI ratings/.test(msg)&&!!(await p3.$('.ts-l li')),'a failing ratings file shows a message and is loaded again on the next visit');await c3.close()}
 /* the other five leagues, current season */
 for(const id of IDX.leagues.map(l=>l.id).filter(i=>i!==LG&&IDX.seasons[i]&&J(files(i)[0]))){const [p1,r1]=files(id);let W3;try{W3=world(p1,r1)}catch(e){continue}const Y=xi(W3,0.5);if(!Y.top)continue;
  ({ctx,pg,errs}=await T.open(b,{vw:1100,league:id,hash:'#/toty'}));await pg.waitForSelector('.ts-l li',{timeout:90000});await pg.waitForTimeout(250);
  ok(same(await rowsOf(pg),Y),id+' current season: the XI matches ('+Y.top.f.join('-')+')');await ctx.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/toty'}));await pg.waitForSelector('.ts-l li',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  {const g=await rowsOf(pg),Y=xi(W,0.5);ok(await pg.$$eval('.tr-p',a=>a.length===11)&&g.length===11&&Y.top.t.every((x,i)=>g[i].id===x.id&&g[i].k===x.k&&g[i].bad===x.avg.toFixed(2)),lang+' phone: the same 11 players')}
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#tsroot');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/فريق الموسم/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/toty_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
