/* Season simulator: the expected final points of every club recomputed exactly (no simulation) from the raw files and the
   model's formula, against the page's 10,000 simulations; fixtures left, locks, determinism, cups left out, phones, Arabic */
const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA='/home/user/pl-analytics/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
function model(lid){const lg=IDX.leagues.find(l=>l.id===lid),L=J(lg.file),S=J(lg.sh_file),ix={};S.cols.forEach((c,i)=>ix[c]=i);
 const tx=new Map();S.rows.forEach(r=>{if(r[ix.og])return;const k=r[ix.m]+'|'+r[ix.c],x=r[ix.xg];tx.set(k,(tx.get(k)||0)+(typeof x==='number'&&isFinite(x)?x:0))});
 const sc=s=>{const m=/^(\d+)\s*-\s*(\d+)$/.exec(String(s||''));return m?[+m[1],+m[2]]:null};
 const played=L.matches.filter(m=>sc(m.s)),teams=[...new Set(L.matches.flatMap(m=>[m.h,m.a]))];
 const T=new Map();let hs=0,as=0,n=0;played.forEach(m=>{const xh=tx.get(m.i+'|'+m.h),xa=tx.get(m.i+'|'+m.a);if(xh==null||xa==null)return;n++;hs+=xh;as+=xa;
  [[m.h,xh,xa],[m.a,xa,xh]].forEach(([t,f,a])=>{const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=a;T.set(t,r)})});
 const H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T.get(t)||{n:0,f:0,a:0};return {att:(r.f+3*mu)/(r.n+3)/mu,def:(r.a+3*mu)/(r.n+3)/mu}};
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 const pr=(h,a)=>{const x=str(h),y=str(a),ph=pois(H*x.att*y.def),pa=pois(A*y.att*x.def);let w=0,d=0,l=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}const s=w+d+l;return [w/s,d/s,l/s]};
 const done=new Set(played.map(m=>m.h+'|'+m.a)),left=[];teams.forEach(h=>teams.forEach(a=>{if(h!==a&&!done.has(h+'|'+a))left.push([h,a])}));
 const now=new Map(teams.map(t=>[t,0]));played.forEach(m=>{const g=sc(m.s);if(g[0]>g[1])now.set(m.h,now.get(m.h)+3);else if(g[0]<g[1])now.set(m.a,now.get(m.a)+3);else{now.set(m.h,now.get(m.h)+1);now.set(m.a,now.get(m.a)+1)}});
 const exp=new Map(now);left.forEach(([h,a])=>{const p=pr(h,a);exp.set(h,exp.get(h)+3*p[0]+p[1]);exp.set(a,exp.get(a)+3*p[2]+p[1])});
 return {teams,left,now,exp,pr,played};}
