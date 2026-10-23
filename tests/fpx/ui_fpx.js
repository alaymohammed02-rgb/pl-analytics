const {chromium}=require('playwright');const fs=require('fs');
const URL='http://127.0.0.1:8765/index.html';
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const REV=JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/fpl_review.json','utf8'));
const PAT=JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/fpl_patterns.json','utf8'));
const FPL=JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/../..')+'/data/fpl.json','utf8'));
const sig=e=>e&&e.lo!=null&&(e.lo>0||e.hi<0),holds=(a,b)=>sig(a)&&sig(b)&&Math.sign(a.m)===Math.sign(b.m);
async function open(b,vw,lang){const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(l=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},lang);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(URL+'#/fantasy');await pg.waitForSelector('#fproot .ctl button',{timeout:60000});return {ctx,pg,errs}}
const tab=async(pg,t)=>{await pg.click(`#fproot .ctl button:text-is("${t}")`);await pg.waitForTimeout(800)};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---- model v3 ---- */
 {const {ctx,pg,errs}=await open(b,1280,'en');
  ok(await pg.evaluate(()=>PM_VERSION==='v3'&&PM.AF[1]===1&&PM.AF[2]===1.45&&PM.AF[3]===1.58&&PM.AF[4]===2.33),'model v3: assist calibration 1 / 1.45 / 1.58 / 2.33 by position');
  const r=await pg.evaluate(async()=>{const d=await fpLoad();const C=pmCtx(d);const p=d.P.filter(x=>x.ty===4&&x.minutes>600&&x.expected_assists>0)[0];
   const v3=pmPlayer(p,C,d);const keep=PM.AF;PM.AF={1:1,2:1,3:1,4:1};const v2=pmPlayer(p,C,d);PM.AF=keep;
   const g3=v3.gws.find(g=>!g.none),g2=v2.gws.find(g=>!g.none);return {ra:v3.rates.lamA/v2.rates.lamA,pa:g3.parts.ast/g2.parts.ast,goal:g3.parts.goal===g2.parts.goal,app:g3.parts.app===g2.parts.app,pp:v3.rates.pPlay0===v2.rates.pPlay0}});
  ok(Math.abs(r.ra-2.33)<1e-9&&Math.abs(r.pa-2.33)<1e-9,'a forward: assist rate and assist points ×2.33, as published');
  ok(r.goal&&r.app&&r.pp,'everything else is unchanged (goal points, appearance points, play probability)');
  await tab(pg,'Backtest');ok(/v3 = the model used in Predicted Points/.test(await pg.innerText('#fproot')),'the Backtest names model v3');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- season by season ---- */
 {const {ctx,pg,errs}=await open(b,1280,'en');await tab(pg,'Season review');await pg.waitForSelector('#srall .fpx-s',{timeout:30000});
  const exp=Object.keys(REV.seasons).sort().map(s=>{const R=REV.seasons[s],t=R.ft.filter(x=>!x.err),f=R.fixed.filter(x=>!x.err),om=new Map(R.opt.map(x=>[x.r,x.pts])),A=t.reduce((a,x)=>a+x.act,0),O=t.reduce((a,x)=>a+(om.get(x.r)||0),0);
   return [s.replace('-','/'),(A/t.length).toFixed(1),(f.reduce((a,x)=>a+x.act,0)/f.length).toFixed(1),Math.round(A/O*100)+'%']});
  const got=await pg.$$eval('#srall .fpx-s',a=>a.map(x=>[x.querySelector('.fpx-h b').textContent,...[...x.querySelectorAll('.hpair b')].map(b=>b.textContent),x.querySelector('.fpx-n').textContent.match(/(\d+)%/)[0]]));
  ok(REV.seasons['2025-26'].ver==='v3','the stored reviews were recomputed with model v3');
  ok(got.length===exp.length&&got.every((g,i)=>g[0]===exp[i][0]&&g[1]===exp[i][1]&&g[2]===exp[i][2]&&g[3]===exp[i][3]),'every archived season: points a gameweek (1 free transfer, squad kept) and share of the best XI match the stored review: '+got.map(g=>g.join(' ')).join(' | '));
  ok(/once its review below has been run/.test(await pg.innerText('#srall')),'this season: says it is added once its review has run');
  await pg.click('#srout button');await pg.waitForFunction(()=>[...document.querySelectorAll('#srall .fpx-s .fpx-h b')].some(b=>b.textContent==='This season'),null,{timeout:240000});
  const cur=await pg.evaluate(()=>{const s=[...document.querySelectorAll('#srall .fpx-s')].find(x=>x.querySelector('.fpx-h b').textContent==='This season');return [...s.querySelectorAll('.hpair div')].map(d=>[d.querySelector('span').textContent,d.querySelector('b').textContent])});
  const R=await pg.evaluate(()=>{const R=SR.res[srKey(FPD)];return {rs:R.ft.filter(x=>!x.err).map(x=>x.r),act:R.ft.filter(x=>!x.err).map(x=>x.act)}});
  const avg=R.rs.map(r=>FPL.events.find(e=>e.id===r).avg),mg=(avg.reduce((a,b)=>a+b,0)/avg.length).toFixed(1);
  ok(cur.length===3&&cur[2][0]==='Average FPL manager'&&cur[2][1]===mg,'this season, once run: its row adds FPL\'s average manager for the same gameweeks ('+mg+')');
  ok(cur[0][1]===(R.act.reduce((a,b)=>a+b,0)/R.act.length).toFixed(1),'and its points a gameweek match the review it ran ('+cur[0][1]+')');
  await pg.click('#srall details summary');ok(await pg.$$eval('#srall details tr',a=>a.length)===exp.length+2,'the same numbers as a table');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- Patterns ---- */
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const {ctx,pg,errs}=await open(b,vw,lang);const T=lang==='ar'?'الأنماط':'Patterns';
  const tabs=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));ok(tabs.includes(T),vw+' '+lang+': the Patterns tab is there');
  await tab(pg,T);await pg.waitForSelector('.fpx-pat',{timeout:30000});
  const n=await pg.$$eval('.fpx-pat',a=>a.length),k=await pg.$$eval('#fproot .kpi b',a=>a.map(x=>+x.textContent));
  const nF=PAT.items.filter(i=>holds(i.train.vsForm,i.confirm.vsForm)).length,nM=PAT.items.filter(i=>holds(i.train.vsModel,i.confirm.vsModel)).length;
  ok(n===PAT.items.length&&k[0]===nF&&k[1]===nM,`${n} patterns; ${k[0]} where form misleads in both periods, ${k[1]} that the model misses (file: ${nF}, ${nM})`);
  if(lang==='en'){
   const first=await pg.$$eval('.fpx-pat',a=>a.map(x=>({t:x.querySelector('.fpx-pt').textContent,tags:[...x.querySelectorAll('.fpx-tag')].map(s=>s.textContent),act:x.querySelector('.hpair div:nth-child(3) b').textContent})));
   ok(first.slice(0,nF).every(f=>/Form (over|under)rates them/.test(f.tags[0]))&&first.slice(nF).every(f=>/no consistent gap/.test(f.tags[0])),'the patterns where form misleads come first, each tagged');
   const haul=PAT.items.find(i=>i.k==='haul'),fh=first.find(f=>f.t===haul.l);ok(fh&&fh.act===haul.confirm.act.toFixed(2)&&/overrates/.test(fh.tags[0]),'after a haul: actual next-gameweek points as in the file ('+(fh&&fh.act)+'), and form overrates them');
   ok(first.every(f=>f.tags[1]==='The model already accounts for it'||f.tags[1]==='The model misses it'),'each pattern says whether the model already accounts for it');
  }else{
   const left=await pg.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.getElementById('fproot'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,table,.ctl'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(FPL|xG|xA|GW|v\d)/.test(t))o.push(t)}return [...new Set(o)]});
   ok(!left.length,'Arabic: the Patterns page is translated '+left.slice(0,4).join(' | '));
   ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),'phone: no horizontal scroll');
  }
  await pg.selectOption('select[aria-label="Season"], select[aria-label="الموسم"]','2024-25');await pg.waitForTimeout(1500);
  ok((await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent))).includes(T),'an archived season keeps the Patterns tab');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
