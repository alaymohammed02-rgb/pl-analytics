/* Names by sound (assets/name-sound.js): a name typed in Arabic letters finds the player stored in Latin letters. The measure: tests/ns/names.json holds common Arabic
   spellings of well-known players (written by hand, several spellings of the same name on purpose); for each one whose player is in this season's data the test asks the
   matcher, over every player of the six leagues, and counts how often he is in the first 8 and how often first (the page's own order: nearest spelling, then minutes).
   Then the pages: the header search (players and clubs), Guess the player, Player career, XI Builder and Ask the site; that Latin typing is unchanged; that Arabic words
   which are not names find nobody; Arabic and a 390 px phone. Nothing is shown in Arabic that the data does not hold: the matched names stay in Latin letters. */
const T=require('../nf/lib.js');const {ok,J,IDX,DOM}=T;const fs=require('fs');
global.INS={};eval(fs.readFileSync(__dirname+'/../../assets/name-sound.js','utf8'));const NS=global.INS.nameSound;
const LIST=JSON.parse(fs.readFileSync(__dirname+'/names.json','utf8'));
const LG6=IDX.leagues.filter(DOM),P=new Map();
for(const l of LG6){const d=J(l.pl_file),ix={};d.cols.forEach((c,i)=>ix[c]=i);for(const r of d.rows){if(r[ix.mi]==null)continue;const k=r[ix.i],a=P.get(k)||{id:k,name:r[ix.n],mi:0,lg:l.id,club:r[ix.c]};a.mi+=r[ix.mi];a.club=r[ix.c]||a.club;P.set(k,a)}}
const ALL=[...P.values()];
/* --- the keys, by hand */
ok(NS.arKeys('هالاند').join()==='HLNT'&&NS.nameKeys('Erling Haaland')[1].includes('HLNT'),'هالاند and Haaland give the same key (H-L-N-T)');
ok(NS.arKeys('مبابي').join()==='MB'&&NS.nameKeys('Kylian Mbappé')[1].includes('MB'),'مبابي and Mbappé: b and p are one sound, doubled letters count once');
ok(NS.match('ريتشارليسون','Richarlison')===2&&NS.match('سانشيز','Alexis Sánchez')===2&&NS.match('مايكل','Michael Olise')===2,'"ch" may sound as in Richarlison, Sánchez or Michael');
ok(NS.match('يوهانسون','Jon Johansson')===2&&NS.match('جوتا','Diogo Jota')===2&&NS.match('فيرنر','Timo Werner')===2&&NS.match('واتكينز','Ollie Watkins')===2,'"j" as in Johansson or Jota, "w" as in Werner or Watkins');
ok(NS.match('هالا','Erling Haaland')===1&&NS.match('هالاند','Erling Haaland')===2&&NS.match('هالاند','Harry Kane')===0,'a name half typed matches as a start (1), a whole word as 2, another name not at all');
ok(NS.match('ع','Ali')===0&&NS.match('لي','Lee')===0&&NS.match('رايا','David Raya')===2,'one consonant is not enough, unless the word has three letters or more');
ok(!NS.isArabic('Haaland')&&NS.isArabic('هالاند')&&NS.match('','x')===0&&NS.match('هالاند','')===0,'Latin typing is not touched; empty things match nothing');
ok(NS.dist('غافي','Gavi')<NS.dist('غافي','Javi Sánchez')&&NS.dist('دوكو','Jérémy Doku')<NS.dist('دوكو','Diego Coppola'),'the order looks at the letters: غافي is nearer Gavi than Javi, دوكو nearer Doku than Diego');
/* --- the measure */
let n=0,top8=0,first=0;const miss=[],absent=new Set();
for(const [ar,en] of LIST){if(!ALL.some(p=>p.name===en)){absent.add(en);continue}n++;
 const r=NS.search(ar,ALL,p=>p.name,(a,b)=>b.mi-a.mi,2).map(p=>p.name),i=r.indexOf(en);if(i>=0&&i<8)top8++;else miss.push(ar+' ('+en+')');if(i===0)first++}
