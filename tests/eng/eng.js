/* ===== Overview "This week" highlights + fact of the day, and the League table with a season replay =====
   Everything comes from the loaded league data (matches, player stats, shots); nothing is invented. "This week" = the 7 days
   ending at the league's latest match in the data. */
const WK_GOAL={x:105,y:34};
const wkDist=s=>Math.hypot(WK_GOAL.x-s.x,WK_GOAL.y-s.y);
const wkSc=s=>{const m=/^(\d+)\s*-\s*(\d+)$/.exec(String(s||''));return m?[+m[1],+m[2]]:null};
const wkEv={Goal:'scored',Miss:'missed',AttemptSaved:'saved',Post:'hit the post'};
const wkPl=(key,club,name)=>`<a href="#/player/${encodeURIComponent(key+'||'+club)}">${esc(name)}</a>`;
const wkMl=id=>{const m=D.matches.find(x=>x.match_id===id);return m?mlink(m):''};
/* shots: per match and team, xG without own goals; goals from the score */
function wkTeamXg(sh){const o=new Map();for(const s of sh){if(s.og)continue;const k=s.m+'|'+s.c;o.set(k,(o.get(k)||0)+(fpOk(s.xg)?s.xg:0))}return o}
async function wkHL(el){
 if(!el||!D||!D.matches.length)return;
 const sh=await loadSh().catch(()=>null),S=sh?sh.rows:[];
 const fin=D.matches.filter(m=>wkSc(m.score)&&m.date),last=fin.map(m=>m.date.slice(0,10)).sort().pop();if(!last){el.innerHTML='';return}
 const from=new Date(Date.parse(last+'T00:00:00Z')-6*864e5).toISOString().slice(0,10),inW=new Set(fin.filter(m=>m.date.slice(0,10)>=from).map(m=>m.match_id));
 const W=S.filter(s=>inW.has(s.m)),cards=[];
 /* biggest chance (penalties excluded: they are all about the same xG) */
 const ch=W.filter(s=>s.st!=='Penalty'&&!s.og&&fpOk(s.xg)).sort((a,b)=>b.xg-a.xg)[0];
 if(ch)cards.push({k:'Biggest chance (no penalties)',v:'xG '+ch.xg.toFixed(2),t:`${esc(ch.pn)} <span class="mu">(${esc(ch.c)})</span><br><span>${wkEv[ch.ev]||esc(ch.ev)}, ${Math.round(wkDist(ch))} metres from goal</span>`,m:ch.m});
 /* longest-range goal */
 const lg=W.filter(s=>s.ev==='Goal'&&!s.og&&s.st!=='Penalty'&&fpOk(s.x)&&fpOk(s.y)).sort((a,b)=>wkDist(b)-wkDist(a))[0];
 if(lg)cards.push({k:'Longest-range goal',v:Math.round(wkDist(lg))+' metres',t:`${esc(lg.pn)} <span class="mu">(${esc(lg.c)})</span><br><span>xG ${fpOk(lg.xg)?lg.xg.toFixed(2):'N/A'}</span>`,m:lg.m});
 /* most threatening single-match performance (xT) */
 const xt=D.stats.filter(s=>inW.has(s.match_id)&&fpOk(s.xt)).sort((a,b)=>b.xt-a.xt)[0];
 if(xt)cards.push({k:'Most threatening performance',v:'xT '+xt.xt.toFixed(2),t:`${wkPl(xt.key,xt.club,xt.player)} <span class="mu">(${esc(xt.club)})</span>`,m:xt.match_id});
 /* finishing above expectation over the week (goals − xG from his shots) */
 const fp=new Map();W.forEach(s=>{if(s.og||!s.pid)return;const o=fp.get(s.pid)||{n:s.pn,c:s.c,g:0,x:0};o.g+=s.ev==='Goal'?1:0;o.x+=fpOk(s.xg)?s.xg:0;fp.set(s.pid,o)});
 const cl=[...fp.values()].filter(o=>o.g>0).sort((a,b)=>(b.g-b.x)-(a.g-a.x))[0];
 if(cl)cards.push({k:'Most clinical',v:'+'+(cl.g-cl.x).toFixed(2),t:`${esc(cl.n)} <span class="mu">(${esc(cl.c)})</span><br><span>${cl.g} goal${cl.g>1?'s':''} from xG ${cl.x.toFixed(2)}</span>`});
 /* the result that went most against the chances */
 if(S.length){const tx=wkTeamXg(W);let best=null;
  fin.filter(m=>inW.has(m.match_id)).forEach(m=>{const g=wkSc(m.score),xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null||g[0]===g[1])return;
   const w=g[0]>g[1]?0:1,gap=(w?xh-xa:xa-xh);if(gap>0&&(!best||gap>best.gap))best={m,gap,w,xh,xa}});
  if(best)cards.push({k:'Won against the chances',v:'xG '+(best.w?best.xa:best.xh).toFixed(1)+' v '+(best.w?best.xh:best.xa).toFixed(1),t:`<b>${esc(best.w?best.m.away:best.m.home)}</b> <span>won with less xG</span>`,m:best.m.match_id})}
 const facts=wkFacts(S);
 const day=Math.floor(Date.now()/864e5),fact=facts.length?facts[day%facts.length]:null;
 el.innerHTML=`<h3>This week <span class="mu" style="font-size:12px;font-weight:400">${esc(from)} – ${esc(last)}, ${inW.size} matches</span></h3>`+
  (fact?`<div class="card wkfact"><div class="mu" style="font-size:12px">Fact of the day</div><div style="font-size:16px;margin-top:4px">${fact}</div></div>`:'')+
  (cards.length?`<div class="wkg">${cards.map(c=>`<div class="kpi wkc"><span>${esc(c.k)}</span><b>${esc(c.v)}</b><div style="font-size:13px;margin-top:4px">${c.t}</div>${c.m?`<div class="mu" style="font-size:12px;margin-top:4px">${wkMl(c.m)}</div>`:''}</div>`).join('')}</div>`:'<div class="empty">No shot data for these matches.</div>');
}
/* season facts from the data; one is shown per day */
function wkFacts(S){
 const out=[],fin=D.matches.filter(m=>wkSc(m.score));if(!fin.length)return out;
 const A=agg().filter(p=>(p.minutes||0)>=270);
 const top=(k,lab,d)=>{const p=[...A].filter(x=>fpOk(x[k+'90'])).sort((a,b)=>b[k+'90']-a[k+'90'])[0];if(p)out.push(`${wkPl(p.key,p.club,p.player)} <span class="mu">(${esc(p.club)})</span> <span>has the league's highest ${lab} per 90 this season:</span> <b>${p[k+'90'].toFixed(d)}</b> <span>(at least 270 minutes)</span>`)};
 top('xt','xT',3);top('xg','xG',2);
 const tm=new Map(),tx=wkTeamXg(S);fin.forEach(m=>{const g=wkSc(m.score);[[m.home,g[0],g[1],m.away],[m.away,g[1],g[0],m.home]].forEach(([t,f,a,o])=>{const r=tm.get(t)||{t,f:0,a:0,xf:0,xa:0,n:0,nx:0};r.f+=f;r.a+=a;r.n++;
  const xf=tx.get(m.match_id+'|'+t),xa=tx.get(m.match_id+'|'+o);if(xf!=null&&xa!=null){r.xf+=xf;r.xa+=xa;r.nx++}tm.set(t,r)})});
 const T=[...tm.values()].filter(r=>r.nx>=3);
 if(T.length){const a=[...T].sort((x,y)=>y.xf/y.nx-x.xf/x.nx)[0];out.push(`<b>${esc(a.t)}</b> create the most chances in the league: <b>${(a.xf/a.nx).toFixed(2)}</b> xG a match`);
  const b=[...T].sort((x,y)=>x.xa/x.nx-y.xa/y.nx)[0];out.push(`<b>${esc(b.t)}</b> allow the fewest chances: <b>${(b.xa/b.nx).toFixed(2)}</b> xG against a match`);
  const c=[...T].sort((x,y)=>((y.f-y.xf)-(x.f-x.xf)))[0];if(c.f-c.xf>0)out.push(`<b>${esc(c.t)}</b> have scored <b>${(c.f-c.xf).toFixed(1)}</b> goals more than their xG this season (${c.f} goals from ${c.xf.toFixed(1)} xG)`);
  const e=[...T].sort((x,y)=>((x.f-x.xf)-(y.f-y.xf)))[0];if(e.f-e.xf<0)out.push(`<b>${esc(e.t)}</b> have scored <b>${(e.xf-e.f).toFixed(1)}</b> goals fewer than their xG this season (${e.f} goals from ${e.xf.toFixed(1)} xG)`)}
 const hm=[...fin].sort((a,b)=>{const x=wkSc(a.score),y=wkSc(b.score);return (y[0]+y[1])-(x[0]+x[1])||String(b.date).localeCompare(String(a.date))})[0],hg=wkSc(hm.score);
 if(hg[0]+hg[1]>=5)out.push(`The highest-scoring match of the season so far: ${mlink(hm)} (${hg[0]+hg[1]} goals)`);
 const lg=S.filter(s=>s.ev==='Goal'&&!s.og&&s.st!=='Penalty'&&fpOk(s.x)).sort((a,b)=>wkDist(b)-wkDist(a))[0];
 if(lg)out.push(`<span>The longest-range goal of the season:</span> <b>${Math.round(wkDist(lg))} metres</b>, ${esc(lg.pn)} <span class="mu">(${esc(lg.c)})</span>, ${wkMl(lg.m)}`);
 return out;
}

