/* Late show (assets/late-show.js): the points that goals after minute M won and lost for every club. Recomputed here from the league file and the shot file
   with a loop of its own (a match counts only when its goals add up to the score; the score at M = goals with minute M or earlier; points 3 / 1 / 0 from the
   final score against the score at M): for 60, 75, 80 and 85 every club's matches, points, late goals for and against, points gained, lost and net, the order
   (net, gained, name), the three counts above the table, and for a pressed club the list of its matches whose points changed (date, opponent, score at M and final,
   change); another league; the Matches hub tab after Comebacks & collapses; Arabic, 390 px, leaving early, a failing file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0,pts=(a,b)=>a>b?3:a===b?1:0,sg=x=>x>0?'+'+x:x<0?'−'+(-x):'0';
function calc(id,M){const L=J(id+'.json'),SH=J(id+'_sh.json'),ix={};SH.cols.forEach((c,k)=>ix[c]=k);
 const ms=L.matches.filter(m=>m.d&&/^\d+\s*[-–:]\s*\d+$/.test(String(m.s||'').trim())),by=new Map(ms.map(m=>[m.i,m]));
 const goals=new Map();
 for(const r of SH.rows){if(r[ix.ev]!=='Goal')continue;const m=by.get(r[ix.m]);if(!m)continue;const sc=r[ix.og]?(r[ix.c]===m.h?m.a:m.h):r[ix.c];(goals.get(m.i)||goals.set(m.i,[]).get(m.i)).push({mn:+r[ix.mn]||0,home:sc===m.h})}
 const T_={};let used=0,skipped=0,all=0,late=0;
 for(const m of ms){const [hg,ag]=m.s.split(/[-–:]/).map(x=>+x.trim()),g=goals.get(m.i)||[];if(g.length!==hg+ag){skipped++;continue}used++;
  let h=0,a=0,lh=0,la=0;for(const x of g){all++;if(x.mn<=M){x.home?h++:a++}else{late++;x.home?lh++:la++}}
  for(const [t,gf,ga,fin,s0,o0,home,opp,s1,o1] of [[m.h,lh,la,pts(hg,ag),h,a,true,m.a,hg,ag],[m.a,la,lh,pts(ag,hg),a,h,false,m.h,ag,hg]]){const r=T_[t]=T_[t]||{t,n:0,pts:0,gf:0,ga:0,gain:0,lost:0,ch:[]};r.n++;r.pts+=fin;r.gf+=gf;r.ga+=ga;const dd=fin-pts(s0,o0);if(dd>0)r.gain+=dd;else if(dd<0)r.lost-=dd;if(dd)r.ch.push({d:m.d,id:m.i,home,opp,s0:s0+'–'+o0,s1:s1+'–'+o1,dd})}}
 const rows=Object.values(T_).map(r=>({...r,net:r.gain-r.lost})).sort((a,b)=>b.net-a.net||b.gain-a.gain||cmp(a.t,b.t));return {rows,used,skipped,all,late}}
const got=pg=>pg.$$eval('.ls-row',a=>a.map(r=>({t:r.dataset.t,n:+r.dataset.n,gf:+r.dataset.gf,ga:+r.dataset.ga,gain:+r.dataset.gain,lost:+r.dataset.lost,net:+r.dataset.net,pts:+r.dataset.pts,txt:[...r.children].map(c=>c.textContent.replace(/[⁦-⁩‎‏]/g,'').trim()),w:parseFloat(r.querySelector('.ls-b i').style.width),side:r.querySelector('.ls-b i').style.left?'p':'m'})));
function same(g,C){return g.length===C.rows.length&&C.rows.every((w,i)=>{const x=g[i];return x.t===w.t&&x.n===w.n&&x.gf===w.gf&&x.ga===w.ga&&x.gain===w.gain&&x.lost===w.lost&&x.net===w.net&&x.pts===w.pts&&x.txt[1]===w.gf+'–'+w.ga&&x.txt[2]===(w.gain?'+'+w.gain:'0')&&x.txt[3]===(w.lost?'−'+w.lost:'0')&&x.txt[4]===sg(w.net)})}
(async()=>{const b=await T.launch();const LG='l_4WFCIZ';
 let {ctx,pg,errs}=await T.open(b,{vw:1000,league:LG,hash:'#/late'});await pg.waitForSelector('.ls-row',{timeout:90000});await pg.waitForTimeout(400);
 for(const M of [75,60,80,85]){if(M!==75){await pg.click('#lsm button[data-m="'+M+'"]');await pg.waitForTimeout(250)}const C=calc(LG,M),g=await got(pg);
  ok(same(g,C),'after minute '+M+': all '+C.rows.length+' clubs — matches, points, late goals for and against, gained, lost and net match ('+C.rows[0].t+' '+sg(C.rows[0].net)+', '+C.rows[C.rows.length-1].t+' '+sg(C.rows[C.rows.length-1].net)+')');
  const k=await pg.$$eval('.ls-k .hb-t',a=>Object.fromEntries(a.map(t=>[t.dataset.k,t.querySelector('b').textContent])));
  ok(k.used===String(C.used)&&k.late===String(C.late)&&k.share===Math.round(C.late/C.all*100)+'%','after '+M+': '+C.used+' matches used, '+C.late+' of '+C.all+' goals late ('+k.share+')');
  ok(g.every(x=>{const mx=Math.max(1,...g.map(y=>Math.abs(y.net)));return Math.abs(x.w-Math.abs(x.net)/mx*50)<.02&&(x.net===0||x.side===(x.net>0?'p':'m'))}),'after '+M+': each bar is as long as its net points and on the right side')}
 /* a pressed club */
 await pg.click('#lsm button[data-m="75"]');await pg.waitForTimeout(250);const C=calc(LG,75),t=C.rows[3].t;await pg.click('.ls-row[data-t="'+t+'"]');await pg.waitForTimeout(250);
 {const r=C.rows.find(x=>x.t===t),w=r.ch.slice().sort((a,b)=>cmp(b.d,a.d)||cmp(a.id,b.id)),l=await pg.$$eval('.ls-ml li',a=>a.map(li=>({id:li.dataset.id,dd:+li.dataset.dd,txt:li.innerText.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim()})));
  ok(l.length===w.length&&w.every((x,i)=>l[i].id===x.id&&l[i].dd===x.dd&&l[i].txt.includes(x.d)&&l[i].txt.includes((x.home?'vs ':'at ')+x.opp)&&l[i].txt.includes(x.s0+' → '+x.s1)&&l[i].txt.endsWith(sg(x.dd))),t+': its '+w.length+' matches whose points changed, with the score at 75 and the final score')}
 ok(await pg.$eval('.ls-row.on',e=>e.dataset.t)===t&&(await pg.innerText('#lssel h3')).includes(t),'pressing a club marks it and opens its list');
 ok(!!(await pg.$('#lsm .lgx-g')),'the minute choice has the glass');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/late')===a.indexOf('#/states')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/late'}),'the page is the Matches hub tab after Comebacks & collapses, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* another league */
 {const L2='l_0ErfuF';({ctx,pg,errs}=await T.open(b,{vw:1000,league:L2,hash:'#/late'}));await pg.waitForSelector('.ls-row',{timeout:90000});await pg.waitForTimeout(300);ok(same(await got(pg),calc(L2,75)),'LaLiga after 75: all clubs match');ok(!errs.length,'LaLiga: no page errors');await ctx.close()}
 {const c2=await b.newContext();await c2.route(/_sh\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/late');await p2.waitForSelector('#lsroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#lsroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;await c3.route(/_sh\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/late');
  await p3.waitForSelector('#lsroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#lsroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/late'});await p3.waitForSelector('.ls-row',{timeout:90000});
  ok(/not available right now/.test(msg)&&!!(await p3.$('.ls-row')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/late'}));await pg.waitForSelector('.ls-row',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');ok(await pg.$$eval('.ls-row',a=>a.every(r=>r.scrollWidth<=r.clientWidth+1)),lang+' phone: every row fits');
  ok(same(await got(pg),calc(LG,75)),lang+' phone: the rows are the same');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/الدقائق الأخيرة/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/late_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
