const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const pg=await b.newPage();
 await pg.goto('http://127.0.0.1:8777/index.html#/overview');await pg.waitForTimeout(3000);
 console.log(await pg.evaluate(()=>ALL.leagues.map(l=>{const t=thLeaguePal(l.id);return l.name+' bg '+t.bg+' sf '+t.sf+' hi '+t.hi})));await b.close()})();
