/* Offline note (assets/offline-note.js): a bar that says the page is showing the last data saved on this device. Checked: nothing shown while online; the browser going offline shows
   the bar with the data time the page holds (data/index.json's generated time) in English and in Arabic; coming back online offers Reload and Dismiss; Dismiss hides it and going
   offline again shows it again; Reload reloads the page; a real offline reload through the service worker (the page was visited online first) opens the site from the saved copies and
   shows the bar from the start, with no page error; 390 px with no horizontal scroll; the bar covers no control (it can be dismissed only when online again, and it sits at the bottom). */
const T=require('../nf/lib.js');const {ok,J}=T;
const GEN=String(J('index.json').generated);
const vis=pg=>pg.evaluate(()=>{const e=document.querySelector('#offnote');if(!e||e.hidden)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {cls:e.className,text:[...e.querySelectorAll('.off-t .fx-en')].map(x=>x.textContent).join(' ').trim(),ar:[...e.querySelectorAll('.off-t .fx-ar')].map(x=>x.textContent).join(' ').trim(),btn:[...e.querySelectorAll('button')].map(b=>b.id),pos:cs.position,bottom:innerHeight-r.bottom,w:r.width,right:r.right,display:cs.display}});
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/table'});await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(500);
 ok(await vis(pg)===null,'online: no offline bar');
 await ctx.setOffline(true);await pg.waitForTimeout(400);
 let v=await vis(pg);
 ok(v&&v.cls.includes('off')&&v.text==='You are offline: this is the last data saved on this device (updated '+GEN+' UTC).','offline: the bar says so with the data time '+GEN+' ('+(v&&v.text)+')');
 ok(v.pos==='fixed'&&v.bottom<60&&v.bottom>=0&&v.btn.length===0,'the bar is fixed at the bottom of the screen and has no buttons while offline');
 await ctx.setOffline(false);await pg.waitForTimeout(400);v=await vis(pg);
 ok(v&&v.cls.includes('back')&&v.btn.join()==='offreload,offx'&&/back online/.test(v.text),'back online: "You are back online. Reload…" with Reload and Dismiss');
 await pg.click('#offx');await pg.waitForTimeout(150);ok(await vis(pg)===null,'Dismiss hides the bar');
 await ctx.setOffline(true);await pg.waitForTimeout(300);ok((await vis(pg))!==null,'going offline again shows the bar again');
 await ctx.setOffline(false);await pg.waitForTimeout(300);
 {const nav=pg.waitForEvent('load',{timeout:30000});await pg.click('#offreload');await nav;await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(300);ok(await vis(pg)===null,'Reload reloads the page, and the bar is gone')}
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/table'}));await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(400);
 await ctx.setOffline(true);await pg.waitForTimeout(400);v=await vis(pg);
 ok(v&&v.ar.replace(/[\u2066-\u2069\u200e\u200f]/g,'').replace(/\u2011/g,'-')==='أنت بدون اتصال: هذي آخر بيانات انحفظت على هذا الجهاز (تحدّثت '+GEN+' بتوقيت UTC).','Arabic: the bar in Arabic with the data time');
 ok(await T.noscroll(pg)&&v.right<=390&&v.w<=390,'phone: the bar fits the screen, no horizontal scroll');
 ok(!errs.length,'Arabic phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* a real offline reload through the service worker */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));
  await p.goto('http://127.0.0.1:8765/index.html#/table');await p.waitForSelector('.lt',{timeout:90000});
  await p.evaluate(async()=>{const r=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;return !!r});
  await p.reload();await p.waitForSelector('.lt',{timeout:90000});await p.waitForTimeout(1500);
  ok(await p.evaluate(()=>!!navigator.serviceWorker.controller),'the service worker controls the page after a second visit');
  await c.setOffline(true);
  let loaded=true;try{await p.reload({timeout:30000});await p.waitForSelector('#app h2',{timeout:60000});await p.waitForFunction(()=>{const e=document.querySelector('#offnote');return e&&!e.hidden&&/updated \d{4}/.test(e.textContent)},null,{timeout:15000})}catch(x){loaded=false}
  ok(loaded,'offline reload: the site opens from the copies the device saved');
  v=loaded?await vis(p):null;ok(v&&v.cls.includes('off')&&v.text.includes('updated '+GEN),'offline reload: the bar is there from the start with the data time');
  ok(!e.length,'offline reload: no page errors '+e.slice(0,2).join(' ; '));await c.close()}
 await T.done(b)})();
