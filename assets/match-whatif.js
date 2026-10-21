/* ===== Match What-If: change the outcome of real shots and see the scoreline, result and table move =====
   Built only on PitchAPI's shot data (data/<league>_sh.json: player, minute, xG, outcome, own-goal flag) and the real score.
   It does not replay the match: everything after a changed shot (tactics, substitutions, other chances) stays as it really was,
   so a scenario is a "what if this one shot had gone differently", never a prediction of what would have happened.
   The chances' own odds come from the shots' xG: each shot is treated as an independent chance of scoring with probability xG. */
(function(){
 if(typeof R!=='object'||typeof PAGES==='undefined')return;
 if(!PAGES.some(p=>p[0]==='whatif'))PAGES.push(['whatif','Match What-If']);
 if(typeof UI_SEC!=='undefined'){const s=UI_SEC.find(x=>x.k==='league');if(s&&!s.p.includes('whatif'))s.p.push('whatif')}
 const W={mid:null,flip:new Set()};
 const OUT={Goal:'Goal',AttemptSaved:'Saved',Miss:'Missed',Post:'Hit the post'};
 const pct=v=>Math.round(v*100)+'%',r2=v=>(+v).toFixed(2);
 const res=(h,a)=>h>a?'H':h<a?'A':'D';
 /* goals distribution of one team from its shots (each a chance of xG), as an array P[k] = probability of k goals */
 function dist(xs){let P=[1];xs.forEach(p=>{p=Math.max(0,Math.min(1,p||0));const N=new Array(P.length+1).fill(0);P.forEach((v,k)=>{N[k]+=v*(1-p);N[k+1]+=v*p});P=N});return P}
 R.whatif=async function(el,id){
  el.innerHTML='<h2>Match What-If</h2><div id="wiroot"><div class="empty skel">Loading…</div></div>';
  let S=null;try{S=await loadSh()}catch(e){}
  const root=document.getElementById('wiroot');if(!root)return;
  if(!S){root.innerHTML='<div class="empty">Shot data is not available for this league, so there is nothing to change. Pick another league.</div>';return}
  const withShots=new Set(S.rows.map(r=>r.m)),ms=D.matches.filter(m=>wkSc(m.score)&&withShots.has(m.match_id)).sort(byDate);
  if(!ms.length){root.innerHTML='<div class="empty">No finished match of this league has shot data yet.</div>';return}
  const start=id&&ms.some(m=>m.match_id===id)?id:(W.mid&&ms.some(m=>m.match_id===W.mid)?W.mid:ms[0].match_id);
  if(start!==W.mid){W.mid=start;W.flip=new Set()}
  root.innerHTML=`<div class="card wi-warn"><b>Hypothetical.</b> <span>Changing a shot does not replay the match: everything that happened after it stays as it really was, so a scenario is not what would have happened.</span> <span>xG is the probability that a shot of that kind becomes a goal, not a guarantee.</span></div>
   <div class="ctl"><select id="wim" aria-label="Match">${opts(ms.map(m=>[m.match_id,mlabel(m.match_id)]),start)}</select><button class="s" id="wir">Reset</button></div><div id="wiout"></div>`;
  $('#wim').onchange=()=>{W.mid=$('#wim').value;W.flip=new Set();history.replaceState(null,'','#/whatif/'+encodeURIComponent(W.mid));wiDraw(S)};
  $('#wir').onclick=()=>{W.flip=new Set();wiDraw(S)};
  wiDraw(S);
 };
 window.wiToggle=k=>{if(W.flip.has(k))W.flip.delete(k);else W.flip.add(k);wiDraw(SHD)};
 function wiDraw(S){
  const out=document.getElementById('wiout');if(!out||!S)return;
  const m=D.matches.find(x=>x.match_id===W.mid),g=m&&wkSc(m.score);if(!m||!g){out.innerHTML='<div class="empty">This match has no final score.</div>';return}
  const H=m.home,A=m.away,all=S.rows.filter(r=>r.m===m.match_id&&r.pd!=='PenaltyShootout').sort((a,b)=>(a.mn||0)-(b.mn||0)||(a.ma||0)-(b.ma||0));
  const key=r=>r.s||(r.pid+'|'+r.mn+'|'+r.x+'|'+r.y);
  /* goals the shot data accounts for: a team's goals + the opponent's own goals */
  const fromShots={[H]:0,[A]:0};all.forEach(r=>{if(r.ev!=='Goal')return;if(r.og)fromShots[r.c===H?A:H]++;else if(fromShots[r.c]!=null)fromShots[r.c]++});
  const ok=fromShots[H]===g[0]&&fromShots[A]===g[1];
  /* the scenario: the real score, moved by every changed shot */
  let sh=g[0],sa=g[1];const chg=[];
  all.forEach(r=>{if(r.og||!W.flip.has(key(r)))return;const d=r.ev==='Goal'?-1:1;if(r.c===H)sh+=d;else if(r.c===A)sa+=d;chg.push(r)});
  sh=Math.max(0,sh);sa=Math.max(0,sa);
  const lab={H:'home win',A:'away win',D:'draw'},rr=res(g[0],g[1]),rs=res(sh,sa);
  /* what the chances said: independent shots with probability xG (own goals not included) */
  const pH=dist(all.filter(r=>!r.og&&r.c===H).map(r=>r.xg)),pA=dist(all.filter(r=>!r.og&&r.c===A).map(r=>r.xg));
  let w=0,d=0,l=0,best=null;pH.forEach((a,i)=>pA.forEach((b,j)=>{const p=a*b;if(i>j)w+=p;else if(i===j)d+=p;else l+=p;if(!best||p>best.p)best={i,j,p}}));
  const pReal=rr==='H'?w:rr==='A'?l:d,pExact=(pH[g[0]]||0)*(pA[g[1]]||0);
  const xH=all.filter(r=>!r.og&&r.c===H).reduce((s,r)=>s+(r.xg||0),0),xA=all.filter(r=>!r.og&&r.c===A).reduce((s,r)=>s+(r.xg||0),0);
  /* shots that alone would change the real result */
  const swing=all.filter(r=>!r.og&&(r.c===H||r.c===A)).filter(r=>{const d=r.ev==='Goal'?-1:1;const h=g[0]+(r.c===H?d:0),a=g[1]+(r.c===A?d:0);return h>=0&&a>=0&&res(h,a)!==rr});
  /* the league table, real and in the scenario (league formats only) */
  let tbHtml='';
  const fin=D.matches.filter(x=>wkSc(x.score)&&x.date);
  if(chg.length&&typeof ltTable==='function'&&ltOk(fin)){const tx=wkTeamXg(S.rows),A0=ltTable(fin,tx),B0=ltTable(fin.map(x=>x.match_id===m.match_id?Object.assign({},x,{score:sh+'-'+sa}):x),tx);
   const pos=(T,t)=>{const i=T.findIndex(r=>r.t===t);return i<0?null:{p:i+1,pts:T[i].pts}};
   tbHtml=`<div class="card"><h3>League table if this had happened</h3>${tbl([['Club'],['Real position',1],['Scenario',1],['Real points',1],['Scenario',1]],[H,A].map(t=>{const a=pos(A0,t),b=pos(B0,t);return [`${clubLink(t)}`,a?'#'+a.p:'N/A',b?'#'+b.p+(a&&b.p!==a.p?(b.p<a.p?' ▲':' ▼'):''):'N/A',a?a.pts:'N/A',b?b.pts:'N/A']}))}<div class="mu wi-n">Only this match changes; every other result stays as it was.</div></div>`}
  const crest=t=>{const s=typeof logoOf==='function'&&logoOf(t);return s?`<img class="clogo" src="${s}" alt="" loading="lazy">`:''};
  const row=r=>{const k=key(r),f=W.flip.has(k),goal=r.ev==='Goal',now=f?!goal:goal;
   if(r.og)return `<tr class="wi-og"><td class="n">${Math.round(r.mn||0)}'</td><td>${crest(r.c)}${esc(r.pn||'')}</td><td class="mu">Own goal</td><td class="n">—</td><td colspan="2" class="mu">Own goals are not shots: they stay as they were</td></tr>`;
   return `<tr class="${f?'wi-chg':''}"><td class="n">${Math.round(r.mn||0)}'</td><td>${crest(r.c)}${esc(r.pn||'')}</td><td class="mu">${esc(r.st||'')}</td><td class="n"><span class="wi-x"><i style="width:${Math.min(100,(r.xg||0)*100).toFixed(0)}%"></i></span>${r2(r.xg||0)}</td><td>${f?`<s class="mu">${OUT[r.ev]||esc(r.ev||'')}</s> → <b>${now?'Goal':'No goal'}</b>`:(OUT[r.ev]||esc(r.ev||''))}</td>
    <td><button class="s wi-b" aria-pressed="${f}" onclick="wiToggle('${esc(k)}')">${f?'Undo':now?'Make it no goal':'Make it a goal'}</button></td></tr>`};
  out.innerHTML=`<div class="wi-score card"><div class="wi-t">${crest(H)}<b>${esc(H)}</b></div><div class="wi-mid"><div class="mu wi-l">Real</div><div class="wi-r">${g[0]} – ${g[1]}</div><div class="mu wi-l">Scenario</div><div class="wi-s${chg.length?' on':''}">${sh} – ${sa}</div></div><div class="wi-t r">${crest(A)}<b>${esc(A)}</b></div></div>
   <div class="mu wi-n">${chg.length?`<span>${chg.length} shot${chg.length===1?'':'s'} changed</span> · <span>real result:</span> <span>${lab[rr]}</span> → <span>scenario:</span> <b>${lab[rs]}</b>`:'<span>Change any shot below to start a scenario.</span>'}</div>
   ${ok?'':`<div class="card wi-warn"><span>The shot data accounts for ${fromShots[H]}–${fromShots[A]}, not the real ${g[0]}–${g[1]}: PitchAPI's shot list for this match is incomplete, so the scenario starts from the real score and only the listed shots can be changed.</span></div>`}
   <div class="grid wi-k"><div class="kpi"><b>${r2(xH)} – ${r2(xA)}</b><span>xG (unchanged by any scenario)</span></div><div class="kpi"><b>${pct(w)} / ${pct(d)} / ${pct(l)}</b><span>Home win / draw / away win, from the shots' xG</span></div><div class="kpi"><b>${pct(pReal)}</b><span><span>Chance of the real result from the xG</span> (<span>${lab[rr]}</span>)</span></div><div class="kpi"><b>${best?best.i+' – '+best.j:'N/A'}</b><span><span>Most likely score from the xG</span> (${best?pct(best.p):''})</span></div></div>
   <div class="mu wi-n"><span>These odds treat every shot as an independent chance with its xG; they ignore what each goal does to the rest of a match.</span> <span>Exact real score from the xG:</span> ${pct(pExact)}.</div>
   ${swing.length?`<div class="card"><h3>Shots that alone would change the result</h3><div class="mu wi-n">${swing.length} <span>of</span> ${all.filter(r=>!r.og).length} <span>shots</span></div><ol class="wi-sw">${swing.map(r=>`<li><b>${Math.round(r.mn||0)}'</b> ${esc(r.pn||'')} <span class="mu">(${esc(r.c||'')}, xG ${r2(r.xg||0)}, ${OUT[r.ev]||esc(r.ev||'')})</span></li>`).join('')}</ol></div>`:''}
   ${tbHtml}
   <div class="card"><h3>Every shot of the match</h3><div class="wrap"><table class="wi-tab"><tr><th class="n">Min</th><th>Player</th><th>Situation</th><th class="n">xG</th><th>Outcome</th><th></th></tr>${all.map(row).join('')}</table></div>
   <div class="mu wi-n">Penalty shoot-outs are not part of the score and are left out.</div></div>`;
 }
 /* the match page gets a link to its What-If */
 if(typeof R.match==='function'){const om=R.match;R.match=async function(el,id){const r=await om.apply(this,arguments);if(el&&id&&!el.querySelector('.wi-link')){const a=document.createElement('p');a.className='wi-link';a.innerHTML=`<a href="#/whatif/${encodeURIComponent(id)}">Match What-If: change a shot and see the score move →</a>`;el.appendChild(a)}return r}}
 if(typeof AR==='object')Object.entries({
  "Match What-If":"ماذا لو؟ (المباراة)","Hypothetical.":"افتراضي.","Reset":"إعادة","Match":"المباراة",
  "Changing a shot does not replay the match: everything that happened after it stays as it really was, so a scenario is not what would have happened.":"تغيير تسديدة ما يعيد لعب المباراة: كل اللي صار بعدها يبقى مثل ما صار فعلاً، فالسيناريو مو اللي كان بيصير.",
  "xG is the probability that a shot of that kind becomes a goal, not a guarantee.":"xG احتمال إن تسديدة من هذا النوع تصير هدف، وليس ضمانًا.",
  "Shot data is not available for this league, so there is nothing to change. Pick another league.":"بيانات التسديد غير متوفرة لهذا الدوري، فما فيه شي نغيّره. اختر دوري ثاني.",
  "No finished match of this league has shot data yet.":"ما فيه مباراة منتهية في هذا الدوري لها بيانات تسديد بعد.","This match has no final score.":"هذي المباراة ما لها نتيجة نهائية.",
  "Real":"الحقيقية","Scenario":"السيناريو","home win":"فوز صاحب الأرض","away win":"فوز الضيف","draw":"تعادل",
  "# shot changed":"تم تغيير تسديدة واحدة","# shots changed":"تم تغيير # تسديدات","real result:":"النتيجة الحقيقية:","scenario:":"السيناريو:",
  "Change any shot below to start a scenario.":"غيّر أي تسديدة تحت عشان تبدأ سيناريو.",
  "The shot data accounts for #–#, not the real #–#: PitchAPI's shot list for this match is incomplete, so the scenario starts from the real score and only the listed shots can be changed.":"بيانات التسديد تغطي #–# بدل النتيجة الحقيقية #–#: قائمة تسديدات PitchAPI لهذي المباراة ناقصة، فالسيناريو يبدأ من النتيجة الحقيقية ونقدر نغيّر التسديدات الموجودة فقط.",
  "xG (unchanged by any scenario)":"xG (ما يتغير بأي سيناريو)","Home win / draw / away win, from the shots' xG":"فوز صاحب الأرض / تعادل / فوز الضيف، من xG التسديدات",
  "These odds treat every shot as an independent chance with its xG; they ignore what each goal does to the rest of a match.":"هذي الاحتمالات تعامل كل تسديدة كفرصة مستقلة بقيمة xG حقتها؛ وتتجاهل أثر كل هدف على باقي المباراة.",
  "Exact real score from the xG:":"احتمال النتيجة الحقيقية بالضبط من xG:",
  "Chance of the real result from the xG":"احتمال النتيجة الحقيقية من xG","Most likely score from the xG":"النتيجة الأرجح من xG","Shots that alone would change the result":"تسديدات لوحدها كانت بتغيّر النتيجة","of":"من","shots":"تسديدات",
  "League table if this had happened":"جدول الدوري لو صار هذا","Club":"النادي","Real position":"المركز الحقيقي","Real points":"النقاط الحقيقية",
  "Only this match changes; every other result stays as it was.":"تتغير هذي المباراة فقط؛ وباقي النتائج تبقى مثل ما هي.",
  "Every shot of the match":"كل تسديدات المباراة","Min":"د","Player":"اللاعب","Situation":"الحالة","Outcome":"النتيجة",
  "Own goal":"هدف عكسي","Own goals are not shots: they stay as they were":"الأهداف العكسية مو تسديدات: تبقى مثل ما هي",
  "Goal":"هدف","No goal":"بدون هدف","Saved":"تصدّى لها الحارس","Missed":"خارج المرمى","Hit the post":"القائم",
  "Undo":"تراجع","Make it no goal":"خلّها بدون هدف","Make it a goal":"خلّها هدف",
  "Penalty shoot-outs are not part of the score and are left out.":"ركلات الترجيح مو جزء من النتيجة وغير محسوبة.",
  "Match What-If: change a shot and see the score move →":"ماذا لو؟ غيّر تسديدة وشوف النتيجة تتحرك ←"
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
