const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const src=fs.readFileSync('/home/user/pl-analytics/assets/match-replay.js','utf8');const obj=src.slice(src.indexOf('INS.ar({')+7,src.lastIndexOf('});')+1);const mine=eval('('+obj+')');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});const pg=await b.newPage();
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForFunction(()=>typeof AR==='object'&&typeof INS==='object');
 const r=await pg.evaluate(m=>Object.entries(m).filter(([k,v])=>AR[k]!==v).map(([k,v])=>k+' => site: '+AR[k]+' | mine: '+v),mine);console.log(r.join('\n')||'no collisions');
 console.log('equal to key:',Object.entries(mine).filter(([k,v])=>k===v));await b.close()})();
