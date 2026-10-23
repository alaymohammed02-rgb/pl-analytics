const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(let i=0;i<3;i++){const ctx=await b.newContext({viewport:{width:1280,height:900}});
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();delete j.sch;delete j.live;delete j.h2h;r.fulfill({json:j})});
const pg=await ctx.newPage();const t0=Date.now();await pg.goto('http://127.0.0.1:8765/index.html#/overview');
await pg.waitForSelector('#home .hsec',{timeout:60000});const t1=Date.now()-t0;const ok=await pg.waitForSelector('#mb .mb-days',{timeout:20000}).then(()=>true).catch(()=>false);
console.log('hsec at',t1,'ms; board',ok,await pg.evaluate(()=>({flag:document.getElementById('home').dataset.mb,warn:window.__w})));await ctx.close()}
await b.close()})();
