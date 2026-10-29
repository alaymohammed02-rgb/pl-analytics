/* Wrapped (assets/wrapped.js): a club's season and a player's season as story slides. For three clubs every figure on every slide is recounted here from the
   raw league, shots and player files (record, points, place in the table, goals, team xG over the matches that have it, biggest win and heaviest defeat with
   their tie-breaks, longest unbeaten run and win streak, last five, home and away, top scorer / assister / minutes); the slides that have nothing to say are
   absent; for a player the matches, minutes, goals, assists, xG and xAG, best match, runs, goals against xG are recounted and the percentiles and the twin
   agree with the Player story page. Moving: next / previous buttons, a tap on either part, a swipe, the arrow keys (mirrored in Arabic), Home / End, the progress
   segments; play goes on by itself and stops at the end, pause stops it; save a slide (a PNG of 1080 × 1350 with the final numbers, no animation in the saved
   file); no text overlaps another or leaves the slide; reduced motion; Arabic, 390 px, leaving early, failing files, the Home hub tab. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ',IDX=id=>T.IDX.leagues.find(l=>l.id===id);
const sc=s=>{const m=/^(\d+)\s*[-–:]\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const f1=v=>(+v).toFixed(1),f2=v=>(+v).toFixed(2),sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v);
const ord=n=>{const k=n%100;if(k>=11&&k<=13)return 'th';return {1:'st',2:'nd',3:'rd'}[n%10]||'th'};
function clubWant(lid,club){
 const l=IDX(lid),L=J(l.file),Sh=J(l.sh_file),P=J(l.pl_file),pc={};P.cols.forEach((k,i)=>pc[k]=i);const sc_={};Sh.cols.forEach((k,i)=>sc_[k]=i);
 const fin=L.matches.map(m=>{const g=sc(m.s);return g&&m.d?{id:m.i,d:String(m.d).slice(0,10),h:m.h,a:m.a,hg:g[0],ag:g[1]}:null}).filter(Boolean);
 const tb={};fin.forEach(m=>{for(const [t,gf,ga] of [[m.h,m.hg,m.ag],[m.a,m.ag,m.hg]]){const r=tb[t]||(tb[t]={t,p:0,gf:0,ga:0});r.gf+=gf;r.ga+=ga;r.p+=gf>ga?3:gf===ga?1:0}});
 const tab=Object.values(tb).sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||cmp(a.t,b.t));
 const M=fin.filter(m=>m.h===club||m.a===club).map(m=>{const h=m.h===club;return {id:m.id,d:m.d,home:h,opp:h?m.a:m.h,gf:h?m.hg:m.ag,ga:h?m.ag:m.hg}}).sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id));
 const r=m=>m.gf>m.ga?'W':m.gf<m.ga?'L':'D',E={n:M.length,pos:tab.findIndex(x=>x.t===club)+1,of:tab.length};
 E.w=M.filter(m=>r(m)==='W').length;E.d=M.filter(m=>r(m)==='D').length;E.l=M.filter(m=>r(m)==='L').length;E.pts=E.w*3+E.d;E.gf=M.reduce((s,m)=>s+m.gf,0);E.ga=M.reduce((s,m)=>s+m.ga,0);
 E.win=M.filter(m=>r(m)==='W').sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||cmp(a.d,b.d)||cmp(a.id,b.id))[0]||null;
 E.loss=M.filter(m=>r(m)==='L').sort((a,b)=>(a.gf-a.ga)-(b.gf-b.ga)||b.ga-a.ga||cmp(a.d,b.d)||cmp(a.id,b.id))[0]||null;
 const run=f=>{let b=0,c=0;M.forEach(m=>{if(f(m)){c++;b=Math.max(b,c)}else c=0});return b};E.unb=run(m=>r(m)!=='L');E.wins=run(m=>r(m)==='W');E.form=M.slice(-5).map(r);
 const side=h=>{const x=M.filter(m=>m.home===h);return {n:x.length,pts:x.reduce((s,m)=>s+(r(m)==='W'?3:r(m)==='D'?1:0),0),gf:x.reduce((s,m)=>s+m.gf,0),ga:x.reduce((s,m)=>s+m.ga,0)}};E.h=side(true);E.a=side(false);
 const xg={};Sh.rows.forEach(s=>{if(s[sc_.og]||s[sc_.xg]==null)return;const k=s[sc_.m]+'|'+s[sc_.c];xg[k]=(xg[k]||0)+s[sc_.xg]});
 let xn=0,xf=0,xa=0,xgf=0,xga=0;M.forEach(m=>{const a=xg[m.id+'|'+club],b=xg[m.id+'|'+m.opp];if(a!=null&&b!=null){xn++;xf+=a;xa+=b;xgf+=m.gf;xga+=m.ga}});E.xg=xn?{n:xn,xf,xa,gf:xgf,ga:xga}:null;
 const pl={};P.rows.forEach(x=>{if(x[pc.c]!==club)return;const o=pl[x[pc.i]]||(pl[x[pc.i]]={n:x[pc.n],mi:0,gl:0,ast:0});o.mi+=x[pc.mi]||0;o.gl+=x[pc.gl]||0;o.ast+=x[pc.ast]||0});
 const top=k=>Object.values(pl).sort((a,b)=>b[k]-a[k]||b.mi-a.mi||cmp(a.n,b.n))[0];const a=top('gl'),b=top('ast'),c=top('mi');E.sc=a&&a.gl>0?a:null;E.as=b&&b.ast>0?b:null;E.mi=c&&c.mi>0?c:null;
 return E}
function clubTexts(E,club,lgn,season){
 const S=[['Your season',[club,lgn+' · '+season,String(E.n),'matches played']],
  ['The record',[String(E.w),'wins',String(E.d),'draws',String(E.l),'defeats',E.pts+' points',f2(E.pts/E.n)+' a match · '+E.pos+ord(E.pos)+' of '+E.of+' in the table']],
  ['Goals',[String(E.gf),'scored',String(E.ga),'conceded','Goal difference '+sg(E.gf-E.ga),...(E.xg?['Chances (xG) over '+E.xg.n+' matches with shot data',f1(E.xg.xf)+' xG · '+E.xg.gf+' goals',f1(E.xg.xa)+' xG · '+E.xg.ga+' goals']:[])]]];
 if(E.win||E.loss)S.push(['Highs and lows',[...(E.win?['BIGGEST WIN',E.win.gf+'–'+E.win.ga,(E.win.home?'at home to ':'away at ')+E.win.opp+' · '+E.win.d]:[]),...(E.loss?['HEAVIEST DEFEAT',E.loss.gf+'–'+E.loss.ga,(E.loss.home?'at home to ':'away at ')+E.loss.opp+' · '+E.loss.d]:[])]]);
 S.push(['Runs and form',[...(E.unb>=3?[String(E.unb),'matches unbeaten in a row (longest)']:[]),...(E.wins>=2?[String(E.wins),'wins in a row (longest)']:[]),'LAST '+E.form.length,...E.form]]);
 S.push(['Home and away',['AT HOME',f2(E.h.n?E.h.pts/E.h.n:0),'points a match · '+E.h.n+' matches · '+E.h.gf+' for, '+E.h.ga+' against','AWAY',f2(E.a.n?E.a.pts/E.a.n:0),'points a match · '+E.a.n+' matches · '+E.a.gf+' for, '+E.a.ga+' against']]);
 if(E.sc||E.as||E.mi)S.push(['The players',[...(E.sc?[E.sc.n,E.sc.gl+' goals']:[]),...(E.as?[E.as.n,E.as.ast+' assists']:[]),...(E.mi?[E.mi.n,Math.round(E.mi.mi)+' minutes']:[])]]);
 S.push(['Summary',[club,E.w+'W '+E.d+'D '+E.l+'L · '+E.pts+' points · '+E.pos+ord(E.pos),E.gf+' goals scored, '+E.ga+' conceded','Thanks for the season.']]);
 return S}
const texts=pg=>pg.$$eval('#wrsv svg text',a=>a.map(t=>t.textContent.trim()));
const titles=pg=>pg.$$eval('#wrpg .wr-seg',a=>a.map(b=>b.getAttribute('aria-label').replace(/^\d+\.\s*/,'')));
const settle=pg=>pg.waitForTimeout(1300);
const layout=pg=>pg.evaluate(()=>{const svg=document.querySelector('#wrsv svg'),vb=svg.viewBox.baseVal,T=[...svg.querySelectorAll('text')].map(t=>{const b=t.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height,t:t.textContent}}).filter(b=>b.w>0);
 const bad=[];T.forEach((a,i)=>{if(a.x<8||a.x+a.w>vb.width-8||a.y<0||a.y+a.h>vb.height)bad.push('outside: '+a.t);T.forEach((b,j)=>{if(j>i&&a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>24)bad.push(a.t+' / '+b.t)})});return bad});
