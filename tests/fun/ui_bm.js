/* Beat the model: the model's sealed pick recomputed from the raw files, scoring of finished matches from the league files */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
function model(lid){const lg=IDX.leagues.find(l=>l.id===lid),L=J(lg.file),S=J(lg.sh_file),ix={};S.cols.forEach((c,i)=>ix[c]=i);
 const tx=new Map();S.rows.forEach(r=>{if(r[ix.og])return;const k=r[ix.m]+'|'+r[ix.c],x=r[ix.xg];tx.set(k,(tx.get(k)||0)+(typeof x==='number'&&isFinite(x)?x:0))});
 const T=new Map();let hs=0,as=0,n=0;L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).forEach(m=>{const xh=tx.get(m.i+'|'+m.h),xa=tx.get(m.i+'|'+m.a);if(xh==null||xa==null)return;n++;hs+=xh;as+=xa;
  [[m.h,xh,xa],[m.a,xa,xh]].forEach(([t,f,a])=>{const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=a;T.set(t,r)})});
 const pr=(J('priors.json').leagues||{})[lid],pri=new Map();   /* last season's strengths (data/priors.json, checked in nf/ui_rc.js): each club starts from its own, worth 12 matches */
 if(pr)Object.keys(pr.teams).forEach(t=>{const r=pr.teams[t];if(r[0]>=10)pri.set(t,[(r[1]+3*pr.mu)/(r[0]+3)/pr.mu,(r[2]+3*pr.mu)/(r[0]+3)/pr.mu])});
 const v2=pri.size>0,N0=v2?12:3,H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T.get(t),p=pri.get(t)||[1,1];if(!v2&&!(r&&r.n>=3))return null;const k=r?r.n:0;return {att:((r?r.f:0)+N0*mu*p[0])/(k+N0)/mu,def:((r?r.a:0)+N0*mu*p[1])/(k+N0)/mu}};
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o},res=(i,j)=>i>j?'H':i<j?'A':'D';
 return {L,pick:(h,a)=>{const x=str(h),y=str(a);if(!x||!y)return null;const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,d=0,l=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}
  const P={H:w,D:d,A:l};let b=null;for(let i=0;i<=5;i++)for(let j=0;j<=5;j++){const e=2*ph[i]*pa[j]+P[res(i,j)];if(!b||e>b.e+1e-12)b={hs:i,as:j,e}}return b}}}
