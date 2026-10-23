const {chromium}=require('playwright');
const U='http://127.0.0.1:8773/index.html',S=__dirname+'/shots/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar'],[390,'en']]){
 const ctx=await b.newContext({viewport:{width:vw,height:860}});await ctx.addInitScript(([a])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',a)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/favicon/.test((m.location()||{}).url||''))errs.push(m.text())});
 const tag=vw+lang;
 await pg.goto(U+'#/overview');await pg.waitForSelector('#app h2',{timeout:60000});await pg.waitForTimeout(1500);await pg.screenshot({path:S+'over_'+tag+'.png'});
 console.log(tag,'visible nav:',await pg.$$eval('#nav a',a=>a.filter(x=>x.offsetParent).map(x=>x.textContent).join('|')));
 if(vw<500){await pg.click('.srchbtn')}else await pg.click('#gsq');await pg.keyboard.type('arsen');await pg.waitForTimeout(500);await pg.screenshot({path:S+'search_'+tag+'.png'});
 console.log(tag,'results:',await pg.$$eval('#gsres a',a=>a.map(x=>x.textContent.trim().slice(0,40)).join(' | ')));
 await pg.keyboard.press('ArrowDown');await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Enter');await pg.waitForTimeout(1200);console.log(tag,'went to',await pg.evaluate(()=>location.hash));
 await pg.evaluate(()=>location.hash='#/overview');await pg.waitForTimeout(1500);
 await pg.selectOption('#favpick','Liverpool');await pg.click('#favcard button');await pg.waitForTimeout(2000);await pg.screenshot({path:S+'fav_'+tag+'.png',fullPage:false});
 await pg.click((vw<500?'#secbar':'#secnav')+' button[data-k="league"]');await pg.waitForTimeout(1800);await pg.screenshot({path:S+'table_'+tag+'.png'});
 console.log(tag,'hash',await pg.evaluate(()=>location.hash),'favrow',await pg.$$eval('.favrow',a=>a.length));
 await pg.click((vw<500?'#secbar':'#secnav')+' button[data-k="players"]');await pg.waitForTimeout(1800);const g=await pg.$('.gli');if(g){await g.click();await pg.waitForTimeout(300)}await pg.screenshot({path:S+'gloss_'+tag+'.png'});
 console.log(tag,'gloss',await pg.$$eval('.gli',a=>a.map(x=>x.dataset.t).join(',')),await pg.$eval('#glpop',e=>e.textContent).catch(()=>'-'));
 console.log(tag,'errors',errs);await ctx.close()}
 await b.close()})();
