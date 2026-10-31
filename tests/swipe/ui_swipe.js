/* Matches board swipe (assets/matches-board.js, top of the Overview): a finger swipe sideways on the list goes to the next or the previous day, like a scores app.
   A phone with touch: swipe left goes to the next day and right to the previous one (mirrored in Arabic); what is shown after a swipe is exactly what pressing that day's
   tab shows; the move must be long enough (60 px), mostly horizontal and quick, so a short move, a slanted one, a slow one and a vertical scroll change nothing; a swipe that
   starts on the day strip leaves the day alone (the strip scrolls itself); at the first and the last day a swipe does nothing and does not fail; a tap on a match still opens it;
   the new day slides in only for a swipe (not for a tab press or a fold); no sideways scroll of the page; no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_4WFCIZ';
async function phone(b,lang){const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,LG]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_TUNNEL|cdn.pitchapi|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('.mb-days .on',{timeout:90000});await pg.waitForTimeout(500);
 const cdp=await ctx.newCDPSession(pg);return {ctx,pg,cdp,errs}}
/* a swipe from (x0,y0) to (x1,y1) in steps over `ms` milliseconds */
async function swipe(cdp,pg,x0,y0,x1,y1,ms=180,after=450){const send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
 await send('touchStart',x0,y0);const n=6;for(let i=1;i<=n;i++){await send('touchMove',x0+(x1-x0)*i/n,y0+(y1-y0)*i/n);await pg.waitForTimeout(ms/n)}await send('touchEnd');await pg.waitForTimeout(after)}
