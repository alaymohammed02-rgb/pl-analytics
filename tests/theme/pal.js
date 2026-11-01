const TH_NIGHT={bg:'#0a1a1e',sf:'#10282a',ln:'#27474a'};
/* shades for a whole page from one identity colour (HSL), each step checked for contrast; used for leagues and clubs */
const thHex=(h,s,l)=>{s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')};
const thHsl=hex=>{const [r,g,b]=thRgb(hex).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;
 if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return [h,s,l]};
/* lightest/darkest version of (h,s) that reaches the contrast ratio c against every background in bgs */
function thReach(h,s,l,bgs,c,up=true){for(let i=0;i<=100;i++){const x=thHex(h,s,up?l+i/100:l-i/100);if(bgs.every(b=>thCr(x,b)>=c))return x}return up?'#ffffff':'#000000'}
function thPalette(base,o={},alt=null){
 /* neutral clubs (black and white): the lighter colour leads */
 if(alt&&thHsl(base)[1]<.12&&thHsl(alt)[1]<.12&&thLum(alt)>thLum(base))[base,alt]=[alt,base];
 const [h,s0,l0]=thHsl(base),s=Math.min(s0,.92),neutral=s0<.12;
 const bg=TH_NIGHT.bg,sf=TH_NIGHT.sf,ln=TH_NIGHT.ln,B=[bg,sf];
 /* buttons: visible on the page (3:1) with readable text (4.5:1): the club's own colour, then a little darker or lighter, then its second colour */
 const okTh=x=>Math.min(thCr(x,bg),thCr(x,sf))>=3,inkOf=(x,other)=>[other,'#ffffff','#0b0b0b'].filter(Boolean).find(i=>thCr(i,x)>=4.5);
 let th=o.th,ink=th?inkOf(th):null;
 if(!th){const dk=Array.from({length:12},(_,i)=>[thHex(h,s0,l0-(i+1)/100),alt]),lt=n=>Array.from({length:n},(_,i)=>[thHex(h,s0,l0+(i+1)/100),alt]);
  const cands=[[base,alt],...dk,...lt(20),...(alt?[[alt,base]]:[]),...lt(60).slice(20)];
  for(const [c,other] of cands){const k=inkOf(c,other);if(okTh(c)&&k){th=c;ink=k;break}}
  if(!th){th=thReach(h,s,l0,B,3);ink=inkOf(th)||'#ffffff'}}
 return {bg,sf,ln,th,ink,tx:'#f3eef6',
  mu:o.mu||thReach(h,neutral?0:.25,.68,B,4.5),hi:o.hi||thReach(h,neutral?0:s,.55,B,3),link:o.link||thReach(h,neutral?0:Math.min(s,.85),.74,B,4.5),
  deep:o.deep||thHex(h,neutral?0:s,.2)};
}
