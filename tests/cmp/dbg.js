const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const lang of ['en','ar']){const ctx=await b.newContext({viewport:{width:1280,height:900},timezoneId:'Asia/Riyadh'});await ctx.addInitScript(([l,a])=>{localStorage.setItem('league',l);localStorage.setItem('lang',a)},[lang==='en'?'l_0bfbkO':'l_4WFCIZ',lang]);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8772/index.html#/overview');await pg.waitForSelector('#app h2');
 if(lang==='en'){await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('#lt .ltr[data-t]');await pg.waitForTimeout(800);
  console.log(await pg.evaluate(()=>({n:document.querySelectorAll('#lt .ltr[data-t]').length,eub:document.querySelectorAll('#lt .eub').length,psg:document.querySelector('.ltr[data-t="Paris Saint-Germain"]')?.innerHTML.slice(0,400),ci:JSON.stringify(champInfo()),cs:curSeason()})))}
 else{await pg.evaluate(()=>location.hash='#/matches');await pg.waitForSelector('.fx');await pg.waitForTimeout(800);console.log(JSON.stringify(await pg.$$eval('.fxd',a=>a.map(d=>[d.querySelector('.fxdh').innerText,[...d.querySelectorAll('.fxt')].map(x=>x.innerText)]))))}
 await ctx.close()}await b.close()})();
