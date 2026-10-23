const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:390,height:900}});
 await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','ar')});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/whatif');await pg.waitForSelector('#wiout .wi-score',{timeout:30000});
 console.log(await pg.evaluate(()=>[document.scrollingElement.scrollWidth,...[...document.querySelectorAll('#app *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left<-1).slice(0,6).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().left)+'..'+Math.round(e.getBoundingClientRect().right))]));
 await pg.screenshot({path:__dirname+'/wi_ar.png',fullPage:true});await b.close()})();
