const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});let okc=0;const N=12;
 for(let i=0;i<N;i++){const ctx=await b.newContext({viewport:{width:390,height:900}});await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','ar')}});
  const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/overview');
  const r=await pg.waitForFunction(()=>document.querySelector('#potr .potr-c')&&document.getElementById('mds'),null,{timeout:20000}).then(()=>1).catch(()=>0);okc+=r;
  if(i%3===1){await pg.click('#langbtn');const r2=await pg.waitForFunction(()=>document.querySelector('#potr .potr-c')&&document.getElementById('mds')&&document.documentElement.lang==='en',null,{timeout:20000}).then(()=>1).catch(()=>0);console.log('after switch',r2)}
  await ctx.close()}
 console.log('loads with both extras:',okc,'/',N);await b.close()})();
