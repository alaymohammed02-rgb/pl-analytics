// node simulation/kappa_run.js page_fantasy.js <season> simulation/new_<season>.json — leak-free replay of an archived season with the page code; writes the lineup-range records (60 random XIs + the optimal XI per gameweek)
const {load}=require('../harness.js');const fs=require('fs');
const [js0,season,out]=process.argv.slice(2);
const src=fs.readFileSync(js0,'utf8'),a="opt:lin.filter(x=>x.kind==='opt')}";if(src.split(a).length!==2)throw new Error('anchor');
const js=out+'.js';fs.writeFileSync(js,src.replace(a,"opt:lin.filter(x=>x.kind==='opt'),all:lin}"));
(async()=>{const {ev,prep}=load(js);const d=prep(JSON.parse(fs.readFileSync(__dirname+'/../../data/fpl_'+season+'.json','utf8')));d.archive=true;
 const t0=Date.now();const B=await ev('oxBtRun')(d,()=>{});
 const lin=B.lc.opt.concat([]);// opt only kept in lc.opt; random ones are recomputed below from B? keep all
 fs.writeFileSync(out,JSON.stringify({season,kappa:B.lc.kappa,cov1:B.lc.cov1,n:B.lc.n,lin:B.lc.all,lc:B.lc,cal:B.cal.map(c=>[c.r,c.act,c.p10,c.p90,c.mean])}));
 console.log(season,'kappa',B.lc.kappa&&B.lc.kappa.toFixed(3),'cov1',B.lc.cov1,'n',B.lc.n,'s',((Date.now()-t0)/1000).toFixed(0))})().catch(e=>{console.error(e);process.exit(1)});
