const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const port of [8765,8774]){const ctx=await b.newContext();await ctx.addInitScript(()=>{localStorage.setItem('league','l_1Isor4');localStorage.setItem('lang','en')});const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:'+port+'/index.html#/table');await pg.waitForSelector('#lt .ltr[data-t]');await pg.waitForTimeout(800);
  console.log(port,await pg.evaluate(()=>({chm:document.querySelectorAll('.chm').length,e:JSON.stringify((CHAMP.d||{}).leagues&&CHAMP.d.leagues['l_1Isor4']),cs:curSeason(),gen:ALL.generated})));await ctx.close()}
 await b.close()})();
