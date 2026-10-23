// Truncation leak test: for gameweek k, the data are cut so that nothing of gameweek k or later is visible except the FPL rows of
// gameweek k itself (which the replay needs as the actual result): PitchAPI rows (and line-up/heat rows) with event >= k are deleted, FPL rows and fixtures
// after k are deleted, events after k are unfinished. The predictions for gameweek k must equal those of the full-data replay.
// usage: EXPR='PM.GA=...' node leak_test.js <season> [k...]
const {one,ins}=require('./run.js');
const MODEL=process.env.MODEL||__dirname+'/model_ins.js',[s,...ks]=process.argv.slice(2),K=ks.length?ks.map(Number):[4,5,10,20,30,38],E=process.env.EXPR||'';
(async()=>{const full=await one(MODEL,s,E,true),key=x=>x.r+'|'+x.id,F=new Map(full.rows.map(x=>[key(x),x.pred]));let bad=0,n=0;
 for(const k of K){
  const cut=await one(MODEL,s,E,false,(d)=>{const o=ins(s),P={};for(const [id,rows] of Object.entries(o.players))P[id]=rows.filter(r=>r[0]<k);
   d.ins={cols:o.cols,cal:o.cal,players:P};
   const l=d.lu;if(l){const Q={};for(const [id,rows] of Object.entries(l.players))Q[id]=rows.filter(r=>r[0]<k);d.lu={cols:l.cols,players:Q}}
   for(const id in d.hist)d.hist[id]=d.hist[id].filter(r=>r[0]<=k);d.fix=d.fix.filter(x=>x[0]&&x[0]<=k);d.events=d.events.filter(e=>e.id<=k)});
  const R=cut.rows.filter(x=>x.r===k);let diff=0;for(const x of R){n++;if(Math.abs(F.get(key(x))-x.pred)>1e-12)diff++}
  const nf=full.rows.filter(x=>x.r===k).length;bad+=diff+(nf!==R.length?1:0);
  console.log(s,'k='+k,'rows',R.length,'(full '+nf+')','different',diff)}
 console.log(bad?'LEAK TEST FAILED':'leak test passed',n,'predictions compared');process.exit(bad?1:0)})();
