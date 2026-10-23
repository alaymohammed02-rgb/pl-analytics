const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext();
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/round');await pg.waitForTimeout(3500);
 console.log(await pg.evaluate(()=>[...document.querySelectorAll('#app [data-tip] a[href], #app a[href][data-tip]')].slice(0,5).map(a=>a.getAttribute('href')+' | '+(a.closest('[data-tip]')||a).className)));await b.close()})();
