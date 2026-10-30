/* ===== Late show (#/late, in the Matches hub after Comebacks & collapses): the points that goals after a chosen minute won and lost =====
   The minute of every goal comes from the shot data (PitchAPI), own goals counted for the side they help; a match is used only when its goals add up
   to the final score (the Comebacks & collapses page uses the same rule). For a chosen minute M (60, 75, 80 or 85), the score "at M" counts the goals whose
   minute is M or earlier; stoppage time is part of minute 45 and 90 (the data has no real clock), so a goal in added time at the end counts as after M.
   For each club, over its matches: points won from the late goals = the points it finished with minus the points the score at M would have given it
   (3 / 1 / 0), split into points gained (the late goals lifted its result) and points lost (they lowered it); net = gained - lost. Late goals for and
   against are the goals after M. Pressing a club lists the matches where its points changed. Nothing is estimated: it only says what the last
   minutes did. A club's numbers in a season under way rest on a few matches. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.poolOne!=='function'||typeof INS.addPage!=='function')return;
 INS.addPage('late','Late show','matches','states');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const MINS=[60,75,80,85];
 const S={lg:'',m:75,pick:'',tok:0};
 const pts=(a,b)=>a>b?3:a===b?1:0;
 function calc(P,M){
  const T=new Map(),row=t=>{let r=T.get(t);if(!r)T.set(t,r={t,n:0,pts:0,gf:0,ga:0,gain:0,lost:0,ch:[]});return r};
  let used=0,skipped=0,goals=0,late=0;
  P.ms.forEach(m=>{const g=P.goals(m.id);if(g.length!==m.hg+m.ag){skipped++;return}
   used++;let h=0,a=0,lh=0,la=0;g.forEach(x=>{goals++;if(x.mn<=M){x.home?h++:a++}else{late++;x.home?lh++:la++}});
   const dh=pts(m.hg,m.ag)-pts(h,a),da=pts(m.ag,m.hg)-pts(a,h);
   for(const [t,gf,ga,dd,fin,sM,oM] of [[m.home,lh,la,dh,pts(m.hg,m.ag),h,a],[m.away,la,lh,da,pts(m.ag,m.hg),a,h]]){const r=row(t);r.n++;r.pts+=fin;r.gf+=gf;r.ga+=ga;if(dd>0)r.gain+=dd;else if(dd<0)r.lost-=dd;
    if(dd!==0)r.ch.push({d:m.d,id:m.id,home:t===m.home,opp:t===m.home?m.away:m.home,s0:[sM,oM],s1:t===m.home?[m.hg,m.ag]:[m.ag,m.hg],dd})}});
  const rows=[...T.values()].map(r=>({...r,net:r.gain-r.lost})).sort((a,b)=>b.net-a.net||b.gain-a.gain||cmp(a.t,b.t));
  return {rows,used,skipped,goals,late};
 }
 R.late=async function(el){
  el.innerHTML='<h2>Late show</h2><div id="lsroot" class="ins lk ls"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#lsroot'),lg=D.id,tok=++S.tok;
  const P=await INS.poolOne(lg,['sh']);
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!P||!P.shots){root.innerHTML=`<div class="empty">${two('The shot data is not available right now.','بيانات التسديدات مو متوفرة الحين.')}</div>`;return}
  if(S.lg!==lg){S.lg=lg;S.pick=''}
  draw(root,P);
 };
 const sg=x=>x>0?'+'+x:x<0?'−'+(-x):'0';
 function draw(root,P){
  const M=S.m,C=calc(P,M);
  if(!C.rows.length){root.innerHTML=`<div class="empty">${two('No match with a complete goal timeline yet.','ما فيه مباراة بتسلسل أهداف كامل للحين.')}</div>`;return}
  if(!C.rows.some(r=>r.t===S.pick))S.pick=C.rows[0].t;
  const mx=Math.max(1,...C.rows.map(r=>Math.abs(r.net))),sel=C.rows.find(r=>r.t===S.pick);
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Who wins it at the death?</b> For every club, the points that goals after a chosen minute gave it or took from it: compare the score at that minute with the final score.','<b>مين يكسبها في الدقائق الأخيرة؟</b> لكل نادي، النقاط اللي الأهداف بعد دقيقة معينة أعطته إياها أو أخذتها منه: نقارن النتيجة عند تلك الدقيقة بالنتيجة النهائية.')}</p></div>
   <div class="card"><div class="ctl"><div class="seg" id="lsm" role="group" aria-label="${ar()?'بعد الدقيقة':'After minute'}">${MINS.map(k=>`<button type="button" data-m="${k}" aria-pressed="${M===k}" class="${M===k?'on':''}">${two('After '+k+"'",'بعد '+nb(k))}</button>`).join('')}</div></div></div>
   <div class="card hb-k ls-k"><div class="hb-t" data-k="used"><b>${nb(C.used)}</b><span>${two('matches used','مباراة مستخدمة')}</span></div><div class="hb-t" data-k="late"><b>${nb(C.late)}</b><span>${two(`goals after minute ${M} (of ${C.goals})`,`هدف بعد الدقيقة ${nb(M)} (من ${nb(C.goals)})`)}</span></div><div class="hb-t" data-k="share"><b>${nb(C.goals?Math.round(C.late/C.goals*100)+'%':'–')}</b><span>${two('of all goals','من كل الأهداف')}</span></div></div>
   <div class="card ls-c"><div class="ls-hd"><span>${two('Club','النادي')}</span><span>${two('Late goals','أهداف متأخرة')}</span><span>${two('Gained','كسب')}</span><span>${two('Lost','خسر')}</span><span class="ls-nh">${two('Net points','صافي النقاط')}</span></div>
    <div class="ls-list" role="list">${C.rows.map(r=>`<button type="button" role="listitem" class="ls-row${r.t===S.pick?' on':''}" data-t="${esc(r.t)}" data-n="${r.n}" data-gf="${r.gf}" data-ga="${r.ga}" data-gain="${r.gain}" data-lost="${r.lost}" data-net="${r.net}" data-pts="${r.pts}" aria-pressed="${r.t===S.pick}"><span class="ls-n">${nm(r.t)}</span><span class="ls-g">${nb(r.gf+'–'+r.ga)}</span><span class="ls-p">${nb(r.gain?'+'+r.gain:'0')}</span><span class="ls-l">${nb(r.lost?'−'+r.lost:'0')}</span><span class="ls-b"><i class="${r.net>=0?'p':'m'}" style="width:${(Math.abs(r.net)/mx*50).toFixed(2)}%;${r.net>=0?'left:50%':'right:50%'}"></i><b>${nb(sg(r.net))}</b></span></button>`).join('')}</div>
    <p class="mu ins-note">${two(`Net = points gained minus points lost because of goals after minute ${M}. A late goal can lower a club's result too (a win turned into a draw). Matches whose goals do not add up to the score (${C.skipped}) are left out. Stoppage time counts as minute 45 and 90, so added-time goals are "late".`,`الصافي = النقاط المكسوبة ناقص النقاط المفقودة بسبب أهداف بعد الدقيقة ${nb(M)}. الهدف المتأخر ممكن ينزل نتيجة النادي (فوز يصير تعادل). المباريات اللي أهدافها ما تطابق النتيجة (${nb(C.skipped)}) مستثناة. الوقت بدل الضائع يُحسب كدقيقة ${nb(45)} و${nb(90)}، فأهدافه "متأخرة".`)}</p></div>
   <div class="card ls-s" id="lssel"><h3>${nm(sel.t)}</h3>${sel.ch.length?`<ul class="ls-ml">${sel.ch.slice().sort((a,b)=>cmp(b.d,a.d)||cmp(a.id,b.id)).map(x=>`<li data-id="${esc(x.id)}" data-dd="${x.dd}"><span class="mu">${nb(esc(x.d))}</span><span class="ls-mt">${two(x.home?'vs':'at',x.home?'ضد':'عند')} ${nm(x.opp)}</span><span class="ls-sc">${nb(x.s0[0]+'–'+x.s0[1]+' → '+x.s1[0]+'–'+x.s1[1])}</span><b class="${x.dd>0?'p':'m'}">${nb(sg(x.dd))}</b></li>`).join('')}</ul>`:`<p class="mu">${two(`No match of ${esc(sel.t)} changed its result after minute ${M}.`,`ما فيه مباراة لـ${nm(sel.t)} تغيّرت نتيجتها بعد الدقيقة ${nb(M)}.`)}</p>`}</div>`;
  const q=s=>root.querySelector(s);
  root.querySelectorAll('#lsm button').forEach(b=>b.onclick=()=>{S.m=+b.dataset.m;draw(root,P)});
  root.querySelectorAll('.ls-row').forEach(b=>b.onclick=()=>{const y=scrollY;S.pick=b.dataset.t;draw(root,P);scrollTo(0,y);const n=root.querySelector('.ls-row.on');if(n)n.focus({preventScroll:true})});
 }
 INS.ar({'Late show':'الدقائق الأخيرة'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
