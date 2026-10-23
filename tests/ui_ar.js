const {chromium}=require('playwright');
const URL='http://127.0.0.1:8765/index.html',SH=__dirname+'/shots/';
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const known=u=>/favicon.ico|api.github.com\/repos\/127|cdn.pitchapi/.test(u||'');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,label] of [[{width:1280,height:900},'desktop'],[{width:390,height:844},'mobile']]){
  const ctx=await b.newContext({viewport:vw,locale:'ar-SA',isMobile:label==='mobile',hasTouch:label==='mobile',deviceScaleFactor:label==='mobile'?2:1});const pg=await ctx.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!known((m.location()||{}).url))errs.push(m.text())});
  await pg.goto(URL+'#/overview');await pg.waitForTimeout(2500);
  ok(await pg.evaluate(()=>document.documentElement.dir==='rtl'&&document.documentElement.lang==='ar'),label+': Arabic phone → page opens in Arabic, right-to-left');
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.textContent));console.log('  nav:',nav.join(' | '));ok(nav.includes('نظرة عامة')&&nav.includes('الفانتازي'),label+': menu translated');
  const pages=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));const stats=[];
  for(const h of pages){const t0=Date.now();await pg.goto(URL+h);await pg.waitForTimeout(h==='#/fantasy'?6000:1500);
   const r=await pg.evaluate(()=>{const w=document.createTreeWalker(document.getElementById('app'),NodeFilter.SHOW_TEXT);let n,ar=0,en=0;while(n=w.nextNode()){const t=n.nodeValue.trim();if(!t)continue;if(/[؀-ۿ]/.test(t))ar++;else if(/\b[a-z]{4,}\b/.test(t))en++}return {ar,en,ovf:document.documentElement.scrollWidth-innerWidth,err:/Could not load this page/.test(document.getElementById('app').innerText)}});
   stats.push(h+': عربي '+r.ar+' / English '+r.en+(r.ovf>0?' OVERFLOW '+r.ovf:''));ok(!r.err,label+': '+h+' loads');if(label==='mobile')ok(r.ovf<=0,label+': '+h+' no sideways scroll');
   if(['#/overview','#/fantasy','#/shots','#/settings','#/players'].includes(h)&&label==='desktop')await pg.screenshot({path:SH+'ar_'+h.slice(2)+'.png'})}
  console.log('  text nodes per page: '+stats.join(' ; '));
  /* Fantasy in Arabic */
  await pg.goto(URL+'#/fantasy');await pg.waitForFunction(()=>document.querySelector('#oxout')&&document.querySelectorAll('#oxout div[onclick^="fpPredPick"]').length===11,null,{timeout:60000});
  const tabs=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));console.log('  tabs:',tabs.join(' | '));ok(tabs[0].includes('التشكيلة المثالية'),label+': Fantasy tabs in Arabic');
  if(label==='mobile')await pg.screenshot({path:SH+'ar_xi_mobile.png'});
  /* builder works in Arabic (buttons found by their actions, not by English text) */
  await pg.click('#fproot .ctl button[onclick="fpTab(\'my\')"]');await pg.waitForSelector('#oxmy');await pg.click('button[onclick="oxMyFromOpt()"]');
  await pg.waitForFunction(()=>/11 \/ 11/.test(document.querySelector('#oxmy').innerText),null,{timeout:30000});ok(true,label+': builder: start from optimal XI works');
  await pg.click('#oxmy div[onclick^="oxMyTap"] >> nth=2');await pg.click('#oxmy button[onclick^="oxMyRm"]');
  ok(/10 \/ 11/.test(await pg.innerText('#oxmy')),label+': remove works; message: '+(await pg.innerText('#oxmsg')).slice(0,60));
  if(label==='mobile')await pg.screenshot({path:SH+'ar_my_mobile.png'});
  await pg.click('button[onclick="oxMyFromOpt()"]');await pg.waitForFunction(()=>/11 \/ 11/.test(document.querySelector('#oxmy').innerText));
  await pg.click('#fproot .ctl button[onclick="fpTab(\'fc\')"]');await pg.waitForSelector('#oxch svg',{timeout:120000});
  const svgDir=await pg.$eval('#oxch svg',e=>getComputedStyle(e).direction);ok(svgDir==='ltr',label+': charts keep left-to-right drawing');
  if(label==='desktop')await pg.screenshot({path:SH+'ar_forecast.png'});
  await pg.click('#fproot .ctl button[onclick="fpTab(\'vs\')"]');await pg.waitForFunction(()=>document.querySelector('#oxvs')&&document.querySelectorAll('#oxvs .kpi').length===4,null,{timeout:60000});
  const k=await pg.$$eval('#oxvs .kpi',a=>a.map(x=>x.innerText.replace(/\n/g,' ')));console.log('  compare:',k.join(' || '));
  /* toggle back to English and again to Arabic */
  await pg.click('#langbtn');await pg.waitForTimeout(2500);
  const en=await pg.evaluate(()=>({dir:document.documentElement.dir,nav:[...document.querySelectorAll('#nav a')].map(a=>a.textContent).slice(0,3).join(','),tab:(document.querySelector('#fproot .ctl button')||{}).textContent,btn:document.getElementById('langbtn').textContent}));
  ok(en.dir==='ltr'&&en.nav.startsWith('Overview')&&en.btn==='عربي',label+': EN button → English again '+JSON.stringify(en));
  await pg.reload();await pg.waitForTimeout(2500);ok(await pg.evaluate(()=>document.documentElement.dir==='ltr'),label+': English choice remembered after reload');
  await pg.click('#langbtn');await pg.waitForTimeout(800);ok(await pg.evaluate(()=>document.documentElement.dir==='rtl'&&/نظرة عامة/.test(document.getElementById('nav').textContent)),label+': عربي button → Arabic again');
  ok(errs.length===0,label+': no page errors '+errs.slice(0,3).join(' | '));await ctx.close();
 }
 /* speed: biggest table page in English vs Arabic */
 for(const loc of ['en-US','ar-SA']){const c=await b.newContext({locale:loc});const p=await c.newPage();await p.goto(URL+'#/overview');await p.waitForTimeout(2000);const t0=Date.now();await p.goto(URL+'#/shots');await p.waitForFunction(()=>document.querySelectorAll('#app svg circle').length>50,null,{timeout:60000});console.log('  shots page render',loc,Date.now()-t0,'ms');await c.close()}
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
