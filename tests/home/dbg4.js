const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const pg=await b.newPage();
 await pg.goto('http://127.0.0.1:8777/index.html#/compare');await pg.waitForTimeout(4000);
 console.log(await pg.evaluate(()=>{const o={};for(const k of ['CL_LIM','CL_DEF']){try{const v=eval(k);o[k]=JSON.stringify(v).slice(0,300)}catch(e){}}o.mets=CLM.mets&&(Array.isArray(CLM.mets)?CLM.mets.length:Object.keys(CLM.mets).length);o.reg=CLM.reg&&Object.keys(CLM.reg).length;return o}));await b.close()})();
