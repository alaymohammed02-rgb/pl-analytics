const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const port of [8778,8777]){const ctx=await b.newContext({viewport:{width:390,height:860}});await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:'+port+'/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(3000);
 console.log(port,await pg.evaluate(()=>({sw:document.scrollingElement.scrollWidth,lb:Math.round(document.getElementById('langbtn').getBoundingClientRect().right)})));await ctx.close()}
 await b.close()})();
