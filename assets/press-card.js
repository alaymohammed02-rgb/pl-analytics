/* ===== Match pressing card (top of the Pressing page): one match, both teams, from PitchAPI's team numbers =====
   Pick a finished match: the card shows, for each team, where its actions happened (PitchAPI's team heat map, 16 × 12 cells, the team
   attacking to the right), the average height of its defensive actions, six pressing numbers with a bar and a colour for how it
   ranks among every team-match of the league this season, and the players with the most defensive actions. "Save image" gives a PNG.
   - Numbers (PitchAPI, as the pages already load them): PPDA = opponent passes ÷ defensive actions (adv team rows, pp); defensive
     actions (da); high turnovers (hto); counterpress regains (cpr); regain time in seconds (brt); defensive action height in metres
     (adx). A missing value is shown as – and has no bar, never a zero.
   - Rank = (team-matches below + half of those level) ÷ team-matches compared × 100, over all of this league's team-matches that have
     the number (needs 10+). Colour and length of the bar follow the rank, red (0) to green (100), the way round that means MORE
     pressing or more defending: a low PPDA and a short regain time count as more pressing. The rank says how intense the team was
     against the rest of the league, not who won or who was better.
   - Players: total defensive actions = tackles + interceptions + blocks + clearances (the Defensive page's own definition); tackles,
     interceptions, blocks + clearances and duels won beside it. Only players PitchAPI rated in this match.
   - What PitchAPI does not give, so the card does not show: where each pressure happened, who was pressed, possession-adjusted
     numbers, or defensive actions by third of the pitch. The heat map is every action the team made. */
