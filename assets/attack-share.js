/* ===== Attack share (#/share, in Fantasy after Beat the model): who carries his team's attack, and at what price =====
   Numbers (PitchAPI, the Premier League per-match player file): npxG (no penalties) and xAG per player per match.
   - npxGI/90 = Σ(npxG + xAG) ÷ Σ minutes × 90.
   - Share of the team's chances while he played: Σ(npxG + xAG) ÷ Σ over his matches of (the team's npxG in that match × his
     minutes ÷ the match length). A goal chance can count for the shooter and the passer, so shares of one team can add up to
     more than 100%. Unlike a share of the whole season, a player who missed matches is not pulled down for the matches he
     missed. The team's chances are assumed spread evenly over a match.
   FPL (the official Fantasy API, data/fpl.json, already used by the Fantasy pages): position, price, ownership, availability,
   penalty order and fixtures. Players are linked with the site's own FPL ↔ PitchAPI link (fpLink: same team, same name).
   Matches are placed in gameweeks through the FPL fixture list (same home and away teams). Quadrant lines: the 75th percentile
   of the players shown (the top quarter), so they move with the position and filters. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('share','Attack share','fpl','beat');
 const S={pos:3,win:'all',max:0,min:270,sel:null};
 const POS={2:['Defenders','المدافعين'],3:['Midfielders','لاعبي الوسط'],4:['Forwards','المهاجمين']};
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ok=v=>v!=null&&isFinite(v);
 const QP=.75;   /* quadrant lines: the top quarter of the players shown */
 const qtl=(a,q)=>{const s=a.filter(ok).sort((x,y)=>x-y);if(!s.length)return null;const i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo)};
 const fdr=d=>['','#257d5a','#01fc7a','#e7e7e7','#ff1751','#80072d'][d]||'#8a9bb0',fdrTx=d=>d===2||d===3?'#0d1520':'#fff';
 /* per match: each player's npxG, xAG, minutes; each team's npxG and the match length */
 function perMatch(P,FX,T){
  const ix=P.ix,team=new Map(),len=new Map(),gw=new Map();
  P.rows.forEach(r=>{const k=r[ix.m]+'|'+r[ix.c];team.set(k,(team.get(k)||0)+(r[ix.npxg]||0));len.set(k,Math.max(len.get(k)||0,r[ix.mi]||0))});
  const fx=(FX||[]).filter(f=>f[0]);
  D.matches.forEach(m=>{const f=fx.find(f=>fpTeamEq((T.get(f[1])||{}).n,m.home)&&fpTeamEq((T.get(f[2])||{}).n,m.away));if(f)gw.set(m.match_id,f[0])});
  return {team,len,gw};
 }
 function rows(d,P,pm){
  const ix=P.ix,fin=d.events.filter(e=>e.fin).map(e=>e.id),last=fin.length?Math.max(...fin):0;
  const from=S.win==='all'?-Infinity:last-(+S.win)+1;
  const by=new Map();
  P.rows.forEach(r=>{const mi=r[ix.mi];if(!mi)return;const g=pm.gw.get(r[ix.m]);if(S.win!=='all'&&!(g>=from&&g<=last))return;
   const k=r[ix.i];let o=by.get(k);if(!o){o={mi:0,x:0,den:0,n:0};by.set(k,o)}
   const tk=r[ix.m]+'|'+r[ix.c],L=Math.max(90,pm.len.get(tk)||90);
   o.mi+=mi;o.n++;o.x+=(r[ix.npxg]||0)+(r[ix.xag]||0);o.den+=(pm.team.get(tk)||0)*mi/L});
  const out=[];
  d.P.forEach(p=>{if(p.ty!==S.pos||!p.px||!p.px.player_id)return;const o=by.get(p.px.player_id);if(!o||o.mi<S.min)return;if(S.max&&p.price>S.max)return;
   const pg=o.x/o.mi*90,sh=o.den>0?o.x/o.den:null;
   out.push({p,id:p.id,name:p.name,team:p.tf,ts:p.tn,club:p.px.club,price:p.price,own:p.selected_by_percent,mi:o.mi,n:o.n,pg,sh,val:p.price?pg/p.price:null,
    inj:p.st&&p.st!=='a',cop:p.chance_of_playing_next_round,news:p.nw,pen:p.penalties_order===1,href:'#/player/'+encodeURIComponent((p.px.key||'')+'||'+(p.px.club||''))})});
  return {L:out,last,from};
 }
 function next3(d,tm){const T=d.T,now=Date.now();return (d.fix||[]).filter(f=>f[0]&&!f[5]&&(f[1]===tm||f[2]===tm)&&Date.parse(f[8]||0)>now-3*3600e3).sort((a,b)=>String(a[8]).localeCompare(String(b[8]))).slice(0,3)
  .map(f=>{const h=f[1]===tm,o=T.get(h?f[2]:f[1])||{};return {o:o.s||'?',h,d:h?f[3]:f[4],gw:f[0]}})}
 R.share=async function(el){
  el.innerHTML='<h2>Attack share</h2><div id="asroot" class="ins as"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#asroot');
  let d=null;try{d=await fpLoad()}catch(e){d=null}
  if(!root.isConnected)return;
  if(!d){root.innerHTML='<div class="empty">No Fantasy data yet. It is fetched from the official Fantasy Premier League API during the next synchronization.</div>';return}
  /* Fantasy is the Premier League: open it if another competition is open */
  if(!/premier league/i.test(D.name||'')){const pl=(ALL.leagues||[]).find(l=>/premier league/i.test(l.name)&&/engl/i.test(l.country||''))||(ALL.leagues||[]).find(l=>/premier league/i.test(l.name));
   if(!pl){root.innerHTML='<div class="empty">The Premier League is not in the data.</div>';return}
   root.innerHTML='<div class="empty">Loading league…</div>';await setLeague(pl.id);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head();if(root.isConnected)route();return}
  const P=await loadPl().catch(()=>null);if(!root.isConnected)return;
  if(!P||!P.rows||!P.ix.npxg||!P.ix.xag){root.innerHTML='<div class="empty">No per-match player numbers for the Premier League yet.</div>';return}
  const link=fpLink(),pm=perMatch(P,d.fix,d.T);
  const draw=()=>{
   const {L,last,from}=rows(d,P,pm),mx=L.length?Math.max(...L.map(r=>r.price||0)):15;
   const sel=L.find(r=>r.id===S.sel);if(S.sel&&!sel)S.sel=null;
   const mS=qtl(L.map(r=>r.sh),QP),mY=qtl(L.map(r=>r.pg),QP);
   root.innerHTML=`<div class="card as-intro"><p>${two(`<b>Who carries his team's attack?</b> Across: the share of his team's chances he was involved in <i>while he was on the pitch</i> (his npxG + xAG against the team's npxG in his minutes). Up: his npxG + xAG per 90 minutes. Penalties are left out; a ⓟ marks the first-choice penalty taker, whose real output is higher.`,
     `<b>مين يحمل هجوم فريقه؟</b> الأفقي: نسبة فرص فريقه اللي شارك فيها <i>وهو في الملعب</i> (npxG + xAG حقه مقابل npxG فريقه في دقائقه). العمودي: npxG + xAG حقه لكل 90 دقيقة. بدون ركلات الجزاء؛ وعلامة ⓟ لمنفّذ الجزاء الأول، ونتاجه الفعلي أعلى.`)}</p></div>
    <div class="card ctl as-ctl">
     <div class="seg" role="group" aria-label="Position">${Object.entries(POS).map(([k,v])=>`<button type="button" data-pos="${k}" class="${+k===S.pos?'':'s'}" aria-pressed="${+k===S.pos}">${two(v[0],v[1])}</button>`).join('')}</div>
     <label class="mu"><span>Gameweeks</span> <select id="aswin">${[['all','Whole season'],['6','Last 6'],['4','Last 4']].map(([v,t])=>`<option value="${v}"${S.win===v?' selected':''}>${t}</option>`).join('')}</select></label>
     <label class="mu"><span>Max price</span> <select id="asmax"><option value="0">Any</option>${[5,5.5,6,6.5,7,7.5,8,9,10,11,12].map(v=>`<option value="${v}"${S.max===v?' selected':''}>£${v.toFixed(1)}m</option>`).join('')}</select></label>
     <label class="mu"><span>Min. minutes</span> <select id="asmin">${[90,180,270,450,630].map(v=>`<option value="${v}"${S.min===v?' selected':''}>${v}</option>`).join('')}</select></label>
     <p class="mu as-cov">${two(`${L.length} players · ${S.win==='all'?'whole season':`gameweeks ${Math.max(1,from)}–${last}`} · Premier League · ${link.n} of ${link.tot} FPL players with minutes are linked to PitchAPI`,`${nb(L.length)} لاعب · ${S.win==='all'?'الموسم كامل':`الجولات ${nb(Math.max(1,from)+'–'+last)}`} · الدوري الإنجليزي · ${nb(link.n)} من ${nb(link.tot)} لاعب فانتازي لعبوا مربوطين بـPitchAPI`)}</p></div>
    <div class="card">${L.length>=3?chart(L,mS,mY,mx):`<div class="empty">${two('Too few players with these filters.','لاعبين قليلين بهالفلاتر.')}</div>`}</div>
    ${sel?`<div class="card as-sel">${detail(sel,d,mS,mY)}</div>`:''}
    <div class="card"><h3>${two('Best value: npxG + xAG per 90 per £1m','أفضل قيمة: npxG + xAG لكل 90 لكل مليون')}</h3>${table(L,d)}</div>`;
   const q=s=>root.querySelector(s);
   root.querySelectorAll('[data-pos]').forEach(b=>b.addEventListener('click',()=>{S.pos=+b.dataset.pos;S.sel=null;draw()}));
   q('#aswin').onchange=e=>{S.win=e.target.value;draw()};q('#asmax').onchange=e=>{S.max=+e.target.value;S.sel=null;draw()};q('#asmin').onchange=e=>{S.min=+e.target.value;draw()};
   root.querySelectorAll('[data-pid]').forEach(x=>{const f=()=>{S.sel=S.sel===+x.dataset.pid?null:+x.dataset.pid;draw();const c=q('.as-sel');if(c&&c.scrollIntoView)c.scrollIntoView({block:'nearest',behavior:'smooth'})};
    x.addEventListener('click',f);x.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();f()}})});
  };
  draw();
 };
 /* the scatter: the top quarter as the quadrant lines; colour = price (light = cheap, dark = expensive) */
 function chart(L,mS,mY,mx){
  const nar=innerWidth<600,W=nar?400:720,H=nar?500:520,Lm=nar?40:52,Rm=nar?8:18,T=20,B=48;   /* a narrower drawing on phones, so its text stays readable */
  const xs=L.map(r=>r.sh).filter(ok),ys=L.map(r=>r.pg);
  const x0=0,x1=Math.max(.3,Math.ceil((Math.max(...xs)+.05)*10)/10),y0=0,y1=Math.max(.2,Math.ceil((Math.max(...ys)+.05)*10)/10);
  const X=v=>Lm+(v-x0)/(x1-x0)*(W-Lm-Rm),Y=v=>T+(1-(v-y0)/(y1-y0))*(H-T-B);
  const ticks=(a,b,n)=>{const st=(b-a)/n;return [...Array(n+1)].map((_,i)=>a+i*st)};
  const lab=new Set(L.filter(r=>r.sh>=mS&&r.pg>=mY).map(r=>r.id).concat(L.slice().sort((a,b)=>b.pg-a.pg).slice(0,nar?5:10).map(r=>r.id),L.slice().sort((a,b)=>(b.sh||0)-(a.sh||0)).slice(0,nar?3:5).map(r=>r.id)));
  const pc=r=>{const t=Math.min(1,Math.max(0,((r.price||4)-4)/Math.max(1,mx-4)));return `hsl(${45-t*45} ${70+t*20}% ${78-t*36}%)`};
  const boxes=[],place=new Map(),cw=6.3;
  L.filter(r=>ok(r.sh)).forEach(r=>boxes.push([X(r.sh)-8,Y(r.pg)-8,X(r.sh)+8,Y(r.pg)+8]));
  const hit=b=>b[0]<Lm||b[2]>W-Rm||b[1]<T||b[3]>H-B||boxes.some(o=>b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1]);
  L.filter(r=>ok(r.sh)&&(lab.has(r.id)||r.id===S.sel)).sort((a,b)=>(b.id===S.sel)-(a.id===S.sel)||b.pg-a.pg).forEach(r=>{const x=X(r.sh),y=Y(r.pg);
   /* the name with its two numbers, else the name alone; right, left, above, below */
   for(const full of [true,false]){const w=(r.name.length+(full?11:0))*cw;
    for(const [dx,dy,a] of [[12,4,'s'],[-12,4,'e'],[0,-14,'m'],[0,22,'m'],[12,-10,'s'],[-12,-10,'e'],[12,18,'s'],[-12,18,'e']]){
     const x0=a==='s'?x+dx:a==='e'?x+dx-w:x-w/2,b=[x0,y+dy-11,x0+w,y+dy+3];if(!hit(b)){boxes.push(b);place.set(r.id,{x:a==='m'?x:x+dx,y:y+dy,a,full});return}}}});
  const dots=L.filter(r=>ok(r.sh)).sort((a,b)=>(a.id===S.sel)-(b.id===S.sel)).map(r=>{const x=X(r.sh),y=Y(r.pg),on=r.id===S.sel,pl=place.get(r.id);
   return `<g class="as-d${on?' on':''}${r.inj?' inj':''}" data-pid="${r.id}" tabindex="0" role="button" aria-label="${esc(r.name)}"${INS.tipAttr([r.name+' · '+r.ts+' · £'+(r.price||0).toFixed(1)+'m','npxG + xAG /90: '+r.pg.toFixed(2),'Share while on the pitch: '+Math.round(r.sh*100)+'%',Math.round(r.mi)+' minutes · owned by '+(r.own??'–')+'%'].concat(r.inj?[(r.news||'Flagged')+(r.cop!=null?' ('+r.cop+'%)':'')]:[]).concat(r.pen?['First-choice penalty taker']:[]))}>
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on?11:8}" fill="${pc(r)}"/>${r.pen?`<text x="${(x+9).toFixed(1)}" y="${(y-7).toFixed(1)}" class="as-pen">ⓟ</text>`:''}
    ${pl?`<text x="${pl.x.toFixed(1)}" y="${pl.y.toFixed(1)}" class="as-l${pl.a==='e'?' e':pl.a==='m'?' m':''}">${esc(r.name)}${pl.full?` <tspan class="as-lv">${Math.round(r.sh*100)}% · ${r.pg.toFixed(2)}</tspan>`:''}</text>`:''}</g>`}).join('');
  const qx=X(mS),qy=Y(mY),q=(x,y,a,en,ar,c)=>`<text x="${x}" y="${y}" text-anchor="${a}" class="as-q ${c||''}"><tspan class="fx-en">${en}</tspan><tspan class="fx-ar">${ar}</tspan></text>`;
  return `<div class="ph-svg as-svg"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Attack share and npxG + xAG per 90">
   <rect x="${qx}" y="${T}" width="${W-Rm-qx}" height="${qy-T}" class="as-hub"/>
   ${ticks(x0,x1,Math.round((x1-x0)*10)>8?5:Math.round((x1-x0)*10)).map(v=>`<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H-B}" class="ins-grid"/><text x="${X(v)}" y="${H-B+16}" class="ins-ax" text-anchor="middle">${Math.round(v*100)}%</text>`).join('')}
   ${ticks(y0,y1,5).map(v=>`<line x1="${Lm}" x2="${W-Rm}" y1="${Y(v)}" y2="${Y(v)}" class="ins-grid"/><text x="${Lm-6}" y="${Y(v)+3}" class="ins-ax e">${v.toFixed(2)}</text>`).join('')}
   <line x1="${qx}" x2="${qx}" y1="${T}" y2="${H-B}" class="as-m"/><line x1="${Lm}" x2="${W-Rm}" y1="${qy}" y2="${qy}" class="as-m"/>
   ${q(W-Rm-6,T+16,'end','Attacking hub','المحور الهجومي','hub')}${q(Lm+6,T+16,'start','Busy, shares it','يصنع كثير ويتقاسمها')}${q(W-Rm-6,H-B-8,'end','Big share of little','حصة كبيرة من قليل')}${q(Lm+6,H-B-8,'start','Support role','دور مساند')}
   ${dots}
   <text x="${(Lm+W-Rm)/2}" y="${H-8}" class="ins-axt" text-anchor="middle"><tspan class="fx-en">Share of the team's chances while on the pitch →</tspan><tspan class="fx-ar">← نسبة فرص الفريق وهو في الملعب</tspan></text>
   <text x="14" y="${(T+H-B)/2}" class="ins-axt" text-anchor="middle" transform="rotate(-90 14 ${(T+H-B)/2})">npxG + xAG / 90</text></svg></div>
   <div class="as-leg"><span><i class="as-pr"></i>${two('lighter = cheaper, darker = pricier','الفاتح = أرخص، الغامق = أغلى')}</span><span>ⓟ ${two('first-choice penalties','منفّذ الجزاء الأول')}</span><span><i class="as-ij"></i>${two('flagged in FPL (injury, doubt, suspension)','عليه علامة في الفانتازي (إصابة، شك، إيقاف)')}</span></div>
   <p class="mu ins-note">${two(`Lines: the top quarter of the players shown (share ${Math.round(mS*100)}%, ${mY.toFixed(2)} per 90): the attacking hubs are in the top quarter for both. Tap a player for details.`,`الخطوط: أعلى ربع من اللاعبين المعروضين (الحصة ${nb(Math.round(mS*100)+'%')}، ${nb(mY.toFixed(2))} لكل 90): المحور الهجومي في أعلى ربع بالاثنين. اضغط لاعب تشوف التفاصيل.`)}</p>`;
 }
 function quad(r,mS,mY){const hs=r.sh>=mS,hy=r.pg>=mY;return hs&&hy?['an attacking hub: a big share of a lot','محور هجومي: حصة كبيرة من كثير']:hy?['busy but sharing: plenty of chances, spread with team-mates','يصنع كثير ويتقاسمها مع زملائه']:hs?['a big share of little: his team does not create much','حصة كبيرة من قليل: فريقه ما يصنع كثير']:['a support role: a smaller share and fewer chances','دور مساند: حصة أقل وفرص أقل']}
 function detail(r,d,mS,mY){const nx=next3(d,r.p.tm),qq=quad(r,mS,mY);
  return `<h3><a href="${r.href}">${nm(r.name)}</a> <span class="mu">· ${esc(r.ts)} · £${r.price.toFixed(1)}m</span></h3>
   <p>${two(`${esc(r.name)} is ${qq[0]}. npxG + xAG per 90: <b>${r.pg.toFixed(2)}</b>; share of his team's chances while on the pitch: <b>${Math.round(r.sh*100)}%</b>; ${Math.round(r.mi)} minutes in ${r.n} matches. Owned by ${r.own??'–'}%.${r.pen?' First-choice penalty taker: penalties are not counted here, so his real output is higher.':''}${r.inj?` FPL flag: ${esc(r.news||'')}${r.cop!=null?` (${r.cop}% to play)`:''}.`:''}`,
    `${nm(r.name)}: ${qq[1]}. npxG + xAG لكل 90: <b>${nb(r.pg.toFixed(2))}</b>؛ حصته من فرص فريقه وهو في الملعب: <b>${nb(Math.round(r.sh*100)+'%')}</b>؛ ${nb(Math.round(r.mi))} دقيقة في ${nb(r.n)} مباراة. يملكه ${nb((r.own??'–')+'%')}.${r.pen?' منفّذ الجزاء الأول: ركلات الجزاء مو محسوبة هنا، فنتاجه الفعلي أعلى.':''}${r.inj?` علامة في الفانتازي${r.cop!=null?` (فرصة اللعب ${nb(r.cop+'%')})`:''}.`:''}`)}</p>
   ${nx.length?`<div class="as-nx"><span class="mu">${two('Next:','الجاية:')}</span>${nx.map(f=>`<span class="as-f" style="background:${fdr(f.d)};color:${fdrTx(f.d)}" title="GW${f.gw} · difficulty ${f.d}">${esc(f.o)} ${f.h?'(H)':'(A)'}</span>`).join('')}</div>`:''}`}
 function table(L,d){
  const R_=L.filter(r=>ok(r.val)).sort((a,b)=>b.val-a.val).slice(0,15);
  return `<div class="wrap"><table class="as-t"><thead><tr><th>#</th><th>Player</th><th class="n">£m</th><th class="n">npxGI/90</th><th class="n">Share</th><th class="n">${two('Per £1m','لكل مليون')}</th><th class="n as-own">Owned</th><th class="as-nxh">Next 3</th></tr></thead><tbody>
   ${R_.map((r,i)=>`<tr data-pid="${r.id}" tabindex="0" class="${r.id===S.sel?'on':''}"><td class="n">${i+1}</td><td class="as-tn">${nm(r.name)} <span class="mu">${esc(r.ts)}</span>${r.pen?' ⓟ':''}${r.inj?' <span class="as-flag" title="'+esc(r.news||'')+'">!</span>':''}</td><td class="n">${r.price.toFixed(1)}</td><td class="n">${r.pg.toFixed(2)}</td><td class="n">${nb(Math.round(r.sh*100)+'%')}</td><td class="n"><b>${r.val.toFixed(3)}</b></td><td class="n as-own">${nb((r.own??'–')+'%')}</td>
    <td class="as-nxh">${next3(d,r.p.tm).map(f=>`<span class="as-f" style="background:${fdr(f.d)};color:${fdrTx(f.d)}">${esc(f.o)}</span>`).join('')}</td></tr>`).join('')}</tbody></table></div>
   <p class="mu ins-note">${two('Per £1m: npxG + xAG per 90 divided by the current FPL price. Next 3: the FPL difficulty of the next fixtures (green easy, red hard).','لكل مليون: npxG + xAG لكل 90 مقسوم على سعر الفانتازي الحالي. الجاية: صعوبة المباريات الجاية في الفانتازي (الأخضر سهل، الأحمر صعب).')}</p>`}
 INS.ar({"Attack share":"حصة الهجوم","Gameweeks":"الجولات","Whole season":"الموسم كامل","Last #":"آخر #","Max price":"أعلى سعر","Any":"أي سعر","Min. minutes":"أقل دقائق","Player":"اللاعب",
  "Share":"الحصة","Per £#m":"لكل مليون","Owned":"الملكية","Next #":"الجاية","Position":"المركز","No Fantasy data yet. It is fetched from the official Fantasy Premier League API during the next synchronization.":"ما فيه بيانات فانتازي للحين. تنجاب من API الفانتازي الرسمي في المزامنة الجاية.",
  "Loading league…":"نحمّل الدوري…","The Premier League is not in the data.":"الدوري الإنجليزي مو موجود في البيانات.","No per-match player numbers for the Premier League yet.":"ما فيه أرقام لاعبين لكل مباراة في الدوري الإنجليزي للحين."});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
