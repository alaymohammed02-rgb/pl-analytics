/* Thrill index: realized thrill of every match, the top list, the correlation test and the "worth watching" list recomputed from the raw files */
const T=require('./lib.js');const {ok,J,IDX,DOM,lg}=T;
const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
function leagueData(l){const L=J(l.file),S=J(l.sh_file),sx={};S.cols.forEach((c,k)=>sx[c]=k);const M=new Map(L.matches.map(m=>[m.i,m]));const xg={},goals={};
 for(const r of S.rows){const m=M.get(r[sx.m]);if(!m)continue;if(!r[sx.og]&&r[sx.xg]!=null){const k=r[sx.m]+'|'+r[sx.c];xg[k]=(xg[k]||0)+r[sx.xg]}
  if(r[sx.ev]==='Goal'){const c=r[sx.c],sc=r[sx.og]?(c===m.h?m.a:m.h):c;(goals[r[sx.m]]=goals[r[sx.m]]||[]).push({mn:+r[sx.mn]||0,ma:+r[sx.ma]||0,home:sc===m.h})}}
 Object.values(goals).forEach(a=>a.sort((x,y)=>x.mn-y.mn||x.ma-y.ma));
 const ms=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')&&m.d).map(m=>{const g=m.s.split('-').map(Number);return {id:m.i,home:m.h,away:m.a,hg:g[0],ag:g[1],d:String(m.d).slice(0,10)}}).sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id));return {ms,xg,goals}}
function predictor(ms,xg){const used=ms.filter(m=>xg[m.id+'|'+m.home]!=null&&xg[m.id+'|'+m.away]!=null);if(used.length<10)return null;
 return (h,a,skip)=>{let hs=0,as=0,n=0;const T_={};for(const m of used){if(m.id===skip)continue;const xh=xg[m.id+'|'+m.home],xa=xg[m.id+'|'+m.away];n++;hs+=xh;as+=xa;for(const [t,f,c] of [[m.home,xh,xa],[m.away,xa,xh]]){const r=T_[t]=T_[t]||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=c}}
  if(n<10)return null;const H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T_[t];return r&&r.n>=3?{att:(r.f+3*mu)/(r.n+3)/mu,def:(r.a+3*mu)/(r.n+3)/mu}:null};const x=str(h),y=str(a);if(!x||!y)return null;
  const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,d=0,l=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}const s=w+d+l;return {p:[w/s,d/s,l/s],lh,la}}}
function real(m,g,xt){let h=0,a=0,sw=0,late=0;for(const x of g){const b=Math.sign(h-a);x.home?h++:a++;if(Math.sign(h-a)!==b){sw++;if(x.mn>=80)late=1}}
 return {t:10*(.25*Math.min(m.hg+m.ag,6)/6+.30*Math.min(sw,4)/4+.15*late+.15*(Math.abs(m.hg-m.ag)<=1?1:0)+.15*Math.min(xt,5)/5),sw,late,xt}}
const expect=r=>10*(.5*Math.min(r.lh+r.la,5)/5+.5*(1-Math.abs(r.p[0]-r.p[2])));
const ranks=a=>{const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),r=[];for(let i=0;i<idx.length;){let j=i;while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++;for(let k=i;k<=j;k++)r[idx[k][1]]=(i+j)/2+1;i=j+1}return r};
function spearman(a,b){const x=ranks(a),y=ranks(b),n=a.length,mx=x.reduce((s,v)=>s+v,0)/n,my=y.reduce((s,v)=>s+v,0)/n;let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;syy+=(y[i]-my)**2}return sxy/Math.sqrt(sxx*syy)}
const even=r=>1-Math.abs(r.p[0]-r.p[2]);
function all(){const per={},pairs=[];for(const l of IDX.leagues.filter(DOM)){const {ms,xg,goals}=leagueData(l),pr=predictor(ms,xg),list=[];
  for(const m of ms){const g=goals[m.id]||[],xh=xg[m.id+'|'+m.home],xa=xg[m.id+'|'+m.away];if(g.length!==m.hg+m.ag||xh==null||xa==null)continue;const r=real(m,g,xh+xa),p=pr?pr(m.home,m.away,m.id):null;list.push({m,...r});if(p)pairs.push([p.lh+p.la,even(p),m.hg+m.ag,Math.abs(m.hg-m.ag)<=1?1:0])}
  per[l.id]={list,pr}}
 const rg=spearman(pairs.map(p=>p[0]),pairs.map(p=>p[2])),rc=spearman(pairs.map(p=>p[1]),pairs.map(p=>p[3])),k=Math.floor(pairs.length/3),avg=(a,i)=>a.reduce((t,p)=>t+p[i],0)/a.length,byG=pairs.slice().sort((a,b)=>a[0]-b[0]),byE=pairs.slice().sort((a,b)=>a[1]-b[1]);
 return {per,rg,rc,gHi:avg(byG.slice(byG.length-k),2),gLo:avg(byG.slice(0,k),2),cHi:avg(byE.slice(byE.length-k),3),cLo:avg(byE.slice(0,k),3),n:pairs.length}}
