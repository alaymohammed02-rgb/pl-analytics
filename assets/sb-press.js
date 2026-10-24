/* ===== Pressing maps (#/sbpress, in Analysis after Height): pressure maps and pressing percentiles from StatsBomb Open Data =====
   Data: StatsBomb Open Data (github.com/statsbomb/open-data), free for analysis only; not for commercial use; the StatsBomb logo is
   shown on the page and on every card. Matches are free past matches only (this season's PitchAPI league data has no pressure events).
   - Match map: pick a competition, season and match; the page reads that match's events and lineups straight from StatsBomb's public
     files in your browser (nothing of StatsBomb's raw files is stored or copied by this site). Every Pressure event is drawn where it
     happened (the team attacking to the right; a counterpress has a white ring), with where each team pressed in thirds of the pitch
     (low block: its own third, mid block, high press: the opponent's third) and its players' pressures by third.
   - Player card: pressing numbers per player over a whole tournament (Euro 2024, World Cup 2022, Copa América 2024, Africa Cup of
     Nations 2023: the open data holds all matches of those; its Bundesliga 2023/24 holds only Bayer Leverkusen's, so there is no
     league-wide pool). data/sb_press.json is derived offline by tools/sb-press/ (counts per player and a 12 × 8 pressure grid, not
     StatsBomb's events). Percentile = (players below + half of those level) ÷ players, among players of the same position group
     (goalkeepers left out) with the tournament's minimum minutes, the player himself left out; shown with 8+ peers.
   - Definitions (ours, since StatsBomb's own flags are not in the open data): a regain = the pressing team has the ball within 5 s of
     the pressure; possession-adjusted = each match's counts × 50 ÷ the opponent's share of the ball (by time) in that match.
     Raw counts are one switch away. Percentiles are only ever against the same tournament's players. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||!INS.cardKit)return;
 INS.addPage('sbpress','Pressing maps','analysis','height');
 INS.ar({'Pressing maps':'خرائط الضغط'});
 const {pcol,fit,x_,css,savePng,FONT}=INS.cardKit;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const SB='https://raw.githubusercontent.com/statsbomb/open-data/master/data';
 const S={tab:'m',cmp:'',mid:'',tok:0,pc:0,grp:'',pid:'',adj:true};
 const RC=new Map();
 const get=u=>{if(!RC.has(u))RC.set(u,fetch(u).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json()}).catch(e=>{RC.delete(u);throw e}));return RC.get(u)};
 let LOGO=null;
 const logo=()=>{if(!LOGO)LOGO=fetch('assets/statsbomb-logo.svg').then(r=>r.ok?r.text():'').then(t=>t?'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(t))):'').catch(()=>'');return LOGO};
 /* ---------- one match: the pressures, by team and player ---------- */
 const mmss=t=>String(t);
 function analyse(E,LU,home,away){
  const jn=new Map(),nick=new Map();(LU||[]).forEach(l=>(l.lineup||[]).forEach(p=>{jn.set(p.player_id,p.jersey_number);nick.set(p.player_id,p.player_nickname||p.player_name)}));
  const T={},names=[home,away];names.forEach(n=>T[n]={n,dots:[],pl:new Map(),tot:0,cp:0,third:[0,0,0]});
  E.forEach(e=>{if(!e.type||e.type.name!=='Pressure'||!e.team||!T[e.team.name]||!e.location)return;
   const t=T[e.team.name],x=e.location[0],y=e.location[1],cp=!!e.counterpress,z=x<40?0:x<80?1:2;
   t.dots.push([x,y,cp?1:0]);t.tot++;if(cp)t.cp++;t.third[z]++;
   const id=e.player?e.player.id:0;let p=t.pl.get(id);if(!p){p={id,n:nick.get(id)||(e.player?e.player.name:'?'),jn:jn.get(id),tot:0,cp:0,z:[0,0,0]};t.pl.set(id,p)}
   p.tot++;if(cp)p.cp++;p.z[z]++});
  names.forEach(n=>{T[n].top=[...T[n].pl.values()].sort((a,b)=>b.tot-a.tot||b.cp-a.cp||a.n.localeCompare(b.n)).slice(0,9)});
  return names.map(n=>T[n]);
 }
 /* the pitch (StatsBomb's 120 × 80, the attacking team going to the right), drawn at gx,gy with width cw; mirrored in Arabic */
 function pitch(gx,gy,cw,A){const s=cw/120,ch=80*s,px=v=>gx+(A?120-v:v)*s,py=v=>gy+v*s,rx=(a,w)=>A?px(a)-w*s:px(a),L='stroke="rgba(255,255,255,.34)" stroke-width="3" fill="none"';
  return `<g ${L}><rect x="${gx}" y="${gy}" width="${cw}" height="${ch}" rx="10"/><line x1="${px(60)}" y1="${gy}" x2="${px(60)}" y2="${gy+ch}"/><circle cx="${px(60)}" cy="${py(40)}" r="${10*s}"/>
   <rect x="${rx(0,18)}" y="${py(18)}" width="${18*s}" height="${44*s}"/><rect x="${rx(0,6)}" y="${py(30)}" width="${6*s}" height="${20*s}"/>
   <rect x="${rx(102,18)}" y="${py(18)}" width="${18*s}" height="${44*s}"/><rect x="${rx(114,6)}" y="${py(30)}" width="${6*s}" height="${20*s}"/></g>`}
 const colOf=n=>{const sat=h=>{const m=/^#([0-9a-f]{6})$/i.exec(String(h||''));if(!m)return 0;const v=[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)/255),mx=Math.max(...v),mn=Math.min(...v);return mx===0?0:(mx-mn)/mx};
  const c=typeof clubColors==='function'&&clubColors(n);const L=c?[c.hi,c.c1,c.c2].filter(Boolean):[];return L.find(h=>sat(h)>.3)||null};
 /* two team colours that can be told apart on the dark card: the page's colours, or fixed ones */
 const lighten=h=>{const m=/^#([0-9a-f]{6})$/i.exec(h||'');if(!m)return h;return '#'+[0,2,4].map(i=>{const v=parseInt(m[1].substr(i,2),16);return Math.round(v+(255-v)*.4).toString(16).padStart(2,'0')}).join('')};
 function teamColours(a,b){const ca=colOf(a),cb=colOf(b);let A_=ca?lighten(ca):'#6ea8fe',B_=cb?lighten(cb):'#ff8a65';if(A_===B_)B_='#ff8a65';return [A_,B_]}
 async function matchCard(M,T,logoURI){
  const A=ar(),W=1600,PX=60,GAP=60,CW=(W-2*PX-GAP)/2,PH=Math.round(CW*80/120),NP=Math.max(T[0].top.length,T[1].top.length,1),RH=44;
  const top=250,pt=top+50,tb=pt+PH+40,tt=tb+130,H=tt+54+NP*RH+190;
  const bg=css('--sf','#152130'),bg2=css('--bg','#0d1520'),tx=css('--tx','#e8eef5'),mu=css('--mu','#8fa3b8'),ln=css('--ln','rgba(255,255,255,.12)');
  const X=x=>A?W-x:x,anc=a=>A?(a==='start'?'end':a==='end'?'start':a):a,TT=(en,a)=>A?a:en;
  const t=(x,y,s,o={})=>`<text x="${X(x)}" y="${y}" font-size="${o.size||28}" font-weight="${o.w||400}" fill="${o.fill||tx}" text-anchor="${o.a||'start'}"${A?' direction="rtl"':''}>${x_(s)}</text>`;
  const cols=teamColours(M.home,M.away);
  let g=`<rect width="${W}" height="${H}" fill="${bg2}"/><rect x="24" y="24" width="${W-48}" height="${H-48}" rx="36" fill="${bg}" stroke="${ln}" stroke-width="2"/>`;
  const title=`${M.home} ${M.hs} – ${M.as} ${M.away}`;
  g+=`<text x="${W/2}" y="106" font-size="${fit(title,66,W-2*PX)}" font-weight="800" fill="${tx}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(title)}</text>`;
  g+=`<text x="${W/2}" y="154" font-size="28" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(M.sub)}</text>`;
  g+=`<text x="${W/2}" y="196" font-size="26" font-weight="700" fill="${tx}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(TT('Pressure map','خريطة الضغط'))}</text>`;
  T.forEach((tm,i)=>{
   const x0=PX+i*(CW+GAP),gx=A?(W-x0-CW):x0,cc=cols[i];
   g+=`<rect x="${A?W-x0-14:x0}" y="${top+8}" width="14" height="34" rx="4" fill="${cc}"/>`;
   g+=t(x0+26,top+36,tm.n,{size:fit(tm.n,32,CW-260),w:700});
   g+=`<text x="${X(x0+CW)}" y="${top+36}" font-size="24" fill="${mu}" text-anchor="${anc('end')}"${A?' direction="rtl"':''}>${x_(TT('Pressures ','الضغطات ')+tm.tot+TT(' · counterpresses ',' · ضغط عكسي ')+tm.cp)}</text>`;
   g+=`<rect x="${gx}" y="${pt}" width="${CW}" height="${PH}" rx="10" fill="${bg2}"/>`;
   /* density underlay, then the pressures */
   const GXN=24,GYN=16,cnt=new Array(GXN*GYN).fill(0);let mx=0;tm.dots.forEach(d=>{const a=Math.min(GXN-1,Math.floor(d[0]/120*GXN)),b=Math.min(GYN-1,Math.floor(d[1]/80*GYN));mx=Math.max(mx,++cnt[a*GYN+b])});
   const cw=CW/GXN,chh=PH/GYN;
   cnt.forEach((v,k)=>{if(!v)return;const a=Math.floor(k/GYN),b=k%GYN;g+=`<rect class="sb-hc" data-v="${v}" x="${(gx+(A?GXN-1-a:a)*cw).toFixed(1)}" y="${(pt+b*chh).toFixed(1)}" width="${(cw+.5).toFixed(1)}" height="${(chh+.5).toFixed(1)}" fill="${cc}" fill-opacity="${(.04+.38*v/mx).toFixed(3)}"/>`});
   g+=pitch(gx,pt,CW,A);
   const s=CW/120;tm.dots.forEach(d=>{const cx=gx+(A?120-d[0]:d[0])*s,cy=pt+d[1]*s;
    g+=d[2]?`<circle class="sb-cp" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="${cc}" stroke="#fff" stroke-width="3"/>`:`<circle class="sb-pr" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${cc}" fill-opacity=".8" stroke="${bg2}" stroke-width="1.5"/>`});
   g+=`<text x="${A?gx:gx+CW}" y="${pt+PH+30}" font-size="22" fill="${mu}" text-anchor="end"${A?' direction="rtl"':''}>${x_(TT('attack '+(A?'←':'→'),'اتجاه الهجوم '+(A?'←':'→')))}</text>`;
   /* thirds: low block, mid block, high press (along the attack direction) */
   const tw=(CW-2*16)/3,names=[TT('Low block','كتلة منخفضة'),TT('Mid block','كتلة وسطى'),TT('High press','ضغط عالٍ')];
   tm.third.forEach((v,z)=>{const bx=gx+(A?2-z:z)*(tw+16),pc=tm.tot?Math.round(v/tm.tot*100):0;
    g+=`<rect x="${bx}" y="${tb+34}" width="${tw}" height="14" rx="7" fill="${ln}"/><rect class="sb-th" data-v="${v}" x="${A?bx+tw-tw*(tm.tot?v/tm.tot:0):bx}" y="${tb+34}" width="${(tw*(tm.tot?v/tm.tot:0)).toFixed(1)}" height="14" rx="7" fill="${cc}"/>`;
    g+=`<text x="${bx+tw/2}" y="${tb+26}" font-size="22" fill="${tx}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(names[z]+': '+v+' ('+pc+'%)')}</text>`});
   /* the players with most pressures, by third */
   g+=t(x0,tt,TT('Most pressures','الأكثر ضغطاً'),{size:26,w:700});
   const cl=[['tot',TT('Total','المجموع')],['cp',TT('CP','ض.ع')],['att',TT('Att 1/3','ثلث هجومي')],['mid',TT('Mid 1/3','ثلث أوسط')],['def',TT('Def 1/3','ثلث دفاعي')]],cx0=x0+CW-5*84+14;
   cl.forEach(([k,l],n)=>{g+=`<text x="${X(cx0+n*84+62)}" y="${tt}" font-size="20" fill="${mu}" text-anchor="${anc('end')}"${A?' direction="rtl"':''}>${x_(l)}</text>`});
   tm.top.forEach((p,j)=>{const y0=tt+22+j*RH,v={tot:p.tot,cp:p.cp,att:p.z[2],mid:p.z[1],def:p.z[0]};
    g+=`<rect x="${A?W-x0-CW:x0}" y="${y0+4}" width="${CW}" height="${RH-6}" rx="8" fill="${j%2?'transparent':'rgba(255,255,255,.04)'}"/>`;
    g+=t(x0+10,y0+30,(p.jn!=null?p.jn+'  ':'')+p.n,{size:fit(p.n,24,CW-5*84-30)});
    cl.forEach(([k],n)=>{g+=`<text class="${k==='tot'?'sb-tot':''}" x="${X(cx0+n*84+62)}" y="${y0+30}" font-size="${k==='tot'?26:24}" font-weight="${k==='tot'?800:400}" fill="${tx}" text-anchor="${anc('end')}">${v[k]}</text>`})});
   if(!tm.top.length)g+=t(x0,tt+52,TT('No pressures in this match','ما فيه ضغطات في هذي المباراة'),{size:22,fill:mu})});
  const fy=tt+30+NP*RH+34;
  g+=t(PX,fy,TT('Each dot is a Pressure event, drawn where it happened with the team attacking to the right; a white ring is a counterpress.','كل نقطة حدث ضغط، تنرسم وين صار والفريق يهاجم لليمين؛ الحلقة البيضاء ضغط عكسي.'),{size:21,fill:mu});
  g+=t(PX,fy+32,TT('Thirds: low block = the team\'s own third, high press = the opponent\'s third. Shirt numbers from the lineups.','الأثلاث: الكتلة المنخفضة = ثلث الفريق نفسه، الضغط العالي = ثلث الخصم. أرقام القمصان من التشكيلات.'),{size:21,fill:mu});
  g+=t(PX,fy+64,TT('Free StatsBomb Open Data, for analysis only.','بيانات StatsBomb المفتوحة المجانية، للتحليل فقط.'),{size:21,fill:mu});
  g+=t(PX,fy+110,'PL Analytics',{size:26,w:800});
  if(logoURI)g+=`<image href="${x_(logoURI)}" x="${A?PX:W-PX-330}" y="${fy+80}" width="330" height="43" preserveAspectRatio="${A?'xMinYMid':'xMaxYMid'} meet"/>`;
  else g+=`<text x="${A?PX:W-PX}" y="${fy+110}" font-size="22" fill="${mu}" text-anchor="${A?'start':'end'}">StatsBomb</text>`;
  const aria=title+': '+T.map(tm=>tm.n+' '+tm.tot+' pressures, '+tm.cp+' counterpresses, '+tm.third.join('/')+' low/mid/high').join(' | ');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${x_(aria)}">${g}</svg>`,W,H,title};
 }
 /* ---------- the player card (whole tournaments, from data/sb_press.json) ---------- */
 let DP=null;
 const loadP=()=>{if(!DP)DP=fetch('data/sb_press.json?v='+encodeURIComponent((typeof ALL==='object'&&ALL&&ALL.generated)||'')).then(r=>{if(!r.ok)throw new Error('sb_press '+r.status);return r.json()}).catch(e=>{DP=null;throw e});return DP};
 const PM=[['pr','Pressures','الضغطات'],['prr','Pressure regains','استعادات بعد الضغط'],['cp','Counterpressures','الضغط العكسي'],['cpr','Counterpress regains','استعادات الضغط العكسي'],['ti','Tackles + interceptions','الافتكاكات + الاعتراضات'],['rec','Ball recoveries','استعادة الكرة']];
 const GN={CB:['centre-backs','قلوب الدفاع','Centre-back','قلب دفاع'],FB:['full-backs','الأظهرة','Full-back','ظهير'],MID:['midfielders','لاعبي الوسط','Midfielder','لاعب وسط'],WING:['wingers','الأجنحة','Winger','جناح'],FWD:['forwards','المهاجمين','Forward','مهاجم']};
 const GK=['CB','FB','MID','WING','FWD'];
 const pr=(p,k,adj)=>p[4]>0?p[adj?7:6][PM.findIndex(m=>m[0]===k)]/p[4]*90:null;
 const pctOf=(v,a)=>{if(v==null||a.length<8)return null;let lo=0,eq=0;for(const x of a){if(x<v)lo++;else if(x===v)eq++}return Math.round((lo+eq/2)/a.length*100)};
 /* the card's numbers: the player's per-90 values and their percentile among the same group of the same tournament */
 function playerRows(C,me,adj){const peers=C.players.filter(p=>p!==me&&p[3]===me[3]&&p[4]>=C.min);
  return PM.map(m=>{const v=pr(me,m[0],adj),pv=peers.map(p=>pr(p,m[0],adj)).filter(x=>x!=null&&isFinite(x));return {k:m[0],m,v,p:pctOf(v,pv)}})}
 async function playerCard(C,me,adj,logoURI){
  const A=ar(),W=1080,PX=70,PW=W-2*PX,PH=Math.round(PW*80/120),rows=playerRows(C,me,adj),NR=rows.length,TH=100;
  const top=300,pt=top+22,mt=pt+PH+96,H=mt+NR*TH+230;
  const bg=css('--sf','#152130'),bg2=css('--bg','#0d1520'),tx=css('--tx','#e8eef5'),mu=css('--mu','#8fa3b8'),th=css('--th','#4cc38a'),ln=css('--ln','rgba(255,255,255,.12)');
  const X=x=>A?W-x:x,anc=a=>A?(a==='start'?'end':a==='end'?'start':a):a,T=(en,a)=>A?a:en;
  const t=(x,y,s,o={})=>`<text x="${X(x)}" y="${y}" font-size="${o.size||28}" font-weight="${o.w||400}" fill="${o.fill||tx}" text-anchor="${o.a||'start'}"${A?' direction="rtl"':''}>${x_(s)}</text>`;
  let g=`<rect width="${W}" height="${H}" fill="${bg2}"/><rect x="24" y="24" width="${W-48}" height="${H-48}" rx="36" fill="${bg}" stroke="${ln}" stroke-width="2"/>`;
  const ok=rows.filter(r=>r.p!=null),av=ok.length?Math.round(ok.reduce((s,r)=>s+r.p,0)/ok.length):null;
  g+=t(PX,118,me[1],{size:fit(me[1],56,PW-230),w:800});
  g+=t(PX,166,me[2]+' · '+C.name+' '+C.season,{size:27,fill:mu});
  g+=t(PX,206,[T(GN[me[3]][2],GN[me[3]][3]),Math.round(me[4])+T(' min',' دقيقة'),me[5]+T(' matches',' مباراة')].join(' · '),{size:27,fill:mu});
  const gx0=X(W-PX-82),gy=140,r=66,c=2*Math.PI*r;
  g+=`<circle cx="${gx0}" cy="${gy}" r="${r}" fill="none" stroke="${ln}" stroke-width="16"/>`;
  if(av!=null)g+=`<circle cx="${gx0}" cy="${gy}" r="${r}" fill="none" stroke="${pcol(av)}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(c*av/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${gx0} ${gy})"/>`;
  g+=`<text x="${gx0}" y="${gy+16}" font-size="50" font-weight="800" fill="${tx}" text-anchor="middle">${av==null?'–':av}</text>`;
  g+=`<text x="${gx0}" y="${gy+r+40}" font-size="22" fill="${mu}" text-anchor="middle"${A?' direction="rtl"':''}>${x_(T('average percentile','متوسط المئين'))}</text>`;
  g+=t(PX,top,T('Pressure heat map · every pressure he made','خريطة الضغط الحرارية · كل ضغطاته'),{size:30,w:700});
  g+=`<rect x="${PX}" y="${pt}" width="${PW}" height="${PH}" rx="10" fill="${bg2}"/>`;
  const [GX,GY]=[12,8],cw=PW/GX,chh=PH/GY;let mx=0;me[8].forEach(v=>{if(v>mx)mx=v});
  me[8].forEach((v,k)=>{if(!v)return;const a=Math.floor(k/GY),b=k%GY,q=v/mx;
   g+=`<rect class="sb-hc" data-v="${v}" x="${(PX+(A?GX-1-a:a)*cw).toFixed(1)}" y="${(pt+b*chh).toFixed(1)}" width="${(cw+.5).toFixed(1)}" height="${(chh+.5).toFixed(1)}" fill="${th}" fill-opacity="${(.06+.9*Math.min(1,q/.75)).toFixed(3)}"/>`});
  g+=pitch(PX,pt,PW,A);
  g+=`<text x="${W-PX}" y="${pt+PH+36}" font-size="24" fill="${mu}" text-anchor="end"${A?' direction="rtl"':''}>${x_(T('attack '+(A?'←':'→'),'اتجاه الهجوم '+(A?'←':'→')))}</text>`;
  g+=t(PX,mt-6,T('Percentile among '+C.players.filter(p=>p!==me&&p[3]===me[3]&&p[4]>=C.min).length+' '+GN[me[3]][0]+' of '+C.name+' '+C.season,'المئين بين '+C.players.filter(p=>p!==me&&p[3]===me[3]&&p[4]>=C.min).length+' من '+GN[me[3]][1]+' في '+C.name+' '+C.season),{size:fit(C.name,26,PW*1.6),fill:mu});
  const BW=PW-84;
  rows.forEach((q,i)=>{const y0=mt+18+i*TH,lab=T(q.m[1],q.m[2]),pc=q.p==null?null:pcol(q.p),val=q.v==null?'–':q.v.toFixed(2),unit=q.v==null?'':A?' لكل 90':' /90';
   g+=`<text x="${X(PX)}" y="${y0+30}" font-size="${fit(lab+val,29,BW-60)}" fill="${tx}" text-anchor="start"${A?' direction="rtl"':''}>${x_(lab)}  <tspan font-weight="800" direction="ltr" unicode-bidi="embed">${x_(val)}</tspan><tspan font-weight="400" fill="${mu}">${unit}</tspan></text>`;
   const bx=A?W-PX-BW:PX,w=q.p==null?0:Math.max(14,BW*q.p/100),fx=A?W-PX-w:PX;
   g+=`<rect x="${bx}" y="${y0+46}" width="${BW}" height="28" rx="14" fill="${ln}"/>`;
   if(pc)g+=`<rect class="sb-on" x="${fx.toFixed(1)}" y="${y0+46}" width="${w.toFixed(1)}" height="28" rx="14" fill="${pc}"/>`;
   const cx=X(W-PX-30);g+=`<circle cx="${cx}" cy="${y0+60}" r="30" fill="${pc||ln}"/><text x="${cx}" y="${y0+70}" font-size="27" font-weight="800" fill="#fff" text-anchor="middle">${q.p==null?'–':q.p}</text>`});
  /* the notes, wrapped to the card's width */
  const wrap=(txt,n)=>{const out=[];let cur='';String(txt).split(' ').forEach(w=>{if((cur+' '+w).trim().length>n&&cur){out.push(cur);cur=w}else cur=(cur+' '+w).trim()});if(cur)out.push(cur);return out};
  const notes=wrap(adj?T('Possession-adjusted: each match\'s counts × 50 ÷ the opponent\'s share of the ball. A regain = the team has the ball within 5 s.','معدّلة حسب الاستحواذ: عدّ كل مباراة × 50 ÷ حصة الخصم من الكرة. الاستعادة = الفريق عنده الكرة خلال 5 ثوانٍ.'):T('Raw counts, not adjusted for possession. A regain = the team has the ball within 5 s.','أعداد خام بدون تعديل الاستحواذ. الاستعادة = الفريق عنده الكرة خلال 5 ثوانٍ.'),A?70:84)
   .concat(wrap(T('Percentiles only against players of the same tournament and position group. Free StatsBomb Open Data, for analysis only.','المئين فقط مقابل لاعبي نفس البطولة ونفس مجموعة المركز. بيانات StatsBomb المفتوحة المجانية، للتحليل فقط.'),A?70:84));
  const fy=mt+18+NR*TH+24;notes.forEach((l,i)=>{g+=t(PX,fy+i*28,l,{size:20,fill:mu})});
  const fb=fy+notes.length*28+20;
  g+=t(PX,fb,'PL Analytics',{size:26,w:800});
  if(logoURI)g+=`<image href="${x_(logoURI)}" x="${A?PX:W-PX-300}" y="${fb-30}" width="300" height="39" preserveAspectRatio="${A?'xMinYMid':'xMaxYMid'} meet"/>`;
  else g+=`<text x="${A?PX:W-PX}" y="${fb}" font-size="22" fill="${mu}" text-anchor="${A?'start':'end'}">StatsBomb</text>`;
  const aria=me[1]+': '+rows.map(q=>T(q.m[1],q.m[2])+' '+(q.v==null?'–':q.v.toFixed(2))+(q.p==null?'':' ('+q.p+')')).join(', ');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${x_(aria)}">${g}</svg>`,W,H,rows,av};
 }
 /* ---------- the page ---------- */
 R.sbpress=async function(el){
  el.innerHTML=`<h2>${two('Pressing maps','خرائط الضغط')}</h2>
   <div class="card sbp-att"><a href="https://github.com/statsbomb/open-data" target="_blank" rel="noopener"><img src="assets/statsbomb-logo.svg" alt="Hudl StatsBomb" height="22" style="height:22px;width:auto;vertical-align:middle"></a>
    <p class="mu" style="margin:8px 0 0;font-size:13px">${two('Data: free StatsBomb Open Data, for analysis only (not for commercial use). These are past competitions: PitchAPI, the source of the rest of this site, has no pressure events. Match maps are read from StatsBomb\'s public files in your browser; nothing of their raw files is kept here.','البيانات: StatsBomb Open Data المجانية، للتحليل فقط (مو للاستخدام التجاري). هذي بطولات سابقة: PitchAPI، مصدر باقي الموقع، ما عنده أحداث ضغط. خرائط المباريات تنقرأ من ملفات StatsBomb العامة في متصفحك؛ ما نحتفظ بشي من ملفاتهم الخام هنا.')}</p></div>
   <div class="ctl sbp-tabs" role="tablist"><button type="button" class="${S.tab==='m'?'':'s'}" data-t="m" role="tab">${two('Match map','خريطة مباراة')}</button><button type="button" class="${S.tab==='p'?'':'s'}" data-t="p" role="tab">${two('Player card','بطاقة لاعب')}</button></div>
   <div id="sbpb"></div>`;
  const b=el.querySelector('#sbpb');
  el.querySelectorAll('.sbp-tabs button').forEach(x=>x.onclick=()=>{S.tab=x.dataset.t;el.querySelectorAll('.sbp-tabs button').forEach(y=>y.className=y.dataset.t===S.tab?'':'s');S.tok++;S.tab==='m'?drawMatch(b):drawPlayer(b)});
  S.tab==='m'?drawMatch(b):drawPlayer(b);
 };
 const alive=(root,tok,lg)=>root.isConnected&&tok===S.tok;
 async function drawMatch(root){
  const tok=++S.tok;root.innerHTML=`<div class="empty skel">${two('Loading the competitions…','جاري تحميل البطولات…')}</div>`;
  let comps;try{comps=await get(SB+'/competitions.json')}catch(e){if(alive(root,tok))root.innerHTML=`<div class="empty">${two('Could not reach StatsBomb\'s open data. Try again later.','ما قدرنا نوصل لبيانات StatsBomb المفتوحة. جرّب بعدين.')}</div>`;return}
  if(!alive(root,tok))return;
  const L=comps.filter(c=>c.competition_name&&c.season_name).sort((a,b)=>a.competition_name.localeCompare(b.competition_name)||String(b.season_name).localeCompare(String(a.season_name)));
  const key=c=>c.competition_id+'/'+c.season_id;
  const FIRST=L.find(c=>c.competition_name==='UEFA Euro'&&c.season_name==='2024')||L[0];
  if(!S.cmp||!L.some(c=>key(c)===S.cmp)){S.cmp=key(FIRST);S.mid=''}
  const cur=L.find(c=>key(c)===S.cmp);
  root.innerHTML=`<div class="ctl dcx-ctl"><label class="dcx-l dcx-p"><span class="mu">${two('Competition','البطولة')}</span><select id="sbc">${L.map(c=>`<option value="${key(c)}"${key(c)===S.cmp?' selected':''}>${esc(c.competition_name+' · '+c.season_name+(c.competition_gender==='female'?' (women)':''))}</option>`).join('')}</select></label>
   <label class="dcx-l dcx-p"><span class="mu">${two('Match','المباراة')}</span><select id="sbm"><option>…</option></select></label></div><div class="dcx-c" id="sbmc"><div class="empty skel">${two('Loading…','جاري التحميل…')}</div></div>`;
  root.querySelector('#sbc').onchange=e=>{S.cmp=e.target.value;S.mid='';drawMatch(root)};
  let ms;try{ms=await get(`${SB}/matches/${S.cmp}.json`)}catch(e){if(alive(root,tok))root.querySelector('#sbmc').innerHTML=`<div class="empty">${two('Could not load this competition\'s matches.','ما قدرنا نحمّل مباريات هذي البطولة.')}</div>`;return}
  if(!alive(root,tok))return;
  ms=ms.slice().sort((a,b)=>String(b.match_date).localeCompare(String(a.match_date))||b.match_id-a.match_id);
  if(!ms.length){root.querySelector('#sbmc').innerHTML=`<div class="empty">${two('No matches.','ما فيه مباريات.')}</div>`;return}
  if(!S.mid||!ms.some(m=>String(m.match_id)===S.mid))S.mid=String(ms[0].match_id);
  const sel=root.querySelector('#sbm');sel.innerHTML=ms.map(m=>`<option value="${m.match_id}"${String(m.match_id)===S.mid?' selected':''}>${esc(m.home_team.home_team_name+' '+m.home_score+' – '+m.away_score+' '+m.away_team.away_team_name+' · '+m.match_date)}</option>`).join('');
  sel.onchange=e=>{S.mid=e.target.value;drawMatch(root)};
  const m=ms.find(x=>String(x.match_id)===S.mid),box=root.querySelector('#sbmc');
  box.innerHTML=`<div class="empty skel">${two('Reading the match from StatsBomb (about 3 MB)…','جاري قراءة المباراة من StatsBomb (حوالي 3 ميغا)…')}</div>`;
  let E,LU,lg;try{[E,LU,lg]=await Promise.all([get(`${SB}/events/${m.match_id}.json`),get(`${SB}/lineups/${m.match_id}.json`).catch(()=>[]),logo()])}catch(e){if(alive(root,tok))box.innerHTML=`<div class="empty">${two('Could not load this match\'s events.','ما قدرنا نحمّل أحداث هذي المباراة.')}</div>`;return}
  if(!alive(root,tok))return;
  const home=m.home_team.home_team_name,away=m.away_team.away_team_name,T=analyse(E,LU,home,away);
  const K=await matchCard({home,away,hs:m.home_score,as:m.away_score,sub:[m.competition.competition_name+' '+m.season.season_name,m.match_date].join(' · ')},T,lg);
  if(!alive(root,tok))return;
  box.innerHTML=K.svg+`<div class="dcx-a"><button type="button" class="s sbp-s">${two('Save image','حفظ كصورة')}</button></div>`;
  box.querySelector('.sbp-s').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await savePng(K.svg,K.W,K.H,K.title,'pressure-map')}catch(x){}finally{b.disabled=false}};
 }
 async function drawPlayer(root){
  const tok=++S.tok;root.innerHTML=`<div class="empty skel">${two('Loading…','جاري التحميل…')}</div>`;
  let D0;try{D0=await loadP()}catch(e){if(alive(root,tok))root.innerHTML=`<div class="empty">${two('Could not load the pressing data. Try again later.','ما قدرنا نحمّل بيانات الضغط. جرّب بعدين.')}</div>`;return}
  const logoURI=await logo();if(!alive(root,tok))return;
  const comps=D0.comps.map(c=>({id:c.id,sid:c.sid,name:c.name,season:c.season,min:c.min,players:c.players}));
  if(!comps[S.pc])S.pc=0;const C=comps[S.pc];
  const pool=C.players.filter(p=>p[3]!=='GK'&&p[4]>=C.min&&(!S.grp||p[3]===S.grp));
  const all=pool.slice().sort((a,b)=>a[1].localeCompare(b[1]));
  if(!all.length){root.innerHTML='<div class="empty">–</div>';return}
  let me=all.find(p=>String(p[0])===S.pid);if(!me){me=pool.slice().sort((a,b)=>(pr(b,'pr',S.adj)||0)-(pr(a,'pr',S.adj)||0)||a[1].localeCompare(b[1]))[0];S.pid=String(me[0])}
  const K=await playerCard({...C,players:C.players},me,S.adj,logoURI);if(!alive(root,tok))return;
  const opt=(k,en,a,v)=>`<option value="${k}"${String(k)===String(v)?' selected':''}>${esc(ar()?a:en)}</option>`;
  root.innerHTML=`<div class="ctl dcx-ctl"><label class="dcx-l"><span class="mu">${two('Tournament','البطولة')}</span><select id="sbpc">${comps.map((c,i)=>`<option value="${i}"${i===S.pc?' selected':''}>${esc(c.name+' '+c.season)}</option>`).join('')}</select></label>
   <label class="dcx-l"><span class="mu">${two('Position group','مجموعة المركز')}</span><select id="sbpg">${opt('','All outfield players','كل اللاعبين ما عدا الحراس',S.grp)}${GK.map(k=>opt(k,GN[k][0],GN[k][1],S.grp)).join('')}</select></label>
   <label class="dcx-l dcx-p"><span class="mu">${two('Player','اللاعب')}</span><input id="sbpp" list="sbppl" autocomplete="off" value="${esc(me[1])}"><datalist id="sbppl">${all.map(p=>`<option value="${esc(p[1])}">${esc(p[2])}</option>`).join('')}</datalist></label>
   <label class="dcx-k"><input type="checkbox" id="sbpa"${S.adj?' checked':''}>${two('Possession-adjusted','معدّلة حسب الاستحواذ')}</label></div>
   <div class="dcx-c">${K.svg}<div class="dcx-a"><button type="button" class="s sbp-s">${two('Save image','حفظ كصورة')}</button></div></div>`;
  root.querySelector('#sbpc').onchange=e=>{S.pc=+e.target.value;S.pid='';drawPlayer(root)};
  root.querySelector('#sbpg').onchange=e=>{S.grp=e.target.value;S.pid='';drawPlayer(root)};
  root.querySelector('#sbpa').onchange=e=>{S.adj=e.target.checked;drawPlayer(root)};
  root.querySelector('#sbpp').onchange=e=>{const v=e.target.value.trim().toLowerCase(),p=all.find(x=>x[1].toLowerCase()===v)||all.find(x=>x[1].toLowerCase().includes(v));if(p){S.pid=String(p[0]);drawPlayer(root)}};
  root.querySelector('.sbp-s').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await savePng(K.svg,K.W,K.H,me[1],'pressing')}catch(x){}finally{b.disabled=false}};
 }
 INS.ar({'Pressing maps':'خرائط الضغط'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
