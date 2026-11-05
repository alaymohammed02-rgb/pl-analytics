/* Weekly digest (assets/weekly-digest.js, #/digest): for the default week and an older one, every part is recomputed here from the raw files with the test's own loops: the headline
   numbers, the three biggest surprises (Elo's own chance of the real result, data/elo_own.json), biggest wins, most goals, the table movers (two tables worked out here), the
   best ratings (rt + pl files) and how the ledger's chances scored; the picture is saved as a real PNG; failing files; leaving early; the page in the League room; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ';
const LF=J(LG+'.json'),EL=J('elo_own.json').leagues[LG],LD=J('ledger.json'),PL=J(LG+'_pl.json'),RT=J(LG+'_rt.json');
const sc=s=>{const m=/^(\d+)-(\d+)$/.exec(s||'');return m?[+m[1],+m[2]]:null};
const fin=LF.matches.filter(m=>sc(m.s)&&m.d);
const mon=d=>{const t=Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)),w=(new Date(t).getUTCDay()+6)%7;return new Date(t-w*864e5).toISOString().slice(0,10)};
const add=(d,n)=>new Date(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))+n*864e5).toISOString().slice(0,10);
const cnt={};fin.forEach(m=>{const w=mon(m.d);cnt[w]=(cnt[w]||0)+1});
const weeks=Object.keys(cnt).filter(w=>cnt[w]>=4).sort();
const o3=g=>g[0]>g[1]?0:g[0]===g[1]?1:2;
function table(upTo){const t={};for(const m of fin.filter(x=>x.d<=upTo)){const g=sc(m.s);for(const [n,f,a] of [[m.h,g[0],g[1]],[m.a,g[1],g[0]]]){const r=t[n]||(t[n]={t:n,pts:0,f:0,a:0});r.f+=f;r.a+=a;r.pts+=f>a?3:f===a?1:0}}
 return Object.values(t).sort((x,y)=>y.pts-x.pts||(y.f-y.a)-(x.f-x.a)||y.f-x.f||x.t.localeCompare(y.t))}
function week(wk){
 const end=add(wk,6),ms=fin.filter(m=>m.d>=wk&&m.d<=end),g=m=>sc(m.s);
 const goals=ms.reduce((s,m)=>s+g(m)[0]+g(m)[1],0),res=[0,0,0];ms.forEach(m=>res[o3(g(m))]++);
 const sur=ms.filter(m=>EL.pred[m.i]).map(m=>({id:m.i,p:EL.pred[m.i][o3(g(m))]})).sort((a,b)=>a.p-b.p||a.id.localeCompare(b.id)).slice(0,3);
 const wins=ms.filter(m=>g(m)[0]!==g(m)[1]).map(m=>({id:m.i,d:Math.abs(g(m)[0]-g(m)[1]),t:g(m)[0]+g(m)[1]})).sort((a,b)=>b.d-a.d||b.t-a.t||a.id.localeCompare(b.id)).slice(0,3);
 const most=ms.map(m=>({id:m.i,t:g(m)[0]+g(m)[1]})).sort((a,b)=>b.t-a.t||a.id.localeCompare(b.id)).slice(0,3);
 const T1=table(end),T0=table(add(wk,-1)),p0=new Map(T0.map((r,i)=>[r.t,i+1])),mov=T1.map((r,i)=>({t:r.t,now:i+1,was:p0.get(r.t)})).filter(x=>x.was&&x.was!==x.now).map(x=>({...x,d:x.was-x.now}));
 const up=mov.filter(x=>x.d>0).sort((a,b)=>b.d-a.d||a.now-b.now||a.t.localeCompare(b.t)).slice(0,3).map(x=>x.t),down=mov.filter(x=>x.d<0).sort((a,b)=>a.d-b.d||a.now-b.now||a.t.localeCompare(b.t)).slice(0,3).map(x=>x.t);
 const c={};PL.cols.forEach((k,i)=>c[k]=i);const nm={};PL.rows.forEach(r=>nm[r[c.i]]=r[c.n]);const top={};
 ms.forEach(m=>{const M=RT.m[m.i];if(!M)return;for(const [pid,v] of Object.entries(M)){if(v==null)continue;if(!(pid in top)||v>top[pid])top[pid]=v}});
 const best=Object.entries(top).filter(([p])=>nm[p]).sort((a,b)=>b[1]-a[1]||nm[a[0]].localeCompare(nm[b[0]])).slice(0,5).map(([p,v])=>[p,v]);
 const led={};for(const k of ['e','m2','xi','bl']){let n=0,br=0,hit=0;ms.forEach(m=>{const v=LD.p[m.i]&&LD.p[m.i][k];if(!v)return;const o=o3(g(m));n++;br+=[0,1,2].reduce((s,i)=>s+(v[i]-(i===o?1:0))**2,0);hit+=v.indexOf(Math.max(...v))===o});if(n)led[k]=[n,br/n,hit]}
 return {end,n:ms.length,goals,res,sur,wins,most,up,down,best,led};
}
(async()=>{
 const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{hash:'#/digest',league:LG});
 await pg.waitForSelector('#dgroot .dg-h',{timeout:120000});
 for(const wk of [weeks[weeks.length-1],weeks[weeks.length-3]]){
  if(wk!==(await pg.$eval('#dgw',s=>s.value))){await pg.selectOption('#dgw',wk);await pg.waitForTimeout(250)}
  const W=week(wk),txt=await pg.innerText('.dg-h');
  ok(txt.includes(wk)&&txt.includes(W.end)&&txt.includes(W.n+' matches')&&txt.includes(W.goals+' goals')&&txt.includes((W.goals/W.n).toFixed(2)+' goals a match')&&txt.includes(W.res[0]+' home wins')&&txt.includes(W.res[1]+' draws')&&txt.includes(W.res[2]+' away wins'),wk+': '+W.n+' matches, '+W.goals+' goals, '+W.res.join('/')+' as recomputed');
  const ids=sel=>pg.$$eval(sel,a=>a.map(x=>x.dataset.m));
  ok(JSON.stringify(await ids('.dg-s li'))===JSON.stringify(W.sur.map(x=>x.id)),wk+': the three biggest surprises (smallest Elo chance of the real result)');
  const ch=await pg.$$eval('.dg-s li b',a=>a.map(x=>x.innerText));ok(JSON.stringify(ch)===JSON.stringify(W.sur.map(x=>Math.round(x.p*100)+'%')),wk+': their chances as shown: '+ch.join(', '));
  ok(JSON.stringify(await ids('.dg-w .dg-2 > div:nth-child(1) li'))===JSON.stringify(W.wins.map(x=>x.id)),wk+': the biggest wins');
  ok(JSON.stringify(await ids('.dg-w .dg-2 > div:nth-child(2) li'))===JSON.stringify(W.most.map(x=>x.id)),wk+': the matches with most goals');
  const tm=sel=>pg.$$eval(sel,a=>a.map(x=>x.dataset.t));
  ok(JSON.stringify(await tm('.dg-m .dg-2 > div:nth-child(1) li'))===JSON.stringify(W.up)&&JSON.stringify(await tm('.dg-m .dg-2 > div:nth-child(2) li'))===JSON.stringify(W.down),wk+': risers '+W.up.join(', ')+' and fallers '+W.down.join(', '));
  ok(JSON.stringify(await pg.$$eval('.dg-b li',a=>a.map(x=>[x.dataset.p,x.querySelector('b').innerText])))===JSON.stringify(W.best.map(([p,v])=>[p,v.toFixed(1)])),wk+': the best ratings of the week');
  const rows=await pg.$$eval('.dg-lt tbody tr',a=>a.map(r=>[r.dataset.m,...[...r.querySelectorAll('td.n')].map(x=>x.innerText)]));
  ok(JSON.stringify(rows)===JSON.stringify(Object.entries(W.led).map(([k,[n,br,h]])=>[k,String(n),br.toFixed(3),h+'/'+n])),wk+': the ledger score of the week ('+rows.length+' models)');
 }
 /* the picture */
 {const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}),pg.click('#dgs')]);const f=await dl.path();const buf=require('fs').readFileSync(f);
  ok(/^digest-card-.*\.png$/.test(dl.suggestedFilename())&&buf.slice(0,8).toString('hex')==='89504e470d0a1a0a'&&buf.length>8000,'"Save as picture" gives a real PNG ('+dl.suggestedFilename()+', '+buf.length+' bytes)')}
 ok(/not built/.test(await pg.innerText('#dgroot')),'the page says the weekly notification is not built');
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='league'}),'the page is in the League room');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* failing Elo, ledger and rating files: the rest still shows */
 {const c=await b.newContext();await c.route(/\/data\/(elo_own|ledger)\.json|_rt\.json/,r=>r.fulfill({status:500,body:''}));await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ')});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/digest');await p.waitForSelector('#dgroot .dg-h',{timeout:120000});
  ok(!!(await p.$('.dg-w li'))&&!(await p.$('.dg-s li'))&&!e.length,'failing Elo / ledger / rating files: results and movers still shown, no surprises, no error');await c.close()}
 {const c=await b.newContext();await c.route(/\/data\/elo_own\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ')});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/digest');await p.waitForSelector('#dgroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#dgroot'))&&!!(await p.$('.lt'))&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/digest'}));await pg.waitForSelector('#dgroot .dg-h',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,svg,datalist,input,button')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/dg_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
