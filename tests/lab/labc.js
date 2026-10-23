
/* ===== Intelligence Lab, part 2: match results, weekly review, hidden patterns, case file, milestones, the feed ===== */

/* ---------- match results in any league: your probabilities against a simple xG model ---------- */
/* Match model "xG Poisson 1": each team's attack and defence are its xG for and against a match this season, pulled toward the
   league average by 3 matches' worth; the home side scores the league's home xG average scaled by its attack and the
   opponent's defence, the away side likewise; goals are independent Poisson counts. It needs 3 matches with shot data for
   both teams. The probabilities are saved with your prediction, from the data of that moment, and stay hidden until kick-off. */
const LAB_MM='xg-poisson-1';
async function labMatchModel(){
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),T=new Map();let hs=0,as=0,n=0;
 fin.forEach(m=>{const xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null)return;n++;hs+=xh;as+=xa;
  [[m.home,xh,xa],[m.away,xa,xh]].forEach(([t,f,a])=>{const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=a;T.set(t,r)})});
 if(n<10)return null;
 const H=hs/n,A=as/n,mu=(H+A)/2,N0=3,str=t=>{const r=T.get(t);return r&&r.n>=3?{att:(r.f+N0*mu)/(r.n+N0)/mu,def:(r.a+N0*mu)/(r.n+N0)/mu,n:r.n}:null};
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 return (h,a)=>{const x=str(h),y=str(a);if(!x||!y)return null;const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,dr=0,l=0;
  for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)dr+=q;else l+=q}const s=w+dr+l;
  return {p:[w/s,dr/s,l/s],lh,la,n:[x.n,y.n],ver:LAB_MM}};
}
const labBrier3=(p,o)=>p.reduce((s,x,i)=>s+Math.pow(x-(i===o?1:0),2),0);
async function labMatchCard(){
 await fixLoad();const L=((FIX.d&&FIX.d.leagues)||{})[D.id]||[],now=Date.now(),soon=now+10*864e5;
 const fx=L.filter(x=>{const t=Date.parse(x.k||x.d);return t>now&&t<soon}).slice(0,40),mine=new Set(labRead().recs.filter(r=>r.type==='match').map(r=>r.mid));
 if(!fx.length)return `<div class="card"><h3>Who will win?</h3><div class="empty">No ${esc(D.name)} fixtures in the next 10 days in the data.</div></div>`;
 const lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
 return `<div class="card"><h3>Who will win? <span class="mu" style="font-weight:400">· <span>${esc(D.name)}</span></span></h3>
  <label class="labf"><span>Match</span><select id="labmx">${fx.map(x=>`<option value="${esc(x.i)}"${mine.has(x.i)?' disabled':''}>${esc(new Date(x.k||x.d).toLocaleString(lc,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))} · ${esc(x.h)} – ${esc(x.a)}</option>`).join('')}</select></label>
  <label class="labf"><span>Your pick</span><select id="labmp"><option value="H">Home win</option><option value="D">Draw</option><option value="A">Away win</option></select></label>
  <label class="labf"><span>Confidence</span><span class="labconf"><input id="labmc" type="range" min="35" max="100" step="5" value="50" oninput="$('#labmcv').textContent=this.value+'%'"><b id="labmcv">50%</b></span></label>
  <label class="labf"><span>Why? (optional)</span><input id="labwhymatch" maxlength="280"></label>
  <button onclick="labSaveMatch()">Save prediction</button><div class="mu" style="font-size:11px;margin-top:6px">Locked at kick-off. Your confidence goes to your pick and the rest is split evenly between the other two results; evaluated with the Brier score for three outcomes (0 is perfect, 2 is the worst), next to the site's xG model.</div></div>`;
}
async function labSaveMatch(){
 const say=m=>{LAB.msg=m;route()},o=labRead();if(o.bad)return say('Your saved predictions could not be read. Delete them in the Data tab before recording new ones.');
 const mid=($('#labmx')||{}).value,x=(((FIX.d&&FIX.d.leagues)||{})[D.id]||[]).find(f=>f.i===mid),pick=($('#labmp')||{}).value,c=labN(($('#labmc')||{}).value);
 if(!x)return say('Choose a match from the list.');if(Date.now()>=Date.parse(x.k||x.d))return say('This match has kicked off: predictions are closed.');
 if(!['H','D','A'].includes(pick)||c==null||c<35||c>100)return say('Confidence must be between #% and #%.'.replace('#',35).replace('#',100));
 if(o.recs.some(r=>r.type==='match'&&r.mid===mid))return say('You already have a prediction for this match.');
 const mm=await labMatchModel(),m=mm?mm(x.h,x.a):null,ix={H:0,D:1,A:2}[pick],pr=[0,1,2].map(i=>i===ix?c/100:(1-c/100)/2);
 o.recs.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:'match',lid:D.id,lname:D.name,mid,h:x.h,a:x.a,dl:new Date(Date.parse(x.k||x.d)).toISOString(),
  at:new Date().toISOString(),pick,conf:c/100,pr,model:m?{p:m.p,lh:m.lh,la:m.la,n:m.n,ver:m.ver}:null,why:String(($('#labwhymatch')||{}).value||'').trim().slice(0,280)});
 if(!labWrite(o))return say('This browser did not allow saving (storage full or blocked).');
 say('Saved. It can be removed until the deadline; after that it is locked.');
}
/* results come from each league's own data file; a league other than the one open is loaded only when one of its matches is due */
async function labEvalMatches(o){
 const due=o.recs.filter(r=>r.type==='match'&&!r.res&&Date.now()>=Date.parse(r.dl));if(!due.length)return false;let ch=false;
 for(const lid of [...new Set(due.map(r=>r.lid))]){
  let M=null;if(D&&D.id===lid)M=D.matches;else{const m=(ALL.leagues||[]).find(l=>l.id===lid);if(!m||!m.file)continue;
   try{const x=await fetch('data/'+m.file+'?v='+encodeURIComponent(ALL.generated||''));if(x.ok){const j=await x.json();M=(j.matches||[]).map(z=>({match_id:z.i,score:z.s,date:z.d}))}}catch(e){}}
  if(!M)continue;const by=new Map(M.map(m=>[m.match_id,m]));
  for(const r of due.filter(r=>r.lid===lid)){const m=by.get(r.mid),g=m&&wkSc(m.score);if(!g)continue;
   if(!(Date.parse(r.at)<Date.parse(r.dl))){r.res={st:'late',t:new Date().toISOString()};ch=true;continue}
   const oc=g[0]>g[1]?0:g[0]===g[1]?1:2,ix={H:0,D:1,A:2}[r.pick],mm=r.model?r.model.p:null,mx=mm?mm.indexOf(Math.max(...mm)):null;
   r.res={st:'ok',score:g[0]+'-'+g[1],o:oc,won:ix===oc,b:labBrier3(r.pr,oc),mb:mm?labBrier3(mm,oc):null,mHit:mm?mx===oc:null,t:new Date().toISOString()};ch=true}
 }
 if(ch)labWrite(o);return ch;
}

