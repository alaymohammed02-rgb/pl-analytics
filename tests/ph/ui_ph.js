/* Pressing (the PPDA tab renamed) and Height (its own page now): every number checked against the raw files */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
function raw(lid){const lg=IDX.leagues.find(l=>l.id===lid),L=J(lg.file),A=J(lg.adv_file),P=J(lg.pl_file);
 const md=new Map(L.matches.map(m=>[m.i,m]));const pp=new Map(A.team.map(r=>[r.m+'|'+r.n,r])),hx=new Map(P.team.map(r=>[r.m+'|'+r.n,r]));
 const team=t=>L.matches.filter(m=>(m.h===t||m.a===t)&&(pp.has(m.i+'|'+t)||hx.has(m.i+'|'+t))).sort((a,b)=>String(a.d).localeCompare(String(b.d))||a.i.localeCompare(b.i)).map(m=>{const o=m.h===t?m.a:m.h;
  return {m:m.i,d:String(m.d).slice(0,10),opp:o,adx:(hx.get(m.i+'|'+t)||{}).adx??null,o_adx:(hx.get(m.i+'|'+o)||{}).adx??null,pp:(pp.get(m.i+'|'+t)||{}).pp??null,o_pp:(pp.get(m.i+'|'+o)||{}).pp??null}});
 const teams=[...new Set(P.team.map(r=>r.n))];
 const season=teams.map(t=>{const R=team(t),h=R.map(r=>r.adx).filter(v=>v!=null),A_=A.team.filter(r=>r.n===t&&r.pp!=null&&r.da>0);return {n:t,h:h.length?h.reduce((s,x)=>s+x,0)/h.length:null,nh:h.length,np:A_.length,ppda:A_.reduce((s,r)=>s+r.da,0)?A_.reduce((s,r)=>s+r.op,0)/A_.reduce((s,r)=>s+r.da,0):null}});
 return {team,season,teams};}