const f1=v=>v.toFixed(1),pc=v=>Math.round(v*100);
(async()=>{const b=await T.launch(),E=all();
 for(const id of ['l_0ErfuF','l_4WFCIZ']){const name=lg(id).name,cur=E.per[id];
  const {ctx,pg,errs}=await T.open(b,{league:id,hash:'#/thrill'});await pg.waitForSelector('.th-ol',{timeout:120000});
  const intro=await pg.textContent('.lk-intro');
  const sgn=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(2),word=r=>r>0.25?'clearly':r>0.1?'somewhat':'hardly';
  ok(intro.includes(`tested on ${E.n} matches`)&&intro.includes(`${f1(E.gHi)} / ${f1(E.gLo)}`)&&intro.includes(`${pc(E.cHi)}% / ${pc(E.cLo)}%`),name+': tested on '+E.n+' matches; goals in the top vs bottom expected third '+f1(E.gHi)+' / '+f1(E.gLo)+', close finishes '+pc(E.cHi)+'% / '+pc(E.cLo)+'%');
  ok(intro.includes(`${sgn(E.rg)}, ${word(E.rg)} linked`)&&intro.includes(`${sgn(E.rc)}, ${word(E.rc)} linked`),name+': correlations expected goals vs goals '+sgn(E.rg)+' ('+word(E.rg)+'), evenness vs close finish '+sgn(E.rc)+' ('+word(E.rc)+')');
  ok(E.rg>0&&E.rc>0&&E.gHi>E.gLo&&E.cHi>E.cLo,name+': both expectations point the right way (top third has more goals / more close finishes than the bottom third)');
  const lists=await pg.evaluate(()=>[...document.querySelectorAll('.th-ol')].map(o=>[...o.querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.querySelector('.th-sc b').textContent.trim(),a.querySelector('.th-mt').textContent.replace(/\s+/g,' ').trim()])));
  const top=cur.list.slice().sort((a,b)=>b.t-a.t||a.m.d.localeCompare(b.m.d)||a.m.id.localeCompare(b.m.id)).slice(0,10),topList=lists[lists.length-1];
  ok(topList.length===10&&topList.every((r,i)=>r[0]==='#/match/'+encodeURIComponent(top[i].m.id)&&r[1]===f1(top[i].t)&&r[2].includes(`${top[i].m.hg}–${top[i].m.ag}`)&&r[2].includes(`${top[i].sw} result swings`)&&r[2].includes(`xG ${top[i].xt.toFixed(1)}`)),name+': top 10 by thrill, with score, swings and xG ('+top.slice(0,2).map(o=>o.m.home+' '+o.m.hg+'-'+o.m.ag+' '+o.m.away+' '+f1(o.t)).join(' | ')+')');
  ok(top.every((o,i)=>i===0||top[i-1].t>=o.t-1e-12),name+': the list is in descending order');
  /* the coming matches: the same fixtures, ordered by expected thrill */
  const fx=J('fixtures.json').leagues[id]||[],now=Date.now(),nxt=fx.filter(x=>Date.parse(x.k||x.d)>now).sort((a,b)=>String(a.k||a.d).localeCompare(String(b.k||b.d))||String(a.i).localeCompare(String(b.i))).slice(0,12).map(x=>({x,r:cur.pr?cur.pr(x.h,x.a):null})).filter(o=>o.r);
  const ordered=m=>nxt.slice().sort((a,b)=>m==='g'?(b.r.lh+b.r.la)-(a.r.lh+a.r.la)||String(a.x.k||a.x.d).localeCompare(String(b.x.k||b.x.d)):even(b.r)-even(a.r)||String(a.x.k||a.x.d).localeCompare(String(b.x.k||b.x.d)));
  const rd=async()=>pg.evaluate(()=>[...document.querySelectorAll('.th-ol')][0]?[...document.querySelectorAll('.th-ol')[0].querySelectorAll('a')].map(a=>[a.getAttribute('href'),a.querySelector('.th-sc b').textContent.trim(),a.querySelector('.th-mt small').textContent.replace(/[\u0600-\u06FF]/g,'').replace(/\s+/g,' ').trim()]):[]);
  const lists2=await rd();
  {const w=ordered('g');ok(lists2.length===w.length&&lists2.every((r,i)=>r[0]==='#/match/'+encodeURIComponent(w[i].x.i)&&r[1]===(w[i].r.lh+w[i].r.la).toFixed(1)&&r[2].includes(`even ${pc(even(w[i].r))}%`)&&r[2].includes(`${pc(w[i].r.p[0])} / ${pc(w[i].r.p[1])} / ${pc(w[i].r.p[2])}`)),name+': coming matches by expected goals: '+w.length+' matches ('+(w[0]?w[0].x.h+' v '+w[0].x.a+' '+(w[0].r.lh+w[0].r.la).toFixed(1):'none')+')')}
  if(nxt.length){await pg.click('[data-m="c"]');await pg.waitForTimeout(150);const g2=await rd(),w=ordered('c');
   ok(g2.length===w.length&&g2.every((r,i)=>r[0]==='#/match/'+encodeURIComponent(w[i].x.i)&&r[1]===pc(even(w[i].r))+'%'),name+': switching to "Most even" reorders by evenness ('+(w[0]?w[0].x.h+' v '+w[0].x.a+' '+pc(even(w[0].r))+'%':'none')+')')}
  ok((await pg.textContent('.th-rc')).includes('25%')&&(await pg.textContent('.th-rc')).includes('30%'),name+': the recipe is on the page');
  ok(!errs.length,name+': no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/th_'+id+'.png',fullPage:true});await ctx.close()}
 /* a competition without the six-league data: a clear message */
 {const {ctx,pg,errs}=await T.open(b,{league:'l_1XLtP0',hash:'#/thrill'});await pg.waitForSelector('#throot .empty:not(.skel)',{timeout:120000});ok(/six domestic leagues/.test(await pg.textContent('#throot'))&&!errs.length,'World Cup: a clear message, no error');await ctx.close()}
 {const c2=await b.newContext();await c2.route(/_sh\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/thrill');await p2.waitForSelector('#throot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#throot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,hash:'#/thrill'});await pg.waitForSelector('.th-ol',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok((await pg.textContent('#app h2')).trim()==='مؤشر الإثارة','Arabic title')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/th_390_'+lang+'.png',fullPage:true});await ctx.close()}
 await T.done(b)})();
