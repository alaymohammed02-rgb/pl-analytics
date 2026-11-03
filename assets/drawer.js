/* ===== Menu drawer: one ☰ button in the header opens the site map: every room with its groups and pages (assets/rooms.js), and a box that filters them =====
   The hubs and their pages are read when the drawer opens (PAGES and UI_SEC, including pages other files add), so nothing
   is listed twice and no page is lost; the pages of a hub are tabs above the page (uiNav in the inline script). The home page stays the matches overview. The drawer opens from the reading side (left
   in English, right in Arabic), closes with ✕, the dimmed page behind it, Escape or any link, and gives focus back to ☰. */
(function(){
 if(typeof PAGES==='undefined')return;
 document.documentElement.classList.add('dr-on');
 const ICON={home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'};
 const cur=()=>{const p=(location.hash||'#/overview').split('/')[1]||'overview';return (typeof UI_ALIAS==='object'&&UI_ALIAS[p])||p};
 const secs=()=>{const S=typeof UI_SEC!=='undefined'?UI_SEC:[{k:'home',n:'Home',p:PAGES.map(p=>p[0]),ic:ICON.home}];
  const known=new Set(S.flatMap(s=>s.p)),name=new Map(PAGES.map(p=>[p[0],p[1]]));
  const out=S.map(s=>({k:s.k,n:s.n,ic:s.ic||'',p:s.p.filter(k=>name.has(k)).map(k=>[k,name.get(k)])}));
  const rest=PAGES.filter(p=>!known.has(p[0]));if(rest.length&&out[0])out[0].p.push(...rest.map(p=>[p[0],p[1]]));
  return out};
 let btn=null,box=null,ov=null,want=false;
 function build(){
  const top=document.querySelector('header .top');if(!top||document.getElementById('mnubtn'))return;
  btn=document.createElement('button');btn.type='button';btn.id='mnubtn';btn.className='s';btn.setAttribute('aria-label','Menu');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','drw');
  btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg><span class="mnu-t">Menu</span>';
  top.insertBefore(btn,top.firstChild);btn.addEventListener('click',()=>open(!document.documentElement.classList.contains('dr-open')));
  ov=document.createElement('div');ov.id='drwov';ov.hidden=true;ov.addEventListener('click',()=>open(false));
  box=document.createElement('aside');box.id='drw';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Menu');box.hidden=true;
  box.addEventListener('click',e=>{if(e.target.closest('a[href^="#/"]')){const w=typeof lgxHold==='function'?lgxHold():0;if(w)setTimeout(()=>open(false),w);else open(false)}});   /* closes once the Liquid Glass has reached the link */
  box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();open(false)}
   if(e.key==='Tab'){const f=[...box.querySelectorAll('a,button')];if(!f.length)return;const a=f[0],z=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}});
  document.body.append(ov,box);
  /* the brand goes home (the matches overview) */
  const br=top.querySelector('.brand');if(br&&!br.dataset.home){br.dataset.home='1';br.style.cursor='pointer';br.setAttribute('role','link');br.tabIndex=0;
   const go=()=>{location.hash='#/overview'};br.addEventListener('click',go);br.addEventListener('keydown',e=>{if(e.key==='Enter')go()})}
 }
 function fill(){
  const c=cur(),RM=typeof INS==='object'&&INS.rooms?INS.rooms:null;
  if(RM){
   /* the site map: every room, its groups and every page in it (nothing is left out: a page the table does not list goes to Home); a box filters the list */
   const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`,here=RM.ENT.get(c),known=RM.known();
   const extra=PAGES.filter(p=>!known.has(p[0]));
   box.innerHTML=`<div class="drw-h"><b>PL Analytics</b><button type="button" class="s drw-x" aria-label="Close menu">✕</button></div>
    <div class="drw-q"><input id="drwq" type="search" autocomplete="off" placeholder="Find a page" aria-label="Find a page"></div>
    <nav class="drw-n" aria-label="Pages">${RM.ROOMS.map(r=>`<section class="drw-s" data-room="${r.k}"><h3><a href="${RM.href(r)}" data-hub="${r.k}"${here&&here.room===r?' data-here="1"':''}>${two(esc(r.n[0]),esc(r.n[1]))}</a></h3><ul>${r.groups.map(g=>`<li class="drw-gh">${two(esc(g.n[0]),esc(g.n[1]))}</li>`+g.p.map(e=>`<li data-k="${e[0]}"><a href="#/${e[0]}"${e[0]===c?' class="on" aria-current="page"':''}>${RM.label(e[0])}</a></li>`).join('')).join('')}${r.k==='home'?extra.map(p=>`<li data-k="${esc(p[0])}"><a href="#/${esc(p[0])}">${esc(p[1])}</a></li>`).join(''):''}</ul></section>`).join('')}</nav>`;
   const q=box.querySelector('#drwq'),fold=x=>String(x||'').toLowerCase();
   q.addEventListener('input',()=>{const w=fold(q.value).trim().split(/\s+/).filter(Boolean);
    box.querySelectorAll('.drw-s').forEach(sec=>{let gh=null,ghAny=false,any=false;const flush=()=>{if(gh)gh.hidden=!!w.length&&!ghAny};
     sec.querySelectorAll('ul > li').forEach(li=>{if(li.classList.contains('drw-gh')){flush();gh=li;ghAny=false;return}
      const k=li.dataset.k,hit=!w.length||w.every(x=>fold(li.textContent).includes(x))||(RM.ENT.has(k)&&RM.pageHit(k,t=>w.every(y=>fold(t).includes(y))));li.hidden=!hit;if(hit){ghAny=true;any=true}});
     flush();sec.hidden=!!w.length&&!any})});
   box.querySelector('.drw-x').addEventListener('click',()=>open(false));
   return;
  }
  const S=secs(),hub=S.find(s=>s.p.some(([k])=>k===c))||S[0];
  box.innerHTML=`<div class="drw-h"><b>PL Analytics</b><button type="button" class="s drw-x" aria-label="Close menu">✕</button></div>
   <nav class="drw-n" aria-label="Pages"><section class="drw-s" data-s="hubs"><ul>${S.filter(s=>s.p.length).map(s=>{const last=typeof UI_LAST==='object'&&UI_LAST?UI_LAST[s.k]:null,t=s.p.some(([k])=>k===last)?last:s.p[0][0];
    return `<li><a href="#/${esc(t)}" data-hub="${esc(s.k)}"${s===hub?' class="on" aria-current="page"':''}>${esc(s.n)}</a></li>`}).join('')}</ul></section></nav>`;
  box.querySelector('.drw-x').addEventListener('click',()=>open(false));
 }
 function open(on){
  if(!box)return;const R=document.documentElement;
  want=!!on;
  if(on){fill();box.hidden=false;ov.hidden=false;requestAnimationFrame(()=>{if(want)R.classList.add('dr-open')});btn.setAttribute('aria-expanded','true');
   const f=box.querySelector('#drwq')||box.querySelector('a.on')||box.querySelector('a');if(f)f.focus({preventScroll:false})}
  else{if(!R.classList.contains('dr-open')&&box.hidden)return;   /* also when closed again before the opening frame: want is false then */R.classList.remove('dr-open');btn.setAttribute('aria-expanded','false');
   const done=()=>{if(!R.classList.contains('dr-open')){box.hidden=true;ov.hidden=true}};
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)done();else setTimeout(done,220);
   if(document.activeElement&&box.contains(document.activeElement))btn.focus()}
 }
 window.drwOpen=open;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.documentElement.classList.contains('dr-open'))open(false)});
 window.addEventListener('hashchange',()=>{if(!(typeof lgxHold==='function'&&lgxHold()))open(false)});
 build();
 if(!btn){const t=setInterval(()=>{build();if(btn)clearInterval(t)},200);setTimeout(()=>clearInterval(t),10000)}
 if(typeof AR==='object')Object.entries({"Menu":"القائمة","Close menu":"اقفل القائمة","Pages":"الصفحات"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
