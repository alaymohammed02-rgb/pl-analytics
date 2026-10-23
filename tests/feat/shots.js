const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:1100,height:900}});
 await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/heatmaps');await pg.waitForSelector('#tml',{timeout:30000});await pg.selectOption('#tml','t');await pg.waitForSelector('#tmout .tm-pitch svg');await pg.waitForTimeout(400);
 const a=await pg.$('#app');await pg.screenshot({path:__dirname+'/tm.png',clip:{x:0,y:150,width:1100,height:900}});
 await pg.goto('http://127.0.0.1:8765/index.html#/whatif');await pg.waitForSelector('#wiout .wi-score');await pg.click('button.wi-b >> nth=2');await pg.waitForTimeout(400);
 await pg.screenshot({path:__dirname+'/wi.png',clip:{x:0,y:150,width:1100,height:900}});await b.close()})();
