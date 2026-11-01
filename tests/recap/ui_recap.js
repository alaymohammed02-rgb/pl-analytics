/* Full-time story (assets/recap.js, #/recap/<match id>): the page is drawn from data/story.json, and this test checks it against the shot files with a loop of
   its own: the score, the goals on the curve (minute and side, own goals for the other side), the two xG numbers, the end of the curve (the real result), the
   verdict word and the sentences verbatim; a win, a draw with goals and a 0-0; the saved picture is a real 1080 x 1350 PNG; a match not in the open league, one
   not played yet and one without a story; the placeholder file, an unreadable file and a slow one that is left before it arrives; the link in the Match centre;
   a past season; Arabic and a 390 px phone. */
const T=require('../nf/lib.js');const {ok,J}=T;
const LG='l_4WFCIZ';
const S=J('story.json');
const LGF=J(LG+'.json'),SH=J(LG+'_sh.json');
const C={};SH.cols.forEach((n,i)=>C[n]=i);
/* goals and xG of one match from the shot file, a loop of the test's own */
function truth(mid){const m=LGF.matches.find(x=>x.i===mid);const g=[],x=[0,0];
 for(const r of SH.rows){if(r[C.m]!==mid)continue;const side=r[C.c]===m.h?0:1;
  if(!r[C.og]&&r[C.xg]!=null)x[side]+=r[C.xg];
  if(r[C.ev]==='Goal'){const s=r[C.og]?1-side:side;g.push([Math.round(r[C.mn]),s?'a':'h'])}}
 g.sort((a,b)=>a[0]-b[0]||(a[1]<b[1]?-1:1));return {m,g,x}}
