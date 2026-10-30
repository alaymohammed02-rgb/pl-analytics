/* ===== Team of the season (#/toty, in the Players hub after Ratings): the best XI of the league by PitchAPI match rating, on the pitch, shareable =====
   Each player's number is the plain average of the PitchAPI ratings of the matches he was rated in (data/<league>_rt.json, the same average the Ratings page shows),
   counted only for players with enough rated matches: a share of the matches the busiest player was rated in (30%, 50% or 70%, 50% first), so a few good matches
   cannot make a team. His position is the one he played most minutes in (the positions PitchAPI's rows carry, used as they are: it calls many forwards midfielders),
   his club the one he was rated for most. The formation is the usual one (4-3-3, 4-4-2, 3-4-3, 3-5-2, 4-5-1, 5-3-2, 5-4-1) that gives the highest total rating with the
   players available, or the one chosen; it describes the ratings, not how a coach would pick. Ties: more rated matches, then name. Works for the current season and
   any past season that has ratings (a light past season has none and says so). Nothing is estimated: a rating is PitchAPI's, an average is an average. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('toty','Team of the season','players','ratings');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const FORMS=[[4,3,3],[4,4,2],[3,4,3],[3,5,2],[4,5,1],[5,3,2],[5,4,1]],FRAC=[0.3,0.5,0.7];
 const S={frac:0.5,form:'',tok:0};
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const short=n=>{const w=String(n||'').split(/\s+/).filter(Boolean);if(w.length<2)return w[0]||'';const L=w[w.length-1],p=w[w.length-2];return /^(van|von|de|da|dos|del|der|di|le|la|ten|ter|el|al|ben)$/i.test(p)?p+' '+L:L};
 /* every rated player of the league: [{id,n,club,pos,k (rated matches),avg,mi}] and the number of matches the league has rated */
 function players(P,rt){
  const ix=P.ix,A=new Map(),rated=new Set();
  for(const r of P.rows){const mid=r[ix.m],pid=r[ix.i],m=rt.m[mid],v=m&&m[pid];if(typeof v!=='number')continue;
   rated.add(mid);let o=A.get(pid);if(!o)A.set(pid,o={id:pid,n:r[ix.n],club:{},pos:{},k:0,s:0,mi:0});
   o.k++;o.s+=v;o.mi+=r[ix.mi]||0;o.club[r[ix.c]]=(o.club[r[ix.c]]||0)+1;if(r[ix.o])o.pos[r[ix.o]]=(o.pos[r[ix.o]]||0)+(r[ix.mi]||0)}
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0]))[0];
  const all=[...A.values()].map(o=>({id:o.id,n:o.n,club:(top(o.club)||[''])[0],pos:(top(o.pos)||[null])[0],k:o.k,avg:o.s/o.k,mi:o.mi}));
  return {all,rated:rated.size,max:all.reduce((m,x)=>Math.max(m,x.k),0)};
 }
 /* the XI: formation (chosen or the best total) and the players, from the goal up */
 function pick(all,min,form){
  const by={GK:[],DF:[],MF:[],FW:[]};
  all.forEach(x=>{if(x.k>=min&&by[x.pos])by[x.pos].push(x)});
  Object.values(by).forEach(L=>L.sort((a,b)=>b.avg-a.avg||b.k-a.k||cmp(a.n,b.n)||cmp(a.id,b.id)));
  if(!by.GK.length)return null;
  let top=null;
  for(const f of FORMS){if(form&&f.join('-')!==form)continue;if(by.DF.length<f[0]||by.MF.length<f[1]||by.FW.length<f[2])continue;
   const xi=[by.GK[0],...by.DF.slice(0,f[0]),...by.MF.slice(0,f[1]),...by.FW.slice(0,f[2])],s=xi.reduce((a,x)=>a+x.avg,0);
   if(!top||s>top.s+1e-9)top={f,xi,s}}
  return top;
 }
 function spots(T){const rows=[[T.xi[0]],T.xi.slice(1,1+T.f[0]),T.xi.slice(1+T.f[0],1+T.f[0]+T.f[1]),T.xi.slice(1+T.f[0]+T.f[1])],Y=[90,68,43,17],o=[];
  rows.forEach((L,i)=>L.forEach((p,j)=>o.push({p,x:(j+1)/(L.length+1)*100,y:Y[i]})));return o}
 R.toty=async function(el){
  el.innerHTML='<h2>Team of the season</h2><div id="tsroot" class="ins ts"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#tsroot'),lg=D.id,tok=++S.tok;
  let P,rt;try{[rt,P]=await Promise.all([rtLoad(),loadPl().catch(()=>null)]);if(typeof phLoad==='function')await phLoad().catch(()=>null)}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The ratings are not available right now.','التقييمات مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!P||!rt||!rt.m||!Object.keys(rt.m).length){root.innerHTML=`<div class="empty">${two('No PitchAPI ratings for this league and season.','ما فيه تقييمات PitchAPI لهذا الدوري وهذا الموسم.')}</div>`;return}
  draw(root,players(P,rt),lg);
 };
 function draw(root,PL,lg){
  const min=Math.max(1,Math.ceil(S.frac*PL.max)),T=pick(PL.all,min,S.form),finished=(D.matches||[]).filter(m=>typeof wkSc==='function'?wkSc(m.score):true).length;
  const ctl=`<div class="card"><div class="ctl"><div class="seg" id="tsf" role="group" aria-label="${ar()?'الحد الأدنى من المباريات':'Minimum rated matches'}">${FRAC.map(f=>`<button type="button" data-f="${f}" aria-pressed="${S.frac===f}" class="${S.frac===f?'on':''}">${two(Math.round(f*100)+'% of the season',nb(Math.round(f*100)+'%')+' من الموسم')}</button>`).join('')}</div>
   <label class="dcx-l"><span class="mu">${two('Formation','الخطة')}</span><select id="tsfm"><option value="">${ar()?'الأفضل حسب التقييم':'Best fit'}</option>${FORMS.map(f=>`<option value="${f.join('-')}"${S.form===f.join('-')?' selected':''}>${f.join('-')}</option>`).join('')}</select></label></div></div>`;
  if(!T){root.innerHTML=`<div class="card lk-intro"><p>${two('<b>The best XI of the season</b> by PitchAPI match rating.','<b>أفضل ١١ في الموسم</b> حسب تقييم PitchAPI للمباراة.')}</p></div>${ctl}<div class="empty">${two(`Not enough rated players with ${min} or more rated matches to fill a team${S.form?' in '+S.form:''}. Lower the minimum or pick another formation.`,`ما فيه لاعبين مقيَّمين كفاية بـ${nb(min)} مباراة مقيَّمة أو أكثر لتكوين فريق${S.form?' بخطة '+nb(S.form):''}. خفّض الحد الأدنى أو اختر خطة ثانية.`)}</div>`;wire(root,PL,lg);return}
  const href=x=>{const s=(D.stats||[]).find(s=>s.player_id===x.id&&s.club===x.club);return '#/player/'+encodeURIComponent((s?s.key:x.id)+'||'+x.club)};
  const sub=D.name+(ALL.season?' · '+ALL.season:'');
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>The best XI of the season</b> by PitchAPI match rating: each player\'s average over the matches he was rated in, with a minimum of rated matches so a few good games cannot make a team. The formation is the usual one that gives the highest total rating, or the one you choose.','<b>أفضل ١١ في الموسم</b> حسب تقييم PitchAPI للمباراة: متوسط كل لاعب في المباريات اللي انقيّم فيها، مع حد أدنى من المباريات المقيَّمة عشان كم مباراة حلوة ما تكوّن فريق. الخطة هي المعتادة اللي تعطي أعلى مجموع تقييم، أو اللي تختارها.')}</p></div>
   ${ctl}
   <div class="card ts-c" id="tsc"><div class="hhd"><h3>${nm(sub)}</h3><span class="mu nw">${nb(T.f.join('-'))} · ${two('average rating','متوسط التقييم')} ${nb((T.s/11).toFixed(2))}</span>${typeof shareBtn==='function'?shareBtn('toty'):''}</div>
    <div class="tr-wrap"><div class="tr-pitch" role="img" aria-label="${ar()?'فريق الموسم':'Team of the season'}">${spots(T).map(({p,x,y})=>`<a class="tr-p" data-id="${esc(p.id)}" href="${href(p)}" style="left:${x.toFixed(1)}%;top:${y}%" title="${esc(p.n+' · '+p.club+' · '+p.avg.toFixed(2))}">${typeof hAvatar==='function'?hAvatar(p.id,p.n,p.club):''}<i style="background:${rc(p.avg)}">${p.avg.toFixed(1)}</i><span>${nm(short(p.n))}</span></a>`).join('')}</div>
    <ol class="tr-list ts-l">${T.xi.map(p=>`<li data-id="${esc(p.id)}" data-avg="${p.avg.toFixed(4)}" data-k="${p.k}"><span class="tr-pos">${p.pos}</span><i style="background:${rc(p.avg)}">${p.avg.toFixed(2)}</i><a href="${href(p)}">${nm(p.n)}</a><span class="mu">${nm(p.club)} · ${nb(p.k)} ${two('rated','مقيَّم')}</span></li>`).join('')}</ol></div>
    <p class="mu ins-note">${two(`PitchAPI's rating, averaged over his rated matches; ${min}+ rated matches (${Math.round(S.frac*100)}% of the ${PL.max} of the busiest player); ${PL.rated} of ${finished} matches of the league are rated. Positions are PitchAPI's labels as they come (it calls many forwards midfielders). The team describes the ratings, not how a coach would pick, and an average over a few matches moves a lot.`,`تقييم PitchAPI، متوسطه في مبارياته المقيَّمة؛ ${nb(min)}+ مباراة مقيَّمة (${nb(Math.round(S.frac*100)+'%')} من ${nb(PL.max)} للاعب الأكثر مشاركة)؛ ${nb(PL.rated)} من ${nb(finished)} مباراة في الدوري مقيَّمة. المراكز هي تسميات PitchAPI كما هي (يسمّي كثير من المهاجمين لاعبي وسط). الفريق يصف التقييمات، مو اختيار مدرب، ومتوسط على كم مباراة يتحرك كثير.`)}</p></div>`;
  wire(root,PL,lg);
  if(typeof shareWire==='function')shareWire(root,()=>shareCard({name:'team-of-the-season-'+(ALL.season||'now')+'-'+lg,title:'Team of the season',draw:async(ctx,U)=>{
   const tr=U.tr;U.text(tr('Team of the season'),U.PAD,100,{size:42,weight:800,color:U.hi});U.text(sub+' · '+T.f.join('-'),U.PAD,148,{size:28,color:U.mu});
   const px=U.PAD,py=180,pw=U.W-2*U.PAD,ph=U.H-96-40-py;U.rr(px,py,pw,ph,24,'#1d5a3a');
   ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=3;ctx.strokeRect(px+20,py+20,pw-40,ph-40);ctx.beginPath();ctx.moveTo(px+20,py+ph/2);ctx.lineTo(px+pw-20,py+ph/2);ctx.stroke();
   ctx.beginPath();ctx.arc(px+pw/2,py+ph/2,80,0,7);ctx.stroke();ctx.strokeRect(px+pw/2-200,py+ph-20-150,400,150);ctx.strokeRect(px+pw/2-200,py+20,400,150);
   for(const {p,x,y} of spots(T)){const cx=px+x/100*pw,cy=py+y/100*ph;await U.avatar(p.id,p.n,p.club,cx,cy-14,52);
    U.badge(p.avg.toFixed(1),cx+44,cy-86,{size:24,h:38,min:62,align:'center',fill:rc(p.avg)});U.text(short(p.n),cx,cy+70,{size:26,weight:700,align:'center',max:220,stroke:'rgba(0,0,0,.6)',sw:6})}
  }}));
 }
 function wire(root,PL,lg){
  root.querySelectorAll('#tsf button').forEach(b=>b.onclick=()=>{S.frac=+b.dataset.f;draw(root,PL,lg)});
  const f=root.querySelector('#tsfm');if(f)f.onchange=e=>{S.form=e.target.value;draw(root,PL,lg)};
 }
 INS.ar({'Team of the season':'فريق الموسم'});
 INS.toty={players,pick};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
