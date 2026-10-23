const {chromium}=require('playwright');const fs=require('fs');
const [,,out,vw,lang,league]=process.argv;const RARE=fs.readFileSync(__dirname+'/rare.json','utf8');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const ctx=await b.newContext({viewport:{width:+vw||1280,height:900}});
 await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch();const j=await res.json();j.rr='test1';r.fulfill({response:res,body:JSON.stringify(j)})});
 await ctx.route(/data\/rare\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:RARE}));
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang||'en',league||'l_4WFCIZ']);
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/rare');await pg.waitForSelector('.rr-hero',{timeout:120000});await pg.waitForTimeout(1200);
 await pg.screenshot({path:out,fullPage:true});await b.close()})();
