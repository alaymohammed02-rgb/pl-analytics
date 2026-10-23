// Calibration of PitchAPI proxies to FPL units, by position, fitted on TRAIN only (2022-23 + 2023-24).
// For each linked player-gameweek with one FPL match and FPL xG/xA published: FPL xG / PitchAPI xG, FPL xG / shots on target,
// FPL xA / PitchAPI xAG, FPL xA / key passes (ratios of sums). usage: node calibrate.js > cal.json
const fs=require('fs');const D='/home/user/pl-analytics/data/';
const S={};for(const t of [1,2,3,4])S[t]={fxg:0,pxg:0,sot:0,fxa:0,pxa:0,kp:0,n:0};
for(const season of ['2022-23','2023-24']){
 const d=JSON.parse(fs.readFileSync(D+`fpl_${season}.json`,'utf8')),ins=JSON.parse(fs.readFileSync(`ins_${season}.json`,'utf8'));
 const H={};d.hcols.forEach((c,i)=>H[c]=i);const C={};d.cols.forEach((c,i)=>C[c]=i);const ty=new Map(d.rows.map(r=>[r[C.id],r[C.ty]]));
 for(const [pid,rows] of Object.entries(ins.players)){const t=ty.get(+pid);const h=d.hist[pid]||[];
  for(const r of rows){const f=h.filter(x=>x[H.r]===r[0]&&x[H.min]>0);if(f.length!==1)continue;const x=f[0];
   if(typeof x[H.xg]!=='number'||typeof x[H.xa]!=='number'||r[2]==null||r[3]==null||r[4]==null||r[5]==null)continue;
   const o=S[t];o.fxg+=x[H.xg];o.pxg+=r[2];o.sot+=r[4];o.fxa+=x[H.xa];o.pxa+=r[3];o.kp+=r[5];o.n++}}}
const cal={};for(const t of [1,2,3,4]){const o=S[t];cal[t]={xg:o.fxg/o.pxg,sot:o.fxg/o.sot,xag:o.fxa/o.pxa,kp:o.fxa/o.kp,n:o.n}}
console.log(JSON.stringify({fitted:'TRAIN 2022-23 + 2023-24',cal},null,1));
