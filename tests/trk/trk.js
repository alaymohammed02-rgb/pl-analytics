/* ===== Track record: the model's prediction saved before every deadline (data/fpl_track.json), against what happened =====
   The sync saves, for the next gameweek, the model's Optimal XI within the budget (the Optimal XI tab's default), its captain
   and vice, bench, the simulated 80% range and every player's expected points. It refreshes the record with each data update
   until the deadline and never changes it afterwards; each save is a commit, so the file's history shows when it was made.
   Actual points use FPL's automatic substitutions and captain/vice rule (srAuto, as in Season review). */
const TRK={data:null,key:''};
async function trkLoad(d){
 if(TRK.key===d.generated&&TRK.data)return TRK.data;
 let T={gws:{}};try{const r=await fetch('data/fpl_track.json?v='+encodeURIComponent(d.generated||''));if(r.ok)T=await r.json()}catch(e){}
 TRK.data=T;TRK.key=d.generated;return T;
}
function trkRows(d,T){
 const ix=btIx(d),RU=pmRules(d),now=Date.now(),ty=id=>{const p=d.PB.get(id);return p?p.ty:4};
 const at=(id,g,c)=>{let s=0;((d.hist||{})[String(id)]||[]).forEach(h=>{if(h[ix.r]===g&&fpOk(h[ix[c]]))s+=h[ix[c]]});return s};
 return Object.values(T.gws||{}).sort((a,b)=>a.gw-b.gw).map(s=>{
  const e=d.events.find(x=>x.id===s.gw)||{},locked=Date.parse(s.dl)<=now,fin=!!e.fin,minOf=id=>at(id,s.gw,'min'),ptsOf=id=>at(id,s.gw,'pts');
  const au=RU?srAuto(s.xi.map(id=>({id,t:ty(id)})),(s.bench||[]).map(id=>({id,t:ty(id)})),minOf,RU):{ids:s.xi,subs:[]};
  const capU=minOf(s.cap)>0?s.cap:(s.vice!=null&&minOf(s.vice)>0?s.vice:null),act=au.ids.reduce((a,id)=>a+ptsOf(id),0)+(capU!=null?ptsOf(capU):0);
  let n=0,ae=0,b=0;for(const [id,p] of Object.entries(s.preds||{})){const a=ptsOf(+id);n++;ae+=Math.abs(p-a);b+=p-a}
  return {s,e,locked,fin,act,capU,subs:au.subs,ids:au.ids,inR:act>=s.p10&&act<=s.p90,avg:fpOk(e.avg)&&e.avg>0?e.avg:null,mae:n?ae/n:null,bias:n?b/n:null,n,ptsOf,minOf};
 });
}
function fpTTrack(el){
 const d=FPD;el.innerHTML='<div class="empty">Loading…</div>';
 trkLoad(d).then(T=>{if(FPD===d&&FP.tab==='track')trkDraw(el,d,T)});
}
function trkDraw(el,d,T){
 const nm=id=>{const p=d.PB.get(id);return p?p.name:'#'+id},f1=x=>x.toFixed(1),hh=s=>String(s).slice(0,16).replace('T',' ')+' UTC';
 const repo=typeof GH_REPO==='function'?GH_REPO():'',link=repo?`https://github.com/${repo}/commits/main/data/fpl_track.json`:'';
 const nx=d.events.find(e=>e.nxt),rows=trkRows(d,T),done=rows.filter(r=>r.fin);
 const intro=`<div class="card mu" style="font-size:12px"><b>How this works.</b> Before every deadline the sync saves the model's prediction for that gameweek: the Optimal XI within the budget (as shown in the Optimal XI tab), captain, vice-captain and bench, the 80% range and every player's expected points. Until the deadline the record is refreshed with each data update (every 15 minutes in the last 3 hours); after the deadline it is never changed. Each save is a commit, so ${link?`<a href="${esc(link)}" target="_blank" rel="noopener">the history of the file on GitHub</a>`:'the history of the file on GitHub'} shows when every prediction was made. <b>Actual</b> = the points that XI scored with FPL's automatic substitutions and the captain/vice-captain rule. <b>FPL average</b> = the average score of all FPL managers that gameweek.</div>`;
 if(!rows.length){el.innerHTML=intro+`<div class="empty">No prediction saved yet. The first one is saved before the ${nx?'GW'+nx.id+' deadline ('+esc(hh(nx.dl))+')':'next deadline'} and scored once that gameweek is finished. The Backtest and Season review tabs replay earlier gameweeks.</div>`;return}
 const sum=(L,k)=>L.reduce((a,x)=>a+(x[k]||0),0),A=sum(done,'act'),E=done.reduce((a,x)=>a+x.s.exp,0),wA=done.filter(x=>x.avg!=null),AV=sum(wA,'avg'),AA=sum(wA,'act'),inR=done.filter(x=>x.inR).length;
 const mae=done.filter(x=>x.mae!=null);
 let h=intro;
 if(done.length){
  h+=`<div class="grid"><div class="kpi"><b>${done.length}</b><span>Gameweeks scored (${inR} of ${done.length} inside the 80% range)</span></div><div class="kpi"><b>${A}</b><span>Actual points of the saved XIs (expected ${f1(E)})</span></div><div class="kpi"><b>${wA.length?(AA-AV>=0?'+':'')+(AA-AV):'N/A'}</b><span>Against the FPL average manager${wA.length?' ('+((AA-AV)/wA.length>=0?'+':'')+f1((AA-AV)/wA.length)+' a gameweek)':''}</span></div><div class="kpi"><b>${mae.length?(mae.reduce((a,x)=>a+x.mae,0)/mae.length).toFixed(2):'N/A'}</b><span>Player prediction error (mean absolute, points per player)</span></div></div>`;
  if(done.length>=2){const gws=done.map(x=>x.s.gw),S=[{n:'Actual points',short:'Actual',v:done.map(x=>x.act),c:SR_COL.act,dash:''},{n:'Expected points',short:'Expected',v:done.map(x=>x.s.exp),c:SR_COL.exp,dash:'7 4'},{n:'FPL average',short:'FPL avg',v:done.map(x=>x.avg),c:SR_COL.opt,dash:'2 3'}];
   h+=`<div class="ctl" style="margin:10px 0 2px;font-size:13px;gap:14px">${S.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg>${esc(s.n)}</span>`).join('')}<span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="${SR_COL.dlt}" fill-opacity=".55"/></svg>Δ actual − expected</span></div><div id="trkch"></div>`;
   TRK.chart={gws,S,dl:done.map(x=>x.act-x.s.exp)}}else TRK.chart=null;
 }else TRK.chart=null;
 const st=r=>!r.locked?`<span class="mu">open until the deadline, ${esc(hh(r.s.dl))}</span>`:!r.fin?`<span class="mu">in progress (${r.act} so far)</span>`:String(r.act);
 h+=`<h3>Gameweek by gameweek</h3>`+tbl([['GW'],['Saved'],['Captain'],['Expected (80% range)',1],['Actual',1],['Δ',1],['In range'],['FPL average',1],['Player error',1]],rows.map(r=>{const bh=(Date.parse(r.s.dl)-Date.parse(String(r.s.saved).replace(' ','T')+'Z'))/36e5;
  return ['GW'+r.s.gw,`${esc(hh(r.s.saved))}<br><span class="mu">${bh>=0?f1(bh)+' h before the deadline':''}</span>`,esc(nm(r.s.cap))+(r.fin&&r.capU!==r.s.cap?(r.capU==null?' <span class="mu">(did not play, nor the vice)</span>':' <span class="mu">(did not play: '+esc(nm(r.capU))+' doubled)</span>'):''),
   `${f1(r.s.exp)} <span class="mu">(${Math.round(r.s.p10)}–${Math.round(r.s.p90)})</span>`,st(r),r.fin?(r.act-r.s.exp>=0?'+':'')+f1(r.act-r.s.exp):'',r.fin?(r.inR?'✓ yes':'✗ no'):'',r.fin&&r.avg!=null?String(r.avg):'',r.fin&&r.mae!=null?r.mae.toFixed(2):'']}));
 h+=rows.slice().reverse().map(r=>`<details style="margin:6px 0"><summary>GW${r.s.gw}: the saved XI (${esc(r.s.form)}, model ${esc(r.s.ver)})</summary>`+
  tbl([['Player'],['Pos'],['Expected',1],['Minutes',1],['Points',1]],r.s.xi.concat(r.s.bench||[]).map(id=>{const p=d.PB.get(id),sub=r.subs.find(x=>x[1]===id),out=r.subs.find(x=>x[0]===id),bench=!r.s.xi.includes(id);
   return [esc(nm(id))+(id===r.s.cap?' <b>(C)</b>':id===r.s.vice?' (V)':'')+(bench?' <span class="mu">(bench'+(sub?', came on':'')+')</span>':'')+(out?' <span class="mu">(replaced)</span>':''),p?FPPOS[p.ty]:'',f1((r.s.preds||{})[id]??0),r.locked?String(r.minOf(id)):'',r.locked?String(r.ptsOf(id)):'']}))+'</details>').join('');
 h+=`<div class="mu" style="font-size:12px;margin:6px 0">Player error: mean absolute difference between expected and actual points over all ${rows.length&&rows[rows.length-1].n?rows[rows.length-1].n:''} players with a saved prediction (those who did not play count with 0). Earlier gameweeks of this season have no saved prediction; the Backtest and Season review tabs replay them without future data.</div>`;
 el.innerHTML=h;
 if(TRK.chart){const o=$('#trkch');o.innerHTML=srChart('trkc',TRK.chart.gws,TRK.chart.S,TRK.chart.dl,Math.round(Math.max(340,Math.min(680,el.clientWidth||680))));srChartWire('trkc',TRK.chart.gws,TRK.chart.S,TRK.chart.dl)}
}
