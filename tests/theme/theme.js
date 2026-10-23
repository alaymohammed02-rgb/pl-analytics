/* ===== Theme: league colours, club colours and defending champions =====
   One configuration for every colour that carries identity. Layers:
   1. PL Analytics (wordmark, layout) — always the same; THEME.base is the original dark navy look;
   2. the selected league colours the whole page in its shades (THEME.leagues, by PitchAPI league ID); a league without a
      checked identity keeps THEME.base;
   3. a club's own page is drawn in the club's shades instead (THEME.clubs: up to four colours, each with its share); its stripe
      and dot show every colour at its share;
   4. gold, only for a defending champion that data/champions.json verifies for the current season.
   Statistical colours (chart panels and marks, form, heatmaps, status green/red/amber) are not part of the theme. */
const THEME={
 base:{key:'base',bg:'#0d1520',sf:'#152130',ln:'#25374d',tx:'#e8eef5',mu:'#8a9bb0',th:'#4cc38a',ink:'#06210f',hi:'#4cc38a',link:'#5aa9e6',deep:'#0f3b2c'},
 /* base = identity colour; the page shades are derived from it (thPalette). The Premier League shades follow its purple and
    magenta identity directly. */
 leagues:[
  {key:'pl',ids:['l_4WFCIZ'],label:'Premier League purple',base:'#c414dc',pal:{bg:'#2a0030',sf:'#3d0045',ln:'#5e1a6a',th:'#c414dc',hi:'#e05cf0',link:'#f0a6ff',mu:'#d9bfe0',deep:'#38003c'}},
  {key:'bund',ids:['l_1Isor4'],label:'Bundesliga red',base:'#d10214'},
  {key:'laliga',ids:['l_0ErfuF'],label:'LaLiga coral red',base:'#ff4b44'},
  {key:'seriea',ids:['l_0ALvwF'],label:'Serie A blue',base:'#0059d6'},
  {key:'ucl',ids:['l_0bfbkO'],label:'Champions League navy',base:'#3550c8'}
 ],
 /* each club's colours with their approximate share of its identity (home kit and crest together), largest first, up to four:
    'hex:share'. They are commonly used values, not official brand files. '!' marks the colour the club page is drawn in when it is
    not the first strong colour. A club not listed takes the colours of its crest, measured from the logo (thCrest). */
 clubs:{
  /* Premier League */
  'afc bournemouth':'da291c:45 000000:43 ffffff:12','arsenal':'ef0107:58 ffffff:30 063672:8 9c824a:4','aston villa':'670e36:58 95bfe5:30 fee505:12',
  'brentford':'e30613:45 ffffff:35 000000:20','brighton & hove albion':'0057b8:58 ffffff:42','chelsea':'034694:68 ffffff:20 dba111:8 ee242c:4',
  'coventry city':'59cbe8:70 ffffff:30','crystal palace':'1b458f:46 c4122e:42 ffffff:12','everton':'003399:62 ffffff:38',
  'fulham':'ffffff:62 000000:33 cc0000:5','hull city':'f5a12d:55 000000:45','ipswich town':'0044a9:62 ffffff:30 de2c37:8',
  'leeds united':'ffffff:68 1d428a:20 ffcd00:12','liverpool':'c8102e:84 ffffff:6 00b2a9:5 f6eb61:5','manchester city':'6cabdd:62 ffffff:25 1c2c5b:13',
  'manchester united':'da291c:55 ffffff:22 000000:15 fbe122:8','newcastle united':'ffffff:46 241f20:46 41b6e6:8','nottingham forest':'dd0000:65 ffffff:35',
  'sunderland':'eb172b:46 ffffff:40 000000:14','tottenham hotspur':'ffffff:62 132257:38',
  /* LaLiga */
  'athletic club':'ee2523:45 ffffff:40 000000:15','atlético madrid':'cb3524:45 ffffff:35 272e61:20','barcelona':'a50044:42 004d98:42 edbb00:16',
  'celta vigo':'8ac3ee:65 ffffff:25 e5254e:10','deportivo a coruña':'0045a8:50 ffffff:50','deportivo alavés':'0761af:55 ffffff:45',
  'elche':'ffffff:62 05642c:33 c3132d:5','espanyol':'0072ce:55 ffffff:45','getafe':'005999:75 ffffff:25','levante':'b4053f:45 0c4da2:45 ffffff:10',
  'málaga':'0099d8:52 ffffff:40 c69214:8','osasuna':'d91a21:62 0a346f:30 c9a43a:8','racing santander':'ffffff:60 009b48:30 000000:10',
  'rayo vallecano':'ffffff:72 e53027:28','real betis':'00954c:50 ffffff:45 c78912:5','real madrid':'ffffff:58 febe10:18 !00529f:14 ee3124:10',
  'real sociedad':'0067b1:52 ffffff:43 e2a03a:5','sevilla':'ffffff:65 d71920:35','valencia':'ffffff:55 000000:30 ee3524:8 fbd200:7',
  'villarreal':'ffe667:65 005187:25 e30613:10',
  /* Bundesliga */
  '1. fc köln':'ffffff:55 ed1c24:35 000000:10','augsburg':'ffffff:50 ba3733:30 46714d:20','bayer leverkusen':'e32221:50 000000:40 ffffff:10',
  'bayern münchen':'dc052d:62 ffffff:25 0066b2:13','borussia dortmund':'fde100:60 000000:40','borussia mönchengladbach':'ffffff:55 000000:30 00a14b:15',
  'eintracht frankfurt':'e1000f:40 000000:35 ffffff:25','elversberg':'000000:50 ffffff:50','freiburg':'e2001a:45 000000:35 ffffff:20',
  'hamburger sv':'ffffff:45 0a3f86:30 000000:15 e4002b:10','hoffenheim':'1961b5:62 ffffff:38','mainz 05':'c3141e:62 ffffff:38',
  'paderborn':'005ca9:45 000000:40 ffffff:15','rb leipzig':'ffffff:55 dd0741:27 0c2043:13 ffc200:5','schalke 04':'004d9d:62 ffffff:38',
  'union berlin':'eb1923:55 ffffff:35 f8e864:10','vfb stuttgart':'ffffff:60 e32219:30 fce20e:10','werder bremen':'1d9053:62 ffffff:38',
  /* Serie A */
  'atalanta':'1e71b8:45 000000:45 ffffff:10','bologna':'a21c26:45 1a2f48:45 ffffff:10','cagliari':'ad002a:45 002350:45 ffffff:10',
  'como':'0c4ea6:65 ffffff:35','fiorentina':'482e92:72 ffffff:20 e30613:8','frosinone':'ffd200:50 0047ab:45 ffffff:5',
  'genoa':'a51e36:46 002147:46 ffd100:8','inter':'010e80:45 000000:42 ffffff:13','juventus':'000000:50 ffffff:50',
  'lazio':'87d8f7:62 ffffff:28 d5ba61:10','lecce':'ffd200:50 e30613:50','milan':'fb090b:42 000000:42 ffffff:16','monza':'e4002b:62 ffffff:38',
  'napoli':'12a0d7:75 ffffff:25','parma':'ffffff:55 000000:20 ffd200:13 1b4093:12','roma':'8e1f2f:65 f0bc42:30 ffffff:5',
  'sassuolo':'00a752:50 000000:50','torino':'881f19:75 ffffff:25','udinese':'000000:50 ffffff:50','venezia':'000000:60 f36f21:15 00703c:15 ffffff:10',
  /* Ligue 1 */
  'angers':'000000:50 ffffff:50','auxerre':'ffffff:55 004c9f:45','brest':'ea1d25:65 ffffff:35','le havre':'86bee1:45 18315d:45 ffffff:10',
  'lens':'fcd116:50 ec1c24:45 000000:5','lille':'e01e13:55 20325f:35 ffffff:10','lorient':'f36f23:55 000000:35 ffffff:10',
  'lyon':'ffffff:60 da001a:20 0e23a7:20','marseille':'ffffff:65 2faee0:35','monaco':'e30613:50 ffffff:45 dfa843:5',
  'nice':'cc0000:45 000000:45 ffffff:10','paris fc':'0c052f:55 499cc9:30 ffffff:15','paris saint-germain':'004170:60 da291c:20 ffffff:20',
  'rennes':'e23327:50 000000:45 ffffff:5','strasbourg':'009fe3:60 ffffff:30 e30613:10','toulouse':'5b2d86:65 ffffff:35','troyes':'036bad:60 ffffff:40',
  /* Liga Portugal */
  'académico viseu':'000000:60 ffffff:40','arouca':'ffde00:55 0047ab:45','benfica':'e83030:62 ffffff:30 c8a659:8','braga':'d50f19:60 ffffff:35 c7a147:5',
  'estoril':'ffde00:55 0047ab:45','famalicão':'1d3c6e:50 ffffff:35 f1ca1e:15','fc porto':'003893:52 ffffff:43 f4c300:5',
  'marítimo':'d50f19:45 006b3f:45 ffffff:10','moreirense':'00843d:55 ffffff:45','nacional':'000000:50 ffffff:40 e9bf24:10',
  'rio ave':'00843d:55 ffffff:45','santa clara':'d7262f:62 ffffff:38','sporting cp':'008057:55 ffffff:45','vitória de guimarães':'ffffff:60 000000:40',
  /* other Champions League clubs */
  'aek athens':'fcd309:55 000000:45','bodø/glimt':'fcde00:65 000000:35','club brugge':'0063b3:45 000000:45 ffffff:10',
  'fenerbahçe':'ffed00:45 002d72:45 ffffff:10','feyenoord':'e30613:45 ffffff:40 000000:15','galatasaray':'a90432:50 fdb912:50',
  'lask':'000000:50 ffffff:50','psv eindhoven':'ed1c24:55 ffffff:40 000000:5','shakhtar donetsk':'f26522:60 000000:40',
  'slavia prague':'ffffff:50 e30613:50','slovan bratislava':'4fb3e8:60 ffffff:30 1e3e8c:10'
 },
 gold:'#e2bd5a'
};
const thRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const thA=(h,a)=>'rgba('+thRgb(h).join(',')+','+a+')';
const thLum=h=>{const c=thRgb(h).map(v=>v/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const thCr=(a,b)=>{const x=thLum(a),y=thLum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
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
 const bg=o.bg||thHex(h,neutral?0:s*.85,.085),sf=o.sf||thHex(h,neutral?0:s*.7,.135),ln=o.ln||thHex(h,neutral?0:s*.45,.26),B=[bg,sf];
 /* buttons: visible on the page (3:1) with readable text (4.5:1): the club's own colour, then a little darker or lighter, then its second colour */
 const okTh=x=>Math.min(thCr(x,bg),thCr(x,sf))>=3,inkOf=(x,other)=>[other,'#ffffff','#0b0b0b'].filter(Boolean).find(i=>thCr(i,x)>=4.5);
 let th=o.th,ink=th?inkOf(th):null;
 if(!th){const dk=Array.from({length:12},(_,i)=>[thHex(h,s0,l0-(i+1)/100),alt]),lt=n=>Array.from({length:n},(_,i)=>[thHex(h,s0,l0+(i+1)/100),alt]);
  const cands=[[base,alt],...dk,...lt(35),...(alt?[[alt,base]]:[]),...lt(70).slice(35)];
  for(const [c,other] of cands){const k=inkOf(c,other);if(okTh(c)&&k){th=c;ink=k;break}}
  if(!th){th=thReach(h,s,l0,B,3);ink=inkOf(th)||'#ffffff'}}
 return {bg,sf,ln,th,ink,tx:'#f3eef6',
  mu:o.mu||thReach(h,neutral?0:.25,.68,B,4.5),hi:o.hi||thReach(h,neutral?0:s,.55,B,3),link:o.link||thReach(h,neutral?0:Math.min(s,.85),.74,B,4.5),
  deep:o.deep||thHex(h,neutral?0:s,.2)};
}

const TH_CACHE=new Map();
function thLeague(id){return THEME.leagues.find(t=>t.ids.includes(id))||null}
function thLeaguePal(id){const t=thLeague(id);if(!t)return THEME.base;if(!TH_CACHE.has(t.key))TH_CACHE.set(t.key,Object.assign({key:t.key},thPalette(t.base,t.pal||{})));return TH_CACHE.get(t.key)}
/* a club's colours as [{c,w,lead}] (largest share first): configured, else measured from its crest; null when neither */
const TH_PARSE=new Map();
function thParse(v){if(!v)return null;if(Array.isArray(v))return v;if(!TH_PARSE.has(v))TH_PARSE.set(v,v.trim().split(/\s+/).map(x=>{const m=/^(!?)([0-9a-f]{6}):(\d+)$/i.exec(x);return m?{c:'#'+m[2].toLowerCase(),w:+m[3],lead:!!m[1]}:null}).filter(Boolean));return TH_PARSE.get(v)}
const clubCols=name=>thParse(THEME.clubs[String(name||'').toLowerCase().trim()])||crestOf(name);
const thNeutral=c=>thHsl(c)[1]<.12;
/* the page is drawn in the club's leading colour: the one marked '!', else its largest colour that is not white, black or grey
   and has at least a fifth of the share (a small accent does not colour a black-and-white club's page; those use the lighter
   neutral); the second colour is the next one that differs from it */
function thClubPal(name){
 const n=String(name||'').toLowerCase().trim(),L=clubCols(name);if(!L||!L.length)return null;
 const tot=L.reduce((a,x)=>a+x.w,0)||1,lead=(L.find(x=>x.lead)||L.find(x=>!thNeutral(x.c)&&x.w/tot>=.2)||L[0]).c,alt=(L.find(x=>x.c!==lead)||{c:null}).c,k='club:'+n+'|'+lead+'|'+alt;
 if(!TH_CACHE.has(k))TH_CACHE.set(k,Object.assign({key:'club'},thPalette(lead,{},alt)));
 return TH_CACHE.get(k);
}
/* applies the league's colours, or the club's when its own page is open (club = the club's name) */
function applyTheme(club){
 /* without a club page open, your team (if you chose to show the site in its colours) takes the place of the league */
 const r=document.documentElement,s=r.style,lp=thLeaguePal(D&&D.id),fv=!club&&typeof favThemeName==='function'?favThemeName():null,cp=club?thClubPal(club):fv?thClubPal(fv):null,t=cp||lp;
 r.dataset.league=lp.key;if(cp)r.dataset.club=String(club);else delete r.dataset.club;
 const v={'--bg':t.bg,'--sf':t.sf,'--ln':t.ln,'--tx':t.tx,'--mu':t.mu,'--th':t.th,'--th-ink':t.ink,'--th-hi':t.hi,'--th-link':t.link,'--th-deep':t.deep,
  '--th-glow':thA(t.hi,.30),'--th-kpi':thA(t.hi,t===THEME.base?.08:.22),'--th-soft':thA(t.hi,.12),'--th-bd':thA(t.hi,.40),'--th-amb':thA(t.hi,t===THEME.base?.06:.16),'--th-amb2':thA(t.deep,t===THEME.base?.5:.9)};
 for(const k in v)s.setProperty(k,v[k]);
 champLoad();logoLoad().then(logoHeader);
}
/* a club's colours for its stripe (top to bottom) and dot (clockwise), each band as wide as the colour's share; the accent is its
   first colour that reaches 3:1 on the page */
function clubColors(name){
 const L=clubCols(name);if(!L||!L.length)return null;const tot=L.reduce((a,x)=>a+x.w,0)||1;let acc=0;
 const stops=L.map(x=>{const a=acc;acc+=x.w/tot*100;return [x.c,+a.toFixed(2),+acc.toFixed(2)]});
 return {list:L,c1:L[0].c,c2:(L[1]||L[0]).c,hi:(L.find(x=>thCr(x.c,'#0d1520')>=3)||{c:null}).c,
  stripe:'linear-gradient(180deg,'+stops.map(([c,a,b])=>`${c} ${a}% ${b}%`).join(',')+')',
  dot:'conic-gradient('+stops.map(([c,a,b])=>`${c} ${a}% ${b}%`).join(',')+')',
  title:L.map(x=>x.c+' '+Math.round(x.w/tot*100)+'%').join(', ')};
}
const clubVars=name=>{const c=clubColors(name);return c?`--cl1:${c.c1};--cl2:${c.c2};--clhi:${c.hi||'var(--th-hi)'};--clst:${c.stripe};--cldot:${c.dot}`:''};
/* the club's logo when the data has one, else a dot in its colours */
const clubDot=name=>{const s=logoOf(name);if(s)return `<img class="clogo" src="${s}" alt="" aria-hidden="true" loading="lazy">`;const c=clubColors(name);return c?`<i class="cdot" aria-hidden="true" style="${clubVars(name)}"></i>`:''};
function clubLink(name){return `<a class="clk" href="#/club/${encodeURIComponent(name)}">${clubDot(name)}${esc(name)}</a>${champMark(name)}${euroMarks(name)}`}

/* ===== Logos and crest colours =====
   Club and league logos come from PitchAPI (the same provider as the data) and are stored by the sync in data/logos_<league>.json.
   A club without configured colours (THEME.clubs) takes the colours measured from its crest, with their shares; the page palette
   is then built and checked by thPalette exactly as for every other theme. Without a logo, nothing changes. */
const LOGO={p:{},d:{}},CREST=new Map();
function logoLoad(){
 const id=D&&D.id,m=(ALL.leagues||[]).find(l=>l.id===id)||{};if(!id||!m.logo_file)return Promise.resolve(null);
 if(!LOGO.p[id])LOGO.p[id]=fetch('data/'+m.logo_file+'?v='+encodeURIComponent(m.logo_v||'')).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{LOGO.d[id]=d;return d});
 return LOGO.p[id];
}
const logoOf=name=>{const d=LOGO.d[D&&D.id];return (d&&d.teams&&d.teams[name])||null};
const leagueLogo=()=>{const d=LOGO.d[D&&D.id];return (d&&d.league)||null};
function logoHeader(){const im=document.getElementById('lglogo');if(!im)return;const s=leagueLogo();if(s){im.src=s;im.alt=D.name;im.hidden=false}else{im.removeAttribute('src');im.hidden=true}}
/* the crest's colours with their shares: opaque pixels are grouped (k-means in Lab, from the most distant colours), groups
   closer than ΔE 16 are joined, and groups under 4% (anti-aliased edges, small details) are left out; up to four remain */
function thLab(r,g,b){const f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)},R=f(r),G=f(g),B=f(b),F=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
 const X=F((R*.4124+G*.3576+B*.1805)/.95047),Y=F(R*.2126+G*.7152+B*.0722),Z=F((R*.0193+G*.1192+B*.9505)/1.08883);return [116*Y-16,500*(X-Y),200*(Y-Z)]}
