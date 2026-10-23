/* ===== Home: the overview tells the season's stories =====
   Sections, in order: discovery of the round, stars of the round, club power, who is better?, Fantasy radar (Premier League),
   quick rankings, and the way into every detailed page. The overview's existing content stays below, unchanged.
   Data: the league file and shots already loaded, and the per-match player file (loadPl, the same one the Comparison Lab
   and Defensive pages use); every per-90 value comes from aggPl, so the numbers match those pages. Fantasy data is loaded
   only when its section scrolls into view. Player photos come from PitchAPI (by the player's own id) and are shown only
   when the sync found them reachable without a key; otherwise the player's initials on his club colours.
   How cards are chosen (HOME_RULES below, editable): interest = how far the value stands from the field, in standard
   deviations (at most 4) × reliability (enough minutes) × a weight per kind of story. It ranks stories; it is not a fact
   about football. Positions are not in the data, so nothing here compares by position; goalkeepers (players with xG faced)
   are left out. */
const HOME_RULES={
 minMin:450,        /* season minutes for per-90 values */
 roundMin:60,       /* minutes in the round to appear in its rankings */
 roundDays:7,       /* the round = the last match day and the 6 days before it */
 weight:{hidden:1,rise:.9,luck:1,mover:.8},
 /* the statistics the home page uses: id in the player file, label, how to read it, group (one card per group at most) */
 metrics:[
  {k:'npxg',l:'Non-penalty xG',g:'shoot',f:a=>a.p90('npxg'),sum:r=>r.npxg},
  {k:'xt',l:'Expected threat (xT)',g:'threat',f:a=>a.p90('xt'),sum:r=>r.xt},
  {k:'sca',l:'Shot-creating actions',g:'create',f:a=>a.p90('sca'),sum:r=>r.sca},
  {k:'xag',l:'Expected assists (xAG)',g:'create',f:a=>a.p90('xag'),sum:r=>r.xag},
  {k:'tkw',l:'Successful take-ons',g:'dribble',f:a=>a.p90('tkw'),sum:r=>r.tkw},
  {k:'pc',l:'Progressive carries',g:'carry',f:a=>a.p90('pc'),sum:r=>r.pc},
  {k:'tkic',l:'Tackles + interceptions',g:'defend',f:a=>a.has('tk')&&a.has('ic')?a.p90('tk')+a.p90('ic'):null,sum:r=>r.tk==null||r.ic==null?null:r.tk+r.ic}]};
