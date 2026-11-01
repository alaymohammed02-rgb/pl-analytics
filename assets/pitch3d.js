/* ===== Pitch in 3D (experimental): a tilted pitch you can turn, with a pin standing on every point =====
   No library and no WebGL: the scene is plain elements in a CSS 3D context (perspective on the stage, `preserve-3d` on the world), so it costs little, works in every
   current browser and is easy to measure. Pins are placed in metres on the same 105 x 68 m pitch the 2D charts use (x along the pitch, y from the top touchline),
   their height is a real number the page chooses (and says so in its legend), and each pin faces the screen however you turn the pitch.
   Controls: drag (mouse or finger) to turn and tilt, the arrow keys do the same, "Reset view" puts it back. Reduced motion: no opening turn.
   Measuring it: the bar under the scene prints how long the scene took to build, how many elements it has and the frame rate while you drag.
   INS.pitch3d.mount(host, {pins:[{id,x,y,h,label,tip,cls,goal}], note}) -> {state, destroy}; INS.pitch3d.get() / set(on) keep the 2D / 3D choice (plx_3d). */
(function(){
 if(typeof INS!=='object')return;
 const W=105,H=68,K=8,PW=W*K,PH=H*K,RX0=58,RZ0=-24,RXMIN=24,RXMAX=80;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const reduce=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const get=()=>{try{return localStorage.getItem('plx_3d')==='1'}catch(e){return false}};
 const set=on=>{try{localStorage.setItem('plx_3d',on?'1':'0')}catch(e){}};
 const lines=()=>{
  const r=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  return `<svg class="p3-lines" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${PW}" height="${PH}" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width=".28">
   ${r(0,0,W,H)}<line x1="${W/2}" x2="${W/2}" y1="0" y2="${H}"/><circle cx="${W/2}" cy="${H/2}" r="9.15"/><circle cx="${W/2}" cy="${H/2}" r=".4" fill="currentColor"/>
   ${r(0,(H-40.32)/2,16.5,40.32)}${r(W-16.5,(H-40.32)/2,16.5,40.32)}${r(0,(H-18.32)/2,5.5,18.32)}${r(W-5.5,(H-18.32)/2,5.5,18.32)}
   <path d="M16.5 ${H/2-7.3}A9.15 9.15 0 0 1 16.5 ${H/2+7.3}"/><path d="M${W-16.5} ${H/2-7.3}A9.15 9.15 0 0 0 ${W-16.5} ${H/2+7.3}"/></g></svg>`;
 };
 function mount(host,o){
  o=o||{};const t0=performance.now();
  const pins=(o.pins||[]).filter(p=>p&&isFinite(p.x)&&isFinite(p.y));
  const st={rx:RX0,rz:RZ0,zoom:1,fps:null,drag:false};
  const pin=p=>{const h=Math.max(6,Math.min(170,+p.h||24));
   return `<div class="p3-pin ${p.cls||''}${p.goal?' p3-goal':''}" data-id="${String(p.id==null?'':p.id).replace(/[<>&"]/g,'')}" data-x="${(+p.x).toFixed(2)}" data-y="${(+p.y).toFixed(2)}" data-h="${h.toFixed(1)}" style="left:${(p.x*K).toFixed(1)}px;top:${(p.y*K).toFixed(1)}px;--h:${h.toFixed(1)}px">
    <i class="p3-sh"></i><i class="p3-st p3-st1"></i><i class="p3-st p3-st2"></i><b class="p3-hd"><i></i>${p.label?`<span>${String(p.label).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}</span>`:''}</b></div>`};
  host.innerHTML=`<div class="p3" data-p3="1"><div class="p3-stage" tabindex="0" role="application" aria-label="${x_(typeof ARL==='object'&&ARL.on?'ملعب ثلاثي الأبعاد: اسحب أو استخدم الأسهم للتدوير':'3D pitch: drag or use the arrow keys to turn it')}">
    <div class="p3-world"><div class="p3-pitch">${lines()}</div>${pins.map(pin).join('')}</div></div>
   <div class="p3-bar"><button type="button" class="p3-reset">${two('Reset view','إعادة الزاوية')}</button>
    <span class="p3-note mu">${o.note||''}</span><span class="p3-m mu" aria-live="off"></span></div></div>`;
  const root=host.querySelector('.p3'),stage=root.querySelector('.p3-stage'),world=root.querySelector('.p3-world'),m=root.querySelector('.p3-m');
  function apply(){
   const w=stage.clientWidth||PW,fit=Math.min(1,(w-8)/(PW*1.02));
   world.style.setProperty('--rx',st.rx.toFixed(2)+'deg');world.style.setProperty('--rz',st.rz.toFixed(2)+'deg');
   world.style.setProperty('--zm',(fit*st.zoom).toFixed(4));
   stage.style.height=Math.round(Math.max(260,Math.min(520,PH*fit*1.12+PW*fit*.20)))+'px';
  }
  const say=()=>{m.innerHTML=`${ar()?'بُني في':'built in'} ${nb(st.ms.toFixed(1)+' ms')} · ${nb(st.els)} ${ar()?'عنصر':'elements'}${st.fps!=null?` · ${nb(st.fps+' fps')} ${ar()?'أثناء السحب':'while dragging'}`:''}`};
  const ar=()=>typeof ARL==='object'&&!!ARL.on;
  apply();
  st.ms=performance.now()-t0;st.els=root.querySelectorAll('*').length;say();
  let ro=null;if(typeof ResizeObserver==='function'){ro=new ResizeObserver(apply);ro.observe(stage)}
  /* the opening turn: once, from a steep top view down to the resting angle */
  if(!reduce()&&pins.length){const a=performance.now(),from={rx:78,rz:-70};st.rx=from.rx;st.rz=from.rz;apply();
   const step=t=>{if(!root.isConnected||st.drag||st.skip)return;const k=Math.min(1,(t-a)/850),e=1-Math.pow(1-k,3);st.rx=from.rx+(RX0-from.rx)*e;st.rz=from.rz+(RZ0-from.rz)*e;apply();if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
  /* turning: drag or arrows */
  let last=null,frames=0,t1=0,raf=0;
  const clamp=()=>{st.rx=Math.max(RXMIN,Math.min(RXMAX,st.rx));st.rz=((st.rz+180)%360+360)%360-180};
  const tick=t=>{frames++;if(t-t1>=500){st.fps=Math.round(frames*1000/(t-t1));frames=0;t1=t;say()}if(st.drag)raf=requestAnimationFrame(tick)};
  stage.addEventListener('pointerdown',e=>{if(e.button&&e.button!==0)return;st.skip=true;st.drag=true;last=[e.clientX,e.clientY];frames=0;t1=performance.now();try{stage.setPointerCapture(e.pointerId)}catch(x){}stage.classList.add('p3-grab');raf=requestAnimationFrame(tick)});
  stage.addEventListener('pointermove',e=>{if(!st.drag||!last)return;st.rz+=(e.clientX-last[0])*.45;st.rx-=(e.clientY-last[1])*.35;last=[e.clientX,e.clientY];clamp();apply()});
  const up=()=>{if(!st.drag)return;st.drag=false;last=null;stage.classList.remove('p3-grab');cancelAnimationFrame(raf)};
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  stage.addEventListener('keydown',e=>{const d={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,6],ArrowDown:[0,-6]}[e.key];if(!d&&e.key!=='+'&&e.key!=='-')return;e.preventDefault();st.skip=true;
   if(d){st.rz+=d[0];st.rx+=d[1]}else st.zoom=Math.max(.6,Math.min(1.6,st.zoom*(e.key==='+'?1.1:1/1.1)));clamp();apply()});
  stage.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.shiftKey)return;e.preventDefault();st.zoom=Math.max(.6,Math.min(1.6,st.zoom*(e.deltaY<0?1.08:1/1.08)));apply()},{passive:false});
  root.querySelector('.p3-reset').onclick=()=>{st.skip=true;st.rx=RX0;st.rz=RZ0;st.zoom=1;apply()};
  const api={state:st,destroy(){if(ro)ro.disconnect();cancelAnimationFrame(raf);host.innerHTML=''},pins:pins.length};
  INS.pitch3d.last=api;return api;
 }
 const x_=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 INS.pitch3d={mount,get,set,K,W,H};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
