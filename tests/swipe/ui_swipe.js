/* Matches board swipe (assets/matches-board.js, top of the Overview): the list is a pager that follows the finger. A phone with touch (touch events through CDP):
   - while the finger moves sideways the list moves with it (translateX equal to the move, one to one) and the next (finger to the left) or the previous day's list, built beside it,
     moves with it too, so there is never an empty space; past the first or the last day there is no neighbour and the list moves only a quarter as much;
   - on release a move of a fifth of the list (60 px at least), or a quick flick (30 px at 0.45 px/ms), slides the list away and the next (finger to the left) or the previous
     day (finger to the right) slides in, mirrored in Arabic; what is shown is exactly what pressing that day's tab shows; the list ends with no leftover movement;
   - a short, slow, small move springs back (the list returns to its place, the day is the same); a slanted move (not 1.6 times more across than down) does not change the day;
     a vertical move never moves the list; a move starting on the day strip leaves everything alone;
   - at the first and the last day the list springs back; a tap on a match still opens it; no sideways scroll of the page; no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_4WFCIZ';
async function phone(b,lang){const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,LG]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_TUNNEL|cdn.pitchapi|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('.mb-days .on',{timeout:90000});await pg.waitForTimeout(500);
 const cdp=await ctx.newCDPSession(pg);return {ctx,pg,cdp,errs}}
const send=(cdp,type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
/* the finger goes down at (x0,y0) and moves to (x1,y1) in steps over ms; it is NOT lifted: the returned function lifts it (after `wait` ms) */
async function down(cdp,pg,x0,y0,x1,y1,ms=180,n=6){await send(cdp,'touchStart',x0,y0);for(let i=1;i<=n;i++){await send(cdp,'touchMove',x0+(x1-x0)*i/n,y0+(y1-y0)*i/n);await pg.waitForTimeout(ms/n)}return async(wait=500)=>{await send(cdp,'touchEnd');await pg.waitForTimeout(wait)}}
async function swipe(cdp,pg,x0,y0,x1,y1,ms=180,wait=600,n=6){const up=await down(cdp,pg,x0,y0,x1,y1,ms,n);await up(wait)}
const day=pg=>pg.$eval('.mb-days .on',e=>e.dataset.d);
const days=pg=>pg.$$eval('.mb-days button',a=>a.map(x=>x.dataset.d));
const snap=pg=>pg.$$eval('.mb-g',a=>a.map(g=>g.innerText.replace(/\s+/g,' ').trim()).join(' | '));
/* the list's own movement: pixels across (from its matrix) and opacity */
const mv=pg=>pg.$eval('.mb-pg:not(.mb-nb)',e=>{const cs=getComputedStyle(e),m=cs.transform==='none'?[1,0,0,1,0,0]:cs.transform.match(/-?[\d.e-]+/g).map(Number);return {x:m[4]||0,o:+cs.opacity,style:e.getAttribute('style')||''}});
const nbOf=pg=>pg.$eval('.mb-nb',e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,text:e.innerText.replace(/\s+/g,' ').trim(),n:document.querySelectorAll('.mb-nb').length}}).catch(()=>null);
const panes=pg=>pg.$$eval('.mb-pg',a=>a.length);
async function pressDay(pg,d){await pg.click('.mb-days button[data-d="'+d+'"]');await pg.waitForTimeout(400);return snap(pg)}
const listY=pg=>pg.$eval('.mb-g,.mb-empty',e=>{const r=e.getBoundingClientRect();return r.y+Math.min(r.height-6,60)});
(async()=>{const b=await T.launch();
 let {ctx,pg,cdp,errs}=await phone(b,'en');
 const ds=await days(pg),d0=await day(pg),i0=ds.indexOf(d0);
 ok(ds.length>=3&&i0>0&&i0<ds.length-1,'the board opens on today ('+d0+') with a day before and a day after, '+ds.length+' days in the strip');
 const X=195,Y=await listY(pg);let nbText='';
 /* the list follows the finger */
 {const up=await down(cdp,pg,X+90,Y,X-10,Y,200);const m=await mv(pg);
  const nb=await nbOf(pg);
  ok(Math.abs(m.x-(-100))<4&&m.o===1,'while the finger moves 100 px to the left the list is 100 px to the left ('+m.x.toFixed(1)+'), one to one, with no fade');
  ok(!!nb&&nb.n===1&&nb.left<390-40&&nb.left>150&&nb.right>390,'the next day\'s list is already beside it, coming in from the right (its left edge at '+(nb&&nb.left.toFixed(0))+' px of 390): no empty space');
  nbText=nb&&nb.text;
  await up(700);ok(await day(pg)===ds[i0+1],'letting go after 100 px (more than a fifth of the list): the next day ('+ds[i0+1]+')')}
 ok(await mv(pg).then(m=>m.x===0&&m.o===1&&m.style==='')&&await panes(pg)===1&&await nbOf(pg)===null,'after the slide there is one list, no neighbour pane and no leftover inline style');
 ok(nbText===await pg.$eval('.mb-pg',e=>e.innerText.replace(/\s+/g,' ').trim()),'and it is the very list that was beside the finger (the same text)');
 ok(await snap(pg)===await pressDay(pg,ds[i0+1]),'what the swipe shows is exactly what pressing that day shows');
 await swipe(cdp,pg,X-90,Y,X+90,Y);ok(await day(pg)===ds[i0],'a swipe to the right goes back to the day before ('+ds[i0]+')');
 await swipe(cdp,pg,X-90,Y,X+90,Y);ok(await day(pg)===ds[i0-1],'and once more: the day before that ('+ds[i0-1]+')');
 const here=await day(pg);
 /* a small slow move springs back; the list returned to its place */
 {const up=await down(cdp,pg,X+25,Y,X-25,Y,300);const m=await mv(pg);ok(Math.abs(m.x+50)<4,'a 50 px move: the list follows ('+m.x.toFixed(1)+')');await up(500);
  ok(await day(pg)===here&&await mv(pg).then(m=>m.x===0&&m.o===1)&&await panes(pg)===1,'letting go after 50 px, slowly: the list springs back to its place, the neighbour is removed and the day is the same')}
 /* a slow but long move now counts (it is a drag, not a flick) */
 await swipe(cdp,pg,X+90,Y,X-90,Y,1100,700);ok(await day(pg)===ds[i0],'a slow move of 180 px (1.1 s) still goes to the next day: it is a drag');
 /* a quick flick of 40 px */
 await swipe(cdp,pg,X+20,Y,X-20,Y,0,700,2);ok(await day(pg)===ds[i0+1],'a quick flick of 40 px (two touch points, no pause) goes to the next day');
 await swipe(cdp,pg,X-20,Y,X+20,Y,0,700,2);await swipe(cdp,pg,X+20,Y,X-20,Y,600,600);ok(await day(pg)===ds[i0],'a 40 px move over 0.6 s (not a flick) does not: back on the same day ('+ds[i0]+')');
 /* slanted, vertical, from the strip */
 await swipe(cdp,pg,X+90,Y-60,X-90,Y+60);ok(await day(pg)===ds[i0],'a slanted move (180 px across, 120 down) does not change the day');
 {const up=await down(cdp,pg,X,Y+60,X,Y-60);const m=await mv(pg);ok(m.x===0&&m.o===1,'a vertical move (scrolling) does not move the list sideways');await up(400);ok(await day(pg)===ds[i0],'and does not change the day')}
 {const st=await pg.$eval('.mb-days',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});const up=await down(cdp,pg,st.x+90,st.y,st.x-90,st.y);const m=await mv(pg);await up(400);
  ok(m.x===0&&await day(pg)===ds[i0],'a move that starts on the day strip does not move the list or change the day (the strip scrolls)')}
 /* the entrance: the new list starts away and faded, and ends in place */
 {await pg.evaluate(()=>{window.__min=1;window.__off=0;const f=()=>{const p=document.querySelector('.mb-pg');if(p){const cs=getComputedStyle(p),o=+cs.opacity;if(o<window.__min)window.__min=o;const m=cs.transform==='none'?0:+cs.transform.match(/-?[\d.e-]+/g)[4];if(Math.abs(m)>window.__off)window.__off=Math.abs(m)}window.__raf=requestAnimationFrame(f)};f()});
  await swipe(cdp,pg,X+90,Y,X-90,Y,150,700);const r=await pg.evaluate(()=>{cancelAnimationFrame(window.__raf);return {min:window.__min,off:window.__off}});
  ok(r.off>300,'the change is animated: the list moved '+r.off.toFixed(0)+' px across, then settled');
  ok(await mv(pg).then(m=>m.x===0&&m.o===1&&m.style===''),'and it ends in place with no inline style');
  await pg.click('.mb-days button[data-d="'+ds[i0]+'"]');await pg.waitForTimeout(300);ok(await mv(pg).then(m=>m.style===''),'pressing a day tab moves nothing')}
 /* a tap still opens a match */
 {const href=await pg.$eval('a.mb-r',e=>e.getAttribute('href'));await pg.tap('a.mb-r');await pg.waitForTimeout(900);const h=await pg.evaluate(()=>location.hash);ok(h===href||/^#\/(match|preview)\//.test(h),'a tap on a match still opens it ('+href.slice(0,22)+'…)');await pg.evaluate(()=>{location.hash='#/overview'});await pg.waitForSelector('.mb-days .on',{timeout:60000});await pg.waitForTimeout(400)}
 /* the ends: the list gives a quarter as much and springs back */
 await pg.click('.mb-days button[data-d="'+ds[0]+'"]');await pg.waitForTimeout(300);
 {const Y3=await listY(pg);const up=await down(cdp,pg,X-90,Y3,X+90,Y3,200);const m=await mv(pg);
  ok(m.x>30&&m.x<60&&await nbOf(pg)===null,'on the first day a move of 180 px to the right moves the list only a quarter as much ('+m.x.toFixed(0)+' px) and there is no neighbour');await up(500);
  ok(await day(pg)===ds[0]&&await mv(pg).then(m=>m.x===0&&m.o===1),'and it springs back; the day stays the first')}
 await pg.click('.mb-days button[data-d="'+ds[ds.length-1]+'"]');await pg.waitForTimeout(300);
 {const Y3=await listY(pg);await swipe(cdp,pg,X+90,Y3,X-90,Y3);ok(await day(pg)===ds[ds.length-1]&&await mv(pg).then(m=>m.x===0&&m.o===1),'on the last day a swipe to the left does nothing')}
 ok(await T.noscroll(pg),'no sideways scroll of the page');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* reduced motion: the day changes at once, nothing follows the finger */
 {const c2=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await c2.addInitScript(([lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang','en')}},[LG]);
  const p2=await c2.newPage();await p2.goto('http://127.0.0.1:8765/index.html#/overview');await p2.waitForSelector('.mb-days .on',{timeout:90000});await p2.waitForTimeout(500);const cd2=await c2.newCDPSession(p2),d2=await days(p2),a2=d2.indexOf(await day(p2)),Y2=await listY(p2);
  const up=await down(cd2,p2,X+90,Y2,X-10,Y2,150);const m=await mv(p2);await up(200);
  ok(m.x===0&&m.o===1&&await day(p2)===d2[a2+1]&&await mv(p2).then(z=>z.style===''),'reduced motion: the list does not follow the finger, and the next day is shown at once');await c2.close()}
 /* Arabic: right to left, so the way is mirrored */
 ({ctx,pg,cdp,errs}=await phone(b,'ar'));
 const dsA=await days(pg),a0=await day(pg),ia=dsA.indexOf(a0),YA=await listY(pg);
 ok(await pg.evaluate(()=>document.documentElement.dir)==='rtl'&&ia>0&&ia<dsA.length-1,'Arabic: the page is right to left, today in the middle of the strip');
 await swipe(cdp,pg,X-90,YA,X+90,YA);ok(await day(pg)===dsA[ia+1],'Arabic: a swipe to the right goes to the next day');
 await swipe(cdp,pg,X+90,YA,X-90,YA);ok(await day(pg)===dsA[ia],'Arabic: a swipe to the left goes back');
 {const up=await down(cdp,pg,X-60,YA,X+40,YA,200);const m=await mv(pg);ok(Math.abs(m.x-100)<4,'Arabic: the list follows the finger to the right ('+m.x.toFixed(1)+')');await up(600);ok(await day(pg)===dsA[ia+1],'Arabic: letting go goes to the next day')}
 ok(await T.noscroll(pg),'Arabic phone: no sideways scroll');ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 await T.done(b)})();