console.log('     '+LIST.length+' spellings in the list, '+n+' of players in this season\'s data ('+absent.size+' players are not in it)');
console.log('     in the first 8: '+top8+' of '+n+' ('+Math.round(100*top8/n)+'%), first: '+first+' ('+Math.round(100*first/n)+'%)'+(miss.length?'; not found: '+miss.join(', '):''));
ok(n>=80,'at least 80 of the listed spellings can be tested ('+n+')');
ok(top8/n>=0.9,'the right player is in the first 8 for at least 90% of the spellings ('+top8+' of '+n+')');
ok(first/n>=0.7,'and first for at least 70% ('+first+' of '+n+')');
/* a second list the matcher was never adjusted on (written once, measured as it came out) */
{const HELD=JSON.parse(fs.readFileSync(__dirname+'/names_held.json','utf8'));let m=0,t8=0,f1=0;const ms=[];
 for(const [ar,en] of HELD){if(!ALL.some(p=>p.name===en))continue;m++;const r=NS.search(ar,ALL,p=>p.name,(a,b)=>b.mi-a.mi,2).map(p=>p.name),i=r.indexOf(en);if(i>=0&&i<8)t8++;else ms.push(ar+' ('+en+')');if(i===0)f1++}
 console.log('     held-out list: '+m+' spellings, in the first 8: '+t8+' ('+Math.round(100*t8/m)+'%), first: '+f1+' ('+Math.round(100*f1/m)+'%)'+(ms.length?'; not found: '+ms.join(', '):''));
 ok(m>=35&&t8/m>=0.75,'held-out spellings: the right player is in the first 8 for at least 75% ('+t8+' of '+m+')')}
/* Arabic words that are not names find nobody with the strict setting the header and Ask use */
{const words=['جدول','الترتيب','مباريات','اليوم','افضل','الهدافين','احصائيات'];const hits=words.map(w=>[w,NS.search(w,ALL.filter(p=>NS.match(w,p.name)===2),p=>p.name,null,.45).length]);
 console.log('     everyday words, whole-word matches at the strict setting: '+hits.map(x=>x.join(' ')).join(', '));
 ok(hits.filter(x=>x[1]>0).length<=1,'everyday Arabic words (table, standings, matches, today...) match no player as a whole word, or one at most')}
