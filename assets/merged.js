/* ===== Merged pages: two pages that answered neighbouring questions are now two tabs of one page =====
   Player twins + Look Like      (who plays like him: the quick version and the one where you choose the stats)
   Pressing + Pressing maps      (this season's pressing numbers, and StatsBomb's pressure maps)
   Settings + Data Availability  (the leagues and the sync, and which matches have complete data)
   Title race + Time machine     (the table week by week, and the table and the odds on any day)
   Nothing is removed: each tab is the old page, drawn by its own code in the space under the tab bar, and every old address (#/looklike, #/sbpress, #/data, #/timemachine) still opens the
   page on its own tab. The tab bar is a `.seg` group (so it has the Liquid Glass); choosing a tab goes to that tab's address. The merged-away names are no longer in the page list or the menu
   (assets/rooms.js treats them as tabs of the page that holds them). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof PAGES==='undefined')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const MERGES=[
  {host:'twins',label:['Player twins and Look Like','توائم اللاعبين وشبيه اللاعب'],tabs:[['twins','Quick','سريع'],['looklike','Choose your stats','اختر إحصائياتك']]},
  {host:'ppda',label:['Pressing','الضغط'],tabs:[['ppda','This season','هذا الموسم'],['sbpress','Pressure maps','خرائط الضغط']]},
  {host:'settings',label:['Settings and data','الإعدادات والبيانات'],tabs:[['settings','Settings','الإعدادات'],['data','Data availability','توفر البيانات']]},
  {host:'race',label:['Title race','سباق اللقب'],tabs:[['race','Week by week','أسبوع بأسبوع'],['timemachine','Time machine','آلة الزمن']]}];
 const orig={};
 MERGES.forEach(m=>m.tabs.forEach(([k])=>{if(typeof R[k]==='function')orig[k]=R[k]}));
 MERGES.forEach(m=>{
  if(!m.tabs.every(([k])=>orig[k]))return;   /* a half that is not there (a page another file did not register): leave the pair as it was */
  m.tabs.forEach(([key])=>{
   R[key]=async function(el,arg){
    el.innerHTML=`<div class="seg mg-tabs" role="group" aria-label="${ar()?m.label[1]:m.label[0]}" data-host="${m.host}">${m.tabs.map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${k===key}" class="${k===key?'on':''}">${two(e,a)}</button>`).join('')}</div><div class="mg-pane" id="mgp" data-k="${key}"></div>`;
    el.querySelectorAll('.mg-tabs button').forEach(b=>b.onclick=()=>{if(b.dataset.k!==key)location.hash='#/'+b.dataset.k});
    return orig[key].call(this,el.querySelector('#mgp'),arg);
   };
  });
  /* the merged-away pages leave the page list (their addresses stay) */
  m.tabs.slice(1).forEach(([k])=>{const i=PAGES.findIndex(p=>p[0]===k);if(i>=0)PAGES.splice(i,1)});
 });
 INS.merged={MERGES};
 if(typeof AR==='object')Object.entries({"Quick":"سريع","Choose your stats":"اختر إحصائياتك","This season":"هذا الموسم","Pressure maps":"خرائط الضغط","Data availability":"توفر البيانات","Week by week":"أسبوع بأسبوع","Time machine":"آلة الزمن"}).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
