/* Club page tabs and the Matches tab (assets/club-matches.js). The page is checked against loops of the test's own over the data files, under a fixed clock (2 Nov 2026 20:00 UTC) and the
   Riyadh time zone: the previous matches of a club (the league's file and, for a club in the Champions League, that competition's file), oldest first, the last six first and "Show earlier results"
   adding ten, each row's date, names, score, colour from the club's side, tag and link; the upcoming matches from data/fixtures.json (every competition it lists), nearest first, with local time,
   "Today", no match already in the results, a match more than 2 hours past kick-off dropped; crests from the logo files; the Overview tab still holds what the club page had; switching tabs does not
   reload the page and keeps the address (#/club/<name>/matches), opening that address opens the tab; a club with no European matches; a failing schedule file and a failing competition file;
   Arabic and 390 px; the tab bar has the glass. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;const {chromium}=require('playwright');
const NOW=Date.parse('2026-11-02T20:00:00Z'),TZ='Asia/Riyadh',cmp=(a,b)=>a<b?-1:a>b?1:0;
const FX=J('fixtures.json');
const norm=s=>s.replace(/[  ]/g,' ').replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim();
const dUTC=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
const lday=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:TZ});
const sc=s=>{const m=/^(\d+)\s*-\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
function leagueOf(id){return IDX.leagues.find(l=>l.id===id)}
function past(club,lid,comps){
 const out=[];for(const [id,name] of [[lid,'']].concat(comps.map(c=>[c,leagueOf(c).name]))){
  const L=J(leagueOf(id).file);for(const m of L.matches){if((m.h!==club&&m.a!==club)||!m.d)continue;const g=sc(m.s);if(g)out.push({id:m.i,d:m.d.slice(0,10),h:m.h,a:m.a,s:g,comp:name,link:id===lid?'#/match/'+m.i:''})}}
 return out.sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id))}
function upcoming(club,lid,ids){
 const out=[];for(const id of Object.keys(FX.leagues))for(const x of FX.leagues[id]){if((x.h!==club&&x.a!==club)||ids.has(x.i))continue;const t=x.k?Date.parse(x.k):NaN;
  if(isFinite(t)?t<NOW-2*3600e3:x.d<lday(NOW))continue;out.push({id:x.i,d:x.d,k:isFinite(t)?x.k:'',t:isFinite(t)?t:Date.parse(x.d+'T23:59:00Z'),h:x.h,a:x.a,comp:id===lid?'':leagueOf(id)?leagueOf(id).name:id,link:id===lid?'#/preview/'+x.i:''})}
 return out.sort((a,b)=>a.t-b.t||cmp(a.id,b.id))}
const T0=pg=>pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
async function open(b,{vw=430,lang='en',league,hash}){const ctx=await b.newContext({viewport:{width:vw,height:900},timezoneId:TZ,locale:'en-US'});await ctx.clock.setFixedTime(NOW);
 await ctx.addInitScript(([l,g])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',g);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html'+hash);return {ctx,pg,errs}}
const rows=(pg,sel)=>pg.$$eval(sel,a=>a.map(r=>({tag:r.tagName,id:r.dataset.id,d:r.dataset.d,h:r.dataset.h,a:r.dataset.a,comp:r.dataset.comp,score:r.dataset.score||'',res:r.dataset.res||'',href:r.getAttribute('href')||'',date:r.querySelector('.ctm-dd').textContent,tag:r.querySelector('.ctm-tag')?r.querySelector('.ctm-tag').textContent:'',mid:r.querySelector('.ctm-s').textContent,cls:r.querySelector('.ctm-s').className,imgs:[...r.querySelectorAll('img.ctm-c')].map(i=>i.getAttribute('src')),names:[r.querySelector('.ctm-h').textContent,r.querySelector('.ctm-a').textContent]})));
function checkPast(got,W,club,label){
 ok(got.length===W.length&&W.every((w,i)=>{const g=got[i],home=w.h===club,gf=home?w.s[0]:w.s[1],ga=home?w.s[1]:w.s[0],res=gf>ga?'w':gf<ga?'l':'d';
  return g.id===w.id&&g.h===w.h&&g.a===w.a&&g.score===w.s[0]+'-'+w.s[1]&&norm(g.mid)===w.s[0]+' - '+w.s[1]&&g.res===res&&g.cls.includes(' '+res)&&norm(g.date)===dUTC(w.d)&&norm(g.tag)===w.comp&&g.href===w.link&&norm(g.names[0])===w.h&&norm(g.names[1])===w.a}),label+': '+W.length+' previous matches in order, with date, names, score, result colour, tag and link ('+W.map(w=>w.s.join('-')).join(' ')+')')}
function checkUp(got,W,club,label){
 ok(got.length===W.length&&W.every((w,i)=>{const g=got[i],tm=w.k?new Date(w.k).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:TZ}):'–',dt=w.k?(lday(w.t)===lday(NOW)?'Today':new Date(w.k).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:TZ})):dUTC(w.d);
  return g.id===w.id&&g.h===w.h&&g.a===w.a&&norm(g.mid)===norm(tm)&&norm(g.date)===norm(dt)&&norm(g.tag)===w.comp&&g.href===w.link&&g.cls.includes(' t')}),label+': '+W.length+' upcoming matches nearest first with local time, "Today", tag and link ('+W.slice(0,3).map(w=>norm(w.h+' v '+w.a)).join('; ')+'…)')}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const LL='l_0ErfuF',UCL='l_0bfbkO',BAR='Barcelona';
 const P=past(BAR,LL,[UCL]),ids=new Set(P.map(p=>p.id)),U=upcoming(BAR,LL,ids);
 ok(P.some(p=>p.comp==='Champions League')&&P.some(p=>!p.comp)&&U.some(u=>u.comp==='Champions League')&&U.some(u=>!u.comp),'the reference: Barcelona has league and Champions League matches, past ('+P.length+') and upcoming ('+U.length+')');
 let {ctx,pg,errs}=await open(b,{league:LL,hash:'#/club/'+encodeURIComponent(BAR)});await pg.waitForSelector('#cttabs',{timeout:90000});await pg.waitForTimeout(700);
 ok(await pg.$$eval('#cttabs button',a=>a.map(x=>x.dataset.k+':'+x.getAttribute('aria-pressed')).join())==='overview:true,matches:false,table:false','the tab bar has Overview (chosen), Matches and Table');
 ok(await pg.evaluate(()=>{const h=document.querySelector('.clubhd'),t=document.querySelector('#cttabs');return (h.nextElementSibling===t||(h.nextElementSibling&&h.nextElementSibling.classList.contains('st3-ctl')&&h.nextElementSibling.nextElementSibling===t))&&!document.querySelector('#ctov').hidden&&document.querySelector('#ctmt').hidden}),'the Overview is open first and the tab bar sits right under the header (below the stadium note where a club has one)');
 ok(await pg.evaluate(()=>!!document.querySelector('#ctov .clubk')&&!!document.querySelector('#ctov #clx')&&!!document.querySelector('#ctov .fx')&&[...document.querySelectorAll('#ctov h3')].some(h=>/Recent results/.test(h.textContent))),'the Overview holds what the club page had: key numbers, the extras, next matches, recent results');
 ok(!!(await pg.$('#cttabs .lgx-g')),'the tab bar has the glass');
 await pg.evaluate(()=>{window.__same=1});await pg.click('#cttabs button[data-k="matches"]');await pg.waitForSelector('.ctm-m',{timeout:30000});await pg.waitForTimeout(500);
 ok(await pg.evaluate(()=>window.__same===1&&location.hash.endsWith('/matches')&&document.querySelector('#ctov').hidden&&!document.querySelector('#ctmt').hidden),'the Matches tab opens without reloading the page and the address ends with /matches');
 let got=await rows(pg,'#ctmp .ctm-m');checkPast(got,P.slice(-6),BAR,'first view');
 ok(!!(await pg.$('#ctmE')),'"Show earlier results" is there while there are older matches');
 await pg.click('#ctmE');await pg.waitForTimeout(200);got=await rows(pg,'#ctmp .ctm-m');checkPast(got,P.slice(-16),BAR,'after "Show earlier results"');
 while(await pg.$('#ctmE')){await pg.click('#ctmE');await pg.waitForTimeout(100)}
 got=await rows(pg,'#ctmp .ctm-m');checkPast(got,P,BAR,'everything');
 got=await rows(pg,'#ctmu .ctm-m');checkUp(got.slice(0,8),U.slice(0,8),BAR,'upcoming, first 8');
 ok((U.length>8)===!!(await pg.$('#ctmM')),'"Show more" appears only when there are more than 8 upcoming');
 while(await pg.$('#ctmM')){await pg.click('#ctmM');await pg.waitForTimeout(100)}
 got=await rows(pg,'#ctmu .ctm-m');checkUp(got,U,BAR,'upcoming, all');
 ok(got.every(g=>!ids.has(g.id)),'no upcoming match is already in the results');
 /* crests */
 {const lo=J(leagueOf(LL).logo_file).teams,lu=J(leagueOf(UCL).logo_file).teams,all=await rows(pg,'.ctm-m'),want=n=>lo[n]||lu[n]||null;
  ok(all.every(r=>r.imgs.length===[r.h,r.a].filter(want).length&&[[r.h,r.imgs[0]],[r.a,r.imgs[1]||r.imgs[0]]].every(([n,s],i)=>!want(n)||true))&&all.every(r=>[r.h,r.a].filter(want).every(n=>r.imgs.includes(want(n)))),'every row shows each club\'s crest from its own league\'s logo file (the league\'s or the Champions League\'s)')}
 ok(await pg.evaluate(()=>[...document.querySelectorAll('.ctm-m')].every(r=>{const a=r.getBoundingClientRect();return a.right<=innerWidth+1&&a.left>=-1})),'phone width: every row fits the screen');
 ok(await T.noscroll(pg),'phone width: no horizontal scroll');
 /* back to the Overview, then the address opens the tab */
 await pg.click('#cttabs button[data-k="overview"]');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>!document.querySelector('#ctov').hidden&&document.querySelector('#ctmt').hidden&&!location.hash.endsWith('/matches')),'back to the Overview: the address loses /matches');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 ({ctx,pg,errs}=await open(b,{league:LL,hash:'#/club/'+encodeURIComponent(BAR)+'/matches'}));await pg.waitForSelector('.ctm-m',{timeout:90000});await pg.waitForTimeout(500);
 ok(await pg.evaluate(()=>!document.querySelector('#ctmt').hidden&&document.querySelector('#ctov').hidden&&document.querySelector('#cttabs button[data-k="matches"]').getAttribute('aria-pressed')==='true'),'the address #/club/<name>/matches opens the Matches tab');
 checkPast(await rows(pg,'#ctmp .ctm-m'),P.slice(-6),BAR,'opened by address');
 await ctx.close();
 /* the Table tab: the league table with this club's row marked */
 {const T=(id)=>{const L=J(leagueOf(id).file),t={};for(const m of L.matches){const g=sc(m.s);if(!g||!m.d)continue;for(const [c,f,a] of [[m.h,g[0],g[1]],[m.a,g[1],g[0]]]){const r=t[c]=t[c]||{t:c,p:0,w:0,d:0,l:0,f:0,a:0,pts:0};r.p++;r.f+=f;r.a+=a;if(f>a){r.w++;r.pts+=3}else if(f===a){r.d++;r.pts++}else r.l++}}
   return Object.values(t).sort((x,y)=>y.pts-x.pts||(y.f-y.a)-(x.f-x.a)||y.f-x.f||cmp(x.t,y.t))};
  const W=T(LL);({ctx,pg,errs}=await open(b,{league:LL,hash:'#/club/'+encodeURIComponent(BAR)}));await pg.waitForSelector('#cttabs',{timeout:90000});await pg.waitForTimeout(500);
  await pg.evaluate(()=>{window.__same=1});await pg.click('#cttabs button[data-k="table"]');await pg.waitForSelector('.ctt-r',{timeout:30000});
  ok(await pg.evaluate(()=>window.__same===1&&location.hash.endsWith('/table')&&document.querySelector('#ctov').hidden&&document.querySelector('#ctmt').hidden&&!document.querySelector('#cttb').hidden),'the Table tab opens without reloading and the address ends with /table');
  const got=await pg.$$eval('.ctt-r',a=>a.map(r=>({t:r.dataset.t,pos:+r.dataset.pos,pts:+r.dataset.pts,p:+r.dataset.p,me:r.classList.contains('me'),cells:[...r.children].map(c=>c.textContent.replace(/[⁦-⁩‎‏]/g,'').trim())})));
  ok(got.length===W.length&&W.every((w,i)=>{const g=got[i],gd=w.f-w.a;return g.t===w.t&&g.pos===i+1&&g.pts===w.pts&&g.p===w.p&&g.cells[0]===String(i+1)&&g.cells[2]===String(w.p)&&g.cells[3]===String(w.w)&&g.cells[4]===String(w.d)&&g.cells[5]===String(w.l)&&g.cells[6]===(gd>0?'+'+gd:gd<0?'−'+Math.abs(gd):'0')&&g.cells[7]===String(w.pts)}),'the table: '+W.length+' clubs in order with played, won, drawn, lost, goal difference and points, recomputed from the league file (leader '+W[0].t+' on '+W[0].pts+')');
  ok(got.filter(g=>g.me).length===1&&got.find(g=>g.me).t===BAR,'only Barcelona\'s row is marked');
  ok(await pg.$$eval('.ctt-r',a=>a.every(r=>r.querySelectorAll('.ltf').length===Math.min(5,+r.dataset.p))),'each row shows its last five results');
  ok(await pg.evaluate(()=>!!document.querySelector('#cttb a[href="#/table"]')),'a link opens the full league table page');
  ok(await T0(pg),'phone width: no horizontal scroll with the table');
  await ctx.close();
  ({ctx,pg,errs}=await open(b,{league:LL,hash:'#/club/'+encodeURIComponent(BAR)+'/table'}));await pg.waitForSelector('.ctt-r',{timeout:90000});
  ok(await pg.evaluate(()=>!document.querySelector('#cttb').hidden&&document.querySelector('#cttabs button[data-k="table"]').getAttribute('aria-pressed')==='true'),'the address #/club/<name>/table opens the Table tab');await ctx.close()}
 /* the Overview: the matches come first */
 {({ctx,pg,errs}=await open(b,{league:LL,hash:'#/overview'}));await pg.waitForSelector('#ovmb',{timeout:90000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>{const w=document.querySelector('#ovw');return w.firstElementChild.id==='ovmb'&&w.children[1].id==='ovteams'}),'Overview: the matches board is the first block, "Your teams" comes after it');await ctx.close()}
 /* a club with no European matches */
 {const V='Valencia',Pv=past(V,LL,[]),Uv=upcoming(V,LL,new Set(Pv.map(p=>p.id)));({ctx,pg,errs}=await open(b,{league:LL,hash:'#/club/'+V+'/matches'}));await pg.waitForSelector('.ctm-m',{timeout:90000});await pg.waitForTimeout(500);
  checkPast(await rows(pg,'#ctmp .ctm-m'),Pv.slice(-6),V,V);ok(!(await pg.$('.ctm-tag')),V+': no competition tags');
  while(await pg.$('#ctmM')){await pg.click('#ctmM');await pg.waitForTimeout(80)}checkUp(await rows(pg,'#ctmu .ctm-m'),Uv,V,V);await ctx.close()}
 /* a Premier League club in the Champions League */
 {const A='Arsenal',PL='l_4WFCIZ',Pa=past(A,PL,[UCL]),Ua=upcoming(A,PL,new Set(Pa.map(p=>p.id)));({ctx,pg,errs}=await open(b,{league:PL,hash:'#/club/'+A+'/matches'}));await pg.waitForSelector('.ctm-m',{timeout:90000});await pg.waitForTimeout(500);
  while(await pg.$('#ctmE')){await pg.click('#ctmE');await pg.waitForTimeout(80)}checkPast(await rows(pg,'#ctmp .ctm-m'),Pa,A,A);
  while(await pg.$('#ctmM')){await pg.click('#ctmM');await pg.waitForTimeout(80)}checkUp(await rows(pg,'#ctmu .ctm-m'),Ua,A,A);ok(!errs.length,A+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* failing files */
 {const c=await b.newContext({timezoneId:TZ,locale:'en-US'});await c.clock.setFixedTime(NOW);await c.addInitScript(l=>{localStorage.setItem('league',l);localStorage.setItem('lang','en')},LL);await c.route(/fixtures\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/club/'+BAR+'/matches');await p.waitForSelector('.ctm-m',{timeout:90000});
  ok(!(await p.$('#ctmu .ctm-m'))&&/No scheduled matches/.test(await p.innerText('#ctmu'))&&(await p.$$('#ctmp .ctm-m')).length>0&&!e.length,'without the schedule file: the previous matches show, the upcoming card says there are none, no error');await c.close()}
 {const c=await b.newContext({timezoneId:TZ,locale:'en-US'});await c.clock.setFixedTime(NOW);await c.addInitScript(l=>{localStorage.setItem('league',l);localStorage.setItem('lang','en')},LL);await c.route(/l_0bfbkO\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/club/'+BAR+'/matches');await p.waitForSelector('.ctm-m',{timeout:90000});await p.waitForTimeout(400);
  while(await p.$('#ctmE')){await p.click('#ctmE');await p.waitForTimeout(80)}
  const g=await rows(p,'#ctmp .ctm-m');ok(g.length===P.filter(x=>!x.comp).length&&g.every(r=>!r.comp)&&!e.length,'without the Champions League file: the league matches show, the European ones are left out, no error');await c.close()}
 /* Arabic and phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await open(b,{vw:390,lang,league:LL,hash:'#/club/'+BAR+'/matches'}));await pg.waitForSelector('.ctm-m',{timeout:90000});await pg.waitForTimeout(500);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  checkPast(await rows(pg,'#ctmp .ctm-m').then(r=>r.map(x=>lang==='ar'?({...x,date:dUTC(P.find(p=>p.id===x.id).d),tag:x.tag?P.find(p=>p.id===x.id).comp:''}):x)),P.slice(-6),BAR,lang+' phone');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#ctmt');ok(!u.length,'Arabic: the Matches tab is translated '+u.slice(0,5).join(' | '));ok(/المباريات السابقة/.test(await pg.innerText('#ctmp h3'))&&/المباريات القادمة/.test(await pg.innerText('#ctmu h3')),'Arabic: the two card titles');
   ok(await pg.$eval('.ctm-r',e=>getComputedStyle(e).direction)==='ltr','Arabic: the match row keeps home on the left');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#ctmt')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {({ctx,pg,errs}=await open(b,{vw:390,lang:'ar',league:LL,hash:'#/club/'+BAR+'/table'}));await pg.waitForSelector('.ctt-r',{timeout:90000});await pg.waitForTimeout(400);
  const u=await pg.evaluate(T.untr,'#cttb');ok(!u.length,'Arabic: the Table tab is translated '+u.slice(0,4).join(' | '));ok(await T.noscroll(pg),'Arabic phone: the table fits, no horizontal scroll');
  ok(/جدول الدوري/.test(await pg.innerText('#cttb h3'))&&/الجدول/.test(await pg.innerText('#cttabs')),'Arabic: the tab and the card title');ok(!errs.length,'Arabic table: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(T.fails()?T.fails()+' FAILED':'all passed');process.exit(T.fails()?1:0)})();
