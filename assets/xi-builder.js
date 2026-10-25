/* ===== XI Builder (#/builder, in Compare after Player cards): pick a formation and build your own eleven =====
   Players come from the six domestic leagues and the World Cup (PitchAPI's per-match player files, via INS.poolOne): name, club (the national
   team in the World Cup), position (the one he played most minutes in; goalkeepers GK, then DF / MF / FW), minutes, and, from data/photos_<league>.json,
   his photo and nationality code when PitchAPI has them (otherwise his initials). Age and market value come from data/tm.json (the sync matches PitchAPI's
   players to the open transfermarkt-datasets by name, see sync.py "TRANSFERMARKT"): only players it matched have them, the values are as of the dataset's
   date, and without the file the age, value and sort choices are not shown. A player is in the XI once (by his id) even if he appears in both a league and the World Cup.
   The XI is kept in this browser only (localStorage, optional). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('builder','XI Builder','compare','cards');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const POS={GK:['Goalkeeper','حارس'],DF:['Defender','مدافع'],MF:['Midfielder','لاعب وسط'],FW:['Forward','مهاجم']};
 /* outfield lines from attack to defence: [position, players] */
 const FORM={'4-3-3':[['FW',3],['MF',3],['DF',4]],'4-2-3-1':[['FW',1],['MF',3],['MF',2],['DF',4]],'4-4-2':[['FW',2],['MF',4],['DF',4]],'3-5-2':[['FW',2],['MF',5],['DF',3]],
  '3-4-3':[['FW',3],['MF',4],['DF',3]],'4-1-4-1':[['FW',1],['MF',4],['MF',1],['DF',4]],'5-3-2':[['FW',2],['MF',3],['DF',5]],'4-5-1':[['FW',1],['MF',5],['DF',4]]};
 const MAXROWS=40;
 const S={f:'4-3-3',pick:Array(11).fill(null),sel:null,q:'',lg:'',club:'',nat:'',age:'',val:'',sort:'mi',only:true,tok:0};
 const AGE={u21:[0,21],a2225:[22,25],a2629:[26,29],a30:[30,99]},VAL={v0:[0,5e6],v5:[5e6,2e7],v20:[2e7,5e7],v50:[5e7,Infinity]};
 const ageOf=dob=>{if(!dob)return null;const [y,m,d]=dob.split('-').map(Number),t=new Date();return t.getFullYear()-y-((t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<d))?1:0)};
 const money=v=>v==null?'':v>=1e6?'€'+(v/1e6).toFixed(v>=1e7?0:1)+'m':'€'+Math.round(v/1e3)+'k';
 let POOL=null,PK='';
 function slots(f){const rows=FORM[f],out=[{g:'GK',x:50,y:90}],n=rows.length;
  rows.forEach(([g,k],r)=>{const y=12+r*(66/Math.max(1,n-1));for(let i=0;i<k;i++)out.push({g,x:(i+1)/(k+1)*100,y:n===1?40:y})});return out}
 async function build(){
  const Ls=(ALL.leagues||[]).filter(l=>l&&l.file&&(/world cup/i.test(l.name)||(l.sh_file&&!/champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name))));
  const miss=[],all=[],clubs=new Set();let tm=null;try{const t=await loadJson('tm.json');if(t&&t.p&&Object.keys(t.p).length)tm=t}catch(e){tm=null}
  await Promise.all(Ls.map(async l=>{
   try{const o=await INS.poolOne(l.id,['pl']);if(!o||!o.pl)throw new Error('pl');
    let ph=null;if(l.photo_file){try{ph=await loadJson(l.photo_file,l.photo_v)}catch(e){ph=null}}
    const ix={};o.pl.cols.forEach((c,i)=>ix[c]=i);const M=new Map();
    for(const r of o.pl.rows){const mi=r[ix.mi];if(mi==null)continue;let a=M.get(r[ix.i]);if(!a){a={id:r[ix.i],name:r[ix.n],club:r[ix.c],pos:{},mi:0,gl:0,ast:0};M.set(r[ix.i],a)}
     a.mi+=mi;a.club=r[ix.c]||a.club;a.gl+=r[ix.gl]||0;a.ast+=r[ix.ast]||0;if(r[ix.o])a.pos[r[ix.o]]=(a.pos[r[ix.o]]||0)+mi}
    const pub=ph&&ph.public&&ph.p;
    for(const a of M.values()){let pos=null,b=-1;for(const p in a.pos)if(a.pos[p]>b){b=a.pos[p];pos=p}
     all.push({key:l.id+'|'+a.id,id:a.id,name:a.name||'?',club:a.club||'',lg:l.id,lgn:l.name,pos,mi:a.mi,gl:a.gl,ast:a.ast,nat:(ph&&ph.c&&ph.c[a.id])||'',photo:pub&&ph.p[a.id]||'',dob:tm&&tm.p[a.id]?tm.p[a.id][0]:null,val:tm&&tm.p[a.id]?tm.p[a.id][1]:null,age:tm&&tm.p[a.id]?ageOf(tm.p[a.id][0]):null});clubs.add(l.id+'|'+(a.club||''))}
   }catch(e){miss.push(l.name)}}));
  all.sort((a,b)=>b.mi-a.mi||a.name.localeCompare(b.name));
  return {all,miss,tm,lgs:Ls.filter(l=>!miss.includes(l.name)),by:new Map(all.map(p=>[p.key,p]))};
 }
 async function load(){
  if(POOL&&PK===INS.poolKey())return POOL;
  PK=INS.poolKey();const p=build().then(d=>{if(!d.all.length)throw new Error('empty');return d}).catch(e=>{if(POOL===p)POOL=null;throw e});POOL=p;return p;
 }
 const ini=n=>String(n||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
 const av=(p,big)=>`<span class="xb-av${big?' big':''}" style="${typeof clubVars==='function'?clubVars(p.club):''}"><b>${esc(ini(p.name))}</b>${p.photo?`<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}</span>`;
 const short=n=>{const w=String(n||'').trim().split(/\s+/);return w.length>1?w.slice(1).join(' '):w[0]};
 R.builder=async function(el){
  el.innerHTML='<h2>XI Builder</h2><div id="xbroot" class="ins lk xb"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#xbroot'),tok=++S.tok;
  let P;try{P=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('Could not load the players. Try again later.','ما قدرنا نحمّل اللاعبين. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok)return;
  try{const v=JSON.parse(localStorage.getItem('xb')||'null');if(v&&FORM[v.f]&&Array.isArray(v.ids)&&v.ids.length===11&&!S.pick.some(Boolean)){S.f=v.f;S.pick=v.ids.map(k=>k&&P.by.has(k)?k:null)}}catch(e){}
  draw(root,P);
 };
 const save=()=>{try{localStorage.setItem('xb',JSON.stringify({f:S.f,ids:S.pick}))}catch(e){}};
 function setForm(f){const old=slots(S.f),pk=S.pick.map((k,i)=>({k,g:old[i].g})).filter(x=>x.k),res=Array(11).fill(null),nw=slots(f);
  nw.forEach((s,i)=>{const j=pk.findIndex(x=>x.g===s.g);if(j>=0){res[i]=pk[j].k;pk.splice(j,1)}});S.f=f;S.pick=res;S.sel=null;save()}
 function filtered(P){
  const need=S.sel!=null?slots(S.f)[S.sel].g:null,q=S.q.trim().toLowerCase(),out=[];
  for(const p of P.all){
   if(S.only&&need&&p.pos!==need)continue;if(S.lg&&p.lg!==S.lg)continue;if(S.club&&p.club!==S.club)continue;if(S.nat&&p.nat!==S.nat)continue;
   if(S.age){if(p.age==null)continue;const b=AGE[S.age];if(p.age<b[0]||p.age>b[1])continue}
   if(S.val){if(p.val==null)continue;const b=VAL[S.val];if(p.val<b[0]||p.val>=b[1])continue}
   if(q&&!(p.name.toLowerCase().includes(q)||p.club.toLowerCase().includes(q)))continue;out.push(p)}
  if(S.sort==='val')out.sort((a,b)=>(a.val==null)-(b.val==null)||(b.val||0)-(a.val||0)||b.mi-a.mi||a.name.localeCompare(b.name));
  else if(S.sort==='age')out.sort((a,b)=>(a.age==null)-(b.age==null)||(a.age||0)-(b.age||0)||b.mi-a.mi||a.name.localeCompare(b.name));
  return out;
 }
 function draw(root,P){
  const sl=slots(S.f),taken=new Set(S.pick.filter(Boolean).map(k=>P.by.get(k).id));
  const pool=P.all.filter(p=>!S.lg||p.lg===S.lg),clubs=[...new Set(pool.map(p=>p.club).filter(Boolean))].sort(),
   nats=[...pool.reduce((m,p)=>p.nat?m.set(p.nat,(m.get(p.nat)||0)+1):m,new Map())].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(x=>x[0]);
  if(S.club&&!clubs.includes(S.club))S.club='';if(S.nat&&!nats.includes(S.nat))S.nat='';
  const list=S.sel!=null?filtered(P):[],need=S.sel!=null?sl[S.sel].g:null,done=S.pick.filter(Boolean).length;
  root.innerHTML=`<div class="card xb-top"><div class="ctl">
    <label class="dcx-l"><span class="mu">${two('Formation','التشكيلة')}</span><select id="xbf">${Object.keys(FORM).map(f=>`<option${f===S.f?' selected':''}>${f}</option>`).join('')}</select></label>
    <span class="mu xb-n">${two(`${done} of 11 picked`,`${nb(done)} من ${nb(11)} مختارين`)}</span>
    <button id="xbc" class="xb-clear" type="button"${done?'':' disabled'}>${two('Clear','مسح')}</button></div>
    <p class="mu ins-note">${two('Tap a spot on the pitch, then pick a player. Players of the six leagues and the World Cup, with their photos where PitchAPI has them.','اضغط مكان على الملعب وبعدين اختر لاعب. لاعبو الدوريات الستة وكأس العالم، بصورهم حيث توفّرها PitchAPI.')}</p></div>
   <div class="xb-pitch" aria-label="${ar()?'ملعب':'Pitch'}">${sl.map((s,i)=>{const p=S.pick[i]&&P.by.get(S.pick[i]);return `<button type="button" class="xb-slot${S.sel===i?' on':''}${p?' fill':''}" data-i="${i}" style="left:${s.x.toFixed(1)}%;top:${s.y.toFixed(1)}%">${p?av(p,true)+`<span class="xb-nm">${nm(short(p.name))}</span>`:`<span class="xb-av big empty"><b>+</b></span><span class="xb-nm mu">${two(POS[s.g][0],POS[s.g][1])}</span>`}</button>`}).join('')}</div>
   ${S.sel!=null?`<div class="card xb-pick" id="xbpick"><div class="xb-ph"><b>${two('Pick a '+POS[need][0].toLowerCase(),'اختر '+POS[need][1])}</b>${S.pick[S.sel]?`<button type="button" id="xbrm" class="xb-clear">${two('Remove','شيله')}</button>`:''}</div>
    <div class="ctl"><input id="xbq" type="search" placeholder="${ar()?'ابحث عن لاعب أو نادي':'Search player or club'}" value="${esc(S.q)}">
     <select id="xbl"><option value="">${ar()?'كل الدوريات':'All leagues'}</option>${P.lgs.map(l=>`<option value="${esc(l.id)}"${S.lg===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select>
     <select id="xbk"><option value="">${ar()?'كل الأندية':'All clubs'}</option>${clubs.map(c=>`<option${S.club===c?' selected':''}>${esc(c)}</option>`).join('')}</select>
     <select id="xbn"><option value="">${ar()?'كل الدول':'All countries'}</option>${nats.map(c=>`<option${S.nat===c?' selected':''}>${esc(c)}</option>`).join('')}</select>
     ${P.tm?`<select id="xba"><option value="">${ar()?'كل الأعمار':'All ages'}</option>${[['u21','Up to 21','حتى 21'],['a2225','22 to 25','من 22 إلى 25'],['a2629','26 to 29','من 26 إلى 29'],['a30','30 and over','30 وأكثر']].map(x=>`<option value="${x[0]}"${S.age===x[0]?' selected':''}>${ar()?x[2]:x[1]}</option>`).join('')}</select>
     <select id="xbv"><option value="">${ar()?'كل القيم':'Any value'}</option>${[['v0','Under €5m','أقل من 5 مليون €'],['v5','€5m to €20m','من 5 إلى 20 مليون €'],['v20','€20m to €50m','من 20 إلى 50 مليون €'],['v50','€50m and over','50 مليون € وأكثر']].map(x=>`<option value="${x[0]}"${S.val===x[0]?' selected':''}>${ar()?x[2]:x[1]}</option>`).join('')}</select>
     <select id="xbs"><option value="mi"${S.sort==='mi'?' selected':''}>${ar()?'الترتيب: الدقائق':'Order: minutes'}</option><option value="val"${S.sort==='val'?' selected':''}>${ar()?'الترتيب: القيمة':'Order: market value'}</option><option value="age"${S.sort==='age'?' selected':''}>${ar()?'الترتيب: الأصغر سنًا':'Order: youngest'}</option></select>`:''}
     <label class="xb-ck"><input id="xbo" type="checkbox"${S.only?' checked':''}> <span>${two('Only this position','هذا المركز فقط')}</span></label></div>
    <div class="xb-list">${list.slice(0,MAXROWS).map(p=>{const used=taken.has(p.id)&&S.pick[S.sel]!==p.key&&!(S.pick[S.sel]&&P.by.get(S.pick[S.sel]).id===p.id);return `<button type="button" class="xb-row" data-k="${esc(p.key)}"${used?' disabled':''}>${av(p)}<span class="xb-in"><b>${nm(p.name)}</b><span class="mu">${nm(p.club)} · ${nm(p.lgn)}${p.nat?' · '+nb(esc(p.nat)):''}${p.pos?' · '+two(POS[p.pos][0],POS[p.pos][1]):''}${p.age!=null?' · '+two(p.age+' y',nb(p.age)+' سنة'):''}${p.val!=null?' · '+nb(money(p.val)):''}</span></span><span class="n mu">${used?two('In XI','بالتشكيلة'):nb(Math.round(p.mi))+' '+two('min','د')}</span></button>`}).join('')||`<div class="empty">${two('No players for this choice.','ما فيه لاعبين لهذا الاختيار.')}</div>`}</div>
    ${P.tm?`<p class="mu ins-note xb-tm">${two(`Ages and market values: Transfermarkt, through the open transfermarkt-datasets (CC0); the file is dated ${esc(P.tm.asof||'an earlier date')}, but the project said on 24 Oct 2026 that its updates are paused and its data is current to 6 July 2026, so values can be older than the file date and later transfers are not in them. ${nb(P.tm.matched)} of ${nb(P.tm.n_players)} players are matched by name; the rest have no age or value: they drop out when you filter by them and come last when you sort by them.`,`الأعمار والقيم السوقية: Transfermarkt، عبر مجموعة transfermarkt-datasets المفتوحة (CC0)؛ الملف بتاريخ ${nb(esc(P.tm.asof||'—'))}، لكن المشروع قال في ${nb('24')} أكتوبر ${nb('2026')} إن تحديثاته متوقفة وإن بياناته محدّثة لين ${nb('6')} يوليو ${nb('2026')}، فالقيم ممكن تكون أقدم من تاريخ الملف والانتقالات اللي بعدها مو فيها. ${nb(P.tm.matched)} من ${nb(P.tm.n_players)} لاعب انطبقوا بالاسم؛ والباقي بدون عمر أو قيمة: يطلعون من القائمة لما تفلتر بهم ويجون آخر لما ترتّب بهم.`)}</p>`:''}
    ${list.length>MAXROWS?`<p class="mu ins-note">${two(`Showing ${MAXROWS} of ${list.length}. Search or filter to narrow it down.`,`عرض ${nb(MAXROWS)} من ${nb(list.length)}. ابحث أو فلتر لتضيّق.`)}</p>`:`<p class="mu ins-note">${two(`${list.length} players.`,`${nb(list.length)} لاعب.`)}</p>`}</div>`:''}`;
  const q=s=>root.querySelector(s),re=()=>draw(root,P);
  q('#xbf').onchange=e=>{setForm(e.target.value);re()};
  q('#xbc').onclick=()=>{S.pick=Array(11).fill(null);S.sel=null;save();re()};
  root.querySelectorAll('.xb-slot').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;S.sel=S.sel===i?null:i;re();const pk=root.querySelector('#xbpick');if(pk&&pk.scrollIntoView)try{pk.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}});
  if(S.sel!=null){
   const qi=q('#xbq');let t=null;qi.oninput=e=>{S.q=e.target.value;clearTimeout(t);t=setTimeout(()=>{re();const n=root.querySelector('#xbq');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},180)};
   q('#xbl').onchange=e=>{S.lg=e.target.value;re()};q('#xbk').onchange=e=>{S.club=e.target.value;re()};q('#xbn').onchange=e=>{S.nat=e.target.value;re()};q('#xbo').onchange=e=>{S.only=e.target.checked;re()};
   if(P.tm){q('#xba').onchange=e=>{S.age=e.target.value;re()};q('#xbv').onchange=e=>{S.val=e.target.value;re()};q('#xbs').onchange=e=>{S.sort=e.target.value;re()}}
   const rm=q('#xbrm');if(rm)rm.onclick=()=>{S.pick[S.sel]=null;S.sel=null;save();re()};
   root.querySelectorAll('.xb-row').forEach(b=>b.onclick=()=>{if(b.disabled)return;S.pick[S.sel]=b.dataset.k;S.sel=null;save();re()});
  }
 }
 INS.ar({'XI Builder':'بناء التشكيلة'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
