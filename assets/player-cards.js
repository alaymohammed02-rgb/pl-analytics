/* ===== Player cards (#/cards, in Players after Player twins): a card per player from his real numbers, two cards head to head =====
   Headline: the player's average PitchAPI match rating this season (data/<league>_rt.json), over the matches he has a rating in.
   Six attributes, each 0-99: his percentile (per 90 minutes, mid-rank) among the players of his position (DF, MF or FW as learnt
   by the sync) with PC_MIN+ minutes in the same league this season, averaged over the measures of the attribute (PC_ATTR). A
   measure PitchAPI has no value for is left out, never read as zero. Nothing is a game rating: every number is on the card's back
   (the table under the duel). Head to head: the higher number wins each row; percentiles are within each player's own position.
   Collection: the cards you save stay in this browser (localStorage, plx_cards_v1), and are recomputed from the latest data. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('cards','Player cards','players','twins');
 const PC_MIN=450,KEY='plx_cards_v1',MAXC=30;
 const PC_ATTR=[['Shooting',['npxg','sh']],['Creating',['xag','kp','sca']],['Passing',['pr','bx','ps']],['Carrying',['pc','cb','tkw']],['Defending',['tk','ic','bl']],['Duels',['duw','aerw']]];
 const KEYS=[...new Set(PC_ATTR.flatMap(a=>a[1]))];
 const POSN={DF:'Defender',MF:'Midfielder',FW:'Forward'};
 const S={a:'',b:'',lg:''};const CACHE=new Map();
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const LAB={tkw:'Take-ons won /90'},lab=k=>{const M=INS.met(k);return M?M[1]:LAB[k]||k};
 const lowerB=(a,v)=>{let lo=0,hi=a.length;while(lo<hi){const m=lo+hi>>1;if(a[m]<v)lo=m+1;else hi=m}return lo};
 const upperB=(a,v)=>{let lo=0,hi=a.length;while(lo<hi){const m=lo+hi>>1;if(a[m]<=v)lo=m+1;else hi=m}return lo};
 const readC=()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(o)?o.filter(x=>x&&typeof x.l==='string'&&typeof x.i==='string').slice(0,MAXC):[]}catch(e){return []}};
 const writeC=a=>{try{localStorage.setItem(KEY,JSON.stringify(a.slice(0,MAXC)));return true}catch(e){return false}};
 /* one league's cards: every outfield player with PC_MIN+ minutes */
 function league(lid){
  if(CACHE.has(lid))return CACHE.get(lid);
  const p=(async()=>{
   const meta=(ALL.leagues||[]).find(l=>l.id===lid);if(!meta||!meta.pl_file)return null;
   const [P,RT]=await Promise.all([loadJson(meta.pl_file,meta.pl_v),meta.rt_file?loadJson(meta.rt_file,meta.rt_v).catch(()=>null):null]);
   P.ix={};P.cols.forEach((c,k)=>P.ix[c]=k);
   const rt=new Map();Object.values((RT&&RT.m)||{}).forEach(m=>Object.entries(m||{}).forEach(([pid,v])=>{if(typeof v!=='number')return;const r=rt.get(pid)||{s:0,n:0};r.s+=v;r.n++;rt.set(pid,r)}));
   const A=aggPl(P).filter(a=>a.s.mi>=PC_MIN&&POSN[a.p]).map(a=>{const v={};KEYS.forEach(k=>v[k]=a.p90(k));const r=rt.get(a.id);
    return {key:lid+'|'+a.id,lid,ln:meta.name,id:a.id,n:a.n,club:a.club,p:a.p,mi:a.s.mi,games:a.games,gl:a.has('gl')?a.s.gl:null,ast:a.has('ast')?a.s.ast:null,v,rt:r&&r.n?r.s/r.n:null,rtn:r?r.n:0}});
   Object.keys(POSN).forEach(p=>{const G=A.filter(x=>x.p===p);KEYS.forEach(k=>{const s=G.map(x=>x.v[k]).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b);
    G.forEach(x=>{const v=x.v[k];x.q=x.q||{};x.q[k]=v==null||!isFinite(v)||!s.length?null:(lowerB(s,v)+(upperB(s,v)-lowerB(s,v))/2)/s.length*100})})});
   A.forEach(x=>{x.at=PC_ATTR.map(([l,ks])=>{const q=ks.map(k=>x.q[k]).filter(v=>v!=null);return q.length?Math.min(99,Math.floor(q.reduce((s,v)=>s+v,0)/q.length)):null});x.grp=A.filter(y=>y.p===x.p).length});
   return A;
  })().catch(()=>null);
  CACHE.set(lid,p);return p;
 }
 const photo=id=>{const ph=typeof HOME==='object'&&HOME.ph;return ph&&ph.public&&ph.p&&ph.p[id]||null};
 function card(x,o){o=o||{};const c=typeof clubColors==='function'?clubColors(x.club):null,lg=typeof logoOf==='function'&&x.lid===D.id?logoOf(x.club):null,ph=x.lid===D.id?photo(x.id):null,saved=readC().some(s=>s.l===x.lid&&s.i===x.id);
  const ini=typeof hIni==='function'?hIni(x.n):String(x.n).slice(0,2).toUpperCase();
  return `<article class="pc-card${o.mini?' mini':''}" style="--c1:${c?c.c1:'#25374d'};--c2:${c?c.c2:'#152130'};--chi:${(c&&c.hi)||'var(--th-hi)'}" data-k="${esc(x.key)}">
   <div class="pc-top"><div class="pc-rt" style="background:${typeof ratingColor==='function'?ratingColor(x.rt):'#8a9bb0'}"${INS.tipAttr(['Average match rating',x.rt==null?'N/A':x.rt.toFixed(2),x.rtn+' matches with a rating'])}><b>${x.rt==null?'–':x.rt.toFixed(1)}</b><small>Rating</small></div>
    <div class="pc-pos"><b>${esc(x.p)}</b>${lg?`<img src="${esc(lg)}" alt="" width="26" height="26">`:''}</div></div>
   <div class="pc-ph">${ph?`<img src="${esc(ph)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${esc(ini)}'}))">`:`<span>${esc(ini)}</span>`}</div>
   <div class="pc-nm">${nm(x.n)}</div><div class="pc-cl">${nm(x.club)}${x.lid!==D.id?` · ${nm(x.ln)}`:''}</div>
   <ul class="pc-at">${PC_ATTR.map(([l],i)=>`<li${o.win?` class="${o.win[i]}"`:''}${INS.tipAttr([l,x.at[i]==null?'N/A':x.at[i]+' / 99','Percentile among '+POSN[x.p].toLowerCase()+'s of '+x.ln])}><b>${x.at[i]==null?'–':x.at[i]}</b><span>${l}</span></li>`).join('')}</ul>
   <div class="pc-ft">${nb(Math.round(x.mi))} <span>min</span>${x.gl!=null?` · ${nb(x.gl)} <span>G</span>`:''}${x.ast!=null?` · ${nb(x.ast)} <span>A</span>`:''}</div>
   ${o.mini?`<div class="pc-mb"><button type="button" class="s" data-use="${esc(x.key)}">Use in the duel</button><button type="button" class="s" data-del="${esc(x.key)}" aria-label="Remove from my cards">✕</button></div>`
    :`<div class="pc-act"><button type="button" class="s pc-save" data-save="${esc(x.key)}" aria-pressed="${saved}">${saved?'★ <span>In my cards</span>':'☆ <span>Save card</span>'}</button>${typeof shareBtn==='function'?shareBtn(x.key):''}</div>`}
  </article>`}
 R.cards=async function(el){
  el.innerHTML='<h2>Player cards</h2><div id="pcroot" class="ins pc"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#pcroot'),lid=D.id;
  if(typeof phLoad==='function')phLoad();
  const A=await league(lid);if(!root.isConnected||D.id!==lid)return;
  if(!A||A.length<4){root.innerHTML=`<div class="empty">${two(`No player cards for ${esc(D.name)} yet: players need ${PC_MIN} minutes.`,`ما فيه بطاقات لاعبين في ${nm(D.name)} للحين: اللاعب يحتاج ${nb(PC_MIN)} دقيقة.`)}</div>`;return}
  if(S.lg!==lid){S.lg=lid;S.a='';S.b=''}
  const byRt=A.slice().sort((x,y)=>(y.rt??0)-(x.rt??0));
  if(!S.a||!A.some(x=>x.key===S.a)){const fv=typeof favOf==='function'?favOf():null,f=fv&&A.filter(x=>x.club===fv).sort((x,y)=>(y.rt??0)-(x.rt??0))[0];S.a=(f||byRt[0]).key}
  if(!S.b||!A.some(x=>x.key===S.b)||S.b===S.a){const a=A.find(x=>x.key===S.a);S.b=(byRt.find(x=>x.key!==S.a&&x.p===a.p)||byRt.find(x=>x.key!==S.a)).key}
  const opts=`<datalist id="pcl">${A.slice().sort((x,y)=>x.n.localeCompare(y.n)).map(x=>`<option value="${esc(x.n)} · ${esc(x.club)}" data-k="${esc(x.key)}">${esc(POSN[x.p])}</option>`).join('')}</datalist>`;
  const paint=async()=>{
   const a=A.find(x=>x.key===S.a),b=A.find(x=>x.key===S.b);
   const rows=[['Rating',a.rt,b.rt,v=>v==null?'–':v.toFixed(2)],...PC_ATTR.map(([l],i)=>[l,a.at[i],b.at[i],v=>v==null?'–':v])];
   const win=rows.map(([,x,y])=>x==null||y==null?['','']:x>y?['w','l']:x<y?['l','w']:['d','d']);
   const sa=win.filter(w=>w[0]==='w').length,sb=win.filter(w=>w[1]==='w').length;
   const wa=win.slice(1).map(w=>w[0]),wb=win.slice(1).map(w=>w[1]);
   const mine=readC();
   root.innerHTML=`<div class="card pc-intro"><p>${two(`<b>Real numbers on a card.</b> The big number is the player's average PitchAPI match rating. The six attributes are his percentiles (0-99) among the ${'players of his position'} in ${esc(D.name)} with ${PC_MIN}+ minutes, per 90 minutes. Pick two players for a head to head.`,`<b>أرقام حقيقية على بطاقة.</b> الرقم الكبير متوسط تقييم اللاعب في مبارياته من PitchAPI. الصفات الست نسبه المئوية (0-99) بين لاعبي مركزه في ${nm(D.name)} اللي لعبوا ${nb(PC_MIN)} دقيقة أو أكثر، لكل 90 دقيقة. اختر لاعبين للمواجهة.`)}</p>
     <div class="ctl pc-ctl"><label class="tw-s"><span>Card</span><input id="pca" list="pcl" autocomplete="off" value="${esc(a.n)} · ${esc(a.club)}"></label><span class="pc-vs" aria-hidden="true">VS</span><label class="tw-s"><span>Against</span><input id="pcb" list="pcl" autocomplete="off" value="${esc(b.n)} · ${esc(b.club)}"></label>${opts}</div></div>
    <div class="pc-duel">${card(a,{win:wa})}${card(b,{win:wb})}</div>
    <div class="card pc-res"><h3>${sa===sb?two(`Level: ${sa}–${sb}`,`تعادل: ${nb(sa+'–'+sb)}`):two(`${esc(sa>sb?a.n:b.n)} wins ${Math.max(sa,sb)}–${Math.min(sa,sb)}`,`${nm(sa>sb?a.n:b.n)} يفوز ${nb(Math.max(sa,sb)+'–'+Math.min(sa,sb))}`)}</h3>
     <div class="wrap"><table class="pc-t"><thead><tr><th></th><th class="n">${nm(a.n)}</th><th class="n">${nm(b.n)}</th></tr></thead><tbody>${rows.map(([l,x,y,f],i)=>`<tr><td>${esc(l)}</td><td class="n ${win[i][0]}">${f(x)}</td><td class="n ${win[i][1]}">${f(y)}</td></tr>`).join('')}</tbody></table></div>
     ${a.p!==b.p?`<p class="mu ins-note">${two(`Different positions: each attribute is a percentile within the player's own position, so it compares how each stands among his peers.`,`مركزين مختلفين: كل صفة نسبة مئوية داخل مركز اللاعب نفسه، فهي تقارن مكانة كل واحد بين أقرانه.`)}</p>`:''}
     <details class="pc-back"><summary>${two('The numbers behind the cards','الأرقام اللي ورا البطاقات')}</summary><div class="wrap"><table class="pc-t"><thead><tr><th>Per 90 minutes</th><th class="n">${nm(a.n)}</th><th class="n">${nm(b.n)}</th></tr></thead><tbody>
      ${PC_ATTR.map(([l,ks])=>`<tr class="pc-g"><td colspan="3">${esc(l)}</td></tr>`+ks.map(k=>`<tr><td>${esc(lab(k))}</td><td class="n">${INS.f(a.v[k])} <span class="mu">${a.q[k]==null?'':nb('('+Math.floor(a.q[k])+')')}</span></td><td class="n">${INS.f(b.v[k])} <span class="mu">${b.q[k]==null?'':nb('('+Math.floor(b.q[k])+')')}</span></td></tr>`).join('')).join('')}</tbody></table></div>
      <p class="mu ins-note">${two(`In brackets: the percentile among the player's position group (${a.grp} ${POSN[a.p].toLowerCase()}s${a.p!==b.p?`, ${b.grp} ${POSN[b.p].toLowerCase()}s`:''}). An attribute is the average of its measures' percentiles.`,`بين القوسين: النسبة المئوية بين لاعبي مركزه. الصفة متوسط النسب المئوية لمقاييسها.`)}</p></details></div>
    <div class="card"><h3>My cards <span class="mu">${nb(mine.length+' / '+MAXC)}</span></h3><div id="pcmine">${mine.length?'<div class="empty skel">Loading…</div>':`<div class="empty">${two('No saved cards yet. Tap ☆ Save card on a card.','ما فيه بطاقات محفوظة للحين. اضغط ☆ احفظ البطاقة على أي بطاقة.')}</div>`}</div>
     <p class="mu ins-note">${two('Saved in this browser only; each card is recomputed from the latest data when you open it.','محفوظة في هذا المتصفح بس؛ كل بطاقة تنحسب من آخر بيانات لما تفتحها.')}</p></div>`;
   const pick=(id,f)=>{const q=root.querySelector(id);q.addEventListener('focus',()=>q.select());q.addEventListener('change',()=>{const op=[...root.querySelectorAll('#pcl option')].find(x=>x.value===q.value);if(op&&op.dataset.k){f(op.dataset.k);paint()}})};
   pick('#pca',k=>{S.a=k;if(S.b===k)S.b=byRt.find(x=>x.key!==k).key});pick('#pcb',k=>{S.b=k;if(S.a===k)S.a=byRt.find(x=>x.key!==k).key});
   root.querySelectorAll('[data-save]').forEach(btn=>btn.addEventListener('click',()=>{const [l,i]=btn.dataset.save.split('|'),c=readC(),at=c.findIndex(s=>s.l===l&&s.i===i);if(at>=0)c.splice(at,1);else{if(c.length>=MAXC)return;c.unshift({l,i})}writeC(c);paint()}));
   if(typeof shareWire==='function')shareWire(root,k=>shareOne(A.find(x=>x.key===k)));
   await mineList(root,mine);
  };
  const mineList=async(root,mine)=>{const box=root.querySelector('#pcmine');if(!box||!mine.length)return;
   const L=await Promise.all([...new Set(mine.map(s=>s.l))].map(async l=>[l,await league(l)]));const M=new Map(L);if(!box.isConnected)return;
   const cs=mine.map(s=>{const A_=M.get(s.l);return A_&&A_.find(x=>x.id===s.i)}).filter(Boolean),gone=mine.length-cs.length;
   box.innerHTML=`<div class="pc-mine">${cs.map(x=>card(x,{mini:true})).join('')}</div>${gone?`<p class="mu ins-note">${two(`${gone} saved card(s) have no data now (under ${PC_MIN} minutes, or the league is no longer in the data).`,`${nb(gone)} بطاقة محفوظة ما لها بيانات الحين (أقل من ${nb(PC_MIN)} دقيقة، أو الدوري ما عاد في البيانات).`)}</p>`:''}`;
   box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{const [l,i]=b.dataset.del.split('|');writeC(readC().filter(s=>!(s.l===l&&s.i===i)));paint()}));
   box.querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',async()=>{const [l,i]=b.dataset.use.split('|');
    if(l!==D.id){await setLeague(l);if(typeof CMP!=='undefined')CMP=[];if(typeof head==='function')head();S.lg=l;S.a=l+'|'+i;S.b='';route();return}
    S.a=l+'|'+i;if(S.b===S.a)S.b='';if(!S.b){const a=A.find(x=>x.key===S.a);S.b=(byRt.find(x=>x.key!==S.a&&x.p===a.p)||byRt.find(x=>x.key!==S.a)).key}paint();root.scrollIntoView({block:'start',behavior:'smooth'})}));
  };
  await paint();
 };
 /* the card as an image (1080 × 1350), drawn from the same numbers */
 function shareOne(x){if(!x||typeof shareCard!=='function')return 'failed';
  return shareCard({name:'card-'+x.n,title:x.n,draw:async(ctx,U)=>{const W=U.W,c=typeof clubColors==='function'?clubColors(x.club):null;
   const cx=W/2,top=110;U.rr(150,top,W-300,1060,48,U.alpha((c&&c.c1)||'#25374d',.55),'rgba(255,255,255,.18)');
   const g=ctx.createLinearGradient(150,top,W-150,top+1060);g.addColorStop(0,'rgba(255,255,255,.10)');g.addColorStop(1,'rgba(0,0,0,.25)');U.rr(150,top,W-300,1060,48,g);
   U.badge(x.rt==null?'–':x.rt.toFixed(1),210,top+50,{size:64,h:100,min:150,fill:typeof ratingColor==='function'?ratingColor(x.rt):U.hi});
   U.text(U.tr('Rating'),285,top+180,{size:26,color:U.tx,align:'center'});
   U.text(x.p,W-210,top+120,{size:56,weight:800,align:'right'});
   await U.avatar(x.id,x.n,x.club,cx,top+330,170);
   U.text(x.n,cx,top+580,{size:60,weight:800,align:'center',max:W-360,fit:40});
   U.text(x.club+' · '+x.ln,cx,top+635,{size:30,color:U.mu,align:'center',max:W-360});
   PC_ATTR.forEach(([l],i)=>{const col=i%2,row=Math.floor(i/2),X=260+col*340,Y=top+720+row*100;
    U.text(x.at[i]==null?'–':String(x.at[i]),X,Y+50,{size:64,weight:800,color:U.hi});U.text(U.tr(l),X+110,Y+44,{size:32,color:U.tx,max:200})});
   U.text(Math.round(x.mi)+' '+U.tr('min')+(x.gl!=null?' · '+x.gl+' G':'')+(x.ast!=null?' · '+x.ast+' A':''),cx,top+1030,{size:28,color:U.mu,align:'center'});
  }})}
 INS.ar({"Player cards":"بطاقات اللاعبين","Card":"البطاقة","Against":"ضد","Rating":"التقييم","Save card":"احفظ البطاقة","In my cards":"في بطاقاتي","My cards":"بطاقاتي","Use in the duel":"استخدمها في المواجهة",
  "Remove from my cards":"احذفها من بطاقاتي","Average match rating":"متوسط تقييم المباريات","Passing":"التمرير","G":"هـ","A":"ص","The numbers behind the cards":"الأرقام اللي ورا البطاقات","Per 90 minutes":"لكل 90 دقيقة",
  "Shooting":"التسديد","Creating":"صناعة الفرص","Carrying":"حمل الكرة","Defending":"الدفاع","Duels":"الالتحامات","min":"د","Take-ons won /#":"مراوغات ناجحة /#"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
