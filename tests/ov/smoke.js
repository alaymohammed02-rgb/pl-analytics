const {chromium}=require('playwright');const fs=require('fs');
const FX=JSON.parse(fs.readFileSync(__dirname+'/../fx/facts.json','utf8'));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
 const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_0ErfuF');localStorage.setItem('lang',l);
  localStorage.setItem('plx_fav_v1',JSON.stringify({v:1,fav:{l_0ErfuF:'Real Madrid',l_4WFCIZ:'Chelsea'},skip:{},colors:true}))}},[lang]);
 await ctx.route(/data\/index\.json/,async r=>{const res=await r.fetch(),j=await res.json();j.fx='test';r.fulfill({json:j})});
 await ctx.route(/data\/facts\.json/,r=>r.fulfill({json:FX}));
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push(m.text())});
 const th=()=>pg.evaluate(()=>({p:location.hash,lg:document.documentElement.dataset.league,th:getComputedStyle(document.documentElement).getPropertyValue('--th')}));
 await pg.goto('http://127.0.0.1:8765/index.html#/overview');await pg.waitForSelector('#mb .mb-days',{timeout:60000});await pg.waitForSelector('.ovf-c',{timeout:20000}).catch(()=>errs.push('no facts'));await pg.waitForTimeout(800);
 console.log(vw,lang,'overview',JSON.stringify(await th()),await pg.evaluate(()=>({fav:JSON.parse(localStorage.getItem('plx_favs_v2')),chips:[...document.querySelectorAll('.ovt-c a')].map(a=>a.textContent),week:document.querySelectorAll('#ovfx .ovf-c').length,team:[...document.querySelectorAll('.ovf-team h3 a')].map(a=>a.textContent),home:!!document.getElementById('home')})));
 await pg.screenshot({path:__dirname+'/ov_'+vw+'.png',fullPage:true});
 for(const h of ['#/table','#/round']){await pg.evaluate(h=>location.hash=h,h);await pg.waitForTimeout(2500);console.log(' ',JSON.stringify(await th()),h==='#/round'?await pg.evaluate(()=>({home:!!document.querySelector('#home .hsec'),mds:!!document.getElementById('mds'),nav:[...document.querySelectorAll('#nav a')].map(a=>a.getAttribute('href')).slice(0,6)})):'')}
 await pg.screenshot({path:__dirname+'/round_'+vw+'.png'});
 console.log('errors',errs,'noscroll',await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1));await ctx.close()}
 await b.close()})();
