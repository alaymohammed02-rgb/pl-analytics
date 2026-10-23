/* Player twins: the pool, percentiles and similarities recomputed from the six leagues' raw per-match player files */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
const KEYS=['npxg','sh','xag','kp','sca','pr','bx','ps','pc','cb','tkw','tk','ic','bl','duw','aerw'];
const LGS=IDX.leagues.filter(l=>!/World Cup|Champions/.test(l.name));
const pool=[];
for(const l of LGS){const P=J(l.pl_file),ix={};P.cols.forEach((c,i)=>ix[c]=i);const g=new Map(),gk=new Set(J(l.file).stats.filter(s=>s.xf!=null).map(s=>s.i));
 P.rows.forEach(r=>{const mi=r[ix.mi];if(mi==null)return;const id=r[ix.i];let a=g.get(id);if(!a){a={id,n:r[ix.n],mi:0,clubs:{},pos:{},s:{},d:{}};g.set(id,a)}
  a.mi+=mi;a.clubs[r[ix.c]]=(a.clubs[r[ix.c]]||0)+mi;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;KEYS.forEach(k=>{const v=r[ix[k]];if(v!=null){a.s[k]=(a.s[k]||0)+v;a.d[k]=(a.d[k]||0)+mi}})});
 const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0];
 g.forEach(a=>{const p=(top(a.pos)||[null])[0];if(a.mi<450||p==='GK'||gk.has(a.id))return;const v={};KEYS.forEach(k=>v[k]=a.d[k]>0?a.s[k]/a.d[k]*90:null);pool.push({key:l.id+'|'+a.id,lid:l.id,id:a.id,n:a.n,club:top(a.clubs)[0],p:['DF','MF','FW'].includes(p)?p:null,v,q:{},qo:{}})})}
const pc=(G,f)=>KEYS.forEach(k=>{const s=G.map(x=>x.v[k]).filter(v=>v!=null).sort((a,b)=>a-b);G.forEach(x=>{const v=x.v[k];f(x)[k]=v==null?null:(s.filter(y=>y<v).length+s.filter(y=>y===v).length/2)/s.length*100})});
['DF','MF','FW'].forEach(p=>pc(pool.filter(x=>x.p===p),x=>x.q));pc(pool,x=>x.qo);
const sim=(a,b,f)=>{let s=0,n=0;KEYS.forEach(k=>{if(f(a)[k]!=null&&f(b)[k]!=null){s+=Math.abs(f(a)[k]-f(b)[k]);n++}});return n>=10?100-s/n:null};
const twins=(t,lg)=>{const f=t.p?x=>x.q:x=>x.qo;return pool.filter(x=>(t.p?x.p===t.p:true)&&x.id!==t.id&&(!lg||x.lid===lg)).map(x=>({x,s:sim(t,x,f)})).filter(r=>r.s!=null).sort((a,b)=>b.s-a.s||a.x.n.localeCompare(b.x.n)).slice(0,5)};
async function open(b,{vw=1280,lang='en',league='l_0ErfuF',hash='#/twins'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const list=pg=>pg.$$eval('.tw-list button',a=>a.map(x=>({k:x.dataset.k,p:parseInt(x.querySelector('.tw-p').textContent)})));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.tw-list',{timeout:90000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));ok(nav.indexOf('#/twins')===nav.indexOf('#/compare')+1,'in Players, after Compare');
  ok(await pg.$$eval('#twl option',a=>a.length)===pool.length,`pool: ${pool.length} outfield players with 450+ minutes in ${LGS.length} domestic leagues (no Champions League, no World Cup, no goalkeepers; ${pool.filter(x=>!x.p).length} with no position in the data)`);
  const checkOne=async(name,lg)=>{const t=pool.find(x=>x.n===name);if(!t){ok(false,'no '+name);return}
   await pg.fill('#twq',t.n+' · '+t.club);await pg.dispatchEvent('#twq','change');await pg.waitForTimeout(300);
   if(lg!=null){await pg.selectOption('#twlg',lg);await pg.waitForTimeout(300)}
   const got=await list(pg),exp=twins(t,lg);
   if(got.length!==exp.length||!got.every((g,i)=>g.k===exp[i].x.key))console.log("GOT",JSON.stringify(got),"EXP",JSON.stringify(exp.map(r=>[r.x.key,r.s])));ok(got.length===exp.length&&got.every((g,i)=>g.k===exp[i].x.key&&g.p===Math.round(exp[i].s)),`${name}${lg?' in '+lg:''}: twins ${exp.map(r=>r.x.n+' '+Math.round(r.s)+'%').join(', ')}`);
   const o=exp[0]&&exp[0].x;if(!o)return;
   const rows=await pg.$$eval('.tw-t tbody tr',a=>a.map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent.trim())));
   const Q=t.p?x=>x.q:x=>x.qo;ok(rows.length===16&&rows.every((r,i)=>{const k=KEYS[i],f=v=>v==null?'N/A':v.toFixed(2),g=Q(t)[k]!=null&&Q(o)[k]!=null?String(Math.round(Math.abs(Q(t)[k]-Q(o)[k]))):'N/A';return r[1]===f(t.v[k])&&r[2]===f(o.v[k])&&r[3]===g}),`${name} & ${o.n}: 16 per-90 numbers and percentile gaps`)};
  await checkOne('Raphinha');await checkOne('Bukayo Saka');await checkOne('Virgil van Dijk');await checkOne('Pedri','l_0ALvwF');
  const unk=pool.find(x=>!x.p&&x.lid==='l_0ErfuF');await checkOne(unk.n,'');ok(/every outfield player \(his position is not known\)/.test(await pg.textContent('.tw-intro')),unk.n+': no position in the data, compared with every outfield player');
  await pg.selectOption('#twlg','');await pg.waitForTimeout(200);
  /* a twin in another league: its player page opens in that league */
  const cur=await pg.evaluate(()=>D.id),ot=(await list(pg)).map(x=>x.k).find(k=>!k.startsWith(cur+'|'));
  if(ot){await pg.click(`.tw-list button[data-k="${ot}"]`);await pg.waitForTimeout(200);await pg.click('.tw-cmp [data-open]');await pg.waitForFunction(()=>/^#\/player\//.test(location.hash),null,{timeout:60000}).catch(()=>{});
   ok(/^#\/player\//.test(await pg.evaluate(()=>location.hash))&&await pg.evaluate(()=>D.id)===ot.split('|')[0],'a twin from another league: its player page, in its league')}
  else ok(false,'no twin from another league to open');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,datalist,.fx-en,bdi,.ins-leg,svg'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xAG|npxG|PitchAPI|PPDA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.tw-cmp',{timeout:90000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));ok(await pg.$eval('#nav a[href="#/twins"]',a=>a.textContent.trim())==='توأم اللاعب','Arabic menu: توأم اللاعب')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
