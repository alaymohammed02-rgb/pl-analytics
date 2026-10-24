/* XI Builder (assets/xi-builder.js): the player pool per league, position and filter recomputed from the league files (own code), the formations,
   picking, removing, the same player once, formation change, photos, the saved XI, the hub tab, Arabic, 390 px, leaving early, a failing league file. */
const T=require('../nf/lib.js');const {ok,J}=T;const fs=require('fs');
const LG=['l_4WFCIZ','l_0ErfuF','l_1Isor4','l_3FJFUl','l_0ALvwF','l_4QexZg','l_1XLtP0'];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const PRISTINE=process.env.PRISTINE_INDEX&&fs.existsSync(process.env.PRISTINE_INDEX)?fs.readFileSync(process.env.PRISTINE_INDEX,'utf8'):null;
const PH={};const P=[];
for(const id of LG){const l=T.lg(id),f=J(l.pl_file),ix={};f.cols.forEach((c,i)=>ix[c]=i);const M=new Map();
 for(const r of f.rows){if(r[ix.mi]==null)continue;let a=M.get(r[ix.i]);if(!a)M.set(r[ix.i],a={id:r[ix.i],name:r[ix.n],club:r[ix.c],pos:{},mi:0});a.mi+=r[ix.mi];a.club=r[ix.c]||a.club;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+r[ix.mi]}
 let ph={};try{ph=J('photos_'+id+'.json')}catch(e){}PH[id]=ph;
 for(const a of M.values()){const pos=Object.keys(a.pos).sort((x,y)=>a.pos[y]-a.pos[x])[0]||null;P.push({key:id+'|'+a.id,id:a.id,lg:id,name:a.name,club:a.club,pos,mi:a.mi,nat:(ph.c&&ph.c[a.id])||'',photo:!!(ph.public&&ph.p&&ph.p[a.id])})}}