const HOME={id:null,ver:null,c:null,ph:null,rp:''};
/* positions (GK/DF/MF/FW) come from the sync once it has learned them; until most players have one, nothing compares by position */
const HPOS={DF:'Defenders',MF:'Midfielders',FW:'Forwards'};
const hPosOk=c=>!!(c.q&&c.q.length&&c.q.filter(a=>a.p).length>=c.q.length*.6);
const hMean=a=>a.reduce((s,x)=>s+x,0)/(a.length||1),hSd=a=>{const m=hMean(a);return Math.sqrt(hMean(a.map(x=>(x-m)*(x-m))))||1};
const hF=(v,d=2)=>v==null||!isFinite(v)?'N/A':(+v).toFixed(d);
const hPl=(id,club)=>'#/player/'+encodeURIComponent(id+'||'+club);
const hIni=n=>String(n||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
function hAvatar(id,name,club,big){
 const d=HOME.ph,u=d&&d.public&&d.p&&d.p[id],lg=logoOf(club);
 return `<span class="hav${big?' big':''}" style="${clubVars(club)}" aria-hidden="true"><b>${esc(hIni(name))}</b>${u?`<img class="hph" src="${esc(u)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}${lg?`<img class="hcr" src="${lg}" alt="">`:''}</span>`;
}
const hCrest=c=>{const s=logoOf(c);return s?`<img class="clogo" src="${s}" alt="" aria-hidden="true" loading="lazy">`:clubDot(c)};
/* the overview and the home ask for the shots file at the same moment; loadSh caches only once the file has arrived,
   so both downloaded it: calls made while it is on its way now share the one download (per league) */
{const _ls=loadSh;let pend=null;loadSh=function(){if(SHD)return Promise.resolve(SHD);if(!pend||pend.id!==D.id){const p=_ls();p.id=D.id;pend=p;p.then(()=>{if(pend===p)pend=null},()=>{if(pend===p)pend=null})}return pend}}
async function homePhotos(){const m=lgMeta();if(!m.photo_file)return null;try{const r=await fetch('data/'+m.photo_file+'?v='+encodeURIComponent(m.photo_v||''));return r.ok?await r.json():null}catch(e){return null}}

/* ---------- everything the cards need, computed once per league and data version ---------- */
async function homeData(){
 const ver=(lgMeta().pl_v||'')+'|'+(ALL.generated||'');
 if(HOME.id===D.id&&HOME.ver===ver&&HOME.c)return HOME.c;
 const [P,sh,ph]=await Promise.all([loadPl().catch(()=>null),loadSh().catch(()=>null),homePhotos(),champReady().catch(()=>null)]);
 HOME.ph=ph;
 const fin=D.matches.filter(m=>wkSc(m.score)&&m.date),last=fin.map(m=>m.date.slice(0,10)).sort().pop();
 const c={fin,last,P,tx:wkTeamXg(sh?sh.rows:[])};
 if(last){c.from=new Date(Date.parse(last+'T00:00:00Z')-(HOME_RULES.roundDays-1)*864e5).toISOString().slice(0,10);c.round=fin.filter(m=>m.date.slice(0,10)>=c.from)}
 const gk=new Set(agg().filter(p=>p.xgf!=null).map(p=>p.player_id||p.key));c.gk=gk;
 if(P&&P.rows.length){
  c.ag=aggPl(P).filter(a=>!gk.has(a.id));c.q=c.ag.filter(a=>a.s.mi>=HOME_RULES.minMin);
  /* the round, from the same per-match rows */
  const inR=new Set((c.round||[]).map(m=>m.match_id)),ix=P.ix,R=new Map();
  P.rows.forEach(r=>{if(!inR.has(r[ix.m])||r[ix.mi]==null||gk.has(r[ix.i]))return;let o=R.get(r[ix.i]);if(!o){o={id:r[ix.i],n:r[ix.n],club:r[ix.c],mi:0,games:0,v:{}};R.set(r[ix.i],o)}
   o.mi+=r[ix.mi];o.games++;HOME_RULES.metrics.forEach(M=>{const row={};['npxg','xt','sca','xag','tkw','pc','tk','ic'].forEach(k=>row[k]=r[ix[k]]);const v=M.sum(row);if(v!=null)o.v[M.k]=(o.v[M.k]||0)+v})});
  c.rp=[...R.values()].filter(o=>o.mi>=HOME_RULES.roundMin);
  /* per-match rows by date, for "on the rise" */
  const date=new Map(fin.map(m=>[m.match_id,m.date])),byP=new Map();
  P.rows.forEach(r=>{if(r[ix.mi]==null||gk.has(r[ix.i])||!date.has(r[ix.m]))return;if(!byP.has(r[ix.i]))byP.set(r[ix.i],[]);byP.get(r[ix.i]).push({d:date.get(r[ix.m]),mi:r[ix.mi],v:(r[ix.npxg]||0)+(r[ix.xag]||0),ok:r[ix.npxg]!=null&&r[ix.xag]!=null})});
  c.byP=byP;
  c.tc=teamCtx(P,null);
 }
 HOME.id=D.id;HOME.ver=ver;HOME.c=c;return c;
}

/* ---------- small charts ----------
   Plain HTML placed in %, so text stays crisp at any width. The subject wears the page's accent (--th-hi), everything else is
   grey context; in the comparison the second player is a light neutral, so the two never depend on hue alone. Axes and time run
   left to right in both languages. Every value a chart shows on hover is also written beside it or in a table. */
const HTIP={};let hTipN=0;
const hPct=(v,lo,hi)=>Math.max(0,Math.min(100,(v-lo)/((hi-lo)||1)*100));
const hTip=a=>a.map(x=>String(x).replace(/\|/g,'/')).join('|');
function hReg(pts){if(hTipN>400)for(const k in HTIP)delete HTIP[k];const k='h'+(++hTipN);HTIP[k]=pts;return k}
/* where one player stands among every qualified player: grey dots, the league average, the player in the accent */
function hStrip(L,me,mu){
 const vs=L.map(x=>x.v);if(vs.length<5)return '';const lo=Math.min(...vs),hi=Math.max(...vs),o=L.find(x=>x.id===me);if(!o)return '';
 const pts=L.map((x,i)=>({x:hPct(x.v,lo,hi),y:x.id===me?50:50+((i*37)%17-8)*3,t:[x.n,hF(x.v)]})),ax=hPct(mu,lo,hi);
 return `<div class="hstrip"><div class="hspl" data-hn="${hReg(pts)}" role="img" aria-label="${esc(o.n)} ${hF(o.v)}">${pts.map((p,i)=>L[i].id===me?'':`<i style="left:${p.x.toFixed(1)}%;top:${p.y}%"></i>`).join('')}
  <s style="left:${ax.toFixed(1)}%"><em class="${ax>60?'l':''}"><span>average</span> ${hF(mu)}</em></s><b style="left:${hPct(o.v,lo,hi).toFixed(1)}%"></b></div>
  <div class="hsax mu"><span>${hF(lo)}</span><span>${hF(hi)}</span></div><div class="mu hcap"><span>Each dot is a player with ${HOME_RULES.minMin}+ minutes</span></div></div>`;
}
/* one value a match, the last n in the accent */
function hCols(L,n){
 const S=L.slice(-10);if(S.length<n+2)return '';const mx=Math.max(...S.map(x=>x.v),.01);
 return `<div class="hcols" role="img" aria-label="xG + xAG">${S.map((x,i)=>`<span tabindex="0" data-tip="${esc(hTip([String(x.d).slice(0,10),hF(x.v),'xG + xAG',Math.round(x.mi),'minutes']))}"><i class="${i>=S.length-n?'on':''}" style="height:${Math.max(4,x.v/mx*100).toFixed(0)}%"></i></span>`).join('')}</div>
  <div class="mu hcap"><span>xG + xAG in each of the last ${S.length} matches; the last ${n} highlighted</span></div>`;
}
/* a few bars on one scale from zero; the subject in the accent */
function hPair(rows){
 const mx=Math.max(...rows.map(r=>r.v||0),.01);
 return `<div class="hpair">${rows.map(r=>`<div><span>${esc(r.l)}</span><span class="hpt"><i class="${r.on?'on':''}" style="width:${Math.max(2,(r.v||0)/mx*100).toFixed(1)}%"></i></span><b>${r.f}</b></div>`).join('')}</div>`;
}
/* every club: xG created against xG allowed a match (fewer allowed is higher up), split at the league averages */
function hScatter(L,fav){
 const xs=L.map(r=>r.x),ys=L.map(r=>r.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),px0=(x1-x0)*.08||.1,py0=(y1-y0)*.08||.1;
 const X=v=>hPct(v,x0-px0,x1+px0),Y=v=>hPct(v,y0-py0,y1+py0),mx=hMean(xs),my=hMean(ys);
 return `<div class="hscat"><div class="hsplot"><s class="hqx" style="left:${X(mx).toFixed(1)}%"></s><s class="hqy" style="top:${Y(my).toFixed(1)}%"></s>
  <em class="hq tr">Strong at both ends</em><em class="hq tl">Solid, little threat</em><em class="hq br">Dangerous but open</em><em class="hq bl">Struggling at both ends</em>
  ${L.map(r=>{const lg=logoOf(r.t);return `<a class="hdot${r.t===fav?' fav':''}" href="#/club/${encodeURIComponent(r.t)}" style="left:${X(r.x).toFixed(1)}%;top:${Y(r.y).toFixed(1)}%" aria-label="${esc(r.t)}" data-tip="${esc(hTip([r.t,hF(r.x),'xG created a match',hF(r.y),'xG allowed a match']))}">${lg?`<img src="${lg}" alt="" loading="lazy">`:clubDot(r.t)}</a>`}).join('')}</div>
  <div class="hsxl mu"><span>more xG created</span> →</div><div class="hsyl mu">↑ <span>fewer xG allowed</span></div></div>`;
}
/* two players as percentiles among every qualified player, six measures */
function hRadar(c,a,b){
 const ms=HCMP.map(x=>({...x,M:HOME_RULES.metrics.find(m=>m.k===x.k)})),n=ms.length,cx=120,cy=106,R=74;
 const same=hPosOk(c)&&a.p&&a.p===b.p&&HPOS[a.p],pool=same?c.q.filter(x=>x.p===a.p):c.q;
 const pc=(M,v)=>{if(v==null)return null;let lo=0,eq=0,t=0;pool.forEach(q=>{const x=M.f(q);if(x==null)return;t++;if(x<v)lo++;else if(x===v)eq++});return t?(lo+eq/2)/t*100:null};
 const P=(i,r)=>{const g=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(g)*r,cy+Math.sin(g)*r]},f=p=>p.map(x=>x.toFixed(1)).join(',');
 const pa=ms.map(m=>pc(m.M,m.M.f(a))),pb=ms.map(m=>pc(m.M,m.M.f(b))),poly=p=>p.map((v,i)=>f(P(i,R*(v||0)/100))).join(' ');
 const dots=(p,pl,cl)=>p.map((v,i)=>{const [x,y]=P(i,R*(v||0)/100);return `<circle class="${cl}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"></circle><circle class="hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" data-tip="${esc(hTip([pl.n,v==null?'N/A':Math.round(v),'percentile',hF(ms[i].M.f(pl)),ms[i].l+' per 90']))}"></circle>`}).join('');
 return `<div class="hrad"><div class="hleg"><span><i></i>${esc(a.n)}</span><span><i class="b"></i>${esc(b.n)}</span></div>
  <svg viewBox="-34 0 308 216" role="img" aria-label="${esc(a.n)} / ${esc(b.n)}">${[25,50,75,100].map(r=>`<polygon class="rg" points="${ms.map((m,i)=>f(P(i,R*r/100))).join(' ')}"></polygon>`).join('')}
  ${ms.map((m,i)=>`<line class="rg" x1="${cx}" y1="${cy}" x2="${f(P(i,R)).split(',')[0]}" y2="${f(P(i,R)).split(',')[1]}"></line>`).join('')}
  <polygon class="ra" points="${poly(pa)}"></polygon><polygon class="rb" points="${poly(pb)}"></polygon>
  ${ms.map((m,i)=>{const [x,y]=P(i,R+14),an=Math.abs(x-cx)<4?'middle':x>cx?'start':'end';return `<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="${an}">${esc(m.s)}</text>`}).join('')}
  ${dots(pb,b,'b')}${dots(pa,a,'a')}</svg>
  <div class="mu hcap"><span>${same?`Percentile among ${pool.length} ${HPOS[a.p].toLowerCase()} with ${HOME_RULES.minMin}+ minutes; the outer edge is the best in the league`:`Percentile among ${pool.length} players with ${HOME_RULES.minMin}+ minutes; the outer edge is the best in the league`}</span></div></div>`;
}
/* one tooltip for every chart: marks carry data-tip; dense dots are found by nearest point */
(function(){let tip=null;
 const put=(parts,x,y)=>{if(!tip){tip=document.createElement('div');tip.id='htip';tip.setAttribute('role','tooltip');document.body.appendChild(tip)}
  tip.textContent='';const [t,...r]=parts,h=document.createElement('div');h.className='htt';h.textContent=t;tip.appendChild(h);
  for(let i=0;i<r.length;i+=2){const d=document.createElement('div'),v=document.createElement('b'),l=document.createElement('span');v.textContent=r[i];l.textContent=r[i+1]||'';d.append(v,' ',l);tip.appendChild(d)}
  tip.classList.add('on');const w=tip.offsetWidth,hh=tip.offsetHeight;tip.style.left=Math.max(6,Math.min(innerWidth-w-6,x+12))+'px';tip.style.top=(y+14+hh>innerHeight?y-hh-10:y+14)+'px'};
 const hide=()=>{if(tip)tip.classList.remove('on')};
 const at=(e,x,y)=>{const t=e.target.closest&&e.target.closest('#home [data-tip]');if(t){put(t.dataset.tip.split('|'),x,y);return}
  const p=e.target.closest&&e.target.closest('#home [data-hn]');if(p){const L=HTIP[p.dataset.hn],r=p.getBoundingClientRect();if(L){let best=null,bd=1e9;L.forEach(q=>{const dx=r.left+q.x/100*r.width-x,dy=r.top+q.y/100*r.height-y,d=dx*dx+dy*dy*.25;if(d<bd){bd=d;best=q}});if(best&&bd<1600){put(best.t,x,y);return}}}hide()};
 document.addEventListener('pointermove',e=>at(e,e.clientX,e.clientY),{passive:true});document.addEventListener('pointerdown',e=>at(e,e.clientX,e.clientY),{passive:true});
 document.addEventListener('focusin',e=>{const t=e.target.closest&&e.target.closest('#home [data-tip]');if(t){const r=t.getBoundingClientRect();put(t.dataset.tip.split('|'),r.left+r.width/2,r.bottom-6)}else hide()});
 document.addEventListener('focusout',hide);addEventListener('scroll',hide,{passive:true});addEventListener('hashchange',hide)})();

