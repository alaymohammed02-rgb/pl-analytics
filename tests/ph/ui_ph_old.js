/* Pressing & defensive height: every number checked against the raw files (league file, adv file PPDA, pl file team rows) */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
function raw(lid){const lg=IDX.leagues.find(l=>l.id===lid),L=J(lg.file),A=J(lg.adv_file),P=J(lg.pl_file);
 const md=new Map(L.matches.map(m=>[m.i,m]));const pp=new Map(A.team.map(r=>[r.m+'|'+r.n,r])),hx=new Map(P.team.map(r=>[r.m+'|'+r.n,r]));
 const team=t=>L.matches.filter(m=>(m.h===t||m.a===t)&&(pp.has(m.i+'|'+t)||hx.has(m.i+'|'+t))).sort((a,b)=>String(a.d).localeCompare(String(b.d))||a.i.localeCompare(b.i)).map(m=>{const o=m.h===t?m.a:m.h;
  return {m:m.i,d:String(m.d).slice(0,10),opp:o,adx:(hx.get(m.i+'|'+t)||{}).adx??null,o_adx:(hx.get(m.i+'|'+o)||{}).adx??null,pp:(pp.get(m.i+'|'+t)||{}).pp??null,o_pp:(pp.get(m.i+'|'+o)||{}).pp??null}});
 const teams=[...new Set(P.team.map(r=>r.n))];
 const season=teams.map(t=>{const R=team(t),h=R.map(r=>r.adx).filter(v=>v!=null),A_=A.team.filter(r=>r.n===t&&r.pp!=null&&r.da>0);return {n:t,h:h.length?h.reduce((s,x)=>s+x,0)/h.length:null,nh:h.length,np:A_.length,ppda:A_.reduce((s,r)=>s+r.da,0)?A_.reduce((s,r)=>s+r.op,0)/A_.reduce((s,r)=>s+r.da,0):null}});
 return {team,season,teams};}