/* ---------- League table ---------- */
const LT={step:null,play:null,key:''};
/* a single table only fits a league: every pair meets at most twice and teams have played about as many games */
function ltOk(M){const pr=new Map(),n=new Map();M.forEach(m=>{const k=[m.home,m.away].sort().join('|');pr.set(k,(pr.get(k)||0)+1);n.set(m.home,(n.get(m.home)||0)+1);n.set(m.away,(n.get(m.away)||0)+1)});
 const c=[...n.values()];return c.length>=6&&Math.max(...pr.values())<=2&&Math.max(...c)-Math.min(...c)<=3}
function ltTable(M,tx){
 const T=new Map(),row=t=>{let r=T.get(t);if(!r){r={t,p:0,w:0,d:0,l:0,f:0,a:0,pts:0,xf:0,xa:0,nx:0,form:[]};T.set(t,r)}return r};
 [...M].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.match_id).localeCompare(String(b.match_id))).forEach(m=>{const g=wkSc(m.score);if(!g)return;
  [[m.home,g[0],g[1],m.away],[m.away,g[1],g[0],m.home]].forEach(([t,f,a,o])=>{const r=row(t);r.p++;r.f+=f;r.a+=a;const res=f>a?'W':f<a?'L':'D';r[res.toLowerCase()]++;r.pts+=f>a?3:f===a?1:0;r.form.push(res);
   const xf=tx.get(m.match_id+'|'+t),xa=tx.get(m.match_id+'|'+o);if(xf!=null&&xa!=null){r.xf+=xf;r.xa+=xa;r.nx++}})});
 return [...T.values()].sort((a,b)=>b.pts-a.pts||(b.f-b.a)-(a.f-a.a)||b.f-a.f||a.t.localeCompare(b.t));
}
R.table=async function(el){
 el.innerHTML='<h2>League table</h2><div id="ltroot"><div class="empty">Loading…</div></div>';
 const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),M=D.matches.filter(m=>wkSc(m.score)&&m.date),root=$('#ltroot');
 if(!M.length){root.innerHTML='<div class="empty">No results in the data yet.</div>';return}
 if(!ltOk(M)){root.innerHTML=`<div class="empty">${esc(D.name)} is a tournament (groups and knockout rounds), so it has no single league table.</div>`;return}
 const dates=[...new Set(M.map(m=>m.date.slice(0,10)))].sort(),key=D.id+'|'+dates.length;
 if(LT.key!==key){LT.key=key;LT.step=dates.length-1;ltStop()}
 root.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:8px"><b>${esc(D.name)}</b><span>, results in the data (${M.length} matches). Ordered by points, then goal difference, then goals scored; a competition's own tiebreakers (such as head-to-head) can differ. xGD = xG for − xG against, from the shot data.</span></div>
 <div class="ctl" style="align-items:center"><button id="ltplay" class="s" onclick="ltToggle()">▶ Replay the season</button><input id="ltrng" type="range" min="0" max="${dates.length-1}" value="${LT.step}" style="flex:1;min-width:140px" aria-label="Date"><span id="ltlab" class="mu" style="min-width:150px"></span></div>
 <div id="lt" class="lt"></div>`;
 LT.M=M;LT.dates=dates;LT.tx=tx;
 $('#ltrng').oninput=e=>{ltStop();ltGo(+e.target.value,true)};
 ltGo(LT.step,false);
};
function ltGo(step,anim){
 const el=$('#lt');if(!el)return;LT.step=step;const d=LT.dates[step],M=LT.M.filter(m=>m.date.slice(0,10)<=d),prev=step>0?ltTable(LT.M.filter(m=>m.date.slice(0,10)<=LT.dates[step-1]),LT.tx):null;
 const rows=ltTable(M,LT.tx),pp=new Map((prev||[]).map((r,i)=>[r.t,i])),old=new Map();
 el.querySelectorAll('.ltr[data-t]').forEach(x=>old.set(x.dataset.t,x.getBoundingClientRect().top));
 const nGames=M.length,fm=f=>f.slice(-5).map(r=>`<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`).join('');
 el.innerHTML=`<div class="ltr lth"><span>#</span><span>Team</span><span class="ltl" data-en="P" data-ar="لعب" title="Played"></span><span class="ltx ltl" data-en="W" data-ar="ف" title="Win"></span><span class="ltx ltl" data-en="D" data-ar="ت" title="Draw"></span><span class="ltx ltl" data-en="L" data-ar="خ" title="Loss"></span><span>GD</span><span>Pts</span><span class="ltx">xGD</span><span class="ltfm">Form</span></div>`+
  rows.map((r,i)=>{const mv=prev&&pp.has(r.t)?pp.get(r.t)-i:0;return `<div class="ltr" data-t="${esc(r.t)}"><span>${i+1}${mv?`<em class="ltm ${mv>0?'up':'dn'}">${mv>0?'▲':'▼'}${Math.abs(mv)}</em>`:''}</span><span class="ltt">${esc(r.t)}</span><span>${r.p}</span><span class="ltx">${r.w}</span><span class="ltx">${r.d}</span><span class="ltx">${r.l}</span><span>${r.f-r.a>0?'+':''}${r.f-r.a}</span><b>${r.pts}</b><span class="ltx">${r.nx?((r.xf-r.xa>0?'+':'')+(r.xf-r.xa).toFixed(1)):'N/A'}</span><span class="ltfm">${fm(r.form)}</span></div>`}).join('');
 $('#ltlab').textContent=`After ${d} (${nGames} matches)`;const rg=$('#ltrng');if(rg&&+rg.value!==step)rg.value=step;
 /* FLIP: each row slides from where it was to its new place (transform only, so it stays smooth on phones) */
 if(anim&&old.size&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.querySelectorAll('.ltr[data-t]').forEach(x=>{const o=old.get(x.dataset.t);if(o==null)return;const dy=o-x.getBoundingClientRect().top;if(Math.abs(dy)>1)x.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:560,easing:'cubic-bezier(.2,.8,.2,1)'})});
}
function ltStop(){if(LT.play){clearInterval(LT.play);LT.play=null}const b=$('#ltplay');if(b)b.textContent='▶ Replay the season'}
function ltToggle(){
 if(LT.play){ltStop();return}
 const b=$('#ltplay');if(b)b.textContent='❚❚ Pause';if(LT.step>=LT.dates.length-1)ltGo(0,false);
 LT.play=setInterval(()=>{if(!$('#lt')){ltStop();return}if(LT.step>=LT.dates.length-1){ltStop();return}ltGo(LT.step+1,true)},900);
}
