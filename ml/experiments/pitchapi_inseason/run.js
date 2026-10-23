// node run.js <model.js> <season...>; env EXPR (set params), INS=1 attaches ins_<season>.json + cal.json as d.ins
const {load}=require('/home/user/pl-analytics/ml/harness.js');const fs=require('fs');const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const m=L=>({mae:avg(L.map(x=>Math.abs(x.pred-x.act))),rmse:Math.sqrt(avg(L.map(x=>(x.pred-x.act)**2))),bias:avg(L.map(x=>x.pred-x.act)),n:L.length});
const insCache={};
function ins(s){if(!insCache[s]){const o=JSON.parse(fs.readFileSync(__dirname+'/ins_'+s+'.json','utf8'));o.cal=JSON.parse(fs.readFileSync(__dirname+'/cal.json','utf8')).cal;insCache[s]=o}return insCache[s]}
const luCache={};function lu(s){const f=(process.env.LUDIR||__dirname)+'/lu_'+s+'.json';if(!fs.existsSync(f))return null;if(!luCache[s])luCache[s]=JSON.parse(fs.readFileSync(f,'utf8'));return luCache[s]}
async function one(js,s,expr,withIns,mut){const {ev,d}=load(js,'/home/user/pl-analytics/data/fpl_'+s+'.json');if(expr)ev(expr);
 if(withIns){d.ins=ins(s);d.lu=lu(s)}if(mut)mut(d,ev);
 const r=await ev('btRun')(d),R=r.rows.filter(x=>x.r>=4);return {all:m(R),early:m(R.filter(x=>x.r<=10)),rows:R}}
module.exports={one,m,ins,lu};
if(require.main===module)(async()=>{const [js,...ss]=process.argv.slice(2);for(const s of ss){const t=Date.now();const o=await one(js,s,process.env.EXPR,!!process.env.INS);
 const f=x=>x.mae.toFixed(4)+' '+x.rmse.toFixed(4)+' '+x.bias.toFixed(3)+' '+x.n;console.log(s,'all',f(o.all),'| r4-10',f(o.early),((Date.now()-t)/1000).toFixed(1)+'s')}})();
