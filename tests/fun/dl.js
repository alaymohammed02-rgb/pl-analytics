const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const ctx=await b.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/cards');await pg.waitForSelector('.pc-res',{timeout:90000});
 const dl=pg.waitForEvent('download');await pg.click('.pc-duel .pc-card:nth-child(1) .shr-btn');const d=await dl;await d.saveAs('fun/card.png');await b.close()})();
