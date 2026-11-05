/* ===== Age curves (#/age, Players room, Does it repeat? group): does a player's output change with age, and can that help predict next season? =====
   Data: data/age_curves.json, written offline by tools/age/fit.py from the finished seasons of data/career.json and the dates of birth of data/tm.json (matched by name, about 81%,
   and no longer updated). The delta method: for each player with 900+ minutes in two consecutive finished seasons, each per-90 stat is first set against players of the same position,
   league and season (z-score) and the change in z is attributed to his age on 1 August of the first season. The page draws the mean change at each age with its standard error,
   the running sum (the curve), the table, and the leave-one-season-pair-out test: does "this season + the age's usual change" predict next season better than "this season"?
   Result when written (5 Nov 2026): no. The page prints the numbers from the file and does not read a peak age from curves that sit inside their own noise. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('age','Age curves','players','bench');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const ST={npxg:['Non-penalty xG /90','xG بدون ركلات جزاء /90'],xag:['xAG /90','xAG /90'],sh:['Shots /90','تسديدات /90'],kp:['Key passes /90','تمريرات مفتاحية /90'],tkic:['Tackles + interceptions /90','افتكاكات + اعتراضات /90']};
 const POS=[['ALL','All outfield players','كل لاعبي الميدان'],['DF','Defenders','المدافعين'],['MF','Midfielders (PitchAPI: many forwards too)','لاعبي الوسط (PitchAPI يضم مهاجمين كثير)']];
 const S={stat:'npxg',pos:'ALL',tok:0};let FILE=null;
 const f2=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(2);
 const read=(g,se)=>{const t=g/se;return Math.abs(t)<1.96?two('within noise','داخل نطاق الضجيج'):g>0?two('better','أفضل'):two('worse','أسوأ')};
 function chart(c,lo,hi){
  const ages=Object.keys(c.age).map(Number).filter(a=>a>=lo&&a<=hi).sort((a,b)=>a-b);if(!ages.length)return '';
  const W=640,H=300,pl=44,pr=14,pt=14,pb=34,ys=[];ages.forEach(a=>{const [n,m,se]=c.age[a];ys.push(m-1.96*(se||0),m+1.96*(se||0))});
  const y0=Math.min(-.2,...ys),y1=Math.max(.2,...ys),sx=a=>pl+(a-ages[0])/((ages[ages.length-1]-ages[0])||1)*(W-pl-pr),sy=v=>H-pb-(v-y0)/(y1-y0)*(H-pt-pb);
  const ticks=[];for(let v=Math.ceil(y0*5)/5;v<=y1;v+=.2)ticks.push(+v.toFixed(1));
  return `<svg class="ag-ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average change by age">${ticks.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--ln,#27474a)" stroke-width="${v===0?1.6:.5}"/><text x="${pl-6}" y="${sy(v)+4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">${v.toFixed(1)}</text>`).join('')}
   ${ages.map(a=>{const [n,m,se]=c.age[a],e=1.96*(se||0);return `<g class="ag-p" data-age="${a}"><line x1="${sx(a)}" x2="${sx(a)}" y1="${sy(m-e)}" y2="${sy(m+e)}" stroke="var(--ac,#4cc9f0)" stroke-width="1.4" opacity=".6"/><circle cx="${sx(a)}" cy="${sy(m)}" r="${Math.max(2.5,Math.min(7,Math.sqrt(n)/1.6))}" fill="var(--ac,#4cc9f0)"/><text x="${sx(a)}" y="${H-pb+16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".8">${a}</text></g>`}).join('')}</svg>`;
 }
 function draw(root,d){
  const c=d.curves[S.stat][S.pos],t=d.test[S.stat],T=d.test;
  const ages=Object.keys(c.age).map(Number).sort((a,b)=>a-b),big=ages.filter(a=>c.age[a][0]>=8),lo=big[0],hi=big[big.length-1];
  const sel=`<div class="card"><div class="ctl ag-ctl"><label class="dcx-l"><span class="mu">${two('Stat','المقياس')}</span><select id="ags">${d.stats.map(k=>`<option value="${k}"${S.stat===k?' selected':''}>${ST[k][0]}</option>`).join('')}</select></label>
   <label class="dcx-l"><span class="mu">${two('Players','اللاعبون')}</span><select id="agp">${POS.map(p=>`<option value="${p[0]}"${S.pos===p[0]?' selected':''}>${p[1]}</option>`).join('')}</select></label></div></div>`;
  const ch=`<div class="card ag-c"><h3>${two('How the number changes from one season to the next, by age','كيف يتغير الرقم من موسم للتالي، حسب العمر')}</h3>
   ${lo!=null?chart(c,lo,hi):`<div class="empty">${two('Not enough pairs.','ما فيه أزواج كافية.')}</div>`}
   <p class="mu ins-note">${two(`Each dot is the average change (in standard deviations against players of the same position, league and season) between the season at that age and the next, for players with 900+ minutes in both; the line is its 95% range, the size of the dot is the number of players. Ages with fewer than 8 players are not drawn. ${c.n} season pairs of ${d.players} players, all positions and leagues pooled for the choice. A dot above the heavy 0 line means players tend to improve from that age to the next.`,`كل نقطة هي متوسط التغير (بالانحراف المعياري مقابل لاعبين بنفس المركز والدوري والموسم) بين الموسم في هذا العمر والموسم التالي، للاعبين بـ 900+ دقيقة في الموسمين؛ الخط هو مجال 95%، وحجم النقطة عدد اللاعبين. الأعمار بأقل من 8 لاعبين ما ترسم. ${nb(c.n)} زوج مواسم لـ ${nb(d.players)} لاعب، كل المراكز والدوريات مجمّعة للاختيار. نقطة فوق خط الصفر السميك معناها اللاعبين يميلون يتحسنون من هذا العمر للتالي.`)}</p></div>`;
  const rows=ages.map(a=>{const [n,m,se]=c.age[a];return `<tr data-age="${a}"${n<8?' class="mu"':''}><td>${nb(a)}</td><td class="n">${nb(n)}</td><td class="n">${nb(f2(m))}</td><td class="n">${se==null?'':nb('± '+(1.96*se).toFixed(2))}</td></tr>`}).join('');
  const tab=`<div class="card"><h3>${two('The numbers','الأرقام')}</h3><div class="ag-w"><table class="lk-t ag-t"><thead><tr><th>${two('Age','العمر')}</th><th class="n">${two('Players','لاعبين')}</th><th class="n">${two('Mean change','متوسط التغير')}</th><th class="n">${two('± 95%','± 95%')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  const tr=d.stats.map(k=>{const x=T[k];return `<tr data-k="${k}"><td>${two(ST[k][0],ST[k][1])}</td><td class="n">${nb(x.n)}</td><td class="n">${nb(f2(x.gain))} <span class="mu">± ${nb((1.96*x.se).toFixed(2).replace(/^0\./,'.'))}</span> ${read(x.gain,x.se)}</td><td class="n">${nb(f2(x.gain_band))} <span class="mu">± ${nb((1.96*x.se_band).toFixed(2).replace(/^0\./,'.'))}</span> ${read(x.gain_band,x.se_band)}</td></tr>`}).join('');
  const test=`<div class="card ag-test"><h3>${two('Does knowing the age help predict next season?','هل معرفة العمر تساعد في توقع الموسم القادم؟')}</h3>
   <div class="ag-w"><table class="lk-t ag-tt"><thead><tr><th>${two('Stat','المقياس')}</th><th class="n">${two('Players','لاعبين')}</th><th class="n">${two('Per age and position','حسب العمر والمركز')}</th><th class="n">${two('By age band','حسب فئة العمر')}</th></tr></thead><tbody>${tr}</tbody></table></div>
   <p class="mu ins-note">${two(`Each number is the average drop in squared error (in z-units) when next season is predicted as "this season + the usual change at his age" instead of "this season", with the curve fitted on the other season pairs only (leave one pair out). Positive = the age helped; negative = it made the guess worse. Per age and position the guess is worse for every stat and beyond noise for four of five; by band (up to 23, 24-29, 30 and over) it is never better beyond noise. So the curves above are real averages of these ${d.pairs} pairs, but they are too noisy, and too small next to the season-to-season noise, to improve a prediction. No peak age is read from them.`,`كل رقم هو متوسط نقص الخطأ التربيعي (بوحدات z) لما نتوقع الموسم القادم كـ "هذا الموسم + التغير المعتاد في عمره" بدل "هذا الموسم"، والمنحنى محسوب من أزواج المواسم الأخرى فقط (نستثني زوج). موجب = العمر ساعد؛ سالب = خلّى التوقع أسوأ. حسب العمر والمركز التوقع أسوأ لكل المقاييس وخارج الضجيج في أربعة من خمسة؛ حسب الفئة (حتى 23، 24-29، 30 فأكثر) ما كان أفضل خارج الضجيج أبدًا. فالمنحنيات فوق متوسطات حقيقية لهذي الأزواج الـ ${nb(d.pairs)}، لكنها مشوشة جدًا وصغيرة مقابل ضجيج موسم لموسم، فما تحسّن توقع. ما نقرأ منها عمر ذروة.`)}</p></div>`;
  const cav=`<div class="card"><h3>${two('What to keep in mind','وش لازم تنتبه له')}</h3><ul class="ag-cav"><li>${two('Only players who kept 900+ minutes are in: a player who declines may drop out of the data, so the curve is probably too kind to the older ages.','فقط اللاعبين اللي حافظوا على 900+ دقيقة: اللاعب اللي يتراجع ممكن يطلع من البيانات، فالمنحنى غالبًا أكرم مما يجب مع الأعمار الكبيرة.')}</li>
   <li>${two(`Dates of birth come from the open Transfermarkt dataset (data to ${esc(String(d.tm_asof||''))}), matched by name: about 81% of players have one, and the others are not in the curve.`,`تواريخ الميلاد من بيانات Transfermarkt المفتوحة (حتى ${nb(esc(String(d.tm_asof||'')))})، بمطابقة الأسماء: حوالي 81% من اللاعبين عندهم تاريخ، والباقي مو في المنحنى.`)}</li>
   <li>${two('The Premier League has four season pairs, the other five leagues one. Forwards are not shown: PitchAPI labels most of them midfielders, leaving too few. Numbers are set against players of the same league, not across leagues.','الدوري الإنجليزي فيه أربعة أزواج مواسم، والدوريات الخمسة الباقية زوج واحد. المهاجمين ما ينعرضون: PitchAPI يصنّف أغلبهم لاعبي وسط، فيبقى عدد قليل. الأرقام مقابل لاعبي نفس الدوري، مو عبر الدوريات.')}</li>
   <li>${two('Goals and assists change too, but they repeat so little (see Stat stability) that an age effect on them cannot be told from luck.','الأهداف والتمريرات الحاسمة تتغير كذلك، لكنها تتكرر قليل جدًا (شوف ثبات الأرقام) فأثر العمر عليها ما ينفصل عن الحظ.')}</li></ul></div>`;
  root.innerHTML=`<div class="card lk-intro"><p>${two('Do players get better until a certain age and then decline? This page measures how the numbers really changed from one season to the next at each age, then checks honestly whether that would have helped predict anything.','هل اللاعبين يتحسنون لين عمر معين وبعدين يتراجعون؟ هالصفحة تقيس كيف تغيرت الأرقام فعلًا من موسم لموسم عند كل عمر، وبعدين تفحص بصدق هل كان هذا يساعد في توقع شي.')}</p></div>`+sel+ch+test+tab+cav;
  const on=(id,f)=>{const e=root.querySelector(id);if(e)e.addEventListener('change',f)};
  on('#ags',e=>{S.stat=e.target.value;draw(root,d)});on('#agp',e=>{S.pos=e.target.value;draw(root,d)});
 }
 INS.age={read};
 R.age=async function(el){
  el.innerHTML='<h2>Age curves</h2><div id="agroot" class="ins ag"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#agroot'),tok=++S.tok;let d=FILE;
  if(!d){try{d=await loadJson('age_curves.json',ALL.generated);if(!d||!d.curves||!d.test)throw new Error('age')}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The age curves are not available right now.','منحنيات العمر مو متوفرة الحين.')}</div>`;return}FILE=d}
  if(!root.isConnected||tok!==S.tok)return;
  draw(root,d);
 };
 INS.ar({'Age curves':'منحنيات العمر'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