(async()=>{const b=await T.launch();const LG='l_4WFCIZ';
 const inPL=ALL.filter(p=>p.lg===LG);const H=inPL.find(p=>p.name==='Erling Haaland'),SK=inPL.find(p=>p.name==='Bukayo Saka');
 let {ctx,pg,errs}=await T.open(b,{vw:1280,league:LG,hash:'#/table'});await pg.waitForSelector('.lt',{timeout:90000});await pg.waitForFunction(()=>typeof INS==='object'&&INS.nameSound,null,{timeout:60000});
 const head=async q=>{await pg.fill('#gsq',q);await pg.waitForTimeout(250);return pg.$$eval('#gsres a[role=option]',a=>a.map(x=>[x.getAttribute('href'),x.textContent.trim()]))};
 if(H){const r=await head('هالاند');ok(r.length>0&&/^#\/player\//.test(r[0][0])&&/Erling Haaland/.test(r[0][1]),'header search "هالاند": the first result is Erling Haaland\'s page ('+r.length+' results)');
  const r2=await head('Haaland');ok(r2.some(x=>/Erling Haaland/.test(x[1])),'header search "Haaland" still works');}
 {const r=await head('ليفربول');ok(r.some(x=>x[0]==='#/club/Liverpool'),'header search "ليفربول" finds the club Liverpool');
  const r3=await head('ارسنال');ok(r3.some(x=>x[0]==='#/club/Arsenal'),'header search "ارسنال" finds Arsenal');
  const r4=await head('جدول');ok(r4.every(x=>!/^#\/player\//.test(x[0])),'header search "جدول" (table) lists no player ('+r4.length+' results)')}
 /* Guess the player */
 await pg.evaluate(()=>{location.hash='#/guess'});await pg.waitForSelector('#gpq',{timeout:90000});
 if(SK){await pg.fill('#gpq','ساكا');await pg.waitForTimeout(250);const s=await pg.$$eval('.gp-sb',a=>a.map(x=>x.textContent.trim()));
  ok(s.length>0&&s.length<=8&&/^Bukayo Saka/.test(s[0]),'Guess the player: typing "ساكا" offers Bukayo Saka first ('+s.length+' offered)')}
 {await pg.fill('#gpq','sak');await pg.waitForTimeout(200);ok((await pg.$$eval('.gp-sb',a=>a.length))>0,'Guess the player: Latin typing still offers players')}
 /* Player career */
 await pg.evaluate(()=>{location.hash='#/career'});await pg.waitForSelector('#pcq',{timeout:90000});
 if(H){await pg.fill('#pcq','هالاند');await pg.waitForTimeout(300);const ids=await pg.$$eval('#pcsug a',a=>a.map(x=>x.dataset.id));ok(ids[0]===H.id&&ids.length<=8,'Player career: "هالاند" lists Erling Haaland first')}
 /* XI Builder */
 await pg.evaluate(()=>{location.hash='#/builder'});await pg.waitForSelector('.xb-pitch',{timeout:90000});await pg.click('.xb-slot[data-i="10"]');await pg.waitForSelector('.xb-row',{timeout:30000});
 if(H){const only=await pg.$('#xbo');if(only&&await only.isChecked()){await only.click();await pg.waitForTimeout(300)}
  await pg.fill('#xbq','هالاند');await pg.waitForTimeout(600);const rows=await pg.$$eval('.xb-row',a=>a.map(x=>x.dataset.k));
  ok(rows.includes(H.lg+'|'+H.id)&&rows.length<=12,'XI Builder: "هالاند" in the search box lists Erling Haaland ('+rows.length+' listed)');
  await pg.fill('#xbq','haaland');await pg.waitForTimeout(600);ok((await pg.$$eval('.xb-row',a=>a.map(x=>x.dataset.k))).includes(H.lg+'|'+H.id),'XI Builder: Latin typing still works')}
 /* Ask the site */
 await pg.evaluate(()=>{location.hash='#/ask'});await pg.waitForSelector('#akq',{timeout:90000});
 const ask=async q=>{await pg.fill('#akq',q);await pg.click('#akf button[type=submit]');await pg.waitForTimeout(700);return pg.evaluate(()=>INS.askParse(document.getElementById('akq').value,window.__ctx||{clubs:[],players:[]}))};
 if(H){await pg.fill('#akq','هالاند');await pg.click('#akf button[type=submit]');await pg.waitForFunction(()=>document.querySelector('#akout .card'),null,{timeout:20000});
  ok(await pg.evaluate(()=>!!document.querySelector('#akout .ak-p')&&/Erling Haaland/.test(document.getElementById('akout').textContent)),'Ask the site: "هالاند" answers with Erling Haaland\'s numbers');
  await pg.fill('#akq','كم هدف سجل هالاند');await pg.click('#akf button[type=submit]');await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>/Erling Haaland/.test(document.getElementById('akout').textContent)),'Ask the site: "كم هدف سجل هالاند" is about Erling Haaland');
  await pg.fill('#akq','أكثر لاعب سجل أهداف في الدوري الإنجليزي');await pg.click('#akf button[type=submit]');await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>!!document.querySelector('#akout .ak-t')),'Ask the site: an Arabic ranking question is still a ranking (no word of it is taken for a player)')}
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 for(const lang of ['ar','en']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:LG,hash:'#/guess'}));await pg.waitForSelector('#gpq',{timeout:90000});
  if(lang==='ar')ok(/عربي/.test(await pg.getAttribute('#gpq','placeholder')),'Arabic: the box says a name may be typed in Arabic or English');
  if(SK){await pg.fill('#gpq','ساكا');await pg.waitForTimeout(250);ok((await pg.$$eval('.gp-sb',a=>a.length))>0&&await T.noscroll(pg),lang+' phone: Arabic typing offers players, no sideways scroll')}
  ok(!errs.length,lang+' phone: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
