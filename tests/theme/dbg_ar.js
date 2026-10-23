const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext();await ctx.addInitScript(()=>{localStorage.setItem('lang','ar')});const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:8765/index.html#/club/Arsenal');await pg.waitForSelector('.clubhd');await pg.waitForTimeout(800);
 console.log(JSON.stringify(await pg.evaluate(()=>[...document.querySelectorAll('#app .mu')].slice(0,3).map(e=>[...e.childNodes].map(n=>n.nodeType===3?n.nodeValue:'<'+n.nodeName+'>'+n.textContent)))));
 console.log(JSON.stringify(await pg.evaluate(()=>[thCr('#ef0107','#0d1520'),thCr('#c8102e','#0d1520'),thCr('#da291c','#0d1520'),thCr('#034694','#0d1520'),thCr('#670e36','#0d1520')])));await b.close()})();
