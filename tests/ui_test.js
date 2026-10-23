const {chromium}=require('playwright');
const URL='http://127.0.0.1:8765/index.html',SH=__dirname+'/shots/';
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const num=s=>parseFloat(String(s).replace(/[^0-9.\-+]/g,''));
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME||undefined}).catch(()=>chromium.launch());
 const ctx=await b.newContext({viewport:{width:1280,height:900}});const pg=await ctx.newPage();const errs=[];
 pg.on('pageerror',e=>errs.push('pageerror: '+e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon.ico|api.github.com\/repos\/127|cdn.pitchapi/.test(u))errs.push('console: '+m.text()+' @ '+u)});
 await pg.goto(URL+'#/fantasy');
 /* 1. Optimal XI is the default Fantasy tab */
 await pg.waitForFunction(()=>document.querySelector('#oxout')&&/Formation/.test(document.querySelector('#oxout').innerText),null,{timeout:60000});
 const tabs=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));console.log('  tabs:',tabs.join(' | '));
 ok(tabs[0].includes('Optimal XI')&&tabs.includes('Table')&&tabs.includes('Backtest')&&tabs.includes('Best Team'),'Optimal XI first, all existing tabs still present');
 const cards=await pg.$$eval('#oxout div[onclick^="fpPredPick"]',a=>a.length);ok(cards===11,'pitch shows 11 player cards ('+cards+')');
 const kp=await pg.$$eval('#oxout .kpi',a=>a.map(x=>x.innerText.replace(/\n/g,' ')));console.log('  KPIs:',kp.join(' || '));
 let optTotal=num(kp[1]);ok(optTotal>0,'expected total shown: '+optTotal);
 ok(/✓ 11 unique players/.test(await pg.innerText('#oxout')),'rule checks pass on the page');
 const caps=await pg.$$eval('#oxout div[onclick^="fpPredPick"] span',a=>a.map(x=>x.textContent).filter(t=>t==='C'||t==='V'));ok(caps.sort().join('')==='CV','captain and vice badges on the pitch');
 await pg.screenshot({path:SH+'xi_desktop.png',fullPage:false});
 await pg.click('#oxout div[onclick^="fpPredPick"]');await pg.waitForSelector('#pdet .card');ok(true,'tapping a player opens the prediction details');
 /* any-price mode */
 await pg.selectOption('#fpbody .ctl select:nth-of-type(2)','any');await pg.waitForFunction(()=>/Any-price mode/.test(document.querySelector('#oxout').innerText),null,{timeout:30000});ok(true,'constraint switch to any price recomputes');
 optTotal=num((await pg.$$eval('#oxout .kpi',a=>a.map(x=>x.innerText)))[1].split('\n')[0]);console.log('  any-price total',optTotal);
 /* 2. My XI builder */
 await pg.click('#fproot .ctl button:text-is("My XI")');await pg.waitForSelector('#oxmy');
 await pg.click('button:text-is("Start from the optimal XI")');await pg.waitForFunction(()=>/11 \/ 11/.test(document.querySelector('#oxmy').innerText),null,{timeout:30000});
 let kp2=await pg.$$eval('#oxmy .kpi',a=>a.map(x=>x.innerText));ok(Math.abs(num(kp2[1].split('\n')[0])-optTotal)<0.051,'builder loaded from optimal XI has the same total ('+kp2[1].split('\n')[0]+')');
 const chk=await pg.innerText('#oxmy .card');ok(!/✗/.test(chk),'builder checks all pass for the optimal XI');
 // remove the captain, verify the captain check fails and total drops
 const capCard=await pg.$('#oxmy div[onclick^="oxMyTap"]:has(span:text-is("C"))');await capCard.click();await pg.click('#oxmy button:text-is("Remove")');
 kp2=await pg.$$eval('#oxmy .kpi',a=>a.map(x=>x.innerText));ok(/10 \/ 11/.test(kp2[0])&&/no captain/.test(kp2[1]),'removing the captain: 10/11 and "no captain yet"');
 ok(/✗ captain chosen/.test(await pg.innerText('#oxmy .card >> nth=-1'))||/✗ captain chosen/.test(await pg.innerText('#oxmy')),'captain check fails visibly');
 // try to add a 12th-slot violation: add an extra player of a full position
 const posFull=await pg.evaluate(()=>{const d=FPD,my=OX.my,c={1:0,2:0,3:0,4:0};my.ids.forEach(id=>c[d.PB.get(id).ty]++);return c});console.log('  counts after removal',JSON.stringify(posFull));
 await pg.selectOption('#oxpp','1');await pg.waitForTimeout(200);await pg.click('#oxpick button:not([disabled]) >> nth=0');
 ok(/places of .* are filled/.test(await pg.innerText('#oxmsg')),'adding a second goalkeeper is refused with a message: '+(await pg.innerText('#oxmsg')));
 // add a valid player in the empty slot position
 const emptyPos=await pg.evaluate(()=>{const d=FPD,my=OX.my,ks=oxKs(oxFormBy(oxReady(),my.form)),c={1:0,2:0,3:0,4:0};my.ids.forEach(id=>c[d.PB.get(id).ty]++);return [1,2,3,4].find(t=>c[t]<ks[t])});
 await pg.selectOption('#oxpp',String(emptyPos));await pg.waitForTimeout(200);
 const btns=await pg.$$('#oxpick button:not([disabled])');let added=false;for(const bt of btns){await bt.click();if(/added/.test(await pg.innerText('#oxmsg'))){added=true;break}}
 ok(added,'added a replacement: '+(await pg.innerText('#oxmsg')));
 const firstCard=await pg.$('#oxmy div[onclick^="oxMyTap"]');await firstCard.click();await pg.click('#oxmy button:text-is("Make captain")');
 kp2=await pg.$$eval('#oxmy .kpi',a=>a.map(x=>x.innerText));ok(/11 \/ 11/.test(kp2[0])&&/incl. captain/.test(kp2[1]),'11/11 with a captain again; total '+kp2[1].split('\n')[0]);
 const myTotal=num(kp2[1].split('\n')[0]);
 const club=await pg.evaluate(()=>{const d=FPD,my=OX.my,cc={};my.ids.forEach(id=>{const t=d.PB.get(id).tm;cc[t]=(cc[t]||0)+1});return Math.max(...Object.values(cc))});ok(club<=3,'club limit respected in the built XI');
 await pg.fill('#oxsn','UI test XI');await pg.click('button:text-is("Save")');ok(/Saved "UI test XI"/.test(await pg.innerText('#oxmsg')),'lineup saved locally');
 /* formation change blocked when it would drop players */
 const cur=await pg.evaluate(()=>OX.my.form);const other=await pg.evaluate(()=>{const X=oxReady(),c=oxFormOf(OX.my.ids,FPD);return X.forms.find(f=>f.d<c[2]||f.m<c[3]||f.f<c[4]).name});
 await pg.selectOption('#oxfm',other);ok(/Cannot switch/.test(await pg.innerText('#oxmsg'))&&(await pg.evaluate(()=>OX.my.form))===cur,'formation change '+cur+' → '+other+' blocked: '+(await pg.innerText('#oxmsg')));
 /* persistence across reload */
 await pg.reload();await pg.waitForSelector('#fproot .ctl button');await pg.click('#fproot .ctl button:text-is("My XI")');await pg.waitForSelector('#oxmy');
 ok(/11 \/ 11/.test(await pg.innerText('#oxmy .kpi')),'current lineup restored after reload');
 /* 3. comparison */
 await pg.click('#fproot .ctl button:has-text("vs Optimal")');await pg.waitForFunction(()=>document.querySelector('#oxvs')&&/Projected difference/.test(document.querySelector('#oxvs').innerText),null,{timeout:60000});
 const vk=await pg.$$eval('#oxvs .kpi',a=>a.map(x=>x.innerText.replace(/\n/g,' ')));console.log('  compare KPIs:',vk.join(' || '));
 const fn=s=>parseFloat(s.match(/[-+]?\d+\.\d/)[0]);const a=fn(vk[0]),bb=fn(vk[1]),df=fn(vk[2]);ok(Math.abs(Math.round((bb-a)*10)/10-df)<1e-9,`difference ${df} = ${bb} − ${a}`);
 const vt=await pg.innerText('#oxvs');ok(/Only in My XI/.test(vt)&&/Only in the optimal XI/.test(vt)&&/In both lineups/.test(vt),'common and unique players listed');
 await pg.screenshot({path:SH+'vs_desktop.png',fullPage:true});
 /* 4. forecast + chart updates */
 await pg.click('#fproot .ctl button:has-text("Forecast")');await pg.waitForSelector('#oxch svg',{timeout:120000});
 const labels=await pg.$$eval('#oxch svg text',a=>a.map(x=>x.textContent).filter(t=>/^GW\d+$/.test(t)));ok(labels.length===3,'3-GW chart has 3 gameweek labels: '+labels.join(','));
 const path1=await pg.$eval('#oxch svg path[stroke="#3987e5"]',e=>e.getAttribute('d'));
 await pg.hover('#oxchh',{position:{x:30,y:50}});ok(await pg.$eval('#oxcht',e=>e.style.display==='block'&&/GW/.test(e.textContent)),'hover shows crosshair tooltip: '+(await pg.$eval('#oxcht',e=>e.textContent)).slice(0,90));
 await pg.screenshot({path:SH+'forecast_desktop.png',fullPage:false});
 await pg.selectOption('#fpbody .ctl select >> nth=1','7');await pg.waitForSelector('#oxch svg',{timeout:120000});await pg.waitForFunction(()=>[...document.querySelectorAll('#oxch svg text')].filter(t=>/^GW\d+$/.test(t.textContent)).length===7,null,{timeout:120000});ok(true,'horizon 7 redraws with 7 gameweeks');
 // switch to the saved lineup vs current; then change current XI and confirm the chart changes
 await pg.selectOption('#fpbody .ctl select >> nth=1','3');await pg.waitForSelector('#oxch svg',{timeout:120000});
 await pg.evaluate(()=>{const my=OX.my,d=FPD,X=oxReady();const id=my.ids.find(i=>i!==my.cap&&i!==my.vice);const p=d.PB.get(id);const alt=d.P.find(q=>q.ty===p.ty&&!my.ids.includes(q.id)&&oxHasPred(q)&&q.tm!==p.tm&&my.ids.filter(i=>d.PB.get(i).tm===q.tm).length<3&&Math.abs((oxV(q,1)||0)-(oxV(p,1)||0))>0.3);my.ids=my.ids.map(i=>i===id?alt.id:i);oxMyStore();fpRender()});
 await pg.waitForSelector('#oxch svg',{timeout:120000});const path2=await pg.$eval('#oxch svg path[stroke="#3987e5"]',e=>e.getAttribute('d'));ok(path1!==path2,'changing the XI recalculates the forecast line');
 await pg.selectOption('#fpbody .ctl select >> nth=1','1');await pg.waitForFunction(()=>/Next gameweek|next 1 gameweek/i.test(document.querySelector('#fpbody').innerText)&&document.querySelector('#oxfc svg'),null,{timeout:60000});ok(!(await pg.$('#oxch')),'1-GW view shows a range plot instead of a line chart');
 /* 5. existing Fantasy tabs still render */
 for(const t of ['Table','Predicted Points','Best Team','Scatter','Value','Compare','Teams','Fixtures']){await pg.click(`#fproot .ctl button:text-is("${t}")`);await pg.waitForTimeout(t==='Best Team'?6000:400);
  const txt=await pg.innerText('#fpbody');ok(txt.length>40&&!/Could not|failed/i.test(txt),'existing tab renders: '+t)}
 await pg.waitForFunction(()=>/Formation chosen/.test(document.querySelector('#fpbody').innerText)||true);
 /* 6. Backtest + new calibration */
 await pg.click('#fproot .ctl button:text-is("Backtest")');await pg.waitForFunction(()=>/Points accuracy/.test(document.querySelector('#btout').innerText),null,{timeout:60000});ok(true,'existing Backtest renders');
 await pg.click('text=Run calibration and penalty-regression comparison');await pg.waitForFunction(()=>/Lineup ranges/.test(document.querySelector('#btout').innerText),null,{timeout:180000});
 const bt=await pg.innerText('#btout');const seg=bt.slice(bt.indexOf('Points range calibration'));console.log(seg.slice(0,1500));ok(/Points range calibration/.test(bt)&&/Lineup ranges/.test(bt),'calibration rendered');
 /* 7. v2 switch */
 await pg.click('#fproot .ctl button:has-text("Optimal XI")');await pg.waitForFunction(()=>document.querySelector('#oxout')&&/Formation/.test(document.querySelector('#oxout').innerText),null,{timeout:60000});
 await pg.selectOption('#fpbody .ctl select >> nth=-1','v2');await pg.waitForFunction(()=>OX.ver==='v2'&&document.querySelector('#oxout')&&/Formation/.test(document.querySelector('#oxout').innerText),null,{timeout:60000});
 ok(/penalty regression/i.test(await pg.innerText('#fpbody')),'the penalty-regression option (internally v2) can be selected and the XI recomputes');
 await pg.selectOption('#fpbody .ctl select >> nth=-1','v1');await pg.waitForFunction(()=>OX.ver==='v1');
 /* 8. other site pages */
 const pages=await pg.$$eval('#nav a',a=>a.map(x=>x.getAttribute('href')));
 for(const h of pages){await pg.goto(URL+h);await pg.waitForTimeout(900);const t=await pg.innerText('#app');ok(!/Could not load this page/.test(t),'page '+h+' loads')}
 ok(errs.length===0,'no console or page errors'+(errs.length?': '+errs.slice(0,5).join(' | '):''));
 /* 9. mobile */
 const m=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const mp=await m.newPage();const merr=[];mp.on('pageerror',e=>merr.push(e.message));
 await mp.goto(URL+'#/fantasy');await mp.waitForFunction(()=>document.querySelector('#oxout')&&/Formation/.test(document.querySelector('#oxout').innerText),null,{timeout:60000});
 const ov=await mp.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);ok(ov[0]<=ov[1],'no horizontal page scroll on a 390px phone (scrollWidth '+ov[0]+')');
 await mp.screenshot({path:SH+'xi_mobile.png',fullPage:false});
 const pitch=await mp.$eval('#oxout div[style*="aspect-ratio"]',e=>{const r=e.getBoundingClientRect();const cs=[...e.querySelectorAll('div[onclick]')].map(c=>c.getBoundingClientRect());const inside=cs.every(c=>c.left>=r.left-1&&c.right<=r.right+1);let ovl=0;for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){const a=cs[i],b=cs[j];if(a.left<b.right-2&&b.left<a.right-2&&a.top<b.bottom-2&&b.top<a.bottom-2)ovl++}return {w:r.width,inside,ovl}});
 ok(pitch.inside&&pitch.ovl===0,'mobile pitch: cards inside the pitch and not overlapping '+JSON.stringify(pitch));
 await mp.click('#fproot .ctl button:has-text("My XI")');await mp.waitForSelector('#oxmy');await mp.tap('button:text-is("Start from the optimal XI")');await mp.waitForFunction(()=>/11 \/ 11/.test(document.querySelector('#oxmy').innerText),null,{timeout:30000});
 await mp.tap('#oxmy div[onclick^="oxMyTap"] >> nth=3');await mp.waitForSelector('#oxmy button:text-is("Make vice-captain")');ok(true,'mobile: tapping a card opens the action bar');await mp.screenshot({path:SH+'my_mobile.png',fullPage:false});
 const ov2=await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);ok(ov2,'mobile builder: no horizontal page scroll');
 await mp.click('#fproot .ctl button:has-text("Forecast")');await mp.waitForSelector('#oxch svg',{timeout:120000});await mp.screenshot({path:SH+'forecast_mobile.png',fullPage:false});
 ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile forecast: no horizontal page scroll');
 ok(merr.length===0,'mobile: no page errors '+merr.join('|'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();
})().catch(e=>{console.log('CRASH',e.message);process.exit(1)});
