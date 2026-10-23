/* Match replay: every number on screen checked against the raw files (shot file, momentum file, league file) */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));
/* expected match, straight from the files: shots with a side by club name, own goals for the other side */
function expect(lid,mid){
 const S=J(lid+'_sh.json'),ix={};S.cols.forEach((c,i)=>ix[c]=i);const L=J(lid+'.json'),m=L.matches.find(x=>x.i===mid),X=J(lid+'_mx.json');
 const rows=S.rows.filter(r=>r[ix.m]===mid&&r[ix.pd]!=='PenaltyShootout'&&r[ix.mn]!=null).map(r=>{const own=r[ix.c]===m.h?'h':r[ix.c]===m.a?'a':null;return {own,side:r[ix.og]?(own==='h'?'a':'h'):own,pd:r[ix.pd],mn:r[ix.mn],ma:r[ix.ma]||0,xg:r[ix.xg],og:!!r[ix.og],goal:r[ix.ev]==='Goal'||!!r[ix.og],x:r[ix.x],y:r[ix.y],pn:r[ix.pn]}});
 const key=r=>[(r.pd==='FirstHalf'?0:1),r.mn,r.ma];const cmp=(a,b)=>{const A=key(a),B=key(b);for(let i=0;i<3;i++)if(A[i]!==B[i])return A[i]-B[i];return 0};
 const goals=rows.filter(r=>r.goal).sort(cmp);let h=0,a=0;const cum=goals.map(g=>{g.side==='h'?h++:a++;return `${h} – ${a}`});
 const lab=r=>r.ma?`${r.pd==='FirstHalf'?45:90}+${r.ma}'`:`${r.mn}'`;
 const xg=s=>rows.filter(r=>r.side===s&&!r.og).reduce((t,r)=>t+(r.xg||0),0);
 /* spells: whole minutes, |momentum| 60+, same side, 3+ consecutive, within one half */
 const mo=((X.m[mid]||{}).mo||[]).filter(p=>p[0]===Math.floor(p[0]));let sp=0,run=null;const half=t=>t<=45?0:t<=90?1:t<=105?2:3;
 mo.forEach(([t,v])=>{const s=v>=60?'h':v<=-60?'a':null;if(s&&run&&run.s===s&&run.hf===half(t)&&t===run.t+1){run.t=t;run.n++;return}if(run&&run.n>=3)sp++;run=s?{s,hf:half(t),t,n:1}:null});if(run&&run.n>=3)sp++;
 return {m,rows,goals,cum,labels:goals.map(lab),xg:{h:xg('h'),a:xg('a')},shots:rows.filter(r=>r.side&&r.x!=null&&r.y!=null).length,named:rows.every(r=>r.own),spells:sp,a1:Math.max(0,...rows.filter(r=>r.pd==='FirstHalf'&&r.mn>=45).map(r=>r.ma)),off:m.s.split('-').map(Number)};
}
const A=expect('l_4WFCIZ','m_3p07rX'),B=expect('l_4WFCIZ','m_15wl79'),C=expect('l_1XLtP0','m_2czpX5');
async function open(b,{vw=1280,lang='en',hash,league='l_4WFCIZ',routes=[],reduce=false}={}){
 const ctx=await b.newContext({viewport:{width:vw,height:900},reducedMotion:reduce?'reduce':'no-preference'});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 for(const [re,fn] of routes)await ctx.route(re,fn);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const txt=(pg,s)=>pg.$eval(s,e=>e.textContent.replace(/[⁦-⁩]/g,'').trim());
const seek=(pg,t)=>pg.evaluate(t=>{const s=document.querySelector('#rpsk');s.value=t;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}))},t);
const untranslated=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('svg,select,option,a,.rp-n,.rp-sph,.ms-en,.ms bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|PitchAPI|FT|HT)\b/.test(t))o.push(t)}});return [...new Set(o)]};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 ok(A.named&&B.named&&A.goals.length===A.off[0]+A.off[1]&&B.goals.length===B.off[0]+B.off[1],`test matches: ${A.m.h} ${A.m.s} ${A.m.a} (goals at ${A.labels.join(', ')}), ${B.m.h} ${B.m.s} ${B.m.a} (an own goal)`);
 /* ---- the way in, spoiler-free start ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/match/'+A.m.i});await pg.waitForSelector('#mc .rp-go',{timeout:60000});
  ok(await pg.$eval('#mc .rp-go',a=>a.getAttribute('href'))===('#/replay/'+A.m.i),'match centre: "Replay the match" on the scoreboard');
  await pg.click('#mc .rp-go');await pg.waitForSelector('#rp .rp-sb',{timeout:30000});
  const st=await pg.evaluate(()=>({sc:document.querySelector('#rpsc').textContent,ck:document.querySelector('#rpclk').textContent,on:document.querySelectorAll('.rp-pt.h .rp-s.on').length,g:document.querySelectorAll('#rptrk i.g').length,feed:[...document.querySelectorAll('#rpl li')].map(l=>l.textContent),clip:[...document.querySelectorAll('.rp-clipr')].map(r=>+r.getAttribute('width'))}));
  ok(st.sc==='0 – 0'&&st.ck==="0'"&&st.on===0&&st.g===0&&st.feed.length===1&&/Kick-off/.test(st.feed[0])&&st.clip.every(w=>w===0),'spoiler free at kick-off: 0 – 0, 0\', no shot, no goal mark, charts empty');
  ok(!(await pg.textContent('#rp')).includes(A.m.s.replace('-',' – ')),'the final score is nowhere on the page before the end');
  /* every key moment in turn: the score after each goal, its minute (stoppage time included) */
  const seen=[];let n=0;
  while(n++<120){await pg.click('#rpnext');const s=await pg.evaluate(()=>({ck:document.querySelector('#rpclk').textContent,sc:document.querySelector('#rpsc').textContent,g:document.querySelectorAll('#rpl li.gl').length,top:(document.querySelector('#rpl li.gl b')||{}).textContent}));
   if(s.g>seen.length)seen.push(s);if(s.ck==='FT')break}
  ok(seen.length===A.goals.length&&seen.every((s,i)=>s.sc===A.cum[i]),'score after each goal = the goals in the file up to then: '+seen.map(s=>s.sc).join(', '));
  ok(seen.every((s,i)=>s.top===A.labels[i]&&s.ck===A.labels[i]),'each goal at its minute, stoppage time included: '+seen.map(s=>s.ck).join(', '));
  const ft=await pg.evaluate(()=>({sc:document.querySelector('#rpsc').textContent,xg:document.querySelector('#rpxg').textContent,on:document.querySelectorAll('.rp-pt.h .rp-s.on').length,g:document.querySelectorAll('#rptrk i.g').length}));
  ok(ft.sc===A.off.join(' – ')&&ft.xg===`xG ${A.xg.h.toFixed(2)} – ${A.xg.a.toFixed(2)}`,'full time: official score and xG recomputed from the shots ('+ft.sc+', '+ft.xg+')');
  ok(ft.on===A.shots&&ft.g===A.goals.length,'every shot on the pitch ('+ft.on+') and every goal on the time bar ('+ft.g+')');
  await pg.selectOption('#rpf','all');await pg.waitForTimeout(200);
  ok(await pg.$$eval('#rpl li.sp',a=>a.length)===A.spells,'spells on top recomputed from the momentum file ('+A.spells+')');
  ok(await pg.$$eval('#rpl li.gl,#rpl li.sh',a=>a.length)===A.rows.filter(r=>r.side).length,'"Every shot": one line per shot ('+A.rows.length+')');
  /* half-time: the clock holds on HT */
  await seek(pg,45+A.a1-0.3);await pg.click('#rpp');await pg.waitForSelector('#rpov.on.br',{timeout:15000}).catch(()=>{});
  const ht=await pg.evaluate(()=>({ck:document.querySelector('#rpclk').textContent,ov:document.querySelector('#rpov').textContent}));await pg.waitForTimeout(700);const ck2=await txt(pg,'#rpclk');
  ok(ht.ck==='HT'&&/Half-time/.test(ht.ov)&&ck2==='HT','half-time after the first half\'s added time (45+'+A.a1+'), the clock holds on HT');
  await pg.waitForFunction(()=>!document.querySelector('#rpov.on')&&/^4[5-9]'$/.test(document.querySelector('#rpclk').textContent),null,{timeout:15000}).catch(()=>{});
  ok(/^4[5-9]'$/.test(await txt(pg,'#rpclk')),'then the second half runs ('+await txt(pg,'#rpclk')+')');
  /* a goal while playing: the clock holds on it, the card names the scorer */
  const g2=A.goals.findIndex(g=>g.pd==='SecondHalf');await pg.click('#rpp');
  const before=A.goals[g2];await seek(pg,0);await seek(pg,45+A.a1+(before.mn-45)-1.5);await pg.selectOption('#rpsp','120');await pg.click('#rpp');
  await pg.waitForSelector('#rpov.on.gl',{timeout:15000}).catch(()=>{});const g1=await txt(pg,'#rpclk'),ov=await txt(pg,'#rpov');await pg.waitForTimeout(600);
  ok(g1===A.labels[g2]&&g1===await txt(pg,'#rpclk')&&ov.includes(before.pn)&&ov.includes(A.cum[g2]),'playing: a goal holds the clock and shows '+ov);
  await pg.click('#rpp');
  /* the chart: a click moves the clock there */
  await pg.click('.rp-ch.w svg');await pg.waitForTimeout(200);
  const mid=parseInt(await txt(pg,'#rpclk'));ok(mid>=40&&mid<=55&&(await pg.$eval('.rp-ch.w .rp-clipr',r=>+r.getAttribute('width')))>0,'click on the chart: the replay jumps there ('+mid+"')");
  /* keyboard and the saved speed */
  await pg.focus('#rpp');await pg.keyboard.press('Enter');ok(await pg.$eval('#rpp',b=>b.getAttribute('aria-label'))==='Pause','keyboard: Enter on the play button plays');await pg.keyboard.press('Enter');
  await pg.selectOption('#rpsp','60');await pg.reload();await pg.waitForSelector('#rp .rp-sb',{timeout:60000});ok(await pg.$eval('#rpsp',s=>s.value)==='60','speed remembered on this device');
  /* leaving while it plays */
  await pg.click('#rpp');await pg.waitForTimeout(600);await pg.evaluate(()=>location.hash='#/overview');await pg.waitForTimeout(1500);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- review fixes ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/replay/'+A.m.i});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
  const ys=async()=>Math.max(...(await pg.$$eval('.rp-ch.w text.mc-ax.e',a=>a.map(x=>+x.textContent))));
  ok(await ys()===1,'xG scale at kick-off: 1, whatever the final xG');
  /* the 67' goal: T = 45 + first-half added time + 22 - 0.5 */
  const tg=45+A.a1+22-0.5;await seek(pg,tg-0.3);const v1=await pg.$$eval('.rp-ch.w .rp-gm',a=>a.filter(g=>g.style.visibility==='visible').length);await seek(pg,tg+0.1);const v2=await pg.$$eval('.rp-ch.w .rp-gm',a=>a.filter(g=>g.style.visibility==='visible').length);
  ok(v1===1&&v2===2,'goal marks on the chart only once scored ('+v1+' just before the 67\' goal, '+v2+' after)');
  await seek(pg,500);ok(await ys()>=Math.max(A.xg.h,A.xg.a),'xG scale grows with the match ('+await ys()+' at the end)');
  /* a tap on a shot opens its details */
  await seek(pg,tg+0.1);const dot=await pg.$('.rp-pt.h .rp-s.on.lt .rp-dt');const bb=await dot.boundingBox();await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await pg.waitForTimeout(200);
  ok(await pg.$eval('#instip',t=>t.classList.contains('on')&&t.textContent.includes('Jackson')),'hover on a shot: its details (inside the circle, not only on its outline)');
  /* the screen-reader announcement */
  await seek(pg,tg-0.4);await pg.selectOption('#rpsp','120');await pg.click('#rpp');await pg.waitForSelector('#rpov.on.gl',{timeout:15000}).catch(()=>{});
  ok(/Goal!/.test(await txt(pg,'#rpsr'))&&await pg.$eval('#rpsr',e=>getComputedStyle(e).display!=='none'),'the goal is announced in a live region that is rendered');
  await pg.click('#rpp');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {const D_=expect('l_4WFCIZ','m_4c9pFe'),gl=D_.goals.find(g=>/Janelt/.test(g.pn));
  const {ctx,pg,errs}=await open(b,{hash:'#/replay/m_4c9pFe'});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
  await seek(pg,gl.mn-0.5+0.05);ok(/Janelt/.test(await txt(pg,'#rplast'))&&await pg.$eval('.rp-pt.h .rp-s.lt',g=>g.classList.contains('g')),'a goal and another shot in the same minute: the goal is the one shown ('+gl.pn+' '+gl.mn+"')");
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {/* a slow first visit: leave match A for match B while A is still loading; B's button must be B's */
  const slow=async r=>{await new Promise(z=>setTimeout(z,6000));r.continue()};
  const {ctx,pg,errs}=await open(b,{hash:'#/match/'+A.m.i,routes:[[/l_4WFCIZ_mx\.json/,slow]]});await pg.waitForSelector('#mc',{timeout:60000});
  await pg.evaluate(id=>location.hash='#/match/'+id,B.m.i);await pg.waitForSelector('#mc .rp-go',{timeout:60000}).catch(()=>{});await pg.waitForTimeout(800);
  const L=await pg.$$eval('#mc .rp-go',a=>a.map(x=>x.getAttribute('href')));ok(L.length===1&&L[0]==='#/replay/'+B.m.i,'switching match while loading: one button, for the match on screen ('+L.join(',')+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- an own goal ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/replay/'+B.m.i});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
  await seek(pg,200);await pg.waitForTimeout(300);await pg.selectOption('#rpf','all');
  const og=B.goals.find(g=>g.og),li=await pg.$$eval('#rpl li.gl',L=>L.map(l=>({t:l.textContent,cls:l.className})));
  const row=li.find(l=>/Own goal/.test(l.t));
  ok(row&&row.t.includes(og.pn)&&row.cls.includes(' '+og.side)&&!/xG/.test(row.t),'own goal: counted for the other side, no xG ('+og.pn+')');
  ok(await txt(pg,'#rpsc')===B.off.join(' – '),'final score '+B.m.s);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- extra time, and goals the shot file does not have ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/replay/'+C.m.i,league:'l_1XLtP0'});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
  const tk=await pg.$$eval('.rp-ch.w text.mc-ax',a=>a.map(x=>x.textContent));ok(!tk.includes("105'")&&!tk.includes("120'")&&tk.includes("90'"),'extra time with no shots in the file: not on the time line (it would tell from kick-off that the match was level)');
  await seek(pg,500);await pg.waitForTimeout(300);const sh=C.goals.reduce((o,g)=>{o[g.side]++;return o},{h:0,a:0});
  const ftli=await txt(pg,'#rpl li.br');
  ok(await txt(pg,'#rpsc')===C.off.join(' – ')&&ftli.includes(`${sh.h} – ${sh.a} of the goals`)&&/went to extra time/.test(ftli),`final whistle: official ${C.m.s}, the extra time note, and the shot file's ${sh.h} – ${sh.a}`);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- no shots for the match / no momentum ---- */
 {const drop=async r=>{const res=await r.fetch(),j=await res.json(),i=j.cols.indexOf('m');j.rows=j.rows.filter(x=>x[i]!==B.m.i);r.fulfill({json:j})};
  const nomo=async r=>{const res=await r.fetch(),j=await res.json();if(j.m[A.m.i])delete j.m[A.m.i].mo;r.fulfill({json:j})};
  const {ctx,pg,errs}=await open(b,{hash:'#/match/'+B.m.i,routes:[[/l_4WFCIZ_sh\.json/,drop],[/l_4WFCIZ_mx\.json/,nomo]]});await pg.waitForSelector('#mc .mc-score',{timeout:60000});await pg.waitForTimeout(500);
  ok(!(await pg.$('#mc .rp-go')),'no shots for the match: no replay button');
  await pg.evaluate(id=>location.hash='#/replay/'+id,B.m.i);await pg.waitForSelector('#rp .empty:not(.skel)',{timeout:30000});ok(/No shot data/.test(await txt(pg,'#rp')),'and the replay page says why');
  await pg.evaluate(id=>location.hash='#/replay/'+id,A.m.i);await pg.waitForSelector('#rp .rp-sb',{timeout:30000});
  ok(/No momentum data/.test(await txt(pg,'.rp-ch.w'))&&await pg.$$eval('.rp-ch.w rect[fill]',a=>a.length)===0,'no momentum for the match: the chart says so, the replay still runs');
  await pg.evaluate(()=>location.hash='#/replay/x_nope');await pg.waitForSelector('#app .empty',{timeout:30000});ok(/not in the open league/.test(await txt(pg,'#app')),'unknown match: a message and a link to Matches');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- reduced motion ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/replay/'+A.m.i,reduce:true});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
  await seek(pg,45+4-0.5-0.3);await pg.selectOption('#rpsp','120');await pg.click('#rpp');   /* just before the 45+4' goal */
  await pg.waitForSelector('#rpov.on',{timeout:15000}).catch(()=>{});ok(await pg.$eval('#rpov',o=>o.classList.contains('rm')&&getComputedStyle(o).animationName==='none'),'reduced motion: no animation on the goal card');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- phones, Arabic ---- */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang,hash:'#/replay/'+A.m.i});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});await seek(pg,60);await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.rp-pt.v')).display!=='none'&&getComputedStyle(document.querySelector('.rp-pt.h')).display==='none'&&getComputedStyle(document.querySelector('.rp-ch.n')).display!=='none'),lang+' phone: vertical pitch, narrow chart');
  if(lang==='ar'){await seek(pg,500);await pg.selectOption('#rpf','all');await pg.waitForTimeout(400);const u=await pg.evaluate(untranslated,'#app');ok(!u.length,'Arabic: replay translated '+u.slice(0,4).join(' | '));
   ok(!/وقت الحفظ/.test(await txt(pg,'#rpl'))&&/التسديدات/.test(await txt(pg,'#rpl li.br')),'Arabic: a saved shot is "صدّها الحارس", not the site\'s other "Saved"')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
