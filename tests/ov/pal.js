const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const pg=await b.newPage();
await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForFunction(()=>typeof THEME==='object'&&typeof D==='object'&&D);
console.log(await pg.evaluate(()=>JSON.stringify({base:THEME.base&&{th:THEME.base.th,bg:THEME.base.bg,hi:THEME.base.hi},leagues:THEME.leagues.map(t=>({k:t.key,base:t.base,pal:t.pal})),leaguesAll:ALL.leagues.map(l=>l.id+':'+l.name)})));
console.log(await pg.evaluate(()=>{const s=INS.addPage.toString();return s.slice(0,600)}));await b.close()})();
