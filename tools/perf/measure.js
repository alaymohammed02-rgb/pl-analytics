// Usage: node tools/perf/serve-gzip.js . 8790 &  then  node tools/perf/measure.js 8790 3 [page name, e.g. table]
// load a page on a throttled phone (CPU x4, ~1.6 Mbps down, 150 ms RTT), cold cache; report FCP, the time the page's main block is drawn, requests, bytes, long tasks
const {chromium}=require('playwright');
const PORT=+process.argv[2]||8790,RUNS=+process.argv[3]||3;
const PAGES=[['overview','#/overview','#ovmb .mb-pg, #ovmb .empty:not(.skel)'],['table','#/table','.lt'],['r-players','#/r-players','#rmg .rm-c'],['ledger','#/ledger','.ldg-t, #ldgroot .empty:not(.skel)']];
const ONLY=process.argv[4]||'';
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]};
(async()=>{const b=await chromium.launch();const out={};
 for(const [name,hash,sel] of PAGES){if(ONLY&&name!==ONLY)continue;const R=[];
  for(let i=0;i<RUNS;i++){const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   await ctx.addInitScript(()=>{try{localStorage.setItem('league','l_4WFCIZ')}catch(e){};window.__lt=0;try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt+=e.duration}).observe({type:'longtask',buffered:true})}catch(e){}});
   const pg=await ctx.newPage(),cdp=await ctx.newCDPSession(pg);
   await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:0.75e6/8});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   let bytes=0,reqs=0;const big={};cdp.on('Network.loadingFinished',e=>{bytes+=e.encodedDataLength;reqs++});
   cdp.on('Network.responseReceived',e=>{const u=e.response.url.replace(/^https?:\/\/[^/]+\//,'').split('?')[0];big[e.requestId]=u});
   const sizes={};cdp.on('Network.loadingFinished',e=>{const u=big[e.requestId];if(u)sizes[u]=(sizes[u]||0)+e.encodedDataLength});
   const t0=Date.now();await pg.goto(`http://127.0.0.1:${PORT}/index.html${hash}`,{waitUntil:'commit'});
   let ready=null;try{await pg.waitForSelector(sel,{timeout:120000});ready=Date.now()-t0}catch(e){ready=-1}
   await pg.waitForLoadState('networkidle',{timeout:120000}).catch(()=>{});const idle=Date.now()-t0;
   const m=await pg.evaluate(()=>{const p=performance.getEntriesByName('first-contentful-paint')[0];return {fcp:p?Math.round(p.startTime):null,lt:Math.round(window.__lt)}});
   R.push({ready,idle,fcp:m.fcp,lt:m.lt,reqs,kb:Math.round(bytes/1024),sizes});await ctx.close()}
  const top=Object.entries(R[0].sizes).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([u,s])=>u+' '+Math.round(s/1024)+'KB');
  out[name]={fcp:med(R.map(r=>r.fcp)),ready:med(R.map(r=>r.ready)),idle:med(R.map(r=>r.idle)),longtasks:med(R.map(r=>r.lt)),reqs:med(R.map(r=>r.reqs)),kb:med(R.map(r=>r.kb)),top}}
 console.log(JSON.stringify(out,null,1));await b.close()})();