async function open(b,{vw=1280,lang='en',league='l_4WFCIZ',hash='#/beat',seed=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg,sd])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l);if(sd)localStorage.setItem('plx_btm_v1',sd)}},[lang,league,seed]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 pg.on('dialog',d=>d.accept());await pg.goto(U+hash);return {ctx,pg,errs}}
const store=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_btm_v1')||'null'));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const M=model('l_4WFCIZ'),FX=J('fixtures.json').leagues.l_4WFCIZ.filter(x=>{const t=Date.parse(x.k);return t>Date.now()&&t<Date.now()+14*864e5});
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.bm-board',{timeout:60000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));ok(nav.indexOf('#/beat')===nav.indexOf('#/lab')+1,'in Fantasy, after the Intelligence Lab');
  ok(await pg.$$eval('.bm-fx li',a=>a.length)===FX.length,`${FX.length} fixtures in the next 14 days, from the fixture list`);
  const f=FX[0];const li=`.bm-fx li[data-mid="${f.i}"]`;
  await pg.click(`${li} button[data-s="h"][data-d="1"]`);await pg.click(`${li} button[data-s="h"][data-d="1"]`);await pg.click(`${li} button[data-s="a"][data-d="1"]`);await pg.waitForTimeout(200);
  let s=await store(pg),r=s&&s.p.find(x=>x.mid===f.i);const e=M.pick(f.h,f.a);
  ok(r&&r.hs===2&&r.as===1&&/Prediction saved/.test(await pg.textContent(`${li} .bm-st`)),`${f.h} – ${f.a}: 2–1 saved from the + buttons`);
  ok(r&&r.m&&r.m.hs===e.hs&&r.m.as===e.as,`the model's pick sealed with it: ${e.hs}–${e.as} (the score with the most expected points, recomputed)`);
  const at=r.at;await pg.fill(`${li} input[data-s="a"]`,'3');await pg.dispatchEvent(`${li} input[data-s="a"]`,'change');await pg.waitForTimeout(150);
  s=await store(pg);r=s.p.find(x=>x.mid===f.i);ok(r.hs===2&&r.as===3&&r.at===at&&r.m.hs===e.hs&&r.m.as===e.as,'changed to 2–3 before kick-off: the model\'s sealed pick and the time it was sealed stay');
  await pg.reload();await pg.waitForSelector('.bm-board',{timeout:60000});ok(await pg.$eval(`${li} input[data-s="h"]`,i=>i.value)==='2'&&await pg.$eval(`${li} input[data-s="a"]`,i=>i.value)==='3','after a reload the prediction is still there');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* finished matches: scored from the league files, in this league and another */
 {const pl=M.L.matches.filter(m=>/^\d+-\d+$/.test(m.s)).slice(0,3),es=model('l_0ErfuF').L.matches.find(m=>/^\d+-\d+$/.test(m.s));const sc=s=>s.split('-').map(Number);
  const [g0,g1,g2]=pl.map(m=>sc(m.s)),g3=sc(es.s),past='2026-09-01T12:00:00.000Z';
  const recs=[{lid:'l_4WFCIZ',ln:'Premier League',mid:pl[0].i,h:pl[0].h,a:pl[0].a,k:past,at:past,hs:g0[0],as:g0[1],m:{hs:g0[0]+1,as:g0[1]+1}},
   {lid:'l_4WFCIZ',ln:'Premier League',mid:pl[1].i,h:pl[1].h,a:pl[1].a,k:past,at:past,hs:g1[1]+2,as:g1[0],m:{hs:g1[0],as:g1[1]}},
   {lid:'l_4WFCIZ',ln:'Premier League',mid:'m_notplayed',h:'A',a:'B',k:past,at:past,hs:1,as:0,m:null},
   {lid:'l_0ErfuF',ln:'LaLiga',mid:es.i,h:es.h,a:es.a,k:past,at:past,hs:g3[0],as:g3[1],m:{hs:9,as:9}}];
  const pts=(p,q,h,a)=>p===h&&q===a?3:(Math.sign(p-q)===Math.sign(h-a))?1:0;
  const you=pts(g0[0],g0[1],...g0)+pts(g1[1]+2,g1[0],...g1)+pts(g3[0],g3[1],...g3),mod=pts(g0[0]+1,g0[1]+1,...g0)+pts(g1[0],g1[1],...g1)+pts(9,9,...g3);
  const {ctx,pg,errs}=await open(b,{seed:JSON.stringify({v:1,p:recs})});await pg.waitForSelector('.bm-board',{timeout:60000});await pg.waitForTimeout(500);
  const sb=await pg.$$eval('.bm-s b',a=>a.map(x=>+x.textContent));
  ok(sb[0]===you&&sb[1]===mod,`board: you ${you}, model ${mod} (exact 3, result 1), a LaLiga match scored from the LaLiga file while the Premier League is open`);
  ok(await pg.$$eval('.bm-hist',a=>a.length)===2&&/Waiting for the result/.test(await pg.textContent('#bmroot'))&&(await pg.$$eval('.bm-hist li',a=>a.length))===4,'one match still without a result: waiting; three in Results');
  const st=await store(pg);ok(st.p.filter(x=>x.r).length===3&&st.p.find(x=>x.mid===es.i).r.you===3,'results stored with each prediction');
  await pg.click('#bmwipe');await pg.waitForTimeout(300);ok((await store(pg)).p.length===0&&!(await pg.$('.bm-hist')),'delete all (after confirming)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,.fx-en,bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.bm-board',{timeout:60000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));ok(await pg.$eval('#nav a[href="#/beat"]',a=>a.textContent.trim())==='تغلب على النموذج','Arabic menu: تغلب على النموذج')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
