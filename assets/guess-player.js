/* ===== Guess the player (#/guess, in the Home hub after Wrapped): one player a day, found from his season numbers =====
   The puzzle of the day is one player of the six domestic leagues, the same for everyone on the same UTC date: the candidates are the 250 most valuable players by
   Transfermarkt's value (data/tm.json, a file that is not updated any more, so the list does not move during the day; without that file, the 250 with most minutes this season,
   and the answer is then kept in this browser for the day), sorted by value then id; the answer is the one at the index drawn by a generator seeded with the date
   (INS.eloKit.rng('guess|<date>')). Value is only a stand-in for "known": a less famous player can come up. The page shows his season numbers from the league's player rows (minutes,
   goals, assists), then more clues as the guesses go: per-90 shots, key passes and tackles, how he plays (progressive passes, take-ons, aerials, clearances, share of actions in the
   opponent's half), starts against substitute appearances and his usual shirt number (line-ups), goals against xG, PitchAPI ratings (average, best, worst), position and age, the
   month, weekday and star sign of his birthday (Transfermarkt's date of birth), league, nationality, a band for his market value, club and the shape of his name. A clue whose data is
   missing is left out. The clues open in steps, so that all of them are open at the last guess (ceil(clues x guesses so far / 6)). Six guesses. A name typed in the box is matched against every player of the pool (accents and case ignored; Arabic letters by sound, INS.nameSound) and picked from a
   list, or, for someone who does not know names, picked with three steps (league, club, then the club's players); the same player cannot be guessed twice. The result is kept in this browser (plx_gp), with the streak of days won in a row; "Share" copies a short result with squares and no
   names. "Play another" gives a random player, outside the streak. Nothing is sent anywhere. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('guess','Guess the player','home','wrapped');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const N=250,MAXG=6;
 const POS={GK:['Goalkeeper','حارس'],DF:['Defender','مدافع'],MF:['Midfielder','لاعب وسط'],FW:['Forward','مهاجم']};
 const S={tok:0,mode:'daily',date:'',st:null,q:'',pr:null,ui:'type',lg:'',cl:''};
 /* how to pick: type a name, or league -> club -> player (kept in this browser) */
 const uiGet=()=>{try{return localStorage.getItem('plx_gp_ui')==='list'?'list':'type'}catch(e){return 'type'}};
 const uiSet=v=>{try{localStorage.setItem('plx_gp_ui',v)}catch(e){}};
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
 /* the answer's numbers from his league's player rows, line-ups and ratings (the last two are optional: a clue without its data is left out) */
 async function numbers(p){
  let o;try{o=await INS.poolOne(p.lg,['pl','mx'])}catch(e){o=null}
  if(!o||!o.pl){o=await INS.poolOne(p.lg,['pl']);if(!o||!o.pl)throw new Error('pl')}
  const ix={};o.pl.cols.forEach((c,i)=>ix[c]=i);
  const t={mi:0,gl:0,ast:0,sh:0,kp:0,tk:0,ic:0,m:0,pr:0,tkw:0,aerw:0,cl:0,xg:0,act:0,aco:0,st:0,sb:0,sh_:{},rt:[]};
  const M=(o.mx&&o.mx.m)||{},lineups=new Set(),start=new Set();
  for(const mid in M){const lu=M[mid].lu||{};let got=false;for(const side of ['h','a'])for(const x of ((lu[side]||{}).xi)||[]){got=true;start.add(mid+'|'+x[0]);if(x[0]===p.id&&x[2]!=null&&x[2]!=='')t.sh_[x[2]]=(t.sh_[x[2]]||0)+1}if(got)lineups.add(mid)}
  const mids=[];
  for(const r of o.pl.rows){if(r[ix.i]!==p.id)continue;const mi=r[ix.mi];if(!mi)continue;t.m++;t.mi+=mi;mids.push(r[ix.m]);
   for(const k of ['gl','ast','sh','kp','tk','ic','pr','tkw','aerw','cl','xg','act','aco'])t[k]+=r[ix[k]]||0;
   if(lineups.has(r[ix.m])){if(start.has(r[ix.m]+'|'+p.id))t.st++;else t.sb++}}
  let rt=null;try{const l=(typeof ALL==='object'&&ALL.leagues||[]).find(x=>x.id===p.lg);if(l&&l.rt_file)rt=await loadJson(l.rt_file,l.rt_v)}catch(e){rt=null}
  if(rt&&rt.m)for(const mid of mids){const v=rt.m[mid]&&rt.m[mid][p.id];if(v!=null)t.rt.push(+v)}
  return t;
 }
 R.guess=async function(el){
  el.innerHTML='<h2>Guess the player</h2><div id="gproot" class="ins lk gp"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#gproot'),tok=++S.tok;
  let P;try{P=await loadPool()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The players are not available right now.','اللاعبين مو متوفرين الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok)return;
  S.mode='daily';S.date=today();S.q='';S.ui=uiGet();S.lg='';S.cl='';
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
 const MONTH=[['January','يناير'],['February','فبراير'],['March','مارس'],['April','أبريل'],['May','مايو'],['June','يونيو'],['July','يوليو'],['August','أغسطس'],['September','سبتمبر'],['October','أكتوبر'],['November','نوفمبر'],['December','ديسمبر']];
 const DAY=[['Sunday','الأحد'],['Monday','الإثنين'],['Tuesday','الثلاثاء'],['Wednesday','الأربعاء'],['Thursday','الخميس'],['Friday','الجمعة'],['Saturday','السبت']];
 /* [last day of the sign as month*100+day, name] */
 const SIGN=[[119,'Capricorn','الجدي'],[218,'Aquarius','الدلو'],[320,'Pisces','الحوت'],[419,'Aries','الحمل'],[520,'Taurus','الثور'],[620,'Gemini','الجوزاء'],[722,'Cancer','السرطان'],[822,'Leo','الأسد'],[922,'Virgo','العذراء'],[1022,'Libra','الميزان'],[1121,'Scorpio','العقرب'],[1221,'Sagittarius','القوس'],[1231,'Capricorn','الجدي']];
 const sign=(m,d)=>SIGN.find(x=>m*100+d<=x[0]);
 /* market value bands in millions of euros */
 const BANDS=[1,5,10,20,35,50,75,100];
 function band(v){let i=0;while(i<BANDS.length&&v>=BANDS[i]*1e6)i++;return i===0?[null,BANDS[0]]:i===BANDS.length?[BANDS[i-1],null]:[BANDS[i-1],BANDS[i]]}
 /* the clues, from the ones that point least to the ones that give him away; the number open grows with the wrong guesses so that all are open at the last one */
 function clues(P){
  const a=S.st.a,t=S.nums,n90=t.mi/90,per=v=>n90>0?f2(v/n90):'–',out=[];
  const add=(id,h,b)=>out.push({id,h,b});
  add('season',two('Season numbers','أرقام الموسم'),two(`${t.mi} minutes in ${t.m} matches · <b>${t.gl}</b> goals · <b>${t.ast}</b> assists`,`${nb(t.mi)} دقيقة في ${nb(t.m)} مباراة · <b>${nb(t.gl)}</b> هدف · <b>${nb(t.ast)}</b> صناعة`));
  add('p90',two('Per 90 minutes','لكل 90 دقيقة'),two(`Shots ${per(t.sh)} · key passes ${per(t.kp)} · tackles + interceptions ${per(t.tk+t.ic)}`,`تسديدات ${nb(per(t.sh))} · تمريرات مفتاحية ${nb(per(t.kp))} · تدخلات + قطع ${nb(per(t.tk+t.ic))}`));
  if(t.act>0&&n90>0)add('style',two('How he plays','كيف يلعب'),two(`Per 90: progressive passes ${per(t.pr)} · take-ons won ${per(t.tkw)} · aerials won ${per(t.aerw)} · clearances ${per(t.cl)} · <b>${Math.round(100*t.aco/t.act)}%</b> of his actions in the opponent's half`,`لكل ${nb(90)} دقيقة: تمريرات تقدّمية ${nb(per(t.pr))} · مراوغات ناجحة ${nb(per(t.tkw))} · كرات هوائية ربحها ${nb(per(t.aerw))} · تشتيت ${nb(per(t.cl))} · <b>${nb(Math.round(100*t.aco/t.act))}%</b> من أفعاله في نصف الخصم`));
  if(t.st+t.sb>=3){const top=Object.entries(t.sh_).sort((x,y)=>y[1]-x[1]||(x[0]<y[0]?-1:1))[0];
   add('starts',two('Starter or substitute?','أساسي ولا احتياط؟'),two(`Started <b>${t.st}</b> and came off the bench <b>${t.sb}</b> times${top?` · usually wears number <b>${esc(top[0])}</b>`:''}`,`بدأ أساسي <b>${nb(t.st)}</b> مرة ودخل من الاحتياط <b>${nb(t.sb)}</b> مرة${top?` · غالباً يلبس رقم <b>${nb(esc(top[0]))}</b>`:''}`))}
  if(t.xg>0){const d=t.gl-t.xg;add('luck',two('Luck in front of goal','الحظ أمام المرمى'),two(`Chances worth ${f1(t.xg)} xG, <b>${t.gl}</b> goals scored (${d>=0?'+':'−'}${f1(Math.abs(d))})`,`فرص قيمتها ${nb(f1(t.xg))} xG، سجّل <b>${nb(t.gl)}</b> هدف (${nb((d>=0?'+':'−')+f1(Math.abs(d)))})`))}
  if(t.rt.length>=3){const avg=t.rt.reduce((x,y)=>x+y,0)/t.rt.length;
   add('rating',two('Match ratings','تقييمات المباريات'),two(`Average <b>${f2(avg)}</b> over ${t.rt.length} rated matches · best ${f1(Math.max(...t.rt))} · worst ${f1(Math.min(...t.rt))}`,`المتوسط <b>${nb(f2(avg))}</b> في ${nb(t.rt.length)} مباراة مقيّمة · الأفضل ${nb(f1(Math.max(...t.rt)))} · الأسوأ ${nb(f1(Math.min(...t.rt)))}`))}
  add('posage',two('Position and age','المركز والعمر'),two(`${POS[a.pos]?POS[a.pos][0]:'Position unknown'}${a.age!=null?' · '+a.age+' years':''}`,`${POS[a.pos]?POS[a.pos][1]:'المركز غير معروف'}${a.age!=null?' · '+nb(a.age)+' سنة':''}`));
  if(a.dob&&/^\d{4}-\d\d-\d\d$/.test(a.dob)){const [y,m,d]=a.dob.split('-').map(Number),wd=new Date(Date.UTC(y,m-1,d)).getUTCDay(),sg=sign(m,d);
   add('born',two('His birthday','عيد ميلاده'),two(`Born in ${MONTH[m-1][0]}, on a ${DAY[wd][0]} · star sign ${sg[1]}`,`مولود في ${MONTH[m-1][1]}، يوم ${DAY[wd][1]} · برجه ${sg[2]}`))}
  add('league',two('League','الدوري'),nm(a.lgn));
  add('nat',two('Nationality','الجنسية'),a.nat?nm(a.nat):two('Not known in the data','مو معروفة في البيانات'));
  if(a.val!=null){const [lo,hi]=band(a.val),r=x=>'€'+x+'m';
   add('value',two('Market value','القيمة السوقية'),two(lo==null?`Under ${r(hi)}`:hi==null?`${r(lo)} or more`:`Between ${r(lo)} and ${r(hi)}`,lo==null?`أقل من ${nb(r(hi))}`:hi==null?`${nb(r(lo))} أو أكثر`:`بين ${nb(r(lo))} و${nb(r(hi))}`))}
  add('club',two('Club','النادي'),nm(a.club||'?'));
  {const w=fold(a.name).split(' ').filter(Boolean),L=w.join('').length;
   add('name',two('His name','اسمه'),two(`${w.length} ${w.length===1?'word':'words'}, ${L} letters, starts with <b>${esc((w[0]||'?')[0].toUpperCase())}</b>`,`${nb(w.length)} ${w.length===1?'كلمة':'كلمات'}، ${nb(L)} حرف، يبدأ بحرف <b>${nb(esc((w[0]||'?')[0].toUpperCase()))}</b>`))}
  const tot=out.length,open=S.st.done?tot:Math.min(tot,Math.ceil(tot*(S.st.g.length+1)/MAXG));
  return out.map((c,i)=>({...c,k:i+1,shown:i<open}));
 }
 function sug(P){
  const taken=new Set(S.st.g.map(k=>P.by.get(k).id)),out=[];
  /* a name typed in Arabic letters is matched by sound (INS.nameSound), nearest first */
  if(INS.nameSound&&INS.nameSound.isArabic(S.q))return INS.nameSound.search(S.q,uniq(P).filter(p=>!taken.has(p.id)),p=>p.name,(a,b)=>b.mi-a.mi||(a.key<b.key?-1:1),2).slice(0,8);
  const q=fold(S.q);if(q.length<2)return [];
  for(const p of uniq(P)){if(taken.has(p.id))continue;if(fold(p.name).includes(q))out.push(p);if(out.length>=60)break}
  return out.sort((a,b)=>(fold(a.name).startsWith(q)?0:1)-(fold(b.name).startsWith(q)?0:1)||b.mi-a.mi||(a.key<b.key?-1:1)).slice(0,8);
 }
 /* easy mode: the leagues, the clubs of a league and the players of a club, from the same pool (one entry per player id) */
 const leaguesOf=P=>{const m=new Map();for(const p of uniq(P))if(!m.has(p.lg))m.set(p.lg,p.lgn);return [...m].map(([id,name])=>({id,name}))};
 const clubsOf=(P,lg)=>[...new Set(uniq(P).filter(p=>p.lg===lg&&p.club).map(p=>p.club))].sort((a,b)=>a.localeCompare(b));
 function squad(P){if(!S.lg||!S.cl)return [];const taken=new Set(S.st.g.map(k=>P.by.get(k).id));return uniq(P).filter(p=>p.lg===S.lg&&p.club===S.cl&&!taken.has(p.id)).sort((a,b)=>b.mi-a.mi||(a.key<b.key?-1:1))}
 const pbtn=(p,extra)=>`<li><button type="button" class="gp-sb" data-k="${esc(p.key)}">${nm(p.name)} <span class="mu">${extra}</span></button></li>`;
 const sbtn=p=>pbtn(p,`${nm(p.club)} · ${nm(p.lgn)}`);
 const lbtn=p=>pbtn(p,`${POS[p.pos]?two(POS[p.pos][0],POS[p.pos][1]):''}${p.age!=null?' · '+nb(p.age):''} · ${nb(p.mi)}′`);
 const isA=(P,k)=>P.by.get(k).id===S.st.a.id;
 const sq=()=>S.st.g.map(k=>isA(S.pool,k)?'🟩':'🟥').join('');
 function shareText(){return `PL Analytics · Guess the player ${S.mode==='daily'?S.date:''}\n${S.st.won?S.st.g.length:'X'}/${MAXG} ${sq()}`.replace('  ',' ')}
 /* easy mode: a league, then a club, then the club's players */
 function pickHtml(P){
  const L=leaguesOf(P);if(S.lg&&!L.some(x=>x.id===S.lg))S.lg='';
  const C=S.lg?clubsOf(P,S.lg):[];if(S.cl&&!C.includes(S.cl))S.cl='';
  const sq=squad(P);
  return `<div class="gp-pk"><label><span class="mu">${two('1. League','١. الدوري')}</span><select id="gpl"><option value="">${ar()?'اختر الدوري':'Choose a league'}</option>${L.map(l=>`<option value="${esc(l.id)}"${S.lg===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
   <label><span class="mu">${two('2. Club','٢. النادي')}</span><select id="gpc"${S.lg?'':' disabled'}><option value="">${ar()?'اختر النادي':'Choose a club'}</option>${C.map(c=>`<option${S.cl===c?' selected':''}>${esc(c)}</option>`).join('')}</select></label></div>
   <p class="mu gp-hint">${S.cl?two('3. Tap the player you think it is (the most played first).','٣. اضغط اللاعب اللي تتوقعه (الأكثر لعباً أولاً).'):S.lg?two('Now choose a club.','الحين اختر النادي.'):two('Start by choosing a league.','ابدأ باختيار الدوري.')}</p>
   <ul class="gp-sg gp-sq2" id="gpsg" role="listbox">${sq.map(lbtn).join('')}</ul>`;
 }
 function draw(root,P){
  const a=S.st.a,st=store.get(),sk=streak(st.days,S.date),bk=best(st.days),cl=clues(P),done=S.st.done;
  const list=done||S.ui==='list'?[]:sug(P);
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>One player a day.</b> The board starts with his season numbers. Each wrong guess opens a new clue. You have six guesses; the player is the same for everyone today.','<b>لاعب واحد كل يوم.</b> اللوحة تبدأ بأرقامه في الموسم. كل تخمين غلط يفتح تلميح جديد. عندك ست محاولات، واللاعب نفسه للكل اليوم.')}</p></div>
   <div class="card gp-b" id="gpb"><div class="gp-h"><span class="gp-d">${S.mode==='daily'?two('Today','اليوم')+' '+nb(esc(S.date)):two('Practice','تدريب')}</span><span class="gp-st">${S.mode==='daily'?two(`Streak <b>${sk}</b> · best <b>${bk}</b>`,`السلسلة <b>${nb(sk)}</b> · الأفضل <b>${nb(bk)}</b>`):''}</span></div>
    <ol class="gp-cl">${cl.map(c=>`<li class="gp-c${c.shown?' on':''}" data-k="${c.k}" data-c="${c.id}">${c.shown?`<b>${c.h}</b><span>${c.b}</span>`:`<span class="mu">${two('Clue '+c.k+' (locked)','التلميح '+nb(c.k)+' (مقفل)')}</span>`}</li>`).join('')}</ol>
    ${S.st.g.length?`<div class="gp-gs" id="gpgs">${S.st.g.map((k,i)=>{const p=P.by.get(k),right=isA(P,k);return `<span class="gp-g ${right?'ok':'no'}" data-k="${esc(k)}">${i+1}. ${nm(p?p.name:'?')} <i>${right?'✓':'✗'}</i></span>`}).join('')}</div>`:''}
    ${done?'':`<div class="gp-in"><div class="seg gp-ui" id="gpui" role="group" aria-label="${ar()?'طريقة الاختيار':'How to pick'}">${[['type','Type a name','اكتب الاسم'],['list','Pick from a list','اختر من قائمة']].map(([k,e,r])=>`<button type="button" data-k="${k}" aria-pressed="${S.ui===k}" class="${S.ui===k?'on':''}">${two(e,r)}</button>`).join('')}</div>
     ${S.ui==='list'?pickHtml(P):`<input id="gpq" type="search" autocomplete="off" placeholder="${ar()?'اكتب اسم لاعب (عربي أو إنجليزي)':'Type a player\'s name'}" value="${esc(S.q)}" aria-label="${ar()?'اسم اللاعب':'Player name'}"><ul class="gp-sg" id="gpsg" role="listbox">${list.map(sbtn).join('')}</ul>`}
     <p class="mu gp-l">${two(`${guessesLeft()} ${guessesLeft()===1?'guess':'guesses'} left`,`باقي ${nb(guessesLeft())} ${guessesLeft()===1?'محاولة':'محاولات'}`)}</p></div>`}
    ${done?`<div class="gp-end" id="gpend" data-won="${S.st.won?1:0}"><h3>${S.st.won?two(`Yes! It is ${esc(a.name)}`,`صح! هو ${nm(a.name)}`):two(`It was ${esc(a.name)}`,`كان ${nm(a.name)}`)}</h3>
     <p class="mu">${nm(a.club||'?')} · ${nm(a.lgn)}${a.age!=null?' · '+nb(a.age):''}</p>
     <p class="gp-sq" id="gpsq">${S.st.won?two(`Found in ${S.st.g.length} of ${MAXG}`,`لقيته من ${nb(S.st.g.length)} من ${nb(MAXG)}`):two('Not found in six guesses','ما انلقى في ست محاولات')} ${sq()}</p>
     <div class="gp-ac"><button type="button" class="gp-sh" id="gpsh">${two('Copy result','انسخ النتيجة')}</button><button type="button" class="s gp-pl" id="gppl">${two('Play another','العب لاعب ثاني')}</button>${S.mode==='practice'?`<button type="button" class="s" id="gpbk">${two('Back to today','ارجع لليوم')}</button>`:''}</div></div>`:''}
    <p class="mu ins-note">${two(`The player is one of the ${N} most valuable of the six leagues by Transfermarkt's value${S.stable?'':' (no value file here: the 250 with most minutes)'}: value is only a stand-in for "known", so a less famous player can come up. Season numbers are this season's, from PitchAPI. Your results stay in this browser.`,`اللاعب واحد من أغلى ${nb(N)} لاعب في الدوريات الستة حسب قيمة ${nb('Transfermarkt')}${S.stable?'':' (ما فيه ملف قيم هنا: الـ'+nb(250)+' الأكثر دقائق)'}: القيمة بس بديل لـ«مشهور»، فممكن يطلع لاعب أقل شهرة. أرقام الموسم من ${nb('PitchAPI')} للموسم الحالي. نتائجك تبقى في هذا المتصفح.`)}</p></div>`;
  const q=s=>root.querySelector(s);
  const inp=q('#gpq');
  if(inp){inp.oninput=()=>{S.q=inp.value;const L=sug(P);q('#gpsg').innerHTML=L.map(sbtn).join('');wire()};
   inp.onkeydown=e=>{if(e.key==='Enter'){const b=q('.gp-sb');if(b)b.click()}}}
  const wire=()=>root.querySelectorAll('.gp-sb').forEach(b=>b.onclick=()=>guess(root,P,b.dataset.k));
  wire();
  root.querySelectorAll('#gpui button').forEach(b=>b.onclick=()=>{if(S.ui===b.dataset.k)return;S.ui=b.dataset.k;uiSet(S.ui);S.q='';draw(root,P)});
  const sl=q('#gpl'),sc=q('#gpc');
  if(sl)sl.onchange=()=>{S.lg=sl.value;S.cl='';draw(root,P);const c=root.querySelector('#gpc');if(c)c.focus({preventScroll:true})};
  if(sc)sc.onchange=()=>{S.cl=sc.value;draw(root,P);const c=root.querySelector('#gpc');if(c)c.focus({preventScroll:true})};
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