const cnt=(f)=>P.filter(f).length;
const hash=id=>[...String(id)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
const TMP={};[...new Set(P.map(p=>p.id))].forEach(id=>{const h=hash(id);if(h%3===0)return;TMP[id]=['19'+(88+h%15)+'-0'+(1+h%9)+'-1'+(h%9),h%7===0?null:[200000,3e6,8e6,3e7,6e7][h%5]]});
const TM={t:'2026-10-24',asof:'2026-07-06',source:'test',matched:Object.keys(TMP).length,n_players:new Set(P.map(p=>p.id)).size,p:TMP};
const ageOf=dob=>{const [y,m,d]=dob.split('-').map(Number),t=new Date();return t.getFullYear()-y-((t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))?1:0)};
P.forEach(p=>{const t=TMP[p.id];p.age=t?ageOf(t[0]):null;p.val=t?t[1]:null});
const money=v=>v==null?'':v>=1e6?'€'+(v/1e6).toFixed(v>=1e7?0:1)+'m':'€'+Math.round(v/1e3)+'k';
const FORMS={'4-3-3':[1,4,3,3],'4-2-3-1':[1,4,5,1],'4-4-2':[1,4,4,2],'3-5-2':[1,3,5,2],'3-4-3':[1,3,4,3],'4-1-4-1':[1,4,5,1],'5-3-2':[1,5,3,2],'4-5-1':[1,4,5,1]};
const info=pg=>pg.evaluate(()=>{const t=[...document.querySelectorAll('.xb-pick .ins-note')].pop()?.innerText||'';const m=/Showing 40 of (\d+)/.exec(t)||/^(\d+) players/.exec(t);return {n:m?+m[1]:null,rows:[...document.querySelectorAll('.xb-row')].map(r=>({k:r.dataset.k,dis:r.disabled,img:!!r.querySelector('.xb-av img'),t:r.innerText}))}});
(async()=>{const b=await T.launch();
 ok(P.length>2500&&P.some(p=>p.photo),'sanity: '+P.length+' players in the 7 files, '+P.filter(p=>p.photo).length+' with a photo');
 async function open(o){const r=await T.open(b,o);return r}
 async function mk(vw,lang,hash,fail,tm){const ctx=await b.newContext({viewport:{width:vw,height:900}});
  await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
  await ctx.route(/cdn\.pitchapi/,r=>r.fulfill({contentType:'image/png',body:PNG}));
  if(PRISTINE)await ctx.route(/data\/index\.json/,r=>r.fulfill({contentType:'application/json',body:PRISTINE}));
  if(tm)await ctx.route(/data\/tm\.json/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(tm)}));
  if(fail)await ctx.route(fail,r=>r.fulfill({status:500,body:''}));
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL|api.github.com|status of 500|tm\.json/.test(u+m.text()))errs.push(m.text())});
  await pg.goto('http://127.0.0.1:8765/index.html'+hash);await pg.waitForSelector('.xb-pitch',{timeout:90000});return {ctx,pg,errs}}
 let {ctx,pg,errs}=await mk(1280,'en','#/builder');
 /* formations */
 for(const f of Object.keys(FORMS)){await pg.selectOption('#xbf',f);
  const g=await pg.evaluate(()=>{const s=[...document.querySelectorAll('.xb-slot')].map(x=>({y:parseFloat(x.style.top),x:parseFloat(x.style.left)}));const rows=[];s.slice().sort((a,b)=>b.y-a.y).forEach(x=>{const l=rows[rows.length-1];if(l&&Math.abs(l.y-x.y)<1)l.n++;else rows.push({y:x.y,n:1})});return {n:s.length,rows:rows.map(r=>r.n)}});
  const exp=f.split('-').map(Number);ok(g.n===11&&JSON.stringify(g.rows)===JSON.stringify([1,...exp]),f+': 11 spots, lines from the goal up: '+g.rows.join(' · '))}
 await pg.selectOption('#xbf','4-3-3');
 /* the pool, per position and league */
 await pg.click('.xb-slot[data-i="0"]');await pg.waitForSelector('.xb-row',{timeout:30000});
 let I=await info(pg);ok(I.n===cnt(p=>p.pos==='GK'),'goalkeeper spot, all leagues: '+I.n+' goalkeepers of the 7 files');
 for(const id of LG){await pg.selectOption('#xbl',id);I=await info(pg);ok(I.n===cnt(p=>p.pos==='GK'&&p.lg===id),T.lg(id).name+': '+I.n+' goalkeepers')}
 await pg.selectOption('#xbl','');
 await pg.uncheck('#xbo');I=await info(pg);ok(I.n===P.length,'"only this position" off: all '+I.n+' players');await pg.check('#xbo');
 /* order and rows: the first rows are the most minutes */
 I=await info(pg);const gk=P.filter(p=>p.pos==='GK').sort((a,c)=>c.mi-a.mi||a.name.localeCompare(c.name));
 ok(I.rows.length===40&&I.rows.every((r,i)=>r.k===gk[i].key),'the list is sorted by minutes: first '+gk[0].name+', then '+gk[1].name);
 ok(I.rows.every((r,i)=>r.img===gk[i].photo),'every player with a photo shows it, the others show initials ('+I.rows.filter(r=>r.img).length+' photos in 40 rows)');
 /* search, club, country */
 const nm0=gk[0].name;await pg.fill('#xbq',nm0);await pg.waitForTimeout(400);I=await info(pg);ok(I.rows.some(r=>r.k===gk[0].key)&&I.n<=3,'search "'+nm0+'" finds him ('+I.n+' result)');await pg.fill('#xbq','');await pg.waitForTimeout(400);
 const natN=P.filter(p=>p.pos==='GK'&&p.nat).reduce((m,p)=>(m[p.nat]=(m[p.nat]||0)+1,m),{}),nat=Object.keys(natN).sort((a,c)=>natN[c]-natN[a]||a.localeCompare(c))[0];
 await pg.selectOption('#xbn',nat);I=await info(pg);ok(I.n===natN[nat]&&I.rows.every(r=>r.t.includes(nat)),'country '+nat+': '+I.n+' goalkeepers, each shows the code');await pg.selectOption('#xbn','');
 const club=gk[0].club;await pg.selectOption('#xbk',club);I=await info(pg);ok(I.n===cnt(p=>p.pos==='GK'&&p.club===club),'club '+club+': '+I.n+' goalkeepers');await pg.selectOption('#xbk','');
 /* pick, remove */
 await pg.click('.xb-row[data-k="'+gk[0].key.replace(/"/g,'\\"')+'"]');
 let st=await pg.evaluate(()=>({fill:document.querySelectorAll('.xb-slot.fill').length,txt:document.querySelector('.xb-slot[data-i="0"]').innerText,n:document.querySelector('.xb-n').innerText,open:!!document.querySelector('#xbpick')}));
 ok(st.fill===1&&st.txt.trim()===gk[0].name.trim().split(/\s+/).slice(-1)[0]||st.txt.includes(gk[0].name.split(/\s+/).slice(-1)[0]),'picked: '+st.txt.trim()+' in the goal, '+st.n.trim()+', the picker closes');ok(!st.open,'the picker closed after the pick');
 /* the same player once: pick a midfielder who is in two files, then he is disabled elsewhere */
 const byId={};P.forEach(p=>(byId[p.id]=byId[p.id]||[]).push(p));const dup=Object.values(byId).find(a=>a.length>1&&a.every(p=>p.pos==='MF'));
 if(dup){await pg.selectOption('#xbf','4-3-3');await pg.click('.xb-slot[data-i="5"]');await pg.waitForSelector('.xb-row');await pg.fill('#xbq',dup[0].name);await pg.waitForTimeout(400);
  await pg.click('.xb-row[data-k="'+dup[0].key.replace(/"/g,'\\"')+'"]');await pg.click('.xb-slot[data-i="6"]');await pg.fill('#xbq',dup[0].name);await pg.waitForTimeout(400);I=await info(pg);
  ok(dup.every(p=>(I.rows.find(r=>r.k===p.key)||{dis:true}).dis),dup[0].name+' ('+dup.map(p=>p.lg).join(', ')+'): once in the XI, every entry of him is disabled "In XI"');await pg.fill('#xbq','');await pg.waitForTimeout(300)}
 else console.log('ok   (no midfielder is in two files: duplicate check skipped)');
 /* defender pick, formation change keeps the picks by position */
 await pg.click('.xb-slot[data-i="1"]');await pg.waitForSelector('.xb-row');I=await info(pg);const df=P.filter(p=>p.pos==='DF').sort((a,c)=>c.mi-a.mi||a.name.localeCompare(c.name))[0];await pg.click('.xb-row[data-k="'+I.rows[0].k.replace(/"/g,'\\"')+'"]');
 const before=await pg.evaluate(()=>[...document.querySelectorAll('.xb-slot.fill')].length);
 await pg.selectOption('#xbf','3-5-2');const after=await pg.evaluate(()=>[...document.querySelectorAll('.xb-slot.fill')].map(x=>x.dataset.i));
 ok(after.length===before&&after.includes('0'),'formation 4-3-3 → 3-5-2: all '+before+' picks stay ('+after.length+'), the goalkeeper still in goal');
 /* saved in this browser */
 await pg.reload();await pg.waitForSelector('.xb-pitch');const saved=await pg.evaluate(()=>({f:document.querySelector('#xbf').value,n:document.querySelectorAll('.xb-slot.fill').length}));
 ok(saved.f==='3-5-2'&&saved.n===before,'after a reload the XI is back: '+saved.f+', '+saved.n+' picked');
 /* remove, clear */
 await pg.click('.xb-slot.fill');await pg.click('#xbrm');ok(await pg.evaluate(()=>document.querySelectorAll('.xb-slot.fill').length)===before-1,'remove: one fewer');
 await pg.click('#xbc');ok(await pg.evaluate(()=>document.querySelectorAll('.xb-slot.fill').length)===0,'clear: empty pitch');
 ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#hubbar a')].map(x=>x.getAttribute('href'));return a.includes('#/builder')&&document.querySelector('#hubbar a.on').getAttribute('href')==='#/builder'}),'the page is a tab of the Compare hub, marked open');
 ok(await pg.evaluate(()=>!document.querySelector('#xba,#xbv,#xbs,.xb-tm')),'without data/tm.json: no age, value or order choice and no Transfermarkt note');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* with ages and values (a made-up data/tm.json) */
 {const r=await mk(1280,'en','#/builder',null,TM);const g=r.pg;await g.click('.xb-slot[data-i="5"]');await g.waitForSelector('.xb-row');await g.uncheck('#xbo');
  const ex=[['u21',0,21],['a2225',22,25],['a2629',26,29],['a30',30,99]];
  for(const [k,lo,hi] of ex){await g.selectOption('#xba',k);const I=await info(g);ok(I.n===cnt(p=>p.age!=null&&p.age>=lo&&p.age<=hi),'age band '+k+': '+I.n+' players (the ones with an age in the band)')}
  await g.selectOption('#xba','');
  const VB=[['v0',0,5e6],['v5',5e6,2e7],['v20',2e7,5e7],['v50',5e7,Infinity]];
  for(const [k,lo,hi] of VB){await g.selectOption('#xbv',k);const I=await info(g);ok(I.n===cnt(p=>p.val!=null&&p.val>=lo&&p.val<hi),'value band '+k+': '+I.n+' players')}
  await g.selectOption('#xbv','');await g.selectOption('#xbs','val');let I=await info(g);const bv=P.slice().sort((a,c)=>(a.val==null)-(c.val==null)||(c.val||0)-(a.val||0)||c.mi-a.mi||a.name.localeCompare(c.name));
  ok(I.rows.every((r,i)=>r.k===bv[i].key),'order by market value: highest first ('+bv[0].name+' '+money(bv[0].val)+'), players without one last');
  ok(I.rows[0].t.includes(money(bv[0].val))&&I.rows[0].t.includes(bv[0].age+' y'),'a row shows his age and value: '+I.rows[0].t.replace(/\s+/g,' ').slice(0,90));
  await g.selectOption('#xbs','age');I=await info(g);const ba=P.slice().sort((a,c)=>(a.age==null)-(c.age==null)||(a.age||0)-(c.age||0)||c.mi-a.mi||a.name.localeCompare(c.name));
  ok(I.rows.every((r,i)=>r.k===ba[i].key),'order by age: youngest first ('+ba[0].name+', '+ba[0].age+')');
  const note=await g.innerText('.xb-tm');ok(note.includes('2026-07-06')&&note.includes(TM.matched+' of '+TM.n_players),'the note names Transfermarkt, the dataset date and '+TM.matched+' of '+TM.n_players+' matched');
  await g.selectOption('#xbs','mi');await g.selectOption('#xba','a2225');await g.selectOption('#xbv','v5');I=await info(g);ok(I.n===cnt(p=>p.age>=22&&p.age<=25&&p.val>=5e6&&p.val<2e7),'age and value together: '+I.n+' players');
  ok(!r.errs.length,'no page errors with ages and values '+r.errs.slice(0,2).join(' ; '));await r.ctx.close()}
 /* one league file failing: the others still load */
 {const r=await mk(1280,'en','#/builder',/l_0ErfuF_pl\.json/);await r.pg.click('.xb-slot[data-i="0"]');await r.pg.waitForSelector('.xb-row');
  const o=await r.pg.$$eval('#xbl option',a=>a.map(x=>x.value));ok(!o.includes('l_0ErfuF')&&o.length===LG.length,'LaLiga file failing: the page still opens, LaLiga is not in the league list ('+(o.length-1)+' leagues)');await r.ctx.close()}
 /* leaving before the data arrives */
 {const c2=await b.newContext();await c2.route(/l_4WFCIZ_pl\.json/,async r=>{await new Promise(z=>setTimeout(z,2500));r.continue()});const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto('http://127.0.0.1:8765/index.html#/builder');await p2.waitForSelector('#xbroot',{timeout:60000});await p2.evaluate(()=>location.hash='#/table');await p2.waitForSelector('.lt',{timeout:60000});await p2.waitForTimeout(3500);
  ok(!(await p2.$('#xbroot'))&&await p2.$('.lt')&&!e2.length,'leaving before the data arrives: the table stays, no error');await c2.close()}
 for(const lang of ['ar','en']){const r=await mk(390,lang,'#/builder',null,TM);await r.pg.waitForTimeout(400);
  ok(await T.noscroll(r.pg),lang+' phone: no horizontal scroll');
  ok(await r.pg.evaluate(()=>{const p=document.querySelector('.xb-pitch').getBoundingClientRect();return [...document.querySelectorAll('.xb-slot')].every(s=>{const a=s.getBoundingClientRect();return a.left>=p.left-1&&a.right<=p.right+1&&a.top>=p.top-1&&a.bottom<=p.bottom+1})}),lang+' phone: every spot sits inside the pitch');
  await r.pg.click('.xb-slot[data-i="3"]');await r.pg.waitForSelector('.xb-row');await r.pg.waitForTimeout(300);
  ok(await T.noscroll(r.pg),lang+' phone: no horizontal scroll with the picker open');
  if(lang==='ar'){const u=await r.pg.evaluate(T.untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,5).join(' | '));ok(/بناء التشكيلة/.test(await r.pg.textContent('#app h2')),'Arabic title');ok(!/\$\{|NaN|undefined/.test(await r.pg.innerText('#app')),'no template text, NaN or undefined')}
  ok(!r.errs.length,lang+' phone: no page errors '+r.errs.slice(0,2).join(' ; '));await r.pg.screenshot({path:__dirname+'/xb_390_'+lang+'.png',fullPage:false});await r.ctx.close()}
 await T.done(b)})();
