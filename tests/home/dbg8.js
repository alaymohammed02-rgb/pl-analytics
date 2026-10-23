const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext();
 await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
 const pg=await ctx.newPage();const P=['DF','MF','FW'],pos=id=>P[[...id].reduce((a,ch)=>a+ch.charCodeAt(0),0)%3];
 await pg.route(/\/data\/l_4WFCIZ(_pl)?\.json/,async r=>{const res=await r.fetch(),j=await res.json();if(j.cols){const io=j.cols.indexOf('o'),ii=j.cols.indexOf('i');j.rows.forEach(x=>x[io]=pos(x[ii]))}else j.stats.forEach(x=>x.o=x.xf!=null?'GK':pos(x.i));await r.fulfill({json:j})});
 await pg.goto('http://127.0.0.1:8777/index.html#/players');await pg.waitForTimeout(3500);
 console.log(await pg.evaluate(()=>{const t=document.querySelector('#app table');return [[...t.querySelectorAll('th')].map(x=>x.textContent.trim()),[...t.querySelectorAll('tbody tr')].slice(0,3).map(r=>r.innerText)]}));
 await b.close()})();
