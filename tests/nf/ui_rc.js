/* Model report card: the leave-one-match-out test recomputed from the raw league + shot files with an independent implementation of the model */
const T=require('./lib.js');const {ok,J,IDX,DOM}=T;
const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
function leagueData(l){const L=J(l.file),S=J(l.sh_file),sx={};S.cols.forEach((c,k)=>sx[c]=k);const M=new Map(L.matches.map(m=>[m.i,m]));const xg={};
 for(const r of S.rows){const m=M.get(r[sx.m]);if(!m||r[sx.og]||r[sx.xg]==null)continue;const k=r[sx.m]+'|'+r[sx.c];xg[k]=(xg[k]||0)+r[sx.xg]}
 const ms=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).map(m=>{const g=m.s.split('-').map(Number);return {id:m.i,home:m.h,away:m.a,hg:g[0],ag:g[1],d:String(m.d).slice(0,10)}}).sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id));
 return {ms,xg}}
function priorOf(l){const sd=((IDX.seasons||{})[l.id]||{}).past||[],p=sd.filter(x=>x.complete&&x.sh_file&&x.file).sort((a,b)=>b.s.localeCompare(a.s))[0];if(!p)return null;
 const {ms,xg}=leagueData({file:p.file,sh_file:p.sh_file}),T_={};let hs=0,as=0,n=0;
 for(const m of ms){const xh=xg[m.id+'|'+m.home],xa=xg[m.id+'|'+m.away];if(xh==null||xa==null)continue;n++;hs+=xh;as+=xa;
  for(const [t,f,c] of [[m.home,xh,xa],[m.away,xa,xh]]){const r=T_[t]=T_[t]||[0,0,0];r[0]++;r[1]+=f;r[2]+=c}}
 return n<10?null:{n,mu:(hs+as)/(2*n),teams:T_,season:p.s}}
function predictor(ms,xg,prior){const used=ms.filter(m=>xg[m.id+'|'+m.home]!=null&&xg[m.id+'|'+m.away]!=null);if(used.length<10)return null;
 const pri={};if(prior)for(const t in prior.teams){const r=prior.teams[t];if(r[0]>=10)pri[t]=[(r[1]+3*prior.mu)/(r[0]+3)/prior.mu,(r[2]+3*prior.mu)/(r[0]+3)/prior.mu]}
 const v2=Object.keys(pri).length>0,N0=v2?12:3;
 return (h,a,skip)=>{let hs=0,as=0,n=0;const T_={};for(const m of used){if(m.id===skip)continue;const xh=xg[m.id+'|'+m.home],xa=xg[m.id+'|'+m.away];n++;hs+=xh;as+=xa;
   for(const [t,f,c] of [[m.home,xh,xa],[m.away,xa,xh]]){const r=T_[t]=T_[t]||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=c}}
  if(n<10)return null;const H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T_[t],p=pri[t]||[1,1];if(!v2&&!(r&&r.n>=3))return null;const k=r?r.n:0;return {att:((r?r.f:0)+N0*mu*p[0])/(k+N0)/mu,def:((r?r.a:0)+N0*mu*p[1])/(k+N0)/mu}};
  const x=str(h),y=str(a);if(!x||!y)return null;const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,d=0,l=0;
  for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}const s=w+d+l;return {p:[w/s,d/s,l/s],lh,la}}}
