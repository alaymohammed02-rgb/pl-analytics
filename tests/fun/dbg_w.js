const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext({viewport:{width:390,height:900}});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html'+process.argv[2]);await pg.waitForSelector(process.argv[3],{timeout:90000});await pg.waitForTimeout(800);
 console.log(await pg.evaluate(()=>{const W=innerWidth,o=[];document.querySelectorAll('#app *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0)o.push(e.tagName+'.'+e.className+' '+Math.round(r.left)+'-'+Math.round(r.right))});return o.slice(0,12).join('\n')}));await b.close()})();
