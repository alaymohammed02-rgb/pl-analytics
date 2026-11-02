/* Mujassam Studio service worker: keeps the editor's own files on the device so it opens fast and without a connection.
   Network first (a fresh copy always wins when online), the last good copy when the network fails. Only this folder's own files. */
const CACHE='mjm-studio-v1';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','vendor/three.min.js','vendor/OrbitControls.js','vendor/TransformControls.js','vendor/GLTFLoader.js','vendor/OBJLoader.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>null).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(new URL('./',self.location).pathname))return;
 e.respondWith(fetch(r).then(res=>{if(res&&res.ok&&res.type==='basic'){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp)).catch(()=>null)}return res})
  .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):undefined)).then(m=>m||Response.error())));
});
