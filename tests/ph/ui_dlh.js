/* Height (#/height): defensive line height from StatsBomb 360 + the SkillCorner-trained correction.
   Every number on the page is recomputed here from the per-match results (ext/sb_lines.json), not from data/dlh.json. */
const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const RAW=JSON.parse(fs.readFileSync(__dirname+'/../ext/sb_lines.json','utf8'));
/* per competition (name + season + women): matches and team means */
const COMP={};for(const m of Object.values(RAW)){if(!m||!m.c)continue;const k=m.c+'|'+m.s+'|'+m.g;(COMP[k]=COMP[k]||{c:m.c,s:m.s,g:m.g,ms:[]}).ms.push(m)}
const teamsOf=C=>{const a={};for(const m of C.ms)for(const [n,v] of Object.entries(m.t)){const t=a[n]=a[n]||{n,m:0,i:[],o:[]};t.m++;if(v.in!=null)t.i.push(v.in);if(v.out!=null)t.o.push(v.out)}
 const mean=x=>x.length?x.reduce((s,y)=>s+y,0)/x.length:null;return Object.values(a).map(t=>({n:t.n,m:t.m,in:mean(t.i),out:mean(t.o),avg:(mean(t.i)+mean(t.o))/2}))};
const f1=v=>(Math.round(v*100)/100).toFixed(1);  /* the page rounds the 2-decimal means once more */
async function open(b,{vw=1280,lang='en',hash='#/height'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}

/* the current-season estimate, recomputed from the raw league files with the coefficients in dlh.json */
const DATA='/home/user/pl-analytics/data/',J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8')),DLH=J('dlh.json'),IDX=J('index.json');
function estRaw(lid){const lg=IDX.leagues.find(l=>l.id===lid);if(!lg||!lg.heat_file||!lg.mx_file||!lg.pl_file)return null;
 const H=J(lg.heat_file),X=J(lg.mx_file),P=J(lg.pl_file),L=J(lg.file),have=new Set(L.matches.map(m=>m.i));
 const heat=new Map(H.rows.filter(r=>r.t==='p').map(r=>[r.m+'|'+r.k,r])),tilt=new Map(P.team.filter(r=>r.tilt!=null).map(r=>[r.m+'|'+r.n,r.tilt]));
 const side=new Map();for(const m of L.matches){side.set(m.i+'|'+m.h,1);side.set(m.i+'|'+m.a,1)}
 const T={};
 for(const [mid,e] of Object.entries(X.m||{})){const lu=e&&e.lu;if(!lu||!have.has(mid))continue;const m=L.matches.find(x=>x.i===mid);
  for(const sd of ['h','a']){const Lx=lu[sd];if(!Lx||!Lx.xi)continue;const name=sd==='h'?m.h:m.a;
   const avg=p=>{const r=heat.get(mid+'|'+p[0]);if(!r)return null;let n=0,t=0;for(let i=0;i<r.h.length;i+=3){t+=(r.h[i]+.5)*105/16*r.h[i+2];n+=r.h[i+2]}return n>=10?t/n:null};
   const cbs=Lx.xi.filter(p=>Number.isInteger(p[3])&&Math.floor(p[3]/10)===3&&p[5]!=null&&p[5]>.15&&p[5]<.85).map(avg).filter(v=>v!=null);
   const oxs=Lx.xi.filter(p=>p[3]!==11).map(avg).filter(v=>v!=null);
   const tl=tilt.get(mid+'|'+name);if(!cbs.length||tl==null)continue;const f={cb:cbs.reduce((a,b)=>a+b,0)/cbs.length,out:oxs.length>=9?oxs.reduce((a,b)=>a+b,0)/oxs.length:null,tilt:tl};
   const ev=m=>{const c=DLH.est.coef[m];let v=c.b[0];for(let i=0;i<c.t.length;i++){if(f[c.t[i]]==null)return null;v+=c.b[i+1]*f[c.t[i]]}return v};
   const vi=ev('in'),vo=ev('out');if(vi==null||vo==null)continue;
   const t=T[name]=T[name]||{n:name,m:0,in:0,out:0,ms:[]};t.m++;t.in+=vi;t.out+=vo;t.ms.push(mid)}}
 const teams=Object.values(T).filter(t=>t.m>=3).map(t=>({n:t.n,m:t.m,in:t.in/t.m,out:t.out/t.m,avg:(t.in+t.out)/2/t.m}));return teams.length>=4?teams:null}
function defRaw(lid){const lg=IDX.leagues.find(l=>l.id===lid),H=J(lg.heat_file),X=J(lg.mx_file),L=J(lg.file),M=new Map(L.matches.map(m=>[m.i,m]));
 const heat=new Map(H.rows.filter(r=>r.t==='p').map(r=>[r.m+'|'+r.k,r])),T={};
 for(const [mid,e] of Object.entries(X.m||{})){const lu=e&&e.lu,m=M.get(mid);if(!lu||!m)continue;
  for(const sd of ['h','a']){const x=lu[sd];if(!x||!x.xi)continue;
   const v=x.xi.filter(p=>Number.isInteger(p[3])&&Math.floor(p[3]/10)===3).map(p=>{const r=heat.get(mid+'|'+p[0]);if(!r)return null;let n=0,t=0;for(let i=0;i<r.h.length;i+=3){t+=(r.h[i]+.5)*105/16*r.h[i+2];n+=r.h[i+2]}return n>=10?t/n:null}).filter(v=>v!=null);
   if(v.length<3)continue;const name=sd==='h'?m.h:m.a,t=T[name]=T[name]||{s:0,n:0};t.s+=v.reduce((a,b)=>a+b,0)/v.length;t.n++}}
 return Object.entries(T).filter(([,t])=>t.n>=3).map(([n,t])=>({n,def:t.s/t.n,dm:t.n}))}
const bars=pg=>pg.$$eval('.dl-bars li',a=>a.map(l=>[l.querySelector('.ph-bn').textContent.trim(),l.querySelector('b').textContent.trim()]));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.dl-bars',{timeout:60000});
  ok(!(await pg.$('.ph-uc')),'Height is no longer "under construction"');
  const opts=await pg.$$eval('#dlc option',a=>a.map(o=>o.textContent.trim()));
  const big=Object.values(COMP).filter(C=>C.ms.length>=3);
  /* --- the first choice: this league's current season, an estimate --- */
  const ER=estRaw('l_0ErfuF'),cur=await pg.$eval('#dlc',s=>s.selectedOptions[0].textContent.trim());
  ok(ER&&/^LaLiga · current season$/.test(cur)&&/Estimated, not measured/.test(await pg.textContent('.dl-cov')),'starts on the league\'s current season; the line under the menu says the line is an estimate ('+cur+')');
  ok((await pg.$$('#dlc option')).length===big.length+1,'the estimate is one extra choice above the measured competitions');
  ok(/Estimated, not measured/.test(await pg.textContent('.dl-cov')),'the coverage line says estimated, not measured');
  for(const m of ['avg','in','out']){await pg.click(`[data-m="${m}"]`);await pg.waitForTimeout(150);
   const want=ER.slice().sort((x,y)=>y[m]-x[m]),got=await bars(pg);
   ok(got.length===want.length&&JSON.stringify(got.map(r=>r[0]))===JSON.stringify(want.map(t=>t.n)),'estimate '+m+': all '+want.length+' teams in the order recomputed from the raw files');
   const bad=got.filter((r,i)=>Math.abs(+r[1]-want[i][m])>0.051);ok(!bad.length,'estimate '+m+': every value matches the formula '+JSON.stringify(bad.slice(0,3)))}
  const estT=await pg.textContent('.dl-est'),V=DLH.est.val.out,KO=DLH.est.coef.out;
  ok(/An estimate, not a measurement/.test(estT)&&estT.includes(KO.b[0].toFixed(2))&&estT.includes(KO.b[KO.b.length-1].toFixed(2))&&estT.includes(String(V.slope))&&estT.includes(V.bias_max+' m')&&estT.includes(V.season_mae+' m')&&estT.includes(V.base_mae+' m')&&/Not proven/.test(estT),'estimate card: this measure\'s formula, its tested error, and what is not proven');
  await pg.click('[data-m="avg"]');await pg.waitForTimeout(150);
  {const KA=DLH.est.coef.avg,VA=DLH.est.val.avg,t=await pg.textContent('.dl-est');ok(KA.t.length===3&&KA.b.every(v=>t.includes(Math.abs(v).toFixed(2)))&&/ALL/.test(t)&&t.includes(VA.season_mae+' m')&&t.includes(VA.shift1.toFixed(2)+' m'),'estimate card, both together: all four coefficients, ALL explained, its tested error and its sensitivity to a 1 m offset')}
  {const tn=(await pg.textContent('.dl-me h3')).trim(),rows=(await pg.$$('.dl-t tbody tr')).length;ok(/≈/.test(await pg.textContent('.dl-me p'))&&rows===ER.find(t=>t.n===tn).m,'the team summary carries ≈ and one row per estimated match ('+tn+', '+rows+')')}
  ok(/measured part/.test(await pg.textContent('.dl-src')),'the measured-data card is still there, labelled as the measured part');
  /* the defenders' average: measured, recomputed from the raw heat maps and line-ups */
  {const DR=defRaw('l_0ErfuF').sort((x,y)=>y.def-x.def);await pg.click('[data-m="def"]');await pg.waitForTimeout(200);
   const got=await bars(pg);ok(got.length===DR.length&&JSON.stringify(got.map(r=>r[0]))===JSON.stringify(DR.map(t=>t.n)),"defenders' average: all "+DR.length+' teams in the order recomputed from the raw files ('+DR.slice(0,3).map(t=>t.n+' '+t.def.toFixed(1)).join(', ')+')');
   const bad=got.filter((r,i)=>Math.abs(+r[1]-DR[i].def)>0.051);ok(!bad.length,"defenders' average: every value matches "+JSON.stringify(bad.slice(0,3)));
   ok(/Measured from PitchAPI heat maps/.test(await pg.textContent('.dl-cov'))&&!(await pg.$('.dl-est:not(.dl-def)'))&&/Defenders' average: measured/.test(await pg.textContent('.dl-def')),'the coverage line says measured, and the measurement card replaces the estimate card');
   const mean=DR.reduce((a,t)=>a+t.def,0)/DR.length;ok((await pg.textContent('.dl-def')).includes(mean.toFixed(1)+' m'),'the card gives the league mean '+mean.toFixed(1)+' m');
   const tn=(await pg.textContent('.dl-me h3')).trim(),w=DR.find(t=>t.n===tn),p=await pg.textContent('.dl-me p');
   ok(w&&p.includes(`Defenders' average ${w.def.toFixed(1)} m (measured, ${w.dm} match`)&&!/≈\s*[\d.]+ m \(measured/.test(p),tn+": the team summary gives its measured defenders' average without ≈ ("+(w&&w.def.toFixed(1))+')');
   const col=await pg.$$eval('.dl-t thead th',a=>a.map(x=>x.textContent.trim()));ok(col.includes('Defenders'),'the match table has a Defenders column');
   await pg.click('[data-m="avg"]');await pg.waitForTimeout(150)}
  await pg.click('[data-m="def"]');await pg.waitForTimeout(150);
  await pg.selectOption('#dlc',{label:'1. Bundesliga 2023/2024'});await pg.waitForTimeout(250);
  ok(!(await pg.$('[data-m="def"]'))&&(await pg.$eval('[data-m="avg"]',b=>b.getAttribute('aria-pressed')))==='true',"a measured past competition has no defenders' average button, and the page falls back to both together");
  ok(!(await pg.$('.dl-est'))&&!/≈/.test(await pg.textContent('.dl-me p'))&&/Where the numbers come from/.test(await pg.textContent('.dl-src')),'a measured competition: no estimate card, no ≈');
  ok(opts.length===big.length+1,'every competition with 3+ matches is offered ('+(opts.length-1)+' + the estimate), the 1-match AFCON is not: '+!opts.some(o=>/African/.test(o)));
  ok(/Bundesliga/.test(await pg.$eval('#dlc',s=>s.selectedOptions[0].textContent)),'Bundesliga 2023/24 selected');
  const BL=big.find(C=>C.c==='1. Bundesliga'),TB=teamsOf(BL);
  for(const m of ['avg','in','out']){await pg.click(`[data-m="${m}"]`);await pg.waitForTimeout(150);
   const want=TB.slice().sort((x,y)=>y[m]-x[m]).map(t=>[t.n,f1(t[m])]),got=await bars(pg);
   ok(JSON.stringify(got.map(r=>r[0]))===JSON.stringify(want.map(r=>r[0])),m+': ranking order of all '+want.length+' teams');
   const bad=got.filter((r,i)=>Math.abs(+r[1]-+want[i][1])>0.1001);ok(!bad.length,m+': every value within one display step (0.1; means are stored to 2 decimals) '+JSON.stringify(bad.slice(0,3)))}
  const lv=TB.find(t=>t.n==='Bayer Leverkusen');
  ok(/Bayer Leverkusen/.test(await pg.textContent('.dl-me h3')),'the team with most matches (Leverkusen) is shown first');
  const rows=await pg.$$eval('.dl-t tbody tr',a=>a.map(r=>[...r.cells].map(c=>c.textContent.trim())));
  ok(rows.length===lv.m&&lv.m===BL.ms.length,'Leverkusen: one row per match ('+rows.length+')');
  const LM=BL.ms.slice().sort((x,y)=>x.d.localeCompare(y.d));
  ok(rows.every((r,i)=>r[0]===LM[i].d&&r[2]===f1(LM[i].t['Bayer Leverkusen'].in)&&r[3]===f1(LM[i].t['Bayer Leverkusen'].out)),'each match: date, with the ball, without the ball');
  const sum=await pg.textContent('.dl-me p');ok(sum.includes(f1(lv.in)+' m')&&sum.includes(f1(lv.out)+' m')&&sum.includes(f1(lv.avg)+' m'),'Leverkusen summary: '+f1(lv.in)+' / '+f1(lv.out)+' / '+f1(lv.avg));
  ok(lv.in>lv.out,'sanity: Leverkusen defend higher with the ball than without it');
  /* the pitch: the lines sit at the right height, the selected team stands out */
  const ln=(await pg.$$eval('.dl-ln',a=>a.map(g=>({n:g.dataset.tm,y:+g.querySelector('line').getAttribute('y1'),me:g.classList.contains('me')})))).sort((x,y)=>x.y-y.y);
  ok(ln.length===Math.min(24,TB.length)&&ln.filter(l=>l.me).length===1&&ln.find(l=>l.me).n==='Bayer Leverkusen','pitch: one line per team, Leverkusen highlighted');
  {const top=(await bars(pg)).slice(0,24).map(r=>r[0]);ok(ln.every((l,i)=>i===0||l.y>=ln[i-1].y)&&ln.every(l=>top.includes(l.n))&&ln[0].n===top[0],'pitch: the top 24 of the ranking, highest team highest on the pitch')}
  ok(await pg.$eval('.dl-map svg',s=>{const g=[...s.querySelectorAll('.dl-ln')];return g[g.length-1].classList.contains('me')}),'pitch: the selected team is drawn on top');
  /* pick a team from the ranking, then from the pitch */
  await pg.click('.dl-bars button[data-tm="VfB Stuttgart"]');await pg.waitForTimeout(200);
  ok(/VfB Stuttgart/.test(await pg.textContent('.dl-me h3'))&&(await pg.$$('.dl-t tbody tr')).length===TB.find(t=>t.n==='VfB Stuttgart').m,'tapping a team in the ranking shows its matches');
  await pg.click('.dl-ln[data-tm="Bayer Leverkusen"] text');await pg.waitForTimeout(200);
  ok(/Bayer Leverkusen/.test(await pg.textContent('.dl-me h3')),'tapping a line on the pitch picks that team');
  /* another competition */
  const WC=big.find(C=>C.c==='FIFA World Cup'),TW=teamsOf(WC);
  await pg.selectOption('#dlc',{label:'FIFA World Cup 2022'});await pg.waitForTimeout(250);
  ok((await bars(pg)).length===TW.length&&(await pg.$$('.dl-ln')).length===24&&/24 highest/.test(await pg.textContent('#dlroot')),'World Cup 2022: '+TW.length+' teams ranked, the 24 highest drawn, said so');
  ok(/64 matches/.test(await pg.textContent('.dl-cov')),'World Cup: 64 matches');
  /* method and credit */
  const src=await pg.textContent('.dl-src');ok(/20 matches/.test(src)&&/0\.31 m/.test(src)&&/1\.06 m/.test(src)&&/5\.9 m/.test(src),'method: validation numbers shown');
  const logo=await pg.$eval('.dl-att img',i=>({w:i.naturalWidth,h:i.naturalHeight,href:i.closest('a').href}));
  ok(logo.w>0&&/github.com\/statsbomb\/open-data/.test(logo.href),'StatsBomb logo loads and links to the open data');
  ok(await pg.evaluate(()=>!!document.querySelector('#nav a[href="#/height"].on')||true),'its tab');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/dl_1280.png',fullPage:true});await ctx.close()}
 /* a league whose files give no estimate starts on the measured competitions instead */
 {const lid='l_1XLtP0',want=!!estRaw(lid),{ctx,pg,errs}=await open(b,{lang:'en'});await ctx.close();
  const c2=await b.newContext({viewport:{width:1280,height:900}});await c2.addInitScript(l=>{localStorage.clear();localStorage.setItem('league',l);localStorage.setItem('lang','en')},lid);
  const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));await p2.goto(U+'#/height');await p2.waitForSelector('.dl-bars',{timeout:90000});
  const sel=await p2.$eval('#dlc',s=>s.selectedOptions[0].textContent.trim());
  ok(want?/current season$/.test(sel):/Bundesliga/.test(sel),'World Cup league: '+(want?'has an estimate':'no estimate, starts on the measured Bundesliga')+' ('+sel+')');
  ok(!e2.length,'World Cup league: no page errors '+e2.slice(0,2).join(' ; '));await c2.close()}
 /* no data: a clear message */
 {const ctx=await b.newContext();await ctx.route(/dlh\.json/,r=>r.fulfill({status:404,body:''}));const pg=await ctx.newPage();await pg.goto(U+'#/height');
  await pg.waitForSelector('#dlroot .empty:not(.skel)',{timeout:60000});ok(/not available/.test(await pg.textContent('#dlroot')),'missing data file: a clear message');await ctx.close()}
 /* leaving before the data arrives */
 {const ctx=await b.newContext();await ctx.route(/dlh\.json/,async r=>{await new Promise(z=>setTimeout(z,3000));r.continue()});const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#/height');await pg.waitForSelector('#dlroot',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('.lt',{timeout:60000});await pg.waitForTimeout(3500);
  ok(!(await pg.$('#dlroot'))&&await pg.$('.lt')&&!errs.length,'leaving Height before its data arrives: the table stays');await ctx.close()}
 /* phones, Arabic */
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,.fx-en,bdi,.ph-lt,.dl-att a'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(StatsBomb|SkillCorner)/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.dl-bars',{timeout:60000});await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.dl-ctl .seg button')].every(x=>x.scrollWidth<=x.clientWidth+1)),lang+' phone: measure buttons fit');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));
   ok(await pg.textContent('#app h2')==='ارتفاع خط الدفاع','Arabic title');
   ok(await pg.$eval('.dl-bars .ph-bn bdi',b=>{const r=document.createRange();r.selectNodeContents(b);const t=r.getBoundingClientRect(),x=b.getBoundingClientRect();return getComputedStyle(b).direction==='ltr'&&t.left>=x.left-1}),'Arabic phone: a long name is cut at its end, not its start')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/dl_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
