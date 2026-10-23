/* ===== Intelligence Lab: your Premier League judgement against the model and the official results =====
   Your predictions stay in this browser only (localStorage key 'plx_lab_v1'); nothing is sent anywhere.
   Read-only data: data/fpl.json (players, fixtures, deadlines, official FPL points per gameweek), data/fpl_track.json (the
   model's points prediction for every player, saved by the sync before each deadline and locked after it), and the selected
   league's results and shot xG (the discovery).
   Rules: a prediction can be recorded or removed only before its gameweek's deadline; it is evaluated once the gameweek is
   finished (official points final) and the result is stored with it, so it never changes later. The model's figure stays
   hidden until the deadline, so your call is your own. Personal patterns are shown only with enough evaluated predictions. */
const LAB_KEY='plx_lab_v1',LAB={d:null,v:'',tab:'feed',msg:'',case:null};
const LAB_POS={1:'GKP',2:'DEF',3:'MID',4:'FWD'};
function labValid(r){if(!r||typeof r!=='object'||typeof r.dl!=='string'||typeof r.at!=='string'||typeof r.id!=='string')return false;
 if(r.type==='match')return typeof r.lid==='string'&&typeof r.mid==='string'&&typeof r.h==='string'&&typeof r.a==='string'&&['H','D','A'].includes(r.pick)&&Array.isArray(r.pr)&&r.pr.length===3&&r.pr.every(fpOk);
 return (r.type==='pts'||r.type==='h2h')&&Number.isInteger(r.gw)&&Array.isArray(r.p)&&r.p.length===(r.type==='pts'?1:2)&&r.p.every(Number.isInteger)&&Array.isArray(r.s)&&r.s.length===r.p.length}
const labObj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
/* stored records; unreadable data is kept aside (once) instead of being overwritten */
function labRead(){
 let raw=null,o=null;try{raw=localStorage.getItem(LAB_KEY)}catch(e){}
 if(raw){try{o=JSON.parse(raw)}catch(e){o=null}}
 if(!o||typeof o!=='object'||!Array.isArray(o.recs)){
  if(raw){try{if(!localStorage.getItem(LAB_KEY+'_unreadable'))localStorage.setItem(LAB_KEY+'_unreadable',raw)}catch(e){}}
  return {v:1,recs:[],cases:{},ms:{},seen:{},bad:!!raw};
 }
 const recs=o.recs.filter(labValid);return {v:1,recs,cases:labObj(o.cases),ms:labObj(o.ms),seen:labObj(o.seen),dropped:o.recs.length-recs.length};
}
/* recs: predictions; cases: your answers to case files; ms: when each milestone was first reached; seen: what the Lab showed on your last visit */
function labWrite(o){try{localStorage.setItem(LAB_KEY,JSON.stringify({v:1,recs:o.recs,cases:o.cases||{},ms:o.ms||{},seen:o.seen||{}}));return true}catch(e){return false}}
async function labData(){
 const m=ALL&&ALL.fpl;if(!m||!m.file)return null;
 if(LAB.d&&LAB.v===(m.v||''))return LAB.d;
 const r=await fetch('data/'+m.file+'?v='+encodeURIComponent(m.v||''));if(!r.ok)throw new Error(m.file+' (HTTP '+r.status+')');
 const d=await r.json(),T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=T.get(o.tm)||{};o.tn=t.s||'?';o.tf=t.n||'?';return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));d.T=T;d.ix=Object.fromEntries((d.hcols||[]).map((c,i)=>[c,i]));
 let tr={gws:{}};try{const x=await fetch('data/fpl_track.json?v='+encodeURIComponent(d.generated||''));if(x.ok)tr=await x.json()}catch(e){}
 d.track=tr&&tr.gws?tr:{gws:{}};LAB.d=d;LAB.v=m.v||'';return d;
}
const labN=v=>{const x=Number(v);return isFinite(x)?x:null};
const labSeason=d=>{const y=+String((d.events[0]||{}).dl||'').slice(0,4);return y?y+'-'+String(y+1).slice(2):''};
const labFx=(d,tm,gw)=>d.fix.filter(x=>x[0]===gw&&(x[1]===tm||x[2]===tm));
const labOpen=d=>d.events.filter(e=>Date.parse(e.dl)>Date.now()).sort((a,b)=>a.id-b.id)[0]||null;
const labName=(d,id)=>{const p=d.PB.get(id);return p?p.wn:'#'+id};
/* official points and minutes of a player in a gameweek (a double gameweek adds up) */
function labAt(d,id,gw){let pts=0,min=0;((d.hist||{})[String(id)]||[]).forEach(h=>{if(h[d.ix.r]===gw){if(fpOk(h[d.ix.pts]))pts+=h[d.ix.pts];if(fpOk(h[d.ix.min]))min+=h[d.ix.min]}});return {pts,min}}
/* what was known about the player when the prediction was saved */
function labSnap(d,p,gw){
 const fin=d.events.filter(e=>e.fin).length,fx=labFx(d,p.tm,gw),mi=labN(p.minutes)||0;
 return {tm:p.tm,ty:p.ty,c:labN(p.now_cost),form:labN(p.form),ppg:labN(p.points_per_game),min:mi,st:labN(p.starts),fin,ch:p.chance_of_playing_next_round==null?null:labN(p.chance_of_playing_next_round),
  xgi90:mi>=270?((labN(p.expected_goals)||0)+(labN(p.expected_assists)||0))/mi*90:null,nfx:fx.length,home:fx.some(x=>x[1]===p.tm)};
}
/* the model's prediction for a gameweek, only from a record saved before that gameweek's deadline */
function labModel(d,gw,id){const t=(d.track.gws||{})[String(gw)];if(!t||!t.preds)return null;const sv=Date.parse(String(t.saved||'').replace(' ','T')+'Z');
 if(!(sv<=Date.parse(t.dl)))return null;const v=t.preds[String(id)];return fpOk(v)?{v,ver:t.ver||null}:null}