const br=(p,k)=>p.reduce((s,x,i)=>s+(x-(i===k?1:0))**2,0);
function test(){const rows=[],A={n:0,b:0,bb:0,bu:0,acc:0,accB:0,gp:0,ga:0},bins=Array.from({length:10},()=>({n:0,p:0,h:0}));
 for(const l of IDX.leagues.filter(DOM)){const {ms,xg}=leagueData(l),pr=predictor(ms,xg,priorOf(l));if(!pr)continue;const used=ms.filter(m=>xg[m.id+'|'+m.home]!=null&&xg[m.id+'|'+m.away]!=null),res=m=>m.hg>m.ag?0:m.hg===m.ag?1:2,cnt=[0,0,0];used.forEach(m=>cnt[res(m)]++);
  const L={name:l.name,n:0,b:0,bb:0,acc:0};
  for(const m of used){const r=pr(m.home,m.away,m.id);if(!r)continue;const k=res(m),oth=[cnt[0]-(k===0),cnt[1]-(k===1),cnt[2]-(k===2)],tot=oth[0]+oth[1]+oth[2],base=oth.map(x=>x/tot);
   const b=br(r.p,k),bb=br(base,k),pk=r.p.indexOf(Math.max(...r.p)),pb=base.indexOf(Math.max(...base));
   L.n++;L.b+=b;L.bb+=bb;L.acc+=pk===k;A.n++;A.b+=b;A.bb+=bb;A.bu+=br([1/3,1/3,1/3],k);A.acc+=pk===k;A.accB+=pb===k;A.gp+=r.lh+r.la;A.ga+=m.hg+m.ag;
   r.p.forEach((p,i)=>{const q=bins[Math.min(9,Math.floor(p*10))];q.n++;q.p+=p;q.h+=i===k})}
  if(L.n)rows.push(L)}
 return {rows,A,bins}}
const pc=v=>Math.round(v*100),f3=v=>v.toFixed(3);

/* the market comparison, recomputed from data/market.json with the same independent model */
function marketTest(){const M=J('market.json'),A={n:0,b1:0,b2:0,m:0,bb:0,acc1:0,acc2:0,accM:0,accB:0,d12:0,d12s:0,d2m:0,d2ms:0,mg:0,priors:0},rows=[];
 for(const l of IDX.leagues.filter(DOM)){const K=M.leagues[l.id];if(!K)continue;const {ms,xg}=leagueData(l),pri=priorOf(l),p1=predictor(ms,xg),p2=predictor(ms,xg,pri);if(!p1||!p2)continue;if(pri)A.priors++;
  const by=new Map(ms.map(m=>[m.id,m])),res=m=>m.hg>m.ag?0:m.hg===m.ag?1:2,cnt=[0,0,0];ms.forEach(m=>cnt[res(m)]++);
  const L={name:l.name,n:0,b1:0,b2:0,m:0,bb:0,prior:!!pri};
  for(const r of K.rows){const m=by.get(r.m);if(!m||!r.fin)continue;const q1=p1(m.home,m.away,m.id),q2=p2(m.home,m.away,m.id);if(!q1||!q2)continue;const k=res(m),oth=[cnt[0]-(k===0),cnt[1]-(k===1),cnt[2]-(k===2)],tot=oth[0]+oth[1]+oth[2],base=oth.map(x=>x/tot),mx=a=>a.indexOf(Math.max(...a));
   const b1=br(q1.p,k),b2=br(q2.p,k),bk=br(r.p,k),bb=br(base,k);L.n++;L.b1+=b1;L.b2+=b2;L.m+=bk;L.bb+=bb;A.n++;A.b1+=b1;A.b2+=b2;A.m+=bk;A.bb+=bb;A.acc1+=mx(q1.p)===k;A.acc2+=mx(q2.p)===k;A.accM+=mx(r.p)===k;A.accB+=mx(base)===k;
   A.d12+=b2-b1;A.d12s+=(b2-b1)**2;A.d2m+=b2-bk;A.d2ms+=(b2-bk)**2;A.mg+=r.mg||0}
  if(L.n)rows.push(L)}
 return {A,rows,M}}
