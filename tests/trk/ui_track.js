const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const T=JSON.parse(fs.readFileSync(__dirname+'/../trkweb/data/fpl_track.json','utf8')),D=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/fpl.json','utf8'));
/* independent actual points of a record: auto-subs (FPL rules) and captain/vice, from the raw history rows */
const hc=D.hcols,iR=hc.indexOf('r'),iP=hc.indexOf('pts'),iM=hc.indexOf('min'),ty=new Map(D.rows.map(r=>[r[0],r[D.cols.indexOf('ty')]]));
const at=(id,g,i)=>(D.hist[String(id)]||[]).filter(h=>h[iR]===g).reduce((a,h)=>a+(h[i]||0),0);
function actual(s){const xi=s.xi.slice(),c={1:0,2:0,3:0,4:0};xi.forEach(id=>c[ty.get(id)]++);const used=new Set();
 for(let k=0;k<xi.length;k++){const id=xi[k];if(at(id,s.gw,iM)>0)continue;const t=ty.get(id);
  for(const b of s.bench){if(used.has(b)||!(at(b,s.gw,iM)>0))continue;const bt=ty.get(b);if((t===1)!==(bt===1))continue;const cc={...c};cc[t]--;cc[bt]++;if(bt!==1&&(cc[2]<3||cc[3]<2||cc[4]<1))continue;xi[k]=b;used.add(b);c[t]--;c[bt]++;break}}
 const cap=at(s.cap,s.gw,iM)>0?s.cap:(s.vice!=null&&at(s.vice,s.gw,iM)>0?s.vice:null);return xi.reduce((a,id)=>a+at(id,s.gw,iP),0)+(cap!=null?at(cap,s.gw,iP):0)}
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const pg=await (await b.newContext({viewport:{width:vw,height:900}})).newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
  await pg.goto('http://127.0.0.1:8770/index.html#/fantasy');await pg.waitForSelector('#fproot .ctl button',{timeout:60000});
  if(lang==='ar'){await pg.click('#langbtn');await pg.waitForTimeout(400)}
  const lab=lang==='ar'?'سجل التوقعات':'Track record',tabs=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));ok(tabs.includes(lab),vw+' '+lang+': Track record tab ('+tabs.length+' tabs)');
  if(vw===1280){/* the saved GW8 record is exactly what the Optimal XI tab shows now */
   await pg.waitForFunction(()=>document.querySelector('#oxout')&&/Formation/.test(document.querySelector('#oxout').innerText),null,{timeout:60000});
   const k=await pg.$$eval('#oxout .kpi',a=>a.map(x=>x.innerText));const r=T.gws['8'];
   ok(k[1].includes(r.exp.toFixed(1))&&k[2].includes(Math.round(r.p10)+'–'+Math.round(r.p90)),'saved GW8 record = Optimal XI tab ('+k[1].split('\n')[0]+', '+k[2].split('\n')[0]+')');
   const ids=await pg.evaluate(()=>OX.cache[Object.keys(OX.cache).find(k=>/budget\|0$/.test(k))].then?null:null);}
  await pg.click(`#fproot .ctl button:text-is("${lab}")`);await pg.waitForSelector('#fpbody table',{timeout:30000});
  const rows=await pg.$$eval('#fpbody > .wrap:first-of-type table tr, #fpbody > div.wrap table tr',a=>a.slice(1).map(r=>[...r.cells].map(c=>c.innerText.replace(/[\u2066-\u2069]/g,''))));
  ok(rows.length===3,'one row per saved gameweek ('+rows.length+')');
  for(const g of [6,7]){const exp=actual(T.gws[g]),row=rows.find(r=>r[0].replace(/\D/g,'')==String(g));ok(row&&+row[4]===exp,'GW'+g+' actual = independent recomputation with auto-subs and captain rule ('+(row&&row[4])+' vs '+exp+')')}
  const r8=rows.find(r=>r[0].replace(/\D/g,'')==='8');ok(r8&&(lang==='ar'?/مفتوح/.test(r8[4]):/open until the deadline/.test(r8[4])),'GW8 (deadline not passed) shown as open: '+(r8&&r8[4]));
  const kp=await pg.$$eval('#fpbody .kpi b',a=>a.map(x=>x.textContent.replace(/[\u2066-\u2069]/g,'')));
  const D6=D.events.find(e=>e.id===6).avg,D7=D.events.find(e=>e.id===7).avg,a6=actual(T.gws[6]),a7=actual(T.gws[7]);
  ok(+kp[0]===2&&+kp[1]===a6+a7&&+kp[2]===(a6+a7)-(D6+D7),'KPIs: 2 scored gameweeks, actual total and the difference against the FPL average ('+kp.join(', ')+')');
  ok(await pg.$('#trkc svg')!==null,'chart drawn for 2+ scored gameweeks');
  const link=await pg.$eval('#fpbody a[href*="commits/main/data/fpl_track.json"]',a=>a.href).catch(()=>null);ok(!!link,'link to the file history on GitHub: '+link);
  await pg.click('#fpbody details summary');await pg.waitForTimeout(200);const det=await pg.$$eval('#fpbody details[open] tr',a=>a.length);ok(det===16,'details list the 15 saved players ('+(det-1)+')');
  const ov=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(ov<=1,vw+'px: no horizontal page scroll ('+ov+')');
  if(lang==='ar'){const left=await pg.evaluate(()=>{const names=new Set(FPD.P.flatMap(p=>[p.name,p.tn,p.tf]));const o=[];const w=document.createTreeWalker(document.querySelector('#fpbody'),NodeFilter.SHOW_TEXT);let n;
    while(n=w.nextNode()){const t=n.nodeValue.replace(/[\u2066-\u2069]/g,'').trim();if(/[A-Za-z]{2}/.test(t)&&!/[\u0600-\u06FF]/.test(t)&&!names.has(t)&&!/^(UTC|GitHub|GW\d+|v\d|\d)/.test(t)&&!/^[\d\s:\-‑]+UTC$/.test(t))o.push(t)}return [...new Set(o)]});
   ok(!left.length,'Arabic: every text translated'+(left.length?' — left: '+JSON.stringify(left.slice(0,20)):''))}
  /* archived season: no Track record tab */
  await pg.selectOption('#fproot select[aria-label]','2024-25');await pg.waitForTimeout(1200);const at2=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));ok(!at2.includes(lab),'archived seasons have no Track record tab');
  await pg.selectOption('#fproot select[aria-label]','');await pg.waitForTimeout(1200);
  await pg.click(`#fproot .ctl button:text-is("${lab}")`);await pg.waitForSelector('#fpbody table');await pg.screenshot({path:__dirname+'/track_'+vw+'_'+lang+'.png',fullPage:true});
  ok(!errs.length,vw+' '+lang+': no page errors '+errs.slice(0,3).join(' | '))}
 /* the real data: the GW8 record saved by the sync is shown as open until its deadline */
 const pg=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();await pg.goto('http://127.0.0.1:8765/index.html#/fantasy');await pg.waitForSelector('#fproot .ctl button',{timeout:60000});
 await pg.click('#fproot .ctl button:text-is("Track record")');await pg.waitForSelector('#fpbody > div.wrap table');const t=await pg.innerText('#fpbody > div.wrap table');
 const G8=JSON.parse(require('fs').readFileSync('/home/user/pl-analytics/data/fpl_track.json','utf8')).gws['8'];
 ok(/GW8/.test(t)&&/open until the deadline, 2026-10-23 17:30 UTC/.test(t)&&t.includes((+G8.exp).toFixed(1)+' ('+Math.round(G8.p10)+'–'+Math.round(G8.p90)+')'),'real GW8 record shown: '+t.split('\n').slice(1,2).join(' ').slice(0,140));
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
