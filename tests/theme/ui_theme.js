const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const NEW='http://127.0.0.1:8765/index.html',OLD='http://127.0.0.1:8767/index.html';
const LG={pl:'l_4WFCIZ',laliga:'l_0ErfuF',bund:'l_1Isor4',l1:'l_3FJFUl',seriea:'l_0ALvwF',pt:'l_4QexZg',ucl:'l_0bfbkO',wc:'l_1XLtP0'};
const rgb=h=>'rgb('+[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(', ')+')';
async function open(b,url,{vw=1280,lang='en',league='l_4WFCIZ',rm=false}={}){const ctx=await b.newContext({viewport:{width:vw,height:900},reducedMotion:rm?'reduce':'no-preference'});
 await ctx.addInitScript(([l,a])=>{try{localStorage.setItem('league',l);localStorage.setItem('lang',a)}catch(e){}},[league,lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(url+'#/table');await pg.waitForSelector('#app h2',{timeout:60000});return {ctx,pg,errs}}   /* a league page: the overview has its own colour */
const go=async(pg,h,sel)=>{await pg.evaluate(x=>location.hash=x,h);await pg.waitForSelector(sel,{timeout:60000});await pg.waitForTimeout(400)};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* 1. one theme per league, from the configuration; leagues without a checked identity keep the base theme */
 const want={pl:'#c414dc',bund:'#e00215',laliga:'#ff4b44',seriea:'#0064f0',ucl:'#5068d1',l1:'#4cc38a',pt:'#4cc38a',wc:'#4cc38a'},seen={};
 {const {ctx,pg,errs}=await open(b,NEW);
  for(const [k,id] of Object.entries(LG)){await pg.selectOption('#lgpick',id);await pg.waitForFunction(i=>D&&D.id===i,id);await pg.waitForTimeout(500);
   const r=await pg.evaluate(()=>{const s=getComputedStyle(document.documentElement),btn=document.createElement('button');document.body.appendChild(btn);const c=getComputedStyle(btn).backgroundColor;btn.remove();return {th:s.getPropertyValue('--th').trim(),key:document.documentElement.dataset.league,btn:c}});
   seen[k]=r.th;ok(r.th===want[k]&&r.btn===rgb(want[k]),k+': theme '+r.key+' '+r.th+' (primary button '+r.btn+')')}
  const themed=['pl','bund','laliga','seriea','ucl'].map(k=>seen[k]);ok(new Set(themed).size===themed.length,'the five themed leagues all differ');
  await pg.evaluate(()=>location.hash='#/overview');await pg.waitForFunction(()=>document.documentElement.dataset.league==='ov',null,{timeout:30000}).catch(()=>{});
  const ovc=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim());ok(ovc&&!Object.values(seen).includes(ovc),'the overview has its own colour, unlike every league ('+ovc+')');
  await pg.evaluate(()=>location.hash='#/table');await pg.waitForTimeout(800);
  /* contrast of every configured theme, computed in the page from THEME */
  const cr=await pg.evaluate(()=>{const P=[['base',THEME.base],...THEME.leagues.map(t=>[t.key,thLeaguePal(t.ids[0])]),...Object.keys(THEME.clubs).map(n=>[n,thClubPal(n)])];
   return P.map(([k,t])=>{const m=x=>Math.min(thCr(x,t.bg),thCr(x,t.sf));return {k,btn:m(t.th),ink:thCr(t.ink,t.th),hi:m(t.hi),link:m(t.link),mu:m(t.mu),tx:m(t.tx),st:Math.min(...['#4cc38a','#e5646b','#e9b44c','#5aa9e6'].map(m))}})});
  const weak=cr.filter(x=>!(x.btn>=3&&x.ink>=4.5&&x.hi>=3&&x.link>=4.5&&x.mu>=4.5&&x.tx>=7&&x.st>=3));
  ok(!weak.length,'contrast on all '+cr.length+' palettes (base, 5 leagues and every configured club): buttons ≥ 3 on the page, button text/links/muted text ≥ 4.5, text ≥ 7, status colours ≥ 3'+(weak.length?' — '+JSON.stringify(weak):''));
  const tr=await pg.evaluate(()=>getComputedStyle(document.querySelector('#langbtn')).transitionDuration);ok(/0\.35s/.test(tr),'theme changes animate softly ('+tr+')');
  ok(await pg.evaluate(()=>[...document.styleSheets].some(s=>[...s.cssRules].some(r=>/backdrop-filter/.test(r.conditionText||'')))),'a fallback exists for browsers without backdrop-filter');
  ok(!errs.length,'no page errors while switching leagues '+errs.slice(0,2).join(' | '));await ctx.close()}
 {const {ctx,pg}=await open(b,NEW,{rm:true});const tr=await pg.evaluate(()=>getComputedStyle(document.querySelector('#langbtn')).transitionDuration);ok(tr==='0s','reduced motion: no theme transition ('+tr+')');await ctx.close()}
 /* 2. defending champions (Premier League 2026-27: Arsenal, from 2025-26 results) vs the current leader */
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const {ctx,pg,errs}=await open(b,NEW,{vw,lang});const L=s=>lang==='ar'?s.ar:s.en;
  await go(pg,'#/table','#lt .ltr[data-t]');
  const rows=await pg.$$eval('#lt .ltr[data-t]',a=>a.map(x=>({t:x.dataset.t,ch:!!x.querySelector('.chm'),dot:!!x.querySelector('img.clogo,.cdot')})));
  ok(rows.filter(r=>r.ch).map(r=>r.t).join()==='Arsenal',vw+' '+lang+': trophy only next to Arsenal in the table');
  ok(rows[0].ch===(rows[0].t==='Arsenal'),'the first row ('+rows[0].t+') has the champion mark only if it is the defending champion: the mark follows last season, not the table');
  ok(rows.every(r=>r.dot),'every Premier League club shows its logo next to its name');
  await go(pg,'#/club/Arsenal','.clubhd');
  const a=await pg.evaluate(()=>{const h=document.querySelector('.clubhd'),cs=getComputedStyle(h);return {champ:h.classList.contains('is-champ'),badge:(h.querySelector('.champ')||{}).innerText||'',cl1:cs.getPropertyValue('--cl1').trim(),hi:cs.getPropertyValue('--clhi').trim(),th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),gold:getComputedStyle(h.querySelector('.champ')).color,st:h.querySelector('.clubst').getBoundingClientRect(),hb:h.getBoundingClientRect(),k:document.querySelectorAll('.clubk .kpi').length}});
  ok(a.champ&&(lang==='ar'?/حامل اللقب/.test(a.badge):/DEFENDING CHAMPIONS/i.test(a.badge))&&/2025.?26/.test(a.badge),'Arsenal page: gold "Defending champions 2025-26" badge ('+a.badge.replace(/\n/g,' ')+')');
  const bgA=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  ok(a.cl1==='#ef0107'&&a.th==='#ea0107'&&bgA==='#0a1a1e'&&a.gold==='rgb(226, 189, 90)','Arsenal page: drawn in Arsenal red (page '+bgA+', buttons '+a.th+'), gold for the title');
  ok(lang==='ar'?Math.abs(a.st.right-a.hb.right)<2:Math.abs(a.st.left-a.hb.left)<2,'club colour stripe on the reading-start side ('+(lang==='ar'?'right':'left')+')');
  ok(a.k===6,'club page KPIs drawn');
  await go(pg,'#/club/'+encodeURIComponent('Manchester City'),'.clubhd');
  const mc=await pg.evaluate(()=>({champ:!!document.querySelector('.champ'),cl1:getComputedStyle(document.querySelector('.clubhd')).getPropertyValue('--cl1').trim(),pos:document.querySelector('.clubk .kpi b').textContent}));
  const thMC=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim());
  ok(!mc.champ&&mc.cl1==='#6cabdd'&&thMC==='#6cabdd','Manchester City (position '+mc.pos+'): page in sky blue, no champion badge');
  await go(pg,'#/table','#lt .ltr[data-t]');const back=await pg.evaluate(()=>[getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()]);
  ok(back[0]==='#c414dc'&&back[1]==='#0a1a1e','leaving the club page brings back the Premier League purple ('+back.join(' ')+')');
  await go(pg,'#/teams','#app table');const tm=await pg.$$eval('#app table tr',a=>a.slice(1).filter(r=>r.querySelector('.chm')).map(r=>r.cells[0].innerText.trim()));ok(tm.join()==='Arsenal','Teams page: trophy only for Arsenal');
  const ap=await pg.evaluate(()=>{const p=agg().find(x=>x.club==='Arsenal'),q=agg().find(x=>x.club==='Chelsea');return [encodeURIComponent(p.key+'||'+p.club),encodeURIComponent(q.key+'||'+q.club)]});
  await go(pg,'#/player/'+ap[0],'#app h2');ok(!!(await pg.$('#app .champ'))&&!!(await pg.$('#app .clk img.clogo, #app .clk .cdot')),'Arsenal player page: club link with its logo and the champion badge');
  await go(pg,'#/player/'+ap[1],'#app h2');ok(!(await pg.$('#app .champ')),'Chelsea player page: no champion badge');
  for(const h of ['#/overview','#/table','#/club/Arsenal','#/teams']){await go(pg,h,'#app h2');const ov=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(ov<=1,vw+'px '+h+': no horizontal scroll ('+ov+')')}
  await go(pg,'#/club/Arsenal','.clubhd');await pg.screenshot({path:__dirname+'/club_'+vw+'_'+lang+'.png'});
  if(lang==='ar'){const left=await pg.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.querySelector('#app'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[⁦-⁩]/g,'').trim();if(/[A-Za-z]{2}/.test(t))o.push(t)}return [...new Set(o)]});
   const names=await pg.evaluate(()=>new Set([...D.stats.map(s=>s.player),...D.stats.map(s=>s.club),...D.matches.flatMap(m=>[m.home,m.away])]).size);
   const nm=await pg.evaluate(()=>[...new Set([...D.stats.map(s=>s.player),...D.stats.map(s=>s.club),D.name])]);const ns=new Set(nm);
   const latin=t=>/[\u0600-\u06FF]/.test(t)?(t.match(/[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’&-]*){2,}/g)||[]).filter(r=>!nm.some(x=>x.includes(r))).length>0:true;const bad=left.filter(t=>latin(t)&&!ns.has(t)&&!/^(xG|xT|N\/A|PitchAPI)\b/.test(t)&&!/^[A-Z]{1,3}$/.test(t)&&!/ \d+-\d+ /.test(t));ok(!bad.length,'Arabic club page: everything translated except names'+(bad.length?' — '+JSON.stringify(bad.slice(0,8)):''))}
  ok(!errs.length,vw+' '+lang+': no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 /* 3. other leagues: no champion is claimed without verified data */
 {const {ctx,pg}=await open(b,NEW,{league:LG.bund});await go(pg,'#/table','#lt .ltr[data-t]');const chm=await pg.$$eval('#lt .ltr[data-t]',a=>a.filter(x=>x.querySelector('.chm')).map(x=>x.dataset.t));ok(chm.join()==='Bayern München','Bundesliga: champion mark only on Bayern München, verified by the sync from the full 2025-26 season ('+chm.join()+')');
  await go(pg,'#/club/'+encodeURIComponent('Bayern München'),'.clubhd');const r=await pg.evaluate(()=>({c:!!document.querySelector('.champ'),dot:!!document.querySelector('.cdot'),th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim()}));
  ok(r.c&&r.th==='#dc052d'&&!!(await pg.$('.clubhd img.clubimg')),'Bayern page: in Bayern red with its logo and the defending-champion badge ('+r.th+')');await ctx.close()}
 /* 4. statistics and charts: every chart element keeps its colours (baseline = main before this change) */
 const pages=[['#/overview','#app h2'],['#/shots','#app svg'],['#/heatmaps','#app svg'],['#/passing','#app svg'],['#/ppda','#app h2'],['#/defense','#app h2'],['#/players','#app table'],['#/fantasy','#oxout .kpi'],['#/table','#lt .ltf']];
 const snap=async url=>{const {ctx,pg}=await open(b,url);const o={};for(const [h,s] of pages){await go(pg,h,s);await pg.waitForTimeout(h==='#/fantasy'?4000:1200);
   o[h]=await pg.evaluate(()=>[...document.querySelectorAll('#app svg:not(.trophy) *')].map(e=>[e.tagName,e.getAttribute('fill'),e.getAttribute('stroke'),e.getAttribute('fill-opacity'),e.getAttribute('opacity'),e.getAttribute('d')&&e.getAttribute('d').length,e.getAttribute('cx'),e.getAttribute('x')].join('|')).concat([...document.querySelectorAll('#app .bar,#app .ltf')].map(e=>getComputedStyle(e).backgroundColor)))}
  await ctx.close();return o};
 const A=await snap(OLD),B=await snap(NEW);
 for(const [h] of pages){if(h==='#/heatmaps')continue;/* the heat map was redrawn on purpose (smooth colour field), checked in feat/ui_feat.js */const a=A[h],c=B[h];ok(a.length>0?JSON.stringify(a)===JSON.stringify(c):true,h+': '+a.length+' chart elements, colours and geometry identical to before'+(JSON.stringify(a)===JSON.stringify(c)?'':' (diff)'))}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
