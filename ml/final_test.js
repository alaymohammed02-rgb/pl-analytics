// The single final evaluation on the held-out 2025-26 season (vault), plus the 2024-25 validation check of the combined file.
const {load}=require('../harness.js');const fs=require('fs');const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const V='/tmp/claude-0/-home-user/83a4d5f8-8137-5cb1-9baa-8ac55fed2a66/scratchpad/vault';
(async()=>{const out={};
 for(const [s,path,xpPath] of [['2024-25',__dirname+'/../seasons/2024-25.json',__dirname+'/../seasons/2024-25.xp.json'],['2025-26',V+'/2025-26.json',V+'/2025-26.xp.json']]){
  const xp=JSON.parse(fs.readFileSync(xpPath,'utf8'));out[s]={};
  for(const [name,js,cfg] of [['v1',__dirname+'/../fp_model.js',''],['M',__dirname+'/model_M.js','']]){
   const {ev,d}=load(js,path);if(cfg)ev(cfg);const r=await ev('btRun')(d),rows=r.rows.filter(x=>x.r>=4);
   const e=k=>({mae:avg(rows.map(x=>Math.abs(x[k]-x.act))),rmse:Math.sqrt(avg(rows.map(x=>(x[k]-x.act)**2))),bias:avg(rows.map(x=>x[k]-x.act))});
   const br=rows.filter(x=>x.played!=null),brier=avg(br.map(x=>(x.pp-x.played)**2)),mm=avg(rows.filter(x=>x.amin!=null).map(x=>Math.abs(x.eMin-x.amin)));
   const pos=[1,2,3,4].map(t=>{const L=rows.filter(x=>x.pos===t);return +avg(L.map(x=>Math.abs(x.pred-x.act))).toFixed(3)});
   // paired by gameweek: model better in how many gameweeks
   out[s][name]={n:rows.length,...e('pred'),brier,minMAE:mm,byPos:pos,_rows:rows};
   if(name==='v1'){out[s].last5=e('b5');out[s].season=e('bs');rows.forEach(x=>{x.xp=xp[x.id+'|'+x.r]});out[s].fplxp=e('xp')}}
  const a=out[s].v1._rows,b=out[s].M._rows,key=x=>x.r+'|'+x.id,mb=new Map(b.map(x=>[key(x),x])),byR=new Map();
  a.forEach(x=>{const y=mb.get(key(x));if(!y)return;let o=byR.get(x.r);if(!o){o={n:0,g:0};byR.set(x.r,o)}o.n++;o.g+=Math.abs(x.pred-x.act)-Math.abs(y.pred-y.act)});
  const gs=[...byR.values()].map(o=>o.g/o.n);out[s].pairedWins=gs.filter(x=>x>0).length+'/'+gs.length;const mu=avg(gs),sd=Math.sqrt(avg(gs.map(x=>(x-mu)**2)));out[s].pairedGain=mu;out[s].pairedCI95=1.96*sd/Math.sqrt(gs.length);
  delete out[s].v1._rows;delete out[s].M._rows}
 console.log(JSON.stringify(out,(k,v)=>typeof v==='number'?+v.toFixed(4):v,1));fs.writeFileSync(__dirname+'/final_test.json',JSON.stringify(out,null,1))})();
