/* ===== Club shape (#/shape, in the Teams hub after Tactical): where a club's starters really played their match actions =====
   Not the formation on the team sheet: the official line-ups (data/<league>_mx.json) only give a fixed spot for each slot of a formation, the same
   in every match. This page uses PitchAPI's heat counts (data/<league>_heat.json: 16 cells along the pitch, 12 across, drawn from each team's own
   goal towards the opponent's, one row per player and match) for the players who STARTED a match (from the line-up), and for each player takes the
   action-weighted centre of his cells, over his starts with 10+ actions. A player is drawn when he has enough such starts (2, or a quarter of the
   club's matches). The three lines (defenders = slots 30-39 of the line-up, midfielders = the other slots below 100, forwards = 100 and up) are
   each the action-weighted centre of all their starters' cells; goalkeepers are left out. An action is where the ball was touched, so a
   player's centre is pulled towards where his team plays: it is a picture of where the club operated, not of where its players stood.
   The left flank is at the top when the team attacks to the right (the cells run left to right the other way, which the line-up's left / right
   spots confirm: correlation -0.93 over 928 defenders and wingers). Pitch 105 x 68 m, a cell is 6.56 x 5.67 m. A formation chip limits the
   main club to the matches it used that formation in; the compared club always uses all its matches. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function'||typeof INS.poolOne!=='function')return;
 INS.addPage('shape','Club shape','teams','tactical');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const PW=105,PH=68,GX=16,GY=12,MINA=10;
 const S={lg:'',team:'',cmp:'',fm:'',tok:0};
 let CP=null,CK='';
 const grp=s=>s===11?'GK':s>=30&&s<40?'DEF':s<100?'MID':'FWD';
 const cellsOf=h=>{const o=[];for(let i=0;i+2<h.length;i+=3)o.push([h[i],h[i+1],h[i+2]]);return o};
 /* per league: for each club its matches with the starters of each and their cells */
 function load(lid){
  const key=INS.poolKey()+'|'+lid;
  if(CP&&CK===key)return CP;
  CK=key;
  const p=(async()=>{
   const P=await INS.poolOne(lid,['mx']);if(!P||!P.mx||!P.mx.m||!P.l.heat_file)throw new Error('shape');
   const H=await loadJson(P.l.heat_file,P.l.heat_v||P.l.adv_v);if(!H||!H.rows||!H.grid||H.grid.l!==GX||H.grid.w!==GY)throw new Error('heat');
   const by=new Map();H.rows.forEach(r=>{if(r.t==='p')by.set(r.m+'|'+r.k,r)});
   const clubs=new Map();
   P.ms.forEach(m=>{const e=P.mx.m[m.id],lu=e&&e.lu;if(!lu)return;
    [['h',m.home],['a',m.away]].forEach(([sd,t])=>{const L=lu[sd];if(!L||!L.xi||L.xi.length!==11)return;
     const st=[];L.xi.forEach(x=>{const r=by.get(m.id+'|'+x[0]);if(!r||r.c!==t)return;const c=cellsOf(r.h),w=c.reduce((s,q)=>s+q[2],0);if(w<MINA)return;st.push({id:x[0],name:x[1],slot:x[3],g:grp(x[3]),cells:c,w})});
     (clubs.get(t)||clubs.set(t,[]).get(t)).push({id:m.id,d:m.d,f:L.f||'',st})})});
   return {clubs,lid,ln:P.l.name};
  })().catch(e=>{if(CP===p)CP=null;throw e});
  CP=p;return p;
 }
 /* the action-weighted centre of some cells, in metres: along (from the own goal) and from the left touchline */
 const along=x=>(x+.5)/GX*PW,fromLeft=y=>(GY-(y+.5))/GY*PH;
 function aggregate(ms){
  const pl=new Map(),ln={DEF:[0,0,0],MID:[0,0,0],FWD:[0,0,0]};
  ms.forEach(m=>m.st.forEach(s=>{let sx=0,sy=0;s.cells.forEach(([x,y,c])=>{sx+=(x+.5)*c;sy+=(y+.5)*c});
   if(s.g!=='GK'){const a=ln[s.g];a[0]+=sx;a[1]+=sy;a[2]+=s.w}
   let p=pl.get(s.id);if(!p){p={id:s.id,name:s.name,n:0,w:0,sx:0,sy:0};pl.set(s.id,p)}
   p.n++;p.w+=s.w;p.sx+=sx;p.sy+=sy}));
  const need=Math.max(2,Math.ceil(ms.length/4)),pts=[...pl.values()].filter(p=>p.n>=need).map(p=>({id:p.id,name:p.name,n:p.n,per:p.w/p.n,x:p.sx/p.w/GX*PW,y:(GY-p.sy/p.w)/GY*PH}));
  const lines={};for(const k in ln){const a=ln[k];lines[k]=a[2]?{x:a[0]/a[2]/GX*PW,y:(GY-a[1]/a[2])/GY*PH,w:a[2]}:null}
  return {n:ms.length,need,pts,lines};
 }
 R.shape=async function(el){
  el.innerHTML='<h2>Club shape</h2><div id="csroot" class="ins lk cs"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#csroot'),lg=D.id,tok=++S.tok;
  let C;try{C=await load(lg)}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The line-ups and heat maps are not available right now.','التشكيلات وخرائط الحرارة مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(S.lg!==lg){S.lg=lg;S.team='';S.cmp='';S.fm=''}
  draw(root,C);
 };
 const surname=n=>{const w=String(n).trim().split(/\s+/);return w[w.length-1]};
 function pitch(main,cmp){
  const lines=`<g class="cs-pl"><rect x="0" y="0" width="${PW}" height="${PH}"/><line x1="${PW/2}" x2="${PW/2}" y1="0" y2="${PH}"/><circle cx="${PW/2}" cy="${PH/2}" r="9.15"/>
   <rect x="0" y="${(PH-40.32)/2}" width="16.5" height="40.32"/><rect x="${PW-16.5}" y="${(PH-40.32)/2}" width="16.5" height="40.32"/><rect x="0" y="${(PH-18.32)/2}" width="5.5" height="18.32"/><rect x="${PW-5.5}" y="${(PH-18.32)/2}" width="5.5" height="18.32"/></g>`;
  const dot=(p,cls)=>`<g class="cs-d ${cls}" data-id="${esc(p.id)}" data-n="${p.n}" data-x="${p.x.toFixed(3)}" data-y="${p.y.toFixed(3)}"${INS.tipAttr?INS.tipAttr([p.name,p.n+' starts · '+p.x.toFixed(1)+' m from own goal']):''}><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${cls==='b'?1.3:1.1}"/>${cls==='a'?`<text x="${p.x.toFixed(2)}" y="${(p.y+3).toFixed(2)}" text-anchor="middle">${esc(surname(p.name))}</text>`:''}</g>`;
  return `<svg class="cs-svg" viewBox="-3 -3 ${PW+6} ${PH+6}" role="img" aria-label="${ar()?'متوسط أماكن أفعال اللاعبين على الملعب':'Average places of the players\' actions on the pitch'}" direction="ltr">${lines}
   ${cmp?cmp.pts.map(p=>dot(p,'b')).join(''):''}${main.pts.map(p=>dot(p,'a')).join('')}
   <text class="cs-ar" x="${PW-1}" y="-0.8" text-anchor="end">→</text></svg>`;
 }
 function draw(root,C){
  const teams=[...C.clubs.keys()].sort((a,b)=>a.localeCompare(b));
  if(!teams.length){root.innerHTML=`<div class="empty">${two('No line-ups with heat maps yet.','ما فيه تشكيلات مع خرائط حرارة للحين.')}</div>`;return}
  if(!teams.includes(S.team))S.team=teams[0];
  if(S.cmp&&(!teams.includes(S.cmp)||S.cmp===S.team))S.cmp='';
  const all=C.clubs.get(S.team),fmN=new Map();all.forEach(m=>fmN.set(m.f,(fmN.get(m.f)||0)+1));
  const fms=[...fmN.entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1));
  if(S.fm&&!fmN.has(S.fm))S.fm='';
  const ms=S.fm?all.filter(m=>m.f===S.fm):all,main=aggregate(ms),cmp=S.cmp?aggregate(C.clubs.get(S.cmp)):null;
  const f1=v=>v==null?'–':v.toFixed(1),dpt=a=>a.lines.DEF&&a.lines.FWD?a.lines.FWD.x-a.lines.DEF.x:null;
  const lineRow=(k,en,arb)=>`<tr data-k="${k}"><td>${two(en,arb)}</td><td class="n cs-a">${nb(f1(main.lines[k]&&main.lines[k].x))}</td>${cmp?`<td class="n cs-b">${nb(f1(cmp.lines[k]&&cmp.lines[k].x))}</td>`:''}</tr>`;
  const d3=!!(INS.pitch3d&&INS.pitch3d.get()&&main.pts.length);
  const sorted=main.pts.slice().sort((a,b)=>a.x-b.x||(a.name<b.name?-1:1));
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Where a club really plays.</b> Each dot is a starter, placed at the centre of his match actions over his starts (own goal on the left, the team attacks to the right). It shows how deep the defence sits, how far the forwards are from it and who drifts where, season so far.','<b>وين النادي يلعب فعلًا.</b> كل نقطة لاعب أساسي، في مركز أفعاله في مبارياته (المرمى على اليسار والفريق يهاجم لليمين). تشوف قد إيش الدفاع متراجع، وكم المسافة بينه وبين المهاجمين، ومين يتحرك وين، من بداية الموسم.')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="csc">${teams.map(t=>`<option value="${esc(t)}"${t===S.team?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Compare with','قارن مع')}</span><select id="csp"><option value="">${ar()?'بدون':'None'}</option>${teams.filter(t=>t!==S.team).map(t=>`<option value="${esc(t)}"${t===S.cmp?' selected':''}>${esc(t)}</option>`).join('')}</select></label></div>
    <div class="seg cs-fm" id="csf" role="group" aria-label="${ar()?'التشكيل':'Formation'}"><button type="button" data-f="" aria-pressed="${!S.fm}" class="${S.fm?'':'on'}">${two('All','الكل')} ${nb(all.length)}</button>${fms.map(([f,n])=>`<button type="button" data-f="${esc(f)}" aria-pressed="${S.fm===f}" class="${S.fm===f?'on':''}">${nb(esc(f||'?'))} ${nb(n)}</button>`).join('')}</div></div>
   <div class="card cs-c"><p class="mu cs-hd">${two(`${esc(S.team)}: ${main.n} ${main.n===1?'match':'matches'}${S.fm?' in '+esc(S.fm):''}; a player is drawn from ${main.need} starts`,`${nm(S.team)}: ${nb(main.n)} مباراة${S.fm?' بتشكيل '+nb(esc(S.fm)):''}؛ اللاعب يظهر من ${nb(main.need)} مباراة أساسي`)}${cmp?` · <span class="cs-cb">${two(`outlined: ${esc(S.cmp)}`,`الحلقات: ${nm(S.cmp)}`)}</span>`:''}</p>
    ${main.pts.length?`<div class="seg p3-seg" id="cs3t" role="group" aria-label="${ar()?'العرض':'View'}"><button type="button" data-v="2" aria-pressed="${!d3}">2D</button><button type="button" data-v="3" aria-pressed="${d3}">${two('3D · experimental','3D · تجريبي')}</button></div>${d3?'<div class="cs-3d" id="cs3d"></div>':pitch(main,cmp)}`:`<div class="empty">${two('No player has enough starts with 10 or more actions yet.','ما فيه لاعب عنده مباريات أساسي كافية (10 أفعال أو أكثر) للحين.')}</div>`}
    <p class="mu ins-note">${two('The centre of a player\'s actions is where the ball was touched, so it is pulled towards where his team plays: this is where the club operated, not where its players stood. The left flank is at the top. Pitch 105 × 68 m.','مركز أفعال اللاعب هو المكان اللي انلمست فيه الكرة، فينسحب نحو المكان اللي يلعب فيه فريقه: هذا مكان نشاط النادي، مو مكان وقوف لاعبيه. الجناح الأيسر فوق. الملعب 105 × 68 م.')}</p></div>
   <div class="card"><h3>${two('The three lines','الخطوط الثلاثة')}</h3>
    <table class="lk-t cs-t"><thead><tr><th>${two('Line (metres from own goal)','الخط (أمتار من مرماه)')}</th><th class="n">${nm(S.team)}</th>${cmp?`<th class="n">${nm(S.cmp)}</th>`:''}</tr></thead><tbody>
     ${lineRow('DEF','Defenders','المدافعون')}${lineRow('MID','Midfielders','لاعبو الوسط')}${lineRow('FWD','Forwards','المهاجمون')}
     <tr data-k="gap"><td>${two('Defenders to forwards','من المدافعين للمهاجمين')}</td><td class="n cs-a">${nb(f1(dpt(main)))}</td>${cmp?`<td class="n cs-b">${nb(f1(dpt(cmp)))}</td>`:''}</tr></tbody></table>
    <p class="mu ins-note">${two('Each line is the action-weighted centre of all its starters\' actions (goalkeepers left out). Defenders = slots 30-39 of the line-up, forwards = slots 100 and up.','كل خط هو مركز أفعال كل لاعبيه الأساسيين مرجّحًا بعدد الأفعال (بدون الحراس). المدافعون = خانات 30-39 في التشكيل، والمهاجمون = خانات 100 وما فوق.')}</p></div>
   ${sorted.length?`<div class="card"><h3>${two('Players','اللاعبون')}</h3><div class="cs-w"><table class="lk-t cs-p"><thead><tr><th>${two('Player','اللاعب')}</th><th class="n">${two('Starts','أساسي')}</th><th class="n">${two('Actions / start','أفعال / مباراة')}</th><th class="n">${two('From own goal (m)','من مرماه (م)')}</th><th class="n">${two('From the left (m)','من اليسار (م)')}</th></tr></thead>
    <tbody>${sorted.map(p=>`<tr data-id="${esc(p.id)}"><td>${nm(p.name)}</td><td class="n">${nb(p.n)}</td><td class="n">${nb(p.per.toFixed(1))}</td><td class="n">${nb(p.x.toFixed(1))}</td><td class="n">${nb(p.y.toFixed(1))}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
  const q=s=>root.querySelector(s);
  q('#csc').onchange=e=>{S.team=e.target.value;S.fm='';draw(root,C)};
  q('#csp').onchange=e=>{S.cmp=e.target.value;draw(root,C)};
  root.querySelectorAll('#csf button').forEach(b=>b.onclick=()=>{S.fm=b.dataset.f;draw(root,C)});
  root.querySelectorAll('#cs3t button').forEach(b=>b.onclick=()=>{if(!INS.pitch3d)return;INS.pitch3d.set(b.dataset.v==='3');draw(root,C)});
  if(d3&&q('#cs3d')){const pin=(p,cls)=>({id:p.id,x:p.x,y:p.y,h:Math.max(10,Math.min(150,p.per*1.2)),label:cls==='a'?surname(p.name):'',cls});
   INS.pitch3d.mount(q('#cs3d'),{pins:[...(cmp?cmp.pts.map(p=>pin(p,'b')):[]),...main.pts.map(p=>pin(p,'a'))],note:two('Pin height = actions per start. Drag to turn the pitch. The team attacks to the right.','ارتفاع العمود = أفعال في المباراة الأساسية. اسحب لتدوير الملعب. الفريق يهاجم نحو اليمين.')})}
 }
 INS.ar({'Club shape':'شكل النادي'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
