/* ===== Holographic cards: the player cards tilt and shine under the pointer, like a foil trading card =====
   Only a look (no data): on a .pc-card (Player cards page, the duel and the saved collection) the card turns a little towards the pointer
   (at most 9 degrees), a highlight follows it, and a foil of colours shifts across the card. The pointer position is written to the card as
   CSS variables (--mx, --my in %, --rx, --ry, --ma in degrees, --hv 0 to 1); nothing in the card's text or layout changes, and the saved image
   is not affected (it is drawn from the numbers, not from the page). With "reduce motion" the cards stay flat. */
(function(){
 if(typeof document==='undefined'||typeof matchMedia==='undefined')return;
 const MAX=9,RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 let cur=null;const box=new WeakMap();
 const reset=c=>{if(!c)return;box.delete(c);c.classList.remove('holo-on');['--rx','--ry','--mx','--my','--ma','--hv'].forEach(k=>c.style.removeProperty(k))};
 /* the card's box is taken while it is flat (a tilted card's box is a little bigger), once for each time the pointer comes in */
 const aim=(c,e)=>{let r=box.get(c);if(!r){r=c.getBoundingClientRect();box.set(c,r)}if(!r.width||!r.height)return;
  const x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
  c.classList.add('holo-on');c.style.setProperty('--mx',(x*100).toFixed(1)+'%');c.style.setProperty('--my',(y*100).toFixed(1)+'%');c.style.setProperty('--ma',Math.round(x*360)+'deg');
  c.style.setProperty('--ry',((x-.5)*2*MAX).toFixed(2)+'deg');c.style.setProperty('--rx',((.5-y)*2*MAX).toFixed(2)+'deg');c.style.setProperty('--hv','1')};
 document.addEventListener('pointermove',e=>{if(RM())return;const c=e.target&&e.target.closest?e.target.closest('.pc-card'):null;
  if(cur&&cur!==c){reset(cur);cur=null}if(c){cur=c;aim(c,e)}},{passive:true});
 const off=()=>{reset(cur);cur=null};
 document.addEventListener('pointerleave',off,true);document.addEventListener('pointercancel',off,true);
 document.addEventListener('pointerup',e=>{if(e.pointerType==='touch')off()},true);
 document.addEventListener('scroll',()=>{if(cur)off()},{passive:true,capture:true});
 window.addEventListener('blur',off);window.addEventListener('resize',off);
})();
