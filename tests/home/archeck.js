const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const lg of ['l_4WFCIZ','l_0ErfuF']){
 const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(l=>{localStorage.clear();localStorage.setItem('league',l);localStorage.setItem('lang','ar')},lg);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8777/index.html#/overview');await pg.waitForSelector('#home .hsec',{timeout:60000});
 await pg.evaluate(()=>{const f=document.getElementById('hfpl');if(f)f.scrollIntoView()});await pg.waitForTimeout(3500);
 await pg.evaluate(()=>document.querySelectorAll('#home details').forEach(d=>d.open=true));await pg.waitForTimeout(500);
 const left=await pg.evaluate(()=>{const names=new Set();(HOME.c.ag||[]).forEach(a=>{names.add(a.n);names.add(a.club)});const o=new Set();const w=document.createTreeWalker(document.getElementById('home'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,.tbl,table'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{2}/.test(t)&&!names.has(t))o.add(t)}return [...o]});
 console.log(lg,left);await ctx.close()}
 await b.close()})();
