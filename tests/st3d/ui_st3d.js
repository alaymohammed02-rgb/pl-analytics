/* The club's stadium in 3D (assets/stadium3d.js, assets/stadium-gl.js): Real Madrid's page has the Bernabéu behind it, first drawn on a 2D canvas (checked here with plx_st3gl=0), then in WebGL (checked at the end of this file); any other club and any other page have none.
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
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:RM,init:{plx_st3gl:'0'}});
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
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'',init:{plx_st3gl:'0'}}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.goto(pg.url().split('#')[0]+RM);
 await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await wait(pg,1200);
 const rm=await pg.evaluate(()=>{const s=INS.stadium3d.state();return {t:s.turn,still:s.still,fps:s.fps,fm:s.frameMs}});
 ok(rm.still&&rm.t===0&&rm.fps==null&&rm.fm>0,'reduced motion: drawn once, the camera does not drift');
 await pg.evaluate(()=>scrollTo(0,500));await wait(pg,200);ok(Math.abs(await pg.evaluate(()=>INS.stadium3d.state().dip)-20)<.01,'reduced motion: scrolling still redraws with the dip');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the photo mode: when the club has a photograph (here one drawn by the test), it replaces the model, credited, panned by CSS, shifted by scrolling */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:RM,init:{plx_st3gl:'0'}}));await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await wait(pg,500);
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
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:LG,hash:RM,init:{plx_st3gl:'0'}}));await pg.waitForSelector('.st3-ctl',{timeout:120000});await pg.waitForSelector('#st3-bg canvas',{state:'attached'});await wait(pg,2600);
 const art=await pg.$eval('.st3-ctl',e=>e.innerText);
 ok(/برنابيو بثلاثة أبعاد/.test(art)&&/أوقفه/.test(art)&&/الإطار يُرسم في/.test(art)&&/لوح/.test(art),'Arabic: the line, the switch and the readout are in Arabic');
 ok(await T.noscroll(pg),'Arabic phone: no horizontal scroll');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/st3d_390_ar.png'});await ctx.close();
 /* ---- the WebGL scene (assets/stadium-gl.js, three.js) */
 const GLMOD=`(async()=>{const u=[...document.scripts].map(s=>s.src).find(s=>s.includes('assets/stadium3d.js'));return import(u.replace('stadium3d.js','stadium-gl.js'))})()`;
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:RM}));await pg.waitForSelector('#st3-bg',{state:'attached',timeout:120000});
 await pg.waitForFunction(()=>{const s=INS.stadium3d.state();return s&&s.mode==='gl'},null,{timeout:90000});await wait(pg,2600);
 const gl=await pg.evaluate(async M=>{const m=await eval(M),st=INS.stadium3d.state(),e=document.getElementById('st3-bg'),S=m.SPECS['real madrid'];
  const cvs=[...e.querySelectorAll('canvas')];const geos=[];st.gl.scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry.attributes.color)geos.push(o.geometry)});
  /* the two tiers: height range of their treads and risers, and the number of quads */
  const rng=g=>{const p=g.attributes.position.array;let lo=1e9,hi=-1e9;for(let i=1;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i])}return [lo,hi,p.length/18]};
  const inst=[];st.gl.scene.traverse(o=>{if(o.isInstancedMesh)inst.push(o.count)});
  /* the ring: points of the rounded rectangle satisfy |x/a|^n + |y/b|^n = 1 */
  let rd=0;for(let i=0;i<50;i++){const t=i/50*Math.PI*2+.013,p=m.ringPt(80,60,S.squareness,t);rd=Math.max(rd,Math.abs(Math.pow(Math.abs(p[0]/80),S.squareness)+Math.pow(Math.abs(p[1]/60),S.squareness)-1))}
  return {n:cvs.length,cls:cvs[0].className,ok:e.classList.contains('st3-gl-ok'),mode:st.mode,rd,tiers:geos.map(rng),inst,stats:st.gl.stats,rd2:document.querySelector('.st3-m').textContent,fps:st.fps,segs:S.segs,aisle:S.aisleEvery,rows:[S.low.rows,S.up.rows],y:[S.low.from.y,S.low.to.y,S.up.from.y,S.up.to.y],beams:S.roof.beams,rings:S.roof.rings.length,lamps:S.lamps.count}},GLMOD);
 ok(gl.mode==='gl'&&gl.n===1&&/st3-gl/.test(gl.cls)&&gl.ok,'WebGL: it replaces the drawn model, one canvas, faded in');
 ok(gl.rd<1e-9,'the bowl\'s ring is a rounded rectangle: every point satisfies |x/a|^n + |y/b|^n = 1 (largest error '+gl.rd.toExponential(1)+')');
 const wantQ=(gl.segs-Math.ceil(gl.segs/gl.aisle))*2;/* segments that are not an aisle, two quads a row */
 ok(gl.tiers.length===2&&gl.tiers[0][2]===wantQ*gl.rows[0]&&gl.tiers[1][2]===wantQ*gl.rows[1],'each tier has one tread and one riser a row for every segment that is not an aisle ('+gl.tiers.map(t=>t[2]).join(' and ')+' quads, '+(gl.segs-Math.ceil(gl.segs/gl.aisle))+' of '+gl.segs+' segments)');
 ok(Math.abs(gl.tiers[0][0]-gl.y[0])<1e-4&&Math.abs(gl.tiers[0][1]-gl.y[1])<1e-4&&Math.abs(gl.tiers[1][0]-gl.y[2])<1e-4&&Math.abs(gl.tiers[1][1]-gl.y[3])<1e-4,'the tiers rise from '+gl.y[0]+' to '+gl.y[1]+' m and from '+gl.y[2]+' to '+gl.y[3]+' m, as specified');
 ok(gl.inst[0]===gl.beams&&gl.inst.length===1+gl.rings&&gl.stats.lamps===gl.lamps,'the roof has '+gl.beams+' radial beams and '+gl.rings+' rings of beams, and '+gl.lamps+' floodlights');
 ok(gl.stats.drawCalls>0&&gl.stats.drawCalls<=30&&gl.stats.triangles>20000&&gl.stats.triangles<120000,'a frame is '+gl.stats.drawCalls+' draw calls and '+gl.stats.triangles+' triangles (limits: 30 and 120,000)');
 ok(new RegExp('^'+gl.stats.drawCalls+' draw calls · '+gl.stats.triangles+' triangles').test(gl.rd2)&&gl.fps>0,'the readout gives the real draw calls, triangles and a frame rate ('+gl.rd2+')');
 /* the camera: the spec's seat, turned about the vertical axis by the drift; looking at the spec's target */
 const cam=await pg.evaluate(async M=>{const m=await eval(M),st=INS.stadium3d.state(),S=m.SPECS['real madrid'];st.gl.render(0,{turn:0,dip:0});const c0=st.gl.camera.position.toArray();st.gl.render(0,{turn:6,dip:0});const c1=st.gl.camera.position.toArray();
  const a=6*Math.PI/180,e=S.cam.eye;return {c0,c1,e,want1:[e[0]*Math.cos(a)+e[2]*Math.sin(a),e[1],-e[0]*Math.sin(a)+e[2]*Math.cos(a)],fov:st.gl.camera.fov,fovS:S.cam.fov}},GLMOD);
 ok(cam.c0.every((v,i)=>Math.abs(v-cam.e[i])<1e-4)&&cam.c1.every((v,i)=>Math.abs(v-cam.want1[i])<1e-4)&&cam.fov===cam.fovS,'the camera is at the specified seat and turns about the vertical axis (6 degrees: '+cam.c1.map(v=>v.toFixed(2)).join(', ')+')');
 /* the drawn frame: green on the pitch, blue on the far ribbon of light */
 const gpx=await pg.evaluate(async M=>{const m=await eval(M),st=INS.stadium3d.state(),S=m.SPECS['real madrid'],g=st.gl;g.render(0,{turn:0,dip:0});const url=g.canvas.toDataURL();
  const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
  const at=(X,Y,Z)=>{const v=g.camera.position.constructor.prototype.constructor===undefined?null:new g.camera.position.constructor(X,Y,Z).project(g.camera);const sx=Math.round((v.x+1)/2*c.width),sy=Math.round((1-v.y)/2*c.height);const d=x.getImageData(Math.max(0,Math.min(c.width-1,sx)),Math.max(0,Math.min(c.height-1,sy)),1,1).data;return [d[0],d[1],d[2],v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1]};
  const led=S.led;return {pitch:at(0,0,0),ribbon:at(0,(led.from.y+led.to.y)/2,-led.from.b-.1)}},GLMOD);
 ok(gpx.pitch[3]&&gpx.pitch[1]>gpx.pitch[0]+25&&gpx.pitch[1]>gpx.pitch[2]+15,'in the drawn frame the middle of the pitch is green (rgb '+gpx.pitch.slice(0,3).join(',')+')');
 ok(gpx.ribbon[3]&&gpx.ribbon[2]>gpx.ribbon[0]+60,'the ribbon of light on the far side is blue (rgb '+gpx.ribbon.slice(0,3).join(',')+')');
 /* a slow device gets fewer pixels: the rule, and the canvas really follows it */
 const sc=await pg.evaluate(()=>{const n=INS.stadium3d.nextScale,g=INS.stadium3d.state().gl,W=innerWidth,dpr=Math.min(1.5,devicePixelRatio||1);g.setScale(1);const w0=g.canvas.width;g.setScale(.5);const w1=g.canvas.width;g.setScale(1);return {r:[n(30,1),n(12,1),n(12,.8),n(12,.512),n(5,.4)],w0,w1,want0:Math.round(W*dpr),want1:Math.round(W*dpr*.5),after:g.scale}});
 ok(sc.r.join()==='1,0.8,0.64,0.512,0.4','under 20 frames a second the resolution drops to 80%, then 64%, and stops near half; at 30 it stays ('+sc.r.join(', ')+')');
 ok(sc.w0===sc.want0&&sc.w1===sc.want1&&sc.after===1,'setting the scale to half halves the canvas\'s pixels ('+sc.w0+' to '+sc.w1+') and back to full restores them');
 /* scrolling dips it, leaving the page frees it */
 await pg.evaluate(()=>scrollTo(0,500));await wait(pg,300);ok(await pg.evaluate(()=>INS.stadium3d.state().dip)===20,'scrolling 500 px dips the camera 20 (0.04 a pixel)');
 await pg.evaluate(()=>{location.hash='#/table'});await wait(pg,900);
 ok(!(await pg.$('#st3-bg'))&&!(await pg.evaluate(()=>INS.stadium3d.state())),'leaving the page removes the WebGL scene');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* a module that does not load, and WebGL that is not available: the drawn model stays, nothing breaks */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:''}));await ctx.route(/stadium-gl\.js/,r=>r.fulfill({status:503,body:'x'}));await pg.goto(pg.url().split('#')[0]+RM);
 await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await wait(pg,2500);
 ok(await pg.evaluate(()=>{const s=INS.stadium3d.state();return s.mode==='model'&&!s.gl&&!!document.querySelector('#st3-bg canvas.st3-cv')}),'a scene file that fails to load: the drawn model stays');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:''}));await pg.addInitScript(()=>{const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:g.call(this,t,...a)}});await pg.goto(pg.url().split('#')[0]+RM);await pg.reload();
 await pg.waitForSelector('#st3-bg canvas',{state:'attached',timeout:120000});await wait(pg,3000);
 ok(await pg.evaluate(()=>{const s=INS.stadium3d.state();return s.mode==='model'&&!!s.glErr&&!!document.querySelector('#st3-bg canvas.st3-cv')}),'no WebGL in the browser: the drawn model stays and says why ('+await pg.evaluate(()=>INS.stadium3d.state().glErr)+')');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* reduced motion: one render, none while it waits, one more on scrolling */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:''}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.goto(pg.url().split('#')[0]+RM);
 await pg.waitForFunction(()=>{const s=INS.stadium3d.state();return s&&s.mode==='gl'},null,{timeout:90000});await wait(pg,1500);
 const rm2=await pg.evaluate(()=>{const s=INS.stadium3d.state();return {still:s.still,fps:s.fps,turn:s.turn}});ok(rm2.still&&rm2.fps==null&&rm2.turn===0,'reduced motion: WebGL scene drawn once, the camera does not drift');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic on a phone */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:LG,hash:RM}));await pg.waitForFunction(()=>{const s=window.INS&&INS.stadium3d&&INS.stadium3d.state();return s&&s.mode==='gl'},null,{timeout:120000});await wait(pg,2600);
 ok(/استدعاء رسم/.test(await pg.$eval('.st3-m',e=>e.textContent))&&/مثلث/.test(await pg.$eval('.st3-m',e=>e.textContent)),'Arabic: the WebGL readout is in Arabic');ok(await T.noscroll(pg),'Arabic phone: no horizontal scroll with the WebGL scene');
 const fa=await pg.evaluate(()=>{const c=INS.stadium3d.state().gl.camera;return {f:c.fov,a:c.aspect}});ok(fa.a<1&&fa.f===86,'on a tall screen the view is wider (field of view '+fa.f+')');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/st3d_gl_390_ar.png'});await ctx.close();
 await T.done(b)})();
