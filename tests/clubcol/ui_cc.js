/* A player's page wears his club's colours (assets/player-page.js calls the theme's applyTheme(club), as a club's own page does): the accent (--th) has the hue
   of the club's leading colour in the theme table (the first colour marked '!', else the largest that is not white, black or grey and has a fifth of the share),
   its text colour reads on it (4.5:1) and it stands out from the page (3:1); the page says which club it wears; the next page (the table) has the league's colours
   again, exactly as before; a club page and the player's page of the same club agree; another league; no page errors; 390 px. */
const T=require('../nf/lib.js');const {ok}=T;
const hue=h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return null;let k=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;k*=60;return k<0?k+360:k};
const sat=h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;return d?d/(1-Math.abs(2*l-1)):0};
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const dh=(a,b)=>{const d=Math.abs(a-b)%360;return Math.min(d,360-d)};
const hex=v=>{v=v.trim();if(/^#[0-9a-f]{6}$/i.test(v))return v.toLowerCase();const m=v.match(/\d+/g);return m&&m.length>=3?'#'+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join(''):v};
const vars=pg=>pg.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {th:s.getPropertyValue('--th').trim(),ink:s.getPropertyValue('--th-ink').trim(),bg:s.getPropertyValue('--bg').trim(),club:document.documentElement.dataset.club||null,league:document.documentElement.dataset.league}});
(async()=>{const b=await T.launch();
 for(const [lg,club] of [['l_4WFCIZ','Arsenal'],['l_4WFCIZ','Manchester City'],['l_4WFCIZ','Chelsea'],['l_0ErfuF','Real Madrid'],['l_0ErfuF','Barcelona']]){
  const {ctx,pg,errs}=await T.open(b,{vw:1000,league:lg,hash:'#/table'});await pg.waitForSelector('.lt',{timeout:90000});await pg.waitForTimeout(1200);
  const v0=await vars(pg);
  const p=await pg.evaluate(c=>{const s=(D.stats||[]).filter(x=>x.club===c&&x.player_id)[0];return s?{key:s.key,club:s.club}:null},club);
  ok(!!p,lg+' '+club+': a player of the club is in the league file');if(!p){await ctx.close();continue}
  await pg.evaluate(h=>location.hash=h,'#/player/'+encodeURIComponent(p.key+'||'+p.club));await pg.waitForSelector('#pp',{timeout:90000});await pg.waitForTimeout(1200);
  const v=await vars(pg),tbl=await pg.evaluate(c=>THEME.clubs[c.toLowerCase()]||null,club);
  const L=tbl.trim().split(/\s+/).map(x=>{const m=/^(!?)([0-9a-f]{6}):(\d+)$/i.exec(x);return {c:'#'+m[2].toLowerCase(),w:+m[3],lead:!!m[1]}}),tot=L.reduce((a,x)=>a+x.w,0),lead=(L.find(x=>x.lead)||L.find(x=>sat(x.c)>=.12&&x.w/tot>=.2)||L[0]).c;
  const th=hex(v.th),ink=hex(v.ink),bg=hex(v.bg);
  ok(v.club===club,club+': the page says it wears the club ('+v.club+')');
  ok(hue(th)!=null&&dh(hue(th),hue(lead))<=4,club+': the accent has the hue of the club\'s leading colour (leading '+lead+' '+Math.round(hue(lead))+'°, accent '+th+' '+Math.round(hue(th))+'°)');
  ok(cr(ink,th)>=4.5,club+': the text on the accent reads ('+cr(ink,th).toFixed(1)+':1)');ok(cr(th,bg)>=3,club+': the accent stands out from the page ('+cr(th,bg).toFixed(1)+':1)');
  ok(v.th!==v0.th,club+': it is not the league\'s accent any more');
  await pg.evaluate(c=>location.hash='#/club/'+encodeURIComponent(c),club);await pg.waitForSelector('.clubhd',{timeout:90000});await pg.waitForTimeout(900);const vc=await vars(pg);
  ok(vc.th===v.th&&vc.ink===v.ink,club+': the club page and the player\'s page have the same accent ('+vc.th+')');
  await pg.evaluate(()=>location.hash='#/table');await pg.waitForSelector('.lt',{timeout:90000});await pg.waitForTimeout(900);const v2=await vars(pg);
  ok(v2.club===null&&v2.th===v0.th&&v2.bg===v0.bg,club+': leaving the page puts the league\'s colours back exactly as they were ('+v2.th+')');
  ok(!errs.length,club+': no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 {const {ctx,pg,errs}=await T.open(b,{vw:390,lang:'ar',league:'l_4WFCIZ',hash:'#/table'});await pg.waitForSelector('.lt',{timeout:90000});
  const p=await pg.evaluate(()=>{const s=(D.stats||[]).filter(x=>x.club==='Liverpool'&&x.player_id)[0];return {key:s.key,club:s.club}});await pg.evaluate(h=>location.hash=h,'#/player/'+encodeURIComponent(p.key+'||'+p.club));
  await pg.waitForSelector('#pp',{timeout:90000});await pg.waitForTimeout(1000);ok(await T.noscroll(pg)&&(await vars(pg)).club==='Liverpool','Arabic, 390 px: the player page wears Liverpool and does not scroll sideways');
  ok(!errs.length,'Arabic, 390 px: no page errors '+errs.slice(0,2).join(' ; '));await ctx.close()}
 await T.done(b)})();