/* evaluates finished gameweeks once and stores the outcome with the prediction */
function labEval(d,o){
 let ch=false;const season=labSeason(d);
 for(const r of o.recs){
  if(r.res||r.season!==season)continue;const e=d.events.find(x=>x.id===r.gw);if(!e||!e.fin)continue;
  const dl=Math.min(Date.parse(r.dl),Date.parse(e.dl));
  if(!(Date.parse(r.at)<dl)){r.res={st:'late'};ch=true;continue}
  if(r.s.some((s,i)=>!labFx(d,s.tm,r.gw).length)){r.res={st:'blank'};ch=true;continue}
  const A=r.p.map(id=>labAt(d,id,r.gw)),M=r.p.map(id=>labModel(d,r.gw,id));
  if(r.type==='pts'){const a=A[0].pts,m=M[0];r.res={st:'ok',a:[a],min:[A[0].min],e:Math.abs(r.pred-a),bias:r.pred-a,m:m?[m.v]:null,me:m?Math.abs(m.v-a):null,ver:m?m.ver:null}}
  else{const [a0,a1]=A.map(x=>x.pts);
   if(a0===a1)r.res={st:'tie',a:[a0,a1],min:A.map(x=>x.min)};
   else{const win=a0>a1?r.p[0]:r.p[1],ok=r.pick===win,mm=M[0]&&M[1]&&M[0].v!==M[1].v?(M[0].v>M[1].v?r.p[0]:r.p[1]):null;
    r.res={st:'ok',a:[a0,a1],min:A.map(x=>x.min),won:ok,b:Math.pow(r.conf-(ok?1:0),2),m:M[0]&&M[1]?[M[0].v,M[1].v]:null,mHit:mm==null?null:mm===win,ver:M[0]?M[0].ver:null}}}
  r.res.t=new Date().toISOString();ch=true;
 }
 if(ch)labWrite(o);return ch;
}

/* ---------- statistics for patterns: two groups, the difference and its standard error ---------- */
const labMean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const labVar=a=>{if(a.length<2)return 0;const m=labMean(a);return a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1)};
function labCmp(g1,g2){const n1=g1.length,n2=g2.length;if(!n1||!n2)return {n1,n2,state:'none'};
 const m1=labMean(g1),m2=labMean(g2),se=Math.sqrt(labVar(g1)/n1+labVar(g2)/n2),dif=m1-m2;
 const state=n1>=15&&n2>=15&&n1+n2>=40&&Math.abs(dif)>2*se&&se>0?'established':n1>=8&&n2>=8&&Math.abs(dif)>se&&se>0?'emerging':'inconclusive';
 return {n1,n2,m1,m2,dif,se,state}}
const labGw=rs=>{const g=rs.map(r=>r.gw);if(!g.length)return '';const a=Math.min(...g),b=Math.max(...g);return a===b?'GW'+a:'GW'+a+'–'+b};
const labF=(x,k=1)=>x==null?'N/A':(x>0?'+':'')+x.toFixed(k),labF0=(x,k=2)=>x==null?'N/A':x.toFixed(k);
const LAB_STATE={established:'Established pattern',emerging:'Emerging pattern',inconclusive:'Inconclusive',none:'Not enough data'};

