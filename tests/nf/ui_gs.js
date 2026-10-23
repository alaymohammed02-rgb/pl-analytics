/* Comebacks & collapses: every number recomputed here from the raw league + shot files */
const T=require('./lib.js');const {ok,J,lg}=T;
function raw(id){const l=lg(id),L=J(l.file),S=J(l.sh_file),ix={};S.cols.forEach((c,k)=>ix[c]=k);const M=new Map(L.matches.map(m=>[m.i,m]));const G=new Map();
 for(const r of S.rows)if(r[ix.ev]==='Goal'){const m=M.get(r[ix.m]);if(!m)continue;const c=r[ix.c],sc=r[ix.og]?(c===m.h?m.a:m.h):c;(G.get(r[ix.m])||G.set(r[ix.m],[]).get(r[ix.m])).push({mn:+r[ix.mn]||0,ma:+r[ix.ma]||0,home:sc===m.h})}
 G.forEach(a=>a.sort((x,y)=>x.mn-y.mn||x.ma-y.ma));
 const teams={},F={fw:0,fd:0,fl:0,wg:0,back:0,n:0};
 for(const m of L.matches){const mm=/^(\d+)-(\d+)$/.exec(m.s||'');if(!mm||!m.d)continue;const hg=+mm[1],ag=+mm[2],g=G.get(m.i)||[];if(g.length!==hg+ag)continue;F.n++;
  const end=Math.max(90,...g.map(x=>x.mn));let h=0,a=0,t=0,mH=0,mA=0;const tm={h:[0,0,0],a:[0,0,0]};   // lead, level, trail
  const seg=to=>{const d=to-t;if(d>0){if(h>a){tm.h[0]+=d;tm.a[2]+=d}else if(h<a){tm.h[2]+=d;tm.a[0]+=d}else{tm.h[1]+=d;tm.a[1]+=d}}t=Math.max(t,to)};
  for(const x of g){seg(Math.min(x.mn,end));x.home?h++:a++;mH=Math.max(mH,h-a);mA=Math.max(mA,a-h)}seg(end);
  const first=g.length?(g[0].home?'h':'a'):null;if(first){F.wg++;const d=first==='h'?hg-ag:ag-hg;d>0?F.fw++:d===0?F.fd++:F.fl++}
  for(const [sd,n,f,c,lead,trail] of [['h',m.h,hg,ag,mH,mA],['a',m.a,ag,hg,mA,mH]]){const r=teams[n]=teams[n]||{n:0,pts:0,resc:0,drop:0,nc:0,nl:0,lead:0,trail:0,tot:0,sf:[0,0],cf:[0,0]};
   const p=f>c?3:f===c?1:0;r.n++;r.pts+=p;r.lead+=tm[sd][0];r.trail+=tm[sd][2];r.tot+=end;if(trail>0){r.nl++;if(p>0){r.nc++;r.resc+=p;if(p===3)F.back++}}if(lead>0&&p<3)r.drop+=3-p;
   if(first){const k=first===sd?r.sf:r.cf;k[0]++;k[1]+=p}}}
 return {teams,F}}
