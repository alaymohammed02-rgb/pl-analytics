// node run.js <model.js> <season...>; env EXPR (set params), PRI=<dir>/<prefix> (priors file <prefix><season>.json)
const {load}=require('/home/user/pl-analytics/ml/harness.js');const fs=require('fs');const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const m=L=>({mae:avg(L.map(x=>Math.abs(x.pred-x.act))),rmse:Math.sqrt(avg(L.map(x=>(x.pred-x.act)**2))),bias:avg(L.map(x=>x.pred-x.act)),n:L.length});
async function one(js,s,expr,pri){const {ev,d}=load(js,'/home/user/pl-analytics/data/fpl_'+s+'.json');if(expr)ev(expr);
 if(pri){const f=pri+s+'.json';if(fs.existsSync(f))d.priors=JSON.parse(fs.readFileSync(f,'utf8'))}
 const r=await ev('btRun')(d),R=r.rows.filter(x=>x.r>=4);return {all:m(R),early:m(R.filter(x=>x.r<=10)),rows:R}}
module.exports={one,m};
if(require.main===module)(async()=>{const [js,...ss]=process.argv.slice(2);for(const s of ss){const o=await one(js,s,process.env.EXPR,process.env.PRI);
 const f=x=>x.mae.toFixed(4)+' '+x.rmse.toFixed(4)+' '+x.bias.toFixed(3)+' '+x.n;console.log(s,'all',f(o.all),'| r4-10',f(o.early))}})();
