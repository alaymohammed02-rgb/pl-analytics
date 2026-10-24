/* ===== Insights core: shared numbers and charts for Hidden Gems, Player DNA, Team DNA and Reality Check =====
   Numbers: only files the site already loads, all from PitchAPI (the per-match player file loadPl, its team table P.team,
   the advanced file loadAdv for PPDA, the shot file loadSh, the league file D). Nothing is fetched twice: the loaders cache.
   Percentiles are mid-rank: (players below + half of the equal ones) / players with a value × 100, so 50 = the middle of the
   reference group; a missing value is never counted as zero (per-90 uses only the minutes of matches that have the value).
   Charts: plain SVG strings (no library). Any element with data-tip shows a tooltip on hover, focus or tap. */
(function(){
 const INS=window.INS={};
 const n2=v=>v==null||!isFinite(v)?'N/A':(+v).toFixed(2),n1=v=>v==null||!isFinite(v)?'N/A':(+v).toFixed(1);
 INS.f=(v,d)=>v==null||!isFinite(v)?'N/A':(+v).toFixed(d==null?2:d);
 INS.n2=n2;INS.n1=n1;
 INS.met=k=>(typeof MET!=='undefined'?MET:[]).find(m=>m[0]===k)||null;
 /* mid-rank percentile of v in the values of pool for metric fn; null when v or the pool is missing */
 INS.pct=function(pool,fn,v){if(v==null||!isFinite(v))return null;let lo=0,eq=0,t=0;for(const q of pool){const x=fn(q);if(x==null||!isFinite(x))continue;t++;if(x<v)lo++;else if(x===v)eq++}return t?(lo+eq/2)/t*100:null};
 INS.mean=a=>{const b=a.filter(x=>x!=null&&isFinite(x));return b.length?b.reduce((s,x)=>s+x,0)/b.length:null};
 /* players of the season: aggPl rows with goalkeepers marked (xG faced in the league file) */
 INS.players=async function(){
  const P=await loadPl().catch(()=>null);if(!P||!P.rows||!P.rows.length)return null;
  const gk=new Set((D.stats||[]).filter(s=>s.xg_faced!=null&&s.player_id).map(s=>s.player_id));
  /* the player page is keyed by the league file's (key, club); its club can differ from the per-match club (often "Unknown"),
     so fall back to any row of the player, preferring a known club */
  const key=new Map(),byId=new Map();(D.stats||[]).forEach(s=>{if(!s.player_id)return;key.set(s.player_id+'|'+s.club,s.key);const o=byId.get(s.player_id);if(!o||(o.club==='Unknown'&&s.club!=='Unknown'))byId.set(s.player_id,s)});
  const A=aggPl(P).map(a=>{a.gk=a.p==='GK'||gk.has(a.id);const k=key.get(a.id+'|'+a.club),f=byId.get(a.id);a.href='#/player/'+encodeURIComponent(k!=null?k+'||'+a.club:f?f.key+'||'+f.club:a.id+'||'+a.club);return a});
  return {P,A};
 };
 /* the reference group of a player: same position (as learnt by the sync) with min minutes; all outfield players when unknown */
 INS.peers=(A,a,min)=>{const pos=a.p&&a.p!=='GK'?a.p:null;return {pos,list:A.filter(x=>!x.gk&&x.s.mi>=min&&(pos?x.p===pos:true))}};
 /* which side a shot belongs to: by club name, or (some rows carry the team id instead) by that id, learnt from the rows of the
    match that have the name or from the shooter's club in the league file; null when it cannot be told */
 INS.sideFn=function(rows,m){const nm=c=>c===m.home?'h':c===m.away?'a':null,tid=new Map(),club=new Map();(D.stats||[]).forEach(s=>{if(s.match_id===m.match_id&&s.player_id)club.set(s.player_id,s.club)});
  rows.forEach(r=>{let s=nm(r.c);if(!s&&!r.og)s=nm(club.get(r.pid));if(s&&r.tid&&!r.og)tid.set(r.tid,s)});return r=>nm(r.c)||tid.get(r.c)||tid.get(r.tid)||null};
 /* ---------- teams: per-match numbers for every club ---------- */
 INS.teams=async function(){
  const [P,S,A]=await Promise.all([loadPl().catch(()=>null),loadSh().catch(()=>null),loadAdv().catch(()=>null)]);
  const fin=D.matches.filter(m=>wkSc(m.score)&&m.date).sort((a,b)=>String(a.date).localeCompare(String(b.date))),T=new Map();
  const get=t=>{let o=T.get(t);if(!o){o={t,games:[]};T.set(t,o)}return o};
  const shBy=new Map();if(S)S.rows.forEach(r=>{if(r.pd==='PenaltyShootout')return;(shBy.get(r.m)||shBy.set(r.m,[]).get(r.m)).push(r)});
  const plBy=new Map();if(P){const ix=P.ix;P.rows.forEach(r=>{const k=r[ix.m]+'|'+r[ix.c];let o=plBy.get(k);if(!o){o={};plBy.set(k,o)}
   ['ps','pr','bx','kp','sca','tko','tkw','pc','cb','tk','ic','bl','cl','duw','aerw','xt','act','aco'].forEach(c=>{const v=r[ix[c]];if(v!=null)o[c]=(o[c]||0)+v})})}
  const tm=new Map();if(P&&P.team)P.team.forEach(r=>tm.set(r.m+'|'+r.n,r));
  const av=new Map();if(A&&A.team)A.team.forEach(r=>av.set(r.m+'|'+r.n,r));
  fin.forEach(m=>{const g=wkSc(m.score),rows=shBy.get(m.match_id);
   [[m.home,m.away,g[0],g[1]],[m.away,m.home,g[1],g[0]]].forEach(([t,o,gf,ga])=>{
    const x={m,opp:o,home:t===m.home,gf,ga};
    if(rows){const sd=INS.sideFn(rows,m),me=t===m.home?'h':'a';let xg=0,xga=0,np=0,npa=0,sh=0,sha=0;rows.forEach(r=>{if(r.og)return;const s=sd(r);if(!s)return;const pen=/pen/i.test(r.st||'');if(s===me){xg+=r.xg||0;sh++;if(!pen)np+=r.xg||0}else{xga+=r.xg||0;sha++;if(!pen)npa+=r.xg||0}});
     if(sh||sha)Object.assign(x,{xg,xga,npxg:np,npxga:npa,sh,sha})}
    const p=plBy.get(m.match_id+'|'+t);if(p)x.pl=p;
    const q=tm.get(m.match_id+'|'+t);if(q)x.tm=q;
    const a=av.get(m.match_id+'|'+t);if(a)x.av=a;
    get(t).games.push(x)})});
  return [...T.values()];
 };
 /* the value a match of a team metric, or null (the definitions are shown with the charts) */
 INS.TM=[
  ['gf','Goals','att',g=>g.gf],['xg','xG','att',g=>g.xg],['npxg','npxG','att',g=>g.npxg],['sh','Shots','att',g=>g.sh],['xt','xT','att',g=>g.pl&&g.pl.xt],
  ['kp','Key passes','cre',g=>g.pl&&g.pl.kp],['sca','Shot-creating actions','cre',g=>g.pl&&g.pl.sca],['bx','Passes into box','cre',g=>g.pl&&g.pl.bx],
  ['pr','Progressive passes','pro',g=>g.pl&&g.pl.pr],['pc','Progressive carries','pro',g=>g.pl&&g.pl.pc],['tkw','Take-ons won','pro',g=>g.pl&&g.pl.tkw],['ps','Passes','pro',g=>g.pl&&g.pl.ps],
  ['ga','Goals against','def',g=>g.ga,1],['xga','xG against','def',g=>g.xga,1],['sha','Shots against','def',g=>g.sha,1],
  ['tk','Tackles','def',g=>g.pl&&g.pl.tk],['ic','Interceptions','def',g=>g.pl&&g.pl.ic],['duw','Duels won','def',g=>g.pl&&g.pl.duw],['aerw','Aerials won','def',g=>g.pl&&g.pl.aerw],
  ['hto','High turnovers','prs',g=>g.tm&&g.tm.hto],['cpr','Counterpress regains (5 s)','prs',g=>g.tm&&g.tm.cpr],['adx','Average defensive action height (m)','prs',g=>g.tm&&g.tm.adx],
  ['tilt','Field tilt (%)','prs',g=>g.tm&&g.tm.tilt]];
 INS.tmLow=new Set(['ga','xga','sha']);   /* lower is better */
 /* season value a match of a team for metric k (mean over matches that have it), and PPDA as a pooled ratio */
 INS.tval=(t,k)=>{if(k==='ppda'){let op=0,da=0;t.games.forEach(g=>{if(g.av&&g.av.op!=null&&g.av.da>0){op+=g.av.op;da+=g.av.da}});return da>0?op/da:null}
  const M=INS.TM.find(x=>x[0]===k);if(!M)return null;return INS.mean(t.games.map(M[3]))};
 /* ---------- tooltip ---------- */
 let tipEl=null;
 const tip=()=>{if(!tipEl){tipEl=document.createElement('div');tipEl.id='instip';tipEl.setAttribute('role','tooltip');document.body.appendChild(tipEl)}return tipEl};
 const show=(e,x,y)=>{const t=tip();t.innerHTML=e.getAttribute('data-tip').split('|').map((s,i)=>i?`<div>${esc(s)}</div>`:`<b>${esc(s)}</b>`).join('');t.classList.add('on');
  const r=t.getBoundingClientRect(),W=innerWidth;t.style.left=Math.max(8,Math.min(W-r.width-8,x-r.width/2))+'px';t.style.top=Math.max(8,y-r.height-14)+'px'};
 const hide=()=>{if(tipEl)tipEl.classList.remove('on')};
 document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el&&el.closest('.ins'))show(el,e.clientX,e.clientY);else hide()});
 document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el&&el.closest('.ins')){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top)}});
 document.addEventListener('focusout',hide);
 document.addEventListener('touchstart',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el&&el.closest('.ins')){const t0=e.touches[0];show(el,t0.clientX,t0.clientY)}else hide()},{passive:true});
 addEventListener('scroll',hide,{passive:true});
 const T_=(parts)=>esc(parts.filter(x=>x!=null&&x!=='').join('|'));
 INS.tipAttr=parts=>` data-tip="${T_(parts)}" tabindex="0"`;
 /* ---------- charts ---------- */
 const ticks=(lo,hi,n)=>{const span=hi-lo||1,step0=span/n,mag=Math.pow(10,Math.floor(Math.log10(step0))),st=[1,2,2.5,5,10].map(s=>s*mag).find(s=>s>=step0)||step0,a=Math.ceil(lo/st)*st,o=[];for(let v=a;v<=hi+1e-9;v+=st)o.push(+v.toFixed(6));return o};
 /* scatter: pts [{x,y,tip:[..],cls,label,href}]; median lines of the field; labels for points with label */
 INS.scatter=function(o){
  const W=o.w||640,H=o.h||380,L=46,R=14,T=14,B=40,P=o.pts.filter(p=>p.x!=null&&p.y!=null&&isFinite(p.x)&&isFinite(p.y));if(!P.length)return '<div class="empty">No data to plot.</div>';
  const xs=P.map(p=>p.x),ys=P.map(p=>p.y),x0=Math.min(0,...xs),x1=Math.max(...xs)*1.06||1,y0=Math.min(0,...ys),y1=Math.max(...ys)*1.08||1;
  const X=v=>L+(v-x0)/(x1-x0||1)*(W-L-R),Y=v=>H-B-(v-y0)/(y1-y0||1)*(H-T-B),md=a=>{const s=[...a].sort((p,q)=>p-q);return s[Math.floor(s.length/2)]};
  const mx=md(xs),my=md(ys);
  let g=ticks(x0,x1,5).map(v=>`<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H-B}" class="ins-grid"/><text x="${X(v)}" y="${H-B+14}" class="ins-ax">${+v.toFixed(2)}</text>`).join('')+
   ticks(y0,y1,5).map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="ins-grid"/><text x="${L-6}" y="${Y(v)+3}" class="ins-ax e">${+v.toFixed(2)}</text>`).join('');
  if(o.diag){const a=Math.max(x0,y0),b=Math.min(x1,y1);g+=`<line x1="${X(a)}" y1="${Y(a)}" x2="${X(b)}" y2="${Y(b)}" class="ins-diag"/>`}
  else g+=`<line x1="${X(mx)}" x2="${X(mx)}" y1="${T}" y2="${H-B}" class="ins-med"/><line x1="${L}" x2="${W-R}" y1="${Y(my)}" y2="${Y(my)}" class="ins-med"/>`;
  const dots=[...P].sort((a,b)=>(a.cls?1:0)-(b.cls?1:0)).map(p=>{const c=`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.cls?6:4}" class="ins-pt ${p.cls||''}"${INS.tipAttr(p.tip||[p.label])}${p.cls?'':' tabindex="-1"'}></circle>`;return p.href?`<a href="${p.href}">${c}</a>`:c}).join('');
  const labs=P.filter(p=>p.label&&p.cls).map(p=>`<text x="${(X(p.x)+8).toFixed(1)}" y="${(Y(p.y)-7).toFixed(1)}" class="ins-lab">${esc(p.label)}</text>`).join('');
  return `<div class="ins-ch"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria||'Scatter plot')}">${g}<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" class="ins-axl"/><line x1="${L}" x2="${L}" y1="${T}" y2="${H-B}" class="ins-axl"/>${dots}${labs}
   <text x="${W-R}" y="${H-6}" class="ins-axt e">${esc(o.xl)}</text><text x="${L+4}" y="${T+10}" class="ins-axt">${esc(o.yl)}</text></svg></div>`;
 };
 /* horizontal bars: rows [{label,v,tip,cls,href,sub}], zero line for signed values */
 INS.hbars=function(o){
  const R_=o.rows.filter(r=>r.v!=null&&isFinite(r.v));if(!R_.length)return '<div class="empty">No data.</div>';
  const mx=Math.max(1e-9,...R_.map(r=>Math.abs(r.v))),neg=R_.some(r=>r.v<0),fmt=o.fmt||n2;
  return `<ol class="ins-bars${neg?' sg':''}">${R_.map(r=>{const w=Math.abs(r.v)/mx*(neg?50:100);const lab=r.href?`<a href="${r.href}">${esc(r.label)}</a>`:`<span>${esc(r.label)}</span>`;
   return `<li class="${r.cls||''}"${INS.tipAttr(r.tip||[r.label,fmt(r.v)])}><span class="ins-bl">${lab}${r.sub?`<span class="mu">${esc(r.sub)}</span>`:''}</span><span class="ins-bt"><i class="${r.v<0?'n':'p'}" style="width:${w.toFixed(1)}%"></i></span><b>${fmt(r.v)}</b></li>`}).join('')}</ol>`;
 };
 /* radar: axes [label], series [{name,vals:[0..100|null],raw:[text],cls}] */
 INS.radar=function(o){
  const n=o.axes.length,cx=150,cy=135,Rr=96,P=(i,r)=>{const g=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(g)*r,cy+Math.sin(g)*r]},fp=p=>p.map(x=>x.toFixed(1)).join(',');
  const grid=[25,50,75,100].map(r=>`<polygon class="ins-rg" points="${o.axes.map((a,i)=>fp(P(i,Rr*r/100))).join(' ')}"/>`).join('')+o.axes.map((a,i)=>`<line class="ins-rg" x1="${cx}" y1="${cy}" x2="${P(i,Rr)[0].toFixed(1)}" y2="${P(i,Rr)[1].toFixed(1)}"/>`).join('');
  const ser=o.series.map(s=>`<polygon class="ins-ra ${s.cls||''}" points="${s.vals.map((v,i)=>fp(P(i,Rr*(v||0)/100))).join(' ')}"/>`+s.vals.map((v,i)=>{const [x,y]=P(i,Rr*(v||0)/100);return `<circle class="ins-rp ${s.cls||''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"${INS.tipAttr([s.name,o.axes[i],(s.raw&&s.raw[i]?s.raw[i]+' · ':'')+(v==null?'N/A':Math.round(v)+' percentile')])}></circle>`}).join('')).join('');
  const labs=o.axes.map((a,i)=>{const [x,y]=P(i,Rr+16),an=Math.abs(x-cx)<10?'middle':x<cx?'end':'start';return `<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="${an}" class="ins-rl">${esc(a)}</text>`}).join('');
  return `<div class="ins-rad"><div class="ins-leg">${o.series.map(s=>`<span><i class="${s.cls||''}"></i>${esc(s.name)}</span>`).join('')}</div><svg viewBox="-60 0 420 280" role="img" aria-label="${esc(o.aria||'Radar')}">${grid}${ser}${labs}</svg></div>`;
 };
 /* lines over matches: series [{name,cls,pts:[{y,tip}]}], same x for every series (match order) */
 INS.line=function(o){
  const W=o.w||640,H=o.h||220,L=40,R=12,T=12,B=26,n=Math.max(...o.series.map(s=>s.pts.length));if(n<2)return '<div class="empty">Not enough matches for a trend yet.</div>';
  const all=o.series.flatMap(s=>s.pts.map(p=>p.y)).filter(v=>v!=null&&isFinite(v)),y0=Math.min(0,...all),y1=Math.max(...all)*1.1||1;
  const X=i=>L+i/(n-1)*(W-L-R),Y=v=>H-B-(v-y0)/(y1-y0||1)*(H-T-B);
  const g=ticks(y0,y1,4).map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="ins-grid"/><text x="${L-6}" y="${Y(v)+3}" class="ins-ax e">${+v.toFixed(2)}</text>`).join('');
  const ser=o.series.map(s=>{const d=s.pts.map((p,i)=>p.y==null?null:`${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).filter(Boolean).join(' ');
   return `<polyline points="${d}" class="ins-ln ${s.cls||''}"/>`+s.pts.map((p,i)=>p.y==null?'':`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" class="ins-lp ${s.cls||''}"${INS.tipAttr(p.tip||[s.name,n2(p.y)])}></circle>`).join('')}).join('');
  return `<div class="ins-ch"><div class="ins-leg">${o.series.map(s=>`<span><i class="${s.cls||''}"></i>${esc(s.name)}</span>`).join('')}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria||'Trend')}">${g}${ser}<text x="${W-R}" y="${H-6}" class="ins-axt e">${esc(o.xl||'')}</text></svg></div>`;
 };
 /* percentile bars with the raw value: rows [{label,raw,unit,pct}] */
 INS.pctBars=function(rows){
  return `<ul class="ins-pc">${rows.map(r=>`<li${INS.tipAttr([r.label,(r.raw==null?'N/A':r.raw)+(r.unit?' '+r.unit:''),r.pct==null?'no percentile':Math.round(r.pct)+' percentile'])}><span class="ins-pl">${esc(r.label)}</span><span class="ins-raw">${r.raw==null?'N/A':esc(String(r.raw))}<span class="mu"> ${esc(r.unit||'')}</span></span>
   <span class="ins-pt2"><i style="width:${r.pct==null?0:Math.round(r.pct)}%" class="${r.pct>=80?'hi':r.pct<=20?'lo':''}"></i></span><b>${r.pct==null?'–':Math.round(r.pct)}</b></li>`).join('')}</ul>`;
 };
 /* tabs inside a card: [{k,t}] → buttons; the page swaps the body */
 INS.tabs=(id,T,on)=>`<div class="ins-tabs" role="tablist" id="${id}">${T.map(x=>`<button type="button" role="tab" class="${x.k===on?'':'s'}" aria-selected="${x.k===on}" data-k="${x.k}">${esc(x.t)}</button>`).join('')}</div>`;
 INS.wireTabs=(root,id,fn)=>{const t=root.querySelector('#'+id);if(!t)return;t.addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;t.querySelectorAll('button').forEach(x=>{const on=x===b;x.className=on?'':'s';x.setAttribute('aria-selected',on)});fn(b.dataset.k)})};
 /* a page asks for a section (home, league, players, analysis, fpl); the menu has ten hubs, so a page the hubs do not list yet goes to the hub of that name's kind */
 INS.addPage=(k,n,sec,after)=>{if(typeof PAGES==='undefined')return;if(!PAGES.some(p=>p[0]===k)){const i=PAGES.findIndex(p=>p[0]===after);PAGES.splice(i>=0?i+1:PAGES.length,0,[k,n])}
  if(typeof UI_SEC!=='undefined'&&!UI_SEC.some(x=>x.p.includes(k))){const hub={home:'home',league:'matches',players:'players',analysis:'attack',fpl:'fpl'}[sec]||sec,s=UI_SEC.find(x=>x.k===hub);if(s){const i=s.p.indexOf(after);s.p.splice(i>=0?i+1:s.p.length,0,k)}}};
 INS.ar=o=>{if(typeof AR==='object')Object.entries(o).forEach(([k,v])=>{if(!(k in AR)&&v!==k)AR[k]=v})};
 INS.ar({"No data to plot.":"ما فيه بيانات للرسم.","No data.":"ما فيه بيانات.","Not enough matches for a trend yet.":"المباريات ما تكفي لرسم اتجاه للحين.",
  "Goals":"الأهداف","Shots":"التسديدات","Key passes":"تمريرات مفتاحية","Shot-creating actions":"أفعال صنعت تسديدة","Passes into box":"تمريرات داخل المنطقة",
  "Progressive passes":"تمريرات تقدمية","Progressive carries":"حمل كرة تقدمي","Take-ons won":"مراوغات ناجحة","Passes":"التمريرات","Goals against":"أهداف عليه","xG against":"xG عليه",
  "Shots against":"تسديدات عليه","Tackles":"الافتكاكات","Interceptions":"الاعتراضات","Duels won":"التحامات مكسوبة","Aerials won":"كرات هوائية مكسوبة","High turnovers":"استعادة الكرة في مناطق متقدمة",
  "Counterpress regains (# s)":"استعادة الكرة خلال # ثوانٍ بعد فقدانها","Average defensive action height (m)":"متوسط ارتفاع الفعل الدفاعي (م)","Field tilt (%)":"ميل الملعب (%)","no percentile":"بدون نسبة مئوية","percentile":"النسبة المئوية"});
})();