async function open(b,{vw=1280,lang='en',league='l_4WFCIZ',hash='#/sim'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const read=pg=>pg.$$eval('.sm-t tbody tr',a=>a.map(r=>{const c=r.querySelectorAll('td');return {t:r.dataset.t,now:+c[2].textContent,mean:+c[3].querySelector('b').textContent,win:c[4].textContent,top:c[5].textContent,bot:c[6].textContent}}));
const pv=s=>s==='>99%'?99.75:s==='<1%'?.25:parseFloat(s);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const lid of ['l_4WFCIZ','l_0ErfuF','l_3FJFUl']){const X=model(lid),nT=X.teams.length;
  const {ctx,pg,errs}=await open(b,{league:lid});await pg.waitForSelector('.sm-t',{timeout:120000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));ok(nav.indexOf('#/sim')===nav.indexOf('#/table')+1,lid+': in League, right after the table');
  const intro=await pg.textContent('.sm-intro');ok(intro.includes(X.left.length+' matches are left')&&X.left.length+X.played.length===nT*(nT-1),`${lid}: ${X.left.length} matches left = ${nT}×${nT-1} home-and-away pairs − ${X.played.length} played`);
  const rows=await read(pg);
  ok(rows.length===nT&&rows.every(r=>r.now===X.now.get(r.t)),'points now = the results in the league file, every club');
  const worst=rows.map(r=>Math.abs(r.mean-X.exp.get(r.t))).sort((a,b)=>b-a)[0];
  ok(worst<0.35,`expected final points of the 10,000 simulations match the exact expectation of the model for every club (largest gap ${worst.toFixed(2)})`);
  ok(rows.every((r,i)=>!i||rows[i-1].mean>=r.mean),'ordered by expected final points');
  const sw=rows.reduce((s,r)=>s+pv(r.win),0),st=rows.reduce((s,r)=>s+pv(r.top),0),sb=rows.reduce((s,r)=>s+pv(r.bot),0);
  ok(Math.abs(sw-100)<=nT*.6&&Math.abs(st-400)<=nT*.6&&Math.abs(sb-300)<=nT*.6,`chances add up: title ${sw.toFixed(0)}%, top 4 ${st.toFixed(0)}%, bottom 3 ${sb.toFixed(0)}%`);
  /* the fixture picker: the model's chances, a lock moves the numbers by exactly what the lock changes */
  const f0=await pg.$eval('.sm-f',f=>({k:f.dataset.k,p:[...f.querySelectorAll('small')].map(s=>s.textContent)}));const [h,a]=f0.k.split('|'),p=X.pr(h,a);
  ok(f0.p.join(',')===p.map(v=>Math.round(v*100)+'%').join(','),`next fixture ${h} – ${a}: the model's chances ${f0.p.join(' / ')}`);
  await pg.click('.sm-f button[data-o="H"]');await pg.waitForFunction(()=>document.querySelector('.sm-t'),null,{timeout:120000});await pg.waitForTimeout(300);
  const L1=await read(pg),eh=X.exp.get(h)+3-(3*p[0]+p[1]),ea=X.exp.get(a)-(3*p[2]+p[1]);
  const gh=Math.abs(L1.find(r=>r.t===h).mean-eh),ga=Math.abs(L1.find(r=>r.t===a).mean-ea);
  ok(gh<0.35&&ga<0.35&&await pg.$eval('.sm-f button[data-o="H"]',x=>x.classList.contains('on')),`a home win picked: ${h} expected ${eh.toFixed(1)}, ${a} ${ea.toFixed(1)}, as the exact calculation says (gaps ${gh.toFixed(2)}, ${ga.toFixed(2)})`);
  await pg.click('#smclr');await pg.waitForFunction(()=>document.querySelector('.sm-t'),null,{timeout:120000});await pg.waitForTimeout(300);
  ok(JSON.stringify(await read(pg))===JSON.stringify(rows),'clearing the pick gives back the same numbers (fixed seed)');
  await pg.reload();await pg.waitForSelector('.sm-t',{timeout:120000});ok(JSON.stringify(await read(pg))===JSON.stringify(rows),'and so does a new visit');
  /* a club's details */
  const pick=rows[5].t;await pg.click(`.sm-t tr[data-t="${pick}"]`);await pg.waitForTimeout(300);
  const d=await pg.evaluate(()=>({h:document.querySelector('.sm-me h3').textContent.trim(),bars:[...document.querySelectorAll('.sm-me .sm-b')].map(r=>r.getAttribute('data-tip')),on:[...document.querySelectorAll('.sm-me .sm-b')].findIndex(r=>r.classList.contains('on')),txt:document.querySelector('.sm-me').textContent}));
  ok(d.h===pick&&d.bars.length===nT&&/Most likely final place: \d+/.test(d.txt)&&+d.txt.match(/Most likely final place: (\d+)/)[1]===d.on+1,`${pick}: ${nT} bars, the most likely place marked`);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* switching league while the first visit is still loading: the new league's simulation finishes */
 {const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
  await ctx.route(/fixtures\.json/,async r=>{await new Promise(z=>setTimeout(z,3000));r.continue()});
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+'#/sim');await pg.waitForSelector('#smroot',{timeout:60000});
  await pg.selectOption('#lgpick','l_0ErfuF');await pg.waitForFunction(()=>D.id==='l_0ErfuF',null,{timeout:60000});
  await pg.waitForSelector('.sm-t',{timeout:120000}).catch(()=>{});
  ok(await pg.$('.sm-t')&&(await pg.$$eval('.sm-t tbody tr',a=>a.map(r=>r.dataset.t))).includes('Barcelona'),'switching league during the first load: LaLiga\'s simulation finishes (no page stuck on Loading)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 for(const lid of ['l_0bfbkO','l_1XLtP0']){const {ctx,pg,errs}=await open(b,{league:lid});await pg.waitForSelector('#smroot .empty:not(.skel)',{timeout:60000});
  ok(/not a league where every club plays every other/.test(await pg.textContent('#smroot')),lid+': a cup, not simulated');ok(!errs.length,'no page errors');await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,.fx-en,bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI|PPDA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.sm-t',{timeout:120000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));ok(await pg.$eval('#nav a[href="#/sim"]',a=>a.textContent.trim())==='محاكي الموسم','Arabic menu: محاكي الموسم')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
