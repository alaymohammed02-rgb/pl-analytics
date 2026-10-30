/* ===== Fortress (#/fortress, in the Teams hub after Halves): how much better a club is at home than away, and whether that lasts =====
   From data/results.json (the Time machine's file: every finished result of each league's chain of seasons). For a season, each club's points per
   game at home and away (3 for a win, 1 for a draw) and the gap = home minus away; a row per club draws the two numbers on one 0-3 scale, joined by
   a line, so a long line is a club that is far better at home. A season under way has few games (the row says how many at home and away), so its gaps
   move a lot; a finished season has every club home and away the same number of times.
   "Does a fortress last?": for every pair of finished seasons in a row of a league, each club's gap minus that season's league average gap (so a
   season where home advantage was bigger for everyone does not count), the correlation of this season's number with the next season's over the
   clubs in both, pooled over all leagues; the interval is Fisher's (z = atanh r, 1.96 / sqrt(n - 3)), "within noise" when it holds 0.
   The league table of home advantage by season (home wins, draws, away wins, goals per match) comes from the same results. Nothing is estimated. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('fortress','Fortress','teams','halves');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const S={lg:'',si:-1,sort:'gap',pick:'',tok:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();const p=loadJson('results.json',ALL.generated).then(d=>{if(!d||!d.leagues||!Object.keys(d.leagues).length)throw new Error('results');return d}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 /* a season of a league: per club its home and away games, points, goals */
 function seasonOf(L,s){
  const T=new Map(),g=t=>{let r=T.get(t);if(!r)T.set(t,r={t,h:{n:0,w:0,d:0,l:0,gf:0,ga:0},a:{n:0,w:0,d:0,l:0,gf:0,ga:0}});return r};
  let hw=0,dr=0,aw=0,hg=0,ag=0;
  for(const x of s.m){const H=g(L.teams[x[1]]).h,A=g(L.teams[x[2]]).a,gh=x[3],ga=x[4];
   H.n++;A.n++;H.gf+=gh;H.ga+=ga;A.gf+=ga;A.ga+=gh;hg+=gh;ag+=ga;
   if(gh>ga){H.w++;A.l++;hw++}else if(gh<ga){A.w++;H.l++;aw++}else{H.d++;A.d++;dr++}}
  const n=T.size,fin=s.m.length===n*(n-1);
  const rows=[...T.values()].map(r=>{const hp=3*r.h.w+r.h.d,ap=3*r.a.w+r.a.d;return {...r,hp,ap,hpg:r.h.n?hp/r.h.n:null,apg:r.a.n?ap/r.a.n:null,gap:r.h.n&&r.a.n?hp/r.h.n-ap/r.a.n:null}});
  return {s:s.s,n,fin,N:s.m.length,rows,hw,dr,aw,hg,ag};
 }
 const decoded=new Map();
 function league(F,id){const k=id+'|'+F.key;if(decoded.has(k))return decoded.get(k);const L=F.leagues[id],o={id,name:L.name,seasons:L.seasons.map(s=>seasonOf(L,s))};decoded.set(k,o);return o}
 /* the pooled repeat test */
 function repeat(F){
  const xs=[],ys=[],per=[];
  for(const id of Object.keys(F.leagues)){const L=league(F,id),a=[],b=[];
   for(let i=0;i+1<L.seasons.length;i++){const p=L.seasons[i],q=L.seasons[i+1];if(!p.fin||!q.fin)continue;
    const mp=p.rows.reduce((s,r)=>s+r.gap,0)/p.rows.length,mq=q.rows.reduce((s,r)=>s+r.gap,0)/q.rows.length,qm=new Map(q.rows.map(r=>[r.t,r.gap-mq]));
    for(const r of p.rows)if(qm.has(r.t)){a.push(r.gap-mp);b.push(qm.get(r.t))}}
   if(a.length>2)per.push({id,name:L.name,n:a.length,r:corr(a,b)});xs.push(...a);ys.push(...b)}
  const n=xs.length;if(n<4)return null;const r=corr(xs,ys),z=Math.atanh(r),se=1/Math.sqrt(n-3);
  return {n,r,lo:Math.tanh(z-1.96*se),hi:Math.tanh(z+1.96*se),per};
 }
 function corr(a,b){const n=a.length,ma=a.reduce((s,x)=>s+x,0)/n,mb=b.reduce((s,x)=>s+x,0)/n;let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);saa+=(a[i]-ma)**2;sbb+=(b[i]-mb)**2}return saa&&sbb?sab/Math.sqrt(saa*sbb):0}
 R.fortress=async function(el){
  el.innerHTML='<h2>Fortress</h2><div id="ftroot" class="ins lk ft"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#ftroot'),lg=D.id,tok=++S.tok;
  let F;try{F=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The results are not available right now.','النتائج مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!F.leagues[S.lg]){S.lg=F.leagues[lg]?lg:Object.keys(F.leagues)[0];S.si=-1;S.pick=''}
  draw(root,F);
 };
 const f2=x=>x==null?'–':x.toFixed(2),sg=x=>x==null?'–':(x>=0?'+':'−')+Math.abs(x).toFixed(2),pc=x=>Math.round(x*100)+'%';
 function draw(root,F){
  const L=league(F,S.lg);if(S.si<0||S.si>=L.seasons.length)S.si=L.seasons.length-1;
  const SE=L.seasons[S.si],cur=S.si===L.seasons.length-1&&!SE.fin,key={gap:r=>r.gap,home:r=>r.hpg,away:r=>r.apg}[S.sort];
  const rows=SE.rows.filter(r=>r.gap!=null).sort((a,b)=>key(b)-key(a)||cmp(a.t,b.t));
  if(!rows.some(r=>r.t===S.pick))S.pick=rows.length?rows[0].t:'';
  const rp=repeat(F),pos=v=>(v/3*100).toFixed(2);
  const track=r=>{const lo=Math.min(r.hpg,r.apg),hi=Math.max(r.hpg,r.apg);return `<span class="ft-tr"><i class="ft-ln" style="left:${pos(lo)}%;width:${(pos(hi)-pos(lo)).toFixed(2)}%"></i><i class="ft-a" style="left:${pos(r.apg)}%"></i><i class="ft-h" style="left:${pos(r.hpg)}%"></i></span>`};
  const sel=rows.find(r=>r.t===S.pick),hist=sel?L.seasons.map(s=>({s:s.s,fin:s.fin,r:s.rows.find(x=>x.t===S.pick)})).filter(x=>x.r):[];
  const mean=rows.length?rows.reduce((s,r)=>s+r.gap,0)/rows.length:null;
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Fortresses and bad travellers.</b> Each row is a club: the blue dot is its points per game away, the gold dot at home. A long line means a club that is far better at home. A fortress is only worth the name if it lasts, so the last card tests that.','<b>القلاع والمسافرين الضعفاء.</b> كل صف نادي: النقطة الزرقاء نقاطه لكل مباراة خارج أرضه، والذهبية في أرضه. الخط الطويل يعني نادي أحسن بكثير في بيته. القلعة ما تستاهل الاسم إلا إذا استمرت، فآخر بطاقة تختبر هذا.')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="ftg">${Object.keys(F.leagues).map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <label class="dcx-l"><span class="mu">${two('Season','الموسم')}</span><select id="fts">${L.seasons.map((s,i)=>`<option value="${i}"${i===S.si?' selected':''}>${esc(s.s)}</option>`).join('')}</select></label>
    <div class="seg" id="ftso" role="group" aria-label="${ar()?'الترتيب':'Order by'}">${[['gap','Home − away','البيت − الخارج'],['home','Home','البيت'],['away','Away','الخارج']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${S.sort===k}" class="${S.sort===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div></div>
   <div class="card ft-c"><div class="ft-hd"><span>${two('Points per game','نقاط لكل مباراة')}</span><span class="ft-sc"><i>0</i><i>1</i><i>2</i><i>3</i></span><span class="ft-gh">${two('Gap','الفرق')}</span></div>
    <div class="ft-list" role="list">${rows.map(r=>`<button type="button" role="listitem" class="ft-row${r.t===S.pick?' on':''}" data-t="${esc(r.t)}" data-hp="${r.hpg.toFixed(4)}" data-ap="${r.apg.toFixed(4)}" data-hn="${r.h.n}" data-an="${r.a.n}" aria-pressed="${r.t===S.pick}"><span class="ft-n">${nm(r.t)}</span>${track(r)}<b class="ft-g ${r.gap>=0?'p':'m'}">${nb(sg(r.gap))}</b></button>`).join('')}</div>
    <div class="ft-lg"><span class="ft-lh"><i></i>${two('Home','البيت')}</span><span class="ft-la"><i></i>${two('Away','الخارج')}</span></div>
    <p class="mu ins-note">${two(`${esc(SE.s)}: ${SE.N} matches${cur?' so far, so each club has only a few home and away games and the gaps move a lot (press a club to see how many)':''}. Average gap of the league: ${sg(mean)} points per game.`,`${nb(esc(SE.s))}: ${nb(SE.N)} مباراة${cur?' للحين، فكل نادي عنده مباريات قليلة في البيت وخارجه والفروق تتحرك كثير (اضغط على نادي وشوف كم لعب)':''}. متوسط فرق الدوري: ${nb(sg(mean))} نقطة لكل مباراة.`)}</p></div>
   ${sel?`<div class="card ft-s" id="ftsel"><h3>${nm(sel.t)}</h3><div class="ft-w"><table class="lk-t ft-t"><thead><tr><th>${two('Season','الموسم')}</th><th class="n">${two('Home W-D-L','البيت ف-ت-خ')}</th><th class="n">${two('Home pts/g','نقاط البيت/م')}</th><th class="n">${two('Away W-D-L','الخارج ف-ت-خ')}</th><th class="n">${two('Away pts/g','نقاط الخارج/م')}</th><th class="n">${two('Gap','الفرق')}</th></tr></thead>
    <tbody>${hist.map(x=>`<tr data-s="${esc(x.s)}"><td>${nb(esc(x.s))}${x.fin?'':' <span class="mu">'+two('so far','للحين')+'</span>'}</td><td class="n">${nb(`${x.r.h.w}-${x.r.h.d}-${x.r.h.l}`)}</td><td class="n">${nb(f2(x.r.hpg))}</td><td class="n">${nb(`${x.r.a.w}-${x.r.a.d}-${x.r.a.l}`)}</td><td class="n">${nb(f2(x.r.apg))}</td><td class="n"><b>${nb(sg(x.r.gap))}</b></td></tr>`).join('')}</tbody></table></div></div>`:''}
   <div class="card"><h3>${two('Home advantage by season','أفضلية البيت حسب الموسم')} · ${nm(L.name)}</h3><div class="ft-w"><table class="lk-t ft-y"><thead><tr><th>${two('Season','الموسم')}</th><th class="n">${two('Matches','مباريات')}</th><th class="n">${two('Home wins','فوز البيت')}</th><th class="n">${two('Draws','تعادل')}</th><th class="n">${two('Away wins','فوز الخارج')}</th><th class="n">${two('Goals home / away per match','أهداف البيت / الخارج للمباراة')}</th></tr></thead>
    <tbody>${L.seasons.slice().reverse().map(s=>`<tr data-s="${esc(s.s)}"><td>${nb(esc(s.s))}</td><td class="n">${nb(s.N)}</td><td class="n">${nb(pc(s.hw/s.N))}</td><td class="n">${nb(pc(s.dr/s.N))}</td><td class="n">${nb(pc(s.aw/s.N))}</td><td class="n">${nb((s.hg/s.N).toFixed(2)+' / '+(s.ag/s.N).toFixed(2))}</td></tr>`).join('')}</tbody></table></div></div>
   ${rp?`<div class="card ft-rp" id="ftrp"><h3>${two('Does a fortress last?','هل القلعة تستمر؟')}</h3>
    <p class="ft-rr">${two(`From one finished season to the next, a club's gap (home minus away, against that season's league average) has a correlation of <b>${rp.r.toFixed(2)}</b> (95% interval ${rp.lo.toFixed(2)} to ${rp.hi.toFixed(2)}) over <b>${rp.n}</b> club pairs in the six leagues. ${rp.lo<=0&&rp.hi>=0?'That is within noise: a big home-away gap one year says little about the next.':rp.lo>0?'That is above zero beyond noise: some of it lasts.':'That is below zero beyond noise.'}`,`من موسم منتهي للي بعده، علاقة فرق النادي (البيت ناقص الخارج، مقابل متوسط الدوري في ذاك الموسم) هي <b>${nb(rp.r.toFixed(2))}</b> (فترة ثقة ${nb('95%')} من ${nb(rp.lo.toFixed(2))} إلى ${nb(rp.hi.toFixed(2))}) على <b>${nb(rp.n)}</b> زوج أندية في الدوريات الستة. ${rp.lo<=0&&rp.hi>=0?'وهذا ضمن الضوضاء: فرق كبير بين البيت والخارج في سنة يقول شي قليل عن السنة اللي بعدها.':rp.lo>0?'وهذا فوق الصفر بشكل واضح: جزء منه يستمر.':'وهذا تحت الصفر بشكل واضح.'}`)}</p>
    <table class="lk-t ft-pt"><thead><tr><th>${two('League','الدوري')}</th><th class="n">${two('Pairs','أزواج')}</th><th class="n">${two('Correlation','العلاقة')}</th></tr></thead><tbody>${rp.per.map(x=>`<tr data-l="${esc(x.id)}"><td>${nm(x.name)}</td><td class="n">${nb(x.n)}</td><td class="n">${nb(x.r.toFixed(2))}</td></tr>`).join('')}</tbody></table>
    <p class="mu ins-note">${two('Only seasons where every club played every other home and away. A club must be in both seasons. A few dozen pairs cannot see a small effect, which is why the interval is shown.','بس المواسم اللي لعب فيها كل نادي ضد كل نادي ذهابًا وإيابًا. والنادي لازم يكون في الموسمين. كم عشرة أزواج ما تشوف أثر صغير، وعشان كذا الفترة معروضة.')}</p></div>`:''}`;
  const q=s=>root.querySelector(s);
  q('#ftg').onchange=e=>{S.lg=e.target.value;S.si=-1;S.pick='';draw(root,F)};
  q('#fts').onchange=e=>{S.si=+e.target.value;draw(root,F)};
  root.querySelectorAll('#ftso button').forEach(b=>b.onclick=()=>{S.sort=b.dataset.k;draw(root,F)});
  root.querySelectorAll('.ft-row').forEach(b=>b.onclick=()=>{const y=scrollY;S.pick=b.dataset.t;draw(root,F);scrollTo(0,y);const n=root.querySelector('.ft-row.on');if(n)n.focus({preventScroll:true})});
 }
 INS.ar({'Fortress':'قلعة البيت'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