const mean=a=>{const b=a.filter(x=>x!=null);return b.length?b.reduce((s,x)=>s+x,0)/b.length:null};
const med=a=>{const s=a.slice().sort((x,y)=>x-y),i=s.length/2;return s.length%2?s[Math.floor(i)]:(s[i-1]+s[i])/2};
async function open(b,{vw=1280,lang='en',league='l_0ErfuF',routes=[],hash='#/ppda'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 for(const [re,fn] of routes)await ctx.route(re,fn);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const X=raw('l_0ErfuF'),T='Barcelona',BR=X.team(T);
 /* ---- the menu ---- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.ph-dash',{timeout:60000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>[x.getAttribute('href'),x.textContent.trim()]));const i=nav.findIndex(x=>x[0]==='#/ppda');
  ok(i>=0&&nav[i][1]==='Pressing'&&nav[i+1]&&nav[i+1][0]==='#/height'&&nav[i+1][1]==='Height'&&!nav.some(x=>x[0]==='#/pressline'),'menu: "PPDA" is now "Pressing", "Height" right after it, no old combined page ('+nav.slice(i,i+2).map(x=>x[1]).join(', ')+')');
  ok(await pg.$$eval('#app h2',a=>a.map(h=>h.textContent))+''==='Pressing','one title: Pressing');
  /* ---- the team: PPDA match by match ---- */
  await pg.selectOption('#phtm',T);await pg.waitForTimeout(300);
  ok(await pg.$$eval('.ph-dash .ph-ch',a=>a.length)===1&&!(await pg.$('#phhm')),'only the PPDA chart (no height chart, no height measure selector)');
  const st=await pg.evaluate(()=>{const s=document.querySelector('.ph-dash .ph-ch svg');return {t:s.querySelectorAll('.ph-d.t').length,o:s.querySelectorAll('.ph-d.o').length,av:+s.querySelector('.ph-avt').textContent}});
  const ap=mean(BR.map(r=>r.pp));
  ok(st.t===BR.filter(r=>r.pp!=null).length&&st.o===BR.filter(r=>r.o_pp!=null).length&&Math.abs(st.av-ap)<0.0051,`${T}: ${st.t} matches, opponents ${st.o}, average ${ap.toFixed(2)} (from the adv file)`);
  const tips=await pg.$$eval('.ph-dash .ph-d.t',a=>a.map(c=>c.getAttribute('data-tip')));const PR=BR.filter(r=>r.pp!=null);
  ok(tips.length===PR.length&&tips.every((t,i)=>t.includes(`${T}: ${PR[i].pp.toFixed(2)}`)&&t.includes(PR[i].opp+': '+(PR[i].o_pp==null?'–':PR[i].o_pp.toFixed(2)))),'each point: Barcelona\'s and the opponent\'s PPDA of that match');
  const rd=await pg.textContent('.ph-read');const PO=PR.filter(r=>r.o_pp!=null),k=PO.filter(r=>r.pp<r.o_pp).length;
  ok(rd.includes(`in ${k} of ${PO.length} matches`)&&/not whether it worked/.test(rd)&&!/ m from its goal|defended (higher|deeper)/.test(rd),'reading: pressing only, against the opponents, trend apart from quality');
  await pg.click('.ph-dash .ph-d.t');await pg.waitForTimeout(250);ok(/PPDA Barcelona/.test(await pg.textContent('.ph-sel'))&&!/height/.test(await pg.textContent('.ph-sel')),'picking a match: its PPDA, no height');
  /* ---- every team ---- */
  const S=X.season.filter(t=>t.np>=3&&t.ppda!=null).sort((a,b)=>a.ppda-b.ppda);
  const bars=await pg.$$eval('.ph-bars button',a=>a.map(x=>[x.dataset.tm,+x.querySelector('b').textContent]));
  ok(bars.length===S.length&&bars.every((x,i)=>x[0]===S[i].n&&Math.abs(x[1]-S[i].ppda)<0.0051),`every team: ${bars.length} bars, pooled PPDA from the adv file, most pressing first`);
  ok(await pg.$eval('.ph-bars li.me button',x=>x.dataset.tm)===T,'the chosen team is marked');
  const other=S.find(t=>t.n!==T).n;await pg.click(`.ph-bars button[data-tm="${other}"]`);await pg.waitForTimeout(300);
  ok(await pg.$eval('#phtm',s=>s.value)===other&&(await pg.textContent('.ph-dash h3')).includes(other),'tapping a team opens it above');
  /* ---- the PPDA page's own content, still there ---- */
  ok(await pg.$('#phorig #pt')&&await pg.$('#phorig #pout table')&&/Definition \(PitchAPI\)/.test(await pg.textContent('#phorig'))&&/Teams — season/.test(await pg.textContent('#phorig')),'the PPDA page\'s definition, season table and by-match table are kept below');
  await pg.selectOption('#pt',T);await pg.waitForTimeout(200);const nA=J(IDX.leagues.find(l=>l.id==='l_0ErfuF').adv_file).team.filter(r=>r.n===T).length,nT=await pg.$$eval('#pout tr',a=>a.filter(r=>r.querySelector('td')).length);ok(nT===nA,'(rows '+nT+' / '+nA+') '+'and still work (by-match filter)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- leaving the page while its data is still loading: the page now on screen is left alone ---- */
 {const slow=[[/_adv\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()}]];
  const {ctx,pg,errs}=await open(b,{routes:slow});await pg.waitForSelector('#app h2',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');
  await pg.waitForSelector('.lt',{timeout:60000});await pg.waitForTimeout(4000);
  ok(!/Could not load this page/.test(await pg.textContent('#app'))&&await pg.$('.lt')&&!(await pg.$('#phorig')),'leaving Pressing before its data arrives: the league table stays, no error, no PPDA tables on it');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- the old combined page leads to Pressing (Height has its own test: ui_dlh.js) ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/pressline'});await pg.waitForFunction(()=>location.hash==='#/ppda',null,{timeout:30000}).catch(()=>{});
  ok(await pg.evaluate(()=>location.hash)==='#/ppda','#/pressline (old links) leads to Pressing');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- the World Cup, and another competition ---- */
 {const {ctx,pg,errs}=await open(b,{league:'l_1XLtP0'});await pg.waitForSelector('#phroot .empty',{timeout:60000});
  ok(/World Cup is not part/.test(await pg.textContent('#phroot'))&&!(await pg.$('.ph-dash')),'World Cup: not part of the pressing charts, with a way to choose another competition');
  await pg.selectOption('#phlg','l_4WFCIZ');await pg.waitForSelector('.ph-dash',{timeout:60000});
  const pl=raw('l_4WFCIZ'),n=pl.season.filter(t=>t.np>=3&&t.ppda!=null).length;ok(await pg.evaluate(()=>D.id)==='l_4WFCIZ'&&await pg.$$eval('.ph-bars li',a=>a.length)===n,'switching to the Premier League: its own teams ('+n+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- phones, Arabic ---- */
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,a,.fx-en,bdi,.ph-lt,text.ph-op,.ph-pt,table'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI|PPDA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en'])for(const h of ['#/ppda']){const {ctx,pg,errs}=await open(b,{vw:390,lang,hash:h});await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone '+h+': no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic '+h+': page translated '+u.slice(0,5).join(' | '));
   if(h==='#/ppda')ok(await pg.$eval('#nav a[href="#/ppda"]',a=>a.textContent.trim())==='الضغط'&&await pg.$eval('#nav a[href="#/height"]',a=>a.textContent.trim())==='الارتفاع','Arabic menu: الضغط, الارتفاع')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
