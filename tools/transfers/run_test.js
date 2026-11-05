/* Back-test of the transfer planner on a finished season (writes data/transfers_test.json). Run from the repository root with the site served on http://127.0.0.1:8765:
     node tools/transfers/run_test.js [season, default 2025-26] [squads per gameweek, default 40]
   It drives the site itself in Chromium: the season is replayed gameweek by gameweek with the site's own leak-free replay (btRun: every prediction uses only earlier gameweeks), and the
   planner of assets/transfer-planner.js (INS.transfers.plan) is run on random legal starting XIs (1 GK, 4 DF, 4 MF, 2 FW, at most 3 per club, regular players only: before that gameweek at least 45 minutes per gameweek played).
   One gameweek ahead (the replay predicts one gameweek ahead): the transfer picked by (a) the model's prediction, (b) the last-5 average, (c) a random affordable swap; what each really gained =
   actual points of the player in minus the player out. Averages are taken gameweek by gameweek and the standard errors are across gameweeks. */
const {chromium}=require('playwright');const fs=require('fs');
const season=process.argv[2]||'2025-26',K=+process.argv[3]||40,BANK=0.5,FT=1;
(async()=>{const b=await chromium.launch();const pg=await b.newPage();pg.setDefaultTimeout(900000);
 await pg.goto('http://127.0.0.1:8765/index.html#/fantasy');await pg.waitForFunction(()=>typeof btRun==='function'&&INS.transfers&&typeof fpsLoad==='function',null,{timeout:120000});
 const out=await pg.evaluate(async([season,K,BANK,FT])=>{
  const d=await fpsLoad(season),res=await btRun(d),rows=res.rows.filter(x=>x.price!=null&&x.act!=null&&x.pred!=null&&x.b5!=null);
  const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const by=new Map();rows.forEach(x=>{if(!by.has(x.r))by.set(x.r,[]);by.get(x.r).push(x)});
  const need={1:1,2:4,3:4,4:2},rounds=[];
  for(const r of [...by.keys()].sort((a,b)=>a-b)){
   const L=by.get(r);if(r<5||L.length<150)continue;
   const rnd=mul(r*7919+13),act=new Map(L.map(x=>[x.id,x.act]));
   const mk=(x,key)=>({id:x.id,t:x.pos,club:x.club,price:x.price,v:[x[key]]});
   const poolM=L.map(x=>mk(x,'pred')),poolB=L.map(x=>mk(x,'b5')),reg=L.filter(x=>(x.pr||0)>=45*(r-1));
   const acc={m:[],mp:[],b:[],bp:[],g:[],n:0};
   for(let k=0;k<K;k++){
    const cnt=new Map(),sq=[];let bad=false;
    for(const t of [1,2,3,4]){const c=reg.filter(x=>x.pos===t);if(!c.length){bad=true;break}let got=0,tries=0;while(got<need[t]&&tries<400){tries++;const x=c[Math.floor(rnd()*c.length)];if(sq.some(s=>s.id===x.id)||(cnt.get(x.club)||0)>=3)continue;sq.push(x);cnt.set(x.club,(cnt.get(x.club)||0)+1);got++}if(got<need[t]){bad=true;break}}
    if(bad)continue;
    const sM=sq.map(x=>mk(x,'pred')),sB=sq.map(x=>mk(x,'b5'));
    const pm=INS.transfers.plan({squad:sM,pool:poolM,bank:BANK,ft:FT,H:1,top:1,pairs:0}).singles[0],pb=INS.transfers.plan({squad:sB,pool:poolB,bank:BANK,ft:FT,H:1,top:1,pairs:0}).singles[0];
    const all=INS.transfers.plan({squad:sM,pool:poolM,bank:BANK,ft:FT,H:1,top:1e9,pairs:0,M:1}).singles;
    if(!pm||!pb||!all.length)continue;
    const pr=all[Math.floor(rnd()*all.length)];
    const real=p=>act.get(p.in.id)-act.get(p.out.id);
    acc.m.push(real(pm));acc.mp.push(pm.raw);acc.b.push(real(pb));acc.bp.push(pb.raw);acc.g.push(real(pr));acc.n++;
   }
   if(acc.n<10)continue;
   const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,pos=a=>a.filter(x=>x>0).length/a.length;
   rounds.push({r,n:acc.n,model:mean(acc.m),pred:mean(acc.mp),mpos:pos(acc.m),b5:mean(acc.b),b5pred:mean(acc.bp),bpos:pos(acc.b),rand:mean(acc.g),gpos:pos(acc.g)});
  }
  return {rounds,mm:d.generated};
 },[season,K,BANK,FT]);
 const R=out.rounds,mean=a=>a.reduce((s,x)=>s+x,0)/a.length,se=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))/Math.sqrt(a.length)};
 const sum=(f)=>({m:mean(R.map(x=>x[f])),se:se(R.map(x=>x[f]))}),dif=(a,b)=>({d:mean(R.map(x=>x[a]-x[b])),se:se(R.map(x=>x[a]-x[b]))});
 const s={n:R.reduce((t,x)=>t+x.n,0),rounds:R.length,model:Object.assign(sum('model'),{pred:mean(R.map(x=>x.pred)),pos:mean(R.map(x=>x.mpos))}),b5:Object.assign(sum('b5'),{pred:mean(R.map(x=>x.b5pred)),pos:mean(R.map(x=>x.bpos))}),
  rand:Object.assign(sum('rand'),{pos:mean(R.map(x=>x.gpos))}),dB5:dif('model','b5'),dRand:dif('model','rand')};
 fs.writeFileSync('data/transfers_test.json',JSON.stringify({v:1,season,squads_per_round:K,bank:BANK,free_transfers:FT,horizon:1,s,rounds:R},null,0));
 console.log(JSON.stringify(s,null,1));await b.close()})();
