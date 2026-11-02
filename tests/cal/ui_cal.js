/* Calendar file for your teams (assets/team-calendar.js, a card under "Your teams" on the Overview): the .ics that is downloaded is read back by a parser of its own and
   compared with data/fixtures.json: one event per match of the starred teams (UID, UTC start, 2 hours, "Home v Away"), earliest first, a match between two starred teams once,
   a match that started within 2 hours still in and an older one out (the browser's clock is fixed), the alert one hour before on and off, CRLF lines of 75 octets at most
   with folded lines that unfold to the same text, escaping of commas and semicolons, a long Arabic name; no card without a starred team; a schedule that does not load; a team
   with no match; Arabic and 390 px. */
const T=require('../nf/lib.js');const {ok,J}=T;
const FX=J('fixtures.json');
const FAV=(...t)=>({plx_favs_v2:JSON.stringify({v:2,t:t.map(([l,n])=>({l,t:n}))})});
const z=ms=>new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g,'');
const unfold=s=>s.replace(/\r\n /g,'');
function parse(txt){
 const lines=unfold(txt).split('\r\n');if(lines[lines.length-1]==='')lines.pop();
 const ev=[];let cur=null,al=null,top={};
 for(const ln of lines){
  if(ln==='BEGIN:VEVENT'){cur={alarm:null};continue}
  if(ln==='END:VEVENT'){ev.push(cur);cur=null;continue}
  if(ln==='BEGIN:VALARM'){al={};continue}
  if(ln==='END:VALARM'){cur.alarm=al;al=null;continue}
  const k=ln.indexOf(':'),n=ln.slice(0,k),v=ln.slice(k+1);
  if(al)al[n]=v;else if(cur)cur[n]=v;else top[n]=(top[n]||[]).concat(v);
 }
 return {lines,ev,top};
}
const unesc=s=>s.replace(/\\n/g,'\n').replace(/\\([;,\\])/g,'$1');
function want(teams,now){
 const seen=new Set(),out=[];
 for(const [l,t] of teams)for(const x of FX.leagues[l]||[]){if((x.h===t||x.a===t)&&Date.parse(x.k)+2*3600e3>=now&&!seen.has(x.i)){seen.add(x.i);out.push(x)}}
 return out.sort((a,b)=>Date.parse(a.k)-Date.parse(b.k)||(a.i<b.i?-1:1));
}
async function open(b,o){const r=await T.open(b,{...o,hash:'#/table'});await r.pg.waitForSelector('#app h2',{timeout:60000});if(o.now)await r.pg.clock.setFixedTime(o.now);await r.pg.evaluate(h=>{location.hash=h},o.hash);return r}
async function download(pg){const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#calgo')]);const fs=require('fs');const p=await dl.path();return {name:dl.suggestedFilename(),text:fs.readFileSync(p,'utf8')}}
(async()=>{const b=await T.launch();
 const LG='l_4WFCIZ',LL='l_0ErfuF';
 const a=FX.leagues[LG].filter(x=>x.h==='Arsenal'||x.a==='Arsenal').sort((p,q)=>Date.parse(p.k)-Date.parse(q.k));
 const opp=a[4].h==='Arsenal'?a[4].a:a[4].h;
 const picks=[[LG,'Arsenal'],[LL,'Atlético Madrid'],[LG,opp]];
 const now=Date.parse(a[3].k)+3600e3;   /* one hour after Arsenal's fourth coming match began: that match is still in, the first three are out */
 let {ctx,pg,errs}=await open(b,{vw:1100,lang:'en',league:LG,hash:'#/overview',init:FAV(...picks),now});await pg.waitForSelector('#calgo',{timeout:90000});await pg.waitForTimeout(300);
 const W=want(picks,now);
 ok(W.some(x=>(x.h==='Arsenal'&&x.a===opp)||(x.a==='Arsenal'&&x.h===opp)),'the fixture list holds a match between two of the starred teams (Arsenal and '+opp+')');
 const msg=await pg.innerText('#calmsg');
 ok(new RegExp('^'+W.length+' matches of your teams').test(msg),'the card counts '+W.length+' matches: "'+msg.slice(0,60)+'"');
 ok(await pg.$eval('#calcard',e=>!!e.closest('.ovt')&&e.classList.contains('card')),'the card sits inside the "Your teams" section');
 const f=await download(pg),P=parse(f.text);
 ok(f.name==='pl-analytics-my-teams.ics','the file is named pl-analytics-my-teams.ics ('+f.name+')');
 ok(P.top.VERSION[0]==='2.0'&&/^-\/\/PL Analytics/.test(P.top.PRODID[0])&&P.lines[0]==='BEGIN:VCALENDAR'&&P.lines[P.lines.length-1]==='END:VCALENDAR','calendar header: BEGIN, VERSION 2.0, PRODID, END');
 ok(!/[^\r]\n/.test(f.text)&&f.text.endsWith('\r\n'),'every line ends with CRLF');
 ok(f.text.split('\r\n').every(l=>Buffer.byteLength(l,'utf8')<=75),'no line is longer than 75 octets');
 ok(P.ev.length===W.length,'the file has '+W.length+' events like the schedule');
 ok(W.every((x,i)=>{const e=P.ev[i],k=Date.parse(x.k);return e.UID===x.i+'@pl-analytics'&&e.DTSTART===z(k)&&e.DTEND===z(k+2*3600e3)&&unesc(e.SUMMARY)===x.h+' v '+x.a}),'each event: UID, start in UTC, end two hours later, "Home v Away", earliest first');
 ok(new Set(P.ev.map(e=>e.UID)).size===P.ev.length,'a match between two starred teams is one event');
 ok(!P.ev.some(e=>e.UID===a[0].i+'@pl-analytics')&&P.ev.some(e=>e.UID===a[3].i+'@pl-analytics'),'a match that began three hours ago is out, one that began an hour ago is still in');
 ok(P.ev.every(e=>e.alarm&&e.alarm.TRIGGER==='-PT1H'&&e.alarm.ACTION==='DISPLAY'),'every event has the alert one hour before');
 ok(P.ev.every(e=>/Premier League|English/i.test(e.DESCRIPTION)||e.DESCRIPTION.length>5),'the description names the league and warns that times can change');
 await pg.uncheck('#calal');const g=await download(pg),G=parse(g.text);
 ok(G.ev.length===W.length&&G.ev.every(e=>e.alarm===null)&&!/VALARM/.test(g.text),'with the alert unticked there is no VALARM');
 /* escaping and folding, on the builder itself */
 const t=await pg.evaluate(()=>INS.icsBuild({t:'2026-11-02 10:00:00',leagues:{x:[{i:'m_t',d:'2026-11-09',k:'2026-11-09T19:00:00Z',h:'Foo, Bar; FC \\ و',a:'نادي الاتحاد السعودي لكرة القدم الدولي الكبير جداً العريق'}]}},[{l:'x',t:'Foo, Bar; FC \\ و'}],{now:Date.parse('2026-11-02T10:00:00Z'),alarm:false,league:()=>'A, B; C',note:'x'}));
 const Q=parse(t);
 ok(Q.ev.length===1&&unesc(Q.ev[0].SUMMARY)==='Foo, Bar; FC \\ و v نادي الاتحاد السعودي لكرة القدم الدولي الكبير جداً العريق','a comma, a semicolon, a backslash and a long Arabic name come back unchanged after unfolding');
 ok(t.replace(/\r\n /g,'').includes('SUMMARY:Foo\\, Bar\\; FC \\\\ و v '),'they are escaped in the file');
 ok(t.split('\r\n').every(l=>Buffer.byteLength(l,'utf8')<=75)&&/\r\n /.test(t),'the long line is folded at 75 octets and a continuation starts with a space');
 ok(unesc(Q.ev[0].DESCRIPTION)==='A, B; C. x','the description is the league and the note, escaped');
 ok(Q.ev[0].DTSTAMP==='20261102T100000Z','DTSTAMP is the time of the schedule file');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* no starred team: no card */
 ({ctx,pg,errs}=await open(b,{vw:1100,league:LG,hash:'#/overview',now}));await pg.waitForSelector('.ovt',{timeout:90000});await pg.waitForTimeout(800);
 ok(!(await pg.$('#calcard')),'no starred team: no calendar card');await ctx.close();
 /* a team with no match in the schedule */
 ({ctx,pg,errs}=await open(b,{vw:1100,league:LG,hash:'#/overview',init:FAV([LG,'Nobody FC']),now}));await pg.waitForSelector('#calcard',{timeout:90000});await pg.waitForTimeout(300);
 ok(!(await pg.$('#calgo'))&&/None of your teams has a match/.test(await pg.innerText('#calcard')),'a team with no match: the card says so and has no download button');await ctx.close();
 /* a schedule that does not load */
 {const c=await b.newContext({viewport:{width:1100,height:900}});await c.addInitScript(i=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en');localStorage.setItem('plx_favs_v2',i)}},JSON.stringify({v:2,t:[{l:LG,t:'Arsenal'}]}));
  await c.route(/fixtures\.json/,r=>r.fulfill({status:500,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/overview');
  await p.waitForSelector('#calcard',{timeout:90000});ok(/not available right now/.test(await p.innerText('#calcard'))&&!(await p.$('#calgo'))&&!e.length,'a failing schedule file: a message, no button, no error');await c.close()}
 /* Arabic and phone */
 for(const lang of ['ar','en']){({ctx,pg,errs}=await open(b,{vw:390,lang,league:LG,hash:'#/overview',init:FAV(...picks),now}));await pg.waitForSelector('#calgo',{timeout:90000});await pg.waitForTimeout(300);
  ok(await T.noscroll(pg),lang+' phone: no horizontal scroll');
  ok(await pg.$eval('#calcard',e=>e.scrollWidth<=e.clientWidth+1),lang+' phone: the card fits');
  if(lang==='ar'){const u=await pg.evaluate(T.untr,'#calcard');ok(!u.length,'Arabic: card translated '+u.slice(0,4).join(' | '));ok(/مباريات فرقك في تقويمك/.test(await pg.textContent('#calcard h3')),'Arabic title');
   const h=await download(pg),H=parse(h.text);ok(H.ev.length===W.length&&/مواعيد البداية/.test(H.ev[0].DESCRIPTION),'Arabic: the same events, with the note in Arabic')}
  ok(!/\$\{|NaN|undefined/.test(await pg.innerText('#calcard')),lang+' phone: no template text, NaN or undefined');
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
