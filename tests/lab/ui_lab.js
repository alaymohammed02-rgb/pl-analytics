const {chromium}=require('playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const U='http://127.0.0.1:8773/index.html';
const FPL=JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/fpl.json','utf8')),HI=Object.fromEntries(FPL.hcols.map((c,i)=>[c,i]));
const offPts=(id,gw)=>((FPL.hist[String(id)]||[]).filter(h=>h[HI.r]===gw).reduce((s,h)=>s+h[HI.pts],0));
const SENT={league:'l_4WFCIZ',flipy:'1',gh_repo:'x/y',fpl_myxi_cur_v1:'{"keep":1}',fpl_myxi_saved_v1:'[1,2]',fpl_ox_log_v1:'[3]',fpl_ox_cal_v1:'{"k":1.2}'};
async function open(b,{vw=1280,lang='en',init=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900},acceptDownloads:true});
 await ctx.addInitScript(([a,S,init])=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');for(const k in S)localStorage.setItem(k,S[k]);localStorage.setItem('lang',a);localStorage.removeItem('plx_lab_v1');if(init!=null)localStorage.setItem('plx_lab_v1',init)}},[lang,SENT,init]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/overview');await pg.waitForSelector('#app h2',{timeout:60000});return {ctx,pg,errs}}
const lab=async(pg,tab)=>{await pg.evaluate(t=>{LAB.tab=t;location.hash='#/lab';route()},tab||'arena');await pg.waitForSelector('.labtabs',{timeout:20000});await pg.waitForTimeout(tab==='disc'?2500:500)};
const store=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_lab_v1')||'null'));
const noScroll=pg=>pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---- English, desktop ---- */
 {const {ctx,pg,errs}=await open(b);
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href'))),old=[...fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/index.html','utf8').match(/PAGES=\[(.*?)\];/)[1].matchAll(/\['([a-z]+)'/g)].map(m=>'#/'+m[1]);
  /* the pages built into index.html (PAGES=[...]) keep their order in the menu; pages added later by the feature files sit between them */
  {const inNav=nav.filter(x=>old.includes(x));ok(JSON.stringify(inNav)===JSON.stringify(old)&&new Set(nav).size===nav.length&&nav.includes('#/whatif')&&nav.indexOf('#/lab')===nav.indexOf('#/fantasy')+1,'menu: Intelligence Lab right after Fantasy; the '+old.length+' built-in items all there, in order, no duplicates')}
  await pg.evaluate(()=>location.hash='#/lab');await pg.waitForSelector('.labtabs');ok(!!await pg.$('.labintro'),'first visit: a short introduction');
  await lab(pg,'arena');
  const gw=await pg.evaluate(()=>{const e=labOpen(LAB.d);return {id:e.id,dl:e.dl}});ok(gw.id===8&&gw.dl==='2026-10-23T17:30:00Z','open gameweek = the next deadline in fpl.json (GW8)');
  const opts=await pg.$$eval('#labpl option',a=>a.map(o=>[o.value,+o.dataset.id]));ok(opts.length>300,'player list: '+opts.length+' players with a GW8 fixture');
  await pg.fill('#labp1',opts[0][0]);await pg.fill('#labpts','6.5');await pg.fill('#labwhypts','  strong xG <b>x</b> ');await pg.click('.labforms .card:nth-child(1) button');await pg.waitForTimeout(400);
  let S=await store(pg),r=S&&S.recs[0];
  ok(r&&r.type==='pts'&&r.gw===8&&r.p[0]===opts[0][1]&&r.pred===6.5&&r.dl===gw.dl&&Date.parse(r.at)<Date.parse(r.dl)&&r.s[0].tm&&'form' in r.s[0]&&r.mv==='v3'&&r.why==='strong xG <b>x</b>','saved with gameweek, deadline, time, model version and what was known about the player');
  ok(await pg.$eval('#app',e=>!e.innerHTML.includes('<b>x</b>')),'the reason is shown as text, never as HTML');
  ok(/hidden/.test(await pg.$eval('#app table',e=>e.innerText)),'the model\'s figure stays hidden before the deadline');
  await pg.fill('#labp1',opts[0][0]);await pg.fill('#labpts','3');await pg.click('.labforms .card:nth-child(1) button');await pg.waitForTimeout(300);
  ok((await store(pg)).recs.length===1&&/already have/.test(await pg.$eval('.labmsg',e=>e.innerText)),'a second points prediction for the same player and gameweek is refused');
  await pg.fill('#labp1','Not A Player');await pg.fill('#labpts','3');await pg.click('.labforms .card:nth-child(1) button');await pg.waitForTimeout(300);ok((await store(pg)).recs.length===1,'a name not in the list is refused');
  await pg.fill('#labh1',opts[1][0]);await pg.fill('#labh2',opts[1][0]);await pg.click('.labforms .card:nth-child(2) button');await pg.waitForTimeout(300);ok((await store(pg)).recs.length===1,'the same player twice is refused');
  await pg.fill('#labh1',opts[1][0]);await pg.fill('#labh2',opts[2][0]);await pg.selectOption('#labwin','2');await pg.$eval('#labconf',e=>{e.value=75;e.dispatchEvent(new Event('input'))});await pg.click('.labforms .card:nth-child(2) button');await pg.waitForTimeout(300);
  S=await store(pg);r=S.recs[1];ok(r&&r.type==='h2h'&&r.pick===opts[2][1]&&r.conf===.75,'head-to-head saved with the pick and 75% confidence');
  await pg.reload();await lab(pg,'arena');ok((await store(pg)).recs.length===2&&(await pg.$$('#app table tr')).length===3,'predictions survive a page reload');
  const id0=S.recs[0].id;await pg.evaluate(id=>labDel(id),id0);await pg.waitForTimeout(300);ok((await store(pg)).recs.length===1,'before the deadline a prediction can be removed');
  /* locked after the deadline */
  await pg.evaluate(()=>{const o=labRead();o.recs[0].dl='2026-10-20T10:00:00Z';labWrite(o)});await lab(pg,'review');
  ok(!(await pg.$('.labdel')),'after the deadline there is no remove button');
  await pg.evaluate(()=>labDel(labRead().recs[0].id));await pg.waitForTimeout(300);ok((await store(pg)).recs.length===1&&/locked/.test(await pg.$eval('.labmsg',e=>e.innerText)),'and removing it is refused: "'+(await pg.$eval('.labmsg',e=>e.innerText))+'"');
  /* evaluation against the official points (GW7 is finished; the test copy has a sample model record for GW7 at 3.0 a player) */
  const picked=await pg.evaluate(()=>{const d=LAB.d,o={recs:[]},ps=d.P.filter(p=>labFx(d,p.tm,7).length&&(p.minutes||0)>300).slice(0,4);
   ps.forEach((p,i)=>o.recs.push({id:'e'+i,type:'pts',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-16T12:00:00Z',data:'x',mv:'v2',why:'',p:[p.id],s:[labSnap(d,p,7)],pred:4}));
   o.recs.push({id:'late',type:'pts',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-17T10:00:00Z',data:'x',mv:'v2',why:'',p:[ps[0].id],s:[labSnap(d,ps[0],7)],pred:9});
   o.recs.push({id:'h',type:'h2h',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-16T12:00:00Z',data:'x',mv:'v2',why:'',p:[ps[0].id,ps[1].id],s:[labSnap(d,ps[0],7),labSnap(d,ps[1],7)],pick:ps[0].id,conf:.7});
   labWrite(o);return ps.map(p=>p.id)});
  await lab(pg,'review');S=await store(pg);const E=S.recs.filter(x=>x.id[0]==='e');
  ok(E.every((x,i)=>x.res.st==='ok'&&x.res.a[0]===offPts(picked[i],7)&&x.res.e===Math.abs(4-offPts(picked[i],7))&&x.res.m[0]===3&&x.res.me===Math.abs(3-offPts(picked[i],7))),'evaluated with the official GW7 points from fpl.json: '+E.map(x=>x.res.a[0]).join(', ')+'; model figure and errors kept apart');
  ok(S.recs.find(x=>x.id==='late').res.st==='late','a prediction saved at the deadline is marked late and not counted');
  const H=S.recs.find(x=>x.id==='h'),a0=offPts(picked[0],7),a1=offPts(picked[1],7);
  ok(a0===a1?H.res.st==='tie':H.res.won===(a0>a1)&&Math.abs(H.res.b-Math.pow(.7-(a0>a1?1:0),2))<1e-9,'head-to-head: right/wrong and Brier score from the official points ('+a0+' vs '+a1+')');
  const t1=S.recs[0].res&&S.recs.find(x=>x.res).res.t;await lab(pg,'review');ok((await store(pg)).recs.find(x=>x.res).res.t===t1,'an evaluation is stored once and not redone or changed');
  /* not enough data: no personal conclusion */
  await lab(pg,'dna');const dna=await pg.evaluate(()=>({dev:/still developing/.test(document.querySelector('#app').innerText),st:[...document.querySelectorAll('.labins')].map(x=>x.className)}));
  ok(dna.dev&&dna.st.every(c=>!/established|emerging/.test(c)),'with 5 evaluated predictions: "still developing", and no pattern is called established or emerging');
  await lab(pg,'disc');const dc=await pg.evaluate(()=>{const rows=[...document.querySelectorAll('#app table tr')].slice(1).map(tr=>[tr.cells[0].innerText.trim(),+tr.cells[2].innerText]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),t=ltTable(fin,new Map());return rows.every(([n,p])=>{const x=t.find(r=>r.t===n);return x&&x.pts===p})&&rows.length===20});
  ok(dc,'discovery: the points of every team match the league table (all 20 teams)');
  ok(await pg.$eval('.labdisc',e=>/Baseline/.test(e.innerText)&&/How it is worked out/.test(e.innerText)&&/matches/.test(e.innerText)),'discovery shows sample, baseline and method with its limits');
  await lab(pg,'data');const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('text=Export (JSON)')]);const ex=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  ok(ex.key==='plx_lab_v1'&&ex.recs.length===(await store(pg)).recs.length,'export: a JSON file with every prediction ('+ex.recs.length+')');
  pg.once('dialog',d=>d.accept());await pg.click('text=Delete all');await pg.waitForTimeout(400);ok((await store(pg))===null,'delete all: the Lab key is removed');
  const keys=await pg.evaluate(S=>Object.keys(S).filter(k=>localStorage.getItem(k)!==S[k]).map(k=>k+'='+localStorage.getItem(k)),SENT);ok(!keys.length,'every other stored key is unchanged (league, flipy, gh_repo, Fantasy XI and calibration) '+keys.join(' ; '));
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 /* ---- unreadable saved data ---- */
 {const {ctx,pg,errs}=await open(b,{init:'{not json'});await lab(pg,'arena');
  ok(await pg.$eval('#app',e=>/could not be read/.test(e.innerText)),'unreadable data: a clear message, the page still works');
  ok(await pg.evaluate(()=>localStorage.getItem('plx_lab_v1')==='{not json'&&localStorage.getItem('plx_lab_v1_unreadable')==='{not json'),'unreadable data is not overwritten, and a copy is kept');
  const v=await pg.$eval('#labpl option',o=>o.value);await pg.fill('#labp1',v);await pg.fill('#labpts','5');await pg.click('.labforms .card:nth-child(1) button');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>localStorage.getItem('plx_lab_v1')==='{not json'),'saving is refused until the user deletes it');
  await pg.evaluate(()=>{localStorage.setItem('plx_lab_v1',JSON.stringify({v:1,recs:[{id:'x',type:'pts'},{junk:1}]}))});await lab(pg,'data');ok(await pg.$eval('#app',e=>/unreadable records skipped/.test(e.innerText)),'invalid records are skipped and reported');
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 /* ---- Arabic, phone ---- */
 {const {ctx,pg,errs}=await open(b,{vw:390,lang:'ar'});const left=new Set();
  ok(await pg.$eval('#nav a[href="#/lab"]',a=>a.innerText.trim())==='مختبر التحليل','Arabic menu: مختبر التحليل');
  await lab(pg,'arena');const v=await pg.$$eval('#labpl option',a=>a.slice(0,2).map(o=>o.value));await pg.fill('#labp1',v[0]);await pg.fill('#labpts','4');await pg.click('.labforms .card:nth-child(1) button');await pg.waitForTimeout(300);
  for(const t of ['arena','review','dna','disc','data']){await lab(pg,t);const s=await noScroll(pg);ok(s<=1,'390px Arabic '+t+': no horizontal page scroll ('+s+')');
   (await pg.evaluate(()=>{const o=[],w=document.createTreeWalker(document.querySelector('#app'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[⁦-⁩]/g,'').trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t))o.push(t)}return o})).forEach(x=>left.add(x))}
  const names=new Set([...FPL.rows.map(r=>r[1]),...FPL.teams.map(t=>t.n),...(await pg.evaluate(()=>D.matches.flatMap(m=>[m.home,m.away]))),'Brier']),eng=[...left].filter(x=>!names.has(x));
  ok(!eng.length,'Arabic Lab: every label translated (only player and club names stay in Latin script) '+eng.slice(0,5).join(' | '));
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
