// node season_review/check.js <season> <cut gameweek> — legality, points recomputed from raw rows, and a truncation leak test of the season review
const {load}=require('../harness.js');const fs=require('fs');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const season=process.argv[2]||'2024-25',TR=+(process.argv[3]||20);
const raw=()=>JSON.parse(fs.readFileSync(__dirname+'/../../data/fpl_'+season+'.json','utf8'));
(async()=>{const {ev,prep}=load(__dirname+'/../page_fantasy.js');const d=prep(raw());d.archive=season;
 const R=await ev('srRun')(d);const ix=ev('btIx')(d),RU=ev('pmRules')(d),forms=ev('pmForms')(RU);
 const H={};Object.keys(d.hist).forEach(k=>H[k]=d.hist[k]);
 const rowsAt=(id,r)=>(H[String(id)]||[]).filter(x=>x[0]===r),sumAt=(id,r,c)=>rowsAt(id,r).reduce((s,x)=>s+(x[ix[c]]||0),0);
 const tmOf=(id,x)=>{const o=x[ix.opp],h=x[ix.h],c=d.fix.filter(f=>f[0]===x[0]&&(h===1?f[2]===o:f[1]===o)).map(f=>h===1?f[1]:f[2]),me=d.PB.get(id).tm;return c.includes(me)?me:c.length?c[0]:null};
 const teamAt=(id,r)=>{const x=rowsAt(id,r)[0];return x?tmOf(id,x):null};
 /* club at gameweek r: from his row that week, else from his last earlier match */
 const clubAt=(id,r)=>{let t=teamAt(id,r);if(t!=null)return t;const L=(H[String(id)]||[]).filter(x=>x[0]<r);if(!L.length)return null;return tmOf(id,L[L.length-1])};
 const priceAt=(id,r)=>{const L=(H[String(id)]||[]).filter(x=>x[0]<=r);return L.length?L[L.length-1][ix.val]:null};
 const legalSquad=(ids,r,club=true)=>{const c={1:0,2:0,3:0,4:0},cl={};ids.forEach(id=>{c[d.PB.get(id).ty]++;const t=teamAt(id,r);if(t!=null)cl[t]=(cl[t]||0)+1});
  return new Set(ids).size===15&&c[1]===2&&c[2]===5&&c[3]===5&&c[4]===3&&(!club||Object.values(cl).every(n=>n<=RU.club))};
 const legalXI=ids=>{const c={1:0,2:0,3:0,4:0};ids.forEach(id=>c[d.PB.get(id).ty]++);return ids.length===11&&new Set(ids).size===11&&forms.some(f=>f.g===c[1]&&f.d===c[2]&&f.m===c[3]&&f.f===c[4])};
 const sq0=R.squad.map(x=>x.id);
 ok(legalSquad(sq0,R.from),'squad: 15 unique players, 2/5/5/3, at most '+RU.club+' per club');
 ok(R.cost0<=RU.budget&&R.squad.every(x=>x.c===priceAt(x.id,R.from)),'squad cost '+R.cost0+' ≤ '+RU.budget+' at GW'+R.from+' prices');
 /* every gameweek, both versions: legal XI from the squad, captain in it, auto-subs follow the rules, points recomputed from the raw rows */
 for(const key of ['fixed','ft']){let squad=sq0.slice(),bank=RU.budget-R.cost0,ft=0,buy=new Map(R.squad.map(x=>[x.id,x.c])),bad=[];const cap=R.cap;
  for(const x of R[key]){
   if(key==='ft'&&x.r>R.from){ft=Math.min(cap,ft+1);
    for(const t of x.tr){const k=squad.indexOf(t.out);if(k<0){bad.push(x.r+': sold a player not in the squad');continue}
     const now=priceAt(t.out,x.r),b=buy.get(t.out),sell=now==null?b:now>b?b+Math.floor((now-b)/2):now;bank+=sell-priceAt(t.in,x.r);squad[k]=t.in;buy.set(t.in,priceAt(t.in,x.r));ft--;
     if(d.PB.get(t.in).ty!==d.PB.get(t.out).ty)bad.push(x.r+': transfer changes position')}
    if(ft<0)bad.push(x.r+': more transfers than free transfers');if(bank<0)bad.push(x.r+': bank below zero '+bank);if(bank!==x.bank)bad.push(x.r+': bank '+bank+' vs '+x.bank)}
   /* the club limit binds when buying: a player who moves club mid-season may leave 4 from one club, as in FPL */
   if(!legalSquad(squad,x.r,false))bad.push(x.r+': illegal squad');
   if(key==='ft')for(const t of x.tr){const c=clubAt(t.in,x.r);if(squad.filter(id=>clubAt(id,x.r)===c).length>RU.club)bad.push(x.r+': bought into a full club ('+squad.filter(id=>clubAt(id,x.r)===c).map(id=>d.PB.get(id).name).join(',')+')')}
   if(!x.xi.every(id=>squad.includes(id))||!legalXI(x.xi))bad.push(x.r+': XI not legal or not from the squad');
   if(!x.xi.includes(x.cap))bad.push(x.r+': captain not in XI');
   const fin=x.xi.slice();for(const [o,i] of x.subs){if(sumAt(o,x.r,'min')>0)bad.push(x.r+': subbed out a player who played');if(!(sumAt(i,x.r,'min')>0))bad.push(x.r+': subbed in a player who did not play');if(x.xi.includes(i)||!squad.includes(i))bad.push(x.r+': sub not from bench');fin[fin.indexOf(o)]=i}
   if(!legalXI(fin))bad.push(x.r+': formation illegal after subs');
   const capU=sumAt(x.cap,x.r,'min')>0?x.cap:(x.vice!=null&&sumAt(x.vice,x.r,'min')>0?x.vice:null);if(capU!==x.capUsed)bad.push(x.r+': captaincy');
   const act=fin.reduce((s,id)=>s+sumAt(id,x.r,'pts'),0)+(capU!=null?sumAt(capU,x.r,'pts'):0);if(act!==x.act)bad.push(x.r+': points '+x.act+' vs recomputed '+act);
  }
  ok(!bad.length,key+': '+R[key].length+' gameweeks — legal squads and XIs, captain/vice, auto-subs, bank and points recomputed from raw rows'+(bad.length?' '+bad.slice(0,4).join(' | '):''))}
 ok(R.ft.reduce((s,x)=>s+x.tr.length,0)<=R.ft.length-1&&R.fixed.every(x=>!x.tr.length),'transfers only in the free-transfer version, at most one new free transfer per gameweek');
 /* hindsight optimum: never below the model's own XI; legal and within budget */
 const om=new Map(R.opt.map(x=>[x.r,x]));let ob=[];
 for(const x of R.fixed){const o=om.get(x.r);if(!o||o.pts==null){ob.push(x.r+' missing');continue}if(!legalXI(o.xi))ob.push(x.r+' illegal');
  const pts=o.xi.reduce((s,id)=>s+sumAt(id,x.r,'pts'),0)+sumAt(o.cap,x.r,'pts');if(pts!==o.pts)ob.push(x.r+' pts');
  const best=Math.max(...R.fixed.filter(y=>y.r===x.r).map(y=>y.xi.reduce((s,id)=>s+sumAt(id,x.r,'pts'),0)+Math.max(...y.xi.map(id=>sumAt(id,x.r,'pts')))));if(o.pts<best-1e-9)ob.push(x.r+' below the model XI')}
 ok(!ob.length,'best XI in hindsight: legal, points recomputed, never below the model\'s own XI '+ob.slice(0,3).join(' | '));
 /* leak test: the same season truncated after GW'+TR+' (later rows and results removed) gives the same decisions up to GW'+TR */
 const t=raw();for(const k in t.hist)t.hist[k]=t.hist[k].filter(x=>x[0]<=TR);t.events.forEach(e=>{if(e.id>TR)e.fin=false});t.fix.forEach(f=>{if(f[0]>TR){f[5]=0;f[6]=null;f[7]=null}});
 const dt=prep(t);dt.archive=season;const Rt=await ev('srRun')(dt);
 const pick=(L)=>JSON.stringify(L.filter(x=>x.r<=TR).map(x=>[x.r,x.xi,x.cap,x.exp.toFixed(6),x.tr,x.act]));
 ok(pick(R.fixed)===pick(Rt.fixed)&&pick(R.ft)===pick(Rt.ft)&&JSON.stringify(R.squad)===JSON.stringify(Rt.squad),'leak test: data cut after GW'+TR+' gives identical squads, XIs, captains, transfers and expected points up to GW'+TR);
 console.log(fails?fails+' FAILED':'all passed');
})().catch(e=>{console.error(e);process.exit(1)});
