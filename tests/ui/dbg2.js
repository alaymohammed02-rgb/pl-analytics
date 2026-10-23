const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:390,height:860}});const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:8773/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(1200);
 console.log(await pg.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>400||e.getBoundingClientRect().left<-10).slice(0,8).map(e=>e.tagName+'#'+e.id+'.'+e.className+' '+Math.round(e.getBoundingClientRect().width))));await b.close()})();
