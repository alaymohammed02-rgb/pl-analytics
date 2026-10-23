const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const lg of ['l_4WFCIZ','l_0ErfuF','l_0ALvwF']){const ctx=await b.newContext({viewport:{width:1280,height:900}});
 await ctx.addInitScript(([lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang','en')}},[lg]);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForTimeout(4000);
 const r=await pg.evaluate(()=>({id:D.id,league:document.documentElement.dataset.league,th:getComputedStyle(document.documentElement).getPropertyValue('--th'),hi:getComputedStyle(document.documentElement).getPropertyValue('--th-hi'),bg:getComputedStyle(document.documentElement).getPropertyValue('--bg'),theme:THEME.leagues.map(t=>t.key+':'+t.ids.join('/')).join(' ')}));console.log(lg,JSON.stringify(r));
 await pg.screenshot({path:__dirname+'/th_'+lg+'.png'});await ctx.close()}
 await b.close()})();
