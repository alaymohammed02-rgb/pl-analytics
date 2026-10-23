/* ===== League DNA (#/leaguedna, in Analysis after Model report card): the six leagues side by side on how their matches go =====
   Every measure is computed from the league's own finished matches this season (shot data, goal minutes, PitchAPI team numbers):
   goals, xG and shots per match; home win, draw and away win shares; goalless draws; matches with 3+ goals; the share of goals from the
   75th minute on; how often the side that scored first won; how often the side with clearly more xG (a gap of 0.5 or more) won; the home
   side's xG edge; pressing (PPDA, pooled); the height of defensive actions; and balance = the spread (standard deviation) between clubs
   of xG difference per match, so a higher number means a more uneven league. Goal-minute measures use only matches whose goals add up
   to the final score. The page also says what makes the selected league stand out: the measures where it sits furthest from the average
   of the six (in standard deviations). Six leagues, a season in progress: a gap of a few percent is not a real difference. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.pool!=='function')return;
 INS.addPage('leaguedna','League DNA','analysis','reportcard');
 const MET=[['gpm','Goals per match','أهداف للمباراة',2,''],['xgpm','xG per match','xG للمباراة',2,''],['shpm','Shots per match','تسديدات للمباراة',1,''],
  ['hw','Home wins','فوز الأرض',0,'%'],['dr','Draws','تعادل',0,'%'],['aw','Away wins','فوز الضيف',0,'%'],['nn','Goalless draws','تعادل بدون أهداف',0,'%'],['g3','Matches with 3+ goals','مباريات 3 أهداف أو أكثر',0,'%'],
  ['late','Goals from the 75th minute','أهداف من الدقيقة 75',0,'%'],['fgw','First scorer went on to win','اللي سجّل أول فاز',0,'%'],['xgw','Side with clearly more xG won','اللي معه xG أكثر بوضوح فاز',0,'%'],
  ['hxe','Home xG edge','أفضلية الأرض في xG',2,''],['ppda','PPDA (lower = presses more)','PPDA (الأقل = ضغط أكثر)',2,''],['adx','Height of defensive actions (m)','ارتفاع الأفعال الدفاعية (م)',1,''],['bal','Unevenness between clubs (xG difference)','عدم التوازن بين الأندية (فرق xG)',2,'']];
 const S={},two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 let CP=null,CK='';
 const fmt=(k,v)=>{const m=MET.find(x=>x[0]===k);return v==null?'–':(+v).toFixed(m[3])+m[4]};
 async function calc(){
  const P=await INS.pool(['sh','pl','adv']);if(P.miss.length)return {miss:P.miss};
  const rows=P.leagues.map(o=>{
   const n=o.ms.length,xs=m=>[o.xg.get(m.id+'|'+m.home),o.xg.get(m.id+'|'+m.away)];
   const used=o.ms.filter(m=>xs(m)[0]!=null&&xs(m)[1]!=null);if(!used.length||!o.pl||!o.adv)return null;
   const v={},cnt=(f)=>o.ms.filter(f).length;
   v.gpm=o.ms.reduce((s,m)=>s+m.hg+m.ag,0)/n;v.xgpm=used.reduce((s,m)=>s+xs(m)[0]+xs(m)[1],0)/used.length;
   v.shpm=o.shots.filter(s=>!s.og).length/n;
   v.hw=cnt(m=>m.hg>m.ag)/n*100;v.dr=cnt(m=>m.hg===m.ag)/n*100;v.aw=cnt(m=>m.hg<m.ag)/n*100;v.nn=cnt(m=>m.hg===0&&m.ag===0)/n*100;v.g3=cnt(m=>m.hg+m.ag>=3)/n*100;
   const tl=o.ms.filter(m=>o.goals(m.id).length===m.hg+m.ag);let late=0,gl=0,fw=0,fn=0;
   tl.forEach(m=>{const g=o.goals(m.id);g.forEach(x=>{gl++;if(x.mn>=75)late++});if(g.length){fn++;const d=g[0].home?m.hg-m.ag:m.ag-m.hg;if(d>0)fw++}});
   v.late=gl?late/gl*100:null;v.fgw=fn?fw/fn*100:null;
   let cl=0,cw=0;used.forEach(m=>{const [a,b]=xs(m);if(Math.abs(a-b)>=0.5){cl++;if((a>b&&m.hg>m.ag)||(b>a&&m.ag>m.hg))cw++}});v.xgw=cl?cw/cl*100:null;
   v.hxe=used.reduce((s,m)=>s+xs(m)[0]-xs(m)[1],0)/used.length;
   let op=0,da=0;o.adv.team.forEach(r=>{if(r.op!=null&&r.da!=null&&r.da>0){op+=r.op;da+=r.da}});v.ppda=da>0?op/da:null;
   const ax=o.pl.team.map(r=>r.adx).filter(x=>x!=null);v.adx=ax.length?ax.reduce((s,x)=>s+x,0)/ax.length:null;
   const T=new Map();used.forEach(m=>{const [a,b]=xs(m);[[m.home,a-b],[m.away,b-a]].forEach(([t,d])=>{const r=T.get(t)||{n:0,d:0};r.n++;r.d+=d;T.set(t,r)})});
   const dd=[...T.values()].filter(r=>r.n>=3).map(r=>r.d/r.n);
   v.bal=dd.length>=4?Math.sqrt(dd.reduce((s,x)=>s+Math.pow(x-dd.reduce((a,b)=>a+b,0)/dd.length,2),0)/dd.length):null;
   return {id:o.l.id,name:o.l.name,n,v}}).filter(Boolean);
  return {rows};
 }
 R.leaguedna=async function(el){
  el.innerHTML='<h2>League DNA</h2><div id="ldroot" class="ins lk ld"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#ldroot');
  if(!CP||CK!==INS.poolKey()){CK=INS.poolKey();const p=calc().then(r=>{if(r.miss&&CP===p)CP=null;return r},e=>{if(CP===p)CP=null;throw e});CP=p}
  let C;try{C=await CP}catch(e){C={miss:['?']}}
  if(!root.isConnected)return;
  if(C.miss||!C.rows||C.rows.length<4){root.innerHTML=`<div class="empty">${two('The league data is not available right now.','بيانات الدوريات مو متوفرة الحين.')}</div>`;return}
  const rows=C.rows,cur=rows.find(r=>r.id===D.id)||rows[0];
  /* distance of each measure from the average of the six, in standard deviations */
  const z=MET.map(([k])=>{const a=rows.map(r=>r.v[k]).filter(x=>x!=null),mu=a.reduce((s,x)=>s+x,0)/a.length,sd=Math.sqrt(a.reduce((s,x)=>s+Math.pow(x-mu,2),0)/a.length);
   return {k,z:cur.v[k]==null||!sd?0:(cur.v[k]-mu)/sd,mu}}).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z));
  const trait=o=>{const m=MET.find(x=>x[0]===o.k);return `<li><span>${two(m[1],m[2])}</span><b class="${o.z>0?'lk-up':'lk-dn'}">${nb(fmt(o.k,cur.v[o.k]))}</b><span class="mu">${two(`average of the six ${fmt(o.k,o.mu)} · ${o.z>0?'above':'below'}`,`متوسط الست ${nb(fmt(o.k,o.mu))} · ${o.z>0?'أعلى':'أدنى'}`)}</span></li>`};
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>How do the matches of each league go?</b> Fifteen measures from the finished matches of the six domestic leagues this season: goals, results, late goals, who wins after scoring first, pressing, and how uneven the clubs are.`,
    `<b>كيف تمشي مباريات كل دوري؟</b> خمسة عشر مقياس من المباريات المنتهية في الدوريات الست هالموسم: الأهداف، النتائج، الأهداف المتأخرة، مين يفوز بعد ما يسجّل أول، الضغط، وكم الأندية متفاوتة.`)}</p>
    <h3>${nm(cur.name)} · ${two('what stands out','وش اللي يميّزه')}</h3><ul class="ld-tr">${z.slice(0,3).map(trait).join('')}</ul>
    <p class="mu">${two(`Six leagues and a season in progress (${rows.map(r=>r.n).join(', ')} matches): a gap of a few percent is not a real difference.`,`ست دوريات وموسم شغال (${rows.map(r=>nb(r.n)).join('، ')} مباراة): فرق كم بالمئة مو فرق حقيقي.`)}</p></div>
   <div class="ld-grid">${MET.map(([k,en,ar])=>card(k,en,ar,rows,cur)).join('')}</div>`;
 };
 function card(k,en,ar,rows,cur){
  const L=rows.filter(r=>r.v[k]!=null).sort((a,b)=>b.v[k]-a.v[k]||a.name.localeCompare(b.name)),mx=Math.max(...L.map(r=>r.v[k]),1e-9);
  return `<div class="card ld-c"><h3>${two(en,ar)}</h3><ol class="ld-ol">${L.map((r,i)=>`<li class="${r.id===cur.id?'me':''}"><span class="ld-n">${nm(r.name)}</span><span class="ld-b"><i style="width:${(Math.max(0,r.v[k])/mx*100).toFixed(1)}%"></i></span><b>${nb(fmt(k,r.v[k]))}</b></li>`).join('')}</ol></div>`;
 }
 INS.ar({"League DNA":"بصمة الدوري"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
