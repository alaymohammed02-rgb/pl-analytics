/* Club twins: fingerprints, percentiles, similarity, twins, unique clubs and closest pairs recomputed from the raw files */
const T=require('./lib.js');const {ok,J,IDX,DOM}=T;
const KEYS=['xgf','xga','shf','sha','tilt','ppda','adx','hto','brt','ps','pr','bx','cr','dt'];
function pool(){const teams=[];
 for(const l of IDX.leagues.filter(DOM)){const L=J(l.file),S=J(l.sh_file),P=J(l.pl_file),A=J(l.adv_file),ix={},sx={};P.cols.forEach((c,k)=>ix[c]=k);S.cols.forEach((c,k)=>sx[c]=k);
  const fin=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d),M=new Map(L.matches.map(m=>[m.i,m]));
  const xf={},xa={},sf={},sa={};
  for(const r of S.rows){const m=M.get(r[sx.m]);if(!m||r[sx.og])continue;const c=r[sx.c],o=c===m.h?m.a:m.h,k=c+'|'+r[sx.m],k2=o+'|'+r[sx.m];sf[k]=(sf[k]||0)+1;sa[k2]=(sa[k2]||0)+1;if(r[sx.xg]!=null){xf[k]=(xf[k]||0)+r[sx.xg];xa[k2]=(xa[k2]||0)+r[sx.xg]}}
  const has=new Set();P.team.forEach(r=>has.add(r.m+'|'+r.n));P.rows.forEach(r=>has.add(r[ix.m]+'|'+r[ix.c]));A.team.forEach(r=>has.add(r.m+'|'+r.n));   // a match counts for a club only when some performance data exists for it
  const names=new Set();fin.forEach(m=>{names.add(m.h);names.add(m.a)});
  for(const t of names){const ms=fin.filter(m=>(m.h===t||m.a===t)&&has.has(m.i+'|'+t)).map(m=>m.i),n=ms.length;if(n<3)continue;const set=new Set(ms),v={};
   const sum=o=>ms.reduce((s,m)=>s+(o[t+'|'+m]||0),0)/n;v.xgf=sum(xf);v.xga=sum(xa);v.shf=sum(sf);v.sha=sum(sa);
   const tr=P.team.filter(r=>r.n===t&&set.has(r.m)),mean=(k)=>{const a=tr.map(r=>r[k]).filter(x=>x!=null);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};
   v.tilt=mean('tilt');v.adx=mean('adx');v.hto=mean('hto');v.brt=mean('brt');
   const at=A.team.filter(r=>r.n===t&&set.has(r.m)&&r.op!=null&&r.da>0);const da=at.reduce((s,r)=>s+r.da,0);v.ppda=da>0?at.reduce((s,r)=>s+r.op,0)/da:null;
   const pr=P.rows.filter(r=>r[ix.c]===t&&set.has(r[ix.m]));const ps=k=>pr.reduce((s,r)=>s+(r[ix[k]]!=null&&isFinite(r[ix[k]])?r[ix[k]]:0),0)/n;
   v.ps=ps('ps');v.pr=ps('pr');v.bx=ps('bx');v.cr=ps('cr');v.dt=pr.reduce((s,r)=>s+(r[ix.tk]||0)+(r[ix.ic]||0),0)/n;
   teams.push({key:l.id+'|'+t,lid:l.id,ln:l.name,t,n,v})}}
 for(const k of KEYS){const s=teams.map(x=>x.v[k]).filter(v=>v!=null).sort((a,b)=>a-b);for(const x of teams){x.q=x.q||{};const v=x.v[k];if(v==null){x.q[k]=null;continue}const lo=s.filter(y=>y<v).length,eq=s.filter(y=>y===v).length;x.q[k]=(lo+eq/2)/s.length*100}}
 return teams}
