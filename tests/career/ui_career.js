/* Player career (assets/player-career.js). The finished seasons come from data/career.json (checked against the player files by t_career.py); the test adds the season under way from the six
   leagues' current player files with its own loops and then checks, for players chosen to cover the cases (five finished seasons and this one, a move between leagues, a change of club, only
   this season, a season under 450 minutes, a season with fewer than 90 minutes of xAG): the table (every number, the order, the faded rows, "moved" and "new club"), the six charts (a dot per
   season with enough minutes, its value, hollow under 450 minutes, the line through the solid dots, the season labels), the header, the list of players on the first view (outfield players
   with 4+ seasons, most minutes), the search (names without accents, starts of words first, then minutes), Enter opening the first, the link on the player's own page, a failing career file, a
   failing current player file, an unknown id, a past season, leaving early, Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const DOMEST=l=>l&&l.file&&l.sh_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
const LGS=IDX.leagues.filter(DOMEST),C=J('career.json'),LGN=Object.fromEntries(IDX.leagues.map(l=>[l.id,l.name]));
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ø/g,'o').replace(/ł/g,'l').replace(/ß/g,'ss').toLowerCase();
const top=m=>{let b=null,v=-1;for(const k in m)if(m[k]>v||(m[k]===v&&k>b)){b=k;v=m[k]}return b};
const F=['s','lg','c','pos','g','mi','gl','ast','xg','npxg','xag','xagmi','sh','kp','tkic'];
const E=new Map(),NAMES=new Map(Object.entries(C.n));
for(const pid in C.p)E.set(pid,C.p[pid].map(r=>{const o={};F.forEach((k,i)=>o[k]=r[i]);o.lg=C.lgs[o.lg];return o}));
for(const l of LGS){const PL=J(l.pl_file),ix={};PL.cols.forEach((c,i)=>ix[c]=i);const by=new Map();
 for(const r of PL.rows){const mi=r[ix.mi];if(!mi)continue;let a=by.get(r[ix.i]);if(!a){a={club:{},pos:{},g:0,mi:0,gl:0,ast:0,xg:0,npxg:0,xag:0,xagmi:0,sh:0,kp:0,tkic:0,name:''};by.set(r[ix.i],a)}
  a.name=r[ix.n]||a.name;a.g++;a.mi+=mi;a.club[r[ix.c]]=(a.club[r[ix.c]]||0)+mi;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;a.gl+=r[ix.gl]||0;a.ast+=r[ix.ast]||0;a.xg+=r[ix.xg]||0;a.npxg+=r[ix.npxg]||0;a.sh+=r[ix.sh]||0;a.kp+=r[ix.kp]||0;a.tkic+=(r[ix.tk]||0)+(r[ix.ic]||0);if(r[ix.xag]!=null){a.xag+=r[ix.xag];a.xagmi+=mi}}
 for(const [pid,a] of by){NAMES.set(pid,a.name||NAMES.get(pid)||'?');if(!E.has(pid))E.set(pid,[]);E.get(pid).push({s:IDX.seasons[l.id].cur,lg:l.id,c:top(a.club),pos:top(a.pos),g:a.g,mi:Math.round(a.mi),gl:Math.round(a.gl),ast:Math.round(a.ast),xg:a.xg,npxg:a.npxg,xag:a.xag,xagmi:Math.round(a.xagmi),sh:Math.round(a.sh),kp:Math.round(a.kp),tkic:Math.round(a.tkic),cur:true})}}
E.forEach(v=>v.sort((a,b)=>cmp(a.cur?'~':a.s,b.cur?'~':b.s)||cmp(a.lg,b.lg)));
const short=s=>/^\d{4}-\d{2}$/.test(s)?s.slice(2,4)+'/'+s.slice(5):s;
const sumMi=v=>v.reduce((s,r)=>s+r.mi,0),posOf=v=>top(v.reduce((m,r)=>{if(r.pos)m[r.pos]=(m[r.pos]||0)+r.mi;return m},{}));
const near=(a,b)=>Math.abs(a-b)<=.0101;
const per=(r,k)=>r.mi>=90?r[k]/r.mi*90:null,perx=r=>r.xagmi>=90?r.xag/r.xagmi*90:null;
const MEAS=[['npxg',r=>per(r,'npxg')],['xag',perx],['sh',r=>per(r,'sh')],['kp',r=>per(r,'kp')],['tkic',r=>per(r,'tkic')],['gl',r=>per(r,'gl')]];
/* players for the cases */
const all=[...E.entries()].map(([id,v])=>({id,v,name:NAMES.get(id),mi:sumMi(v),pos:posOf(v)}));
const A=all.filter(p=>p.v.length===6&&p.pos!=='GK'&&p.v[5].cur).sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id))[0];
const Bm=all.filter(p=>new Set(p.v.map(r=>r.lg)).size>1).sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id))[0];
const Cc=all.filter(p=>p.v.length===1&&p.v[0].cur&&p.v[0].mi>=300).sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id))[0];
const Dd=all.filter(p=>p.v.length>=3&&p.v.some(r=>r.mi<450)&&p.v.some(r=>r.mi>=1500)).sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id))[0];
const Ee=all.filter(p=>p.v.some(r=>r.mi>=90&&r.xagmi<90)&&p.v.length>=2).sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id))[0];
const Kc=all.filter(p=>p.v.length>=2&&p.v.some((r,i)=>i&&p.v[i-1].lg===r.lg&&p.v[i-1].c!==r.c)).sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id))[0];
const num=s=>s===''||s==null?null:+s;
async function checkPlayer(pg,p,label,tabl=true){
 const rows=await pg.$$eval('#pctb tbody tr',a=>a.map(r=>({...r.dataset,thin:r.classList.contains('thin'),text:r.innerText.replace(/\s+/g,' ')})));
 const W=p.v;
 ok(rows.length===W.length&&rows.every((g,i)=>{const w=W[i];return g.s===w.s&&g.lg===w.lg&&g.c===(w.c||'')&&+g.g===w.g&&+g.mi===w.mi&&+g.gl===w.gl&&+g.ast===w.ast&&near(+g.xg,w.xg)&&near(+g.xag,w.xag)&&+g.xagmi===w.xagmi&&g.thin===(w.mi<450)}),label+': '+rows.length+' seasons: season, league, club, matches, minutes, goals, assists, xG, xAG and the faded rows match');
 ok(rows.every((g,i)=>{const w=W[i],pairs=[['npxg90',per(w,'npxg')],['sh90',per(w,'sh')],['kp90',per(w,'kp')],['tkic90',per(w,'tkic')],['xag90',perx(w)]];return pairs.every(([k,v])=>v==null?g[k]==='':near(+g[k],v))}),label+': every per 90 number (a dash under 90 minutes) matches');
 const moved=W.filter((w,i)=>i&&W[i-1].lg!==w.lg).length,newc=W.filter((w,i)=>i&&W[i-1].lg===w.lg&&W[i-1].c!==w.c).length;
 const mv=await pg.$$eval('#pctb .pc-mv',a=>a.map(x=>x.querySelector('.fx-en').textContent.trim().toLowerCase()));ok(mv.filter(t=>t==='moved').length===moved&&mv.filter(t=>t==='new club').length===newc,label+': '+moved+' move(s) between leagues and '+newc+' change(s) of club are marked');
 const hd=await pg.$eval('#pchd',e=>({...e.dataset,t:e.innerText}));ok(hd.id===p.id&&+hd.n===W.length&&+hd.mi===sumMi(W)&&hd.t.includes(p.name),label+': header: '+p.name+', '+hd.n+' seasons, '+hd.mi+' minutes');
 /* charts */
 const pn=await pg.$$eval('.pc-pn',a=>a.map(d=>({m:d.dataset.m,pts:[...d.querySelectorAll('.pc-pt')].map(g=>({i:+g.dataset.i,v:+g.dataset.v,thin:g.classList.contains('thin')})),ln:d.querySelector('.pc-ln')?d.querySelector('.pc-ln').getAttribute('points').split(' ').length:0,xs:[...d.querySelectorAll('.pc-x')].map(t=>t.textContent.replace(/[⁦-⁩‎‏]/g,''))})));
 ok(pn.map(d=>d.m).join()===MEAS.map(m=>m[0]).join()&&pn.every((d,k)=>{const f=MEAS[k][1],want=W.map((w,i)=>({i,v:f(w),thin:w.mi<450})).filter(x=>x.v!=null);const solid=want.filter(x=>!x.thin).length;
  return d.pts.length===want.length&&d.pts.every((g,j)=>g.i===want[j].i&&near(g.v,want[j].v)&&g.thin===want[j].thin)&&d.ln===(solid>1?solid:0)&&d.xs.join()===W.map(w=>short(w.s)+(w.cur?'*':'')).join()}),label+': six charts: a dot per season with enough minutes, its value, hollow under 450 minutes, the line through the solid dots, the season labels');
}
(async()=>{const b=await T.launch();
 ok(A&&Bm&&Cc&&Dd&&Ee&&Kc,'reference players: '+[A,Bm,Cc,Dd,Ee,Kc].map(p=>p&&p.name+' ('+p.v.length+')').join(', '));
 let {ctx,pg,errs}=await T.open(b,{vw:1100,league:'l_4WFCIZ',hash:'#/career'});await pg.waitForSelector('#pcchips a',{timeout:90000});await pg.waitForTimeout(400);
 ok(await pg.evaluate(([k,r])=>{const on=document.querySelector('#secnav button.on'),h=document.getElementById('hubbar'),cur=h.querySelector(':scope > a.on'),back=h.querySelector(':scope > .hb-back');return !!on&&on.dataset.k===r&&(cur?cur.getAttribute('href')==='#/'+k:true)&&!!back&&back.getAttribute('href')==='#/r-'+r},['career','players']),'the page is in the players room: the room bar marks it, and the bar above it links back to the room and marks the page open');
 /* first view: the list */
 const chips=all.filter(p=>p.v.length>=4&&p.pos!=='GK').sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id)).slice(0,12).map(p=>p.id);
 ok((await pg.$$eval('#pcchips a',a=>a.map(x=>x.dataset.id))).join()===chips.join(),'the first view lists the 12 outfield players with 4+ seasons and most minutes, in order');
 /* search */
 const srch=q=>{const t=fold(q).trim(),out=[];for(const p of all){const f=fold(p.name),i=f.indexOf(t);if(i>=0&&p.v.length)out.push({id:p.id,name:p.name,rank:i===0?0:f.includes(' '+t)?1:2,mi:p.mi})}return out.sort((a,b)=>a.rank-b.rank||b.mi-a.mi||cmp(a.name,b.name)||cmp(a.id,b.id)).slice(0,8).map(x=>x.id)};
 for(const q of ['son','silva','vitor','mü','haa']){await pg.fill('#pcq',q);await pg.waitForTimeout(150);ok((await pg.$$eval('#pcsug a',a=>a.map(x=>x.dataset.id))).join()===srch(q).join(),'search "'+q+'": '+srch(q).length+' players in the right order')}
 await pg.fill('#pcq','zzzzq');await pg.waitForTimeout(150);ok(await pg.evaluate(()=>/No player with that name/.test(document.getElementById('pcsug').innerText)),'a name nobody has says so');
 await pg.fill('#pcq','a');await pg.waitForTimeout(100);ok((await pg.$$('#pcsug a')).length===0,'one letter lists nothing');
 await pg.fill('#pcq',A.name.split(' ').slice(-1)[0]);await pg.waitForTimeout(150);const first=await pg.$eval('#pcsug a',a=>a.dataset.id);await pg.press('#pcq','Enter');await pg.waitForSelector('#pctb',{timeout:30000});
 ok(await pg.evaluate(i=>location.hash==='#/career/'+encodeURIComponent(i),first),'Enter opens the first suggestion');
 /* players */
 for(const [p,l] of [[A,'five finished seasons and this one'],[Bm,'a move between leagues'],[Cc,'only this season'],[Dd,'a season under 450 minutes'],[Ee,'xAG under 90 minutes'],[Kc,'a change of club']]){
  await pg.evaluate(i=>{location.hash='#/career/'+encodeURIComponent(i)},p.id);await pg.waitForFunction(i=>{const h=document.getElementById('pchd');return h&&h.dataset.id===i},p.id,{timeout:30000});await pg.waitForTimeout(250);await checkPlayer(pg,p,p.name+' ('+l+')')}
 /* the player's own page links here */
 const st=await pg.evaluate(async id=>{await new Promise(r=>setTimeout(r,10));const s=(D.stats||[]).find(x=>x.player_id===id);return s?{k:s.key,c:s.club}:null},A.id);
 if(st){await pg.evaluate(s=>{location.hash='#/player/'+encodeURIComponent(s.k+'||'+s.c)},st);await pg.waitForSelector('#pp .pp-head .pc-link',{timeout:60000});ok(await pg.$eval('#pp .pp-head .pc-link',a=>a.getAttribute('href'))==='#/career/'+encodeURIComponent(A.id),'the player\'s own page has a link to his career')}
 else ok(false,'the reference player is in the open league');
 ok(await T.noscroll(pg),'desktop: no horizontal scroll');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* an unknown id */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/career/p_nobody'}));await pg.waitForSelector('#pcnone',{timeout:90000});ok(await pg.evaluate(()=>!!document.getElementById('pcq')&&!document.getElementById('pctb')),'an unknown id says so and keeps the search');ok(!errs.length,'unknown id: no page errors');await ctx.close();
 /* failing files */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/career\.json/,r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/career');await p.waitForTimeout(4000);
  ok(await p.evaluate(()=>/Could not load the career data/.test(document.getElementById('app').innerText)&&!document.getElementById('pctb'))&&!e.length,'a failing career file: the page says so, no error');await c.close()}
 {const lf=LGS.find(l=>l.id==='l_0ErfuF').pl_file,c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(new RegExp(lf.replace('.','\\.')),r=>r.fulfill({status:500,body:''}));
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/career/'+encodeURIComponent(A.id));await p.waitForSelector('#pctb',{timeout:60000});
  ok(await p.evaluate(()=>document.querySelectorAll('#pctb tbody tr').length)===A.v.length&&!e.length,'one league\'s current file failing: the Premier League player still shows every season, no error');await c.close()}
 /* leaving early */
 {const c=await b.newContext({viewport:{width:1000,height:900}});await c.addInitScript(()=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});await c.route(/career\.json/,async r=>{await new Promise(x=>setTimeout(x,2500));r.continue()});
  const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/career');await p.waitForTimeout(800);await p.evaluate(()=>{location.hash='#/table'});await p.waitForTimeout(5000);
  ok(await p.evaluate(()=>!document.getElementById('pcroot')&&!!document.querySelector('.lt'))&&!e.length,'leaving before the career file arrives: nothing is drawn on the other page, no error');await c.close()}
 /* a past season */
 ({ctx,pg,errs}=await T.open(b,{vw:1000,league:'l_4WFCIZ',hash:'#/career',init:{season:'2025-26'}}));await pg.waitForTimeout(5000);ok(await pg.evaluate(()=>!document.getElementById('pctb')&&!document.getElementById('pcroot')&&/past season/i.test(document.getElementById('app').innerText)),'a past season: the page says it is not available');ok(!errs.length,'past season: no page errors');await ctx.close();
 /* Arabic and phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:'#/career/'+encodeURIComponent(Bm.id)}));await pg.waitForSelector('#pctb',{timeout:90000});await pg.waitForTimeout(400);
  await checkPlayer(pg,Bm,lang+' phone '+Bm.name);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$$eval('.pc-svg',a=>a.every(s=>{const r=s.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.width>250})),lang+' phone: the six charts fit the screen, one under the other');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#pcroot');ok(!u.length,'Arabic: the page is translated '+u.slice(0,5).join(' | '));ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
