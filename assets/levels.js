/* ===== Your level: Beginner, Expert or Veteran on the Fantasy page and the Tactics pages =====
   A bar under the page title picks the level; the choice is kept in this browser ('plx_lvl') and holds on every page that has it.
   - Veteran (the default) shows every page exactly as before.
   - Expert hides the most technical columns, sections and tabs, and gives a one-line pointer to what Veteran adds.
   - Beginner shows the essentials only, with a short plain-language guide at the top: what the page answers and what its terms mean.
   Nothing is changed or estimated: a level only hides parts of the page (CSS class lv-x), and Veteran shows them all again.
   The page's own code is untouched: this file reads the page after it is drawn (a DOM observer on #app) and marks what to hide:
   Fantasy tabs by their key, sections by their full heading (an h3 and what follows it up to the next heading, or the card it heads),
   table columns by their header (in English or in its Arabic translation), and KPI tiles and filter rows by how many to keep. */
(function(){
 if(typeof INS!=='object'||typeof PAGES==='undefined')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const KEY='plx_lvl',LV=['b','e','v'];
 const get=()=>{let v=null;try{v=localStorage.getItem(KEY)}catch(e){}return LV.includes(v)?v:'v'};
 const set=v=>{try{localStorage.setItem(KEY,v)}catch(e){}};
 /* per page: what Beginner (b) and Expert (e) hide; Veteran hides nothing */
 const CFG={
  fantasy:{tabs:{b:['xi','cap','my','fixtures'],e:['xi','cap','my','vs','fc','table','pred','best','value','compare','teams','fixtures']},
   sec:{b:['Formation comparison (exact optimum for each)'],e:[]},
   col:{b:['Exp. min','P(play)','Started (last 6)','Data','Set pieces','Minutes','Goals','Assists','Clean sheet','Goals conc.','Saves','Def. contr.','Bonus','Cards/other'],
        e:['Started (last 6)','Data','Set pieces','Goals conc.','Saves','Def. contr.','Cards/other']},
   g:{b:['<b>Fantasy in three steps.</b> 1) <b>Optimal XI</b>: the model\'s best team for the next gameweek within the £100m budget; start there. 2) <b>Captain & form</b>: who to make captain (his points count double). 3) <b>My XI</b>: enter your own team and see what it is expected to score.',
        '<b>Words:</b> <i>expected points</i> = the points the model thinks a player will score next gameweek; <i>£m</i> = his price; <i>Fixture</i> = his next opponent (H at home, A away). <b>Fixtures</b> shows which teams have easy or hard games coming.'],
      e:['Expert shows the forecast for the coming gameweeks, the full player table, value for money and the teams. Veteran adds the model\'s tests (backtest, season review, track record) and every column.']},
      ga:{b:['<b>الفانتازي في ثلاث خطوات.</b> 1) <b>التشكيلة المثالية</b>: أفضل فريق يتوقعه النموذج للجولة الجاية داخل ميزانية <bdi dir="ltr">£100m</bdi>؛ ابدأ منها. 2) <b>القائد والمستوى</b>: مين تخليه كابتن (نقاطه تنحسب مرتين). 3) <b>تشكيلتي</b>: دخّل فريقك وشوف كم متوقع يجيب.',
        '<b>الكلمات:</b> <i>النقاط المتوقعة</i> = النقاط اللي يتوقعها النموذج للاعب في الجولة الجاية؛ <i><bdi dir="ltr">£m</bdi></i> = سعره؛ <i>المباراة</i> = خصمه الجاي (<bdi>H</bdi> على أرضه، <bdi>A</bdi> خارجها). و<b>المباريات</b> توريك أي فرق جاياتها مباريات سهلة أو صعبة.'],
       e:['مستوى الخبير يوريك توقعات الجولات الجاية، وجدول اللاعبين كامل، والقيمة مقابل السعر، والفرق. والمخضرم يضيف اختبارات النموذج (الاختبار الرجعي، مراجعة الموسم، سجل التوقعات) وكل الأعمدة.']}},
  shots:{sec:{b:['Player card','Goal view (where shots crossed the goal line)','By body part','By outcome','By minute','Goal check'],e:['By minute','Goal check']},
   col:{b:['Conv. %','SoT %','npxG','xG/shot','xGOT','G − xG','Box %','Avg dist (m)'],e:['xGOT','Box %','Avg dist (m)']},kpi:{b:4,e:10},ctl:{b:1,e:3},
   g:{b:['<b>Every shot of the season.</b> <i>xG</i> (expected goals) is how likely a shot was to go in, from 0 to 1: 0.10 means one chance in ten. A player with more goals than xG has finished well, or been lucky. Start with the <b>Players</b> table.'],
      e:['Expert adds conversion, shots on target, non-penalty xG and goals minus xG. Veteran adds the goal view, shots by minute, the goal check and every filter.']},
   ga:{b:['<b>كل تسديدات الموسم.</b> <i>xG</i> (الأهداف المتوقعة) هو احتمال إن التسديدة تصير هدف، من 0 إلى 1: يعني 0.10 فرصة من عشر. اللاعب اللي أهدافه أكثر من الـ xG حقه أنهى زين، أو كان محظوظ. ابدأ من جدول <b>اللاعبين</b>.'],
       e:['الخبير يضيف نسبة التحويل، والتسديدات على المرمى، والـ xG بدون ركلات جزاء، والأهداف ناقص الـ xG. والمخضرم يضيف منظر المرمى، والتسديدات حسب الدقيقة، وفحص الأهداف، وكل الفلاتر.']}},
  defense:{sec:{b:['Player card','Team pressing'],e:[]},
   col:{b:['Duels won','Aerials won','Aerials','Aerial %','Def. actions','Opp-half %','Counterpress regains','Recovery time (s)','Avg def. action x (m)','Field tilt %'],e:['Aerials','Aerial %','Opp-half %','Recovery time (s)','Avg def. action x (m)']},
   g:{b:['<b>What each player does without the ball.</b> <i>Tackles</i>: winning the ball from an opponent. <i>Interceptions</i>: cutting out a pass. <i>Blocks</i>: stopping a shot or a pass with the body. <i>Clearances</i>: kicking the ball away from danger. More is not always better: a team that keeps the ball has less defending to do.'],
      e:['Expert adds duels, aerials won and all defensive actions, and the team pressing table. Veteran adds aerial %, the share of actions in the opponent\'s half and the player card.']},
   ga:{b:['<b>إيش يسوي كل لاعب بدون الكرة.</b> <i>الافتكاكات</i>: يخلص الكرة من الخصم. <i>الاعتراضات</i>: يقطع تمريرة. <i>الصدّات</i>: يوقف تسديدة أو تمريرة بجسمه. <i>التشتيت</i>: يبعد الكرة عن الخطر. الأكثر مو دايم أحسن: الفريق اللي يستحوذ على الكرة يدافع أقل.'],
       e:['الخبير يضيف الالتحامات والكرات الهوائية وكل الأفعال الدفاعية، وجدول ضغط الفرق. والمخضرم يضيف نسبة الكرات الهوائية، ونسبة الأفعال في نص ملعب الخصم، وبطاقة اللاعب.']}},
  passing:{sec:{b:['Player card'],e:[]},col:{b:['Progr.','Into box','Through','Crosses','Switches'],e:['Through','Switches']},
   g:{b:['<b>Passing in one match.</b> <i>Passes</i> and <i>Acc %</i>: how many passes and how many reached a team-mate. <i>Key</i>: a pass that led to a shot. <i>Assists</i>: a pass that led to a goal.'],
      e:['Expert adds progressive passes (that move the ball well forward), passes into the box and crosses. Veteran adds through balls, switches of play and the player card.']},
   ga:{b:['<b>التمرير في مباراة وحدة.</b> <i>التمريرات</i> و<i>الدقة %</i>: كم تمريرة وكم وصلت لزميل. <i>المفتاحية</i>: تمريرة جابت تسديدة. <i>الحاسمة</i>: تمريرة جابت هدف.'],
       e:['الخبير يضيف التمريرات التقدمية (اللي تقدّم الكرة كثير لقدام)، والتمريرات داخل المنطقة، والعرضيات. والمخضرم يضيف البينيات، وتحويل اللعب، وبطاقة اللاعب.']}},
  ppda:{sec:{b:['Match pressing card','Teams — season','By match'],e:['By match']},col:{b:['Avg of match PPDA'],e:[]},
   g:{b:['<b>How hard a team presses.</b> <i>PPDA</i> = how many passes the opponent makes, on average, before the team tries to win the ball. <b>Lower = more pressing</b>: around 8 is intense, 15 or more is a team that waits.'],
      e:['Expert adds the match pressing card and the season table. Veteran adds every match.']},
   ga:{b:['<b>قد إيش الفريق يضغط.</b> <i>PPDA</i> = كم تمريرة يسوي الخصم بالمتوسط قبل ما الفريق يحاول يخلص الكرة. <b>الأقل = ضغط أكثر</b>: حوالي 8 ضغط قوي، و15 أو أكثر فريق ينتظر.'],
       e:['الخبير يضيف بطاقة ضغط المباراة وجدول الموسم. والمخضرم يضيف كل مباراة.']}},
  reality:{g:{b:['<b>Goals against xG.</b> A club or player far above its xG has probably been lucky and usually comes back down; far below has been unlucky.'],e:[]},
   ga:{b:['<b>الأهداف مقابل الـ xG.</b> النادي أو اللاعب اللي أهدافه فوق الـ xG بكثير غالبًا محظوظ ويرجع ينزل؛ واللي تحته بكثير منحوس.'],e:[]}},
  heatmaps:{g:{b:['<b>Where the actions happen.</b> The hotter the colour, the more a player or a team did there.'],e:[]},
   ga:{b:['<b>وين تصير الأفعال.</b> كل ما اللون أحرّ، كل ما اللاعب أو الفريق سوّى أكثر في هالمكان.'],e:[]}},
  height:{sec:{b:['The measured part: where it comes from'],e:[]},
   g:{b:['<b>How high a team defends.</b> The distance of its defensive line from its own goal, in metres: higher = it defends further up the pitch. Part of it is an estimate, and the page says how good it is.'],e:[]},
   ga:{b:['<b>قد إيش الفريق يدافع عالي.</b> مسافة خط دفاعه عن مرماه بالمتر: الأعلى = يدافع أبعد لقدام. جزء منه تقدير، والصفحة تقول قد إيش هو دقيق.'],e:[]}},
  keepers:{col:{b:['Starts','xGOT','Per 100 shots'],e:['Per 100 shots']},
   g:{b:['<b>Goals prevented</b> = how many goals a keeper stopped beyond what the shots on target were worth. Positive is better than expected. The <i>Reading</i> column says whether it is more than luck.'],e:[]},
   ga:{b:['<b>الأهداف المنوعة</b> = كم هدف منع الحارس زيادة عن قيمة التسديدات على مرماه. الموجب أحسن من المتوقع. وعمود <i>القراءة</i> يقول إذا هو أكثر من الحظ.'],e:[]}},
  sbpress:{g:{b:['<b>Pressing maps</b> from StatsBomb\'s free data for some tournaments: every dot is a moment a player pressed an opponent.'],e:[]},
   ga:{b:['<b>خرائط الضغط</b> من بيانات StatsBomb المجانية لبعض البطولات: كل نقطة لحظة ضغط فيها لاعب على خصم.'],e:[]}}
 };
 const NAME={b:['Beginner','مبتدئ'],e:['Expert','خبير'],v:['Veteran','مخضرم']};
 const page=()=>((location.hash||'#/overview').split('/')[1]||'overview');
 const clean=s=>String(s||'').replace(/[ⓘ↑↓⁦-⁩]/g,'').replace(/\s+/g,' ').trim();
 const tr=s=>{try{return typeof arT==='function'?arT(s):null}catch(e){return null}};
 /* a header or heading matches a label in English, or in its Arabic translation (the page's text may have been translated in place) */
 const lab=x=>{const e=x.querySelector&&x.querySelector('.fx-en');return clean(e?e.textContent:x.textContent)};
 const same=(t,l)=>t===l||t===clean(tr(l)||'');
 function bar(app,L){
  let b=app.querySelector(':scope > .lv-bar');
  if(!b){b=document.createElement('div');b.className='lv-bar';b.setAttribute('role','group');b.setAttribute('aria-label','Your level');
   b.innerHTML=`<span class="lv-t">${two('Your level','مستواك')}</span>${LV.map(l=>`<button type="button" data-l="${l}">${two(NAME[l][0],NAME[l][1])}</button>`).join('')}`;
   const h=app.querySelector(':scope > h2');if(h)h.after(b);else app.prepend(b)}
  b.querySelectorAll('button').forEach(x=>{const on=x.dataset.l===L;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))});
  return b;
 }
 function guide(app,C,L,b){
  let g=app.querySelector(':scope > .lv-g');const en=C.g&&C.g[L]||[],ar=C.ga&&C.ga[L]||[];
  if(L==='v'||!en.length){if(g)g.remove();return}
  const html=en.map((p,i)=>`<p>${two(p,ar[i]||p)}</p>`).join('');
  if(!g){g=document.createElement('div');g.className='card lv-g';b.after(g)}
  if(g.dataset.l!==L){g.dataset.l=L;g.innerHTML=html}
 }
 function hideSection(h){const p=h.parentElement;
  if(p&&p!==document.getElementById('app')&&(p.matches('section,.card'))&&p.querySelector('h3')===h){p.classList.add('lv-x');return}
  h.classList.add('lv-x');for(let n=h.nextElementSibling;n&&!n.matches('h2,h3');n=n.nextElementSibling)n.classList.add('lv-x')}
 function apply(){
  const app=document.getElementById('app');if(!app)return;const pg=page(),C=CFG[pg];
  app.querySelectorAll('.lv-x').forEach(x=>x.classList.remove('lv-x'));
  if(!C||!app.querySelector(':scope > h2')){document.documentElement.removeAttribute('data-lvl');return}
  const L=get();document.documentElement.dataset.lvl=L;
  const b=bar(app,L);guide(app,C,L,b);
  if(L==='v')return;
  /* Fantasy tabs: the ones of this level only; an open tab the level does not have moves to its first */
  if(C.tabs){const keep=C.tabs[L],row=app.querySelector('#fproot > .ctl');
   if(row){let open=null;row.querySelectorAll('button').forEach(x=>{const m=/fpTab\('(\w+)'\)/.exec(x.getAttribute('onclick')||''),k=x.dataset.cap?'cap':m&&m[1];
     if(!k)return;if(!keep.includes(k)){x.remove();if(typeof FP==='object'&&FP&&FP.tab===k)open=k}});
    if(open&&typeof fpTab==='function'){setTimeout(()=>fpTab(keep[0]),0)}}}
  const S=C.sec&&C.sec[L]||[];
  if(S.length)app.querySelectorAll('h3').forEach(h=>{const t=lab(h);if(S.some(l=>same(t,l)))hideSection(h)});
  const K=C.col&&C.col[L]||[];
  if(K.length)app.querySelectorAll('table').forEach(t=>{const hr=t.querySelector('thead tr')||t.querySelector('tr');if(!hr)return;
   const idx=[];[...hr.cells].forEach((c,i)=>{if(c.tagName==='TH'&&K.some(l=>same(lab(c),l)))idx.push(i)});if(!idx.length)return;
   t.querySelectorAll('tr').forEach(r=>{if(r.cells.length===hr.cells.length)idx.forEach(i=>r.cells[i]&&r.cells[i].classList.add('lv-x'))})});
  if(C.kpi)app.querySelectorAll('.grid').forEach(g=>[...g.querySelectorAll(':scope > .kpi')].forEach((k,i)=>{if(i>=C.kpi[L])k.classList.add('lv-x')}));
  if(C.ctl)[...app.querySelectorAll(':scope > .ctl')].forEach((c,i)=>{if(i>=C.ctl[L])c.classList.add('lv-x')});
 }
 let q=false;
 function run(now){if(now){apply();return}if(q)return;q=true;requestAnimationFrame(()=>{q=false;apply()})}
 /* one listener for the whole document: some pages rebuild their content from its HTML, which drops listeners on the bar's buttons */
 document.addEventListener('click',e=>{const x=e.target.closest&&e.target.closest('.lv-bar button[data-l]');if(!x||x.dataset.l===get())return;set(x.dataset.l);
  /* the page is drawn again (its data is already loaded): tabs a lower level removed come back with a higher one */
  if(typeof route==='function')route();else run(true)});
 INS.level=get;INS.levelApply=apply;
 const start=()=>{const app=document.getElementById('app');if(!app)return false;new MutationObserver(()=>run()).observe(app,{childList:true,subtree:true});run();return true};
 if(!start())document.addEventListener('DOMContentLoaded',start);
 window.addEventListener('hashchange',()=>run());
 INS.ar({'Your level':'مستواك'});
})();
