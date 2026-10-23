const {chromium}=require('/opt/node-tools/node_modules/playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',OUT='/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/px/s3_';
const LG=JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/l_4WFCIZ.json','utf8'));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
  const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
  const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push('PE '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text());if(m.type()==='error'&&/404/.test(m.text()))errs.push('404 '+((m.location()||{}).url||''))});
  const shot=async(sel,name)=>{const e=await pg.$(sel);if(e)await e.screenshot({path:OUT+name+'_'+vw+'.png'});else errs.push('missing '+sel)};
  await pg.goto(U+'#/overview');await pg.waitForSelector('#mb .mb-days',{timeout:60000,state:'attached'}).catch(()=>errs.push('no board'));await pg.waitForTimeout(1200);
  await shot('#mb','board');
  await pg.evaluate(()=>location.hash='#/gems');await pg.waitForSelector('#gmout',{timeout:30000}).catch(()=>errs.push('no gems'));await pg.waitForTimeout(800);await shot('#app','gems');
  const s=LG.stats.find(x=>x.i&&x.mi>80);
  const top=await pg.evaluate(()=>{const a=aggPl(PLD).filter(x=>x.p==='MF'&&x.s.mi>=600).sort((x,y)=>y.s.mi-x.s.mi)[0];const s=D.stats.find(z=>z.player_id===a.id);return '#/player/'+encodeURIComponent(s.key+'||'+s.club)});
  await pg.evaluate(h=>location.hash=h,top);await pg.waitForSelector('.dna',{timeout:30000}).catch(()=>errs.push('no dna'));await pg.waitForTimeout(800);await shot('.dna','dna');
  await pg.evaluate(()=>location.hash='#/club/Arsenal');await pg.waitForSelector('.tdna .dna-g',{timeout:30000}).catch(()=>errs.push('no tdna'));await pg.waitForTimeout(800);await shot('.tdna','tdna');
  await pg.evaluate(()=>location.hash='#/reality');await pg.waitForSelector('#rcout .card',{timeout:30000}).catch(()=>errs.push('no reality'));await pg.waitForTimeout(800);await shot('#app','reality');
  console.log(vw,lang,'noscroll',await pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1),'errors:',errs);
  await ctx.close()}
 await b.close()})();
