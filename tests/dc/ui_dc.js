/* Defensive card on the Defensive page (assets/defense-card.js). Every number is worked out here again from data/ (the player rows
   and line-ups of the six domestic leagues, the league's heat file), not taken from the page:
   - per 90 = total ÷ minutes of the matches where the measure is given × 90; sums add the per-90 figures; aerial % needs 5 aerials;
   - the role from the line-ups (most frequent in the starts), the players compared (same role / position / all outfield, six leagues
     or the league, minimum minutes, the player left out) and each percentile = (below + half of the level) ÷ compared × 100;
   - the heat map cells (16 × 12 counts added over his matches), and no average-position dot.
   Also: the measure chips (3 to 8), the saved PNG (1080 px wide, the card's height), Arabic, 390 px, leaving before the data
   arrives, a heat file and a league file that fail, and a past season (compared within its league only). */
const T=require('../nf/lib.js');const {ok,J,IDX,DOM}=T;
const SIX=IDX.leagues.filter(DOM);
const roleOf=e=>{const s=+e[3],d=+e[4],l=+e[5];if(s===11)return 'GK';if(s>=30&&s<=39)return l>=.15&&l<=.85?'CB':'FB';if(d>=.6&&(l<=.25||l>=.75))return 'W';if(d>=.8)return 'ST';return 'MID'};
const RK=['GK','CB','FB','MID','W','ST'];
function league(l){const pl=J(l.pl_file),ix={};pl.cols.forEach((c,k)=>ix[c]=k);const P=new Map();
 for(const r of pl.rows){const mi=r[ix.mi];if(mi==null)continue;let a=P.get(r[ix.i]);
  if(!a){a={id:r[ix.i],n:r[ix.n],lg:l.name,mi:0,g:0,tot:{},min:{},clubs:{},pos:{}};P.set(a.id,a)}
  a.mi+=mi;a.g++;a.clubs[r[ix.c]]=(a.clubs[r[ix.c]]||0)+mi;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;
  for(const k of ['tk','ic','bl','cl','duw','aer','aerw']){const v=r[ix[k]];if(v!=null){a.tot[k]=(a.tot[k]||0)+v;a.min[k]=(a.min[k]||0)+mi}}}
 const mx=l.mx_file?J(l.mx_file):null,RC=new Map();
 if(mx&&mx.m)for(const v of Object.values(mx.m)){const lu=v&&v.lu;if(!lu)continue;for(const s of ['h','a']){const L=lu[s];if(L&&L.xi)for(const e of L.xi){if(!e||e[3]==null)continue;const c=RC.get(e[0])||{};const q=roleOf(e);c[q]=(c[q]||0)+1;RC.set(e[0],c)}}}
 const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0];
 return [...P.values()].filter(a=>a.mi>0).map(a=>{a.club=(top(a.clubs)||[''])[0];a.p=(top(a.pos)||[null])[0];const c=RC.get(a.id);
  a.role=c?Object.entries(c).sort((x,y)=>y[1]-x[1]||RK.indexOf(x[0])-RK.indexOf(y[0]))[0][0]:null;return a})}
const p90=(a,k)=>a.min[k]>0?a.tot[k]/a.min[k]*90:null,both=(a,ks)=>ks.every(k=>a.min[k]>0)?ks.reduce((s,k)=>s+p90(a,k),0):null;
const MET={da:a=>both(a,['tk','ic','bl','cl']),tk:a=>p90(a,'tk'),ic:a=>p90(a,'ic'),ti:a=>both(a,['tk','ic']),duw:a=>p90(a,'duw'),aerw:a=>p90(a,'aerw'),
 ap:a=>(a.min.aer>0&&a.min.aerw>0&&a.tot.aer>=5)?a.tot.aerw/a.tot.aer*100:null,bl:a=>p90(a,'bl'),cl:a=>p90(a,'cl'),bc:a=>both(a,['bl','cl'])};
