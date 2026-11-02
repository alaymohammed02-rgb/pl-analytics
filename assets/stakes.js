/* ===== Matches that matter (#/stakes, in the Matches hub after Late show): how much each coming match can move the title, top-four and bottom-three chances =====
   The Time machine's season simulation, run for the next scheduled matches. From data/results.json (the season under way) and INS.eloKit: each club's Club Elo rating today
   (frozen), the points it has, and every home/away pairing of the season not yet played with Elo's chances (ordered logit). The rest of the season is simulated 4,000 times with
   a seeded generator (title = first, top four, bottom three; ties on points broken by the rating). For each of the next 12 scheduled matches (data/fixtures.json) that is still
   to be played, the same 4,000 draws are used three times with that one match fixed as a home win, a draw and an away win, so the three answers differ only because of that
   match (common random numbers). The swing of a club's chance is the largest of the three minus the smallest, in percentage points; the headline of a match is its biggest
   swing among the two clubs and the three targets, and the list is ordered by it (or by date). Not in it: injuries, form beyond Elo, the real tie-break rules, European places
   other than the top four, play-offs: the third number is "bottom three" in every league. Differences of about a point or less are within the noise of 4,000 simulations. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('stakes','Matches that matter','matches','late');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const SIMS=4000,NFIX=12,TG=[['title','Title','اللقب'],['top4','Top four','المراكز الأربعة'],['bot3','Bottom three','المراكز الثلاثة الأخيرة']];
 const S={lg:'',sort:'stakes',tok:0};
 let CF=null,CK='';
 function load(){
  if(CF&&CK===INS.poolKey())return CF;
  CK=INS.poolKey();
  const opt=n=>loadJson(n,ALL.generated).catch(()=>null);
  const p=Promise.all([loadJson('results.json',ALL.generated),opt('fixtures.json')]).then(([F,X])=>{if(!F||!F.leagues||!Object.keys(F.leagues).length||!F.params)throw new Error('results');return {F,X}}).catch(e=>{if(CF===p)CF=null;throw e});
  CF=p;return p;
 }
 const tick=()=>new Promise(r=>setTimeout(r,0));
 /* The simulation. o = {n, base[n] points now, R0[n] ratings (tie-break), pairs[[hi,ai,pH,pHD]], fix[pair index], sims, seed, stop()}.
    Returns {base[n][3], sc[k][o][n][3]} for the k-th fixed pair and outcome o (0 home win, 1 draw, 2 away win); the three numbers are P(title), P(top four), P(bottom three). */
 async function engine(o){
  const n=o.n,M=o.pairs.length,Sm=o.sims,rnd=INS.eloKit.rng(o.seed);
  const U=new Float32Array(Sm*M),P0=new Float64Array(Sm*n);
  for(let i=0;i<U.length;i++)U[i]=rnd();
  /* tie-break order: a higher rating first, then the name; one integer per club so every key is unique */
  const ord=o.R0.map((r,i)=>i).sort((a,b)=>o.R0[b]-o.R0[a]||(o.names[a]<o.names[b]?-1:o.names[a]>o.names[b]?1:0)),tie=new Array(n);ord.forEach((c,k)=>{tie[c]=n-k});
  const put=(row,j,oc,sg)=>{const p=o.pairs[j];if(oc===0)row[p[0]]+=3*sg;else if(oc===1){row[p[0]]+=sg;row[p[1]]+=sg}else row[p[1]]+=3*sg};
  const of=(u,p)=>u<p[2]?0:u<p[3]?1:2;
  const row=new Float64Array(n),keys=new Float64Array(n),srt=new Float64Array(n);
  const tally=(r,c)=>{for(let i=0;i<n;i++){keys[i]=r[i]*1000+tie[i];srt[i]=keys[i]}srt.sort();
   const k1=srt[n-1],k4=srt[n-4],b3=srt[2];for(let i=0;i<n;i++){const k=keys[i];if(k>=k1)c[i*3]++;if(k>=k4)c[i*3+1]++;if(k<=b3)c[i*3+2]++}};
  for(let s=0;s<Sm;s++){for(let i=0;i<n;i++)row[i]=o.base[i];for(let j=0;j<M;j++)put(row,j,of(U[s*M+j],o.pairs[j]),1);for(let i=0;i<n;i++)P0[s*n+i]=row[i]}
  const cnt0=new Float64Array(n*3);for(let s=0;s<Sm;s++){for(let i=0;i<n;i++)row[i]=P0[s*n+i];tally(row,cnt0)}
  const out={base:[...Array(n).keys()].map(i=>[cnt0[i*3]/Sm,cnt0[i*3+1]/Sm,cnt0[i*3+2]/Sm]),sc:[]};
  for(const jf of o.fix){
   if(o.stop&&o.stop())return null;
   const res=[];
   for(let oc=0;oc<3;oc++){
    const c=new Float64Array(n*3);
    for(let s=0;s<Sm;s++){for(let i=0;i<n;i++)row[i]=P0[s*n+i];put(row,jf,of(U[s*M+jf],o.pairs[jf]),-1);put(row,jf,oc,1);tally(row,c)}
    res.push([...Array(n).keys()].map(i=>[c[i*3]/Sm,c[i*3+1]/Sm,c[i*3+2]/Sm]));
   }
   out.sc.push(res);
   await tick();
  }
  return out;
 }
 /* the season under way of a league: clubs, points now, ratings, unplayed pairings, and the scheduled matches to analyse */
 function setup(F,X,id){
  const K=INS.eloKit,L=K.league(F,id),cur=L.seasons[L.seasons.length-1],r=K.run(L.all,F.params);
  const names=[...new Set(cur.ms.flatMap(m=>[m.h,m.a]))].sort(K.cmp),n=names.length,ix=new Map(names.map((t,i)=>[t,i]));
  const base=new Array(n).fill(0),played=new Set();
  for(const m of cur.ms){const h=ix.get(m.h),a=ix.get(m.a);played.add(m.h+'|'+m.a);if(m.hg>m.ag)base[h]+=3;else if(m.hg<m.ag)base[a]+=3;else{base[h]++;base[a]++}}
  let mean=0;for(const v of r.final.values())mean+=v;mean=r.final.size?mean/r.final.size:1500;
  const R0=names.map(t=>r.final.has(t)?r.final.get(t):mean);
  const pairs=[],pidx=new Map();
  for(const h of names)for(const a of names){if(h===a||played.has(h+'|'+a))continue;const p=K.probs(R0[ix.get(h)]-R0[ix.get(a)]+F.params.H,F.params);pidx.set(h+'|'+a,pairs.length);pairs.push([ix.get(h),ix.get(a),p[0],p[0]+p[1],p]);}
  const fx=[];
  for(const x of ((X&&X.leagues&&X.leagues[id])||[]).slice().sort((p,q)=>K.cmp(p.k||p.d,q.k||q.d)||K.cmp(p.i,q.i))){
   const j=pidx.get(x.h+'|'+x.a);if(j==null||fx.length>=NFIX)continue;fx.push({j,i:x.i,d:x.d,k:x.k,h:x.h,a:x.a});
  }
  return {L,names,n,base,R0,pairs,fx,season:cur.s,played:cur.ms.length,seed:id+'|'+cur.s+'|stakes|'+cur.ms.length};
 }
 const cache=new Map();
 async function compute(F,X,id,stop){
  const k=id+'|'+F.key+'|'+(X?X.t:'')+'|'+INS.poolKey();if(cache.has(k))return cache.get(k);
  const st=setup(F,X,id);
  const e=st.fx.length?await engine({n:st.n,names:st.names,base:st.base,R0:st.R0,pairs:st.pairs,fix:st.fx.map(f=>f.j),sims:SIMS,seed:st.seed,stop}):{base:[],sc:[]};
  if(!e)return null;
  /* per match: the two clubs x three targets */
  const ms=st.fx.map((f,q)=>{
   const hi=st.pairs[f.j][0],ai=st.pairs[f.j][1],p=st.pairs[f.j][4];
   const rows=[];
   for(const [ci,home] of [[hi,true],[ai,false]])for(let t=0;t<3;t++){
    const v=[e.sc[q][0][ci][t],e.sc[q][1][ci][t],e.sc[q][2][ci][t]];   /* home win, draw, away win */
    const w=home?[v[0],v[1],v[2]]:[v[2],v[1],v[0]];                    /* from the club's side: win, draw, defeat */
    rows.push({club:st.names[ci],home,t,now:e.base[ci][t],h:v[0],d:v[1],a:v[2],w:w[0],dr:w[1],l:w[2],swing:Math.max(...v)-Math.min(...v)});
   }
   const top=rows.reduce((b,r)=>r.swing>b.swing+1e-12?r:b,rows[0]);
   return {...f,p,rows,top,sum:rows.reduce((s,r)=>s+r.swing,0)};
  });
  const res={st,e,ms};cache.set(k,res);return res;
 }
 INS.stakes={engine,setup,compute};
 R.stakes=async function(el){
  el.innerHTML='<h2>Matches that matter</h2><div id="skroot" class="ins lk sk"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#skroot'),lg=D.id,tok=++S.tok;
  let W;try{W=await load()}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The results are not available right now.','النتائج مو متوفرة الحين.')}</div>`;return}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  if(!W.F.leagues[S.lg])S.lg=W.F.leagues[lg]?lg:Object.keys(W.F.leagues)[0];
  await show(root,W,tok);
 };
 const pcT=x=>x>0&&x<0.005?'<1%':x<1&&x>0.995?'>99%':Math.round(x*100)+'%';
 const pts=x=>x>0&&x<0.005?'<1':String(Math.round(x*100));
 async function show(root,W,tok){
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Where will the next matches be felt?</b> For each coming match, the season is played out 4,000 times with that match fixed as a home win, a draw and an away win. The swing is how far a club\'s chance of the title, of the top four or of the bottom three moves between the best and the worst result. It does not say who will win.','<b>وين بنحس بالمباريات الجاية؟</b> لكل مباراة جاية، يتلعب باقي الموسم 4,000 مرة والمباراة مثبّتة مرة فوز للمضيف ومرة تعادل ومرة فوز للضيف. التأرجح هو كم تتحرك فرصة النادي في اللقب أو المراكز الأربعة أو المراكز الثلاثة الأخيرة بين أفضل نتيجة وأسوأها. ما يقول مين بيفوز.')}</p></div>
   <div class="card"><div class="ctl"><label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="skg">${Object.keys(W.F.leagues).map(i=>`<option value="${esc(i)}"${i===S.lg?' selected':''}>${esc(W.F.leagues[i].name||i)}</option>`).join('')}</select></label>
    <div class="seg" id="skso" role="group" aria-label="${ar()?'الترتيب':'Order by'}">${[['stakes','Most at stake','الأكثر أهمية'],['date','Date','التاريخ']].map(([k,e,a])=>`<button type="button" data-k="${k}" aria-pressed="${S.sort===k}" class="${S.sort===k?'on':''}">${two(e,a)}</button>`).join('')}</div></div></div>
   <div id="skbody"><div class="card"><div class="empty skel">${two('Playing out the season 4,000 times…','نلعب الموسم 4,000 مرة…')}</div></div></div>`;
  const q=s=>root.querySelector(s);
  q('#skg').onchange=e=>{S.lg=e.target.value;show(root,W,++S.tok)};
  root.querySelectorAll('#skso button').forEach(b=>b.onclick=()=>{S.sort=b.dataset.k;root.querySelectorAll('#skso button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});if(root._r)body(root,root._r)});
  await tick();
  if(!root.isConnected||tok!==S.tok)return;
  let r;try{r=await compute(W.F,W.X,S.lg,()=>!root.isConnected||tok!==S.tok)}catch(e){r=null}
  if(!r||!root.isConnected||tok!==S.tok)return;
  root._r=r;body(root,r);
 }
 function body(root,r){
  const host=root.querySelector('#skbody');if(!host)return;
  const st=r.st,ms=r.ms.slice();
  if(S.sort==='stakes')ms.sort((a,b)=>b.top.swing-a.top.swing||b.sum-a.sum||INS.eloKit.cmp(a.k||a.d,b.k||b.d)||INS.eloKit.cmp(a.i,b.i));
  else ms.sort((a,b)=>INS.eloKit.cmp(a.k||a.d,b.k||b.d)||INS.eloKit.cmp(a.i,b.i));
  if(!st.pairs.length){host.innerHTML=`<div class="card"><div class="empty">${two('Every match of this season has been played.','كل مباريات هالموسم انلعبت.')}</div></div>`;return}
  if(!ms.length){host.innerHTML=`<div class="card"><div class="empty">${two('None of the next scheduled matches is a pairing still to be played this season.','ما فيه مباراة جاية في الجدول من المباريات المتبقية في هالموسم.')}</div></div>`;return}
  const tn=t=>ar()?TG[t][2]:TG[t][1];
  const line=m=>{const x=m.top,tg=TG[x.t];
   return two(`<b>${esc(x.club)}</b>: ${tg[1].toLowerCase()} chance <b>${pcT(x.w)}</b> with a win, ${pcT(x.dr)} with a draw, ${pcT(x.l)} with a defeat (a ${pts(x.swing)}-point swing).`,
    `<b>${nm(x.club)}</b>: فرصة ${tg[2]} <b>${nb(pcT(x.w))}</b> مع الفوز، ${nb(pcT(x.dr))} مع التعادل، ${nb(pcT(x.l))} مع الخسارة (تأرجح ${nb(pts(x.swing))} نقطة).`)};
  host.innerHTML=ms.map((m,k)=>{const small=m.top.swing<0.01;
   return `<details class="card sk-m${small?' sk-lo':''}" data-i="${esc(m.i)}" data-swing="${m.top.swing.toFixed(5)}"${k<3&&S.sort==='stakes'&&!small?' open':''}><summary><span class="sk-t"><b>${nm(m.h)}</b> <span class="mu">${two('v','ضد')}</span> <b>${nm(m.a)}</b></span><span class="sk-d mu">${nb(esc(m.d))}</span><span class="sk-s" title="${ar()?'التأرجح الأكبر':'Biggest swing'}">${nb(pts(m.top.swing))}</span></summary>
    <p class="sk-l">${small?two('Little is at stake here: no club\'s chance moves by as much as a point.','ما فيه شي كثير على المحك: ما فيه نادي تتحرك فرصته بنقطة وحدة.'):line(m)}</p>
    <p class="mu sk-p">${two(`Elo's chances: ${esc(m.h)} ${pcT(m.p[0])} · draw ${pcT(m.p[1])} · ${esc(m.a)} ${pcT(m.p[2])}.`,`احتمالات Elo: ${nm(m.h)} ${nb(pcT(m.p[0]))} · تعادل ${nb(pcT(m.p[1]))} · ${nm(m.a)} ${nb(pcT(m.p[2]))}.`)}</p>
    <div class="sk-wr"><table class="lk-t sk-tb"><thead><tr><th>${two('Club','النادي')}</th><th>${two('Chance of','فرصة')}</th><th class="n">${two('Now','الحين')}</th><th class="n">${two('If '+esc(m.h)+' win','لو فاز '+esc(m.h))}</th><th class="n">${two('Draw','تعادل')}</th><th class="n">${two('If '+esc(m.a)+' win','لو فاز '+esc(m.a))}</th><th class="n">${two('Swing','التأرجح')}</th></tr></thead>
    <tbody>${m.rows.map(x=>`<tr class="sk-r" data-c="${esc(x.club)}" data-t="${TG[x.t][0]}" data-now="${x.now.toFixed(5)}" data-h="${x.h.toFixed(5)}" data-d="${x.d.toFixed(5)}" data-a="${x.a.toFixed(5)}"><td>${nm(x.club)}</td><td>${two(TG[x.t][1],TG[x.t][2])}</td><td class="n">${nb(pcT(x.now))}</td><td class="n">${nb(pcT(x.h))}</td><td class="n">${nb(pcT(x.d))}</td><td class="n">${nb(pcT(x.a))}</td><td class="n"><b>${nb(pts(x.swing))}</b></td></tr>`).join('')}</tbody></table></div></details>`}).join('')
   +`<div class="card"><p class="mu ins-note">${two(`${st.n} clubs, ${st.played} matches played in ${esc(st.season)}, ${st.pairs.length} pairings still to play. Club Elo ratings as of today are held fixed; the rest of the season is simulated 4,000 times, and the three scenarios of a match use the same draws. Ties on points are broken by the rating, not by the real rules, and the third number is the bottom three in every league. Swings of about a point or less are within the noise of the simulation. Injuries and form beyond Elo are not in it.`,`${nb(st.n)} نادي، و${nb(st.played)} مباراة انلعبت في ${nb(esc(st.season))}، و${nb(st.pairs.length)} مواجهة باقية. تصنيفات Club Elo اليوم مثبّتة، وباقي الموسم يتحاكى 4,000 مرة، وسيناريوهات المباراة الثلاثة تستخدم نفس السحوبات. التعادل في النقاط يُكسر بالتصنيف مو بالقواعد الحقيقية، والرقم الثالث هو المراكز الثلاثة الأخيرة في كل دوري. تأرجح بحدود نقطة أو أقل ضمن ضوضاء المحاكاة. الإصابات والمستوى خارج Elo مو داخلين.`)}</p></div>`;
 }
 INS.ar({'Matches that matter':'مباريات تهمّ'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
