/* ===== Liquid Glass 3: a true lens over the chosen button =====
   Groups: the Fantasy tabs (#fproot > .ctl) and the menu drawer (#drw .drw-n).
   - A true lens: the glass shows exactly what lies under it (the buttons, half of one and half of the next when it sits
     between them, the section titles of the drawer), drawn from a copy of the group lined up with the page. Nothing in the
     copy is made up: every letter is placed where the browser drew the real one, in its font and colour.
   - Per-character magnification: while the glass moves, or while it is pressed, each letter under it is enlarged and pushed
     out from the centre (most in the middle, none at the rim, so the edge of the lens meets the page without a seam).
     Arabic is handled word by word, because splitting Arabic letters would break their joining.
   - Dynamic typography: the faster the glass goes, the stronger the lens and the heavier the letters; at rest both are off.
   - Physics: the glass is a spring. A new choice sends it straight to the new button in any direction, cutting across the
     buttons on the line, with a small overshoot; it stretches along the way it moves and squashes on arrival, and the letters
     of the new button land one after another. A choice made while it is still moving bends its path instead of restarting.
     Buttons near it grow a little (macOS Dock).
   - Play (Fantasy tabs): press the chosen tab and the glass lifts; drag it anywhere over the tabs and let go to choose the tab
     under it. With a mouse, the glass leans a little towards the tab you point at.
   Every bar of choice buttons has it, and every bar on a page has its own glass: the Fantasy tabs and the tab bars (.ins-tabs, .labtabs,
   .sbp-tabs), the bar of pages above every page (#hubbar, both rows of the Tactics hub), the level bar, the day strip of the Overview, the
   segmented choices (.seg, .hchips) and the home / draw / away choice of the season simulator. Single actions (save, share, example chips)
   are not groups and keep their own style. A bar whose buttons are other ones now (the pages of another group) shows its glass on the
   chosen button at once, without a slide.
   A group with fewer than two buttons keeps its normal style. With "reduce motion" the glass moves at once, without lens
   or springs. The buttons are not changed (their text, order and clicks stay as they are): an aria-hidden glass with
   pointer-events off is added on top, and a data attribute (not a class, so className stays as the page set it) marks the
   chosen button (data-lgx-act). */
