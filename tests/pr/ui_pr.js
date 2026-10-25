/* Player prices (assets/player-prices.js): the players table and the clubs table recomputed from the league player files and the real data/tm.json
   (own code), the filters, the orders, "show more", the note, the hub tab, Arabic, 390 px, leaving early, a missing price file. */
const T=require('../nf/lib.js');const {ok,J}=T;const fs=require('fs');
const LG=['l_4WFCIZ','l_0ErfuF','l_1Isor4','l_3FJFUl','l_0ALvwF','l_4QexZg'];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const PRISTINE=process.env.PRISTINE_INDEX&&fs.existsSync(process.env.PRISTINE_INDEX)?fs.readFileSync(process.env.PRISTINE_INDEX,'utf8'):null;
const TM=J('tm.json');
const ageOf=dob=>{const [y,m,d]=dob.split('-').map(Number),t=new Date();return t.getFullYear()-y-((t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))?1:0)};
const money=v=>v==null?'':v>=1e6?'€'+(v/1e6).toFixed(v>=1e7?0:1)+'m':'€'+Math.round(v/1e3)+'k';
const tot=v=>v>=1e9?'€'+(v/1e9).toFixed(2)+'bn':money(v);
const P=[];
for(const id of LG){const l=T.lg(id),f=J(l.pl_file),ix={};f.cols.forEach((c,i)=>ix[c]=i);const M=new Map();
 for(const r of f.rows){if(r[ix.mi]==null)continue;let a=M.get(r[ix.i]);if(!a)M.set(r[ix.i],a={id:r[ix.i],name:r[ix.n],club:r[ix.c],pos:{},mi:0});a.mi+=r[ix.mi];a.club=r[ix.c]||a.club;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+r[ix.mi]}
 for(const a of M.values()){const pos=Object.keys(a.pos).sort((x,y)=>a.pos[y]-a.pos[x])[0]||null,t=TM.p[a.id];P.push({key:id+'|'+a.id,id:a.id,lg:id,name:a.name,club:a.club,pos,mi:a.mi,val:t?t[1]:null,age:t?ageOf(t[0]):null})}}
