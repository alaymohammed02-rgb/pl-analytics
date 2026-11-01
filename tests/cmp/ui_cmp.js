const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const FXD=JSON.parse(require('fs').readFileSync((process.env.FIXTURES_DIR||__dirname+'/../fixtures_tmp')+'/cmpweb/data/fixtures.json','utf8')).leagues.l_4WFCIZ[0].d;
const U='http://127.0.0.1:8772/index.html',REPO='http://127.0.0.1:8775/index.html';
async function open(b,{vw=1280,lang='en',league='l_4WFCIZ',url=U,tz='Asia/Riyadh'}={}){const ctx=await b.newContext({viewport:{width:vw,height:900},timezoneId:tz});
 await ctx.addInitScript(([l,a])=>{localStorage.setItem('league',l);localStorage.setItem('lang',a)},[league,lang]);const pg=await ctx.newPage(),errs=[];
 pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi/.test(u+m.text()))errs.push(m.text()+' '+u)});
 await pg.goto(url+'#/overview');await pg.waitForSelector('#app h2',{timeout:60000});return {ctx,pg,errs}}
const go=async(pg,h,sel)=>{await pg.evaluate(x=>location.hash=x,h);await pg.waitForSelector(sel,{timeout:20000});await pg.waitForTimeout(600)};
const lg=async(pg,id)=>{await pg.selectOption('#lgpick',id);await pg.waitForFunction(x=>D.id===x,id);await pg.waitForTimeout(400)};
const noScroll=pg=>pg.evaluate(()=>document.scrollingElement.scrollWidth-innerWidth);
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 for(const [vw,lang] of [[1280,'en'],[390,'ar']]){const {ctx,pg,errs}=await open(b,{vw,lang});const P=vw+' '+lang+': ';
  /* European places in the league table */
  await go(pg,'#/table','#lt .ltr[data-t]');
  const t=await pg.$$eval('#lt .ltr[data-t]',a=>Object.fromEntries(a.map(x=>[x.dataset.t,[...x.querySelectorAll('.eub')].map(e=>e.className.replace('eub ','').trim())])));
  ok(['Arsenal','Manchester City','Liverpool','Aston Villa','Manchester United'].every(n=>t[n].join()==='eub-ucl')&&t['Nottingham Forest'].join()==='eub-uel hold'&&t['Crystal Palace'].join()==='eub-uecl'&&t['Chelsea'].length===0,P+'table: UCL, UEL (holders ring) and UECL marks on exactly the listed clubs');
  const vis=await pg.$$eval('#lt .ltr[data-t] .eub',a=>a.every(e=>{const r=e.getBoundingClientRect(),p=e.closest('.ltt').getBoundingClientRect();return r.width>=13&&r.left>=p.left-1&&r.right<=p.right+1}));ok(vis,P+'every mark is fully visible inside the team cell');
  const leg=await pg.$eval('.eulg',e=>e.innerText);ok(lang==='ar'?/دوري أبطال أوروبا/.test(leg)&&/الدوري الأوروبي/.test(leg)&&/دوري المؤتمر الأوروبي/.test(leg):/Champions League/.test(leg)&&/Europa League/.test(leg),P+'legend under the table: '+leg.replace(/\n/g,' '));
  ok(await noScroll(pg)<=1,P+'table: no horizontal scroll');
  /* fixtures, in the viewer's time zone */
  await go(pg,'#/matches','.fx');const fx=await pg.$$eval('.fxd',a=>{const c=t=>t.replace(/[\u2066-\u2069]/g,'').replace(/\u2011/g,'-');return a.map(d=>[c(d.querySelector('.fxdh').innerText),[...d.querySelectorAll('.fxt')].map(x=>c(x.innerText))])});
  ok(fx.length===3&&fx[0][0]===FXD&&fx[0][1][0]==='14:30'&&fx[2][1].includes('–'),P+'upcoming fixtures by date; 11:30 UTC shown as 14:30 in Riyadh; no time → –');
  ok(await pg.$eval('#app',(e,lang)=>lang==='ar'?/المباريات القادمة/.test(e.innerText)&&/النتائج/.test(e.innerText):/Upcoming fixtures/.test(e.innerText)&&/Results/.test(e.innerText),lang),P+'fixtures above the results');
  ok(await noScroll(pg)<=1,P+'matches: no horizontal scroll');
  await go(pg,'#/club/Arsenal','.clubhd');const ar=await pg.evaluate(()=>({nx:[...document.querySelectorAll('.fxr')].length,eu:[...document.querySelectorAll('.clubeu .eub.big')].map(e=>e.innerText)}));
  ok(ar.nx===2&&ar.eu.length===1&&/Champions League|دوري أبطال أوروبا/.test(ar.eu[0]),P+'Arsenal page: its 2 next matches and a Champions League chip ('+ar.eu.join()+')');
  /* four colours, each as big as its share */
  await lg(pg,'l_0ErfuF');await go(pg,'#/club/'+encodeURIComponent('Real Madrid'),'.clubhd img.clubimg');
  const rm=await pg.evaluate(()=>{const g=getComputedStyle(document.querySelector('.clubst')).backgroundImage,st=[...g.matchAll(/rgb\((\d+), (\d+), (\d+)\) (\d+(?:\.\d+)?)%/g)].map(m=>[m[1]+','+m[2]+','+m[3],+m[4]]);
   const s=getComputedStyle(document.documentElement);return {st,th:s.getPropertyValue('--th').trim(),bg:s.getPropertyValue('--bg').trim(),h:thHsl(s.getPropertyValue('--th').trim())[0]}});
  const seg=[];for(let i=0;i<rm.st.length;i+=2)seg.push([rm.st[i][0],rm.st[i+1][1]-rm.st[i][1]]);
  ok(seg.length===4&&seg.map(x=>x[1]).join()==='58,18,14,10'&&seg[0][0]==='255,255,255'&&seg[3][0]==='238,49,36',P+'Real Madrid stripe: white 58%, gold 18%, blue 14%, red 10% ('+seg.map(x=>x[0]+':'+x[1]).join(' ')+')');
  ok(rm.h>195&&rm.h<225,P+'Real Madrid page lit in its blue (the page is the night green-black '+rm.bg+', buttons '+rm.th+')');
  if(vw===1280){
   for(const [l,n] of [['l_4WFCIZ','Fulham'],['l_0ErfuF','Valencia'],['l_4WFCIZ','Newcastle United'],['l_4QexZg','Nacional']]){await lg(pg,l);await go(pg,'#/club/'+encodeURIComponent(n),'.clubhd');
    const v=await pg.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--th').trim());ok(v==='#ffffff',n+': a small accent does not colour a black-and-white club\'s page ('+v+')')}
   await lg(pg,'l_4WFCIZ');await go(pg,'#/club/'+encodeURIComponent('Aston Villa'),'.clubhd');let v=await pg.evaluate(()=>[getComputedStyle(document.documentElement).getPropertyValue('--th').trim(),thHsl(getComputedStyle(document.documentElement).getPropertyValue('--th').trim())[0]]);
   ok(v[1]>300||v[1]<10,'Aston Villa page in claret ('+v.join(' ')+')');
   /* crest colours for a club not configured */
   await lg(pg,'l_4QexZg');await go(pg,'#/club/Alverca','.clubhd img.clubimg');await pg.waitForTimeout(400);const al=await pg.evaluate(()=>clubCols('Alverca'));
   ok(al&&al.length>=2&&al.length<=4&&Math.abs(al.reduce((a,x)=>a+x.w,0)-100)<=2,'Alverca (not configured): '+al.length+' crest colours with shares '+al.map(x=>x.c+' '+x.w+'%').join(', '));
   const ss=await pg.$eval('.clubst',e=>(getComputedStyle(e).backgroundImage.match(/rgb/g)||[]).length);ok(ss===al.length*2,'its stripe shows each crest colour');
   /* every configured club gets a valid palette that passes contrast */
   const bad=await pg.evaluate(()=>{const o=[];for(const n of Object.keys(THEME.clubs)){const L=thParse(THEME.clubs[n]);const s=L.reduce((a,x)=>a+x.w,0);if(L.length<2||L.length>4||s!==100)o.push(n+' shares '+s);
     const p=thClubPal(n),m=x=>Math.min(thCr(x,p.bg),thCr(x,p.sf));if(m(p.th)<3||thCr(p.ink,p.th)<4.5||m(p.mu)<4.5||m(p.link)<4.5)o.push(n+' contrast')}return [Object.keys(THEME.clubs).length,o]});
   ok(!bad[1].length,bad[0]+' configured clubs: 2–4 colours adding to 100%, every page palette passes contrast '+bad[1].slice(0,5).join('; '));
   /* tournaments */
   await lg(pg,'l_1XLtP0');await go(pg,'#/table','.ltgs');const wc=await pg.evaluate(()=>({g:[...document.querySelectorAll('.ltg')].map(x=>x.querySelectorAll('.ltr[data-t]').length),h:[...document.querySelectorAll('#ltroot h3')].map(x=>x.innerText).filter(x=>!/^Group/.test(x)),arg:!!document.querySelector('.ltr[data-t="Argentina"] .chm'),ko:[...document.querySelectorAll('#ltroot .wrap table')].map(t=>t.querySelectorAll('tr').length-1)}));
   ok(wc.g.length===12&&wc.g.every(x=>x===4),'World Cup: 12 group tables of 4');
   ok(wc.h.join('|')==='Round of 32|Round of 16|Quarter-finals|Semi-finals|Third place and final'&&wc.ko.join()==='16,8,4,2,2','World Cup knockout rounds: '+wc.h.join(', ')+' ('+wc.ko.join(',')+' matches)');
   ok(wc.arg,'World Cup: the defending champion (sample entry) marked in its group');
   await lg(pg,'l_0bfbkO');await go(pg,'#/table','#lt .ltr[data-t]');const ucl=await pg.evaluate(()=>({n:document.querySelectorAll('#lt .ltr[data-t]').length,eub:document.querySelectorAll('#lt .eub-ucl').length,psg:!!document.querySelector('.ltr[data-t="Paris Saint-Germain"] .chm')}));
   ok(ucl.n===36&&ucl.eub===0&&ucl.psg,'Champions League page: 36-club league phase, no Champions League marks on its own page, the holder has the trophy');
   await go(pg,'#/club/'+encodeURIComponent('Paris Saint-Germain'),'.clubhd');ok(/won the 2025-26 final/.test(await pg.innerText('#app')),'holder\'s page says it won last season\'s final');
   /* nothing shown for another season */
   await pg.evaluate(()=>{EURO.d.comps.forEach(c=>c.season='2025-26')});await lg(pg,'l_4WFCIZ');await go(pg,'#/table','#lt .ltr[data-t]');ok(await pg.$$eval('#lt .eub',a=>a.length)===0,'European marks only for the same season as the league data');
  }
  ok(!errs.length,P+'no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 /* the repository as it is before the first sync: empty files, nothing shown, no errors */
 {const {ctx,pg,errs}=await open(b,{url:REPO});await go(pg,'#/table','#lt .ltr[data-t]');ok(await pg.$$eval('#lt .eub',a=>a.length)===0,'before the first sync: no European marks');
  await go(pg,'#/matches','#app h3');ok(/No fixture list in the data yet/.test(await pg.innerText('#app')),'before the first sync: Matches says there is no fixture list yet');
  ok(!errs.length,'before the first sync: no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
 console.log(fails?fails+' FAILED':'all passed');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
