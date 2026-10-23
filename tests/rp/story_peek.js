const {chromium}=require('/opt/node-tools/node_modules/playwright');
const IDS=process.argv.slice(2);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const lang of ['en','ar']){const ctx=await b.newContext({viewport:{width:1280,height:900}});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 for(const id of IDS){await pg.goto('http://127.0.0.1:8765/index.html#/match/'+id);await pg.waitForSelector('#mc .ms',{timeout:60000}).catch(()=>errs.push('no story '+id));
  console.log('\n['+lang+'] '+id+'\n'+await pg.evaluate(l=>{const e=document.querySelector('#mc .ms '+(l==='ar'?'.ms-ar':'.ms-en'));return e?e.innerText:'(none)'},lang))}
 if(lang==='en')await pg.locator('#mc .ms').screenshot({path:__dirname+'/story_en.png'});
 console.log('errors',errs);await ctx.close()}
 await b.close()})();
