/* ===== Fantasy extras: the model's team season by season, and the Patterns tab =====
   Season by season: the Season review of every archived season (data/fpl_review.json, same code and model version), next to this
   season once its review has been run on this device. Patterns: data/fpl_patterns.json, computed offline by replaying every archived
   season and this season's finished gameweeks with the same model, each gameweek seeing only earlier gameweeks. */
function srSum(R){
 const ok=L=>(L||[]).filter(x=>!x.err),f=ok(R.fixed),t=ok(R.ft),om=new Map((R.opt||[]).map(x=>[x.r,x.pts])),n=t.length;if(!n)return null;
 const sum=(L,g)=>L.reduce((s,x)=>s+(g(x)||0),0),O=sum(t,x=>om.get(x.r)),A=sum(t,x=>x.act);
 return {n,kept:sum(f,x=>x.act)/Math.max(1,f.length),ft:A/n,best:O/n,share:O?A/O:null,rs:t.map(x=>x.r)};
}
async function srAcross(){
 const box=document.getElementById('srall');if(!box)return;
 if(SR.file===undefined){try{const r=await fetch('data/fpl_review.json?v='+encodeURIComponent(SR_VER));SR.file=r.ok?await r.json():null}catch(e){SR.file=null}}
 if(!document.body.contains(box))return;
 const F=SR.file&&SR.file.sr===SR_VER?SR.file.seasons||{}:{},rows=[];
 Object.keys(F).sort().forEach(s=>{const R=F[s];if(R&&R.ver===PM_VERSION){const o=srSum(R);if(o)rows.push(Object.assign({lab:fpsLabel(s)},o))}});
 const d=FPD,cur=d&&!d.archive?SR.res[srKey(d)]:null;let cr=null;
 if(cur){const o=srSum(cur);if(o){const av=o.rs.map(r=>{const e=(d.events||[]).find(x=>x.id===r);return e&&fpOk(e.avg)?e.avg:null}).filter(v=>v!=null);
  cr=Object.assign({lab:'This season',mgr:av.length===o.n?av.reduce((a,b)=>a+b,0)/av.length:null},o);rows.push(cr)}}
 if(!rows.length){box.innerHTML='';return}
 const mx=Math.max(...rows.map(r=>Math.max(r.ft,r.kept,r.mgr||0)),1),hasM=!!(cr&&cr.mgr!=null);
 const bar=(v,c,l)=>`<div><span>${l}</span><span class="hpt"><i class="${c}" style="width:${Math.max(2,v/mx*100).toFixed(1)}%"></i></span><b>${v.toFixed(1)}</b></div>`;
 box.innerHTML=`<div class="card fpx-acr"><h3>The model's team, season by season</h3><div class="mu fpx-sub"><span>Points a gameweek from gameweek ${SR_FROM}, with the same rules every season: squad picked before gameweek ${SR_FROM} from earlier data only, no chips, no points hits</span>. <span>Model ${esc(PM_VERSION)}.</span></div>
  <div class="fpx-grid">${rows.map(r=>`<div class="fpx-s"><div class="fpx-h"><b>${esc(r.lab)}</b><span class="mu">${r.n} <span>gameweeks</span></span></div><div class="hpair">${bar(r.ft,'on','1 free transfer a week')}${bar(r.kept,'','Squad kept all season')}${r.mgr!=null?bar(r.mgr,'mgr','Average FPL manager'):''}</div><div class="mu fpx-n"><span>Best XI in hindsight</span> ${r.best.toFixed(1)} · <span>reached</span> ${Math.round(r.share*100)}%</div></div>`).join('')}</div>
  ${!cr&&d&&!d.archive?'<div class="mu fpx-sub">This season is added here once its review below has been run.</div>':''}
  <details class="fpx-tbl"><summary>Show as a table</summary>${tbl([['Season'],['Gameweeks',1],['1 free transfer',1],['Squad kept',1],['Best XI in hindsight',1],['Reached',1]].concat(hasM?[['Average manager',1]]:[]),rows.map(r=>[esc(r.lab),r.n,r.ft.toFixed(1),r.kept.toFixed(1),r.best.toFixed(1),Math.round(r.share*100)+'%'].concat(hasM?[r.mgr!=null?r.mgr.toFixed(1):'N/A']:[])))}</details>
  <div class="mu fpx-sub">The archived seasons carry no average-manager figure in the data; this season's comes from FPL's own gameweek averages. Only a few gameweeks of this season can be replayed so far, so its row moves a lot.</div></div>`;
}
/* ---------- Patterns tab ---------- */
let FPX_PAT;
const fpxSig=e=>!!(e&&e.lo!=null&&(e.lo>0||e.hi<0)),fpxHolds=(a,b)=>fpxSig(a)&&fpxSig(b)&&Math.sign(a.m)===Math.sign(b.m);
const fpxG=e=>e?`${e.m>=0?'+':''}${e.m.toFixed(2)} (${e.lo==null?'N/A':e.lo.toFixed(2)} – ${e.hi==null?'N/A':e.hi.toFixed(2)})`:'N/A';
async function fpTPatterns(el){
 el.innerHTML='<div class="empty skel">Loading…</div>';
 if(FPX_PAT===undefined){try{const r=await fetch('data/fpl_patterns.json?v='+encodeURIComponent((ALL&&ALL.generated)||''));FPX_PAT=r.ok?await r.json():null}catch(e){FPX_PAT=null}}
 if(FP.tab!=='patterns'||!document.body.contains(el))return;
 const P=FPX_PAT;if(!P||!P.items){el.innerHTML='<div class="empty">The patterns file is not available.</div>';return}
 const items=P.items.map(it=>Object.assign({fh:fpxHolds(it.train.vsForm,it.confirm.vsForm),mh:fpxHolds(it.train.vsModel,it.confirm.vsModel)},it)).sort((a,b)=>(b.fh-a.fh)||(Math.abs(b.confirm.vsForm.m)-Math.abs(a.confirm.vsForm.m)));
 const nF=items.filter(x=>x.fh).length,nM=items.filter(x=>x.mh).length;
 const card=it=>{const T=it.train,C=it.confirm,mx=Math.max(T.form,T.pred,T.act,C.form,C.pred,C.act,.1);
  const bars=o=>`<div class="hpair">${[['His form said',o.form,''],['The model predicted',o.pred,'mdl'],['He actually scored',o.act,'on']].map(([l,v,c])=>`<div><span>${l}</span><span class="hpt"><i class="${c}" style="width:${Math.max(2,v/mx*100).toFixed(1)}%"></i></span><b>${v.toFixed(2)}</b></div>`).join('')}</div>`;
  return `<div class="card fpx-pat"><div class="fpx-pt">${esc(it.l)}</div>
   <div class="fpx-tags"><span class="fpx-tag ${it.fh?'warn':'neu'}">${it.fh?(C.vsForm.m<0?'Form overrates them':'Form underrates them'):'Form: no consistent gap'}</span><span class="fpx-tag ${it.mh?'warn':'ok'}">${it.mh?'The model misses it':'The model already accounts for it'}</span></div>
   <div class="fpx-cols"><div><div class="mu fpx-per"><span>Confirmation</span> · ${C.n} <span>cases</span></div>${bars(C)}</div><div><div class="mu fpx-per"><span>Discovery</span> · ${T.n} <span>cases</span></div>${bars(T)}</div></div>
   <div class="mu fpx-n"><span>Next gameweek against his form:</span> ${fpxG(T.vsForm)} → ${fpxG(C.vsForm)} · <span>against the model:</span> ${fpxG(T.vsModel)} → ${fpxG(C.vsModel)}</div></div>`};
 el.innerHTML=`<div class="card mu fpx-intro"><b>If X happens, what happens next gameweek?</b> <span>Each pattern was fixed in advance, measured on a discovery period and then checked again on a confirmation period that played no part in choosing it.</span> <span>A pattern only counts when it shows up in both periods, with a 95% interval clear of zero (intervals are by gameweek, so many players in one week do not count as many pieces of evidence).</span> <span>Points are next-gameweek FPL points; "form" is his average over his last 5 gameweeks; "the model" is the Predicted Points model, which saw only earlier gameweeks.</span>
   <div class="fpx-per"><span>Discovery period:</span> ${esc(P.trainLabel)} · <span>confirmation period:</span> <span>${esc(P.confirmLabel)}</span> · <span>model</span> ${esc(P.model)}</div></div>
  <div class="grid"><div class="kpi"><b>${nF}</b><span>of ${items.length} patterns: form misleads, in both periods</span></div><div class="kpi"><b>${nM}</b><span>of ${items.length} patterns: the model misses them, in both periods</span></div></div>
  ${items.map(card).join('')}
  <div class="mu fpx-sub"><span>Gaps are average points per player per gameweek, with the 95% interval in brackets: discovery period → confirmation period.</span> <span>Computed</span> <span class="nw" dir="ltr">${esc(String(P.generated||'').slice(0,10))}</span> <span>from the archived seasons and this season's finished gameweeks.</span></div>`;
}
