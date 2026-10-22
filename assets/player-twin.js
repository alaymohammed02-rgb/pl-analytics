/* ===== Player twins (#/twins, in Players after Compare): the players whose numbers look most like a player's =====
   Pool: every outfield player with TW_MIN+ minutes this season in the six domestic leagues (the Champions League and the World
   Cup are left out, so a player is not compared with himself in another competition). Files: each league's per-match player
   file (PitchAPI), the same one the player pages use.
   Measures: TW_KEYS, per 90 minutes (a missing value is never read as zero: per 90 uses only the minutes of matches that have it).
   Each measure becomes a percentile within the player's position group (DF, MF or FW as learnt by the sync) across all six
   leagues together. Similarity = 100 − the average gap between two players' percentiles over the measures both have
   (at least TW_NEED of them): 100 = the same percentile in every measure. It compares profiles, not quality of the league. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('twins','Player twins','players','compare');
 const TW_MIN=450,TW_NEED=10,TOPN=5;
 const TW_KEYS=['npxg','sh','xag','kp','sca','pr','bx','ps','pc','cb','tkw','tk','ic','bl','duw','aerw'];
 const DIMS=[['Shooting',['npxg','sh']],['Creating',['xag','kp','sca']],['Passing forward',['pr','bx']],['Carrying',['pc','cb','tkw']],['Defending',['tk','ic','bl']],['Duels',['duw','aerw']],['Involvement',['ps']]];
 const POS={DF:'defenders',MF:'midfielders',FW:'forwards'},POS1={DF:'defender',MF:'midfielder',FW:'forward'};
 const S={pick:'',lg:'',other:''};let POOL=null,POOLP=null;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const LAB={tkw:'Take-ons won /90'},lab=k=>{const M=INS.met(k);return M?M[1]:LAB[k]||k};
 const domestic=l=>l&&l.pl_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
 /* mid-rank percentile from a sorted array */
 const lowerB=(a,v)=>{let lo=0,hi=a.length;while(lo<hi){const m=lo+hi>>1;if(a[m]<v)lo=m+1;else hi=m}return lo};
 const upperB=(a,v)=>{let lo=0,hi=a.length;while(lo<hi){const m=lo+hi>>1;if(a[m]<=v)lo=m+1;else hi=m}return lo};
 function pool(){
  if(POOLP)return POOLP;
  POOLP=(async()=>{
   const L=(ALL.leagues||[]).filter(domestic),out=[];
   await Promise.all(L.map(async l=>{let P=null;try{P=await loadJson(l.pl_file,l.pl_v)}catch(e){return}if(!P||!P.rows)return;P.ix={};P.cols.forEach((c,k)=>P.ix[c]=k);
    aggPl(P).forEach(a=>{if(a.s.mi<TW_MIN||!POS[a.p])return;const v={};TW_KEYS.forEach(k=>{v[k]=a.p90(k)});out.push({key:l.id+'|'+a.id,lid:l.id,ln:l.name,id:a.id,n:a.n,club:a.club,p:a.p,mi:a.s.mi,games:a.games,v})})}));
   /* percentiles inside each position group */
   Object.keys(POS).forEach(p=>{const G=out.filter(x=>x.p===p);TW_KEYS.forEach(k=>{const s=G.map(x=>x.v[k]).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b);
    G.forEach(x=>{const v=x.v[k];x.q=x.q||{};x.q[k]=v==null||!isFinite(v)||!s.length?null:(lowerB(s,v)+(upperB(s,v)-lowerB(s,v))/2)/s.length*100})})});
   POOL={list:out,leagues:L};return POOL;
  })();
  return POOLP;
 }
 const sim=(a,b)=>{let s=0,n=0;TW_KEYS.forEach(k=>{const x=a.q[k],y=b.q[k];if(x!=null&&y!=null){s+=Math.abs(x-y);n++}});return n>=TW_NEED?{v:100-s/n,n}:null};
 const dim=(a,ks)=>{const v=ks.map(k=>a.q[k]).filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
 async function openPlayer(lid,id){
  if(D.id!==lid&&typeof setLeague==='function'){await setLeague(lid);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head()}
  const d=await INS.players();const a=d&&d.A.find(x=>x.id===id);if(a)location.hash=a.href;
 }
 window.twOpen=openPlayer;
 R.twins=async function(el){
  el.innerHTML='<h2>Player twins</h2><div id="twroot" class="ins tw"><div class="empty skel">Loading the players of six leagues…</div></div>';
  const root=el.querySelector('#twroot'),P=await pool();if(!root.isConnected)return;
  const L=P.list;if(L.length<20){root.innerHTML='<div class="empty">Not enough players with minutes yet.</div>';return}
  if(!S.pick||!L.some(x=>x.key===S.pick)){
   const fv=typeof favOf==='function'?favOf():null,here=L.filter(x=>x.lid===D.id);
   const c=(fv&&here.filter(x=>x.club===fv).sort((a,b)=>b.mi-a.mi)[0])||here.filter(x=>x.p==='FW').sort((a,b)=>(b.v.npxg||0)-(a.v.npxg||0))[0]||L[0];S.pick=c.key}
  const draw=()=>{
   const t=L.find(x=>x.key===S.pick),cand=L.filter(x=>x.p===t.p&&x.id!==t.id&&(!S.lg||x.lid===S.lg));
   const tw=cand.map(x=>({x,s:sim(t,x)})).filter(r=>r.s).sort((a,b)=>b.s.v-a.s.v||a.x.n.localeCompare(b.x.n)).slice(0,TOPN);
   if(!S.other||!tw.some(r=>r.x.key===S.other))S.other=tw.length?tw[0].x.key:'';
   const o=L.find(x=>x.key===S.other),G=L.filter(x=>x.p===t.p).length;
   root.innerHTML=`<div class="card tw-intro"><p>${two(`<b>Who plays most like him?</b> Pick a player: his ${TW_KEYS.length} per-90 numbers are compared with every ${POS1[t.p]} with ${TW_MIN}+ minutes in the six domestic leagues, and the closest profiles are shown.`,`<b>مين يلعب أكثر شي زيه؟</b> اختر لاعب: أرقامه الـ${nb(TW_KEYS.length)} لكل 90 دقيقة تنقارن مع كل اللاعبين في مركزه اللي لعبوا ${nb(TW_MIN)} دقيقة أو أكثر في الدوريات المحلية الست، وتطلع أقرب الملامح.`)}</p>
     <div class="ctl tw-ctl"><label class="tw-s"><span>Player</span><input id="twq" list="twl" autocomplete="off" placeholder="Search a player" value="${esc(t.n)} · ${esc(t.club)}"></label>
      <datalist id="twl">${L.slice().sort((a,b)=>a.n.localeCompare(b.n)).map(x=>`<option value="${esc(x.n)} · ${esc(x.club)}" data-k="${esc(x.key)}">${esc(x.ln)}</option>`).join('')}</datalist>
      <select id="twlg" aria-label="Look in"><option value="">All six leagues</option>${P.leagues.map(l=>`<option value="${esc(l.id)}"${S.lg===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select></div></div>
    <div class="card tw-me">${who(t,true)}</div>
    <div class="card"><h3>Closest profiles</h3>${tw.length?`<ol class="tw-list">${tw.map((r,i)=>`<li class="${r.x.key===S.other?'on':''}"><button type="button" data-k="${esc(r.x.key)}"><span class="tw-r">${i+1}</span>${who(r.x)}<b class="tw-p">${nb(Math.round(r.s.v)+'%')}</b></button></li>`).join('')}</ol>`:'<div class="empty">No player close enough in this league.</div>'}
     <p class="mu ins-note">${two(`Similarity: 100 − the average gap between the two players' percentiles (among ${POS[t.p]}, ${G} players) over the measures both have. 100% = the same percentile in every measure. It compares how they play, not the level of their leagues.`,`التشابه: 100 − متوسط الفرق بين النسب المئوية للاعبين (بين لاعبي نفس المركز، ${nb(G)} لاعب) في المقاييس اللي عندهم الاثنين. 100% = نفس النسبة المئوية في كل مقياس. يقارن طريقة اللعب، مو مستوى الدوريات.`)}</p></div>
    ${o?`<div class="card tw-cmp"><h3>${nm(t.n)} <span class="mu">&amp;</span> ${nm(o.n)}</h3><div class="ctl"><button type="button" class="s" data-open="${esc(o.lid)}|${esc(o.id)}"><span>Player page →</span> ${nm(o.n)}</button></div>
     ${INS.radar({axes:DIMS.map(d=>d[0]),aria:'Profiles',series:[{name:t.n,vals:DIMS.map(d=>dim(t,d[1]))},{name:o.n,cls:'b',vals:DIMS.map(d=>dim(o,d[1]))}]})}
     <div class="wrap"><table class="tw-t"><thead><tr><th>Per 90 minutes</th><th class="n">${nm(t.n)}</th><th class="n">${nm(o.n)}</th><th class="n"><span class="sm-wide">Percentile gap</span><span class="sm-narrow">Gap</span></th></tr></thead><tbody>
      ${TW_KEYS.map(k=>{const a=t.v[k],b=o.v[k],g=t.q[k]!=null&&o.q[k]!=null?Math.abs(t.q[k]-o.q[k]):null;return `<tr><td>${esc(lab(k))}</td><td class="n">${INS.f(a)}</td><td class="n">${INS.f(b)}</td><td class="n">${g==null?'N/A':`<span class="tw-g" style="--w:${(100-g).toFixed(0)}%">${Math.round(g)}</span>`}</td></tr>`}).join('')}</tbody></table></div>
     <p class="mu ins-note">${two('Radar: the average percentile of each group of measures (50 = the middle of the position group). A small gap = a similar number.','الرادار: متوسط النسبة المئوية لكل مجموعة مقاييس (50 = نص لاعبي المركز). الفرق الصغير = رقم متشابه.')}</p></div>`:''}`;
   const q=root.querySelector('#twq');q.addEventListener('change',()=>{const op=[...root.querySelectorAll('#twl option')].find(x=>x.value===q.value);if(op){S.pick=op.dataset.k;S.other='';draw()}});
   q.addEventListener('focus',()=>q.select());
   root.querySelector('#twlg').onchange=e=>{S.lg=e.target.value;S.other='';draw()};
   root.querySelectorAll('.tw-list button[data-k]').forEach(b=>b.addEventListener('click',()=>{S.other=b.dataset.k;draw();const c=root.querySelector('.tw-cmp');if(c&&c.scrollIntoView)c.scrollIntoView({block:'nearest',behavior:'smooth'})}));
   root.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const [l,id]=b.dataset.open.split('|');openPlayer(l,id)}));
  };
  const who=(x,big)=>{const lg=x.lid===D.id&&typeof logoOf==='function'&&logoOf(x.club);
   return `<span class="tw-w${big?' big':''}">${lg?`<img src="${esc(lg)}" alt="" width="${big?28:18}" height="${big?28:18}">`:`<i class="tw-dot" aria-hidden="true"></i>`}<span class="tw-n"><b>${nm(x.n)}</b><span class="mu">${nm(x.club)} · ${nm(x.ln)} · <span>${POS[x.p]==='defenders'?'Defender':POS[x.p]==='midfielders'?'Midfielder':'Forward'}</span> · ${nb(Math.round(x.mi))} <span>min</span></span></span>${big?`<button type="button" class="s tw-open" data-open="${esc(x.lid)}|${esc(x.id)}">Player page →</button>`:''}</span>`};
  draw();
 };
 INS.ar({"Player twins":"توأم اللاعب","Closest profiles":"أقرب الملامح","Player":"اللاعب","Search a player":"دوّر لاعب","All six leagues":"كل الدوريات الست","Look in":"دوّر في",
  "Per 90 minutes":"لكل 90 دقيقة","Percentile gap":"فرق النسبة المئوية","Gap":"الفرق","Player page →":"صفحة اللاعب ←","Profiles":"الملامح","Defender":"مدافع","Midfielder":"لاعب وسط","Forward":"مهاجم",
  "min":"د","No player close enough in this league.":"ما فيه لاعب قريب كفاية في هالدوري.","Loading the players of six leagues…":"نحمّل لاعبي الدوريات الست…","Not enough players with minutes yet.":"ما فيه لاعبين بدقائق كفاية للحين.",
  "Take-ons won /#":"مراوغات ناجحة /#","Shooting":"التسديد","Creating":"صناعة الفرص","Passing forward":"التمرير للأمام","Carrying":"حمل الكرة","Defending":"الدفاع","Duels":"الالتحامات","Involvement":"المشاركة"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
