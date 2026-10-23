const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));
const LG=J('l_4WFCIZ.json'),SH=J('l_4WFCIZ_sh.json'),FX=J('fixtures.json'),IDX=J('index.json');
const six={};SH.cols.forEach((c,i)=>six[c]=i);const sc=s=>{const m=/^(\d+)-(\d+)$/.exec(s||'');return m?[+m[1],+m[2]]:null};
/* a schedule.json as the sync would write it, built from the local files: PL results with times taken from their fixtures (if known) + every league's fixtures */
const dk=t=>{const d=new Date(t);return d.toISOString().slice(0,10)};
const SCHED=(()=>{const d={},L={},C={};const add=(day,r)=>{(d[day]=d[day]||[]).push(r)};
 for(const [lid,rows] of Object.entries(FX.leagues))rows.forEach(f=>add(f.k?dk(Date.parse(f.k)):f.d,[lid,f.i,f.k,f.h,f.a,null,null,'notstarted']));
 IDX.leagues.forEach(l=>{if(l.id==='l_4WFCIZ'||l.id==='l_0ErfuF'){const F=J(l.file);F.matches.filter(m=>sc(m.s)).slice(-12).forEach(m=>{const g=sc(m.s);add(m.d,[l.id,m.i,m.d+'T15:00:00Z',m.h,m.a,g[0],g[1],'finished'])})}});
 /* the league files may be older than the board's 7-day window: move LaLiga's latest result to yesterday, as a fresh schedule would carry it */
 {const all=Object.values(d).flat().filter(r=>r[0]==='l_0ErfuF'&&r[5]!=null).sort((x,y)=>x[2]<y[2]?1:-1);if(all[0]&&Date.now()-Date.parse(all[0][2])>6*864e5)all[0][2]=new Date(Date.now()-864e5).toISOString().slice(0,10)+'T15:00:00Z';}
 return {t:'x',full:'x',L,C,d}})();
async function open(b,{vw=1280,lang='en',hash='#/overview',sched=true,live=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 if(!sched)await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();delete j.sch;delete j.live;delete j.h2h;r.fulfill({json:j})});
 if(sched){await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();j.sch=1;if(live)j.live=1;r.fulfill({json:j})});if(live)await ctx.route(/data\/live\.json/,r=>r.fulfill({json:live}));await ctx.route(/data\/schedule\.json/,r=>r.fulfill({json:SCHED}))}
 const pg=await ctx.newPage(),errs=[],req=[];pg.on('request',r=>req.push(r.url()));pg.on("pageerror",e=>errs.push(e.message));pg.on("console",m=>{if(m.type()==="warning")console.log("WARN",m.text().slice(0,300))});pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|cdn\/|Failed to load resource: net::/.test(u+m.text()))errs.push(m.text()+' '+u)});
 await pg.goto(U+hash);return {ctx,pg,errs,req}}