/* ---------- 1. discovery of the round: the strongest story, and two more ---------- */
function homeStories(c){
 const W=HOME_RULES.weight,out=[],rel=mi=>Math.min(1,mi/(2*HOME_RULES.minMin));
 /* a creator the scoresheet does not show: top 5 in a creative or threat measure, at most one goal or assist */
 if(c.q&&c.q.length>20)['sca','xag','xt','pc','tkw'].forEach(k=>{const M=HOME_RULES.metrics.find(m=>m.k===k),vs=c.q.map(a=>[a,M.f(a)]).filter(x=>x[1]!=null),arr=vs.map(x=>x[1]),mu=hMean(arr),sd=hSd(arr);
  vs.sort((x,y)=>y[1]-x[1]).slice(0,5).forEach(([a,v],i)=>{const ga=(a.s.gl||0)+(a.s.ast||0);if(ga>1)return;const z=(v-mu)/sd;
   out.push({t:'hidden',z,rel:rel(a.s.mi),a,club:a.club,html:`<div class="hk">Hidden in the numbers</div><h3><b>${esc(a.n)}</b> <span>is number ${i+1} in the league for</span> <span>${esc(M.l)}</span> <span>per 90, with ${ga} ${ga===1?'goal or assist':'goals or assists'}</span></h3>
    <p><b class="hbig">${hF(v)}</b> <span>${esc(M.l)}</span> <span class="mu">per 90 · league average ${hF(mu)} · ${Math.round(a.s.mi)} minutes</span></p>@@CH@@<p class="mu"><span>Goals and assists miss what this player does before the shot.</span> <span>Season so far, players with ${HOME_RULES.minMin}+ minutes.</span></p>`,link:hPl(a.id,a.club),chart:()=>hStrip(vs.map(([q,x])=>({id:q.id,n:q.n,v:x})),a.id,mu)})})});
 /* on the rise: xG + xAG per 90 in the last 3 matches against the matches before */
 if(c.byP){const D2=[];c.byP.forEach((L,id)=>{L.sort((x,y)=>String(x.d).localeCompare(String(y.d)));const r3=L.slice(-3),pre=L.slice(0,-3),m3=r3.reduce((s,x)=>s+x.mi,0),mp=pre.reduce((s,x)=>s+x.mi,0);
   if(r3.length<3||m3<180||mp<HOME_RULES.minMin||!r3.every(x=>x.ok))return;const a=r3.reduce((s,x)=>s+x.v,0)/m3*90,b=pre.reduce((s,x)=>s+x.v,0)/mp*90;D2.push({id,a,b,d:a-b,m3,mp,r3,L})});
  if(D2.length>15){const sd=hSd(D2.map(x=>x.d)),top=D2.sort((x,y)=>y.d-x.d)[0],ag=(c.ag||[]).find(x=>x.id===top.id);
   if(ag&&top.d>0)out.push({t:'rise',z:top.d/sd,rel:Math.min(1,top.m3/270),a:ag,club:ag.club,html:`<div class="hk">On the rise</div><h3><b>${esc(ag.n)}</b> <span>expected goal involvement up from ${hF(top.b)} to ${hF(top.a)} per 90</span></h3>@@CH@@
    <p class="mu"><span>xG without penalties + expected assists (xAG), last 3 matches (${Math.round(top.m3)} minutes) against the ${Math.round(top.mp)} minutes before.</span> <span>Three matches is a short window: a trend to watch, not a verdict.</span></p>`,link:hPl(ag.id,ag.club),chart:()=>hCols(top.L,3)})}}
 /* points against the chances: from the Lab's expected-points calculation */
 if(c.luck&&c.luck.length>=6){const sd=hSd(c.luck.map(r=>r.gap)),r=c.luck[0];if(Math.abs(r.gap)>=3)out.push({t:'luck',z:Math.abs(r.gap)/sd,rel:Math.min(1,r.n/8),club:r.t,html:`<div class="hk">${r.gap<0?'Results behind the chances':'Results ahead of the chances'}</div>
  <h3>${hCrest(r.t)} <b>${esc(r.t)}</b> <span>${r.gap<0?'have fewer points than their chances were worth':'have more points than their chances were worth'}</span></h3><p><b class="hbig">${r.gap>0?'+':''}${hF(r.gap,1)}</b> <span class="mu">points: ${r.pts} won, ${hF(r.xp,1)} expected from xG in ${r.n} matches</span></p>@@CH@@<p class="mu"><span>Expected points treat each side's goals as Poisson counts from its xG; this ignores game state.</span> <span>A gap says where results and chances disagree, not why.</span></p>`,link:'#/club/'+encodeURIComponent(r.t),chart:()=>hPair([{l:'Points won',v:r.pts,f:String(r.pts),on:1},{l:'Expected points',v:r.xp,f:hF(r.xp,1)}])})}
 /* biggest move in the table this round */
 if(c.round&&c.round.length&&typeof ltOk==='function'&&ltOk(c.fin)){const before=c.fin.filter(m=>m.date.slice(0,10)<c.from);if(before.length&&ltOk(before)){const A=ltTable(before,c.tx),B=ltTable(c.fin,c.tx),pa=new Map(A.map((r,i)=>[r.t,i]));
  const mv=B.map((r,i)=>({t:r.t,from:pa.has(r.t)?pa.get(r.t)+1:null,to:i+1})).filter(x=>x.from!=null).sort((x,y)=>Math.abs(y.from-y.to)-Math.abs(x.from-x.to))[0];
  if(mv&&Math.abs(mv.from-mv.to)>=3)out.push({t:'mover',z:Math.abs(mv.from-mv.to)/2,rel:1,club:mv.t,html:`<div class="hk">${mv.to<mv.from?'Climbing':'Falling'}</div><h3>${hCrest(mv.t)} <b>${esc(mv.t)}</b> <span>${mv.to<mv.from?'moved up':'dropped'} from place ${mv.from} to place ${mv.to}</span></h3><p class="mu"><span>The table before and after the latest round</span> <span class="nw" dir="ltr">${esc(c.from)} – ${esc(c.last)}</span> · <span>Points, then goal difference.</span></p>`,link:'#/table'})}}
 out.forEach(s=>s.score=Math.min(4,Math.max(0,s.z))*s.rel*(W[s.t]??1));
 /* one story per kind, strongest first */
 const seen=new Set();return out.sort((a,b)=>b.score-a.score).filter(s=>!seen.has(s.t)&&seen.add(s.t));
}
const hStory=s=>{const ch=s.chart?s.chart():'';return s.html.includes('@@CH@@')?s.html.replace('@@CH@@',ch):s.html+ch};
function homeWhy(s){return `<details class="hwhy"><summary>Why this card?</summary><p class="mu"><span>It stands ${hF(s.z,1)} standard deviations from the rest of the field (interest, at most 4), × reliability ${hF(s.rel,2)} (enough minutes or matches), × weight ${hF(HOME_RULES.weight[s.t]??1,1)} for this kind of story = ${hF(s.score,2)}.</span> <span>The rule ranks stories; it is not a judgement of the player.</span></p></details>`}

