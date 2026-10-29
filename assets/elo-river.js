/* ===== Elo river (#/river, in Teams after Club Elo): every club's rating through time, as lines that flow across the league =====
   Uses data/elo_own.json (the Club Elo page's file): per club, its rating after each of its last 60 matches. One line per club of the chosen
   league; the line is drawn from the club's own match dates, so a club that played more often has more bends. Move over a line (or press a
   club's name) to follow it, click to keep it; the others fade. Ranges: the last 12 months (the first view), this season (from the 1st of July before the last match), the last 90 days, everything stored (up to 60 matches per club). Not the same scale across leagues (every league's Elo starts from 1500), so one league
   at a time. Nothing is smoothed or invented: the points are the file's. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('river','Elo river','teams','elo');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const S={lg:'',range:'365',pin:'',hov:'',tok:0,anim:true};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('elo_own.json',ALL.generated).then(d=>{if(!d||!d.leagues||!Object.keys(d.leagues).length)throw new Error('elo');return d}).catch(e=>{if(CF===p)CF=null;throw e});CF=p;return p;
 }
 const day=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
 const back=(d,n)=>new Date((day(d)-n)*864e5).toISOString().slice(0,10);
 /* the first date of a range, from the league's last match */
 const since=(last,r)=>r==='90'?back(last,90):r==='365'?back(last,365):r==='season'?(+last.slice(5,7)>=7?last.slice(0,4):String(+last.slice(0,4)-1))+'-07-01':'0000-00-00';
 const W=760,H=440,ML=46,MR=124,MT=14,MB=30;
 R.river=async function(el){
  el.innerHTML='<h2>Elo river</h2><div id="errot" class="ins lk er"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#errot'),lg=D.id,tok=++S.tok;
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The Elo ratings are not available right now.','تقييمات Elo مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!F.leagues[S.lg]){S.lg=F.leagues[lg]?lg:Object.keys(F.leagues)[0];S.pin='';S.hov=''}
  S.anim=true;draw(root,F);
 };
 function lines(L,range){
  const from=since(L.last,range),out=[];
  for(const [t,x] of Object.entries(L.teams)){const h=(x.h||[]).filter(p=>p[0]>=from);if(h.length)out.push({t,r:x.r,h})}
  return out.sort((a,b)=>b.r-a.r||(a.t<b.t?-1:1));
 }
 function draw(root,F){
  const L=F.leagues[S.lg],ids=Object.keys(F.leagues),T=lines(L,S.range);
  if(!T.length){root.innerHTML=head(F)+`<div class="card"><div class="empty">${two('No ratings in this range.','ما فيه تقييمات في هالفترة.')}</div></div>`;wire(root,F,T);return}
  const all=T.flatMap(x=>x.h),d0=Math.min(...all.map(p=>day(p[0]))),d1=Math.max(...all.map(p=>day(p[0]))),y0=Math.floor(Math.min(...all.map(p=>p[1]))/20)*20,y1=Math.ceil(Math.max(...all.map(p=>p[1]))/20)*20;
  const X=d=>ML+(d1===d0?.5:(day(d)-d0)/(d1-d0))*(W-ML-MR),Y=v=>MT+(1-(v-y0)/(y1-y0||1))*(H-MT-MB);
  const step=y1-y0>200?100:y1-y0>100?50:20,grid=[];for(let v=Math.ceil(y0/step)*step;v<=y1;v+=step)grid.push(v);
  /* month marks */
  const mk=[];{const a=new Date(d0*864e5),b=d1*864e5;let c=Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,1);while(c<=b){const s=new Date(c).toISOString().slice(0,7);mk.push([s,(c/864e5-d0)/(d1-d0||1)]);c=Date.UTC(new Date(c).getUTCFullYear(),new Date(c).getUTCMonth()+1,1)}}
  /* end labels, pushed apart so they never overlap */
  const lab=T.map((x,i)=>({i,y:Y(x.h[x.h.length-1][1])})).sort((a,b)=>a.y-b.y);for(let k=1;k<lab.length;k++)if(lab[k].y<lab[k-1].y+11)lab[k].y=lab[k-1].y+11;
  const ly=new Map(lab.map(l=>[l.i,l.y])),hue=i=>Math.round(i*360/T.length*.92+8);
  const hi=S.pin||S.hov;
  root.innerHTML=head(F)+`<div class="card er-card"><svg class="er-svg${S.anim&&!hi?' er-draw':''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ar()?'خطوط تقييم Elo للأندية':'Elo rating lines of the clubs'}" preserveAspectRatio="xMidYMid meet">
    ${grid.map(v=>`<g class="er-g"><line x1="${ML}" x2="${W-MR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${ML-6}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${v}</text></g>`).join('')}
    ${mk.map(([s,f])=>`<text class="er-m" x="${(ML+f*(W-ML-MR)).toFixed(1)}" y="${H-8}" text-anchor="middle">${s}</text>`).join('')}
    ${T.map((x,i)=>{const c=`hsl(${hue(i)} 68% 58%)`,last=x.h[x.h.length-1],d=x.h.map((p,k)=>(k?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join(' ');
     return `<g class="er-l${hi?(hi===x.t?' hi':' dim'):''}" data-t="${esc(x.t)}" data-n="${x.h.length}" data-first="${x.h[0][1]}" data-last="${last[1]}" style="--c:${c};--i:${i}"><path class="er-p" d="${d}" pathLength="1"/><path class="er-hit" d="${d}"/>
      <circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="3"/><text class="er-t" x="${W-MR+8}" y="${(ly.get(i)+3.5).toFixed(1)}">${esc(x.t)}</text></g>`}).join('')}
   </svg>
   <div class="er-chips" role="group" aria-label="${ar()?'الأندية':'Clubs'}">${T.map((x,i)=>`<button type="button" class="er-chip${S.pin===x.t?' on':''}" data-t="${esc(x.t)}" aria-pressed="${S.pin===x.t}" style="--c:hsl(${hue(i)} 68% 58%)"><i></i>${nm(x.t)} <b>${nb(Math.round(x.r))}</b></button>`).join('')}</div>
   <p class="mu ins-note">${two(`One line per club of ${esc(L.name)}: its Elo rating after each match (the last 60 at most), the lines end at the current rating. Ratings of different leagues cannot be compared. ${S.range==='all'?'All stored matches (a club that was in a lower division for a while has a gap).':S.range==='season'?'This season only, from 1 July.':S.range==='365'?'The last 12 months.':'The last 90 days only.'} Hover or press a club to follow it, click to keep it.`,`خط لكل نادي في ${nm(L.name)}: تقييم Elo بعد كل مباراة (آخر ${nb(60)} مباراة بالكثير)، والخطوط تنتهي عند التقييم الحالي. تقييمات الدوريات المختلفة ما تتقارن. ${S.range==='all'?'كل المباريات المخزّنة (النادي اللي كان في دوري أدنى فترة يطلع عنده فراغ).':S.range==='season'?'هالموسم فقط، من ١ يوليو.':S.range==='365'?'آخر ١٢ شهر.':'آخر '+nb(90)+' يوم فقط.'} مرّر أو اضغط على نادي عشان تتابعه، واضغط لتثبّته.`)}</p></div>`;
  wire(root,F,T);
 }
 function head(F){const ids=Object.keys(F.leagues);
  return `<div class="card lk-intro"><p>${two('<b>Every club\'s rating, flowing through the season.</b> Elo goes up with a win over a strong side and down with a loss to a weak one: follow a club to see its run, its slump and who it overtook.','<b>تقييم كل نادي وهو يجري عبر الموسم.</b> تقييم Elo يطلع بالفوز على فريق قوي وينزل بالخسارة من فريق ضعيف: تابع نادي وشوف صعوده وهبوطه ومين تخطّى.')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="erg">${ids.map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <div class="seg" id="err" role="group" aria-label="${ar()?'الفترة':'Range'}">${[['365','12 months','12 شهر'],['season','This season','هالموسم'],['90','90 days','90 يوم'],['all','All stored','كل المخزّن']].map(([k,e,a])=>`<button type="button" data-r="${k}" aria-pressed="${S.range===k}" class="${S.range===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div></div>`}
 function wire(root,F,T){
  const q=s=>root.querySelector(s);
  q('#erg').onchange=e=>{S.lg=e.target.value;S.pin='';S.hov='';S.anim=true;draw(root,F)};
  root.querySelectorAll('#err button').forEach(b=>b.onclick=()=>{S.range=b.dataset.r;S.anim=true;draw(root,F)});
  if(!T.length)return;
  /* following a club only changes classes: the lines are not drawn again */
  const mark=()=>{const h=S.pin||S.hov;root.querySelectorAll('.er-l').forEach(g=>{g.classList.toggle('hi',!!h&&g.dataset.t===h);g.classList.toggle('dim',!!h&&g.dataset.t!==h)});
   root.querySelector('.er-svg').classList.remove('er-draw');root.querySelectorAll('.er-chip').forEach(c=>{const on=c.dataset.t===S.pin;c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on))})};
  const at=t=>{S.hov=t;mark()};
  root.querySelectorAll('.er-l').forEach(g=>{g.onpointerenter=()=>at(g.dataset.t);g.onpointerleave=()=>at('');g.onclick=()=>{S.pin=S.pin===g.dataset.t?'':g.dataset.t;mark()}});
  root.querySelectorAll('.er-chip').forEach(c=>{c.onclick=()=>{S.pin=S.pin===c.dataset.t?'':c.dataset.t;mark()};c.onpointerenter=()=>at(c.dataset.t);c.onpointerleave=()=>at('');c.onfocus=()=>at(c.dataset.t);c.onblur=()=>at('')});
 }
 INS.ar({'Elo river':'نهر Elo'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
