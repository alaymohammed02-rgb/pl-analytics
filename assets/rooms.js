/* ===== Rooms: the site's structure, one front door per question =====
   The site had 66 pages in nine hubs whose names were analysts' words, so a visitor could not tell where anything was. Here every page keeps its own address and its own code,
   and the pages are put into six ROOMS by what a person comes to do:
     Home      today's matches and your teams            League   the table, the matches, the title race
     Clubs     profiles, strength, home and rest         Players  find, the best, compare, does it repeat
     Tactics   attack, defence, passing, pressing        Play     Fantasy, games, predictions, stories
   Each room has GROUPS (a few pages that answer neighbouring questions) and a LANDING page (#/r-league ...): a card for every page with what it answers, in a plain sentence in English
   and Arabic, and one live line where the data gives one (the leader of the table, the next match, the strongest club...). A search box on the landing page filters its cards.
   Every other part of the page chrome reads this table: the room bar (top on a wide screen, bottom on a phone), the bar of sibling pages above a page, the menu (a site map),
   the search (it finds pages by what they answer) and the "Where next?" cards under a page. A page the table does not list does not disappear: the menu adds it to Home.
   Nothing here draws data of its own beyond the live lines; the pages are untouched. */
(function(){
 if(typeof UI_SEC==='undefined'||typeof PAGES==='undefined'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const arName=n=>(typeof arT==='function'&&arT(n))||n;
 /* small line icons (24 x 24) */
 const M={
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
  trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  star:'<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z"/>',
  bars:'<path d="M5 20V10M12 20V4M19 20v-7M3 20h18"/>',
  line:'<path d="M3 17l5-6 4 3 8-9M3 21h18"/>',
  pitch:'<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/><path d="M3 9.5h3v5H3M21 9.5h-3v5h3"/>',
  heat:'<circle cx="9" cy="10" r="4.5"/><circle cx="15" cy="14" r="3.5"/><circle cx="16" cy="8" r="2"/>',
  versus:'<circle cx="8.5" cy="12" r="5.5"/><circle cx="15.5" cy="12" r="5.5"/>',
  crystal:'<circle cx="12" cy="10" r="6.5"/><path d="M7 20h10M9 17l-1 3M15 17l1 3M9.5 8.5a3 3 0 0 1 3-1.5"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.6-1.2-1.6 0-2.6.8-2.6 2s1 1.7 2.7 2.1c1.7.4 2.7.9 2.7 2.2s-1.1 2-2.8 2c-1.2 0-2.2-.5-2.8-1.4M12 6v2M12 16v2"/>',
  cards:'<rect x="4" y="5" width="11" height="15" rx="2"/><path d="M9 3h9a2 2 0 0 1 2 2v12"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  network:'<circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="12" cy="18" r="2.3"/><path d="M8 8l8-1.5M7 9l4 7M17 8l-4 8"/>',
  question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
  calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  bolt:'<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  repeat:'<path d="M17 4l3 3-3 3M20 7H8a4 4 0 0 0-4 4M7 20l-3-3 3-3M4 17h12a4 4 0 0 0 4-4"/>',
  diamond:'<path d="M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 5 3-5"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>',
  slides:'<rect x="3" y="5" width="13" height="14" rx="2"/><rect x="8" y="3" width="13" height="14" rx="2"/>',
  path:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  build:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="8" r="1.2"/><circle cx="7" cy="12" r="1.2"/><circle cx="17" cy="12" r="1.2"/><circle cx="9" cy="16" r="1.2"/><circle cx="15" cy="16" r="1.2"/>',
  book:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>',
  scale:'<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z"/>',
  pad:'<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>',
  home:'<path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10"/>'};
 const svg=(k,cls)=>`<svg viewBox="0 0 24 24" class="${cls||'rm-i'}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${M[k]||M.question}</svg>`;
 /* [page key, icon, what it answers (English), (Arabic)] */
 const P=(k,i,e,a,kw)=>[k,i,e,a,kw||''];
 const ROOMS=[
  {k:'home',n:['Home','الرئيسية'],d:['Today\'s matches, your teams and a way in to everything.','مباريات اليوم وفرقك وبداية لكل شي.'],ic:'home',groups:[
   {k:'today',n:['Today','اليوم'],p:[
    P('overview','calendar','Every match of the day, with your teams first','كل مباريات اليوم، وفريقك أول'),
    P('ask','question','Ask a question in plain words and get the numbers','اسأل بكلامك العادي وخذ الأرقام')]},
   {k:'site',n:['The site','الموقع'],p:[
    P('settings','gear','The leagues the site follows, when its data was updated, and which matches have complete data','الدوريات اللي يتابعها الموقع ووقت آخر تحديث، وأي مباريات بياناتها كاملة')]}]},
  {k:'league',n:['League','الدوري'],d:['The table, every match, and who is going to win it.','الجدول وكل المباريات ومين راح يفوز باللقب.'],ic:'trophy',groups:[
   {k:'standings',n:['Standings','الترتيب'],p:[
    P('table','table','Who is top, who is in the fight, who is in danger?','مين فوق، ومين في المنافسة، ومين في الخطر؟'),
    P('luck','scale','Who has more or fewer points than their chances deserve?','مين نقاطه أكثر أو أقل مما تستاهله فرصه؟')]},
   {k:'matches',n:['Matches','المباريات'],p:[
    P('matches','calendar','What is coming up, and every result so far','وش جاي، وكل النتائج لحد الحين'),
    P('round','star','The round at a glance: stars, surprises, the best XI','الجولة بنظرة: النجوم والمفاجآت وأفضل تشكيلة'),
    P('xi','pitch','Who is likely to start the next match?','مين المتوقع يلعب أساسي في المباراة الجاية؟'),
    P('stakes','target','Which coming matches can swing the title, the top four or relegation?','أي مباريات جاية ممكن تقلب اللقب أو المراكز الأربعة أو الهبوط؟'),
    P('whatif','crystal','Change one shot of a match and watch the score and the table move','غيّر تسديدة وحدة في مباراة وشوف النتيجة والجدول كيف يتحركون'),
    P('thrill','bolt','Which matches were the most thrilling, and which one to watch next?','أي المباريات كانت الأكثر إثارة، وأي وحدة تتفرج عليها؟'),
    P('states','repeat','Who rescues points from behind and who throws them away?','مين ينقذ نقاط وهو متأخر ومين يضيّعها؟'),
    P('late','clock','Which clubs win or lose points to late goals?','أي الأندية تكسب أو تخسر نقاط بأهداف متأخرة؟')]},
   {k:'race',n:['Title race','سباق اللقب'],p:[
    P('race','line','Watch the table change week by week, or go back to any day and see the table and the odds as they were','شوف الجدول يتغير أسبوع بأسبوع، أو ارجع لأي يوم وشوف الجدول والاحتمالات كيف كانت'),
    P('runin','target','How hard are the matches each club still has to play?','كم صعبة المباريات اللي باقية لكل نادي؟'),
    P('sim','crystal','Play the rest of the season thousands of times: who wins?','العب باقي الموسم آلاف المرات: مين يفوز؟')]},
   {k:'stories',n:['Stories of the season','حكايات الموسم'],p:[
    P('heartbeat','line','How surprising was the season, match by match?','كم كان الموسم مفاجئ، مباراة بمباراة؟'),
    P('rare','diamond','What happens about once a season, or less?','وش اللي يصير مرة بالموسم أو أقل؟')]}]},
  {k:'clubs',n:['Clubs','الأندية'],d:['Every club: how it plays, how strong it is, and who it resembles.','كل نادي: كيف يلعب وكم قوته ومين يشبهه.'],ic:'shield',groups:[
   {k:'profiles',n:['Club profiles','ملفات الأندية'],p:[
    P('teams','shield','Open any club: squad, results, table and what is next','افتح أي نادي: التشكيلة والنتائج والجدول والجاي'),
    P('shape','pitch','Where do a club\'s starters actually play?','وين يلعب لاعبو النادي الأساسيين فعلًا؟'),
    P('halves','clock','How do clubs start and finish matches: first half against second?','كيف تبدأ الأندية وتنهي المباريات: الشوط الأول مقابل الثاني؟')]},
   {k:'strength',n:['Strength','القوة'],p:[
    P('elo','bars','How strong is every club, and who is rising?','كم قوة كل نادي ومين صاعد؟'),
    P('river','line','Watch every club\'s strength rise and fall over time','شوف قوة كل نادي تطلع وتنزل مع الوقت'),
    P('leaguedna','network','How differently do the six leagues play?','كم تختلف الدوريات الستة في أسلوب اللعب؟'),
    P('carry','person','Does a club\'s attack rest on one player?','هل هجوم النادي معتمد على لاعب واحد؟')]},
   {k:'compare',n:['Compare clubs','قارن الأندية'],p:[
    P('h2h','versus','Two clubs head to head: record, goals, who is stronger today','نادين وجهًا لوجه: السجل والأهداف ومين أقوى اليوم'),
    P('clubtwins','versus','Which club in the six leagues plays like yours?','أي نادي في الدوريات الستة يلعب مثل ناديك؟')]},
   {k:'home',n:['Home, rest and money','البيت والراحة والمال'],p:[
    P('fortress','shield','Is a club stronger at home, and does it last?','هل النادي أقوى في ملعبه، وهل يستمر؟'),
    P('rest','clock','Does a short break between matches change the result?','هل الراحة القصيرة بين المباريات تغيّر النتيجة؟'),
    P('value','coin','Does a bigger squad value buy more points?','هل قيمة التشكيلة الأكبر تشتري نقاط أكثر؟')]}]},
  {k:'players',n:['Players','اللاعبون'],d:['Find a player, see who is best, compare, and ask what lasts.','ابحث عن لاعب، وشوف مين الأفضل، وقارن، واسأل وش اللي يدوم.'],ic:'person',groups:[
   {k:'find',n:['Find a player','ابحث عن لاعب'],p:[
    P('players','person','Every player, sortable by xT, xG and more','كل اللاعبين، وتقدر ترتبهم بـxT وxG وغيرها'),
    P('story','book','One player\'s season told in facts, with a card to share','موسم لاعب واحد بالحقائق، مع بطاقة تشاركها'),
    P('career','path','A player\'s seasons side by side across leagues','مواسم اللاعب جنب بعض عبر الدوريات')]},
   {k:'best',n:['The best','الأفضل'],p:[
    P('rankings','bars','Who leads on each measure?','مين الأول في كل مقياس؟'),
    P('ratings','star','Who has the best match ratings this season?','مين أعلى تقييم في المباريات هذا الموسم؟'),
    P('toty','trophy','The best XI of the season by rating','أفضل تشكيلة للموسم حسب التقييم'),
    P('gems','diamond','Strong players the goals and assists do not show','لاعبين أقوياء الأهداف والتمريرات الحاسمة ما تبين مستواهم')]},
   {k:'compare',n:['Compare and look-alikes','قارن وشبيه اللاعب'],p:[
    P('compare','scale','Put players or teams side by side on any measures','حط لاعبين أو أندية جنب بعض على أي مقاييس'),
    P('twins','versus','Who plays most like him? The quick version, or pick the stats you care about','مين يلعب أكثر شي مثله؟ بالنسخة السريعة أو باختيار الإحصائيات اللي تهمك')]},
   {k:'market',n:['Market','السوق'],p:[
    P('prices','coin','What are the players worth?','كم قيمة اللاعبين؟')]},
   {k:'repeat',n:['Does it repeat?','هل يتكرر؟'],p:[
    P('stability','repeat','Which numbers repeat from season to season, and which are luck?','أي الأرقام تتكرر من موسم لموسم وأيها حظ؟'),
    P('keepsup','line','Who is likely to keep it up next season?','مين المتوقع يحافظ على مستواه الموسم الجاي؟'),
    P('bench','person','How much do substitutes really add?','كم يضيف البدلاء فعلًا؟')]}]},
  {k:'tactics',n:['Tactics','التكتيك'],d:['How the game is played: shots, defending, passing and pressing.','كيف تُلعب المباراة: التسديدات والدفاع والتمرير والضغط.'],ic:'pitch',groups:[
   {k:'attack',n:['Attack','الهجوم'],p:[
    P('shots','target','Every shot on the pitch, with its xG','كل تسديدة على الملعب مع xG'),
    P('reality','scale','Goals against chances: who scored more or less than expected?','الأهداف مقابل الفرص: مين سجّل أكثر أو أقل من المتوقع؟'),
    P('heatmaps','heat','Where players and clubs act, match by match and over the season','وين يلعب اللاعبون والأندية، مباراة بمباراة وعلى الموسم')]},
   {k:'defence',n:['Defence','الدفاع'],p:[
    P('defense','shield','Tackles, interceptions and duels, with a player card','التدخلات والاعتراضات والالتحامات، مع بطاقة لاعب'),
    P('height','line','How high does a team defend?','كم يرفع الفريق خط دفاعه؟'),
    P('keepers','person','Which goalkeepers save more than expected?','أي حراس يصدون أكثر من المتوقع؟')]},
   {k:'passing',n:['Passing','التمرير'],p:[
    P('passing','network','Pass networks: who connects the team?','شبكات التمرير: مين يربط الفريق؟')]},
   {k:'pressing',n:['Pressing','الضغط'],p:[
    P('ppda','network','How hard does each team press, match by match, plus pressure maps from StatsBomb\'s open competitions','كم قوة ضغط كل فريق، مباراة بمباراة، مع خرائط الضغط من مسابقات StatsBomb المفتوحة')]}]},
  {k:'play',n:['Play','العب'],d:['Fantasy, games, predictions and your season as a story.','الفانتازي والألعاب والتوقعات وموسمك كقصة.'],ic:'pad',groups:[
   {k:'fantasy',n:['Fantasy','الفانتازي'],p:[
    P('fantasy','star','Pick your Fantasy team with the best predictions','اختر فريق الفانتازي بأفضل التوقعات'),
    P('share','coin','Who carries his team\'s attack, and at what price?','مين يحمل هجوم فريقه وبأي سعر؟')]},
   {k:'games',n:['Games','ألعاب'],p:[
    P('guess','question','One mystery player a day: guess in six tries','لاعب غامض كل يوم: خمّن في ست محاولات'),
    P('cards','cards','Player cards from real numbers, head to head','بطاقات لاعبين من أرقام حقيقية، وجهًا لوجه'),
    P('builder','build','Build your dream XI from six leagues','كوّن تشكيلتك الحلم من ستة دوريات'),
    P('battle','versus','Two XIs against each other: who wins?','تشكيلتين ضد بعض: مين يفوز؟')]},
   {k:'predict',n:['Predict','توقّع'],p:[
    P('beat','crystal','Predict scores and try to beat the model','توقّع النتائج وحاول تغلب النموذج'),
    P('lab','flask','Your predictions against the model, fixture by fixture','توقعاتك ضد النموذج، مباراة بمباراة'),
    P('reportcard','gear','How accurate is the model, honestly?','كم دقة النموذج، بصراحة؟')]},
   {k:'stories',n:['Stories','قصص'],p:[
    P('wrapped','slides','Your club\'s or a player\'s season as story slides','موسم ناديك أو لاعب كشرائح قصة')]}]}];
 /* the room tiles and the landing cards need these */
 const ENT=new Map(),GRP=new Map();
 ROOMS.forEach(r=>r.groups.forEach(g=>g.p.forEach(e=>{ENT.set(e[0],{room:r,group:g,e});GRP.set(r.k+'-'+g.k,g)})));
/* extra words a person might type for a page (English and Arabic), beside its name and its answer: the menu's box and the search find a page by them too */
 const KW={sim:'title champions champion winner forecast odds probability simulation لقب بطل توقع احتمال محاكاة',stakes:'title relegation top four european places swing لقب هبوط',
  prices:'market value worth price transfermarkt money سعر قيمة سوقية',career:'last season previous seasons history over the years past تاريخ مواسم سابقة الماضي',race:'title champions top of the table time machine any day back in time لقب آلة الزمن',
  table:'standings positions points ranking ترتيب نقاط',matches:'fixtures schedule results scores نتائج جدول مباريات',h2h:'derby rivalry head to head record rivals',toty:'team of the year best eleven best xi',
  guess:'wordle daily quiz puzzle لغز يومي',twins:'similar like look like replacement alternative lookalike',keepers:'goalkeeper keeper saves gloves حارس',
  heatmaps:'heat map positions where touches خريطة حرارية',shots:'shot map xg chances تسديدات',elo:'rating power ranking strength تصنيف',stability:'luck skill reliable noise sample',
  fantasy:'fpl captain transfers team picks',wrapped:'recap review story share instagram',compare:'versus side by side',xi:'lineup line-up predicted starting eleven',ppda:'press pressure intensity maps statsbomb ضغط خرائط',
  gems:'underrated undervalued hidden',rest:'tired fatigue schedule congestion',value:'money budget spend expensive',fortress:'home advantage away form',heartbeat:'surprises upsets shocks',
  thrill:'exciting entertaining best matches',settings:'language notifications leagues sync data availability coverage missing complete'};
 Object.entries(KW).forEach(([k,v])=>{const o=ENT.get(k);if(o)o.e[4]=v});
 const landing=r=>'r-'+r.k;
 const href=r=>r.k==='home'?'#/overview':'#/'+landing(r);
 /* where next: a few pages from other rooms that continue the question (curated; a page with none shows none) */
 const NEXT={table:['race','sim','luck'],race:['sim','runin','stakes'],sim:['stakes','race','elo'],luck:['reality','states','table'],matches:['round','thrill','xi'],round:['toty','thrill','stakes'],
  teams:['shape','elo','h2h'],elo:['river','h2h','value'],h2h:['elo','clubtwins','fortress'],fortress:['rest','halves','value'],value:['prices','table','elo'],
  players:['career','story','twins'],story:['career','cards','twins'],career:['stability','keepsup','story'],rankings:['ratings','gems','toty'],ratings:['toty','gems','cards'],gems:['twins','stability','prices'],
  twins:['compare','career','story'],stability:['keepsup','keepers','bench'],keepsup:['stability','career','prices'],prices:['value','gems','career'],
  shots:['reality','heatmaps','passing'],heatmaps:['shape','shots','defense'],defense:['height','keepers','ppda'],passing:['carry','shots','ppda'],ppda:['height','defense','keepers'],
  fantasy:['share','beat','ratings'],beat:['lab','reportcard','fantasy'],cards:['builder','battle','story'],builder:['battle','cards','toty'],guess:['wrapped','cards','career'],wrapped:['story','guess','cards']};
 /* ---------- the structure the rest of the site reads ---------- */
 const SEC=ROOMS.map(r=>{const g=r.groups.map(x=>({k:r.k+'-'+x.k,n:x.n[0],p:x.p.map(e=>e[0])}));return {k:r.k,n:r.n[0],g,p:(r.k==='home'?[]:[landing(r)]).concat(g.flatMap(x=>x.p)),
   ic:`<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${M[r.ic]}</g>`}});
 UI_SEC.length=0;UI_SEC.push(...SEC);
 /* pages the other files have added to PAGES but that are not in the table yet go to Home, so none is lost (the menu does the same) */
 const MERGED={looklike:'twins',sbpress:'ppda',data:'settings',timemachine:'race'};   /* pages that became tabs of another page (assets/merged.js): their addresses still open it */
 const known=new Set([...ENT.keys(),...Object.keys(MERGED)]);
 if(typeof UI_ALIAS==='object')Object.assign(UI_ALIAS,{club:'teams',player:'players',match:'matches',recap:'matches',replay:'matches',preview:'matches',looklike:'twins',sbpress:'ppda',data:'settings',timemachine:'race'});
 window.uiGo=function(k){const r=ROOMS.find(x=>x.k===k);if(r)location.hash=href(r)};
 /* ---------- the bar above a page: back to the room, and the pages of the same group ---------- */
 const pgName=k=>{const p=PAGES.find(x=>x[0]===k);return p?p[1]:k};
 const label=k=>two(esc(pgName(k)),esc(arName(pgName(k))));
 /* the room buttons (top bar on a wide screen, bottom bar on a phone) are built once by the inline script from the old sections; rebuild them from the rooms */
 function roomBtns(){
  const want=ROOMS.map(r=>r.k).join();
  ['secnav','secbar'].forEach(id=>{const nv=document.getElementById(id);if(!nv||nv.dataset.rm===want+(ar()?'a':'e'))return;nv.dataset.rm=want+(ar()?'a':'e');
   nv.innerHTML=ROOMS.map(r=>`<button type="button" data-k="${r.k}" onclick="uiGo('${r.k}')"><svg viewBox="0 0 24 24" aria-hidden="true">${SEC.find(x=>x.k===r.k).ic}</svg><span>${two(esc(r.n[0]),esc(r.n[1]))}</span></button>`).join('');nv.setAttribute('aria-label','Rooms')});
  const pg=typeof uiPage==='function'?uiPage():'',sp=(typeof UI_ALIAS==='object'&&UI_ALIAS[pg])||pg,o=ENT.get(sp),rk=o?o.room.k:(/^r-/.test(pg)?pg.slice(2):'home');
  document.querySelectorAll('#secnav button,#secbar button').forEach(b=>{const on=b.dataset.k===rk;b.classList.toggle('on',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 }
 function bar(){
  roomBtns();
  const hb=document.getElementById('hubbar');if(!hb||typeof uiPage!=='function')return;
  const pg=uiPage(),sp=(typeof UI_ALIAS==='object'&&UI_ALIAS[pg])||pg;
  /* the inline script keeps its own key of what it drew in data-k and redraws when it differs: set it to the one it would compute, so it leaves this bar alone while the page is the same
     (a layout read while a page is being redrawn moves the scroll position, and this bar is looked at on every redraw) */
  const sec=typeof uiSecOf==='function'?uiSecOf(pg):null,okey=sec?sec.k+'|'+sp+'|'+sec.p.filter(k=>PAGES.some(p=>p[0]===k)).join():'';
  if(/^r-/.test(pg)||!ENT.get(sp)){if(!hb.hidden||hb.innerHTML){hb.hidden=true;hb.innerHTML=''}hb._rm='';hb.dataset.k=okey;return}
  const o=ENT.get(sp),sib=o.group.p.map(e=>e[0]),key='rm|'+o.room.k+'|'+sp+'|'+(ar()?'a':'e');
  if(hb._rm===key&&hb.dataset.k===okey&&!hb.hidden&&!hb.classList.contains('two'))return;   /* 'two' = the inline script drew its own two-row bar over this one */
  hb.classList.remove('two');
  hb.innerHTML=(o.room.k==='home'?'':`<a class="hb-back" href="${href(o.room)}" aria-label="${esc(o.room.n[0])}">${two('‹ '+esc(o.room.n[0]),'› '+esc(o.room.n[1]))}</a>`)+
   (sib.length>1?sib.map(k=>`<a href="#/${k}"${k===sp?' class="on" aria-current="page"':''}>${label(k)}</a>`).join(''):'');
  hb.hidden=false;hb._rm=key;hb.dataset.k=okey;
  /* centre the open chip sideways only (scrollIntoView would also move the page up to the bar) */
  const on=hb.querySelector('a.on');if(on&&hb.scrollWidth>hb.clientWidth){const hr=hb.getBoundingClientRect(),or=on.getBoundingClientRect();hb.scrollLeft+=(or.left+or.width/2)-(hr.left+hr.width/2)}
  if(typeof lglKick==='function')lglKick();
 }
 /* "Where next?" under a page: pages of other rooms that continue the question */
 function next(){
  const app=document.getElementById('app');if(!app||typeof uiPage!=='function')return;
  let rel=document.getElementById('rel');
  const pg=uiPage(),sp=(typeof UI_ALIAS==='object'&&UI_ALIAS[pg])||pg,L=NEXT[sp];
  if(!L||/^r-/.test(pg)){if(rel)rel.remove();return}
  if(!rel){rel=document.createElement('nav');rel.id='rel';rel.className='rm-next';rel.setAttribute('aria-label','Where next');app.parentNode.insertBefore(rel,app.nextSibling)}
  const key=sp+(ar()?'a':'e');if(rel.dataset.k===key)return;rel.dataset.k=key;
  rel.innerHTML=`<h3>${two('Where next?','وين بعدها؟')}</h3><div class="rm-nx">${L.filter(k=>ENT.has(k)).map(k=>{const o=ENT.get(k);return `<a class="rm-c" href="#/${k}" data-k="${k}">${svg(o.e[1])}<b>${label(k)}</b><span class="rm-q">${two(esc(o.e[2]),esc(o.e[3]))}</span></a>`}).join('')}</div>`;
 }
 const nav0=window.uiNav;
 window.uiNav=function(){nav0.apply(this,arguments);try{bar();next()}catch(e){}};
 /* ---------- live lines ---------- */
 const TEASE={
  table:async()=>{if(!D||typeof ltTable!=='function'||typeof wkSc!=='function')return null;const fin=D.matches.filter(m=>wkSc(m.score));if(fin.length<3)return null;const t=ltTable(fin,new Map())[0];
   return t?[`${esc(t.t)} lead with ${t.pts} points`,`${esc(t.t)} يتصدر بـ${t.pts} نقطة`]:null},
  matches:async()=>{if(typeof fixLoad!=='function')return null;const fx=await fixLoad().catch(()=>null),L=fx&&fx.leagues&&fx.leagues[D.id];if(!L||!L.length)return null;const now=Date.now();
   const n=L.filter(x=>x.k&&Date.parse(x.k)>now-2*3600e3).sort((a,b)=>Date.parse(a.k)-Date.parse(b.k))[0];if(!n)return null;
   const d=new Date(n.k),dt=d.toLocaleDateString(ar()?'ar':'en-US',{weekday:'short',day:'numeric',month:'short'});return [`Next: ${esc(n.h)} v ${esc(n.a)}, ${dt}`,`الجاي: ${esc(n.h)} ضد ${esc(n.a)}، ${dt}`]},
  players:async()=>{if(!D||typeof agg!=='function')return null;const a=agg().filter(p=>p.xg!=null&&p.minutes>0).sort((x,y)=>y.xg-x.xg)[0];return a?[`Most xG: ${esc(a.player)} (${a.xg.toFixed(1)})`,`الأكثر xG: ${esc(a.player)} (${a.xg.toFixed(1)})`]:null},
  elo:async()=>{const E=await loadJson('elo_own.json',ALL.generated).catch(()=>null),L=E&&E.leagues&&E.leagues[D.id];if(!L||!L.teams)return null;const t=Object.entries(L.teams).filter(([,v])=>v&&v.r).sort((a,b)=>b[1].r-a[1].r)[0];
   return t?[`Strongest club now: ${esc(t[0])} (${Math.round(t[1].r)})`,`الأقوى الحين: ${esc(t[0])} (${Math.round(t[1].r)})`]:null},
  guess:async()=>{let s=null;try{s=JSON.parse(localStorage.getItem('plx_gp')||'null')}catch(e){}const days=s&&s.days?Object.keys(s.days).length:0;return days?[`You have played ${days} day${days===1?'':'s'}`,`لعبت ${days} ${days===1?'يوم':'أيام'}`]:['Today\'s player is waiting','لاعب اليوم ينتظرك']}};
 const lineOf=async k=>{try{const f=TEASE[k];return f?await f():null}catch(e){return null}};
 /* ---------- the room landing page ---------- */
 const cardHtml=(k,i)=>{const o=ENT.get(k),e=o.e;return `<a class="rm-c" href="#/${k}" data-k="${k}" style="--i:${i}">${svg(e[1])}<b>${label(k)}</b><span class="rm-q">${two(esc(e[2]),esc(e[3]))}</span><span class="rm-t" data-t="${k}" hidden></span></a>`};
 const fillLines=(root,keys,tok,live)=>keys.forEach(async k=>{if(!TEASE[k])return;const L=await lineOf(k);if(!L||!root.isConnected||!live())return;root.querySelectorAll(`.rm-t[data-t="${k}"]`).forEach(t=>{t.innerHTML=two(L[0],L[1]);t.hidden=false})});
 const fold=s=>String(s||'').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f\\u064b-\\u065f\\u0670]','g'),'').toLowerCase();
 function textOf(k){const o=ENT.get(k);return fold([pgName(k),arName(pgName(k)),o?o.e[2]:'',o?o.e[3]:'',o?o.e[4]:''].join(' '))}
 let TOK=0;
 ROOMS.forEach(r=>{if(r.k==='home')return;
  R[landing(r)]=async function(el){
   const tok=++TOK,live=()=>tok===TOK;let i=0;
   el.innerHTML=`<h2>${two(esc(r.n[0]),esc(r.n[1]))}</h2>${svg(r.ic,'rm-wm')}<p class="mu rm-lead">${two(esc(r.d[0]),esc(r.d[1]))}</p>
    <div class="rm-f"><input id="rmq" type="search" autocomplete="off" placeholder="${ar()?'ابحث في '+esc(r.n[1]):'Find a page in '+esc(r.n[0])}" aria-label="${ar()?'ابحث في '+esc(r.n[1]):'Find a page in '+esc(r.n[0])}"><span class="mu" id="rmc"></span></div>
    <div id="rmg">${r.groups.map(g=>`<section class="rm-s" data-g="${g.k}"><h3>${two(esc(g.n[0]),esc(g.n[1]))}</h3><div class="rm-cards">${g.p.map(e=>cardHtml(e[0],i++)).join('')}</div></section>`).join('')}</div>
    <div class="empty rm-none" id="rmnone" hidden>${two('No page matches that. Try another word.','ما فيه صفحة تطابق. جرّب كلمة ثانية.')}</div>`;
   const q=el.querySelector('#rmq'),cnt=el.querySelector('#rmc'),all=r.groups.flatMap(g=>g.p.map(e=>e[0]));
   const filt=()=>{const t=fold(q.value).trim(),words=t.split(/\s+/).filter(Boolean);let n=0;
    el.querySelectorAll('.rm-c').forEach(c=>{const hit=!words.length||words.every(w=>textOf(c.dataset.k).includes(w));c.hidden=!hit;if(hit)n++});
    el.querySelectorAll('.rm-s').forEach(s=>{s.hidden=![...s.querySelectorAll('.rm-c')].some(c=>!c.hidden)});
    el.querySelector('#rmnone').hidden=n>0;cnt.textContent=words.length?(ar()?n+' صفحة':n+(n===1?' page':' pages')):''};
   q.oninput=filt;
   q.onkeydown=e=>{if(e.key==='Enter'){const c=[...el.querySelectorAll('.rm-c')].find(x=>!x.hidden);if(c){e.preventDefault();location.hash=c.getAttribute('href')}}};
   fillLines(el,all,tok,live);
  }});
 /* ---------- Home: the explore block and today's pick ---------- */
 const PICK=['race','h2h','heatmaps','twins','career','value','guess','wrapped','xi','stakes','thrill','toty','gems','fortress','rest','elo','river','shape','carry','leaguedna','sim','whatif','cards','builder'];
 const utcDay=()=>{const d=new Date();return Math.floor(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())/864e5)};
 /* one pick a day, the same for everyone on one UTC day: the list is walked in a shuffled order that is fixed for each pass through it, so no page comes up twice within a pass */
 const shuffled=pass=>{const a=PICK.slice();let x=(pass+1)*0x9e3779b1>>>0;const r=()=>{x=(x+0x6d2b79f5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296};for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const pickOf=day=>shuffled(Math.floor(day/PICK.length))[((day%PICK.length)+PICK.length)%PICK.length];
 function homeBlock(box){
  const tok=++TOK,live=()=>tok===TOK,rooms=ROOMS.filter(r=>r.k!=='home'),pk=pickOf(utcDay()),po=ENT.get(pk);
  const lead={league:'table',clubs:'elo',players:'players',tactics:null,play:'guess'};
  box.innerHTML=`<section class="hsec rm-home"><div class="hhd"><h2>${two('Explore','استكشف')}</h2></div>
   <div class="rm-tiles">${rooms.map((r,i)=>`<a class="rm-tile" href="${href(r)}" data-room="${r.k}" style="--i:${i}">${svg(r.ic,'rm-ti')}<b>${two(esc(r.n[0]),esc(r.n[1]))}</b><span class="rm-q">${two(esc(r.d[0]),esc(r.d[1]))}</span><span class="rm-t" data-t="${lead[r.k]||''}" hidden></span><span class="rm-n mu">${two(r.groups.reduce((s,g)=>s+g.p.length,0)+' pages',r.groups.reduce((s,g)=>s+g.p.length,0)+' صفحة')}</span></a>`).join('')}</div>
   <a class="rm-pick" href="#/${pk}" data-k="${pk}">${svg(po.e[1],'rm-pi')}<span class="rm-pk"><span class="mu">${two('Today\'s pick','اختيار اليوم')}</span><b>${label(pk)}</b><span class="rm-q">${two(esc(po.e[2]),esc(po.e[3]))}</span></span><span class="rm-go" aria-hidden="true">›</span></a></section>`;
  fillLines(box,Object.values(lead).filter(Boolean),tok,live);
 }
 /* the search finds a page by what it answers */
 const pageHit=(k,hit)=>{const t=textOf(k);return hit(t)||false};
 INS.rooms={ROOMS,ENT,GRP,NEXT,PICK,MERGED,pickOf,utcDay,href,landing,homeBlock,pageHit,svg,label,known:()=>known,bar};
 if(typeof AR==='object')Object.entries({"Where next?":"وين بعدها؟","Explore":"استكشف","Today's pick":"اختيار اليوم","Value vs points":"القيمة مقابل النقاط","Player career":"مسيرة اللاعب","Rooms":"الأقسام","Find a page":"ابحث عن صفحة"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
 if(typeof uiNav==='function')try{uiNav()}catch(e){}
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
