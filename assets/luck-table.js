/* ===== Luck table (#/luck, in League after the simulator): points against what the chances were worth =====
   For each match with shot data for both sides: expected points = 3 × P(win) + P(draw), with each side's goals a Poisson count
   of mean its xG in that match (own goals left out of xG): the same calculation as the Intelligence Lab's discovery. A club's
   points are counted over the same matches, so both columns cover exactly the same games.
   A gap says where results and chance quality disagree (finishing, goalkeeping, late goals, game state); it does not prove luck
   and does not predict the future. Penalties count in xG. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('luck','Luck table','league','sim');
 const S={team:'',lg:''};
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1);
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 const xpts=(xf,xa)=>{const a=pois(xf),b=pois(xa);let w=0,d=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=a[i]*b[j];if(i>j)w+=q;else if(i===j)d+=q}return 3*w+d};
 const logo=t=>typeof logoOf==='function'&&logoOf(t)?`<img src="${esc(logoOf(t))}" alt="" width="16" height="16" class="lk-lg">`:'';
 async function calc(){
  const sh=await loadSh().catch(()=>null),tx=wkTeamXg(sh?sh.rows:[]),T=new Map();
  const fin=D.matches.filter(m=>wkSc(m.score)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  let skipped=0;
  fin.forEach(m=>{const g=wkSc(m.score),xh=tx.get(m.match_id+'|'+m.home),xa=tx.get(m.match_id+'|'+m.away);if(xh==null||xa==null){skipped++;return}
   [[m.home,g[0],g[1],xh,xa,m.away],[m.away,g[1],g[0],xa,xh,m.home]].forEach(([t,f,a,x1,x2,o])=>{const r=T.get(t)||{t,n:0,pts:0,xp:0,xf:0,xa:0,f:0,a:0,ms:[]};
    const p=f>a?3:f===a?1:0,e=xpts(x1,x2);r.n++;r.pts+=p;r.xp+=e;r.xf+=x1;r.xa+=x2;r.f+=f;r.a+=a;r.ms.push({m,o,f,a,x1,x2,p,e});T.set(t,r)})});
  const rows=[...T.values()].map(r=>Object.assign(r,{gap:r.pts-r.xp}));
  const byP=rows.slice().sort((a,b)=>b.pts-a.pts||(b.f-b.a)-(a.f-a.a)||b.f-a.f||a.t.localeCompare(b.t)),byX=rows.slice().sort((a,b)=>b.xp-a.xp||a.t.localeCompare(b.t));
  byP.forEach((r,i)=>r.rp=i+1);byX.forEach((r,i)=>r.rx=i+1);
  return {rows,skipped,fin:fin.length};
 }
 R.luck=async function(el){
  el.innerHTML='<h2>Luck table</h2><div id="lkroot" class="ins lk"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#lkroot'),lg=D.id;if(S.lg!==lg){S.lg=lg;S.team=''}
  const C=await calc();if(!root.isConnected||D.id!==lg)return;
  if(C.rows.length<4){root.innerHTML=`<div class="empty">${two(`Not enough matches with shot data in ${esc(D.name)} yet.`,`ما فيه مباريات كفاية ببيانات التسديد في ${nm(D.name)} للحين.`)}</div>`;return}
  const rows=C.rows.slice().sort((a,b)=>b.gap-a.gap||a.t.localeCompare(b.t));
  if(!S.team||!rows.some(r=>r.t===S.team)){const fv=typeof favOf==='function'?favOf():null;S.team=fv&&rows.some(r=>r.t===fv)?fv:rows[0].t}
  const top=rows[0],bot=rows[rows.length-1];
  const paint=()=>{
   root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Points against what the chances were worth.</b> For every match, the two sides' xG give each club the points it would earn on average from chances like those (3 × chance of winning + chance of a draw). Above zero: more points than the chances suggested; below: fewer.`,`<b>النقاط مقابل قيمة الفرص.</b> في كل مباراة، xG الفريقين يعطي كل نادي النقاط اللي يجيبها بالمتوسط من فرص زي كذا (3 × فرصة الفوز + فرصة التعادل). فوق الصفر: نقاط أكثر من اللي تقوله الفرص؛ تحت: أقل.`)}</p>
     <div class="lk-hl"><div class="lk-k up">${logo(top.t)}${nm(top.t)}<b>${nb(sg(top.gap))}</b><span>${two('most points above its chances','أكثر نقاط فوق فرصه')}</span></div>
      <div class="lk-k dn">${logo(bot.t)}${nm(bot.t)}<b>${nb(sg(bot.gap))}</b><span>${two('most points below its chances','أكثر نقاط تحت فرصه')}</span></div></div>
     <p class="mu">${two(`A gap shows where results and chance quality disagree (finishing, goalkeeping, late goals, a side that sits back when ahead). It does not prove luck, and it does not predict the future on its own. ${C.fin-C.skipped} of ${C.fin} matches have shot data for both sides and are counted.`,`الفرق يوضح وين النتائج وجودة الفرص ما تتفق (اللمسة الأخيرة، الحارس، الأهداف المتأخرة، فريق يتراجع لما يتقدم). ما يثبت الحظ، وما يتوقع المستقبل لحاله. ${nb(C.fin-C.skipped)} من ${nb(C.fin)} مباراة فيها بيانات تسديد للفريقين ومحسوبة.`)}</p></div>
    <div class="card"><h3>Points minus expected points</h3>${bars(rows)}</div>
    <div class="card"><h3>If points followed the chances</h3>${table()}</div>
    <div class="card lk-me"><h3>${logo(S.team)}${nm(S.team)}</h3>${detail(rows.find(r=>r.t===S.team))}</div>`;
   root.querySelectorAll('[data-tm]').forEach(b=>{const f=()=>{S.team=b.dataset.tm;paint();const d=root.querySelector('.lk-me');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest',behavior:'smooth'})};b.addEventListener('click',f);if(b.tagName==='TR')b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}})});
  };
  const table=()=>{const L=C.rows.slice().sort((a,b)=>a.rp-b.rp);
   return `<div class="wrap"><table class="lk-t"><thead><tr><th class="n">#</th><th>Team</th><th class="n lk-nm">Matches</th><th class="n">Pts</th><th class="n">xPts</th><th class="n">Difference</th><th class="n"><span class="sm-wide">Place by xPts</span><span class="sm-narrow">By xPts</span></th></tr></thead><tbody>
    ${L.map(r=>{const mv=r.rp-r.rx;return `<tr data-tm="${esc(r.t)}" tabindex="0" class="${r.t===S.team?'me':''}"><td class="n">${r.rp}</td><td class="lk-tn">${logo(r.t)}${nm(r.t)}</td><td class="n lk-nm">${r.n}</td><td class="n">${r.pts}</td><td class="n">${r.xp.toFixed(1)}</td><td class="n ${r.gap>=0?'lk-up':'lk-dn'}">${nb(sg(r.gap))}</td><td class="n">${r.rx}${mv?` <em class="lk-mv ${mv>0?'up':'dn'}" title="${mv>0?'higher':'lower'} by ${Math.abs(mv)}">${nb((mv>0?'▲':'▼')+Math.abs(mv))}</em>`:''}</td></tr>`}).join('')}</tbody></table></div>
    <p class="mu ins-note">${two('Place by xPts: where the club would stand if every match had earned what its chances were worth (▲ higher than now, ▼ lower). Points and xPts cover the same matches.','المركز حسب xPts: وين بيكون النادي لو كل مباراة جابت قيمة فرصها (▲ أعلى من الحين، ▼ أقل). النقاط وxPts تغطي نفس المباريات.')}</p>`};
  paint();
 };
 /* one row per club: the bar from 0 to its gap, green above its chances, red below */
 function bars(rows){
  const mx=Math.max(1,...rows.map(r=>Math.abs(r.gap)));
  return `<ol class="lk-bars">${rows.map(r=>{const w=(Math.abs(r.gap)/mx*50).toFixed(1);
   return `<li class="${r.t===S.team?'me':''}"><button type="button" data-tm="${esc(r.t)}"${INS.tipAttr([r.t,'Points: '+r.pts,'Expected points: '+r.xp.toFixed(1),'Difference: '+sg(r.gap),r.n+' matches'])}><span class="lk-bn lk-tn">${logo(r.t)}${nm(r.t)}</span>
    <span class="lk-bb"><i class="${r.gap>=0?'up':'dn'}" style="${r.gap>=0?'left:50%':'right:50%'};width:${w}%"></i></span><b class="${r.gap>=0?'lk-up':'lk-dn'}">${nb(sg(r.gap))}</b></button></li>`}).join('')}</ol>
   <p class="mu ins-note">${two('Tap a club to see the matches behind its number.','اضغط نادي تشوف المباريات اللي وراء رقمه.')}</p>`;
 }
 /* the matches that made the difference: largest points − expected points, both ways */
 function detail(r){
  const lc=document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB',ms=r.ms.map(x=>Object.assign({},x,{g:x.p-x.e}));
  const up=ms.filter(x=>x.g>0).sort((a,b)=>b.g-a.g).slice(0,3),dn=ms.filter(x=>x.g<0).sort((a,b)=>a.g-b.g).slice(0,3);
  const li=x=>`<li><a href="#/match/${encodeURIComponent(x.m.match_id)}"><span class="mu">${esc(new Date(x.m.date).toLocaleDateString(lc,{day:'numeric',month:'short'}))}</span> <span><span>vs</span> ${nm(x.o)}</span> <b>${nb(x.f+'–'+x.a)}</b> <span class="mu">xG ${nb(x.x1.toFixed(2)+'–'+x.x2.toFixed(2))}</span> <span class="${x.g>=0?'lk-up':'lk-dn'}">${nb(x.p+' / '+x.e.toFixed(1))}</span></a></li>`;
  return `<p>${two(`${r.pts} points from ${r.n} matches; the chances were worth ${r.xp.toFixed(1)} (${sg(r.gap)}). Goals ${r.f}–${r.a}, xG ${r.xf.toFixed(1)}–${r.xa.toFixed(1)}.`,`${nb(r.pts)} نقطة من ${nb(r.n)} مباراة؛ الفرص كانت تساوي ${nb(r.xp.toFixed(1))} (${nb(sg(r.gap))}). الأهداف ${nb(r.f+'–'+r.a)}، xG ‏${nb(r.xf.toFixed(1)+'–'+r.xa.toFixed(1))}.`)}</p>
   <div class="lk-two"><div><h4>${two('More points than the chances','نقاط أكثر من الفرص')}</h4>${up.length?`<ul class="lk-ms">${up.map(li).join('')}</ul>`:`<div class="empty">${two('None.','ولا وحدة.')}</div>`}</div>
    <div><h4>${two('Fewer points than the chances','نقاط أقل من الفرص')}</h4>${dn.length?`<ul class="lk-ms">${dn.map(li).join('')}</ul>`:`<div class="empty">${two('None.','ولا وحدة.')}</div>`}</div></div>
   <p class="mu ins-note">${two('Each match: score, xG for and against, then points earned / points the chances were worth.','كل مباراة: النتيجة، xG له وعليه، وبعدين النقاط اللي جابها / النقاط اللي تساويها الفرص.')}</p>`;
 }
 INS.ar({"Luck table":"جدول الحظ","Points minus expected points":"النقاط ناقص النقاط المتوقعة","If points followed the chances":"لو النقاط مشت مع الفرص",
  "Difference":"الفرق","Place by xPts":"المركز حسب xPts","By xPts":"حسب xPts","Matches":"المباريات","vs":"ضد"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
