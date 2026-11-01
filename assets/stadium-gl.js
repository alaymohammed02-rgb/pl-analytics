/* ===== The club's stadium in WebGL (assets/stadium3d.js loads this file only on a club page that has a stadium, and only when WebGL works) =====
   A native ES module on top of a small, tree-shaken build of three.js (assets/vendor/three-st3.js, MIT licence, see tools/three/). No model file and no photograph:
   the stadium is built here from numbers, in metres, from what the reference photographs show (the owner's photographs of the inside of the Bernabéu were looked at,
   none is copied or shown): a rounded-rectangle bowl of two tiers of stepped blue seats with aisles, a dark concourse between them with a ribbon of light, a white
   steel roof (radial beams, rings, a pale membrane) with a wide screen hanging at the edge of its opening, a row of floodlights on that edge, the night sky through it,
   the pitch in wide mown bands with its lines, and a blue ring of boards round it.
   create(spec, {W,H,dpr}) -> {canvas, render(t, view), resize(W,H), dispose(), info(), stats}; view = {turn (degrees), dip (metres)}.
   Everything is built once; a frame is one render call (about 20 draw calls). INS.stadiumGl = the exported helpers, for the tests. */
import {WebGLRenderer,Scene,PerspectiveCamera,Mesh,BufferGeometry,Float32BufferAttribute,InstancedMesh,MeshStandardMaterial,MeshBasicMaterial,PlaneGeometry,BoxGeometry,Color,Fog,HemisphereLight,DirectionalLight,Matrix4,Vector3,Quaternion,DoubleSide,CanvasTexture,SRGBColorSpace,ACESFilmicToneMapping,Points,PointsMaterial,AdditiveBlending,RepeatWrapping} from './vendor/three-st3.js?v=766f80df';

/* the model, in metres. a,b = half length and half width of the ring, y = height, n = how square the ring is (2 = ellipse) */
export const SPECS={
 'real madrid':{
  pitch:[105,68],squareness:3.2,segs:192,aisleEvery:16,
  boards:{a:58,b:40,y:.9},
  low:{from:{a:60,b:42,y:1.2},to:{a:96,b:78,y:21},rows:24},
  mid:{from:{a:96,b:78,y:21},to:{a:101,b:83,y:31}},
  up:{from:{a:101,b:83,y:31},to:{a:124,b:106,y:60},rows:26},
  led:{from:{a:96.6,b:78.6,y:23},to:{a:97.2,b:79.2,y:26.5}},
  wall:{from:{a:124,b:106,y:60},to:{a:128,b:110,y:78}},
  roof:{outer:{a:128,b:110,y:78},inner:{a:78,b:58,y:68},beams:96,rings:[.18,.4,.62,.84]},
  screen:{from:{a:78.4,b:58.4,y:60},to:{a:78.4,b:58.4,y:67.6}},
  lamps:{ring:{a:79,b:59,y:66.4},count:96},
  cam:{eye:[8,50,88],at:[0,27,-32],fov:68,fovTall:86,orbit:6}
 }
};
const TAU=Math.PI*2;
/* the ring's point at angle t: a rounded rectangle (a superellipse of exponent n) */
export const ringPt=(a,b,n,t)=>{const c=Math.cos(t),s=Math.sin(t),e=2/n;return [a*Math.sign(c)*Math.pow(Math.abs(c),e),b*Math.sign(s)*Math.pow(Math.abs(s),e)]};
const lerp=(p,q,k)=>p+(q-p)*k;
const lv=(A,B,k)=>({a:lerp(A.a,B.a,k),b:lerp(A.b,B.b,k),y:lerp(A.y,B.y,k)});
const P3=(L,n,t)=>{const p=ringPt(L.a,L.b,n,t);return [p[0],L.y,p[1]]};

