/* League DNA: every league's 15 measures recomputed from the raw league, shot, player and advanced files */
const T=require('./lib.js');const {ok,J,IDX,DOM}=T;
const KEYS=['gpm','xgpm','shpm','hw','dr','aw','nn','g3','late','fgw','xgw','hxe','ppda','adx','bal'],DEC={gpm:2,xgpm:2,shpm:1,hw:0,dr:0,aw:0,nn:0,g3:0,late:0,fgw:0,xgw:0,hxe:2,ppda:2,adx:1,bal:2},SUF={hw:'%',dr:'%',aw:'%',nn:'%',g3:'%',late:'%',fgw:'%',xgw:'%'};
function league(l){const L=J(l.file),S=J(l.sh_file),P=J(l.pl_file),A=J(l.adv_file),sx={};S.cols.forEach((c,k)=>sx[c]=k);const M=new Map(L.matches.map(m=>[m.i,m]));
 const ms=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).map(m=>{const g=m.s.split('-').map(Number);return {id:m.i,home:m.h,away:m.a,hg:g[0],ag:g[1]}});
 const xg={},goals={},shots=[];
 for(const r of S.rows){const m=M.get(r[sx.m]);if(!m)continue;if(!r[sx.og]){shots.push(1);if(r[sx.xg]!=null&&isFinite(r[sx.xg])){const k=r[sx.m]+'|'+r[sx.c];xg[k]=(xg[k]||0)+r[sx.xg]}}
  if(r[sx.ev]==='Goal'){const c=r[sx.c],sc=r[sx.og]?(c===m.h?m.a:m.h):c;(goals[r[sx.m]]=goals[r[sx.m]]||[]).push({mn:+r[sx.mn]||0,ma:+r[sx.ma]||0,home:sc===m.h})}}
 Object.values(goals).forEach(a=>a.sort((x,y)=>x.mn-y.mn||x.ma-y.ma));
 const n=ms.length,used=ms.filter(m=>xg[m.id+'|'+m.home]!=null&&xg[m.id+'|'+m.away]!=null),X=m=>[xg[m.id+'|'+m.home],xg[m.id+'|'+m.away]],v={};
 const share=f=>ms.filter(f).length/n*100;
 v.gpm=ms.reduce((s,m)=>s+m.hg+m.ag,0)/n;v.xgpm=used.reduce((s,m)=>s+X(m)[0]+X(m)[1],0)/used.length;v.shpm=shots.length/n;
 v.hw=share(m=>m.hg>m.ag);v.dr=share(m=>m.hg===m.ag);v.aw=share(m=>m.hg<m.ag);v.nn=share(m=>m.hg+m.ag===0);v.g3=share(m=>m.hg+m.ag>=3);
 let late=0,gl=0,fw=0,fn=0;for(const m of ms){const g=goals[m.id]||[];if(g.length!==m.hg+m.ag)continue;g.forEach(x=>{gl++;if(x.mn>=75)late++});if(g.length){fn++;const d=g[0].home?m.hg-m.ag:m.ag-m.hg;if(d>0)fw++}}
 v.late=gl?late/gl*100:null;v.fgw=fn?fw/fn*100:null;
 let cl=0,cw=0;for(const m of used){const [a,b]=X(m);if(Math.abs(a-b)>=0.5){cl++;if(a>b&&m.hg>m.ag||b>a&&m.ag>m.hg)cw++}}v.xgw=cl?cw/cl*100:null;
 v.hxe=used.reduce((s,m)=>s+X(m)[0]-X(m)[1],0)/used.length;
 let op=0,da=0;for(const r of A.team)if(r.op!=null&&r.da>0){op+=r.op;da+=r.da}v.ppda=da>0?op/da:null;
 const ax=P.team.map(r=>r.adx).filter(x=>x!=null);v.adx=ax.reduce((s,x)=>s+x,0)/ax.length;
 const Tm={};for(const m of used){const [a,b]=X(m);for(const [t,d] of [[m.home,a-b],[m.away,b-a]]){const r=Tm[t]=Tm[t]||{n:0,d:0};r.n++;r.d+=d}}
 const dd=Object.values(Tm).filter(r=>r.n>=3).map(r=>r.d/r.n),mu=dd.reduce((a,b)=>a+b,0)/dd.length;v.bal=dd.length>=4?Math.sqrt(dd.reduce((s,x)=>s+(x-mu)**2,0)/dd.length):null;
 return {id:l.id,name:l.name,n,v}}
