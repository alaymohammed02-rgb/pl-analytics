const {chromium}=require('/opt/node-tools/node_modules/playwright');
const [,,hash,sel,out,vw,lang,league,clip]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:+vw||1280,height:900},deviceScaleFactor:1});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang||'en',league||'l_4WFCIZ']);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html'+hash);await pg.waitForSelector(sel,{timeout:120000});await pg.waitForTimeout(1200);
 await pg.screenshot({path:out,fullPage:clip!=='view'});await b.close()})();
