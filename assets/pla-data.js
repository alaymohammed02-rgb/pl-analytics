/* ===== Shared loaders for the player page, the match centre and the home extras =====
   data/<league>_rt.json: player ratings per match {k: rating keys found, m: {match: {player: rating}}}
   data/<league>_mx.json: lineups and momentum per match {m: {match: {lu: {h, a}, mo: [[minute, value]]}}, st: retry state}
   Both come from PitchAPI through the sync (matches.players / matches.lineups / matches.momentum) and are listed in
   data/index.json as rt_file / mx_file once the sync has fetched them. A league without them simply has none: no guessing. */
(function(){
 const C={};
 window.plaLoad=function(kind){
  if(typeof lgMeta!=='function'||typeof D!=='object'||!D)return Promise.resolve(null);
  const m=lgMeta(),f=m[kind+'_file'];if(!f)return Promise.resolve(null);
  const key=D.id+'|'+kind+'|'+(m[kind+'_v']||'');
  if(!C[key])C[key]=loadJson(f,m[kind+'_v']).catch(()=>{delete C[key];return null});
  return C[key];
 };
 window.rtLoad=()=>plaLoad('rt');
 window.mxLoad=()=>plaLoad('mx');
 /* the player photo file (also read by the home page); sets HOME.ph so hAvatar can use it on any page */
 let PH={id:null,p:null};
 window.phLoad=function(){
  if(typeof homePhotos!=='function'||typeof D!=='object'||!D)return Promise.resolve(null);
  const v=D.id+'|'+((lgMeta()||{}).photo_v||'');
  if(PH.id!==v){PH.id=v;PH.p=homePhotos().catch(()=>null).then(d=>{if(d&&typeof HOME==='object'&&PH.id===v)HOME.ph=d;return d})}
  return PH.p;
 };
 /* a player's rating in one match, or null */
 window.rtOf=(rt,mid,pid)=>{const r=rt&&rt.m&&rt.m[mid];const v=r?r[pid]:null;return typeof v==='number'?v:null};
 window.POS_LONG={GK:'Goalkeeper',DF:'Defender',MF:'Midfielder',FW:'Forward'};
 if(typeof AR==='object')Object.entries({"Goalkeeper":"حارس مرمى","Defender":"مدافع","Midfielder":"لاعب وسط","Forward":"مهاجم"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
