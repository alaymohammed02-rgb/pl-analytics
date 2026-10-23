const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},['ar']);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/overview');
 pg.on('pageerror',e=>console.log('PE',e.message));pg.on('console',m=>console.log('C',m.text().slice(0,200)));for(let i=0;i<6;i++){await pg.waitForTimeout(1500);console.log(i,await pg.evaluate(()=>{const p=document.getElementById('potr');return p?{h:p.hidden,len:p.innerHTML.length,box:JSON.stringify(p.getBoundingClientRect()),disp:getComputedStyle(p).display}:'none'}))}
 await b.close()})();
