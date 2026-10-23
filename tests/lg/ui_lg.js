/* Liquid Glass 3 (assets/liquid-glass.js): a true lens on a spring.
   - At rest the glass covers the chosen button exactly, and the copy drawn inside it puts every letter where the browser drew
     the real one (worked out here independently with a Range per letter), in the real colours.
   - A new choice: the glass centre stays on the straight line between the two buttons, it arrives in under 0.7 s (0.65 s in
     the drawer) and stops exactly on the button; while moving the lens shows the pieces of two buttons at once (half of one,
     half of the next), magnified inside the glass and not outside it; at rest nothing is magnified and the Dock growth is
     cleared.
   - Letters in English, words in Arabic (never a single Arabic letter).
   - Play: pressing the chosen tab lifts the glass; dragging it follows the pointer; letting go over a tab chooses it (mouse
     and touch); letting go over the same tab changes nothing.
   - The copy follows changes: a label that changes, and the theme colours.
   - The drawer: the page opens at once, the drawer closes once the glass has arrived, section titles and icons are in the copy.
   - Reduced motion jumps and does not lift; a lone button gets no glass; clicks reach the buttons; 390 px; no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const near=(a,b,t)=>Math.abs(a-b)<=(t||1.5);
const glassOn=sel=>{const c=document.querySelector(sel),g=c&&c.querySelector('.lgx-g');if(!g)return null;
 const L=[...c.querySelectorAll('[data-lgx-i]')],a=L.find(e=>e.hasAttribute('data-lgx-act'));
 const gb=g.getBoundingClientRect(),ab=a&&a.getBoundingClientRect();
 return {g:[gb.left,gb.top,gb.width,gb.height],a:ab&&[ab.left,ab.top,ab.width,ab.height],label:a&&a.innerText.trim(),op:getComputedStyle(g).opacity,
  scaled:L.filter(e=>e.style.scale).length,n:L.length,lensed:[...g.querySelectorAll('.lgx-w>i')].filter(i=>i.style.scale).length,up:g.classList.contains('up')}};
/* the copy at rest: for every visible letter (word in Arabic) of every button, a piece with that text at the same place */
const copyOk=sel=>{const c=document.querySelector(sel),g=c.querySelector('.lgx-g'),P=[...g.querySelectorAll('.lgx-wt>i')].map(i=>({c:i.dataset.c,r:i.getBoundingClientRect()}));
 const R=document.createRange(),L=[...c.querySelectorAll('[data-lgx-i]')];let want=0,hit=0;const bad=[];
 L.forEach(e=>{const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const s=n.data,re=/[\u0600-\u06FF]/.test(s)?/\S+/g:/\S/gu;let m;
  while((m=re.exec(s))){R.setStart(n,m.index);R.setEnd(n,m.index+m[0].length);const r=R.getBoundingClientRect();if(!r.width)continue;want++;
   if(P.some(p=>p.c===m[0]&&Math.abs(p.r.left-r.left)<=1&&Math.abs(p.r.top-r.top)<=1&&Math.abs(p.r.width-r.width)<=1))hit++;else if(bad.length<3)bad.push(m[0])}}});
 const pills=[...g.querySelectorAll('.lgx-wb>i')],col=L.every((e,i)=>pills[i]&&pills[i].style.backgroundColor===getComputedStyle(e).backgroundColor);
 return {want,hit,bad,col,pieces:P.length}};
