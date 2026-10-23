const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const ix=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/index.json','utf8')),pl=ix.leagues.find(l=>l.name==='Premier League');
const L=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/'+pl.file,'utf8')),SH=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/'+pl.sh_file,'utf8'));
/* independent numbers */
const T={};L.matches.forEach(m=>{const [a,b]=m.s.split('-').map(Number);[[m.h,a,b],[m.a,b,a]].forEach(([t,f,g])=>{const r=T[t]||(T[t]={pts:0,gd:0,gf:0,p:0});r.p++;r.pts+=f>g?3:f===g?1:0;r.gd+=f-g;r.gf+=f})});
const order=Object.keys(T).sort((x,y)=>T[y].pts-T[x].pts||T[y].gd-T[x].gd||T[y].gf-T[x].gf||x.localeCompare(y));
const last=L.matches.map(m=>m.d).sort().pop(),from=new Date(Date.parse(last+'T00:00:00Z')-6*864e5).toISOString().slice(0,10),inW=new Set(L.matches.filter(m=>m.d>=from).map(m=>m.i));
const c=SH.cols,rows=SH.rows.map(r=>Object.fromEntries(c.map((k,i)=>[k,r[i]]))),W=rows.filter(s=>inW.has(s.m));
const big=W.filter(s=>s.st!=='Penalty'&&!s.og&&typeof s.xg==='number').sort((a,b)=>b.xg-a.xg)[0];
const dist=s=>Math.hypot(105-s.x,34-s.y),lg=W.filter(s=>s.ev==='Goal'&&!s.og&&s.st!=='Penalty').sort((a,b)=>dist(b)-dist(a))[0];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const ctx=await b.newContext({viewport:{width:vw,height:900}}),pg=await ctx.newPage(),errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
  await pg.goto('http://127.0.0.1:8765/index.html#/round');await pg.waitForSelector('#wkhl .wkc',{timeout:60000});
  if(lang==='ar'){await pg.click('#langbtn');await pg.waitForTimeout(500)}
  const cards=await pg.$$eval('#wkhl .wkc',a=>a.map(x=>x.innerText.replace(/[⁦-⁩]/g,'')));
  ok(cards.length>=4,vw+' '+lang+': This week shows '+cards.length+' highlight cards');
  ok(cards.some(t=>t.includes(big.xg.toFixed(2))&&t.includes(big.pn)),'biggest chance = independent max xG of the week ('+big.pn+' '+big.xg.toFixed(2)+')');
  ok(!lg||cards.some(t=>t.includes(Math.round(dist(lg))+(lang==='ar'?' م':' metres'))&&t.includes(lg.pn)),'longest-range goal = independent maximum ('+(lg?lg.pn+' '+Math.round(dist(lg))+' m':'none')+')');
  const fact=await pg.$eval('#wkhl .wkfact',e=>e.innerText).catch(()=>'');ok(fact.length>20,'fact of the day: '+fact.replace(/\n/g,' ').slice(0,120));
  const head=await pg.$eval('#wkhl h3',e=>e.innerText.replace(/[⁦-⁩]/g,'').replace(/‑/g,'-'));ok(head.includes(from)&&head.includes(last),'week range shown: '+head);
  let ov=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(ov<=1,vw+'px overview: no horizontal scroll ('+ov+')');
  if(lang==='ar'){const names=new Set([...rows.map(r=>r.pn),...rows.map(r=>r.c),...L.stats.map(x=>x.p),...L.stats.map(x=>x.c),...Object.keys(T)]);
   const left=await pg.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.querySelector('#wkhl'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[\u2066-\u2069]/g,'').trim();if(/[A-Za-z]{2}/.test(t)&&!/[\u0600-\u06FF]/.test(t))o.push(t.replace(/^\(|\)$/g,'').replace(/,$/,''))}return [...new Set(o)]});
   const bad=left.filter(t=>!names.has(t)&&!/^(xG|xT)( [\d.]+)?$/.test(t)&&!/ \d+-\d+ /.test(t));ok(!bad.length,'Arabic highlights: everything translated except names'+(bad.length?' — '+JSON.stringify(bad.slice(0,10)):''))}
  await pg.screenshot({path:__dirname+'/ov_'+vw+'_'+lang+'.png'});
  /* league table */
  await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('#lt .ltr[data-t]',{timeout:30000});
  const got=await pg.$$eval('#lt .ltr[data-t]',a=>a.map(x=>({t:x.dataset.t,c:[...x.children].map(y=>y.innerText.replace(/[⁦-⁩▲▼]/g,'').trim())})));
  ok(got.length===20&&got.every((r,i)=>r.t===order[i]),'table order = independent computation (points, GD, goals)');
  ok(got.every(r=>+r.c[7]===T[r.t].pts&&+r.c[6].replace('+','')===T[r.t].gd&&+r.c[2]===T[r.t].p),'every row: played, goal difference and points match');
  if(lang==='ar'){const ch=await pg.$eval('#lt .ltf',e=>getComputedStyle(e,'::after').content);ok(/[فتخ]/.test(ch),'form chips in Arabic letters ('+ch+')');
   const h=await pg.$eval('#lt .lth .ltl',e=>getComputedStyle(e,'::after').content);ok(/لعب/.test(h),'table header letters in Arabic ('+h+')')}
  /* replay */
  await pg.click('#ltplay');await pg.waitForTimeout(150);const lab0=await pg.$eval('#ltlab',e=>e.textContent);
  let anim=0;for(let i=0;i<12&&!anim;i++){await pg.waitForTimeout(300);anim=await pg.evaluate(()=>[...document.querySelectorAll('#lt .ltr')].reduce((a,x)=>a+x.getAnimations().length,0))}
  const lab1=await pg.$eval('#ltlab',e=>e.textContent);ok(anim>0&&lab0!==lab1,'replay: rows slide to their new places ('+anim+' moving) and the date advances: '+lab0+' → '+lab1);
  await pg.click('#ltplay');const n0=await pg.$eval('#ltrng',e=>{e.value=0;e.dispatchEvent(new Event('input'));return 0});await pg.waitForTimeout(200);
  const p1=await pg.$$eval('#lt .ltr[data-t]',a=>a.map(x=>+x.children[2].innerText));ok(p1.every(v=>v<=1),'slider at the first date: every team has played at most 1 match');
  ov=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(ov<=1,vw+'px table: no horizontal scroll ('+ov+')');
  await pg.$eval('#ltrng',e=>{e.value=e.max;e.dispatchEvent(new Event('input'))});await pg.waitForTimeout(700);await pg.screenshot({path:__dirname+'/lt_'+vw+'_'+lang+'.png',fullPage:vw<500});
  if(lang==='ar'){const left=await pg.evaluate(()=>{const o=[];for(const root of [document.querySelector('#app')]){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[⁦-⁩]/g,'').trim();if(/[A-Za-z]{2}/.test(t)&&!/[؀-ۿ]/.test(t))o.push(t)}}return [...new Set(o)]});
   const teams=new Set([...order,'Premier League']);const latin=t=>(t.match(/[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’&-]*){2,}/g)||[]).filter(r=>!teams.has(r)&&![...teams].some(x=>x.includes(r)));ok(left.every(t=>teams.has(t)||!latin(t).length),'Arabic table page: no English sentence left, only team names'+(left.filter(t=>latin(t).length).length?' — '+JSON.stringify(left.filter(t=>latin(t).length).slice(0,5)):''))}
  /* other competitions */
  for(const [nm,exp] of [['World Cup','tournament'],['Champions League',36],['LaLiga',20]]){const id=ix.leagues.find(l=>l.name===nm).id;
   await pg.selectOption('#lgpick',id);await pg.waitForTimeout(1500);if(!(await pg.$('#ltroot')))await pg.evaluate(()=>location.hash='#/table');await pg.waitForFunction(()=>document.querySelector('#lt .ltr[data-t]')||document.querySelector('.ltgs .ltg')||/tournament|بطولة/.test((document.querySelector('#ltroot')||{}).innerText||''),null,{timeout:30000});
   const n=await pg.$$eval('#lt .ltr[data-t]',a=>a.length),g=await pg.$$eval('.ltgs .ltg',a=>a.map(x=>x.querySelectorAll('.ltr[data-t]').length)),hd=await pg.$$eval('#ltroot h3',a=>a.map(x=>x.innerText));
   ok(exp==='tournament'?n===0&&g.length===12&&g.every(x=>x===4)&&hd.length===17:n===exp,nm+': '+(exp==='tournament'?'12 group tables of 4 and the knockout rounds ('+g.length+' groups, '+hd.length+' headings)':n+' teams'))}
  ok(!errs.length,vw+' '+lang+': no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
