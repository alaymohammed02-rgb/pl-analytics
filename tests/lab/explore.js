const {chromium}=require('/opt/node-tools/node_modules/playwright');
const U='http://127.0.0.1:8773/index.html',S=__dirname+'/shots/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
 const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(([a])=>{localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',a)},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await pg.goto(U+'#/lab');await pg.waitForSelector('.labtabs',{timeout:60000});await pg.waitForTimeout(500);await pg.screenshot({path:S+'arena_'+lang+'.png',fullPage:true});
 const v=await pg.$$eval('#labpl option',a=>a.slice(0,3).map(o=>o.value));console.log(lang,'options',v);
 await pg.fill('#labp1',v[0]);await pg.fill('#labpts','6');await pg.fill('#labwhypts','test reason');await pg.click('text=Save prediction >> nth=0').catch(async()=>{await pg.click('.labforms .card:nth-child(1) button')});await pg.waitForTimeout(500);
 await pg.fill('#labh1',v[1]);await pg.fill('#labh2',v[2]);await pg.selectOption('#labwin','2');await pg.$eval('#labconf',e=>{e.value=70;e.dispatchEvent(new Event('input'))});await pg.click('.labforms .card:nth-child(2) button');await pg.waitForTimeout(500);
 console.log(lang,'msg',await pg.$eval('.labmsg',e=>e.innerText).catch(()=>'-'),'stored',await pg.evaluate(()=>JSON.parse(localStorage.getItem('plx_lab_v1')).recs.length));
 await pg.screenshot({path:S+'arena2_'+lang+'.png',fullPage:true});
 /* inject evaluated history: 30 GW7 points predictions saved before the deadline */
 await pg.evaluate(()=>{const d=LAB.d,o=labRead(),ps=d.P.filter(p=>labFx(d,p.tm,7).length&&(p.minutes||0)>300).slice(0,30);
  ps.forEach((p,i)=>o.recs.push({id:'t'+i,type:'pts',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-16T12:00:00Z',data:'x',mv:'v2',why:'',p:[p.id],s:[labSnap(d,p,7)],pred:p.ty>=3?5:4}));
  for(let i=0;i<24;i+=2)o.recs.push({id:'h'+i,type:'h2h',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-16T12:00:00Z',data:'x',mv:'v2',why:'',p:[ps[i].id,ps[i+1].id],s:[labSnap(d,ps[i],7),labSnap(d,ps[i+1],7)],pick:ps[i].id,conf:.8});
  o.recs.push({id:'late',type:'pts',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-18T12:00:00Z',data:'x',mv:'v2',why:'',p:[ps[0].id],s:[labSnap(d,ps[0],7)],pred:9});labWrite(o)});
 for(const t of ['review','dna','disc','data']){await pg.evaluate(t=>labTab(t),t);await pg.waitForTimeout(t==='disc'?2500:700);await pg.screenshot({path:S+t+'_'+lang+'.png',fullPage:true})}
 if(lang==='ar'){await pg.evaluate(()=>labTab('arena'));await pg.waitForTimeout(600);}
 const left=[];for(const t of ['arena','review','dna','disc','data']){await pg.evaluate(t=>labTab(t),t);await pg.waitForTimeout(t==='disc'?2500:600);
  left.push(...await pg.evaluate(()=>{const o=[],w=document.createTreeWalker(document.querySelector('#app'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[⁦-⁩]/g,'').trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t))o.push(t)}
   document.querySelectorAll('#app input[placeholder]').forEach(i=>{if(/[A-Za-z]{3}/.test(i.placeholder))o.push('PH:'+i.placeholder)});return o}))}
 if(lang==='ar')require('fs').writeFileSync(__dirname+'/left.json',JSON.stringify([...new Set(left)],null,1));
 console.log(lang,'errors',errs);await ctx.close()}
 await b.close()})();
