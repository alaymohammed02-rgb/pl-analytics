const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext();
await ctx.route(u=>/press-height\.js/.test(u.href),async r=>{await new Promise(z=>setTimeout(z,4000));r.continue()});
const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/table',{waitUntil:'commit'});await pg.waitForTimeout(1800);
const n0=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')).includes('#/pressline'));await pg.waitForTimeout(4500);
const n1=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')).includes('#/pressline'));console.log('before',n0,'after',n1,'page',await pg.evaluate(()=>location.hash+' '+document.querySelector('#app h2').textContent));await b.close()})();
