/* ===== Names by sound (INS.nameSound): a name typed in Arabic letters finds a name stored in Latin letters =====
   The data has every player and club in Latin letters only, and nothing in it says how a name is written in Arabic. So nothing is translated and no Arabic name is shown:
   this only helps the search boxes. Both spellings are reduced to a rough "sound key": vowels are dropped (Arabic writes few of them and no two people write them alike),
   and the consonants fall into a few groups (b/p and ب, f/v and ف, t/d/th and ت د ط ض ث ذ, s/z/sh and س ص ز ش ظ, k/q/g/j and ك ق غ ج خ, h and ه ح, l, r, m, n),
   doubled letters count once. A Latin word can sound more than one way ("ch" as in Sánchez or Michael, a silent or spoken "h", "j" as in Jota or Johansson, "w" as in
   Walker or Werner, "c" before e/i), so it gets several keys and any of them may match. "هالاند" and "Haaland" both give H-L-N-T; "مبابي" and "Mbappé" both give M-B.
   A query matches a name when every typed word is the start of the key of one of the name's words; a name whose words are matched in full comes first.
   It is a rough net on purpose: it offers a short list to pick from and never decides alone (the test measures how often the right player is in the list). */
(function(){
 if(typeof INS!=='object'||!INS)return;
 const AR=/[؀-ۿ]/;
 const A={};
 const put=(s,k)=>{for(const ch of s)A[ch]=k};
 put('بپ','B');put('فڤ','F');put('تطدضذث','T');put('سصزظش','S');put('كقغجخگچک','K');put('ل','L');put('ر','R');put('م','M');put('ن','N');put('هح','H');
 const sq=s=>s.replace(/(.)\1+/g,'$1');
 /* one key per Arabic word */
 function arKeys(q){
  return String(q||'').replace(/[ً-ٰٟـ]/g,'').replace(/تش/g,'ش').split(/[^؀-ۿ]+/).map(w=>{let k='';for(const ch of w)k+=A[ch]||'';return sq(k)}).filter(Boolean);
 }
 const pre=s=>String(s||'').toLowerCase().replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/ı/g,'i').replace(/ğ/g,'').replace(/[çšşžź]/g,'s').replace(/[čć]/g,'ch')
  .normalize('NFD').replace(/[̀-ͯ]/g,'');
 /* the ways a Latin spelling can sound, longest spelling first: [pattern, keys] */
 const RULES=[['sch',['S']],['tch',['S']],['sh',['S']],['ch',['S','K']],['ph',['F']],['th',['T']],['kh',['K']],['gh',['K','','KH']],['ck',['K']],['qu',['K']],
  ['ll',['L','']],['ce',['S']],['ci',['S']],['cy',['S']],['x',['KS','S']],['j',['K','']],['w',['','F']],['h',['H','']],
  ['b',['B']],['p',['B']],['f',['F']],['v',['F','']],['t',['T']],['d',['T']],['s',['S']],['z',['S']],['k',['K']],['q',['K']],['c',['K']],['g',['K']],
  ['l',['L']],['r',['R']],['m',['M']],['n',['N']]];
 const MEMO=new Map();
 /* every key of one Latin word (at most 16) */
 function wordKeys(w){
  if(MEMO.has(w))return MEMO.get(w);
  let outs=[''];
  for(let i=0;i<w.length;){
   const r=RULES.find(([p])=>w.startsWith(p,i));
   if(!r){i++;continue}
   const nx=[];for(const o of outs)for(const k of r[1])nx.push(o+k);
   outs=[...new Set(nx)].slice(0,16);i+=r[0].length;
  }
  const res=[...new Set(outs.map(sq))].filter(Boolean);MEMO.set(w,res);return res;
 }
 const NK=new Map();
 function nameKeys(name){
  if(NK.has(name))return NK.get(name);
  const k=pre(name).split(/[^a-z]+/).filter(Boolean).map(wordKeys).filter(a=>a.length);
  if(NK.size>20000)NK.clear();NK.set(name,k);return k;
 }
 /* 0 = no match, 1 = every typed word starts a word of the name, 2 = every typed word is a whole word of the name.
    Needs two consonants in all, or one word of three letters or more (إيزي, رايا). */
 function match(q,name){
  const qs=Array.isArray(q)?q:arKeys(q);if(!qs.length)return 0;
  if(qs.join('').length<2&&!(Array.isArray(q)?q.long:long1(q)))return 0;
  const ws=nameKeys(name);if(!ws.length)return 0;
  let full=true;
  for(const k of qs){let best=0;for(const w of ws){for(const v of w){if(v===k){best=2;break}if(best<1&&v.startsWith(k))best=1}if(best===2)break}
   if(!best)return 0;if(best<2)full=false}
  return full?2:1;
 }
 const long1=q=>String(q||'').replace(/[^ء-يپڤگچک]/g,'').length>=3;
 /* ---- the order of the matches: how far the typed word is from the name's word, letter by letter, vowels included ----
    Arabic is put into rough Latin letters (ا a, و o, ي i, غ g, ج j, خ x, ش S...) and so is the name (sh/ch S, ph f, c k or s, e/y i, u o). Changing a letter for one of
    the same group (g/j/k, b/p, a/i/o) costs 0.25, a vowel or h/w more or less 0.4, anything else 1; the end of a name not typed yet costs almost nothing. */
 const RA={};const rp=(s,k)=>{for(const ch of s)RA[ch]=k};
 rp('اأإآىعة','a');rp('وؤ','o');rp('يئ','i');rp('ب','b');rp('پ','p');rp('ف','f');rp('ڤ','v');rp('تطث','t');rp('دضذ','d');rp('سص','s');rp('زظ','z');rp('ش','S');rp('كقک','k');rp('غگ','g');rp('ج','j');rp('خ','x');rp('چ','S');
 rp('ل','l');rp('ر','r');rp('م','m');rp('ن','n');rp('هح','h');
 const arRoman=q=>String(q||'').replace(/[ً-ٰٟـ]/g,'').replace(/تش/g,'ش').split(/[^؀-ۿ]+/).map(w=>{let k='';for(const ch of w)k+=RA[ch]||'';return sq(k)}).filter(Boolean);
 const LR=new Map();
 function latRoman(name){
  if(LR.has(name))return LR.get(name);
  const r=pre(name).split(/[^a-z]+/).filter(Boolean).map(w=>sq(w.replace(/sch|tch|sh|ch/g,'S').replace(/ph/g,'f').replace(/th/g,'t').replace(/kh/g,'x').replace(/ck|qu/g,'k').replace(/c([eiy])/g,'s$1').replace(/[cq]/g,'k').replace(/x/g,'ks')
   .replace(/[ey]/g,'i').replace(/u/g,'o')));
  if(LR.size>20000)LR.clear();LR.set(name,r);return r;
 }
 const GRP={b:'B',p:'B',f:'F',v:'F',t:'T',d:'T',s:'S',z:'S',S:'S',k:'K',g:'K',j:'K',x:'K',a:'V',i:'V',o:'V'};
 const soft=c=>c==='a'||c==='i'||c==='o'||c==='h'||c==='w';
 const sub=(a,b)=>a===b?0:(GRP[a]&&GRP[a]===GRP[b])?.25:(a==='o'&&b==='w')||(a==='o'&&b==='v')?.25:1;
 const gap=c=>soft(c)?.4:1;
 function wdist(a,b){
  let prev=[0];for(let j=1;j<=b.length;j++)prev[j]=prev[j-1]+gap(b[j-1]);
  for(let i=1;i<=a.length;i++){const cur=[prev[0]+gap(a[i-1])];
   for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j-1]+sub(a[i-1],b[j-1]),prev[j]+gap(a[i-1]),cur[j-1]+gap(b[j-1]));
   prev=cur}
  let best=1e9;for(let j=0;j<=b.length;j++)best=Math.min(best,prev[j]+.05*(b.length-j));
  return best;
 }
 /* the distance of a query from a name: each typed word against the nearest word of the name */
 function dist(q,name){
  const qs=Array.isArray(q)?q:arRoman(q),ws=latRoman(name);let t=0;
  for(const a of qs){let m=1e9;for(const b of ws)m=Math.min(m,wdist(a,b));t+=m}
  return t;
 }
 /* the items whose name matches an Arabic query, nearest first; ties go to `tie(a,b)`; `max` = the largest distance kept, per typed word (none when left out) */
 function search(q,items,nameOf,tie,max){
  const ks=arKeys(q);ks.long=long1(q);const rs=arRoman(q),lim=max==null?1e9:max*Math.max(1,rs.length),out=[];
  for(const it of items){const n=nameOf(it);if(match(ks,n)){const d=dist(rs,n);if(d<=lim)out.push([d,it])}}
  return out.sort((x,y)=>x[0]-y[0]||(tie?tie(x[1],y[1]):0)).map(x=>x[1]);
 }
 INS.nameSound={isArabic:s=>AR.test(String(s||'')),arKeys,nameKeys,match,dist,search};
})();
