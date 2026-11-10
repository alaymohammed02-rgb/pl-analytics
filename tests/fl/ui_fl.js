/* The floodlit look (end of assets/identity.css) and the league switch (assets/league-switch.js).
   League switch: with the new league's file held back, picking a league shows one fixed layer above the page with that league's name (the picker's own text) and
   its colour (the theme's own accent for that league), it takes no clicks (a button under it still works) and is hidden from screen readers; it stays while the
   data loads, leaves once it has (0.75 s at least), and leaves after 5 s when the data never comes; two quick picks leave one layer, for the last league; with
   reduced motion there is none. The look: the page's light, a card's shadow and lit top edge are in place and nothing moved (the header, the room bar and a card
   keep their boxes with and without the new rules); text keeps its contrast on a card; a 390 px phone in Arabic and English. */
const T=require('../nf/lib.js');const {ok}=T;
const PL='l_4WFCIZ',BL='l_1Isor4',LL='l_0ErfuF';
const lum=c=>{const v=c.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
(async()=>{const b=await T.launch();
 /* --- the switch, with the new league's data held back */
 {const ctx=await b.newContext({viewport:{width:1280,height:800}});let rel;const gate=new Promise(r=>rel=r);
  await ctx.route(new RegExp(BL+'\\.json'),async r=>{await gate;r.continue()});await ctx.addInitScript(l=>{localStorage.setItem('league',l)},PL);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('#lt .ltr[data-t]',{timeout:90000});
  ok(!(await pg.$('#lgsw')),'no layer before a league is picked');
  const want=await pg.evaluate(id=>({name:[...document.querySelectorAll('#lgpick option')].find(o=>o.value===id).textContent.trim(),hi:thLeaguePal(id).hi}),BL);
  await pg.selectOption('#lgpick',BL);await pg.waitForSelector('#lgsw.in',{timeout:5000});await pg.waitForTimeout(900);
  const st=await pg.evaluate(()=>{const e=document.getElementById('lgsw'),cs=getComputedStyle(e),n=e.querySelector('.sw-name'),r=n.getBoundingClientRect();
   return {n:document.querySelectorAll('#lgsw').length,pe:cs.pointerEvents,pos:cs.position,aria:e.getAttribute('aria-hidden'),name:n.textContent,c:e.style.getPropertyValue('--sw-c').trim(),lg:e.dataset.lg,
    mid:Math.abs((r.left+r.right)/2-innerWidth/2)<2,inside:r.left>=0&&r.right<=innerWidth,veil:+getComputedStyle(e.querySelector('.sw-veil')).opacity,ring:e.querySelector('.sw-ring').getBoundingClientRect().width>=innerWidth,parent:e.parentNode===document.body}});
  ok(st.n===1&&st.parent&&st.pos==='fixed'&&st.pe==='none'&&st.aria==='true','picking a league: one fixed layer on the page, no pointer events, hidden from screen readers');
  ok(st.name===want.name&&st.lg===BL&&st.c.toLowerCase()===want.hi.toLowerCase(),'it carries the league\'s name ('+st.name+') and the theme\'s own colour for it ('+st.c+')');
  ok(st.mid&&st.inside&&st.veil>.6&&st.ring,'the name stands in the middle of the screen, the lights are dimmed and the circle has opened over the page');
  ok(await pg.evaluate(()=>D.id)===PL,'the page under it still holds the old league while the new file is on its way');
  await pg.click('#langbtn');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>document.documentElement.lang)==='ar'&&!!(await pg.$('#lgsw')),'a button under the layer still takes a click (the language changed) and the layer stays');
  await pg.click('#langbtn');await pg.waitForTimeout(150);
  rel();await pg.waitForFunction(id=>D.id===id,BL,{timeout:60000});await pg.waitForFunction(()=>!document.getElementById('lgsw'),null,{timeout:6000});
  ok(await pg.evaluate(()=>document.documentElement.dataset.league)!==undefined&&(await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th-hi').trim().toLowerCase()))===want.hi.toLowerCase(),'once the data is in the layer leaves and the page wears the new league\'s colour');
  await pg.waitForSelector('#lt .ltr[data-t]',{timeout:60000});ok(await pg.$$eval('#lt .ltr[data-t]',a=>a.length)===18,'and the new league\'s table is drawn (18 clubs)');
  /* a quick switch (data ready fast): at least 0.75 s on screen */
  const t0=Date.now();await pg.selectOption('#lgpick',PL);await pg.waitForSelector('#lgsw',{timeout:3000});await pg.waitForFunction(()=>!document.getElementById('lgsw'),null,{timeout:8000});const dt=Date.now()-t0;
  ok(dt>=700&&dt<4000,'a league that loads at once still gets its moment: the layer stayed '+dt+' ms');
  /* two quick picks: one layer, for the last league */
  await pg.selectOption('#lgpick',LL);await pg.selectOption('#lgpick',BL);await pg.waitForTimeout(200);
  ok(await pg.$$eval('#lgsw',a=>a.length===1&&a[0].dataset.lg)===BL,'two quick picks leave one layer, for the last league');
  await pg.waitForFunction(()=>!document.getElementById('lgsw'),null,{timeout:8000});
  ok((await pg.evaluate(()=>INS.leagueSwitch.state())).n===4&&!errs.length,'four switches counted, no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* --- data that never comes: the layer leaves by itself */
 {const ctx=await b.newContext({viewport:{width:1000,height:700}});await ctx.route(new RegExp(BL+'\\.json'),r=>r.fulfill({status:500,body:''}));await ctx.addInitScript(l=>{localStorage.setItem('league',l)},PL);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('#lt .ltr[data-t]',{timeout:90000});
  await pg.selectOption('#lgpick',BL);await pg.waitForSelector('#lgsw',{timeout:3000});await pg.waitForFunction(()=>!document.getElementById('lgsw'),null,{timeout:8000});
  ok(!errs.length,'a league file that fails: the layer leaves within its 5 seconds, no error');await ctx.close()}
 /* --- reduced motion: no layer */
 {const ctx=await b.newContext({viewport:{width:1000,height:700},reducedMotion:'reduce'});await ctx.addInitScript(l=>{localStorage.setItem('league',l)},PL);
  const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('#lt .ltr[data-t]',{timeout:90000});
  await pg.selectOption('#lgpick',BL);await pg.waitForTimeout(250);const seen=!!(await pg.$('#lgsw'));await pg.waitForFunction(id=>D.id===id,BL,{timeout:60000});
  ok(!seen&&(await pg.evaluate(()=>INS.leagueSwitch.state())).n===1,'reduced motion: the league changes with no layer');await ctx.close()}
 /* --- the look: light and shadow are there, nothing moved */
 {const {ctx,pg,errs}=await T.open(b,{vw:1280,league:PL,hash:'#/overview'});await pg.waitForSelector('.rm-tile',{timeout:90000});await pg.waitForTimeout(600);
  const box=()=>pg.evaluate(()=>['header','#secnav','.rm-tile','.rm-pick','#gsq','#lgpick','h2'].map(s=>{const e=document.querySelector(s);if(!e)return s+':none';const r=e.getBoundingClientRect();return s+':'+[r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10).join(',')}));
  const withRules=await box();
  /* the same page with the Floodlit rules taken out of the stylesheet */
  await pg.evaluate(()=>{for(const sh of document.styleSheets){let rules;try{rules=sh.cssRules}catch(e){continue}if(!sh.href||!/identity\.css/.test(sh.href))continue;
    let cut=-1;for(let i=0;i<rules.length;i++){if(rules[i].selectorText===':root'&&/--fl-rim/.test(rules[i].cssText)){cut=i;break}}
    window.__cut=cut;if(cut>=0)for(let i=rules.length-1;i>=cut;i--)sh.deleteRule(i)}});
  await pg.waitForTimeout(200);const without=await box();
  ok(await pg.evaluate(()=>window.__cut)>0&&JSON.stringify(withRules)===JSON.stringify(without),'with and without the Floodlit rules the header, the room bar, a tile, the pick, the search box, the league picker and the title keep the same boxes');
  await pg.reload();await pg.waitForSelector('.rm-tile',{timeout:90000});await pg.waitForTimeout(500);
  const L=await pg.evaluate(()=>{const cs=(s,p)=>{const e=document.querySelector(s);return e?getComputedStyle(e,p||null):null};const t=cs('.rm-tile'),h=cs('header'),bg=cs('body','::before'),h2=cs('h2');
   return {tile:t.boxShadow,tileTop:t.borderTopColor,tileSide:t.borderLeftColor,head:h.boxShadow,bg:bg.backgroundImage,pe:bg.pointerEvents,h2:h2.textShadow,tt:h2.textTransform}});
  ok(/inset/.test(L.tile)&&(L.tile.match(/rgb/g)||[]).length>=5&&L.tileTop!==L.tileSide,'a tile stands on the page: a lit top edge (its top border differs from its sides) and a shadow of several layers');
  ok(L.head!=='none'&&(L.head.match(/rgb/g)||[]).length>=3,'the header throws the longest shadow, with a line of the league\'s light under it');
  ok((L.bg.match(/gradient/g)||[]).length>=7&&L.pe==='none','the page behind: the cone of light, the beams, the pitch drawing and the dark at the edges ('+(L.bg.match(/gradient/g)||[]).length+' layers), no pointer events');
  ok(L.h2!=='none'&&L.tt==='none','titles glow a little; no text-transform');
  /* contrast of text on a tile and on a card */
  const C=await pg.evaluate(()=>{const bgOf=e=>{for(let x=e;x;x=x.parentElement){const c=getComputedStyle(x).backgroundColor;const m=c.match(/[\d.]+/g);if(m&&(m.length<4||+m[3]>.5))return c}return 'rgb(10,26,30)'};
   const pick=s=>{const e=document.querySelector(s);return e?[getComputedStyle(e).color,bgOf(e)]:null};return {tile:pick('.rm-tile b, .rm-tile h3, .rm-tile strong')||pick('.rm-tile'),mu:pick('.rm-tile .mu, .rm-n'),page:[getComputedStyle(document.body).color,'rgb(10,26,30)']}});
  const c1=cr(rgb(C.tile[0]),rgb(C.tile[1])),c2=C.mu?cr(rgb(C.mu[0]),rgb(C.mu[1])):99,c3=cr(rgb(C.page[0]),rgb(C.page[1]));
  ok(c1>=7&&c3>=7&&c2>=4.5,'contrast: a tile\'s title '+c1.toFixed(1)+':1, its small text '+c2.toFixed(1)+':1, the page\'s text '+c3.toFixed(1)+':1');
  await pg.evaluate(()=>{location.hash='#/table'});await pg.waitForSelector('#lt .ltr[data-t]',{timeout:60000});
  const tb=await pg.evaluate(()=>{const lt=getComputedStyle(document.getElementById('lt')),th=getComputedStyle(document.querySelector('#lt .lth'));return [lt.boxShadow!=='none',th.boxShadow!=='none']});
  ok(tb[0]&&tb[1],'the table stands on the page and its head has a line of light');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:PL,hash:'#/table'});await pg.waitForSelector('#lt .ltr[data-t]',{timeout:90000});
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  await pg.selectOption('#lgpick',LL);await pg.waitForSelector('#lgsw.in',{timeout:5000});await pg.waitForTimeout(500);
  const m=await pg.evaluate(()=>{const r=document.querySelector('#lgsw .sw-name').getBoundingClientRect();return {in:r.left>=0&&r.right<=innerWidth,fs:parseFloat(getComputedStyle(document.querySelector('#lgsw .sw-name')).fontSize)}});
  ok(m.in&&m.fs>=38&&await T.noscroll(pg),lang+' phone: the league\'s name fits the screen ('+m.fs+' px) and the layer adds no scroll');
  await pg.waitForFunction(()=>!document.getElementById('lgsw'),null,{timeout:10000});
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/fl_390_'+lang+'.png'});await ctx.close()}
 await T.done(b)})();
