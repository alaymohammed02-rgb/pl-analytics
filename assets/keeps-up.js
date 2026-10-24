/* ===== Who keeps it up? (#/keepsup, in Players after Stat stability): this season's per-90 number against what is likely to repeat =====
   A player's number per 90 is partly the player and partly luck, so the best guess for next season is pulled towards the average of his
   position in the league, harder the fewer minutes he has:  guess = mean + (number - mean) × m ÷ (m + K)  (m = minutes, K per stat).
   K and the test come from data/regress.json (tools/regress/fit.py): K fitted on Premier League pairs of seasons 2021-22 to 2024-25, then the
   rule tested on all six leagues, 2024-25 to 2025-26, against "next season = this season". The page shows the tested gain per stat, and says so
   where it is within noise (passes: no gain). The league mean is that league's own mean this season (450+ minutes). The guess is a guess, not a forecast of a match. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('keepsup','Who keeps it up?','players','stability');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const ST=[['gl','Goals','الأهداف'],['npxg','Non-penalty xG','xG بدون ركلات الجزاء'],['xg','xG','xG'],['sh','Shots','التسديدات'],['ast','Assists','التمريرات الحاسمة'],['xag','xAG','xAG'],['kp','Key passes','التمريرات المفتاحية'],['tk','Tackles','الافتكاكات'],['ic','Interceptions','الاعتراضات'],['ps','Passes','التمريرات']];
 const POS=[['all','All positions','كل المراكز'],['DF','Defenders','المدافعون'],['MF','Midfielders','لاعبو الوسط'],['FW','Forwards','المهاجمون']];
 const S={stat:'gl',pos:'all',dir:'hot',tok:0},ROWS=20;
 let CF=null,CK='';
 async function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('regress.json').then(d=>{if(!d||!d.stats)throw new Error('regress');return d}).catch(e=>{if(CF===p)CF=null;throw e});CF=p;return p;
 }
 /* per player: minutes, position (most minutes), per 90 of every stat (minutes of the matches that have it) — goalkeepers left out */
 function players(o,F){
  const cols=o.pl.cols,ix={};cols.forEach((c,i)=>ix[c]=i);const acc=new Map();
  for(const r of o.pl.rows){const mi=r[ix.mi];if(mi==null)continue;
   let a=acc.get(r[ix.i]);if(!a){a={id:r[ix.i],name:r[ix.n],team:r[ix.c],mi:0,pos:{},t:{},d:{}};acc.set(r[ix.i],a)}
   a.mi+=mi;a.team=r[ix.c]||a.team;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi;
   for(const s of ST){const v=ix[s[0]]==null?null:r[ix[s[0]]];if(v!=null){a.t[s[0]]=(a.t[s[0]]||0)+v;a.d[s[0]]=(a.d[s[0]]||0)+mi}}}
  const out=[];
  for(const a of acc.values()){let pos=null,best=-1;for(const p in a.pos)if(a.pos[p]>best){best=a.pos[p];pos=p}
   if(!pos||pos==='GK'||a.mi<F.min_x)continue;out.push({id:a.id,name:a.name,team:a.team,pos,mi:a.mi,t:a.t,d:a.d})}
  return out;
 }
 const f2=v=>(+v).toFixed(2);
 function calc(P,F,k){
  const g={};for(const p of P)if(p.d[k]>0){const v=p.t[k]/p.d[k]*90;(g[p.pos]||(g[p.pos]=[])).push(v)}
  const mu={};for(const q in g)if(g[q].length>=5)mu[q]=g[q].reduce((a,b)=>a+b,0)/g[q].length;
  const K=F.stats[k].K;
  return P.filter(p=>p.d[k]>0&&mu[p.pos]!=null).map(p=>{const x=p.t[k]/p.d[k]*90,m=p.d[k],e=mu[p.pos]+(x-mu[p.pos])*m/(m+K);return {p,x,e,diff:x-e,mu:mu[p.pos]}});
 }
 R.keepsup=async function(el){
  el.innerHTML='<h2>Who keeps it up?</h2><div id="kuroot" class="ins lk ku"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#kuroot'),lg=D.id,tok=++S.tok;
  let F,o;try{[F,o]=await Promise.all([load(),INS.poolOne(lg,['pl'])]);if(!o||!o.pl)throw new Error('pl')}catch(e){if(!root.isConnected||tok!==S.tok||D.id!==lg)return;root.innerHTML=`<div class="empty">${two('Could not load the numbers. Try again later.','ما قدرنا نحمّل الأرقام. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  const P=players(o,F);
  if(P.length<20){root.innerHTML=`<div class="empty">${two('Not enough players with '+F.min_x+'+ minutes yet.','ما فيه لاعبين كفاية بـ '+F.min_x+'+ دقيقة للحين.')}</div>`;return}
  draw(root,F,P,o);
 };
 function verdict(s){
  return s.gain>1.96*s.se?['better than the raw number','أحسن من الرقم الخام']:s.gain<-1.96*s.se?['worse than the raw number','أسوأ من الرقم الخام']:['no better than the raw number (within noise)','مو أحسن من الرقم الخام (ضمن الحظ)'];
 }
 function draw(root,F,P,o){
  const k=S.stat,s=F.stats[k],nmS=ST.find(x=>x[0]===k),all=calc(P,F,k);
  let rows=all.filter(r=>S.pos==='all'||r.p.pos===S.pos);
  rows=rows.sort((a,b)=>S.dir==='hot'?b.diff-a.diff||a.p.name.localeCompare(b.p.name):a.diff-b.diff||a.p.name.localeCompare(b.p.name)).slice(0,ROWS);
  const v=verdict(s),pct=x=>Math.round(x*100),fs=F.fit.match(/\d{4}-\d{2}/g),ts=F.test.match(/\d{4}-\d{2}/g);
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Who keeps it up?</b> A player's number this season is partly him and partly luck, so the likely number next season is pulled towards the average of his position, harder when he has played fewer minutes. This page shows each player's number per 90, that likely number, and the gap. A big plus means he is running above what usually lasts; a big minus means he is below it. It is a guess about the player, not a forecast of one match.`,
     `<b>مين يكمّل على مستواه؟</b> رقم اللاعب هذا الموسم جزء منه هو وجزء حظ، فالرقم المتوقع الموسم الجاي يُسحب نحو متوسط مركزه، وأكثر لما يكون لعب دقائق أقل. الصفحة تعرض رقم كل لاعب لكل 90، والرقم المتوقع، والفرق. زائد كبير يعني هو فوق اللي يدوم عادةً، وناقص كبير يعني تحته. هذا تخمين عن اللاعب، مو توقع لمباراة وحدة.`)}</p>
    <p>${two(`<b>Tested, not assumed:</b> the rule was fitted on Premier League pairs of neighbouring seasons from ${esc(fs[0])} to ${esc(fs[fs.length-1])}, then tried on ${nb(F.n_test)} players of the six leagues, ${esc(ts[0])} to ${esc(ts[1])}, against "next season = this season". For ${esc(nmS[1])} it was <b>${v[0]}</b> (squared error ${s.gain>=0?'down':'up'} ${nb(Math.abs(pct(s.gain))+'%')} ± ${nb(pct(s.se)+'%')}).`,
     `<b>مجرّب، مو مفترض:</b> القاعدة انضبطت على أزواج مواسم متجاورة من الدوري الإنجليزي من ${nb(esc(fs[0]))} إلى ${nb(esc(fs[fs.length-1]))}، وبعدين جرّبناها على ${nb(F.n_test)} لاعب في الدوريات الستة، من ${nb(esc(ts[0]))} إلى ${nb(esc(ts[1]))}، مقابل «الموسم الجاي = هذا الموسم». في ${esc(nmS[2])} كانت <b>${v[1]}</b> (مربع الخطأ ${s.gain>=0?'نزل':'طلع'} ${nb(Math.abs(pct(s.gain))+'%')} ± ${nb(pct(s.se)+'%')}).`)}</p></div>
   <div class="card"><div class="ctl">
    <label class="dcx-l"><span class="mu">${two('Stat','الإحصائية')}</span><select id="kus">${ST.map(x=>`<option value="${x[0]}"${S.stat===x[0]?' selected':''}>${ar()?x[2]:x[1]}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Position','المركز')}</span><select id="kup">${POS.map(x=>`<option value="${x[0]}"${S.pos===x[0]?' selected':''}>${ar()?x[2]:x[1]}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Show','عرض')}</span><select id="kud"><option value="hot"${S.dir==='hot'?' selected':''}>${ar()?'فوق اللي يدوم (يتوقع ينزل)':'above what lasts (likely to cool)'}</option><option value="cold"${S.dir==='cold'?' selected':''}>${ar()?'تحت اللي يدوم (يتوقع يرتفع)':'below what lasts (likely to rise)'}</option></select></label></div>
    <div class="wrap"><table class="lk-t ku-t"><thead><tr><th>${two('Player','اللاعب')}</th><th>${two('Team','الفريق')}</th><th class="n">${two('Minutes','الدقائق')}</th><th class="n">${two('Per 90 now','لكل 90 الحين')}</th><th class="n">${two('Likely','المتوقع')}</th><th class="n">${two('Gap','الفرق')}</th></tr></thead><tbody>
    ${rows.map(r=>`<tr data-id="${esc(r.p.id)}"><td>${nm(r.p.name)} <span class="mu">${esc(r.p.pos)}</span></td><td>${nm(r.p.team||'')}</td><td class="n">${Math.round(r.p.mi)}</td><td class="n ku-x">${f2(r.x)}</td><td class="n ku-e">${f2(r.e)}</td><td class="n ku-d">${r.diff>=0?'+':'−'}${f2(Math.abs(r.diff))}</td></tr>`).join('')||`<tr><td colspan="6" class="mu">${two('No players for this choice.','ما فيه لاعبين لهذا الاختيار.')}</td></tr>`}</tbody></table></div>
    <p class="mu ins-note">${two(`Players with ${F.min_x}+ minutes, goalkeepers left out. The average is the league's own, for the position, this season. K = ${nb(s.K)} minutes for ${esc(nmS[1])}: a player with ${nb(s.K)} minutes keeps half of his gap from the average. Tested on players with ${F.min_x}+ minutes one season and ${F.min_y}+ the next, so it says nothing about players who stop playing. Moves, injuries, age and a new role are not in the guess.`,
     `اللاعبون بـ ${nb(F.min_x+'+')} دقيقة، بدون الحراس. المتوسط هو متوسط الدوري نفسه لنفس المركز هذا الموسم. K = ${nb(s.K)} دقيقة في ${esc(nmS[2])}: اللاعب اللي لعب ${nb(s.K)} دقيقة يحتفظ بنصف فرقه عن المتوسط. الاختبار على لاعبين بـ ${nb(F.min_x+'+')} دقيقة في موسم و${nb(F.min_y+'+')} في اللي بعده، فما يقول شي عن لاعبين وقفوا يلعبون. الانتقال والإصابة والعمر والدور الجديد مو داخلة في التخمين.`)}</p></div>
   <div class="card"><p class="mu">${two('Tested gain of the rule over the raw number, every stat (six leagues, '+esc(ts[0])+' to '+esc(ts[1])+')','مكسب القاعدة على الرقم الخام لكل إحصائية (الدوريات الستة، من '+nb(esc(ts[0]))+' إلى '+nb(esc(ts[1]))+')')}</p>
    <div class="wrap"><table class="lk-t ku-b"><thead><tr><th>${two('Stat','الإحصائية')}</th><th class="n">K</th><th class="n">${two('Error raw','خطأ الخام')}</th><th class="n">${two('Error with rule','خطأ بالقاعدة')}</th><th class="n">${two('Gain','المكسب')}</th><th>${two('Reading','القراءة')}</th></tr></thead><tbody>
    ${ST.map(x=>{const t=F.stats[x[0]],w=verdict(t);return `<tr data-k="${x[0]}"><td>${two(esc(x[1]),esc(x[2]))}</td><td class="n">${t.K}</td><td class="n">${t.rmse_raw}</td><td class="n">${t.rmse_shrunk}</td><td class="n">${t.gain>=0?'+':'−'}${Math.abs(pct(t.gain))}% ± ${pct(t.se)}%</td><td class="mu">${two(w[0],w[1])}</td></tr>`}).join('')}</tbody></table></div></div>`;
  const q=id=>root.querySelector(id);
  q('#kus').onchange=e=>{S.stat=e.target.value;draw(root,F,P,o)};q('#kup').onchange=e=>{S.pos=e.target.value;draw(root,F,P,o)};q('#kud').onchange=e=>{S.dir=e.target.value;draw(root,F,P,o)};
 }
 INS.ar({'Who keeps it up?':'مين يكمّل على مستواه؟'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
