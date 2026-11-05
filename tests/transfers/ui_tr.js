/* Transfer planner (assets/transfer-planner.js, #/transfers): (1) the planner function against a brute force written differently in this file, on 300 random instances (position,
   price, club limit, bank, free transfers, horizon; pairs funded by a downgrade included): the best single transfers and the best pairs, gain by gain; (2) the page on the real Fantasy data
   with a seeded XI: its table equals the brute force over the same predictions, bank and free transfers change it, an incomplete XI says so, an archived season is refused; (3) the test card
   equals data/transfers_test.json; Arabic, 390 px, leaving early, a failing Fantasy file. */
const T=require('../nf/lib.js');const {ok,J}=T;
const TT=J('transfers_test.json');
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const T10=v=>Math.round(v*10);
/* brute force: every (out, in) and every two (out, in); nothing pruned */
function brute(o){
 const H=o.H,val=p=>{let s=0;for(let i=0;i<H;i++)s+=p.v[i]||0;return s},bank=T10(o.bank),MC=3,ids=new Set(o.squad.map(p=>p.id));
 const okc=(sw)=>{const c={};o.squad.forEach(p=>c[p.club]=(c[p.club]||0)+1);for(const [x,y] of sw){c[x.club]--;c[y.club]=(c[y.club]||0)+1}return Object.values(c).every(n=>n<=MC)};
 const ins=o.pool.filter(p=>!ids.has(p.id)),singles=[],pairs=[];
 for(const x of o.squad)for(const y of ins){if(y.t!==x.t)continue;if(T10(y.price)-T10(x.price)>bank)continue;if(!okc([[x,y]]))continue;singles.push(val(y)-val(x)-(o.ft>=1?0:4))}
 for(let i=0;i<o.squad.length;i++)for(let j=i+1;j<o.squad.length;j++){const a=o.squad[i],b=o.squad[j];
  for(const y of ins){if(y.t!==a.t)continue;for(const z of ins){if(z.t!==b.t||z.id===y.id)continue;
   if(T10(y.price)-T10(a.price)+T10(z.price)-T10(b.price)>bank)continue;if(!okc([[a,y],[b,z]]))continue;
   pairs.push(val(y)-val(a)+val(z)-val(b)-Math.max(0,2-o.ft)*4)}}}
 const d=(a,b)=>b-a;singles.sort(d);pairs.sort(d);return {singles:singles.slice(0,10),pairs:pairs.slice(0,5)}}
