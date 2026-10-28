/* Player story (assets/player-story.js): every sentence recounted here from the raw files: the player's matches (league file results, per-match
   player file), PitchAPI's ratings (best match, last 5), his longest run with a goal or an assist and his current run without one, goals against xG,
   the xAG coverage, his percentiles among his position in the six leagues (450+ minutes, goalkeepers out, the same mid-rank percentile as Player
   twins) and the most similar player; the timeline bars and dots, the saved image, a player opened by link, another player picked, ratings missing,
   the Players hub tab, Arabic, 390 px, leaving early. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ',IDX=id=>T.IDX.leagues.find(l=>l.id===id),DOMS=T.IDX.leagues.filter(T.DOM);
const KEYS=['npxg','sh','xag','kp','sca','pr','bx','ps','pc','cb','tkw','tk','ic','bl','duw','aerw'];
const sc=s=>{const m=/^(\d+)\s*[-–:]\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
function matchesOf(lid,pid,rt){const L=J(IDX(lid).file),P=J(IDX(lid).pl_file),c={};P.cols.forEach((k,i)=>c[k]=i);
 const ms=new Map(L.matches.filter(m=>sc(m.s)&&m.d).map(m=>[m.i,m]));const out=[];
 for(const r of P.rows){if(r[c.i]!==pid||r[c.mi]==null||!(r[c.mi]>0))continue;const m=ms.get(r[c.m]);if(!m)continue;const g=sc(m.s),home=r[c.c]===m.h;
  const rv=rt&&rt.m&&rt.m[m.i]?rt.m[m.i][pid]:null;
  out.push({id:m.i,d:String(m.d).slice(0,10),opp:home?m.a:m.h,home,gf:home?g[0]:g[1],ga:home?g[1]:g[0],mi:r[c.mi],gl:r[c.gl]||0,ast:r[c.ast]||0,xg:r[c.xg],xag:r[c.xag],rt:typeof rv==='number'?rv:null})}
 return out.sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id))}
/* the default player: most goals + assists in the league, then minutes, then name (from the rows with minutes, as the XI Builder pool counts them) */
function pool(lid){const P=J(IDX(lid).pl_file),c={};P.cols.forEach((k,i)=>c[k]=i);const M=new Map();
 for(const r of P.rows){const mi=r[c.mi];if(mi==null)continue;let a=M.get(r[c.i]);if(!a){a={id:r[c.i],name:r[c.n],club:r[c.c],mi:0,gl:0,ast:0,pos:{}};M.set(r[c.i],a)}
  a.mi+=mi;a.club=r[c.c]||a.club;a.gl+=r[c.gl]||0;a.ast+=r[c.ast]||0;if(r[c.o])a.pos[r[c.o]]=(a.pos[r[c.o]]||0)+mi}
 return [...M.values()].map(a=>{let p=null,b=-1;for(const k in a.pos)if(a.pos[k]>b){b=a.pos[k];p=k}return {...a,p}})}
/* the percentile pool of Player twins, worked again: per league per player sums of each measure over the matches that have it */
function twinPool(){const out=[];
 for(const l of DOMS){const P=J(l.pl_file),LF=J(l.file),c={};P.cols.forEach((k,i)=>c[k]=i);const gk=new Set((LF.stats||[]).filter(s=>s.xf!=null&&s.i).map(s=>s.i));const M=new Map();
  for(const r of P.rows){const mi=r[c.mi];if(mi==null)continue;let a=M.get(r[c.i]);if(!a){a={id:r[c.i],n:r[c.n],clubs:{},pos:{},mi:0,s:{},d:{}};M.set(r[c.i],a)}
   a.mi+=mi;a.clubs[r[c.c]]=(a.clubs[r[c.c]]||0)+mi;if(r[c.o])a.pos[r[c.o]]=(a.pos[r[c.o]]||0)+mi;for(const k of KEYS){const v=r[c[k]];if(v!=null){a.s[k]=(a.s[k]||0)+v;a.d[k]=(a.d[k]||0)+mi}}}
  for(const a of M.values()){const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0];const p=(top(a.pos)||[null])[0];if(a.mi<450||p==='GK'||gk.has(a.id))continue;
   const v={};KEYS.forEach(k=>v[k]=a.d[k]>0?a.s[k]/a.d[k]*90:null);out.push({lid:l.id,id:a.id,n:a.n,club:(top(a.clubs)||[''])[0],p:['DF','MF','FW'].includes(p)?p:null,v})}}
 const pct=(G,key)=>KEYS.forEach(k=>{const s=G.map(x=>x.v[k]).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b);G.forEach(x=>{const v=x.v[k];if(v==null){x[key][k]=null;return}
  const lo=s.filter(y=>y<v).length,hi=s.filter(y=>y<=v).length;x[key][k]=(lo+(hi-lo)/2)/s.length*100})});
 out.forEach(x=>{x.q={};x.qo={}});['DF','MF','FW'].forEach(p=>pct(out.filter(x=>x.p===p),'q'));pct(out,'qo');return out}
