/* ===== Liquid Glass 2: a glass lens over the chosen button that travels through the buttons in between =====
   Groups: the Fantasy tabs (#fproot > .ctl) and the menu drawer (#drw .drw-n). A new choice sends the glass along the
   buttons in reading order (row by row, as a finger would run along them), not straight across. On its way:
   - Magnification: the label under the glass is drawn larger inside it (a lens), and the buttons near the glass grow a
     little, less with distance (like the macOS Dock).
   - Per-character animation: the lens label is rebuilt for every button it passes, its letters arriving one after another
     in the direction of travel. Arabic goes word by word, because splitting Arabic letters would break their joining.
   - Dynamic typography: while moving, the lens label is heavier and a little wider; it settles when the glass stops.
   A group with fewer than two buttons keeps its normal style (the glass needs somewhere to go). With "reduce motion" the
   glass moves at once and nothing animates. The buttons are not changed (their text, order and clicks stay as they are):
   an aria-hidden glass with pointer-events off is added on top, and data attributes (not classes, so className stays as the
   page set it) mark the chosen button (data-lgx-act) and the one covered (data-lgx-on). */
(function(){
 if(!document.body||typeof MutationObserver==='undefined')return;
 const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ARS=/[\u0600-\u06FF]/,MAG=.08;
 const ex=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 const key=e=>e.getAttribute('href')||(e.dataset.cap?'cap':'')||e.getAttribute('onclick')||e.textContent;
 const G=[
  {id:'fp',sel:'#fproot > .ctl',items:c=>[...c.children].filter(e=>e.tagName==='BUTTON'),on:e=>!e.classList.contains('s'),max:1150,rebuild:true},
  {id:'drw',sel:'#drw .drw-n',items:c=>[...c.querySelectorAll('a[href^="#/"]')],on:e=>e.classList.contains('on'),max:600,rebuild:false,start:true}
 ].map(g=>Object.assign(g,{box:null,el:null,b:null,t:null,k:null,anim:null,raf:0,ro:null,end:0,path:null,cov:null}));

 /* position of an item inside the group's box (layout only: the Dock scaling does not move it) */
 function rect(g,e){let x=0,y=0,n=e;while(n&&n!==g.box){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent}
  if(n)return {x,y,w:e.offsetWidth,h:e.offsetHeight};
  const b=g.box.getBoundingClientRect(),r=e.getBoundingClientRect();
  return {x:r.left-b.left-g.box.clientLeft+g.box.scrollLeft,y:r.top-b.top-g.box.clientTop+g.box.scrollTop,w:e.offsetWidth,h:e.offsetHeight}}
 function off(g){stop(g);if(g.el)g.el.remove();g.el=null;
  if(g.box){g.box.classList.remove('lgx','lgx-mv','lgx-s');g.items(g.box).forEach(e=>{['data-lgx-on','data-lgx-act','data-lgx-i'].forEach(a=>e.removeAttribute(a));e.style.scale=''})}}
 /* the box, its items and the glass; a rebuilt box gets a new glass */
 function ensure(g){
  const box=document.querySelector(g.sel);
  if(box!==g.box){if(g.ro)g.ro.disconnect();g.ro=null;stop(g);g.box=box;g.el=null}
  if(!box)return null;
  const L=g.items(box);
  if(L.length<2){off(g);return null}
  if(!g.el||g.el.parentNode!==box){
   box.classList.add('lgx');box.classList.toggle('lgx-s',!!g.start);
   const el=document.createElement('div');el.className='lgx-g';el.setAttribute('aria-hidden','true');
   el.innerHTML='<div class="lgx-b"><span class="lgx-t"></span></div>';box.appendChild(el);
   g.el=el;g.b=el.firstChild;g.t=g.b.firstChild;g.cov=null;
   if(window.ResizeObserver){if(g.ro)g.ro.disconnect();g.ro=new ResizeObserver(()=>{if(!g.anim&&g.box===box)rest(g)});g.ro.observe(box);L.forEach(e=>g.ro.observe(e))}
  }
  L.forEach(e=>e.setAttribute('data-lgx-i',''));
  return L;
 }
 function look(g,e){const c=getComputedStyle(e),t=g.t.style;g.el.style.borderRadius=c.borderRadius;
  t.fontSize=c.fontSize;t.fontFamily=c.fontFamily;t.lineHeight=c.lineHeight;t.paddingInlineStart=c.paddingInlineStart;t.paddingInlineEnd=c.paddingInlineEnd}
 function box(g,r){const s=g.el.style;s.width=r.w+'px';s.height=r.h+'px';s.transform=`translate(${r.x}px,${r.y}px)`}
 /* the label inside the lens, one span per letter (per word in Arabic), numbered in the direction of travel */
 function lens(g,e,dir,pop){
  const s=(e.innerText||e.textContent||'').trim();
  if(g.t.dataset.s===s&&!pop)return;g.t.dataset.s=s;
  const P=ARS.test(s)?s.split(/(\s+)/).filter(Boolean):Array.from(s),n=P.length;
  g.t.innerHTML=P.map((p,i)=>/^\s+$/.test(p)?'<span class="lgx-c lgx-sp">&nbsp;</span>':`<span class="lgx-c" style="--i:${dir<0?n-1-i:i}">${ex(p)}</span>`).join('');
  /* while moving the glass stays on a button for less than a tenth of a second: the letters arrive fast enough to be read */
  const fast=!!g.anim;g.t.style.setProperty('--st',(fast?Math.min(8,50/n):Math.min(18,220/n)).toFixed(1)+'ms');
  g.t.classList.remove('pop','fast');if(pop&&!RM()){void g.t.offsetWidth;g.t.classList.add('pop');if(fast)g.t.classList.add('fast')}
 }
 /* width of each label as the lens draws it while moving (heavier, wider spaced), without padding */
 function widths(g,P){const m=document.createElement('span');m.style.cssText='position:absolute;visibility:hidden;white-space:pre;font-weight:800;letter-spacing:.02em';
  const c=g.t.style;m.style.fontSize=c.fontSize;m.style.fontFamily=c.fontFamily;g.b.appendChild(m);
  const W=P.map(e=>{m.textContent=(e.innerText||e.textContent||'').trim();return m.offsetWidth});m.remove();return W}
 function cover(g,e){if(g.cov===e)return;if(g.cov)g.cov.removeAttribute('data-lgx-on');g.cov=e;if(e){e.setAttribute('data-lgx-on','');e.style.scale=''}}
 function unmag(g){if(!g.box)return;g.box.classList.remove('lgx-mv');g.items(g.box).forEach(e=>{e.style.scale=''})}
 /* stop any movement of the group's glass (its page went away, or a new move starts) */
 function stop(g){if(g.anim){g.anim.cancel();g.anim=null}if(g.ta){g.ta.cancel();g.ta=null}cancelAnimationFrame(g.raf)}
 /* the glass at rest on the chosen item */
 function rest(g){const L=ensure(g);if(!L)return;const a=L.find(g.on);if(!a){g.el.style.opacity='0';cover(g,null);return}
  stop(g);
  const r=rect(g,a);look(g,a);box(g,r);g.el.style.opacity='1';g.el.classList.remove('mv');unmag(g);
  L.forEach(e=>e.toggleAttribute('data-lgx-act',e===a));lens(g,a,1,false);cover(g,a);g.k=key(a)}
 /* the glass travels from item a to item b through every item in between, at an even speed along the path */
 function travel(g,L,a,b){
  stop(g);
  const st=a<b?1:-1,P=[];for(let i=a;i!==b+st;i+=st)P.push(L[i]);
  const R=P.map(e=>rect(g,e)),c=r=>[r.x+r.w/2,r.y+r.h/2],D=[0];
  for(let i=1;i<R.length;i++){const p=c(R[i-1]),q=c(R[i]);D.push(D[i-1]+Math.hypot(q[0]-p[0],q[1]-p[1]))}
  const tot=D[D.length-1];if(!tot){rest(g);return}
  const dur=Math.min(g.max,Math.max(320,240+(R.length-1)*85));
  L.forEach(e=>e.toggleAttribute('data-lgx-act',e===L[b]));look(g,L[b]);g.el.style.opacity='1';
  box(g,R[R.length-1]);g.el.classList.add('mv');g.box.classList.add('lgx-mv');
  g.anim=g.el.animate(R.map((r,i)=>({transform:`translate(${r.x}px,${r.y}px)`,width:r.w+'px',height:r.h+'px',offset:D[i]/tot})),
   {duration:dur,easing:'cubic-bezier(.42,0,.2,1)'});
  g.end=performance.now()+dur;g.path={P,R,dir:st,j:-1,k:0,A:L.map(e=>[e,rect(g,e)])};
  /* magnification of the lens label: up to 1.14× over each button, never wider than the glass is there; at the half-way
     points the label changes, so the scale fits both; normal size at both ends. Same timing as the glass, so in step. */
  if(g.t.animate){const TW=widths(g,P),fit=(w,i)=>(w-8)/((TW[i]||1)*1.12),K=[];
   R.forEach((r,i)=>{if(i){const m=(R[i-1].w+r.w)/2;K.push({transform:`scale(${Math.max(.5,Math.min(1.14,fit(m,i-1),fit(m,i))).toFixed(3)})`,offset:(D[i-1]+D[i])/2/tot})}
    K.push({transform:`scale(${i&&i<R.length-1?Math.max(.5,Math.min(1.14,fit(r.w,i))).toFixed(3):1})`,offset:D[i]/tot})});
   if(g.ta)g.ta.cancel();g.ta=g.t.animate(K,{duration:dur,easing:'cubic-bezier(.42,0,.2,1)'})}
  lens(g,P[0],st,false);cover(g,P[0]);g.path.j=0;
  /* where the glass is, read from what is drawn (its animated width and position); the button under it is looked for only
     ahead of the current one, so the lens never goes back */
  const f=()=>{if(!g.anim||!g.box)return;
   const W=g.el.offsetWidth,H=g.el.offsetHeight,m=new DOMMatrixReadOnly(getComputedStyle(g.el).transform),cx=m.m41+W/2,cy=m.m42+H/2;
   /* its centre moves along the line joining the buttons' centres: find its segment (from the current one on) and how far along */
   let kb=g.path.k,ub=0,bd=1e9;for(let k=g.path.k;k<Math.min(R.length-1,g.path.k+6);k++){const a=c(R[k]),z=c(R[k+1]),vx=z[0]-a[0],vy=z[1]-a[1],L2=vx*vx+vy*vy||1;
    const u=Math.max(0,Math.min(1,((cx-a[0])*vx+(cy-a[1])*vy)/L2)),d=Math.hypot(a[0]+vx*u-cx,a[1]+vy*u-cy);if(d<bd-.5){bd=d;kb=k;ub=u}}
   g.path.k=kb;const j=Math.max(g.path.j,ub<.5?kb:kb+1);
   if(j!==g.path.j){g.path.j=j;lens(g,P[j],st,true);cover(g,P[j])}
   const rad=H*2.6;
   g.path.A.forEach(([e,r])=>{if(e===g.cov)return;const d=Math.hypot(r.x+r.w/2-cx,r.y+r.h/2-cy),s=1+MAG*Math.max(0,1-d/rad);e.style.scale=s>1.001?s.toFixed(3):''});
   g.raf=requestAnimationFrame(f)};
  g.raf=requestAnimationFrame(f);
  /* on arrival: measured again (a label may have been translated on the way), the letters of the label land, the glass wobbles */
  const an=g.anim;an.onfinish=()=>{if(g.anim!==an||!g.el||!g.box)return;g.anim=null;rest(g);lens(g,L[b],st,true);
   if(g.b.animate)g.b.animate([{transform:'scale(1.07,.9)'},{transform:'scale(.97,1.04)',offset:.55},{transform:'none'}],{duration:340,easing:'ease-out'})};
  g.k=key(L[b]);
 }
 /* a new choice in a group: travel from the previous one when it is still there, otherwise rest on the new one */
 function update(g,animate){
  const L=ensure(g);if(!L)return;const b=L.findIndex(g.on);if(b<0){rest(g);return}
  const a=g.k!=null&&g.k!==key(L[b])?L.findIndex(e=>key(e)===g.k):-1;
  if(animate&&a>=0&&!RM()&&g.el.animate)travel(g,L,a,b);else rest(g);
 }
 function tick(){G.forEach(g=>{const bx=document.querySelector(g.sel);
  if(!bx){if(g.box){stop(g);if(g.ro)g.ro.disconnect();g.ro=null;g.box=null;g.el=null}return}
  if(bx!==g.box||!g.el||g.el.parentNode!==bx){update(g,g.rebuild&&g.k!=null);return}
  const a=g.items(bx).find(g.on);if(a?key(a)!==g.k:g.k!=null)update(g,true)})}
 /* runs before the next paint, so a rebuilt tab bar never shows without its glass */
 new MutationObserver(ms=>{if(ms.every(m=>m.target.closest&&m.target.closest('.lgx-g')))return;tick()}).observe(document.body,{childList:true,subtree:true});
 /* the drawer: the chosen link moves at once, the glass travels to it, and the drawer closes when it has arrived
    (the page itself opens straight away behind it) */
 document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('#drw a[href^="#/"]');if(!a||a.classList.contains('on'))return;
  const g=G[1],L=ensure(g);if(!L)return;
  L.forEach(x=>{const on=x===a;x.classList.toggle('on',on);if(on)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
  update(g,true)},true);
 window.lgxHold=()=>{const g=G[1];return g.anim?Math.max(0,g.end-performance.now())+120:0};
 window.LGX={groups:G,tick};
 tick();
})();
