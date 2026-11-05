/* ===== Guess the player (#/guess, in the Home hub after Wrapped): one player a day, found from his season numbers =====
   The puzzle of the day is one player of the six domestic leagues, the same for everyone on the same UTC date: the candidates are the 250 most valuable players by
   Transfermarkt's value (data/tm.json, a file that is not updated any more, so the list does not move during the day; without that file, the 250 with most minutes this season,
   and the answer is then kept in this browser for the day), sorted by value then id; the answer is the one at the index drawn by a generator seeded with the date
   (INS.eloKit.rng('guess|<date>')). Value is only a stand-in for "known": a less famous player can come up. The page shows his season numbers from the league's player rows (minutes,
   goals, assists, shots, key passes, tackles and interceptions, per-90 figures from the same rows), then one more clue after each wrong guess: position and age, league, nationality
   (from the photos file, when it has one), club. Six guesses. A name typed in the box is matched against every player of the pool (accents and case ignored) and picked from a
   list; the same player cannot be guessed twice. The result is kept in this browser (plx_gp), with the streak of days won in a row; "Share" copies a short result with squares and no
   names. "Play another" gives a random player, outside the streak. Nothing is sent anywhere. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('guess','Guess the player','home','wrapped');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const N=250,MAXG=6;
 const POS={GK:['Goalkeeper','حارس'],DF:['Defender','مدافع'],MF:['Midfielder','لاعب وسط'],FW:['Forward','مهاجم']};
 const S={tok:0,mode:'daily',date:'',st:null,q:'',pr:null};
 const today=()=>new Date().toISOString().slice(0,10);
 const fold=s=>String(s||'').toLowerCase().replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/ß/g,'ss').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
 const store={get(){try{return JSON.parse(localStorage.getItem('plx_gp')||'null')||{days:{}}}catch(e){return {days:{}}}},set(v){try{localStorage.setItem('plx_gp',JSON.stringify(v))}catch(e){}}};
 /* the day before an ISO date */
 const prev=d=>new Date(Date.parse(d+'T00:00:00Z')-864e5).toISOString().slice(0,10);
 function streak(days,upto){let n=0,d=upto;if(!(days[d]&&days[d].won))d=prev(d);while(days[d]&&days[d].won){n++;d=prev(d)}return n}
 function best(days){const ds=Object.keys(days).filter(d=>days[d].won).sort();let b=0,run=0,last=null;for(const d of ds){run=last&&prev(d)===last?run+1:1;last=d;b=Math.max(b,run)}return b}
 /* the candidates and the answer */
 function candidates(P){
  const dom=uniq(P);
  const priced=dom.filter(p=>p.val!=null);
  if(priced.length>=N)return {list:priced.sort((a,b)=>b.val-a.val||(a.id<b.id?-1:1)).slice(0,N),stable:true};
  return {list:dom.slice().sort((a,b)=>b.mi-a.mi||(a.id<b.id?-1:1)).slice(0,N),stable:false};
 }
 /* one entry per player id (a player who changed league in the season is in two files): the one with more minutes; the World Cup is left out */
 function uniq(P){if(P._u)return P._u;const m=new Map();for(const p of P.all){if(/world cup/i.test(p.lgn))continue;const q=m.get(p.id);if(!q||p.mi>q.mi||(p.mi===q.mi&&p.key<q.key))m.set(p.id,p)}return P._u=[...m.values()]}
 function answerFor(P,date){const c=candidates(P),r=INS.eloKit.rng('guess|'+date);return {p:c.list[Math.floor(r()*c.list.length)],stable:c.stable}}
 let POOL=null,PK='';
 function loadPool(){
  if(POOL&&PK===INS.poolKey())return POOL;
  PK=INS.poolKey();const p=Promise.resolve().then(()=>{if(typeof INS.playerPool!=='function')throw new Error('pool');return INS.playerPool()}).then(d=>{if(!d||!d.all||!d.all.length)throw new Error('empty');return d}).catch(e=>{if(POOL===p)POOL=null;throw e});
  POOL=p;return p;
 }
 /* the answer's numbers from his league's player rows */
 async function numbers(p){
  const o=await INS.poolOne(p.lg,['pl']);if(!o||!o.pl)throw new Error('pl');
  const ix={};o.pl.cols.forEach((c,i)=>ix[c]=i);const t={mi:0,gl:0,ast:0,sh:0,kp:0,tk:0,ic:0,m:0};
  for(const r of o.pl.rows){if(r[ix.i]!==p.id)continue;const mi=r[ix.mi];if(!mi)continue;t.m++;t.mi+=mi;for(const k of ['gl','ast','sh','kp','tk','ic'])t[k]+=r[ix[k]]||0}
  return t;
 }
 R.guess=async function(el){
  el.innerHTML='<h2>Guess the player</h2><div id="gproot" class="ins lk gp"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#gproot'),tok=++S.tok;
  let P;try{P=await loadPool()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The players are not available right now.','اللاعبين مو متوفرين الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok)return;
  S.mode='daily';S.date=today();S.q='';
  await start(root,P,tok);
 };
 async function start(root,P,tok){
  let a,stable=true;
  if(S.mode==='daily'){
   const st=store.get(),saved=st.days[S.date];const r=answerFor(P,S.date);stable=r.stable;a=r.p;
   if(!stable&&saved&&saved.a&&P.by.has(saved.a))a=P.by.get(saved.a);   /* without values the list can move: the day's answer is kept */
   S.st={a,g:saved&&Array.isArray(saved.g)?saved.g.filter(k=>P.by.has(k)):[],done:!!(saved&&saved.done),won:!!(saved&&saved.won)};
   if(saved&&saved.done&&!saved.won&&S.st.g.length<MAXG)S.st.done=true;
  }else{
   const c=candidates(P).list;a=c[Math.floor(Math.random()*c.length)];S.st={a,g:[],done:false,won:false};
  }
  let nums;try{nums=await numbers(a)}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The player numbers are not available right now.','أرقام اللاعب مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok)return;
  S.nums=nums;S.pool=P;S.stable=stable;draw(root,P);
 }
 const guessesLeft=()=>MAXG-S.st.g.length;
 function persist(){
  if(S.mode!=='daily')return;
  const st=store.get();st.days[S.date]={g:S.st.g,done:S.st.done,won:S.st.won,a:S.st.a.key};
  const ks=Object.keys(st.days).sort();while(ks.length>400)delete st.days[ks.shift()];
  store.set(st);
 }
 const f1=x=>(+x).toFixed(1),f2=x=>(+x).toFixed(2);
 function clues(P){
  const a=S.st.a,t=S.nums,n90=t.mi/90,per=v=>n90>0?f2(v/n90):'–',k=Math.min(S.st.done?6:S.st.g.length+1,6),out=[];
  out.push({k:1,h:two('Season numbers','أرقام الموسم'),b:two(`${t.mi} minutes in ${t.m} matches · <b>${t.gl}</b> goals · <b>${t.ast}</b> assists`,`${nb(t.mi)} دقيقة في ${nb(t.m)} مباراة · <b>${nb(t.gl)}</b> هدف · <b>${nb(t.ast)}</b> صناعة`)});
  out.push({k:2,h:two('Per 90 minutes','لكل 90 دقيقة'),b:two(`Shots ${per(t.sh)} · key passes ${per(t.kp)} · tackles + interceptions ${per(t.tk+t.ic)}`,`تسديدات ${nb(per(t.sh))} · تمريرات مفتاحية ${nb(per(t.kp))} · تدخلات + قطع ${nb(per(t.tk+t.ic))}`)});
  out.push({k:3,h:two('Position and age','المركز والعمر'),b:two(`${POS[a.pos]?POS[a.pos][0]:'Position unknown'}${a.age!=null?' · '+a.age+' years':''}`,`${POS[a.pos]?POS[a.pos][1]:'المركز غير معروف'}${a.age!=null?' · '+nb(a.age)+' سنة':''}`)});
  out.push({k:4,h:two('League','الدوري'),b:nm(a.lgn)});
  out.push({k:5,h:two('Nationality','الجنسية'),b:a.nat?nm(a.nat):two('Not known in the data','مو معروفة في البيانات')});
  out.push({k:6,h:two('Club','النادي'),b:nm(a.club||'?')});
  return out.map(c=>({...c,shown:c.k<=k}));
 }
 function sug(P){
  const q=fold(S.q);if(q.length<2)return [];
  const taken=new Set(S.st.g.map(k=>P.by.get(k).id)),out=[];
  for(const p of uniq(P)){if(taken.has(p.id))continue;if(fold(p.name).includes(q))out.push(p);if(out.length>=60)break}
  return out.sort((a,b)=>(fold(a.name).startsWith(q)?0:1)-(fold(b.name).startsWith(q)?0:1)||b.mi-a.mi||(a.key<b.key?-1:1)).slice(0,8);
 }
 const isA=(P,k)=>P.by.get(k).id===S.st.a.id;
 const sq=()=>S.st.g.map(k=>isA(S.pool,k)?'🟩':'🟥').join('');
 function shareText(){return `PL Analytics · Guess the player ${S.mode==='daily'?S.date:''}\n${S.st.won?S.st.g.length:'X'}/${MAXG} ${sq()}`.replace('  ',' ')}
 function draw(root,P){
  const a=S.st.a,st=store.get(),sk=streak(st.days,S.date),bk=best(st.days),cl=clues(P),done=S.st.done;
  const list=done?[]:sug(P);
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>One player a day.</b> The board starts with his season numbers. Each wrong guess opens a new clue. You have six guesses; the player is the same for everyone today.','<b>لاعب واحد كل يوم.</b> اللوحة تبدأ بأرقامه في الموسم. كل تخمين غلط يفتح تلميح جديد. عندك ست محاولات، واللاعب نفسه للكل اليوم.')}</p></div>
   <div class="card gp-b" id="gpb"><div class="gp-h"><span class="gp-d">${S.mode==='daily'?two('Today','اليوم')+' '+nb(esc(S.date)):two('Practice','تدريب')}</span><span class="gp-st">${S.mode==='daily'?two(`Streak <b>${sk}</b> · best <b>${bk}</b>`,`السلسلة <b>${nb(sk)}</b> · الأفضل <b>${nb(bk)}</b>`):''}</span></div>
    <ol class="gp-cl">${cl.map(c=>`<li class="gp-c${c.shown?' on':''}" data-k="${c.k}">${c.shown?`<b>${c.h}</b><span>${c.b}</span>`:`<span class="mu">${two('Clue '+c.k+' (locked)','التلميح '+nb(c.k)+' (مقفل)')}</span>`}</li>`).join('')}</ol>
    ${S.st.g.length?`<div class="gp-gs" id="gpgs">${S.st.g.map((k,i)=>{const p=P.by.get(k),right=isA(P,k);return `<span class="gp-g ${right?'ok':'no'}" data-k="${esc(k)}">${i+1}. ${nm(p?p.name:'?')} <i>${right?'✓':'✗'}</i></span>`}).join('')}</div>`:''}
    ${done?'':`<div class="gp-in"><input id="gpq" type="search" autocomplete="off" placeholder="${ar()?'اكتب اسم لاعب (بالإنجليزي)':'Type a player\'s name'}" value="${esc(S.q)}" aria-label="${ar()?'اسم اللاعب':'Player name'}"><ul class="gp-sg" id="gpsg" role="listbox">${list.map(p=>`<li><button type="button" class="gp-sb" data-k="${esc(p.key)}">${nm(p.name)} <span class="mu">${nm(p.club)} · ${nm(p.lgn)}</span></button></li>`).join('')}</ul>
     <p class="mu gp-l">${two(`${guessesLeft()} ${guessesLeft()===1?'guess':'guesses'} left`,`باقي ${nb(guessesLeft())} ${guessesLeft()===1?'محاولة':'محاولات'}`)}</p></div>`}
    ${done?`<div class="gp-end" id="gpend" data-won="${S.st.won?1:0}"><h3>${S.st.won?two(`Yes! It is ${esc(a.name)}`,`صح! هو ${nm(a.name)}`):two(`It was ${esc(a.name)}`,`كان ${nm(a.name)}`)}</h3>
     <p class="mu">${nm(a.club||'?')} · ${nm(a.lgn)}${a.age!=null?' · '+nb(a.age):''}</p>
     <p class="gp-sq" id="gpsq">${S.st.won?two(`Found in ${S.st.g.length} of ${MAXG}`,`لقيته من ${nb(S.st.g.length)} من ${nb(MAXG)}`):two('Not found in six guesses','ما انلقى في ست محاولات')} ${sq()}</p>
     <div class="gp-ac"><button type="button" class="gp-sh" id="gpsh">${two('Copy result','انسخ النتيجة')}</button><button type="button" class="s gp-pl" id="gppl">${two('Play another','العب لاعب ثاني')}</button>${S.mode==='practice'?`<button type="button" class="s" id="gpbk">${two('Back to today','ارجع لليوم')}</button>`:''}</div></div>`:''}
    <p class="mu ins-note">${two(`The player is one of the ${N} most valuable of the six leagues by Transfermarkt's value${S.stable?'':' (no value file here: the 250 with most minutes)'}: value is only a stand-in for "known", so a less famous player can come up. Season numbers are this season's, from PitchAPI. Your results stay in this browser.`,`اللاعب واحد من أغلى ${nb(N)} لاعب في الدوريات الستة حسب قيمة ${nb('Transfermarkt')}${S.stable?'':' (ما فيه ملف قيم هنا: الـ'+nb(250)+' الأكثر دقائق)'}: القيمة بس بديل لـ«مشهور»، فممكن يطلع لاعب أقل شهرة. أرقام الموسم من ${nb('PitchAPI')} للموسم الحالي. نتائجك تبقى في هذا المتصفح.`)}</p></div>`;
  const q=s=>root.querySelector(s);
  const inp=q('#gpq');
  if(inp){inp.oninput=()=>{S.q=inp.value;const L=sug(P);q('#gpsg').innerHTML=L.map(p=>`<li><button type="button" class="gp-sb" data-k="${esc(p.key)}">${nm(p.name)} <span class="mu">${nm(p.club)} · ${nm(p.lgn)}</span></button></li>`).join('');wire()};
   inp.onkeydown=e=>{if(e.key==='Enter'){const b=q('.gp-sb');if(b)b.click()}}}
  const wire=()=>root.querySelectorAll('.gp-sb').forEach(b=>b.onclick=()=>guess(root,P,b.dataset.k));
  wire();
  const sh=q('#gpsh');if(sh)sh.onclick=async()=>{const t=shareText();try{if(navigator.share)await navigator.share({text:t});else await navigator.clipboard.writeText(t);sh.innerHTML=two('Copied','تم النسخ')}catch(e){try{await navigator.clipboard.writeText(t);sh.innerHTML=two('Copied','تم النسخ')}catch(x){sh.innerHTML=two('Could not copy','ما اننسخ')}}setTimeout(()=>{if(sh.isConnected)sh.innerHTML=two('Copy result','انسخ النتيجة')},1600)};
  const pl=q('#gppl');if(pl)pl.onclick=()=>{S.mode='practice';S.q='';start(root,P,++S.tok)};
  const bb=q('#gpbk');if(bb)bb.onclick=()=>{S.mode='daily';S.q='';start(root,P,++S.tok)};
 }
 async function guess(root,P,k){
  if(S.st.done||!P.by.has(k)||S.st.g.some(x=>P.by.get(x).id===P.by.get(k).id))return;
  S.st.g.push(k);S.q='';
  if(isA(P,k)){S.st.done=true;S.st.won=true}else if(S.st.g.length>=MAXG){S.st.done=true;S.st.won=false}
  persist();draw(root,P);
  const i=root.querySelector('#gpq');if(i)i.focus({preventScroll:true});
 }
 INS.guess={answerFor,candidates,streak,best,shareText:()=>shareText(),state:()=>S.st};
 INS.ar({'Guess the player':'خمّن اللاعب'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
