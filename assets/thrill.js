/* ===== Thrill index (#/thrill, in League after Likely line-ups): the most thrilling matches so far, and which coming match to watch =====
   Thrill of a finished match, 0 to 10 (a recipe, shown on the page): 10 × (0.25 × goals (up to 6) ÷ 6 + 0.30 × result swings (up to 4) ÷ 4
   + 0.15 × a goal from the 80th minute that changed the result + 0.15 × the match ended within one goal + 0.15 × total xG (up to 5) ÷ 5).
   A result swing is a goal after which the match stands differently (ahead / level / behind) than before it. Goal minutes come from the
   shot data and are used only when the goals add up to the final score.
   Before kick-off one number does not work (tested: the model's expected thrill is unrelated to the real one, ρ about 0.04), because the two
   things the model can see pull the recipe in opposite directions: more expected goals means more goals, an even contest means a close
   finish. So the coming matches show them apart: expected goals (from the Intelligence Lab's match model, INS.mm) and evenness
   (1 − |chance of a home win − chance of an away win|), and the page shows how each did on the finished matches of the six leagues, every
   one predicted with that match left out: the rank correlation (Spearman) between expected goals and real goals, and between evenness
   and a finish within one goal. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.pool!=='function'||typeof INS.mm!=='function')return;
 INS.addPage('thrill','Thrill index','league','xi');
 const W={g:.25,s:.30,l:.15,c:.15,x:.15},S={lg:'',m:'g'};let CP=null,CK='';
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const logo=t=>typeof logoOf==='function'&&logoOf(t)?`<img src="${esc(logoOf(t))}" alt="" width="16" height="16" class="lk-lg">`:'';
 const f1=v=>(+v).toFixed(1),pc=v=>Math.round(v*100);
 /* thrill of a finished match: m = {hg,ag}, g = its goals in minute order, xt = total xG */
 function real(m,g,xt){
  let h=0,a=0,sw=0,late=0;
  g.forEach(x=>{const b=Math.sign(h-a);x.home?h++:a++;if(Math.sign(h-a)!==b){sw++;if(x.mn>=80)late=1}});
  const t=10*(W.g*Math.min(m.hg+m.ag,6)/6+W.s*Math.min(sw,4)/4+W.l*late+W.c*(Math.abs(m.hg-m.ag)<=1?1:0)+W.x*Math.min(xt,5)/5);
  return {t,sw,late,xt};
 }
 const even=r=>1-Math.abs(r.p[0]-r.p[2]);
 const ranks=a=>{const o=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]),r=new Array(a.length);for(let i=0;i<o.length;){let j=i;while(j+1<o.length&&o[j+1][0]===o[i][0])j++;const m=(i+j)/2+1;for(let k=i;k<=j;k++)r[o[k][1]]=m;i=j+1}return r};
 const spearman=(a,b)=>{const x=ranks(a),y=ranks(b),n=a.length,mx=x.reduce((s,v)=>s+v,0)/n,my=y.reduce((s,v)=>s+v,0)/n;let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=Math.pow(x[i]-mx,2);syy+=Math.pow(y[i]-my,2)}return sxy/Math.sqrt(sxx*syy)};
 /* every league: the real thrill of each finished match, and what the model (without that match) expected of it */
 async function calc(){
  const P=await INS.pool(['sh']);if(P.miss.length)return {miss:P.miss};
  const per={},pairs=[];
  P.leagues.forEach(o=>{
   const mm=INS.mm(o.ms,o.xg),list=[];
   o.ms.forEach(m=>{const g=o.goals(m.id),xh=o.xg.get(m.id+'|'+m.home),xa=o.xg.get(m.id+'|'+m.away);if(g.length!==m.hg+m.ag||xh==null||xa==null)return;
    const r=real(m,g,xh+xa),pr=mm?mm(m.home,m.away,m.id):null;list.push({m,...r});if(pr)pairs.push([pr.lh+pr.la,even(pr),m.hg+m.ag,Math.abs(m.hg-m.ag)<=1?1:0])});
   per[o.l.id]={o,mm,list}});
  let rg=null,rc=null,gHi=null,gLo=null,cHi=null,cLo=null;
  if(pairs.length>=30){rg=spearman(pairs.map(p=>p[0]),pairs.map(p=>p[2]));rc=spearman(pairs.map(p=>p[1]),pairs.map(p=>p[3]));
   const k=Math.floor(pairs.length/3),avg=(a,i)=>a.reduce((t,p)=>t+p[i],0)/a.length,byG=pairs.slice().sort((a,b)=>a[0]-b[0]),byE=pairs.slice().sort((a,b)=>a[1]-b[1]);
   gLo=avg(byG.slice(0,k),2);gHi=avg(byG.slice(byG.length-k),2);cLo=avg(byE.slice(0,k),3);cHi=avg(byE.slice(byE.length-k),3)}
  return {per,rg,rc,gHi,gLo,cHi,cLo,n:pairs.length};
 }
 R.thrill=async function(el){
  el.innerHTML='<h2>Thrill index</h2><div id="throot" class="ins lk th"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#throot'),lg=D.id;
  if(!CP||CK!==INS.poolKey()){CK=INS.poolKey();const p=calc().then(r=>{if(r.miss&&CP===p)CP=null;return r},e=>{if(CP===p)CP=null;throw e});CP=p}
  let C;try{C=await CP}catch(e){C={miss:['?']}}
  if(!root.isConnected||D.id!==lg)return;
  const cur=C.per&&C.per[lg];
  if(C.miss||!cur||cur.list.length<6){root.innerHTML=`<div class="empty">${two(`The thrill index is available for the six domestic leagues once they have enough matches with shot data.`,`مؤشر الإثارة متوفر للدوريات الست المحلية لما يصير عندها مباريات كفاية ببيانات التسديد.`)}</div>`;return}
  await fixLoad();const now=Date.now(),lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
  if(!root.isConnected||D.id!==lg)return;
  const top=cur.list.slice().sort((a,b)=>b.t-a.t||a.m.d.localeCompare(b.m.d)||a.m.id.localeCompare(b.m.id)).slice(0,10);
  const fx=((FIX.d&&FIX.d.leagues)||{})[lg]||[],next=fx.filter(x=>Date.parse(x.k||x.d)>now).sort((a,b)=>String(a.k||a.d).localeCompare(String(b.k||b.d))||String(a.i).localeCompare(String(b.i))).slice(0,12)
   .map(x=>{const r=cur.mm?cur.mm(x.h,x.a):null;return {x,r}}).filter(o=>o.r);
  const word=r=>r>0.25?['clearly','بشكل واضح']:r>0.1?['somewhat','بشكل معقول']:['hardly','بالكاد'];
  const paint=()=>{
   const L=next.slice().sort((a,b)=>S.m==='g'?(b.r.lh+b.r.la)-(a.r.lh+a.r.la)||String(a.x.k||a.x.d).localeCompare(String(b.x.k||b.x.d)):even(b.r)-even(a.r)||String(a.x.k||a.x.d).localeCompare(String(b.x.k||b.x.d)));
   root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Which matches are worth your time?</b> Every finished match gets a thrill rating from 0 to 10 from what happened: goals, how often the result swung, a late goal that changed it, how close it ended, and how much the chances were worth. The recipe is at the bottom.`,
     `<b>أي المباريات تستاهل وقتك؟</b> كل مباراة منتهية تاخذ تقييم إثارة من 0 إلى 10 مما صار فيها: الأهداف، كم مرة تقلّبت النتيجة، هدف متأخر غيّرها، قرب النتيجة، وكم كانت الفرص تسوى. الوصفة في الآخر.`)}</p>
     ${C.rg==null?'':`<div class="lk-hl"><div class="lk-k"><span>${two('Matches expected to have the most goals (top third) vs the fewest (bottom third): real goals per match','المباريات المتوقع فيها أهداف أكثر (الثلث الأعلى) مقابل الأقل (الثلث الأدنى): الأهداف الفعلية للمباراة')}</span><b>${nb(f1(C.gHi)+' / '+f1(C.gLo))}</b></div>
      <div class="lk-k"><span>${two('Most even matches (top third) vs least even (bottom third): finished within one goal','الأكثر تكافؤًا (الثلث الأعلى) مقابل الأقل (الثلث الأدنى): انتهت بفارق هدف أو أقل')}</span><b>${nb(pc(C.cHi)+'% / '+pc(C.cLo)+'%')}</b></div></div>
     <p>${two(`One expected-thrill number does not work before kick-off: tested on ${C.n} matches of the six leagues (each predicted without itself), it was unrelated to the real thrill. What the model <b>can</b> see, it sees a little: its expected goals are linked to the real goals (rank correlation <b>${C.rg>=0?'+':'−'}${Math.abs(C.rg).toFixed(2)}</b>, ${word(C.rg)[0]} linked) and how even a match looks is linked to it finishing within a goal (<b>${C.rc>=0?'+':'−'}${Math.abs(C.rc).toFixed(2)}</b>, ${word(C.rc)[0]} linked). So the coming matches below show those two apart. They are hints, not promises: football is full of surprises.`,
       `رقم إثارة متوقع واحد ما يشتغل قبل المباراة: انختبر على ${nb(C.n)} مباراة من الدوريات الست (كل وحدة تتوقع بدونها) وما ارتبط بالإثارة الحقيقية. اللي <b>يقدر</b> النموذج يشوفه، يشوفه شوي: أهدافه المتوقعة مرتبطة بالأهداف الفعلية (ارتباط الرتب <b>${nb((C.rg>=0?'+':'−')+Math.abs(C.rg).toFixed(2))}</b>، ${word(C.rg)[1]}) ومدى تكافؤ المباراة مرتبط بإنها تنتهي بفارق هدف (<b>${nb((C.rc>=0?'+':'−')+Math.abs(C.rc).toFixed(2))}</b>، ${word(C.rc)[1]}). فالمباريات القادمة تحت تعرض الاثنين منفصلين. تلميحات مو وعود: كرة القدم مليانة مفاجآت.`)}</p>`}</div>
    <div class="card"><h3>${two('Coming matches','المباريات القادمة')}</h3>
     <div class="seg" role="group" aria-label="Order"><button type="button" data-m="g" aria-pressed="${S.m==='g'}">${two('Most goals expected','أهداف متوقعة أكثر')}</button><button type="button" data-m="c" aria-pressed="${S.m==='c'}">${two('Most even','الأكثر تكافؤًا')}</button></div>
     ${L.length?`<ol class="th-ol">${L.map(o=>`<li><a href="#/match/${encodeURIComponent(o.x.i)}"><span class="th-sc"><b>${nb(S.m==='g'?(o.r.lh+o.r.la).toFixed(1):pc(even(o.r))+'%')}</b></span><span class="th-mt">${nm(o.x.h)} <span class="mu">${two('vs','ضد')}</span> ${nm(o.x.a)}<small class="mu">${esc(new Date(o.x.k||o.x.d).toLocaleString(lc,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))} · ${two('expected goals','أهداف متوقعة')} ${nb((o.r.lh+o.r.la).toFixed(1))} · ${two('even','تكافؤ')} ${nb(pc(even(o.r))+'%')} · ${nb(pc(o.r.p[0])+' / '+pc(o.r.p[1])+' / '+pc(o.r.p[2]))}</small></span></a></li>`).join('')}</ol>
      <p class="mu ins-note">${two('Big number: expected goals in the match, or how even it looks (100% = both sides equally likely to win). The last three numbers are the chances of a home win / draw / away win (%).','الرقم الكبير: الأهداف المتوقعة في المباراة، أو مدى تكافؤها (100% = الفريقين نفس فرصة الفوز). آخر ثلاثة أرقام احتمال فوز الأرض / تعادل / فوز الضيف (%).')}</p>`:`<div class="empty">${two('No coming match with enough data in the next fixtures.','ما فيه مباراة قادمة ببيانات كافية في الجدول القادم.')}</div>`}</div>
    <div class="card"><h3>${two(`The most thrilling so far · ${esc(D.name)}`,`الأكثر إثارة لين الحين · ${nm(D.name)}`)}</h3><ol class="th-ol">${top.map(o=>`<li><a href="#/match/${encodeURIComponent(o.m.id)}"><span class="th-sc"><b>${nb(f1(o.t))}</b></span><span class="th-mt">${nm(o.m.home)} ${nb(o.m.hg+'–'+o.m.ag)} ${nm(o.m.away)}<small class="mu">${esc(o.m.d)} · ${two(`${o.sw} result swings${o.late?', a late goal that changed it':''} · xG ${o.xt.toFixed(1)}`,`${nb(o.sw)} تقلّبات${o.late?'، هدف متأخر غيّر النتيجة':''} · xG ${nb(o.xt.toFixed(1))}`)}</small></span></a></li>`).join('')}</ol></div>
    <div class="card th-rc"><h3>${two('The recipe','الوصفة')}</h3><p>${two(`Thrill = 10 × (<b>25%</b> goals (up to 6) + <b>30%</b> result swings (up to 4) + <b>15%</b> a goal from the 80th minute that changed the result + <b>15%</b> ended within one goal + <b>15%</b> total xG (up to 5)). Each part is scaled from 0 to 1. A result swing is a goal after which the match stands differently (ahead, level or behind) than before it. It is a recipe made to be easy to read, not a law.`,
     `الإثارة = 10 × (<b>${nb('25%')}</b> أهداف (لين 6) + <b>${nb('30%')}</b> تقلّبات النتيجة (لين 4) + <b>${nb('15%')}</b> هدف من الدقيقة 80 غيّر النتيجة + <b>${nb('15%')}</b> انتهت بفارق هدف أو أقل + <b>${nb('15%')}</b> مجموع xG (لين 5)). كل جزء يتحوّل من 0 إلى 1. تقلّب النتيجة هو هدف بعده المباراة تقف بشكل مختلف (متقدم، متعادل، أو متأخر) عن قبله. وصفة سهلة القراءة، مو قانون.`)}</p></div>`;
   root.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{S.m=b.dataset.m;paint()}));
  };
  paint();
 };
 INS.ar({"Thrill index":"مؤشر الإثارة"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
