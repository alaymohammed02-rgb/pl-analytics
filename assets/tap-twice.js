/* ===== Charts: the first tap on a player or a team shows what it is, the second opens its page =====
   Applies to links to a player page (#/player/…) or a team page (#/club/…) that sit in a chart: inside an SVG drawing, or on an
   element with a tooltip (data-tip). The first click (mouse or touch) keeps the page where it is: the tooltip stays and a hint
   says to tap again; a second click on the same item within ARM_MS opens the page. A click anywhere else or a page change
   cancels it; scrolling only hides the hint. Keyboard activation (Enter) opens at once, as a link should. Other links are left alone. */
(function(){
 const ARM_MS=10000;
 let armed=null,at=0,bub=null;
 const ar=()=>document.documentElement.lang==='ar';
 const hintText=a=>{const club=/^#\/club\//.test(a.getAttribute('href')||'');return ar()?(club?'اضغط مرة ثانية لفتح صفحة الفريق':'اضغط مرة ثانية لفتح صفحة اللاعب'):(club?'Tap again to open the team page':'Tap again to open the player page')};
 const inChart=a=>!!(a.closest('svg')||a.closest('[data-tip]')||a.querySelector('[data-tip]'));
 const tipOf=a=>{const t=a.closest('[data-tip]')||a.querySelector('[data-tip]');return t?t.getAttribute('data-tip').split('|')[0]:(a.textContent||'').trim()};
 function disarm(){if(armed)armed.classList.remove('tap-armed');armed=null;if(bub)bub.hidden=true;const h=document.querySelector('#instip .tap-hint');if(h)h.remove()}
 function arm(a,e){
  disarm();armed=a;at=Date.now();a.classList.add('tap-armed');
  const tip=document.getElementById('instip');
  if(tip&&tip.classList.contains('on')){const h=document.createElement('div');h.className='tap-hint';h.textContent='👆 '+hintText(a);tip.appendChild(h);return}
  /* no tooltip on screen: a small bubble of our own, with the item's name */
  if(!bub){bub=document.createElement('div');bub.id='tapbub';bub.setAttribute('role','status');document.body.appendChild(bub)}
  bub.innerHTML='';const b=document.createElement('b');b.textContent=tipOf(a);const h=document.createElement('div');h.className='tap-hint';h.textContent='👆 '+hintText(a);bub.append(b,h);bub.hidden=false;
  const r=a.getBoundingClientRect(),x=e&&e.clientX?e.clientX:r.left+r.width/2,y=e&&e.clientY?e.clientY:r.top,br=bub.getBoundingClientRect();
  bub.style.left=Math.max(8,Math.min(innerWidth-br.width-8,x-br.width/2))+'px';bub.style.top=Math.max(8,y-br.height-14)+'px';
 }
 document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a[href^="#/player/"],a[href^="#/club/"]');
  if(!a||!inChart(a)){if(armed)disarm();return}
  if(e.detail===0||e.ctrlKey||e.metaKey||e.shiftKey)return;          /* keyboard, or a new tab: open as usual */
  if(armed===a&&Date.now()-at<ARM_MS){disarm();return}               /* second tap: let the link open */
  e.preventDefault();e.stopPropagation();arm(a,e);
 },true);
 /* scrolling only hides the hint (the item stays ready for its second tap) */
 addEventListener('scroll',()=>{if(bub)bub.hidden=true},{passive:true});
 addEventListener('hashchange',disarm);
 window.tapDisarm=disarm;
})();
