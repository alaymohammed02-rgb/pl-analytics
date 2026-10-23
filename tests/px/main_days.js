const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:1280,height:900}});
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8790/index.html#/overview');await pg.waitForSelector('#mb .mb-days');
for(const t of ['Yesterday','Tomorrow','Sat, 24 Oct']){await pg.click(`#mb .mb-days button:has-text("${t}")`);await pg.waitForTimeout(300);
 console.log(t,JSON.stringify(await pg.$$eval('#mb .mb-g',G=>G.map(g=>g.querySelector('.mb-lh b').textContent+':'+g.querySelectorAll('.mb-r').length+' e.g. '+(g.querySelector('.mb-r')||{}).innerText.replace(/\s+/g,' ')))));
 if(t==='Yesterday')await pg.locator('#mb').screenshot({path:'main_yday.png'})}
await b.close()})();