const day=pg=>pg.$eval('.mb-days .on',e=>e.dataset.d);
const days=pg=>pg.$$eval('.mb-days button',a=>a.map(x=>x.dataset.d));
const snap=pg=>pg.$$eval('.mb-g',a=>a.map(g=>g.innerText.replace(/\s+/g,' ').trim()).join(' | '));
async function pressDay(pg,d){await pg.click('.mb-days button[data-d="'+d+'"]');await pg.waitForTimeout(400);return snap(pg)}
(async()=>{const b=await T.launch();
 let {ctx,pg,cdp,errs}=await phone(b,'en');
 const ds=await days(pg),d0=await day(pg),i0=ds.indexOf(d0);
 ok(ds.length>=3&&i0>0&&i0<ds.length-1,'the board opens on today ('+d0+') with a day before and a day after, '+ds.length+' days in the strip');
 /* the row of the list, away from the strip */
 const box=await pg.$eval('.mb-g',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+Math.min(r.height-10,70),w:r.width}});
 const X=box.x+box.w/2,Y=box.y;
 await swipe(cdp,pg,X+90,Y,X-90,Y);
 ok(await day(pg)===ds[i0+1],'a swipe to the left goes to the next day ('+ds[i0+1]+')');
 const nextSnap=await snap(pg);
 ok(nextSnap===await pressDay(pg,ds[i0+1]),'what the swipe shows is exactly what pressing that day shows');
 await swipe(cdp,pg,X-90,Y,X+90,Y);
 ok(await day(pg)===ds[i0],'a swipe to the right goes back to the day before ('+ds[i0]+')');
 await swipe(cdp,pg,X-90,Y,X+90,Y);
 ok(await day(pg)===ds[i0-1],'and once more: the day before that ('+ds[i0-1]+')');
 const here=await day(pg);
 /* moves that must change nothing */
 await swipe(cdp,pg,X+20,Y,X-20,Y);ok(await day(pg)===here,'a short move (40 px) changes nothing');
 await swipe(cdp,pg,X+90,Y-60,X-90,Y+60);ok(await day(pg)===here,'a slanted move (180 px across, 120 down) changes nothing');
 await swipe(cdp,pg,X+90,Y,X-90,Y,1100);ok(await day(pg)===here,'a slow move (1.1 s) changes nothing');
 await swipe(cdp,pg,X,Y+60,X,Y-60);ok(await day(pg)===here,'a vertical move (scrolling) changes nothing');
 {const st=await pg.$eval('.mb-days',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await swipe(cdp,pg,st.x+90,st.y,st.x-90,st.y);
  ok(await day(pg)===here,'a swipe that starts on the day strip leaves the day alone (the strip scrolls)')}
 /* a tap still opens a match */
 {const href=await pg.$eval('a.mb-r',e=>e.getAttribute('href'));await pg.tap('a.mb-r');await pg.waitForTimeout(900);ok(location_ok(await pg.evaluate(()=>location.hash),href),'a tap on a match still opens it ('+href.slice(0,22)+'…)');await pg.evaluate(()=>{location.hash='#/overview'});await pg.waitForSelector('.mb-days .on',{timeout:60000});await pg.waitForTimeout(400)}
 /* the animation belongs to a swipe only */
 {await pg.click('.mb-days button[data-d="'+ds[i0]+'"]');await pg.waitForTimeout(80);const a1=await pg.$eval('.mb-g,.mb-empty',e=>getComputedStyle(e).animationName)+'|'+await pg.$eval('#mb',e=>String('slide' in e.dataset));
  ok(a1==='none|false','pressing a day tab does not animate the list');
  const Y2=await pg.$eval('.mb-g,.mb-empty',e=>{const r=e.getBoundingClientRect();return r.y+Math.min(r.height-6,50)});await swipe(cdp,pg,X+90,Y2,X-90,Y2,150,40);
  const a2=await pg.$eval('.mb-g,.mb-empty',e=>getComputedStyle(e).animationName)+'|'+await pg.$eval('#mb',e=>String('slide' in e.dataset))+'|'+await pg.$eval('#mb',e=>e.style.getPropertyValue('--sl'));
  ok(a2==='mb-sl|true|28px','right after a swipe to the next day the list slides in from the right ("mb-sl", 28 px)');
  await pg.waitForTimeout(500);ok(await pg.$eval('#mb',e=>!('slide' in e.dataset)),'the slide mark is gone after the animation (a fold or a tab press does not slide)');
  await pg.click('.mb-days button[data-d="'+ds[i0]+'"]');await pg.waitForTimeout(300)}
 /* the ends */
 await pg.click('.mb-days button[data-d="'+ds[0]+'"]');await pg.waitForTimeout(300);
 {const Y3=await pg.$eval('.mb-g,.mb-empty',e=>{const r=e.getBoundingClientRect();return r.y+Math.min(r.height-6,30)});await swipe(cdp,pg,X-90,Y3,X+90,Y3);ok(await day(pg)===ds[0],'on the first day a swipe to the right does nothing')}
 await pg.click('.mb-days button[data-d="'+ds[ds.length-1]+'"]');await pg.waitForTimeout(300);
 {const Y3=await pg.$eval('.mb-g,.mb-empty',e=>{const r=e.getBoundingClientRect();return r.y+Math.min(r.height-6,30)});await swipe(cdp,pg,X+90,Y3,X-90,Y3);ok(await day(pg)===ds[ds.length-1],'on the last day a swipe to the left does nothing')}
 ok(await T.noscroll(pg),'no sideways scroll of the page');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic: right to left, so the way is mirrored */
 ({ctx,pg,cdp,errs}=await phone(b,'ar'));
 const dsA=await days(pg),a0=await day(pg),ia=dsA.indexOf(a0);
 ok(await pg.evaluate(()=>document.documentElement.dir)==='rtl'&&ia>0&&ia<dsA.length-1,'Arabic: the page is right to left, today in the middle of the strip');
 const bx=await pg.$eval('.mb-g',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(r.height-10,70)}});
 await swipe(cdp,pg,bx.x-90,bx.y,bx.x+90,bx.y);ok(await day(pg)===dsA[ia+1],'Arabic: a swipe to the right goes to the next day');
 await swipe(cdp,pg,bx.x+90,bx.y,bx.x-90,bx.y);ok(await day(pg)===dsA[ia],'Arabic: a swipe to the left goes back');
 ok(await T.noscroll(pg),'Arabic phone: no sideways scroll');ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 await T.done(b)})();
function location_ok(hash,href){return hash===href||decodeURIComponent(hash)===decodeURIComponent(href)||/^#\/(match|preview)\//.test(hash)}
