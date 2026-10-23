const {chromium}=require('playwright');const fs=require('fs');
const URL='http://127.0.0.1:8765/index.html',SH=__dirname+'/shots/';
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const REV=JSON.parse(fs.readFileSync((process.env.PLREPO||__dirname+'/..')+'/data/fpl_review.json','utf8'));
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
  const ctx=await b.newContext({viewport:{width:vw,height:900}});const pg=await ctx.newPage();const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
  await pg.goto(URL+'#/fantasy');await pg.waitForSelector('#fproot .ctl button',{timeout:60000});
  if(lang==='ar'){await pg.click('#langbtn');await pg.waitForTimeout(500)}
  const tabs=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));
  ok(tabs.includes(lang==='ar'?'مراجعة الموسم':'Season review'),vw+' '+lang+': current season has the Season review tab ('+tabs.length+' tabs)');
  await pg.selectOption('select[aria-label="Season"], select[aria-label="الموسم"]','2024-25');await pg.waitForTimeout(1500);
  const tabs2=await pg.$$eval('#fproot .ctl button',a=>a.map(x=>x.textContent));
  const tr=lang==='ar'?'مراجعة الموسم':'Season review';ok(tabs2.includes(tr),'archived season 2024-25 has the tab: '+tabs2.join(' | '));
  await pg.click(`#fproot .ctl button:text-is("${tr}")`);await pg.waitForSelector('#srout .kpi',{timeout:30000});
  const R=REV.seasons['2024-25'],sum=(L,k)=>L.reduce((a,x)=>a+(x[k]||0),0);
  let k=await pg.$$eval('#srout .kpi b',a=>a.map(x=>x.textContent.replace(/[⁦-⁩]/g,'')));
  ok(+k[0]===sum(R.fixed,'act')&&Math.abs(+k[1]-sum(R.fixed,'exp'))<0.051&&+k[3]===sum(R.opt,'pts')&&+k[4]===sum(R.ft,'act'),'fixed view KPIs = precomputed totals ('+k.join(', ')+')');
  const rows=await pg.$$eval('#srout table',t=>t.map(x=>x.querySelectorAll('tr').length));ok(rows[0]===16&&rows[1]===R.fixed.length+2,'squad table 15 players, gameweek table '+R.fixed.length+' rows + total ('+rows.join(',')+')');
  const paths=await pg.$$eval('#srch svg path',a=>a.length);ok(paths>=R.fixed.length,'chart drawn: 2 lines + Δ bars ('+paths+' paths)');
  await pg.check('#sro');await pg.waitForTimeout(300);const st=await pg.$$eval('#srch svg path[stroke="#199e70"]',a=>a.length);ok(st===1,'best-XI line toggles on');
  await pg.$eval('#srch',e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(200);const box=await pg.$('#srch svg');const bb=await box.boundingBox();await pg.mouse.move(bb.x+bb.width*0.5,bb.y+bb.height*0.5);await pg.waitForTimeout(200);
  const tip=await pg.$eval('#srcht',e=>e.style.display==='block'?e.innerText:'');ok(/GW|ج/.test(tip)&&tip.split('\n').length>=4,'hover tooltip shows the gameweek values: '+tip.replace(/\n/g,' / '));
  await pg.selectOption('#srv','ft');await pg.waitForTimeout(400);k=await pg.$$eval('#srout .kpi b',a=>a.map(x=>x.textContent.replace(/[⁦-⁩]/g,'')));
  ok(+k[0]===sum(R.ft,'act')&&+k[4]===sum(R.fixed,'act'),'free-transfer view KPIs ('+k.join(', ')+')');
  const ncol=await pg.$$eval('#srout table:nth-of-type(2) tr:first-child th',a=>a.length).catch(()=>0);
  const txt=await pg.innerText('#srout');ok(lang==='ar'?/→/.test(txt):/→/.test(txt)&&/banked/.test(txt),'transfers listed per gameweek');
  const ov=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(ov<=1,vw+'px: no horizontal page scroll ('+ov+')');
  await pg.screenshot({path:SH+'review_'+vw+'_'+lang+'.png',fullPage:false});
  await pg.$eval('#srch',e=>e.scrollIntoView());await pg.screenshot({path:SH+'review_chart_'+vw+'_'+lang+'.png'});
  if(lang==='ar'){/* untranslated text in the review: Latin words that are not names, team codes or units */
   const names=new Set(await pg.evaluate(()=>FPD.P.flatMap(p=>[p.name,p.tn,p.tf])));
   const left=await pg.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.querySelector('#fpbody'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[⁦-⁩]/g,'').trim();if(/[A-Za-z]{2}/.test(t)&&!/[؀-ۿ]/.test(t))o.push(t)}return [...new Set(o)]});
   const bad=left.filter(t=>!names.has(t)&&!/^(GW|xG|xA|FPL|PitchAPI|£|v\d|Model v\d)/.test(t)&&!t.split(/ → |,\s*/).every(x=>names.has(x.trim())));
   ok(!bad.length,'Arabic: every review text is translated'+(bad.length?' — left: '+JSON.stringify(bad.slice(0,30)):''));fs.writeFileSync(require('os').tmpdir()+'/ar_review_left.json',JSON.stringify(bad,null,1))}
  if(vw===1280){/* the page's own code recomputes the season on this device and gets the precomputed file */
   const t0=Date.now();const got=await pg.evaluate(async()=>{const R=await srRun(FPD);return [R.fixed.reduce((a,x)=>a+x.act,0),R.ft.reduce((a,x)=>a+x.act,0),R.opt.reduce((a,x)=>a+x.pts,0),JSON.stringify(R)]});
   ok(got[0]===sum(R.fixed,'act')&&got[1]===sum(R.ft,'act')&&got[2]===sum(R.opt,'pts')&&got[3].replace(/(\d\.\d{6})\d+/g,'$1')===JSON.stringify(R).replace(/(\d\.\d{6})\d+/g,'$1'),'browser recomputation is identical to data/fpl_review.json ('+((Date.now()-t0)/1000).toFixed(0)+'s)');
   /* current season: the button runs it on the device */
   await pg.selectOption('select[aria-label="Season"]','');await pg.waitForTimeout(1500);await pg.click('#fproot .ctl button:text-is("Season review")');await pg.waitForSelector('#srout button');
   await pg.click('#srout button');await pg.waitForFunction(()=>document.querySelector('#srout .kpi')||/Could not/.test(document.querySelector('#srout').innerText),null,{timeout:600000});
   const cur=await pg.innerText('#srout');ok(/Actual points/.test(cur),'current season review runs on the device: '+cur.split('\n').slice(0,2).join(' | '));
   await pg.screenshot({path:SH+'review_current.png'});}
  ok(!errs.length,vw+' '+lang+': no page errors '+errs.slice(0,3).join(' | '));
  await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