const ids=Object.keys(S.m).filter(k=>S.m[k].lg===LG&&S.m[k].c);
const pick=f=>ids.find(k=>f(S.m[k]));
const picks={win:pick(e=>e.vs==='h'&&e.vd==='deserved'),away:pick(e=>e.vs==='a'&&e.g.length>=2),draw:pick(e=>e.vs==='d'&&e.g.length>=2),nil:pick(e=>e.s==='0-0'),lucky:pick(e=>e.vd==='lucky')};
const gKey=g=>g.map(x=>x[0]+x[1]).sort().join();
async function page(pg){await pg.waitForSelector('.rc-sc, #rc .empty:not(.skel)',{timeout:60000});await pg.waitForTimeout(200)}
(async()=>{const b=await T.launch();
 ok(Object.keys(S.m).length>=50,'the story file has '+Object.keys(S.m).length+' stories (a placeholder would fail here)');
 ok(Object.values(picks).every(Boolean),'a win, an away win, a draw with goals, a 0-0 and a lucky win are in the Premier League stories: '+JSON.stringify(picks));
 for(const [name,id] of Object.entries(picks)){
  const e=S.m[id],W=truth(id),{ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/recap/'+id});await page(pg);
  const [a,z]=e.s.split('-');
  ok((await pg.innerText('.rc-sc')).replace(/\s+/g,'')===a+'–'+z&&W.m.s===e.s,name+' '+id+': the score '+e.s+' is the league file\'s');
  ok(await pg.$eval('.rc-vd',x=>x.dataset.vd)===e.vd,name+': verdict "'+e.vd+'"');
  const en=await pg.$$eval('.rc-s .fx-en',a=>a.map(x=>x.textContent)),ar=await pg.$$eval('.rc-s .fx-ar',a=>a.map(x=>x.textContent));
  ok(JSON.stringify(en)===JSON.stringify(e.tx.en.filter(Boolean))&&JSON.stringify(ar)===JSON.stringify(e.tx.ar.filter(Boolean)),name+': the sentences are the file\'s, verbatim ('+en.length+' sentence'+(en.length>1?'s':'')+')');
  const goals=await pg.$$eval('.rc-g',a=>a.map(x=>[+x.dataset.m,x.dataset.s]));
  ok(gKey(goals)===gKey(W.g)&&goals.length===(+a)+(+z),name+': '+goals.length+' goals on the curve, minutes and sides equal the shot file\'s');
  const xs=await pg.$$eval('.rc-xr b',a=>a.map(x=>+x.textContent));
  ok(xs.length===2&&Math.abs(xs[0]-W.x[0])<0.006&&Math.abs(xs[1]-W.x[1])<0.006,name+': xG '+xs.join(' / ')+' = the shots\' '+W.x.map(v=>v.toFixed(2)).join(' / '));
  const end=await pg.evaluate(()=>{const s=document.querySelector('#rcsvg'),T=+s.dataset.t,H=+s.dataset.h;const last=id=>{const p=document.querySelector(id).getAttribute('points').split(' ').map(q=>q.split(',').map(Number));return p};
   const hb=last('#rc-bh'),db=last('#rc-bd');const n=hb.length/2;const ph=1-(hb[n-1][1]-T)/H,pdTop=1-(db[n-1][1]-T)/H;return [ph,pdTop-ph,hb[n-1][0]]});
  const want=(+a>+z)?[1,0]:(+a===+z)?[0,1]:[0,0];
  ok(Math.abs(end[0]-want[0])<0.002&&Math.abs(end[1]-want[1])<0.002,name+': the curve ends on the real result (home '+end[0].toFixed(3)+', draw '+end[1].toFixed(3)+')');
  const firstX=await pg.evaluate(()=>{const p=document.querySelector('#rc-bh').getAttribute('points').split(' ')[0].split(',');const s=document.querySelector('#rcsvg');return +p[0]===+s.dataset.l});
  ok(firstX,name+': the curve starts at minute 0');
  ok(e.tp?await pg.$$eval('.rc-tpc',a=>a.length===1&&true)&&(await pg.$eval('.rc-tpc',x=>+x.dataset.m))===e.tp.m:await pg.$$eval('.rc-tpc',a=>a.length===0),name+': the turning point '+(e.tp?'(minute '+e.tp.m+') is ringed':'is absent as in the file'));
  ok(await T.noscroll(pg),name+': no horizontal scroll');
  if(name==='win'){
   const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('#rcsave')]);const buf=require('fs').readFileSync(await dl.path());
   ok(/^recap-card-/.test(dl.suggestedFilename())&&buf.slice(0,8).toString('hex')==='89504e470d0a1a0a'&&buf.readUInt32BE(16)===1080&&buf.readUInt32BE(20)===1350&&buf.length>20000,'the save button gives a real PNG, 1080 x 1350 ('+dl.suggestedFilename()+', '+Math.round(buf.length/1024)+' KB)');
   const hrefs=await pg.$$eval('.rc-sv a',a=>a.map(x=>x.getAttribute('href')));ok(hrefs.includes('#/match/'+id),'a link back to the Match centre');
   const notes=await pg.innerText('.rc-ac');ok(notes.includes(String(S.acc.n))&&notes.includes(S.acc.brier_chances.toFixed(3))&&notes.includes(S.acc.brier_rates.toFixed(3)),'the note prints the file\'s numbers (n '+S.acc.n+', Brier '+S.acc.brier_chances.toFixed(3)+' against '+S.acc.brier_rates.toFixed(3)+')')}
  ok(!errs.length,name+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* a match with no curve (no Elo prediction) shows the verdict and says so */
 {const nc=Object.keys(S.m).find(k=>S.m[k].lg===LG&&!S.m[k].c);
  if(nc){const {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/recap/'+nc});await page(pg);ok(!(await pg.$('#rcsvg'))&&/no pre-match prediction/.test(await pg.innerText('.rc-cv .empty'))&&!!(await pg.$('.rc-v')),'no Elo prediction: the verdict is there, the curve says why it is missing');ok(!errs.length,'no page errors');await ctx.close()}
  else ok(true,'(every Premier League story has a curve today: the no-curve case is covered by the sync test)')}
 /* not in the open league / not played / no story */
 {const {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/recap/nope'});await pg.waitForSelector('#app .empty',{timeout:60000});
  ok(/not in the open league/.test(await pg.innerText('#app .empty')),'a match that is not in the league says so');
  const un=LGF.matches.find(m=>!/^\d+-\d+$/.test(String(m.s||'')));
  if(un){await pg.goto(pg.url().split('#')[0]+'#/recap/'+un.i);await pg.waitForSelector('#app .empty a[href^="#/preview/"]',{timeout:30000});ok(true,'a match not played yet links to its preview')}
  const nos=LGF.matches.find(m=>/^\d+-\d+$/.test(String(m.s||''))&&!S.m[m.i]);
  if(nos){await pg.goto(pg.url().split('#')[0]+'#/recap/'+nos.i);await page(pg);ok(/no story for this match/.test(await pg.innerText('#rc .empty')),'a finished match without a story says so ('+nos.i+')')}
  else ok(true,'(every finished Premier League match has a story)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* the placeholder, an unreadable file, a slow file left early */
 for(const [label,fn,re] of [['the placeholder file',r=>r.fulfill({status:200,contentType:'application/json',body:'{"t":"","m":{}}'}),/no story for this match/],['an unreadable file',r=>r.fulfill({status:503,body:'x'}),/could not be loaded/],['a file that is not an object',r=>r.fulfill({status:200,contentType:'application/json',body:'[1,2]'}),/could not be loaded/]]){
  const {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:''});await ctx.route(/\/story\.json/,fn);await pg.goto(pg.url().split('#')[0]+'#/recap/'+picks.win);await page(pg);
  ok(re.test(await pg.innerText('#rc .empty')),label+': '+re+' and no curve');ok(!errs.length,label+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {const {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:''});await ctx.route(/\/story\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});
  await pg.goto(pg.url().split('#')[0]+'#/recap/'+picks.win);await pg.waitForTimeout(400);await pg.evaluate(()=>{location.hash='#/table'});await pg.waitForTimeout(3500);
  ok(!errs.length&&!(await pg.$('.rc-sc')),'leaving before the file arrives: no draw on the other page, no errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* the Match centre link */
 {const {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/match/'+picks.win});await pg.waitForSelector('.rc-go',{timeout:60000});
  ok(await pg.$eval('.rc-go',a=>a.getAttribute('href'))==='#/recap/'+picks.win,'the Match centre of a story match links to its recap');
  const nos=LGF.matches.find(m=>/^\d+-\d+$/.test(String(m.s||''))&&!S.m[m.i]);
  if(nos){await pg.evaluate(h=>{location.hash=h},'#/match/'+nos.i);await pg.waitForSelector('#mc .mc-foot',{timeout:60000});await pg.waitForTimeout(1500);ok(!(await pg.$('.rc-go')),'no link for a match without a story')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* a past season */
 {const {ctx,pg,errs}=await T.open(b,{vw:1100,league:LG,hash:'#/recap/'+picks.win,init:{season:'2025-26'}});await pg.waitForSelector('.psna',{timeout:60000});
  ok(/Not available for a past season/.test(await pg.innerText('.psna')),'a past season says the story is not available');ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* Arabic and the phone */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/recap/'+picks.lucky});await page(pg);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  const vis=await pg.$$eval('.rc-s',a=>a.map(x=>[...x.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.className+':'+c.textContent)));
  ok(vis.every(v=>v.length===1&&v[0].startsWith(lang==='ar'?'fx-ar':'fx-en')),lang+' phone: only the '+lang+' sentence is shown');
  if(lang==='ar'){ok(await pg.$$eval('.rc-v .fx-ar bdi',a=>a.length>=1),'Arabic: team names are wrapped in <bdi>');ok(/قصة المباراة/.test(await pg.textContent('#app h2')),'Arabic: title');
   const u=await pg.evaluate(T.untr,'#rc');ok(!u.length,'Arabic: nothing left untranslated '+u.slice(0,4).join(' | '));
   const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('#rcsave')]);ok(require('fs').readFileSync(await dl.path()).slice(0,8).toString('hex')==='89504e470d0a1a0a','Arabic: the saved picture is a PNG too')}
  ok(await pg.$eval('#rcsvg',s=>s.getBoundingClientRect().width)<=358,lang+' phone: the curve fits the screen');
  ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#rc')),lang+' phone: no template leftovers');
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/recap_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
