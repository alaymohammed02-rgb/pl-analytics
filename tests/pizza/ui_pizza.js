/* Player card, "Pizza" chart (assets/defense-card.js, the Chart choice): the same card with the measures as slices of a circle, each as long as the player's
   percentile and coloured as the bars are. Checked: one slice per chosen measure, in order; the percentile and the value of every slice equal the bars' (the same
   card drawn as bars, read back); the slice's radius, start and end angle recomputed from the percentile (equal slices from the top, clockwise; mirrored and counter-
   clockwise in Arabic); its colour is red to amber to green by percentile; the middle number is the average percentile of the header; the labels never overlap each
   other and stay inside the card for 3, 6 and 8 measures in English and Arabic; the card is taller by the difference of the two layouts; the choice is kept after a
   reload; "Save image" gives a PNG; 390 px, no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_4WFCIZ',R=262,BW=1080-140-84,GAP=.014;
const pcol=p=>{const S=[[0,[214,69,65]],[50,[232,160,40]],[100,[63,163,77]]];for(let i=1;i<S.length;i++)if(p<=S[i][0]){const [a,c]=S[i-1],[b,d]=S[i],t=(p-a)/(b-a);return 'rgb('+c.map((v,k)=>Math.round(v+(d[k]-v)*t)).join(',')+')'}return 'rgb(63,163,77)'};
const SET={three:['gl','npxg','sh'],six:['gl','npxg','sh','sot','xag','sca'],eight:['gl','npxg','xg','sh','sot','xag','sca','gca']};
const read=(pg)=>pg.evaluate(()=>{const svg=document.querySelector('.dcx-c svg'),vb=svg.viewBox.baseVal;
 const W=vb.width,H=vb.height,wedges=[...svg.querySelectorAll('.dc-pz')].map(p=>({k:p.dataset.k,p:+p.dataset.p,r:+p.dataset.r,d:p.getAttribute('d'),fill:p.getAttribute('fill')}));
 const nums=[...svg.querySelectorAll('.dc-pn')].map(t=>t.textContent),vals=[...svg.querySelectorAll('.dc-pv')].map(t=>t.textContent),pa=(svg.querySelector('.dc-pa')||{}).textContent;
 const labels=[...svg.querySelectorAll('.dc-pl')].map(t=>{const b=t.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height,t:t.textContent}});
 const ring=[...svg.querySelectorAll('text')].find(t=>t.getAttribute('font-size')==='50');
 const on=[...svg.querySelectorAll('.dc-on')].map(r=>+r.getAttribute('width'));
 const bv=[...svg.querySelectorAll('tspan[font-weight="800"]')].map(t=>t.textContent);
 return {W,H,wedges,nums,vals,pa,labels,ring:ring&&ring.textContent,on,bv,mets:[...document.querySelectorAll('.dcx-mt input:checked')].map(i=>i.value)}});
const geo=(w,i,N,A)=>{const m=/^M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) A([\d.]+) ([\d.]+) 0 0 (\d) ([\d.]+) ([\d.]+) Z$/.exec(w.d);if(!m)return null;const [cx,cy,x0,y0,r1,r2,sw,x1,y1]=m.slice(1).map(Number);
 const ang=(x,y)=>Math.atan2(y-cy,A?-(x-cx):x-cx),a0=-Math.PI/2+i*2*Math.PI/N,a1=-Math.PI/2+(i+1)*2*Math.PI/N,d=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
 return {r:r1,sweep:sw,okA:d(ang(x0,y0),a0+GAP)<.004&&d(ang(x1,y1),a1-GAP)<.004,rr:Math.hypot(x0-cx,y0-cy),eq:r1===r2,cx,cy}};
/* two lines of different labels must not share space; the lines of one label sit 30 apart and may touch by their line heights */
const overlap=(a,b)=>a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>9;
async function card(b,{lang='en',vw=700,mets,style='pizza',hash='#/shots',fam='att'}={}){
 const init={plx_dc_v1:JSON.stringify({style,min:450,grp:'role',scope:'lg',mets:{[fam]:mets}})};
 const o=await T.open(b,{vw,lang,league:LG,hash,init});await o.pg.waitForSelector('.dcx-c svg',{timeout:90000});await o.pg.waitForTimeout(1500);return o}
