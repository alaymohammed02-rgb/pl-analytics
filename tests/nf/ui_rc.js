/* Model report card: the leave-one-match-out test recomputed from the raw league + shot files with an independent implementation of the model */
const T=require('./lib.js');const {ok,J,IDX,DOM}=T;
const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
function leagueData(l){const L=J(l.file),S=J(l.sh_file),sx={};S.cols.forEach((c,k)=>sx[c]=k);const M=new Map(L.matches.map(m=>[m.i,m]));const xg={};
 for(const r of S.rows){const m=M.get(r[sx.m]);if(!m||r[sx.og]||r[sx.xg]==null)continue;const k=r[sx.m]+'|'+r[sx.c];xg[k]=(xg[k]||0)+r[sx.xg]}
 const ms=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).map(m=>{const g=m.s.split('-').map(Number);return {id:m.i,home:m.h,away:m.a,hg:g[0],ag:g[1],d:String(m.d).slice(0,10)}}).sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id));
 return {ms,xg}}
function predictor(ms,xg){const used=ms.filter(m=>xg[m.id+'|'+m.home]!=null&&xg[m.id+'|'+m.away]!=null);if(used.length<10)return null;
 return (h,a,skip)=>{let hs=0,as=0,n=0;const T_={};for(const m of used){if(m.id===skip)continue;const xh=xg[m.id+'|'+m.home],xa=xg[m.id+'|'+m.away];n++;hs+=xh;as+=xa;
   for(const [t,f,c] of [[m.home,xh,xa],[m.away,xa,xh]]){const r=T_[t]=T_[t]||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=c}}
  if(n<10)return null;const H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T_[t];return r&&r.n>=3?{att:(r.f+3*mu)/(r.n+3)/mu,def:(r.a+3*mu)/(r.n+3)/mu}:null};
  const x=str(h),y=str(a);if(!x||!y)return null;const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,d=0,l=0;
  for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}const s=w+d+l;return {p:[w/s,d/s,l/s],lh,la}}}
const br=(p,k)=>p.reduce((s,x,i)=>s+(x-(i===k?1:0))**2,0);
function test(){const rows=[],A={n:0,b:0,bb:0,bu:0,acc:0,accB:0,gp:0,ga:0},bins=Array.from({length:10},()=>({n:0,p:0,h:0}));
 for(const l of IDX.leagues.filter(DOM)){const {ms,xg}=leagueData(l),pr=predictor(ms,xg);if(!pr)continue;const used=ms.filter(m=>xg[m.id+'|'+m.home]!=null&&xg[m.id+'|'+m.away]!=null),res=m=>m.hg>m.ag?0:m.hg===m.ag?1:2,cnt=[0,0,0];used.forEach(m=>cnt[res(m)]++);
  const L={name:l.name,n:0,b:0,bb:0,acc:0};
  for(const m of used){const r=pr(m.home,m.away,m.id);if(!r)continue;const k=res(m),oth=[cnt[0]-(k===0),cnt[1]-(k===1),cnt[2]-(k===2)],tot=oth[0]+oth[1]+oth[2],base=oth.map(x=>x/tot);
   const b=br(r.p,k),bb=br(base,k),pk=r.p.indexOf(Math.max(...r.p)),pb=base.indexOf(Math.max(...base));
   L.n++;L.b+=b;L.bb+=bb;L.acc+=pk===k;A.n++;A.b+=b;A.bb+=bb;A.bu+=br([1/3,1/3,1/3],k);A.acc+=pk===k;A.accB+=pb===k;A.gp+=r.lh+r.la;A.ga+=m.hg+m.ag;
   r.p.forEach((p,i)=>{const q=bins[Math.min(9,Math.floor(p*10))];q.n++;q.p+=p;q.h+=i===k})}
  if(L.n)rows.push(L)}
 return {rows,A,bins}}
const pc=v=>Math.round(v*100),f3=v=>v.toFixed(3);
(async()=>{const b=await T.launch(),E=test();
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
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/rc_1280.png',fullPage:true});await ctx.close();
 {const c2=await b.newContext();await c2.route(/_sh\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/reportcard');await p2.waitForSelector('#rcroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#rcroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 /* a failed file is not kept: the next visit loads again */
 {const c3=await b.newContext();let fail=true;await c3.route(/l_4WFCIZ_sh\.json/,r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/reportcard');
  await p3.waitForSelector('#rcroot .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#rcroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/reportcard'});await p3.waitForSelector('.rc-t',{timeout:90000});
  ok(/not available/.test(msg)&&(await p3.$('.rc-t')),'a failed file shows a message and is retried on the next visit');await c3.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/reportcard'});await pg.waitForSelector('.rc-t',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='بطاقة تقييم النموذج','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/rc_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
