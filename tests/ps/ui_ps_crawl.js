/* Past season: every page in the menu, plus a club, a player and a match page, opens without a page error or "Could not load",
   in English and Arabic, on a 390 px phone (no horizontal scroll). Guarded pages show the plain "not available" card. */
const T=require('../nf/lib.js');const {ok,J,IDX}=T;
(async()=>{
 const S=IDX.seasons||{},lid=Object.keys(S).find(l=>(S[l].past||[]).length),P=S[lid].past[0],L=J(P.file);
 const m=L.matches.find(x=>x.t==='ok'),st=L.stats.find(x=>x.m===m.i&&x.i);
 const b=await T.launch();
 for(const [lang,vw] of [['en',1280],['ar',390]]){
  const {ctx,pg,errs}=await T.open(b,{league:lid,hash:'#/overview',lang,vw,init:{season:P.s}});
  await pg.waitForSelector('#psbar .psb',{timeout:60000});
  const keys=await pg.evaluate(()=>PAGES.map(p=>p[0]));
  const extra=['club/'+encodeURIComponent(m.h),'player/'+encodeURIComponent(st.k+'||'+st.c),'match/'+encodeURIComponent(m.i)];
  const bad=[],guard=[],wide=[];
  for(const k of keys.concat(extra)){
   await pg.goto('http://127.0.0.1:8765/index.html#/'+k);await pg.waitForTimeout(k==='height'||k==='leaguedna'||k==='reportcard'?6000:2500);
   const t=await pg.$eval('#app',e=>e.innerText);
   if(/Could not load this page|تعذر تحميل/.test(t)||t.trim().length<20)bad.push(k);
   if(await pg.$('.psna'))guard.push(k);
   if(vw<=390&&!(await T.noscroll(pg)))wide.push(k);
   if(!(await pg.$eval('#psbar',e=>!e.hidden)))bad.push(k+' (banner gone)');
  }
  ok(!bad.length,lang+': every page opens in the past season ('+keys.length+' pages + club, player, match)'+(bad.length?' — bad: '+bad.join(', '):''));
  console.log('   guarded:',guard.join(', '));
  if(vw<=390)ok(!wide.length,'390 px: no horizontal scroll on any page'+(wide.length?' — '+wide.join(', '):''));
  ok(errs.length===0,lang+': no page errors'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));
  await ctx.close();
 }
 await T.done(b);
})();
