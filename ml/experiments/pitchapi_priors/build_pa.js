// Builds cross-season priors for a target FPL season from the PREVIOUS Premier League season in PitchAPI (complete season only).
// usage: node build_pa.js <pitchapi season, e.g. 2022-23> <target FPL season, e.g. 2023-24> <out.json> [dir with l_4WFCIZ_<season>*.json]
// Output has the shape of the exp_priors file (d.priors): {players:{<FPL code>:[{ago:1,ty,m,xg,xa,g,a,n,np,n60,mp}]},teams:{<FPL team code>:[{ago:1,A,D,n}]},
//  promoted:{A,D,n}, link:{...coverage}}.
// Players are linked by the site's own rule (fpNz names; full name or web name, else surname + initial), restricted to one PitchAPI
// player; the club is not required to match (transfers). xA = PitchAPI xAG; xG = PitchAPI xG of his shots (penalties included, as
// FPL's xG); minutes, goals and assists from the per-match player rows. n = his clubs' league matches between his first and last
// appearance (PitchAPI rows exist only for players who played).
const fs=require('fs'),path=require('path');
const {load}=require('/home/user/pl-analytics/ml/harness.js');
const [ps,target,out,dir0]=process.argv.slice(2),dir=dir0||'/home/user/pl-analytics/data';
const J=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const L=J(`l_4WFCIZ_${ps}.json`),PL=J(`l_4WFCIZ_${ps}_pl.json`),SH=J(`l_4WFCIZ_${ps}_sh.json`);
const {ev,d}=load(path.join(__dirname,'model_pa.js'),`/home/user/pl-analytics/data/fpl_${target}.json`);
const fpNz=ev('fpNz'),teq=ev('fpTeamEq');
// team id -> name (team_def rows carry the name; else the per-match player clubs)
const tname=new Map();(PL.team||[]).forEach(t=>{if(t.n&&!/^t_/.test(t.n))tname.set(t.i,t.n)});
const ix={};PL.cols.forEach((c,i)=>ix[c]=i);
const done=new Set(L.matches.filter(m=>/^\d+-\d+$/.test(m.s||'')).map(m=>m.i));
if(done.size<(+process.env.MINM||370))throw new Error(`${ps}: only ${done.size} finished matches in the file — the season is not complete`);
const M=new Map(L.matches.map(m=>[m.i,m]));
// players
const P=new Map();
for(const r of PL.rows){if(!done.has(r[ix.m]))continue;const mi=r[ix.mi]||0;if(!(mi>0))continue;
 const k=r[ix.i];let o=P.get(k);if(!o){o={id:k,name:r[ix.n],m:0,xg:0,xa:0,mxa:0,g:0,a:0,np:0,n60:0,first:null,last:null,clubs:new Set()};P.set(k,o)}
 const m=M.get(r[ix.m]),dt=m.d;o.m+=mi;o.xg+=r[ix.xg]||0;if(r[ix.xag]!=null){o.xa+=r[ix.xag];o.mxa+=mi}o.g+=r[ix.gl]||0;o.a+=r[ix.ast]||0;o.np++;if(mi>=60)o.n60++;
 const club=tname.get(r[ix.t])||r[ix.c];o.clubs.add(club);if(!o.first||dt<o.first)o.first=dt;if(!o.last||dt>o.last)o.last=dt}
const clubDates=new Map();L.matches.forEach(m=>{if(!done.has(m.i))return;[m.h,m.a].forEach(c=>{if(!clubDates.has(c))clubDates.set(c,[]);clubDates.get(c).push(m.d)})});
// teams: xG for / against per match from the shots (own goals left out)
const sx={};SH.cols.forEach((c,i)=>sx[c]=i);const tx=new Map();
for(const r of SH.rows){if(!done.has(r[sx.m])||r[sx.og])continue;const club=tname.get(r[sx.tid])||r[sx.c];const k=r[sx.m]+'|'+club;tx.set(k,(tx.get(k)||0)+(r[sx.xg]||0))}
const T=new Map();let sum=0,nn=0;
for(const m of L.matches){if(!done.has(m.i))continue;const a=tx.get(m.i+'|'+m.h)||0,b=tx.get(m.i+'|'+m.a)||0;
 for(const [c,f,g] of [[m.h,a,b],[m.a,b,a]]){const t=T.get(c)||{n:0,f:0,a:0};t.n++;t.f+=f;t.a+=g;T.set(c,t);sum+=f;nn++}}
