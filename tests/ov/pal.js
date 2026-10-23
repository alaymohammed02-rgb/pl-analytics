const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const pg=await b.newPage();
await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForFunction(()=>typeof THEME==='object'&&typeof D==='object'&&D);
console.log(await pg.evaluate(()=>JSON.stringify({base:THEME.base&&{th:THEME.base.th,bg:THEME.base.bg,hi:THEME.base.hi},leagues:THEME.leagues.map(t=>({k:t.key,base:t.base,pal:t.pal})),leaguesAll:ALL.leagues.map(l=>l.id+':'+l.name)})));
console.log(await pg.evaluate(()=>{const s=INS.addPage.toString();return s.slice(0,600)}));await b.close()})();
