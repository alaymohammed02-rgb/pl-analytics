// Diagnostic run AFTER the decision (it does not change it): the same weights, but the "extra evidence" is FPL's own xG/xA counted
// again instead of PitchAPI's. That is only less shrinkage towards the position average, with no new information.
const {one}=require('./run.js');const fs=require('fs');const C="PM.GA=0.25;PM.GB=1;PM.GS=0;PM.AA=0.5;PM.AB=1;PM.AK=0.5";
const a=" const gP=mixP(ixg,isot,PM.GS),aP=mixP(ixa,ikp,PM.AK);",src=fs.readFileSync(__dirname+'/model_ins.js','utf8');
if(src.split(a).length!==2)throw new Error('model_ins.js changed: control patch does not apply');
const f=__dirname+'/control_model.js';fs.writeFileSync(f,src.replace(a," const gP=fpOk(p.expected_goals)?p.expected_goals:null,aP=fpOk(p.expected_assists)?p.expected_assists:null;"));
(async()=>{for(const s of ['2022-23','2023-24','2024-25','2025-26']){const o=await one(f,s,C,true);
 console.log(s,'control (FPL counted twice)',o.all.mae.toFixed(4),o.all.rmse.toFixed(4),o.all.bias.toFixed(3))}fs.unlinkSync(f)})();
