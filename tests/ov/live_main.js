const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[390,'ar'],[1280,'en']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang',l);localStorage.setItem('plx_fav_v1',JSON.stringify({v:1,fav:{l_0ErfuF:'Real Madrid',l_4WFCIZ:'Chelsea'},skip:{},colors:true}))}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://127.0.0.1:8790/index.html#/overview');await pg.waitForSelector('#ovfx .ovf-c',{timeout:60000}).catch(()=>errs.push('no facts'));await pg.waitForTimeout(1200);
 const r=await pg.evaluate(()=>({th:getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),week:document.querySelectorAll('#ovfx .ovf-c').length,teams:[...document.querySelectorAll('.ovf-team h3 a')].map(a=>a.textContent),noscroll:document.scrollingElement.scrollWidth<=innerWidth+1}));
 await pg.screenshot({path:__dirname+'/main_ov_'+vw+'.png',fullPage:true});
 await pg.evaluate(()=>location.hash='#/table');await pg.waitForTimeout(2500);const la=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim());
 await pg.selectOption('#lgpick','l_4WFCIZ');await pg.waitForTimeout(3000);const pl=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim());
 console.log(vw,lang,JSON.stringify(r),'LaLiga',la,'PL',pl,'errors',errs);await ctx.close()}
 await b.close()})();
