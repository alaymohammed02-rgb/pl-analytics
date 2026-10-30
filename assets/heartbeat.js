/* ===== League heartbeat (#/heartbeat, the last tab of the Season hub): how surprising a season was, match by match =====
   data/results.json (the Time machine's file) holds every result of each league's chain of seasons. The page runs the Club Elo ratings through the chain
   (the same K, home advantage, goal-difference multiplier, 10% pull to the mean at a new season, and ordered logit as sync.py el2_run, which the Time
   machine already ports) and keeps, for every match, what Elo gave each result BEFORE it was played, from the earlier matches only. Then:
   - a dot per match, at its date; the height is the surprise of the real result in bits (-log2 of the chance Elo gave it: 1 bit = a coin flip, 3 bits =
     1 in 8), the size is the goals in the match, the colour is the result (home win, draw, away win);
   - the pulse: the average surprise of each week (Monday to Sunday), a line through the weeks, drawn in once with a beat at the last week;
   - counts that follow from the same numbers: how often the favourite (the result Elo gave most) happened, the shocks (under 1 in 8), the calmest and
     wildest weeks (4+ matches), and the eight biggest shocks.
   The first season of a league's chain starts every club on the same rating, so its early chances are guesses and the page says so. Nothing is
   estimated beyond the Elo chances; the test compares the chances of the current season with data/elo_own.json (written by Python). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('heartbeat','League heartbeat','season','timemachine');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const S={lg:'',si:-1,show:'all',sel:'',hov:'',tok:0,anim:true};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('results.json',ALL.generated).then(d=>{if(!d||!d.leagues||!Object.keys(d.leagues).length||!d.params)throw new Error('results');return d}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 /* ---- Elo, as sync.py el2_run / el2_probs: the chances of each match before it is played ---- */
 const season=d=>{const y=+d.slice(0,4);return +d.slice(5,7)>=7?y:y-1};
 const probs=(dr,P)=>{const x=dr/P.s,ph=1/(1+Math.exp(-(x-P.c))),pa=1-1/(1+Math.exp(-(x+P.c)));return [ph,1-ph-pa,pa]};
 function run(all,P){
  const Rt=new Map(),out=new Map();let last=null;
  const mean=()=>[...Rt.values()].reduce((s,x)=>s+x,0)/Rt.size;
  for(const m of all){const sea=season(m.d);
   if(last!=null&&sea!==last&&Rt.size){const mu=mean();for(const [t,r] of Rt)Rt.set(t,mu+(1-P.reg)*(r-mu))}
   last=sea;
   for(const t of [m.h,m.a])if(!Rt.has(t))Rt.set(t,Rt.size?mean():1500);
   const dr=Rt.get(m.h)-Rt.get(m.a)+P.H;out.set(m.id,probs(dr,P));
   const e=1/(1+Math.pow(10,-dr/400)),sc=m.hg>m.ag?1:m.hg===m.ag?.5:0,gd=Math.abs(m.hg-m.ag),mult=gd<=1?1:gd===2?1.5:(11+gd)/8,ch=P.K*mult*(sc-e);
   Rt.set(m.h,Rt.get(m.h)+ch);Rt.set(m.a,Rt.get(m.a)-ch)}
  return out;
 }
 const dayNo=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
 const wk=d=>Math.floor((dayNo(d)+3)/7);          /* a Monday-based week: 1 Jan 1970 was a Thursday */
 const decoded=new Map();
 function league(F,id){const k=id+'|'+F.key;if(decoded.has(k))return decoded.get(k);const L=F.leagues[id],T=L.teams;
  const seasons=L.seasons.map(s=>({s:s.s,ms:s.m.map(x=>({d:x[0],h:T[x[1]],a:T[x[2]],hg:x[3],ag:x[4],id:x[5]}))}));
  const all=seasons.flatMap(s=>s.ms).sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id)),pr=run(all,F.params);
  for(const m of all){const p=pr.get(m.id),o=m.hg>m.ag?0:m.hg===m.ag?1:2;m.p=p;m.o=o;m.q=p[o];m.bits=-Math.log2(p[o]);m.fav=p[0]>=p[1]&&p[0]>=p[2]?0:p[1]>=p[2]?1:2;m.w=wk(m.d)}
  const o={id,name:L.name,seasons};decoded.set(k,o);return o}
 /* weeks of a season: the average surprise of the week's matches */
 function weeks(ms){const g=new Map();for(const m of ms){if(!g.has(m.w))g.set(m.w,[]);g.get(m.w).push(m)}
  return [...g.entries()].sort((a,b)=>a[0]-b[0]).map(([w,a])=>({w,day:w*7,n:a.length,mean:a.reduce((s,m)=>s+m.bits,0)/a.length}))}
 /* the point of a week sits on its Thursday (day number 7 × week); the Monday is 3 days before */
 const isoOf=n=>new Date(n*864e5).toISOString().slice(0,10);
 R.heartbeat=async function(el){
  el.innerHTML='<h2>League heartbeat</h2><div id="hbroot" class="ins lk hb"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#hbroot'),lg=D.id,tok=++S.tok;
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The heartbeat is not available right now.','نبض الدوري مو متوفر الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!F.leagues[S.lg]){S.lg=F.leagues[lg]?lg:Object.keys(F.leagues)[0];S.si=-1;S.sel=''}
  S.anim=true;draw(root,F);
 };
 const ML=44,MR=16,MT=14,MB=30;
 const pc=x=>Math.round(x*100),b1=x=>x.toFixed(2);
 const ONE=b=>'1/'+Math.round(Math.pow(2,b));
 function draw(root,F){
  const L=league(F,S.lg);
  if(S.si<0||S.si>=L.seasons.length)S.si=L.seasons.length-1;
  const SE=L.seasons[S.si],ms=SE.ms.slice().sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id));
  const W=innerWidth<560?480:760,H=innerWidth<560?340:360,lab=SE.s,cur=S.si===L.seasons.length-1,first=S.si===0;
  const head=`<div class="card lk-intro"><p>${two('<b>The season\'s pulse.</b> Every match is a dot: the higher it sits, the more surprising the real result was, judged by Elo from the matches before it. The line is the average surprise of each week.','<b>نبض الموسم.</b> كل مباراة نقطة: كل ما كانت أعلى كانت النتيجة الحقيقية أغرب، بحكم تقييم Elo من المباريات اللي قبلها. والخط هو متوسط الغرابة في كل أسبوع.')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="hbg">${Object.keys(F.leagues).map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Season','الموسم')}</span><select id="hbs">${L.seasons.map((s,i)=>`<option value="${i}"${i===S.si?' selected':''}>${esc(s.s)}</option>`).join('')}</select></label>
    <div class="seg" id="hbsh" role="group" aria-label="${ar()?'المباريات المعروضة':'Matches shown'}">${[['all','All matches','كل المباريات'],['shock','Only shocks','الصدمات فقط']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${S.show===k}" class="${S.show===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div></div>`;
  if(!ms.length){root.innerHTML=head+`<div class="card"><div class="empty">${two('No matches in this season yet.','ما فيه مباريات في هالموسم للحين.')}</div></div>`;wire(root,F,L,ms);return}
  const n=ms.length,wks=weeks(ms),shocks=ms.filter(m=>m.bits>=3),favWon=ms.filter(m=>m.o===m.fav).length,avg=ms.reduce((s,m)=>s+m.bits,0)/n;
  const big=ms.slice().sort((a,b)=>b.bits-a.bits||cmp(a.d,b.d)||cmp(a.id,b.id)).slice(0,8);
  const wl=wks.filter(w=>w.n>=4),calm=wl.length?wl.reduce((a,w)=>w.mean<a.mean?w:a):null,wild=wl.length?wl.reduce((a,w)=>w.mean>a.mean?w:a):null;
  if(!ms.some(m=>m.id===S.sel))S.sel=big[0].id;
  const d0=dayNo(ms[0].d),d1=dayNo(ms[n-1].d),ymax=Math.max(3,Math.ceil(Math.max(...ms.map(m=>m.bits)))),
   X=d=>ML+(d1===d0?.5:(d-d0)/(d1-d0))*(W-ML-MR),Y=b=>MT+(1-b/ymax)*(H-MT-MB);
  const mk=[];{const a=new Date(d0*864e5),bm=d1*864e5;let c=Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,1);while(c<=bm){const s=new Date(c).toISOString().slice(0,7);mk.push([s,(c/864e5-d0)/(d1-d0||1)]);const t=new Date(c);c=Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,1)}}
  const line=wks.map((w,k)=>(k?'L':'M')+X(Math.min(Math.max(w.day,d0),d1)).toFixed(1)+' '+Y(w.mean).toFixed(1)).join(' '),lw=wks[wks.length-1],lx=X(Math.min(Math.max(lw.day,d0),d1)),ly=Y(lw.mean);
  const cls=m=>m.o===0?'hb-h':m.o===1?'hb-d':'hb-a',shown=S.show==='shock'?ms.filter(m=>m.bits>=3):ms;
  root.innerHTML=head+
   `<div class="card hb-k" role="group" aria-label="${ar()?'ملخص الموسم':'Season summary'}">
     <div class="hb-t" data-k="n"><b>${nb(n)}</b><span>${two(cur?'matches so far':'matches','مباراة')}</span></div>
     <div class="hb-t" data-k="fav"><b>${nb(pc(favWon/n)+'%')}</b><span>${two(`the favourite happened (${favWon} of ${n})`,`حصل اللي توقعه Elo (${nb(favWon)} من ${nb(n)})`)}</span></div>
     <div class="hb-t" data-k="shock"><b>${nb(shocks.length)}</b><span>${two('shocks (under 1 in 8)',`صدمات (أقل من ${nb('1 من 8')})`)}</span></div>
     <div class="hb-t" data-k="avg"><b>${nb(b1(avg))}</b><span>${two('average surprise, bits','متوسط الغرابة بالبت')}</span></div>
    </div>
    <div class="card hb-c"><svg class="hb-svg${S.anim?' hb-draw':''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ar()?'نقطة لكل مباراة وخط متوسط الغرابة الأسبوعي':'A dot for each match and a line of the weekly average surprise'}" preserveAspectRatio="xMidYMid meet">
     ${Array.from({length:ymax},(_,k)=>k+1).map(b=>`<g class="hb-g"><line x1="${ML}" x2="${W-MR}" y1="${Y(b).toFixed(1)}" y2="${Y(b).toFixed(1)}"/><text x="${ML-6}" y="${(Y(b)+4).toFixed(1)}" text-anchor="end" direction="ltr">${ONE(b)}</text></g>`).join('')}
     ${mk.map(([s,f])=>`<text class="hb-m" x="${(ML+f*(W-ML-MR)).toFixed(1)}" y="${H-8}" text-anchor="middle">${s}</text>`).join('')}
     ${shown.map(m=>`<circle class="hb-m1 ${cls(m)}${m.id===S.sel?' sel':''}" data-id="${esc(m.id)}" data-bits="${m.bits.toFixed(4)}" data-o="${m.o}" cx="${X(dayNo(m.d)).toFixed(1)}" cy="${Y(m.bits).toFixed(1)}" r="${(2.4+Math.min(m.hg+m.ag,8)*.75).toFixed(2)}" style="--x:${((dayNo(m.d)-d0)/(d1-d0||1)).toFixed(3)}"/>`).join('')}
     <path class="hb-pl" d="${line}" pathLength="1"/>
     ${wks.map(w=>`<circle class="hb-wp" data-w="${w.w}" data-n="${w.n}" data-mean="${w.mean.toFixed(4)}" cx="${X(Math.min(Math.max(w.day,d0),d1)).toFixed(1)}" cy="${Y(w.mean).toFixed(1)}" r="2.2"/>`).join('')}
     <circle class="hb-beat" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5"/>
    </svg>
    <div class="hb-lg"><span class="hb-h"><i></i>${two('Home win','فوز المضيف')}</span><span class="hb-d"><i></i>${two('Draw','تعادل')}</span><span class="hb-a"><i></i>${two('Away win','فوز الضيف')}</span><span class="hb-ln"><i></i>${two('Weekly average','متوسط الأسبوع')}</span></div>
    <p class="mu ins-note">${two('Height = how surprising the real result was: 1/2 is a coin flip, 1/8 means Elo gave it one chance in eight. Size = goals in the match. Chances come from Elo using only the matches before each one.',`الارتفاع = قد إيش كانت النتيجة الحقيقية غريبة: ${nb('1/2')} يعني رمية عملة، و${nb('1/8')} يعني Elo أعطاها فرصة وحدة من ثمانية. الحجم = أهداف المباراة. الفرص من Elo بالمباريات اللي قبل كل مباراة فقط.`)}</p>
    ${first?`<p class="mu ins-note hb-warm">${two(`${esc(lab)} is the first season of ${esc(L.name)} in this chain: every club started on the same rating, so the early chances are guesses and the surprise is overstated.`,`${nb(esc(lab))} أول موسم لـ${nm(L.name)} في هالسلسلة: كل الأندية بدأت بنفس التقييم، فالفرص الأولى تخمين والغرابة مبالغ فيها.`)}</p>`:''}</div>
    <div class="card hb-sel" id="hbsel" aria-live="polite">${selHtml(ms.find(m=>m.id===(S.hov||S.sel)))}</div>
    <div class="card"><h3>${two('The pulse','النبض')}</h3>
     <div class="hb-pu">${calm?`<p data-k="calm">${two(`Calmest week: <b>${isoOf(calm.day-3)}</b> (${calm.n} matches, ${b1(calm.mean)} bits on average).`,`أهدأ أسبوع: <b>${nb(isoOf(calm.day-3))}</b> (${nb(calm.n)} مباريات، متوسط ${nb(b1(calm.mean))} بت).`)}</p>
      <p data-k="wild">${two(`Wildest week: <b>${isoOf(wild.day-3)}</b> (${wild.n} matches, ${b1(wild.mean)} bits on average).`,`أجنن أسبوع: <b>${nb(isoOf(wild.day-3))}</b> (${nb(wild.n)} مباريات، متوسط ${nb(b1(wild.mean))} بت).`)}</p>`:`<p class="mu">${two('Too few matches in a week to name a calmest or wildest one yet.','ما فيه أسبوع فيه مباريات تكفي نسمي أهدأ أو أجنن أسبوع للحين.')}</p>`}</div>
     <p class="mu ins-note">${two('A week runs Monday to Sunday; only weeks with 4 or more matches are compared, and the average is of the bits of the week\'s matches.',`الأسبوع من الاثنين إلى الأحد؛ نقارن الأسابيع اللي فيها ${nb(4)} مباريات أو أكثر بس، والمتوسط هو متوسط بت مباريات الأسبوع.`)}</p></div>
    <div class="card"><h3>${two('The eight biggest shocks','أكبر ثمان صدمات')}</h3>
     <ol class="hb-bl">${big.map((m,k)=>`<li><button type="button" data-id="${esc(m.id)}" class="${m.id===S.sel?'on':''}" aria-pressed="${m.id===S.sel}"><span class="hb-r">${nb(k+1)}</span><span class="hb-n"><bdi dir="ltr">${esc(m.h)} ${m.hg}–${m.ag} ${esc(m.a)}</bdi></span><span class="mu">${nb(m.d)}</span><b>${nb(pc(m.q)+'%')}</b></button></li>`).join('')}</ol>
     <p class="mu ins-note">${two('The percentage is the chance Elo gave the real result before the match.','النسبة هي الفرصة اللي أعطاها Elo للنتيجة الحقيقية قبل المباراة.')}</p></div>`;
  wire(root,F,L,ms);
 }
 function selHtml(m){
  if(!m)return '';
  const nmx=['hb-h','hb-d','hb-a'],lab=[['Home win','فوز المضيف'],['Draw','تعادل'],['Away win','فوز الضيف']];
  return `<p class="hb-sm"><b><bdi dir="ltr">${esc(m.h)} ${m.hg}–${m.ag} ${esc(m.a)}</bdi></b> <span class="mu">${nb(m.d)}</span></p>
   <div class="hb-bars">${m.p.map((p,k)=>`<div class="hb-bar ${nmx[k]}${k===m.o?' real':''}" data-k="${k}"><span>${two(lab[k][0],lab[k][1])}</span><i style="width:${(p*100).toFixed(1)}%"></i><b>${nb(pc(p)+'%')}</b></div>`).join('')}</div>
   <p class="hb-sr">${two(`The real result had a <b>${pc(m.q)}%</b> chance: ${m.bits.toFixed(2)} bits of surprise${m.o===m.fav?', the favourite happened':', not the favourite'}.`,`النتيجة الحقيقية كانت فرصتها <b>${nb(pc(m.q)+'%')}</b>: غرابة ${nb(m.bits.toFixed(2))} بت${m.o===m.fav?'، وحصل اللي توقعه Elo':'، وما كانت الأرجح'}.`)}</p>`;
 }
 function wire(root,F,L,ms){
  const q=s=>root.querySelector(s),re=()=>draw(root,F);
  q('#hbg').onchange=e=>{S.lg=e.target.value;S.si=-1;S.sel='';S.hov='';S.anim=true;re()};
  q('#hbs').onchange=e=>{S.si=+e.target.value;S.sel='';S.hov='';S.anim=true;re()};
  root.querySelectorAll('#hbsh button').forEach(b=>b.onclick=()=>{S.show=b.dataset.k;S.anim=false;re()});
  if(!ms.length)return;
  const by=new Map(ms.map(m=>[m.id,m]));
  const paint=()=>{const p=q('#hbsel');if(p)p.innerHTML=selHtml(by.get(S.hov||S.sel));
   root.querySelectorAll('.hb-m1').forEach(c=>c.classList.toggle('sel',c.dataset.id===S.sel));
   root.querySelectorAll('.hb-bl button').forEach(b=>{const on=b.dataset.id===S.sel;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))})};
  const svg=q('.hb-svg');
  root.querySelectorAll('.hb-m1').forEach(c=>{c.onpointerenter=e=>{if(e.pointerType==='touch')return;S.hov=c.dataset.id;paint()};c.onpointerleave=()=>{S.hov='';paint()};c.onclick=()=>{S.sel=c.dataset.id;S.hov='';paint()}});
  root.querySelectorAll('.hb-bl button').forEach(b=>b.onclick=()=>{S.sel=b.dataset.id;S.hov='';paint();svg.classList.remove('hb-draw')});
 }
 INS.ar({'League heartbeat':'نبض الدوري'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
