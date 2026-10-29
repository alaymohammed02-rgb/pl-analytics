/* ===== Wrapped (#/wrapped, in the Home hub after Ask the site): a club's or a player's season as a few story slides, each one saved as an image =====
   Everything is counted from PitchAPI's files of the chosen season (nothing estimated), as on the Player story page:
   - a club: its finished matches from the league file (INS.poolOne): record, points and place in the table (points, goal difference, goals scored,
     name), goals for and against with the team's xG for and against (the shots file; only in matches where both teams have xG), its biggest win
     and heaviest defeat, longest unbeaten run (3+) and win streak (2+), the last five results, home against away, and from the per-match player
     file the top scorer, the top assister and the player with most minutes;
   - a player: the Player story's facts (INS.storyKit): matches, minutes, goals, assists and xG, best match by PitchAPI's rating, his best run, the
     run without a goal or an assist now, goals against xG, and his top percentiles among players of his position and the player most like him.
   A slide whose number does not exist (no ratings, no xG, no run) is left out instead of being filled. The page draws each slide as one SVG
   (1080 × 1350) in the club's colours; numbers count up and bars grow when it appears (not with "reduce motion"), the SVG that is saved has the
   final numbers. Tap or click the right (left in Arabic) part, swipe, the arrow keys or the buttons go to the next slide; play goes on by itself
   every 6 seconds and stops on the last. */