function labInsights(recs){
 const P=recs.filter(r=>r.type==='pts'&&r.res&&r.res.st==='ok'),PM=P.filter(r=>r.res.me!=null),H=recs.filter(r=>r.type==='h2h'&&r.res&&r.res.st==='ok'),out=[];
 const rel=r=>r.res.e-r.res.me;
 /* 1. attackers and defenders, measured against the model on the same predictions (so the different difficulty of positions cancels out) */
 {const a=PM.filter(r=>r.s[0].ty>=3),b=PM.filter(r=>r.s[0].ty<=2),c=labCmp(a.map(rel),b.map(rel));
  out.push({k:'pos',t:'Attackers and defenders',c,rs:a.concat(b),
   v:c.state==='none'||c.state==='inconclusive'?'No clear difference yet between your predictions for attackers and for defenders.':c.dif<0?'Compared with the model, your predictions have been more accurate for attackers (MID, FWD) than for defenders (GKP, DEF).':'Compared with the model, your predictions have been more accurate for defenders (GKP, DEF) than for attackers (MID, FWD).',
   rows:[['Attackers (MID, FWD)',a],['Defenders (GKP, DEF)',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 /* 2. recent form: players scoring well above their season average in the last 30 days */
 {const hot=r=>r.s[0].form!=null&&r.s[0].ppg!=null&&r.s[0].form-r.s[0].ppg>=2,a=P.filter(hot),b=P.filter(r=>!hot(r)),c=labCmp(a.map(r=>r.res.bias),b.map(r=>r.res.bias));
  out.push({k:'form',t:'Players in hot form',c,rs:P,bias:true,
   v:c.state==='none'||c.state==='inconclusive'?'No clear sign yet that recent form pulls your predictions up or down.':c.m1>0&&c.dif>0?'You have predicted more points than players in hot form went on to score, more so than for other players: recent form may weigh heavily in your predictions.':c.m1<0&&c.dif<0?'You have predicted fewer points than players in hot form went on to score, more so than for other players.':'Your predictions for players in hot form and for other players differ, without a consistent over- or underestimate.',
   rows:[['Hot form (last 30 days ≥ 2 points a match above season average)',a],['Other players',b]],how:'Your prediction minus the official points, on average; above 0 means you predicted too many.'})}
 /* 3. strong underlying attacking numbers against recent points without them */
 {const s=r=>r.s[0],a=PM.filter(r=>s(r).xgi90!=null&&s(r).xgi90>=.45),b=PM.filter(r=>s(r).xgi90!=null&&s(r).xgi90<.45&&s(r).form!=null&&s(r).ppg!=null&&s(r).form-s(r).ppg>=2),c=labCmp(a.map(rel),b.map(rel));
  out.push({k:'xgi',t:'Underlying numbers and recent points',c,rs:a.concat(b),
   v:c.state==='none'||c.state==='inconclusive'?'Not enough evidence yet on whether you read underlying numbers or recent points better.':c.dif<0?'Compared with the model, you have evaluated players with strong underlying attacking numbers (xG + xA) more accurately than players in hot form without them.':'Compared with the model, you have evaluated players in hot form without strong underlying numbers more accurately than players with strong xG + xA.',
   rows:[['xG + xA per 90 ≥ 0.45 (at least 270 minutes)',a],['Hot form, xG + xA per 90 < 0.45',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 /* 4. uncertain minutes: a flag on availability, or starting under 60% of the gameweeks played */
 {const unc=r=>{const s=r.s[0];return (s.ch!=null&&s.ch<100)||(s.fin>0&&s.st!=null&&s.st/s.fin<.6)},a=PM.filter(unc),b=PM.filter(r=>!unc(r)),c=labCmp(a.map(rel),b.map(rel));
  out.push({k:'min',t:'Uncertain minutes',c,rs:PM,
   v:c.state==='none'||c.state==='inconclusive'?'No clear difference yet between players with secure and uncertain minutes.':c.dif>0?'Compared with the model, your predictions have been less accurate when a player\'s minutes were uncertain.':'Compared with the model, your predictions have been more accurate when a player\'s minutes were uncertain.',
   rows:[['Uncertain minutes (availability flag, or started under 60% of gameweeks)',a],['Secure minutes',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 /* 5. confidence: stated probability against how often the pick was right */
 {const n=H.length,conf=n?labMean(H.map(r=>r.conf)):null,hit=n?labMean(H.map(r=>r.res.won?1:0)):null,se=n?Math.sqrt(hit*(1-hit)/n):null;
  const state=n<20?(n?'inconclusive':'none'):Math.abs(conf-hit)>2*se&&n>=40?'established':Math.abs(conf-hit)>se?'emerging':'inconclusive';
  out.push({k:'cal',t:'Confidence',c:{state,n1:n},rs:H,cal:{n,conf,hit},
   v:state==='none'||state==='inconclusive'?'Not enough evidence yet on whether your confidence matches your results.':conf>hit?'Your stated confidence has been higher than your hit rate: your head-to-head picks were right less often than you expected.':'Your hit rate has been higher than your stated confidence: you may be underconfident in your head-to-head picks.'})}
 /* 6. change over time: the last 10 predictions with a model figure against the ones before */
 {const s=[...PM].sort((a,b)=>a.gw-b.gw||String(a.at).localeCompare(String(b.at))),a=s.slice(-10),b=s.slice(0,-10),c=s.length>=20?labCmp(a.map(rel),b.map(rel)):{state:'none',n1:a.length,n2:b.length};
  out.push({k:'trend',t:'Your last 10 predictions',c,rs:s,
   v:c.state==='none'||c.state==='inconclusive'?'No clear change yet between your last 10 evaluated predictions and the earlier ones.':c.dif<0?'Compared with the model, your last 10 evaluated predictions were more accurate than your earlier ones.':'Compared with the model, your last 10 evaluated predictions were less accurate than your earlier ones.',
   rows:[['Last 10',a],['Earlier',b]],how:'Your error minus the model\'s error on the same predictions, in points; lower is better for you.'})}
 return out;
}

/* ---------- discovery: points against the chances a team created and allowed ---------- */
/* expected points of a match from the two teams' xG, with each side's goals as a Poisson count (a common simplification) */
function labXPts(xf,xa){const P=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o},a=P(xf),b=P(xa);let w=0,dr=0;
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=a[i]*b[j];if(i>j)w+=q;else if(i===j)dr+=q}return 3*w+dr}
async function labDiscCalc(){
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),T=new Map();
 fin.forEach(m=>{const g=wkSc(m.score);[[m.home,g[0],g[1],m.away],[m.away,g[1],g[0],m.home]].forEach(([t,f,a,o])=>{const xf=tx.get(m.match_id+'|'+t),xa=tx.get(m.match_id+'|'+o);if(xf==null||xa==null)return;
  const r=T.get(t)||{t,n:0,pts:0,xp:0,xf:0,xa:0,f:0,a:0,d0:m.date,d1:m.date};r.n++;r.pts+=f>a?3:f===a?1:0;r.xp+=labXPts(xf,xa);r.xf+=xf;r.xa+=xa;r.f+=f;r.a+=a;
  if(m.date<r.d0)r.d0=m.date;if(m.date>r.d1)r.d1=m.date;T.set(t,r)})});
 return [...T.values()].filter(r=>r.n>=6).map(r=>Object.assign(r,{gap:r.pts-r.xp})).sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
}
async function labDiscovery(){
 const R=await labDiscCalc();
 if(R.length<6)return `<div class="empty">Not enough matches with shot data in ${esc(D.name)} yet for a reliable discovery (each team needs at least 6).</div>`;
 const top=R[0],mean=labMean(R.map(r=>Math.abs(r.gap))),d0=R.reduce((a,r)=>r.d0<a?r.d0:a,R[0].d0).slice(0,10),d1=R.reduce((a,r)=>r.d1>a?r.d1:a,R[0].d1).slice(0,10);
 const tab=tbl([['Team'],['Matches',1],['Points',1],['Expected points',1],['Difference',1],['xG for',1],['xG against',1],['Goals',1]],
  [...R].sort((a,b)=>a.gap-b.gap).map(r=>[clubLink(r.t),r.n,r.pts,r.xp.toFixed(1),labF(r.gap),r.xf.toFixed(1),r.xa.toFixed(1),r.f+'-'+r.a]));
 if(Math.abs(top.gap)<4)return `<div class="card"><h3>Results in line with chance quality</h3><div class="mu">No team in ${esc(D.name)} has a points total more than 4 away from what its chances were worth (largest difference: <b>${esc(top.t)}</b>, ${labF(top.gap)}).</div></div>`+tab;
 const up=top.gap<0;
 return `<div class="card labdisc"><div class="mu" style="font-size:12px"><span>${esc(D.name)}</span> · <span class="nw">${esc(d0)} – ${esc(d1)}</span></div>
  <h3>${clubLink(top.t)} ${up?'<span>have fewer points than their chances were worth</span>':'<span>have more points than their chances were worth</span>'}</h3>
  <p><span>Points:</span> <b>${top.pts}</b> · <span>expected points from xG:</span> <b>${top.xp.toFixed(1)}</b> · <span>difference:</span> <b>${labF(top.gap)}</b> <span class="mu">(${top.n} <span>matches</span>)</span></p>
  <p class="mu">${up?'Their results have lagged behind the chances they created and allowed: if the chance quality holds, their results are more likely to improve than the table suggests.':'Their results have run ahead of the chances they created and allowed: finishing, goalkeeping or late goals have added points that the chance quality alone does not explain.'}</p>
  <p class="mu" style="font-size:12px"><b>Baseline.</b> <span>Across the ${R.length} teams with at least 6 matches with shot data, the average difference is ${mean.toFixed(1)} points either way.</span></p>
  <p class="mu" style="font-size:12px"><b>How it is worked out.</b> <span>For each match, expected points come from the two teams' xG with goals as independent Poisson counts: 3 × chance of winning + chance of a draw. This is a simplification: it ignores the game state (a team leading sits back), and penalties count in xG. A difference shows where results and chance quality disagree; it does not prove luck, and it does not predict the future on its own.</span></p></div>
  <h3>All teams</h3>${tab}`;
}

/* ---------- the page ---------- */
function labTab(t){LAB.tab=t;LAB.msg='';route()}
function labPlOptions(d,gw){
 const ok=new Set(d.fix.filter(x=>x[0]===gw).flatMap(x=>[x[1],x[2]]));
 return d.P.filter(p=>ok.has(p.tm)&&p.st!=='u').sort((a,b)=>(labN(b.total_points)||0)-(labN(a.total_points)||0)).map(p=>`<option value="${esc(p.wn+' · '+p.tn+' · '+LAB_POS[p.ty]+' · '+(p.now_cost/10).toFixed(1))}" data-id="${p.id}"></option>`).join('');
}
function labPick(id){const v=($('#'+id)||{}).value||'',o=[...document.querySelectorAll('#labpl option')].find(x=>x.value===v);return o?+o.dataset.id:null}
function labSave(type){
 const d=LAB.d,e=labOpen(d),o=labRead();if(o.bad){LAB.msg='Your saved predictions could not be read. Delete them in the Data tab before recording new ones.';route();return}
 if(!e){LAB.msg='There is no open gameweek.';route();return}
 const say=m=>{LAB.msg=m;route()};
 if(Date.now()>=Date.parse(e.dl))return say('The deadline has passed: predictions for this gameweek are closed.');
 const reason=String(($('#labwhy'+type)||{}).value||'').trim().slice(0,280),base={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),type,gw:e.id,season:labSeason(d),dl:e.dl,at:new Date().toISOString(),data:d.generated||'',mv:typeof PM_VERSION!=='undefined'?PM_VERSION:null,why:reason};
 if(type==='pts'){
  const id=labPick('labp1'),v=labN(($('#labpts')||{}).value);
  if(id==null)return say('Choose a player from the list.');if(v==null||v<-5||v>40)return say('Enter predicted points between -5 and 40.');
  if(o.recs.some(r=>r.type==='pts'&&r.gw===e.id&&r.p[0]===id))return say('You already have a points prediction for this player in this gameweek. Remove it first to record a new one.');
  o.recs.push(Object.assign(base,{p:[id],s:[labSnap(d,d.PB.get(id),e.id)],pred:Math.round(v*2)/2}));
 }else{
  const a=labPick('labh1'),b=labPick('labh2'),w=($('#labwin')||{}).value,c=labN(($('#labconf')||{}).value);
  if(a==null||b==null)return say('Choose two players from the list.');if(a===b)return say('Choose two different players.');if(c==null||c<50||c>100)return say('Confidence must be between 50% and 100%.');
  if(o.recs.some(r=>r.type==='h2h'&&r.gw===e.id&&new Set(r.p).has(a)&&new Set(r.p).has(b)))return say('You already have a prediction for this pair in this gameweek.');
  o.recs.push(Object.assign(base,{p:[a,b],s:[labSnap(d,d.PB.get(a),e.id),labSnap(d,d.PB.get(b),e.id)],pick:w==='2'?b:a,conf:c/100}));
 }
 if(!labWrite(o))return say('This browser did not allow saving (storage full or blocked).');
 LAB.msg='Saved. It can be removed until the deadline; after that it is locked.';route();
}
function labDel(id){const o=labRead(),r=o.recs.find(x=>x.id===id);if(!r)return;
 if(Date.now()>=Date.parse(r.dl)){LAB.msg='This prediction is locked: its deadline has passed.';route();return}
 o.recs=o.recs.filter(x=>x.id!==id);labWrite(o);route()}
function labExport(){const o=labRead(),b=new Blob([JSON.stringify({app:'PL Analytics Intelligence Lab',key:LAB_KEY,exported:new Date().toISOString(),v:1,recs:o.recs,cases:o.cases,ms:o.ms},null,1)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(b);a.download='pl-analytics-lab-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function labImport(inp){const f=inp.files&&inp.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{let o=null;try{o=JSON.parse(rd.result)}catch(e){}
 const recs=o&&Array.isArray(o.recs)?o.recs.filter(labValid):null;if(!recs){LAB.msg='That file is not a Lab export.';route();return}
 const cur=labRead(),ids=new Set(cur.recs.map(r=>r.id));let n=0;recs.forEach(r=>{if(!ids.has(r.id)){cur.recs.push(r);n++}});Object.entries(labObj(o.cases)).forEach(([k,v])=>{if(!cur.cases[k]&&v&&v.ans)cur.cases[k]=v});labWrite(cur);LAB.msg=n+' predictions imported.';route()};rd.readAsText(f)}
function labWipe(){if(!confirm('Delete all your Intelligence Lab predictions from this browser? This cannot be undone.'))return;try{localStorage.removeItem(LAB_KEY);localStorage.removeItem(LAB_KEY+'_unreadable')}catch(e){}LAB.msg='All Lab predictions deleted from this browser.';route()}

function labCall(d,r){
 if(r.type==='match')return `<span class="nw"><span>${esc(r.h)}</span> – <span>${esc(r.a)}</span></span>: <b>${r.pick==='H'?'<span>home win</span>':r.pick==='A'?'<span>away win</span>':'<span>draw</span>'}</b> <span class="mu">(${Math.round(r.conf*100)}%)</span> <div class="mu" style="font-size:11px">${esc(r.lname||'')}</div>`;
 const nm=i=>esc(labName(d,r.p[i]));
 if(r.type==='pts')return `<span class="nw">${nm(0)}</span>: <b>${r.pred}</b> <span>pts</span>`;
 return `<span class="nw">${esc(labName(d,r.pick))}</span> <span>over</span> <span class="nw">${esc(labName(d,r.p.find(x=>x!==r.pick)))}</span> <span class="mu">(${Math.round(r.conf*100)}%)</span>`;
}
function labStatus(d,r){
 const st=r.res?r.res.st:Date.now()<Date.parse(r.dl)?'open':'wait';
 return {open:'<span class="labst o">Open</span>',wait:r.type==='match'?'<span class="labst w">Locked, waiting for the result</span>':'<span class="labst w">Locked, waiting for official points</span>',late:'<span class="labst x">Saved after the deadline, not counted</span>',
  blank:'<span class="labst x">No fixture, not counted</span>',tie:'<span class="labst x">Level on points, not counted</span>',ok:'<span class="labst g">Evaluated</span>'}[st];
}
function labRows(d,recs){
 return tbl([['GW',1],['Your prediction'],['Model',1],['Official result'],['Status']],[...recs].sort((a,b)=>Date.parse(b.dl)-Date.parse(a.dl)||String(b.at).localeCompare(String(a.at))).map(r=>{
  const R=r.res,lk=Date.now()>=Date.parse(r.dl);let model='<span class="mu" title="Shown after the deadline">hidden</span>',act='';
  if(r.type==='match'){if(lk)model=r.model?r.model.p.map(x=>Math.round(x*100)+'%').join(' / '):'<span class="mu">N/A</span>';
   if(R&&R.st==='ok')act=`<b>${esc(R.score)}</b> · ${R.won?'<span style="color:var(--g)">right</span>':'<span style="color:var(--r)">wrong</span>'} · <span>Brier</span> ${R.b.toFixed(2)}${R.mb!=null?` <span class="mu">(<span>model</span> ${R.mb.toFixed(2)})</span>`:''}`;
   return [r.gw||'',labCall(d,r)+(r.why?`<div class="mu labwhy">“${esc(r.why)}”</div>`:''),model,act||'<span class="mu">–</span>',labStatus(d,r)+(!lk?` <button class="s labdel" onclick="labDel('${esc(r.id)}')" aria-label="Remove">✕</button>`:'')]}
  if(lk){const M=R&&R.m?R.m:r.p.map(id=>labModel(d,r.gw,id)).every(Boolean)?r.p.map(id=>labModel(d,r.gw,id).v):null;
   model=M?(r.type==='pts'?M[0].toFixed(1):M.map(x=>x.toFixed(1)).join(' – ')):'<span class="mu">N/A</span>'}
  if(R&&R.a)act=r.type==='pts'?`<b>${R.a[0]}</b> <span>pts</span> <span class="mu">(${R.min[0]} <span>min</span>)</span>${R.st==='ok'?` · <span>error</span> ${R.e.toFixed(1)}${R.me!=null?` <span class="mu">(<span>model</span> ${R.me.toFixed(1)})</span>`:''}`:''}`:
   `<b>${R.a[0]} – ${R.a[1]}</b> <span>pts</span>${R.st==='ok'?` · ${R.won?'<span style="color:var(--g)">right</span>':'<span style="color:var(--r)">wrong</span>'} · <span>Brier</span> ${R.b.toFixed(2)}${R.mHit!=null?` <span class="mu">(<span>model</span> ${R.mHit?'<span>right</span>':'<span>wrong</span>'})</span>`:''}`:''}`;
  return [r.gw,labCall(d,r)+(r.why?`<div class="mu labwhy">“${esc(r.why)}”</div>`:''),model,act||'<span class="mu">–</span>',labStatus(d,r)+(!lk?` <button class="s labdel" onclick="labDel('${esc(r.id)}')" aria-label="Remove">✕</button>`:'')];
 }));
}
function labProgress(d,recs){
 const P=recs.filter(r=>r.type==='pts'&&r.res&&r.res.st==='ok'),PM=P.filter(r=>r.res.me!=null),H=recs.filter(r=>r.type==='h2h'&&r.res&&r.res.st==='ok'),HM=H.filter(r=>r.res.mHit!=null);
 const ev=recs.filter(r=>r.res&&r.res.st==='ok').length,k=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
 let cmp='';
 if(PM.length){const u=labMean(PM.map(r=>r.res.e)),m=labMean(PM.map(r=>r.res.me));const se=PM.length>1?Math.sqrt(labVar(PM.map(r=>r.res.e-r.res.me))/PM.length):null;
  cmp+=`<p><span>Points predictions with a model figure:</span> <b>${PM.length}</b> · <span>your mean error</span> <b>${u.toFixed(2)}</b> · <span>model's mean error</span> <b>${m.toFixed(2)}</b> (MAE).</p>`+
   (PM.length<10?'<p class="mu">Fewer than 10: too few to compare you with the model.</p>':se!=null&&Math.abs(u-m)<=2*se?'<p class="mu">The difference is within the noise of this sample (less than two standard errors).</p>':`<p class="mu">${u<m?'Over this sample your predictions have been closer to the official points than the model\'s.':'Over this sample the model has been closer to the official points than your predictions.'}</p>`);}
 if(H.length){const b=labMean(H.map(r=>r.res.b)),hit=labMean(H.map(r=>r.res.won?1:0));
  cmp+=`<p><span>Head-to-head picks:</span> <b>${H.length}</b> · <span>right</span> <b>${Math.round(hit*100)}%</b> · <span>Brier score</span> <b>${b.toFixed(3)}</b> <span class="mu">(<span>0 is perfect; always saying 50% scores 0.25</span>)</span></p>`+
   (HM.length?`<p><span>On the same pairs, the model's pick (the player it predicted more points for) was right</span> <b>${Math.round(labMean(HM.map(r=>r.res.mHit?1:0))*100)}%</b> <span>of the time</span> <span class="mu">(${HM.length} <span>pairs; the model gives points, not probabilities, so only hit rates are compared</span>)</span></p>`:'');}
 const X=recs.filter(r=>r.type==='match'&&r.res&&r.res.st==='ok'),XM=X.filter(r=>r.res.mb!=null);
 if(X.length){const v=XM.map(r=>r.res.b-r.res.mb),se=v.length>1?Math.sqrt(labVar(v)/v.length):null;
  cmp+=`<p><span>Match results:</span> <b>${X.length}</b> · <span>right</span> <b>${Math.round(labMean(X.map(r=>r.res.won?1:0))*100)}%</b> · <span>Brier score</span> <b>${labMean(X.map(r=>r.res.b)).toFixed(3)}</b> <span class="mu">(<span>three outcomes: 0 is perfect, 2 is the worst; one-third each scores 0.667</span>)</span></p>`+
   (XM.length?`<p><span>On the same matches, the xG model's Brier score:</span> <b>${labMean(XM.map(r=>r.res.mb)).toFixed(3)}</b> <span class="mu">(${XM.length})</span></p>`+(XM.length<10?'<p class="mu">Fewer than 10: too few to compare you with the model.</p>':se!=null&&Math.abs(labMean(v))<=2*se?'<p class="mu">The difference is within the noise of this sample (less than two standard errors).</p>':`<p class="mu">${labMean(v)<0?'Over these matches your probabilities scored better than the model\'s.':'Over these matches the model\'s probabilities scored better than yours.'}</p>`):'')}
 return `<div class="grid">${k(recs.length,'Predictions recorded')}${k(ev,'Evaluated')}${k(P.length?labMean(P.map(r=>r.res.e)).toFixed(2):'N/A','Your mean error (points)')}${k(H.length?labMean(H.map(r=>r.res.b)).toFixed(3):'N/A','Your Brier score')}</div>${cmp?`<div class="card">${cmp}</div>`:''}`;
}
function labDNA(recs){
 const ev=recs.filter(r=>r.res&&r.res.st==='ok'),I=labInsights(recs);
 const head=ev.length<20?`<div class="card"><b>Your profile is still developing.</b> <span class="mu"><span>Patterns appear after at least 20 evaluated predictions, with at least 8 in each group being compared. Evaluated so far:</span> ${ev.length}.</span></div>`:'';
 return head+`<div class="mu" style="font-size:12px;margin:8px 0"><div>Each pattern compares two groups of your own evaluated predictions. These describe your past predictions, not you.</div><ul style="margin:4px 0;padding-inline-start:18px"><li>Established pattern: at least 15 in each group (40 in all) and a difference larger than two standard errors.</li><li>Emerging pattern: at least 8 in each group and a difference larger than one standard error.</li><li>Inconclusive: anything less.</li></ul></div>`+
  I.map(x=>{const c=x.c,rs=x.rs;
   const ev2=x.cal?(x.cal.n?`<p class="mu" style="font-size:12px"><span>Average stated confidence</span> <b>${Math.round(x.cal.conf*100)}%</b> · <span>picks right</span> <b>${Math.round(x.cal.hit*100)}%</b> · <span>evaluated picks:</span> ${x.cal.n}</p>`:''):
    x.rows?tbl([['Group'],['Predictions',1],[x.bias?'Average over- or underestimate':'You minus model',1]],x.rows.map(([n,g],i)=>[esc(n),g.length,g.length?labF(i===0?c.m1:c.m2,2):'N/A'])):'';
   return `<div class="card labins ${c.state}"><div class="labinh"><b>${esc(x.t)}</b><span class="labst ${c.state==='established'?'g':c.state==='emerging'?'w':'x'}">${LAB_STATE[c.state]}</span></div><p>${esc(x.v)}</p>${ev2}
    ${x.how?`<div class="mu" style="font-size:11px">${esc(x.how)}</div>`:''}${rs.length&&c.state!=='none'&&c.se!=null?`<div class="mu" style="font-size:11px"><span>Difference</span> ${labF(c.dif,2)} ± ${c.se.toFixed(2)} <span>(one standard error)</span> · ${esc(labGw(rs))}</div>`:''}</div>`}).join('');
}
function labArena(d,recs,extra){
 const e=labOpen(d);
 if(!e)return '<div class="empty">There is no open gameweek: the season\'s deadlines have all passed.</div>'+(extra?`<div class="labforms">${extra}</div>`:'');
 const mine=recs.filter(r=>r.gw===e.id||(r.type==='match'&&!r.res&&Date.now()<Date.parse(r.dl))),dlt=new Date(e.dl),opts=labPlOptions(d,e.id);
 return `<div class="card"><div><b>${esc(e.name)}</b> · <span>Deadline</span> <span class="nw">${esc(dlt.toLocaleString(document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</span></div>
  <div class="mu" style="font-size:12px">Record your call before the deadline. The model's figure for this gameweek is shown only after the deadline, so your judgement stays your own.</div></div>
  <datalist id="labpl">${opts}</datalist>
  <div class="labforms"><div class="card"><h3>How many FPL points will a player score?</h3>
   <label class="labf"><span>Player</span><input id="labp1" list="labpl" placeholder="Type a name" autocomplete="off"></label>
   <label class="labf"><span>Points</span><input id="labpts" type="number" min="-5" max="40" step="0.5" inputmode="decimal" placeholder="e.g. 6"></label>
   <label class="labf"><span>Why? (optional)</span><input id="labwhypts" maxlength="280" placeholder="e.g. strong xG, easy fixture"></label>
   <button onclick="labSave('pts')">Save prediction</button><div class="mu" style="font-size:11px;margin-top:6px">Evaluated with the official points (MAE). A double gameweek adds up.</div></div>
  <div class="card"><h3>Which of two players will score more points?</h3>
   <label class="labf"><span>Player 1</span><input id="labh1" list="labpl" placeholder="Type a name" autocomplete="off"></label>
   <label class="labf"><span>Player 2</span><input id="labh2" list="labpl" placeholder="Type a name" autocomplete="off"></label>
   <label class="labf"><span>Your pick</span><select id="labwin"><option value="1">Player 1</option><option value="2">Player 2</option></select></label>
   <label class="labf"><span>Confidence</span><span class="labconf"><input id="labconf" type="range" min="50" max="100" step="5" value="60" oninput="$('#labconfv').textContent=this.value+'%'"><b id="labconfv">60%</b></span></label>
   <label class="labf"><span>Why? (optional)</span><input id="labwhyh2h" maxlength="280"></label>
   <button onclick="labSave('h2h')">Save prediction</button><div class="mu" style="font-size:11px;margin-top:6px">Evaluated with the Brier score: your confidence against what happened. Level points are not counted.</div></div>${extra||''}</div>
  <h3><span>${esc(e.name)}</span> · <span>Your predictions</span></h3>${mine.length?labRows(d,mine):'<div class="empty">No predictions for this gameweek yet.</div>'}`;
}
R.lab=async function(el){
 await champReady();const d=await labData();
 if(!d||!d.events||!d.fix){el.innerHTML='<h2>Intelligence Lab</h2><div class="empty">The Fantasy Premier League data is not available yet.</div>';return}
 const o=labRead(),msg=LAB.msg;LAB.msg='';if(!o.bad){labEval(d,o);await labEvalMatches(o).catch(()=>false)}const recs=o.recs,ev=recs.filter(r=>r.res&&r.res.st==='ok').length;
 const tabs=[['feed','For you'],['arena','Decision Arena'],['review','Review and progress'],['dna','Analytical DNA'],['week','Weekly review'],['hidden','Hidden patterns'],['case','Case file'],['disc','Discovery'],['data','Your data']];
 if(!tabs.some(t=>t[0]===LAB.tab))LAB.tab='feed';
 let body='';
 if(LAB.tab==='feed')body=o.bad?'':await labFeed(d,o);
 else if(LAB.tab==='arena')body=labArena(d,recs,await labMatchCard());
 else if(LAB.tab==='review')body=labProgress(d,recs)+(o.bad?'':labMsHtml(o))+'<h3>All predictions</h3>'+(recs.length?labRows(d,recs):'<div class="empty">No predictions yet. Record one in the Decision Arena.</div>');
 else if(LAB.tab==='week')body=await labWeek(d,o);
 else if(LAB.tab==='hidden')body=labHiddenHtml(d);
 else if(LAB.tab==='case')body=await labCase(o);
 else if(LAB.tab==='dna')body=labDNA(recs);
 else if(LAB.tab==='disc')body=await labDiscovery();
 else body=`<div class="card"><p>Your predictions are stored only in this browser, on this device. They are not uploaded, do not follow you to another device or browser, and are lost if this browser's site data is cleared. Export them to keep a copy.</p>
  <p class="mu" style="font-size:12px"><span>Stored predictions:</span> ${recs.length}${o.dropped?' · <span>unreadable records skipped:</span> '+o.dropped:''}</p>
  <div class="ctl"><button onclick="labExport()">Export (JSON)</button><label class="s labimp"><span>Import</span><input type="file" accept="application/json,.json" onchange="labImport(this)" hidden></label><button class="s" onclick="labWipe()">Delete all</button></div></div>`;
 el.innerHTML=`<h2>Intelligence Lab</h2>
  ${!recs.length&&!o.bad?`<div class="card labintro"><b>Test your football judgement against the model.</b> <span>Predict FPL points before a gameweek, see how you did once the official points are in, and find out over time where your judgement is strongest. Everything stays in this browser.</span></div>`:''}
  ${o.bad?'<div class="card" style="border-color:var(--r)">Your saved Lab data could not be read, so nothing was changed. A copy was kept; delete it in Your data to start again.</div>':''}
  <div class="seg labtabs">${tabs.map(([k,n])=>`<button class="${LAB.tab===k?'on':''}" onclick="labTab('${k}')">${n}${k==='review'&&ev?` <span class="labn">${ev}</span>`:''}</button>`).join('')}</div>
  ${msg?`<div class="card labmsg" role="status">${esc(msg)}</div>`:''}${body}`;
};
