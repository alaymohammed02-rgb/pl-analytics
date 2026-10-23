const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
for(let i=0;i<4;i++){const ctx=await b.newContext({viewport:{width:1280,height:860}});const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8773/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(900);
const a=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href').slice(2)));console.log(a.length,a.join(','));await ctx.close()}await b.close()})();
