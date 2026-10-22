/* ===== Team of the round: the best XI of the round by PitchAPI match rating, on the pitch, shareable =====
   The round is the one the home shows ("Stars of the round": the last days with results). Each player counts once, with his best
   match of the round, and only if he played TR_MIN+ minutes in it. Positions (GK/DF/MF/FW) are those the sync learnt for the
   per-match player file; a player without a known position is left out rather than guessed. The formation is the one, among the
   usual ones, that gives the highest total rating with the players available: it describes the ratings, not how a coach would
   pick. Nothing is shown until the round has ratings. */
(function(){
 if(typeof homeMount!=='function'||typeof homeStars!=='function')return;
 const TR_MIN=45,FORMS=[[4,3,3],[4,4,2],[3,4,3],[3,5,2],[4,5,1],[5,3,2],[5,4,1]];
 const rc=v=>typeof ratingColor==='function'?ratingColor(v):'var(--th-hi)';
 const short=n=>{const w=String(n||'').split(/\s+/).filter(Boolean);if(w.length<2)return w[0]||'';const L=w[w.length-1],p=w[w.length-2];return /^(van|von|de|da|dos|del|der|di|le|la|ten|ter|el|al|ben)$/i.test(p)?p+' '+L:L};
 /* the XI from the round's ratings: [{pid,n,club,pos,r,mid,m,mi}], formation */
 window.trPick=function(c,rt){
  const P=c&&c.P,ix=P&&P.ix;if(!P||!rt||!rt.m)return null;
  const round=new Map((c.round||[]).map(m=>[m.match_id,m])),best=new Map();
  P.rows.forEach(r=>{const mid=r[ix.m],m=round.get(mid);if(!m)return;const pid=r[ix.i],R=rt.m[mid],v=R&&R[pid];if(typeof v!=='number')return;
   const mi=r[ix.mi],pos=r[ix.o];if(mi==null||mi<TR_MIN||!/^(GK|DF|MF|FW)$/.test(pos||''))return;
   const o=best.get(pid);if(!o||v>o.r||(v===o.r&&mi>o.mi))best.set(pid,{pid,n:r[ix.n],club:r[ix.c],pos,r:v,mid,m,mi,row:r})});
  const by={GK:[],DF:[],MF:[],FW:[]};best.forEach(x=>by[x.pos].push(x));Object.values(by).forEach(L=>L.sort((a,b)=>b.r-a.r||b.mi-a.mi));
  if(!by.GK.length)return null;
  let top=null;FORMS.forEach(f=>{if(by.DF.length<f[0]||by.MF.length<f[1]||by.FW.length<f[2])return;
   const xi=[by.GK[0],...by.DF.slice(0,f[0]),...by.MF.slice(0,f[1]),...by.FW.slice(0,f[2])],s=xi.reduce((a,x)=>a+x.r,0);
   if(!top||s>top.s+1e-9)top={f,xi,s}});
  if(!top)return null;top.rated=new Set([...best.values()].map(x=>x.mid)).size;top.pool=best.size;return top;
 };
 const hs=homeStars;
 homeStars=function(c){return hs.apply(this,arguments)+'<section class="hsec" id="totr" hidden></section>'};
 const hm=homeMount;
 homeMount=async function(){const r=await hm.apply(this,arguments);const home=document.getElementById('home');if(home&&home.querySelector('.hsec')&&!home.dataset.tr){home.dataset.tr='1';fill(home).catch(e=>console.warn('team of the round',e))}return r};
 /* rows from the goal up: GK, defenders, midfielders, forwards; x spread across the width */
 function spots(T){const rows=[[T.xi[0]],T.xi.slice(1,1+T.f[0]),T.xi.slice(1+T.f[0],1+T.f[0]+T.f[1]),T.xi.slice(1+T.f[0]+T.f[1])],Y=[90,68,43,17],o=[];
  rows.forEach((L,i)=>L.forEach((p,j)=>o.push({p,x:(j+1)/(L.length+1)*100,y:Y[i]})));return o}
 async function fill(home){
  const el=home.querySelector('#totr');if(!el)return;
  const [c,rt]=await Promise.all([homeData(),rtLoad()]);if(!c||!rt||!document.body.contains(el))return;
  const T=trPick(c,rt);if(!T)return;
  const href=x=>{const s=(D.stats||[]).find(s=>s.player_id===x.pid&&s.club===x.club);return '#/player/'+encodeURIComponent((s?s.key:x.pid)+'||'+x.club)};
  el.innerHTML=`<div class="hhd"><h2>Team of the round</h2><span class="mu nw">${esc(c.from)} – ${esc(c.last)} · ${T.f.join('-')} · <span>average rating</span> ${(T.s/11).toFixed(2)}</span></div>
   <div class="tr-wrap"><div class="tr-pitch" role="img" aria-label="Team of the round">${spots(T).map(({p,x,y})=>`<a class="tr-p" href="${href(p)}" style="left:${x.toFixed(1)}%;top:${y}%" title="${esc(p.n+' · '+p.club+' · '+p.m.home+' '+p.m.score+' '+p.m.away)}">
    ${hAvatar(p.pid,p.n,p.club)}<i style="background:${rc(p.r)}">${p.r.toFixed(1)}</i><span>${esc(short(p.n))}</span></a>`).join('')}</div>
   <ol class="tr-list">${T.xi.map(p=>`<li><span class="tr-pos">${p.pos}</span><i style="background:${rc(p.r)}">${p.r.toFixed(1)}</i><a href="${href(p)}">${esc(p.n)}</a><a class="mu" href="#/match/${encodeURIComponent(p.mid)}">${esc(p.m.home)} ${esc(p.m.score)} ${esc(p.m.away)}</a></li>`).join('')}</ol></div>
   <div class="potr-f"><span class="mu"><span>Best XI by PitchAPI match rating</span> · ${TR_MIN}+ <span>minutes</span> · <span>the formation with the highest total among the usual ones</span> · <span>${T.rated} of ${(c.round||[]).length} matches rated</span></span>${typeof shareBtn==='function'?shareBtn('totr'):''}</div>`;
  el.hidden=false;
  if(typeof shareWire==='function')shareWire(el,()=>shareCard({name:'team-of-the-round-'+c.last,title:'Team of the round',draw:async(ctx,U)=>{
   const tr=U.tr;U.text(tr('Team of the round'),U.PAD,100,{size:42,weight:800,color:U.hi});U.text(D.name+' · '+c.from+' – '+c.last+' · '+T.f.join('-'),U.PAD,148,{size:28,color:U.mu});
   const px=U.PAD,py=180,pw=U.W-2*U.PAD,ph=U.H-96-40-py;U.rr(px,py,pw,ph,24,'#1d5a3a');
   ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=3;ctx.strokeRect(px+20,py+20,pw-40,ph-40);ctx.beginPath();ctx.moveTo(px+20,py+ph/2);ctx.lineTo(px+pw-20,py+ph/2);ctx.stroke();
   ctx.beginPath();ctx.arc(px+pw/2,py+ph/2,80,0,7);ctx.stroke();ctx.strokeRect(px+pw/2-200,py+ph-20-150,400,150);ctx.strokeRect(px+pw/2-200,py+20,400,150);
   for(const {p,x,y} of spots(T)){const cx=px+x/100*pw,cy=py+y/100*ph;await U.avatar(p.pid,p.n,p.club,cx,cy-14,52);
    U.badge(p.r.toFixed(1),cx+44,cy-86,{size:24,h:38,min:62,align:'center',fill:rc(p.r)});U.text(short(p.n),cx,cy+70,{size:26,weight:700,align:'center',max:220,stroke:'rgba(0,0,0,.6)',sw:6})}
  }}));
 }
 if(typeof AR==='object')Object.entries({"Team of the round":"تشكيلة الجولة","average rating":"متوسط التقييم","Best XI by PitchAPI match rating":"أفضل 11 حسب تقييم PitchAPI للمباراة",
  "the formation with the highest total among the usual ones":"الخطة اللي تعطي أعلى مجموع من الخطط المعتادة"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
 /* the home may already be on the page when this file arrives */
 (function late(k){const home=document.getElementById('home');if(!home||home.dataset.tr)return;if(!home.querySelector('.hsec')){if(k<40)setTimeout(()=>late(k+1),250);return}
  if(!home.querySelector('#totr')){const st=home.querySelector('.hstar'),sec=st&&st.closest('.hsec');if(!sec)return;const t=document.createElement('section');t.className='hsec';t.id='totr';t.hidden=true;sec.after(t)}
  home.dataset.tr='1';fill(home).catch(e=>console.warn('team of the round',e))})(0);
})();
