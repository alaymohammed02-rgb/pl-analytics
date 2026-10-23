const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext({viewport:{width:1280,height:860}});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();pg.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())});
 for(const h of ['#/overview','#/round','#/rare','#/club/Arsenal','#/player/x||y','#/match/m_x','#/shots']){await pg.goto('http://127.0.0.1:8765/index.html'+h);await pg.waitForTimeout(1500)}
 await b.close()})();
