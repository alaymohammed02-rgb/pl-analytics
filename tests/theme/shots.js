const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [k,id,h] of [['pl','l_4WFCIZ','#/club/Arsenal'],['pl_fantasy','l_4WFCIZ','#/fantasy'],['bund','l_1Isor4','#/overview'],['laliga','l_0ErfuF','#/table'],['seriea','l_0ALvwF','#/overview'],['ucl','l_0bfbkO','#/teams'],['l1','l_3FJFUl','#/overview']]){
  const ctx=await b.newContext({viewport:{width:1280,height:760}});await ctx.addInitScript(i=>{localStorage.setItem('league',i)},id);const pg=await ctx.newPage();
  await pg.goto('http://127.0.0.1:8765/index.html'+h);await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(h==='#/fantasy'?5000:1800);await pg.screenshot({path:__dirname+'/th_'+k+'.png'});await ctx.close()}
 await b.close()})();