const f2=v=>(+v).toFixed(2);
function expect(lid,pid,pos,rt,TP){const M=matchesOf(lid,pid,rt),n=M.length,E={n,M};
 E.mi=Math.round(M.reduce((s,m)=>s+m.mi,0));E.gl=M.reduce((s,m)=>s+m.gl,0);E.ast=M.reduce((s,m)=>s+m.ast,0);E.xg=M.reduce((s,m)=>s+(m.xg||0),0);E.xag=M.reduce((s,m)=>s+(m.xag||0),0);E.xagN=M.filter(m=>m.xag!=null).length;
 const R=M.filter(m=>m.rt!=null);E.best=R.slice().sort((a,b)=>b.rt-a.rt||(b.gl+b.ast)-(a.gl+a.ast)||a.d.localeCompare(b.d)||a.id.localeCompare(b.id))[0]||null;
 let best=0,bi=-1,cur=0;M.forEach((m,i)=>{if(m.gl+m.ast>0){cur++;if(cur>best){best=cur;bi=i}}else cur=0});E.run=best>=2?{n:best,from:M[bi-best+1].d,to:M[bi].d}:null;
 let k=0;for(let i=n-1;i>=0&&M[i].gl+M[i].ast===0;i--)k++;E.dry=(pos==='FW'||pos==='MF')&&k>=3&&k<n?{n:k,since:M[n-k].d}:null;
 const p90=L=>{const o=L.filter(m=>m.xg!=null&&m.xag!=null),mi=o.reduce((s,m)=>s+m.mi,0);return mi>0?o.reduce((s,m)=>s+m.xg+m.xag,0)/mi*90:null};
 E.p90=p90(M);E.l90=n>5?p90(M.slice(-5)):null;const av=L=>{const r=L.filter(m=>m.rt!=null);return r.length?r.reduce((s,m)=>s+m.rt,0)/r.length:null};E.ra=av(M);E.lra=n>5?av(M.slice(-5)):null;
 const t=TP.find(x=>x.lid===lid&&x.id===pid);
 if(t){const f=t.p?(x=>x.q):(x=>x.qo),q=KEYS.map(k=>({k,v:f(t)[k]})).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v||a.k.localeCompare(b.k));
  const peers=TP.filter(x=>t.p?x.p===t.p:true);
  const sim=(a,b)=>{let s=0,c=0;KEYS.forEach(k=>{const x=f(a)[k],y=f(b)[k];if(x!=null&&y!=null){s+=Math.abs(x-y);c++}});return c>=10?100-s/c:null};
  const tw=peers.filter(x=>x.id!==t.id).map(x=>({x,s:sim(t,x)})).filter(r=>r.s!=null).sort((a,b)=>b.s-a.s||a.x.n.localeCompare(b.x.n))[0];
  E.st={n:peers.length,top:q.slice(0,3),low:q.length>3?q[q.length-1]:null,tw}}
 return E}
const text=pg=>pg.evaluate(()=>{const g=s=>{const e=document.querySelector(s);return e?[...e.querySelectorAll('.fx-en')].map(x=>x.textContent).join(' ').replace(/\s+/g,' ').trim():null};
 return {lead:g('.ps-lead'),best:g('.ps-best'),run:g('.ps-run'),dry:g('.ps-dry'),fin:g('.ps-fin'),form:g('.ps-form'),tw:g('.ps-tw'),
  bars:[...document.querySelectorAll('.ps-bar')].map(b=>[b.dataset.k,b.querySelector('.ps-v').textContent.trim()]),
  nb:document.querySelectorAll('.ps-tl .ps-b').length,bestBar:(document.querySelector('.ps-tl .ps-b.best')||{dataset:{}}).dataset.m||null,
  g:document.querySelectorAll('.ps-tl .ps-g').length,a:document.querySelectorAll('.ps-tl .ps-a').length,h3:(document.querySelector('.ps-who h3')||{}).textContent}});
