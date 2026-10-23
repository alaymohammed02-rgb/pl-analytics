/* shared helpers for the new-feature tests: open a page, a tiny assert, raw league files */
const {chromium}=require('playwright');const fs=require('fs');
const U='http://127.0.0.1:8765/index.html',DATA=(process.env.PLREPO||__dirname+'/../..')+'/data/';let fails=0;
const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}else console.log('ok  ',m)};
const J=f=>JSON.parse(fs.readFileSync(DATA+f,'utf8'));const IDX=J('index.json');
const DOM=l=>l&&l.file&&l.sh_file&&!/world cup|champions|europa|conference|cup|copa|coppa|pokal|coupe|taça/i.test(l.name);
const lg=id=>IDX.leagues.find(l=>l.id===id);
async function launch(){return chromium.launch({executablePath:process.env.CHROME||undefined})}
async function open(b,{vw=1280,lang='en',league='l_0ErfuF',hash='',init=null}={}){const ctx=await b.newContext({viewport:{width:vw,height:900}});
 await ctx.addInitScript(([l,lg,ini])=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league',lg);localStorage.setItem('lang',l);if(ini)Object.entries(ini).forEach(([k,v])=>localStorage.setItem(k,v))}},[lang,league,init]);
 const pg=await ctx.newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{const u=(m.location()||{}).url||'';if(m.type()==='error'&&!/favicon|ERR_TUNNEL_CONNECTION_FAILED|api.github.com|cdn.pitchapi|Failed to load resource/.test(u+m.text()))errs.push(m.text())});
 await pg.goto(U+hash);return {ctx,pg,errs}}
/* Arabic: text nodes with Latin words and no Arabic letter (outside names, numbers, tables of names) */
const untr=(sel,skip)=>{const o=[];document.querySelectorAll(sel).forEach(r=>{const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentNode.closest(skip||'select,option,.fx-en,bdi,.lx-t,.ph-lt'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3}/.test(t)&&!/[؀-ۿ]/.test(t)&&!/^(xG|xPts|PitchAPI|PPDA|StatsBomb|SkillCorner|xAG|npxG|Brier)\b/.test(t))o.push(t)}});return [...new Set(o)]};
const noscroll=pg=>pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
const done=async b=>{await b.close();console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0)};
module.exports={ok,J,IDX,DOM,lg,launch,open,untr,noscroll,done,fails:()=>fails};
