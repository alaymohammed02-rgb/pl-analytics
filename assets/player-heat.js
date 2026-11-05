/* ===== Heatmaps: a "Season average" view, one heat map for every player =====
   The Heatmaps page shows one match at a time. This adds a second tab, "Season average": pick a club and see every player of it, each with the heat map of his season averaged over the
   matches he has a map for (PitchAPI's heat counts of every match he appears in, added up and divided by the number of those matches, each already turned so he attacks to the right),
   the number of matches, his actions a match, and a ring where his average position is (the centre of his actions: where the ball was touched, not where he stood).
   Each map is coloured against that player's own busiest area, so compare WHERE players act, not how much; the numbers say how much. A player who changed club has one map per club.
   Nothing is estimated: the maps use only the matches the heat file has (the page says how many of the league's matches that is). The match view and the Threat layer stay as they were
   (the Match tab); this file wraps R.heatmaps, adds the tab bar under the title and puts the old page into its first pane.
   Third tab, "Compare": two players (any club of the league) side by side, each with his own map, and a third pitch with the DIFFERENCE: each map is first turned into shares (a cell's
   actions a match divided by all his actions a match, so a busy player and a quiet one are comparable), the third pitch shades each cell by (share of A - share of B), A's colour where A
   spends more of his actions, B's where B does. Overlap = the sum over cells of the smaller of the two shares (100% = the same shape, 0 = never in the same cell); the distance between the
   two average positions is in metres and which one is further up the pitch. Where the ball was touched, not where the players stood; compare shapes, not how much. */
