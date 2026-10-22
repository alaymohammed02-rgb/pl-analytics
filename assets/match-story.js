/* ===== Match story: a short written account of a finished match, from its numbers =====
   Shown on the match centre (under the scoreboard) and on the replay page once the replay reaches the final whistle.
   Built by fixed rules from PitchAPI data the site already has, through match-replay.js's builder (window.rpBuild):
   the official score, the shots (who, when, xG, penalty / own goal), PitchAPI momentum and PitchAPI player ratings.
   Nothing is guessed: a sentence appears only when its facts are in the data —
   - the goals are told one by one only when the shot file has every goal of the official score;
   - "big chance" = a shot of xG 0.3+; a "spell" = 3+ minutes in a row of PitchAPI momentum at 60+ (as on the replay);
   - a team "grew" or "faded" after the break only when its xG changed by 0.6+ between the halves.
   The site translates English text word list by word list, which cannot carry whole sentences with names and numbers, so the
   story is written in both languages and the page language picks one (CSS on html[lang]). */
(function(){
 if(typeof R!=='object'||typeof R.match!=='function'||typeof window.rpBuild!=='function')return;
 const BIG=0.3,SWING=0.6,CLOSE=0.5;
 const x2=v=>(+v).toFixed(2);
 /* ---------- the facts ---------- */
 function facts(G,rt){
  const m=G.m,off=G.off;if(!off)return null;
  const F={H:m.home,A:m.away,off,win:off[0]>off[1]?'h':off[0]<off[1]?'a':null,etGap:!!G.etGap,has:G.shots.length>0};
  F.name=s=>s==='h'?F.H:F.A;
  if(F.has){F.xg=G.xgT;F.got=G.got}
  F.goalsOk=F.has&&G.got.h===off[0]&&G.got.a===off[1];
  const p1=G.TL.P[0],p1end=p1.o+p1.len+p1.add;
  const late=r=>r.pd==='SecondHalf'&&(r.mn>=85||r.ma>0);
  if(F.goalsOk){
   const gl=G.shots.filter(r=>r.goal);let h=0,a=0;const def={h:0,a:0};
   F.seq=gl.map(r=>{r.side==='h'?h++:a++;def.h=Math.max(def.h,a-h);def.a=Math.max(def.a,h-a);return {r,h,a}});
   F.def=def;F.first=gl[0]||null;
   F.ht={h:gl.filter(r=>r.side==='h'&&r.T<=p1end).length,a:gl.filter(r=>r.side==='a'&&r.T<=p1end).length};
   if(F.win){const w=F.win,lf=off[w==='h'?1:0];F.decider=gl.filter(r=>r.side===w)[lf]||null;F.deciderLate=!!(F.decider&&late(F.decider))}
   else if(gl.length){const L=F.seq[F.seq.length-1];if(L.h===L.a&&late(L.r))F.lateEq=L.r}
  }
  /* the longest spell on top, and a goal by that side during it or within 3 minutes of its end */
  const sp=G.spells.slice().sort((a,b)=>b.n-a.n||a.T0-b.T0)[0];
  if(sp){F.spell=sp;if(F.goalsOk)F.spellGoal=G.shots.find(r=>r.goal&&r.side===sp.side&&r.T>=sp.T0-.5&&r.T<=sp.T1+3)||null}
  if(F.has){
   const half=(s,i)=>G.shots.filter(r=>r.side===s&&!r.og&&(i?r.T>p1end:r.T<=p1end)).reduce((t,r)=>t+(r.xg||0),0);
   const sw=['h','a'].map(s=>({s,x1:half(s,0),x2:half(s,1)})).map(o=>({...o,d:o.x2-o.x1})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))[0];
   if(Math.abs(sw.d)>=SWING&&G.TL.END>p1end)F.swing=sw;
   const miss=G.shots.filter(r=>!r.goal&&!r.og&&(r.xg||0)>=BIG);
   F.best=miss.slice().sort((a,b)=>b.xg-a.xg)[0]||null;
   const n={h:miss.filter(r=>r.side==='h').length,a:miss.filter(r=>r.side==='a').length},ms=n.h>=n.a?'h':'a';
   if(n[ms]>=2&&n.h!==n.a)F.missed={s:ms,n:n[ms]};
  }
  /* PitchAPI's ratings: the highest-rated player of the match, named from the match's player rows */
  const r=rt&&rt.m&&rt.m[m.match_id];
  if(r){const best=Object.entries(r).filter(([,v])=>typeof v==='number').sort((a,b)=>b[1]-a[1])[0];
   if(best){const st=(D.stats||[]).find(s=>s.match_id===m.match_id&&s.player_id===best[0]),sh=G.shots.find(x=>x.pid===best[0]);
    const n=st?st.player:sh?sh.pn:null;if(n)F.potm={n,r:best[1]}}}
  return F;
 }
 /* ---------- the words ---------- */
 const nm=x=>`<bdi>${esc(x)}</bdi>`,num=x=>`<bdi dir="ltr">${x}</bdi>`;
 const ck=(r,ar)=>num(ar?r.clock.replace(/'/g,''):r.clock),sc=(a,b)=>num(`${a}–${b}`);
 function write(F,ar){
  const T=(en,a)=>ar?a:en,W=F.win,L=W==='h'?'a':'h',Wn=W&&nm(F.name(W)),Ln=W&&nm(F.name(L)),ws=W&&F.off[W==='h'?0:1],ls=W&&F.off[W==='h'?1:0];
  const by=(d,word)=>ar?(d===1?'بهدف':d===2?'بهدفين':`بـ${num(d)} أهداف`):(d===1?'a goal':`${d} goals`);
  const p1=[],p2=[],part=F.etGap||!F.goalsOk;   /* the shot file lacks part of the match: xG is told as it is, not judged */
  const xgPart=()=>T(`xG in the shot data PitchAPI has: ${nm(F.H)} ${sc(x2(F.xg.h),x2(F.xg.a))} ${nm(F.A)}.`,`xG في بيانات التسديدات المتوفرة من PitchAPI: ${nm(F.H)} ${sc(x2(F.xg.h),x2(F.xg.a))} ${nm(F.A)}.`);
  /* result, and how the chances compare */
  if(W){p1.push(T(`${Wn} beat ${Ln} ${sc(ws,ls)}.`,`فاز ${Wn} على ${Ln} ${sc(ws,ls)}.`));
   if(F.xg&&part)p1.push(xgPart());
   else if(F.xg){const xw=F.xg[W],xl=F.xg[L];
    p1.push(xw-xl>=CLOSE?T(`The chances backed it up: xG ${sc(x2(xw),x2(xl))}.`,`والفرص تدعم النتيجة: xG ${sc(x2(xw),x2(xl))}.`)
     :xl-xw>=CLOSE?T(`${Ln} had the better chances (xG ${sc(x2(xl),x2(xw))}), but ${Wn} made theirs count.`,`${Ln} صنع فرص أخطر (xG ${sc(x2(xl),x2(xw))})، لكن ${Wn} استغل فرصه.`)
     :T(`The chances were close: xG ${sc(x2(xw),x2(xl))}.`,`الفرص كانت متقاربة: xG ${sc(x2(xw),x2(xl))}.`))}}
  else{p1.push(T(`${nm(F.H)} and ${nm(F.A)} drew ${sc(F.off[0],F.off[1])}.`,`تعادل ${nm(F.H)} و${nm(F.A)} ${sc(F.off[0],F.off[1])}.`));
   if(F.xg&&part)p1.push(xgPart());
   else if(F.xg){const d=F.xg.h-F.xg.a,b=d>=0?'h':'a',o=b==='h'?'a':'h';
    p1.push(Math.abs(d)>=CLOSE?T(`${nm(F.name(b))} created more (xG ${sc(x2(F.xg[b]),x2(F.xg[o]))}).`,`${nm(F.name(b))} صنع فرص أكثر (xG ${sc(x2(F.xg[b]),x2(F.xg[o]))}).`)
     :T(`The chances were close too: xG ${sc(x2(F.xg.h),x2(F.xg.a))}.`,`والفرص بعد كانت متقاربة: xG ${sc(x2(F.xg.h),x2(F.xg.a))}.`))}}
  /* the goals */
  if(F.goalsOk&&F.first){const r=F.first,t=nm(F.name(r.side)),p=nm(r.pn||'');
   p1.push(r.og?T(`An own goal by ${p} put ${t} ahead (${ck(r)}).`,`هدف عكسي من ${p} قدّم ${t} (الدقيقة ${ck(r,1)}).`)
    :r.st==='Penalty'?T(`${p} opened the scoring for ${t} from the penalty spot (${ck(r)}).`,`${p} افتتح التسجيل لـ${t} من ركلة جزاء (الدقيقة ${ck(r,1)}).`)
    :T(`${p} opened the scoring for ${t} (${ck(r)}).`,`${p} افتتح التسجيل لـ${t} (الدقيقة ${ck(r,1)}).`));
   if(F.ht.h!==F.off[0]||F.ht.a!==F.off[1])p1.push(T(`At half-time it was ${nm(F.H)} ${sc(F.ht.h,F.ht.a)} ${nm(F.A)}.`,`وبين الشوطين كانت ${nm(F.H)} ${sc(F.ht.h,F.ht.a)} ${nm(F.A)}.`));
   if(W&&F.def[W]>=1)p1.push(T(`${Wn} came from ${by(F.def[W])} down to win.`,`${Wn} قلب تأخره ${by(F.def[W])} إلى فوز.`));
   if(!W){const last=F.seq[F.seq.length-1],s=last.r.side;if(F.def[s]>=1)p1.push(T(`${nm(F.name(s))} came back from ${by(F.def[s])} down.`,`${nm(F.name(s))} عوّض تأخره ${by(F.def[s])}.`))}
   const d=F.decider;
   if(W&&d&&ws-ls===1&&(d!==F.first||F.deciderLate)){const p=d.og?null:nm(d.pn||'');
    if(p)p1.push(F.deciderLate?T(`${p}'s goal (${ck(d)}) won it late.`,`هدف ${p} (الدقيقة ${ck(d,1)}) حسمها متأخر.`):T(`${p} scored the winner (${ck(d)}).`,`${p} سجّل هدف الفوز (الدقيقة ${ck(d,1)}).`))}
   if(F.lateEq&&!F.lateEq.og)p1.push(T(`${nm(F.lateEq.pn||'')} equalised late (${ck(F.lateEq)}).`,`${nm(F.lateEq.pn||'')} عادل في وقت متأخر (الدقيقة ${ck(F.lateEq,1)}).`))}
  /* how the match went */
  if(F.spell){const s=F.spell,t=nm(F.name(s.side)),fr=num(ar?s.from.replace(/'/g,''):s.from),to=num(ar?s.to.replace(/'/g,''):s.to),g=F.spellGoal;
   p2.push(T(`${t}'s strongest spell was ${fr}–${to}`,`أقوى فترات ${t} كانت ${fr}–${to}`)+(g?T(`, and it brought a goal (${nm(g.pn||'')}, ${ck(g)}).`,`، وجابت هدف (${nm(g.pn||'')}، الدقيقة ${ck(g,1)}).`):'.'))}
  if(F.swing){const s=F.swing,t=nm(F.name(s.s)),a=num(x2(s.x1)),b=num(x2(s.x2));
   p2.push(s.d>0?T(`${t} grew after the break: xG ${a} in the first half, ${b} in the second.`,`${t} تحسّن بعد الاستراحة: xG ${a} في الشوط الأول و${b} في الثاني.`)
    :T(`${t} faded after the break: xG ${a} in the first half, ${b} in the second.`,`${t} تراجع بعد الاستراحة: xG ${a} في الشوط الأول و${b} في الثاني.`))}
  if(F.best){const r=F.best;p2.push(T(`The best chance not taken: ${nm(r.pn||'')} (${nm(F.name(r.own))}, ${ck(r)}), xG ${num(x2(r.xg))}.`,`أخطر فرصة ما دخلت: ${nm(r.pn||'')} (${nm(F.name(r.own))}، الدقيقة ${ck(r,1)})، xG ${num(x2(r.xg))}.`))}
  if(F.missed)p2.push(T(`${nm(F.name(F.missed.s))} missed ${F.missed.n} big chances.`,`${nm(F.name(F.missed.s))} أضاع ${F.missed.n===2?'فرصتين كبيرتين':num(F.missed.n)+' فرص كبيرة'}.`));
  if(F.potm)p2.push(T(`${nm(F.potm.n)} was the highest-rated player (${num(F.potm.r.toFixed(1))}).`,`${nm(F.potm.n)} كان صاحب أعلى تقييم (${num(F.potm.r.toFixed(1))}).`));
  /* what the data cannot tell */
  if(F.etGap)p2.push(T(`The match went to extra time; the shot data stops at 90 minutes.`,`المباراة راحت لأشواط إضافية؛ بيانات التسديدات توقف عند 90 دقيقة.`));
  if(F.has&&!F.goalsOk)p2.push(T(`PitchAPI's shot data lists ${sc(F.got.h,F.got.a)} of the ${sc(F.off[0],F.off[1])} goals, so the goals are not described one by one.`,`بيانات تسديدات PitchAPI فيها ${sc(F.got.h,F.got.a)} من أهداف ${sc(F.off[0],F.off[1])}، فما نوصف الأهداف وحدة وحدة.`));
  if(!F.has)p2.push(T(`There is no shot data for this match, so only the result is told.`,`ما فيه بيانات تسديدات لهذي المباراة، فنكتفي بالنتيجة.`));
  return [p1,p2].filter(p=>p.length).map(p=>`<p>${p.join(' ')}</p>`).join('');
 }
 window.storyFacts=facts;   /* for tests */
 function card(F){
  return `<div class="card ms"><h3>Match story</h3>
   <div class="ms-en" lang="en" dir="ltr">${write(F,0)}<p class="mu ms-note">Written from PitchAPI's data by fixed rules: a big chance is a shot of xG ${BIG} or more; a spell is 3 minutes or more of PitchAPI momentum at 60 or more.</p></div>
   <div class="ms-ar" lang="ar" dir="rtl">${write(F,1)}<p class="mu ms-note">مكتوبة من بيانات PitchAPI بقواعد ثابتة: الفرصة الكبيرة تسديدة xG ${num(BIG)} أو أكثر؛ والفترة ${num(3)} دقائق أو أكثر من زخم PitchAPI عند ${num(60)} أو أكثر.</p></div></div>`;
 }
 const load=()=>Promise.all([loadSh().catch(()=>null),typeof mxLoad==='function'?mxLoad().catch(()=>null):null,typeof rtLoad==='function'?rtLoad().catch(()=>null):null]);
 async function storyOf(id){const m=D&&D.matches&&D.matches.find(x=>x.match_id===id);if(!m||!wkSc(m.score))return null;const [S,X,RT]=await load();return facts(rpBuild(m,S,X),RT)}
 /* match centre: under the scoreboard */
 const om=R.match;
 R.match=async function(el,id){
  const h0=location.hash,lg=D&&D.id,out=await om.apply(this,arguments);
  if(location.hash!==h0)return out;
  const sb=el&&el.querySelector('#mc .mc-score');if(!sb||el.querySelector('#mc .ms'))return out;
  const F=await storyOf(decodeURIComponent(id||''));
  if(F&&location.hash===h0&&D.id===lg&&sb.isConnected&&!el.querySelector('#mc .ms'))sb.insertAdjacentHTML('afterend',card(F));
  return out;
 };
 /* replay: the same card, filled only at the final whistle (before it, the page must not hold the result) */
 const orp=R.replay;
 R.replay=async function(el,id){
  const out=await orp.apply(this,arguments);
  const root=el&&el.querySelector('#rp'),ctl=root&&root.querySelector('.rp-ctl');if(!ctl||root.querySelector('#rpms'))return out;
  const box=document.createElement('div');box.id='rpms';box.hidden=true;ctl.after(box);
  let F;root.addEventListener('rp-ft',async e=>{
   if(!e.detail){box.hidden=true;box.innerHTML='';return}
   if(F===undefined)F=await storyOf(decodeURIComponent(id||''));
   if(F&&root.isConnected){box.innerHTML=card(F);box.hidden=false}});
  return out;
 };
 INS.ar({"Match story":"قصة المباراة"});
})();
