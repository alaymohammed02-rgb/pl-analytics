const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [port,name] of [[8778,'main'],[8777,'home'],[8778,'main'],[8777,'home']]){const ctx=await b.newContext({viewport:{width:390,height:860}});await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en');window.__lt=0;new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt+=Math.max(0,e.duration-50))).observe({type:'longtask',buffered:true})});
 const pg=await ctx.newPage();let bytes=0,files=[];pg.on('response',async r=>{try{const l=+(r.headers()['content-length']||0);bytes+=l;files.push(r.url().split('/').pop().split('?')[0]+':'+Math.round(l/1024))}catch(e){}});
 const t0=Date.now();await pg.goto('http://127.0.0.1:'+port+'/index.html#/overview');await pg.waitForSelector('#app h2');const t1=Date.now()-t0;
 if(name==='home')await pg.waitForSelector('#home .hsec');const t2=Date.now()-t0;await pg.waitForTimeout(2500);
 console.log(name,'h2',t1,'ms; home',t2,'ms; MB',(bytes/1048576).toFixed(2),'blocking',Math.round(await pg.evaluate(()=>__lt)),'ms',files.filter(f=>/json/.test(f)).join(' '));await ctx.close()}
 await b.close()})();
