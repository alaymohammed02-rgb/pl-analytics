/* ===== Player career (#/career, in the Players hub after Player story): one player, season by season =====
   Search a player of the six domestic leagues and see his seasons in the data: league, club, position, matches, minutes, goals, assists, xG, xAG, and per 90 minutes his non-penalty xG,
   xAG, shots, key passes, tackles + interceptions and goals, each as a small chart over the seasons. The finished seasons come from data/career.json (written offline by
   tools/career/write.py from the past-season player files: Premier League 2021-22 to 2025-26, the other five leagues 2024-25 and 2025-26; a season whose player file has no rows is
   not in it); the season under way is added here in the browser from the league's current player file with the same sums, and marked "so far".
   Honest limits, printed on the page: per 90 numbers from few minutes jump around (a season under 450 minutes is a hollow dot and the table says so); xAG is missing for whole matches, so
   his xAG per 90 uses only the minutes of the matches that have it; leagues differ, so a move between leagues is marked and its numbers are not directly comparable; the data does not
   go back beyond the seasons above. Which numbers repeat from one season to the next is measured on the Stat stability page: goals and assists repeat much less than shots and chances created, so a
   drop in goals per 90 is often noise. Nothing is estimated. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function'||typeof INS.pool!=='function')return;
 INS.addPage('career','Player career','players','story');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const F=['s','lg','c','pos','g','mi','gl','ast','xg','npxg','xag','xagmi','sh','kp','tkic'];
 const THIN=450,MINPT=90;
 const S={tok:0};
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ø/g,'o').replace(/ł/g,'l').replace(/ß/g,'ss').toLowerCase();
 const lgName=id=>{const l=(ALL.leagues||[]).find(x=>x.id===id);return l?l.name:id};
 const top=m=>{let b=null,v=-1;for(const k in m)if(m[k]>v||(m[k]===v&&k>b)){b=k;v=m[k]}return b};
 /* the current season of one league's player file, with the sums tools/career/write.py makes for a past one */
 function currentOf(o){
  const pl=o.pl,c={};pl.cols.forEach((k,i)=>c[k]=i);const by=new Map();
  for(const r of pl.rows){const mi=r[c.mi];if(!mi)continue;let a=by.get(r[c.i]);
   if(!a){a={id:r[c.i],name:r[c.n],club:{},pos:{},g:0,mi:0,gl:0,ast:0,xg:0,npxg:0,xag:0,xagmi:0,sh:0,kp:0,tkic:0};by.set(r[c.i],a)}
   a.name=r[c.n]||a.name;a.g++;a.mi+=mi;a.club[r[c.c]]=(a.club[r[c.c]]||0)+mi;if(r[c.o])a.pos[r[c.o]]=(a.pos[r[c.o]]||0)+mi;
   a.gl+=r[c.gl]||0;a.ast+=r[c.ast]||0;a.xg+=r[c.xg]||0;a.npxg+=r[c.npxg]||0;a.sh+=r[c.sh]||0;a.kp+=r[c.kp]||0;a.tkic+=(r[c.tk]||0)+(r[c.ic]||0);
   if(r[c.xag]!=null){a.xag+=r[c.xag];a.xagmi+=mi}}
  return [...by.values()].map(a=>({id:a.id,name:a.name,s:((ALL.seasons||{})[o.l.id]||{}).cur||ALL.season||'now',lg:o.l.id,c:top(a.club),pos:top(a.pos),g:a.g,mi:Math.round(a.mi),gl:Math.round(a.gl),ast:Math.round(a.ast),xg:a.xg,npxg:a.npxg,xag:a.xag,xagmi:Math.round(a.xagmi),sh:Math.round(a.sh),kp:Math.round(a.kp),tkic:Math.round(a.tkic),cur:true}));
 }
 let CACHE=null,CK='';
 function load(){
  if(CACHE&&CK===INS.poolKey())return CACHE;
  CK=INS.poolKey();
  const p=Promise.all([loadJson('career.json',ALL.generated),INS.pool(['pl'])]).then(([C,pool])=>{
   if(!C||!C.p||!C.lgs)throw new Error('career');
   const seasons=new Map(),names=new Map(Object.entries(C.n||{}));
   for(const pid in C.p)seasons.set(pid,C.p[pid].map(r=>{const o={};F.forEach((k,i)=>o[k]=r[i]);o.lg=C.lgs[o.lg];return o}));
   pool.leagues.forEach(o=>{if(!o.pl)return;currentOf(o).forEach(a=>{names.set(a.id,a.name||names.get(a.id)||'?');if(!seasons.has(a.id))seasons.set(a.id,[]);seasons.get(a.id).push(a)})});
   seasons.forEach(v=>v.sort((a,b)=>cmp(a.cur?'~':a.s,b.cur?'~':b.s)||cmp(a.lg,b.lg)));
   return {C,seasons,names,miss:pool.miss};
  }).catch(e=>{if(CACHE===p)CACHE=null;throw e});
  CACHE=p;return p;
 }
 /* per 90 of one measure for one season row: null when the minutes are too few to show a point */
 const MEAS=[['npxg','Non-penalty xG','npxG لكل 90',r=>r.mi>=MINPT?r.npxg/r.mi*90:null],['xag','xAG','xAG لكل 90',r=>r.xagmi>=MINPT?r.xag/r.xagmi*90:null],['sh','Shots','تسديدات لكل 90',r=>r.mi>=MINPT?r.sh/r.mi*90:null],
  ['kp','Key passes','تمريرات مفتاحية لكل 90',r=>r.mi>=MINPT?r.kp/r.mi*90:null],['tkic','Tackles + interceptions','تدخلات + قطع كرات لكل 90',r=>r.mi>=MINPT?r.tkic/r.mi*90:null],['gl','Goals','أهداف لكل 90',r=>r.mi>=MINPT?r.gl/r.mi*90:null]];
 const f2=x=>x.toFixed(2),f1=x=>x.toFixed(1);
 const short=s=>/^\d{4}-\d{2}$/.test(s)?s.slice(2,4)+'/'+s.slice(5):s;
 function panel(rows,m){
  const vals=rows.map(r=>m[3](r)),mx=Math.max(.05,...vals.filter(v=>v!=null)),W=200,H=96,L=16,Rr=16,T=14,B=18,n=rows.length,px=i=>n===1?W/2:L+(W-L-Rr)*i/(n-1),py=v=>T+(H-T-B)*(1-v/(mx*1.1));
  const ln=[];vals.forEach((v,i)=>{if(v!=null&&rows[i].mi>=THIN)ln.push(px(i).toFixed(1)+','+py(v).toFixed(1))});
  const dots=vals.map((v,i)=>v==null?'':`<g class="pc-pt${rows[i].mi>=THIN?'':' thin'}" data-i="${i}" data-v="${f2(v)}"><circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="2.6"><title>${short(rows[i].s)}${rows[i].cur?(ar()?' (لحد الحين)':' (so far)'):''} · ${f2(v)} ${ar()?'لكل 90':'per 90'} · ${rows[i].mi} ${ar()?'دقيقة':'min'}${rows[i].mi<THIN?(ar()?' · دقائق قليلة':' · few minutes'):''}</title></circle><text x="${px(i).toFixed(1)}" y="${(py(v)-4.5).toFixed(1)}" text-anchor="middle" class="pc-v">${f2(v)}</text></g>`).join('');
  const xs=rows.map((r,i)=>`<text x="${px(i).toFixed(1)}" y="${H-5}" text-anchor="middle" class="pc-x">${short(r.s)}${r.cur?'*':''}</text>`).join('');
  return `<div class="card pc-pn" data-m="${m[0]}"><b>${two(m[1],m[2])}</b><svg viewBox="0 0 ${W} ${H}" class="pc-svg" role="img" aria-label="${esc(m[1])}"><line x1="${L}" y1="${(H-B).toFixed(1)}" x2="${W-Rr}" y2="${(H-B).toFixed(1)}" class="pc-ax"/>${ln.length>1?`<polyline points="${ln.join(' ')}" class="pc-ln"/>`:''}${dots}${xs}</svg></div>`;
 }
 function table(rows){
  const p90=(r,k)=>r.mi>=MINPT?f2(r[k]/r.mi*90):'–',xa=r=>r.xagmi>=MINPT?f2(r.xag/r.xagmi*90):'–';
  return `<div class="pc-tw"><table class="pc-tb" id="pctb"><thead><tr><th>${two('Season','الموسم')}</th><th>${two('League','الدوري')}</th><th>${two('Club','النادي')}</th><th>${two('Pos','المركز')}</th><th>${two('P','لعب')}</th><th>${two('Min','دقائق')}</th><th>${two('G','أهداف')}</th><th>${two('A','تمريرات حاسمة')}</th><th>xG</th><th>xAG</th><th>npxG/90</th><th>xAG/90</th><th>${two('Sh/90','تسديد/90')}</th><th>${two('KP/90','مفتاحية/90')}</th><th>${two('T+I/90','تدخل+قطع/90')}</th></tr></thead><tbody>${rows.map((r,i)=>{
   const prev=rows[i-1],moved=prev&&prev.lg!==r.lg,club=prev&&prev.c!==r.c&&!moved;
   return `<tr class="${r.mi<THIN?'thin':''}" data-s="${esc(r.s)}" data-lg="${esc(r.lg)}" data-c="${esc(r.c||'')}" data-g="${r.g}" data-mi="${r.mi}" data-gl="${r.gl}" data-ast="${r.ast}" data-xg="${f2(r.xg)}" data-xag="${f2(r.xag)}" data-xagmi="${r.xagmi}" data-npxg90="${r.mi>=MINPT?f2(r.npxg/r.mi*90):''}" data-sh90="${r.mi>=MINPT?f2(r.sh/r.mi*90):''}" data-kp90="${r.mi>=MINPT?f2(r.kp/r.mi*90):''}" data-tkic90="${r.mi>=MINPT?f2(r.tkic/r.mi*90):''}" data-xag90="${r.xagmi>=MINPT?f2(r.xag/r.xagmi*90):''}">
    <td>${nb(short(r.s))}${r.cur?`<span class="mu"> ${two('so far','لحد الحين')}</span>`:''}</td><td>${nm(lgName(r.lg))}${moved?` <span class="pc-mv">${two('moved','انتقل')}</span>`:''}</td><td>${nm(r.c||'–')}${club?` <span class="pc-mv">${two('new club','نادي جديد')}</span>`:''}</td><td>${esc(r.pos||'–')}</td><td>${nb(r.g)}</td><td>${nb(r.mi)}</td><td>${nb(r.gl)}</td><td>${nb(r.ast)}</td><td>${nb(f2(r.xg))}</td><td>${r.xagmi>0?nb(f2(r.xag)):'–'}</td><td>${nb(p90(r,'npxg'))}</td><td>${nb(xa(r))}</td><td>${nb(p90(r,'sh'))}</td><td>${nb(p90(r,'kp'))}</td><td>${nb(p90(r,'tkic'))}</td></tr>`}).join('')}</tbody></table></div>`;
 }
 function search(D0,q){
  const t=fold(q).trim();if(t.length<2)return [];
  const out=[];D0.names.forEach((n,id)=>{const f=fold(n);const i=f.indexOf(t);if(i>=0){const rs=D0.seasons.get(id)||[];if(rs.length)out.push({id,name:n,rank:(i===0?0:f.includes(' '+t)?1:2),last:rs[rs.length-1],n:rs.length,mi:rs.reduce((s,r)=>s+r.mi,0)})}});
  return out.sort((a,b)=>a.rank-b.rank||b.mi-a.mi||cmp(a.name,b.name)||cmp(a.id,b.id)).slice(0,8);
 }
 const pick=(root,D0)=>{
  const inp=root.querySelector('#pcq'),box=root.querySelector('#pcsug');if(!inp)return;
  const show=()=>{const L=search(D0,inp.value);box.innerHTML=L.map(x=>`<a class="pc-s" role="option" href="#/career/${encodeURIComponent(x.id)}" data-id="${esc(x.id)}"><b>${nm(x.name)}</b> <span class="mu">${nm(x.last.c||'')} · ${nm(lgName(x.last.lg))} · ${nb(x.n)} ${two(x.n===1?'season':'seasons',x.n===1?'موسم':'مواسم')}</span></a>`).join('')+(inp.value.trim().length>=2&&!L.length?`<div class="mu pc-no">${two('No player with that name in the six leagues.','ما فيه لاعب بهالاسم في الدوريات الستة.')}</div>`:'')};
  inp.oninput=show;inp.onkeydown=e=>{if(e.key==='Enter'){const a=box.querySelector('a');if(a){e.preventDefault();location.hash=a.getAttribute('href')}}};
 };
 R.career=async function(el,arg){
  el.innerHTML='<h2>Player career</h2><div id="pcroot" class="ins lk pc"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#pcroot'),lg=D.id,tok=++S.tok,gone=()=>!root.isConnected||tok!==S.tok||D.id!==lg;
  let D0;try{D0=await load()}catch(e){if(gone())return;root.innerHTML=`<div class="empty">${two('Could not load the career data. Try again later.','ما قدرنا نحمّل بيانات المسيرة. جرّب بعدين.')}</div>`;return}
  if(gone())return;
  let pid='';try{pid=decodeURIComponent(arg||'')}catch(e){pid=String(arg||'')}
  const bar=`<div class="card pc-f"><label class="dcx-l"><span class="mu">${two('Search a player','ابحث عن لاعب')}</span><input id="pcq" type="search" autocomplete="off" placeholder="${ar()?'اكتب الاسم بحروف لاتينية':'Type a name'}" aria-label="${ar()?'ابحث عن لاعب':'Search a player'}"></label><div id="pcsug" class="pc-sg" role="listbox"></div></div>`;
  const rows=pid?D0.seasons.get(pid):null;
  if(!rows||!rows.length){
   const best=[...D0.seasons.entries()].map(([id,rs])=>({id,name:D0.names.get(id),n:rs.length,mi:rs.reduce((s,r)=>s+r.mi,0),pos:top(rs.reduce((m,r)=>{if(r.pos)m[r.pos]=(m[r.pos]||0)+r.mi;return m},{}))})).filter(x=>x.n>=4&&x.pos!=='GK').sort((a,b)=>b.mi-a.mi||cmp(a.id,b.id)).slice(0,12);
   root.innerHTML=`${pid?`<div class="empty" id="pcnone">${two('No player with that id in the data.','ما فيه لاعب بهالمعرّف في البيانات.')}</div>`:''}<p class="mu pc-n">${two('Pick a player to see his seasons side by side. The Premier League has five finished seasons in the data, the other five leagues two, and this season is added as it is played.','اختر لاعب وشوف مواسمه جنب بعض. الدوري الإنجليزي عنده خمسة مواسم منتهية في البيانات، والخمسة الباقية موسمين، وهذا الموسم يُضاف أول بأول.')}</p>${bar}
    <div class="card"><h3>${two('Outfield players with the most minutes over four or more seasons','لاعبو الميدان الأكثر دقائق في أربعة مواسم أو أكثر')}</h3><div class="pc-ch" id="pcchips">${best.map(x=>`<a class="s" href="#/career/${encodeURIComponent(x.id)}" data-id="${esc(x.id)}">${nm(x.name)}</a>`).join('')}</div></div>`;
   pick(root,D0);return;
  }
  const name=D0.names.get(pid)||'?',mi=rows.reduce((s,r)=>s+r.mi,0),clubs=[...new Set(rows.map(r=>r.c).filter(Boolean))],lgs=[...new Set(rows.map(r=>r.lg))];
  const pos=top(rows.reduce((m,r)=>{if(r.pos)m[r.pos]=(m[r.pos]||0)+r.mi;return m},{}));
  const cur=(D.stats||[]).find(s=>s.player_id===pid);
  root.innerHTML=`${bar}<div class="card pc-hd" id="pchd" data-id="${esc(pid)}" data-n="${rows.length}" data-mi="${mi}"><h3>${nm(name)}</h3><div class="mu">${two(`${rows.length} ${rows.length===1?'season':'seasons'} in the data · ${Math.round(mi)} minutes · ${clubs.length} ${clubs.length===1?'club':'clubs'} · ${lgs.length} ${lgs.length===1?'league':'leagues'}${pos?' · '+esc(pos):''}`,`${nb(rows.length)} ${rows.length===1?'موسم':'مواسم'} في البيانات · ${nb(Math.round(mi))} دقيقة · ${nb(clubs.length)} ${clubs.length===1?'نادي':'أندية'} · ${nb(lgs.length)} ${lgs.length===1?'دوري':'دوريات'}`)}</div>
    ${cur?`<a class="s pc-pl" href="#/player/${encodeURIComponent(cur.key+'||'+cur.club)}">${two("This season's player page",'صفحة اللاعب لهذا الموسم')}</a>`:''}</div>
    <div class="pc-pg">${MEAS.map(m=>panel(rows,m)).join('')}</div>
    <div class="card"><h3>${two('Season by season','موسم بموسم')}</h3>${table(rows)}</div>
    <p class="mu ins-note">${two(`How to read it: per 90 numbers are the season's total divided by minutes, times 90. A season under ${THIN} minutes is a hollow dot and a faded row: a few matches move a per 90 number a lot. xAG is missing for whole matches in PitchAPI's data, so xAG per 90 uses only the minutes of the matches that have it (a dash under ${MINPT} such minutes). * = the season under way. Leagues differ in style and level, so numbers across a move between leagues are not directly comparable. Goals and assists repeat much less from one season to the next than shots and chances created (see <a href="#/stability">Stat stability</a>), so a fall in goals per 90 is often noise.`,`كيف تقرأها: أرقام لكل 90 = مجموع الموسم مقسوم على الدقائق ضرب 90. الموسم أقل من ${nb(THIN)} دقيقة نقطة مفرغة وصف باهت: كم مباراة تحرّك الرقم كثير. xAG ناقص لمباريات كاملة في بيانات PitchAPI، فـxAG لكل 90 يستخدم دقائق المباريات اللي فيها بس (شرطة تحت ${nb(MINPT)} دقيقة منها). * = الموسم الجاري. الدوريات تختلف في الأسلوب والمستوى، فالأرقام عبر الانتقال بين دوريين ما تتقارن مباشرة. الأهداف والتمريرات الحاسمة تتكرر أقل بكثير من التسديدات وصناعة الفرص من موسم لموسم (شوف <a href="#/stability">ثبات الإحصائيات</a>)، فنزول الأهداف لكل 90 غالبًا ضجيج.`)}</p>`;
  pick(root,D0);
 };
 /* a link to the career on the player's own page */
 const op=R.player;
 if(typeof op==='function')R.player=async function(el,arg){
  await op.apply(this,arguments);
  if(!el.isConnected)return;
  const [key,club]=(()=>{try{return decodeURIComponent(arg||'').split('||')}catch(e){return []}})();
  const st=(D.stats||[]).find(s=>s.key===key&&s.club===club&&s.player_id);if(!st)return;
  const head=el.querySelector('#pp .pp-head');if(!head||head.querySelector('.pc-link'))return;
  head.insertAdjacentHTML('beforeend',`<a class="s pc-link" href="#/career/${encodeURIComponent(st.player_id)}">${two('Career, season by season','المسيرة موسم بموسم')}</a>`);
 };
 INS.career={currentOf};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
