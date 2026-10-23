const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:860}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('plx_fav_v1',JSON.stringify({fav:{l_4WFCIZ:'Liverpool'}}))}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>console.log('ERR',e.stack.split('\n').slice(0,3).join(' | ')));pg.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await pg.goto('http://127.0.0.1:8773/index.html#/club/Arsenal');await pg.waitForSelector('.clubhd');await pg.waitForTimeout(1500);
 await pg.selectOption('#lgpick','l_0bfbkO');await pg.waitForFunction(()=>D.id==='l_0bfbkO');
 for(const w of [300,1500,4000,8000]){await pg.waitForTimeout(w);console.log(w,await pg.evaluate(()=>({h:location.hash,app:document.getElementById('app').innerText.slice(0,120).replace(/\n/g,' ')})))}
 await pg.evaluate(()=>location.hash='#/table');for(const w of [500,3000,8000]){await pg.waitForTimeout(w);console.log('table',w,await pg.evaluate(()=>({rows:document.querySelectorAll('#lt .ltr[data-t]').length,app:document.getElementById('app').innerText.slice(0,150).replace(/\n/g,' ')})))}
 await b.close()})();