/* ---------- 2. stars of the round ---------- */
function homeStars(c){
 if(!c.rp||c.rp.length<10)return '';
 const cards=[],used=new Set();
 HOME_RULES.metrics.map(M=>{const vs=c.rp.map(o=>[o,o.v[M.k]]).filter(x=>x[1]!=null);if(vs.length<10)return null;const arr=vs.map(x=>x[1]),mu=hMean(arr),sd=hSd(arr);vs.sort((x,y)=>y[1]-x[1]);
  return {M,top:vs[0],second:vs[1],mu,n:vs.length,z:(vs[0][1]-mu)/sd}}).filter(Boolean).sort((a,b)=>b.z-a.z).forEach(x=>{if(cards.length>=4||used.has(x.M.g)||used.has(x.top[0].id))return;used.add(x.M.g);used.add(x.top[0].id);cards.push(x)});
 const n=(c.round||[]).length;
 return `<section class="hsec"><div class="hhd"><h2>Stars of the round</h2><span class="mu nw">${esc(c.from)} – ${esc(c.last)} · ${n} <span>matches</span></span></div><div class="hgrid">${cards.map(x=>{const o=x.top[0];
  return `<a class="hcard hstar" href="${hPl(o.id,o.club)}">${hAvatar(o.id,o.n,o.club,true)}<div class="hst"><div class="hk">${esc(x.M.l)}</div><div class="hnm">${esc(o.n)}</div><div class="mu hcl">${hCrest(o.club)}<span>${esc(o.club)}</span></div></div>
   <div class="hnum"><b>${hF(x.top[1],x.M.k==='xt'?2:x.M.k==='npxg'||x.M.k==='xag'?2:0)}</b><span class="mu">in ${o.games} ${o.games===1?'match':'matches'} · ${Math.round(o.mi)} min</span></div>
   <div class="hcmp">${hPair([{l:'Leader',v:x.top[1],f:hF(x.top[1],2),on:1},{l:'Next best',v:x.second[1],f:hF(x.second[1],2)},{l:'Average',v:x.mu,f:hF(x.mu,2)}])}<div class="mu"><span>best of ${x.n}</span></div></div></a>`}).join('')}</div>
  <p class="mu hnote">Totals in the round for players with ${HOME_RULES.roundMin}+ minutes in it; each card is a different kind of contribution, picked where the leader stands furthest from the rest.</p></section>`;
}

