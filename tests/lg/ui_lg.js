/* Liquid Glass 2 (assets/liquid-glass.js): the glass rests on the chosen button, goes straight to the new one in any direction
   (under 0.75 s), the lens shows the labels of exactly the buttons that straight line crosses, in order and never back (worked out
   here independently from the buttons' boxes), letters in English and words in Arabic, the Dock magnification
   is cleared afterwards, the drawer closes only once the glass has arrived, reduced motion jumps, a lone button gets no glass,
   clicks still reach the buttons, Arabic, a 390 px phone and no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const near=(a,b)=>Math.abs(a-b)<=1.5;
const glassOn=sel=>{const c=document.querySelector(sel),g=c&&c.querySelector('.lgx-g');if(!g)return null;
 const L=[...c.querySelectorAll('[data-lgx-i]')],a=L.find(e=>e.hasAttribute('data-lgx-act'));
 const gb=g.getBoundingClientRect(),ab=a&&a.getBoundingClientRect();
 return {g:[gb.left,gb.top,gb.width,gb.height],a:ab&&[ab.left,ab.top,ab.width,ab.height],lens:g.querySelector('.lgx-t').dataset.s,
  label:a&&a.innerText.trim(),cov:(c.querySelector('[data-lgx-on]')||{}).innerText,op:getComputedStyle(g).opacity,
  hidden:a&&getComputedStyle(a).color,scaled:L.filter(e=>e.style.scale).length,n:L.length}};
/* the labels the lens shows while the glass moves, in order of appearance, and how long it moves */
const watch=({sel,ms})=>new Promise(r=>{const o=[],sp=[];const t0=performance.now();let a=0,z=0;const f=()=>{const t=document.querySelector(sel+' .lgx-t'),g=document.querySelector(sel+' .lgx-g');
 if(t&&t.dataset.s&&o[o.length-1]!==t.dataset.s){o.push(t.dataset.s);sp.push([...t.querySelectorAll('.lgx-c')].map(s=>s.textContent.replace(/\u00a0/g,' ')))}
 if(g&&g.classList.contains('mv')){if(!a)a=performance.now();z=performance.now()}
 if(performance.now()-t0<ms)requestAnimationFrame(f);else r({o,sp,ms:Math.round(z-a)})};requestAnimationFrame(f)});
/* the buttons a straight line from the centre of one to the centre of the other crosses, in order (before the click) */
const line=({sel,item,from,to})=>{const B=[...document.querySelectorAll(sel+' '+item)],r=x=>x.getBoundingClientRect(),c=x=>[r(x).left+r(x).width/2,r(x).top+r(x).height/2];
 const a=c(B.find(x=>x.innerText.trim()===from)),z=c(B.find(x=>x.innerText.trim()===to)),o=[];
 for(let k=0;k<=600;k++){const t=k/600,X=a[0]+(z[0]-a[0])*t,Y=a[1]+(z[1]-a[1])*t,h=B.find(x=>{const q=r(x);return X>=q.left&&X<=q.right&&Y>=q.top&&Y<=q.bottom});
  if(h&&o[o.length-1]!==h.innerText.trim())o.push(h.innerText.trim())}return o};