(async()=>{const b=await T.launch();
 for(const lang of ['en','ar']){const A=lang==='ar';
  for(const [nm,mets] of Object.entries(SET)){const {ctx,pg,errs}=await card(b,{lang,mets});const P=await read(pg),N=mets.length;
   ok(P.wedges.length===N&&JSON.stringify(P.mets)===JSON.stringify(mets)&&P.wedges.map(w=>w.k).join()===mets.join(),lang+', '+nm+' ('+N+'): one slice per chosen measure, in order ('+P.wedges.map(w=>w.k+' '+w.p).join(', ')+')');
   const G=P.wedges.map((w,i)=>geo(w,i,N,A));
   ok(G.every(g=>g)&&G.every((g,i)=>Math.abs(g.r-Math.max(R*.06,R*P.wedges[i].p/100))<.15&&Math.abs(g.rr-g.r)<.3&&g.eq&&Math.abs(P.wedges[i].r-g.r)<.15),lang+', '+nm+': every slice is as long as its percentile (radius = '+R+' × p ÷ 100)');
   ok(G.every(g=>g.okA&&g.sweep==(A?'0':'1')),lang+', '+nm+': equal slices from the top, '+(A?'counter-clockwise (mirrored)':'clockwise')+', each with its small gap');
   ok(P.wedges.every(w=>w.fill===pcol(w.p)),lang+', '+nm+': every slice has the colour of its percentile');
   ok(P.nums.join()===P.wedges.map(w=>String(w.p)).join(),lang+', '+nm+': the number on each slice is its percentile');
   ok(P.wedges.length>0&&Math.abs(G[0].cx-540)<.1,lang+', '+nm+': the circle is centred on the card');
   /* the labels */
   const L=P.labels,bad=[];for(let i=0;i<L.length;i++){for(let j=i+1;j<L.length;j++)if(overlap(L[i],L[j]))bad.push(L[i].t+' / '+L[j].t);if(L[i].x<20||L[i].x+L[i].w>P.W-20)bad.push('outside: '+L[i].t)}
   ok(!bad.length&&L.length>=2*N,lang+', '+nm+': '+L.length+' label lines, none overlapping, none outside the card '+bad.slice(0,2).join(' | '));
   /* against the bars */
   const mid=P.pa,hv=P.vals.map(v=>v.replace(/ \/90$/,'')),H1=P.H;await pg.selectOption('#dcxy','bars');await pg.waitForTimeout(900);const Bz=await read(pg);
   const bp=Bz.on.map(w=>Math.round(w/BW*100)),pp=P.wedges.filter(w=>w.p>=2).map(w=>w.p);
   ok(Bz.on.length===N&&Bz.on.every((w,i)=>Math.abs(Math.round(w/BW*100)-P.wedges[i].p)<=1||P.wedges[i].p<2)&&JSON.stringify(Bz.bv)===JSON.stringify(hv),lang+', '+nm+': the same card drawn as bars gives the same percentile and value for every measure ('+hv.join(', ')+')');
   ok(String(mid)===String(Bz.ring),lang+', '+nm+': the middle number is the average percentile of the header ('+mid+')');
   ok(Math.abs((H1-Bz.H)-(840-N*100))<.5,lang+', '+nm+': the pizza card is '+(840-N*100)+' units taller than the bars card ('+H1+' against '+Bz.H+')');
   ok(!errs.length,lang+', '+nm+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}}
 /* kept after a reload, PNG, phone */
 {const {ctx,pg,errs}=await card(b,{mets:SET.six,style:'bars'});await pg.selectOption('#dcxy','pizza');await pg.waitForSelector('.dc-pz',{timeout:30000});await pg.reload();await pg.waitForSelector('.dcx-c svg',{timeout:90000});await pg.waitForTimeout(1200);
  ok(await pg.$eval('#dcxy',e=>e.value)==='pizza'&&await pg.$$eval('.dc-pz',a=>a.length)===6,'the choice of Pizza is kept after a reload');
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('.dcx-s')]);const fn=dl.suggestedFilename(),path=await dl.path(),sz=require('fs').statSync(path).size;
  ok(/^attacking-card-.*\.png$/.test(fn)&&sz>20000,'Save image gives a PNG of the pizza card ('+fn+', '+Math.round(sz/1024)+' KB)');
  const buf=require('fs').readFileSync(path);ok(buf.slice(1,4).toString()==='PNG'&&buf.readUInt32BE(16)===1080,'the PNG is 1080 px wide');
  await pg.selectOption('#dcxy','bars');await pg.waitForTimeout(700);ok(await pg.$$eval('.dc-pz',a=>a.length)===0&&await pg.$$eval('.dc-on',a=>a.length)>0,'back to Bars: the slices are gone, the bars are back');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 for(const [hash,fam,mets] of [['#/defense','def',['da','tk','ic','duw','aerw','bc']],['#/passing','mid',['ps','pr','kp','bx','xgb','sca']]]){
  const {ctx,pg,errs}=await card(b,{hash,fam,mets,vw:390});const P=await read(pg);ok(P.wedges.length===6&&await T.noscroll(pg),hash+' at 390 px: six slices, no horizontal scroll');
  ok(!errs.length,hash+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