/* ---------- 3. club power ---------- */
function homeClubs(c){
 const T=new Map();c.fin.forEach(m=>{const g=wkSc(m.score);[[m.home,m.away,g[0],g[1]],[m.away,m.home,g[1],g[0]]].forEach(([t,o,f,a])=>{const xf=c.tx.get(m.match_id+'|'+t),xa=c.tx.get(m.match_id+'|'+o);if(xf==null||xa==null)return;const r=T.get(t)||{t,n:0,xf:0,xa:0};r.n++;r.xf+=xf;r.xa+=xa;T.set(t,r)})});
 const L=[...T.values()].filter(r=>r.n>=3);if(L.length<6)return '';
 const tc=new Map((c.tc||[]).map(t=>[t.n,t]));
 const cards=[
  {t:'Attack',l:'xG created a match',v:r=>r.xf/r.n,d:2,best:'high'},
  {t:'Defence',l:'xG allowed a match',v:r=>r.xa/r.n,d:2,best:'low',note:'lower is better'},
  {t:'Territory',l:'Field tilt (share of final-third play)',v:r=>(tc.get(r.t)||{}).tilt,d:1,best:'high',u:'%'},
  {t:'Pressing',l:'High turnovers a match',v:r=>(tc.get(r.t)||{}).hto,d:1,best:'high'}];
 return `<section class="hsec"><div class="hhd"><h2>Club power</h2><span class="mu nw">${esc(D.name)} · <span>season so far</span></span></div>${homeScat(L)}<div class="hgrid">${cards.map(K=>{
  const rows=L.map(r=>[r,K.v(r)]).filter(x=>x[1]!=null&&isFinite(x[1]));if(rows.length<6)return '';rows.sort((a,b)=>K.best==='low'?a[1]-b[1]:b[1]-a[1]);
  const top=rows.slice(0,5),mx=Math.max(...rows.map(x=>x[1])),avg=hMean(rows.map(x=>x[1]));
  return `<div class="hcard hclub"><div class="hk">${esc(K.t)}</div><div class="hcl2">${esc(K.l)}${K.note?` <span class="mu">(${esc(K.note)})</span>`:''}</div>
   <ol class="hbars">${top.map(([r,v])=>`<li><a href="#/club/${encodeURIComponent(r.t)}">${hCrest(r.t)}<span class="hbn">${esc(r.t)}</span></a><span class="hbar"><i style="width:${Math.max(4,v/mx*100).toFixed(1)}%;${clubVars(r.t)}"></i></span><b>${hF(v,K.d)}${K.u||''}</b></li>`).join('')}</ol>
   <div class="mu hnote"><span>League average</span> ${hF(avg,K.d)}${K.u||''} · ${rows.length} <span>clubs</span> · <span>bars run from 0 to the league's highest</span></div></div>`}).join('')}</div></section>`;
}