(function(){
 if(typeof R!=='object'||typeof R.heatmaps!=='function'||typeof heatCells!=='function'||typeof pitchSvg!=='function'||typeof heatRects!=='function'||typeof loadHeat!=='function'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const getTab=()=>{try{const v=localStorage.getItem('plx_hs');return v==='season'||v==='compare'?v:'match'}catch(e){return 'match'}};
 const setTab=k=>{try{localStorage.setItem('plx_hs',k)}catch(e){}};
 const S={club:'',min:1,tok:0};
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 /* every player-club pair of the heat file: the rows, the matches, the averaged cells and the average position (in metres, 105 x 68) */
 function groups(H){
  const GL=H.grid.l,GW=H.grid.w,by=new Map();
  H.rows.forEach(r=>{if(r.t!=='p'||!Array.isArray(r.h)||!r.k||!r.c)return;const key=r.c+'\u0001'+r.k;if(!by.has(key))by.set(key,{k:r.k,c:r.c,n:r.n,rows:[],ms:new Set()});const g=by.get(key);g.rows.push(r);g.ms.add(r.m)});
  const out=[];
  by.forEach(g=>{
   const c=heatCells(g.rows,GL,GW);if(!(c.max>0))return;
   const n=g.ms.size,avg=c.acc.map(v=>v/n);
   let sx=0,sy=0;c.acc.forEach((v,i)=>{if(v){sx+=v*((i%GL)+.5)*105/GL;sy+=v*(Math.floor(i/GL)+.5)*68/GW}});
   out.push({k:g.k,c:g.c,name:g.n,n,total:c.total,perMatch:c.total/n,avg,max:Math.max(...avg),cx:sx/c.total,cy:sy/c.total,GL,GW});
  });
  out.sort((a,b)=>b.n-a.n||b.total-a.total||cmp(a.name,b.name)||cmp(a.k,b.k));
  return out;
 }
 const legend=()=>{const g=typeof heatGrad==='function'?heatGrad():'linear-gradient(90deg,#ffe66d,#ff8c42,#e5242b)';
  return `<div class="hs-lg"><div style="height:8px;border-radius:4px;background:${g}"></div><div class="mu" style="display:flex;justify-content:space-between;font-size:12px"><span>${two('less','أقل')}</span><span>${two("this player's busiest area",'أكثر منطقة نشاطًا للاعب')}</span></div></div>`};
 function pitchOf(p,flip){
  const c={acc:p.avg.map(v=>Math.round(v*1000)/1000),total:p.total/p.n,max:p.max};
  const cy=flip?68-p.cy:p.cy;
  const ring=`<g class="hs-avgpos"><circle cx="${p.cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="2.1" fill="none" stroke="#fff" stroke-width=".6"/><circle cx="${p.cx.toFixed(2)}" cy="${cy.toFixed(2)}" r=".7" fill="#fff"/><title>${ar()?'متوسط المركز':'average position'}</title></g>`;
  return pitchSvg(ring,'',heatRects(c,p.GL,p.GW,c.max,flip),'r',true);
 }
 const f1=x=>x.toFixed(1);
 /* the heat file of the open league and its player groups, worked out once per file; null (with the reason written into the box) when there is nothing to show */
 const PREP=new WeakMap();
 async function prep(box){
  const lg=D.id;let H=null;
  try{H=await loadHeat()}catch(e){box.innerHTML=`<div class="empty">${two('Could not load the heat map data.','ما قدرت أحمّل بيانات الخرائط الحرارية.')}</div>`;return null}
  if(!box.isConnected||D.id!==lg)return null;
  if(!H||!Array.isArray(H.rows)||!H.rows.length){box.innerHTML=`<div class="empty">${two('No heat map data for this league yet.','ما فيه بيانات خرائط حرارية لهذا الدوري للحين.')}</div>`;return null}
  if(!PREP.has(H)){const all=groups(H);PREP.set(H,{all,clubs:[...new Set(all.map(p=>p.c))].sort(cmp),haveM:new Set(H.rows.filter(r=>r.t==='p').map(r=>r.m)).size})}
  const P=PREP.get(H);
  if(!P.clubs.length){box.innerHTML=`<div class="empty">${two('No player heat maps in the data yet.','ما فيه خرائط حرارية للاعبين في البيانات للحين.')}</div>`;return null}
  return P;
 }
 async function season(box){
  const P0=await prep(box);if(!P0)return;
  const {all,clubs,haveM}=P0;
  if(!clubs.includes(S.club))S.club=clubs[0];
  box.innerHTML=`<p class="mu hs-n">${two(`Each map is the player's season, averaged over the matches PitchAPI has a heat map for (${haveM} of the league's ${D.matches.length} matches). Counts are PitchAPI's cells, each turned so the player attacks to the right; the ring is the centre of his actions (where the ball was touched, not where he stood). Each map is coloured against that player's own busiest area, so compare where players act, not how much: the number says how much.`,`كل خريطة هي موسم اللاعب بمتوسط المباريات اللي عند PitchAPI لها خريطة حرارية (${nb(haveM)} من ${nb(D.matches.length)} مباراة في الدوري). العدّادات هي خلايا PitchAPI، وكل مباراة مقلوبة بحيث يهاجم اللاعب لليمين؛ والحلقة مركز أفعاله (وين انلمست الكرة، مو وين كان واقف). كل خريطة ملوّنة حسب أكثر منطقة نشاطًا للاعب نفسه، فقارن مكان النشاط مو كميته: الرقم يقول الكمية.`)}</p>
   <div class="card hs-f"><label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="hsc">${clubs.map(c=>`<option value="${esc(c)}"${c===S.club?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('At least','على الأقل')}</span><select id="hsm">${[1,3,5,10].map(v=>`<option value="${v}"${v===S.min?' selected':''}>${ar()?v+' مباراة':v+(v===1?' match':' matches')}</option>`).join('')}</select></label>
    <label class="mu hs-fl"><input type="checkbox" id="hsf"${flipOn()?' checked':''} style="min-height:0"> ${two('Flip left/right','اقلب اليمين واليسار')}</label>
    <span class="mu" id="hscount" data-n="0"></span></div>
   ${legend()}<div class="hs-g" id="hsg"></div>`;
  const q=s=>box.querySelector(s);
  const draw=()=>{
   const tok=++S.tok,flip=q('#hsf').checked,list=all.filter(p=>p.c===S.club&&p.n>=S.min),g=q('#hsg');
   q('#hscount').dataset.n=list.length;q('#hscount').innerHTML=two(`${list.length} players`,`${nb(list.length)} لاعب`);
   if(!list.length){g.innerHTML=`<div class="empty">${two('No player of this club has that many matches with a heat map.','ما فيه لاعب في هذا النادي عنده هالعدد من المباريات بخريطة حرارية.')}</div>`;return}
   g.innerHTML=list.map(p=>`<a class="card hs-c" href="#/player/${encodeURIComponent(p.k+'||'+p.c)}" data-k="${esc(p.k)}" data-c="${esc(p.c)}" data-n="${p.n}" data-act="${p.perMatch.toFixed(1)}" data-cx="${f1(p.cx)}" data-cy="${f1(p.cy)}"><b class="hs-nm">${nm(p.name)}</b>
     <span class="mu hs-m">${two(`${p.n} ${p.n===1?'match':'matches'} · ${f1(p.perMatch)} actions a match`,`${nb(p.n)} ${p.n===1?'مباراة':'مباريات'} · ${nb(f1(p.perMatch))} فعل بالمباراة`)}</span><span class="hs-p" aria-hidden="false"></span></a>`).join('');
   /* the maps are smoothed on a canvas (about 40 ms each): draw a few at a time so the page stays responsive */
   const slots=[...g.querySelectorAll('.hs-c')];let i=0;
   const step=()=>{if(tok!==S.tok||!g.isConnected)return;for(let n=0;n<3&&i<slots.length;n++,i++){const p=list[i];slots[i].querySelector('.hs-p').innerHTML=pitchOf(p,flip)}if(i<slots.length)setTimeout(step,0);else g.dataset.done='1'};
   g.dataset.done='';step();
  };
  q('#hsc').onchange=e=>{S.club=e.target.value;draw()};
  q('#hsm').onchange=e=>{S.min=+e.target.value;draw()};
  q('#hsf').onchange=e=>{flipSet(e.target.checked);draw()};
  draw();
 }
 /* ---- Compare ---- */
 const CA=[76,201,240],CB=[255,159,28],rgb=c=>'rgb('+c.join(',')+')';
 const C2={a:'',b:'',fa:'',fb:'',tok:0};
 const shares=p=>{const t=p.avg.reduce((x,y)=>x+y,0);return p.avg.map(v=>v/t)};
 /* the difference map: one pixel per cell, A's colour where he has the larger share, B's where B does, opacity by the size of the gap; smoothed by drawing the small image enlarged */
 function diffSvg(pa,pb,sa,sb,flip){
  const GL=pa.GL,GW=pa.GW,d=sa.map((v,i)=>v-sb[i]),dm=Math.max(1e-9,...d.map(Math.abs)),cw=105/GL,ch=68/GW;
  let img='';
  try{const sm=document.createElement('canvas');sm.width=GL;sm.height=GW;const g=sm.getContext('2d'),im=g.createImageData(GL,GW);
   d.forEach((v,i)=>{const x=i%GL,y=Math.floor(i/GL),yy=flip?GW-1-y:y,o=(yy*GL+x)*4,c=v>=0?CA:CB,a=Math.round(255*Math.min(1,.12+.88*Math.pow(Math.abs(v)/dm,.7)*(Math.abs(v)>1e-9?1:0)));im.data[o]=c[0];im.data[o+1]=c[1];im.data[o+2]=c[2];im.data[o+3]=a});
   g.putImageData(im,0,0);const big=document.createElement('canvas');big.width=105*6;big.height=68*6;const b=big.getContext('2d');b.imageSmoothingEnabled=true;b.imageSmoothingQuality='high';b.drawImage(sm,0,0,big.width,big.height);
   img=`<image class="hs-diff" href="${big.toDataURL('image/png')}" x="0" y="0" width="105" height="68" preserveAspectRatio="none"/>`}catch(e){}
  let cells='';
  d.forEach((v,i)=>{const x=i%GL,y=Math.floor(i/GL),yy=flip?GW-1-y:y;
   if(!img&&Math.abs(v)>1e-9)cells+=`<rect x="${(x*cw).toFixed(3)}" y="${(yy*ch).toFixed(3)}" width="${cw.toFixed(3)}" height="${ch.toFixed(3)}" fill="${rgb(v>=0?CA:CB)}" fill-opacity="${(.12+.88*Math.pow(Math.abs(v)/dm,.7)).toFixed(2)}"/>`;
   if(sa[i]>0||sb[i]>0)cells+=`<rect class="hs-dc" data-i="${i}" x="${(x*cw).toFixed(3)}" y="${(yy*ch).toFixed(3)}" width="${cw.toFixed(3)}" height="${ch.toFixed(3)}" fill="transparent"><title>${ar()?'الخلية':'cell'} ${x},${y}: A ${(sa[i]*100).toFixed(2)}% · B ${(sb[i]*100).toFixed(2)}%</title></rect>`});
  const ring=(p,c)=>`<g><circle cx="${p.cx.toFixed(2)}" cy="${(flip?68-p.cy:p.cy).toFixed(2)}" r="2.1" fill="none" stroke="${rgb(c)}" stroke-width=".7"/><circle cx="${p.cx.toFixed(2)}" cy="${(flip?68-p.cy:p.cy).toFixed(2)}" r=".7" fill="${rgb(c)}"/></g>`;
  return pitchSvg(ring(pa,CA)+ring(pb,CB),'',`<rect x="-2" y="-2" width="109" height="73" fill="#2b2f35"/>`+img+cells,'r',true);
 }
 async function compare(box){
  const P0=await prep(box);if(!P0)return;
  const {all,clubs}=P0,by=new Map(all.map(p=>[p.c+'\u0001'+p.k,p])),key=p=>p.c+'\u0001'+p.k;
  if(!by.has(C2.a)||!by.has(C2.b)){const first=all.filter(p=>p.c===clubs[0]);C2.a=key(first[0]);C2.b=key(first[1]||first[0])}
  const opt=(c,sel)=>all.filter(p=>p.c===c).map(p=>`<option value="${esc(key(p))}"${key(p)===sel?' selected':''}>${esc(p.name)} · ${p.n}</option>`).join('');
  const pick=(id,col,sel,label)=>{const p=by.get(sel);return `<div class="hs-pk"><b style="color:${rgb(col)}">${label}</b><label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="hc${id}c">${clubs.map(c=>`<option value="${esc(c)}"${c===p.c?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Player · matches','اللاعب · المباريات')}</span><select id="hc${id}p">${opt(p.c,sel)}</select></label></div>`};
  box.innerHTML=`<p class="mu hs-n">${two(`Two players of this league side by side. Each map is the player's season averaged over his matches (as in Season average). The third pitch shows the difference: every map is first turned into shares (a cell's actions divided by all his actions), so a busy player and a quiet one compare fairly; a cell is coloured by who spends the larger share of his actions there. This is where the ball was touched, not where the players stood.`,`لاعبين من هذا الدوري جنب بعض. كل خريطة هي موسم اللاعب بمتوسط مبارياته (مثل متوسط الموسم). الملعب الثالث يبيّن الفرق: كل خريطة تتحول أول إلى حصص (أفعال الخلية مقسومة على كل أفعاله) عشان يتقارن اللاعب الكثير النشاط والقليل بعدل؛ وكل خلية تتلوّن حسب مين يصرف حصة أكبر من أفعاله فيها. هذا وين انلمست الكرة، مو وين كان واقف اللاعب.`)}</p>
   <div class="card hs-f hs-cf">${pick('a',CA,C2.a,'A')}${pick('b',CB,C2.b,'B')}
    <label class="mu hs-fl"><input type="checkbox" id="hcf"${flipOn()?' checked':''} style="min-height:0"> ${two('Flip left/right','اقلب اليمين واليسار')}</label></div><div id="hcout"></div>`;
  const q=s=>box.querySelector(s);
  const draw=()=>{
   const pa=by.get(C2.a),pb=by.get(C2.b),flip=q('#hcf').checked,out=q('#hcout');
   const sa=shares(pa),sb=shares(pb);let ov=0;sa.forEach((v,i)=>{ov+=Math.min(v,sb[i])});
   const dx=pa.cx-pb.cx,dy=pa.cy-pb.cy,dist=Math.hypot(dx,dy);
   const dxE=Math.abs(dx)<0.05?'at the same height up the pitch':dx>0?`${nb(f1(Math.abs(dx)))} m further up the pitch than B`:`${nb(f1(Math.abs(dx)))} m further back than B`;
   const card=(p,col,l)=>`<div class="card hs-cc"><b style="color:${rgb(col)}">${l}</b> <b>${nm(p.name)}</b><div class="mu">${nm(p.c)}</div><div class="mu">${two(`${p.n} ${p.n===1?'match':'matches'} · ${f1(p.perMatch)} actions a match`,`${nb(p.n)} ${p.n===1?'مباراة':'مباريات'} · ${nb(f1(p.perMatch))} فعل بالمباراة`)}</div></div>`;
   out.innerHTML=`<div class="hs-cg">${card(pa,CA,'A')}${card(pb,CB,'B')}<div class="card hs-cc"><b>${two('Difference','الفرق')}</b><div class="mu"><span class="hs-sw" style="background:${rgb(CA)}"></span>${two('A spends more here','A يصرف أكثر هنا')} <span class="hs-sw" style="background:${rgb(CB)}"></span>${two('B spends more here','B يصرف أكثر هنا')}</div></div></div>
    <div class="hs-cg"><div>${pitchOf(pa,flip)}</div><div>${pitchOf(pb,flip)}</div><div>${diffSvg(pa,pb,sa,sb,flip)}</div></div>
    <div class="card hs-cs" id="hcsum" data-overlap="${(ov*100).toFixed(1)}" data-dist="${f1(dist)}" data-dx="${f1(dx)}"><p>${two(`The two maps overlap by <b>${f1(ov*100)}%</b> (100% = the same shape; 0% = never in the same cell). Their average positions are <b>${f1(dist)} m</b> apart; A's position is ${dxE}.`,`الخريطتين تتداخلان بنسبة <b>${nb(f1(ov*100))}%</b> (100% = نفس الشكل؛ 0% = ما يلتقون بخلية). متوسط مكانيهما يبعدان <b>${nb(f1(dist))} م</b> عن بعض؛ ${Math.abs(dx)<0.05?'ومتوسط A بنفس ارتفاع B في الملعب.':`ومتوسط A ${dx>0?'أبعد للأمام':'أبعد للخلف'} من B بـ ${nb(f1(Math.abs(dx)))} م.`}`)}</p>
    <p class="mu">${two('Overlap is the sum over cells of the smaller of the two shares. Players of different positions or clubs can look alike or different here for tactical reasons, not only because of who they are.','التداخل هو مجموع الأصغر من الحصتين في كل خلية. لاعبين بمراكز أو أندية مختلفة ممكن يتشابهون أو يختلفون هنا لأسباب تكتيكية، مو بس بسبب مين هم.')}</p></div>`;
  };
  const club=(id,which)=>{const sel=q('#hc'+id+'p');q('#hc'+id+'c').onchange=e=>{const first=all.find(p=>p.c===e.target.value);C2[which]=key(first);sel.innerHTML=opt(e.target.value,C2[which]);draw()};sel.onchange=e=>{C2[which]=e.target.value;draw()}};
  club('a','a');club('b','b');
  q('#hcf').onchange=e=>{flipSet(e.target.checked);draw()};
  draw();
 }

 const prev=R.heatmaps;
 R.heatmaps=async function(el){
  /* the page's own code does not check that the visitor is still here when its file arrives; so the file is fetched first (it is cached, the page then finds it at once) and nothing is drawn for a page that was left */
  const lg=D.id;try{await loadHeat()}catch(e){}
  if(!el.isConnected||D.id!==lg||!/^#\/heatmaps/.test(location.hash||''))return;
  await prev.apply(this,arguments);
  if(!el.isConnected||el.querySelector('#hstabs'))return;
  const h2=el.querySelector('h2');if(!h2||!document.getElementById('hm'))return;
  const tab0=getTab();
  const bar=document.createElement('div');bar.id='hstabs';bar.className='seg hs-tabs';bar.setAttribute('role','group');bar.setAttribute('aria-label',ar()?'الخرائط الحرارية':'Heatmaps');
  bar.innerHTML=[['match','Match','المباراة'],['season','Season average','متوسط الموسم'],['compare','Compare','مقارنة']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${tab0===k}" class="${tab0===k?'on':''}">${two(e,a)}</button>`).join('');
  const mp=document.createElement('div');mp.id='hsM';const sp=document.createElement('div');sp.id='hsS';const cp=document.createElement('div');cp.id='hsC';
  while(h2.nextSibling)mp.appendChild(h2.nextSibling);
  h2.after(bar);bar.after(mp);mp.after(sp);sp.after(cp);
  const loaded={season:false,compare:false};
  const show=k=>{mp.hidden=k!=='match';sp.hidden=k!=='season';cp.hidden=k!=='compare';
   [['season',sp,season,'#hsf'],['compare',cp,compare,'#hcf']].forEach(([n,box,fn,fl])=>{if(k!==n)return;if(!loaded[n]){loaded[n]=true;fn(box)}else{const f=box.querySelector(fl);if(f){f.checked=flipOn();f.dispatchEvent(new Event('change'))}}})};
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=b.dataset.k;setTab(k);bar.querySelectorAll('button').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});show(k)});
  show(tab0);
 };
 INS.playerHeat={groups};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
