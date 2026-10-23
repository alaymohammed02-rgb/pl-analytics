// TRAIN grid for the PitchAPI priors (seasons 2022-23 and 2023-24 only). usage: node grid.js <prefix of priors files> <out.jsonl>
// A config counts only if it beats production v3 on BOTH train seasons in BOTH MAE and RMSE (rounds 4+); among those, the best
// mean relative gain (MAE and RMSE together) is chosen. Nothing here reads 2024-25 or 2025-26.
const {one}=require('./run.js');const fs=require('fs');
const [pre,out]=process.argv.slice(2),TR=['2022-23','2023-24'];
const grid=[];for(const PW of [0,0.5,1,2])for(const PK of [0,0.5,1])for(const TR_ of [0,0.5,1])for(const TRP of [0,1]){if(TRP&&!TR_)continue;grid.push({PW,PK,PKD:0.8,TR:TR_,TRP})}
(async()=>{const base={};for(const s of TR)base[s]=(await one(__dirname+'/model_pa.js',s,'',null)).all;
 fs.writeFileSync(out,'');const res=[];
 for(const g of grid){const expr=Object.entries(g).map(([k,v])=>`PM.${k}=${v}`).join(';'),r={g};
  for(const s of TR){const o=await one(__dirname+'/model_pa.js',s,expr,pre);r[s]={mae:o.all.mae,rmse:o.all.rmse,bias:o.all.bias,emae:o.early.mae,ermse:o.early.rmse}}
  r.both=TR.every(s=>r[s].mae<base[s].mae&&r[s].rmse<base[s].rmse);
  r.gain=TR.reduce((t,s)=>t+(base[s].mae-r[s].mae)/base[s].mae+(base[s].rmse-r[s].rmse)/base[s].rmse,0)/(2*TR.length);
  res.push(r);fs.appendFileSync(out,JSON.stringify(r)+'\n');
  console.log(expr.padEnd(52),TR.map(s=>s+' '+r[s].mae.toFixed(4)+'/'+r[s].rmse.toFixed(4)).join('  '),r.both?'BOTH':'',(r.gain*100).toFixed(2)+'%')}
 const ok=res.filter(r=>r.both).sort((a,b)=>b.gain-a.gain);
 console.log('baseline',JSON.stringify(base));
 console.log('chosen',ok.length?JSON.stringify(ok[0]):'none: no config beats production on both train seasons in both MAE and RMSE')})();