function check(tag,s,E,name){
 const xagT=E.xagN?` and ${f2(E.xag)} xAG${E.xagN<E.n?` (PitchAPI has xAG for ${E.xagN} of his ${E.n} matches)`:''}`:' (PitchAPI has no xAG for his matches)';
 const pl=(n,w)=>n+' '+w+(n===1?'':'s');ok(s.h3===name&&s.lead===`This season: ${pl(E.n,'match').replace('matchs','matches')}, ${E.mi} minutes, ${pl(E.gl,'goal')} and ${pl(E.ast,'assist')}, from ${f2(E.xg)} xG${xagT}.`,tag+': the season line ('+s.lead+')');
 ok(s.nb===E.n&&s.g===E.gl&&s.a===E.ast&&s.bestBar===(E.best?E.best.id:null),tag+': '+E.n+' bars, '+E.gl+' goal dots, '+E.ast+' assist dots, the best match in gold');
 if(E.best){const b=E.best,ga=[b.gl?b.gl+(b.gl>1?' goals':' goal'):'',b.ast?b.ast+(b.ast>1?' assists':' assist'):''].filter(Boolean).join(' and ');
  ok(s.best===`His best match by PitchAPI's rating: ${b.rt.toFixed(1)} on ${b.d}, ${b.home?'at home to':'away at'} ${b.opp}: his team ${b.gf>b.ga?'won':b.gf<b.ga?'lost':'drew'} ${b.gf}–${b.ga}${ga?', with '+ga:''}.`,tag+': best match ('+b.rt+' v '+b.opp+')')}
 else ok(s.best===null,tag+': no ratings, no best match');
 ok(E.run?s.run===`His best run: a goal or an assist in ${E.run.n} matches in a row, from ${E.run.from} to ${E.run.to}.`:s.run===null,tag+': longest run with a goal or an assist '+(E.run?E.run.n+' ('+E.run.from+' to '+E.run.to+')':'none (under 2)'));
 ok(E.dry?s.dry===`Right now: ${E.dry.n} matches without a goal or an assist, since ${E.dry.since}.`:s.dry===null,tag+': run without one now '+(E.dry?E.dry.n:'none (under 3, a defender, or never scored)'));
 const d=E.gl-E.xg;ok(s.fin===`${E.gl} ${E.gl===1?'goal':'goals'} from ${f2(E.xg)} xG: ${Math.abs(d)<0.05?'just what his chances were worth':`${f2(Math.abs(d))} ${d>0?'more':'fewer'} than his chances were worth`}.`,tag+': goals against xG ('+s.fin+')');
 if(E.l90!=null)ok(s.form&&s.form.startsWith(`xG + xAG per 90: ${f2(E.l90)} in his last 5 matches, against ${f2(E.p90)} over the whole season`)&&(E.lra==null||s.form.includes(`Average rating ${f2(E.lra)}, against ${f2(E.ra)}.`)),tag+': last 5 against the season ('+f2(E.l90)+' / '+f2(E.p90)+')');
 if(E.st){const want=E.st.top.concat(E.st.low?[E.st.low]:[]).map(q=>[q.k,String(Math.round(q.v))]);ok(JSON.stringify(s.bars)===JSON.stringify(want),tag+': percentiles among '+E.st.n+' players: '+want.map(x=>x.join(' ')).join(', '));
  ok(E.st.tw?s.tw&&s.tw.startsWith(`Most like him: ${E.st.tw.x.n} (${E.st.tw.x.club},`)&&s.tw.includes(`similarity ${E.st.tw.s.toFixed(1)} out of 100`):!s.tw,tag+': most like him '+(E.st.tw?E.st.tw.x.n+' '+E.st.tw.s.toFixed(1):'none'))}
 else ok(!s.bars.length,tag+': no percentiles (under 450 minutes or a goalkeeper)');
}
const wait=pg=>pg.waitForSelector('#psbody .ps-head,#psbody .empty:not(.skel)',{timeout:90000});
(async()=>{const b=await T.launch(),rt=J(IDX(LG).rt_file),TP=twinPool();
 const P=pool(LG),def=P.slice().sort((a,c)=>(c.gl+c.ast)-(a.gl+a.ast)||c.mi-a.mi||a.name.localeCompare(c.name))[0];
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/story'});await wait(pg);
 check('default ('+def.name+')',await text(pg),expect(LG,def.id,def.p,rt,TP),def.name);
 const svg=await pg.evaluate(()=>INS.storyCard().svg),E0=expect(LG,def.id,def.p,rt,TP);
 ok(svg.includes(def.name.replace(/&/g,'&amp;'))&&svg.includes('>'+E0.n+'<')&&svg.includes('>'+E0.gl+'<')&&(svg.match(/<rect x=/g)||[]).length>=E0.n,'the image holds the name, the matches, the goals and one bar per match');
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}).catch(()=>null),pg.click('#pssave')]);
 ok(dl&&/^story-card-.*\.png$/.test(dl.suggestedFilename()),'"Save the story as an image" downloads a PNG ('+(dl&&dl.suggestedFilename())+')');
 /* a defender of another club */
 const dfn=P.filter(a=>a.p==='DF'&&a.mi>=450).sort((a,c)=>c.mi-a.mi||a.name.localeCompare(c.name))[0];
 if(dfn.club!==def.club){await pg.selectOption('#psc',dfn.club);await wait(pg)}
 await pg.selectOption('#psp',LG+'|'+dfn.id);await pg.waitForFunction(n=>(document.querySelector('.ps-who h3')||{}).textContent===n,dfn.name,{timeout:60000});
 check('a defender ('+dfn.name+')',await text(pg),expect(LG,dfn.id,dfn.p,rt,TP),dfn.name);
 /* another league */
 const L2='l_1Isor4',P2=pool(L2),rt2=J(IDX(L2).rt_file);await pg.selectOption('#psl',L2);
 const top2=P2.slice().sort((a,c)=>c.mi-a.mi)[0];await pg.waitForFunction(n=>(document.querySelector('.ps-who h3')||{}).textContent===n,top2.name,{timeout:60000});
 check('another league: its most-used player ('+top2.name+')',await text(pg),expect(L2,top2.id,top2.p,rt2,TP),top2.name);
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a[0]==='#/players'&&a[1]==='#/story'&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/story'}),'the page is the second tab of the Players hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* opened by a link; a forward who is on a run without a goal or an assist, if there is one */
 const fwd=P.filter(a=>a.p==='FW'||a.p==='MF').map(a=>({a,E:expect(LG,a.id,a.p,rt,TP)})).filter(x=>x.E.dry).sort((x,y)=>y.E.dry.n-x.E.dry.n||x.a.name.localeCompare(y.a.name))[0];
 if(fwd){const {ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_0ErfuF',hash:'#/story/'+encodeURIComponent(LG+'|'+fwd.a.id)});await wait(pg);
  check('opened by link ('+fwd.a.name+', '+fwd.E.dry.n+' without)',await text(pg),fwd.E,fwd.a.name);ok(!errs.length,'no page errors');await ctx.close()}
 /* the ratings file fails: bars from xG + xAG, no best match */
 {const c3=await b.newContext();await c3.route(/_rt\.json/,r=>r.fulfill({status:500,body:''}));await c3.addInitScript(l=>{localStorage.setItem('league',l);localStorage.setItem('lang','en')},LG);const p3=await c3.newPage(),e3=[];p3.on('pageerror',e=>e3.push(e.message));
  await p3.goto('http://127.0.0.1:8765/index.html#/story');await wait(p3);const s=await text(p3);
  ok(s.best===null&&/xG \+ xAG \(too few ratings\)/.test(await p3.innerText('.ps-key'))&&s.nb===E0.n&&!e3.length,'ratings missing: the bars use xG + xAG and say so, no best match, no error');await c3.close()}
 {const c2=await b.newContext();await c2.route(/l_4WFCIZ_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});await c2.addInitScript(l=>localStorage.setItem('league',l),LG);const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/story');await p2.waitForSelector('#psroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#psroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/story'});await wait(pg);await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(([a,k])=>(0,eval)('('+k+')')(a,'select,option,.fx-en,bdi,svg'),['#app',T.untr.toString()]);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/قصة اللاعب/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined');
   const sv=await pg.evaluate(()=>INS.storyCard().svg);ok(/قصة الموسم/.test(sv)&&/direction="rtl"/.test(sv),'the image is in Arabic, right to left')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ps_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
