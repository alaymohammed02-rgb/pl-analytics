const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext();
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();delete j.sch;delete j.live;delete j.h2h;r.fulfill({json:j})});
const pg=await ctx.newPage();pg.on('console',m=>console.log('C',m.type(),m.text().slice(0,200)));pg.on('pageerror',e=>console.log('PE',e.message));
await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForTimeout(10000);
console.log(await pg.evaluate(()=>({mb:!!document.querySelector('#mb'),vis:document.querySelector('#mb .mb-days')?getComputedStyle(document.querySelector('#mb')).display:null,flag:(document.getElementById('home')||{}).dataset,hsec:document.querySelectorAll('#home .hsec').length,app:document.querySelector('#app').innerText.slice(0,200)})));await b.close()})();