(async()=>{const b=await T.launch(),E=test(),MK=marketTest();
 const {ctx,pg,errs}=await T.open(b,{hash:'#/reportcard'});await pg.waitForSelector('.rc-t',{timeout:120000});
 const A=E.A,skill=1-A.b/A.bb,intro=await pg.textContent('.lk-intro');
 ok(intro.includes(`tested on ${A.n} finished matches`),'matches tested: '+A.n+' (six leagues, a club needs 3 other matches)');
 ok(intro.includes(`${skill>=0?'+':'−'}${Math.abs(skill*100).toFixed(1)}%`)&&intro.includes(`Brier ${f3(A.b/A.n)} against ${f3(A.bb/A.n)}`),'skill '+(skill*100).toFixed(1)+'% and Brier '+f3(A.b/A.n)+' vs base rates '+f3(A.bb/A.n));
 ok(intro.includes(`right ${pc(A.acc/A.n)}% of the time, against ${pc(A.accB/A.n)}%`),'accuracy '+pc(A.acc/A.n)+'% vs always-the-common-result '+pc(A.accB/A.n)+'%');
 const vEn=skill>0.02?'a little better':skill>-0.02?'about the same':'worse';ok(intro.includes(`the model scores ${vEn} (Brier`),'the verdict wording follows the number ('+vEn+')');
 const rel=await pg.$$eval('.card:nth-of-type(2) .rc-t tbody tr, .rc-t:first-of-type tbody tr',a=>a.map(r=>[...r.cells].map(c=>c.textContent.trim())));
 const relRows=await pg.evaluate(()=>[...document.querySelectorAll('.rc-t')][0].querySelectorAll('tbody tr')&&[...[...document.querySelectorAll('.rc-t')][0].querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.textContent.trim())));
 const want=E.bins.map((q,i)=>q.n?[i*10+'–'+(i*10+10)+'%',String(q.n),pc(q.p/q.n)+'%',pc(q.h/q.n)+'%']:null).filter(Boolean);
 ok(JSON.stringify(relRows)===JSON.stringify(want),'reliability table: '+want.length+' rows, chances and rates match');
 ok(want.reduce((s,r)=>s+(+r[1]),0)===3*A.n,'every match contributes exactly three chances ('+3*A.n+')');
 const lg=await pg.evaluate(()=>[...[...document.querySelectorAll('.rc-t')][1].querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.textContent.trim())));
 const wl=E.rows.map(r=>{const s=1-r.b/r.bb;return [r.name,String(r.n),pc(r.acc/r.n)+'%',f3(r.b/r.n),f3(r.bb/r.n),(s>=0?'+':'−')+Math.abs(s*100).toFixed(1)+'%']});
 ok(JSON.stringify(lg)===JSON.stringify(wl),'league table: '+wl.map(r=>r[0]+' '+r[1]+' '+r[5]).join(' | '));
 ok((await pg.textContent('.rc-fx')).includes(`expected ${(A.gp/A.n).toFixed(2)} goals per match; there were ${(A.ga/A.n).toFixed(2)}`),'goals expected '+(A.gp/A.n).toFixed(2)+' vs actual '+(A.ga/A.n).toFixed(2));
 /* ---- last season's strengths, and the bookmakers' odds ---- */
 {const A=MK.A,n=A.n,tx=await pg.innerText('.rc-mk');
  ok(n>=100&&tx.includes('same '+n+' finished matches'),'bookmakers: '+n+' matches that both models and the odds can be scored on');
  const t1=await pg.evaluate(()=>[...document.querySelectorAll('.rc-mkt tbody tr')].map(r=>[...r.cells].map(c=>c.innerText.trim())));
  const sk=(x,y)=>{const v=1-x/y;return (v>=0?'+':'−')+Math.abs(v*100).toFixed(1)+'%'};
  const w1=[['Model 1 (this season only)',f3(A.b1/n),pc(A.acc1/n)+'%',sk(A.b1,A.bb)],['Model 2 (starts from last season)',f3(A.b2/n),pc(A.acc2/n)+'%',sk(A.b2,A.bb)],['Bookmakers',f3(A.m/n),pc(A.accM/n)+'%',sk(A.m,A.bb)],['Base rates',f3(A.bb/n),pc(A.accB/n)+'%','+0.0%']];
  ok(JSON.stringify(t1)===JSON.stringify(w1),'comparison table matches the recomputation: '+w1.map(r=>r[0].slice(0,7)+' '+r[1]).join(' | '));
  const zz=(sum,sq)=>{const m=sum/n,v=Math.max(0,sq/n-m*m)*n/(n-1),se=Math.sqrt(v/n);return {m,sig:Math.abs(m/se)>=1.96}},z12=zz(A.d12,A.d12s),zm=zz(A.d2m,A.d2ms);
  const better=rows=>rows.filter(r=>r.prior&&r.b2<r.b1).length,withP=MK.rows.filter(r=>r.prior).length;
  ok(z12.sig?(z12.m<0?tx.includes('makes the model better: Brier '+f3(A.b1/n)+' → '+f3(A.b2/n))&&tx.includes('and better in '+better(MK.rows)+' of '+withP+' leagues'):tx.includes('makes the model worse')):/makes no clear difference/.test(tx),'the model 1 → 2 sentence follows the numbers: '+f3(A.b1/n)+' → '+f3(A.b2/n)+' ('+(z12.sig?'beyond noise':'within noise')+', better in '+better(MK.rows)+' of '+withP+' leagues)');
  ok(zm.sig?(zm.m>0?/bookmakers are still better than the model/.test(tx):/The model is better than the bookmakers/.test(tx)):/too close to separate/.test(tx),'the model 2 against bookmakers sentence follows the numbers ('+(zm.sig?(zm.m>0?'bookmakers better':'model better')+', beyond noise':'within noise')+', diff '+(A.d2m/n).toFixed(4)+' per match)');
  const t2=await pg.evaluate(()=>[...document.querySelectorAll('.rc-mkl tbody tr')].map(r=>[...r.cells].map(c=>c.textContent.trim())));
  const w2=MK.rows.map(r=>[r.name,String(r.n),f3(r.b1/r.n),r.prior?f3(r.b2/r.n):'–',f3(r.m/r.n),f3(r.bb/r.n)]);
  ok(JSON.stringify(t2)===JSON.stringify(w2),'bookmaker league table: '+w2.map(r=>r[0]+' '+r[1]+' '+r[2]+'→'+r[3]).join(' | '));
  ok(tx.includes('The average margin removed from the odds was '+(A.mg/n*100).toFixed(1)+'%'),'average margin removed: '+(A.mg/n*100).toFixed(1)+'%');
  ok(A.m<A.bb&&A.b2<A.b1,'sanity: the bookmakers beat the base rates ('+f3(A.m/n)+' < '+f3(A.bb/n)+') and model 2 beats model 1 ('+f3(A.b2/n)+' < '+f3(A.b1/n)+')')}
 /* data/priors.json is last season's numbers per club, worked out again from the past season's shot and league files */
 {const P=J('priors.json');let bad=[];for(const l of IDX.leagues.filter(DOM)){const w=priorOf(l),g=P.leagues[l.id];if(!w||!g){bad.push(l.name+' missing');continue}
   if(g.season!==w.season||g.n!==w.n||Math.abs(g.mu-w.mu)>1e-3||Object.keys(g.teams).length!==Object.keys(w.teams).length)bad.push(l.name+' differs');
   for(const t in w.teams){const r=g.teams[t];if(!r||r[0]!==w.teams[t][0]||Math.abs(r[1]-w.teams[t][1])>2e-3||Math.abs(r[2]-w.teams[t][2])>2e-3)bad.push(l.name+' '+t)}}
  ok(!bad.length,'data/priors.json = last season\'s matches and xG for and against per club, worked out again for the six leagues '+bad.slice(0,3).join(' ; '))}
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/rc_1280.png',fullPage:true});await ctx.close();
 {const c2=await b.newContext();await c2.route(/_sh\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/reportcard');await p2.waitForSelector('#rcroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#rcroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 /* a failed file is not kept: the next visit loads again */
 {const c3=await b.newContext();let fail=true;await c3.route(/l_4WFCIZ_sh\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/reportcard');
  await p3.waitForSelector('#rcroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#rcroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/reportcard'});await p3.waitForSelector('.rc-t',{timeout:90000});
  ok(/not available/.test(msg)&&(await p3.$('.rc-t')),'a failed file shows a message and is retried on the next visit');await c3.close()}

 /* the odds file missing: the report card stays, the odds card says so */
 {const c4=await b.newContext();await c4.route(/market\.json/,r=>r.fulfill({status:404,body:''}));const p4=await c4.newPage(),e4=[];p4.on('pageerror',e=>e4.push(e.message));await p4.goto('http://127.0.0.1:8765/index.html#/reportcard');await p4.waitForSelector('.rc-mk',{timeout:120000});
  ok((await p4.$$('.rc-t')).length===2&&/not available for this view yet/.test(await p4.textContent('.rc-mk'))&&!e4.length,'odds file missing: the report card stays whole, the odds card says it is not available');await c4.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/reportcard'});await pg.waitForSelector('.rc-t',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(!/\$\{|nb\(/.test(await pg.textContent('#app')),lang+': no template text leaking onto the page');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='بطاقة تقييم النموذج','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/rc_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
