/* Heatmaps: the Compare tab (assets/player-heat.js). Recomputed from the league's heat file by the test's own loops: for several pairs (two players of one club, players of two clubs, the same
   player twice) the overlap (the sum over cells of the smaller share), the distance between the two average positions, which one is further up the pitch, and every cell's share of each player's
   actions (the hover titles of the difference pitch carry them: they add up to 100% for each player); the colour of the difference image at the cell with the largest gap is A's (or B's) colour
   according to the sign; the rings sit at the average positions and mirror with "Flip left/right"; the club choice changes the player list; the three tabs; the tab is kept; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const LG='l_4WFCIZ';
function groups(id){
 const H=J(IDX.leagues.find(l=>l.id===id).heat_file),GL=H.grid.l,GW=H.grid.w,by=new Map();
 for(const r of H.rows){if(r.t!=='p'||!Array.isArray(r.h)||!r.k||!r.c)continue;const key=r.c+'\u0001'+r.k;if(!by.has(key))by.set(key,{k:r.k,c:r.c,name:r.n,ms:new Set(),cells:new Array(GL*GW).fill(0),total:0});const g=by.get(key);g.ms.add(r.m);
  for(let i=0;i+2<r.h.length;i+=3){const x=r.h[i],y=r.h[i+1],n=r.h[i+2];if(x>=0&&x<GL&&y>=0&&y<GW&&n>0){g.cells[y*GL+x]+=n;g.total+=n}}}
 const out=[];for(const g of by.values()){if(!(g.total>0))continue;let sx=0,sy=0;g.cells.forEach((v,i)=>{if(v){sx+=v*((i%GL)+.5)*105/GL;sy+=v*(Math.floor(i/GL)+.5)*68/GW}});out.push({key:g.key=g.c+'\u0001'+g.k,k:g.k,c:g.c,name:g.name,n:g.ms.size,total:g.total,cells:g.cells,cx:sx/g.total,cy:sy/g.total,GL,GW})}
 out.sort((a,b)=>b.n-a.n||b.total-a.total||cmp(a.name,b.name)||cmp(a.k,b.k));return out}
const G=groups(LG),clubs=[...new Set(G.map(p=>p.c))].sort(cmp),by=new Map(G.map(p=>[p.key,p]));
function expectPair(a,b){const sa=a.cells.map(v=>v/a.total),sb=b.cells.map(v=>v/b.total);let ov=0;sa.forEach((v,i)=>{ov+=Math.min(v,sb[i])});return {sa,sb,ov:ov*100,dist:Math.hypot(a.cx-b.cx,a.cy-b.cy),dx:a.cx-b.cx}}
const norm=s=>s.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim();
async function read(pg){return pg.evaluate(()=>{const s=document.getElementById('hcsum');return {ov:+s.dataset.overlap,dist:+s.dataset.dist,dx:+s.dataset.dx,cells:[...document.querySelectorAll('#hcout .hs-dc')].map(r=>{const m=/: A ([\d.]+)% · B ([\d.]+)%/.exec(r.querySelector('title').textContent.replace(/[⁦-⁩‎‏]/g,''));return {i:+r.dataset.i,a:+m[1],b:+m[2]}}),
 rings:[...document.querySelectorAll('#hcout .hs-cg:nth-of-type(2) > div:nth-child(3) svg circle[stroke^="rgb"]')].map(c=>[+c.getAttribute('cx'),+c.getAttribute('cy'),c.getAttribute('stroke')]),img:!!document.querySelector('#hcout image.hs-diff'),
 names:[...document.querySelectorAll('#hcout .hs-cc')].slice(0,2).map(c=>c.innerText.replace(/\s+/g,' ').trim())}})}
function check(got,a,b,label,flip){
 const e=expectPair(a,b);
 ok(Math.abs(got.ov-e.ov)<=.06&&Math.abs(got.dist-e.dist)<=.06&&Math.abs(got.dx-e.dx)<=.06,label+': overlap '+got.ov+' (expected '+e.ov.toFixed(1)+'), distance '+got.dist+' ('+e.dist.toFixed(1)+'), A further up by '+got.dx+' ('+e.dx.toFixed(1)+')');
 const ca=new Map(got.cells.map(c=>[c.i,c]));
 ok(e.sa.every((v,i)=>{const c=ca.get(i);return v>0||e.sb[i]>0?(c&&Math.abs(c.a-v*100)<=.006&&Math.abs(c.b-e.sb[i]*100)<=.006):!c})&&Math.abs(got.cells.reduce((s,c)=>s+c.a,0)-100)<.5&&Math.abs(got.cells.reduce((s,c)=>s+c.b,0)-100)<.5,label+': every cell\'s share of each player (hover titles) matches and adds up to 100%');
 const ring=(p,x)=>Math.abs(x[0]-p.cx)<.01&&Math.abs(x[1]-(flip?68-p.cy:p.cy))<.01;
 ok(got.rings.length===2&&ring(a,got.rings[0])&&ring(b,got.rings[1])&&got.rings[0][2]!==got.rings[1][2],label+': the two rings sit at the average positions ('+(flip?'flipped':'as stored')+')');
 ok(got.img&&got.names[0].includes(a.name)&&got.names[1].includes(b.name),label+': the difference image is there and the two cards name the players')}
async function setPair(pg,a,b){await pg.selectOption('#hcac',a.c);await pg.selectOption('#hcap',a.key);await pg.selectOption('#hcbc',b.c);await pg.selectOption('#hcbp',b.key);await pg.waitForTimeout(500)}
/* the colour of the enlarged difference image at the cell with the largest gap: A's cyan when A leads, B's orange when B does */
async function sample(pg,a,b,flip){const e=expectPair(a,b),d=e.sa.map((v,i)=>v-e.sb[i]);let bi=0;d.forEach((v,i)=>{if(Math.abs(v)>Math.abs(d[bi]))bi=i});const x=bi%a.GL,y=Math.floor(bi/a.GL),yy=flip?a.GW-1-y:y;
 const px=await pg.evaluate(async([xx,yy,GL,GW])=>{const im=document.querySelector('#hcout image.hs-diff');const i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=im.getAttribute('href')});const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);const p=g.getImageData(Math.round((xx+.5)*i.width/GL),Math.round((yy+.5)*i.height/GW),1,1).data;return [...p]},[x,yy,a.GL,a.GW]);
 const lead=d[bi]>=0?'A':'B',cyan=px[2]>px[0],orange=px[0]>px[2];return {lead,px,okc:lead==='A'?cyan:orange}}
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/heatmaps'});await pg.waitForSelector('#hstabs',{timeout:90000});await pg.waitForTimeout(400);
 ok(await pg.$$eval('#hstabs button',a=>a.map(x=>x.dataset.k).join())==='match,season,compare','the three tabs: Match, Season average, Compare');
 await pg.click('#hstabs button[data-k="compare"]');await pg.waitForSelector('#hcout .hs-cg .pitch',{timeout:60000});await pg.waitForTimeout(500);
 ok(await pg.evaluate(()=>document.querySelector('#hsM').hidden&&document.querySelector('#hsS').hidden&&!document.querySelector('#hsC').hidden&&localStorage.getItem('plx_hs')==='compare'),'Compare opens and is kept (plx_hs)');
 const first=G.filter(p=>p.c===clubs[0]);
 ok(await pg.$eval('#hcac',s=>s.value)===clubs[0]&&await pg.$eval('#hcap',s=>s.value)===first[0].key&&await pg.$eval('#hcbp',s=>s.value)===first[1].key,'it opens on the first club\'s two players with most matches');
 check(await read(pg),first[0],first[1],'default pair',true);
 const o=await sample(pg,first[0],first[1],true);ok(o.okc,'default pair: the largest gap is coloured for '+o.lead+' (pixel '+o.px.join(',')+')');
 ok((await pg.$$eval('#hcap option',a=>a.map(x=>x.value))).join('|')===first.map(p=>p.key).join('|'),'the player list of the club is every player with a map, most matches first');
 const pairs=[[G.find(p=>p.c===clubs[5]),G.filter(p=>p.c===clubs[5])[3]],[G.filter(p=>p.c===clubs[2])[0],G.filter(p=>p.c===clubs[11])[2]],[G.filter(p=>p.c===clubs[9])[4],G.filter(p=>p.c===clubs[9])[4]]];
 for(const [a,c] of pairs){await setPair(pg,a,c);check(await read(pg),a,c,a.name+' / '+c.name,true);const s=await sample(pg,a,c,true);if(a.key!==c.key)ok(s.okc,a.name+' / '+c.name+': the largest gap is coloured for '+s.lead)}
 {const g=await read(pg);ok(g.ov>=99.9,'the same player twice: overlap '+g.ov+'%')}
 /* flip */
 const [pa,pc]=pairs[1];await setPair(pg,pa,pc);await pg.uncheck('#hcf');await pg.waitForTimeout(500);check(await read(pg),pa,pc,'unflipped',false);const s2=await sample(pg,pa,pc,false);ok(s2.okc,'unflipped: the largest gap is coloured for '+s2.lead);await pg.check('#hcf');await pg.waitForTimeout(400);
 ok(await T.noscroll(pg),'desktop: no horizontal scroll');
 /* the other tabs still work */
 await pg.click('#hstabs button[data-k="season"]');await pg.waitForSelector('#hsg[data-done="1"]',{timeout:60000});ok(await pg.$$eval('#hsg .hs-c',a=>a.length)>0&&await pg.evaluate(()=>document.querySelector('#hsC').hidden),'Season average still works and hides Compare');
 await pg.click('#hstabs button[data-k="compare"]');await pg.waitForTimeout(500);ok(await pg.evaluate(()=>!document.querySelector('#hsC').hidden&&!!document.querySelector('#hcout .hs-cg .pitch')),'back to Compare: the choice is still drawn');
 await pg.click('#hstabs button[data-k="match"]');await pg.waitForTimeout(300);ok(await pg.evaluate(()=>document.querySelectorAll('#hout svg').length>0&&document.querySelector('#hsC').hidden),'the Match tab still works');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* opens on the kept tab; Arabic and phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/heatmaps',init:{plx_hs:'compare'}}));await pg.waitForSelector('#hcout .hs-cg .pitch',{timeout:90000});await pg.waitForTimeout(500);
  check(await read(pg),first[0],first[1],lang+' phone',true);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('#hcout .pitch',a=>a.every(r=>{const x=r.getBoundingClientRect();return x.left>=-1&&x.right<=innerWidth+1&&x.width>200})),lang+' phone: the three pitches fit the screen, one under the other');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#hsC');ok(!u.length,'Arabic: the tab is translated '+u.slice(0,5).join(' | '));ok(/مقارنة/.test(await pg.innerText('#hstabs')),'Arabic: the tab name');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