/* a smooth band between two rings, facing the middle of the stadium (inward = true) or out */
export function band(A,B,n,segs,inward,uRep){
 const pos=[],uv=[],idx=[];
 for(let i=0;i<=segs;i++){const t=i/segs*TAU,p=P3(A,n,t),q=P3(B,n,t);pos.push(...p,...q);uv.push(i/segs*uRep,0,i/segs*uRep,1)}
 for(let i=0;i<segs;i++){const k=i*2;inward?idx.push(k,k+1,k+2,k+1,k+3,k+2):idx.push(k,k+2,k+1,k+1,k+2,k+3)}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
/* stepped rows of a tier: for each row a tread (flat, seats) and a riser (the seat backs). Flat quads, so the normals are exact; the aisles leave gaps. */
export function tier(T,n,segs,aisleEvery,seatW){
 const pos=[],uv=[],col=[],rows=T.rows;let cnt=0,seed=7;
 const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(let i=0;i<segs;i++){
  if(aisleEvery&&i%aisleEvery===0)continue;
  const t0=i/segs*TAU,t1=(i+1)/segs*TAU,tone=.86+.22*rnd();
  for(let r=0;r<rows;r++){
   const L0=lv(T.from,T.to,r/rows),L1=lv(T.from,T.to,(r+1)/rows);
   const A0=P3({a:L0.a,b:L0.b,y:L0.y},n,t0),A1=P3({a:L0.a,b:L0.b,y:L0.y},n,t1),B0=P3({a:L1.a,b:L1.b,y:L0.y},n,t0),B1=P3({a:L1.a,b:L1.b,y:L0.y},n,t1);
   const C0=P3({a:L1.a,b:L1.b,y:L1.y},n,t0),C1=P3({a:L1.a,b:L1.b,y:L1.y},n,t1);
   const w=Math.hypot(A1[0]-A0[0],A1[2]-A0[2])/seatW;
   /* tread: A0 A1 B1 B0 (the upper half of the seat picture) */
   pos.push(...A0,...B0,...A1,...A1,...B0,...B1);uv.push(0,.5,0,0,w,.5,w,.5,0,0,w,0);
   /* riser: B0 B1 C1 C0 (the lower half: the backs) */
   pos.push(...B0,...C0,...B1,...B1,...C0,...C1);uv.push(0,1,0,.5,w,1,w,1,0,.5,w,.5);
   for(let k=0;k<12;k++)col.push(tone,tone,tone);cnt+=2;
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('color',new Float32BufferAttribute(col,3));g.computeVertexNormals();g.userData.quads=cnt;return g;
}
/* canvases that become textures */
const cv=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);return c};
const tex=(c,rep)=>{const t=new CanvasTexture(c);t.colorSpace=SRGBColorSpace;t.anisotropy=4;if(rep){t.wrapS=t.wrapT=RepeatWrapping}return t};
function seatTexture(){return tex(cv(128,128,(x,w,h)=>{
 x.fillStyle='#0b1636';x.fillRect(0,0,w,h);
 /* upper half: cushions, lower half: backs; a seat is 64 px wide with a dark gap */
 for(let k=0;k<2;k++)for(let half=0;half<2;half++){const x0=k*64+4,y0=half*64+(half?10:14),hh=half?46:34;
  const g=x.createLinearGradient(0,y0,0,y0+hh);g.addColorStop(0,half?'#223b78':'#2f4f9a');g.addColorStop(1,half?'#122350':'#1f3770');x.fillStyle=g;x.beginPath();x.roundRect(x0,y0,56,hh,8);x.fill()}
 }),true)}
function pitchTexture(PL,PW){return tex(cv(2048,1344,(x,w,h)=>{
 const bands=14,bw=w/bands;
 for(let i=0;i<bands;i++){x.fillStyle=i%2?'#2d8a4e':'#25783f';x.fillRect(i*bw,0,bw+1,h)}
 /* a faint mown cross-pattern, as on the photographs */
 x.globalAlpha=.03;for(let j=0;j<8;j++){x.fillStyle=j%2?'#fff':'#000';x.fillRect(0,j*h/8,w,h/8)}x.globalAlpha=1;
 const sx=w/PL,sy=h/PW;x.strokeStyle='rgba(255,255,255,.92)';x.lineWidth=Math.max(3,.13*sx);x.lineJoin='round';
 const R=(x0,y0,x1,y1)=>x.strokeRect(x0*sx,y0*sy,(x1-x0)*sx,(y1-y0)*sy);
 R(.6,.6,PL-.6,PW-.6);x.beginPath();x.moveTo(PL/2*sx,.6*sy);x.lineTo(PL/2*sx,(PW-.6)*sy);x.stroke();
 x.beginPath();x.arc(PL/2*sx,PW/2*sy,9.15*sx,0,TAU);x.stroke();x.beginPath();x.arc(PL/2*sx,PW/2*sy,.35*sx,0,TAU);x.fillStyle='#fff';x.fill();
 for(const s of[0,1]){const X=s?PL:0,d=s?-1:1;R(Math.min(X,X+d*16.5),(PW-40.32)/2,Math.max(X,X+d*16.5),(PW+40.32)/2);R(Math.min(X,X+d*5.5),(PW-18.32)/2,Math.max(X,X+d*5.5),(PW+18.32)/2);
  x.beginPath();x.arc((X+d*11)*sx,PW/2*sy,.3*sx,0,TAU);x.fill();x.beginPath();x.arc((X+d*11)*sx,PW/2*sy,9.15*sx,s?-.93:Math.PI-.93+Math.PI,s?.93:.93+Math.PI*0);x.stroke()}
 }),false)}
function screenTexture(){return tex(cv(1024,64,(x,w,h)=>{
 const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#1c2a86');g.addColorStop(1,'#16205f');x.fillStyle=g;x.fillRect(0,0,w,h);
 /* a scoreboard band: dark panels with a few bright blocks and thin lines, like the screens in the photographs (no crest, no text) */
 for(let i=0;i<8;i++){const x0=i*128;x.fillStyle='rgba(8,12,44,.55)';x.fillRect(x0+4,6,120,h-12);
  x.fillStyle='rgba(235,240,255,.78)';x.fillRect(x0+14,16,8,h-32);x.fillRect(x0+86,16,8,h-32);x.fillStyle='rgba(235,240,255,.5)';x.fillRect(x0+30,h/2-3,48,6)}
 }),true)}
function ribbonTexture(){return tex(cv(512,16,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#6fa4ff');g.addColorStop(.5,'#2f7bff');g.addColorStop(1,'#1d4fd0');x.fillStyle=g;x.fillRect(0,0,w,h);
 x.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<32;i++)x.fillRect(i*16+2,3,7,h-6)}),true)}
