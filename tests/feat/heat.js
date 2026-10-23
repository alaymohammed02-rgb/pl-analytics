const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:1000,height:900}});
 await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/heatmaps');await pg.waitForSelector('#hout svg image.heat-smooth',{timeout:30000});await pg.waitForTimeout(300);
 const s=await pg.$('#hout');await s.screenshot({path:__dirname+'/heat1.png'});await pg.selectOption('#hp',{index:3});await pg.waitForTimeout(600);await (await pg.$('#hout')).screenshot({path:__dirname+'/heat3.png'});
 await pg.selectOption('#hv','b');await pg.waitForTimeout(500);console.log('both images',await pg.$$eval('#hout image.heat-smooth',a=>a.length),'errors',errs);
 await pg.screenshot({path:__dirname+'/heat2.png',fullPage:false});await b.close()})();
