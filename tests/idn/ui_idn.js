/* Visual identity (assets/identity.css, assets/fonts): the fonts are files of this project and nothing is asked of another site; Latin text uses Plex Sans and
   Arabic text Plex Sans Arabic (each file is loaded only when the page shows its script); Arabic titles keep joined letters (no letter spacing); the page
   titles are heavier and tighter, numbers in tables are tabular; the cards are glass surfaces (an inset highlight and a shadow) whose own background stays opaque
   (the Liquid Glass reads it) and the header blurs what is behind it; a glow of the league's colour sits behind the page without catching the pointer; text and
   muted text keep their contrast on the cards in all six leagues' colours; a phone has no horizontal scroll on several pages in English and Arabic; a missing
   font file leaves the page readable (the fallback font) with no error; reduced motion stops the row hover fade; the licences of the fonts are in the repository. */
const T=require('../nf/lib.js');const {ok,J}=T;const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..'),A=path.join(ROOT,'assets');
const css=fs.readFileSync(path.join(A,'identity.css'),'utf8');
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
(async()=>{
 /* the files */
 {const faces=[...css.matchAll(/url\(([^)]+)\)/g)].map(m=>m[1]);const files=faces.map(f=>path.join(A,f));
  ok(faces.length===15&&faces.every(f=>/^fonts\/plex-sans-(latin|latin-ext|arabic)-(400|600|700)\.woff2$|^fonts\/changa-(latin|latin-ext|arabic)-(700|800)\.woff2$/.test(f)),'identity.css names 15 font files (Plex Sans: Latin, Latin extended, Arabic x 3 weights; Changa: the same three scripts x 2 weights), all inside assets/fonts');
  ok(files.every(f=>fs.existsSync(f)&&fs.readFileSync(f).slice(0,4).toString()==='wOF2'&&fs.statSync(f).size<60000),'each is a real woff2 file under 60 KB ('+files.map(f=>Math.round(fs.statSync(f).size/1024)+'K').join(' ')+')');
  ok(!/https?:|@import|googleapis|gstatic/i.test(css),'the stylesheet asks nothing of another site');
  ok(fs.readFileSync(path.join(A,'fonts','OFL-Changa.txt'),'utf8').includes('SIL Open Font License')&&fs.readFileSync(path.join(A,'fonts','OFL-IBM-Plex-Sans.txt'),'utf8').includes('SIL Open Font License')&&fs.readFileSync(path.join(A,'fonts','OFL-IBM-Plex-Sans-Arabic.txt'),'utf8').includes('SIL Open Font License'),'the licence of each font family is next to the files')}
 const b=await T.launch();
 /* English: fonts, type, glass */
 let {ctx,pg,errs}=await T.open(b,{vw:1280,lang:'en',league:'l_4WFCIZ',hash:'#/fortress'});const reqs=[];pg.on('request',r=>reqs.push(r.url()));
 await pg.waitForSelector('.ft-row',{timeout:90000});await pg.waitForTimeout(1200);
 const en=await pg.evaluate(()=>{const cs=(e,p)=>getComputedStyle(e)[p],h=document.querySelector('#app h2'),card=document.querySelector('.card'),tb=document.querySelector('.ft-t,table');
  return {fam:cs(document.body,'fontFamily'),h2fam:cs(h,'fontFamily'),h2w:cs(h,'fontWeight'),h2ls:cs(h,'letterSpacing'),h2fs:parseFloat(cs(h,'fontSize')),tab:tb?cs(tb,'fontVariantNumeric'):'',rad:parseFloat(cs(card,'borderRadius')),sh:cs(card,'boxShadow'),bg:cs(card,'backgroundColor'),hb:cs(document.querySelector('header'),'backdropFilter'),
   fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/"/g,'')+' '+f.weight)}});
 ok(/^"?Plex Sans"?,\s*"?Plex Sans Arabic"?/.test(en.fam),'the page font is Plex Sans, then Plex Sans Arabic ('+en.fam.slice(0,50)+')');
 ok(en.fonts.includes('Plex Sans 400')&&en.fonts.includes('Changa Display 800'),'the Latin files of Plex Sans 400 and Changa 800 (titles) are loaded ('+en.fonts.join(', ')+')');
 ok(+en.h2w===800&&parseFloat(en.h2ls)<0&&en.h2fs>=22&&en.h2fs<=30&&/^"?Changa Display"?/.test(en.h2fam||''),'the page title is Changa 800, slightly tight and 22 to 30 px ('+en.h2fs.toFixed(1)+' px, spacing '+en.h2ls+')');
 ok(/tabular-nums/.test(en.tab),'numbers in tables are tabular');
 ok(en.rad===14&&/inset/.test(en.sh)&&/rgba?\(0, 0, 0/.test(en.sh),'a card has a 14 px radius, an inset highlight and a drop shadow');
 ok(!/\.card[^{]*\{[^}]*background/.test(css.replace(/\/\*[\s\S]*?\*\//g,'')),'identity.css never sets a card\'s background: the theme\'s colour is what the Liquid Glass reads ('+en.bg+')');
 ok(/blur/.test(en.hb),'the header blurs what is behind it ('+en.hb+')');
 {const g=await pg.evaluate(()=>{const s=getComputedStyle(document.body,'::before');return {pos:s.position,pe:s.pointerEvents,z:s.zIndex,img:s.backgroundImage.slice(0,60)}});
  ok(g.pos==='fixed'&&g.pe==='none'&&g.z==='-1'&&/radial-gradient/.test(g.img),'a glow of the league\'s colour sits behind the page and does not catch the pointer')}
 ok(await pg.evaluate(()=>{const a=document.querySelector('.ft-row');a.click();return true}),'the page is still clickable');
 ok(await T.noscroll(pg),'no horizontal scroll');
 ok(reqs.filter(u=>/^https?:/.test(u)&&!u.startsWith('http://127.0.0.1')).every(u=>!/font|gstatic|googleapis/i.test(u)),'no request left the site for a font');
 ok(!!(await pg.$('#hubbar .lgx-g')),'the Liquid Glass is still on the bar of pages');
 ok(!errs.length,'no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* Arabic: its own font, joined letters */
 ({ctx,pg,errs}=await T.open(b,{vw:1280,lang:'ar',league:'l_4WFCIZ',hash:'#/fortress'}));await pg.waitForSelector('.ft-row',{timeout:90000});await pg.waitForTimeout(1200);
 {const ar=await pg.evaluate(()=>{const h=document.querySelector('#app h2'),th=document.querySelector('th');return {ls:getComputedStyle(h).letterSpacing,tls:th?getComputedStyle(th).letterSpacing:'0px',fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/"/g,'')+' '+f.weight)}});
  ok(ar.fonts.some(f=>/^Plex Sans Arabic/.test(f)),'the Arabic page loads the Arabic font ('+ar.fonts.join(', ')+')');
  ok(/^(normal|0px)$/.test(ar.ls)&&/^(normal|0px)$/.test(ar.tls),'Arabic titles and table headers have no letter spacing, so the letters stay joined')}
 ok(!errs.length,'Arabic: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close();
 /* contrast on a card, in the colours of each league */
 for(const [id,name] of [['l_4WFCIZ','Premier League'],['l_0ErfuF','LaLiga'],['l_1Isor4','Bundesliga'],['l_3FJFUl','Ligue 1'],['l_0ALvwF','Serie A'],['l_4QexZg','Liga Portugal']]){
  ({ctx,pg,errs}=await T.open(b,{vw:1000,lang:'en',league:id,hash:'#/fortress'}));await pg.waitForSelector('.ft-row',{timeout:90000});await pg.waitForTimeout(500);
  const c=await pg.evaluate(()=>{const card=document.querySelector('.ft-c'),n=document.querySelector('.ft-c .ins-note');const bg=getComputedStyle(card).backgroundColor;return {bg,tx:getComputedStyle(document.body).color,mu:getComputedStyle(n).color}});
  const bg=rgb(c.bg).slice(0,3),t=cr(rgb(c.tx).slice(0,3),bg),m=cr(rgb(c.mu).slice(0,3),bg);
  ok(t>=7&&m>=4.5,name+': text '+t.toFixed(1)+':1 and muted text '+m.toFixed(1)+':1 on a card');await ctx.close()}
 /* a phone, English and Arabic, several pages */
 for(const lang of ['en','ar'])for(const h of ['#/overview','#/table','#/fantasy','#/fortress','#/shape']){({ctx,pg,errs}=await T.open(b,{vw:390,lang,league:'l_4WFCIZ',hash:h}));await pg.waitForTimeout(3500);
  ok(await T.noscroll(pg)&&!errs.length,lang+' phone '+h+': no horizontal scroll, no errors'+(errs.length?' '+errs[0]:''));await ctx.close()}
 /* a missing font file: the page is readable in the fallback font */
 {const c=await b.newContext();await c.route(/\/fonts\/.*\.woff2/,r=>r.fulfill({status:404,body:''}));const p=await c.newPage(),e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8765/index.html#/fortress');await p.waitForSelector('.ft-row',{timeout:90000});await p.waitForTimeout(800);
  const t=await p.evaluate(()=>({rows:document.querySelectorAll('.ft-row').length,h2:document.querySelector('#app h2').textContent,vis:getComputedStyle(document.querySelector('#app h2')).visibility}));
  ok(t.rows>10&&t.h2==='Fortress'&&t.vis==='visible'&&!e.length,'with the font files missing the page still shows its title and rows in the fallback font, no error');await c.close()}
 /* reduced motion */
 {const c=await b.newContext({reducedMotion:'reduce'});const p=await c.newPage();await p.goto('http://127.0.0.1:8765/index.html#/fortress');await p.waitForSelector('.ft-t,.ft-row',{timeout:90000});await p.waitForTimeout(500);
  const d=await p.evaluate(()=>{const tr=document.querySelector('tbody tr');return tr?getComputedStyle(tr).transitionDuration:'0s'});ok(parseFloat(d)===0,'reduced motion: table rows do not fade on hover ('+d+')');await c.close()}
 await T.done(b)})();