function glowTexture(){return tex(cv(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,250,235,1)');g.addColorStop(.18,'rgba(255,240,205,.85)');g.addColorStop(.5,'rgba(255,230,180,.22)');g.addColorStop(1,'rgba(255,230,180,0)');x.fillStyle=g;x.fillRect(0,0,w,h)}),false)}
function windowTexture(){return tex(cv(256,64,(x,w,h)=>{x.fillStyle='#121722';x.fillRect(0,0,w,h);for(let i=0;i<16;i++){x.fillStyle=i%3?'#ffd98a':'#9bb7ff';x.globalAlpha=.55;x.fillRect(i*16+3,18,10,22)}x.globalAlpha=1}),true)}

export function create(sp,o){
 const S=SPECS[sp];if(!S)throw new Error('no GL spec for '+sp);
 const n=S.squareness,segs=S.segs,dpr=Math.min(1.5,o.dpr||1);
 /* ask quietly first: three.js writes an error to the console when there is no WebGL */
 const probe=document.createElement('canvas'),pg=probe.getContext('webgl2')||probe.getContext('webgl');
 if(!pg)throw new Error('WebGL is not available');try{pg.getExtension('WEBGL_lose_context').loseContext()}catch(e){}
 const canvas=document.createElement('canvas');canvas.className='st3-gl';
 const renderer=new WebGLRenderer({canvas,antialias:dpr<1.5,powerPreference:'low-power',alpha:false});
 renderer.setPixelRatio(dpr);renderer.setSize(o.W,o.H,false);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
 const scene=new Scene();scene.background=new Color('#060a12');scene.fog=new Fog('#0a1220',150,330);
 const fovFor=(W,H)=>W/H<1?S.cam.fovTall:S.cam.fov;const cam=new PerspectiveCamera(fovFor(o.W,o.H),o.W/o.H,.5,500);
 const disposables=[];const keep=x=>{disposables.push(x);return x};
 const add=(g,m)=>{const me=new Mesh(keep(g),keep(m));scene.add(me);return me};
 const [PL,PW]=S.pitch;
 /* light: a cool sky fill and a warm key from the floodlights */
 scene.add(new HemisphereLight(0xc4d0ff,0x2b3f33,2.2));
 const key=new DirectionalLight(0xfff0d6,2.6);key.position.set(-30,90,40);scene.add(key);
 const fill=new DirectionalLight(0x8fa8ff,.55);fill.position.set(40,50,-70);scene.add(fill);
 /* pitch, its surround and the boards */
 const pt=keep(pitchTexture(PL,PW));
 add(new PlaneGeometry(PL,PW).rotateX(-Math.PI/2),new MeshStandardMaterial({map:pt,roughness:.92,metalness:0,emissive:0x0f3a1c,emissiveIntensity:.45}));
 add(band({a:PL/2-6,b:PW/2-6,y:-.03},{a:S.boards.a,b:S.boards.b,y:-.03},n,segs,true,1),new MeshStandardMaterial({color:0x143a24,roughness:1,side:DoubleSide}));
 add(band({a:S.boards.a,b:S.boards.b,y:0},{a:S.boards.a,b:S.boards.b,y:S.boards.y},n,segs,true,14),new MeshStandardMaterial({map:keep(ribbonTexture()),emissive:0x1b3fb0,emissiveIntensity:.5,roughness:.5,side:DoubleSide}));
 add(band({a:S.boards.a,b:S.boards.b,y:0},{a:S.low.from.a,b:S.low.from.b,y:S.low.from.y},n,segs,true,1),new MeshStandardMaterial({color:0x0c1a2e,roughness:1,side:DoubleSide}));
 /* the stands */
 const st=keep(seatTexture());const seatMat=new MeshStandardMaterial({map:st,vertexColors:true,roughness:.75,metalness:.05,side:DoubleSide});
 const lowG=tier(S.low,n,segs,S.aisleEvery,.5),upG=tier(S.up,n,segs,S.aisleEvery,.5);
 add(lowG,seatMat);add(upG,seatMat);
 /* the concourse between the tiers: dark, with lit windows, and the ribbon of light */
 add(band(S.mid.from,S.mid.to,n,segs,true,60),new MeshStandardMaterial({map:keep(windowTexture()),emissive:0xffffff,emissiveMap:keep(windowTexture()),emissiveIntensity:.5,roughness:.9,side:DoubleSide}));
 add(band(S.led.from,S.led.to,n,segs,true,18),new MeshBasicMaterial({map:keep(ribbonTexture()),side:DoubleSide,toneMapped:false}));
 add(band(S.wall.from,S.wall.to,n,segs,true,1),new MeshStandardMaterial({color:0x0b0f18,roughness:1,side:DoubleSide}));
 /* the roof: radial beams, rings and a pale membrane between them */
 const R=S.roof,beamMat=new MeshStandardMaterial({color:0xe8ecf2,roughness:.45,metalness:.55,emissive:0x59627a,emissiveIntensity:.5});
 const unit=new BoxGeometry(1,1,1);keep(unit);
 const nB=R.beams,beams=new InstancedMesh(unit,beamMat,nB);keep(beamMat);const M=new Matrix4(),Q=new Quaternion(),V=new Vector3(),Sc=new Vector3(),Z=new Vector3(0,0,1);
 for(let i=0;i<nB;i++){const t=(i+.5)/nB*TAU,A=P3(R.outer,n,t),B=P3(R.inner,n,t);const d=new Vector3(B[0]-A[0],B[1]-A[1],B[2]-A[2]),L=d.length();Q.setFromUnitVectors(Z,d.clone().normalize());
  V.set((A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2);Sc.set(.9,1.4,L);M.compose(V,Q,Sc);beams.setMatrixAt(i,M)}
 scene.add(beams);
 let ringCount=0;for(const f of R.rings){const L=lv(R.outer,R.inner,f),m=Math.ceil(segs/2);const rb=new InstancedMesh(unit,beamMat,m);ringCount+=m;
  for(let i=0;i<m;i++){const t0=i/m*TAU,t1=(i+1)/m*TAU,A=P3(L,n,t0),B=P3(L,n,t1),d=new Vector3(B[0]-A[0],B[1]-A[1],B[2]-A[2]),l=d.length();Q.setFromUnitVectors(Z,d.clone().normalize());
   V.set((A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2);Sc.set(.7,1.1,l*1.02);M.compose(V,Q,Sc);rb.setMatrixAt(i,M)}scene.add(rb)}
 add(band(R.outer,R.inner,n,segs,true,1),new MeshStandardMaterial({color:0xdfe6f2,roughness:.8,emissive:0x7d8aa8,emissiveIntensity:.55,transparent:true,opacity:.8,side:DoubleSide,depthWrite:false}));
 /* the screen hanging at the edge of the opening, and the floodlights along it */
 const sTex=screenTexture();keep(sTex);
 add(band(S.screen.from,S.screen.to,n,segs,true,6),new MeshBasicMaterial({map:sTex,side:DoubleSide,toneMapped:false}));
 const lp=[];for(let i=0;i<S.lamps.count;i++){const p=P3(S.lamps.ring,n,(i+.5)/S.lamps.count*TAU);lp.push(...p)}
 const lg=new BufferGeometry();lg.setAttribute('position',new Float32BufferAttribute(lp,3));
 const lamps=new Points(keep(lg),keep(new PointsMaterial({map:keep(glowTexture()),size:11,sizeAttenuation:true,transparent:true,blending:AdditiveBlending,depthWrite:false,toneMapped:false})));scene.add(lamps);
 /* the camera: a seat high in the near upper tier, looking across the pitch */
 const eye=new Vector3(...S.cam.eye),at=new Vector3(...S.cam.at);
 const view=(turn,dip)=>{const a=(turn||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);cam.position.set(eye.x*c+eye.z*s,eye.y,-eye.x*s+eye.z*c);cam.lookAt(at.x,at.y-(dip||0)*.6,at.z)};
 const stats={drawCalls:0,triangles:0,meshes:scene.children.filter(c=>c.isMesh||c.isInstancedMesh||c.isPoints).length,quads:lowG.userData.quads+upG.userData.quads,beams:nB,ringBeams:ringCount,lamps:S.lamps.count};
 let curW=o.W,curH=o.H,scale=1;
 const api={canvas,stats,scene,camera:cam,renderer,
  get scale(){return scale},
  /* the drawing resolution as a share of the screen's (a slow device is given fewer pixels, the picture is only softer) */
  setScale(k){scale=Math.max(.4,Math.min(1,k));renderer.setPixelRatio(dpr*scale);renderer.setSize(curW,curH,false)},
  render(t,v){view(v&&v.turn,v&&v.dip);sTex.offset.x=(t/1000*.012)%1;renderer.render(scene,cam);const i=renderer.info.render;stats.drawCalls=i.calls;stats.triangles=i.triangles},
  resize(W,H){curW=W;curH=H;renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=fovFor(W,H);cam.updateProjectionMatrix()},
  dispose(){for(const d of disposables)if(d&&d.dispose)d.dispose();renderer.dispose();try{renderer.forceContextLoss()}catch(e){}},
  info:()=>({gl:renderer.getContext().getParameter(renderer.getContext().VERSION)})};
 view(0,0);return api;
}
