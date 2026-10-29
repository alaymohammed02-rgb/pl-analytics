/* Liquid Glass on every bar of choice buttons (assets/liquid-glass.js): the page bars (#hubbar: one row, or the two rows of the Tactics
   hub), the level bar, the day strip of the Overview, the segmented choices (.seg, .hchips), next to the Fantasy and tab bars that had it.
   - Every bar on a page has its own glass (three at once on the Shots page); at rest it covers the chosen button exactly and the copy
     holds every letter (every word in Arabic) where the browser drew it.
   - Same movement as the Fantasy tabs: a new choice sends the glass in a straight line, in under 0.7 s, with the lens on while it moves,
     and it stops exactly on the button; a bar that is drawn again (a page change, a level change) keeps its glass and the glass slides.
   - A bar whose buttons are other ones now (the pages of another group) shows its glass on the chosen one at once, no slide.
   - Press, drag and let go over another button of the page bar chooses it; single actions (save, share, example chips) get no glass.
   - Arabic, 390 px, no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const near=(a,b,t)=>Math.abs(a-b)<=(t||1.5);
const glassOn=sel=>{const c=document.querySelector(sel),g=c&&c.querySelector(':scope > .lgx-g');if(!g)return null;
 const L=[...c.querySelectorAll('[data-lgx-i]')],a=L.find(e=>e.hasAttribute('data-lgx-act'));
 const gb=g.getBoundingClientRect(),ab=a&&a.getBoundingClientRect();
 return {g:[gb.left,gb.top,gb.width,gb.height],a:ab&&[ab.left,ab.top,ab.width,ab.height],label:a&&a.innerText.trim(),op:getComputedStyle(g).opacity,n:L.length,
  scaled:L.filter(e=>e.style.scale).length,lensed:[...g.querySelectorAll('.lgx-w>i')].filter(i=>i.style.scale).length}};
const copyOk=sel=>{const c=document.querySelector(sel),g=c.querySelector(':scope > .lgx-g'),P=[...g.querySelectorAll('.lgx-wt>i')].map(i=>({c:i.dataset.c,r:i.getBoundingClientRect()}));
 const R=document.createRange(),L=[...c.querySelectorAll('[data-lgx-i]')];let want=0,hit=0;
 L.forEach(e=>{const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const s=n.data,re=/[\u0600-\u06FF]/.test(s)?/\S+/g:/\S/gu;let m;
  while((m=re.exec(s))){R.setStart(n,m.index);R.setEnd(n,m.index+m[0].length);const r=R.getBoundingClientRect();if(!r.width)continue;want++;
   if(P.some(p=>p.c===m[0]&&Math.abs(p.r.left-r.left)<=1&&Math.abs(p.r.top-r.top)<=1&&Math.abs(p.r.width-r.width)<=1))hit++}}});
 return {want,hit,words:P.map(p=>p.c)}};
/* every frame: the centre of the glass of the bar, whether it is moving, and the largest lens scale of a letter inside it */
const watch=({sel,ms})=>new Promise(r=>{const o=[],t0=performance.now();let a=0,z=0;
 const f=()=>{const c=document.querySelector(sel),g=c&&c.querySelector(':scope > .lgx-g');
  if(g){const b=g.getBoundingClientRect(),G=window.LGX.groups.find(x=>x.box===c);let k=1;
   if(G)G.P.forEach(p=>{if(p.pill||p.it<0)return;const q=p.el.getBoundingClientRect(),cx=q.left+q.width/2,cy=q.top+q.height/2;
    if(cx>b.left&&cx<b.right&&cy>b.top&&cy<b.bottom)k=Math.max(k,...(p.el.style.scale||'1').split(' ').map(parseFloat))});
   const mv=g.classList.contains('mv');if(mv){if(!a)a=performance.now();z=performance.now()}
   o.push({x:b.left+b.width/2,y:b.top+b.height/2,mv,k})}
  if(performance.now()-t0<ms)requestAnimationFrame(f);else r({o,ms:Math.round(z-a)})};requestAnimationFrame(f)});
