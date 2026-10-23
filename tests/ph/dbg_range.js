const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext();
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','en')}});
const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/pressline');await pg.waitForSelector('.ph-dash');await pg.selectOption('#phtm','Barcelona');await pg.waitForTimeout(300);
await pg.selectOption('#phfr','2026-09-06');await pg.waitForTimeout(300);
console.log(await pg.evaluate(()=>({team:document.querySelector('#phtm').value,fr:document.querySelector('#phfr').value,pts:[...document.querySelectorAll('.ph-dash .ph-ch:first-of-type .ph-d.t')].map(c=>c.getAttribute('data-tip').split('|')[0]),av:document.querySelector('.ph-dash .ph-ch:first-of-type .ph-avt').textContent})));await b.close()})();
