// node simulation/correlation_test.js — team-goal sharing: team-mates correlate, opposing defence anti-correlates, each player's own distribution unchanged
const {load}=require('../harness.js');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const corr=(a,b)=>{const n=a.length;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);saa+=(a[i]-ma)**2;sbb+=(b[i]-mb)**2}return sab/Math.sqrt(saa*sbb)};
const {ev,d}=load(process.argv[2]||__dirname+'/../page_fantasy.js');const X=ev('oxReady()'),{C}=X,gi=0;
const P=d.P.filter(p=>ev('oxHasPred')(p)&&p.pm.gws[gi]&&p.pm.gws[gi].fx.length===1);
const byTeam=new Map();P.forEach(p=>{if(!byTeam.has(p.tm))byTeam.set(p.tm,[]);byTeam.get(p.tm).push(p)});
// pick the team with the most expected goals among its players
const team=[...byTeam].map(([t,L])=>[t,L.filter(p=>p.ty>=3).sort((a,b)=>b.pm.gws[gi].pts-a.pm.gws[gi].pts).slice(0,4)]).sort((a,b)=>b[1].reduce((s,p)=>s+p.pm.gws[gi].pts,0)-a[1].reduce((s,p)=>s+p.pm.gws[gi].pts,0))[0];
const att=team[1],opp=att[0].pm.gws[gi].fx[0].opp,def=(byTeam.get(opp)||[]).filter(p=>p.ty<=2).sort((a,b)=>b.pm.gws[gi].pts-a.pm.gws[gi].pts).slice(0,3);
console.log('  attackers',att.map(p=>p.name).join(', '),'| opposing defence',def.map(p=>p.name).join(', '));
const ids=[...att,...def].map(p=>p.id),N=20000;
const sm=ev('oxSim')(d,C,ids.map(id=>({per:[{ids:[id],cap:null}]})),[gi],N,11);
const s=k=>sm[k].tot;
let ca=[];for(let i=0;i<att.length;i++)for(let j=i+1;j<att.length;j++)ca.push(corr(s(i),s(j)));
const cad=[];for(let i=0;i<att.length;i++)for(let j=0;j<def.length;j++)cad.push(corr(s(i),s(att.length+j)));
console.log('  team-mate correlations',ca.map(x=>x.toFixed(3)).join(' '),'| attacker vs opposing defender',cad.map(x=>x.toFixed(3)).join(' '));
ok(ca.every(x=>x>0)&&ca.reduce((a,b)=>a+b,0)/ca.length>0.02,'team-mates\' attacking returns are positively correlated (mean '+(ca.reduce((a,b)=>a+b,0)/ca.length).toFixed(3)+')');
ok(def.length===0||cad.every(x=>x<-0.01),'an attacker\'s returns are negatively correlated with the opposing defence');
/* marginals unchanged: each player's distribution under the joint draw equals his distribution simulated alone */
const tvd=(a,b)=>{const h=new Map(),g=new Map();for(const v of a)h.set(v,(h.get(v)||0)+1);for(const v of b)g.set(v,(g.get(v)||0)+1);let tv=0;new Set([...h.keys(),...g.keys()]).forEach(v=>tv+=Math.abs((h.get(v)||0)-(g.get(v)||0))/a.length);return tv/2};
let worst=0,wn='',ref=0;
ids.forEach((id,k)=>{const solo=ev('oxSim')(d,C,[{per:[{ids:[id],cap:null}]}],[gi],N,500+k)[0].tot,solo2=ev('oxSim')(d,C,[{per:[{ids:[id],cap:null}]}],[gi],N,700+k)[0].tot;
 const tv=tvd(s(k),solo),r=tvd(solo2,solo);if(tv-r>worst){worst=tv-r;wn=d.PB.get(id).name+' '+tv.toFixed(4)+' vs noise '+r.toFixed(4)}});
ok(worst<0.012,'each player\'s points distribution is unchanged by the joint draw (worst excess over sampling noise '+worst.toFixed(4)+', '+wn+')');
/* one goal, one scorer: within a team the shared-out goals never exceed the team's goals */
const pls=att.map(p=>({id:p.id,fx:ev('oxParams')(p,gi,d,C)})),Pl=ev('oxPlan')(pls),u=ev('oxRng')(3);let viol=0,tg=0;
for(let i=0;i<20000;i++){ev('oxDrawSet')(Pl,u);const g=Pl.G.find(x=>x.sc.length);const sg=Pl.F.reduce((a,f)=>a+f.ng,0),sa=Pl.F.reduce((a,f)=>a+f.na,0);if(sg>g.G||sa>g.G)viol++;tg+=g.G}
ok(viol===0,'shared-out goals and assists never exceed the team\'s simulated goals (mean team goals '+(tg/20000).toFixed(2)+')');
/* lineup ranges: correlated draws widen an XI's range vs independent players */
const t=ev('oxOptimal')(X,0,'any');
Promise.resolve(t).then(r=>{const team=r.team,xi=team.xi.map(i=>i.id),j=ev('oxSim')(d,C,[{per:[{ids:xi,cap:team.cap.id}]}],[gi],N,21)[0].tot;
 let ind=new Float64Array(N);xi.forEach((id,k)=>{const a=ev('oxSim')(d,C,[{per:[{ids:[id],cap:null}]}],[gi],N,900+k)[0].tot;for(let i=0;i<N;i++)ind[i]+=a[i]*(id===team.cap.id?2:1)});
 const sd=a=>{let m=0;for(const v of a)m+=v;m/=a.length;let q=0;for(const v of a)q+=(v-m)**2;return Math.sqrt(q/a.length)};
 console.log('  optimal XI sd: joint',sd(j).toFixed(2),'independent',sd(ind).toFixed(2));
 ok(sd(j)>=sd(ind)*0.99,'optimal XI spread is at least that of independent players');
 console.log(fails?fails+' FAILED':'all passed')});
