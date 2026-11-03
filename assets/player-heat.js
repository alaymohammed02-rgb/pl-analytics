/* ===== Heatmaps: a "Season average" view, one heat map for every player =====
   The Heatmaps page shows one match at a time. This adds a second tab, "Season average": pick a club and see every player of it, each with the heat map of his season averaged over the
   matches he has a map for (PitchAPI's heat counts of every match he appears in, added up and divided by the number of those matches, each already turned so he attacks to the right),
   the number of matches, his actions a match, and a ring where his average position is (the centre of his actions: where the ball was touched, not where he stood).
   Each map is coloured against that player's own busiest area, so compare WHERE players act, not how much; the numbers say how much. A player who changed club has one map per club.
   Nothing is estimated: the maps use only the matches the heat file has (the page says how many of the league's matches that is). The match view and the Threat layer stay as they were
   (the Match tab); this file wraps R.heatmaps, adds the tab bar under the title and puts the old page into its first pane. */
(function(){
 if(typeof R!=='object'||typeof R.heatmaps!=='function'||typeof heatCells!=='function'||typeof pitchSvg!=='function'||typeof heatRects!=='function'||typeof loadHeat!=='function'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const getTab=()=>{try{return localStorage.getItem('plx_hs')==='season'?'season':'match'}catch(e){return 'match'}};
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
 async function season(box){
  const lg=D.id;let H=null;
  try{H=await loadHeat()}catch(e){box.innerHTML=`<div class="empty">${two('Could not load the heat map data.','ما قدرت أحمّل بيانات الخرائط الحرارية.')}</div>`;return}
  if(!box.isConnected||D.id!==lg)return;
  if(!H||!Array.isArray(H.rows)||!H.rows.length){box.innerHTML=`<div class="empty">${two('No heat map data for this league yet.','ما فيه بيانات خرائط حرارية لهذا الدوري للحين.')}</div>`;return}
  const all=groups(H),clubs=[...new Set(all.map(p=>p.c))].sort(cmp),haveM=new Set(H.rows.filter(r=>r.t==='p').map(r=>r.m)).size;
  if(!clubs.length){box.innerHTML=`<div class="empty">${two('No player heat maps in the data yet.','ما فيه خرائط حرارية للاعبين في البيانات للحين.')}</div>`;return}
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
  bar.innerHTML=[['match','Match','المباراة'],['season','Season average','متوسط الموسم']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${tab0===k}" class="${tab0===k?'on':''}">${two(e,a)}</button>`).join('');
  const mp=document.createElement('div');mp.id='hsM';const sp=document.createElement('div');sp.id='hsS';
  while(h2.nextSibling)mp.appendChild(h2.nextSibling);
  h2.after(bar);bar.after(mp);mp.after(sp);
  let loaded=false;
  const show=k=>{mp.hidden=k!=='match';sp.hidden=k!=='season';if(k==='season'&&!loaded){loaded=true;season(sp)}else if(k==='season'&&sp.querySelector('#hsf')){const f=sp.querySelector('#hsf');f.checked=flipOn();f.dispatchEvent(new Event('change'))}};
  bar.querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=b.dataset.k;setTab(k);bar.querySelectorAll('button').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});show(k)});
  show(tab0);
 };
 INS.playerHeat={groups};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