(function(){
 if(typeof R!=='object'||typeof R.ppda!=='function'||typeof INS!=='object'||typeof INS.poolOne!=='function'||!INS.cardKit)return;
 const {pcol,fit,x_,css,savePng,FONT}=INS.cardKit;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const S={lg:'',mid:'',tok:0};
 const NEED=10;
 /* key, English, Arabic, unit, which way is "more pressing" (1 = higher is more, -1 = lower is more), decimals, where it is */
 const MET=[
  ['pp','PPDA (lower = more pressing)','PPDA (الأقل = ضغط أكثر)','',-1,1,'adv'],
  ['da','Defensive actions','الأفعال الدفاعية','',1,0,'adv'],
  ['hto','High turnovers','الاستعادات العالية','',1,0,'pl'],
  ['cpr','Counterpress regains','استعادات الضغط العكسي','',1,0,'pl'],
  ['brt','Time to win the ball back (s)','وقت استعادة الكرة (ث)','',-1,1,'pl'],
  ['adx','Defensive action height (m)','ارتفاع الأفعال الدفاعية (م)','',1,1,'pl']];
 const SIDE=['home','away'];
 const pctOf=(v,all)=>{if(v==null||all.length<NEED)return null;let lo=0,eq=0;for(const x of all){if(x<v)lo++;else if(x===v)eq++}return Math.round((lo+eq/2)/all.length*100)};
 /* everything for one league, once: the team rows of both files, the heat file's team rows, the shirts' positions */
 const C=new Map();
 function data(lg){const k=INS.poolKey()+'|'+lg;
  if(!C.has(k))C.set(k,(async()=>{const o=await INS.poolOne(lg,['adv','pl','mx']);if(!o||!o.adv||!o.pl)throw new Error('no data');
   let H=null;try{H=await loadHeat()}catch(e){}
   const byM=new Map(o.ms.map(m=>[m.id,m])),T=new Map();
   const add=(r,f)=>{const m=r.m+'|'+r.s;let t=T.get(m);if(!t){t={n:r.n,s:r.s,m:r.m};T.set(m,t)}f(t)};
   (o.adv.team||[]).forEach(r=>add(r,t=>{t.pp=r.pp;t.da=r.da}));
   (o.pl.team||[]).forEach(r=>add(r,t=>{['hto','cpr','brt','adx'].forEach(k=>t[k]=r[k])}));
   const dist={};MET.forEach(m=>{dist[m[0]]=[...T.values()].map(t=>t[m[0]]).filter(x=>x!=null&&isFinite(x))});
   const ix={};o.pl.cols.forEach((c,k)=>ix[c]=k);
   const heat=new Map();if(H&&Array.isArray(H.rows))H.rows.forEach(r=>{if(r.t==='t'&&Array.isArray(r.h))heat.set(r.m+'|'+r.s,r)});
   return {o,byM,T,dist,ix,heat}})().catch(e=>{C.delete(k);throw e}));
  return C.get(k)}
 function playersOf(X,mid,name){const {o,ix}=X,out=[];
  o.pl.rows.forEach(r=>{if(r[ix.m]!==mid||r[ix.c]!==name)return;const mi=r[ix.mi];if(mi==null)return;
   const g=k=>r[ix[k]],tk=g('tk'),ic=g('ic'),bl=g('bl'),cl=g('cl');
   const da=[tk,ic,bl,cl].every(v=>v!=null)?tk+ic+bl+cl:null;
   out.push({id:r[ix.i],n:r[ix.n],pos:r[ix.o],mi,tk,ic,bc:bl!=null&&cl!=null?bl+cl:null,duw:g('duw'),da})});
  return out.filter(p=>p.da!=null).sort((a,b)=>b.da-a.da||b.mi-a.mi||a.n.localeCompare(b.n)).slice(0,9)}
 /* the card's numbers for one match: what is drawn and what the test recomputes */
 function build(X,m){
  const T=X.T,teams=SIDE.map((s,i)=>{const name=i?m.away:m.home,t=T.get(m.id+'|'+s)||{},rows=MET.map(q=>{const v=t[q[0]],a=X.dist[q[0]],p=pctOf(v,a);
    const rank=p==null?null:q[4]<0?100-p:p;return {k:q[0],q,v:v==null||!isFinite(v)?null:v,p:rank}});
   return {name,side:s,rows,players:playersOf(X,m.id,name),heat:X.heat.get(m.id+'|'+s)||null,adx:t.adx==null?null:t.adx}});
  return {m,teams}}
 const fmt=(q,v)=>v==null?'–':v.toFixed(q[5]);
 function card(B,meta){
  const A=ar(),W=1600,PX=60,GAP=60,CW=(W-2*PX-GAP)/2,PH=Math.round(CW*68/105),NR=MET.length,TH=82,NP=Math.max(B.teams[0].players.length,B.teams[1].players.length,1),RH=44;
  const top=250,pt=top+86,mt=pt+PH+64,tt=mt+NR*TH+60,H=tt+54+NP*RH+160;
  const bg=css('--sf','#152130'),bg2=css('--bg','#0d1520'),tx=css('--tx','#e8eef5'),mu=css('--mu','#8fa3b8'),ln=css('--ln','rgba(255,255,255,.12)');
  const X=x=>A?W-x:x,anc=a=>A?(a==='start'?'end':a==='end'?'start':a):a,T=(en,a)=>A?a:en;
  const t=(x,y,s,o={})=>`<text x="${X(x)}" y="${y}" font-size="${o.size||28}" font-weight="${o.w||400}" fill="${o.fill||tx}" text-anchor="${o.a||'start'}"${A?' direction="rtl"':''}>${x_(s)}</text>`;
  let g=`<rect width="${W}" height="${H}" fill="${bg2}"/><rect x="24" y="24" width="${W-48}" height="${H-48}" rx="36" fill="${bg}" stroke="${ln}" stroke-width="2"/>`;
  /* the club colour that shows up on this dark card: the first of its colours that is saturated enough (a white or grey crest colour
     would make a grey map), otherwise the page's theme colour */
  const sat=h=>{const m=/^#([0-9a-f]{6})$/i.exec(String(h||''));if(!m)return 0;const v=[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)/255),mx=Math.max(...v),mn=Math.min(...v);return mx===0?0:(mx-mn)/mx};
  const col=n=>{const c=typeof clubColors==='function'&&clubColors(n);const L=c?[c.hi,c.c1,c.c2].filter(Boolean):[];const h=L.find(h=>sat(h)>.3)||css('--th','#8fb3ff'),m=/^#([0-9a-f]{6})$/i.exec(h);if(!m)return h;
   /* a dark colour mixed with 40% white, so it still shows on the card's dark ground */
   return '#'+[0,2,4].map(i=>{const v=parseInt(m[1].substr(i,2),16),l=Math.max(0,.4-(Math.max(v,0)/255)*.4);return Math.round(v+(255-v)*.4).toString(16).padStart(2,'0')}).join('')};
  /* header: the two crests, the score, what the card is */
  const [h,a]=B.teams,m=B.m,title=`${h.name} ${m.hg} – ${m.ag} ${a.name}`;
  [[h,PX],[a,W-PX-110]].forEach(([tm,x0],i)=>{const u=typeof logoOf==='function'?logoOf(tm.name):'';if(u)g+=`<image href="${x_(u)}" x="${A?W-x0-110:x0}" y="62" width="110" height="110" preserveAspectRatio="xMidYMid meet"/>`});
  g+=`<text x="${W/2}" y="118" font-size="${fit(title,66,W-2*PX-300)}" font-weight="800" fill="${tx}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(title)}</text>`;
  g+=`<text x="${W/2}" y="166" font-size="28" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(meta.sub)}</text>`;
  g+=`<text x="${W/2}" y="204" font-size="24" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(T('Team numbers from PitchAPI · colour = rank among all team-matches of the league','أرقام الفريق من PitchAPI · اللون = الترتيب بين كل مباريات الفرق في الدوري'))}</text>`;
  B.teams.forEach((tm,i)=>{
   const x0=PX+i*(CW+GAP),cc=col(tm.name),s=CW/105;
   g+=`<rect x="${A?W-x0-14:x0}" y="${top+10}" width="14" height="34" rx="4" fill="${cc}"/>`;
   g+=t(x0+26,top+38,T('Where '+tm.name+' acted','وين لعب '+tm.name),{size:fit(tm.name,32,CW-30),w:700});
   const gx=A?(W-x0-CW):x0;
   g+=`<rect x="${gx}" y="${pt}" width="${CW}" height="${PH}" rx="10" fill="${bg2}"/>`;
   if(tm.heat){let mx=0;tm.heat.h.forEach((v,k)=>{if(k%3===2&&v>mx)mx=v});
    const cw=CW/16,ch=PH/12;
    for(let k=0;k+2<tm.heat.h.length;k+=3){const xx=tm.heat.h[k],ww=tm.heat.h[k+1],v=tm.heat.h[k+2];if(!v||xx<0||xx>15||ww<0||ww>11)continue;
     const q=v/mx,al=.05+.9*Math.min(1,q/.8);
     const cx=gx+(A?(15-xx):xx)*cw,cy=pt+(11-ww)*ch;
     g+=`<rect class="pc-hc" data-v="${v}" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${(cw+.5).toFixed(1)}" height="${(ch+.5).toFixed(1)}" fill="${cc}" fill-opacity="${al.toFixed(3)}"/>`}}
   else g+=`<text x="${gx+CW/2}" y="${pt+PH/2}" font-size="26" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(T('Heat map not available','الخريطة الحرارية مو متوفرة'))}</text>`;
   const L='stroke="rgba(255,255,255,.34)" stroke-width="3" fill="none"',px=v=>gx+(A?105-v:v)*s,py=v=>pt+v*s;
   const rx=(a0,w)=>A?px(a0)-w*s:px(a0);
   g+=`<g ${L}><rect x="${gx}" y="${pt}" width="${CW}" height="${PH}" rx="10"/><line x1="${px(52.5)}" y1="${pt}" x2="${px(52.5)}" y2="${pt+PH}"/><circle cx="${px(52.5)}" cy="${py(34)}" r="${9.15*s}"/>
    <rect x="${rx(0,16.5)}" y="${py(34-20.16)}" width="${16.5*s}" height="${40.32*s}"/><rect x="${rx(0,5.5)}" y="${py(34-9.16)}" width="${5.5*s}" height="${18.32*s}"/>
    <rect x="${rx(105-16.5,16.5)}" y="${py(34-20.16)}" width="${16.5*s}" height="${40.32*s}"/><rect x="${rx(105-5.5,5.5)}" y="${py(34-9.16)}" width="${5.5*s}" height="${18.32*s}"/></g>`;
   if(tm.adx!=null){const lx=px(tm.adx);g+=`<line class="pc-adx" x1="${lx.toFixed(1)}" y1="${pt}" x2="${lx.toFixed(1)}" y2="${pt+PH}" stroke="#fff" stroke-width="4" stroke-dasharray="14 10"/>
    <text x="${lx.toFixed(1)}" y="${pt-10}" font-size="22" fill="${tx}" text-anchor="middle">${x_(T('defensive actions, average '+tm.adx.toFixed(0)+' m','الأفعال الدفاعية، المتوسط '+tm.adx.toFixed(0)+' م'))}</text>`}
   g+=`<text x="${A?gx:gx+CW}" y="${pt+PH+34}" font-size="22" fill="${mu}" text-anchor="end"${A?' direction="rtl"':''}>${x_(T('attack '+(A?'←':'→'),'اتجاه الهجوم '+(A?'←':'→')))}</text>`;
   /* the six pressing numbers: one row each */
   const BW=CW-70;
   tm.rows.forEach((q,j)=>{const y0=mt+j*TH,lab=T(q.q[1],q.q[2]),pc=q.p==null?null:pcol(q.p),val=fmt(q.q,q.v);
    g+=`<text x="${X(x0)}" y="${y0+28}" font-size="${fit(lab+val,27,BW)}" fill="${tx}" text-anchor="start"${A?' direction="rtl"':''}>${x_(lab)}  <tspan font-weight="800" direction="ltr" unicode-bidi="embed">${x_(val)}</tspan></text>`;
    const bx=A?W-x0-BW:x0,w=q.p==null?0:Math.max(14,BW*q.p/100),fx=A?W-x0-w:x0;
    g+=`<rect x="${bx}" y="${y0+40}" width="${BW}" height="24" rx="12" fill="${ln}"/>`;
    if(pc)g+=`<rect class="pc-on" x="${fx.toFixed(1)}" y="${y0+40}" width="${w.toFixed(1)}" height="24" rx="12" fill="${pc}"/>`;
    const cx=X(x0+CW-26);g+=`<circle cx="${cx}" cy="${y0+52}" r="26" fill="${pc||ln}"/><text x="${cx}" y="${y0+61}" font-size="24" font-weight="800" fill="#fff" text-anchor="middle">${q.p==null?'–':q.p}</text>`});
   /* the players with the most defensive actions */
   g+=t(x0,tt,T('Most defensive actions','الأكثر أفعالاً دفاعية'),{size:26,w:700});
   const cols=[['da',T('Total','المجموع'),0],['tk',T('Tkl','افتكاك'),1],['ic',T('Int','اعتراض'),2],['bc',T('Blk+Clr','صد+إبعاد'),3],['duw',T('Duels','التحامات'),4]],cx0=x0+CW-5*84+14;
   cols.forEach(([k,l,n])=>{g+=`<text x="${X(cx0+n*84+62)}" y="${tt}" font-size="20" fill="${mu}" text-anchor="${anc('end')}">${x_(l)}</text>`});
   tm.players.forEach((p,j)=>{const y0=tt+22+j*RH;
    g+=`<rect x="${A?W-x0-CW:x0}" y="${y0+4}" width="${CW}" height="${RH-6}" rx="8" fill="${j%2?'transparent':'rgba(255,255,255,.04)'}"/>`;
    g+=t(x0+10,y0+30,p.n,{size:fit(p.n,24,CW-5*84-30)});
    cols.forEach(([k,l,n])=>{const v=p[k];g+=`<text class="${k==='da'?'pc-da':''}" x="${X(cx0+n*84+62)}" y="${y0+30}" font-size="${k==='da'?26:24}" font-weight="${k==='da'?800:400}" fill="${v==null?mu:tx}" text-anchor="${anc('end')}">${v==null?'–':v}</text>`})});
   if(!tm.players.length)g+=t(x0,tt+52,T('No player numbers for this match','ما فيه أرقام لاعبين لهذي المباراة'),{size:22,fill:mu})});
  const fy=tt+30+NP*RH+34;
  g+=t(PX,fy,T('PitchAPI has no pressure events: no place for each pressure, no possession-adjusted numbers, no thirds of the pitch.','PitchAPI ما عنده أحداث ضغط: ما فيه مكان لكل ضغطة ولا أرقام معدّلة حسب الاستحواذ ولا أثلاث الملعب.'),{size:21,fill:mu});
  g+=t(PX,fy+32,T('The heat map is every action the team made. Colour and bar: rank among every team-match of the league this season,','الخريطة الحرارية كل أفعال الفريق. اللون والشريط: الترتيب بين كل مباريات الفرق في الدوري هالموسم،'),{size:21,fill:mu});
  g+=t(PX,fy+64,T('green = more pressing (a low PPDA and a short time to win the ball back count as more).','الأخضر = ضغط أكثر (PPDA الأقل ووقت استعادة الكرة الأقصر يعدّان أكثر).'),{size:21,fill:mu});
  g+=t(PX,fy+110,'PL Analytics',{size:26,w:800});g+=t(W-PX,fy+110,T('Data: PitchAPI','البيانات: PitchAPI'),{size:22,fill:mu,a:'end'});
  const aria=title+': '+B.teams.map(tm=>tm.name+' '+tm.rows.map(q=>T(q.q[1],q.q[2])+' '+fmt(q.q,q.v)+(q.p==null?'':' ('+q.p+')')).join(', ')).join(' | ');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${x_(aria)}">${g}</svg>`,W,H,title};
 }
 /* ---------- the section on the Pressing page ---------- */
 const orig=R.ppda;
 R.ppda=async function(el){
  await orig.apply(this,arguments);
  const h2=el.querySelector('h2');if(!h2||!el.isConnected||el.querySelector('#pcx'))return;
  const sec=document.createElement('section');sec.id='pcx';sec.className='card dcx';
  sec.innerHTML=`<h3>${two('Match pressing card','بطاقة ضغط المباراة')}</h3><p class="mu dcx-i">${two('Pick a match: both teams\' pressing numbers, ranked against every team-match of the league, with where each team acted and its most active defenders.','اختر مباراة: أرقام ضغط الفريقين مرتبة مقابل كل مباريات الفرق في الدوري، مع وين لعب كل فريق ومدافعيه الأنشط.')}</p><div class="pcx-b"><div class="empty skel">${two('Loading…','جاري التحميل…')}</div></div>`;
  h2.after(sec);draw(sec.querySelector('.pcx-b'));
 };
 async function draw(root){
  const lg=D.id,tok=++S.tok;if(S.lg!==lg){S.lg=lg;S.mid=''}
  let X;try{X=await data(lg)}catch(e){if(!root.isConnected||D.id!==lg||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('Could not load this league\'s numbers. Try again later.','ما قدرنا نحمّل أرقام هذا الدوري. جرّب بعدين.')}</div>`;return}
  if(!root.isConnected||D.id!==lg||tok!==S.tok)return;
  const has=m=>SIDE.every(s=>{const t=X.T.get(m.id+'|'+s);return t&&MET.some(q=>t[q[0]]!=null)});
  const list=[...X.o.ms].filter(has).sort((a,b)=>b.d.localeCompare(a.d)||b.id.localeCompare(a.id));
  if(!list.length){root.innerHTML=`<div class="empty">${two('No finished match with team numbers yet.','ما فيه مباراة منتهية بأرقام فريق للحين.')}</div>`;return}
  let m=list.find(x=>x.id===S.mid);if(!m){m=list[0];S.mid=m.id}
  const B=build(X,m),lgName=(D&&D.name)||'',meta={sub:[lgName+((ALL&&ALL.season)?' '+ALL.season:''),m.d].join(' · ')};
  const K=card(B,meta);
  root.innerHTML=`<div class="ctl dcx-ctl"><label class="dcx-l dcx-p"><span class="mu">${two('Match','المباراة')}</span><select id="pcxm">${list.map(x=>`<option value="${esc(x.id)}"${x.id===m.id?' selected':''}>${esc(x.home+' '+x.hg+' – '+x.ag+' '+x.away+' · '+x.d)}</option>`).join('')}</select></label></div>
   <div class="dcx-c">${K.svg}<div class="dcx-a"><button type="button" class="s pcx-s">${two('Save image','حفظ كصورة')}</button>${X.heat.size?'':`<span class="mu">${two('No heat maps for this league.','ما فيه خرائط حرارية لهذا الدوري.')}</span>`}</div></div>`;
  root.querySelector('#pcxm').onchange=e=>{S.mid=e.target.value;draw(root)};
  root.querySelector('.pcx-s').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await savePng(K.svg,K.W,K.H,K.title,'pressing')}catch(x){}finally{b.disabled=false}};
 }
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
