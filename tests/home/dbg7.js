const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const ctx=await b.newContext({viewport:{width:390,height:860}});await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8777/index.html#/overview');await pg.waitForSelector('#home .hsec');await pg.waitForTimeout(2000);
 console.log(await pg.evaluate(()=>[...document.querySelectorAll('#home button,#home select,#home summary')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<24).map(e=>e.tagName+' '+e.textContent.slice(0,30)+' '+e.getBoundingClientRect().height)));
 console.log(await pg.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior));
 const sp=await pg.$('.hmain .hspl');await sp.scrollIntoViewIfNeeded();await pg.waitForTimeout(600);const bb=await sp.boundingBox();await pg.mouse.move(bb.x+bb.width*0.5,bb.y+bb.height/2);await pg.waitForTimeout(250);
 console.log(await pg.evaluate(()=>[document.getElementById('htip')&&document.getElementById('htip').className,document.getElementById('htip')&&document.getElementById('htip').innerText]));
 await b.close()})();
