const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','ar')}});
 const pg=await ctx.newPage();pg.on('console',m=>{if(m.type()!=='error')console.log('C:',m.text())});pg.on('pageerror',e=>console.log('PE',e.message));
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(4000);
 console.log(await pg.evaluate(async()=>{const c=await homeData(),rt=await rtLoad();const ids=(c.round||[]).map(m=>m.match_id);return {potr:!!document.getElementById('potr'),hidden:document.getElementById('potr')&&document.getElementById('potr').hidden,hx:document.getElementById('home').dataset.hx,round:ids.length,from:c.from,last:c.last,rated:Object.keys(rt.m),inRound:ids.filter(i=>rt.m[i]).length}}));
 await b.close()})();
