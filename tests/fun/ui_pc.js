/* Player cards: rating and the six attributes recomputed from the raw files (per-match player file, ratings file) */
const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA='/home/user/pl-analytics/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
const ATTR=[['Shooting',['npxg','sh']],['Creating',['xag','kp','sca']],['Passing',['pr','bx','ps']],['Carrying',['pc','cb','tkw']],['Defending',['tk','ic','bl']],['Duels',['duw','aerw']]];
const KEYS=[...new Set(ATTR.flatMap(a=>a[1]))];
function cards(lid){const l=IDX.leagues.find(x=>x.id===lid),P=J(l.pl_file),RT=J(l.rt_file),ix={};P.cols.forEach((c,i)=>ix[c]=i);const g=new Map(),gk=new Set(J(l.file).stats.filter(s=>s.xf!=null).map(s=>s.i));
 P.rows.forEach(r=>{const mi=r[ix.mi];if(mi==null)return;const id=r[ix.i];let a=g.get(id);if(!a){a={id,n:r[ix.n],mi:0,clubs:{},pos:{},s:{},d:{}};g.set(id,a)}
  a.mi+=mi;a.clubs[r[ix.c]]=(a.clubs[r[ix.c]]||0)+mi;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;[...KEYS,'gl','ast'].forEach(k=>{const v=r[ix[k]];if(v!=null){a.s[k]=(a.s[k]||0)+v;a.d[k]=(a.d[k]||0)+mi}})});
 const rt=new Map();Object.values(RT.m).forEach(m=>Object.entries(m).forEach(([p,v])=>{if(typeof v!=='number')return;const r=rt.get(p)||{s:0,n:0};r.s+=v;r.n++;rt.set(p,r)}));
 const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0],A=[];
 g.forEach(a=>{let p=(top(a.pos)||[null])[0];if(a.mi<450||p==='GK'||gk.has(a.id))return;if(!['DF','MF','FW'].includes(p))p=null;const v={};KEYS.forEach(k=>v[k]=a.d[k]>0?a.s[k]/a.d[k]*90:null);const r=rt.get(a.id);
  A.push({key:lid+'|'+a.id,id:a.id,n:a.n,club:top(a.clubs)[0],p,mi:a.mi,v,gl:a.d.gl>0?a.s.gl:null,ast:a.d.ast>0?a.s.ast:null,rt:r?r.s/r.n:null})});
 A.forEach(x=>{x.g=x.p&&A.filter(y=>y.p===x.p).length>=8?x.p:'OF';x.q={}});
 ['DF','MF','FW','OF'].forEach(gr=>{const G=gr==='OF'?A:A.filter(x=>x.g===gr);KEYS.forEach(k=>{const s=G.map(x=>x.v[k]).filter(v=>v!=null).sort((a,b)=>a-b);G.forEach(x=>{if(gr==='OF'&&x.g!=='OF')return;const v=x.v[k];x.q[k]=v==null?null:(s.filter(y=>y<v).length+s.filter(y=>y===v).length/2)/s.length*100})})});
 A.forEach(x=>x.at=ATTR.map(([,ks])=>{const q=ks.map(k=>x.q[k]).filter(v=>v!=null);return q.length?Math.min(99,Math.floor(q.reduce((s,v)=>s+v,0)/q.length)):null}));return A}
