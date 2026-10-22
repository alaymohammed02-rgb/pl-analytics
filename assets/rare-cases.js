/* ===== Very rare cases (#/rare, in League after This round): what happens about once a season or less =====
   Data: data/rare.json, written by the sync from PitchAPI data (sync.py, "الحالات النادرة"). For each kind of event the sync
   takes, in every match, its most extreme value (a comeback, a goal from far out, a player's tackles...), and counts in how
   many matches of the season, across the site's competitions (the World Cup aside), the same or more happened: k of N.
   Shown as very rare when k/N ≤ 1/every (every = 380 matches, a 20-club league season); "almost" when k/N ≤ 1/near.
   "About once every X seasons" uses the open league's own season length (clubs × (clubs − 1)); cups get no season line. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('rare','Very rare cases','league','round');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const KIND={comeback:['Comeback','عودة من بعيد','↩'],win_out:['Won while out-created','فوز رغم فرص الخصم','🛡'],few_shots:['Won with almost no shots','فوز بتسديدات قليلة','🎯'],
  dry_x:['Big chances, no goal','فرص كبيرة بلا هدف','🚫'],dry_n:['Shots without a goal','تسديدات بلا هدف','🚫'],clinical:['Ruthless finishing','لمسة أخيرة قاتلة','🔥'],
  heads:['Headed goals','أهداف بالرأس','🗣'],pens:['Missed penalties','ركلات جزاء ضائعة','❌'],quick3:['Three goals in minutes','ثلاثة أهداف في دقائق','⚡'],
  goals:['Goal fest','مهرجان أهداف','🎉'],fest:['Goals from nothing','أهداف من لا شيء','✨'],ogs:['Own goals','أهداف عكسية','🔄'],stop:['Added-time goals','أهداف الوقت بدل الضائع','⏱'],
  tiny:['Goal from almost nothing','هدف من فرصة شبه معدومة','✨'],far:['Long-range goal','هدف من بعيد','🚀'],late:['Latest goal','أكثر هدف متأخر','⏱'],early:['Earliest goal','أسرع هدف','⚡'],
  haul:['Goal haul','غلة أهداف','⚽'],hat_little:['Hat-trick from little','هاتريك من فرص قليلة','🎩'],rating:['Highest rating','أعلى تقييم','⭐'],
  pl_ast:['Assists','تمريرات حاسمة','🎁'],pl_kp:['Key passes','تمريرات مفتاحية','🔑'],pl_sca:['Chance creation','صناعة الفرص','🧠'],pl_pr:['Progressive passing','التمرير التقدمي','➡'],
  pl_ps:['Passing','التمرير','🔁'],pl_tkw:['Dribbling','المراوغة','💨'],pl_tk:['Tackles','الافتكاك','🦶'],pl_ic:['Interceptions','قطع الكرات','✋'],pl_bl:['Blocks','الصد','🧱'],
  pl_cl:['Clearances','تشتيت الكرات','🧹'],pl_aerw:['Aerial duels','الكرات الهوائية','🪂'],pl_shdry:['Shots without scoring','تسديدات بلا هدف','🚫']};
 let RP=null,RV=null;
 const load=()=>{const v=typeof ALL==='object'&&ALL&&ALL.rr;if(!v)return Promise.resolve(null);if(RV!==v){RV=v;RP=fetch('data/rare.json?v='+encodeURIComponent(v)).then(r=>r.ok?r.json():null).catch(()=>null)}return RP};
 const isCup=()=>/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(D.name||'');
 R.rare=async function(el){
  el.innerHTML='<h2>Very rare cases</h2><div id="rrroot" class="ins rr"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#rrroot'),lid=D.id,X=await load();if(!root.isConnected||D.id!==lid)return;
  if(!X||!X.leagues){root.innerHTML=`<div class="empty">${two('The very rare cases are worked out by the data update; they appear here after the next one.','الحالات النادرة جدًا تنحسب مع تحديث البيانات؛ بتظهر هنا بعد التحديث الجاي.')}</div>`;return}
  const L=X.leagues[lid]||{rare:[],near:[]},N=(X.pools&&X.pools.sh)||0,every=X.every||380;
  const teams=new Set(D.matches.flatMap(m=>[m.home,m.away])).size,season=isCup()?null:teams*(teams-1);
  const lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
  const others=(ALL.leagues||[]).filter(l=>l.id!==lid&&X.leagues[l.id]&&X.leagues[l.id].rare.length);
  const card=(c,near)=>{const K=KIND[c.k]||[c.k,c.k,'•'],per=Math.round(c.N/c.n),sea=season?per/season:null;
   const when=new Date(String(c.d).slice(0,10)+'T12:00:00').toLocaleDateString(lc,{day:'numeric',month:'long',year:'numeric'});
   return `<article class="rr-c${near?' near':''}" data-k="${esc(c.k)}"><div class="rr-b"><span class="rr-i" aria-hidden="true">${K[2]}</span><b>${nb('1 / '+per)}</b><small>${two('matches','مباراة')}</small></div>
    <div class="rr-t"><div class="rr-k">${two(esc(K[0]),esc(K[1]))} · <span class="mu">${esc(when)}</span></div>
     <p class="rr-s">${two(c.en,c.ar)}</p>
     <p class="mu rr-r">${two(`Happened in ${c.n} of the ${c.N} matches played this season in the site's competitions${c.n>1?' (this one included)':''}: about once every ${per} matches${sea!=null?`, so in a ${esc(D.name)} season (${season} matches) ${sea>=1.05?'about once every '+(sea>=10?Math.round(sea):sea.toFixed(1))+' seasons':sea>=0.95?'about once a season':'about '+Math.round(1/sea)+' times a season'}`:''}.`,
      `صار في ${nb(c.n)} من ${nb(c.N)} مباراة انلعبت هالموسم في بطولات الموقع${c.n>1?' (هذي منها)':''}: تقريبًا مرة كل ${nb(per)} مباراة${sea!=null?`، يعني في موسم <bdi>${esc(D.name)}</bdi> (${nb(season)} مباراة) تقريبًا ${sea>=1.05?'مرة كل '+nb(sea>=10?Math.round(sea):sea.toFixed(1))+' موسم':sea>=0.95?'مرة في الموسم':nb(Math.round(1/sea))+' مرات في الموسم'}`:''}.`)}</p>
     <div class="rr-a"><a href="#/match/${encodeURIComponent(c.m)}">Match centre →</a>${!/^pl_|^rating$/.test(c.k)?` <a href="#/replay/${encodeURIComponent(c.m)}">Replay →</a>`:''}</div></div></article>`};
  root.innerHTML=`<div class="card rr-hero"><div class="rr-n">${nb(L.rare.length)}</div><div><h3>${two(`very rare case${L.rare.length===1?'':'s'} in ${esc(D.name)} this season`,`حالة نادرة جدًا في <bdi>${esc(D.name)}</bdi> هالموسم`)}</h3>
     <p class="mu">${two(`Each one is the most extreme thing of its kind: it, or something more extreme, happened at most once every ${every} matches (a 20-club league season) across the ${N} matches played this season in the site's competitions (the World Cup aside). Every number comes from PitchAPI: shots, results, players' match numbers and ratings.`,`كل حالة هي أغرب شي من نوعها: هي أو شي أغرب منها صار مرة وحدة على الأكثر كل ${nb(every)} مباراة (موسم دوري من 20 فريق)، من ${nb(N)} مباراة انلعبت هالموسم في بطولات الموقع (بدون كأس العالم). كل رقم من PitchAPI: التسديدات والنتائج وأرقام اللاعبين وتقييماتهم.`)}</p></div></div>
    ${L.rare.length?`<div class="rr-list">${L.rare.map(c=>card(c,false)).join('')}</div>`:`<div class="empty">${two(`No case that rare in ${esc(D.name)} yet this season.`,`ما صار شي بهالندرة في <bdi>${esc(D.name)}</bdi> هالموسم للحين.`)}</div>`}
    ${L.near&&L.near.length?`<h3 class="rr-h">${two('Almost that rare','قريبة من هالندرة')}</h3><p class="mu rr-sub">${two(`At most once every ${X.near} matches.`,`مرة وحدة على الأكثر كل ${nb(X.near)} مباراة.`)}</p><div class="rr-list">${L.near.map(c=>card(c,true)).join('')}</div>`:''}
    ${others.length?`<div class="card rr-oth"><h3>Other competitions</h3><div class="rr-ch">${others.map(l=>`<button type="button" class="s" data-l="${esc(l.id)}">${esc(l.name)} <b>${nb(X.leagues[l.id].rare.length)}</b></button>`).join('')}</div></div>`:''}`;
  root.querySelectorAll('.rr-ch [data-l]').forEach(b=>b.addEventListener('click',async()=>{root.innerHTML='<div class="empty">Loading league…</div>';await setLeague(b.dataset.l);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head();route()}));
 };
 INS.ar({"Very rare cases":"حالات نادرة جدا جدا","Other competitions":"البطولات الثانية","Replay →":"الإعادة ←","Match centre →":"مركز المباراة ←","Loading league…":"نحمّل الدوري…"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
