/* Likely line-ups: the guess, the back-test and the calibration table recomputed from the raw files */
const T=require('./lib.js');const {ok,J,lg}=T;
const COEF=JSON.parse(/XI_COEF=(\{[^}]*\})/.exec(require('fs').readFileSync((process.env.PLREPO||__dirname+'/../..')+'/assets/likely-xi.js','utf8'))[1].replace(/b0:/,'"b0":').replace(/b:/,'"b":'));
function raw(id){const l=lg(id),L=J(l.file),X=J(l.mx_file),P=J(l.pl_file),H={},ix={};P.cols.forEach((c,k)=>ix[c]=k);const mins={},hasPl=new Set();P.rows.forEach(r=>{mins[r[ix.m]+'|'+r[ix.i]]=r[ix.mi]||0;hasPl.add(r[ix.m])});
 const ms=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).sort((a,b)=>String(a.d).slice(0,10).localeCompare(String(b.d).slice(0,10))||a.i.localeCompare(b.i));
 for(const m of ms){const e=X.m[m.i],lu=e&&e.lu;if(!lu||!hasPl.has(m.i))continue;for(const [sd,t] of [['h',m.h],['a',m.a]]){const x=lu[sd];if(x&&x.xi&&x.xi.length===11)(H[t]=H[t]||[]).push({id:m.i,xi:x.xi})}}
 H.__mins=mins;return H}
function guess(prior,mins,flat){const n=prior.length,info={},gk=new Set(),starts={};
 prior.forEach((h,i)=>h.xi.forEach(p=>{starts[p[0]]=(starts[p[0]]||0)+1;if(p[3]===11)gk.add(p[0]);info[p[0]]={id:p[0],name:p[1],last:i}}));
 const st=(pid,k)=>prior[n-k]&&prior[n-k].xi.some(p=>p[0]===pid)?1:0,c=COEF;
 const rank=Object.values(info).map(r=>{const rate=starts[r.id]/n,z=c.b0+c.b[0]*st(r.id,1)+c.b[1]*st(r.id,2)+c.b[2]*st(r.id,3)+c.b[3]*rate+c.b[4]*((mins[prior[n-1].id+'|'+r.id]||0)/90);return {...r,p:flat?rate:1/(1+Math.exp(-z))}}).sort((a,b)=>b.p-a.p||b.last-a.last||a.name.localeCompare(b.name));
 const g=rank.filter(r=>gk.has(r.id))[0],out=rank.filter(r=>!gk.has(r.id)).slice(0,g?10:11);return (g?[g]:[]).concat(out)}
function back(H){const mins=H.__mins,B={n:0,model:0,last:0,freq:0,beat:0,tie:0,bins:[[.9,1.01,0,0],[.7,.9,0,0],[.5,.7,0,0],[0,.5,0,0]]};
 for(const t in H){if(t==='__mins')continue;const h=H[t];for(let j=3;j<h.length;j++){const prior=h.slice(0,j),act=new Set(h[j].xi.map(p=>p[0])),g=guess(prior,mins),f=guess(prior,mins,true);
  const hit=g.filter(p=>act.has(p.id)).length,lh=prior[j-1].xi.filter(p=>act.has(p[0])).length;B.n++;B.model+=hit;B.last+=lh;B.freq+=f.filter(p=>act.has(p.id)).length;hit>lh?B.beat++:hit===lh&&B.tie++;
  g.forEach(p=>{const b=B.bins.find(x=>p.p>=x[0]&&p.p<x[1]);if(b){b[2]++;if(act.has(p.id))b[3]++}})}}return B}
(async()=>{const b=await T.launch();
 for(const id of ['l_0ErfuF','l_4WFCIZ']){const name=lg(id).name,H=raw(id),B=back(H);
  const {ctx,pg,errs}=await T.open(b,{league:id,hash:'#/xi'});await pg.waitForSelector('.lx-list',{timeout:90000});
  const txt=await pg.textContent('.lk-intro');const a=v=>(v/B.n).toFixed(2),pc=v=>Math.round(v*100);
  ok(txt.includes(a(B.model))&&txt.includes(a(B.last))&&txt.includes(a(B.freq))&&txt.includes(`${B.n} guesses`)&&txt.includes(`${pc((B.beat+B.tie)/B.n)}%`),name+': back-test '+B.n+' guesses, '+a(B.model)+' right of 11 vs '+a(B.last)+' (same as last match) vs '+a(B.freq));
  const rows=await pg.$$eval('.lx-two ~ .card tbody tr, .card tbody tr',a=>a.map(r=>[...r.cells].map(c=>c.textContent.trim())));
  const cal=rows.filter(r=>/%|under/.test(r[0]||'')&&r.length===3);
  ok(cal.length===4&&B.bins.every((x,i)=>cal[i][1]===String(x[2])&&cal[i][2]===(x[2]?Math.round(x[3]/x[2]*100)+'%':'–')),name+': calibration table '+JSON.stringify(B.bins.map(x=>[x[2],x[2]?Math.round(x[3]/x[2]*100):null])));
  /* a club's likely XI: the same eleven, in the same order, as the raw files give */
  const teams=await pg.$$eval('#lxt option',a=>a.map(o=>o.value));
  ok(teams.length===Object.keys(H).filter(t=>t!=='__mins'&&H[t].length>=3).length,name+': a club for every team with 3+ line-ups ('+teams.length+')');
  for(const t of [teams[0],teams[teams.length-1]]){await pg.selectOption('#lxt',t);await pg.waitForTimeout(200);
   const want=guess(H[t],H.__mins),got=await pg.$$eval('.lx-list:not(.lx-bench) li',a=>a.map(l=>[l.querySelector('.lx-pn').textContent.trim(),l.querySelector('b').textContent.trim()]));
   ok(got.length===11&&got.every((g,i)=>g[0]===want[i].name&&g[1]===Math.round(want[i].p*100)+'%'),name+' / '+t+': likely XI and each percentage match the raw line-ups');
   ok((await pg.$$('.lx-d')).length===11&&/Chance to start/.test(await pg.$eval('.lx-d',g=>g.getAttribute('data-tip'))),name+' / '+t+': 11 players on the pitch with a tooltip')}
  ok(/Next:|No upcoming match/.test(await pg.textContent('.lx-nx')),name+': next match line shown');
  ok(!errs.length,name+': no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/xi_'+id+'.png',fullPage:true});await ctx.close()}
 /* a latest match with a line-up but no player rows (Braga - Gil Vicente) must not zero every minutes figure */
 {const {ctx,pg,errs}=await T.open(b,{league:'l_4QexZg',hash:'#/xi'});await pg.waitForSelector('.lx-list',{timeout:90000});
  for(const t of ['Braga','Gil Vicente']){await pg.selectOption('#lxt',t);await pg.waitForTimeout(200);
   const p=await pg.$$eval('.lx-list:not(.lx-bench) li b',a=>a.map(x=>parseInt(x.textContent)));ok(p.length===11&&Math.max(...p)>=70&&p.filter(v=>v>=60).length>=4,t+': regular starters keep a high chance although the latest match has no player rows ('+p.join(' ')+')')}
  ok(!errs.length,'Liga Portugal: no page errors');await ctx.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/xi'});await pg.waitForSelector('.lx-list',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='التشكيلات المحتملة','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/xi_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
