const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA='/home/user/pl-analytics/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));
const MX=J('l_4WFCIZ_mx.json'),RT=J('l_4WFCIZ_rt.json'),SH=J('l_4WFCIZ_sh.json'),LG=J('l_4WFCIZ.json'),PL=J('l_4WFCIZ_pl.json'),FX=J('fixtures.json'),H2=J('h2h.json'),HV=J('l_4WFCIZ_hv.json');
const six={};SH.cols.forEach((c,i)=>six[c]=i);const pix={};PL.cols.forEach((c,i)=>pix[c]=i);
const sc=s=>{const m=/^(\d+)-(\d+)$/.exec(s||'');return m?[+m[1],+m[2]]:null};
const NEXT=FX.leagues.l_4WFCIZ.filter(f=>Date.parse(f.k)>Date.now()).sort((a,b)=>Date.parse(a.k)-Date.parse(b.k));
const F0=NEXT[0],F1=NEXT[1];
/* a played match's lineup, reused as an "official lineup" for the next fixture in a fake data/live.json */
const anyLu=Object.values(MX.m).find(e=>e.lu&&e.lu.h&&e.lu.a).lu;
const LIVE={t:'2026-10-22 18:00:00',m:{[F0.i]:{l:'l_4WFCIZ',k:F0.k,h:F0.h,a:F0.a,st:'notstarted',lu:anyLu,lut:'x'},[F1.i]:{l:'l_4WFCIZ',k:F1.k,h:F1.h,a:F1.a,pred:1,st:'notstarted'}}};
async function open(b,{vw=1280,lang='en',hash='#/round',live=LIVE,hv=null,now=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900},acceptDownloads:true});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 if(now)await ctx.addInitScript(t=>{const D0=Date,off=t-D0.now();class FD extends D0{constructor(...a){a.length?super(...a):super(D0.now()+off)}static now(){return D0.now()+off}};window.Date=FD},now);
 if(live)await ctx.route(/data\/live\.json/,r=>r.fulfill({json:live}));
 if(hv)await ctx.route(/l_4WFCIZ_hv\.json/,r=>r.fulfill({json:hv}));
 /* the page reads live.json and h2h.json only when the sync announces them in data/index.json */
 await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();if(live)j.live=1;j.h2h=1;if(hv)j.leagues.forEach(l=>{if(l.id==='l_4WFCIZ'){l.hv_file='l_4WFCIZ_hv.json';l.hv_v='t'}});r.fulfill({json:j})});
 /* the matches board (tested in px/ui_ins.js) replaces the one-league strip; without it the strip is drawn, as tested here */
 await ctx.route(/assets\/matches-board\.js/,r=>r.fulfill({body:'',contentType:'application/javascript'}));
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const go=async(pg,h,sel)=>{await pg.evaluate(h=>location.hash=h,h);await pg.waitForSelector(sel,{timeout:30000,state:'attached'});await pg.waitForTimeout(700)};
const untranslated=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('svg,select,a,.mc-sh b,.hcl,.md-tm,.mc-leg,.mc-cn,.tr-p,.fc-n,.fc-l .mu,.rt-pl,.pv-pl,.pv-h2h span,.pv-hl,.clx-xi,.mc-subs li>span:not([class]),.pv-ev,.clx-next b'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xAG|xT|PitchAPI|FT|GW\d*|XI)\b/.test(t))o.push(t)}});return [...new Set(o)]};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 /* ---------------- team of the round ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#totr .tr-pitch',{timeout:60000,state:'attached'});await pg.waitForTimeout(800);
  const round=new Set(await pg.evaluate(()=>HOME.c.round.map(m=>m.match_id)));
  const best=new Map();PL.rows.forEach(r=>{const mid=r[pix.m];if(!round.has(mid))return;const v=(RT.m[mid]||{})[r[pix.i]];if(typeof v!=='number'||r[pix.mi]==null||r[pix.mi]<45||!/^(GK|DF|MF|FW)$/.test(r[pix.o]||''))return;
   const o=best.get(r[pix.i]);if(!o||v>o.r||(v===o.r&&r[pix.mi]>o.mi))best.set(r[pix.i],{id:r[pix.i],n:r[pix.n],pos:r[pix.o],r:v,mi:r[pix.mi]})});
  const by={GK:[],DF:[],MF:[],FW:[]};best.forEach(x=>by[x.pos].push(x));Object.values(by).forEach(L=>L.sort((a,b)=>b.r-a.r||b.mi-a.mi));
  let top=null;[[4,3,3],[4,4,2],[3,4,3],[3,5,2],[4,5,1],[5,3,2],[5,4,1]].forEach(f=>{if(by.DF.length<f[0]||by.MF.length<f[1]||by.FW.length<f[2])return;const xi=[by.GK[0],...by.DF.slice(0,f[0]),...by.MF.slice(0,f[1]),...by.FW.slice(0,f[2])],s=xi.reduce((a,x)=>a+x.r,0);if(!top||s>top.s+1e-9)top={f,xi,s}});
  const got=await pg.evaluate(()=>({n:document.querySelectorAll('#totr .tr-p').length,names:[...document.querySelectorAll('#totr .tr-list li a:not(.mu)')].map(a=>a.textContent),r:[...document.querySelectorAll('#totr .tr-list i')].map(i=>i.textContent),head:document.querySelector('#totr .hhd .mu').textContent}));
  ok(got.n===11&&JSON.stringify(got.names)===JSON.stringify(top.xi.map(x=>x.n)),'team of the round: the best XI recomputed from the files ('+top.f.join('-')+': '+got.names.slice(0,3).join(', ')+'…)');
  ok(got.r.every((v,i)=>v===top.xi[i].r.toFixed(1))&&got.head.includes(top.f.join('-'))&&got.head.includes((top.s/11).toFixed(2)),'ratings, formation and average as computed ('+(top.s/11).toFixed(2)+')');
  ok(await pg.evaluate(()=>{const h=[...document.querySelectorAll('#home .hsec .hhd h2')].map(x=>x.textContent);return h.indexOf('Team of the round')===h.indexOf('Stars of the round')+1}),'it sits right after Stars of the round');
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#totr .shr-btn')]);ok(/team-of-the-round/.test(dl.suggestedFilename()),'shared as an image ('+dl.suggestedFilename()+')');
  /* matchday strip: official lineup badge, links to the preview */
  const st=await pg.evaluate(([a,c])=>{const cards=[...document.querySelectorAll('#mds .md-c.up')];const x=cards.find(e=>e.getAttribute('href')==='#/preview/'+encodeURIComponent(a)),y=cards.find(e=>e.getAttribute('href')==='#/preview/'+encodeURIComponent(c));return {all:cards.every(e=>/^#\/preview\//.test(e.getAttribute('href'))),xi:!!(x&&x.querySelector('.md-xi')),pred:!!(y&&y.querySelector('.md-xi'))}},[F0.i,F1.i]);
  ok(st.all&&st.xi&&!st.pred,'strip: every fixture opens its preview; "XI" only where the official lineups are out (not for a predicted one)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- preview ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  await go(pg,'#/preview/'+F0.i,'#pvroot .mc-score');
  const p=await pg.evaluate(()=>({xi:document.querySelectorAll('#pvroot .mc-pitch.h .mc-p').length,h3:[...document.querySelectorAll('#pvroot h3')].map(x=>x.textContent),pct:[...document.querySelectorAll('.pv-pl b')].map(b=>b.textContent)}));
  ok(p.xi===anyLu.h.xi.length+anyLu.a.xi.length&&p.h3.includes('Official lineups'),'official lineups on the pitch once they are out ('+p.xi+' players)');
  const mm=await pg.evaluate(([h,a])=>labMatchModel().then(M=>M&&M(h,a)),[F0.h,F0.a]);
  ok(mm&&p.pct.join('|')===mm.p.map(v=>Math.round(v*100)+'%').join('|'),'chances = the Intelligence Lab model ('+p.pct.join(' / ')+')');
  const form=t=>LG.matches.filter(m=>(m.h===t||m.a===t)&&sc(m.s)).sort((x,y)=>y.d.localeCompare(x.d)).slice(0,5).map(m=>{const g=sc(m.s),f=m.h===t?g[0]:g[1],a=m.h===t?g[1]:g[0];return f+'–'+a});
  const fr=await pg.$$eval('.pv-form',L=>L.map(u=>[...u.querySelectorAll('.pv-r')].map(x=>x.textContent)));
  ok(JSON.stringify(fr)===JSON.stringify([form(F0.h),form(F0.a)]),'form: the last 5 results of each club, newest first');
  const hh=H2.m[F0.i];if(hh&&hh.n)ok((await pg.$$eval('.pv-h2h b',a=>a.map(x=>+x.textContent))).join(',')===[hh.hw,hh.d,hh.aw].join(','),'head to head from PitchAPI ('+[hh.hw,hh.d,hh.aw].join('-')+')');
  await go(pg,'#/preview/'+F1.i,'#pvroot .mc-score');
  ok(!(await pg.$('#pvroot .mc-pitch'))&&/Not out yet/.test(await pg.innerText('#pvroot')),'only a predicted lineup in PitchAPI: nothing drawn, "not out yet"');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- the match under way (clock moved to after kick-off) ---------------- */
 {const t=Date.parse(F0.k)+50*60e3,live=JSON.parse(JSON.stringify(LIVE));Object.assign(live.m[F0.i],{st:'inprogress',sh:1,sa:0,ev:[[23,0,'Goal','h','Scorer One','',1,0,0,0],[41,0,'Card','a','Booked Two','',null,null,0,0]]});
  const {ctx,pg,errs}=await open(b,{live,now:t});await pg.waitForSelector('#mds .md-c.up',{timeout:60000,state:'attached'});await pg.waitForTimeout(800);
  const c=await pg.evaluate(a=>{const x=document.querySelector('#mds .md-c.up[href="#/preview/'+encodeURIComponent(a)+'"]');return x&&{live:x.classList.contains('live'),sc:x.querySelector('.md-sc')&&x.querySelector('.md-sc').textContent,t:x.innerText}},F0.i);
  ok(c&&c.live&&c.sc==='1 – 0'&&/41'/.test(c.t),'strip: once under way, the score and the last minute from PitchAPI ('+(c&&c.sc)+')');
  await go(pg,'#/preview/'+F0.i,'#pvroot .pv-ev');
  const e=await pg.evaluate(()=>({sc:document.querySelector('.pv-sc').textContent,lv:document.querySelector('.pv-live').textContent,ev:document.querySelectorAll('.pv-ev li').length,note:/not a live feed/.test(document.getElementById('pvroot').innerText),upd:!!document.querySelector('.pv-upd')}));
  ok(e.sc==='1 – 0'&&/Live/.test(e.lv)&&e.ev===2&&e.note&&e.upd,'preview during the match: score, events, the time of the update, and "not a live feed"');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- club page ---------------- */
 {const club=F0.h,{ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  await go(pg,'#/club/'+encodeURIComponent(club),'#clx .clx-g');
  const fin=LG.matches.filter(m=>(m.h===club||m.a===club)&&sc(m.s));const F=new Map();let n=0;const bins=Array.from({length:6},()=>[0,0]);
  fin.forEach(m=>{const e=MX.m[m.i];if(!e)return;const s=m.h===club?'h':'a';if(e.lu&&e.lu[s]){F.set(e.lu[s].f,(F.get(e.lu[s].f)||0)+1);n++}if(e.mo)e.mo.forEach(([t,v])=>{const k=Math.min(5,Math.floor(t/15));bins[k][0]+=s==='h'?v:-v;bins[k][1]++})});
  const g=await pg.evaluate(()=>({f:[...document.querySelectorAll('.clx-fm .mc-f')].map(x=>x.textContent.trim()),mo:[...document.querySelectorAll('.clx-mo b')].map(b=>b.textContent),top:[...document.querySelectorAll('#clx .mc-rl li')].map(l=>[l.querySelector('i').textContent,(l.querySelector('a,span')||{}).textContent]),next:(document.querySelector('.clx-next')||{}).getAttribute&&document.querySelector('.clx-next').getAttribute('href')}));
  ok(JSON.stringify(g.f)===JSON.stringify([...F.entries()].sort((a,b)=>b[1]-a[1]).map(([f,c])=>f+' ×'+c)),'formations used, counted from the lineups ('+g.f.join(', ')+')');
  ok(g.mo.every((v,i)=>v===(bins[i][1]?((x=>(x>0?'+':'')+Math.round(x))(bins[i][0]/bins[i][1])):'N/A')),'momentum by period, turned to the club\'s side ('+g.mo.join(' ')+')');
  ok(g.top.length>0&&g.top.every(([r,nm])=>/^\d\.\d\d$/.test(r)&&/[A-Za-z]/.test(nm)),'top rated: names with their average ('+g.top.slice(0,2).map(x=>x.join(' ')).join(', ')+')');
  ok(g.next==='#/preview/'+encodeURIComponent(F0.i),'next match links to its preview');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- ratings page ---------------- */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#home .hsec',{timeout:60000});
  ok(await pg.evaluate(()=>PAGES.some(p=>p[0]==='ratings')&&UI_SEC.find(s=>s.k==='players').p.includes('ratings')&&PAGES.some(p=>p[0]==='halves')&&UI_SEC.find(s=>s.k==='analysis').p.includes('halves')),'Ratings in Players, Halves in Analysis');
  await go(pg,'#/ratings','#rtout table');
  const A=new Map();Object.entries(RT.m).forEach(([mid,R])=>Object.entries(R).forEach(([pid,v])=>{if(!PL.rows.some(r=>r[pix.m]===mid&&r[pix.i]===pid))return;const o=A.get(pid)||{s:0,n:0};o.s+=v;o.n++;A.set(pid,o)}));
  const exp=[...A.values()].filter(o=>o.n>=3).map(o=>o.s/o.n).sort((a,b)=>b-a)[0];
  ok(await pg.$eval('#rtout .rt-c',e=>e.textContent)===exp.toFixed(2),'the top average (3+ rated matches) recomputed: '+exp.toFixed(2));
  await pg.selectOption('#rtpos','GK');await pg.waitForTimeout(300);ok(await pg.$$eval('#rtout tr td:nth-child(3)',a=>a.length>0&&a.every(x=>x.textContent==='GK')),'position filter: goalkeepers only');
  await go(pg,'#/halves','#hvroot .hv-t');
  const club=F0.h;let x1=0,x2=0,n=0;const ms=new Set(LG.matches.filter(m=>(m.h===club||m.a===club)&&sc(m.s)).map(m=>m.i));
  ms.forEach(mid=>{const rows=SH.rows.filter(r=>r[six.m]===mid&&r[six.pd]!=='PenaltyShootout');if(!rows.length)return;n++;rows.forEach(r=>{if(r[six.c]===club&&!r[six.og]){if(r[six.pd]==='FirstHalf')x1+=r[six.xg];else x2+=r[six.xg]}})});
  const row=await pg.evaluate(c=>{const tr=[...document.querySelectorAll('.hv-t tr')].find(t=>t.querySelector('a')&&t.querySelector('a').textContent.trim()===c);return tr&&[...tr.querySelectorAll('td')].map(t=>t.textContent.trim())},club);
  ok(row&&row[1]===String(n)&&row[2]===(x1/n).toFixed(2)&&row[3]===(x2/n).toFixed(2),`halves: ${club} xG a match by half recomputed (${(x1/n).toFixed(2)} / ${(x2/n).toFixed(2)})`);
  ok(/minutes per half|per-half player stats are being fetched/.test(await pg.innerText('#hvroot'))||!!(await pg.$('#hvpl')),'players: waits for the minutes per half before comparing (no biased list)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* halves players with minutes (a copy of the stored file with full-half minutes added) */
 {const hv=JSON.parse(JSON.stringify(HV));Object.values(hv.m).forEach(M=>{M.c=[...M.c,'mi'];Object.values(M.p).forEach(v=>{if(v[1])v[1].push(45);if(v[2])v[2].push(v[1]?45:30)})});
  const {ctx,pg,errs}=await open(b,{hv,hash:'#/halves'});await pg.waitForSelector('#hvpl .hv-l',{timeout:60000,state:'attached'}).catch(()=>null);
  const L=await pg.$$eval('#hvpl .hv-l',a=>a.map(o=>o.querySelectorAll('li').length));
  ok(L.length===2&&L[0]>0,'players: "does less / more after the break" from full halves only ('+L.join(', ')+')');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- Fantasy: Captain & form ---------------- */
 {const {ctx,pg,errs}=await open(b,{hash:'#/fantasy'});await pg.waitForSelector('#fproot [data-cap]',{timeout:60000});await pg.click('#fproot [data-cap]');await pg.waitForSelector('.fc-l',{timeout:60000});await pg.waitForTimeout(500);
  const c=await pg.evaluate(()=>{const d=FPD,L=d.P.filter(p=>p.pm&&p.pm.gws[0]&&!p.pm.gws[0].none&&p.st==='a'&&p.pm.q!=='nodata').sort((a,b)=>b.pm.gws[0].pts-a.pm.gws[0].pts);return {exp:L[0].name,got:document.querySelector('.fc-l li.top .fc-n').textContent,on:document.querySelector('#fproot [data-cap]').className==='',others:[...document.querySelectorAll('#fproot .ctl button:not([data-cap])')].every(b=>b.className==='s')}});
  ok(c.exp===c.got&&c.on&&c.others,'captain pick = the highest predicted points next gameweek ('+c.got+'), tab highlighted');
  const up=await pg.$$eval('.fc-l',L=>L.slice(1).map(o=>[...o.querySelectorAll('li>b:last-child')].map(b=>+b.textContent)));
  ok(up.length===2&&up[0].every(v=>v>=.3)&&up[1].every(v=>v<=-.3),'rising / falling: last 3 ratings at least 0.3 above / below the season average');
  await pg.click('#fproot .ctl button:not([data-cap])');await pg.waitForTimeout(800);ok(!(await pg.$('.fc-l'))&&!!(await pg.$('#fproot [data-cap]')),'other tabs still work; the button stays');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- phone + Arabic ---------------- */
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('#totr .tr-pitch',{timeout:60000,state:'attached'});await pg.waitForTimeout(800);
  const sw=()=>pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
  ok(await sw(),lang+' phone home: no horizontal scroll');if(lang==='ar')ok(!(await pg.evaluate(untranslated,'#totr,#mds')).length,'Arabic: team of the round and strip '+(await pg.evaluate(untranslated,'#totr,#mds')).slice(0,3).join(' | '));
  for(const [h,s,nm] of [['#/preview/'+F0.i,'#pvroot .mc-score','#pvroot'],['#/club/'+encodeURIComponent(F0.h),'#clx .clx-g','#clx'],['#/ratings','#rtout table','#rtroot'],['#/halves','#hvroot .hv-t','#hvroot']]){
   await go(pg,h,s);ok(await sw(),lang+' phone '+h.split('/')[1]+': no horizontal scroll');if(lang==='ar'){const u=await pg.evaluate(untranslated,nm);ok(!u.length,'Arabic: '+h.split('/')[1]+' translated '+u.slice(0,3).join(' | '))}}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* ---------------- service worker: versioned files from the device ---------------- */
 {const {ctx,pg,errs}=await open(b,{live:null});await pg.waitForSelector('#home .hsec',{timeout:60000});
  await pg.evaluate(async()=>{await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready});await pg.reload();await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(1500);
  const k=await pg.evaluate(async()=>{const c=await caches.open('pla-v3');return (await c.keys()).map(r=>r.url)});
  ok(k.some(u=>/data\/logos_[^?]+\.json\?v=[0-9a-f]{10}$/.test(u))&&!k.some(u=>/index\.json\?/.test(u)),'content-hashed data files kept under their exact address; data/index.json is not');
  ok(k.some(u=>/assets\/home-extra\.js$/.test(u))&&!k.some(u=>/assets\/.*\?v=/.test(u)),'scripts are network first: one offline copy per file, not kept by their hand-set version');
  const t0=Date.now();await pg.reload();await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(1500);
  ok(await pg.evaluate(()=>{const L=performance.getEntriesByType('resource').filter(e=>/data\/logos_[^?]+\.json\?v=[0-9a-f]{10}/.test(e.name));return L.length>0&&L.every(e=>e.transferSize===0)}),'on the next visit the hashed data files come from the device (nothing downloaded), home in '+(Date.now()-t0)+' ms');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