const centre=(pg,s)=>pg.$eval(s,e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
const off=(o,A,B)=>{const dx=B[0]-A[0],dy=B[1]-A[1],d=Math.hypot(dx,dy)||1,M=o.filter(f=>f.mv);return M.length?Math.max(...M.map(f=>Math.abs((f.x-A[0])*dy-(f.y-A[1])*dx)/d)):99};
const lgx=pg=>pg.evaluate(()=>[...document.querySelectorAll('.lgx')].filter(b=>b.querySelector(':scope > .lgx-g')).map(b=>(b.id?'#'+b.id:'')+'.'+[...b.classList].filter(c=>!/^lgx/.test(c)).join('.')));
const go=async(pg,h,sel)=>{await pg.evaluate(x=>location.hash=x,h);await pg.waitForSelector(sel,{timeout:90000,state:'attached'});await pg.waitForTimeout(1800)};
/* click a button of a bar and follow its glass; returns what it did */
const slide=async(pg,bar,from,to)=>{const A=await centre(pg,from),B=await centre(pg,to);const w=pg.evaluate(watch,{sel:bar,ms:1300});await pg.click(to);return {v:await w,A,B}};
const rest=(s,m)=>ok(s&&s.a&&s.g.every((x,i)=>near(x,s.a[i]))&&s.op==='1',m+(s?' ('+s.label+')':''));
(async()=>{const b=await T.launch();
 /* ---------- the Shots page: three bars, three glasses ---------- */
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/shots'});
 await pg.waitForSelector('.hb-p > .lgx-g, .hb-p.lgx',{timeout:90000});await pg.waitForTimeout(1500);
 let L=await lgx(pg);
 ok(L.includes('.hb-g')&&L.includes('.hb-p')&&L.includes('.lv-bar'),'Shots: the group row, the page row and the level bar each have their own glass at once ('+L.join(' ')+')');
 for(const sel of ['.hb-g','.hb-p','.lv-bar']){const s=await pg.evaluate(glassOn,sel);rest(s,sel+': the glass covers the chosen button exactly')}
 ok(await pg.$$eval('.hb-g a,.hb-p a,.lv-bar button',a=>a.every(e=>e.className===''||e.className==='on')),'the buttons keep the classes the page gave them (the choice is also shown in a data attribute)');
 const cp=await pg.evaluate(copyOk,'.hb-p');ok(cp.want>10&&cp.hit===cp.want,'page row: every letter is in the copy where the browser drew it ('+cp.hit+'/'+cp.want+')');
 /* a page of the same group: the glass of the page row slides */
 let m=await slide(pg,'.hb-p','.hb-p a.on','.hb-p a:nth-of-type(3)');
 ok(off(m.v.o,m.A,m.B)<=2.5&&m.v.ms>0&&m.v.ms<700,'page row: the glass slides straight to the new page ('+off(m.v.o,m.A,m.B).toFixed(1)+' px off, '+m.v.ms+' ms)');
 ok(Math.max(...m.v.o.map(f=>f.k))>1.1,'page row: the lens magnifies the letters while it moves');
 await pg.waitForTimeout(900);rest(await pg.evaluate(glassOn,'.hb-p'),'page row: it stops exactly on the page opened');
 ok(await pg.evaluate(()=>location.hash)==='#/heatmaps','the page changed with the click ('+await pg.evaluate(()=>location.hash)+')');
 /* another group: the group row slides, the page row shows other pages, so its glass is simply on the chosen one */
 const seen=pg.evaluate(()=>new Promise(r=>{let mv=false;const t0=performance.now();const f=()=>{const g=document.querySelector('.hb-p > .lgx-g');if(g&&g.classList.contains('mv'))mv=true;performance.now()-t0<1100?requestAnimationFrame(f):r(mv)};f()}));
 m=await slide(pg,'.hb-g','.hb-g a.on','.hb-g a:nth-of-type(2)');
 ok(off(m.v.o,m.A,m.B)<=2.5&&m.v.ms>0&&m.v.ms<700,'group row: the glass slides straight to Defence ('+m.v.ms+' ms)');
 ok(!(await seen),'page row: other pages after the change of group, its glass is on the chosen page at once, no slide');
 await pg.waitForTimeout(500);rest(await pg.evaluate(glassOn,'.hb-p'),'page row: the glass is on the chosen page of the new group');
 /* the level bar: the page is drawn again, the glass keeps its place and slides */
 m=await slide(pg,'.lv-bar','.lv-bar button.on','.lv-bar button[data-l="b"]');
 ok(m.v.ms>0&&m.v.ms<700&&off(m.v.o,m.A,m.B)<=4,'level bar: Beginner slides in ('+m.v.ms+' ms) although the page is drawn again');
 await pg.waitForTimeout(800);let s=await pg.evaluate(glassOn,'.lv-bar');rest(s,'level bar: it stops on Beginner');
 ok(await pg.evaluate(()=>document.documentElement.dataset.lvl)==='b','the level changed with the click');
 /* press, drag, let go over another page: the page opens */
 await go(pg,'#/shots','.hb-p a');
 const C0=await centre(pg,'.hb-p a.on'),C1=await centre(pg,'.hb-p a:nth-of-type(2)');
 await pg.mouse.move(C0[0],C0[1]);await pg.mouse.down();await pg.waitForTimeout(300);
 for(let i=1;i<=12;i++){await pg.mouse.move(C0[0]+(C1[0]-C0[0])*i/12,C0[1]+(C1[1]-C0[1])*i/12);await pg.waitForTimeout(16)}
 await pg.waitForTimeout(150);s=await pg.evaluate(glassOn,'.hb-p');ok(near(s.g[0]+s.g[2]/2,C1[0],6),'page row: dragging the glass follows the pointer');
 await pg.mouse.up();await pg.waitForTimeout(900);
 ok(await pg.evaluate(()=>location.hash)==='#/reality','page row: letting go over Reality Check opens it ('+await pg.evaluate(()=>location.hash)+')');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- the Overview: the page row and the day strip ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/overview'}));
 await pg.waitForSelector('.mb-days button',{timeout:90000});await pg.waitForTimeout(1800);
 L=await lgx(pg);ok(L.some(x=>/mb-days/.test(x))&&L.some(x=>/^#hubbar/.test(x)),'Overview: the page bar and the day strip have a glass ('+L.join(' ')+')');
 s=await pg.evaluate(glassOn,'.mb-days');rest(s,'day strip: the glass covers the chosen day exactly');
 const days=await pg.$$eval('.mb-days button',a=>a.map((e,i)=>[i,e.classList.contains('on')]));const cur=days.findIndex(x=>x[1]),nxt=cur>0?cur-1:cur+1;
 m=await slide(pg,'.mb-days','.mb-days button:nth-of-type('+(cur+1)+')','.mb-days button:nth-of-type('+(nxt+1)+')');
 ok(m.v.ms>0&&m.v.ms<700&&off(m.v.o,m.A,m.B)<=2.5,'day strip: the glass slides to the day pressed ('+m.v.ms+' ms)');
 await pg.waitForTimeout(900);rest(await pg.evaluate(glassOn,'.mb-days'),'day strip: it stops on the day pressed');
 ok(!errs.length,'Overview: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- the segmented choices ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/compare'}));
 await pg.waitForSelector('.seg button',{timeout:90000});await pg.waitForTimeout(1800);
 s=await pg.evaluate(glassOn,'.seg');rest(s,'Comparison Lab: the glass covers the chosen of Players / Teams');
 m=await slide(pg,'.seg','.seg button.on','.seg button:not(.on)');
 ok(m.v.ms>0&&m.v.ms<700&&off(m.v.o,m.A,m.B)<=2.5,'Comparison Lab: the glass slides to the other choice ('+m.v.ms+' ms)');
 await pg.waitForTimeout(900);rest(await pg.evaluate(glassOn,'.seg'),'Comparison Lab: it stops on the choice made');
 await go(pg,'#/thrill','.seg button');
 s=await pg.evaluate(glassOn,'.seg');rest(s,'Thrill index: a choice marked by aria-pressed gets its glass too');
 ok(await pg.evaluate(()=>document.querySelector('.seg').querySelectorAll('button[aria-pressed="true"]').length)===1,'exactly one button of the group is pressed');
 await go(pg,'#/round','#hrkp button');
 L=await lgx(pg);ok(L.some(x=>/hchips/.test(x)),'Round review: the position and measure chips have a glass ('+L.filter(x=>/hchips/.test(x)).join(' ')+')');
 for(const sel of ['#hrkp','#hrkc']){rest(await pg.evaluate(glassOn,sel),sel+': the glass covers the chosen chip exactly')}
 await go(pg,'#/sim','.sm-fb button');
 L=await lgx(pg);const nfb=await pg.$$eval('.sm-fb',a=>a.length);ok(nfb>=2&&L.filter(x=>/sm-fb/.test(x)).length===nfb,'Season simulator: every home / draw / away choice has its own glass ('+L.filter(x=>/sm-fb/.test(x)).length+' of '+nfb+')');
 /* single actions have no glass */
 await go(pg,'#/ask','.ak-chip');ok(!(await pg.evaluate(()=>!!document.querySelector('.ak-ex .lgx-g'))),'example chips of Ask the site (single actions) have no glass');
 await go(pg,'#/rare','.rr-ch button');ok(!(await pg.evaluate(()=>!!document.querySelector('.rr-ch .lgx-g'))),'the league links of the Rare page (single actions) have no glass');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- Arabic and a phone ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/shots'}));
 await pg.waitForSelector('.hb-p > .lgx-g',{timeout:90000});await pg.waitForTimeout(1800);
 for(const sel of ['.hb-g','.hb-p','.lv-bar']){const c=await pg.evaluate(copyOk,sel);ok(c.want>0&&c.hit===c.want,'Arabic: '+sel+' every word is in the copy where the browser drew it ('+c.hit+'/'+c.want+')');
  ok(c.words.filter(w=>/[\u0600-\u06FF]/.test(w)).every(w=>w.length>1),'Arabic: '+sel+' lensed word by word, never single letters')}
 m=await slide(pg,'.hb-p','.hb-p a.on','.hb-p a:nth-of-type(2)');
 ok(m.v.ms>0&&m.v.ms<700&&off(m.v.o,m.A,m.B)<=2.5,'Arabic (right to left): the page row glass slides straight ('+m.v.ms+' ms)');
 await pg.waitForTimeout(900);rest(await pg.evaluate(glassOn,'.hb-p'),'Arabic: it stops on the page opened');
 ok(await T.noscroll(pg),'phone: no horizontal scroll with the glass on every bar');
 ok(!errs.length,'phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---------- reduced motion ---------- */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/shots'}));await pg.emulateMedia({reducedMotion:'reduce'});
 await pg.waitForSelector('.hb-p > .lgx-g',{timeout:90000});await pg.waitForTimeout(1200);
 const w=pg.evaluate(watch,{sel:'.hb-p',ms:900});await pg.click('.hb-p a:nth-of-type(3)');const rm=await w;
 ok(!rm.o.some(f=>f.mv),'reduced motion: the glass is on the new page at once, no slide');
 ok(!errs.length,'reduced motion: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 await T.done(b)})();
