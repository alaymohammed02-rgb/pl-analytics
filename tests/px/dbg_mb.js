const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext();
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
const pg=await ctx.newPage();pg.on('console',m=>console.log('C',m.type(),m.text()));pg.on('pageerror',e=>console.log('PE',e.message));
await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForTimeout(8000);
console.log(await pg.isVisible('#mb .mb-days'),await pg.evaluate(()=>({first:document.querySelector('#home').firstElementChild.id,mb:!!document.querySelector('#mb'),flag:document.getElementById('home')&&document.getElementById('home').dataset.mb,hsec:document.querySelectorAll('#home .hsec').length})));await b.close()})();
