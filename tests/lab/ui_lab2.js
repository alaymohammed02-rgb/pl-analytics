const {chromium}=require('playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const U='http://127.0.0.1:8773/index.html',R=(process.env.PLREPO||__dirname+'/../..')+'/data/';
const J=f=>JSON.parse(fs.readFileSync(R+f,'utf8')),FPL=J('fpl.json'),PL=J('l_4WFCIZ.json'),SH=J('l_4WFCIZ_sh.json'),FX=J('fixtures.json');
const sc=s=>{const m=/^(\d+)-(\d+)$/.exec(s||'');return m?[+m[1],+m[2]]:null};
/* independent xG per team and match (own goals left out), as the site does */
const ci=Object.fromEntries(SH.cols.map((c,i)=>[c,i])),TX=new Map();SH.rows.forEach(r=>{if(r[ci.og])return;const k=r[ci.m]+'|'+r[ci.c];TX.set(k,(TX.get(k)||0)+(r[ci.xg]||0))});
function model(h,a){const fin=PL.matches.filter(m=>sc(m.s)&&m.d);let n=0,hs=0,as=0;const T=new Map();
 fin.forEach(m=>{const xh=TX.get(m.i+'|'+m.h),xa=TX.get(m.i+'|'+m.a);if(xh==null||xa==null)return;n++;hs+=xh;as+=xa;[[m.h,xh,xa],[m.a,xa,xh]].forEach(([t,f,g])=>{const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=g;T.set(t,r)})});
 const PR=JSON.parse(require('fs').readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/priors.json','utf8')).leagues.l_4WFCIZ,pri=new Map();   /* last season's strengths, worth 12 matches */
 Object.keys(PR.teams).forEach(t=>{const r=PR.teams[t];if(r[0]>=10)pri.set(t,[(r[1]+3*PR.mu)/(r[0]+3)/PR.mu,(r[2]+3*PR.mu)/(r[0]+3)/PR.mu])});
 const H=hs/n,A=as/n,mu=(H+A)/2,st=t=>{const r=T.get(t)||{n:0,f:0,a:0},p=pri.get(t)||[1,1];return {att:(r.f+12*mu*p[0])/(r.n+12)/mu,def:(r.a+12*mu*p[1])/(r.n+12)/mu}},x=st(h),y=st(a),lh=H*x.att*y.def,la=A*y.att*x.def;
 const P=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o},ph=P(lh),pa=P(la);let w=0,d=0,l=0;
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}const s=w+d+l;return [w/s,d/s,l/s]}
const SENT={flipy:'1',gh_repo:'x/y',fpl_myxi_cur_v1:'{"keep":1}',fpl_ox_cal_v1:'{"k":1.2}'};
async function open(b,{vw=1280,lang='en',init=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([a,S,init])=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.clear();for(const k in S)localStorage.setItem(k,S[k]);localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',a);if(init!=null)localStorage.setItem('plx_lab_v1',init)}},[lang,SENT,init]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/lab');await pg.waitForSelector('.labtabs',{timeout:60000});await pg.waitForTimeout(1200);return {ctx,pg,errs}}
const tab=async(pg,t)=>{await pg.evaluate(t=>labTab(t),t);await pg.waitForSelector('.labtabs');await pg.waitForTimeout(t==='arena'||t==='review'||t==='dna'||t==='data'?700:2200)};
const store=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_lab_v1')||'null'));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 {const {ctx,pg,errs}=await open(b);
  const tabs=await pg.$$eval('.labtabs button',a=>a.map(x=>x.innerText.replace(/\d+$/,'').trim()));
  ok(tabs.join('|')==='For you|Decision Arena|Review and progress|Analytical DNA|Weekly review|Hidden patterns|Case file|Discovery|Your data'&&await pg.$eval('.labtabs button.on',e=>e.innerText)==='For you','9 tabs; "For you" opens first');
  ok(/From your next visit/.test(await pg.innerText('#app'))&&!(await pg.$('.labfeed.new')),'first visit: no "new since your last visit" items, and it says so');
  /* match result */
  await tab(pg,'arena');const sel=await pg.$eval('#labmx',s=>s.value);await pg.selectOption('#labmp','A');await pg.$eval('#labmc',e=>{e.value=60;e.dispatchEvent(new Event('input'))});await pg.evaluate(()=>labSaveMatch());await pg.waitForTimeout(900);
  let S=await store(pg),r=S.recs.find(x=>x.type==='match');const fx=FX.leagues.l_4WFCIZ.find(x=>x.i===sel),mm=model(fx.h,fx.a);
  ok(r&&r.mid===sel&&r.h===fx.h&&r.dl===new Date(fx.k).toISOString()&&r.pick==='A'&&r.pr.map(x=>+x.toFixed(2)).join()==='0.2,0.2,0.6','match saved: kick-off as the deadline, 60% on the away win, 20% on each other result');
  ok(r.model&&r.model.p.every((x,i)=>Math.abs(x-mm[i])<1e-9)&&Math.abs(r.model.p.reduce((a,x)=>a+x,0)-1)<1e-9,'model probabilities saved with it, equal to an independent computation from the league and shot files ('+mm.map(x=>(x*100).toFixed(1)+'%').join(' / ')+')');
  ok(/hidden/.test(await pg.$eval('#app table',e=>e.innerText)),'the model\'s probabilities stay hidden until kick-off');
  const dis=await pg.$eval('#labmx',(s,v)=>{const o=[...s.options].find(x=>x.value===v);return o&&o.disabled},sel);await pg.$eval('#labmx',(s,v)=>s.value=v,sel);await pg.evaluate(()=>labSaveMatch());await pg.waitForTimeout(500);
  ok(dis&&(await store(pg)).recs.filter(x=>x.type==='match').length===1&&/already have/.test(await pg.$eval('.labmsg',e=>e.innerText)),'a second prediction for the same match is refused (and the match is greyed out in the list)');
  /* finished matches here and in LaLiga, one saved too late */
  /* matches whose deadline (23:00 UTC on their day) has already passed: a match played today is not settled until then */
  const past=m=>sc(m.s)&&Date.parse(m.d.slice(0,10)+'T23:00:00Z')<Date.now();
  /* the three matches are taken from before the end of Gameweek 7 (22 Oct), so the weekly review below always has results in its week, whatever day the test runs */
  const pm=PL.matches.filter(m=>past(m)&&m.d.slice(0,10)<='2026-10-22').slice(-3),LA=J('l_0ErfuF.json'),lm=LA.matches.filter(past).slice(-1)[0];
  await pg.evaluate(([pm,lm])=>{const o=labRead();pm.forEach((m,i)=>o.recs.push({id:'m'+i,type:'match',lid:'l_4WFCIZ',lname:'Premier League',mid:m.i,h:m.h,a:m.a,dl:m.d.slice(0,10)+'T23:00:00Z',at:i===2?m.d.slice(0,10)+'T23:30:00Z':'2026-10-01T00:00:00Z',pick:'H',conf:.6,pr:[.6,.2,.2],model:{p:[.5,.3,.2],ver:'xg-poisson-1'},why:''}));
   o.recs.push({id:'la',type:'match',lid:'l_0ErfuF',lname:'LaLiga',mid:lm.i,h:lm.h,a:lm.a,dl:lm.d.slice(0,10)+'T23:00:00Z',at:'2026-10-01T00:00:00Z',pick:'D',conf:.4,pr:[.3,.4,.3],model:null,why:''});labWrite(o)},[pm,lm]);
  await tab(pg,'review');S=await store(pg);const B=(p,o)=>p.reduce((s,x,i)=>s+Math.pow(x-(i===o?1:0),2),0),oc=s=>{const g=sc(s);return g[0]>g[1]?0:g[0]===g[1]?1:2};
  const M=[0,1].map(i=>S.recs.find(x=>x.id==='m'+i));
  ok(M.every((x,i)=>x.res.st==='ok'&&x.res.score===pm[i].s&&Math.abs(x.res.b-B([.6,.2,.2],oc(pm[i].s)))<1e-12&&Math.abs(x.res.mb-B([.5,.3,.2],oc(pm[i].s)))<1e-12),'match results from the league data ('+pm.slice(0,2).map(m=>m.s).join(', ')+'), your Brier and the model\'s kept apart');
  ok(S.recs.find(x=>x.id==='m2').res.st==='late','a match prediction saved after kick-off is not counted');
  const la=S.recs.find(x=>x.id==='la');ok(la.res&&la.res.score===lm.s&&Math.abs(la.res.b-B([.3,.4,.3],oc(lm.s)))<1e-12,'a LaLiga prediction is evaluated from the LaLiga file while the Premier League is open ('+lm.h+' '+lm.s+' '+lm.a+')');
  /* weekly review with no prediction in the last finished gameweek */
  await tab(pg,'week');const wk=await pg.innerText('#app'),inW=(await store(pg)).recs.filter(x=>x.type==='match'&&x.res&&x.res.st==='ok'&&Date.parse(x.dl)>=Date.parse('2026-10-17T10:00:00Z')&&Date.parse(x.dl)<Date.parse('2026-10-23T17:30:00Z')).length;
  ok(/Gameweek 7/.test(wk)&&new RegExp('Match results: '+inW+' ').test(wk),'weekly review of Gameweek 7: the '+inW+' match results evaluated in that week');
  /* hidden patterns, checked against fpl.json */
  await tab(pg,'hidden');const H=await pg.$$eval('.labhp',a=>a.map(c=>({t:c.querySelector('h3').innerText,rows:[...c.querySelectorAll('tr')].slice(1).map(tr=>[...tr.cells].map(td=>td.innerText.trim()))})));
  const ci2=Object.fromEntries(FPL.cols.map((c,i)=>[c,i])),P=FPL.rows.map(r=>Object.fromEntries(FPL.cols.map((c,i)=>[c,r[i]]))),fin=FPL.events.filter(e=>e.fin).length,byName=n=>P.filter(p=>n.startsWith(p.wn+' '));
  ok(H[0].rows.every(r=>{const p=byName(r[0])[0];return p&&p.ty>=3&&p.minutes>=270&&p.minutes<=.55*fin*90&&(p.expected_goals+p.expected_assists)/p.minutes*90>=.5}),'per-90 pattern: every listed player is a MID/FWD with 270+ minutes, at most 55% of the minutes, and xG + xA per 90 ≥ 0.5 ('+H[0].rows.length+')');
  ok(H[1].rows.length===10&&H[1].rows.every(r=>{const p=byName(r[0]).find(p=>String(p.goals_scored)===r[1]);return p&&Math.abs(p.goals_scored-p.expected_goals-parseFloat(r[3]))<.051}),'goals − xG pattern: values match fpl.json for all 10 players');
  ok(H[2]&&H[2].rows.length>0&&H[2].rows.every(r=>parseFloat(r[4])<10),'undervalued pattern: all listed players owned by fewer than 10% ('+(H[2]?H[2].rows.length:0)+')');
  /* case file */
  await tab(pg,'case');const cs=await pg.evaluate(()=>{const a=document.querySelector('.labcase a[href^="#/match/"]');return {id:a&&a.getAttribute('href').split('/').pop(),q:document.querySelector('.labcase h3').innerText}});
  const cm=PL.matches.find(m=>m.i===cs.id),g=sc(cm.s),win=g[0]>g[1]?cm.h:cm.a,los=win===cm.h?cm.a:cm.h;
  ok(TX.get(cm.i+'|'+los)-TX.get(cm.i+'|'+win)>=.7&&cs.q.includes(los)&&cs.q.includes(win),'case file: '+cm.h+' '+cm.s+' '+cm.a+', the loser had at least 0.7 more xG ('+TX.get(cm.i+'|'+los).toFixed(2)+' vs '+TX.get(cm.i+'|'+win).toFixed(2)+')');
  ok(!(await pg.$('.labev')),'the evidence is shown only after you answer');
  await pg.click('.labopts button >> nth=1');await pg.waitForTimeout(1500);const a1=(await store(pg)).cases[cs.id];
  ok(a1&&a1.ans==='miss'&&!!(await pg.$('.labev'))&&/Conclusion/.test(await pg.innerText('.labcase')),'your answer is saved, then the evidence and the conclusion appear');
  await pg.evaluate(id=>labCaseAnswer(id,'fin'),cs.id);await pg.waitForTimeout(800);ok((await store(pg)).cases[cs.id].ans==='miss','an answer cannot be changed afterwards');
  const ev=await pg.$$eval('.labev>div p',a=>a.map(p=>p.innerText));ok(ev.some(t=>t.includes('Goals '+Math.max(...g)))&&ev.some(t=>t.includes('Goals '+Math.min(...g))),'evidence goals match the score '+cm.s);
  /* milestones and the feed on the next visit */
  await tab(pg,'review');const ms=await pg.$$eval('.labms li',a=>a.map(x=>[x.className,x.innerText]));
  ok(ms.find(x=>/First prediction recorded/.test(x[1]))[0]==='on'&&ms.find(x=>/First case file/.test(x[1]))[0]==='on'&&ms.find(x=>/50 predictions/.test(x[1]))[0]!=='on','milestones: first prediction and first case reached, 50 evaluated not yet');
  await tab(pg,'feed');const f2=await pg.$$eval('.labfeed.new',a=>a.map(x=>x.innerText));ok(f2.some(t=>/predictions evaluated since your last visit/.test(t))&&f2.some(t=>/Milestone/.test(t)),'next visit: "For you" starts with what changed (evaluations, milestones)');
  await tab(pg,'feed');ok(!(await pg.$('.labfeed.new')),'and nothing is presented as new again when nothing changed');
  const keys=await pg.evaluate(S=>Object.keys(S).filter(k=>localStorage.getItem(k)!==S[k]),SENT);ok(!keys.length,'other stored keys unchanged');
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 {const {ctx,pg,errs}=await open(b,{init:JSON.stringify({v:1,recs:[],cases:'bad',ms:[1],seen:5})});await tab(pg,'case');await tab(pg,'review');await tab(pg,'feed');
  ok(!errs.length&&!(await pg.$('.labmsg')),'wrong types in the saved extra fields are ignored safely');
  await tab(pg,'week');ok(/None of your predictions were evaluated in this gameweek/.test(await pg.innerText('#app')),'weekly review with nothing evaluated: an honest "no personal review this week", no empty report');await ctx.close()}
 {const {ctx,pg,errs}=await open(b,{vw:390,lang:'ar'});const left=new Set();
  const names=new Set([...FPL.rows.map(r=>r[1]),...FPL.teams.map(t=>t.n),...PL.matches.flatMap(m=>[m.h,m.a]),...SH.rows.map(r=>r[ci.pn]),...J('index.json').leagues.map(l=>l.name),'Brier']);
  for(const t of ['feed','arena','review','dna','week','hidden','case','disc','data']){await tab(pg,t);if(t==='case'){const bt=await pg.$('.labopts button');if(bt){await bt.click();await pg.waitForTimeout(1200)}}
   const s=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(s<=1,'390px Arabic '+t+': no horizontal page scroll ('+s+')');
   (await pg.evaluate(()=>{const o=[],w=document.createTreeWalker(document.querySelector('#app'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[\u2066-\u2069]/g,'').trim();if(/[A-Za-z]{3}/.test(t)&&!/[\u0600-\u06FF]/.test(t))o.push(t)}
    document.querySelectorAll('#app option').forEach(i=>{const v=i.textContent;if(/[A-Za-z]{3}/.test(v)&&!/[\u0600-\u06FF]/.test(v)&&!/ – /.test(v))o.push(v)});return o})).forEach(x=>left.add(x))}
  const eng=[...left].filter(x=>!names.has(x)&&!/^[\d\s:\u2011-]+UTC$/.test(x)&&!/^.+ \d+-\d+ .+$/.test(x));
  ok(!eng.length,'Arabic Lab, all 9 tabs: every label translated (names, scores and UTC times excepted) '+eng.slice(0,6).join(' | '));
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
