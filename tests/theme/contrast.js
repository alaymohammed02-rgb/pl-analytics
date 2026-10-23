const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const P=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));const bg='#0d1520',sf='#152130';let bad=0;
for(const [k,t] of Object.entries(P)){const r={ink_on_th:cr(t.ink,t.th),hi_on_bg:cr(t.hi,bg),hi_on_sf:cr(t.hi,sf),link_on_bg:cr(t.link,bg),link_on_sf:cr(t.link,sf)};
 const fail=[r.ink_on_th<4.5&&'ink/th',r.hi_on_bg<3&&'hi/bg',r.hi_on_sf<3&&'hi/sf',r.link_on_bg<4.5&&'link/bg',r.link_on_sf<4.5&&'link/sf'].filter(Boolean);if(fail.length)bad++;
 console.log(k.padEnd(10),Object.entries(r).map(([a,v])=>a+' '+v.toFixed(2)).join('  '),fail.length?'FAIL '+fail:'ok')}
process.exit(bad?1:0);
