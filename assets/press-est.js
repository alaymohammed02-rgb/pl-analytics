/* ===== Estimated pressing, per player (on the Pressing page, under the match card) =====
   PitchAPI has no pressure events, so a player's pressures are ESTIMATED: pressures per 90 = a role's constant + a weight × tackles per 90 +
   a weight × interceptions per 90, where the constant and weights come from data/press_est.json, fitted offline (tools/sb-press/fit_press_est.py)
   on StatsBomb Open Data's full 2015/16 seasons of four leagues, one fit per role (centre-back, full-back, midfielder, winger, striker).
   - The role is the player's most frequent role in the official line-ups (the player card's rule); a player without one has no estimate.
   - The tackles and interceptions are PitchAPI's own per-90 numbers (the table's definition), so they are measured, not estimated.
   - The percentile is among the ESTIMATES of the same role, the player left out: (below + half of those level) ÷ peers × 100, 5+ peers needed.
   - The error shown is measured: the fit was scored leave-one-league-out on StatsBomb (fitted on three leagues, tested on the fourth) at
     player-season level (900+ minutes); the page prints those numbers, and says what was NOT tested: the same players' PitchAPI numbers
     against real pressures (the two providers share no full league season), and today's football against 2015/16. */
(function(){
 if(typeof R!=='object'||typeof R.ppda!=='function'||typeof INS!=='object'||!INS.cardKit||typeof INS.cardKit.pool!=='function')return;
 const {pcol}=INS.cardKit,ROLE=INS.cardKit.ROLE;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const S={pid:'',lg:'',scope:'six',min:450,tok:0};
 const GROUP={CB:'CB',FB:'FB',MID:'MID',W:'WING',ST:'FWD'};
 let EST=null,EK='';
 async function est(){
  if(EST&&EK===INS.poolKey())return EST;
  EK=INS.poolKey();const p=loadJson('press_est.json').then(d=>{if(!d||!d.coef)throw new Error('press_est');return d}).catch(e=>{if(EST===p)EST=null;throw e});EST=p;return p;
 }
 const guess=(F,a)=>{const g=GROUP[a.role];if(!g||!F.coef[g])return null;const tk=a.p90('tk'),ic=a.p90('ic');if(tk==null||ic==null)return null;
  const c=F.coef[g];return Math.max(0,c[0]+c[1]*tk+c[2]*ic)};
 const pct=(v,peers)=>{if(v==null||peers.length<5)return null;let lo=0,eq=0;for(const x of peers){if(x<v)lo++;else if(x===v)eq++}return Math.round((lo+eq/2)/peers.length*100)};
 const f1=v=>v==null?'–':(+v).toFixed(1);
 const f2=v=>v==null?'–':(+v).toFixed(2);
 /* the measured error: season-level numbers of the leave-one-league-out test */
 function errs(F){const L=Object.values(F.cv||{});if(!L.length)return null;
  const rg=k=>[Math.min(...L.map(x=>x.season[k])),Math.max(...L.map(x=>x.season[k]))],rb=k=>[Math.min(...L.map(x=>x.season_position_only[k])),Math.max(...L.map(x=>x.season_position_only[k]))];
  return {corr:rg('corr'),mae:rg('mae'),maeAvg:L.reduce((s,x)=>s+x.season.mae,0)/L.length,base:rb('corr'),n:L.reduce((s,x)=>s+x.season.n,0)}}
 const avgPr=F=>{const G=Object.values(F.groups);return G.reduce((s,g)=>s+g.mean_pr*g.minutes,0)/G.reduce((s,g)=>s+g.minutes,0)};
 /* a range in words in Arabic (an en dash reverses in right-to-left text) */
 const same=(a,d)=>Math.abs(a[0]-a[1])<.5*Math.pow(10,-d),rng=(a,d)=>same(a,d)?a[0].toFixed(d):a[0].toFixed(d)+' – '+a[1].toFixed(d),
  rngAr=(a,d)=>same(a,d)?nb(a[0].toFixed(d)):'من '+nb(a[0].toFixed(d))+' إلى '+nb(a[1].toFixed(d));
 const orig=R.ppda;
 R.ppda=async function(el){
  await orig.apply(this,arguments);
  const h2=el.querySelector('h2');if(!h2||!el.isConnected||el.querySelector('#pex'))return;
  const sec=document.createElement('section');sec.id='pex';sec.className='card dcx';
  sec.innerHTML=`<h3>${two('Estimated pressing, per player','تقدير الضغط، لكل لاعب')}</h3><p class="mu dcx-i">${two('PitchAPI has no pressure events, so this is an <b>estimate</b> from the player\'s role, tackles and interceptions, with its tested error shown below.','PitchAPI ما عنده أحداث ضغط، فهذا <b>تقدير</b> من دور اللاعب وتدخلاته واعتراضاته، ومعه الخطأ المقاس تحت.')}</p><div class="pex-b"><div class="empty skel">Loading…</div></div>`;
  const anchor=el.querySelector('#pcx')||h2;anchor.after(sec);draw(sec.querySelector('.pex-b'));
 };
 async function draw(root){
  const lg=D.id,tok=++S.tok;if(S.lg!==lg){S.lg=lg;S.pid=''}
  let F,P;try{[F,P]=await Promise.all([est(),INS.cardKit.pool(S.scope==='six'?'six':'lg',lg)])}catch(e){if(!root.isConnected||D.id!==lg||tok!==S.tok)return;
   root.innerHTML=`<div class="empty">${two('Could not load the numbers for the estimate. Try again later.','ما قدرنا نحمّل أرقام التقدير. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||D.id!==lg||tok!==S.tok)return;
  const list=P.all.filter(a=>a.s.mi>=S.min&&a.role&&a.role!=='GK').map(a=>({a,v:guess(F,a)})).filter(x=>x.v!=null);
  const sel=()=>`<label class="dcx-l"><span class="mu">${two('Compared with','المقارنة مع')}</span><select id="pexs"><option value="six"${S.scope==='six'?' selected':''}>${ar()?'الدوريات الست':'Six leagues'}</option><option value="lg"${S.scope==='lg'?' selected':''}>${ar()?'هذا الدوري':'This league'}</option></select></label>
    <label class="dcx-l"><span class="mu">${two('Minutes','الدقائق')}</span><select id="pexm">${[270,450,900].map(v=>`<option value="${v}"${S.min===v?' selected':''}>${v}+</option>`).join('')}</select></label>`;
  const wire=()=>{root.querySelector('#pexs').onchange=e=>{S.scope=e.target.value;draw(root)};root.querySelector('#pexm').onchange=e=>{S.min=+e.target.value;draw(root)}};
  if(list.length<10){root.innerHTML=`<div class="ctl dcx-ctl">${sel()}</div><div class="empty">${two('Not enough players with a line-up role and tackle numbers yet, with these choices.','ما فيه لاعبين كفاية بدور من التشكيلات وأرقام تدخلات للحين، بهذي الاختيارات.')}</div>`;wire();return}
  /* the player shown: the chosen one, else the one of this league with most minutes */
  let me=list.find(x=>x.a.id===S.pid);if(!me){const own=list.filter(x=>x.a.lg===(D&&D.name)||S.scope!=='six');me=(own.length?own:list).slice().sort((x,y)=>y.a.s.mi-x.a.s.mi||x.a.n.localeCompare(y.a.n))[0];S.pid=me.a.id}
  const peers=list.filter(x=>x.a.role===me.a.role&&x.a.id!==me.a.id).map(x=>x.v),p=pct(me.v,peers);
  const E=errs(F),r=ROLE[me.a.role],top=list.filter(x=>x.a.role===me.a.role).sort((x,y)=>y.v-x.v||x.a.n.localeCompare(y.a.n)).slice(0,12);
  const tk=me.a.p90('tk'),ic=me.a.p90('ic'),col=p==null?'rgb(120,120,120)':pcol(p);
  const lbl=x=>x.a.n+' ('+x.a.club+')';
  root.innerHTML=`<div class="ctl dcx-ctl">
    <label class="dcx-l dcx-p"><span class="mu">${two('Player','اللاعب')}</span><input id="pexq" list="pexl" value="${esc(lbl(me))}" autocomplete="off"><datalist id="pexl">${list.slice().sort((x,y)=>y.a.s.mi-x.a.s.mi).slice(0,400).map(x=>`<option value="${esc(lbl(x))}">`).join('')}</datalist></label>
    ${sel()}</div>
   <div class="pex-me"><div><b class="pex-n">${nm(me.a.n)}</b><div class="mu">${nm(me.a.club)} · ${two(r[2],r[3])} · ${nb(Math.round(me.a.s.mi))} ${two('min','دقيقة')}</div></div>
    <div class="pex-v"><span class="pex-big" style="color:${col}">${nb('≈ '+f1(me.v))}</span><span class="mu"> ${nb('/90')} · ${two('pressures (est.)','ضغطات (تقدير)')}${E?' · '+nb('±'+f1(E.maeAvg)):''}</span></div>
    <div class="pex-bar"><i style="width:${p==null?0:p}%;background:${col}"></i></div>
    <div>${p==null?two('Too few players in this role to rank.','لاعبين قليلين في هذا الدور للترتيب.'):two(`Percentile <b>${p}</b> among ${peers.length} ${r[0]} (by the estimate)`,`النسبة المئوية <b>${nb(p)}</b> بين ${nb(peers.length)} من ${r[1]} (بحسب التقدير)`)}</div>
    <div class="mu">${two('Measured, per 90','المقاس، لكل 90')}: ${two('tackles','تدخلات')} ${nb(f2(tk))} · ${two('interceptions','اعتراضات')} ${nb(f2(ic))}</div></div>
   <div class="wrap"><table class="lk-t pex-t"><thead><tr><th>#</th><th>${two('Player','اللاعب')}</th><th class="n">${two('Est. /90','تقدير /90')}</th><th class="pex-th">${two('Percentile','المئوية')}</th></tr></thead><tbody>
    ${top.map((x,i)=>{const q=pct(x.v,list.filter(y=>y.a.role===x.a.role&&y.a.id!==x.a.id).map(y=>y.v));return `<tr${x.a.id===me.a.id?' class="pex-sel"':''}><td>${i+1}</td><td>${nm(x.a.n)}<br><span class="mu">${nm(x.a.club)}</span></td><td class="n">${f1(x.v)}</td><td class="pex-c"><i class="pex-p" style="width:${q==null?0:q}%;background:${q==null?'transparent':pcol(q)}"></i><span>${q==null?'–':q}</span></td></tr>`}).join('')}</tbody></table></div>
   <p class="mu ins-note">${two(`The ${top.length} highest estimates among ${r[0]}, in the comparison chosen above.`,`أعلى ${nb(top.length)} تقدير بين ${r[1]}، في المقارنة المختارة فوق.`)}</p>
   ${E?check(F,E):''}`;
  wire();
  const q=root.querySelector('#pexq');q.onchange=()=>{const x=list.find(y=>lbl(y)===q.value);if(x){S.pid=x.a.id;draw(root)}else q.value=lbl(me)};
 }
 /* the measured error and what was not tested, in words */
 function check(F,E){
  const L=Object.entries(F.cv);
  return `<div class="pex-ck"><h4>${two('How good is the estimate?','كم التقدير جيد؟')}</h4>
   <p>${two(`Fitted on three leagues and tested on a fourth it never saw (StatsBomb's full 2015/16 seasons), at player-season level (900+ minutes, ${E.n} players): the estimate and the real pressures per 90 correlate at <b>${rng(E.corr,2)}</b> (the role alone: ${rng(E.base,2)}), with a typical miss of <b>${rng(E.mae,1)}</b> pressures per 90, about ${Math.round(E.maeAvg/avgPr(F)*100)}% of the average.`,
     `مدرَّب على ثلاثة دوريات ومختبَر على رابع ما شافه (مواسم StatsBomb الكاملة 2015/16)، على مستوى لاعب-موسم (900+ دقيقة، ${nb(E.n)} لاعب): التقدير والضغط الحقيقي لكل 90 يرتبطان بـ<b>${rngAr(E.corr,2)}</b> (الدور وحده: ${rngAr(E.base,2)})، وخطأ نموذجي <b>${rngAr(E.mae,1)}</b> ضغطة لكل 90، نحو ${nb(Math.round(E.maeAvg/avgPr(F)*100)+'%')} من المتوسط.`)}</p>
   <div class="wrap"><table class="lk-t pex-cv"><thead><tr><th>${two('Tested on','اختُبر على')}</th><th class="n">${two('Players','لاعبين')}</th><th class="n">${two('Correlation','الارتباط')}</th><th class="n">${two('Role only','الدور فقط')}</th><th class="n">${two('Miss /90','الخطأ /90')}</th></tr></thead><tbody>
    ${L.map(([k,v])=>`<tr><td>${nm(k)}</td><td class="n">${v.season.n}</td><td class="n">${f2(v.season.corr)}</td><td class="n">${f2(v.season_position_only.corr)}</td><td class="n">${f1(v.season.mae)}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two('<b>Not tested:</b> PitchAPI\'s tackle and interception counts for the same players against their real pressures (the two providers share no full league season), and today\'s football against 2015/16. PitchAPI\'s blocks and clearances are left out because they are not counted the way StatsBomb counts them. Treat the percentile as the safer reading and the number as a rough size.','<b>ما انختبر:</b> أرقام التدخلات والاعتراضات من PitchAPI لنفس اللاعبين مقابل ضغطهم الحقيقي (المصدران ما يشتركان في موسم دوري كامل)، وكرة اليوم مقابل 2015/16. الصدّات والإبعادات من PitchAPI استُبعدت لأنها ما تُحسب مثل StatsBomb. اعتبر النسبة المئوية القراءة الأضمن والرقم حجمًا تقريبيًا.')}</p>
   <p class="mu ins-note">${two('Data: PitchAPI (this season) and StatsBomb Open Data (the fit).','البيانات: PitchAPI (هذا الموسم) وStatsBomb Open Data (التدريب).')} <a href="https://github.com/statsbomb/open-data" target="_blank" rel="noopener"><img src="assets/statsbomb-logo.svg" alt="Hudl StatsBomb" height="22" style="height:22px;width:auto;vertical-align:middle"></a></p></div>`;
 }
 INS.ar({'Estimated pressing, per player':'تقدير الضغط، لكل لاعب'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
