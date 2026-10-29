/* Your level (assets/levels.js): Veteran by default (every tab, column and section as before, no guide); Beginner and Expert on the Fantasy
   page (which tabs stay, the Optimal XI columns, the formation comparison, the guide) and on the Shots, Defensive, Passing, Pressing and
   Goalkeepers pages (sections, columns, KPI tiles, filter rows), checked against the page's own Veteran view so nothing else disappears;
   the level is kept across pages and a reload; a tab the level does not have moves to its first tab; back to Veteran shows everything;
   Arabic (the same parts hidden while the page is translated), 390 px, no errors. */
const T=require('../nf/lib.js');const {ok}=T;
const LG='l_4WFCIZ';
const view=pg=>pg.evaluate(()=>{const vis=e=>!!e.offsetParent||getComputedStyle(e).display!=='none'&&e.getClientRects().length>0;
 const en=x=>{const e=x.querySelector('.fx-en');return (e?e.textContent:x.textContent).replace(/[ⓘ↑↓⁦-⁩]/g,'').replace(/\s+/g,' ').trim()};
 return {tabs:[...document.querySelectorAll('#fproot > .ctl button')].map(b=>{const m=/fpTab\('(\w+)'\)/.exec(b.getAttribute('onclick')||'');return b.dataset.cap?'cap':m&&m[1]}),
  th:[...document.querySelectorAll('#app th')].filter(vis).map(en),allTh:[...document.querySelectorAll('#app th')].map(en),
  h3:[...document.querySelectorAll('#app h3')].filter(vis).map(en),kpi:[...document.querySelectorAll('#app .grid > .kpi')].filter(vis).length,
  ctl:[...document.querySelectorAll('#app > .ctl')].filter(vis).length,guide:(document.querySelector('.lv-g')||{}).textContent||'',
  colHid:[...new Set([...document.querySelectorAll('#app th.lv-x')].filter(t=>!t.closest('table').closest('.lv-x')&&!t.closest('table').classList.contains('lv-x')).map(en))].sort(),
  bar:[...document.querySelectorAll('.lv-bar button')].map(b=>[b.dataset.l,b.getAttribute('aria-pressed')]),lvl:document.documentElement.dataset.lvl||null}});
