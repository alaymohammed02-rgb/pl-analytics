/* Luck table: points and expected points recomputed from the raw files (league file results, shot file xG) */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
const xp=(a,b)=>{const A=pois(a),B=pois(b);let w=0,d=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=A[i]*B[j];if(i>j)w+=q;else if(i===j)d+=q}return 3*w+d};
function raw(lid){const lg=IDX.leagues.find(l=>l.id===lid),L=J(lg.file),S=J(lg.sh_file),ix={};S.cols.forEach((c,i)=>ix[c]=i);
 const tx=new Map();S.rows.forEach(r=>{if(r[ix.og])return;const k=r[ix.m]+'|'+r[ix.c],x=r[ix.xg];tx.set(k,(tx.get(k)||0)+(typeof x==='number'&&isFinite(x)?x:0))});
 const T=new Map();let n=0,all=0;L.matches.forEach(m=>{const g=/^(\d+)-(\d+)$/.exec(m.s||'');if(!g)return;all++;const xh=tx.get(m.i+'|'+m.h),xa=tx.get(m.i+'|'+m.a);if(xh==null||xa==null)return;n++;
  [[m.h,+g[1],+g[2],xh,xa,m.a],[m.a,+g[2],+g[1],xa,xh,m.h]].forEach(([t,f,a,x1,x2,o])=>{const r=T.get(t)||{t,n:0,pts:0,xp:0,f:0,a:0,ms:[]};const p=f>a?3:f===a?1:0,e=xp(x1,x2);r.n++;r.pts+=p;r.xp+=e;r.f+=f;r.a+=a;r.ms.push({id:m.i,g:p-e});T.set(t,r)})});
 const rows=[...T.values()];rows.forEach(r=>r.gap=r.pts-r.xp);return {rows,n,all}}
async function open(b,{vw=1280,lang='en',league='l_4WFCIZ',hash='#/luck'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l)}},[lang,league]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
const num=s=>parseFloat(String(s).replace('−','-'));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const lid of ['l_4WFCIZ','l_0ErfuF','l_0bfbkO']){const X=raw(lid);const {ctx,pg,errs}=await open(b,{league:lid});await pg.waitForSelector('.lk-me',{timeout:60000});
  const nav=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));ok(nav.indexOf('#/luck')===nav.indexOf('#/sim')+1,lid+': in League after the simulator');
  ok((await pg.textContent('.lk-intro')).includes(`${X.n} of ${X.all} matches have shot data`),`${X.n} of ${X.all} matches counted`);
  const bars=await pg.$$eval('.lk-bars button',a=>a.map(x=>[x.dataset.tm,x.querySelector('b').textContent]));
  const exp=X.rows.slice().sort((a,b)=>b.gap-a.gap||a.t.localeCompare(b.t));
  ok(bars.length===exp.length&&bars.every((x,i)=>x[0]===exp[i].t&&Math.abs(num(x[1])-exp[i].gap)<0.051),`bars: ${bars.length} clubs, points − expected points from the raw files, ordered`);
  const tr=await pg.$$eval('.lk-t tbody tr',a=>a.map(r=>{const c=r.querySelectorAll('td');return {t:r.dataset.tm,rp:+c[0].textContent,n:+c[2].textContent,pts:+c[3].textContent,xp:+c[4].textContent,rx:parseInt(c[6].textContent)}}));
  const byX=X.rows.slice().sort((a,b)=>b.xp-a.xp||a.t.localeCompare(b.t)).map(r=>r.t);
  ok(tr.every(r=>{const x=X.rows.find(z=>z.t===r.t);return x&&r.pts===x.pts&&r.n===x.n&&Math.abs(r.xp-x.xp)<0.051&&r.rx===byX.indexOf(r.t)+1}),'table: points, matches, expected points and place by xPts, every club');
  ok(tr.every((r,i)=>!i||tr[i-1].pts>=r.pts),'table ordered by points');
  const t=exp[exp.length-1];await pg.click(`.lk-bars button[data-tm="${t.t}"]`);await pg.waitForTimeout(300);
  const d=await pg.evaluate(()=>({h:document.querySelector('.lk-me h3').textContent.trim(),up:[...document.querySelectorAll('.lk-two > div')[0].querySelectorAll('a')].map(a=>decodeURIComponent(a.getAttribute('href').split('/')[2])),dn:[...document.querySelectorAll('.lk-two > div')[1].querySelectorAll('a')].map(a=>decodeURIComponent(a.getAttribute('href').split('/')[2]))}));
  const up=t.ms.filter(x=>x.g>0).sort((a,b)=>b.g-a.g).slice(0,3).map(x=>x.id),dn=t.ms.filter(x=>x.g<0).sort((a,b)=>a.g-b.g).slice(0,3).map(x=>x.id);
  ok(d.h===t.t&&d.up.join()===up.join()&&d.dn.join()===dn.join(),`${t.t}: the matches behind its number (${dn.length} below, ${up.length} above), largest first`);
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 const untr=sel=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest('select,option,.fx-en,bdi'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xPts|PitchAPI|PPDA)\b/.test(t))o.push(t)}});return [...new Set(o)]};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await open(b,{vw:390,lang});await pg.waitForSelector('.lk-me',{timeout:60000});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),lang+' phone: no horizontal scroll');
  {const w=await pg.$eval('.lk-t',t=>[t.parentNode.scrollWidth,t.parentNode.clientWidth,t.scrollWidth,innerWidth]);ok(w[0]<=w[1]+1,lang+' phone: the table fits its card (scroll '+w[0]+', box '+w[1]+', table '+w[2]+', window '+w[3]+')')}
  if(lang==='ar'){const u=await pg.evaluate(untr,'#app');ok(!u.length,'Arabic: page translated '+u.slice(0,6).join(' | '));ok(await pg.$eval('#nav a[href="#/luck"]',a=>a.textContent.trim())==='جدول الحظ','Arabic menu: جدول الحظ')}
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
