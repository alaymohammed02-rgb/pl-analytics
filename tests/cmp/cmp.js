/* ===== Competitions: European places, title holders, upcoming fixtures and tournament tables =====
   data/europe.json (sync): this season's clubs in the Champions League, Europa League and Conference League, read from each
   competition's fixture list in PitchAPI (qualifying rounds in July and August left out); data/champions.json: last season's
   winner of every competition, from verified results; data/fixtures.json: the upcoming fixtures of every league.
   Nothing is shown when a file, a season or a name does not match. */
const EURO={p:null,d:null},FIX={p:null,d:null},EURO_SHORT={ucl:'UCL',uel:'UEL',uecl:'UECL'};
const cmpV=()=>encodeURIComponent((ALL&&ALL.generated)||'');
function euroLoad(){if(!EURO.p)EURO.p=fetch('data/europe.json?v='+cmpV()).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{EURO.d=d;return d});return EURO.p}
function fixLoad(){if(!FIX.p)FIX.p=fetch('data/fixtures.json?v='+cmpV()).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{FIX.d=d;return d});return FIX.p}
/* the European competitions a club plays in this season: only for the same season as the league's data, and not the competition
   whose page is open */
function euroComps(){const d=EURO.d,s=D&&curSeason();return d&&d.comps&&s?d.comps.filter(c=>c.season===s&&c.id!==D.id):[]}
const euroOf=name=>euroComps().filter(c=>(c.teams||[]).includes(name));
/* last season's winner of a competition, when champions.json has it for the season being played now */
function holderOf(c){const e=CHAMP.d&&CHAMP.d.leagues&&CHAMP.d.leagues[c.id];return e&&e.team&&e.next===c.season?e:null}
const isHolder=(c,name)=>{const e=holderOf(c);return !!e&&e.team===name};
function euroBadge(c,name,big){
 const h=isHolder(c,name),t=c.label+' '+c.season+(h?' · holders':'');
 return `<span class="eub eub-${c.key}${h?' hold':''}${big?' big':''}" title="${esc(t)}" aria-label="${esc(t)}">${c.logo?`<img src="${c.logo}" alt="">`:`<b>${EURO_SHORT[c.key]||''}</b>`}${big?`<span>${esc(c.label)}</span>${h?`<span class="euh">${thTrophy}<span>Holders</span></span>`:''}`:''}</span>`;
}
const euroMarks=name=>euroOf(name).map(c=>euroBadge(c,name)).join('');
/* what the small marks next to the clubs mean, under the league table */
function euroLegend(M){
 const teams=new Set(M.flatMap(m=>[m.home,m.away])),cs=euroComps().filter(c=>(c.teams||[]).some(t=>teams.has(t))),ch=champInfo();
 if(!cs.length&&!ch)return '';
 return `<div class="eulg mu">${cs.map(c=>`<span class="nw">${euroBadge(c,'')}<span>${esc(c.label)}</span></span>`).join('')}${ch?`<span class="nw"><span class="chm">${thTrophy}</span><span>Defending champions</span></span>`:''}${cs.length?`<span class="nw">${esc(cs[0].season)}</span>`:''}</div>`;
}
const clubComps=name=>{const cs=euroOf(name);return cs.length?`<div class="clubeu">${cs.map(c=>euroBadge(c,name,true)).join('')}</div>`:''};

