// Line-up and heat-map evidence per FPL player and FPL match, for experiment 2. usage: node build_lu.js <season> <out.json>
// Needs ins_<season>.json (the player link and the PitchAPI match -> FPL fixture map from build_ins.js).
// Output: {season, cols, players:{<FPL id>:[[ev, state, depth, lateral, hx, acts], ...]}, cover:{...}}, one row per FPL match of his
// club that has a PitchAPI line-up: state 3 = started, 2 = came on, 1 = on the bench and not used, 0 = not in the matchday squad.
// depth/lateral = his line-up slot when he started; hx = his action-weighted average cell along the pitch (0 = own goal line,
// 16 = opponent's), only with 10+ actions (CLAUDE.md), else null.
const fs=require('fs'),path=require('path');
const [season,out,dir0]=process.argv.slice(2),dir=dir0||'/home/user/pl-analytics/data';
const J=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const d=J(`fpl_${season}.json`),ins=JSON.parse(fs.readFileSync(path.join(__dirname,`ins_${season}.json`),'utf8'));
const MX=J(`l_4WFCIZ_${season}_mx.json`).m,HE=J(`l_4WFCIZ_${season}_heat.json`);
const ix={};d.hcols.forEach((c,i)=>ix[c]=i);
const f2m=new Map();for(const [m,x] of Object.entries(ins.mfx))f2m.set(x.join('|'),m);
const heat=new Map();for(const r of HE.rows){if(r.t!=='p')continue;const h=r.h;let s=0,c=0;for(let i=0;i<h.length;i+=3){s+=(h[i]+.5)*h[i+2];c+=h[i+2]}heat.set(r.m+'|'+r.k,{x:c?s/c:null,c})}
const res={season,cols:['ev','state','depth','lateral','hx','acts'],players:{},cover:{}};let nRows=0,nLu=0,noFx=0,inconsistent=0;
for(const [fid,pa] of Object.entries(ins.paid)){const rows=[];
 for(const r of d.hist[fid]||[]){nRows++;const opp=r[ix.opp],h=r[ix.h],x=d.fix.find(x=>x[0]===r[ix.r]&&(h===1?x[2]===opp:x[1]===opp));if(!x){noFx++;continue}
  const m=f2m.get([x[0],x[1],x[2]].join('|'));const lu=m&&MX[m]&&MX[m].lu&&MX[m].lu[h===1?'h':'a'];if(!lu||!lu.ok||!lu.xi||!lu.xi.length)continue;nLu++;
  const xi=lu.xi.find(e=>e[0]===pa),sb=(lu.sb||[]).some(e=>e[0]===pa),mi=r[ix.min]||0;
  let st=xi?3:sb?(mi>0?2:1):0;if(st===0&&mi>0){inconsistent++;st=2}// FPL says he played but PitchAPI does not list him: count as came on
  const he=heat.get(m+'|'+pa),hx=he&&he.c>=10?he.x:null;
  rows.push([r[ix.r],st,xi?xi[4]:null,xi?xi[5]:null,hx,he?he.c:0])}
 if(rows.length)res.players[fid]=rows.sort((a,b)=>a[0]-b[0])}
res.cover={fplRows:nRows,withLineup:nLu,noFixture:noFx,playedButNotListed:inconsistent,matchesWithLineup:Object.values(MX).filter(v=>v.lu).length};
fs.writeFileSync(out,JSON.stringify(res));console.log(season,JSON.stringify(res.cover));
