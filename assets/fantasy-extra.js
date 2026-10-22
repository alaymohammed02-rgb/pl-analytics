/* ===== Fantasy: "Captain & form" tab =====
   Captain picks: the highest predicted points for the next gameweek from the site's own model (v3, the same as Predicted
   Points), among players FPL lists as available; doubled as captain. Form: PitchAPI match ratings (data/<league>_rt.json) of the
   Premier League players linked to FPL (fpLink: same club and name, unique matches only): rising = his last 3 rated matches at
   least FX_DIFF above his season average, with FX_MIN+ rated matches; falling = the opposite. Ratings are a different signal
   from FPL points (they score the whole game, not goals and clean sheets), shown next to the model, not mixed into it. */
(function(){
 if(typeof fpRender!=='function'||typeof FP!=='object')return;
 const FX_MIN=5,FX_DIFF=.3,f1=v=>v==null?'N/A':(+v).toFixed(1),f2=v=>v==null?'N/A':(+v).toFixed(2);
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const ofr=fpRender;
 fpRender=function(){
  const arch=FPD&&FPD.archive;
  if(FP.tab!=='cap'||arch){if(FP.tab==='cap')FP.tab='table';ofr.apply(this,arguments);if(!arch)btn(false);return}
  FP.tab='table';ofr.apply(this,arguments);FP.tab='cap';btn(true);
  const b=document.getElementById('fpbody');if(b)capDraw(b).catch(e=>{b.innerHTML='<div class="empty">Could not draw this tab: '+esc(e.message)+'</div>'});
 };
 function btn(on){const c=document.querySelector('#fproot .ctl');if(!c||c.querySelector('[data-cap]'))return;
  if(on)c.querySelectorAll('button').forEach(x=>x.className='s');
  const x=document.createElement('button');x.dataset.cap='1';x.className=on?'':'s';x.textContent='Captain & form';x.onclick=()=>fpTab('cap');c.insertBefore(x,c.children[1]||null)}
 async function capDraw(el){
  const d=FPD;el.innerHTML='<div class="empty skel">Loading…</div>';
  let caps='';
  if(d.rules&&d.fix&&d.fix.length&&d.fix[0].length>=9&&typeof pmPredictAll==='function'){
   pmPredictAll(d);const C=pmCtx(d),g=C.gws[0];
   const L=d.P.filter(p=>p.pm&&p.pm.gws&&p.pm.gws[0]&&!p.pm.gws[0].none&&p.st==='a'&&p.pm.q!=='nodata').sort((a,b)=>b.pm.gws[0].pts-a.pm.gws[0].pts).slice(0,8);
   const opp=G=>G.fx.map(x=>{const t=d.T.get(x.opp)||{};return (t.s||'?')+' ('+(x.home?'H':'A')+')'}).join(', ');
   caps=`<div class="card"><h3>Captain picks <span class="mu">· GW${g}</span></h3><ol class="fc-l">${L.map((p,i)=>`<li${i===0?' class="top"':''}><b class="fc-n">${esc(p.name)}</b><span class="mu">${esc(p.tn)} · ${esc(opp(p.pm.gws[0]))}</span>
    <span class="fc-p"><b>${f1(p.pm.gws[0].pts)}</b> <span class="mu">→ ${f1(2*p.pm.gws[0].pts)} <span>as captain</span></span></span>${rtBadge(p)}</li>`).join('')}</ol>
    <p class="mu mc-note"><span>Predicted points for the next gameweek from the site's model (v3, the same as Predicted Points); available players only.</span> <span>The coloured chip is his average PitchAPI rating in his last 3 rated matches.</span></p></div>`;
  }
  const rt=await rtLoad();const link=typeof fpLink==='function'?fpLink():null;
  let form='';
  if(!rt||!link||!link.on)form=`<div class="card"><h3>Form from PitchAPI ratings</h3><div class="empty">Open the Premier League to link FPL players to their PitchAPI ratings.</div></div>`;
  else{
   const dates=new Map(D.matches.map(m=>[m.match_id,m.date]));
   const rows=d.P.map(p=>{const s=series(p,rt,dates);if(!s||s.length<FX_MIN)return null;const avg=s.reduce((a,x)=>a+x.v,0)/s.length,l3=s.slice(-3).reduce((a,x)=>a+x.v,0)/3;return {p,avg,l3,n:s.length,d:l3-avg}}).filter(Boolean);
   const up=rows.filter(r=>r.d>=FX_DIFF).sort((a,b)=>b.d-a.d).slice(0,10),dn=rows.filter(r=>r.d<=-FX_DIFF).sort((a,b)=>a.d-b.d).slice(0,10);
   const li=r=>`<li><b class="fc-n">${esc(r.p.name)}</b><span class="mu">${esc(r.p.tn)} · £${f1(r.p.price)}m · ${esc(String(r.p.selected_by_percent??''))}%</span><span class="fc-r"><i style="background:${rc(r.l3)}">${f2(r.l3)}</i> <span class="mu">vs ${f2(r.avg)}</span></span><b class="${r.d>0?'rt-up':'rt-dn'}">${r.d>0?'+':''}${f2(r.d)}</b></li>`;
   form=`<div class="card"><h3>Form from PitchAPI ratings</h3><div class="clx-g"><div><h4>Rising</h4>${up.length?`<ol class="fc-l">${up.map(li).join('')}</ol>`:'<div class="empty">Nobody yet.</div>'}</div><div><h4>Falling</h4>${dn.length?`<ol class="fc-l">${dn.map(li).join('')}</ol>`:'<div class="empty">Nobody yet.</div>'}</div></div>
    <p class="mu mc-note"><span>Last 3 rated matches against his season average, players with ${FX_MIN}+ rated matches; a change of at least ${FX_DIFF}.</span> <span>Price and ownership from FPL.</span> <span>A rating scores the whole game, so it can rise without FPL points (and the other way round).</span></p></div>`;
  }
  el.innerHTML=caps+form;
 }
 function series(p,rt,dates){const x=p.px;if(!x||!x.player_id)return null;const pid=x.player_id,s=[];
  Object.entries(rt.m).forEach(([mid,R_])=>{const v=R_[pid];if(typeof v==='number')s.push({d:dates.get(mid)||'',v})});return s.sort((a,b)=>String(a.d).localeCompare(String(b.d)))}
 function rtBadge(p){const rt=FXRT;if(!rt)return '';const s=series(p,rt,FXD);if(!s||!s.length)return '';const l=s.slice(-3),v=l.reduce((a,x)=>a+x.v,0)/l.length;return `<i class="fc-b" style="background:${rc(v)}" title="PitchAPI rating, last ${l.length}">${v.toFixed(1)}</i>`}
 let FXRT=null,FXD=new Map();
 const cd=capDraw;capDraw=async function(el){const lk=typeof fpLink==='function'?fpLink():null;FXRT=lk&&lk.on?await rtLoad():null;  /* ratings only when the players are linked to this league */
  FXD=new Map((D.matches||[]).map(m=>[m.match_id,m.date]));return cd(el)};
 if(typeof AR==='object')Object.entries({
  "Captain & form":"القائد والمستوى","Captain picks":"ترشيحات القائد","as captain":"كقائد",
  "Predicted points for the next gameweek from the site's model (v#, the same as Predicted Points); available players only.":"النقاط المتوقعة للجولة الجاية من نموذج الموقع (v#، نفس النقاط المتوقعة)؛ اللاعبين المتاحين فقط.",
  "The coloured chip is his average PitchAPI rating in his last # rated matches.":"المربع الملوّن متوسط تقييم PitchAPI له في آخر # مباريات مقيّمة.",
  "Form from PitchAPI ratings":"المستوى من تقييمات PitchAPI","Open the Premier League to link FPL players to their PitchAPI ratings.":"افتح الدوري الإنجليزي عشان نربط لاعبي الفانتازي بتقييماتهم في PitchAPI.",
  "Rising":"صاعد","Falling":"نازل","Nobody yet.":"ما فيه أحد للحين.",
  "Last # rated matches against his season average, players with #+ rated matches; a change of at least #.":"آخر # مباريات مقيّمة مقابل متوسطه في الموسم، للاعبين اللي عندهم #+ مباريات مقيّمة؛ بفرق # على الأقل.",
  "Price and ownership from FPL.":"السعر ونسبة الامتلاك من الفانتازي.","A rating scores the whole game, so it can rise without FPL points (and the other way round).":"التقييم يقيس المباراة كاملة، فممكن يرتفع بدون نقاط فانتازي (والعكس)."
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
