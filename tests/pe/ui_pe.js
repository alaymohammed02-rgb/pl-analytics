/* Estimated pressing on the Pressing page (assets/press-est.js). Worked out here again from data/ and data/press_est.json:
   - each player of the six domestic leagues: minutes, tackles and interceptions per 90 (the table's per-90: total ÷ minutes of the
     matches that give the number × 90), the role from the line-ups (most frequent in the starts), and the estimate
     pressures/90 = constant + w1 × tackles/90 + w2 × interceptions/90 of the role's fit (never below 0);
   - the percentile among the estimates of the same role, the player left out: (below + half of the level) ÷ peers × 100, 5+ peers;
   - the first player (most minutes of the league shown), a chosen player, "this league", 900+ minutes, the 12 highest estimates;
   - the measured error table and its words, the StatsBomb logo and the "not tested" note, Arabic, 390 px, leaving before the data
     arrives and a failing coefficient file. */
const T=require('../nf/lib.js');const {ok,J,IDX,DOM}=T;
const SIX=IDX.leagues.filter(DOM),F=J('press_est.json');
const roleOf=e=>{const s=+e[3],d=+e[4],l=+e[5];if(s===11)return 'GK';if(s>=30&&s<=39)return l>=.15&&l<=.85?'CB':'FB';if(d>=.6&&(l<=.25||l>=.75))return 'W';if(d>=.8)return 'ST';return 'MID'};
const RK=['GK','CB','FB','MID','W','ST'],GROUP={CB:'CB',FB:'FB',MID:'MID',W:'WING',ST:'FWD'};
const ROLEN={CB:['centre-backs','Centre-back'],FB:['full-backs','Full-back'],MID:['midfielders','Midfielder'],W:['wingers','Winger'],ST:['strikers','Striker']};
function league(l){const pl=J(l.pl_file),ix={};pl.cols.forEach((c,k)=>ix[c]=k);const P=new Map();
 for(const r of pl.rows){const mi=r[ix.mi];if(mi==null)continue;let a=P.get(r[ix.i]);
  if(!a){a={id:r[ix.i],n:r[ix.n],lg:l.name,mi:0,tot:{tk:0,ic:0},min:{tk:0,ic:0},clubs:{}};P.set(a.id,a)}
  a.mi+=mi;a.clubs[r[ix.c]]=(a.clubs[r[ix.c]]||0)+mi;
  for(const k of ['tk','ic']){const v=r[ix[k]];if(v!=null){a.tot[k]+=v;a.min[k]+=mi}}}
 const mx=l.mx_file?J(l.mx_file):null,RC=new Map();
 if(mx&&mx.m)for(const v of Object.values(mx.m)){const lu=v&&v.lu;if(!lu)continue;for(const s of ['h','a']){const L=lu[s];if(L&&L.xi)for(const e of L.xi){if(!e||e[0]==null||e[3]==null)continue;const c=RC.get(e[0])||{};const q=roleOf(e);c[q]=(c[q]||0)+1;RC.set(e[0],c)}}}
 const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0];
 return [...P.values()].filter(a=>a.mi>0).map(a=>{a.club=(top(a.clubs)||['Unknown'])[0];const c=RC.get(a.id);
  a.role=c?Object.entries(c).sort((x,y)=>y[1]-x[1]||RK.indexOf(x[0])-RK.indexOf(y[0]))[0][0]:null;return a})}
