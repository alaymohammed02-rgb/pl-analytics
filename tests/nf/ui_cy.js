/* Who carries the team: shares, effective contributors, rotation and core recomputed from the raw player and line-up files */
const T=require('./lib.js');const {ok,J,lg}=T;
function raw(id){const l=lg(id),L=J(l.file),P=J(l.pl_file),X=J(l.mx_file),ix={};P.cols.forEach((c,k)=>ix[c]=k);
 const fin=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).sort((a,b)=>String(a.d).slice(0,10).localeCompare(String(b.d).slice(0,10))||a.i.localeCompare(b.i)),fs_=new Set(fin.map(m=>m.i)),T_={};
 for(const r of P.rows){if(!fs_.has(r[ix.m]))continue;const t=T_[r[ix.c]]=T_[r[ix.c]]||{pl:{},rows:0,ok:0,ms:new Set(),okMs:new Set(),xis:[]};t.ms.add(r[ix.m]);t.rows++;const a=r[ix.npxg],b=r[ix.xag];if(a==null||b==null)continue;t.ok++;t.okMs.add(r[ix.m]);const p=t.pl[r[ix.i]]=t.pl[r[ix.i]]||{id:r[ix.i],name:r[ix.n],o:0,np:0,ag:0,mi:0};p.o+=a+b;p.np+=a;p.ag+=b;p.mi+=r[ix.mi]||0}
 for(const m of fin){const lu=(X.m[m.i]||{}).lu;if(!lu)continue;for(const [sd,n] of [['h',m.h],['a',m.a]]){const x=lu[sd];if(x&&x.xi&&x.xi.length===11&&T_[n])T_[n].xis.push(x.xi.map(p=>p[0]))}}
 const rows={};for(const n in T_){const t=T_[n],L2=Object.values(t.pl).sort((a,b)=>b.o-a.o||a.name.localeCompare(b.name)),tot=L2.reduce((s,p)=>s+p.o,0);if(t.xis.length<3||t.okMs.size<3||tot<=0||L2.length<3)continue;
  const sh=L2.map(p=>p.o/tot);let ch=0;for(let i=1;i<t.xis.length;i++){const pv=new Set(t.xis[i-1]);ch+=t.xis[i].filter(x=>!pv.has(x)).length}
  const st={};t.xis.forEach(x=>x.forEach(p=>st[p]=(st[p]||0)+1));const core=Object.values(st).filter(c=>c/t.xis.length>=0.7).length;
  rows[n]={top:L2[0],top1:sh[0],top3:sh[0]+sh[1]+sh[2],neff:1/sh.reduce((s,x)=>s+x*x,0),rot:ch/(t.xis.length-1),core,nx:t.xis.length,nok:t.okMs.size,nm:t.ms.size,L:L2,tot,ok:t.ok,rows:t.rows}}
 return rows}
const pc=v=>Math.round(v*100),f1=v=>(Math.round(v*10)/10).toFixed(1),f2=v=>(Math.round(v*100)/100).toFixed(2);
(async()=>{const b=await T.launch();
 for(const id of ['l_0ErfuF','l_4WFCIZ']){const R=raw(id),name=lg(id).name,teams=Object.keys(R);
  const {ctx,pg,errs}=await T.open(b,{league:id,hash:'#/carry'});await pg.waitForSelector('.cy-bars',{timeout:90000});
  const dep=await pg.$$eval('.cy-bars li button',a=>a.map(b=>[b.dataset.tm,b.querySelector('b').textContent.trim(),b.querySelector('small').textContent.trim()]));
  const want=teams.slice().sort((a,b)=>R[b].top1-R[a].top1||a.localeCompare(b));
  ok(dep.length===teams.length&&JSON.stringify(dep.map(d=>d[0]))===JSON.stringify(want),name+': top-player share ranking, '+teams.length+' clubs in the right order');
  ok(dep.every(d=>d[1]===pc(R[d[0]].top1)+'%'&&d[2]===R[d[0]].top.name),name+': every club\'s share and top player name match ('+dep[0][0]+' '+dep[0][1]+' '+dep[0][2]+')');
  await pg.click('[data-m="rot"]');await pg.waitForTimeout(200);
  const rot=await pg.$$eval('.cy-bars li button',a=>a.map(b=>[b.dataset.tm,b.querySelector('b').textContent.trim()]));const wr=teams.slice().sort((a,b)=>R[b].rot-R[a].rot||a.localeCompare(b));
  ok(JSON.stringify(rot.map(d=>d[0]))===JSON.stringify(wr)&&rot.every(d=>d[1]===f1(R[d[0]].rot)),name+': rotation ranking and values ('+wr[0]+' '+f1(R[wr[0]].rot)+' most, '+wr[wr.length-1]+' '+f1(R[wr[wr.length-1]].rot)+' least)');
  /* a club's detail: the sentence, the player table, the footnote */
  const pick=want[2];await pg.click(`.cy-bars li button[data-tm="${pick}"]`);await pg.waitForTimeout(250);const r=R[pick];
  const txt=await pg.textContent('.cy-me p');
  ok(txt.includes(r.top.name)&&txt.includes(`${pc(r.top1)}%`)&&txt.includes(`top three ${pc(r.top3)}%`)&&txt.includes(`Effective contributors ${f1(r.neff)}`)&&txt.includes(`changes per match ${f1(r.rot)}`)&&txt.includes(`${r.core} players started 70% or more of ${r.nx} matches`),pick+': summary sentence matches (top '+pc(r.top1)+'%, top3 '+pc(r.top3)+'%, effective '+f1(r.neff)+', rotation '+f1(r.rot)+', core '+r.core+')');
  const tr=await pg.$$eval('.cy-t tbody tr',a=>a.map(x=>[...x.cells].map(c=>c.textContent.trim())));
  const badr=tr.map((row,i)=>{const p=r.L[i];const e=[p.name,p.np.toFixed(2),p.ag.toFixed(2),pc(p.o/r.tot)+'%',String(Math.round(p.mi))];return JSON.stringify(e)===JSON.stringify(row)?null:JSON.stringify(e)+' vs '+JSON.stringify(row)}).filter(Boolean);ok(tr.length===8&&!badr.length,pick+': eight players with xG, xAG, share and minutes match '+badr.slice(0,2).join(' | '));
  ok((await pg.textContent('.cy-me .ins-note')).includes(`use the ${r.nok} of the club's ${r.nm} matches that have both xG and xAG (${r.ok} of ${r.rows} player-matches)`),pick+': coverage note '+r.nok+' of '+r.nm+' matches, '+r.ok+' of '+r.rows+' player-matches');
  await pg.click('[data-m="dep"]');await pg.waitForTimeout(150);
  ok((await pg.$eval(`.cy-bars li button[data-tm="${pick}"]`,b=>b.getAttribute('data-tip'))).includes(`${r.nok} matches with xG and xAG`),pick+': the tooltip counts the matches that have xG and xAG');
  ok((await pg.$$eval('.cy-t tbody a',a=>a.every(x=>/^#\/player\//.test(x.getAttribute('href')))))===true,'player names link to their pages');
  ok(!errs.length,name+': no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/cy_'+id+'.png',fullPage:true});await ctx.close()}
 {const c2=await b.newContext();await c2.route(/_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/carry');await p2.waitForSelector('#cyroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#cyroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/carry'});await pg.waitForSelector('.cy-bars',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='مين يشيل الفريق','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/cy_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
