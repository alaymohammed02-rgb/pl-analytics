/* ===== Weekly digest (#/digest, League room, Stories of the season group): one week of the open league in numbers =====
   A week is Monday to Sunday by the match date (the Title race's weeks). From the finished matches of the open league (D.matches) the page gives, for the chosen week: matches, goals,
   home wins / draws / away wins; the biggest surprises (the result with the smallest pre-match chance in data/elo_own.json's own Elo chances, in bits); the biggest wins and the
   matches with most goals; the table movers (position after the week against the position after the week before, ltTable); the best single ratings of the week (PitchAPI match
   ratings, rt + pl files); how the Prediction ledger's frozen chances (data/ledger.json) scored on the week's matches (Brier and how often the likeliest result happened, the
   Prediction ledger's own measures; a few matches are a small sample and the page says so). It can be saved as a 1080 x 1350 picture (INS.cardKit.savePng). Nothing is estimated
   here beyond Elo's chances. A notification for the digest is not built. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('digest','Weekly digest','league','race');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const S={wk:'',tok:0};
 const MODELS=[['e','Elo','إيلو'],['m2','xG model','نموذج xG'],['xi','XI model','نموذج التشكيلة'],['bl','Elo + XI','إيلو + التشكيلة']];
 const monday=d=>{const t=Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)),w=(new Date(t).getUTCDay()+6)%7;return new Date(t-w*864e5).toISOString().slice(0,10)};
 const sunday=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7)-1,+m.slice(8,10))+6*864e5).toISOString().slice(0,10);
 const out3=g=>g[0]>g[1]?0:g[0]===g[1]?1:2;
 /* everything for one week (exported for the test) */
 function digest(fin,wk,E,LD,P,RT){
  const end=sunday(wk),prevEnd=sunday(new Date(Date.UTC(+wk.slice(0,4),+wk.slice(5,7)-1,+wk.slice(8,10))-7*864e5).toISOString().slice(0,10));
  const ms=fin.filter(m=>m.date>=wk&&m.date<=end),g=m=>wkSc(m.score);
  const goals=ms.reduce((s,m)=>s+g(m)[0]+g(m)[1],0),res=[0,0,0];ms.forEach(m=>res[out3(g(m))]++);
  const pred=(E&&E.pred)||{};
  const sur=ms.filter(m=>pred[m.match_id]).map(m=>{const p=pred[m.match_id],o=out3(g(m));return {m,o,p,bits:-Math.log2(Math.max(p[o],1e-9))}}).sort((a,b)=>b.bits-a.bits||String(a.m.match_id).localeCompare(String(b.m.match_id)));
  const wins=ms.filter(m=>g(m)[0]!==g(m)[1]).map(m=>({m,d:Math.abs(g(m)[0]-g(m)[1]),t:g(m)[0]+g(m)[1]})).sort((a,b)=>b.d-a.d||b.t-a.t||String(a.m.match_id).localeCompare(String(b.m.match_id)));
  const most=ms.map(m=>({m,t:g(m)[0]+g(m)[1]})).sort((a,b)=>b.t-a.t||String(a.m.match_id).localeCompare(String(b.m.match_id)));
  const T1=ltTable(fin.filter(m=>m.date<=end),new Map()),T0=ltTable(fin.filter(m=>m.date<=prevEnd),new Map());
  const p0=new Map(T0.map((r,i)=>[r.t,i+1])),mov=T1.map((r,i)=>({t:r.t,now:i+1,was:p0.get(r.t),pts:r.pts})).filter(x=>x.was&&x.was!==x.now).map(x=>Object.assign(x,{d:x.was-x.now}));
  const up=mov.filter(x=>x.d>0).sort((a,b)=>b.d-a.d||a.now-b.now||a.t.localeCompare(b.t)).slice(0,3),down=mov.filter(x=>x.d<0).sort((a,b)=>a.d-b.d||a.now-b.now||a.t.localeCompare(b.t)).slice(0,3);
  let best=[];
  if(P&&P.rows&&RT&&RT.m){const c={};P.cols.forEach((k,i)=>c[k]=i);const nameOf={},clubOf={},top={};
   P.rows.forEach(r=>{nameOf[r[c.i]]=r[c.n];clubOf[r[c.m]+'|'+r[c.i]]=r[c.c]});
   ms.forEach(m=>{const M=RT.m[m.match_id];if(!M)return;for(const [pid,v] of Object.entries(M)){if(v==null)continue;const t=top[pid];if(!t||v>t.v)top[pid]={id:pid,v,mid:m.match_id,club:clubOf[m.match_id+'|'+pid]||''}}});
   best=Object.values(top).filter(x=>nameOf[x.id]).map(x=>Object.assign(x,{n:nameOf[x.id]})).sort((a,b)=>b.v-a.v||a.n.localeCompare(b.n)).slice(0,5)}
  const led=MODELS.map(([k,en,ar])=>{let n=0,br=0,hit=0;ms.forEach(m=>{const L=LD&&LD.p&&LD.p[m.match_id],v=L&&L[k];if(!v)return;const o=out3(g(m));n++;br+=[0,1,2].reduce((s,i)=>s+(v[i]-(i===o?1:0))**2,0);hit+=v.indexOf(Math.max(...v))===o});return {k,en,ar,n,brier:n?br/n:null,hit}}).filter(x=>x.n);
  return {wk,end,ms,goals,res,sur:sur.slice(0,3),wins:wins.slice(0,3),most:most.slice(0,3),up,down,best,led};
 }
 INS.digest={digest,monday,sunday};
 const nameOf=(m,s)=>nm(s==='h'?m.home:m.away);
 const sc=m=>{const g=wkSc(m.score);return nb(g[0]+' - '+g[1])};
 const mrow=m=>`<a href="#/match/${encodeURIComponent(m.match_id)}">${nm(m.home)} ${sc(m)} ${nm(m.away)}</a>`;
 function card(d,lg){
  const W=1080,H=1350,x_=INS.cardKit.x_,F=INS.cardKit.FONT,L=[];let y=190;
  const line=(t,sz,w,col,dy)=>{L.push(`<text x="70" y="${y}" font-size="${sz}" font-weight="${w||400}" fill="${col||'#e6f2f0'}">${x_(t)}</text>`);y+=dy||sz+14};
  line(lg+' · weekly digest',34,700,'#8fd3c8',54);line(d.wk+' to '+d.end,26,400,'#9db8b4',60);
  line(d.ms.length+' matches · '+d.goals+' goals · '+(d.ms.length?(d.goals/d.ms.length).toFixed(2):'0')+' per match',34,600,'#fff',50);
  line('Home wins '+d.res[0]+' · draws '+d.res[1]+' · away wins '+d.res[2],28,400,'#cfe3e0',70);
  const sect=(t,rows)=>{if(!rows.length)return;line(t,30,700,'#ffb703',44);rows.forEach(r=>line(r,27,400,'#e6f2f0',40));y+=22};
  sect('Biggest surprises',d.sur.map(s=>s.m.home+' '+wkSc(s.m.score).join('-')+' '+s.m.away+' ('+Math.round(s.p[s.o]*100)+'% chance)'));
  sect('Biggest wins',d.wins.map(s=>s.m.home+' '+wkSc(s.m.score).join('-')+' '+s.m.away));
  sect('Risers',d.up.map(r=>r.t+' '+r.was+' → '+r.now));sect('Fallers',d.down.map(r=>r.t+' '+r.was+' → '+r.now));
  sect('Best ratings',d.best.map(b=>b.n+' '+b.v.toFixed(1)));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${F}'><rect width="${W}" height="${H}" fill="#0a1a1e"/><circle cx="${W}" cy="${H*.55}" r="260" fill="none" stroke="#27474a" stroke-width="6"/>${L.join('')}<text x="70" y="${H-50}" font-size="22" fill="#6f8f8b">PL Analytics · Elo chances from the site's own ratings</text></svg>`;
  return {svg,W,H};
 }
 async function files(){
  const l=(ALL.leagues||[]).find(x=>x.id===D.id)||{};
  const get=async(f,v)=>{if(!f)return null;try{return await loadJson(f,v)}catch(e){return null}};
  const [E,LD,P,RT]=await Promise.all([get('elo_own.json',ALL.generated),get('ledger.json',ALL.generated),get(l.pl_file,l.pl_v),get(l.rt_file,l.rt_v)]);
  return {E:E&&E.leagues&&E.leagues[D.id],LD,P,RT};
 }
 function draw(root,fin,weeks,F){
  const wk=weeks.includes(S.wk)?S.wk:weeks[weeks.length-1],d=digest(fin,wk,F.E,F.LD,F.P,F.RT);S.wk=wk;
  const sel=`<div class="card"><div class="ctl dg-ctl"><label class="dcx-l"><span class="mu">${two('Week','الأسبوع')}</span><select id="dgw">${weeks.slice().reverse().slice(0,16).map(w=>`<option value="${w}"${w===wk?' selected':''}>${w} → ${sunday(w)}</option>`).join('')}</select></label><button type="button" class="s" id="dgs">${two('Save as picture','احفظ كصورة')}</button></div></div>`;
  const head=`<div class="card dg-h"><h3>${nm(D.name)} · ${nb(wk)} → ${nb(d.end)}</h3><div class="dg-k"><span><b>${nb(d.ms.length)}</b> ${two('matches','مباراة')}</span><span><b>${nb(d.goals)}</b> ${two('goals','هدف')}</span><span><b>${nb(d.ms.length?(d.goals/d.ms.length).toFixed(2):'0')}</b> ${two('goals a match','هدف بالمباراة')}</span><span><b>${nb(d.res[0])}</b> ${two('home wins','فوز للمضيف')}</span><span><b>${nb(d.res[1])}</b> ${two('draws','تعادل')}</span><span><b>${nb(d.res[2])}</b> ${two('away wins','فوز للضيف')}</span></div></div>`;
  const li=(a)=>a.length?`<ul class="dg-l">${a.join('')}</ul>`:`<div class="mu">${two('Nothing to show.','ما فيه شي للعرض.')}</div>`;
  const sur=`<div class="card dg-s"><h3>${two('Biggest surprises','أكبر المفاجآت')}</h3>${li(d.sur.map(s=>`<li data-m="${esc(s.m.match_id)}">${mrow(s.m)} <span class="mu">${two('Elo gave this result','إيلو أعطى هالنتيجة')} <b>${nb(Math.round(s.p[s.o]*100)+'%')}</b> · ${nb(s.bits.toFixed(1))} ${two('bits','بت')}</span></li>`))}<p class="mu ins-note">${two('The chance Elo gave the real result before kick-off, from the site\'s own ratings; fewer chances = more surprising (3 bits = 1 in 8).','الفرصة اللي أعطاها إيلو للنتيجة الفعلية قبل الانطلاق، من تقييمات الموقع؛ فرصة أقل = مفاجأة أكبر (3 بت = 1 من 8).')}</p></div>`;
  const big=`<div class="card dg-w"><h3>${two('Biggest wins and most goals','أكبر الانتصارات وأكثر الأهداف')}</h3><div class="dg-2"><div><h4>${two('Biggest wins','أكبر الانتصارات')}</h4>${li(d.wins.map(w=>`<li data-m="${esc(w.m.match_id)}">${mrow(w.m)}</li>`))}</div><div><h4>${two('Most goals','أكثر أهداف')}</h4>${li(d.most.map(w=>`<li data-m="${esc(w.m.match_id)}">${mrow(w.m)} <span class="mu">${nb(w.t)}</span></li>`))}</div></div></div>`;
  const mv=x=>`<li data-t="${esc(x.t)}">${nm(x.t)} <span class="mu">${nb(x.was)} → <b>${nb(x.now)}</b></span></li>`;
  const mov=`<div class="card dg-m"><h3>${two('Table movers','المتحركون في الجدول')}</h3><div class="dg-2"><div><h4>${two('Risers','الصاعدون')}</h4>${li(d.up.map(mv))}</div><div><h4>${two('Fallers','الهابطون')}</h4>${li(d.down.map(mv))}</div></div><p class="mu ins-note">${two('Position after this week\'s matches against the position after the week before.','المركز بعد مباريات هالأسبوع مقابل المركز بعد الأسبوع اللي قبله.')}</p></div>`;
  const best=`<div class="card dg-b"><h3>${two('Best ratings of the week','أفضل تقييمات الأسبوع')}</h3>${li(d.best.map(b=>`<li data-p="${esc(b.id)}">${nm(b.n)} <span class="mu">${nm(b.club)}</span> <b>${nb(b.v.toFixed(1))}</b></li>`))}<p class="mu ins-note">${two('The highest single PitchAPI match rating of each player in the week.','أعلى تقييم PitchAPI لمباراة واحدة لكل لاعب في الأسبوع.')}</p></div>`;
  const led=`<div class="card dg-g"><h3>${two('How the ledger\'s chances scored','كيف سجّلت فرص السجل')}</h3>${d.led.length?`<table class="lk-t dg-lt"><thead><tr><th>${two('Model','النموذج')}</th><th class="n">${two('Matches','مباريات')}</th><th class="n">Brier</th><th class="n">${two('Likeliest result happened','النتيجة الأرجح حصلت')}</th></tr></thead><tbody>${d.led.map(x=>`<tr data-m="${x.k}"><td>${two(x.en,x.ar)}</td><td class="n">${nb(x.n)}</td><td class="n">${nb(x.brier.toFixed(3))}</td><td class="n">${nb(x.hit+'/'+x.n)}</td></tr>`).join('')}</tbody></table><p class="mu ins-note">${two('Brier: lower is better (0.667 = always guessing a third each). A week is a small sample: the Prediction ledger page judges them over many matches.','Brier: الأقل أفضل (0.667 = تخمين الثلث دايم). أسبوع عينة صغيرة: صفحة سجل التوقعات تحكم عليها عبر مباريات كثيرة.')}</p>`:`<div class="mu">${two('The ledger holds no scored match from this week (it started on 5 November 2026).','السجل ما فيه مباراة مسجّلة من هالأسبوع (بدأ في 5 نوفمبر 2026).')}</div>`}</div>`;
  const note=`<p class="mu ins-note">${two('A notification for the digest is not built: the site cannot yet send a weekly message.','إشعار للملخص غير مبني: الموقع ما يقدر يرسل رسالة أسبوعية للحين.')}</p>`;
  root.innerHTML=sel+head+sur+big+mov+best+led+note;
  root.querySelector('#dgw').addEventListener('change',e=>{S.wk=e.target.value;draw(root,fin,weeks,F)});
  root.querySelector('#dgs').addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{const c=card(d,D.name);await INS.cardKit.savePng(c.svg,c.W,c.H,D.name+' '+wk,'digest')}catch(x){}finally{b.disabled=false}});
 }
 R.digest=async function(el){
  el.innerHTML='<h2>Weekly digest</h2><div id="dgroot" class="ins dg"><div class="empty skel">Loading the week…</div></div>';
  const root=el.querySelector('#dgroot'),tok=++S.tok,lg=D&&D.id;
  const fin=(D.matches||[]).filter(m=>wkSc(m.score)&&m.date);
  if(typeof ltOk==='function'&&!ltOk(fin)){root.innerHTML=`<div class="empty">${two('This competition is a tournament, so it has no weeks of a league to summarise.','هذي بطولة، فما فيها أسابيع دوري للتلخيص.')}</div>`;return}
  const cnt={};fin.forEach(m=>{const w=monday(m.date);cnt[w]=(cnt[w]||0)+1});
  const weeks=Object.keys(cnt).filter(w=>cnt[w]>=4).sort();
  if(!weeks.length){root.innerHTML=`<div class="empty">${two('No week with four finished matches yet.','ما فيه أسبوع فيه أربع مباريات منتهية للحين.')}</div>`;return}
  const F=await files();
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  draw(root,fin,weeks,F);
 };
 INS.ar({'Weekly digest':'ملخص الأسبوع'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
