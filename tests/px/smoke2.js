const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',OUT='/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/px/s2_';
const FX=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/fixtures.json','utf8'));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
  const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push('PE '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
  const shot=async(sel,name)=>{const e=await pg.$(sel);if(e)await e.screenshot({path:OUT+name+'_'+vw+'.png'});else errs.push('missing '+sel)};
  await pg.goto(U+'#/overview');await pg.waitForSelector('#totr .tr-pitch',{timeout:60000,state:'attached'}).catch(()=>errs.push('no totr'));await pg.waitForTimeout(1500);
  await shot('#totr','totr');
  const f=FX.leagues.l_4WFCIZ.find(x=>Date.parse(x.k)>Date.now());
  await pg.evaluate(h=>location.hash=h,'#/preview/'+f.i);await pg.waitForSelector('#pvroot .mc-score',{timeout:30000}).catch(()=>errs.push('no preview'));await pg.waitForTimeout(1500);await shot('#app','preview');
  await pg.evaluate(h=>location.hash=h,'#/club/'+encodeURIComponent(f.h));await pg.waitForSelector('#clx .clx-g',{timeout:30000}).catch(()=>errs.push('no clx'));await pg.waitForTimeout(1200);await shot('#clx','club');
  await pg.evaluate(()=>location.hash='#/ratings');await pg.waitForSelector('#rtout table',{timeout:30000}).catch(()=>errs.push('no ratings'));await pg.waitForTimeout(800);await shot('#app','ratings');
  await pg.evaluate(()=>location.hash='#/halves');await pg.waitForSelector('#hvroot .hv-t',{timeout:30000}).catch(()=>errs.push('no halves'));await pg.waitForTimeout(800);await shot('#app','halves');
  await pg.evaluate(()=>location.hash='#/fantasy');await pg.waitForSelector('#fproot [data-cap]',{timeout:60000}).catch(()=>errs.push('no cap btn'));await pg.click('#fproot [data-cap]').catch(()=>{});await pg.waitForSelector('.fc-l',{timeout:60000}).catch(()=>errs.push('no cap'));await pg.waitForTimeout(800);await shot('#fpbody','fantasy');
  console.log(vw,lang,'sw',await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),'errors:',errs);
  await ctx.close()}
 await b.close()})();
