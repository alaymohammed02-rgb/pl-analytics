/* Season switcher: selector next to the league, banner, past-season files used by the pages, guarded pages, back to the current season,
   Arabic and a 390 px phone. Uses the first past season listed in data/index.json (written by the sync). */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
(async()=>{
 const S=IDX.seasons||{},lid=Object.keys(S).find(l=>(S[l].past||[]).length);
 if(!lid){console.log('FAIL no past season in data/index.json');process.exit(1)}
 const P=S[lid].past[0],L=J(P.file),CUR=J(IDX.leagues.find(l=>l.id===lid).file);
 const b=await T.launch();
 /* current season by default */
 let {ctx,pg,errs}=await T.open(b,{league:lid,hash:'#/table'});
 await pg.waitForSelector('#sspick',{timeout:60000});
 const opts=await pg.$$eval('#sspick option',o=>o.map(x=>[x.value,x.textContent]));
 ok(opts[0][0]===''&&/current season/.test(opts[0][1])&&opts.slice(1).map(o=>o[0]).join()===S[lid].past.map(p=>p.s).join(),'selector: current season first, then the past seasons of this league ('+opts.map(o=>o[1]).join(' | ')+')');
 ok(await pg.$eval('#psbar',e=>e.hidden),'no banner in the current season');
 ok(await pg.evaluate(()=>D.matches.length)===CUR.matches.length,'default: the current season\'s matches ('+CUR.matches.length+')');
 /* choose the past season */
 await Promise.all([pg.waitForNavigation(),pg.selectOption('#sspick',P.s)]);
 await pg.waitForFunction(()=>typeof D==='object'&&D&&ALL&&ALL.season,{timeout:60000});
 await pg.waitForSelector('#psbar:not([hidden]) .psb',{timeout:60000});
 const st=await pg.evaluate(()=>({n:D.matches.length,id:D.id,s:ALL.season,sel:document.getElementById('sspick').value,bar:document.getElementById('psbar').innerText,saved:localStorage.getItem('season'),
  m:(ALL.leagues.find(l=>l.id===D.id)||{})}));
 ok(st.n===L.matches.length&&st.id===lid&&st.s===P.s&&st.sel===P.s,'past season: '+st.n+' matches of '+P.s+' loaded under the same league id');
 ok(st.bar.includes(P.s)&&/Back to the current season/.test(st.bar),'banner names the season and offers the way back');
 ok(st.saved===P.s,'the choice is kept on this device');
 ok(['adv_file','pl_file','sh_file'].every(k=>!P[k]||st.m[k]===P[k])&&!st.m.photo_file===!IDX.leagues.find(l=>l.id===lid).photo_file,'the league\'s files are the season\'s files (photos and logos kept)');
 /* the pages read the past season */
 await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('.ltr',{timeout:60000});
 const teams=await pg.$$eval('.lt .ltr:not(.lth)',r=>r.length);
 const want=new Set(L.matches.flatMap(m=>[m.h,m.a])).size;
 ok(teams===want,'league table of the past season: '+teams+' clubs');
 for(const pgk of ['players','shots','matches','luck','thrill','heatmaps']){
  await pg.goto('http://127.0.0.1:8765/index.html#/'+pgk);await pg.waitForTimeout(2500);
  const t=await pg.$eval('#app',e=>e.innerText);ok(!/Could not load this page/.test(t)&&t.length>40,pgk+' draws in the past season');
 }
 for(const pgk of ['fantasy','sim','xi','preview','rare','lab']){
  await pg.goto('http://127.0.0.1:8765/index.html#/'+pgk);await pg.waitForSelector('.psna',{timeout:30000});
  ok(/Not available for a past season/.test(await pg.$eval('#app',e=>e.innerText)),pgk+' says plainly it is not available for a past season');
 }
 /* phone, Arabic */
 await pg.setViewportSize({width:390,height:800});await pg.goto('http://127.0.0.1:8765/index.html#/table');await pg.waitForSelector('#psbar .psb');
 ok(await T.noscroll(pg),'390 px: no horizontal scroll with the selector and banner');
 const box=await pg.$eval('#psback',e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth&&r.height>=30});ok(box,'390 px: the back button is on screen and tappable');
 await pg.evaluate(()=>arToggle());await pg.waitForTimeout(500);
 const ar=await pg.$eval('#psbar',e=>e.innerText);ok(/رجوع للموسم الحالي/.test(ar)&&/تعرض الموسم المنتهي/.test(ar),'Arabic banner');
 await pg.goto('http://127.0.0.1:8765/index.html#/fantasy');await pg.waitForSelector('.psna');ok(/غير متاحة لموسم سابق/.test(await pg.$eval('#app',e=>e.innerText)),'Arabic: page not available');
 await pg.evaluate(()=>arToggle());
 /* back with one tap */
 await Promise.all([pg.waitForNavigation(),pg.click('#psback')]);
 await pg.waitForFunction(()=>typeof D==='object'&&D&&ALL&&D.matches,{timeout:60000});await pg.waitForSelector('#sspick');
 const back=await pg.evaluate(()=>({n:D.matches.length,s:ALL.season||'',bar:document.getElementById('psbar').hidden,saved:localStorage.getItem('season')}));
 ok(back.n===CUR.matches.length&&!back.s&&back.bar&&!back.saved,'one tap back: current season, no banner, choice cleared');
 ok(errs.length===0,'no page errors: '+errs.slice(0,3).join(' | '));
 await ctx.close();
 /* another league without that season, chosen while a past season is shown: back to the current season of that league */
 const other=IDX.leagues.find(l=>l.id!==lid&&!((S[l.id]||{}).past||[]).some(p=>p.s===P.s));
 if(other){({ctx,pg,errs}=await T.open(b,{league:lid,hash:'#/table',init:{season:P.s}}));
  await pg.waitForSelector('#psbar .psb');
  await Promise.all([pg.waitForNavigation(),pg.selectOption('#lgpick',other.id)]);
  await pg.waitForFunction(()=>typeof D==='object'&&D&&D.matches);
  const o=await pg.evaluate(()=>({id:D.id,s:ALL.season||''}));ok(o.id===other.id&&!o.s,'a league without '+P.s+' opens in its current season');await ctx.close()}
 /* leaving before the data arrives, and a failing season file */
 ({ctx,pg,errs}=await T.open(b,{league:lid,hash:'#/table',init:{season:P.s}}));
 await ctx.route('**/data/'+P.file+'*',r=>r.fulfill({status:500,body:'x'}));
 await pg.reload();await pg.waitForTimeout(3000);
 ok(/league file not found|HTTP 500|Could not|No data/.test(await pg.$eval('#app',e=>e.innerText)),'a failing season file shows an error, not a blank page');
 await ctx.close();
 await T.done(b);
})();
