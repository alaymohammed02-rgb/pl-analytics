const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const SH=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/l_4WFCIZ_sh.json','utf8')),six={};SH.cols.forEach((c,i)=>six[c]=i);
async function open(b,{vw=1280,lang='en',league='l_4WFCIZ',hash='#/heatmaps'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);await pg.waitForTimeout(3500);return {ctx,pg,errs}}
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 /* ---- Heat Map: unchanged by default, threat layer on demand ---- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#hout svg',{timeout:30000});
  ok(await pg.evaluate(()=>/Heatmaps/.test(document.querySelector('#app h2').textContent)&&location.hash==='#/heatmaps'),'Heat Map keeps its name and place');
  ok(await pg.evaluate(()=>document.getElementById('tml').value==='a'&&document.getElementById('hout').style.display!=='none'&&!document.querySelector('#tmout').innerHTML),'default layer is the existing activity map, drawn by the page\'s own code');
  const cells0=await pg.$$eval('#hout svg rect',a=>a.length);
  const sm=await pg.evaluate(()=>{const im=document.querySelector('#hout svg image.heat-smooth'),cnt=[...document.querySelectorAll('#hout svg rect title')].length,lg=document.querySelector('#hout div[style*="linear-gradient"]');return {img:!!im&&/^data:image\/png/.test(im.getAttribute('href')),w:im&&im.getAttribute('width'),cnt,leg:lg&&/rgba\(220, ?40, ?38/.test(lg.getAttribute('style')),top:/Busiest area \(top cell: \d+ actions\)/.test(document.getElementById('hout').innerText)}});
  ok(sm.img&&sm.w==='105','activity map: one smooth density image over the whole pitch (no grid squares)');
  ok(sm.cnt>0,'each active cell still shows its exact count on hover ('+sm.cnt+' cells)');
  ok(sm.leg&&sm.top,'the legend shows the green-to-red scale and the busiest cell');
  await pg.selectOption('#tml','t');await pg.waitForSelector('#tmout .tm-pitch svg',{timeout:30000});
  const t=await pg.evaluate(()=>({mid:$('#hm').value,team:$('#ht').value,dots:document.querySelectorAll('#tmout .tm-pitch circle.tm-shot').length,goals:document.querySelectorAll('#tmout .tm-pitch circle.tm-shot.g').length,k:[...document.querySelectorAll('#tmout .kpi b')].map(x=>x.textContent),hidden:document.getElementById('hout').style.display==='none'}));
  const exp=SH.rows.filter(r=>r[six.m]===t.mid&&r[six.c]===t.team&&!r[six.og]&&r[six.pd]!=='PenaltyShootout'),xg=exp.reduce((s,r)=>s+r[six.xg],0),gl=exp.filter(r=>r[six.ev]==='Goal').length;
  ok(t.hidden&&t.dots===exp.length&&t.goals===gl,`threat layer: one circle per shot of ${t.team} (${t.dots}), goals filled (${t.goals})`);
  ok(t.k[0]==String(exp.length)&&t.k[1]==String(gl)&&t.k[3]===xg.toFixed(2),'shots, goals and xG match the shot file ('+t.k.slice(0,4).join(', ')+')');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#tmout .kpi span')].some(s=>/xT, match total/.test(s.textContent))),'xT shown as PitchAPI\'s match total (no per-zone xT invented)');
  ok(/not by an invented threat value/.test(await pg.innerText('#tmout')),'the honest note explains activity vs threat');
  /* a player */
  const pid=await pg.evaluate(()=>{const o=[...$('#hp').options].find(o=>o.value);return o?o.value:null});
  if(pid){await pg.selectOption('#hp',pid);await pg.waitForTimeout(600);const n=await pg.$$eval('#tmout .tm-pitch circle.tm-shot',a=>a.length);const e=SH.rows.filter(r=>r[six.m]===t.mid&&r[six.pid]===pid&&!r[six.og]).length;
   ok(n===e,'picking a player shows only his shots ('+n+')');if(!e)ok(/had no shots in this match/.test(await pg.innerText('#tmout')),'a player without shots gets a clear message')}
  /* combined layer, both-teams view */
  await pg.selectOption('#tml','c');await pg.selectOption('#hv','b');await pg.waitForTimeout(900);
  const c=await pg.evaluate(()=>({act:[...document.querySelectorAll('#tmout svg rect')].filter(r=>/90,169,230/.test(r.getAttribute('fill')||'')).length,dots:document.querySelectorAll('#tmout .tm-pitch circle.tm-shot').length,mid:$('#hm').value}));
  const both=SH.rows.filter(r=>r[six.m]===c.mid&&!r[six.og]&&r[six.pd]!=='PenaltyShootout').length;
  ok(c.act>0&&c.dots===both,'activity + shots: activity cells in blue under every shot of both teams ('+c.act+' cells, '+c.dots+' shots)');
  await pg.selectOption('#tml','a');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.getElementById('hout').style.display!=='none'&&!document.querySelector('#tmout').innerHTML),'back to activity: the original map is shown again');
  ok(await pg.evaluate(()=>{try{return localStorage.getItem('plx_tm_layer')==='a'}catch(e){return false}}),'the chosen layer is remembered (plx_tm_layer)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- missing data: a league without heatmaps keeps its message; a match without shots says so ---- */
 {const {ctx,pg,errs}=await open(b,{league:'l_1XLtP0'});ok(await pg.evaluate(()=>!document.getElementById('tml')&&/No heatmap data/.test(document.getElementById('app').innerText)),'World Cup (no heatmaps): the page keeps its own message, no threat controls');ok(!errs.length,'no page errors');await ctx.close()}
 {const {ctx,pg,errs}=await open(b);await pg.route(/_sh\.json/,r=>r.fulfill({json:{cols:SH.cols,rows:[]}}));await pg.evaluate(()=>{SHD=null});
  await pg.selectOption('#tml','t');await pg.waitForTimeout(800);ok(/returned no shots for this match/.test(await pg.innerText('#tmout')),'a match without shots: a clear message, nothing invented');ok(!errs.length,'no page errors');await ctx.close()}
 /* ---- Match What-If ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/whatif'});await pg.waitForSelector('#wiout .wi-score',{timeout:30000});
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#nav a')].some(a=>a.getAttribute('href')==='#/whatif')&&UI_SEC.find(s=>s.k==='league').p.includes('whatif')),'Match What-If has its own page in the League section of the menu');
  ok(await pg.evaluate(()=>!document.querySelector('#app .tm-pitch')&&/Hypothetical/.test(document.querySelector('.wi-warn').textContent)),'separate from the Heat Map, with the hypothetical warning');
  const m=await pg.evaluate(()=>{const id=$('#wim').value,m=D.matches.find(x=>x.match_id===id);return {id,s:m.score,home:m.home,away:m.away}});
  const real=m.s.split('-').map(Number),shots=SH.rows.filter(r=>r[six.m]===m.id&&!r[six.og]);
  const nong=shots.find(r=>r[six.ev]!=='Goal'),goal=shots.find(r=>r[six.ev]==='Goal');
  const sc=()=>pg.$eval('.wi-s',e=>e.textContent.replace(/[⁦-⁩\s]/g,''));
  ok((await sc())===real.join('–'),'scenario starts at the real score '+real.join('-'));
  if(nong){await pg.click(`button.wi-b[onclick="wiToggle('${nong[six.s]}')"]`);await pg.waitForTimeout(300);const e=real.slice();e[nong[six.c]===m.home?0:1]++;
   ok((await sc())===e.join('–'),'making a missed shot a goal adds one to that team ('+(await sc())+')');}
  if(goal){await pg.click(`button.wi-b[onclick="wiToggle('${goal[six.s]}')"]`);await pg.waitForTimeout(300);const e=real.slice();if(nong)e[nong[six.c]===m.home?0:1]++;e[goal[six.c]===m.home?0:1]--;
   ok((await sc())===e.join('–'),'and making a goal a miss takes one away ('+(await sc())+')');}
  ok(await pg.evaluate(()=>document.querySelectorAll('#wiout tr.wi-chg').length)===(nong?1:0)+(goal?1:0),'changed shots are highlighted');
  const k=await pg.$$eval('#wiout .kpi b',a=>a.map(x=>x.textContent));const xh=shots.filter(r=>r[six.c]===m.home).reduce((s,r)=>s+r[six.xg],0);
  ok(k[0].replace(/[⁦-⁩]/g,'').startsWith(xh.toFixed(2)),'xG stays the real xG ('+k[0]+')');
  const pr=k[1].split('/').map(x=>parseInt(x));ok(Math.abs(pr.reduce((a,b)=>a+b,0)-100)<=2,'win / draw / loss odds from the xG add up to 100% ('+k[1]+')');
  if(nong||goal)ok(await pg.$('#wiout h3:text("League table if this had happened")')!==null,'the league table shows the scenario\'s effect');
  await pg.click('#wir');await pg.waitForTimeout(300);ok((await sc())===real.join('–'),'Reset returns to the real score');
  ok(await pg.$$eval('#wiout .wi-tab tr',a=>a.length)===SH.rows.filter(r=>r[six.m]===m.id&&r[six.pd]!=='PenaltyShootout').length+1,'every shot of the match is listed');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
  /* a match page links to its What-If */
  await pg.evaluate(id=>location.hash='#/match/'+id,m.id);await pg.waitForTimeout(2500);
  ok(await pg.evaluate(id=>!!document.querySelector('.wi-link a[href="#/whatif/'+id+'"]'),m.id),'the match page links to its What-If');
  await pg.click('.wi-link a');await pg.waitForSelector('#wiout .wi-score');ok(await pg.$eval('#wim',(e,id)=>e.value===id,m.id),'and opens that match');
  await ctx.close()}
 /* own goals cannot be changed; incomplete shot lists are flagged */
 {const og=SH.rows.find(r=>r[six.og]);if(og){const {ctx,pg,errs}=await open(b,{hash:'#/whatif/'+og[six.m]});await pg.waitForSelector('#wiout .wi-score',{timeout:30000});
  ok(await pg.$$eval('#wiout tr.wi-og',a=>a.length&&a.every(t=>!t.querySelector('button'))),'own goals are listed but cannot be changed');await ctx.close()}}
 {const {ctx,pg}=await open(b,{hash:'#/whatif',league:'l_1XLtP0'});await pg.waitForSelector('#wiout .wi-score',{timeout:30000});
  const bad=await pg.evaluate(async()=>{const S=await loadSh();for(const m of D.matches.filter(x=>wkSc(x.score))){const L=S.rows.filter(r=>r.m===m.match_id&&r.pd!=='PenaltyShootout');if(!L.length)continue;const g=wkSc(m.score),f={[m.home]:0,[m.away]:0};L.forEach(r=>{if(r.ev!=='Goal')return;if(r.og)f[r.c===m.home?m.away:m.home]++;else f[r.c]++});if(f[m.home]!==g[0]||f[m.away]!==g[1])return m.match_id}return null});
  if(bad){await pg.selectOption('#wim',bad);await pg.waitForTimeout(500);ok(/shot list for this match is incomplete/.test(await pg.innerText('#wiout')),'a match whose shot list misses goals is flagged, and the scenario starts from the real score')}else ok(true,'no incomplete shot list to flag');await ctx.close()}
 /* Arabic phone */
 {const {ctx,pg,errs}=await open(b,{vw:390,lang:'ar',hash:'#/whatif'});await pg.waitForSelector('#wiout .wi-score',{timeout:30000});
  const left=await pg.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.getElementById('app'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,table,.ctl,.wi-t,.wi-sw'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xT|PitchAPI)/.test(t))o.push(t)}return [...new Set(o)]});
  ok(!left.length,'Arabic: What-If translated '+left.slice(0,4).join(' | '));
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),'phone: no horizontal scroll on What-If');
  await pg.evaluate(()=>location.hash='#/heatmaps');await pg.waitForSelector('#tml',{timeout:30000});await pg.selectOption('#tml','t');await pg.waitForSelector('#tmout .tm-pitch svg');
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),'phone: no horizontal scroll on the threat map');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
