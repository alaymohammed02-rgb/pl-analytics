// TRAIN grid (2022-23 and 2023-24 only; nothing here reads 2024-25 or 2025-26). usage: node grid.js <stage G|A|C> <out.jsonl> [chosen G json] [chosen A json]
// Rule fixed before running: a config counts only if it beats production v3 on BOTH train seasons in BOTH MAE and RMSE (rounds 4+);
// among those, the largest mean relative gain (MAE and RMSE, both seasons) is chosen. Stage G = goal-rate evidence, A = assist-rate
// evidence, C = the chosen G and A settings together plus their neighbours.
const {one}=require('./run.js');const fs=require('fs');
const [stage,out,cg,ca]=process.argv.slice(2),TR=['2022-23','2023-24'],M=__dirname+'/model_ins.js';
const grid=[],W=[0,.25,.5,.75,1],B=[0,.5,1];
if(stage==='G')for(const GA of W)for(const GB of B)for(const GS of [0,.5]){if(!GA&&!GB)continue;grid.push({GA,GB,GS})}
if(stage==='A')for(const AA of W)for(const AB of B)for(const AK of [0,.5,1]){if(!AA&&!AB)continue;grid.push({AA,AB,AK})}
if(stage==='C'){const g=JSON.parse(cg),a=JSON.parse(ca),nb=(v,L)=>L.filter(x=>Math.abs(x-v)<=.26);
 for(const GA of nb(g.GA,W))for(const AA of nb(a.AA,W))grid.push({GA,GB:g.GB,GS:g.GS,AA,AB:a.AB,AK:a.AK})}
(async()=>{const base={};for(const s of TR)base[s]=(await one(M,s,'',false)).all;
 fs.writeFileSync(out,'');const res=[];
 for(const g of grid){const expr=Object.entries(g).map(([k,v])=>`PM.${k}=${v}`).join(';'),r={g};
  for(const s of TR){const o=await one(M,s,expr,true);r[s]={mae:o.all.mae,rmse:o.all.rmse,bias:o.all.bias,emae:o.early.mae,ermse:o.early.rmse}}
  r.both=TR.every(s=>r[s].mae<base[s].mae&&r[s].rmse<base[s].rmse);
  r.gain=TR.reduce((t,s)=>t+(base[s].mae-r[s].mae)/base[s].mae+(base[s].rmse-r[s].rmse)/base[s].rmse,0)/(2*TR.length);
  res.push(r);fs.appendFileSync(out,JSON.stringify(r)+'\n');
  console.log(expr.padEnd(48),TR.map(s=>s+' '+r[s].mae.toFixed(4)+'/'+r[s].rmse.toFixed(4)).join('  '),r.both?'BOTH':'',(r.gain*100).toFixed(3)+'%')}
 const ok=res.filter(r=>r.both).sort((a,b)=>b.gain-a.gain);
 console.log('baseline',JSON.stringify(base));
 console.log('chosen',ok.length?JSON.stringify(ok[0]):'none: no config beats production on both train seasons in both MAE and RMSE')})();