const ALL=SIX.flatMap(league);
const p90=(a,k)=>a.min[k]>0?a.tot[k]/a.min[k]*90:null;
const guess=a=>{const g=GROUP[a.role];if(!g)return null;const tk=p90(a,'tk'),ic=p90(a,'ic');if(tk==null||ic==null)return null;const c=F.coef[g];return Math.max(0,c[0]+c[1]*tk+c[2]*ic)};
const pct=(v,peers)=>{if(v==null||peers.length<5)return null;let lo=0,eq=0;peers.forEach(x=>{if(x<v)lo++;else if(x===v)eq++});return Math.round((lo+eq/2)/peers.length*100)};
const pool=(scope,lgName,min)=>ALL.filter(a=>(scope==='six'||a.lg===lgName)&&a.mi>=min&&a.role&&a.role!=='GK').map(a=>({a,v:guess(a)})).filter(x=>x.v!=null);
const first=(list,lgName,scope)=>{const own=list.filter(x=>x.a.lg===lgName||scope!=='six');return (own.length?own:list).slice().sort((x,y)=>y.a.mi-x.a.mi||x.a.n.localeCompare(y.a.n))[0]};
function expect(list,me){const peers=list.filter(x=>x.a.role===me.a.role&&x.a.id!==me.a.id).map(x=>x.v);
 const top=list.filter(x=>x.a.role===me.a.role).sort((x,y)=>y.v-x.v||x.a.n.localeCompare(y.a.n)).slice(0,12)
  .map(x=>[x.a.n+x.a.club,x.v.toFixed(1),String(pct(x.v,list.filter(y=>y.a.role===x.a.role&&y.a.id!==x.a.id).map(y=>y.v))??'–')]);
 return {est:me.v,p:pct(me.v,peers),n:peers.length,top,tk:p90(me.a,'tk'),ic:p90(me.a,'ic')}}
const shown=async pg=>pg.evaluate(()=>({n:document.querySelector('.pex-n').textContent,est:document.querySelector('.pex-big').textContent,err:document.querySelector('.pex-v .mu').innerText,
 txt:document.querySelector('.pex-me').innerText.replace(/\s+/g,' '),rows:[...document.querySelectorAll('.pex-t tbody tr')].map(r=>[r.cells[1].textContent.replace(/\s+/g,''),r.cells[2].textContent.trim(),r.cells[3].textContent.trim()]),
 bar:document.querySelector('.pex-bar i').style.width}));
