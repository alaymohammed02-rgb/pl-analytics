/* Liquid Glass 2 (assets/liquid-glass.js): the glass rests on the chosen button, travels through every button in between in
   reading order (never back), the lens shows each label it passes (letters in English, words in Arabic), the Dock magnification
   is cleared afterwards, the drawer closes only once the glass has arrived, reduced motion jumps, a lone button gets no glass,
   clicks still reach the buttons, Arabic, a 390 px phone and no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const near=(a,b)=>Math.abs(a-b)<=1.5;
const glassOn=sel=>{const c=document.querySelector(sel),g=c&&c.querySelector('.lgx-g');if(!g)return null;
 const L=[...c.querySelectorAll('.lgx-i')],a=L.find(e=>e.classList.contains('lgx-act'));
 const gb=g.getBoundingClientRect(),ab=a&&a.getBoundingClientRect();
 return {g:[gb.left,gb.top,gb.width,gb.height],a:ab&&[ab.left,ab.top,ab.width,ab.height],lens:g.querySelector('.lgx-t').dataset.s,
  label:a&&a.innerText.trim(),cov:(c.querySelector('.lgx-on')||{}).innerText,op:getComputedStyle(g).opacity,
  hidden:a&&getComputedStyle(a).color,scaled:L.filter(e=>e.style.scale).length,n:L.length}};
/* the labels the lens shows while the glass moves, in order of appearance */
const watch=({sel,ms})=>new Promise(r=>{const o=[],sp=[];const t0=performance.now();const f=()=>{const t=document.querySelector(sel+' .lgx-t');
 if(t&&t.dataset.s&&o[o.length-1]!==t.dataset.s){o.push(t.dataset.s);sp.push([...t.querySelectorAll('.lgx-c')].map(s=>s.textContent.replace(/\u00a0/g,' ')))}
 if(performance.now()-t0<ms)requestAnimationFrame(f);else r({o,sp})};requestAnimationFrame(f)});
