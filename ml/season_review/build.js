// node season_review/build.js — precomputes data/fpl_review.json for every archived season with the page's own code (page_fantasy.js)
const {load}=require('../harness.js');const fs=require('fs');
(async()=>{const {ev,prep}=load(__dirname+'/../page_fantasy.js');const out={sr:ev('SR_VER'),seasons:{}};
 for(const s of ['2022-23','2023-24','2024-25','2025-26']){const d=prep(JSON.parse(fs.readFileSync(__dirname+'/../../data/fpl_'+s+'.json','utf8')));d.archive=s;
  const t0=Date.now(),R=await ev('srRun')(d);out.seasons[s]=R;const sum=(L,k)=>L.reduce((a,x)=>a+(x[k]||0),0);
  console.log(s,((Date.now()-t0)/1000).toFixed(0)+'s','fixed',sum(R.fixed,'act'),'/',sum(R.fixed,'exp').toFixed(1),'ft',sum(R.ft,'act'),'/',sum(R.ft,'exp').toFixed(1),'best',sum(R.opt,'pts'),'transfers',R.ft.reduce((a,x)=>a+x.tr.length,0))}
 fs.writeFileSync(__dirname+'/../../data/fpl_review.json',JSON.stringify(out));console.log('bytes',fs.statSync(__dirname+'/../../data/fpl_review.json').size)})();
