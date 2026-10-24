/* Attack share: npxG + xAG per 90 and the share of the team's chances while on the pitch, recomputed from the raw files */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json'),PL=IDX.leagues.find(l=>l.name==='Premier League');
const P=J(PL.pl_file),ix={};P.cols.forEach((c,i)=>ix[c]=i);const F=J('fpl.json'),fc={};F.cols.forEach((c,i)=>fc[c]=i);const LG=J(PL.file);
const TM={'Man City':'Manchester City','Man Utd':'Manchester United','Spurs':'Tottenham Hotspur',"Nott'm Forest":'Nottingham Forest','Leeds':'Leeds United','Newcastle':'Newcastle United','Bournemouth':'AFC Bournemouth','Brighton':'Brighton & Hove Albion'};
const tn=new Map(F.teams.map(t=>[t.id,TM[t.n]||t.n]));
/* gameweek of each match: FPL fixture with the same home and away teams */
const gw=new Map();LG.matches.forEach(m=>{const f=F.fix.find(f=>f[0]&&tn.get(f[1])===m.h&&tn.get(f[2])===m.a);if(f)gw.set(m.i,f[0])});
const team=new Map(),len=new Map();P.rows.forEach(r=>{const k=r[ix.m]+'|'+r[ix.c];team.set(k,(team.get(k)||0)+(r[ix.npxg]||0));len.set(k,Math.max(len.get(k)||0,r[ix.mi]||0))});
const last=Math.max(...F.events.filter(e=>e.fin).map(e=>e.id));
function calc(pid,win){let mi=0,x=0,den=0;P.rows.forEach(r=>{if(r[ix.i]!==pid||!r[ix.mi])return;const g=gw.get(r[ix.m]);if(win!=='all'&&!(g>=last-(+win)+1&&g<=last))return;const k=r[ix.m]+'|'+r[ix.c];
 mi+=r[ix.mi];x+=(r[ix.npxg]||0)+(r[ix.xag]||0);den+=(team.get(k)||0)*r[ix.mi]/Math.max(90,len.get(k)||90)});return {mi,pg:mi?x/mi*90:null,sh:den>0?x/den:null}}