function thClusters(P,k=6){
 const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;let C=[P[0].l];
 while(C.length<k){let far=null,fd=-1;for(const p of P){const d=Math.min(...C.map(c=>d2(c,p.l)));if(d>fd){fd=d;far=p.l}}if(fd<64)break;C.push(far)}
 let G=[];for(let it=0;it<10;it++){G=C.map(()=>({n:0,l:[0,0,0],r:[0,0,0]}));
  for(const p of P){let bi=0,bd=1e9;C.forEach((c,i)=>{const d=d2(c,p.l);if(d<bd){bd=d;bi=i}});const g=G[bi];g.n++;for(let j=0;j<3;j++){g.l[j]+=p.l[j];g.r[j]+=p.r[j]}}
  C=G.map((g,i)=>g.n?g.l.map(v=>v/g.n):C[i])}
 let out=G.filter(g=>g.n).map(g=>({n:g.n,l:g.l.map(v=>v/g.n),r:g.r.map(v=>v/g.n)})).sort((a,b)=>b.n-a.n);
 for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++)if(Math.sqrt(d2(out[i].l,out[j].l))<16){const a=out[i],b=out[j],n=a.n+b.n;a.r=a.r.map((v,q)=>(v*a.n+b.r[q]*b.n)/n);a.l=a.l.map((v,q)=>(v*a.n+b.l[q]*b.n)/n);a.n=n;out.splice(j,1);j=i}
 const tot=P.length;out=out.filter(g=>g.n/tot>=.04).sort((a,b)=>b.n-a.n).slice(0,4);const s=out.reduce((a,g)=>a+g.n,0);
 return out.map(g=>({c:'#'+g.r.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),w:Math.round(g.n/s*100),lead:false}));
}
function thCrest(src){return new Promise(res=>{const im=new Image();im.onload=()=>{try{
 const N=48,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,N,N);const p=x.getImageData(0,0,N,N).data,P=[];
 for(let i=0;i<p.length;i+=4)if(p[i+3]>=200)P.push({r:[p[i],p[i+1],p[i+2]],l:thLab(p[i],p[i+1],p[i+2])});
 res(P.length?thClusters(P):null)}catch(e){res(null)}};im.onerror=()=>res(null);im.src=src})}
