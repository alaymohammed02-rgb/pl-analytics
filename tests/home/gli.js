const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [port,touch] of [[8778,false],[8777,false],[8778,true],[8777,true]]){
  const ctx=await b.newContext(touch?{viewport:{width:390,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2}:{viewport:{width:1280,height:860}});
  await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')});
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const out=[];for(const h of ['overview','players','shots']){await pg.goto('http://127.0.0.1:'+port+'/index.html#/'+h);await pg.waitForTimeout(3000);
   out.push(h+': '+JSON.stringify(await pg.evaluate(()=>{const g=[...document.querySelectorAll('.gli')].filter(e=>e.offsetParent);if(!g.length)return null;const r=g[0].getBoundingClientRect(),p=g[0].parentElement.getBoundingClientRect(),th=document.querySelector('thead tr');
    const hit=(()=>{const x=r.left+r.width/2+ (r.width/2+4),y=r.top+r.height/2;const e=document.elementFromPoint(x,y);return e===g[0]})();
    return {n:g.length,w:Math.round(r.width),h:Math.round(r.height),parentH:Math.round(p.height),theadH:th?Math.round(th.getBoundingClientRect().height):null,hitOutside:hit}})));
   if(h==='players')await pg.screenshot({path:__dirname+`/shots/gli_${port}_${touch?'m':'d'}.png`,clip:{x:0,y:0,width:touch?390:1280,height:500}})}
  console.log(port,touch?'touch':'desk',out.join(' | '),errs.length?'ERR '+errs[0]:'');await ctx.close()}
 await b.close()})();
