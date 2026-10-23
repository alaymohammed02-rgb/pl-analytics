/* ===== Fantasy (FPL) ===== */
let FPD=null,FPK='',FPLINK=null;
const FP={tab:'xi',sel:[],sort:{k:'tp',d:-1},q:'',pos:'',team:'',maxp:'',minm:'0',av:'',sx:'price',sy:'tp',sp:'',sm:'90',vm:'pm',vp:'',vmin:'270',vmax:'',tm:'tp',cq:''};
const FPPOS={1:'GKP',2:'DEF',3:'MID',4:'FWD'},FPCOL={1:'#e9b44c',2:'#5aa9e6',3:'#4cc38a',4:'#e5646b'};
const FPPAL=['#E69F00','#56B4E9','#2BC48A','#F0E442','#FF6B5E','#B8A1FF'],FPDASH=['','7 3','2 3','9 3 2 3','1 4','5 2 1 2'];
const fpOk=v=>typeof v==='number'&&isFinite(v);
const fpNz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const FPAL={'man city':'manchester city','man utd':'manchester united','spurs':'tottenham','nott m forest':'nottingham forest','wolves':'wolverhampton'};
const fpTeamEq=(a,b)=>{a=fpNz(a);b=fpNz(b);a=FPAL[a]||a;b=FPAL[b]||b;return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))};
/* metric: [id, label, getter, digits]. A missing value stays null, it is never turned into 0 */
const FPM=[
 ['price','Price (£m)',p=>p.price,1],['tp','Total points',p=>p.total_points,0],['ppg','Points per game',p=>p.points_per_game,1],
 ['p90','Points per 90',p=>p.minutes>0&&fpOk(p.total_points)?p.total_points/p.minutes*90:null,2],
 ['pm','Points per £m',p=>p.price>0&&fpOk(p.total_points)?p.total_points/p.price:null,1],
 ['form','Form',p=>p.form,1],['min','Minutes',p=>p.minutes,0],['own','Ownership %',p=>p.selected_by_percent,1],
 ['g','Goals',p=>p.goals_scored,0],['a','Assists',p=>p.assists,0],['cs','Clean sheets',p=>p.clean_sheets,0],
 ['bon','Bonus',p=>p.bonus,0],['bps','BPS',p=>p.bps,0],
 ['xg','xG (FPL)',p=>p.expected_goals,2],['xa','xA (FPL)',p=>p.expected_assists,2],['xgi','xGI (FPL)',p=>p.expected_goal_involvements,2],
 ['xgi90','xGI per 90 (FPL)',p=>p.minutes>0&&fpOk(p.expected_goal_involvements)?p.expected_goal_involvements/p.minutes*90:null,2],
 ['xgipm','xGI per £m',p=>p.price>0&&fpOk(p.expected_goal_involvements)?p.expected_goal_involvements/p.price:null,2],
 ['ict','ICT index',p=>p.ict_index,1],['inf','Influence',p=>p.influence,1],['cre','Creativity',p=>p.creativity,1],['thr','Threat',p=>p.threat,1],
 ['chg','Price change since start (£m)',p=>p.chg,1],['tin','Transfers in (this GW)',p=>p.transfers_in_event,0],['tout','Transfers out (this GW)',p=>p.transfers_out_event,0],
 ['pxt','xT per 90 (PitchAPI)',p=>p.px?p.px.xt90:null,3],['pxg','xG per 90 (PitchAPI)',p=>p.px?p.px.xg90:null,3]];
const fpM=id=>FPM.find(m=>m[0]===id)||FPM[0];
async function fpLoad(){
 if(FPS.cur)return fpsLoad(FPS.cur);
 const m=ALL.fpl;if(!m||!m.file)return null;
 if(FPD&&FPK===(m.v||''))return FPD;
 const r=await fetch('data/'+m.file+'?v='+encodeURIComponent(m.v||''));
 if(!r.ok)throw new Error(m.file+' (HTTP '+r.status+')');
 const d=await r.json();d.T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=d.T.get(o.tm)||{};
  o.tn=t.s||'?';o.tf=t.n||'?';o.pos=o.ty;o.name=o.wn;o.price=fpOk(o.now_cost)?o.now_cost/10:null;o.chg=fpOk(o.cost_change_start)?o.cost_change_start/10:null;return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));FPD=d;FPK=m.v||'';FPLINK=null;return d;
}
/* Links FPL players to PitchAPI players of the loaded Premier League data (by team + name). Only unique matches are used. */
function fpLink(){
 if(FPD&&FPD.archive)return fpsNoLink();
 const key=(D?D.id:'')+'|'+(ALL.generated||'')+'|'+FPK;if(FPLINK&&FPLINK.key===key)return FPLINK;
 const out={key,map:new Map(),on:false,n:0,tot:0},pl=ALL.leagues.find(l=>l.id===D.id)||{};
 FPLINK=out;
 if(!/premier league/i.test(D.name)||!(/engl/i.test(pl.country||'')||oxPLClubOverlap(D.stats.map(s=>s.club))>=15))return out;
 out.on=true;const rows=agg();
 FPD.P.forEach(p=>{
  const wantsIt=(p.minutes||0)>0;if(wantsIt)out.tot++;
  const full=fpNz(p.fn+' '+p.sn),wn=fpNz(p.name),sn=fpNz(p.sn).split(' ').pop(),wl=wn.split(' ').pop(),fi=fpNz(p.fn).charAt(0);
  const cands=rows.filter(r=>fpTeamEq(p.tf,r.club));let hit=null;
  const ex=cands.filter(r=>{const n=fpNz(r.player);return n===full||n===wn});
  if(ex.length===1)hit=ex[0];
  else{
   const c2=cands.filter(r=>{const t=fpNz(r.player).split(' '),l=t[t.length-1];return l===sn||l===wl});
   if(c2.length===1)hit=c2[0];
   else if(c2.length>1){const c3=c2.filter(r=>fpNz(r.player).charAt(0)===fi);if(c3.length===1)hit=c3[0]}
  }
  if(hit){out.map.set(p.id,hit);p.px=hit;if(wantsIt)out.n++}else p.px=null;
 });
 return out;
}
function fpFilt(P,o){
 const q=fpNz(o.q||''),mm=+o.minm||0;
 return P.filter(p=>(!o.pos||p.pos===+o.pos)&&(!o.team||p.tm===+o.team)&&(o.maxp===''||o.maxp==null||(p.price!=null&&p.price<=+o.maxp))&&(mm<=0||(p.minutes||0)>=mm)&&(!q||fpNz(p.fn+' '+p.sn+' '+p.name).includes(q))&&(!o.av||(o.av==='ok'?p.st==='a':p.st!=='a')));
}
const fpOpts=(a,s)=>a.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(s)?'selected':''}>${esc(t)}</option>`).join('');
const fpPosOpts=s=>fpOpts([['','All positions'],...[1,2,3,4].map(k=>[String(k),FPPOS[k]])],s);
const fpTeamOpts=s=>fpOpts([['','All teams'],...FPD.teams.map(t=>[String(t.id),t.n])],s);
const fpMetOpts=s=>fpOpts(FPM.filter(m=>FPLINK.on||!/PitchAPI/.test(m[1])).map(m=>[m[0],m[1]]),s);
function fpMsg(t){const e=$('#fpmsg');if(e)e.textContent=t}
function fpAdd(id){
 if(FP.sel.includes(id))fpMsg('Already in the comparison.');
 else if(FP.sel.length>=6)fpMsg('Maximum of 6 players. Remove one first.');
 else{FP.sel.push(id);fpMsg((FPD.PB.get(id)||{}).name+' added to Compare ('+FP.sel.length+').')}
 if(FP.tab==='compare')fpRender();
}
function fpRm(id){FP.sel=FP.sel.filter(x=>x!==id);fpRender()}
function fpTab(k){FP.tab=k;fpRender()}
const fpBars=(items)=>{const mx=Math.max(...items.map(i=>Math.abs(i.v)),1e-9);
 return items.map(i=>`<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><div style="width:42%;min-width:110px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.l)} <span class="mu">${esc(i.s||'')}</span></div><div style="flex:1;background:var(--ln);border-radius:3px;height:12px"><div style="width:${(Math.abs(i.v)/mx*100).toFixed(1)}%;height:12px;border-radius:3px;background:${i.c||'#5aa9e6'}"></div></div><div style="width:64px;text-align:right;font-variant-numeric:tabular-nums">${esc(i.t)}</div></div>`).join('')};
function fpScatter(pts,xm,ym){
 if(pts.length<2)return '<div class="empty">Not enough players with a value for both metrics.</div>';
 const W=680,H=430,L=54,B=42,T=12,Rr=16,xs=pts.map(a=>a.x),ys=pts.map(a=>a.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 const sx=v=>L+(W-L-Rr)*(v-x0)/((x1-x0)||1),sy=v=>H-B-(H-B-T)*(v-y0)/((y1-y0)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let i=0;i<=5;i++){const xv=x0+(x1-x0)*i/5,yv=y0+(y1-y0)*i/5;
  g+=`<line x1="${sx(xv).toFixed(1)}" y1="${T}" x2="${sx(xv).toFixed(1)}" y2="${H-B}" stroke="#25374d" stroke-width=".6"/><text x="${sx(xv).toFixed(1)}" y="${H-B+15}" text-anchor="middle" font-size="11" fill="#8a9bb0">${xv.toFixed(xm[3])}</text>`+
  `<line x1="${L}" y1="${sy(yv).toFixed(1)}" x2="${W-Rr}" y2="${sy(yv).toFixed(1)}" stroke="#25374d" stroke-width=".6"/><text x="${L-6}" y="${(sy(yv)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${yv.toFixed(ym[3])}</text>`}
 g+=`<text x="${(L+W-Rr)/2}" y="${H-6}" text-anchor="middle" font-size="12" fill="#e8eef5">${esc(xm[1])}</text><text transform="translate(13 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#e8eef5">${esc(ym[1])}</text>`;
 pts.forEach(a=>{g+=`<circle onclick="fpPick(${a.p.id})" style="cursor:pointer" cx="${sx(a.x).toFixed(1)}" cy="${sy(a.y).toFixed(1)}" r="4.2" fill="${FPCOL[a.p.pos]||'#8a9bb0'}" fill-opacity=".75" stroke="#0d1520" stroke-width=".6"><title>${esc(a.p.name)} (${esc(a.p.tn)}): ${a.x.toFixed(xm[3])} / ${a.y.toFixed(ym[3])}</title></circle>`});
 const nx=v=>(v-x0)/((x1-x0)||1),ny=v=>(v-y0)/((y1-y0)||1);
 [...pts].sort((p,q)=>(nx(q.x)+ny(q.y))-(nx(p.x)+ny(p.y))).slice(0,8).forEach(a=>{g+=`<text x="${(sx(a.x)+6).toFixed(1)}" y="${(sy(a.y)-6).toFixed(1)}" font-size="10.5" fill="#e8eef5" stroke="#0d1520" stroke-width=".8" paint-order="stroke" style="pointer-events:none">${esc(a.p.name)}</text>`});
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;display:block;margin:0 auto">${g}</svg>`;
}
function fpPick(id){
 const p=FPD.PB.get(id),b=$('#fpd');if(!p||!b)return;
 b.innerHTML=`<b>${esc(p.fn+' '+p.sn)}</b> · ${esc(p.tf)} · ${FPPOS[p.pos]}<div class="mu">£${f(p.price,1)}m · ${f(p.total_points,0)} pts · form ${f(p.form,1)} · ${f(p.minutes,0)} min · owned ${f(p.selected_by_percent,1)}%${p.nw?'<br>News: '+esc(p.nw):''}</div><button class="s" onclick="fpAdd(${id})" style="margin-top:6px">Add to Compare</button>`;
}
function fpLines(series,gws,title,dig){
 const vals=series.flatMap(s=>s.v.filter(fpOk));
 if(!gws.length||!vals.length)return `<div class="empty">${esc(title)}: no match history yet.</div>`;
 const W=680,H=250,L=46,B=28,T=10,Rr=12,lo=Math.min(...vals),hi=Math.max(...vals),sx=i=>L+(W-L-Rr)*(gws.length>1?i/(gws.length-1):.5),sy=v=>H-B-(H-B-T)*(v-lo)/((hi-lo)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;g+=`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W-Rr}" y2="${sy(v).toFixed(1)}" stroke="#25374d" stroke-width=".6"/><text x="${L-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${v.toFixed(dig)}</text>`}
 const step=Math.max(1,Math.ceil(gws.length/12));gws.forEach((w,i)=>{if(i%step===0)g+=`<text x="${sx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#8a9bb0">${w}</text>`});
 series.forEach((s,k)=>{let d='',pen=false;s.v.forEach((v,i)=>{if(!fpOk(v)){pen=false;return}d+=(pen?'L':'M')+sx(i).toFixed(1)+' '+sy(v).toFixed(1)+' ';pen=true});
  g+=`<path d="${d}" fill="none" stroke="${FPPAL[k]}" stroke-width="2.2" stroke-dasharray="${FPDASH[k]}" stroke-linejoin="round"/>`;
  s.v.forEach((v,i)=>{if(fpOk(v))g+=`<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3" fill="${FPPAL[k]}"><title>${esc(s.n)} · GW ${gws[i]}: ${v.toFixed(dig)}</title></circle>`})});
 return `<div class="mu" style="margin:6px 0 2px">${esc(title)} (gameweek on the x axis)</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;display:block;margin:0 auto">${g}</svg>`;
}
/* per-gameweek values of one player from the stored history: points and minutes add up in a double gameweek, price takes the last row */
function fpHist(id,k){
 const idx={pts:1,val:2,min:3,xg:4,xa:5,bon:6}[k],m=new Map();
 ((FPD.hist||{})[String(id)]||[]).forEach(h=>{const v=h[idx];if(!fpOk(v))return;const r=h[0];
  m.set(r,(k==='val')?v/10:(m.get(r)||0)+v)});
 return m;
}
function fpSeries(ids,k){
 const ms=ids.map(id=>fpHist(id,k)),gws=[...new Set(ms.flatMap(m=>[...m.keys()]))].sort((a,b)=>a-b);
 let series=ids.map((id,i)=>({n:FPD.PB.get(id).name,v:gws.map(g=>ms[i].has(g)?ms[i].get(g):null)}));
 return {gws,series};
}
function fpHeader(d){
 if(d.archive)return fpsSel()+fpsHead(d);
 const cur=d.events.find(e=>e.cur)||d.events.filter(e=>e.fin).slice(-1)[0];
 return fpsSel()+`<div class="mu" style="margin-bottom:8px">Official Fantasy Premier League data, as of ${esc(d.generated)} UTC${cur?' · '+esc(cur.name):''}. Prices in £m. A dash or N/A means the source gave no value (never zero).${FPLINK.on?` PitchAPI link: ${FPLINK.n} of ${FPLINK.tot} players with minutes matched by team and name; the rest have no PitchAPI value.`:' PitchAPI metrics (xT, xG) appear when the Premier League is selected in the league picker.'}</div><div id="fpmsg" class="mu" style="min-height:18px"></div>`;
}
function fpRender(){
 if(FPD&&FPD.archive&&!fpsTabOk([FP.tab]))FP.tab='table';
 const d=FPD,T=[['xi','★ Optimal XI'],['my','My XI'],['vs','My XI vs Optimal'],['fc','Forecast'],['table','Table'],['pred','Predicted Points'],['best','Best Team'],['scatter','Scatter'],['value','Value'],['compare','Compare'],['teams','Teams'],['fixtures','Fixtures'],['backtest','Backtest'],['review','Season review']];
 $('#fproot').innerHTML=`<div class="ctl">${T.filter(fpsTabOk).map(([k,n])=>`<button class="${k===FP.tab?'':'s'}" onclick="fpTab('${k}')">${n}</button>`).join('')}</div>`+fpHeader(d)+'<div id="fpbody"></div>';
 ({xi:oxTXI,my:oxTMy,vs:oxTVs,fc:oxTFc,table:fpTTable,pred:fpTPred,best:fpTBest,scatter:fpTScatter,value:fpTValue,compare:fpTCompare,teams:fpTTeams,fixtures:fpTFix,backtest:fpTBack,review:fpTReview})[FP.tab]($('#fpbody'));
}
function fpSort(k){FP.sort=FP.sort.k===k?{k,d:-FP.sort.d}:{k,d:(k==='name'||k==='tn')?1:-1};fpTTableDraw()}
function fpTTable(el){
 el.innerHTML=`<div class="ctl"><input id="fq" placeholder="Search player" value="${esc(FP.q)}"><select id="fpos">${fpPosOpts(FP.pos)}</select><select id="ftm">${fpTeamOpts(FP.team)}</select><input id="fmx" type="number" step="0.1" placeholder="Max price" value="${esc(FP.maxp)}" style="width:110px"><input id="fmm" type="number" placeholder="Min minutes" value="${esc(FP.minm)}" style="width:120px"><select id="fav">${fpOpts([['','Any status'],['ok','Available'],['no','Doubtful or out']],FP.av)}</select></div><div id="fout"></div>`;
 const rd=()=>{FP.q=$('#fq').value;FP.pos=$('#fpos').value;FP.team=$('#ftm').value;FP.maxp=$('#fmx').value;FP.minm=$('#fmm').value;FP.av=$('#fav').value;fpTTableDraw()};
 ['fq','fmx','fmm'].forEach(i=>$('#'+i).oninput=rd);['fpos','ftm','fav'].forEach(i=>$('#'+i).onchange=rd);fpTTableDraw();
}
function fpTTableDraw(){
 const P=fpFilt(FPD.P,FP),cols=['price','tp','ppg','form','pm','min','g','a','xgi','own'].concat(FPLINK.on?['pxt','pxg']:[]),k=FP.sort.k,dir=FP.sort.d;
 const gk=p=>k==='name'?p.name:k==='tn'?p.tn:fpM(k)[2](p);
 const rows=[...P].sort((a,b)=>{const x=gk(a),y=gk(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;const c=typeof x==='string'?x.localeCompare(y):x-y;return dir>0?c:-c});
 const th=(kk,t)=>`<th class="${kk==='name'||kk==='tn'?'':'n'}" style="cursor:pointer" onclick="fpSort('${kk}')">${esc(t)}${k===kk?(dir<0?' ↓':' ↑'):''}</th>`;
 $('#fout').innerHTML=`<div class="mu" style="margin-bottom:6px">${rows.length} of ${FPD.P.length} players${rows.length>150?' (first 150)':''}. Tap a column to sort.</div><div class="wrap"><table><tr><th></th>${th('name','Player')}${th('tn','Team')}<th>Pos</th>${cols.map(c=>th(c,fpM(c)[1].replace(' (PitchAPI)','*').replace(' (FPL)',''))).join('')}</tr>`+
  rows.slice(0,150).map(p=>`<tr><td><button class="s" onclick="fpAdd(${p.id})" style="min-height:30px;padding:2px 8px">+</button></td><td>${p.st!=='a'?`<span title="${esc(p.nw||'')}" style="color:var(--a)">⚠</span> `:''}${esc(p.name)}</td><td>${esc(p.tn)}</td><td>${FPPOS[p.pos]}</td>${cols.map(c=>{const m=fpM(c),v=m[2](p);return `<td class="n">${v==null?'N/A':v.toFixed(m[3])}</td>`}).join('')}</tr>`).join('')+`</table></div>${FPLINK.on?'<div class="mu" style="font-size:12px;margin-top:6px">* PitchAPI values per 90 minutes.</div>':''}`;
}
function fpTScatter(el){
 el.innerHTML=`<div class="ctl"><select id="sx">${fpMetOpts(FP.sx)}</select><select id="sy">${fpMetOpts(FP.sy)}</select><select id="sp">${fpPosOpts(FP.sp)}</select><input id="sm" type="number" placeholder="Min minutes" value="${esc(FP.sm)}" style="width:120px"></div><div class="ctl"><button class="s" onclick="fpPre('price','tp')">Price vs points</button><button class="s" onclick="fpPre('price','pm')">Price vs value</button><button class="s" onclick="fpPre('own','tp')">Ownership vs points</button><button class="s" onclick="fpPre('xgi','tp')">xGI vs points</button><button class="s" onclick="fpPre('price','xgi90')">Price vs xGI/90</button>${FPLINK.on?'<button class="s" onclick="fpPre(\'price\',\'pxt\')">Price vs xT (PitchAPI)</button>':''}</div><div id="sout"></div><div class="card" id="fpd" style="font-size:13px">Tap a dot for details.</div>`;
 const rd=()=>{FP.sx=$('#sx').value;FP.sy=$('#sy').value;FP.sp=$('#sp').value;FP.sm=$('#sm').value;draw()};
 const draw=()=>{const xm=fpM(FP.sx),ym=fpM(FP.sy),P=fpFilt(FPD.P,{pos:FP.sp,minm:FP.sm}),pts=P.map(p=>({p,x:xm[2](p),y:ym[2](p)})).filter(a=>fpOk(a.x)&&fpOk(a.y));
  $('#sout').innerHTML=`<div class="mu" style="margin-bottom:6px">${pts.length} of ${P.length} players have a value for both metrics. Colours: ${[1,2,3,4].map(k=>`<span style="color:${FPCOL[k]}">● ${FPPOS[k]}</span>`).join(' ')}. The 8 best on both axes are named.</div>`+fpScatter(pts,xm,ym)};
 ['sx','sy','sp'].forEach(i=>$('#'+i).onchange=rd);$('#sm').oninput=rd;draw();
}
function fpPre(x,y){FP.sx=x;FP.sy=y;fpTScatter($('#fpbody'))}
function fpTValue(el){
 el.innerHTML=`<div class="ctl"><select id="vm">${fpMetOpts(FP.vm)}</select><select id="vp">${fpPosOpts(FP.vp)}</select><input id="vn" type="number" placeholder="Min minutes" value="${esc(FP.vmin)}" style="width:120px"><input id="vx" type="number" step="0.1" placeholder="Max price" value="${esc(FP.vmax)}" style="width:110px"></div><div id="vout"></div>`;
 const rd=()=>{FP.vm=$('#vm').value;FP.vp=$('#vp').value;FP.vmin=$('#vn').value;FP.vmax=$('#vx').value;draw()};
 const draw=()=>{const m=fpM(FP.vm),P=fpFilt(FPD.P,{pos:FP.vp,minm:FP.vmin,maxp:FP.vmax}).filter(p=>fpOk(m[2](p))).sort((a,b)=>m[2](b)-m[2](a)),top=P.slice(0,20);
  const mv=fpFilt(FPD.P,{pos:FP.vp}).filter(p=>fpOk(p.chg)&&p.chg!==0),ris=[...mv].sort((a,b)=>b.chg-a.chg).slice(0,8),fal=[...mv].sort((a,b)=>a.chg-b.chg).slice(0,8);
  const mk=a=>a.map(p=>({l:p.name,s:p.tn,v:p.chg,t:(p.chg>0?'+':'')+p.chg.toFixed(1),c:p.chg>0?'#4cc38a':'#e5646b'}));
  $('#vout').innerHTML=`<h3>Top 20 by ${esc(m[1])}</h3>`+(top.length?fpBars(top.map(p=>({l:p.name,s:p.tn+' · £'+p.price.toFixed(1),v:m[2](p),t:m[2](p).toFixed(m[3]),c:FPCOL[p.pos]}))):'<div class="empty">No players match.</div>')+
   `<h3>Biggest price rises since the start of the season (£m)</h3>`+(ris.length?fpBars(mk(ris)):'<div class="empty">No price changes yet.</div>')+`<h3>Biggest price falls (£m)</h3>`+(fal.length?fpBars(mk(fal)):'<div class="empty">No price changes yet.</div>')};
 ['vm','vp'].forEach(i=>$('#'+i).onchange=rd);['vn','vx'].forEach(i=>$('#'+i).oninput=rd);draw();
}
function fpTCompare(el){
 el.innerHTML=`<div class="ctl" style="position:relative"><input id="cq" autocomplete="off" placeholder="Search a player to add (max 6)" value="" style="flex:1;min-width:200px"></div><div id="cres" class="chips"></div><div id="cout"></div>`;
 const res=()=>{const q=fpNz($('#cq').value);const r=q?FPD.P.filter(p=>!FP.sel.includes(p.id)&&fpNz(p.fn+' '+p.sn+' '+p.name+' '+p.tf).includes(q)).sort((a,b)=>(b.total_points||0)-(a.total_points||0)).slice(0,8):[];
  $('#cres').innerHTML=r.map(p=>`<span class="chp" onclick="fpAdd(${p.id})">${esc(p.name)} <span class="mu">${esc(p.tn)} · ${FPPOS[p.pos]} · £${f(p.price,1)}</span></span>`).join('')};
 $('#cq').oninput=res;
 if(!FP.sel.length){$('#cout').innerHTML='<div class="empty">Search above, or press + next to a player in the Table tab. Selected players are compared on every metric, price over time and points per gameweek.</div>';return}
 const S=FP.sel.map(id=>FPD.PB.get(id)).filter(Boolean),ids=S.map(p=>p.id);
 const ms=FPM.filter(m=>FPLINK.on||!/PitchAPI/.test(m[1])),noBest=new Set(['price','chg','tin','tout','min']);
 const best=m=>{if(noBest.has(m[0]))return null;const v=S.map(p=>m[2](p)).filter(fpOk);return v.length>1?Math.max(...v):null};
 const hd=`<div class="chips" style="margin:6px 0">${S.map((p,i)=>`<span class="chp on" style="border-color:${FPPAL[i]}" onclick="fpRm(${p.id})"><span style="color:${FPPAL[i]}">●</span> ${esc(p.name)} ✕</span>`).join('')}</div>`;
 const tb=`<div class="wrap"><table><tr><th></th>${S.map(p=>`<th>${esc(p.name)}<div class="mu" style="font-size:11px;font-weight:400">${esc(p.tn)} · ${FPPOS[p.pos]}</div></th>`).join('')}</tr>${ms.map(m=>{const b=best(m);return `<tr><td class="mu">${esc(m[1])}</td>${S.map(p=>{const v=m[2](p);return `<td class="n ${b!=null&&v===b?'clb':''}">${v==null?'N/A':(b!=null&&v===b?'▲ ':'')+v.toFixed(m[3])}</td>`}).join('')}</tr>`}).join('')}</table></div>`;
 const pr=fpSeries(ids,'val'),pt=fpSeries(ids,'pts'),cu={gws:pt.gws,series:pt.series.map(s=>{let t=0;return {n:s.n,v:s.v.map(v=>{if(v==null)return null;t+=v;return t})}})};
 $('#cout').innerHTML=hd+tb+fpLines(pr.series,pr.gws,'Price (£m) after each match',1)+fpLines(pt.series,pt.gws,'Points per gameweek',0)+fpLines(cu.series,cu.gws,'Cumulative points',0)+`<div class="mu" style="font-size:12px;margin:6px 0">${S.map((p,i)=>`<span style="color:${FPPAL[i]}">${'━ '}${esc(p.name)}</span>`).join(' · ')}. Price is the value recorded with each match, so a change between matches shows at the next one. ▲ marks the highest value among the selected players where higher is better.</div>`;
 res();
}
function fpTTeams(el){
 const ms=[['tp','Total points'],['g','Goals'],['a','Assists'],['cs','Clean sheets'],['bon','Bonus points'],['xgi','xGI (FPL)'],['ap','Average price of regular players (£m)'],['ppm','Points per £m, regular players']];
 el.innerHTML=`<div class="ctl"><select id="tmm">${fpOpts(ms,FP.tm)}</select></div><div id="tout"></div>`;
 const draw=()=>{FP.tm=$('#tmm').value;
  const T=FPD.teams.map(t=>{const P=FPD.P.filter(p=>p.tm===t.id),sum=k=>P.some(p=>fpOk(p[k]))?P.reduce((s,p)=>s+(fpOk(p[k])?p[k]:0),0):null,reg=P.filter(p=>(p.minutes||0)>=270&&p.price!=null);
   const rp=reg.reduce((s,p)=>s+p.price,0),rt=reg.reduce((s,p)=>s+(p.total_points||0),0);
   return {t,tp:sum('total_points'),g:sum('goals_scored'),a:sum('assists'),cs:sum('clean_sheets'),bon:sum('bonus'),xgi:sum('expected_goal_involvements'),ap:reg.length?rp/reg.length:null,ppm:rp>0?rt/rp:null,n:reg.length}});
  const k=FP.tm,dg=(k==='xgi'||k==='ap'||k==='ppm')?(k==='xgi'?1:2):0,L=T.filter(x=>fpOk(x[k])).sort((a,b)=>b[k]-a[k]);
  $('#tout').innerHTML=fpBars(L.map(x=>({l:x.t.n,v:x[k],t:x[k].toFixed(dg),c:'#5aa9e6'})))+
   `<div class="wrap" style="margin-top:10px"><table><tr><th>Team</th><th class="n">Points</th><th class="n">Goals</th><th class="n">Assists</th><th class="n">CS</th><th class="n">Bonus</th><th class="n">xGI</th><th class="n">Avg £m</th><th class="n">Pts/£m</th></tr>${[...T].sort((a,b)=>(b.tp??-1)-(a.tp??-1)).map(x=>`<tr><td>${esc(x.t.n)}</td><td class="n">${f(x.tp,0)}</td><td class="n">${f(x.g,0)}</td><td class="n">${f(x.a,0)}</td><td class="n">${f(x.cs,0)}</td><td class="n">${f(x.bon,0)}</td><td class="n">${f(x.xgi,1)}</td><td class="n">${f(x.ap,2)}</td><td class="n">${f(x.ppm,2)}</td></tr>`).join('')}</table></div><div class="mu" style="font-size:12px;margin-top:6px">Regular players = at least 270 minutes. Totals add the values the source gave; they include players who have since left.</div>`};
 $('#tmm').onchange=draw;draw();
}
function fpTFix(el){
 const d=FPD,nx=d.events.find(e=>e.nxt)||d.events.find(e=>!e.fin),s0=nx?nx.id:1,gws=[0,1,2,3,4].map(i=>s0+i).filter(g=>d.events.some(e=>e.id===g)),CL=['#2e7d4f','#4cc38a','#8a9bb0','#e9b44c','#e5646b'];
 const cell=(t,g)=>d.fix.filter(x=>x[0]===g&&(x[1]===t||x[2]===t)).map(x=>{const h=x[1]===t,o=d.T.get(h?x[2]:x[1])||{};return {o:o.s||'?',h,df:h?x[3]:x[4]}});
 const R=d.teams.map(t=>{const cs=gws.map(g=>cell(t.id,g)),ds=cs.flat().map(c=>c.df).filter(fpOk);return {t,cs,avg:ds.length?ds.reduce((a,b)=>a+b,0)/ds.length:null}}).sort((a,b)=>(a.avg??9)-(b.avg??9));
 el.innerHTML=`<div class="mu" style="margin-bottom:6px">Next ${gws.length} gameweeks, easiest run first. Difficulty is the official FPL rating from 1 (easiest) to 5. Capital letters = home.</div><div class="wrap"><table><tr><th>Team</th>${gws.map(g=>`<th>GW ${g}</th>`).join('')}<th class="n">Avg</th></tr>${R.map(r=>`<tr><td>${esc(r.t.n)}</td>${r.cs.map(c=>`<td>${c.length?c.map(x=>`<span style="display:inline-block;padding:2px 7px;margin:1px;border-radius:6px;background:${CL[Math.min(4,Math.max(0,(x.df||3)-1))]};color:#06210f;font-weight:600;font-size:12px">${esc(x.h?x.o.toUpperCase():x.o.toLowerCase())}</span>`).join(''):'<span class="mu">—</span>'}</td>`).join('')}<td class="n">${f(r.avg,2)}</td></tr>`).join('')}</table></div>`;
}
R.fantasy=async function(el){
 el.innerHTML='<h2>Fantasy</h2><div id="fproot"><div class="empty">Loading…</div></div>';
 let d=null;try{d=await fpLoad()}catch(e){$('#fproot').innerHTML=`<div class="empty">Could not load Fantasy data: ${esc(e.message)}</div>`;return}
 if(!d){$('#fproot').innerHTML='<div class="empty">No Fantasy data yet. It is fetched from the official Fantasy Premier League API during the next synchronization (at most once an hour). Press Synchronize in Settings.</div>';return}
 fpLink();fpRender();
};
/* ===== Predicted points + Best Team: model, optimizer, UI (extends the Fantasy page) ===== */
const PM={N:7,PRIOR_MIN:450,K_FIN:3,N0:4,RECENT:6,EPS:.001,MAXNODES:4000,
 /* v2 playing time (trained on the 2022-23 and 2023-24 archive, validated on 2024-25, tested on 2025-26):
    P(play) = (sum w*played + PL_A*PL_MU)/(sum w + PL_A), w = PL_LAM^age over all earlier matches of the season (age 0 = latest),
    i.e. recency weighting with a Beta prior, so a player who played every recent match gets about 0.90, not 1.00.
    The 60+ share and the minutes when playing are weighted Q_LAM^age over his appearances. PT:0 restores v1. */
 PT:1,PL_LAM:.5,PL_A:.5,PL_MU:.5,Q_LAM:.8};
const PM_VERSION='v2';
const pmAll=v=>({1:v,2:v,3:v,4:v});
/* Fallback scoring, used ONLY for a rule the live data did not reveal (the UI labels each rule live/default). [step, points] */
const PM_DEF={goals_scored:{1:[1,10],2:[1,6],3:[1,5],4:[1,4]},assists:pmAll([1,3]),clean_sheets:{1:[1,4],2:[1,4],3:[1,1],4:[1,0]},goals_conceded:{1:[2,-1],2:[2,-1]},saves:{1:[3,1]},
 penalties_saved:{1:[1,5]},penalties_missed:pmAll([1,-2]),yellow_cards:pmAll([1,-1]),red_cards:pmAll([1,-3]),own_goals:pmAll([1,-2]),bonus:pmAll([1,1]),defensive_contribution:{2:[10,2],3:[12,2],4:[12,2]}};
function pmRule(d,id,t){const r=((d.scoring||{})[id]||{})[String(t)];
 if(r&&r.kind==='step')return {step:r.step,pts:r.pts,src:'live'};
 const f=(PM_DEF[id]||{})[t];return f?{step:f[0],pts:f[1],src:'default'}:{step:1,pts:0,src:'none'}}
function pmMinRule(d,t){const r=((d.scoring||{}).minutes||{})[String(t)];
 if(r&&r.kind==='threshold'&&r.lo!=null&&r.hi!=null)return {lo:r.lo,hi:r.hi,src:'live'};return {lo:1,hi:2,src:'default'}}
function pmPois(l,kmax){const p=[Math.exp(-l)];for(let k=1;k<=kmax;k++)p.push(p[k-1]*l/k);return p}
/* E[floor(X/step)]*pts for X~Poisson(l) */
function pmEStep(l,step,pts){if(!(l>0)||!pts)return 0;const p=pmPois(l,Math.max(25,Math.ceil(l*5+15)));let e=0;for(let k=step;k<p.length;k++)e+=Math.floor(k/step)*p[k];return e*pts}
/* P(X>=k) for X~Poisson(l) */
function pmPGE(l,k){if(!(l>0))return 0;let s=0,p=Math.exp(-l);for(let i=0;i<k;i++){s+=p;p*=l/(i+1)}return Math.max(0,1-s)}
const PM_MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
/* Return date, ONLY when the FPL news text states one ("Expected back 12 Nov", "Suspended until 25 Oct") */
function pmReturn(p,gen){
 const m=/(?:expected back|suspended until|back on|return(?:s|ing)?(?: on| date)?)\D{0,12}(\d{1,2})\s+([A-Za-z]{3})/i.exec(p.nw||'');if(!m)return null;
 const mon=PM_MON[m[2].toLowerCase()];if(mon==null)return null;
 const base=Date.parse(String(gen).replace(' ','T')+'Z'),y=new Date(base).getUTCFullYear();let t=Date.UTC(y,mon,+m[1]);if(t<base-60*864e5)t=Date.UTC(y+1,mon,+m[1]);return t}
const PM_ST={a:'Available',d:'Doubtful',i:'Injured',s:'Suspended',u:'Unavailable',n:'Not in squad'};
const pmStLabel=p=>{const b=PM_ST[p.st]||p.st;return (p.st==='d'&&fpOk(p.chance_of_playing_next_round))?b+' ('+p.chance_of_playing_next_round+'%)':b};
const pmStCol=p=>p.st==='a'?'#4cc38a':p.st==='d'?'#e9b44c':'#e5646b';
/* probability the player is fit for ONE fixture, from published data only */
function pmAvail(p,x,C,d){
 if(p.st==='a')return {a:1,src:'available'};
 const ko=x.ko?Date.parse(x.ko):null,ret=pmReturn(p,d.generated);
 if(ret!=null&&ko!=null)return {a:ko>=ret?1:0,src:'return date in news',ret};
 if(p.st==='u'||p.st==='n')return {a:0,src:'unavailable'};
 const c=p.chance_of_playing_next_round;
 if(fpOk(c))return {a:c/100,src:x.ev===C.next?'published chance (next gameweek)':'published chance carried forward (no later data)'};
 return {a:0,src:'no chance or return date published: treated as unavailable'};
}
function pmCtx(d){
 if(d._pm)return d._pm;
 const H=d.hist||{},ev=d.events,nx=ev.find(e=>e.nxt)||ev.find(e=>!e.fin)||null,next=nx?nx.id:null;
 const gws=next==null?[]:Array.from({length:PM.N},(_,i)=>next+i).filter(g=>ev.some(e=>e.id===g));
 const tm=new Map();
 for(const p of d.P){const rows=H[String(p.id)];if(!rows)continue;
  /* a match with no xG published (2022-23 before gameweek 16) counts its goals instead */
  for(const r of rows){if(!(r[3]>0))continue;const xg=fpOk(r[4])?r[4]:fpOk(r[10])?r[10]:null;if(xg==null)continue;const k=p.tm+'|'+r[0]+'|'+r[7];let o=tm.get(k);if(!o){o={t:p.tm,o:r[7],r:r[0],h:r[8],xg:0};tm.set(k,o)}o.xg+=xg}}
 const T=new Map(d.teams.map(t=>[t.id,{n:0,f:0,a:0}]));let sA=0,nA=0,sH=0,nH=0,sW=0,nW=0;
 for(const o of tm.values()){const q=tm.get(o.o+'|'+o.r+'|'+o.t),t=T.get(o.t);if(!q||!t)continue;t.n++;t.f+=o.xg;t.a+=q.xg;sA+=o.xg;nA++;if(o.h===1){sH+=o.xg;nH++}else{sW+=o.xg;nW++}}
 const mu=nA?sA/nA:null,muH=nH?sH/nH:mu,muA=nW?sW/nW:mu,S=new Map();
 T.forEach((t,id)=>S.set(id,{n:t.n,A:mu?((t.f+mu*PM.N0)/(t.n+PM.N0))/mu:1,D:mu?((t.a+mu*PM.N0)/(t.n+PM.N0))/mu:1,xgf:t.n?t.f/t.n:null,xga:t.n?t.a/t.n:null}));
 let gl=0,xs=0,nSc=0;
 for(const x of d.fix){if(!x[5]||!fpOk(x[6])||!fpOk(x[7]))continue;const a=tm.get(x[1]+'|'+x[0]+'|'+x[2]),b=tm.get(x[2]+'|'+x[0]+'|'+x[1]);if(a&&b){gl+=x[6]+x[7];xs+=a.xg+b.xg;nSc++}}
 const pri={};
 for(const t of [1,2,3,4]){const L=d.P.filter(p=>p.ty===t&&p.minutes>0);
  const f=k=>{const v=L.filter(p=>fpOk(p[k])),n=v.reduce((s,p)=>s+p.minutes/90,0);return n>0?v.reduce((s,p)=>s+p[k],0)/n:null};
  pri[t]={xg:f('expected_goals'),xa:f('expected_assists'),g:f('goals_scored'),a:f('assists'),bon:f('bonus'),yc:f('yellow_cards'),rc:f('red_cards'),og:f('own_goals'),pm:f('penalties_missed'),ps:f('penalties_saved'),sv:f('saves'),dc:f('defensive_contribution')}}
 const fx=new Map();
 for(const x of d.fix){if(x[5])continue;for(const [tm_,home,opp] of [[x[1],true,x[2]],[x[2],false,x[1]]]){const k=tm_+'|'+x[0];if(!fx.has(k))fx.set(k,[]);fx.get(k).push({ev:x[0],opp,home,ko:x[8]||null})}}
 return d._pm={next,gws,S,mu,muH,muA,gr:xs>0?gl/xs:1,grN:nSc,pri,fx,nm:nx?nx.name:'',teamMatches:nA};
}
function pmPlayer(p,C,d){
 const t=p.ty,H=d.hist||{},rows=(H[String(p.id)]||[]).slice().sort((a,b)=>a[0]-b[0]),out={id:p.id,flags:[],gws:[],tot:null,avg:null,q:'low'};
 const fit=p.st!=='a',rec=fit?rows.filter(r=>r[3]>0).slice(-PM.RECENT):rows.slice(-PM.RECENT),pl=rec.filter(r=>r[3]>0);
 if(!(p.minutes>0)||!pl.length){out.q='nodata';out.flags.push(p.minutes>0?'No recent appearances to estimate playing time':'No minutes played this season: no rate can be estimated');return out}
 const n90=p.minutes/90,pm0=PM.PRIOR_MIN/90,P=C.pri[t];
 const shr=(x,pr)=>fpOk(x)&&fpOk(pr)?(x+pr*pm0)/(n90+pm0):null,fin=(g,x)=>fpOk(g)&&fpOk(x)?(g+PM.K_FIN)/(x+PM.K_FIN):null;
 let lamG,lamA;
 const xg90=shr(p.expected_goals,P.xg),fg=fin(p.goals_scored,p.expected_goals),xa90=shr(p.expected_assists,P.xa),fa_=fin(p.assists,p.expected_assists);
 if(xg90!=null&&fg!=null)lamG=xg90*fg;else{lamG=shr(p.goals_scored,P.g);out.flags.push('No xG in the data: goal rate uses goals only')}
 if(xa90!=null&&fa_!=null)lamA=xa90*fa_;else{lamA=shr(p.assists,P.a);out.flags.push('No xA in the data: assist rate uses assists only')}
 if(lamG==null||lamA==null){out.q='nodata';out.flags.push('Goal or assist data missing');return out}
 const R={bon:shr(p.bonus,P.bon),yc:shr(p.yellow_cards,P.yc),rc:shr(p.red_cards,P.rc),og:shr(p.own_goals,P.og),pmi:shr(p.penalties_missed,P.pm),psv:shr(p.penalties_saved,P.ps),sv:shr(p.saves,P.sv),dc:shr(p.defensive_contribution,P.dc)};
 const miss=[];if(R.bon==null)miss.push('bonus');if(R.yc==null)miss.push('cards');if(t===1&&R.sv==null)miss.push('saves');if(t!==1&&R.dc==null)miss.push('defensive contribution');
 if(miss.length)out.flags.push('Not in the data, excluded from the estimate: '+miss.join(', '));
 let pPlay0=fit?1:pl.length/rec.length,p60n=rec.filter(r=>r[3]>=60).length,q60=p60n/pl.length,ePlay=pl.reduce((s,r)=>s+r[3],0)/pl.length;
 /* v2: a flagged (not 'a') player uses only his appearances while fit, so pPlay0 is his residual rotation risk and the
    published availability multiplies it as before (the injury is not counted twice) */
 if(PM.PT){const all=fit?rows.filter(r=>r[3]>0):rows;let sw=0,sy=0,qa=0,q6=0,qm=0;
  for(let i=all.length-1,k=0;i>=0;i--,k++){const r=all[i],w=Math.pow(PM.PL_LAM,k),v=Math.pow(PM.Q_LAM,k);sw+=w;if(r[3]>0){sy+=w;qa+=v;qm+=v*r[3];if(r[3]>=60)q6+=v}}
  pPlay0=(sy+PM.PL_A*PM.PL_MU)/(sw+PM.PL_A);q60=q6/qa;ePlay=qm/qa}
 const g60=rec.filter(r=>r[3]>=60),e60=g60.length?g60.reduce((s,r)=>s+r[3],0)/g60.length:90;
 if(rec.length<4)out.flags.push('Fewer than 4 recent matches to estimate playing time');
 if(p.minutes<270)out.flags.push('Under 270 minutes this season: rates lean on the position average');
 const mr=pmMinRule(d,t),rG=pmRule(d,'goals_scored',t),rA=pmRule(d,'assists',t),rCS=pmRule(d,'clean_sheets',t),rGC=pmRule(d,'goals_conceded',t),rSV=pmRule(d,'saves',t),rDC=pmRule(d,'defensive_contribution',t),rB=pmRule(d,'bonus',t),rY=pmRule(d,'yellow_cards',t),rR=pmRule(d,'red_cards',t),rO=pmRule(d,'own_goals',t),rM=pmRule(d,'penalties_missed',t),rP=pmRule(d,'penalties_saved',t);
 const venue=h=>h?C.muH:C.muA;
 const core=(a,x)=>{
  const St=C.S.get(p.tm),So=C.S.get(x.opp),pPlay=Math.min(1,pPlay0*a),p60=pPlay*q60,e=ePlay/90;
  let fa=1,lc=null,saveF=1;
  if(C.mu&&St&&So){fa=So.D*venue(x.home)/C.mu;lc=venue(!x.home)*So.A*St.D*C.gr;saveF=So.A*venue(!x.home)/C.mu}
  const parts={app:pPlay*(1-q60)*mr.lo+p60*mr.hi,goal:pPlay*e*lamG*fa*rG.pts,ast:pPlay*e*lamA*fa*rA.pts,cs:0,gc:0,sv:0,dc:0,bon:0,card:0};
  if(lc!=null){if(t<=3)parts.cs=rCS.pts*p60*Math.exp(-lc*e60/90);if(t<=2)parts.gc=pPlay*pmEStep(lc*e,rGC.step,rGC.pts)}
  if(t===1&&R.sv!=null)parts.sv=pPlay*pmEStep(R.sv*e*saveF,rSV.step,rSV.pts);
  if(t!==1&&R.dc!=null&&rDC.pts)parts.dc=rDC.pts*pPlay*pmPGE(R.dc*e,rDC.step);
  if(R.bon!=null)parts.bon=pPlay*e*R.bon*rB.pts;
  parts.card=pPlay*e*((R.yc||0)*rY.pts+(R.rc||0)*rR.pts+(R.og||0)*rO.pts+(R.pmi||0)*rM.pts+(t===1?(R.psv||0)*rP.pts:0));
  return {parts,pts:Object.values(parts).reduce((s,v)=>s+v,0),fa,lc,pPlay,e:pPlay*ePlay};
 };
 let anyFew=false,noTeam=!C.mu;
 for(const g of C.gws){const list=C.fx.get(p.tm+'|'+g)||[],items=[];let tot=0,fitTot=0,minE=0;const parts={};
  for(const x of list){const av=pmAvail(p,x,C,d),r=core(av.a,x),rf=core(1,x),So=C.S.get(x.opp),St=C.S.get(p.tm);
   if(So&&St&&(So.n<3||St.n<3))anyFew=true;
   items.push({opp:x.opp,home:x.home,ko:x.ko,av,pts:r.pts,fit:rf.pts,parts:r.parts,fa:r.fa,lc:r.lc,pPlay:r.pPlay,eMin:r.e});tot+=r.pts;fitTot+=rf.pts;minE+=r.e;for(const k in r.parts)parts[k]=(parts[k]||0)+r.parts[k]}
  out.gws.push({ev:g,fx:items,pts:tot,fit:fitTot,none:!list.length,eMin:minE,parts})}
 out.tot=out.gws.reduce((s,g)=>s+g.pts,0);out.fit=out.gws.reduce((s,g)=>s+g.fit,0);out.avg=C.gws.length?out.tot/C.gws.length:null;
 out.g1=out.gws.length?out.gws[0].pts:null;
 out.rates={lamG,lamA,xg90,xa90,finG:fg,finA:fa_,R,pPlay0,q60,ePlay,e60,recN:PM.PT?(fit?rows.filter(r=>r[3]>0).length:rows.length):rec.length,fit};
 out.rules={mr,rG,rA,rCS,rGC,rSV,rDC,rB};
 if(noTeam)out.flags.push('No team xG data yet: opponent factors set to 1 and clean-sheet/goals-conceded points excluded');
 if(anyFew)out.flags.push('An opponent or own team has fewer than 3 matches of team data');
 let q='high';const why=[];
 if(p.st!=='a'){const cp=p.chance_of_playing_next_round;const known=pmReturn(p,d.generated)!=null||fpOk(cp);why.push('Availability: '+pmStLabel(p));q=known?'medium':'low'}
 if(p.minutes<270)q='low';else if(p.minutes<900&&q==='high')q='medium';
 if(rec.length<4&&q==='high')q='medium';
 out.q=q;out.why=why;return out;
}
function pmPredictAll(d){
 if(d._pmPred)return d._pmPred;const C=pmCtx(d);
 d.P.forEach(p=>{p.pm=pmPlayer(p,C,d)});
 return d._pmPred=true;
}

/* ---------- Optimizer ---------- */
function pmRules(d){
 const r=d.rules;if(!r||!r.types)return null;const T={};
 for(const k of [1,2,3,4]){const t=r.types[String(k)];if(!t||!fpOk(t.sel)||!fpOk(t.mn)||!fpOk(t.mx))return null;T[k]={sel:t.sel,mn:t.mn,mx:t.mx}}
 const squad=[1,2,3,4].reduce((s,k)=>s+T[k].sel,0);
 return {T,squad,play:fpOk(r.play)?r.play:11,playSrc:fpOk(r.play)?'game settings':'11, the standard value (not in the API response)',club:fpOk(r.club)?r.club:null,budget:fpOk(r.budget)?r.budget:null};
}
function pmForms(R){
 const o=[];
 for(let g=R.T[1].mn;g<=R.T[1].mx;g++)for(let df=R.T[2].mn;df<=R.T[2].mx;df++)for(let m=R.T[3].mn;m<=R.T[3].mx;m++)for(let f=R.T[4].mn;f<=R.T[4].mx;f++){
  if(g+df+m+f!==R.play||g>R.T[1].sel||df>R.T[2].sel||m>R.T[3].sel||f>R.T[4].sel)continue;o.push({g,d:df,m,f,name:df+'-'+m+'-'+f})}
 return o;
}
/* pool items: {id,t,c(cost, tenths),club,v}. A player is dropped only if at least sel_t+5 players of other clubs-or-same
   (counted by DISTINCT club) are at least as valuable and no more expensive: any squad using him can swap one of them in
   (at most sel_t-1 are already in the squad and at most 5 clubs can be at the club limit). */
function pmPrune(pool,R){
 const by={1:[],2:[],3:[],4:[]};pool.forEach(i=>by[i.t].push(i));const keep=[];
 for(const t of [1,2,3,4]){const L=by[t],need=R.T[t].sel+Math.floor(R.squad/R.club)+1;
  for(const i of L){const cl=new Set();
   for(const j of L){if(j===i)continue;if((j.v>i.v&&j.c<=i.c)||(j.v>=i.v&&j.c<i.c)||(j.v===i.v&&j.c===i.c&&j.id<i.id))cl.add(j.club)}
   if(cl.size<need)keep.push(i)}}
 return keep;
}
function pmDPpos(items,ks,kb,B,dbl,eps){
 const k=ks+kb,n=items.length;if(n<k)return null;
 const NEG=-Infinity,dp=[];for(let j=0;j<=k;j++)dp.push(new Float64Array(B+1).fill(NEG));dp[0][0]=0;
 const ch=new Uint8Array(n*(k+1)*(B+1));
 for(let it=0;it<n;it++){const c=items[it].c,v=items[it].v;
  for(let j=Math.min(k,it+1);j>=1;j--){const val=(j-1<ks)?((dbl&&j===1)?2*v:v):eps*v,prev=dp[j-1],cur=dp[j],base=(it*(k+1)+j)*(B+1);
   for(let b=B;b>=c;b--){const pv=prev[b-c];if(pv===NEG)continue;const cand=pv+val;if(cand>cur[b]){cur[b]=cand;ch[base+b]=1}}}}
 return {F:dp[k],ch,k,n,B,items};
}
function pmBack(r,b){const out=[];let j=r.k;for(let it=r.n-1;it>=0&&j>0;it--){if(r.ch[(it*(r.k+1)+j)*(r.B+1)+b]){out.push(r.items[it]);b-=r.items[it].c;j--}}return out}
function pmConv(F1,F2,B){
 const out=new Float64Array(B+1).fill(-Infinity),arg=new Int16Array(B+1);
 for(let b1=0;b1<=B;b1++){const v1=F1[b1];if(v1===-Infinity)continue;for(let b2=0;b1+b2<=B;b2++){const v2=F2[b2];if(v2===-Infinity)continue;const v=v1+v2;if(v>out[b1+b2]){out[b1+b2]=v;arg[b1+b2]=b1}}}
 return {F:out,arg};
}
function pmNode(P,R,form,tc,bans,cache){
 const ks={1:form.g,2:form.d,3:form.m,4:form.f},rs=[];
 for(const t of [1,2,3,4]){const kb=R.T[t].sel-ks[t],bk=[...bans].filter(id=>P.pos.get(id)===t).sort((a,b)=>a-b).join(','),key=t+'|'+ks[t]+'|'+kb+'|'+(t===tc?1:0)+'|'+bk;
  let r=cache.get(key);if(r===undefined){r=pmDPpos(P.byT[t].filter(i=>!bans.has(i.id)),ks[t],kb,R.budget,t===tc,PM.EPS);cache.set(key,r)}
  if(!r)return null;rs.push(r)}
 const c1=pmConv(rs[0].F,rs[1].F,R.budget),c2=pmConv(c1.F,rs[2].F,R.budget),c3=pmConv(c2.F,rs[3].F,R.budget);
 let bb=-1,bv=-Infinity;for(let b=0;b<=R.budget;b++)if(c3.F[b]>bv){bv=c3.F[b];bb=b}
 if(bv===-Infinity)return null;
 const b3=bb,b2f=b3-c3.arg[b3],b2=c2.arg[c3.arg[b3]],b1=c1.arg[b2],bG=b1,bD=b2-b1,bM=c3.arg[b3]-b2;
 const costs=[bG,bD,bM,b2f];
 const picks={};[1,2,3,4].forEach((t,i)=>{picks[t]=pmBack(rs[i],costs[i])});
 return {val:bv,picks,cost:bb,form,tc};
}
function pmSolveForm(P,R,form,cache){
 const open=[],seen=new Set();let nodes=0;
 const mk=(tc,bans)=>{const key=tc+':'+[...bans].sort((a,b)=>a-b).join(',');if(seen.has(key))return;seen.add(key);nodes++;const r=pmNode(P,R,form,tc,bans,cache);if(r){r.bans=bans;open.push(r)}};
 for(const tc of [1,2,3,4])mk(tc,new Set());
 while(open.length){
  let bi=0;for(let i=1;i<open.length;i++)if(open[i].val>open[bi].val)bi=i;const n=open.splice(bi,1)[0],cnt=new Map();
  for(const t of [1,2,3,4])for(const it of n.picks[t]){if(!cnt.has(it.club))cnt.set(it.club,[]);cnt.get(it.club).push(it)}
  let viol=null;cnt.forEach(a=>{if(a.length>R.club&&(!viol||a.length>viol.length))viol=a});
  if(!viol){n.nodes=nodes;return n}
  if(nodes>PM.MAXNODES)return null;
  for(const it of viol){const nb=new Set(n.bans);nb.add(it.id);mk(n.tc,nb)}
 }
 return null;
}
/* turns picked players into a team: starters = top k per position by value, bench = the rest, captain = best starter */
function pmTeam(picks,form,R,vOf){
 const ks={1:form.g,2:form.d,3:form.m,4:form.f},xi=[],bench=[];
 for(const t of [1,2,3,4]){const a=[...picks[t]].sort((x,y)=>vOf(y)-vOf(x)||x.id-y.id);a.forEach((it,i)=>(i<ks[t]?xi:bench).push(it))}
 bench.sort((x,y)=>(x.t===1?-1:0)-(y.t===1?-1:0)||vOf(y)-vOf(x));
 const ord=[...xi].sort((x,y)=>vOf(y)-vOf(x)||x.id-y.id),cap=ord[0],vice=ord[1]||null;
 const xiPts=xi.reduce((s,i)=>s+vOf(i),0);
 return {form,xi,bench,cap,vice,xiPts,capBonus:cap?vOf(cap):0,total:xiPts+(cap?vOf(cap):0),cost:[...xi,...bench].reduce((s,i)=>s+i.c,0)};
}
function pmValidate(team,R,forms){
 const bad=[],all=[...team.xi,...team.bench],ids=new Set(all.map(i=>i.id));
 if(ids.size!==all.length)bad.push('a player appears twice');
 if(all.length!==R.squad)bad.push('squad size '+all.length+' != '+R.squad);
 if(team.xi.length!==R.play)bad.push('starting XI size '+team.xi.length+' != '+R.play);
 for(const t of [1,2,3,4]){const n=all.filter(i=>i.t===t).length,s=team.xi.filter(i=>i.t===t).length;
  if(n!==R.T[t].sel)bad.push('position '+t+': '+n+' in squad, required '+R.T[t].sel);if(s<R.T[t].mn||s>R.T[t].mx)bad.push('position '+t+': '+s+' starters outside '+R.T[t].mn+'-'+R.T[t].mx)}
 if(forms&&!forms.some(f=>f.g===team.xi.filter(i=>i.t===1).length&&f.d===team.xi.filter(i=>i.t===2).length&&f.m===team.xi.filter(i=>i.t===3).length&&f.f===team.xi.filter(i=>i.t===4).length))bad.push('formation is not a legal one');
 const cc=new Map();all.forEach(i=>cc.set(i.club,(cc.get(i.club)||0)+1));cc.forEach((n,c)=>{if(n>R.club)bad.push('club '+c+' has '+n+' players (limit '+R.club+')')});
 if(team.cost>R.budget)bad.push('cost '+team.cost+' exceeds budget '+R.budget);
 if(!team.cap||!team.xi.includes(team.cap))bad.push('captain is not a starter');
 if(team.vice&&(team.vice===team.cap||!team.xi.includes(team.vice)))bad.push('vice-captain invalid');
 if(team.bench.length!==R.squad-R.play)bad.push('bench size '+team.bench.length);
 for(const t of [1,2,3,4]){const nb=team.bench.filter(i=>i.t===t).length,exp=R.T[t].sel-team.xi.filter(i=>i.t===t).length;if(nb!==exp)bad.push('bench has '+nb+' of position '+t+', expected '+exp)}
 return bad;
}
function pmPoolOf(d,valOf){
 const pool=[];d.P.forEach(p=>{if(!p.pm||p.pm.q==='nodata'||p.st==='u'||p.st==='n'||!fpOk(p.now_cost))return;const v=valOf(p);if(v==null||!isFinite(v))return;pool.push({id:p.id,t:p.ty,c:p.now_cost,club:p.tm,v})});
 return pool;
}
function pmPrep(pool,R){const P={byT:{1:[],2:[],3:[],4:[]},pos:new Map()};
 pmPrune(pool,R).forEach(i=>{P.byT[i.t].push(i);P.pos.set(i.id,i.t)});for(const t of [1,2,3,4])P.byT[t].sort((a,b)=>b.v-a.v||a.id-b.id);return P}
/* Mode 1: one gameweek (or any single value per player). Exact within the pruned pool, for every legal formation. */
function pmMode1(pool,R,forms){
 const P=pmPrep(pool,R),cache=new Map(),vOf=i=>i.v,res=[];
 for(const f of forms){const n=pmSolveForm(P,R,f,cache);if(n){const tm=pmTeam(n.picks,f,R,vOf);res.push({form:f,team:tm,nodes:n.nodes})}}
 res.sort((a,b)=>b.team.total+PM.EPS*0-a.team.total||b.team.cost-a.team.cost);
 return {all:res,best:res[0]||null,poolSize:P.pos.size,full:pool.length};
}
/* Mode 2: one fixed squad for several gameweeks, with the best lineup chosen each week (no transfers). Local search. */
function pmEvalSquad(sq,Vs,R,forms){
 let total=0;const per=[];
 for(let g=0;g<Vs.length;g++){const V=Vs[g],by={1:[],2:[],3:[],4:[]};sq.forEach(i=>by[i.t].push(V.get(i.id)||0));for(const t of [1,2,3,4])by[t].sort((a,b)=>b-a);
  let best=-Infinity,bf=null;
  for(const f of forms){const ks={1:f.g,2:f.d,3:f.m,4:f.f};let s=0,mx=-Infinity;for(const t of [1,2,3,4]){for(let i=0;i<ks[t];i++)s+=by[t][i];if(ks[t]>0&&by[t][0]>mx)mx=by[t][0]}const v=s+mx;if(v>best){best=v;bf=f}}
  per.push({v:best,form:bf});total+=best}
 return {total,per};
}
function pmMode2(d,R,forms,gwIdx){
 const Vs=gwIdx.map(g=>{const m=new Map();d.P.forEach(p=>{if(p.pm&&p.pm.q!=='nodata')m.set(p.id,p.pm.gws[g].pts)});return m});
 const sum=p=>gwIdx.reduce((s,g)=>s+p.pm.gws[g].pts,0),pool=pmPoolOf(d,sum),m1=pmMode1(pool,R,forms);
 if(!m1.best)return null;
 const byId=new Map(pool.map(i=>[i.id,i])),start=[...m1.best.team.xi,...m1.best.team.bench];
 let sq=start.map(i=>({...i})),ev=pmEvalSquad(sq,Vs,R,forms);const base=ev.total;
 const cand=pmPrune(pool,R).sort((a,b)=>b.v-a.v);
 for(let iter=0;iter<60;iter++){
  const cnt=new Map();sq.forEach(i=>cnt.set(i.club,(cnt.get(i.club)||0)+1));const cost=sq.reduce((s,i)=>s+i.c,0);let bestMove=null,bestV=ev.total+1e-9;
  for(let k=0;k<sq.length;k++){const m=sq[k];
   for(const c of cand){if(c.t!==m.t||sq.some(x=>x.id===c.id))continue;if(cost-m.c+c.c>R.budget)continue;
    const cc=(cnt.get(c.club)||0)-(c.club===m.club?1:0);if(cc+1>R.club)continue;
    const t=sq.slice();t[k]=c;const e=pmEvalSquad(t,Vs,R,forms);if(e.total>bestV){bestV=e.total;bestMove={k,c,e}}}}
  if(!bestMove)break;sq[bestMove.k]={...bestMove.c};ev=bestMove.e;
 }
 return {squad:sq,eval:ev,start:base,fixedLineupTeam:m1.best.team,improved:ev.total-base,poolSize:m1.poolSize};
}

/* ---------- UI: Predicted Points ---------- */
Object.assign(FP,{pq:'',ppos:'',pteam:'',pmax:'',pav:'',pqual:'',pshow:false,psort:{k:'tot',d:-1},pdet:null,bm:'gw1',bg:0});
let FPBEST={};
const pmQLab={high:'Higher',medium:'Medium',low:'Low',nodata:'No data'},pmQCol={high:'#4cc38a',medium:'#e9b44c',low:'#e5646b',nodata:'#8a9bb0'};
const pmTeamS=id=>((FPD.T.get(id)||{}).s)||'?';
const pmFxLab=g=>g.none?'—':g.fx.map(x=>pmTeamS(x.opp)+(x.home?' (H)':' (A)')).join(' + ');
const pmDot=p=>`<span title="${esc(pmStLabel(p)+(p.nw?' — '+p.nw:''))}" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${pmStCol(p)};margin-right:5px"></span>`;
const pmNote=()=>`<div class="card mu" style="font-size:12px"><b>Predicted points are model estimates</b> for the next ${pmCtx(FPD).gws.length} gameweeks. They are not historical points: <b>actual season points</b> appear only in the details panel and the Table tab. Estimates are expected values (probability-weighted), so a player who may miss a match carries a fraction of the points he would score if fit.</div>`;
function fpTPred(el){
 const d=FPD;
 if(!d.rules||!d.fix.length||d.fix[0].length<9){el.innerHTML='<div class="empty">Predictions need game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.</div>';return}
 pmPredictAll(d);const C=pmCtx(d);
 if(!C.gws.length){el.innerHTML='<div class="empty">No upcoming gameweek found in the data.</div>';return}
 el.innerHTML=pmNote()+`<div class="ctl"><input id="pq" placeholder="Search player" value="${esc(FP.pq)}"><select id="ppos">${fpPosOpts(FP.ppos)}</select><select id="ptm">${fpTeamOpts(FP.pteam)}</select><input id="pmx" type="number" step="0.1" placeholder="Max price" value="${esc(FP.pmax)}" style="width:110px"><select id="pav">${fpOpts([['','Any availability'],['ok','Available only'],['no','Doubtful, injured or suspended']],FP.pav)}</select><select id="pql">${fpOpts([['','Any data quality'],['high','Higher only'],['medium','Medium or higher']],FP.pqual)}</select><label class="mu" style="align-self:center"><input type="checkbox" id="psh" ${FP.pshow?'checked':''} style="min-height:0"> include players without data</label></div><div id="pout"></div><div id="pdet"></div><div id="pinfo"></div>`;
 const rd=()=>{FP.pq=$('#pq').value;FP.ppos=$('#ppos').value;FP.pteam=$('#ptm').value;FP.pmax=$('#pmx').value;FP.pav=$('#pav').value;FP.pqual=$('#pql').value;FP.pshow=$('#psh').checked;fpPredDraw()};
 ['pq','pmx'].forEach(i=>$('#'+i).oninput=rd);['ppos','ptm','pav','pql','psh'].forEach(i=>$('#'+i).onchange=rd);
 $('#pinfo').innerHTML=pmInfoHtml(d,C);fpPredDraw();if(FP.pdet!=null)fpPredPick(FP.pdet);
}
function fpPredSort(k){FP.psort=FP.psort.k===k?{k,d:-FP.psort.d}:{k,d:(k==='name'||k==='club')?1:-1};fpPredDraw()}
function fpPredDraw(){
 const d=FPD,C=pmCtx(d),rank={high:3,medium:2,low:1,nodata:0};
 let P=fpFilt(d.P,{q:FP.pq,pos:FP.ppos,team:FP.pteam,maxp:FP.pmax,av:FP.pav}).filter(p=>p.pm&&(FP.pshow||p.pm.q!=='nodata'));
 if(FP.pqual)P=P.filter(p=>rank[p.pm.q]>=rank[FP.pqual]);
 const ppm=p=>p.pm.tot!=null&&p.price>0?p.pm.tot/p.price:null,ppm1=p=>p.pm.g1!=null&&p.price>0?p.pm.g1/p.price:null;
 const key=k=>{const m=/^g(\d)$/.exec(k);if(m)return p=>p.pm.gws[+m[1]]?p.pm.gws[+m[1]].pts:null;
  return {name:p=>p.name,club:p=>p.tn,price:p=>p.price,tot:p=>p.pm.tot,avg:p=>p.pm.avg,ppm,ppm1,em:p=>p.pm.gws[0]?p.pm.gws[0].eMin:null,q:p=>rank[p.pm.q]}[k]};
 const kf=key(FP.psort.k),dir=FP.psort.d;
 const rows=[...P].sort((a,b)=>{const x=kf(a),y=kf(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;const c=typeof x==='string'?x.localeCompare(y):x-y;return dir>0?c:-c});
 const th=(k,t,n)=>`<th class="${n?'n':''}" style="cursor:pointer" onclick="fpPredSort('${k}')">${t}${FP.psort.k===k?(dir<0?' ↓':' ↑'):''}</th>`;
 const gh=C.gws.map((g,i)=>th('g'+i,'GW'+g+'<div class="mu" style="font-size:10px;font-weight:400">predicted</div>',1)).join('');
 const cell=g=>g?(g.none?'<span class="mu" title="No fixture in this gameweek">—</span>':`<div class="mu" style="font-size:10px">${esc(pmFxLab(g))}</div><b>${g.pts.toFixed(1)}</b>`):'';
 $('#pout').innerHTML=`<div class="mu" style="margin-bottom:6px">${rows.length} players. Tap a column to sort, tap a name for the factors behind the prediction. Value = predicted points ÷ price in £m.</div><div class="wrap"><table><tr>${th('name','Player')}${th('club','Club')}<th>Pos</th>${th('price','£',1)}${gh}${th('tot','Σ'+C.gws.length+' GW',1)}${th('avg','Avg / GW',1)}${th('ppm','Pts/£m<div class="mu" style="font-size:10px;font-weight:400">'+C.gws.length+' GW</div>',1)}${th('ppm1','Pts/£m<div class="mu" style="font-size:10px;font-weight:400">GW'+C.gws[0]+'</div>',1)}${th('em','Exp. min<div class="mu" style="font-size:10px;font-weight:400">GW'+C.gws[0]+'</div>',1)}${th('q','Data')}</tr>`+
  rows.slice(0,200).map(p=>`<tr><td>${pmDot(p)}<a href="javascript:void(0)" onclick="fpPredPick(${p.id})">${esc(p.name)}</a></td><td>${esc(p.tn)}</td><td>${FPPOS[p.pos]}</td><td class="n">${p.price==null?'N/A':p.price.toFixed(1)}</td>${p.pm.q==='nodata'?`<td colspan="${C.gws.length+5}" class="mu">${esc(p.pm.flags[0]||'No data')}</td>`:C.gws.map((g,i)=>`<td class="n">${cell(p.pm.gws[i])}</td>`).join('')+`<td class="n"><b>${p.pm.tot.toFixed(1)}</b></td><td class="n">${p.pm.avg.toFixed(2)}</td><td class="n">${f(ppm(p),2)}</td><td class="n">${f(ppm1(p),2)}</td><td class="n">${p.pm.gws[0].eMin>0?Math.round(p.pm.gws[0].eMin):'0'}</td>`}<td><span style="color:${pmQCol[p.pm.q]}">● ${pmQLab[p.pm.q]}</span></td></tr>`).join('')+'</table></div>'+(rows.length>200?'<div class="mu">Showing the first 200.</div>':'');
}
function fpPredPick(id){
 const d=FPD,p=d.PB.get(id),b=$('#pdet');FP.pdet=id;if(!p||!b||!p.pm)return;const m=p.pm,C=pmCtx(d);
 if(m.q==='nodata'){b.innerHTML=`<div class="card"><b>${esc(p.fn+' '+p.sn)}</b><div class="mu">${m.flags.map(esc).join('<br>')}</div></div>`;return}
 const r=m.rates,P=C.pri[p.ty],ts=C.S.get(p.tm)||{},pc=v=>v==null?'N/A':v.toFixed(2);
 const comp=['app','goal','ast','cs','gc','sv','dc','bon','card'],cl={app:'Appear.',goal:'Goals',ast:'Assists',cs:'Clean sheet',gc:'Goals conc.',sv:'Saves',dc:'Def. contr.',bon:'Bonus',card:'Cards/other'};
 const used=comp.filter(k=>m.gws.some(g=>Math.abs(g.parts[k]||0)>1e-9));
 const nextFx=m.gws.find(g=>g.fx.length),nf=nextFx?nextFx.fx[0]:null,so=nf?C.S.get(nf.opp):null;
 const str=[],weak=[];
 if(r.xg90!=null&&P.xg!=null){(r.xg90>P.xg*1.3?str:r.xg90<P.xg*.7?weak:[]).push('xG per 90 '+pc(r.xg90)+' vs '+pc(P.xg)+' for the position')}
 if(r.xa90!=null&&P.xa!=null){(r.xa90>P.xa*1.3?str:r.xa90<P.xa*.7?weak:[]).push('xA per 90 '+pc(r.xa90)+' vs '+pc(P.xa))}
 if(r.finG!=null)(r.finG>1.1?str:r.finG<.9?weak:[]).push('finishing ratio (goals+3)/(xG+3) = '+pc(r.finG));
 if(r.pPlay0<.8&&!r.fit)weak.push('played in '+Math.round(r.pPlay0*100)+'% of his last '+r.recN+' matches');else if(r.pPlay0>=.9&&r.q60>=.8)str.push('regular starter: '+Math.round(r.q60*100)+'% of appearances at 60+ minutes');
 if(so){(so.D>1.1?str:so.D<.9?weak:[]).push('next opponent '+pmTeamS(nf.opp)+' concedes '+pc(so.xga)+' xG per match (league average '+pc(C.mu)+')');(so.A>1.1&&p.ty<=3?weak:[]).push('next opponent '+pmTeamS(nf.opp)+' creates '+pc(so.xgf)+' xG per match')}
 const li=a=>a.length?a.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li class="mu">none notable</li>';
 b.innerHTML=`<div class="card" style="font-size:13px"><b style="font-size:15px">${esc(p.fn+' '+p.sn)}</b> · ${esc(p.tf)} · ${FPPOS[p.pos]} · £${f(p.price,1)}m
 <div style="margin:6px 0">${pmDot(p)}<b>${esc(pmStLabel(p))}</b>${p.nw?' — '+esc(p.nw):''} <span class="mu">(FPL status, updated at each synchronization; kept separate from ability)</span></div>
 <div class="grid" style="margin:8px 0"><div class="kpi"><b>${f(p.total_points,0)}</b><span>Actual season points (history)</span></div><div class="kpi"><b>${m.tot.toFixed(1)}</b><span>Predicted, next ${C.gws.length} GW (availability-adjusted)</span></div><div class="kpi"><b>${m.fit.toFixed(1)}</b><span>Predicted if fully fit</span></div><div class="kpi"><b style="color:${pmQCol[m.q]}">${pmQLab[m.q]}</b><span>Data quality</span></div></div>
 ${m.fit-m.tot>0.5?`<div style="color:var(--a);margin-bottom:6px">Availability lowers this player's prediction by ${(m.fit-m.tot).toFixed(1)} points over the period (${esc([...new Set(m.gws.flatMap(g=>g.fx.map(x=>x.av.src)))].join('; '))}).</div>`:''}
 <div class="wrap"><table><tr><th>GW</th><th>Opponent</th><th class="n">Fit prob.</th><th class="n">Exp. min</th>${used.map(k=>`<th class="n">${cl[k]}</th>`).join('')}<th class="n">Predicted</th><th class="n">If fit</th></tr>${m.gws.map(g=>`<tr><td>${g.ev}</td><td>${esc(pmFxLab(g))}</td><td class="n">${g.none?'—':g.fx.map(x=>Math.round(x.av.a*100)+'%').join(' + ')}</td><td class="n">${g.none?'0':Math.round(g.eMin)}</td>${used.map(k=>`<td class="n">${(g.parts[k]||0).toFixed(2)}</td>`).join('')}<td class="n"><b>${g.pts.toFixed(2)}</b></td><td class="n">${g.fit.toFixed(2)}</td></tr>`).join('')}</table></div>
 <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px"><div style="flex:1;min-width:200px"><b>Strengths</b><ul style="margin:4px 0 0 18px;padding:0">${li(str)}</ul></div><div style="flex:1;min-width:200px"><b>Weaknesses</b><ul style="margin:4px 0 0 18px;padding:0">${li(weak)}</ul></div></div>
 <div class="mu" style="margin-top:8px">Rates used (per 90, shrunk toward the position average): goals ${pc(r.lamG)}, assists ${pc(r.lamA)}${p.ty===1?', saves '+pc(r.R.sv):(r.R.dc!=null?', defensive contribution '+pc(r.R.dc):'')}, bonus ${pc(r.R.bon)}. Playing time: ${r.fit?'recent appearances while fit':PM.PT?'all '+r.recN+' matches this season, recent ones weighted most':'last '+r.recN+' matches'}; P(play) ${Math.round(r.pPlay0*100)}%, P(60+ | plays) ${Math.round(r.q60*100)}%, ${Math.round(r.ePlay)} min when playing.${p.px?` PitchAPI cross-check (not used in the prediction): xG/90 ${f(p.px.xg90,2)}, xT/90 ${f(p.px.xt90,2)}.`:''}</div>
 ${m.flags.length?`<div style="margin-top:8px;color:var(--a)"><b>Uncertainty</b><ul style="margin:4px 0 0 18px;padding:0">${m.flags.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></div>`:''}</div>`;
 b.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function pmInfoHtml(d,C){
 const rows=[['minutes','Appearance'],['goals_scored','Goal'],['assists','Assist'],['clean_sheets','Clean sheet'],['goals_conceded','Goals conceded'],['saves','Saves'],['defensive_contribution','Defensive contribution'],['bonus','Bonus'],['yellow_cards','Yellow card'],['red_cards','Red card'],['own_goals','Own goal'],['penalties_missed','Penalty missed'],['penalties_saved','Penalty saved']];
 const cellR=(id,t)=>{if(id==='minutes'){const m=pmMinRule(d,t);return m.lo+' / '+m.hi+(m.src==='default'?' (default)':'')}const r=pmRule(d,id,t);return r.src==='none'?'—':(r.step>1?r.pts+' per '+r.step:String(r.pts))+(r.src==='default'?' (default)':'')};
 const nSc=C.grN;
 return `<details class="card" style="font-size:12px"><summary class="mu"><b>How predictions are calculated, scoring rules and data limits</b></summary>
 <p>Each fixture is predicted separately: <b>expected points = Σ over scoring categories of (expected events × points per event)</b>. Expected events come from per-90 rates shrunk toward the position average (pseudo-evidence of ${PM.PRIOR_MIN} minutes), scaled by expected minutes, and adjusted for the opponent. Goals use xG once (no separate shot-conversion term), multiplied by a finishing ratio (goals+${PM.K_FIN})/(xG+${PM.K_FIN}). Opponent effect for attackers = the opponent's xG conceded per match relative to the league (team strengths shrunk with ${PM.N0} pseudo-matches), with a home/away league average. Clean sheets use a Poisson goal model: P(0 goals) with the opponent's expected xG, calibrated by league goals ÷ xG (${C.gr.toFixed(3)}, from ${nSc} matches). Saves, goals-conceded deductions and defensive-contribution points are expectations of stepwise rules under Poisson counts. A double gameweek adds both fixtures; a blank gameweek is 0 because there is no match.</p>
 <p><b>Scoring rules</b> (points; "(default)" = this rule was not observed in the live data, so the published FPL value is used; the rest were derived from gameweek ${d.scoring_gw==null?'—':d.scoring_gw} live data):</p>
 <div class="wrap"><table><tr><th>Category</th>${[1,2,3,4].map(t=>`<th>${FPPOS[t]}</th>`).join('')}</tr>${rows.map(([id,l])=>`<tr><td>${l}</td>${[1,2,3,4].map(t=>`<td>${cellR(id,t)}</td>`).join('')}</tr>`).join('')}</table></div>
 <p><b>Limits:</b> FPL data has no shots or shots-on-target per player and no opponent shot counts, so xG/xA and team xG (from per-match player xG) are used instead; PitchAPI shots are not used in the model. Defensive-contribution counts are modelled as Poisson from season totals. Injury data is FPL's own status, news text and published chance of playing (next gameweek only); a return date is used only when the news text states one. Beyond the next gameweek a published chance is carried forward unchanged, and a player with no chance or date published is treated as unavailable. Data quality: <i>Higher</i> = 900+ minutes and available; <i>Medium</i> = 270–899 minutes, doubtful with a published chance, or under 4 recent matches; <i>Low</i> = under 270 minutes, or unavailable without a return date. These are data-sufficiency labels, not accuracy percentages; the model has not been backtested here.${d.postponed?` ${d.postponed} postponed fixture(s) have no gameweek yet and are not counted.`:''}</p></details>`;
}

/* ---------- UI: Best Team ---------- */
const pmMoney=c=>'£'+(c/10).toFixed(1)+'m';
function pmCard(p,m,o){
 const sty=o.abs?`position:absolute;left:${o.x.toFixed(1)}%;top:${o.y}%;transform:translate(-50%,-50%);width:${o.w||19}%;min-width:60px;max-width:98px;`:'flex:1 1 0;min-width:62px;max-width:110px;';
 const badge=o.cap?'<span style="position:absolute;top:-7px;right:-5px;background:#e9b44c;color:#0d1520;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:800;line-height:17px">C</span>':o.vice?'<span style="position:absolute;top:-7px;right:-5px;background:#8a9bb0;color:#0d1520;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:800;line-height:17px">V</span>':'';
 return `<div style="${sty}${o.abs?'':'position:relative;'}background:rgba(13,21,32,.9);border:1.5px solid ${pmStCol(p)};border-radius:8px;padding:3px 3px 4px;font-size:11px;line-height:1.25;text-align:center;cursor:pointer" onclick="fpPredPick(${p.id})" title="${esc(pmStLabel(p)+(p.nw?' — '+p.nw:''))}">${badge}<div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div class="mu" style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.tn)} · ${o.abs?'':FPPOS[p.pos]+' · '}${pmMoney(p.now_cost)}</div><div><b style="color:var(--g)">${o.pts}</b>${o.sub?`<span class="mu" style="font-size:10px"> ${o.sub}</span>`:''}</div>${p.st!=='a'?`<div style="font-size:10px;color:${pmStCol(p)}">${esc(pmStLabel(p))}</div>`:''}</div>`;
}
function pmPitchHtml(team,d,ptsOf,subOf){
 const rows={1:[],2:[],3:[],4:[]};team.xi.forEach(i=>rows[i.t].push(i));const yp={4:15,3:40,2:65,1:88};let cards='';
 for(const t of [4,3,2,1]){const a=rows[t];a.forEach((i,k)=>{cards+=pmCard(d.PB.get(i.id),i,{abs:true,x:(k+.5)/a.length*100,y:yp[t],w:Math.min(19,92/Math.max(a.length,1)),cap:team.cap===i,vice:team.vice===i,pts:ptsOf(i),sub:subOf?subOf(i):''})})}
 const ln='position:absolute;border:1.5px solid rgba(255,255,255,.35);';
 return `<div style="position:relative;width:100%;max-width:560px;margin:8px auto;aspect-ratio:5/6;border-radius:10px;overflow:hidden;background:repeating-linear-gradient(0deg,#1d6b43 0 8.33%,#1a5f3b 8.33% 16.66%);border:2px solid rgba(255,255,255,.4)"><div style="${ln}left:0;right:0;top:50%;border-width:1.5px 0 0"></div><div style="${ln}left:35%;width:30%;top:38%;height:24%;border-radius:50%"></div><div style="${ln}left:22%;width:56%;top:0;height:16%;border-top:0"></div><div style="${ln}left:22%;width:56%;bottom:0;height:16%;border-bottom:0"></div>${cards}</div>`;
}
function pmBenchHtml(team,d,ptsOf,subOf){
 return `<div class="mu" style="margin:4px 0">Bench (in order; goalkeeper first)</div><div style="display:flex;gap:6px;flex-wrap:wrap">${team.bench.map((i,k)=>pmCard(d.PB.get(i.id),i,{pts:ptsOf(i),sub:subOf?subOf(i):'',abs:false})).join('')}</div>`;
}
function pmChecks(team,R,forms){
 const bad=pmValidate(team,R,forms),all=[...team.xi,...team.bench],cc=new Map();all.forEach(i=>cc.set(i.club,(cc.get(i.club)||0)+1));
 const mx=Math.max(...cc.values()),mc=[...cc].filter(([c,n])=>n===mx).map(([c])=>pmTeamS(c)).join(', '),cnt=t=>all.filter(i=>i.t===t).length;
 const ok=(b,t)=>`<div style="color:${b?'var(--g)':'var(--r)'}">${b?'✓':'✗'} ${t}</div>`;
 return `<div class="card" style="font-size:12px"><b>Rule checks (computed on this team)</b>${ok(all.length===R.squad&&[1,2,3,4].every(t=>cnt(t)===R.T[t].sel),'Squad of '+all.length+': '+[1,2,3,4].map(t=>cnt(t)+' '+FPPOS[t]).join(', '))}${ok(team.cost<=R.budget,'Cost '+pmMoney(team.cost)+' of '+pmMoney(R.budget)+' budget')}${ok(mx<=R.club,'At most '+mx+' from one club (limit '+R.club+'; '+mc+')')}${ok(team.xi.length===R.play&&!bad.some(x=>/formation|starters/.test(x)),'Legal formation '+team.form.name+' ('+R.play+' starters, source: '+R.playSrc+')')}${ok(!bad.some(x=>/captain|bench/.test(x)),'Captain and vice-captain are starters; bench of '+team.bench.length)}${bad.length?'<div style="color:var(--r)">'+bad.map(esc).join('<br>')+'</div>':''}</div>`;
}
function fpTBest(el){
 const d=FPD;
 if(!d.rules||!d.fix.length||d.fix[0].length<9){el.innerHTML='<div class="empty">The team builder needs game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.</div>';return}
 const R=pmRules(d);if(!R||R.club==null||R.budget==null){el.innerHTML='<div class="empty">The game constraints (budget, club limit, squad structure) are missing from the downloaded data, so no valid team can be built. They come from FPL\'s game settings; press Synchronize again.</div>';return}
 pmPredictAll(d);const C=pmCtx(d);if(!C.gws.length){el.innerHTML='<div class="empty">No upcoming gameweek found.</div>';return}
 el.innerHTML=pmNote()+`<div class="ctl"><select id="bm">${fpOpts([['gw1','Best team for the next gameweek (GW'+C.gws[0]+')'],['w7','Best squad for the next '+C.gws.length+' gameweeks']],FP.bm)}</select><select id="bgw" style="${FP.bm==='w7'?'':'display:none'}">${fpOpts(C.gws.map((g,i)=>[String(i),'Lineup for GW'+g]),String(FP.bg))}</select></div><div id="bout"><div class="empty">Optimizing every legal formation…</div></div>`;
 $('#bm').onchange=()=>{FP.bm=$('#bm').value;fpTBest($('#fpbody'))};$('#bgw').onchange=()=>{FP.bg=+$('#bgw').value;fpBestDraw()};
 setTimeout(fpBestDraw,30);
}
function fpBestDraw(){
 const d=FPD,R=pmRules(d),C=pmCtx(d),forms=pmForms(R),out=$('#bout');if(!out)return;
 const key=d.generated+'|'+FP.bm;let res=FPBEST[key];
 if(!res){
  if(FP.bm==='gw1'){const pool=pmPoolOf(d,p=>p.pm.gws[0].pts),r1=pmMode1(pool,R,forms),r2=pmMode1(pmPoolOf(d,p=>p.pm.gws[0].fit),R,forms);res={r1,r2}}
  else{const idx=C.gws.map((_,i)=>i);res={m2:pmMode2(d,R,forms,idx),idx}}
  FPBEST[key]=res;
 }
 if(FP.bm==='gw1')return pmDrawGw1(out,d,R,C,forms,res);
 return pmDrawW7(out,d,R,C,forms,res);
}
function pmDrawGw1(out,d,R,C,forms,res){
 const b=res.r1.best;if(!b){out.innerHTML='<div class="empty">No valid team exists under the rules with the players that have data.</div>';return}
 const t=b.team,g=C.gws[0],val=i=>d.PB.get(i.id).pm.gws[0].pts,fitv=i=>d.PB.get(i.id).pm.gws[0].fit;
 const second=res.r1.all[1],all=[...t.xi,...t.bench],adj=all.filter(i=>d.PB.get(i.id).st!=='a');
 let cf='';const c=res.r2.best;
 if(c){const ids=new Set(all.map(i=>i.id)),cids=[...c.team.xi,...c.team.bench],add=cids.filter(i=>!ids.has(i.id)),cset=new Set(cids.map(i=>i.id)),drop=all.filter(i=>!cset.has(i.id));
  const picks={1:[],2:[],3:[],4:[]};cids.forEach(i=>picks[i.t].push({...i,v:val(i)}));const blind=pmTeam(picks,c.team.form,R,i=>i.v);
  cf=add.length?`<div class="card" style="font-size:13px"><b>Availability changed the selection.</b> If injuries and doubts were ignored the optimizer would pick ${add.map(i=>esc(d.PB.get(i.id).name)+' ('+esc(pmStLabel(d.PB.get(i.id)))+')').join(', ')} instead of ${drop.map(i=>esc(d.PB.get(i.id).name)).join(', ')}. That availability-blind team is expected to score ${blind.total.toFixed(1)} points once their fitness is counted, against ${t.total.toFixed(1)} for the chosen team.</div>`:'<div class="card mu" style="font-size:13px">Availability did not change the selection: the same 15 players are optimal with and without the injury adjustment.</div>';}
 const sc=i=>val(i).toFixed(1),cap=d.PB.get(t.cap.id),vc=t.vice?d.PB.get(t.vice.id):null;
 const capPlay=(()=>{const gg=cap.pm.gws[0];return gg.fx.length?1-gg.fx.reduce((s,x)=>s*(1-x.pPlay),1):0})(),viceExtra=vc?(1-capPlay)*val(t.vice):0;
 out.innerHTML=`<div class="grid"><div class="kpi"><b>${t.form.name}</b><span>Formation chosen</span></div><div class="kpi"><b>${t.total.toFixed(1)}</b><span>Predicted points, starting XI incl. captain, GW${g}</span></div><div class="kpi"><b>${pmMoney(t.cost)}</b><span>Squad cost</span></div><div class="kpi"><b>${pmMoney(R.budget-t.cost)}</b><span>Budget remaining</span></div><div class="kpi"><b>${(all.reduce((s,i)=>s+val(i),0)).toFixed(1)}</b><span>Predicted, whole squad (bench included, no captain bonus)</span></div></div>
 <div class="mu" style="margin:8px 0">Period: gameweek ${g} only. Captain ${esc(cap.name)} scores double (expected extra ${val(t.cap).toFixed(1)}); vice-captain ${vc?esc(vc.name):'—'} takes over only if the captain does not play${vc?` (P(captain plays) ${Math.round(capPlay*100)}%, expected vice bonus ${viceExtra.toFixed(2)}, not included in the total)`:''}.</div>
 ${pmPitchHtml(t,d,sc,i=>'')}${pmBenchHtml(t,d,sc)}
 <h3>Formation comparison (each is the exact optimum for that formation)</h3>${tbl([['Formation'],['Predicted XI + captain',1],['Cost',1],['']],res.r1.all.map(r=>[r.form.name,r.team.total.toFixed(2),pmMoney(r.team.cost),r===res.r1.all[0]?'<span class="tag ok">chosen</span>':(r.team.total-res.r1.all[0].team.total).toFixed(2)]))}
 <div class="mu" style="font-size:12px;margin:6px 0">${esc(t.form.name)} is chosen because its best valid team has the highest predicted total${second?`; the next best, ${esc(second.form.name)}, is ${(t.total-second.team.total).toFixed(2)} points lower`:''}. The objective is total expected points within the budget and rules, not points per £.</div>
 ${cf}${adj.length?`<div class="card" style="font-size:12px"><b>Players with an availability flag in this squad</b><br>${adj.map(i=>{const p=d.PB.get(i.id);return esc(p.name)+' — '+esc(pmStLabel(p))+': '+val(i).toFixed(2)+' predicted vs '+fitv(i).toFixed(2)+' if fully fit'+(p.nw?' ('+esc(p.nw)+')':'')}).join('<br>')}</div>`:''}
 ${pmChecks(t,R,forms)}
 <h3>Squad value (period = GW${g})</h3>${tbl([['Player'],['Club'],['Pos'],['£',1],['Role'],['Predicted GW'+g,1],['Pts/£m (GW'+g+')',1]],[...t.xi,...t.bench].map(i=>{const p=d.PB.get(i.id);return [esc(p.name),esc(p.tn),FPPOS[p.pos],(p.now_cost/10).toFixed(1),t.xi.includes(i)?(t.cap===i?'XI · captain':t.vice===i?'XI · vice':'XI'):'Bench',val(i).toFixed(2),(val(i)/(p.now_cost/10)).toFixed(2)]}))}
 <div class="mu" style="font-size:12px;margin:6px 0">Optimization: exact for the candidate pool (${res.r1.poolSize} of ${res.r1.full} players after a lossless dominance prune), using dynamic programming over the budget with branch and bound for the club limit. Bench order breaks ties among equal-value squads (weight ${PM.EPS}); FPL automatic substitutions are not simulated.</div>`;
}
function pmDrawW7(out,d,R,C,forms,res){
 const m=res.m2;if(!m){out.innerHTML='<div class="empty">No valid squad exists under the rules with the players that have data.</div>';return}
 const gi=Math.min(FP.bg,C.gws.length-1),g=C.gws[gi],vOf=i=>d.PB.get(i.id).pm.gws[gi].pts,per=m.eval.per[gi],picks={1:[],2:[],3:[],4:[]};m.squad.forEach(i=>picks[i.t].push(i));
 const t=pmTeam(picks,per.form,R,vOf),sum7=i=>d.PB.get(i.id).pm.tot,all=[...t.xi,...t.bench];
 const adj=m.squad.filter(i=>d.PB.get(i.id).st!=='a');
 out.innerHTML=`<div class="grid"><div class="kpi"><b>${m.eval.total.toFixed(1)}</b><span>Predicted points over ${C.gws.length} GW (best lineup each week, incl. captain)</span></div><div class="kpi"><b>${pmMoney(t.cost)}</b><span>Squad cost</span></div><div class="kpi"><b>${pmMoney(R.budget-t.cost)}</b><span>Budget remaining</span></div><div class="kpi"><b>${t.form.name}</b><span>Formation for GW${g}</span></div><div class="kpi"><b>${t.total.toFixed(1)}</b><span>GW${g} starting XI incl. captain</span></div></div>
 <div class="mu" style="margin:8px 0">This mode picks <b>one fixed 15-player squad</b> and chooses the best legal lineup, formation and captain for every gameweek. <b>Transfers, chips, free-transfer limits and price changes are not modelled</b> because the app does not know your current team. Pitch: lineup for GW${g}. Cards show the GW${g} prediction and, in grey, the ${C.gws.length}-GW total.</div>
 ${pmPitchHtml(t,d,i=>vOf(i).toFixed(1),i=>'Σ'+sum7(i).toFixed(0))}${pmBenchHtml(t,d,i=>vOf(i).toFixed(1),i=>'Σ'+sum7(i).toFixed(0))}
 <h3>Lineup by gameweek</h3>${tbl([['GW'],['Formation'],['Predicted XI + captain',1]],C.gws.map((gw,k)=>[gw,m.eval.per[k].form.name,m.eval.per[k].v.toFixed(2)]))}
 ${adj.length?`<div class="card" style="font-size:12px"><b>Players with an availability flag in this squad</b><br>${adj.map(i=>{const p=d.PB.get(i.id);return esc(p.name)+' — '+esc(pmStLabel(p))+': '+p.pm.tot.toFixed(1)+' predicted vs '+p.pm.fit.toFixed(1)+' if fully fit over the period'}).join('<br>')}</div>`:''}
 ${pmChecks(t,R,forms)}
 <h3>Squad value (period = ${C.gws.length} GW)</h3>${tbl([['Player'],['Club'],['Pos'],['£',1],['Predicted '+C.gws.length+' GW',1],['Pts/£m ('+C.gws.length+' GW)',1],['Availability']],m.squad.map(i=>{const p=d.PB.get(i.id);return [esc(p.name),esc(p.tn),FPPOS[p.pos],(p.now_cost/10).toFixed(1),p.pm.tot.toFixed(1),(p.pm.tot/(p.now_cost/10)).toFixed(2),esc(pmStLabel(p))]}))}
 <div class="mu" style="font-size:12px;margin:6px 0">Optimization: the squad starts from the exact optimum when one lineup is used for all ${C.gws.length} weeks (${m.start.toFixed(1)} predicted points), then improves by single-player swaps with weekly rotation (+${m.improved.toFixed(1)}). This is a local search: it respects every rule but is not proven globally optimal. Predicted totals for ${C.gws.length} gameweeks carry more uncertainty than the next gameweek.</div>`;
}
/* ===== Backtest (leak-free): replays every finished gameweek using ONLY data from earlier gameweeks ===== */
const BT={start:4,key:'',res:null,busy:false,line:null,lineBusy:false};
/* [field name the live model reads on a player, short column name in the stored match history] */
const BT_MAP=[['minutes','min'],['expected_goals','xg'],['goals_scored','gl'],['expected_assists','xa'],['assists','as'],['bonus','bon'],['yellow_cards','yc'],['red_cards','rc'],['own_goals','og'],['penalties_missed','pmi'],['penalties_saved','psv'],['saves','sv'],['defensive_contribution','dc']];
const btIx=d=>{const m={};(d.hcols||[]).forEach((c,i)=>m[c]=i);return m};
/* sum of the values that exist; null (missing) when no row has the value. Missing is never turned into 0. */
/* xG and xA of matches where they were not published (2022-23 before gameweek 16) are missing, not zero: the player's xG over the
   matches that have it is scaled to all his minutes, so his per-90 rate is kept; with none, the model uses goals and assists only */
function btXgScale(o,prior,ix){
 for(const [pf,hc] of [['expected_goals','xg'],['expected_assists','xa']]){const j=ix[hc];if(j===undefined)continue;let mA=0,mX=0,s=0;
  for(const x of prior){const m=x[ix.min];if(!(m>0))continue;mA+=m;if(fpOk(x[j])){mX+=m;s+=x[j]}}
  if(mA>mX)o[pf]=mX>0?s*mA/mX:null}
}
const btSum=(rows,j)=>{let s=null;if(j===undefined)return s;for(const x of rows){const v=x[j];if(fpOk(v))s=(s||0)+v}return s};
const btAvg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const btYield=()=>new Promise(r=>setTimeout(r,0));
/* the club a player really played for in gameweek r (from his opponent + home flag in that round); falls back to his current club */
function btTeamAt(p,rr,fixR,ix){
 const x0=rr[0],o=x0[ix.opp],h=x0[ix.h];
 if(!fpOk(o)||(h!==0&&h!==1))return p.tm;
 const c=fixR.filter(x=>h===1?x[2]===o:x[1]===o).map(x=>h===1?x[1]:x[2]);
 if(!c.length)return p.tm;
 return c.includes(p.tm)?p.tm:c[0];
}
/* One gameweek r. Everything the model sees is rebuilt from rows with round < r:
   player totals, team strengths, league averages, position priors, finished fixtures. Round r fixtures are marked unplayed with no score. */
function btRound(d,P,H,ix,fixAll,r){
 const ev=d.events.filter(e=>e.id<=r).map(e=>Object.assign({},e,{fin:e.id<r,cur:false,nxt:e.id===r}));
 const fixR=fixAll.filter(x=>x[0]===r);
 const fix=fixAll.filter(x=>x[0]<r).concat(fixR.map(x=>{const y=x.slice();y[5]=0;y[6]=null;y[7]=null;return y}));
 const sh=[],tg=[],Hp={};
 for(const p of P){
  const rows=H[String(p.id)];if(!rows)continue;
  const rr=rows.filter(x=>x[0]===r),prior=rows.filter(x=>x[0]<r),tm=rr.length?btTeamAt(p,rr,fixR,ix):p.tm;
  const o={id:p.id,ty:p.ty,tm,st:'a',nw:'',chance_of_playing_next_round:null,name:p.name};
  for(const [pf,hc] of BT_MAP)o[pf]=btSum(prior,ix[hc]);btXgScale(o,prior,ix);
  Hp[String(p.id)]=prior;sh.push(o);
  if(rr.length)tg.push({p,o,rr,prior});
 }
 const dd=Object.assign({},d,{events:ev,fix,P:sh,hist:Hp});delete dd._pm;delete dd._pmPred;
 const C=pmCtx(dd),out=[];let excl=0,nofx=0;
 for(const t of tg){
  const m=pmPlayer(t.o,C,dd);
  if(m.q==='nodata'){excl++;continue}
  const g=m.gws[0];if(!g||g.none||!g.fx.length){nofx++;continue}
  const act=btSum(t.rr,ix.pts);if(act==null)continue;
  const amin=btSum(t.rr,ix.min),n=g.fx.length;
  const pts=t.prior.map(x=>x[ix.pts]).filter(fpOk),mins=t.prior.map(x=>x[ix.min]).filter(fpOk);
  const bs=btAvg(pts),b5=btAvg(pts.slice(-5)),m5=btAvg(mins.slice(-5)),l5=mins.slice(-5),q5=l5.length?l5.filter(x=>x>0).length/l5.length:null;
  if(bs==null||b5==null||m5==null||q5==null)continue;
  const pv=t.rr[t.rr.length-1][ix.val];
  out.push({r,id:t.p.id,name:t.p.name,pos:t.p.ty,club:t.o.tm,pred:g.pts,bs:bs*n,b5:b5*n,act,amin,eMin:g.eMin,mb:m5*n,
   pp:1-g.fx.reduce((s,x)=>s*(1-x.pPlay),1),pb:1-Math.pow(1-q5,n),played:amin==null?null:(amin>0?1:0),pr:t.o.minutes,price:fpOk(pv)?pv:null,n,q:m.q});
 }
 return {rows:out,excl,nofx,targets:tg.length};
}
async function btRun(d,onP){
 const ix=btIx(d);
 for(const k of ['r','pts','min','opp','h','val'])if(ix[k]===undefined)throw new Error('the stored match history has no "'+k+'" column: press Synchronize once');
 const H={};Object.keys(d.hist||{}).forEach(k=>{H[k]=d.hist[k].slice().sort((a,b)=>a[0]-b[0])});
 const fixAll=d.fix.filter(x=>x[0]),rounds=d.events.filter(e=>e.fin&&e.id>=2).map(e=>e.id).sort((a,b)=>a-b);
 const rows=[];let excl=0,nofx=0,targets=0;
 for(const r of rounds){
  const x=btRound(d,d.P,H,ix,fixAll,r);
  x.rows.forEach(y=>rows.push(y));excl+=x.excl;nofx+=x.nofx;targets+=x.targets;
  if(onP)onP(r);await btYield();
 }
 return {rows,rounds,excl,nofx,targets,at:d.generated};
}

/* ---------- metrics (pure functions) ---------- */
function btStat(rows,k){
 const v=rows.filter(x=>fpOk(x[k]));const n=v.length;if(!n)return null;
 let a=0,s=0,b=0;v.forEach(x=>{const e=x[k]-x.act;a+=Math.abs(e);s+=e*e;b+=e});
 return {n,mae:a/n,rmse:Math.sqrt(s/n),bias:b/n};
}
/* paired by gameweek: mean MAE gain of model a over baseline b (positive = a better), its standard error across gameweeks, and the number of gameweeks a won */
function btCmp(rows,a,b,minN){
 const by=new Map();
 rows.forEach(x=>{let o=by.get(x.r);if(!o){o={n:0,a:0,b:0};by.set(x.r,o)}o.n++;o.a+=Math.abs(x[a]-x.act);o.b+=Math.abs(x[b]-x.act)});
 const ds=[...by.values()].filter(o=>o.n>=minN).map(o=>(o.b-o.a)/o.n),k=ds.length;
 if(!k)return null;
 const mu=btAvg(ds),sd=k>1?Math.sqrt(ds.reduce((s,x)=>s+(x-mu)*(x-mu),0)/(k-1)):null;
 return {k,mu,se:sd==null?null:sd/Math.sqrt(k),wins:ds.filter(x=>x>0).length};
}
function btBrier(rows,k){
 const v=rows.filter(x=>x.played!=null&&fpOk(x[k]));
 return v.length?{n:v.length,b:v.reduce((s,x)=>s+(x[k]-x.played)*(x[k]-x.played),0)/v.length}:null;
}
function btCalib(rows){
 return [[0,.2],[.2,.4],[.4,.6],[.6,.8],[.8,1.0001]].map(([lo,hi])=>{
  const v=rows.filter(x=>x.played!=null&&x.pp>=lo&&x.pp<hi);
  return {lo,hi:Math.min(hi,1),n:v.length,pred:v.length?btAvg(v.map(x=>x.pp)):null,obs:v.length?btAvg(v.map(x=>x.played)):null};
 });
}
/* Captain: each gameweek every method picks the single highest-predicted player of a pool (players with enough earlier minutes). */
function btCaptain(rows,minPrior,minPool){
 const by=new Map();
 rows.forEach(x=>{if((x.pr||0)<minPrior)return;if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
 const keys=['pred','b5','bs'],res={};keys.forEach(k=>res[k]={n:0,pts:0,reg:0,top10:0});
 const detail=[];let rounds=0,orc=0;
 [...by.keys()].sort((a,b)=>a-b).forEach(r=>{
  const L=by.get(r);if(L.length<minPool)return;
  rounds++;
  const sorted=[...L].sort((a,b)=>b.act-a.act||a.id-b.id),best=sorted[0];orc+=best.act;
  const row={r,best};
  keys.forEach(k=>{
   const pick=L.reduce((a,b)=>(b[k]>a[k]||(b[k]===a[k]&&b.id<a.id))?b:a);
   const rank=sorted.findIndex(x=>x.id===pick.id)+1,o=res[k];
   o.n++;o.pts+=pick.act;o.reg+=best.act-pick.act;if(rank<=10)o.top10++;row[k]=pick;
  });
  detail.push(row);
 });
 return {rounds,oracle:rounds?orc/rounds:null,res,detail};
}
/* Team selection: each gameweek, build the best legal squad/XI from scratch with the real optimizer, valuing players by the model / last-5 average / (hindsight) actual points. Prices are the price recorded for that gameweek. */
async function btLineup(d,rows,start,onP){
 const R=pmRules(d);
 if(!R||R.club==null||R.budget==null)throw new Error('game constraints (budget / club limit / squad structure) are missing from the data');
 const forms=pmForms(R),by=new Map();
 rows.forEach(x=>{if(x.price==null)return;if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
 const out=[];
 for(const r of [...by.keys()].sort((a,b)=>a-b).filter(r=>r>=start)){
  const L=by.get(r),act=new Map(L.map(x=>[x.id,x.act])),res={r};
  for(const [k,key] of [['model','pred'],['b5','b5'],['oracle','act']]){
   const m=pmMode1(L.map(x=>({id:x.id,t:x.pos,c:x.price,club:x.club,v:x[key]})),R,forms);
   if(!m.best){res[k]=null;continue}
   const t=m.best.team;
   res[k]={pts:t.xi.reduce((s,i)=>s+act.get(i.id),0)+(t.cap?act.get(t.cap.id):0),form:t.form.name,bad:pmValidate(t,R,forms).length,cap:t.cap?t.cap.id:null};
  }
  out.push(res);if(onP)onP(r);await btYield();
 }
 return out;
}

/* ---------- UI ---------- */
function fpTBack(el){
 const d=FPD,ix=btIx(d),au=(d.haudit||{}).f||{},tot=(d.haudit||{}).rows||0;
 const done=d.events.filter(e=>e.fin).map(e=>e.id).filter(r=>r>=2),mx=done.length?Math.max(...done):0;
 const intro=`<div class="card mu" style="font-size:12px"><b>What this tests.</b> Every finished gameweek is replayed as if it had not been played: the model sees only matches from <b>earlier</b> gameweeks (player totals, team strengths, league averages and position priors are all rebuilt from those rows), then its prediction is compared with the points the player actually scored. Baselines: the player's average points per match over his last 5 matches, and over the season so far, multiplied by his number of fixtures. Model tested: <b>v2 = the model used in Predicted Points</b> (playing-time model trained on archived seasons).</div>`;
 if(!Object.keys(d.hist||{}).length||ix.gl===undefined){el.innerHTML=intro+'<div class="empty">The stored match history is in the old short format, so most inputs of the model cannot be replayed. Press Synchronize in Settings once: it re-downloads every player history (a few minutes), then reopen this tab.</div>';return}
 if(mx<2){el.innerHTML=intro+'<div class="empty">A backtest needs at least 2 finished gameweeks (one to learn from, one to predict).</div>';return}
 const miss=BT_MAP.filter(([pf,hc])=>!(au[hc]>0)).map(([pf])=>pf);
 BT.start=Math.max(2,Math.min(BT.start,mx));
 el.innerHTML=intro+(miss.length?`<div class="card" style="font-size:12px;color:var(--a)">History fields FPL did not return at all (these inputs are missing, not zero): ${miss.map(esc).join(', ')}. Components that need them are left out of the replay, exactly as in the live model.</div>`:'')+
  `<div class="ctl"><select id="btst">${fpOpts(Array.from({length:mx-1},(_,i)=>[String(i+2),'Evaluate from GW'+(i+2)]),String(BT.start))}</select><button class="s" id="btrun">Re-run</button></div><div id="btout"><div class="empty">Replaying gameweeks…</div></div>`;
 $('#btst').onchange=()=>{BT.start=+$('#btst').value;btDraw()};
 $('#btrun').onclick=()=>{BT.res=null;BT.line=null;btGo()};
 btGo();
}
async function btGo(){
 const d=FPD,key=d.generated;
 if(BT.res&&BT.key===key){btDraw();return}
 if(BT.busy)return;
 BT.busy=true;
 try{
  BT.res=await btRun(d,r=>{const e=$('#btout');if(e)e.innerHTML=`<div class="empty">Replaying gameweek ${r}… (no future data is used)</div>`});
  BT.key=key;BT.line=null;
 }catch(e){const o=$('#btout');if(o)o.innerHTML=`<div class="empty">Backtest failed: ${esc(e.message)}</div>`;BT.busy=false;return}
 BT.busy=false;btDraw();
}
async function btLine(){
 if(BT.lineBusy||!BT.res)return;
 BT.lineBusy=true;
 try{const res=await btLineup(FPD,BT.res.rows,BT.start,r=>{const e=$('#btlmsg');if(e)e.textContent='Optimizing gameweek '+r+'…'});BT.line={start:BT.start,res}}
 catch(e){BT.line={start:BT.start,err:e.message}}
 BT.lineBusy=false;btDraw();
}
function btLineHtml(){
 const L=BT.line,head='<h3>Team selection test</h3>';
 const intro='<div class="mu" style="font-size:12px;margin-bottom:6px">Each gameweek the real Best Team optimizer (budget, 3-per-club rule, legal formations, captain) builds a team from scratch, once valuing players by the model and once by the last-5 average. "Hindsight" values players by the points they actually scored: an unreachable ceiling that shows how much is left. Team points = starting XI + captain bonus; the bench and automatic substitutions are not counted. The price used is the one recorded for that gameweek.</div>';
 if(!L||L.start!==BT.start)return head+intro+`<div class="ctl"><button class="s" onclick="btLine()" ${BT.lineBusy?'disabled':''}>Run team selection test</button></div><div class="mu" style="font-size:12px">This one is slow: about 5 seconds per gameweek on a computer in my synthetic test, probably longer on a phone. The page stays usable between gameweeks.</div><div class="ctl" style="display:none"></div><div id="btlmsg" class="mu">${BT.lineBusy?'Working…':''}</div>`;
 if(L.err)return head+`<div class="empty">Could not run: ${esc(L.err)}</div>`;
 const R=L.res.filter(x=>x.model&&x.b5&&x.oracle);
 if(!R.length)return head+'<div class="empty">No gameweek produced a valid team for all three methods.</div>';
 const m=a=>btAvg(R.map(x=>x[a].pts)),bad=R.reduce((s,x)=>s+x.model.bad+x.b5.bad+x.oracle.bad,0),w=R.filter(x=>x.model.pts>x.b5.pts).length,t=R.filter(x=>x.model.pts===x.b5.pts).length;
 return head+intro+`<div class="grid"><div class="kpi"><b>${f(m('model'),1)}</b><span>Model team, mean points per GW</span></div><div class="kpi"><b>${f(m('b5'),1)}</b><span>Last-5 average team</span></div><div class="kpi"><b>${f(m('oracle'),1)}</b><span>Hindsight ceiling</span></div><div class="kpi"><b>${w} / ${R.length}</b><span>GWs where the model team beat last-5${t?' ('+t+' ties)':''}</span></div></div>`+
  tbl([['GW',1],['Model',1],['Last-5',1],['Hindsight',1],['Model formation']],R.map(x=>[x.r,f(x.model.pts,0),f(x.b5.pts,0),f(x.oracle.pts,0),esc(x.model.form)]))+
  `<div class="mu" style="font-size:12px;margin-top:6px">Rule violations found by the validator in the ${R.length*3} teams: ${bad}.</div>`;
}
function btDraw(){
 const o=$('#btout');if(!o||!BT.res)return;
 const rows=BT.res.rows.filter(x=>x.r>=BT.start);
 if(!rows.length){o.innerHTML='<div class="empty">No player-gameweeks in this range.</div>';return}
 const rs=[...new Set(rows.map(x=>x.r))].sort((a,b)=>a-b),pl=new Set(rows.map(x=>x.id)).size;
 const S={pred:btStat(rows,'pred'),b5:btStat(rows,'b5'),bs:btStat(rows,'bs')};
 const c5=btCmp(rows,'pred','b5',20),cS=btCmp(rows,'pred','bs',20);
 const imp=(a,b)=>a&&b?(1-a.mae/b.mae)*100:null,sg=v=>v==null?'N/A':(v>0?'+':'')+v.toFixed(1)+'%';
 const sr=(n,s,b)=>[n,s.n,f(s.mae,3),f(s.rmse,3),(s.bias>0?'+':'')+f(s.bias,3),b?sg(imp(S.pred,s)):''];
 const cmpTxt=(c,n)=>c?`vs ${n}: the model had the lower average error in <b>${c.wins} of ${c.k}</b> gameweeks; mean MAE gain ${f(c.mu,3)} points${c.se!=null?' ± '+f(1.96*c.se,3)+' (95% interval across gameweeks)':''}.`:`vs ${n}: not enough data.`;
 const warn=rs.length<5?`<div class="card" style="font-size:13px;color:var(--a)"><b>Small sample:</b> only ${rs.length} gameweek${rs.length>1?'s':''}. Treat every number below as provisional; it becomes meaningful as the season grows.</div>`:'';
 const pos=[1,2,3,4].map(t=>{const L=rows.filter(x=>x.pos===t);if(!L.length)return null;const a=btStat(L,'pred'),b=btStat(L,'b5');return [FPPOS[t],a.n,f(a.mae,3),f(b.mae,3),sg(imp(a,b)),f(a.rmse,3),f(b.rmse,3),(a.bias>0?'+':'')+f(a.bias,3)]}).filter(Boolean);
 const byR=rs.map(r=>{const L=rows.filter(x=>x.r===r);return {r,n:L.length,a:btStat(L,'pred'),b:btStat(L,'b5'),c:btStat(L,'bs')}});
 /* minutes */
 const mr=rows.filter(x=>x.amin!=null),mm=btStat(mr.map(x=>({pred:x.eMin,b5:x.mb,act:x.amin})),'pred'),mb=btStat(mr.map(x=>({pred:x.eMin,b5:x.mb,act:x.amin})),'b5');
 const br=btBrier(rows,'pp'),bb=btBrier(rows,'pb'),pr0=mr.length?btAvg(mr.map(x=>x.played)):null,b0=pr0==null?null:btAvg(mr.map(x=>(pr0-x.played)*(pr0-x.played)));
 const cal=btCalib(rows).filter(x=>x.n>0);
 /* captain */
 const cp=btCaptain(rows,180,20),cr=cp.res;
 const ct=cp.rounds?tbl([['Method'],['Mean points of the pick',1],['Mean regret vs best player',1],['Pick in the actual top 10',1]],
  [['Model ('+PM_VERSION+')','pred'],['Last-5 average','b5'],['Season average','bs']].map(([n,k])=>[n,f(cr[k].pts/cr[k].n,2),f(cr[k].reg/cr[k].n,2),cr[k].top10+' / '+cr[k].n])
  .concat([['Hindsight best player',f(cp.oracle,2),'0.00','—']]))
  +`<div class="mu" style="font-size:12px;margin:6px 0">Pool: players with at least 180 minutes before that gameweek (at least 20 such players). Points are single (not doubled). The model is also compared with the last-5 pick gameweek by gameweek below.</div>`+
  tbl([['GW',1],['Model pick'],['Pts',1],['Last-5 pick'],['Pts',1],['Best in pool'],['Pts',1]],cp.detail.map(x=>[x.r,esc(x.pred.name),f(x.pred.act,0),esc(x.b5.name),f(x.b5.act,0),esc(x.best.name),f(x.best.act,0)]))
  :'<div class="empty">Not enough players in the pool to test captain picks yet.</div>';
 o.innerHTML=warn+`<div class="grid"><div class="kpi"><b>${rows.length}</b><span>Player-gameweeks tested</span></div><div class="kpi"><b>${pl}</b><span>Different players</span></div><div class="kpi"><b>GW${rs[0]}–${rs[rs.length-1]}</b><span>${rs.length} gameweeks</span></div><div class="kpi"><b style="font-size:13px">${esc(BT.res.at||'')}</b><span>Data version (UTC)</span></div></div>
 <div class="mu" style="font-size:12px;margin:6px 0">Not in the sample: ${BT.res.excl} player-gameweeks where the model had no estimate (no earlier minutes) and ${BT.res.nofx} where no matching fixture was found. Players with no minutes all season are not in the stored history.</div>
 <h3>Points accuracy (lower error is better)</h3>`+
 tbl([['Method'],['N',1],['MAE',1],['RMSE',1],['Bias (pred − actual)',1],['Model MAE gain',1]],[sr('Model '+PM_VERSION,S.pred,false),sr('Last-5 average',S.b5,true),sr('Season average',S.bs,true)])+
 `<div class="mu" style="font-size:12px;margin:6px 0">${cmpTxt(c5,'last-5 average')}<br>${cmpTxt(cS,'season average')}<br>MAE = mean absolute error, RMSE = root mean squared error (punishes big misses), both in FPL points per player-gameweek. A positive "gain" means the model's average error is smaller than the baseline's. Errors are large for every method because single-match points are very noisy.</div>
 <h3>By position</h3>`+tbl([['Pos'],['N',1],['MAE model',1],['MAE last-5',1],['Gain',1],['RMSE model',1],['RMSE last-5',1],['Bias',1]],pos)+
 `<h3>By gameweek</h3>`+fpLines([{n:'Model',v:byR.map(x=>x.a?x.a.mae:null)},{n:'Last-5',v:byR.map(x=>x.b?x.b.mae:null)},{n:'Season avg',v:byR.map(x=>x.c?x.c.mae:null)}],rs,'MAE per gameweek (lower is better)',2)+
 `<div class="mu" style="font-size:12px;margin:4px 0">Colour order: model, last-5, season average.</div>`+tbl([['GW',1],['N',1],['MAE model',1],['MAE last-5',1],['MAE season',1],['RMSE model',1]],byR.map(x=>[x.r,x.n,f(x.a&&x.a.mae,3),f(x.b&&x.b.mae,3),f(x.c&&x.c.mae,3),f(x.a&&x.a.rmse,3)]))+
 `<h3>Minutes and playing probability</h3>`+(mm?tbl([['Method'],['N',1],['Minutes MAE',1],['Brier score (P(play))',1]],[['Model '+PM_VERSION,mm.n,f(mm.mae,1),f(br&&br.b,4)],['Last-5 average',mb.n,f(mb.mae,1),f(bb&&bb.b,4)],['Constant (overall rate '+(pr0==null?'N/A':Math.round(pr0*100)+'%')+')','',' ',f(b0,4)]]):'<div class="empty">No minutes data.</div>')+
 `<div class="mu" style="font-size:12px;margin:6px 0">Minutes MAE: average gap between expected and actual minutes in the gameweek. Brier score: mean squared gap between the predicted probability of playing at all and what happened (0 = perfect; lower is better). Calibration: among players given about X% chance to play, how many played.</div>`+
 (cal.length?tbl([['Predicted chance'],['N',1],['Average predicted',1],['Played',1]],cal.map(x=>[Math.round(x.lo*100)+'–'+Math.round(x.hi*100)+'%',x.n,f(x.pred*100,0)+'%',f(x.obs*100,0)+'%'])):'')+
 `<h3>Captain picks</h3>`+ct+btLineHtml()+oxBtHtml()+
 `<h3>Not tested here</h3><div class="card mu" style="font-size:12px">Injuries, suspensions and news: FPL keeps no historical record of them, so every player is treated as available in the replay (the live model does adjust for them). Transfers, chips and price changes are not tested. Scoring rules are assumed constant through the season. A player who changed club is placed in his real club for the gameweek being predicted, but his earlier matches count toward his current club's data. The replay uses FPL fields only (xG, xA, minutes, bonus and the other history columns); PitchAPI data is not used. Model v2's five playing-time parameters were tuned on the 2022-23 and 2023-24 seasons, so replays of those two archived seasons are partly in-sample; 2024-25 was the validation season and 2025-26 the untouched test season (error 1.845 → 1.716 against v1).</div>`;
}

/* ===== Optimal Starting XI · My XI builder · My XI vs Optimal XI · multi-gameweek forecast =====
   Extends the Fantasy page. Every number comes from the prediction model above (pmPlayer, availability-adjusted
   expected points per fixture) and the rules downloaded from FPL (pmRules). Nothing here is hardcoded. */
const OX={mode:'budget',gi:0,hz:3,src:'cur',ver:'v1',btVer:'v1',N:2000,cache:{},my:null,sel:null,pq:'',ppos:'',pteam:'',msg:'',pen:undefined,penBusy:null,bt:null,btBusy:false,fcSeq:0};
const OXCOL=['#3987e5','#d95926','#199e70'],OXDASH=['','7 4','2 3'];
const OX_LS={cur:'fpl_myxi_cur_v1',saved:'fpl_myxi_saved_v1',log:'fpl_ox_log_v1',cal:'fpl_ox_cal_v1'};
/* Lineup ranges are widened by kappa around their mean. Default 1.25: in the leak-free replay of 2026/27 (checked 2026-10-20),
   simulated XI totals were too narrow (80% ranges held 71% of real totals); kappa fitted on GW2-4 restored 79% coverage on
   GW5-6. Running the calibration in the Backtest tab refits kappa on all finished gameweeks and stores it on this device. */
const OX_KAPPA=1.19;
const oxKs=fm=>({1:fm.g,2:fm.d,3:fm.m,4:fm.f});
const oxYield=()=>new Promise(r=>setTimeout(r,0));
const oxLsGet=(k,def)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):def}catch(e){return def}};
const oxLsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const oxSeason=d=>{const e=(d.events||[])[0];return e&&e.dl?String(e.dl).slice(0,4):'?'};
const oxR1=v=>Math.round(v*10)/10;
const oxVerLabel=()=>(typeof PM_VERSION!=='undefined'?PM_VERSION:'v1')+(OX.ver==='v2'?' + penalty regression':'');
const oxP=v=>v==null?'N/A':Math.round(v*100)+'%';

/* ---------- inputs ---------- */
function oxReady(){
 const d=FPD;
 if(!d.rules||!d.fix.length||d.fix[0].length<9)return {err:'Projections need game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.'};
 const RU=pmRules(d);
 if(!RU||RU.club==null)return {err:'The game constraints (club limit, positions per formation) are missing from the downloaded data, so no valid lineup can be built. They come from FPL\'s game settings; press Synchronize again.'};
 pmPredictAll(d);const C=pmCtx(d);
 if(!C.gws.length)return {err:'No upcoming gameweek with fixtures was found in the data.'};
 if(RU.budget==null&&OX.mode==='budget')OX.mode='any';
 OX.gi=Math.max(0,Math.min(OX.gi,C.gws.length-1));
 return {d,C,RU,forms:pmForms(RU)};
}
const oxG=(p,gi)=>p&&p.pm&&p.pm.gws&&p.pm.gws[gi]?p.pm.gws[gi]:null;
const oxV=(p,gi)=>{const g=oxG(p,gi);return g?g.pts:null};
const oxHasPred=p=>!!(p&&p.pm&&p.pm.q!=='nodata'&&p.pm.gws&&p.pm.gws.length);
const oxPPlay=g=>g&&g.fx.length?1-g.fx.reduce((s,x)=>s*(1-x.pPlay),1):0;
function oxFdr(d,ev,tm,opp){const x=d.fix.find(y=>y[0]===ev&&((y[1]===tm&&y[2]===opp)||(y[2]===tm&&y[1]===opp)));return x?(x[1]===tm?x[3]:x[4]):null}
function oxFx(d,p,gi,long){const g=oxG(p,gi);if(!g)return '—';if(g.none)return long?'No fixture (blank)':'blank';
 return g.fx.map(x=>{const df=oxFdr(d,g.ev,p.tm,x.opp);return pmTeamS(x.opp)+(x.home?' (H)':' (A)')+(long&&df!=null?' · FDR '+df:'')}).join(' + ')}
/* share of the last 6 team matches the player started (FPL history "st" column) */
function oxStarts(d,p){const ix=btIx(d);if(ix.st===undefined)return null;const rows=((d.hist||{})[String(p.id)]||[]).slice().sort((a,b)=>a[0]-b[0]).slice(-6);
 if(!rows.length)return null;const v=rows.map(r=>r[ix.st]).filter(fpOk);return v.length?{k:v.filter(x=>x>0).length,n:v.length}:null}

/* ---------- optimizer: starting XI only (no bench, no budget) ----------
   Exact: maximise Σ expected points + captain's points (captain scores double) over every legal formation,
   with at most "club" players per club. Best-first branch and bound: the relaxation (top k per position,
   ignoring the club limit) is an upper bound; a node over the limit branches by banning one player of the
   offending club (any valid XI omits at least one of them), so the first valid node taken is optimal. */
function oxSolveXI(items,RU,forms){
 const byT={1:[],2:[],3:[],4:[]};items.forEach(i=>{if(byT[i.t])byT[i.t].push(i)});for(const t of [1,2,3,4])byT[t].sort((a,b)=>b.v-a.v||a.id-b.id);
 const all=[];let proven=true;
 for(const fm of forms){const ks=oxKs(fm);
  const relax=bans=>{const xi=[];for(const t of [1,2,3,4]){let n=0;for(const i of byT[t]){if(n>=ks[t])break;if(bans.has(i.id))continue;xi.push(i);n++}if(n<ks[t])return null}
   let s=0,mx=-Infinity;xi.forEach(i=>{s+=i.v;if(i.v>mx)mx=i.v});return {xi,val:s+mx,bans}};
  const open=[],seen=new Set();let nodes=0,sol=null;
  const push=b=>{const k=[...b].sort((x,y)=>x-y).join(',');if(seen.has(k))return;seen.add(k);nodes++;const r=relax(b);if(r)open.push(r)};
  push(new Set());
  while(open.length){
   let bi=0;for(let i=1;i<open.length;i++)if(open[i].val>open[bi].val)bi=i;const n=open.splice(bi,1)[0],cnt=new Map();
   n.xi.forEach(i=>{if(!cnt.has(i.club))cnt.set(i.club,[]);cnt.get(i.club).push(i)});
   let viol=null;cnt.forEach(a=>{if(a.length>RU.club&&(!viol||a.length>viol.length))viol=a});
   if(!viol){sol=n;break}
   if(nodes>20000){proven=false;break}
   for(const it of viol){const nb=new Set(n.bans);nb.add(it.id);push(nb)}
  }
  if(sol)all.push({form:fm,team:oxTeam(sol.xi,fm),nodes});
 }
 all.sort((a,b)=>b.team.total-a.team.total||a.team.cost-b.team.cost);
 return {all,best:all[0]||null,proven};
}
/* captain = highest expected starter, vice = second (ties: lower FPL id, so the result is reproducible) */
function oxTeam(xi,form){
 const ord=[...xi].sort((x,y)=>y.v-x.v||x.id-y.id),cap=ord[0]||null,vice=ord[1]||null,s=xi.reduce((a,i)=>a+i.v,0);
 return {form,xi,cap,vice,bench:[],xiPts:s,total:s+(cap?cap.v:0),cost:xi.reduce((a,i)=>a+i.c,0)};
}
/* the model's XI for gameweek index gi. mode 'any' = best XI at any price; 'budget' = XI of the best squad of 15 within the FPL budget
   (existing exact squad optimizer, bench valued only as a tie-break). Cached per data version, model version, mode and gameweek. */
function oxOptimal(X,gi,mode){
 const key=[X.d.generated,OX.ver,mode,gi].join('|');if(!OX.cache[key])OX.cache[key]=oxOptimal0(X,gi,mode);return OX.cache[key];
}
async function oxOptimal0(X,gi,mode){
 const {d,RU,forms}=X,pool=pmPoolOf(d,p=>{const g=oxG(p,gi);return g?g.pts:null});let res;
 if(mode==='budget'){await oxYield();const m=pmMode1(pool,RU,forms);
  if(!m.best)res={err:'No valid squad of '+RU.squad+' exists within the budget with the players that have projections.'};
  else{const b=m.best.team,xi=b.xi.map(i=>({...i}));const fm=b.form,t=oxTeam(xi,fm);
   t.cap=xi.find(i=>i.id===b.cap.id)||t.cap;t.vice=b.vice?xi.find(i=>i.id===b.vice.id)||t.vice:t.vice;t.total=t.xiPts+(t.cap?t.cap.v:0);
   t.bench=b.bench.map(i=>({...i}));t.squadCost=b.cost;
   res={team:t,all:m.all.map(r=>({form:r.form,team:{total:r.team.total,cost:r.team.cost}})),pool:m.poolSize,full:m.full,proven:true,mode,gi}}}
 else{const m=oxSolveXI(pool,RU,forms);res=m.best?{team:m.best.team,all:m.all,pool:pool.length,full:pool.length,proven:m.proven,mode,gi}:{err:'No legal starting XI exists with the players that have projections.'}}
 if(!res.err)res.bad=oxCheckXI(res.team.xi.map(i=>i.id),res.team.cap&&res.team.cap.id,res.team.vice&&res.team.vice.id,X);
 if(gi===0&&!res.err)oxLogRecord(X,res);return res;
}

/* ---------- validity of any XI (model or user) ---------- */
function oxFormOf(ids,d){const c={1:0,2:0,3:0,4:0};ids.forEach(id=>{const p=d.PB.get(id);if(p)c[p.ty]++});return c}
function oxCheckXI(ids,cap,vice,X){
 const {d,RU,forms}=X,bad=[],c=oxFormOf(ids,d);
 if(ids.length!==RU.play)bad.push(ids.length+' of '+RU.play+' starters selected');
 if(new Set(ids).size!==ids.length)bad.push('a player is selected twice');
 if(ids.some(id=>!d.PB.get(id)))bad.push('a selected player is no longer in the FPL data');
 if(ids.length===RU.play&&!forms.some(f=>f.g===c[1]&&f.d===c[2]&&f.m===c[3]&&f.f===c[4]))bad.push('formation '+c[1]+' GKP, '+c[2]+'-'+c[3]+'-'+c[4]+' is not legal');
 const cc=new Map();ids.forEach(id=>{const p=d.PB.get(id);if(p)cc.set(p.tm,(cc.get(p.tm)||0)+1)});cc.forEach((n,t)=>{if(n>RU.club)bad.push(n+' players from '+pmTeamS(t)+' (limit '+RU.club+')')});
 if(cap==null)bad.push('no captain chosen');else if(!ids.includes(cap))bad.push('captain is not in the XI');
 if(vice!=null&&(vice===cap||!ids.includes(vice)))bad.push('vice-captain must be a different starter');
 return bad;
}
/* cheapest legal bench that completes this XI into a squad of 15 (positions + club limit). Greedy by price; returns null if none. */
function oxCheapBench(ids,X){
 const {d,RU}=X,c=oxFormOf(ids,d),cc=new Map(),inX=new Set(ids),bench=[];
 ids.forEach(id=>{const p=d.PB.get(id);if(p)cc.set(p.tm,(cc.get(p.tm)||0)+1)});
 for(const t of [1,2,3,4]){let need=RU.T[t].sel-c[t];if(need<0)return null;
  const L=d.P.filter(p=>p.ty===t&&!inX.has(p.id)&&fpOk(p.now_cost)&&p.st!=='u'&&p.st!=='n').sort((a,b)=>a.now_cost-b.now_cost||a.id-b.id);
  for(const p of L){if(!need)break;if((cc.get(p.tm)||0)>=RU.club)continue;bench.push(p);cc.set(p.tm,(cc.get(p.tm)||0)+1);need--}
  if(need)return null}
 return {bench,cost:bench.reduce((s,p)=>s+p.now_cost,0)};
}

/* ---------- uncertainty: Monte Carlo of the same model ----------
   Each player-fixture is simulated with exactly the inputs pmPlayer used, so the simulated mean equals the expected points shown:
   plays ~ Bernoulli(P(play) incl. availability); 60+ min ~ Bernoulli(q60); goals, assists, saves, defensive actions, cards ~ Poisson;
   bonus = 2 × Poisson(rate/2) (same mean). Goals are drawn ONCE per team and fixture: the team's goals G ~ Poisson(Λ) are shared
   out to its players (multinomial, so one goal has one scorer; assists likewise) and thinned to the opponent's goals conceded, so
   team-mates' attacking returns move together and against the opposing defence. Λ is fixed per team and fixture from ALL its
   players (max of the opponent's conceded rate, the sum of the players' goal rates and the sum of their assist rates), so a player's
   own distribution does not depend on who else is simulated; Poisson thinning keeps his goals and assists exactly Poisson with
   his own rates, so the simulated mean still equals the expected points shown. The opponent's goals conceded are thinned again by each defender's share
   of the match, so his clean sheet and goals-conceded deductions follow his own minutes. */
function oxRng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
function oxBin(n,p,u){let k=0;for(let i=0;i<n;i++)if(u()<p)k++;return k}
function oxParams(p,gi,d,C){
 const m=p.pm;if(!m._ox)m._ox={};if(m._ox[gi])return m._ox[gi];
 const g=m.gws[gi];if(!g||!m.rates){m._ox[gi]=[];return []}
 const r=m.rates,t=p.ty,RL=m.rules,Rt=r.R,rr=id=>pmRule(d,id,t);
 const cards=[[Rt.yc,rr('yellow_cards').pts],[Rt.rc,rr('red_cards').pts],[Rt.og,rr('own_goals').pts],[Rt.pmi,rr('penalties_missed').pts]].concat(t===1?[[Rt.psv,rr('penalties_saved').pts]]:[]).filter(([a,b])=>a>0&&b);
 const out=g.fx.map(x=>{const So=C.S.get(x.opp),St=C.S.get(p.tm),saveF=(C.mu&&So&&St)?So.A*(x.home?C.muA:C.muH)/C.mu:1;
  const fk=g.ev+'|'+(x.home?p.tm+'|'+x.opp:x.opp+'|'+p.tm)+'|'+(x.ko||'');
  return {ak:fk+'|'+p.tm,ck:fk+'|'+x.opp,pPlay:x.pPlay,q60:r.q60,e:r.ePlay/90,e60:r.e60,lo:RL.mr.lo,hi:RL.mr.hi,
   lg:r.lamG*x.fa,la:r.lamA*x.fa,pG:RL.rG.pts,pA:RL.rA.pts,lc:x.lc,pCS:(x.lc!=null&&t<=3)?RL.rCS.pts:0,gcStep:(x.lc!=null&&t<=2)?RL.rGC.step:0,gcPts:RL.rGC.pts,
   sv:(t===1&&Rt.sv!=null)?Rt.sv*saveF:null,svStep:RL.rSV.step,svPts:RL.rSV.pts,dc:(t!==1&&Rt.dc!=null&&RL.rDC.pts)?Rt.dc:null,dcStep:RL.rDC.step,dcPts:RL.rDC.pts,
   bon:Rt.bon!=null?Rt.bon:0,bPts:RL.rB.pts,cards}});
 /* exp(-rate) of every Poisson count, computed once (null = rate 0, nothing to draw) */
 const ex=l=>l>0?Math.exp(-l):null;
 out.forEach(q=>{q.gl=q.e*q.lg;q.al=q.e*q.la;q.xG=ex(q.e*q.lg);q.xA=ex(q.e*q.la);q.xS=q.sv!=null?ex(q.sv*q.e):null;q.xD=q.dc!=null?ex(q.dc*q.e):null;q.xB=q.bon>0?ex(q.e*q.bon/2):null;q.xC=q.cards.map(([a,b])=>[ex(a*q.e),b]).filter(c=>c[0]!=null);q.xL=q.lc!=null?ex(q.lc):null});
 m._ox[gi]=out;return out;
}
/* Poisson draw from a precomputed exp(-rate) (Knuth); cap = stop counting at cap (only "at least cap" matters) */
function oxPx(L,u,cap){if(L==null)return 0;let k=0,p=u();while(p>L){k++;if(cap&&k>=cap)return k;p*=u()}return k}
/* ng/na: the player's goals and assists already shared out from his team's goals (oxDrawSet); null = draw them independently */
function oxDraw(q,G,u,ng,na){
 if(!(u()<q.pPlay))return 0;
 const s60=u()<q.q60;let v=s60?q.hi:q.lo;
 if(ng!=null)v+=ng*q.pG+na*q.pA;
 else{if(q.xG!=null)v+=oxPx(q.xG,u)*q.pG;if(q.xA!=null)v+=oxPx(q.xA,u)*q.pA}
 if(G){if(q.pCS&&s60&&oxBin(G,q.e60/90,u)===0)v+=q.pCS;if(q.gcStep)v+=Math.floor(oxBin(G,q.e,u)/q.gcStep)*q.gcPts}
 else if(q.pCS&&s60&&G===0)v+=q.pCS;
 if(q.xS!=null)v+=Math.floor(oxPx(q.xS,u)/q.svStep)*q.svPts;
 if(q.xD!=null&&oxPx(q.xD,u,q.dcStep)>=q.dcStep)v+=q.dcPts;
 if(q.xB!=null)v+=2*oxPx(q.xB,u)*q.bPts;
 for(let i=0;i<q.xC.length;i++)v+=oxPx(q.xC[i][0],u)*q.xC[i][1];
 return v;
}
/* joint draw of a set of players in one gameweek. pls: [{id,fx:oxParams(...)}]. oxPlan groups their fixtures by team and match
   (computed once); oxDrawSet(plan,u) then returns one simulated score per player, in the order of pls. */
/* team scale Λ per team and fixture, from the fixtures (oxParams) of every player with a prediction */
function oxLam(fxs){
 const M=new Map(),get=k=>{let o=M.get(k);if(!o){o={sg:0,sa:0,lc:0};M.set(k,o)}return o};
 for(const fx of fxs)for(const q of fx){const a=get(q.ak);a.sg+=q.gl;a.sa+=q.al;if(q.lc!=null){const c=get(q.ck);c.lc=Math.max(c.lc,q.lc)}}
 M.forEach(o=>o.L=Math.max(o.lc,o.sg,o.sa));return M;
}
function oxPlan(pls,lam){
 const F=[],grp=new Map(),get=k=>{let g=grp.get(k);if(!g){g={k,sc:[],as:[],lc:null,L:0,xL:null,G:0,c:0};grp.set(k,g)}return g};
 pls.forEach((pl,j)=>pl.fx.forEach(q=>{const i=F.length;F.push({j,q,ng:0,na:0,g:null});const a=get(q.ak);
  if(q.gl>0)a.sc.push([i,q.gl]);if(q.al>0)a.as.push([i,q.al]);
  if(q.lc!=null){const c=get(q.ck);c.lc=c.lc==null?q.lc:Math.max(c.lc,q.lc);F[i].g=c}}));
 const G=[...grp.values()];G.forEach(g=>{const sg=g.sc.reduce((x,y)=>x+y[1],0),sa=g.as.reduce((x,y)=>x+y[1],0);const T=lam&&lam.get(g.k);g.L=Math.max(T?T.L:0,g.lc||0,sg,sa);
  g.xL=g.L>0?Math.exp(-g.L):null;const sh=L=>L.map(([i,r])=>[i,r/g.L]);g.sc=sh(g.sc);g.as=sh(g.as);g.pc=g.lc!=null&&g.L>0?Math.min(1,g.lc/g.L):0});
 return {n:pls.length,F,G};
}
/* multinomial share-out of n goals over members [[index,share]] (shares sum to at most 1; the rest is "nobody in the set") */
function oxShare(n,M,F,f,u){let rem=n,mass=1;for(const [i,p] of M){if(!rem){F[i][f]=0;continue}const pr=mass>p?p/mass:1,k=pr>=1?rem:oxBin(rem,pr,u);F[i][f]=k;rem-=k;mass-=p}}
function oxDrawSet(P,u){
 for(const g of P.G){const n=g.xL==null?0:oxPx(g.xL,u);g.G=n;g.c=g.pc>0&&n?(g.pc>=1?n:oxBin(n,g.pc,u)):0;oxShare(n,g.sc,P.F,'ng',u);oxShare(n,g.as,P.F,'na',u)}
 const pts=new Float64Array(P.n);for(const f of P.F)pts[f.j]+=oxDraw(f.q,f.g?f.g.c:null,u,f.ng,f.na);return pts;
}
/* lineups: [{per:[{ids,cap}|null per gameweek of gis]}]. Common random numbers: each player's and each team's draws are shared by all lineups. */
function oxSim(d,C,lineups,gis,N,seed){
 const u=oxRng(seed),out=lineups.map(()=>({gw:gis.map(()=>new Float64Array(N)),tot:new Float64Array(N),ok:true}));
 lineups.forEach((L,j)=>{if(L.per.some(e=>!e))out[j].ok=false});
 const plan=gis.map((gi,k)=>{const s=new Set();lineups.forEach(L=>{const e=L.per[k];if(e)e.ids.forEach(id=>s.add(id))});const ids=[...s],ix=new Map(ids.map((id,i)=>[id,i]));
  const lam=oxLam(d.P.filter(oxHasPred).map(p=>oxParams(p,gi,d,C)));
  return {ix,P:oxPlan(ids.map(id=>({id,fx:oxParams(d.PB.get(id),gi,d,C)})),lam)}});
 for(let s=0;s<N;s++)for(let k=0;k<gis.length;k++){
  const {ix,P}=plan[k],pts=oxDrawSet(P,u);
  lineups.forEach((L,j)=>{const e=L.per[k];if(!e)return;let v=0;for(const id of e.ids)v+=pts[ix.get(id)];if(e.cap!=null&&e.ids.includes(e.cap))v+=pts[ix.get(e.cap)];out[j].gw[k][s]=v;out[j].tot[s]+=v});
 }
 return out;
}
function oxK(){const c=oxLsGet(OX_LS.cal,null);return c&&FPD&&c.season===oxSeason(FPD)&&fpOk(c.kappa)?Math.min(2,Math.max(1,c.kappa)):OX_KAPPA}
function oxWiden(a,k){let m=0;for(const v of a)m+=v;m/=a.length;return k===1?a:a.map(v=>m+k*(v-m))}
/* lineup-level quantiles and differences, with the calibrated widening */
const oxQs=a=>oxQ(oxWiden(a,oxK()));
function oxDiffS(a,b){const n=a.length,dd=new Float64Array(n);for(let i=0;i<n;i++)dd[i]=a[i]-b[i];const w=oxWiden(dd,oxK());let p=0,t=0;for(const v of w){if(v>1e-9)p++;else if(Math.abs(v)<=1e-9)t++}return Object.assign(oxQ(w),{pWin:p/n,pTie:t/n})}
function oxQ(a){const s=Float64Array.from(a).sort(),q=x=>s[Math.min(s.length-1,Math.max(0,Math.round(x*(s.length-1))))];let m=0;for(const v of a)m+=v;return {mean:m/a.length,p10:q(.1),p50:q(.5),p90:q(.9)}}
function oxDiff(a,b){const n=a.length,dd=new Float64Array(n);let w=0,t=0;for(let i=0;i<n;i++){dd[i]=a[i]-b[i];if(dd[i]>1e-9)w++;else if(Math.abs(dd[i])<=1e-9)t++}return Object.assign(oxQ(dd),{pWin:w/n,pTie:t/n})}
/* analytic expectation of a lineup in gameweek gi (the number shown everywhere; the simulation only supplies the range) */
function oxExp(d,ids,cap,gi){let s=0;for(const id of ids)s+=oxV(d.PB.get(id),gi)||0;if(cap!=null&&ids.includes(cap))s+=oxV(d.PB.get(cap),gi)||0;return s}

/* ---------- set pieces: verified evidence from PitchAPI shots (Premier League) + FPL's own taker order ---------- */
const oxNz=s=>fpNz(s);
function oxPLClubOverlap(names){const u=[...new Set(names)];return FPD.teams.filter(t=>u.some(n=>fpTeamEq(t.n,n))).length}
function oxTeamOf(name){const t=FPD.teams.filter(x=>fpTeamEq(x.n,name));return t.length===1?t[0].id:null}
/* FPL player for a PitchAPI name + club: unique match only (same rules as the PitchAPI link of the Table tab), else null */
function oxMatchName(name,tm){
 const P=FPD.P,n=oxNz(name),tk=n.split(' '),last=tk[tk.length-1],fi=n.charAt(0);
 const pick=(L)=>{const ex=L.filter(p=>oxNz(p.fn+' '+p.sn)===n||oxNz(p.name)===n);if(ex.length===1)return ex[0];
  const c2=L.filter(p=>{const sn=oxNz(p.sn).split(' ').pop(),wl=oxNz(p.name).split(' ').pop();return last===sn||last===wl});if(c2.length===1)return c2[0];
  if(c2.length>1){const c3=c2.filter(p=>oxNz(p.fn).charAt(0)===fi);if(c3.length===1)return c3[0]}return null};
 const inClub=tm!=null?pick(P.filter(p=>p.tm===tm)):null;if(inClub)return inClub;
 const ex=P.filter(p=>oxNz(p.fn+' '+p.sn)===n);return ex.length===1?ex[0]:null;   /* moved club: exact full name, unique in the whole game */
}
async function oxPenLoad(){
 if(OX.pen!==undefined)return OX.pen;if(OX.penBusy)return OX.penBusy;
 OX.penBusy=(async()=>{
  try{
   const L=(ALL.leagues||[]).filter(l=>/premier league/i.test(l.name)&&l.sh_file&&l.file);let best=null;
   for(const l of L){const r=await fetch('data/'+l.sh_file+'?v='+encodeURIComponent(l.sh_v||ALL.generated||''));if(!r.ok)continue;const sh=await r.json();
    const ix={};sh.cols.forEach((c,i)=>ix[c]=i);if(ix.st===undefined||ix.c===undefined)continue;
    const ov=oxPLClubOverlap(sh.rows.map(x=>x[ix.c]));if(ov>=15&&(!best||ov>best.ov))best={l,sh,ix,ov}}
   if(!best)return OX.pen={ok:false,why:'No PitchAPI Premier League shot file whose clubs match the FPL teams was found.'};
   const lr=await fetch('data/'+best.l.file+'?v='+encodeURIComponent(ALL.generated||''));if(!lr.ok)return OX.pen={ok:false,why:'Premier League match file missing (HTTP '+lr.status+').'};
   const lg=await lr.json(),round=new Map();let unm=0;
   for(const m of lg.matches||[]){const h=oxTeamOf(m.h),a=oxTeamOf(m.a);const x=h&&a?FPD.fix.filter(y=>y[1]===h&&y[2]===a):[];if(x.length===1)round.set(m.i,{r:x[0][0],h,a});else unm++}
   const {sh,ix}=best,cache=new Map(),idOf=(nm,tm)=>{const k=nm+'|'+tm;if(!cache.has(k)){const p=nm?oxMatchName(nm,tm):null;cache.set(k,p?p.id:null)}return cache.get(k)};
   const shots=[],nameMiss=new Set();
   for(const x of sh.rows){const st=x[ix.st];if(st!=='Penalty'&&st!=='FreeKick'&&st!=='FromCorner'&&st!=='SetPiece')continue;if(ix.og!==undefined&&x[ix.og])continue;
    /* kid/kn in this file is the goalkeeper facing the shot, not the passer, so shots say nothing about who took a corner */
    const mr=round.get(x[ix.m]);const tm=oxTeamOf(x[ix.c]);const fid=idOf(x[ix.pn],tm);
    if(fid==null&&st==='Penalty')nameMiss.add(x[ix.pn]+' ('+x[ix.c]+')');
    shots.push({r:mr?mr.r:null,m:x[ix.m],st,tm,fid,pn:x[ix.pn],xg:fpOk(x[ix.xg])?x[ix.xg]:null,goal:x[ix.ev]==='Goal'})}
   const by=new Map(),get=id=>{if(!by.has(id))by.set(id,{pen:[],fk:[],crn:[]});return by.get(id)};
   shots.forEach(s=>{if(s.fid==null)return;if(s.st==='Penalty')get(s.fid).pen.push(s);if(s.st==='FreeKick')get(s.fid).fk.push(s);if(s.st==='FromCorner')get(s.fid).crn.push(s)});
   const pens=shots.filter(s=>s.st==='Penalty');
   return OX.pen={ok:true,league:best.l.name,lid:best.l.id,matches:(lg.matches||[]).length,mapped:round.size,unmapped:unm,round,shots,pens,by,penUnlinked:[...nameMiss],
    penLinked:pens.filter(s=>s.fid!=null).length};
  }catch(e){return OX.pen={ok:false,why:'Could not read PitchAPI shot data: '+e.message}}
  finally{OX.penBusy=null}
 })();
 return OX.penBusy;
}
/* team-level penalty facts before round r (r = null: everything) */
function oxPenTeam(tm,r){const P=OX.pen;if(!P||!P.ok)return null;const L=P.pens.filter(s=>s.tm===tm&&(r==null||(s.r!=null&&s.r<r)));return L}
function oxSPText(p){
 const out=[],P=OX.pen,o=(k,l)=>{const v=p[k];if(fpOk(v))out.push(l+' #'+v+' (FPL)')};
 o('penalties_order','Penalties');o('direct_freekicks_order','Direct FKs');o('corners_and_indirect_freekicks_order','Corners/indirect FKs');
 if(P&&P.ok){const e=P.by.get(p.id);if(e){
  if(e.pen.length){const tp=oxPenTeam(p.tm,null).length,mine=e.pen.filter(s=>s.tm===p.tm).length;out.push('took '+e.pen.length+' penalt'+(e.pen.length>1?'ies':'y')+' ('+e.pen.filter(s=>s.goal).length+' scored)'+(tp?'; '+mine+' of '+tp+' '+pmTeamS(p.tm)+' penalties':''))}
  if(e.fk.length)out.push(e.fk.length+' direct free-kick shot'+(e.fk.length>1?'s':''));
}}
 return out;
}

/* ---------- model v2: penalty regression (optional; v1 stays the default) ----------
   FPL xG includes penalty xG, so a player who happened to take penalties carries his realised penalty xG as if it were a rate.
   v2 removes his observed penalty xG/goals (PitchAPI shots, situation "Penalty") and adds back the expected penalty xG of his
   minutes: league penalties per team-match × his observed share of his club's penalties × mean penalty xG.
   Only shots from rounds before the round being predicted are used, so the backtest stays leak-free. */
function oxPenAdj(p,r){
 const P=OX.pen;if(!P||!P.ok||(FPD&&FPD.archive)||!fpOk(p.expected_goals)||!fpOk(p.goals_scored)||!(p.minutes>0))return p;
 const e=P.by.get(p.id);if(!e)return p;const mine=e.pen.filter(s=>s.r!=null&&s.r<r);if(!mine.length)return p;
 const all=P.pens.filter(s=>s.r!=null&&s.r<r),nm=[...P.round.values()].filter(x=>x.r<r).length;if(!nm||!all.length)return p;
 const lam=all.length/(2*nm),xgs=all.map(s=>s.xg).filter(fpOk),xpen=xgs.length?xgs.reduce((a,b)=>a+b,0)/xgs.length:null;if(xpen==null)return p;
 const club=all.filter(s=>s.tm===p.tm),share=club.length?club.filter(s=>s.fid===p.id).length/club.length:0;
 const obsX=mine.reduce((a,s)=>a+(s.xg||0),0),obsG=mine.filter(s=>s.goal).length,E=p.minutes/90*lam*share*xpen;
 return Object.assign({},p,{expected_goals:Math.max(0,p.expected_goals-obsX)+E,goals_scored:Math.max(0,p.goals_scored-obsG)+E,_pen:{obsX,obsG,E,share,lam}});
}
const oxPmPlayer0=pmPlayer;
pmPlayer=function(p,C,dd){const v=dd===FPD?OX.ver:OX.btVer;return oxPmPlayer0(v==='v2'?oxPenAdj(p,C.next):p,C,dd)};
async function oxSetVer(v){
 if(v==='v2'){const P=await oxPenLoad();if(!P||!P.ok){OX.msg='Penalty regression needs PitchAPI Premier League shot data: '+((P&&P.why)||'not available');v='v1'}}
 OX.ver=v;FPD._pmPred=null;FPD.P.forEach(p=>{p.pm=null});FPBEST={};OX.cache={};fpRender();
}

/* ---------- explanations ---------- */
const OX_CL={app:'Minutes',goal:'Goals',ast:'Assists',cs:'Clean sheet',gc:'Goals conc.',sv:'Saves',dc:'Def. contr.',bon:'Bonus',card:'Cards/other'};
const OX_COMP=Object.keys(OX_CL);
function oxCS(p,gi){const g=oxG(p,gi);if(!g||p.ty>3)return null;const r=p.pm.rates;let any=false,pn=1;
 g.fx.forEach(x=>{if(x.lc==null)return;any=true;pn*=1-x.pPlay*r.q60*Math.exp(-x.lc*r.e60/90)});return any?1-pn:null}
function oxReason(d,C,p,gi){
 const g=oxG(p,gi);if(!g)return '';if(g.none)return 'No fixture this gameweek (blank): 0 expected.';
 const top=OX_COMP.map(k=>[k,g.parts[k]||0]).filter(x=>x[1]>0.05).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>OX_CL[k]+' '+v.toFixed(1));
 const s=[top.join(' · ')],x=g.fx[0],So=x?C.S.get(x.opp):null,r=p.pm.rates;
 if(g.fx.length>1)s.push('double gameweek ('+g.fx.length+' fixtures)');
 if(So&&C.mu){if(p.ty>=3&&So.xga!=null&&So.D>1.08)s.push(pmTeamS(x.opp)+' concede '+So.xga.toFixed(2)+' xG/match (avg '+C.mu.toFixed(2)+')');
  if(p.ty<=2&&So.xgf!=null&&So.A<0.92)s.push(pmTeamS(x.opp)+' create only '+So.xgf.toFixed(2)+' xG/match')}
 const cs=oxCS(p,gi);if(cs!=null&&p.ty<=2)s.push('clean-sheet chance '+oxP(cs));
 if(r&&r.xg90!=null&&C.pri[p.ty].xg!=null&&r.xg90>C.pri[p.ty].xg*1.5&&p.ty>=2)s.push('xG/90 '+r.xg90.toFixed(2)+' vs '+C.pri[p.ty].xg.toFixed(2)+' for the position');
 const sp=oxSPText(p).filter(t=>/penalt|Penalties/.test(t));if(sp.length)s.push(sp[0]);
 if(p.st!=='a')s.push('availability: '+pmStLabel(p));
 return s.filter(Boolean).join('; ');
}
function oxPartsRow(g){return OX_COMP.map(k=>(g.parts[k]||0))}

/* ---------- prediction log (this device): what the model recommended, and what those players then scored ---------- */
function oxLogRecord(X,res){
 const {d,C}=X,t=res.team,lg=oxLsGet(OX_LS.log,[]),gw=C.gws[0];
 if(lg.some(e=>e.gw===gw&&e.gen===d.generated&&e.ver===OX.ver&&e.mode===res.mode))return;
 lg.push({gw,gen:d.generated,ver:oxVerLabel(),mode:res.mode,at:new Date().toISOString().slice(0,16).replace('T',' ')+' UTC',ids:t.xi.map(i=>i.id),cap:t.cap?t.cap.id:null,total:+t.total.toFixed(2),form:t.form.name,season:oxSeason(d)});
 while(lg.length>60)lg.shift();oxLsSet(OX_LS.log,lg);
}
function oxActual(d,id,r){const ix=btIx(d);let s=null;((d.hist||{})[String(id)]||[]).forEach(h=>{if(h[0]===r&&fpOk(h[ix.pts]))s=(s||0)+h[ix.pts]});return s}
function oxLogHtml(d){
 const lg=oxLsGet(OX_LS.log,[]).filter(e=>e.season===oxSeason(d));if(!lg.length)return '';
 const fin=new Set(d.events.filter(e=>e.fin).map(e=>e.id)),rows=[...lg].reverse().slice(0,15).map(e=>{let act=null;
  if(fin.has(e.gw)){act=0;for(const id of e.ids){const a=oxActual(d,id,e.gw);act+=a||0}if(e.cap!=null)act+=oxActual(d,e.cap,e.gw)||0}
  return ['GW'+e.gw,esc(e.at),esc(e.gen),esc(e.ver),e.mode==='budget'?'budget':'any price',esc(e.form),e.total.toFixed(1),act==null?'<span class="mu">not played yet</span>':act.toFixed(0)]});
 return `<details class="card" style="font-size:12px"><summary class="mu"><b>Prediction log (kept on this device)</b> — ${lg.length} recorded recommendation${lg.length>1?'s':''}</summary><div class="mu" style="margin:6px 0">Each time an optimal XI for the next gameweek is computed with new data, it is recorded here with its time, data version and model version. After the gameweek finishes, "actual" adds the real points of those 11 players plus the captain's (no automatic substitutions). The leak-free Backtest tab is the systematic test.</div>${tbl([['GW'],['Recorded'],['Data version'],['Model'],['Constraint'],['Formation'],['Predicted',1],['Actual',1]],rows)}</details>`;
}

/* ---------- shared UI pieces ---------- */
function oxCtl(X,o){
 const {C,RU}=X,gw=o.gw!==false?`<select onchange="OX.gi=+this.value;fpRender()">${fpOpts(C.gws.map((g,i)=>[String(i),'GW'+g+(i===0?' (next)':'')]),String(OX.gi))}</select>`:'';
 const md=o.mode!==false?`<select onchange="OX.mode=this.value;fpRender()">${fpOpts([['budget','Fits a '+(RU.budget!=null?pmMoney(RU.budget):'')+' squad of '+RU.squad],['any','Any price (best possible XI)']].filter(x=>x[0]!=='budget'||RU.budget!=null),OX.mode)}</select>`:'';
 const v2=OX.pen&&OX.pen.ok;
 const vr=`<select onchange="oxSetVer(this.value)" title="Prediction model">${fpOpts([['v1','Model '+PM_VERSION+' (default)'],...(v2||OX.ver==='v2'?[['v2','Model '+PM_VERSION+' + penalty regression']]:[])],OX.ver)}</select>`;
 return `<div class="ctl">${gw}${md}${o.extra||''}${vr}</div>`+(OX.msg?`<div class="card" style="color:var(--a);font-size:13px">${esc(OX.msg)}</div>`:'');
}
function oxHead(X,gi,txt){
 const {d,C}=X,e=d.events.find(x=>x.id===C.gws[gi]),dl=e&&e.dl?new Date(e.dl):null;
 return `<div class="mu" style="font-size:12px;margin:-4px 0 8px">GW${C.gws[gi]}${dl?' · deadline '+esc(dl.toUTCString().slice(0,22))+' UTC':''} · data ${esc(d.generated)} UTC · model ${esc(oxVerLabel())} · ${txt||'all points are projections (expected values), not guarantees'}</div>`;
}
const oxNm=(d,id)=>{const p=d.PB.get(id);return p?`<a href="javascript:void(0)" onclick="fpPredPick(${id})">${esc(p.name)}</a>`:'?'};
const oxRange=s=>s?`${s.p10.toFixed(0)}–${s.p90.toFixed(0)}`:'N/A';
const oxTbl=(h,rows,empty)=>rows.length?tbl(h,rows):`<div class="mu" style="font-size:13px">${empty}</div>`;

/* PitchAPI set-piece evidence is read once, before the first draw (it decides whether model v2 can be offered), so nothing redraws later */
function oxWaitPen(el,tab,fn){if(OX.pen!==undefined)return false;el.innerHTML='<div class="empty">Loading…</div>';oxPenLoad().then(()=>{if(FP.tab===tab&&$('#fpbody'))fn($('#fpbody'))});return true}
/* ---------- tab: Optimal XI ---------- */
function oxTXI(el){
 if(oxWaitPen(el,'xi',oxTXI))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">Optimal Starting XI — Next Gameweek</h3>`+oxCtl(X,{})+oxHead(X,OX.gi)+`<div id="oxout"><div class="empty">Optimizing every legal formation${OX.mode==='budget'?' within the budget (a few seconds)':''}…</div></div><div id="pdet"></div>`;
 const gi=OX.gi,mode=OX.mode,seq=++OX.fcSeq;
 setTimeout(async()=>{const res=await oxOptimal(X,gi,mode);if(seq!==OX.fcSeq||!$('#oxout'))return;oxDrawXI(X,res,gi)},20);
}
function oxDrawXI(X,res,gi){
 const {d,C,RU,forms}=X,out=$('#oxout');if(!out)return;
 if(res.err){out.innerHTML=`<div class="empty">${esc(res.err)}</div>`;return}
 const t=res.team,ids=t.xi.map(i=>i.id),cap=d.PB.get(t.cap.id),vc=t.vice?d.PB.get(t.vice.id):null,g=C.gws[gi];
 const sim=oxSim(d,C,[{per:[{ids,cap:t.cap.id}]}],[gi],OX.N,7001)[0],st=oxQs(sim.tot);
 const capPlay=oxPPlay(oxG(cap,gi)),viceX=vc?(1-capPlay)*oxV(vc,gi):0;
 const second=res.all[1],omit=[];
 const sel=new Set(ids),byT={1:[],2:[],3:[],4:[]};t.xi.forEach(i=>byT[i.t].push(i));
 const minT=tt=>Math.min(...byT[tt].map(i=>i.v)),cc=new Map();t.xi.forEach(i=>cc.set(i.club,(cc.get(i.club)||0)+1));
 d.P.filter(p=>oxHasPred(p)&&!sel.has(p.id)&&p.st!=='u'&&p.st!=='n').map(p=>({p,v:oxV(p,gi)})).filter(o=>o.v!=null).sort((a,b)=>b.v-a.v).slice(0,40).forEach(o=>{
  const p=o.p,tt=p.ty;if(omit.length>=6)return;let why=null;
  if(byT[tt].length&&o.v>minT(tt)+1e-9){if((cc.get(p.tm)||0)>=RU.club)why='club limit: '+pmTeamS(p.tm)+' already has '+RU.club+' in the XI';else if(res.mode==='budget')why='budget: the squad cannot afford him together with the rest';else why='tie-break'}
  else if(!byT[tt].length||o.v>Math.min(...t.xi.map(i=>i.v))+1e-9)why='formation: '+t.form.name+' uses '+byT[tt].length+' '+FPPOS[tt]+(byT[tt].length>=RU.T[tt].mx?' (the maximum)':'')+'; his '+o.v.toFixed(1)+' beats the lowest starter elsewhere, but adding a '+FPPOS[tt]+' costs more at another position';
  if(why)omit.push([oxNm(d,p.id),esc(p.tn),FPPOS[tt],o.v.toFixed(2),esc(why)])});
 const ord=[...t.xi].sort((a,b)=>a.t-b.t||b.v-a.v);
 const rows=ord.map(i=>{const p=d.PB.get(i.id),gg=oxG(p,gi),stt=oxStarts(d,p),pr=oxPartsRow(gg),sum=pr.reduce((a,b)=>a+b,0);
  return [FPPOS[p.ty],oxNm(d,p.id)+(t.cap===i?' <b style="color:var(--a)">(C)</b>':t.vice===i?' <span class="mu">(V)</span>':''),esc(p.tn),f(p.price,1),esc(oxFx(d,p,gi,true)),Math.round(gg.eMin),oxP(oxPPlay(gg)),stt?stt.k+'/'+stt.n:'N/A',`<span style="color:${pmQCol[p.pm.q]}">${pmQLab[p.pm.q]}</span>`,esc(oxSPText(p).join('; ')||'—'),...pr.map(v=>v.toFixed(2)),`<b>${sum.toFixed(2)}</b>`,`<span style="white-space:normal;display:inline-block;min-width:260px">${esc(oxReason(d,C,p,gi))}</span>`]});
 const used=OX_COMP;
 const fmRows=res.all.map((r,k)=>[r.form.name,r.team.total.toFixed(2),pmMoney(r.team.cost),k===0?'<span class="tag ok">chosen</span>':(r.team.total-res.all[0].team.total).toFixed(2)]);
 const bad=res.bad||[];
 const bench=t.bench&&t.bench.length?`<div class="mu" style="font-size:12px;margin:6px 0">Budget check: this XI is the starting XI of the best ${RU.squad}-player squad within ${pmMoney(RU.budget)} (squad cost ${pmMoney(t.squadCost)}). The 4 bench players are chosen by the squad optimizer only to make the squad legal and affordable: ${t.bench.map(i=>esc(d.PB.get(i.id).name)+' '+pmMoney(i.c)).join(', ')}. Full squad and bench order: Best Team tab.</div>`:`<div class="mu" style="font-size:12px;margin:6px 0">Any-price mode: the best possible starting XI regardless of price (XI cost ${pmMoney(t.cost)}${RU.budget!=null?'; an FPL squad of '+RU.squad+' must cost at most '+pmMoney(RU.budget):''}). Bench and budget are not part of this answer.</div>`;
 const sumParts=ord.reduce((s,i)=>s+oxPartsRow(oxG(d.PB.get(i.id),gi)).reduce((a,b)=>a+b,0),0);
 out.innerHTML=`<div class="grid"><div class="kpi"><b>${t.form.name}</b><span>Formation</span></div><div class="kpi"><b style="color:var(--g)">${t.total.toFixed(1)}</b><span>Expected points, XI incl. captain, GW${g}</span></div><div class="kpi"><b>${oxRange(st)}</b><span>80% range (10th–90th percentile, simulated)</span></div><div class="kpi"><b>${pmMoney(t.cost)}</b><span>XI cost${t.squadCost?' · squad '+pmMoney(t.squadCost):''}</span></div><div class="kpi"><b style="font-size:16px">${esc(cap.name)} (C)</b><span>Captain · vice ${vc?esc(vc.name):'—'}</span></div></div>
 ${pmPitchHtml(t,d,i=>i.v.toFixed(1),i=>{const p=d.PB.get(i.id);return oxFx(d,p,gi,false)})}
 <div class="card" style="font-size:13px"><b>Key selection decisions</b><ul style="margin:6px 0 0 18px;padding:0">
 <li>Formation <b>${t.form.name}</b>: its best legal XI has the highest expected total${second?`; the next best formation, ${esc(second.form.name)}, is ${(t.total-second.team.total).toFixed(2)} points lower`:''}.</li>
 <li>Captain <b>${esc(cap.name)}</b> has the highest expected points of the XI (${oxV(cap,gi).toFixed(2)}, doubled); P(plays) ${oxP(capPlay)}. Vice-captain ${vc?'<b>'+esc(vc.name)+'</b> takes the armband only if the captain does not play (expected extra '+viceX.toFixed(2)+', not included in the total)':'—'}.</li>
 ${omit.length?'<li>Highest-projected players left out, and why: see the table below.</li>':''}
 ${t.xi.filter(i=>d.PB.get(i.id).st!=='a').map(i=>{const p=d.PB.get(i.id);return `<li style="color:var(--a)">${esc(p.name)}: ${esc(pmStLabel(p))}${p.nw?' — '+esc(p.nw):''}; expected ${i.v.toFixed(2)} vs ${oxG(p,gi).fit.toFixed(2)} if fully fit.</li>`}).join('')}
 </ul></div>${bench}
 <div class="card" style="font-size:12px">${bad.length?'<span style="color:var(--r)">✗ '+bad.map(esc).join('; ')+'</span>':`<span style="color:var(--g)">✓ ${t.xi.length} unique players · legal formation ${t.form.name} · at most ${Math.max(...cc.values())} per club (limit ${RU.club}) · captain and vice are starters</span>`}${res.proven===false?' <span style="color:var(--a)">· search limit reached: optimality not proven</span>':''}</div>
 <h3>Why each player (GW${g}; components add up to the player total)</h3>${tbl([['Pos'],['Player'],['Club'],['£m',1],['Fixture'],['Exp. min',1],['P(play)',1],['Started (last 6)',1],['Data'],['Set pieces'],...used.map(k=>[OX_CL[k],1]),['Total',1],['Main reasons']],rows)}
 <div class="mu" style="font-size:12px;margin:6px 0">Sum of the 11 player totals ${sumParts.toFixed(2)} + captain ${oxV(cap,gi).toFixed(2)} = ${(sumParts+oxV(cap,gi)).toFixed(2)} (shown rounded as ${t.total.toFixed(1)}). Component values are FPL scoring inputs (expected points per category); xG, xA, team xG and opponent strength are only the predictive signals behind them and earn no points by themselves. Tap a name for the full prediction details.</div>
 ${omit.length?`<h3>Notable players left out</h3>${oxTbl([['Player'],['Club'],['Pos'],['Expected',1],['Why not selected']],omit,'')}`:''}
 <h3>Formation comparison (exact optimum for each)</h3>${tbl([['Formation'],['Expected XI + captain',1],[res.mode==='budget'?'Squad cost':'XI cost',1],['']],fmRows)}
 ${oxLogHtml(d)}
 <details class="card" style="font-size:12px"><summary class="mu"><b>How the optimal XI and its range are calculated</b></summary>
 <p>Player values are the availability-adjusted expected points of the Predicted Points model for GW${g} (a double gameweek adds both fixtures; a blank gameweek is 0). ${res.mode==='budget'?`The XI comes from the exact squad optimizer of the Best Team tab (dynamic programming over the budget with branch and bound for the club limit, ${res.pool} of ${res.full} players after a lossless dominance prune): it maximises the XI's expected points plus the captain's, subject to a legal ${RU.squad}-player squad within the budget.`:`Every legal formation (${forms.map(x=>x.name).join(', ')}, from FPL's game settings) is solved exactly by branch and bound: maximise the XI's expected points plus the captain's, at most ${RU.club} players per club; ${res.pool} players with a projection are considered.`} Players marked unavailable or not in a squad are excluded.</p>
 <p>The 80% range comes from ${OX.N.toLocaleString()} simulations of the same model (fixed seed, so it does not change between visits): minutes, goals, assists, saves, defensive actions, bonus and cards are drawn per player; goals against are drawn once per team and fixture, so team-mates' clean sheets move together. Each team's goals are drawn once per match and shared out to its scorers and assisters, so team-mates' attacking returns move together and against the opposing defence. In the leak-free replay these lineup ranges came out too narrow, so they are widened by a factor of ${oxK().toFixed(2)} around the expected total (${oxK()===OX_KAPPA?'default fitted on the 2022-23 and 2023-24 seasons, validated on 2024-25 and tested on 2025-26':'refitted on this device in the Backtest tab'}); the Backtest tab shows the current check. Projections of the very top players have been optimistic (a selection effect: the highest projections include the largest over-estimates), so read the XI total as an upper-leaning estimate${(()=>{const c=oxLsGet(OX_LS.cal,null);return c&&c.season===oxSeason(FPD)&&c.top11?`: in the replay the 11 highest-projected players per gameweek averaged ${c.top11.pred.toFixed(2)} projected vs ${c.top11.act.toFixed(2)} actual points`:''})()}.</p>
 <p>Set pieces: FPL taker order (when the data has it) and PitchAPI shot evidence (penalties taken and scored, direct free-kick shots) are shown for information. PitchAPI shots do not record who took a corner or a free-kick cross, so corner duty is only known from FPL's own taker order. The base model counts penalty xG inside FPL xG; the penalty-regression option regresses each taker's realised penalty xG toward the league penalty rate (see Backtest).${OX.pen&&OX.pen.ok?` PitchAPI evidence: ${OX.pen.pens.length} penalties in ${OX.pen.matches} ${esc(OX.pen.league)} matches, ${OX.pen.penLinked} linked to an FPL player by club and name${OX.pen.penUnlinked.length?'; not linked: '+OX.pen.penUnlinked.map(esc).join(', '):''}.`:OX.pen&&!OX.pen.ok?' PitchAPI set-piece evidence unavailable: '+esc(OX.pen.why):''}${FPD.cols.includes('penalties_order')?'':' FPL taker order is not in the downloaded data yet; it is added at the next synchronization.'}</p></details>`;
}

/* ---------- My XI (builder) ---------- */
function oxMyInit(X){
 if(OX.my)return;const {d,forms}=X,s=oxLsGet(OX_LS.cur,null);
 const def={form:(forms.find(f=>f.name==='3-4-3')||forms[0]).name,ids:[],cap:null,vice:null};
 if(!s||s.season!==oxSeason(d)){OX.my=def;return}
 const ids=(s.ids||[]).filter(id=>d.PB.get(id)),lost=(s.ids||[]).length-ids.length;
 OX.my={form:forms.some(f=>f.name===s.form)?s.form:def.form,ids,cap:ids.includes(s.cap)?s.cap:null,vice:ids.includes(s.vice)?s.vice:null};
 if(lost)OX.msg=lost+' saved player(s) are no longer in the FPL data and were removed.';
}
function oxMyStore(){const d=FPD;oxLsSet(OX_LS.cur,Object.assign({season:oxSeason(d)},OX.my))}
const oxFormBy=(X,n)=>X.forms.find(f=>f.name===n)||X.forms[0];
function oxMyMsg(t){OX.msg='';const e=$('#oxmsg');if(e)e.textContent=t}
function oxMyAdd(id){
 const X=oxReady();if(X.err)return;const {d,RU}=X,p=d.PB.get(id),my=OX.my,ks=oxKs(oxFormBy(X,my.form));if(!p)return;
 if(my.ids.includes(id))return oxMyMsg(p.name+' is already in your XI.');
 const n=my.ids.filter(x=>d.PB.get(x).ty===p.ty).length;
 if(n>=ks[p.ty])return oxMyMsg('All '+ks[p.ty]+' '+FPPOS[p.ty]+' places of '+my.form+' are filled. Remove one, or pick a formation with more '+FPPOS[p.ty]+'.');
 const cl=my.ids.filter(x=>d.PB.get(x).tm===p.tm).length;if(cl>=RU.club)return oxMyMsg('You already have '+RU.club+' players from '+p.tf+' (FPL limit).');
 if(!oxHasPred(p))return oxMyMsg(p.name+' has no projection (no minutes this season), so he cannot be scored.');
 my.ids.push(id);oxMyStore();OX.sel=null;oxDrawMy(X);oxMyMsg(p.name+' added ('+my.ids.length+'/'+RU.play+').');
}
function oxMyRm(id){const my=OX.my;my.ids=my.ids.filter(x=>x!==id);if(my.cap===id)my.cap=null;if(my.vice===id)my.vice=null;OX.sel=null;oxMyStore();const X=oxReady();oxDrawMy(X)}
function oxMyRole(id,k){const my=OX.my;if(k==='cap'){if(my.vice===id)my.vice=my.cap;my.cap=id}else{if(my.cap===id)return oxMyMsg('The captain cannot also be vice-captain.');my.vice=id}OX.sel=null;oxMyStore();oxDrawMy(oxReady())}
function oxMyReplace(id){const p=FPD.PB.get(id);oxMyRm(id);OX.ppos=String(p.ty);const e=$('#oxpp');if(e)e.value=OX.ppos;oxPickDraw(oxReady());const q=$('#oxq');if(q){q.focus();q.scrollIntoView({behavior:'smooth',block:'center'})}oxMyMsg('Removed '+p.name+'. Pick a replacement '+FPPOS[p.ty]+' below.')}
function oxMyTap(id){OX.sel=OX.sel===id?null:id;oxDrawMy(oxReady())}
function oxMySlot(t){OX.ppos=String(t);const e=$('#oxpp');if(e)e.value=OX.ppos;oxPickDraw(oxReady());const q=$('#oxq');if(q)q.scrollIntoView({behavior:'smooth',block:'center'})}
function oxMyForm(n){
 const X=oxReady(),{d}=X,ks=oxKs(oxFormBy(X,n)),c=oxFormOf(OX.my.ids,d),over=[1,2,3,4].filter(t=>c[t]>ks[t]);
 if(over.length){fpRender();return oxMyMsg('Cannot switch to '+n+': remove '+over.map(t=>(c[t]-ks[t])+' '+FPPOS[t]).join(' and ')+' first.')}
 OX.my.form=n;oxMyStore();oxDrawMy(X);
}
async function oxMyFromOpt(){
 const X=oxReady();if(X.err)return;oxMyMsg('Computing the optimal XI…');const res=await oxOptimal(X,OX.gi,OX.mode);if(res.err)return oxMyMsg(res.err);
 const t=res.team;OX.my={form:t.form.name,ids:t.xi.map(i=>i.id),cap:t.cap.id,vice:t.vice?t.vice.id:null};OX.sel=null;oxMyStore();oxDrawMy(X);oxMyMsg('Loaded the model\'s optimal XI for GW'+X.C.gws[OX.gi]+'. Change any player to test your own ideas.');
}
function oxMyClear(){OX.my={form:OX.my.form,ids:[],cap:null,vice:null};OX.sel=null;oxMyStore();oxDrawMy(oxReady());oxMyMsg('Cleared.')}
function oxMySave(){
 const nm=($('#oxsn')&&$('#oxsn').value.trim())||('My XI '+new Date().toISOString().slice(0,10));const L=oxLsGet(OX_LS.saved,[]),i=L.findIndex(x=>x.name===nm);
 const e=Object.assign({name:nm,at:new Date().toISOString().slice(0,16).replace('T',' '),season:oxSeason(FPD)},JSON.parse(JSON.stringify(OX.my)));
 if(i>=0)L[i]=e;else L.push(e);while(L.length>20)L.shift();oxMyMsg(oxLsSet(OX_LS.saved,L)?'Saved "'+nm+'" on this device.':'Could not save (browser storage blocked).');oxDrawMy(oxReady());
}
function oxMyLoad(){const s=$('#oxsl');if(!s||s.value==='')return;const e=oxLsGet(OX_LS.saved,[])[+s.value];if(!e)return;const X=oxReady(),{d}=X;
 if(e.season!==oxSeason(d))return oxMyMsg('That lineup is from another season.');const ids=e.ids.filter(id=>d.PB.get(id));
 OX.my={form:e.form,ids,cap:ids.includes(e.cap)?e.cap:null,vice:ids.includes(e.vice)?e.vice:null};OX.sel=null;oxMyStore();oxDrawMy(X);oxMyMsg('Loaded "'+e.name+'"'+(ids.length<e.ids.length?' ('+(e.ids.length-ids.length)+' player(s) no longer in the data were dropped)':'')+'.')}
function oxMyDel(){const s=$('#oxsl');if(!s||s.value==='')return;const L=oxLsGet(OX_LS.saved,[]),e=L.splice(+s.value,1)[0];oxLsSet(OX_LS.saved,L);oxDrawMy(oxReady());if(e)oxMyMsg('Deleted "'+e.name+'".')}
function oxMyCard(p,i,o){
 const sel=OX.sel===p.id,badge=o.cap?'C':o.vice?'V':'';
 return `<div style="position:absolute;left:${o.x.toFixed(1)}%;top:${o.y}%;transform:translate(-50%,-50%);width:${o.w}%;min-width:60px;max-width:98px;background:rgba(13,21,32,.92);border:1.5px solid ${sel?'#e8eef5':pmStCol(p)};${sel?'box-shadow:0 0 0 2px #e8eef5;':''}border-radius:8px;padding:3px 3px 4px;font-size:11px;line-height:1.25;text-align:center;cursor:pointer" onclick="oxMyTap(${p.id})" title="${esc(pmStLabel(p)+(p.nw?' — '+p.nw:''))}">${badge?`<span style="position:absolute;top:-7px;right:-5px;background:${badge==='C'?'#e9b44c':'#8a9bb0'};color:#0d1520;border-radius:50%;width:17px;height:17px;font-size:10px;font-weight:800;line-height:17px">${badge}</span>`:''}<div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div class="mu" style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.tn)} · ${pmMoney(p.now_cost)}</div><div><b style="color:var(--g)">${o.pts}</b> <span class="mu" style="font-size:10px">${esc(o.sub)}</span></div>${p.st!=='a'?`<div style="font-size:10px;color:${pmStCol(p)}">${esc(pmStLabel(p))}</div>`:''}</div>`;
}
function oxMyPitch(X,gi){
 const {d}=X,my=OX.my,ks=oxKs(oxFormBy(X,my.form)),by={1:[],2:[],3:[],4:[]},yp={4:15,3:40,2:65,1:88};my.ids.forEach(id=>{const p=d.PB.get(id);if(p)by[p.ty].push(p)});
 let cards='';
 for(const t of [4,3,2,1]){const n=ks[t],w=Math.min(19,92/Math.max(n,1));for(let k=0;k<n;k++){const x=(k+.5)/n*100,p=by[t][k];
  if(p){const v=oxV(p,gi);cards+=oxMyCard(p,null,{x,y:yp[t],w,cap:my.cap===p.id,vice:my.vice===p.id,pts:v==null?'N/A':v.toFixed(1),sub:oxFx(d,p,gi,false)})}
  else cards+=`<div onclick="oxMySlot(${t})" style="position:absolute;left:${x.toFixed(1)}%;top:${yp[t]}%;transform:translate(-50%,-50%);width:${w}%;min-width:60px;max-width:98px;min-height:44px;border:1.5px dashed rgba(255,255,255,.6);border-radius:8px;background:rgba(13,21,32,.45);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:pointer">+ ${FPPOS[t]}</div>`}}
 const ln='position:absolute;border:1.5px solid rgba(255,255,255,.35);';
 return `<div style="position:relative;width:100%;max-width:560px;margin:8px auto;aspect-ratio:5/6;border-radius:10px;overflow:hidden;background:repeating-linear-gradient(0deg,#1d6b43 0 8.33%,#1a5f3b 8.33% 16.66%);border:2px solid rgba(255,255,255,.4)"><div style="${ln}left:0;right:0;top:50%;border-width:1.5px 0 0"></div><div style="${ln}left:35%;width:30%;top:38%;height:24%;border-radius:50%"></div><div style="${ln}left:22%;width:56%;top:0;height:16%;border-top:0"></div><div style="${ln}left:22%;width:56%;bottom:0;height:16%;border-bottom:0"></div>${cards}</div>`;
}
function oxTMy(el){
 if(oxWaitPen(el,'my',oxTMy))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 oxMyInit(X);const {d,C}=X,sv=oxLsGet(OX_LS.saved,[]);
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">My XI — starting-XI builder</h3>`+oxCtl(X,{mode:false,extra:`<select id="oxfm" onchange="oxMyForm(this.value)">${fpOpts(X.forms.map(f=>[f.name,'Formation '+f.name]),OX.my.form)}</select>`})+oxHead(X,OX.gi,'a starting XI of '+X.RU.play+' (not a full squad of '+X.RU.squad+'); points are projections')+
  `<div class="ctl"><button class="s" onclick="oxMyFromOpt()">Start from the optimal XI</button><button class="s" onclick="oxMyClear()">Clear</button><input id="oxsn" placeholder="Lineup name" style="width:150px"><button class="s" onclick="oxMySave()">Save</button><select id="oxsl">${fpOpts([['','Saved lineups ('+sv.length+')'],...sv.map((e,i)=>[String(i),e.name+' · '+e.at])],'')}</select><button class="s" onclick="oxMyLoad()">Load</button><button class="s" onclick="oxMyDel()">Delete</button></div>
  <div id="oxmsg" class="mu" style="min-height:20px;font-size:13px">${esc(OX.msg)}</div><div id="oxmy"></div>
  <h3>Add players</h3><div class="ctl"><input id="oxq" placeholder="Search player or club" value="${esc(OX.pq)}" style="flex:1;min-width:160px"><select id="oxpp">${fpPosOpts(OX.ppos)}</select><select id="oxpt">${fpTeamOpts(OX.pteam)}</select></div><div id="oxpick"></div><div id="pdet"></div>`;
 OX.msg='';
 const rd=()=>{OX.pq=$('#oxq').value;OX.ppos=$('#oxpp').value;OX.pteam=$('#oxpt').value;oxPickDraw(X)};$('#oxq').oninput=rd;$('#oxpp').onchange=rd;$('#oxpt').onchange=rd;
 oxDrawMy(X);oxPickDraw(X);
}
function oxDrawMy(X){
 const o=$('#oxmy');if(!o||X.err)return;const {d,C,RU}=X,my=OX.my,gi=OX.gi,ids=my.ids,bad=oxCheckXI(ids,my.cap,my.vice,X);
 const exp=oxExp(d,ids,my.cap,gi),full=ids.length===RU.play,st=ids.length?oxQs(oxSim(d,C,[{per:[{ids,cap:my.cap}]}],[gi],OX.N,7002)[0].tot):null;
 const cost=ids.reduce((s,id)=>s+(d.PB.get(id).now_cost||0),0),bn=full&&RU.budget!=null?oxCheapBench(ids,X):null;
 const sp=OX.sel!=null?d.PB.get(OX.sel):null;
 const act=sp?`<div class="card" style="font-size:13px"><b>${esc(sp.name)}</b> · ${esc(sp.tn)} · ${FPPOS[sp.ty]} · ${pmMoney(sp.now_cost)} · expected ${f(oxV(sp,gi),2)} in GW${C.gws[gi]}<div class="ctl" style="margin:8px 0 0"><button onclick="oxMyRole(${sp.id},'cap')" ${my.cap===sp.id?'disabled':''}>Make captain</button><button class="s" onclick="oxMyRole(${sp.id},'vice')" ${my.vice===sp.id||my.cap===sp.id?'disabled':''}>Make vice-captain</button><button class="s" onclick="oxMyReplace(${sp.id})">Replace</button><button class="s" onclick="oxMyRm(${sp.id})">Remove</button><button class="s" onclick="fpPredPick(${sp.id})">Details</button></div></div>`:'';
 const ok=(b,t)=>`<div style="color:${b?'var(--g)':'var(--r)'}">${b?'✓':'✗'} ${t}</div>`;
 o.innerHTML=`<div class="grid"><div class="kpi"><b>${ids.length} / ${RU.play}</b><span>Players selected (${my.form})</span></div><div class="kpi"><b style="color:var(--g)">${exp.toFixed(1)}</b><span>Expected points GW${C.gws[gi]}${my.cap!=null?' incl. captain':' (no captain yet)'}${full?'':' · partial XI'}</span></div><div class="kpi"><b>${st?oxRange(st):'—'}</b><span>80% range (simulated)</span></div><div class="kpi"><b>${pmMoney(cost)}</b><span>XI cost${bn?' · cheapest legal squad '+pmMoney(cost+bn.cost):''}</span></div></div>
 ${oxMyPitch(X,gi)}<div class="mu" style="text-align:center;font-size:12px">Tap a player for captain, vice-captain, replace or remove; tap an empty place to add a player of that position.</div>${act}
 <div class="card" style="font-size:12px"><b>Checks</b>${ok(full,ids.length+' of '+RU.play+' starters')}${ok(!bad.some(x=>/twice|no longer/.test(x)),'no duplicates; every player exists in the FPL data')}${ok(full&&!bad.some(x=>/formation/.test(x)),'legal formation '+my.form)}${ok(!bad.some(x=>/limit/.test(x)),'at most '+RU.club+' players per club')}${ok(my.cap!=null&&!bad.some(x=>/captain is/.test(x)),'captain chosen'+(my.cap!=null?' ('+esc(d.PB.get(my.cap).name)+')':''))}${ok(my.vice!=null&&!bad.some(x=>/vice/.test(x)),'vice-captain chosen'+(my.vice!=null?' ('+esc(d.PB.get(my.vice).name)+')':''))}
 ${RU.budget!=null?(full?(bn?(cost+bn.cost<=RU.budget?ok(true,'fits the budget: XI '+pmMoney(cost)+' + cheapest legal bench '+pmMoney(bn.cost)+' = '+pmMoney(cost+bn.cost)+' ≤ '+pmMoney(RU.budget)):`<div style="color:var(--a)">! over budget as a full squad: XI ${pmMoney(cost)} + cheapest legal bench ${pmMoney(bn.cost)} = ${pmMoney(cost+bn.cost)} > ${pmMoney(RU.budget)}. Fine for a what-if; compare it with the any-price optimum.</div>`):'<div style="color:var(--a)">! no legal bench completes this XI into a squad (club limit)</div>'):''):''}
 ${ids.some(id=>d.PB.get(id).st!=='a')?`<div style="color:var(--a)">! ${ids.filter(id=>d.PB.get(id).st!=='a').map(id=>esc(d.PB.get(id).name)+' ('+esc(pmStLabel(d.PB.get(id)))+')').join(', ')}: projection reduced for availability</div>`:''}</div>
 ${ids.length?tbl([['Pos'],['Player'],['Club'],['£m',1],['Fixture'],['Exp. min',1],['Expected',1]],[...ids].sort((a,b)=>d.PB.get(a).ty-d.PB.get(b).ty).map(id=>{const p=d.PB.get(id),g=oxG(p,gi);return [FPPOS[p.ty],oxNm(d,id)+(my.cap===id?' <b style="color:var(--a)">(C ×2)</b>':my.vice===id?' <span class="mu">(V)</span>':''),esc(p.tn),f(p.price,1),esc(oxFx(d,p,gi,false)),g?Math.round(g.eMin):'—',f(oxV(p,gi),2)]})):''}`;
}
function oxPickDraw(X){
 const o=$('#oxpick');if(!o||X.err)return;const {d,C}=X,gi=OX.gi,my=OX.my,q=fpNz(OX.pq);
 const L=d.P.filter(p=>oxHasPred(p)&&(!OX.ppos||p.ty===+OX.ppos)&&(!OX.pteam||p.tm===+OX.pteam)&&(!q||fpNz(p.fn+' '+p.sn+' '+p.name+' '+p.tf).includes(q))).sort((a,b)=>(oxV(b,gi)||0)-(oxV(a,gi)||0)).slice(0,60);
 o.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:4px">Sorted by expected points in GW${C.gws[gi]}. Players without a projection (no minutes this season) are not listed.</div>`+(L.length?`<div class="wrap"><table><tr><th></th><th>Player</th><th>Club</th><th>Pos</th><th class="n">£m</th><th>Fixture</th><th class="n">Exp. min</th><th class="n">Expected</th></tr>${L.map(p=>{const g=oxG(p,gi),inn=my.ids.includes(p.id);return `<tr><td><button class="${inn?'s':''}" ${inn?'disabled':''} onclick="oxMyAdd(${p.id})" style="min-height:34px;padding:2px 10px" aria-label="Add ${esc(p.name)}">${inn?'✓':'+'}</button></td><td>${pmDot(p)}<a href="javascript:void(0)" onclick="fpPredPick(${p.id})">${esc(p.name)}</a></td><td>${esc(p.tn)}</td><td>${FPPOS[p.ty]}</td><td class="n">${f(p.price,1)}</td><td>${esc(oxFx(d,p,gi,false))}</td><td class="n">${g?Math.round(g.eMin):'—'}</td><td class="n"><b>${f(oxV(p,gi),2)}</b></td></tr>`}).join('')}</table></div>`:'<div class="empty">No players match.</div>');
}

/* ---------- lineup sources (current builder XI or a saved one) ---------- */
function oxSrcOpts(){const sv=oxLsGet(OX_LS.saved,[]);return [['cur','My XI (current builder)'],...sv.map((e,i)=>['s'+i,'Saved: '+e.name])]}
function oxSrc(X){
 const {d}=X;if(OX.src==='cur'){oxMyInit(X);return Object.assign({name:'My XI'},OX.my)}
 const e=oxLsGet(OX_LS.saved,[])[+OX.src.slice(1)];if(!e||e.season!==oxSeason(d)){OX.src='cur';oxMyInit(X);return Object.assign({name:'My XI'},OX.my)}
 const ids=e.ids.filter(id=>d.PB.get(id));return {name:e.name,form:e.form,ids,cap:ids.includes(e.cap)?e.cap:null,vice:ids.includes(e.vice)?e.vice:null};
}
const oxSrcSel=()=>`<select onchange="OX.src=this.value;fpRender()">${fpOpts(oxSrcOpts(),OX.src)}</select>`;
function oxNeedXI(X,L){const bad=oxCheckXI(L.ids,L.cap,L.vice,X).filter(x=>!/vice/.test(x));return bad.length?`<div class="empty">${esc(L.name)} is not a complete, valid starting XI yet: ${esc(bad.join('; '))}. Build it in the <a href="javascript:void(0)" onclick="fpTab('my')">My XI</a> tab (or press "Start from the optimal XI" there and change players).</div>`:''}

/* ---------- tab: My XI vs Optimal XI ---------- */
function oxTVs(el){
 if(oxWaitPen(el,'vs',oxTVs))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 const L=oxSrc(X);
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">My XI vs Optimal XI</h3>`+oxCtl(X,{extra:oxSrcSel()})+oxHead(X,OX.gi,'both lineups use the same gameweek, predictions and scoring rules; projections, not guarantees')+`<div id="oxvs"></div><div id="pdet"></div>`;
 const nd=oxNeedXI(X,L);if(nd){$('#oxvs').innerHTML=nd;return}
 $('#oxvs').innerHTML='<div class="empty">Computing the optimal XI…</div>';
 const gi=OX.gi,mode=OX.mode,seq=++OX.fcSeq;
 setTimeout(async()=>{const res=await oxOptimal(X,gi,mode);if(seq!==OX.fcSeq||!$('#oxvs'))return;oxDrawVs(X,L,res,gi)},20);
}
function oxDrawVs(X,L,res,gi){
 const {d,C,RU}=X,o=$('#oxvs');if(res.err){o.innerHTML=`<div class="empty">${esc(res.err)}</div>`;return}
 const t=res.team,M={ids:t.xi.map(i=>i.id),cap:t.cap.id},U={ids:L.ids,cap:L.cap};
 const eU=oxExp(d,U.ids,U.cap,gi),eM=oxExp(d,M.ids,M.cap,gi),dU=oxR1(eU),dM=oxR1(eM),diff=oxR1(dM-dU);
 const sm=oxSim(d,C,[{per:[U]},{per:[M]}],[gi],OX.N,7003),sU=oxQs(sm[0].tot),sM=oxQs(sm[1].tot),sd=oxDiffS(sm[0].tot,sm[1].tot);
 const both=U.ids.filter(id=>M.ids.includes(id)),onlyU=U.ids.filter(id=>!M.ids.includes(id)),onlyM=M.ids.filter(id=>!U.ids.includes(id));
 const v=id=>oxV(d.PB.get(id),gi)||0,pos=id=>d.PB.get(id).ty;
 /* pair the differences by position, best first; leftovers are formation changes */
 const pairs=[],lu=[...onlyU].sort((a,b)=>v(b)-v(a)),lm=[...onlyM].sort((a,b)=>v(b)-v(a));
 for(const t of [1,2,3,4]){const a=lu.filter(id=>pos(id)===t),b=lm.filter(id=>pos(id)===t);for(let k=0;k<Math.max(a.length,b.length);k++)pairs.push({t,u:a[k]??null,m:b[k]??null})}
 pairs.sort((x,y)=>((x.m!=null?v(x.m):0)-(x.u!=null?v(x.u):0)<((y.m!=null?v(y.m):0)-(y.u!=null?v(y.u):0))?1:-1));
 const why=(a,b)=>{if(a==null||b==null)return 'formation change ('+L.form+' → '+t.form.name+')';const ga=oxG(d.PB.get(a),gi),gb=oxG(d.PB.get(b),gi);
  const ds=OX_COMP.map(k=>[k,(gb.parts[k]||0)-(ga.parts[k]||0)]).filter(x=>Math.abs(x[1])>=0.05).sort((x,y)=>Math.abs(y[1])-Math.abs(x[1])).slice(0,3);
  const s=ds.map(([k,x])=>OX_CL[k]+' '+(x>0?'+':'')+x.toFixed(2));const ea=ga.eMin,eb=gb.eMin;if(Math.abs(eb-ea)>=10)s.push('exp. minutes '+Math.round(ea)+' → '+Math.round(eb));
  return s.join(', ')||'about equal'};
 const capU=U.cap!=null?v(U.cap):0,capM=v(M.cap);
 let sumRows=0;const prow=pairs.map(x=>{const a=x.u!=null?v(x.u):0,b=x.m!=null?v(x.m):0;sumRows+=b-a;
  return [FPPOS[x.t],x.u!=null?oxNm(d,x.u)+' <span class="mu">'+esc(d.PB.get(x.u).tn)+'</span>':'<span class="mu">—</span>',x.u!=null?a.toFixed(2):'',x.m!=null?oxNm(d,x.m)+' <span class="mu">'+esc(d.PB.get(x.m).tn)+'</span>':'<span class="mu">—</span>',x.m!=null?b.toFixed(2):'',`<b>${(b-a>=0?'+':'')+(b-a).toFixed(2)}</b>`,`<span style="white-space:normal;display:inline-block;min-width:220px">${esc(why(x.u,x.m))}</span>`]});
 const capD=capM-capU;
 o.innerHTML=`<div class="grid"><div class="kpi"><b style="color:${OXCOL[0]}">■</b><b>${dU.toFixed(1)}</b><span>${esc(L.name)} · expected (80% range ${oxRange(sU)})</span></div><div class="kpi"><b style="color:${OXCOL[1]}">■</b><b>${dM.toFixed(1)}</b><span>Optimal XI (${res.mode==='budget'?'within budget':'any price'}) · expected (80% range ${oxRange(sM)})</span></div><div class="kpi"><b>${(diff>=0?'+':'')+diff.toFixed(1)}</b><span>Projected difference (optimal − yours)</span></div><div class="kpi"><b>${oxP(sd.pWin)}</b><span>Chance your XI outscores it${sd.pTie>0.005?' ('+oxP(sd.pTie)+' tie)':''} (simulated)</span></div></div>
 <div class="mu" style="font-size:12px;margin:8px 0">The difference is the difference of the two totals shown (${dM.toFixed(1)} − ${dU.toFixed(1)}). 80% of simulated outcomes of the difference lie between ${sd.p10.toFixed(0)} and ${sd.p90.toFixed(0)}: the optimal XI has the higher <i>expected</i> score, but it can lose in a single gameweek. Players common to both lineups are simulated once and cancel out.${res.mode==='budget'&&U.ids.length===RU.play?(()=>{const bn=oxCheapBench(U.ids,X),c=U.ids.reduce((s,id)=>s+d.PB.get(id).now_cost,0);return bn&&c+bn.cost>RU.budget?' <span style="color:var(--a)">Your XI would not fit the budget as part of a full squad, while the optimal XI does: switch the constraint to "Any price" for a like-for-like comparison.</span>':''})():''}</div>
 <h3>Where the ${(diff>=0?'+':'')+diff.toFixed(1)} comes from</h3>${pairs.length?tbl([['Pos'],['Yours'],['Exp.',1],['Model'],['Exp.',1],['Gain',1],['Main differences (model − yours)']],prow):'<div class="card">Both lineups have the same 11 players.</div>'}
 <div class="mu" style="font-size:12px;margin:6px 0">Captain: yours ${U.cap!=null?esc(d.PB.get(U.cap).name)+' (+'+capU.toFixed(2)+')':'—'}, model ${esc(d.PB.get(M.cap).name)} (+${capM.toFixed(2)}): ${(capD>=0?'+':'')+capD.toFixed(2)}. Player swaps ${(sumRows>=0?'+':'')+sumRows.toFixed(2)} + captain ${(capD>=0?'+':'')+capD.toFixed(2)} = ${(sumRows+capD>=0?'+':'')+(sumRows+capD).toFixed(2)} (unrounded difference ${(eM-eU).toFixed(2)}). Tap any name to see why the model rates him as it does.</div>
 <h3>In both lineups (${both.length})</h3>${oxTbl([['Pos'],['Player'],['Club'],['Expected',1]],[...both].sort((a,b)=>pos(a)-pos(b)).map(id=>[FPPOS[pos(id)],oxNm(d,id),esc(d.PB.get(id).tn),v(id).toFixed(2)]),'No player in common.')}
 <div class="grid" style="margin-top:8px"><div><h3>Only in ${esc(L.name)} (${onlyU.length})</h3>${oxTbl([['Player'],['Expected',1]],onlyU.map(id=>[oxNm(d,id)+(U.cap===id?' (C)':''),v(id).toFixed(2)]),'None.')}</div><div><h3>Only in the optimal XI (${onlyM.length})</h3>${oxTbl([['Player'],['Expected',1]],onlyM.map(id=>[oxNm(d,id)+(M.cap===id?' (C)':''),v(id).toFixed(2)]),'None.')}</div></div>`;
}

/* ---------- tab: multi-gameweek forecast ---------- */
function oxTFc(el){
 if(oxWaitPen(el,'fc',oxTFc))return;
 const X=oxReady();if(X.err){el.innerHTML=`<div class="empty">${esc(X.err)}</div>`;return}
 const {C}=X,hs=[1,3,5,7].filter(h=>h<=C.gws.length);if(C.gws.length>1&&!hs.includes(C.gws.length)&&C.gws.length<7)hs.push(C.gws.length);if(!hs.includes(OX.hz))OX.hz=hs.filter(h=>h<=OX.hz).pop()||1;
 const L=oxSrc(X);
 el.innerHTML=`<h3 style="margin-top:4px;color:var(--tx);font-size:17px">Forecast — next ${OX.hz} gameweek${OX.hz>1?'s':''}</h3>`+oxCtl(X,{gw:false,extra:`<select onchange="OX.hz=+this.value;fpRender()">${fpOpts(hs.map(h=>[String(h),h===1?'Next gameweek':'Next '+h+' gameweeks']),String(OX.hz))}</select>`+oxSrcSel()})+oxHead(X,0,'GW'+C.gws[0]+'–GW'+C.gws[OX.hz-1]+' · projections; uncertainty grows with distance')+`<div id="oxfc"></div><div id="pdet"></div>`;
 const nd=oxNeedXI(X,L);if(nd){$('#oxfc').innerHTML=nd;return}
 const seq=++OX.fcSeq,hz=OX.hz,mode=OX.mode;
 (async()=>{const per=[];for(let k=0;k<hz;k++){const e=$('#oxfc');if(seq!==OX.fcSeq||!e)return;e.innerHTML=`<div class="empty">Optimizing GW${C.gws[k]} (${k+1} of ${hz})…</div>`;await oxYield();per.push(await oxOptimal(X,k,mode))}
  if(seq!==OX.fcSeq||!$('#oxfc'))return;oxDrawFc(X,L,per,hz)})();
}
function oxDrawFc(X,L,per,hz){
 const {d,C}=X,o=$('#oxfc'),gis=Array.from({length:hz},(_,k)=>k),gws=gis.map(k=>C.gws[k]);
 const U={per:gis.map(()=>({ids:L.ids,cap:L.cap}))},Mw={per:per.map(r=>r.err?null:{ids:r.team.xi.map(i=>i.id),cap:r.team.cap.id})},M0=per[0].err?null:{ids:per[0].team.xi.map(i=>i.id),cap:per[0].team.cap.id},Mf={per:gis.map(()=>M0)};
 const LS=[U,Mw,Mf],names=[L.name+' (fixed)','Optimal XI, re-picked each GW','GW'+gws[0]+' optimal XI kept fixed'];
 const ex=LS.map(x=>gis.map(k=>x.per[k]?oxExp(d,x.per[k].ids,x.per[k].cap,k):null));
 const sm=oxSim(d,C,LS,gis,OX.N,7004),q=sm.map(s=>s.gw.map(a=>oxQs(a))),qt=sm.map(s=>s.ok?oxQs(s.tot):null),tot=ex.map(a=>a.some(v=>v==null)?null:a.reduce((s,v)=>s+v,0));
 const dfx=sm[1].ok?oxDiffS(sm[0].tot,sm[1].tot):null;
 /* blanks and doubles touching any player in these lineups */
 const ids=new Set([...L.ids,...per.flatMap(r=>r.err?[]:r.team.xi.map(i=>i.id))]),bd=[];
 gis.forEach(k=>{const ts=new Map();ids.forEach(id=>{const p=d.PB.get(id),g=oxG(p,k);if(g&&(g.none||g.fx.length>1))ts.set(p.tm,g.none?'blank':'double')});ts.forEach((v,tm)=>bd.push('GW'+gws[k]+': '+pmTeamS(tm)+' '+v))});
 const S=[0,1,2].map(j=>({n:names[j],short:['Yours','Re-picked','Fixed opt.'][j],v:ex[j],lo:j<2?q[j].map((x,k)=>LS[j].per[k]?x.p10:null):null,hi:j<2?q[j].map((x,k)=>LS[j].per[k]?x.p90:null):null,c:OXCOL[j],dash:OXDASH[j]}));
 const chart=hz>1?oxChart('oxch',gws,S):oxRangePlot(S.map((s,j)=>({n:s.n,mean:ex[j][0],lo:qt[j]?qt[j].p10:null,hi:qt[j]?qt[j].p90:null,c:s.c})));
 const r1=x=>x==null?'N/A':x.toFixed(1);
 const dU=tot[0]==null?null:oxR1(tot[0]),dM=tot[1]==null?null:oxR1(tot[1]);
 o.innerHTML=`<div class="grid"><div class="kpi"><b>${r1(dU)}</b><span>${esc(L.name)}: expected over ${hz} GW (80% range ${qt[0]?oxRange(qt[0]):'N/A'})</span></div><div class="kpi"><b>${r1(dM)}</b><span>Optimal XI re-picked each GW (80% range ${qt[1]?oxRange(qt[1]):'N/A'})</span></div><div class="kpi"><b>${dU!=null&&dM!=null?((dM-dU>=0?'+':'')+(dM-dU).toFixed(1)):'N/A'}</b><span>Projected difference over the period</span></div><div class="kpi"><b>${r1(tot[2]==null?null:oxR1(tot[2]))}</b><span>GW${gws[0]} optimal XI if never changed</span></div></div>
 <div class="ctl" style="margin:10px 0 2px;font-size:13px;gap:14px">${S.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg>${esc(s.n)}</span>`).join('')}${hz>1?'<span class="mu">shaded = 80% range</span>':''}</div>
 ${chart}
 <h3>Per gameweek (expected, 80% range)</h3>${tbl([['GW'],...names.map(n=>[esc(n),1])],gis.map(k=>['GW'+gws[k],...[0,1,2].map(j=>ex[j][k]==null?'N/A':`${ex[j][k].toFixed(1)} <span class="mu">(${q[j][k].p10.toFixed(0)}–${q[j][k].p90.toFixed(0)})</span>`)]))}
 ${tbl([['Period total'],...names.map(n=>[esc(n),1])],[['GW'+gws[0]+'–'+gws[hz-1],...[0,1,2].map(j=>tot[j]==null?'N/A':`<b>${tot[j].toFixed(1)}</b> <span class="mu">(${qt[j].p10.toFixed(0)}–${qt[j].p90.toFixed(0)})</span>`)]])}
 <div class="mu" style="font-size:12px;margin:6px 0">${dfx?`Chance that ${esc(L.name)} outscores the re-picked optimal XI over the period: ${oxP(dfx.pWin)} (simulated). `:''}Your lineup and captain are held fixed for every gameweek (no transfers or captain changes); the re-picked optimum is a ceiling that assumes unlimited free changes, and the fixed GW${gws[0]} optimum is the like-for-like reference for an unchanged lineup. Period ranges are percentiles of the simulated <i>sum</i> over all ${hz} gameweeks, not ${hz} single-week ranges added up. ${bd.length?'Blank/double gameweeks for these players: '+esc(bd.join('; '))+'. ':''}Later gameweeks are less certain: injury news and FPL's chance of playing only exist for the next gameweek (carried forward unchanged), and fixtures can still move.</div>
 ${per.filter(r=>r.err).length?`<div class="card" style="color:var(--a)">${per.map((r,k)=>r.err?'GW'+gws[k]+': '+esc(r.err):'').filter(Boolean).join('<br>')}</div>`:''}`;
 if(hz>1)oxChartWire('oxch',gws,S);
}
/* line chart: expected points per gameweek, optional 80% band; missing values break the line */
function oxChart(id,gws,S){
 const W=680,H=270,L=42,B=30,T=14,Rr=84,vals=S.flatMap(s=>[...s.v,...(s.lo||[]),...(s.hi||[])]).filter(fpOk);
 if(!vals.length)return '<div class="empty">No values to draw.</div>';
 /* rounded ticks (1, 2, 2.5 or 5 × 10^k) on a domain fitted to the values and ranges */
 const v0=Math.min(...vals),v1=Math.max(...vals),raw=((v1-v0)||1)/4,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw);
 const lo=Math.max(0,Math.floor(v0/st)*st),hi=Math.ceil(v1/st)*st,sx=i=>L+(W-L-Rr)*(gws.length>1?i/(gws.length-1):.5),sy=v=>H-B-(H-B-T)*(v-lo)/((hi-lo)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let v=lo;v<=hi+1e-9;v+=st){g+=`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W-Rr}" y2="${sy(v).toFixed(1)}" stroke="#25374d" stroke-width=".6"/><text x="${L-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${+v.toFixed(2)}</text>`}
 gws.forEach((w,i)=>{g+=`<text x="${sx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#8a9bb0">GW${w}</text>`});
 S.forEach(s=>{if(!s.lo)return;let seg=[];const flush=()=>{if(seg.length>1)g+=`<path d="${seg.map((i,k)=>(k?'L':'M')+sx(i).toFixed(1)+' '+sy(s.hi[i]).toFixed(1)).join(' ')} ${[...seg].reverse().map(i=>'L'+sx(i).toFixed(1)+' '+sy(s.lo[i]).toFixed(1)).join(' ')} Z" fill="${s.c}" fill-opacity=".13" stroke="none"/>`;seg=[]};
  s.v.forEach((v,i)=>{if(fpOk(v)&&fpOk(s.lo[i]))seg.push(i);else flush()});flush()});
 S.forEach(s=>{let dd='',pen=false;s.v.forEach((v,i)=>{if(!fpOk(v)){pen=false;return}dd+=(pen?'L':'M')+sx(i).toFixed(1)+' '+sy(v).toFixed(1)+' ';pen=true});
  g+=`<path d="${dd}" fill="none" stroke="${s.c}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linejoin="round"/>`;
  s.v.forEach((v,i)=>{if(fpOk(v))g+=`<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="4" fill="${s.c}" stroke="#0d1520" stroke-width="2"/>`})});
 /* direct labels at the last value of each line, nudged apart so they never overlap */
 const lab=S.map(s=>{let i=s.v.length-1;while(i>=0&&!fpOk(s.v[i]))i--;return i<0?null:{s,i,y:sy(s.v[i])}}).filter(Boolean).sort((a,b)=>a.y-b.y);
 for(let k=1;k<lab.length;k++)if(lab[k].y-lab[k-1].y<13)lab[k].y=lab[k-1].y+13;
 lab.forEach(o=>{g+=`<text x="${(sx(o.i)+8).toFixed(1)}" y="${(o.y+4).toFixed(1)}" font-size="11" fill="#e8eef5">${esc(o.s.short||'')}</text>`});
 g+=`<line id="${id}x" x1="0" y1="${T}" x2="0" y2="${H-B}" stroke="#e8eef5" stroke-opacity=".5" stroke-width="1" style="display:none"/><rect id="${id}h" x="${L}" y="${T}" width="${W-L-Rr}" height="${H-B-T}" fill="transparent" style="cursor:crosshair"/>`;
 return `<div style="position:relative;max-width:760px;margin:0 auto" id="${id}"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;touch-action:pan-y" role="img" aria-label="Expected points per gameweek">${g}</svg><div id="${id}t" style="position:absolute;display:none;pointer-events:none;background:#152130;border:1px solid #25374d;border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.4;min-width:150px;z-index:2"></div></div><div class="mu" style="font-size:11px;text-align:center">Expected points per gameweek (y) by gameweek (x). Hover or tap for values; the tables below hold every number.</div>`;
}
function oxChartWire(id,gws,S){
 const box=document.getElementById(id);if(!box)return;const svg=box.querySelector('svg'),hit=document.getElementById(id+'h'),ln=document.getElementById(id+'x'),tip=document.getElementById(id+'t');
 const W=680,L=42,Rr=84,sx=i=>L+(W-L-Rr)*(gws.length>1?i/(gws.length-1):.5);
 const show=ev=>{const r=svg.getBoundingClientRect(),xv=(ev.clientX-r.left)/r.width*W;let bi=0,bd=1e9;gws.forEach((_,i)=>{const dd=Math.abs(sx(i)-xv);if(dd<bd){bd=dd;bi=i}});
  ln.setAttribute('x1',sx(bi));ln.setAttribute('x2',sx(bi));ln.style.display='';tip.textContent='';
  const h=document.createElement('div');h.style.cssText='color:#8a9bb0;margin-bottom:2px';h.textContent='GW'+gws[bi];tip.appendChild(h);
  S.forEach(s=>{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:6px';const k=document.createElementNS('http://www.w3.org/2000/svg','svg');k.setAttribute('width','16');k.setAttribute('height','6');k.innerHTML=`<line x1="0" y1="3" x2="16" y2="3" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/>`;
   const b=document.createElement('b');const v=s.v[bi];b.textContent=fpOk(v)?v.toFixed(1)+(s.lo&&fpOk(s.lo[bi])?' ('+s.lo[bi].toFixed(0)+'–'+s.hi[bi].toFixed(0)+')':''):'N/A';const n=document.createElement('span');n.style.color='#8a9bb0';n.textContent=s.n;row.append(k,b,n);tip.appendChild(row)});
  const px=sx(bi)/W*r.width;tip.style.display='block';tip.style.top='8px';tip.style.left=(px>r.width/2?Math.max(0,px-tip.offsetWidth-10):px+10)+'px'};
 hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',()=>{ln.style.display='none';tip.style.display='none'});
}
/* one-gameweek view: expected value (dot) and 80% range (bar) per lineup */
function oxRangePlot(rows){
 const W=680,rh=46,L=10,Rr=20,H=rows.length*rh+30,vals=rows.flatMap(r=>[r.mean,r.lo,r.hi]).filter(fpOk);if(!vals.length)return '';
 const hi=Math.max(...vals)*1.08,sx=v=>L+(W-L-Rr)*v/(hi||1);let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let i=0;i<=5;i++){const v=hi*i/5;g+=`<line x1="${sx(v).toFixed(1)}" y1="6" x2="${sx(v).toFixed(1)}" y2="${H-22}" stroke="#25374d" stroke-width=".6"/><text x="${sx(v).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="11" fill="#8a9bb0">${v.toFixed(0)}</text>`}
 rows.forEach((r,k)=>{const y=14+k*rh;g+=`<text x="${L}" y="${y}" font-size="12" fill="#e8eef5">${esc(r.n)}: ${fpOk(r.mean)?r.mean.toFixed(1):'N/A'}${fpOk(r.lo)?' (80% range '+r.lo.toFixed(0)+'–'+r.hi.toFixed(0)+')':''}</text>`;
  if(fpOk(r.lo))g+=`<line x1="${sx(r.lo).toFixed(1)}" y1="${y+16}" x2="${sx(r.hi).toFixed(1)}" y2="${y+16}" stroke="${r.c}" stroke-width="6" stroke-linecap="round" stroke-opacity=".55"/>`;
  if(fpOk(r.mean))g+=`<circle cx="${sx(r.mean).toFixed(1)}" cy="${y+16}" r="6" fill="${r.c}" stroke="#0d1520" stroke-width="2"/>`});
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:760px;display:block;margin:0 auto" role="img" aria-label="Expected points and 80% range per lineup">${g}</svg>`;
}

/* ---------- Backtest additions: range calibration + penalty regression vs base model (same leak-free replay) ---------- */
async function oxBtRun(d,onP){
 await oxPenLoad();
 const cap=new Map(),orig=pmPlayer;
 const runV=async v=>{OX.btVer=v;cap.clear();try{
   pmPlayer=function(p,C,dd){const m=orig(p,C,dd);if(dd!==FPD)cap.set(C.next+'|'+p.id,{p,m,C,dd});return m};
   const r=await btRun(d,x=>onP&&onP(v,x));return {r,cap:new Map(cap)}}finally{pmPlayer=orig;OX.btVer='v1'}};
 const a=await runV('v1'),b=OX.pen&&OX.pen.ok&&!d.archive?await runV('v2'):null;
 /* calibration of v1 ranges: per player-gameweek, simulate his points and compare the actual with the 10th/90th percentiles */
 const u=oxRng(99),N=300,cal=[];let k=0;
 for(const x of a.r.rows){const c=a.cap.get(x.r+'|'+x.id);if(!c)continue;const q=oxParams(Object.assign({},c.p,{pm:c.m}),0,c.dd,c.C);
  const s=new Float64Array(N);for(let i=0;i<N;i++){let v=0;for(const z of q){const G=z.lc!=null?oxPx(z.xL,u):null;v+=oxDraw(z,G,u)}s[i]=v}
  const st=oxQ(s);let bl=0,ab=0;for(const v of s){if(v<st.p10)bl++;if(v>st.p90)ab++}
  cal.push({r:x.r,pos:x.pos,act:x.act,pred:x.pred,mean:st.mean,p10:st.p10,p90:st.p90,eb:bl/N,ea:ab/N});
  if(++k%300===0){onP&&onP('cal',k);await oxYield()}}
 /* lineup level: per finished gameweek, 60 random legal XIs of players with 90+ earlier minutes and the model's optimal XI */
 const X=oxReady(),RU=X.err?null:X.RU,forms=X.err?[]:X.forms,lin=[],by=new Map();a.r.rows.forEach(x=>{if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
 if(RU)for(const [rd,L] of [...by].sort((x,y)=>x[0]-y[0])){
  const pool=L.filter(x=>x.pr>=90),act=new Map(L.map(x=>[x.id,x.act])),ls=[];
  const opt=oxSolveXI(pool.map(x=>({id:x.id,t:x.pos,c:x.price||0,club:x.club,v:x.pred})),RU,forms).best;if(opt)ls.push({kind:'opt',ids:opt.team.xi.map(i=>i.id),cap:opt.team.cap.id});
  for(let j=0;j<60;j++){const fm=forms[Math.floor(u()*forms.length)],ks=oxKs(fm),ids=[];let okk=true;
   for(const t of [1,2,3,4]){const A=pool.filter(x=>x.pos===t);for(let i=0;i<ks[t];i++){if(!A.length){okk=false;break}ids.push(A.splice(Math.floor(u()*A.length),1)[0].id)}}
   if(okk)ls.push({kind:'rand',ids,cap:ids[Math.floor(u()*ids.length)]})}
  const fxOf=id=>{const c=a.cap.get(rd+'|'+id);return c?oxParams(Object.assign({},c.p,{pm:c.m}),0,c.dd,c.C):[]},lam=oxLam(L.map(x=>fxOf(x.id)));
  for(const Lx of ls){const q=Lx.ids.map(id=>({id,fx:fxOf(id)})),P=oxPlan(q,lam),ci=Lx.ids.indexOf(Lx.cap),M=500,s=new Float64Array(M);
   for(let i=0;i<M;i++){const v=oxDrawSet(P,u);let tot=0;for(let j=0;j<v.length;j++)tot+=v[j];if(ci>=0)tot+=v[ci];s[i]=tot}
   const st=oxQ(s);let v2=0;for(const v of s)v2+=(v-st.mean)**2;
   lin.push({r:rd,kind:Lx.kind,act:Lx.ids.reduce((x,id)=>x+(act.get(id)||0),0)+(act.get(Lx.cap)||0),mean:st.mean,p10:st.p10,p90:st.p90,sd:Math.sqrt(v2/M)})}
  onP&&onP('xi',rd);await oxYield()}
 const zsd=L=>L.length?Math.sqrt(L.reduce((x,o)=>x+((o.act-o.mean)/o.sd)**2,0)/L.length):null,rr=lin.filter(x=>x.kind==='rand');
 const kappa=zsd(rr),rows=a.r.rows,mx=rows.reduce((x,o)=>x+o.pred,0)/rows.length,my=rows.reduce((x,o)=>x+o.act,0)/rows.length;let sxy=0,sxx=0;rows.forEach(o=>{sxy+=(o.pred-mx)*(o.act-my);sxx+=(o.pred-mx)**2});
 const top=[];by.forEach(L=>[...L].sort((x,y)=>y.pred-x.pred||x.id-y.id).slice(0,11).forEach(o=>top.push(o)));
 const top11=top.length?{n:top.length,pred:top.reduce((x,o)=>x+o.pred,0)/top.length,act:top.reduce((x,o)=>x+o.act,0)/top.length}:null;
 const rs=[...by.keys()].sort((x,y)=>x-y),half=rs[Math.floor(rs.length/2)],fit=rr.filter(x=>x.r<half),val=rr.filter(x=>x.r>=half),kf=zsd(fit);
 const cov=(L,k)=>L.length?L.filter(o=>o.act>=o.mean-k*(o.mean-o.p10)&&o.act<=o.mean+k*(o.p90-o.mean)).length/L.length:null;
 const lc={n:rr.length,rounds:rs,kappa,cov1:cov(rr,1),covK:cov(rr,Math.min(2,Math.max(1,kappa||1))),split:fit.length&&val.length?{half,kf,cov1:cov(val,1),covK:cov(val,Math.min(2,Math.max(1,kf))),n:val.length}:null,opt:lin.filter(x=>x.kind==='opt')};
 if(fpOk(kappa)&&!d.archive)oxLsSet(OX_LS.cal,{season:oxSeason(d),gen:d.generated,kappa:Math.min(2,Math.max(1,kappa)),top11,slope:sxx>0?sxy/sxx:null,rounds:rs,n:rr.length});
 return {at:d.generated,v1:a.r,v2:b?b.r:null,cal,lc,slope:sxx>0?sxy/sxx:null,top11};
}
function oxBtHtml(){
 const head='<h3>Points range calibration and the penalty-regression option</h3>';
 if(!OX.bt)return head+`<div class="mu" style="font-size:12px;margin-bottom:6px">Checks the 80% ranges shown in Optimal XI, My XI and Forecast: in the same leak-free replay, how often did a player's actual points fall below the 10th or above the 90th percentile of his simulated distribution? Also replays the penalty-regression option (PitchAPI penalty shots) and compares it with the base model on the same player-gameweeks.</div><div class="ctl"><button class="s" onclick="oxBtGo()" ${OX.btBusy?'disabled':''}>Run calibration and penalty-regression comparison</button></div><div id="oxbtmsg" class="mu"></div>`;
 if(OX.bt.err)return head+`<div class="empty">Could not run: ${esc(OX.bt.err)}</div>`;
 const B=OX.bt,st=BT.start,cal=B.cal.filter(x=>x.r>=st);if(!cal.length)return head+'<div class="empty">No player-gameweeks in this range.</div>';
 const avg=a=>a.reduce((s,x)=>s+x,0)/a.length,below=avg(cal.map(x=>x.act<x.p10?1:0)),above=avg(cal.map(x=>x.act>x.p90?1:0)),eb=avg(cal.map(x=>x.eb)),ea=avg(cal.map(x=>x.ea));
 const pc=v=>(v*100).toFixed(1)+'%',mean=avg(cal.map(x=>x.mean)),pred=avg(cal.map(x=>x.pred));
 const byPos=[1,2,3,4].map(t=>{const L=cal.filter(x=>x.pos===t);if(!L.length)return null;return [FPPOS[t],L.length,pc(avg(L.map(x=>x.act<x.p10?1:0))),pc(avg(L.map(x=>x.eb))),pc(avg(L.map(x=>x.act>x.p90?1:0))),pc(avg(L.map(x=>x.ea)))]}).filter(Boolean);
 let v2='';
 if(B.v2){const k=x=>x.r+'|'+x.id,m2=new Map(B.v2.rows.map(x=>[k(x),x])),pr=B.v1.rows.filter(x=>x.r>=st&&m2.has(k(x))).map(x=>({r:x.r,id:x.id,act:x.act,a:x.pred,b:m2.get(k(x)).pred}));
  const mae=(L,f)=>L.length?avg(L.map(x=>Math.abs(x[f]-x.act))):null,ch=pr.filter(x=>Math.abs(x.a-x.b)>1e-6),by=new Map();
  ch.forEach(x=>{let o=by.get(x.r);if(!o){o={n:0,g:0};by.set(x.r,o)}o.n++;o.g+=Math.abs(x.a-x.act)-Math.abs(x.b-x.act)});
  const gs=[...by.values()].map(o=>o.g/o.n),wins=gs.filter(x=>x>0).length;
  v2=`<h3>Penalty regression vs base model</h3>`+tbl([['Sample'],['N',1],['MAE base',1],['MAE with penalty regression',1]],[['All player-gameweeks',pr.length,f(mae(pr,'a'),3),f(mae(pr,'b'),3)],['Only where the option changes the prediction (penalty takers)',ch.length,f(mae(ch,'a'),3),f(mae(ch,'b'),3)]])+
   `<div class="mu" style="font-size:12px;margin:6px 0">On the changed player-gameweeks the penalty-regression option had the lower average error in ${wins} of ${gs.length} gameweeks. ${ch.length<100?'<b>The sample is far too small to conclude anything</b> (penalties are rare), so the base model stays the default; the option can be selected in the Optimal XI tab.':'the base model stays the default until the option shows a consistent gain over more gameweeks.'} Penalty shots of round r are used only when predicting later rounds.</div>`}
 else v2=`<div class="mu" style="font-size:12px">Penalty regression not tested: ${esc((OX.pen&&OX.pen.why)||'no PitchAPI penalty data')}.</div>`;
 return head+tbl([['Check'],['Model says',1],['Actual',1]],[['Actual below the 10th percentile',pc(eb),pc(below)],['Actual above the 90th percentile',pc(ea),pc(above)],['Mean points per player-gameweek',mean.toFixed(3),avg(cal.map(x=>x.act)).toFixed(3)]])+
  `<div class="mu" style="font-size:12px;margin:6px 0">${cal.length} player-gameweeks from GW${st}. "Model says" is the share of the model's own simulated outcomes beyond each percentile (points are whole numbers, so it is not exactly 10%); a calibrated model matches it. Simulated mean ${mean.toFixed(3)} vs analytic expectation ${pred.toFixed(3)} (difference = Monte Carlo error). Single-player check only: lineup ranges also depend on correlations between team-mates.</div>`+
  tbl([['Pos'],['N',1],['Below P10: actual',1],['model',1],['Above P90: actual',1],['model',1]],byPos)+oxBtLineHtml(B)+v2;
}
function oxBtLineHtml(B){
 const L=B.lc;if(!L||!L.n)return '';const pc=v=>v==null?'N/A':(v*100).toFixed(1)+'%',S=L.split;
 const opt=L.opt.map(o=>['GW'+o.r,o.mean.toFixed(1),o.p10.toFixed(0)+'–'+o.p90.toFixed(0),o.act.toFixed(0)]);
 return `<h3>Lineup ranges (11 players + captain)</h3>`+tbl([['Check'],['Value',1]],[
  ['Random legal XIs tested (GW'+L.rounds[0]+'–'+L.rounds[L.rounds.length-1]+')',L.n],
  ['Real totals inside the unwidened 80% range',pc(L.cov1)],
  ['Spread of real totals vs simulated (sd of z; 1 = calibrated)',f(L.kappa,2)],
  ['Inside the 80% range after widening by that factor (same data)',pc(L.covK)],
  ...(S?[['Out-of-sample: factor fitted before GW'+S.half+' ('+f(S.kf,2)+'), coverage on GW'+S.half+'+ ('+S.n+' XIs)',pc(S.cov1)+' → '+pc(S.covK)]]:[]),
  ['Calibration slope of actual on predicted points (1 = calibrated; below 1 = too spread out)',f(B.slope,3)],
  ...(B.top11?[['11 highest-projected players per gameweek: mean projected vs actual',B.top11.pred.toFixed(2)+' vs '+B.top11.act.toFixed(2)]]:[])])+
  `<div class="mu" style="font-size:12px;margin:6px 0">The factor (${f(L.kappa,2)}, kept between 1 and 2) is now stored on this device and widens every lineup range in Optimal XI, My XI, the comparison and the forecast (default before this run: ${OX_KAPPA}). Random XIs are a stand-in for "any lineup": the XIs of one gameweek share fixtures, so the effective sample is closer to the number of gameweeks than to the number of XIs. Highest projections are optimistic on average (selection effect), so the model's own optimal XI usually scores below its projection:</div>`+
  tbl([['GW'],['Optimal XI projected',1],['Simulated 80% range',1],['Actual',1]],opt);
}
async function oxBtGo(){
 if(OX.btBusy)return;OX.btBusy=true;const m=()=>$('#oxbtmsg');if(m())m().textContent='Replaying…';
 try{OX.bt=await oxBtRun(FPD,(v,x)=>{const e=m();if(e)e.textContent=v==='cal'?'Simulating player ranges… '+x:v==='xi'?'Simulating lineup ranges, gameweek '+x+'…':'Replaying model '+v+', gameweek '+x+'…'})}
 catch(e){OX.bt={err:e.message}}
 OX.btBusy=false;if(FP.tab==='backtest')btDraw();
}


/* ===== Season review: the model manages a team through the season (leak-free), against the best possible XI of each gameweek =====
   The squad of 15 is picked before gameweek SR_FROM with the data of the earlier gameweeks only, within the FPL budget, by the same
   exact squad optimizer as Optimal XI, valued on the expected points of the next SR_HZ gameweeks. Each later gameweek the model sees
   only rows of earlier gameweeks (as in Backtest) and picks its XI, captain and vice from the 15. FPL's automatic substitutions and
   vice-captaincy are applied to the real minutes. Two versions: the squad is kept all season, or 1 free transfer a gameweek is used
   (banked up to the season's limit, no points hits, no chips). The best XI of each gameweek in hindsight is the best starting XI by
   real points of any squad of 15 within the budget at that gameweek's prices. */
const SR={res:{},busy:false,msg:'',view:'fixed',open:false};
const SR_FROM=6,SR_HZ=6,SR_TH=1,SR_FT_CAP={'2022-23':2,'2023-24':2};
const srFtCap=d=>SR_FT_CAP[d.archive||'']||(d.rules&&fpOk(d.rules.transfers_cap)&&d.rules.transfers_cap<=5?d.rules.transfers_cap:5);
/* gameweek r with a horizon: fixtures of rounds r … r+hz−1 are unplayed, everything the model sees is from rounds before r */
function srRound(d,H,ix,fixAll,r,hz){
 const last=r+hz-1,ev=d.events.filter(e=>e.id<=last).map(e=>Object.assign({},e,{fin:e.id<r,cur:false,nxt:e.id===r}));
 const fixR=fixAll.filter(x=>x[0]===r),fix=fixAll.filter(x=>x[0]<r).concat(fixAll.filter(x=>x[0]>=r&&x[0]<=last).map(x=>{const y=x.slice();y[5]=0;y[6]=null;y[7]=null;return y}));
 const sh=[],tg=[],Hp={},club=new Map(),plays=t=>fixR.some(x=>x[1]===t||x[2]===t);
 for(const p of d.P){const rows=H[String(p.id)];if(!rows)continue;
  const rr=rows.filter(x=>x[0]===r),prior=rows.filter(x=>x[0]<r),lx=prior[prior.length-1];
  /* no row this gameweek: his club from his last match; he is still in the game only if that club has no fixture (a blank gameweek) */
  const tm=rr.length?btTeamAt(p,rr,fixR,ix):lx?btTeamAt(p,[lx],fixAll.filter(x=>x[0]===lx[0]),ix):p.tm,blank=!rr.length&&lx&&!plays(tm);
  const o={id:p.id,ty:p.ty,tm,st:'a',nw:'',chance_of_playing_next_round:null,name:p.name};
  for(const [pf,hc] of BT_MAP)o[pf]=btSum(prior,ix[hc]);btXgScale(o,prior,ix);
  Hp[String(p.id)]=prior;sh.push(o);club.set(p.id,tm);if(rr.length||blank)tg.push({p,o,rr:rr.length?rr:[lx],blank})}
 const dd=Object.assign({},d,{events:ev,fix,P:sh,hist:Hp});delete dd._pm;delete dd._pmPred;
 const C=pmCtx(dd),out=new Map();
 for(const t of tg){const m=pmPlayer(t.o,C,dd),pv=t.rr[t.rr.length-1][ix.val],gw=C.gws.map(g=>{const x=m.q==='nodata'?null:m.gws.find(y=>y.ev===g);return x?x.pts:0});
  out.set(t.p.id,{id:t.p.id,t:t.p.ty,club:t.o.tm,c:fpOk(pv)?pv:null,pred:gw,act:t.blank?0:btSum(t.rr,ix.pts)||0,min:t.blank?0:btSum(t.rr,ix.min)||0})}
 return {r,gws:C.gws,P:out,club};
}
/* best XI of a squad for one gameweek's values; captain = highest, vice = second (oxTeam) */
function srXI(sq,val,RU,forms){const it=sq.map(x=>({id:x.id,t:x.t,c:x.c||0,club:x.club,v:val(x)}));const b=oxSolveXI(it,RU,forms).best;return b?b.team:null}
/* FPL automatic substitutions: a starter with no minutes is replaced by the first bench player (in order) who played and keeps the formation legal */
function srAuto(xi,bench,minOf,RU){
 const out=xi.map(i=>i.id),cnt={1:0,2:0,3:0,4:0},ty=new Map();xi.concat(bench).forEach(i=>ty.set(i.id,i.t));
 out.forEach(id=>cnt[ty.get(id)]++);const used=new Set(),subs=[];
 for(let k=0;k<out.length;k++){const id=out[k];if(minOf(id)>0)continue;const t=ty.get(id);
  for(const b of bench){if(used.has(b.id)||!(minOf(b.id)>0))continue;
   if(t===1?b.t!==1:b.t===1)continue;const c={...cnt};c[t]--;c[b.t]++;
   if(b.t!==1&&[2,3,4].some(q=>c[q]<RU.T[q].mn))continue;
   out[k]=b.id;used.add(b.id);cnt[t]--;cnt[b.t]++;subs.push([id,b.id]);break}}
 return {ids:out,subs};
}
function srSell(h,now){return now==null?h.buy:now>h.buy?h.buy+Math.floor((now-h.buy)/2):now}
/* the value of a squad over the horizon: sum over gameweeks of its best XI incl. captain */
function srVal(sq,RU,forms,hz){let s=0;for(let k=0;k<hz;k++){const t=srXI(sq,x=>x.pred[k]||0,RU,forms);s+=t?t.total:0}return s}
async function srRun(d,onP){
 const ix=btIx(d);for(const k of ['r','pts','min','opp','h','val'])if(ix[k]===undefined)throw new Error('the stored match history has no "'+k+'" column');
 const RU=pmRules(d);if(!RU||RU.club==null||RU.budget==null)throw new Error('the game rules (budget, club limit, positions) are missing from the data');
 const forms=pmForms(RU),H={};Object.keys(d.hist||{}).forEach(k=>{H[k]=d.hist[k].slice().sort((a,b)=>a[0]-b[0])});
 const fixAll=d.fix.filter(x=>x[0]),rounds=d.events.filter(e=>e.fin&&e.id>=SR_FROM).map(e=>e.id).sort((a,b)=>a-b);
 if(!rounds.length)throw new Error('the season review needs gameweek '+SR_FROM+' or later to be finished');
 const cap=srFtCap(d),name=id=>{const p=d.PB.get(id);return p?p.name:'#'+id};
 /* squad: before gameweek SR_FROM, expected points of the next SR_HZ gameweeks, prices of gameweek SR_FROM */
 const R0=srRound(d,H,ix,fixAll,rounds[0],SR_HZ),pool=[...R0.P.values()].filter(x=>x.c!=null).map(x=>({id:x.id,t:x.t,c:x.c,club:x.club,v:x.pred.reduce((a,b)=>a+b,0)}));
 const m=pmMode1(pool,RU,forms);if(!m.best)throw new Error('no squad of 15 within the budget could be built');
 const b0=m.best.team,ids0=b0.xi.map(i=>i.id).concat(b0.bench.map(i=>i.id)),cost0=ids0.reduce((s,id)=>s+R0.P.get(id).c,0);
 const V={fixed:{hold:ids0.map(id=>({id,buy:R0.P.get(id).c})),bank:RU.budget-cost0,ft:0,rows:[]},ft:{hold:ids0.map(id=>({id,buy:R0.P.get(id).c})),bank:RU.budget-cost0,ft:0,rows:[]}};
 const opt=[],last={};
 for(const r of rounds){
  const Rr=r===rounds[0]?R0:srRound(d,H,ix,fixAll,r,SR_HZ),P=Rr.P;
  P.forEach((x,id)=>{if(x.c!=null)last[id]=x.c});
  const sqOf=hold=>hold.map(h=>P.get(h.id)||{id:h.id,t:d.PB.get(h.id)?d.PB.get(h.id).ty:4,club:Rr.club.get(h.id)??null,c:last[h.id]??null,pred:Rr.gws.map(()=>0),act:0,min:0,gone:true});
  /* free transfers: before every gameweek after the first, +1 free transfer (banked up to the limit); each transfer is the best single
     swap by the squad's expected points over the horizon, made only if it gains at least SR_TH point (any gain when the bank is full) */
  const S=V.ft;let made=[];
  if(r!==rounds[0]){S.ft=Math.min(cap,S.ft+1);
   while(S.ft>0){const sq=sqOf(S.hold),base=srVal(sq,RU,forms,Rr.gws.length),cc=new Map();sq.forEach(x=>{if(x.club!=null)cc.set(x.club,(cc.get(x.club)||0)+1)});
    const own=new Set(S.hold.map(h=>h.id)),hz=x=>x.pred.reduce((a,b)=>a+b,0),cand=[];
    sq.forEach((o,k)=>{const sell=srSell(S.hold[k],o.c),money=S.bank+sell;
     P.forEach(x=>{if(own.has(x.id)||x.t!==o.t||x.c==null||x.c>money)return;if(x.club!==o.club&&(cc.get(x.club)||0)>=RU.club)return;cand.push({k,o,x,g:hz(x)-hz(o),sell})})});
    cand.sort((a,b)=>b.g-a.g||a.x.id-b.x.id);let best=null;
    for(const c of cand.slice(0,40)){const sq2=sq.slice();sq2[c.k]=c.x;const g=srVal(sq2,RU,forms,Rr.gws.length)-base;if(!best||g>best.g+1e-9)best={...c,g}}
    if(!best||best.g<(S.ft>=cap?1e-9:SR_TH))break;
    S.bank+=best.sell-best.x.c;S.hold[best.k]={id:best.x.id,buy:best.x.c};S.ft--;made.push({out:best.o.id,in:best.x.id,g:Math.round(best.g*1000)/1000})}}
  for(const key of ['fixed','ft']){const Z=V[key],sq=sqOf(Z.hold),t=srXI(sq,x=>x.pred[0]||0,RU,forms);if(!t){Z.rows.push({r,err:true});continue}
   const xiS=new Set(t.xi.map(i=>i.id)),bench=sq.filter(x=>!xiS.has(x.id)).sort((a,b)=>(a.t===1)-(b.t===1)||(b.pred[0]||0)-(a.pred[0]||0)||a.id-b.id);
   const minOf=id=>(P.get(id)||{min:0}).min,actOf=id=>(P.get(id)||{act:0}).act,au=srAuto(t.xi,bench,minOf,RU);
   const capId=minOf(t.cap.id)>0?t.cap.id:(t.vice&&minOf(t.vice.id)>0?t.vice.id:null);
   const act=au.ids.reduce((s,id)=>s+actOf(id),0)+(capId!=null?actOf(capId):0);
   Z.rows.push({r,exp:t.total,act,xi:t.xi.map(i=>i.id),cap:t.cap.id,vice:t.vice?t.vice.id:null,capUsed:capId,subs:au.subs,form:t.form.name,tr:key==='ft'?made:[],ft:key==='ft'?Z.ft:null,
    value:sq.reduce((s,x)=>s+(x.c||0),0),bank:Z.bank})}
  /* best XI in hindsight: real points, any squad of 15 within the budget at this gameweek's prices */
  const op=pmMode1([...P.values()].filter(x=>x.c!=null).map(x=>({id:x.id,t:x.t,c:x.c,club:x.club,v:x.act})),RU,forms).best;
  opt.push(op?{r,pts:op.team.total,xi:op.team.xi.map(i=>i.id),cap:op.team.cap.id,form:op.form.name}:{r,pts:null});
  if(onP)onP(r,rounds[rounds.length-1]);await oxYield();
 }
 return {season:d.archive||'',ver:PM_VERSION,av:d.av||null,from:rounds[0],to:rounds[rounds.length-1],cap,budget:RU.budget,squad:ids0.map(id=>({id,c:R0.P.get(id).c,t:R0.P.get(id).t,v:R0.P.get(id).pred.reduce((a,b)=>a+b,0),xi:b0.xi.some(i=>i.id===id)})),
  cost0,fixed:V.fixed.rows,ft:V.ft.rows,opt,hz:SR_HZ};
}
/* ---------- Season review tab ---------- */
const SR_VER='sr1',SR_COL={act:'#3987e5',exp:'#d95926',opt:'#199e70',dlt:'#8a9bb0'};
const srKey=d=>(d.archive||'live:'+d.generated)+'|'+PM_VERSION+'|'+SR_VER;
async function srStored(d){
 if(!d.archive)return null;
 if(SR.file===undefined){try{const r=await fetch('data/fpl_review.json?v='+encodeURIComponent(SR_VER));SR.file=r.ok?await r.json():null}catch(e){SR.file=null}}
 const R=SR.file&&SR.file.seasons&&SR.file.seasons[d.archive];return R&&R.ver===PM_VERSION&&R.av===(d.av||null)&&SR.file.sr===SR_VER?R:null;
}
function fpTReview(el){
 const d=FPD,k=srKey(d);
 el.innerHTML=`<div class="card mu" style="font-size:12px"><b>How this works.</b> Before gameweek ${SR_FROM} the model picks its squad of 15 within the £${((d.rules&&d.rules.budget)||1000)/10}m budget using only gameweeks 1–${SR_FROM-1} (the same squad optimizer as Optimal XI, valued on the expected points of the next ${SR_HZ} gameweeks). In every later gameweek it sees only earlier gameweeks, as in Backtest, and picks its XI, captain and vice-captain from the squad; FPL's automatic substitutions and the vice-captain rule are applied to the real minutes. <b>Expected</b> = the model's projection for the XI it picked (captain doubled), <b>Actual</b> = the points that XI really scored, <b>Δ</b> = actual − expected. <b>Best XI in hindsight</b> = the highest-scoring starting XI (captain doubled) of any squad of 15 within the budget at that gameweek's prices, a ceiling no manager reaches. Prices are FPL's prices of each gameweek; chips and points hits are not used.</div>
 <div class="ctl"><select id="srv" aria-label="Version">${fpOpts([['fixed','Squad kept all season (no transfers)'],['ft','1 free transfer a week']],SR.view)}</select><label style="display:inline-flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="sro" ${SR.open?'checked':''}> Best XI in hindsight on the chart</label></div><div id="srout"><div class="empty">Loading…</div></div>`;
 $('#srv').onchange=()=>{SR.view=$('#srv').value;srDraw()};$('#sro').onchange=()=>{SR.open=$('#sro').checked;srDraw()};
 if(SR.res[k])return srDraw();
 srStored(d).then(R=>{if(R){SR.res[k]=R;srDraw()}else srAsk()});
}
function srAsk(){const o=$('#srout');if(!o)return;o.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:6px">The review replays the season on this device (a few seconds on a laptop, longer on a phone).</div><div class="ctl"><button onclick="srGo()" ${SR.busy?'disabled':''}>Run the season review</button></div><div id="srmsg" class="mu"></div>`}
async function srGo(){
 if(SR.busy)return;SR.busy=true;const d=FPD,k=srKey(d);srAsk();
 try{SR.res[k]=await srRun(d,(r,to)=>{const m=$('#srmsg');if(m)m.textContent='Replaying gameweek '+r+' of '+to+'… (no future data is used)'})}
 catch(e){SR.busy=false;const m=$('#srmsg');if(m)m.textContent='Could not run the season review: '+e.message;return}
 SR.busy=false;if(FPD===d&&FP.tab==='review')srDraw();
}
function srDraw(){
 const o=$('#srout'),d=FPD,R=SR.res[srKey(d)];if(!o||!R)return;
 const rows=R[SR.view].filter(x=>!x.err),om=new Map(R.opt.map(x=>[x.r,x])),nm=id=>{const p=d.PB.get(id);return p?p.name:'#'+id},tn=id=>{const p=d.PB.get(id);return p?p.tn:''};
 const sum=(L,f)=>L.reduce((s,x)=>s+(f(x)||0),0),A=sum(rows,x=>x.act),E=sum(rows,x=>x.exp),O=sum(rows,x=>{const q=om.get(x.r);return q&&q.pts}),f1=x=>x.toFixed(1);
 const alt=R[SR.view==='fixed'?'ft':'fixed'].filter(x=>!x.err),altA=sum(alt,x=>x.act),nT=sum(rows,x=>x.tr?x.tr.length:0);
 const gws=rows.map(x=>x.r),S=[{n:'Actual points',short:'Actual',v:rows.map(x=>x.act),c:SR_COL.act,dash:''},{n:'Expected points',short:'Expected',v:rows.map(x=>x.exp),c:SR_COL.exp,dash:'7 4'}].concat(SR.open?[{n:'Best XI in hindsight',short:'Best XI',v:rows.map(x=>{const q=om.get(x.r);return q?q.pts:null}),c:SR_COL.opt,dash:'2 3'}]:[]);
 const dl=rows.map(x=>x.act-x.exp);
 o.innerHTML=`<div class="grid"><div class="kpi"><b>${A}</b><span>Actual points, GW${R.from}–${R.to} (${SR.view==='fixed'?'squad kept':'with '+nT+' free transfer'+(nT===1?'':'s')})</span></div><div class="kpi"><b>${f1(E)}</b><span>Expected by the model for the XIs it picked</span></div><div class="kpi"><b>${(A-E>=0?'+':'')+f1(A-E)}</b><span>Actual − expected over the season (${f1((A-E)/rows.length)} a gameweek)</span></div><div class="kpi"><b>${O}</b><span>Best XI in hindsight, every gameweek (the team reached ${O?Math.round(A/O*100):0}% of it)</span></div><div class="kpi"><b>${altA}</b><span>${SR.view==='fixed'?'With 1 free transfer a week':'Squad kept all season'} (${(altA-A>=0?'+':'')+(altA-A)} points)</span></div></div>
 <div class="ctl" style="margin:10px 0 2px;font-size:13px;gap:14px">${S.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${s.c}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg>${esc(s.n)}</span>`).join('')}<span style="display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="${SR_COL.dlt}" fill-opacity=".55"/></svg>Δ actual − expected</span></div>
 ${srChart('srch',gws,S,dl,Math.round(Math.max(340,Math.min(680,o.clientWidth||680))))}
 <h3>Squad picked before GW${R.from}</h3><div class="mu" style="font-size:12px;margin-bottom:6px">£${(R.cost0/10).toFixed(1)}m of £${(R.budget/10).toFixed(1)}m, chosen with gameweeks 1–${R.from-1} only. Expected points of GW${R.from}–${R.from+R.hz-1} as the model saw them then.</div>
 ${tbl([['Player'],['Team'],['Pos'],['Price',1],['Expected GW'+R.from+'–'+(R.from+R.hz-1),1]],[...R.squad].sort((a,b)=>b.xi-a.xi||a.t-b.t||b.v-a.v).map(x=>[esc(nm(x.id))+(x.xi?'':' <span class="mu">(bench)</span>'),esc(tn(x.id)),FPPOS[x.t],(x.c/10).toFixed(1),f1(x.v)]))}
 <h3>Gameweek by gameweek</h3>
 ${tbl([['GW'],['Captain'],['Expected',1],['Actual',1],['Δ',1],['Best XI in hindsight',1]].concat(SR.view==='ft'?[['Transfers']]:[]),rows.map(x=>{const q=om.get(x.r),cp=x.capUsed==null?'— <span class="mu">(captain and vice did not play)</span>':esc(nm(x.capUsed))+(x.capUsed!==x.cap?' <span class="mu">(vice)</span>':'');
  return ['GW'+x.r,cp,f1(x.exp),String(x.act),(x.act-x.exp>=0?'+':'')+f1(x.act-x.exp),q&&q.pts!=null?String(q.pts):'N/A'].concat(SR.view==='ft'?[x.tr.length?x.tr.map(t=>esc(nm(t.out))+' → '+esc(nm(t.in))).join('<br>'):'<span class="mu">none ('+x.ft+' banked)</span>']:[])}).concat([['<b>Total</b>','',`<b>${f1(E)}</b>`,`<b>${A}</b>`,`<b>${(A-E>=0?'+':'')+f1(A-E)}</b>`,`<b>${O}</b>`].concat(SR.view==='ft'?[`<b>${nT}</b>`]:[])]))}
 <div class="mu" style="font-size:12px;margin:6px 0">Model ${esc(R.ver)}. ${SR.view==='ft'?`Free transfers: 1 a gameweek from GW${R.from+1}, banked up to ${R.cap}; each is the best single swap by the squad's expected points over the next ${R.hz} gameweeks and is made when it gains at least ${SR_TH} point (any gain when the bank is full). Selling prices follow FPL (half of any rise, rounded down). `:''}Automatic substitutions: a starter with no minutes is replaced by the first bench player who played and keeps the formation legal. Fixtures of later gameweeks are known in advance, as in the game; their results are not.${d.archive==='2022-23'?' FPL published expected goals and assists only from gameweek 16 of 2022-23: before that the model uses goals and assists in their place.':''}</div>`;
 srChartWire('srch',gws,S,dl);
}
/* lines (points per gameweek) and Δ bars on the same points axis */
function srChart(id,gws,S,dl,W){
 /* drawn at the width of the page (340–680 px) so its text keeps its size on a phone */
 const H=W<500?260:290,L=42,B=30,T=14,Rr=66,vals=S.flatMap(s=>s.v).concat(dl).filter(fpOk);if(!vals.length)return '<div class="empty">No values to draw.</div>';
 const v0=Math.min(0,...vals),v1=Math.max(...vals),raw=((v1-v0)||1)/5,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw);
 const lo=Math.floor(v0/st)*st,hi=Math.ceil(v1/st)*st,n=gws.length,bw=(W-L-Rr)/n,sx=i=>L+bw*(i+.5),sy=v=>H-B-(H-B-T)*(v-lo)/((hi-lo)||1);
 let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
 for(let v=lo;v<=hi+1e-9;v+=st){g+=`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W-Rr}" y2="${sy(v).toFixed(1)}" stroke="${Math.abs(v)<1e-9?'#8a9bb0':'#25374d'}" stroke-width="${Math.abs(v)<1e-9?1:.6}"/><text x="${L-6}" y="${(sy(v)+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8a9bb0">${+v.toFixed(2)}</text>`}
 const every=Math.ceil(n/Math.max(4,Math.floor((W-L-Rr)/46))),lastTick=Math.floor((n-1)/every)*every,tick=i=>i===n-1||(i%every===0&&(i!==lastTick||n-1-i>=every*.7));gws.forEach((w,i)=>{if(tick(i))g+=`<text x="${sx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#8a9bb0">GW${w}</text>`});
 const z=sy(0),w=Math.max(2,Math.min(14,bw-2));
 dl.forEach((v,i)=>{if(!fpOk(v)||Math.abs(v)<1e-9)return;const y=sy(v),h=Math.abs(y-z),r=Math.min(3,h/2,w/2),x=sx(i)-w/2;
  /* rounded at the data end, square at the zero line */
  const pth=v>0?`M${x} ${z}V${y+r}Q${x} ${y} ${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${z}Z`:`M${x} ${z}V${y-r}Q${x} ${y} ${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y-r}V${z}Z`;
  g+=`<path d="${pth}" fill="${SR_COL.dlt}" fill-opacity=".55"/>`});
 S.forEach(s=>{let dd='',pen=false;s.v.forEach((v,i)=>{if(!fpOk(v)){pen=false;return}dd+=(pen?'L':'M')+sx(i).toFixed(1)+' '+sy(v).toFixed(1)+' ';pen=true});
  g+=`<path d="${dd}" fill="none" stroke="${s.c}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linejoin="round"/>`});
 const lab=S.map(s=>{let i=s.v.length-1;while(i>=0&&!fpOk(s.v[i]))i--;return i<0?null:{s,i,y:sy(s.v[i])}}).filter(Boolean).sort((a,b)=>a.y-b.y);
 for(let k=1;k<lab.length;k++)if(lab[k].y-lab[k-1].y<13)lab[k].y=lab[k-1].y+13;
 lab.forEach(q=>{g+=`<text x="${(sx(q.i)+8).toFixed(1)}" y="${(q.y+4).toFixed(1)}" font-size="11" fill="#e8eef5">${esc(q.s.short)}</text>`});
 g+=`<line id="${id}x" x1="0" y1="${T}" x2="0" y2="${H-B}" stroke="#e8eef5" stroke-opacity=".5" stroke-width="1" style="display:none"/><rect id="${id}h" x="${L}" y="${T}" width="${W-L-Rr}" height="${H-B-T}" fill="transparent" style="cursor:crosshair"/>`;
 return `<div style="position:relative;max-width:760px;margin:0 auto" id="${id}" data-w="${W}"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;touch-action:pan-y" role="img" aria-label="Actual and expected points per gameweek">${g}</svg><div id="${id}t" style="position:absolute;display:none;pointer-events:none;background:#152130;border:1px solid #25374d;border-radius:8px;padding:6px 8px;font-size:12px;line-height:1.4;min-width:150px;z-index:2"></div></div><div class="mu" style="font-size:11px;text-align:center">Points per gameweek (y) by gameweek (x); bars = actual − expected. Hover or tap for values; the table below holds every number.</div>`;
}
function srChartWire(id,gws,S,dl){
 const box=document.getElementById(id);if(!box)return;const svg=box.querySelector('svg'),hit=document.getElementById(id+'h'),ln=document.getElementById(id+'x'),tip=document.getElementById(id+'t');
 const W=+box.dataset.w||680,L=42,Rr=66,bw=(W-L-Rr)/gws.length,sx=i=>L+bw*(i+.5);
 const row=(c,dash,val,name,bar)=>{const r=document.createElement('div');r.style.cssText='display:flex;align-items:center;gap:6px';const k=document.createElementNS('http://www.w3.org/2000/svg','svg');k.setAttribute('width','16');k.setAttribute('height','8');
  k.innerHTML=bar?`<rect x="4" y="0" width="8" height="8" rx="2" fill="${c}" fill-opacity=".55"/>`:`<line x1="0" y1="4" x2="16" y2="4" stroke="${c}" stroke-width="2.5" stroke-dasharray="${dash}"/>`;const b=document.createElement('b');b.textContent=val;const n=document.createElement('span');n.style.color='#8a9bb0';n.textContent=name;r.append(k,b,n);return r};
 const show=ev=>{const r=svg.getBoundingClientRect(),xv=(ev.clientX-r.left)/r.width*W,bi=Math.max(0,Math.min(gws.length-1,Math.floor((xv-L)/bw)));
  ln.setAttribute('x1',sx(bi));ln.setAttribute('x2',sx(bi));ln.style.display='';tip.textContent='';
  const h=document.createElement('div');h.style.cssText='color:#8a9bb0;margin-bottom:2px';h.textContent='GW'+gws[bi];tip.appendChild(h);
  S.forEach(s=>{const v=s.v[bi];tip.appendChild(row(s.c,s.dash,fpOk(v)?(Number.isInteger(v)?String(v):v.toFixed(1)):'N/A',s.n))});
  tip.appendChild(row(SR_COL.dlt,'',(dl[bi]>=0?'+':'')+dl[bi].toFixed(1),'Δ actual − expected',true));
  const px=sx(bi)/W*r.width;tip.style.display='block';tip.style.top='8px';tip.style.left=(px>r.width/2?Math.max(0,px-tip.offsetWidth-10):px+10)+'px'};
 hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',()=>{ln.style.display='none';tip.style.display='none'});
}

const AR={"Overview": "نظرة عامة", "Players": "اللاعبون", "Teams": "الفرق", "Matches": "المباريات", "Comparison Lab": "مختبر المقارنة", "Compare": "مقارنة", "Tactical": "التكتيك", "Shots": "التسديدات", "Passing": "التمريرات", "Defensive": "الدفاع", "Look Like": "لاعبون متشابهون", "Heatmaps": "خرائط الحرارة", "Rankings": "الترتيب", "Fantasy": "الفانتازي", "Data Availability": "توفر البيانات", "Settings": "الإعدادات", "· current season": "· الموسم الحالي", "current season": "الموسم الحالي", "Loading…": "جارٍ التحميل…", "Loading league…": "جارٍ تحميل الدوري…", "Tactical Analysis": "التحليل التكتيكي", "Available": "متوفر", "Complete": "مكتمل", "Not yet integrated": "غير مدمج بعد", "Partial": "جزئي", "Medium": "متوسطة", "Low": "منخفضة", "Higher": "أعلى", "No data": "بدون بيانات", "Injured": "مصاب", "Doubtful": "مشكوك فيه", "Doubtful (#%)": "مشكوك فيه (#%)", "Suspended": "موقوف", "Unavailable": "غير متاح", "Not in squad": "خارج القائمة", "ok": "تم", "pending": "قيد الانتظار", "failed": "فشل", "Status": "الحالة", "Analysed": "المُحلّلة", "Leagues": "الدوريات", "League": "الدوري", "Country": "الدولة", "GKP": "حارس", "DEF": "مدافع", "MID": "وسط", "FWD": "مهاجم", "GK": "حارس", "DF": "مدافع", "MF": "وسط", "FW": "مهاجم", "ST": "مهاجم", "CM": "وسط", "FB": "ظهير", "CB": "قلب دفاع", "Player": "اللاعب", "Club": "النادي", "Team": "الفريق", "team": "الفريق", "Pos": "المركز", "Date": "التاريخ", "Match": "المباراة", "Data": "البيانات", "Name": "الاسم", "Metric": "المقياس", "Metrics": "المقاييس", "Games": "المباريات", "Minutes": "الدقائق", "Minutes #": "الدقائق #", "Min": "دقائق", "# min": "# د", "Min minutes": "أقل عدد دقائق", "Goals": "الأهداف", "Goals #": "أهداف #", "goals #": "أهداف #", "Goal": "هدف", "Assists": "التمريرات الحاسمة", "Assists #": "تمريرات حاسمة #", "Assist": "تمريرة حاسمة", "Shots on target": "تسديدات على المرمى", "On target": "على المرمى", "Penalties": "ركلات الجزاء", "Penalty": "ركلة جزاء", "Saves": "التصديات", "Saves #": "تصديات #", "Clean sheet": "شباك نظيفة", "Clean sheets": "شباك نظيفة", "Clean sheet #": "شباك نظيفة #", "CS": "شباك نظيفة", "Bonus": "البونص", "Bonus #": "بونص #", "Bonus points": "نقاط البونص", "Points": "النقاط", "Pts": "نقاط", "Total points": "مجموع النقاط", "Total": "المجموع", "Avg": "المعدل", "Expected": "المتوقع", "expected": "متوقع", "Predicted": "المتوقع", "predicted": "متوقع", "Actual": "الفعلي", "Value": "القيمة", "Form": "الفورمة", "Price (£m)": "السعر (£m)", "Max price": "أعلى سعر", "Cost": "التكلفة", "Search player": "ابحث عن لاعب", "Search player or club": "ابحث عن لاعب أو نادي", "Search a player or club…": "ابحث عن لاعب أو نادي…", "Search metrics…": "ابحث في المقاييس…", "All teams": "كل الفرق", "All positions": "كل المراكز", "All players": "كل اللاعبين", "Save": "حفظ", "Load": "تحميل", "Delete": "حذف", "Clear": "مسح", "Reset": "إعادة ضبط", "Details": "التفاصيل", "Replace": "استبدال", "Remove": "إزالة", "None": "لا يوجد", "None.": "لا يوجد.", "Checks": "الفحوصات", "Method": "الطريقة", "Re-run": "إعادة التشغيل", "season": "الموسم", "won": "المكسوبة", "sum": "مجموع", "# of #": "# من #", "per #": "لكل #", "# per #": "# لكل #", "Per # minutes": "لكل # دقيقة", "per # minutes": "لكل # دقيقة", "Season totals": "مجاميع الموسم", "Data updated (UTC)": "آخر تحديث للبيانات (UTC)", "Data updated (UTC): ### #:#:#": "آخر تحديث للبيانات (UTC): ### #:#:#", "Matches played": "المباريات الملعوبة", "Fully analysed": "مُحللة بالكامل", "Partial, empty or failed": "جزئية أو فارغة أو فاشلة", "Players with data": "لاعبون لهم بيانات", "Teams with data": "فرق لها بيانات", "Top xT": "الأعلى في xT", "Top xG": "الأعلى في xG", "Recent matches": "آخر المباريات", "position N/A": "المركز غير متوفر", "xT per match": "xT لكل مباراة", "xG per match": "xG لكل مباراة", "Match by match": "مباراة بمباراة", "Other sections": "أقسام أخرى", "Player metrics": "مقاييس اللاعب", "Other tabs": "تبويبات أخرى", "season: current, as last synchronized": "الموسم: الحالي، حسب آخر مزامنة", "# of # players match. Sorted by xt": "# من # لاعب مطابق. مرتب حسب xt", "# of # players match. Sorted by xt#. Per# uses only matches that have minutes": "# من # لاعب مطابق. مرتب حسب xt#. معدل كل # يستخدم المباريات اللي فيها دقائق فقط", "Sync": "المزامنة", "Heatmap": "خريطة الحرارة", "Passing network": "شبكة التمريرات", "Lineups": "التشكيلات", "xG faced": "xG المواجَه", "xG faced (GK)": "xG المواجَه (حارس)", "Match not found.": "المباراة غير موجودة.", "Player not found.": "اللاعب غير موجود.", "Team xT and xG are sums of player values from the provider": "xT وxG للفريق مجموع قيم اللاعبين من المزود", "Formations, starting positions, build-up and defensive activity": "الخطط ومراكز البداية والبناء والنشاط الدفاعي", "Needs lineup positions and event data. Not inspected yet. Nothing is drawn until real data is connected": "يحتاج مراكز التشكيلة وبيانات الأحداث. لم يُفحص بعد. لا يُرسم شيء حتى تتوفر بيانات حقيقية", "Lineups, shot map, heatmaps, passing network and events:": "التشكيلات وخريطة التسديدات وخرائط الحرارة وشبكة التمرير والأحداث:", "Shot map, heatmap, passing involvement, radar:": "خريطة التسديدات وخريطة الحرارة والمشاركة في التمرير والرادار:", "Stable player ID found on #% of player rows. Rows without an ID are matched by name": "وُجد معرّف ثابت للاعب في #% من الصفوف. الصفوف بدون معرّف تُطابق بالاسم", "players selected": "لاعبين مختارين", "Starting sets (not position limits):": "مجموعات للبداية (وليست قيود مراكز):", "Restore default": "استعادة الافتراضي", "Clear all": "مسح الكل", "Selected metrics (#)": "المقاييس المختارة (#)", "Total xT": "مجموع xT", "Expected threat (xT) (#)": "التهديد المتوقع xT (#)", "Possession value (#)": "قيمة الاستحواذ (#)", "VAEP total": "مجموع VAEP", "Attacking (#)": "الهجوم (#)", "Goal conversion %": "نسبة تحويل الأهداف %", "Creation (#)": "الصناعة (#)", "Passing (#)": "التمرير (#)", "Carrying (#)": "حمل الكرة (#)", "Carries": "حمل الكرة", "Progressive carries": "حمل الكرة التقدمي", "Carries into box": "حمل الكرة إلى المنطقة", "Dribbling (#)": "المراوغة (#)", "Take-ons": "المراوغات", "Take-ons won": "المراوغات الناجحة", "Defensive (#)": "الدفاع (#)", "Duels (#)": "الالتحامات (#)", "Aerial duels": "الالتحامات الهوائية", "Aerial duels won": "الالتحامات الهوائية المكسوبة", "Positioning (#)": "التمركز (#)", "Goalkeeping (#)": "حراسة المرمى (#)", "Chart value: relative to the selection": "قيمة الرسم: نسبةً للاعبين المختارين", "Chart value: percentile in the competition": "قيمة الرسم: المئين في المسابقة", "Reference: outfield players (GK vs GK)": "المرجع: لاعبو الميدان (الحارس مع الحراس)", "Reference: same position": "المرجع: نفس المركز", "Reference: all players": "المرجع: كل اللاعبين", "Fill": "تعبئة", "Auto fill": "تعبئة تلقائية", "Detailed comparison": "مقارنة تفصيلية", "Minimum minutes for players in the reference population": "أقل عدد دقائق للاعبين في مجموعة المرجع", "Search and add players above. Nothing is drawn until you select at least one": "ابحث وأضف لاعبين بالأعلى. لا يُرسم شيء حتى تختار لاعباً واحداً على الأقل", "calculated: goals − xG (calculated)": "محسوب: الأهداف − xG", "calculated: goals ÷ shots (calculated)": "محسوب: الأهداف ÷ التسديدات", "calculated: take-ons won ÷ take-ons (calculated)": "محسوب: المراوغات الناجحة ÷ المراوغات", "calculated: sum of the four fields above (calculated)": "محسوب: مجموع الحقول الأربعة أعلاه", "calculated: aerials won ÷ aerials (calculated)": "محسوب: الهوائية المكسوبة ÷ الهوائية", "calculated: duels won − aerials won (assumes duels_won includes aerials": "محسوب: الالتحامات المكسوبة − الهوائية المكسوبة (بافتراض أن duels_won يشمل الهوائية", "not stated in the provider docs) (calculated)": "وهذا غير مذكور في توثيق المزود)", "heatmaps: player cells with x ≥ half ÷ all cells (calculated)": "خرائط الحرارة: خلايا اللاعب في نصف الخصم ÷ كل الخلايا (محسوب)", "players → xG faced (goalkeeper rows only) (direct)": "players → xG المواجَه (صفوف الحراس فقط) (مباشر)", "Defensive actions (tackles + interceptions + blocks + clearances)": "الأفعال الدفاعية (افتكاك + اعتراض + صد + إبعاد)", "Open Players and press + next to 2 or more players.": "افتح صفحة اللاعبين واضغط + بجانب لاعبين أو أكثر.", "Pick at least one stat group.": "اختر مجموعة إحصائيات واحدة على الأقل.", "This player has no data for the selected stats.": "هذا اللاعب ليس له بيانات في الإحصائيات المختارة.", "No metric matches. Only metrics with real PitchAPI data in this competition are listed.": "لا يوجد مقياس مطابق. تظهر فقط المقاييس اللي لها بيانات PitchAPI حقيقية في هذه المسابقة.", "xG/shot": "xG لكل تسديدة", "xG per shot": "xG لكل تسديدة", "Conv. %": "نسبة التحويل %", "Conversion %": "نسبة التحويل %", "Goals − xG": "الأهداف − xG", "G − xG": "أ − xG", "Crosses": "العرضيات", "Tackles": "الافتكاك", "Blocks": "الصدّات", "Duels won": "الالتحامات المكسوبة", "Ground duels won": "الالتحامات الأرضية المكسوبة", "Key passes": "التمريرات المفتاحية", "Passes": "التمريرات", "Progressive passes": "التمريرات التقدمية", "Passes into box": "التمريرات داخل المنطقة", "Through balls": "التمريرات البينية", "Take-on success %": "نجاح المراوغة %", "Interceptions": "الاعتراضات", "Clearances": "الإبعادات", "Actions in opponent half %": "الأفعال في نصف الخصم %", "Aerial win %": "نسبة الفوز بالهوائية %", "Aerials won": "الهوائية المكسوبة", "Aerials": "الهوائية", "Aerial %": "الهوائية %", "Def. actions": "أفعال دفاعية", "Opp-half %": "نصف الخصم %", "Switches": "تحويل اللعب", "Shot-creating actions": "أفعال صنع التسديد", "Goal-creating actions": "أفعال صنع الهدف", "xG chain": "سلسلة xG", "xG buildup": "بناء xG", "Box %": "داخل المنطقة %", "Avg dist (m)": "متوسط المسافة (م)", "SoT %": "على المرمى %", "Interc": "اعتراض", "Ground won": "الأرضية المكسوبة", "Acc %": "الدقة %", "Progr": "تقدمية", "Into box": "إلى المنطقة", "Key": "مفتاحية", "Through": "بينية", "Off target": "خارج المرمى", "Saved": "تصدّى لها الحارس", "Blocked": "مصدودة", "Post": "القائم", "Hit the post": "ارتطمت بالقائم", "y # m, height # m": "y # م، الارتفاع # م", "Flip left/right": "اقلب يسار/يمين", "Attack direction →": "اتجاه الهجوم →", "Fast break": "هجمة مرتدة", "Free kick": "ركلة حرة", "From corner": "من ركنية", "Individual play": "مجهود فردي", "Regular play": "لعب مفتوح", "Set piece": "كرة ثابتة", "Throw-in set piece": "من رمية تماس", "Header": "رأسية", "Left foot": "القدم اليسرى", "Right foot": "القدم اليمنى", "Other body part": "جزء آخر من الجسم", "Inside the box": "داخل المنطقة", "Outside the box": "خارج المنطقة", "All matches (season)": "كل المباريات (الموسم)", "All outcomes": "كل النتائج", "All situations": "كل الحالات", "All body parts": "كل أجزاء الجسم", "Any zone": "أي منطقة", "Table sort: goals": "ترتيب الجدول: الأهداف", "Matches that do not reconcile": "مباريات لا تتطابق أهدافها", "Conversion (goals ÷ all shots)": "التحويل (الأهداف ÷ كل التسديدات)", "On target (provider flag)": "على المرمى (حسب المزود)", "Goals ÷ on target": "الأهداف ÷ على المرمى", "npxG (no penalties)": "npxG (بدون ركلات الجزاء)", "Avg distance to goal (derived)": "متوسط المسافة للمرمى (مشتق)", "height above # m is drawn at # m)": "الارتفاع فوق # م يُرسم عند # م)", "Tap a shot for its details": "اضغط على تسديدة لتفاصيلها", "By situation": "حسب الحالة", "situation": "الحالة", "By body part": "حسب جزء الجسم", "body part": "جزء الجسم", "By outcome": "حسب النتيجة", "outcome": "النتيجة", "By minute": "حسب الدقيقة", "minute": "الدقيقة", "Goal check": "مطابقة الأهداف", "From minute": "من الدقيقة", "To minute": "إلى الدقيقة", "Min shots": "أقل عدد تسديدات", "No shots match this selection.": "لا توجد تسديدات تطابق هذا الاختيار.", "# shots in # of # matches. Every figure comes from PitchAPI's shot data": "# تسديدة في # من # مباراة. كل رقم من بيانات تسديدات PitchAPI", "own goals are left out of shooting figures": "الأهداف العكسية مستبعدة من أرقام التسديد", "Goals from shots + own goals (own goals are credited to no player)": "أهداف من تسديدات + أهداف عكسية (العكسية لا تُحسب لأي لاعب)", "Shot-data goals / official score goals, same # matches": "أهداف بيانات التسديد / أهداف النتيجة الرسمية، لنفس الـ# مباراة", "Marker size = xG. Showing the # highest-xG shots of #": "حجم العلامة = xG. يُعرض أعلى # تسديدة xG من أصل #", "narrow the filters to see all. Tap a shot for details. Every team attacks to the right": "ضيّق الفلاتر لرؤية الكل. اضغط على تسديدة للتفاصيل. كل فريق يهاجم لليمين", "Goal view (where shots crossed the goal line)": "منظر المرمى (أين عبرت التسديدات خط المرمى)", "# of # shown shots have goal-line coordinates (posts at the white frame": "# من # تسديدة معروضة لها إحداثيات خط المرمى (القائمان عند الإطار الأبيض", "This table lists # of # players (top # with at least # shots) and accounts for # of the # goals from shots in the current selection. The other goals belong to players outside this list, so adding up a table will not reach the total": "الجدول يعرض # من # لاعب (أفضل # بحد أدنى # تسديدات) ويشمل # من # هدف من تسديدات في الاختيار الحالي. باقي الأهداف للاعبين خارج القائمة، فمجموع الجدول لن يصل للإجمالي", "This table lists # of # teams (top # with at least # shots) and accounts for # of the # goals from shots in the current selection": "الجدول يعرض # من # فريق (أفضل # بحد أدنى # تسديدات) ويشمل # من # هدف من تسديدات في الاختيار الحالي", "Every match with shot data reconciles with its official score (goals in shots + own goals = score)": "كل مباراة لها بيانات تسديد تتطابق مع نتيجتها الرسمية (أهداف التسديدات + العكسية = النتيجة)", "untick \"Flip left/right\" if a shooter looks mirrored": "ألغِ \"اقلب يسار/يمين\" إذا ظهر مسدد معكوساً", "All players (sort by passes)": "كل اللاعبين (ترتيب بالتمريرات)", "Observation window:": "نافذة الرصد:", "What PitchAPI provides:": "ما يوفره PitchAPI:", "Not provided:": "غير متوفر:", "Min passes": "أقل عدد تمريرات", "Tap a player or a link for details": "اضغط على لاعب أو رابط للتفاصيل", "No pass network for this selection.": "لا توجد شبكة تمرير لهذا الاختيار.", "Pass categories (counts per player, this match)": "أنواع التمرير (عدد لكل لاعب، هذه المباراة)", "Showing # of # links (at least # passes). Tap a player or a link": "يُعرض # من # رابط (بحد أدنى # تمريرات). اضغط على لاعب أو رابط", "the arrow points from passer to receiver. Receivers are inferred, so a pass with no resolved receiver is in the node total but has no link": "السهم من الممرر إلى المستلم. المستلم مستنتج، فالتمريرة بدون مستلم معروف تُحسب للاعب لكن بدون رابط", "a pass network per team (player positions = average origin of completed passes, links = number of passes between two players) and per-player pass counts by category": "شبكة تمرير لكل فريق (موقع اللاعب = متوسط مكان تمريراته الناجحة، الرابط = عدد التمريرات بين لاعبين) وعدد التمريرات لكل لاعب حسب النوع", "individual passes with start/end coordinates, pass success per pass, and xT per pass, so a pass-by-pass map cannot be drawn and no pass xT is shown": "إحداثيات بداية ونهاية كل تمريرة ونجاحها وxT لكل تمريرة، فلا يمكن رسم خريطة تمريرة بتمريرة ولا يظهر xT للتمرير", "starting eleven until the team's first substitution (about minute #). Passes after that are not included, so this is not the whole match": "التشكيلة الأساسية حتى أول تبديل للفريق (حوالي الدقيقة #). التمريرات بعدها غير مشمولة، فهذا ليس كامل المباراة", "Definition (PitchAPI):": "التعريف (PitchAPI):", "nothing is estimated here": "لا شيء مقدّر هنا", "PPDA (Σ passes ÷ Σ actions)": "PPDA (Σ التمريرات ÷ Σ الأفعال)", "Avg of match PPDA": "معدل PPDA للمباريات", "By match": "حسب المباراة", "Opp. passes": "تمريرات الخصم", "Check op÷da": "تحقق", "What this shows:": "ماذا يعرض:", "only (table below), not per player": "فقط (الجدول أدناه)، وليس لكل لاعب", "Sort: defensive actions": "الترتيب: الأفعال الدفاعية", "# players (top #)": "# لاعب (أفضل #)", "Team pressing": "ضغط الفريق", "High turnovers": "الافتكاك العالي", "Counterpress regains": "الاستعادة بالضغط العكسي", "Recovery time (s)": "وقت الاستعادة (ث)", "Avg def. action x (m)": "متوسط موقع الفعل الدفاعي x (م)", "Field tilt %": "ميلان الملعب %", "PPDA = opponent passes attempted ÷ defensive actions by the pressing team (fouls, tackles, interceptions, challenges, blocked passes), both counted only in the pressing zone, i.e. outside the pressing team's own defensive third. Clearances and shot blocks are excluded. Lower means more intense pressing. Values come from PitchAPI": "PPDA = تمريرات الخصم ÷ الأفعال الدفاعية للفريق الضاغط (أخطاء، افتكاك، اعتراض، التحامات، تمريرات مصدودة)، وكلاهما يُحسب فقط في منطقة الضغط خارج الثلث الدفاعي للفريق الضاغط. الإبعادات وصد التسديدات مستبعدة. الأقل = ضغط أشد. القيم من PitchAPI", "Season PPDA = total opponent passes ÷ total defensive actions over the matches with data (not an average of ratios)": "PPDA الموسم = مجموع تمريرات الخصم ÷ مجموع الأفعال الدفاعية في المباريات اللي لها بيانات (وليس معدل النسب)", "every defensive count PitchAPI reports per player. It reports duels": "كل الأرقام الدفاعية اللي يرسلها PitchAPI لكل لاعب. يرسل الالتحامات", "only (not duels lost), so total duels and duel win % are not available": "المكسوبة فقط (وليس الخاسرة)، فإجمالي الالتحامات ونسبة الفوز غير متوفرة", "\"Opp-half %\" is where the player's on-ball actions happen (from heatmaps), a position indicator, not a pressing stat": "\"نصف الخصم %\" مكان أفعال اللاعب بالكرة (من خرائط الحرارة)، مؤشر تمركز وليس إحصائية ضغط", "High turnovers = regains in the attacking third that lead to a shot or the box": "الافتكاك العالي = استعادة في الثلث الهجومي تؤدي لتسديدة أو دخول المنطقة", "counterpress = regains within # s of losing the ball (per match averages). PPDA: lower = more pressing": "الضغط العكسي = استعادة خلال # ث من فقدان الكرة (معدل لكل مباراة). PPDA: الأقل = ضغط أكثر", "How it works:": "كيف يعمل:", "style and output": "الأسلوب والإنتاج", "Same position only": "نفس المركز فقط", "Any outfield position": "أي مركز في الميدان", "Attacking": "الهجوم", "Creation": "الصناعة", "Passing & carrying": "التمرير وحمل الكرة", "Position (heatmap)": "التمركز (خريطة الحرارة)", "Team pressing context": "سياق ضغط الفريق", "Pick individual stats": "اختر إحصائيات بعينها", "Team PPDA": "PPDA الفريق", "Team high turnovers /match": "افتكاك عالٍ للفريق /مباراة", "Team counterpress regains /match": "استعادة بالضغط العكسي للفريق /مباراة", "compared with # players on # stats": "مقارنة مع # لاعب في # إحصائية", "Match %": "نسبة التشابه %", "Closest on": "الأقرب في", "Biggest gaps": "أكبر الفروقات", "the match % uses per# rates": "نسبة التشابه تستخدم معدلات لكل #", "Gap (SD)": "الفرق (انحراف معياري)", "not quality: a similar profile in a weaker league can look identical on paper. Values come from PitchAPI": "وليس الجودة: لاعب بنفس الأسلوب في دوري أضعف قد يبدو مطابقاً على الورق. القيم من PitchAPI", "Tap a name to see the full stat-by-stat comparison. xG and goals are season totals": "اضغط على اسم لمقارنة كل إحصائية. xG والأهداف مجاميع الموسم", "Gap in standard deviations of the comparison pool: # = identical, ±# = one SD apart": "الفرق بالانحراف المعياري لمجموعة المقارنة: # = متطابق، ±# = انحراف معياري واحد", "xG and goals are summed from its shot data": "xG والأهداف مجموعة من بيانات التسديد", "Match-level heatmaps": "خرائط حرارة لكل مباراة", "Team or player (each attacks →)": "فريق أو لاعب (كلٌّ يهاجم →)", "Both teams on one pitch": "الفريقان في ملعب واحد", "Whole team": "الفريق كاملاً", "# actions": "# فعل", "# action": "# فعل", "# actions in one cell": "# فعل في خلية واحدة", "cell #: # actions": "الخلية #: # فعل", "No heatmap data for this selection.": "لا توجد بيانات خريطة حرارة لهذا الاختيار.", "PitchAPI provides no season heatmap. # of # matches have data": "PitchAPI لا يوفر خريطة حرارة للموسم. # من # مباراة لها بيانات", "Counts of on-the-ball actions binned by PitchAPI on a #×# grid (not raw coordinates)": "عدد الأفعال بالكرة مجمّعة من PitchAPI على شبكة #×# (وليست إحداثيات خام)", "The provider returned an empty grid for this match.": "المزود أرسل شبكة فارغة لهذه المباراة.", "The provider returned an empty grid for this selection.": "المزود أرسل شبكة فارغة لهذا الاختيار.", "Optimal XI": "التشكيلة المثالية", "My XI": "تشكيلتي", "My XI vs Optimal": "تشكيلتي مقابل المثالية", "Forecast": "التوقعات", "Table": "الجدول", "Predicted Points": "النقاط المتوقعة", "Best Team": "أفضل فريق", "Scatter": "مخطط التوزيع", "Fixtures": "جدول المباريات", "Backtest": "الاختبار التاريخي", "Official Fantasy Premier League data, as of ### #:#:# UTC": "بيانات فانتازي الدوري الإنجليزي الرسمية، حتى ### #:#:# UTC", "Gameweek #. Prices in £m. A dash or N/A means the source gave no value (never zero). PitchAPI link: # of # players with minutes matched by team and name": "الجولة #. الأسعار بالمليون جنيه. الشرطة أو N/A تعني أن المصدر ما أعطى قيمة (وليست صفراً). ربط PitchAPI: # من # لاعب لهم دقائق تمت مطابقتهم بالفريق والاسم", "the rest have no PitchAPI value": "والباقي بدون قيم PitchAPI", "GW#": "ج#", "GW #": "الجولة #", "GW": "الجولة", "GW#–#": "ج#–#", "GW#–GW#": "ج#–ج#", "GW #: #": "الجولة #: #", "GW# (next)": "ج# (القادمة)", "Lineup for GW#": "التشكيلة في الجولة #", "Evaluate from GW#": "التقييم من الجولة #", "gameweeks": "جولات", "# gameweeks": "# جولات", "# GW": "# جولات", "Next gameweek": "الجولة القادمة", "Next Gameweek": "الجولة القادمة", "Next # gameweeks": "الجولات الـ# القادمة", "next # gameweeks": "الجولات الـ# القادمة", "deadline": "الموعد النهائي", "data ### #:#:# UTC": "البيانات ### #:#:# UTC", "model v#": "النموذج v#", "Model": "النموذج", "Model v#": "النموذج v#", "Model (v#)": "النموذج (v#)", "Model v# (default)": "النموذج v# (الافتراضي)", "Model v#: penalty-regressed": "النموذج v#: ضبط ركلات الجزاء", "Prediction model": "نموذج التوقع", "all points are projections (expected values), not guarantees": "كل النقاط توقعات (قيم متوقعة) وليست ضمانات", "Fits a £#m squad of #": "ضمن ميزانية £#m لقائمة من #", "Any price (best possible XI)": "بأي سعر (أفضل تشكيلة ممكنة)", "Fixture": "المباراة", "Opponent": "الخصم", "FDR #": "صعوبة #", "blank": "بدون مباراة", "No fixture (blank)": "لا توجد مباراة (جولة فارغة)", "Optimal Starting XI": "التشكيلة الأساسية المثالية", "Formation": "الخطة", "Formation ###": "الخطة ###", "Expected points, XI incl. captain, GW#": "النقاط المتوقعة للأساسيين مع الكابتن، ج#", "#% range (#th–#th percentile, simulated)": "نطاق #% (المئين #–#، بالمحاكاة)", "#% range (simulated)": "نطاق #% (بالمحاكاة)", "XI cost": "تكلفة التشكيلة", "squad £#m": "القائمة £#m", "Captain": "الكابتن", "Key selection decisions": "أهم قرارات الاختيار", ": its best legal XI has the highest expected total": ": أفضل تشكيلة نظامية فيها لها أعلى مجموع متوقع", "the next best formation, ###, is # points lower": "الخطة التالية، ###، أقل بـ# نقطة", "has the highest expected points of the XI (#, doubled)": "صاحب أعلى نقاط متوقعة في التشكيلة (#، مضاعفة)", "P(plays) #%. Vice-captain": "احتمال مشاركته #%. نائب الكابتن", "takes the armband only if the captain does not play (expected extra #, not included in the total)": "يأخذ الشارة فقط إذا ما لعب الكابتن (زيادة متوقعة #، غير محسوبة في المجموع)", "Highest-projected players left out, and why: see the table below": "أعلى اللاعبين توقعاً اللي ما اختيروا، والسبب: في الجدول أدناه", "Budget check: this XI is the starting XI of the best #-player squad within £#m (squad cost £#m). The # bench players are chosen by the squad optimizer only to make the squad legal and affordable": "فحص الميزانية: هذه التشكيلة هي أساسيو أفضل قائمة من # لاعب ضمن £#m (تكلفة القائمة £#m). الاحتياط الـ# اختارهم المحسّن فقط لتصير القائمة نظامية وضمن الميزانية", "Full squad and bench order": "القائمة الكاملة وترتيب الاحتياط", "Best Team tab": "تبويب أفضل فريق", "# unique players": "# لاعب بدون تكرار", "legal formation ###": "خطة نظامية ###", "at most # per club (limit #)": "بحد أقصى # من كل نادٍ (الحد #)", "captain and vice are starters": "الكابتن والنائب من الأساسيين", "Why each player (GW#": "لماذا كل لاعب (ج#", "components add up to the player total)": "مجموع المكونات = نقاط اللاعب)", "P(play)": "احتمال المشاركة", "Started (last #)": "أساسي (آخر #)", "Set pieces": "الكرات الثابتة", "Goals conc": "أهداف مستقبلة", "Goals conc. #": "أهداف مستقبلة #", "Def. contr": "مساهمة دفاعية", "Def. contr. #": "مساهمة دفاعية #", "Cards/other": "بطاقات/أخرى", "Cards/other #": "بطاقات/أخرى #", "Main reasons": "أهم الأسباب", "Exp. min": "الدقائق المتوقعة", "Sum of the # player totals # + captain # = # (shown rounded as #). Component values are FPL scoring inputs (expected points per category)": "مجموع نقاط الـ# لاعب # + الكابتن # = # (معروض مقرّباً #). قيم المكونات من قواعد نقاط FPL (النقاط المتوقعة لكل فئة)", "xG, xA, team xG and opponent strength are only the predictive signals behind them and earn no points by themselves. Tap a name for the full prediction details": "xG وxA وxG الفريق وقوة الخصم مجرد مؤشرات للتوقع ولا تعطي نقاطاً بنفسها. اضغط على اسم لتفاصيل التوقع الكاملة", "Notable players left out": "لاعبون بارزون لم يُختاروا", "Why not selected": "سبب عدم الاختيار", "budget: the squad cannot afford him together with the rest": "الميزانية: القائمة ما تقدر عليه مع باقي اللاعبين", "tie-break": "تساوٍ في النقاط", "Formation comparison (exact optimum for each)": "مقارنة الخطط (الأفضل بدقة لكل خطة)", "Expected XI + captain": "المتوقع للأساسيين + الكابتن", "Squad cost": "تكلفة القائمة", "chosen": "المختارة", "double gameweek (# fixtures)": "جولة مزدوجة (# مباريات)", "clean-sheet chance #%": "فرصة الشباك النظيفة #%", "xG/# # vs # for the position": "xG/# # مقابل # لمعدل المركز", "took # penalty (# scored)": "نفّذ # ركلة جزاء (سجّل #)", "took # penalties (# scored)": "نفّذ # ركلات جزاء (سجّل #)", "# direct free-kick shots": "# تسديدات من ركلات حرة مباشرة", "# direct free-kick shot": "# تسديدة من ركلة حرة مباشرة", "Penalties №# (FPL)": "منفّذ ركلات الجزاء رقم # (FPL)", "Direct FKs №# (FPL)": "منفّذ الركلات الحرة المباشرة رقم # (FPL)", "Corners/indirect FKs №# (FPL)": "منفّذ الركنيات والحرة غير المباشرة رقم # (FPL)", "Prediction log (kept on this device)": "سجل التوقعات (محفوظ على هذا الجهاز)", "— # recorded recommendation": "— # توصية مسجلة", "— # recorded recommendations": "— # توصيات مسجلة", "Recorded": "وقت التسجيل", "Data version": "نسخة البيانات", "Constraint": "القيد", "budget": "ضمن الميزانية", "any price": "بأي سعر", "not played yet": "لم تُلعب بعد", "Each time an optimal XI for the next gameweek is computed with new data, it is recorded here with its time, data version and model version. After the gameweek finishes, \"actual\" adds the real points of those # players plus the captain's (no automatic substitutions). The leak-free Backtest tab is the systematic test": "كل مرة تُحسب فيها التشكيلة المثالية للجولة القادمة ببيانات جديدة، تُسجل هنا مع وقتها ونسخة البيانات والنموذج. بعد نهاية الجولة يجمع \"الفعلي\" النقاط الحقيقية لهؤلاء الـ# لاعب مع الكابتن (بدون تبديلات تلقائية). الاختبار المنهجي في تبويب الاختبار التاريخي", "How the optimal XI and its range are calculated": "كيف تُحسب التشكيلة المثالية ونطاقها", "Player values are the availability-adjusted expected points of the Predicted Points model for GW# (a double gameweek adds both fixtures": "قيمة كل لاعب هي نقاطه المتوقعة بعد احتساب جاهزيته من نموذج النقاط المتوقعة للجولة # (الجولة المزدوجة تجمع المباراتين", "a blank gameweek is #). The XI comes from the exact squad optimizer of the Best Team tab (dynamic programming over the budget with branch and bound for the club limit, # of # players after a lossless dominance prune): it maximises the XI's expected points plus the captain's, subject to a legal #-player squad within the budget. Players marked unavailable or not in a squad are excluded": "والجولة الفارغة = #). التشكيلة من محسّن القائمة الدقيق في تبويب أفضل فريق (برمجة ديناميكية على الميزانية مع تفرّع وتقييد لحد النادي، # من # لاعب بعد تصفية بدون خسارة): يعظّم النقاط المتوقعة للأساسيين مع الكابتن، بشرط قائمة نظامية من # لاعب ضمن الميزانية. اللاعبون غير المتاحين أو خارج القوائم مستبعدون", "The #% range comes from # simulations of the same model (fixed seed, so it does not change between visits): minutes, goals, assists, saves, defensive actions, bonus and cards are drawn per player": "نطاق #% يأتي من # محاكاة لنفس النموذج (بذرة ثابتة فلا يتغير بين الزيارات): الدقائق والأهداف والتمريرات الحاسمة والتصديات والأفعال الدفاعية والبونص والبطاقات تُسحب لكل لاعب", "goals against are drawn once per team and fixture, so team-mates' clean sheets move together. Each team's goals are drawn once per match and shared out to its scorers and assisters, so team-mates' attacking returns move together and against the opposing defence. In the leak-free replay these lineup ranges came out too narrow, so they are widened by a factor of # around the expected total (default fitted on the ## and ## seasons, validated on ## and tested on ##)": "الأهداف المستقبلة تُسحب مرة لكل فريق ومباراة، فالشباك النظيفة لزملاء الفريق تتحرك معاً. وأهداف كل فريق تُسحب مرة لكل مباراة وتُوزّع على المسجلين وصنّاع الأهداف، فالمساهمات الهجومية للزملاء تتحرك معاً وعكس دفاع الخصم. في الإعادة التاريخية طلعت النطاقات أضيق من الواقع، فتُوسّع بمعامل # حول المجموع المتوقع (القيمة الافتراضية مضبوطة على موسمي ## و##، ومتحقق منها على ## ومختبرة على ##)", "goals against are drawn once per team and fixture, so team-mates' clean sheets move together. Each team's goals are drawn once per match and shared out to its scorers and assisters, so team-mates' attacking returns move together and against the opposing defence. In the leak-free replay these lineup ranges came out too narrow, so they are widened by a factor of # around the expected total (refitted on this device in the Backtest tab)": "الأهداف المستقبلة تُسحب مرة لكل فريق ومباراة، فالشباك النظيفة لزملاء الفريق تتحرك معاً. وأهداف كل فريق تُسحب مرة لكل مباراة وتُوزّع على المسجلين وصنّاع الأهداف، فالمساهمات الهجومية للزملاء تتحرك معاً وعكس دفاع الخصم. في الإعادة التاريخية طلعت النطاقات أضيق من الواقع، فتُوسّع بمعامل # حول المجموع المتوقع (أعيد ضبطها على هذا الجهاز في تبويب الاختبار التاريخي)", "the Backtest tab shows the current check. Projections of the very top players have been optimistic (a selection effect: the highest projections include the largest over-estimates), so read the XI total as an upper-leaning estimate": "وتبويب الاختبار التاريخي يعرض الفحص الحالي. توقعات أعلى اللاعبين كانت متفائلة (أثر الاختيار: أعلى التوقعات فيها أكبر المبالغات)، فاعتبر مجموع التشكيلة تقديراً مائلاً للأعلى", "FPL taker order (when the data has it) and PitchAPI shot evidence (penalties taken and scored, direct free-kick shots) are shown for information. PitchAPI shots do not record who took a corner or a free-kick cross, so corner duty is only known from FPL's own taker order. Model v# already counts penalty xG inside FPL xG": "ترتيب المنفذين من FPL (إذا توفر) وأدلة تسديدات PitchAPI (ركلات الجزاء المنفذة والمسجلة، والتسديدات من ركلات حرة مباشرة) معروضة للمعلومية. تسديدات PitchAPI لا تسجل من نفّذ الركنية أو العرضية من ركلة حرة، فمنفذ الركنيات يُعرف فقط من ترتيب FPL. النموذج v# يحسب xG ركلات الجزاء ضمن xG من FPL", "model v# regresses each taker's realised penalty xG toward the league penalty rate (see Backtest). PitchAPI evidence: # penalties in # Premier League matches, # linked to an FPL player by club and name": "والنموذج v# يقرّب xG ركلات الجزاء لكل منفذ من معدل الدوري (انظر الاختبار التاريخي). أدلة PitchAPI: # ركلة جزاء في # مباراة من الدوري الإنجليزي، # منها مربوطة بلاعب FPL بالنادي والاسم", "starting-XI builder": "بنّاء التشكيلة الأساسية", "points are projections": "النقاط توقعات", "a starting XI of # (not a full squad of #)": "تشكيلة أساسية من # (وليست قائمة كاملة من #)", "Start from the optimal XI": "ابدأ من التشكيلة المثالية", "Saved lineups (#)": "التشكيلات المحفوظة (#)", "Lineup name": "اسم التشكيلة", "Players selected (###)": "اللاعبون المختارون (###)", "Expected points GW# incl. captain": "النقاط المتوقعة ج# مع الكابتن", "Expected points GW# (no captain yet)": "النقاط المتوقعة ج# (بدون كابتن بعد)", "partial XI": "تشكيلة ناقصة", "cheapest legal squad £#m": "أرخص قائمة نظامية £#m", "expected # in GW#": "متوقع # في ج#", "Make captain": "اجعله كابتن", "Make vice-captain": "اجعله نائب الكابتن", "# of # starters": "# من # أساسيين", "no duplicates": "بدون تكرار", "every player exists in the FPL data": "كل لاعب موجود في بيانات FPL", "at most # players per club": "بحد أقصى # لاعبين من كل نادٍ", "captain chosen": "تم اختيار الكابتن", "vice-captain chosen": "تم اختيار نائب الكابتن", "fits the budget": "ضمن الميزانية", "XI £#m + cheapest legal bench £#m = £#m ≤ £#m": "الأساسيون £#m + أرخص احتياط نظامي £#m = £#m ≤ £#m", "Add players": "أضف لاعبين", "Tap a player for captain, vice-captain, replace or remove": "اضغط على لاعب لاختياره كابتن أو نائباً أو لاستبداله أو إزالته", "tap an empty place to add a player of that position": "اضغط على مكان فارغ لإضافة لاعب في هذا المركز", "Sorted by expected points in GW#. Players without a projection (no minutes this season) are not listed": "مرتبون حسب النقاط المتوقعة في ج#. اللاعبون بدون توقع (بدون دقائق هذا الموسم) غير معروضين", "Loaded the model's optimal XI for GW#. Change any player to test your own ideas": "تم تحميل التشكيلة المثالية للجولة #. غيّر أي لاعب لتجرب أفكارك", "Computing the optimal XI…": "جارٍ حساب التشكيلة المثالية…", "Cleared": "تم المسح", "The captain cannot also be vice-captain": "الكابتن ما يقدر يكون نائب الكابتن أيضاً", "That lineup is from another season": "هذه التشكيلة من موسم آخر", "Could not save (browser storage blocked)": "تعذر الحفظ (تخزين المتصفح محظور)", "projection reduced for availability": "التوقع مخفّض بسبب الجاهزية", "no legal bench completes this XI into a squad (club limit)": "لا يوجد احتياط نظامي يكمّل هذه التشكيلة لقائمة (حد النادي)", "Fine for a what-if": "مناسب للتجربة", "compare it with the any-price optimum": "قارنها بالمثالية بأي سعر", "My XI vs Optimal XI": "تشكيلتي مقابل التشكيلة المثالية", "projections, not guarantees": "توقعات وليست ضمانات", "both lineups use the same gameweek, predictions and scoring rules": "التشكيلتان بنفس الجولة والتوقعات وقواعد النقاط", "My XI (current builder)": "تشكيلتي (الحالية)", "Optimal XI (within budget)": "التشكيلة المثالية (ضمن الميزانية)", "Optimal XI (any price)": "التشكيلة المثالية (بأي سعر)", "Projected difference (optimal − yours)": "الفرق المتوقع (المثالية − تشكيلتك)", "Chance your XI outscores it (simulated)": "فرصة تفوق تشكيلتك عليها (بالمحاكاة)", "Chance your XI outscores it (#% tie) (simulated)": "فرصة تفوق تشكيلتك عليها (#% تعادل) (بالمحاكاة)", "The difference is the difference of the two totals shown (# − #). #% of simulated outcomes of the difference lie between # and #: the optimal XI has the higher": "الفرق هو الفرق بين المجموعين المعروضين (# − #). #% من نتائج المحاكاة للفرق بين # و#: التشكيلة المثالية لها المجموع", "score, but it can lose in a single gameweek. Players common to both lineups are simulated once and cancel out": "الأعلى، لكنها قد تخسر في جولة واحدة. اللاعبون المشتركون يُحاكون مرة واحدة ويلغون بعض", "Where the +# comes from": "من أين يأتي فرق +#", "Where the # comes from": "من أين يأتي فرق #", "Yours": "تشكيلتك", "Exp": "المتوقع", "Gain": "المكسب", "Main differences (model − yours)": "أهم الفروقات (النموذج − تشكيلتك)", "about equal": "متقاربان", "Both lineups have the same # players": "التشكيلتان فيهما نفس الـ# لاعب", "In both lineups (#)": "في التشكيلتين (#)", "Only in My XI (#)": "في تشكيلتي فقط (#)", "Only in the optimal XI (#)": "في المثالية فقط (#)", "No player in common": "لا يوجد لاعب مشترك", "Tap any name to see why the model rates him as it does": "اضغط على أي اسم لترى لماذا يقيّمه النموذج هكذا", "projections": "توقعات", "uncertainty grows with distance": "عدم اليقين يزيد كلما ابتعدت الجولة", "My XI: expected over # GW (#% range #–#)": "تشكيلتي: المتوقع خلال # جولات (نطاق #%: #–#)", "Optimal XI re-picked each GW (#% range #–#)": "التشكيلة المثالية يُعاد اختيارها كل جولة (نطاق #%: #–#)", "Projected difference over the period": "الفرق المتوقع خلال الفترة", "GW# optimal XI if never changed": "مثالية ج# بدون أي تغيير", "My XI (fixed)": "تشكيلتي (ثابتة)", "Optimal XI, re-picked each GW": "التشكيلة المثالية، يُعاد اختيارها كل جولة", "GW# optimal XI kept fixed": "مثالية ج# بدون تغيير", "shaded = #% range": "المظلل = نطاق #%", "Re-picked": "يُعاد اختيارها", "Fixed opt": "المثالية الثابتة", "Expected points per gameweek (y) by gameweek (x). Hover or tap for values": "النقاط المتوقعة لكل جولة (المحور الرأسي) حسب الجولة (الأفقي). مرّر أو اضغط لترى القيم", "the tables below hold every number": "والجداول أدناه فيها كل الأرقام", "Per gameweek (expected, #% range)": "لكل جولة (المتوقع، نطاق #%)", "Period total": "مجموع الفترة", "Expected points per gameweek": "النقاط المتوقعة لكل جولة", "Chance that My XI outscores the re-picked optimal XI over the period: #% (simulated). Your lineup and captain are held fixed for every gameweek (no transfers or captain changes)": "فرصة تفوق تشكيلتي على المثالية المُعاد اختيارها خلال الفترة: #% (بالمحاكاة). تشكيلتك وكابتنك ثابتان في كل الجولات (بدون انتقالات أو تغيير كابتن)", "the re-picked optimum is a ceiling that assumes unlimited free changes, and the fixed GW# optimum is the like-for-like reference for an unchanged lineup. Period ranges are percentiles of the simulated": "المثالية المُعاد اختيارها سقف يفترض تغييرات مجانية بلا حد، ومثالية ج# الثابتة هي المقارنة العادلة لتشكيلة بدون تغيير. نطاقات الفترة مئينات", "over all # gameweeks, not # single-week ranges added up. Later gameweeks are less certain: injury news and FPL's chance of playing only exist for the next gameweek (carried forward unchanged), and fixtures can still move": "المجموع المُحاكى لكل الـ# جولات، وليست # نطاقات أسبوعية مجموعة. الجولات البعيدة أقل يقيناً: أخبار الإصابات واحتمال المشاركة من FPL متوفرة للجولة القادمة فقط (تُنقل كما هي)، والمباريات قد تتأجل", "Blank/double gameweeks for these players": "جولات فارغة/مزدوجة لهؤلاء اللاعبين", "Any status": "أي حالة", "Doubtful or out": "مشكوك فيه أو غائب", "Points per game": "النقاط لكل مباراة", "Points per £m": "النقاط لكل £m", "Ownership %": "نسبة الامتلاك %", "Points per #": "النقاط لكل #", "xG (FPL)": "xG (FPL)", "xGI per # (FPL)": "xGI لكل # (FPL)", "xGI per £m": "xGI لكل £m", "ICT index": "مؤشر ICT", "Influence": "التأثير", "Creativity": "الإبداع", "Threat": "الخطورة", "Price change since start (£m)": "تغير السعر منذ البداية (£m)", "Transfers in (this GW)": "الانتقالات للداخل (هذه الجولة)", "Transfers out (this GW)": "الانتقالات للخارج (هذه الجولة)", "xT per # (PitchAPI)": "xT لكل # (PitchAPI)", "xG per # (PitchAPI)": "xG لكل # (PitchAPI)", "xT per #*": "xT لكل #*", "xG per #*": "xG لكل #*", "* PitchAPI values per # minutes": "* قيم PitchAPI لكل # دقيقة", "# of # players (first #). Tap a column to sort": "# من # لاعب (أول #). اضغط على عمود للترتيب", "Any availability": "أي جاهزية", "Available only": "المتاحون فقط", "Doubtful, injured or suspended": "مشكوك فيه أو مصاب أو موقوف", "Any data quality": "أي جودة بيانات", "Higher only": "الأعلى فقط", "Medium or higher": "متوسطة أو أعلى", "include players without data": "اعرض اللاعبين بدون بيانات", "Σ# GW": "مجموع # جولات", "Avg / GW": "المعدل / جولة", "Pts/£m": "نقاط/£m", "Showing the first #": "يُعرض أول #", "Predicted points are model estimates": "النقاط المتوقعة تقديرات من النموذج", "for the next # gameweeks. They are not historical points:": "للجولات الـ# القادمة. وليست نقاطاً تاريخية:", "actual season points": "نقاط الموسم الفعلية", "appear only in the details panel and the Table tab. Estimates are expected values (probability-weighted), so a player who may miss a match carries a fraction of the points he would score if fit": "تظهر فقط في لوحة التفاصيل وتبويب الجدول. التقديرات قيم متوقعة (موزونة بالاحتمال)، فاللاعب اللي قد يغيب يحمل جزءاً من النقاط اللي كان بيسجلها لو كان جاهزاً", "# players. Tap a column to sort, tap a name for the factors behind the prediction. Value = predicted points ÷ price in £m": "# لاعب. اضغط على عمود للترتيب، وعلى اسم لأسباب التوقع. القيمة = النقاط المتوقعة ÷ السعر بالمليون", "(FPL status, updated at each synchronization": "(حالة FPL، تتحدث مع كل مزامنة", "kept separate from ability)": "ومنفصلة عن مستوى اللاعب)", "Actual season points (history)": "نقاط الموسم الفعلية (التاريخ)", "Predicted, next # GW (availability-adjusted)": "المتوقع، الـ# جولات القادمة (بعد الجاهزية)", "Predicted if fully fit": "المتوقع لو جاهز تماماً", "Data quality": "جودة البيانات", "Fit prob": "احتمال الجاهزية", "Appear": "المشاركة", "If fit": "لو جاهز", "Strengths": "نقاط القوة", "Weaknesses": "نقاط الضعف", "none notable": "لا شيء لافت", "xG per # # vs # for the position": "xG لكل # # مقابل # لمعدل المركز", "xA per # # vs #": "xA لكل # # مقابل #", "finishing ratio (goals+#)/(xG+#) = #": "نسبة الإنهاء (الأهداف+#)/(xG+#) = #", "regular starter: #% of appearances at #+ minutes": "أساسي منتظم: #% من مشاركاته #+ دقيقة", "Uncertainty": "عدم اليقين", "How predictions are calculated, scoring rules and data limits": "كيف تُحسب التوقعات، وقواعد النقاط، وحدود البيانات", "Each fixture is predicted separately:": "كل مباراة تُتوقع على حدة:", "expected points = Σ over scoring categories of (expected events × points per event)": "النقاط المتوقعة = مجموع (الأحداث المتوقعة × نقاط كل حدث) لكل فئات النقاط", "Scoring rules": "قواعد النقاط", "(points": "(النقاط", "Category": "الفئة", "Appearance": "المشاركة", "Goals conceded": "الأهداف المستقبلة", "Defensive contribution": "المساهمة الدفاعية", "# (default)": "# (افتراضي)", "# per # (default)": "# لكل # (افتراضي)", "Yellow card": "بطاقة صفراء", "Red card": "بطاقة حمراء", "Own goal": "هدف عكسي", "Penalty missed": "ركلة جزاء ضائعة", "Penalty saved": "ركلة جزاء متصدى لها", "Limits:": "الحدود:", "= #+ minutes and available;": "= #+ دقيقة ومتاح؛", "= #–# minutes, doubtful with a published chance, or under # recent matches;": "= #–# دقيقة، أو مشكوك فيه مع احتمال منشور، أو أقل من # مباريات حديثة؛", "= under # minutes, or unavailable without a return date. These are data-sufficiency labels, not accuracy percentages": "= أقل من # دقيقة، أو غير متاح بدون موعد عودة. هذه تسميات لكفاية البيانات وليست نسب دقة", "the model has not been backtested here": "النموذج لم يُختبر تاريخياً هنا", "\"(default)\" = this rule was not observed in the live data, so the published FPL value is used": "\"(افتراضي)\" = هذه القاعدة لم تظهر في البيانات المباشرة، فتُستخدم القيمة المنشورة من FPL", "the rest were derived from gameweek # live data):": "والباقي مستخرج من بيانات الجولة # المباشرة):", "a blank gameweek is # because there is no match": "والجولة الفارغة = # لعدم وجود مباراة", "Predictions need game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.": "التوقعات تحتاج قوانين اللعبة ونتائج ومواعيد المباريات اللي تجلبها المزامنة القادمة. اضغط \"زامن الآن\" في الإعدادات مرة، ثم افتح هذا التبويب.", "No upcoming gameweek found in the data.": "لا توجد جولة قادمة في البيانات.", "No upcoming gameweek found.": "لا توجد جولة قادمة.", "No upcoming gameweek with fixtures was found in the data.": "لا توجد جولة قادمة فيها مباريات في البيانات.", "Best team for the next gameweek (GW#)": "أفضل فريق للجولة القادمة (ج#)", "Best squad for the next # gameweeks": "أفضل قائمة للجولات الـ# القادمة", "Formation chosen": "الخطة المختارة", "Budget remaining": "المتبقي من الميزانية", "Predicted points, starting XI incl. captain, GW#": "النقاط المتوقعة للأساسيين مع الكابتن، ج#", "Predicted, whole squad (bench included, no captain bonus)": "المتوقع للقائمة كاملة (مع الاحتياط، بدون مضاعفة الكابتن)", "Bench (in order": "الاحتياط (بالترتيب", "goalkeeper first)": "الحارس أولاً)", "Bench": "الاحتياط", "Predicted XI + captain": "المتوقع للأساسيين + الكابتن", "Availability changed the selection": "الجاهزية غيّرت الاختيار", "Availability did not change the selection: the same 15 players are optimal with and without the injury adjustment": "الجاهزية ما غيّرت الاختيار: نفس الـ15 لاعب هم الأفضل مع احتساب الإصابات وبدونها", "Rule checks (computed on this team)": "فحص القوانين (محسوب على هذا الفريق)", "Cost £#m of £#m budget": "التكلفة £#m من ميزانية £#m", "At most # from one club (limit #": "بحد أقصى # من نادٍ واحد (الحد #", "Captain and vice-captain are starters": "الكابتن والنائب من الأساسيين", "bench of #": "احتياط من #", "Squad of #: # GKP, # DEF, # MID, # FWD": "قائمة من #: # حارس، # مدافع، # وسط، # مهاجم", "Legal formation ### (# starters, source: game settings)": "خطة نظامية ### (# أساسيين، المصدر: إعدادات اللعبة)", "Squad value (period = GW#)": "قيمة القائمة (الفترة = ج#)", "Role": "الدور", "Predicted GW#": "المتوقع ج#", "Pts/£m (GW#)": "نقاط/£m (ج#)", "captain": "كابتن", "vice": "نائب", "XI": "أساسي", "Formation comparison (each is the exact optimum for that formation)": "مقارنة الخطط (كل واحدة الأفضل بدقة لخطتها)", "### is chosen because its best valid team has the highest predicted total": "اختيرت ### لأن أفضل فريق نظامي فيها له أعلى مجموع متوقع", "the next best, ###, is # points lower. The objective is total expected points within the budget and rules, not points per £": "والتالية، ###، أقل بـ# نقطة. الهدف هو مجموع النقاط المتوقعة ضمن الميزانية والقوانين، وليس النقاط لكل جنيه", "Optimization: exact for the candidate pool (# of # players after a lossless dominance prune), using dynamic programming over the budget with branch and bound for the club limit. Bench order breaks ties among equal-value squads (weight #)": "التحسين: دقيق لمجموعة المرشحين (# من # لاعب بعد تصفية بدون خسارة)، ببرمجة ديناميكية على الميزانية مع تفرّع وتقييد لحد النادي. ترتيب الاحتياط يفصل بين القوائم المتساوية (وزن #)", "FPL automatic substitutions are not simulated": "التبديلات التلقائية في FPL غير محاكاة", "Optimizing every legal formation": "جارٍ تحسين كل الخطط النظامية", "Optimizing every legal formation…": "جارٍ تحسين كل الخطط النظامية…", "within the budget (a few seconds)…": "ضمن الميزانية (ثوانٍ قليلة)…", "No valid team exists under the rules with the players that have data.": "لا يوجد فريق نظامي باللاعبين اللي لهم بيانات.", "No valid squad exists under the rules with the players that have data.": "لا توجد قائمة نظامية باللاعبين اللي لهم بيانات.", "The team builder needs game rules, fixture results and kickoff times that the next synchronization downloads. Press Synchronize in Settings once, then reopen this tab.": "بنّاء الفريق يحتاج قوانين اللعبة ونتائج ومواعيد المباريات اللي تجلبها المزامنة القادمة. اضغط \"زامن الآن\" في الإعدادات مرة، ثم افتح هذا التبويب.", "Price vs points": "السعر مقابل النقاط", "Price vs value": "السعر مقابل القيمة", "Ownership vs points": "الامتلاك مقابل النقاط", "xGI vs points": "xGI مقابل النقاط", "Price vs xGI/#": "السعر مقابل xGI/#", "Price vs xT (PitchAPI)": "السعر مقابل xT (PitchAPI)", "# of # players have a value for both metrics. Colours:": "# من # لاعب لهم قيمة في المقياسين. الألوان:", "The # best on both axes are named": "تظهر أسماء أفضل # على المحورين", "Tap a dot for details": "اضغط على نقطة للتفاصيل", "Not enough players with a value for both metrics.": "لا يوجد لاعبون كافون لهم قيمة في المقياسين.", "Biggest price rises since the start of the season (£m)": "أكبر ارتفاع في السعر منذ بداية الموسم (£m)", "Biggest price falls (£m)": "أكبر انخفاض في السعر (£m)", "No price changes yet.": "لا توجد تغييرات في الأسعار بعد.", "No players match.": "لا يوجد لاعبون مطابقون.", "Search a player to add (max #)": "ابحث عن لاعب لإضافته (بحد أقصى #)", "Search above, or press + next to a player in the Table tab. Selected players are compared on every metric, price over time and points per gameweek": "ابحث بالأعلى، أو اضغط + بجانب لاعب في تبويب الجدول. اللاعبون المختارون يُقارنون في كل مقياس، والسعر عبر الوقت، والنقاط لكل جولة", "Already in the comparison": "موجود في المقارنة أصلاً", "Maximum of # players. Remove one first": "الحد الأقصى # لاعبين. احذف واحداً أولاً", "Average price of regular players (£m)": "متوسط سعر اللاعبين المنتظمين (£m)", "Points per £m, regular players": "النقاط لكل £m، اللاعبون المنتظمون", "Avg £m": "متوسط £m", "Regular players = at least # minutes. Totals add the values the source gave": "اللاعبون المنتظمون = # دقيقة على الأقل. المجاميع تجمع قيم المصدر", "they include players who have since left": "وتشمل لاعبين غادروا بعدها", "Next # gameweeks, easiest run first. Difficulty is the official FPL rating from # (easiest) to #. Capital letters = home": "الجولات الـ# القادمة، الأسهل أولاً. الصعوبة تقييم FPL الرسمي من # (الأسهل) إلى #. الحروف الكبيرة = على أرضه", "Price (£m) after each match": "السعر (£m) بعد كل مباراة", "Points per gameweek": "النقاط لكل جولة", "Cumulative points": "النقاط التراكمية", "What this tests": "ماذا يختبر", "earlier": "سابقة", "v# = the model used in Predicted Points": "v# = النموذج المستخدم في النقاط المتوقعة", "unchanged": "بدون تغيير", "Small sample:": "عينة صغيرة:", "Player-gameweeks tested": "عدد (لاعب × جولة) المختبرة", "Different players": "لاعبون مختلفون", "Data version (UTC)": "نسخة البيانات (UTC)", "Points accuracy (lower error is better)": "دقة النقاط (الخطأ الأقل أفضل)", "Bias (pred − actual)": "الانحياز (المتوقع − الفعلي)", "Model MAE gain": "تحسن MAE للنموذج", "By position": "حسب المركز", "Bias": "الانحياز", "By gameweek": "حسب الجولة", "MAE model": "MAE النموذج", "MAE last#": "MAE آخر #", "MAE season": "MAE الموسم", "RMSE model": "RMSE النموذج", "RMSE last#": "RMSE آخر #", "Season average": "معدل الموسم", "Season avg": "معدل الموسم", "Last#": "آخر #", "Last# average": "معدل آخر #", "Minutes and playing probability": "الدقائق واحتمال المشاركة", "Minutes MAE": "MAE الدقائق", "Brier score (P(play))": "درجة Brier (احتمال المشاركة)", "Constant (overall rate #%)": "ثابت (المعدل العام #%)", "Predicted chance": "الاحتمال المتوقع", "Average predicted": "متوسط المتوقع", "Played": "شارك", "Captain picks": "اختيارات الكابتن", "Mean points of the pick": "متوسط نقاط الاختيار", "Mean regret vs best player": "متوسط الفارق عن أفضل لاعب", "Pick in the actual top #": "الاختيار ضمن أفضل # فعلياً", "Hindsight best player": "أفضل لاعب بأثر رجعي", "Model pick": "اختيار النموذج", "Last# pick": "اختيار آخر #", "Best in pool": "الأفضل في المجموعة", "Team selection test": "اختبار اختيار الفريق", "Model team, mean points per GW": "فريق النموذج، متوسط النقاط لكل جولة", "Last# average team": "فريق معدل آخر #", "Hindsight ceiling": "السقف بأثر رجعي", "GWs where the model team beat last#": "جولات تفوق فيها فريق النموذج على آخر #", "Hindsight": "بأثر رجعي", "Model formation": "خطة النموذج", "Run team selection test": "شغّل اختبار اختيار الفريق", "Run calibration and penalty-regression comparison": "شغّل المعايرة ومقارنة ضبط ركلات الجزاء", "Not tested here": "لم يُختبر هنا", "Injuries, suspensions and news": "الإصابات والإيقافات والأخبار", "Replaying gameweeks…": "جارٍ إعادة الجولات…", "only # gameweeks. Treat every number below as provisional": "# جولات فقط. اعتبر كل رقم أدناه مبدئياً", "it becomes meaningful as the season grows": "ويصير له معنى مع تقدم الموسم", "MAE per gameweek (lower is better) (gameweek on the x axis)": "MAE لكل جولة (الأقل أفضل) (الجولة على المحور الأفقي)", "Colour order: model, last#, season average": "ترتيب الألوان: النموذج، آخر #، معدل الموسم", "vs last# average: the model had the lower average error in": "مقابل معدل آخر #: النموذج كان أقل خطأً في", "vs season average: the model had the lower average error in": "مقابل معدل الموسم: النموذج كان أقل خطأً في", "Every finished gameweek is replayed as if it had not been played: the model sees only matches from": "كل جولة منتهية تُعاد كأنها ما لُعبت: النموذج يرى فقط مباريات الجولات", "Points range calibration and model v# (penalty regression)": "معايرة نطاق النقاط والنموذج v# (ضبط ركلات الجزاء)", "Lineup ranges (# players + captain)": "نطاقات التشكيلة (# لاعب + الكابتن)", "Model v# vs v#": "النموذج v# مقابل v#", "Check": "الفحص", "Model says": "حسب النموذج", "A backtest needs at least 2 finished gameweeks (one to learn from, one to predict).": "الاختبار التاريخي يحتاج جولتين منتهيتين على الأقل (واحدة للتعلم وواحدة للتوقع).", "No player-gameweeks in this range.": "لا توجد بيانات في هذا النطاق.", "No minutes data.": "لا توجد بيانات دقائق.", "Not enough players in the pool to test captain picks yet.": "لا يوجد لاعبون كافون لاختبار اختيارات الكابتن بعد.", "No gameweek produced a valid team for all three methods.": "لا توجد جولة أعطت فريقاً نظامياً للطرق الثلاث.", "Rule violations found by the validator in the # teams: #": "مخالفات القوانين في الـ# فريق: #", "Synchronize": "المزامنة", "Synchronize now": "زامن الآن", "Reload data": "إعادة تحميل البيانات", "owner/repo": "المالك/المستودع", "GitHub token (kept on this device only)": "توكن GitHub (يُحفظ على هذا الجهاز فقط)", "One press fetches every new match from PitchAPI, retries recent matches whose analytics were incomplete, and then refreshes this site by itself when the new data is published. It also runs automatically on a schedule": "ضغطة واحدة تجلب كل مباراة جديدة من PitchAPI، وتعيد محاولة المباريات الحديثة الناقصة، ثم تحدّث الموقع لوحده لما تُنشر البيانات. وتشتغل تلقائياً حسب الجدول أيضاً", "Create a fine-grained token for this repository only, with the permission Actions": "أنشئ توكن fine-grained لهذا المستودع فقط، بصلاحية Actions", "Read and write. It is stored in this browser and only sent to GitHub": "Read and write. يُحفظ في هذا المتصفح ويُرسل لـ GitHub فقط", "No data yet. Press Synchronize in Settings to update the data.": "لا توجد بيانات بعد. اضغط \"زامن الآن\" في الإعدادات لتحديثها.", "No data yet. The first sync is running in the background, reload this page in a few minutes.": "لا توجد بيانات بعد. أول مزامنة تشتغل بالخلفية، أعد تحميل الصفحة بعد دقائق.", "No player statistics for this competition yet. They appear after the next synchronization.": "لا توجد إحصائيات لاعبين لهذه المسابقة بعد. تظهر بعد المزامنة القادمة.", "No Fantasy data yet. It is fetched from the official Fantasy Premier League API during the next synchronization (at most once an hour). Press Synchronize in Settings.": "لا توجد بيانات فانتازي بعد. تُجلب من FPL الرسمي في المزامنة القادمة (مرة كل ساعة كحد أقصى). اضغط \"زامن الآن\" في الإعدادات.", "No values to draw.": "لا توجد قيم للرسم.", "No player matches this search and minutes filter.": "لا يوجد لاعب يطابق البحث وحد الدقائق.", "#% chance of playing": "احتمال المشاركة #%", "Expected back # Jan": "يُتوقع عودته # يناير", "Expected back # Feb": "يُتوقع عودته # فبراير", "Expected back # Mar": "يُتوقع عودته # مارس", "Expected back # Apr": "يُتوقع عودته # أبريل", "Expected back # May": "يُتوقع عودته # مايو", "Expected back # Jun": "يُتوقع عودته # يونيو", "Expected back # Jul": "يُتوقع عودته # يوليو", "Expected back # Aug": "يُتوقع عودته # أغسطس", "Expected back # Sep": "يُتوقع عودته # سبتمبر", "Expected back # Oct": "يُتوقع عودته # أكتوبر", "Expected back # Nov": "يُتوقع عودته # نوفمبر", "Expected back # Dec": "يُتوقع عودته # ديسمبر", "Unknown return date": "موعد العودة غير معروف", "xG": "xG", "xT": "xT", "npxG": "npxG", "xA": "xA", "xAG": "xAG", "xGI": "xGI", "VAEP": "VAEP", "PPDA": "PPDA", "xGOT": "xGOT", "PL Analytics": "PL Analytics", "Premier League": "الدوري الإنجليزي", "FPL data has no shots or shots-on-target per player and no opponent shot counts, so xG/xA and team xG (from per-match player xG) are used instead": "بيانات FPL ما فيها تسديدات اللاعبين ولا تسديدات الخصم، فنستخدم xG وxA وxG الفريق (من xG اللاعبين في كل مباراة) بدلها", "PitchAPI shots are not used in the model. Defensive-contribution counts are modelled as Poisson from season totals. Injury data is FPL's own status, news text and published chance of playing (next gameweek only)": "تسديدات PitchAPI غير مستخدمة في النموذج. المساهمة الدفاعية تُنمذج بتوزيع بواسون من مجاميع الموسم. بيانات الإصابات من FPL نفسه: الحالة ونص الخبر واحتمال المشاركة المنشور (للجولة القادمة فقط)", "a return date is used only when the news text states one. Beyond the next gameweek a published chance is carried forward unchanged, and a player with no chance or date published is treated as unavailable. Data quality:": "موعد العودة يُستخدم فقط إذا ذكره نص الخبر. بعد الجولة القادمة يُنقل الاحتمال المنشور كما هو، واللاعب بدون احتمال أو موعد منشور يُعتبر غير متاح. جودة البيانات:", "pick a player and the stat groups you care about. Every stat is turned into a score relative to the other players in the pool (same position by default, goalkeepers excluded). Match % = # ÷ (# + average gap in standard deviations), so #% means about one SD apart on average. It compares playing": "اختر لاعباً ومجموعات الإحصائيات اللي تهمك. كل إحصائية تتحول لدرجة نسبةً لباقي اللاعبين في المجموعة (نفس المركز افتراضياً، بدون الحراس). نسبة التشابه = # ÷ (# + متوسط الفرق بالانحراف المعياري)، فـ#% تعني فرقاً بحدود انحراف معياري واحد في المتوسط. تقارن أسلوب", "Rates used (per #, shrunk toward the position average): goals #, assists #, defensive contribution #, bonus #. Playing time: last # matches": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، مساهمة دفاعية #، بونص #. وقت اللعب: آخر # مباريات", "Rates used (per #, shrunk toward the position average): goals #, assists #, saves #, bonus #. Playing time: last # matches": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، تصديات #، بونص #. وقت اللعب: آخر # مباريات", "Rates used (per #, shrunk toward the position average): goals #, assists #, bonus #. Playing time: last # matches": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، بونص #. وقت اللعب: آخر # مباريات", "Rates used (per #, shrunk toward the position average): goals #, assists #, defensive contribution #, bonus #. Playing time: recent appearances while fit": "المعدلات المستخدمة (لكل #، مقرّبة من معدل المركز): أهداف #، تمريرات حاسمة #، مساهمة دفاعية #، بونص #. وقت اللعب: المشاركات الأخيرة وهو جاهز", "plays) #%, # min when playing": "يشارك) #%، # دقيقة عند المشاركة", "plays) #%, # min when playing. PitchAPI cross-check (not used in the prediction): xG/# #, xT/# #": "يشارك) #%، # دقيقة عند المشاركة. مقارنة PitchAPI (غير مستخدمة في التوقع): xG/# #، xT/# #", "gameweeks (player totals, team strengths, league averages and position priors are all rebuilt from those rows), then its prediction is compared with the points the player actually scored. Baselines: the player's average points per match over his last # matches, and over the season so far, multiplied by his number of fixtures. Model tested:": "السابقة (مجاميع اللاعبين وقوة الفرق ومعدلات الدوري والمراكز كلها تُبنى من جديد من تلك الصفوف)، ثم يُقارن توقعه بالنقاط اللي سجلها اللاعب فعلاً. المقارنات: معدل نقاط اللاعب في آخر # مباريات، وفي الموسم حتى تلك الجولة، مضروباً في عدد مبارياته. النموذج المختبر:", "Not in the sample: # player-gameweeks where the model had no estimate (no earlier minutes) and # where no matching fixture was found. Players with no minutes all season are not in the stored history": "خارج العينة: # (لاعب × جولة) بدون تقدير من النموذج (بدون دقائق سابقة) و# بدون مباراة مطابقة. اللاعبون بدون دقائق طوال الموسم ليسوا في السجل المحفوظ", "MAE = mean absolute error, RMSE = root mean squared error (punishes big misses), both in FPL points per player-gameweek. A positive \"gain\" means the model's average error is smaller than the baseline's. Errors are large for every method because single-match points are very noisy": "MAE = متوسط الخطأ المطلق، RMSE = جذر متوسط مربع الخطأ (يعاقب الأخطاء الكبيرة)، وكلاهما بنقاط FPL لكل (لاعب × جولة). \"التحسن\" الموجب يعني أن خطأ النموذج أقل من المقارنة. الأخطاء كبيرة لكل الطرق لأن نقاط المباراة الواحدة متقلبة جداً", "Minutes MAE: average gap between expected and actual minutes in the gameweek. Brier score: mean squared gap between the predicted probability of playing at all and what happened (# = perfect": "MAE الدقائق: متوسط الفرق بين الدقائق المتوقعة والفعلية في الجولة. درجة Brier: متوسط مربع الفرق بين احتمال المشاركة المتوقع وما حدث (# = مثالي", "lower is better). Calibration: among players given about X% chance to play, how many played": "والأقل أفضل). المعايرة: من اللاعبين اللي أُعطوا احتمال مشاركة بحدود X%، كم واحد شارك فعلاً", "Pool: players with at least # minutes before that gameweek (at least # such players). Points are single (not doubled). The model is also compared with the last# pick gameweek by gameweek below": "المجموعة: لاعبون لهم # دقيقة على الأقل قبل تلك الجولة (# لاعب على الأقل). النقاط مفردة (بدون مضاعفة). ويُقارن النموذج باختيار آخر # جولة بجولة بالأسفل", "Each gameweek the real Best Team optimizer (budget, #-per-club rule, legal formations, captain) builds a team from scratch, once valuing players by the model and once by the last# average. \"Hindsight\" values players by the points they actually scored: an unreachable ceiling that shows how much is left. Team points = starting XI + captain bonus": "في كل جولة يبني محسّن أفضل فريق الحقيقي (الميزانية، قاعدة # من كل نادٍ، الخطط النظامية، الكابتن) فريقاً من الصفر، مرة بتقييم النموذج ومرة بمعدل آخر #. \"بأثر رجعي\" يقيّم اللاعبين بالنقاط اللي سجلوها فعلاً: سقف مستحيل يوضح كم بقي للتحسين. نقاط الفريق = الأساسيون + مضاعفة الكابتن", "the bench and automatic substitutions are not counted. The price used is the one recorded for that gameweek": "ولا يُحسب الاحتياط ولا التبديلات التلقائية. السعر المستخدم هو المسجل في تلك الجولة", "Checks the #% ranges shown in Optimal XI, My XI and Forecast: in the same leak-free replay, how often did a player's actual points fall below the #th or above the #th percentile of his simulated distribution? Also replays model v#, which regresses penalty xG (PitchAPI shots), and compares it with v# on the same player-gameweeks": "يفحص نطاقات #% المعروضة في التشكيلة المثالية وتشكيلتي والتوقعات: في نفس الإعادة التاريخية بدون تسريب، كم مرة جاءت نقاط اللاعب الفعلية تحت المئين # أو فوق المئين # من توزيعه المُحاكى؟ ويعيد أيضاً تشغيل النموذج v# اللي يضبط xG ركلات الجزاء (تسديدات PitchAPI) ويقارنه بـ v# على نفس البيانات", "Could not read sync status (Repository \"#/index.html\" was not found (HTTP #). Check the owner/repo field above. If the repository is private, the token must have access to it.)": "تعذرت قراءة حالة المزامنة (المستودع \"#/index.html\" غير موجود (HTTP #). تأكد من خانة المالك/المستودع بالأعلى. إذا المستودع خاص، لازم يكون للتوكن صلاحية عليه.)", "Real totals inside the unwidened #% range": "المجاميع الفعلية داخل نطاق #% قبل التوسيع", "Spread of real totals vs simulated (sd of z; # = calibrated)": "انتشار المجاميع الفعلية مقابل المُحاكاة (انحراف z؛ # = معايَر)", "Inside the #% range after widening by that factor (same data)": "داخل نطاق #% بعد التوسيع بهذا المعامل (نفس البيانات)", "Calibration slope of actual on predicted points (# = calibrated": "ميل المعايرة للنقاط الفعلية على المتوقعة (# = معايَر", "below # = too spread out)": "أقل من # = متباعدة أكثر من اللازم)", "Actual below the #th percentile": "الفعلي تحت المئين #", "Actual above the #th percentile": "الفعلي فوق المئين #", "Mean points per player-gameweek": "متوسط النقاط لكل (لاعب × جولة)", "Optimal XI projected": "توقع التشكيلة المثالية", "Simulated #% range": "نطاق #% المُحاكى", "Below P#: actual": "تحت P#: الفعلي", "Above P#: actual": "فوق P#: الفعلي", "model": "النموذج", "All player-gameweeks": "كل (لاعب × جولة)", "Only where v# changes the prediction (penalty takers)": "فقط حيث يغيّر v# التوقع (منفذو ركلات الجزاء)", "MAE v#": "MAE v#", "expected (#% range #–#)": "متوقع (نطاق #%: #–#)", "mean MAE gain # points ± # (#% interval across gameweeks)": "متوسط تحسن MAE # نقطة ± # (فترة #% عبر الجولات)", "Expected events come from per# rates shrunk toward the position average (pseudo-evidence of # minutes), scaled by expected minutes, and adjusted for the opponent. Goals use xG once (no separate shot-conversion term), multiplied by a finishing ratio (goals+#)/(xG+#). Opponent effect for attackers = the opponent's xG conceded per match relative to the league (team strengths shrunk with # pseudo-matches), with a home/away league average. Clean sheets use a Poisson goal model": "الأحداث المتوقعة من معدلات لكل # مقرّبة من معدل المركز (ما يعادل # دقيقة إضافية)، مضروبة في الدقائق المتوقعة ومعدّلة حسب الخصم. الأهداف تستخدم xG مرة واحدة (بدون عامل تحويل منفصل)، مضروبة في نسبة الإنهاء (الأهداف+#)/(xG+#). أثر الخصم على المهاجمين = xG اللي يستقبله الخصم في المباراة نسبةً للدوري (قوة الفرق مقرّبة بـ# مباريات افتراضية)، مع معدل الأرض/الخارج. الشباك النظيفة بنموذج بواسون للأهداف", "P(# goals) with the opponent's expected xG, calibrated by league goals ÷ xG (#, from # matches). Saves, goals-conceded deductions and defensive-contribution points are expectations of stepwise rules under Poisson counts. A double gameweek adds both fixtures": "احتمال (# أهداف) حسب xG المتوقع للخصم، معايَر بنسبة أهداف الدوري ÷ xG (#، من # مباراة). التصديات وخصم الأهداف المستقبلة ونقاط المساهمة الدفاعية توقعات لقواعد متدرجة بتوزيع بواسون. الجولة المزدوجة تجمع المباراتين", "On target is PitchAPI's flag (also true for blocked shots heading on target). Conversion divides goals by all shots, blocked ones included. Goals − xG uses only shots that have an xG. Average distance is computed here from the shot coordinates. # own goal(s) excluded. Left/right: the team's left flank is at the top": "\"على المرمى\" حسب علامة PitchAPI (تشمل التسديدات المصدودة المتجهة للمرمى). التحويل = الأهداف ÷ كل التسديدات بما فيها المصدودة. الأهداف − xG تستخدم فقط التسديدات اللي لها xG. متوسط المسافة محسوب هنا من إحداثيات التسديد. استُبعد # هدف عكسي. يسار/يمين: الجهة اليسرى للفريق في الأعلى", "Node position = average origin of that player's completed passes in the window (not their average position). Left/right: the team's left flank is at the top when it attacks to the right (untick \"Flip left/right\" if a player you know looks mirrored). Node size = passes played. Line width is proportional to the passes between the two players (thickest drawn: #)": "موقع اللاعب = متوسط مكان تمريراته الناجحة في النافذة (وليس متوسط مركزه). يسار/يمين: الجهة اليسرى للفريق في الأعلى لما يهاجم لليمين (ألغِ \"اقلب يسار/يمين\" إذا ظهر لاعب تعرفه معكوساً). حجم الدائرة = عدد التمريرات. سُمك الخط حسب عدد التمريرات بين اللاعبين (الأسمك: #)", "aerial win % uses aerials won ÷ aerials contested. \"Ground duels won\" = duels won − aerial duels won (derived). Pressing is reported per": "نسبة الفوز الهوائي = الهوائية المكسوبة ÷ الهوائية. \"الالتحامات الأرضية المكسوبة\" = الالتحامات المكسوبة − الهوائية المكسوبة (مشتقة). الضغط يُرسل لكل", "# of # cells active. Attacking frame (acting_ltr): cell # = own goal line, cell # = opponent's, so this team attacks to the right": "# من # خلية فيها نشاط. إطار الهجوم (acting_ltr): الخلية # = خط مرمى الفريق، والخلية # = مرمى الخصم، فهذا الفريق يهاجم لليمين", "empty cells had no recorded action. Raw match totals, not per#, so a substitute looks thinner because of minutes. Left/right: the team's left flank is at the top when it attacks to the right": "الخلايا الفارغة بدون أي فعل مسجل. مجاميع خام للمباراة وليست لكل #، فالبديل يبدو أخف بسبب دقائقه. يسار/يمين: الجهة اليسرى للفريق في الأعلى لما يهاجم لليمين", "PitchAPI does not document which touchline is y=#, so untick \"Flip left/right\" if a player you know looks mirrored": "PitchAPI لا يوضح أي خط تماس هو y=#، فألغِ \"اقلب يسار/يمين\" إذا ظهر لاعب تعرفه معكوساً", "FPL keeps no historical record of them, so every player is treated as available in the replay (the live model does adjust for them). Transfers, chips and price changes are not tested. Scoring rules are assumed constant through the season. A player who changed club is placed in his real club for the gameweek being predicted, but his earlier matches count toward his current club's data. The replay uses FPL fields only (xG, xA, minutes, bonus and the other history columns)": "FPL لا يحفظ سجلاً تاريخياً لها، فكل لاعب يُعتبر متاحاً في الإعادة (النموذج المباشر يأخذها بالحسبان). الانتقالات والشرائح وتغير الأسعار غير مختبرة. قواعد النقاط يُفترض أنها ثابتة طوال الموسم. اللاعب اللي غيّر ناديه يوضع في ناديه الفعلي للجولة المتوقعة، لكن مبارياته السابقة تُحسب لبيانات ناديه الحالي. الإعادة تستخدم حقول FPL فقط (xG وxA والدقائق والبونص وباقي أعمدة السجل)", "PitchAPI data is not used. No model version other than v# exists yet, and the model has not been tuned on these results, so nothing here is an in-sample fit": "وبيانات PitchAPI غير مستخدمة. النموذج v# ما عُدّل بناءً على هذه النتائج، فلا شيء هنا ملائمة على نفس العينة", "Players selected": "اللاعبون المختارون", "Fixed opt.": "المثالية الثابتة", "Current season": "الموسم الحالي", "Season #/#": "موسم #/#", "Season": "الموسم", "## archive": "أرشيف ##", "Archived season #/#: official FPL data per player and gameweek from the public vaastav/Fantasy-Premier-League archive (prices, status and totals as at the end of that season). The season's scoring rules reproduce FPL's own points for #% of # player-gameweeks. The Backtest tab replays the whole season with today's model, using only earlier gameweeks for each prediction. The Optimal XI, My XI, Forecast and prediction tabs belong to the current season": "موسم مؤرشف #/#: بيانات FPL الرسمية لكل لاعب في كل جولة من الأرشيف العام vaastav/Fantasy-Premier-League (الأسعار والحالة والمجاميع كما كانت في نهاية الموسم). قوانين نقاط ذاك الموسم تعيد حساب نقاط FPL نفسها في #% من # (لاعب × جولة). تبويب الاختبار التاريخي يعيد الموسم كاملاً بموديل اليوم، وكل توقع يستخدم الجولات السابقة فقط. تبويبات التشكيلة المثالية وتشكيلتي والتوقعات تخص الموسم الحالي", "Model # (default)": "النموذج # (الافتراضي)", "Model # + penalty regression": "النموذج # + ضبط ركلات الجزاء", "Model #": "النموذج #", "model #": "النموذج #", "model # + penalty regression": "النموذج # + ضبط ركلات الجزاء", "Model (#)": "النموذج (#)", "Model tested:": "النموذج المختبر:", "(playing-time model trained on archived seasons)": "(نموذج وقت اللعب المدرَّب على المواسم المؤرشفة)", "Model v#'s five playing-time parameters were tuned on the ## and ## seasons, so replays of those two archived seasons are partly in-sample": "معاملات وقت اللعب الخمسة في النموذج v# ضُبطت على موسمي ## و##، فإعادة هذين الموسمين داخل العينة جزئياً", "## was the validation season and ## the untouched test season (error # → # against v#)": "## موسم التحقق و## موسم الاختبار اللي ما لُمس (الخطأ # ← # مقارنة بـ v#)", "Points range calibration and the penalty-regression option": "معايرة نطاق النقاط وخيار ضبط ركلات الجزاء", "Penalty regression vs base model": "ضبط ركلات الجزاء مقابل النموذج الأساسي", "MAE base": "MAE الأساسي", "MAE with penalty regression": "MAE مع ضبط ركلات الجزاء", "Only where the option changes the prediction (penalty takers)": "فقط حيث يغيّر الخيار التوقع (منفذو ركلات الجزاء)", "all # matches this season, recent ones weighted most": "كل الـ# مباريات هذا الموسم، والأحدث لها وزن أكبر", "recent appearances while fit": "المشاركات الأخيرة وهو جاهز", "last # matches": "آخر # مباريات", "Season review": "مراجعة الموسم", "How this works.": "كيف تعمل.", "Before gameweek # the model picks its squad of # within the £#m budget using only gameweeks #–# (the same squad optimizer as Optimal XI, valued on the expected points of the next # gameweeks). In every later gameweek it sees only earlier gameweeks, as in Backtest, and picks its XI, captain and vice-captain from the squad": "قبل الجولة # يختار النموذج قائمته من # لاعباً ضمن ميزانية £#m باستخدام الجولات #–# فقط (نفس محسّن القائمة في التشكيلة المثالية، والتقييم على النقاط المتوقعة للجولات الـ# القادمة). وفي كل جولة بعدها يرى الجولات السابقة فقط، مثل الاختبار التاريخي، ويختار تشكيلته الأساسية والكابتن ونائبه من القائمة", "FPL's automatic substitutions and the vice-captain rule are applied to the real minutes": "وتُطبّق التبديلات التلقائية في FPL وقاعدة نائب الكابتن على الدقائق الفعلية", "= the model's projection for the XI it picked (captain doubled)": "= توقع النموذج للتشكيلة اللي اختارها (الكابتن مضاعف)", "= the points that XI really scored": "= النقاط اللي سجلتها هذه التشكيلة فعلاً", "= actual − expected": "= الفعلي − المتوقع", "Best XI in hindsight": "أفضل تشكيلة بأثر رجعي", "= the highest-scoring starting XI (captain doubled) of any squad of # within the budget at that gameweek's prices, a ceiling no manager reaches. Prices are FPL's prices of each gameweek": "= أعلى تشكيلة أساسية نقاطاً (الكابتن مضاعف) من أي قائمة من # لاعباً ضمن الميزانية بأسعار تلك الجولة، وهو سقف ما يوصله أي مدرب. الأسعار هي أسعار FPL في كل جولة", "chips and points hits are not used": "ولا تُستخدم الشرائح (Chips) ولا خصم النقاط مقابل الانتقالات", "Squad kept all season (no transfers)": "القائمة ثابتة طوال الموسم (بدون انتقالات)", "# free transfer a week": "انتقال مجاني واحد كل جولة", "Best XI in hindsight on the chart": "أفضل تشكيلة بأثر رجعي في الرسم", "Version": "النسخة", "Actual points, GW#–# (squad kept)": "النقاط الفعلية، ج#–# (القائمة ثابتة)", "Actual points, GW#–# (with # free transfers)": "النقاط الفعلية، ج#–# (مع # انتقالات مجانية)", "Actual points, GW#–# (with # free transfer)": "النقاط الفعلية، ج#–# (مع انتقال مجاني واحد)", "Expected by the model for the XIs it picked": "توقع النموذج للتشكيلات اللي اختارها", "Actual − expected over the season (# a gameweek)": "الفعلي − المتوقع خلال الموسم (# لكل جولة)", "Best XI in hindsight, every gameweek (the team reached #% of it)": "أفضل تشكيلة بأثر رجعي في كل جولة (الفريق وصل إلى #% منها)", "With # free transfer a week (+# points)": "مع # انتقال مجاني كل جولة (+# نقطة)", "With # free transfer a week (# points)": "مع # انتقال مجاني كل جولة (# نقطة)", "Squad kept all season (+# points)": "القائمة ثابتة طوال الموسم (+# نقطة)", "Squad kept all season (# points)": "القائمة ثابتة طوال الموسم (# نقطة)", "Actual points": "النقاط الفعلية", "Expected points": "النقاط المتوقعة", "Δ actual − expected": "Δ الفعلي − المتوقع", "Points per gameweek (y) by gameweek (x)": "النقاط في كل جولة (y) حسب الجولة (x)", "bars = actual − expected. Hover or tap for values": "الأعمدة = الفعلي − المتوقع. مرّر أو اضغط لرؤية القيم", "the table below holds every number": "والجدول بالأسفل فيه كل الأرقام", "Squad picked before GW#": "القائمة المختارة قبل ج#", "£#m of £#m, chosen with gameweeks #–# only. Expected points of GW#–# as the model saw them then": "£#m من £#m، اختيرت بالجولات #–# فقط. النقاط المتوقعة للجولات ج#–# كما رآها النموذج وقتها", "Price": "السعر", "Expected GW#–#": "المتوقع ج#–#", "(bench)": "(احتياط)", "(vice)": "(النائب)", "Gameweek by gameweek": "جولة بجولة", "Transfers": "الانتقالات", "Best XI": "أفضل تشكيلة", "none (# banked)": "لا يوجد (# مدّخرة)", "(captain and vice did not play)": "(الكابتن ونائبه لم يلعبا)", "Model v#. Automatic substitutions: a starter with no minutes is replaced by the first bench player who played and keeps the formation legal. Fixtures of later gameweeks are known in advance, as in the game": "النموذج v#. التبديلات التلقائية: اللاعب الأساسي اللي ما لعب يُستبدل بأول لاعب احتياط لعب ويحافظ على خطة نظامية. مباريات الجولات القادمة معروفة مسبقاً كما في اللعبة", "Model v#. Free transfers: # a gameweek from GW#, banked up to #": "النموذج v#. الانتقالات المجانية: # كل جولة من ج#، وتُدّخر حتى #", "each is the best single swap by the squad's expected points over the next # gameweeks and is made when it gains at least # point (any gain when the bank is full). Selling prices follow FPL (half of any rise, rounded down). Automatic substitutions: a starter with no minutes is replaced by the first bench player who played and keeps the formation legal. Fixtures of later gameweeks are known in advance, as in the game": "كل انتقال هو أفضل تبديل منفرد حسب النقاط المتوقعة للقائمة في الجولات الـ# القادمة، ويُنفّذ إذا زاد # نقطة على الأقل (أي زيادة إذا امتلأت المدّخرة). أسعار البيع حسب FPL (نصف أي ارتفاع، مقرّب للأسفل). التبديلات التلقائية: اللاعب الأساسي اللي ما لعب يُستبدل بأول لاعب احتياط لعب ويحافظ على خطة نظامية. مباريات الجولات القادمة معروفة مسبقاً كما في اللعبة", "their results are not": "لكن نتائجها لا", "their results are not. FPL published expected goals and assists only from gameweek # of ##: before that the model uses goals and assists in their place": "لكن نتائجها لا. FPL نشرت الأهداف والتمريرات الحاسمة المتوقعة من الجولة # في موسم ## فقط: قبلها يستخدم النموذج الأهداف والتمريرات الحاسمة مكانها", "Actual and expected points per gameweek": "النقاط الفعلية والمتوقعة في كل جولة", "The review replays the season on this device (a few seconds on a laptop, longer on a phone)": "المراجعة تعيد الموسم على هذا الجهاز (ثوانٍ على اللابتوب، وأطول على الجوال)", "Run the season review": "شغّل مراجعة الموسم", "Replaying gameweek # of #… (no future data is used)": "جارٍ إعادة الجولة # من #… (بدون أي بيانات مستقبلية)", "Could not run the season review:": "تعذر تشغيل مراجعة الموسم:"};
const AR_INJ={"Calf": "إصابة في الساق", "Ankle": "إصابة في الكاحل", "Groin": "إصابة في الفخذ", "Hamstring": "إصابة في العضلة الخلفية", "Muscular": "إصابة عضلية", "Foot": "إصابة في القدم", "Knee": "إصابة في الركبة", "Unspecified": "إصابة غير محددة", "Back": "إصابة في الظهر", "Hip": "إصابة في الورك", "Thigh": "إصابة في الفخذ", "Shoulder": "إصابة في الكتف", "Head": "إصابة في الرأس", "Achilles": "إصابة في وتر أخيل", "Toe": "إصابة في إصبع القدم", "Heel": "إصابة في الكعب", "Hand": "إصابة في اليد", "Wrist": "إصابة في الرسغ", "Rib": "إصابة في الضلع", "Neck": "إصابة في الرقبة"};
const AR_MON={"Jan": "يناير", "Feb": "فبراير", "Mar": "مارس", "Apr": "أبريل", "May": "مايو", "Jun": "يونيو", "Jul": "يوليو", "Aug": "أغسطس", "Sep": "سبتمبر", "Oct": "أكتوبر", "Nov": "نوفمبر", "Dec": "ديسمبر"};
const AR_DAY={"Mon": "الإثنين", "Tue": "الثلاثاء", "Wed": "الأربعاء", "Thu": "الخميس", "Fri": "الجمعة", "Sat": "السبت", "Sun": "الأحد"};