(function(){
 if(!document.body||typeof MutationObserver==='undefined')return;
 const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ARS=/[\u0600-\u06FF]/,MAG=.08,AMAX=.36,LIFT=[1.1,1.2],MOVE={k:420,z:.72},DRAG={k:900,z:.85};
 const key=e=>e.getAttribute('href')||(e.dataset.cap?'cap':'')||e.getAttribute('onclick')||e.textContent;
 /* the kinds of group. Every bar on a page that matches a selector gets its own glass (the n-th match is the n-th instance, so
    a bar that is drawn again keeps its glass and the glass slides to the new choice). A group is a row of buttons (or links)
    of which one is the chosen one; single actions (save, share, a chip that asks something) are not groups. */
 const kids=t=>c=>[...c.children].filter(e=>e.tagName===t);
 const picked=e=>e.classList.contains('on')||e.getAttribute('aria-pressed')==='true';
 const SP=[
  {id:'fp',sel:'#fproot > .ctl',items:kids('BUTTON'),on:e=>!e.classList.contains('s'),rebuild:true,drag:true},
  {id:'ins',sel:'.ins-tabs',items:kids('BUTTON'),on:e=>!e.classList.contains('s'),rebuild:true,drag:true},
  {id:'lab',sel:'.labtabs',items:kids('BUTTON'),on:e=>e.classList.contains('on'),rebuild:true,drag:true},
  {id:'sbp',sel:'.sbp-tabs',items:kids('BUTTON'),on:e=>!e.classList.contains('s'),rebuild:true,drag:true},
  /* the bar of pages above every page: one row, or the two rows of the Tactics hub (groups, then the pages of the open group) */
  {id:'hub',sel:'#hubbar:not(.two), #hubbar .hb-g, #hubbar .hb-p',items:kids('A'),on:e=>e.classList.contains('on'),rebuild:true,drag:true},
  {id:'day',sel:'.mb-days',items:kids('BUTTON'),on:picked,rebuild:true,drag:true},
  {id:'seg',sel:'.seg:not(.labtabs)',items:kids('BUTTON'),on:picked,rebuild:true,drag:true},
  {id:'lvl',sel:'.lv-bar',items:kids('BUTTON'),on:picked,rebuild:true,drag:true},
  {id:'smf',sel:'.sm-fb',items:kids('BUTTON'),on:picked,rebuild:true,drag:true},
  {id:'drw',sel:'#drw .drw-n',items:c=>[...c.querySelectorAll('a[href^="#/"]')],on:e=>e.classList.contains('on'),rebuild:false,deco:c=>[...c.querySelectorAll('.drw-s h3')]}
 ],MAXN=24;
 const mk=(sp,n)=>Object.assign({},sp,{n,box:null,el:null,wb:null,wt:null,L:[],R:[],S:[],P:[],k:null,set:'',s:null,T:null,A:0,raf:0,last:0,ro:null,
  end:0,sig:'',dirty:true,mv:false,arr:false,d0:0,dir:[1,0],pd:null,lean:[0,0],hv:null,sup:0});
 const G=SP.map(sp=>mk(sp,0));
 const pick=g=>document.querySelectorAll(g.sel)[g.n]||null;
 /* one instance for each bar of a kind on the page (the first of each kind always exists) */
 function grow(){SP.forEach(sp=>{const cnt=Math.min(MAXN,document.querySelectorAll(sp.sel).length);
  let have=G.filter(g=>g.id===sp.id).length;while(have<cnt){G.push(mk(sp,have));have++}})}

 /* position of an item inside the group's box (layout only: the Dock scaling does not move it) */
 function rect(g,e){let x=0,y=0,n=e;while(n&&n!==g.box){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent}
  if(n)return {x,y,w:e.offsetWidth,h:e.offsetHeight};
  const b=g.box.getBoundingClientRect(),r=e.getBoundingClientRect();
  return {x:r.left-b.left-g.box.clientLeft+g.box.scrollLeft,y:r.top-b.top-g.box.clientTop+g.box.scrollTop,w:e.offsetWidth,h:e.offsetHeight}}
 /* the colour behind the group: the lens is painted on it, so the real labels under the glass do not show through twice */
 function under(n){for(;n&&n.nodeType===1;n=n.parentElement){const c=getComputedStyle(n).backgroundColor,m=c.match(/[\d.]+/g);if(m&&(m.length<4||+m[3]>0))return c}return ''}
 function stop(g){cancelAnimationFrame(g.raf);g.raf=0}
 function off(g){stop(g);if(g.el)g.el.remove();g.el=null;g.P=[];g.L=[];
  if(g.box){g.box.classList.remove('lgx','lgx-mv','lgx-d');g.items(g.box).forEach(e=>{['data-lgx-act','data-lgx-i'].forEach(a=>e.removeAttribute(a));e.style.scale=''})}}
 /* what the buttons say: read on every change of the page, so it must not force a layout (a width change is seen by the ResizeObserver) */
 const sigOf=(g,L)=>L.map(e=>e.textContent).join('\u0001');
 /* the box, its items and the glass; a rebuilt box gets a new glass (the spring keeps its state, so a move goes on) */
 function ensure(g){
  const box=pick(g);
  if(box!==g.box){if(g.ro)g.ro.disconnect();g.ro=null;stop(g);g.box=box;g.el=null;g.dirty=true}
  if(!box)return null;
  const L=g.items(box);
  if(L.length<2){off(g);return null}
  if(!g.el||g.el.parentNode!==box){
   box.classList.add('lgx');box.classList.toggle('lgx-d',!!g.drag);
   const el=document.createElement('div');el.className='lgx-g';el.setAttribute('aria-hidden','true');
   el.innerHTML='<div class="lgx-b"><div class="lgx-w lgx-wb"></div><div class="lgx-tn"></div><div class="lgx-w lgx-wt"></div></div>';
   /* a bar copied by the page brings the old glass with it: only the glass of this group stays */
   [...box.children].forEach(x=>{if(x.classList.contains('lgx-g'))x.remove()});
   box.appendChild(el);g.el=el;const b=el.firstChild;g.wb=b.children[0];g.wt=b.children[2];g.dirty=true;g.P=[];
   const c=under(box);if(c)el.style.setProperty('--lgx-base',c);
   if(window.ResizeObserver){if(g.ro)g.ro.disconnect();g.ro=new ResizeObserver(()=>{if(g.box!==box)return;g.dirty=true;if(!g.raf)rest(g)});g.ro.observe(box);L.forEach(e=>g.ro.observe(e))}
  }
  if(L.length!==g.L.length||L.some((e,i)=>e!==g.L[i]))g.dirty=true;
  L.forEach(e=>e.setAttribute('data-lgx-i',''));
  g.L=L;g.R=L.map(e=>rect(g,e));
  return L;
 }
 /* the copy of the group drawn inside the lens: each button's background, and each letter (each word in Arabic) and icon
    exactly where the browser drew it, with the same font and colour */
 function build(g,L){
  /* the colours are read as they end up, not half-way through the buttons' own colour transitions */
  const box=g.box;L.forEach(e=>{e.style.scale='';e.style.transition='none'});g.S=[];g.R=L.map(e=>rect(g,e));
  const B=box.getBoundingClientRect(),ox=B.left+box.clientLeft-box.scrollLeft,oy=B.top+box.clientTop-box.scrollTop;
  const P=[],fb=document.createDocumentFragment(),ft=document.createDocumentFragment(),R=document.createRange(),cs=new Map();
  const font=n=>{let c=cs.get(n);if(c==null){const k=getComputedStyle(n);
   c=`font:${k.fontStyle} ${k.fontWeight} ${k.fontSize}/1 ${k.fontFamily};letter-spacing:${k.letterSpacing};text-transform:${k.textTransform};color:${k.color};`;cs.set(n,c)}return c};
  const add=(f,x,y,w,h,css,it,O,pill)=>{const el=document.createElement('i');el.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px;`+css;
   f.appendChild(el);P.push({el,x,y,w,h,it,O,pill,on:0});return el};
  const texts=(root,it,O)=>{const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
   while((n=tw.nextNode())){const s=n.data;if(!s.trim()||!n.parentElement)continue;
    const re=ARS.test(s)?/\S+/g:/\S/gu;let m;
    while((m=re.exec(s))){R.setStart(n,m.index);R.setEnd(n,m.index+m[0].length);const r=R.getBoundingClientRect();if(!r.width||!r.height)continue;
     add(ft,r.left-ox,r.top-oy,r.width,r.height,font(n.parentElement)+`line-height:${r.height}px`,it,O,false).dataset.c=m[0]}}};
  L.forEach((e,i)=>{const r=g.R[i],c=getComputedStyle(e),to=c.transformOrigin.split(' ').map(parseFloat),O=[r.x+(to[0]||0),r.y+(to[1]||0)];
   add(fb,r.x,r.y,r.w,r.h,`background-color:${c.backgroundColor};background-image:${c.backgroundImage};border-top:${c.borderTop};border-right:${c.borderRight};border-bottom:${c.borderBottom};border-left:${c.borderLeft};border-radius:${c.borderRadius};box-shadow:${c.boxShadow}`,i,O,true);
   texts(e,i,O)});
  (g.deco?g.deco(box):[]).forEach(d=>{texts(d,-1,null);
   d.querySelectorAll('svg').forEach(v=>{const r=v.getBoundingClientRect();if(!r.width)return;
    const el=add(ft,r.left-ox,r.top-oy,r.width,r.height,`color:${getComputedStyle(v).color}`,-1,null,false),k=v.cloneNode(true);k.style.cssText='display:block;width:100%;height:100%';el.appendChild(k)})});
  L.forEach(e=>{e.style.transition=''});
  g.wb.replaceChildren(fb);g.wt.replaceChildren(ft);g.P=P;g.dirty=false;g.sig=sigOf(g,L);
 }
 /* where the spring is pulled to: the chosen button, or the pointer while dragging; bigger while pressed; leaning towards
    the button the mouse points at */
 function goal(g){const pd=g.pd,T=pd&&pd.drag?{x:pd.x,y:pd.y,w:pd.w,h:pd.h}:Object.assign({},g.T);
  if(pd){T.w*=LIFT[0];T.h*=LIFT[1]}T.x+=g.lean[0];T.y+=g.lean[1];return T}
 function step(s,T,dt,p){const c=2*p.z*Math.sqrt(p.k);
  for(const [q,v] of [['x','vx'],['y','vy'],['w','vw'],['h','vh']]){s[v]+=(p.k*(T[q]-s[q])-c*s[v])*dt;s[q]+=s[v]*dt}}
 const close=(s,T)=>Math.abs(T.x-s.x)<.6&&Math.abs(T.y-s.y)<.6&&Math.abs(T.w-s.w)<.6&&Math.abs(T.h-s.h)<.6&&Math.hypot(s.vx,s.vy)<25&&Math.abs(s.vw)+Math.abs(s.vh)<25;
 /* how long the spring takes to arrive from where it is now (the drawer waits for it before closing) */
 function sim(g){const s=Object.assign({},g.s),T=goal(g);let t=0;while(t<2&&!close(s,T)){for(let i=0;i<4;i++)step(s,T,1/240,MOVE);t+=1/60}return t*1000}
 /* draw the glass where the spring is: stretched along the way it moves, the copy shifted to line up with the page, every
    piece under the glass pushed through the lens, and the Dock growth of the buttons nearby */
 function render(g){const s=g.s,el=g.el;if(!el||!s)return;
  const ax=Math.abs(s.vx),ay=Math.abs(s.vy);
  const w=Math.max(4,s.w*(1+Math.min(.2,ax/4500)-Math.min(.07,ay/9000))),h=Math.max(4,s.h*(1+Math.min(.2,ay/4500)-Math.min(.07,ax/9000)));
  const gx=s.x-w/2,gy=s.y-h/2,st=el.style;
  st.transform=`translate(${gx.toFixed(2)}px,${gy.toFixed(2)}px)`;st.width=w.toFixed(2)+'px';st.height=h.toFixed(2)+'px';
  const wt=`translate(${(-gx).toFixed(2)}px,${(-gy).toFixed(2)}px)`;g.wb.style.transform=wt;g.wt.style.transform=wt;
  const A=g.A;g.wt.style.setProperty('--wt',Math.min(.7,A*1.8).toFixed(2)+'px');
  const kd=Math.min(1,A/.18),rad=s.h*2.6,S=g.S;
  g.R.forEach((r,i)=>{const inside=s.x>=r.x&&s.x<=r.x+r.w&&s.y>=r.y&&s.y<=r.y+r.h;
   let v=inside||kd<.01?1:1+MAG*kd*Math.max(0,1-Math.hypot(r.x+r.w/2-s.x,r.y+r.h/2-s.y)/rad);if(v<1.001)v=1;
   if(v!==S[i]){S[i]=v;g.L[i].style.scale=v>1?v.toFixed(3):''}});
  const hw=w/2,hh=h/2,cx=s.x,cy=s.y,x0=gx-2,x1=gx+w+2,y0=gy-2,y1=gy+h+2;
  /* the lens: a point at (normalised) distance d from the centre moves out by m = 1+A(1-d²)²; a letter there is scaled by the
     local stretch of that map along each axis (m - 4A(1-d²)u², u its normalised offset on that axis), so near the rim letters
     are squeezed across the rim (as in a real lens) and never overlap */
  let kx=1,ky=1;const M=(px,py)=>{const u=(px-cx)/hw,v=(py-cy)/hh,r=u*u+v*v;if(r>=1){kx=ky=1;return 1}const q=1-r,m=1+A*q*q;
   kx=m-4*A*q*u*u;ky=m-4*A*q*v*v;return m};
  for(const p of g.P){const sc=p.it>=0?S[p.it]||1:1;let l=p.x,t=p.y,r=p.x+p.w,b=p.y+p.h;
   if(sc!==1){const O=p.O;l=O[0]+(l-O[0])*sc;r=O[0]+(r-O[0])*sc;t=O[1]+(t-O[1])*sc;b=O[1]+(b-O[1])*sc}
   if(r<x0||l>x1||b<y0||t>y1||(A<.002&&sc===1)){if(p.on){p.el.style.translate='';p.el.style.scale='';p.on=0}continue}
   let tx,ty,sx,sy;
   if(p.pill){const my=Math.max(t,Math.min(b,cy)),mx=Math.max(l,Math.min(r,cx)),
     L2=cx+(l-cx)*M(l,my),R2=cx+(r-cx)*M(r,my),T2=cy+(t-cy)*M(mx,t),B2=cy+(b-cy)*M(mx,b);
    tx=(L2+R2)/2-(p.x+p.w/2);ty=(T2+B2)/2-(p.y+p.h/2);sx=(R2-L2)/p.w;sy=(B2-T2)/p.h}
   else{const qx=(l+r)/2,qy=(t+b)/2,m=M(qx,qy);tx=cx+(qx-cx)*m-(p.x+p.w/2);ty=cy+(qy-cy)*m-(p.y+p.h/2);sx=sc*kx;sy=sc*ky}
   p.el.style.translate=`${tx.toFixed(2)}px ${ty.toFixed(2)}px`;p.el.style.scale=`${sx.toFixed(4)} ${sy.toFixed(4)}`;p.on=1}
 }
 /* the letters of the new button land one after another, from the side the glass came from */
 function pop(g){const i=g.L.findIndex(e=>e.hasAttribute('data-lgx-act'));if(i<0)return;
  const Q=g.P.filter(p=>p.it===i&&!p.pill).sort((a,b)=>(a.x*g.dir[0]+a.y*g.dir[1])-(b.x*g.dir[0]+b.y*g.dir[1])),stg=Math.min(18,220/Math.max(1,Q.length));
  Q.forEach(p=>p.el.classList.remove('pop'));if(Q.length)void Q[0].el.offsetWidth;
  Q.forEach((p,k)=>{p.el.style.setProperty('--i',k);p.el.style.setProperty('--st',stg.toFixed(1)+'ms');p.el.classList.add('pop')})}
 function settle(g){const T=goal(g);Object.assign(g.s,{x:T.x,y:T.y,w:T.w,h:T.h,vx:0,vy:0,vw:0,vh:0});g.A=0;
  if(g.dirty&&g.L.length)build(g,g.L);
  if(g.mv){g.mv=false;g.el.classList.remove('mv');g.box.classList.remove('lgx-mv');if(g.arr){g.arr=false;pop(g)}}
  render(g)}
 function loop(g){if(g.raf||!g.el)return;g.last=0;
  const f=ts=>{g.raf=0;if(!g.box||!g.el||!g.box.isConnected||!g.s)return;
   const dt=g.last?Math.min(.05,(ts-g.last)/1000):1/60;g.last=ts;
   const T=goal(g),p=g.pd&&g.pd.drag?DRAG:MOVE,n=Math.max(1,Math.ceil(dt*240));for(let i=0;i<n;i++)step(g.s,T,dt/n,p);
   const sp=Math.hypot(g.s.vx,g.s.vy),At=g.pd?AMAX:Math.min(AMAX,sp/1800*AMAX);g.A+=(At-g.A)*(1-Math.exp(-dt*(At>g.A?26:20)));
   if(g.arr&&g.A<.1&&Math.hypot(T.x-g.s.x,T.y-g.s.y)<Math.max(6,g.d0*.12)){g.arr=false;pop(g)}
   if(!g.pd&&close(g.s,T)&&g.A<.012){settle(g);return}
   render(g);g.raf=requestAnimationFrame(f)};
  g.raf=requestAnimationFrame(f)}
 const kick=g=>{if(g.el&&g.s&&!RM())loop(g)};
 /* the glass at rest on the chosen item, at once */
 function rest(g){const L=ensure(g);if(!L)return;const a=L.find(g.on);if(!a){g.el.style.opacity='0';return}
  stop(g);if(!a.hasAttribute('data-lgx-act')||L.some(e=>e!==a&&e.hasAttribute('data-lgx-act'))){L.forEach(e=>e.toggleAttribute('data-lgx-act',e===a));g.dirty=true}
  if(g.dirty||!g.P.length)build(g,L);
  const r=g.R[L.indexOf(a)];g.T={x:r.x+r.w/2,y:r.y+r.h/2,w:r.w,h:r.h};g.s={x:g.T.x,y:g.T.y,w:r.w,h:r.h,vx:0,vy:0,vw:0,vh:0};
  g.A=0;g.lean=[0,0];g.pd=null;g.el.style.borderRadius=getComputedStyle(a).borderRadius;g.el.style.opacity='1';
  g.mv=false;g.arr=false;g.el.classList.remove('mv','up','drag');g.box.classList.remove('lgx-mv');render(g);g.k=key(a);g.set=L.map(key).join('\u0001')}
 /* a new choice in a group: the spring takes the glass from wherever it is (moving or not) to the new item */
 function update(g,animate){
  const L=ensure(g);if(!L)return;const b=L.find(g.on);if(!b){rest(g);return}
  /* a bar whose buttons are other ones now (the pages of another group, another level) is a new bar, not a move */
  const k=key(b),same=g.set===L.map(key).join('\u0001'),moved=g.k!=null&&k!==g.k&&same,busy=g.mv||!!g.pd||g.A>.012||!!(g.s&&g.T&&!close(g.s,goal(g)));
  if(!animate||RM()||!g.s||!same||!(moved||busy)){rest(g);return}
  /* a new choice, or the same one in a rebuilt box while the glass is still on its way: draw the copy again and go on */
  if(moved||L.some(e=>(e===b)!==e.hasAttribute('data-lgx-act'))){L.forEach(e=>e.toggleAttribute('data-lgx-act',e===b));g.dirty=true}
  if(g.dirty)build(g,L);
  const r=g.R[L.indexOf(b)],s=g.s;g.T={x:r.x+r.w/2,y:r.y+r.h/2,w:r.w,h:r.h};g.k=k;
  g.el.style.borderRadius=getComputedStyle(b).borderRadius;g.el.style.opacity='1';
  if(moved){g.lean=[0,0];g.hv=null;const dx=g.T.x-s.x,dy=g.T.y-s.y,d=Math.hypot(dx,dy)||1;g.dir=[dx/d,dy/d];g.d0=d;g.mv=true;g.arr=true;g.end=performance.now()+sim(g)}
  if(g.mv){g.el.classList.add('mv');g.box.classList.add('lgx-mv')}
  if(g.pd)g.el.classList.add('up');
  render(g);kick(g)}
 function tick(){grow();G.forEach(g=>{const bx=pick(g);
  if(!bx){if(g.box){stop(g);if(g.ro)g.ro.disconnect();g.ro=null;g.box=null;g.el=null;g.mv=false;g.pd=null;g.L=[]}return}
  if(bx!==g.box||!g.el||g.el.parentNode!==bx){update(g,g.rebuild&&g.k!=null);return}
  const L=g.items(bx),a=L.find(g.on);if(a?key(a)!==g.k:g.k!=null){update(g,true);return}
  if(!g.raf&&L.length>1&&sigOf(g,L)!==g.sig){g.dirty=true;rest(g)}})}
 /* runs before the next paint, so a rebuilt tab bar never shows without its glass; text changes (a language switch) too */
 new MutationObserver(ms=>{if(ms.every(m=>{const t=m.target.nodeType===1?m.target:m.target.parentElement;return t&&t.closest&&t.closest('.lgx-g')}))return;tick()})
  .observe(document.body,{childList:true,subtree:true,characterData:true});
 /* colours, language or fonts that change under the copy: draw it again */
 const redo=()=>G.forEach(g=>{g.dirty=true;if(g.box&&!g.raf)rest(g)});
 new MutationObserver(redo).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme','lang','dir']});
 if(document.fonts){document.fonts.ready.then(redo);if(document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',redo)}
 try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redo)}catch(e){}
 /* the drawer: the chosen link moves at once, the glass travels to it, and the drawer closes when it has arrived
    (the page itself opens straight away behind it) */
 document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('#drw a[href^="#/"]');if(!a||a.classList.contains('on'))return;
  const g=G.find(x=>x.id==='drw'),L=ensure(g);if(!L)return;
  L.forEach(x=>{const on=x===a;x.classList.toggle('on',on);if(on)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
  update(g,true)},true);
 /* ---- play: press, drag and let go (groups with drag), and the lean towards the pointed tab ---- */
 const inBox=(g,cx,cy)=>{const b=g.box.getBoundingClientRect();return [cx-b.left-g.box.clientLeft+g.box.scrollLeft,cy-b.top-g.box.clientTop+g.box.scrollTop]};
 const nearest=(g,x,y)=>{let bi=0,bd=1/0;g.R.forEach((r,i)=>{const d=Math.hypot(Math.max(r.x-x,0,x-r.x-r.w),Math.max(r.y-y,0,y-r.y-r.h));if(d<bd){bd=d;bi=i}});return bi};
 function aim(g,cx,cy){let [x,y]=inBox(g,cx,cy);const C=g.R.map(r=>[r.x+r.w/2,r.y+r.h/2]);
  x=Math.max(Math.min(...C.map(c=>c[0]))-12,Math.min(Math.max(...C.map(c=>c[0]))+12,x));y=Math.max(Math.min(...C.map(c=>c[1]))-8,Math.min(Math.max(...C.map(c=>c[1]))+8,y));
  const r=g.R[nearest(g,x,y)];Object.assign(g.pd,{x,y,w:r.w,h:r.h})}
 const own=e=>{const it=e.target&&e.target.closest&&e.target.closest('[data-lgx-i]');if(!it)return null;const g=G.find(g=>g.drag&&g.box&&g.el&&g.box.contains(it));return g?[g,it]:null};
 /* a link is dragged by the browser (a ghost of the link, and the pointer events stop): in a bar with the glass it is the glass that is dragged */
 document.addEventListener('dragstart',e=>{const it=e.target&&e.target.closest&&e.target.closest('.lgx-d [data-lgx-i]');if(it)e.preventDefault()},true);
 document.addEventListener('pointerdown',e=>{if(e.button!==0||RM())return;const h=own(e);if(!h)return;const [g,it]=h;
  if(!it.hasAttribute('data-lgx-act')||!g.s)return;
  g.pd={id:e.pointerId,x0:e.clientX,y0:e.clientY,drag:false,x:0,y:0,w:0,h:0};g.el.classList.add('up');kick(g)},true);
 document.addEventListener('pointermove',e=>{G.forEach(g=>{const pd=g.pd;
  if(pd&&pd.id===e.pointerId){if(!g.box||!g.box.isConnected){g.pd=null;return}
   if(!pd.drag&&Math.hypot(e.clientX-pd.x0,e.clientY-pd.y0)>6){pd.drag=true;g.el.classList.add('drag')}
   if(pd.drag){aim(g,e.clientX,e.clientY);kick(g)}return}
  if(!g.drag||g.pd||e.pointerType!=='mouse'||!g.box||!g.el||!g.T||RM())return;
  const it=e.target&&e.target.closest&&e.target.closest('[data-lgx-i]'),t=it&&g.box.contains(it)&&!it.hasAttribute('data-lgx-act')?it:null;
  if(t===g.hv)return;g.hv=t;
  if(t){const r=g.R[g.L.indexOf(t)];if(!r)return;const dx=r.x+r.w/2-g.T.x,dy=r.y+r.h/2-g.T.y,d=Math.hypot(dx,dy)||1;g.lean=[dx/d*5,dy/d*5]}else g.lean=[0,0];
  kick(g)})},{passive:true});
 const up=(e,cancel)=>G.forEach(g=>{const pd=g.pd;if(!pd||pd.id!==e.pointerId)return;g.pd=null;if(g.el)g.el.classList.remove('up','drag');
  if(pd.drag&&!cancel&&g.box&&g.box.isConnected){const it=g.L[nearest(g,g.s.x,g.s.y)];
   if(it&&!it.hasAttribute('data-lgx-act'))it.click();
   /* the browser's own click that follows the drag is not a choice */
   g.sup=1;setTimeout(()=>{g.sup=0},60)}
  kick(g)});
 document.addEventListener('pointerup',e=>up(e,false),true);
 document.addEventListener('pointercancel',e=>up(e,true),true);
 window.addEventListener('click',e=>{if(G.some(g=>g.sup)){G.forEach(g=>{g.sup=0});e.preventDefault();e.stopImmediatePropagation()}},true);
 window.lgxHold=()=>{const g=G.find(x=>x.id==='drw');return g.mv?Math.max(0,g.end-performance.now())+120:0};
 /* for the tests: park a group's glass at a point (no animation) with the lens on, to look at what it shows there */
 window.LGX={groups:G,tick,pose:(id,x,y,k)=>{const g=G.find(q=>q.id===id);if(!g||!g.s||!g.el)return false;stop(g);Object.assign(g.s,{x,y,vx:0,vy:0});g.A=k==null?.3:k;g.mv=true;g.el.classList.add('mv');render(g);return true}};
 tick();
})();
