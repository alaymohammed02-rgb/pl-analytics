const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/height');await pg.waitForSelector('.dl-bars',{timeout:90000});
 await pg.click('[data-m="def"]');await pg.waitForTimeout(500);await pg.screenshot({path:`ph/def_${vw}_${lang}.png`,fullPage:true});
 console.log(vw,lang,'scroll ok',await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1));await ctx.close()}
await b.close()})();
