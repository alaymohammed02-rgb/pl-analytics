/* Loading order (sync.py: the page scripts carry fetchpriority="low"; while they load, the open page is drawn once the last script that sets its renderer has run,
   then once more when all have run; loadJson shares one download between callers that ask for the same file at the same time; the language button's "عربي" is drawn
   with the system font on the English page). The page scripts are held back on purpose (each answered 0-300 ms late) while the data comes at once, which is when the
   old page drew itself once per script: the number of draws of #app, no other page's content on a feature page while loading, the final page complete; two
   simultaneous loadJson calls make one request and get two separate objects; the English page does not download the Arabic font, the Arabic page does. */
const T=require('../nf/lib.js');const {ok}=T;
const U='http://127.0.0.1:8765/index.html';
async function slowOpen(b,hash,lang){const ctx=await b.newContext({viewport:{width:1100,height:900}});
 await ctx.addInitScript(l=>{try{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}catch(e){}
  window.__draws=[];new MutationObserver(()=>{}).observe(document,{childList:true});
  document.addEventListener('readystatechange',()=>{});
  const watch=()=>{const a=document.getElementById('app');if(!a){requestAnimationFrame(watch);return}
   new MutationObserver(ms=>{for(const m of ms)if(m.target===a&&m.addedNodes.length){const h=a.querySelector('h2');window.__draws.push([document.readyState,h?h.textContent:'',a.querySelector('.skel')?1:0])}}).observe(a,{childList:true})};watch()},lang||'en');
 let n=0;await ctx.route(/\/assets\/[\w-]+\.js/,async r=>{const d=(n++*37)%300;await new Promise(z=>setTimeout(z,d));r.continue()});
 const reqs=[];ctx.on('request',q=>reqs.push(q.url()));
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+hash);return {ctx,pg,errs,reqs}}
(async()=>{const b=await T.launch();
 /* the script tags */
 {const {ctx,pg}=await T.open(b,{hash:'#/table',league:'l_4WFCIZ'});await pg.waitForSelector('.lt',{timeout:60000});
  const t=await pg.$$eval('script[src^="assets/"]',a=>a.map(s=>s.getAttribute('fetchpriority')));
  ok(t.length>80&&t.every(x=>x==='low'),'all '+t.length+' page scripts load with fetchpriority="low" (the data the page needs comes first)');
  const RT=await pg.evaluate(()=>({ord:RT_ORD.length,ledger:RT_ORD[RT_LAST.ledger],overview:RT_ORD[RT_LAST.overview],table:RT_LAST.table}));
  ok(RT.ord>80&&RT.ledger==='ledger'&&RT.overview==='overview'&&RT.table===undefined,'the page knows the last script that sets each renderer: ledger → ledger.js, overview → overview.js, the table is the main script\'s own');
  /* loadJson: one request for two callers at once, two separate objects */
  const r=await pg.evaluate(async()=>{const n0=performance.getEntriesByType('resource').filter(e=>/facts\.json/.test(e.name)).length;const v='t'+Date.now();
   const [a,c]=await Promise.all([loadJson('facts.json',v),loadJson('facts.json',v)]);a.__x=1;const n1=performance.getEntriesByType('resource').filter(e=>/facts\.json/.test(e.name)).length;
   let err='';try{await loadJson('no-such-file.json',v)}catch(e){err=e.message}
   const again=await loadJson('facts.json',v);return {req:n1-n0,sep:c.__x===undefined&&a!==c,err,again:again.__x===undefined}});
  ok(r.req===1&&r.sep&&r.again,'two loadJson calls for the same file at the same time: one request, two separate objects (changing one leaves the other), a later call gets a fresh copy');
  ok(/no-such-file\.json \(HTTP 404\)/.test(r.err),'a missing file still fails with its name and status: '+r.err);
  await ctx.close()}
 /* the Overview with the scripts held back */
 {const {ctx,pg,errs}=await slowOpen(b,'#/overview');await pg.waitForSelector('#ovmb .mb-pg, #ovmb .empty:not(.skel)',{timeout:90000});await pg.waitForLoadState('load');await pg.waitForTimeout(800);
  const d=await pg.evaluate(()=>window.__draws),full=d.filter(x=>!x[2]);
  ok(full.length<=4,'Overview: drawn '+full.length+' times while 87 scripts arrived late (the old page drew once per script) '+JSON.stringify(full.map(x=>x[0]+':'+x[1])));
  ok(full.every(x=>x[1]==='Overview'),'Overview: never drawn as another page while loading (the main script\'s own league page is not drawn first)');
  ok(!!(await pg.$('#ovx .rm-x, #ovx *'))&&!errs.length,'Overview: complete at the end (Explore is there), no page errors '+errs.slice(0,2).join(' ; '));
  await ctx.close()}
 /* a feature page with the scripts held back */
 {const {ctx,pg,errs,reqs}=await slowOpen(b,'#/ledger');await pg.waitForSelector('#ldgroot',{timeout:90000});await pg.waitForLoadState('load');await pg.waitForTimeout(800);
  const d=await pg.evaluate(()=>window.__draws),full=d.filter(x=>x[1]);
  ok(full.length>=1&&full.every(x=>x[1]==='Prediction ledger'),'Prediction ledger: drawn only as itself ('+full.length+' times), never first as the Overview '+JSON.stringify(full.map(x=>x[1])));
  const extra=reqs.filter(u=>/_sh\.json|facts\.json|elo_own\.json/.test(u)).map(u=>u.replace(/^.*\/data\//,'').split('?')[0]);
  ok(!extra.length,'Prediction ledger: the Overview\'s data (shots, facts, Elo) was not downloaded for it'+(extra.length?' — '+extra.join(', '):''));
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* the table (drawn by the main script) is drawn as soon as the data is there */
 {const {ctx,pg,errs}=await slowOpen(b,'#/table');await pg.waitForSelector('.lt',{timeout:90000});const st=await pg.evaluate(()=>document.readyState);await pg.waitForLoadState('load');
  ok(!errs.length,'League table with the scripts held back: drawn (document '+st+' when it appeared), no page errors');await ctx.close()}
 /* fonts: the English page does not download the Arabic font; the Arabic page does */
 for(const lang of ['en','ar']){const {ctx,pg,reqs}=await slowOpen(b,'#/overview',lang);await pg.waitForSelector('#ovmb .mb-pg, #ovmb .empty:not(.skel)',{timeout:90000});await pg.waitForLoadState('networkidle').catch(()=>{});
  const arf=reqs.some(u=>/plex-sans-arabic/.test(u));
  ok(lang==='en'?!arf:arf,lang==='en'?'English page: the Arabic font is not downloaded (the "عربي" button uses the system font)':'Arabic page: the Arabic font is downloaded');
  if(lang==='en')ok(await pg.$eval('#langbtn',e=>!/Plex/.test(getComputedStyle(e).fontFamily)),'the language button on the English page uses the system font');await ctx.close()}
 await T.done(b)})();
