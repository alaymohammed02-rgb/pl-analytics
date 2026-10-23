// Experiment 2: the single evaluation of the chosen TRAIN setting (role change from heat maps; no squad-state variant beat v3 on TRAIN) on validation 2024-25 and test 2025-26 (plus the TRAIN rows again for the table),
// with paired gameweek wins, the first rounds and MAE by position. Writes final2.json.
const {one,m}=require('./run.js');const fs=require('fs');const C="PM.RG=0.05;PM.RA=0.05;PM.RH=0.5";
(async()=>{const out={config:C};
 for(const s of ['2022-23','2023-24','2024-25','2025-26']){const M=__dirname+'/model_ins.js',a=await one(M,s,'',true),b=await one(M,s,C,true);
  const by=r=>{const o={};r.forEach(x=>{(o[x.r]=o[x.r]||[]).push(Math.abs(x.pred-x.act))});return o},A=by(a.rows),B=by(b.rows);
  const rs=Object.keys(A),gs=rs.map(r=>(A[r].reduce((s,v)=>s+v,0)-B[r].reduce((s,v)=>s+v,0))/A[r].length),wins=gs.filter(g=>g>0).length;
  const mu=gs.reduce((s,v)=>s+v,0)/gs.length,sd=Math.sqrt(gs.reduce((s,v)=>s+(v-mu)**2,0)/(gs.length-1));
  const pos=L=>[1,2,3,4].map(t=>m(L.filter(x=>x.pos===t)).mae.toFixed(3)).join('/');
  out[s]={v3:{all:a.all,early:a.early,pos:pos(a.rows)},new:{all:b.all,early:b.early,pos:pos(b.rows)},roundsBetter:wins+' of '+rs.length,pairedGain:mu,pairedSE:sd/Math.sqrt(gs.length)};
  console.log(s,'v3',a.all.mae.toFixed(4),a.all.rmse.toFixed(4),a.all.bias.toFixed(3),'| new',b.all.mae.toFixed(4),b.all.rmse.toFixed(4),b.all.bias.toFixed(3),
   '| r4-10',a.early.mae.toFixed(4),'->',b.early.mae.toFixed(4),'| better',wins+'/'+rs.length,'gain',mu.toFixed(4),'±',(sd/Math.sqrt(gs.length)).toFixed(4),'| pos',pos(a.rows),'->',pos(b.rows))}
 fs.writeFileSync(__dirname+'/final2.json',JSON.stringify(out,(k,v)=>k==='rows'?undefined:v,1))})();
