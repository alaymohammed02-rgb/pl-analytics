/* ===== Logos and crest colours =====
   Club and league logos come from PitchAPI (the same provider as the data) and are stored by the sync in data/logos_<league>.json.
   A club without configured colours (THEME.clubs) takes its two dominant crest colours; the page palette is then built and
   checked by thPalette exactly as for every other theme. Without a logo, nothing changes. */
const LOGO={p:{},d:{}},CREST=new Map();
function logoLoad(){
 const id=D&&D.id,m=(ALL.leagues||[]).find(l=>l.id===id)||{};if(!id||!m.logo_file)return Promise.resolve(null);
 if(!LOGO.p[id])LOGO.p[id]=fetch('data/'+m.logo_file+'?v='+encodeURIComponent(m.logo_v||'')).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{LOGO.d[id]=d;return d});
 return LOGO.p[id];
}
const logoOf=name=>{const d=LOGO.d[D&&D.id];return (d&&d.teams&&d.teams[name])||null};
const leagueLogo=()=>{const d=LOGO.d[D&&D.id];return (d&&d.league)||null};
function logoHeader(){const im=document.getElementById('lglogo');if(!im)return;const s=leagueLogo();if(s){im.src=s;im.alt=D.name;im.hidden=false}else{im.removeAttribute('src');im.hidden=true}}
/* the crest's two dominant colours: pixels are grouped by hue (20° steps) and lightness, near-white/near-black/grey ones are set
   aside; a crest that is almost all black and white gives white and black */
function thCrest(src){return new Promise(res=>{const im=new Image();im.onload=()=>{try{
 const N=48,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,N,N);const p=x.getImageData(0,0,N,N).data;
 const B=new Map();let op=0,col=0,light=0,dark=0;
 for(let i=0;i<p.length;i+=4){if(p[i+3]<200)continue;op++;const hx='#'+[p[i],p[i+1],p[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''),[h,s,l]=thHsl(hx);
  if(l>.88)light++;else if(l<.14)dark++;if(s<.25||l<.14||l>.88)continue;col++;
  const k=(Math.round(h/20)%18)+'|'+(l<.42?0:1),b=B.get(k)||{n:0,r:0,g:0,b:0};b.n++;b.r+=p[i];b.g+=p[i+1];b.b+=p[i+2];B.set(k,b)}
 if(!op){res(null);return}
 const avg=b=>'#'+[b.r,b.g,b.b].map(v=>Math.round(v/b.n).toString(16).padStart(2,'0')).join(''),L=[...B.values()].sort((a,b)=>b.n-a.n);
 if(col/op<.08){res(light>=dark?['#ffffff','#000000']:['#000000','#ffffff']);return}
 const c1=avg(L[0]),h1=thHsl(c1)[0],sec=L.slice(1).find(b=>{const h=thHsl(avg(b))[0],d=Math.min(Math.abs(h-h1),360-Math.abs(h-h1));return d>30&&b.n>=L[0].n*.12});
 res([c1,sec?avg(sec):(light>=dark?'#ffffff':'#000000')])}catch(e){res(null)}};im.onerror=()=>res(null);im.src=src})}
/* colours of a club: configured kit colours first, else its crest (computed once) */
async function crestFor(name){
 if(THEME.clubs[String(name||'').toLowerCase().trim()])return;const k=(D&&D.id)+'|'+name;if(CREST.has(k))return;
 const s=logoOf(name);CREST.set(k,s?await thCrest(s):null);
}
const crestOf=name=>CREST.get((D&&D.id)+'|'+name)||null;
