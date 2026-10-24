/* ===== Beat the model (#/beat, in Fantasy after the Intelligence Lab): your score predictions against the site's model =====
   Fixtures: PitchAPI's fixture list (data/fixtures.json) of the open league, from now to BM_DAYS days ahead.
   The model: the site's "xG Poisson" (labMatchModel, version 2 when the league has last-season numbers, as in the Intelligence Lab and the match preview). Its pick is the score
   with the most expected points under this game's rules (exact score 3, right result 1): it maximises 2 × P(score) +
   P(result of that score) over scores up to 5 goals a side. Its pick is sealed with your prediction, from the data of that
   moment, and shown only from kick-off. Predictions can be changed until kick-off.
   Results: each league's own data file once the match is in it. Everything stays in this browser (localStorage, plx_btm_v1). */
(function(){
 if(typeof R!=='object'||typeof INS!=='object')return;
 INS.addPage('beat','Beat the model','fpl','lab');
 const KEY='plx_btm_v1',BM_DAYS=14,MAXG=5;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const lc=()=>document.documentElement.lang==='ar'?'ar-u-ca-gregory-nu-latn':'en-GB';
 const read=()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o&&o.v===1&&Array.isArray(o.p))return o.p.filter(x=>x&&typeof x.mid==='string'&&Number.isInteger(x.hs)&&Number.isInteger(x.as))}catch(e){}return []};
 const write=p=>{try{localStorage.setItem(KEY,JSON.stringify({v:1,p}));return true}catch(e){return false}};
 const res=(h,a)=>h>a?'H':h<a?'A':'D';
 const pts=(ph,pa,h,a)=>ph===h&&pa===a?3:res(ph,pa)===res(h,a)?1:0;
 const pois=l=>{const o=[];let p=Math.exp(-l);for(let k=0;k<=10;k++){o.push(p);p*=l/(k+1)}return o};
 /* the model's pick: the score with the most expected points under this game's rules */
 function pick(lh,la){const a=pois(lh),b=pois(la);let w=0,d=0,l=0;for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const q=a[i]*b[j];if(i>j)w+=q;else if(i===j)d+=q;else l+=q}
  const P={H:w,D:d,A:l};let best=null;for(let i=0;i<=MAXG;i++)for(let j=0;j<=MAXG;j++){const e=2*a[i]*b[j]+P[res(i,j)];if(!best||e>best.e+1e-12)best={hs:i,as:j,e}}
  return {hs:best.hs,as:best.as,p:[w,d,l],lh,la}}
 /* results of saved predictions, from each league's data file (the open league from memory) */
 async function settle(P){
  const due=P.filter(x=>!x.r&&Date.now()>=Date.parse(x.k));if(!due.length)return false;let ch=false;
  for(const lid of [...new Set(due.map(x=>x.lid))]){let M=null;
   if(D&&D.id===lid)M=D.matches.map(m=>({i:m.match_id,s:m.score}));
   else{const m=(ALL.leagues||[]).find(l=>l.id===lid);if(!m||!m.file)continue;try{const j=await loadJson(m.file,m.v||ALL.generated);M=(j.matches||[]).map(z=>({i:z.i,s:z.s}))}catch(e){continue}}
   const by=new Map(M.map(m=>[m.i,m]));
   due.filter(x=>x.lid===lid).forEach(x=>{const m=by.get(x.mid),g=m&&wkSc(m.s);if(!g)return;
    x.r={h:g[0],a:g[1],you:pts(x.hs,x.as,g[0],g[1]),mod:x.m?pts(x.m.hs,x.m.as,g[0],g[1]):null};ch=true})}
  if(ch)write(P);return ch;
 }
 R.beat=async function(el){
  el.innerHTML='<h2>Beat the model</h2><div id="bmroot" class="ins btm"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#bmroot'),lid=D.id;
  await (typeof fixLoad==='function'?fixLoad():null);
  const mm=typeof labMatchModel==='function'?await labMatchModel().catch(()=>null):null;
  let P=read();await settle(P);if(!root.isConnected||D.id!==lid)return;
  const now=Date.now(),soon=now+BM_DAYS*864e5;
  const FX=((((typeof FIX==='object'&&FIX.d&&FIX.d.leagues)||{})[lid])||[]).filter(x=>{const t=Date.parse(x.k||x.d);return t>now&&t<soon}).sort((a,b)=>String(a.k||a.d).localeCompare(String(b.k||b.d)));
  const paint=()=>{
   P=read();const done=P.filter(x=>x.r),wait=P.filter(x=>!x.r&&Date.now()>=Date.parse(x.k));
   /* the duel counts only matches the model had a pick for, so both totals cover the same matches */
   const hh=done.filter(x=>x.r.mod!=null),solo=done.filter(x=>x.r.mod==null),soloPts=solo.reduce((s,x)=>s+x.r.you,0);
   const you=hh.reduce((s,x)=>s+x.r.you,0),mod=hh.reduce((s,x)=>s+x.r.mod,0);
   const ex=hh.filter(x=>x.r.you===3).length,ok1=hh.filter(x=>x.r.you>=1).length,mex=hh.filter(x=>x.r.mod===3).length,mok=hh.filter(x=>x.r.mod>=1).length;
   const day=t=>new Date(t).toLocaleDateString(lc(),{weekday:'long',day:'numeric',month:'long'}),hm=t=>new Date(t).toLocaleTimeString(lc(),{hour:'2-digit',minute:'2-digit'});
   const groups=[];FX.forEach(x=>{const d=day(x.k||x.d);let g=groups.find(z=>z.d===d);if(!g){g={d,L:[]};groups.push(g)}g.L.push(x)});
   const mine=new Map(P.map(x=>[x.mid,x]));
   root.innerHTML=`<div class="card bm-board"><div class="bm-vs"><div class="bm-s you"><b>${nb(you)}</b><span>You</span></div><span class="bm-x">${hh.length?(you>mod?two('You lead','أنت متقدم'):you<mod?two('The model leads','النموذج متقدم'):two('Level','تعادل')):two('No results yet','ما فيه نتائج للحين')}</span><div class="bm-s mod"><b>${nb(mod)}</b><span>Model</span></div></div>
     <p class="mu bm-sub">${two(`${hh.length} matches played · exact scores: you ${ex}, model ${mex} · right results: you ${ok1}, model ${mok}`,`${nb(hh.length)} مباراة انلعبت · نتائج بالضبط: أنت ${nb(ex)}، النموذج ${nb(mex)} · نتيجة صحيحة: أنت ${nb(ok1)}، النموذج ${nb(mok)}`)}</p>
     ${solo.length?`<p class="mu bm-sub">${two(`Not in the duel: ${solo.length} match(es) the model had no pick for (too few matches with shot data then); you scored ${soloPts} there.`,`خارج المواجهة: ${nb(solo.length)} مباراة ما كان للنموذج فيها توقع (مباريات قليلة ببيانات التسديد وقتها)؛ جبت فيها ${nb(soloPts)}.`)}</p>`:''}
     <p class="mu bm-rules">${two('Exact score: 3 points. Right result (win, draw or loss): 1 point. The model\'s pick is sealed when you save yours and shown from kick-off.','النتيجة بالضبط: 3 نقاط. النتيجة الصحيحة (فوز أو تعادل أو خسارة): نقطة. توقع النموذج ينختم لما تحفظ توقعك ويظهر من بداية المباراة.')}</p></div>
    <div class="card"><h3><span>Upcoming</span> · ${nm(D.name)}</h3>${groups.length?groups.map(g=>`<h4 class="bm-day">${esc(g.d)}</h4><ul class="bm-fx">${g.L.map(x=>{const s=mine.get(x.i);
      return `<li data-mid="${esc(x.i)}"><span class="bm-t mu">${esc(hm(x.k||x.d))}</span><span class="bm-h">${nm(x.h)}</span>
       <span class="bm-sc">${inp('h',s?s.hs:null)}<i>–</i>${inp('a',s?s.as:null)}</span><span class="bm-a">${nm(x.a)}</span>
       <span class="bm-st">${s?`<span class="bm-ok">✓ <span>Prediction saved</span></span>`:`<span class="mu">${two('Not predicted','ما توقعت')}</span>`}</span></li>`}).join('')}</ul>`).join(''):`<div class="empty">${two(`No ${esc(D.name)} fixtures in the next ${BM_DAYS} days in the data. Choose another league at the top.`,`ما فيه مباريات لـ${nm(D.name)} في الـ${nb(BM_DAYS)} يوم الجاية في البيانات. اختر دوري ثاني من فوق.`)}</div>`}
     ${mm?'':`<p class="mu ins-note">${two('The model needs more matches with shot data in this league before it can pick: your predictions still count.','النموذج يحتاج مباريات أكثر ببيانات التسديد في هالدوري قبل ما يتوقع: توقعاتك تنحسب عادي.')}</p>`}</div>
    ${wait.length?`<div class="card"><h3>Waiting for the result</h3><ul class="bm-hist">${wait.map(x=>row(x)).join('')}</ul></div>`:''}
    <div class="card"><h3>Results</h3>${done.length?`<ul class="bm-hist">${done.slice().sort((a,b)=>b.k.localeCompare(a.k)).map(x=>row(x)).join('')}</ul>`:`<div class="empty">${two('Your scored predictions appear here after the final whistle.','توقعاتك المحسوبة تظهر هنا بعد صافرة النهاية.')}</div>`}
     ${P.length?`<div class="ctl"><button type="button" class="s" id="bmwipe">Delete all my predictions</button></div>`:''}
     <p class="mu ins-note">${two('Saved in this browser only. The model is the site\'s xG model (each club\'s chances created and allowed this season); its pick is the score that earns the most points on average under these rules.','محفوظة في هذا المتصفح بس. النموذج هو نموذج xG حق الموقع (فرص كل نادي له وعليه هالموسم)؛ توقعه هو النتيجة اللي تجيب أكثر نقاط بالمتوسط بهالقوانين.')}</p></div>`;
   root.querySelectorAll('.bm-fx li').forEach(li=>{const mid=li.dataset.mid,x=FX.find(f=>f.i===mid);
    li.querySelectorAll('button[data-d]').forEach(b=>b.addEventListener('click',()=>{const i=li.querySelector(`input[data-s="${b.dataset.s}"]`);const v=Math.max(0,Math.min(15,(i.value===''?0:+i.value)+(+b.dataset.d)));i.value=v;save(li,x)}));
    li.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>save(li,x)))});
   const w=root.querySelector('#bmwipe');if(w)w.onclick=()=>{if(confirm('Delete all your Beat the model predictions from this browser? This cannot be undone.')){write([]);paint()}};
  };
  const inp=(s,v)=>`<span class="bm-in"><button type="button" data-s="${s}" data-d="-1" aria-label="${s==='h'?'Home':'Away'} goals minus one">−</button><input type="number" min="0" max="15" inputmode="numeric" data-s="${s}" value="${v==null?'':v}" aria-label="${s==='h'?'Home':'Away'} goals"><button type="button" data-s="${s}" data-d="1" aria-label="${s==='h'?'Home':'Away'} goals plus one">+</button></span>`;
  const save=(li,x)=>{const h=li.querySelector('input[data-s="h"]').value,a=li.querySelector('input[data-s="a"]').value;
   if(Date.now()>=Date.parse(x.k||x.d)){paint();return}
   if(h===''||a===''){if(h===''&&a==='')return;const o=li.querySelector(h===''?'input[data-s="h"]':'input[data-s="a"]');o.value=0}
   const hs=Math.max(0,Math.min(15,Math.round(+li.querySelector('input[data-s="h"]').value))),as=Math.max(0,Math.min(15,Math.round(+li.querySelector('input[data-s="a"]').value)));
   const P_=read(),i=P_.findIndex(p=>p.mid===x.i),old=i>=0?P_[i]:null;
   const m=old&&old.m!==undefined?old.m:(()=>{const r=mm?mm(x.h,x.a):null;return r?pick(r.lh,r.la):null})();
   const rec={lid:D.id,ln:D.name,mid:x.i,h:x.h,a:x.a,k:new Date(Date.parse(x.k||x.d)).toISOString(),at:old?old.at:new Date().toISOString(),hs,as,m};
   if(i>=0)P_[i]=rec;else P_.push(rec);if(!write(P_)){li.querySelector('.bm-st').textContent='Not saved: storage blocked';return}
   const st=li.querySelector('.bm-st');st.innerHTML=`<span class="bm-ok">✓ <span>Prediction saved</span></span>`;
  };
  const row=x=>{const started=Date.now()>=Date.parse(x.k),r=x.r,lab=v=>v==null?'':v===3?'bm-3':v===1?'bm-1':'bm-0';
   const tag=x.lid===D.id?`a href="#/match/${encodeURIComponent(x.mid)}"`:'div class="bm-row"',end=x.lid===D.id?'a':'div';
   return `<li><${tag}><span class="bm-hm"><span class="mu">${esc(new Date(x.k).toLocaleDateString(lc(),{day:'numeric',month:'short'}))}${x.lid!==D.id?' · '+esc(x.ln):''}</span> ${nm(x.h)} ${r?`<b>${nb(r.h+'–'+r.a)}</b>`:'<b>?</b>'} ${nm(x.a)}</span>
    <span class="bm-p ${lab(r&&r.you)}"><span>You</span> ${nb(x.hs+'–'+x.as)}${r?` <b>${nb('+'+r.you)}</b>`:''}</span>
    <span class="bm-p ${lab(r&&r.mod)}"><span>Model</span> ${x.m?(started?nb(x.m.hs+'–'+x.m.as):'🔒'):'–'}${r&&r.mod!=null?` <b>${nb('+'+r.mod)}</b>`:''}</span></${end}></li>`};
  paint();
 };
 INS.ar({"Beat the model":"تغلب على النموذج","You":"أنت","Model":"النموذج","Prediction saved":"انحفظ التوقع","Upcoming":"الجاية","Waiting for the result":"ننتظر النتيجة","Results":"النتائج",
  "Delete all my predictions":"احذف كل توقعاتي","Home goals":"أهداف المستضيف","Away goals":"أهداف الضيف","Home goals minus one":"أهداف المستضيف ناقص واحد","Home goals plus one":"أهداف المستضيف زائد واحد",
  "Away goals minus one":"أهداف الضيف ناقص واحد","Away goals plus one":"أهداف الضيف زائد واحد","Not saved: storage blocked":"ما انحفظ: التخزين ممنوع"});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
