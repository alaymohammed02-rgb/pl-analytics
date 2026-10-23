const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(l=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)},lang);
  const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/fantasy');await pg.waitForSelector('#fproot .ctl button',{timeout:60000});
  await pg.click(`#fproot .ctl button:text-is("${lang==='ar'?'الأنماط':'Patterns'}")`);await pg.waitForSelector('.fpx-pat');await pg.waitForTimeout(500);
  await pg.screenshot({path:__dirname+`/pat_${vw}_${lang}.png`,fullPage:true});
  await pg.click(`#fproot .ctl button:text-is("${lang==='ar'?'مراجعة الموسم':'Season review'}")`);await pg.waitForSelector('#srall .fpx-s',{timeout:30000});await pg.waitForTimeout(500);
  const el=await pg.$('#srall');await el.screenshot({path:__dirname+`/acr_${vw}_${lang}.png`});await ctx.close()}
 await b.close()})();
