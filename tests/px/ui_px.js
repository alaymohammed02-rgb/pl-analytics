const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA='/home/user/pl-analytics/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));
const MX=J('l_4WFCIZ_mx.json'),RT=J('l_4WFCIZ_rt.json'),SH=J('l_4WFCIZ_sh.json'),LG=J('l_4WFCIZ.json'),PL=J('l_4WFCIZ_pl.json'),HT=J('l_4WFCIZ_heat.json'),FX=J('fixtures.json');
const six={};SH.cols.forEach((c,i)=>six[c]=i);const pix={};PL.cols.forEach((c,i)=>pix[c]=i);
async function open(b,{vw=1280,lang='en',hash='#/round'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900},acceptDownloads:true});
 /* the matches board and Player DNA (tested in px/ui_ins.js) replace the one-league strip and the radar card; without them those are drawn, as tested here */
 await ctx.route(/assets\/(matches-board|player-dna)\.js/,r=>r.fulfill({body:'',contentType:'application/javascript'}));
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const go=async(pg,h,sel)=>{await pg.evaluate(h=>location.hash=h,h);await pg.waitForSelector(sel,{timeout:30000,state:'attached'});await pg.waitForTimeout(800)};
const pngSize=f=>{const b=fs.readFileSync(f);return b.slice(0,8).toString('hex')==='89504e470d0a1a0a'?[b.readUInt32BE(16),b.readUInt32BE(20)]:null};
const untranslated=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('svg,select,.mc-sh b,.hcl,a,.pp-meta,.md-tm,.mc-leg,.potr-l,.mc-cn,.mc-subs li>span:not([class]),.mc-rl li>span:not([class]),.ms-en,.ms bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xAG|xT|PitchAPI|FT)\b/.test(t))o.push(t)}});return [...new Set(o)]};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const mid=Object.keys(MX.m).find(k=>MX.m[k].lu&&MX.m[k].mo&&RT.m[k]),M=LG.matches.find(m=>m.i===mid),E=MX.m[mid],R=RT.m[mid];
 /* ---------------- match centre ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  await go(pg,'#/match/'+mid,'#mc .mc-score');
  const sh=SH.rows.filter(r=>r[six.m]===mid&&r[six.pd]!=='PenaltyShootout'),xg=t=>sh.filter(r=>r[six.c]===t&&!r[six.og]).reduce((a,r)=>a+r[six.xg],0);
  const sc=await pg.evaluate(()=>({res:document.querySelector('.mc-res b').textContent,xg:document.querySelector('.mc-res .mu').textContent,motm:document.querySelector('.mc-motm a').textContent,mr:document.querySelector('.mc-motm i').textContent}));
  const [hs,as]=M.s.split('-');ok(sc.res===hs+' – '+as,'scoreboard: the real score ('+sc.res+')');
  ok(sc.xg===`xG ${xg(M.h).toFixed(2)} – ${xg(M.a).toFixed(2)}`,'scoreboard xG = the sum of the shot file, own goals left out ('+sc.xg+')');
  const best=Object.entries(R).sort((a,b)=>b[1]-a[1])[0];ok(sc.mr===best[1].toFixed(1),'player of the match = the highest PitchAPI rating ('+sc.motm+' '+sc.mr+')');
  const race=await pg.evaluate(()=>{const s=document.querySelector('.mc-race svg.w');return {ends:[...s.querySelectorAll('.mc-end')].map(t=>t.textContent),goals:s.querySelectorAll('.mc-g').length}});
  const gl=sh.filter(r=>r[six.ev]==='Goal'||r[six.og]).length;
  ok(race.ends[0]===xg(M.h).toFixed(2)&&race.ends[1]===xg(M.a).toFixed(2)&&race.goals===gl,`xG race ends at each side's xG and marks every goal (${race.goals} = ${+hs + +as} scored)`);
  ok(gl===+hs + +as,'the goals marked add up to the real score');
  const mo=await pg.evaluate(()=>{const s=document.querySelector('.mc-mo svg.w');return {up:[...s.querySelectorAll('rect')].filter(r=>r.getAttribute('fill')!=='#e6e3dc').length,dn:[...s.querySelectorAll('rect[fill="#e6e3dc"]')].length}});
  ok(mo.up===E.mo.filter(p=>p[1]>0).length&&mo.dn===E.mo.filter(p=>p[1]<0).length,`momentum: one bar a point, home above (${mo.up}) away below (${mo.dn})`);
  const lu=await pg.evaluate(()=>{const s=document.querySelector('.mc-pitch.h');const c=[...s.querySelectorAll('.mc-p circle')].map(c=>[+c.getAttribute('cx'),+c.getAttribute('cy')]);return {n:c.length,chips:s.querySelectorAll('.mc-lab rect').length,caps:s.querySelectorAll('.mc-cap').length,c}});
  const xi=[...E.lu.h.xi,...E.lu.a.xi];ok(lu.n===xi.length,'lineups: every starter on the pitch ('+lu.n+')');
  const gkH=E.lu.h.xi.reduce((a,p)=>p[4]<a[4]?p:a),gkA=E.lu.a.xi.reduce((a,p)=>p[4]<a[4]?p:a);
  ok(Math.abs(lu.c[E.lu.h.xi.indexOf(gkH)][0]-gkH[4]*52.5)<.01&&Math.abs(lu.c[E.lu.h.xi.length+E.lu.a.xi.indexOf(gkA)][0]-(105-gkA[4]*52.5))<.01,'home keeper at the left goal, away keeper at the right (pitch_x = own goal → opponent)');
  const lb=E.lu.h.xi.reduce((a,p)=>p[5]<a[5]?p:a);ok(lu.c[E.lu.h.xi.indexOf(lb)][1]<20,'home: pitch_y near 0 (its left flank) drawn at the top when attacking →');
  ok(lu.chips===xi.filter(p=>R[p[0]]!=null).length&&lu.caps===xi.filter(p=>p[6]).length,'a rating chip for every rated starter, captain marked');
  const rl=await pg.$$eval('.mc-rl li',a=>a.length);ok(rl===[...E.lu.h.xi,...E.lu.h.sb,...E.lu.a.xi,...E.lu.a.sb].filter(p=>R[p[0]]!=null).length,'ratings list: every rated player of both sides ('+rl+')');
  ok(!(await pg.$$eval('#app h3',a=>a.some(x=>x.textContent.trim()==='Other tabs'))),'the outdated "lineups not available" note is gone');
  ok(await pg.$eval('.mc-rl li.best a',a=>a.textContent)===sc.motm,'the best-rated player is starred');
  /* share */
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#mc .shr-btn')]);const f='/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/px/share_match.png';await dl.saveAs(f);
  ok(JSON.stringify(pngSize(f))==='[1080,1350]'&&/\.png$/.test(dl.suggestedFilename()),'Share as image: a 1080×1350 PNG ('+dl.suggestedFilename()+')');
  /* a match without the new data: no centre sections that would claim anything */
  const old=LG.matches.find(m=>!MX.m[m.i]&&m.t==='ok'&&!RT.m[m.i]);
  if(old){await go(pg,'#/match/'+old.i,'#mc .mc-score');ok(!(await pg.$('.mc-lu'))&&!(await pg.$('.mc-mo'))&&!!(await pg.$('.mc-race')),'a match not fetched yet: scoreboard and xG race only, nothing invented')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- player page ---------------- */
 const pid=Object.entries(R).sort((a,b)=>b[1]-a[1])[0][0];const st=LG.stats.find(s=>s.i===pid);
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  await go(pg,'#/player/'+encodeURIComponent(st.k+'||'+st.c),'#pp .pp-head');
  const rows=PL.rows.filter(r=>r[pix.i]===pid&&r[pix.mi]!=null);
  const k=await pg.$$eval('.pp-k div',a=>a.map(d=>[d.querySelector('span').textContent,d.querySelector('b').textContent]));
  const sum=c=>rows.reduce((a,r)=>a+(r[pix[c]]||0),0);
  ok(k[0][1]===String(rows.length)&&k[1][1]===String(Math.round(sum('mi')))&&k[2][1]===String(sum('gl'))&&k[4][1]===sum('xg').toFixed(2),'profile numbers match the per-match player file ('+k.map(x=>x.join(' ')).join(', ')+')');
  const rs=rows.map(r=>RT.m[r[pix.m]]&&RT.m[r[pix.m]][pid]).filter(v=>v!=null),avg=rs.reduce((a,b)=>a+b,0)/rs.length;
  ok(await pg.$eval('.pp-rt b',e=>e.textContent)===avg.toFixed(2),'average rating over his rated matches ('+avg.toFixed(2)+', '+rs.length+')');
  const fc=await pg.$$eval('.pp-fc',a=>a.map(x=>({r:(x.querySelector('.pp-rc')||{}).textContent,v:x.querySelector('.pp-bv').textContent})));
  ok(fc.length===Math.min(10,rows.length),'form: his last '+fc.length+' matches');
  const hr=HT.rows.filter(r=>r.t==='p'&&r.k===pid),tot=hr.reduce((a,r)=>{for(let i=2;i<r.h.length;i+=3)a+=r.h[i];return a},0);
  if(hr.length)ok((await pg.innerText('.pp-heat')).includes(tot+' actions')&&!!(await pg.$('.pp-heat image.heat-smooth')),'season heat map = the sum of his '+hr.length+' match maps ('+tot+' actions)');
  ok(!(await pg.$$eval('#app h3',a=>a.some(x=>x.textContent.trim()==='Other sections'))),'the outdated "heatmap, radar not available" note is gone');
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#pp .shr-btn')]);const f='/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/px/share_player.png';await dl.saveAs(f);
  ok(JSON.stringify(pngSize(f))==='[1080,1350]','player card shared as a 1080×1350 PNG');
  /* radar: a regular with enough minutes and a known position */
  const reg=await pg.evaluate(()=>{const a=aggPl(PLD).filter(x=>x.p&&x.p!=='GK'&&x.s.mi>=450).sort((x,y)=>y.s.mi-x.s.mi)[0];const s=D.stats.find(s=>s.player_id===a.id);return {key:s.key,club:s.club,p:a.p}});
  await go(pg,'#/player/'+encodeURIComponent(reg.key+'||'+reg.club),'#pp .pp-rad');
  const rd=await pg.evaluate(p=>{const L=[...document.querySelectorAll('.pp-pl li')].map(l=>+l.lastElementChild.textContent);return {n:L.length,ok:L.every(v=>v>=0&&v<=100),pts:document.querySelectorAll('.pp-rad circle.a').length}},reg.p);
  ok(rd.n===6&&rd.pts===6&&rd.ok,'radar: 6 measures for a '+reg.p+', each a percentile 0–100');
  const chk=await pg.evaluate(()=>{const S=[...document.querySelectorAll('.pp-pl li')][0],lab=S.firstElementChild.textContent,M=MET.find(m=>m[1]===lab);const h2=document.querySelector('#app h2').textContent;
   const all=aggPl(PLD),me=all.find(a=>a.n===h2.trim())||all.find(a=>document.querySelector('#app').innerText.includes(a.n)&&a.s.mi>=450);
   const peers=all.filter(x=>x.s.mi>=450&&x.id!==me.id&&x.p===me.p),v=M[3](me,{});let lo=0,eq=0,t=0;peers.forEach(q=>{const x=M[3](q,{});if(x==null)return;t++;if(x<v)lo++;else if(x===v)eq++});
   return {shown:+S.lastElementChild.textContent,calc:Math.round((lo+eq/2)/t*100)}});
  ok(chk.shown===chk.calc,'radar percentile recomputed independently: '+chk.shown);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- home: matchday strip and player of the round ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#potr .potr-c',{timeout:60000,state:'attached'});await pg.waitForTimeout(800);
  const h=await pg.evaluate(()=>({first:document.querySelector('#home').firstElementChild.id,up:document.querySelectorAll('#mds .md-c.up').length,res:document.querySelectorAll('#mds a.md-c:not(.up)').length,round:HOME.c.round.length,cd:document.querySelector('#mds .hhd .md-cd').textContent,
   order:[...document.querySelectorAll('#home .hsec .hhd h2')].map(x=>x.textContent)}));
  const now=Date.now(),L=FX.leagues.l_4WFCIZ.map(f=>Date.parse(f.k)).filter(t=>t>now).sort((a,b)=>a-b),d0=new Date(L[0]);d0.setHours(0,0,0,0);
  ok(h.first==='mds','the matchday strip opens the home');
  ok(h.up===L.filter(t=>t<d0.getTime()+4*864e5).length,'next matchday: every fixture within 4 days of the next kick-off ('+h.up+')');
  ok(h.res===h.round,'latest results: the matches of the round shown on the home ('+h.res+')');
  ok(/^\d+d \d+h$|^\d+h \d\dm$|^\d+:\d\d$/.test(h.cd),'live countdown to the next kick-off ('+h.cd+')');
  await pg.waitForTimeout(1200);const cd2=await pg.$eval('#mds .md-c.up .md-cd',e=>e.textContent);ok(/\d/.test(cd2),'each fixture has its own countdown ('+cd2+')');
  ok(h.order.indexOf('Player of the round')===h.order.indexOf('Stars of the round')-1,'Player of the round sits just before Stars of the round');
  const P=await pg.evaluate(()=>({n:document.querySelector('.potr-n').textContent,r:document.querySelector('.potr-r').textContent}));
  const round=new Set(await pg.evaluate(()=>HOME.c.round.map(m=>m.match_id)));let best=null;
  for(const m of round){for(const [p,v] of Object.entries(RT.m[m]||{})){const row=PL.rows.find(r=>r[pix.m]===m&&r[pix.i]===p);if(!row||row[pix.mi]<45)continue;if(!best||v>best.v||(v===best.v&&row[pix.mi]>best.mi))best={v,n:row[pix.n],mi:row[pix.mi]}}}
  ok(best&&P.n===best.n&&P.r===best.v.toFixed(1),'player of the round = highest rating in the round with 45+ minutes ('+P.n+' '+P.r+')');
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#potr .shr-btn')]);const f='/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/px/share_potr.png';await dl.saveAs(f);
  ok(JSON.stringify(pngSize(f))==='[1080,1350]','player of the round shared as a PNG');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- a league without the new files: nothing breaks, nothing shown ---------------- */
 {const {ctx,pg,errs}=await open(b);await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();j.leagues.forEach(l=>{delete l.mx_file;delete l.rt_file});r.fulfill({json:j})});
  await pg.reload();await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(2500);
  ok(await pg.evaluate(()=>{const p=document.getElementById('potr');return !p||p.hidden||!p.innerHTML}),'no ratings file: no Player of the round');
  await go(pg,'#/match/'+mid,'#mc .mc-score');ok(!(await pg.$('.mc-lu'))&&!(await pg.$('.mc-rts'))&&!(await pg.$('.mc-motm a')),'no lineup/rating files: those parts are simply absent');
  await go(pg,'#/player/'+encodeURIComponent(st.k+'||'+st.c),'#pp .pp-head');ok(!(await pg.$('.pp-rt'))&&!(await pg.$('.pp-rc')),'player page without ratings: no rating badge or chips');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- phone + Arabic ---------------- */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('#potr .potr-c',{timeout:60000,state:'attached'});await pg.waitForTimeout(1000);
  const sw=async()=>pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  ok(await sw(),lang+' phone home: no horizontal scroll');
  if(lang==='ar')ok(!(await pg.evaluate(untranslated,'#mds,#potr')).length,'Arabic: matchday strip and player of the round translated '+(await pg.evaluate(untranslated,'#mds,#potr')).slice(0,4).join(' | '));
  await go(pg,'#/match/'+mid,'#mc .mc-lu');
  ok(await sw(),lang+' phone match centre: no horizontal scroll');
  ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.mc-pitch.v')).display!=='none'&&getComputedStyle(document.querySelector('.mc-pitch.h')).display==='none'&&getComputedStyle(document.querySelector('.mc-race svg.n')).display!=='none'),'phone: vertical pitch and the narrow charts');
  if(lang==='ar')ok(!(await pg.evaluate(untranslated,'#mc')).length,'Arabic: match centre translated '+(await pg.evaluate(untranslated,'#mc')).slice(0,4).join(' | '));
  await go(pg,'#/player/'+encodeURIComponent(st.k+'||'+st.c),'#pp .pp-head');await pg.waitForTimeout(600);
  ok(await sw(),lang+' phone player page: no horizontal scroll');
  if(lang==='ar')ok(!(await pg.evaluate(untranslated,'#pp')).length,'Arabic: player page translated '+(await pg.evaluate(untranslated,'#pp')).slice(0,4).join(' | '));
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- shots that carry a team id instead of the club name (Liga Portugal) ---------------- */
 {const LP=J('l_4QexZg.json'),SP=J('l_4QexZg_sh.json'),ix={};SP.cols.forEach((c,i)=>ix[c]=i);
  const bad=LP.matches.find(m=>m.s&&/^\d+-\d+$/.test(m.s)&&SP.rows.some(r=>r[ix.m]===m.i)&&SP.rows.filter(r=>r[ix.m]===m.i).every(r=>r[ix.c]!==m.h&&r[ix.c]!==m.a));
  if(bad){const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4QexZg');localStorage.setItem('lang','en')}});
   const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+'#/round');await pg.waitForSelector('#home .hsec',{timeout:60000});
   await go(pg,'#/match/'+bad.i,'#mc .mc-score');const r=await pg.evaluate(()=>{const s=document.querySelector('.mc-race svg.w');return {xg:document.querySelector('.mc-res .mu').textContent,h:s.querySelectorAll('.mc-g.h').length,a:s.querySelectorAll('.mc-g.a').length}});
   const [h,a]=bad.s.split('-').map(Number);
   ok(r.h===h&&r.a===a&&!/xG 0\.00/.test(r.xg),`a match whose shots carry team ids (${bad.h} ${bad.s} ${bad.a}): goals on the right sides (${r.h}-${r.a}), ${r.xg}`);
   ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
  else ok(true,'(no match with team-id shots in the data any more)')}
 /* ---------------- the feature files arrive after the page has been drawn ---------------- */
 {const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
  await ctx.route(/assets\/matches-board\.js/,r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await ctx.route(/assets\/(home-extra|player-page|match-centre)\.js/,async r=>{await new Promise(z=>setTimeout(z,4000));r.continue()});
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#/round');await pg.waitForSelector('#mds',{timeout:60000,state:'attached'}).catch(()=>null);await pg.waitForTimeout(2500);
  ok(await pg.evaluate(()=>!!document.getElementById('mds')&&!!document.querySelector('#potr .potr-c')),'home drawn before the file arrived: the strip and player of the round are still added');
  await pg.goto(U+'#/match/'+mid);await pg.waitForSelector('#mc .mc-score',{timeout:60000,state:'attached'}).catch(()=>null);
  ok(!!(await pg.$('#mc .mc-score'))&&(await pg.$$('#mc')).length===1,'match page opened directly: the centre appears once');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- PWA ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  const man=await pg.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const m=await (await fetch(l.href)).json();const ic=await Promise.all(m.icons.map(async i=>{const r=await fetch(new URL(i.src,l.href));const bl=await r.blob();const im=await createImageBitmap(bl);return [i.sizes,im.width+'x'+im.height,i.purpose]}));
   return {m,ic,theme:document.querySelector('meta[name=theme-color]').content,apple:!!document.querySelector('link[rel=apple-touch-icon]')}});
  ok(man.m.display==='standalone'&&man.m.start_url==='./'&&man.m.scope==='./','manifest: installable, opens standalone at the site root (works under /pl-analytics/)');
  ok(man.ic.every(([s,real])=>s===real)&&man.ic.some(i=>i[2]==='maskable'),'icons: real sizes match the manifest, a maskable one included ('+man.ic.map(i=>i[1]).join(', ')+')');
  ok(man.theme==='#0d1520'&&man.apple,'theme colour and Apple touch icon');
  ok(await pg.evaluate(()=>!navigator.serviceWorker.controller&&[...document.scripts].some(s=>/serviceWorker\.register\('sw\.js'\)/.test(s.textContent)&&/https:/.test(s.textContent))),'service worker registered only on https (the live site), not on this local test server');
  /* the worker itself: register it here by hand, then go offline */
  await pg.evaluate(async()=>{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready});
  await pg.reload();await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(1500);
  ok(await pg.evaluate(()=>!!navigator.serviceWorker.controller),'the service worker controls the page after a reload');
  const ck=await pg.evaluate(async()=>{const c=await caches.open('pla-v3');const u=(await c.keys()).map(r=>new URL(r.url)),k=u.map(x=>x.pathname);return {n:k.length,q:new Set(k).size!==k.length,idx:k.some(x=>/index\.html$/.test(x)),data:k.filter(x=>/\/data\//.test(x)).length,cdn:k.some(x=>!x.startsWith('/'))}});
  ok(ck.idx&&ck.data>0&&!ck.q,'it keeps the last copy of the page and data files, one per file (no ?v= duplicates): '+ck.n+' files');
  await ctx.setOffline(true);await pg.reload();await pg.waitForSelector('#home .hsec',{timeout:30000}).catch(()=>null);
  ok(await pg.evaluate(()=>!!document.querySelector('#home .hsec')),'offline: the site still opens from the saved copy');
  await ctx.setOffline(false);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
