/* Matches page (assets/matches-page.js): the Upcoming and Results tabs. Results are recomputed from the league file (every finished match, newest day first, ties by match id): the
   groups by day, the rows (names, score, winner in bold, link to the match page, crests), the first 40 and "Show more" adding 40, the count, the club choice (that club's matches only,
   for two clubs), a club with a few matches; the Upcoming tab keeps the fixtures section (days, rows, times); which tab opens first and that the choice is kept in this browser; a league
   with no fixtures opens on Results; the Matches hub tab; Arabic and 390 px; the tab bar has the glass. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const sc=s=>{const m=/^(\d+)\s*-\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
function fin(id){const L=J(IDX.leagues.find(l=>l.id===id).file);return L.matches.filter(m=>m.d&&sc(m.s)).map(m=>({id:m.i,d:m.d.slice(0,10),h:m.h,a:m.a,s:sc(m.s)})).sort((a,b)=>cmp(b.d,a.d)||cmp(b.id,a.id))}
const dUTC=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
const norm=s=>s.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim();
const rows=pg=>pg.$$eval('#mpl .mpm',a=>a.map(r=>({id:r.dataset.id,h:r.dataset.h,a:r.dataset.a,score:r.dataset.score,href:r.getAttribute('href'),mid:r.querySelector('.ctm-s').textContent,names:[r.querySelector('.ctm-h').textContent,r.querySelector('.ctm-a').textContent],bold:[r.querySelector('.ctm-h').classList.contains('mpw'),r.querySelector('.ctm-a').classList.contains('mpw')],crests:r.querySelectorAll('.ctm-c').length,day:r.dataset.d,head:r.querySelector('.ctm-dd').textContent,res:r.dataset.res,pill:r.querySelector('.ctm-s').className})));
function same(got,W,label){
 ok(got.length===Math.min(W.length,got.length)&&got.length>0&&got.every((g,i)=>{const w=W[i],bh=w.s[0]>w.s[1],ba=w.s[0]<w.s[1];return g.id===w.id&&g.h===w.h&&g.a===w.a&&g.score===w.s[0]+'-'+w.s[1]&&norm(g.mid)===w.s[0]+' - '+w.s[1]&&g.href==='#/match/'+w.id&&norm(g.names[0])===w.h&&norm(g.names[1])===w.a&&g.bold[0]===bh&&g.bold[1]===ba&&g.crests===2&&g.day===w.d&&norm(g.head)===dUTC(w.d)}),label+': '+got.length+' rows match in order, with score, winner in bold, link, crests and the day header')}
(async()=>{const b=await T.launch();
 const LL='l_0ErfuF',LG='l_4WFCIZ',A=fin(LL);
 let {ctx,pg,errs}=await T.open(b,{vw:430,league:LL,hash:'#/matches'});await pg.waitForSelector('#mptabs',{timeout:90000});await pg.waitForTimeout(600);
 ok(await pg.$$eval('#mptabs button',a=>a.map(x=>x.dataset.k+':'+x.getAttribute('aria-pressed')).join())==='up:true,res:false','the Upcoming tab is open first');
 ok(await pg.evaluate(()=>!document.querySelector('#mpu').hidden&&document.querySelector('#mpr').hidden&&document.querySelectorAll('#mpu .fxd').length>0&&document.querySelectorAll('#mpu .fxr').length>0&&/Upcoming fixtures/.test(document.querySelector('#mpu').innerText)),'the fixtures section is still there (days, rows, "Upcoming fixtures")');
 ok(!!(await pg.$('#mptabs .lgx-g')),'the tab bar has the glass');
 await pg.click('#mptabs button[data-k="res"]');await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>document.querySelector('#mpu').hidden&&!document.querySelector('#mpr').hidden&&localStorage.getItem('plx_mp')==='res'),'Results opens on a tap and the choice is kept (plx_mp)');
 ok(A.length>40,'reference: '+A.length+' finished matches in LaLiga');
 same(await rows(pg),A.slice(0,40),'first 40');
 ok(+await pg.$eval('#mpcount',e=>e.dataset.n)===A.length&&/matches/.test(await pg.innerText('#mpcount')),'the count says '+A.length);
 ok((await pg.$$eval('#mpl .mpm',a=>a.map(d=>d.dataset.d))).every((d,i,x)=>i===0||x[i-1]>=d),'dates run from the newest to the oldest');
 ok(/Previous matches/.test(await pg.innerText('#mpl h3'))&&await pg.$$eval('#mpl .mpm',a=>a.every(r=>r.querySelector('.ctm-s').classList.contains('n')&&r.dataset.res==='n')),'one card titled Previous matches; with no club the pills are neutral');
 await pg.click('#mpmore');await pg.waitForTimeout(200);same(await rows(pg),A.slice(0,80),'after Show more');
 while(await pg.$('#mpmore')){await pg.click('#mpmore');await pg.waitForTimeout(80)}
 same(await rows(pg),A,'everything');ok((await rows(pg)).length===A.length,'all '+A.length+' matches can be reached with Show more');
 /* a club */
 for(const club of ['Barcelona','Elche']){const W=A.filter(x=>x.h===club||x.a===club);await pg.selectOption('#mpc',club);await pg.waitForTimeout(250);
  while(await pg.$('#mpmore')){await pg.click('#mpmore');await pg.waitForTimeout(60)}
  same(await rows(pg),W,club);
  ok((await rows(pg)).every((g,i)=>{const w=W[i],home=w.h===club,gf=home?w.s[0]:w.s[1],ga=home?w.s[1]:w.s[0],c=gf>ga?'w':gf<ga?'l':'d';return g.res===c&&g.pill.split(' ').includes(c)}),club+': each pill is green / grey / red from the club\'s side');
  ok(+await pg.$eval('#mpcount',e=>e.dataset.n)===W.length,club+': the count is '+W.length)}
 await pg.selectOption('#mpc','');await pg.waitForTimeout(200);
 ok(await T.noscroll(pg),'phone: no horizontal scroll');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a[0]==='#/matches'&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/matches'}),'the page is still the first tab of the Matches hub');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
 /* the kept choice: the next visit opens on Results */
 await pg.evaluate(()=>{location.hash='#/table'});await pg.waitForSelector('.lt',{timeout:60000});await pg.evaluate(()=>{location.hash='#/matches'});await pg.waitForSelector('#mptabs',{timeout:60000});await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>document.querySelector('#mpu').hidden&&!document.querySelector('#mpr').hidden),'coming back later the page opens on Results');
 await pg.click('#mptabs button[data-k="up"]');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>!document.querySelector('#mpu').hidden&&localStorage.getItem('plx_mp')==='up'),'and back to Upcoming');
 await ctx.close();
 /* another league */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/matches',init:{plx_mp:'res'}}));await pg.waitForSelector('#mpl .mpm',{timeout:90000});await pg.waitForTimeout(400);
 same(await rows(pg),fin(LG).slice(0,40),'Premier League');ok(!errs.length,'Premier League: no page errors');await ctx.close();
 /* Arabic and phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LL,hash:'#/matches',init:{plx_mp:'res'}}));await pg.waitForSelector('#mpl .mpm',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('#mpl .mpm',a=>a.every(r=>{const x=r.getBoundingClientRect();return x.left>=-1&&x.right<=innerWidth+1})),lang+' phone: every row fits');
  const g=await pg.$$eval('#mpl .mpm',a=>a.slice(0,40).map(r=>r.dataset.id));ok(g.join()===A.slice(0,40).map(x=>x.id).join(),lang+' phone: the same 40 matches in the same order');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#mpr');ok(!u.length,'Arabic: the Results tab is translated '+u.slice(0,5).join(' | '));ok(/النتائج/.test(await pg.innerText('#mptabs'))&&/القادمة/.test(await pg.innerText('#mptabs')),'Arabic: the two tabs');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
