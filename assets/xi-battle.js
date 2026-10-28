/* ===== XI Battle (#/battle, in Compare after XI Builder): put two elevens against each other and get win / draw / loss =====
   Each side is your XI from the XI Builder (saved in this browser), a club's latest official line-up, or a friend's XI from a shared link
   (#/battle/<11 player ids>). Every player has three numbers in data/xib.json, written by the sync (sync.py "XIB") from his matches in the six leagues
   (every season of the chain, a match's weight halving every 365 days): npxG + xAG per 90 (pulled towards his position's mean by 2 × 90 minutes),
   and his team's xG for and against per 90 while he was on the pitch (pulled towards the mean team by 3 × 90 minutes). A side's goals are Poisson with
   log λ = b0 + bh × home + b1 × log(sum of the XI's npxG + xAG) + b2 × log(mean xG for) + b3 × log(the other XI's mean xG against).
   The coefficients were fitted on matches before 1 Aug 2025 only (tools/xib/fit.py --fit); data/xib_test.json holds the test on every later match with
   both official line-ups, each predicted before it was played from its two real XIs (Brier against Elo from results and the base rates).
   What the page says about it: leagues are treated as equal (nothing in our data measures one league against another), the model does not know
   positions or formations, and every tested XI was a real XI: a team of players from different clubs is outside what was tested.
   A player without minutes in the six leagues (only the World Cup, or no minutes yet) gets his position's mean and the mean team, and is marked. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('battle','XI Battle','compare','builder');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const POS={GK:['GK','حارس'],DF:['DF','مدافع'],MF:['MF','وسط'],FW:['FW','مهاجم']};
 const S={a:{src:'mine',lg:'',club:''},b:{src:'club',lg:'',club:''},venue:'n',code:'',tok:0,dn:0};
 let CF=null,CK='';
 /* the ratings and the test: one request each per data version; a failed file is not kept */
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();
  const p=Promise.all([loadJson('xib.json',ALL.generated),loadJson('xib_test.json',ALL.generated).catch(()=>null)]).then(([x,t])=>{if(!x||!x.p||!x.params||!Object.keys(x.p).length)throw new Error('xib');return {x,t}}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 const ok=g=>g==='GK'||g==='DF'||g==='MF'||g==='FW';
 /* a player's numbers: [npxG+xAG per 90, team xG for per 90, team xG against per 90, weighted 90s]; no minutes → the position's mean and the mean team */
 function rate(F,id,g){const r=F.x.p[id];if(r)return {att:r[0],f:r[1],a:r[2],w:r[3],est:false};
  const m=F.x.mu,ga=ok(g)?g:'MF';return {att:(m.att&&m.att[ga]!=null)?m.att[ga]:0.15,f:m.team,a:m.team,w:0,est:true}}
 function side(F,players){const r=players.map(p=>rate(F,p.id,p.pos));return {r,att:r.reduce((s,x)=>s+x.att,0),f:r.reduce((s,x)=>s+x.f,0)/r.length,a:r.reduce((s,x)=>s+x.a,0)/r.length}}
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 const lg_=x=>Math.log(Math.max(x,1e-3));
 /* the same sums as sync.py xib_probs: home = 1 side A at home, 0.5 neutral, 0 side B at home */
 function probs(b,A,B,home){
  const lh=Math.exp(b[0]+b[1]*home+b[2]*lg_(A.att)+b[3]*lg_(A.f)+b[4]*lg_(B.a)),la=Math.exp(b[0]+b[1]*(1-home)+b[2]*lg_(B.att)+b[3]*lg_(B.f)+b[4]*lg_(A.a));
  const ph=pois(lh),pa=pois(la);let w=0,d=0,l=0;const sc=[];
  for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q;sc.push([i,j,q])}
  const s=w+d+l;sc.sort((x,y)=>y[2]-x[2]||x[0]-y[0]||x[1]-y[1]);
  return {p:[w/s,d/s,l/s],lh,la,top:sc.slice(0,5).map(x=>[x[0],x[1],x[2]/s])};
 }
 /* the clubs of a league and their latest official XI (from the league's line-up file) */
 const MXC=new Map();
 function clubXIs(lid){
  const k=lid+'|'+INS.poolKey();
  if(!MXC.has(k))MXC.set(k,INS.poolOne(lid,['mx']).then(o=>{
   if(!o||!o.mx||!o.mx.m)throw new Error('mx');
   const out=new Map(),ms=(o.L.matches||[]).filter(m=>m&&m.d).slice().sort((a,b)=>String(b.d).localeCompare(String(a.d))||String(b.i).localeCompare(String(a.i)));
   for(const m of ms){const lu=(o.mx.m[m.i]||{}).lu||{};
    for(const [s,club] of [['h',m.h],['a',m.a]]){if(!club||out.has(club))continue;const x=(lu[s]||{}).xi;if(!Array.isArray(x)||x.length!==11)continue;
     out.set(club,{club,d:String(m.d).slice(0,10),vs:s==='h'?m.a:m.h,home:s==='h',xi:x.map(e=>({id:e[0],name:e[1],slot:+e[3]}))})}}
   return out}).catch(e=>{MXC.delete(k);throw e}));
  return MXC.get(k);
 }
 const slotPos=s=>s===11?'GK':s<50?'DF':s<100?'MF':'FW';
 function mine(P){let v=null;try{v=JSON.parse(localStorage.getItem('xb')||'null')}catch(e){v=null}
  if(!v||!Array.isArray(v.ids)||v.ids.length!==11)return null;
  const ps=v.ids.map(k=>k&&P.by.get(k)).filter(Boolean);return ps.length===11?{name:ar()?'تشكيلتي':'My XI',f:v.f,players:ps.map(p=>({id:p.id,name:p.name,pos:p.pos,club:p.club,photo:p.photo}))}:null}
 function friend(P,code){const ids=String(code||'').split('.').filter(x=>/^p_[A-Za-z0-9]+$/.test(x));if(ids.length!==11||new Set(ids).size!==11)return null;
  const by=new Map();for(const p of P.all)if(!by.has(p.id))by.set(p.id,p);
  return {name:ar()?'تشكيلة صديقك':'Friend\'s XI',players:ids.map(id=>{const p=by.get(id);return {id,name:p?p.name:id,pos:p?p.pos:null,club:p?p.club:'',photo:p?p.photo:''}})}}
 const codeOf=X=>X.players.map(p=>p.id).join('.');
 async function sideOf(P,s,lgs){
  if(s.src==='mine')return mine(P);
  if(s.src==='code')return friend(P,S.code);
  if(!s.lg||!lgs.some(l=>l.id===s.lg))s.lg=lgs.some(l=>l.id===D.id)?D.id:(lgs[0]||{}).id;
  if(!s.lg)return null;
  const C=await clubXIs(s.lg),clubs=[...C.keys()].sort((a,b)=>a.localeCompare(b));
  if(!C.has(s.club)){const o=s===S.b?S.a:S.b;s.club=(o.src==='club'&&o.lg===s.lg&&o.club===clubs[0]?clubs[1]:clubs[0])||''}
  const c=C.get(s.club);if(!c)return null;
  const by=new Map();for(const p of P.all)if(!by.has(p.id))by.set(p.id,p);
  return {name:c.club,clubs,c,players:c.xi.map(e=>{const p=by.get(e.id);return {id:e.id,name:e.name||(p&&p.name)||e.id,pos:(p&&p.pos)||slotPos(e.slot),club:c.club,photo:p?p.photo:''}})};
 }
 R.battle=async function(el,arg){
  el.innerHTML='<h2>XI Battle</h2><div id="btroot" class="ins lk bt"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#btroot'),lg=D.id,tok=++S.tok;
  if(arg&&/^p_/.test(arg)){S.code=decodeURIComponent(arg);S.b.src='code';S.a.src='mine'}
  let F,P;
  try{[F,P]=await Promise.all([load(),INS.playerPool()])}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('XI Battle is not available right now.','معركة التشكيلات مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  for(const s of [S.a,S.b]){if(s.src==='code'&&!friend(P,S.code))s.src='club';if(s.src==='mine'&&!mine(P))s.src='club'}
  await draw(root,F,P,tok);
 };
 const pc=x=>Math.round(x*100);
 function ctl(id,s,P,X,lgs){
  const has=mine(P),fr=S.code&&friend(P,S.code);
  return `<div class="bt-side"><div class="bt-h"><b>${id==='a'?two('Side A','الطرف أ'):two('Side B','الطرف ب')}</b></div>
   <select id="bt${id}s" aria-label="${ar()?'المصدر':'Source'}"><option value="mine"${s.src==='mine'?' selected':''}${has?'':' disabled'}>${ar()?'تشكيلتي (بناء التشكيلة)':'My XI (XI Builder)'}</option>
    <option value="club"${s.src==='club'?' selected':''}>${ar()?'آخر تشكيلة رسمية لنادي':'A club\'s latest official XI'}</option>
    ${fr?`<option value="code"${s.src==='code'?' selected':''}>${ar()?'تشكيلة صديقك (من الرابط)':'Friend\'s XI (from the link)'}</option>`:''}</select>
   ${s.src==='club'?`<select id="bt${id}l" aria-label="${ar()?'الدوري':'League'}">${lgs.map(l=>`<option value="${esc(l.id)}"${s.lg===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select>
    <select id="bt${id}c" aria-label="${ar()?'النادي':'Club'}">${((X&&X.clubs)||[]).map(c=>`<option${s.club===c?' selected':''}>${esc(c)}</option>`).join('')}</select>
    ${X&&X.c?`<p class="mu bt-src">${two(`Line-up of ${esc(X.c.d)}, ${X.c.home?'at home to':'away at'} ${nm(X.c.vs)}`,`تشكيلة ${nb(esc(X.c.d))}، ${X.c.home?'على أرضه ضد':'خارج أرضه ضد'} ${nm(X.c.vs)}`)}</p>`:''}`:''}
   ${s.src==='mine'&&!has?`<p class="mu bt-src">${two('Your XI is not complete. Fill all eleven spots in the <a href="#/builder">XI Builder</a>.','تشكيلتك مو كاملة. عبّ الإحدعشر مكان في <a href="#/builder">بناء التشكيلة</a>.')}</p>`:''}</div>`;
 }
 function lineup(X,Sd){
  return `<table class="lk-t bt-t"><thead><tr><th>${two('Player','اللاعب')}</th><th class="n" title="npxG + xAG per 90">${two('Att /90','هجوم /90')}</th><th class="n">${two('xG for /90','xG له /90')}</th><th class="n">${two('xG against /90','xG عليه /90')}</th><th class="n">${two('Data (90s)','البيانات (×90)')}</th></tr></thead><tbody>${X.players.map((p,i)=>{const r=Sd.r[i];
   return `<tr${r.est?' class="bt-est"':''}><td><span class="bt-p"><b>${nm(p.name)}</b><span class="mu">${p.pos&&POS[p.pos]?two(POS[p.pos][0],POS[p.pos][1]):''}${p.club&&p.club!==X.name?' · '+nm(p.club):''}</span></span></td><td class="n">${nb(r.att.toFixed(2))}</td><td class="n">${nb(r.f.toFixed(2))}</td><td class="n">${nb(r.a.toFixed(2))}</td><td class="n">${r.est?two('none: average','ما فيه: متوسط'):nb(r.w.toFixed(1))}</td></tr>`}).join('')}</tbody>
   <tfoot><tr><td><b>${two('XI','التشكيلة')}</b></td><td class="n"><b>${nb(Sd.att.toFixed(2))}</b> <span class="mu">${two('sum','مجموع')}</span></td><td class="n"><b>${nb(Sd.f.toFixed(2))}</b> <span class="mu">${two('mean','متوسط')}</span></td><td class="n"><b>${nb(Sd.a.toFixed(2))}</b> <span class="mu">${two('mean','متوسط')}</span></td><td></td></tr></tfoot></table>`;
 }
 function warn(X,Sd){
  const n=k=>X.players.filter(p=>p.pos===k).length,est=Sd.r.filter(r=>r.est).length,out=[];
  if(n('GK')!==1)out.push(two(`${esc(X.name)} has ${n('GK')} goalkeepers. The model does not look at positions, so it cannot punish that.`,`${nm(X.name)} فيها ${nb(n('GK'))} حراس. النموذج ما يشوف المراكز، فما يقدر يعاقب على هذا.`));
  if(est)out.push(two(`${est} player(s) of ${esc(X.name)} have no minutes in the six leagues: they count as the average player of their position in an average team.`,`${nb(est)} من لاعبي ${nm(X.name)} ما لهم دقايق في الدوريات الستة: انحسبوا كلاعب متوسط في مركزهم بفريق متوسط.`));
  return out;
 }
 async function draw(root,F,P,tok){
  const lgs=P.lgs.filter(l=>!/world cup/i.test(l.name));
  let A,B;const n=++S.dn;      /* a newer change wins: an older draw still waiting for its line-ups is dropped */
  try{A=await sideOf(P,S.a,lgs);B=await sideOf(P,S.b,lgs)}catch(e){if(!root.isConnected||tok!==S.tok||n!==S.dn)return;root.innerHTML=`<div class="empty">${two('Could not load the line-ups. Try again later.','ما قدرنا نحمّل التشكيلات. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||n!==S.dn)return;
  const t=F.t&&F.t.all,b=F.x.params.b,home=S.venue==='a'?1:S.venue==='b'?0:0.5;
  const SA=A&&side(F,A.players),SB=B&&side(F,B.players),res=A&&B?probs(b,SA,SB,home):null;
  const mineX=mine(P),link=mineX?location.href.split('#')[0]+'#/battle/'+codeOf(mineX):'';
  const same=A&&B&&codeOf(A)===codeOf(B),ws=A&&B?[...warn(A,SA),...warn(B,SB)]:[];
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Who wins?</b> Put two elevens against each other: your XI from the XI Builder, a club\'s latest official line-up, or a friend\'s XI from a link. Each player counts with what he has produced in the six leagues: his own npxG + xAG per 90, and how many chances his team made and allowed per 90 while he was on the pitch.','<b>مين يفوز؟</b> حط تشكيلتين ضد بعض: تشكيلتك من بناء التشكيلة، أو آخر تشكيلة رسمية لأي نادي، أو تشكيلة صديقك من رابط. كل لاعب ينحسب باللي قدّمه في الدوريات الستة: xG بدون ركلات جزاء + xAG له لكل 90 دقيقة، وكم فرصة صنع فريقه وكم سمح لكل 90 دقيقة وهو في الملعب.')}</p></div>
   <div class="card bt-set"><div class="bt-sides">${ctl('a',S.a,P,A,lgs)}${ctl('b',S.b,P,B,lgs)}</div>
    <div class="ctl bt-ctl"><label class="dcx-l"><span class="mu">${two('Ground','الملعب')}</span><select id="btv"><option value="a"${S.venue==='a'?' selected':''}>${ar()?'أ على أرضه':'A at home'}</option><option value="n"${S.venue==='n'?' selected':''}>${ar()?'ملعب محايد':'Neutral ground'}</option><option value="b"${S.venue==='b'?' selected':''}>${ar()?'ب على أرضه':'B at home'}</option></select></label>
     <button type="button" id="btsw" class="xb-clear">${two('Swap sides','بدّل الطرفين')}</button>
     ${mineX?`<button type="button" id="btsh" class="xb-clear">${two('Share my XI','شارك تشكيلتي')}</button>`:''}</div>
    ${mineX?`<div class="bt-link" id="btlk" hidden><input type="text" readonly value="${esc(link)}" aria-label="${ar()?'رابط تشكيلتك':'Link to your XI'}"><p class="mu ins-note">${two('Send this link to a friend: it opens this page with your XI as their opponent.','أرسل هذا الرابط لصديقك: يفتح هذي الصفحة وتشكيلتك خصمه.')}</p></div>`:''}</div>
   ${res?`<div class="card bt-res"><div class="bt-vs"><b>${nm(A.name)}</b><span class="mu">${two('vs','ضد')}</span><b>${nm(B.name)}</b></div>
    <div class="bt-bar" role="img" aria-label="${pc(res.p[0])}% / ${pc(res.p[1])}% / ${pc(res.p[2])}%"><span class="w" style="width:${(res.p[0]*100).toFixed(1)}%"></span><span class="d" style="width:${(res.p[1]*100).toFixed(1)}%"></span><span class="l" style="width:${(res.p[2]*100).toFixed(1)}%"></span></div>
    <div class="bt-pp"><div><b>${nb(pc(res.p[0])+'%')}</b><span class="mu">${two(`${esc(A.name)} wins`,`يفوز ${nm(A.name)}`)}</span></div><div><b>${nb(pc(res.p[1])+'%')}</b><span class="mu">${two('Draw','تعادل')}</span></div><div><b>${nb(pc(res.p[2])+'%')}</b><span class="mu">${two(`${esc(B.name)} wins`,`يفوز ${nm(B.name)}`)}</span></div></div>
    <p class="bt-xg">${two(`Expected goals: ${esc(A.name)} ${nb(res.lh.toFixed(2))}, ${esc(B.name)} ${nb(res.la.toFixed(2))}.`,`الأهداف المتوقعة: ${nm(A.name)} ${nb(res.lh.toFixed(2))}، ${nm(B.name)} ${nb(res.la.toFixed(2))}.`)}</p>
    <p class="mu">${two('Most likely scores','أكثر النتائج احتمالًا')}: ${res.top.map(x=>`<span class="bt-sc">${nb(x[0]+'–'+x[1])} <span class="mu">${nb(pc(x[2])+'%')}</span></span>`).join(' ')}</p>
    ${same?`<p class="mu ins-note">${two('Both sides are the same eleven.','الطرفين نفس التشكيلة.')}</p>`:''}
    ${ws.map(w=>`<p class="mu ins-note bt-w">${w}</p>`).join('')}</div>
   <div class="bt-two"><div class="card"><h3>${nm(A.name)}</h3>${lineup(A,SA)}</div><div class="card"><h3>${nm(B.name)}</h3>${lineup(B,SB)}</div></div>`
   :`<div class="card"><div class="empty">${two('Pick two complete elevens.','اختر تشكيلتين كاملتين.')}</div></div>`}
   <div class="card"><h3>${two('How good is it?','قد إيش هو دقيق؟')}</h3>
    ${t?`<p>${two(`Tested on <b>${nb(t.n.toLocaleString('en'))}</b> matches of the six leagues from ${nb('1 Aug 2025')}, each predicted before it was played from its two real starting XIs (the settings were fitted only on matches before that date). Brier score (lower is better): <b>${nb(t.brier.toFixed(3))}</b>, against ${nb(t.elo.toFixed(3))} for Elo from results and ${nb(t.base.toFixed(3))} for the leagues' usual win / draw / loss rates. ${Math.abs(t.d_elo)<1.96*t.se_elo?'Against Elo the difference is within noise: it is as good as Elo, not better.':t.d_elo<0?'It beats Elo beyond noise.':'Elo is better, beyond noise.'} It picked the right result ${nb(pc(t.acc)+'%')} of the time (Elo ${nb(pc(t.acc_elo)+'%')}).`,`انجرّب على <b>${nb(t.n.toLocaleString('en'))}</b> مباراة في الدوريات الستة من ${nb('1')} أغسطس ${nb('2025')}، كل مباراة توقّعها قبل ما تنلعب من تشكيلتيها الأساسيتين الحقيقيتين (الإعدادات انضبطت على مباريات قبل هذاك التاريخ فقط). مقياس Brier (الأقل أحسن): <b>${nb(t.brier.toFixed(3))}</b>، مقابل ${nb(t.elo.toFixed(3))} لـ ${nb('Elo')} من النتائج و${nb(t.base.toFixed(3))} لنسب الفوز والتعادل والخسارة المعتادة في الدوريات. ${Math.abs(t.d_elo)<1.96*t.se_elo?`الفرق عن ${nb('Elo')} داخل الضجيج: هو بمستوى ${nb('Elo')}، مو أحسن منه.`:t.d_elo<0?`يتفوّق على ${nb('Elo')} بفرق أكبر من الضجيج.`:`${nb('Elo')} أحسن منه بفرق أكبر من الضجيج.`} توقّع النتيجة الصح في ${nb(pc(t.acc)+'%')} من المباريات (${nb('Elo')}: ${nb(pc(t.acc_elo)+'%')}).`)}</p>
    <details><summary>${two('Per league','لكل دوري')}</summary><table class="lk-t bt-lg"><thead><tr><th>${two('League','الدوري')}</th><th class="n">${two('Matches','مباريات')}</th><th class="n">${two('XI model','نموذج التشكيلة')}</th><th class="n">${nb('Elo')}</th><th class="n">${two('Base rates','النسب العامة')}</th></tr></thead><tbody>${Object.entries(F.t.per_league||{}).map(([id,v])=>{const l=(ALL.leagues||[]).find(x=>x.id===id);return `<tr><td>${nm(l?l.name:id)}</td><td class="n">${nb(v.n)}</td><td class="n">${nb(v.brier.toFixed(3))}</td><td class="n">${nb(v.elo.toFixed(3))}</td><td class="n">${nb(v.base.toFixed(3))}</td></tr>`}).join('')}</tbody></table></details>`
    :`<p class="mu">${two('The test file is not available right now.','ملف الاختبار مو متوفر الحين.')}</p>`}
    <p class="mu ins-note">${two(`What it cannot know: <b>leagues are treated as equal</b> (nothing in our data measures one league against another), it does not look at positions or formations, and <b>every tested XI was a real XI</b>: a team of players from different clubs and leagues is outside what was tested, so read it as a game. Players' numbers are as of ${nb(esc(F.x.asof||''))}, from ${nb(F.x.n_matches.toLocaleString('en'))} matches; a match's weight halves every ${nb(F.x.params.hl)} days.`,`اللي ما يقدر يعرفه: <b>الدوريات تنحسب كأنها بنفس المستوى</b> (ما في بياناتنا شي يقيس دوري ضد دوري)، وما يشوف المراكز ولا طريقة اللعب، و<b>كل التشكيلات اللي انجرّب عليها كانت تشكيلات حقيقية</b>: فريق من لاعبين من أندية ودوريات مختلفة برّا اللي انجرّب، فخذه كلعبة. أرقام اللاعبين لين ${nb(esc(F.x.asof||''))}، من ${nb(F.x.n_matches.toLocaleString('en'))} مباراة؛ وزن المباراة ينقص للنص كل ${nb(F.x.params.hl)} يوم.`)}</p></div>`;
  const q=s=>root.querySelector(s),re=()=>draw(root,F,P,tok);
  for(const id of ['a','b']){const s=S[id];
   q('#bt'+id+'s').onchange=e=>{s.src=e.target.value;re()};
   const l=q('#bt'+id+'l');if(l)l.onchange=e=>{s.lg=e.target.value;s.club='';re()};
   const c=q('#bt'+id+'c');if(c)c.onchange=e=>{s.club=e.target.value;re()}}
  q('#btv').onchange=e=>{S.venue=e.target.value;re()};
  q('#btsw').onclick=()=>{const x=S.a;S.a=S.b;S.b=x;S.venue=S.venue==='a'?'b':S.venue==='b'?'a':'n';re()};
  const sh=q('#btsh');if(sh)sh.onclick=async()=>{const lk=q('#btlk');lk.hidden=false;const i=lk.querySelector('input');i.select();
   try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(link);sh.innerHTML=two('Link copied','تم نسخ الرابط')}}catch(e){}};
 }
 INS.ar({'XI Battle':'معركة التشكيلات'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