/* ---------- weekly review: the last finished gameweek ---------- */
function labWeekOf(d){const fin=d.events.filter(e=>e.fin).sort((a,b)=>b.id-a.id)[0];if(!fin)return null;const nx=d.events.find(e=>e.id===fin.id+1);
 return {e:fin,from:Date.parse(fin.dl),to:nx?Date.parse(nx.dl):Infinity}}
async function labWeek(d,o){
 const W=labWeekOf(d);if(!W)return '<div class="empty">No gameweek has finished yet this season.</div>';
 const inW=r=>r.res&&r.res.st==='ok'&&(r.type==='match'?Date.parse(r.dl)>=W.from&&Date.parse(r.dl)<W.to:r.gw===W.e.id&&r.season===labSeason(d));
 const now=o.recs.filter(inW),before=o.recs.filter(r=>r.res&&r.res.st==='ok'&&!inW(r)&&Date.parse(r.dl)<W.from);
 const R=await labDiscCalc().catch(()=>[]),disc=R.length>=6&&Math.abs(R[0].gap)>=4?`<p><b>${esc(R[0].t)}</b> ${R[0].gap<0?'<span>have fewer points than their chances were worth</span>':'<span>have more points than their chances were worth</span>'}: <b>${labF(R[0].gap)}</b> <span class="mu">(${R[0].n} <span>matches</span> · <span>${esc(D.name)}</span>)</span> · <a href="javascript:labTab('disc')">Discovery</a></p>`:'';
 const head=`<div class="card"><div class="mu" style="font-size:12px"><span>${esc(W.e.name)}</span> · <span class="nw">${esc(new Date(W.from).toISOString().slice(0,10))}</span></div>`;
 if(!now.length)return head+`<p>None of your predictions were evaluated in this gameweek, so there is no personal review this week.</p><p class="mu"><a href="javascript:labTab('arena')">Record a prediction</a> <span>for the next gameweek to get one.</span></p>${disc?'<h3>This week in the data</h3>'+disc:''}</div>`;
 const P=now.filter(r=>r.type==='pts'),PM=P.filter(r=>r.res.me!=null),H=now.filter(r=>r.type==='h2h'),X=now.filter(r=>r.type==='match');
 const lines=[];
 if(P.length)lines.push(`<li><span>Points predictions:</span> <b>${P.length}</b> · <span>your mean error</span> <b>${labMean(P.map(r=>r.res.e)).toFixed(2)}</b>${PM.length?` · <span>model's mean error</span> <b>${labMean(PM.map(r=>r.res.me)).toFixed(2)}</b> <span class="mu">(${PM.length})</span>`:''}</li>`);
 if(H.length)lines.push(`<li><span>Head-to-head picks:</span> <b>${H.length}</b> · <span>right</span> <b>${H.filter(r=>r.res.won).length}</b> · <span>Brier score</span> <b>${labMean(H.map(r=>r.res.b)).toFixed(3)}</b></li>`);
 if(X.length){const XM=X.filter(r=>r.res.mb!=null);lines.push(`<li><span>Match results:</span> <b>${X.length}</b> · <span>right</span> <b>${X.filter(r=>r.res.won).length}</b> · <span>Brier score</span> <b>${labMean(X.map(r=>r.res.b)).toFixed(3)}</b>${XM.length?` · <span>model</span> <b>${labMean(XM.map(r=>r.res.mb)).toFixed(3)}</b>`:''}</li>`)}
 /* most informative: where you and the model differed most, in your favour and against you */
 const gap=r=>r.type==='pts'&&r.res.me!=null?r.res.me-r.res.e:r.type==='match'&&r.res.mb!=null?(r.res.mb-r.res.b)*5:null,G=now.filter(r=>gap(r)!=null).sort((a,b)=>gap(b)-gap(a));
 const desc=r=>`${labCall(d,r)} → ${r.type==='pts'?`<b>${r.res.a[0]}</b> <span>pts</span> (<span>your error</span> ${r.res.e.toFixed(1)} · <span>model's error</span> ${r.res.me.toFixed(1)})`:`<b>${esc(r.res.score)}</b> (<span>Brier</span> ${r.res.b.toFixed(2)} · <span>model</span> ${r.res.mb.toFixed(2)})`}`;
 const best=G.length&&gap(G[0])>0?`<p><b>Most informative success.</b> ${desc(G[0])}</p>`:'',worst=G.length&&gap(G[G.length-1])<0?`<p><b>Most informative mistake.</b> ${desc(G[G.length-1])}</p>`:'';
 /* against your own earlier weeks, on points predictions with a model figure */
 const rel=rs=>rs.filter(r=>r.type==='pts'&&r.res.me!=null).map(r=>r.res.e-r.res.me),a=rel(now),b=rel(before);
 const prev=a.length&&b.length>=10?`<p class="mu"><span>Your error minus the model's this week:</span> <b>${labF(labMean(a),2)}</b> · <span>in earlier weeks:</span> <b>${labF(labMean(b),2)}</b> <span>(lower is better; one week is a small sample)</span></p>`:'';
 const ins=labInsights(o.recs).find(x=>x.c.state==='established'||x.c.state==='emerging');
 return head+`<ul class="labul">${lines.join('')}</ul>${best}${worst}${prev}${ins?`<p><b>Analytical DNA.</b> ${esc(ins.v)} <span class="labst ${ins.c.state==='established'?'g':'w'}">${LAB_STATE[ins.c.state]}</span></p>`:''}${disc?'<h3>This week in the data</h3>'+disc:''}</div>`;
}

/* ---------- hidden patterns in the FPL data ---------- */
function labHidden(d){
 const fin=d.events.filter(e=>e.fin).length,P=d.P.map(p=>Object.assign({},p,{mi:labN(p.minutes)||0,xg:labN(p.expected_goals)||0,xa:labN(p.expected_assists)||0,gl:labN(p.goals_scored)||0,st0:labN(p.starts)||0})),out=[];
 const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:null},pos=p=>LAB_POS[p.ty]||'',f2=x=>x.toFixed(2);
 const row=p=>`<b>${esc(p.wn)}</b> <span class="mu">${esc(p.tn)} · ${pos(p)}</span>`;
 /* 1. per 90 against totals */
 {const cap=fin*90,att=P.filter(p=>p.ty>=3&&p.mi>=270),xgi=p=>(p.xg+p.xa)/p.mi*90,reg=att.filter(p=>p.mi>=.7*cap),base=med(reg.map(xgi));
  const L=att.filter(p=>p.mi<=.55*cap&&xgi(p)>=.5).sort((a,b)=>xgi(b)-xgi(a)).slice(0,8);
  out.push({t:'Strong per 90 minutes, limited minutes',why:'Season totals reward minutes. These midfielders and forwards produce chances at a high rate when they play, but have played little, so their totals hide it.',
   base:base!=null?`<span>Midfielders and forwards with at least 70% of the minutes:</span> <span>median xG + xA per 90</span> <b>${f2(base)}</b>`:'',
   rows:L.map(p=>[row(p),Math.round(p.mi),f2(xgi(p)),(p.xg+p.xa).toFixed(1),labN(p.total_points)]),head:[['Player'],['Minutes',1],['xG + xA per 90',1],['xG + xA',1],['FPL points',1]],
   lim:'Few minutes make a figure per 90 minutes noisy, and minutes off the bench can come against tired defences; the rate may not hold with more playing time.'})}
 /* 2. goals against xG */
 {const L=P.filter(p=>p.xg>=2),up=[...L].sort((a,b)=>(b.gl-b.xg)-(a.gl-a.xg)).slice(0,5),dn=[...L].sort((a,b)=>(a.gl-a.xg)-(b.gl-b.xg)).slice(0,5);
  out.push({t:'Goals against the quality of chances',why:'xG measures how good the chances were; goals measure how many went in. A large gap over a few matches says more about this season\'s finishing (and goalkeeping) than about chance quality.',
   base:`<span>Players with at least 2.0 xG:</span> <b>${L.length}</b>`,
   rows:up.concat(dn).map(p=>[row(p),p.gl,p.xg.toFixed(1),labF(p.gl-p.xg)]),head:[['Player'],['Goals',1],['xG',1],['Goals − xG',1]],
   lim:'Some players do finish better than average over many seasons, but over a few matches large gaps are mostly noise. This shows a difference, not its cause.'})}
 /* 3. the model's next-gameweek prediction per million, for players with secure minutes and low ownership */
 {const T=Object.values(d.track.gws||{}).filter(t=>Date.parse(t.dl)>Date.now()).sort((a,b)=>a.gw-b.gw)[0];
  if(T&&T.preds){const sec=p=>(p.chance_of_playing_next_round==null||labN(p.chance_of_playing_next_round)>=100)&&fin>0&&p.st0/fin>=.8,pr=p=>T.preds[String(p.id)],own=p=>labN(p.selected_by_percent);
   const L=P.filter(p=>sec(p)&&fpOk(pr(p))&&p.now_cost>0),pm=p=>pr(p)/(p.now_cost/10),base=L.length?labMean(L.map(pm)):null,V=L.filter(p=>own(p)!=null&&own(p)<10).sort((a,b)=>pm(b)-pm(a)).slice(0,8);
   out.push({t:'Possibly undervalued for Gameweek '+T.gw,why:'Predicted points per £1m from the site\'s model for the next gameweek, among players who start regularly and have no availability flag, owned by fewer than 10% of managers.',
    base:base!=null?`<span>All such regular starters:</span> <b>${base.toFixed(2)}</b> <span>predicted points per £1m</span> <span class="mu">(${L.length})</span>`:'',
    rows:V.map(p=>[row(p),(p.now_cost/10).toFixed(1),pr(p).toFixed(2),pm(p).toFixed(2),own(p).toFixed(1)+'%']),head:[['Player'],['Price',1],['Predicted points',1],['Per £1m',1],['Owned by',1]],
    lim:'A one-gameweek model prediction, not official points; prices and ownership change daily. Cheap players score more per million partly because they are cheap.'})}}
 return out;
}
function labHiddenHtml(d){
 return `<div class="mu" style="font-size:12px;margin-bottom:8px">Patterns in this season's Fantasy Premier League data that totals and tables can hide. Each says what it shows, the baseline, and its limits; none of them shows a cause.</div>`+
  labHidden(d).map(x=>`<div class="card labhp"><h3>${esc(x.t)}</h3><p class="mu">${esc(x.why)}</p>${x.base?`<p style="font-size:13px">${x.base}</p>`:''}${x.rows.length?tbl(x.head,x.rows):'<div class="empty">No player meets the conditions yet.</div>'}<p class="mu" style="font-size:11px"><b>Limits.</b> <span>${esc(x.lim)}</span></p></div>`).join('');
}

/* ---------- case file: a recent match the result did not follow the chances ---------- */
async function labCases(){
 const sh=await loadSh().catch(()=>null),S=sh?sh.rows:[],tx=wkTeamXg(S),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),last=fin.map(m=>m.date.slice(0,10)).sort().pop();if(!last)return [];
 const from=new Date(Date.parse(last+'T00:00:00Z')-20*864e5).toISOString().slice(0,10),out=[];
 fin.filter(m=>m.date.slice(0,10)>=from).forEach(m=>{const g=wkSc(m.score);if(g[0]===g[1])return;const xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null)return;
  const w=g[0]>g[1]?'h':'a',xw=w==='h'?xh:xa,xl=w==='h'?xa:xh;if(xl-xw>=.7)out.push({m,g,w,xw,xl,dx:xl-xw,sh:S.filter(s=>s.m===m.match_id)})});
 return out.sort((a,b)=>b.dx-a.dx||String(b.m.date).localeCompare(String(a.m.date))).slice(0,6);
}
const LAB_CASE_OPTS=[['fin','The winners finished their chances better than expected'],['miss','The losers missed big chances'],['set','The winners scored from set pieces or penalties'],['ot','The losers rarely hit the target']];
function labCaseEvidence(c){
 const W=c.w==='h'?c.m.home:c.m.away,L=c.w==='h'?c.m.away:c.m.home,gw=c.w==='h'?c.g[0]:c.g[1],gl=c.w==='h'?c.g[1]:c.g[0];
 const sW=c.sh.filter(s=>s.c===W&&!s.og),sL=c.sh.filter(s=>s.c===L&&!s.og),goal=s=>s.ev==='Goal',ot=s=>!!s.ot;
 const big=sL.filter(s=>!goal(s)&&s.xg>=.3).sort((a,b)=>b.xg-a.xg),wGoals=sW.filter(goal),setG=wGoals.filter(s=>!['RegularPlay','FastBreak','IndividualPlay'].includes(s.st)),ogs=c.sh.filter(s=>s.og).length;
 const over=gw-c.xw,under=c.xl-gl,f={fin:over>=1,miss:big.length>=2||(big.length>=1&&big[0].xg>=.5),set:setG.length>0&&setG.length*2>=wGoals.length,ot:sL.length>=6&&sL.filter(ot).length/sL.length<.35};
 const main=over>=under?'fin':'miss';
 return {W,L,gw,gl,sW,sL,big,wGoals,setG,ogs,over,under,f,main};
}
async function labCase(o){
 const C=await labCases();if(!C.length)return `<div class="empty">No recent ${esc(D.name)} match in the data where the team with clearly more xG (at least 0.7 more) lost. That is a finding too: recent results have followed the chances.</div>`;
 const pick=(LAB.case&&C.find(c=>c.m.match_id===LAB.case))||C.find(c=>!o.cases[c.m.match_id])||C[0],c=pick,E=labCaseEvidence(c),A=o.cases[c.m.match_id];
 const q=`<div class="mu" style="font-size:12px"><span>${esc(D.name)}</span> · <span class="nw">${esc(c.m.date.slice(0,10))}</span> · ${mlink(c.m)}</div><h3><span>Why did</span> <span>${esc(E.L)}</span> <span>lose to</span> <span>${esc(E.W)}</span> <span>despite creating more chances?</span></h3>
  <p class="mu"><span>xG:</span> <span>${esc(E.L)}</span> <b>${c.xl.toFixed(2)}</b> · <span>${esc(E.W)}</span> <b>${c.xw.toFixed(2)}</b> · <span>Score</span> <b>${esc(c.m.score)}</b></p>`;
 let body;
 if(!A)body=`<p>What do you think explains it? Pick one, then see the evidence.</p><div class="labopts">${LAB_CASE_OPTS.map(([k,t])=>`<button class="s" onclick="labCaseAnswer('${esc(c.m.match_id)}','${k}')">${esc(t)}</button>`).join('')}</div>`;
 else{const sup=Object.keys(E.f).filter(k=>E.f[k]),sh=s=>`${esc(s.pn||'?')} <span class="mu">${s.mn!=null?Math.round(s.mn)+'′':''} · xG ${s.xg.toFixed(2)}${s.st&&s.st!=='RegularPlay'?' · '+esc(SIT[s.st]||s.st):''}</span>`;
  body=`<p><span>Your answer:</span> <b>${esc((LAB_CASE_OPTS.find(x=>x[0]===A.ans)||['',''])[1])}</b> · ${E.f[A.ans]?'<span class="labst g">supported by the evidence</span>':'<span class="labst x">not supported by the evidence</span>'}</p>
   <div class="labev"><div><h4>${esc(E.W)}</h4><p><span>Goals</span> <b>${E.gw}</b> <span>from xG</span> <b>${c.xw.toFixed(2)}</b> (${labF(E.over)}) · <span>shots</span> ${E.sW.length}</p>${E.wGoals.length?'<ul>'+E.wGoals.map(s=>'<li>'+sh(s)+'</li>').join('')+'</ul>':''}</div>
    <div><h4>${esc(E.L)}</h4><p><span>Goals</span> <b>${E.gl}</b> <span>from xG</span> <b>${c.xl.toFixed(2)}</b> (${labF(-E.under)}) · <span>shots</span> ${E.sL.length}</p>${E.big.length?'<div class="mu" style="font-size:12px">Big chances missed (xG ≥ 0.3)</div><ul>'+E.big.slice(0,4).map(s=>'<li>'+sh(s)+'</li>').join('')+'</ul>':''}</div></div>
   <p><b>Conclusion.</b> ${E.main==='fin'?`<span>The bigger part of the gap is on the winners' side: they scored</span> <b>${E.over.toFixed(1)}</b> <span>goals more than their chances were worth.</span>`:`<span>The bigger part of the gap is on the losers' side: they scored</span> <b>${E.under.toFixed(1)}</b> <span>goals fewer than their chances were worth.</span>`}
    <span>Supported explanations:</span> ${sup.length?sup.map(k=>'<b>'+esc(LAB_CASE_OPTS.find(x=>x[0]===k)[1])+'</b>').join(' · '):'<span>none clearly; a small xG difference can go either way</span>'}.</p>
   ${E.ogs?`<p class="mu" style="font-size:12px"><span>Own goals in this match:</span> ${E.ogs} <span>(they count in the score, not in xG).</span></p>`:''}
   <p class="mu" style="font-size:11px"><b>How the evidence is read.</b> <span>Finishing: the winners scored at least 1 goal more than their xG. Big chances missed: two misses of xG 0.3 or more, or one of 0.5 or more. Set pieces: at least half of the winners' goals came from set pieces or penalties. Shooting: under 35% of the losers' shots (at least 6) were on target. xG is a measure of chance quality, not a verdict on the players.</span></p>`}
 const others=C.filter(x=>x!==c).map(x=>`<li><a href="javascript:labOpenCase('${esc(x.m.match_id)}')">${esc(x.m.home)} ${esc(x.m.score)} ${esc(x.m.away)}</a> <span class="mu">${esc(x.m.date.slice(0,10))} · xG ${x.xl.toFixed(2)} – ${x.xw.toFixed(2)}</span>${o.cases[x.m.match_id]?' <span class="labst g">done</span>':''}</li>`).join('');
 return `<div class="card labcase">${q}${body}</div>${others?`<h3>Other recent cases</h3><ul class="labul">${others}</ul>`:''}`;
}
function labOpenCase(id){LAB.case=id;route()}
function labCaseAnswer(id,ans){const o=labRead();if(o.bad)return;if(!o.cases[id]){o.cases[id]={ans,at:new Date().toISOString(),lid:D.id};labWrite(o)}LAB.case=id;route()}