const mu=sum/nn;
// link to the target FPL season
const res={season:target,from:'PitchAPI '+ps,players:{},teams:{},link:{}};
const byFull=new Map(),add=(k,o)=>{if(!byFull.has(k))byFull.set(k,[]);byFull.get(k).push(o)};
P.forEach(o=>{add(fpNz(o.name),o)});
const all=[...P.values()];
let want=0,got=0;
for(const p of d.P){
 const full=fpNz(p.fn+' '+p.sn),wn=fpNz(p.wn),sn=fpNz(p.sn).split(' ').pop(),fi=fpNz(p.fn).charAt(0);
 let c=[...new Set([...(byFull.get(full)||[]),...(byFull.get(wn)||[])])],hit=null;
 if(c.length===1)hit=c[0];
 else if(!c.length){const c2=all.filter(o=>{const t=fpNz(o.name).split(' ');return t[t.length-1]===sn&&fpNz(o.name).charAt(0)===fi});if(c2.length===1)hit=c2[0]}
 if(!hit||p.code==null)continue;
 const cl=[...hit.clubs];const n=new Set(cl.flatMap(c=>(clubDates.get(c)||[]).filter(x=>x>=hit.first&&x<=hit.last))).size;
 res.players[p.code]=[{ago:1,ty:p.ty,m:hit.m,xg:hit.xg,xa:hit.mxa>0?hit.xa*hit.m/hit.mxa:null,g:hit.g,a:hit.a,n:Math.max(n,hit.np),np:hit.np,n60:hit.n60,mp:hit.m,src:hit.id}];got++;
}
// how many FPL players who played last season in the PL (FPL archive, when we have it) got a PitchAPI prior
const prevF=`/home/user/pl-analytics/data/fpl_${ps}.json`;
if(fs.existsSync(prevF)){const q=JSON.parse(fs.readFileSync(prevF,'utf8')),ci={};q.cols.forEach((c,i)=>ci[c]=i);
 const played=new Set(q.rows.filter(r=>r[ci.minutes]>0).map(r=>r[ci.code]));const tgt=d.P.filter(p=>played.has(p.code));
 res.link.prevFplPlayers=tgt.length;res.link.linked=tgt.filter(p=>res.players[p.code]).length}
res.link.fplPlayers=d.P.length;res.link.withPrior=got;res.link.pitchPlayers=P.size;
d.teams.forEach(t=>{const tn=String(t.n).replace(/^Sheffield Utd$/,"Sheffield United"),k=[...T.keys()].find(c=>teq(tn,c));if(k){const v=T.get(k);res.teams[t.code]=[{ago:1,A:v.f/v.n/mu,D:v.a/v.n/mu,n:v.n,src:k}]}});
res.link.teams=Object.keys(res.teams).length;
// promoted sides: the average ratio of the three relegated sides of the PitchAPI season (fewest points), as exp_priors' fallback
const pts=new Map();L.matches.forEach(m=>{if(!done.has(m.i))return;const [h,a]=m.s.split('-').map(Number);pts.set(m.h,(pts.get(m.h)||0)+(h>a?3:h===a?1:0));pts.set(m.a,(pts.get(m.a)||0)+(a>h?3:h===a?1:0))});
const rel=[...pts].sort((x,y)=>x[1]-y[1]).slice(0,3).map(x=>T.get(x[0]));
res.promoted={A:rel.reduce((s,v)=>s+v.f/v.n/mu,0)/3,D:rel.reduce((s,v)=>s+v.a/v.n/mu,0)/3,n:3,src:'relegated sides of PitchAPI '+ps};
res.mu=mu;
fs.writeFileSync(out,JSON.stringify(res));
console.log(target,'from',ps,JSON.stringify(res.link),'mu',mu.toFixed(3));
