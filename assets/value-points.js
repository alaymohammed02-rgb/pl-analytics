/* ===== Value vs points (#/value, in the Teams hub after Rest days): does a bigger squad value go with more points? =====
   For each club of the open league: the sum of its players' Transfermarkt market values (data/tm.json through the XI Builder's player pool, the same numbers as Player prices) against its points
   per game in the finished matches of this season. A line through the clubs (ordinary least squares of points per game on the natural log of the squad value, so a doubling is one step) says what
   a club of that value would be expected to take; the gap between a club and the line is what it took above or below that. Only clubs with most of the squad priced count towards the line (a
   newly promoted club's players are mostly missing from the source, so its sum is an undercount: shown hollow, left out of the line). Across the six leagues each club's log value and points per
   game are first set against its own league (z-scores), so a league with more money does not drown the others.
   What it can and cannot say: the values are dated (the dataset's updates are paused; the page prints the dates), which is before this season's matches, so a value cannot have been moved by
   these results; but a few matches a club is a small sample, and a correlation is not a price list. Nothing is estimated beyond the line. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function'||typeof INS.playerPool!=='function'||typeof INS.pool!=='function')return;
 INS.addPage('value','Value vs points','teams','rest');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const MINCOV=0.6,MINN=8,MINP=3;
 const S={order:'diff',tok:0};
 const domestic=l=>l&&l.file&&l.sh_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const f2=x=>x.toFixed(2),f1=x=>x.toFixed(1),sg=x=>(x>=0?'+':'−')+Math.abs(x).toFixed(2);
 const money=v=>v>=1e9?'€'+(v/1e9).toFixed(2)+'bn':INS.money(v);
 /* clubs of one league: value, squad, points */
 function clubsOf(id,P,POOLS){
  const o=POOLS.leagues.find(x=>x.l.id===id);if(!o)return [];
  const tab=new Map(),team=n=>tab.get(n)||tab.set(n,{club:n,played:0,pts:0}).get(n);
  o.ms.forEach(m=>{const h=team(m.home),a=team(m.away);h.played++;a.played++;if(m.hg>m.ag)h.pts+=3;else if(m.hg<m.ag)a.pts+=3;else{h.pts++;a.pts++}});
  const sq=new Map();P.all.filter(p=>p.lg===id).forEach(p=>{const s=sq.get(p.club)||sq.set(p.club,{n:0,pr:0,sum:0}).get(p.club);s.n++;if(p.val!=null){s.pr++;s.sum+=p.val}});
  return [...tab.values()].filter(c=>c.played>0).map(c=>{const s=sq.get(c.club)||{n:0,pr:0,sum:0};return {club:c.club,played:c.played,pts:c.pts,ppg:c.pts/c.played,val:s.sum,pr:s.pr,n:s.n,cov:s.n?s.pr/s.n:0}}).sort((a,b)=>cmp(a.club,b.club));
 }
 /* a short name for the chart (the full name is in the hover title and the table) */
 const short=n=>{let t=n.replace(/ United$/,' Utd').replace(/ Hotspur$/,'').replace(/ & Hove Albion$/,'').replace(/^(FC|AFC|SC|AC|AS|RC|SS|US|CD|UD|OGC|VfB|VfL|TSG|1\. FC|SV) /,'');return t.length>15?t.slice(0,15):t};
 const usable=c=>c.val>0&&c.cov>=MINCOV&&c.played>=MINP;
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const fisher=(r,n)=>{if(n<4||!isFinite(r)||Math.abs(r)>=1)return null;const z=Math.atanh(r),se=1/Math.sqrt(n-3);return [Math.tanh(z-1.96*se),Math.tanh(z+1.96*se)]};
 /* ordinary least squares of y on x; r and the slope's standard error */
 function ols(xs,ys){
  const n=xs.length,mx=mean(xs),my=mean(ys);let sxx=0,sxy=0,syy=0;
  xs.forEach((x,i)=>{sxx+=(x-mx)**2;sxy+=(x-mx)*(ys[i]-my);syy+=(ys[i]-my)**2});
  if(!(sxx>0)||!(syy>0))return null;
  const b=sxy/sxx,a=my-b*mx,r=sxy/Math.sqrt(sxx*syy),sse=ys.reduce((s,y,i)=>s+(y-(a+b*xs[i]))**2,0),se=n>2?Math.sqrt(sse/(n-2)/sxx):null;
  return {n,a,b,r,se,ci:fisher(r,n)};
 }
 function fit(cs){const u=cs.filter(usable);if(u.length<MINN)return null;return ols(u.map(c=>Math.log(c.val/1e6)),u.map(c=>c.ppg))}
 const rd=(r,ci)=>r.toFixed(2)+(ci?' ('+ci[0].toFixed(2)+' '+(ar()?'إلى':'to')+' '+ci[1].toFixed(2)+')':'');
 /* labels on the chart: the first free spot among eight places round the dot at three distances; a label that finds none is left out (the dot keeps its hover title and the table lists the club) */
 function labels(items,W,H,fs){
  const cw=fs*.7,placed=[],out=[],hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
  const dots=items.map(o=>({x0:o.x-o.r,x1:o.x+o.r,y0:o.y-o.r,y1:o.y+o.r}));
  items.map((o,i)=>i).sort((a,b)=>items[a].y-items[b].y||items[a].x-items[b].x).forEach(i=>{
   const o=items[i],w=o.t.length*cw,c=[];
   for(const d of [.8,2.2,3.6]){const rr=o.r+d;c.push(['start',o.x+rr,o.y+fs*.35],['end',o.x-rr,o.y+fs*.35],['middle',o.x,o.y-rr],['middle',o.x,o.y+rr+fs*.8],['start',o.x+rr*.7,o.y-rr*.8],['end',o.x-rr*.7,o.y-rr*.8],['start',o.x+rr*.7,o.y+rr*.8+fs*.6],['end',o.x-rr*.7,o.y+rr*.8+fs*.6])}
   let best=null;
   for(const [a,x,y] of c){const x0=a==='middle'?x-w/2:a==='start'?x:x-w,bx={x0:x0-.4,x1:x0+w+.4,y0:y-fs*1.1,y1:y+fs*.4};let s=0;placed.forEach(p=>{if(hit(bx,p))s++});dots.forEach((k,j)=>{if(j!==i&&hit(bx,k))s++});if(bx.x0<0||bx.x1>W||bx.y0<0||bx.y1>H)s+=3;if(s===0){best={a,x,y,bx};break}}
   if(best)placed.push(best.bx);out[i]=best});
  return out;
 }
 function chart(cs,F){
  const W=160,H=110,L=14,Rr=3,T=4,B=11,all=cs.filter(c=>c.val>0);
  if(!all.length)return '';
  const lx=all.map(c=>Math.log(c.val/1e6)),x0=Math.min(...lx)-.15,x1=Math.max(...lx)+.15,py=v=>T+(H-T-B)*(1-v/3),px=v=>L+(W-L-Rr)*(v-x0)/(x1-x0);
  const ticks=[10,20,50,100,200,500,1000,2000,5000].filter(v=>Math.log(v)>=x0&&Math.log(v)<=x1);
  const grid=ticks.map(v=>`<line x1="${px(Math.log(v)).toFixed(2)}" y1="${T}" x2="${px(Math.log(v)).toFixed(2)}" y2="${H-B}" class="vl-g"/><text x="${px(Math.log(v)).toFixed(2)}" y="${H-B+4}" text-anchor="middle" class="vl-t">${v>=1000?'€'+(v/1000)+'bn':'€'+v+'m'}</text>`).join('')+
   [0,1,2,3].map(v=>`<line x1="${L}" y1="${py(v).toFixed(2)}" x2="${W-Rr}" y2="${py(v).toFixed(2)}" class="vl-g"/><text x="${L-1.5}" y="${(py(v)+1).toFixed(2)}" text-anchor="end" class="vl-t">${v}</text>`).join('');
  const pts=all.map(c=>({c,x:px(Math.log(c.val/1e6)),y:py(c.ppg),r:1.25,t:short(c.club)}));
  const lab=labels(pts,W,H,2.7);
  const line=F?(()=>{const xa=x0+.15,xb=x1-.15,ya=Math.max(0,Math.min(3,F.a+F.b*xa)),yb=Math.max(0,Math.min(3,F.a+F.b*xb));return `<line class="vl-fit" x1="${px(xa).toFixed(2)}" y1="${py(F.a+F.b*xa).toFixed(2)}" x2="${px(xb).toFixed(2)}" y2="${py(F.a+F.b*xb).toFixed(2)}"/>`})():'';
  const dots=pts.map((o,i)=>`<g class="vl-p${usable(o.c)?'':' lo'}" data-club="${esc(o.c.club)}"><circle cx="${o.x.toFixed(2)}" cy="${o.y.toFixed(2)}" r="${o.r}"><title>${esc(o.c.club)} · ${money(o.c.val)} · ${f2(o.c.ppg)} ${ar()?'نقطة بالمباراة':'points a game'}${usable(o.c)?'':(ar()?' · أقل من 60% من التشكيلة لها سعر':' · under 60% of the squad priced')}</title></circle>${lab[i]?`<text x="${lab[i].x.toFixed(2)}" y="${lab[i].y.toFixed(2)}" text-anchor="${lab[i].a}" class="vl-l lx-t">${esc(o.t)}</text>`:''}</g>`).join('');
  return `<svg class="vl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ar()?'القيمة السوقية للتشكيلة مقابل النقاط بالمباراة':'Squad market value against points per game'}">${grid}${line}${dots}<text x="${(L+W-Rr)/2}" y="${H-1}" text-anchor="middle" class="vl-t">${ar()?'القيمة السوقية للتشكيلة (مقياس لوغاريتمي)':'squad market value (log scale)'}</text><text transform="translate(3 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle" class="vl-t">${ar()?'نقاط بالمباراة':'points a game'}</text></svg>`;
 }
 R.value=async function(el){
  el.innerHTML='<h2>Value vs points</h2><div id="vlroot" class="ins lk vl"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#vlroot'),lg=D.id,tok=++S.tok;
  const gone=()=>!root.isConnected||tok!==S.tok||D.id!==lg;
  let P,POOLS;
  try{[P,POOLS]=await Promise.all([INS.playerPool(),INS.pool([])])}catch(e){if(gone())return;root.innerHTML=`<div class="empty">${two('Could not load the players. Try again later.','ما قدرنا نحمّل اللاعبين. جرّب بعدين.')}</div>`;return}
  if(gone())return;
  if(!P.tm){root.innerHTML=`<div class="empty">${two('No prices yet: the market-value file has not been downloaded. It arrives with the next data update.','ما فيه أسعار للحين: ملف القيم السوقية ما انحمّل. يوصل مع التحديث الجاي.')}</div>`;return}
  const L0=(ALL.leagues||[]).find(l=>l.id===lg);
  if(P.miss&&P.miss.includes(L0&&L0.name)){root.innerHTML=`<div class="empty">${two('Could not load the players. Try again later.','ما قدرنا نحمّل اللاعبين. جرّب بعدين.')}</div>`;return}
  if(!domestic(L0)){root.innerHTML=`<div class="empty">${two('This page compares the clubs of the six domestic leagues. Choose a league from the list at the top.','هالصفحة تقارن أندية الدوريات المحلية الستة. اختر دوري من القائمة فوق.')}</div>`;return}
  const doms=(ALL.leagues||[]).filter(domestic),per=new Map();
  doms.forEach(l=>{const cs=clubsOf(l.id,P,POOLS);per.set(l.id,{l,cs,F:fit(cs)})});
  draw(root,P,per,lg);
 };
 function draw(root,P,per,lg){
  const {l,cs,F}=per.get(lg),played=Math.max(0,...cs.map(c=>c.played));
  const rows=cs.map(c=>{const e=F&&usable(c)?F.a+F.b*Math.log(c.val/1e6):null;return {...c,exp:e,diff:e==null?null:c.ppg-e}});
  const ord={diff:(a,b)=>(a.diff==null)-(b.diff==null)||((b.diff||0)-(a.diff||0))||cmp(a.club,b.club),val:(a,b)=>b.val-a.val||cmp(a.club,b.club),pts:(a,b)=>b.ppg-a.ppg||b.val-a.val||cmp(a.club,b.club)};
  const sorted=rows.slice().sort(ord[S.order]);
  const ctl=`<div class="seg vl-ord" id="vlord" role="group" aria-label="${ar()?'الترتيب':'Order'}">${[['diff','Over / under the line','فوق / تحت الخط'],['val','Squad value','قيمة التشكيلة'],['pts','Points a game','النقاط بالمباراة']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${S.order===k}" class="${S.order===k?'on':''}">${two(e,a)}</button>`).join('')}</div>`;
  const tbl=`<div class="vl-tw"><table class="vl-tb" id="vltb"><thead><tr><th>${two('Club','النادي')}</th><th>${two('Squad value','قيمة التشكيلة')}</th><th>${two('Priced','لها سعر')}</th><th>${two('P','لعب')}</th><th>${two('Pts','نقاط')}</th><th>${two('Pts/game','نقطة/مباراة')}</th><th>${two('Line says','الخط يقول')}</th><th>${two('Gap','الفرق')}</th></tr></thead><tbody>${sorted.map(c=>`<tr data-club="${esc(c.club)}" data-val="${Math.round(c.val)}" data-pr="${c.pr}" data-n="${c.n}" data-p="${c.played}" data-pts="${c.pts}" data-ppg="${f2(c.ppg)}" data-exp="${c.exp==null?'':f2(c.exp)}" data-diff="${c.diff==null?'':f2(c.diff)}" data-in="${usable(c)?1:0}">
    <td>${nm(c.club)}</td><td>${c.val>0?nb(money(c.val)):'–'}</td><td>${nb(c.pr+' / '+c.n)}</td><td>${nb(c.played)}</td><td>${nb(c.pts)}</td><td>${nb(f2(c.ppg))}</td><td>${c.exp==null?'–':nb(f2(Math.max(0,c.exp)))}</td><td class="${c.diff==null?'':c.diff>=0?'vl-up':'vl-dn'}">${c.diff==null?'–':nb(sg(c.diff))}</td></tr>`).join('')}</tbody></table></div>`;
  const slope=F?F.b*Math.LN2:null;
  const sum=F?`<div class="card vl-sum" id="vlsum" data-n="${F.n}" data-r="${f2(F.r)}" data-slope="${f2(slope)}" data-lo="${F.ci?f2(F.ci[0]):''}" data-hi="${F.ci?f2(F.ci[1]):''}"><p>${two(`In ${nm(l.name)}, over the ${nb(F.n)} clubs with most of the squad priced, squad value and points per game go together: <b>r = ${nb(rd(F.r,F.ci))}</b>. Each doubling of the squad value goes with <b>${nb(sg(slope))}</b> points a game${F.se?` (±${nb(f2(F.se*Math.LN2))})`:''} on the line. ${F.ci&&F.ci[0]>0?'The relation is clear beyond chance.':F.ci&&F.ci[1]<0?'The relation runs against value, beyond chance.':'The interval includes zero: within noise at this point of the season.'}`,
    `في ${nm(l.name)}، بين الـ${nb(F.n)} أندية اللي أغلب تشكيلتها لها سعر، قيمة التشكيلة والنقاط بالمباراة يمشون مع بعض: <b>r = ${nb(rd(F.r,F.ci))}</b>. كل مضاعفة لقيمة التشكيلة تروح مع <b>${nb(sg(slope))}</b> نقطة بالمباراة${F.se?` (±${nb(f2(F.se*Math.LN2))})`:''} على الخط. ${F.ci&&F.ci[0]>0?'العلاقة واضحة وأكبر من الصدفة.':F.ci&&F.ci[1]<0?'العلاقة عكس القيمة وأكبر من الصدفة.':'الفترة تشمل الصفر: ضمن الضجيج في هذه المرحلة من الموسم.'}`)}</p></div>`
   :`<div class="card vl-sum" id="vlsum" data-n="0"><p>${two(`Fewer than ${MINN} clubs of ${nm(l.name)} have ${Math.round(MINCOV*100)}% of the squad priced and ${MINP}+ matches played, so there is no line yet.`,`أقل من ${nb(MINN)} أندية في ${nm(l.name)} لها أسعار لـ${nb(Math.round(MINCOV*100))}% من التشكيلة ولعبت ${nb(MINP)}+ مباريات، فما فيه خط للحين.`)}</p></div>`;
  /* six leagues: each league's own r, and one r over all clubs after each league's z-scores */
  const lr=[...per.values()].map(({l:ll,cs:c2,F:f2_})=>({l:ll,n:c2.filter(usable).length,F:f2_}));
  const pool=[];per.forEach(({cs:c2})=>{const u=c2.filter(usable);if(u.length<MINN)return;const xs=u.map(c=>Math.log(c.val/1e6)),ys=u.map(c=>c.ppg),mx=mean(xs),my=mean(ys),sx=Math.sqrt(mean(xs.map(v=>(v-mx)**2))),sy=Math.sqrt(mean(ys.map(v=>(v-my)**2)));if(sx>0&&sy>0)u.forEach((c,i)=>pool.push([(xs[i]-mx)/sx,(ys[i]-my)/sy]))});
  const PF=pool.length>=MINN?ols(pool.map(p=>p[0]),pool.map(p=>p[1])):null;
  const pooled=`<div class="card vl-all" id="vlall"><h3>${two('Across the six leagues','عبر الدوريات الستة')}</h3>
   <div class="vl-tw"><table class="vl-tb" id="vlpool"><thead><tr><th>${two('League','الدوري')}</th><th>${two('Clubs','أندية')}</th><th>r</th><th>${two('Per doubling','لكل مضاعفة')}</th></tr></thead><tbody>${lr.map(x=>`<tr data-lg="${esc(x.l.id)}" data-n="${x.F?x.F.n:0}" data-r="${x.F?f2(x.F.r):''}"><td>${nm(x.l.name)}</td><td>${nb(x.F?x.F.n:x.n)}</td><td>${x.F?nb(rd(x.F.r,x.F.ci)):'–'}</td><td>${x.F?nb(sg(x.F.b*Math.LN2)):'–'}</td></tr>`).join('')}</tbody></table></div>
   ${PF?`<p id="vlpoolr" data-n="${PF.n}" data-r="${f2(PF.r)}" data-lo="${PF.ci?f2(PF.ci[0]):''}" data-hi="${PF.ci?f2(PF.ci[1]):''}">${two(`All ${nb(PF.n)} clubs together, each set against its own league: <b>r = ${nb(rd(PF.r,PF.ci))}</b>, so squad value accounts for about <b>${nb(Math.round(PF.r*PF.r*100))}%</b> of the differences in points a game between clubs of the same league at this point of the season.`,`كل الـ${nb(PF.n)} نادي مع بعض، كل واحد مقارن بدوريه: <b>r = ${nb(rd(PF.r,PF.ci))}</b>، يعني قيمة التشكيلة تفسّر حوالي <b>${nb(Math.round(PF.r*PF.r*100))}%</b> من الفروق في النقاط بالمباراة بين أندية نفس الدوري في هذه المرحلة من الموسم.`)}</p>`:''}</div>`;
  const note=`<p class="mu ins-note">${two(`How to read it: a club above the line took more points than a squad of its value is expected to take so far; below it, fewer. ${played} matches a club is a small sample, so single gaps are mostly luck and form: look at the pattern, not at one club. Hollow dots are clubs with under ${Math.round(MINCOV*100)}% of the squad priced (most of them newly promoted: their players are missing from the source), left out of the line. A correlation is not a price list: richer clubs also have the better players and the deeper squads.`,`كيف تقرأها: النادي فوق الخط أخذ نقاط أكثر من اللي يتوقعه لتشكيلة بقيمته لحد الحين؛ وتحته أقل. ${nb(played)} مباراة للنادي عيّنة صغيرة، فالفروق الفردية أغلبها حظ ومستوى: شوف النمط مو نادي واحد. النقاط المفرغة أندية أقل من ${nb(Math.round(MINCOV*100))}% من تشكيلتها لها سعر (أغلبها صاعد جديد: لاعبيهم ناقصين في المصدر)، وما تدخل في الخط. الارتباط مو قائمة أسعار: الأندية الأغنى عندها الأفضل والتشكيلة الأعمق.`)}</p><p class="mu ins-note">${INS.tmNote(P)}</p>`;
  root.innerHTML=`<h3>${nm(l.name)}</h3>${sum}<div class="card vl-ch">${chart(rows,F)}<p class="mu vl-lg">${two('Solid dot = most of the squad priced; hollow = under 60% priced (not in the line). The line is the fit of points a game on the log of the squad value.','نقطة ممتلئة = أغلب التشكيلة لها سعر؛ مفرغة = أقل من 60% (خارج الخط). الخط هو ملاءمة النقاط بالمباراة على لوغاريتم قيمة التشكيلة.')}</p></div>
   <div class="card"><div class="vl-hd"><h3>${two('Club by club','نادي نادي')}</h3>${ctl}</div>${tbl}</div>${pooled}${note}`;
  root.querySelectorAll('#vlord button').forEach(b=>b.onclick=()=>{S.order=b.dataset.k;draw(root,P,per,lg)});
 }
 INS.valuePoints={clubsOf,fit,usable};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
