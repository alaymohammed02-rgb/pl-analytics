const {chromium}=require('playwright');
const URL='http://127.0.0.1:8765/index.html',SH=__dirname+'/shots/';
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const known=u=>/favicon.ico|api.github.com\/repos\/127/.test(u||'');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const loc of ['en-US','ar-SA']){
  const c=await b.newContext({viewport:{width:1280,height:900},locale:loc});const pg=await c.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!known((m.location()||{}).url))errs.push(m.text())});
  await pg.goto(URL+'#/fantasy');await pg.waitForFunction(()=>document.querySelector('#oxout')&&/3-|4-|5-/.test(document.querySelector('#oxout').innerText),null,{timeout:60000});
  const opts=await pg.$$eval('#fproot select[aria-label], #fproot select',a=>a.length?[...a[0].options].map(o=>o.value+':'+o.textContent):[]);console.log('  '+loc+' season options:',opts.join(' | '));
  ok(opts.some(o=>o.startsWith('2023-24:')),loc+': season picker lists archived seasons');
  await pg.selectOption('#fproot .ctl select >> nth=0','2023-24');
  await pg.waitForFunction(()=>FPD&&FPD.archive==='2023-24'&&document.querySelector('#fout'),null,{timeout:60000});
  const tabs=await pg.$$eval('#fproot > .ctl button',a=>a.map(x=>x.getAttribute('onclick')));ok(tabs.length===9&&tabs.some(t=>/'review'/.test(t))&&tabs.some(t=>/'patterns'/.test(t))&&!tabs.some(t=>/'(xi|my|vs|fc|pred|best)'/.test(t)),loc+': archived season shows only the 9 season tabs (incl. Season review and Patterns)');
  const t=await pg.innerText('#fpbody');ok(/Salah|M\.Salah|Haaland/.test(t),loc+': 2023-24 table lists that season\'s players');
  ok(await pg.evaluate(()=>FPLINK&&FPLINK.on===false&&FPD.P.every(p=>p.px==null)),loc+': no PitchAPI link on an archived season');
  const top=await pg.evaluate(()=>[...FPD.P].sort((a,b)=>b.total_points-a.total_points).slice(0,3).map(p=>p.name+' '+p.total_points).join(', '));console.log('  top 2023-24:',top);
  await pg.click('#fproot > .ctl button[onclick="fpTab(\'backtest\')"]');
  await pg.waitForFunction(()=>document.querySelectorAll('#btout .kpi').length>=4&&/38/.test(document.querySelector('#btout').innerText),null,{timeout:120000});
  const k=await pg.$$eval('#btout .kpi',a=>a.map(x=>x.innerText.replace(/\n/g,' ')));console.log('  backtest KPIs:',k.join(' || '));ok(k.length>=4,loc+': backtest replays the whole archived season');
  if(loc==='ar-SA')await pg.screenshot({path:SH+'season_ar.png'});
  await pg.selectOption('#fproot .ctl select >> nth=0','');
  await pg.waitForFunction(()=>FPD&&!FPD.archive&&document.querySelector('#fproot > .ctl')&&document.querySelectorAll('#fproot > .ctl button').length===16,null,{timeout:60000});ok(true,loc+': back to the current season: all 16 tabs again');
  ok(errs.length===0,loc+': no page errors '+errs.slice(0,3).join(' | '));await c.close()}
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close()})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
