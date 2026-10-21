/* ===== Share as image: a card drawn on a canvas (PNG, 1080×1350) with the site's mark, shared or downloaded =====
   Used by the player page and the match centre. Only what the page already shows is drawn; nothing is fetched from new sources.
   Photos: player photos live on PitchAPI's CDN. A canvas that draws a picture from another site without permission (CORS)
   can no longer be exported, so a photo is drawn only if it loads with crossOrigin; otherwise the player's initials on the
   club colours. Crests are data URIs already in the page, so they are always safe.
   Sharing: the Web Share API with a file where the browser supports it (phones), otherwise the PNG is downloaded. */
(function(){
 const CW=1080,CH=1350,PAD=72;
 const tr=s=>(typeof ARL==='object'&&ARL.on&&typeof arT==='function')?(arT(s)||s):s;
 const rtl=()=>typeof ARL==='object'&&!!ARL.on;
 const css=(k,d)=>{try{const v=getComputedStyle(document.documentElement).getPropertyValue(k).trim()||getComputedStyle(document.getElementById('app')||document.body).getPropertyValue(k).trim();return v||d}catch(e){return d}};
 const FONT='system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",Tahoma,sans-serif';
 function loadImg(src,cors){
  return new Promise(res=>{if(!src)return res(null);const im=new Image();if(cors&&!/^data:/.test(src))im.crossOrigin='anonymous';
   const t=setTimeout(()=>res(null),6000);im.onload=()=>{clearTimeout(t);res(im)};im.onerror=()=>{clearTimeout(t);res(null)};im.src=src});
 }
 /* the canvas helpers handed to each card's draw function */
 function kit(ctx){
  const U={W:CW,H:CH,PAD,ctx,tr,rtl:rtl(),
   hi:css('--th-hi','#4cc38a'),tx:'#e8eef5',mu:'#8a9bb0',sf:'#152130',bg:'#0d1520',ln:'rgba(255,255,255,.10)',
   /* any CSS colour with an alpha: the canvas normalises opaque colours to #rrggbb */
   alpha(c,a){ctx.fillStyle='#000';ctx.fillStyle=c;const h=ctx.fillStyle;if(/^#[0-9a-f]{6}$/i.test(h))return 'rgba('+parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16)+','+a+')';return h},
   font(size,weight){ctx.font=`${weight||400} ${size}px ${FONT}`},
   /* text with an ellipsis when it is wider than max; align: left|right|center (left/right mirror in Arabic when mirror=true) */
   text(s,x,y,o){o=o||{};s=String(s==null?'':s);U.font(o.size||32,o.weight);ctx.fillStyle=o.color||U.tx;ctx.textBaseline=o.base||'alphabetic';
    let al=o.align||'left';if(o.mirror&&U.rtl)al=al==='left'?'right':al==='right'?'left':al;ctx.textAlign=al;ctx.direction=/[؀-ۿ]/.test(s)?'rtl':'ltr';
    if(o.max&&o.fit){let z=o.size||32;while(z>(o.fit===true?28:o.fit)&&ctx.measureText(s).width>o.max){z-=2;U.font(z,o.weight)}}
    if(o.max){while(s.length>1&&ctx.measureText(s).width>o.max)s=s.slice(0,-2)+'…'}
    if(o.stroke){ctx.lineJoin='round';ctx.lineWidth=o.sw||6;ctx.strokeStyle=o.stroke;ctx.strokeText(s,x,y)}ctx.fillText(s,x,y);return ctx.measureText(s).width},
   rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}},
   async crest(club,x,y,s){const src=typeof logoOf==='function'?logoOf(club):null;const im=await loadImg(src,false);if(im){const k=Math.min(s/im.width,s/im.height);ctx.drawImage(im,x+(s-im.width*k)/2,y+(s-im.height*k)/2,im.width*k,im.height*k);return true}
    const c=typeof clubColors==='function'?clubColors(club):null;ctx.beginPath();ctx.arc(x+s/2,y+s/2,s/2.4,0,7);ctx.fillStyle=(c&&c.c1)||U.mu;ctx.fill();return false},
   /* round player picture: the photo if it can be used on a canvas, else initials on the club colours (never a broken image) */
   async avatar(id,name,club,cx,cy,r){
    const c=typeof clubColors==='function'?clubColors(club):null;
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.clip();
    const g=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);g.addColorStop(0,(c&&c.c1)||'#25374d');g.addColorStop(.5,(c&&c.c1)||'#25374d');g.addColorStop(.5,(c&&c.c2)||'#152130');g.addColorStop(1,(c&&c.c2)||'#152130');
    ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,2*r,2*r);
    const ph=typeof HOME==='object'&&HOME.ph,u=ph&&ph.public&&ph.p&&ph.p[id];let im=u?await loadImg(u,true):null,used=false;
    if(im){try{const k=Math.max(2*r/im.width,2*r/im.height);ctx.drawImage(im,cx-im.width*k/2,cy-r*1.0-(im.height*k-2*r)*.15,im.width*k,im.height*k);used=true}catch(e){used=false}}
    if(!used){U.text(typeof hIni==='function'?hIni(name):String(name||'?').slice(0,2).toUpperCase(),cx,cy+r*.18,{size:Math.round(r*.62),weight:800,align:'center',color:'#fff',stroke:'rgba(0,0,0,.55)',sw:Math.max(4,r*.06)})}
    ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=4;ctx.stroke();
    await U.crest(club,cx+r*.48,cy+r*.48,r*.62);return used},
   /* a small chip: rating badge etc. */
   badge(v,x,y,o){o=o||{};const s=String(v);U.font(o.size||44,800);const w=Math.max(o.min||0,ctx.measureText(s).width+(o.padx||36));U.rr(x-(o.align==='right'?w:o.align==='center'?w/2:0),y,w,o.h||70,o.r||16,o.fill||U.hi);
    U.text(s,x+(o.align==='right'?-w/2:o.align==='center'?0:w/2),y+(o.h||70)/2+1,{size:o.size||44,weight:800,align:'center',base:'middle',color:o.color||'#0d1520'});return w}
  };
  return U;
 }
 /* rating colour, the usual 0-10 scale: red < 6, amber < 6.5, yellow-green < 7, green < 8, blue 8+ */
 window.ratingColor=v=>v==null?'#8a9bb0':v<6?'#e5646b':v<6.5?'#e98a4c':v<7?'#d8c24c':v<8?'#4cc38a':'#5aa9e6';
 /* spec: {name: file name, draw: async (ctx,U)=>{...}} → shares or downloads the PNG. Returns 'shared' | 'downloaded' | 'cancelled' | 'failed' */
 window.shareCard=async function(spec){
  const cv=document.createElement('canvas');cv.width=CW;cv.height=CH;const ctx=cv.getContext('2d');const U=kit(ctx);
  const g=ctx.createLinearGradient(0,0,CW,CH);g.addColorStop(0,'#13202f');g.addColorStop(1,'#0b121b');ctx.fillStyle=g;ctx.fillRect(0,0,CW,CH);
  const gl=ctx.createRadialGradient(CW*.85,CH*.05,10,CW*.85,CH*.05,CW*.9);gl.addColorStop(0,U.alpha(U.hi,.33));gl.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gl;ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle=U.hi;ctx.fillRect(0,0,CW,10);
  try{await spec.draw(ctx,U)}catch(e){console.warn('share card',e);return 'failed'}
  /* the site's mark */
  ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(0,CH-96,CW,96);
  U.text('PL Analytics',PAD,CH-38,{size:34,weight:800,color:U.tx});
  U.text(tr('Data: PitchAPI')+' · '+(location.host||'')+(location.pathname||'').replace(/index\.html$/,''),CW-PAD,CH-38,{size:24,color:U.mu,align:'right',max:CW-2*PAD-300});
  let blob=null;try{blob=await new Promise(r=>cv.toBlob(r,'image/png'))}catch(e){blob=null}
  if(!blob)return 'failed';
  const fn=(String(spec.name||'pl-analytics').replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'')||'pl-analytics')+'.png';
  try{const file=new File([blob],fn,{type:'image/png'});
   if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){await navigator.share({files:[file],title:spec.title||'PL Analytics'});return 'shared'}}
  catch(e){if(e&&e.name==='AbortError')return 'cancelled'}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);return 'downloaded';
 };
 /* the button the pages put next to their title: <button class="shr-btn" data-share="...">Share as image</button> */
 window.shareBtn=(key,label)=>`<button type="button" class="s shr-btn" data-share="${typeof esc==='function'?esc(key):key}" aria-label="${label||'Share as image'}">⤴ <span>${label||'Share as image'}</span></button>`;
 window.shareWire=(root,fn)=>{root.querySelectorAll('.shr-btn').forEach(b=>{if(b.dataset.wired)return;b.dataset.wired='1';b.onclick=async()=>{if(b.disabled)return;b.disabled=true;const old=b.innerHTML;b.innerHTML='… <span>Preparing image</span>';
   let r='failed';try{r=await fn(b.dataset.share)}catch(e){r='failed'}b.disabled=false;b.innerHTML=old;
   if(r==='downloaded'||r==='failed'){const n=document.createElement('span');n.className='mu shr-msg';n.textContent=r==='downloaded'?'Image saved to your downloads.':'Could not make the image on this browser.';b.after(n);setTimeout(()=>n.remove(),4000)}}})};
 if(typeof AR==='object')Object.entries({
  "Share as image":"شارك كصورة","Preparing image":"نجهّز الصورة","Image saved to your downloads.":"انحفظت الصورة في التنزيلات.",
  "Could not make the image on this browser.":"ما قدرنا نسوي الصورة على هذا المتصفح.","Data: PitchAPI":"البيانات: PitchAPI"
 }).forEach(([k,v])=>{if(!(k in AR))AR[k]=v});
})();
