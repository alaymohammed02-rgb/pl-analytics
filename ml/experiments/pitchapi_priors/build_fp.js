// Builds the cross-season prior JSON for a target season from COMPLETE earlier seasons only.
// usage: node build_priors.js <target season> [out.json]
// Output (same shape the live site would publish as data/priors.json):
//  {season, from:[seasons], players:{<player code>:[{ago,ty,m,xg,xa,g,a,bon,yc,rc,og,pmi,psv,sv,dc,n,np,n60,mp}]},
//   teams:{<team code>:[{ago,A,D,n}]}, promoted:{A,D,n,src}}
const fs=require('fs');
const ALL=['2022-23','2023-24','2024-25','2025-26'];
const [target,out]=process.argv.slice(2);
const ti=ALL.indexOf(target);if(ti<0)throw new Error('unknown season '+target);
const load=s=>JSON.parse(fs.readFileSync('/home/user/pl-analytics/data/fpl_'+s+'.json','utf8'));
const ok=v=>typeof v==='number'&&isFinite(v);
// team per-match xG for/against (team of a hist row = the side opposite `opp` in fixture of round r)
function teamStats(d){
 const H=d.hcols.reduce((m,c,i)=>(m[c]=i,m),{});const tcode=new Map(d.teams.map(t=>[t.id,t.code]));
 const fx=new Map();for(const x of d.fix){fx.set(x[0]+'|'+x[1]+'|h',x);fx.set(x[0]+'|'+x[2]+'|a',x)}
 const xg=new Map();// key r|team|opp -> xg
 // rounds whose per-match xG was not recorded (2022-23 rounds 1-14 carry xg=0 for everyone) are skipped
 const rx={};for(const rows of Object.values(d.hist))for(const r of rows)if(ok(r[H.xg]))rx[r[H.r]]=(rx[r[H.r]]||0)+r[H.xg];
 for(const rows of Object.values(d.hist))for(const r of rows){if(!(r[H.min]>0)||!ok(r[H.xg])||!(rx[r[H.r]]>0))continue;
  const opp=r[H.opp],h=r[H.h];const x=fx.get(r[H.r]+'|'+opp+'|'+(h===1?'a':'h'));if(!x)continue;const tm=h===1?x[1]:x[2];
  const k=r[H.r]+'|'+tm+'|'+opp;xg.set(k,(xg.get(k)||0)+r[H.xg])}
 const T=new Map();let s=0,n=0;
 for(const [k,v] of xg){const [r,tm,opp]=k.split('|');const q=xg.get(r+'|'+opp+'|'+tm);if(q==null)continue;
  let t=T.get(+tm);if(!t)T.set(+tm,t={n:0,f:0,a:0});t.n++;t.f+=v;t.a+=q;s+=v;n++}
 const mu=s/n,res={};T.forEach((t,id)=>{res[tcode.get(id)]={A:t.f/t.n/mu,D:t.a/t.n/mu,n:t.n}});return {mu,teams:res};
}
function playerStats(d){
 const C=d.cols.reduce((m,c,i)=>(m[c]=i,m),{}),H=d.hcols.reduce((m,c,i)=>(m[c]=i,m),{});const res={};
 const F={m:'minutes',xg:'expected_goals',xa:'expected_assists',g:'goals_scored',a:'assists',bon:'bonus',yc:'yellow_cards',rc:'red_cards',og:'own_goals',pmi:'penalties_missed',psv:'penalties_saved',sv:'saves',dc:'defensive_contribution'};
 for(const row of d.rows){const o={ty:row[C.ty]};for(const k in F){const v=row[C[F[k]]];o[k]=ok(v)?v:null}
  if(!(o.m>0))continue;
  const h=(d.hist[String(row[C.id])]||[]).filter(r=>ok(r[H.min]));o.n=h.length;o.np=h.filter(r=>r[H.min]>0).length;o.n60=h.filter(r=>r[H.min]>=60).length;o.mp=h.reduce((s,r)=>s+r[H.min],0);
  res[row[C.code]]=o}
 return res;
}
const prev=ALL.slice(0,ti).reverse();// most recent first
const P={},T={},cur=load(target);
const seasonTeams=s=>new Set(load(s).teams.map(t=>t.code));
prev.forEach((s,i)=>{const d=load(s),ps=playerStats(d),ts=teamStats(d).teams;
 for(const c in ps)(P[c]=P[c]||[]).push(Object.assign({ago:i+1},ps[c]));
 for(const c in ts)(T[c]=T[c]||[]).push(Object.assign({ago:i+1},ts[c]))});
// promoted-side prior: first PL season of promoted sides in earlier completed seasons that have a predecessor;
// fallback (no such season): the sides relegated from the previous season (they are what promoted sides replace).
let pool=[],src='';
for(let j=1;j<ti;j++){const a=seasonTeams(ALL[j-1]),ts=teamStats(load(ALL[j])).teams;for(const c in ts)if(!a.has(+c))pool.push(ts[c])}
if(pool.length)src='promoted sides, first season';
else if(ti>0){const nowT=new Set(cur.teams.map(t=>t.code)),ts=teamStats(load(ALL[ti-1])).teams;for(const c in ts)if(!nowT.has(+c))pool.push(ts[c]);src='relegated sides of previous season'}
const avg=k=>pool.reduce((s,t)=>s+t[k],0)/pool.length;
const res={season:target,from:prev,players:P,teams:T,promoted:pool.length?{A:avg('A'),D:avg('D'),n:pool.length,src}:null};
const js=JSON.stringify(res);if(out)fs.writeFileSync(out,js);
console.log(target,'from',prev.join(',')||'-','players',Object.keys(P).length,'teams',Object.keys(T).length,'promoted',JSON.stringify(res.promoted),'bytes',js.length);
