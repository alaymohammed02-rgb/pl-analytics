/* Guess the player (assets/guess-player.js). The puzzle's answer is worked out here with a generator and a list of candidates of the test's own (the 250 most valuable players of
   the six leagues by data/tm.json, sorted by value then id, one entry per player id; without that file the 250 with most minutes) and compared with the player the page reveals;
   the clues are recomputed from the league's player rows (minutes, matches, goals, assists, per-90 shots, key passes and tackles plus interceptions; position, age under a fixed
   clock, league, club). Also: one clue more after each wrong guess, six guesses, a win (score, squares, share text, saved result), the same day again, the streak over three days and a gap, the suggestions
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
 ok((await shown(pg)).join()==='1','at the start only the first clue is open');
 {const t=numbers(A1),c1=await txt(pg,'.gp-c[data-k="1"]');ok(c1.includes(t.mi+' minutes in '+t.m+' matches')&&c1.includes(t.gl+' goals')&&c1.includes(t.ast+' assists'),'clue 1: '+c1.replace('Season numbers',''))}
 /* wrong guesses: pick players that are not the answer */
 const wrong=P.filter(p=>p.id!==A1.id&&p.mi>800).slice(0,8);
 for(let i=0;i<3;i++){ok(await guessByName(pg,wrong[i]),'guess '+(i+1)+': '+wrong[i].name+' is offered by the suggestions');ok((await shown(pg)).length===i+2,'after '+(i+1)+' wrong guess(es) '+(i+2)+' clues are open')}
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
  ok((await shown(pg)).length===6,'all six clues are open at the end');
  const t=numbers(A1),n90=t.mi/90,per=v=>(v/n90).toFixed(2);
  ok((await txt(pg,'.gp-c[data-k="2"]')).includes('Shots '+per(t.sh)+' · key passes '+per(t.kp)+' · tackles + interceptions '+per(t.tk+t.ic)),'clue 2: per-90 shots, key passes, tackles + interceptions recomputed');
  const c3=await txt(pg,'.gp-c[data-k="3"]');ok(c3.includes(POS[A1.pos]||'Position unknown')&&(A1.dob?c3.includes(ageAt(A1.dob,D1)+' years'):!/years/.test(c3)),'clue 3: '+c3.replace('Position and age',''));
  ok((await txt(pg,'.gp-c[data-k="4"]')).includes(A1.lgn)&&(await txt(pg,'.gp-c[data-k="6"]')).includes(A1.club),'clues 4 and 6: league '+A1.lgn+' and club '+A1.club);
  ok(/Not known in the data|[A-Za-z]/.test(await txt(pg,'.gp-c[data-k="5"]')),'clue 5: nationality (or "not known")');
  ok(/Not found in six guesses/.test(await txt(pg,'#gpsq'))&&(await txt(pg,'#gpsq')).endsWith('🟥🟥🟥🟥🟥🟥'),'six red squares and "Not found in six guesses"')}
 {const st=await pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_gp')));ok(st.days[D1]&&st.days[D1].done&&!st.days[D1].won&&st.days[D1].g.length===6,'the result is saved in this browser (plx_gp)')}
 /* the same day again: still finished */
 await go(pg,D1);ok(!!(await pg.$('#gpend'))&&!(await pg.$('#gpq'))&&(await txt(pg,'#gpend h3'))==='It was '+A1.name,'the same day again shows the finished game');
 /* practice mode leaves the day alone */
 {const before=await pg.evaluate(()=>localStorage.getItem('plx_gp'));await pg.click('#gppl');await pg.waitForSelector('#gpq',{timeout:20000});
  ok(/Practice/.test(await txt(pg,'.gp-h'))&&(await shown(pg)).length===1,'"Play another": a practice game with one clue open');
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
  await guessByName(pg,wrong[0]);ok((await shown(pg)).length===2,lang+' phone: a wrong guess opens the second clue');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/خمّن اللاعب/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')
   for(let i=1;i<6;i++)await guessByName(pg,wrong[i]);ok(/ما انلقى في ست محاولات/.test(await pg.innerText('#gpend'))&&(await pg.$eval('#gpend h3',e=>e.textContent)).includes(A1.name),'Arabic: the end card with the player\'s name in Latin letters')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