const pick=async(pg,l)=>{await pg.click(`.lv-bar button[data-l="${l}"]`);await pg.waitForFunction(l=>document.documentElement.dataset.lvl===l&&document.querySelector('.lv-bar button.on')&&document.querySelector('.lv-bar button.on').dataset.l===l,l,{timeout:30000});await pg.waitForTimeout(700)};
const go=async(pg,h,sel)=>{await pg.evaluate(x=>location.hash=x,h);await pg.waitForSelector(sel,{timeout:90000,state:'attached'});await pg.waitForTimeout(1500)};
const minus=(a,b)=>a.filter(x=>!b.includes(x));
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/fantasy'});await pg.waitForSelector('#fproot > .ctl button',{timeout:90000});await pg.waitForTimeout(1500);
 /* ---- Veteran by default: the page as it was ---- */
 const V=await view(pg);
 ok(V.lvl==='v'&&V.tabs.length>=17&&!V.guide&&JSON.stringify(V.bar)==='[["b","false"],["e","false"],["v","true"]]','default Veteran: '+V.tabs.length+' Fantasy tabs, no guide, the bar marks Veteran');
 ok(JSON.stringify(V.th)===JSON.stringify(V.allTh),'Veteran hides no column ('+V.th.length+' headers)');
 /* ---- Beginner ---- */
 await pick(pg,'b');let B=await view(pg);
 ok(JSON.stringify(B.tabs)==='["xi","cap","my","fixtures"]','Beginner: four Fantasy tabs (Optimal XI, Captain & form, My XI, Fixtures)');
 ok(/Fantasy in three steps/.test(B.guide)&&/expected points/.test(B.guide),'Beginner: the plain guide to the page and its words');
 const xiB=B.th.slice(0,7);ok(JSON.stringify(xiB)==='["Pos","Player","Club","£m","Fixture","Total","Main reasons"]','Beginner: the Optimal XI table keeps position, player, club, price, fixture, total and reasons ('+xiB.join(', ')+')');
 ok(!B.h3.includes('Formation comparison (exact optimum for each)')&&B.h3.includes('Optimal Starting XI — Next Gameweek'),'Beginner: the formation comparison is hidden, the XI stays');
 /* ---- Expert ---- */
 await pick(pg,'e');let E=await view(pg);
 ok(JSON.stringify(E.tabs)==='["xi","cap","my","vs","fc","table","pred","best","value","compare","teams","fixtures"]','Expert: twelve tabs ('+E.tabs.length+')');
 ok(['Exp. min','P(play)','Goals','Assists','Clean sheet','Bonus'].every(x=>E.th.includes(x))&&!['Started (last 6)','Set pieces','Def. contr.'].some(x=>E.th.includes(x))&&E.h3.includes('Formation comparison (exact optimum for each)'),'Expert: minutes, chance to play, goals, assists, clean sheet and bonus come back; the most technical columns stay hidden');
 ok(/Veteran adds/.test(E.guide),'Expert: a one-line pointer to what Veteran adds');
 /* a tab Beginner does not have moves to the first tab */
 await pg.evaluate(()=>fpTab('table'));await pg.waitForTimeout(800);await pick(pg,'b');await pg.waitForTimeout(800);
 ok(await pg.evaluate(()=>FP.tab)==='xi','switching to Beginner on the Table tab opens the Optimal XI');
 /* ---- the Tactics pages at Beginner, against their Veteran view ---- */
 const PG=[['#/shots','#sout table',{h3:['Player card','Goal view (where shots crossed the goal line)','By body part','By outcome','By minute','Goal check'],th:['Conv. %','SoT %','npxG','xG/shot','xGOT','G − xG','Box %','Avg dist (m)'],kpi:4,ctl:1}],
  ['#/defense','#dout table',{h3:['Player card','Team pressing'],th:['Duels won','Aerials won','Aerials','Aerial %','Def. actions','Opp-half %']}],
  ['#/passing','#nout table',{h3:['Player card'],th:['Progr.','Into box','Through','Crosses','Switches']}],
  ['#/ppda','#app h3',{h3:['Match pressing card','Teams — season','By match'],th:[]}],
  ['#/keepers','.gk-t tbody tr',{h3:[],th:['Starts','xGOT','Per 100 shots']}]];
 for(const [h,sel,W] of PG){await go(pg,h,sel);await pg.waitForTimeout(2000);const b_=await view(pg);await pick(pg,'v');await go(pg,h,sel);await pg.waitForTimeout(2000);const v=await view(pg);await pick(pg,'b');await go(pg,h,sel);await pg.waitForTimeout(1500);
  const goneH=minus(v.h3,b_.h3),goneT=b_.colHid;
  ok(JSON.stringify(goneH.sort())===JSON.stringify(W.h3.filter(x=>v.h3.includes(x)).sort()),h+' Beginner: exactly these sections hidden: '+(goneH.join(', ')||'none'));
  ok(JSON.stringify(goneT)===JSON.stringify(W.th.filter(x=>v.th.includes(x)).sort())&&goneT.every(x=>!b_.th.includes(x)),h+' Beginner: exactly these columns hidden in the tables it shows: '+(goneT.join(', ')||'none'));
  if(W.kpi)ok(b_.kpi===W.kpi&&v.kpi>W.kpi&&b_.ctl===W.ctl&&v.ctl>W.ctl,h+' Beginner: '+W.kpi+' of '+v.kpi+' tiles and '+W.ctl+' of '+v.ctl+' filter rows');
  ok(b_.guide.length>40&&!v.guide,h+' Beginner has a guide, Veteran none')}
 /* kept on reload */
 await pg.reload();await pg.waitForSelector('.lv-bar',{timeout:90000});await pg.waitForTimeout(1500);ok((await view(pg)).lvl==='b','the level is kept after a reload');
 /* pages without levels have no bar */
 await go(pg,'#/table','.lt');ok(!(await pg.$('.lv-bar'))&&!(await pg.evaluate(()=>document.documentElement.dataset.lvl)),'a page without levels (the table) has no bar');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* ---- Arabic, phone ---- */
 const PH={};
 for(const lang of ['ar','en']){const {ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/fantasy',init:{plx_lvl:'b'}});await pg.waitForSelector('#fproot > .ctl button',{timeout:90000});await pg.waitForTimeout(2000);
  const A=await view(pg);ok(JSON.stringify(A.tabs)==='["xi","cap","my","fixtures"]',lang+': Beginner from the saved choice, four tabs');
  if(lang==='en')ok(JSON.stringify(A.th.slice(0,7))==='["Pos","Player","Club","£m","Fixture","Total","Main reasons"]','en: the Beginner Optimal XI columns');
  PH[lang]={th:A.th.length,hid:A.colHid.length,h3:A.h3.length};
  if(lang==='ar'){ok(/الفانتازي في ثلاث خطوات/.test(A.guide)&&/مستواك/.test(await pg.textContent('.lv-bar')),'Arabic: the guide and the bar are in Arabic');
   const u=await pg.evaluate(T.untr,'.lv-bar, .lv-g');ok(!u.length,'Arabic: bar and guide translated '+u.slice(0,3).join(' | '))}
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  await go(pg,'#/shots','#sout table');await pg.waitForTimeout(1500);ok(await T.noscroll(pg)&&(await view(pg)).kpi===4,lang+' phone: Shots at Beginner, no horizontal scroll');
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await pg.screenshot({path:__dirname+'/lvl_390_'+lang+'.png',fullPage:false});await ctx.close()}
 ok(PH.ar.th===PH.en.th&&PH.ar.hid===PH.en.hid&&PH.ar.hid>0&&PH.ar.h3===PH.en.h3,'Arabic: the same columns and sections are hidden while the page is translated ('+JSON.stringify(PH)+')');
 await T.done(b)})();
