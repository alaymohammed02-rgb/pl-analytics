const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const h of ['#/overview','#/table']){const ctx=await b.newContext();
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','en');localStorage.setItem('plx_fav_v1',JSON.stringify({v:1,fav:{l_0ErfuF:'Real Madrid'},skip:{},colors:true}))}});
 await ctx.route(u=>/overview\.js/.test(u.href),async r=>{console.log('delaying',r.request().url());await new Promise(z=>setTimeout(z,4000));r.continue()});
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html'+h,{waitUntil:'commit'});
 await pg.waitForTimeout(1500);const before=await pg.evaluate(()=>({fl:typeof favList,D:typeof D==='object'&&!!D,ready:document.readyState,th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),h2:(document.querySelector('#app h2')||{}).textContent}));
 await pg.waitForTimeout(5000);const after=await pg.evaluate(()=>({th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),h2:(document.querySelector('#app h2')||{}).textContent,mb:!!document.querySelector('#mb'),nav:[...document.querySelectorAll('#nav a')].some(a=>a.getAttribute('href')==='#/round')}));
 console.log(h,'before',JSON.stringify(before),'after',JSON.stringify(after),errs);await ctx.close()}
 await b.close()})();
