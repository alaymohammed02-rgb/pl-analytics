/* Holographic cards (assets/holo.js + the end of the player-card rules in assets/fun.css): a .pc-card turns towards the pointer (at most 9 degrees each way),
   its highlight and foil follow it, and it is flat again when the pointer leaves. Checked here: at rest the card is flat; with the pointer at a known point of
   the card the variables are exactly what the card's own box gives (--mx, --my in %, --ry = (x - 1/2) × 18, --rx = (1/2 - y) × 18 degrees, the angle of the foil)
   and the computed transform turns the right way; the foil is visible and the text, and the box, do not change; moving from one card to the other
   resets the first; leaving, scrolling and a finger lifted all reset; Save card still works on a tilted card; a finger (pointer type touch) tilts too;
   reduced motion keeps the cards flat and takes the foil away; Arabic, 390 px, no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_0ErfuF';
const st=(pg,i)=>pg.$$eval('.pc-duel .pc-card',(a,i)=>{const c=a[i],k=getComputedStyle(c),m=new DOMMatrix(k.transform==='none'?'matrix(1,0,0,1,0,0)':k.transform),f=getComputedStyle(c,'::before'),cs=c.style;
 return {on:c.classList.contains('holo-on'),mx:cs.getPropertyValue('--mx'),my:cs.getPropertyValue('--my'),rx:cs.getPropertyValue('--rx'),ry:cs.getPropertyValue('--ry'),ma:cs.getPropertyValue('--ma'),hv:cs.getPropertyValue('--hv'),
  m13:m.m13,m23:m.m23,foil:parseFloat(f.opacity),box:[c.offsetWidth,c.offsetHeight],txt:c.innerText}},i);
const rect=(pg,i)=>pg.$$eval('.pc-duel .pc-card',(a,i)=>{const r=a[i].getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}},i);
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/cards'});await pg.waitForSelector('.pc-duel .pc-card',{timeout:90000});await pg.waitForTimeout(1500);
 ok(await pg.$$eval('.pc-duel .pc-card',a=>a.length)>=2,'the duel shows two cards');
 let s=await st(pg,0);const flat=s;ok(!s.on&&s.rx===''&&s.ry===''&&Math.abs(s.m13)<1e-9&&Math.abs(s.m23)<1e-9&&s.foil===0,'at rest the card is flat: no tilt, no foil');
 const r0=await rect(pg,0),px=r0.l+r0.w*.85,py=r0.t+r0.h*.2;await pg.mouse.move(px,py,{steps:6});await pg.waitForTimeout(400);
 const ex=(px-r0.l)/r0.w,ey=(py-r0.t)/r0.h;s=await st(pg,0);
 ok(s.on&&Math.abs(parseFloat(s.mx)-ex*100)<.15&&Math.abs(parseFloat(s.my)-ey*100)<.15,'the pointer at '+(ex*100).toFixed(1)+'% × '+(ey*100).toFixed(1)+'% of the card: --mx '+s.mx+', --my '+s.my);
 ok(Math.abs(parseFloat(s.ry)-(ex-.5)*18)<.05&&Math.abs(parseFloat(s.rx)-(.5-ey)*18)<.05,'the tilt is exactly '+((ex-.5)*18).toFixed(2)+'deg round the vertical and '+((.5-ey)*18).toFixed(2)+'deg round the horizontal ('+s.ry+', '+s.rx+')');
 ok(Math.abs(parseInt(s.ma)-Math.round(ex*360))<=1&&s.hv==='1','the foil angle follows the pointer ('+s.ma+')');
 const m13R=s.m13;ok(Math.abs(s.m13)>.02&&Math.abs(s.m23)>.02,'the computed transform turns the card (m13 = '+s.m13.toFixed(3)+', m23 = '+s.m23.toFixed(3)+')');
 ok(Math.abs(s.foil-.32)<.02,'the foil is visible ('+s.foil.toFixed(2)+')');
 ok(s.txt===flat.txt&&s.box[0]===flat.box[0]&&s.box[1]===flat.box[1],'the text and the layout box of the card are unchanged by the tilt');
 /* the other side of the card turns the other way */
 await pg.mouse.move(r0.l+r0.w*.15,py,{steps:6});await pg.waitForTimeout(300);s=await st(pg,0);ok(s.m13*m13R<0&&parseFloat(s.ry)<0,'the pointer on the left turns it the other way (m13 = '+s.m13.toFixed(3)+', --ry '+s.ry+')');
 /* moving to the other card */
 const q=await rect(pg,1);await pg.mouse.move(q.l+q.w*.3,q.t+q.h*.6,{steps:8});await pg.waitForTimeout(500);let s0=await st(pg,0),s1=await st(pg,1);
 ok(!s0.on&&s0.ry===''&&s1.on&&Math.abs(parseFloat(s1.ry)+3.6)<.4,'moving to the second card flattens the first and tilts the second ('+s1.ry+')');
 /* leaving */
 await pg.mouse.move(3,3,{steps:5});await pg.waitForTimeout(800);s1=await st(pg,1);ok(!s1.on&&s1.rx===''&&Math.abs(s1.m13)<1e-3&&Math.abs(s1.m23)<1e-3&&s1.foil===0,'leaving the card: flat again, the foil gone');
 /* a tilted card still works */
 const sv=await pg.$('.pc-duel .pc-card .pc-save');if(sv){const bb=await sv.boundingBox();await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:4});await pg.waitForTimeout(250);const before=await sv.getAttribute('aria-pressed');await pg.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await pg.waitForTimeout(350);
  ok((await pg.$eval('.pc-duel .pc-card .pc-save',e=>e.getAttribute('aria-pressed')))!==before,'Save card still works on a tilted card');await pg.mouse.move(3,3,{steps:3});await pg.waitForTimeout(500)}
 /* a finger */
 await pg.evaluate(()=>{const c=document.querySelector('.pc-duel .pc-card'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*.2,clientY:r.top+r.height*.8,pointerType:'touch',pointerId:7}))});await pg.waitForTimeout(300);
 s=await st(pg,0);ok(s.on&&parseFloat(s.ry)<-4&&parseFloat(s.rx)<-4,'a finger on the card tilts it too ('+s.ry+', '+s.rx+')');
 await pg.evaluate(()=>{const c=document.querySelector('.pc-duel .pc-card');c.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:7}))});await pg.waitForTimeout(700);s=await st(pg,0);ok(!s.on&&s.ry==='','lifting the finger flattens it');
 /* scrolling */
 await pg.mouse.move(r0.l+r0.w*.5,r0.t+r0.h*.5,{steps:3});await pg.waitForTimeout(250);ok((await st(pg,0)).on,'the card is tilted again');
 await pg.evaluate(()=>window.scrollBy(0,40));await pg.waitForTimeout(700);ok(!(await st(pg,0)).on,'scrolling the page flattens it');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* reduced motion */
 ({ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/cards'}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.waitForSelector('.pc-duel .pc-card',{timeout:90000});await pg.waitForTimeout(1200);
 {const r=await rect(pg,0);await pg.mouse.move(r.l+r.w*.8,r.t+r.h*.2,{steps:5});await pg.waitForTimeout(400);s=await st(pg,0);ok(!s.on&&s.ry===''&&Math.abs(s.m13)<1e-9&&s.foil===0&&await pg.$eval('.pc-duel .pc-card',e=>getComputedStyle(e,'::before').display==='none'),'reduced motion: the card stays flat and has no foil')}
 await ctx.close();
 /* Arabic, phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/cards'}));await pg.waitForSelector('.pc-duel .pc-card',{timeout:90000});await pg.waitForTimeout(1200);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  await pg.$eval('.pc-duel .pc-card',e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(300);
  {const r=await rect(pg,0);await pg.mouse.move(r.l+r.w*.7,r.t+r.h*.3,{steps:4});await pg.waitForTimeout(300);s=await st(pg,0);ok(s.on&&Math.abs(s.m13)>.02,lang+' phone: the card tilts');ok(await T.noscroll(pg),lang+' phone: still no horizontal scroll while tilted')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/holo_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
