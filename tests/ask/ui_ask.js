/* Ask the site (assets/ask.js): how INS.askParse reads 30 questions in Arabic and English (league, club, player, measure, per 90, least, how many,
   position, age, club question), then the answers recomputed here from the raw per-match player files and league files (rankings with their
   filters and ties, per 90 with the minutes limit, club totals, the club summary, the table, a player's numbers, ages from data/tm.json), the
   "not understood" and "no such player" answers, the example chips, the Home hub tab, Arabic, 390 px, leaving early, failing files. */
const T=require('../nf/lib.js');const {ok,J}=T;
const DOMS=T.IDX.leagues.filter(T.DOM),cmp=(a,b)=>a<b?-1:a>b?1:0;
/* every player of the six leagues: sums over the matches that have each measure, minutes over rows with minutes */
const PLAY=[],TAB={};
for(const l of DOMS){const P=J(l.pl_file),c={};P.cols.forEach((k,i)=>c[k]=i);const M=new Map();
 for(const r of P.rows){const mi=r[c.mi];if(mi==null)continue;let a=M.get(r[c.i]);if(!a){a={id:r[c.i],name:r[c.n],lg:l.id,lgn:l.name,mi:0,clubs:{},pos:{},s:{},d:{}};M.set(r[c.i],a)}
  a.mi+=mi;a.clubs[r[c.c]]=(a.clubs[r[c.c]]||0)+mi;if(r[c.o])a.pos[r[c.o]]=(a.pos[r[c.o]]||0)+mi;for(const k of P.cols){if(['m','i','n','t','c','o','mi'].includes(k))continue;const v=r[c[k]];if(v!=null){a.s[k]=(a.s[k]||0)+v;a.d[k]=(a.d[k]||0)+mi}}}
 for(const a of M.values()){if(!(a.mi>0))continue;const top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0];a.club=(top(a.clubs)||['Unknown'])[0];a.p=(top(a.pos)||[null])[0];a.key=l.id+'|'+a.id;PLAY.push(a)}
 const L=J(l.file),Tm=new Map();for(const m of L.matches){const g=/^(\d+)-(\d+)$/.exec(String(m.s||'').trim());if(!g||!m.d)continue;for(const [t,f,ag] of [[m.h,+g[1],+g[2]],[m.a,+g[2],+g[1]]]){const r=Tm.get(t)||{t,p:0,g:0,gf:0,ga:0};r.g++;r.gf+=f;r.ga+=ag;r.p+=f>ag?3:f===ag?1:0;Tm.set(t,r)}}
 TAB[l.id]=[...Tm.values()].sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||cmp(a.t,b.t))}
const TM=J('tm.json'),age=dob=>{if(!dob)return null;const [y,m,d]=dob.split('-').map(Number),t=new Date();return t.getFullYear()-y-((t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))?1:0)};
const fmt=(k,v,p90)=>k==='mi'&&!p90?String(Math.round(v)):p90||/^(xg|npxg|xag)$/.test(k)?(+v).toFixed(2):String(Math.round(v*100)/100);
function rank({k,lgs,club,pos,p90,min,dir='desc',n=10,ageMax}){const mn=p90?(min||450):(min||0);
 let L=PLAY.filter(p=>lgs.includes(p.lg)&&(!club||p.club===club)&&(!pos||p.p===pos)&&p.mi>=mn);if(ageMax)L=L.filter(p=>{const a=TM.p[p.id]?age(TM.p[p.id][0]):null;return a!=null&&a<ageMax});
 const rows=L.map(p=>({p,v:p90&&k!=='mi'?(p.d[k]>0?p.s[k]/p.d[k]*90:null):k==='mi'?p.mi:(p.d[k]>0?p.s[k]:null)})).filter(r=>r.v!=null&&isFinite(r.v));
 rows.sort((a,b)=>(dir==='asc'?a.v-b.v:b.v-a.v)||(dir==='asc'?b.p.mi-a.p.mi:a.p.mi-b.p.mi)||cmp(a.p.name,b.p.name));return rows.slice(0,n).map(r=>[r.p.key,fmt(k,r.v,p90),String(Math.round(r.p.mi))])}