/* every frame: the glass centre, how many buttons have letters inside the glass, and the largest lens scale inside and outside */
const watch=({sel,ms})=>new Promise(r=>{const o=[];const t0=performance.now();let a=0,z=0;
 const f=()=>{const c=document.querySelector(sel),g=c&&c.querySelector('.lgx-g');
  if(g){const b=g.getBoundingClientRect(),G=window.LGX.groups.find(x=>x.box===c),two=new Set();let kin=1,kout=1;
   if(G)G.P.forEach(p=>{if(p.pill)return;const q=p.el.getBoundingClientRect(),cx=q.left+q.width/2,cy=q.top+q.height/2,ins=cx>b.left&&cx<b.right&&cy>b.top&&cy<b.bottom;
    const k=Math.max(...(p.el.style.scale||'1').split(' ').map(parseFloat));if(ins){if(p.it>=0)two.add(p.it);kin=Math.max(kin,k)}else kout=Math.max(kout,k)});
   const mv=g.classList.contains('mv');if(mv){if(!a)a=performance.now();z=performance.now()}
   o.push({x:b.left+b.width/2,y:b.top+b.height/2,mv,two:two.size,kin,kout})}
  if(performance.now()-t0<ms)requestAnimationFrame(f);else r({o,ms:Math.round(z-a)})};requestAnimationFrame(f)});
