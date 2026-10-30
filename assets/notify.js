/* ===== Notifications for your teams (a card under "Your teams" on the Overview) =====
   A static site cannot push to a phone, so the sync (sync.py, NOTIFY block) publishes each final score and a reminder an hour before kick-off to the free
   ntfy service, one public topic per team: pla-<namespace>-<slug of the name>. This card lists, for every team you starred, its topic with three ways to follow
   it in the ntfy app: open the app (ntfy:// link), open ntfy's web page, or copy the topic and paste it in the app. The namespace and server come from
   data/notify.json; without that file the card is not shown. Nothing about you is sent anywhere: the card only builds links from your starred teams, which stay
   in this browser. The slug here must be the same as notify_slug in sync.py (the test checks every team of the data against the Python one). */
(function(){
 if(typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nm=x=>`<bdi>${esc(x)}</bdi>`,nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const FOLD={'ø':'o','ł':'l','đ':'d','ð':'d','ß':'ss','æ':'ae','œ':'oe','þ':'th','ı':'i'};
 const slug=n=>{let s=String(n).toLowerCase();for(const k in FOLD)s=s.split(k).join(FOLD[k]);
  s=s.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,47).replace(/-+$/,'');return s||'team'};
 const topicOf=(ns,team)=>`pla-${ns}-${slug(team)}`;
 INS.notifySlug=slug;INS.notifyTopic=topicOf;
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
 /* host = the "Your teams" section; teams = [{l,t}] you starred. Safe to call again: the old card is replaced. */
 INS.notifyCard=async function(host,teams){
  if(!host)return;
  const old=host.querySelector('#ntfcard');
  if(!teams||!teams.length){if(old)old.remove();return}
  const C=await cfg();
  if(!host.isConnected)return;
  const again=host.querySelector('#ntfcard');if(again)again.remove();
  if(!C)return;
  const srv=new URL(C.server),seen=new Set();
  const list=teams.filter(f=>{const k=slug(f.t);if(seen.has(k))return false;seen.add(k);return true});
  const el=document.createElement('div');el.className='card ntf';el.id='ntfcard';
  el.innerHTML=`<h3>${two('Notifications for your teams','إشعارات فرقك')}</h3>
   <p>${two('Get each <b>final score</b> and a <b>reminder an hour before kick-off</b> on your phone, with the free <b>ntfy</b> app. No account. Scores arrive when the data does, from minutes to about an hour after the whistle: this is not goal-by-goal.',`تجيك <b>النتيجة النهائية</b> و<b>تذكير قبل المباراة بساعة</b> على جوالك عبر تطبيق <b>${nb('ntfy')}</b> المجاني. بدون حساب. النتائج تصل لما تنزل في البيانات، من دقائق إلى ساعة تقريبًا بعد صافرة النهاية: مو إشعار أهداف لحظي.`)}</p>
   <ol class="ntf-s"><li>${two('Install ntfy once:',`ثبّت ${nb('ntfy')} مرة وحدة:`)} ${STORES.map(([n,a,u])=>`<a class="ntf-st" href="${esc(u)}" target="_blank" rel="noopener">${a?two(n,a):nb(n)}</a>`).join(' ')}</li>
    <li>${two('Follow each of your teams (press one of the three):','تابع كل فريق من فرقك (اضغط وحدة من الثلاث):')}
     <ul class="ntf-l">${list.map(f=>{const t=topicOf(C.ns,f.t);return `<li class="ntf-r" data-t="${esc(f.t)}" data-topic="${esc(t)}"><span class="ntf-n">${nm(f.t)}</span>
      <span class="ntf-b"><a class="ntf-a" href="ntfy://${esc(srv.host)}/${esc(t)}">${two('Open in app','افتح بالتطبيق')}</a><a class="ntf-w" href="${esc(srv.origin)}/${esc(t)}" target="_blank" rel="noopener">${two('On the web','على الويب')}</a><button type="button" class="s ntf-c" data-topic="${esc(t)}">${two('Copy topic','انسخ القناة')}</button></span></li>`}).join('')}</ul></li></ol>
   <p class="mu ins-note">${two('If "Open in app" does nothing on your phone, copy the topic and paste it in ntfy (the + button). Each team has its own public topic: anyone who knows the name could read it or post to it, and nothing about you is stored. If two of your teams play each other you get the score twice.',`إذا «افتح بالتطبيق» ما سوّى شي في جوالك، انسخ القناة والصقها في ${nb('ntfy')} (زر ${nb('+')}). لكل فريق قناة عامة خاصة به: أي أحد يعرف اسمها يقدر يقرأها أو ينشر فيها، وما يتخزّن أي شي عنك. وإذا لعب فريقان من فرقك ضد بعض توصلك النتيجة مرتين.`)}</p>`;
  host.appendChild(el);
  el.querySelectorAll('.ntf-c').forEach(b=>b.onclick=async()=>{
   const keep=b.innerHTML;
   try{await copy(b.dataset.topic);b.innerHTML=two('Copied','تم النسخ')}catch(e){b.innerHTML=two('Copy failed','ما اننسخ')}
   setTimeout(()=>{if(b.isConnected)b.innerHTML=keep},1600)});
 };
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
