const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const U='http://127.0.0.1:8777/index.html',PL='l_4WFCIZ',LL='l_0ErfuF';
const ORDER=['Discovery of the round','Stars of the round','Club power','Who is better?','Fantasy radar','Quick rankings','Stats centre'];
async function open(b,{vw=1280,lang='en',league=PL,route=null,init=null,touch=false}={}){const ctx=await b.newContext(touch?{viewport:{width:vw,height:860},hasTouch:true,isMobile:true}:{viewport:{width:vw,height:860}});
 await ctx.addInitScript(([a,lg])=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',a);localStorage.setItem('gh_repo','x/y');localStorage.setItem('flipy','1')}},[lang,league]);
 if(init)await ctx.addInitScript(init);
 const pg=await ctx.newPage(),errs=[];if(route)await route(pg);
 pg.on('pageerror',e=>errs.push(e.stack.split('\n').slice(0,3).join(' / ')));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|missing.png/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/round');await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(1500);return {ctx,pg,errs}}
const go=async(pg,h,w=900)=>{await pg.evaluate(x=>location.hash=x,h);await pg.waitForTimeout(w)};
const secs=pg=>pg.$$eval('#home .hsec .hhd h2',h=>h.map(x=>x.textContent));
const fpl=async pg=>{await pg.evaluate(()=>{const f=document.getElementById('hfpl');if(f)f.scrollIntoView()});await pg.waitForTimeout(2500)};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---- Premier League, desktop, English ---- */
 {const {ctx,pg,errs}=await open(b);await fpl(pg);
  ok((await secs(pg)).filter(x=>!['Today','Next matchday','Latest results','Player of the round','Team of the round'].includes(x)).join('|')===ORDER.join('|'),'Premier League: the 7 sections, in the requested order (plus the matchday strip and player of the round, tested in px/ui_px.js)');
  ok(await pg.evaluate(()=>{const h=document.getElementById('home'),t=h.previousElementSibling;return t&&t.tagName==='H2'&&/This round/.test(t.textContent)}),'the home sits right under the overview title');
  ok(await pg.evaluate(()=>{const h=document.getElementById('home');let n=h.nextElementSibling,c=0;while(n){c++;n=n.nextElementSibling}return c>=2}),'the overview\'s existing content is kept, below the home');
  ok(await pg.evaluate(()=>!document.getElementById('favcard')),'no single "your team" card here: your teams (several) are on the overview');
  /* numbers: the hero, the quick rankings and the comparison match aggPl, the same source as the Players and Comparison pages */
  const num=await pg.evaluate(()=>{const c=HOME.c,M=k=>HOME_RULES.metrics.find(m=>m.k===k),hF=v=>(+v).toFixed(2);
   const L=c.q.map(a=>[a,M('sca').f(a)]).filter(x=>x[1]!=null).sort((a,b)=>b[1]-a[1]).slice(0,5);
   const shown=[...document.querySelectorAll('#hrk .hrank li')].map(li=>[li.querySelector('.hrp b').textContent,li.querySelector('.hrv').textContent]);
   const fresh=aggPl(c.P).filter(a=>!c.gk.has(a.id)&&a.s.mi>=HOME_RULES.minMin);
   const same=L.every(([a,v],i)=>shown[i]&&shown[i][0]===a.n&&shown[i][1]===hF(v)&&Math.abs(M('sca').f(fresh.find(x=>x.id===a.id))-v)<1e-9);
   const hero=document.querySelector('.hmain .hbig').textContent,h=homeStories(c)[0],hv=h.a?Object.values(HOME_RULES.metrics).map(m=>m.f(h.a)).some(x=>x!=null&&(+x).toFixed(2)===hero):true;
   const vsA=c.q.find(x=>x.id===HOME.vs[0]),vsRow=document.querySelector('#hvbody .hrow b').textContent;
   return {same,n:shown.length,hv,vs:vsRow===(+M('npxg').f(vsA)).toFixed(2),gk:c.q.some(a=>c.gk.has(a.id)),min:c.q.every(a=>a.s.mi>=450)}});
  ok(num.same&&num.n===5,'quick rankings: top 5 shot-creating actions per 90 match aggPl exactly (names, values, order)');
  ok(num.hv,'the discovery card\'s big number is the player\'s own per-90 value');
  ok(num.vs,'who is better? shows the same npxG per 90 as aggPl');
  ok(!num.gk&&num.min,'per-90 cards use only outfield players with 450+ minutes');
  const stars=await pg.evaluate(()=>{const c=HOME.c;return [...document.querySelectorAll('.hstar')].map(a=>{const id=decodeURIComponent(a.getAttribute('href').split('/')[2]).split('||')[0],o=c.rp.find(x=>x.id===id),M=HOME_RULES.metrics.find(m=>m.l===a.querySelector('.hk').textContent);
   return o&&M&&o.mi>=HOME_RULES.roundMin&&Math.abs(parseFloat(a.querySelector('.hnum b').textContent)-o.v[M.k])<0.01&&c.rp.every(x=>(x.v[M.k]??-1)<=o.v[M.k]+1e-9)})});
  ok(stars.length>=2&&stars.every(Boolean),'stars of the round: each card is the true leader of its measure in the round ('+stars.length+' cards)');
  ok(await pg.evaluate(()=>{const g=[...document.querySelectorAll('.hstar .hk')].map(x=>HOME_RULES.metrics.find(m=>m.l===x.textContent).g);return new Set(g).size===g.length}),'stars: no two cards from the same group of measures');
  ok(await pg.evaluate(()=>{const c=HOME.c;return (c.round||[]).every(m=>m.date.slice(0,10)>=c.from&&m.date.slice(0,10)<=c.last)&&c.from<=c.last}),'the round window is the last match day and the 6 days before it');
  const clubs=await pg.$$eval('.hclub',cs=>cs.map(c=>[...c.querySelectorAll('.hbars b')].map(b=>parseFloat(b.textContent))));
  ok(clubs.length===4&&clubs.every((v,i)=>v.length===5&&v.every((x,j)=>j===0||(i===1?x>=v[j-1]:x<=v[j-1]))),'club power: 4 cards, top 5 each, in the right order (defence lowest first)');
  /* charts */
  const ch=await pg.evaluate(()=>{const c=HOME.c,h=homeStories(c)[0],o={};
   const st=document.querySelector('.hmain .hstrip');if(st&&h.t==='hidden'){const M=HOME_RULES.metrics.find(m=>h.html.includes(m.l)),n=c.q.filter(a=>M.f(a)!=null).length;o.strip=st.querySelectorAll('.hspl i').length===n-1&&!!st.querySelector('.hspl b')}else o.strip=!st;
   const sc=[...document.querySelectorAll('.hscc .hdot')];const L=new Map();c.fin.forEach(m=>{const g=wkSc(m.score);[[m.home,m.away],[m.away,m.home]].forEach(([t,u])=>{const xf=c.tx.get(m.match_id+'|'+t),xa=c.tx.get(m.match_id+'|'+u);if(xf==null||xa==null)return;const r=L.get(t)||{n:0,f:0,a:0};r.n++;r.f+=xf;r.a+=xa;L.set(t,r)})});
   const P=sc.map(a=>({t:a.getAttribute('aria-label'),x:parseFloat(a.style.left),y:parseFloat(a.style.top)})),R=P.map(p=>({...p,f:L.get(p.t).f/L.get(p.t).n,a:L.get(p.t).a/L.get(p.t).n}));
   o.scN=sc.length===[...L.values()].filter(r=>r.n>=3).length;
   o.scX=R.every(p=>R.every(q=>(p.f<q.f)===(p.x<q.x)||Math.abs(p.f-q.f)<1e-9));o.scY=R.every(p=>R.every(q=>(p.a<q.a)===(p.y<q.y)||Math.abs(p.a-q.a)<1e-9));
   o.scT=document.querySelectorAll('.hscc details tbody tr').length>=sc.length;
   o.rad=document.querySelectorAll('.hrad polygon.ra,.hrad polygon.rb').length===2&&document.querySelectorAll('.hrad circle.a').length===6&&document.querySelectorAll('.hrad circle.b').length===6;
   o.pair=[...document.querySelectorAll('.hstar .hpair')].every(p=>{const w=[...p.querySelectorAll('.hpt i')].map(i=>parseFloat(i.style.width));return w[0]===100&&w[1]<=100&&w[2]<=w[0]});
   const rb=[...document.querySelectorAll('#hrk .hrb i')].map(i=>parseFloat(i.style.width));o.rk=rb.length===5&&rb[0]===100&&rb.every((w,i)=>!i||w<=rb[i-1]);
   const col=document.querySelector('#home .hcols');o.cols=!col||col.querySelectorAll('i.on').length===3;return o});
  ok(ch.strip,'discovery: the dot strip shows every other qualified player as a dot and the player in the accent');
  ok(ch.scN&&ch.scX&&ch.scY,'attack and defence: one crest per club, placed in the same order as their xG created and allowed');
  ok(ch.scT,'attack and defence: the same numbers are available as a table');
  ok(ch.rad,'who is better?: the radar draws both players over six measures');
  ok(ch.pair,'stars: leader, next best and average bars share one scale from zero');
  ok(ch.rk,'quick rankings: bars from the leader down, on one scale');
  ok(ch.cols,'on the rise (when shown): the last 3 matches are highlighted');
  const pc=await pg.evaluate(()=>{const c=HOME.c,a=c.q.find(x=>x.id===HOME.vs[0]),b=c.q.find(x=>x.id===HOME.vs[1]),same=hPosOk(c)&&a.p&&a.p===b.p&&HPOS[a.p],pool=same?c.q.filter(x=>x.p===a.p):c.q,M=HOME_RULES.metrics.find(m=>m.k==='npxg'),v=M.f(a),arr=pool.map(q=>M.f(q)).filter(x=>x!=null),p=(arr.filter(x=>x<v).length+arr.filter(x=>x===v).length/2)/arr.length*100;
   return [p,[...document.querySelectorAll('.hrad circle.hit')].map(x=>x.dataset.tip),a.n]});
  ok(pc[1].some(t=>t.startsWith(pc[2]+'|'+Math.round(pc[0])+'|percentile')),'radar: the percentile shown for npxG is the player\'s true percentile, within the position when both share one ('+Math.round(pc[0])+')');
  /* tooltips: hover a crest, hover the dot strip */
  const cr=await pg.$('.hscc .hdot');await cr.scrollIntoViewIfNeeded();await pg.waitForTimeout(500);await cr.hover();await pg.waitForTimeout(250);
  const tt=await pg.evaluate(()=>{const t=document.getElementById('htip');return t&&t.classList.contains('on')?t.innerText:''});
  ok(tt.includes(await cr.getAttribute('aria-label'))&&/xG created a match/.test(tt),'hovering a crest shows its club and both values');
  const sp=await pg.$('.hmain .hspl');if(sp){await sp.scrollIntoViewIfNeeded();await pg.waitForTimeout(500);const bb=await sp.boundingBox();await pg.mouse.move(bb.x+bb.width*0.5,bb.y+bb.height/2);await pg.waitForTimeout(250);
   ok(await pg.evaluate(()=>{const t=document.getElementById('htip');return t.classList.contains('on')&&HOME.c.q.some(a=>t.innerText.includes(a.n))}),'hovering the dot strip names the nearest player')}
  await pg.mouse.move(2,2);await pg.waitForTimeout(200);ok(await pg.evaluate(()=>!document.getElementById('htip').classList.contains('on')),'the tooltip hides when the pointer leaves');
  /* Fantasy: actual and prediction are labelled apart */
  const f=await pg.$$eval('#hfpl .hfpl',cs=>cs.map(c=>[c.querySelector('.htag').className,c.innerText]));
  ok(f.length>=2&&f.filter(x=>/act/.test(x[0])).length===2,'Fantasy radar: the two "Actual" cards are labelled as actual');
  ok(f.filter(x=>/pred/.test(x[0])).every(x=>/not guaranteed/.test(x[1])),'every prediction card says it is not official and not guaranteed');
  ok(!/guaranteed(?! )/i.test((await pg.$eval('#home',e=>e.innerText)).replace(/not guaranteed/g,'')),'nothing on the home page claims a guarantee');
  /* links */
  const links=await pg.$$eval('#home a[href^="#/"]',a=>[...new Set(a.map(x=>x.getAttribute('href')))]);
  const pages=await pg.evaluate(()=>PAGES.map(p=>p[0]));
  ok(links.every(h=>{const k=h.slice(2).split('/')[0];return pages.includes(k)||['player','club','match','preview'].includes(k)}),'every home link goes to an existing page ('+links.length+' links)');
  const pl=links.find(h=>h.startsWith('#/player/'));await pg.evaluate(h=>location.hash=h,pl);await pg.waitForTimeout(1500);
  const nm=decodeURIComponent(pl.split('/')[2]).split('||')[0];ok(await pg.evaluate(id=>!!document.querySelector('#app h2')&&!document.getElementById('home')&&HOME.c.ag.some(a=>a.id===id&&document.querySelector('#app').innerText.includes(a.n)),nm),'a player link opens that player\'s page');
  const cl=links.find(h=>h.startsWith('#/club/'));await pg.evaluate(h=>location.hash=h,cl);await pg.waitForTimeout(1500);
  ok(await pg.evaluate(t=>document.querySelector('#app h2').textContent.includes(t),decodeURIComponent(cl.split('/')[2])),'a club link opens that club\'s page');
  await pg.evaluate(()=>location.hash='#/round');await pg.waitForSelector('#home .hsec');await pg.waitForTimeout(800);
  ok(await pg.$$eval('#home',x=>x.length)===1&&(await secs(pg)).length>=6,'back on the overview, the home is drawn once again');
  /* who is better? */
  await pg.selectOption('#hvb',await pg.evaluate(()=>HOME.c.q.filter(a=>!HOME.vs.includes(a.id))[3].id));await pg.waitForTimeout(300);
  const vs=await pg.evaluate(()=>HOME.vs);ok(await pg.$eval('#hvbody .hvh.r a b',(e,id)=>HOME.c.q.find(a=>a.id===id).n===e.textContent,vs[1]),'choosing another player redraws the comparison');
  await pg.click('#hvbody button');await pg.waitForTimeout(1500);
  ok(await pg.evaluate(v=>location.hash==='#/compare'&&CMP.length===2&&CMP.every((x,i)=>decodeURIComponent(x).split('||')[0]===v[i]),vs),'"Compare in detail" opens the Comparison Lab with the same two players');
  await pg.evaluate(()=>location.hash='#/round');await pg.waitForSelector('#home .hsec');await pg.waitForTimeout(800);
  /* rankings chips and the full list */
  await pg.click('#hrkc button[data-k="xt"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>{const v=[...document.querySelectorAll('#hrk .hrv')].map(x=>+x.textContent);return HOME.rk==='xt'&&v.length===5&&v.every((x,i)=>!i||x<=v[i-1])}),'a ranking chip switches the list (xT), sorted high to low');
  await pg.click('#hrk .hfull summary');await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#hrk .hfull tbody tr')].filter(r=>r.querySelector('td')).length===HOME.c.q.filter(a=>HOME_RULES.metrics.find(m=>m.k==='xt').f(a)!=null).length),'"Show all" lists every qualified player');
  /* the "why this card?" explanation */
  ok(await pg.evaluate(()=>{const s=homeStories(HOME.c)[0],t=document.querySelector('.hwhy p').textContent;return t.includes(s.score.toFixed(2))&&s.score<=4}),'"Why this card?" shows the score used to pick the card (at most 4)');
  ok(await pg.evaluate(()=>{const S=homeStories(HOME.c);return S.every((s,i)=>!i||s.score<=S[i-1].score)&&new Set(S.map(s=>s.t)).size===S.length}),'stories are ranked by score, one per kind');
  /* photos: only from the synced file, initials always underneath */
  const ph=await pg.evaluate(async()=>{const d=await (await fetch('data/'+lgMeta().photo_file)).json();return [...document.querySelectorAll('#home .hph')].map(i=>{const id=decodeURIComponent((i.closest('a[href^="#/player/"]')||i.closest('li')?.querySelector('a[href^="#/player/"]')||{getAttribute:()=>''}).getAttribute('href').split('/')[2]||'').split('||')[0];return {ok:!id||d.p[id]===i.getAttribute('src'),lazy:i.loading==='lazy',ini:!!i.parentNode.querySelector('b')}})});
  ok(ph.length>0&&ph.every(x=>x.ok),'each photo is the one stored for that player\'s own id ('+ph.length+' shown)');
  ok(ph.every(x=>x.lazy&&x.ini),'photos load lazily, with the initials underneath');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth),'no horizontal scroll on desktop');
  await ctx.close()}
 /* ---- a photo that fails to load ---- */
 {let hero=null;const {ctx,pg,errs}=await open(b,{route:async pg=>{await pg.route('**/data/photos_*.json*',async r=>{const res=await r.fetch(),j=await res.json();j.p=Object.fromEntries(Object.keys(j.p).map(k=>[k,'img/missing.png']));await r.fulfill({json:j})})}});
  await pg.waitForTimeout(800);for(let y=0;y<12000;y+=600){await pg.evaluate(v=>scrollTo(0,v),y);await pg.waitForTimeout(80)}await pg.waitForTimeout(1200);
  ok(await pg.$$eval('#home .hph',x=>x.length)===0,'broken photo links are removed when they fail');
  ok(await pg.$$eval('#home .hav',a=>a.length>0&&a.every(x=>x.querySelector('b').textContent.trim().length>0)),'every avatar still shows the player\'s initials');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- photos not public: none shown ---- */
 {const {ctx,pg}=await open(b,{route:async pg=>{await pg.route('**/data/photos_*.json*',async r=>{const res=await r.fetch(),j=await res.json();j.public=false;await r.fulfill({json:j})})}});
  ok(await pg.$$eval('#home .hph',x=>x.length)===0,'when the sync found photos need a key, no photo is shown');await ctx.close()}
 /* ---- missing per-match player data: player sections are skipped, the rest still draws ---- */
 {const {ctx,pg,errs}=await open(b,{route:async pg=>{await pg.route(/_pl\.json/,r=>r.fulfill({status:404,body:''}))}});errs.splice(0,errs.length,...errs.filter(e=>!/status of 404/.test(e)));
  const s=await secs(pg);
  ok(!s.includes('Stars of the round')&&!s.includes('Who is better?')&&!s.includes('Quick rankings')&&s.includes('Club power')&&s.includes('Stats centre'),'without the player file: the player sections are skipped, club power and the stats centre remain ('+s.join(', ')+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- LaLiga: no Fantasy, no photo file ---- */
 {const {ctx,pg,errs}=await open(b,{league:LL});await fpl(pg);const s=await secs(pg);
  ok(!s.includes('Fantasy radar')&&s.length>=5,'LaLiga: no Fantasy section, the others drawn ('+s.length+')');
  ok(await pg.$$eval('#home .hph',x=>x.length)===0,'LaLiga: no photo file, so initials only');
  ok(await pg.evaluate(()=>/laliga/i.test(D.name)&&HOME.c.q.every(a=>D.matches.length>0)),'LaLiga: cards are computed from LaLiga\'s own data');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- switching league redraws the home for the new league ---- */
 {const {ctx,pg,errs}=await open(b);const a=await pg.$eval('.hmain',e=>e.innerText);
  await pg.selectOption('#lgsel',LL).catch(()=>{});await pg.waitForTimeout(500);
  if(await pg.evaluate(()=>!/laliga/i.test(D.name)))await pg.evaluate(id=>{const s=document.querySelector('select');s.value=id;s.dispatchEvent(new Event('change'))},LL);
  await pg.waitForFunction(()=>/laliga/i.test(D.name)&&document.querySelector('#home .hsec'),null,{timeout:30000});await pg.waitForTimeout(1500);
  ok(await pg.evaluate(()=>HOME.id===D.id&&document.querySelectorAll('#home').length===1&&!document.getElementById('hfpl')),'switching to LaLiga redraws the home for LaLiga (and drops Fantasy)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- Arabic, phone ---- */
 {const {ctx,pg,errs}=await open(b,{vw:390,lang:'ar'});await fpl(pg);
  ok((await secs(pg)).filter(x=>!['اليوم','الجولة القادمة','آخر النتائج','لاعب الجولة','تشكيلة الجولة'].includes(x)).join('|')==='اكتشاف الجولة|نجوم الجولة|قوة الأندية|من الأفضل؟|رادار الفانتازي|ترتيبات سريعة|مركز الإحصائيات','Arabic: the 7 section titles');
  await pg.evaluate(()=>document.querySelectorAll('#home details').forEach(d=>d.open=true));await pg.waitForTimeout(500);
  const left=await pg.evaluate(()=>{const names=new Set();HOME.c.ag.forEach(a=>{names.add(a.n);names.add(a.club)});const o=[];const w=document.createTreeWalker(document.getElementById('home'),NodeFilter.SHOW_TEXT);let n;
   while(n=w.nextNode()){if(n.parentNode.closest('select,table,.hfpl ol,.hav,.potr-n,.potr-m a,.potr-l,.hcl'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{2}/.test(t)&&!names.has(t)&&!/^(Premier League ·|[A-Z]{2}|xG|npxG|xAG)$/.test(t)&&!/[؀-ۿ]/.test(t))o.push(t)}return o});
  ok(!left.length,'Arabic: every home sentence is translated (names and abbreviations aside) '+left.slice(0,5).join(' | '));
  ok(await pg.evaluate(()=>document.documentElement.dir==='rtl'&&document.scrollingElement.scrollWidth<=innerWidth),'Arabic phone: right to left, no horizontal scroll');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#home .hcard')].every(c=>{const r=c.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})),'Arabic phone: every card fits the screen');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
  /* back to English redraws English text */
  await pg.click('#langbtn');await pg.waitForSelector('#home .hsec');await pg.waitForTimeout(1200);
  ok((await secs(pg)).filter(x=>!['Today','Next matchday','Latest results','Player of the round','Team of the round'].includes(x))[0]==='Discovery of the round','switching back to English redraws the home in English');await ctx.close()}
 /* ---- English phone ---- */
 {const {ctx,pg,errs}=await open(b,{vw:390,touch:true});await fpl(pg);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#home .hcard')].every(c=>{const r=c.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})),'English phone: no horizontal scroll, every card fits');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#home button,#home select,#home summary')].filter(e=>e.offsetParent).every(e=>e.getBoundingClientRect().height>=24)),'touch phone: buttons, menus and ⓘ are large enough to tap');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- positions (once the sync has learned them): filled here in the test data ---- */
 {const P=['DF','MF','FW'],pos=id=>P[[...id].reduce((a,ch)=>a+ch.charCodeAt(0),0)%3];
  const route=async pg=>{await pg.route(/\/data\/l_4WFCIZ(_pl)?\.json/,async r=>{const res=await r.fetch(),j=await res.json();
   if(j.cols){const io=j.cols.indexOf('o'),ii=j.cols.indexOf('i');j.rows.forEach(x=>x[io]=pos(x[ii]))}else j.stats.forEach(x=>x.o=x.xf!=null?'GK':pos(x.i));await r.fulfill({json:j})})};
  const {ctx,pg,errs}=await open(b,{route});
  ok(await pg.$$eval('#hrkp button',x=>x.length)===4,'with positions: the rankings get a position filter (all, defenders, midfielders, forwards)');
  await pg.click('#hrkp button[data-p="MF"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>{const ids=[...document.querySelectorAll('#hrk .hrank .hrp')].map(a=>decodeURIComponent(a.getAttribute('href').split('/')[2]).split('||')[0]);return ids.length===5&&ids.every(id=>HOME.c.q.find(x=>x.id===id).p==='MF')}),'the midfielders filter lists midfielders only');
  ok(await pg.evaluate(()=>{const M=HOME_RULES.metrics.find(m=>m.k===HOME.rk),L=HOME.c.q.filter(a=>a.p==='MF'&&M.f(a)!=null).sort((x,y)=>M.f(y)-M.f(x));return document.querySelector('#hrk .hrp b').textContent===L[0].n}),'and its leader is the best midfielder');
  ok(await pg.evaluate(()=>{const [a,b]=HOME.vs.map(id=>HOME.c.q.find(x=>x.id===id));return a.p===b.p}),'who is better?: the default pair plays in the same position');
  ok(await pg.evaluate(()=>{const a=HOME.c.q.find(x=>x.id===HOME.vs[0]),n=HOME.c.q.filter(x=>x.p===a.p).length;return document.querySelector('.hrad .hcap').textContent.includes('among '+n+' ')}),'the radar compares with that position only (and says so)');
  await go(pg,'#/players',2500);
  ok(await pg.evaluate(()=>{const t=document.querySelector('#app table');if(!t)return false;const h=[...t.querySelectorAll('th')].map(x=>x.textContent.trim()),i=h.findIndex(x=>/^Pos/.test(x));return i>=0&&[...t.querySelectorAll('tbody tr')].filter(r=>r.querySelector('td')).slice(0,20).every(r=>/^(GK|DF|MF|FW)$/.test(r.children[i].textContent.trim()))}),'the Players page shows each player\'s position');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- reduced motion and keyboard ---- */
 {const ctx=await b.newContext({viewport:{width:1280,height:860},reducedMotion:'reduce'});await ctx.addInitScript(l=>{localStorage.clear();localStorage.setItem('league',l);localStorage.setItem('lang','en')},PL);
  const pg=await ctx.newPage();await pg.goto(U+'#/round');await pg.waitForSelector('#home .hsec',{timeout:60000});
  ok(await pg.$eval('#home .hcard',e=>getComputedStyle(e).transitionDuration.split(',').every(x=>parseFloat(x)===0)),'reduced motion: cards do not animate');
  ok(await pg.$$eval('#home a.hcard',a=>a.every(x=>x.tabIndex>=0)),'every card link is reachable by keyboard');
  ok(await pg.$$eval('#home img',im=>im.every(i=>i.hasAttribute('alt'))),'every home image has an alt attribute');
  await ctx.close()}
 /* ---- storage: only the site's own keys; no key or token in the page ---- */
 {const {ctx,pg}=await open(b);const ks=await pg.evaluate(()=>Object.keys(localStorage).sort());
  ok(ks.every(k=>['league','lang','flipy','gh_repo','plx_fav_v1','plx_lab_v1'].includes(k)),'the home adds no new storage keys ('+ks.join(',')+')');
  const html=await pg.evaluate(()=>document.documentElement.outerHTML);ok(!/pk_live|pitchapi_key|PITCHAPI_KEY|X-API-Key/i.test(html),'no API key or key header anywhere in the page');
  await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
