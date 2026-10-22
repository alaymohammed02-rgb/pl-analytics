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
 /* data/live.json (official lineups and match status near kick-off): always fresh, never from a cache; only once the sync has
    written it (data/index.json says live: 1), so no visit asks for a file that is not there */
 window.liveLoad=()=>!(typeof ALL==='object'&&ALL&&ALL.live)?Promise.resolve(null):fetch('data/live.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 /* data/h2h.json (head to head of the next fixtures): changes at most once an hour */
 let H2=null;window.h2hLoad=()=>{if(!(typeof ALL==='object'&&ALL&&ALL.h2h))return Promise.resolve(null);const v=Math.floor(Date.now()/36e5);if(!H2||H2.v!==v)H2={v,p:fetch('data/h2h.json?h='+v).then(r=>r.ok?r.json():null).catch(()=>null)};return H2.p};
 window.hvLoad=()=>plaLoad('hv');
 /* match state from PitchAPI's status word (the values are logged by the sync); unknown words are treated as "in play" only
    after kick-off and only when PitchAPI also gave a score or events */
 window.lvState=e=>{if(!e)return 'pre';const s=String(e.st||'').toLowerCase().replace(/[\s_-]/g,'');const k=Date.parse(e.k);
  if(/postpon|cancel|abandon|suspend/.test(s))return 'off';if(/finish|ended|^ft$|fulltime|aet|afterpen|complete/.test(s))return 'ft';
  if(/notstart|scheduled|^ns$|upcoming|timed|fixture/.test(s)||!(k<=Date.now()))return 'pre';
  return (e.sh!=null||(e.ev&&e.ev.length))?'live':'pre'};
 window.lvMinute=e=>{const ev=(e&&e.ev)||[];if(!ev.length)return null;const x=ev[ev.length-1];return x[0]!=null?(x[1]?x[0]+'+'+x[1]:String(x[0]))+"'":null};
 window.POS_LONG={GK:'Goalkeeper',DF:'Defender',MF:'Midfielder',FW:'Forward'};
 if(typeof AR==='object')Object.entries({"Goalkeeper":"حارس مرمى","Defender":"مدافع","Midfielder":"لاعب وسط","Forward":"مهاجم"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
