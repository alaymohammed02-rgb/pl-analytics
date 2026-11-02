/* "Scores" look (assets/fm-style.js, the end of assets/identity.css; opt-in, class `fm` on <html>, choice in localStorage `plx_style`).
   - off by default: no class, no bottom bar, no tiles, and the page's own colours;
   - on (?style=fm, or the "Look" button in the menu drawer): a pure black page, grey header, one green accent; NOTHING changes size (the day strip, group headers and match rows have the
     same heights with the look off and on);
   - Your teams as colour tiles: one per starred team, the club's name, a link to its page, a remove button that removes the team, and the team's next match from data/fixtures.json
     recomputed here by a second implementation (opponent, and day and time in UTC); a missing fixtures file leaves the tile without a match line;
   - the bottom bar on a phone: Home, Season, Teams, Fantasy and More; each link opens the page UI_SEC says for its hub, the open hub is marked, More opens the menu, the page makes room
     for the bar, no sideways scroll; on a wide screen there is no bar;
   - the drawer's switch turns the look off and on again; Arabic right to left (tiles start on the right); reduced motion; no page errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_4WFCIZ';
const fx=T.J('fixtures.json');
const now=Date.now();
const ALLFX=[];Object.entries(fx.leagues||{}).forEach(([l,L])=>(L||[]).forEach(f=>{const t=Date.parse(f.k);if(!isNaN(t))ALLFX.push({l,h:f.h,a:f.a,t})}));
const upcoming=ALLFX.filter(f=>f.t>now+36e5).sort((a,b)=>a.t-b.t);
/* a second implementation of "the next match of a team" and of its label, in UTC */
const nextOf=name=>{let best=null;ALLFX.forEach(f=>{if((f.h===name||f.a===name)&&f.t>=Date.now()-2*36e5&&(!best||f.t<best.t))best=f});return best};
const dk=t=>{const d=new Date(t);return d.getUTCFullYear()+'-'+d.getUTCMonth()+'-'+d.getUTCDate()};
const label=(t,ar)=>{const tm=new Date(t).toLocaleTimeString(ar?'ar-u-ca-gregory-nu-latn':'en-GB',{hour:'numeric',minute:'2-digit',timeZone:'UTC'});
 if(dk(t)===dk(Date.now()))return (ar?'اليوم، ':'Today, ')+tm;if(dk(t)===dk(Date.now()+864e5))return (ar?'غدًا، ':'Tomorrow, ')+tm;
 return new Date(t).toLocaleDateString(ar?'ar-u-ca-gregory-nu-latn':'en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})+', '+tm};
const norm=s=>String(s).replace(/[\u2066-\u2069\u200e\u200f]/g,'').replace(/[\s\u202f\u00a0]+/g,' ').trim();

async function open(b,{vw=390,lang='en',style=null,favs=[],reduced=false,block=false}={}){
 const phone=vw<500;
 const ctx=await b.newContext({viewport:{width:vw,height:844},hasTouch:phone,isMobile:phone,timezoneId:'UTC',reducedMotion:reduced?'reduce':'no-preference'});
 await ctx.addInitScript(([l,lg,fv,st])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l);
  if(fv.length)localStorage.setItem('plx_favs_v2',JSON.stringify({v:2,t:fv}));if(st)localStorage.setItem('plx_style',st)}},[lang,LG,favs,style]);
 if(block)await ctx.route('**/data/fixtures.json*',r=>r.abort());
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 pg.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_TUNNEL|cdn.pitchapi|Failed to load resource/.test(m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('.mb-days .on',{timeout:90000});await pg.waitForTimeout(400);
 return {ctx,pg,errs}}
const geo=pg=>pg.evaluate(()=>({days:[...document.querySelectorAll('.mb-days button')].map(e=>Math.round(e.getBoundingClientRect().height*100)/100),
 heads:[...document.querySelectorAll('.mb-lh')].map(e=>Math.round(e.getBoundingClientRect().height*100)/100),
 rows:[...document.querySelectorAll('.mb-r')].map(e=>Math.round(e.getBoundingClientRect().height*100)/100),
 widths:[...document.querySelectorAll('.mb-g')].map(e=>Math.round(e.getBoundingClientRect().width*100)/100)}));
const rgb=(pg,sel,prop)=>pg.$eval(sel,(e,p)=>getComputedStyle(e)[p],prop);