const PR=P.filter(p=>p.val!=null);
const sortV=L=>L.slice().sort((a,b)=>b.val-a.val||b.mi-a.mi||a.name.localeCompare(b.name));
const rows=pg=>pg.evaluate(()=>[...document.querySelectorAll('.pr-t tbody tr')].map(r=>({k:r.dataset.k,v:r.querySelector('.pr-v').textContent.trim(),age:r.cells[5].textContent.trim(),mi:r.cells[6].textContent.trim()})));
const cnt=async pg=>+(/^(\d+)/.exec(await pg.innerText('.pr-n'))||[])[1];
(async()=>{const b=await T.launch();
 ok(PR.length>1500&&PR.length<P.length,'sanity: '+PR.length+' of '+P.length+' players of the six leagues have a price in data/tm.json (dated '+TM.asof+')');
 async function mk(vw,lang,hash,route){const ctx=await b.newContext({viewport:{width:vw,height:900}});
  await ctx.addInitScript(l=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},lang);
  await ctx.route(/cdn\.pitchapi/,r=>r.fulfill({contentType:'image/png',body:PNG}));
  if(PRISTINE)await ctx.route(/data\/index\.json/,r=>r.fulfill({contentType:'application/json',body:PRISTINE}));
  if(route)await ctx.route(route[0],route[1]);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL|api.github.com|status of 404/.test(u+m.text()))errs.push(m.text())});
  await pg.goto('http://127.0.0.1:8765/index.html'+hash);return {ctx,pg,errs}}
 let {ctx,pg,errs}=await mk(1280,'en','#/prices');await pg.waitForSelector('.pr-t tbody tr',{timeout:90000});
 let R=await rows(pg),W=sortV(PR);
 ok(await cnt(pg)===PR.length&&R.length===50&&R.every((r,i)=>r.k===W[i].key&&r.v===money(W[i].val)),'highest value first: '+PR.length+' priced players, the first 50 in the same order with the same values ('+W[0].name+' '+money(W[0].val)+', '+W[1].name+' '+money(W[1].val)+')');
 ok(R.every((r,i)=>r.age===String(W[i].age)&&r.mi===String(Math.round(W[i].mi))),'age and minutes of every row match');
 await pg.click('#prm');R=await rows(pg);ok(R.length===100&&R.every((r,i)=>r.k===W[i].key),'"Show more": 100 rows, the same order');
 for(const id of LG){await pg.selectOption('#prl',id);const L=sortV(PR.filter(p=>p.lg===id));R=await rows(pg);ok(await cnt(pg)===L.length&&R.slice(0,10).every((r,i)=>r.k===L[i].key),T.lg(id).name+': '+L.length+' priced players, top 10 in order')}
 await pg.selectOption('#prl','');
 for(const pos of ['GK','DF','MF','FW']){await pg.selectOption('#prp',pos);ok(await cnt(pg)===PR.filter(p=>p.pos===pos).length,pos+': '+await cnt(pg)+' players')}await pg.selectOption('#prp','');
 const BAND={u21:[0,21],a2225:[22,25],a2629:[26,29],a30:[30,99]};for(const [k,[lo,hi]] of Object.entries(BAND)){await pg.selectOption('#pra',k);ok(await cnt(pg)===PR.filter(p=>p.age!=null&&p.age>=lo&&p.age<=hi).length,'age band '+k+': '+await cnt(pg)+' players')}await pg.selectOption('#pra','');
 await pg.selectOption('#prs','young');R=await rows(pg);const Y=PR.slice().sort((a,c)=>a.age-c.age||c.val-a.val||c.mi-a.mi||a.name.localeCompare(c.name));ok(R.every((r,i)=>r.k===Y[i].key),'youngest first ('+Y[0].name+', '+Y[0].age+')');
 await pg.selectOption('#prs','old');R=await rows(pg);const O=PR.slice().sort((a,c)=>c.age-a.age||c.val-a.val||c.mi-a.mi||a.name.localeCompare(c.name));ok(R.every((r,i)=>r.k===O[i].key),'oldest first ('+O[0].name+', '+O[0].age+')');
 await pg.selectOption('#prs','min');R=await rows(pg);const M=PR.slice().sort((a,c)=>c.mi-a.mi||c.val-a.val||a.name.localeCompare(c.name));ok(R.every((r,i)=>r.k===M[i].key),'most minutes first');
 await pg.selectOption('#prs','val');
 const club=W[0].club;await pg.selectOption('#prk',club);ok(await cnt(pg)===PR.filter(p=>p.club===club).length,'club '+club+': '+await cnt(pg)+' priced players');await pg.selectOption('#prk','');
 await pg.fill('#prq',W[0].name);await pg.waitForTimeout(400);R=await rows(pg);ok(R.some(r=>r.k===W[0].key),'search "'+W[0].name+'" finds him');await pg.fill('#prq','');await pg.waitForTimeout(400);
 /* clubs */
 await pg.selectOption('#prt','clubs');const C=new Map();P.forEach(p=>{const k=p.lg+'|'+p.club,c=C.get(k)||C.set(k,{club:p.club,lg:p.lg,n:0,pr:0,sum:0,top:null}).get(k);c.n++;if(p.val!=null){c.pr++;c.sum+=p.val;if(!c.top||p.val>c.top.val||(p.val===c.top.val&&(p.mi>c.top.mi||(p.mi===c.top.mi&&p.name.localeCompare(c.top.name)<0))))c.top=p}});
 const CL=[...C.values()].filter(c=>c.pr>0&&c.club).sort((a,b)=>b.sum-a.sum||a.club.localeCompare(b.club));
 const cr=await pg.evaluate(()=>[...document.querySelectorAll('.pr-c tbody tr')].map(r=>({k:r.dataset.c,cnt:r.cells[3].textContent.trim(),sum:r.cells[4].textContent.trim(),avg:r.cells[5].textContent.trim(),top:r.cells[6].innerText.trim()})));
  ok(cr.length===CL.length&&cr.every((r,i)=>r.k===CL[i].lg+'|'+CL[i].club&&r.cnt===CL[i].pr+' / '+CL[i].n&&r.sum===tot(CL[i].sum)&&r.avg===money(CL[i].sum/CL[i].pr)&&r.top.startsWith(CL[i].top.name)&&r.top.includes(money(CL[i].top.val))),'clubs: '+CL.length+' clubs, total, average, priced / squad and the most valuable player match ('+CL[0].club+' '+tot(CL[0].sum)+', '+CL[0].pr+' / '+CL[0].n+')');
 await pg.selectOption('#prl','l_0ErfuF');const CE=CL.filter(c=>c.lg==='l_0ErfuF');ok(await pg.$$eval('.pr-c tbody tr',a=>a.length)===CE.length,'clubs of LaLiga: '+CE.length);
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/prices')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/prices'}),'the page is a tab of the Players hub, marked open');
 const note=await pg.innerText('.pr-tm');ok(note.includes('Transfermarkt')&&note.includes(TM.asof)&&note.includes('6 July 2026'),'the note names Transfermarkt, the file date '+TM.asof+' and the project\'s own 6 July 2026');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* no price file yet (the empty placeholder) */
 {const r=await mk(1280,'en','#/prices',[/data\/tm\.json/,x=>x.fulfill({contentType:'application/json',body:'{"t":"","p":{}}'})]);await r.pg.waitForSelector('#prroot .empty:not(.skel)',{timeout:90000});ok(/No prices yet/.test(await r.pg.textContent('#prroot'))&&!r.errs.length,'the empty placeholder file: "No prices yet", no error');await r.ctx.close()}
 /* leaving before the data arrives */
 {const r=await mk(1280,'en','#/prices',[/l_4WFCIZ_pl\.json/,async x=>{await new Promise(z=>setTimeout(z,2500));x.continue()}]);await r.pg.waitForSelector('#prroot',{timeout:60000});await r.pg.evaluate(()=>location.hash='#/table');await r.pg.waitForSelector('.lt',{timeout:60000});await r.pg.waitForTimeout(3500);
  ok(!(await r.pg.$('#prroot'))&&await r.pg.$('.lt')&&!r.errs.length,'leaving before the data arrives: the table stays, no error');await r.ctx.close()}
 for(const lang of ['ar','en']){const r=await mk(390,lang,'#/prices');await r.pg.waitForSelector('.pr-t tbody tr',{timeout:90000});await r.pg.waitForTimeout(400);
  ok(await T.noscroll(r.pg),lang+' phone: no horizontal scroll');
  ok(await r.pg.evaluate(()=>{const t=document.querySelector('.pr-t').getBoundingClientRect(),c=document.querySelector('.pr-t').closest('.card').getBoundingClientRect();return t.left>=c.left-1&&t.right<=c.right+1}),lang+' phone: the table fits its card');
  await r.pg.selectOption('#prt','clubs');await r.pg.waitForTimeout(200);ok(await T.noscroll(r.pg)&&await r.pg.evaluate(()=>{const t=document.querySelector('.pr-c').getBoundingClientRect(),c=document.querySelector('.pr-c').closest('.card').getBoundingClientRect();return t.left>=c.left-1&&t.right<=c.right+1}),lang+' phone: the clubs table fits too');
  await r.pg.selectOption('#prt','players');
  if(lang==='ar'){const u=await r.pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/أسعار اللاعبين/.test(await r.pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await r.pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!r.errs.length,lang+' phone: no page errors '+r.errs.slice(0,2).join(' ; '));await r.pg.screenshot({path:__dirname+'/pr_390_'+lang+'.png',fullPage:false});await r.ctx.close()}
 await T.done(b)})();
