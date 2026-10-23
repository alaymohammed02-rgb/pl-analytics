// TRAIN only (2022-23, 2023-24): the logit shift of v3's P(play) by the squad state of the player's last match with a line-up.
// For each replayed player-gameweek with one fixture (rounds 4+, player not flagged), v3's pPlay0 is captured and the shift b[s] that
// maximises the Bernoulli likelihood of "played" is fitted per state s (Newton steps). usage: node fit_sb.js > sb.json
const {load}=require('/home/user/pl-analytics/ml/harness.js');const {lu}=require('./run.js');
(async()=>{const G={0:[],1:[],2:[],3:[]};
 for(const s of ['2022-23','2023-24']){const L=lu(s);if(!L)throw new Error('no lu_'+s+'.json');
  const {ev,d}=load(__dirname+'/model_ins.js','/home/user/pl-analytics/data/fpl_'+s+'.json');d.lu=L;const cap=[];
  ev("(function(o,cap){pmPlayer=function(p,C,dd){const m=o(p,C,dd);if(dd!==FPD&&m.rates)cap.push({r:C.next,id:p.id,p0:m.rates.pPlay0,n:m.gws[0]?m.gws[0].fx.length:0});return m}})")(ev('pmPlayer'),cap);
  await ev('btRun')(d);
  const H={};d.hcols.forEach((c,i)=>H[c]=i);
  for(const c of cap){if(c.r<4||c.n!==1)continue;const rows=(d.hist[String(c.id)]||[]).filter(x=>x[H.r]===c.r);if(rows.length!==1)continue;
   const lr=(L.players[String(c.id)]||[]).filter(x=>x[0]<c.r);if(!lr.length)continue;
   G[lr[lr.length-1][1]].push([c.p0,rows[0][H.min]>0?1:0])}}
 const out={fitted:'TRAIN 2022-23 + 2023-24',b:{},n:{},obs:{},pred:{}};
 for(const st of [0,1,2,3]){const v=G[st];let b=0;
  for(let it=0;it<50;it++){let g=0,h=0;for(const [p,y] of v){const q=1/(1+Math.exp(-(Math.log(p/(1-p))+b)));g+=y-q;h+=q*(1-q)}if(!h)break;b+=g/h;if(Math.abs(g/h)<1e-10)break}
  out.b[st]=b;out.n[st]=v.length;out.obs[st]=v.reduce((s,x)=>s+x[1],0)/v.length;out.pred[st]=v.reduce((s,x)=>s+x[0],0)/v.length}
 console.log(JSON.stringify(out,null,1))})();
