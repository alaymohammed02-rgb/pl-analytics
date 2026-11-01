/* ===== Season switcher: the current season (default) or a finished past season, next to the league selector =====
   data/index.json → seasons = {league: {cur, past: [{s, file, adv_file, …, matches, total, complete}]}} (sync: past seasons).
   The choice is kept on this device. A past season is shown by swapping the league's files for that season's files (same formats),
   so every page reads it the usual way; the page is reloaded on a switch so no page keeps a cache of the other season.
   Pages that need the coming fixtures, live data or Fantasy say plainly that they are not available for a past season.
   psView() (inline, before the first data load) builds the season view of the index; this file adds the selector, the banner
   and the page guard. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const base=()=>(typeof ALL0==='object'&&ALL0)||ALL||{};
 const entry=lid=>(base().seasons||{})[lid]||null;
 const shown=()=>(ALL&&ALL.season)||'';
 /* pages that cannot show a finished past season, and why */
 const NOT={fantasy:['Fantasy uses this season\'s official FPL data.','الفانتازي يستخدم بيانات FPL الرسمية لهذا الموسم.'],
  lab:['The Intelligence Lab works on this season\'s Fantasy data and coming gameweeks.','مختبر الذكاء يشتغل على بيانات الفانتازي لهذا الموسم والجولات الجاية.'],
  share:['Attack share links PitchAPI shots to this season\'s Fantasy players.','حصة الهجوم تربط تسديدات PitchAPI بلاعبي الفانتازي لهذا الموسم.'],
  beat:['Beat the model compares your picks with this season\'s Fantasy model.','تحدّى النموذج يقارن اختياراتك بنموذج الفانتازي لهذا الموسم.'],
  sim:['The simulator plays the rest of a season; a finished season has nothing left to play.','المحاكي يلعب باقي الموسم، والموسم المنتهي ما بقى فيه شي.'],
  xi:['Likely line-ups are for the coming matches.','التشكيلات المتوقعة للمباريات الجاية.'],
  preview:['Previews are for the coming matches.','المعاينة للمباريات الجاية.'],
  recap:['The full-time story reads the stories written for this season\'s matches.','قصة المباراة تقرأ القصص المكتوبة لمباريات هذا الموسم.'],
  runin:['The run-in uses today\'s ratings and the matches still to play this season.','باقي الموسم يستخدم تقييمات اليوم والمباريات اللي ما انلعبت بعد هذا الموسم.'],
  battle:['XI Battle uses the players\' numbers as of now.','معركة التشكيلات تستخدم أرقام اللاعبين الحالية.'],
  rare:['Very rare cases are worked out by the sync for the current season only.','الحالات النادرة تنحسب في المزامنة للموسم الحالي فقط.']};
 function store(s,lid){
  // the choice stays on this device; if storage is blocked, it lasts for this tab only
  let done=false;
  for(const st of [()=>localStorage,()=>sessionStorage])try{const o=st();if(s)o.setItem('season',s);else o.removeItem('season');if(lid)o.setItem('league',lid);done=true;break}catch(e){}
  try{window.name=s?'pla-season:'+s:''}catch(e){}
  return done;
 }
 function go(s,lid){store(s,lid);location.reload()}
 INS.seasonGo=go;
 /* the selector: current season first, then the past seasons the sync has for this league */
 function picker(){
  const lg=document.getElementById('lg');if(!lg||!D)return;
  const e=entry(D.id),cur=shown();
  let bar=document.getElementById('psbar');
  if(!e||!(e.past||[]).length){if(bar){bar.hidden=true;bar.innerHTML=''}return}
  // the base header ends with " · current season": in a past season that text would be wrong, so it is replaced by the selector
  [...lg.childNodes].forEach(n=>{if(n.nodeType===3&&/current season|الموسم الحالي/.test(n.textContent))n.remove()});
  // a past season may exist for one league only: the league selector still lists every league
  if(cur&&!document.getElementById('lgpick')&&(base().leagues||[]).length>1){
   lg.innerHTML='<select id="lgpick" style="min-height:32px;padding:4px 8px;max-width:200px"></select>';
  }
  if(!lg.querySelector('#sspick')){
   const sel=document.createElement('select');sel.id='sspick';sel.setAttribute('aria-label','Season');sel.title='Season';
   sel.innerHTML=`<option value="">${esc((e.cur?e.cur+' · ':'')+'current season')}</option>`+(e.past||[]).map(p=>`<option value="${esc(p.s)}">${esc(p.s)}</option>`).join('');
   sel.value=cur;sel.onchange=()=>go(sel.value,D.id);
   lg.appendChild(document.createTextNode(' '));lg.appendChild(sel);
  }
  // in a past season, the league selector lists every league: one without that season goes back to the current season
  const lp=document.getElementById('lgpick');
  if(lp&&cur&&base().leagues){
   lp.innerHTML=base().leagues.map(l=>`<option value="${esc(l.id)}"${l.id===D.id?' selected':''}>${esc(l.name)}${(entry(l.id)||{}).past&&entry(l.id).past.some(p=>p.s===cur)?'':' · '+esc((entry(l.id)||{}).cur||'current')}</option>`).join('');
   lp.onchange=()=>{const has=((entry(lp.value)||{}).past||[]).some(p=>p.s===cur);go(has?cur:'',lp.value)};
  }
  if(!bar)return;
  if(!cur){bar.hidden=true;bar.innerHTML='';return}
  const p=(e.past||[]).find(x=>x.s===cur)||{};
  bar.hidden=false;
  bar.innerHTML=`<div class="psb"><span>${two(`Showing the finished season <b>${nb(esc(cur))}</b> of <bdi>${esc(D.name)}</bdi>`,`تعرض الموسم المنتهي <b>${nb(esc(cur))}</b> من <bdi>${esc(D.name)}</bdi>`)}${p.complete?'':` <span class="mu">${p.total&&p.matches>=p.total?two(`(all ${nb(p.total)} matches fetched; line-ups, heat maps and advanced stats are still being added, so some pages are incomplete)`,`(انجلبت كل المباريات الـ${nb(p.total)}، والتشكيلات والحرارة والإحصائيات المتقدمة لسا تنضاف، فبعض الصفحات ناقصة)`):two(`(${nb(p.matches)} of ${nb(p.total||'?')} matches fetched so far)`,`(انجلبت ${nb(p.matches)} من ${nb(p.total||'?')} مباراة لين الحين)`)}</span>`}</span>`+
   `<button class="s" id="psback">${two('Back to the current season','رجوع للموسم الحالي')}</button></div>`;
  bar.querySelector('#psback').onclick=()=>go('',D.id);
 }
 const head0=head;
 head=function(){const r=head0.apply(this,arguments);try{picker()}catch(e){}return r};
 /* another page asking for a league that has no data for the season shown: go back to the current season for that league */
 const set0=setLeague;
 setLeague=async function(id){
  if(shown()&&id&&!(ALL.leagues||[]).some(l=>l.id===id)&&(base().leagues||[]).some(l=>l.id===id)){go('',id);return new Promise(()=>{})}
  return set0.apply(this,arguments);
 };
 /* the page guard: called by route() before a page is drawn */
 window.psGuard=function(pg,el){
  if(!shown()||!NOT[pg])return false;
  const n=(PAGES.find(p=>p[0]===pg)||[pg,pg])[1],w=NOT[pg];
  el.innerHTML=`<h2>${esc(n)}</h2><div class="card psna"><p><b>${two('Not available for a past season.','غير متاحة لموسم سابق.')}</b> ${two(w[0],w[1])}</p>`+
   `<p class="mu">${two(`You are looking at ${nb(esc(shown()))}.`,`أنت تشوف موسم ${nb(esc(shown()))}.`)}</p><button class="s" id="psback2">${two('Back to the current season','رجوع للموسم الحالي')}</button></div>`;
  el.querySelector('#psback2').onclick=()=>go('',D&&D.id);
  return true;
 };
 INS.ar({"current season":"الموسم الحالي","Season":"الموسم"});
 if(typeof D==='object'&&D){try{picker()}catch(e){}}
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