/* ---------- milestones: things you did or measurably achieved; nothing for simply visiting ---------- */
function labMilestones(o){
 const ev=o.recs.filter(r=>r.res&&r.res.st==='ok').sort((a,b)=>String(a.res.t).localeCompare(String(b.res.t))),PM=o.recs.filter(r=>r.type==='pts'&&r.res&&r.res.st==='ok'&&r.res.me!=null);
 const H=o.recs.filter(r=>r.type==='h2h'&&r.res&&r.res.st==='ok').sort((a,b)=>String(a.dl).localeCompare(String(b.dl))),cs=Object.values(o.cases).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const first=[...o.recs].sort((a,b)=>String(a.at).localeCompare(String(b.at)))[0],ins=labInsights(o.recs).find(x=>x.c.state==='established'||x.c.state==='emerging');
 const beat=PM.length>=20?(()=>{const v=PM.map(r=>r.res.e-r.res.me),m=labMean(v),se=Math.sqrt(labVar(v)/v.length);return m<0&&-m>2*se})():false;
 const cal=H.length>=20?labMean(H.slice(-10).map(r=>r.res.b))<labMean(H.slice(0,10).map(r=>r.res.b)):false;
 const L=[['first','First prediction recorded',first&&first.at],['review','First prediction evaluated',ev[0]&&ev[0].res.t],['case','First case file investigated',cs[0]&&cs[0].at],
  ['e10','10 predictions evaluated',ev[9]&&ev[9].res.t],['e25','25 predictions evaluated',ev[24]&&ev[24].res.t],['e50','50 predictions evaluated',ev[49]&&ev[49].res.t],
  ['dna','First pattern in your Analytical DNA',ins?'now':null],['cal','Head-to-head Brier score better in your last 10 picks than your first 10',cal?'now':null],
  ['beat','Closer than the model over at least 20 points predictions (more than two standard errors)',beat?'now':null]];
 let ch=false;L.forEach(([k,,t])=>{if(t&&!o.ms[k]){o.ms[k]=t==='now'?new Date().toISOString():t;ch=true}});if(ch)labWrite(o);
 return L.map(([k,t])=>({k,t,at:o.ms[k]||null}));
}
function labMsHtml(o){const M=labMilestones(o);
 return `<h3>Milestones</h3><div class="mu" style="font-size:12px;margin-bottom:6px">Reached by what you did or measurably achieved; there are no streaks and nothing to lose by taking a break.</div><ul class="labms">${M.map(m=>`<li class="${m.at?'on':''}"><span class="labmk">${m.at?'✓':'·'}</span><span>${esc(m.t)}</span>${m.at?` <span class="mu nw">${esc(String(m.at).slice(0,10))}</span>`:''}</li>`).join('')}</ul>`}

