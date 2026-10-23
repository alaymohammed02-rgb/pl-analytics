const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:860}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('plx_lab_v1','{"v":1,"recs":[]}');localStorage.setItem('plx_fav_v1',JSON.stringify({fav:{l_4WFCIZ:'Liverpool'}}))}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>console.log('ERR',e.stack.split('\n').slice(0,5).join(' | ')));
 await pg.goto('http://127.0.0.1:8773/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(1200);
 for(const h of ['#/shots','#/data','#/settings','#/players','#/club/Arsenal']){await pg.evaluate(x=>location.hash=x,h);await pg.waitForTimeout(1500)}
 console.log('lab key after pages',await pg.evaluate(()=>localStorage.getItem('plx_lab_v1')),await pg.evaluate(()=>Object.keys(localStorage)));
 await pg.selectOption('#lgpick','l_0bfbkO');await pg.waitForTimeout(3000);await ctx.close();
 for(const u of ['http://127.0.0.1:8774/index.html#/shots']){const c=await b.newContext({viewport:{width:390,height:860}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','ar')});const p=await c.newPage();await p.goto(u);await p.waitForSelector('#app h2');await p.waitForTimeout(2500);console.log('MAIN (before this change) shots 390 ar scrollWidth',await p.evaluate(()=>document.scrollingElement.scrollWidth))}
 await b.close()})();
