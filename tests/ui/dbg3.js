const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:1280,height:860}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('plx_lab_v1','{"v":1,"recs":[]}');localStorage.setItem('plx_fav_v1',JSON.stringify({fav:{l_4WFCIZ:'Liverpool'}}))}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>console.log('ERR',e.stack.split('\n').slice(0,4).join(' | ')));
 await pg.goto('http://127.0.0.1:8773/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(1500);
 await pg.evaluate(()=>location.hash='#/table');await pg.waitForTimeout(1200);
 await pg.selectOption('#lgpick','l_0bfbkO');await pg.waitForFunction(()=>D.id==='l_0bfbkO');await pg.waitForTimeout(2500);
 console.log('hash',await pg.evaluate(()=>location.hash),'fav',await pg.evaluate(()=>favOf()),'rows',await pg.$$eval('.ltr[data-t]',a=>a.length),'favrow',await pg.$$eval('.favrow',a=>a.map(x=>x.dataset.t||x.tagName)));
 console.log('lab key',await pg.evaluate(()=>localStorage.getItem('plx_lab_v1')));
 await ctx.close();
 const c2=await b.newContext({viewport:{width:390,height:860}});await c2.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','ar')});const p2=await c2.newPage();
 for(const u of ['http://127.0.0.1:8773/index.html#/shots']){await p2.goto(u);await p2.waitForSelector('#app h2');await p2.waitForTimeout(2500);
  console.log(u,await p2.evaluate(()=>({sw:document.scrollingElement.scrollWidth,w:[...document.querySelectorAll('#app *')].filter(e=>{const r=e.getBoundingClientRect();return r.left<-2||r.right>innerWidth+2}).slice(0,5).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().left)+'..'+Math.round(e.getBoundingClientRect().right))})))}
 await b.close()})();