/* ---------- the feed: what is new for you, then what is worth a look ---------- */
async function labFeed(d,o){
 const S=o.seen||{},since=S.t?Date.parse(S.t):null,items=[],e=labOpen(d),ins=labInsights(o.recs);
 const card=(k,html)=>items.push(`<div class="card labfeed ${k}">${html}</div>`);
 if(since){const nev=o.recs.filter(r=>r.res&&r.res.st==='ok'&&Date.parse(r.res.t)>since);
  if(nev.length)card('new',`<b>${nev.length} <span>predictions evaluated since your last visit</span></b> · <a href="javascript:labTab('review')">Review</a>`);
  const chg=ins.filter(x=>(x.c.state==='established'||x.c.state==='emerging')&&(S.dna||{})[x.k]!==x.c.state);
  chg.forEach(x=>card('new',`<b>${esc(LAB_STATE[x.c.state])}:</b> ${esc(x.v)} · <a href="javascript:labTab('dna')">Analytical DNA</a>`));
  const ms=labMilestones(o).filter(m=>m.at&&Date.parse(m.at)>since);if(ms.length)card('new',`<b>${ms.length>1?'Milestones reached':'Milestone reached'}:</b> `+ms.map(m=>`<span>${esc(m.t)}</span>`).join(' · ')+` · <a href="javascript:labTab('review')">Review and progress</a>`)}
 if(e){const n=o.recs.filter(r=>r.gw===e.id&&r.season===labSeason(d)).length;
  card('open',`<b>${esc(e.name)}</b> · <span>Deadline</span> <span class="nw">${esc(new Date(e.dl).toISOString().slice(0,16).replace('T',' '))} UTC</span><br>${n?`<span>Your predictions for this gameweek:</span> <b>${n}</b>`:'<span>You have no predictions for this gameweek yet.</span>'} · <a href="javascript:labTab('arena')">Decision Arena</a>`)}
 /* leagues you have predicted matches in come first */
 const lg=[...new Set(o.recs.filter(r=>r.type==='match').map(r=>r.lid))];await fixLoad();
 [...new Set([...lg,D.id])].slice(0,3).forEach(id=>{const L=(((FIX.d&&FIX.d.leagues)||{})[id]||[]).filter(x=>Date.parse(x.k||x.d)>Date.now()),nm=((ALL.leagues||[]).find(l=>l.id===id)||{}).name;
  if(L.length)card('open',`<b>${esc(nm||'')}</b> · <span>Next match</span> <span>${esc(L[0].h)}</span> – <span>${esc(L[0].a)}</span> <span class="mu nw">${esc(String(L[0].k||L[0].d).slice(0,16).replace('T',' '))} UTC</span>${id===D.id?` · <a href="javascript:labTab('arena')">Predict it</a>`:''}`)});
 const C=await labCases().catch(()=>[]),open=C.find(c=>!o.cases[c.m.match_id]);
 if(open)card('case',`<b>Case file.</b> <span>Why did</span> <span>${esc(open.w==='h'?open.m.away:open.m.home)}</span> <span>lose to</span> <span>${esc(open.w==='h'?open.m.home:open.m.away)}</span> <span>despite creating more chances?</span> · <a href="javascript:labOpenCase('${esc(open.m.match_id)}');labTab('case')">Investigate</a>`);
 const R=await labDiscCalc().catch(()=>[]);if(R.length>=6&&Math.abs(R[0].gap)>=4)card('disc',`<b>Discovery.</b> ${esc(R[0].t)} ${R[0].gap<0?'<span>have fewer points than their chances were worth</span>':'<span>have more points than their chances were worth</span>'} (${labF(R[0].gap)}) · <a href="javascript:labTab('disc')">Discovery</a>`);
 const hp=labHidden(d).find(x=>x.rows.length);if(hp)card('disc',`<b>Hidden pattern.</b> <span>${esc(hp.t)}</span> · <a href="javascript:labTab('hidden')">Hidden patterns</a>`);
 const dev=o.recs.filter(r=>r.res&&r.res.st==='ok').length<20;
 if(dev)card('tip',`<span>Your Analytical DNA appears after 20 evaluated predictions. Evaluated so far:</span> <b>${o.recs.filter(r=>r.res&&r.res.st==='ok').length}</b>`);
 /* remember what was shown, so the next visit can say what changed */
 o.seen={t:new Date().toISOString(),dna:Object.fromEntries(ins.map(x=>[x.k,x.c.state]))};labWrite(o);
 return (since?'':`<div class="mu" style="font-size:12px;margin-bottom:8px">From your next visit, this page starts with what changed since this one.</div>`)+items.join('');
}
