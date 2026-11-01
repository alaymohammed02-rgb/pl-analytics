/* ===== The club's stadium in 3D behind its page (concept; owner asked 1 Nov 2026, Real Madrid first, with a photo of the inside of the Bernabéu) =====
   The view from a seat high in the near stand at night: the lit pitch (105 x 68 m) with its lines, two tiers of seats facing it, the blue LED ribbon between the
   tiers, the dark underside of the roof and the ring of lights on the edge of its opening, the night sky through it. It is a simple model in the spirit of the real
   stadium, not a survey of it, and the line under the club's header says so.
   How it is built: no library and no WebGL. The stadium is a list of flat panels in metres-times-3.4 world units (x along the pitch, y across it, z up), each
   panel cut between two rings (an ellipse at a height). Every frame the panels are projected through a pinhole camera, cut at a near plane, turned-away panels
   are skipped and the rest are painted far to near on one <canvas>, each shaded by how it faces a light above the pitch and dimmed with distance.
   (A first version placed each panel as an element in a CSS 3D scene: in a software-rendered browser one frame of it took about a minute, because large clipped
   planes close to the camera are expensive to raster. The canvas draws the same panels in a few milliseconds.)
   Motion: the camera drifts slowly round the stands (about 30 frames a second, only while the page is visible) and scrolling tilts it down a little; with reduced
   motion it is drawn once and stands still. Measuring it: the line under the header prints how long a frame takes, how many panels it has and the frame rate.
   The choice is kept in plx_st3d (on by default). INS.stadium3d = {SPEC, mount(club), unmount(), on(), state(), panels(spec), camera(...), project(...)} for tests. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const on=()=>{try{return localStorage.getItem('plx_st3d')!=='0'}catch(e){return true}};
 const setOn=v=>{try{localStorage.setItem('plx_st3d',v?'1':'0')}catch(e){}};
 /* the model: rings [a along the pitch, b across it, height], 3.4 units a metre on the pitch */
 const N=48,M=3.4;
 const SPEC={
  'real madrid':{name:'Santiago Bernabéu',ar:'سانتياغو برنابيو',seat:'#2c4a86',seat2:'#d9dee8',roof:'#151a22',led:'#2f7bff',
   rings:{
    low:[[205,150,6],[292,218,66],14],        /* lower tier: from the pitch side up and out, 14 rows */
    led:[[294,220,68],[296,221,80]],          /* the blue LED ribbon between the tiers */
    up:[[300,225,82],[382,288,146],16],       /* upper tier */
    wall:[[382,288,146],[394,302,176]],       /* the back wall up to the roof */
    under:[[394,302,176],[250,180,158]],      /* the roof seen from inside, in to the opening */
    rim:[[250,180,158],[246,177,153]]         /* the lights on the edge of the opening */
   },
   cam:{eye:[0,262,116],at:[0,-60,46],orbit:7}}
 };
 const KEY=n=>String(n||'').toLowerCase().trim();
 const E=(r,t)=>[r[0]*Math.cos(t),r[1]*Math.sin(t),r[2]];
 const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=v=>Math.hypot(v[0],v[1],v[2]),unit=v=>{const l=len(v)||1;return v.map(x=>x/l)};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
 /* every panel of a stadium: {ring, i, pts:[a0,a1,b1,b0], n (the normal, pointing to where it is seen from), rows} */
 function panels(sp){
  const out=[];
  for(const name of Object.keys(sp.rings)){const g=sp.rings[name],A=g[0],B=g[1];
   for(let i=0;i<N;i++){const t0=i/N*2*Math.PI,t1=(i+1)/N*2*Math.PI,a0=E(A,t0),a1=E(A,t1),b0=E(B,t0),b1=E(B,t1);
    const c=lerp(lerp(a0,a1,.5),lerp(b0,b1,.5),.5);let n=unit(cross(sub(a1,a0),sub(b0,a0)));
    /* seen from the middle of the stadium: the normal points towards the axis (or down, for the roof's underside) */
    const toAxis=[-c[0],-c[1],0];if(name==='under'?n[2]>0:dot(n,toAxis)<0)n=n.map(x=>-x);
    out.push({ring:name,i,pts:[a0,a1,b1,b0],n,c,rows:g[2]||0})}}
  return out;
 }
 /* the camera: eye and target turned round the vertical axis by `turn` degrees, the target lowered by `dip` units */
 function camera(sp,W,H,turn,dip){
  const a=(turn||0)*Math.PI/180,rot=p=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];
  const eye=rot(sp.cam.eye),at=rot([sp.cam.at[0],sp.cam.at[1],sp.cam.at[2]-(dip||0)]);
  const f=unit(sub(at,eye)),r=unit(cross(f,[0,0,1])),u=cross(r,f);
  /* the focal length keeps the whole width of the stands in a wide window and the pitch in a tall one */
  const F=Math.max(W*.44,H*.7);
  return {eye,f,r,u,F,cx:W/2,cy:H*.44,W,H};
 }
 const NEAR=12;
 const toCam=(c,p)=>{const d=sub(p,c.eye);return [dot(d,c.r),dot(d,c.u),dot(d,c.f)]};
 const proj=(c,q)=>[c.cx+c.F*q[0]/q[2],c.cy-c.F*q[1]/q[2]];
 const project=(c,p)=>{const q=toCam(c,p);return q[2]>NEAR?proj(c,q):null};
 /* a polygon cut at the near plane (Sutherland-Hodgman against z = NEAR), then projected */
 function clip(c,pts){
  const q=pts.map(p=>toCam(c,p)),o=[];
  for(let i=0;i<q.length;i++){const A=q[i],B=q[(i+1)%q.length],ia=A[2]>NEAR,ib=B[2]>NEAR;
   if(ia)o.push(A);if(ia!==ib){const t=(NEAR-A[2])/(B[2]-A[2]);o.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,NEAR])}}
  return o.length>=3?{s:o.map(x=>proj(c,x)),z:o.reduce((s,x)=>s+x[2],0)/o.length}:null;
 }
 const rgb=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
 const css=(c,k,a)=>`rgba(${c.map(x=>Math.max(0,Math.min(255,Math.round(x*k)))).join(',')},${a==null?1:a})`;
 const LIGHT=unit([0,0,1]);
 const path=(ctx,s)=>{ctx.beginPath();ctx.moveTo(s[0][0],s[0][1]);for(let i=1;i<s.length;i++)ctx.lineTo(s[i][0],s[i][1]);ctx.closePath()};
 /* one frame */
 function draw(ctx,sp,P,c,dpr){
  const W=c.W,H=c.H;ctx.setTransform(dpr,0,0,dpr,0,0);
  /* the night sky (seen through the opening) and the dark of the stadium */
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#05080e');sky.addColorStop(.45,'#0b1422');sky.addColorStop(1,'#08110f');
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  /* the ground: the grass round the pitch, the pitch in mown bands, its lines */
  const PL=105*M/2,PW=68*M/2,g=[];
  const fill=(pts,col)=>{const s=clip(c,pts);if(s){path(ctx,s.s);ctx.fillStyle=col;ctx.fill()}};
  const ap=[];for(let i=0;i<64;i++){const t=i/64*2*Math.PI;ap.push([205*Math.cos(t),150*Math.sin(t),0])}
  fill(ap,'#123222');
  for(let k=0;k<12;k++){const x0=-PL+k*2*PL/12,x1=x0+2*PL/12;fill([[x0,-PW,0],[x1,-PW,0],[x1,PW,0],[x0,PW,0]],k%2?'#2f8a55':'#277a49')}
  ctx.strokeStyle='rgba(240,248,240,.82)';ctx.lineWidth=Math.max(1,W/900);
  const line=pts=>{const s=pts.map(p=>project(c,p));if(s.some(x=>!x))return;ctx.beginPath();ctx.moveTo(s[0][0],s[0][1]);for(let i=1;i<s.length;i++)ctx.lineTo(s[i][0],s[i][1]);ctx.stroke()};
  const box=(x0,y0,x1,y1)=>line([[x0,y0,0],[x1,y0,0],[x1,y1,0],[x0,y1,0],[x0,y0,0]]);
  box(-PL,-PW,PL,PW);line([[0,-PW,0],[0,PW,0]]);
  const circ=[];for(let i=0;i<=40;i++){const t=i/40*2*Math.PI;circ.push([9.15*M*Math.cos(t),9.15*M*Math.sin(t),0])}line(circ);
  for(const s of[-1,1]){box(s*PL,-20.16*M,s*(PL-16.5*M),20.16*M);box(s*PL,-9.16*M,s*(PL-5.5*M),9.16*M)}
  /* the stands, the ribbon, the roof: turned-away panels skipped, the rest far to near */
  const seat=rgb(sp.seat),seat2=rgb(sp.seat2),roof=rgb(sp.roof),led=rgb(sp.led),wall=[34,40,52],rim=[255,246,222];
  const L=[];
  for(const p of P){if(dot(p.n,sub(c.eye,p.c))<=0)continue;const s=clip(c,p.pts);if(s)L.push([s,p])}
  L.sort((a,b)=>b[0].z-a[0].z);
  for(const [s,p] of L){
   const lit=.42+.58*Math.max(0,dot(p.n,LIGHT)*.5+.5*Math.max(0,-dot(p.n,unit([p.c[0],p.c[1],0])))),fog=Math.max(.45,1-s.z/2600);
   path(ctx,s.s);
   if(p.ring==='low'||p.ring==='up'){ctx.fillStyle=css(seat,lit*fog);ctx.fill();
    /* the rows of seats: lines between the two edges of the panel */
    const q=p.pts,rows=p.rows;ctx.strokeStyle=css(seat2,fog*.8,.38);ctx.lineWidth=1;ctx.beginPath();
    for(let j=1;j<rows;j++){const a=project(c,lerp(q[0],q[3],j/rows)),b=project(c,lerp(q[1],q[2],j/rows));if(a&&b){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1])}}ctx.stroke()}
   else if(p.ring==='led'){ctx.fillStyle=css(led,1.15);ctx.fill()}
   else if(p.ring==='rim'){ctx.fillStyle=css(rim,fog);ctx.fill()}
   else if(p.ring==='under'){ctx.fillStyle=css(roof,fog*1.1);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;ctx.stroke()}
   else{ctx.fillStyle=css(wall,fog);ctx.fill()}
  }
  /* the glow of the LED ribbon, the floodlights on the edge of the opening and the light over the pitch (added light, no blur filter) */
  ctx.globalCompositeOperation='lighter';
  for(const [s,p] of L){if(p.ring==='led'){path(ctx,s.s);ctx.strokeStyle='rgba(60,130,255,.35)';ctx.lineWidth=Math.max(3,W/260);ctx.stroke()}
   else if(p.ring==='rim'&&p.i%2===0){const q=s.s[0],r=Math.max(6,c.F*9/s.z),gl=ctx.createRadialGradient(q[0],q[1],0,q[0],q[1],r);
    gl.addColorStop(0,'rgba(255,248,230,.9)');gl.addColorStop(.25,'rgba(255,240,205,.35)');gl.addColorStop(1,'rgba(255,240,205,0)');ctx.fillStyle=gl;ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r)}}
  const cp=project(c,[0,0,0]);if(cp){const gl=ctx.createRadialGradient(cp[0],cp[1],0,cp[0],cp[1],Math.max(W,H)*.6);gl.addColorStop(0,'rgba(255,244,214,.10)');gl.addColorStop(1,'rgba(255,244,214,0)');ctx.fillStyle=gl;ctx.fillRect(0,0,W,H)}
  ctx.globalCompositeOperation='source-over';
  return L.length;
 }
 let S=null;
 function unmount(){if(!S)return;cancelAnimationFrame(S.raf);removeEventListener('scroll',S.onScroll);removeEventListener('resize',S.onResize);if(S.el)S.el.remove();S=null;document.documentElement.classList.remove('st3-on')}
 function mount(club){
  const sp=SPEC[KEY(club)];if(!sp||!on()){unmount();return null}
  if(S&&S.key===KEY(club))return S;unmount();
  const t0=performance.now();
  const el=document.createElement('div');el.id='st3-bg';el.className='st3';el.setAttribute('aria-hidden','true');
  el.innerHTML='<canvas class="st3-cv"></canvas>';
  document.body.appendChild(el);document.documentElement.classList.add('st3-on');
  const cv=el.querySelector('canvas'),ctx=cv.getContext('2d'),P=panels(sp);
  S={key:KEY(club),el,cv,sp,P,raf:0,turn:0,dip:0,fps:null,drawn:0,frameMs:null,panels:P.length};
  const size=()=>{const dpr=Math.min(1.5,window.devicePixelRatio||1),W=innerWidth,H=innerHeight;S.dpr=dpr;S.W=W;S.H=H;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)};
  const frame=()=>{const a=performance.now();S.cam=camera(sp,S.W,S.H,S.turn,S.dip);S.drawn=draw(ctx,sp,P,S.cam,S.dpr);S.frameMs=performance.now()-a};
  const dipNow=()=>Math.min(40,(scrollY||0)*.04);
  size();S.dip=dipNow();frame();
  S.ms=performance.now()-t0;
  S.onScroll=()=>{S.dip=dipNow();if(S.still)frame()};addEventListener('scroll',S.onScroll,{passive:true});
  S.onResize=()=>{size();frame()};addEventListener('resize',S.onResize);
  S.still=reduce();
  if(!S.still){
   /* the slow drift round the stands: about 30 frames a second, rAF stops by itself while the page is hidden */
   const start=performance.now();let last=0,fr=0,f0=start;
   const tick=t=>{if(!S||S.el!==el)return;S.raf=requestAnimationFrame(tick);if(t-last<30)return;last=t;
    S.turn=sp.cam.orbit*Math.sin((t-start)/16000*2*Math.PI);frame();fr++;
    if(t-f0>=2000){S.fps=Math.round(fr*1000/(t-f0));fr=0;f0=t;say()}};
   S.raf=requestAnimationFrame(tick)}
  return S;
 }
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 function say(){const m=document.querySelector('.st3-m');if(!m||!S)return;
  m.innerHTML=`${ar()?'الإطار يُرسم في':'a frame takes'} ${nb((S.frameMs||0).toFixed(1)+' ms')} · ${nb(S.panels)} ${ar()?'لوح':'panels'}${S.fps!=null?` · ${nb(S.fps+' fps')}`:''}`}
 /* the line under the club's header: what it is, the switch and the measurements */
 function control(el,club){
  const sp=SPEC[KEY(club)],hd=el&&el.querySelector('.clubhd');if(!sp||!hd)return;
  let c=el.querySelector('.st3-ctl');if(!c){c=document.createElement('p');c.className='st3-ctl mu';hd.insertAdjacentElement('afterend',c)}
  const draw=()=>{const o=on();
   c.innerHTML=`${two(`Behind this page: ${sp.name} in 3D, a simple model (a concept, not the exact stadium).`,`خلف هذي الصفحة: ملعب ${sp.ar} بثلاثة أبعاد، مجسّم مبسّط (تصوّر، مو الملعب بمقاساته).`)}
    <button type="button" class="st3-sw" aria-pressed="${o}">${o?two('Turn off','أوقفه'):two('Turn on','شغّله')}</button> <span class="st3-m"></span>`;
   c.querySelector('.st3-sw').onclick=()=>{setOn(!on());if(on())mount(club);else unmount();draw()};
   say()};
  draw();
 }
 const nameOf=arg=>{try{return decodeURIComponent(String(arg||''))}catch(e){return String(arg||'')}};
 const oc=R.club;
 R.club=async function(el,arg){
  const h0=location.hash,out=await oc.apply(this,arguments);
  if(location.hash!==h0)return out;
  const club=nameOf(arg);
  if(SPEC[KEY(club)]){mount(club);control(el,club)}else unmount();
  return out;
 };
 addEventListener('hashchange',()=>{if(!/^#\/club\//.test(location.hash))unmount()});
 INS.stadium3d={SPEC,N,M,NEAR,mount,unmount,on,panels,camera,project,state:()=>S};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