const centre=(pg,s)=>pg.$eval(s,e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
/* the largest distance of the glass centre from the straight line between the two buttons' centres, while it moves */
const off=(o,A,B)=>{const dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy),M=o.filter(f=>f.mv);return M.length?Math.max(...M.map(f=>Math.abs((f.x-A[0])*dy-(f.y-A[1])*dx)/d)):99};
const moveTo=async(pg,sel,a,b)=>{const A=await centre(pg,a),B=await centre(pg,b);const w=pg.evaluate(watch,{sel,ms:1300});await pg.click(b);return {v:await w,A,B}};
(async()=>{const b=await T.launch();
 /* ---------- Fantasy tabs ---------- */
 let {ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'});
 const FS='#fproot > .ctl',tab=n=>FS+' > button:nth-of-type('+n+')',named=x=>FS+' > button:text-is("'+x+'")';
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(700);
 let s=await pg.evaluate(glassOn,FS);
 ok(s&&s.n>=10&&s.a&&s.g.every((v,i)=>near(v,s.a[i]))&&s.op==='1','at rest the glass covers the chosen tab exactly ('+(s&&s.label)+', '+(s&&s.n)+' tabs)');
 ok(await pg.$$eval(FS+' > button',a=>a.every(b=>b.className===''||b.className==='s')),'the tabs keep exactly the class the page gave them (state is in data attributes)');
 let cp=await pg.evaluate(copyOk,FS);
 ok(cp.want>50&&cp.hit===cp.want&&cp.col,'true lens: every letter of every tab is in the copy where the browser drew it ('+cp.hit+'/'+cp.want+(cp.bad.length?', missing '+cp.bad.join(' '):'')+'), in the tabs\' own colours');
 ok(s.lensed===0&&s.scaled===0,'at rest nothing is magnified');
 const labels=await pg.$$eval(FS+' > button',a=>a.map(x=>x.innerText.trim()));
 let m=await moveTo(pg,FS,tab(1),tab(labels.length));
 ok(off(m.v.o,m.A,m.B)<=2,'straight down: the glass centre stays on the line to the tab (at most '+off(m.v.o,m.A,m.B).toFixed(1)+' px off)');
 ok(m.v.ms>0&&m.v.ms<700,'it arrives in '+m.v.ms+' ms');
 ok(m.v.o.some(f=>f.two>=2),'on the way the lens shows two tabs at once (half of one, half of the next)');
 const kin=Math.max(...m.v.o.map(f=>f.kin)),kout=Math.max(...m.v.o.map(f=>f.kout));
 ok(kin>1.15&&kout<=1.09,'per-character magnification: letters inside the glass up to '+kin.toFixed(2)+'×, outside it only the Dock growth ('+kout.toFixed(2)+'×)');
 await pg.waitForTimeout(400);s=await pg.evaluate(glassOn,FS);
 ok(s.label===labels[labels.length-1]&&s.g.every((x,i)=>near(x,s.a[i]))&&s.lensed===0,'it stops exactly on the tab pressed ('+s.label+') with nothing magnified');
 ok(s.scaled===0,'the Dock magnification is cleared when the glass stops');
 ok(await pg.evaluate(()=>FP.tab==='patterns'),'the click went through the glass to the tab (Fantasy now shows Patterns)');
 cp=await pg.evaluate(copyOk,FS);ok(cp.hit===cp.want&&cp.col,'after the page rebuilt the tabs, the copy is lined up again ('+cp.hit+'/'+cp.want+')');
 ok(await pg.evaluate(()=>{const P=window.LGX.groups[0].P.filter(p=>!p.pill);return P.length>0&&P.every(p=>Array.from(p.el.dataset.c).length===1)}),'per-character: one piece per letter in English');
 m=await moveTo(pg,FS,tab(labels.length),tab(2));
 ok(off(m.v.o,m.A,m.B)<=2&&m.v.ms<700,'up and across: straight ('+off(m.v.o,m.A,m.B).toFixed(1)+' px off), '+m.v.ms+' ms');
 await pg.click(named('My XI'));await pg.waitForTimeout(800);
 m=await moveTo(pg,FS,named('My XI'),named('Season review'));
 ok(off(m.v.o,m.A,m.B)<=2&&m.v.o.some(f=>f.two>=2),'diagonal of the sketch, My XI → Season review: straight ('+off(m.v.o,m.A,m.B).toFixed(1)+' px off), cutting across tabs');
 await pg.waitForTimeout(500);
 /* play: press, drag, let go */
 const from=await pg.evaluate(glassOn,FS);const C0=[from.a[0]+from.a[2]/2,from.a[1]+from.a[3]/2];
 await pg.mouse.move(C0[0],C0[1]);await pg.mouse.down();await pg.waitForTimeout(350);
 s=await pg.evaluate(glassOn,FS);
 ok(s.up&&s.g[2]>from.a[2]*1.05&&s.lensed>0,'pressing the chosen tab lifts the glass ('+Math.round(s.g[2])+' px wide over a '+Math.round(from.a[2])+' px tab) and turns the lens on');
 const V=await centre(pg,named('Value'));
 for(let i=1;i<=14;i++){await pg.mouse.move(C0[0]+(V[0]-C0[0])*i/14,C0[1]+(V[1]-C0[1])*i/14);await pg.waitForTimeout(16)}
 await pg.waitForTimeout(350);s=await pg.evaluate(glassOn,FS);
 ok(near(s.g[0]+s.g[2]/2,V[0],6)&&near(s.g[1]+s.g[3]/2,V[1],6),'dragging: the glass follows the pointer to Value');
 await pg.mouse.up();await pg.waitForTimeout(800);s=await pg.evaluate(glassOn,FS);
 ok(await pg.evaluate(()=>FP.tab==='value')&&s.label==='Value'&&s.g.every((x,i)=>near(x,s.a[i])),'letting go over Value chooses it, and the glass settles on it ('+await pg.evaluate(()=>FP.tab)+')');
 const C1=await centre(pg,named('Value'));await pg.mouse.move(C1[0],C1[1]);await pg.mouse.down();
 await pg.mouse.move(C1[0]+9,C1[1]+3,{steps:4});await pg.mouse.move(C1[0]+2,C1[1],{steps:3});await pg.mouse.up();await pg.waitForTimeout(700);
 s=await pg.evaluate(glassOn,FS);
 ok(await pg.evaluate(()=>FP.tab==='value')&&s.g.every((x,i)=>near(x,s.a[i]))&&!s.up,'a drag let go over the same tab changes nothing');
 /* the copy follows a label that changes and the theme colours */
 const ch=await pg.evaluate(async FS=>{const b=document.querySelector(FS+' > button:nth-of-type(3)');const old=b.textContent;b.textContent='Zq';
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const P=window.LGX.groups[0].P.filter(p=>!p.pill&&p.it===2).map(p=>p.el.dataset.c).join('');
  b.textContent=old;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return P},FS);
 ok(ch==='Zq','the copy follows a label that changes ('+ch+')');
 const th=await pg.evaluate(async FS=>{const r=document.documentElement,o=r.style.getPropertyValue('--sf');r.style.setProperty('--sf','rgb(1, 2, 3)');
  await new Promise(q=>setTimeout(q,450));const c=document.querySelector(FS),a=c.querySelector('[data-lgx-act]'),L=[...c.querySelectorAll('[data-lgx-i]')],pill=c.querySelectorAll('.lgx-wb>i')[L.indexOf(a)];
  const v=pill.style.backgroundColor;r.style.setProperty('--sf',o);return v},FS);
 ok(th==='rgb(1, 2, 3)','the copy follows the theme colours ('+th+')');
 ok(T.noscroll?await T.noscroll(pg):true,'390 px: no horizontal scroll');
 /* a lone button: no glass */
 const lone=await pg.evaluate(async FS=>{const c=document.querySelector(FS);[...c.querySelectorAll('button')].slice(1).forEach(x=>x.remove());
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {g:!!c.querySelector('.lgx-g'),cls:c.classList.contains('lgx'),act:c.querySelectorAll('[data-lgx-act],[data-lgx-i]').length}},FS);
 ok(!lone.g&&!lone.cls&&!lone.act,'a group left with one button gets no glass and keeps its normal style');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- touch: drag with a finger ---------- */
 {const c2=await b.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true});
  await c2.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
  const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));await p2.goto('http://127.0.0.1:8765/index.html#/fantasy');
  await p2.waitForSelector(FS+' .lgx-g',{timeout:60000});await p2.waitForTimeout(700);
  const A=await centre(p2,FS+' > [data-lgx-act]'),B=await centre(p2,named('Teams'));const cdp=await c2.newCDPSession(p2);
  const tp=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await tp('touchStart',A[0],A[1]);for(let i=1;i<=12;i++){await tp('touchMove',A[0]+(B[0]-A[0])*i/12,A[1]+(B[1]-A[1])*i/12);await p2.waitForTimeout(16)}
  await p2.waitForTimeout(250);await tp('touchEnd');await p2.waitForTimeout(800);
  s=await p2.evaluate(glassOn,FS);
  ok(await p2.evaluate(()=>FP.tab==='teams')&&s.label==='Teams'&&s.g.every((x,i)=>near(x,s.a[i])),'touch: dragging the glass with a finger to Teams chooses it ('+await p2.evaluate(()=>FP.tab)+')');
  ok(!e2.length,'touch: no page errors '+e2.slice(0,2).join(' ; '));await c2.close()}
 /* ---------- Arabic: words, not letters ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/fantasy'}));
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(800);
 cp=await pg.evaluate(copyOk,FS);
 ok(cp.want>15&&cp.hit===cp.want,'Arabic: every word of every tab is in the copy where the browser drew it ('+cp.hit+'/'+cp.want+')');
 const words=await pg.evaluate(()=>window.LGX.groups[0].P.filter(p=>!p.pill).map(p=>p.el.dataset.c));
 ok(words.filter(w=>/[\u0600-\u06FF]/.test(w)).every(w=>w.length>1)&&words.some(w=>/[\u0600-\u06FF]{3}/.test(w)),'Arabic labels are lensed word by word, never split into single letters ('+words.length+' pieces)');
 const arl=await pg.$$eval(FS+' > button',a=>a.length);
 m=await moveTo(pg,FS,tab(1),tab(arl));
 ok(off(m.v.o,m.A,m.B)<=2&&m.v.ms<700,'Arabic (right to left): straight ('+off(m.v.o,m.A,m.B).toFixed(1)+' px off), '+m.v.ms+' ms');
 await pg.waitForTimeout(400);s=await pg.evaluate(glassOn,FS);
 ok(s.g.every((x,i)=>near(x,s.a[i])),'Arabic: the glass stops exactly on the tab pressed');
 ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- reduced motion ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'}));await pg.emulateMedia({reducedMotion:'reduce'});
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(400);
 await pg.click(tab(6));s=await pg.evaluate(glassOn,FS);
 const rm=await pg.evaluate(FS=>({mv:document.querySelector(FS+' .lgx-g').classList.contains('mv'),pop:!!document.querySelector(FS+' .lgx-wt>i.pop')}),FS);
 ok(!rm.mv&&!rm.pop&&s.g.every((x,i)=>near(x,s.a[i]))&&s.lensed===0,'reduced motion: the glass is on the new tab at once, nothing animates');
 const R6=await centre(pg,tab(6));await pg.mouse.move(R6[0],R6[1]);await pg.mouse.down();await pg.waitForTimeout(200);s=await pg.evaluate(glassOn,FS);await pg.mouse.up();
 ok(!s.up&&s.lensed===0,'reduced motion: pressing does not lift the glass');
 await ctx.close();
 /* ---------- the menu drawer ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'}));
 await pg.waitForSelector('#mnubtn',{timeout:60000});await pg.click('#mnubtn');await pg.waitForSelector('#drw .drw-n .lgx-g');await pg.waitForTimeout(500);
 const DS='#drw .drw-n';s=await pg.evaluate(glassOn,DS);
 ok(s&&s.label==='Fantasy'&&s.g.every((x,i)=>near(x,s.a[i])),'drawer: the glass rests on the open page (Fantasy)');
 cp=await pg.evaluate(copyOk,DS);
 const deco=await pg.evaluate(()=>{const P=window.LGX.groups[1].P;return {t:P.filter(p=>p.it<0&&p.el.dataset.c).length,svg:P.filter(p=>p.it<0&&p.el.querySelector('svg')).length,h3:document.querySelectorAll('#drw .drw-s h3').length}});
 ok(cp.hit===cp.want&&cp.want>100&&deco.t>10&&deco.svg===deco.h3,'drawer: the copy has every link letter in place ('+cp.hit+'/'+cp.want+'), the section titles and their '+deco.svg+' icons');
 const dl=await pg.$$eval(DS+' a[href^="#/"]',a=>a.map(x=>x.getAttribute('href')));
 const fi=dl.indexOf('#/fantasy'),ti=Math.max(0,fi-5),A=await centre(pg,DS+' a[href="#/fantasy"]'),B=await centre(pg,DS+' a[href="'+dl[ti]+'"]');
 const w=pg.evaluate(watch,{sel:DS,ms:1100});
 await pg.click(DS+' a[href="'+dl[ti]+'"]');
 const mid=await pg.evaluate(()=>({open:document.documentElement.classList.contains('dr-open'),hash:location.hash}));
 ok(mid.open&&mid.hash===dl[ti],'the page opens at once, and the drawer stays open while the glass travels');
 const v=await w;
 ok(off(v.o,A,B)<=2&&v.ms>0&&v.ms<650&&v.o.some(f=>f.two>=2),'drawer: straight up across the links ('+off(v.o,A,B).toFixed(1)+' px off), '+v.ms+' ms');
 await pg.waitForTimeout(600);
 ok(await pg.evaluate(()=>!document.documentElement.classList.contains('dr-open')),'the drawer closes once the glass has arrived');
 await pg.click('#mnubtn');await pg.waitForSelector(DS+' .lgx-g');await pg.waitForTimeout(500);
 s=await pg.evaluate(glassOn,DS);
 ok(s.g.every((x,i)=>near(x,s.a[i]))&&s.label===(await pg.$eval(DS+' a[href="'+dl[ti]+'"]',e=>e.innerText.trim())),'opened again: the glass rests on the new page ('+s.label+')');
 await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
 ok(await pg.evaluate(()=>!document.documentElement.classList.contains('dr-open')),'Escape still closes the drawer');
 ok(!errs.length,'drawer: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 await T.done(b);
})();
