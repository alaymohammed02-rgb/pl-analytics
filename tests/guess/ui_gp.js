/* Guess the player (assets/guess-player.js). The puzzle's answer is worked out here with a generator and a list of candidates of the test's own (the 250 most valuable players of
   the six leagues by data/tm.json, sorted by value then id, one entry per player id; without that file the 250 with most minutes) and compared with the player the page reveals;
   the clues are recomputed from the league's player rows, line-ups and ratings (season numbers, per-90 figures, how he plays, starts and bench with his shirt number, goals against xG,
   ratings, position and age under a fixed clock, birthday month / weekday / star sign, league, band of value, club, the shape of his name; a clue without its data is left out).
   Also: the clues open in steps (ceil(clues x guesses so far / 6)) and all are open at the end, easy mode (league, club, players) gives the same game, six guesses, a win (score, squares, share text, saved result), the same day again, the streak over three days and a gap, the suggestions
   (at most 8, accents and case ignored, no player twice, one per player id), practice mode outside the streak, no value file, a failing player file, leaving early, Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J,IDX,DOM}=T;const fs=require('fs');
const TM=J('tm.json').p;
const LG6=IDX.leagues.filter(DOM);
const fold=s=>String(s||'').toLowerCase().replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/ß/g,'ss').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function rng(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}let a=h;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
/* every player of the six leagues: one entry per id with the most minutes */
function pool(){const m=new Map(),nm={};
 for(const l of LG6){const d=J(l.pl_file),ix={};d.cols.forEach((c,i)=>ix[c]=i);const A=new Map();
  for(const r of d.rows){const mi=r[ix.mi];if(mi==null)continue;let a=A.get(r[ix.i]);if(!a){a={id:r[ix.i],name:r[ix.n],club:r[ix.c],pos:{},mi:0};A.set(r[ix.i],a)}a.mi+=mi;a.club=r[ix.c]||a.club;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi}
  for(const a of A.values()){let pos=null,b=-1;for(const p in a.pos)if(a.pos[p]>b){b=a.pos[p];pos=p}
   const e={key:l.id+'|'+a.id,id:a.id,name:a.name||'?',club:a.club||'',lg:l.id,lgn:l.name,pos,mi:a.mi,val:TM[a.id]?TM[a.id][1]:null,dob:TM[a.id]?TM[a.id][0]:null};
   const q=m.get(a.id);if(!q||e.mi>q.mi||(e.mi===q.mi&&e.key<q.key))m.set(a.id,e)}}
 return [...m.values()]}
const P=pool();
function answer(date,useVal){const list=useVal?P.filter(p=>p.val!=null).sort((a,b)=>b.val-a.val||(a.id<b.id?-1:1)).slice(0,250):P.slice().sort((a,b)=>b.mi-a.mi||(a.id<b.id?-1:1)).slice(0,250);return list[Math.floor(rng('guess|'+date)()*list.length)]}
function numbers(p){const l=LG6.find(x=>x.id===p.lg),d=J(l.pl_file),ix={};d.cols.forEach((c,i)=>ix[c]=i);const t={mi:0,gl:0,ast:0,sh:0,kp:0,tk:0,ic:0,m:0};
 for(const r of d.rows){if(r[ix.i]!==p.id||!r[ix.mi])continue;t.m++;t.mi+=r[ix.mi];for(const k of ['gl','ast','sh','kp','tk','ic'])t[k]+=r[ix[k]]||0}return t}
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'],WD=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SG=[[119,'Capricorn'],[218,'Aquarius'],[320,'Pisces'],[419,'Aries'],[520,'Taurus'],[620,'Gemini'],[722,'Cancer'],[822,'Leo'],[922,'Virgo'],[1022,'Libra'],[1121,'Scorpio'],[1221,'Sagittarius'],[1231,'Capricorn']];
/* the answer's numbers beyond the player rows: starts and bench from the line-ups, shirt, ratings */
function extra(p){const l=LG6.find(x=>x.id===p.lg),d=J(l.pl_file),ix={};d.cols.forEach((c,i)=>ix[c]=i);const mx=l.mx_file?J(l.mx_file).m:{},st=new Set(),lu=new Set(),shirt={};
 for(const mid in mx){const u=mx[mid].lu||{};let g=false;for(const s of ['h','a'])for(const x of ((u[s]||{}).xi)||[]){g=true;st.add(mid+'|'+x[0]);if(x[0]===p.id&&x[2])shirt[x[2]]=(shirt[x[2]]||0)+1}if(g)lu.add(mid)}
 const rt=l.rt_file?J(l.rt_file).m:{};const o={st:0,sb:0,rt:[],xg:0,pr:0,tkw:0,aerw:0,cl:0,act:0,aco:0,shirt:Object.entries(shirt).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))[0]};
 for(const r of d.rows){if(r[ix.i]!==p.id||!r[ix.mi])continue;for(const k of ['xg','pr','tkw','aerw','cl','act','aco'])o[k]+=r[ix[k]]||0;
  if(lu.has(r[ix.m])){if(st.has(r[ix.m]+'|'+p.id))o.st++;else o.sb++}const v=rt[r[ix.m]]&&rt[r[ix.m]][p.id];if(v!=null)o.rt.push(v)}
 return o}
