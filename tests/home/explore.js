const {chromium}=require('/opt/node-tools/node_modules/playwright');
const U='http://127.0.0.1:8777/index.html',S=__dirname+'/shots/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang,lg] of [[1280,'en','l_4WFCIZ'],[390,'ar','l_4WFCIZ'],[1280,'en','l_0ErfuF']]){
 const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(([a,l])=>{localStorage.clear();localStorage.setItem('league',l);localStorage.setItem('lang',a)},[lang,lg]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.stack.split('\n').slice(0,2).join(' / ')));pg.on('console',m=>{if(m.type()==='error'&&!/favicon|missing.png/.test(m.text()+((m.location()||{}).url||'')))errs.push(m.text())});
 await pg.goto(U+'#/overview');await pg.waitForSelector('#home .hsec',{timeout:60000});await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{const f=document.getElementById('hfpl');if(f)f.scrollIntoView()});await pg.waitForTimeout(2500);await pg.evaluate(()=>scrollTo(0,0));
 await pg.screenshot({path:S+`home_${vw}_${lang}_${lg}.png`,fullPage:true});
 console.log(vw,lang,lg,await pg.evaluate(()=>({secs:[...document.querySelectorAll('#home .hsec h2')].map(h=>h.textContent),hero:(document.querySelector('.hmain')||{}).innerText?.slice(0,160).replace(/\n/g,' '),stars:[...document.querySelectorAll('.hstar .hk')].map(x=>x.textContent),photos:document.querySelectorAll('.hph').length,sw:document.scrollingElement.scrollWidth-innerWidth})));
 console.log('  errors',errs);await ctx.close()}
 await b.close()})();
