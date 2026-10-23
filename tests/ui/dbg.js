const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:390,height:860}});const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:8773/index.html#/overview');await pg.waitForSelector('#app h2');await pg.waitForTimeout(1200);
 console.log(await pg.evaluate(()=>{const s=getComputedStyle(document.getElementById('secnav')),q=getComputedStyle(document.getElementById('q'));
  const css=[...document.styleSheets].flatMap(x=>[...x.cssRules]).filter(r=>r.cssText.includes('secnav')).map(r=>r.cssText.slice(0,120));
  return {pos:s.position,qd:q.display,iw:innerWidth,sw:document.scrollingElement.scrollWidth,mm:matchMedia('(max-width:760px)').matches,css}}));
 const raw=require('fs').readFileSync('/home/user/pl-analytics/index.html','utf8');const i=raw.indexOf('@media(max-width:760px){ #secnav');console.log(i,raw.slice(i,i+200));await b.close()})();
