/* ===== Threat Map: the Heat Map page gains a threat layer (same page, same place, same controls) =====
   Activity (unchanged, the default): where the selected team or player had the ball, from PitchAPI's heatmap counts.
   Threat: where the shots came from and what they were worth, from PitchAPI's shot data (position in metres, xG, outcome).
   PitchAPI reports xT (expected threat) only as a match total per player, not per pitch zone, so no zone gets an xT value here:
   zones are shaded by the xG of the shots taken from them, and the match xT total is shown as a number.
   The page's own code is not changed: this file adds a layer selector to its controls and draws next to its output. */
(function(){
 if(typeof R!=='object'||typeof R.heatmaps!=='function')return;
 const TM={layer:'a',tok:0};try{TM.layer=localStorage.getItem('plx_tm_layer')||'a'}catch(e){}
 const orig=R.heatmaps;
 R.heatmaps=async function(el){
  await orig.apply(this,arguments);
  const ctl=el.querySelector('.ctl'),hm=document.getElementById('hm'),hout=document.getElementById('hout');if(!ctl||!hm||!hout)return;
  const sel=document.createElement('select');sel.id='tml';sel.setAttribute('aria-label','Layer');
  sel.innerHTML=opts([['a','Layer: activity'],['t','Layer: threat (shots and xG)'],['c','Layer: activity + shots']],['a','t','c'].includes(TM.layer)?TM.layer:'a');
  hm.after(sel);
  const box=document.createElement('div');box.id='tmout';hout.after(box);
  sel.onchange=()=>{TM.layer=sel.value;try{localStorage.setItem('plx_tm_layer',TM.layer)}catch(e){}tmDraw()};
  ['hm','hv','ht','hp','fl'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('change',()=>setTimeout(tmDraw,0))});
  tmDraw();
 };
 const ZX=12,ZY=8,PL=105,PW=68;
 /* warm scale for threat (xG), cool single hue for activity, so the two never read as the same thing */
 const warm=t=>`rgba(229,36,43,${(.12+.55*Math.max(0,Math.min(1,t))).toFixed(2)})`,cool=t=>`rgba(90,169,230,${(.10+.45*Math.max(0,Math.min(1,t))).toFixed(2)})`;
 const OUT={Goal:'Goal',AttemptSaved:'Saved',Miss:'Missed',Post:'Hit the post'};
 const r2=v=>(+v).toFixed(2);
 async function tmDraw(){
  const out=document.getElementById('tmout'),hout=document.getElementById('hout'),sel=document.getElementById('tml');if(!out||!hout||!sel)return;
  const L=sel.value,tok=++TM.tok;
  if(L==='a'){out.innerHTML='';hout.style.display='';return}
  hout.style.display='none';out.innerHTML='<div class="empty skel">Loading…</div>';
  const mid=$('#hm').value,view=$('#hv').value,team=$('#ht').value,pid=view==='b'?'':$('#hp').value,flip=!!($('#fl')&&$('#fl').checked);
  let S=null,H=null,P=null;
  try{[S,H,P]=await Promise.all([loadSh().catch(()=>null),L==='c'?loadHeat().catch(()=>null):null,loadPl().catch(()=>null)])}catch(e){}
  if(tok!==TM.tok||!document.body.contains(out))return;
  const m=D.matches.find(x=>x.match_id===mid);
  if(!S){out.innerHTML='<div class="empty">Shot data is not available for this league, so there is no threat layer. The activity layer still works.</div>';return}
  const all=S.rows.filter(r=>r.m===mid&&r.pd!=='PenaltyShootout');
  if(!all.length){out.innerHTML='<div class="empty">PitchAPI returned no shots for this match, so there is no threat to map.</div>';return}
  /* which shots, in which frame: one team attacking → (as stored), or both teams in the home-attacks-right frame */
  const home=m?m.home:null,sides=view==='b'?[home,m?m.away:null].filter(Boolean):[team];
  const pick=r=>!r.og&&sides.includes(r.c)&&(!pid||r.pid===pid);
  const shots=all.filter(pick).map(r=>{let x=r.x,y=r.y;if(view==='b'&&r.c!==home){x=PL-x;y=PW-y}if(flip)y=PW-y;return Object.assign({},r,{X:x,Y:y})}).filter(r=>r.X!=null&&r.Y!=null);
  const who=pid?(all.find(r=>r.pid===pid)||{}).pn||($('#hp').selectedOptions[0]||{}).textContent||'':view==='b'?'Both teams':team;
  /* activity underneath (combined layer only), drawn with the page's own cell binning */
  let under='',actNote='';
  if(L==='c'&&H&&H.rows){const GL=H.grid.l,GW=H.grid.w;
   if(view==='b'){const hr=H.rows.filter(r=>r.m===mid&&r.t==='h');if(hr.length){const c=heatCells(hr,GL,GW);under=tmCells(c,GL,GW,flip);actNote=c.total+' actions'}}
   else{const rows=H.rows.filter(r=>r.m===mid&&r.t!=='h'&&(r.t==='t'?r.n:r.c)===team&&(pid?(r.t==='p'&&r.k===pid):r.t==='t'));if(rows.length){const c=heatCells(rows,GL,GW);under=tmCells(c,GL,GW,flip);actNote=c.total+' actions'}}
   if(!under)actNote='no activity data for this selection';}
  /* zones shaded by the xG of the shots taken from them */
  const Z=new Map();shots.forEach(r=>{const zx=Math.min(ZX-1,Math.floor(r.X/PL*ZX)),zy=Math.min(ZY-1,Math.floor(r.Y/PW*ZY)),k=zx+'|'+zy;const o=Z.get(k)||{zx,zy,xg:0,n:0};o.xg+=r.xg||0;o.n++;Z.set(k,o)});
  const zmax=Math.max(.0001,...[...Z.values()].map(z=>z.xg)),cw=PL/ZX,ch=PW/ZY;
  let zones='';if(L==='t')Z.forEach(z=>{zones+=`<rect x="${(z.zx*cw).toFixed(2)}" y="${(z.zy*ch).toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${warm(z.xg/zmax)}"><title>${z.n} shot${z.n===1?'':'s'} from this zone, xG ${r2(z.xg)}</title></rect>`});
  const top=[...Z.values()].sort((a,b)=>b.xg-a.xg)[0];
  /* shots: size = xG, filled = goal, ring = the page background so overlapping shots stay readable */
  let dots='';[...shots].sort((a,b)=>(a.ev==='Goal')-(b.ev==='Goal')||a.xg-b.xg).forEach(r=>{const rad=(.9+Math.sqrt(Math.max(0,r.xg||0))*3.4).toFixed(2),g=r.ev==='Goal';
   dots+=`<circle class="tm-shot${g?' g':''}" cx="${r.X.toFixed(2)}" cy="${r.Y.toFixed(2)}" r="${rad}"><title>${esc(r.pn||'')} · ${Math.round(r.mn||0)}' · xG ${r2(r.xg||0)} · ${OUT[r.ev]||esc(r.ev||'')}${r.st?' · '+esc(r.st):''}</title></circle>`});
  const dir=view==='b'?'r':'r',svg=pitchSvg(dots,'',under+zones,dir,true);
  /* numbers: shots, goals, xG; xT as PitchAPI's match total (players of the selection) */
  const n=shots.length,goals=shots.filter(r=>r.ev==='Goal').length,ot=shots.filter(r=>r.ot).length,xg=shots.reduce((s,r)=>s+(r.xg||0),0),big=shots.filter(r=>r.xg>=.3).length;
  let xt=null;if(P&&P.rows&&view!=='b'){const ix=P.ix;let s=0,k=0;P.rows.forEach(r=>{if(r[ix.m]===mid&&r[ix.c]===team&&(!pid||r[ix.i]===pid)&&r[ix.xt]!=null){s+=r[ix.xt];k++}});if(k)xt=s}
  const kpi=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  out.innerHTML=`<div class="mu tm-head"><b>${esc(who)}</b> · <span>${L==='t'?'Threat: where the shots came from and their xG':'Activity (blue) with the shots on top'}</span>${actNote?` · <span>${esc(actNote)}</span>`:''}</div>
   <div class="grid tm-k">${kpi(n,'Shots')}${kpi(goals,'Goals')}${kpi(ot,'On target')}${kpi(r2(xg),'xG')}${kpi(n?r2(xg/n):'N/A','xG per shot')}${kpi(big,'Big chances (xG 0.30+)')}${xt!=null?kpi(r2(xt),'xT, match total (PitchAPI)'):''}</div>
   ${n?'':`<div class="empty">${esc(who)} <span>had no shots in this match: no threat to show.</span></div>`}
   <div class="tm-leg">${L==='t'?`<span><i class="tm-sw" style="background:linear-gradient(90deg,${warm(0)},${warm(1)})"></i>xG of the shots from a zone</span>`:`<span><i class="tm-sw" style="background:linear-gradient(90deg,${cool(0)},${cool(1)})"></i>Activity: actions in a cell</span>`}<span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" class="tm-shot g"/></svg>Goal</span><span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" class="tm-shot"/></svg>No goal</span><span>Bigger circle = higher xG</span></div>
   <div class="tm-pitch">${svg}</div>
   ${top&&n?`<div class="mu tm-top"><span>Most dangerous zone:</span> ${Math.round(top.zx*cw)}–${Math.round((top.zx+1)*cw)} m <span>from his own goal line,</span> ${top.n} <span>shots</span>, xG ${r2(top.xg)}</div>`:''}
   ${n?`<details class="tm-list"><summary>Every shot</summary>${tbl([['Minute',1],['Player'],['Situation'],['xG',1],['Outcome']],[...shots].sort((a,b)=>(a.mn||0)-(b.mn||0)).map(r=>[Math.round(r.mn||0)+"'",esc(r.pn||''),esc(r.st||''),r2(r.xg||0),OUT[r.ev]||esc(r.ev||'')]))}</details>`:''}
   <p class="mu tm-note"><span>Activity and threat are different things: the busiest cells are often far from goal.</span> <span>PitchAPI gives xT only as a match total per player, not per zone, so zones are shaded by the xG of the shots taken from them, not by an invented threat value.</span> <span>xG is the probability that a shot of that kind becomes a goal, not a certainty.</span> <span>Own goals and penalty shoot-outs are left out.</span></p>`;
 }
 function tmCells(c,GL,GW,flip){const cw=PL/GL,ch=PW/GW;let g='';c.acc.forEach((v,i)=>{if(!v)return;const x=i%GL,y=Math.floor(i/GL),yy=flip?GW-1-y:y;g+=`<rect x="${(x*cw).toFixed(2)}" y="${(yy*ch).toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${cool(v/c.max)}"><title>${v} actions</title></rect>`});return g}
 /* Arabic for this file only; never replaces a translation the site already has */
 if(typeof AR==='object')Object.entries({
  "Layer: activity":"الطبقة: النشاط","Layer: threat (shots and xG)":"الطبقة: الخطورة (التسديدات وxG)","Layer: activity + shots":"الطبقة: النشاط + التسديدات","Layer":"الطبقة",
  "Threat: where the shots came from and their xG":"الخطورة: من وين جات التسديدات وقيمة xG حقتها","Activity (blue) with the shots on top":"النشاط (بالأزرق) والتسديدات فوقه",
  "# actions":"# فعل","no activity data for this selection":"لا توجد بيانات نشاط لهذا الاختيار","Both teams":"الفريقان",
  "Shots":"التسديدات","Goals":"الأهداف","On target":"على المرمى","xG per shot":"xG لكل تسديدة","Big chances (xG #+)":"فرص كبيرة (xG #+)","xT, match total (PitchAPI)":"xT، مجموع المباراة (PitchAPI)",
  "had no shots in this match: no threat to show.":"ما سدد في هذي المباراة: لا توجد خطورة لعرضها.",
  "xG of the shots from a zone":"xG التسديدات من المنطقة","Activity: actions in a cell":"النشاط: الأفعال في الخانة","Goal":"هدف","No goal":"بدون هدف","Bigger circle = higher xG":"دائرة أكبر = xG أعلى",
  "Most dangerous zone:":"أخطر منطقة:","from his own goal line,":"من خط مرماه،","shots":"تسديدات","Every shot":"كل التسديدات","Minute":"الدقيقة","Player":"اللاعب","Situation":"الحالة","Outcome":"النتيجة",
  "Saved":"تصدّى لها الحارس","Missed":"خارج المرمى","Hit the post":"القائم",
  "Activity and threat are different things: the busiest cells are often far from goal.":"النشاط والخطورة شيئين مختلفين: الخانات الأكثر نشاطًا غالبًا بعيدة عن المرمى.",
  "PitchAPI gives xT only as a match total per player, not per zone, so zones are shaded by the xG of the shots taken from them, not by an invented threat value.":"PitchAPI يعطي xT كمجموع للمباراة لكل لاعب فقط، مو لكل منطقة، فالمناطق ملوّنة حسب xG التسديدات منها، مو بقيمة خطورة مخترعة.",
  "xG is the probability that a shot of that kind becomes a goal, not a certainty.":"xG احتمال إن تسديدة من هذا النوع تصير هدف، وليس تأكيدًا.",
  "Own goals and penalty shoot-outs are left out.":"الأهداف العكسية وركلات الترجيح غير محسوبة.",
  "Shot data is not available for this league, so there is no threat layer. The activity layer still works.":"بيانات التسديد غير متوفرة لهذا الدوري، فما فيه طبقة خطورة. طبقة النشاط تشتغل عادي.",
  "PitchAPI returned no shots for this match, so there is no threat to map.":"PitchAPI ما رجّع تسديدات لهذي المباراة، فما فيه خطورة نرسمها.",
  "# shots from this zone, xG #":"# تسديدات من هذه المنطقة، xG #","# shot from this zone, xG #":"تسديدة واحدة من هذه المنطقة، xG #"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
/* ===== Smooth heat map: soft blobs on a dark pitch (transparent = no activity, green → yellow → orange → red = busiest) =====
   PitchAPI bins actions on a 16×12 grid and has no exact touch positions, so this is a density estimate from those cells: each
   cell's count is spread evenly over its area, then smoothed with a Gaussian kernel (σ ≈ 4 m) at 6 pixels a metre, so no square
   or pixel of the grid shows. Red = the densest spot of the map (with two pitches, the scale follows the busiest cell of both). Each spot still shows its cell's exact count on hover. Old cells without canvas. */
const HEAT_STOPS=[[0,[0,180,130,0]],[.12,[0,185,135,.5]],[.3,[40,200,100,.78]],[.5,[150,215,60,.88]],[.66,[245,210,45,.93]],[.83,[245,140,40,.97]],[1,[220,40,38,1]]];
const HEAT_TOP=.85,HEAT_PX=6,HEAT_SIGMA=4,HEAT_BG='#2b2f35';
function heatRGBA(t){t=Math.max(0,Math.min(1,t));for(let i=1;i<HEAT_STOPS.length;i++)if(t<=HEAT_STOPS[i][0]){const [a,ca]=HEAT_STOPS[i-1],[b,cb]=HEAT_STOPS[i],u=(t-a)/((b-a)||1);return ca.map((v,k)=>v+(cb[k]-v)*u)}return HEAT_STOPS[HEAT_STOPS.length-1][1]}
const heatGrad=()=>'linear-gradient(90deg,'+HEAT_STOPS.map(([p,c])=>`rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3]}) ${Math.round(p*100)}%`).join(',')+')';
function heatLegend2(max){return `<div style="max-width:420px;margin:4px 0 8px"><div style="height:8px;border-radius:4px;background:${heatGrad()},${HEAT_BG}"></div><div class="mu" style="display:flex;justify-content:space-between;font-size:12px"><span>No actions</span><span>Busiest area (top cell: ${max} actions)</span></div><div class="mu" style="font-size:11.5px;margin-top:2px">A smoothed density from PitchAPI's 16×12 cells (it gives no exact touch positions); hover a spot for its cell's exact count.</div></div>`}
/* separable Gaussian blur of a W×H field */
function heatBlur(F,W,H,s){const r=Math.ceil(3*s),k=new Float32Array(2*r+1);let z=0;for(let i=-r;i<=r;i++){k[i+r]=Math.exp(-i*i/(2*s*s));z+=k[i+r]}for(let i=0;i<k.length;i++)k[i]/=z;
 const T=new Float32Array(W*H);for(let y=0;y<H;y++){const o=y*W;for(let x=0;x<W;x++){let a=0;for(let i=-r;i<=r;i++){const xx=x+i;if(xx>=0&&xx<W)a+=F[o+xx]*k[i+r]}T[o+x]=a}}
 const O=new Float32Array(W*H);for(let x=0;x<W;x++)for(let y=0;y<H;y++){let a=0;for(let i=-r;i<=r;i++){const yy=y+i;if(yy>=0&&yy<H)a+=T[yy*W+x]*k[i+r]}O[y*W+x]=a}return O}
if(typeof heatRects==='function'){const heatCellsOrig=heatRects;
 heatRects=function(c,GL,GW,max,flip){
  let cv=null;try{cv=document.createElement('canvas')}catch(e){}const g=cv&&cv.getContext&&cv.getContext('2d');if(!g||!(max>0))return heatCellsOrig(c,GL,GW,max,flip);
  const W=105*HEAT_PX,H=68*HEAT_PX;cv.width=W;cv.height=H;
  const deposit=cells=>{const F=new Float32Array(W*H);cells.forEach(([x,y,n])=>{const x0=Math.round(x*W/GL),x1=Math.round((x+1)*W/GL),y0=Math.round(y*H/GW),y1=Math.round((y+1)*H/GW),d=n/((x1-x0)*(y1-y0));for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)F[yy*W+xx]+=d});return heatBlur(F,W,H,HEAT_SIGMA*HEAT_PX)};
  const cells=[];c.acc.forEach((n,i)=>{if(n>0){const x=i%GL,y=Math.floor(i/GL);cells.push([x,flip?GW-1-y:y,n])}});
  const D=deposit(cells);let dm=0;for(let i=0;i<D.length;i++)if(D[i]>dm)dm=D[i];
  /* red at HEAT_TOP of this map's densest spot; with two pitches (shared max) a pitch whose busiest cell is lower stays cooler */
  const scale=Math.max(1e-9,dm*HEAT_TOP*(max/Math.max(1,c.max))),img=g.createImageData(W,H);
  for(let i=0;i<D.length;i++){const t=Math.pow(D[i]/scale,.8),col=heatRGBA(t),o=i*4;img.data[o]=col[0];img.data[o+1]=col[1];img.data[o+2]=col[2];img.data[o+3]=Math.round(col[3]*255)}
  g.putImageData(img,0,0);
  const cw=105/GL,ch=68/GW;let hover='';
  c.acc.forEach((n,i)=>{if(!n)return;const x=i%GL,y=Math.floor(i/GL),yy=flip?GW-1-y:y;hover+=`<rect x="${(x*cw).toFixed(3)}" y="${(yy*ch).toFixed(3)}" width="${cw.toFixed(3)}" height="${ch.toFixed(3)}" fill="transparent"><title>cell ${x},${y}: ${n} actions</title></rect>`});
  return `<rect x="-2" y="-2" width="109" height="73" fill="${HEAT_BG}"/><image class="heat-smooth" href="${cv.toDataURL('image/png')}" x="0" y="0" width="105" height="68" preserveAspectRatio="none"/>`+hover;
 }}
if(typeof AR==='object')Object.entries({"No actions":"بدون أفعال","#+ actions in one cell":"#+ فعل في الخانة الواحدة","Busiest area (top cell: # actions)":"أكثر منطقة نشاطًا (أعلى خانة: # فعل)","A smoothed density from PitchAPI's #×# cells (it gives no exact touch positions); hover a spot for its cell's exact count.":"كثافة منعّمة من خانات PitchAPI ‏#×# (ما يعطي مواقع اللمسات الدقيقة)؛ مرّر على أي نقطة لترى العدد الدقيق لخانتها."}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
