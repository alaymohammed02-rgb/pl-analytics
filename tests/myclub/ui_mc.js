/* My club (assets/my-club.js, #/myclub): everything is recomputed here from the raw files with the test's own loops: position, points and goal difference from the league's results,
   the next match from data/fixtures.json, its chances from data/ledger.json (or Elo's own when the match is not in the ledger), form and last results, the Elo rating, its changes and the
   sparkline, the players in form (average rating over the club's last 5 matches, 3+ rated) and the scorers; a starred club is picked, a chosen club is kept, no club asks for one; failing
   files; leaving early; the page in the Home room; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ';
const LF=J(LG+'.json'),FX=J('fixtures.json').leagues[LG],LD=J('ledger.json'),EL=J('elo_own.json').leagues[LG],PL=J(LG+'_pl.json'),RT=J(LG+'_rt.json');
const sc=s=>{const m=/^(\d+)-(\d+)$/.exec(s||'');return m?[+m[1],+m[2]]:null};
const fin=LF.matches.filter(m=>sc(m.s)&&m.d);
function table(){const t={};for(const m of fin){const g=sc(m.s);for(const [n,f,a] of [[m.h,g[0],g[1]],[m.a,g[1],g[0]]]){const r=t[n]||(t[n]={t:n,p:0,pts:0,f:0,a:0});r.p++;r.f+=f;r.a+=a;r.pts+=f>a?3:f===a?1:0}}
 return Object.values(t).sort((x,y)=>y.pts-x.pts||(y.f-y.a)-(x.f-x.a)||y.f-x.f||x.t.localeCompare(y.t))}
const TB=table();
// a club that has a match in the ledger, so the chances come from it
const lp=Object.entries(LD.p).filter(([i,v])=>v.lg===LG&&TB.some(r=>r.t===v.h))[0];
const CLUB=lp?lp[1].h:TB[0].t;
const mine=fin.filter(m=>m.h===CLUB||m.a===CLUB).sort((a,b)=>b.d.localeCompare(a.d)||b.i.localeCompare(a.i));
const res=m=>{const g=sc(m.s),h=m.h===CLUB;return g[h?0:1]>g[h?1:0]?'W':g[h?0:1]<g[h?1:0]?'L':'D'};
const fxs=FX.filter(f=>f.h===CLUB||f.a===CLUB).sort((a,b)=>a.k.localeCompare(b.k));
const seed=(c)=>c.addInitScript(([lg,club])=>{if(!sessionStorage.getItem('mc')){sessionStorage.setItem('mc','1');localStorage.setItem('plx_favs_v2',JSON.stringify({v:2,t:[{l:lg,t:club}]}))}},[LG,CLUB]);
(async()=>{
 const b=await T.launch();
 let ctx=await b.newContext({viewport:{width:1280,height:900}});await seed(ctx);
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 let pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto('http://127.0.0.1:8765/index.html#/myclub');
 await pg.waitForSelector('#mcroot .mc-h',{timeout:120000});
 ok((await pg.$eval('#mcs',s=>s.value))===CLUB,'the starred club is picked: '+CLUB);
 const r=TB.find(x=>x.t===CLUB),pos=TB.indexOf(r)+1,head=await pg.innerText('.mc-h');
 ok(head.includes(pos+'/'+TB.length)&&head.includes(r.pts+' points')&&head.includes(r.p+' played')&&head.includes((r.f-r.a>0?'+':'')+(r.f-r.a)),'position '+pos+'/'+TB.length+', '+r.pts+' points, '+r.p+' played, goal difference '+(r.f-r.a)+' as recomputed');
 /* next match and chances */
 const n=fxs[0],txt=await pg.innerText('.mc-n');
 ok(!!n&&txt.includes(n.h===CLUB?n.a:n.h)&&(await pg.$eval('.mc-m a',a=>a.getAttribute('href')))==='#/preview/'+n.i,'the next match is the first fixture of the club in fixtures.json: '+(n&&(n.h+' v '+n.a)));
 const L=LD.p[n.i],pred=EL.pred&&EL.pred[n.i],home=n.h===CLUB;
 const want=L?[['e',L.e],['m2',L.m2],['xi',L.xi],['bl',L.bl]].filter(x=>x[1]):(pred?[['e',pred]]:[]);
 const got=await pg.$$eval('.mc-tt tbody tr',a=>a.map(r=>[r.dataset.m,...[...r.querySelectorAll('td.n')].map(x=>x.innerText.trim())]));
 ok(JSON.stringify(got)===JSON.stringify(want.map(([k,v])=>[k,(Math.round((home?v[0]:v[2])*100))+'%',Math.round(v[1]*100)+'%',(Math.round((home?v[2]:v[0])*100))+'%'])),'the chances are the '+(L?'ledger\'s':'Elo\'s')+' ('+want.length+' models), the club\'s first');
 /* form and last results */
 ok(JSON.stringify(await pg.$$eval('.mc-f .ltf',a=>a.map(x=>x.className.split(' ')[1])))===JSON.stringify(mine.slice(0,5).reverse().map(res)),'the form squares are the club\'s last 5 results, oldest first');
 const lr=await pg.$$eval('.mc-lr tbody tr',a=>a.map(r=>[r.dataset.m,r.querySelector('td.n').innerText.trim()]));
 ok(JSON.stringify(lr)===JSON.stringify(mine.slice(0,6).map(m=>{const g=sc(m.s),h=m.h===CLUB;return [m.i,g[h?0:1]+' - '+g[h?1:0]]})),'the six last results, newest first, with the club\'s goals first');
 /* Elo */
 const el=EL.teams[CLUB];
 ok((await pg.innerText('.mc-rt'))===String(Math.round(el.r))&&(await pg.$$eval('.mc-sp polyline',a=>a[0].getAttribute('points').split(' ').length))===el.h.length,'Elo '+Math.round(el.r)+' and a line of '+el.h.length+' ratings');
 const et=await pg.innerText('.mc-er');ok(et.includes((el.d5>=0?'+':'−')+Math.abs(el.d5).toFixed(0))&&et.includes((el.d10>=0?'+':'−')+Math.abs(el.d10).toFixed(0)),'the changes over 5 and 10 matches are the file\'s');
 /* players in form and scorers */
 const c={};PL.cols.forEach((k,i)=>c[k]=i);const rows=PL.rows.filter(x=>x[c.c]===CLUB);
 const last=mine.slice(0,5).map(m=>m.i),sum={},cn={};
 for(const mid of last){const M=RT.m[mid];if(!M)continue;for(const [pid,v] of Object.entries(M)){if(v==null||!rows.find(x=>x[c.m]===mid&&x[c.i]===pid))continue;sum[pid]=(sum[pid]||0)+v;cn[pid]=(cn[pid]||0)+1}}
 const nm={};rows.forEach(x=>nm[x[c.i]]=x[c.n]);
 const form=Object.keys(cn).filter(p=>cn[p]>=3).map(p=>({id:p,avg:sum[p]/cn[p]})).sort((a,b)=>b.avg-a.avg||nm[a.id].localeCompare(nm[b.id])).slice(0,5);
 ok(JSON.stringify(await pg.$$eval('.mc-p tr[data-p]',a=>a.slice(0,5).map(r=>r.dataset.p)))===JSON.stringify(form.map(x=>x.id)),'players in form: the top '+form.length+' by average rating of the last 5 matches ('+(form[0]?nm[form[0].id]:'none')+' first)');
 {const sh=await pg.$$eval('.mc-p > .mc-pg > div:first-child tr[data-p] td.n b',a=>a.map(x=>x.innerText));ok(sh.length===form.length&&sh.every((t,i)=>t===form[i].avg.toFixed(2)),'the average ratings shown are the recomputed ones')}
 const agg={};rows.forEach(x=>{const a=agg[x[c.i]]||(agg[x[c.i]]={id:x[c.i],n:x[c.n],g:0,a:0});a.g+=x[c.gl]||0;a.a+=x[c.ast]||0});
 const top=Object.values(agg).filter(x=>x.g+x.a>0).sort((a,b)=>(b.g+b.a)-(a.g+a.a)||b.g-a.g||a.n.localeCompare(b.n)).slice(0,5);
 const tg=await pg.$$eval('.mc-p > .mc-pg > div:nth-child(2) tr[data-p]',a=>a.map(r=>[r.dataset.p,...[...r.querySelectorAll('td.n b')].map(x=>+x.innerText)]));
 ok(JSON.stringify(tg)===JSON.stringify(top.map(x=>[x.id,x.g,x.a])),'goals + assists: the top '+top.length+' as recomputed');
 /* choosing another club keeps the choice */
 const other=TB.find(x=>x.t!==CLUB).t;await pg.selectOption('#mcs',other);await pg.waitForTimeout(300);
 ok((await pg.$eval('.mc-h h3',h=>h.innerText))===other&&JSON.parse(await pg.evaluate(()=>localStorage.getItem('plx_myclub')))[LG]===other,'choosing '+other+' redraws the page and is kept in plx_myclub');
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='home'}),'the page is in the Home room');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* no club yet: it asks for one */
 {const r=await T.open(b,{league:LG,hash:'#/myclub'});await r.pg.waitForSelector('#mcroot select',{timeout:120000});
  ok(!(await r.pg.$('.mc-h'))&&/Pick your club/.test(await r.pg.innerText('#mcroot')),'without a club the page asks for one');
  await r.pg.selectOption('#mcroot select',CLUB);await r.pg.waitForSelector('.mc-h',{timeout:60000});ok((await r.pg.$eval('.mc-h h3',h=>h.innerText))===CLUB,'choosing a club opens the page');await r.ctx.close()}
 /* failing fixtures and ledger files: the rest still shows */
 {const c=await b.newContext();await seed(c);await c.route(/\/data\/(fixtures|ledger|elo_own)\.json/,r=>r.fulfill({status:500,body:''}));await c.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.setItem('league','l_4WFCIZ')}});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/myclub');await p.waitForSelector('#mcroot .mc-h',{timeout:120000});
  ok(/No coming match/.test(await p.innerText('#mcroot'))&&!!(await p.$('.mc-lr'))&&!e.length,'failing fixtures / ledger / Elo files: no next match, results still shown, no error');await c.close()}
 /* leaving before the data arrives */
 {const c=await b.newContext();await seed(c);await c.route(/\/data\/fixtures\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});await c.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.setItem('league','l_4WFCIZ')}});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/myclub');await p.waitForSelector('#mcroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#mcroot'))&&!!(await p.$('.lt'))&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 for(const lang of ['ar','en']){const cx=await b.newContext({viewport:{width:390,height:900}});await seed(cx);await cx.addInitScript(l=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},lang);
  const p=await cx.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/myclub');await p.waitForSelector('#mcroot .mc-h',{timeout:120000});await p.waitForTimeout(400);
  ok(await T.noscroll(p),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await p.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,svg,datalist,input')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(!/\$\{|NaN|undefined/.test(await p.innerText('#app')),'no template text, NaN or undefined')}
  ok(!e.length,lang+' phone: no page errors '+e.slice(0,2).join(' ; '));await p.screenshot({path:__dirname+'/mc_390_'+lang+'.png',fullPage:false});await cx.close()}
 await T.done(b)})();
