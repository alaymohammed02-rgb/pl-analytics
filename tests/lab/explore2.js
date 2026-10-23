const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8773/index.html',S=__dirname+'/shots/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){
 const ctx=await b.newContext({viewport:{width:vw,height:900}});await ctx.addInitScript(([a])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',a)}},[lang]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/favicon/.test((m.location()||{}).url||''))errs.push(m.text())});
 await pg.goto(U+'#/lab');await pg.waitForSelector('.labtabs',{timeout:60000});await pg.waitForTimeout(1500);await pg.screenshot({path:S+'c_feed0_'+lang+'.png',fullPage:true});
 await pg.evaluate(()=>labTab('arena'));await pg.waitForSelector('#labmx');await pg.selectOption('#labmp','A');await pg.$eval('#labmc',e=>{e.value=60;e.dispatchEvent(new Event('input'))});await pg.click('text=Save prediction >> nth=2').catch(()=>pg.evaluate(()=>labSaveMatch()));await pg.waitForTimeout(800);
 console.log(lang,'match saved:',await pg.evaluate(()=>JSON.stringify(labRead().recs.filter(r=>r.type==='match').map(r=>({mid:r.mid,pr:r.pr,model:r.model&&r.model.p.map(x=>+x.toFixed(3))})))));
 /* sample history: GW7 points predictions, and finished matches in this league and LaLiga, saved before kick-off */
 await pg.evaluate(async()=>{const d=LAB.d,o=labRead(),ps=d.P.filter(p=>labFx(d,p.tm,7).length&&(p.minutes||0)>300).slice(0,24);
  ps.forEach((p,i)=>o.recs.push({id:'t'+i,type:'pts',gw:7,season:labSeason(d),dl:'2026-10-17T10:00:00Z',at:'2026-10-16T12:00:00Z',data:'x',mv:'v2',why:'',p:[p.id],s:[labSnap(d,p,7)],pred:p.ty>=3?5:4}));
  const pm=D.matches.filter(m=>wkSc(m.score)).slice(-4);pm.forEach((m,i)=>o.recs.push({id:'m'+i,type:'match',lid:D.id,lname:D.name,mid:m.match_id,h:m.home,a:m.away,dl:m.date.slice(0,10)+'T23:59:00Z',at:'2026-10-01T00:00:00Z',pick:'H',conf:.6,pr:[.6,.2,.2],model:{p:[.45,.27,.28],lh:1.5,la:1.1,n:[6,6],ver:'xg-poisson-1'},why:''}));
  const la=await (await fetch('data/l_0ErfuF.json')).json(),lm=la.matches.filter(m=>m.s).slice(-2);lm.forEach((m,i)=>o.recs.push({id:'l'+i,type:'match',lid:'l_0ErfuF',lname:'LaLiga',mid:m.i,h:m.h,a:m.a,dl:m.d.slice(0,10)+'T23:59:00Z',at:'2026-10-01T00:00:00Z',pick:'D',conf:.4,pr:[.3,.4,.3],model:null,why:''}));
  o.seen={t:'2026-10-01T00:00:00Z',dna:{}};labWrite(o)});
 for(const t of ['feed','review','week','hidden','case','arena']){await pg.evaluate(t=>labTab(t),t);await pg.waitForTimeout(t==='arena'?1200:2500);await pg.screenshot({path:S+'c_'+t+'_'+lang+'.png',fullPage:true})}
 console.log(lang,'evaluated matches:',await pg.evaluate(()=>JSON.stringify(labRead().recs.filter(r=>r.type==='match'&&r.res).map(r=>[r.lid,r.res.score,r.res.st,+r.res.b.toFixed(2)]))));
 await pg.evaluate(()=>labTab('case'));await pg.waitForTimeout(2000);const btn=await pg.$('.labopts button');if(btn){await btn.click();await pg.waitForTimeout(1500);await pg.screenshot({path:S+'c_case2_'+lang+'.png',fullPage:true})}
 const left=[];for(const t of ['feed','arena','review','dna','week','hidden','case','disc','data']){await pg.evaluate(t=>labTab(t),t);await pg.waitForTimeout(t==='arena'?1000:2200);
  left.push(...await pg.evaluate(()=>{const o=[],w=document.createTreeWalker(document.querySelector('#app'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.replace(/[⁦-⁩]/g,'').trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t))o.push(t)}
   document.querySelectorAll('#app [placeholder],#app option').forEach(i=>{const v=i.placeholder||i.textContent;if(/[A-Za-z]{3}/.test(v)&&!/[؀-ۿ]/.test(v))o.push('ATTR:'+v)});return o}))}
 if(lang==='ar'){const names=await pg.evaluate(()=>[...new Set([...LAB.d.P.map(p=>p.wn),...LAB.d.teams.map(t=>t.n),...D.matches.flatMap(m=>[m.home,m.away])])]);const N=new Set(names);
  fs.writeFileSync(__dirname+'/left2.json',JSON.stringify([...new Set(left)].filter(x=>!N.has(x)),null,1))}
 console.log(lang,'errors',errs);await ctx.close()}
 await b.close()})();
