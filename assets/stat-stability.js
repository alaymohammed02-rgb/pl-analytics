/* ===== Stat stability (#/stability, in Players after Hidden Gems): how much does a player's number repeat? =====
   Read from data/stability.json, which the sync works out from the full past seasons' player files (see sync.py, "STABILITY"):
   - Year to year: the same player's number per 90 in one season against the next (players with 900+ minutes in both), as a Spearman
     rank correlation over every pair of neighbouring seasons. Each number is first set against the players of his position in that
     season (a z-score within DF / MF / FW), so a striker shooting more than a defender in both seasons does not count as "repeating";
     "all players" shows the raw correlation, which mixes that in and always looks higher.
   - Within one season: a player's matches in date order, the 1st, 3rd, 5th… against the 2nd, 4th, 6th…, 300+ minutes in each half,
     corrected for halving the sample (Spearman-Brown: 2r ÷ (1 + r)). Measures how much of the number is the player and how much is
     luck inside a season.
   1 = the number repeats exactly, 0 = nothing carries over. It says how far a number can be trusted from one season to the next,
   not how good the stat is. Only leagues with two or more full past seasons are in the file (today the Premier League). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('stability','Stat stability','players','gems');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 /* key, English, Arabic, group */
 const ST=[['gl','Goals','الأهداف','att'],['npxg','Non-penalty xG','xG بدون ركلات الجزاء','att'],['xg','xG','xG','att'],['sh','Shots','التسديدات','att'],['sot','Shots on target','التسديدات على المرمى','att'],
  ['xag','xAG','xAG','cre'],['ast','Assists','التمريرات الحاسمة','cre'],['sca','Shot-creating actions','أفعال صنعت تسديدة','cre'],['gca','Goal-creating actions','أفعال صنعت هدف','cre'],['kp','Key passes','التمريرات المفتاحية','cre'],
  ['tb','Through balls','التمريرات البينية','cre'],['cr','Crosses','العرضيات','cre'],['xgc','xG chain','سلسلة xG','cre'],['xgb','xG buildup','بناء xG','cre'],['xt','xT (expected threat)','xT (التهديد المتوقع)','cre'],['vaep','VAEP (value of actions)','VAEP (قيمة الأفعال)','cre'],
  ['ps','Passes','التمريرات','mov'],['pr','Progressive passes','التمريرات التقدمية','mov'],['bx','Passes into the box','التمريرات داخل المنطقة','mov'],['ca','Carries','حمل الكرة','mov'],['pc','Progressive carries','الحمل التقدمي','mov'],
  ['cb','Carries into the box','الحمل داخل المنطقة','mov'],['tko','Take-ons attempted','محاولات المراوغة','mov'],['tkw','Take-ons won','المراوغات الناجحة','mov'],
  ['tk','Tackles','الافتكاكات','def'],['ic','Interceptions','الاعتراضات','def'],['bl','Blocks','الصد','def'],['cl','Clearances','الإبعاد','def'],['duw','Duels won','الالتحامات المكسوبة','def'],['aer','Aerial duels','الكرات الهوائية','def'],['aerw','Aerial duels won','الكرات الهوائية المكسوبة','def']];
 const GRP=[['all','All stats','كل الإحصائيات'],['att','Scoring','التسجيل'],['cre','Creating','الصناعة'],['mov','Passing and carrying','التمرير وحمل الكرة'],['def','Defending','الدفاع']];
 const S={lg:'',grp:'all',base:'pos',tok:0};
 let CF=null,CK='';
 async function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('stability.json').then(d=>{if(!d||!d.leagues)throw new Error('stability');return d}).catch(e=>{if(CF===p)CF=null;throw e});CF=p;return p;
 }
 const col=r=>typeof INS.cardKit==='object'&&INS.cardKit&&INS.cardKit.pcol?INS.cardKit.pcol(Math.max(0,Math.min(100,r*100))):(r>=.75?'rgb(63,163,77)':r>=.5?'rgb(232,160,40)':'rgb(214,69,65)');
 const f2=v=>v==null?'–':(+v).toFixed(2);
 const band=r=>r==null?['–','–']:r>=.75?['repeats strongly','يتكرر بقوة']:r>=.5?['repeats fairly','يتكرر نسبيًا']:['mostly luck','أغلبه حظ'];
 R.stability=async function(el){
  el.innerHTML='<h2>Stat stability</h2><div id="stroot" class="ins lk st"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#stroot'),lg=D.id,tok=++S.tok;
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('Could not load the stability numbers. Try again later.','ما قدرنا نحمّل أرقام الثبات. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok)return;
  const ids=Object.keys(F.leagues);if(!ids.length){root.innerHTML=`<div class="empty">${two('Not enough seasons yet.','المواسم ما تكفي للحين.')}</div>`;return}
  if(!F.leagues[S.lg])S.lg=F.leagues[lg]?lg:ids[0];
  draw(root,F);
 };
 function draw(root,F){
  const L=F.leagues[S.lg],yk=S.base==='pos'?'yoy':'yoy_all',hk=S.base==='pos'?'half':'half_all';
  const rows=ST.filter(s=>(S.grp==='all'||s[3]===S.grp)&&L.stats[s[0]]&&L.stats[s[0]][yk]!=null).map(s=>({s,v:L.stats[s[0]]})).sort((a,b)=>b.v[yk]-a.v[yk]||a.s[1].localeCompare(b.s[1]));
  const all=ST.filter(s=>L.stats[s[0]]&&L.stats[s[0]][yk]!=null).map(s=>({s,v:L.stats[s[0]]})).sort((a,b)=>b.v[yk]-a.v[yk]||a.s[1].localeCompare(b.s[1]));
  const top=all.slice(0,3),low=all.slice(-3).reverse();
  const nmx=x=>two(esc(x.s[1]),esc(x.s[2]))+' '+nb(f2(x.v[yk]));
  const n=Math.max(...Object.values(L.stats).map(v=>v.n_yoy||0));
  const nseas=L.seasons.length;
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>How much does a player's number repeat?</b> For each stat, the same player's number per 90 in one season against the next, over ${nseas} ${esc(L.name||'')} seasons (${esc(L.seasons[0])} to ${esc(L.seasons[nseas-1])}), for players with ${F.min}+ minutes in both. Each number is set against players of his position first. <b>1</b> means it repeats exactly, <b>0</b> means nothing carries over.`,
     `<b>كم يتكرر رقم اللاعب؟</b> لكل إحصائية، رقم اللاعب لكل 90 في موسم مقابل الموسم اللي بعده، على ${nb(nseas)} مواسم من ${esc(L.name||'')} (من ${nb(esc(L.seasons[0]))} إلى ${nb(esc(L.seasons[nseas-1]))})، للاعبين اللي لعبوا ${nb(F.min+'+')} دقيقة في الموسمين. كل رقم يُقارن أول بلاعبي مركزه. <b>${nb(1)}</b> يعني يتكرر تمامًا، و<b>${nb(0)}</b> يعني ما يبقى منه شي.`)}</p>
    <p>${two(`Most repeatable: ${top.map(x=>nmx(x).replace(/<span class="fx-ar"[^>]*>.*?<\/span>/,'')).join(', ')}. Mostly luck: ${low.map(x=>nmx(x).replace(/<span class="fx-ar"[^>]*>.*?<\/span>/,'')).join(', ')}.`,
     `الأكثر تكرارًا: ${top.map(x=>nmx(x).replace(/<span class="fx-en">.*?<\/span>/,'')).join('، ')}. الأقرب للحظ: ${low.map(x=>nmx(x).replace(/<span class="fx-en">.*?<\/span>/,'')).join('، ')}.`)}</p></div>
   <div class="card"><div class="ctl">
     ${ids2(F)}
     <label class="dcx-l"><span class="mu">${two('Show','عرض')}</span><select id="stg">${GRP.map(g=>`<option value="${g[0]}"${S.grp===g[0]?' selected':''}>${ar()?g[2]:g[1]}</option>`).join('')}</select></label>
     <label class="dcx-l"><span class="mu">${two('Compared with','المقارنة مع')}</span><select id="stb"><option value="pos"${S.base==='pos'?' selected':''}>${ar()?'لاعبي نفس المركز':'players of the same position'}</option><option value="all"${S.base==='all'?' selected':''}>${ar()?'كل اللاعبين (رقم خام)':'all players (raw)'}</option></select></label></div>
    <div class="wrap"><table class="lk-t st-t"><thead><tr><th>${two('Stat','الإحصائية')}</th><th class="n">${two('Year to year','من موسم لموسم')}</th><th class="n">${two('Within a season','داخل الموسم')}</th><th class="n">${two('Pairs','أزواج')}</th><th>${two('Reading','القراءة')}</th></tr></thead><tbody>
    ${rows.map(x=>{const y=x.v[yk],h=x.v[hk],b=band(y);return `<tr data-k="${x.s[0]}"><td>${two(esc(x.s[1]),esc(x.s[2]))}</td><td class="n st-y">${f2(y)}<i class="rc-p" style="--w:${Math.round(Math.max(0,y)*100)}%;background:linear-gradient(90deg,${col(y)} ${Math.round(Math.max(0,y)*100)}%,rgba(255,255,255,.08) ${Math.round(Math.max(0,y)*100)}%)"></i></td><td class="n st-h">${f2(h)}</td><td class="n">${x.v.n_yoy}</td><td class="mu">${two(b[0],b[1])}</td></tr>`}).join('')}</tbody></table></div>
    <p class="mu ins-note">${two(`Year to year uses ${n} pairs of neighbouring seasons at most (a player in four seasons gives three). "Within a season" splits each player's matches odd against even and corrects for halving the sample; it needs 300+ minutes in each half. Only players who kept playing are in it, and moves, injuries, ageing and a new role all count as the number "not repeating". Positions are PitchAPI's DF / MF / FW. It says how far to trust a number from one season to the next, not how good the stat is.`,
     `أزواج المواسم المتجاورة أقصاها ${nb(n)} (لاعب في أربعة مواسم يعطي ثلاثة). «داخل الموسم» يقسّم مباريات كل لاعب فردي مقابل زوجي ويصحّح لأن العينة انقسمت؛ ويحتاج ${nb('300+')} دقيقة في كل نصف. فقط اللاعبين اللي استمروا يلعبون موجودين، والانتقال والإصابة والعمر والدور الجديد كلها تُحسب «ما تكرر الرقم». المراكز هي ${nb('DF / MF / FW')} من PitchAPI. الجدول يقول كم نثق برقم من موسم لموسم، مو كم الإحصائية جيدة.`)}</p></div>`;
  const q=id=>root.querySelector(id);
  q('#stg').onchange=e=>{S.grp=e.target.value;draw(root,F)};q('#stb').onchange=e=>{S.base=e.target.value;draw(root,F)};
  const sl=q('#stl');if(sl)sl.onchange=e=>{S.lg=e.target.value;draw(root,F)};
 }
 const ids2=F=>{const ids=Object.keys(F.leagues);return ids.length<2?'':`<label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="stl">${ids.map(i=>`<option value="${esc(i)}"${S.lg===i?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label>`};
 INS.ar({'Stat stability':'ثبات الإحصائيات'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
