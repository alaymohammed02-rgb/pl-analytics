/* ===== "Scores" look (opt-in): the traits of a scores app, added beside the Night pitch look, never instead of it =====
   Off by default. Turned on from the menu drawer (a "Look" button), or with ?style=fm in the address (?style=night turns it off); the choice is kept in this browser
   (localStorage `plx_style`: "fm" or "night") and shows as the class `fm` on <html>. Everything visual is CSS under `html.fm` at the end of assets/identity.css
   (pure black page, flat grey surfaces, one green accent, 16 px corners; no size or position of a button, row, tab or bar changes). This file adds only two pieces:
   - Your teams as colour tiles (Overview, under "Your teams"): one tile per team you star, filled with the club's own colour (clubColors, the site's own measure), its crest
     when the data has one (never a picture from another site), its name and its next match from data/fixtures.json (nothing is written when there is none);
   - a bottom bar on phones (up to 640 px): Home, Season, Teams, Fantasy and More (opens the menu). It is built from UI_SEC, like the drawer, and opens the page last open
     in the hub (UI_LAST); the hub of the open page is marked.
   Nothing is stored or fetched except the choice and the fixtures file the site already loads. */
(function(){
 'use strict';
 if(window.__fmStyle)return;window.__fmStyle=1;
 const KEY='plx_style',R=document.documentElement;
 const on=()=>{try{return localStorage.getItem(KEY)==='fm'}catch(e){return false}};
 try{const q=new URLSearchParams(location.search).get('style');if(q==='fm'||q==='night')localStorage.setItem(KEY,q)}catch(e){}
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lc=()=>R.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
 const TABS=['home','season','teams','fpl'];   /* the four hubs on the bar; the fifth place is More */
 if(typeof INS==='object'&&typeof INS.ar==='function')INS.ar({'Scores-app look':'مظهر تطبيق النتائج','Night pitch look':'مظهر الملعب الليلي','Look':'المظهر','More':'المزيد','Next match':'المباراة القادمة','Remove':'إزالة'});

 /* ---------- the switch (a row at the end of the menu drawer) ---------- */
 function switchRow(){
  const box=document.getElementById('drw');if(!box||box.querySelector('.fm-sw'))return;
  const d=document.createElement('div');d.className='fm-sw';
  d.innerHTML=`<span class="fm-sw-t">Look</span><button type="button" class="s" aria-pressed="${on()}">${on()?'Night pitch look':'Scores-app look'}</button>`;
  d.querySelector('button').addEventListener('click',()=>set(!on()));
  box.appendChild(d);
 }
 let drObs=null;
 function watchDrawer(){
  const box=document.getElementById('drw');
  if(!box){const o=new MutationObserver(()=>{if(document.getElementById('drw')){o.disconnect();watchDrawer()}});o.observe(document.body,{childList:true});return}
  if(drObs)return;
  switchRow();drObs=new MutationObserver(()=>switchRow());drObs.observe(box,{childList:true});
 }

 /* ---------- the bottom bar ---------- */
 const secs=()=>typeof UI_SEC!=='undefined'&&Array.isArray(UI_SEC)?UI_SEC:[];
 const pageOf=()=>typeof uiPage==='function'?uiPage():((location.hash||'#/overview').split('/')[1]||'overview');
 const hubOf=()=>{const p=pageOf(),a=(typeof UI_ALIAS==='object'&&UI_ALIAS[p])||p,s=secs().find(x=>x.p.includes(a));return s?s.k:'home'};
 const target=s=>{const last=typeof UI_LAST==='object'&&UI_LAST?UI_LAST[s.k]:null;return s.p.includes(last)?last:s.p[0]};
 const MORE='<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>';
 function bar(){
  let nav=document.getElementById('fmbar');
  if(!on()){if(nav)nav.remove();return}
  const S=secs();if(!S.length)return;
  if(!nav){nav=document.createElement('nav');nav.id='fmbar';nav.setAttribute('aria-label','Main');document.body.appendChild(nav);
   nav.addEventListener('click',e=>{const m=e.target.closest('[data-more]');if(m){const b=document.getElementById('mnubtn');if(b)b.click()}})}
  const cur=hubOf();
  nav.innerHTML=TABS.map(k=>S.find(s=>s.k===k)).filter(Boolean).map(s=>`<a href="#/${esc(target(s))}" data-hub="${esc(s.k)}"${s.k===cur?' aria-current="page"':''}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${s.ic||''}</svg><span>${esc(s.n)}</span></a>`).join('')
   +`<button type="button" data-more="1" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${MORE}</svg><span>More</span></button>`;
 }

 /* ---------- Your teams as colour tiles ---------- */
 const lum=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return 0;const n=parseInt(m[1],16),f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255)};
 const crest=(lid,name)=>{try{const d=typeof LOGO==='object'&&LOGO.d&&LOGO.d[lid];return (d&&d.teams&&d.teams[name])||null}catch(e){return null}};
 const colour=name=>{try{const c=typeof clubColors==='function'?clubColors(name):null;return c&&c.c1?c.c1:null}catch(e){return null}};
 let FX=null;
 const fixtures=()=>{if(FX)return FX;FX=(typeof fixLoad==='function'?fixLoad():Promise.resolve(null)).catch(()=>null);return FX};
 function nextOf(fx,name){
  const now=Date.now();let best=null;
  Object.values((fx&&fx.leagues)||{}).forEach(L=>(L||[]).forEach(f=>{if(f.h!==name&&f.a!==name)return;const t=Date.parse(f.k);if(isNaN(t)||t<now-2*36e5)return;if(!best||t<best.t)best={t,h:f.h,a:f.a}}));
  return best;
 }
 const when=t=>{const d=new Date(t),n=new Date(),k=x=>x.getFullYear()+'-'+x.getMonth()+'-'+x.getDate(),tm=d.toLocaleTimeString(lc(),{hour:'numeric',minute:'2-digit'});
  const tom=new Date(n.getTime()+864e5);
  if(k(d)===k(n))return (R.lang==='ar'?'اليوم، ':'Today, ')+tm;if(k(d)===k(tom))return (R.lang==='ar'?'غدًا، ':'Tomorrow, ')+tm;
  return d.toLocaleDateString(lc(),{weekday:'short',day:'numeric',month:'short'})+', '+tm};
 let busy=false;
 async function tiles(){
  const box=document.getElementById('ovteams');if(!box)return;
  const sec=box.querySelector('.ovt');if(!sec)return;
  let g=sec.querySelector('.fm-tiles');
  if(!on()){if(g)g.remove();return}
  const T=typeof favList==='function'?favList():[];
  if(!T.length){if(g)g.remove();return}
  if(busy)return;busy=true;
  try{
   const fx=await fixtures();if(!box.isConnected)return;
   const html=T.map(f=>{
    const c=colour(f.t),bg=c||'#1d1d1d',dark=c?lum(c)>.4:false,cr=crest(f.l,f.t),nx=nextOf(fx,f.t),opp=nx?(nx.h===f.t?nx.a:nx.h):'';
    return `<div class="fm-tile${dark?' dk':''}" style="--fm-bg:${esc(bg)}"><a class="fm-a" href="#/club/${encodeURIComponent(f.t)}" data-flid="${esc(f.l)}">
      ${cr?`<img class="fm-cr" src="${esc(cr)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:`<span class="fm-cr fm-in" aria-hidden="true">${esc(String(f.t).trim().slice(0,1))}</span>`}
      <b class="fm-n">${esc(f.t)}</b>
      ${nx?`<span class="fm-nx"><span class="fm-w">${esc(when(nx.t))}</span><span class="fm-o">${nx.h===f.t?'vs':'@'} ${esc(opp)}</span></span>`:''}
     </a><button type="button" class="fm-x" data-fx="${esc(f.t)}" data-fl="${esc(f.l)}" aria-label="Remove ${esc(f.t)}">×</button></div>`}).join('');
   const live=sec.querySelector('.fm-tiles');
   if(live){if(live.dataset.sig===html)return;live.remove()}
   g=document.createElement('div');g.className='fm-tiles';g.dataset.sig=html;g.innerHTML=html;
   const after=sec.querySelector('.hhd');if(after)after.after(g);else sec.prepend(g);
   g.querySelectorAll('[data-fx]').forEach(b=>b.addEventListener('click',()=>{if(typeof favToggle==='function')favToggle(b.dataset.fl,b.dataset.fx)}));
  }finally{busy=false}
 }
 let tObs=null,poll=null;
 function watchTeams(){
  const box=document.getElementById('ovteams');
  if(!box||tObs&&tObs.box===box)return;
  if(tObs)tObs.o.disconnect();
  /* the Overview redraws the whole teams section (innerHTML) when a team is added or removed: direct children only, so the tiles placed inside it never wake this again */
  const o=new MutationObserver(()=>{if(on()&&box.querySelector('.ovt')&&!box.querySelector('.fm-tiles'))tiles()});
  o.observe(box,{childList:true});tObs={o,box};tiles();
 }
 /* the Overview draws its sections after its data arrives: look for the teams section every 0.4 s (up to 24 s) after a page change, only while the look is on */
 function pollTeams(){
  if(poll){clearInterval(poll);poll=null}
  if(!on())return;
  let n=0;poll=setInterval(()=>{n++;watchTeams();const b=document.getElementById('ovteams');
   if(b&&tObs&&tObs.box===b||n>60){clearInterval(poll);poll=null}},400);
 }

 /* ---------- on / off and the page changes that need the pieces again ---------- */
 function set(v){try{localStorage.setItem(KEY,v?'fm':'night')}catch(e){}apply();const b=document.querySelector('#drw .fm-sw button');if(b){b.textContent=v?'Night pitch look':'Scores-app look';b.setAttribute('aria-pressed',String(v))}}
 function apply(){
  R.classList.toggle('fm',on());
  bar();tiles();pollTeams();
  const m=document.querySelector('meta[name=theme-color]');if(m){if(!m.dataset.o)m.dataset.o=m.content;m.content=on()?'#000000':m.dataset.o}
 }
 window.addEventListener('hashchange',()=>{setTimeout(bar,0);setTimeout(bar,350);pollTeams()});
 document.addEventListener('fav-change',()=>setTimeout(tiles,0));
 apply();watchDrawer();
 window.FM={on,set};
})();
