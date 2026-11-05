/* ===== Player roles (#/roles and #/roles/<player id>, Players room, Compare and look-alikes): how players play, in six groups, and whether the groups hold =====
   Data: data/roles.json, written offline by tools/roles/fit.py (finished seasons 2024-25 and 2025-26 of the six domestic leagues, outfield players with 450+ minutes).
   Eighteen per-90 measures (sqrt, then a z-score against the player's own league and season) grouped by k-means; the centres were fitted on 2024-25 players with 900+
   minutes only and 2025-26 was put on the frozen centres. k = 6 was chosen by a rule fixed beforehand (the k whose clusterings of two random halves agree most).
   The page draws the map (the first two principal components), lists the six roles with their strongest measures and position mix, finds one player's role in each
   season and his nearest players (distance between the z-scores), and prints the tests: season to season and odd against even matches. Names of the roles are generated
   from the centres' strongest groups of measures, they are descriptions of numbers and not scouting labels. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('roles','Player roles','players','compare');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const COL=['#4cc9f0','#ffb703','#90be6d','#f72585','#b388ff','#ff7f50','#2ec4b6','#e9c46a'];
 const LAB={cl:['Clearances /90','إبعاد الكرة /90'],cr:['Crosses /90','عرضيات /90'],tkw:['Take-ons won /90','مراوغات ناجحة /90']};
 const POSN={DF:['defenders','مدافعين'],MF:['midfielders','لاعبي وسط'],FW:['forwards','مهاجمين']};
 const S={season:1,lg:'',min:900,role:null,pick:'',tok:0};
 const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ø/g,'o').replace(/ł/g,'l').replace(/ß/g,'ss').toLowerCase();
 let FILE=null;
 const lab=k=>{const M=INS.met&&INS.met(k);return LAB[k]?LAB[k][0]:M?M[1]:k},labAr=k=>LAB[k]?LAB[k][1]:lab(k);
 const rn=r=>two(esc(r.name),esc(r.ar));
 /* rows of the file as flat records */
 function rows(d){
  const out=[];
  for(const [id,L] of Object.entries(d.p))for(const e of L)out.push({id,name:d.n[id],s:e[0],lg:e[1],club:e[2],pos:e[3],mi:e[4],role:e[5],x:e[6],y:e[7],z:e[8]});
  return out;
 }
 const dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++){const t=(a[i]-b[i])/10;s+=t*t}return Math.sqrt(s)};
 /* the n nearest players in the same season (450+ minutes), never the player himself (exported for the test) */
 function nearest(all,id,season,n){
  const me=all.find(r=>r.id===id&&r.s===season);if(!me)return [];
  return all.filter(r=>r.s===season&&r.id!==id).map(r=>({r,d:dist(me.z,r.z)})).sort((a,b)=>a.d-b.d||a.r.name.localeCompare(b.r.name)).slice(0,n);
 }
 INS.roles={nearest,rows,get file(){return FILE}};
 function mapSvg(sel,all){
  const W=640,H=400,pad=26,xs=sel.map(r=>r.x),ys=sel.map(r=>r.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const sx=v=>pad+(v-x0)/((x1-x0)||1)*(W-2*pad),sy=v=>H-pad-(v-y0)/((y1-y0)||1)*(H-2*pad);
  const dots=sel.map(r=>`<circle class="rl-d${r.id===S.pick?' on':''}" data-id="${esc(r.id)}" data-role="${r.role}" cx="${sx(r.x).toFixed(1)}" cy="${sy(r.y).toFixed(1)}" r="${r.id===S.pick?6:3.2}" fill="${COL[r.role%COL.length]}" opacity="${S.role==null||S.role===r.role?.8:.1}"><title>${esc(r.name)} · ${esc(r.club)}</title></circle>`).join('');
  return `<svg class="rl-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of the players by style"><rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="var(--ln,#27474a)" stroke-width="1"/>${dots}</svg>`;
 }
 function draw(root,d){
  const all=rows(d),K=d.roles.length,T=d.test;
  const sel=all.filter(r=>r.s===S.season&&r.mi>=S.min&&(S.lg===''||d.lg[r.lg]===S.lg));
  if(S.pick&&!all.some(r=>r.id===S.pick))S.pick='';
  const cnt=Array(K).fill(0);sel.forEach(r=>cnt[r.role]++);
  const mine=S.pick?all.filter(r=>r.id===S.pick).sort((a,b)=>a.s-b.s):[];
  const ctl=`<div class="card"><div class="ctl rl-ctl">
   <label class="dcx-l"><span class="mu">${two('Season','الموسم')}</span><select id="rls">${d.seasons.map((s,i)=>`<option value="${i}"${S.season===i?' selected':''}>${esc(s)}</option>`).join('')}</select></label>
   <label class="dcx-l"><span class="mu">${two('League','الدوري')}</span><select id="rll"><option value="">${'All six'}</option>${d.lg.map(l=>`<option${S.lg===l?' selected':''}>${esc(l)}</option>`).join('')}</select></label>
   <label class="dcx-l"><span class="mu">${two('Minutes','الدقائق')}</span><select id="rlm"><option value="900"${S.min===900?' selected':''}>900+</option><option value="450"${S.min===450?' selected':''}>450+</option></select></label>
   <label class="dcx-l rl-q"><span class="mu">${two('Player','لاعب')}</span><input id="rlq" list="rlql" autocomplete="off" placeholder="Search a player" value="${S.pick?esc(d.n[S.pick]):''}"><datalist id="rlql">${[...new Set(all.map(r=>r.id))].map(id=>`<option value="${esc(d.n[id])}">`).join('')}</datalist></label></div></div>`;
  const chips=d.roles.map(r=>`<button type="button" class="rl-chip${S.role===r.id?' on':''}" data-role="${r.id}" aria-pressed="${S.role===r.id}"><i style="background:${COL[r.id%COL.length]}"></i>${rn(r)} <span class="mu">${nb(cnt[r.id])}</span></button>`).join('');
  const map=`<div class="card"><h3>${two('The map','الخريطة')}</h3><div class="rl-ch">${chips}</div>${sel.length?mapSvg(sel,all):`<div class="empty">${two('No player fits these choices.','ما فيه لاعب يناسب هالاختيارات.')}</div>`}
   <p class="mu ins-note">${two(`Each dot is a player of the choice above (${sel.length}). Close dots play alike. The two axes are the two main directions in which the 18 measures differ (they hold ${Math.round(T.pc_var[0]*100)}% and ${Math.round(T.pc_var[1]*100)}% of the differences); they have no names of their own. Click a dot to see the player; click a role to light it up.`,`كل نقطة لاعب من اختيارك فوق (${nb(sel.length)}). النقاط القريبة يلعبون بنفس الأسلوب. المحوران هما أهم اتجاهين تختلف فيهم المقاييس الـ 18 (يحملون ${nb(Math.round(T.pc_var[0]*100)+'%')} و ${nb(Math.round(T.pc_var[1]*100)+'%')} من الفروقات)، وما لهم أسماء.`)}</p></div>`;
  const roleCards=`<div class="card"><h3>${two('The six roles','الأدوار الستة')}</h3><div class="rl-roles">${d.roles.map(r=>{
   const pos=Object.entries(r.pos).filter(([k,v])=>v>=0.05).map(([k,v])=>`${nb(Math.round(v*100)+'%')} ${two(POSN[k]?POSN[k][0]:k,POSN[k]?POSN[k][1]:k)}`).join(' · ');
   return `<div class="rl-r" data-role="${r.id}"><div class="rl-rh"><i style="background:${COL[r.id%COL.length]}"></i><b>${rn(r)}</b> <span class="mu">${nb(r.n)} ${two('players in the fit','لاعب في الاختيار')}</span></div>
    <div class="mu rl-pos">${pos}</div><div class="rl-top">${r.top.map(([k,z])=>`<span class="rl-m ${z>=0?'up':'dn'}">${two(esc(lab(k)),esc(labAr(k)))} <b>${nb((z>=0?'+':'−')+Math.abs(z).toFixed(1))}</b></span>`).join('')}</div></div>`}).join('')}</div>
   <p class="mu ins-note">${two('The numbers are standard deviations above (+) or below (−) the average player of the same league and season. Names are made by a rule from the strongest groups of measures; they describe numbers and are not scouting labels. PitchAPI calls many forwards midfielders, so the position mix is PitchAPI\'s.','الأرقام هي انحرافات معيارية فوق (+) أو تحت (−) متوسط لاعبي نفس الدوري والموسم. الأسماء تتولد بقاعدة من أقوى مجموعات المقاييس؛ هي وصف للأرقام وليست تصنيف كشافين. PitchAPI يصنّف مهاجمين كثير لاعبي وسط، فتوزيع المراكز حسبه.')}</p></div>`;
  let who='';
  if(mine.length){
   const last=mine[mine.length-1],nn=nearest(all,S.pick,last.s,8),same=mine.length===2&&mine[0].role===mine[1].role;
   who=`<div class="card rl-who"><h3>${nm(d.n[S.pick])} <span class="mu">${nm(last.club)} · ${nm(d.lg[last.lg])} · ${nb(esc(last.pos))}</span></h3>
    <div class="rl-ss">${mine.map(r=>`<span class="rl-s" data-s="${r.s}"><span class="mu">${esc(d.seasons[r.s])}</span> <i style="background:${COL[r.role%COL.length]}"></i><b>${rn(d.roles[r.role])}</b> <span class="mu">${nb(r.mi)} ${two('min','دقيقة')}</span></span>`).join('')}</div>
    ${mine.length===2?`<p class="mu">${same?two('The same role in both seasons.','نفس الدور في الموسمين.'):two('A different role from one season to the next.','دور مختلف من موسم لموسم.')}</p>`:`<p class="mu">${two('Only one of the two seasons has 450+ minutes for him.','موسم واحد فقط من الاثنين فيه 450+ دقيقة له.')}</p>`}
    <h4>${two(`Closest players in ${esc(d.seasons[last.s])}`,`أقرب اللاعبين في ${esc(d.seasons[last.s])}`)}</h4>
    <table class="lk-t rl-nn"><thead><tr><th>${two('Player','اللاعب')}</th><th>${two('Role','الدور')}</th><th class="n">${two('Distance','المسافة')}</th></tr></thead><tbody>${nn.map(x=>`<tr data-id="${esc(x.r.id)}"><td><a href="#/roles/${encodeURIComponent(x.r.id)}">${nm(x.r.name)}</a> <span class="mu">${nm(x.r.club)} · ${nm(d.lg[x.r.lg])}</span></td><td><i class="rl-sw" style="background:${COL[x.r.role%COL.length]}"></i>${rn(d.roles[x.r.role])}</td><td class="n">${nb(x.d.toFixed(2))}</td></tr>`).join('')}</tbody></table>
    <p class="mu ins-note">${two('Distance = how far apart two players are over the 18 measures, each against his own league and season (0 = the same numbers). It compares how they play, not how well, and not the level of their leagues.','المسافة = كم يبعد لاعبين عن بعض في المقاييس الـ 18، كل واحد مقابل دوريه وموسمه (0 = نفس الأرقام). تقارن أسلوب اللعب مو مستواه ولا قوة دورييهم.')}</p>
    <a class="s" href="#/career/${encodeURIComponent(S.pick)}">${two('Career, season by season','المسيرة موسم بموسم')}</a></div>`;
  }
  const test=`<div class="card rl-test"><h3>${two('Do the roles hold?','هل الأدوار ثابتة؟')}</h3>
   <table class="lk-t rl-tt"><thead><tr><th>${two('Test','الاختبار')}</th><th class="n">${two('Players','لاعبين')}</th><th class="n">${two('Same role','نفس الدور')}</th><th class="n">${two('By chance','بالصدفة')}</th><th class="n">κ</th></tr></thead><tbody>
    <tr data-k="seasons"><td>${two(`${esc(d.seasons[0])} → ${esc(d.seasons[1])} (900+ minutes both)`,`${esc(d.seasons[0])} ← ${esc(d.seasons[1])} (900+ دقيقة في الاثنين)`)}</td><td class="n">${nb(T.pairs)}</td><td class="n"><b>${nb(Math.round(T.agree*100)+'%')}</b></td><td class="n">${nb(Math.round(T.chance*100)+'%')}</td><td class="n">${nb(T.kappa.toFixed(2))} <span class="mu">(${nb(T.kappa_lo.toFixed(2))} – ${nb(T.kappa_hi.toFixed(2))})</span></td></tr>
    <tr data-k="halves"><td>${two(`Odd against even matches of ${esc(d.seasons[1])} (450+ each)`,`مباريات فردية مقابل زوجية في ${esc(d.seasons[1])} (450+ لكل نصف)`)}</td><td class="n">${nb(T.halves)}</td><td class="n"><b>${nb(Math.round(T.h_agree*100)+'%')}</b></td><td class="n">${nb(Math.round(T.h_chance*100)+'%')}</td><td class="n">${nb(T.h_kappa.toFixed(2))}</td></tr></tbody></table>
   <p class="mu ins-note">${two(`The six centres were fitted on ${nb(T.fit)} players of ${esc(d.seasons[0])} only and ${esc(d.seasons[1])} was put on them without refitting. κ corrects for chance: 0 = no better than chance, 1 = always the same role. About ${Math.round(T.agree*100)}% of players keep their role, so a role is a tendency, not a fixed label, and about one player in four moves to another group, mostly to a neighbour on the map. Position labels would agree 100%, but only because PitchAPI gives one fixed label per player: they say less about how he plays. k = ${d.k} was picked by a rule fixed beforehand: the k whose clusterings of two random halves agree most (agreement ${d.kscan.map(([k,a])=>`k=${k}: ${a.toFixed(2)}`).join(', ')}). Only the two finished seasons and 450+ minutes are covered.`,`المراكز الستة انحسبت من ${nb(T.fit)} لاعب في ${esc(d.seasons[0])} فقط، وموسم ${esc(d.seasons[1])} انحط عليها بدون إعادة حساب. κ يصحّح للصدفة: 0 = مو أحسن من الصدفة، 1 = دايم نفس الدور. حوالي ${nb(Math.round(T.agree*100)+'%')} من اللاعبين يبقون في دورهم، فالدور ميل مو لقب ثابت، ولاعب من كل أربعة تقريبًا ينتقل لمجموعة ثانية، غالبًا مجاورة له في الخريطة. المراكز المسجّلة بـ PitchAPI تتطابق 100% لكن لأنه يعطي لقب واحد ثابت لكل لاعب: تقول أقل عن أسلوبه. اختير k = ${nb(d.k)} بقاعدة محددة قبل النتائج: k اللي تتفق فيه تجميعتين لنصفين عشوائيين أكثر. المواسم المنتهية فقط و450+ دقيقة.`)}</p></div>`;
  root.innerHTML=`<div class="card lk-intro"><p>${two('Players grouped by how they play, not by the position on the team sheet. Pick a season, a league and a minimum of minutes, light up a role, or search a player to see his role in each season and the players closest to him.','لاعبين مجمّعين حسب أسلوب لعبهم، مو حسب المركز في ورقة الفريق. اختر موسم ودوري وحد أدنى للدقائق، أو أضئ دور، أو دوّر على لاعب تشوف دوره في كل موسم وأقرب اللاعبين له.')}</p></div>`+ctl+map+who+roleCards+test;
  const on=(id,ev,f)=>{const e=root.querySelector(id);if(e)e.addEventListener(ev,f)};
  on('#rls','change',e=>{S.season=+e.target.value;draw(root,d)});
  on('#rll','change',e=>{S.lg=e.target.value;draw(root,d)});
  on('#rlm','change',e=>{S.min=+e.target.value;draw(root,d)});
  on('#rlq','change',e=>{const v=fold(e.target.value),ids=[...new Set(all.map(r=>r.id))],hit=ids.filter(id=>fold(d.n[id])===v)[0]||ids.filter(id=>fold(d.n[id]).includes(v))[0];if(hit){S.pick=hit;try{history.replaceState(null,'','#/roles/'+encodeURIComponent(hit))}catch(_){}draw(root,d)}});
  root.querySelectorAll('.rl-chip').forEach(b=>b.addEventListener('click',()=>{const r=+b.dataset.role;S.role=S.role===r?null:r;draw(root,d)}));
  root.querySelectorAll('.rl-d').forEach(c=>c.addEventListener('click',()=>{S.pick=c.dataset.id;try{history.replaceState(null,'','#/roles/'+encodeURIComponent(S.pick))}catch(_){}draw(root,d);const w=root.querySelector('.rl-who');if(w&&w.scrollIntoView)w.scrollIntoView({block:'nearest'})}));
 }
 R.roles=async function(el,arg){
  el.innerHTML='<h2>Player roles</h2><div id="rlroot" class="ins rl"><div class="empty skel">Loading the roles…</div></div>';
  const root=el.querySelector('#rlroot'),tok=++S.tok;
  let d=FILE;
  if(!d){try{d=await loadJson('roles.json',ALL.generated);if(!d||!d.roles||!d.p)throw new Error('roles')}catch(e){if(!root.isConnected||tok!==S.tok)return;root.innerHTML=`<div class="empty">${two('The roles are not available right now.','الأدوار مو متوفرة الحين.')}</div>`;return}FILE=d}
  if(!root.isConnected||tok!==S.tok)return;
  const id=arg?decodeURIComponent(String(arg).split('/')[0]):'';
  if(id&&d.p[id])S.pick=id;
  draw(root,d);
 };
 INS.ar({'Player roles':'أدوار اللاعبين'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
