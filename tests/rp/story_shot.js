const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900},deviceScaleFactor:2});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/match/m_0bF5y0');await pg.waitForSelector('#mc .ms');await pg.waitForTimeout(500);
 await pg.locator('#mc .ms').screenshot({path:__dirname+'/story_'+lang+'.png'});await ctx.close()}
 await b.close()})();
