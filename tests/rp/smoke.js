const {chromium}=require('/opt/node-tools/node_modules/playwright');
const MID=process.argv[2]||'m_2KXrBt',OUT=__dirname+'/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
 const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push('PE '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
 await pg.goto('http://127.0.0.1:8765/index.html#/match/'+MID);await pg.waitForSelector('#mc .rp-go',{timeout:60000}).catch(()=>errs.push('no button'));
 await pg.click('#mc .rp-go');await pg.waitForSelector('#rp .rp-sb',{timeout:30000});
 await pg.selectOption('#rpsp','120');await pg.click('#rpp');await pg.waitForTimeout(9000);
 await pg.screenshot({path:OUT+'mid_'+vw+'.png',fullPage:true});
 await pg.waitForFunction(()=>document.querySelector('#rpclk').textContent==='FT',null,{timeout:120000}).catch(()=>errs.push('no FT'));await pg.waitForTimeout(500);
 await pg.screenshot({path:OUT+'ft_'+vw+'.png',fullPage:true});
 console.log(vw,lang,await pg.evaluate(()=>({sc:document.querySelector('#rpsc').textContent,clk:document.querySelector('#rpclk').textContent,on:document.querySelectorAll('.rp-s.on').length,all:document.querySelectorAll('.rp-s').length,feed:document.querySelectorAll('#rpl li').length,noscroll:document.scrollingElement.scrollWidth<=innerWidth+1})),errs);
 await ctx.close()}
 await b.close()})();
