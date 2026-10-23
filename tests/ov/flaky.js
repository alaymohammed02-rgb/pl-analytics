const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});let bad=0;
 for(let i=0;i<20;i++){const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
  const pg=await ctx.newPage(),log=[];pg.on('pageerror',e=>log.push('PE '+e.message));pg.on('console',m=>{if(m.type()!=='log')log.push(m.type()+' '+m.text().slice(0,200))});
  const pend=new Set();pg.on('request',r=>pend.add(r.url()));pg.on('requestfinished',r=>pend.delete(r.url()));pg.on('requestfailed',r=>pend.delete(r.url()));
  await pg.goto('http://127.0.0.1:8765/index.html#/overview');
  const okk=await pg.waitForSelector('#mb .mb-days',{timeout:15000}).then(()=>true).catch(()=>false);
  if(!okk){bad++;console.log('RUN',i,'FAILED',JSON.stringify(await pg.evaluate(()=>({h:location.hash,h2:(document.querySelector('#app h2')||{}).textContent,ovmb:!!document.getElementById('ovmb'),ovmbHtml:(document.getElementById('ovmb')||{}).outerHTML,flag:(document.getElementById('ovmb')||{dataset:{}}).dataset.mb,mbOn:typeof mbMount}))),log.slice(0,5),[...pend].slice(0,6))}
  await ctx.close()}
 console.log('bad',bad,'of 20');await b.close()})();
