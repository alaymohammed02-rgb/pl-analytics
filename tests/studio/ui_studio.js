/* Mujassam Studio, the editor itself (the unlisted studio-<random>/ folder), in a real browser. The page and its files are served straight from the folder (no
   network), so this also shows that it asks nothing of any other site. Every number is worked out here, not read back from the page:
   shapes (add, undo, redo, Arabic, a phone's width); images (a transparent ring becomes a solid with a real hole, a gradient becomes a relief higher on its bright
   side, flat, saving); models (a GLB made of a red-and-white box and a blue sphere: scaled, centred, picked as a whole, recoloured, saved and read back from
   IndexedDB, OBJ; a Draco-compressed GLB opens and has the same triangles; a glTF with its .bin and image picked together opens, alone it names what is missing;
   every reason a file is refused is said in words: wrong type, ZIP, damaged, KTX2, Draco without the decoder); keyframe animation (linear and smooth
   interpolation, holds, playback, loop, the track, delete key, auto key, saving, duplicate). */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const REPO=process.env.PLREPO||path.resolve(__dirname,'..','..');
const DIR=fs.readdirSync(REPO).find(n=>/^studio-[a-z0-9]{12}$/.test(n));
const SD=path.join(REPO,DIR),FX=path.join(__dirname,'fixtures');
const MIME={'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain'};
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++};
const near=(a,b,e)=>Math.abs(a-b)<e;
const bytes=f=>Array.from(fs.readFileSync(path.join(FX,f)));
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const ext=[];
 async function open(vw,vh,init){
  const ctx=await b.newContext({viewport:{width:vw,height:vh}});const pg=await ctx.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|fonts|ERR_/.test(m.text()))errs.push(m.text())});
  pg.on('request',r=>{const u=r.url();if(!/^http:\/\/mjm\.test\//.test(u)&&!/^data:|^blob:|fonts\.(googleapis|gstatic)/.test(u))ext.push(u)});
  await pg.route(/^http:\/\/mjm\.test\/(.*)$/,r=>{let p=decodeURIComponent(new URL(r.request().url()).pathname);if(p==='/')p='/index.html';const f=path.join(SD,p);
   if(f.startsWith(SD)&&fs.existsSync(f)&&fs.statSync(f).isFile())r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});else r.fulfill({status:404,body:'no'})});
  await pg.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  if(init)await pg.addInitScript(init);
  await pg.goto('http://mjm.test/');await pg.waitForFunction(()=>window.__mjm,null,{timeout:20000});await pg.waitForTimeout(400);
  return {ctx,pg,errs};
 }
 const stat=pg=>pg.evaluate(()=>document.getElementById('status').textContent);

 /* ------------------------------------------------------------------ shapes */
 {const {ctx,pg,errs}=await open(1280,900);
  const r=await pg.evaluate(async()=>{const M=window.__mjm,o={};o.n0=M.objs.length;M.add('box');o.n1=M.objs.length;o.nm=M.objs[M.objs.length-1].name;M.undo();o.n2=M.objs.length;M.redoIt();o.n3=M.objs.length;
   o.dir=document.documentElement.dir;o.tabs=document.querySelectorAll('#tabs button').length;o.title=document.title;o.addBtns=[...document.querySelectorAll('#addbar button')].length;
   const s=M.serialize();o.keys=Object.keys(s).join();return o});
  ok(r.n0===5&&r.n1===6&&r.n2===5&&r.n3===6,'the example scene has 5 shapes; Add makes 6, Undo 5, Redo 6');
  ok(r.dir==='rtl'&&r.tabs===4&&r.title==='Mujassam Studio'&&r.addBtns===8,'Arabic right-to-left by default, four tabs, eight Add buttons (six shapes, image, model)');
  await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'at 390 px there is no sideways scroll');
  await pg.click('#lang');ok(await pg.evaluate(()=>document.documentElement.dir==='ltr'&&document.getElementById('lang').textContent==='العربية'),'the language button switches to English, left to right');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}

 /* ------------------------------------------------------------------ images */
 {const {ctx,pg,errs}=await open(1280,900);
  const R=await pg.evaluate(async()=>{
   const M=window.__mjm,out={},wait=ms=>new Promise(r=>setTimeout(r,ms));
   const mk=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);return c.toDataURL('image/png')};
   const ring=mk(200,200,x=>{x.strokeStyle='#ffcc33';x.lineWidth=35;x.beginPath();x.arc(100,100,52,0,Math.PI*2);x.stroke()});
   const grad=mk(160,100,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'#0d0d0d');g.addColorStop(1,'#f2f2f2');x.fillStyle=g;x.fillRect(0,0,w,h)});
   M.load({bg:'#161b22',objects:[]});
   const mr=await M.addImageData(ring);await wait(700);out.mode=mr.userData.im.mode;out.gtype=mr.geometry.type;
   mr.geometry.computeBoundingBox();const bb=mr.geometry.boundingBox;out.bz=bb.max.z-bb.min.z;out.bx=bb.max.x-bb.min.x;
   const RC=THREE.Raycaster,V=THREE.Vector3;const hit=x=>{const r=new RC(new V(mr.position.x+x,mr.position.y,5),new V(0,0,-1));mr.updateMatrixWorld(true);return r.intersectObject(mr,false).length};
   out.hole=hit(0);out.ringHit=hit(.525);out.outside=hit(.95);
   mr.userData.im.depth=.6;await M.buildImage(mr);mr.geometry.computeBoundingBox();out.bz2=mr.geometry.boundingBox.max.z-mr.geometry.boundingBox.min.z;
   const mg=await M.addImageData(grad);await wait(700);out.gmode0=mg.userData.im.mode;out.gdepth0=mg.userData.im.depth;out.emis=mg.material.emissiveIntensity>0&&!!mg.material.emissiveMap;mg.userData.im.mode='relief';mg.userData.im.depth=.35;await M.buildImage(mg);out.gmode=mg.userData.im.mode;out.gtype2=mg.geometry.type;
   const pos=mg.geometry.attributes.position;let ymax=-1e9;for(let i=0;i<pos.count;i++)ymax=Math.max(ymax,pos.getY(i));
   let lo=1e9,hi=-1e9,zl=0,zr=0;for(let i=0;i<pos.count;i++){if(Math.abs(pos.getY(i)-ymax)<1e-6){const x=pos.getX(i);if(x<lo){lo=x;zl=pos.getZ(i)}if(x>hi){hi=x;zr=pos.getZ(i)}}}
   out.dz=zr-zl;out.depth=mg.userData.im.depth;
   mg.userData.im.mode='flat';await M.buildImage(mg);out.flatType=mg.geometry.type;
   const s=JSON.parse(JSON.stringify(M.serialize(true)));out.hasImgs=Object.keys(s.images||{}).length;
   M.load(s);await wait(900);out.imgMeshes=M.objs.filter(o=>o.userData.im).length;
   const rm=M.objs.find(o=>o.userData.im&&o.userData.im.mode==='solid');rm.geometry.computeBoundingBox();out.bz3=rm.geometry.boundingBox.max.z-rm.geometry.boundingBox.min.z;out.d3=rm.userData.im.depth;
   return out});
  ok(R.mode==='solid'&&/Extrude/.test(R.gtype),'a transparent ring becomes a solid (ExtrudeGeometry)');
  ok(near(R.bz,.25,.01)&&R.bx>1.3&&R.bx<1.5,'its depth is the slider\'s 0.25 and its width the ring\'s about 1.4 ('+R.bz.toFixed(2)+', '+R.bx.toFixed(2)+')');
  ok(R.hole===0&&R.ringHit>0&&R.outside===0,'the hole is real: a ray through the centre misses, through the ring hits, outside misses');
  ok(near(R.bz2,.6,.01),'raising the depth to 0.6 rebuilds the solid');
  ok(R.gmode0==='flat'&&near(R.gdepth0,.12,1e-9)&&R.emis,'an ordinary opaque photo starts flat, shown in its own colours (emissive map), with a gentle depth of 0.12 ready for Relief');
  ok(R.gmode==='relief'&&/Plane/.test(R.gtype2)&&R.dz>.25&&R.dz<.4,'an opaque picture becomes a relief, its bright side higher than its dark side by about the depth 0.35 ('+R.dz.toFixed(2)+')');
  ok(/Plane/.test(R.flatType),'flat mode is a plain plane');
  ok(R.hasImgs===2&&R.imgMeshes===2&&near(R.bz3,R.d3,.02),'saving keeps both pictures; loading rebuilds them with the saved depth');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}

 /* ------------------------------------------------------------------ models */
 {const {ctx,pg,errs}=await open(1280,900);
  const base=bytes('base.glb'),draco=bytes('draco.glb'),gl=bytes('scene.gltf'),bin=bytes('scene.bin'),png=bytes('scene0.png');
  const R=await pg.evaluate(async([base,draco,gl,bin,png])=>{
   const M=window.__mjm,o={},wait=ms=>new Promise(r=>setTimeout(r,ms)),$=s=>document.querySelector(s),status=()=>$('#status').textContent;
   const buf=a=>new Uint8Array(a).buffer,file=(a,n)=>new File([new Uint8Array(a)],n);
   const meshes=r=>{const l=[];r.userData.inst.traverse(c=>{if(c.isMesh)l.push(c)});return l};
   M.load({bg:'#161b22',objects:[]});
   /* a GLB: box 2 x 1 x 4 (white, textured) and a blue sphere on top; 364 triangles */
   const root=await M.addModelBuffer(buf(base),'car','glb');await wait(500);o.type=root.userData.type;o.meshes=meshes(root).length;
   root.updateMatrixWorld(true);const fb=new THREE.Box3().setFromObject(root);o.fsz=fb.getSize(new THREE.Vector3()).toArray();o.fmin=fb.min.toArray();o.fc=fb.getCenter(new THREE.Vector3()).toArray();
   o.tris=M.triCount(root);o.cols=meshes(root).map(m=>m.material.color.getHexString()).sort().join();
   const c=fb.getCenter(new THREE.Vector3()).project(M.camera);o.pick=M.pickNdc(c.x,c.y);o.idx=M.objs.indexOf(root);
   M.select(o.idx);$('#tabs button:nth-child(2)').click();const ci=$('#i-color');ci.value='#00ff00';ci.dispatchEvent(new Event('input',{bubbles:true}));ci.dispatchEvent(new Event('change',{bubbles:true}));
   o.tint=meshes(root).map(m=>m.material.color.getHexString()).join();o.ap=root.userData.ap;
   const s=JSON.parse(JSON.stringify(M.serialize(true)));o.json=JSON.stringify(s).length;o.mo=s.objects[0].mo;
   Object.keys(M.MODELS).forEach(k=>delete M.MODELS[k]);Object.keys(M.MCACHE).forEach(k=>delete M.MCACHE[k]);
   await wait(300);M.load(s);await wait(900);const r2=M.objs[0];o.fromIdb=!!(r2.userData.inst&&meshes(r2).length===2);o.tint2=r2.userData.inst?meshes(r2).map(m=>m.material.color.getHexString()).join():'';
   /* OBJ */
   const obj='v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1\nf 1 2 3 4\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n';
   const mo=await M.addModelBuffer(new TextEncoder().encode(obj).buffer,'cube','obj');await wait(300);o.obj=!!mo&&meshes(mo).length>=1;
   /* Draco: same box and sphere, compressed */
   M.load({bg:'#161b22',objects:[]});o.dracoOK=!!(THREE.DRACOLoader&&window.MJM_DRACO);
   const md=await M.addModelBuffer(buf(draco),'dr','glb');await wait(800);
   if(md){o.drMeshes=meshes(md).length;o.drTris=M.triCount(md);md.updateMatrixWorld(true);o.drSize=new THREE.Box3().setFromObject(md).getSize(new THREE.Vector3()).toArray()}else o.drMsg=status();
   /* the same file where the decoder is not available */
   const keep=window.MJM_DRACO;window.MJM_DRACO=undefined;const n0=M.objs.length;const md2=await M.addModelBuffer(buf(draco),'dr2','glb');o.noDracoNull=md2===null;o.noDracoCount=M.objs.length===n0;o.noDracoMsg=status();window.MJM_DRACO=keep;
   /* a glTF with its .bin and image picked together; alone, it names what is missing */
   M.load({bg:'#161b22',objects:[]});
   await M.addModelFiles([file(gl,'scene.gltf'),file(bin,'scene.bin'),file(png,'scene0.png')]);await wait(800);
   const eg=M.objs.find(x=>x.userData.mo);o.extOk=!!eg&&!!eg.userData.inst&&meshes(eg).length===2;o.extTris=eg?M.triCount(eg):0;o.extKind=eg&&eg.userData.mo.k;
   Object.keys(M.MCACHE).forEach(k=>delete M.MCACHE[k]);Object.keys(M.MODELS).forEach(k=>delete M.MODELS[k]);const sg=JSON.parse(JSON.stringify(M.serialize(true)));await wait(300);M.load(sg);await wait(1000);
   const eg2=M.objs.find(x=>x.userData.mo);o.extIdb=!!(eg2&&eg2.userData.inst&&meshes(eg2).length===2);
   const n1=M.objs.length;await M.addModelFiles([file(gl,'alone.gltf')]);o.alone=M.objs.length===n1;o.aloneMsg=status();
   await M.addModelFiles([file(gl,'nopng.gltf'),file(bin,'scene.bin')]);o.noPngMsg=status();
   /* every other reason a file is refused */
   const n2=M.objs.length,say=async fl=>{await M.addModelFiles(fl);await wait(150);return status()};
   o.fbx=await say([file([1,2,3],'car.fbx')]);o.zip=await say([file([80,75,3,4],'car.zip')]);
   o.junk=await say([file([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],'x.glb')]);
   const trunc=new Uint8Array(base).slice(0,300);o.trunc=await say([file(trunc,'t.glb')]);
   o.notjson=await say([file(new TextEncoder().encode('hello'),'t.gltf')]);
   const ktx=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},extensionsRequired:['KHR_texture_basisu'],extensionsUsed:['KHR_texture_basisu']}));o.ktx=await say([file(ktx,'k.gltf')]);
   const mesh=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},extensionsRequired:['EXT_meshopt_compression'],extensionsUsed:['EXT_meshopt_compression']}));const had=window.MeshoptDecoder;window.MeshoptDecoder=undefined;o.meshopt=await say([file(mesh,'m.gltf')]);window.MeshoptDecoder=had;
   o.added=M.objs.length-n2;
   /* a duplicate shares the file, Delete frees, Undo rebuilds */
   M.load({bg:'#161b22',objects:[]});const dm=await M.addModelBuffer(buf(base),'car','glb');await wait(500);M.select(0);$('#b-dup').click();await wait(500);
   const two=M.objs.filter(x=>x.userData.mo);o.dup=two.length===2&&two[0].userData.mo.id===two[1].userData.mo.id;
   const before=M.objs.length,last=M.objs[M.objs.length-1];$('#b-del').click();o.del=before-M.objs.length;o.dead=!!last.userData.dead;M.undo();await wait(700);o.undo=M.objs.length===before&&!!M.objs[M.objs.length-1].userData.inst;
   return o},[base,draco,gl,bin,png]);
  const k=2.5/4;
  ok(R.type==='model'&&R.meshes===2&&R.tris===364,'a GLB of a box and a sphere is one model object with 2 meshes and 364 triangles');
  ok(R.fsz.every((v,i)=>near(v,[2,2,4][i]*k,.01))&&near(R.fmin[1],0,.01)&&near(R.fc[0],0,.01)&&near(R.fc[2],0,.01),'it is scaled to 2.5 on its longest side, stands on the ground and is centred ('+R.fsz.map(v=>v.toFixed(2))+')');
  ok(R.cols==='0000ff,ffffff','it keeps its own materials (blue and white)');
  ok(R.pick===R.idx&&R.idx>=0,'picking any part selects the whole model');
  ok(R.tint==='00ff00,00ff00'&&R.ap===1,'the panel\'s colour overrides every part and is remembered');
  ok(R.mo&&R.mo.k==='glb'&&R.json<20000,'the saved scene names the file and stays small ('+R.json+' bytes), without the model\'s bytes');
  ok(R.fromIdb&&R.tint2==='00ff00,00ff00','with memory empty, the model is read back from IndexedDB with its override');
  ok(R.obj,'an OBJ file imports');
  ok(R.dracoOK&&R.drMeshes===2&&R.drTris===364&&R.drSize.every((v,i)=>near(v,[2,2,4][i]*k,.03)),'a Draco-compressed GLB opens, with the same 364 triangles and size ('+(R.drSize||[]).map(v=>v.toFixed(2))+')');
  ok(R.noDracoNull&&R.noDracoCount&&/Draco/.test(R.noDracoMsg),'without the decoder the same file adds nothing and says it is Draco ('+R.noDracoMsg.slice(0,40)+'…)');
  ok(R.extOk&&R.extTris===364&&R.extKind==='gltf','a glTF picked together with its .bin and image opens (364 triangles)');
  ok(R.extIdb,'that glTF and its files come back from IndexedDB');
  ok(R.alone&&/scene\.bin/.test(R.aloneMsg)&&/scene0\.png/.test(R.aloneMsg),'a glTF picked alone adds nothing and names the missing files ('+R.aloneMsg.slice(-30)+')');
  ok(/scene0\.png/.test(R.noPngMsg)&&!/scene\.bin/.test(R.noPngMsg),'with the .bin but not the image, only the image is named');
  ok(/نوع الملف غير مدعوم/.test(R.fbx)&&/Blender/.test(R.fbx),'an FBX file: "this type is not supported", with what to do');
  ok(/ZIP/.test(R.zip),'a ZIP file: unpack it first');
  ok(/تالف/.test(R.junk)&&/تالف/.test(R.trunc)&&/تالف/.test(R.notjson),'junk bytes, a cut-off GLB and a non-JSON glTF: "damaged or not a valid GLB or glTF"');
  ok(/KTX2/.test(R.ktx),'a model that needs KTX2 images says so');
  ok(/meshopt/.test(R.meshopt),'a meshopt model without the decoder says so');
  ok(R.added===0,'none of the refused files added anything');
  ok(R.dup&&R.del===1&&R.dead&&R.undo,'Duplicate shares the file, Delete frees it, Undo rebuilds it');
  ok(!errs.length,'no page errors '+errs.slice(0,3).join(' ; '));await ctx.close()}

 /* ------------------------------------------------------------------ animation */
 {const {ctx,pg,errs}=await open(1280,900);
  const R=await pg.evaluate(async()=>{
   const M=window.__mjm,A=M.A,out={},wait=ms=>new Promise(r=>setTimeout(r,ms));
   const $=s=>document.querySelector(s),ev=(el,n)=>el.dispatchEvent(new Event(n,{bubbles:true}));
   const scrub=t=>{$('#t-time').value=t;ev($('#t-time'),'input')};const setIn=(id,v)=>{const e=$(id);e.value=v;ev(e,'input');ev(e,'change')};const key=()=>$('#t-key').click();
   M.load({bg:'#161b22',objects:[]});
   M.add('box');M.select(0);$('#tabs button:nth-child(2)').click();$('#t-ease').value='lin';
   scrub(0);setIn('#px',0);setIn('#py',.5);setIn('#pz',0);setIn('#i-color','#ff0000');key();
   scrub(2);setIn('#px',4);setIn('#ry',90);setIn('#sx',2);setIn('#i-color','#0000ff');key();
   const A0=M.objs[0];out.keysA=JSON.parse(JSON.stringify(A0.userData.keys));
   scrub(1);out.mid={x:A0.position.x,ry:A0.rotation.y*180/Math.PI,sx:A0.scale.x,r:A0.material.color.r,b:A0.material.color.b};
   M.add('box');M.select(1);$('#t-ease').value='ease';scrub(0);key();scrub(2);setIn('#px',4);key();
   const kb=M.objs[1].userData.keys;scrub(.5);out.bx=M.objs[1].position.x;const u=.25,sm=u*u*(3-2*u);out.bexp=kb[0].p[0]+(kb[1].p[0]-kb[0].p[0])*sm;out.lbx=kb[0].p[0]+(kb[1].p[0]-kb[0].p[0])*u;
   const ks=[{t:1,p:[1,0,0],q:[0,0,0],s:[1,1,1],c:'#ffffff',o:1,e:'lin'},{t:2,p:[5,0,0],q:[0,0,0],s:[1,1,1],c:'#ffffff',o:1,e:'lin'}];
   out.holdA=M.poseAt(ks,.2).p[0];out.holdB=M.poseAt(ks,3).p[0];out.holdC=M.poseAt(ks,1.5).p[0];
   M.select(0);scrub(0);$('#t-play').click();await wait(800);out.play={t:A.t,x:A0.position.x,playing:A.playing};out.playExp=M.poseAt(A0.userData.keys,A.t).p[0];
   $('#t-play').click();const t1=A.t;await wait(300);out.paused=A.t===t1&&!A.playing;
   setIn('#t-dur',1);scrub(0);$('#t-play').click();await wait(1700);out.loopOn={t:A.t,playing:A.playing,dur:A.dur};$('#t-play').click();
   $('#t-loop').click();out.loopFlag=A.loop;$('#t-stop').click();$('#t-play').click();await wait(1400);out.noLoop={t:A.t,playing:A.playing,dur:A.dur};
   $('#t-loop').click();setIn('#t-dur',4);
   M.select(0);const kf=document.querySelectorAll('.kf');out.kfCount=kf.length;kf[1].click();out.jump=A.t;
   scrub(2);$('#t-keydel').click();out.afterDel=A0.userData.keys?A0.userData.keys.length:0;M.undo();await wait(300);out.afterUndo=M.objs[0].userData.keys.length;
   const s=JSON.parse(JSON.stringify(M.serialize(true)));out.sAnim=s.anim;out.sKeys=s.objects[0].k.length;M.load(s);await wait(200);out.afterLoad=M.objs[0].userData.keys.length;out.keyVal=M.objs[0].userData.keys[1].p[0];
   M.select(0);$('#t-auto').click();out.autoOn=A.auto;scrub(3);setIn('#px',1);const k3=M.objs[0].userData.keys.find(k=>Math.abs(k.t-3)<.02);out.auto=k3&&k3.p[0];$('#t-auto').click();
   const before=M.objs.length;$('#b-dup').click();await wait(200);const d=M.objs[M.objs.length-1];out.dupN=M.objs.length-before;out.dupX0=d.userData.keys[0].p[0];out.srcX0=M.objs[0].userData.keys[0].p[0];
   return out});
  ok(R.keysA.length===2&&R.keysA[1].p[0]===4&&near(R.keysA[1].q[1],90,.01)&&R.keysA[1].s[0]===2&&R.keysA[0].c==='#ff0000'&&R.keysA[1].c==='#0000ff','two keys were recorded with the values set at each time');
  ok(near(R.mid.x,2,.001)&&near(R.mid.ry,45,.01)&&near(R.mid.sx,1.5,.001)&&near(R.mid.r,.5,.01)&&near(R.mid.b,.5,.01),'halfway on a linear segment: x 2, rotation 45 degrees, scale 1.5, colour half red half blue');
  ok(near(R.bx,R.bexp,.001)&&Math.abs(R.bexp-R.lbx)>.2,'a smooth segment follows smoothstep ('+R.bx.toFixed(3)+' against linear '+R.lbx.toFixed(3)+')');
  ok(R.holdA===1&&R.holdB===5&&near(R.holdC,3,1e-9),'before the first key and after the last the pose holds; between keys it interpolates');
  ok(R.play.playing&&R.play.t>.5&&R.play.t<1.4&&near(R.play.x,R.playExp,.15)&&R.paused,'playback runs in real time, follows the keys, and pausing stops the clock');
  ok(R.loopOn.playing&&R.loopOn.t<R.loopOn.dur&&R.loopFlag===false&&!R.noLoop.playing&&near(R.noLoop.t,R.noLoop.dur,1e-9),'Loop on wraps and keeps playing; Loop off stops at the end');
  ok(R.kfCount===2&&R.jump===2&&R.afterDel===1&&R.afterUndo===2,'the track has a diamond per key, a click jumps to it, Delete key removes one and Undo brings it back');
  ok(R.sAnim&&R.sAnim.dur===4&&R.sAnim.loop===1&&R.sKeys===2&&R.afterLoad===2&&R.keyVal===4,'the saved scene keeps length, loop and the keys, and loading restores them');
  ok(R.autoOn&&R.auto===1,'Auto key records an edit as a key at the playhead');
  ok(R.dupN===1&&near(R.dupX0,R.srcX0+.5,1e-6),'a duplicate carries its keys, moved with it');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}

 ok(ext.length===0,'nothing was requested from any other site except fonts ('+ext.slice(0,2).join(', ')+')');
 console.log(fails?'FAILED '+fails:'all passed');await b.close();process.exit(fails?1:0)})();