const ALL6=DOMS.map(l=>l.id),PL='l_4WFCIZ',ES='l_0ErfuF',IT='l_0ALvwF',DE='l_1Isor4';
const ask=async(pg,q)=>{await pg.fill('#akq',q);await pg.click('#akf button[type=submit]');await pg.waitForFunction(()=>document.querySelector('#akout .card'),null,{timeout:20000})};
const prow=pg=>pg.$$eval('.ak-t tbody tr[data-p]',a=>a.map(r=>[r.dataset.p,r.cells[2].textContent.replace(/[⁦-⁩]/g,'').trim(),r.cells[3].textContent.replace(/[⁦-⁩]/g,'').trim()]));
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:PL,hash:'#/ask'});await pg.waitForSelector('#akq',{timeout:90000});
 /* ---- the parser ---- */
 const parse=q=>pg.evaluate(q=>{const P=INS.askParse(q,{clubs:window.__akc,players:window.__akp});return {league:P.league,club:P.club,player:P.player&&P.player.id,metric:P.metric,p90:P.p90,min:P.min,dir:P.dir,n:P.n,pos:P.pos,age:P.age,team:P.team,unknown:P.unknown}},q);
 await pg.evaluate(([c,p])=>{window.__akc=c;window.__akp=p},[Object.values(TAB).flatMap(t=>t.map(r=>r.t)),PLAY.map(p=>({id:p.id,name:p.name,key:p.key}))]);
 const haaland=PLAY.find(p=>p.name==='Erling Haaland'),kane=PLAY.find(p=>p.name==='Harry Kane');
 const CASES=[['Who has the most goals in the Premier League?',{league:PL,metric:'gl',dir:'desc'}],['مين أكثر هداف في الدوري الإنجليزي؟',{league:PL,metric:'gl'}],
  ['Most assists per 90 in LaLiga',{league:ES,metric:'ast',p90:true}],['أكثر صناعة لكل 90 في الدوري الإسباني',{league:ES,metric:'ast',p90:true}],
  ['Top 5 defenders by interceptions in Serie A',{league:IT,metric:'ic',n:5,pos:'DF'}],['أفضل 5 مدافعين في الاعتراضات بالدوري الإيطالي',{league:IT,metric:'ic',n:5,pos:'DF'}],
  ['Liverpool',{club:'Liverpool',metric:null,team:false}],['ليفربول',{club:'Liverpool'}],['لليفربول',{club:'Liverpool'}],['Which team has the most shots?',{metric:'sh',team:true}],['أي فريق عنده أكثر تسديدات؟',{metric:'sh',team:true}],
  ['Haaland',{player:haaland&&haaland.id}],['Kane goals',{player:kane&&kane.id,metric:'gl'}],['Most xG under 21',{metric:'xg',age:21}],['أكثر xG تحت 21',{metric:'xg',age:21}],
  ['برشلونة أهداف',{club:'Barcelona',metric:'gl'}],['Inter Milan table',{club:'Inter',team:true}],['انتر ميلان',{club:'Inter'}],['ميلان',{club:'Milan'}],['ما هو الطقس',{metric:null,club:null,league:null}],
  ['least passes per 90 forwards',{metric:'ps',p90:true,dir:'asc',pos:'FW'}],['ترتيب الدوري الألماني',{league:DE,team:true}],['مين أكثر لاعب مراوغات بالبوندسليغا',{league:DE,metric:'tkw'}],
  ['expected goals in serie a',{league:IT,metric:'xg'}],['shots on target',{metric:'sot'}],['non-penalty xg per 90 900 minutes',{metric:'npxg',p90:true,min:900}],
  ['أكثر حارس دقائق',{metric:'mi',pos:'GK'}],['Salah',{unknown:['salah']}],['interceptions',{metric:'ic',club:null}],['top 3 man city scorers',{club:'Manchester City',metric:'gl',n:3}]];
 const bad=[];for(const [q,w] of CASES){const g=await parse(q);for(const k in w){if(JSON.stringify(g[k])!==JSON.stringify(w[k]))bad.push(q+' → '+k+'='+JSON.stringify(g[k])+' (want '+JSON.stringify(w[k])+')')}}
 ok(!bad.length,'the parser reads '+CASES.length+' questions in Arabic and English as expected '+bad.slice(0,4).join(' | '));
 /* ---- the answers ---- */
 const A1=[['Who has the most goals in the Premier League?',{k:'gl',lgs:[PL]}],['أكثر صناعة لكل 90 في الدوري الإسباني',{k:'ast',lgs:[ES],p90:true}],['Top 5 defenders by interceptions in Serie A',{k:'ic',lgs:[IT],pos:'DF',n:5}],
  ['least passes per 90 forwards',{k:'ps',lgs:ALL6,p90:true,dir:'asc',pos:'FW'}],['non-penalty xg per 90 900 minutes',{k:'npxg',lgs:ALL6,p90:true,min:900}],['برشلونة أهداف',{k:'gl',lgs:ALL6,club:'Barcelona'}],
  ['top 3 man city scorers',{k:'gl',lgs:ALL6,club:'Manchester City',n:3}],['xag in the bundesliga',{k:'xag',lgs:[DE]}],['أكثر حارس دقائق',{k:'mi',lgs:ALL6,pos:'GK'}]];
 for(const [q,w] of A1){await ask(pg,q);const got=await prow(pg),exp=rank(w);ok(got.length&&JSON.stringify(got)===JSON.stringify(exp),'"'+q+'": '+exp.length+' rows match ('+exp.slice(0,2).map(r=>r[0].split('|')[1]+' '+r[1]).join(', ')+')')}
 if(Object.keys(TM.p||{}).length){await ask(pg,'Most xG under 21');const got=await prow(pg),exp=rank({k:'xg',lgs:ALL6,ageMax:21});ok(JSON.stringify(got)===JSON.stringify(exp),'"Most xG under 21": ages from tm.json, '+exp.length+' rows ('+(exp[0]||[]).join(' ')+')')}
 /* club totals and the table */
 await ask(pg,'Which team has the most shots?');
 {const rows=[];for(const id of ALL6)for(const r of TAB[id])rows.push({c:r.t,v:PLAY.filter(p=>p.lg===id&&p.club===r.t).reduce((s,p)=>s+(p.s.sh||0),0),g:r.g});rows.sort((a,b)=>b.v-a.v||cmp(a.c,b.c));
  const got=await pg.$$eval('.ak-t tbody tr',a=>a.map(r=>[r.dataset.c,r.cells[2].textContent.trim(),r.cells[3].textContent.trim()]));ok(JSON.stringify(got)===JSON.stringify(rows.slice(0,10).map(r=>[r.c,String(Math.round(r.v*100)/100),String(r.g)])),'"Which team has the most shots?": the 10 clubs with most shots of their players ('+rows[0].c+' '+rows[0].v+')')}
 await ask(pg,'ترتيب الدوري الألماني');{const got=await pg.$$eval('.ak-t tbody tr',a=>a.map(r=>[r.dataset.c,r.cells[2].textContent.trim()]));ok(JSON.stringify(got)===JSON.stringify(TAB[DE].map(r=>[r.t,String(r.p)])),'"ترتيب الدوري الألماني": the whole Bundesliga table ('+TAB[DE].length+' clubs, '+TAB[DE][0].t+' '+TAB[DE][0].p+')')}
 await ask(pg,'Inter Milan table');{const got=await pg.$$eval('.ak-t tbody tr',a=>a.map(r=>r.dataset.c));ok(JSON.stringify(got)===JSON.stringify(TAB[IT].map(r=>r.t)),'"Inter Milan table": the table of Inter\'s league')}
 /* the club summary */
 await ask(pg,'Liverpool');{const T_=TAB[PL],i=T_.findIndex(r=>r.t==='Liverpool'),r=T_[i],sq=PLAY.filter(p=>p.lg===PL&&p.club==='Liverpool'),top=k=>sq.slice().sort((a,b)=>(b.s[k]||0)-(a.s[k]||0)||a.mi-b.mi||cmp(a.name,b.name))[0];
  const t=await pg.evaluate(()=>[...document.querySelectorAll('.ak-c .fx-en')].map(x=>x.textContent).join(' ')),sfx=i<3?['st','nd','rd'][i]:'th';
  ok(t.includes(`${i+1}${sfx} of ${T_.length} with ${r.p} points from ${r.g} matches (goals ${r.gf}–${r.ga}).`)&&t.includes(`Top scorer: ${top('gl').name} (${Math.round(top('gl').s.gl)}). Most assists: ${top('ast').name} (${Math.round(top('ast').s.ast)}).`),'"Liverpool": '+(i+1)+sfx+', '+r.p+' points, top scorer '+top('gl').name)}
 /* a player */
 if(haaland){await ask(pg,'Haaland');const got=await pg.$$eval('.ak-p tbody tr',a=>a.map(r=>[r.dataset.k,r.cells[1].textContent.trim()]));
  const want=['gl','ast','xg','xag','sh','kp','ps','tk','ic','mi'].map(k=>[k,k==='mi'?String(Math.round(haaland.mi)):haaland.d[k]>0?fmt(k,haaland.s[k],false):'–']);
  ok(JSON.stringify(got)===JSON.stringify(want)&&await pg.$eval('.ak-p a',a=>a.getAttribute('href'))==='#/story/'+encodeURIComponent(haaland.key),'"Haaland": his ten numbers and a link to his story ('+got.slice(0,3).map(x=>x.join(' ')).join(', ')+')')}
 /* not understood, no such player */
 await ask(pg,'ما هو الطقس');ok(/did not understand/.test(await pg.textContent('#akout')),'a question it cannot read: an honest "did not understand" with examples');
 await ask(pg,'Salah');ok(/No player of the six leagues this season is called "salah"/.test(await pg.textContent('#akout')),'a name nobody has: "no player of the six leagues this season is called…"');
 await pg.click('.ak-ex .ak-chip');await pg.waitForFunction(()=>document.querySelector('#akout .ak-t'),null,{timeout:20000});ok(await pg.$eval('#akq',x=>x.value)==='Who has the most goals in the Premier League?','an example chip fills the box and answers it');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a[0]==='#/overview'&&a[1]==='#/ask'&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/ask'}),'the page is the second tab of the Home hub, marked open');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 {const c2=await b.newContext();await c2.route(/_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/ask');await p2.waitForSelector('#akroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#akroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:PL,hash:'#/ask'});await pg.waitForSelector('#akq',{timeout:90000});
  await ask(pg,lang==='ar'?'أفضل 5 مدافعين في الاعتراضات بالدوري الإيطالي':'Top 5 defenders by interceptions in Serie A');await pg.waitForTimeout(300);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.evaluate(()=>{const t=document.querySelector('.ak-t'),c=t.closest('.card').getBoundingClientRect(),a=t.getBoundingClientRect();return a.left>=c.left-1&&a.right<=c.right+1}),lang+' phone: the answer table fits its card');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/اسأل الموقع/.test(await pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/ask_390_'+lang+'.png',fullPage:false});await ctx.close()}
 await T.done(b)})();