function sim(a,b){let s=0,n=0;for(const k of KEYS){if(a.q[k]==null||b.q[k]==null)continue;s+=Math.abs(a.q[k]-b.q[k]);n++}return n<10?null:100-s/n}
const twins=(Tm,x)=>Tm.filter(y=>y!==x).map(y=>({y,s:sim(x,y)})).filter(o=>o.s!=null).sort((a,b)=>b.s-a.s||a.y.t.localeCompare(b.y.t));
(async()=>{const b=await T.launch(),Tm=pool();
 const {ctx,pg,errs}=await T.open(b,{hash:'#/clubtwins'});await pg.waitForSelector('.ct-ol',{timeout:120000});
 const opts=await pg.$$eval('#ctp option',a=>a.map(o=>o.value));
 ok(opts.length===Tm.length&&Tm.every(x=>opts.includes(x.key)),'every club with 3+ matches is in the list ('+opts.length+' clubs, '+new Set(Tm.map(x=>x.lid)).size+' leagues)');
 const nbad=[];for(const x of Tm){const o=await pg.$eval(`#ctp option[value="${x.key}"]`,e=>e.parentNode.label);if(o!==x.ln)nbad.push(x.t)}ok(!nbad.length,'each club is under its own league '+nbad.slice(0,3));
 const picks=[Tm.find(x=>x.t==='Barcelona'),Tm.find(x=>x.t==='Arsenal'),Tm.find(x=>x.t==='Bayer Leverkusen'||x.t==='Bayern München')].filter(Boolean);
 for(const x of picks){await pg.selectOption('#ctp',x.key);await pg.waitForTimeout(250);
  const all=twins(Tm,x),other=all.filter(o=>o.y.lid!==x.lid).slice(0,5),same=all.filter(o=>o.y.lid===x.lid).slice(0,3);
  const lists=await pg.evaluate(()=>[...document.querySelectorAll('.lk-two')[0].querySelector('.card').querySelectorAll('.ct-ol')].map(o=>[...o.querySelectorAll('button')].map(b=>[b.dataset.tw,b.querySelector('b').textContent.trim()])));
  ok(JSON.stringify(lists[0])===JSON.stringify(other.map(o=>[o.y.key,o.s.toFixed(0)])),x.t+': 5 closest twins in other leagues and their similarity '+other.slice(0,2).map(o=>o.y.t+' '+o.s.toFixed(0)).join(', '));
  ok(JSON.stringify(lists[1])===JSON.stringify(same.map(o=>[o.y.key,o.s.toFixed(0)])),x.t+': 3 closest in its own league');
  const head=await pg.textContent('.ct-pick .mu');ok(head.includes(x.n+' matches'),x.t+': match count '+x.n);
  /* the comparison table for the top twin, value by value */
  const y=other[0].y,rows=await pg.$$eval('.ct-t tbody tr',a=>a.map(r=>[...r.cells].slice(1).map(c=>c.textContent.trim())));
  const dec={xgf:2,xga:2,shf:1,sha:1,tilt:1,ppda:1,adx:1,hto:1,brt:1,ps:0,pr:1,bx:1,cr:1,dt:1};
  /* the page adds the same numbers in another order: a value on a rounding boundary (3.365) may round either way, so a shown value is right within half a unit of its last digit */
  const near=(sh,v,d)=>v==null?sh==='–':sh!=='–'&&Math.abs(+sh-v)<=0.5*10**-d+1e-9;
  const bad=[];KEYS.forEach((k,i)=>{const g=x.q[k]==null||y.q[k]==null?null:Math.abs(x.q[k]-y.q[k]),r=rows[i]||[];if(!(near(r[0],x.v[k],dec[k])&&near(r[1],y.v[k],dec[k])&&near(r[2],g,0)))bad.push(k+' '+JSON.stringify([x.v[k],y.v[k],g])+' vs '+JSON.stringify(r))});
  ok(rows.length===14&&!bad.length,x.t+' vs '+y.t+': all 14 values and gaps match the raw files '+bad.slice(0,2).join(' | '));
  /* choosing another twin updates the table */
  const second=other[1].y;await pg.click(`.ct-ol button[data-tw="${second.key}"]:not([data-pk])`);await pg.waitForTimeout(200);
  ok((await pg.textContent('.ct-t thead')).includes(second.t),x.t+': picking '+second.t+' compares with it')}
 /* unique clubs and closest pairs */
 const best=Tm.map(x=>({x,s:(twins(Tm,x)[0]||{s:null}).s})).filter(o=>o.s!=null).sort((a,b)=>a.s-b.s||a.x.t.localeCompare(b.x.t)).slice(0,5);
 const uni=await pg.evaluate(()=>[...document.querySelectorAll('.lk-two')[1].querySelectorAll('.card')[0].querySelectorAll('button')].map(b=>[b.dataset.pk,b.querySelector('b').textContent.trim()]));
 /* the page shows scores rounded to whole numbers and puts clubs with the same rounded score in name order, so two clubs whose scores differ in the decimals
    (Nice 81.9 and 1. FC Köln 82.3 are both "82") can swap places at the edge of the five, and two clubs can even tie to the last digit (floating-point noise of 1e-14).
    So the check is: every club shown has its own rounded score, the shown scores are the five lowest rounded scores of all clubs, from the lowest up. */
 const rnd=new Map(Tm.map(x=>[x.key,(twins(Tm,x)[0]||{s:null}).s]).filter(r=>r[1]!=null).map(([k,v])=>[k,v.toFixed(0)])),low=[...rnd.values()].map(Number).sort((a,b)=>a-b).slice(0,5);
 ok(uni.length===5&&uni.every(u=>rnd.get(u[0])===u[1])&&JSON.stringify(uni.map(u=>+u[1]))===JSON.stringify(low),'most unique clubs: '+uni.map(u=>u[0].split('|')[1]+' '+u[1]).join(', ')+' (the five lowest rounded scores: '+low.join(', ')+'; exact order at the edge: '+best.map(o=>o.x.t+' '+o.s.toFixed(1)).join(', ')+')');
 const pairs=[];for(let i=0;i<Tm.length;i++)for(let j=i+1;j<Tm.length;j++){const s=sim(Tm[i],Tm[j]);if(s!=null)pairs.push({a:Tm[i],b:Tm[j],s})}
 pairs.sort((p,q)=>q.s-p.s||p.a.t.localeCompare(q.a.t)||p.b.t.localeCompare(q.b.t));const used=new Set(),cl=[];for(const p of pairs){if(cl.length>=5)break;if(used.has(p.a.key)||used.has(p.b.key))continue;used.add(p.a.key);used.add(p.b.key);cl.push(p)}
 const prs=await pg.evaluate(()=>[...document.querySelectorAll('.lk-two')[1].querySelectorAll('.card')[1].querySelectorAll('button')].map(b=>[b.dataset.pk,b.dataset.tw,b.querySelector('b').textContent.trim()]));
 ok(JSON.stringify(prs)===JSON.stringify(cl.map(p=>[p.a.key,p.b.key,p.s.toFixed(0)])),'closest pairs: '+cl.map(p=>p.a.t+' + '+p.b.t+' '+p.s.toFixed(0)).join(' | '));
 /* clicking a pair opens it */
 await pg.evaluate(()=>document.querySelectorAll('.lk-two')[1].querySelectorAll('.card')[1].querySelector('button').click());await pg.waitForTimeout(300);
 ok((await pg.$eval('#ctp',s=>s.value))===cl[0].a.key&&(await pg.textContent('.ct-t thead')).includes(cl[0].b.t),'tapping a pair opens the first club against the second');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ct_1280.png',fullPage:true});await ctx.close();
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/clubtwins'});await pg.waitForSelector('.ct-ol',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='توائم الأندية','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ct_390_'+lang+'.png',fullPage:true});await ctx.close()}
 /* leaving before the data arrives */
 {const c2=await b.newContext();await c2.route(/_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/clubtwins');await p2.waitForSelector('#ctroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#ctroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 await T.done(b)})();
