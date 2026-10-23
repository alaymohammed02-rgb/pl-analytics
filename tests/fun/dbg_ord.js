const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext({viewport:{width:1280,height:860}});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForTimeout(2500);
 console.log(await pg.evaluate(()=>{const t=document.querySelector('header .top');return getComputedStyle(t).display+' | '+[...t.children].map(e=>(e.id||e.className)+':order='+getComputedStyle(e).order+':x='+Math.round(e.getBoundingClientRect().left)).join(' , ')}));await b.close()})();
