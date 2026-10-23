// Track record snapshot: runs the page's own Fantasy code (argv[2]) on data/fpl.json (argv[3]) and prints the model's
// Optimal XI (budget) for the next gameweek with its simulated range, and every player's expected points.
const fs=require('fs'),vm=require('vm');
const [codeF,dataF]=process.argv.slice(2);
const ctx={console:{log(){},warn(){},error(){}},Math,Date,JSON,Map,Set,Promise,setTimeout,Float64Array,Uint8Array,Int16Array,Uint32Array,Array,Object,String,Number,isFinite,parseInt,parseFloat,Error,RegExp,Infinity,NaN,
 document:{querySelector:()=>null,getElementById:()=>null,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},fetch:async()=>({ok:false,status:404})};
vm.createContext(ctx);
vm.runInContext("const $=s=>null;const esc=s=>String(s??'');const f=(v,d=3)=>v==null?'N/A':Number(v).toFixed(d);const tbl=()=>'';const R={};let ALL={leagues:[]},D=null;\n"+fs.readFileSync(codeF,'utf8')+"\n;globalThis.__ev=s=>eval(s);",ctx);
const ev=ctx.__ev;
(async()=>{
 const d=JSON.parse(fs.readFileSync(dataF,'utf8'));
 /* the same preparation as fpLoad on the page */
 d.T=new Map(d.teams.map(t=>[t.id,t]));
 d.P=d.rows.map(r=>{const o={};d.cols.forEach((c,i)=>o[c]=r[i]);const t=d.T.get(o.tm)||{};o.tn=t.s||'?';o.tf=t.n||'?';o.pos=o.ty;o.name=o.wn;
  o.price=typeof o.now_cost==='number'?o.now_cost/10:null;o.chg=typeof o.cost_change_start==='number'?o.cost_change_start/10:null;return o});
 d.PB=new Map(d.P.map(p=>[p.id,p]));ev('v=>{FPD=v}')(d);
 const X=ev('oxReady()');if(X.err)throw new Error(X.err);
 const res=await ev('oxOptimal')(X,0,'budget');if(res.err)throw new Error(res.err);
 const t=res.team,ids=t.xi.map(i=>i.id),C=X.C,g=C.gws[0];
 /* the same simulation (seed 7001, N 2000) and widening as the Optimal XI tab */
 const sim=ev('oxSim')(d,C,[{per:[{ids,cap:t.cap.id}]}],[0],ev('OX.N'),7001)[0],st=ev('oxQs')(sim.tot);
 const pv=p=>{const x=ev('oxG')(p,0);return x?x.pts:null};
 const bench=(t.bench||[]).map(i=>d.PB.get(i.id)).filter(Boolean).sort((a,b)=>(a.ty===1)-(b.ty===1)||(pv(b)||0)-(pv(a)||0)||a.id-b.id).map(p=>p.id);
 const preds={};d.P.forEach(p=>{const v=pv(p);if(v!=null&&ev('oxHasPred')(p))preds[p.id]=Math.round(v*100)/100});
 const r2=x=>Math.round(x*100)/100;
 process.stdout.write(JSON.stringify({gw:g,data:d.generated,ver:ev('PM_VERSION'),kappa:ev('oxK()'),mode:'budget',form:t.form.name,xi:ids,cap:t.cap.id,vice:t.vice?t.vice.id:null,bench,
  exp:r2(t.total),p10:r2(st.p10),p50:r2(st.p50),p90:r2(st.p90),cost:t.squadCost??null,preds}));
})().catch(e=>{process.stderr.write(String(e&&e.message||e));process.exit(1)});