function homeScat(L){
 const R=L.map(r=>({t:r.t,x:r.xf/r.n,y:r.xa/r.n,n:r.n}));const fav=typeof favOf==='function'?favOf():null;
 return `<div class="hcard hscc"><div class="hk">Attack and defence</div><div class="hcl2">xG created and allowed a match, every club</div>${hScatter(R,fav)}
  <details class="hfull"><summary>Show as a table</summary>${tbl([['Club'],['Matches',1],['xG created a match',1],['xG allowed a match',1]],[...R].sort((a,b)=>(b.x-b.y)-(a.x-a.y)).map(r=>[`<a href="#/club/${encodeURIComponent(r.t)}">${esc(r.t)}</a>`,r.n,hF(r.x),hF(r.y)]))}</details>
  <p class="mu hnote"><span>The lines are the league averages; tap a crest for the club.</span></p></div>`;
}

/* ---------- 4. who is better? two players from the same leaderboard ---------- */
const HCMP=[{k:'npxg',l:'Non-penalty xG',s:'npxG'},{k:'xag',l:'Expected assists (xAG)',s:'xAG'},{k:'sca',l:'Shot-creating actions',s:'Shot-creating'},{k:'tkw',l:'Successful take-ons',s:'Take-ons'},{k:'pc',l:'Progressive carries',s:'Carries'},{k:'tkic',l:'Tackles + interceptions',s:'Tackles + int.'}];
function homeVsHtml(c,a,b){
 const met=HCMP.map(x=>{const M=HOME_RULES.metrics.find(m=>m.k===x.k);return [x.l,M.f(a),M.f(b)]});
 return `<div class="hvs"><div class="hvh">${hAvatar(a.id,a.n,a.club,true)}<div><a href="${hPl(a.id,a.club)}"><b>${esc(a.n)}</b></a><div class="mu hcl">${hCrest(a.club)}<span>${esc(a.club)}</span></div><div class="mu">${a.p?`<span>${esc(a.p)}</span> · `:''}<span>${Math.round(a.s.mi)} min</span></div></div></div>
  <div class="hvvs">vs</div><div class="hvh r">${hAvatar(b.id,b.n,b.club,true)}<div><a href="${hPl(b.id,b.club)}"><b>${esc(b.n)}</b></a><div class="mu hcl">${hCrest(b.club)}<span>${esc(b.club)}</span></div><div class="mu">${b.p?`<span>${esc(b.p)}</span> · `:''}<span>${Math.round(b.s.mi)} min</span></div></div></div></div>
  <div class="hvgrid">${hRadar(c,a,b)}<div class="hrows">${met.map(([l,x,y])=>{const mx=Math.max(x||0,y||0)||1,w=x!=null&&y!=null&&x!==y?(x>y?'a':'b'):'';
   return `<div class="hrow"><b class="${w==='a'?'win':''}">${hF(x)}</b><span class="hbx l"><i style="width:${((x||0)/mx*100).toFixed(0)}%"></i></span><span class="hlab">${esc(l)}</span><span class="hbx"><i style="width:${((y||0)/mx*100).toFixed(0)}%"></i></span><b class="${w==='b'?'win':''}">${hF(y)}</b></div>`}).join('')}</div></div>
  <p class="mu hnote"><span>Per 90 minutes, season so far.</span> ${hPosOk(c)?(a.p&&a.p===b.p?'<span>Both play in the same position, so the radar compares each with that position only.</span>':'<span>These two play in different positions, so the radar compares each with every outfield player; read it with care.</span>'):'<span>The data has no positions, so the defaults come from the same leaderboard; a striker and a defender are not like for like.</span>'}</p>
  <button class="s" onclick="homeToLab()">Compare in detail</button>`;
}
function homeVsPick(){const c=HOME.c;if(!c||!c.q)return;const a=c.q.find(x=>x.id===$('#hva').value),b=c.q.find(x=>x.id===$('#hvb').value);if(a&&b){HOME.vs=[a.id,b.id];$('#hvbody').innerHTML=homeVsHtml(c,a,b)}}
function homeToLab(){const c=HOME.c,v=HOME.vs;if(!c||!v)return;CMP=v.map(id=>{const a=c.q.find(x=>x.id===id);return encodeURIComponent(a.id+'||'+a.club)});CLC={};location.hash='#/compare'}
function homeVs(c){
 if(!c.q||c.q.length<10)return '';const M=HOME_RULES.metrics.find(m=>m.k==='npxg'),N=HOME_RULES.metrics.find(m=>m.k==='xag');
 const idx=a=>{const x=M.f(a),y=N.f(a);return x==null||y==null?null:x+y},L=c.q.filter(a=>idx(a)!=null).sort((a,b)=>idx(b)-idx(a));if(L.length<2)return '';
 const L2=hPosOk(c)&&L[0].p?L.filter(a=>a.p===L[0].p):L,B0=(L2.length>1?L2:L)[1];
 HOME.vs=HOME.vs&&HOME.vs.every(id=>c.q.some(x=>x.id===id))?HOME.vs:[L[0].id,B0.id];const A=c.q.find(x=>x.id===HOME.vs[0]),B=c.q.find(x=>x.id===HOME.vs[1]);
 const opts=sel=>[...c.q].sort((a,b)=>a.n.localeCompare(b.n)).map(a=>`<option value="${esc(a.id)}"${a.id===sel?' selected':''}>${esc(a.n)} · ${esc(a.club)}${a.p?' · '+esc(a.p):''}</option>`).join('');
 return `<section class="hsec"><div class="hhd"><h2>Who is better?</h2><span class="mu">${hPosOk(c)?'The two highest in xG + xAG per 90 in the same position, or any two you choose':'The two highest in xG + xAG per 90, or any two you choose'}</span></div>
  <div class="hcard hvc"><div class="ctl hvsel"><select id="hva" aria-label="Player 1" onchange="homeVsPick()">${opts(A.id)}</select><select id="hvb" aria-label="Player 2" onchange="homeVsPick()">${opts(B.id)}</select></div><div id="hvbody">${homeVsHtml(c,A,B)}</div></div></section>`;
}

