const {chromium}=require('/opt/node-tools/node_modules/playwright');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const U='http://127.0.0.1:8771/index.html';
async function open(b,{vw=1280,lang='en',league='l_0ErfuF'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,a])=>{localStorage.setItem('league',l);localStorage.setItem('lang',a)},[league,lang]);const pg=await ctx.newPage(),errs=[];
 pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+'#/overview');await pg.waitForSelector('#app h2',{timeout:60000});return {ctx,pg,errs}}
const go=async(pg,h,sel)=>{await pg.evaluate(x=>location.hash=x,h);try{await pg.waitForSelector(sel,{timeout:20000})}catch(e){console.log('STALL at',h,'waiting',sel,'| hash',await pg.evaluate(()=>location.hash),'| app',(await pg.innerText('#app')).slice(0,80).replace(/\n/g,' '));throw e}await pg.waitForTimeout(500)};
const vars=pg=>pg.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {th:s.getPropertyValue('--th').trim(),bg:s.getPropertyValue('--bg').trim(),ink:s.getPropertyValue('--th-ink').trim()}});
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const {ctx,pg,errs}=await open(b,{vw,lang});
  /* league logo in the header: start side (left in English, right in Arabic) */
  await pg.waitForFunction(()=>{const i=document.getElementById('lglogo');return i&&!i.hidden&&i.complete&&i.naturalWidth>0},null,{timeout:20000});
  const r=await pg.evaluate(()=>{const i=document.getElementById('lglogo').getBoundingClientRect(),w=document.querySelector('.top b').getBoundingClientRect(),m=document.getElementById('mnubtn').getBoundingClientRect();return {x:i.left,r:i.right,w:innerWidth,bx:w.left,bw:w.width,ml:m.left,mr:m.right}});
  ok(lang==='ar'?r.r<=r.ml&&r.r>r.ml-30&&(r.bw<=1||r.x>r.bx):r.x>=r.mr&&r.x<r.mr+30&&(r.bw<=1||r.x<r.bx),vw+' '+lang+': league logo at the top '+(lang==='ar'?'right':'left')+', right after the ☰ menu button and before the name ('+Math.round(r.x)+'–'+Math.round(r.r)+' of '+r.w+')');
  /* club logos next to the names */
  await go(pg,'#/table','#lt .ltr[data-t]');const t=await pg.$$eval('#lt .ltr[data-t]',a=>Object.fromEntries(a.map(x=>[x.dataset.t,!!x.querySelector('img.clogo')])));
  ok(t['Barcelona']&&t['Real Madrid']&&t['Atlético Madrid']&&!t['Elche'],'table: logos next to Barcelona, Real Madrid, Atlético; none for a club without one');
  await go(pg,'#/teams','#app table');ok((await pg.$$('#app table img.clogo')).length===3,'Teams page: the 3 logos');
  /* club page drawn in the crest colours */
  await go(pg,'#/club/Barcelona','.clubhd img.clubimg');await pg.waitForTimeout(300);let v=await vars(pg);
  const hue=await pg.evaluate(x=>thHsl(x)[0],v.th);ok((hue>190&&hue<240)||hue>300||hue<20,'Barcelona page in its crest colours (buttons '+v.th+', page '+v.bg+')');
  const cr=await pg.evaluate(()=>{const s=getComputedStyle(document.documentElement),g=k=>s.getPropertyValue(k).trim(),m=x=>Math.min(thCr(x,g('--bg')),thCr(x,g('--sf')));return {btn:m(g('--th')),ink:thCr(g('--th-ink'),g('--th')),mu:m(g('--mu')),link:m(g('--th-link'))}});
  ok(cr.btn>=3&&cr.ink>=4.5&&cr.mu>=4.5&&cr.link>=4.5,'Barcelona palette passes contrast '+JSON.stringify(Object.fromEntries(Object.entries(cr).map(([k,x])=>[k,+x.toFixed(1)]))));
  await go(pg,'#/club/'+encodeURIComponent('Atlético Madrid'),'.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);const h2=await pg.evaluate(x=>thHsl(x),v.th);
  ok((h2[0]<15||h2[0]>345)&&h2[1]>.5,'Atlético page in red ('+v.th+')');
  await go(pg,'#/club/Elche','.clubhd');v=await vars(pg);ok(v.th==='#07903f','Elche (no logo): its configured kit colours, green ('+v.th+')');
  if(vw===1280){/* other leagues */
   await pg.selectOption('#lgpick','l_1Isor4');await pg.waitForFunction(()=>D.id==='l_1Isor4');await go(pg,'#/club/'+encodeURIComponent('Borussia Dortmund'),'.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);
   const hd=await pg.evaluate(x=>thHsl(x)[0],v.th);ok(hd>40&&hd<65,'Dortmund page in yellow ('+v.th+', text '+v.ink+')');
   await go(pg,'#/club/'+encodeURIComponent('Bayern München'),'.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);const hb=await pg.evaluate(x=>thHsl(x)[0],v.th);ok(hb<15||hb>340,'Bayern page in red ('+v.th+')');
   await pg.selectOption('#lgpick','l_0ALvwF');await pg.waitForFunction(()=>D.id==='l_0ALvwF');await go(pg,'#/club/Juventus','.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);
   ok(v.th==='#ffffff'&&/#1[0-9a-f]{5}/.test(v.bg),'Juventus (black and white crest): neutral page, white buttons ('+v.th+' on '+v.bg+')');
   const hl=await pg.evaluate(()=>document.getElementById('lglogo').src.slice(0,30));ok(/^data:image\/png/.test(hl),'header logo follows the selected league');
   await pg.selectOption('#lgpick','l_4WFCIZ');await pg.waitForFunction(()=>D.id==='l_4WFCIZ');await go(pg,'#/club/Arsenal','.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);
   ok(v.th==='#ea0107','Arsenal keeps its configured kit colours even with a logo ('+v.th+')');
   /* crest colours for clubs without configured kit colours */
   await pg.selectOption('#lgpick','l_4QexZg');await pg.waitForFunction(()=>D.id==='l_4QexZg');await go(pg,'#/club/Alverca','.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);
   const ha=await pg.evaluate(x=>thHsl(x)[0],v.th);ok(ha<15||ha>340,'Alverca (no configured colours): page in its crest red ('+v.th+')');
   await go(pg,'#/club/'+encodeURIComponent('Casa Pia AC'),'.clubhd img.clubimg');await pg.waitForTimeout(300);v=await vars(pg);ok(v.th==='#ffffff','Casa Pia (black and white crest, no configured colours): neutral page ('+v.th+' on '+v.bg+')');
   await go(pg,'#/club/Nacional','.clubhd');v=await vars(pg);ok(v.th==='#ffffff','Nacional (configured black and white, no logo): neutral page');
   await go(pg,'#/club/Marítimo','.clubhd');v=await vars(pg);{const h=await pg.evaluate(x=>thHsl(x)[0],v.th);ok(h<15||h>340,'Marítimo (no logo here, configured red and green): page in its red ('+v.th+')')}
   await pg.selectOption('#lgpick','l_3FJFUl');await pg.waitForFunction(()=>D.id==='l_3FJFUl');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>document.getElementById('lglogo').hidden),'league without logos: header logo hidden, no broken image');
   /* palette safety for any crest: 400 random colour pairs */
   const fz=await pg.evaluate(()=>{let bad=0;let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647,hx=()=>'#'+[0,0,0].map(()=>Math.floor(r()*256).toString(16).padStart(2,'0')).join('');
    for(let i=0;i<400;i++){const p=thPalette(hx(),{},hx()),m=x=>Math.min(thCr(x,p.bg),thCr(x,p.sf));if(!(m(p.th)>=3&&thCr(p.ink,p.th)>=4.5&&m(p.mu)>=4.5&&m(p.link)>=4.5&&m(p.hi)>=3&&m(p.tx)>=7))bad++}return bad});
   ok(fz===0,'400 random crest colour pairs: every generated page passes the contrast rules ('+fz+' failures)')
   await pg.selectOption('#lgpick','l_0ErfuF');await pg.waitForFunction(()=>D.id==='l_0ErfuF')}
  for(const h of ['#/overview','#/table','#/club/Barcelona']){await go(pg,h,'#app h2');const ov=await pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);ok(ov<=1,vw+'px '+h+': no horizontal scroll ('+ov+')')}
  await go(pg,'#/club/Barcelona','.clubhd');await pg.screenshot({path:__dirname+'/lg_'+vw+'_'+lang+'.png'});
  ok(!errs.length,vw+' '+lang+': no page errors '+errs.slice(0,2).join(' | '));await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
