const {chromium}=require('playwright');
const U='http://127.0.0.1:8765/index.html',OUT=require('os').tmpdir()+'/px_';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
  const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())});
  await pg.goto(U+"#/overview");await pg.waitForSelector("#potr .potr-c",{timeout:60000,state:"attached"});await pg.waitForTimeout(1500);
  await pg.screenshot({path:OUT+`home_${vw}.png`,fullPage:false});
  const potr=await pg.$('#potr:not([hidden])');if(potr)await potr.screenshot({path:OUT+`potr_${vw}.png`});
  const mds=await pg.$('#mds');if(mds)await mds.screenshot({path:OUT+`mds_${vw}.png`});
  // match with mx data
  const mid=await pg.evaluate(async()=>{const x=await mxLoad();return Object.keys(x.m)[0]});
  await pg.evaluate(id=>location.hash='#/match/'+id,mid);await pg.waitForSelector('#mc .mc-score',{timeout:30000});await pg.waitForTimeout(1500);
  await (await pg.$('#mc')).screenshot({path:OUT+`match_${vw}.png`});
  // player: motm of that match
  const href=await pg.evaluate(()=>{const a=document.querySelector('.mc-motm a');return a&&a.getAttribute('href')});
  if(href){await pg.evaluate(h=>location.hash=h,href);await pg.waitForSelector('#pp .pp-head',{timeout:30000});await pg.waitForTimeout(1500);await (await pg.$('#pp')).screenshot({path:OUT+`player_${vw}.png`})}
  console.log(vw,lang,'mid',mid,'player',href,'errors:',errs.slice(0,8));
  await ctx.close()}
 await b.close()})();
