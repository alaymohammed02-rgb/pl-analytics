/* Club shape (assets/club-shape.js): where a club's starters played their actions, from the heat counts of the match files and the starters of the
   official line-ups. Everything is recomputed here from data/ with a loop of its own: for every club of the Premier League, the players drawn, each one's starts
   (with 10+ actions), actions per start and action-weighted centre in metres (from the own goal and from the left touchline: the left flank is the high
   cell number), the three lines and the gap between defenders and forwards; the formation chips with their match counts and a formation's own numbers;
   the compared club; the line-up's left and right agree with the page's (a left-back is on the left); another league; the Teams hub tab after Tactical;
   Arabic, 390 px, leaving early, a failing heat file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ',PW=105,PH=68,GX=16,GY=12;
const L=J(LG+'.json'),MX=J(LG+'_mx.json').m,HT=J(LG+'_heat.json');
const fin=L.matches.filter(m=>m.d&&/^\d+\s*[-–:]\s*\d+$/.test(String(m.s||'').trim()));
const heat=new Map();HT.rows.forEach(r=>{if(r.t==='p')heat.set(r.m+'|'+r.k,r)});
const grp=s=>s===11?'GK':(s>=30&&s<40)?'DEF':s<100?'MID':'FWD';
/* a club's matches: formation and the starters that have a heat row of 10+ actions */
function clubMatches(){const out={};
 for(const m of fin){const e=MX[m.i];if(!e||!e.lu)continue;
  for(const [sd,t] of [['h',m.h],['a',m.a]]){const lu=e.lu[sd];if(!lu||!lu.xi||lu.xi.length!==11)continue;const st=[];
   for(const x of lu.xi){const r=heat.get(m.i+'|'+x[0]);if(!r||r.c!==t)continue;let w=0;for(let i=2;i<r.h.length;i+=3)w+=r.h[i];if(w<10)continue;st.push({id:x[0],name:x[1],g:grp(x[3]),r,w})}
   (out[t]=out[t]||[]).push({f:lu.f||'',st})}}
 return out}
function agg(ms){const P={},ln={DEF:[0,0,0],MID:[0,0,0],FWD:[0,0,0]};
 for(const m of ms)for(const s of m.st){let sx=0,sy=0;for(let i=0;i+2<s.r.h.length;i+=3){sx+=(s.r.h[i]+.5)*s.r.h[i+2];sy+=(s.r.h[i+1]+.5)*s.r.h[i+2]}
  if(s.g!=='GK'){ln[s.g][0]+=sx;ln[s.g][1]+=sy;ln[s.g][2]+=s.w}
  const p=P[s.id]=P[s.id]||{id:s.id,name:s.name,n:0,w:0,sx:0,sy:0};p.n++;p.w+=s.w;p.sx+=sx;p.sy+=sy}
 const need=Math.max(2,Math.ceil(ms.length/4)),pts=Object.values(P).filter(p=>p.n>=need).map(p=>({id:p.id,n:p.n,per:p.w/p.n,x:p.sx/p.w/GX*PW,y:(GY-p.sy/p.w)/GY*PH}));
 const lines={};for(const k in ln)lines[k]=ln[k][2]?{x:ln[k][0]/ln[k][2]/GX*PW}:null;return {n:ms.length,need,pts,lines}}
