// The single evaluation on the held-out 2025-26 season (and the validation 2024-25 row again for the table), with per-round wins and positions.
const {one,m}=require('./run.js');const fs=require('fs');const C="PM.PW=1;PM.PK=0;PM.PKD=0.8;PM.TR=0.5;PM.TRP=0";
(async()=>{const out={config:C};
 for(const s of ['2022-23','2023-24','2024-25','2025-26']){const a=await one(__dirname+'/model_pa.js',s,'',null),b=await one(__dirname+'/model_pa.js',s,C,'./pa_');
  const by=r=>{const o={};r.forEach(x=>{(o[x.r]=o[x.r]||[]).push(Math.abs(x.pred-x.act))});return o},A=by(a.rows),B=by(b.rows);
  const rs=Object.keys(A),wins=rs.filter(r=>B[r].reduce((s,v)=>s+v,0)<A[r].reduce((s,v)=>s+v,0)).length;
  const pos=L=>[1,2,3,4].map(t=>m(L.filter(x=>x.pos===t)).mae.toFixed(3)).join('/');
  out[s]={v3:{all:a.all,early:a.early,pos:pos(a.rows)},new:{all:b.all,early:b.early,pos:pos(b.rows)},roundsBetter:wins+' of '+rs.length};
  console.log(s,'v3',a.all.mae.toFixed(4),a.all.rmse.toFixed(4),a.all.bias.toFixed(3),'| new',b.all.mae.toFixed(4),b.all.rmse.toFixed(4),b.all.bias.toFixed(3),
   '| r4-10',a.early.mae.toFixed(4),'->',b.early.mae.toFixed(4),'rmse',a.early.rmse.toFixed(4),'->',b.early.rmse.toFixed(4),'| rounds better',wins+'/'+rs.length,'| pos',pos(a.rows),'->',pos(b.rows))}
 fs.writeFileSync(__dirname+'/final.json',JSON.stringify(out,(k,v)=>k==='rows'?undefined:v,1))})();
