/* ===== Player prices (#/prices, in Players after Who keeps it up?): market values of the players of the six leagues =====
   The numbers are Transfermarkt's market values, from data/tm.json (the sync matches PitchAPI's players to the open transfermarkt-datasets by name,
   see sync.py "TRANSFERMARKT"): only matched players have a price, and the values are dated (the page says the file's date and that the project's
   own data is older). Two views: Players (sorted, filtered by league, position, club, age band and search) and Clubs (the sum, average and top
   player of the priced players of each club: an UNDERCOUNT when some of a club's players are not matched, which the table shows as "priced / squad").
   The player pool is the one the XI Builder loads (INS.playerPool); World Cup entries are left out so nobody is counted twice. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('prices','Player prices','players','keepsup');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const POS={GK:['Goalkeeper','حارس'],DF:['Defender','مدافع'],MF:['Midfielder','لاعب وسط'],FW:['Forward','مهاجم']};
 const AGE={u21:[0,21],a2225:[22,25],a2629:[26,29],a30:[30,99]};
 const S={tab:'players',lg:'',pos:'',club:'',age:'',q:'',sort:'val',n:50,tok:0};
 const PAGE=50;
 const tot=v=>v>=1e9?'€'+(v/1e9).toFixed(2)+'bn':INS.money(v);
 R.prices=async function(el){
  el.innerHTML='<h2>Player prices</h2><div id="prroot" class="ins lk pr"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#prroot'),tok=++S.tok;
  let P;try{if(typeof INS.playerPool!=='function')throw new Error('pool');P=await INS.playerPool()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('Could not load the players. Try again later.','ما قدرنا نحمّل اللاعبين. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok)return;
  if(!P.tm){root.innerHTML=`<div class="empty">${two('No prices yet: the market-value file has not been downloaded. It arrives with the next data update.','ما فيه أسعار للحين: ملف القيم السوقية ما انحمّل. يوصل مع التحديث الجاي للبيانات.')}</div>`;return}
  const wc=new Set(P.lgs.filter(l=>/world cup/i.test(l.name)).map(l=>l.id)),dom=P.all.filter(p=>!wc.has(p.lg)),priced=dom.filter(p=>p.val!=null);
  draw(root,P,dom,priced,P.lgs.filter(l=>!wc.has(l.id)));
 };
 function draw(root,P,dom,priced,lgs){
  const inLg=p=>!S.lg||p.lg===S.lg;
  const clubs=[...new Set(priced.filter(inLg).map(p=>p.club).filter(Boolean))].sort();if(S.club&&!clubs.includes(S.club))S.club='';
  const q=S.q.trim().toLowerCase();
  const f=priced.filter(p=>inLg(p)&&(!S.club||p.club===S.club)&&(!S.pos||p.pos===S.pos)&&(!S.age||(p.age!=null&&p.age>=AGE[S.age][0]&&p.age<=AGE[S.age][1]))&&(!q||p.name.toLowerCase().includes(q)||p.club.toLowerCase().includes(q)));
  const lgn=id=>(lgs.find(l=>l.id===id)||{}).name||id;
  const srt={val:(a,b)=>b.val-a.val,young:(a,b)=>(a.age==null)-(b.age==null)||a.age-b.age,old:(a,b)=>(a.age==null)-(b.age==null)||b.age-a.age,min:(a,b)=>b.mi-a.mi};
  f.sort((a,b)=>srt[S.sort](a,b)||b.val-a.val||b.mi-a.mi||a.name.localeCompare(b.name));
  /* clubs */
  const C=new Map();
  dom.filter(inLg).forEach(p=>{const k=p.lg+'|'+p.club,c=C.get(k)||C.set(k,{club:p.club,lg:p.lg,n:0,pr:0,sum:0,top:null}).get(k);c.n++;if(p.val!=null){c.pr++;c.sum+=p.val;if(!c.top||p.val>c.top.val||(p.val===c.top.val&&(p.mi>c.top.mi||(p.mi===c.top.mi&&p.name.localeCompare(c.top.name)<0))))c.top=p}});
  const cl=[...C.values()].filter(c=>c.pr>0&&c.club&&(!q||c.club.toLowerCase().includes(q))).sort((a,b)=>b.sum-a.sum||a.club.localeCompare(b.club));
  const nAll=dom.filter(inLg).length,nPr=priced.filter(inLg).length;
  const ctl=`<div class="ctl"><label class="dcx-l"><span class="mu">${two('Show','عرض')}</span><select id="prt"><option value="players"${S.tab==='players'?' selected':''}>${ar()?'اللاعبون':'Players'}</option><option value="clubs"${S.tab==='clubs'?' selected':''}>${ar()?'الأندية':'Clubs'}</option></select></label>
    <select id="prl"><option value="">${ar()?'كل الدوريات':'All leagues'}</option>${lgs.map(l=>`<option value="${esc(l.id)}"${S.lg===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select>
    ${S.tab==='players'?`<select id="prp"><option value="">${ar()?'كل المراكز':'All positions'}</option>${Object.keys(POS).map(k=>`<option value="${k}"${S.pos===k?' selected':''}>${POS[k][ar()?1:0]}</option>`).join('')}</select>
    <select id="prk"><option value="">${ar()?'كل الأندية':'All clubs'}</option>${clubs.map(c=>`<option${S.club===c?' selected':''}>${esc(c)}</option>`).join('')}</select>
    <select id="pra"><option value="">${ar()?'كل الأعمار':'All ages'}</option>${[['u21','Up to 21','حتى 21'],['a2225','22 to 25','من 22 إلى 25'],['a2629','26 to 29','من 26 إلى 29'],['a30','30 and over','30 وأكثر']].map(x=>`<option value="${x[0]}"${S.age===x[0]?' selected':''}>${ar()?x[2]:x[1]}</option>`).join('')}</select>
    <select id="prs">${[['val','Order: highest value','الترتيب: الأعلى قيمة'],['young','Order: youngest','الترتيب: الأصغر سنًا'],['old','Order: oldest','الترتيب: الأكبر سنًا'],['min','Order: most minutes','الترتيب: الأكثر دقائق']].map(x=>`<option value="${x[0]}"${S.sort===x[0]?' selected':''}>${ar()?x[2]:x[1]}</option>`).join('')}</select>`:''}
    <input id="prq" type="search" placeholder="${ar()?'ابحث عن لاعب أو نادي':'Search player or club'}" value="${esc(S.q)}"></div>`;
  const body=S.tab==='players'?`<p class="mu pr-n">${two(`${f.length} priced players`,`${nb(f.length)} لاعب بسعر`)}</p>
    <div class="wrap"><table class="lk-t pr-t"><thead><tr><th class="n">#</th><th>${two('Player','اللاعب')}</th><th>${two('Club','النادي')}</th><th>${two('League','الدوري')}</th><th>${two('Pos','المركز')}</th><th class="n">${two('Age','العمر')}</th><th class="n">${two('Minutes','الدقائق')}</th><th class="n">${two('Value','القيمة')}</th></tr></thead><tbody>
    ${f.slice(0,S.n).map((p,i)=>`<tr data-k="${esc(p.key)}"><td class="n mu">${i+1}</td><td><span class="pr-p"><span class="xb-av" style="${typeof clubVars==='function'?clubVars(p.club):''}"><b>${esc(String(p.name||'?').split(/\\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</b>${p.photo?`<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}</span>${nm(p.name)}</span></td><td>${nm(p.club)}</td><td>${nm(lgn(p.lg))}</td><td>${p.pos?two(POS[p.pos][0],POS[p.pos][1]):''}</td><td class="n">${p.age==null?'':p.age}</td><td class="n">${Math.round(p.mi)}</td><td class="n pr-v">${nb(INS.money(p.val))}</td></tr>`).join('')||`<tr><td colspan="8" class="mu">${two('No players for this choice.','ما فيه لاعبين لهذا الاختيار.')}</td></tr>`}</tbody></table></div>
    ${f.length>S.n?`<p><button type="button" id="prm" class="xb-clear">${two('Show more','عرض المزيد')}</button> <span class="mu">${two(`${Math.min(S.n,f.length)} of ${f.length}`,`${nb(Math.min(S.n,f.length))} من ${nb(f.length)}`)}</span></p>`:''}`
   :`<p class="mu pr-n">${two(`${cl.length} clubs with at least one priced player`,`${nb(cl.length)} نادي فيه لاعب واحد على الأقل بسعر`)}</p>
    <div class="wrap"><table class="lk-t pr-c"><thead><tr><th class="n">#</th><th>${two('Club','النادي')}</th><th>${two('League','الدوري')}</th><th class="n">${two('Priced / squad','بسعر / المجموعة')}</th><th class="n">${two('Total','المجموع')}</th><th class="n">${two('Average','المتوسط')}</th><th>${two('Most valuable','الأغلى')}</th></tr></thead><tbody>
    ${cl.map((c,i)=>`<tr data-c="${esc(c.lg+'|'+c.club)}"><td class="n mu">${i+1}</td><td>${nm(c.club)}</td><td>${nm(lgn(c.lg))}</td><td class="n">${nb(c.pr+' / '+c.n)}</td><td class="n pr-v">${nb(tot(c.sum))}</td><td class="n">${nb(INS.money(c.sum/c.pr))}</td><td>${nm(c.top.name)} <span class="mu">${nb(INS.money(c.top.val))}</span></td></tr>`).join('')||`<tr><td colspan="7" class="mu">${two('No clubs for this choice.','ما فيه أندية لهذا الاختيار.')}</td></tr>`}</tbody></table></div>
    <p class="mu ins-note">${two('The total for a club counts only the players that have a price ("priced / squad" shows how many). Clubs whose players are missing from the source (for example newly promoted clubs) are undercounted, so compare clubs with similar "priced / squad" shares.','مجموع النادي يحسب فقط اللاعبين اللي لهم سعر («بسعر / المجموعة» يبيّن كم). الأندية اللي لاعبوها ناقصين في المصدر (مثل الصاعدة حديثًا) مجموعها أقل من الواقع، فقارن الأندية اللي نسبة «بسعر / المجموعة» عندها متقاربة.')}</p>`;
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>What the players are worth.</b> Transfermarkt's market value of each player in the six leagues. ${nb(nPr)} of ${nb(nAll)} players${S.lg?' in this league':''} have a price: the rest could not be matched by name, or are not in the source.`,`<b>كم يسوى اللاعبون.</b> القيمة السوقية من Transfermarkt لكل لاعب في الدوريات الستة. ${nb(nPr)} من ${nb(nAll)} لاعب${S.lg?' في هذا الدوري':''} لهم سعر: والباقي ما انطبقوا بالاسم، أو مو موجودين في المصدر.`)}</p>
    <p class="mu pr-tm">${INS.tmNote(P)}</p></div><div class="card">${ctl}${body}</div>`;
  const g=id=>root.querySelector(id),re=()=>draw(root,P,dom,priced,lgs);
  g('#prt').onchange=e=>{S.tab=e.target.value;S.n=PAGE;re()};g('#prl').onchange=e=>{S.lg=e.target.value;S.n=PAGE;re()};
  let t=null;g('#prq').oninput=e=>{S.q=e.target.value;S.n=PAGE;clearTimeout(t);t=setTimeout(()=>{re();const n=root.querySelector('#prq');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},180)};
  if(S.tab==='players'){g('#prp').onchange=e=>{S.pos=e.target.value;S.n=PAGE;re()};g('#prk').onchange=e=>{S.club=e.target.value;S.n=PAGE;re()};g('#pra').onchange=e=>{S.age=e.target.value;S.n=PAGE;re()};g('#prs').onchange=e=>{S.sort=e.target.value;S.n=PAGE;re()};
   const m=g('#prm');if(m)m.onclick=()=>{S.n+=PAGE;re()}}
 }
 INS.ar({'Player prices':'أسعار اللاعبين'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