(function(){
 if(typeof R!=='object'||typeof INS!=='object'||typeof INS.addPage!=='function')return;
 INS.addPage('wrapped','Wrapped','home','ask');
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nb=x=>`<bdi dir="ltr">${x}</bdi>`,nm=x=>`<bdi>${esc(x)}</bdi>`;
 const ar=()=>typeof ARL==='object'&&!!ARL.on;
 const W=1080,H=1350,PX=72,RUN=3,WINS=2;
 const S={step:6000,mode:'club',lg:'',club:'',pick:'',i:0,play:false,tok:0,dn:0,timer:0,cu:0};
 const RM=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const f1=v=>(+v).toFixed(1),f2=v=>(+v).toFixed(2),sg=v=>(v>0?'+':v<0?'−':'')+Math.abs(v);
 const res=m=>m.gf>m.ga?'W':m.gf<m.ga?'L':'D';
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 /* ---------- a club's season ---------- */
 function clubFacts(o,club){
  const M=o.ms.filter(m=>m.home===club||m.away===club).map(m=>{const h=m.home===club;return {id:m.id,d:m.d,home:h,opp:h?m.away:m.home,gf:h?m.hg:m.ag,ga:h?m.ag:m.hg}});
  if(!M.length)return null;
  const T=new Map();const add=(t,gf,ga)=>{const r=T.get(t)||{t,p:0,gf:0,ga:0};r.gf+=gf;r.ga+=ga;r.p+=gf>ga?3:gf===ga?1:0;T.set(t,r)};
  o.ms.forEach(m=>{add(m.home,m.hg,m.ag);add(m.away,m.ag,m.hg)});
  const tab=[...T.values()].sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||cmp(a.t,b.t)),pos=tab.findIndex(r=>r.t===club)+1;
  const F={M,n:M.length,pos,of:tab.length,w:M.filter(m=>res(m)==='W').length,d:M.filter(m=>res(m)==='D').length,l:M.filter(m=>res(m)==='L').length,gf:M.reduce((s,m)=>s+m.gf,0),ga:M.reduce((s,m)=>s+m.ga,0)};
  F.pts=F.w*3+F.d;
  const win=M.filter(m=>res(m)==='W').sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||cmp(a.d,b.d)||cmp(a.id,b.id))[0],
   los=M.filter(m=>res(m)==='L').sort((a,b)=>(a.gf-a.ga)-(b.gf-b.ga)||b.ga-a.ga||cmp(a.d,b.d)||cmp(a.id,b.id))[0];
  F.win=win||null;F.loss=los||null;
  const runOf=f=>{let best=0,cur=0;M.forEach(m=>{if(f(m)){cur++;if(cur>best)best=cur}else cur=0});return best};
  F.unb=runOf(m=>res(m)!=='L');F.wins=runOf(m=>res(m)==='W');F.form=M.slice(-5).map(res);
  const h=M.filter(m=>m.home),a=M.filter(m=>!m.home),pts=L=>L.reduce((s,m)=>s+(res(m)==='W'?3:res(m)==='D'?1:0),0);
  F.h={n:h.length,pts:pts(h),gf:h.reduce((s,m)=>s+m.gf,0),ga:h.reduce((s,m)=>s+m.ga,0)};F.a={n:a.length,pts:pts(a),gf:a.reduce((s,m)=>s+m.gf,0),ga:a.reduce((s,m)=>s+m.ga,0)};
  /* team xG: matches where the shots file has both teams */
  if(o.xg){let n=0,xf=0,xa=0;M.forEach(m=>{const f=o.xg.get(m.id+'|'+club),g=o.xg.get(m.id+'|'+m.opp);if(f!=null&&g!=null){n++;xf+=f;xa+=g}});F.xg=n?{n,xf,xa,gf:M.filter(m=>o.xg.has(m.id+'|'+club)&&o.xg.has(m.id+'|'+m.opp)).reduce((s,m)=>s+m.gf,0),ga:M.filter(m=>o.xg.has(m.id+'|'+club)&&o.xg.has(m.id+'|'+m.opp)).reduce((s,m)=>s+m.ga,0)}:null}
  /* players of the club from the per-match player rows */
  if(o.pl){const ix={};o.pl.cols.forEach((c,k)=>ix[c]=k);const P=new Map();
   o.pl.rows.forEach(r=>{if(r[ix.c]!==club)return;const id=r[ix.i],x=P.get(id)||{id,n:r[ix.n],mi:0,gl:0,ast:0};x.mi+=r[ix.mi]||0;x.gl+=r[ix.gl]||0;x.ast+=r[ix.ast]||0;P.set(id,x)});
   const L=[...P.values()],top=(k)=>L.slice().sort((a,b)=>b[k]-a[k]||b.mi-a.mi||cmp(a.n,b.n))[0];
   const sc=top('gl'),as=top('ast'),mi=top('mi');F.sc=sc&&sc.gl>0?sc:null;F.as=as&&as.ast>0?as:null;F.mi=mi&&mi.mi>0?mi:null}
  return F;
 }
 /* ---------- the slides ---------- */
 /* a slide = {id, title:[en,ar], draw(ctx)}; ctx has t (language), tx (text), anim (class for the entrance) */
 function clubSlides(F,club,lgName,season){
  const S_=[];
  S_.push({id:'intro',title:['Your season','موسمك'],draw:c=>c.kicker(c.t('THE SEASON SO FAR','الموسم لين الحين'))+c.crest(club,330)+c.tx(PX,650,club,{size:c.fit(club,92,W-2*PX),w:800,d:100})+c.tx(PX,716,[lgName,season].filter(Boolean).join(' · '),{size:32,fill:c.mu,d:200})+c.big(W/2,1010,F.n,{d:300,cu:F.n})+c.tx(W/2,1060,c.t(F.n===1?'match played':'matches played','مباراة لُعبت'),{size:34,fill:c.mu,a:'middle',d:400})});
  S_.push({id:'record',title:['The record','الحصيلة'],draw:c=>c.kicker(c.t('THE RECORD','الحصيلة'))+[[F.w,c.t('wins','فوز'),'#3fa34d'],[F.d,c.t('draws','تعادل'),'#c9ced6'],[F.l,c.t('defeats','خسارة'),'#d64541']].map(([v,l,col],i)=>c.big(W/2+(i-1)*330,520,v,{d:100+i*150,cu:v,fill:col,size:150})+c.tx(W/2+(i-1)*330,575,l,{size:34,fill:c.mu,a:'middle',d:200+i*150})).join('')
   +c.tx(W/2,780,F.pts+c.t(' points',' نقطة'),{size:76,w:800,a:'middle',d:700,k:'pts'})+c.tx(W/2,845,c.t(`${f2(F.pts/F.n)} a match · ${F.pos}${c.ord(F.pos)} of ${F.of} in the table`,`${f2(F.pts/F.n)} للمباراة · المركز ${F.pos} من ${F.of} في الجدول`),{size:34,fill:c.mu,a:'middle',d:800})});
  S_.push({id:'goals',title:['Goals','الأهداف'],draw:c=>{const gd=F.gf-F.ga;let g=c.kicker(c.t('GOALS','الأهداف'))+c.big(W/2-250,520,F.gf,{d:100,cu:F.gf,size:170,fill:'#3fa34d'})+c.tx(W/2-250,580,c.t('scored','سجّل'),{size:34,fill:c.mu,a:'middle',d:200})
   +c.big(W/2+250,520,F.ga,{d:250,cu:F.ga,size:170,fill:'#d64541'})+c.tx(W/2+250,580,c.t('conceded','استقبل'),{size:34,fill:c.mu,a:'middle',d:350})
   +c.tx(W/2,730,c.t('Goal difference ','فارق الأهداف ')+sg(gd),{size:62,w:800,a:'middle',d:500});
   if(F.xg){const x=F.xg;g+=c.tx(PX,860,c.t(`Chances (xG) over ${x.n} matches with shot data`,`الفرص (xG) في ${x.n} مباراة فيها بيانات التسديد`),{size:30,fill:c.mu,d:600})
    +c.row(PX,880,c.t('Created','صنع'),x.xf,Math.max(x.xf,x.xa,x.gf,x.ga,1),'#3fa34d',f1(x.xf)+c.t(` xG · ${x.gf} goals`,` xG · ${x.gf} أهداف`),700)
    +c.row(PX,1040,c.t('Allowed','سمح'),x.xa,Math.max(x.xf,x.xa,x.gf,x.ga,1),'#d64541',f1(x.xa)+c.t(` xG · ${x.ga} goals`,` xG · ${x.ga} أهداف`),850)}
   return g}});
  if(F.win||F.loss)S_.push({id:'extremes',title:['Highs and lows','القمم والقيعان'],draw:c=>{let g=c.kicker(c.t('HIGHS AND LOWS','القمم والقيعان')),y=420;
   const blk=(m,lab,col,d)=>{const s=`${m.gf}–${m.ga}`;let r=c.tx(PX,y,lab,{size:30,fill:col,w:700,d})+c.big(W/2,y+190,s,{size:190,d:d+100,fill:col})+c.tx(W/2,y+260,c.t(`${m.home?'at home to':'away at'} ${m.opp} · ${m.d}`,`${m.home?'على أرضه ضد':'خارج أرضه ضد'} ${m.opp} · ${m.d}`),{size:34,fill:c.mu,a:'middle',d:d+200,fit:W-2*PX});y+=420;return r};
   if(F.win)g+=blk(F.win,c.t('BIGGEST WIN','أكبر فوز'),'#3fa34d',100);if(F.loss)g+=blk(F.loss,c.t('HEAVIEST DEFEAT','أثقل خسارة'),'#d64541',500);return g}});
  S_.push({id:'runs',title:['Runs and form','السلاسل والشكل'],draw:c=>{let g=c.kicker(c.t('RUNS AND FORM','السلاسل والشكل')),y=380;
   if(F.unb>=RUN){g+=c.big(W/2,y+120,F.unb,{size:150,d:100,cu:F.unb})+c.tx(W/2,y+175,c.t('matches unbeaten in a row (longest)','مباريات بدون خسارة ورا بعض (الأطول)'),{size:34,fill:c.mu,a:'middle',d:200,fit:W-2*PX});y+=270}
   if(F.wins>=WINS){g+=c.big(W/2,y+110,F.wins,{size:130,d:300,cu:F.wins})+c.tx(W/2,y+160,c.t('wins in a row (longest)','فوز ورا بعض (الأطول)'),{size:34,fill:c.mu,a:'middle',d:400});y+=240}
   g+=c.tx(PX,y+60,c.t('LAST '+F.form.length,'آخر '+F.form.length),{size:28,fill:c.mu,w:700,d:500});
   const m=F.form.length,step=m>1?(W-2*PX-120)/(m-1):0;
   F.form.forEach((r,i)=>{const cx=m>1?PX+60+i*step:W/2,col=r==='W'?'#3fa34d':r==='L'?'#d64541':'#9aa3ad';
    g+=`<g${c.an(550+i*100)}><circle cx="${c.X(cx)}" cy="${y+150}" r="52" fill="${col}"/><text x="${c.X(cx)}" y="${y+170}" font-size="56" font-weight="800" fill="#fff" text-anchor="middle">${c.t(r,{W:'ف',D:'ت',L:'خ'}[r])}</text></g>`});return g}});
  S_.push({id:'homeaway',title:['Home and away','البيت والخارج'],draw:c=>{let g=c.kicker(c.t('HOME AND AWAY','الأرض والخارج'));
   [[F.h,c.t('AT HOME','على أرضه'),470],[F.a,c.t('AWAY','خارج أرضه'),800]].forEach(([x,l,y],i)=>{g+=c.tx(PX,y,l,{size:30,fill:c.mu,w:700,d:100+i*300})+c.big(W/2,y+160,f2(x.n?x.pts/x.n:0),{size:150,d:200+i*300,cu:x.n?x.pts/x.n:0,dec:2})+c.tx(W/2,y+215,c.t(`points a match · ${x.n} matches · ${x.gf} for, ${x.ga} against`,`نقطة للمباراة · ${x.n} مباراة · ${x.gf} له و${x.ga} عليه`),{size:32,fill:c.mu,a:'middle',d:300+i*300,fit:W-2*PX})});return g}});
  if(F.sc||F.as||F.mi)S_.push({id:'stars',title:['The players','اللاعبون'],draw:c=>{let g=c.kicker(c.t('THE PLAYERS','اللاعبون')),y=440;
   [[F.sc,c.t('TOP SCORER','هدّاف الفريق'),p=>p.gl+c.t(' goals',' أهداف')],[F.as,c.t('MOST ASSISTS','أكثر صناعة'),p=>p.ast+c.t(' assists',' صناعة')],[F.mi,c.t('MOST MINUTES','أكثر دقائق'),p=>Math.round(p.mi)+c.t(' minutes',' دقيقة')]].forEach(([p,l,v],i)=>{if(!p)return;
    g+=c.tx(PX,y,l,{size:28,fill:c.mu,w:700,d:100+i*250})+c.tx(PX,y+80,p.n,{size:c.fit(p.n,68,W-2*PX),w:800,d:150+i*250})+c.tx(PX,y+135,v(p),{size:42,fill:'#ffd54a',w:700,d:200+i*250});y+=250});return g}});
  S_.push({id:'outro',title:['Summary','الخلاصة'],draw:c=>c.kicker(c.t('IN ONE LINE','في سطر'))+c.crest(club,250)+c.tx(PX,560,club,{size:c.fit(club,80,W-2*PX),w:800,d:100})
   +c.tx(PX,650,c.t(`${F.w}W ${F.d}D ${F.l}L · ${F.pts} points · ${F.pos}${c.ord(F.pos)}`,`${F.w} فوز ${F.d} تعادل ${F.l} خسارة · ${F.pts} نقطة · المركز ${F.pos}`),{size:44,fill:'#ffd54a',w:700,d:200,fit:W-2*PX})
   +c.tx(PX,720,c.t(`${F.gf} goals scored, ${F.ga} conceded`,`${F.gf} هدف سجّلها و${F.ga} استقبلها`),{size:38,fill:c.mu,d:300})
   +c.tx(PX,830,c.t('Thanks for the season.','شكراً على الموسم.'),{size:44,w:700,d:500})});
  return S_;
 }
 function playerSlides(p,F,St,lgName,season){
  const K=INS.storyKit,POS=K.POS,LAB=K.LAB,S_=[],pos=p.pos&&POS[p.pos];
  S_.push({id:'intro',title:['Your season','موسمك'],draw:c=>c.kicker(c.t('THE SEASON SO FAR','الموسم لين الحين'))+c.tx(PX,520,p.name,{size:c.fit(p.name,96,W-2*PX),w:800,d:100})+c.tx(PX,590,[p.club,lgName,pos?c.t(pos[0],pos[1]):''].filter(Boolean).join(' · '),{size:32,fill:c.mu,d:200,fit:W-2*PX})
   +c.big(W/2,950,F.n,{d:300,cu:F.n})+c.tx(W/2,1000,c.t(F.n===1?'match':'matches','مباراة'),{size:34,fill:c.mu,a:'middle',d:400})+c.tx(W/2,1090,Math.round(F.mi)+c.t(' minutes',' دقيقة'),{size:46,w:700,a:'middle',d:500})});
  S_.push({id:'numbers',title:['The numbers','الأرقام'],draw:c=>c.kicker(c.t('THE NUMBERS','الأرقام'))+[[F.gl,c.t('goals','أهداف'),'#fff'],[F.ast,c.t('assists','صناعة'),'#5aa9ff']].map(([v,l,col],i)=>c.big(W/2+(i?1:-1)*250,560,v,{size:200,d:100+i*200,cu:v,fill:col})+c.tx(W/2+(i?1:-1)*250,620,l,{size:36,fill:c.mu,a:'middle',d:200+i*200})).join('')
   +c.tx(W/2,820,c.t(`${f2(F.xg)} xG`,`${f2(F.xg)} xG`),{size:70,w:800,a:'middle',d:600})+(F.xagN?c.tx(W/2,890,c.t(`and ${f2(F.xag)} xAG${F.xagN<F.n?` (in the ${F.xagN} of ${F.n} matches that have it)`:''}`,`و${f2(F.xag)} xAG${F.xagN<F.n?` (في ${F.xagN} من ${F.n} مباريات فيها)`:''}`),{size:32,fill:c.mu,a:'middle',d:700,fit:W-2*PX}):'')});
  if(F.best)S_.push({id:'best',title:['His best match','أفضل مبارياته'],draw:c=>c.kicker(c.t('BEST MATCH','أفضل مباراة'))+c.big(W/2,640,f1(F.best.rt),{size:260,d:100,cu:F.best.rt,dec:1,fill:'#ffd54a'})+c.tx(W/2,710,c.t('PitchAPI rating','تقييم PitchAPI'),{size:34,fill:c.mu,a:'middle',d:200})
   +c.tx(W/2,820,c.t(`${F.best.home?'at home to':'away at'} ${F.best.opp}`,`${F.best.home?'على أرضه ضد':'خارج أرضه ضد'} ${F.best.opp}`),{size:50,w:700,a:'middle',d:300,fit:W-2*PX})+c.tx(W/2,890,`${F.best.gf}–${F.best.ga} · ${F.best.d}`,{size:38,fill:c.mu,a:'middle',d:400})
   +(F.best.gl+F.best.ast?c.tx(W/2,970,[F.best.gl?F.best.gl+c.t(F.best.gl>1?' goals':' goal',' أهداف'):'',F.best.ast?F.best.ast+c.t(F.best.ast>1?' assists':' assist',' صناعة'):''].filter(Boolean).join(c.t(' and ',' و')),{size:40,fill:'#3fa34d',w:700,a:'middle',d:500}):'')});
  if(F.run||F.dry)S_.push({id:'runs',title:['Runs','السلاسل'],draw:c=>{let g=c.kicker(c.t('RUNS','السلاسل')),y=470;
   if(F.run){g+=c.big(W/2,y+140,F.run.n,{size:190,d:100,cu:F.run.n})+c.tx(W/2,y+200,c.t('matches in a row with a goal or an assist','مباريات ورا بعض فيها هدف أو صناعة'),{size:34,fill:c.mu,a:'middle',d:200,fit:W-2*PX})+c.tx(W/2,y+255,c.t(`${F.run.from} to ${F.run.to}`,`من ${F.run.from} إلى ${F.run.to}`),{size:30,fill:c.mu,a:'middle',d:250});y+=400}
   if(F.dry){g+=c.big(W/2,y+120,F.dry.n,{size:150,d:300,cu:F.dry.n,fill:'#d64541'})+c.tx(W/2,y+180,c.t(`matches without a goal or an assist, since ${F.dry.since}`,`مباريات بدون هدف ولا صناعة، من ${F.dry.since}`),{size:34,fill:c.mu,a:'middle',d:400,fit:W-2*PX})}return g}});
  if(F.xg>0||F.gl>0)S_.push({id:'finishing',title:['Goals and chances','الأهداف والفرص'],draw:c=>{const df=F.gl-F.xg;return c.kicker(c.t('GOALS AND CHANCES','الأهداف والفرص'))+c.row(PX,500,c.t('Goals','الأهداف'),F.gl,Math.max(F.gl,F.xg,1),'#3fa34d',String(F.gl),100)+c.row(PX,660,'xG',F.xg,Math.max(F.gl,F.xg,1),'#9aa3ad',f2(F.xg),250)
   +c.tx(W/2,900,Math.abs(df)<.05?c.t('Just what his chances were worth','بالضبط قد فرصه'):c.t(`${f2(Math.abs(df))} ${df>0?'more':'fewer'} goals than his chances were worth`,`${f2(Math.abs(df))} هدف ${df>0?'أكثر':'أقل'} من قيمة فرصه`),{size:44,w:700,a:'middle',d:500,fit:W-2*PX})+c.tx(W/2,970,c.t('Goals repeat less than xG from one season to the next','الأهداف تتكرر أقل من الـ xG من موسم لموسم'),{size:30,fill:c.mu,a:'middle',d:600,fit:W-2*PX})}});
  if(St)S_.push({id:'stand',title:['Where he stands','وين مكانه'],draw:c=>{let g=c.kicker(c.t('WHERE HE STANDS','وين مكانه'))+c.tx(PX,440,c.t(`Percentile among ${St.n} ${POS[St.p]?POS[St.p][2]:'players'} of the six leagues, per 90`,`النسبة المئوية بين ${St.n} من ${POS[St.p]?POS[St.p][3]:'اللاعبين'} في الدوريات الستة، لكل 90`),{size:28,fill:c.mu,d:50,fit:W-2*PX}),y=500;
   St.top.forEach((q,i)=>{g+=c.tx(PX,y,c.t(LAB[q.k][0],LAB[q.k][1]),{size:36,w:700,d:100+i*200})+c.row(PX,y+20,'',q.v,100,INS.cardKit&&INS.cardKit.pcol?INS.cardKit.pcol(q.v):'#3fa34d',String(Math.round(q.v)),150+i*200);y+=170});return g}});
  if(St&&St.tw)S_.push({id:'twin',title:['Most like him','الأقرب له'],draw:c=>c.kicker(c.t('MOST LIKE HIM','الأقرب له'))+c.tx(PX,560,St.tw.x.n,{size:c.fit(St.tw.x.n,88,W-2*PX),w:800,d:100})+c.tx(PX,630,`${St.tw.x.club} · ${St.tw.x.ln}`,{size:34,fill:c.mu,d:200,fit:W-2*PX})
   +c.big(W/2,930,f1(St.tw.s.v),{size:220,d:300,cu:St.tw.s.v,dec:1,fill:'#ffd54a'})+c.tx(W/2,990,c.t('similarity out of 100','التشابه من 100'),{size:34,fill:c.mu,a:'middle',d:400})});
  S_.push({id:'outro',title:['Summary','الخلاصة'],draw:c=>c.kicker(c.t('IN ONE LINE','في سطر'))+c.tx(PX,560,p.name,{size:c.fit(p.name,84,W-2*PX),w:800,d:100})+c.tx(PX,650,c.t(`${F.gl} goals · ${F.ast} assists · ${F.n} matches`,`${F.gl} أهداف · ${F.ast} صناعة · ${F.n} مباراة`),{size:46,fill:'#ffd54a',w:700,d:200,fit:W-2*PX})
   +c.tx(PX,730,p.club,{size:36,fill:c.mu,d:300})+c.tx(PX,840,c.t('Thanks for the season.','شكراً على الموسم.'),{size:44,w:700,d:500})});
  return S_;
 }
 /* ---------- drawing one slide ---------- */
 function ctxFor(club,final){
  const A=ar(),K=INS.cardKit||{},x_=K.x_||(s=>String(s)),X=x=>A?W-x:x,t=(en,a)=>A?a:en,mu='rgba(255,255,255,.72)',cc=typeof clubColors==='function'&&club?clubColors(club):null;
  const an=d=>final?'':` class="wr-in" style="--d:${d||0}ms"`,ord=n=>{const k=n%100;if(k>=11&&k<=13)return 'th';return {1:'st',2:'nd',3:'rd'}[n%10]||'th'};
  const c={A,t,X,mu,x_,an,ord,fit:(s,size,w)=>K.fit?K.fit(s,size,w):size,c1:cc?cc.c1:'#3b2a6b',c2:cc?cc.c2:'#0c3b46'};
  /* a line of text; fit: the largest size that fits that width */
  c.tx=(x,y,s,o={})=>{const sz=o.fit?Math.min(o.size||28,K.fit?K.fit(s,o.size||28,o.fit):o.size||28):o.size||28;
   return `<text${an(o.d)} x="${X(x)}" y="${y}" font-size="${sz}" font-weight="${o.w||400}" fill="${o.fill||'#fff'}" text-anchor="${o.a==='middle'?'middle':o.a==='end'?'end':'start'}"${A?' direction="rtl"':''}>${x_(s)}</text>`};
  /* a big number that counts up (the saved image has the final number) */
  c.big=(x,y,v,o={})=>{const dec=o.dec||0,fin=o.cu!=null?(+o.cu).toFixed(dec):String(v),count=o.cu!=null&&!final,cu=count?` data-cu="${o.cu}" data-dec="${dec}"`:'';
   return `<text${an(o.d)} x="${X(x)}" y="${y}" font-size="${o.size||150}" font-weight="800" fill="${o.fill||'#fff'}" text-anchor="middle"${cu}>${x_(count&&!RM()?(0).toFixed(dec):fin)}</text>`};
  c.kicker=s=>`<text x="${X(PX)}" y="96" font-size="26" font-weight="700" fill="#ffd54a" letter-spacing="2"${A?' direction="rtl"':''}>${x_(s)}</text>`;
  /* a labelled bar as long as value ÷ max */
  c.row=(x,y,lab,v,mx,col,txt,d)=>{const bw=W-2*PX,w=Math.max(8,bw*Math.min(1,v/Math.max(mx,1e-9)));
   return (lab?c.tx(x,y,lab,{size:30,fill:mu,d}):'')+`<rect x="${A?W-PX-bw:PX}" y="${y+14}" width="${bw}" height="34" rx="17" fill="rgba(255,255,255,.14)"/><rect class="${final?'':'wr-bar'}" style="--d:${d||0}ms;--o:${A?'right':'left'} center" x="${(A?W-PX-w:PX).toFixed(1)}" y="${y+14}" width="${w.toFixed(1)}" height="34" rx="17" fill="${col}"/>`
    +`<text${an((d||0)+200)} x="${X(PX)}" y="${y+88}" font-size="34" font-weight="700" fill="#fff" text-anchor="start"${A?' direction="rtl"':''}>${x_(txt)}</text>`};
  /* the club's crest, only when the page has it as an image that can travel inside the saved picture */
  c.crest=(name,size)=>{const s=typeof logoOf==='function'?logoOf(name):null;return s&&/^data:/.test(s)?`<image${an(0)} href="${x_(s)}" x="${A?W-PX-size:PX}" y="${120}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`:''};
  return c;
 }
 function svgOf(sl,i,n,meta,final){
  const c=ctxFor(meta.club,final),FONT=(INS.cardKit&&INS.cardKit.FONT)||'sans-serif';
  const body=sl.draw(c);
  const foot=`<text x="${c.X(PX)}" y="${H-52}" font-size="28" font-weight="800" fill="#fff"${c.A?' direction="rtl"':''}>PL Analytics</text><text x="${c.X(W-PX)}" y="${H-52}" font-size="22" fill="${c.mu}" text-anchor="end"${c.A?' direction="rtl"':''}>${c.x_(c.t('Data: PitchAPI','البيانات: PitchAPI'))} · ${i+1}/${n}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT}' role="img" aria-label="${c.x_(c.t(sl.title[0],sl.title[1])+' · '+meta.name)}"><defs><linearGradient id="wrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.c1}"/><stop offset="1" stop-color="${c.c2}"/></linearGradient></defs>
   <rect width="${W}" height="${H}" fill="url(#wrg)"/><rect width="${W}" height="${H}" fill="#000" opacity=".5"/>${body}${foot}</svg>`;
 }
 /* ---------- the page ---------- */
 R.wrapped=async function(el,arg){
  el.innerHTML='<h2>Wrapped</h2><div id="wrroot" class="ins lk wr"><div class="empty skel">Loading…</div></div>';
  const root=el.querySelector('#wrroot'),lg=D.id,tok=++S.tok;stopPlay();
  let P;try{P=await INS.playerPool()}catch(e){P=null}
  if(!root.isConnected||tok!==S.tok||D.id!==lg)return;
  const K=INS.storyKit,lgs=P&&K?P.lgs.filter(K.domestic):[];
  if(!P||!K||!lgs.length){root.innerHTML=`<div class="empty">${two('Wrapped is not available right now. Try again later.','Wrapped مو متوفر الحين. جرّب بعدين.')}</div>`;return}
  const all=P.all.filter(p=>lgs.some(l=>l.id===p.lg));
  if(!S.lg||!lgs.some(l=>l.id===S.lg))S.lg=lgs.some(l=>l.id===D.id)?D.id:lgs[0].id;
  const clubs=()=>[...new Set(all.filter(x=>x.lg===S.lg).map(x=>x.club))].sort(cmp);
  if(!S.club||!clubs().includes(S.club))S.club=clubs()[0];
  S.all=all;S.lgs=lgs;S.P=P;draw(root,tok);
 };
 function stopPlay(){S.play=false;if(S.timer){clearTimeout(S.timer);S.timer=0}}
 async function draw(root,tok){
  const {all,lgs,P}=S,n=++S.dn,A=ar();
  const l=lgs.find(x=>x.id===S.lg),inLg=all.filter(x=>x.lg===S.lg),clubs=[...new Set(inLg.map(x=>x.club))].sort(cmp);
  if(!clubs.includes(S.club))S.club=clubs[0];
  const squad=inLg.filter(x=>x.club===S.club).sort((a,b)=>b.mi-a.mi||cmp(a.name,b.name));
  if(S.mode==='player'&&!squad.some(x=>x.key===S.pick))S.pick=squad[0]?squad[0].key:'';
  root.innerHTML=`<div class="card lk-intro"><p>${two('<b>Your season, as a story.</b> A few slides about a club or a player: the record, the highs and lows, the runs. Tap or swipe to move on, and save any slide as an image.','<b>موسمك كقصة.</b> كم شريحة عن نادي أو لاعب: الحصيلة والقمم والقيعان والسلاسل. اضغط أو اسحب عشان تكمل، واحفظ أي شريحة كصورة.')}</p></div>
   <div class="card wr-pick"><div class="ctl"><div class="seg" id="wrm" role="group" aria-label="${A?'النوع':'Kind'}">${[['club','Club','نادي'],['player','Player','لاعب']].map(([k,e,a])=>`<button type="button" data-m="${k}" aria-pressed="${S.mode===k}" class="${S.mode===k?'on':''}">${two(e,a)}</button>`).join('')}</div>
    <select id="wrl" aria-label="${A?'الدوري':'League'}">${lgs.map(x=>`<option value="${esc(x.id)}"${x.id===S.lg?' selected':''}>${esc(x.name)}</option>`).join('')}</select>
    <select id="wrc" aria-label="${A?'النادي':'Club'}">${clubs.map(c=>`<option${c===S.club?' selected':''}>${esc(c)}</option>`).join('')}</select>
    ${S.mode==='player'?`<select id="wrp" aria-label="${A?'اللاعب':'Player'}">${squad.map(x=>`<option value="${esc(x.key)}"${x.key===S.pick?' selected':''}>${esc(x.name)}</option>`).join('')}</select>`:''}</div></div><div id="wrbody"><div class="empty skel">Loading…</div></div>`;
  const q=s=>root.querySelector(s),re=()=>{S.i=0;stopPlay();draw(root,tok)};
  root.querySelectorAll('#wrm button').forEach(b=>b.onclick=()=>{S.mode=b.dataset.m;re()});
  q('#wrl').onchange=e=>{S.lg=e.target.value;S.club='';re()};q('#wrc').onchange=e=>{S.club=e.target.value;S.pick='';re()};const pp=q('#wrp');if(pp)pp.onchange=e=>{S.pick=e.target.value;re()};
  let o;try{o=await INS.poolOne(S.lg,['pl','sh'])}catch(e){o=null}
  if(!root.isConnected||tok!==S.tok||n!==S.dn)return;
  const body=q('#wrbody');if(!o){body.innerHTML=`<div class="empty">${two('This league\'s files could not be loaded. Try again later.','ما قدرنا نحمّل ملفات هالدوري. جرّب بعدين.')}</div>`;return}
  const season=(typeof ALL==='object'&&ALL&&ALL.season)||(typeof curSeason==='function'?curSeason():'')||'';
  let slides,meta;
  if(S.mode==='club'){const F=clubFacts(o,S.club);if(!F){body.innerHTML=`<div class="empty">${two('No finished matches for this club yet.','ما فيه مباريات منتهية لهالنادي للحين.')}</div>`;return}
   slides=clubSlides(F,S.club,l.name,season);meta={club:S.club,name:S.club};S.facts=F}
  else{const p=P.by.get(S.pick);if(!p){body.innerHTML=`<div class="empty">${two('No player to show.','ما فيه لاعب نعرضه.')}</div>`;return}
   let rt=null,TP=null;try{[rt,TP]=await Promise.all([INS.storyKit.rtOf(l).catch(()=>null),INS.twins?INS.twins.pool().catch(()=>null):null])}catch(e){}
   if(!root.isConnected||tok!==S.tok||n!==S.dn)return;
   const M=INS.storyKit.season(o,rt,p.id);if(!M.length){body.innerHTML=`<div class="empty">${two('No finished matches with minutes for this player yet.','ما فيه مباريات منتهية لعب فيها هاللاعب للحين.')}</div>`;return}
   const F=INS.storyKit.facts(M,p.pos);F.M=M;slides=playerSlides(p,F,INS.storyKit.stand(TP,p.lg,p.id),l.name,season);meta={club:p.club,name:p.name};S.facts=F}
  S.slides=slides;S.meta=meta;if(S.i>=slides.length)S.i=0;
  body.innerHTML=`<div class="wr-st" id="wrst" tabindex="0" role="group" aria-roledescription="${A?'عرض شرائح':'slides'}" aria-label="${A?'الشرائح':'Slides'}"><div class="wr-pg" id="wrpg" role="tablist" aria-label="${A?'الشريحة':'Slide'}">${slides.map((s,i)=>`<button type="button" class="wr-seg" role="tab" data-i="${i}" aria-label="${(i+1)}. ${esc(A?s.title[1]:s.title[0])}"><i></i></button>`).join('')}</div><div class="wr-sv" id="wrsv"></div></div>
   <div class="wr-ctl"><button type="button" class="s" id="wrprev" aria-label="${A?'السابق':'Previous'}">${A?'›':'‹'}</button><button type="button" class="wr-play" id="wrplay" aria-label="${A?'تشغيل':'Play'}">▶</button><button type="button" class="s" id="wrnext" aria-label="${A?'التالي':'Next'}">${A?'‹':'›'}</button>
    <button type="button" class="xb-clear" id="wrsave">${two('Save this slide','احفظ هالشريحة')}</button></div><p class="wr-live mu" id="wrlive" aria-live="polite"></p>
   <p class="mu ins-note">${two('Every number is counted from PitchAPI\'s files of this season; a slide with nothing to say is left out. Ratings are PitchAPI\'s; xG is the sum of its shots.','كل رقم محسوب من ملفات PitchAPI لهالموسم؛ والشريحة اللي ما عندها شي تقوله تنحذف. التقييمات من PitchAPI والـ xG مجموع تسديداته.')}</p>`;
  wire(root,tok,n);show(root,S.i,true);
 }
 function show(root,i,first){
  const {slides,meta}=S,N=slides.length;i=Math.max(0,Math.min(N-1,i));S.i=i;
  const sv=root.querySelector('#wrsv');if(!sv)return;
  sv.innerHTML=svgOf(slides[i],i,N,meta,false);sv.dataset.slide=slides[i].id;sv.dataset.i=i;
  root.querySelector('#wrpg').style.setProperty('--wr-t',S.step+'ms');
  root.querySelectorAll('#wrpg .wr-seg').forEach((b,k)=>{b.classList.toggle('done',k<i);b.classList.toggle('on',k===i);b.classList.remove('run');b.setAttribute('aria-selected',String(k===i));b.setAttribute('aria-current',k===i?'true':'false')});
  const pb=root.querySelector('#wrplay');pb.textContent=S.play?'❚❚':'▶';pb.setAttribute('aria-label',S.play?(ar()?'إيقاف':'Pause'):(ar()?'تشغيل':'Play'));
  root.querySelector('#wrprev').disabled=i===0;root.querySelector('#wrnext').disabled=i===N-1;
  root.querySelector('#wrlive').textContent=`${i+1}/${N} · ${ar()?slides[i].title[1]:slides[i].title[0]}`;
  /* numbers count up */
  const my=++S.cu;if(!RM())sv.querySelectorAll('[data-cu]').forEach(t=>{const to=+t.dataset.cu,dec=+t.dataset.dec,t0=performance.now();const f=ts=>{if(my!==S.cu||!t.isConnected)return;const k=Math.min(1,(ts-t0)/900),e=1-Math.pow(1-k,3);t.textContent=(to*e).toFixed(dec);if(k<1)requestAnimationFrame(f);else t.textContent=to.toFixed(dec)};requestAnimationFrame(f)});
  if(S.play){const seg=root.querySelectorAll('#wrpg .wr-seg')[i];if(seg){void seg.offsetWidth;seg.classList.add('run')}
   clearTimeout(S.timer);S.timer=setTimeout(()=>{if(!root.isConnected){stopPlay();return}if(S.i>=N-1){stopPlay();show(root,S.i)}else show(root,S.i+1)},S.step)}
 }
 function wire(root,tok,n){
  const q=s=>root.querySelector(s),N=()=>S.slides.length,A=ar(),go=i=>{show(root,i)},nxt=()=>{if(S.i<N()-1)go(S.i+1)},prv=()=>{if(S.i>0)go(S.i-1)};
  q('#wrprev').onclick=()=>{stopPlay();prv()};q('#wrnext').onclick=()=>{stopPlay();nxt()};
  q('#wrplay').onclick=()=>{if(S.play){stopPlay();show(root,S.i)}else{S.play=true;if(S.i>=N()-1)S.i=0;show(root,S.i)}};
  root.querySelectorAll('#wrpg .wr-seg').forEach(b=>b.onclick=()=>{stopPlay();go(+b.dataset.i)});
  const st=q('#wrst');let x0=null;
  st.addEventListener('pointerdown',e=>{x0=e.clientX});
  st.addEventListener('pointerup',e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(e.target.closest&&e.target.closest('.wr-pg'))return;stopPlay();
   if(Math.abs(dx)>50){(dx<0)!==A?nxt():prv();return}
   const r=st.getBoundingClientRect(),fx=(e.clientX-r.left)/r.width;(A?fx<.65:fx>.35)?nxt():prv()});
  st.addEventListener('keydown',e=>{const k=e.key;if(k==='ArrowRight'||k==='ArrowLeft'){e.preventDefault();stopPlay();((k==='ArrowRight')!==A)?nxt():prv()}else if(k==='Home'){e.preventDefault();stopPlay();go(0)}else if(k==='End'){e.preventDefault();stopPlay();go(N()-1)}else if(k===' '){e.preventDefault();q('#wrplay').click()}});
  q('#wrsave').onclick=async e=>{const b=e.currentTarget;if(!INS.cardKit||!INS.cardKit.savePng)return;const i=S.i,svg=svgOf(S.slides[i],i,N(),S.meta,true);b.disabled=true;try{await INS.cardKit.savePng(svg,W,H,S.meta.name,'wrapped-'+(i+1))}catch(x){}b.disabled=false};
  new MutationObserver((m,o)=>{if(!root.isConnected){stopPlay();o.disconnect()}}).observe(document.body,{childList:true,subtree:true});
 }
 /* for the tests: the time of one slide while playing, and the picture a slide is saved as */
 INS.wrapped={step:ms=>{S.step=ms},finalSvg:i=>svgOf(S.slides[i],i,S.slides.length,S.meta,true),W,H};
 INS.ar({'Wrapped':'ملخّص الموسم'});
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
