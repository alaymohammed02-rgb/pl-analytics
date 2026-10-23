const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:390,height:900},deviceScaleFactor:4});
await ctx.addInitScript(()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.clear();localStorage.setItem('league','l_4WFCIZ');localStorage.setItem('lang','en')}});
const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:8765/index.html#/replay/m_3zGtlu');await pg.waitForSelector('#rp .rp-sb',{timeout:60000});
const info=()=>pg.evaluate(()=>{const svg=[...document.querySelectorAll('.rp-ch svg')].find(s=>s.getBoundingClientRect().width>0);const c=svg.querySelector('.rp-clipr');
 return {clk:document.querySelector('#rpclk').textContent,sc:document.querySelector('#rpsc').textContent,ov:document.querySelector('#rpov').className,T:+document.querySelector('#rpsk').value,max:document.querySelector('#rpsk').max,
 L:svg.dataset.l,W:svg.dataset.w,vbW:svg.viewBox.baseVal.width,clipEnd:+c.getAttribute('x')+ +c.getAttribute('width'),gm:[...svg.querySelectorAll('.rp-gm')].map(g=>[g.getAttribute('class'),+g.getAttribute('cx'),+g.getAttribute('cy')])}});
// press next until HT
for(let i=0;i<20;i++){await pg.click('#rpnext');const s=await info();if(+s.T>45){break}}
const s0=await info();console.log('after next',JSON.stringify(s0));
// seek a bit before 45+ and play to reach HT
await pg.evaluate(()=>{const s=document.querySelector('#rpsk');s.value=47.5;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}))});
await pg.click('#rpp');await pg.waitForSelector('#rpov.on.br',{timeout:20000});
console.log('HT',JSON.stringify(await info()));
const loc=pg.locator('.rp-ch svg').filter({visible:true}).first();await loc.screenshot({path:'ht_a.png'});await pg.evaluate(()=>document.querySelectorAll('.rp-gm').forEach(g=>g.style.display='none'));await loc.screenshot({path:'ht_b.png'});
await b.close()})();
