/* Pressing maps (#/sbpress, assets/sb-press.js): the match map on a hand-made match in StatsBomb's format (tests/sb/fixture.py: the page's
   requests to StatsBomb are answered from it, so the test needs no network and keeps none of StatsBomb's files), with every count
   worked out by hand; the player card from data/sb_press.json, recomputed here (per 90, adjusted or raw, the percentile among the same
   position group of the same tournament); the StatsBomb logo and credit on the page and the cards; the saved PNGs; Arabic; 390 px;
   leaving early; StatsBomb not answering. */
const T=require('../nf/lib.js');const {ok,J}=T;const {execFileSync}=require('child_process');
const FX=JSON.parse(execFileSync('python3',[__dirname+'/fixture.py']).toString());
const DP=J('sb_press.json');
const SBU=/raw\.githubusercontent\.com\/statsbomb\/open-data\/master\/data\//;
const route=async(ctx,mode)=>ctx.route(SBU,r=>{const u=r.request().url();
 if(mode==='down')return r.fulfill({status:503,body:'no'});
 const j=o=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
 if(/competitions\.json$/.test(u))return j(FX.competitions);if(/matches\/7\/3\.json$/.test(u))return j(FX.matches);
 if(/events\/1\.json$/.test(u))return j(FX.events);if(/lineups\/1\.json$/.test(u))return j(FX.lineups);return r.fulfill({status:404,body:'no'})});
