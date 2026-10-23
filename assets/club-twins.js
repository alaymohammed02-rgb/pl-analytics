/* ===== Club twins (#/clubtwins, in Analysis after Halves): which club in the six leagues plays like yours =====
   Pool: every club of the six domestic leagues with CT_MIN+ matches this season. Each club gets a fingerprint of CT_KEYS, every one a
   per-match average over its own matches: xG for and against and shots for and against (shot data), field tilt, the height of its
   defensive actions, high turnovers and ball recovery time (PitchAPI team numbers), PPDA (opponent passes ÷ defensive actions, pooled),
   and passes, progressive passes, passes into the box, crosses and tackles + interceptions (player numbers added up per club).
   Each measure becomes a percentile among all the clubs of the pool (mid-rank); similarity = 100 − the average gap between two clubs'
   percentiles over the measures both have (CT_NEED of 14 at least). It compares how clubs play, not how good they are or how strong
   the league is. With a few matches per club, a fingerprint can still move: the page says how many matches each club has. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.pool!=='function')return;
 INS.addPage('clubtwins','Club twins','analysis','halves');
 const CT_MIN=3,CT_NEED=10,TOPN=5,S={pick:''};let POOLP=null,PK='';
 const KEYS=[['xgf','xG for',"xG لهم",2],['xga','xG against','xG عليهم',2],['shf','Shots','تسديدات',1],['sha','Shots faced','تسديدات عليهم',1],['tilt','Field tilt (%)','ميل الملعب (%)',1],
  ['ppda','PPDA (lower = presses more)','PPDA (الأقل = ضغط أكثر)',1],['adx','Height of defensive actions (m)','ارتفاع الأفعال الدفاعية (م)',1],['hto','High turnovers','استخلاص عالي',1],['brt','Ball recovery time (s)','زمن استرجاع الكرة (ث)',1],
  ['ps','Passes','تمريرات',0],['pr','Progressive passes','تمريرات تقدمية',1],['bx','Passes into the box','تمريرات للمنطقة',1],['cr','Crosses','عرضيات',1],['dt','Tackles + interceptions','افتكاك + قطع',1]];
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const logo=t=>typeof logoOf==='function'&&logoOf(t)?`<img src="${esc(logoOf(t))}" alt="" width="16" height="16" class="lk-lg">`:'';
 const lowerB=(a,v)=>{let lo=0,hi=a.length;while(lo<hi){const m=lo+hi>>1;if(a[m]<v)lo=m+1;else hi=m}return lo},upperB=(a,v)=>{let lo=0,hi=a.length;while(lo<hi){const m=lo+hi>>1;if(a[m]<=v)lo=m+1;else hi=m}return lo};
 const fmt=(k,v)=>v==null?'–':(+v).toFixed(KEYS.find(x=>x[0]===k)[3]);
 function pool(){
  if(POOLP&&PK===INS.poolKey())return POOLP;
  PK=INS.poolKey();
  POOLP=(async()=>{
   const P=await INS.pool(['sh','pl','adv']),teams=[];
   P.leagues.forEach(o=>{
    if(!o.pl||!o.adv||!o.shots)return;
    const ix={};o.pl.cols.forEach((c,k)=>ix[c]=k);const side=new Map(o.L.matches.map(m=>[m.i,m]));
    const acc=new Map(),get=(t,m)=>{const k=t;let a=acc.get(k);if(!a){a={t,lid:o.l.id,ln:o.l.name,ms:new Set(),s:{},c:{},op:0,da:0};acc.set(k,a)}a.ms.add(m);return a};
    const add=(a,k,v)=>{if(v!=null&&isFinite(v)){a.s[k]=(a.s[k]||0)+v;a.c[k]=(a.c[k]||0)+1}};
    o.pl.rows.forEach(r=>{const a=get(r[ix.c],r[ix.m]);['ps','pr','bx','cr'].forEach(k=>add(a,'p_'+k,r[ix[k]]));add(a,'p_dt',(r[ix.tk]||0)+(r[ix.ic]||0))});
    o.pl.team.forEach(r=>{const a=get(r.n,r.m);['tilt','adx','hto','brt'].forEach(k=>add(a,'t_'+k,r[k]))});
    o.adv.team.forEach(r=>{const a=get(r.n,r.m);if(r.op!=null&&r.da!=null&&r.da>0){a.op+=r.op;a.da+=r.da}});
    const sh=new Map(),sa=new Map(),xf=new Map(),xa=new Map(),nm_=new Map();
    o.shots.forEach(s=>{const m=side.get(s.m);if(!m||s.og)return;const opp=s.c===m.h?m.a:m.h;
     sh.set(s.c+'|'+s.m,(sh.get(s.c+'|'+s.m)||0)+1);sa.set(opp+'|'+s.m,(sa.get(opp+'|'+s.m)||0)+1);
     if(s.xg!=null&&isFinite(s.xg)){xf.set(s.c+'|'+s.m,(xf.get(s.c+'|'+s.m)||0)+s.xg);xa.set(opp+'|'+s.m,(xa.get(opp+'|'+s.m)||0)+s.xg)}});
    acc.forEach(a=>{
     /* matches that have shot data for the club (every match of a club that has one) */
     const ms=[...a.ms].filter(m=>side.has(m)&&o.ms.some(x=>x.id===m)),n=ms.length;if(n<CT_MIN)return;
     const mean=(map)=>ms.reduce((s,m)=>s+(map.get(a.t+'|'+m)||0),0)/n,v={};
     v.xgf=mean(xf);v.xga=mean(xa);v.shf=mean(sh);v.sha=mean(sa);
     v.tilt=a.c.t_tilt?a.s.t_tilt/a.c.t_tilt:null;v.adx=a.c.t_adx?a.s.t_adx/a.c.t_adx:null;v.hto=a.c.t_hto?a.s.t_hto/a.c.t_hto:null;v.brt=a.c.t_brt?a.s.t_brt/a.c.t_brt:null;
     v.ppda=a.da>0?a.op/a.da:null;
     const pm=k=>{const nM=[...a.ms].filter(m=>ms.includes(m)).length;return a.s[k]!=null&&nM?a.s[k]/nM:null};
     v.ps=pm('p_ps');v.pr=pm('p_pr');v.bx=pm('p_bx');v.cr=pm('p_cr');v.dt=pm('p_dt');
     teams.push({key:o.l.id+'|'+a.t,lid:o.l.id,ln:o.l.name,t:a.t,n,v})});
   });
   const q={};KEYS.forEach(([k])=>{q[k]=teams.map(x=>x.v[k]).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b)});
   teams.forEach(x=>{x.q={};KEYS.forEach(([k])=>{const v=x.v[k],s=q[k];x.q[k]=v==null||!isFinite(v)||!s.length?null:(lowerB(s,v)+(upperB(s,v)-lowerB(s,v))/2)/s.length*100})});
   const R_={teams,miss:P.miss};if(P.miss.length||teams.length<20)POOLP=null;return R_;
  })();
  return POOLP;
 }
 /* similarity of two clubs, and the measures behind it */
 function sim(a,b){let s=0,n=0;const gaps=[];KEYS.forEach(([k])=>{if(a.q[k]==null||b.q[k]==null)return;const d=Math.abs(a.q[k]-b.q[k]);s+=d;n++;gaps.push([k,d])});return n<CT_NEED?null:{s:100-s/n,n,gaps}}
 function twinsOf(T,x){return T.filter(y=>y!==x).map(y=>({y,r:sim(x,y)})).filter(o=>o.r).sort((a,b)=>b.r.s-a.r.s||a.y.t.localeCompare(b.y.t))}
 R.clubtwins=async function(el){
  el.innerHTML='<h2>Club twins</h2><div id="ctroot" class="ins lk ct"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#ctroot'),X=await pool();if(!root.isConnected)return;
  if(!X.teams.length||X.miss.length){root.innerHTML=`<div class="empty">${two('The club data is not available right now.','بيانات الأندية مو متوفرة الحين.')}</div>`;return}
  const T=X.teams;
  if(!S.pick||!T.some(x=>x.key===S.pick)){const fv=typeof favOf==='function'?favOf():null,cur=T.find(x=>x.lid===D.id&&x.t===fv)||T.find(x=>x.lid===D.id)||T[0];S.pick=cur.key}
  const best=T.map(x=>({x,tw:twinsOf(T,x)[0]})).filter(o=>o.tw);
  const uniq=best.slice().sort((a,b)=>a.tw.r.s-b.tw.r.s||a.x.t.localeCompare(b.x.t)).slice(0,5);
  /* the closest pairs: every pair of clubs by similarity, each club used once, best first */
  const pairs=[];for(let i=0;i<T.length;i++)for(let j=i+1;j<T.length;j++){const r=sim(T[i],T[j]);if(r)pairs.push({a:T[i],b:T[j],s:r.s})}
  pairs.sort((p,q)=>q.s-p.s||p.a.t.localeCompare(q.a.t)||p.b.t.localeCompare(q.b.t));
  const used=new Set(),closest=[];for(const p of pairs){if(closest.length>=5)break;if(used.has(p.a.key)||used.has(p.b.key))continue;used.add(p.a.key);used.add(p.b.key);closest.push(p)}
  const paint=()=>{
   const x=T.find(v=>v.key===S.pick),all=twinsOf(T,x),other=all.filter(o=>o.y.lid!==x.lid).slice(0,TOPN),same=all.filter(o=>o.y.lid===x.lid).slice(0,3);
   const sel=S.twin&&all.some(o=>o.y.key===S.twin)?S.twin:(other[0]||all[0]).y.key,tw=all.find(o=>o.y.key===sel);
   root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Which club plays like yours?</b> Every club gets a fingerprint of ${KEYS.length} measures (shots and chances for and against, pressing, tilt, passing, defending), each as a percentile among the ${T.length} clubs of the six leagues. Similarity = 100 − the average gap between two clubs' percentiles: 100 means the same percentile in every measure.`,
     `<b>مين يلعب مثل ناديك؟</b> كل نادي له بصمة من ${nb(KEYS.length)} مقياس (تسديدات وفرص له وعليه، ضغط، ميل الملعب، تمرير، دفاع)، كل واحد كنسبة مئوية بين ${nb(T.length)} نادي من الدوريات الست. التشابه = 100 ناقص متوسط الفرق بين نسب النادين: 100 يعني نفس النسبة في كل مقياس.`)}</p>
     <p class="mu">${two('It compares how clubs play, not how good they are or how strong their league is. Each club has only a few matches this season, so a fingerprint can still move.','يقارن طريقة اللعب، مو قوة النادي ولا قوة الدوري. كل نادي لعب مباريات قليلة هالموسم، فالبصمة ممكن تتحرك.')}</p></div>
    <div class="card ctl ct-pick"><label><span>${two('Club','النادي')}</span><select id="ctp" aria-label="Club">${[...new Set(T.map(v=>v.lid))].map(l=>`<optgroup label="${esc(T.find(v=>v.lid===l).ln)}">${T.filter(v=>v.lid===l).sort((a,b)=>a.t.localeCompare(b.t)).map(v=>`<option value="${esc(v.key)}"${v.key===S.pick?' selected':''}>${esc(v.t)}</option>`).join('')}</optgroup>`).join('')}</select></label>
     <span class="mu">${two(`${x.n} matches · ${esc(x.ln)}`,`${nb(x.n)} مباراة · ${nm(x.ln)}`)}</span></div>
    <div class="lk-two"><div class="card"><h3>${logo(x.t)}${nm(x.t)} · ${two('twins in the other leagues','التوائم في الدوريات الثانية')}</h3>${list(other,sel)}
      ${same.length?`<h4>${two('Closest in its own league','الأقرب في دوريه')}</h4>${list(same,sel)}`:''}</div>
     <div class="card">${tw?cmp(x,tw):''}</div></div>
    <div class="lk-two"><div class="card"><h3>${two('The most unique clubs','أكثر الأندية تفرّدًا')}</h3><p class="mu ins-note">${two('Their best twin is the least alike.','أحسن توأم لهم هو الأقل شبهًا.')}</p><ol class="ct-ol">${uniq.map(o=>`<li><button type="button" data-pk="${esc(o.x.key)}">${logo(o.x.t)}${nm(o.x.t)} <span class="mu">${nm(o.x.ln)}</span><b>${nb(o.tw.r.s.toFixed(0))}</b></button></li>`).join('')}</ol></div>
     <div class="card"><h3>${two('The closest pairs','أقرب الأزواج')}</h3><p class="mu ins-note">${two('The most alike pairs of clubs, each club once.','أكثر أزواج الأندية تشابهًا، كل نادي مرة وحدة.')}</p><ol class="ct-ol">${closest.map(p=>`<li><button type="button" data-pk="${esc(p.a.key)}" data-tw="${esc(p.b.key)}">${logo(p.a.t)}${nm(p.a.t)} <span class="mu">+</span> ${logo(p.b.t)}${nm(p.b.t)}<b>${nb(p.s.toFixed(0))}</b></button></li>`).join('')}</ol></div></div>`;
   root.querySelector('#ctp').onchange=e=>{S.pick=e.target.value;S.twin='';paint()};
   root.querySelectorAll('button[data-tw]:not([data-pk])').forEach(b=>b.addEventListener('click',()=>{S.twin=b.dataset.tw;paint()}));
   root.querySelectorAll('button[data-pk]').forEach(b=>b.addEventListener('click',()=>{S.pick=b.dataset.pk;S.twin=b.dataset.tw||'';paint();window.scrollTo({top:root.getBoundingClientRect().top+scrollY-70,behavior:'smooth'})}));
  };
  const list=(L,sel)=>`<ol class="ct-ol">${L.map(o=>`<li class="${o.y.key===sel?'me':''}"><button type="button" data-tw="${esc(o.y.key)}">${logo(o.y.t)}${nm(o.y.t)} <span class="mu">${nm(o.y.ln)}</span><b>${nb(o.r.s.toFixed(0))}</b></button></li>`).join('')}</ol>`;
  const cmp=(x,o)=>{const y=o.y;
   return `<h3>${nm(x.t)} ${two('vs','مقابل')} ${nm(y.t)} · ${nb(o.r.s.toFixed(0))}</h3>
    <div class="wrap"><table class="lk-t ct-t"><thead><tr><th>${two('Measure','المقياس')}</th><th class="n">${nm(x.t)}</th><th class="n">${nm(y.t)}</th><th class="n ct-g">${two('Gap','الفرق')}</th></tr></thead><tbody>
    ${KEYS.map(([k,en,ar])=>{const g=x.q[k]==null||y.q[k]==null?null:Math.abs(x.q[k]-y.q[k]);return `<tr><td>${two(en,ar)}</td><td class="n">${fmt(k,x.v[k])}<i class="ct-p" style="--w:${x.q[k]==null?0:x.q[k].toFixed(0)}%"></i></td><td class="n">${fmt(k,y.v[k])}<i class="ct-p o" style="--w:${y.q[k]==null?0:y.q[k].toFixed(0)}%"></i></td><td class="n ct-g ${g!=null&&g<=10?'close':g!=null&&g>=40?'far':''}">${g==null?'–':nb(g.toFixed(0))}</td></tr>`}).join('')}</tbody></table></div>
    <p class="mu ins-note">${two('Each bar is the percentile among all the clubs (0 to 100). Gap = difference of the two percentiles.','كل شريط هو النسبة المئوية بين كل الأندية (من 0 إلى 100). الفرق = فرق النسبتين.')}</p>`};
  paint();
 };
 INS.ar({"Club twins":"توائم الأندية","Club":"النادي","Measure":"المقياس","Gap":"الفرق"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
