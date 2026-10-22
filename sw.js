/* PL Analytics service worker: lets the site be installed, open fast, and open without a connection.
   - Data files whose ?v= is a content hash (photos, logos, ratings, lineups, halves) never change at that address, so they come
     straight from the copy kept on the device; a new version is a new address, and the old copy of that file is then dropped.
   - Everything else (the page, its scripts and styles under assets/, whose ?v= is set by hand and so cannot be trusted to
     change with the file, data files versioned by time, data/index.json, data/live.json) is network first: a fresh copy
     always wins when there is a connection; the last good copy (one per file) is used only when the network fails.
   Only this site's own files are touched: photos on PitchAPI's CDN, the GitHub API and anything from another site go straight
   to the network, never cached here. */
const CACHE='pla-v3';
const SHELL=['./','index.html','manifest.webmanifest','assets/icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>null).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});
const fixed=u=>/\/data\//.test(u.pathname)&&/^[0-9a-f]{10}$/.test(u.searchParams.get('v')||'');
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==self.location.origin)return;
 const key=u.origin+u.pathname;
 if(fixed(u)){
  e.respondWith(caches.open(CACHE).then(async c=>{
   const hit=await c.match(r.url);if(hit)return hit;
   const res=await fetch(r);
   if(res&&res.ok&&res.type==='basic'){const cp=res.clone();(async()=>{const ks=await c.keys();await Promise.all(ks.filter(k=>{const x=new URL(k.url);return x.pathname===u.pathname&&k.url!==r.url}).map(k=>c.delete(k)));await c.put(r.url,cp)})().catch(()=>null)}
   return res;
  }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||Response.error())));
  return;
 }
 e.respondWith(fetch(r).then(res=>{
  if(res&&res.ok&&res.type==='basic'){const cp=res.clone();caches.open(CACHE).then(c=>c.put(key,cp)).catch(()=>null)}
  return res;
 }).catch(()=>caches.match(key).then(m=>m||caches.match(r,{ignoreSearch:true})).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):undefined)).then(m=>m||Response.error())));
});
