/* ===== Player story (#/story, in Players after the players list): one player's season told in facts, and saved as an image =====
   Everything is counted from PitchAPI's files of this season (nothing estimated): his matches and their numbers from the league's per-match player
   file (INS.poolOne), the match ratings from <league>_rt.json, the results from the league file. The chapters:
   - the season in one picture: one bar per match (PitchAPI's rating; xG + xAG where a match has no rating), his goals and assists above it;
   - his best match: the highest rating (ties: more goals + assists, then the earlier match);
   - his longest run of matches with a goal or an assist (2+), and, for forwards and midfielders, the run he is on now without one (3+);
   - goals against xG, match by match, with what the site's Stat stability page found: goals repeat from one season to the next less than xG;
   - his last 5 matches against the whole season (xG + xAG per 90, the average rating);
   - where he stands: his percentiles among the players of his position in the six leagues (Player twins' pool: 450+ minutes, outfield), the three
     highest and the lowest, and the player most like him (the same similarity as Player twins).
   The picker, photos, age and value come from the XI Builder's pool (INS.playerPool, so xi-builder.js loads first; INS.twins from player-twin.js). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('story','Player story','players','players');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const POS={GK:['goalkeeper','حارس','goalkeepers','الحراس'],DF:['defender','مدافع','defenders','المدافعين'],MF:['midfielder','لاعب وسط','midfielders','لاعبي الوسط'],FW:['forward','مهاجم','forwards','المهاجمين']};
 const LAB={npxg:['Non-penalty xG','xG بدون ركلات جزاء'],sh:['Shots','التسديدات'],xag:['xAG (expected assists)','الصناعة المتوقعة (xAG)'],kp:['Key passes','التمريرات المفتاحية'],sca:['Shot-creating actions','الأفعال اللي صنعت تسديدة'],
  pr:['Progressive passes','التمريرات التقدمية'],bx:['Passes into the box','التمريرات داخل المنطقة'],ps:['Passes','التمريرات'],pc:['Progressive carries','حمل الكرة التقدمي'],cb:['Carries into the box','حمل الكرة لداخل المنطقة'],
  tkw:['Take-ons won','المراوغات الناجحة'],tk:['Tackles','الافتكاكات'],ic:['Interceptions','الاعتراضات'],bl:['Blocks','الصدّات'],duw:['Duels won','الالتحامات المكسوبة'],aerw:['Aerials won','الكرات الهوائية المكسوبة']};
 const RUN=2,DRY=3,LAST=5;
 const S={pick:'',lg:'',club:'',tok:0,dn:0};
 const domestic=l=>l&&l.file&&l.sh_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
 const RT=new Map();
 function rtOf(l){if(!l.rt_file)return Promise.resolve(null);const k=l.id+'|'+INS.poolKey();
  if(!RT.has(k))RT.set(k,loadJson(l.rt_file,l.rt_v).catch(e=>{RT.delete(k);return null}));return RT.get(k)}
 /* one player's season: his matches in date order with the result, his numbers and his rating */
 function season(o,rt,pid){
  const ix={};o.pl.cols.forEach((c,i)=>ix[c]=i);const ms=new Map(o.ms.map(m=>[m.id,m]));const out=[];
  for(const r of o.pl.rows){if(r[ix.i]!==pid)continue;const mi=r[ix.mi],m=ms.get(r[ix.m]);if(!m||mi==null||!(mi>0))continue;
   const club=r[ix.c],home=club===m.home?true:club===m.away?false:null,rv=rt&&rt.m&&rt.m[m.id]?rt.m[m.id][pid]:null;
   out.push({id:m.id,d:m.d,club,home,opp:home===true?m.away:home===false?m.home:'',gf:home===false?m.ag:m.hg,ga:home===false?m.hg:m.ag,mi,
    gl:r[ix.gl]||0,ast:r[ix.ast]||0,xg:r[ix.xg],xag:r[ix.xag],rt:typeof rv==='number'?rv:null})}
  return out.sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id));
 }
 function facts(M,pos){
  const F={n:M.length,mi:M.reduce((s,m)=>s+m.mi,0),gl:M.reduce((s,m)=>s+m.gl,0),ast:M.reduce((s,m)=>s+m.ast,0),
   xg:M.reduce((s,m)=>s+(m.xg||0),0),xag:M.reduce((s,m)=>s+(m.xag||0),0),xagN:M.filter(m=>m.xag!=null).length,rated:M.filter(m=>m.rt!=null)};
  F.best=F.rated.slice().sort((a,b)=>b.rt-a.rt||(b.gl+b.ast)-(a.gl+a.ast)||a.d.localeCompare(b.d)||a.id.localeCompare(b.id))[0]||null;
  let run=null,cur=null;M.forEach((m,i)=>{if(m.gl+m.ast>0){cur=cur?{...cur,n:cur.n+1,to:i}:{n:1,from:i,to:i};if(!run||cur.n>run.n)run=cur}else cur=null});
  F.run=run&&run.n>=RUN?{n:run.n,from:M[run.from].d,to:M[run.to].d}:null;
  let k=0;for(let i=M.length-1;i>=0&&M[i].gl+M[i].ast===0;i--)k++;
  F.dry=(pos==='FW'||pos==='MF')&&k>=DRY&&k<M.length?{n:k,since:M[M.length-k].d}:null;
  const p90=(L,f)=>{const ok=L.filter(m=>m.xg!=null&&m.xag!=null),mi=ok.reduce((s,m)=>s+m.mi,0);return mi>0?ok.reduce((s,m)=>s+f(m),0)/mi*90:null};
  F.p90=p90(M,m=>m.xg+m.xag);F.last=M.length>LAST?M.slice(-LAST):null;F.l90=F.last?p90(F.last,m=>m.xg+m.xag):null;
  const avg=L=>{const r=L.filter(m=>m.rt!=null);return r.length?r.reduce((s,m)=>s+m.rt,0)/r.length:null};F.ra=avg(M);F.lra=F.last?avg(F.last):null;
  return F;
 }
 /* percentiles and the closest player from Player twins' pool (his position, six leagues, 450+ minutes) */
 function stand(TP,lid,pid){
  if(!TP||!INS.twins)return null;const t=TP.list.find(x=>x.lid===lid&&x.id===pid);if(!t)return null;
  const f=t.p?(x=>x.q):(x=>x.qo),q=INS.twins.KEYS.map(k=>({k,v:f(t)[k]})).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v||a.k.localeCompare(b.k));
  const peers=TP.list.filter(x=>t.p?x.p===t.p:true);
  const tw=peers.filter(x=>x.id!==t.id).map(x=>({x,s:INS.twins.sim(t,x,f)})).filter(r=>r.s).sort((a,b)=>b.s.v-a.s.v||a.x.n.localeCompare(b.x.n))[0]||null;
  return {p:t.p,n:peers.length,top:q.slice(0,3),low:q.length>3?q[q.length-1]:null,tw};
 }
 const f2=v=>(+v).toFixed(2),f1=v=>(+v).toFixed(1),pc=v=>Math.round(v);
 const res=m=>m.gf>m.ga?'W':m.gf<m.ga?'L':'D';
 function timeline(M,F){
  const W=720,H=170,PX=6,top=34,base=H-22,n=M.length,bw=Math.max(3,Math.min(26,(W-2*PX)/n-3)),gap=(W-2*PX)/n,useR=F.rated.length>=n/2;
  const v=m=>useR?(m.rt!=null?(m.rt-5)/5:null):((m.xg||0)+(m.xag||0))/Math.max(1,...M.map(x=>(x.xg||0)+(x.xag||0)));
  let g=`<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="currentColor" stroke-opacity=".25"/>`;
  M.forEach((m,i)=>{const x=PX+i*gap+(gap-bw)/2,val=v(m),h=val==null?4:Math.max(4,Math.min(1,Math.max(0,val))*(base-top)),best=F.best&&F.best.id===m.id;
   g+=`<rect class="ps-b${best?' best':''}" data-m="${esc(m.id)}" x="${x.toFixed(1)}" y="${(base-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${val==null?'none':best?'#ffd54a':res(m)==='W'?'#3fa34d':res(m)==='L'?'#d64541':'#9aa3ad'}" stroke="${val==null?'#9aa3ad':'none'}"><title>${esc(m.d)} ${esc(m.opp)} ${m.gf}-${m.ga}${m.rt!=null?' · '+m.rt.toFixed(1):''}</title></rect>`;
   for(let k=0;k<m.gl+m.ast;k++)g+=`<circle class="${k<m.gl?'ps-g':'ps-a'}" cx="${(x+bw/2).toFixed(1)}" cy="${(base-h-7-k*9).toFixed(1)}" r="3.6" fill="${k<m.gl?'#fff':'#5aa9ff'}" stroke="#222" stroke-width=".8"/>`});
  return `<svg class="ps-tl" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ar()?'المباريات':'Matches'}">${g}</svg>
   <p class="mu ps-key">${two(`One bar per match, oldest first: ${useR?'the height is PitchAPI\'s rating (5 to 10)':'the height is xG + xAG (too few ratings)'}; green won, grey drew, red lost, gold his best match. White dots are his goals, blue dots his assists.`,`عمود لكل مباراة، من الأقدم: ${useR?`الارتفاع تقييم PitchAPI (من ${nb(5)} إلى ${nb(10)})`:`الارتفاع xG + xAG (التقييمات قليلة)`}؛ الأخضر فوز، الرمادي تعادل، الأحمر خسارة، الذهبي أفضل مبارياته. النقاط البيضاء أهدافه والزرقاء تمريراته الحاسمة.`)}</p>`;
 }
 function cumul(M){
  const W=720,H=150,P=24,n=M.length;let g=0,x=0;const G=[[0,0]],X_=[[0,0]];M.forEach((m,i)=>{g+=m.gl;x+=m.xg||0;G.push([i+1,g]);X_.push([i+1,x])});
  const mx=Math.max(1,g,x),pt=a=>a.map(([i,v])=>(P+i/n*(W-2*P)).toFixed(1)+','+(H-P-v/mx*(H-2*P)).toFixed(1)).join(' ');
  return `<svg class="ps-cu" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ar()?'الأهداف وxG':'Goals and xG'}"><line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" stroke="currentColor" stroke-opacity=".25"/>
   <polyline points="${pt(X_)}" fill="none" stroke="#9aa3ad" stroke-width="2.5" stroke-dasharray="6 4"/><polyline class="ps-gl" points="${pt(G)}" fill="none" stroke="#3fa34d" stroke-width="3"/></svg>
   <p class="mu ps-key">${two('Green: his goals added up match by match. Dashed: his xG added up.','الأخضر: أهدافه تراكميًا مباراة بعد مباراة. المتقطّع: الـ xG تراكميًا.')}</p>`;
 }
 function card(p,F,St){
  const A=ar(),T=(en,a)=>A?a:en,K=INS.cardKit||{},x_=K.x_||(s=>String(s)),FONT=K.FONT||'sans-serif',W=1080,H=1350,PX=64;
  const bg=K.css?K.css('--bg','#14141c'):'#14141c',fg='#ffffff',mu='rgba(255,255,255,.72)';
  const tx=(x,y,s,o={})=>`<text x="${A?W-x:x}" y="${y}" font-size="${o.size||28}" font-weight="${o.w||400}" fill="${o.fill||fg}" text-anchor="${o.a==='middle'?'middle':o.a==='end'?'end':'start'}"${A?' direction="rtl"':''}>${x_(s)}</text>`;
  let g=`<rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#psg)" opacity=".55"/>`;
  g+=tx(PX,92,T('SEASON STORY','قصة الموسم'),{size:26,w:700,fill:'#ffd54a'});
  g+=tx(PX,156,p.name,{size:K.fit?K.fit(p.name,62,W-2*PX):56,w:800});
  g+=tx(PX,200,[p.club,p.lgn,p.pos&&POS[p.pos]?T(POS[p.pos][0],POS[p.pos][1]):''].filter(Boolean).join(' · '),{size:28,fill:mu});
  const box=[[F.n,T('matches','مباراة')],[Math.round(F.mi),T('minutes','دقيقة')],[F.gl,T('goals','هدف')],[F.ast,T('assists','صناعة')],[F.xg.toFixed(1),'xG']];
  box.forEach(([v,l],i)=>{const cx=PX+(W-2*PX)/5*(i+.5);g+=`<text x="${cx}" y="300" font-size="58" font-weight="800" fill="${fg}" text-anchor="middle">${x_(v)}</text><text x="${cx}" y="338" font-size="24" fill="${mu}" text-anchor="middle">${x_(l)}</text>`});
  /* bars */
  const n=F.n,bt=390,bb=640,gap=(W-2*PX)/Math.max(1,n),bw=Math.max(4,Math.min(36,gap-4)),useR=F.rated.length>=n/2,mxv=Math.max(1,...F.M.map(m=>(m.xg||0)+(m.xag||0)));
  F.M.forEach((m,i)=>{const val=useR?(m.rt!=null?(m.rt-5)/5:null):((m.xg||0)+(m.xag||0))/mxv,h=val==null?6:Math.max(6,Math.min(1,Math.max(0,val))*(bb-bt-40)),xi=A?W-PX-(i+1)*gap+(gap-bw)/2:PX+i*gap+(gap-bw)/2;
   g+=`<rect x="${xi.toFixed(1)}" y="${(bb-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${F.best&&F.best.id===m.id?'#ffd54a':res(m)==='W'?'#3fa34d':res(m)==='L'?'#d64541':'#9aa3ad'}"/>`;
   for(let k=0;k<m.gl+m.ast;k++)g+=`<circle cx="${(xi+bw/2).toFixed(1)}" cy="${(bb-h-12-k*15).toFixed(1)}" r="6" fill="${k<m.gl?'#fff':'#5aa9ff'}"/>`});
  g+=tx(PX,680,T(useR?'Every match: PitchAPI rating · white = goal · blue = assist':'Every match: xG + xAG · white = goal · blue = assist','كل مباراة: تقييم PitchAPI · الأبيض هدف · الأزرق صناعة'),{size:22,fill:mu});
  let y=740;
  const line=s=>{g+=tx(PX,y,s,{size:K.fit?K.fit(s,30,W-2*PX):28});y+=50};
  if(F.best)line(T(`Best match: ${F.best.rt.toFixed(1)} v ${F.best.opp} (${F.best.d})`,`أفضل مباراة: ${F.best.rt.toFixed(1)} ضد ${F.best.opp} (${F.best.d})`));
  if(F.run)line(T(`${F.run.n} matches in a row with a goal or an assist`,`${F.run.n} مباريات ورا بعض فيها هدف أو صناعة`));
  line(T(`${F.gl} goals from ${F.xg.toFixed(1)} xG`,`${F.gl} أهداف من ${F.xg.toFixed(1)} xG`));
  if(St){y+=10;g+=tx(PX,y,T(`Best among ${POS[St.p]?POS[St.p][2]:'players'} of the six leagues (percentile)`,`الأفضل بين ${POS[St.p]?POS[St.p][3]:'اللاعبين'} في الدوريات الستة (النسبة المئوية)`),{size:24,fill:mu});y+=22;
   St.top.forEach(q=>{const w=(W-2*PX-120)*q.v/100,col=K.pcol?K.pcol(q.v):'#3fa34d';
    g+=`<rect x="${A?W-PX-w:PX}" y="${y+14}" width="${w.toFixed(1)}" height="16" rx="8" fill="${col}"/>`+tx(PX,y+6,T(LAB[q.k][0],LAB[q.k][1]),{size:24})+tx(W-PX,y+34,String(pc(q.v)),{size:28,w:800,a:'end'});y+=62});
   if(St.tw){y+=6;line(T(`Most like him: ${St.tw.x.n} (${St.tw.x.club})`,`أكثر لاعب يشبهه: ${St.tw.x.n} (${St.tw.x.club})`))}}
  g+=tx(PX,H-50,'PL Analytics',{size:28,w:800})+tx(W-PX,H-50,T('Data: PitchAPI','البيانات: PitchAPI'),{size:22,fill:mu,a:'end'});
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${x_(p.name)}"><defs><linearGradient id="psg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b2a6b"/><stop offset="1" stop-color="#0c3b46"/></linearGradient></defs>${g}</svg>`,W,H};
 }
 R.story=async function(el,arg){
  el.innerHTML='<h2>Player story</h2><div id="psroot" class="ins lk ps"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#psroot'),lg=D.id,tok=++S.tok;
  if(arg&&/\|/.test(decodeURIComponent(arg)))S.pick=decodeURIComponent(arg);
  let P;try{P=await INS.playerPool()}catch(e){P=null}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  const lgs=P?P.lgs.filter(domestic):[];
  if(!P||!lgs.length){root.innerHTML=`<div class="empty">${two('The players could not be loaded. Try again later.','ما قدرنا نحمّل اللاعبين. جرّب بعدين.')}</div>`;return}
  const all=P.all.filter(p=>lgs.some(l=>l.id===p.lg));
  if(!S.pick||!P.by.has(S.pick)||!lgs.some(l=>l.id===P.by.get(S.pick).lg)){const here=all.filter(p=>p.lg===(lgs.some(l=>l.id===D.id)?D.id:lgs[0].id));
   const c=here.slice().sort((a,b)=>(b.gl+b.ast)-(a.gl+a.ast)||b.mi-a.mi||a.name.localeCompare(b.name))[0];S.pick=c?c.key:all[0].key}
  const p0=P.by.get(S.pick);S.lg=p0.lg;S.club=p0.club;
  await draw(root,P,all,lgs,tok);
 };
 async function draw(root,P,all,lgs,tok){
  const p=P.by.get(S.pick),l=lgs.find(x=>x.id===p.lg),n=++S.dn;
  const inLg=all.filter(x=>x.lg===S.lg),clubs=[...new Set(inLg.map(x=>x.club))].sort((a,b)=>a.localeCompare(b)),squad=inLg.filter(x=>x.club===S.club).sort((a,b)=>b.mi-a.mi||a.name.localeCompare(b.name));
  root.innerHTML=`<div class="card ps-pick"><div class="ctl"><select id="psl" aria-label="${ar()?'الدوري':'League'}">${lgs.map(x=>`<option value="${esc(x.id)}"${x.id===S.lg?' selected':''}>${esc(x.name)}</option>`).join('')}</select>
   <select id="psc" aria-label="${ar()?'النادي':'Club'}">${clubs.map(c=>`<option${c===S.club?' selected':''}>${esc(c)}</option>`).join('')}</select>
   <select id="psp" aria-label="${ar()?'اللاعب':'Player'}">${squad.map(x=>`<option value="${esc(x.key)}"${x.key===S.pick?' selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div><div id="psbody"><div class="empty skel">Loading…</div></div>`;
  const q=s=>root.querySelector(s),re=()=>draw(root,P,all,lgs,tok);
  q('#psl').onchange=e=>{S.lg=e.target.value;const c=all.filter(x=>x.lg===S.lg).sort((a,b)=>b.mi-a.mi)[0];S.club=c?c.club:'';S.pick=c?c.key:S.pick;re()};
  q('#psc').onchange=e=>{S.club=e.target.value;const c=all.filter(x=>x.lg===S.lg&&x.club===S.club).sort((a,b)=>b.mi-a.mi)[0];if(c)S.pick=c.key;re()};
  q('#psp').onchange=e=>{S.pick=e.target.value;re()};
  if(p.lg!==S.lg||p.club!==S.club)return;
  let o,rt,TP;
  try{[o,rt,TP]=await Promise.all([INS.poolOne(p.lg,['pl']),rtOf(l),INS.twins?INS.twins.pool().catch(()=>null):null])}catch(e){o=null}
  if(!root.isConnected||tok!==S.tok||n!==S.dn)return;
  const body=q('#psbody');
  if(!o||!o.pl){body.innerHTML=`<div class="empty">${two('This league\'s player file could not be loaded. Try again later.','ما قدرنا نحمّل ملف لاعبي هالدوري. جرّب بعدين.')}</div>`;return}
  const M=season(o,rt,p.id);
  if(!M.length){body.innerHTML=`<div class="empty">${two('No finished matches with minutes for this player yet.','ما فيه مباريات منتهية لعب فيها هاللاعب للحين.')}</div>`;return}
  const F=facts(M,p.pos);F.M=M;const St=stand(TP,p.lg,p.id),pos=p.pos&&POS[p.pos];
  const best=F.best,diff=F.gl-F.xg;
  body.innerHTML=`<div class="card ps-head"><div class="ps-who"><span class="xb-av big" style="${typeof clubVars==='function'?clubVars(p.club):''}"><b>${esc(String(p.name).split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</b>${p.photo?`<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}</span>
    <div><h3>${nm(p.name)}</h3><p class="mu">${nm(p.club)} · ${nm(l.name)}${pos?' · '+two(pos[0],pos[1]):''}${p.age!=null?' · '+two(p.age+' years old',nb(p.age)+' سنة'):''}${p.val!=null&&INS.money?' · '+nb(INS.money(p.val)):''}</p></div></div>
    <p class="ps-lead">${two(`This season: <b>${F.n}</b> ${F.n===1?'match':'matches'}, <b>${Math.round(F.mi)}</b> minutes, <b>${F.gl}</b> ${F.gl===1?'goal':'goals'} and <b>${F.ast}</b> ${F.ast===1?'assist':'assists'}, from ${f2(F.xg)} xG${F.xagN?` and ${f2(F.xag)} xAG${F.xagN<F.n?` (PitchAPI has xAG for ${F.xagN} of his ${F.n} matches)`:''}`:' (PitchAPI has no xAG for his matches)'}.`,`هالموسم: <b>${nb(F.n)}</b> مباراة، <b>${nb(Math.round(F.mi))}</b> دقيقة، <b>${nb(F.gl)}</b> أهداف و<b>${nb(F.ast)}</b> تمريرات حاسمة، من ${nb(f2(F.xg))} xG${F.xagN?` و${nb(f2(F.xag))} xAG${F.xagN<F.n?` (PitchAPI عنده xAG لـ ${nb(F.xagN)} من ${nb(F.n)} مباريات له)`:''}`:' (PitchAPI ما عنده xAG لمبارياته)'}.`)}</p>
    <button type="button" id="pssave" class="xb-clear">${two('Save the story as an image','احفظ القصة كصورة')}</button></div>
   <div class="card"><h3>${two('The season in one picture','الموسم في صورة')}</h3>${timeline(M,F)}</div>
   <div class="card ps-ch"><h3>${two('Highs and lows','القمم والقيعان')}</h3>
    ${best?`<p class="ps-best">${two(`<b>His best match</b> by PitchAPI's rating: <b>${best.rt.toFixed(1)}</b> on ${esc(best.d)}, ${best.home?'at home to':'away at'} ${esc(best.opp)}: his team ${res(best)==='W'?'won':res(best)==='L'?'lost':'drew'} ${best.gf}–${best.ga}${best.gl+best.ast?`, with ${[best.gl?best.gl+(best.gl>1?' goals':' goal'):'',best.ast?best.ast+(best.ast>1?' assists':' assist'):''].filter(Boolean).join(' and ')}`:''}.`,`<b>أفضل مبارياته</b> حسب تقييم PitchAPI: <b>${nb(best.rt.toFixed(1))}</b> في ${nb(esc(best.d))}، ${best.home?'على أرضه ضد':'خارج أرضه ضد'} ${nm(best.opp)}: فريقه ${res(best)==='W'?'فاز':res(best)==='L'?'خسر':'تعادل'} ${nb(best.gf+'–'+best.ga)}${best.gl+best.ast?`، ${[best.gl?`سجّل ${nb(best.gl)}`:'',best.ast?`صنع ${nb(best.ast)}`:''].filter(Boolean).join(' و')}`:''}.`)}</p>`:`<p class="mu">${two('PitchAPI has no ratings for his matches yet.','PitchAPI ما عنده تقييمات لمبارياته للحين.')}</p>`}
    ${F.run?`<p class="ps-run">${two(`<b>His best run:</b> a goal or an assist in <b>${F.run.n}</b> matches in a row, from ${esc(F.run.from)} to ${esc(F.run.to)}.`,`<b>أحسن سلسلة له:</b> هدف أو صناعة في <b>${nb(F.run.n)}</b> مباريات ورا بعض، من ${nb(esc(F.run.from))} إلى ${nb(esc(F.run.to))}.`)}</p>`:''}
    ${F.dry?`<p class="ps-dry">${two(`<b>Right now:</b> ${F.dry.n} matches without a goal or an assist, since ${esc(F.dry.since)}.`,`<b>الحين:</b> ${nb(F.dry.n)} مباريات بدون هدف ولا صناعة، من ${nb(esc(F.dry.since))}.`)}</p>`:''}
    ${!F.run&&!F.dry&&F.gl+F.ast===0?`<p class="mu">${two('No goal or assist yet this season.','ما سجّل ولا صنع هالموسم للحين.')}</p>`:''}</div>
   <div class="card ps-ch"><h3>${two('Goals and chances','الأهداف والفرص')}</h3>${cumul(M)}
    <p class="ps-fin">${two(`<b>${F.gl}</b> ${F.gl===1?'goal':'goals'} from <b>${f2(F.xg)}</b> xG: ${Math.abs(diff)<0.05?'just what his chances were worth':`<b>${f2(Math.abs(diff))}</b> ${diff>0?'more':'fewer'} than his chances were worth`}.`,`<b>${nb(F.gl)}</b> أهداف من <b>${nb(f2(F.xg))}</b> xG: ${Math.abs(diff)<0.05?'بالضبط قد فرصه':`${diff>0?'أكثر':'أقل'} من قيمة فرصه بـ <b>${nb(f2(Math.abs(diff)))}</b>`}.`)}</p>
    <p class="mu ins-note">${two('On the <a href="#/stability">Stat stability</a> page, goals repeat from one season to the next less than xG does, so a big gap between the two often does not last.','في صفحة <a href="#/stability">ثبات الإحصائيات</a>، الأهداف تتكرر من موسم للي بعده أقل من الـ xG، فالفرق الكبير بينهم غالبًا ما يستمر.')}</p></div>
   ${F.last?`<div class="card ps-ch"><h3>${two(`The last ${LAST} matches`,`آخر ${nb(LAST)} مباريات`)}</h3>
    <p class="ps-form">${F.l90!=null&&F.p90!=null?two(`xG + xAG per 90: <b>${f2(F.l90)}</b> in his last ${LAST} matches, against ${f2(F.p90)} over the whole season${F.xagN<F.n?' (matches with xAG only)':''}.`,`xG + xAG لكل 90 دقيقة: <b>${nb(f2(F.l90))}</b> في آخر ${nb(LAST)} مباريات، مقابل ${nb(f2(F.p90))} في الموسم كله${F.xagN<F.n?' (المباريات اللي فيها xAG بس)':''}.`):''}
    ${F.lra!=null&&F.ra!=null?' '+two(`Average rating <b>${f2(F.lra)}</b>, against ${f2(F.ra)}.`,`متوسط التقييم <b>${nb(f2(F.lra))}</b>، مقابل ${nb(f2(F.ra))}.`):''}</p></div>`:''}
   <div class="card ps-ch"><h3>${two('Where he stands','وين مكانه')}</h3>
    ${St?`<p>${two(`Percentile among the ${St.n} ${POS[St.p]?POS[St.p][2]:'outfield players'} of the six leagues with ${INS.twins.MIN}+ minutes (100 = the most), per 90 minutes:`,`النسبة المئوية بين ${nb(St.n)} من ${POS[St.p]?POS[St.p][3]:'اللاعبين'} في الدوريات الستة اللي لعبوا ${nb(INS.twins.MIN)}+ دقيقة (${nb(100)} = الأعلى)، لكل 90 دقيقة:`)}</p>
     <div class="ps-bars">${St.top.concat(St.low?[St.low]:[]).map((q,i)=>`<div class="ps-bar${i===3?' low':''}" data-k="${q.k}"><span class="ps-l">${i===3?two('Lowest: ','الأقل: '):''}${two(LAB[q.k][0],LAB[q.k][1])}</span><span class="ps-t"><i style="width:${q.v.toFixed(1)}%;background:${INS.cardKit&&INS.cardKit.pcol?INS.cardKit.pcol(q.v):'#3fa34d'}"></i></span><b class="ps-v">${nb(pc(q.v))}</b></div>`).join('')}</div>
     ${St.tw?`<p class="ps-tw">${two(`<b>Most like him:</b> ${esc(St.tw.x.n)} (${esc(St.tw.x.club)}, ${esc(St.tw.x.ln)}), similarity <b>${f1(St.tw.s.v)}</b> out of 100. More on <a href="#/twins">Player twins</a>.`,`<b>أكثر لاعب يشبهه:</b> ${nm(St.tw.x.n)} (${nm(St.tw.x.club)}، ${nm(St.tw.x.ln)})، التشابه <b>${nb(f1(St.tw.s.v))}</b> من ${nb(100)}. أكثر في <a href="#/twins">توائم اللاعبين</a>.`)}</p>`:''}`
    :`<p class="mu">${two(p.pos==='GK'?'Goalkeepers are not compared with these outfield measures.':`Not enough minutes yet: the comparison needs ${INS.twins?INS.twins.MIN:450}+ minutes.`,p.pos==='GK'?'الحراس ما يتقارنون بهالمقاييس الخاصة بلاعبي الملعب.':`الدقايق ما تكفي للحين: المقارنة تحتاج ${nb(INS.twins?INS.twins.MIN:450)}+ دقيقة.`)}</p>`}</div>
   <p class="mu ins-note">${two('Every number is counted from PitchAPI\'s match files of this season; ratings are PitchAPI\'s.','كل رقم محسوب من ملفات مباريات PitchAPI لهالموسم؛ والتقييمات من PitchAPI.')}</p>`;
  const sv=body.querySelector('#pssave');sv.onclick=async()=>{if(!INS.cardKit||!INS.cardKit.savePng)return;const c=card({...p,lgn:l.name},F,St);sv.disabled=true;try{await INS.cardKit.savePng(c.svg,c.W,c.H,p.name,'story')}catch(e){}sv.disabled=false};
  INS.storyCard=()=>card({...p,lgn:l.name},F,St);
 }
 INS.ar({'Player story':'قصة اللاعب'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
