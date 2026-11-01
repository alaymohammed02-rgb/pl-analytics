/* ===== Full-time story (#/recap/<match id>): what the finished match was worth, in a verdict, a curve and two sentences =====
   Everything on the page is drawn from data/story.json (written by sync.py, "STORY"): the same file feeds the notification that links here, so the two
   never disagree. Nothing is computed in the browser.
   - Verdict: what the shots were worth. Each shot scores with the probability of its xG; the chance that the match, replayed with the same shots, ends
     as it did (own goals and shots without xG are left out). Words and cut-offs are fixed in sync.py, not tuned afterwards.
   - Curve: the chance of a home win / draw / away win minute by minute from Elo's pre-match chances (turned into two goal rates), the score and the
     minutes left. It follows the scoreboard, not the chances, so it can disagree with the verdict: a "stolen win" is exactly that. It ignores red cards
     (the shot files have no card events). Points are at 0, 15, 30, 45, 60, 75, every goal and 90.
   - The note under the card prints how well this worked on the season's finished matches, with the numbers from the file. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const x_=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const VW={deserved:['Deserved','مستحق'],close:['A close call','مباراة متقاربة'],lucky:['A stolen win','فوز مسروق'],fair:['A fair draw','تعادل عادل'],saved:['An unearned point','نقطة غير مستحقة']};
 let CF=null,CK='';const SWITCHED=new Set();
 function loadStory(){const k=typeof INS.poolKey==='function'?INS.poolKey():'';if(CF&&CK===k)return CF;CK=k;
  const p=loadJson('story.json',ALL.generated).then(d=>{if(!d||typeof d!=='object'||!d.m||typeof d.m!=='object')throw new Error('story');return d}).catch(e=>{if(CF===p)CF=null;throw e});return CF=p}
 /* the team names inside a sentence from the file, kept as they are in right-to-left text */
 const sent=(s,H,A)=>{let o=esc(s);[H,A].filter(Boolean).sort((a,b)=>b.length-a.length).forEach(n=>{const e=esc(n);if(e)o=o.split(e).join('<bdi>'+e+'</bdi>')});return o};
 const pct=v=>Math.round(v*100);
 /* the tone chosen in the Notifications card (calm analyst or match banter); a story without a banter version reads calm */
 const toneKey=e=>{try{return localStorage.getItem('plx_tone')==='fun'&&e&&e.fx&&e.fx.en&&e.fx.ar?'fx':'tx'}catch(x){return 'tx'}};
 /* ---------- the curve: three stacked bands (home win at the bottom, draw, away win on top) over the 90 minutes ---------- */
 function curve(e,o){
  const {l,t,w,h,pal}=o,X=m=>l+w*m/90,Y=p=>t+h*(1-p),C=e.c;
  const pts=C.map(([m,ph,pd])=>({m,a:ph,b:Math.min(1,ph+pd)}));
  const poly=(lo,hi)=>pts.map(p=>`${X(p.m).toFixed(1)},${Y(hi(p)).toFixed(1)}`).concat(pts.slice().reverse().map(p=>`${X(p.m).toFixed(1)},${Y(lo(p)).toFixed(1)}`)).join(' ');
  let g=`<g class="rc-bands"><polygon id="rc-bh" fill="${pal.h}" points="${poly(()=>0,p=>p.a)}"/><polygon id="rc-bd" fill="${pal.d}" points="${poly(p=>p.a,p=>p.b)}"/><polygon id="rc-ba" fill="${pal.a}" points="${poly(p=>p.b,()=>1)}"/></g>`;
  g+=`<g stroke="${pal.ln}" stroke-width="${o.sw}" fill="none">`+[0.25,0.5,0.75].map(v=>`<line x1="${l}" x2="${l+w}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke-dasharray="${o.sw*3} ${o.sw*3}"/>`).join('')+`</g>`;
  g+=[0,15,30,45,60,75,90].map(m=>`<text x="${X(m).toFixed(1)}" y="${t+h+o.fs*1.5}" font-size="${o.fs}" fill="${pal.mu}" text-anchor="${m===0?'start':m===90?'end':'middle'}">${m}</text>`).join('');
  g+=[0,50,100].map(v=>`<text x="${l-o.fs*.5}" y="${(Y(v/100)+o.fs*.35).toFixed(1)}" font-size="${o.fs}" fill="${pal.mu}" text-anchor="end">${v}%</text>`).join('');
  (e.g||[]).forEach(([m,s])=>{const cx=X(Math.min(90,m)),cy=Y(s==='h'?0:1);
   g+=`<g class="rc-g" data-m="${m}" data-s="${s}"><line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${t}" y2="${t+h}" stroke="${pal.tx}" stroke-width="${o.sw}" opacity=".55"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${o.r}" fill="${pal.bg}" stroke="${pal.tx}" stroke-width="${o.sw*1.5}"/></g>`});
  if(e.tp){const p=C.find(q=>q[0]===e.tp.m);if(p){const k=e.vs==='h'?p[1]:e.vs==='a'?p[1]+p[2]:p[1]+p[2]/2;
   g+=`<circle class="rc-tpc" data-m="${e.tp.m}" cx="${X(e.tp.m).toFixed(1)}" cy="${Y(k).toFixed(1)}" r="${o.r*2.1}" fill="none" stroke="${pal.tx}" stroke-width="${o.sw*2}"/>`}}
  return g;
 }
 const PAGE_PAL={h:'var(--th-hi)',d:'rgba(128,128,128,.28)',a:'rgba(128,128,128,.62)',ln:'rgba(128,128,128,.45)',mu:'currentColor',tx:'currentColor',bg:'var(--sf,Canvas)'};
 const PNG_PAL={h:'#f2c14e',d:'#3b4658',a:'#e6e3dc',ln:'#ffffff55',mu:'#9fb0c4',tx:'#ffffff',bg:'#0d1520'};
 /* ---------- the picture that is saved (1080 x 1350), drawn from the same entry ---------- */
 function card(m,e,A){
  const W=1080,H=1350,PX=64,T=(en,a)=>A?a:en,tx='#fff',mu='#9fb0c4',FONT=INS.cardKit&&INS.cardKit.FONT||'system-ui,sans-serif';
  const fit=(s,max,w)=>INS.cardKit&&INS.cardKit.fit?INS.cardKit.fit(s,max,w):max;
  const t=(x,y,s,o)=>{o=o||{};const d=o.dir||(A?'rtl':'');return `<text x="${x}" y="${y}" font-size="${o.size||30}" font-weight="${o.w||600}" fill="${o.fill||tx}" text-anchor="${o.a||'start'}"${d?` direction="${d}"`:''}>${x_(s)}</text>`};
  const ax=A?W-PX:PX,an=A?'end':'start',ds=(e.s||'').split('-');
  let g=`<rect width="${W}" height="${H}" fill="#0d1520"/>`;
  /* the names sit on their own sides (home on the right in Arabic) and the score is its own left-to-right text, so the home goals are always next to the home name */
  const nsz=Math.min(fit(m.home,46,W/2-190),fit(m.away,46,W/2-190));
  g+=t(A?W-PX:PX,128,m.home,{size:nsz,w:800,a:A?'end':'start'})+t(A?PX:W-PX,128,m.away,{size:nsz,w:800,a:A?'start':'end'});
  g+=t(W/2,134,A?ds[1]+' – '+ds[0]:ds[0]+' – '+ds[1],{size:64,w:800,a:'middle',dir:'ltr'});
  g+=t(W/2,168,(D.name||'')+' · '+String(m.date||'').slice(0,10),{size:26,fill:mu,a:'middle'});
  const vw=VW[e.vd]||['',''];
  g+=t(W/2,250,T(vw[0],vw[1]),{size:54,w:800,a:'middle',fill:'#f2c14e'});
  const lines=((e[toneKey(e)]||e.tx||{})[A?'ar':'en']||[]).filter(Boolean);
  lines.forEach((s,i)=>{const parts=wrap(s,A?34:44);parts.forEach((p,j)=>{g+=t(W/2,320+i*130+j*40,p,{size:30,a:'middle'})})});
  if(e.c&&e.c.length){
   g+=curve(e,{l:110,t:560,w:W-110-PX,h:420,fs:24,sw:2,r:9,pal:PNG_PAL});
   g+=t(W/2,1040,T('Chance of a result, minute by minute','فرصة كل نتيجة دقيقة بدقيقة'),{size:24,fill:mu,a:'middle'});
   g+=`<rect x="${PX+10}" y="1066" width="26" height="26" fill="${PNG_PAL.h}"/>`+t(PX+46,1088,m.home,{size:24})+`<rect x="${W/2-40}" y="1066" width="26" height="26" fill="${PNG_PAL.d}"/>`+t(W/2,1088,T('Draw','تعادل'),{size:24})+`<rect x="${W-PX-250}" y="1066" width="26" height="26" fill="${PNG_PAL.a}"/>`+t(W-PX-212,1088,m.away,{size:24});
  }else g+=t(W/2,760,T('No curve for this match: Elo had no pre-match prediction.','ما فيه منحنى لهذي المباراة: Elo ما عنده توقع قبلها.'),{size:26,fill:mu,a:'middle'});
  g+=t(W/2,1170,T(`Chances: ${m.home} ${e.x[0].toFixed(1)} xG, ${m.away} ${e.x[1].toFixed(1)} xG`,`الفرص: ${m.home} ${e.x[0].toFixed(1)} xG، ${m.away} ${e.x[1].toFixed(1)} xG`),{size:28,a:'middle'});
  g+=t(W/2,1214,T('The curve ignores red cards. The verdict follows the shots, the curve follows the score.','المنحنى يتجاهل الكروت الحمراء. الحكم تابع للفرص، والمنحنى تابع للنتيجة.'),{size:21,fill:mu,a:'middle'});
  g+=t(PX,1290,'PL Analytics',{size:28,w:800})+t(W-PX,1290,T('Data: PitchAPI','البيانات: PitchAPI'),{size:22,fill:mu,a:'end'});
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${x_(m.home+' '+e.s+' '+m.away+'. '+lines.join(' '))}">${g}</svg>`,W,H};
 }
 function wrap(s,n){const w=String(s).split(' '),o=[];let c='';w.forEach(x=>{if((c+' '+x).trim().length>n&&c){o.push(c);c=x}else c=(c+' '+x).trim()});if(c)o.push(c);return o}
 /* ---------- how well this worked, from the numbers in the file ---------- */
 function notes(S){
  const a=S.acc||{},b=a.curve||{},f1=v=>v==null?'N/A':(+v).toFixed(1),f3=v=>v==null?'N/A':(+v).toFixed(3);
  if(!a.n)return '';
  const g=a.xg_goals||{},sh=a.shares||{},c60=b['60']||{},c75=b['75']||{};
  /* the bin where the curve was furthest from what happened, at minute 60 or 75 (30+ matches) */
  let hi=null;[[60,c60],[75,c75]].forEach(([mn,c])=>(c.bins||[]).forEach(b=>{if(b[2]>=30&&Math.abs(b[3]-b[4])>0.08&&(!hi||Math.abs(b[3]-b[4])>Math.abs(hi.b[3]-hi.b[4])))hi={mn,b}}));
  const o25=S.acc25;
  const en=[`<b>How good is it?</b> On ${nb(a.n)} finished matches of this season's leagues and cups in the data, the win / draw / loss chances built from the shots scored a Brier error of ${nb(f3(a.brier_chances))}, against ${nb(f3(a.brier_rates))} for the league's plain win / draw / loss rates (lower is better; the shots are known after the match, so this explains results, it does not predict them). The shots were worth ${nb(f1(g.xg))} goals in total and ${nb(g.goals)} were scored.`,
   `The verdicts so far: ${nb(sh.deserved||0)} deserved, ${nb(sh.close||0)} close calls, ${nb(sh.lucky||0)} stolen wins, ${nb(sh.fair||0)} fair draws, ${nb(sh.saved||0)} unearned points.`];
  const arr=[`<b>كم هي دقيقة؟</b> على ${nb(a.n)} مباراة منتهية من دوريات وكؤوس هذا الموسم في البيانات، فرص الفوز والتعادل والخسارة المبنية على التسديدات خطؤها (Brier) ${nb(f3(a.brier_chances))} مقابل ${nb(f3(a.brier_rates))} لمعدلات الدوري العادية (الأقل أحسن؛ التسديدات تُعرف بعد المباراة، فهي تشرح النتائج وما تتوقعها). التسديدات كانت تساوي ${nb(f1(g.xg))} هدف بالمجموع وسُجّل ${nb(g.goals)}.`,
   `الأحكام للحين: ${nb(sh.deserved||0)} مستحق، ${nb(sh.close||0)} متقارب، ${nb(sh.lucky||0)} فوز مسروق، ${nb(sh.fair||0)} تعادل عادل، ${nb(sh.saved||0)} نقطة غير مستحقة.`];
  if(c60.n){
   en.push(`The curve, on ${nb(c60.n)} matches with an Elo prediction: error ${nb(f3(c60.brier))} at minute 60 and ${nb(f3(c75.brier))} at minute 75, against ${nb(f3(c60.base))} for Elo's chances before kick-off.`+(hi?` It is not always as sure as it sounds: where it said ${nb(Math.round(hi.b[0]*100)+'–'+Math.round(hi.b[1]*100)+'%')} for a home win at minute ${nb(hi.mn)}, the home side won ${nb(Math.round(hi.b[4]*100)+'%')} of ${nb(hi.b[2])} matches.`:''));
   arr.push(`المنحنى، على ${nb(c60.n)} مباراة عندها توقع Elo: الخطأ ${nb(f3(c60.brier))} عند الدقيقة 60 و${nb(f3(c75.brier))} عند الدقيقة 75، مقابل ${nb(f3(c60.base))} لفرص Elo قبل صافرة البداية.`+(hi?` وما هو دايماً بقدر ثقته: لما قال ${nb(Math.round(hi.b[0]*100)+'–'+Math.round(hi.b[1]*100)+'%')} لفوز المضيف عند الدقيقة ${nb(hi.mn)}، فاز المضيف في ${nb(Math.round(hi.b[4]*100)+'%')} من ${nb(hi.b[2])} مباراة.`:''));
  }
  if(o25&&o25.n){
   en.push(`Last season (${nb(o25.n)} matches): shot-based error ${nb(f3(o25.brier_chances))} against ${nb(f3(o25.brier_rates))}.`);
   arr.push(`الموسم الماضي (${nb(o25.n)} مباراة): خطأ الفرص ${nb(f3(o25.brier_chances))} مقابل ${nb(f3(o25.brier_rates))}.`);
  }
  return en.map((s,i)=>`<p class="mu rc-note">${two(s,arr[i])}</p>`).join('');
 }
 const empty=(en,ar,link)=>`<div class="empty"><span>${two(en,ar)}</span>${link||''}</div>`;
 R.recap=async function(el,id){
  id=decodeURIComponent(id||'');
  const m=D&&D.matches&&D.matches.find(x=>x.match_id===id),lg=D&&D.id;
  const head=`<h2>${two('Full-time story','قصة المباراة')}</h2>`;
  if(!m){
   /* a notification can point at a match of another league: the story file knows which one, so open that league (once) and draw again */
   let S0=null;try{S0=await loadStory()}catch(x){S0=null}
   const e0=S0&&S0.m[id],h0=location.hash;
   if(e0&&e0.lg&&e0.lg!==lg&&typeof setLeague==='function'&&!SWITCHED.has(id)&&el.isConnected&&D.id===lg){
    SWITCHED.add(id);try{await setLeague(e0.lg);if(location.hash===h0)route()}catch(x){}return}
   if(!el.isConnected||location.hash!==h0)return;
   el.innerHTML=head+empty('This match is not in the open league.','هذي المباراة مو في الدوري المفتوح.',` <a href="#/matches">${two('Matches →','المباريات ←')}</a>`);return}
  SWITCHED.delete(id);
  const sc=typeof wkSc==='function'?wkSc(m.score):null;
  if(!sc){el.innerHTML=head+empty('This match has not been played yet.','هذي المباراة ما انلعبت للحين.',` <a href="#/preview/${encodeURIComponent(id)}">${two('Match preview →','معاينة المباراة ←')}</a>`);return}
  el.innerHTML=head+`<p class="mu"><span class="rc-n">${nm(m.home)} – ${nm(m.away)}</span> · ${nb(esc(D.name||''))} · ${nb(esc(String(m.date).slice(0,10)))}</p><div id="rc" class="rc ins"><div class="empty skel">${two('Loading…','جاري التحميل…')}</div></div>`;
  const root=el.querySelector('#rc');
  let S=null;try{S=await loadStory()}catch(e){S=null}
  if(!root.isConnected||D.id!==lg)return;
  const back=` <a href="#/match/${encodeURIComponent(id)}">${two('Match centre →','مركز المباراة ←')}</a>`;
  if(!S){root.innerHTML=empty('The match stories could not be loaded.','ما قدرنا نحمّل قصص المباريات.',back);return}
  const e=S.m[id];
  if(!e||!Array.isArray(e.x)||!e.tx){root.innerHTML=empty('There is no story for this match: its shot data is missing or its goals do not add up to the score.','ما فيه قصة لهذي المباراة: بيانات تسديداتها ناقصة أو أهدافها ما تطابق النتيجة.',back);return}
  const ds=String(e.s).split('-'),vw=VW[e.vd]||['',''];
  const tk=toneKey(e),s0=e[tk].en||[],s1=e[tk].ar||[];
  const sentences=[0,1].filter(i=>s0[i]||s1[i]).map(i=>`<p class="rc-s${i?' rc-tp':' rc-v'}">${two(sent(s0[i]||'',m.home,m.away),sent(s1[i]||'',m.home,m.away))}</p>`).join('');
  const mx=Math.max(e.x[0],e.x[1],.1);
  const bar=(c,v,p)=>`<div class="rc-xr"><span class="rc-xn">${nm(c)}</span><span class="rc-xb"><i style="width:${(v/mx*100).toFixed(1)}%"></i></span><b>${nb(v.toFixed(2))}</b></div>`;
  const cv=e.c&&e.c.length?`<svg id="rcsvg" class="rc-svg" viewBox="0 0 640 300" role="img" aria-label="${x_(m.home+' '+e.s+' '+m.away)}" data-l="52" data-t="14" data-w="572" data-h="230">${curve(e,{l:52,t:14,w:572,h:230,fs:13,sw:1,r:5,pal:PAGE_PAL})}</svg>
    <div class="rc-lg"><span><i class="rc-k1"></i>${nm(m.home)}</span><span><i class="rc-k2"></i>${two('Draw','تعادل')}</span><span><i class="rc-k3"></i>${nm(m.away)}</span><span><i class="rc-k4"></i>${two('Goal','هدف')}</span></div>`
   :`<div class="empty">${two('Elo has no pre-match prediction for this match, so there is no curve; the verdict above comes from the shots.','Elo ما عنده توقع قبل هذي المباراة، فما فيه منحنى؛ الحكم فوق مبني على التسديدات.')}</div>`;
  root.innerHTML=`<div class="card rc-top" data-tone="${tk=='fx'?'fun':'calm'}"><div class="rc-sc" data-s="${esc(e.s)}"><b>${nb(ds[0])}</b><span>–</span><b>${nb(ds[1])}</b></div><div class="rc-vd" data-vd="${esc(e.vd)}">${two(vw[0],vw[1])}</div>${sentences}</div>
   <div class="card rc-cv"><h3>${two('Chance of each result, minute by minute','فرصة كل نتيجة دقيقة بدقيقة')}</h3>${cv}
    <p class="mu rc-note">${two('The curve follows the scoreboard (Elo\'s chances before kick-off, the score and the minutes left); the verdict follows the shots, so they can disagree: that is what a stolen win is. Red cards are not in the shot data, so the curve ignores them.','المنحنى يتبع النتيجة (فرص Elo قبل المباراة، والنتيجة، والدقائق الباقية)؛ والحكم يتبع التسديدات، فممكن يختلفون: وهذا بالضبط معنى الفوز المسروق. الكروت الحمراء مو في بيانات التسديدات، فالمنحنى يتجاهلها.')}</p></div>
   <div class="card rc-ch"><h3>${two('The chances','الفرص')}</h3>${bar(m.home,e.x[0])}${bar(m.away,e.x[1])}
    <p class="mu rc-note">${two(`If the same shots were taken again: ${nm(m.home)} win ${nb(pct(e.pv[0])+'%')}, draw ${nb(pct(e.pv[1])+'%')}, ${nm(m.away)} win ${nb(pct(e.pv[2])+'%')}.`,`لو تكررت نفس التسديدات: فوز ${nm(m.home)} ${nb(pct(e.pv[0])+'%')}، تعادل ${nb(pct(e.pv[1])+'%')}، فوز ${nm(m.away)} ${nb(pct(e.pv[2])+'%')}.`)}</p></div>
   <div class="card rc-sv"><button type="button" class="s" id="rcsave">${two('Save as picture','احفظها كصورة')}</button> <a href="#/match/${encodeURIComponent(id)}">${two('Match centre →','مركز المباراة ←')}</a></div>
   <div class="card rc-ac">${notes(S)}</div>`;
  const sv=root.querySelector('#rcsave');
  sv.onclick=async()=>{if(!INS.cardKit||!INS.cardKit.savePng)return;sv.disabled=true;try{const c=card(m,e,ar());await INS.cardKit.savePng(c.svg,c.W,c.H,m.home+' '+m.away,'recap')}catch(x){}sv.disabled=false};
 };
 /* a finished match with a story gets a link in the Match centre */
 if(typeof R.match==='function'){
  const om=R.match;
  R.match=async function(el,id){
   const h0=location.hash,out=await om.apply(this,arguments);
   if(location.hash!==h0)return out;
   const mid=decodeURIComponent(id||''),f=el&&el.querySelector('#mc .mc-score .mc-foot');
   if(!f||f.querySelector('.rc-go'))return out;
   let S=null;try{S=await loadStory()}catch(e){S=null}
   if(!S||!S.m[mid]||location.hash!==h0||!f.isConnected||f.querySelector('.rc-go'))return out;
   const a=document.createElement('a');a.className='rc-go';a.href='#/recap/'+encodeURIComponent(mid);a.innerHTML=two('Full-time story','قصة المباراة');
   f.insertBefore(a,f.children[2]||null);
   return out;
  };
 }
 INS.recap={card,curve};
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