const NAME={da:'Defensive actions',tk:'Tackles',ic:'Interceptions',ti:'Tackles + interceptions',duw:'Duels won',aerw:'Aerial duels won',ap:'Aerial duels won %',bl:'Blocks',cl:'Clearances',bc:'Blocks + clearances'};
function expect(all,me,{grp,min,met}){let g=grp;if(g==='role'&&!me.role)g='pos';
 const peers=all.filter(a=>!(a.id===me.id&&a.lg===me.lg)&&a.mi>=min&&(g==='role'?a.role===me.role:g==='pos'?a.p===me.p:(a.p!=='GK'&&a.role!=='GK')));
 const rows=met.map(k=>{const v=MET[k](me),pv=peers.map(MET[k]).filter(x=>x!=null&&isFinite(x));let lo=0,eq=0;pv.forEach(x=>{if(x<v)lo++;else if(x===v)eq++});
  return {k,v,p:v==null||pv.length<5?null:Math.round((lo+eq/2)/pv.length*100)}});
 return {n:peers.length,rows}}
const fmt=r=>(r.v==null?'–':r.k==='ap'?Math.round(r.v)+'%':r.v.toFixed(2))+(r.p==null?'':' ('+r.p+')');
const label=(me,rows)=>me.n+': '+rows.map(r=>NAME[r.k]+' '+fmt(r)).join(', ');
const shown=pg=>pg.$eval('#dcx svg',s=>s.getAttribute('aria-label'));
const waitFor=(pg,name)=>pg.waitForFunction(n=>{const s=document.querySelector('#dcx svg');return s&&s.getAttribute('aria-label').startsWith(n+':')},name,{timeout:60000});
const pick=async(pg,name)=>{await pg.fill('#dcxp',name);await pg.dispatchEvent('#dcxp','change');await waitFor(pg,name)};
const ALLP=SIX.flatMap(league),PLG=IDX.leagues.find(l=>l.id==='l_4WFCIZ');
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/defense'});
 await pg.waitForSelector('#dcx svg',{timeout:90000});
 ok(await pg.evaluate(()=>{const s=document.querySelector('#dcx');return s.previousElementSibling&&s.previousElementSibling.tagName==='H2'&&!!document.querySelector('#dout')}),'the card sits at the top of the Defensive page, and the table is still there');
 /* the default player: the outfield player of the league with the most minutes (450+) */
 const mine=ALLP.filter(a=>a.lg===PLG.name&&a.mi>=450),def=mine.filter(a=>a.p!=='GK'&&a.role!=='GK').sort((x,y)=>y.mi-x.mi||x.n.localeCompare(y.n))[0];
 let e=expect(ALLP,def,{grp:'role',min:450,met:['da','tk','ic','duw','aerw','bc']});
 ok(await shown(pg)===label(def,e.rows),'default: '+def.n+', six measures, values per 90 and percentiles recomputed ('+await shown(pg)+')');
 /* a winger, compared with the wingers of the six leagues: the owner's sample */
 const saka=mine.find(a=>a.n==='Bukayo Saka')||mine.find(a=>a.role==='W');await pick(pg,saka.n);
 e=expect(ALLP,saka,{grp:'role',min:450,met:['da','tk','ic','duw','aerw','bc']});
 ok(await shown(pg)===label(saka,e.rows),saka.n+' ('+saka.role+'): '+await shown(pg));
 ok(await pg.$eval('#dcx svg',(s,n)=>s.textContent.includes(n+' wingers in six leagues, 450+ minutes'),e.n),'he is compared with the '+e.n+' wingers of the six leagues with 450+ minutes');
 const avg=Math.round(e.rows.filter(r=>r.p!=null).reduce((s,r)=>s+r.p,0)/e.rows.filter(r=>r.p!=null).length);
 ok(await pg.$eval('#dcx svg',(s,a)=>[...s.querySelectorAll('text')].some(t=>t.textContent===String(a)),avg),'the ring shows the average of the percentiles ('+avg+')');
 /* the bars: as long as the percentile, coloured red (0) → amber (50) → green (100); the value per 90 beside the name */
 const pcol=p=>{const S=[[0,[214,69,65]],[50,[232,160,40]],[100,[63,163,77]]];for(let i=1;i<S.length;i++)if(p<=S[i][0]){const [a,c]=S[i-1],[b,d]=S[i],t=(p-a)/(b-a);return 'rgb('+c.map((v,k)=>Math.round(v+(d[k]-v)*t)).join(',')+')'}};
 const bars=await pg.$$eval('#dcx .dc-on',a=>a.map(r=>({w:+r.getAttribute('width'),f:r.getAttribute('fill'),t:r.previousElementSibling.previousElementSibling.textContent,tw:+r.previousElementSibling.getAttribute('width')})));
 ok(bars.length===e.rows.length&&bars.every((x,i)=>x.f===pcol(e.rows[i].p)&&Math.abs(x.w-Math.max(14,x.tw*e.rows[i].p/100))<.2&&x.t.includes(NAME[e.rows[i].k]+'  '+e.rows[i].v.toFixed(2)+' /90')),
  'each bar: length = percentile, colour from red to green ('+bars.map(x=>x.f).join(' ')+'), "value /90" beside the name');
 /* the heat map: his cells, no average-position dot */
 const H=J(PLG.heat_file),G={};H.rows.filter(r=>r.t==='p'&&r.k===saka.id).forEach(r=>{for(let i=0;i+2<r.h.length;i+=3){const k=r.h[i]+','+r.h[i+1];G[k]=(G[k]||0)+r.h[i+2]}});
 const hv=await pg.$$eval('#dcx .dc-hc',a=>a.map(r=>+r.dataset.v).sort((x,y)=>x-y)),ev=Object.values(G).filter(v=>v>0).sort((x,y)=>x-y);
 ok(hv.length>20&&JSON.stringify(hv)===JSON.stringify(ev),'heat map: '+hv.length+' cells, each his added counts from the heat file');
 ok(await pg.$eval('#dcx svg',s=>[...s.querySelectorAll('circle')].every(c=>+c.getAttribute('r')>=20)),'no average-position dot on the heat map');
 /* other comparisons: this league, 270+, same position; all measures one by one */
 await pg.selectOption('#dcxs','lg');await waitFor(pg,saka.n);await pg.selectOption('#dcxm','270');await waitFor(pg,saka.n);await pg.selectOption('#dcxg','pos');await waitFor(pg,saka.n);
 const lgP=ALLP.filter(a=>a.lg===PLG.name);e=expect(lgP,saka,{grp:'pos',min:270,met:['da','tk','ic','duw','aerw','bc']});
 ok(await shown(pg)===label(saka,e.rows),'this league, same position ('+saka.p+'), 270+ minutes: '+e.n+' players, recomputed');
 await pg.click('.dcx-k:has(input[value="ap"])');await pg.click('.dcx-k:has(input[value="bl"])');await waitFor(pg,saka.n);
 const n8=await pg.$$eval('.dcx-mt input',a=>({on:a.filter(x=>x.checked).length,dis:a.filter(x=>!x.checked&&x.disabled).length,free:a.filter(x=>!x.checked).length}));
 e=expect(lgP,saka,{grp:'pos',min:270,met:['da','tk','ic','duw','aerw','ap','bl','bc']});
 ok(n8.on===8&&n8.dis===n8.free&&await shown(pg)===label(saka,e.rows),'8 measures (aerial %, blocks added, in the list order), the rest can no longer be ticked: '+await shown(pg));
 for(const k of ['da','tk','ic','duw','aerw'])await pg.click(`.dcx-k:has(input[value="${k}"])`);await pg.waitForTimeout(300);
 const n3=await pg.$$eval('.dcx-mt input',a=>({on:a.filter(x=>x.checked).map(x=>x.value),dis:a.filter(x=>x.checked&&x.disabled).length}));
 ok(n3.on.length===3&&n3.dis===3,'down to 3 measures, which can no longer be unticked ('+n3.on.join(', ')+')');
 await pg.selectOption('#dcxg','all');await waitFor(pg,saka.n);e=expect(lgP,saka,{grp:'all',min:270,met:n3.on});
 ok(await shown(pg)===label(saka,e.rows),'all outfield players: '+await shown(pg));
 /* the saved image */
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('.dcx-s')]);const fs=require('fs'),p='/tmp/dc-'+process.pid+'.png';await dl.saveAs(p);const png=fs.readFileSync(p);fs.unlinkSync(p);
 const vb=await pg.$eval('#dcx svg',s=>s.getAttribute('viewBox').split(' ').map(Number));
 ok(png.slice(1,4).toString()==='PNG'&&png.readUInt32BE(16)===1080&&png.readUInt32BE(20)===vb[3]&&png.length>30000&&/^defensive-card-/.test(dl.suggestedFilename()),'Save image: a '+png.readUInt32BE(16)+' × '+png.readUInt32BE(20)+' PNG ('+Math.round(png.length/1024)+' KB), '+dl.suggestedFilename());
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic, 390 px */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/defense'}));await pg.waitForSelector('#dcx svg',{timeout:90000});
 const arL=await shown(pg);
 ok(/الأفعال الدفاعية/.test(arL)&&/الافتكاكات/.test(arL)&&await pg.$eval('#dcx svg',s=>s.textContent.includes('متوسط المئين')),'Arabic: the card in Arabic ('+arL.slice(0,80)+'…)');
 const left=await pg.evaluate(()=>{const o=[];document.querySelectorAll('#dcx .fx-en').forEach(e=>{if(getComputedStyle(e).display!=='none')o.push(e.textContent)});return o});
 ok(!left.length,'Arabic: no English label shows '+left.slice(0,3).join(' | '));
 ok(await T.noscroll(pg),'390 px: no horizontal scroll');
 ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving before the data arrives */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/defense'}));
 await pg.waitForSelector('#dcx',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');await pg.waitForTimeout(4000);
 ok(!(await pg.$('#dcx'))&&!errs.length,'leaving before the data arrives: no card left behind, no errors');await ctx.close();
 /* a heat file and a league file that fail */
 ctx=await b.newContext({viewport:{width:1280,height:900}});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 const LL=SIX.find(l=>l.id!=='l_4WFCIZ');
 await ctx.route(new RegExp('/data/('+PLG.heat_file+'|'+LL.pl_file+')'),r=>r.fulfill({status:404,body:'no'}));
 pg=await ctx.newPage();errs=[];pg.on('pageerror',x=>errs.push(x.message));await pg.goto('http://127.0.0.1:8765/index.html#/defense');
 await pg.waitForSelector('#dcx svg',{timeout:90000});
 const fl=await pg.evaluate(()=>({cells:document.querySelectorAll('#dcx .dc-hc').length,txt:document.querySelector('#dcx').textContent}));
 const noLL=ALLP.filter(a=>a.lg!==LL.name);e=expect(noLL,def,{grp:'role',min:450,met:['da','tk','ic','duw','aerw','bc']});
 ok(fl.cells===0&&/Heat map not available/.test(fl.txt)&&fl.txt.includes('Not loaded: '+LL.name)&&await shown(pg)===label(def,e.rows),'a failing heat file and '+LL.name+': the card says so and compares with the leagues that loaded');
 ok(!errs.length,'failing files: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* a past season: compared within its league only */
 const ps=((IDX.seasons||{}).l_4WFCIZ||{}).past||[],full=ps.find(s=>s.complete&&s.mx_file)||ps[0];
 if(full){({ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/defense',init:{season:full.s}}));
  await pg.waitForSelector('#dcx svg',{timeout:90000});
  const pp=await pg.evaluate(()=>({six:document.querySelector('#dcxs option[value="six"]').disabled,v:document.querySelector('#dcxs').value,t:document.querySelector('#dcx svg').textContent}));
  ok(pp.six&&pp.v==='lg'&&!/six leagues/.test(pp.t),'past season '+full.s+': six leagues cannot be chosen, compared within the league');
  ok(!errs.length,'past season: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b);
})();
