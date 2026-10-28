/* ===== Ask the site (#/ask, in Home after the overview): a question in Arabic or English, answered from this season's data =====
   No AI and no key: INS.askParse reads the question with fixed rules and says how it understood it, so a wrong reading is visible.
   It finds:
   - a league (names and Arabic names; none = the six domestic leagues), a club (the clubs' own names, short English forms and Arabic names of the
     bigger clubs), a player (his name in Latin letters: the full name, or a surname that only one player has);
   - a measure (goals, assists, xG, non-penalty xG, xAG, shots, on target, key passes, shot-creating actions, passes, progressive passes,
     progressive carries, take-ons won, tackles, interceptions, blocks, clearances, duels won, aerials won, minutes; for clubs also points);
   - "per 90" (then only players with 450+ minutes, or the minutes asked for), "least" instead of "most", how many (top 5…), a position
     (PitchAPI's own labels: it calls many forwards midfielders), an age limit (from data/tm.json, only for players matched there);
   - a club question (team, club, table, points…).
   Answers come from the per-match player files (aggPl, the same sums as the Players and Rankings pages) and the league files (table).
   A question it cannot read gets an honest "not understood" and examples. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('ask','Ask the site','home','overview');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 /* Arabic: no diacritics or tatweel, one alef, ta marbuta as ha, alef maqsura as ya; Arabic-Indic digits as Latin; Latin: no accents, lower case */
 const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[ً-ٰٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).toLowerCase().replace(/[^\p{L}\p{N}\s/+]/gu,' ').replace(/\s+/g,' ').trim();
 const LEAGUE={l_4WFCIZ:['premier league','epl','english league','الدوري الانجليزي','الانجليزي','البريميرليج','بريميرليج','البريمرليج'],
  l_0ErfuF:['laliga','la liga','spanish league','الدوري الاسباني','الاسباني','الليغا','لاليغا','الليجا'],
  l_1Isor4:['bundesliga','german league','الدوري الالماني','الالماني','البوندسليغا','بوندسليغا','البوندسليجا'],
  l_3FJFUl:['ligue 1','french league','الدوري الفرنسي','الفرنسي'],
  l_0ALvwF:['serie a','italian league','الدوري الايطالي','الايطالي','الكالتشيو'],
  l_4QexZg:['liga portugal','primeira liga','portuguese league','الدوري البرتغالي','البرتغالي']};
 const CLUB_AR={'Arsenal':['ارسنال','الارسنال'],'Chelsea':['تشيلسي','تشلسي'],'Liverpool':['ليفربول'],'Manchester City':['مانشستر سيتي','مان سيتي','السيتي','man city'],
  'Manchester United':['مانشستر يونايتد','مان يونايتد','اليونايتد','man utd','man united'],'Tottenham Hotspur':['توتنهام','spurs','tottenham'],'Newcastle United':['نيوكاسل','newcastle'],
  'Aston Villa':['استون فيلا'],'Everton':['ايفرتون'],'Brighton & Hove Albion':['برايتون','brighton'],'Crystal Palace':['كريستال بالاس'],'Nottingham Forest':['نوتنغهام','نوتينغهام','forest'],
  'Fulham':['فولهام'],'Brentford':['برنتفورد'],'Leeds United':['ليدز','leeds'],'Sunderland':['سندرلاند'],'AFC Bournemouth':['بورنموث','bournemouth'],
  'Real Madrid':['ريال مدريد','الريال'],'Barcelona':['برشلونه','البارسا','برسا','barca'],'Atlético Madrid':['اتلتيكو مدريد','اتلتيكو','atletico'],'Sevilla':['اشبيليه'],
  'Valencia':['فالنسيا'],'Villarreal':['فياريال'],'Real Betis':['ريال بيتيس','بيتيس','betis'],'Real Sociedad':['ريال سوسيداد','سوسيداد','sociedad'],'Athletic Club':['اتلتيك بلباو','بلباو','bilbao','athletic bilbao'],
  'Bayern München':['بايرن ميونخ','بايرن','البايرن','bayern','bayern munich'],'Borussia Dortmund':['دورتموند','dortmund'],'Bayer Leverkusen':['باير ليفركوزن','ليفركوزن','leverkusen'],
  'RB Leipzig':['لايبزيغ','لايبزيج','leipzig'],'Eintracht Frankfurt':['فرانكفورت','frankfurt'],'VfB Stuttgart':['شتوتغارت','stuttgart'],
  'Paris Saint-Germain':['باريس سان جيرمان','باريس','psg','paris sg'],'Marseille':['مرسيليا'],'Lyon':['ليون'],'Monaco':['موناكو'],'Lille':['ليل'],
  'Juventus':['يوفنتوس','اليوفي','juve'],'Inter':['انتر ميلان','الانتر','انتر','inter milan'],'Milan':['ايه سي ميلان','الميلان','ميلان','ac milan'],'Napoli':['نابولي'],'Roma':['روما'],'Lazio':['لاتسيو'],'Atalanta':['اتالانتا'],
  'Benfica':['بنفيكا'],'FC Porto':['بورتو','porto'],'Sporting CP':['سبورتينغ','سبورتنغ','sporting'],'Braga':['براغا']};
 /* measures: [key, English name, Arabic name, words (longer phrases first within the list order below)] */
 const MET=[['sot','Shots on target','تسديدات على المرمى',['shots on target','on target','على المرمى']],
  ['npxg','Non-penalty xG','xG بدون ركلات جزاء',['npxg','non penalty xg','non-penalty xg','بدون ركلات جزاء','بدون جزاء']],
  ['xag','xAG (expected assists)','الصناعة المتوقعة (xAG)',['xag','expected assists','xa','الصناعه المتوقعه','الاسيست المتوقع']],
  ['xg','xG','xG',['xg','expected goals','الاهداف المتوقعه']],
  ['kp','Key passes','التمريرات المفتاحية',['key passes','key pass','تمريرات مفتاحيه','التمريرات المفتاحيه','تمريره مفتاحيه']],
  ['sca','Shot-creating actions','الأفعال اللي صنعت تسديدة',['shot creating actions','shot-creating actions','sca','افعال صنعت تسديده','صناعه التسديدات']],
  ['pr','Progressive passes','التمريرات التقدمية',['progressive passes','تمريرات تقدميه','التمريرات التقدميه']],
  ['pc','Progressive carries','حمل الكرة التقدمي',['progressive carries','carries','حمل الكره','حمل للكره']],
  ['tkw','Take-ons won','المراوغات الناجحة',['take ons','take-ons','dribbles','dribblers','dribbler','مراوغات','مراوغه','المراوغات','مراوغ']],
  ['aerw','Aerials won','الكرات الهوائية المكسوبة',['aerials','aerial','headers','headed duels','الكرات الهوائيه','هوائيه','الهوائيه']],
  ['duw','Duels won','الالتحامات المكسوبة',['duels','التحامات','الالتحامات','صراعات']],
  ['tk','Tackles','الافتكاكات',['tackles','tackle','tacklers','افتكاك','افتكاكات','الافتكاكات','تدخلات']],
  ['ic','Interceptions','الاعتراضات',['interceptions','interception','اعتراضات','الاعتراضات','قطع الكره']],
  ['bl','Blocks','الصدّات',['blocks','blocked','صدات','الصدات','صد']],
  ['cl','Clearances','التشتيت',['clearances','تشتيت','ابعاد الكره']],
  ['ast','Assists','التمريرات الحاسمة',['assists','assist','assisters','playmaker','تمريرات حاسمه','التمريرات الحاسمه','صناعه','صانع','اسيست','صنع']],
  ['sh','Shots','التسديدات',['shots','shot','تسديدات','التسديدات','تسديد']],
  ['ps','Passes','التمريرات',['passes','passing','pass','تمريرات','التمريرات','تمرير']],
  ['gl','Goals','الأهداف',['goals','goal','scorers','scorer','scored','top scorer','اهداف','الاهداف','هداف','الهداف','سجل','تسجيل','هدف']],
  ['mi','Minutes','الدقائق',['minutes','دقائق','الدقائق','دقايق']]];
 const TEAMW=['team','teams','club','clubs','side','table','standings','points','فريق','فرق','الفرق','الفريق','نادي','اندية','الاندية','النادي','ترتيب','الترتيب','نقاط','النقاط','جدول'];
 const POSW={DF:['defender','defenders','centre back','center back','مدافع','مدافعين','المدافعين','مدافعي','دفاع'],MF:['midfielder','midfielders','وسط','لاعب وسط','لاعبي الوسط'],
  FW:['forward','forwards','striker','strikers','attacker','attackers','مهاجم','مهاجمين','المهاجمين','مهاجمي'],GK:['goalkeeper','goalkeepers','keeper','keepers','حارس','حراس','الحراس']};
 const LEAST=['least','fewest','lowest','worst','bottom','اقل','الاقل','اسوا'];
 const P90=['per 90','/90','p90','per game','per match','لكل 90','كل 90','في 90','لكل مباراه','بالمباراه'];
 const STOP=new Set(['who','has','have','the','most','best','top','which','what','how','many','much','this','season','with','and','for','per','player','players','in','of','is','are','a','an','by','from','league','scored','under','over','least','fewest','show','me','list','give']);
 /* does the question contain this phrase as whole words (an Arabic word may carry و / ب / ل / ف / ال / لل in front)? */
 function has(q,ph){const p=norm(ph);if(!p)return -1;if(/^[a-z0-9 /+-]+$/.test(p)){const re=new RegExp('(^|[^a-z0-9])'+p.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'(?=$|[^a-z0-9])');const m=re.exec(q);return m?m.index+m[1].length:-1}
  const re=new RegExp('(^|\\s)(?:و|ب|ل|ف)?(?:ال|لل)?'+p.replace(/^ال/,'')+'(?=$|\\s)');const m=re.exec(q);return m?m.index+m[1].length:-1}
 INS.askParse=function(text,ctx){
  const q=norm(text),o={q,unknown:null,league:null,club:null,player:null,cands:[],metric:null,p90:false,min:null,dir:'desc',n:null,pos:null,age:null,team:false};
  if(!q)return o;
  for(const [id,ws] of Object.entries(LEAGUE))if(ws.some(w=>has(q,w)>=0)){o.league=id;break}
  /* clubs: the longest name or alias that the question holds */
  const cl=[];for(const c of ctx.clubs){for(const a of [c,...(CLUB_AR[c]||[])]){if(has(q,a)>=0)cl.push([norm(a).length,c])}}
  cl.sort((a,b)=>b[0]-a[0]);if(cl.length)o.club=cl[0][1];
  for(const [k,en,a,ws] of MET){if(ws.some(w=>has(q,w)>=0)){o.metric=k;break}}
  if(P90.some(w=>has(q,w)>=0)||/\b90\b/.test(q)&&/(per|لكل|كل)/.test(q))o.p90=true;
  const mm=/(\d{2,4})\s*(\+|min|minutes|دقيقه|دقائق|دقايق)/.exec(q);if(mm){o.min=+mm[1];o.p90=o.p90||true}
  if(LEAST.some(w=>has(q,w)>=0))o.dir='asc';
  const un=/(under|below|u|تحت|اصغر من|اقل من)\s*(\d{2})\b/.exec(q);if(un&&+un[2]>=16&&+un[2]<=40){o.age=+un[2]}
  const nn=/(?:top|best|اكثر|افضل|اول|most)\s*(\d{1,2})\b/.exec(q)||/\b(\d{1,2})\s*(?:players|لاعبين|لاعب|clubs|teams|فرق|اندية)/.exec(q);if(nn&&+nn[1]>0&&+nn[1]<=50)o.n=+nn[1];
  for(const [k,ws] of Object.entries(POSW))if(ws.some(w=>has(q,w)>=0)){o.pos=k;break}
  if(TEAMW.some(w=>has(q,w)>=0))o.team=true;
  /* a player: Latin words of the question that are not part of the other things it found */
  const used=new Set([...STOP]);[o.club,...(o.club?CLUB_AR[o.club]||[]:[])].forEach(x=>x&&norm(x).split(' ').forEach(w=>used.add(w)));
  Object.values(LEAGUE).flat().concat(MET.flatMap(m=>m[3]),TEAMW,Object.values(POSW).flat(),LEAST,P90).forEach(x=>norm(x).split(' ').forEach(w=>used.add(w)));
  const words=q.split(' ').filter(w=>/^[a-z][a-z'-]{2,}$/.test(w)&&!used.has(w));
  if(words.length){const full=ctx.players.filter(p=>{const n=norm(p.name);return n.length>3&&has(q,n)>=0});
   if(full.length)o.cands=full;else{const last=ctx.players.filter(p=>{const t=norm(p.name).split(' ');return t.some(x=>x.length>=4&&words.includes(x))});o.cands=last}
   const ids=new Set(o.cands.map(p=>p.id));if(ids.size===1)o.player=o.cands[0];if(!o.cands.length)o.unknown=words}
  return o;
 };
 const MI=450;
 async function load(){
  const [pool,tm]=await Promise.all([INS.pool(['pl']),loadJson('tm.json').catch(()=>null)]);
  const players=[],clubs=new Set(),tables={};
  for(const L of pool.leagues){if(!L.pl)continue;const P=L.pl;P.ix={};P.cols.forEach((c,k)=>P.ix[c]=k);
   for(const a of aggPl(P))players.push({key:L.l.id+'|'+a.id,id:a.id,name:a.n||'?',club:a.club,lg:L.l.id,lgn:L.l.name,pos:a.p,mi:a.s.mi,games:a.games,s:a.s,d:a.d,p90:a.p90,
    dob:tm&&tm.p&&tm.p[a.id]?tm.p[a.id][0]:null});
   const T=new Map();for(const m of L.ms){for(const [t,f,g] of [[m.home,m.hg,m.ag],[m.away,m.ag,m.hg]]){const r=T.get(t)||{t,lg:L.l.id,lgn:L.l.name,p:0,g:0,gf:0,ga:0};r.g++;r.gf+=f;r.ga+=g;r.p+=f>g?3:f===g?1:0;T.set(t,r)}}
   tables[L.l.id]=[...T.values()].sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||(a.t<b.t?-1:a.t>b.t?1:0));tables[L.l.id].forEach(r=>{clubs.add(r.t)})}
  return {players,clubs:[...clubs],tables,leagues:pool.leagues.map(L=>L.l),miss:pool.miss,tm:!!(tm&&tm.p&&Object.keys(tm.p).length)};
 }
 let CF=null,CK='';
 function data(){if(CF&&CK===INS.poolKey())return CF;CK=INS.poolKey();const p=load().then(d=>{if(!d.players.length)throw new Error('empty');return d}).catch(e=>{if(CF===p)CF=null;throw e});CF=p;return p}
 const ageOn=(dob,now)=>{if(!dob)return null;const [y,m,d]=dob.split('-').map(Number),t=now||new Date();return t.getFullYear()-y-((t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))?1:0)};
 const metName=k=>{const m=MET.find(x=>x[0]===k);return m?[m[1],m[2]]:[k,k]};
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 /* the answer to a parsed question: {kind, rows, ...} — exported so the test can read the same object */
 INS.askAnswer=function(o,Dd,now){
  const lgs=o.league?[o.league]:Dd.leagues.map(l=>l.id);
  if(o.player&&!(o.metric&&(o.n||o.dir==='asc')))return {kind:'player',p:o.player,table:Dd.tables[o.player.lg]};
  if(!o.player&&o.cands.length>1&&!o.metric&&!o.club)return {kind:'which',cands:o.cands.slice(0,8)};
  if(o.team||(o.club&&!o.metric&&!o.pos)){
   if(o.club&&!o.metric&&!/(?:^|\s)(?:table|standings|ترتيب|الترتيب|جدول)(?:$|\s)/.test(o.q)){const lg=Object.keys(Dd.tables).find(id=>Dd.tables[id].some(r=>r.t===o.club));const T=Dd.tables[lg],pos=T.findIndex(r=>r.t===o.club);
    const sq=Dd.players.filter(p=>p.lg===lg&&p.club===o.club),top=k=>sq.slice().sort((a,b)=>(b.s[k]||0)-(a.s[k]||0)||a.mi-b.mi||cmp(a.name,b.name))[0];
    return {kind:'club',club:o.club,lg,row:T[pos],pos:pos+1,n:T.length,scorer:top('gl'),assister:top('ast')}}
   const k=o.metric||'pts',rows=[],tl=o.club&&!o.league?Object.keys(Dd.tables).filter(id=>Dd.tables[id].some(r=>r.t===o.club)):lgs;
   for(const id of tl){const T=Dd.tables[id]||[];for(const r of T){let v;
     if(k==='pts')v=r.p;else if(k==='gl')v=r.gf;else{const sq=Dd.players.filter(p=>p.lg===id&&p.club===r.t);v=sq.reduce((s,p)=>s+(p.s[k]||0),0)}
     rows.push({club:r.t,lg:id,lgn:r.lgn,g:r.g,v:o.p90?v/r.g:v,i:rows.length})}}
   /* points of one league: the table's own order (points, goal difference, goals); otherwise by the value */
   rows.sort((a,b)=>k==='pts'&&tl.length===1&&!o.p90?(o.dir==='asc'?b.i-a.i:a.i-b.i):(o.dir==='asc'?a.v-b.v:b.v-a.v)||cmp(a.club,b.club));
   return {kind:'teams',k,rows:rows.slice(0,o.n||(tl.length===1?rows.length:10)),all:rows.length,perMatch:o.p90};
  }
  if(!o.metric&&!o.pos)return o.unknown&&o.unknown.length?{kind:'nomatch',words:o.unknown}:{kind:'none'};
  const k=o.metric||'gl',min=o.p90?(o.min||MI):(o.min||0);
  let L=Dd.players.filter(p=>lgs.includes(p.lg)&&(!o.club||p.club===o.club)&&(!o.pos||p.pos===o.pos)&&p.mi>=min&&(k!=='mi'||true));
  if(o.age){L=L.filter(p=>{const a=ageOn(p.dob,now);return a!=null&&a<o.age})}
  const val=p=>o.p90&&k!=='mi'?p.p90(k):(p.d[k]>0||k==='mi'?(k==='mi'?p.mi:p.s[k]):null);
  const rows=L.map(p=>({p,v:val(p)})).filter(r=>r.v!=null&&isFinite(r.v));
  rows.sort((a,b)=>(o.dir==='asc'?a.v-b.v:b.v-a.v)||(o.dir==='asc'?b.p.mi-a.p.mi:a.p.mi-b.p.mi)||cmp(a.p.name,b.p.name));
  return {kind:'players',k,min,rows:rows.slice(0,o.n||10),all:rows.length};
 };
 const EX=[['Who has the most goals in the Premier League?','مين أكثر هداف في الدوري الإنجليزي؟'],['Most assists per 90 in LaLiga','أكثر صناعة لكل 90 في الدوري الإسباني'],
  ['Top 5 defenders by interceptions in Serie A','أفضل 5 مدافعين في الاعتراضات بالدوري الإيطالي'],['Liverpool','ليفربول'],['Which team has the most shots?','أي فريق عنده أكثر تسديدات؟'],['Haaland','Haaland'],['Most xG under 21','أكثر xG تحت 21']];
 const S={q:'',tok:0};
 R.ask=async function(el){
  el.innerHTML='<h2>Ask the site</h2><div id="akroot" class="ins lk ak"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#akroot'),lg=D.id,tok=++S.tok;
  let Dd;try{Dd=await data()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The data could not be loaded. Try again later.','ما قدرنا نحمّل البيانات. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Ask a question</b> in Arabic or English about this season in the six leagues: players, clubs, goals, assists, xG, passes, tackles… The site reads it with fixed rules (no AI) and shows how it understood it. Write players\' names in English letters.','<b>اسأل سؤال</b> بالعربي أو الإنجليزي عن هالموسم في الدوريات الستة: لاعبين، أندية، أهداف، صناعة، xG، تمريرات، افتكاكات… الموقع يقرأه بقواعد ثابتة (بدون ذكاء اصطناعي) ويوريك كيف فهمه. اكتب أسماء اللاعبين بالحروف الإنجليزية.')}</p>
   <form id="akf" class="ak-f"><input id="akq" type="search" autocomplete="off" placeholder="${ar()?'مثال: مين أكثر هداف في الدوري الإنجليزي؟':'e.g. Who has the most goals in the Premier League?'}" value="${esc(S.q)}" aria-label="${ar()?'سؤالك':'Your question'}"><button type="submit" class="xb-clear">${two('Ask','اسأل')}</button></form>
   <div class="ak-ex">${EX.map(x=>`<button type="button" class="ak-chip" data-q="${esc(ar()?x[1]:x[0])}">${/[\u0600-\u06FF]/.test(ar()?x[1]:x[0])?esc(ar()?x[1]:x[0]):nm(ar()?x[1]:x[0])}</button>`).join('')}</div></div><div id="akout"></div>`;
  const out=root.querySelector('#akout'),go=()=>{S.q=root.querySelector('#akq').value;answer(out,Dd)};
  root.querySelector('#akf').onsubmit=e=>{e.preventDefault();go()};
  root.querySelectorAll('.ak-chip').forEach(b=>b.onclick=()=>{root.querySelector('#akq').value=b.dataset.q;go()});
  if(S.q)answer(out,Dd);
 };
 function understood(o,Dd){
  const bits=[];const L=o.league?Dd.leagues.find(l=>l.id===o.league):null;
  if(o.metric)bits.push(two(metName(o.metric)[0],metName(o.metric)[1]));
  if(o.p90)bits.push(two('per 90 minutes','لكل 90 دقيقة'));
  if(o.dir==='asc')bits.push(two('least first','الأقل أولًا'));
  if(o.pos)bits.push(two({DF:'defenders',MF:'midfielders',FW:'forwards',GK:'goalkeepers'}[o.pos],{DF:'المدافعين',MF:'لاعبي الوسط',FW:'المهاجمين',GK:'الحراس'}[o.pos]));
  if(o.age)bits.push(two(`under ${o.age}`,`تحت ${nb(o.age)} سنة`));
  if(o.club)bits.push(nm(o.club));bits.push(L?nm(L.name):two('the six leagues','الدوريات الستة'));
  if(o.team)bits.push(two('clubs','الأندية'));
  if(o.player)bits.push(nm(o.player.name));
  return `<p class="ak-u mu">${two('Understood as','فهمت')}: ${bits.map(b=>`<span class="ak-b">${b}</span>`).join(' ')}</p>`;
 }
 const fmt=(k,v,p90)=>k==='mi'&&!p90?String(Math.round(v)):p90||/^(xg|npxg|xag)$/.test(k)?(+v).toFixed(2):String(Math.round(v*100)/100);
 function answer(out,Dd){
  const o=INS.askParse(S.q,{clubs:Dd.clubs,players:Dd.players}),A=INS.askAnswer(o,Dd);
  if(!S.q.trim()){out.innerHTML='';return}
  if(A.kind==='none'){out.innerHTML=`<div class="card ak-no"><p>${two('Sorry, I did not understand this question. Try one of the examples: a measure (goals, assists, xG, tackles…), a league or a club, or a player\'s name in English letters.','آسف، ما فهمت هالسؤال. جرّب واحد من الأمثلة: مقياس (أهداف، صناعة، xG، افتكاكات…)، أو دوري أو نادي، أو اسم لاعب بالحروف الإنجليزية.')}</p></div>`;return}
  if(A.kind==='nomatch'){out.innerHTML=`<div class="card ak-no"><p>${two(`No player of the six leagues this season is called ${A.words.map(w=>'"'+esc(w)+'"').join(' or ')}. A player who left for another league is not in this data.`,`ما فيه لاعب في الدوريات الستة هالموسم اسمه ${A.words.map(w=>nb('"'+esc(w)+'"')).join(' أو ')}. اللاعب اللي راح لدوري ثاني مو موجود في هالبيانات.`)}</p></div>`;return}
  let h=understood(o,Dd);
  if(A.kind==='which'){h+=`<p>${two('Several players have that name. Which one?','فيه أكثر من لاعب بهالاسم. أي واحد؟')}</p><div class="ak-ex">${A.cands.map(p=>`<button type="button" class="ak-chip" data-q="${esc(p.name)}">${nm(p.name)} · ${nm(p.club)}</button>`).join('')}</div>`}
  else if(A.kind==='player'){const p=A.p,row=k=>p.d[k]>0||k==='mi'?(k==='mi'?p.mi:p.s[k]):null;
   h+=`<div class="ak-p"><h3>${nm(p.name)}</h3><p class="mu">${nm(p.club)} · ${nm(p.lgn)}${p.pos?' · '+nb(p.pos):''}</p>
    <table class="lk-t ak-t"><tbody>${['gl','ast','xg','xag','sh','kp','ps','tk','ic','mi'].map(k=>{const v=row(k),q=p.p90(k);return `<tr data-k="${k}"><td>${two(metName(k)[0],metName(k)[1])}</td><td class="n"><b>${v==null?'–':nb(fmt(k,v,false))}</b></td><td class="n mu">${k!=='mi'&&q!=null?nb(q.toFixed(2))+' '+two('per 90','لكل 90'):''}</td></tr>`}).join('')}</tbody></table>
    <p><a href="#/story/${encodeURIComponent(p.key)}">${two('His season story','قصة موسمه')}</a></p></div>`}
  else if(A.kind==='club'){const r=A.row;h+=`<div class="ak-c"><h3>${nm(A.club)}</h3><p class="ak-cl">${two(`${A.pos}${['st','nd','rd'][A.pos-1]&&A.pos<4?['st','nd','rd'][A.pos-1]:'th'} of ${A.n} with ${r.p} points from ${r.g} matches (goals ${r.gf}–${r.ga}).`,`المركز ${nb(A.pos)} من ${nb(A.n)} بـ ${nb(r.p)} نقطة من ${nb(r.g)} مباراة (الأهداف ${nb(r.gf)} له و${nb(r.ga)} عليه).`)}</p>
    ${A.scorer?`<p class="ak-cs">${two(`Top scorer: ${esc(A.scorer.name)} (${Math.round(A.scorer.s.gl||0)}). Most assists: ${esc(A.assister.name)} (${Math.round(A.assister.s.ast||0)}).`,`الهداف: ${nm(A.scorer.name)} (${nb(Math.round(A.scorer.s.gl||0))}). أكثر صناعة: ${nm(A.assister.name)} (${nb(Math.round(A.assister.s.ast||0))}).`)}</p>`:''}</div>`}
  else if(A.kind==='teams'){const name=A.k==='pts'?['Points','النقاط']:metName(A.k);
   h+=`<table class="lk-t ak-t"><thead><tr><th>#</th><th>${two('Club','النادي')}</th><th class="n">${two(name[0]+(A.perMatch?' per match':''),name[1]+(A.perMatch?' لكل مباراة':''))}</th><th class="n">${two('Matches','مباريات')}</th></tr></thead><tbody>${A.rows.map((r,i)=>`<tr data-c="${esc(r.club)}"><td>${nb(i+1)}</td><td>${nm(r.club)} <span class="mu">${nm(r.lgn)}</span></td><td class="n"><b>${nb(A.perMatch?r.v.toFixed(2):fmt(A.k,r.v,false))}</b></td><td class="n">${nb(r.g)}</td></tr>`).join('')}</tbody></table>
    ${A.k!=='pts'&&A.k!=='gl'?`<p class="mu ins-note">${two('Club totals are the sums of their players\' numbers in PitchAPI\'s per-match player files.','مجاميع الأندية هي مجموع أرقام لاعبيها في ملفات PitchAPI لكل مباراة.')}</p>`:''}`}
  else{const name=metName(A.k);
   h+=A.rows.length?`<table class="lk-t ak-t"><thead><tr><th>#</th><th>${two('Player','اللاعب')}</th><th class="n">${two(name[0]+(o.p90?' /90':''),name[1]+(o.p90?' /90':''))}</th><th class="n">${two('Minutes','الدقائق')}</th></tr></thead><tbody>${A.rows.map((r,i)=>`<tr data-p="${esc(r.p.key)}"><td>${nb(i+1)}</td><td><a href="#/story/${encodeURIComponent(r.p.key)}">${nm(r.p.name)}</a> <span class="mu">${nm(r.p.club)} · ${nm(r.p.lgn)}</span></td><td class="n"><b>${nb(fmt(A.k,r.v,o.p90))}</b></td><td class="n">${nb(Math.round(r.p.mi))}</td></tr>`).join('')}</tbody></table>`
    :`<p>${two('No player fits all of this.','ما فيه لاعب ينطبق عليه كل هذا.')}</p>`;
   const notes=[];if(o.p90)notes.push(two(`Per 90 minutes: players with ${A.min}+ minutes.`,`لكل 90 دقيقة: اللاعبين اللي لعبوا ${nb(A.min)}+ دقيقة.`));
   if(o.pos)notes.push(two('Positions are PitchAPI\'s own labels (it calls many forwards midfielders).','المراكز حسب تصنيف PitchAPI (يسمّي مهاجمين كثير لاعبي وسط).'));
   if(o.age)notes.push(two(Dd.tm?'Ages come from the open Transfermarkt dataset; players it does not have are left out.':'No ages are available right now.',Dd.tm?'الأعمار من بيانات Transfermarkt المفتوحة؛ اللاعبين اللي مو فيها ما ينحسبون.':'الأعمار مو متوفرة الحين.'));
   if(A.k==='xag')notes.push(two('PitchAPI has no xAG for some whole matches; those matches are left out of the sums.','PitchAPI ما عنده xAG لبعض المباريات كاملة؛ هالمباريات ما تدخل في المجموع.'));
   if(notes.length)h+=`<p class="mu ins-note">${notes.join(' ')}</p>`}
  out.innerHTML=`<div class="card ak-a">${h}</div>`;
  out.querySelectorAll('.ak-chip').forEach(b=>b.onclick=()=>{const i=document.querySelector('#akq');if(i)i.value=b.dataset.q;S.q=b.dataset.q;answer(out,Dd)});
 }
 INS.ar({'Ask the site':'اسأل الموقع'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
