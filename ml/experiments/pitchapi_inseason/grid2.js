// Experiment 2 TRAIN grid (2022-23 and 2023-24 only), on top of production v3 (experiment 1 is not adopted, so it is off here).
// usage: node grid2.js <stage S|R|C> <out.jsonl> [chosen S json] [chosen R json]
// Same rule as grid.js, fixed before running: a config counts only if it beats v3 on BOTH train seasons in BOTH MAE and RMSE (rounds 4+);
// the largest mean relative gain wins.
// Stage S: squad-state shift of P(play) from sb.json (fitted on TRAIN), scaled by 0.5 or 1. Decided before running: only the variant
// WITHOUT the "not in the matchday squad" term can ship, because on the live site FPL's injury/suspension flag already carries that
// information (the archive replay has no flags); the variant with it is run for information only.
// Stage R: role change from the heat maps, RG/RA in {0,.05,.1,.2} per cell, RH = 0.5.
const {one}=require('./run.js');const fs=require('fs');
const [stage,out,cs,cr]=process.argv.slice(2),TR=['2022-23','2023-24'],M=__dirname+'/model_ins.js';
const sb=JSON.parse(fs.readFileSync(__dirname+'/sb.json','utf8')).b,grid=[];
const sbv=(k,abs)=>JSON.stringify({0:abs?k*sb[0]:0,1:k*sb[1],2:k*sb[2],3:k*sb[3]});
if(stage==='S')for(const k of [.5,1])for(const abs of [0,1])grid.push({SB:sbv(k,abs),_ship:!abs});
const V=[0,.05,.1,.2];
if(stage==='R')for(const RG of V)for(const RA of V){if(!RG&&!RA)continue;grid.push({RG,RA,RH:.5,_ship:true})}
if(stage==='C'){const a=JSON.parse(cs),b=JSON.parse(cr);grid.push({SB:a.SB,RG:b.RG,RA:b.RA,RH:.5,_ship:true})}
(async()=>{const base={};for(const s of TR)base[s]=(await one(M,s,'',false)).all;
 fs.writeFileSync(out,'');const res=[];
 for(const g of grid){const expr=Object.entries(g).filter(([k])=>k[0]!=='_').map(([k,v])=>`PM.${k}=${v}`).join(';'),r={g};
  for(const s of TR){const o=await one(M,s,expr,true);r[s]={mae:o.all.mae,rmse:o.all.rmse,bias:o.all.bias,emae:o.early.mae,ermse:o.early.rmse}}
  r.both=TR.every(s=>r[s].mae<base[s].mae&&r[s].rmse<base[s].rmse);
  r.gain=TR.reduce((t,s)=>t+(base[s].mae-r[s].mae)/base[s].mae+(base[s].rmse-r[s].rmse)/base[s].rmse,0)/(2*TR.length);
  res.push(r);fs.appendFileSync(out,JSON.stringify(r)+'\n');
  console.log(expr.padEnd(70),TR.map(s=>s+' '+r[s].mae.toFixed(4)+'/'+r[s].rmse.toFixed(4)).join('  '),r.both?'BOTH':'',(r.gain*100).toFixed(3)+'%',g._ship?'':'(info only)')}
 const ok=res.filter(r=>r.both&&r.g._ship).sort((a,b)=>b.gain-a.gain);
 console.log('baseline',JSON.stringify(base));
 console.log('chosen',ok.length?JSON.stringify(ok[0]):'none: no shippable config beats v3 on both train seasons in both MAE and RMSE')})();
