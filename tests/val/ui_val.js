/* Value vs points (assets/value-points.js). Recomputed from the data files by the test's own loops, for the six leagues: each club's squad (players with a row in the player file, at the club
   of his last row), the priced players and the sum of their Transfermarkt values (data/tm.json), the finished matches (played, points, points a game), the line (ordinary least squares of
   points a game on ln(value in millions) over the clubs with 60%+ of the squad priced, a value and 3+ matches), r with its Fisher interval, the slope per doubling, each club's expected points
   a game and the gap; the three orders; the chart (one dot per club with a value, left to right by value, bottom to top by points, hollow when left out of the line, the line's direction, no
   label hidden under another); the six leagues table and the pooled r over each league's own z-scores; the empty file, a failing file, a competition that is not a domestic league, a past
   season, leaving early; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const DOMEST=l=>l&&l.file&&l.sh_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
const TM=J('tm.json'),LGS=IDX.leagues.filter(DOMEST).slice(0,6);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
function ols(xs,ys){const n=xs.length,mx=mean(xs),my=mean(ys);let sxx=0,sxy=0,syy=0;xs.forEach((x,i)=>{sxx+=(x-mx)**2;sxy+=(x-mx)*(ys[i]-my);syy+=(ys[i]-my)**2});if(!(sxx>0&&syy>0))return null;const b=sxy/sxx,a=my-b*mx,r=sxy/Math.sqrt(sxx*syy),sse=ys.reduce((s,y,i)=>s+(y-(a+b*xs[i]))**2,0);
 const z=Math.atanh(r),se=1/Math.sqrt(n-3);return {n,a,b,r,se:Math.sqrt(sse/(n-2)/sxx),lo:Math.tanh(z-1.96*se),hi:Math.tanh(z+1.96*se)}}
const sc=s=>{const m=/^(\d+)\s*[-–:]\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
function league(l){
 const L=J(l.file),PL=J(l.pl_file),ix={};PL.cols.forEach((c,i)=>ix[c]=i);const M=new Map();
 for(const r of PL.rows){if(r[ix.mi]==null)continue;let a=M.get(r[ix.i]);if(!a){a={id:r[ix.i],club:r[ix.c]};M.set(r[ix.i],a)}a.club=r[ix.c]||a.club}
 const sq=new Map();for(const a of M.values()){const s=sq.get(a.club)||sq.set(a.club,{n:0,pr:0,sum:0}).get(a.club);s.n++;const v=TM.p[a.id]?TM.p[a.id][1]:null;if(v!=null){s.pr++;s.sum+=v}}
 const tab=new Map(),t=n=>tab.get(n)||tab.set(n,{club:n,played:0,pts:0}).get(n);
 for(const m of L.matches){const g=sc(m.s);if(!g||!m.d)continue;const h=t(m.h),a=t(m.a);h.played++;a.played++;if(g[0]>g[1])h.pts+=3;else if(g[0]<g[1])a.pts+=3;else{h.pts++;a.pts++}}
 const cs=[...tab.values()].filter(c=>c.played>0).map(c=>{const s=sq.get(c.club)||{n:0,pr:0,sum:0};return {club:c.club,played:c.played,pts:c.pts,ppg:c.pts/c.played,val:s.sum,pr:s.pr,n:s.n,cov:s.n?s.pr/s.n:0}});
 const use=c=>c.val>0&&c.cov>=.6&&c.played>=3,u=cs.filter(use),F=u.length>=8?ols(u.map(c=>Math.log(c.val/1e6)),u.map(c=>c.ppg)):null;
 cs.forEach(c=>{c.in=use(c);c.exp=F&&c.in?F.a+F.b*Math.log(c.val/1e6):null;c.diff=c.exp==null?null:c.ppg-c.exp});
 return {l,cs,F,u}}
const ALLL=LGS.map(league);
const f2=x=>x.toFixed(2);
const rows=pg=>pg.$$eval('#vltb tbody tr',a=>a.map(r=>({...r.dataset})));
function checkLeague(got,E,label){
 const W=new Map(E.cs.map(c=>[c.club,c]));
 ok(got.length===E.cs.length&&got.every(g=>{const c=W.get(g.club);return c&&+g.val===Math.round(c.val)&&+g.pr===c.pr&&+g.n===c.n&&+g.p===c.played&&+g.pts===c.pts&&g.ppg===f2(c.ppg)&&g.in===(c.in?'1':'0')&&g.exp===(c.exp==null?'':f2(c.exp))&&g.diff===(c.diff==null?'':f2(c.diff))}),label+': '+got.length+' clubs: squad value, priced / squad, played, points, points a game, the line and the gap all match');
}
async function sumOf(pg){return pg.$eval('#vlsum',e=>({...e.dataset}))}
(async()=>{const b=await T.launch();
 ok(LGS.length===6&&Object.keys(TM.p).length>1000,'reference: six leagues and '+Object.keys(TM.p).length+' priced players');
 for(const E of ALLL){
  const {ctx,pg,errs}=await T.open(b,{vw:1100,league:E.l.id,hash:'#/value'});await pg.waitForSelector('#vltb',{timeout:90000});await pg.waitForTimeout(500);
  const name=E.l.name;
  /* default order: gap, the clubs without a line last */
  const got=await rows(pg);checkLeague(got,E,name);
  const wantOrder=E.cs.slice().sort((a,b)=>(a.diff==null)-(b.diff==null)||((b.diff||0)-(a.diff||0))||cmp(a.club,b.club)).map(c=>c.club);
  ok(got.map(g=>g.club).join('|')===wantOrder.join('|'),name+': the default order is by the gap, clubs without a line last');
  const s=await sumOf(pg);
  ok(E.F?(+s.n===E.F.n&&s.r===f2(E.F.r)&&s.slope===f2(E.F.b*Math.LN2)&&s.lo===f2(E.F.lo)&&s.hi===f2(E.F.hi)):+s.n===0,name+': n '+s.n+', r '+s.r+' ('+s.lo+' to '+s.hi+'), per doubling '+s.slope+(E.F?' (expected r '+f2(E.F.r)+', slope '+f2(E.F.b*Math.LN2)+')':''));
  /* chart */
  const ch=await pg.$$eval('.vl-svg .vl-p',a=>a.map(g=>{const c=g.querySelector('circle'),t=g.querySelector('text'),bb=t?t.getBBox():null;return {club:g.dataset.club,x:+c.getAttribute('cx'),y:+c.getAttribute('cy'),lo:g.classList.contains('lo'),bb:bb?[bb.x,bb.y,bb.x+bb.width,bb.y+bb.height]:null}}));
  const withVal=E.cs.filter(c=>c.val>0);
  ok(ch.length===withVal.length&&withVal.every(c=>ch.some(d=>d.club===c.club&&d.lo===!c.in)),name+': one dot per club with a value ('+ch.length+'), hollow exactly when left out of the line');
  const byV=ch.slice().sort((a,b)=>a.x-b.x).map(d=>d.club),wantV=withVal.slice().sort((a,b)=>a.val-b.val).map(c=>c.club);
  ok(byV.join('|')===wantV.join('|'),name+': left to right in the order of the squad value');
  ok(ch.every(d=>{const c=withVal.find(k=>k.club===d.club);return ch.every(e=>{const k=withVal.find(z=>z.club===e.club);return c.ppg===k.ppg||((c.ppg>k.ppg)===(d.y<e.y))})}),name+': higher on the chart = more points a game');
  if(E.F){const ln=await pg.$eval('.vl-fit',l=>[+l.getAttribute('x1'),+l.getAttribute('y1'),+l.getAttribute('x2'),+l.getAttribute('y2')]);ok((ln[3]<ln[1])===(E.F.b>0)&&ln[2]>ln[0],name+': the line goes '+(E.F.b>0?'up':'down')+' to the right')}
  else ok(!(await pg.$('.vl-fit')),name+': no line without enough clubs');
  const lb=ch.filter(d=>d.bb),ov=[];for(let i=0;i<lb.length;i++)for(let j=i+1;j<lb.length;j++){const a=lb[i].bb,c=lb[j].bb,w=Math.min(a[2],c[2])-Math.max(a[0],c[0]),h=Math.min(a[3],c[3])-Math.max(a[1],c[1]);if(w>.3&&h>.3)ov.push(lb[i].club+' / '+lb[j].club)}
  ok(ov.length===0&&lb.every(d=>d.bb[0]>=0&&d.bb[2]<=160)&&lb.length>=ch.length*.7,name+': '+lb.length+' of '+ch.length+' clubs have a label (at least 70%), none hidden under another or outside the chart '+ov.slice(0,3).join(', '));
  /* orders */
  for(const [k,fn] of [['val',(a,b)=>b.val-a.val||cmp(a.club,b.club)],['pts',(a,b)=>b.ppg-a.ppg||b.val-a.val||cmp(a.club,b.club)]]){await pg.click('#vlord button[data-k="'+k+'"]');await pg.waitForTimeout(200);ok((await rows(pg)).map(g=>g.club).join('|')===E.cs.slice().sort(fn).map(c=>c.club).join('|'),name+': ordered by '+k)}
  /* six leagues */
  if(E===ALLL[0]){
   const pr=await pg.$$eval('#vlpool tbody tr',a=>a.map(r=>({...r.dataset})));
   ok(pr.length===6&&ALLL.every((e,i)=>pr[i].lg===e.l.id&&+pr[i].n===(e.F?e.F.n:0)&&pr[i].r===(e.F?f2(e.F.r):'')),'the six leagues table: clubs and r of every league');
   const z=[];for(const e of ALLL){if(e.u.length<8)continue;const xs=e.u.map(c=>Math.log(c.val/1e6)),ys=e.u.map(c=>c.ppg),mx=mean(xs),my=mean(ys),sx=Math.sqrt(mean(xs.map(v=>(v-mx)**2))),sy=Math.sqrt(mean(ys.map(v=>(v-my)**2)));e.u.forEach((c,i)=>z.push([(xs[i]-mx)/sx,(ys[i]-my)/sy]))}
   const PF=ols(z.map(p=>p[0]),z.map(p=>p[1])),pd=await pg.$eval('#vlpoolr',e=>({...e.dataset}));
   ok(+pd.n===PF.n&&pd.r===f2(PF.r)&&pd.lo===f2(PF.lo)&&pd.hi===f2(PF.hi),'all '+pd.n+' clubs together (each set against its own league): r '+pd.r+' ('+pd.lo+' to '+pd.hi+')');
  }
  ok(await T.noscroll(pg),name+': no horizontal scroll');
  ok(!errs.length,name+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* a competition that is not a domestic league */
 {const {ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_1XLtP0',hash:'#/value'});await pg.waitForTimeout(4000);ok(await pg.evaluate(()=>/six domestic leagues/.test(document.getElementById('app').innerText)&&!document.getElementById('vltb')),'World Cup: the page says it is for the six domestic leagues');ok(!errs.length,'World Cup: no page errors');await ctx.close()}
 /* an empty price file */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/\/tm\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"t":"","p":{}}'}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/value');await p.waitForTimeout(4000);
  ok(await p.evaluate(()=>/No prices yet/.test(document.getElementById('app').innerText)&&!document.getElementById('vltb'))&&!e.length,'an empty price file: "No prices yet", no error');await c.close()}
 /* a failing player file */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/l_4WFCIZ_pl\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/value');await p.waitForTimeout(5000);
  ok(await p.evaluate(()=>/Could not load the players/.test(document.getElementById('app').innerText)&&!document.getElementById('vltb'))&&!e.length,'a failing player file: the page says so, no error');await c.close()}
 /* leaving before the data arrives */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/l_4WFCIZ_pl\.json/,async r=>{await new Promise(x=>setTimeout(x,2500));r.continue()});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/value');await p.waitForTimeout(800);await p.evaluate(()=>{location.hash='#/table'});await p.waitForTimeout(5000);
  ok(await p.evaluate(()=>!document.getElementById('vltb')&&!!document.querySelector('.lt'))&&!e.length,'leaving before the player file arrives: nothing is drawn on the other page, no error');await c.close()}
 /* a past season */
 {const {ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/value',init:{season:'2025-26'}});await pg.waitForTimeout(5000);ok(await pg.evaluate(()=>!document.getElementById('vltb')&&/past season/i.test(document.getElementById('app').innerText)),'a past season: the page says it is not available');ok(!errs.length,'past season: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* Arabic and phone */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_0ErfuF',hash:'#/value'});await pg.waitForSelector('#vltb',{timeout:90000});await pg.waitForTimeout(500);
  const E=ALLL.find(e=>e.l.id==='l_0ErfuF');checkLeague(await rows(pg),E,lang+' phone LaLiga');
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$eval('.vl-svg',s=>{const r=s.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.width>300}),lang+' phone: the chart fits the screen');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#vlroot');ok(!u.length,'Arabic: the page is translated '+u.slice(0,5).join(' | '));ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