const mean=a=>{const b=a.filter(x=>x!=null);return b.length?b.reduce((s,x)=>s+x,0)/b.length:null};
const med=a=>{const s=a.slice().sort((x,y)=>x-y),i=s.length/2;return s.length%2?s[Math.floor(i)]:(s[i-1]+s[i])/2};
async function open(b,{vw=1280,lang='en',league='l_0ErfuF',routes=[]}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 for(const [re,fn] of routes)await ctx.route(re,fn);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/pressline');return {ctx,pg,errs}}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 const X=raw('l_0ErfuF'),T='Barcelona',BR=X.team(T);
 /* ---- the team dashboard ---- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.ph-dash',{timeout:60000});
  ok(await pg.evaluate(()=>{const n=[...document.querySelectorAll('#nav a')].map(a=>a.getAttribute('href'));return n.indexOf('#/pressline')===n.indexOf('#/ppda')+1}),'menu: "Pressing & height" right after PPDA (Analysis)');
  ok(/not the defensive line height/.test(await pg.textContent('.ph-def'))&&/PitchAPI does not provide that/.test(await pg.textContent('.ph-def')),'the page says plainly that the defensive line height is not available, and what is shown instead');
  ok(await pg.$eval('#phhm',s=>s.value)==='cb','the centre-backs\' average position is the default height measure');
  await pg.selectOption('#phhm','adx');await pg.waitForTimeout(300);await pg.selectOption('#phtm',T);await pg.waitForTimeout(400);
  const st=await pg.evaluate(()=>{const ch=[...document.querySelectorAll('.ph-dash .ph-ch svg')];return ch.map(s=>({t:s.querySelectorAll('.ph-d.t').length,o:s.querySelectorAll('.ph-d.o').length,av:+(s.querySelector('.ph-avt')||{}).textContent,lab:[...s.querySelectorAll('text.ph-op')].map(x=>x.textContent)}))});
  const ah=mean(BR.map(r=>r.adx)),ap=mean(BR.map(r=>r.pp));
  ok(st[0].t===BR.filter(r=>r.adx!=null).length&&st[0].o===BR.filter(r=>r.o_adx!=null).length&&st[1].t===BR.filter(r=>r.pp!=null).length&&st[1].o===BR.filter(r=>r.o_pp!=null).length,`${T}: one point per match with a value, team and opponent, in both charts (${st[0].t} / ${st[1].t})`);
  ok(Math.abs(st[0].av-ah)<0.051&&Math.abs(st[1].av-ap)<0.0051,`averages = the team's own values over the same matches (height ${ah.toFixed(1)} m, PPDA ${ap.toFixed(2)})`);
  /* each point: the tooltip names the right team and the right opponent value of that match */
  const tips=await pg.evaluate(()=>[...document.querySelectorAll('.ph-dash .ph-ch')[0].querySelectorAll('.ph-d.t')].map(c=>c.getAttribute('data-tip')));
  const good=tips.length>0&&tips.length===BR.filter(x=>x.adx!=null).length&&tips.every((t,i)=>{const r=BR.filter(x=>x.adx!=null)[i];return t.includes(r.d)&&t.includes(`Barcelona: ${r.adx.toFixed(1)} m`)&&(r.o_adx==null||t.includes(`${r.opp}: ${r.o_adx.toFixed(1)} m`))});
  ok(good,'each tooltip: the match, Barcelona\'s value and the opponent\'s value of the same match, from the files');
  /* the reading, recomputed */
  const H=BR.filter(r=>r.adx!=null),n=Math.min(3,Math.floor(H.length/2)),a=mean(H.slice(-n).map(r=>r.adx)),bb=mean(H.slice(0,-n).map(r=>r.adx));
  const rd=await pg.$eval('.ph-read',e=>e.querySelector('.fx-en')?[...e.querySelectorAll('.fx-en')].map(x=>x.textContent).join(' | '):e.textContent);
  ok(rd.includes(a.toFixed(1)+' m')&&rd.includes(bb.toFixed(1)+' m')&&rd.includes('last '+n+' matches'),`reading: last ${n} matches ${a.toFixed(1)} m vs ${bb.toFixed(1)} m before (from the files)`);
  const PO=BR.filter(r=>r.pp!=null&&r.o_pp!=null),k=PO.filter(r=>r.pp<r.o_pp).length;ok(rd.includes(`in ${k} of ${PO.length} matches`),`reading: PPDA lower than the opponent in ${k} of ${PO.length}`);
  ok(/not whether it worked/.test(rd),'trend is kept apart from quality');
  /* pick a match in one chart: picked in both */
  await pg.click('.ph-dash .ph-ch >> nth=0 >> .ph-d.t >> nth=2');await pg.waitForTimeout(300);
  const sel=await pg.evaluate(()=>[...document.querySelectorAll('.ph-d.on')].map(c=>c.dataset.pm));ok(sel.length===4&&new Set(sel).size===1&&sel[0]===BR.filter(r=>r.adx!=null)[2].m,'a match picked in one chart is picked in the other (team and opponent points)');
  /* opponent filter, date range, reset: both charts together */
  const opp=BR[0].opp;await pg.selectOption('#phop',opp);await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.ph-dash .ph-ch svg')].every(s=>s.querySelectorAll('.ph-d.t').length===1)),'opponent filter: both charts show only the matches against '+opp);
  await pg.click('#phrs');await pg.waitForTimeout(300);const from=BR[3].d;await pg.selectOption('#phfr',from);await pg.waitForTimeout(300);
  const nR=BR.filter(r=>r.d>=from&&r.adx!=null).length;ok(await pg.evaluate(()=>document.querySelectorAll('.ph-dash .ph-ch')[0].querySelectorAll('.ph-d.t').length)===nR&&Math.abs(+(await pg.evaluate(()=>document.querySelectorAll('.ph-dash .ph-ch')[0].querySelector('.ph-avt').textContent))-mean(BR.filter(r=>r.d>=from).map(r=>r.adx)))<0.051,'date range: the points and the average follow it ('+nR+' matches from '+from+')');
  await pg.click('#phrs');await pg.waitForTimeout(300);ok(await pg.$eval('#phfr',s=>s.selectedIndex)===0&&await pg.$eval('#phop',s=>s.value)==='','reset');
  /* ---- the league charts ---- */
  const S=X.season.filter(t=>t.nh>=3&&t.np>=3);
  const L=await pg.$$eval('.ph-ln',a=>a.map(g=>g.getAttribute('data-tip').split('|')));
  ok(L.length===S.length&&L.every(t=>{const s=S.find(x=>x.n===t[0]);return s&&t[1]===`Defensive action height: ${s.h.toFixed(1)} m`}),`league map: ${L.length} teams, each at its mean defensive action height from the files`);
  ok(L.map(t=>+t[1].match(/[\d.]+/)[0]).every((v,i,a)=>!i||a[i-1]>=v),'ordered highest first');
  await pg.click('#phrev');await pg.waitForTimeout(300);const L2=await pg.$$eval('.ph-ln',a=>a.map(g=>+g.getAttribute('data-tip').split('|')[1].match(/[\d.]+/)[0]));ok(L2.every((v,i,a)=>!i||a[i-1]<=v),'and reversed on request');
  /* a line sits at its value on the pitch: y = top + (1 − h/105) × pitch height */
  const pos=await pg.evaluate(()=>{const r=document.querySelector('.ph-pitch rect'),y0=+r.getAttribute('y'),hh=+r.getAttribute('height');return [...document.querySelectorAll('.ph-ln')].map(g=>{const l=g.querySelector('line'),v=+g.getAttribute('data-tip').split('|')[1].match(/[\d.]+/)[0];return Math.abs(+l.getAttribute('y1')-(y0+(1-v/105)*hh))<0.6})});
  ok(pos.every(Boolean),'each line drawn at its distance from the own goal (same scale for all)');
  const ppm=med(S.map(t=>t.ppda)),hm=med(S.map(t=>t.h));const note=await pg.$eval('.ph-two .card:nth-child(2) .ins-note .fx-en',e=>e.textContent);
  ok(note.includes(ppm.toFixed(2))&&note.includes(hm.toFixed(1)+' m'),`identity map: quadrants at the league medians (PPDA ${ppm.toFixed(2)}, ${hm.toFixed(1)} m)`);
  const quad=await pg.evaluate(()=>{const s=document.querySelector('.ph-two .card:nth-child(2) svg'),ml=s.querySelectorAll('line.ins-med'),mx=+ml[0].getAttribute('x1'),my=+ml[1].getAttribute('y1');
   return [...s.querySelectorAll('.ph-pt')].map(g=>{const t=g.getAttribute('data-tip').split('|'),im=g.querySelector('image,circle:not(.ph-me)');const x=im.tagName==='image'?+im.getAttribute('x')+9:+im.getAttribute('cx'),y=im.tagName==='image'?+im.getAttribute('y')+9:+im.getAttribute('cy');return {n:t[0],right:x>mx,up:y<my}})});
  ok(quad.length===S.length&&quad.every(q=>{const s=S.find(x=>x.n===q.n);return q.right===(s.ppda<ppm)||Math.abs(s.ppda-ppm)<1e-9}),'every club on the side of the PPDA median it belongs to (more pressing to the right)');
  ok(quad.every(q=>{const s=S.find(x=>x.n===q.n);return q.up===(s.h>hm)||Math.abs(s.h-hm)<1e-9}),'and on the side of the height median it belongs to');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- centre-backs' average position, recomputed from the heat-map and lineup files ---- */
 {const lg=IDX.leagues.find(l=>l.id==='l_0ErfuF'),Hh=J(lg.heat_file),MX=J('l_0ErfuF_mx.json'),LG=J(lg.file),md=new Map(LG.matches.map(m=>[m.i,m]));
  const heat=new Map(Hh.rows.filter(r=>r.t==='p').map(r=>[r.m+'|'+r.k,r])),pos=h=>{let n=0,s=0;for(let i=0;i<h.length;i+=3){s+=(h[i]+.5)*105/16*h[i+2];n+=h[i+2]}return n>=10?s/n:null};
  const cbv=new Map(),role={GK:[],CB:[],FB:[],ST:[]};
  for(const [mid,e] of Object.entries(MX.m)){const m=md.get(mid);if(!m||!e.lu)continue;for(const sd of ['h','a']){const L=e.lu[sd];if(!L||!L.xi)continue;const xs=[];
   for(const p of L.xi){const r=heat.get(mid+'|'+p[0]),x=r?pos(r.h):null;if(x==null)continue;const line=Math.floor(p[3]/10),cen=p[5]>.15&&p[5]<.85;
    if(p[3]===11)role.GK.push(x);else if(line===3&&cen){role.CB.push(x);xs.push(x)}else if(line===3)role.FB.push(x);else if(line>=9)role.ST.push(x)}
   if(xs.length)cbv.set(mid+'|'+(sd==='h'?m.h:m.a),xs.reduce((a,b)=>a+b,0)/xs.length)}}
  const rm=k=>role[k].reduce((a,b)=>a+b,0)/role[k].length;
  ok(rm('GK')<rm('CB')&&rm('CB')<rm('FB')&&rm('FB')<rm('ST'),`logical: goalkeepers ${rm('GK').toFixed(1)} m < centre-backs ${rm('CB').toFixed(1)} < full-backs ${rm('FB').toFixed(1)} < strikers ${rm('ST').toFixed(1)} from their own goal`);
  const BC=BR.map(r=>cbv.get(r.m+'|'+T)??null),ac=mean(BC);
  const {ctx,pg,errs}=await open(b);await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.selectOption('#phtm',T);await pg.waitForTimeout(400);
  const c=await pg.evaluate(()=>{const s=document.querySelectorAll('.ph-dash .ph-ch')[0];return {n:s.querySelectorAll('.ph-d.t').length,av:+s.querySelector('.ph-avt').textContent,tips:[...s.querySelectorAll('.ph-d.t')].map(x=>x.getAttribute('data-tip'))}});
  ok(c.n===BC.filter(v=>v!=null).length&&Math.abs(c.av-ac)<0.051,`${T}: centre-backs' average position ${ac.toFixed(1)} m over ${c.n} matches, as recomputed`);
  ok(c.tips.every((t,i)=>{const r=BR.filter((x,j)=>BC[j]!=null)[i],o=cbv.get(r.m+'|'+r.opp);return t.includes(`Barcelona: ${cbv.get(r.m+'|'+T).toFixed(1)} m`)&&(o==null||t.includes(`${r.opp}: ${o.toFixed(1)} m`))}),'each match: Barcelona\'s and the opponent\'s centre-backs of that match');
  const T3=X.teams.map(n=>{const v=[...cbv].filter(([k])=>k.endsWith('|'+n)).map(([,x])=>x);return {n,v}}).filter(t=>t.v.length>=3&&(X.season.find(x=>x.n===t.n)||{}).np>=3);
  const L=await pg.$$eval('.ph-ln',a=>a.map(g=>g.getAttribute('data-tip').split('|')));
  ok(L.length===T3.length&&L.every(t=>{const s=T3.find(x=>x.n===t[0]);return s&&t[1]===`Centre-backs' average position: ${(s.v.reduce((a,b)=>a+b,0)/s.v.length).toFixed(1)} m`}),`league map on the centre-backs: ${L.length} teams, each as recomputed`);
  ok(/not the line held without the ball/.test(await pg.textContent('.ph-def')),'the page says what it measures: where the centre-backs played, with and without the ball');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- a missing value is a gap, not a zero ---- */
 {const drop=async r=>{const res=await r.fetch(),j=await res.json();const i=j.team.findIndex(x=>x.n==='Barcelona'&&x.m===BR[2].m);if(i>=0)j.team[i].adx=null;r.fulfill({json:j})};
  const {ctx,pg,errs}=await open(b,{routes:[[/l_0ErfuF_pl\.json/,drop]]});await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.selectOption('#phhm','adx');await pg.waitForTimeout(300);await pg.selectOption('#phtm',T);await pg.waitForTimeout(400);
  const c=await pg.evaluate(()=>{const s=document.querySelector('.ph-dash .ph-ch svg');return {pts:s.querySelectorAll('.ph-d.t').length,moves:(s.querySelector('.ph-l.t').getAttribute('d').match(/M/g)||[]).length,av:+s.querySelector('.ph-avt').textContent}});
  const R2=BR.map((r,i)=>i===2?{...r,adx:null}:r);
  ok(c.pts===R2.filter(r=>r.adx!=null).length&&c.moves===2&&Math.abs(c.av-mean(R2.map(r=>r.adx)))<0.051,'a match without a value: a gap in the line, left out of the average ('+c.av+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- another competition, and the World Cup left out ---- */
 {const {ctx,pg,errs}=await open(b,{league:'l_1XLtP0'});await pg.waitForSelector('#phroot .empty',{timeout:60000});
  ok(/World Cup is not part/.test(await pg.textContent('#phroot'))&&!(await pg.$('.ph-dash')),'World Cup: not on this page, with a way to choose another competition');
  ok(!(await pg.$$eval('#phlg option',a=>a.some(o=>/World Cup/.test(o.textContent)&&o.value))),'the World Cup is not in the competition list');
  await pg.selectOption('#phlg','l_4WFCIZ');await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.selectOption('#phhm','adx');await pg.waitForTimeout(300);
  const pl=raw('l_4WFCIZ'),n=pl.season.filter(t=>t.nh>=3&&t.np>=3).length;ok(await pg.evaluate(()=>D.id)==='l_4WFCIZ'&&await pg.$$eval('.ph-ln',a=>a.length)===n,'switching to the Premier League: its own teams ('+n+'), not a fixed list');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- phones, Arabic ---- */
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,a,.fx-en,bdi,.ph-lt,text.ph-op,.ph-pt'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI|PPDA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.ph-dash',{timeout:60000});await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '))}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
