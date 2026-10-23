const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');const RARE=fs.readFileSync(__dirname+'/rare.json','utf8');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:390,height:900}});
 await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch();const j=await res.json();j.rr='t';r.fulfill({response:res,body:JSON.stringify(j)})});
 await ctx.route(/data\/rare\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:RARE}));
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_1Isor4');localStorage.setItem('lang','ar')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/rare');await pg.waitForSelector('.rr-c');await pg.waitForTimeout(800);
 console.log(await pg.$eval('.rr-c .rr-s .fx-ar bdi[dir=ltr]',e=>{const t=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const out=[];let n;while(n=t.nextNode()){for(let i=0;i<n.length;i++){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();if(b.width)out.push(n.data[i]+'@'+Math.round(b.left))}}return out.join(' ')}));await b.close()})();