async function open(b,{vw=1280,lang='en',league='l_0ErfuF',hash='#/cards',ctx0}={}){const ctx=ctx0||await b.newContext({viewport:{width:vw,height:900},acceptDownloads:true});
 if(!ctx0)await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const readCard=(pg,i)=>pg.$$eval('.pc-duel .pc-card',(a,i)=>{const c=a[i];return {k:c.dataset.k,rt:c.querySelector('.pc-rt b').textContent,pos:c.querySelector('.pc-pos b').textContent,at:[...c.querySelectorAll('.pc-at li b')].map(b=>b.textContent),win:[...c.querySelectorAll('.pc-at li')].map(l=>l.className),ft:c.querySelector('.pc-ft .fx-en').textContent.replace(/\s+/g,' ').trim()}},i);
const exp=x=>({rt:x.rt==null?'–':x.rt.toFixed(1),pos:x.p||'·',at:x.at.map(v=>v==null?'–':String(v)),ft:`${Math.round(x.mi)} min`+(x.gl!=null?` · ${x.gl} goals`:'')+(x.ast!=null?` · ${x.ast} assists`:'')});
const same=(c,x)=>{const e=exp(x);return c.rt===e.rt&&c.pos===e.pos&&c.at.join()===e.at.join()&&c.ft===e.ft};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const A=cards('l_0ErfuF');
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.pc-res',{timeout:90000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));ok(nav.indexOf('#/cards')===nav.indexOf('#/twins')+1,'in Players, after Player twins');
  ok(await pg.$$eval('#pcl option',a=>a.length)===A.length,`${A.length} LaLiga players with a card (450+ minutes, outfield; ${A.filter(x=>!x.p).length} with no position in the data, compared with all outfield players)`);
  let good=0;const bad=[];
  for(const x of [...A.filter((x,i)=>i%7===0).slice(0,25),...A.filter(x=>!x.p).slice(0,3)]){await pg.fill('#pca',x.n+' · '+x.club);await pg.dispatchEvent('#pca','change');await pg.waitForTimeout(120);
   const c=await readCard(pg,0);if(c.k==='l_0ErfuF|'+x.id&&same(c,x))good++;else bad.push(x.n+': '+JSON.stringify(c)+' vs '+JSON.stringify(exp(x)))}
  ok(!bad.length,`rating, position, six attributes, minutes, goals and assists recomputed for ${good} players ${bad.slice(0,2).join(' | ')}`);
  /* the duel */
  const a=A.find(x=>x.n==='Raphinha'),o=A.find(x=>x.n==='Kylian Mbappé');
  await pg.fill('#pca',a.n+' · '+a.club);await pg.dispatchEvent('#pca','change');await pg.waitForTimeout(150);await pg.fill('#pcb',o.n+' · '+o.club);await pg.dispatchEvent('#pcb','change');await pg.waitForTimeout(150);
  const ca=await readCard(pg,0),cb=await readCard(pg,1);
  const rows=[[a.rt,o.rt],...a.at.map((v,i)=>[v,o.at[i]])],wa=rows.filter(([x,y])=>x!=null&&y!=null&&x>y).length,wb=rows.filter(([x,y])=>x!=null&&y!=null&&x<y).length;
  const h=await pg.textContent('.pc-res h3');
  ok(same(ca,a)&&same(cb,o)&&ca.win.join()===a.at.map((v,i)=>v>o.at[i]?'w':v<o.at[i]?'l':'d').join(),`duel ${a.n} – ${o.n}: both cards, each row's winner marked`);
  ok(wa===wb?h.includes(`Level: ${wa}–${wb}`):h.includes(`wins ${Math.max(wa,wb)}–${Math.min(wa,wb)}`),'the tally: '+h.trim());
  await pg.click('.pc-back summary');const back=await pg.$$eval('.pc-back tbody tr:not(.pc-g)',a=>a.map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent.trim())));
  ok(back.length===KEYS.length&&back.every((r,i)=>{const k=KEYS[i],f=(x)=>x.v[k]==null?'N/A':x.v[k].toFixed(2)+(x.q[k]==null?'':' ('+Math.floor(x.q[k])+')');return r[1]===f(a)&&r[2]===f(o)}),'the back of the cards: every per-90 number and its percentile');
  /* save, collection, reload, remove */
  await pg.click('.pc-duel .pc-card:nth-child(1) [data-save]');await pg.waitForTimeout(300);
  ok(await pg.$eval('.pc-duel .pc-card:nth-child(1) [data-save]',b=>b.getAttribute('aria-pressed'))==='true'&&await pg.$$eval('#pcmine .pc-card',a=>a.map(c=>c.dataset.k))+''==='l_0ErfuF|'+a.id,'saving a card puts it in My cards');
  /* share as image: a PNG */
  const dl=pg.waitForEvent('download',{timeout:20000}).catch(()=>null);await pg.click('.pc-duel .pc-card:nth-child(2) .shr-btn');const d=await dl;
  if(d){const p=await d.path();const buf=fs.readFileSync(p);ok(buf.slice(1,4).toString()==='PNG'&&buf.readUInt32BE(16)===1080&&buf.readUInt32BE(20)===1350,'share as image: a 1080×1350 PNG')}else ok(false,'no image downloaded');
  /* another league: My cards keeps the LaLiga card; using it opens LaLiga */
  await pg.selectOption('#lgpick','l_4WFCIZ').catch(()=>{});await pg.waitForFunction(()=>D.id==='l_4WFCIZ',null,{timeout:60000});await pg.evaluate(()=>{location.hash='#/table';});await pg.waitForTimeout(500);await pg.evaluate(()=>{location.hash='#/cards'});
  await pg.waitForSelector('#pcmine .pc-card',{timeout:60000});
  ok(await pg.$eval('#pcmine .pc-card',c=>c.dataset.k)==='l_0ErfuF|'+a.id&&/LaLiga/.test(await pg.textContent('#pcmine .pc-card .pc-cl')),'in the Premier League, My cards still shows the LaLiga card, with its league');
  await pg.click('#pcmine [data-use]');await pg.waitForFunction(()=>D.id==='l_0ErfuF',null,{timeout:60000});await pg.waitForSelector('.pc-duel',{timeout:60000});await pg.waitForTimeout(300);
  ok((await readCard(pg,0)).k==='l_0ErfuF|'+a.id,'"Use in the duel" opens its league with the card');
  await pg.reload();await pg.waitForSelector('#pcmine .pc-card',{timeout:60000});await pg.click('#pcmine [data-del]');await pg.waitForTimeout(300);
  ok(!(await pg.$('#pcmine .pc-card'))&&await pg.evaluate(()=>localStorage.getItem('plx_cards_v1'))==='[]','after a reload it is still there; ✕ removes it');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,datalist,.fx-en,bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xAG|npxG|PitchAPI|PPDA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.pc-res',{timeout:90000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));ok(await pg.$eval('#nav a[href="#/cards"]',a=>a.textContent.trim())==='بطاقات اللاعبين','Arabic menu: بطاقات اللاعبين')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