/* ---------- 5. Fantasy radar (Premier League only), loaded when it scrolls into view ---------- */
async function homeFpl(el){
 let d=null;try{d=await labData()}catch(e){}if(!d||!d.P){el.innerHTML='';return}
 const fin=d.events.filter(e=>e.fin).length,P=d.P.filter(p=>(labN(p.minutes)||0)>=HOME_RULES.minMin&&p.now_cost>0),row=p=>`<b>${esc(p.wn)}</b> <span class="mu">${esc(p.tn)} · ${LAB_POS[p.ty]} <span>· £${(p.now_cost/10).toFixed(1)}m</span></span>`;
 const ppm=p=>labN(p.total_points)/(p.now_cost/10),val=[...P].sort((a,b)=>ppm(b)-ppm(a)).slice(0,5);
 const xgi=p=>((labN(p.expected_goals)||0)+(labN(p.expected_assists)||0))/labN(p.minutes)*90,ppg=p=>labN(p.points_per_game);
 const ppgs=P.map(ppg).filter(x=>x!=null).sort((a,b)=>a-b),med=ppgs[Math.floor(ppgs.length/2)];
 const und=[...P].filter(p=>ppg(p)!=null&&ppg(p)<=med).sort((a,b)=>xgi(b)-xgi(a)).slice(0,5);
 const T=Object.values(d.track.gws||{}).filter(t=>Date.parse(t.dl)>Date.now()).sort((a,b)=>a.gw-b.gw)[0];
 const pr=T&&T.preds?d.P.filter(p=>fpOk(T.preds[String(p.id)])).sort((a,b)=>T.preds[String(b.id)]-T.preds[String(a.id)]).slice(0,5):[];
 const card=(k,t,sub,rows,cell,note)=>`<div class="hcard hfpl"><div class="hk">${k}</div><div class="hcl2">${t}</div><div class="mu hsub">${sub}</div><ol class="hlist">${rows.map(p=>`<li>${row(p)}<b>${cell(p)}</b></li>`).join('')}</ol>${note?`<div class="mu hnote">${note}</div>`:''}</div>`;
 el.innerHTML=`<div class="hhd"><h2>Fantasy radar</h2><span class="mu">Official FPL data · ${fin} <span>gameweeks finished</span></span></div><div class="hgrid">`+
  card('<span class="htag act">Actual</span>','Points per £1m','Official FPL points this season ÷ price, players with 450+ minutes',val,p=>hF(ppm(p),1))+
  card('<span class="htag act">Actual</span>','Underlying numbers ahead of points','Highest xG + xA per 90 among players at or below the median points per game ('+hF(med,1)+')',und,p=>hF(xgi(p),2)+' <span class="mu">· <span>'+hF(ppg(p),1)+' ppg</span></span>','Strong chances without the points yet; it can go either way.')+
  (pr.length?card('<span class="htag pred">Prediction</span>','Highest predicted points, Gameweek '+T.gw,'The site\'s model before the deadline; not official points and not guaranteed',pr,p=>hF(T.preds[String(p.id)],1)):'')+
  `</div><p class="hnote"><a href="#/fantasy">Fantasy</a> · <a href="#/lab">Intelligence Lab</a></p>`;
}

