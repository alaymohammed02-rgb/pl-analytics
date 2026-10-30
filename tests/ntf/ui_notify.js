/* Notifications card (assets/notify.js, under "Your teams" on the Overview): for every team you starred, its ntfy topic (pla-<namespace>-<slug>) with an "Open in app"
   link (ntfy://), a web link and a button that copies the topic. The slug is checked against sync.py's own notify_slug (run here in Python) for every team of
   every league in the data, so the page and the sync always name the same topic. Also: no card without a starred team; adding and removing a team adds and removes its row;
   the same club in two leagues is listed once; the clipboard gets exactly the topic; the app-store links; no card (and no error) when data/notify.json is missing,
   fails or has no namespace; leaving before it arrives; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;const {execFileSync}=require('child_process');const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const CFG=J('notify.json');
const py=names=>JSON.parse(execFileSync('python3',['-c',`import re,json,sys,unicodedata,datetime,os
src=open(${JSON.stringify(path.join(ROOT,'sync.py'))},encoding='utf-8').read()
G={'re':re,'json':json,'unicodedata':unicodedata,'datetime':datetime,'os':os,'log':print,'run_pipeline':lambda h,k:1,'gh_get_json':None,'gh_put':None}
exec(src[src.index('# ===== NOTIFY START ====='):src.index('# ===== NOTIFY END =====')],G)
print(json.dumps({n:G['notify_slug'](n) for n in json.load(sys.stdin)}))`],{input:JSON.stringify(names)}).toString());
const IDX=J('index.json');const names=new Set();
for(const l of IDX.leagues){if(l.file&&fs.existsSync(path.join(ROOT,'data',l.file)))for(const m of (J(l.file).matches||[])){names.add(m.h);names.add(m.a)}}
const FAV=(...t)=>({plx_favs_v2:JSON.stringify({v:2,t:t.map(([l,n])=>({l,t:n}))})});
const rows=pg=>pg.$$eval('.ntf-r',a=>a.map(r=>({t:r.dataset.t,topic:r.dataset.topic,app:r.querySelector('.ntf-a').getAttribute('href'),web:r.querySelector('.ntf-w').getAttribute('href'),copy:r.querySelector('.ntf-c').dataset.topic})));
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',LL='l_0ErfuF';
 /* the namespace file */
 ok(/^[0-9a-f]{12}$/.test(CFG.ns)&&CFG.server==='https://ntfy.sh','data/notify.json: namespace '+CFG.ns+' on '+CFG.server);
 /* a team of every league: topic = pla-<ns>-<slug from Python> */
 const picks=[[LG,'Arsenal'],[LL,'Atlético Madrid'],[LG,'Brighton & Hove Albion']];
 let {ctx,pg,errs}=await T.open(b,{vw:1100,lang:'en',league:LG,hash:'#/overview',init:FAV(...picks)});await pg.waitForSelector('#ntfcard .ntf-r',{timeout:90000});await pg.waitForTimeout(400);
 const want=py(picks.map(p=>p[1])),got=await rows(pg);
 ok(got.length===3&&picks.every(([,n],i)=>got[i].t===n&&got[i].topic==='pla-'+CFG.ns+'-'+want[n]),'a row for each starred team, in order, with the topic pla-<namespace>-<slug>: '+got.map(g=>g.topic.slice(4+CFG.ns.length)).join(', '));
 ok(got.every(g=>g.app==='ntfy://ntfy.sh/'+g.topic&&g.web==='https://ntfy.sh/'+g.topic&&g.copy===g.topic),'each row has the ntfy:// link, the ntfy.sh page and the topic to copy, all the same topic');
 ok(got[2].topic==='pla-'+CFG.ns+'-brighton-hove-albion'&&got[1].topic==='pla-'+CFG.ns+'-atletico-madrid','"&" and the accent are folded (brighton-hove-albion, atletico-madrid)');
 ok(await pg.$eval('#ntfcard',e=>!!e.closest('.ovt')&&e.classList.contains('card')),'the card sits inside the "Your teams" section');
 ok(await pg.$$eval('.ntf-st',a=>a.length===3&&a.every(x=>x.target==='_blank'&&/noopener/.test(x.rel)&&/^https:\/\//.test(x.href))&&/play.google.com/.test(a[0].href)&&/apps.apple.com/.test(a[1].href)),'the Android, iPhone and F-Droid links open in a new tab, over https');
 ok(/final score/.test(await pg.innerText('#ntfcard p'))&&/not goal-by-goal|not goal/.test(await pg.innerText('#ntfcard p')),'the card says what arrives (final score, reminder) and that it is not goal by goal');
 /* the topic is what the clipboard gets */
 await ctx.grantPermissions(['clipboard-read','clipboard-write']);
 await pg.click('.ntf-r[data-t="Arsenal"] .ntf-c');await pg.waitForTimeout(200);
 ok(await pg.evaluate(()=>navigator.clipboard.readText())==='pla-'+CFG.ns+'-arsenal'&&/Copied/.test(await pg.innerText('.ntf-r[data-t="Arsenal"] .ntf-c')),'"Copy topic" puts exactly the topic on the clipboard and says Copied');
 await pg.waitForTimeout(1900);ok(/Copy topic/.test(await pg.innerText('.ntf-r[data-t="Arsenal"] .ntf-c')),'and goes back to "Copy topic" after a moment');
 /* removing and adding a team changes the rows */
 await pg.click('.ovt-x[data-x="Arsenal"]');await pg.waitForTimeout(700);
 ok((await rows(pg)).map(r=>r.t).join('|')==='Atlético Madrid|Brighton & Hove Albion','removing a team removes its row');
 await pg.selectOption('#ovtt','Chelsea');await pg.click('#ovta');await pg.waitForTimeout(900);
 {const r=await rows(pg),w=py(['Chelsea']);ok(r.length===3&&r.some(x=>x.t==='Chelsea'&&x.topic==='pla-'+CFG.ns+'-'+w.Chelsea),'adding Chelsea adds its row')}
 for(const t of ['Atlético Madrid','Brighton & Hove Albion','Chelsea']){await pg.click('.ovt-x[data-x="'+t.replace(/"/g,'\\"')+'"]');await pg.waitForTimeout(500)}
 ok(!(await pg.$('#ntfcard')),'with no starred team there is no card');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* the same club in two leagues is one row */
 ({ctx,pg,errs}=await T.open(b,{vw:1100,lang:'en',league:LG,hash:'#/overview',init:FAV([LG,'Arsenal'],[LL,'Arsenal'])}));await pg.waitForSelector('#ntfcard .ntf-r',{timeout:90000});
 ok((await rows(pg)).length===1,'a club starred twice (or in two competitions) has one row');await ctx.close();
 /* the page and the sync name every team the same way */
 {({ctx,pg}=await T.open(b,{vw:1100,lang:'en',league:LG,hash:'#/overview'}));await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForFunction(()=>typeof INS==='object'&&typeof INS.notifySlug==='function',null,{timeout:60000});
  const all=[...names],want=py(all),mine=await pg.evaluate(a=>a.map(n=>INS.notifySlug(n)),all);const bad=all.filter((n,i)=>mine[i]!==want[n]);
  ok(all.length>100&&!bad.length,'the slug in the page equals sync.py\'s for all '+all.length+' teams of every league in the data'+(bad.length?' — differs for '+bad.slice(0,5).join(', '):''));await ctx.close()}
 /* the file is missing, fails, or has no namespace: no card, no error */
 for(const [what,fn] of [['fails (500)',r=>r.fulfill({status:500,body:''})],['has no namespace',r=>r.fulfill({status:200,contentType:'application/json',body:'{"v":1,"ns":"","server":"https://ntfy.sh"}'})],['is not JSON',r=>r.fulfill({status:200,contentType:'application/json',body:'not json'})]]){
  const c=await b.newContext({viewport:{width:1100,height:900}});await c.addInitScript(([k,v])=>{localStorage.setItem('lang','en');localStorage.setItem('league','l_4WFCIZ');localStorage.setItem(k,v)},['plx_favs_v2',FAV([LG,'Arsenal']).plx_favs_v2]);
  await c.route(/notify\.json/,fn);const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/overview');await p.waitForSelector('.ovt',{timeout:90000});await p.waitForTimeout(1500);
  ok(!(await p.$('#ntfcard'))&&!!(await p.$('.ovt-c'))&&!e.length,'notify.json '+what+': the card is not shown, "Your teams" still is, no error');await c.close()}
 /* leaving before the file arrives */
 {const c=await b.newContext({viewport:{width:1100,height:900}});await c.addInitScript(k=>{localStorage.setItem('lang','en');localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('plx_favs_v2',k)},FAV([LG,'Arsenal']).plx_favs_v2);
  await c.route(/notify\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/overview');await p.waitForSelector('.ovt',{timeout:90000});
  await p.evaluate(()=>location.hash='#/table');await p.waitForSelector('.lt',{timeout:60000});await p.waitForTimeout(3500);ok(!(await p.$('#ntfcard'))&&await p.$('.lt')&&!e.length,'leaving before notify.json arrives: no card on the next page, no error');await c.close()}
 /* Arabic and a phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/overview',init:FAV(...picks)}));await pg.waitForSelector('#ntfcard .ntf-r',{timeout:90000});await pg.waitForTimeout(500);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('.ntf-r',a=>a.every(r=>r.scrollWidth<=r.clientWidth+1&&[...r.querySelectorAll('a,button')].every(x=>x.getBoundingClientRect().right<=innerWidth+1&&x.getBoundingClientRect().left>=-1))),lang+' phone: the three buttons of each team fit the screen');
  ok((await rows(pg)).length===3,lang+' phone: three rows');
  if(lang==='ar'){const u=await pg.evaluate(`(${T.untr})('#ntfcard','select,option,.fx-en,bdi')`);ok(!u.length,'Arabic: card translated '+u.slice(0,4).join(' | '));ok(/إشعارات فرقك/.test(await pg.innerText('#ntfcard h3'))&&/افتح بالتطبيق/.test(await pg.innerText('.ntf-a')),'Arabic: title and buttons');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#ntfcard')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ntf_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
