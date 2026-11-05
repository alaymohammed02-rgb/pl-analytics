/* ===== Replace him (#/replace, Players room, Market group): who plays most like a player, for less money? =====
   The similarity is Player twins' own (INS.twins from assets/player-twin.js): every outfield player with 450+ minutes this season in the six domestic leagues, 16 per-90
   numbers turned into percentiles within his position group across the six leagues, similarity = 100 − the average percentile gap over the measures both have (10 at
   least); a player of unknown position is compared with every outfield player. The market values and ages are Player prices' own (INS.playerPool from
   assets/xi-builder.js: Transfermarkt through the open transfermarkt-datasets, dated; the project paused its updates, so values are from before this season).
   The page keeps the candidates that fit the budget (cheaper than him, or under a fixed amount), the age limit and the league, and lists the ten closest. A candidate
   without a value in the dataset is left out once a budget is set (the page says how many). It compares how they play, not the level of their leagues, and it says
   nothing about wages, contracts, injuries or whether a club would sell. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function'||!INS.twins||typeof INS.playerPool!=='function')return;
 INS.addPage('replace','Replace him','players','prices');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const TOPN=10;
 const BUD=[['cheaper','Cheaper than him','أرخص منه'],['any','Any price','أي سعر'],['50','Under €50m','أقل من 50 مليون €'],['25','Under €25m','أقل من 25 مليون €'],['10','Under €10m','أقل من 10 ملايين €'],['5','Under €5m','أقل من 5 ملايين €']];
 const AGE=[['any','Any age','أي عمر'],['30','30 or younger','30 أو أصغر'],['25','25 or younger','25 أو أصغر'],['23','23 or younger','23 أو أصغر']];
 const DIMS=[['Shooting','التسديد',['npxg','sh']],['Creating','الصناعة',['xag','kp','sca']],['Passing forward','التمرير للأمام',['pr','bx']],['Carrying','حمل الكرة',['pc','cb','tkw']],['Defending','الدفاع',['tk','ic','bl']],['Duels','الالتحامات',['duw','aerw']],['Involvement','المشاركة',['ps']]];
 const POSN={DF:['defender','مدافع'],MF:['midfielder','لاعب وسط'],FW:['forward','مهاجم']};
 const S={pick:'',bud:'cheaper',age:'any',lg:'',other:'',tok:0};
 const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ø/g,'o').replace(/ł/g,'l').replace(/ß/g,'ss').toLowerCase();
 /* the candidates and their similarity, for one choice of filters (exported for the test) */
 function pick(T,P,key,o){
  const L=T.list,t=L.find(x=>x.key===key);if(!t)return null;
  const info=x=>P.by.get(x.key)||{},tv=info(t).val;
  const f=t.p?(x=>x.q):(x=>x.qo);
  const cap=o.bud==='any'?Infinity:o.bud==='cheaper'?(tv!=null?tv:Infinity):(+o.bud)*1e6;
  const priced=o.bud!=='any'&&!(o.bud==='cheaper'&&tv==null);
  const base=L.filter(x=>(t.p?x.p===t.p:true)&&x.id!==t.id&&(!o.lg||x.lid===o.lg));
  let noval=0;
  const cand=base.filter(x=>{const i=info(x);if(o.age!=='any'&&!(i.age!=null&&i.age<=+o.age))return false;if(priced){if(i.val==null){noval++;return false}return i.val<cap}return true});
  const rows=cand.map(x=>({x,s:INS.twins.sim(t,x,f),val:info(x).val,age:info(x).age})).filter(r=>r.s).sort((a,b)=>b.s.v-a.s.v||a.x.n.localeCompare(b.x.n)).slice(0,TOPN);
  return {t,tv,tage:info(t).age,f,rows,noval,priced,cap,pool:base.length};
 }
 const dim=(a,ks,f)=>{const v=ks.map(k=>f(a)[k]).filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
 const money=v=>v==null?null:INS.money(v);
 function draw(root,T,P){
  const L=T.list;
  if(!S.pick||!L.some(x=>x.key===S.pick)){
   const here=L.filter(x=>x.lid===D.id),val=x=>(P.by.get(x.key)||{}).val;
   const c=here.filter(x=>val(x)!=null).sort((a,b)=>val(b)-val(a)||a.n.localeCompare(b.n))[0]||here.sort((a,b)=>b.mi-a.mi)[0]||L[0];S.pick=c.key;S.other=''}
  const hasTm=!!P.tm;if(!hasTm&&S.bud!=='any')S.bud='any';
  const r=pick(T,P,S.pick,S);const t=r.t;
  if(!S.other||!r.rows.some(x=>x.x.key===S.other))S.other=r.rows.length?r.rows[0].x.key:'';
  const o=r.rows.find(x=>x.x.key===S.other);
  const meta=(x,val,age)=>`${nm(x.club)} · ${nm(x.ln)}${x.p?` · ${two(POSN[x.p][0],POSN[x.p][1])}`:''}${age!=null?` · ${two(`${age} years`,`${nb(age)} سنة`)}`:''}${val!=null?` · <b>${nb(money(val))}</b>`:hasTm?` · <span class="mu">${two('no value','بدون قيمة')}</span>`:''}`;
  const seg=(id,list,cur,attr)=>`<div class="seg rh-seg" id="${id}" role="group">${list.map(([k,en,a])=>`<button type="button" data-${attr}="${k}" aria-pressed="${cur===k}" class="${cur===k?'on':''}">${two(en,a)}</button>`).join('')}</div>`;
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Who could replace him, for less?</b> Pick a player: the page finds the players of the same position in the six leagues whose numbers look most like his (the Player twins similarity), among those that fit your budget, age and league.','<b>مين يقدر يعوّضه بسعر أقل؟</b> اختر لاعب: الصفحة تدوّر لاعبين بنفس المركز في الدوريات الستة أرقامهم أقرب لأرقامه (نفس تشابه صفحة شبيه اللاعب)، من اللي يناسبون ميزانيتك وعمرك ودوريك.')}</p></div>
   <div class="card"><div class="ctl"><label class="tw-s"><span class="mu">${two('Player','اللاعب')}</span><input id="rhq" list="rhl" autocomplete="off" placeholder="${ar()?'ابحث عن لاعب':'Search a player'}" value="${esc(t.n)} · ${esc(t.club)}"></label>
    <datalist id="rhl">${L.slice().sort((a,b)=>a.n.localeCompare(b.n)).map(x=>`<option value="${esc(x.n)} · ${esc(x.club)}" data-k="${esc(x.key)}">${esc(x.ln)}</option>`).join('')}</datalist>
    <label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="rhlg"><option value="">${ar()?'الدوريات الستة':'All six leagues'}</option>${T.leagues.map(l=>`<option value="${esc(l.id)}"${S.lg===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select></label></div>
    ${hasTm?`<p class="mu rh-l">${two('Budget','الميزانية')}</p>${seg('rhb',BUD,S.bud,'b')}`:''}
    <p class="mu rh-l">${two('Age','العمر')}</p>${hasTm?seg('rha',AGE,S.age,'a'):`<p class="mu">${two('No market values or ages yet, so every candidate is shown.','ما فيه قيم سوقية أو أعمار للحين، فكل المرشحين يظهرون.')}</p>`}</div>
   <div class="card rh-me"><h3>${nm(t.n)}</h3><p class="mu">${meta(t,r.tv,r.tage)} · ${two(`${t.mi} minutes`,`${nb(t.mi)} دقيقة`)}</p></div>
   <div class="card"><h3>${two('Closest players that fit','أقرب اللاعبين اللي يناسبون')}</h3>
    ${r.rows.length?`<ol class="tw-list rh-list">${r.rows.map((x,i)=>`<li class="${x.x.key===S.other?'on':''}" data-k="${esc(x.x.key)}"><button type="button" data-k="${esc(x.x.key)}"><span class="tw-r">${nb(i+1)}</span><span class="rh-n"><b>${nm(x.x.n)}</b><span class="mu">${meta(x.x,x.val,x.age)}</span></span><b class="tw-p">${nb(Math.round(x.s.v)+'%')}</b>${r.tv!=null&&x.val!=null&&x.val<r.tv?`<span class="rh-save">${two(`${money(r.tv-x.val)} less`,`أقل بـ ${nb(money(r.tv-x.val))}`)}</span>`:''}</button></li>`).join('')}</ol>`:`<div class="empty">${two('Nobody fits these choices. Try a bigger budget, any age or all six leagues.','ما فيه أحد يناسب هالاختيارات. جرّب ميزانية أكبر أو أي عمر أو الدوريات الستة.')}</div>`}
    ${r.noval?`<p class="mu rh-nv">${two(`${r.noval} ${r.noval===1?'player has':'players have'} no value in the dataset and ${r.noval===1?'is':'are'} left out under a budget.`,`${nb(r.noval)} لاعب ما لهم قيمة في البيانات وانشالوا لما تحدد ميزانية.`)}</p>`:''}
    <p class="mu ins-note">${two(`Similarity: 100 − the average gap between the two players' percentiles among ${t.p?'players of his position':'outfield players'} in the six leagues, over the measures both have (100% = the same percentile in every measure). It compares how they play, not the level of their leagues, and says nothing about wages, contracts or whether a club would sell.`,`التشابه: 100 − متوسط الفرق بين النسب المئوية للاعبين ${t.p?'بين لاعبي نفس المركز':'بين كل لاعبي الملعب'} في الدوريات الستة، في المقاييس اللي عندهم الاثنين (100% = نفس النسبة في كل مقياس). يقارن طريقة اللعب، مو مستوى الدوريات، وما يقول شي عن الرواتب أو العقود أو إذا النادي يبيع.`)}</p>
    ${hasTm?`<p class="mu ins-note">${INS.tmNote(P)}</p>`:''}</div>
   ${o?`<div class="card rh-cmp"><h3>${nm(t.n)} <span class="mu">&amp;</span> ${nm(o.x.n)}</h3>
    ${INS.radar?INS.radar({axes:DIMS.map(d=>ar()?d[1]:d[0]),aria:'Profiles',series:[{name:t.n,vals:DIMS.map(d=>dim(t,d[2],r.f))},{name:o.x.n,cls:'b',vals:DIMS.map(d=>dim(o.x,d[2],r.f))}]}):''}
    <p class="mu ins-note">${two('Radar: the average percentile of each group of measures (50 = the middle of the position group).','الرادار: متوسط النسبة المئوية لكل مجموعة مقاييس (50 = نص لاعبي المركز).')}</p>
    <div class="ctl"><button type="button" class="s" data-open="${esc(o.x.lid)}|${esc(o.x.id)}">${two('Player page →','صفحة اللاعب ←')} ${nm(o.x.n)}</button></div></div>`:''}`;
  const q=root.querySelector('#rhq');
  q.addEventListener('change',()=>{const v=q.value,op=[...root.querySelectorAll('#rhl option')].find(x=>x.value===v)||[...root.querySelectorAll('#rhl option')].find(x=>fold(x.value).startsWith(fold(v))&&fold(v).length>2);if(op){S.pick=op.dataset.k;S.other='';draw(root,T,P)}});
  q.addEventListener('focus',()=>q.select());
  root.querySelector('#rhlg').onchange=e=>{S.lg=e.target.value;S.other='';draw(root,T,P)};
  root.querySelectorAll('#rhb button').forEach(b=>b.onclick=()=>{S.bud=b.dataset.b;S.other='';draw(root,T,P)});
  root.querySelectorAll('#rha button').forEach(b=>b.onclick=()=>{S.age=b.dataset.a;S.other='';draw(root,T,P)});
  root.querySelectorAll('.rh-list button[data-k]').forEach(b=>b.addEventListener('click',()=>{S.other=b.dataset.k;draw(root,T,P)}));
  root.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const [l,id]=b.dataset.open.split('|');if(typeof window.twOpen==='function')window.twOpen(l,id)}));
 }
 R.replace=async function(el){
  el.innerHTML='<h2>Replace him</h2><div id="rhroot" class="ins rh"><div class="empty skel">Loading the players of six leagues…</div></div>';
  const root=el.querySelector('#rhroot'),lg=D.id,tok=++S.tok;
  let T,P;try{[T,P]=await Promise.all([INS.twins.pool(),INS.playerPool()]);if(!T||!T.list||T.list.length<20)throw new Error('pool')}
  catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The players are not available right now.','اللاعبين مو متوفرين الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  draw(root,T,P);
 };
 INS.replace={pick,TOPN};
 INS.ar({'Replace him':'ابحث عن بديل'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