const q75=a=>{const s=a.slice().sort((x,y)=>x-y),i=(s.length-1)*.75,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo)};
const nz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
async function open(b,{vw=1280,lang='en',league='l_4WFCIZ'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/share');return {ctx,pg,errs}}
const read=pg=>pg.evaluate(()=>[...document.querySelectorAll('.as-d')].map(g=>({id:+g.dataset.pid,tip:g.getAttribute('data-tip')})));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 {const {ctx,pg,errs}=await open(b,{league:'l_0ErfuF'});await pg.waitForSelector('.as-t',{timeout:90000});
  ok(await pg.evaluate(()=>/Premier League/.test(D.name)),'opened from LaLiga: the Premier League opens (Fantasy is the Premier League)');
  const nav=await pg.evaluate(()=>UI_SEC.find(x=>x.k==='fpl').p.map(k=>'#/'+k));ok(nav.join()==='#/fantasy,#/beat,#/share','in the Fantasy hub, after Beat the model comes Attack share (the Intelligence Lab is in Models)');
  const link=await pg.evaluate(()=>[...fpLink().map].map(([id,r])=>[id,r.player_id,r.player]));const LM=new Map(link.map(x=>[x[0],x]));
  for(const [pos,lab] of [[3,'Midfielders'],[4,'Forwards'],[2,'Defenders']])for(const win of ['all','4']){
   await pg.click(`[data-pos="${pos}"]`);await pg.selectOption('#aswin',win);await pg.waitForTimeout(250);
   const got=await read(pg);
   const exp=F.rows.filter(r=>r[fc.ty]===pos&&LM.has(r[fc.id])).map(r=>{const c=calc(LM.get(r[fc.id])[1],win);return {id:r[fc.id],name:r[fc.wn],...c}}).filter(r=>r.mi>=270&&r.sh!=null);
   const bad=exp.filter(e=>{const g=got.find(x=>x.id===e.id);return !g||!g.tip.includes('npxG + xAG /90: '+e.pg.toFixed(2))||!g.tip.includes('Share while on the pitch: '+Math.round(e.sh*100)+'%')});
   ok(got.length===exp.length&&!bad.length,`${lab}, ${win==='all'?'whole season':'last 4 gameweeks'}: ${got.length} players, every per-90 and share recomputed from the raw files ${bad.slice(0,2).map(e=>e.name).join(', ')}`);
   const note=await pg.textContent('.as-svg + .as-leg + .ins-note');const m1=q75(exp.map(e=>e.sh)),m2=q75(exp.map(e=>e.pg));
   ok(note.includes(`share ${Math.round(m1*100)}%, ${m2.toFixed(2)} per 90`),`${lab}: quadrant lines at the top quarter (${Math.round(m1*100)}%, ${m2.toFixed(2)})`)}
  await pg.click('[data-pos="3"]');await pg.selectOption('#aswin','all');await pg.waitForTimeout(200);
  /* the link FPL ↔ PitchAPI: names agree */
  const wrong=link.filter(([id,,pn])=>{const r=F.rows.find(x=>x[fc.id]===id);const a=nz(pn).split(' ');return !(a.includes(nz(r[fc.sn]).split(' ').pop())||a.includes(nz(r[fc.wn]).split(' ').pop()))});
  ok(wrong.length<=2,`FPL ↔ PitchAPI link: ${link.length} players, names agree (${wrong.length} odd: ${wrong.slice(0,2).map(x=>x[2]).join(', ')})`);
  /* value table */
  const T=await pg.$$eval('.as-t tbody tr',a=>a.map(r=>({id:+r.dataset.pid,v:+r.querySelectorAll('td')[5].textContent,p:+r.querySelectorAll('td')[2].textContent,y:+r.querySelectorAll('td')[3].textContent})));
  ok(T.length&&T.every((r,i)=>Math.abs(r.v-r.y/r.p)<0.0015&&(!i||T[i-1].v>=r.v)),`value table: npxG + xAG per 90 ÷ price, best first (${T.length} rows)`);
  /* filters */
  await pg.selectOption('#asmax','6');await pg.waitForTimeout(200);const g6=await read(pg);
  ok(g6.length>0&&g6.every(x=>{const r=F.rows.find(z=>z[fc.id]===x.id);return r[fc.now_cost]/10<=6}),'max price £6.0m: only players at that price or below');
  await pg.selectOption('#asmax','0');await pg.selectOption('#asmin','630');await pg.waitForTimeout(200);
  ok((await read(pg)).every(x=>{const c=calc(LM.get(x.id)[1],'all');return c.mi>=630}),'min. minutes 630: only players with that many');
  await pg.selectOption('#asmin','270');await pg.waitForTimeout(200);
  /* a player's details: next fixtures from the FPL fixture list */
  const t0=T[0];await pg.click(`.as-t tr[data-pid="${t0.id}"]`);await pg.waitForSelector('.as-sel');
  const fr=F.rows.find(r=>r[fc.id]===t0.id),tm=fr[fc.tm],nx=F.fix.filter(f=>f[0]&&!f[5]&&(f[1]===tm||f[2]===tm)&&Date.parse(f[8])>Date.now()-3*3600e3).sort((a,b)=>String(a[8]).localeCompare(String(b[8]))).slice(0,3).map(f=>{const h=f[1]===tm;return F.teams.find(t=>t.id===(h?f[2]:f[1])).s+' '+(h?'(H)':'(A)')});
  ok(JSON.stringify(await pg.$$eval('.as-sel .as-f',a=>a.map(x=>x.textContent)))===JSON.stringify(nx),`${fr[fc.wn]}: details with the next fixtures ${nx.join(', ')}`);
  ok(await pg.$eval(`.as-d[data-pid="${t0.id}"]`,g=>g.classList.contains('on')),'and the dot is picked in the chart');
  const pens=F.rows.filter(r=>r[fc.ty]===3&&r[fc.penalties_order]===1).map(r=>r[fc.id]);const pinS=await pg.$$eval('.as-d',a=>a.filter(g=>g.querySelector('.as-pen')).map(g=>+g.dataset.pid));
  ok(pinS.every(id=>pens.includes(id))&&pinS.length>0,'ⓟ only on first-choice penalty takers');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,.fx-en,bdi,svg,.as-tn,.as-f'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|npxG|xAG|npxGI|PitchAPI)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.as-t',{timeout:90000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  ok(await pg.$eval('.as-svg svg',s=>s.viewBox.baseVal.width===400),lang+' phone: the narrower chart');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '))}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
