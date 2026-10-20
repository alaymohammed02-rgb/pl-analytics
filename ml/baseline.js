// Runs the production model (leak-free replay, btRun) on whole archived seasons and reports accuracy vs baselines.
// usage: node baseline.js <model.js> <season...>
const {load}=require('./harness.js');const fs=require('fs');
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
(async()=>{const [js,...seasons]=process.argv.slice(2);const out={};
 for(const s of seasons){const t0=Date.now();const {ev,d}=load(js,__dirname+'/seasons/'+s+'.json');const xp=JSON.parse(fs.readFileSync(__dirname+'/seasons/'+s+'.xp.json','utf8'));
  const r=await ev('btRun')(d);const rows=r.rows.filter(x=>x.r>=4);rows.forEach(x=>{const v=xp[x.id+'|'+x.r];x.xp=v==null?null:v});
  const mae=k=>{const v=rows.filter(x=>x[k]!=null);return {n:v.length,mae:avg(v.map(x=>Math.abs(x[k]-x.act)))}};
  const res={rows:rows.length,secs:(Date.now()-t0)/1000,model:mae('pred'),last5:mae('b5'),season:mae('bs'),fplxp:mae('xp'),bias:avg(rows.map(x=>x.pred-x.act))};
  res.byPos=[1,2,3,4].map(t=>{const L=rows.filter(x=>x.pos===t);return {pos:t,n:L.length,model:avg(L.map(x=>Math.abs(x.pred-x.act))),last5:avg(L.map(x=>Math.abs(x.b5-x.act)))}});
  out[s]=res;console.log(s,JSON.stringify({rows:res.rows,secs:res.secs.toFixed(1),model:res.model.mae.toFixed(4),last5:res.last5.mae.toFixed(4),season:res.season.mae.toFixed(4),fplxp:res.fplxp.mae.toFixed(4)+' (n='+res.fplxp.n+')',bias:res.bias.toFixed(3)}))}
 fs.writeFileSync(__dirname+'/baseline_v1.json',JSON.stringify(out,null,1))})();