/* colours of a club: configured kit colours first, else its crest (computed once) */
async function crestFor(name){
 if(THEME.clubs[String(name||'').toLowerCase().trim()])return;const k=(D&&D.id)+'|'+name;if(CREST.has(k))return;
 const s=logoOf(name);CREST.set(k,s?await thCrest(s):null);
}
const crestOf=name=>CREST.get((D&&D.id)+'|'+name)||null;

/* ---------- defending champions ---------- */
/* data/champions.json (written by the sync from verified results): {leagues:{<league id>:{season,next,team,...}}}.
   A club gets the gold treatment only when the entry is for the season before the one in the data (next = current season)
   and its name matches exactly one club of the league. Nothing is shown when the file or the entry is missing. */
const CHAMP={p:null,d:null};
function champLoad(){if(!CHAMP.p)CHAMP.p=fetch('data/champions.json?v='+encodeURIComponent((ALL&&ALL.generated)||'')).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{CHAMP.d=d;return d});return CHAMP.p}
const champReady=()=>Promise.all([champLoad(),logoLoad(),euroLoad()]);
/* season of the league's data from its first match: a season starting in July or later is "YYYY-YY", else the calendar year */
function curSeason(){const ds=D.matches.map(m=>String(m.date||'').slice(0,10)).filter(Boolean).sort();if(!ds.length)return null;const y=+ds[0].slice(0,4),mo=+ds[0].slice(5,7);return mo>=7?y+'-'+String(y+1).slice(2):String(y)}
function champInfo(){
 const e=CHAMP.d&&CHAMP.d.leagues&&CHAMP.d.leagues[D.id];if(!e||!e.team||e.next!==curSeason())return null;
 const teams=[...new Set(D.matches.flatMap(m=>[m.home,m.away]))],hit=teams.filter(t=>fpTeamEq(t,e.team));
 return hit.length===1?{team:hit[0],season:e.season,e}:null;
}
const isChamp=name=>{const c=champInfo();return !!c&&c.team===name};
const thTrophy='<svg class="trophy" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1.2 1.8A5 5 0 0 1 7 8.5V7zm10 0v1.5c0 .5-.1.9-.2 1.3A2 2 0 0 0 18 8V7h-1zM7 20h10v1H7z"/></svg>';
function champMark(name){if(!isChamp(name))return '';const s=champInfo().season;return `<span class="chm" title="Defending champions ${esc(s)}" aria-label="Defending champions ${esc(s)}">${thTrophy}</span>`}
function champBadge(name){if(!isChamp(name))return '';return `<span class="champ">${thTrophy}<span>Defending champions</span><span class="mu2">${esc(champInfo().season)}</span></span>`}

