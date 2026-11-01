/* Pitch in 3D (assets/pitch3d.js, used by Club shape and by the Full-time story): the 2D chart stays the default; "3D · experimental" swaps it for a tilted pitch built
   from plain elements in a CSS 3D context. Checked against the numbers behind it: a pin for every player at the place of his 2D dot (metres x 8 px) and as high as
   his actions per start (x 1.2, from the table); a pin for every shot of the match at its place (the away side turned round) as high as its xG, goals marked; turning
   by drag and by arrow keys with the tilt kept in range, Reset view, the build-time readout equal to the real element count, each pin facing the screen at two angles
   (its head stays a circle), the choice remembered, Arabic, 390 px, a missing shot file, reduced motion (no opening turn). */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ',K=8;
const num=v=>parseFloat(String(v).replace(/[^\d.\-]/g,''));
const wait=(pg,ms)=>pg.waitForTimeout(ms);
const turn=pg=>pg.evaluate(()=>{const w=document.querySelector('.p3-world'),s=getComputedStyle(w);return {rx:parseFloat(s.getPropertyValue('--rx')),rz:parseFloat(s.getPropertyValue('--rz')),zm:parseFloat(s.getPropertyValue('--zm'))}});
(async()=>{const b=await T.launch();
 /* ---- Club shape: 2D by default, 3D on request, same players at the same places */
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/shape'});await pg.waitForSelector('#cs3t',{timeout:90000});await wait(pg,300);
 ok(!(await pg.$('.p3'))&&!!(await pg.$('.cs-svg')),'default: the 2D chart, no 3D scene');
 const dots=await pg.$$eval('.cs-d.a',a=>a.map(g=>({id:g.dataset.id,x:+g.dataset.x,y:+g.dataset.y,n:+g.dataset.n})));
 const per=await pg.$$eval('.cs-p tbody tr',a=>Object.fromEntries(a.map(r=>[r.dataset.id,parseFloat(r.children[2].textContent)])));
 ok(dots.length>=8,'the 2D chart has '+dots.length+' players');
 ok(await pg.$$eval('#cs3t button',a=>a.map(b=>b.dataset.v+':'+b.getAttribute('aria-pressed')).join())==='2:true,3:false'&&!!(await pg.$('#cs3t.seg')),'the choice is a 2D / 3D group, 2D pressed');
 await pg.click('#cs3t button[data-v="3"]');await pg.waitForSelector('.p3-stage',{timeout:20000});await wait(pg,1300);
 ok(!(await pg.$('.cs-svg'))&&await pg.evaluate(()=>localStorage.getItem('plx_3d'))==='1','3D: the scene replaces the 2D chart and the choice is saved');
 const pins=await pg.$$eval('.p3-pin.a',a=>a.map(p=>({id:p.dataset.id,x:+p.dataset.x,y:+p.dataset.y,h:+p.dataset.h,l:parseFloat(p.style.left),t:parseFloat(p.style.top)})));
 ok(pins.length===dots.length&&dots.every(d=>{const p=pins.find(q=>q.id===d.id);return p&&Math.abs(p.x-d.x)<.01&&Math.abs(p.y-d.y)<.01&&Math.abs(p.l-d.x*K)<.2&&Math.abs(p.t-d.y*K)<.2}),'every player has a pin at the place of his 2D dot (metres x '+K+' px): '+pins.length+' pins');
 ok(pins.every(p=>{const e=Math.max(10,Math.min(150,per[p.id]*1.2));return Math.abs(p.h-e)<=Math.max(0.12*e,1.2)}),'each pin is as high as his actions per start x 1.2 (table value, clamped 10 to 150)');
 const lab=await pg.$$eval('.p3-pin.a .p3-hd span',a=>a.map(s=>s.textContent));ok(lab.length===pins.length&&lab.every(Boolean),'every pin carries the player\'s surname ('+lab.slice(0,3).join(', ')+'…)');
 /* the readout is true */
 const rd=await pg.$eval('.p3-m',e=>e.textContent),els=await pg.$eval('.p3-stage',e=>e.querySelectorAll('*').length);
 const mm=/built in ([\d.]+) ms · (\d+) elements/.exec(rd);ok(mm&&+mm[2]===els&&+mm[1]>0&&+mm[1]<2000,'the readout says how long the scene took and how many elements the scene has, and the count is real ('+rd+')');
 /* the opening turn ends at the resting angle, then drag and keys turn it */
 let t0=await turn(pg);ok(Math.abs(t0.rx-58)<.5&&Math.abs(t0.rz+24)<.5,'it comes to rest at 58 / -24 degrees after the opening turn ('+t0.rx.toFixed(1)+' / '+t0.rz.toFixed(1)+')');
 const bb=await (await pg.$('.p3-stage')).boundingBox();const cx=bb.x+bb.width/2,cy=bb.y+bb.height/2;
 const ratio=()=>pg.evaluate(()=>{const i=document.querySelector('.p3-pin.a .p3-hd i').getBoundingClientRect();return i.width/i.height});
 const r0=await ratio();ok(Math.abs(r0-1)<.12,'a pin\'s head faces the screen (width / height '+r0.toFixed(2)+')');
 await pg.mouse.move(cx,cy);await pg.mouse.down();await pg.mouse.move(cx+120,cy+40,{steps:6});await pg.mouse.up();await wait(pg,150);
 const t1=await turn(pg);ok(Math.abs(t1.rz-(t0.rz+120*.45))<2&&Math.abs(t1.rx-(t0.rx-40*.35))<2,'dragging 120 px across and 40 px down turns it by 0.45 deg per px and tilts it by 0.35 deg per px ('+t1.rz.toFixed(1)+' / '+t1.rx.toFixed(1)+')');
 const r1=await ratio();ok(Math.abs(r1-1)<.12,'after turning, the head still faces the screen ('+r1.toFixed(2)+')');
 await pg.mouse.move(cx,cy);await pg.mouse.down();await pg.mouse.move(cx,cy+2000,{steps:3});await pg.mouse.up();await wait(pg,100);
 ok((await turn(pg)).rx===24,'dragging far down stops at the lowest tilt, 24 degrees');
 await pg.mouse.move(cx,cy);await pg.mouse.down();await pg.mouse.move(cx,cy-3000,{steps:3});await pg.mouse.up();await wait(pg,100);
 ok((await turn(pg)).rx===80,'dragging far up stops at the highest tilt, 80 degrees');
 await pg.click('.p3-reset');await wait(pg,100);t0=await turn(pg);ok(t0.rx===58&&t0.rz===-24,'Reset view puts it back');
 await pg.focus('.p3-stage');await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowUp');await wait(pg,100);
 const t2=await turn(pg);ok(t2.rz===-24+16&&t2.rx===58+6,'two arrow-right presses turn it 16 degrees and arrow-up tilts it 6 ('+t2.rz+' / '+t2.rx+')');
 await pg.keyboard.press('+');await wait(pg,50);ok((await turn(pg)).zm>t2.zm,'+ zooms in');
 ok(!!(await pg.$eval('.p3-stage',e=>e.getAttribute('aria-label'))),'the scene has a label for screen readers');
 /* compare with another club: its pins are the second colour */
 const nc=await pg.$$eval('#csp option',a=>a.length);await pg.selectOption('#csp',{index:2});await pg.waitForSelector('.p3-pin.b',{state:'attached',timeout:20000});await wait(pg,300);
 ok((await pg.$$eval('.p3-pin.b',a=>a.length))>=5&&(await pg.$$eval('.p3-pin.b .p3-hd span',a=>a.length))>=0,'comparing with a club adds its pins in the second colour');
 /* back to 2D */
 await pg.click('#cs3t button[data-v="2"]');await pg.waitForSelector('.cs-svg',{timeout:20000});
 ok(!(await pg.$('.p3'))&&await pg.evaluate(()=>localStorage.getItem('plx_3d'))==='0','back to 2D: the chart returns and the choice is saved');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the choice is remembered on the next visit */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/shape',init:{plx_3d:'1'}}));await pg.waitForSelector('.p3-stage',{timeout:90000});
 ok(await pg.$eval('#cs3t button[data-v="3"]',e=>e.getAttribute('aria-pressed'))==='true','a saved 3D choice opens the page in 3D');await ctx.close();
 /* reduced motion: no opening turn */
 {const c=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await c.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en');localStorage.setItem('plx_3d','1')}});
  const p=await c.newPage();await p.goto('http://127.0.0.1:8765/#/shape');await p.waitForSelector('.p3-stage',{timeout:90000});const t=await turn(p);
  ok(t.rx===58&&t.rz===-24,'reduced motion: it starts at the resting angle, no opening turn');await c.close()}
 /* ---- the Full-time story: a pin for every shot of the match */
 const S=J('story.json'),LGF=J(LG+'.json'),SH=J(LG+'_sh.json');const C={};SH.cols.forEach((n,i)=>C[n]=i);
 const mid=Object.keys(S.m).find(k=>S.m[k].lg===LG&&S.m[k].c&&S.m[k].g.length>=3);const mt=LGF.matches.find(x=>x.i===mid);
 const rows=SH.rows.filter(r=>r[C.m]===mid&&!r[C.og]&&r[C.x]!=null&&r[C.y]!=null);
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/recap/'+mid}));await pg.waitForSelector('#rc3t',{timeout:90000});await wait(pg,300);
 ok(!(await pg.$('.p3'))&&await pg.$eval('#rc3t button[data-v="2"]',e=>e.getAttribute('aria-pressed'))==='true','the story page: the 3D shot map is off by default');
 await pg.click('#rc3t button[data-v="3"]');await pg.waitForSelector('.p3-pin',{state:'attached',timeout:30000});await wait(pg,1200);
 const sp=await pg.$$eval('.p3-pin',a=>a.map(p=>({x:+p.dataset.x,y:+p.dataset.y,h:+p.dataset.h,a:p.classList.contains('a'),g:p.classList.contains('p3-goal'),l:(p.querySelector('span')||{}).textContent||''})));
 ok(sp.length===rows.length,'a pin for every shot of the match: '+sp.length+' (the shot file has '+rows.length+' without own goals)');
 const exp=rows.map(r=>{const hm=r[C.c]===mt.h;return {x:hm?r[C.x]:105-r[C.x],y:hm?r[C.y]:68-r[C.y],h:Math.max(12,Math.min(170,12+(+r[C.xg]||0)*230)),a:hm,g:r[C.ev]==='Goal'}});
 const left=sp.slice();let miss=0;
 for(const e of exp){const i=left.findIndex(p=>p.a===e.a&&p.g===e.g&&Math.abs(p.x-e.x)<.02&&Math.abs(p.y-e.y)<.02&&Math.abs(p.h-e.h)<.15);if(i<0)miss++;else left.splice(i,1)}
 ok(miss===0&&left.length===0,'place, side, height (12 + 230 x xG, 12 to 170) and goal mark of every pin equal the shot file\'s, the away side turned round ('+miss+' unmatched)');
 ok(sp.filter(p=>p.g).length===rows.filter(r=>r[C.ev]==='Goal').length&&sp.filter(p=>p.g).every(p=>/^\d+'$/.test(p.l)),'every goal is marked and labelled with its minute');
 ok(sp.filter(p=>p.a).every(p=>p.x>=0&&p.x<=105)&&sp.filter(p=>!p.a).every(p=>p.x>=0&&p.x<=105),'all pins are inside the pitch');
 await pg.click('#rc3t button[data-v="2"]');await wait(pg,150);ok(!(await pg.$('.p3')),'Off removes the scene');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the shot file fails */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'',init:{plx_3d:'1'}}));await ctx.route(/_sh\.json/,r=>r.fulfill({status:503,body:'x'}));await pg.goto(pg.url().split('#')[0]+'#/recap/'+mid);await pg.waitForSelector('#rc3d .empty:not(.skel)',{timeout:60000});
 ok(/No shot positions/.test(await pg.innerText('#rc3d')),'a shot file that fails: the card says so, no scene');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic and the phone */
 for(const [hash,sel] of [['#/shape','.p3-stage'],['#/recap/'+mid,'.p3-stage']]){
  ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:LG,hash,init:{plx_3d:'1'}}));await pg.waitForSelector(sel,{timeout:90000});await wait(pg,1300);
  const w=await pg.$eval('.p3-stage',e=>e.getBoundingClientRect().width);ok(await T.noscroll(pg)&&w<=390,'Arabic phone '+hash.slice(0,8)+': no horizontal scroll, the scene fits ('+Math.round(w)+' px)');
  ok(/عنصر/.test(await pg.$eval('.p3-m',e=>e.textContent))&&/إعادة/.test(await pg.$eval('.p3-reset',e=>e.textContent)),'Arabic: the readout and the button are in Arabic');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/p3d_390_ar_'+(hash.includes('shape')?'shape':'story')+'.png'});await ctx.close()}
 await T.done(b)})();
