const fs=require('fs');eval(fs.readFileSync(__dirname+'/theme.js','utf8').split('/* ---------- defending champions')[0].replace(/^const THEME=/m,'globalThis.THEME=')+fs.readFileSync(__dirname+'/pal.js','utf8')+';globalThis.thPalette=thPalette;globalThis.thCr=thCr;globalThis.thHsl=thHsl;globalThis.thLum=thLum');
const ST={g:'#4cc38a',r:'#e5646b',a:'#e9b44c',b:'#5aa9e6'};let bad=0;
const chk=(k,p)=>{const B=[p.bg,p.sf],m=x=>Math.min(...B.map(b=>thCr(x,b)));const r={btn:m(p.th),tx:m(p.tx),mu:m(p.mu),hi:m(p.hi),link:m(p.link),ink:thCr(p.ink,p.th),...Object.fromEntries(Object.entries(ST).map(([n,c])=>['st_'+n,m(c)]))};
 const f=[r.btn<3&&'button',r.tx<7&&'tx',r.mu<4.5&&'mu',r.hi<3&&'hi',r.link<4.5&&'link',r.ink<4.5&&'ink',...Object.keys(ST).filter(n=>r['st_'+n]<3).map(n=>'status '+n)].filter(Boolean);if(f.length)bad++;
 console.log(k.padEnd(24),p.bg,p.sf,p.th,'|',Object.entries(r).map(([a,v])=>a+' '+v.toFixed(1)).join(' '),f.length?'FAIL '+f:'ok')};
const PL={bg:'#2a0030',sf:'#3d0045',ln:'#5e1a6a',th:'#c414dc',hi:'#e05cf0',link:'#f0a6ff',mu:'#d9bfe0',deep:'#38003c'};
chk('pl (image)',thPalette('#b100cd',PL));
for(const [k,b] of [['bund','#d10214'],['laliga','#ff4b44'],['seriea','#0059d6'],['ucl','#3550c8']])chk(k,thPalette(b));
for(const [n,[c1,c2]] of Object.entries(THEME.clubs)){const s1=thHsl(c1)[1],s2=thHsl(c2)[1];chk(n,thPalette(s1>=s2?c1:c2,{},s1>=s2?c2:c1))}
process.exit(bad?1:0);
