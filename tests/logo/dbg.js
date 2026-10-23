const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 let ctx=await b.newContext();await ctx.addInitScript(()=>{localStorage.setItem('league','l_1Isor4')});let pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:8771/index.html#/club/Bayern%20M%C3%BCnchen');await pg.waitForSelector('.clubhd',{timeout:30000});await pg.waitForTimeout(500);
 console.log(await pg.evaluate(async()=>{const c=await thCrest(logoOf('Bayern München'));return JSON.stringify({c,pal:thClubPal('Bayern München')})}));
 ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(()=>{localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','ar')});pg=await ctx.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8771/index.html#/club/Barcelona');await pg.waitForTimeout(4000);
 console.log('errors',errs);console.log((await pg.innerText('#app')).slice(0,300));await b.close()})();