(async()=>{const b=await T.launch();
 /* ---------- Fantasy tabs ---------- */
 let {ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'});
 const FS='#fproot > .ctl';
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(600);
 let s=await pg.evaluate(glassOn,FS);
 ok(s&&s.n>=10&&s.a&&s.g.every((v,i)=>near(v,s.a[i]))&&s.op==='1','at rest the glass covers the chosen tab exactly ('+(s&&s.label)+', '+(s&&s.n)+' tabs)');
 ok(s.lens===s.label&&s.cov===s.label&&/rgba\(0, 0, 0, 0\)|transparent/.test(s.hidden),'the lens shows the chosen label and the tab underneath lends it (its own text is hidden)');
 const labels=await pg.$$eval(FS+' > button',a=>a.map(x=>x.innerText.trim()));
 const from=labels.indexOf(s.label),to=labels.length-1;
 let w=pg.evaluate(watch,{sel:FS,ms:1700});
 await pg.click(FS+' > button:nth-of-type('+(to+1)+')');
 let v=await w;const exp=labels.slice(from,to+1);
 const idx=v.o.map(l=>labels.indexOf(l));
 ok(idx.every((x,i)=>i===0||x>idx[i-1]),'the glass never goes back: '+v.o.join(' → '));
 ok(v.o[0]===exp[0]&&v.o[v.o.length-1]===exp[exp.length-1]&&v.o.length>=Math.ceil(exp.length*.8),'it passes the tabs in reading order from '+exp[0]+' to '+exp[exp.length-1]+' ('+v.o.length+' of '+exp.length+' shown)');
 ok(v.sp.every((p,i)=>p.join('')===v.o[i]&&p.length===Array.from(v.o[i]).length),'per-character: one span per letter in English');
 await pg.waitForTimeout(500);
 s=await pg.evaluate(glassOn,FS);
 ok(s.label===labels[to]&&s.g.every((x,i)=>near(x,s.a[i]))&&s.lens===labels[to],'it stops exactly on the tab pressed ('+labels[to]+')');
 ok(s.scaled===0,'the Dock magnification is cleared when the glass stops');
 ok(await pg.evaluate(()=>FP.tab==='patterns'),'the click went through the glass to the tab (Fantasy now shows Patterns)');
 /* backwards: from the last tab to the second */
 w=pg.evaluate(watch,{sel:FS,ms:1700});await pg.click(FS+' > button:nth-of-type(2)');v=await w;
 const id2=v.o.map(l=>labels.indexOf(l));
 ok(id2.every((x,i)=>i===0||x<id2[i-1])&&v.o[v.o.length-1]===labels[1],'backwards too, in reverse order: '+v.o.length+' labels');
 ok(T.noscroll?await T.noscroll(pg):true,'390 px: no horizontal scroll');
 /* a lone button: no glass */
 const lone=await pg.evaluate(async FS=>{const c=document.querySelector(FS);[...c.querySelectorAll('button')].slice(1).forEach(x=>x.remove());
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {g:!!c.querySelector('.lgx-g'),cls:c.classList.contains('lgx'),act:c.querySelectorAll('.lgx-act,.lgx-on').length}},FS);
 ok(!lone.g&&!lone.cls&&!lone.act,'a group left with one button gets no glass and keeps its normal style');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- Arabic: words, not letters ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/fantasy'}));
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(800);
 const arl=await pg.$$eval(FS+' > button',a=>a.map(x=>x.innerText.trim()));
 w=pg.evaluate(watch,{sel:FS,ms:1700});await pg.click(FS+' > button:nth-of-type('+arl.length+')');v=await w;
 const arab=v.sp.filter((p,i)=>/[؀-ۿ]/.test(v.o[i]));
 ok(arab.length>3&&arab.every(p=>p.every(x=>x.trim()===''||!/^[؀-ۿ]$/.test(x))&&p.some(x=>x.trim().length>1)),'Arabic labels animate word by word, never split into single letters ('+arab.length+' labels)');
 await pg.waitForTimeout(400);s=await pg.evaluate(glassOn,FS);
 ok(s.g.every((x,i)=>near(x,s.a[i])),'Arabic (right to left): the glass stops exactly on the tab pressed');
 ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- reduced motion ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'}));await pg.emulateMedia({reducedMotion:'reduce'});
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(400);
 await pg.click(FS+' > button:nth-of-type(6)');
 const rm=await pg.evaluate(FS=>{const g=document.querySelector(FS+' .lgx-g');return {an:g.getAnimations().length,pop:!!document.querySelector(FS+' .lgx-t.pop')}},FS);
 s=await pg.evaluate(glassOn,FS);
 ok(rm.an===0&&!rm.pop&&s.g.every((x,i)=>near(x,s.a[i])),'reduced motion: the glass is on the new tab at once, nothing animates');
 await ctx.close();
 /* ---------- the menu drawer ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'}));
 await pg.waitForSelector('#mnubtn',{timeout:60000});await pg.click('#mnubtn');await pg.waitForSelector('#drw .drw-n .lgx-g');await pg.waitForTimeout(400);
 const DS='#drw .drw-n';s=await pg.evaluate(glassOn,DS);
 ok(s&&s.label==='Fantasy'&&s.g.every((x,i)=>near(x,s.a[i]))&&s.lens==='Fantasy','drawer: the glass rests on the open page (Fantasy)');
 const dl=await pg.$$eval(DS+' a[href^="#/"]',a=>a.map(x=>[x.innerText.trim(),x.getAttribute('href')]));
 const fi=dl.findIndex(x=>x[0]==='Fantasy'),ti=Math.max(0,fi-5);
 w=pg.evaluate(watch,{sel:DS,ms:1200});
 await pg.click(DS+' a[href="'+dl[ti][1]+'"]');
 const mid=await pg.evaluate(()=>({open:document.documentElement.classList.contains('dr-open'),hash:location.hash}));
 ok(mid.open&&mid.hash===dl[ti][1],'the page opens at once, and the drawer stays open while the glass travels');
 v=await w;const d2=v.o.map(l=>dl.findIndex(x=>x[0]===l));
 ok(v.o[0]==='Fantasy'&&v.o[v.o.length-1]===dl[ti][0]&&d2.every((x,i)=>i===0||x<d2[i-1])&&v.o.length>=4,'drawer: up through the links in order: '+v.o.join(' → '));
 await pg.waitForTimeout(700);
 ok(await pg.evaluate(()=>!document.documentElement.classList.contains('dr-open')),'the drawer closes once the glass has arrived');
 await pg.click('#mnubtn');await pg.waitForSelector(DS+' .lgx-g');await pg.waitForTimeout(400);
 s=await pg.evaluate(glassOn,DS);
 ok(s.label===dl[ti][0]&&s.g.every((x,i)=>near(x,s.a[i])),'opened again: the glass rests on the new page ('+dl[ti][0]+')');
 await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
 ok(await pg.evaluate(()=>!document.documentElement.classList.contains('dr-open')),'Escape still closes the drawer');
 ok(!errs.length,'drawer: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 await T.done(b);
})();