const BANDS=[1,5,10,20,35,50,75,100];
const bandText=v=>{let i=0;while(i<BANDS.length&&v>=BANDS[i]*1e6)i++;return i===0?'Under €'+BANDS[0]+'m':i===BANDS.length?'€'+BANDS[i-1]+'m or more':'Between €'+BANDS[i-1]+'m and €'+BANDS[i]+'m'};
/* the ids of the clues the page should offer for a player, in order */
function clueIds(p,t,x){const ids=['season','p90'];if(x.act>0)ids.push('style');if(x.st+x.sb>=3)ids.push('starts');if(x.xg>0)ids.push('luck');if(x.rt.length>=3)ids.push('rating');ids.push('posage');if(p.dob)ids.push('born');ids.push('league','nat');if(p.val!=null)ids.push('value');ids.push('club','name');return ids}
const ageAt=(dob,date)=>{const [y,m,d]=dob.split('-').map(Number),t=new Date(date+'T12:00:00Z');return t.getFullYear()-y-((t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))?1:0)};
const POS={GK:'Goalkeeper',DF:'Defender',MF:'Midfielder',FW:'Forward'};
async function open(b,o){const r=await T.open(b,{...o,hash:'#/table'});await r.pg.waitForSelector('#app h2',{timeout:60000});return r}
async function go(pg,date,hash='#/guess'){await pg.clock.setFixedTime(new Date(date+'T12:00:00Z'));await pg.evaluate(()=>{location.hash='#/table'});await pg.waitForSelector('#app h2',{timeout:30000});await pg.waitForTimeout(150);await pg.evaluate(h=>{location.hash=h},hash);await pg.waitForSelector('#gpb',{timeout:90000});await pg.waitForTimeout(200)}
const shown=pg=>pg.$$eval('.gp-c.on',a=>a.map(x=>x.dataset.k));
const txt=(pg,s)=>pg.$eval(s,e=>{const c=e.cloneNode(true);c.querySelectorAll('.fx-ar').forEach(x=>x.remove());return c.textContent.replace(/[⁦-⁩‎‏]/g,'').replace(/\s+/g,' ').trim()});
async function guessByName(pg,p){await pg.fill('#gpq',p.name);await pg.waitForTimeout(150);const b=await pg.$('.gp-sb[data-k="'+p.key+'"]');if(!b)return false;await b.click();await pg.waitForTimeout(150);return true}
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',D1='2026-11-02',D2='2026-11-03',D4='2026-11-05';
 ok(P.length>1500&&P.filter(p=>p.val!=null).length>250,'the reference pool: '+P.length+' players, '+P.filter(p=>p.val!=null).length+' with a value');
 let {ctx,pg,errs}=await open(b,{vw:1000,league:LG});await go(pg,D1);
 const A1=answer(D1,true),A2=answer(D2,true),A3=answer(D4,true);
 ok(new Set([A1.id,A2.id,A3.id]).size===3,'three different days give three different answers ('+[A1.name,A2.name,A3.name].join(', ')+')');
 /* the first clue only, then one more after each wrong guess */
 const X1=extra(A1),T1=numbers(A1),IDS=clueIds(A1,T1,X1),TOT=IDS.length,openAt=g=>Math.ceil(TOT*(g+1)/6);
 ok(JSON.stringify(await pg.$$eval('.gp-c',a=>a.map(x=>x.dataset.c)))===JSON.stringify(IDS)&&TOT>=10,'the clues offered for '+A1.name+' are '+IDS.join(', ')+' ('+TOT+')');
 ok((await shown(pg)).length===openAt(0)&&(await shown(pg)).join()===Array.from({length:openAt(0)},(_,i)=>i+1).join(),'at the start the first '+openAt(0)+' clues are open (the others locked)');
 {const t=numbers(A1),c1=await txt(pg,'.gp-c[data-k="1"]');ok(c1.includes(t.mi+' minutes in '+t.m+' matches')&&c1.includes(t.gl+' goals')&&c1.includes(t.ast+' assists'),'clue 1: '+c1.replace('Season numbers',''))}
 /* wrong guesses: pick players that are not the answer */
 const wrong=P.filter(p=>p.id!==A1.id&&p.mi>800).slice(0,8);
 for(let i=0;i<3;i++){ok(await guessByName(pg,wrong[i]),'guess '+(i+1)+': '+wrong[i].name+' is offered by the suggestions');ok((await shown(pg)).length===openAt(i+1),'after '+(i+1)+' wrong guess(es) '+openAt(i+1)+' clues are open')}
 ok(await pg.$$eval('.gp-g.no',a=>a.length)===3&&/3\. /.test(await txt(pg,'#gpgs')),'the three wrong guesses are listed with ✗');
 /* suggestions */
 {await pg.fill('#gpq',wrong[0].name.toUpperCase().slice(0,4));await pg.waitForTimeout(150);
  const s=await pg.$$eval('.gp-sb',a=>a.map(x=>x.dataset.k)),q=fold(wrong[0].name.toUpperCase().slice(0,4));
  ok(s.length<=8&&s.every(k=>{const p=P.find(x=>x.key===k);return p&&fold(p.name).includes(q)})&&!s.includes(wrong[0].key)&&!s.includes(wrong[1].key),'suggestions: at most 8, all contain "'+q+'" (case ignored) and the guessed players are not offered ('+s.length+')');
  ok(new Set(s.map(k=>k.split('|')[1])).size===s.length,'suggestions: one entry per player id');
  await pg.fill('#gpq','a');await pg.waitForTimeout(100);ok(await pg.$$eval('.gp-sb',a=>a.length)===0,'a single letter offers nothing');
  await pg.fill('#gpq','Mohamed Salah'.slice(0,6).replace('Mohame','Moham'));await pg.fill('#gpq','zzzzqq');await pg.waitForTimeout(100);ok(await pg.$$eval('.gp-sb',a=>a.length)===0,'a name nobody has offers nothing')}
 for(let i=3;i<6;i++){await guessByName(pg,wrong[i])}
 ok(await pg.$('#gpend')!==null&&(await pg.getAttribute('#gpend','data-won'))==='0'&&!(await pg.$('#gpq')),'six wrong guesses end the game and remove the box');
 {const h=await txt(pg,'#gpend h3');ok(h===('It was '+A1.name),'the answer is revealed: '+h+' (the test worked out '+A1.name+')');
  ok((await shown(pg)).length===TOT,'all '+TOT+' clues are open at the end');
  const t=T1,n90=t.mi/90,per=v=>(v/n90).toFixed(2),f1=v=>v.toFixed(1),f2=v=>v.toFixed(2),cx=id=>txt(pg,'.gp-c[data-c="'+id+'"]');
  ok((await cx('p90')).includes('Shots '+per(t.sh)+' · key passes '+per(t.kp)+' · tackles + interceptions '+per(t.tk+t.ic)),'per-90 shots, key passes, tackles + interceptions recomputed');
  if(X1.act>0)ok((await cx('style')).includes('progressive passes '+per(X1.pr)+' · take-ons won '+per(X1.tkw)+' · aerials won '+per(X1.aerw)+' · clearances '+per(X1.cl))&&(await cx('style')).includes(Math.round(100*X1.aco/X1.act)+'% of his actions in the opponent'),'how he plays: '+(await cx('style')).replace('How he plays',''));
  if(IDS.includes('starts')){const c=await cx('starts');ok(c.includes('Started '+X1.st+' and came off the bench '+X1.sb+' times')&&(X1.shirt?c.includes('usually wears number '+X1.shirt[0]):!/number/.test(c)),'starts '+X1.st+', bench '+X1.sb+', shirt '+(X1.shirt&&X1.shirt[0]))}
  if(IDS.includes('luck')){const d=T1.gl-X1.xg;ok((await cx('luck')).includes('Chances worth '+f1(X1.xg)+' xG, '+T1.gl+' goals scored ('+(d>=0?'+':'−')+f1(Math.abs(d))+')'),'luck: goals against xG')}
  if(IDS.includes('rating')){const av=X1.rt.reduce((x,y)=>x+y,0)/X1.rt.length,c=await cx('rating');ok(c.includes('Average '+f2(av)+' over '+X1.rt.length+' rated matches')&&c.includes('best '+f1(Math.max(...X1.rt)))&&c.includes('worst '+f1(Math.min(...X1.rt))),'ratings: '+c.replace('Match ratings',''))}
  const c3=await cx('posage');ok(c3.includes(POS[A1.pos]||'Position unknown')&&(A1.dob?c3.includes(ageAt(A1.dob,D1)+' years'):!/years/.test(c3)),'position and age: '+c3.replace('Position and age',''));
  if(A1.dob){const [y,m,d]=A1.dob.split('-').map(Number),wd=new Date(Date.UTC(y,m-1,d)).getUTCDay(),sg=SG.find(z=>m*100+d<=z[0])[1];ok((await cx('born')).includes('Born in '+MON[m-1]+', on a '+WD[wd]+' · star sign '+sg),'birthday: '+A1.dob+' -> '+MON[m-1]+', '+WD[wd]+', '+sg)}
  ok((await cx('league')).includes(A1.lgn)&&(await cx('club')).includes(A1.club),'league '+A1.lgn+' and club '+A1.club);
  ok(/Not known in the data|[A-Za-z]/.test(await cx('nat')),'nationality (or "not known")');
  if(A1.val!=null)ok((await cx('value')).includes(bandText(A1.val)),'value band: '+bandText(A1.val)+' for '+A1.val);
  {const w=fold(A1.name).split(' ').filter(Boolean),c=await cx('name');ok(c.includes(w.length+(w.length===1?' word, ':' words, ')+w.join('').length+' letters, starts with '+w[0][0].toUpperCase()),'name shape: '+c.replace('His name',''))}
  ok(/Not found in six guesses/.test(await txt(pg,'#gpsq'))&&(await txt(pg,'#gpsq')).endsWith('🟥🟥🟥🟥🟥🟥'),'six red squares and "Not found in six guesses"')}
 {const st=await pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_gp')));ok(st.days[D1]&&st.days[D1].done&&!st.days[D1].won&&st.days[D1].g.length===6,'the result is saved in this browser (plx_gp)')}
 /* the same day again: still finished */
 await go(pg,D1);ok(!!(await pg.$('#gpend'))&&!(await pg.$('#gpq'))&&(await txt(pg,'#gpend h3'))==='It was '+A1.name,'the same day again shows the finished game');
 /* practice mode leaves the day alone */
 {const before=await pg.evaluate(()=>localStorage.getItem('plx_gp'));await pg.click('#gppl');await pg.waitForSelector('#gpq',{timeout:20000});
  ok(/Practice/.test(await txt(pg,'.gp-h'))&&(await shown(pg)).length===Math.ceil(await pg.$$eval('.gp-c',a=>a.length)/6),'"Play another": a practice game with the first sixth of its clues open');
  const w=P.filter(p=>p.mi>800)[0];await guessByName(pg,w);ok((await pg.evaluate(()=>localStorage.getItem('plx_gp')))===before,'a practice guess does not touch the saved days');
  await pg.evaluate(()=>{location.hash='#/table'});await pg.waitForSelector('#app h2');await pg.evaluate(()=>{location.hash='#/guess'});await pg.waitForSelector('#gpb');ok(/Today/.test(await txt(pg,'.gp-h')),'coming back to the page opens today\'s game')}
 /* a win on day 2, a win on day 3 (streak), a gap */
 await go(pg,D2);ok(!(await pg.$('#gpend')),'the next day starts a new game');
 ok(/Streak 0 · best 0/.test(await txt(pg,'.gp-st')),'no win yet: streak 0');
 ok(await guessByName(pg,A2),'day 2: typing '+A2.name+' offers him');ok((await pg.getAttribute('#gpend','data-won'))==='1'&&/Found in 1 of 6/.test(await txt(pg,'#gpsq'))&&(await txt(pg,'#gpsq')).endsWith('🟩'),'day 2: found at the first guess (Found in 1 of 6, one green square)');
 ok((await txt(pg,'#gpend h3'))==='Yes! It is '+A2.name&&/Streak 1 · best 1/.test(await txt(pg,'.gp-st')),'day 2: "Yes! It is …" and the streak is 1');
 await pg.evaluate(()=>{window.__cp=null;navigator.clipboard.writeText=async t=>{window.__cp=t}});Object.defineProperty;await pg.evaluate(()=>{try{Object.defineProperty(navigator,'share',{value:undefined,configurable:true})}catch(e){}});
 await pg.click('#gpsh');await pg.waitForTimeout(200);
 ok((await pg.evaluate(()=>window.__cp))==='PL Analytics · Guess the player '+D2+'\n1/6 🟩'&&/Copied/.test(await txt(pg,'#gpsh')),'"Copy result" puts the short result (no names) on the clipboard');
 const D3='2026-11-04';await go(pg,D3);ok(/Streak 1 · best 1/.test(await txt(pg,'.gp-st')),'day 3 before playing: yesterday\'s win still counts (streak 1)');
 const A3b=answer(D3,true);await guessByName(pg,wrong.find(p=>p.id!==A3b.id));await guessByName(pg,A3b);ok((await pg.getAttribute('#gpend','data-won'))==='1'&&/Found in 2 of 6/.test(await txt(pg,'#gpsq'))&&/Streak 2 · best 2/.test(await txt(pg,'.gp-st')),'day 3: found at the second guess, the streak is 2');
 ok((await txt(pg,'#gpsq')).endsWith('🟥🟩'),'day 3: red then green');
 await go(pg,'2026-11-07');ok(/Streak 0 · best 2/.test(await txt(pg,'.gp-st')),'after two days without a win: streak 0, best 2');
 /* easy mode: league, club, then the club's players */
 {const D9='2026-11-09',A9=answer(D9,true);await go(pg,D9);
  const TOT9=clueIds(A9,numbers(A9),extra(A9)).length,W=wrong.find(p=>p.id!==A9.id&&p.club&&p.lg!==A9.lg)||wrong.find(p=>p.id!==A9.id);
  ok(!!(await pg.$('#gpq'))&&!(await pg.$('#gpl')),'easy mode off by default: the name box');
  await pg.click('#gpui button[data-k="list"]');await pg.waitForTimeout(150);
  ok(!!(await pg.$('#gpl'))&&!!(await pg.$('#gpc'))&&!(await pg.$('#gpq'))&&(await pg.evaluate(()=>localStorage.getItem('plx_gp_ui')))==='list'&&(await pg.getAttribute('#gpui button[data-k="list"]','aria-pressed'))==='true','"Pick from a list": league and club choices instead of the box, kept in this browser');
  ok(await pg.$$eval('.gp-sb',a=>a.length)===0&&await pg.$eval('#gpc',e=>e.disabled),'nothing is listed and the club choice is off before a league is chosen');
  const lgs=[...new Set(P.map(p=>p.lg))].sort();
  ok(JSON.stringify((await pg.$$eval('#gpl option',a=>a.map(o=>o.value).filter(Boolean))).sort())===JSON.stringify(lgs)&&lgs.length===6,'the league choice has the six leagues');
  await pg.selectOption('#gpl',W.lg);await pg.waitForTimeout(100);
  const clubs=[...new Set(P.filter(p=>p.lg===W.lg&&p.club).map(p=>p.club))].sort((a,b)=>a.localeCompare(b));
  ok(JSON.stringify(await pg.$$eval('#gpc option',a=>a.map(o=>o.value||o.textContent).slice(1)))===JSON.stringify(clubs),'after a league: its '+clubs.length+' clubs, in alphabetical order');
  await pg.selectOption('#gpc',W.club);await pg.waitForTimeout(100);
  const sq=P.filter(p=>p.lg===W.lg&&p.club===W.club).sort((a,b)=>b.mi-a.mi||(a.key<b.key?-1:1));
  ok(JSON.stringify(await pg.$$eval('.gp-sb',a=>a.map(x=>x.dataset.k)))===JSON.stringify(sq.map(p=>p.key)),'after a club: its '+sq.length+' players, the most played first ('+W.club+')');
  {const r0=await pg.$eval('.gp-sb',e=>e.textContent),p0=sq[0];ok(r0.includes(p0.name)&&r0.includes(String(p0.mi)),'each row shows the name, position and minutes: '+r0.replace(/\s+/g,' ').trim())}
  await pg.click('.gp-sb[data-k="'+W.key+'"]');await pg.waitForTimeout(200);
  ok(await pg.$$eval('.gp-g.no',a=>a.length)===1&&(await shown(pg)).length===Math.ceil(TOT9*2/6),'a wrong pick counts as a guess and opens more clues');
  ok((await pg.$eval('#gpl',e=>e.value))===W.lg&&(await pg.$eval('#gpc',e=>e.value))===W.club&&JSON.stringify(await pg.$$eval('.gp-sb',a=>a.map(x=>x.dataset.k)))===JSON.stringify(sq.filter(p=>p.id!==W.id).map(p=>p.key)),'the league and club stay chosen, and the guessed player leaves the list');
  await pg.selectOption('#gpl',A9.lg);await pg.selectOption('#gpc',A9.club);await pg.waitForTimeout(100);
  await pg.click('.gp-sb[data-k="'+A9.key+'"]');await pg.waitForTimeout(200);
  ok((await pg.getAttribute('#gpend','data-won'))==='1'&&/Found in 2 of 6/.test(await txt(pg,'#gpsq'))&&(await txt(pg,'#gpsq')).endsWith('🟥🟩'),'picking the answer from his club\'s list wins ('+A9.name+', '+A9.club+')');
  await go(pg,'2026-11-10');ok(!!(await pg.$('#gpl')),'the choice of easy mode is remembered on the next visit');
  await pg.click('#gpui button[data-k="type"]');await pg.waitForTimeout(150);ok(!!(await pg.$('#gpq'))&&!(await pg.$('#gpl')),'back to typing a name')}
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* no value file: the 250 with most minutes, and the answer is kept for the day */
 {({ctx,pg,errs}=await open(b,{vw:1000,league:LG}));await ctx.route(/tm\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"t":"","p":{}}'}));await go(pg,D1);
  const A=answer(D1,false);await pg.fill('#gpq',A.name);await pg.waitForTimeout(150);const hit=await pg.$('.gp-sb[data-k="'+A.key+'"]');
  ok(!!hit,'without the value file the answer is the player at the drawn index of the 250 with most minutes ('+A.name+')');if(hit){await hit.click();await pg.waitForTimeout(150)}
  ok((await pg.getAttribute('#gpend','data-won'))==='1'&&/no value file here/.test(await txt(pg,'#gpb .ins-note')),'it is found, and the note says there is no value file');await ctx.close()}
 /* a failing player file; leaving early */
 {const c3=await b.newContext();await c3.route(/_pl\.json/,r=>r.fulfill({status:500,body:''}));const p3=await c3.newPage(),e3=[];p3.on('pageerror',e=>e3.push(e.message));await p3.goto('http://127.0.0.1:8765/index.html#/guess');
  await p3.waitForSelector('#gproot .empty:not(.skel)',{timeout:90000});ok(/not available right now/.test(await p3.textContent('#gproot'))&&!e3.length,'a failing player file shows a message and no error');await c3.close()}
 {const c2=await b.newContext();await c2.route(/_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/guess');await p2.waitForSelector('#gproot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#gproot'))&&await p2.$('.lt')&&!e2.length,'leaving before the players arrive: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){({ctx,pg,errs}=await open(b,{vw:390,lang,league:LG}));await go(pg,D1);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('.gp-c',a=>a.every(c=>c.scrollWidth<=c.clientWidth+1)),lang+' phone: every clue fits');
  await guessByName(pg,wrong[0]);ok((await shown(pg)).length===Math.ceil(await pg.$$eval('.gp-c',a=>a.length)*2/6),lang+' phone: a wrong guess opens more clues');
  await pg.click('#gpui button[data-k="list"]');await pg.selectOption('#gpl',wrong[0].lg);await pg.selectOption('#gpc',wrong[0].club);await pg.waitForTimeout(200);
  ok(await T.noscroll(pg)&&await pg.$$eval('.gp-sb',a=>a.length>0&&a.every(c=>c.scrollWidth<=c.clientWidth+1)),lang+' phone: easy mode fits without sideways scroll');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: easy mode translated '+u.slice(0,5).join(' | '))}
  await pg.click('#gpui button[data-k="type"]');await pg.waitForTimeout(150);
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/خمّن اللاعب/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')
   for(let i=1;i<6;i++)await guessByName(pg,wrong[i]);ok(/ما انلقى في ست محاولات/.test(await pg.innerText('#gpend'))&&(await pg.$eval('#gpend h3',e=>e.textContent)).includes(A1.name),'Arabic: the end card with the player\'s name in Latin letters')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
