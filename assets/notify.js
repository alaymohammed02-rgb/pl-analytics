/* ===== Notifications for your teams (a card under "Your teams" on the Overview) =====
   A static site cannot push to a phone by itself, so the sync (sync.py, NOTIFY block) is the sender, and this card has two doors:
   1. THIS DEVICE (a button, no app): "Turn on notifications" asks the browser's permission, subscribes the service worker (sw.js) to Web Push with the public
      VAPID key of data/push.json, seals the subscription and the names of the teams you follow with the public key `box` (ECDH P-256 + HKDF-SHA256 + AES-GCM,
      the same as push_open in sync.py) and drops it in the ntfy topic pla-<namespace>_inbox; only the sync can open it. Shown only when data/push_status.json says
      ready (the secret PUSH_KEYS is set on GitHub). Changing your starred teams sends the new list; "Turn off" unsubscribes and sends a removal.
   2. THE NTFY APP: for every starred team, its public topic pla-<namespace>-<slug> with an "Open in app" link, ntfy's web page and a copy button.
   Nothing about you is sent except that sealed message; your starred teams stay in this browser. The slug here must be the same as notify_slug in sync.py (the
   test checks every team of the data against the Python one). Without data/notify.json the card is not shown. */
(function(){
 if(typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nm=x=>`<bdi>${esc(x)}</bdi>`,nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const FOLD={'ø':'o','ł':'l','đ':'d','ð':'d','ß':'ss','æ':'ae','œ':'oe','þ':'th','ı':'i'};
 const slug=n=>{let s=String(n).toLowerCase();for(const k in FOLD)s=s.split(k).join(FOLD[k]);
  s=s.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,47).replace(/-+$/,'');return s||'team'};
 const topicOf=(ns,team)=>`pla-${ns}-${slug(team)}`;
 INS.notifySlug=slug;INS.notifyTopic=topicOf;
 const b64u=u8=>{let t='';u8.forEach(c=>t+=String.fromCharCode(c));return btoa(t).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
 const unb64u=t=>{t=t.replace(/-/g,'+').replace(/_/g,'/');t+='='.repeat((4-t.length%4)%4);return Uint8Array.from(atob(t),c=>c.charCodeAt(0))};
 /* seals an object for the sync: an ephemeral ECDH key, HKDF-SHA256 (info pla-push-v1), AES-256-GCM; {v,e,i,c} in base64url */
 async function seal(boxPub,obj){
  const srv=await crypto.subtle.importKey('raw',unb64u(boxPub),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const eph=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'ECDH',public:srv},eph.privateKey,256);
  const hk=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:new TextEncoder().encode('pla-push-v1')},hk,{name:'AES-GCM',length:256},false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(obj))));
  return {v:1,e:b64u(new Uint8Array(await crypto.subtle.exportKey('raw',eph.publicKey))),i:b64u(iv),c:b64u(ct)};
 }
 INS.pushSeal=seal;
 let PP=null,PK='';
 /* the public keys and whether the sync can send (data/push_status.json); a missing or failing file means "not ready" */
 function pushCfg(){
  if(PP&&PK===INS.poolKey())return PP;
  PK=INS.poolKey();
  const p=Promise.all([loadJson('push.json',ALL.generated).catch(()=>null),loadJson('push_status.json',ALL.generated).catch(()=>null)]).then(([k,s])=>k&&/^[\w-]{80,100}$/.test(k.vapid||'')&&/^[\w-]{80,100}$/.test(k.box||'')?{vapid:k.vapid,box:k.box,ready:!!(s&&s.ready===true)}:null).catch(()=>{if(PP===p)PP=null;return null});
  PP=p;return p;
 }
 const canPush=()=>typeof navigator==='object'&&'serviceWorker' in navigator&&typeof window.PushManager==='function'&&typeof window.Notification==='function';
 const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 async function swReg(){
  let r=await navigator.serviceWorker.getRegistration();
  if(!r)r=await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  return (await navigator.serviceWorker.getRegistration())||r;
 }
 const favNames=()=>{try{return (typeof window.favList==='function'?window.favList():[]).map(f=>f.t)}catch(e){return []}};
 /* drops the sealed message in the inbox topic; plain text, so the browser sends no preflight */
 async function drop(C,P,obj){
  const r=await fetch(new URL('/pla-'+C.ns+'_inbox',C.server).href,{method:'POST',body:JSON.stringify(await seal(P.box,obj))});
  if(!r.ok)throw new Error('inbox '+r.status);
 }
 /* the tone of the story sentences (calm analyst or match banter): kept in this browser, sent sealed with the subscription, read by the recap page too */
 const getTone=()=>{try{return localStorage.getItem('plx_tone')==='fun'?'fun':'calm'}catch(e){return 'calm'}};
 const setTone=t=>{try{localStorage.setItem('plx_tone',t==='fun'?'fun':'calm')}catch(e){}};
 const subMsg=sub=>({v:1,sub:sub.toJSON?sub.toJSON():sub,teams:favNames().slice(0,30),lang:(typeof ARL==='object'&&ARL.on)?'ar':'en',tone:getTone()});
 /* the teams changed while this device is subscribed: send the new list (the Overview card does not need to be open) */
 let RT=null;
 document.addEventListener('fav-change',()=>{clearTimeout(RT);RT=setTimeout(async()=>{try{
  if(!canPush()||Notification.permission!=='granted')return;
  const [C,P]=await Promise.all([cfg(),pushCfg()]);if(!C||!P||!P.ready)return;
  const reg=await navigator.serviceWorker.getRegistration();if(!reg)return;
  const sub=await reg.pushManager.getSubscription();if(sub)await drop(C,P,subMsg(sub));
 }catch(e){}},900)});
 let CP=null,CK='';
 function cfg(){
  if(CP&&CK===INS.poolKey())return CP;
  CK=INS.poolKey();
  const p=loadJson('notify.json',ALL.generated).then(d=>d&&/^[0-9a-f]{6,16}$/.test(d.ns||'')&&/^https?:\/\//.test(d.server||'')?d:null).catch(()=>{if(CP===p)CP=null;return null});
  CP=p;return p;
 }
 const STORES=[['Android','أندرويد','https://play.google.com/store/apps/details?id=io.heckel.ntfy'],['iPhone','آيفون','https://apps.apple.com/app/ntfy/id1625396347'],['F-Droid',null,'https://f-droid.org/packages/io.heckel.ntfy/']];
 function copy(text){
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);
  return new Promise((res,rej)=>{try{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();ok?res():rej()}catch(e){rej(e)}});
 }
 /* this device's door: the state is read from the browser (permission and subscription), never remembered separately */
 async function pushBox(box,C,P,teams,busy){
  const n=new Set(teams.map(f=>slug(f.t))).size;
  const msg=(en,ar)=>`<p class="ntf-m">${two(en,ar)}</p>`;
  const btn=(id,en,ar,cls)=>`<button type="button" class="${cls||'ntf-go'}" id="${id}"${busy?' disabled':''}>${two(en,ar)}</button>`;
  const head=`<h4>${two('On this device','على هذا الجهاز')}</h4>`;
  if(!canPush()){
   box.innerHTML=head+(isIOS()?msg('On iPhone and iPad this works only from the Home Screen: in Safari tap Share, then Add to Home Screen, open the site from the new icon and come back here (iOS 16.4 or later). Or use the ntfy app below.','على الآيفون والآيباد تشتغل بس من الشاشة الرئيسية: في سفاري اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية، افتح الموقع من الأيقونة الجديدة وارجع هنا (iOS ‏16.4 أو أحدث). أو استخدم تطبيق ntfy تحت.')
    :msg('This browser cannot receive notifications from a website. Use the ntfy app below, or open the site in Chrome, Edge, Firefox or Safari on a recent phone or computer.','هذا المتصفح ما يقدر يستقبل إشعارات من موقع. استخدم تطبيق ntfy تحت، أو افتح الموقع في كروم أو إيدج أو فايرفوكس أو سفاري في جوال أو كمبيوتر حديث.'));
   return 'none';
  }
  if(!P||!P.ready){
   box.innerHTML=head+msg('Browser notifications are not switched on for this site yet (its sender key has not been added). The ntfy app below works now.','إشعارات المتصفح لسا مو مفعّلة لهذا الموقع (مفتاح الإرسال ما انضاف). تطبيق ntfy تحت يشتغل الحين.');
   return 'notready';
  }
  if(Notification.permission==='denied'){
   box.innerHTML=head+msg('Notifications are blocked for this site in your browser settings. Allow them there, then reload this page.','الإشعارات محظورة لهذا الموقع في إعدادات المتصفح. اسمح فيها من هناك وبعدين حدّث الصفحة.');
   return 'denied';
  }
  let sub=null;
  try{if(Notification.permission==='granted'){const reg=await navigator.serviceWorker.getRegistration();sub=reg?await reg.pushManager.getSubscription():null}}catch(e){}
  if(sub){
   box.innerHTML=head+`<p class="ntf-m ntf-on">${two(`Notifications are <b>on</b> for this device (${n} ${n===1?'team':'teams'}). They start at the next sync, up to about an hour after you turn them on or change your teams.`,`الإشعارات <b>شغّالة</b> على هذا الجهاز (${nb(n)} ${n===1?'فريق':'فرق'}). تبدأ من المزامنة الجاية، لين ساعة تقريبًا بعد ما تفعّلها أو تغيّر فرقك.`)}</p>
    <p class="ntf-m">${two('Tone of the match story in your notifications:','نبرة قصة المباراة في إشعاراتك:')}</p>
    <div class="seg ntf-tone" id="ntftone" role="group" aria-label="Tone">${[['calm','Calm analyst','محلّل هادي'],['fun','Match banter','معلّق حماس']].map(([k,en,ar])=>`<button type="button" data-tone="${k}" aria-pressed="${getTone()===k}"${busy?' disabled':''}>${two(en,ar)}</button>`).join('')}</div>
    <p class="mu ntf-m">${two('Same facts and numbers either way. The ntfy app below always uses the calm one: its topics are public, so they do not know who reads them.','نفس الحقائق والأرقام في الحالتين. تطبيق ntfy تحت يبقى على النبرة الهادية دايماً: مواضيعه عامة وما تعرف مين يقراها.')}</p>${btn('ntfoff','Turn off','أوقفها','s ntf-off')}`;
   return 'on';
  }
  box.innerHTML=head+msg('Turn on notifications and this device gets the <b>final score</b> of your teams\' matches and a <b>reminder shortly before kick-off</b>, even when the site is closed. No app to install.','فعّل الإشعارات وهذا الجهاز تجيه <b>النتيجة النهائية</b> لمباريات فرقك و<b>تذكير قبل الانطلاق بشوي</b>، حتى لو الموقع مقفل. بدون تثبيت تطبيق.')+btn('ntfon','Turn on notifications','فعّل الإشعارات');
  return 'off';
 }
 function say(box,en,ar){const m=box.querySelector('.ntf-m')||box;const e=document.createElement('p');e.className='ntf-m ntf-err';e.setAttribute('role','alert');e.innerHTML=two(en,ar);box.appendChild(e)}
 /* host = the "Your teams" section; teams = [{l,t}] you starred. Safe to call again: the old card is replaced. */
 INS.notifyCard=async function(host,teams){
  if(!host)return;
  const old=host.querySelector('#ntfcard');
  if(!teams||!teams.length){if(old)old.remove();return}
  const [C,P]=await Promise.all([cfg(),pushCfg()]);
  if(!host.isConnected)return;
  const again=host.querySelector('#ntfcard');if(again)again.remove();
  if(!C)return;
  const srv=new URL(C.server),seen=new Set();
  const list=teams.filter(f=>{const k=slug(f.t);if(seen.has(k))return false;seen.add(k);return true});
  const el=document.createElement('div');el.className='card ntf';el.id='ntfcard';
  const pushOk=!!(P&&P.ready&&canPush());
  el.innerHTML=`<h3>${two('Notifications for your teams','إشعارات فرقك')}</h3>
   <p>${two('Get each <b>final score</b> and a <b>reminder before kick-off</b> for the teams you starred. Scores arrive when the data does, from minutes to about an hour after the whistle: this is not goal-by-goal.','تجيك <b>النتيجة النهائية</b> و<b>تذكير قبل المباراة</b> للفرق اللي حطيت لها نجمة. النتائج تصل لما تنزل في البيانات، من دقائق إلى ساعة تقريبًا بعد صافرة النهاية: مو إشعار أهداف لحظي.')}</p>
   <div class="ntf-p" id="ntfp"></div>
   <details class="ntf-alt"${pushOk?'':' open'}><summary>${two('Prefer the ntfy app?','تفضّل تطبيق ntfy؟')}</summary>
   <ol class="ntf-s"><li>${two('Install ntfy once:',`ثبّت ${nb('ntfy')} مرة وحدة:`)} ${STORES.map(([n,a,u])=>`<a class="ntf-st" href="${esc(u)}" target="_blank" rel="noopener">${a?two(n,a):nb(n)}</a>`).join(' ')}</li>
    <li>${two('Follow each of your teams (press one of the three):','تابع كل فريق من فرقك (اضغط وحدة من الثلاث):')}
     <ul class="ntf-l">${list.map(f=>{const t=topicOf(C.ns,f.t);return `<li class="ntf-r" data-t="${esc(f.t)}" data-topic="${esc(t)}"><span class="ntf-n">${nm(f.t)}</span>
      <span class="ntf-b"><a class="ntf-a" href="ntfy://${esc(srv.host)}/${esc(t)}">${two('Open in app','افتح بالتطبيق')}</a><a class="ntf-w" href="${esc(srv.origin)}/${esc(t)}" target="_blank" rel="noopener">${two('On the web','على الويب')}</a><button type="button" class="s ntf-c" data-topic="${esc(t)}">${two('Copy topic','انسخ القناة')}</button></span></li>`}).join('')}</ul></li></ol>
   <p class="mu ins-note">${two('If "Open in app" does nothing on your phone, copy the topic and paste it in ntfy (the + button). Each team has its own public topic: anyone who knows the name could read it or post to it, and nothing about you is stored. If two of your teams play each other you get the score twice. The reminder arrives an hour before kick-off.',`إذا «افتح بالتطبيق» ما سوّى شي في جوالك، انسخ القناة والصقها في ${nb('ntfy')} (زر ${nb('+')}). لكل فريق قناة عامة خاصة به: أي أحد يعرف اسمها يقدر يقرأها أو ينشر فيها، وما يتخزّن أي شي عنك. وإذا لعب فريقان من فرقك ضد بعض توصلك النتيجة مرتين. والتذكير يوصل قبل الانطلاق بساعة.`)}</p></details>`;
  host.appendChild(el);
  el.querySelectorAll('.ntf-c').forEach(b=>b.onclick=async()=>{
   const keep=b.innerHTML;
   try{await copy(b.dataset.topic);b.innerHTML=two('Copied','تم النسخ')}catch(e){b.innerHTML=two('Copy failed','ما اننسخ')}
   setTimeout(()=>{if(b.isConnected)b.innerHTML=keep},1600)});
  /* this device's door */
  const box=el.querySelector('#ntfp');
  const draw=async busy=>{await pushBox(box,C,P,list,busy);wire()};
  const wire=()=>{
   const on=box.querySelector('#ntfon'),off=box.querySelector('#ntfoff');
   if(on)on.onclick=async()=>{
    on.disabled=true;
    try{
     const perm=await Notification.requestPermission();
     if(perm!=='granted'){await draw(false);return}
     const reg=await swReg();
     let sub=await reg.pushManager.getSubscription(),fresh=false;
     if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:unb64u(P.vapid)});fresh=true}
     try{await drop(C,P,subMsg(sub))}catch(e){if(fresh){try{await sub.unsubscribe()}catch(x){}}throw e}
     await draw(false);
     try{await reg.showNotification(document.documentElement.lang==='ar'?'الإشعارات شغّالة':'Notifications are on',{body:document.documentElement.lang==='ar'?'بتوصلك نتائج فرقك وتذكير قبل مبارياتهم.':'You will get your teams\' results and a reminder before their matches.',icon:'assets/icons/icon-192.png',tag:'pla-welcome'})}catch(e){}
    }catch(e){await draw(false);say(box,'Could not turn notifications on ('+esc(String(e&&e.message||e).slice(0,80))+'). Try again in a moment.','ما قدرت أفعّل الإشعارات ('+nb(esc(String(e&&e.message||e).slice(0,80)))+'). جرّب بعد شوي.')}
   };
   box.querySelectorAll('#ntftone button').forEach(b=>b.onclick=async()=>{
    const t=b.dataset.tone;if(t===getTone())return;setTone(t);
    try{const reg=await navigator.serviceWorker.getRegistration(),sub=reg&&await reg.pushManager.getSubscription();if(sub)await drop(C,P,subMsg(sub))}catch(e){setTone(t==='fun'?'calm':'fun');await draw(false);say(box,'Could not save the tone. Try again in a moment.','ما قدرت أحفظ النبرة. جرّب بعد شوي.');return}
    await draw(false);
   });
   if(off)off.onclick=async()=>{
    off.disabled=true;
    try{
     const reg=await navigator.serviceWorker.getRegistration(),sub=reg&&await reg.pushManager.getSubscription();
     if(sub){const ep=sub.endpoint;await sub.unsubscribe();try{await drop(C,P,{v:1,remove:ep})}catch(e){}}
    }catch(e){}
    await draw(false);
   };
  };
  draw(false);
 };
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
