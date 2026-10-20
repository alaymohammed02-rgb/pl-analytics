// Final evaluation: model.js with its default PM (chosen on TRAIN) on TRAIN 2022-23, 2023-24 and once on VALIDATION 2024-25,
// plus the production baseline (all prior weights 0 = fp_model.js behaviour) for paired reference. Writes results.json here.
const {execFileSync}=require('child_process');const fs=require('fs');
const run=(s,ps)=>JSON.parse(execFileSync('node',[__dirname+'/evalp.js',s,JSON.stringify([ps])]).toString().trim());
const OFF={PW:0,PK:0,TR:0,TRP:0,PFIN:0,PWD:0};
const S=['2022-23','2023-24','2024-25'],res={train:{},validation:{},bias:{},byPos:{},baseline:{},baseline_bias:{},baseline_byPos:{}};
for(const s of S){const m=run(s,{}),b=run(s,OFF);const k=s==='2024-25'?'validation':'train';
 res[k][s]=m.mae;res.bias[s]=m.bias;res.byPos[s]=m.byPos;res.baseline[s]=b.mae;res.baseline_bias[s]=b.bias;res.baseline_byPos[s]=b.byPos;
 console.log(s,'model',m.mae.toFixed(4),'baseline',b.mae.toFixed(4),'bias',m.bias.toFixed(3))}
res.params={PW:1,PWD:0,PFIN:0,PK:2,TR:0,TRP:0,NT:4,PRIOR_MIN:450,K_FIN:3,N0:4,RECENT:6,note:'PW,PK chosen on TRAIN 2023-24 (grid in logs/); others unchanged'};
res.validation_looks=1;
fs.writeFileSync(__dirname+'/results.json',JSON.stringify(res,null,1));
