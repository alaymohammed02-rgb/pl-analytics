/* ===== Shared loader for the pages that look across leagues, plus the match model they test =====
   INS.pool(need): the six domestic leagues (cups, the Champions League and the World Cup are left out), each with its league file
   and the extra files asked for in `need` ('adv', 'pl', 'sh', 'mx'). One request per file for the whole session; a failed file is
   not kept, so the next visit asks again, and a league that fails is listed in `miss`.
   Per league: `ms` = finished matches (id, date, home, away, goals), `goals(mid)` = the goals of a match in minute order with the side
   that scored (an own goal counts for the other side), `xg` = Map 'match|club' → xG (own goals left out).
   INS.mm = the match model of the Intelligence Lab ("xG Poisson 1"): every club's attack and defence strength is its xG for and
   against per match, pulled towards the league mean by N0 = 3 matches; goals are Poisson. `skip` leaves one match out of the
   strengths, which is what an honest test of the model needs. */
(function(){
 if(typeof INS!=='object')return;
 const domestic=l=>l&&l.file&&l.sh_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
 const KEY={adv:l=>[l.adv_file,l.adv_v],pl:l=>[l.pl_file,l.pl_v],sh:l=>[l.sh_file,l.sh_v],mx:l=>[l.mx_file,l.mx_v]};
 const C=new Map();
 function get(id,f,v){const k=id+'|'+f+'|'+(v||'');if(!C.has(k))C.set(k,loadJson(f,v).catch(e=>{C.delete(k);throw e}));return C.get(k)}
 const score=s=>{const m=/^(\d+)\s*[-–:]\s*(\d+)$/.exec(String(s||'').trim());return m?[+m[1],+m[2]]:null};
 async function one(l,need){
  const L=await get(l.id,l.file,ALL.generated),o={l,L};
  await Promise.all(need.filter(k=>KEY[k]).map(async k=>{const f=KEY[k](l);o[k]=f[0]?await get(l.id,f[0],f[1]):null}));
  const sh=o.sh;
  if(sh){const ix={};sh.cols.forEach((c,k)=>ix[c]=k);
   o.shots=sh.rows.map(r=>{const x={};for(const c in ix)x[c]=r[ix[c]];return x});
   o.xg=new Map();o.gl=new Map();const side=new Map();L.matches.forEach(m=>side.set(m.i,m));
   o.shots.forEach(s=>{const m=side.get(s.m);if(!m)return;
    if(!s.og&&s.xg!=null&&isFinite(s.xg))o.xg.set(s.m+'|'+s.c,(o.xg.get(s.m+'|'+s.c)||0)+s.xg);
    if(s.ev==='Goal'){const sc=s.og?(s.c===m.h?m.a:m.h):s.c;(o.gl.get(s.m)||o.gl.set(s.m,[]).get(s.m)).push({mn:+s.mn||0,ma:+s.ma||0,team:sc,home:sc===m.h,og:!!s.og,player:s.pn})}});
   o.gl.forEach(a=>a.sort((x,y)=>x.mn-y.mn||x.ma-y.ma))}   /* 45+4 comes after 45+1: the stoppage minute breaks ties */
  o.goals=mid=>o.gl?o.gl.get(mid)||[]:[];
  o.ms=L.matches.map(m=>{const g=score(m.s);return g&&m.d?{id:m.i,d:String(m.d).slice(0,10),home:m.h,away:m.a,hg:g[0],ag:g[1]}:null}).filter(Boolean).sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id));
  return o;
 }
 INS.pool=async function(need=[]){
  const Ls=(ALL.leagues||[]).filter(domestic),miss=[],out=[];
  await Promise.all(Ls.map(async l=>{try{out.push(await one(l,need))}catch(e){miss.push(l.name)}}));
  out.sort((a,b)=>Ls.indexOf(a.l)-Ls.indexOf(b.l));
  return {leagues:out,miss};
 };
 /* one league by id (any competition with the files), for the pages that look at the selected league only */
 INS.poolOne=async(id,need=[])=>{const l=(ALL.leagues||[]).find(x=>x.id===id);if(!l||!l.file)return null;try{return await one(l,need)}catch(e){return null}};
 /* the match model. ms = finished matches of one league, xg = Map 'match|club' → xG. Returns predict(home,away,skip?) → null or {p:[win,draw,loss],lh,la}. */
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 INS.mm=function(ms,xg){
  const used=ms.map(m=>({m,xh:xg.get(m.id+'|'+m.home),xa:xg.get(m.id+'|'+m.away)})).filter(u=>u.xh!=null&&u.xa!=null);
  if(used.length<10)return null;
  const N0=3;
  return function(home,away,skip){
   let hs=0,as=0,n=0;const T=new Map();
   for(const u of used){if(u.m.id===skip)continue;n++;hs+=u.xh;as+=u.xa;
    for(const [t,f,a] of [[u.m.home,u.xh,u.xa],[u.m.away,u.xa,u.xh]]){const r=T.get(t)||{n:0,f:0,a:0};r.n++;r.f+=f;r.a+=a;T.set(t,r)}}
   if(n<10)return null;
   const H=hs/n,A=as/n,mu=(H+A)/2,str=t=>{const r=T.get(t);return r&&r.n>=3?{att:(r.f+N0*mu)/(r.n+N0)/mu,def:(r.a+N0*mu)/(r.n+N0)/mu}:null};
   const x=str(home),y=str(away);if(!x||!y)return null;
   const lh=H*x.att*y.def,la=A*y.att*x.def,ph=pois(lh),pa=pois(la);let w=0,d=0,l=0;
   for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=ph[i]*pa[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}
   const s=w+d+l;return {p:[w/s,d/s,l/s],lh,la};
  };
 };
 INS.score=score;
 /* a key for the data a page was built from: pages keep their results only while it is unchanged (an in-app refresh replaces ALL) */
 INS.poolKey=()=>String((typeof ALL==='object'&&ALL&&ALL.generated)||'');
})();
