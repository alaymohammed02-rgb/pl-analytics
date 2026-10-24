/* ===== Club page extras: how the club plays, from PitchAPI's lineups, momentum, ratings and shots =====
   Added under the club's key numbers (the rest of the club page stays as it was):
   - next match, with a link to its preview
   - formations used and the most-used XI: data/<league>_mx.json (matches.lineups), only matches the sync has fetched
   - xG for and against, match by match: the shot file (own goals left out, as everywhere on the site)
   - when the club is on top: PitchAPI's momentum averaged by 15-minute period, turned to the club's side (momentum > 0 =
     home side on top, checked against the shots)
   - top rated: average PitchAPI match rating, players with CL_MIN+ rated matches for the club
   - share as image */
(function(){
 if(typeof R!=='object'||typeof R.club!=='function')return;
 const CL_MIN=3,f2=v=>v==null?'N/A':(+v).toFixed(2);
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const oc=R.club;
 R.club=async function(el,arg){
  await oc.apply(this,arguments);
  const name=decodeURIComponent(arg||''),k=el.querySelector('.clubk');if(!k||el.querySelector('#clx'))return;
  const box=document.createElement('div');box.id='clx';box.className='clx';box.innerHTML='<div class="empty skel">Loading…</div>';k.after(box);
  const [mx,rt,sh,fx]=await Promise.all([mxLoad(),rtLoad(),loadSh().catch(()=>null),typeof fixLoad==='function'?fixLoad().catch(()=>null):null]);
  if(!document.body.contains(box))return;
  const S=clData(name,mx,rt,sh,fx);
  box.innerHTML=clNext(S)+`<div class="clx-g">${clXg(S)}${clMo(S)}</div><div class="clx-g">${clForm(S)}${clTop(S)}</div>`+`<div class="clx-sh">${shareBtn('club')}</div>`;
  if(typeof shareWire==='function')shareWire(box,()=>clShare(S));
 };
 function clData(name,mx,rt,sh,fx){
  const fin=D.matches.filter(m=>(m.home===name||m.away===name)&&wkSc(m.score)&&m.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const tx=wkTeamXg(sh?sh.rows:[]),S={name,fin,mx:[],xg:[],mo:null,top:[],next:null};
  fin.forEach(m=>{const opp=m.home===name?m.away:m.home,xf=tx.get(m.match_id+'|'+name),xa=tx.get(m.match_id+'|'+opp);if(xf!=null||xa!=null)S.xg.push({m,opp,xf,xa,h:m.home===name})});
  /* lineups and momentum of the matches the sync has fetched */
  const bins=Array.from({length:6},()=>({s:0,n:0}));let nm=0;
  fin.forEach(m=>{const e=mx&&mx.m&&mx.m[m.match_id];if(!e)return;const side=m.home===name?'h':'a';
   const L=e.lu&&e.lu[side];if(L)S.mx.push({m,L});
   if(e.mo&&e.mo.length){nm++;e.mo.forEach(([t,v])=>{const b=Math.min(5,Math.floor(t/15));bins[b].s+=side==='h'?v:-v;bins[b].n++})}});
  if(nm)S.mo={b:bins.map(b=>b.n?b.s/b.n:null),n:nm};
  /* formations and the most-used XI */
  const F=new Map(),P=new Map();S.mx.forEach(({L})=>{F.set(L.f,(F.get(L.f)||0)+1);(L.xi||[]).forEach(p=>{const o=P.get(p[0])||{id:p[0],n:p[1],no:p[2],st:0};o.st++;P.set(p[0],o)})});
  S.forms=[...F.entries()].sort((a,b)=>b[1]-a[1]);S.xi=[...P.values()].sort((a,b)=>b.st-a.st).slice(0,11);
  /* ratings: every rated match of a player for this club */
  const ids=new Map();(D.stats||[]).forEach(s=>{if(s.club===name&&s.player_id)ids.set(s.player_id,{key:s.key,n:s.player})});
  const A=new Map();fin.forEach(m=>{const r=rt&&rt.m&&rt.m[m.match_id];if(!r)return;Object.entries(r).forEach(([pid,v])=>{if(!ids.has(pid)||typeof v!=='number')return;const o=A.get(pid)||{id:pid,...ids.get(pid),s:0,c:0,best:0};o.s+=v;o.c++;o.best=Math.max(o.best,v);A.set(pid,o)})});
  S.top=[...A.values()].filter(o=>o.c>=CL_MIN).map(o=>({...o,avg:o.s/o.c})).sort((a,b)=>b.avg-a.avg).slice(0,6);S.ids=ids;
  const now=Date.now();((((fx&&fx.leagues)||{})[D.id])||[]).forEach(f=>{const t=Date.parse(f.k);if((f.h===name||f.a===name)&&t>now-3*36e5&&(!S.next||t<Date.parse(S.next.k)))S.next=f});
  return S;
 }
 const plh=(S,id)=>{const l=S.ids.get(id);return l?'#/player/'+encodeURIComponent(l.key+'||'+S.name):null};
 function clNext(S){
  const f=S.next;if(!f)return '';const t=Date.parse(f.k),opp=f.h===S.name?f.a:f.h;
  return `<a class="card clx-next" href="#/preview/${encodeURIComponent(f.i)}"><span class="mu">Next match</span>${hCrest(opp)}<b>${f.h===S.name?'':'@ '}<bdi>${esc(opp)}</bdi></b><span class="mu">${isNaN(t)?esc(f.d||''):esc(new Date(t).toLocaleString(document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</span><span class="clx-go">Preview →</span></a>`;
 }
 function clXg(S){
  if(!S.xg.length)return '';
  const W=Math.max(320,S.xg.length*28),H=150,mx=Math.max(.5,...S.xg.map(x=>Math.max(x.xf||0,x.xa||0))),bw=Math.min(10,(W/S.xg.length-6)/2),y=v=>H-22-(v||0)/mx*(H-34);
  const bars=S.xg.map((x,i)=>{const cx=(i+.5)*W/S.xg.length,g=wkSc(x.m.score),f=x.h?g[0]:g[1],a=x.h?g[1]:g[0],r=f>a?'W':f<a?'L':'D';
   return `<g><title>${esc(x.m.date.slice(0,10))} · ${esc(x.m.home)} ${esc(x.m.score)} ${esc(x.m.away)} · xG ${f2(x.xf)} – ${f2(x.xa)}</title><rect x="${(cx-bw-1).toFixed(1)}" y="${y(x.xf).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-22-y(x.xf)).toFixed(1)}" class="clx-f"></rect>
    <rect x="${(cx+1).toFixed(1)}" y="${y(x.xa).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H-22-y(x.xa)).toFixed(1)}" class="clx-a"></rect><circle cx="${cx.toFixed(1)}" cy="${H-10}" r="4" class="clx-r ${r}"></circle></g>`}).join('');
  const tf=S.xg.reduce((a,x)=>a+(x.xf||0),0),ta=S.xg.reduce((a,x)=>a+(x.xa||0),0);
  return `<div class="card"><h3>xG, match by match</h3><div class="mc-leg"><span><i style="background:var(--th-hi)"></i><span>For</span> ${f2(tf/S.xg.length)}</span><span><i style="background:#8a9bb0"></i><span>Against</span> ${f2(ta/S.xg.length)}</span><span class="mu">· <span>a match</span></span></div>
   <div class="clx-sc"><svg viewBox="0 0 ${W} ${H}" style="min-width:${Math.min(W,560)}px" role="img" aria-label="xG">${bars}</svg></div><p class="mu mc-note"><span>Oldest to newest.</span> <span>The dot under each match: green win, grey draw, red loss.</span></p></div>`;
 }
 function clMo(S){
  if(!S.mo)return '';const L=['0–15','15–30','30–45','45–60','60–75','75–90+'],mx=Math.max(10,...S.mo.b.map(v=>Math.abs(v||0)));
  return `<div class="card"><h3>On top, by period</h3><ul class="clx-mo">${S.mo.b.map((v,i)=>`<li><span class="mu">${L[i]}'</span><span class="clx-mb"><i class="${v>=0?'p':'n'}" style="width:${v==null?0:Math.round(Math.abs(v)/mx*50)}%"></i></span><b>${v==null?'N/A':(v>0?'+':'')+Math.round(v)}</b></li>`).join('')}</ul>
   <p class="mu mc-note"><span>PitchAPI's momentum averaged over ${S.mo.n} matches, by period: above zero the club had the upper hand, below zero the opponent.</span></p></div>`;
 }
 function clForm(S){
  if(!S.mx.length)return '';
  return `<div class="card"><h3>Formations and regular XI</h3><div class="clx-fm">${S.forms.map(([f,n])=>`<span class="mc-f">${esc(f)} <b>×${n}</b></span>`).join('')}</div>
   <ol class="clx-xi">${S.xi.map(p=>{const h=plh(S,p.id);return `<li><span class="mc-sn">${esc(p.no||'')}</span>${h?`<a href="${h}">${esc(p.n)}</a>`:`<span>${esc(p.n)}</span>`}<span class="mu">${p.st} <span>of</span> ${S.mx.length}</span></li>`}).join('')}</ol>
   <p class="mu mc-note"><span>From the ${S.mx.length} matches whose lineups the sync has fetched; most starts first.</span></p></div>`;
 }
 function clTop(S){
  if(!S.top.length)return '';
  return `<div class="card"><h3>Top rated</h3><ol class="mc-rl">${S.top.map(o=>{const h=plh(S,o.id);return `<li><i style="background:${rc(o.avg)}">${o.avg.toFixed(2)}</i>${h?`<a href="${h}">${esc(o.n)}</a>`:`<span>${esc(o.n)}</span>`}<span class="mu mc-in">${o.c} <span>rated matches</span></span></li>`}).join('')}</ol>
   <p class="mu mc-note"><span>Average PitchAPI match rating, ${CL_MIN}+ rated matches.</span></p></div>`;
 }
 async function clShare(S){
  return shareCard({name:'club-'+S.name,title:S.name,draw:async(ctx,U)=>{
   const tr=U.tr;await U.crest(S.name,U.W/2-110,90,220);U.text(S.name,U.W/2,370,{size:60,weight:800,align:'center',max:U.W-2*U.PAD,fit:40});U.text(D.name,U.W/2,420,{size:28,color:U.mu,align:'center'});
   const k=[...document.querySelectorAll('.clubk .kpi')].slice(0,6).map(e=>[e.querySelector('span').textContent,e.querySelector('b').textContent]);
   const gw=(U.W-2*U.PAD-2*20)/3;k.forEach(([l,v],i)=>{const x=U.PAD+(i%3)*(gw+20),y=470+Math.floor(i/3)*130;U.rr(x,y,gw,110,18,'rgba(255,255,255,.05)');U.text(tr(l),x+20,y+38,{size:22,color:U.mu,max:gw-30});U.text(v,x+20,y+92,{size:42,weight:800})});
   let y=760;const rec=S.fin.slice(-5);if(rec.length){U.text(tr('Recent results'),U.PAD,y,{size:30,weight:700});rec.forEach((m,i)=>{const g=wkSc(m.score),h=m.home===S.name,f=h?g[0]:g[1],a=h?g[1]:g[0];U.badge(f+'–'+a,U.PAD+i*150,y+24,{size:30,h:54,min:130,fill:f>a?'#4cc38a':f<a?'#e5646b':'#8a9bb0',color:'#0d1520'})});y+=130}
   if(S.top.length){U.text(tr('Top rated'),U.PAD,y,{size:30,weight:700});S.top.slice(0,3).forEach((o,i)=>{const yy=y+24+i*84;U.rr(U.PAD,yy,U.W-2*U.PAD,70,16,'rgba(255,255,255,.05)');U.text(o.n,U.PAD+24,yy+46,{size:32,weight:700,max:U.W-2*U.PAD-200});U.badge(o.avg.toFixed(2),U.W-U.PAD-14,yy+10,{size:30,h:50,min:110,align:'right',fill:rc(o.avg)})})}
  }});
 }
 if(typeof AR==='object')Object.entries({
  "Next match":"المباراة القادمة","Preview →":"المعاينة ←","xG, match by match":"xG مباراة بمباراة","For":"له","Against":"عليه","a match":"للمباراة","Oldest to newest.":"من الأقدم للأحدث.",
  "The dot under each match: green win, grey draw, red loss.":"النقطة تحت كل مباراة: أخضر فوز، رمادي تعادل، أحمر خسارة.","On top, by period":"مين يسيطر، حسب وقت المباراة",
  "PitchAPI's momentum averaged over # matches, by period: above zero the club had the upper hand, below zero the opponent.":"متوسط زخم PitchAPI في # مباراة، حسب الفترة: فوق الصفر النادي هو المسيطر، وتحته الخصم.",
  "From the # matches whose lineups the sync has fetched; most starts first.":"من # مباراة جبنا تشكيلاتها؛ الأكثر مشاركة أساسيًا أولًا.",
  "Formations and regular XI":"الخطط والتشكيلة المعتادة","of":"من","Top rated":"الأعلى تقييمًا","rated matches":"مباريات مقيّمة",
  "Average PitchAPI match rating, #+ rated matches.":"متوسط تقييم PitchAPI للمباراة، #+ مباريات مقيّمة."
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
