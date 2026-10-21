// usage: node evalp.js <season> '<json list of param sets>'  -> one JSON line per param set (MAE over rounds>=4, bias, byPos)
// Uses the model in this folder + priors_<season>.json (built only from complete earlier seasons). Never writes shared files.
const {load}=require('../harness.js');const fs=require('fs');
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
(async()=>{const [season,js]=process.argv.slice(2);const sets=JSON.parse(js||'[{}]');
 const {ev,d}=load(__dirname+'/model.js',__dirname+'/../seasons/'+season+'.json');
 d.priors=JSON.parse(fs.readFileSync(__dirname+'/priors_'+season+'.json','utf8'));
 const base=JSON.parse(ev('JSON.stringify(PM)'));
 for(const ps of sets){ev('Object.assign(PM,'+JSON.stringify(Object.assign({},base,ps))+')');
  const r=await ev('btRun')(d);const rows=r.rows.filter(x=>x.r>=4);
  const res={season,params:ps,n:rows.length,mae:avg(rows.map(x=>Math.abs(x.pred-x.act))),bias:avg(rows.map(x=>x.pred-x.act)),
   byPos:Object.fromEntries([1,2,3,4].map(t=>{const L=rows.filter(x=>x.pos===t);return [t,avg(L.map(x=>Math.abs(x.pred-x.act)))]})),
   early:avg(rows.filter(x=>x.r<=10).map(x=>Math.abs(x.pred-x.act)))};
  if(process.env.DUMP)fs.writeFileSync(process.env.DUMP,JSON.stringify(rows.map(x=>[x.r,x.id,x.pos,x.pred,x.act])));
  console.log(JSON.stringify(res))}})();