/* the lens showed the crossed buttons in order: a subsequence of the line's list, from its first to its last, most of them */
const along=(o,e)=>{let i=0;for(const x of o){i=e.indexOf(x,i);if(i<0)return false;i++}return o[0]===e[0]&&o[o.length-1]===e[e.length-1]&&o.length>=Math.ceil(e.length*.7)};
(async()=>{const b=await T.launch();
 /* ---------- Fantasy tabs ---------- */
 let {ctx,pg,errs}=await T.open(b,{vw:390,league:'l_4WFCIZ',hash:'#/fantasy'});
 const FS='#fproot > .ctl';
 await pg.waitForSelector(FS+' .lgx-g',{timeout:60000});await pg.waitForTimeout(600);
 let s=await pg.evaluate(glassOn,FS);
 ok(s&&s.n>=10&&s.a&&s.g.every((v,i)=>near(v,s.a[i]))&&s.op==='1','at rest the glass covers the chosen tab exactly ('+(s&&s.label)+', '+(s&&s.n)+' tabs)');
 ok(await pg.$$eval(FS+' > button',a=>a.every(b=>b.className===''||b.className==='s')),'the tabs keep exactly the class the page gave them (state is in data attributes)');
 ok(s.lens===s.label&&s.cov===s.label&&/rgba\(0, 0, 0, 0\)|transparent/.test(s.hidden),'the lens shows the chosen label and the tab underneath lends it (its own text is hidden)');
 const labels=await pg.$$eval(FS+' > button',a=>a.map(x=>x.innerText.trim()));
 const to=labels.length-1;
 let exp=await pg.evaluate(line,{sel:FS,item:'> button',from:s.label,to:labels[to]});
 let w=pg.evaluate(watch,{sel:FS,ms:1500});
 await pg.click(FS+' > button:nth-of-type('+(to+1)+')');
 let v=await w;
 ok(along(v.o,exp),'straight down: the lens shows the tabs the line crosses, in order ('+v.o.join(' → ')+' | line: '+exp.join(' → ')+')');
 ok(exp.length<labels.length-2&&v.ms>0&&v.ms<750,'it does not visit every tab ('+exp.length+' of '+labels.length+' crossed) and arrives in '+v.ms+' ms');
 ok(v.sp.every((p,i)=>p.join('')===v.o[i]&&p.length===Array.from(v.o[i]).length),'per-character: one span per letter in English');
 await pg.waitForTimeout(500);
 s=await pg.evaluate(glassOn,FS);
 ok(s.label===labels[to]&&s.g.every((x,i)=>near(x,s.a[i]))&&s.lens===labels[to],'it stops exactly on the tab pressed ('+labels[to]+')');
 ok(s.scaled===0,'the Dock magnification is cleared when the glass stops');
 ok(await pg.evaluate(()=>FP.tab==='patterns'),'the click went through the glass to the tab (Fantasy now shows Patterns)');
 /* back up and across: from the last tab to the second; then the diagonal of the owner's sketch, My XI → Season review */
 exp=await pg.evaluate(line,{sel:FS,item:'> button',from:labels[to],to:labels[1]});
 w=pg.evaluate(watch,{sel:FS,ms:1500});await pg.click(FS+' > button:nth-of-type(2)');v=await w;
 ok(along(v.o,exp),'up and across: '+v.o.join(' → ')+' | line: '+exp.join(' → '));
 await pg.click(FS+' > button:text-is("My XI")');await pg.waitForTimeout(900);
 exp=await pg.evaluate(line,{sel:FS,item:'> button',from:'My XI',to:'Season review'});
 w=pg.evaluate(watch,{sel:FS,ms:1500});await pg.click(FS+' > button:text-is("Season review")');v=await w;
 ok(along(v.o,exp)&&exp.length>=3,'diagonal from the top right to the bottom: '+v.o.join(' → ')+' | line: '+exp.join(' → '));
 await pg.waitForTimeout(500);
 ok(T.noscroll?await T.noscroll(pg):true,'390 px: no horizontal scroll');
 /* a lone button: no glass */
 const lone=await pg.evaluate(async FS=>{const c=document.querySelector(FS);[...c.querySelectorAll('button')].slice(1).forEach(x=>x.remove());
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {g:!!c.querySelector('.lgx-g'),cls:c.classList.contains('lgx'),act:c.querySelectorAll('[data-lgx-act],[data-lgx-on],[data-lgx-i]').length}},FS);
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
 const dexp=await pg.evaluate(line,{sel:DS,item:'a[href^="#/"]',from:'Fantasy',to:dl[ti][0]});
 w=pg.evaluate(watch,{sel:DS,ms:1200});
 await pg.click(DS+' a[href="'+dl[ti][1]+'"]');
 const mid=await pg.evaluate(()=>({open:document.documentElement.classList.contains('dr-open'),hash:location.hash}));
 ok(mid.open&&mid.hash===dl[ti][1],'the page opens at once, and the drawer stays open while the glass travels');
 v=await w;
 ok(along(v.o,dexp)&&v.o.length>=4&&v.ms<650,'drawer: straight up through the links on the way, in order, '+v.ms+' ms: '+v.o.join(' → '));
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
