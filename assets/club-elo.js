/* ===== Club Elo (#/elo, in Teams after League DNA): a rating for every club, worked out from the results alone =====
   data/elo_own.json is written by the sync (sync.py "ELO2") from PitchAPI's results: per league, from the chain of finished seasons that ends at the
   current one (Premier League from 2021-22, the others from 2024-25), K 30, home advantage 50 points, a goal-difference multiplier, 10% pulled to the
   league mean between seasons, a new club starting at the league mean. The parameters were fitted on matches before 1 Aug 2025 only and tested on all
   the matches after it; the page shows that test (Brier against the league's win/draw/loss rates). It is NOT ClubElo: ratings of different leagues
   are not comparable (each league starts from the same 1500), and a league with two seasons of history has a rougher start than the Premier League. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('elo','Club Elo','teams','leaguedna');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const S={lg:'',sort:'r',tok:0};
 let CF=null,CK='';
 async function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('elo_own.json',ALL.generated).then(d=>{if(!d||!d.leagues||!Object.keys(d.leagues).length)throw new Error('elo');return d}).catch(e=>{if(CF===p)CF=null;throw e});CF=p;return p;
 }
 const sg=(v,d)=>v==null?'–':(v>=0?'+':'−')+Math.abs(v).toFixed(d);
 const f3=v=>(+v).toFixed(3);
 function spark(h){
  if(!h||h.length<3)return '';
  const v=h.map(x=>x[1]),lo=Math.min(...v),hi=Math.max(...v),W=96,H=24,sp=hi-lo||1;
  const pts=v.map((y,i)=>((i/(v.length-1))*W).toFixed(1)+','+(H-2-((y-lo)/sp)*(H-4)).toFixed(1)).join(' ');
  return `<svg class="el-sp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${v[v.length-1]>=v[0]?'#3fa34d':'#d64541'}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
 }
 R.elo=async function(el){
  el.innerHTML='<h2>Club Elo</h2><div id="elroot" class="ins lk el"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#elroot'),lg=D.id,tok=++S.tok;
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The Elo ratings are not available right now.','تقييمات Elo مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!F.leagues[S.lg])S.lg=F.leagues[lg]?lg:Object.keys(F.leagues)[0];
  draw(root,F);
 };
 function draw(root,F){
  const L=F.leagues[S.lg],bt=F.backtest,ids=Object.keys(F.leagues),P=F.params;
  const T=Object.entries(L.teams).map(([t,x])=>({t,...x})).sort((a,b)=>S.sort==='d5'?(b.d5==null)-(a.d5==null)||b.d5-a.d5||b.r-a.r:S.sort==='d5l'?(a.d5==null)-(b.d5==null)||a.d5-b.d5||b.r-a.r:b.r-a.r||a.t.localeCompare(b.t));
  const seasons=L.seasons,first=seasons[0],last=seasons[seasons.length-1];
  const pc=x=>Math.round(x*100);
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>How strong is each club?</b> An Elo rating worked out from results alone: a win over a stronger club moves it up more than a win over a weaker one, a bigger margin counts more, and the home side gets ${nb(P.H)} points of advantage. The league average is about ${nb(1500)}. Built from ${esc(L.name)} results from ${esc(first)} to ${esc(last)} (${nb(L.n)} matches), last match ${esc(L.last)}.`,
     `<b>كم قوي كل نادي؟</b> تقييم Elo محسوب من النتائج وحدها: الفوز على نادي أقوى يرفع أكثر من الفوز على أضعف، وفرق الأهداف الأكبر يُحسب أكثر، وصاحب الأرض له أفضلية ${nb(P.H)} نقطة. متوسط الدوري حوالي ${nb(1500)}. مبني على نتائج ${esc(L.name)} من ${nb(esc(first))} إلى ${nb(esc(last))} (${nb(L.n)} مباراة)، وآخر مباراة ${nb(esc(L.last))}.`)}</p>
    <p class="mu">${two(`<b>Read it carefully.</b> This is not ClubElo (that site does not answer our server). Ratings of different leagues cannot be compared with each other: every league starts from the same ${nb(1500)}. A league built from two seasons (all but the Premier League) has a rougher start than the Premier League's five.`,
     `<b>اقرأه بحذر.</b> هذا مو ClubElo (موقعه ما يرد على سيرفرنا). تقييمات الدوريات المختلفة ما تتقارن ببعض: كل دوري بدأ من نفس ${nb(1500)}. والدوري المبني على موسمين (كل الدوريات إلا الإنجليزي) بدايته أخشن من الإنجليزي اللي له خمسة مواسم.`)}</p>
    ${bt?`<p>${two(`<b>Tested, not assumed:</b> the settings were chosen on matches before ${esc(bt.split)} only. On the ${nb(bt.n)} matches after it, asked before each match, Elo scores Brier <b>${nb(f3(bt.brier))}</b> against ${nb(f3(bt.base))} for a guess that only knows each result's overall frequency (lower is better), and picks the most likely result right ${nb(pc(bt.acc)+'%')} of the time. It is a modest forecaster, as football results are noisy; the Model report card sets it against the match model and the bookmakers.`,
     `<b>مجرّب، مو مفترض:</b> الإعدادات انختارت على مباريات قبل ${nb(esc(bt.split))} فقط. على الـ${nb(bt.n)} مباراة اللي بعده، وكل مباراة انسألت قبل ما تنلعب، يسجّل Elo ${nb('Brier')} <b>${nb(f3(bt.brier))}</b> مقابل ${nb(f3(bt.base))} لتخمين ما يعرف إلا تكرار كل نتيجة (الأقل أحسن)، ويصيب النتيجة الأرجح في ${nb(pc(bt.acc)+'%')} من المباريات. متنبّئ متواضع، لأن نتائج الكرة فيها ضجيج؛ وبطاقة تقييم النموذج تقارنه بنموذج المباريات وشركات المراهنات.`)}</p>`:''}</div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="ell">${ids.map(i=>`<option value="${esc(i)}"${S.lg===i?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Order','الترتيب')}</span><select id="els"><option value="r"${S.sort==='r'?' selected':''}>${(typeof ARL==='object'&&ARL.on)?'الأعلى تقييمًا':'Highest rating'}</option><option value="d5"${S.sort==='d5'?' selected':''}>${(typeof ARL==='object'&&ARL.on)?'الأكثر صعودًا (آخر 5)':'Rising most (last 5)'}</option><option value="d5l"${S.sort==='d5l'?' selected':''}>${(typeof ARL==='object'&&ARL.on)?'الأكثر نزولًا (آخر 5)':'Falling most (last 5)'}</option></select></label></div>
    <div class="wrap"><table class="lk-t el-t"><thead><tr><th class="n">#</th><th>${two('Club','النادي')}</th><th class="n">${nb('Elo')}</th><th class="n">${two('Last 5','آخر 5')}</th><th class="n">${two('Last 10','آخر 10')}</th><th>${two('Trend','الاتجاه')}</th><th class="n">${two('Matches','المباريات')}</th></tr></thead><tbody>
    ${T.map((x,i)=>`<tr data-t="${esc(x.t)}"><td class="n mu">${i+1}</td><td>${typeof hCrest==='function'?hCrest(x.t)+' ':''}${nm(x.t)}</td><td class="n el-r"><b>${Math.round(x.r)}</b></td><td class="n el-5 ${x.d5==null?'':x.d5>=0?'lk-up':'lk-dn'}">${nb(sg(x.d5,0))}</td><td class="n el-10 ${x.d10==null?'':x.d10>=0?'lk-up':'lk-dn'}">${nb(sg(x.d10,0))}</td><td>${spark(x.h)}</td><td class="n">${x.n}</td></tr>`).join('')}</tbody></table></div>
    <p class="mu ins-note">${two(`"Last 5" and "Last 10" are the change in rating over a club's last 5 and 10 matches. The trend line is its rating after each of its last ${nb(60)} matches. Settings (fitted on matches before ${esc(bt?bt.split:'1 Aug 2025')}): K ${nb(P.K)}, home advantage ${nb(P.H)}, ${nb(Math.round(P.reg*100)+'%')} pulled to the league mean each new season, a new club starts at the league mean.`,
     `«آخر 5» و«آخر 10» هي تغيّر التقييم خلال آخر 5 و10 مباريات للنادي. خط الاتجاه هو تقييمه بعد كل مباراة من آخر ${nb(60)} مباراة. الإعدادات (انضبطت على مباريات قبل ${nb(esc(bt?bt.split:'2025-08-01'))}): K ${nb(P.K)}، أفضلية الأرض ${nb(P.H)}، سحب ${nb(Math.round(P.reg*100)+'%')} نحو متوسط الدوري كل موسم جديد، والنادي الجديد يبدأ من متوسط الدوري.`)}</p></div>
   ${bt&&bt.per_league?`<div class="card"><h3>${two('The test, league by league','الاختبار، دوري بدوري')}</h3><div class="wrap"><table class="lk-t el-b"><thead><tr><th>${two('League','الدوري')}</th><th class="n">${two('Matches','المباريات')}</th><th class="n">${nb('Elo Brier')}</th><th class="n">${two('Base rates','النسب العامة')}</th></tr></thead><tbody>
    ${Object.entries(bt.per_league).map(([i,v])=>`<tr data-l="${esc(i)}"><td>${nm((F.leagues[i]||{}).name||i)}</td><td class="n">${v.n}</td><td class="n">${f3(v.brier)}</td><td class="n">${f3(v.base)}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
  const q=id=>root.querySelector(id);
  q('#ell').onchange=e=>{S.lg=e.target.value;draw(root,F)};q('#els').onchange=e=>{S.sort=e.target.value;draw(root,F)};
 }
 INS.ar({'Club Elo':'تقييم Elo للأندية'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