/* ---------- upcoming fixtures ---------- */
/* the date and kick-off in the viewer's time zone when the data has a time (PitchAPI gives it in UTC) */
function fxWhen(x){
 const m=/(\d{2}):(\d{2})/.exec(String(x.k||''));if(!m)return {d:x.d,t:''};
 const dt=new Date(x.d+'T'+m[1]+':'+m[2]+':00Z');if(isNaN(dt))return {d:x.d,t:''};
 const p=n=>String(n).padStart(2,'0');return {d:`${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`,t:`${p(dt.getHours())}:${p(dt.getMinutes())}`};
}
const fxTeam=n=>`<a class="clk" href="#/club/${encodeURIComponent(n)}">${clubDot(n)}<span>${esc(n)}</span></a>${champMark(n)}${euroMarks(n)}`;
async function fxSection(id,club){
 await Promise.all([fixLoad(),champReady()]);
 const L=((FIX.d&&FIX.d.leagues)||{})[id],head=`<h3>${club?'Next matches':'Upcoming fixtures'}</h3>`;
 if(!L)return club?'':head+'<div class="empty">No fixture list in the data yet.</div>';
 const today=new Date().toISOString().slice(0,10),rows=L.filter(x=>x.d>=today&&(!club||x.h===club||x.a===club)).slice(0,club?5:24);
 if(!rows.length)return club?'':head+'<div class="empty">No upcoming fixtures in the data (the season may be over).</div>';
 const by=new Map();rows.forEach(x=>{const w=fxWhen(x);if(!by.has(w.d))by.set(w.d,[]);by.get(w.d).push([x,w.t])});
 return head+'<div class="fx">'+[...by].map(([d,xs])=>`<div class="fxd"><div class="fxdh">${esc(d)}</div>${xs.map(([x,t])=>`<div class="fxr"><span class="fxh">${fxTeam(x.h)}</span><span class="fxt">${t?esc(t):'–'}</span><span class="fxa">${fxTeam(x.a)}</span></div>`).join('')}</div>`).join('')+
  `</div>${rows.some(x=>fxWhen(x).t)?'<div class="mu" style="font-size:11px;margin-top:4px">Kick-off times in your time zone.</div>':''}`;
}

/* ---------- tournaments: group tables, a league phase, knockout rounds ---------- */
const ltSort=M=>[...M].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.match_id).localeCompare(String(b.match_id)));
/* single round-robin groups and then knockouts (a World Cup): a match is a group match when it is among the first g of both teams;
   the groups are the sets of teams joined by those matches, and every group must be complete (g+1 teams, each played each once) */
function ltGroupsOf(M){
 const S=ltSort(M);
 for(const g of [3,2,4,5]){
  const cnt=new Map(),gm=[],ko=[];
  S.forEach(m=>{const a=cnt.get(m.home)||0,b=cnt.get(m.away)||0;(a<g&&b<g?gm:ko).push(m);cnt.set(m.home,a+1);cnt.set(m.away,b+1)});
  const par=new Map(),f=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x)}return x};
  gm.forEach(m=>{[m.home,m.away].forEach(t=>{if(!par.has(t))par.set(t,t)});par.set(f(m.home),f(m.away))});
  const G=new Map();gm.forEach(m=>{const r=f(m.home);if(!G.has(r))G.set(r,[]);G.get(r).push(m)});
  const groups=[...G.values()];
  if(groups.length>=2&&groups.every(x=>{const T=new Set(x.flatMap(m=>[m.home,m.away]));return T.size===g+1&&x.length===g*(g+1)/2&&new Set(x.map(m=>[m.home,m.away].sort().join('|'))).size===x.length}))
   return {groups,ko};
 }
 return null;
}
/* one league phase and then two-legged ties (the Champions League after January): the phase is the longest run of match days
   after which every club has played the same number of games, before any pairing repeats */
