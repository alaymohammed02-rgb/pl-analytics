/* PL Analytics service worker: lets the site be installed and open without a connection.
   Network first for everything (the data changes every few minutes, so a fresh copy always wins when there is a connection);
   the last good copy of each file (one per file, whatever its ?v= version, so the cache does not grow) is used only when the
   network fails. Only this site's own files are touched: photos on PitchAPI's CDN, the GitHub API and anything else from
   another site go straight to the network, never cached here. */
const CACHE='pla-v1';
const SHELL=['./','index.html','manifest.webmanifest','assets/icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>null).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==self.location.origin)return;
 const key=u.origin+u.pathname;
 e.respondWith(fetch(r).then(res=>{
  if(res&&res.ok&&res.type==='basic'){const cp=res.clone();caches.open(CACHE).then(c=>c.put(key,cp)).catch(()=>null)}
  return res;
 }).catch(()=>caches.match(key).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):undefined)).then(m=>m||Response.error())));
});
