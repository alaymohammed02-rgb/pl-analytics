const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://127.0.0.1:8765/index.html#/pressline');await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.selectOption('#phtm','Barcelona');await pg.waitForTimeout(500);
 console.log(vw,lang,JSON.stringify(await pg.evaluate(()=>({hm:document.querySelector('#phhm').value,av:document.querySelector('.ph-dash .ph-ch .ph-avt').textContent,pts:document.querySelectorAll('.ph-dash .ph-ch')[0].querySelectorAll('.ph-d.t').length,top:[...document.querySelectorAll('.ph-ln')].slice(0,3).map(g=>g.getAttribute('data-tip').split('|').slice(0,2).join(' ')),read:[...document.querySelectorAll('.ph-read .fx-en')].map(x=>x.textContent)[0],noscroll:document.scrollingElement.scrollWidth<=innerWidth+1}))),errs);
 await pg.screenshot({path:__dirname+'/cb_'+vw+'.png',fullPage:true});await ctx.close()}
 await b.close()})();
