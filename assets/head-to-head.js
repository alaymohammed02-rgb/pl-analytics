/* ===== Head to head (#/h2h, in the Compare hub after XI Battle): two clubs of one league against each other =====
   From data/results.json (every finished league result of each league's chain of seasons: the Premier League from 2021-22, the other five from 2024-25) and the Club Elo
   ratings of INS.eloKit run over the same chain. Pick a league and two of its clubs:
   - the record in the meetings the data holds: wins, draws, wins for the other, goals, the biggest win of each side (the larger goal difference, then more goals, then the
     earlier match), each side's record at home, the last five meetings, and every meeting;
   - the two clubs' Elo ratings after each of their matches, one line each, with a tick where they met, and what Elo says about a meeting today (on each ground, and for the
     next scheduled meeting when data/fixtures.json has one).
   Only meetings inside the chain are counted, and the page says from when; nothing is added from memory. Ratings of different leagues are not comparable (each league starts
   at 1500), so a pair is two clubs of the same league. Elo's chances are a rating-gap model, not a forecast of this particular match. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('h2h','Head to head','compare','battle');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const S={lg:'',a:'',b:'',tok:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();
  const opt=n=>loadJson(n,ALL.generated).catch(()=>null);
  const p=Promise.all([loadJson('results.json',ALL.generated),opt('fixtures.json')]).then(([F,X])=>{if(!F||!F.leagues||!Object.keys(F.leagues).length||!F.params)throw new Error('results');return {F,X}}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 /* the league's chain run once: matches, ratings after each match, final ratings */
 const runs=new Map();
 function league(F,id){
  const k=id+'|'+F.key;if(runs.has(k))return runs.get(k);
  const K=INS.eloKit,L=K.league(F,id),r=K.run(L.all,F.params),cur=L.seasons[L.seasons.length-1];
  const clubs=[...new Set(cur.ms.flatMap(m=>[m.h,m.a]))].sort(K.cmp);
  const o={L,r,clubs};runs.set(k,o);return o;
 }
 /* the record of A against B in the chain */
 function record(L,a,b){
  const ms=L.all.filter(m=>(m.h===a&&m.a===b)||(m.h===b&&m.a===a));
  const rec={n:ms.length,aw:0,d:0,bw:0,ag:0,bg:0,aHome:{w:0,d:0,l:0},bHome:{w:0,d:0,l:0},aBig:null,bBig:null,list:ms.slice().reverse()};
  for(const m of ms){
   const ga=m.h===a?m.hg:m.ag,gb=m.h===a?m.ag:m.hg;rec.ag+=ga;rec.bg+=gb;
   if(ga>gb)rec.aw++;else if(ga<gb)rec.bw++;else rec.d++;
   const H=m.h===a?rec.aHome:rec.bHome,gh=m.hg,gaw=m.ag;if(gh>gaw)H.w++;else if(gh<gaw)H.l++;else H.d++;
   /* biggest win: larger goal difference, then more goals, then the earlier match (ms is in date order) */
   const win=(cur,gf,gx)=>!cur||gf-gx>cur.gf-cur.gx||(gf-gx===cur.gf-cur.gx&&gf>cur.gf);
   if(ga>gb&&win(rec.aBig,ga,gb))rec.aBig={gf:ga,gx:gb,d:m.d,h:m.h,a:m.a,hg:m.hg,ag:m.ag};
   if(gb>ga&&win(rec.bBig,gb,ga))rec.bBig={gf:gb,gx:ga,d:m.d,h:m.h,a:m.a,hg:m.hg,ag:m.ag};
  }
  return rec;
 }
 /* ratings of a club after each of its matches: [[dayNo, rating, date]] */
 function series(o,t){
  const K=INS.eloKit,out=[];
  for(const m of o.L.all){if(m.h!==t&&m.a!==t)continue;const p=o.r.post.get(m.id);out.push([K.dayNo(m.d),m.h===t?p[0]:p[1],m.d])}
  return out;
 }
 INS.h2h={record,series,league};
 R.h2h=async function(el){
  el.innerHTML='<h2>Head to head</h2><div id="h2root" class="ins lk h2"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#h2root'),lg=D.id,tok=++S.tok;
  let W;try{W=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The results are not available right now.','النتائج مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!W.F.leagues[S.lg]){S.lg=W.F.leagues[lg]?lg:Object.keys(W.F.leagues)[0];S.a='';S.b=''}
  draw(root,W);
 };
 /* the pair to open with: the league's next scheduled match, else the first two clubs */
 function defaults(W,o){
  const fx=(W.X&&W.X.leagues&&W.X.leagues[S.lg])||[];
  for(const x of fx.slice().sort((p,q)=>INS.eloKit.cmp(p.k||p.d,q.k||q.d)))if(o.clubs.includes(x.h)&&o.clubs.includes(x.a))return [x.h,x.a];
  return [o.clubs[0],o.clubs[1]];
 }
 const pc=x=>Math.round(x*100)+'%';
 const f0=x=>Math.round(x).toString();
 const COLA='#e9b44c',COLB='#5aa9ff';
 const fdate=d=>d;
 function draw(root,W){
  const F=W.F,o=league(F,S.lg),K=INS.eloKit,P=F.params;
  if(!o.clubs.includes(S.a)||!o.clubs.includes(S.b)||S.a===S.b){const d=defaults(W,o);S.a=o.clubs.includes(S.a)&&S.a!==S.b?S.a:d[0];S.b=o.clubs.includes(S.b)&&S.b!==S.a?S.b:(d[1]!==S.a?d[1]:o.clubs.find(c=>c!==S.a))}
  const a=S.a,b=S.b,rec=record(o.L,a,b),first=o.L.seasons[0].s;
  const sa=series(o,a),sb=series(o,b),ra=o.r.final.get(a),rb=o.r.final.get(b);
  const sel=(id,v)=>`<select id="${id}">${o.clubs.map(c=>`<option value="${esc(c)}"${c===v?' selected':''}>${esc(c)}</option>`).join('')}</select>`;
  /* chances of a meeting today, each ground; and the next scheduled meeting */
  const hostA=K.probs(ra-rb+P.H,P),hostB=K.probs(rb-ra+P.H,P);
  const fx=((W.X&&W.X.leagues&&W.X.leagues[S.lg])||[]).filter(x=>(x.h===a&&x.a===b)||(x.h===b&&x.a===a)).sort((p,q)=>K.cmp(p.k||p.d,q.k||q.d))[0];
  const nx=fx?(fx.h===a?{...fx,p:hostA,ah:true}:{...fx,p:[hostB[2],hostB[1],hostB[0]],ah:false}):null;
  const tot=rec.n||1;
  const bar=`<div class="h2-bar" role="img" aria-label="${ar()?'السجل':'Record'}"><i class="a" style="width:${(rec.aw/tot*100).toFixed(2)}%"></i><i class="d" style="width:${(rec.d/tot*100).toFixed(2)}%"></i><i class="b" style="width:${(rec.bw/tot*100).toFixed(2)}%"></i></div>`;
  const row=(en,arb,x,y,id)=>`<tr data-k="${id}"><td class="n">${nb(x)}</td><td class="h2-k">${two(en,arb)}</td><td class="n">${nb(y)}</td></tr>`;
  const bigTxt=(x,t)=>x?nb((x.h===t?`${x.hg}–${x.ag} ${esc(x.a)}`:`${esc(x.h)} ${x.hg}–${x.ag}`)+' · '+x.d):'–';
  const wdl=h=>`${h.w}-${h.d}-${h.l}`;
  const last5=rec.list.slice(0,5).map(m=>{const ga=m.h===a?m.hg:m.ag,gb=m.h===a?m.ag:m.hg,k=ga>gb?'w':ga<gb?'l':'d';return `<i class="h2-f ${k}" data-id="${esc(m.id)}" title="${esc(m.h)} ${m.hg}–${m.ag} ${esc(m.a)} · ${m.d}">${k==='w'?(ar()?'ف':'W'):k==='l'?(ar()?'خ':'L'):(ar()?'ت':'D')}</i>`}).join('');
  /* the chart */
  const CW=innerWidth<560?480:760,CH=300,ML=44,MR=14,MT=12,MB=26,all=[...sa,...sb];
  let chart='';
  if(all.length>1){
   const x0=Math.min(...all.map(p=>p[0])),x1=Math.max(...all.map(p=>p[0])),ys=all.map(p=>p[1]),y0=Math.floor((Math.min(...ys)-10)/50)*50,y1=Math.ceil((Math.max(...ys)+10)/50)*50;
   const X=d=>ML+(d-x0)/((x1-x0)||1)*(CW-ML-MR),Y=v=>MT+(y1-v)/((y1-y0)||1)*(CH-MT-MB);
   const pts=s=>s.map(p=>X(p[0]).toFixed(2)+','+Y(p[1]).toFixed(2)).join(' ');
   const grid=[];for(let v=y0;v<=y1;v+=50)grid.push(`<line class="h2-g" x1="${ML}" x2="${CW-MR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="h2-yl" x="${ML-6}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${v}</text>`);
   const xs=o.L.seasons.filter(s=>s.ms.length).map(s=>{const d=K.dayNo(s.ms[0].d);return d>=x0&&d<=x1?`<text class="h2-xl" x="${X(d).toFixed(1)}" y="${CH-8}" text-anchor="start">${esc(s.s)}</text><line class="h2-g" x1="${X(d).toFixed(1)}" x2="${X(d).toFixed(1)}" y1="${MT}" y2="${CH-MB}"/>`:''}).join('');
   const mk=rec.list.map(m=>`<line class="h2-mk" data-id="${esc(m.id)}" x1="${X(K.dayNo(m.d)).toFixed(2)}" x2="${X(K.dayNo(m.d)).toFixed(2)}" y1="${MT}" y2="${CH-MB}"/>`).join('');
   chart=`<svg class="h2-svg" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="${ar()?'تصنيف Elo للنادين':'Elo ratings of the two clubs'}">${grid.join('')}${xs}${mk}
    <polyline class="h2-ln a" data-n="${sa.length}" data-last="${sa.length?sa[sa.length-1][1].toFixed(2):''}" points="${pts(sa)}" fill="none" stroke="${COLA}" stroke-width="2" stroke-linejoin="round"/>
    <polyline class="h2-ln b" data-n="${sb.length}" data-last="${sb.length?sb[sb.length-1][1].toFixed(2):''}" points="${pts(sb)}" fill="none" stroke="${COLB}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }
  const chances=(p,hn,an,hc,ac)=>`<div class="h2-ch"><div class="h2-cb" style="--h:${(p[0]*100).toFixed(2)}%;--d:${(p[1]*100).toFixed(2)}%;--hc:${hc};--ac:${ac}"><i class="h"></i><i class="d"></i><i class="a"></i></div><div class="h2-cl"><span>${nm(hn)} <b>${pc(p[0])}</b></span><span>${two('Draw','تعادل')} <b>${pc(p[1])}</b></span><span>${nm(an)} <b>${pc(p[2])}</b></span></div></div>`;
  root.innerHTML=`<div class="card lk-intro"><p>${two(`<b>Two clubs, one history.</b> The meetings the data holds (the ${esc(o.L.name)} from ${esc(first)}), who won them, and how the two clubs' Elo ratings have moved since. Only clubs of the same league can be paired: ratings of different leagues are not comparable.`,`<b>نادين وتاريخ واحد.</b> اللقاءات اللي في البيانات (${nm(o.L.name)} من ${nb(esc(first))})، ومين فاز فيها، وكيف تحرّك تصنيف Elo للنادين من وقتها. تقدر تقارن بس أندية من نفس الدوري: تصنيفات الدوريات المختلفة ما تنقارن.`)}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="h2g">${Object.keys(F.leagues).map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Club','النادي')}</span>${sel('h2a',a)}</label><button type="button" class="s h2-sw" id="h2sw" aria-label="${ar()?'بدّل':'Swap'}">⇄</button><label class="dcx-l"><span class="mu">${two('Against','ضد')}</span>${sel('h2b',b)}</label></div></div>
   <div class="card h2-rec" id="h2rec"><h3><span class="h2-ca">${nm(a)}</span> <span class="mu">${two('v','ضد')}</span> <span class="h2-cb2">${nm(b)}</span></h3>
    ${rec.n?`<div class="h2-sc"><span class="a"><b>${rec.aw}</b>${two('wins','فوز')}</span><span class="d"><b>${rec.d}</b>${two('draws','تعادل')}</span><span class="b"><b>${rec.bw}</b>${two('wins','فوز')}</span></div>${bar}
    <p class="mu ins-note">${two(`${rec.n} ${rec.n===1?'meeting':'meetings'} in the data (${esc(first)} to now). Goals: ${rec.ag}–${rec.bg}.`,`${nb(rec.n)} ${rec.n===1?'لقاء':'لقاء'} في البيانات (من ${nb(esc(first))} إلى الحين). الأهداف: ${nb(rec.ag+'–'+rec.bg)}.`)}</p>
    <table class="lk-t h2-t"><thead><tr><th class="n">${nm(a)}</th><th></th><th class="n">${nm(b)}</th></tr></thead><tbody>
     ${row('Wins','الفوز',rec.aw,rec.bw,'w')}${row('Draws','التعادل',rec.d,rec.d,'d')}${row('Goals scored','الأهداف المسجّلة',rec.ag,rec.bg,'g')}
     ${row('Record at home (W-D-L)','سجله في أرضه (ف-ت-خ)',wdl(rec.aHome),wdl(rec.bHome),'h')}
     <tr data-k="big"><td class="h2-bg">${rec.aBig?bigTxt(rec.aBig,a):'–'}</td><td class="h2-k">${two('Biggest win','أكبر فوز')}</td><td class="h2-bg">${rec.bBig?bigTxt(rec.bBig,b):'–'}</td></tr></tbody></table>
    <p class="h2-l5">${two('Last five meetings (from '+esc(a)+'\'s side, newest first):','آخر خمس لقاءات (من جهة '+esc(a)+'، الأحدث أولاً):')} ${last5}</p>`
    :`<div class="empty">${two(`These two clubs have not met in the matches the data holds (${esc(first)} to now).`,`هذين النادين ما التقوا في المباريات اللي في البيانات (من ${nb(esc(first))} إلى الحين).`)}</div>`}</div>
   ${rec.n?`<div class="card"><h3>${two('Every meeting','كل اللقاءات')}</h3><div class="h2-wr"><table class="lk-t h2-ms"><thead><tr><th>${two('Date','التاريخ')}</th><th>${two('Season','الموسم')}</th><th class="n">${two('Home','المضيف')}</th><th class="n">${two('Score','النتيجة')}</th><th>${two('Away','الضيف')}</th></tr></thead><tbody>${rec.list.map(m=>{const ga=m.h===a?m.hg:m.ag,gb=m.h===a?m.ag:m.hg,k=ga>gb?'a':ga<gb?'b':'d';return `<tr class="h2-m ${k}" data-id="${esc(m.id)}" data-k="${k}"><td>${nb(esc(m.d))}</td><td>${nb(esc(m.s))}</td><td class="n">${nm(m.h)}</td><td class="n"><b>${nb(m.hg+'–'+m.ag)}</b></td><td>${nm(m.a)}</td></tr>`}).join('')}</tbody></table></div></div>`:''}
   <div class="card"><h3>${two('Elo ratings','تصنيف Elo')}</h3>
    ${chart?`<div class="h2-lg"><span class="h2-la"><i></i>${nm(a)} <b id="h2ra">${f0(ra)}</b></span><span class="h2-lb"><i></i>${nm(b)} <b id="h2rb">${f0(rb)}</b></span></div>${chart}
    <p class="mu ins-note">${two('The two lines are each club\'s rating after each of its league matches. A grey tick marks a meeting. Elo is a rating-gap model: it describes how strong each club has looked in its results, not who will win.','الخطين تصنيف كل نادي بعد كل مباراة دوري له. العلامة الرمادية تعني لقاء بينهم. Elo نموذج فرق التصنيف: يوصف قوة كل نادي في نتائجه، مو مين بيفوز.')}</p>`:`<div class="empty">${two('Not enough matches for a chart.','ما فيه مباريات كافية للرسم.')}</div>`}</div>
   <div class="card h2-pr" id="h2pr"><h3>${two('If they met today','لو التقوا اليوم')}</h3>
    <p class="mu">${two(`At ${esc(a)}'s ground:`,`في أرض ${nm(a)}:`)}</p>${chances(hostA,a,b,COLA,COLB)}
    <p class="mu">${two(`At ${esc(b)}'s ground:`,`في أرض ${nm(b)}:`)}</p>${chances(hostB,b,a,COLB,COLA)}
    ${nx?`<p class="mu h2-nx" data-i="${esc(nx.i)}">${two(`Next scheduled meeting: <b>${esc(nx.h)} v ${esc(nx.a)}</b>, ${esc(nx.d)}. Elo gives ${esc(nx.h)} ${pc(nx.h===a?hostA[0]:hostB[0])}, a draw ${pc(nx.h===a?hostA[1]:hostB[1])} and ${esc(nx.a)} ${pc(nx.h===a?hostA[2]:hostB[2])}.`,`اللقاء الجاي في الجدول: <b>${nm(nx.h)} ضد ${nm(nx.a)}</b>، ${nb(esc(nx.d))}. يعطي Elo ${nm(nx.h)} ${nb(pc(nx.h===a?hostA[0]:hostB[0]))}، والتعادل ${nb(pc(nx.h===a?hostA[1]:hostB[1]))}، و${nm(nx.a)} ${nb(pc(nx.h===a?hostA[2]:hostB[2]))}.`)}</p>`:`<p class="mu">${two('No meeting between them is in the schedule yet.','ما فيه لقاء بينهم في الجدول للحين.')}</p>`}
    <p class="mu ins-note">${two('Ratings as of each club\'s last match in the data, with Elo\'s home advantage. These are the model\'s chances, not a prediction made for one match.','التصنيف عند آخر مباراة لكل نادي في البيانات، مع أفضلية الأرض في Elo. هذي احتمالات النموذج، مو توقع لمباراة بعينها.')}</p></div>`;
  const q=s=>root.querySelector(s);
  q('#h2g').onchange=e=>{S.lg=e.target.value;S.a='';S.b='';draw(root,W)};
  q('#h2a').onchange=e=>{S.a=e.target.value;if(S.b===S.a)S.b='';draw(root,W)};
  q('#h2b').onchange=e=>{S.b=e.target.value;if(S.a===S.b)S.a='';draw(root,W)};
  q('#h2sw').onclick=()=>{const t=S.a;S.a=S.b;S.b=t;draw(root,W)};
 }
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
