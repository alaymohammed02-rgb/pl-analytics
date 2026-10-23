const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const lang of ['ar','en']){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(l=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},lang);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('#mb .mb-days',{timeout:90000});await pg.waitForTimeout(600);
 console.log(lang,await pg.evaluate(()=>({sw:document.scrollingElement.scrollWidth,top:[...document.querySelector('header .top').children].map(e=>e.id||e.className+':'+Math.round(e.getBoundingClientRect().left)+'-'+Math.round(e.getBoundingClientRect().right))})));await ctx.close()}
 await b.close()})();