function ltPhaseOf(M){
 const S=ltSort(M),days=[...new Set(S.map(m=>m.date.slice(0,10)))],pairs=new Set(),cnt=new Map();let end=null;
 for(const d of days){
  const day=S.filter(m=>m.date.slice(0,10)===d);if(day.some(m=>pairs.has([m.home,m.away].sort().join('|'))))break;
  day.forEach(m=>{pairs.add([m.home,m.away].sort().join('|'));cnt.set(m.home,(cnt.get(m.home)||0)+1);cnt.set(m.away,(cnt.get(m.away)||0)+1)});
  const c=[...cnt.values()];if(c.length>=6&&Math.min(...c)===Math.max(...c))end=d;
 }
 if(!end)return null;const phase=S.filter(m=>m.date.slice(0,10)<=end),ko=S.filter(m=>m.date.slice(0,10)>end);
 return ko.length&&ltOk(phase)?{phase,ko}:null;
}
function ltStatic(rows){
 const fm=f=>f.slice(-5).map(r=>`<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`).join('');
 return `<div class="lt"><div class="ltr lth"><span>#</span><span>Team</span><span class="ltl" data-en="P" data-ar="لعب" title="Played"></span><span class="ltx ltl" data-en="W" data-ar="ف" title="Win"></span><span class="ltx ltl" data-en="D" data-ar="ت" title="Draw"></span><span class="ltx ltl" data-en="L" data-ar="خ" title="Loss"></span><span>GD</span><span>Pts</span><span class="ltx">xGD</span><span class="ltfm">Form</span></div>`+
  rows.map((r,i)=>`<div class="ltr" data-t="${esc(r.t)}"><span>${i+1}</span><span class="ltt"><a href="#/club/${encodeURIComponent(r.t)}">${clubDot(r.t)}${esc(r.t)}</a>${champMark(r.t)}${euroMarks(r.t)}</span><span>${r.p}</span><span class="ltx">${r.w}</span><span class="ltx">${r.d}</span><span class="ltx">${r.l}</span><span>${r.f-r.a>0?'+':''}${r.f-r.a}</span><b>${r.pts}</b><span class="ltx">${r.nx?((r.xf-r.xa>0?'+':'')+(r.xf-r.xa).toFixed(1)):'N/A'}</span><span class="ltfm">${fm(r.form)}</span></div>`).join('')+'</div>';
}
/* knockout matches by round: a match's round is one more than the knockout games either team had played before it, so rounds
   do not depend on the order of the dates; single matches are named by how many are in the round */
function ltKo(ko,named){
 if(!ko.length)return '';
 const k=new Map(),R=[];ltSort(ko).forEach(m=>{const r=Math.max(k.get(m.home)||0,k.get(m.away)||0);(R[r]=R[r]||[]).push(m);k.set(m.home,r+1);k.set(m.away,r+1)});
 const nm=(r,i)=>{const n=r.length;if(!named)return 'Knockout matches';if(i===R.length-1&&n===2&&i>0&&R[i-1].length===2)return 'Third place and final';
  if(i===R.length-1&&n===1)return 'Final';return n===2?'Semi-finals':n===4?'Quarter-finals':n>=8&&(n&(n-1))===0?'Round of '+2*n:'Knockout matches'};
 const out=[];R.forEach((r,i)=>{if(!r)return;const t=nm(r,i),last=out[out.length-1];if(last&&last[0]===t)last[1].push(...r);else out.push([t,[...r]])});
 return out.map(([t,ms])=>`<h3>${esc(t)}</h3>`+tbl([['Date'],['Match']],ltSort(ms).map(m=>[esc(String(m.date).slice(0,10)),mlink(m)]))).join('');
}
function ltTournament(M,tx,root){
 const g=ltGroupsOf(M);
 if(g){root.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:8px"><b>${esc(D.name)}</b><span>: group tables, worked out from who played whom. The data has no group names, so the groups are numbered in the order of their first match.</span></div>`+
  `<div class="ltgs">${g.groups.sort((a,b)=>String(ltSort(a)[0].date).localeCompare(String(ltSort(b)[0].date))||String(ltSort(a)[0].match_id).localeCompare(String(ltSort(b)[0].match_id))).map((x,i)=>`<div class="ltg"><h3>Group ${i+1}</h3>${ltStatic(ltTable(x,tx))}</div>`).join('')}</div>`+ltKo(g.ko,true);return true}
 const p=ltPhaseOf(M);
 if(p){root.innerHTML=`<div class="mu" style="font-size:12px;margin-bottom:8px"><b>${esc(D.name)}</b><span>: the league phase table, then the knockout matches.</span></div><h3>League phase</h3>${ltStatic(ltTable(p.phase,tx))}`+euroLegend(p.phase)+ltKo(p.ko,false);return true}
 return false;
}
