/* ===== Elo kit (INS.eloKit): the Club Elo of sync.py el2_run, ported once for the pages that need ratings from data/results.json =====
   The same K, home advantage, goal-difference multiplier, 10% pull to the league mean at each new season (from 1 July), new clubs on the league mean, and ordered
   logit (s, c) as the Time machine, the League heartbeat and the Run-in page, which each keep their own copy. This one is shared by the pages added after them
   (Rest days, Head to head, Matches that matter). Every function is pure: results.json in, numbers out.
   - league(F,id): the league's matches [{d,h,a,hg,ag,id,s}] in date order (ties by id), with seasons [{s,ms}] and the club names.
   - run(all,P): walks the matches once; returns {pre: Map(id -> [pH,pD,pA] BEFORE the match), post: Map(id -> [homeRating,awayRating] AFTER it), final: Map(club -> rating after
     the last match, with no new-season pull)}.
   - probs(dr,P): the chances for a rating gap that already includes the home advantage.
   - rng(str): a seeded generator (mulberry32 from an FNV hash of the text), the Time machine's. */
(function(){
 if(typeof INS!=='object'||!INS)return;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const season=d=>{const y=+d.slice(0,4);return +d.slice(5,7)>=7?y:y-1};
 const probs=(dr,P)=>{const x=dr/P.s,ph=1/(1+Math.exp(-(x-P.c))),pa=1-1/(1+Math.exp(-(x+P.c)));return [ph,1-ph-pa,pa]};
 const dayNo=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
 function run(all,P){
  const Rt=new Map(),pre=new Map(),post=new Map();let last=null;
  const mean=()=>{let s=0;for(const v of Rt.values())s+=v;return s/Rt.size};
  for(const m of all){const sea=season(m.d);
   if(last!=null&&sea!==last&&Rt.size){const mu=mean();for(const [t,r] of Rt)Rt.set(t,mu+(1-P.reg)*(r-mu))}
   last=sea;
   for(const t of [m.h,m.a])if(!Rt.has(t))Rt.set(t,Rt.size?mean():1500);
   const dr=Rt.get(m.h)-Rt.get(m.a)+P.H;pre.set(m.id,probs(dr,P));
   const e=1/(1+Math.pow(10,-dr/400)),sc=m.hg>m.ag?1:m.hg===m.ag?.5:0,gd=Math.abs(m.hg-m.ag),mult=gd<=1?1:gd===2?1.5:(11+gd)/8,ch=P.K*mult*(sc-e);
   Rt.set(m.h,Rt.get(m.h)+ch);Rt.set(m.a,Rt.get(m.a)-ch);post.set(m.id,[Rt.get(m.h),Rt.get(m.a)])}
  return {pre,post,final:Rt,seasonOf:last};
 }
 const decoded=new Map();
 function league(F,id){
  const k=id+'|'+F.key;if(decoded.has(k))return decoded.get(k);
  const L=F.leagues[id],T=L.teams;
  const seasons=L.seasons.map(s=>({s:s.s,ms:s.m.map(x=>({d:x[0],h:T[x[1]],a:T[x[2]],hg:x[3],ag:x[4],id:x[5],s:s.s}))}));
  const all=seasons.flatMap(s=>s.ms).sort((a,b)=>cmp(a.d,b.d)||cmp(a.id,b.id));
  const o={id,name:L.name,seasons,all,teams:T.slice()};decoded.set(k,o);return o;
 }
 function rng(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}let a=h;
  return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
 INS.eloKit={cmp,season,probs,dayNo,run,league,rng};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
