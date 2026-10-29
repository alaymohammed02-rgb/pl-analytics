/* ===== Player card (Defensive, Shots and Passing pages): one player's numbers against the players in the same role =====
   Four kinds: defending (opens on the Defensive page), attacking (Shots page), passing and creating (Passing page) and dribbling
   and carrying; each page can show any kind. You pick a player, the measures (3 to 8) and who he is compared with; the card shows
   each measure per 90 minutes with his percentile among those players, and his heat map. "Save image" downloads it as a PNG.
   - Numbers: PitchAPI's per-match player rows, added up as on the table below (aggPl): a measure per 90 = its total ÷ the minutes
     of the matches where PitchAPI gave it × 90. Sums (e.g. tackles + interceptions) add the per-90 figures, as the table does.
     Ratios use the season totals: aerial win % needs 5+ aerial duels, shots on target % and xG per shot 5+ shots, take-on
     success % 5+ take-ons. xAG is missing for whole matches in PitchAPI's data, so its minutes are only those of the matches
     that have it (as everywhere on the site). Each bar is as long as the percentile and coloured red (0) through amber (50) to
     green (100), so it reads before the number. "Duels won" is PitchAPI's figure as given: it is lower than aerial duels won in about
     a third of player-matches, so it does not include them, and nothing is derived from the two together. Nothing is estimated or adjusted: PitchAPI gives no possession per match, so the
     numbers are not possession-adjusted, and it gives no pressing events per player, so the heat map is every action he made
     (PitchAPI's heat map counts), not a pressing map.
   - Roles come from the official line-ups (the player's most frequent role in his starts): goalkeeper = slot 11; centre-back =
     defensive line (slots 30–39) with lateral 0.15–0.85, full-back = the rest of the line; winger = depth 0.6+ and lateral 0.25 or
     less / 0.75 or more; striker = depth 0.8+ in the middle; midfielder = the rest. A player with no start is compared by position.
   - Percentile = (players below + half of those level) ÷ players compared × 100, the player himself left out; shown only when at
     least 5 players have the measure.
   - Compared with: the selected league or the six domestic leagues (not in a past season, whose other leagues would be other
     seasons), with a minimum of minutes. */