const check=(s,e,me,label)=>{const want=e.est.toFixed(1);const pe=e.p==null?'Too few players':`Percentile ${e.p} among ${e.n} ${ROLEN[me.a.role][0]}`;
 ok(s.n===me.a.n&&s.est.includes('≈ '+want)&&s.txt.includes(pe)&&s.txt.includes('tackles '+e.tk.toFixed(2))&&s.txt.includes('interceptions '+e.ic.toFixed(2)),label+': '+me.a.n+' ≈ '+want+' /90, '+(e.p==null?'no rank':'percentile '+e.p+' of '+e.n)+', tackles '+e.tk.toFixed(2)+', interceptions '+e.ic.toFixed(2));
 ok(s.bar===(e.p==null?0:e.p)+'%','bar length = percentile ('+s.bar+')')};
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/ppda'});
 await pg.waitForSelector('#pex .pex-me',{timeout:90000});
 const LG=IDX.leagues.find(l=>l.id==='l_4WFCIZ').name;
 ok(await pg.evaluate(()=>{const s=document.querySelector('#pex'),c=document.querySelector('#pcx');return !!c&&c.nextElementSibling===s}),'the section sits under the match pressing card');
 let list=pool('six',LG,450),me=first(list,LG,'six'),E=expect(list,me);
 ok(list.length>400,'players with a role, tackles and 450+ minutes in six leagues: '+list.length);
 check(await shown(pg),E,me,'first player (most minutes in '+LG+')');
 ok(JSON.stringify((await shown(pg)).rows)===JSON.stringify(E.top.map(r=>[r[0].replace(/\s+/g,''),r[1],r[2]])),'the 12 highest estimates of the role, with their percentiles ('+E.top.slice(0,3).map(r=>r[0]+' '+r[1]).join(', ')+'…)');
 ok(/±\d\.\d/.test((await shown(pg)).err),'the typical error is shown beside the number: '+(await shown(pg)).err.trim());
 /* another player: a winger or a striker */
 const other=list.filter(x=>x.a.role==='W').sort((x,y)=>y.a.mi-x.a.mi||x.a.n.localeCompare(y.a.n))[25];
 await pg.fill('#pexq',other.a.n+' ('+other.a.club+')');await pg.dispatchEvent('#pexq','change');
 await pg.waitForFunction(n=>document.querySelector('.pex-n').textContent===n,other.a.n,{timeout:30000});
 check(await shown(pg),expect(list,other),other,'chosen player');
 /* this league only, and 900+ minutes */
 await pg.selectOption('#pexs','lg');await pg.waitForTimeout(500);
 let l2=pool('lg',LG,450),m2=l2.find(x=>x.a.id===other.a.id&&x.a.lg===other.a.lg);
 if(m2)check(await shown(pg),expect(l2,m2),m2,'this league only ('+l2.length+' players)');
 else ok(true,'this league only: the chosen player is from another league, so the first one of the league is shown');
 await pg.selectOption('#pexm','900');await pg.waitForTimeout(600);
 const l3=pool('lg',LG,900);
 if(l3.length>=10){const nm3=await pg.evaluate(()=>document.querySelector('.pex-n').textContent),x3=l3.find(x=>x.a.n===nm3);ok(!!x3,'900+ minutes: the player shown has the minutes ('+nm3+')');if(x3)check(await shown(pg),expect(l3,x3),x3,'900+ minutes, this league')}
 else ok(/Not enough players/.test(await pg.innerText('#pex')),'900+ minutes in this league: only '+l3.length+' players, the page says there are not enough instead of ranking them');
 await pg.selectOption('#pexs','six');await pg.selectOption('#pexm','450');await pg.waitForSelector('.pex-ck',{timeout:30000});
 /* the measured error */
 const cv=await pg.evaluate(()=>[...document.querySelectorAll('.pex-cv tbody tr')].map(r=>[...r.cells].map(c=>c.textContent.trim())));
 const wcv=Object.entries(F.cv).map(([k,v])=>[k,String(v.season.n),v.season.corr.toFixed(2),v.season_position_only.corr.toFixed(2),v.season.mae.toFixed(1)]);
 ok(JSON.stringify(cv)===JSON.stringify(wcv),'the error table is the file\'s leave-one-league-out numbers: '+wcv.map(r=>r[0]+' r='+r[2]+' miss '+r[4]).join(' | '));
 const cks=await pg.innerText('.pex-ck'),L=Object.values(F.cv),mn=k=>Math.min(...L.map(x=>x.season[k])),mx=k=>Math.max(...L.map(x=>x.season[k]));
 ok(cks.includes(mn('corr').toFixed(2)+' – '+mx('corr').toFixed(2))&&cks.includes(mn('mae').toFixed(1)+' – '+mx('mae').toFixed(1)),'the words give the measured range: correlation '+mn('corr').toFixed(2)+' – '+mx('corr').toFixed(2)+', miss '+mn('mae').toFixed(1)+' – '+mx('mae').toFixed(1));
 ok(/Not tested/.test(cks)&&/share no full league season/.test(cks),'the note says what was not tested');
 ok(await pg.$eval('.pex-ck a[href*="statsbomb/open-data"] img',i=>/statsbomb-logo\.svg$/.test(i.getAttribute('src'))&&i.complete&&i.naturalWidth>0),'the StatsBomb logo is on the section');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving before the data arrives */
 {const c2=await b.newContext();await c2.route(/press_est\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/ppda');await p2.waitForSelector('#pex',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#pex'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 /* a failing file: a message, and the rest of the Pressing page stays */
 {const c3=await b.newContext();await c3.route(/press_est\.json/,r=>r.fulfill({status:500,body:''}));const p3=await c3.newPage(),e3=[];p3.on('pageerror',e=>e3.push(e.message));await p3.goto('http://127.0.0.1:8765/index.html#/ppda');
  await p3.waitForSelector('#pex .empty:not(.skel)',{timeout:90000});
  ok(/Could not load the numbers/.test(await p3.textContent('#pex'))&&!!(await p3.$('#pcx'))&&!e3.length,'a failing coefficient file shows a message; the match card above stays');await c3.close()}
 /* phone and Arabic */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:'#/ppda'});await pg.waitForSelector('#pex .pex-me',{timeout:90000});await pg.waitForTimeout(400);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#pex');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));
   const tx=await pg.innerText('.pex-ck');ok(/من \d\.\d\d إلى \d\.\d\d/.test(tx)&&!/\d\.\d\d\s*–\s*\d\.\d\d/.test(tx),'Arabic: ranges written in words ("من … إلى …"), not with a dash');
   ok(/تقدير/.test(await pg.textContent('#pex h3')),'Arabic heading')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/pe_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
