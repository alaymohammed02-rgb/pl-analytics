// Builds the in-season PitchAPI evidence for one Premier League season, per FPL player, tagged with the FPL gameweek (event) of each match.
// usage: node build_ins.js <season, e.g. 2023-24> <out.json> [dir with data files]
// Output: {season, cols:[...], players:{<FPL id>:[[ev, ...cols], ...]}, link:{...}, map:{...}}
// - Each PitchAPI match is mapped to its FPL fixture (same two clubs, kickoff on the same day ±1); the row carries that fixture's event.
//   The model uses only rows with event < the gameweek it predicts (leak-free, the same rule as btRun's FPL rows).
// - Players are linked by the site's own fpLink rule (fpNz names within the player's clubs: full or web name, else surname or last
//   web-name token, then first initial; one PitchAPI player only). The clubs are the ones he played for in FPL this season.
const fs=require('fs'),path=require('path');
const {load}=require('/home/user/pl-analytics/ml/harness.js');
const [season,out,dir0]=process.argv.slice(2),dir=dir0||'/home/user/pl-analytics/data';
const J=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const L=J(`l_4WFCIZ_${season}.json`),PL=J(`l_4WFCIZ_${season}_pl.json`);
const {ev,d}=load(path.join(__dirname,'model_ins.js'),path.join(dir,`fpl_${season}.json`));
const fpNz=ev('fpNz'),teq0=ev('fpTeamEq'),teq=(a,b)=>teq0(String(a).replace(/^Sheffield Utd$/,'Sheffield United'),String(b).replace(/^Sheffield Utd$/,'Sheffield United'));
const tname=new Map(d.teams.map(t=>[t.id,t.n]));
// 1. PitchAPI match -> FPL fixture
const done=L.matches.filter(m=>/^\d+-\d+$/.test(m.s||''));
const fxById=new Map(d.fix.map(x=>[x[x.length-1]===undefined?null:x,x]));
const day=s=>Date.parse(String(s).slice(0,10)+'T00:00:00Z')/864e5;
const m2f=new Map();let unm=[],amb=0;
for(const m of done){const c=d.fix.filter(x=>x[0]&&teq(tname.get(x[1]),m.h)&&teq(tname.get(x[2]),m.a)&&x[8]&&Math.abs(day(x[8])-day(m.d))<=1);
 if(c.length===1)m2f.set(m.i,c[0]);else{c.length?amb++:0;unm.push(m.d+' '+m.h+'-'+m.a+' ('+c.length+')')}}
// FPL fixture id: hist rows carry fx; the fixture list order is not the id, so recover id from hist (r, opp, h) -> fx
const ix={};d.hcols.forEach((c,i)=>ix[c]=i);
const fxKey=x=>x[0]+'|'+x[1]+'|'+x[2],fxId=new Map();
for(const rows of Object.values(d.hist))for(const r of rows){const opp=r[ix.opp],h=r[ix.h],cand=d.fix.filter(x=>x[0]===r[ix.r]&&(h===1?x[2]===opp:x[1]===opp));if(cand.length===1)fxId.set(fxKey(cand[0]),r[ix.fx])}
// 2. PitchAPI rows per player
const pc={};PL.cols.forEach((c,i)=>pc[c]=i);
const COLS=['mi','xg','xag','sot','kp','sca','bx','dfa','sh','gca','gl','ast','xt','vaep'];
const pa=new Map();// pid -> {name, clubs:Set, rows:[]}
for(const r of PL.rows){const f=m2f.get(r[pc.m]);if(!f)continue;const mi=r[pc.mi];if(!(mi>0))continue;
 let o=pa.get(r[pc.i]);if(!o){o={name:r[pc.n],clubs:new Set(),rows:[]};pa.set(r[pc.i],o)}o.clubs.add(r[pc.c]);
 const g=k=>{const v=r[pc[k]];return typeof v==='number'&&isFinite(v)?v:null};
 const dfa=['tk','ic','bl','cl'].map(g);
 o.rows.push({ev:f[0],fk:fxKey(f),club:r[pc.c],v:[mi,g('xg'),g('xag'),g('sot'),g('kp'),g('sca'),g('bx'),dfa.some(x=>x==null)?null:dfa.reduce((s,x)=>s+x,0),g('sh'),g('gca'),g('gl'),g('ast'),g('xt'),g('vaep')]})}
// 3. link (fpLink rule, within the clubs the FPL player played for this season)
const clubsOf=p=>{const s=new Set([p.tm]);for(const r of d.hist[String(p.id)]||[]){if(!(r[ix.min]>0))continue;const opp=r[ix.opp],h=r[ix.h],x=d.fix.find(x=>x[0]===r[ix.r]&&(h===1?x[2]===opp:x[1]===opp));if(x)s.add(h===1?x[1]:x[2])}return [...s].map(t=>tname.get(t))};
const res={season,cols:['ev',...COLS],players:{},link:{},map:{paMatches:done.length,mapped:m2f.size,unmapped:unm,ambiguous:amb}};
let want=0,got=0,rowsKept=0,rowsNoFpl=0;const used=new Map();
for(const p of d.P){
 const mins=(d.hist[String(p.id)]||[]).reduce((s,r)=>s+(r[ix.min]||0),0);if(mins>0)want++;
 const cl=clubsOf(p),full=fpNz(p.fn+' '+p.sn),wn=fpNz(p.wn),sn=fpNz(p.sn).split(' ').pop(),wl=wn.split(' ').pop(),fi=fpNz(p.fn).charAt(0);
 const cands=[...pa.entries()].filter(([,o])=>[...o.clubs].some(c=>cl.some(x=>teq(x,c))));
 let hit=null;const ex=cands.filter(([,o])=>{const n=fpNz(o.name);return n===full||n===wn});
 if(ex.length===1)hit=ex[0];
 else if(!ex.length){const c2=cands.filter(([,o])=>{const t=fpNz(o.name).split(' '),l=t[t.length-1];return l===sn||l===wl});
  if(c2.length===1)hit=c2[0];else if(c2.length>1){const c3=c2.filter(([,o])=>fpNz(o.name).charAt(0)===fi);if(c3.length===1)hit=c3[0]}}
 if(!hit||!(mins>0))continue;
 // keep the PitchAPI rows of fixtures where FPL also has him on the pitch (same fixture), so both sources describe the same matches
 const fplFx=new Set((d.hist[String(p.id)]||[]).filter(r=>r[ix.min]>0).map(r=>{const opp=r[ix.opp],h=r[ix.h],x=d.fix.find(x=>x[0]===r[ix.r]&&(h===1?x[2]===opp:x[1]===opp));return x?fxKey(x):null}));
 const rows=[];for(const r of hit[1].rows){if(fplFx.has(r.fk)){rows.push([r.ev,...r.v]);rowsKept++}else rowsNoFpl++}
 if(!rows.length)continue;
 (used.get(hit[0])||used.set(hit[0],[]).get(hit[0])).push(p.id);res.players[p.id]=rows.sort((a,b)=>a[0]-b[0]);got++}
// a PitchAPI player linked to two FPL players is dropped for both (the rule asks for one match only)
let twice=0;used.forEach(ids=>{if(ids.length>1){twice++;ids.forEach(id=>{delete res.players[id];got--})}});
res.link={fplPlayersWithMinutes:want,linked:got,paPlayers:pa.size,paUsedTwice:twice,rowsKept,rowsNoFplMatch:rowsNoFpl};
fs.writeFileSync(out,JSON.stringify(res));
console.log(season,JSON.stringify(res.link),'matches',m2f.size+'/'+done.length,'unmapped',unm.length,unm.slice(0,5).join('; '));
