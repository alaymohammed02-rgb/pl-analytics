const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});const ctx=await b.newContext({viewport:{width:1280,height:900}});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForTimeout(2500);
 const pages=await pg.evaluate(()=>PAGES.map(p=>'#/'+p[0]).concat(['#/club/Arsenal','#/player/'+encodeURIComponent((D.stats.find(s=>s.player==='Bukayo Saka')||D.stats[0]).key+'||Arsenal')]));
 for(const h of pages){await pg.evaluate(x=>location.hash=x,h);await pg.waitForTimeout(2200);
  const r=await pg.evaluate(()=>{const a=[...document.querySelectorAll('#app svg a[href]')];const t=[...document.querySelectorAll('#app [data-tip] a[href], #app a[href][data-tip]')];const c=[...document.querySelectorAll('#app svg [onclick]')].map(e=>e.getAttribute('onclick').slice(0,30));
   return {svgA:a.length,ex:a.slice(0,2).map(x=>x.getAttribute('href')),tipA:t.length,onclick:[...new Set(c)].slice(0,4)}});
  if(r.svgA||r.tipA||r.onclick.length)console.log(h,JSON.stringify(r))}
 await b.close()})();
