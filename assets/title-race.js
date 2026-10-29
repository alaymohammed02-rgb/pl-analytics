/* ===== Title race (#/race, in the Season hub after the table): the league table, week by week, as moving bars or as a moving table =====
   Uses data/results.json (every finished result of each league's Elo chain, written by sync.py "TMACH"). A season is cut into weeks (Monday to
   Sunday, by the match date); the table after a week is worked out from the matches played up to the end of that week (points, then goal
   difference, then goals scored, then the name). Clubs may have played different numbers of matches in a week (a postponed match): the "P" column
   says so, and the last week of a finished season is exactly its real final table. Press play (1×, 2×, 4×) or drag the week; click a club to follow it.
   The rows are moved with transforms, so the same row slides to its new place. Nothing is estimated: it is the table, replayed. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('race','Title race','season','table');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const S={lg:'',si:-1,view:'bars',speed:1,fi:-1,pin:'',tok:0,timer:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('results.json',ALL.generated).then(d=>{if(!d||!d.leagues||!Object.keys(d.leagues).length)throw new Error('results');return d}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 /* the Monday of the week of a date (YYYY-MM-DD), as a date text */
 const monday=d=>{const t=Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)),w=(new Date(t).getUTCDay()+6)%7;return new Date(t-w*864e5).toISOString().slice(0,10)};
 const sunday=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1,+m.slice(8,10))+6*864e5).toISOString().slice(0,10);
 function table(ms,teams){const T=new Map(teams.map(t=>[t,{t,g:0,w:0,d:0,l:0,gf:0,ga:0,p:0}]));
  for(const m of ms){const h=T.get(m.h),a=T.get(m.a);h.g++;a.g++;h.gf+=m.hg;h.ga+=m.ag;a.gf+=m.ag;a.ga+=m.hg;
   if(m.hg>m.ag){h.p+=3;h.w++;a.l++}else if(m.hg<m.ag){a.p+=3;a.w++;h.l++}else{h.p++;a.p++;h.d++;a.d++}}
  return [...T.values()].sort((x,y)=>y.p-x.p||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||cmp(x.t,y.t))}
 /* every week's table of a season, built once */
 const built=new Map();
 function frames(F,id,si){const k=id+'|'+si+'|'+F.key;if(built.has(k))return built.get(k);
  const L=F.leagues[id],T=L.teams,s=L.seasons[si],ms=s.m.map(x=>({d:x[0],h:T[x[1]],a:T[x[2]],hg:x[3],ag:x[4]})).sort((a,b)=>cmp(a.d,b.d)),
   teams=[...new Set(ms.flatMap(m=>[m.h,m.a]))].sort(cmp),weeks=[...new Set(ms.map(m=>monday(m.d)))].sort();
  const fr=weeks.map(w=>{const end=sunday(w),up=ms.filter(m=>m.d<=end);return {w,end,n:up.length,tab:table(up,teams)}});
  const o={s:s.s,ms,teams,fr,max:Math.max(1,...fr.map(f=>f.tab[0].p)),N:ms.length};built.set(k,o);return o}
 R.race=async function(el){
  el.innerHTML='<h2>Title race</h2><div id="rcroot" class="ins lk rc"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#rcroot'),lg=D.id,tok=++S.tok;stop();
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The title race is not available right now.','سباق اللقب مو متوفر الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!F.leagues[S.lg]){S.lg=F.leagues[lg]?lg:Object.keys(F.leagues)[0];S.si=-1;S.fi=-1}
  draw(root,F);
 };
 function stop(){if(S.timer){clearInterval(S.timer);S.timer=0}}
 const ROW=40;
 function draw(root,F){
  stop();
  const L=F.leagues[S.lg];if(S.si<0||S.si>=L.seasons.length)S.si=L.seasons.length-1;
  const Q=frames(F,S.lg,S.si),n=Q.teams.length;
  if(!Q.fr.length){root.innerHTML=head(F)+`<div class="card"><div class="empty">${two('No matches in this season yet.','ما فيه مباريات في هالموسم للحين.')}</div></div>`;wire(root,F,Q);return}
  if(S.fi<0||S.fi>=Q.fr.length)S.fi=Q.fr.length-1;
  root.innerHTML=head(F)+`<div class="card rc-card"><div class="rc-bar2"><button type="button" id="rcp" class="rc-play" aria-label="${ar()?'تشغيل':'Play'}">▶</button><button type="button" id="rcr" class="s" aria-label="${ar()?'من البداية':'Restart'}">⟲</button>
    <div class="seg" id="rcspd" role="group" aria-label="${ar()?'السرعة':'Speed'}">${[1,2,4].map(x=>`<button type="button" data-s="${x}" aria-pressed="${S.speed===x}" class="${S.speed===x?'on':''}">${x}×</button>`).join('')}</div>
    <div class="seg" id="rcvw" role="group" aria-label="${ar()?'العرض':'View'}">${[['bars','Bars','أشرطة'],['table','Table','جدول']].map(([k,e,a])=>`<button type="button" data-v="${k}" aria-pressed="${S.view===k}" class="${S.view===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div>
    <label class="rc-sl"><span class="mu" id="rcl"></span><input id="rcw" type="range" min="0" max="${Q.fr.length-1}" value="${S.fi}" aria-label="${ar()?'الأسبوع':'Week'}"></label>
    <div class="rc-h" aria-hidden="true"><span class="rc-hr"></span><span class="rc-hn"></span><span class="rc-hb"></span><span class="rc-hs"><b>${two('P','ل')}</b><b class="rc-x">${two('W','ف')}</b><b class="rc-x">${two('D','ت')}</b><b class="rc-x">${two('L','خ')}</b><b>${two('GD','فر')}</b><b>${two('Pts','ن')}</b></span></div>
    <div class="rc-list ${S.view==='table'?'rc-tab':'rc-bars'}" id="rcl2" role="table" aria-label="${ar()?'الترتيب':'Table'}" style="height:${n*ROW}px">${Q.teams.map(t=>`<div class="rc-row" role="row" tabindex="0" data-t="${esc(t)}"><span class="rc-r"></span><span class="rc-n">${typeof hCrest==='function'?hCrest(t):''}<span class="rc-nm">${nm(t)}</span><span class="rc-mv"></span></span><span class="rc-b"><i></i></span><span class="rc-s"><b class="rc-p"></b><b class="rc-x rc-w"></b><b class="rc-x rc-d"></b><b class="rc-x rc-lo"></b><b class="rc-gd"></b><b class="rc-pts"></b></span></div>`).join('')}</div>
    <p class="rc-end mu" id="rce"></p>
    <p class="mu ins-note">${two('Each week is Monday to Sunday by the match date. The table after a week counts the matches played up to its Sunday (points, then goal difference, then goals scored). A postponed match leaves a club one game behind for a while: the P column shows it. The last week of a finished season is the real final table.','كل أسبوع من الإثنين للأحد حسب تاريخ المباراة. الترتيب بعد أسبوع يحسب المباريات اللي انلعبت لين أحده (النقاط، بعدين فرق الأهداف، بعدين الأهداف المسجلة). المباراة المؤجلة تخلي النادي متأخر مباراة لفترة: عمود ل يبيّنها. وآخر أسبوع في موسم منتهي هو الترتيب النهائي الحقيقي.')}</p></div>`;
  wire(root,F,Q);show(root,Q,S.fi,0);
 }
 function head(F){const ids=Object.keys(F.leagues),L=F.leagues[S.lg];
  return `<div class="card lk-intro"><p>${two('<b>Watch a season unfold.</b> The league table, week by week: bars that grow and clubs that overtake each other, or the table itself with its rows sliding to their new places. Click a club to follow it.','<b>شوف الموسم وهو يتحرك.</b> ترتيب الدوري أسبوع بأسبوع: أشرطة تكبر وأندية تتخطى بعض، أو الجدول نفسه وصفوفه تنزلق لمكانها الجديد. اضغط على نادي عشان تتابعه.')}</p></div>
   <div class="card tmc-pick"><div class="ctl"><select id="rcg" aria-label="${ar()?'الدوري':'League'}">${ids.map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select>
    <select id="rcs" aria-label="${ar()?'الموسم':'Season'}">${L.seasons.map((s,i)=>`<option value="${i}"${i===S.si?' selected':''}>${esc(s.s)}</option>`).join('')}</select></div></div>`}
 /* put every row where the week says: a transform, so the row slides; the bars and numbers follow */
 function show(root,Q,fi,from){
  const f=Q.fr[fi],prev=fi>0?Q.fr[fi-1].tab:null,rows=root.querySelectorAll('.rc-row'),list=root.querySelector('#rcl2');
  const pp=prev?new Map(prev.map((x,i)=>[x.t,i])):null,pos=new Map(f.tab.map((x,i)=>[x.t,i]));
  const dur=Math.round(Math.min(700,900/S.speed*.8));list.style.setProperty('--rct',dur+'ms');
  rows.forEach(r=>{const t=r.dataset.t,i=pos.get(t),x=f.tab[i],mv=pp&&from!==0?pp.get(t)-i:0;
   r.style.transform=`translateY(${i*ROW}px)`;r.dataset.pos=i+1;r.dataset.pts=x.p;r.setAttribute('aria-rowindex',i+1);
   r.setAttribute('aria-label',`${i+1}. ${t}, ${x.p}`);r.classList.toggle('rc-lead',i===0);r.classList.toggle('rc-pin',S.pin===t);r.classList.toggle('rc-dim',!!S.pin&&S.pin!==t);
   r.querySelector('.rc-r').textContent=i+1;r.querySelector('.rc-b i').style.width=(x.p/Q.max*100).toFixed(2)+'%';
   r.querySelector('.rc-p').textContent=x.g;r.querySelector('.rc-w').textContent=x.w;r.querySelector('.rc-d').textContent=x.d;r.querySelector('.rc-lo').textContent=x.l;
   r.querySelector('.rc-gd').textContent=(x.gf-x.ga>0?'+':x.gf-x.ga<0?'−':'')+Math.abs(x.gf-x.ga);r.querySelector('.rc-pts').textContent=x.p;
   const m=r.querySelector('.rc-mv');m.textContent=mv>0?'▲'+mv:mv<0?'▼'+(-mv):'';m.className='rc-mv'+(mv>0?' up':mv<0?' dn':'')});
  root.querySelector('#rcw').value=fi;
  root.querySelector('#rcl').innerHTML=`${two('Week to','الأسبوع لين')} <b>${nb(esc(f.end))}</b> · ${two(`${f.n} of ${Q.N} matches`,`${nb(f.n)} من ${nb(Q.N)} مباراة`)}`;
  const fin=fi===Q.fr.length-1,full=Q.N===Q.teams.length*(Q.teams.length-1),lead=f.tab[0];
  root.querySelector('#rce').innerHTML=fin?(full?two(`<b>${esc(lead.t)}</b> are the champions with ${lead.p} points.`,`<b>${nm(lead.t)}</b> أبطال الدوري بـ${nb(lead.p)} نقطة.`):two(`<b>${esc(lead.t)}</b> lead with ${lead.p} points; the season is not over.`,`<b>${nm(lead.t)}</b> في الصدارة بـ${nb(lead.p)} نقطة؛ والموسم ما خلص.`)):'';
  const b=root.querySelector('#rcp');b.textContent=S.timer?'❚❚':(fin?'▶':'▶');b.setAttribute('aria-label',S.timer?(ar()?'إيقاف':'Pause'):(ar()?'تشغيل':'Play'));
 }
 function wire(root,F,Q){
  const q=s=>root.querySelector(s);
  q('#rcg').onchange=e=>{S.lg=e.target.value;S.si=-1;S.fi=-1;S.pin='';draw(root,F)};
  q('#rcs').onchange=e=>{S.si=+e.target.value;S.fi=-1;S.pin='';draw(root,F)};
  if(!Q.fr.length)return;
  const go=(fi,from)=>{S.fi=fi;show(root,Q,fi,from)};
  const tick=()=>{if(!root.isConnected){stop();return}if(S.fi>=Q.fr.length-1){stop();show(root,Q,S.fi,1);return}go(S.fi+1,1);if(S.fi>=Q.fr.length-1){stop();show(root,Q,S.fi,1)}};
  const start=()=>{stop();if(S.fi>=Q.fr.length-1)go(0,0);S.timer=setInterval(tick,Math.round(900/S.speed));show(root,Q,S.fi,0)};
  q('#rcp').onclick=()=>{if(S.timer){stop();show(root,Q,S.fi,0)}else start()};
  q('#rcr').onclick=()=>{stop();go(0,0)};
  q('#rcw').oninput=e=>{stop();go(+e.target.value,1)};
  root.querySelectorAll('#rcspd button').forEach(b=>b.onclick=()=>{S.speed=+b.dataset.s;const run=!!S.timer;stop();draw(root,F);if(run)root.querySelector('#rcp').click()});
  root.querySelectorAll('#rcvw button').forEach(b=>b.onclick=()=>{S.view=b.dataset.v;root.querySelector('#rcl2').className='rc-list '+(S.view==='table'?'rc-tab':'rc-bars');root.querySelectorAll('#rcvw button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b))})});
  const pin=r=>{const t=r.dataset.t;S.pin=S.pin===t?'':t;show(root,Q,S.fi,0)};
  root.querySelectorAll('.rc-row').forEach(r=>{r.onclick=()=>pin(r);r.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pin(r)}}});
  /* leaving the page stops the clock */
  new MutationObserver((m,o)=>{if(!root.isConnected){stop();o.disconnect()}}).observe(document.body,{childList:true,subtree:true});
 }
 INS.ar({'Title race':'سباق اللقب'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