const dots=pg=>pg.$$eval('.cs-d.a',a=>a.map(g=>({id:g.dataset.id,n:+g.dataset.n,x:+g.dataset.x,y:+g.dataset.y})));
const dotsB=pg=>pg.$$eval('.cs-d.b',a=>a.map(g=>({id:g.dataset.id,x:+g.dataset.x,y:+g.dataset.y})));
const lineTxt=pg=>pg.$$eval('.cs-t tbody tr',a=>Object.fromEntries(a.map(r=>[r.dataset.k,[...r.querySelectorAll('td.n')].map(t=>parseFloat(t.textContent))])));
const rows=pg=>pg.$$eval('.cs-p tbody tr',a=>a.map(r=>({id:r.dataset.id,t:[...r.querySelectorAll('td.n')].map(t=>parseFloat(t.textContent))})));
function same(got,want){const by=new Map(got.map(g=>[g.id,g]));return got.length===want.length&&want.every(w=>{const g=by.get(w.id);return g&&Math.abs(g.x-w.x)<2e-3&&Math.abs(g.y-w.y)<2e-3&&(g.n==null||g.n===w.n)})}
(async()=>{
 const CM=clubMatches(),teams=Object.keys(CM).sort((a,b)=>a.localeCompare(b));
 const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/shape'});await pg.waitForSelector('.cs-d',{timeout:90000});await pg.waitForTimeout(500);
 ok(JSON.stringify(await pg.$$eval('#csc option',a=>a.map(o=>o.value)))===JSON.stringify(teams),'the club list is every club with line-ups and heat maps ('+teams.length+')');
 /* every club: the players drawn, their numbers, the lines */
 let bad=[],nPl=0;
 for(const t of teams){await pg.selectOption('#csc',t);await pg.waitForTimeout(120);const A=agg(CM[t]),got=await dots(pg);nPl+=A.pts.length;
  const lt=await lineTxt(pg),rw=await rows(pg),byId=new Map(rw.map(r=>[r.id,r.t]));
  const okD=same(got,A.pts)&&A.pts.every(p=>{const r=byId.get(p.id);return r&&r[0]===p.n&&Math.abs(r[1]-p.per)<.051&&Math.abs(r[2]-p.x)<.051&&Math.abs(r[3]-p.y)<.051});
  const gap=A.lines.FWD.x-A.lines.DEF.x,okL=['DEF','MID','FWD'].every(k=>Math.abs(lt[k][0]-A.lines[k].x)<.051)&&Math.abs(lt.gap[0]-gap)<.051;
  if(!okD||!okL)bad.push(t+(okD?'':' players')+(okL?'':' lines'))}
 ok(!bad.length&&nPl>150,'all '+teams.length+' clubs: the players drawn ('+nPl+'), their starts, actions per start, centre in metres and the three lines match'+(bad.length?' — '+bad.join(', '):''));
 {let ordered=true;for(const t of teams){const A=agg(CM[t]);if(!(A.lines.DEF.x<A.lines.MID.x&&A.lines.MID.x<A.lines.FWD.x))ordered=false}ok(ordered,'for every club defenders sit deeper than midfielders, and they deeper than forwards (the cells run from the own goal)')}
 /* the left flank is on the top: a left-back (line-up lateral below 0.3) is on the left of the pitch */
 {let l=0,r=0,nl=0,nr=0;for(const m of fin){const e=MX[m.i];if(!e||!e.lu)continue;for(const [sd,t] of [['h',m.h],['a',m.a]]){const lu=e.lu[sd];if(!lu)continue;for(const x of lu.xi){if(!(x[3]>=30&&x[3]<40))continue;const h=heat.get(m.i+'|'+x[0]);if(!h||h.c!==t)continue;let w=0,sy=0;for(let i=0;i+2<h.h.length;i+=3){w+=h.h[i+2];sy+=(h.h[i+1]+.5)*h.h[i+2]}if(w<10)continue;const fromLeft=(GY-sy/w)/GY*PH;if(x[5]<.3){l+=fromLeft;nl++}else if(x[5]>.7){r+=fromLeft;nr++}}}}
  ok(nl>30&&nr>30&&l/nl<PH/2&&r/nr>PH/2,'line-up left full-backs ('+nl+') average '+(l/nl).toFixed(1)+' m from the left, right full-backs ('+nr+') '+(r/nr).toFixed(1)+' m: the page\'s left flank is the line-up\'s')}
 /* the dots on the page are inside the pitch and on top / bottom as the numbers say */
 {const vb=await pg.$eval('.cs-svg',e=>e.getAttribute('viewBox'));const g=await dots(pg);ok(g.every(d=>d.x>0&&d.x<PW&&d.y>0&&d.y<PH)&&vb==='-3 -3 111 74','every dot is inside the 105 × 68 m pitch ('+g.length+' dots)')}
 /* formations */
 const multi=teams.find(t=>new Set(CM[t].map(m=>m.f)).size>1)||teams[0];await pg.selectOption('#csc',multi);await pg.waitForTimeout(150);
 {const fn={};CM[multi].forEach(m=>fn[m.f]=(fn[m.f]||0)+1);const want=Object.entries(fn).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1));
  const chips=await pg.$$eval('#csf button',a=>a.map(x=>[x.dataset.f,parseInt(x.textContent.replace(/\D*$/,'').match(/(\d+)\s*$/)[1])]));
  ok(JSON.stringify(chips)===JSON.stringify([['',CM[multi].length],...want]),multi+': the formation chips list "All" and each formation with its matches '+JSON.stringify(want));
  if(want.length>1){const f=want[want.length-1][0];await pg.click('#csf button[data-f="'+f+'"]');await pg.waitForTimeout(200);const A=agg(CM[multi].filter(m=>m.f===f));
   ok(same(await dots(pg),A.pts)&&/\b1 match|matches/.test(await pg.innerText('.cs-hd'))&&(await pg.innerText('.cs-hd')).includes(A.n+' ')&&await pg.$eval('#csf button.on',e=>e.dataset.f)===f,multi+' in '+f+' ('+A.n+' matches): the players, their centres and the count match; a player needs '+A.need+' starts')}
  await pg.click('#csf button[data-f=""]');await pg.waitForTimeout(150)}
 /* the compared club */
 {const t1=teams[0],t2=teams[5];await pg.selectOption('#csc',t1);await pg.selectOption('#csp',t2);await pg.waitForTimeout(250);const A=agg(CM[t2]),B=await dotsB(pg),lt=await lineTxt(pg);
  ok(same(B,A.pts)&&['DEF','MID','FWD'].every(k=>Math.abs(lt[k][1]-A.lines[k].x)<.051),t1+' with '+t2+' outlined: its '+A.pts.length+' players and its three lines match');
  ok((await dots(pg)).length===agg(CM[t1]).pts.length,'the main club\'s dots are unchanged by the comparison');
  await pg.selectOption('#csp','');await pg.waitForTimeout(150);ok(!(await pg.$('.cs-d.b')),'"None" removes the outlines')}
 /* the Teams hub tab after Tactical */
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/shape')===a.indexOf('#/tactical')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/shape'}),'the page is the Teams hub tab after Tactical, marked open');
 ok(!!(await pg.$('#csf .lgx-g')),'the formation choice has the glass');
 /* another league */
 {const L2='l_0ErfuF';await pg.evaluate(l=>{localStorage.setItem('league',l)},L2);}
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const L2='l_0ErfuF',MX2=J(L2+'_mx.json').m,HT2=J(L2+'_heat.json'),LL=J(L2+'.json');
  ({ctx,pg,errs}=await T.open(b,{vw:1000,league:L2,hash:'#/shape'}));await pg.waitForSelector('.cs-d',{timeout:90000});await pg.waitForTimeout(400);
  const h2=new Map();HT2.rows.forEach(r=>{if(r.t==='p')h2.set(r.m+'|'+r.k,r)});const out={};
  for(const m of LL.matches.filter(m=>m.d&&/^\d+\s*[-–:]\s*\d+$/.test(String(m.s||'').trim()))){const e=MX2[m.i];if(!e||!e.lu)continue;for(const [sd,t] of [['h',m.h],['a',m.a]]){const lu=e.lu[sd];if(!lu||!lu.xi||lu.xi.length!==11)continue;const st=[];for(const x of lu.xi){const r=h2.get(m.i+'|'+x[0]);if(!r||r.c!==t)continue;let w=0;for(let i=2;i<r.h.length;i+=3)w+=r.h[i];if(w<10)continue;st.push({id:x[0],name:x[1],g:grp(x[3]),r,w})}(out[t]=out[t]||[]).push({f:lu.f||'',st})}}
  const t=Object.keys(out).sort((a,b)=>a.localeCompare(b))[3];await pg.selectOption('#csc',t);await pg.waitForTimeout(250);
  ok(same(await dots(pg),agg(out[t]).pts),'LaLiga, '+t+': the players drawn and their centres match');ok(!errs.length,'LaLiga: no page errors');await ctx.close()}
 /* leaving before the data arrives */
 {const c2=await b.newContext();await c2.route(/_heat\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/shape');await p2.waitForSelector('#csroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#csroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 /* a failing heat file is not kept */
 {const c3=await b.newContext();let fail=true;await c3.route(/_heat\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/shape');
  await p3.waitForSelector('#csroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#csroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/shape'});await p3.waitForSelector('.cs-d',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.cs-d')),'a failing heat file shows a message and is loaded again on the next visit');await c3.close()}
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/shape'}));await pg.waitForSelector('.cs-d',{timeout:90000});await pg.waitForTimeout(500);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$eval('.cs-svg',e=>{const r=e.getBoundingClientRect();return r.width>300&&r.width<=390}),lang+' phone: the pitch fits the screen');
  ok(same(await dots(pg),agg(CM[teams[0]]).pts),lang+' phone: the dots are the same');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,svg')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/شكل النادي/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/shape_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
