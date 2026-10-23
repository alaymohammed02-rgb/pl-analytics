/* Match story: each sentence's facts recomputed from the raw files (league file, shot file, ratings file) for every match */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));
function expect(lid){
 const S=J(lid+'_sh.json'),ix={};S.cols.forEach((c,i)=>ix[c]=i);const L=J(lid+'.json'),RT=J(lid+'_rt.json');
 const out=[];
 for(const m of L.matches){const sc=/^(\d+)-(\d+)$/.exec(m.s||'');if(!sc)continue;const off=[+sc[1],+sc[2]];
  const rows=S.rows.filter(r=>r[ix.m]===m.i&&r[ix.pd]!=='PenaltyShootout'&&r[ix.mn]!=null);if(!rows.length)continue;
  if(!rows.every(r=>r[ix.c]===m.h||r[ix.c]===m.a))continue;   /* only matches whose shots name their club (no team ids to resolve) */
  const sh=rows.map(r=>{const own=r[ix.c]===m.h?'h':'a';return {own,side:r[ix.og]?(own==='h'?'a':'h'):own,pd:r[ix.pd],mn:r[ix.mn],ma:r[ix.ma]||0,xg:r[ix.xg]||0,og:!!r[ix.og],goal:r[ix.ev]==='Goal'||!!r[ix.og],pen:r[ix.st]==='Penalty',pn:r[ix.pn]}});
  const key=r=>[r.pd==='FirstHalf'?0:1,r.mn,r.ma,r.goal?1:0];sh.sort((a,b)=>{const A=key(a),B=key(b);for(let i=0;i<4;i++)if(A[i]!==B[i])return A[i]-B[i];return 0});
  const gl=sh.filter(r=>r.goal);if(gl.filter(g=>g.side==='h').length!==off[0]||gl.filter(g=>g.side==='a').length!==off[1])continue;   /* the story tells goals only when the file has them all */
  const nm=s=>s==='h'?m.h:m.a,clk=r=>r.ma?`${r.pd==='FirstHalf'?45:90}+${r.ma}'`:`${r.mn}'`,late=r=>r.pd==='SecondHalf'&&(r.mn>=85||r.ma>0);
  const E=[];const W=off[0]>off[1]?'h':off[0]<off[1]?'a':null;
  E.push(W?`${nm(W)} beat ${nm(W==='h'?'a':'h')} ${Math.max(...off)}–${Math.min(...off)}.`:`${m.h} and ${m.a} drew ${off[0]}–${off[1]}.`);
  const xg=s=>sh.filter(r=>r.side===s&&!r.og).reduce((t,r)=>t+r.xg,0);
  if(W){const xw=xg(W),xl=xg(W==='h'?'a':'h');E.push(xw-xl>=.5?`The chances backed it up: xG ${xw.toFixed(2)}–${xl.toFixed(2)}.`:xl-xw>=.5?`had the better chances (xG ${xl.toFixed(2)}–${xw.toFixed(2)})`:`The chances were close: xG ${xw.toFixed(2)}–${xl.toFixed(2)}.`)}
  const f=gl[0];if(f)E.push(f.og?`An own goal by ${f.pn} put ${nm(f.side)} ahead (${clk(f)}).`:f.pen?`${f.pn} opened the scoring for ${nm(f.side)} from the penalty spot (${clk(f)}).`:`${f.pn} opened the scoring for ${nm(f.side)} (${clk(f)}).`);
  const ht={h:gl.filter(r=>r.pd==='FirstHalf'&&r.side==='h').length,a:gl.filter(r=>r.pd==='FirstHalf'&&r.side==='a').length};
  if(f&&(ht.h!==off[0]||ht.a!==off[1]))E.push(`At half-time it was ${m.h} ${ht.h}–${ht.a} ${m.a}.`);
  if(W&&Math.abs(off[0]-off[1])===1){const d=gl.filter(r=>r.side===W)[off[W==='h'?1:0]];if(d&&!d.og&&(d!==f||late(d)))E.push(late(d)?`${d.pn}'s goal (${clk(d)}) won it late.`:`${d.pn} scored the winner (${clk(d)}).`)}
  const best=sh.filter(r=>!r.goal&&!r.og&&r.xg>=.3).sort((a,b)=>b.xg-a.xg)[0];if(best)E.push(`The best chance not taken: ${best.pn} (${nm(best.own)}, ${clk(best)}), xG ${best.xg.toFixed(2)}.`);
  const N=[];if(!best)N.push('The best chance not taken');
  const rt=RT.m[m.i];if(rt){const b=Object.entries(rt).filter(([,v])=>typeof v==='number').sort((a,b)=>b[1]-a[1])[0];const st=L.stats.find(s=>s.m===m.i&&s.i===b[0]);if(st)E.push(`${st.p} was the highest-rated player (${b[1].toFixed(1)}).`)}
  out.push({id:m.i,label:`${m.h} ${m.s} ${m.a}`,E,N})}
 return out;
}
async function open(b,{vw=1280,lang='en',hash,league='l_4WFCIZ'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const seek=(pg,t)=>pg.evaluate(t=>{const s=document.querySelector('#rpsk');s.value=t;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}))},t);
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* ---- every Premier League match whose shot file has all its goals ---- */
 {const X=expect('l_4WFCIZ');const {ctx,pg,errs}=await open(b,{hash:'#/overview'});await pg.waitForSelector('#mb .mb-days',{timeout:60000});
  let good=0;const bad=[];
  for(const x of X){await pg.evaluate(id=>location.hash='#/match/'+id,x.id);await pg.waitForSelector('#mc .ms',{timeout:30000}).catch(()=>{});
   const t=await pg.evaluate(()=>{const e=document.querySelector('#mc .ms .ms-en');return e?e.textContent.replace(/\s+/g,' '):''});
   const miss=x.E.filter(s=>!t.includes(s)),extra=x.N.filter(s=>t.includes(s));if(!miss.length&&!extra.length)good++;else bad.push(x.label+': '+(miss[0]||'unexpected '+extra[0]))}
  ok(X.length>=40&&!bad.length,`Premier League: every sentence's facts recomputed from the files for ${good} of ${X.length} matches (result, xG, first goal, half-time, winner, best chance missed, top rating) ${bad.slice(0,3).join(' | ')}`);
  ok(await pg.$$eval('#mc .ms',a=>a.length)===1&&await pg.evaluate(()=>{const s=document.querySelector('#mc .mc-score');return s&&s.nextElementSibling&&s.nextElementSibling.classList.contains('ms')}),'one story card, right under the scoreboard');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- language: both written, the page language shows one; switching shows the other ---- */
 {const {ctx,pg,errs}=await open(b,{lang:'ar',hash:'#/match/m_15wl79'});await pg.waitForSelector('#mc .ms',{timeout:60000});
  const v=()=>pg.evaluate(()=>({en:getComputedStyle(document.querySelector('#mc .ms-en')).display,ar:getComputedStyle(document.querySelector('#mc .ms-ar')).display,t:document.querySelector('#mc .ms-ar').innerText}));
  const a=await v();ok(a.en==='none'&&a.ar!=='none'&&/قلب تأخره بهدف إلى فوز/.test(a.t)&&/أخطر فرصة ما دخلت/.test(a.t)&&/Bruno Fernandes كان صاحب أعلى تقييم/.test(a.t),'Arabic: the Arabic story is shown ("…قلب تأخره بهدف إلى فوز")');
  ok(await pg.$eval('#mc .ms h3',h=>h.textContent)==='قصة المباراة','Arabic: title translated');
  await pg.click('#langbtn');await pg.waitForSelector('#mc .ms',{timeout:30000});const e=await v();ok(e.en!=='none'&&e.ar==='none','switch to English: the English story');
  await pg.click('#langbtn');await pg.waitForTimeout(500);const a2=await v();ok(a2.en==='none'&&a2.ar!=='none','and back to Arabic without a reload');
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),'no horizontal scroll');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- the replay: no story before the final whistle ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/replay/m_3p07rX'});await pg.waitForSelector('#rp .rp-sb',{timeout:60000});await pg.waitForTimeout(500);
  const st=()=>pg.evaluate(()=>{const x=document.querySelector('#rpms');return {hid:!x||x.hidden,txt:x?x.textContent:''}});
  const s0=await st();ok(s0.hid&&!s0.txt,'replay: no story (and no text of it in the page) before the final whistle');
  await seek(pg,80);await pg.waitForTimeout(300);ok((await st()).hid,'still none at 80\'');
  await seek(pg,500);await pg.waitForSelector('#rpms:not([hidden]) .ms',{timeout:15000}).catch(()=>{});const s1=await st();
  ok(!s1.hid&&/Aston Villa beat Tottenham Hotspur 3–2/.test(s1.txt),'at the final whistle the story appears');
  await seek(pg,10);await pg.waitForTimeout(300);const s2=await st();ok(s2.hid&&!s2.txt,'back before the end: hidden and emptied again');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---- what the data cannot tell: extra time, goals missing from the shot file ---- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/match/m_2czpX5',league:'l_1XLtP0'});await pg.waitForSelector('#mc .ms',{timeout:60000});
  const t=await pg.$eval('#mc .ms .ms-en',e=>e.textContent.replace(/\s+/g,' '));
  ok(/went to extra time/.test(t)&&/so the goals are not described one by one/.test(t)&&!/opened the scoring/.test(t)&&/xG in the shot data PitchAPI has/.test(t)&&!/backed it up|better chances|were close/.test(t),'extra time and missing goals: said, and no goal is described ('+t.slice(0,90)+'…)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
