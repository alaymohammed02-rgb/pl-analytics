const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext({viewport:{width:390,height:800},deviceScaleFactor:2});await ctx.addInitScript(()=>{localStorage.setItem('lang','ar')});const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:8765/index.html#/club/Arsenal');await pg.waitForSelector('.clubhd');await pg.waitForTimeout(800);
 const el=(await pg.$$('#app .mu'))[1];await el.screenshot({path:__dirname+'/ar_sentence.png'});await (await pg.$('.clubhd')).screenshot({path:__dirname+'/ar_head.png'});await b.close()})();
