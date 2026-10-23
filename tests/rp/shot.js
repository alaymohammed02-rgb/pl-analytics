const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/replay/m_3p07rX');await pg.waitForSelector('#rp .rp-sb');
 await pg.evaluate(()=>{const s=document.querySelector('#rpsk');s.value=74.4;s.dispatchEvent(new Event('input'));s.dispatchEvent(new Event('change'))});
 await pg.selectOption('#rpsp','120');await pg.click('#rpp');await pg.waitForSelector('#rpov.on.gl',{timeout:15000});await pg.waitForTimeout(300);
 await pg.screenshot({path:__dirname+'/final_'+vw+'.png',fullPage:true});await ctx.close()}
 await b.close()})();