const fmt=(k,v)=>v==null?'–':v.toFixed(DEC[k])+(SUF[k]||'');
(async()=>{const b=await T.launch(),rows=IDX.leagues.filter(DOM).map(league);
 const {ctx,pg,errs}=await T.open(b,{hash:'#/leaguedna'});await pg.waitForSelector('.ld-grid',{timeout:120000});
 const cards=await pg.$$eval('.ld-c',cs=>cs.map(c=>[...c.querySelectorAll('li')].map(l=>[l.querySelector('.ld-n').textContent.trim(),l.querySelector('b').textContent.trim(),l.classList.contains('me')])));
 ok(cards.length===15,'15 measure cards ('+cards.length+')');
 const bad=[];KEYS.forEach((k,i)=>{const want=rows.filter(r=>r.v[k]!=null).sort((a,b)=>b.v[k]-a.v[k]||a.name.localeCompare(b.name)).map(r=>[r.name,fmt(k,r.v[k]),r.id==='l_0ErfuF']);if(JSON.stringify(want)!==JSON.stringify(cards[i]))bad.push(k+' '+JSON.stringify(want.slice(0,2))+' vs '+JSON.stringify(cards[i].slice(0,2)))});
 ok(!bad.length,'all 15 measures x 6 leagues: values, order and the selected league mark match the raw files '+bad.slice(0,2).join(' | '));
 ok(rows.every(r=>Math.abs(r.v.hw+r.v.dr+r.v.aw-100)<1e-9),'home + draw + away = 100% in every league');
 ok(rows.every(r=>r.v.late>0&&r.v.late<45&&r.v.fgw>40&&r.v.fgw<90),'sanity: late goals and first-scorer-wins are plausible '+rows.map(r=>r.name.slice(0,3)+' '+r.v.late.toFixed(0)+'/'+r.v.fgw.toFixed(0)).join(' '));
 /* what stands out: the 3 measures furthest from the six-league average */
 const cur=rows.find(r=>r.id==='l_0ErfuF'),z=KEYS.map(k=>{const a=rows.map(r=>r.v[k]).filter(x=>x!=null),mu=a.reduce((s,x)=>s+x,0)/a.length,sd=Math.sqrt(a.reduce((s,x)=>s+(x-mu)**2,0)/a.length);return {k,z:cur.v[k]==null||!sd?0:(cur.v[k]-mu)/sd,mu}}).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z));
 const tr=await pg.$$eval('.ld-tr li',a=>a.map(l=>[l.querySelector('b').textContent.trim(),l.querySelector('.mu').textContent.replace(/\s+/g,' ').trim()]));
 ok(tr.length===3&&tr.every((t,i)=>t[0]===fmt(z[i].k,cur.v[z[i].k])&&t[1].includes(fmt(z[i].k,z[i].mu))&&t[1].includes(z[i].z>0?'above':'below')),'what stands out for LaLiga: '+z.slice(0,3).map(o=>o.k+' '+o.z.toFixed(2)+'σ').join(', '));
 /* another league picked in the header: the mark and the traits follow */
 await pg.selectOption('#lgpick','l_4WFCIZ').catch(()=>{});await pg.waitForTimeout(1500);
 const markers=await pg.$$eval('.ld-c li.me .ld-n',a=>a.map(x=>x.textContent.trim()));
 ok(markers.length===15&&markers.every(m=>m==='Premier League'),'switching the league moves the highlight to the Premier League in every card');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ld_1280.png',fullPage:true});await ctx.close();
 {const c2=await b.newContext();await c2.route(/_adv\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/leaguedna');await p2.waitForSelector('#ldroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#ldroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/leaguedna'});await pg.waitForSelector('.ld-grid',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='بصمة الدوري','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ld_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
