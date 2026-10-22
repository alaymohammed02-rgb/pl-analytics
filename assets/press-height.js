/* ===== Pressing & defensive height (#/pressline, in Analysis after PPDA) =====
   Data, all from PitchAPI through files the site already loads (no new request):
   - PPDA: matches.advanced → teams[].defending.ppda (opponent passes ÷ defensive actions), one value per team per match, in
     data/<league>_adv.json (pp, op, da). Lower = the opponent was allowed fewer passes per defensive action = more pressing.
   - Defensive action height: matches.advanced → teams[].defending.avg_defensive_action_x, metres on a 105 × 68 pitch, one value
     per team per match, in data/<league>_pl.json (team rows, adx). Checked on this site's data: it rises as PPDA falls
     (r ≈ −0.6 in every league), i.e. it is measured from the team's own goal line, higher = further up the pitch.
   - Defensive LINE height is not provided by PitchAPI, and cannot be computed from what it provides: it needs the defenders'
     positions without the ball (tracking data). The pass network's average positions are where players passed from (with the
     ball) and the heat maps count every action, so neither measures a defensive line. This page therefore shows the defensive
     action height, under that name, and says so.
   Season: the site holds the current season only. The World Cup is left out (as asked).
   Averages are always over the matches shown (same team, same filters); a match without a value is a gap, never a zero. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('pressline','Pressing & height','analysis','ppda');
 const MIN_LEAGUE=3;          /* a team appears on the league charts with 3+ matches with data in the range */
 const S={team:'',opp:'',from:'',to:'',rev:false,sel:''};let S_LG=null;
 const f1=v=>v==null?'–':(+v).toFixed(1),f2=v=>v==null?'–':(+v).toFixed(2);
 const okLeague=l=>l&&!/world cup/i.test(l.name)&&l.adv_file&&l.pl_file;
 const col=n=>{const c=typeof clubColors==='function'&&clubColors(n);return (c&&(c.hi||c.c1))||'#8fb3ff'};
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;

 /* ---------- the data: one row per team per match, the opponent's values of the same match beside it ---------- */
 async function data(){
  const [A,P]=await Promise.all([loadAdv().catch(()=>null),loadPl().catch(()=>null)]);
  const date=new Map(D.matches.map(m=>[m.match_id,m]));
  const by=new Map();
  ((A&&A.team)||[]).forEach(r=>{const k=r.m+'|'+r.n;const o=by.get(k)||{m:r.m,n:r.n};o.pp=r.pp;o.op=r.op;o.da=r.da;by.set(k,o)});
  ((P&&P.team)||[]).forEach(r=>{const k=r.m+'|'+r.n;const o=by.get(k)||{m:r.m,n:r.n};o.adx=r.adx;by.set(k,o)});
  const rows=[...by.values()].filter(r=>date.has(r.m)).map(r=>{const m=date.get(r.m);return {...r,d:String(m.date||'').slice(0,10),match:m,opp:m.home===r.n?m.away:m.home,home:m.home===r.n}});
  const pair=new Map(rows.map(r=>[r.m+'|'+r.n,r]));
  rows.forEach(r=>{const o=pair.get(r.m+'|'+r.opp);r.o_pp=o?o.pp:null;r.o_op=o?o.op:null;r.o_da=o?o.da:null;r.o_adx=o?o.adx:null});
  rows.sort((a,b)=>a.d.localeCompare(b.d)||a.m.localeCompare(b.m));
  return rows;
 }
 const ok=v=>v!=null&&isFinite(v);
 const mean=a=>{const b=a.filter(ok);return b.length?b.reduce((s,x)=>s+x,0)/b.length:null};
 /* a team's season values over the range: PPDA pooled (Σ opponent passes ÷ Σ defensive actions, as on the PPDA page), height = mean */
 function teamSeason(rows){
  const T=new Map();rows.forEach(r=>{const t=T.get(r.n)||{n:r.n,op:0,da:0,np:0,h:[],m:0};t.m++;if(ok(r.op)&&r.da>0){t.op+=r.op;t.da+=r.da;t.np++}if(ok(r.adx))t.h.push(r.adx);T.set(r.n,t)});
  return [...T.values()].map(t=>({n:t.n,m:t.m,np:t.np,nh:t.h.length,ppda:t.da>0?t.op/t.da:null,h:mean(t.h)}));
 }
 const median=a=>{const s=a.filter(ok).sort((x,y)=>x-y);if(!s.length)return null;const i=s.length/2;return s.length%2?s[Math.floor(i)]:(s[i-1]+s[i])/2};

 R.pressline=async function(el){
  el.innerHTML='<h2>Pressing &amp; height</h2><div id="phroot" class="ins ph"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#phroot'),lg=D.id;
  const meta=(ALL.leagues||[]).find(l=>l.id===D.id),leagues=(ALL.leagues||[]).filter(okLeague);
  if(S_LG!==D.id){S_LG=D.id;Object.assign(S,{team:'',opp:'',from:'',to:'',sel:''})}
  const lgSel=`<select id="phlg" aria-label="Competition">${leagues.map(l=>`<option value="${esc(l.id)}"${l.id===D.id?' selected':''}>${esc(l.name)}</option>`).join('')}${okLeague(meta)?'':`<option value="" selected>${esc(meta?meta.name:'')}</option>`}</select>`;
  const wire=()=>{const s=root.querySelector('#phlg');if(s)s.onchange=async()=>{if(!s.value)return;root.innerHTML='<div class="empty">Loading league…</div>';await setLeague(s.value);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head();route()}};
  if(!okLeague(meta)){root.innerHTML=`<div class="ctl">${lgSel}</div><div class="empty">${/world cup/i.test(meta&&meta.name||'')?'<span>The World Cup is not part of this page.</span>':'<span>No pressing data for this competition yet.</span>'} <span>Choose another competition.</span></div>`;wire();return}
  const rows=await data();if(!root.isConnected||D.id!==lg)return;
  if(!rows.length){root.innerHTML=`<div class="ctl">${lgSel}</div><div class="empty">No pressing data for this competition yet.</div>`;wire();return}
  const dates=[...new Set(rows.map(r=>r.d))].sort(),teams=[...new Set(rows.map(r=>r.n))].sort((a,b)=>a.localeCompare(b));
  if(!S.team||!teams.includes(S.team)){const fv=typeof favOf==='function'?favOf():null;S.team=fv&&teams.includes(fv)?fv:teams[0]}
  if(S.from&&!dates.includes(S.from))S.from='';if(S.to&&!dates.includes(S.to))S.to='';
  const draw=()=>{
   const from=S.from||dates[0],to=S.to||dates[dates.length-1],inR=r=>r.d>=from&&r.d<=to;
   const R_=rows.filter(inR),TS=teamSeason(R_).filter(t=>t.nh>=MIN_LEAGUE&&t.np>=MIN_LEAGUE);
   const mine=R_.filter(r=>r.n===S.team&&(!S.opp||r.opp===S.opp));
   const opps=[...new Set(R_.filter(r=>r.n===S.team).map(r=>r.opp))].sort((a,b)=>a.localeCompare(b));
   if(S.opp&&!opps.includes(S.opp))S.opp='';
   root.innerHTML=`<div class="card ph-def"><b>What is measured</b>
     <p>${two(`<b>Defensive action height</b> — PitchAPI's average distance, in metres from the team's own goal line (pitch 105 m long), of the team's defensive actions in a match. Higher = the team wins the ball back further up the pitch. <b>This is not the defensive line height</b>: PitchAPI does not provide that, and it cannot be computed from its data (it needs the defenders' positions without the ball).`,
      `<b>ارتفاع الأفعال الدفاعية</b> — متوسط بُعد الأفعال الدفاعية للفريق في المباراة عن خط مرماه، بالمتر (الملعب 105 م)، من PitchAPI. أعلى = الفريق يسترجع الكرة أبعد عن مرماه. <b>هذا مو ارتفاع خط الدفاع</b>: PitchAPI ما يعطيه، وما ينحسب من بياناته (يحتاج مواقع المدافعين بدون الكرة).`)}</p>
     <p>${two(`<b>PPDA</b> — opponent passes ÷ defensive actions (PitchAPI). Lower = fewer passes allowed per defensive action = more intense pressing.`,`<b>PPDA</b> — تمريرات الخصم ÷ الأفعال الدفاعية (PitchAPI). أقل = تمريرات أقل مسموحة لكل فعل دفاعي = ضغط أشد.`)}</p></div>
    <div class="card ctl ph-ctl">${lgSel}
     <select id="phse" aria-label="Season" disabled><option>Current season</option></select>
     <select id="phtm" aria-label="Team">${teams.map(t=>`<option${t===S.team?' selected':''}>${esc(t)}</option>`).join('')}</select>
     <select id="phop" aria-label="Opponent"><option value="">All opponents</option>${opps.map(t=>`<option${t===S.opp?' selected':''}>${esc(t)}</option>`).join('')}</select>
     <label class="mu"><span>From</span> <select id="phfr">${dates.map(d=>`<option${d===from?' selected':''}>${d}</option>`).join('')}</select></label>
     <label class="mu"><span>To</span> <select id="phto">${dates.map(d=>`<option${d===to?' selected':''}>${d}</option>`).join('')}</select></label>
     <button type="button" class="s" id="phrs">Reset</button>
     <p class="mu ph-cov">${two(`Current season only (the site holds no earlier season for this). ${R_.length/2|0} matches in the range; teams with ${MIN_LEAGUE}+ matches with data appear on the league charts (${TS.length}).`,`الموسم الحالي فقط (الموقع ما فيه موسم سابق لهذا). ${nb(R_.length/2|0)} مباراة في الفترة؛ الفرق اللي لها ${nb(MIN_LEAGUE)} مباريات أو أكثر ببيانات تظهر في رسوم الدوري (${nb(TS.length)}).`)}</p></div>
    <div class="ph-dash card"><h3><span>Team</span> · ${nm(S.team)}${S.opp?` <span class="mu">· <span>against</span> ${nm(S.opp)}</span>`:''}</h3>${dash(mine)}</div>
    <div class="ph-two"><div class="card"><h3>Defensive action height, every team</h3>${lineMap(TS)}</div>
     <div class="card"><h3>Tactical identity map</h3>${idMap(TS)}</div></div>`;
   wire();
   const q=s=>root.querySelector(s);
   q('#phtm').onchange=e=>{S.team=e.target.value;S.opp='';S.sel='';draw()};
   q('#phop').onchange=e=>{S.opp=e.target.value;S.sel='';draw()};
   q('#phfr').onchange=e=>{S.from=e.target.value;if((S.to||dates[dates.length-1])<S.from)S.to=S.from;S.sel='';draw()};
   q('#phto').onchange=e=>{S.to=e.target.value;if((S.from||dates[0])>S.to)S.from=S.to;S.sel='';draw()};
   q('#phrs').onclick=()=>{Object.assign(S,{opp:'',from:'',to:'',sel:'',rev:false});draw()};
   const rv=q('#phrev');if(rv)rv.onclick=()=>{S.rev=!S.rev;draw()};
   /* a match picked in one chart is picked in the other */
   root.querySelectorAll('[data-pm]').forEach(p=>p.addEventListener('click',()=>{S.sel=S.sel===p.dataset.pm?'':p.dataset.pm;draw()}));
  };
  draw();
 };

 /* ---------- the team: two charts on the same matches, then what the numbers say ---------- */
 function dash(L){
  const H=L.filter(r=>ok(r.adx)),P=L.filter(r=>ok(r.pp));
  if(!H.length&&!P.length)return '<div class="empty">No match with these values for this team in the range.</div>';
  const sel=L.find(r=>r.m===S.sel);
  const c1=chart(L,'adx','o_adx','Defensive action height (m)','m',1),c2=chart(L,'pp','o_pp','PPDA','',0);
  return `<div class="ins-leg ph-leg"><span><i class="ph-k t"></i>${nm(S.team)}</span><span><i class="ph-k o"></i><span>Opponent, same match</span></span><span><i class="ph-k a"></i>${two(`${nm(S.team)} average, these matches`,`متوسط ${nm(S.team)} في هالمباريات`)}</span></div>
   <div class="ph-ch"><h4>Defensive action height <span class="mu">· <span>metres from own goal, higher = further up</span></span></h4>${c1}</div>
   <div class="ph-ch"><h4>PPDA <span class="mu">· <span>lower = more intense pressing</span></span></h4>${c2}</div>
   ${sel?`<p class="ph-sel">${two(`<b>${esc(sel.d)}</b> ${nm(sel.match.home)} ${nb(esc(sel.match.score))} ${nm(sel.match.away)} — height ${nm(S.team)} ${nb(f1(sel.adx))} m, ${nm(sel.opp)} ${nb(f1(sel.o_adx))} m; PPDA ${nb(f2(sel.pp))} / ${nb(f2(sel.o_pp))}.`,`<b>${nb(esc(sel.d))}</b> ${nm(sel.match.home)} ${nb(esc(sel.match.score))} ${nm(sel.match.away)} — الارتفاع: ${nm(S.team)} ${nb(f1(sel.adx)+' م')}، ${nm(sel.opp)} ${nb(f1(sel.o_adx)+' م')}؛ PPDA ‏${nb(f2(sel.pp))} / ${nb(f2(sel.o_pp))}.`)} <a href="#/match/${encodeURIComponent(sel.m)}">Match centre →</a></p>`:`<p class="mu ph-tip"><span>Tap a match in either chart to pick it in both.</span></p>`}
   <div class="ph-read">${reading(L)}</div>`;
 }
 function chart(L,k,ko,aria,unit,dec){
  const W=760,Hh=230,Lm=40,Rm=14,T=14,B=44,pts=L.map((r,i)=>({r,i,v:r[k],o:r[ko]}));
  const vals=pts.flatMap(p=>[p.v,p.o]).filter(ok);if(!vals.length)return '<div class="empty">No values.</div>';
  const av=mean(pts.map(p=>p.v));let lo=Math.min(...vals,av??Infinity),hi=Math.max(...vals,av??-Infinity);const pad=(hi-lo)*.12||1;lo=Math.max(0,lo-pad);hi=hi+pad;
  const n=pts.length,X=i=>Lm+(n<2?(W-Lm-Rm)/2:i/(n-1)*(W-Lm-Rm)),Y=v=>T+(1-(v-lo)/(hi-lo))*(Hh-T-B);
  const step=(hi-lo)/4,ty=[0,1,2,3,4].map(i=>lo+i*step);
  const path=key=>{let d='',pen=false;pts.forEach(p=>{const v=p[key];if(!ok(v)){pen=false;return}d+=(pen?'L':'M')+X(p.i).toFixed(1)+','+Y(v).toFixed(1);pen=true});return d};
  const fmt=v=>dec?f1(v):f2(v);
  const lab=pts.length<=12?pts:pts.filter((p,i)=>i%Math.ceil(pts.length/10)===0||i===pts.length-1);
  const dots=(key,cls)=>pts.filter(p=>ok(p[key])).map(p=>`<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p[key]).toFixed(1)}" r="${p.r.m===S.sel?6.5:4.5}" class="ph-d ${cls}${p.r.m===S.sel?' on':''}" data-pm="${esc(p.r.m)}"${INS.tipAttr([p.r.d+' · '+p.r.match.home+' '+p.r.match.score+' '+p.r.match.away,S.team+': '+fmt(p.v)+(unit?' '+unit:''),p.r.opp+': '+fmt(p.o)+(unit?' '+unit:''),'Average '+S.team+': '+fmt(av)])}></circle>`).join('');
  const selX=pts.find(p=>p.r.m===S.sel);
  return `<div class="ph-svg"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(aria)}">
   ${ty.map(v=>`<line x1="${Lm}" x2="${W-Rm}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="ins-grid"/><text x="${Lm-6}" y="${(Y(v)+3).toFixed(1)}" class="ins-ax e">${fmt(v)}</text>`).join('')}
   ${selX?`<line x1="${X(selX.i).toFixed(1)}" x2="${X(selX.i).toFixed(1)}" y1="${T}" y2="${Hh-B}" class="ph-selx"/>`:''}
   ${ok(av)?`<line x1="${Lm}" x2="${W-Rm}" y1="${Y(av).toFixed(1)}" y2="${Y(av).toFixed(1)}" class="ph-av"/><text x="${W-Rm}" y="${(Y(av)-5).toFixed(1)}" class="ins-ax e ph-avt">${fmt(av)}</text>`:''}
   <path d="${path('o')}" class="ph-l o"/><path d="${path('v')}" class="ph-l t"/>${dots('o','o')}${dots('v','t')}
   ${lab.map(p=>`<text x="${X(p.i).toFixed(1)}" y="${Hh-B+16}" class="ins-ax">${esc(p.r.d.slice(5))}</text><text x="${X(p.i).toFixed(1)}" y="${Hh-B+30}" class="ins-ax ph-op">${esc(short(p.r.opp))}</text>`).join('')}
   </svg></div>`;
 }
 const short=n=>{const w=String(n||'').replace(/\b(FC|CF|AFC|SC|AC|SSC|AS|RC|CD|UD|SD|RCD|SV|VfB|VfL|TSG|1\.)\b/g,'').trim().split(/\s+/);return (w.sort((a,b)=>b.length-a.length)[0]||n).slice(0,10)};
 /* what the numbers say: trend (how it changes) apart from quality (whether it worked, which is not judged here) */
 function reading(L){
  const H=L.filter(r=>ok(r.adx)),P=L.filter(r=>ok(r.pp));
  const out=[];
  if(H.length<4&&P.length<4)return `<p class="mu">${two('Fewer than 4 matches with data: no trend is read from so few.','أقل من 4 مباريات ببيانات: ما نقرأ اتجاه من عدد بهالقلة.')}</p>`;
  const t=nm(S.team);
  if(H.length>=4){const n=Math.min(3,Math.floor(H.length/2)),a=mean(H.slice(-n).map(r=>r.adx)),b=mean(H.slice(0,-n).map(r=>r.adx)),d=a-b;
   out.push(Math.abs(d)>=2?two(`${t} defended ${d>0?'higher':'deeper'} in its last ${n} matches: defensive actions ${nb(f1(a))} m from its goal on average, against ${nb(f1(b))} m in the ${H.length-n} before (${nb((d>0?'+':'')+f1(d))} m).`,
     `${t} دافع ${d>0?'أعلى':'أعمق'} في آخر ${nb(n)} مباريات: أفعاله الدفاعية على بُعد ${nb(f1(a))} م من مرماه بالمتوسط، مقابل ${nb(f1(b))} م في الـ${nb(H.length-n)} قبلها (${nb((d>0?'+':'')+f1(d))} م).`)
    :two(`${t}'s defensive action height has stayed about the same: ${nb(f1(a))} m in its last ${n} matches, ${nb(f1(b))} m before.`,`ارتفاع الأفعال الدفاعية لـ${t} تقريبًا ثابت: ${nb(f1(a))} م في آخر ${nb(n)} مباريات، و${nb(f1(b))} م قبلها.`))}
  if(P.length>=4){const n=Math.min(3,Math.floor(P.length/2));
   const a=mean(P.slice(-n).map(r=>r.pp)),b=mean(P.slice(0,-n).map(r=>r.pp)),rel=b?(a-b)/b:0;
   out.push(Math.abs(rel)>=.15?two(`It pressed ${rel<0?'more':'less'} intensely in its last ${n} matches: PPDA ${nb(f2(a))} against ${nb(f2(b))} before (${nb((rel>0?'+':'')+Math.round(rel*100)+'%')}).`,
     `ضغط بشدة ${rel<0?'أكبر':'أقل'} في آخر ${nb(n)} مباريات: PPDA ‏${nb(f2(a))} مقابل ${nb(f2(b))} قبلها (${nb((rel>0?'+':'')+Math.round(rel*100)+'%')}).`)
    :two(`Its pressing intensity has stayed about the same: PPDA ${nb(f2(a))} in its last ${n} matches, ${nb(f2(b))} before.`,`شدة ضغطه تقريبًا ثابتة: PPDA ‏${nb(f2(a))} في آخر ${nb(n)} مباريات، و${nb(f2(b))} قبلها.`))}
  /* against its opponents in the same matches */
  const HO=H.filter(r=>ok(r.o_adx)),PO=P.filter(r=>ok(r.o_pp));
  if(HO.length>=4){const d=mean(HO.map(r=>r.adx-r.o_adx)),k=HO.filter(r=>r.adx>r.o_adx).length;
   out.push(two(`Against its opponents in the same matches: ${d>=0?'higher':'deeper'} by ${nb(f1(Math.abs(d)))} m on average; higher than the opponent in ${nb(k)} of ${nb(HO.length)} matches.`,`مقارنة بخصومه في نفس المباريات: ${d>=0?'أعلى':'أعمق'} بـ${nb(f1(Math.abs(d)))} م بالمتوسط؛ أعلى من الخصم في ${nb(k)} من ${nb(HO.length)} مباراة.`))}
  if(PO.length>=4){const k=PO.filter(r=>r.pp<r.o_pp).length;
   out.push(two(`Its PPDA was lower than the opponent's (it pressed more) in ${nb(k)} of ${nb(PO.length)} matches.`,`الـPPDA حقه كان أقل من الخصم (ضغط أكثر) في ${nb(k)} من ${nb(PO.length)} مباراة.`))}
  out.push(`<span class="mu">${two('These describe how the team defends, not whether it worked: a higher line or a lower PPDA is not by itself better.','هذي تصف طريقة دفاع الفريق، مو إذا نجحت: الدفاع الأعلى أو الـPPDA الأقل مو أفضل بحد ذاته.')}</span>`);
  return out.map(s=>`<p>${s}</p>`).join('');
 }

 /* ---------- every team: heights on a pitch, like a defensive-line chart ---------- */
 function lineMap(TS){
  const L=TS.filter(t=>ok(t.h));if(!L.length)return '<div class="empty">No team with enough matches in the range.</div>';
  const ord=L.slice().sort((a,b)=>S.rev?a.h-b.h:b.h-a.h);
  const pw=150,ph=232,px=14,py=18,X0=px,X1=px+pw,yv=v=>py+(1-v/105)*ph;   /* own goal at the bottom (0 m), the opponent's at the top (105 m) */
  const rowH=15,H=Math.max(py+ph+18,py+ord.length*rowH+10),W=360,LX=X1+44;
  const ly=i=>py+6+i*((H-py-16)/Math.max(1,ord.length-1||1));
  const pitch=`<g class="ph-pitch"><rect x="${X0}" y="${py}" width="${pw}" height="${ph}"/><line x1="${X0}" x2="${X1}" y1="${yv(52.5)}" y2="${yv(52.5)}"/><circle cx="${X0+pw/2}" cy="${yv(52.5)}" r="${9.15/68*pw}"/>
   <rect x="${X0+pw*(13.84/68)}" y="${yv(105)}" width="${pw*(40.32/68)}" height="${yv(105-16.5)-yv(105)}"/><rect x="${X0+pw*(13.84/68)}" y="${yv(16.5)}" width="${pw*(40.32/68)}" height="${yv(0)-yv(16.5)}"/>
   <text x="${X0+pw/2}" y="${yv(0)+13}" class="ins-ax">own goal · 0 m</text><text x="${X0+pw/2}" y="${yv(105)-5}" class="ins-ax">105 m</text></g>`;
  const lines=ord.map((t,i)=>{const y=yv(t.h),c=col(t.n),yy=ly(i),logo=typeof logoOf==='function'&&logoOf(t.n);
   return `<g class="ph-ln"${INS.tipAttr([t.n,'Defensive action height: '+f1(t.h)+' m','PPDA: '+f2(t.ppda),t.nh+' matches'])}><line x1="${X0}" x2="${X1}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}"/><polyline points="${X1},${y.toFixed(1)} ${X1+14},${y.toFixed(1)} ${LX-6},${yy.toFixed(1)}" stroke="${c}" fill="none"/><circle cx="${LX-6}" cy="${yy.toFixed(1)}" r="2.6" fill="${c}"/>
    ${logo?`<image href="${esc(logo)}" x="${LX}" y="${(yy-6).toFixed(1)}" width="12" height="12"/>`:''}<text x="${LX+16}" y="${(yy+4).toFixed(1)}" class="ph-lt"><tspan fill="${c}" font-weight="700">${f1(t.h)}</tspan> ${esc(t.n.length>19?t.n.slice(0,18)+'…':t.n)}</text></g>`}).join('');
  return `<div class="ph-svg ph-map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Defensive action height, every team">${pitch}${lines}</svg></div>
   <div class="ctl"><button type="button" class="s" id="phrev">${S.rev?'Highest first':'Lowest first'}</button></div>
   <p class="mu ins-note"><span>Each line is a team's average defensive action height over its matches in the range, drawn at that distance from its own goal (bottom). Not a defensive line: see above.</span></p>`;
 }
 /* PPDA × height, with the league's medians as the quadrant boundaries */
 function idMap(TS){
  const L=TS.filter(t=>ok(t.h)&&ok(t.ppda));if(L.length<4)return '<div class="empty">Too few teams with both values in the range.</div>';
  const W=420,H=340,Lm=40,Rm=14,T=26,B=40,mx=median(L.map(t=>t.ppda)),my=median(L.map(t=>t.h));
  const x0=Math.min(...L.map(t=>t.ppda)),x1=Math.max(...L.map(t=>t.ppda)),y0=Math.min(...L.map(t=>t.h)),y1=Math.max(...L.map(t=>t.h)),px=(x1-x0)*.08||1,py=(y1-y0)*.1||1;
  /* PPDA runs right to left: lower PPDA (more pressing) to the right */
  const X=v=>Lm+(1-(v-(x0-px))/((x1+px)-(x0-px)))*(W-Lm-Rm),Y=v=>T+(1-(v-(y0-py))/((y1+py)-(y0-py)))*(H-T-B);
  const q=(x,y,a,t)=>`<text x="${x}" y="${y}" class="ph-q" text-anchor="${a}">${t}</text>`;
  const pts=L.map(t=>{const logo=typeof logoOf==='function'&&logoOf(t.n),x=X(t.ppda),y=Y(t.h),me=t.n===S.team;
   return `<g class="ph-pt${me?' me':''}"${INS.tipAttr([t.n,'PPDA: '+f2(t.ppda),'Defensive action height: '+f1(t.h)+' m',t.np+' matches'])}>${me?`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" class="ph-me"/>`:''}${logo?`<image href="${esc(logo)}" x="${(x-9).toFixed(1)}" y="${(y-9).toFixed(1)}" width="18" height="18"/>`:`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${col(t.n)}"/>`}</g>`}).join('');
  return `<div class="ph-svg"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tactical identity map">
   <line x1="${X(mx).toFixed(1)}" x2="${X(mx).toFixed(1)}" y1="${T}" y2="${H-B}" class="ins-med"/><line x1="${Lm}" x2="${W-Rm}" y1="${Y(my).toFixed(1)}" y2="${Y(my).toFixed(1)}" class="ins-med"/>
   ${q(W-Rm-4,T+12,'end','High + intense press')}${q(Lm+4,T+12,'start','High, less press')}${q(W-Rm-4,H-B-6,'end','Deep + intense press')}${q(Lm+4,H-B-6,'start','Deep, less press')}
   <line x1="${Lm}" x2="${W-Rm}" y1="${H-B}" y2="${H-B}" class="ins-axl"/><line x1="${Lm}" x2="${Lm}" y1="${T}" y2="${H-B}" class="ins-axl"/>
   <text x="${Lm}" y="${H-B+16}" class="ins-ax" text-anchor="start">${f2(x1+px)}</text><text x="${W-Rm}" y="${H-B+16}" class="ins-ax e">${f2(x0-px)}</text>
   <text x="${(Lm+W-Rm)/2}" y="${H-8}" class="ins-axt" text-anchor="middle">PPDA → lower = more pressing</text><text x="${Lm+2}" y="${T-10}" class="ins-axt">↑ higher defensive actions (m)</text>${pts}</svg></div>
   <p class="mu ins-note">${two(`Lines: the league's medians (PPDA ${nb(f2(mx))}, height ${nb(f1(my))} m). PPDA is drawn right to left, so more pressing is to the right. Indicative profiles, not a verdict on a team's style.`,`الخطوط: وسيط الدوري (PPDA ‏${nb(f2(mx))}، الارتفاع ${nb(f1(my))} م). الـPPDA مرسوم من اليمين لليسار، فالضغط الأكثر على اليمين. ملامح تقريبية، مو حكم على أسلوب الفريق.`)}</p>`;
 }
 INS.ar({"Pressing & height":"الضغط والارتفاع","Pressing &amp; height":"الضغط والارتفاع","What is measured":"وش نقيس","Competition":"البطولة","Season":"الموسم","Current season":"الموسم الحالي","Team":"الفريق","Opponent":"الخصم",
  "All opponents":"كل الخصوم","From":"من","To":"إلى","Reset":"إعادة ضبط","Opponent, same match":"الخصم، نفس المباراة","against":"ضد",
  "Defensive action height":"ارتفاع الأفعال الدفاعية","metres from own goal, higher = further up":"بالمتر من مرماه، أعلى = أبعد للأمام","lower = more intense pressing":"أقل = ضغط أشد",
  "Tap a match in either chart to pick it in both.":"اضغط مباراة في أي رسم وتنحدد في الاثنين.","Defensive action height, every team":"ارتفاع الأفعال الدفاعية لكل الفرق","Tactical identity map":"خريطة الهوية التكتيكية",
  "Highest first":"الأعلى أول","Lowest first":"الأقل أول","No pressing data for this competition yet.":"ما فيه بيانات ضغط لهذي البطولة للحين.","The World Cup is not part of this page.":"كأس العالم مو ضمن هذي الصفحة.",
  "Choose another competition.":"اختر بطولة ثانية.","No match with these values for this team in the range.":"ما فيه مباراة بهالقيم لهالفريق في الفترة.","No team with enough matches in the range.":"ما فيه فريق عنده مباريات كفاية في الفترة.",
  "Too few teams with both values in the range.":"فرق قليلة عندها القيمتين في الفترة.","Match centre →":"مركز المباراة ←","No values.":"ما فيه قيم.","Loading league…":"نحمّل الدوري…",
  "Each line is a team's average defensive action height over its matches in the range, drawn at that distance from its own goal (bottom). Not a defensive line: see above.":"كل خط هو متوسط ارتفاع الأفعال الدفاعية للفريق في مبارياته ضمن الفترة، مرسوم على هالبعد من مرماه (تحت). مو خط دفاع: شوف فوق.",
  "own goal · # m":"المرمى · # م","# m":"# م","High + intense press":"عالي + ضغط شديد","High, less press":"عالي، ضغط أقل","Deep + intense press":"عميق + ضغط شديد","Deep, less press":"عميق، ضغط أقل",
  "PPDA → lower = more pressing":"PPDA ← أقل = ضغط أكثر","↑ higher defensive actions (m)":"↑ أفعال دفاعية أعلى (م)"});
 /* this file can arrive after the site has drawn its first page: if that page is this one, draw it again */
 if(typeof D==='object'&&D&&typeof route==='function'&&typeof uiPage==='function'&&uiPage()==='pressline')route();
})();