(async()=>{const b=await T.launch();
 if(upcoming.length<2)console.log('note: fewer than two upcoming fixtures in data/fixtures.json; the next-match checks use what is there');
 const t1=upcoming.length?{l:upcoming[0].l,t:upcoming[0].h}:{l:LG,t:'Everton'};
 const o2=upcoming.find(f=>f.l!==t1.l&&f.h!==t1.t)||upcoming.find(f=>f.h!==t1.t&&f.a!==t1.t)||upcoming[0];
 const t2=o2?{l:o2.l,t:o2.h===t1.t?o2.a:o2.h}:{l:LG,t:'Newcastle United'};
 const favs=[t1,t2];

 /* ---- off by default: the page as it was ---- */
 let A;
 {const {ctx,pg,errs}=await open(b,{favs});
  ok(await pg.evaluate(()=>!document.documentElement.classList.contains('fm')&&!document.getElementById('fmbar')&&!document.querySelector('.fm-tiles')),'the look is off by default: no class on <html>, no bottom bar, no tiles');
  ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.ovt .ovt-l')).display!=='none'),'with the look off, the chips of Your teams are shown as before');
  const bg=await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor);ok(bg!=='rgb(0, 0, 0)','with the look off the page keeps the night-pitch colour ('+bg+')');
  A=await geo(pg);ok(A.rows.length>0&&A.heads.length>0&&A.days.length>2,'the board has rows ('+A.rows.length+'), group headers ('+A.heads.length+') and days ('+A.days.length+') to compare');
  ok(errs.length===0,'no page errors with the look off '+errs.join('|'));await ctx.close()}

 /* ---- on, on a phone ---- */
 {const {ctx,pg,errs}=await open(b,{favs,style:'fm'});
  ok(await pg.evaluate(()=>document.documentElement.classList.contains('fm')&&localStorage.getItem('plx_style')==='fm'),'plx_style=fm puts the class on <html>');
  ok(await rgb(pg,'body','backgroundColor')==='rgb(0, 0, 0)','the page is pure black');
  ok(await rgb(pg,'header','backgroundColor')==='rgb(26, 26, 26)','the header is the grey bar #1a1a1a');
  ok(await pg.evaluate(()=>getComputedStyle(document.body,'::before').display==='none'),'the glow and stripes behind the page are off');
  ok(await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th-hi').trim().toLowerCase()==='#60df6e'),'one green accent (--th-hi) in every league');
  const B=await geo(pg);
  ok(JSON.stringify(B)===JSON.stringify(A),'nothing changed size: '+A.days.length+' day buttons, '+A.heads.length+' group headers, '+A.rows.length+' match rows and '+A.widths.length+' groups have the same sizes with the look on');
  ok(await T.noscroll(pg),'no sideways scroll at 390 px');

  /* the tiles */
  await pg.waitForSelector('.fm-tile',{timeout:20000});
  const tl=await pg.$$eval('.fm-tile',a=>a.map(t=>({n:t.querySelector('.fm-n').textContent,href:t.querySelector('a').getAttribute('href'),fl:t.querySelector('a').dataset.flid,w:t.querySelector('.fm-w')&&t.querySelector('.fm-w').textContent,o:t.querySelector('.fm-o')&&t.querySelector('.fm-o').textContent,bg:getComputedStyle(t).backgroundColor,sty:t.getAttribute('style'),x:!!t.querySelector('.fm-x'),r:t.getBoundingClientRect().toJSON()})));
  ok(tl.length===favs.length,'one tile for each starred team ('+tl.length+' of '+favs.length+')');
  favs.forEach((f,i)=>{const t=tl.find(x=>x.n===f.t);ok(!!t&&t.href==='#/club/'+encodeURIComponent(f.t)&&t.fl===f.l&&t.x,'the tile of '+f.t+' links to its club page, knows its league and has a remove button');
   const nx=nextOf(f.t);
   if(nx){const opp=nx.h===f.t?nx.a:nx.h,pre=nx.h===f.t?'vs':'@';
    ok(t&&norm(t.o)===pre+' '+opp,'its next match is '+pre+' '+opp+' (recomputed from data/fixtures.json) ['+(t&&t.o)+']');
    ok(t&&norm(t.w)===label(nx.t,false),'its day and time are '+label(nx.t,false)+' ['+(t&&t.w)+']')}
   else ok(t&&!t.w,'no upcoming match: no match line is written')});
  ok(tl.every(t=>/^rgb\(/.test(t.bg)&&t.bg!=='rgba(0, 0, 0, 0)'),'every tile is filled ('+tl.map(t=>t.bg).join(', ')+')');
  ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.ovt .ovt-l')).display==='none'),'the chips the tiles replace are hidden, not removed');
  ok(tl.length<2||(Math.abs(tl[0].r.width-tl[1].r.width)<1.5&&tl[1].r.left>tl[0].r.left&&tl[0].r.width>140&&tl[0].r.height/tl[0].r.width>.85&&tl[0].r.height/tl[0].r.width<1.1),'two columns of near-square tiles ('+tl[0].r.width.toFixed(0)+' x '+tl[0].r.height.toFixed(0)+')');

  /* remove one */
  await pg.click('.fm-tile .fm-x');
  await pg.waitForFunction(n=>document.querySelectorAll('.fm-tile').length===n&&document.querySelectorAll('.ovt-c').length===n,favs.length-1,{timeout:8000}).catch(()=>{});
  ok(await pg.evaluate(n=>document.querySelectorAll('.fm-tile').length===n&&document.querySelectorAll('.ovt-c').length===n&&JSON.parse(localStorage.getItem('plx_favs_v2')).t.length===n,favs.length-1),'the remove button removes the team: one tile, one chip and one saved team left');
  /* add it back through the page's own control */
  await pg.evaluate(f=>favToggle(f.l,f.t),favs[0]);
  await pg.waitForFunction(n=>document.querySelectorAll('.fm-tile').length===n,favs.length,{timeout:8000}).catch(()=>{});
  ok(await pg.evaluate(n=>document.querySelectorAll('.fm-tile').length===n,favs.length),'adding a team with the page\'s own control draws its tile');

  /* the bottom bar */
  const bar=await pg.evaluate(()=>{const n=document.getElementById('fmbar');if(!n)return null;const r=n.getBoundingClientRect(),cs=getComputedStyle(n);
   const items=[...n.children].map(e=>({tag:e.tagName,hub:e.dataset.hub||'',href:e.getAttribute('href'),cur:e.getAttribute('aria-current'),txt:e.textContent.trim(),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,svg:!!e.querySelector('svg')}));
   return {display:cs.display,pos:cs.position,bottom:r.bottom,ih:innerHeight,h:r.height,items,pad:parseFloat(getComputedStyle(document.body).paddingBottom),z:+cs.zIndex,sec:UI_SEC.map(s=>({k:s.k,p:s.p}))}});
  ok(!!bar&&bar.display==='flex'&&bar.pos==='fixed'&&Math.abs(bar.bottom-bar.ih)<1,'the bottom bar is fixed to the bottom of the screen');
  ok(!!bar&&bar.items.length===5&&bar.items.slice(0,4).map(i=>i.hub).join()==='home,season,teams,fpl'&&bar.items[4].tag==='BUTTON','five places: Home, Season, Teams, Fantasy and More ('+(bar&&bar.items.map(i=>i.hub||i.tag).join(','))+')');
  ok(!!bar&&bar.items.every(i=>i.svg&&i.h>=56&&i.w>=70&&i.txt.length>0),'each place has an icon, a name and a touch target of at least 56 x 70 px '+(bar&&JSON.stringify(bar.items.map(i=>[i.hub||i.tag,Math.round(i.w),Math.round(i.h),i.svg,i.txt]))));
  ok(!!bar&&bar.items.slice(0,4).every(i=>{const s=bar.sec.find(x=>x.k===i.hub);return s&&i.href&&s.p.includes(i.href.replace('#/',''))}),'each link opens a page of its hub (from UI_SEC): '+(bar&&bar.items.slice(0,4).map(i=>i.href).join(' ')));
  ok(!!bar&&bar.items.filter(i=>i.cur).length===1&&bar.items.find(i=>i.cur).hub==='home','on the Overview exactly one place is marked: Home');
  ok(!!bar&&bar.pad>=72,'the page leaves room for the bar ('+(bar&&bar.pad)+' px under the content)');
  ok(!!bar&&bar.z<60,'the bar sits under the menu (z-index '+(bar&&bar.z)+')');
  await pg.click('#fmbar a[data-hub="season"]');await pg.waitForTimeout(600);
  const hs=await pg.evaluate(()=>({h:location.hash,cur:[...document.querySelectorAll('#fmbar [aria-current]')].map(e=>e.dataset.hub)}));
  ok(/^#\/(table|sim|luck|rare)/.test(hs.h)&&hs.cur.join()==='season','pressing Season opens its page ('+hs.h+') and the mark moves to Season');
  await pg.click('#fmbar a[data-hub="home"]');await pg.waitForTimeout(500);
  await pg.click('#fmbar [data-more]');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.documentElement.classList.contains('dr-open')),'More opens the menu drawer');

  /* the switch in the drawer */
  ok(await pg.evaluate(()=>{const s=document.querySelector('#drw .fm-sw button');return !!s&&s.getAttribute('aria-pressed')==='true'&&/Night pitch/.test(s.textContent)}),'the drawer has a Look switch that offers the night-pitch look');
  await pg.click('#drw .fm-sw button');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>!document.documentElement.classList.contains('fm')&&localStorage.getItem('plx_style')==='night'&&!document.getElementById('fmbar')&&!document.querySelector('.fm-tiles')),'pressing it turns the look off: class, bar and tiles go, the choice is kept');
  ok(await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor!=='rgb(0, 0, 0)'),'the night-pitch colour is back');
  await pg.click('#drw .fm-sw button');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.documentElement.classList.contains('fm')&&!!document.getElementById('fmbar')),'and on again');
  await pg.waitForSelector('.fm-tile',{timeout:15000}).catch(()=>{});
  ok(await pg.evaluate(n=>document.querySelectorAll('.fm-tile').length===n,favs.length),'the tiles come back when the look is turned on again');
  ok(errs.length===0,'no page errors on a phone '+errs.join('|'));await ctx.close()}

 /* ---- a wide screen: no bar, the tiles stay ---- */
 {const {ctx,pg,errs}=await open(b,{vw:1280,favs,style:'fm'});
  await pg.waitForSelector('.fm-tile',{timeout:20000});
  ok(await pg.evaluate(()=>getComputedStyle(document.getElementById('fmbar')).display==='none'),'on a wide screen the bottom bar is not shown');
  ok(await pg.evaluate(()=>getComputedStyle(document.body).paddingBottom!==undefined&&document.querySelectorAll('.fm-tile').length>=2),'the tiles are shown');
  ok(errs.length===0,'no page errors on a wide screen '+errs.join('|'));await ctx.close()}

 /* ---- Arabic, right to left ---- */
 {const {ctx,pg,errs}=await open(b,{lang:'ar',favs,style:'fm'});
  await pg.waitForSelector('.fm-tile',{timeout:20000});
  ok(await pg.evaluate(()=>document.documentElement.dir==='rtl'),'Arabic is right to left');
  const r=await pg.$$eval('.fm-tile',a=>a.map(t=>t.getBoundingClientRect().toJSON()));
  ok(r.length>=2&&r[0].left>r[1].left,'the first tile is on the right in Arabic ('+r[0].left.toFixed(0)+' > '+r[1].left.toFixed(0)+')');
  const nx=nextOf(t1.t);
  if(nx){const w=await pg.$eval('.fm-tile .fm-w',e=>e.textContent);ok(norm(w)===label(nx.t,true),'the first tile\'s day and time are in Arabic ('+w+')')}
  const names=await pg.$$eval('#fmbar > *',a=>a.map(e=>e.textContent.trim()));
  ok(names.length===5&&names.every(n=>n.length>0),'the bar has its five names in Arabic mode: '+names.join(' | '));
  ok(await T.noscroll(pg),'no sideways scroll in Arabic');
  ok(errs.length===0,'no page errors in Arabic '+errs.join('|'));await ctx.close()}

 /* ---- reduced motion ---- */
 {const {ctx,pg,errs}=await open(b,{favs,style:'fm',reduced:true});
  await pg.waitForSelector('.fm-tile',{timeout:20000});
  ok(await pg.$eval('.fm-tile',e=>parseFloat(getComputedStyle(e).transitionDuration)===0),'reduced motion: the tile has no transition');
  ok(errs.length===0,'no page errors '+errs.join('|'));await ctx.close()}

 /* ---- a missing fixtures file: the tile has no match line ---- */
 {const {ctx,pg,errs}=await open(b,{favs,style:'fm',block:true});
  await pg.waitForSelector('.fm-tile',{timeout:20000});
  ok(await pg.$$eval('.fm-tile',a=>a.length>=1&&a.every(t=>!t.querySelector('.fm-nx'))),'fixtures file unreachable: the tiles are drawn without a match line');
  ok(errs.length===0,'no page errors when the fixtures file fails '+errs.join('|'));await ctx.close()}

 /* ---- no starred team: no tiles, the page still works ---- */
 {const {ctx,pg,errs}=await open(b,{favs:[],style:'fm'});
  await pg.waitForTimeout(1500);
  ok(await pg.evaluate(()=>!document.querySelector('.fm-tiles')&&!!document.getElementById('fmbar')),'no starred team: no tiles, the bar is still there');
  ok(errs.length===0,'no page errors without teams '+errs.join('|'));await ctx.close()}

 await T.done(b)})();
