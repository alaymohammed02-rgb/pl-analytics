const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [port,touch] of [[8778,false],[8777,false],[8778,true],[8777,true]]){
  const ctx=await b.newContext(touch?{viewport:{width:390,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2}:{viewport:{width:1280,height:860}});
  await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
  const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:'+port+'/index.html#/players');await pg.waitForTimeout(3000);
  const g=await pg.$('.gli');await g.scrollIntoViewIfNeeded();const bb=await g.boundingBox();
  await pg.screenshot({path:__dirname+`/shots/g_${port}_${touch?'m':'d'}.png`,clip:{x:Math.max(0,bb.x-120),y:bb.y-25,width:240,height:70}})}
 await b.close()})();
