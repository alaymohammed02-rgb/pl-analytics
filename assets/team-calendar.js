/* ===== Calendar file for your teams (a card under "Your teams" on the Overview, next to the notifications card) =====
   Builds an .ics file (RFC 5545) in the browser from data/fixtures.json for the teams you starred: one event per match, at its kick-off (UTC), 2 hours long
   (a nominal length: the data has no end time), with an optional alert one hour before. Two of your teams playing each other make one event. A match whose
   kick-off was more than 2 hours ago is left out. Nothing is sent anywhere: the file is made here and saved with a download. It is a snapshot: PitchAPI's
   fixtures can move, and the file does not follow them, so the card says to download it again after a change. Only matches already in the schedule are in it
   (data/fixtures.json lists the next 80 per league). INS.icsBuild(F, teams, o) returns the text (for the test). */
(function(){
 if(typeof INS!=='object'||!INS)return;
 const two=(en,ar)=>`<span class="fx-en">${en}</span><span class="fx-ar" dir="rtl">${ar}</span>`;
 const nm=x=>`<bdi>${esc(x)}</bdi>`,nb=x=>`<bdi dir="ltr">${x}</bdi>`;
 const LEN=2*3600e3;
 const p2=n=>String(n).padStart(2,'0');
 const stamp=ms=>{const d=new Date(ms);return d.getUTCFullYear()+p2(d.getUTCMonth()+1)+p2(d.getUTCDate())+'T'+p2(d.getUTCHours())+p2(d.getUTCMinutes())+p2(d.getUTCSeconds())+'Z'};
 const esct=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
 /* a content line is folded at 75 octets (RFC 5545 3.1), never in the middle of a character; a continuation starts with one space */
 function fold(line){
  const enc=new TextEncoder();if(enc.encode(line).length<=75)return line;
  const out=[];let cur='',n=0,lim=75;
  for(const ch of line){const b=enc.encode(ch).length;if(n+b>lim){out.push(cur);cur=' ';n=1;lim=75}cur+=ch;n+=b}
  out.push(cur);return out.join('\r\n');
 }
 const gen=F=>{const t=F&&F.t?Date.parse(String(F.t).replace(' ','T')+'Z'):NaN;return isFinite(t)?t:Date.now()};
 /* the matches of the starred teams that have not finished: [{i,k(ms),h,a,l}], earliest first, each match once */
 function pick(F,teams,now){
  const want=new Map();for(const f of teams||[]){if(!want.has(f.l))want.set(f.l,new Set());want.get(f.l).add(f.t)}
  const seen=new Set(),out=[];
  for(const [l,set] of want){
   for(const x of ((F&&F.leagues&&F.leagues[l])||[])){
    if(!x||!x.i||!x.k||!(set.has(x.h)||set.has(x.a)))continue;
    const k=Date.parse(x.k);if(!isFinite(k)||k+LEN<now||seen.has(x.i))continue;
    seen.add(x.i);out.push({i:x.i,k,h:x.h,a:x.a,l});
   }
  }
  return out.sort((a,b)=>a.k-b.k||(a.i<b.i?-1:1));
 }
 /* o = {now, alarm:true|false, league(l)->name, note} */
 function icsBuild(F,teams,o){
  o=o||{};const now=o.now!=null?o.now:Date.now(),ms=pick(F,teams,now),st=stamp(gen(F));
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PL Analytics//Matches of my teams//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+esct('PL Analytics: my teams')];
  for(const m of ms){
   const lg=o.league?o.league(m.l):m.l;
   L.push('BEGIN:VEVENT','UID:'+m.i+'@pl-analytics','DTSTAMP:'+st,'DTSTART:'+stamp(m.k),'DTEND:'+stamp(m.k+LEN),
    'SUMMARY:'+esct(m.h+' v '+m.a),'DESCRIPTION:'+esct((lg?lg+'. ':'')+(o.note||'Kick-off times can change: check the site.')),'CATEGORIES:Football','TRANSP:TRANSPARENT');
   if(o.alarm!==false)L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+esct(m.h+' v '+m.a+' kicks off in one hour'),'TRIGGER:-PT1H','END:VALARM');
   L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n')+'\r\n';
 }
 INS.icsBuild=icsBuild;INS.icsPick=pick;
 const lgName=l=>{const x=(ALL.leagues||[]).find(z=>z.id===l);return x?x.name:l};
 const fmt=ms=>new Date(ms).toLocaleDateString(document.documentElement.lang==='ar'?'ar':'en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
 function save(name,text){
  const blob=new Blob([text],{type:'text/calendar;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
 }
 /* host = the "Your teams" section; teams = [{l,t}]. Safe to call again: the old card is replaced. */
 INS.calCard=async function(host,teams){
  if(!host)return;
  const old=host.querySelector('#calcard');if(old)old.remove();
  if(!teams||!teams.length)return;
  let F=null;try{F=typeof fixLoad==='function'?await fixLoad():null}catch(e){F=null}
  if(!host.isConnected)return;
  const again=host.querySelector('#calcard');if(again)again.remove();
  const el=document.createElement('div');el.className='card cal';el.id='calcard';
  const now=Date.now(),ms=F&&F.leagues?pick(F,teams,now):[];
  let body;
  if(!F||!F.leagues)body=`<p class="mu">${two('The match schedule is not available right now.','جدول المباريات مو متوفر الحين.')}</p>`;
  else if(!ms.length)body=`<p class="mu" id="calmsg">${two('None of your teams has a match in the schedule yet.','ما في أي مباراة لفرقك في الجدول للحين.')}</p>`;
  else body=`<p id="calmsg">${two(`<b>${ms.length}</b> ${ms.length===1?'match':'matches'} of your teams, from ${fmt(ms[0].k)} to ${fmt(ms[ms.length-1].k)}.`,`<b>${nb(ms.length)}</b> ${ms.length===1?'مباراة':'مباراة'} لفرقك، من ${nb(fmt(ms[0].k))} إلى ${nb(fmt(ms[ms.length-1].k))}.`)}</p>
    <label class="cal-al"><input type="checkbox" id="calal" checked> <span>${two('Alert me one hour before each kick-off','نبّهني قبل كل مباراة بساعة')}</span></label>
    <button type="button" class="cal-go" id="calgo">${two('Download calendar file (.ics)','نزّل ملف التقويم (.ics)')}</button>`;
  el.innerHTML=`<h3>${two('Your teams\' matches in your calendar','مباريات فرقك في تقويمك')}</h3>
   <p>${two('Save the coming matches of the teams you starred as a calendar file, then open it on your phone or computer to add them to your calendar app. Nothing is sent anywhere: the file is made here.','احفظ المباريات الجاية للفرق اللي حطيت لها نجمة كملف تقويم، وافتحه في جوالك أو كمبيوترك عشان تنضاف لتطبيق التقويم. ما يُرسل أي شي لأي مكان: الملف يتسوّى هنا.')}</p>${body}
   <p class="mu ins-note">${two('This is a snapshot of the schedule today, and it has only the matches already scheduled. Kick-off times can move and the file will not follow them: download it again after a change. Each event is two hours long, which is only a nominal length.','هذا لقطة من الجدول اليوم، وفيه بس المباريات اللي انحط لها موعد. المواعيد ممكن تتغير والملف ما يتبعها: نزّله مرة ثانية بعد أي تغيير. كل حدث ساعتين، وهذي مدة تقريبية فقط.')}</p>`;
  host.appendChild(el);
  const go=el.querySelector('#calgo');
  if(go)go.onclick=()=>{
   const alarm=el.querySelector('#calal').checked,ar=document.documentElement.lang==='ar';
   const txt=icsBuild(F,teams,{now:Date.now(),alarm,league:lgName,note:ar?'مواعيد البداية ممكن تتغير: راجع الموقع.':'Kick-off times can change: check the site.'});
   save('pl-analytics-my-teams.ics',txt);
  };
 };
 if(typeof D==='object'&&D&&typeof route==='function')route();
})();
