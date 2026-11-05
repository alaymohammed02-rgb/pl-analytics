/* ===== Matches page (#/matches): Upcoming and Results, one tap apart =====
   The page used to show 24 upcoming fixtures first and the results far below as a plain table, so past matches were hard to find. It now has two tabs (a `.seg` bar, so it has the Liquid
   Glass): "Upcoming" (the fixtures section as it was: data/fixtures.json, kick-off in the viewer's time zone) and "Results": every finished match of the open league, newest day first, in
   the same cards as the club page's Matches tab, side by side in a strip that swipes left and right (home name and crest, the score, away crest and name; the winner in bold; a tap opens the match page), grouped by day, 40 at a time with
   "Show more", and a club choice that keeps only that club's matches. The tab is kept in this browser (plx_mp) when it has something to show; a season with no fixture list opens on Results.
   Nothing is added to the data: the results are the league file's finished matches. */
(function(){
 if(typeof R!=='object'||typeof R.matches!=='function'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const PAGE=40;
 const S={club:'',n:PAGE};
 const dUTC=s=>new Date(s+'T12:00:00Z').toLocaleDateString(ar()?'ar':'en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
 const crest=n=>{const u=typeof logoOf==='function'?logoOf(n):'';return u?`<img class="ctm-c" src="${esc(u)}" alt="" aria-hidden="true" loading="lazy">`:`<i class="ctm-c ctm-nc" aria-hidden="true"></i>`};
 const getTab=()=>{try{return localStorage.getItem('plx_mp')==='res'?'res':'up'}catch(e){return 'up'}};
 const setTab=k=>{try{localStorage.setItem('plx_mp',k)}catch(e){}};
 const finished=()=>D.matches.filter(m=>m.date&&wkSc(m.score)).map(m=>({id:m.match_id,d:String(m.date).slice(0,10),h:m.home,a:m.away,s:wkSc(m.score)}))
  .sort((a,b)=>b.d<a.d?-1:b.d>a.d?1:(b.id<a.id?-1:b.id>a.id?1:0));
 function results(list){
  const show=list.slice(0,S.n);
  if(!show.length)return `<div class="empty">${two('No finished matches match this choice.','ما فيه مباريات منتهية تطابق هالاختيار.')}</div>`;
  const body=show.map(x=>{const w=x.s[0]>x.s[1]?'h':x.s[0]<x.s[1]?'a':'';
   let cls='n';if(S.club&&(x.h===S.club||x.a===S.club)){const gf=x.h===S.club?x.s[0]:x.s[1],ga=x.h===S.club?x.s[1]:x.s[0];cls=gf>ga?'w':gf<ga?'l':'d'}
   return `<a class="ctm-m mpm" href="#/match/${encodeURIComponent(x.id)}" data-id="${esc(x.id)}" data-d="${esc(x.d)}" data-h="${esc(x.h)}" data-a="${esc(x.a)}" data-score="${x.s[0]}-${x.s[1]}" data-res="${cls}"><div class="ctm-d"><span class="ctm-dd">${dUTC(x.d)}</span></div><div class="ctm-r"><span class="ctm-h${w==='h'?' mpw':''}">${nm(x.h)}</span>${crest(x.h)}<b class="ctm-s ${cls}">${nb(x.s[0]+' - '+x.s[1])}</b>${crest(x.a)}<span class="ctm-a${w==='a'?' mpw':''}">${nm(x.a)}</span></div></a>`}).join('');
  return `<div class="mp-hs" id="mphs" tabindex="0" role="region" aria-label="${ar()?'المباريات السابقة':'Previous matches'}">${body}${list.length>show.length?`<button type="button" class="s ctm-more mp-more" id="mpmore">${two('Show more','أظهر أكثر')}</button>`:''}</div>`;
 }
 const orig=R.matches;
 R.matches=async function(el){
  const lg=D.id,all=finished();
  const up=await (typeof fxSection==='function'?fxSection(D.id):Promise.resolve(''));
  if(!el.isConnected||D.id!==lg||!/^#\/matches/.test(location.hash||'#/matches'))return;
  const hasUp=/class="fx"/.test(up);
  let tab=hasUp?getTab():'res';if(!all.length)tab='up';
  const clubs=[...new Set(all.flatMap(x=>[x.h,x.a]))].sort((a,b)=>a<b?-1:a>b?1:0);
  if(S.club&&!clubs.includes(S.club))S.club='';
  el.innerHTML=`<h2>Matches</h2>
   <div class="seg mp-tabs" id="mptabs" role="group" aria-label="${ar()?'المباريات':'Matches'}">${[['up','Upcoming','القادمة'],['res','Results','النتائج']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${tab===k}" class="${tab===k?'on':''}">${two(e,a)}</button>`).join('')}</div>
   <div id="mpr"${tab==='res'?'':' hidden'}>${hasUp?'':`<p class="mu mp-nf">${two('No fixture list in the data yet.','ما فيه جدول مباريات في البيانات للحين.')}</p>`}<div class="card mp-f"><label class="dcx-l"><span class="mu">${two('Club','النادي')}</span><select id="mpc"><option value="">${ar()?'كل الأندية':'All clubs'}</option>${clubs.map(c=>`<option value="${esc(c)}"${S.club===c?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <span class="mu mp-n" id="mpcount" data-n="0"></span></div><div class="card ctm mp-l" id="mpl"></div></div>
   <div id="mpu"${tab==='up'?'':' hidden'}>${up||`<div class="empty">${two('No fixture list in the data yet.','ما فيه جدول مباريات في البيانات للحين.')}</div>`}</div>
  `;
  const q=s=>el.querySelector(s);
  const fill=()=>{
   const list=S.club?all.filter(x=>x.h===S.club||x.a===S.club):all;
   q('#mpl').innerHTML=`<div class="mp-hd"><h3>${two('Previous matches','المباريات السابقة')}</h3><span class="mp-ar"><button type="button" class="s" id="mpnew" aria-label="${ar()?'الأحدث':'Newer'}">‹</button><button type="button" class="s" id="mpold" aria-label="${ar()?'الأقدم':'Older'}">›</button></span></div>`+results(list);
   const hs=q('#mphs');if(hs){const go=d=>hs.scrollBy({left:d*hs.clientWidth*.8*(ar()?-1:1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});q('#mpnew').onclick=()=>go(-1);q('#mpold').onclick=()=>go(1)}q('#mpcount').dataset.n=list.length;q('#mpcount').innerHTML=two(`${list.length} matches`,`${nb(list.length)} مباراة`);
   const mo=q('#mpmore');if(mo)mo.onclick=()=>{S.n+=PAGE;fill()};
  };
  fill();
  q('#mpc').onchange=e=>{S.club=e.target.value;S.n=PAGE;fill()};
  q('#mptabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{
   const k=b.dataset.k;setTab(k);
   q('#mptabs').querySelectorAll('button').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
   q('#mpu').hidden=k!=='up';q('#mpr').hidden=k!=='res';
  });
 };
 INS.matchesPage={finished,orig};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
