// Usage: node tools/perf/serve-gzip.js <repo root> 8790 (serves the site gzipped, as GitHub Pages does, for tools/perf/measure.js)
// static server with gzip (like GitHub Pages) for measuring
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=process.argv[2],PORT=+process.argv[3]||8790;
const T={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const cache=new Map();
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);
 fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end()}const ext=path.extname(f),ty=T[ext]||'application/octet-stream';
  const gz=/gzip/.test(q.headers['accept-encoding']||'')&&!/woff2|png/.test(ext);
  if(gz){let z=cache.get(f);if(!z||z.m!==b.length){z={m:b.length,d:zlib.gzipSync(b,{level:6})};cache.set(f,z)}r.writeHead(200,{'Content-Type':ty,'Content-Encoding':'gzip','Content-Length':z.d.length,'Cache-Control':'max-age=600'});r.end(z.d)}
  else{r.writeHead(200,{'Content-Type':ty,'Content-Length':b.length,'Cache-Control':'max-age=600'});r.end(b)}})}).listen(PORT,()=>console.log('up',PORT));
