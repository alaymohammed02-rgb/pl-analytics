/* Very rare cases page: every case of data/rare.json (made by the engine test from the raw files) shown in its league, with its rarity */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const RARE=fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/rare.json','utf8'),X=JSON.parse(RARE);
const IDX=JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/index.json','utf8'));
const strip=s=>s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
async function open(b,{vw=1280,lang='en',league='l_1Isor4',flag=true}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch();const j=await res.json();if(flag)j.rr='t1';else delete j.rr;r.fulfill({response:res,body:JSON.stringify(j)})});
 await ctx.route(/data\/rare\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:RARE}));
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/rare');return {ctx,pg,errs}}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const lg of IDX.leagues.filter(l=>!/World Cup/.test(l.name))){const L=X.leagues[lg.id]||{rare:[],near:[]};
  const {ctx,pg,errs}=await open(b,{league:lg.id});await pg.waitForSelector('.rr-hero',{timeout:90000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));
  const got=await pg.$$eval('.rr-c',a=>a.map(c=>({k:c.dataset.k,near:c.classList.contains('near'),s:c.querySelector('.rr-s .fx-en').textContent,b:c.querySelector('.rr-b b').textContent,r:c.querySelector('.rr-r .fx-en').textContent,links:[...c.querySelectorAll('.rr-a a')].map(a=>a.getAttribute('href'))})));
  const exp=[...L.rare.map(c=>({c,near:false})),...L.near.map(c=>({c,near:true}))];
  const teams=new Set(JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/'+lg.file,'utf8')).matches.flatMap(m=>[m.h,m.a])).size,season=/Champions/.test(lg.name)?null:teams*(teams-1);
  const good=got.length===exp.length&&got.every((g,i)=>{const {c,near}=exp[i],per=Math.round(c.N/c.n);return g.k===c.k&&g.near===near&&strip(g.s)===strip(c.en)&&g.b.replace(/\s/g,'')==='1/'+per
   &&g.r.includes(`Happened in ${c.n} of the ${c.N} matches`)&&g.r.includes(`about once every ${per} matches`)&&(season?g.r.includes(`season (${season} matches)`):!/season \(/.test(g.r))&&g.links[0]==='#/match/'+encodeURIComponent(c.m)});
  ok(good&&+(await pg.textContent('.rr-n'))===L.rare.length,`${lg.name}: ${L.rare.length} very rare + ${L.near.length} almost, each with its sentence, "1 / N", "k of N" and the season line (${season||'cup: none'})`);
  if(lg.id==='l_1Isor4'){ok(nav.indexOf('#/rare')===nav.indexOf('#/round')+1,'in League, right after This round');
   const late=got.find(g=>g.k==='late');ok(late&&/about once every 1\.5 seasons/.test(late.r),'Bundesliga, 1 in 464 matches, 306 a season: "about once every 1.5 seasons"');
   ok(got.filter(g=>/^pl_|^rating$/.test(g.k)).every(g=>g.links.length===1)&&got.filter(g=>!/^pl_|^rating$/.test(g.k)).every(g=>g.links[1]&&g.links[1].startsWith('#/replay/')),'shot events link to the replay, player numbers to the match centre only');
   await pg.click('.rr-ch [data-l="l_4WFCIZ"]');await pg.waitForFunction(()=>D.id==='l_4WFCIZ',null,{timeout:60000});await pg.waitForSelector('.rr-hero',{timeout:60000});
   ok(+(await pg.textContent('.rr-n'))===X.leagues.l_4WFCIZ.rare.length&&/Premier League/.test(await pg.textContent('.rr-hero')),'another competition from the chips: its own cases')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {const {ctx,pg,errs}=await open(b,{league:'l_1XLtP0'});await pg.waitForSelector('.rr-hero',{timeout:90000});
  ok(+(await pg.textContent('.rr-n'))===0&&/No case that rare/.test(await pg.textContent('#rrroot')),'World Cup: none (left out of the counting)');await ctx.close()}
 {const {ctx,pg,errs}=await open(b,{flag:false});await pg.waitForSelector('#rrroot .empty:not(.skel)',{timeout:90000});
  ok(/after the next one/.test(await pg.textContent('#rrroot')),'before the first sync writes the file: says when it will appear');ok(!errs.length,'no page errors');await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,.fx-en,bdi,.rr-ch button'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.rr-c',{timeout:90000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));ok(await pg.$eval('#nav a[href="#/rare"]',a=>a.textContent.trim())==='حالات نادرة جدا جدا','Arabic menu: حالات نادرة جدا جدا');
   ok(await pg.$$eval('.rr-c .rr-s .fx-ar',a=>a.every(e=>getComputedStyle(e).display!=='none'&&/[؀-ۿ]/.test(e.textContent))),'Arabic: every case shown in Arabic')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
