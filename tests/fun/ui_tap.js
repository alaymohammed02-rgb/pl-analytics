/* Charts: the first tap on a player or a team shows it, the second opens its page; other links unchanged */
const {chromium}=require('playwright');
const U='http://127.0.0.1:8765/index.html';let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
async function open(b,{vw=1280,lang='en',hash='#/reality',mobile=false}={}){const ctx=await b.newContext({viewport:{width:vw,height:900},hasTouch:mobile,isMobile:mobile});
 await ctx.addInitScript(l=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},lang);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+hash);return {ctx,pg,errs}}
const hash=pg=>pg.evaluate(()=>decodeURIComponent(location.hash));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 /* a team in a chart (Reality Check scatter) */
 {const {ctx,pg,errs}=await open(b);await pg.waitForSelector('#app svg a[href^="#/club/"]',{timeout:90000});await pg.waitForTimeout(400);
  const sel='#app svg a[href^="#/club/"]',href=await pg.$eval(sel,a=>a.getAttribute('href'));
  await pg.hover(sel);await pg.click(sel);await pg.waitForTimeout(300);
  ok(await hash(pg)==='#/reality'&&await pg.$eval(sel,a=>a.classList.contains('tap-armed')),'team dot, first click: the page stays, the dot is marked');
  ok(/Tap again to open the team page/.test(await pg.$eval('#instip',t=>t.classList.contains('on')?t.textContent:'')),'and its tooltip says to tap again');
  await pg.click(sel);await pg.waitForTimeout(600);ok(await hash(pg)===decodeURIComponent(href),'second click on the same dot: its team page ('+decodeURIComponent(href)+')');
  await pg.goBack();await pg.waitForSelector(sel,{timeout:60000});await pg.waitForTimeout(400);
  await pg.click(sel);await pg.mouse.click(5,600);await pg.waitForTimeout(200);await pg.click(sel);await pg.waitForTimeout(400);
  ok(await hash(pg)==='#/reality','a click elsewhere in between cancels: the next click only shows again');
  const sel2=`#app svg a[href^="#/club/"]:not([href="${href}"])`;await pg.click(sel2);await pg.waitForTimeout(400);
  ok(await hash(pg)==='#/reality','a different dot after the first: shows it, does not open');
  await pg.focus(sel);await pg.keyboard.press('Enter');await pg.waitForTimeout(600);ok(await hash(pg)===decodeURIComponent(href),'keyboard Enter opens at once');
  await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('#lt .ltr[data-t]',{timeout:60000});
  const tl=await pg.$('#app a[href^="#/club/"]');if(tl){const h=await tl.getAttribute('href');await tl.click();await pg.waitForTimeout(600);ok(await hash(pg)===decodeURIComponent(h),'a team link outside a chart (league table) opens on the first click')}
  else ok(true,'(the league table has no team links)');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* a player in a chart (Hidden Gems bars), on a phone, in Arabic */
 {const {ctx,pg,errs}=await open(b,{vw:390,lang:'ar',hash:'#/gems',mobile:true});await pg.waitForSelector('#app [data-tip] a[href^="#/player/"]',{timeout:90000});await pg.waitForTimeout(400);
  const sel='#app [data-tip] a[href^="#/player/"]',href=await pg.$eval(sel,a=>a.getAttribute('href'));
  await pg.tap(sel);await pg.waitForTimeout(400);
  ok(await hash(pg)==='#/gems','phone, player in a chart, first tap: the page stays');
  {let tx='';for(let i=0;i<15&&!/اضغط مرة ثانية لفتح صفحة اللاعب/.test(tx);i++){if(i)await pg.waitForTimeout(200);tx=await pg.evaluate(()=>{const t=document.getElementById('instip'),b=document.getElementById('tapbub');return (t&&t.classList.contains('on')?t.textContent:'')+(b&&(!b.hidden||document.querySelector('.tap-armed'))?b.textContent:'')})}ok(/اضغط مرة ثانية لفتح صفحة اللاعب/.test(tx),'and says in Arabic: tap again to open the player page (found: "'+tx+'")')}
  await pg.tap(sel);await pg.waitForTimeout(800);ok(await hash(pg)===decodeURIComponent(href),'second tap: the player page');
  ok(await pg.evaluate(()=>!document.querySelector('.tap-armed')&&(!document.getElementById('tapbub')||document.getElementById('tapbub').hidden)),'nothing left marked after leaving');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 /* This round: links with tooltips */
 {const {ctx,pg,errs}=await open(b,{hash:'#/round'});const s=await pg.waitForSelector('#app [data-tip] a[href^="#/player/"], #app a[href^="#/player/"][data-tip], #app [data-tip] a[href^="#/club/"], #app a[href^="#/club/"][data-tip]',{timeout:90000}).catch(()=>null);
  if(s){const h=await s.getAttribute('href');await s.click();await pg.waitForTimeout(400);const st=await hash(pg);await s.click();await pg.waitForTimeout(600);
   const fin=await hash(pg);ok(st==='#/round'&&fin===decodeURIComponent(h),'This round: first click shows, second opens ('+decodeURIComponent(h).slice(0,30)+') after first: '+st+' after second: '+fin)}else ok(false,'no chart link on This round');
  ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)})();
