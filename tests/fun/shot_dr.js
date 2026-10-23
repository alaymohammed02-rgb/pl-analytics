const {chromium}=require('/opt/node-tools/node_modules/playwright');
const [,,out,vw,lang,openIt]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:+vw,height:+vw<500?844:900}});
 await ctx.addInitScript(l=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},lang);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('#mb .mb-days',{timeout:90000});await pg.waitForTimeout(800);
 if(openIt==='1'){await pg.click('#mnubtn');await pg.waitForTimeout(500)}
 await pg.screenshot({path:out});await b.close()})();
