const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext();
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/round');await pg.waitForTimeout(3500);
 const s=await pg.$('#app a.hdot');await s.scrollIntoViewIfNeeded();
 console.log(await pg.evaluate(()=>{const a=document.querySelector('#app a.hdot'),r=a.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return [r.width,r.height,e&&e.outerHTML.slice(0,140),getComputedStyle(a).pointerEvents,getComputedStyle(a).display]}));
 await pg.evaluate(()=>{window.__log=[];document.addEventListener('click',e=>__log.push('click on '+e.target.tagName+'.'+e.target.className+' prevented='+e.defaultPrevented),false)});
 await s.click();await pg.waitForTimeout(300);console.log('armed?',await pg.evaluate(()=>!!document.querySelector('.tap-armed')),await pg.evaluate(()=>location.hash),await pg.evaluate(()=>__log));
 await b.close()})();