/* ---------- 6. quick rankings ---------- */
function homeRank(c,k){
 const box=document.getElementById('hrk');if(!box||!c.q)return;HOME.rk=k;const rp=hPosOk(c)?HOME.rp:'',M=HOME_RULES.metrics.find(m=>m.k===k),L=c.q.filter(a=>!rp||a.p===rp).map(a=>[a,M.f(a)]).filter(x=>x[1]!=null).sort((a,b)=>b[1]-a[1]);
 document.querySelectorAll('#hrkc button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));document.querySelectorAll('#hrkp button').forEach(b=>b.classList.toggle('on',b.dataset.p===rp));
 box.innerHTML=`<ol class="hrank">${L.slice(0,5).map(([a,v],i)=>`<li><span class="hrn">${i+1}</span>${hAvatar(a.id,a.n,a.club)}<a href="${hPl(a.id,a.club)}" class="hrp"><b>${esc(a.n)}</b><span class="mu">${esc(a.club)}</span><span class="hrb"><i style="width:${Math.max(2,v/(L[0][1]||1)*100).toFixed(1)}%"></i></span></a><b class="hrv">${hF(v)}</b>${i<4&&L[i+1]?`<span class="mu hrg">+${hF(v-L[i+1][1])}</span>`:'<span class="hrg"></span>'}</li>`).join('')}</ol>
  <details class="hfull"><summary>Show all ${L.length} players</summary>${tbl([['#',1],['Player'],['Club'],['Minutes',1],['Per 90',1]],L.map(([a,v],i)=>[i+1,`<a href="${hPl(a.id,a.club)}">${esc(a.n)}</a>`,esc(a.club),Math.round(a.s.mi),hF(v)]))}</details>
  <p class="mu hnote">Per 90 minutes, ${HOME_RULES.minMin}+ minutes this season; the gap is to the next player.</p>`;
}
function homeRankPos(p){HOME.rp=p;homeRank(HOME.c,HOME.rk||'sca')
}
function homeRanks(c){
 if(!c.q||c.q.length<10)return '';
 return `<section class="hsec"><div class="hhd"><h2>Quick rankings</h2><span class="mu">Per 90 · ${c.q.length} <span>players with</span> ${HOME_RULES.minMin}+ <span>minutes</span></span></div>
  <div class="hcard">${hPosOk(c)?`<div class="seg hchips" id="hrkp">${[['','All positions'],['DF','Defenders'],['MF','Midfielders'],['FW','Forwards']].map(([p,l])=>`<button data-p="${p}" onclick="homeRankPos('${p}')">${l}</button>`).join('')}</div>`:''}<div class="seg hchips" id="hrkc">${HOME_RULES.metrics.map(M=>`<button data-k="${M.k}" onclick="homeRank(HOME.c,'${M.k}')">${esc(M.l)}</button>`).join('')}</div><div id="hrk"></div></div></section>`;
}

/* ---------- 7. the way into the detailed pages ---------- */
function homeHub(){
 const L=[['players','Players','Every player, sortable by xT and xG'],['compare','Comparison Lab',typeof CL_LIM==='object'?'Up to '+CL_LIM.p+' players or '+CL_LIM.t+' teams, side by side':'Players or teams, side by side'],['rankings','Rankings','Leaderboards by measure'],['shots','Shots','Every shot on the pitch, with xG'],['passing','Passing','Pass networks and progression'],['defense','Defensive','Duels, tackles, pressing'],['heatmaps','Heatmaps','Where players and teams act, match by match'],['table','League table','Points, goal difference and xG difference'],['fantasy','Fantasy','Predictions, Optimal XI, backtests'],['lab','Intelligence Lab','Your predictions against the model']].filter(([k])=>PAGES.some(p=>p[0]===k));
 return `<section class="hsec"><div class="hhd"><h2>Stats centre</h2><span class="mu">All the data, page by page</span></div><div class="hhub">${L.map(([k,t,d])=>`<a class="hcard hhb" href="#/${k}"><b>${esc(t)}</b><span class="mu">${esc(d)}</span></a>`).join('')}</div></section>`;
}

/* ---------- putting it on the overview ---------- */
async function homeMount(){
 const app=document.getElementById('app');if(!app||uiPage()!=='overview'||document.getElementById('home'))return;const h2=app.querySelector('h2');if(!h2)return;
 const home=document.createElement('div');home.id='home';home.innerHTML='<div class="empty skel">Loading…</div>';h2.after(home);
 let c=null;try{c=await homeData()}catch(e){}
 if(!document.body.contains(home))return;
 if(!c||!c.last){home.remove();return}
 if(typeof labDiscCalc==='function'&&!c.luck){try{c.luck=await labDiscCalc()}catch(e){c.luck=[]}}
 if(!document.body.contains(home))return;
 const S=homeStories(c),hero=S[0],more=S.slice(1,3);
 home.innerHTML=(hero?`<section class="hsec hhero-s"><div class="hhd"><h2>Discovery of the round</h2><span class="mu nw">${esc(D.name)} · <span>up to</span> ${esc(c.last)}</span></div>
   <div class="hhero"><div class="hmcol"><a class="hcard hmain" href="${hero.link}">${hero.a?hAvatar(hero.a.id,hero.a.n,hero.a.club,true):hCrest(hero.club)}<div>${hStory(hero)}</div></a>${homeWhy(hero)}</div>
   ${more.length?`<div class="hmore">${more.map(s=>`<a class="hcard hside" href="${s.link}">${hStory(s)}</a>`).join('')}</div>`:''}</div></section>`:'')+
  homeStars(c)+homeClubs(c)+homeVs(c)+(/premier league/i.test(D.name)&&ALL.fpl&&ALL.fpl.file?'<section class="hsec" id="hfpl"></section>':'')+homeRanks(c)+homeHub()+
  `<div class="hhd hold"><h2>Data and this week</h2><span class="mu">What the data covers, and the week's highlights</span></div>`;
 if(c.q)homeRank(c,HOME.rk||'sca');
 const fc=document.getElementById('favcard'),hs=home.querySelector('.hhero-s');if(fc&&hs)hs.after(fc);
 const fp=document.getElementById('hfpl');if(fp){const go=()=>homeFpl(fp);if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();go()}},{rootMargin:'300px'});io.observe(fp)}else go()}
}
(function(){const app=document.getElementById('app');if(app)new MutationObserver(()=>{if(uiPage()==='overview'&&!document.getElementById('home'))setTimeout(homeMount,0)}).observe(app,{childList:true})})();
