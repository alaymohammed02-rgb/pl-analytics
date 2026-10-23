const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(()=>{localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang','ar')});const pg=await ctx.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())});
 await pg.goto('http://127.0.0.1:8771/index.html#/overview');await pg.waitForSelector('#app h2');
 for(const h of ['#/table','#/teams','#/club/Barcelona',"#/club/"+encodeURIComponent('Atlético Madrid'),'#/club/Elche','#/overview','#/table','#/club/Barcelona']){await pg.evaluate(x=>location.hash=x,h);
  const t0=Date.now();let ok=false;try{await pg.waitForSelector('#app h2',{timeout:8000});ok=true}catch(e){}
  console.log(h,ok?'ok':'TIMEOUT',Date.now()-t0,'ms | hash',await pg.evaluate(()=>location.hash),'| app:',(await pg.innerText('#app')).slice(0,50).replace(/\n/g,' '),'| h2:',await pg.evaluate(()=>{const e=document.querySelector('#app h2');if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.width,r.height,s.visibility,s.opacity,s.display]}));await pg.waitForTimeout(500)}
 console.log('errors',errs);await b.close()})();
