/* ===== League switch: the kick-off (the moment a visitor picks another league in the header) =====
   The one staged moment of the site. The floodlights dim, a chalk circle opens from the league picker and carries the new league's light across the page, the
   league's name stands in the scoreboard face on the centre spot, and the lights come back up on the new league's colours. It lasts as long as the league's
   data takes to load (0.75 s at least, 5 s at most) and then fades.
   It is a picture only: one fixed layer with pointer events off and aria-hidden (the picker itself tells a screen reader what was chosen), nothing on the page
   is moved, resized or blocked, and the page under it is loaded exactly as before. With reduced motion nothing is shown. INS.leagueSwitch is for the tests. */
(function(){
 if(typeof document==='undefined')return;
 const ST={n:0,last:null,el:null,timer:null};
 const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
 const colour=id=>{try{if(typeof thLeaguePal==='function'){const p=thLeaguePal(id);if(p&&p.hi)return p.hi}}catch(e){}
  return getComputedStyle(document.documentElement).getPropertyValue('--th-hi').trim()||'#4cc38a'};
 function clear(){if(ST.timer){clearInterval(ST.timer);ST.timer=null}if(ST.el&&ST.el.parentNode)ST.el.parentNode.removeChild(ST.el);ST.el=null}
 function play(sel){
  const id=sel.value,opt=sel.options[sel.selectedIndex],name=opt?opt.textContent.trim():'';
  ST.n++;ST.last={id,name,t:Date.now(),shown:false};
  if(reduced()||!document.body)return;
  clear();
  const r=sel.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,W=innerWidth,H=innerHeight;
  const far=Math.ceil(Math.max(Math.hypot(x,y),Math.hypot(W-x,y),Math.hypot(x,H-y),Math.hypot(W-x,H-y)))+8;
  const el=document.createElement('div');el.id='lgsw';el.setAttribute('aria-hidden','true');el.dataset.lg=id;
  el.style.setProperty('--sw-x',x+'px');el.style.setProperty('--sw-y',y+'px');el.style.setProperty('--sw-r',far+'px');el.style.setProperty('--sw-c',colour(id));
  const veil=document.createElement('i');veil.className='sw-veil';
  const ring=document.createElement('i');ring.className='sw-ring';
  const card=document.createElement('div');card.className='sw-card';
  const nm=document.createElement('b');nm.className='sw-name';nm.textContent=name;
  const mk=document.createElement('i');mk.className='sw-mark';
  card.appendChild(nm);card.appendChild(mk);el.appendChild(veil);el.appendChild(ring);el.appendChild(card);
  document.body.appendChild(el);ST.el=el;ST.last.shown=true;
  /* the next frame starts the opening; the end waits for the league's data */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(ST.el===el)el.classList.add('in')}));
  const t0=Date.now();
  const end=()=>{if(ST.el!==el)return;if(ST.timer){clearInterval(ST.timer);ST.timer=null}el.classList.add('out');setTimeout(()=>{if(ST.el===el)clear()},460)};
  ST.timer=setInterval(()=>{const dt=Date.now()-t0,ready=typeof D==='object'&&D&&D.id===id;if((ready&&dt>=750)||dt>=5000)end()},60);
 }
 document.addEventListener('change',e=>{const t=e.target;if(t&&t.id==='lgpick'&&t.tagName==='SELECT'){try{play(t)}catch(x){clear()}}},true);
 if(typeof INS==='object'&&INS)INS.leagueSwitch={state:()=>({n:ST.n,last:ST.last,on:!!ST.el}),clear};
})();