/* ---------- club page ---------- */
R.club=async function(el,arg){
 const name=decodeURIComponent(arg||''),M=D.matches.filter(m=>m.home===name||m.away===name);
 if(!M.length&&!D.stats.some(s=>s.club===name)){el.innerHTML='<div class="empty">Club not found.</div>';return}
 /* the visitor may have opened another page (or league) while this one loaded: then it stops instead of drawing over it */
 const here=()=>/^#\/club\//.test(location.hash)&&decodeURIComponent(location.hash.split('/')[2]||'')===name;
 await champReady();await crestFor(name);if(!here())return;applyTheme(name);
 const sh=await loadSh().catch(()=>null);if(!here())return;const tx=wkTeamXg(sh?sh.rows:[]),fin=D.matches.filter(m=>wkSc(m.score)&&m.date),mine=fin.filter(m=>m.home===name||m.away===name);
 const lg=ltOk(fin)?ltTable(fin,tx):null,pos=lg?lg.findIndex(r=>r.t===name):-1,me=lg&&pos>=0?lg[pos]:ltTable(mine,tx).find(r=>r.t===name);
 const champ=isChamp(name),cv=clubVars(name),f1=x=>x.toFixed(2);
 const sq=agg().filter(p=>p.club===name).sort((a,b)=>(b.xt??-1)-(a.xt??-1)).slice(0,20);
 const rec=[...mine].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map(m=>{const g=wkSc(m.score),h=m.home===name,f=h?g[0]:g[1],a=h?g[1]:g[0],r=f>a?'W':f<a?'L':'D';
  return [`<i class="ltf ${r}" title="${r==='W'?'Win':r==='D'?'Draw':'Loss'}"></i>`,esc(m.date.slice(0,10)),mlink(m)]});
 const nxt=await fxSection(D.id,name);if(!here())return;
 el.innerHTML=`<div class="clubhd${champ?' is-champ':''}" style="${cv}"><div class="clubst" aria-hidden="true" title="${esc((clubColors(name)||{}).title||'')}"></div>${logoOf(name)?`<img class="clubimg" src="${logoOf(name)}" alt="" aria-hidden="true">`:''}<div class="clubtx"><h2>${esc(name)}</h2><div class="mu">${esc(D.name)}${curSeason()?'<span class="nw"> · '+esc(curSeason())+'</span>':''}</div>${clubComps(name)}</div>${champ?champBadge(name):''}</div>
 <div class="grid clubk" style="${cv}">${[
   [lg&&pos>=0?String(pos+1):'N/A',lg&&pos>=0?'Position of '+lg.length:'Position'],
   [me?String(me.pts):'N/A','Points'],[me?me.w+'-'+me.d+'-'+me.l:'N/A','Won-drawn-lost'],[me?me.f+'-'+me.a:'N/A','Goals for-against'],
   [me&&me.nx?f1(me.xf/me.nx):'N/A','xG for a match'],[me&&me.nx?f1(me.xa/me.nx):'N/A','xG against a match']
  ].map(([v,k])=>`<div class="kpi"><b>${v}</b><span>${esc(k)}</span></div>`).join('')}</div>
 ${champ?`<div class="mu" style="font-size:12px;margin:2px 0 12px" title="${esc(champInfo().e.src||'')}">${esc(name)} ${champInfo().e.kind==='cup'?`<span>won the ${esc(champInfo().season)} final, worked out from that season's verified results.</span>`:`<span>won the ${esc(champInfo().season)} league, worked out from that season's verified results. The current table is separate: being top now does not make a club champions.</span>`}</div>`:''}
 ${nxt}
 <h3>Recent results</h3>${rec.length?tbl([[''],['Date'],['Match']],rec):'<div class="empty">No results in the data yet.</div>'}
 <h3>Players by xT</h3>${sq.length?tbl([['Player'],['Pos'],['Games',1],['Min',1],['xT',1],['xG',1]],sq.map(p=>[`<a href="#/player/${encodeURIComponent(p.key+'||'+p.club)}">${esc(p.player)}</a>`,p.pos||'N/A',p.games,p.minutes==null?'N/A':Math.round(p.minutes),f(p.xt),f(p.xg)])):'<div class="empty">No player data for this club yet.</div>'}`;
};
