// usage: node eval.js <season...>  — runs every config in CFGS and prints MAE per season (rows r>=4)
const {load}=require('../harness.js');const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const CFGS={
 v1:"PM.PT=0;PM.K_FIN=3;PMC.GF0={1:1,2:1,3:1,4:1};PMC.LCK=1;PMC.PW.card=null",
 M:"PM.PT=1;PM.K_FIN=3;PMC.GF0={1:1,2:1,3:1,4:1};PMC.LCK=1;PMC.PW.card=null",
 MT:"PM.PT=1;PM.K_FIN=1e6;PMC.GF0={1:1,2:1,3:1,4:1};PMC.LCK=1;PMC.PW.card=1e6",
 MC:"PM.PT=1;PM.K_FIN=3;PMC.GF0={1:1,2:0.84,3:1.01,4:0.95};PMC.LCK=1.05;PMC.PW.card=null",
 MTC:"PM.PT=1;PM.K_FIN=1e6;PMC.GF0={1:1,2:0.84,3:1.01,4:0.95};PMC.LCK=1.05;PMC.PW.card=1e6",
 MT_LCK:"PM.PT=1;PM.K_FIN=1e6;PMC.GF0={1:1,2:1,3:1,4:1};PMC.LCK=1.05;PMC.PW.card=1e6",
};
(async()=>{const seasons=process.argv.slice(2),only=process.env.CFG?process.env.CFG.split(','):Object.keys(CFGS);
 for(const k of only){const out=[];for(const s of seasons){const {ev,d}=load(__dirname+'/model.js',process.env.SDIR?process.env.SDIR+'/'+s+'.json':__dirname+'/../seasons/'+s+'.json');ev(CFGS[k]);
  const r=await ev('btRun')(d),rows=r.rows.filter(x=>x.r>=4);out.push(s+' '+avg(rows.map(x=>Math.abs(x.pred-x.act))).toFixed(4)+' rmse '+Math.sqrt(avg(rows.map(x=>(x.pred-x.act)**2))).toFixed(4)+' (bias '+avg(rows.map(x=>x.pred-x.act)).toFixed(3)+', n '+rows.length+')')}
  console.log(k.padEnd(7),out.join(' | '))}})();
