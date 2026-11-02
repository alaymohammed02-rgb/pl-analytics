/* ===== Rest days (#/rest, in the Teams hub after Fortress): does a short break between matches change the result? =====
   A test, not a ranking. From data/results.json (every finished league result of each chain of seasons) and the Club Elo chances before each match (INS.eloKit, the
   Time machine's ratings), every club-match gets two numbers: the days since that club's previous LEAGUE match in the same season (the first match of a season has no
   rest and is left out), and the points it took minus the points Elo expected before the match (3 x chance of a win + chance of a draw). Elo already knows how strong the
   two clubs are, so a strong club with a short break is not mistaken for a tired one. The first season of each league's chain is left out: every club starts on 1500
   there and Elo's early chances are guesses. Per band of rest (3 days or fewer, 4, 5, 6, 7, 8 to 10, 11 or more) the table gives the number of club-matches, the average
   points above Elo's expectation, its standard error and a reading: "within noise" when the average is under 1.96 standard errors from zero. A second line regresses the
   difference of the two clubs' points above expectation on the difference of their rests (home rest minus away rest, both 14 days or fewer), per extra day of rest.
   Only league matches are in the data: a short break usually means a cup or European match in between, which is not counted, so this is the gap between league
   matches, not a measure of rest itself. Nothing is estimated beyond Elo's chances. A last table lists the clubs with the shortest turnaround before their next
   scheduled match (data/fixtures.json) as facts, with no prediction. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('rest','Rest days','teams','fortress');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const BANDS=[[0,3,'3 days or fewer','3 أيام أو أقل'],[4,4,'4 days','4 أيام'],[5,5,'5 days','5 أيام'],[6,6,'6 days','6 أيام'],[7,7,'7 days','7 أيام'],[8,10,'8 to 10 days','من 8 إلى 10 أيام'],[11,999,'11 days or more','11 يوم أو أكثر']];
 const S={lg:'all',tok:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();
  const opt=n=>loadJson(n,ALL.generated).catch(()=>null);
  const p=Promise.all([loadJson('results.json',ALL.generated),opt('fixtures.json')]).then(([F,X])=>{if(!F||!F.leagues||!Object.keys(F.leagues).length||!F.params)throw new Error('results');return {F,X}}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 /* the numbers: bands of rest and the regression, for a list of league ids */
 function analyse(F,ids){
  const K=INS.eloKit,bands=BANDS.map(b=>({lo:b[0],hi:b[1],n:0,s:0,q:0}));
  const g={n:0,sx:0,sy:0,sxx:0,sxy:0,syy:0};let all=0,sum=0;
  for(const id of ids){
   const L=K.league(F,id),r=K.run(L.all,F.params),first=L.seasons[0].s,last=new Map();
   for(const m of L.all){
    const p=r.pre.get(m.id),eh=3*p[0]+p[1],ea=3*p[2]+p[1],ph=m.hg>m.ag?3:m.hg===m.ag?1:0,pa=m.ag>m.hg?3:m.hg===m.ag?1:0,dn=K.dayNo(m.d);
    const lh=last.get(m.h),la=last.get(m.a),rh=lh&&lh.s===m.s?dn-lh.d:null,ra=la&&la.s===m.s?dn-la.d:null;
    if(m.s!==first){
     for(const [rest,res] of [[rh,ph-eh],[ra,pa-ea]]){
      if(rest==null)continue;
      for(const b of bands)if(rest>=b.lo&&rest<=b.hi){b.n++;b.s+=res;b.q+=res*res;break}
      all++;sum+=res;
     }
     if(rh!=null&&ra!=null&&rh<=14&&ra<=14){const x=rh-ra,y=(ph-eh)-(pa-ea);g.n++;g.sx+=x;g.sy+=y;g.sxx+=x*x;g.sxy+=x*y;g.syy+=y*y}
    }
    last.set(m.h,{d:dn,s:m.s});last.set(m.a,{d:dn,s:m.s});
   }
  }
  for(const b of bands){b.mean=b.n?b.s/b.n:null;b.se=b.n>1?Math.sqrt(Math.max(0,(b.q-b.s*b.s/b.n)/(b.n-1))/b.n):null}
  let sl=null;
  if(g.n>3){const mx=g.sx/g.n,my=g.sy/g.n,sxx=g.sxx-g.n*mx*mx,sxy=g.sxy-g.n*mx*my,syy=g.syy-g.n*my*my;
   if(sxx>0){const b=sxy/sxx,sse=Math.max(0,syy-b*sxy);sl={n:g.n,b,se:Math.sqrt(sse/(g.n-2)/sxx)}}}
  return {bands,sl,all,mean:all?sum/all:null};
 }
 const within=(m,se)=>se==null||Math.abs(m)<1.96*se;
 /* the clubs with the shortest turnaround before their next scheduled match of one league */
 function coming(F,X,id){
  if(!X||!X.leagues||!X.leagues[id]||!F.leagues[id])return [];
  const K=INS.eloKit,L=K.league(F,id),lastD=new Map();
  for(const m of L.all){lastD.set(m.h,m.d);lastD.set(m.a,m.d)}
  const seen=new Set(),out=[];
  for(const x of X.leagues[id].slice().sort((a,b)=>K.cmp(a.k||a.d,b.k||b.d)||K.cmp(a.i,b.i))){
   for(const [t,o,home] of [[x.h,x.a,true],[x.a,x.h,false]]){
    if(seen.has(t))continue;seen.add(t);
    const ld=lastD.get(t);if(!ld)continue;const days=K.dayNo(x.d)-K.dayNo(ld);if(days<0)continue;
    out.push({t,o,home,d:x.d,days,last:ld});
   }
  }
  return out.sort((a,b)=>a.days-b.days||K.cmp(a.d,b.d)||K.cmp(a.t,b.t));
 }
 INS.restDays={analyse,coming};
 R.rest=async function(el){
  el.innerHTML='<h2>Rest days</h2><div id="rdroot" class="ins lk rd"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#rdroot'),lg=D.id,tok=++S.tok;
  let W;try{W=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The results are not available right now.','النتائج مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(S.lg!=='all'&&!W.F.leagues[S.lg])S.lg='all';
  draw(root,W);
 };
 const sg=(x,d)=>x==null?'–':(x>=0?'+':'−')+Math.abs(x).toFixed(d==null?3:d);
 function draw(root,W){
  const F=W.F,ids=S.lg==='all'?Object.keys(F.leagues):[S.lg],A=analyse(F,ids);
  const lgn=S.lg==='all'?null:F.leagues[S.lg].name,fid=S.lg==='all'?(F.leagues[D.id]?D.id:ids[0]):S.lg;
  const cm=coming(F,W.X,fid).slice(0,8);
  const rng=0.35,pos=v=>((Math.max(-rng,Math.min(rng,v))+rng)/(2*rng)*100).toFixed(2);
  const bandRow=b=>{const w=b.mean!=null&&b.se!=null,ok=w&&within(b.mean,b.se);
   return `<tr class="rd-r" data-lo="${b.lo}" data-n="${b.n}"${w?` data-m="${b.mean.toFixed(5)}" data-se="${b.se.toFixed(5)}"`:''}><td>${two(...BANDS.find(x=>x[0]===b.lo).slice(2))}</td><td class="n">${nb(b.n)}</td>
    <td class="n"><b>${nb(sg(b.mean))}</b></td><td class="n">${nb(b.se==null?'–':'± '+(1.96*b.se).toFixed(3))}</td>
    <td class="rd-g">${w?`<span class="rd-tr"><i class="rd-z"></i><i class="rd-w" style="left:${pos(b.mean-1.96*b.se)}%;width:${(pos(b.mean+1.96*b.se)-pos(b.mean-1.96*b.se)).toFixed(2)}%"></i><i class="rd-d ${ok?'':'out'}" style="left:${pos(b.mean)}%"></i></span>`:''}</td>
    <td>${w?(ok?two('within noise','ضمن الضوضاء'):b.mean>0?two('above Elo','فوق توقع Elo'):two('below Elo','تحت توقع Elo')):'–'}</td></tr>`};
  const out=A.bands.filter(b=>b.mean!=null&&!within(b.mean,b.se)),sl=A.sl,slOk=sl&&within(sl.b,sl.se);
  const short=A.bands[0],margin=short.se!=null?1.96*short.se:null,enough=!!A.all&&!!sl&&short.se!=null&&short.mean!=null;
  const verdict=!enough?two('Not enough club-matches in this selection for a reading.','ما فيه مباريات كافية في هالاختيار لقراءة.')
   :(!out.length&&slOk?two(`<b>No sign that the break matters.</b> No band of rest is outside what Elo expected beyond noise, and the days of rest do not predict the result either. After 3 days or fewer, clubs took ${sg(short.mean,2)} points a match against Elo's expectation, and the sample cannot rule out an effect up to about ${margin.toFixed(2)} points a match either way. ${A.bands.length} bands were tested, so about one band in twenty can look different by chance alone.`,`<b>ما فيه دليل إن الراحة تفرق.</b> ما فيه فئة راحة طلعت خارج توقع Elo بشكل واضح، وأيام الراحة ما تتنبأ بالنتيجة بعد. بعد ${nb('3')} أيام أو أقل، أخذت الأندية ${nb(sg(short.mean,2))} نقطة للمباراة مقابل توقع Elo، والعينة ما تقدر تستبعد أثر لين حوالي ${nb(margin.toFixed(2))} نقطة للمباراة بالاتجاهين. اختبرنا ${nb(A.bands.length)} فئات، فواحدة من كل عشرين تقريبًا ممكن تبان مختلفة بالصدفة وحدها.`)
   :two(`<b>Something differs from Elo's expectation.</b> ${out.length?`${out.length} of ${A.bands.length} bands are outside the noise band`:'No band is outside the noise band'}${sl&&!slOk?`; the rest difference between the two clubs shifts the result by ${sg(sl.b,3)} points per day (± ${(1.96*sl.se).toFixed(3)})`:''}. With ${A.bands.length} bands, about one in twenty can be outside by chance, so read the size, not only the colour.`,`<b>فيه شي يختلف عن توقع Elo.</b> ${out.length?`${nb(out.length)} من ${nb(A.bands.length)} فئات خارج نطاق الضوضاء`:'ما فيه فئة خارج نطاق الضوضاء'}${sl&&!slOk?`؛ فرق الراحة بين النادين يغيّر النتيجة بمقدار ${nb(sg(sl.b,3))} نقطة لكل يوم (± ${nb((1.96*sl.se).toFixed(3))})`:''}. مع ${nb(A.bands.length)} فئات، واحدة من كل عشرين تقريبًا ممكن تطلع خارج النطاق بالصدفة، فاقرأ الحجم مو اللون بس.`));
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Does a short break hurt?</b> For every club-match, the days since the club\'s previous league match, and the points it took minus the points Elo expected before kick-off. Elo already knows how strong the two clubs are, so a strong club with a short break is not mistaken for a tired one. Only league matches are in the data: a short break usually means a cup or European match in between, which we cannot see.','<b>هل الراحة القصيرة تضر؟</b> لكل مباراة نادي: الأيام من مباراة الدوري السابقة، والنقاط اللي أخذها ناقص النقاط اللي توقعها Elo قبل الانطلاق. Elo يعرف قوة النادين، فالنادي القوي ذو الراحة القصيرة ما يُحسب متعب. بس مباريات الدوري موجودة في البيانات: الراحة القصيرة غالبًا تعني مباراة كأس أو أوروبا بينها، وما نشوفها.')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="rdg"><option value="all"${S.lg==='all'?' selected':''}>${ar()?'كل الدوريات':'All leagues'}</option>${Object.keys(F.leagues).map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label></div></div>
   <div class="card rd-v" id="rdv"><h3>${two('The result','النتيجة')}${lgn?' · '+nm(lgn):''}</h3><p>${verdict}</p>
    <p class="mu ins-note">${two(`${A.all} club-matches with a rest value (${ids.length} ${ids.length===1?'league':'leagues'}, the first season of each chain left out). Average over all of them: ${sg(A.mean)} points a match against Elo's expectation, close to zero as it should be.`,`${nb(A.all)} مباراة نادي بقيمة راحة (${nb(ids.length)} ${ids.length===1?'دوري':'دوريات'}، وأول موسم من كل سلسلة مستبعد). المتوسط على كلها: ${nb(sg(A.mean))} نقطة للمباراة مقابل توقع Elo، قريب من الصفر كما يجب.`)}</p></div>
   <div class="card"><h3>${two('Points above Elo\'s expectation, by days of rest','النقاط فوق توقع Elo، حسب أيام الراحة')}</h3><div class="rd-wr"><table class="lk-t rd-t"><thead><tr><th>${two('Days since the last league match','الأيام منذ آخر مباراة دوري')}</th><th class="n">${two('Club-matches','مباريات')}</th><th class="n">${two('Points a match','نقاط للمباراة')}</th><th class="n">${two('95% band','نطاق 95%')}</th><th>${two('Against Elo','مقابل Elo')}</th><th>${two('Reading','القراءة')}</th></tr></thead><tbody>${A.bands.map(bandRow).join('')}</tbody></table></div>
    ${sl?`<p class="rd-sl" data-b="${sl.b.toFixed(6)}" data-se="${sl.se.toFixed(6)}" data-n="${sl.n}">${two(`Home rest minus away rest: each extra day of rest for the home club changes the home club's points minus the away club's, against Elo, by <b>${sg(sl.b,3)}</b> (95% band ± ${(1.96*sl.se).toFixed(3)}) over ${sl.n} matches. ${slOk?'That is within noise.':'That is beyond noise.'}`,`راحة المضيف ناقص راحة الضيف: كل يوم راحة زيادة للمضيف يغيّر نقاط المضيف ناقص نقاط الضيف، مقابل Elo، بمقدار <b>${nb(sg(sl.b,3))}</b> (نطاق ${nb('95%')} ± ${nb((1.96*sl.se).toFixed(3))}) على ${nb(sl.n)} مباراة. ${slOk?'وهذا ضمن الضوضاء.':'وهذا فوق الضوضاء.'}`)}</p>`:''}
    <p class="mu ins-note">${two('A dot is the average, the bar around it the 95% band, on a scale from −0.35 to +0.35 points a match. Bars that cross the centre line are within noise. A few thousand club-matches cannot see a small effect, which is why the band is shown.','النقطة هي المتوسط والشريط حولها نطاق 95%، على مقياس من −0.35 إلى +0.35 نقطة للمباراة. الأشرطة اللي تقطع الخط الأوسط ضمن الضوضاء. كم ألف مباراة ما تشوف أثر صغير، وعشان كذا النطاق معروض.')}</p></div>
   <div class="card"><h3>${two('Shortest turnaround before the next match','أقصر راحة قبل المباراة الجاية')}${F.leagues[fid]?' · '+nm(F.leagues[fid].name):''}</h3>${cm.length?`<div class="rd-wr"><table class="lk-t rd-c"><thead><tr><th>${two('Club','النادي')}</th><th>${two('Next match','المباراة الجاية')}</th><th class="n">${two('Date','التاريخ')}</th><th class="n">${two('Days since the last league match','أيام منذ آخر مباراة دوري')}</th></tr></thead><tbody>${cm.map(c=>`<tr class="rd-cr" data-t="${esc(c.t)}" data-days="${c.days}"><td>${nm(c.t)}</td><td>${c.home?two('vs','ضد'):two('at','عند')} ${nm(c.o)}</td><td class="n">${nb(esc(c.d))}</td><td class="n"><b>${nb(c.days)}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="mu ins-note">${two('Facts from the schedule, no prediction: the days between a club\'s last league match in the results and its next scheduled one. A cup or European match in between is not counted.','حقائق من الجدول بدون توقع: الأيام بين آخر مباراة دوري للنادي في النتائج وموعد مباراته الجاية. مباراة كأس أو أوروبا بينهما ما تُحسب.')}</p>`:`<div class="empty">${two('No scheduled match to compare yet.','ما فيه مباراة مجدولة للمقارنة للحين.')}</div>`}</div>`;
  root.querySelector('#rdg').onchange=e=>{S.lg=e.target.value;draw(root,W)};
 }
 INS.ar({'Rest days':'أيام الراحة'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
