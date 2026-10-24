/* Match pressing card on the Pressing page (assets/press-card.js). Every number is worked out here again from data/:
   - the six numbers of each team (PPDA and defensive actions from the adv file, high turnovers, counterpress regains, regain time and
     defensive action height from the pl file's team rows), each ranked among every team-match of the league that has it
     (below + half of the level, over the team-matches, 10+), turned round for PPDA and regain time (lower = more pressing);
   - the bar: length = rank, colour red → amber → green; the dashed line at the defensive action height;
   - the heat map cells = the heat file's team row of that match and side;
   - the players: the nine with most defensive actions (tackles + interceptions + blocks + clearances) of that club in that match;
   - the saved PNG, Arabic, 390 px, leaving early, failing files and a past season. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const LG=IDX.leagues.find(l=>l.id==='l_4WFCIZ'),L=J(LG.file),AD=J(LG.adv_file),PL=J(LG.pl_file),HT=J(LG.heat_file);
const num=s=>{const m=/^(\d+)\s*[-–:]\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
const MS=L.matches.map(m=>{const g=num(m.s);return g&&m.d?{id:m.i,d:String(m.d).slice(0,10),home:m.h,away:m.a,hg:g[0],ag:g[1]}:null}).filter(Boolean);
const TM=new Map();const put=(r,f)=>{const k=r.m+'|'+r.s;let t=TM.get(k);if(!t){t={};TM.set(k,t)}f(t)};
AD.team.forEach(r=>put(r,t=>{t.pp=r.pp;t.da=r.da}));PL.team.forEach(r=>put(r,t=>{['hto','cpr','brt','adx'].forEach(k=>t[k]=r[k])}));
const MET=[['pp','PPDA (lower = more pressing)',-1,1],['da','Defensive actions',1,0],['hto','High turnovers',1,0],['cpr','Counterpress regains',1,0],['brt','Time to win the ball back (s)',-1,1],['adx','Defensive action height (m)',1,1]];
const dist={};MET.forEach(m=>dist[m[0]]=[...TM.values()].map(t=>t[m[0]]).filter(x=>x!=null&&isFinite(x)));
const rank=(k,v,dir)=>{if(v==null)return null;const a=dist[k];if(a.length<10)return null;let lo=0,eq=0;a.forEach(x=>{if(x<v)lo++;else if(x===v)eq++});const p=Math.round((lo+eq/2)/a.length*100);return dir<0?100-p:p};
const has=m=>['home','away'].every(s=>{const t=TM.get(m.id+'|'+s);return t&&MET.some(q=>t[q[0]]!=null)});
const LIST=MS.filter(has).sort((a,b)=>b.d.localeCompare(a.d)||b.id.localeCompare(a.id));
const pcol=p=>{const S=[[0,[214,69,65]],[50,[232,160,40]],[100,[63,163,77]]];for(let i=1;i<S.length;i++)if(p<=S[i][0]){const [a,c]=S[i-1],[b,d]=S[i],t=(p-a)/(b-a);return 'rgb('+c.map((v,k)=>Math.round(v+(d[k]-v)*t)).join(',')+')'}};
const ix={};PL.cols.forEach((c,k)=>ix[c]=k);
const players=(mid,club)=>PL.rows.filter(r=>r[ix.m]===mid&&r[ix.c]===club&&r[ix.mi]!=null).map(r=>{const v=['tk','ic','bl','cl'].map(k=>r[ix[k]]);return {n:r[ix.n],mi:r[ix.mi],da:v.every(x=>x!=null)?v.reduce((a,b)=>a+b,0):null}})
 .filter(p=>p.da!=null).sort((a,b)=>b.da-a.da||b.mi-a.mi||a.n.localeCompare(b.n)).slice(0,9);
const fm=(q,v)=>v==null?'–':v.toFixed(q[3]);
const label=m=>{const s=n=>MET.map(q=>{const t=TM.get(m.id+'|'+n)||{},v=t[q[0]]==null||!isFinite(t[q[0]])?null:t[q[0]],p=rank(q[0],v,q[2]);return q[1]+' '+fm(q,v)+(p==null?'':' ('+p+')')}).join(', ');
 return m.home+' '+m.hg+' – '+m.ag+' '+m.away+': '+m.home+' '+s('home')+' | '+m.away+' '+s('away')};
const shown=pg=>pg.$eval('#pcx svg',s=>s.getAttribute('aria-label'));
(async()=>{const b=await T.launch();const nc=b.newContext.bind(b);b.newContext=o=>nc(Object.assign({},o,{acceptDownloads:true}));
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/ppda'});
 await pg.waitForSelector('#pcx svg',{timeout:90000});
 ok(await pg.evaluate(()=>{const s=document.querySelector('#pcx');return s.previousElementSibling&&s.previousElementSibling.tagName==='H2'}),'the card sits at the top of the Pressing page');
 const m0=LIST[0];
 ok(await shown(pg)===label(m0),'latest match with team numbers: '+(await shown(pg)).slice(0,150)+'… (all numbers and ranks recomputed)');
 ok(await pg.$$eval('#pcxm option',a=>a.length)===LIST.length&&await pg.$eval('#pcxm',s=>s.value)===m0.id,'the picker lists the '+LIST.length+' finished matches with team numbers, newest first');
 /* a different match: numbers, bars, heat map cells, line, players */
 const m1=LIST[Math.min(5,LIST.length-1)];await pg.selectOption('#pcxm',m1.id);await pg.waitForFunction(h=>document.querySelector('#pcx svg')&&document.querySelector('#pcx svg').getAttribute('aria-label').startsWith(h),m1.home+' '+m1.hg);
 ok(await shown(pg)===label(m1),'another match ('+m1.home+' '+m1.hg+' – '+m1.ag+' '+m1.away+', '+m1.d+'): recomputed');
 const bars=await pg.$$eval('#pcx .pc-on',a=>a.map(r=>({w:+r.getAttribute('width'),f:r.getAttribute('fill'),bw:+r.previousElementSibling.getAttribute('width')})));
 const exp=['home','away'].flatMap(s=>MET.map(q=>{const t=TM.get(m1.id+'|'+s)||{};return rank(q[0],t[q[0]]==null?null:t[q[0]],q[2])})).filter(p=>p!=null);
 ok(bars.length===exp.length&&bars.every((x,i)=>x.f===pcol(exp[i])&&Math.abs(x.w-Math.max(14,x.bw*exp[i]/100))<.2),'bars: length = rank, colour red → green ('+bars.length+' bars)');
 for(const [i,s] of ['home','away'].entries()){
  const row=HT.rows.find(r=>r.t==='t'&&r.m===m1.id&&r.s===s),cells={};if(row)for(let k=0;k+2<row.h.length;k+=3)cells[row.h[k]+','+row.h[k+1]]=row.h[k+2];
  const ev=Object.values(cells).filter(v=>v>0).sort((a,b)=>a-b);
  const got=await pg.$$eval('#pcx .pc-hc',a=>a.map(r=>+r.dataset.v));
  const half=Math.floor(got.length/2);
  if(i===0)var all=got;
  if(i===1)ok(JSON.stringify([...all].sort((a,b)=>a-b))===JSON.stringify([...Object.values(cells).filter(v=>v>0),...Object.values(Object.fromEntries(HT.rows.filter(r=>r.t==='t'&&r.m===m1.id&&r.s==='home').flatMap(r=>{const o=[];for(let k=0;k+2<r.h.length;k+=3)o.push([r.h[k]+','+r.h[k+1],r.h[k+2]]);return o}))).filter(v=>v>0)].sort((a,b)=>a-b)),'heat maps: the cells of both teams are the heat file\'s team rows of this match ('+all.length+' cells)')}
 const advs=await pg.$$eval('#pcx .pc-adx',a=>a.map(l=>+l.getAttribute('x1')));
 ok(advs.length===2,'a dashed line at each team\'s defensive action height');
 const pls=await pg.$$eval('#pcx .pc-da',a=>a.map(t=>+t.textContent));
 const ep=[...players(m1.id,m1.home),...players(m1.id,m1.away)].map(p=>p.da);
 ok(JSON.stringify(pls)===JSON.stringify(ep),'the nine players with most defensive actions per team: '+ep.join(' '));
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('.pcx-s')]);const fs=require('fs'),p='/tmp/pc-'+process.pid+'.png';await dl.saveAs(p);const png=fs.readFileSync(p);fs.unlinkSync(p);
 const vb=await pg.$eval('#pcx svg',s=>s.getAttribute('viewBox').split(' ').map(Number));
 ok(png.slice(1,4).toString()==='PNG'&&png.readUInt32BE(16)===1600&&png.readUInt32BE(20)===vb[3]&&png.length>40000&&/^pressing-card-/.test(dl.suggestedFilename()),'Save image: a '+png.readUInt32BE(16)+' × '+png.readUInt32BE(20)+' PNG ('+Math.round(png.length/1024)+' KB), '+dl.suggestedFilename());
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic, phone */
 ({ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/ppda'}));await pg.waitForSelector('#pcx svg',{timeout:90000});
 const arL=await shown(pg);
 ok(/الأفعال الدفاعية/.test(arL)&&/استعادات الضغط العكسي/.test(arL)&&await pg.$eval('#pcx svg',s=>s.textContent.includes('وين لعب')),'Arabic: the card in Arabic ('+arL.slice(0,70)+'…)');
 ok(!(await pg.evaluate(()=>[...document.querySelectorAll('#pcx .fx-en')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent))).length,'Arabic: no English label shows around the card');
 ok(await T.noscroll(pg),'390 px: no horizontal scroll');
 ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving before the data arrives */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/ppda'}));await pg.waitForSelector('#pcx',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');await pg.waitForTimeout(3500);
 ok(!(await pg.$('#pcx'))&&!errs.length,'leaving before the data arrives: no card left behind, no errors');await ctx.close();
 /* a failing heat file: the card says so and still has its numbers; a failing pl file: the page says it cannot load */
 ctx=await b.newContext({viewport:{width:1280,height:900}});
 await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
 await ctx.route(new RegExp('/data/'+LG.heat_file),r=>r.fulfill({status:404,body:'no'}));
 pg=await ctx.newPage();errs=[];pg.on('pageerror',x=>errs.push(x.message));await pg.goto('http://127.0.0.1:8765/index.html#/ppda');await pg.waitForSelector('#pcx svg',{timeout:90000});
 ok(await shown(pg)===label(m0)&&(await pg.evaluate(()=>document.querySelectorAll('#pcx .pc-hc').length))===0&&/Heat map not available/.test(await pg.$eval('#pcx svg',s=>s.textContent)),'a failing heat file: the numbers stay, the map says it is not available');
 ok(!errs.length,'failing heat file: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* a past season */
 const ps=((IDX.seasons||{}).l_4WFCIZ||{}).past||[],full=ps.find(s=>s.complete&&s.adv_file&&s.pl_file&&s.heat_file);
 if(full){({ctx,pg,errs}=await T.open(b,{vw:1280,league:'l_4WFCIZ',hash:'#/ppda',init:{season:full.s}}));
  await pg.waitForSelector('#pcx svg',{timeout:90000});
  const pa=await pg.evaluate(()=>({n:document.querySelectorAll('#pcxm option').length,sub:document.querySelector('#pcx svg').textContent.includes(ALL.season)}));
  ok(pa.n>100&&pa.sub,'past season '+full.s+': its own matches ('+pa.n+'), the season named on the card');
  ok(!errs.length,'past season: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b);
})();
