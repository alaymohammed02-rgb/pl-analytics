/* The club's stadium in 3D (assets/stadium3d.js): Real Madrid's page has the Bernabéu drawn on a canvas behind it; any other club and any other page have none.
   Checked against a second implementation: every panel lies between its two rings (an ellipse at a height) and faces the middle of the stadium (the roof's
   underside faces down); the pinhole projection of the page equals one written here; on the canvas, the pitch's centre is green and an LED panel facing the camera
   is blue in the frame that was drawn. Then: the readout is true (288 panels, the frame time and the frame rate), the camera drifts (and stands still with reduced
   motion), scrolling dips it by 0.04 units a pixel up to 40, the switch turns it off and on and is remembered, leaving the page removes it, the canvas never takes
   the pointer, Arabic and 390 px without a sideways scroll, no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_0ErfuF',RM='#/club/Real%20Madrid';
const wait=(pg,ms)=>pg.waitForTimeout(ms);
/* the second implementation of the camera and of the projection */
const SECOND=`(()=>{const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 return {cam(sp,W,H,turn,dip){const a=turn*Math.PI/180,R=p=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];
   const eye=R(sp.cam.eye),at=R([sp.cam.at[0],sp.cam.at[1],sp.cam.at[2]-dip]),f=nrm(sub(at,eye)),r=nrm(crs(f,[0,0,1])),u=crs(r,f);
   return {eye,f,r,u,F:Math.max(W*.44,H*.7),cx:W/2,cy:H*.44}},
  proj(c,p){const d=sub(p,c.eye),z=dot(d,c.f);return z>12?[c.cx+c.F*dot(d,c.r)/z,c.cy-c.F*dot(d,c.u)/z]:null}}})()`;
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:RM});
 await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await pg.waitForSelector('.st3-ctl',{timeout:30000});await wait(pg,2600);
 /* the element: behind the page, never in the way */
 const el=await pg.evaluate(()=>{const e=document.getElementById('st3-bg'),s=getComputedStyle(e),c=e.querySelector('canvas'),r=c.getBoundingClientRect();
  return {pos:s.position,z:s.zIndex,pe:s.pointerEvents,aria:e.getAttribute('aria-hidden'),w:r.width,h:r.height,cw:c.width,ch:c.height,dpr:Math.min(1.5,devicePixelRatio||1),iw:innerWidth,ih:innerHeight,on:document.documentElement.classList.contains('st3-on')}});
 ok(el.pos==='fixed'&&el.z==='-1'&&el.pe==='none'&&el.aria==='true'&&el.on,'Real Madrid: the stadium is fixed behind the page, hidden from screen readers and never takes the pointer');
 ok(Math.abs(el.w-el.iw)<1&&Math.abs(el.h-el.ih)<1&&el.cw===Math.round(el.iw*el.dpr)&&el.ch===Math.round(el.ih*el.dpr),'the canvas fills the window at up to 1.5 pixels a CSS pixel ('+el.cw+' x '+el.ch+')');
 /* the panels against the rings */
 const pn=await pg.evaluate(()=>{const S=INS.stadium3d,sp=S.SPEC['real madrid'],N=S.N,P=S.panels(sp),bad=[];
  for(const p of P){const g=sp.rings[p.ring],A=g[0],B=g[1],t0=p.i/N*2*Math.PI,t1=(p.i+1)/N*2*Math.PI;
   const want=[[A[0]*Math.cos(t0),A[1]*Math.sin(t0),A[2]],[A[0]*Math.cos(t1),A[1]*Math.sin(t1),A[2]],[B[0]*Math.cos(t1),B[1]*Math.sin(t1),B[2]],[B[0]*Math.cos(t0),B[1]*Math.sin(t0),B[2]]];
   const off=Math.max(...want.map((w,k)=>Math.hypot(w[0]-p.pts[k][0],w[1]-p.pts[k][1],w[2]-p.pts[k][2])));
   const c=want.reduce((s,w)=>[s[0]+w[0]/4,s[1]+w[1]/4,s[2]+w[2]/4],[0,0,0]);
   const faces=p.ring==='under'?p.n[2]<0:(-c[0]*p.n[0]-c[1]*p.n[1])>0;
   if(off>1e-6||!faces||Math.abs(Math.hypot(...p.n)-1)>1e-6)bad.push(p.ring+p.i)}
  const by={};P.forEach(p=>by[p.ring]=(by[p.ring]||0)+1);return {n:P.length,N,rings:Object.keys(sp.rings),by,bad}});
 ok(pn.n===pn.rings.length*pn.N&&pn.rings.every(r=>pn.by[r]===pn.N),'the model has '+pn.N+' panels in each of its '+pn.rings.length+' rings ('+pn.rings.join(', ')+'): '+pn.n);
 ok(pn.bad.length===0,'every panel lies between its two rings and faces the middle of the stadium, the roof\'s underside faces down ('+pn.bad.length+' wrong '+pn.bad.slice(0,4).join(' ')+')');
 /* the projection against the second implementation, at three angles and two dips */
 const pj=await pg.evaluate(SEC=>{const B=eval(SEC),S=INS.stadium3d,sp=S.SPEC['real madrid'];let worst=0,n=0;
  for(const [W,H,turn,dip] of [[1280,900,0,0],[390,900,-7,24],[1600,700,5,40]]){const a=S.camera(sp,W,H,turn,dip),c=B.cam(sp,W,H,turn,dip);
   for(let i=0;i<60;i++){const p=[(i*37%120-60)*4,(i*53%90-45)*4,(i*17%30)*5],x=S.project(a,p),y=B.proj(c,p);
    if(!x!==!y){worst=1e9;continue}if(x){n++;worst=Math.max(worst,Math.hypot(x[0]-y[0],x[1]-y[1]))}}}return {worst,n}},SECOND);
 ok(pj.n>100&&pj.worst<1e-6,'the camera and the projection equal a second implementation ('+pj.n+' points, largest difference '+pj.worst.toExponential(1)+' px)');
 /* the drawn frame: green where the pitch's centre is, blue on an LED panel that faces the camera */
 const px=await pg.evaluate(SEC=>{const B=eval(SEC),S=INS.stadium3d,st=S.state(),sp=st.sp,c=B.cam(sp,st.W,st.H,st.turn,st.dip),cv=st.cv,x=cv.getContext('2d');
  const at=p=>{const q=B.proj(c,p);if(!q)return null;const d=x.getImageData(Math.round(q[0]*st.dpr),Math.round(q[1]*st.dpr),1,1).data;return [d[0],d[1],d[2],q]};
  const g=at([60,40,0]);const led=S.panels(sp).filter(p=>p.ring==='led'&&Math.abs(p.c[0])<120&&p.c[1]<0).map(p=>at(p.c)).filter(Boolean);
  return {g,led,turn:st.turn}},SECOND);
 ok(px.g&&px.g[1]>px.g[0]+20&&px.g[1]>px.g[2]+10,'in the drawn frame the pitch near its centre is green (rgb '+(px.g||[]).slice(0,3).join(',')+')');
 ok(px.led.length>=2&&px.led.every(c=>c[2]>c[0]+80&&c[2]>150),'the LED ribbon across the pitch is bright blue ('+px.led.length+' panels, e.g. rgb '+(px.led[0]||[]).slice(0,3).join(',')+')');
 /* the readout */
 const rd=await pg.$eval('.st3-m',e=>e.textContent),st=await pg.evaluate(()=>{const s=INS.stadium3d.state();return {panels:s.panels,fps:s.fps,fm:s.frameMs}});
 const m=/a frame takes ([\d.]+) ms · (\d+) panels · (\d+) fps/.exec(rd);
 ok(m&&+m[2]===pn.n&&+m[2]===st.panels&&+m[3]===st.fps&&st.fps>0&&+m[1]<50,'the readout says how long a frame takes, how many panels and the frame rate, and they are real ('+rd+')');
 /* motion: it drifts */
 const tA=await pg.evaluate(()=>INS.stadium3d.state().turn);await wait(pg,700);const tB=await pg.evaluate(()=>INS.stadium3d.state().turn);
 ok(tA!==tB&&Math.abs(tA)<=7&&Math.abs(tB)<=7,'the camera drifts round the stands, within 7 degrees ('+tA.toFixed(2)+' then '+tB.toFixed(2)+')');
 /* scrolling dips it */
 await pg.evaluate(()=>scrollTo(0,600));await wait(pg,250);const d1=await pg.evaluate(()=>INS.stadium3d.state().dip);
 await pg.evaluate(()=>scrollTo(0,5000));await wait(pg,250);const d2=await pg.evaluate(()=>({d:INS.stadium3d.state().dip,y:scrollY}));
 ok(Math.abs(d1-24)<.01&&Math.abs(d2.d-Math.min(40,d2.y*.04))<.01,'scrolling dips the camera 0.04 units a pixel, at most 40 ('+d1+', '+d2.d+' at '+d2.y+' px)');
 await pg.evaluate(()=>scrollTo(0,0));
 /* the page content is unchanged above it: the club's header and the line under it */
 const ctl=await pg.evaluate(()=>{const c=document.querySelector('.st3-ctl');return {after:c.previousElementSibling&&c.previousElementSibling.classList.contains('clubhd'),t:c.innerText,p:c.querySelector('.st3-sw').getAttribute('aria-pressed')}});
 ok(ctl.after&&/Santiago Bernabéu in 3D, a simple model \(a concept, not the exact stadium\)/.test(ctl.t)&&ctl.p==='true','the line under the header says what it is (a concept, not the exact stadium) with the switch pressed');
 /* the switch */
 await pg.click('.st3-sw');await wait(pg,150);
 ok(!(await pg.$('#st3-bg'))&&await pg.evaluate(()=>localStorage.getItem('plx_st3d'))==='0'&&await pg.$eval('.st3-sw',e=>e.getAttribute('aria-pressed'))==='false'&&!(await pg.evaluate(()=>document.documentElement.classList.contains('st3-on'))),'Turn off removes the stadium and remembers it');
 await pg.reload();await pg.waitForSelector('.st3-ctl',{timeout:90000});await wait(pg,400);
 ok(!(await pg.$('#st3-bg'))&&/Turn on/.test(await pg.$eval('.st3-sw',e=>e.textContent)),'after a reload it stays off and the switch offers Turn on');
 await pg.click('.st3-sw');await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:10000});
 ok(await pg.evaluate(()=>localStorage.getItem('plx_st3d'))==='1','Turn on brings it back and remembers it');
 /* leaving the page, another club */
 await pg.evaluate(()=>{location.hash='#/table'});await wait(pg,800);
 ok(!(await pg.$('#st3-bg'))&&!(await pg.evaluate(()=>INS.stadium3d.state())),'leaving the club page removes the stadium and stops its drawing');
 await pg.evaluate(()=>{location.hash='#/club/Barcelona'});await pg.waitForSelector('.clubhd',{timeout:60000});await wait(pg,600);
 ok(!(await pg.$('#st3-bg'))&&!(await pg.$('.st3-ctl')),'another club\'s page has no stadium and no line about it');
 await pg.evaluate(o=>{location.hash=o},RM);await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:60000});
 ok(await pg.$$eval('#st3-bg',a=>a.length)===1&&await pg.$$eval('.st3-ctl',a=>a.length)===1,'back on Real Madrid: one stadium and one line');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* reduced motion: drawn once, no drift */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:''}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.goto(pg.url().split('#')[0]+RM);
 await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await wait(pg,1200);
 const rm=await pg.evaluate(()=>{const s=INS.stadium3d.state();return {t:s.turn,still:s.still,fps:s.fps,fm:s.frameMs}});
 ok(rm.still&&rm.t===0&&rm.fps==null&&rm.fm>0,'reduced motion: drawn once, the camera does not drift');
 await pg.evaluate(()=>scrollTo(0,500));await wait(pg,200);ok(Math.abs(await pg.evaluate(()=>INS.stadium3d.state().dip)-20)<.01,'reduced motion: scrolling still redraws with the dip');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the photo mode: when the club has a photograph (here one drawn by the test), it replaces the model, credited, panned by CSS, shifted by scrolling */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:RM}));await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await wait(pg,500);
 const ph=await pg.evaluate(async()=>{const S=INS.stadium3d,sp=S.SPEC['real madrid'],c=document.createElement('canvas');c.width=2048;c.height=512;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,2048,0);g.addColorStop(0,'#223');g.addColorStop(1,'#a63');x.fillStyle=g;x.fillRect(0,0,2048,512);
  sp.photo=c.toDataURL('image/png');sp.credit={by:'A. Photographer',license:'CC BY 4.0',url:'https://example.org/photo',title:'the photo page'};
  S.unmount();S.mount('Real Madrid');S.control(document,'Real Madrid');await new Promise(r=>setTimeout(r,1200));
  const e=document.getElementById('st3-bg'),i=e.querySelector('img'),st=S.state();
  return {mode:st.mode,canvas:!!e.querySelector('canvas'),cls:e.className,w:i.naturalWidth,h:i.naturalHeight,op:getComputedStyle(i).opacity,anim:getComputedStyle(i).animationName,pe:getComputedStyle(e).pointerEvents,aria:e.getAttribute('aria-hidden'),
   line:document.querySelector('.st3-ctl').innerText,href:(document.querySelector('.st3-ctl a')||{}).href,rd:document.querySelector('.st3-m').textContent}});
 ok(ph.mode==='photo'&&!ph.canvas&&/st3-ph-ok/.test(ph.cls)&&ph.w===2048&&ph.h===512&&ph.op==='1','photo mode: the photograph replaces the model and shows once loaded');
 ok(ph.anim==='st3-pan'&&ph.pe==='none'&&ph.aria==='true','the photograph is panned by a CSS animation, behind the page, never taking the pointer');
 ok(/photograph of Santiago Bernabéu by A\. Photographer \(CC BY 4\.0\)/.test(ph.line)&&ph.href==='https://example.org/photo','the line under the header credits the author and the licence and links the source');
 ok(/photo 2048 × 512/.test(ph.rd),'the readout gives the real size of the photograph ('+ph.rd+')');
 await pg.evaluate(()=>scrollTo(0,500));await wait(pg,200);
 ok(await pg.evaluate(()=>{const e=document.getElementById('st3-bg');return e.style.getPropertyValue('--dy')==='20.0px'&&getComputedStyle(e.querySelector('.st3-ph')).transform!=='none'}),'scrolling 500 px shifts the photograph 20 px (0.04 a pixel)');
 await pg.evaluate(()=>{INS.stadium3d.SPEC['real madrid'].photo='data:image/png;base64,AAAA';INS.stadium3d.unmount();INS.stadium3d.mount('Real Madrid')});await wait(pg,800);
 ok(await pg.evaluate(()=>{const s=INS.stadium3d.state();return s&&s.mode==='model'&&!!document.querySelector('#st3-bg canvas')&&!document.querySelector('#st3-bg img')}),'a photograph that does not load: the drawn model takes its place');
 await pg.emulateMedia({reducedMotion:'reduce'});await pg.evaluate(()=>{const sp=INS.stadium3d.SPEC['real madrid'];const c=document.createElement('canvas');c.width=64;c.height=16;sp.photo=c.toDataURL();INS.stadium3d.unmount();INS.stadium3d.mount('Real Madrid')});await wait(pg,600);
 ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('#st3-bg img')).animationName==='none'),'reduced motion: the photograph stands still');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic on a phone */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:LG,hash:RM}));await pg.waitForSelector('.st3-ctl',{timeout:120000});await pg.waitForSelector('#st3-bg canvas',{state:'attached'});await wait(pg,2600);
 const art=await pg.$eval('.st3-ctl',e=>e.innerText);
 ok(/برنابيو بثلاثة أبعاد/.test(art)&&/أوقفه/.test(art)&&/الإطار يُرسم في/.test(art)&&/لوح/.test(art),'Arabic: the line, the switch and the readout are in Arabic');
 ok(await T.noscroll(pg),'Arabic phone: no horizontal scroll');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/st3d_390_ar.png'});await ctx.close();
 await T.done(b)})();