const open=async(b,{vw=1280,lang='en',mode=''}={})=>{const ctx=await b.newContext({viewport:{width:vw,height:900},acceptDownloads:true});
 await ctx.addInitScript(([l])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang',l)}},[lang]);
 await route(ctx,mode);const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://127.0.0.1:8765/index.html#/sbpress');return {ctx,pg,errs}};
/* the player card's numbers, recomputed */
const PMK=['pr','prr','cp','cpr','ti','rec'],PN=['Pressures','Pressure regains','Counterpressures','Counterpress regains','Tackles + interceptions','Ball recoveries'];
const per90=(p,k,adj)=>p[4]>0?p[adj?7:6][PMK.indexOf(k)]/p[4]*90:null;
const pcl=(v,a)=>{if(v==null||a.length<8)return null;let lo=0,eq=0;a.forEach(x=>{if(x<v)lo++;else if(x===v)eq++});return Math.round((lo+eq/2)/a.length*100)};
const label=(C,me,adj)=>{const peers=C.players.filter(p=>p!==me&&p[3]===me[3]&&p[4]>=C.min);
 return me[1]+': '+PMK.map((k,i)=>{const v=per90(me,k,adj),pc=pcl(v,peers.map(p=>per90(p,k,adj)).filter(x=>x!=null&&isFinite(x)));return PN[i]+' '+(v==null?'–':v.toFixed(2))+(pc==null?'':' ('+pc+')')}).join(', ')};
const shown=(pg,sel)=>pg.$eval(sel+' svg',s=>s.getAttribute('aria-label'));
const png=async(pg,btn,w)=>{const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click(btn)]);const fs=require('fs'),p='/tmp/sb-'+process.pid+'.png';await dl.saveAs(p);const b=fs.readFileSync(p);fs.unlinkSync(p);return {ok:b.slice(1,4).toString()==='PNG'&&b.readUInt32BE(16)===w&&b.length>30000,w:b.readUInt32BE(16),h:b.readUInt32BE(20),kb:Math.round(b.length/1024),name:dl.suggestedFilename()}};
(async()=>{const b=await T.launch();
 let {ctx,pg,errs}=await open(b);
 await pg.waitForSelector('#sbpb .dcx-c svg',{timeout:60000});
 ok(await pg.evaluate(()=>!!document.querySelector('.sbp-att img[src="assets/statsbomb-logo.svg"]')&&/StatsBomb Open Data/.test(document.querySelector('.sbp-att').innerText)&&/analysis only/.test(document.querySelector('.sbp-att').innerText)),'the StatsBomb logo and the terms (free, analysis only, not commercial) are on the page');
 ok(await pg.evaluate(()=>PAGES.some(p=>p[0]==='sbpress')&&!!document.querySelector('#nav a[href="#/sbpress"], #drw a[href="#/sbpress"]')||PAGES.some(p=>p[0]==='sbpress')),'the page is in the menu (Analysis, after Height)');
 /* the match: Alpha 2–1 Beta. Alpha: Ace (9) 1 pressure, a counterpress, in Alpha's high third; Ben (4) none. Beta: Carl (8) 1 pressure in the mid third. */
 ok(await shown(pg,'#sbpb')==='Alpha 2 – 1 Beta: Alpha 1 pressures, 1 counterpresses, 0/0/1 low/mid/high | Beta 1 pressures, 0 counterpresses, 0/1/0 low/mid/high','match map: both teams\' pressures, counterpresses and thirds, worked out by hand ('+await shown(pg,'#sbpb')+')');
 const dots=await pg.$$eval('#sbpb .sb-pr,#sbpb .sb-cp',a=>a.map(c=>[c.getAttribute('class'),+c.getAttribute('cx'),+c.getAttribute('cy')]));
 ok(dots.length===2&&dots.filter(d=>d[0]==='sb-cp').length===1,'one dot per pressure, the counterpress ringed ('+dots.length+' dots)');
 const tbl=await pg.$$eval('#sbpb .sb-tot',a=>a.map(t=>+t.textContent));
 ok(JSON.stringify(tbl)==='[1,1]','the players\' totals: Ace 1, Carl 1');
 ok(await pg.$eval('#sbpb svg',s=>/9  Ace/.test(s.textContent)&&/8  Carl Beta One/.test(s.textContent)&&!/Alan Alpha One/.test(s.textContent)),'shirt numbers and common names from the lineups (9 Ace, 8 Carl Beta One)');
 ok(await pg.$eval('#sbpb svg',s=>!!s.querySelector('image[href^="data:image/svg+xml"]')&&/StatsBomb Open Data, for analysis only/.test(s.textContent)),'the card carries the StatsBomb logo and the credit');
 const r1=await png(pg,'.sbp-s',1600);ok(r1.ok&&/^pressure-map-card-/.test(r1.name),'Save image: a '+r1.w+' × '+r1.h+' PNG ('+r1.kb+' KB), '+r1.name);
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));
 /* the player card */
 await pg.click('.sbp-tabs button[data-t="p"]');await pg.waitForFunction(()=>document.querySelector('#sbpb #sbpc'),null,{timeout:60000});
 const C0=DP.comps[0],CC={...C0,players:C0.players};
 const first=C0.players.filter(p=>p[3]!=='GK'&&p[4]>=C0.min).sort((a,c)=>(per90(c,'pr',true)||0)-(per90(a,'pr',true)||0)||a[1].localeCompare(c[1]))[0];
 ok(await shown(pg,'#sbpb')===label(CC,first,true),'player card, '+C0.name+' '+C0.season+': '+first[1]+' (the most pressing outfield player), possession-adjusted, recomputed');
 const cells=await pg.$$eval('#sbpb .sb-hc',a=>a.map(r=>+r.dataset.v).sort((x,y)=>x-y)),ev=first[8].filter(v=>v>0).sort((x,y)=>x-y);
 ok(JSON.stringify(cells)===JSON.stringify(ev),'his heat map: his '+ev.length+' grid cells');
 const bars=await pg.$$eval('#sbpb .sb-on',a=>a.map(r=>({w:+r.getAttribute('width'),f:r.getAttribute('fill'),bw:+r.previousElementSibling.getAttribute('width')})));
 const peers=C0.players.filter(p=>p!==first&&p[3]===first[3]&&p[4]>=C0.min),ex=PMK.map(k=>pcl(per90(first,k,true),peers.map(p=>per90(p,k,true)).filter(x=>x!=null))).filter(x=>x!=null);
 const pcol=p=>{const S=[[0,[214,69,65]],[50,[232,160,40]],[100,[63,163,77]]];for(let i=1;i<S.length;i++)if(p<=S[i][0]){const [a,c]=S[i-1],[b2,d]=S[i],t=(p-a)/(b2-a);return 'rgb('+c.map((v,k)=>Math.round(v+(d[k]-v)*t)).join(',')+')'}};
 ok(bars.length===ex.length&&bars.every((x,i)=>x.f===pcol(ex[i])&&Math.abs(x.w-Math.max(14,x.bw*ex[i]/100))<.2),'bars: length = percentile, colour red → green');
 /* raw counts, another tournament, a position group */
 await pg.uncheck('#sbpa');await pg.waitForFunction(()=>/Raw counts/.test(document.querySelector('#sbpb svg').textContent));
 ok(await shown(pg,'#sbpb')===label(CC,first,false),'raw counts (not adjusted): '+(await shown(pg,'#sbpb')).slice(0,100)+'…');
 await pg.selectOption('#sbpc','1');await pg.waitForFunction(n=>document.querySelector('#sbpb svg').textContent.includes(n),DP.comps[1].name);
 await pg.selectOption('#sbpg','CB');await pg.waitForTimeout(600);
 const C1=DP.comps[1],cb=C1.players.filter(p=>p[3]==='CB'&&p[4]>=C1.min).sort((a,c)=>(per90(c,'pr',false)||0)-(per90(a,'pr',false)||0)||a[1].localeCompare(c[1]))[0];
 ok(await shown(pg,'#sbpb')===label(C1,cb,false),C1.name+', centre-backs: '+cb[1]+' recomputed');
 const r2=await png(pg,'.sbp-s',1080);ok(r2.ok&&/^pressing-card-/.test(r2.name),'Save image: a '+r2.w+' × '+r2.h+' PNG ('+r2.kb+' KB), '+r2.name);
 ok(await pg.$eval('#sbpb svg',s=>!!s.querySelector('image[href^="data:image/svg+xml"]')),'the player card carries the StatsBomb logo');
 ok(!errs.length,'player card: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic, phone */
 ({ctx,pg,errs}=await open(b,{vw:390,lang:'ar'}));await pg.waitForSelector('#sbpb .dcx-c svg',{timeout:60000});
 ok(/Alpha 1 pressures/.test(await shown(pg,'#sbpb'))&&await pg.$eval('#sbpb svg',s=>s.textContent.includes('خريطة الضغط')&&s.textContent.includes('كتلة منخفضة')),'Arabic: the card in Arabic');
 ok(!(await pg.evaluate(()=>[...document.querySelectorAll('#sbpb .fx-en,.sbp-att .fx-en,.sbp-tabs .fx-en')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent))).length,'Arabic: no English label shows around the card');
 ok(await T.noscroll(pg),'390 px: no horizontal scroll');
 ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* leaving before the data arrives */
 ({ctx,pg,errs}=await open(b));await pg.waitForSelector('#sbpb',{timeout:60000});await pg.evaluate(()=>location.hash='#/table');await pg.waitForTimeout(2500);
 ok(!(await pg.$('#sbpb'))&&!errs.length,'leaving before the data arrives: nothing left behind, no errors');await ctx.close();
 /* StatsBomb not answering: the page says so and the player card (our own file) still works */
 ({ctx,pg,errs}=await open(b,{mode:'down'}));await pg.waitForSelector('#sbpb .empty',{timeout:60000});
 ok(/Could not reach StatsBomb/.test(await pg.$eval('#sbpb',e=>e.innerText)),'StatsBomb not answering: the match map says so');
 await pg.click('.sbp-tabs button[data-t="p"]');await pg.waitForSelector('#sbpb #sbpc svg, #sbpb .dcx-c svg',{timeout:60000});
 ok((await pg.$$('#sbpb svg')).length>0&&!errs.length,'the player card still works (it uses data/sb_press.json): no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 await T.done(b);
})();
