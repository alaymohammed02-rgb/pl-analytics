const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/height');
 await pg.waitForSelector('.dl-bars',{timeout:90000});await pg.waitForTimeout(500);
 console.log(vw,lang,'selected:',await pg.$eval('#dlc',s=>s.selectedOptions[0].textContent),'| teams',await pg.$$eval('.dl-bars li',a=>a.length),'| est card',!!(await pg.$('.dl-est')),errs);
 console.log((await pg.$$eval('.dl-bars li',a=>a.slice(0,6).map(l=>l.querySelector('.ph-bn').textContent.trim()+' '+l.querySelector('b').textContent))).join(' | '));
 await pg.screenshot({path:`ph/dl_cur_${vw}_${lang}.png`,fullPage:true});await ctx.close()}
await b.close()})();