(function(){
 if(typeof R!=='object'||typeof R.defense!=='function'||typeof INS!=='object'||typeof INS.pool!=='function')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const S={lg:'',pid:'',grp:'role',scope:'six',min:450,fam:'def',style:'bars',mets:{},tok:0};
 try{const o=JSON.parse(localStorage.getItem('plx_dc_v1')||'null');if(o){['grp','scope'].forEach(k=>{if(typeof o[k]==='string')S[k]=o[k]});if(o.style==='pizza')S.style='pizza';
  if([270,450,900].includes(o.min))S.min=o.min;if(o.mets&&typeof o.mets==='object')S.mets=o.mets}}catch(e){}
 const save=()=>{try{localStorage.setItem('plx_dc_v1',JSON.stringify({grp:S.grp,scope:S.scope,min:S.min,style:S.style,mets:S.mets}))}catch(e){}};
 const sum=(a,ks)=>ks.every(k=>a.has(k))?ks.reduce((x,k)=>x+a.p90(k),0):null;
 const p90=k=>a=>a.p90(k),rat=(n,d,lo,x)=>a=>(a.has(n)&&a.has(d)&&a.s[d]>=lo)?a.s[n]/a.s[d]*x:null;
 /* each kind: its name, the measures [key, English, Arabic, value, unit ('p90', '%' or 'r' = a ratio)] and the default six */
 const FAM={
  def:{en:'Defending',ar:'الدفاع',file:'defensive',met:[
   ['da','Defensive actions','الأفعال الدفاعية',a=>sum(a,['tk','ic','bl','cl']),'p90'],['tk','Tackles','الافتكاكات',p90('tk'),'p90'],
   ['ic','Interceptions','الاعتراضات',p90('ic'),'p90'],['ti','Tackles + interceptions','الافتكاكات + الاعتراضات',a=>sum(a,['tk','ic']),'p90'],
   ['duw','Duels won','الالتحامات المكسوبة',p90('duw'),'p90'],['aerw','Aerial duels won','الكرات الهوائية المكسوبة',p90('aerw'),'p90'],
   ['ap','Aerial duels won %','نسبة الكرات الهوائية المكسوبة',rat('aerw','aer',5,100),'%'],['bl','Blocks','الصد',p90('bl'),'p90'],
   ['cl','Clearances','الإبعاد',p90('cl'),'p90'],['bc','Blocks + clearances','الصد + الإبعاد',a=>sum(a,['bl','cl']),'p90']],
   dflt:['da','tk','ic','duw','aerw','bc']},
  att:{en:'Attacking',ar:'الهجوم',file:'attacking',met:[
   ['gl','Goals','الأهداف',p90('gl'),'p90'],['npxg','Non-penalty xG','xG بدون ركلات الجزاء',p90('npxg'),'p90'],['xg','xG','xG',p90('xg'),'p90'],
   ['sh','Shots','التسديدات',p90('sh'),'p90'],['sot','Shots on target','التسديدات على المرمى',p90('sot'),'p90'],
   ['sotp','Shots on target %','نسبة التسديدات على المرمى',rat('sot','sh',5,100),'%'],['xgps','xG per shot','xG لكل تسديدة',rat('xg','sh',5,1),'r'],
   ['xag','xAG (expected assisted goals)','xAG (أهداف متوقعة من تمريراته)',p90('xag'),'p90'],['sca','Shot-creating actions','أفعال صنعت تسديدة',p90('sca'),'p90'],
   ['gca','Goal-creating actions','أفعال صنعت هدف',p90('gca'),'p90'],['xt','xT (expected threat)','xT (التهديد المتوقع)',p90('xt'),'p90']],
   dflt:['gl','npxg','sh','sot','xag','sca'],roles:['ST','W']},
  mid:{en:'Passing and creating',ar:'التمرير والصناعة',file:'passing',met:[
   ['ps','Passes','التمريرات',p90('ps'),'p90'],['pr','Progressive passes','التمريرات التقدمية',p90('pr'),'p90'],['kp','Key passes','التمريرات المفتاحية',p90('kp'),'p90'],
   ['bx','Passes into the box','التمريرات داخل المنطقة',p90('bx'),'p90'],['tb','Through balls','التمريرات البينية',p90('tb'),'p90'],['cr','Crosses','العرضيات',p90('cr'),'p90'],
   ['ast','Assists','التمريرات الحاسمة',p90('ast'),'p90'],['xag','xAG (expected assisted goals)','xAG (أهداف متوقعة من تمريراته)',p90('xag'),'p90'],
   ['xgc','xG chain','سلسلة xG',p90('xgc'),'p90'],['xgb','xG buildup','بناء xG',p90('xgb'),'p90'],['sca','Shot-creating actions','أفعال صنعت تسديدة',p90('sca'),'p90']],
   dflt:['ps','pr','kp','bx','xgb','sca'],roles:['MID']},
  dri:{en:'Dribbling and carrying',ar:'المراوغة وحمل الكرة',file:'dribbling',met:[
   ['tko','Take-ons attempted','محاولات المراوغة',p90('tko'),'p90'],['tkw','Take-ons won','المراوغات الناجحة',p90('tkw'),'p90'],
   ['tsp','Take-on success %','نسبة نجاح المراوغة',rat('tkw','tko',5,100),'%'],['ca','Carries','حمل الكرة',p90('ca'),'p90'],
   ['pc','Progressive carries','الحمل التقدمي',p90('pc'),'p90'],['cb','Carries into the box','الحمل داخل المنطقة',p90('cb'),'p90'],['xt','xT (expected threat)','xT (التهديد المتوقع)',p90('xt'),'p90']],
   dflt:['tko','tkw','tsp','pc','cb','ca'],roles:['W','ST']}};
 const met=()=>{const F=FAM[S.fam],ks=new Set(F.met.map(m=>m[0]));let L=(S.mets[S.fam]||[]).filter(k=>ks.has(k));if(L.length<3||L.length>8)L=F.dflt.slice();S.mets[S.fam]=L;return L};
 const MK=f=>new Map(FAM[f].met.map(m=>[m[0],m]));
 const RK=['GK','CB','FB','MID','W','ST'];
 const ROLE={GK:['goalkeepers','حراس المرمى','Goalkeeper','حارس مرمى'],CB:['centre-backs','قلوب الدفاع','Centre-back','قلب دفاع'],FB:['full-backs','الأظهرة','Full-back','ظهير'],
  MID:['midfielders','لاعبي الوسط','Midfielder','لاعب وسط'],W:['wingers','الأجنحة','Winger','جناح'],ST:['strikers','المهاجمين','Striker','مهاجم']};
 const POS={GK:['goalkeepers','حراس المرمى'],DF:['defenders','المدافعين'],MF:['midfielders','لاعبي الوسط'],FW:['forwards','المهاجمين']};
 const roleOf=e=>{const s=+e[3],d=+e[4],l=+e[5];if(s===11)return 'GK';if(s>=30&&s<=39)return l>=.15&&l<=.85?'CB':'FB';
  if(d>=.6&&(l<=.25||l>=.75))return 'W';if(d>=.8)return 'ST';return 'MID'};
 /* one league's players: aggPl (the table's own sums) plus each player's role from the line-ups */
 function players(pl,mx,lg){
  const ix={};pl.cols.forEach((c,k)=>ix[c]=k);const AG=aggPl({rows:pl.rows,ix}),RC=new Map();
  if(mx&&mx.m)Object.values(mx.m).forEach(v=>{const lu=v&&v.lu;if(!lu)return;['h','a'].forEach(s=>{const L=lu[s];if(L&&Array.isArray(L.xi))L.xi.forEach(e=>{
   if(!e||e[0]==null||e[3]==null)return;const c=RC.get(e[0])||{};const r=roleOf(e);c[r]=(c[r]||0)+1;RC.set(e[0],c)})})});
  AG.forEach(a=>{const c=RC.get(a.id);a.lg=lg;a.starts=c?Object.values(c).reduce((s,x)=>s+x,0):0;
   a.role=c?Object.entries(c).sort((x,y)=>y[1]-x[1]||RK.indexOf(x[0])-RK.indexOf(y[0]))[0][0]:null});
  return AG;
 }
 const C=new Map();
 function pool(scope,lg){const k=INS.poolKey()+'|'+scope+'|'+(scope==='six'?'':lg);
  if(!C.has(k))C.set(k,(async()=>{
   if(scope==='six'){const P=await INS.pool(['pl','mx']);const out=[];P.leagues.forEach(o=>{if(o.pl)out.push(...players(o.pl,o.mx,o.l.name))});
    if(!out.length)throw new Error('no league');return {all:out,miss:P.miss,n:P.leagues.filter(o=>o.pl).length}}
   const o=await INS.poolOne(lg,['pl','mx']);if(!o||!o.pl)throw new Error('no data');return {all:players(o.pl,o.mx,o.l.name),miss:[],n:1}})()
   .catch(e=>{C.delete(k);throw e}));
  return C.get(k)}
 const pctOf=(v,peers)=>{if(v==null||peers.length<5)return null;let lo=0,eq=0;for(const x of peers){if(x<v)lo++;else if(x===v)eq++}return Math.round((lo+eq/2)/peers.length*100)};
 /* the comparison: who the player is set against, and his value and percentile for every measure */
 function compare(all,me){
  let grp=S.grp;if(grp==='role'&&!me.role)grp='pos';
  const same=a=>grp==='role'?a.role===me.role:grp==='pos'?a.p===me.p:(a.p!=='GK'&&a.role!=='GK');
  const peers=all.filter(a=>a!==me&&!(a.id===me.id&&a.lg===me.lg)&&a.s.mi>=S.min&&same(a));
  const mk=MK(S.fam),rows=met().map(k=>{const m=mk.get(k),v=m[3](me),pv=peers.map(m[3]).filter(x=>x!=null&&isFinite(x));return {k,m,v,p:pctOf(v,pv),n:pv.length}});
  const ok=rows.filter(r=>r.p!=null);
  return {grp,peers,rows,avg:ok.length?Math.round(ok.reduce((s,r)=>s+r.p,0)/ok.length):null};
 }
 /* ---------- the card: one SVG, shown on the page and saved as the image ---------- */
 const FONT='system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",Tahoma,sans-serif';
 const css=(k,d)=>{try{return getComputedStyle(document.documentElement).getPropertyValue(k).trim()||d}catch(e){return d}};
 const x_=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
 /* percentile colour: red (0) through amber (50) to green (100) */
 const pcol=p=>{const S=[[0,[214,69,65]],[50,[232,160,40]],[100,[63,163,77]]];for(let i=1;i<S.length;i++)if(p<=S[i][0]){const [a,c]=S[i-1],[b,d]=S[i],t=(p-a)/(b-a);
  return 'rgb('+c.map((v,k)=>Math.round(v+(d[k]-v)*t)).join(',')+')'}return 'rgb(63,163,77)'};
 const fmtv=q=>q.v==null?'–':q.m[4]==='%'?Math.round(q.v)+'%':q.v.toFixed(2);
 const fit=(s,size,w)=>Math.min(size,Math.floor(w/(Math.max(4,[...String(s)].length)*.56)));
 /* the pizza: one slice per measure, as long as its percentile (the same numbers and colours as the bars), the value and name outside it */
 function pizza(rows,cx,cy,R,o){
  const {A,W,PX,tx,mu,ln,bg,T,av}=o,N=rows.length,two_pi=2*Math.PI,pt=(a,r)=>[cx+(A?-1:1)*r*Math.cos(a),cy+r*Math.sin(a)],f=v=>v.toFixed(1);
  let g='';
  [25,50,75,100].forEach(p=>{g+=`<circle cx="${cx}" cy="${cy}" r="${f(R*p/100)}" fill="none" stroke="${ln}" stroke-width="${p===100?3:1.5}"${p<100?' stroke-dasharray="4 9"':''}/>`});
  rows.forEach((q,i)=>{
   const a0=-Math.PI/2+i*two_pi/N,a1=-Math.PI/2+(i+1)*two_pi/N,am=(a0+a1)/2,gap=.014,r=q.p==null?0:Math.max(R*.06,R*q.p/100),pc=q.p==null?null:pcol(q.p);
   const wedge=rr=>{const [x0,y0]=pt(a0+gap,rr),[x1,y1]=pt(a1-gap,rr);return `M${f(cx)} ${f(cy)} L${f(x0)} ${f(y0)} A${f(rr)} ${f(rr)} 0 0 ${A?0:1} ${f(x1)} ${f(y1)} Z`};
   g+=`<path d="${wedge(R)}" fill="${ln}" fill-opacity=".35"/>`;
   if(pc)g+=`<path class="dc-pz" data-k="${q.k}" data-p="${q.p}" data-r="${f(r)}" d="${wedge(r)}" fill="${pc}" stroke="${bg}" stroke-width="2"/>`;
   /* the percentile in a disc on the slice, never closer to the centre than the middle disc */
   const dd=Math.max(R*.3,r-34),[bx,by]=pt(am,dd);
   g+=`<circle cx="${f(bx)}" cy="${f(by)}" r="27" fill="${pc||ln}" stroke="${bg}" stroke-width="3"/><text x="${f(bx)}" y="${f(by+9)}" font-size="25" font-weight="800" fill="#fff" text-anchor="middle" class="dc-pn">${q.p==null?'–':q.p}</text>`;
   /* the name and the value outside the circle, on the side of the page the slice points to: a long name takes two lines */
   const [lx,ly]=pt(am,R+26),c=Math.cos(am)*(A?-1:1),sn=Math.sin(am),lab=T(q.m[1],q.m[2]),val=fmtv(q),unit=q.v==null||q.m[4]!=='p90'?'':' /90',
    side=c>.3?'r':c<-.3?'l':'m',room=side==='r'?W-PX-lx:side==='l'?lx-PX:W-2*PX,
    anc=side==='m'?'middle':(side==='r')!==A?'start':'end',
    words=lab.split(' '),half=Math.ceil(words.length/2),nl=lab.length*.56*25>room&&words.length>1?[words.slice(0,half).join(' '),words.slice(half).join(' ')]:[lab],
    n=nl.length+1,y0=sn<-.3?ly-6-(n-1)*30:sn>.3?ly+26:ly-(n-1)*15+5;
   nl.forEach((t,k)=>{g+=`<text x="${f(lx)}" y="${f(y0+k*30)}" font-size="${Math.max(17,fit(t,25,room))}" fill="${tx}" text-anchor="${anc}" class="dc-pl"${A?' direction="rtl"':''}>${x_(t)}</text>`});
   g+=`<text x="${f(lx)}" y="${f(y0+(n-1)*30)}" font-size="${Math.max(17,fit(val+unit,27,room))}" font-weight="800" fill="${tx}" text-anchor="${side==='m'?'middle':side==='r'?'start':'end'}" class="dc-pl dc-pv">${x_(val)}<tspan font-weight="400" fill="${mu}">${unit}</tspan></text>`});
  /* the middle: the average percentile */
  g+=`<circle cx="${cx}" cy="${cy}" r="${f(R*.2)}" fill="${bg}" stroke="${ln}" stroke-width="3"/><text x="${cx}" y="${f(cy+14)}" font-size="46" font-weight="800" fill="${av==null?mu:pcol(av)}" text-anchor="middle" class="dc-pa">${av==null?'–':av}</text>`;
  return g;
 }
 function card(me,cmp,heat,meta){
  const A=ar(),W=1080,PX=70,PW=W-2*PX,PH=Math.round(PW*68/105),rows=cmp.rows,NR=rows.length,TH=100;
  const top=290,pt=top+22,mt=pt+PH+96,RH=S.style==='pizza'?840:NR*TH,H=mt+RH+176;
  const bg=css('--sf','#152130'),bg2=css('--bg','#0d1520'),tx=css('--tx','#e8eef5'),mu=css('--mu','#8fa3b8'),th=css('--th','#4cc38a'),ln=css('--ln','rgba(255,255,255,.12)');
  /* mirrored for Arabic: x positions flip; text set right to left anchors 'start' on its right already, numbers (left to right) swap */
  const X=x=>A?W-x:x,anc=a=>A?(a==='start'?'end':a==='end'?'start':a):a,T=(en,ar_)=>A?ar_:en;
  const t=(x,y,s,o={})=>`<text x="${X(x)}" y="${y}" font-size="${o.size||28}" font-weight="${o.w||400}" fill="${o.fill||tx}" text-anchor="${o.a||'start'}"${A?' direction="rtl"':''}${o.op?` opacity="${o.op}"`:''}>${x_(s)}</text>`;
  let g=`<rect width="${W}" height="${H}" fill="${bg2}"/><rect x="24" y="24" width="${W-48}" height="${H-48}" rx="36" fill="${bg}" stroke="${ln}" stroke-width="2"/>`;
  /* header: crest, name, club line, the average percentile as a ring */
  const crest=meta.crest?`<image href="${x_(meta.crest)}" x="${X(A?PX+96:PX)}" y="70" width="96" height="96" preserveAspectRatio="xMidYMid meet"/>`:'';
  const nx=PX+(meta.crest?122:0),nw=W-nx-PX-200;
  g+=crest+t(nx,118,me.n,{size:fit(me.n,56,nw),w:800});
  g+=t(nx,166,[me.club,meta.league+(meta.season?' '+meta.season:'')].join(' · '),{size:27,fill:mu});
  g+=t(nx,206,[T(...(me.role?[ROLE[me.role][2],ROLE[me.role][3]]:[me.p||'',me.p||''])),Math.round(me.s.mi)+T(' min',' دقيقة'),me.games+T(' matches',' مباراة')].join(' · '),{size:27,fill:mu});
  const gx=X(W-PX-82),gy=140,r=66,c=2*Math.PI*r,av=cmp.avg;
  g+=`<circle cx="${gx}" cy="${gy}" r="${r}" fill="none" stroke="${ln}" stroke-width="16"/>`;
  if(av!=null)g+=`<circle cx="${gx}" cy="${gy}" r="${r}" fill="none" stroke="${pcol(av)}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(c*av/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${gx} ${gy})"/>`;
  g+=`<text x="${gx}" y="${gy+16}" font-size="50" font-weight="800" fill="${tx}" text-anchor="middle">${av==null?'–':av}</text>`;
  g+=`<text x="${gx}" y="${gy+r+40}" font-size="22" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(T('average percentile','متوسط المئين'))}</text>`;
  /* the heat map: every action he made, on a pitch attacking to the right (the cells are PitchAPI's 16 × 12 grid) */
  g+=t(PX,top,T('Heat map · every action he made','الخريطة الحرارية · كل لمساته'),{size:30,w:700});
  g+=`<rect x="${PX}" y="${pt}" width="${PW}" height="${PH}" rx="10" fill="${bg2}"/>`;
  if(heat&&heat.max>0){const cw=PW/16,ch=PH/12;
   /* more actions = more of the theme colour; the busiest cells lighten towards white so they stand out on a dark pitch */
   heat.G.forEach((col,x)=>col.forEach((v,w)=>{if(!v)return;const q=v/heat.max,a=.06+.9*Math.min(1,q/.75),hi=Math.max(0,(q-.6)/.4)*.45,
     cx=(PX+x*cw).toFixed(1),cy=(pt+(11-w)*ch).toFixed(1),dw=(cw+.5).toFixed(1),dh=(ch+.5).toFixed(1);
    g+=`<rect class="dc-hc" data-v="${v}" x="${cx}" y="${cy}" width="${dw}" height="${dh}" fill="${th}" fill-opacity="${a.toFixed(3)}"/>`;
    if(hi>.01)g+=`<rect x="${cx}" y="${cy}" width="${dw}" height="${dh}" fill="#fff" fill-opacity="${hi.toFixed(3)}"/>`}))}
  else g+=`<text x="${W/2}" y="${pt+PH/2}" font-size="28" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(T('Heat map not available for this player','الخريطة الحرارية مو متوفرة لهذا اللاعب'))}</text>`;
  const s=PW/105,L='stroke="rgba(255,255,255,.34)" stroke-width="3" fill="none"',px=v=>PX+v*s,py=v=>pt+v*s;
  g+=`<g ${L}><rect x="${PX}" y="${pt}" width="${PW}" height="${PH}" rx="10"/><line x1="${px(52.5)}" y1="${pt}" x2="${px(52.5)}" y2="${pt+PH}"/><circle cx="${px(52.5)}" cy="${py(34)}" r="${9.15*s}"/>
   <rect x="${PX}" y="${py(34-20.16)}" width="${16.5*s}" height="${40.32*s}"/><rect x="${PX}" y="${py(34-9.16)}" width="${5.5*s}" height="${18.32*s}"/>
   <rect x="${px(105-16.5)}" y="${py(34-20.16)}" width="${16.5*s}" height="${40.32*s}"/><rect x="${px(105-5.5)}" y="${py(34-9.16)}" width="${5.5*s}" height="${18.32*s}"/></g>`;
  g+=`<text x="${W-PX}" y="${pt+PH+44}" font-size="26" fill="${mu}" text-anchor="end">${x_(T('attack →','اتجاه الهجوم →'))}</text>`;
  /* the measures: one row each, the value per 90 beside its name, and a bar as long as the percentile, red (low) to green (high),
     so the colour and length say good or poor before the number is read */
  g+=t(PX,mt-6,T(FAM[S.fam].en,FAM[S.fam].ar)+' · '+T('percentile among ','المئين بين ')+meta.who,{size:fit(meta.who,26,PW*1.7),fill:mu});
  if(S.style==='pizza')g+=pizza(rows,W/2,mt+438,262,{A,W,PX,tx,mu,ln,bg,T,X,av});
  else{
  const BW=PW-84;
  rows.forEach((q,i)=>{const y0=mt+18+i*TH,lab=T(q.m[1],q.m[2]),pc=q.p==null?null:pcol(q.p);
   const val=fmtv(q),unit=q.v==null||q.m[4]!=='p90'?'':A?' لكل 90':' /90';
   g+=`<text x="${X(PX)}" y="${y0+30}" font-size="${fit(lab+val,29,BW-60)}" fill="${tx}" text-anchor="start"${A?' direction="rtl"':''}>${x_(lab)}  <tspan font-weight="800" direction="ltr" unicode-bidi="embed">${x_(val)}</tspan><tspan font-weight="400" fill="${mu}">${unit}</tspan></text>`;
   const bx=A?W-PX-BW:PX,w=q.p==null?0:Math.max(14,BW*q.p/100),fx=A?W-PX-w:PX;
   g+=`<rect x="${bx}" y="${y0+46}" width="${BW}" height="28" rx="14" fill="${ln}"/>`;
   if(pc)g+=`<rect class="dc-on" x="${fx.toFixed(1)}" y="${y0+46}" width="${w.toFixed(1)}" height="28" rx="14" fill="${pc}"/>`;
   const cx=X(W-PX-30);
   g+=`<circle cx="${cx}" cy="${y0+60}" r="30" fill="${pc||ln}"/><text x="${cx}" y="${y0+70}" font-size="27" font-weight="800" fill="#fff" text-anchor="middle">${q.p==null?'–':q.p}</text>`});
  }
  /* what the card is and is not */
  const fy=mt+18+RH+20;
  g+=t(PX,fy,T('Per 90 minutes · not possession-adjusted (PitchAPI gives no possession per match)','لكل 90 دقيقة · بدون تعديل حسب الاستحواذ (PitchAPI ما يعطي الاستحواذ لكل مباراة)'),{size:21,fill:mu});
  g+=t(PX,fy+32,S.fam==='def'?T('PitchAPI has no pressing events per player: the heat map is every action, not pressing','PitchAPI ما عنده أحداث ضغط لكل لاعب: الخريطة كل لمساته، مو ضغطه')
   :T('The heat map is every action he made (PitchAPI heat counts)','الخريطة الحرارية كل لمساته (من عدّادات PitchAPI)'),{size:21,fill:mu});
  g+=t(PX,fy+72,'PL Analytics',{size:26,w:800});g+=t(W-PX,fy+72,T('Data: PitchAPI','البيانات: PitchAPI'),{size:22,fill:mu,a:'end'});
  const aria=me.n+': '+rows.map(q=>T(q.m[1],q.m[2])+' '+fmtv(q)+(q.p==null?'':' ('+q.p+')')).join(', ');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${x_(aria)}">${g}</svg>`,W,H};
 }
 /* the player's heat map: his rows of PitchAPI's heat file added up (cells along the pitch × across it) */
 async function heatOf(id){let H=null;try{H=await loadHeat()}catch(e){return null}if(!H||!Array.isArray(H.rows))return null;
  const G=Array.from({length:16},()=>new Array(12).fill(0));let n=0,max=0;
  H.rows.forEach(r=>{if(r.t!=='p'||r.k!==id||!Array.isArray(r.h))return;n++;for(let i=0;i+2<r.h.length;i+=3){const x=r.h[i],w=r.h[i+1];if(x>=0&&x<16&&w>=0&&w<12)G[x][w]+=r.h[i+2]}});
  G.forEach(c=>c.forEach(v=>{if(v>max)max=v}));return n?{G,max,n}:null}
 async function savePng(svg,W,H,name,prefix){
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url});
   const cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.getContext('2d').drawImage(img,0,0,W,H);
   const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob)throw new Error('png');
   const fn=(prefix||FAM[S.fam].file)+'-card-'+String(name).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.png';
   const file=typeof File==='function'?new File([blob],fn,{type:'image/png'}):null;
   if(file&&navigator.canShare&&navigator.canShare({files:[file]})&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({files:[file],title:name});return}catch(e){if(e&&e.name==='AbortError')return}}
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
  }finally{URL.revokeObjectURL(url)}}
 /* the helpers the other cards (press-card.js) use: percentile colour, text fitting, XML escaping, the page's colours, saving as a PNG */
 INS.cardKit={pcol,fit,x_,css,savePng,FONT};
 /* ---------- the section, at the top of the Defensive (defending), Shots (attacking) and Passing (passing) pages ---------- */
 [['defense','def'],['shots','att'],['passing','mid']].forEach(([pg,fam])=>{const orig=R[pg];if(typeof orig!=='function')return;
  R[pg]=async function(el){
   await orig.apply(this,arguments);
   const h2=el.querySelector('h2');if(!h2||!el.isConnected||el.querySelector('#dcx'))return;
   S.fam=fam;const sec=document.createElement('section');sec.id='dcx';sec.className='card dcx';
   sec.innerHTML=`<h3>${two('Player card','بطاقة اللاعب')}</h3><p class="mu dcx-i">${two('Pick a player, the kind of card, the measures and who he is compared with. Per 90 minutes, with his percentile among those players.','اختر لاعب ونوع البطاقة والمقاييس ومين تقارنه فيهم. الأرقام لكل 90 دقيقة، مع ترتيبه المئوي بينهم.')}</p><div class="dcx-b"><div class="empty skel">${two('Loading…','جاري التحميل…')}</div></div>`;
   h2.after(sec);
   draw(sec.querySelector('.dcx-b'));
  }});
 async function draw(root){
  const lg=D.id,tok=++S.tok,past=!!(typeof ALL==='object'&&ALL&&ALL.season);if(S.lg!==lg){S.lg=lg;S.pid='';S.user=false}
  const scope=past?'lg':S.scope;
  let P;try{P=await pool(scope,lg)}catch(e){if(!root.isConnected||D.id!==lg||tok!==S.tok)return;
   root.innerHTML=`<div class="empty">${two('Could not load the players for the comparison. Try again later.','ما قدرنا نحمّل اللاعبين للمقارنة. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||D.id!==lg||tok!==S.tok)return;
  const lgName=(D&&D.name)||'';
  const own=scope==='six'?P.all.filter(a=>a.lg===lgName):P.all;
  const list=own.filter(a=>a.s.mi>=S.min).sort((a,b)=>a.n.localeCompare(b.n));
  if(!list.length){root.innerHTML=`<div class="empty">${two('No player has '+S.min+' minutes in this league yet.','ما فيه لاعب عنده '+nb(S.min)+' دقيقة في هذا الدوري للحين.')}</div>`+ctl(past,[]);wire(root,past,[]);return}
  /* the first player shown: the most minutes among the roles the card is about (any outfield role for defending) */
  let me=S.user?list.find(a=>a.id===S.pid):null;if(!me){const R0=FAM[S.fam].roles,by=L=>L.sort((a,b)=>b.s.mi-a.s.mi||a.n.localeCompare(b.n))[0];
   me=(R0&&by(list.filter(a=>R0.includes(a.role))))||by(list.filter(a=>a.p!=='GK'&&a.role!=='GK'))||list[0];S.pid=me.id}
  const cmp=compare(P.all,me);
  const who=(cmp.grp==='role'?(ar()?ROLE[me.role][1]:ROLE[me.role][0]):cmp.grp==='pos'?(ar()?(POS[me.p]||['',''])[1]:(POS[me.p]||[me.p||'players'])[0]):(ar()?'كل اللاعبين ما عدا الحراس':'all outfield players'));
  const where=scope==='six'?(ar()?'الدوريات الست':'six leagues'):(ar()?lgName:lgName);
  const meta={crest:typeof logoOf==='function'?logoOf(me.club):'',league:lgName,season:(ALL&&ALL.season)||'',
   who:(ar()?`${cmp.peers.length} من ${who} في ${where}، ${S.min}+ دقيقة`:`${cmp.peers.length} ${who} in ${where}, ${S.min}+ minutes`)};
  root.innerHTML=ctl(past,list)+`<div class="dcx-c"><div class="empty skel">${two('Drawing…','جاري الرسم…')}</div></div>`;
  wire(root,past,list);
  const heat=await heatOf(me.id);if(!root.isConnected||D.id!==lg||tok!==S.tok)return;
  const K=card(me,cmp,heat,meta),box=root.querySelector('.dcx-c');
  box.innerHTML=K.svg+`<div class="dcx-a"><button type="button" class="s dcx-s">${two('Save image','حفظ كصورة')}</button>${P.miss.length?`<span class="mu">${two('Not loaded: '+esc(P.miss.join(', ')),'ما تحمّل: '+esc(P.miss.join('، ')))}</span>`:''}${heat?'':`<span class="mu">${two('No heat map for this player.','ما فيه خريطة حرارية لهذا اللاعب.')}</span>`}</div>`;
  box.querySelector('.dcx-s').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await savePng(K.svg,K.W,K.H,me.n)}catch(x){}finally{b.disabled=false}};
 }
 function ctl(past,list){
  const sel=(id,arr,v,lab)=>`<label class="dcx-l"><span class="mu">${lab}</span><select id="${id}">${arr.map(([k,en,a])=>`<option value="${k}"${String(k)===String(v)?' selected':''}${a&&a.dis?' disabled':''}>${esc(ar()?a.t:en)}</option>`).join('')}</select></label>`;
  return `<div class="ctl dcx-ctl">
   <label class="dcx-l dcx-p"><span class="mu">${two('Player','اللاعب')}</span><input id="dcxp" list="dcxpl" autocomplete="off" value="${esc((list.find(a=>a.id===S.pid)||{}).n||'')}" placeholder="${ar()?'ابحث عن لاعب':'Search player'}"><datalist id="dcxpl">${list.map(a=>`<option value="${esc(a.n)}">${esc(a.club)}</option>`).join('')}</datalist></label>
   ${sel('dcxt',Object.entries(FAM).map(([k,f])=>[k,f.en,{t:f.ar}]),S.fam,two('Card','البطاقة'))}
   ${sel('dcxg',[['role','Same role (from line-ups)',{t:'نفس الدور (من التشكيلات)'}],['pos','Same position',{t:'نفس المركز'}],['all','All outfield players',{t:'كل اللاعبين ما عدا الحراس'}]],S.grp,two('Compared with','المقارنة مع'))}
   ${sel('dcxs',[['six','Six leagues',{t:'الدوريات الست',dis:past}],['lg','This league',{t:'هذا الدوري'}]],past?'lg':S.scope,two('Where','وين'))}
   ${sel('dcxm',[[270,'270+ minutes',{t:'270+ دقيقة'}],[450,'450+ minutes',{t:'450+ دقيقة'}],[900,'900+ minutes',{t:'900+ دقيقة'}]],S.min,two('Minutes','الدقائق'))}
   ${sel('dcxy',[['bars','Bars',{t:'أشرطة'}],['pizza','Pizza',{t:'بيتزا'}]],S.style,two('Chart','الرسم'))}</div>
   ${past?`<p class="mu dcx-i">${two('A past season is compared within its own league only.','الموسم السابق يُقارن داخل دوريه بس.')}</p>`:''}
   <div class="dcx-mt" role="group" aria-label="${ar()?'المقاييس':'Measures'}">${FAM[S.fam].met.map(m=>`<label class="dcx-k"><input type="checkbox" value="${m[0]}"${met().includes(m[0])?' checked':''}>${two(esc(m[1])+(m[4]==='p90'?' /90':''),esc(m[2]))}</label>`).join('')}</div>
   <p class="mu dcx-i">${two('3 to 8 measures.','من 3 إلى 8 مقاييس.')}</p>`;
 }
 function wire(root,past,list){
  const redraw=()=>{save();draw(root)};
  const p=root.querySelector('#dcxp');if(p)p.onchange=()=>{const v=p.value.trim().toLowerCase(),a=list.find(x=>x.n.toLowerCase()===v)||list.find(x=>x.n.toLowerCase().includes(v));if(a&&a.id!==S.pid){S.pid=a.id;S.user=true;redraw()}};
  const f=root.querySelector('#dcxt');if(f)f.onchange=()=>{if(FAM[f.value]){S.fam=f.value;redraw()}};
  const g=root.querySelector('#dcxg');if(g)g.onchange=()=>{S.grp=g.value;redraw()};
  const s=root.querySelector('#dcxs');if(s)s.onchange=()=>{if(!past){S.scope=s.value;redraw()}};
  const m=root.querySelector('#dcxm');if(m)m.onchange=()=>{S.min=+m.value;redraw()};
  const y=root.querySelector('#dcxy');if(y)y.onchange=()=>{S.style=y.value==='pizza'?'pizza':'bars';redraw()};
  const B=[...root.querySelectorAll('.dcx-mt input')],lim=()=>{const n=B.filter(b=>b.checked).length;B.forEach(b=>{b.disabled=(b.checked&&n<=3)||(!b.checked&&n>=8)})};lim();
  B.forEach(b=>b.onchange=()=>{const on=B.filter(x=>x.checked).map(x=>x.value);if(on.length<3||on.length>8){b.checked=!b.checked;return}S.mets[S.fam]=FAM[S.fam].met.map(m=>m[0]).filter(k=>on.includes(k));lim();redraw()});
 }
 INS.ar({'Defending':'الدفاع','Attacking':'الهجوم','Passing and creating':'التمرير والصناعة','Dribbling and carrying':'المراوغة وحمل الكرة','Same role (from line-ups)':'نفس الدور (من التشكيلات)','Same position':'نفس المركز','All outfield players':'كل اللاعبين ما عدا الحراس','Six leagues':'الدوريات الست','This league':'هذا الدوري','270+ minutes':'270+ دقيقة','450+ minutes':'450+ دقيقة','900+ minutes':'900+ دقيقة'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
