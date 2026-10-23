/* ===== Comebacks & collapses (#/states, in League after the luck table): points won and lost by what the score was during the match =====
   The minute of every goal comes from the shot data (PitchAPI), own goals counted for the side they help. A match is used only
   when its goals add up to the final score (they do for every match checked), so the timeline is the real one.
   For each club: points rescued = points taken in matches where it was behind at some moment; points dropped = 3 minus the points
   taken in matches where it was ahead at some moment and did not win. Net = rescued − dropped. Time ahead / behind counts minutes of
   the match (at least 90; later if a goal came later) with the score ahead / behind. Points per game after scoring first / after
   conceding first use the matches that had a goal. Stoppage time is not known, so the last minute is the 90th unless a goal is later. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.poolOne!=='function')return;
 INS.addPage('states','Comebacks & collapses','league','luck');
 const S={team:'',lg:''};
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v);
 const logo=t=>typeof logoOf==='function'&&logoOf(t)?`<img src="${esc(logoOf(t))}" alt="" width="16" height="16" class="lk-lg">`:'';
 const f1=v=>v==null?'–':(+v).toFixed(1),f2=v=>v==null?'–':(+v).toFixed(2);
 async function calc(lid){
  const P=await INS.poolOne(lid,['sh']);if(!P||!P.shots)return null;
  const T=new Map(),F={matches:0,skipped:0,withGoal:0,fw:0,fd:0,fl:0,back:0};
  const team=n=>{let r=T.get(n);if(!r){r={t:n,n:0,pts:0,resc:0,drop:0,nc:0,ncW:0,nl:0,lead:0,lvl:0,trail:0,tot:0,sf:{n:0,p:0},cf:{n:0,p:0},ms:[]};T.set(n,r)}return r};
  P.ms.forEach(m=>{
   const g=P.goals(m.id);if(g.length!==m.hg+m.ag){F.skipped++;return}
   F.matches++;
   const end=Math.max(90,...g.map(x=>x.mn)),tm={h:{lead:0,lvl:0,trail:0},a:{lead:0,lvl:0,trail:0}};
   let h=0,a=0,t=0,maxH=0,maxA=0;
   const seg=to=>{const d=to-t;if(d>0){if(h>a){tm.h.lead+=d;tm.a.trail+=d}else if(h<a){tm.h.trail+=d;tm.a.lead+=d}else{tm.h.lvl+=d;tm.a.lvl+=d}}t=Math.max(t,to)};
   const seq=[];
   g.forEach(x=>{seg(Math.min(x.mn,end));x.home?h++:a++;maxH=Math.max(maxH,h-a);maxA=Math.max(maxA,a-h);seq.push(x.mn+(x.ma?'+'+x.ma:'')+"' "+h+'–'+a)});
   seg(end);
   const first=g.length?(g[0].home?'h':'a'):null;
   if(first){F.withGoal++;const fr=first==='h'?m.hg-m.ag:m.ag-m.hg;if(fr>0)F.fw++;else if(fr===0)F.fd++;else F.fl++}
   [['h',m.home,m.hg,m.ag,maxH,maxA,m.away],['a',m.away,m.ag,m.hg,maxA,maxH,m.home]].forEach(([sd,n,f,c,lead,trail,opp])=>{
    const r=team(n),p=f>c?3:f===c?1:0;r.n++;r.pts+=p;r.lead+=tm[sd].lead;r.lvl+=tm[sd].lvl;r.trail+=tm[sd].trail;r.tot+=end;
    const came=trail>0&&p>0,lost=lead>0&&p<3;
    if(trail>0){r.nl++;if(p>0){r.nc++;r.resc+=p;if(p===3)r.ncW++;if(p===3)F.back++}}
    if(lead>0&&p<3)r.drop+=3-p;
    if(first){const mine=first===sd;const k=mine?r.sf:r.cf;k.n++;k.p+=p}
    r.ms.push({m,sd,opp,f,c,p,came,lost,seq:seq.join(' · '),home:sd==='h'})});
  });
  const rows=[...T.values()].map(r=>Object.assign(r,{net:r.resc-r.drop,ahead:r.tot?r.lead/r.tot*100:null,behind:r.tot?r.trail/r.tot*100:null,
   ppSF:r.sf.n?r.sf.p/r.sf.n:null,ppCF:r.cf.n?r.cf.p/r.cf.n:null}));
  return {rows,F,id:lid};
 }
 R.states=async function(el){
  el.innerHTML='<h2>Comebacks &amp; collapses</h2><div id="gsroot" class="ins lk gs"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#gsroot'),lg=D.id;if(S.lg!==lg){S.lg=lg;S.team=''}
  const C=await calc(lg);if(!root.isConnected||D.id!==lg)return;
  if(!C||C.rows.length<4||C.F.matches<6){root.innerHTML=`<div class="empty">${two(`Not enough matches with a goal timeline in ${esc(D.name)} yet.`,`ما فيه مباريات كفاية بتسلسل أهداف في ${nm(D.name)} للحين.`)}</div>`;return}
  const rows=C.rows.slice().sort((a,b)=>b.net-a.net||b.resc-a.resc||a.t.localeCompare(b.t));
  if(!S.team||!rows.some(r=>r.t===S.team)){const fv=typeof favOf==='function'?favOf():null;S.team=fv&&rows.some(r=>r.t===fv)?fv:rows[0].t}
  const best=rows[0],worst=rows[rows.length-1],F=C.F,pc=x=>Math.round(x/F.withGoal*100);
  const paint=()=>{
   root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>What happened to the points when the score moved.</b> Points a club <b>rescued</b> (taken after being behind at some moment) against points it <b>dropped</b> (lost after being ahead at some moment). The minute of every goal comes from the shot data, and it matches the final score in every match used.`,
     `<b>وش صار للنقاط لما تغيّرت النتيجة.</b> نقاط الفريق اللي <b>أنقذها</b> (أخذها بعد ما كان متأخر في لحظة) مقابل نقاط <b>ضيّعها</b> (خسرها بعد ما كان متقدم في لحظة). دقيقة كل هدف من بيانات التسديد، وتطابق النتيجة النهائية في كل مباراة مستخدمة.`)}</p>
     <div class="lk-hl"><div class="lk-k up">${logo(best.t)}${nm(best.t)}<b>${nb(sg(best.net))}</b><span>${two('best net (rescued minus dropped)','أفضل صافي (أنقذ ناقص ضيّع)')}</span></div>
      <div class="lk-k dn">${logo(worst.t)}${nm(worst.t)}<b>${nb(sg(worst.net))}</b><span>${two('worst net','أسوأ صافي')}</span></div></div>
     <p class="mu">${two(`${F.matches} matches of ${esc(D.name)}${F.skipped?` (${F.skipped} left out: goals did not add up to the score)`:''}. Small numbers: a club has played only a few matches, so one late goal moves a lot.`,`${nb(F.matches)} مباراة من ${nm(D.name)}${F.skipped?` (${nb(F.skipped)} مستبعدة: الأهداف ما طابقت النتيجة)`:''}. أرقام صغيرة: النادي لعب مباريات قليلة، فهدف متأخر واحد يغيّر كثير.`)}</p></div>
    <div class="card"><h3>${two('Net points: rescued minus dropped','صافي النقاط: أنقذ ناقص ضيّع')}</h3>${bars(rows)}</div>
    <div class="card"><h3>${two('The numbers behind it','الأرقام اللي وراءه')}</h3>${table(rows)}</div>
    <div class="card lk-me gs-me"><h3>${logo(S.team)}${nm(S.team)}</h3>${detail(rows.find(r=>r.t===S.team))}</div>
    <div class="card gs-fx"><h3>${two('The first goal','الهدف الأول')}</h3>
     <p>${two(`In the ${F.withGoal} matches with a goal, the side that scored first <b>won ${pc(F.fw)}%</b>, drew ${pc(F.fd)}% and lost ${pc(F.fl)}%. A side that was behind at some moment went on to win in ${F.back} matches.`,`في ${nb(F.withGoal)} مباراة فيها هدف، الفريق اللي سجّل أول <b>فاز في ${nb(pc(F.fw))}%</b>، وتعادل في ${nb(pc(F.fd))}%، وخسر في ${nb(pc(F.fl))}%. وفريق كان متأخر في لحظة فاز في ${nb(F.back)} مباراة.`)}</p></div>`;
   root.querySelectorAll('[data-tm]').forEach(b=>{const f=()=>{S.team=b.dataset.tm;paint();const d=root.querySelector('.gs-me');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest',behavior:'smooth'})};b.addEventListener('click',f);if(b.tagName==='TR')b.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();f()}})});
  };
  const table=L=>`<div class="wrap"><table class="lk-t gs-t"><thead><tr><th>Team</th><th class="n lk-nm">Matches</th><th class="n">Rescued</th><th class="n">Dropped</th><th class="n">Net</th><th class="n lk-nm">Ahead %</th><th class="n lk-nm">Behind %</th><th class="n gs-w">Pts/game after scoring first</th><th class="n gs-w">Pts/game after conceding first</th></tr></thead><tbody>
   ${L.map(r=>`<tr data-tm="${esc(r.t)}" tabindex="0" class="${r.t===S.team?'me':''}"><td class="lk-tn">${logo(r.t)}${nm(r.t)}</td><td class="n lk-nm">${r.n}</td><td class="n">${r.resc}</td><td class="n">${r.drop}</td><td class="n"><b class="${r.net>=0?'lk-up':'lk-dn'}">${nb(sg(r.net))}</b></td><td class="n lk-nm">${f1(r.ahead)}</td><td class="n lk-nm">${f1(r.behind)}</td><td class="n gs-w">${f2(r.ppSF)}</td><td class="n gs-w">${f2(r.ppCF)}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Rescued: points taken in matches where the club was behind at some moment. Dropped: 3 minus the points taken in matches where it was ahead at some moment and did not win. Ahead / behind: share of the match minutes with the score in its favour / against.','أنقذ: نقاط أخذها الفريق في مباريات كان فيها متأخر في لحظة. ضيّع: 3 ناقص النقاط اللي أخذها في مباريات كان فيها متقدم في لحظة وما فاز. متقدم / متأخر: نسبة دقائق المباراة والنتيجة له / عليه.')}</p>`;
  paint();
 };
 function bars(rows){
  const mx=Math.max(1,...rows.map(r=>Math.abs(r.net)));
  return `<ol class="lk-bars">${rows.map(r=>{const w=(Math.abs(r.net)/mx*50).toFixed(1);
   return `<li class="${r.t===S.team?'me':''}"><button type="button" data-tm="${esc(r.t)}"${INS.tipAttr([r.t,'Rescued: '+r.resc,'Dropped: '+r.drop,'Net: '+sg(r.net),r.n+' matches'])}><span class="lk-bn lk-tn">${logo(r.t)}${nm(r.t)}</span>
    <span class="lk-bb"><i class="${r.net>=0?'up':'dn'}" style="${r.net>=0?'left:50%':'right:50%'};width:${w}%"></i></span><b class="${r.net>=0?'lk-up':'lk-dn'}">${nb(sg(r.net))}</b></button></li>`}).join('')}</ol>
   <p class="mu ins-note">${two('Tap a club to see its matches.','اضغط نادي تشوف مبارياته.')}</p>`;
 }
 function detail(r){
  const ms=r.ms.slice().sort((a,b)=>a.m.d.localeCompare(b.m.d));
  return `<p>${two(`Rescued <b>${r.resc}</b> points in ${r.nc} of the ${r.nl} matches where it was behind; dropped <b>${r.drop}</b> points from winning positions. Net <b>${sg(r.net)}</b>.`,
   `أنقذ <b>${nb(r.resc)}</b> نقطة في ${nb(r.nc)} من ${nb(r.nl)} مباراة كان فيها متأخر؛ وضيّع <b>${nb(r.drop)}</b> نقطة من مواقف متقدم. الصافي <b>${nb(sg(r.net))}</b>.`)}</p>
   <ul class="lk-ms">${ms.map(x=>`<li><a href="#/match/${encodeURIComponent(x.m.id)}"><span>${esc(x.m.d)}</span> <span>${nm(x.m.home)} ${nb(x.m.hg+'–'+x.m.ag)} ${nm(x.m.away)}</span>
    ${x.came?`<em class="gs-b up">${two('came back','عوّض')}</em>`:''}${x.lost?`<em class="gs-b dn">${two('dropped points','ضيّع نقاط')}</em>`:''}<span class="mu gs-sq">${nb(esc(x.seq||'0–0'))}</span></a></li>`).join('')}</ul>`;
 }
 INS.ar({"Comebacks & collapses":"العودات والانهيارات","Matches":"المباريات","Rescued":"أنقذ","Dropped":"ضيّع","Net":"الصافي","Ahead %":"متقدم %","Behind %":"متأخر %","Pts/game after scoring first":"نقاط/مباراة بعد التسجيل أولاً","Pts/game after conceding first":"نقاط/مباراة بعد استقبال الهدف أولاً","Team":"الفريق"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
