/* ===== Offline note (a small bar at the bottom of every page) =====
   The service worker (sw.js) already lets the site open without a connection from the last copies it kept; what was missing is saying so, because old data can look fresh.
   When the browser reports no connection (navigator.onLine === false, at load or later), a bar says "You are offline: this is the last data saved on this device (updated <time> UTC)",
   using the data time the page itself holds (ALL.generated). When the connection comes back, the bar offers "Reload" for the latest data (or "Dismiss"). Nothing is fetched or stored:
   the bar only reads the browser's online / offline state, and it does not decide what the worker serves. */
(function(){
 if(typeof document==='undefined'||typeof navigator==='undefined')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const stamp=()=>{try{return String((typeof ALL==='object'&&ALL&&ALL.generated)||'').split('|')[0].trim()}catch(e){return ''}};
 let el=null,was=false,shown='',tm=null;
 /* the page's data time arrives a moment after the page itself: while the bar is up, it is written again once the time is known */
 function watch(){clearInterval(tm);let n=0;tm=setInterval(()=>{if(!el||el.hidden||!el.classList.contains('off')||++n>60){clearInterval(tm);return}const t=stamp();if(t&&t!==shown)show('off')},500)}
 function mk(){
  if(el&&el.isConnected)return el;
  el=document.createElement('div');el.id='offnote';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.hidden=true;
  document.body.appendChild(el);return el;
 }
 function show(kind){
  const b=mk(),t=stamp();
  if(kind==='off'){
   shown=t;
   b.className='off-n off';
   b.innerHTML=`<span class="off-t">${t?two(`You are offline: this is the last data saved on this device (updated ${t} UTC).`,`أنت بدون اتصال: هذي آخر بيانات انحفظت على هذا الجهاز (تحدّثت ${t} بتوقيت UTC).`):two('You are offline: this is the last data saved on this device.','أنت بدون اتصال: هذي آخر بيانات انحفظت على هذا الجهاز.')}</span>`;
  }else{
   b.className='off-n back';
   b.innerHTML=`<span class="off-t">${two('You are back online. Reload to get the latest data.','رجع الاتصال. حدّث الصفحة عشان تجيك آخر البيانات.')}</span><button type="button" class="off-r" id="offreload">${two('Reload','حدّث')}</button><button type="button" class="s off-x" id="offx">${two('Dismiss','إخفاء')}</button>`;
   b.querySelector('#offreload').onclick=()=>location.reload();
   b.querySelector('#offx').onclick=()=>{b.hidden=true};
  }
  b.hidden=false;
  if(kind==='off'&&!t)watch();
 }
 function sync(){
  if(navigator.onLine===false){was=true;show('off')}
  else if(was){was=false;show('back')}
  else if(el)el.hidden=true;
 }
 addEventListener('offline',sync);addEventListener('online',sync);
 const go=()=>{if(navigator.onLine===false){was=true;show('off')}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
 if(typeof INS==='object'&&INS)INS.offlineNote={show,sync};
})();
