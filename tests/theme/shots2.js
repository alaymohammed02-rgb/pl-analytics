const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [k,id,h,w] of [['pl_table','l_4WFCIZ','#/table',1280],['pl_over','l_4WFCIZ','#/overview',1280],['arsenal','l_4WFCIZ','#/club/Arsenal',1280],['chelsea','l_4WFCIZ','#/club/Chelsea',1280],['spurs','l_4WFCIZ','#/club/Tottenham%20Hotspur',390],['bund','l_1Isor4','#/table',1280],['l1','l_3FJFUl','#/table',1280],['pl_fantasy','l_4WFCIZ','#/fantasy',1280],['pl_shots','l_4WFCIZ','#/shots',1280]]){
  const ctx=await b.newContext({viewport:{width:w,height:760}});await ctx.addInitScript(i=>{localStorage.setItem('league',i)},id);const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:8765/index.html'+h);await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(h==='#/fantasy'?5000:2000);await pg.screenshot({path:__dirname+'/s2_'+k+'.png'});await ctx.close()}
 await b.close()})();
