const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(()=>{localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','ar')});const pg=await ctx.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8771/index.html#/overview');await pg.waitForSelector('#app h2');
 for(const h of ['#/club/Barcelona','#/club/Elche','#/overview','#/table','#/club/Barcelona']){await pg.evaluate(x=>location.hash=x,h);await pg.waitForTimeout(2500);
  console.log(h,'| h2:',await pg.evaluate(()=>{const e=document.querySelector('#app h2');return e?[e.textContent,getComputedStyle(e).display,e.getBoundingClientRect().height]:null}),'| app:',(await pg.innerText('#app')).slice(0,60).replace(/\n/g,' '))}
 console.log('errors',errs);await b.close()})();
