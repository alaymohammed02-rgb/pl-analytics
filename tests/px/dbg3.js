const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const lang of ['ar','en']){
 const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage();pg.on('pageerror',e=>console.log('PE',e.message,e.stack&&e.stack.slice(0,300)));pg.on('console',m=>{if(!/TUNNEL|Failed to load/.test(m.text()))console.log('C',m.type(),m.text().slice(0,300))});
 await pg.goto('http://127.0.0.1:8765/index.html#/player/p_3fAmwG%7C%7CTottenham%20Hotspur');await pg.waitForTimeout(6000);
 console.log(lang,await pg.evaluate(()=>({pp:!!document.getElementById('pp'),h:document.querySelector('#pp')&&document.querySelector('#pp').innerHTML.slice(0,200),h2:(document.querySelector('#app h2')||{}).textContent})));
 await ctx.close()}
 await b.close()})();
