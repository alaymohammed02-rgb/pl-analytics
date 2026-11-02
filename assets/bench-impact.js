/* ===== Bench impact (#/bench, in the Players hub after Who keeps it up?): what the substitutes add, and whether it is a skill =====
   For the open league and season: a substitute appearance is a player-match with minutes in a match that has line-ups (data/<league>_mx.json), where the player is not in that
   match's starting XI. Per player the appearances, minutes (PitchAPI's include stoppage time), goals, assists, non-penalty xG and shots from them, with per-90 figures over his
   substitute minutes, and, for comparison, his non-penalty xG per 90 as a starter (270+ minutes starting). A second table gives each club's bench: minutes, goals, the share of the club's
   goals, non-penalty xG. A card then gives the repeat test of data/bench.json (written offline by tools/bench/fit.py, Premier League 2021-22 to 2025-26, position-adjusted):
   does the same player's per-90 number as a substitute repeat from one season to the next, and between odd and even appearances in a season? Matches without line-ups are left out
   and counted. A past season works where its files have line-ups (the Premier League back to 2021-22). Nothing is estimated. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('bench','Bench impact','players','keepsup');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const MINS=[45,90,180,360],STARTMIN=270,PAGE=40;
 const POS={FW:['Forward','مهاجم'],MF:['Midfielder','لاعب وسط'],DF:['Defender','مدافع'],GK:['Goalkeeper','حارس']};
 const SORTS=[['xg90','npxG/90','npxG/90'],['ga90','G+A/90','أ+ص/90'],['gl','Goals','أهداف']];
 const MLAB={xg:['Non-penalty xG per 90','npxG لكل 90'],sh:['Shots per 90','تسديدات لكل 90'],kp:['Key passes per 90','تمريرات مفتاحية لكل 90'],ga:['Goals + assists per 90','أهداف + صناعة لكل 90']};
 const mlab=(k,l)=>MLAB[k]?two(MLAB[k][0],MLAB[k][1]):esc(l);
 const S={mi:90,pos:'',club:'',q:'',sort:'xg90',n:PAGE,tok:0,lg:''};
 /* one pass over the league's player rows */
 function agg(o){
  const cols={};o.pl.cols.forEach((c,i)=>cols[c]=i);
  const M=(o.mx&&o.mx.m)||{},lineups=new Set(),start=new Set();
  for(const mid in M){const lu=M[mid].lu||{};let got=false;
   for(const side of ['h','a'])for(const x of ((lu[side]||{}).xi)||[]){start.add(mid+'|'+x[0]);got=true}
   if(got)lineups.add(mid)}
  const P=new Map(),C=new Map();let skipped=new Set(),used=new Set();
  for(const r of o.pl.rows){
   const mi=r[cols.mi];if(!mi)continue;
   const id=r[cols.i],mid=r[cols.m];let p=P.get(id);
   if(!p){p={id,name:r[cols.n]||'?',club:r[cols.c]||'',pos:{},sub:{n:0,mi:0,gl:0,ast:0,xg:0,sh:0},st:{n:0,mi:0,xg:0}};P.set(id,p)}
   p.club=r[cols.c]||p.club;if(r[cols.o])p.pos[r[cols.o]]=(p.pos[r[cols.o]]||0)+mi;
   if(!lineups.has(mid)){skipped.add(mid);continue}
   used.add(mid);
   const isSub=!start.has(mid+'|'+id),t=isSub?p.sub:p.st;
   t.n++;t.mi+=mi;t.xg+=r[cols.npxg]||0;
   if(isSub){t.gl+=r[cols.gl]||0;t.ast+=r[cols.ast]||0;t.sh+=r[cols.sh]||0}
   const club=r[cols.c]||'';let c=C.get(club);if(!c){c={club,gl:0,sgl:0,smi:0,sxg:0,sn:0};C.set(club,c)}
   c.gl+=r[cols.gl]||0;if(isSub){c.sgl+=r[cols.gl]||0;c.smi+=mi;c.sxg+=r[cols.npxg]||0;c.sn++}
  }
  for(const p of P.values()){let b=null,bm=-1;for(const k of Object.keys(p.pos).sort()){if(p.pos[k]>bm){bm=p.pos[k];b=k}}p.main=b}
  return {players:[...P.values()],clubs:[...C.values()],lineups:used.size,nolineup:[...skipped].filter(m=>!used.has(m)).length};
 }
 const per90=(v,mi)=>mi>0?v/mi*90:null;
 let CF=null,CK='';
 function loadBench(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('bench.json',ALL.generated).then(d=>d&&d.measures?d:null).catch(()=>null);
  CF=p;return p;
 }
 R.bench=async function(el){
  el.innerHTML='<h2>Bench impact</h2><div id="bnroot" class="ins lk bn"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#bnroot'),lg=D.id,tok=++S.tok;
  let o,B;
  try{o=await INS.poolOne(lg,['pl','mx']);if(!o||!o.pl)throw new Error('pl')}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The player data is not available right now.','بيانات اللاعبين مو متوفرة الحين.')}</div>`;return}
  B=await loadBench();
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(S.lg!==lg){S.lg=lg;S.club='';S.pos='';S.n=PAGE}
  if(!o.mx||!o.mx.m||!Object.keys(o.mx.m).length){root.innerHTML=`<div class="empty">${two('This season has no line-ups in the data, so substitutes cannot be told from starters.','هالموسم ما فيه تشكيلات في البيانات، فما نقدر نفرّق الاحتياط عن الأساسيين.')}</div>`;return}
  const A=agg(o);draw(root,A,B,o);
 };
 const f2=x=>x==null?'–':(+x).toFixed(2);
 function rows(A){
  const q=S.q.trim().toLowerCase();
  const out=A.players.filter(p=>p.sub.mi>=S.mi&&(!S.pos||p.main===S.pos)&&(!S.club||p.club===S.club)&&(!q||p.name.toLowerCase().includes(q)||p.club.toLowerCase().includes(q)));
  const key={xg90:p=>per90(p.sub.xg,p.sub.mi),ga90:p=>per90(p.sub.gl+p.sub.ast,p.sub.mi),gl:p=>p.sub.gl}[S.sort];
  return out.sort((a,b)=>key(b)-key(a)||b.sub.mi-a.sub.mi||cmp(a.name,b.name)||cmp(a.id,b.id));
 }
 function skill(B){
  if(!B)return '';
  const ms=Object.keys(B.measures).map(k=>({k,...B.measures[k]}));
  const rep=ms.filter(m=>m.yoy.lo!=null&&m.yoy.lo>0),non=ms.filter(m=>m.yoy.lo==null||m.yoy.lo<=0);
  const names=l=>l.map(m=>m.label.replace(' per 90','').replace(/^./,c=>c.toLowerCase())).join(', ');
  const sum=two(`<b>Some of it repeats, some does not.</b> ${rep.length?`The player's ${names(rep)} as a substitute correlate from one season to the next (${rep.map(m=>m.yoy.r.toFixed(2)).join(', ')}, beyond noise)`:'No measure repeats beyond noise'}${non.length?`${rep.length?'; ':''}${names(non)} ${non.length===1?'does':'do'} not (${non.map(m=>m.yoy.r==null?'–':m.yoy.r.toFixed(2)).join(', ')}, within noise)`:''}. Position is taken out first, so forwards are not just compared with defenders.`,
   `<b>جزء منه يتكرر وجزء لا.</b> ${rep.length?`المقاييس اللي تتكرر من موسم للي بعده عند البدلاء (فوق الضوضاء): ${rep.map(m=>MLAB[m.k]?MLAB[m.k][1].replace(' لكل 90',''):m.label).join('، ')} (${rep.map(m=>nb(m.yoy.r.toFixed(2))).join('، ')})`:'ما فيه مقياس يتكرر فوق الضوضاء'}${non.length?`${rep.length?'؛ ':''}وما يتكرر: ${non.map(m=>MLAB[m.k]?MLAB[m.k][1].replace(' لكل 90',''):m.label).join('، ')} (${non.map(m=>m.yoy.r==null?'–':nb(m.yoy.r.toFixed(2))).join('، ')}، ضمن الضوضاء)`:''}. نشيل أثر المركز أول، فالمهاجم ما يقارن بالمدافع مباشرة.`);
  return `<div class="card bn-sk" id="bnsk"><h3>${two('Is it a skill?','هل هو مهارة؟')}</h3><p>${sum}</p>
   <div class="bn-wr"><table class="lk-t bn-st"><thead><tr><th>${two('Per 90 as a substitute','لكل 90 كبديل')}</th><th class="n">${two('Season to season','موسم لموسم')}</th><th class="n">${two('95% band','نطاق 95%')}</th><th class="n">${two('Pairs','أزواج')}</th><th class="n">${two('Within a season','داخل الموسم')}</th><th class="n">${two('Players','لاعبين')}</th></tr></thead>
   <tbody>${ms.map(m=>`<tr class="bn-sr" data-k="${m.k}" data-r="${m.yoy.r==null?'':m.yoy.r.toFixed(5)}" data-n="${m.yoy.n}" data-sb="${m.half.sb==null?'':m.half.sb.toFixed(5)}" data-hn="${m.half.n}"><td>${mlab(m.k,m.label)}</td><td class="n"><b>${nb(f2(m.yoy.r))}</b></td><td class="n">${nb(m.yoy.lo==null?'–':f2(m.yoy.lo)+' to '+f2(m.yoy.hi))}</td><td class="n">${nb(m.yoy.n)}</td><td class="n">${nb(f2(m.half.sb))}</td><td class="n">${nb(m.half.n)}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two(`Premier League, ${esc(B.seasons[0])} to ${esc(B.seasons[B.seasons.length-1])}, the only league with five seasons of line-ups. Season to season: Spearman correlation of the player's per-90 number (set against his position that season) in one season and the next, ${B.min_yoy}+ substitute minutes in both. Within a season: his appearances in date order, odd against even, ${B.min_half}+ minutes in each half, corrected for halving. Written offline by tools/bench/fit.py.`,`الدوري الإنجليزي، من ${nb(esc(B.seasons[0]))} إلى ${nb(esc(B.seasons[B.seasons.length-1]))}، الدوري الوحيد اللي عنده خمس مواسم من التشكيلات. موسم لموسم: ارتباط سبيرمان لرقم اللاعب لكل 90 (مقارنة بمركزه في ذاك الموسم) في موسم والموسم اللي بعده، ${nb(B.min_yoy)}+ دقيقة كبديل في الموسمين. داخل الموسم: ظهوره بالترتيب الزمني، الفردي مقابل الزوجي، ${nb(B.min_half)}+ دقيقة في كل نصف، مع التصحيح للنصف. مكتوب خارج الموقع بأداة tools/bench/fit.py.`)}</p></div>`;
 }
 function draw(root,A,B,o){
  const list=rows(A),show=list.slice(0,S.n),clubs=[...new Set(A.players.map(p=>p.club).filter(Boolean))].sort(cmp);
  if(S.club&&!clubs.includes(S.club))S.club='';
  const cl=A.clubs.slice().sort((a,b)=>b.sgl-a.sgl||b.smi-a.smi||cmp(a.club,b.club));
  const posOpts=Object.keys(POS).filter(k=>A.players.some(p=>p.main===k));
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>What do the substitutes add?</b> Everyone who came on, with what they did in those minutes. A substitute is a player who played but was not in the starting line-up. The last card asks whether it is a skill that repeats.','<b>وش يضيف البدلاء؟</b> كل من دخل، ووش سوّى في دقائقه. البديل هو لاعب لعب بس ما كان في التشكيلة الأساسية. آخر بطاقة تسأل: هل هو مهارة تتكرر؟')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('Substitute minutes at least','دقائق البديل على الأقل')}</span><select id="bnm">${MINS.map(v=>`<option value="${v}"${v===S.mi?' selected':''}>${v}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Position','المركز')}</span><select id="bnp"><option value="">${ar()?'كل المراكز':'All'}</option>${posOpts.map(k=>`<option value="${k}"${S.pos===k?' selected':''}>${ar()?POS[k][1]:POS[k][0]}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="bnc"><option value="">${ar()?'كل الأندية':'All clubs'}</option>${clubs.map(c=>`<option value="${esc(c)}"${S.club===c?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <input id="bnq" type="search" placeholder="${ar()?'ابحث عن لاعب':'Search a player'}" value="${esc(S.q)}" aria-label="${ar()?'ابحث':'Search'}"></div>
    <div class="seg" id="bnso" role="group" aria-label="${ar()?'الترتيب':'Order by'}">${SORTS.map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${S.sort===k}" class="${S.sort===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div>
   <div class="card"><h3>${two('Substitutes','البدلاء')} <span class="mu bn-c" id="bncount" data-n="${list.length}">${two(`${list.length} players`,`${nb(list.length)} لاعب`)}</span></h3>
    ${show.length?`<div class="bn-wr"><table class="lk-t bn-t"><thead><tr><th>${two('Player','اللاعب')}</th><th>${two('Pos','المركز')}</th><th class="n">${two('Apps','مباريات')}</th><th class="n">${two('Min','دقائق')}</th><th class="n">${two('Goals','أهداف')}</th><th class="n">${two('Assists','صناعة')}</th><th class="n">npxG</th><th class="n">${two('npxG/90','npxG/90')}</th><th class="n">${two('G+A/90','أ+ص/90')}</th><th class="n">${two('npxG/90 starting','npxG/90 أساسي')}</th></tr></thead>
    <tbody>${show.map(p=>`<tr class="bn-r" data-id="${esc(p.id)}" data-mi="${p.sub.mi}" data-n="${p.sub.n}" data-gl="${p.sub.gl}" data-ast="${p.sub.ast}"><td>${nm(p.name)} <span class="mu">${nm(p.club)}</span></td><td>${p.main?(ar()?POS[p.main]?POS[p.main][1]:esc(p.main):esc(p.main)):'–'}</td><td class="n">${nb(p.sub.n)}</td><td class="n">${nb(Math.round(p.sub.mi))}</td><td class="n">${nb(p.sub.gl)}</td><td class="n">${nb(p.sub.ast)}</td><td class="n">${nb(f2(p.sub.xg))}</td><td class="n"><b>${nb(f2(per90(p.sub.xg,p.sub.mi)))}</b></td><td class="n">${nb(f2(per90(p.sub.gl+p.sub.ast,p.sub.mi)))}</td><td class="n">${nb(p.st.mi>=STARTMIN?f2(per90(p.st.xg,p.st.mi)):'–')}</td></tr>`).join('')}</tbody></table></div>
    ${list.length>show.length?`<button type="button" class="s bn-more" id="bnmore">${two('Show more','أظهر أكثر')}</button>`:''}`:`<div class="empty">${two('No substitute matches these choices.','ما فيه بديل يطابق هالاختيارات.')}</div>`}
    <p class="mu ins-note">${two(`${A.lineups} matches with line-ups${A.nolineup?` (${A.nolineup} without line-ups are left out)`:''}. Minutes are PitchAPI's and include stoppage time. A starter's per-90 number needs ${STARTMIN}+ minutes starting. Substitutes play fewer minutes and at different moments of a match, so a per-90 number over a few appearances moves a lot.`,`${nb(A.lineups)} مباراة فيها تشكيلات${A.nolineup?` (و${nb(A.nolineup)} بدون تشكيلات مستبعدة)`:''}. الدقائق من ${nb('PitchAPI')} وتشمل الوقت بدل الضائع. رقم الأساسي لكل 90 يحتاج ${nb(STARTMIN)}+ دقيقة كأساسي. البدلاء يلعبون دقائق أقل في لحظات مختلفة من المباراة، فرقم لكل 90 على كم ظهور يتحرك كثير.`)}</p></div>
   <div class="card"><h3>${two('Each club\'s bench','دكة كل نادي')}</h3><div class="bn-wr"><table class="lk-t bn-ct"><thead><tr><th>${two('Club','النادي')}</th><th class="n">${two('Substitute minutes','دقائق البدلاء')}</th><th class="n">${two('Goals by substitutes','أهداف البدلاء')}</th><th class="n">${two('Club goals','أهداف النادي')}</th><th class="n">${two('Share','النسبة')}</th><th class="n">npxG</th></tr></thead>
    <tbody>${cl.map(c=>`<tr class="bn-cr" data-c="${esc(c.club)}" data-smi="${Math.round(c.smi)}" data-sgl="${c.sgl}" data-gl="${c.gl}"><td>${nm(c.club)}</td><td class="n">${nb(Math.round(c.smi))}</td><td class="n"><b>${nb(c.sgl)}</b></td><td class="n">${nb(c.gl)}</td><td class="n">${nb(c.gl?Math.round(c.sgl/c.gl*100)+'%':'–')}</td><td class="n">${nb(f2(c.sxg))}</td></tr>`).join('')}</tbody></table></div></div>
   ${skill(B)}`;
  const q=s=>root.querySelector(s),redo=()=>draw(root,A,B,o);
  q('#bnm').onchange=e=>{S.mi=+e.target.value;S.n=PAGE;redo()};
  q('#bnp').onchange=e=>{S.pos=e.target.value;S.n=PAGE;redo()};
  q('#bnc').onchange=e=>{S.club=e.target.value;S.n=PAGE;redo()};
  const qi=q('#bnq');qi.oninput=()=>{S.q=qi.value;S.n=PAGE;const pos=qi.selectionStart;redo();const n=root.querySelector('#bnq');n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}};
  root.querySelectorAll('#bnso button').forEach(b=>b.onclick=()=>{S.sort=b.dataset.k;S.n=PAGE;redo()});
  const mo=q('#bnmore');if(mo)mo.onclick=()=>{S.n+=PAGE;redo()};
 }
 INS.bench={agg};
 INS.ar({'Bench impact':'تأثير الدكة'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
