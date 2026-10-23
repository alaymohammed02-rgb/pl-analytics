const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/pressline');await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.selectOption('#phtm','Barcelona');await pg.waitForTimeout(500);
 await pg.click('.ph-dash circle.ph-d.t >> nth=3');await pg.waitForTimeout(400);
 console.log(vw,lang,JSON.stringify(await pg.evaluate(()=>({sel:document.querySelectorAll('.ph-d.on').length,lines:document.querySelectorAll('.ph-ln').length,pts:document.querySelectorAll('.ph-pt').length,read:[...document.querySelectorAll('.ph-read p')].map(p=>p.innerText).slice(0,5),noscroll:document.scrollingElement.scrollWidth<=innerWidth+1}))),errs);
 await pg.screenshot({path:__dirname+'/ph_'+vw+'.png',fullPage:true});await ctx.close()}
 await b.close()})();