const goSlide=async(pg,i)=>{await pg.click('#wrpg .wr-seg[data-i="'+i+'"]');await settle(pg)};
async function open(b,o={}){const r=await T.open(b,{vw:520,league:LG,hash:'#/wrapped',...o});await r.pg.waitForSelector('#wrst svg',{timeout:90000});await r.pg.waitForTimeout(800);return r}
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await open(b);
 const season=await pg.evaluate(()=>(typeof ALL==='object'&&ALL&&ALL.season)||(typeof curSeason==='function'?curSeason():'')||''),lgn=IDX(LG).name;
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.indexOf('#/wrapped')===a.indexOf('#/ask')+1&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/wrapped'}),'the page is the tab after Ask the site in the Home hub, marked open');
 for(const club of ['AFC Bournemouth','Arsenal','Hull City']){
  await pg.selectOption('#wrc',club);await pg.waitForSelector('#wrst svg',{timeout:60000});await pg.waitForTimeout(500);const E=clubWant(LG,club),W=clubTexts(E,club,lgn,season);
  ok(JSON.stringify(await titles(pg))===JSON.stringify(W.map(x=>x[0])),club+': '+W.length+' slides, in order ('+W.map(x=>x[0]).join(', ')+')');
  let bad=[];for(let i=0;i<W.length;i++){await goSlide(pg,i);const got=await texts(pg),miss=W[i][1].filter(s=>!got.includes(s));if(miss.length)bad.push(W[i][0]+': missing '+JSON.stringify(miss)+' in '+JSON.stringify(got.slice(0,14)))}
  ok(!bad.length,club+': every figure of every slide recounted from the raw files ('+E.w+'W '+E.d+'D '+E.l+'L, '+E.gf+'–'+E.ga+', '+E.pos+ord(E.pos)+(E.xg?', xG over '+E.xg.n+' matches':'')+') '+bad.slice(0,2).join(' | '));
  bad=[];for(let i=0;i<W.length;i++){await goSlide(pg,i);const l=await layout(pg);if(l.length)bad.push(W[i][0]+': '+l.slice(0,2).join(' ; '))}
  ok(!bad.length,club+': no text overlaps another or leaves the slide '+bad.slice(0,2).join(' | '))}
 /* moving */
 await pg.selectOption('#wrc','Arsenal');await pg.waitForSelector('#wrst svg',{timeout:60000});await pg.waitForTimeout(500);const N=(await titles(pg)).length;
 const pos=async()=>+await pg.$eval('#wrsv',e=>e.dataset.i);const box=await pg.$eval('#wrst',e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}});
 ok(await pos()===0&&await pg.$eval('#wrprev',e=>e.disabled)&&!(await pg.$eval('#wrnext',e=>e.disabled)),'the first slide: Previous is off');
 await pg.click('#wrnext');await pg.waitForTimeout(150);ok(await pos()===1,'Next goes to the second slide');
 await pg.mouse.click(box.x+box.w*.85,box.y+box.h*.5);await pg.waitForTimeout(150);ok(await pos()===2,'a tap on the right part goes forward');
 await pg.mouse.click(box.x+box.w*.12,box.y+box.h*.5);await pg.waitForTimeout(150);ok(await pos()===1,'a tap on the left part goes back');
 await pg.mouse.move(box.x+box.w*.8,box.y+box.h*.5);await pg.mouse.down();await pg.mouse.move(box.x+box.w*.3,box.y+box.h*.5,{steps:6});await pg.mouse.up();await pg.waitForTimeout(150);ok(await pos()===2,'a swipe to the left goes forward');
 await pg.mouse.move(box.x+box.w*.3,box.y+box.h*.5);await pg.mouse.down();await pg.mouse.move(box.x+box.w*.8,box.y+box.h*.5,{steps:6});await pg.mouse.up();await pg.waitForTimeout(150);ok(await pos()===1,'a swipe to the right goes back');
 await pg.focus('#wrst');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(100);ok(await pos()===2,'the right arrow goes forward');await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(100);ok(await pos()===1,'the left arrow goes back');
 await pg.keyboard.press('End');await pg.waitForTimeout(100);ok(await pos()===N-1&&await pg.$eval('#wrnext',e=>e.disabled),'End goes to the last slide, Next is off');await pg.keyboard.press('Home');await pg.waitForTimeout(100);ok(await pos()===0,'Home goes to the first');
 await goSlide(pg,3);ok(await pos()===3&&await pg.$$eval('#wrpg .wr-seg',a=>a.map(b=>b.className.replace('wr-seg','').trim()).join('|'))===['done','done','done','on',...Array(N-4).fill('')].join('|'),'a progress segment jumps to its slide: the ones before are done, the open one is on');
 ok((await pg.textContent('#wrlive')).startsWith('4/'+N),'the live line says '+(await pg.textContent('#wrlive')));
 /* play */
 await pg.evaluate(()=>INS.wrapped.step(350));await goSlide(pg,0);await pg.click('#wrplay');await pg.waitForTimeout(1100);const p1=await pos();ok(p1>=2&&p1<N-1&&await pg.$eval('#wrplay',e=>e.textContent)==='❚❚','play goes on by itself ('+p1+' after 1.1 s) and the button shows pause');
 await pg.click('#wrplay');const pp=await pos();await pg.waitForTimeout(900);ok(await pos()===pp,'pause stops it on slide '+(pp+1));
 await pg.click('#wrplay');await pg.waitForFunction(n=>+document.querySelector('#wrsv').dataset.i===n-1,N,{timeout:15000});await pg.waitForTimeout(900);ok(await pg.$eval('#wrplay',e=>e.textContent)==='▶'&&await pos()===N-1,'it stops by itself on the last slide and the button shows play');
 /* saving */
 await goSlide(pg,1);const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#wrsave')]);const fn=dl.suggestedFilename(),path=await dl.path(),buf=require('fs').readFileSync(path);
 ok(/^wrapped-2-card-arsenal\.png$/.test(fn)&&buf.slice(1,4).toString()==='PNG'&&buf.readUInt32BE(16)===1080&&buf.readUInt32BE(20)===1350,'Save this slide gives a PNG of 1080 × 1350 ('+fn+')');
 const fin=await pg.evaluate(()=>INS.wrapped.finalSvg(1)),E=clubWant(LG,'Arsenal');
 ok(!/data-cu|wr-in|wr-bar|animation/.test(fin)&&fin.includes('>'+E.w+'<')&&fin.includes('>'+E.pts+' points<'),'the saved picture has the final numbers and no animation');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* a player */
 ({ctx,pg,errs}=await open(b));await pg.selectOption('#wrc','Arsenal');await pg.click('#wrm button[data-m="player"]');await pg.waitForSelector('#wrp',{timeout:60000});await pg.waitForSelector('#wrst svg',{timeout:60000});await pg.waitForTimeout(600);
 const L=J(IDX(LG).file),P=J(IDX(LG).pl_file),c={};P.cols.forEach((k,i)=>c[k]=i);
 const sq={};P.rows.forEach(r=>{if(r[c.c]!=='Arsenal'||r[c.mi]==null)return;const o=sq[r[c.i]]||(sq[r[c.i]]={id:r[c.i],n:r[c.n],mi:0});o.mi+=r[c.mi]});
 const who=Object.values(sq).sort((a,b)=>b.mi-a.mi||cmp(a.n,b.n)),first=who[0];
 const opts=await pg.$$eval('#wrp option',a=>a.map(o=>o.textContent));ok(JSON.stringify(opts)===JSON.stringify(who.map(x=>x.n)),'the players of Arsenal, most minutes first ('+opts.slice(0,3).join(', ')+')');
 const scorer=Object.values(sq).map(x=>({...x,gl:P.rows.filter(r=>r[c.i]===x.id&&r[c.c]==='Arsenal').reduce((s,r)=>s+(r[c.gl]||0),0)})).sort((a,b)=>b.gl-a.gl||b.mi-a.mi)[0];
 await pg.selectOption('#wrp',{label:scorer.n});await pg.waitForTimeout(1500);await pg.waitForSelector('#wrst svg');
 const ms=new Map(L.matches.filter(m=>sc(m.s)&&m.d).map(m=>[m.i,m]));const rows=P.rows.filter(r=>r[c.i]===scorer.id&&r[c.mi]>0&&ms.has(r[c.m]));
 const n=rows.length,mi=Math.round(rows.reduce((s,r)=>s+r[c.mi],0)),gl=rows.reduce((s,r)=>s+(r[c.gl]||0),0),ast=rows.reduce((s,r)=>s+(r[c.ast]||0),0),xg=rows.reduce((s,r)=>s+(r[c.xg]||0),0);
 const tl=await titles(pg);ok(tl[0]==='Your season'&&tl[1]==='The numbers'&&tl[tl.length-1]==='Summary','the player\'s slides start with the season and the numbers and end with the summary ('+tl.join(', ')+')');
 let got=await texts(pg);ok(got.includes(scorer.n)&&got.includes(String(n))&&got.includes(mi+' minutes'),scorer.n+': the first slide has his matches ('+n+') and minutes ('+mi+')');
 await goSlide(pg,1);got=await texts(pg);ok(got.includes(String(gl))&&got.includes(String(ast))&&got.includes(f2(xg)+' xG'),'the numbers slide: '+gl+' goals, '+ast+' assists, '+f2(xg)+' xG');
 /* the same player on the Player story page: the best match, the runs, the percentiles and the twin agree */
 const key=await pg.$eval('#wrp',e=>e.value);const wrTexts={};for(let i=0;i<tl.length;i++){await goSlide(pg,i);wrTexts[tl[i]]=await texts(pg)}
 await pg.evaluate(k=>location.hash='#/story/'+encodeURIComponent(k),key);await pg.waitForSelector('.ps-head',{timeout:90000});await pg.waitForTimeout(1500);
 const st=await pg.evaluate(()=>({best:(document.querySelector('.ps-best')||{innerText:''}).innerText,run:(document.querySelector('.ps-run')||{innerText:''}).innerText,dry:(document.querySelector('.ps-dry')||{innerText:''}).innerText,fin:(document.querySelector('.ps-fin')||{innerText:''}).innerText,bars:[...document.querySelectorAll('.ps-bar:not(.low)')].map(b=>[b.dataset.k,b.querySelector('.ps-v').textContent.trim()]),tw:(document.querySelector('.ps-tw')||{innerText:''}).innerText}));
 const bm=/best match by PitchAPI's rating: ([\d.]+) on ([\d-]+), (at home to|away at) (.+?): his team/.exec(st.best);
 if(bm)ok(wrTexts['His best match']&&wrTexts['His best match'].includes(bm[1])&&wrTexts['His best match'].includes(bm[3]==='at home to'?'at home to '+bm[4]:'away at '+bm[4]),'the best match agrees with the Player story ('+bm[1]+' '+bm[3]+' '+bm[4]+')');else ok(!wrTexts['His best match'],'no rating, no best-match slide');
 const rm=/in (\d+) matches in a row/.exec(st.run),dm=/(\d+) matches without a goal or an assist/.exec(st.dry);
 ok(rm?wrTexts['Runs']&&wrTexts['Runs'].includes(rm[1]):true,'the best run agrees with the Player story ('+(rm?rm[1]:'none')+')');ok(dm?wrTexts['Runs']&&wrTexts['Runs'].includes(dm[1]):true,'the current run without a goal or an assist agrees ('+(dm?dm[1]:'none')+')');
 if(st.bars.length){const v=st.bars.map(x=>x[1]);ok(wrTexts['Where he stands']&&v.every(x=>wrTexts['Where he stands'].includes(x)),'the three percentiles agree with the Player story ('+v.join(', ')+')')}
 const tm=/Most like him: (.+?) \(.*similarity ([\d.]+) out of 100/.exec(st.tw);if(tm)ok(wrTexts['Most like him']&&wrTexts['Most like him'].includes(tm[1])&&wrTexts['Most like him'].includes(tm[2]),'the most similar player agrees with the Player story ('+tm[1]+' '+tm[2]+')');
 ok(!errs.length,'player: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* reduced motion: the numbers are there at once */
 ({ctx,pg,errs}=await T.open(b,{vw:520,league:LG,hash:'#/wrapped'}));await pg.emulateMedia({reducedMotion:'reduce'});await pg.waitForSelector('#wrst svg',{timeout:90000});await pg.selectOption('#wrc','Arsenal');await pg.waitForTimeout(700);await pg.click('#wrpg .wr-seg[data-i="1"]');await pg.waitForTimeout(60);
 {const E2=clubWant(LG,'Arsenal');ok((await texts(pg)).includes(String(E2.w))&&await pg.$eval('#wrsv .wr-in',e=>getComputedStyle(e).animationName==='none'),'reduced motion: the numbers are final at once and nothing animates')}await ctx.close();
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/wrapped'}));await pg.waitForSelector('#wrst svg',{timeout:90000});await pg.waitForTimeout(800);
  ok(await T.noscroll(pg)&&await pg.$eval('#wrst',e=>e.getBoundingClientRect().width<=390),lang+' phone: the slide fits, no horizontal scroll');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#app','select,option,.fx-en,bdi,svg')`);ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/ملخّص الموسم/.test(await pg.textContent('#app h2')),'Arabic title');
   const t1=await titles(pg);ok(t1[0]==='موسمك'&&t1.includes('الحصيلة'),'Arabic slide names ('+t1.slice(0,3).join('، ')+')');
   const N2=t1.length,box2=await pg.$eval('#wrst',e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}});
   await pg.focus('#wrst');await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(150);ok(+await pg.$eval('#wrsv',e=>e.dataset.i)===1,'Arabic: the left arrow goes forward');
   await pg.mouse.click(box2.x+box2.w*.12,box2.y+box2.h*.5);await pg.waitForTimeout(150);ok(+await pg.$eval('#wrsv',e=>e.dataset.i)===2,'Arabic: a tap on the left part goes forward');
   await pg.mouse.move(box2.x+box2.w*.3,box2.y+box2.h*.5);await pg.mouse.down();await pg.mouse.move(box2.x+box2.w*.8,box2.y+box2.h*.5,{steps:6});await pg.mouse.up();await pg.waitForTimeout(150);ok(+await pg.$eval('#wrsv',e=>e.dataset.i)===3,'Arabic: a swipe to the right goes forward');
   let bad=[];for(let i=0;i<N2;i++){await goSlide(pg,i);const l=await layout(pg);if(l.length)bad.push(i+': '+l.slice(0,2).join(' ; '))}ok(!bad.length,'Arabic: no text overlaps another or leaves the slide '+bad.slice(0,2).join(' | '))}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/wr_390_'+lang+'.png',fullPage:false});await ctx.close()}
 /* leaving early, failing files */
 {const c2=await b.newContext();await c2.route(/_pl_?\w*\.json|_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/wrapped');await p2.waitForSelector('#wrroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#wrroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 {const c3=await b.newContext();let fail=true;const lf=IDX(LG).sh_file;await c3.route(new RegExp(lf.replace(/\./g,'\\.')),r=>{if(fail)r.fulfill({status:500,body:''});else r.continue()});const p3=await c3.newPage();await p3.goto('http://127.0.0.1:8765/index.html#/wrapped');
  await p3.waitForSelector('#wrbody .empty:not(.skel), #wrroot > .empty:not(.skel)',{timeout:90000});const msg=await p3.textContent('#wrroot');fail=false;await p3.evaluate(()=>{location.hash='#/table'});await p3.waitForSelector('.lt',{timeout:60000});await p3.evaluate(()=>{location.hash='#/wrapped'});await p3.waitForSelector('#wrst svg',{timeout:90000});
  ok(/could not be loaded|not available/.test(msg)&&!!(await p3.$('#wrst svg')),'a failing file shows a message and is loaded again on the next visit');await c3.close()}
 await T.done(b)})();