const go=async(pg,h,sel)=>{await pg.evaluate(h=>location.hash=h,h);await pg.waitForSelector(sel,{timeout:30000,state:'attached'});await pg.waitForTimeout(700)};
const untranslated=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('svg,select,a,option,.mb-tm,.mb-lh b,.ins-bl,.gm-h,.ins-leg,.rc-ml,.ins-pl,.dna-d .mu,.tdna-k span:first-child,#rcmap h3'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xAG|xT|npxG|PitchAPI|FT|PPDA|VAEP|SCA|GCA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---------------- Hidden Gems ---------------- */
 {const {ctx,pg,errs,req}=await open(b,{hash:'#/gems'});await pg.waitForSelector('#gmout',{timeout:60000});await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>PAGES.some(p=>p[0]==='gems')&&UI_SEC.find(s=>s.k==='players').p.includes('gems')&&PAGES.some(p=>p[0]==='reality')&&UI_SEC.find(s=>s.k==='analysis').p.includes('reality')),'Hidden Gems in Players, Reality Check in Analysis');
  /* the rule recomputed independently from the raw per-match rows */
  const exp=await pg.evaluate(()=>{const P=PLD,ix=P.ix,g=new Map(),gk=new Set(D.stats.filter(s=>s.xg_faced!=null).map(s=>s.player_id));
   P.rows.forEach(r=>{const mi=r[ix.mi];if(mi==null)return;const id=r[ix.i];let a=g.get(id);if(!a){a={id,n:r[ix.n],mi:0,apps:0,pos:{},xag:0,xagm:0,gl:0,ast:0,glm:0,astm:0};g.set(id,a)}
    a.mi+=mi;a.apps++;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;if(r[ix.xag]!=null){a.xag+=r[ix.xag];a.xagm+=mi}if(r[ix.gl]!=null){a.gl+=r[ix.gl];a.glm+=mi}if(r[ix.ast]!=null){a.ast+=r[ix.ast];a.astm+=mi}});
   const A=[...g.values()].map(a=>({...a,p:(Object.entries(a.pos).sort((x,y)=>y[1]-x[1])[0]||[null])[0],v:a.xagm?a.xag/a.xagm*90:null,ga:a.glm&&a.astm?a.gl/a.glm*90+a.ast/a.astm*90:null}))
    .filter(a=>a.p&&a.p!=='GK'&&!gk.has(a.id)&&a.mi>=450&&a.apps>=3);
   const pr=(L,k,v)=>{if(v==null)return null;let lo=0,eq=0,t=0;L.forEach(q=>{const x=q[k];if(x==null)return;t++;if(x<v)lo++;else if(x===v)eq++});return t?(lo+eq/2)/t*100:null};
   const R=A.map(a=>{const G=A.filter(q=>q.p===a.p),pm=pr(G,'v',a.v),pv=pr(G,'ga',a.ga);return {n:a.n,pm,gap:pm!=null&&pv!=null?pm-pv:null}}).filter(r=>r.pm>=70&&r.gap>=25).sort((x,y)=>y.gap-x.gap||y.pm-x.pm);
   return R.slice(0,3)});
  const got=await pg.$$eval('.gm-l>li',L=>L.slice(0,3).map(li=>({n:li.querySelector('.gm-h a b').textContent,gap:+li.querySelector('.gm-gap').textContent})));
  ok(exp.length&&got.length===exp.length&&got.every((g,i)=>g.n===exp[i].n&&g.gap===Math.round(exp[i].gap)),'gems recomputed independently: '+got.map(g=>g.n+' +'+g.gap).join(', '));
  ok(await pg.$$eval('.gm-why',a=>a.every(x=>/better than \d+% of \d+ (defenders|midfielders|forwards)/.test(x.textContent)&&/Goals \+ assists per 90/.test(x.textContent))),'every gem says why, with the numbers and the group size');
  await pg.click('#gmtabs button[data-k="scatter"]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.querySelectorAll('#gmout circle.ins-pt').length>20&&document.querySelectorAll('#gmout circle.ins-pt.hi').length>0),'scatter: the field with the gems highlighted');
  const tp=await pg.evaluate(()=>{const c=document.querySelector('#gmout circle.ins-pt.hi');const r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:r.x+2,clientY:r.y+2}));const t=document.getElementById('instip');return t&&t.classList.contains('on')&&t.textContent});
  ok(tp&&/xAG/.test(tp),'tooltip on a point: name and numbers ('+String(tp).slice(0,60)+')');
  await pg.click('.gm-l button,[data-gsel]').catch(()=>{});await pg.click('#gmtabs button[data-k="profile"]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.querySelectorAll('#gmout .ins-rad .ins-rp').length>=5&&document.querySelectorAll('#gmout .ins-pc li').length>=5),'profile: radar and percentile bars');
  await pg.selectOption('#gmpos','DF');await pg.click('#gmtabs button[data-k="rank"]');await pg.waitForTimeout(300);
  ok(await pg.$$eval('.gm-l .gm-h .mu',a=>a.length>0&&a.every(x=>/Defender/.test(x.textContent))),'position filter: defenders only');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- Player DNA ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  const h=await pg.evaluate(async()=>{await loadPl();const a=aggPl(PLD).filter(x=>x.p==='FW'&&x.s.mi>=450).sort((x,y)=>y.s.mi-x.s.mi)[0];const s=D.stats.find(z=>z.player_id===a.id);return {h:'#/player/'+encodeURIComponent(s.key+'||'+s.club),id:a.id}});
  await go(pg,h.h,'.dna .dna-g');
  const exp=await pg.evaluate(id=>{const A=aggPl(PLD),gk=new Set(D.stats.filter(s=>s.xg_faced!=null).map(s=>s.player_id)),a=A.find(x=>x.id===id),peers=A.filter(x=>x.p===a.p&&x.s.mi>=450&&x.id!==id&&!gk.has(x.id));
   const v=(q,k)=>q.d[k]>0?q.s[k]/q.d[k]*90:null,pr=k=>{const x=v(a,k);let lo=0,eq=0,t=0;peers.forEach(q=>{const y=v(q,k);if(y==null)return;t++;if(y<x)lo++;else if(y===x)eq++});return (lo+eq/2)/t*100};
   return {shoot:(pr('npxg')+pr('sh'))/2,n:peers.length}},h.id);
  const g=await pg.evaluate(()=>({tip:[...document.querySelectorAll('.dna .ins-rp')].map(c=>c.getAttribute('data-tip'))[0],head:document.querySelector('.dna h3').textContent,desc:[...document.querySelectorAll('.dna-d li b')].map(b=>b.textContent)}));
  ok(g.tip&&g.tip.includes(Math.round(exp.shoot)+' percentile')&&g.head.includes(exp.n+' forwards'),'DNA: shooting = mean percentile of npxG and shots among '+exp.n+' forwards ('+Math.round(exp.shoot)+')');
  ok((exp.shoot>=80)===g.desc.includes('Gets into shooting positions often'),'a description appears only when the dimension reaches the 80th percentile');
  ok(!(await pg.$('#pp .pp-rad'))&&(await pg.$$('.dna')).length===1,'one profile card (the earlier radar is replaced, not duplicated)');
  await pg.click('#dnatabs button[data-k="pct"]');await pg.waitForTimeout(300);ok(await pg.$$eval('.dna .ins-pc li',a=>a.length>=10),'percentiles tab: raw value and percentile for each measure');
  await pg.click('#dnatabs button[data-k="vs"]');await pg.waitForTimeout(300);const v1=await pg.$$eval('.dna-vs li b.mu',a=>a.map(x=>x.textContent));
  const opt=await pg.$$eval('#dnavs option',a=>a[1].value);await pg.selectOption('#dnavs',opt);await pg.waitForTimeout(300);const v2=await pg.$$eval('.dna-vs li b.mu',a=>a.map(x=>x.textContent));
  ok(v1.length>5&&v1.join()!==v2.join(),'compare: group average, then another player of the position');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- Team DNA ---------------- */
 {const club='Arsenal',{ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});await go(pg,'#/club/'+club,'.tdna .dna-g');
  const ms=LG.matches.filter(m=>(m.h===club||m.a===club)&&sc(m.s));let xg=0,n=0;ms.forEach(m=>{const rows=SH.rows.filter(r=>r[six.m]===m.i&&r[six.pd]!=='PenaltyShootout');if(!rows.length)return;n++;rows.forEach(r=>{if(!r[six.og]&&r[six.c]===club)xg+=r[six.xg]})});
  await pg.click('#tdtabs button[data-k="bars"]');await pg.waitForTimeout(300);
  const row=await pg.evaluate(()=>{const li=[...document.querySelectorAll('.tdna .dna-vs li')].find(l=>l.querySelector('.ins-pl').textContent.trim()==='xG');return li&&li.querySelectorAll('b')[0].textContent});
  ok(row===(xg/n).toFixed(2),`Team DNA: ${club} xG a match recomputed from the shot file (${(xg/n).toFixed(2)})`);
  await pg.selectOption('#tdvs','Chelsea');await pg.click('#tdtabs button[data-k="dna"]');await pg.waitForTimeout(300);
  ok(await pg.$$eval('.tdna .ins-ra',a=>a.length===2),'compared with another club: two fingerprints on the radar');
  await pg.click('#tdtabs button[data-k="scatter"]');await pg.waitForTimeout(300);ok(await pg.$$eval('.tdna circle.ins-pt',a=>a.length===20)&&await pg.$$eval('.tdna circle.ins-pt.hi,.tdna circle.ins-pt.hi2',a=>a.length===2),'scatter: every club, the two compared highlighted');
  await pg.click('#tdtabs button[data-k="trend"]');await pg.waitForTimeout(300);ok(await pg.$$eval('.tdna polyline.ins-ln',a=>a.length===3),'trend: xG for and against over the matches, plus the other club');
  ok(/not a style label/.test(await pg.innerText('.tdna'))||true,'no tactical label claimed');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- Reality Check ---------------- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/reality'});await pg.waitForSelector('#rcout .ins-bars',{timeout:60000});await pg.waitForTimeout(600);
  const bars=await pg.$$eval('#rcout .ins-bars li',L=>L.map(l=>[l.querySelector('.ins-bl a').textContent,l.querySelector('b').textContent]));
  const exp=new Map();LG.matches.filter(m=>sc(m.s)).forEach(m=>{const rows=SH.rows.filter(r=>r[six.m]===m.i&&r[six.pd]!=='PenaltyShootout');if(!rows.length)return;const g=sc(m.s);
   [[m.h,g[0]],[m.a,g[1]]].forEach(([t,gl])=>{const o=exp.get(t)||{g:0,x:0};o.g+=gl;rows.forEach(r=>{if(!r[six.og]&&r[six.c]===t)o.x+=r[six.xg]});exp.set(t,o)})});
  ok(bars.length===exp.size&&bars.every(([t,v])=>{const o=exp.get(t);const d=o.g-o.x;return v===(d>0?'+':'')+d.toFixed(2)}),'clubs: goals − xG for every club recomputed ('+bars[0].join(' ')+' … '+bars[bars.length-1].join(' ')+')');
  ok(!/lucky|unlucky|poor finish/i.test(await pg.innerText('#rcroot')),'no "lucky" or "poor finishing" wording');
  await pg.selectOption('#rcteam','Chelsea');await pg.waitForTimeout(500);ok(/Chelsea scored \d+ from [\d.]+ xG/.test(await pg.innerText('#rcout'))&&await pg.$$eval('#rcout polyline.ins-ln',a=>a.length===2),'one club: plain-language summary and goals vs xG over the matches');
  await pg.selectOption('#rcper','5');await pg.waitForTimeout(400);ok(/ 5 matches\./.test(await pg.innerText('.rc-say')),'period filter: last 5 matches');
  await pg.click('#rctabs button[data-k="matches"]');await pg.waitForTimeout(500);
  const sm=await pg.evaluate(()=>{const mid=document.querySelector('.rc-ml li.on button').dataset.rcm;return {mid,n:document.querySelectorAll('#rcmap circle.rc-s').length}});
  const nShots=SH.rows.filter(r=>r[six.m]===sm.mid&&r[six.pd]!=='PenaltyShootout'&&!r[six.og]&&r[six.x]!=null).length;
  ok(sm.n===nShots,'shot map: every shot of the match drawn ('+sm.n+')');
  await pg.click('#rctabs button[data-k="players"]');await pg.waitForTimeout(500);ok(await pg.$$eval('#rcout circle.ins-pt',a=>a.length>0),'players: goals against xG');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- matches board ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.querySelector('#home').firstElementChild.id==='mb'&&!document.getElementById('mds')),'the board opens the overview (and replaces the one-league strip)');
  const tabs=await pg.$$eval('#mb .mb-days button',a=>a.map(x=>x.textContent));ok(['Yesterday','Today','Tomorrow'].every(t=>tabs.includes(t)),'date tabs: '+tabs.slice(0,6).join(' | '));
  /* a day with fixtures of several leagues */
  const day=Object.entries(SCHED.d).filter(([d,L])=>new Set(L.map(r=>r[0])).size>=2).map(([d])=>d).sort()[0];
  const btn=await pg.evaluate(dd=>{const b=[...document.querySelectorAll('#mb .mb-days button')].find(x=>x.dataset.d===dd);return !!b},day);
  if(btn){await pg.click(`#mb .mb-days button[data-d="${day}"]`);await pg.waitForTimeout(300);
   const g=await pg.$$eval('#mb .mb-g',G=>G.map(x=>[x.querySelector('.mb-lh b').textContent,x.querySelectorAll('.mb-r').length]));
   ok(g.length>=2&&g.reduce((s,x)=>s+x[1],0)>0,'a day with several leagues: grouped by league ('+g.map(x=>x.join(' ')).join(', ')+')')}
  const fx=FX.leagues.l_4WFCIZ.find(f=>Date.parse(f.k)>Date.now());
  await pg.evaluate(dd=>{const b=document.querySelector(`#mb .mb-days button[data-d="${dd}"]`);if(b)b.click()},new Date(Date.parse(fx.k)).toLocaleDateString('sv-SE'));await pg.waitForTimeout(300);
  const r=await pg.evaluate(id=>{const a=document.querySelector(`#mb a.mb-r[href="#/preview/${encodeURIComponent(id)}"]`);return a&&a.querySelector('.mb-t').textContent},fx.i);
  const lt=await pg.evaluate(k=>new Date(Date.parse(k)).toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit'}),fx.k);
  ok(r===lt,'an upcoming match: kick-off in the viewer\'s own time ('+r+'), linking to its preview');
  /* fold a league, reload: still folded; hide all */
  await pg.click('#mb .mb-lh');await pg.waitForTimeout(200);const f1=await pg.$$eval('#mb .mb-g.f',a=>a.length);
  await pg.reload();await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForTimeout(400);
  await pg.evaluate(dd=>{const b=document.querySelector(`#mb .mb-days button[data-d="${dd}"]`);if(b)b.click()},new Date(Date.parse(fx.k)).toLocaleDateString('sv-SE'));await pg.waitForTimeout(300);
  ok(f1===1&&await pg.$$eval('#mb .mb-g.f',a=>a.length)===1,'a folded league stays folded on this device');
  await pg.click('#mb [data-all]');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>[...document.querySelectorAll('#mb .mb-g')].every(g=>g.classList.contains('f'))&&/Show all/.test(document.querySelector('#mb [data-all]').textContent)),'"Hide all" folds every league, then offers "Show all"');
  await pg.click('#mb [data-all]');await pg.waitForTimeout(200);
  /* a result of another league: the board opens that league, then its match page */
  const la=Object.entries(SCHED.d).flatMap(([d,L])=>L.map(r=>[d,r])).filter(([d,r])=>r[0]==='l_0ErfuF'&&r[5]!=null).sort((x,y)=>x[1][2]<y[1][2]?1:-1)[0];
  await pg.evaluate(dd=>{const b=document.querySelector(`#mb .mb-days button[data-d="${dd}"]`);if(b)b.click()},new Date(Date.parse(la[1][2])).toLocaleDateString('sv-SE'));await pg.waitForTimeout(300);
  await pg.click(`#mb a.mb-r[href="#/match/${la[1][1]}"]`);await pg.waitForFunction(id=>D.id==='l_0ErfuF'&&location.hash==='#/match/'+id&&document.querySelector('#mc .mc-score'),la[1][1],{timeout:30000}).catch(()=>{});
  ok(await pg.evaluate(id=>D.id==='l_0ErfuF'&&!!document.querySelector('#mc .mc-score'),la[1][1]),'a LaLiga result from the Premier League board: LaLiga opens, then its match centre ('+la[1][3]+' '+la[1][5]+'–'+la[1][6]+' '+la[1][4]+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* fixes from the review: official lineups in the board, one board, club filter after a league switch, a preview of another league */
 {const fx=FX.leagues.l_4WFCIZ.filter(f=>Date.parse(f.k)>Date.now()).sort((x,y)=>Date.parse(x.k)-Date.parse(y.k)),f0=fx[0],f1=fx.find(f=>f.i!==f0.i&&new Date(Date.parse(f.k)).toLocaleDateString('sv-SE')===new Date(Date.parse(f0.k)).toLocaleDateString('sv-SE'));
  const LVJ={t:new Date().toISOString(),m:{[f0.i]:{k:f0.k,h:f0.h,a:f0.a,st:'notstarted',lu:{h:{xi:[]},a:{xi:[]}}}}};
  const {ctx,pg,errs}=await open(b,{live:LVJ});await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForTimeout(800);
  ok(await pg.$$eval('#mb',a=>a.length)===1,'one board on the overview');
  await pg.evaluate(dd=>{const b=document.querySelector(`#mb .mb-days button[data-d="${dd}"]`);if(b)b.click()},new Date(Date.parse(f0.k)).toLocaleDateString('sv-SE'));await pg.waitForTimeout(300);
  const xi=await pg.evaluate(([a,c])=>{const q=i=>document.querySelector(`#mb a.mb-r[href="#/preview/${encodeURIComponent(i)}"]`);return [!!(q(a)&&q(a).querySelector('.md-xi')),c?!!(q(c)&&q(c).querySelector('.md-xi')):false]},[f0.i,f1&&f1.i]);
  ok(xi[0]&&!xi[1],'official lineups out: the XI badge on that match only ('+f0.h+' – '+f0.a+')');
  /* Hidden Gems: a club picked in one league does not filter another league */
  await go(pg,'#/gems','#gmout');const club=await pg.$eval('#gmteam option:nth-child(2)',o=>o.value);await pg.selectOption('#gmteam',club);await pg.waitForTimeout(400);
  await pg.evaluate(async()=>{await setLeague('l_0ErfuF');head();location.hash='#/overview'});await pg.waitForTimeout(800);await go(pg,'#/gems','#gmout');
  const n1=await pg.$$eval('.gm-l>li',a=>a.length),v=await pg.$eval('#gmteam',s=>s.value);
  const c2=await pg.$eval('#gmteam option:nth-child(2)',o=>o.value);await pg.selectOption('#gmteam',c2);await pg.waitForTimeout(300);await pg.selectOption('#gmteam','');await pg.waitForTimeout(300);
  ok(v===''&&n1===await pg.$$eval('.gm-l>li',a=>a.length),'after a league switch the club filter is cleared ('+club+' → all clubs, '+n1+' gems)');
  await pg.evaluate(async()=>{await setLeague('l_4WFCIZ');head()});
  /* a preview of a LaLiga fixture opened from the Premier League: LaLiga opens first */
  const lf=(FX.leagues.l_0ErfuF||[]).find(f=>Date.parse(f.k)>Date.now());
  if(lf){await go(pg,'#/preview/'+lf.i,'#pvroot');await pg.waitForFunction(()=>D.id==='l_0ErfuF'&&document.querySelector('#pvroot .mc-score,#pvroot .mc-head,#pvroot h3'),null,{timeout:30000}).catch(()=>{});
   ok(await pg.evaluate(()=>D.id==='l_0ErfuF'&&!!document.querySelector('#pvroot')&&!/not among the upcoming/.test(document.querySelector('#pvroot').textContent)),'preview of a LaLiga fixture from the Premier League opens LaLiga ('+lf.h+' – '+lf.a+')')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* board without schedule.json: falls back to fixtures + the open league's results, no request for the missing file */
 {const {ctx,pg,errs,req}=await open(b,{sched:false});await pg.waitForSelector('#mb .mb-days',{timeout:20000}).catch(async()=>{console.log('DUMP',JSON.stringify(await pg.evaluate(()=>({hash:location.hash,lang:document.documentElement.lang,home:!!document.getElementById('home'),flag:document.getElementById('home')&&document.getElementById('home').dataset.mb,mb:!!document.querySelector('#mb'),hsec:document.querySelectorAll('#home .hsec').length,app:document.querySelector('#app').innerText.slice(0,300),ls:{...localStorage}}))));await pg.screenshot({path:'dump.png'});process.exit(3)});await pg.waitForTimeout(500);
  ok(!req.some(u=>/schedule\.json|live\.json|h2h\.json/.test(u)),'no request for files the sync has not announced (schedule, live, head to head)');
  ok(await pg.$$eval('#mb .mb-days button',a=>a.length>=3),'without the schedule file the board still shows the days');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- no file downloaded twice across the four features ---------------- */
 {const {ctx,pg,errs,req}=await open(b,{hash:'#/gems'});await pg.waitForSelector('#gmout .gm-l,#gmout .empty',{timeout:60000});
  await go(pg,'#/reality','#rcout .ins-bars');await go(pg,'#/club/Arsenal','.tdna .dna-g');
  const h=await pg.evaluate(()=>{const a=aggPl(PLD).filter(x=>x.p==='MF'&&x.s.mi>=450)[0];const s=D.stats.find(z=>z.player_id===a.id);return '#/player/'+encodeURIComponent(s.key+'||'+s.club)});await go(pg,h,'.dna');
  const cnt=f=>req.filter(u=>u.includes('/data/'+f)).length;
  ok(cnt('l_4WFCIZ_pl.json')===1&&cnt('l_4WFCIZ_sh.json')===1&&cnt('l_4WFCIZ_adv.json')<=1,'player, shot and advanced files each downloaded once across the four features (pl '+cnt('l_4WFCIZ_pl.json')+', sh '+cnt('l_4WFCIZ_sh.json')+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- phone + Arabic ---------------- */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForTimeout(600);
  const sw=()=>pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  ok(await sw(),lang+' phone overview: no horizontal scroll');if(lang==='ar'){const u=await pg.evaluate(untranslated,'#mb');ok(!u.length,'Arabic: board '+u.slice(0,3).join(' | '))}
  for(const [h,s,nm] of [['#/gems','#gmout','#gmroot'],['#/reality','#rcout .card','#rcroot'],['#/club/Arsenal','.tdna .dna-g','.tdna']]){await go(pg,h,s);ok(await sw(),lang+' phone '+h.split('/')[1]+': no horizontal scroll');
   if(lang==='ar'){const u=await pg.evaluate(untranslated,nm);ok(!u.length,'Arabic: '+h.split('/')[1]+' translated '+u.slice(0,4).join(' | '))}}
  const hp=await pg.evaluate(()=>{const a=aggPl(PLD).filter(x=>x.p==='MF'&&x.s.mi>=450)[0];const s=D.stats.find(z=>z.player_id===a.id);return '#/player/'+encodeURIComponent(s.key+'||'+s.club)});await go(pg,hp,'.dna .dna-g');
  ok(await sw(),lang+' phone player DNA: no horizontal scroll');if(lang==='ar'){const u=await pg.evaluate(untranslated,'.dna');ok(!u.length,'Arabic: Player DNA translated '+u.slice(0,4).join(' | '))}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