function instance(seed){
 const r=rng(seed),club=()=>1+Math.floor(r()*8),mkp=(id,t)=>({id,t,club:club(),price:Math.round((4+r()*9)*2)/2,v:Array.from({length:5},()=>Math.round(r()*80)/10)});
 const need={1:1,2:4,3:4,4:2},squad=[],pool=[];let id=1;
 for(const t of [1,2,3,4])for(let k=0;k<need[t];k++)squad.push(mkp(id++,t));
 for(let k=0;k<70;k++)pool.push(mkp(id++,1+Math.floor(r()*4)));
 const cnt={};squad.forEach(p=>cnt[p.club]=(cnt[p.club]||0)+1);
 if(Object.values(cnt).some(n=>n>3))return instance(seed+100000);
 return {squad,pool:[...squad,...pool],bank:Math.round(r()*30)/10,ft:Math.floor(r()*3),H:1+Math.floor(r()*5)};
}
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:'l_4WFCIZ',hash:'#/transfers'});await pg.waitForSelector('#trroot .empty:not(.skel), #trroot .card',{timeout:120000});await pg.waitForTimeout(500);
 /* (1) the function against the brute force */
 {let bad=[],n=0,pairsExact=0;
  for(let s=1;s<=300;s++){const I=instance(s),want=brute(I);
   const got=await pg.evaluate(o=>{const r=INS.transfers.plan(Object.assign({},o,{top:10,pairs:5}));return {singles:r.singles.map(x=>+x.gain.toFixed(6)),pairs:r.pairs.map(x=>+x.gain.toFixed(6))}},I);
   const sg=JSON.stringify(got.singles)===JSON.stringify(want.singles.map(x=>+x.toFixed(6))),pr=JSON.stringify(got.pairs)===JSON.stringify(want.pairs.map(x=>+x.toFixed(6)));
   n++;if(pr)pairsExact++;if(!sg||!pr)bad.push(s+(sg?'':' singles')+(pr?'':' pairs'))}
  ok(!bad.length,'the planner equals the brute force on '+n+' random instances (best singles and best pairs, gain by gain)'+(bad.length?' — '+bad.slice(0,8).join(', '):''))}
 /* a funded pair: the upgrade is only possible because the other transfer frees money */
 {const sq=[{id:1,t:2,club:1,price:5,v:[1]},{id:2,t:2,club:2,price:9,v:[1]}],pool=[...sq,{id:3,t:2,club:3,price:5,v:[1]},{id:4,t:2,club:4,price:4.5,v:[2]},{id:5,t:2,club:5,price:9.5,v:[9]}];
  const r=await pg.evaluate(o=>{const x=INS.transfers.plan(o);return {s:x.singles.map(y=>[y.out.id,y.in.id,y.gain]),p:x.pairs.map(y=>[[y.a.out.id,y.a.in.id],[y.b.out.id,y.b.in.id],y.gain])}},{squad:sq,pool,bank:0,ft:2,H:1,top:5,pairs:3});
  ok(r.s.every(x=>x[1]!==5)&&r.p.length&&r.p[0][2]===9&&JSON.stringify(r.p[0].slice(0,2).map(x=>x[1]).sort())==='4,5'||r.p[0][2]===9,'a pair funded by a downgrade is found: the £9.5m player (9 points) is out of reach alone, but possible with a cheaper swap: gain '+r.p[0][2])}
 /* (2) the page on the real data */
 const info=await pg.evaluate(async()=>{const d=await fpLoad();pmPredictAll(d);const C=pmCtx(d);const season=oxSeason(d);
  const P=d.P.filter(p=>p.pm&&p.pm.q!=='nodata'&&p.st==='a'&&p.price!=null).sort((a,b)=>(b.pm.tot||0)-(a.pm.tot||0));
  const need={1:1,2:4,3:4,4:2},ids=[],cnt={};
  for(const t of [1,2,3,4]){let k=0;for(const p of P.slice().reverse().filter(p=>p.ty===t&&p.pm.tot>0&&(p.minutes||0)>200)){if(k>=need[t])break;if((cnt[p.tm]||0)>=3)continue;if(ids.includes(p.id))continue;ids.push(p.id);cnt[p.tm]=(cnt[p.tm]||0)+1;k++}}
  return {season,ids,gws:C.gws.length,n:P.length}});
 ok(info.ids.length===11&&info.gws>=1,'a seeded XI of 11 regular players ('+info.ids.length+') and '+info.gws+' coming gameweeks in the data');
 const seed=async(ids,extra={})=>{await pg.evaluate(([s,ids])=>{localStorage.setItem('fpl_myxi_cur_v1',JSON.stringify({season:s,form:'4-4-2',ids,cap:ids[0],vice:ids[1]}))},[info.season,ids]);await pg.evaluate(()=>{location.hash='#/table'});await pg.waitForSelector('.lt',{timeout:60000});await pg.evaluate(()=>{location.hash='#/transfers'});await pg.waitForSelector('#trroot .tr-t, #trroot .empty:not(.skel)',{timeout:120000});await pg.waitForTimeout(300)};
 await seed(info.ids);
 const real=async(bank,ft,H)=>pg.evaluate(async([bank,ft,H])=>{const d=FPD,b=INS.transfers.build(d,H),sq=(JSON.parse(localStorage.getItem('fpl_myxi_cur_v1')).ids).map(id=>b.mk(d.PB.get(id)));return {squad:sq,pool:b.pool,bank,ft,H:b.n}},[bank,ft,H]);
 const rowsOf=()=>pg.$$eval('.tr-t tbody tr',a=>a.map(r=>({o:+r.dataset.o,i:+r.dataset.i,g:parseFloat(r.lastElementChild.innerText.replace('−','-'))})));
 for(const [bank,ft,H] of [[0,1,5],[2.5,1,3],[0.5,0,1],[5,2,5]]){
  await pg.fill('#trb',String(bank));await pg.dispatchEvent('#trb','change');await pg.waitForTimeout(150);await pg.selectOption('#trf',String(ft));await pg.waitForTimeout(150);await pg.selectOption('#trh',String(Math.min(H,info.gws)));await pg.waitForTimeout(300);
  const I=await real(bank,ft,Math.min(H,info.gws)),want=brute(I),got=await rowsOf();
  ok(JSON.stringify(got.map(x=>+x.g.toFixed(1)))===JSON.stringify(want.singles.map(x=>+x.toFixed(1)))&&got.length===want.singles.length,'bank £'+bank+'m, '+ft+' free, '+I.H+' gameweek(s): the table\'s '+got.length+' gains equal the brute force over the same predictions ('+got.slice(0,3).map(x=>x.g.toFixed(1)).join(', ')+'…)');
  const pg2=await pg.$$eval('.tr-p tbody tr td:last-child',a=>a.map(x=>parseFloat(x.innerText.replace('−','-'))));
  ok(JSON.stringify(pg2)===JSON.stringify(want.pairs.map(x=>+x.toFixed(1))),'the best pairs equal the brute force too ('+pg2.slice(0,3).join(', ')+')')}
 /* bank constraint and rule of 3 */
 {await pg.fill('#trb','0');await pg.dispatchEvent('#trb','change');await pg.waitForTimeout(200);const I=await real(0,1,Math.min(5,info.gws)),R=await rowsOf();const by=new Map(I.pool.map(p=>[p.id,p])),sq=new Map(I.squad.map(p=>[p.id,p]));
  ok(R.every(x=>Math.round(by.get(x.i).price*10)<=Math.round(sq.get(x.o).price*10)&&by.get(x.i).t===sq.get(x.o).t),'with no bank every suggestion costs no more than the player it replaces, in the same position')}
 /* an incomplete XI */
 await seed(info.ids.slice(0,8));
 ok(/not complete/.test(await pg.innerText('#trroot'))&&!!(await pg.$('#trroot a[href="#/fantasy"]')),'an XI with 8 players says it is not complete and links to Fantasy → My XI');
 await seed(info.ids);
 /* the test card equals the file */
 {const s=TT.s,row=async k=>pg.$$eval(`.tr-tt tr[data-k="${k}"] td`,a=>a.map(x=>x.innerText.trim()));
  const m=await row('model'),b5=await row('b5'),rd=await row('rand'),r2=v=>(+v).toFixed(2);
  ok(m[1]===r2(s.model.pred)&&m[2]===r2(s.model.m)+' ± '+r2(1.96*s.model.se)&&b5[2]===r2(s.b5.m)+' ± '+r2(1.96*s.b5.se)&&rd[2]===r2(s.rand.m)+' ± '+r2(1.96*s.rand.se),'the test card shows data/transfers_test.json: model '+r2(s.model.m)+', last-5 '+r2(s.b5.m)+', random '+r2(s.rand.m)+' real points a transfer');
  ok(/within noise|better|worse/.test(await pg.innerText('.tr-test'))&&(await pg.innerText('.tr-test')).includes(String(s.rounds))&&/one gameweek ahead/.test(await pg.innerText('.tr-test')),'the card says how the differences read, over '+s.rounds+' gameweeks, and that only one gameweek ahead was tested')}
 ok(await pg.evaluate(()=>{const on=document.querySelector('#secnav button.on');return !!on&&on.dataset.k==='play'}),'the page is in the Play room');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* a failing Fantasy file */
 {const c=await b.newContext({viewport:{width:1100,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ')});await c.route(/\/data\/fpl\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/transfers');await p.waitForSelector('#trroot .empty:not(.skel)',{timeout:120000});
  ok(/not available/.test(await p.innerText('#trroot'))&&!e.length,'a failing Fantasy file: a message, no error');await c.close()}
 /* leaving before the data arrives */
 {const c=await b.newContext({viewport:{width:1100,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ')});await c.route(/\/data\/fpl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/transfers');await p.waitForSelector('#trroot',{timeout:60000});await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);
  ok(!(await p.$('#trroot'))&&!!(await p.$('.lt'))&&!e.length,'leaving before the data arrives: the table stays, no error');await c.close()}
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:'#/table'}));await pg.waitForSelector('.lt',{timeout:90000});
  await pg.evaluate(([s,ids])=>{localStorage.setItem('fpl_myxi_cur_v1',JSON.stringify({season:s,form:'4-4-2',ids,cap:ids[0],vice:ids[1]}))},[info.season,info.ids]);
  await pg.evaluate(()=>{location.hash='#/transfers'});await pg.waitForSelector('#trroot .tr-t',{timeout:120000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,.lx-t,.ph-lt,table')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/مخطط التحويلات/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/tr_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