const n1=v=>(Math.round(v*10)/10).toFixed(1),n2=v=>(Math.round(v*100)/100).toFixed(2);
(async()=>{const b=await T.launch();
 for(const id of ['l_0ErfuF','l_4WFCIZ']){const R=raw(id),name=lg(id).name;
  const {ctx,pg,errs}=await T.open(b,{league:id,hash:'#/states'});await pg.waitForSelector('.gs-t',{timeout:90000});
  const rows=await pg.$$eval('.gs-t tbody tr',a=>a.map(r=>[r.dataset.tm,...[...r.cells].slice(1).map(c=>c.textContent.trim())]));
  const want=Object.entries(R.teams).sort((x,y)=>(y[1].resc-y[1].drop)-(x[1].resc-x[1].drop)||y[1].resc-x[1].resc||x[0].localeCompare(y[0]));
  ok(rows.length===want.length,name+': one row per club ('+rows.length+')');
  const bad=[];rows.forEach(r=>{const w=R.teams[r[0]];if(!w){bad.push(r[0]);return}
   const exp=[String(w.n),String(w.resc),String(w.drop),(w.resc-w.drop>0?'+':w.resc-w.drop<0?'−':'')+Math.abs(w.resc-w.drop),n1(w.lead/w.tot*100),n1(w.trail/w.tot*100),w.sf[0]?n2(w.sf[1]/w.sf[0]):'–',w.cf[0]?n2(w.cf[1]/w.cf[0]):'–'];
   if(JSON.stringify(exp)!==JSON.stringify(r.slice(1)))bad.push(r[0]+' '+JSON.stringify(exp)+' vs '+JSON.stringify(r.slice(1)))});
  ok(!bad.length,name+': every cell (matches, rescued, dropped, net, ahead %, behind %, points per game after scoring / conceding first) matches the raw files '+bad.slice(0,2).join(' | '));
  const order=await pg.$$eval('.lk-bars li button',a=>a.map(x=>x.dataset.tm));
  ok(JSON.stringify(order)===JSON.stringify(want.map(w=>w[0])),name+': bars sorted by net points, ties by rescued');
  const txt=await pg.textContent('.gs-fx'),F=R.F,pc=x=>Math.round(x/F.wg*100);
  ok(txt.includes(`won ${pc(F.fw)}%`)&&txt.includes(`drew ${pc(F.fd)}%`)&&txt.includes(`lost ${pc(F.fl)}%`)&&txt.includes(`${F.wg} matches`)&&txt.includes(`in ${F.back} matches`),name+': first-goal facts '+pc(F.fw)+'/'+pc(F.fd)+'/'+pc(F.fl)+' of '+F.wg+', comebacks to win '+F.back);
  const sumNet=want.reduce((s,[,w])=>s+w.resc-w.drop,0);ok(Number.isFinite(sumNet),name+': totals finite (league net '+sumNet+')');
  /* a club's detail: its matches, the badges agree with its numbers */
  await pg.click('.lk-bars li:nth-child(1) button');await pg.waitForTimeout(200);const top=await pg.textContent('.gs-me h3'),tw=R.teams[top.trim()];
  const lis=await pg.$$eval('.gs-me .lk-ms li',a=>a.map(l=>({came:!!l.querySelector('.gs-b.up'),lost:!!l.querySelector('.gs-b.dn')})));
  ok(lis.length===tw.n&&lis.filter(x=>x.came).length===tw.nc&&lis.filter(x=>x.lost).length>=0,name+': detail of '+top.trim()+': '+lis.length+' matches, '+lis.filter(x=>x.came).length+' comebacks (raw '+tw.nc+')');
  ok(!errs.length,name+': no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/gs_'+id+'.png',fullPage:true});await ctx.close()}
 /* stoppage time: Levante 5-2 Real Betis had a 45+4 Betis goal stored before a 45+1 Levante goal; Betis never led */
 {const {ctx,pg,errs}=await T.open(b,{league:'l_0ErfuF',hash:'#/states'});await pg.waitForSelector('.gs-t',{timeout:90000});
  await pg.click('.gs-t tbody tr[data-tm="Real Betis"]');await pg.waitForTimeout(250);
  const li=await pg.$eval('.gs-me a[href="#/match/m_2tvCpB"]',a=>({txt:a.textContent.replace(/\s+/g,' '),lost:!!a.closest('li').querySelector('.gs-b.dn'),came:!!a.closest('li').querySelector('.gs-b.up')}));
  ok(/45\+1' 2–1 · 45\+4' 2–2/.test(li.txt),"stoppage order: 45+1' 2–1 comes before 45+4' 2–2 ("+li.txt.slice(-90)+")");
  ok(!li.lost,'Real Betis never led Levante, so it dropped no points there');await ctx.close()}
 /* a league without shots data: a clear message, no crash */
 {const {ctx,pg,errs}=await T.open(b,{league:'l_1XLtP0',hash:'#/states'});await pg.waitForSelector('#gsroot .empty:not(.skel),.gs-t',{timeout:90000});ok(!errs.length,'World Cup: no page errors, page shows '+((await pg.$('.gs-t'))?'its table':'a message'));await ctx.close()}
 /* leaving before the data arrives */
 {const ctx=await b.newContext();await ctx.route(/_sh\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html#/states');await pg.waitForSelector('#gsroot',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('.lt',{timeout:60000});await pg.waitForTimeout(3000);
  ok(!(await pg.$('#gsroot'))&&await pg.$('.lt')&&!errs.length,'leaving before the data arrives: the league table stays, no error');await ctx.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/states'});await pg.waitForSelector('.gs-t',{timeout:90000});await pg.waitForTimeout(500);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='العودات والانهيارات','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/gs_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
